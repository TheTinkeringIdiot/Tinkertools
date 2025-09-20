"""
Import validation tests for perk system.

Tests the DataImporter's ability to:
- Import perks successfully from perks.json
- Map profession/breed strings to integer IDs correctly
- Parse perk series and counter values
- Handle data validation and error cases
- Create proper item-perk relationships
"""

import pytest
import json
import tempfile
import os
from unittest.mock import Mock, patch, mock_open
from sqlalchemy.orm import Session

from app.core.importer import DataImporter, ImportStats
from app.core import perk_validator
from app.models import Item, Perk


class TestPerkImportSuccess:
    """Test successful perk import scenarios."""

    @pytest.fixture
    def mock_perks_data(self):
        """Mock perks.json data structure for testing."""
        return {
            "columns": ["aoid", "name", "counter", "type", "professions", "breeds", "level", "aiTitle"],
            "values": [
                [210830, "Accumulator", 1, "SL", ["Trader"], [], 10, None],
                [210831, "Accumulator", 2, "SL", ["Trader"], [], 20, None],
                [261355, "Acquisition", 1, "LE", ["Fixer"], [], 1, None],
                [211655, "Acrobat", 1, "SL", ["Fixer", "Martial Artist", "Shade", "Adventurer"], [], 30, None],
                [247748, "Alien Technology Expertise", 1, "AI", [], [], 15, None],
                [252492, "Atrox Primary Genome", 1, "AI", [], ["Atrox"], 5, None],
                [303268, "Apotheosis", 1, "LE", [], [], 200, 1],  # Has AI level requirement
                [252301, "Ancient Knowledge", 1, "AI", ["Meta Physicist"], [], 15, None],
                [210842, "Assassin", 1, "SL", ["Agent"], [], 10, None],
                [211666, "Bio Shielding", 1, "SL", ["Adventurer", "Enforcer", "Engineer", "Keeper"], [], 10, None]
            ]
        }

    @pytest.fixture
    def mock_item_data(self):
        """Mock item data for testing perk creation."""
        return [
            {
                "AOID": 210830,
                "Name": "Accumulator",
                "Description": "Trader perk that provides stat bonuses",
                "StatValues": [
                    {"Stat": 76, "RawValue": 99999},  # Item class
                    {"Stat": 54, "RawValue": 10}      # Quality level
                ]
            },
            {
                "AOID": 261355,
                "Name": "Acquisition",
                "Description": "Fixer perk for improved item acquisition",
                "StatValues": [
                    {"Stat": 76, "RawValue": 99999},
                    {"Stat": 54, "RawValue": 1}
                ]
            },
            {
                "AOID": 100001,  # Non-perk item
                "Name": "Test Weapon",
                "Description": "Regular weapon item",
                "StatValues": [
                    {"Stat": 76, "RawValue": 1},
                    {"Stat": 54, "RawValue": 150}
                ]
            }
        ]

    def test_perk_import_creates_records(self, db_session: Session, mock_perks_data, mock_item_data):
        """Test that perk import creates proper records in database."""
        with patch('builtins.open', mock_open(read_data=json.dumps(mock_perks_data))):
            with patch.dict(os.environ, {'DATABASE_URL': 'mock://test'}):
                importer = DataImporter(db_url="sqlite:///:memory:")

                # Mock the database session to use our test session
                importer.get_db_session = lambda: db_session

                # Load perk metadata (this will use our mocked file)
                importer.load_perk_metadata()

                # Verify perk metadata was loaded
                assert len(importer._perk_data) == 10
                assert 210830 in importer._perk_data
                assert 261355 in importer._perk_data

                # Import items
                for item_data in mock_item_data:
                    importer.import_item(db_session, item_data, is_nano=False)

                db_session.commit()

                # Verify items were created
                items = db_session.query(Item).all()
                assert len(items) == 3

                # Verify perk records were created for perk items only
                perks = db_session.query(Perk).all()
                assert len(perks) == 2  # Only 210830 and 261355 are in both datasets

                # Check specific perk details
                accumulator_perk = db_session.query(Perk).join(Item).filter(Item.aoid == 210830).first()
                assert accumulator_perk is not None
                assert accumulator_perk.name == "Accumulator 1"
                assert accumulator_perk.perk_series == "Accumulator"
                assert accumulator_perk.counter == 1
                assert accumulator_perk.type == "SL"
                assert accumulator_perk.level_required == 10
                assert accumulator_perk.ai_level_required == 0
                assert accumulator_perk.professions == [7]  # Trader = 7
                assert accumulator_perk.breeds == []

    def test_all_perks_can_be_processed(self, db_session: Session):
        """Test that all 1,972 perks from perks.json can be processed."""
        # Load actual perks.json file
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        perks_file = os.path.join(backend_dir, "database", "perks.json")

        with patch.dict(os.environ, {'DATABASE_URL': 'mock://test'}):
            importer = DataImporter(db_url="sqlite:///:memory:")
            importer.get_db_session = lambda: db_session

            # Load actual perk metadata
            with open(perks_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            importer._perk_data = {}
            columns = data["columns"]
            column_indices = {col: columns.index(col) for col in columns}

            processed_count = 0
            error_count = 0

            # Process each perk row to verify it can be handled
            for row in data["values"]:
                try:
                    aoid = row[column_indices["aoid"]]
                    name = row[column_indices["name"]]
                    counter = row[column_indices["counter"]]
                    perk_type = row[column_indices["type"]]
                    professions = row[column_indices["professions"]] or []
                    breeds = row[column_indices["breeds"]] or []
                    level = row[column_indices["level"]]
                    ai_title = row[column_indices["aiTitle"]]

                    # Validate each field
                    validated_counter = perk_validator.validate_counter(counter)
                    validated_type = perk_validator.validate_perk_type(perk_type)
                    validated_level = perk_validator.parse_level_requirement(level)
                    validated_ai_level = perk_validator.parse_level_requirement(ai_title)

                    # Validate profession mapping
                    profession_ids = []
                    for prof_name in professions:
                        profession_ids.append(perk_validator.map_profession_to_id(prof_name))

                    # Validate breed mapping
                    breed_ids = []
                    for breed_name in breeds:
                        breed_ids.append(perk_validator.map_breed_to_id(breed_name))

                    processed_count += 1

                except Exception as e:
                    error_count += 1
                    print(f"Error processing perk AOID {aoid}: {e}")

            # Verify we can process all perks with minimal errors
            assert processed_count > 1900  # Should process nearly all 1,972 perks
            assert error_count < 50       # Should have very few errors

    def test_item_perk_relationship_integrity(self, db_session: Session, mock_perks_data, mock_item_data):
        """Test that item-perk relationships are created properly."""
        with patch('builtins.open', mock_open(read_data=json.dumps(mock_perks_data))):
            with patch.dict(os.environ, {'DATABASE_URL': 'mock://test'}):
                importer = DataImporter(db_url="sqlite:///:memory:")
                importer.get_db_session = lambda: db_session
                importer.load_perk_metadata()

                # Import items
                for item_data in mock_item_data:
                    importer.import_item(db_session, item_data, is_nano=False)

                db_session.commit()

                # Test item-perk relationships
                accumulator_item = db_session.query(Item).filter(Item.aoid == 210830).first()
                assert accumulator_item is not None

                accumulator_perk = db_session.query(Perk).filter(Perk.item_id == accumulator_item.id).first()
                assert accumulator_perk is not None
                assert accumulator_perk.item_id == accumulator_item.id

                # Test non-perk item has no perk record
                weapon_item = db_session.query(Item).filter(Item.aoid == 100001).first()
                assert weapon_item is not None

                weapon_perk = db_session.query(Perk).filter(Perk.item_id == weapon_item.id).first()
                assert weapon_perk is None


class TestProfessionBreedMapping:
    """Test profession and breed ID mapping functionality."""

    def test_profession_mapping_all_15_professions(self):
        """Test that all 15 professions map correctly to IDs 1-15."""
        expected_mappings = {
            "Soldier": 1,
            "Martial Artist": 2,
            "MartialArtist": 2,  # Alternative format
            "Engineer": 3,
            "Fixer": 4,
            "Agent": 5,
            "Adventurer": 6,
            "Trader": 7,
            "Bureaucrat": 8,
            "Enforcer": 9,
            "Doctor": 10,
            "Nano-Technician": 11,
            "NanoTechnician": 11,  # Alternative format
            "Meta Physicist": 12,
            "MetaPhysicist": 12,  # Alternative format
            "Keeper": 14,
            "Shade": 15,
        }

        for profession_name, expected_id in expected_mappings.items():
            result_id = perk_validator.map_profession_to_id(profession_name)
            assert result_id == expected_id, f"Profession '{profession_name}' should map to ID {expected_id}, got {result_id}"

    def test_breed_mapping_all_4_breeds(self):
        """Test that all 4 breeds map correctly to IDs 1-4."""
        expected_mappings = {
            "Solitus": 1,
            "Opifex": 2,
            "Nanomage": 3,
            "Atrox": 4,
        }

        for breed_name, expected_id in expected_mappings.items():
            result_id = perk_validator.map_breed_to_id(breed_name)
            assert result_id == expected_id, f"Breed '{breed_name}' should map to ID {expected_id}, got {result_id}"

    def test_empty_arrays_handled_properly(self, db_session: Session):
        """Test that empty profession/breed arrays are handled correctly."""
        mock_perks_data = {
            "columns": ["aoid", "name", "counter", "type", "professions", "breeds", "level", "aiTitle"],
            "values": [
                [247748, "Alien Technology Expertise", 1, "AI", [], [], 15, None],  # Empty arrays
            ]
        }

        mock_item_data = [{
            "AOID": 247748,
            "Name": "Alien Technology Expertise",
            "Description": "General AI perk",
            "StatValues": [
                {"Stat": 76, "RawValue": 99999},
                {"Stat": 54, "RawValue": 15}
            ]
        }]

        with patch('builtins.open', mock_open(read_data=json.dumps(mock_perks_data))):
            with patch.dict(os.environ, {'DATABASE_URL': 'mock://test'}):
                importer = DataImporter(db_url="sqlite:///:memory:")
                importer.get_db_session = lambda: db_session
                importer.load_perk_metadata()

                importer.import_item(db_session, mock_item_data[0], is_nano=False)
                db_session.commit()

                perk = db_session.query(Perk).first()
                assert perk is not None
                assert perk.professions == []
                assert perk.breeds == []

    def test_invalid_profession_names_handling(self):
        """Test handling of invalid profession names."""
        invalid_names = ["InvalidProfession", "", None, "Warrior", "Mage"]

        for invalid_name in invalid_names:
            with pytest.raises(ValueError):
                perk_validator.map_profession_to_id(invalid_name)

    def test_invalid_breed_names_handling(self):
        """Test handling of invalid breed names."""
        invalid_names = ["InvalidBreed", "", None, "Human", "Elf"]

        for invalid_name in invalid_names:
            with pytest.raises(ValueError):
                perk_validator.map_breed_to_id(invalid_name)


class TestPerkSeriesAndCounterParsing:
    """Test perk series and counter parsing functionality."""

    def test_perk_series_extraction(self, db_session: Session):
        """Test that perk series names are extracted correctly."""
        mock_perks_data = {
            "columns": ["aoid", "name", "counter", "type", "professions", "breeds", "level", "aiTitle"],
            "values": [
                [210830, "Accumulator", 1, "SL", ["Trader"], [], 10, None],
                [210831, "Accumulator", 2, "SL", ["Trader"], [], 20, None],
                [261355, "Acquisition", 1, "LE", ["Fixer"], [], 1, None],
                [211655, "Acrobat", 1, "SL", ["Fixer"], [], 30, None],
            ]
        }

        mock_item_data = [
            {"AOID": 210830, "Name": "Accumulator", "StatValues": [{"Stat": 76, "RawValue": 99999}, {"Stat": 54, "RawValue": 10}]},
            {"AOID": 210831, "Name": "Accumulator", "StatValues": [{"Stat": 76, "RawValue": 99999}, {"Stat": 54, "RawValue": 20}]},
            {"AOID": 261355, "Name": "Acquisition", "StatValues": [{"Stat": 76, "RawValue": 99999}, {"Stat": 54, "RawValue": 1}]},
            {"AOID": 211655, "Name": "Acrobat", "StatValues": [{"Stat": 76, "RawValue": 99999}, {"Stat": 54, "RawValue": 30}]},
        ]

        with patch('builtins.open', mock_open(read_data=json.dumps(mock_perks_data))):
            with patch.dict(os.environ, {'DATABASE_URL': 'mock://test'}):
                importer = DataImporter(db_url="sqlite:///:memory:")
                importer.get_db_session = lambda: db_session
                importer.load_perk_metadata()

                for item_data in mock_item_data:
                    importer.import_item(db_session, item_data, is_nano=False)

                db_session.commit()

                # Check that perk series are extracted correctly
                perks = db_session.query(Perk).all()
                series_names = [perk.perk_series for perk in perks]

                assert "Accumulator" in series_names
                assert "Acquisition" in series_names
                assert "Acrobat" in series_names

    def test_counter_values_parsed_correctly(self, db_session: Session):
        """Test that counter values (1-10) are parsed properly."""
        mock_perks_data = {
            "columns": ["aoid", "name", "counter", "type", "professions", "breeds", "level", "aiTitle"],
            "values": [
                [210830, "Accumulator", 1, "SL", ["Trader"], [], 10, None],
                [210834, "Accumulator", 5, "SL", ["Trader"], [], 90, None],
                [210839, "Accumulator", 10, "SL", ["Trader"], [], 202, None],
            ]
        }

        mock_item_data = [
            {"AOID": 210830, "Name": "Accumulator", "StatValues": [{"Stat": 76, "RawValue": 99999}, {"Stat": 54, "RawValue": 10}]},
            {"AOID": 210834, "Name": "Accumulator", "StatValues": [{"Stat": 76, "RawValue": 99999}, {"Stat": 54, "RawValue": 90}]},
            {"AOID": 210839, "Name": "Accumulator", "StatValues": [{"Stat": 76, "RawValue": 99999}, {"Stat": 54, "RawValue": 202}]},
        ]

        with patch('builtins.open', mock_open(read_data=json.dumps(mock_perks_data))):
            with patch.dict(os.environ, {'DATABASE_URL': 'mock://test'}):
                importer = DataImporter(db_url="sqlite:///:memory:")
                importer.get_db_session = lambda: db_session
                importer.load_perk_metadata()

                for item_data in mock_item_data:
                    importer.import_item(db_session, item_data, is_nano=False)

                db_session.commit()

                # Check counter values
                perks = db_session.query(Perk).order_by(Perk.counter).all()
                assert len(perks) == 3
                assert perks[0].counter == 1
                assert perks[1].counter == 5
                assert perks[2].counter == 10

    def test_formatted_name_generation(self, db_session: Session):
        """Test that formatted names are generated correctly (e.g., 'Accumulator 1')."""
        mock_perks_data = {
            "columns": ["aoid", "name", "counter", "type", "professions", "breeds", "level", "aiTitle"],
            "values": [
                [210830, "Accumulator", 1, "SL", ["Trader"], [], 10, None],
                [261355, "Acquisition", 1, "LE", ["Fixer"], [], 1, None],
            ]
        }

        mock_item_data = [
            {"AOID": 210830, "Name": "Accumulator", "StatValues": [{"Stat": 76, "RawValue": 99999}, {"Stat": 54, "RawValue": 10}]},
            {"AOID": 261355, "Name": "Acquisition", "StatValues": [{"Stat": 76, "RawValue": 99999}, {"Stat": 54, "RawValue": 1}]},
        ]

        with patch('builtins.open', mock_open(read_data=json.dumps(mock_perks_data))):
            with patch.dict(os.environ, {'DATABASE_URL': 'mock://test'}):
                importer = DataImporter(db_url="sqlite:///:memory:")
                importer.get_db_session = lambda: db_session
                importer.load_perk_metadata()

                for item_data in mock_item_data:
                    importer.import_item(db_session, item_data, is_nano=False)

                db_session.commit()

                # Check formatted names
                accumulator_perk = db_session.query(Perk).join(Item).filter(Item.aoid == 210830).first()
                assert accumulator_perk.name == "Accumulator 1"

                acquisition_perk = db_session.query(Perk).join(Item).filter(Item.aoid == 261355).first()
                assert acquisition_perk.name == "Acquisition 1"


class TestDataValidation:
    """Test data validation functionality."""

    def test_type_validation(self):
        """Test that perk types (SL/AI/LE) are validated correctly."""
        valid_types = ["SL", "AI", "LE", "sl", "ai", "le"]  # Case insensitive

        for perk_type in valid_types:
            result = perk_validator.validate_perk_type(perk_type)
            assert result in ["SL", "AI", "LE"]

        invalid_types = ["", None, "XP", "DX", "INVALID"]
        for invalid_type in invalid_types:
            with pytest.raises(ValueError):
                perk_validator.validate_perk_type(invalid_type)

    def test_level_requirement_parsing(self):
        """Test that level requirements are parsed correctly."""
        # Valid level values
        assert perk_validator.parse_level_requirement(10) == 10
        assert perk_validator.parse_level_requirement("50") == 50
        assert perk_validator.parse_level_requirement(None) == 0
        assert perk_validator.parse_level_requirement("") == 0
        assert perk_validator.parse_level_requirement("null") == 0
        assert perk_validator.parse_level_requirement(0) == 0

        # Invalid level values
        with pytest.raises(ValueError):
            perk_validator.parse_level_requirement(-1)

        with pytest.raises(ValueError):
            perk_validator.parse_level_requirement("invalid")

        with pytest.raises(ValueError):
            perk_validator.parse_level_requirement("10.5")

    def test_ai_level_requirement_handling(self):
        """Test that AI level requirements are handled correctly (nullable)."""
        # AI level can be null/None
        assert perk_validator.parse_level_requirement(None) == 0
        assert perk_validator.parse_level_requirement("null") == 0

        # AI level can be a valid number
        assert perk_validator.parse_level_requirement(5) == 5
        assert perk_validator.parse_level_requirement("15") == 15

    def test_counter_range_validation(self):
        """Test that counter values are validated to be in range 1-10."""
        # Valid counters
        for counter in range(1, 11):
            result = perk_validator.validate_counter(counter)
            assert result == counter

        # Invalid counters
        invalid_counters = [0, 11, -1, 100]
        for invalid_counter in invalid_counters:
            with pytest.raises(ValueError):
                perk_validator.validate_counter(invalid_counter)

        # Non-integer counters
        with pytest.raises(ValueError):
            perk_validator.validate_counter("5")

        with pytest.raises(ValueError):
            perk_validator.validate_counter(5.5)


class TestErrorHandling:
    """Test error handling during import."""

    def test_malformed_perk_data_handling(self, db_session: Session):
        """Test that malformed perk data is handled gracefully."""
        malformed_perks_data = {
            "columns": ["aoid", "name", "counter", "type", "professions", "breeds", "level", "aiTitle"],
            "values": [
                [210830, "Accumulator", 1, "SL", ["Trader"], [], 10, None],  # Valid
                [None, "BadPerk", 1, "SL", ["Trader"], [], 10, None],  # Missing AOID
                [210832, "", 1, "SL", ["Trader"], [], 10, None],  # Empty name
                [210833, "BadCounter", "invalid", "SL", ["Trader"], [], 10, None],  # Invalid counter
                [210834, "BadType", 1, "XX", ["Trader"], [], 10, None],  # Invalid type
                [210835, "GoodPerk", 2, "SL", ["Trader"], [], 20, None],  # Valid
            ]
        }

        with patch('builtins.open', mock_open(read_data=json.dumps(malformed_perks_data))):
            with patch.dict(os.environ, {'DATABASE_URL': 'mock://test'}):
                importer = DataImporter(db_url="sqlite:///:memory:")
                importer.get_db_session = lambda: db_session

                # Should not raise exception, but should log warnings
                importer.load_perk_metadata()

                # Should have loaded valid perks despite malformed data
                assert len(importer._perk_data) >= 2  # At least the valid ones

    def test_invalid_profession_breed_names_in_import(self, db_session: Session):
        """Test handling of invalid profession/breed names during import."""
        mock_perks_data = {
            "columns": ["aoid", "name", "counter", "type", "professions", "breeds", "level", "aiTitle"],
            "values": [
                [210830, "ValidPerk", 1, "SL", ["Trader"], [], 10, None],  # Valid
                [210831, "InvalidProf", 1, "SL", ["InvalidProfession"], [], 10, None],  # Invalid profession
                [210832, "InvalidBreed", 1, "SL", [], ["InvalidBreed"], 10, None],  # Invalid breed
            ]
        }

        mock_item_data = [
            {"AOID": 210830, "Name": "ValidPerk", "StatValues": [{"Stat": 76, "RawValue": 99999}, {"Stat": 54, "RawValue": 10}]},
            {"AOID": 210831, "Name": "InvalidProf", "StatValues": [{"Stat": 76, "RawValue": 99999}, {"Stat": 54, "RawValue": 10}]},
            {"AOID": 210832, "Name": "InvalidBreed", "StatValues": [{"Stat": 76, "RawValue": 99999}, {"Stat": 54, "RawValue": 10}]},
        ]

        with patch('builtins.open', mock_open(read_data=json.dumps(mock_perks_data))):
            with patch.dict(os.environ, {'DATABASE_URL': 'mock://test'}):
                importer = DataImporter(db_url="sqlite:///:memory:")
                importer.get_db_session = lambda: db_session
                importer.load_perk_metadata()

                # Import should continue despite validation errors
                for item_data in mock_item_data:
                    importer.import_item(db_session, item_data, is_nano=False)

                db_session.commit()

                # Should have created items for all, but perks only for valid ones
                items = db_session.query(Item).all()
                assert len(items) == 3

                perks = db_session.query(Perk).all()
                assert len(perks) == 1  # Only the valid one should have a perk record

    def test_missing_required_fields_handling(self, db_session: Session):
        """Test handling of missing required fields in perk data."""
        incomplete_perks_data = {
            "columns": ["aoid", "name", "counter", "type", "professions", "breeds", "level", "aiTitle"],
            "values": [
                # Missing various required fields
                [210830],  # Too few columns
                [210831, "TestPerk"],  # Missing counter, type, etc.
                [210832, "CompletePerk", 1, "SL", ["Trader"], [], 10, None],  # Complete
            ]
        }

        with patch('builtins.open', mock_open(read_data=json.dumps(incomplete_perks_data))):
            with patch.dict(os.environ, {'DATABASE_URL': 'mock://test'}):
                importer = DataImporter(db_url="sqlite:///:memory:")
                importer.get_db_session = lambda: db_session

                # Should handle missing fields gracefully
                importer.load_perk_metadata()

                # Should only have complete perk
                assert len(importer._perk_data) == 1
                assert 210832 in importer._perk_data

    def test_import_continues_despite_individual_errors(self, db_session: Session):
        """Test that import continues processing even when individual items fail."""
        mock_perks_data = {
            "columns": ["aoid", "name", "counter", "type", "professions", "breeds", "level", "aiTitle"],
            "values": [
                [210830, "GoodPerk1", 1, "SL", ["Trader"], [], 10, None],
                [210831, "GoodPerk2", 2, "SL", ["Trader"], [], 20, None],
                [210832, "GoodPerk3", 3, "SL", ["Trader"], [], 30, None],
            ]
        }

        mock_item_data = [
            {"AOID": 210830, "Name": "GoodPerk1", "StatValues": [{"Stat": 76, "RawValue": 99999}, {"Stat": 54, "RawValue": 10}]},
            {"AOID": "invalid_aoid", "Name": "BadItem"},  # Invalid AOID
            {"AOID": 210832, "Name": "GoodPerk3", "StatValues": [{"Stat": 76, "RawValue": 99999}, {"Stat": 54, "RawValue": 30}]},
        ]

        with patch('builtins.open', mock_open(read_data=json.dumps(mock_perks_data))):
            with patch.dict(os.environ, {'DATABASE_URL': 'mock://test'}):
                importer = DataImporter(db_url="sqlite:///:memory:")
                importer.get_db_session = lambda: db_session
                importer.load_perk_metadata()

                # Import should continue despite one bad item
                for item_data in mock_item_data:
                    importer.import_item(db_session, item_data, is_nano=False)

                db_session.commit()

                # Should have successfully imported the good items
                items = db_session.query(Item).all()
                assert len(items) >= 2  # At least the good ones

                perks = db_session.query(Perk).all()
                assert len(perks) >= 2  # At least the good ones


class TestImportStatistics:
    """Test import statistics and reporting."""

    def test_import_stats_tracking(self, db_session: Session):
        """Test that import statistics are tracked correctly."""
        mock_perks_data = {
            "columns": ["aoid", "name", "counter", "type", "professions", "breeds", "level", "aiTitle"],
            "values": [
                [210830, "TestPerk", 1, "SL", ["Trader"], [], 10, None],
            ]
        }

        mock_item_data = [
            {"AOID": 210830, "Name": "TestPerk", "StatValues": [{"Stat": 76, "RawValue": 99999}, {"Stat": 54, "RawValue": 10}]},
            {"AOID": 100001, "Name": "NonPerk", "StatValues": [{"Stat": 76, "RawValue": 1}, {"Stat": 54, "RawValue": 100}]},
        ]

        with patch('builtins.open', mock_open(read_data=json.dumps(mock_perks_data))):
            with patch.dict(os.environ, {'DATABASE_URL': 'mock://test'}):
                importer = DataImporter(db_url="sqlite:///:memory:")
                importer.get_db_session = lambda: db_session
                importer.load_perk_metadata()

                # Track stats before import
                initial_created = importer.stats.items_created

                for item_data in mock_item_data:
                    importer.import_item(db_session, item_data, is_nano=False)

                db_session.commit()

                # Check that stats were updated
                assert importer.stats.items_created == initial_created + 2
                assert importer.stats.errors == 0
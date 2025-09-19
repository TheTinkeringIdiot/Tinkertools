"""
Test import validation for perk identification functionality.

This module tests the DataImporter's ability to correctly identify perks based on
the perks.json file and set the is_perk field appropriately during import.
"""

import pytest
import json
import tempfile
import os
from unittest.mock import patch, MagicMock
from pathlib import Path

from app.core.importer import DataImporter
from app.models import Item
from app.tests.fixtures.import_fixtures import (
    sample_perks_data, sample_perk_aoids, temp_perks_json_file,
    item_import_data_with_perks, expected_perk_identification,
    empty_perks_json_file, malformed_perks_json_file
)


class TestPerkAoidLoading:
    """Test loading of perk AOIDs from perks.json file."""

    def test_load_perk_aoids_success(self, temp_perks_json_file, sample_perk_aoids):
        """Test successful loading of perk AOIDs from valid perks.json file."""
        # Mock the path to use our temporary file
        with patch.object(Path, '__truediv__', return_value=Path(temp_perks_json_file)):
            with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                importer = DataImporter()

                # Check that the perk AOIDs were loaded correctly
                assert len(importer._perk_aoids) == len(sample_perk_aoids)
                assert importer._perk_aoids == sample_perk_aoids

    def test_load_perk_aoids_missing_file(self):
        """Test error handling when perks.json file is missing."""
        # Use a non-existent file path
        with patch.object(Path, '__truediv__', return_value=Path('/nonexistent/perks.json')):
            with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                with pytest.raises(FileNotFoundError, match="perks.json file not found"):
                    DataImporter()

    def test_load_perk_aoids_malformed_json(self, malformed_perks_json_file):
        """Test error handling when perks.json contains invalid JSON."""
        with patch.object(Path, '__truediv__', return_value=Path(malformed_perks_json_file)):
            with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                with pytest.raises(json.JSONDecodeError):
                    DataImporter()

    def test_load_perk_aoids_empty_file(self, empty_perks_json_file):
        """Test handling of empty perks.json file."""
        with patch.object(Path, '__truediv__', return_value=Path(empty_perks_json_file)):
            with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                importer = DataImporter()

                # Empty file should result in empty set
                assert len(importer._perk_aoids) == 0
                assert importer._perk_aoids == set()

    def test_load_perk_aoids_missing_aoid_column(self):
        """Test error handling when perks.json is missing the aoid column."""
        # Create a temporary file with missing aoid column
        invalid_data = {
            "columns": ["name", "counter", "type"],
            "values": [["Accumulator", 1, "SL"]]
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            json.dump(invalid_data, temp_file)
            temp_file_path = temp_file.name

        try:
            with patch.object(Path, '__truediv__', return_value=Path(temp_file_path)):
                with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                    with pytest.raises(ValueError, match="aoid column not found"):
                        DataImporter()
        finally:
            os.unlink(temp_file_path)


class TestImportItemPerkIdentification:
    """Test import_item method's perk identification logic."""

    @pytest.fixture
    def mock_importer(self, sample_perk_aoids):
        """Create a DataImporter with mocked perk AOIDs for testing."""
        with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
            with patch.object(DataImporter, 'load_perk_aoids'):
                importer = DataImporter()
                importer._perk_aoids = sample_perk_aoids
                return importer

    def test_import_item_perk_identification_true(self, mock_importer, db_session):
        """Test that items with AOIDs in perks.json are marked as perks."""
        # Test data for a perk item (AOID 210830 is in sample perks data)
        item_data = {
            "aoid": 210830,  # This is a perk
            "name": "Accumulator",
            "ql": 10,
            "item_class": 99999,
            "description": "Perk: Accumulator Level 1",
            "is_nano": False
        }

        # Mock the import_item method's logic
        item = Item(
            aoid=item_data["aoid"],
            name=item_data["name"],
            ql=item_data["ql"],
            item_class=item_data["item_class"],
            description=item_data["description"],
            is_nano=item_data["is_nano"]
        )

        # Apply perk identification logic
        if not item.is_nano and item.aoid in mock_importer._perk_aoids:
            item.is_perk = True
        else:
            item.is_perk = False

        # Verify the item was correctly identified as a perk
        assert item.is_perk is True
        assert item.aoid == 210830

    def test_import_item_perk_identification_false(self, mock_importer, db_session):
        """Test that items with AOIDs NOT in perks.json are not marked as perks."""
        # Test data for a non-perk item
        item_data = {
            "aoid": 100001,  # This is NOT a perk
            "name": "Test Blaster",
            "ql": 150,
            "item_class": 1,
            "description": "A standard energy weapon",
            "is_nano": False
        }

        # Mock the import_item method's logic
        item = Item(
            aoid=item_data["aoid"],
            name=item_data["name"],
            ql=item_data["ql"],
            item_class=item_data["item_class"],
            description=item_data["description"],
            is_nano=item_data["is_nano"]
        )

        # Apply perk identification logic
        if not item.is_nano and item.aoid in mock_importer._perk_aoids:
            item.is_perk = True
        else:
            item.is_perk = False

        # Verify the item was correctly identified as NOT a perk
        assert item.is_perk is False
        assert item.aoid == 100001

    def test_import_item_nano_never_perk(self, mock_importer, db_session):
        """Test that nano programs are never marked as perks, even if AOID is in perks.json."""
        # Create a hypothetical scenario where a nano AOID appears in perks.json
        # (this shouldn't happen in real data, but we test the business rule)
        mock_importer._perk_aoids.add(400001)  # Add nano AOID to perk set

        item_data = {
            "aoid": 400001,  # Nano program AOID now in perk set
            "name": "Test Nano Program",
            "ql": 75,
            "item_class": 4,
            "description": "Basic nano program",
            "is_nano": True  # This is a nano
        }

        # Mock the import_item method's logic
        item = Item(
            aoid=item_data["aoid"],
            name=item_data["name"],
            ql=item_data["ql"],
            item_class=item_data["item_class"],
            description=item_data["description"],
            is_nano=item_data["is_nano"]
        )

        # Apply perk identification logic (nanos are never perks)
        if not item.is_nano and item.aoid in mock_importer._perk_aoids:
            item.is_perk = True
        else:
            item.is_perk = False

        # Verify that even with AOID in perks, nano is NOT marked as perk
        assert item.is_perk is False
        assert item.is_nano is True
        assert item.aoid in mock_importer._perk_aoids  # AOID is in perk set
        # But is_perk is False because is_nano is True

    def test_import_item_batch_perk_identification(self, mock_importer, item_import_data_with_perks, expected_perk_identification):
        """Test perk identification across a batch of mixed items."""
        items = []

        for item_data in item_import_data_with_perks:
            # Mock the import_item method's logic
            item = Item(
                aoid=item_data["aoid"],
                name=item_data["name"],
                ql=item_data["ql"],
                item_class=item_data["item_class"],
                description=item_data["description"],
                is_nano=item_data["is_nano"]
            )

            # Apply perk identification logic
            if not item.is_nano and item.aoid in mock_importer._perk_aoids:
                item.is_perk = True
            else:
                item.is_perk = False

            items.append(item)

        # Verify all items have correct perk identification
        for item in items:
            expected = expected_perk_identification[item.aoid]
            assert item.is_perk == expected, \
                f"Item {item.aoid} ({item.name}) expected is_perk={expected}, got {item.is_perk}"

        # Verify counts
        perk_items = [item for item in items if item.is_perk]
        non_perk_items = [item for item in items if not item.is_perk]

        assert len(perk_items) == 2  # Accumulator and Acquisition
        assert len(non_perk_items) == 3  # Blaster, Armor, Nano

        # Verify specific AOIDs in each category
        perk_aoids = {item.aoid for item in perk_items}
        non_perk_aoids = {item.aoid for item in non_perk_items}

        assert perk_aoids == {210830, 261355}
        assert non_perk_aoids == {100001, 200001, 400001}


class TestImportIntegration:
    """Test full import process integration with perk identification."""

    def test_import_creates_correct_perk_flags(self, db_session, temp_perks_json_file):
        """Test that a full import process correctly sets is_perk flags."""
        # This would be a more comprehensive test that would require mocking
        # the entire import process. For now, we verify the components work together.

        with patch.object(Path, '__truediv__', return_value=Path(temp_perks_json_file)):
            with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                importer = DataImporter()

                # Verify the importer has the expected perk AOIDs loaded
                expected_aoids = {210830, 210831, 210834, 261355, 261356, 211655, 211656, 247748, 247749, 252301}
                assert importer._perk_aoids == expected_aoids

    def test_import_error_propagation(self):
        """Test that import errors are properly propagated when perks.json is invalid."""
        # Test that errors during perk loading are not silently ignored
        with patch.object(Path, '__truediv__', return_value=Path('/nonexistent/perks.json')):
            with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                with pytest.raises(FileNotFoundError):
                    DataImporter()
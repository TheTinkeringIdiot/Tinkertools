"""
Test error handling for perk import functionality.

This module tests error scenarios during perk identification import process,
including missing files, corrupted data, and graceful failure handling.
"""

import pytest
import json
import tempfile
import os
from unittest.mock import patch, MagicMock
from pathlib import Path

from app.core.importer import DataImporter


class TestPerkImportErrorHandling:
    """Test error handling during perk import process."""

    def test_missing_perks_json_file(self):
        """Test that missing perks.json file raises appropriate error."""
        # Use a non-existent file path
        nonexistent_path = Path('/nonexistent/directory/perks.json')

        with patch.object(Path, '__truediv__', return_value=nonexistent_path):
            with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                with pytest.raises(FileNotFoundError) as exc_info:
                    DataImporter()

                # Verify error message is informative
                assert "perks.json file not found" in str(exc_info.value)

    def test_permission_denied_perks_json(self):
        """Test handling of permission errors when reading perks.json."""
        # Create a file but mock permission error
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            json.dump({"columns": ["aoid"], "values": [[123]]}, temp_file)
            temp_file_path = temp_file.name

        try:
            with patch.object(Path, '__truediv__', return_value=Path(temp_file_path)):
                with patch('builtins.open', side_effect=PermissionError("Permission denied")):
                    with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                        with pytest.raises(PermissionError):
                            DataImporter()
        finally:
            os.unlink(temp_file_path)

    def test_corrupted_json_structure(self):
        """Test handling of valid JSON with invalid structure."""
        # Create a file with valid JSON but wrong structure
        invalid_structure = {"wrong_key": "wrong_value"}

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            json.dump(invalid_structure, temp_file)
            temp_file_path = temp_file.name

        try:
            with patch.object(Path, '__truediv__', return_value=Path(temp_file_path)):
                with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                    with pytest.raises(KeyError, match="columns"):
                        DataImporter()
        finally:
            os.unlink(temp_file_path)

    def test_missing_aoid_column(self):
        """Test handling when perks.json missing required aoid column."""
        # Valid JSON structure but missing aoid column
        data_without_aoid = {
            "columns": ["name", "type", "profession"],
            "values": [["Accumulator", "SL", "Trader"]]
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            json.dump(data_without_aoid, temp_file)
            temp_file_path = temp_file.name

        try:
            with patch.object(Path, '__truediv__', return_value=Path(temp_file_path)):
                with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                    with pytest.raises(ValueError, match="aoid column not found"):
                        DataImporter()
        finally:
            os.unlink(temp_file_path)

    def test_invalid_aoid_data_types(self):
        """Test handling of invalid AOID data types in perks.json."""
        # AOIDs should be integers, test with string AOIDs
        data_with_string_aoids = {
            "columns": ["aoid", "name"],
            "values": [
                ["not_a_number", "Accumulator"],  # String instead of int
                [210831, "Accumulator"]  # Valid AOID
            ]
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            json.dump(data_with_string_aoids, temp_file)
            temp_file_path = temp_file.name

        try:
            with patch.object(Path, '__truediv__', return_value=Path(temp_file_path)):
                with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                    # Should handle gracefully - non-numeric AOIDs should be skipped
                    importer = DataImporter()

                    # Should only contain the valid AOID
                    assert 210831 in importer._perk_aoids
                    assert "not_a_number" not in importer._perk_aoids
                    assert len(importer._perk_aoids) == 1
        finally:
            os.unlink(temp_file_path)

    def test_empty_values_array(self):
        """Test handling of perks.json with empty values array."""
        empty_data = {
            "columns": ["aoid", "name"],
            "values": []  # No perk data
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            json.dump(empty_data, temp_file)
            temp_file_path = temp_file.name

        try:
            with patch.object(Path, '__truediv__', return_value=Path(temp_file_path)):
                with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                    # Should succeed but with empty perk set
                    importer = DataImporter()
                    assert len(importer._perk_aoids) == 0
                    assert importer._perk_aoids == set()
        finally:
            os.unlink(temp_file_path)

    def test_malformed_values_array(self):
        """Test handling of malformed values in perks.json."""
        malformed_data = {
            "columns": ["aoid", "name"],
            "values": [
                [210830, "Accumulator"],  # Valid row
                [210831],  # Missing name column
                [210832, "Test", "Extra"],  # Extra column
                []  # Empty row
            ]
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            json.dump(malformed_data, temp_file)
            temp_file_path = temp_file.name

        try:
            with patch.object(Path, '__truediv__', return_value=Path(temp_file_path)):
                with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                    # Should handle gracefully - extract valid AOIDs where possible
                    importer = DataImporter()

                    # Should contain AOIDs from valid and partially valid rows
                    expected_aoids = {210830, 210831, 210832}
                    assert importer._perk_aoids == expected_aoids
        finally:
            os.unlink(temp_file_path)

    def test_large_file_handling(self):
        """Test handling of very large perks.json files."""
        # Simulate a large file with many perks
        large_data = {
            "columns": ["aoid", "name"],
            "values": [[i, f"Perk_{i}"] for i in range(100000, 101000)]  # 1000 perks
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            json.dump(large_data, temp_file)
            temp_file_path = temp_file.name

        try:
            with patch.object(Path, '__truediv__', return_value=Path(temp_file_path)):
                with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                    # Should handle large files without issues
                    importer = DataImporter()

                    # Should contain all 1000 AOIDs
                    assert len(importer._perk_aoids) == 1000
                    assert 100000 in importer._perk_aoids
                    assert 100999 in importer._perk_aoids
        finally:
            os.unlink(temp_file_path)

    def test_unicode_encoding_issues(self):
        """Test handling of unicode encoding issues in perks.json."""
        # Create file with special characters
        unicode_data = {
            "columns": ["aoid", "name"],
            "values": [
                [210830, "Accümulator"],  # Unicode in name
                [210831, "Acquisition™"],  # Trademark symbol
                [210832, "Test 中文"]  # Chinese characters
            ]
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as temp_file:
            json.dump(unicode_data, temp_file, ensure_ascii=False)
            temp_file_path = temp_file.name

        try:
            with patch.object(Path, '__truediv__', return_value=Path(temp_file_path)):
                with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                    # Should handle unicode correctly
                    importer = DataImporter()

                    # Should contain all AOIDs regardless of unicode in names
                    expected_aoids = {210830, 210831, 210832}
                    assert importer._perk_aoids == expected_aoids
        finally:
            os.unlink(temp_file_path)


class TestImportProcessResilience:
    """Test resilience of import process to various error conditions."""

    def test_database_connection_error_during_init(self):
        """Test handling of database connection errors during initialization."""
        with patch.dict(os.environ, {'DATABASE_URL': 'invalid://invalid_url'}):
            with pytest.raises(Exception):  # SQLAlchemy will raise various exceptions
                DataImporter()

    def test_perk_loading_failure_recovery(self):
        """Test that perk loading failures are handled gracefully."""
        # Mock the load_perk_aoids method to simulate failure
        with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
            with patch.object(DataImporter, 'load_perk_aoids', side_effect=Exception("Simulated failure")):
                with pytest.raises(Exception, match="Simulated failure"):
                    DataImporter()

    def test_partial_perk_data_corruption(self):
        """Test handling of partially corrupted perk data."""
        # Create data where some rows are valid and others are corrupted
        mixed_data = {
            "columns": ["aoid", "name", "type"],
            "values": [
                [210830, "Accumulator", "SL"],  # Valid
                [None, "Invalid", "SL"],  # Null AOID
                [210832, None, "SL"],  # Null name (should still extract AOID)
                ["invalid", "Invalid", "SL"],  # String AOID
                [210834, "Valid", "SL"]  # Valid
            ]
        }

        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            json.dump(mixed_data, temp_file)
            temp_file_path = temp_file.name

        try:
            with patch.object(Path, '__truediv__', return_value=Path(temp_file_path)):
                with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                    # Should extract valid AOIDs and skip invalid ones
                    importer = DataImporter()

                    # Should contain only valid numeric AOIDs
                    expected_aoids = {210830, 210832, 210834}
                    assert importer._perk_aoids == expected_aoids
        finally:
            os.unlink(temp_file_path)

    def test_file_locked_error_handling(self):
        """Test handling of file locking errors."""
        # Create a file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            json.dump({"columns": ["aoid"], "values": [[123]]}, temp_file)
            temp_file_path = temp_file.name

        try:
            with patch.object(Path, '__truediv__', return_value=Path(temp_file_path)):
                # Mock file being locked/in use
                with patch('builtins.open', side_effect=OSError("File is locked")):
                    with patch.dict(os.environ, {'DATABASE_URL': 'sqlite:///:memory:'}):
                        with pytest.raises(OSError, match="File is locked"):
                            DataImporter()
        finally:
            os.unlink(temp_file_path)
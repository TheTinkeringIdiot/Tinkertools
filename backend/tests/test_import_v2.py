"""
Comprehensive tests for the v2 import system.

Tests each component in isolation and the full pipeline.
"""

import pytest
import tempfile
import json
import csv
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import io

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.import_v2 import (
    StreamingJSONReader,
    StreamingCSVReader,
    ImportItem,
    NanoCorrections,
    Pipeline,
    PipelineStage,
    ParseStage,
    ValidationStage,
    CorrectionStage,
    ImportConfig,
    UnifiedImporter
)


class TestStreamingJSONReader:
    """Test streaming JSON reader."""

    def test_stream_array(self):
        """Test streaming JSON array."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump([
                {"id": 1, "name": "Item 1"},
                {"id": 2, "name": "Item 2"},
                {"id": 3, "name": "Item 3"}
            ], f)
            f.flush()

            reader = StreamingJSONReader(f.name, chunk_size=2)
            chunks = list(reader.stream())

            assert len(chunks) == 2  # 3 items with chunk_size=2
            assert len(chunks[0]) == 2
            assert len(chunks[1]) == 1

            assert chunks[0][0].id == 1
            assert chunks[0][0].name == "Item 1"

    def test_stream_nested_object(self):
        """Test streaming nested JSON object."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({
                "items": [
                    {"AOID": 100, "Name": "Nano 1", "Type": "Nano"},
                    {"AOID": 200, "Name": "Nano 2", "Type": "Nano"}
                ]
            }, f)
            f.flush()

            reader = StreamingJSONReader(f.name, chunk_size=10)
            chunks = list(reader.stream())

            assert len(chunks) == 1
            assert len(chunks[0]) == 2
            assert all(item.is_nano for item in chunks[0])

    def test_constant_memory(self):
        """Test that reader doesn't load entire file into memory."""
        # Create large file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            f.write('[')
            for i in range(10000):
                if i > 0:
                    f.write(',')
                json.dump({"id": i, "name": f"Item {i}"}, f)
            f.write(']')
            f.flush()

            reader = StreamingJSONReader(f.name, chunk_size=100)

            # Process only first chunk
            for chunk in reader.stream():
                assert len(chunk) == 100
                break  # Stop after first chunk

            # File should not be fully loaded
            Path(f.name).unlink()


class TestNanoCorrections:
    """Test nano corrections management."""

    def test_load_corrections(self):
        """Test loading corrections from CSV."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            writer = csv.DictWriter(f, fieldnames=['nano_id', 'ql', 'strain_id', 'crystal_ids'])
            writer.writeheader()
            writer.writerow({
                'nano_id': '100',
                'ql': '50',
                'strain_id': '75',
                'crystal_ids': '1001;1002;1003'
            })
            f.flush()

            corrections = NanoCorrections(f.name)

            assert corrections.stats['total_corrections'] == 1
            assert corrections.stats['with_strain'] == 1
            assert corrections.stats['with_crystals'] == 1

            correction = corrections.get_correction(100)
            assert correction.ql == 50
            assert correction.strain_id == 75
            assert correction.crystal_ids == [1001, 1002, 1003]

    def test_apply_corrections(self):
        """Test applying corrections to items."""
        corrections = NanoCorrections()
        from app.import_v2.corrections import NanoCorrection
        corrections.add_correction(
            NanoCorrection(
                nano_id=100,
                ql=50,
                strain_id=75,
                crystal_ids=[1001]
            )
        )

        item = ImportItem(id=100, name="Test Nano", is_nano=True)
        corrections.apply_corrections(item)

        assert item.ql == 50
        assert item.data['stats'][75] == 75
        assert item.data['crystal_sources'] == [1001]

    def test_crystal_reverse_lookup(self):
        """Test crystal to nano reverse lookup."""
        from app.import_v2.corrections import NanoCorrection
        corrections = NanoCorrections()
        corrections.add_correction(
            NanoCorrection(
                nano_id=100,
                crystal_ids=[1001, 1002]
            )
        )
        corrections.add_correction(
            NanoCorrection(
                nano_id=200,
                crystal_ids=[1002, 1003]
            )
        )

        assert corrections.get_nano_for_crystal(1001) == {100}
        assert corrections.get_nano_for_crystal(1002) == {100, 200}
        assert corrections.get_nano_for_crystal(1003) == {200}
        assert corrections.get_nano_for_crystal(9999) == set()


class TestPipeline:
    """Test pipeline orchestration."""

    def test_simple_pipeline(self):
        """Test basic pipeline execution."""
        # Create mock stages
        stage1 = Mock(spec=PipelineStage)
        stage1.name = "Stage 1"
        stage1.setup = Mock()
        stage1.teardown = Mock()
        stage1.validate = Mock(return_value=True)
        stage1.process = Mock(side_effect=lambda x: x)
        stage1.stats = {'items_processed': 0, 'batches_processed': 0, 'errors': 0, 'total_time': 0}

        stage2 = Mock(spec=PipelineStage)
        stage2.name = "Stage 2"
        stage2.setup = Mock()
        stage2.teardown = Mock()
        stage2.validate = Mock(return_value=True)
        stage2.process = Mock(side_effect=lambda x: x)
        stage2.stats = {'items_processed': 0, 'batches_processed': 0, 'errors': 0, 'total_time': 0}

        pipeline = Pipeline([stage1, stage2])

        # Create test data
        data = [[1, 2, 3], [4, 5, 6]]

        stats = pipeline.process(iter(data))

        # Verify setup/teardown called
        stage1.setup.assert_called_once()
        stage1.teardown.assert_called_once()
        stage2.setup.assert_called_once()
        stage2.teardown.assert_called_once()

        # Verify processing
        assert stage1.process.call_count == 2
        assert stage2.process.call_count == 2

        # Verify statistics
        assert stats.total_items == 6
        assert stats.total_batches == 2
        assert stats.successful_batches == 2

    def test_pipeline_error_handling(self):
        """Test pipeline error handling."""
        stage = Mock(spec=PipelineStage)
        stage.name = "Error Stage"
        stage.setup = Mock()
        stage.teardown = Mock()
        stage.validate = Mock(return_value=True)
        stage.process = Mock(side_effect=Exception("Test error"))
        stage.stats = {'items_processed': 0, 'batches_processed': 0, 'errors': 0, 'total_time': 0}

        # Test stop_on_error=True
        pipeline = Pipeline([stage], stop_on_error=True)

        with pytest.raises(Exception):
            pipeline.process(iter([[1, 2, 3]]))

        # Test stop_on_error=False
        pipeline = Pipeline([stage], stop_on_error=False)
        stats = pipeline.process(iter([[1, 2, 3], [4, 5, 6]]))

        assert stats.failed_batches == 2
        assert stats.successful_batches == 0

    def test_pipeline_callbacks(self):
        """Test pipeline callbacks."""
        complete_calls = []
        error_calls = []

        def on_complete(batch_num, success):
            complete_calls.append((batch_num, success))

        def on_error(batch_num, error):
            error_calls.append((batch_num, str(error)))

        stage = Mock(spec=PipelineStage)
        stage.name = "Test Stage"
        stage.setup = Mock()
        stage.teardown = Mock()
        stage.validate = Mock(return_value=True)
        stage.stats = {'items_processed': 0, 'batches_processed': 0, 'errors': 0, 'total_time': 0}

        # Succeed on first batch, fail on second
        stage.process = Mock(side_effect=[
            [1, 2, 3],
            Exception("Test error")
        ])

        pipeline = Pipeline(
            [stage],
            on_batch_complete=on_complete,
            on_batch_error=on_error,
            stop_on_error=False
        )

        stats = pipeline.process(iter([[1, 2, 3], [4, 5, 6]]))

        assert complete_calls == [(1, True), (2, False)]
        assert len(error_calls) == 1
        assert "Test error" in error_calls[0][1]


class TestStages:
    """Test individual pipeline stages."""

    def test_parse_stage(self):
        """Test parse stage."""
        stage = ParseStage()

        items = [
            ImportItem(id=1, name="Valid", ql=50),
            ImportItem(id=2, name="", ql=None),  # Missing name
            ImportItem(id=None, name="No ID", ql=10),  # Missing ID
            ImportItem(id=3, name="Over QL", ql=600)  # QL too high
        ]

        result = stage.process(items)

        assert len(result) == 2  # Only valid items
        assert result[0].id == 1
        assert result[1].id == 3
        assert result[1].ql == 500  # Clamped to max

    def test_validation_stage(self):
        """Test validation stage."""
        stage = ValidationStage(strict=True)

        items = [
            ImportItem(id=1, name="Valid", ql=50),
            ImportItem(id=2, name="", ql=None),  # Invalid
            ImportItem(id=3, name="Valid", ql=600)  # Invalid QL
        ]

        result = stage.process(items)

        assert len(result) == 1  # Only valid item in strict mode
        assert result[0].id == 1
        assert stage.invalid_count == 2

    def test_correction_stage(self):
        """Test correction stage."""
        from app.import_v2.corrections import NanoCorrection
        corrections = NanoCorrections()
        corrections.add_correction(
            NanoCorrection(nano_id=1, ql=100, strain_id=75)
        )

        stage = CorrectionStage(corrections)

        items = [
            ImportItem(id=1, name="Nano", is_nano=True, ql=50),
            ImportItem(id=2, name="Item", is_nano=False, ql=50)
        ]

        result = stage.process(items)

        assert result[0].ql == 100  # Corrected
        assert result[1].ql == 50  # Unchanged (not a nano)


class TestUnifiedImporter:
    """Test unified importer."""

    @patch('app.import_v2.importer.PostgresCopyWriter')
    @patch('app.import_v2.importer.SingletonPreloader')
    def test_import_config(self, mock_preloader, mock_writer):
        """Test importer configuration."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json') as f:
            json.dump([{"id": 1, "name": "Test"}], f)
            f.flush()

            config = ImportConfig(
                data_path=f.name,
                batch_size=100,
                use_two_pass=False
            )

            importer = UnifiedImporter(config)

            assert importer.config.batch_size == 100
            assert not importer.config.use_two_pass

    @patch.dict('os.environ', {'DATABASE_URL': 'postgresql://test:test@localhost/test'})
    def test_connection_string(self):
        """Test database connection string handling."""
        config = ImportConfig(data_path='/tmp/test.json')
        importer = UnifiedImporter(config)

        assert 'postgresql://' in importer.connection_string
        assert 'test@localhost' in importer.connection_string

    def test_validate_only(self):
        """Test validation without import."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json') as f:
            json.dump([
                {"id": 1, "name": "Valid"},
                {"id": None, "name": "Invalid"},
                {"id": 3, "name": "Valid"}
            ], f)
            f.flush()

            config = ImportConfig(data_path=f.name, validate_strict=True)
            importer = UnifiedImporter(config)

            stats = importer.validate_only()

            assert stats['total_items'] == 3
            assert stats['valid_items'] == 2
            assert stats['invalid_items'] == 1


class TestIntegration:
    """Integration tests for full pipeline."""

    @pytest.mark.integration
    @patch('app.import_v2.postgres_copy.psycopg2.connect')
    def test_full_import_pipeline(self, mock_connect):
        """Test complete import pipeline."""
        # Setup mock database
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__.return_value = mock_cursor
        mock_connect.return_value.__enter__.return_value = mock_conn

        # Create test data
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json') as data_file:
            test_data = [
                {"id": 1, "name": "Item 1", "ql": 50},
                {"id": 2, "name": "Nano 1", "Type": "Nano", "ql": 100},
                {"id": 3, "name": "Item 2", "ql": 75}
            ]
            json.dump(test_data, data_file)
            data_file.flush()

            # Create corrections
            with tempfile.NamedTemporaryFile(mode='w', suffix='.csv') as corr_file:
                writer = csv.DictWriter(corr_file, fieldnames=['nano_id', 'ql', 'strain_id'])
                writer.writeheader()
                writer.writerow({'nano_id': '2', 'ql': '150', 'strain_id': '75'})
                corr_file.flush()

                # Run import
                config = ImportConfig(
                    data_path=data_file.name,
                    corrections_csv=corr_file.name,
                    batch_size=10,
                    use_two_pass=False
                )

                importer = UnifiedImporter(config)
                stats = importer.import_all()

                # Verify database calls were made
                assert mock_connect.called
                assert mock_cursor.copy_expert.called or mock_cursor.execute.called


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
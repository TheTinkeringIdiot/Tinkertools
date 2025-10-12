"""
Unit tests for Equipment Bonus API endpoints.

Tests the FastAPI endpoints for equipment bonus calculation, including request/response
handling, error cases, and integration with the EquipmentBonusService.
"""

import pytest
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.services.equipment_bonus_service import EquipmentBonusService
from app.core.database import get_db


class TestEquipmentBonusEndpoints:
    """Test cases for equipment bonus API endpoints."""

    @pytest.fixture
    def client(self):
        """Create a test client."""
        return TestClient(app)

    @pytest.fixture
    def mock_db_session(self):
        """Create a mock database session."""
        return Mock(spec=Session)

    @pytest.fixture
    def mock_equipment_service(self):
        """Create a mock equipment bonus service."""
        return Mock(spec=EquipmentBonusService)

    def setup_method(self):
        """Setup method to override database dependency."""
        def override_get_db():
            return Mock(spec=Session)

        app.dependency_overrides[get_db] = override_get_db

    def teardown_method(self):
        """Cleanup method to remove dependency overrides."""
        app.dependency_overrides.clear()

    # ============================================================================
    # POST /equipment-bonuses/calculate Tests
    # ============================================================================

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_calculate_equipment_bonuses_success(self, mock_service_class, client):
        """Test successful equipment bonus calculation."""
        # Setup mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.calculate_equipment_bonuses.return_value = {
            16: 50,   # Strength +50
            19: 25,   # Intelligence +25
            124: 100  # Max Health +100
        }

        # Make request
        response = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={"item_ids": [1, 2, 3]}
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        # Note: JSON converts int keys to strings
        assert data["total_bonuses"] == {"16": 50, "19": 25, "124": 100}
        assert data["item_count"] == 3
        assert data["bonus_count"] == 3

        # Verify service calls
        mock_service.calculate_equipment_bonuses.assert_called_once_with([1, 2, 3])

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_calculate_bonuses_with_implant_clusters(self, mock_service_class, client):
        """Test bonus calculation with implant clusters."""
        # Setup mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.calculate_equipment_bonuses.return_value = {16: 50}
        mock_service.calculate_implant_cluster_bonuses.return_value = {19: 30}

        # Make request with implant clusters
        response = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={
                "item_ids": [1, 2],
                "implant_clusters": {
                    "head": {"intelligence": 19}
                }
            }
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        # Should merge equipment and cluster bonuses (JSON converts int keys to strings)
        assert data["total_bonuses"] == {"16": 50, "19": 30}
        assert data["item_count"] == 2
        assert data["bonus_count"] == 2

        # Verify service calls
        mock_service.calculate_equipment_bonuses.assert_called_once_with([1, 2])
        mock_service.calculate_implant_cluster_bonuses.assert_called_once()

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_calculate_bonuses_merges_duplicate_stats(self, mock_service_class, client):
        """Test that duplicate stats from equipment and clusters are merged correctly."""
        # Setup mock service with overlapping stats
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.calculate_equipment_bonuses.return_value = {16: 50, 19: 25}
        mock_service.calculate_implant_cluster_bonuses.return_value = {19: 15}  # Same stat

        # Make request
        response = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={
                "item_ids": [1],
                "implant_clusters": {"head": {"intelligence": 19}}
            }
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        # Should add the values: 25 + 15 = 40 (JSON converts int keys to strings)
        assert data["total_bonuses"]["19"] == 40
        assert data["total_bonuses"]["16"] == 50

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_calculate_bonuses_empty_result(self, mock_service_class, client):
        """Test bonus calculation when no bonuses are found."""
        # Setup mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.calculate_equipment_bonuses.return_value = {}

        # Make request
        response = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={"item_ids": [1]}
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["total_bonuses"] == {}
        assert data["item_count"] == 1
        assert data["bonus_count"] == 0

    def test_calculate_bonuses_empty_item_list(self, client):
        """Test bonus calculation with empty item list returns 400."""
        response = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={"item_ids": []}
        )

        # Assertions
        assert response.status_code == 400
        data = response.json()
        # Global error handler uses 'error' key instead of 'detail'
        assert "At least one item ID must be provided" in data["error"]

    def test_calculate_bonuses_missing_item_ids(self, client):
        """Test bonus calculation without item_ids field."""
        response = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={}
        )

        # Assertions
        assert response.status_code == 422  # Validation error
        data = response.json()
        assert "error" in data or "detail" in data

    def test_calculate_bonuses_invalid_item_ids_type(self, client):
        """Test bonus calculation with invalid item_ids type."""
        response = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={"item_ids": "not a list"}
        )

        # Assertions
        assert response.status_code == 422  # Validation error

    def test_calculate_bonuses_invalid_item_id_value(self, client):
        """Test bonus calculation with invalid item ID values."""
        response = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={"item_ids": [1, "invalid", 3]}
        )

        # Assertions
        assert response.status_code == 422  # Validation error

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_calculate_bonuses_service_exception(self, mock_service_class, client):
        """Test handling of service exceptions."""
        # Setup mock service to raise exception
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.calculate_equipment_bonuses.side_effect = Exception("Database error")

        # Make request
        response = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={"item_ids": [1, 2]}
        )

        # Assertions
        assert response.status_code == 500
        data = response.json()
        # Global error handler uses 'error' key instead of 'detail'
        assert "Internal server error" in data["error"]

    # ============================================================================
    # GET /equipment-bonuses/item/{item_id} Tests
    # ============================================================================

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_get_item_bonus_detail_success(self, mock_service_class, client):
        """Test successful retrieval of item bonus details."""
        # Setup mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.get_item_bonus_breakdown.return_value = {
            16: 25,  # Strength +25
            19: 10   # Intelligence +10
        }

        # Make request
        response = client.get("/api/v1/equipment-bonuses/item/12345")

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["item_id"] == 12345
        # JSON converts int keys to strings
        assert data["bonuses"] == {"16": 25, "19": 10}

        # Verify service calls
        mock_service.get_item_bonus_breakdown.assert_called_once_with(12345)

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_get_item_bonus_detail_no_bonuses(self, mock_service_class, client):
        """Test item detail when item has no bonuses."""
        # Setup mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.get_item_bonus_breakdown.return_value = {}

        # Make request
        response = client.get("/api/v1/equipment-bonuses/item/12345")

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["item_id"] == 12345
        assert data["bonuses"] == {}

    def test_get_item_bonus_detail_invalid_item_id(self, client):
        """Test item detail with invalid item ID."""
        response = client.get("/api/v1/equipment-bonuses/item/invalid")

        # Assertions
        assert response.status_code == 422  # Validation error

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_get_item_bonus_detail_service_exception(self, mock_service_class, client):
        """Test handling of service exceptions in item detail."""
        # Setup mock service to raise exception
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.get_item_bonus_breakdown.side_effect = Exception("Database error")

        # Make request
        response = client.get("/api/v1/equipment-bonuses/item/12345")

        # Assertions
        assert response.status_code == 500
        data = response.json()
        # Global error handler uses 'error' key instead of 'detail'
        assert "Internal server error" in data["error"]

    # ============================================================================
    # POST /equipment-bonuses/batch-items Tests
    # ============================================================================

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_batch_item_bonus_details_success(self, mock_service_class, client):
        """Test successful batch retrieval of item bonus details."""
        # Setup mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service

        # Mock different bonuses for different items
        def mock_breakdown(item_id):
            if item_id == 1:
                return {16: 25, 19: 10}
            elif item_id == 2:
                return {20: 15}
            else:
                return {}

        mock_service.get_item_bonus_breakdown.side_effect = mock_breakdown

        # Make request
        response = client.post(
            "/api/v1/equipment-bonuses/batch-items",
            json=[1, 2, 3]
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3

        # Check individual items (JSON converts int keys to strings)
        assert data[0]["item_id"] == 1
        assert data[0]["bonuses"] == {"16": 25, "19": 10}

        assert data[1]["item_id"] == 2
        assert data[1]["bonuses"] == {"20": 15}

        assert data[2]["item_id"] == 3
        assert data[2]["bonuses"] == {}

        # Verify service calls
        assert mock_service.get_item_bonus_breakdown.call_count == 3

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_batch_item_bonus_details_single_item(self, mock_service_class, client):
        """Test batch endpoint with single item."""
        # Setup mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.get_item_bonus_breakdown.return_value = {16: 50}

        # Make request
        response = client.post(
            "/api/v1/equipment-bonuses/batch-items",
            json=[1]
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["item_id"] == 1
        # JSON converts int keys to strings
        assert data[0]["bonuses"] == {"16": 50}

    def test_batch_item_bonus_details_empty_list(self, client):
        """Test batch endpoint with empty item list."""
        response = client.post(
            "/api/v1/equipment-bonuses/batch-items",
            json=[]
        )

        # Assertions
        assert response.status_code == 400
        data = response.json()
        # Global error handler uses 'error' key instead of 'detail'
        assert "At least one item ID must be provided" in data["error"]

    def test_batch_item_bonus_details_invalid_json(self, client):
        """Test batch endpoint with invalid JSON."""
        response = client.post(
            "/api/v1/equipment-bonuses/batch-items",
            json={"invalid": "data"}
        )

        # Assertions
        assert response.status_code == 422  # Validation error

    def test_batch_item_bonus_details_invalid_item_ids(self, client):
        """Test batch endpoint with invalid item ID types."""
        response = client.post(
            "/api/v1/equipment-bonuses/batch-items",
            json=[1, "invalid", 3]
        )

        # Assertions
        assert response.status_code == 422  # Validation error

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_batch_item_bonus_details_service_exception(self, mock_service_class, client):
        """Test handling of service exceptions in batch endpoint."""
        # Setup mock service to raise exception
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.get_item_bonus_breakdown.side_effect = Exception("Database error")

        # Make request
        response = client.post(
            "/api/v1/equipment-bonuses/batch-items",
            json=[1, 2]
        )

        # Assertions
        assert response.status_code == 500
        data = response.json()
        # Global error handler uses 'error' key instead of 'detail'
        assert "Internal server error" in data["error"]

    # ============================================================================
    # Content Type and Header Tests
    # ============================================================================

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_response_content_type(self, mock_service_class, client):
        """Test that responses have correct content type."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.calculate_equipment_bonuses.return_value = {16: 50}

        response = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={"item_ids": [1]}
        )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"

    # ============================================================================
    # Logging Tests
    # ============================================================================

    @patch('app.api.routes.equipment_bonuses.logger')
    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_calculate_bonuses_logging(self, mock_service_class, mock_logger, client):
        """Test that bonus calculations are properly logged."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.calculate_equipment_bonuses.return_value = {16: 50}

        response = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={"item_ids": [1, 2, 3]}
        )

        assert response.status_code == 200
        # Verify logging was called with expected message
        mock_logger.info.assert_called_once()
        log_message = mock_logger.info.call_args[0][0]
        assert "3 items" in log_message

    @patch('app.api.routes.equipment_bonuses.logger')
    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_item_detail_logging(self, mock_service_class, mock_logger, client):
        """Test that item detail requests are properly logged."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.get_item_bonus_breakdown.return_value = {16: 25}

        response = client.get("/api/v1/equipment-bonuses/item/12345")

        assert response.status_code == 200
        # Verify logging was called
        mock_logger.info.assert_called_once()
        log_message = mock_logger.info.call_args[0][0]
        assert "12345" in log_message

    @patch('app.api.routes.equipment_bonuses.logger')
    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_error_logging(self, mock_service_class, mock_logger, client):
        """Test that errors are properly logged."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.calculate_equipment_bonuses.side_effect = Exception("Test error")

        response = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={"item_ids": [1]}
        )

        assert response.status_code == 500
        # Verify error logging was called
        mock_logger.error.assert_called_once()
        log_message = mock_logger.error.call_args[0][0]
        assert "Test error" in log_message

    # ============================================================================
    # Edge Cases and Boundary Tests
    # ============================================================================

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_large_item_list(self, mock_service_class, client):
        """Test bonus calculation with large number of items."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.calculate_equipment_bonuses.return_value = {16: 500}

        # Create list of 100 items
        item_ids = list(range(1, 101))

        response = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={"item_ids": item_ids}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["item_count"] == 100

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_negative_bonus_values(self, mock_service_class, client):
        """Test that negative bonus values are handled correctly."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.calculate_equipment_bonuses.return_value = {
            16: -50,  # Negative bonus (debuff)
            19: 25
        }

        response = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={"item_ids": [1]}
        )

        assert response.status_code == 200
        data = response.json()
        # JSON converts int keys to strings
        assert data["total_bonuses"]["16"] == -50
        assert data["total_bonuses"]["19"] == 25

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_large_bonus_values(self, mock_service_class, client):
        """Test handling of large bonus values."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.calculate_equipment_bonuses.return_value = {
            16: 999999
        }

        response = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={"item_ids": [1]}
        )

        assert response.status_code == 200
        data = response.json()
        # JSON converts int keys to strings
        assert data["total_bonuses"]["16"] == 999999

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_many_different_stats(self, mock_service_class, client):
        """Test handling of many different stat bonuses."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service

        # Create 50 different stat bonuses
        many_bonuses = {i: i * 10 for i in range(1, 51)}
        mock_service.calculate_equipment_bonuses.return_value = many_bonuses

        response = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={"item_ids": [1]}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["bonus_count"] == 50
        # JSON converts int keys to strings
        expected_bonuses = {str(i): i * 10 for i in range(1, 51)}
        assert data["total_bonuses"] == expected_bonuses

    # ============================================================================
    # Service Instance Tests
    # ============================================================================

    @patch('app.api.routes.equipment_bonuses.EquipmentBonusService')
    def test_service_instance_per_request(self, mock_service_class, client):
        """Test that each request gets its own service instance."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.calculate_equipment_bonuses.return_value = {16: 50}

        # Make multiple requests
        response1 = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={"item_ids": [1]}
        )
        response2 = client.post(
            "/api/v1/equipment-bonuses/calculate",
            json={"item_ids": [2]}
        )

        assert response1.status_code == 200
        assert response2.status_code == 200

        # Verify service was instantiated for each request
        assert mock_service_class.call_count == 2

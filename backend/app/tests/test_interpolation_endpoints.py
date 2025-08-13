"""
Unit tests for interpolation API endpoints.

Tests the FastAPI endpoints for item interpolation, including request/response
handling, error cases, and integration with the InterpolationService.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.services.interpolation import InterpolationService
from app.models.interpolated_item import InterpolatedItem, InterpolationResponse
from app.core.database import get_db


class TestInterpolationEndpoints:
    """Test cases for interpolation API endpoints."""

    @pytest.fixture
    def client(self):
        """Create a test client."""
        return TestClient(app)

    @pytest.fixture
    def mock_db_session(self):
        """Create a mock database session."""
        return Mock(spec=Session)

    @pytest.fixture
    def mock_interpolation_service(self):
        """Create a mock interpolation service."""
        return Mock(spec=InterpolationService)

    @pytest.fixture
    def sample_interpolated_item(self):
        """Create a sample interpolated item for testing."""
        return InterpolatedItem(
            id=1,
            aoid=12345,
            name="Test Weapon",
            ql=150,
            description="A test weapon",
            item_class=1,
            is_nano=False,
            interpolating=True,
            low_ql=100,
            high_ql=199,
            target_ql=150,
            ql_delta=50,
            ql_delta_full=100,
            stats=[
                {'id': 1, 'stat': 1, 'value': 150},
                {'id': 2, 'stat': 2, 'value': 75}
            ],
            spell_data=[],
            actions=[]
        )

    @pytest.fixture
    def sample_interpolation_info(self):
        """Create sample interpolation info for testing."""
        return {
            "aoid": 12345,
            "interpolatable": True,
            "min_ql": 100,
            "max_ql": 200,
            "ql_range": 101
        }

    def setup_method(self):
        """Setup method to override database dependency."""
        def override_get_db():
            return Mock(spec=Session)
        
        app.dependency_overrides[get_db] = override_get_db

    def teardown_method(self):
        """Cleanup method to remove dependency overrides."""
        app.dependency_overrides.clear()

    # ============================================================================
    # GET /items/{aoid}/interpolate Tests
    # ============================================================================

    @patch('app.api.routes.items.InterpolationService')
    def test_interpolate_item_success(self, mock_service_class, client, sample_interpolated_item):
        """Test successful item interpolation via GET endpoint."""
        # Setup mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.interpolate_item.return_value = sample_interpolated_item
        mock_service.get_interpolation_range.return_value = (100, 200)

        # Make request
        response = client.get("/api/v1/items/12345/interpolate?target_ql=150")

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["item"]["aoid"] == 12345
        assert data["item"]["target_ql"] == 150
        assert data["item"]["interpolating"] is True
        assert data["interpolation_range"]["min_ql"] == 100
        assert data["interpolation_range"]["max_ql"] == 200

        # Verify service calls
        mock_service.interpolate_item.assert_called_once_with(12345, 150)
        mock_service.get_interpolation_range.assert_called_once_with(12345)

    @patch('app.api.routes.items.InterpolationService')
    def test_interpolate_item_not_found(self, mock_service_class, client):
        """Test interpolation when item is not found."""
        # Setup mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.interpolate_item.return_value = None

        # Make request
        response = client.get("/api/v1/items/99999/interpolate?target_ql=150")

        # Assertions
        assert response.status_code == 404
        data = response.json()
        assert "Item with AOID 99999 not found" in data["detail"]

    @patch('app.api.routes.items.InterpolationService')
    def test_interpolate_item_service_exception(self, mock_service_class, client):
        """Test handling of service exceptions."""
        # Setup mock service to raise exception
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.interpolate_item.side_effect = Exception("Database error")

        # Make request
        response = client.get("/api/v1/items/12345/interpolate?target_ql=150")

        # Assertions
        assert response.status_code == 200  # Returns success=false instead of error
        data = response.json()
        assert data["success"] is False
        assert "Failed to interpolate item: Database error" in data["error"]

    def test_interpolate_item_invalid_ql_low(self, client):
        """Test interpolation with QL below minimum."""
        response = client.get("/api/v1/items/12345/interpolate?target_ql=0")
        assert response.status_code == 422  # Validation error

    def test_interpolate_item_invalid_ql_high(self, client):
        """Test interpolation with QL above maximum."""
        response = client.get("/api/v1/items/12345/interpolate?target_ql=501")
        assert response.status_code == 422  # Validation error

    def test_interpolate_item_missing_target_ql(self, client):
        """Test interpolation without target_ql parameter."""
        response = client.get("/api/v1/items/12345/interpolate")
        assert response.status_code == 422  # Validation error

    def test_interpolate_item_invalid_aoid(self, client):
        """Test interpolation with invalid AOID."""
        response = client.get("/api/v1/items/abc/interpolate?target_ql=150")
        assert response.status_code == 422  # Validation error

    # ============================================================================
    # GET /items/{aoid}/interpolation-info Tests
    # ============================================================================

    @patch('app.api.routes.items.InterpolationService')
    def test_get_interpolation_info_success(self, mock_service_class, client, sample_interpolation_info):
        """Test successful retrieval of interpolation info."""
        # Setup mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.is_item_interpolatable.return_value = True
        mock_service.get_interpolation_range.return_value = (100, 200)

        # Make request
        response = client.get("/api/v1/items/12345/interpolation-info")

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["aoid"] == 12345
        assert data["interpolatable"] is True
        assert data["min_ql"] == 100
        assert data["max_ql"] == 200
        assert data["ql_range"] == 101  # 200 - 100 + 1

        # Verify service calls
        mock_service.is_item_interpolatable.assert_called_once_with(12345)
        mock_service.get_interpolation_range.assert_called_once_with(12345)

    @patch('app.api.routes.items.InterpolationService')
    def test_get_interpolation_info_not_found(self, mock_service_class, client):
        """Test interpolation info when item is not found."""
        # Setup mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.get_interpolation_range.return_value = None

        # Make request
        response = client.get("/api/v1/items/99999/interpolation-info")

        # Assertions
        assert response.status_code == 404
        data = response.json()
        assert "Item with AOID 99999 not found" in data["detail"]

    @patch('app.api.routes.items.InterpolationService')
    def test_get_interpolation_info_not_interpolatable(self, mock_service_class, client):
        """Test interpolation info for non-interpolatable item."""
        # Setup mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.is_item_interpolatable.return_value = False
        mock_service.get_interpolation_range.return_value = (100, 100)

        # Make request
        response = client.get("/api/v1/items/12345/interpolation-info")

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["aoid"] == 12345
        assert data["interpolatable"] is False
        assert data["min_ql"] == 100
        assert data["max_ql"] == 100
        assert data["ql_range"] == 1

    @patch('app.api.routes.items.InterpolationService')
    def test_get_interpolation_info_service_exception(self, mock_service_class, client):
        """Test handling of service exceptions in interpolation info."""
        # Setup mock service to raise exception
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.get_interpolation_range.side_effect = Exception("Database error")

        # Make request
        response = client.get("/api/v1/items/12345/interpolation-info")

        # Assertions
        assert response.status_code == 500
        data = response.json()
        assert "Failed to get interpolation info: Database error" in data["detail"]

    # ============================================================================
    # POST /items/interpolate Tests
    # ============================================================================

    @patch('app.api.routes.items.InterpolationService')
    def test_interpolate_item_post_success(self, mock_service_class, client, sample_interpolated_item):
        """Test successful item interpolation via POST endpoint."""
        # Setup mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.interpolate_item.return_value = sample_interpolated_item
        mock_service.get_interpolation_range.return_value = (100, 200)

        # Make request
        response = client.post(
            "/api/v1/items/interpolate",
            json={"aoid": 12345, "target_ql": 150}
        )

        # Assertions
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["item"]["aoid"] == 12345
        assert data["item"]["target_ql"] == 150
        assert data["item"]["interpolating"] is True

        # Verify service calls
        mock_service.interpolate_item.assert_called_once_with(12345, 150)
        mock_service.get_interpolation_range.assert_called_once_with(12345)

    @patch('app.api.routes.items.InterpolationService')
    def test_interpolate_item_post_not_found(self, mock_service_class, client):
        """Test POST interpolation when item is not found."""
        # Setup mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.interpolate_item.return_value = None

        # Make request
        response = client.post(
            "/api/v1/items/interpolate",
            json={"aoid": 99999, "target_ql": 150}
        )

        # Assertions
        assert response.status_code == 404
        data = response.json()
        assert "Item with AOID 99999 not found" in data["detail"]

    def test_interpolate_item_post_invalid_json(self, client):
        """Test POST interpolation with invalid JSON."""
        response = client.post(
            "/api/v1/items/interpolate",
            json={"invalid": "data"}
        )
        assert response.status_code == 422  # Validation error

    def test_interpolate_item_post_missing_aoid(self, client):
        """Test POST interpolation with missing AOID."""
        response = client.post(
            "/api/v1/items/interpolate",
            json={"target_ql": 150}
        )
        assert response.status_code == 422  # Validation error

    def test_interpolate_item_post_missing_target_ql(self, client):
        """Test POST interpolation with missing target_ql."""
        response = client.post(
            "/api/v1/items/interpolate",
            json={"aoid": 12345}
        )
        assert response.status_code == 422  # Validation error

    def test_interpolate_item_post_invalid_ql_range(self, client):
        """Test POST interpolation with QL out of valid range."""
        # Test below minimum
        response = client.post(
            "/api/v1/items/interpolate",
            json={"aoid": 12345, "target_ql": 0}
        )
        assert response.status_code == 422

        # Test above maximum
        response = client.post(
            "/api/v1/items/interpolate",
            json={"aoid": 12345, "target_ql": 501}
        )
        assert response.status_code == 422

    @patch('app.api.routes.items.InterpolationService')
    def test_interpolate_item_post_service_exception(self, mock_service_class, client):
        """Test handling of service exceptions in POST endpoint."""
        # Setup mock service to raise exception
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.interpolate_item.side_effect = Exception("Database error")

        # Make request
        response = client.post(
            "/api/v1/items/interpolate",
            json={"aoid": 12345, "target_ql": 150}
        )

        # Assertions
        assert response.status_code == 200  # Returns success=false instead of error
        data = response.json()
        assert data["success"] is False
        assert "Failed to interpolate item: Database error" in data["error"]

    # ============================================================================
    # Performance and Logging Tests
    # ============================================================================

    @patch('app.api.routes.items.logger')
    @patch('app.api.routes.items.InterpolationService')
    def test_interpolation_logging(self, mock_service_class, mock_logger, client, sample_interpolated_item):
        """Test that interpolation requests are properly logged."""
        # Setup mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.interpolate_item.return_value = sample_interpolated_item
        mock_service.get_interpolation_range.return_value = (100, 200)

        # Make request
        response = client.get("/api/v1/items/12345/interpolate?target_ql=150")

        # Verify logging was called
        assert response.status_code == 200
        mock_logger.info.assert_called()
        
        # Check that the log message contains expected information
        log_call_args = mock_logger.info.call_args[0][0]
        assert "aoid=12345" in log_call_args
        assert "target_ql=150" in log_call_args
        assert "interpolating=True" in log_call_args

    @patch('app.api.routes.items.time')
    @patch('app.api.routes.items.InterpolationService')
    def test_interpolation_timing(self, mock_service_class, mock_time, client, sample_interpolated_item):
        """Test that interpolation timing is measured."""
        # Setup mock time
        mock_time.time.side_effect = [1000.0, 1000.5]  # 0.5 second difference

        # Setup mock service
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.interpolate_item.return_value = sample_interpolated_item

        # Make request
        response = client.get("/api/v1/items/12345/interpolate?target_ql=150")

        # Verify timing was measured
        assert response.status_code == 200
        assert mock_time.time.call_count == 2

    # ============================================================================
    # Edge Cases and Boundary Tests
    # ============================================================================

    @patch('app.api.routes.items.InterpolationService')
    def test_interpolate_minimum_ql(self, mock_service_class, client, sample_interpolated_item):
        """Test interpolation at minimum QL boundary."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.interpolate_item.return_value = sample_interpolated_item

        response = client.get("/api/v1/items/12345/interpolate?target_ql=1")
        assert response.status_code == 200

    @patch('app.api.routes.items.InterpolationService')
    def test_interpolate_maximum_ql(self, mock_service_class, client, sample_interpolated_item):
        """Test interpolation at maximum QL boundary."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.interpolate_item.return_value = sample_interpolated_item

        response = client.get("/api/v1/items/12345/interpolate?target_ql=500")
        assert response.status_code == 200

    @patch('app.api.routes.items.InterpolationService')
    def test_interpolate_large_aoid(self, mock_service_class, client, sample_interpolated_item):
        """Test interpolation with large AOID values."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.interpolate_item.return_value = sample_interpolated_item

        response = client.get("/api/v1/items/999999999/interpolate?target_ql=150")
        assert response.status_code == 200

    # ============================================================================
    # Content Type and Header Tests
    # ============================================================================

    @patch('app.api.routes.items.InterpolationService')
    def test_interpolation_response_headers(self, mock_service_class, client, sample_interpolated_item):
        """Test that interpolation responses have correct headers."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.interpolate_item.return_value = sample_interpolated_item

        response = client.get("/api/v1/items/12345/interpolate?target_ql=150")
        
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"

    def test_interpolation_post_content_type_validation(self, client):
        """Test that POST endpoint validates content type."""
        # Test with incorrect content type
        response = client.post(
            "/api/v1/items/interpolate",
            data="aoid=12345&target_ql=150",
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        assert response.status_code == 422

    # ============================================================================
    # Concurrent Request Tests
    # ============================================================================

    @patch('app.api.routes.items.InterpolationService')
    def test_interpolation_service_instance_per_request(self, mock_service_class, client, sample_interpolated_item):
        """Test that each request gets its own service instance."""
        mock_service = Mock()
        mock_service_class.return_value = mock_service
        mock_service.interpolate_item.return_value = sample_interpolated_item

        # Make multiple requests
        response1 = client.get("/api/v1/items/12345/interpolate?target_ql=150")
        response2 = client.get("/api/v1/items/67890/interpolate?target_ql=200")

        assert response1.status_code == 200
        assert response2.status_code == 200
        
        # Verify service was instantiated for each request
        assert mock_service_class.call_count == 2
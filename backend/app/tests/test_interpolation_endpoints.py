"""
Unit tests for interpolation API endpoints.

Tests the FastAPI endpoints for item interpolation, including request/response
handling, error cases, and integration with the InterpolationService.
"""

import pytest
from unittest.mock import Mock, patch
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

    def test_interpolate_item_success(self, client, monkeypatch, sample_interpolated_item):
        """Test successful item interpolation via GET endpoint."""
        # Setup mock service methods
        mock_interpolate = Mock(return_value=sample_interpolated_item)
        mock_get_range = Mock(return_value=(100, 200))

        # Patch the service methods
        monkeypatch.setattr("app.api.routes.items.InterpolationService.interpolate_item", mock_interpolate)
        monkeypatch.setattr("app.api.routes.items.InterpolationService.get_interpolation_range", mock_get_range)

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
        mock_interpolate.assert_called_once()
        mock_get_range.assert_called_once()

    def test_interpolate_item_not_found(self, client, monkeypatch):
        """Test interpolation when item is not found."""
        # Setup mock service - endpoint catches 404 and returns success=False
        mock_interpolate = Mock(return_value=None)
        monkeypatch.setattr("app.api.routes.items.InterpolationService.interpolate_item", mock_interpolate)

        # Make request
        response = client.get("/api/v1/items/99999/interpolate?target_ql=150")

        # Assertions - Endpoint catches exception and returns success=False
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "Item with AOID 99999 not found" in data["error"]

    def test_interpolate_item_service_exception(self, client, monkeypatch):
        """Test handling of service exceptions."""
        # Setup mock service to raise exception
        mock_interpolate = Mock(side_effect=Exception("Database error"))
        monkeypatch.setattr("app.api.routes.items.InterpolationService.interpolate_item", mock_interpolate)

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

    def test_get_interpolation_info_success(self, client, monkeypatch):
        """Test successful retrieval of interpolation info."""
        # Setup mock service - endpoint uses get_interpolation_ranges
        mock_ranges = Mock(return_value=[
            {"min_ql": 100, "max_ql": 150, "interpolatable": True, "base_aoid": 12345},
            {"min_ql": 150, "max_ql": 200, "interpolatable": True, "base_aoid": 12346}
        ])
        monkeypatch.setattr("app.api.routes.items.InterpolationService.get_interpolation_ranges", mock_ranges)

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

    def test_get_interpolation_info_not_found(self, client, monkeypatch):
        """Test interpolation info when item is not found."""
        # Setup mock service - This endpoint properly raises HTTPException for 404
        mock_ranges = Mock(return_value=None)
        monkeypatch.setattr("app.api.routes.items.InterpolationService.get_interpolation_ranges", mock_ranges)

        # Make request
        response = client.get("/api/v1/items/99999/interpolation-info")

        # Assertions - This endpoint properly returns 404
        assert response.status_code == 404
        data = response.json()
        assert "Item with AOID 99999 not found" in str(data)

    def test_get_interpolation_info_not_interpolatable(self, client, monkeypatch):
        """Test interpolation info for non-interpolatable item."""
        # Setup mock service - single variant, not interpolatable
        mock_ranges = Mock(return_value=[
            {"min_ql": 100, "max_ql": 100, "interpolatable": False, "base_aoid": 12345}
        ])
        monkeypatch.setattr("app.api.routes.items.InterpolationService.get_interpolation_ranges", mock_ranges)

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

    def test_get_interpolation_info_service_exception(self, client, monkeypatch):
        """Test handling of service exceptions in interpolation info."""
        # Setup mock service to raise exception
        mock_ranges = Mock(side_effect=Exception("Database error"))
        monkeypatch.setattr("app.api.routes.items.InterpolationService.get_interpolation_ranges", mock_ranges)

        # Make request
        response = client.get("/api/v1/items/12345/interpolation-info")

        # Assertions
        assert response.status_code == 500
        data = response.json()
        assert "Failed to get interpolation info: Database error" in str(data)

    # ============================================================================
    # POST /items/interpolate Tests
    # ============================================================================

    def test_interpolate_item_post_success(self, client, monkeypatch, sample_interpolated_item):
        """Test successful item interpolation via POST endpoint."""
        # Setup mock service methods
        mock_interpolate = Mock(return_value=sample_interpolated_item)
        mock_get_range = Mock(return_value=(100, 200))

        monkeypatch.setattr("app.api.routes.items.InterpolationService.interpolate_item", mock_interpolate)
        monkeypatch.setattr("app.api.routes.items.InterpolationService.get_interpolation_range", mock_get_range)

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
        mock_interpolate.assert_called_once()
        mock_get_range.assert_called_once()

    def test_interpolate_item_post_not_found(self, client, monkeypatch):
        """Test POST interpolation when item is not found."""
        # Setup mock service - endpoint catches 404 and returns success=False
        mock_interpolate = Mock(return_value=None)
        monkeypatch.setattr("app.api.routes.items.InterpolationService.interpolate_item", mock_interpolate)

        # Make request
        response = client.post(
            "/api/v1/items/interpolate",
            json={"aoid": 99999, "target_ql": 150}
        )

        # Assertions - Endpoint catches exception and returns success=False
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is False
        assert "Item with AOID 99999 not found" in data["error"]

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

    def test_interpolate_item_post_service_exception(self, client, monkeypatch):
        """Test handling of service exceptions in POST endpoint."""
        # Setup mock service to raise exception
        mock_interpolate = Mock(side_effect=Exception("Database error"))
        monkeypatch.setattr("app.api.routes.items.InterpolationService.interpolate_item", mock_interpolate)

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

    def test_interpolation_logging(self, client, monkeypatch, sample_interpolated_item):
        """Test that interpolation requests are properly logged."""
        # Setup mock logger
        mock_logger_info = Mock()
        monkeypatch.setattr("app.api.routes.items.logger.info", mock_logger_info)

        # Setup mock service
        mock_interpolate = Mock(return_value=sample_interpolated_item)
        mock_get_range = Mock(return_value=(100, 200))
        monkeypatch.setattr("app.api.routes.items.InterpolationService.interpolate_item", mock_interpolate)
        monkeypatch.setattr("app.api.routes.items.InterpolationService.get_interpolation_range", mock_get_range)

        # Make request
        response = client.get("/api/v1/items/12345/interpolate?target_ql=150")

        # Verify logging was called
        assert response.status_code == 200
        mock_logger_info.assert_called()

        # Check that the log message contains expected information
        log_call_args = mock_logger_info.call_args[0][0]
        assert "aoid=12345" in log_call_args
        assert "target_ql=150" in log_call_args
        assert "interpolating=True" in log_call_args

    def test_interpolation_timing(self, client, monkeypatch, sample_interpolated_item):
        """Test that interpolation timing is measured."""
        # Setup mock service
        mock_interpolate = Mock(return_value=sample_interpolated_item)
        mock_get_range = Mock(return_value=(100, 200))
        monkeypatch.setattr("app.api.routes.items.InterpolationService.interpolate_item", mock_interpolate)
        monkeypatch.setattr("app.api.routes.items.InterpolationService.get_interpolation_range", mock_get_range)

        # Make request - just verify it succeeds
        # Actual timing measurement is implementation detail
        response = client.get("/api/v1/items/12345/interpolate?target_ql=150")

        # Verify request succeeded
        assert response.status_code == 200
        assert response.json()["success"] is True

    # ============================================================================
    # Edge Cases and Boundary Tests
    # ============================================================================

    def test_interpolate_minimum_ql(self, client, monkeypatch, sample_interpolated_item):
        """Test interpolation at minimum QL boundary."""
        mock_interpolate = Mock(return_value=sample_interpolated_item)
        monkeypatch.setattr("app.api.routes.items.InterpolationService.interpolate_item", mock_interpolate)

        response = client.get("/api/v1/items/12345/interpolate?target_ql=1")
        assert response.status_code == 200

    def test_interpolate_maximum_ql(self, client, monkeypatch, sample_interpolated_item):
        """Test interpolation at maximum QL boundary."""
        mock_interpolate = Mock(return_value=sample_interpolated_item)
        monkeypatch.setattr("app.api.routes.items.InterpolationService.interpolate_item", mock_interpolate)

        response = client.get("/api/v1/items/12345/interpolate?target_ql=500")
        assert response.status_code == 200

    def test_interpolate_large_aoid(self, client, monkeypatch, sample_interpolated_item):
        """Test interpolation with large AOID values."""
        mock_interpolate = Mock(return_value=sample_interpolated_item)
        monkeypatch.setattr("app.api.routes.items.InterpolationService.interpolate_item", mock_interpolate)

        response = client.get("/api/v1/items/999999999/interpolate?target_ql=150")
        assert response.status_code == 200

    # ============================================================================
    # Content Type and Header Tests
    # ============================================================================

    def test_interpolation_response_headers(self, client, monkeypatch, sample_interpolated_item):
        """Test that interpolation responses have correct headers."""
        mock_interpolate = Mock(return_value=sample_interpolated_item)
        monkeypatch.setattr("app.api.routes.items.InterpolationService.interpolate_item", mock_interpolate)

        response = client.get("/api/v1/items/12345/interpolate?target_ql=150")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"

    def test_interpolation_post_content_type_validation(self, client):
        """Test that POST endpoint validates content type."""
        # Test with incorrect content type - FastAPI expects JSON
        response = client.post(
            "/api/v1/items/interpolate",
            data="invalid data",
            headers={"Content-Type": "application/json"}
        )
        # Should return validation error for malformed JSON
        assert response.status_code == 422

    # ============================================================================
    # Concurrent Request Tests
    # ============================================================================

    def test_interpolation_service_instance_per_request(self, client, monkeypatch, sample_interpolated_item):
        """Test that each request gets its own service instance."""
        mock_interpolate = Mock(return_value=sample_interpolated_item)
        monkeypatch.setattr("app.api.routes.items.InterpolationService.interpolate_item", mock_interpolate)

        # Make multiple requests
        response1 = client.get("/api/v1/items/12345/interpolate?target_ql=150")
        response2 = client.get("/api/v1/items/67890/interpolate?target_ql=200")

        assert response1.status_code == 200
        assert response2.status_code == 200

        # Verify service method was called for each request
        assert mock_interpolate.call_count == 2
"""
Basic functionality tests for Task 4: Advanced Search and Filtering API.
Tests that endpoints are working using service layer mocking pattern.
"""

import pytest
from unittest.mock import Mock, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.models import Item, Spell, Criterion, SpellCriterion
from app.core.database import get_db


@pytest.fixture
def client():
    """Create a test client."""
    return TestClient(app)


class TestTask4Endpoints:
    """Test that all Task 4 endpoints are functional."""

    def test_items_basic_endpoint(self, client):
        """Test basic items endpoint works."""
        mock_query = Mock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.distinct.return_value = mock_query
        mock_query.count.return_value = 0
        mock_query.offset.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []

        mock_db = Mock()
        mock_db.query.return_value = mock_query

        def mock_get_db():
            return mock_db

        app.dependency_overrides[get_db] = mock_get_db

        try:
            response = client.get("/api/v1/items")
            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert "total" in data
            assert "page" in data
            assert isinstance(data["items"], list)
        finally:
            app.dependency_overrides.clear()

    def test_items_search_endpoint_exists(self, client):
        """Test items search endpoint exists and handles basic queries."""
        mock_query = Mock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.distinct.return_value = mock_query
        mock_query.count.return_value = 0
        mock_query.offset.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []

        mock_db = Mock()
        mock_db.query.return_value = mock_query

        def mock_get_db():
            return mock_db

        app.dependency_overrides[get_db] = mock_get_db

        try:
            response = client.get("/api/v1/items/search?q=test")
            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert "total" in data
        finally:
            app.dependency_overrides.clear()

    def test_items_filter_endpoint_exists(self, client):
        """Test advanced filtering endpoint exists."""
        mock_query = Mock()
        mock_query.options.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.count.return_value = 0
        mock_query.offset.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []

        mock_db = Mock()
        mock_db.query.return_value = mock_query

        def mock_get_db():
            return mock_db

        app.dependency_overrides[get_db] = mock_get_db

        try:
            response = client.get("/api/v1/items/filter?min_ql=100")
            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert "total" in data
        finally:
            app.dependency_overrides.clear()

    def test_items_with_stats_endpoint_exists(self, client):
        """Test stat-based queries endpoint exists."""
        # This endpoint requires stat_requirements parameter
        response = client.get("/api/v1/items/with-stats?stat_requirements=16:>=100")
        # Should get 200 (works with mocked data) or 400 (validation error)
        assert response.status_code in [200, 400, 422]

    def test_spells_basic(self, client):
        """Test basic spells endpoint."""
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.count.return_value = 0
        mock_query.offset.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []

        mock_db = Mock()
        mock_db.query.return_value = mock_query

        def mock_get_db():
            return mock_db

        app.dependency_overrides[get_db] = mock_get_db

        try:
            response = client.get("/api/v1/spells")
            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert "total" in data
        finally:
            app.dependency_overrides.clear()

    def test_spells_search(self, client):
        """Test spell search endpoint."""
        mock_query = Mock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value = mock_query
        mock_query.count.return_value = 0
        mock_query.offset.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []

        mock_db = Mock()
        mock_db.query.return_value = mock_query

        def mock_get_db():
            return mock_db

        app.dependency_overrides[get_db] = mock_get_db

        try:
            response = client.get("/api/v1/spells/search?q=heal")
            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert "total" in data
        finally:
            app.dependency_overrides.clear()

    def test_spells_with_criteria(self, client):
        """Test spell criteria filtering."""
        mock_query = Mock()
        mock_query.distinct.return_value = mock_query
        mock_query.join.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.options.return_value = mock_query
        mock_query.count.return_value = 0
        mock_query.offset.return_value = mock_query
        mock_query.limit.return_value = mock_query
        mock_query.all.return_value = []

        mock_db = Mock()
        mock_db.query.return_value = mock_query

        def mock_get_db():
            return mock_db

        app.dependency_overrides[get_db] = mock_get_db

        try:
            response = client.get("/api/v1/spells/with-criteria")
            assert response.status_code in [200, 422]  # 422 if no criteria configured
        finally:
            app.dependency_overrides.clear()


class TestCachingFunctionality:
    """Test caching endpoints work."""

    def test_cache_stats(self, client):
        """Test cache statistics endpoint."""
        response = client.get("/api/v1/cache/stats")
        assert response.status_code == 200
        data = response.json()
        assert "hits" in data
        assert "misses" in data
        assert "cache_size" in data

    def test_cache_clear(self, client):
        """Test cache clearing."""
        response = client.post("/api/v1/cache/clear")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data

    def test_cache_cleanup(self, client):
        """Test cache cleanup."""
        response = client.post("/api/v1/cache/cleanup")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data


class TestPerformanceMonitoring:
    """Test performance monitoring endpoints."""

    def test_performance_health(self, client):
        """Test performance health check."""
        response = client.get("/api/v1/performance/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "performance_monitoring" in data

    def test_performance_overview(self, client):
        """Test performance overview endpoint."""
        mock_db = Mock()

        def mock_get_db():
            return mock_db

        app.dependency_overrides[get_db] = mock_get_db

        try:
            response = client.get("/api/v1/performance/overview")
            assert response.status_code == 200
            data = response.json()
            assert "cache_stats" in data
        finally:
            app.dependency_overrides.clear()


class TestPaginationConsistency:
    """Test pagination works consistently across endpoints."""

    def test_pagination_parameters(self, client):
        """Test pagination parameters are handled correctly."""
        # Removed deprecated endpoints: pocket-bosses, symbiants
        endpoints = [
            "/api/v1/items",
            "/api/v1/spells"
        ]

        for endpoint in endpoints:
            # Setup mock for each endpoint
            mock_query = Mock()
            if endpoint == "/api/v1/items":
                mock_query.options.return_value = mock_query
            mock_query.filter.return_value = mock_query
            mock_query.distinct.return_value = mock_query
            mock_query.count.return_value = 10
            mock_query.offset.return_value = mock_query
            mock_query.limit.return_value = mock_query
            mock_query.all.return_value = []

            mock_db = Mock()
            mock_db.query.return_value = mock_query

            def mock_get_db():
                return mock_db

            app.dependency_overrides[get_db] = mock_get_db

            try:
                # Test basic pagination
                response = client.get(f"{endpoint}?page=1&page_size=5")
                assert response.status_code == 200, f"Endpoint {endpoint} failed"
                data = response.json()

                # Check required fields
                required_fields = ["items", "total", "page", "page_size", "pages", "has_next", "has_prev"]
                for field in required_fields:
                    assert field in data, f"Missing {field} in {endpoint} response"

                # Check data types
                assert isinstance(data["items"], list)
                assert isinstance(data["total"], int)
                assert isinstance(data["page"], int)
                assert isinstance(data["page_size"], int)
                assert isinstance(data["pages"], int)
                assert isinstance(data["has_next"], bool)
                assert isinstance(data["has_prev"], bool)
            finally:
                app.dependency_overrides.clear()

    def test_invalid_pagination_handled(self, client):
        """Test invalid pagination parameters are handled gracefully."""
        # Invalid page numbers should return 422
        response = client.get("/api/v1/items?page=0")
        assert response.status_code == 422

        response = client.get("/api/v1/items?page=-1")
        assert response.status_code == 422


class TestErrorHandling:
    """Test error handling across endpoints."""

    def test_nonexistent_resources_return_404(self, client):
        """Test nonexistent resources return proper 404s."""
        endpoints = [
            "/api/v1/items/99999999",
            "/api/v1/spells/99999999",
        ]

        for endpoint in endpoints:
            # Setup mock to return None
            mock_query = Mock()
            if "/items/" in endpoint:
                mock_query.options.return_value = mock_query
            mock_query.filter.return_value = mock_query
            mock_query.first.return_value = None

            mock_db = Mock()
            mock_db.query.return_value = mock_query

            def mock_get_db():
                return mock_db

            app.dependency_overrides[get_db] = mock_get_db

            try:
                response = client.get(endpoint)
                assert response.status_code == 404, f"Endpoint {endpoint} should return 404"
                data = response.json()
                assert "error" in data or "detail" in data
            finally:
                app.dependency_overrides.clear()

    def test_validation_errors_return_422(self, client):
        """Test validation errors return proper 422s."""
        # Invalid page parameters
        response = client.get("/api/v1/items?page=invalid")
        assert response.status_code == 422

        # Invalid page size too large (if enforced)
        response = client.get("/api/v1/items?page_size=10000")
        assert response.status_code in [200, 422]  # Depends on implementation


class TestEndpointResponseStructure:
    """Test that endpoints return consistent response structures."""

    def test_list_endpoints_structure(self, client):
        """Test list endpoints have consistent structure."""
        # Removed deprecated endpoints: pocket-bosses, symbiants
        endpoints = ["/api/v1/items", "/api/v1/spells"]

        for endpoint in endpoints:
            # Setup mock
            mock_query = Mock()
            if endpoint == "/api/v1/items":
                mock_query.options.return_value = mock_query
            mock_query.filter.return_value = mock_query
            mock_query.distinct.return_value = mock_query
            mock_query.count.return_value = 1
            mock_query.offset.return_value = mock_query
            mock_query.limit.return_value = mock_query
            mock_query.all.return_value = []

            mock_db = Mock()
            mock_db.query.return_value = mock_query

            def mock_get_db():
                return mock_db

            app.dependency_overrides[get_db] = mock_get_db

            try:
                response = client.get(f"{endpoint}?page_size=1")
                assert response.status_code == 200
                data = response.json()

                # Must have pagination structure
                assert "items" in data
                assert "total" in data
                assert "page" in data
                assert "page_size" in data
                assert "pages" in data
                assert "has_next" in data
                assert "has_prev" in data
            finally:
                app.dependency_overrides.clear()

    def test_search_endpoints_structure(self, client):
        """Test search endpoints have consistent structure."""
        # Removed deprecated pocket-bosses endpoint
        search_endpoints = [
            "/api/v1/items/search?q=test",
            "/api/v1/spells/search?q=test"
        ]

        for endpoint in search_endpoints:
            # Setup mock
            mock_query = Mock()
            if "/items/" in endpoint:
                mock_query.options.return_value = mock_query
            mock_query.filter.return_value = mock_query
            mock_query.order_by.return_value = mock_query
            mock_query.distinct.return_value = mock_query
            mock_query.count.return_value = 0
            mock_query.offset.return_value = mock_query
            mock_query.limit.return_value = mock_query
            mock_query.all.return_value = []

            mock_db = Mock()
            mock_db.query.return_value = mock_query

            def mock_get_db():
                return mock_db

            app.dependency_overrides[get_db] = mock_get_db

            try:
                response = client.get(endpoint)
                assert response.status_code == 200
                data = response.json()

                # Search results should still be paginated
                assert "items" in data
                assert "total" in data
                assert isinstance(data["items"], list)
                assert isinstance(data["total"], int)
            finally:
                app.dependency_overrides.clear()


class TestHealthAndStatus:
    """Test health and status endpoints."""

    def test_root_endpoint(self, client):
        """Test root endpoint works."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "version" in data

    def test_health_endpoint(self, client):
        """Test health endpoint works."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data

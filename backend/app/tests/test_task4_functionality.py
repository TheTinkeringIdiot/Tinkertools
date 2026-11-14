"""
Basic functionality tests for Task 4: Advanced Search and Filtering API.
The item endpoints answer with the shapes and status codes clients rely on.
"""

import pytest

PAGE_FIELDS = {
    "items": list,
    "total": int,
    "page": int,
    "page_size": int,
    "pages": int,
    "has_next": bool,
    "has_prev": bool,
}


class TestCachingFunctionality:
    """Test caching endpoints work."""

    def test_cache_clear(self, client):
        """Test cache clearing."""
        response = client.post("/api/v1/cache/clear")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data


class TestPaginationConsistency:
    """Test pagination works consistently across endpoints."""

    @pytest.mark.parametrize(
        "endpoint", ["/api/v1/items?", "/api/v1/items/search?q=test&"]
    )
    def test_pagination_parameters(self, client, endpoint):
        """A page carries its rows and every paging field, each of its type."""
        response = client.get(f"{endpoint}page=2&page_size=5")
        assert response.status_code == 200, f"Endpoint {endpoint} failed"
        data = response.json()

        for field, kind in PAGE_FIELDS.items():
            assert isinstance(data.get(field), kind), f"{field} in {endpoint}"
        assert (data["page"], data["page_size"]) == (2, 5)
        assert len(data["items"]) == 5
        assert data["has_prev"] is True

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
        response = client.get("/api/v1/items/99999999")

        assert response.status_code == 404
        data = response.json()
        assert "error" in data or "detail" in data

    def test_validation_errors_return_422(self, client):
        """Test validation errors return proper 422s."""
        response = client.get("/api/v1/items?page=invalid")
        assert response.status_code == 422

        response = client.get("/api/v1/items?page_size=10000")
        assert response.status_code == 422


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

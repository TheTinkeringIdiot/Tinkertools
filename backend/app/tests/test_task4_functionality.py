"""
Basic functionality tests for Task 4: Advanced Search and Filtering API.
Tests that endpoints are working without requiring specific data content.
"""

import pytest


class TestTask4Endpoints:
    """Test that all Task 4 endpoints are functional."""
    
    def test_items_basic_endpoint(self, client):
        """Test basic items endpoint works."""
        response = client.get("/api/v1/items")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert isinstance(data["items"], list)
    
    def test_items_search_endpoint_exists(self, client):
        """Test items search endpoint exists and handles basic queries."""
        response = client.get("/api/v1/items/search?q=test")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
    
    def test_items_filter_endpoint_exists(self, client):
        """Test advanced filtering endpoint exists."""
        response = client.get("/api/v1/items/filter?min_ql=100")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
    
    def test_items_with_stats_endpoint_exists(self, client):
        """Test stat-based queries endpoint exists."""
        response = client.get("/api/v1/items/with-stats?stat_requirements=16:>=100")
        assert response.status_code in [200, 422]  # 422 if no matching stats
    
    def test_pocket_bosses_basic(self, client):
        """Test basic pocket bosses endpoint."""
        response = client.get("/api/v1/pocket-bosses")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
    
    def test_pocket_bosses_search(self, client):
        """Test pocket boss search."""
        response = client.get("/api/v1/pocket-bosses/search?q=boss")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
    
    def test_pocket_bosses_by_symbiant_family(self, client):
        """Test pocket boss symbiant family endpoint."""
        response = client.get("/api/v1/pocket-bosses/by-symbiant-family?family=Artillery")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
    
    def test_spells_basic(self, client):
        """Test basic spells endpoint."""
        response = client.get("/api/v1/spells")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
    
    def test_spells_search(self, client):
        """Test spell search endpoint."""
        response = client.get("/api/v1/spells/search?q=heal")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
    
    def test_spells_with_criteria(self, client):
        """Test spell criteria filtering."""
        response = client.get("/api/v1/spells/with-criteria")
        assert response.status_code in [200, 422]  # 422 if no criteria configured
    
    def test_symbiants_basic(self, client):
        """Test basic symbiants endpoint."""
        response = client.get("/api/v1/symbiants")
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data


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
        response = client.get("/api/v1/performance/overview")
        assert response.status_code == 200
        data = response.json()
        assert "cache_stats" in data


class TestPaginationConsistency:
    """Test pagination works consistently across endpoints."""
    
    def test_pagination_parameters(self, client):
        """Test pagination parameters are handled correctly."""
        endpoints = [
            "/api/v1/items",
            "/api/v1/pocket-bosses",
            "/api/v1/spells",
            "/api/v1/symbiants"
        ]
        
        for endpoint in endpoints:
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
            "/api/v1/pocket-bosses/99999999", 
            "/api/v1/spells/99999999",
            "/api/v1/symbiants/99999999"
        ]
        
        for endpoint in endpoints:
            response = client.get(endpoint)
            assert response.status_code == 404, f"Endpoint {endpoint} should return 404"
            data = response.json()
            assert "error" in data
    
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
        endpoints = ["/api/v1/items", "/api/v1/pocket-bosses", "/api/v1/spells", "/api/v1/symbiants"]
        
        for endpoint in endpoints:
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
    
    def test_search_endpoints_structure(self, client):
        """Test search endpoints have consistent structure."""
        search_endpoints = [
            "/api/v1/items/search?q=test",
            "/api/v1/pocket-bosses/search?q=test",
            "/api/v1/spells/search?q=test"
        ]
        
        for endpoint in search_endpoints:
            response = client.get(endpoint)
            assert response.status_code == 200
            data = response.json()
            
            # Search results should still be paginated
            assert "items" in data
            assert "total" in data
            assert isinstance(data["items"], list)
            assert isinstance(data["total"], int)


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
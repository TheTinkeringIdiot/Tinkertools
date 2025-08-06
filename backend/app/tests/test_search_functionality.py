"""
Tests for advanced search and filtering functionality using the existing PostgreSQL database with sample data.
"""

import pytest


class TestItemSearch:
    """Test item search functionality with existing data."""
    
    def test_items_endpoint_basic(self, client):
        """Test basic items endpoint functionality."""
        response = client.get("/api/v1/items")
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)
    
    def test_item_search_endpoint(self, client):
        """Test item search endpoint."""
        response = client.get("/api/v1/items/search?q=weapon")
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        # Search results should be relevant to "weapon"
        if data["total"] > 0:
            # Check that results contain relevant items
            item_names = [item["name"].lower() for item in data["items"]]
            # At least some results should be weapon-related
            assert any("weapon" in name for name in item_names[:5])  # Check first 5 results
    
    def test_item_advanced_filtering(self, client):
        """Test advanced filtering endpoint."""
        response = client.get("/api/v1/items/filter?min_ql=100&max_ql=200")
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        if data["total"] > 0:
            # Verify all items are within the QL range
            for item in data["items"]:
                assert 100 <= item["ql"] <= 200
    
    def test_item_class_filtering(self, client):
        """Test filtering by item class."""
        response = client.get("/api/v1/items/filter?item_class=Weapon")
        assert response.status_code == 200
        data = response.json()
        
        if data["total"] > 0:
            # All results should be weapons
            for item in data["items"]:
                assert item["item_class"] == "Weapon"
    
    def test_nano_filtering(self, client):
        """Test filtering by nano flag."""
        response = client.get("/api/v1/items/filter?is_nano=true")
        assert response.status_code == 200
        data = response.json()
        
        if data["total"] > 0:
            # All results should be nano items
            for item in data["items"]:
                assert item["is_nano"] is True
    
    def test_sorting_functionality(self, client):
        """Test sorting options."""
        # Sort by QL ascending
        response = client.get("/api/v1/items/filter?sort_by=ql&sort_order=asc&page_size=10")
        assert response.status_code == 200
        data = response.json()
        
        if data["total"] > 1:
            qls = [item["ql"] for item in data["items"]]
            # Check if sorted ascending
            assert qls == sorted(qls)
        
        # Sort by name descending
        response = client.get("/api/v1/items/filter?sort_by=name&sort_order=desc&page_size=10")
        assert response.status_code == 200
        data = response.json()
        
        if data["total"] > 1:
            names = [item["name"] for item in data["items"]]
            # Check if sorted descending
            assert names == sorted(names, reverse=True)


class TestStatBasedQueries:
    """Test stat-based item queries."""
    
    def test_items_with_stats_endpoint(self, client):
        """Test items with stats endpoint basic functionality."""
        # Test with a common stat requirement
        response = client.get("/api/v1/items/with-stats?stat_requirements=16:>=100")
        assert response.status_code in [200, 422]  # 422 if no matching stats exist
        
        if response.status_code == 200:
            data = response.json()
            assert "items" in data
            assert "total" in data
    
    def test_multiple_stat_requirements(self, client):
        """Test multiple stat requirements with AND logic."""
        response = client.get("/api/v1/items/with-stats?stat_requirements=16:>=50,17:>=50&logic=and")
        assert response.status_code in [200, 422]
        
        if response.status_code == 200:
            data = response.json()
            assert "items" in data
    
    def test_multiple_stat_requirements_or(self, client):
        """Test multiple stat requirements with OR logic."""
        response = client.get("/api/v1/items/with-stats?stat_requirements=16:>=50,17:>=50&logic=or")
        assert response.status_code in [200, 422]
        
        if response.status_code == 200:
            data = response.json()
            assert "items" in data


class TestSpellSearch:
    """Test spell search functionality."""
    
    def test_spells_endpoint_basic(self, client):
        """Test basic spells endpoint."""
        response = client.get("/api/v1/spells")
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
    
    def test_spell_search(self, client):
        """Test spell search functionality."""
        response = client.get("/api/v1/spells/search?q=heal")
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        if data["total"] > 0:
            # Check that results are relevant
            spell_names = [spell["name"].lower() for spell in data["items"]]
            assert any("heal" in name for name in spell_names[:3])
    
    def test_spell_target_filtering(self, client):
        """Test filtering spells by target."""
        response = client.get("/api/v1/spells?target=1")
        assert response.status_code == 200
        data = response.json()
        
        if data["total"] > 0:
            # All results should have target = 1
            for spell in data["items"]:
                assert spell["target"] == 1
    
    def test_spell_with_criteria(self, client):
        """Test spell criteria filtering."""
        response = client.get("/api/v1/spells/with-criteria")
        assert response.status_code in [200, 422]
        
        if response.status_code == 200:
            data = response.json()
            assert "items" in data


class TestPocketBossSearch:
    """Test pocket boss search functionality."""
    
    def test_pocket_bosses_basic(self, client):
        """Test basic pocket bosses endpoint."""
        response = client.get("/api/v1/pocket-bosses")
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
    
    def test_boss_search(self, client):
        """Test pocket boss search."""
        response = client.get("/api/v1/pocket-bosses/search?q=boss")
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        # Search should return results or empty list
        assert isinstance(data["items"], list)
    
    def test_boss_level_filtering(self, client):
        """Test filtering bosses by level."""
        response = client.get("/api/v1/pocket-bosses?min_level=100&max_level=200")
        assert response.status_code == 200
        data = response.json()
        
        if data["total"] > 0:
            # All bosses should be within level range
            for boss in data["items"]:
                assert 100 <= boss["level"] <= 200
    
    def test_boss_location_filtering(self, client):
        """Test filtering bosses by location."""
        response = client.get("/api/v1/pocket-bosses?location=desert")
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        # Location filtering should work regardless of results
    
    def test_boss_drops_filtering(self, client):
        """Test filtering bosses with drops."""
        response = client.get("/api/v1/pocket-bosses?has_drops=true")
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
    
    def test_boss_by_symbiant_family(self, client):
        """Test finding bosses by symbiant family."""
        response = client.get("/api/v1/pocket-bosses/by-symbiant-family?family=Artillery")
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data


class TestSymbiantSearch:
    """Test symbiant search functionality."""
    
    def test_symbiants_basic(self, client):
        """Test basic symbiants endpoint."""
        response = client.get("/api/v1/symbiants")
        assert response.status_code == 200
        data = response.json()
        
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
    
    def test_symbiant_family_filtering(self, client):
        """Test filtering symbiants by family."""
        response = client.get("/api/v1/symbiants?family=Artillery")
        assert response.status_code == 200
        data = response.json()
        
        if data["total"] > 0:
            # All results should have Artillery family
            for symbiant in data["items"]:
                assert "Artillery" in symbiant["family"]
    
    def test_symbiant_ql_filtering(self, client):
        """Test filtering symbiants by QL."""
        response = client.get("/api/v1/symbiants?min_ql=100&max_ql=200")
        assert response.status_code == 200
        data = response.json()
        
        if data["total"] > 0:
            # All results should be within QL range
            for symbiant in data["items"]:
                assert 100 <= symbiant["ql"] <= 200


class TestCacheAndPerformance:
    """Test caching and performance monitoring functionality."""
    
    def test_cache_stats(self, client):
        """Test cache statistics endpoint."""
        response = client.get("/api/v1/cache/stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "hits" in data
        assert "misses" in data
        assert "cache_size" in data
        assert "hit_rate_percent" in data
        assert isinstance(data["hits"], int)
        assert isinstance(data["misses"], int)
    
    def test_cache_clear(self, client):
        """Test cache clearing."""
        response = client.post("/api/v1/cache/clear")
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "cleared" in data["message"].lower()
    
    def test_cache_cleanup(self, client):
        """Test cache cleanup endpoint."""
        response = client.post("/api/v1/cache/cleanup")
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "removed" in data["message"].lower()
    
    def test_performance_health(self, client):
        """Test performance health check."""
        response = client.get("/api/v1/performance/health")
        assert response.status_code == 200
        data = response.json()
        
        assert data["status"] == "healthy"
        assert "performance_monitoring" in data
        assert "monitoring_endpoints" in data
    
    def test_performance_overview(self, client):
        """Test performance overview endpoint."""
        response = client.get("/api/v1/performance/overview")
        assert response.status_code == 200
        data = response.json()
        
        assert "cache_stats" in data
        assert "index_usage" in data
        # slow_queries might fail if pg_stat_statements isn't available
        # so we don't assert on it


class TestPaginationAndEdgeCases:
    """Test pagination and edge case handling."""
    
    def test_pagination_basic(self, client):
        """Test basic pagination functionality."""
        response = client.get("/api/v1/items?page=1&page_size=10")
        assert response.status_code == 200
        data = response.json()
        
        assert data["page"] == 1
        assert data["page_size"] <= 10
        assert "pages" in data
        assert "has_next" in data
        assert "has_prev" in data
        assert data["has_prev"] is False  # First page should not have previous
    
    def test_invalid_page_numbers(self, client):
        """Test invalid page numbers are handled."""
        response = client.get("/api/v1/items?page=0")
        assert response.status_code == 422
        
        response = client.get("/api/v1/items?page=-1")
        assert response.status_code == 422
    
    def test_large_page_size_limit(self, client):
        """Test page size limits."""
        response = client.get("/api/v1/items?page_size=1000")
        assert response.status_code in [200, 422]
        
        if response.status_code == 200:
            data = response.json()
            # Should be limited to max allowed (200)
            assert data["page_size"] <= 200
    
    def test_empty_search_results(self, client):
        """Test handling of searches with no results."""
        response = client.get("/api/v1/items/search?q=xyznonexistentitemxyz")
        assert response.status_code == 200
        data = response.json()
        
        assert data["total"] == 0
        assert data["items"] == []
        assert data["pages"] >= 1
    
    def test_invalid_stat_requirements_format(self, client):
        """Test invalid stat requirement formats are handled."""
        response = client.get("/api/v1/items/with-stats?stat_requirements=invalid_format")
        assert response.status_code in [200, 422, 400]
        # Should either handle gracefully (200) or return proper error code
    
    def test_endpoint_response_structure(self, client):
        """Test that all paginated endpoints have consistent response structure."""
        endpoints = [
            "/api/v1/items",
            "/api/v1/spells", 
            "/api/v1/symbiants",
            "/api/v1/pocket-bosses"
        ]
        
        for endpoint in endpoints:
            response = client.get(f"{endpoint}?page=1&page_size=5")
            assert response.status_code == 200
            data = response.json()
            
            # Check required pagination fields
            required_fields = ["items", "total", "page", "page_size", "pages", "has_next", "has_prev"]
            for field in required_fields:
                assert field in data, f"Missing {field} in {endpoint} response"


class TestRealDataValidation:
    """Test that our endpoints work correctly with the actual database data."""
    
    def test_get_specific_item(self, client):
        """Test getting a specific item by ID."""
        # First get list of items to find a valid ID
        response = client.get("/api/v1/items?page_size=1")
        assert response.status_code == 200
        data = response.json()
        
        if data["total"] > 0:
            item_id = data["items"][0]["id"]
            # Get specific item
            response = client.get(f"/api/v1/items/{item_id}")
            assert response.status_code == 200
            item_data = response.json()
            assert item_data["id"] == item_id
            assert "name" in item_data
            assert "ql" in item_data
    
    def test_get_specific_symbiant(self, client):
        """Test getting a specific symbiant by ID."""
        response = client.get("/api/v1/symbiants?page_size=1")
        assert response.status_code == 200
        data = response.json()
        
        if data["total"] > 0:
            symbiant_id = data["items"][0]["id"]
            response = client.get(f"/api/v1/symbiants/{symbiant_id}")
            assert response.status_code == 200
            symbiant_data = response.json()
            assert symbiant_data["id"] == symbiant_id
    
    def test_get_specific_pocket_boss(self, client):
        """Test getting a specific pocket boss by ID."""
        response = client.get("/api/v1/pocket-bosses?page_size=1")
        assert response.status_code == 200
        data = response.json()
        
        if data["total"] > 0:
            boss_id = data["items"][0]["id"]
            response = client.get(f"/api/v1/pocket-bosses/{boss_id}")
            assert response.status_code == 200
            boss_data = response.json()
            assert boss_data["id"] == boss_id
    
    def test_nonexistent_resource_404(self, client):
        """Test that nonexistent resources return 404."""
        response = client.get("/api/v1/items/99999999")
        assert response.status_code == 404
        
        response = client.get("/api/v1/symbiants/99999999")
        assert response.status_code == 404
        
        response = client.get("/api/v1/pocket-bosses/99999999")
        assert response.status_code == 404
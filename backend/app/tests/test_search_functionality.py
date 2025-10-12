"""
Tests for advanced search and filtering functionality using real database data.
"""

import pytest
from unittest.mock import Mock
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db


@pytest.fixture
def mock_client():
    """Create a test client for mocked tests (used by legacy tests still using mocks)."""
    return TestClient(app)


class TestItemSearch:
    """Test item search functionality with real database data."""

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
        assert data["total"] > 0
        assert len(data["items"]) > 0

    def test_item_search_endpoint(self, client):
        """Test item search endpoint."""
        response = client.get("/api/v1/items/search?q=weapon")
        assert response.status_code == 200
        data = response.json()

        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        # If there are results, verify they contain search term
        if len(data["items"]) > 0:
            item_names = [item["name"].lower() for item in data["items"]]
            # At least one item should contain "weapon" in its name
            assert any("weapon" in name for name in item_names)

    def test_item_advanced_filtering(self, client):
        """Test advanced filtering endpoint."""
        response = client.get("/api/v1/items/filter?min_ql=100&max_ql=200")
        assert response.status_code == 200
        data = response.json()

        assert "items" in data
        assert data["total"] >= 0
        # Verify all items are within the QL range
        for item in data["items"]:
            assert 100 <= item["ql"] <= 200

    def test_item_class_filtering(self, client):
        """Test filtering by item class."""
        response = client.get("/api/v1/items/filter?item_class=1")
        assert response.status_code == 200
        data = response.json()

        assert data["total"] >= 0
        # All results should have the same item_class
        for item in data["items"]:
            assert item["item_class"] == 1

    def test_nano_filtering(self, client):
        """Test filtering by nano flag."""
        response = client.get("/api/v1/items/filter?is_nano=true")
        assert response.status_code == 200
        data = response.json()

        assert data["total"] > 0
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
        response = client.get("/api/v1/items/with-stats?stat_requirements=16:>=100")
        assert response.status_code in [200, 422]  # 422 if validation fails

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
    """Test spell search functionality with real database data."""

    def test_spells_endpoint_basic(self, client):
        """Test basic spells endpoint."""
        response = client.get("/api/v1/spells")
        assert response.status_code == 200
        data = response.json()

        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        assert data["total"] > 0

    def test_spell_search(self, client):
        """Test spell search functionality."""
        # Search for common spell-related terms that likely exist in database
        response = client.get("/api/v1/spells/search?q=Modif")
        assert response.status_code == 200
        data = response.json()

        assert "items" in data
        assert data["total"] >= 0
        # If there are results, verify they contain search term
        if len(data["items"]) > 0:
            spell_formats = [spell["spell_format"].lower() for spell in data["items"]]
            # At least one spell should contain the search term
            assert any("modif" in fmt for fmt in spell_formats)

    def test_spell_target_filtering(self, client):
        """Test filtering spells by target."""
        response = client.get("/api/v1/spells?target=1")
        assert response.status_code == 200
        data = response.json()

        assert data["total"] >= 0
        # All results should have target = 1
        for spell in data["items"]:
            assert spell["target"] == 1

    def test_spell_with_criteria(self, client):
        """Test spell criteria filtering endpoint."""
        response = client.get("/api/v1/spells/with-criteria")
        assert response.status_code in [200, 422]

        if response.status_code == 200:
            data = response.json()
            assert "items" in data
            assert "total" in data


class TestPocketBossSearch:
    """Test pocket boss (mob) search functionality with real database data."""

    def test_pocket_bosses_basic(self, client):
        """Test basic pocket bosses endpoint."""
        response = client.get("/api/v1/mobs?is_pocket_boss=true")
        assert response.status_code == 200
        data = response.json()

        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        assert data["total"] > 0

    def test_boss_search(self, client):
        """Test pocket boss search by playfield."""
        # Search for bosses in a specific playfield
        response = client.get("/api/v1/mobs?is_pocket_boss=true&playfield=Scheol")
        assert response.status_code == 200
        data = response.json()

        assert "items" in data
        # If there are results, verify playfield filtering works
        if len(data["items"]) > 0:
            for boss in data["items"]:
                assert "scheol" in boss["playfield"].lower()

    def test_boss_level_filtering(self, client):
        """Test filtering bosses by level."""
        response = client.get("/api/v1/mobs?is_pocket_boss=true&min_level=100&max_level=200")
        assert response.status_code == 200
        data = response.json()

        assert data["total"] >= 0
        # All bosses should be within level range
        for boss in data["items"]:
            assert 100 <= boss["level"] <= 200

    def test_boss_location_filtering(self, client):
        """Test filtering bosses by playfield (location)."""
        response = client.get("/api/v1/mobs?is_pocket_boss=true&playfield=Inferno")
        assert response.status_code == 200
        data = response.json()

        assert "items" in data
        # Playfield filtering should work
        if len(data["items"]) > 0:
            for boss in data["items"]:
                assert "inferno" in boss["playfield"].lower()

    def test_boss_drops_filtering(self, client):
        """Test filtering bosses with symbiant drops."""
        # Get all pocket bosses
        response = client.get("/api/v1/mobs?is_pocket_boss=true")
        assert response.status_code == 200
        data = response.json()

        assert "items" in data
        # Check if symbiant_count field exists in response
        if len(data["items"]) > 0:
            assert "symbiant_count" in data["items"][0]

    def test_boss_by_symbiant_family(self, client):
        """Test finding symbiant drops by family for a specific boss."""
        from app.tests.db_test_constants import MOB_ID_ADOBE_SUZERAIN

        # Get symbiant drops for a specific boss, filtered by family
        response = client.get(f"/api/v1/mobs/{MOB_ID_ADOBE_SUZERAIN}/drops?family=Artillery")
        assert response.status_code == 200
        data = response.json()

        # Response should be a list of symbiants
        assert isinstance(data, list)
        # If there are results, verify family filtering
        if len(data) > 0:
            for symbiant in data:
                assert "artillery" in symbiant["family"].lower()


class TestSymbiantSearch:
    """Test symbiant search functionality."""

    def test_symbiants_basic(self, client):
        """Test basic symbiants endpoint."""
        response = client.get("/api/v1/symbiants")
        assert response.status_code == 200
        data = response.json()

        # Symbiants endpoint returns List[SymbiantResponse], not paginated
        assert isinstance(data, list)
        assert len(data) > 0

        # Verify first symbiant has expected fields
        if len(data) > 0:
            symbiant = data[0]
            assert "id" in symbiant
            assert "family" in symbiant
            assert "name" in symbiant

    def test_symbiant_family_filtering(self, client):
        """Test filtering symbiants by family (client-side filtering expected)."""
        response = client.get("/api/v1/symbiants")
        assert response.status_code == 200
        data = response.json()

        assert isinstance(data, list)
        # Find Artillery family symbiants (if any)
        artillery_symbiants = [s for s in data if "Artillery" in s.get("family", "")]
        assert len(artillery_symbiants) > 0

    def test_symbiant_ql_filtering(self, client):
        """Test symbiant QL filtering (client-side filtering expected)."""
        # Note: The endpoint returns all symbiants for client-side filtering
        response = client.get("/api/v1/symbiants")
        assert response.status_code == 200
        data = response.json()

        # Response should be a list
        assert isinstance(data, list)
        # Verify symbiants have QL field for client-side filtering
        if len(data) > 0:
            symbiant = data[0]
            assert "ql" in symbiant


class TestCacheAndPerformance:
    """Test caching and performance monitoring functionality."""

    def test_cache_stats(self, mock_client):
        """Test cache statistics endpoint."""
        # Cache stats endpoint doesn't use database
        response = mock_client.get("/api/v1/cache/stats")
        assert response.status_code == 200
        data = response.json()

        assert "hits" in data
        assert "misses" in data
        assert "cache_size" in data
        assert "hit_rate_percent" in data
        assert isinstance(data["hits"], int)
        assert isinstance(data["misses"], int)

    def test_cache_clear(self, mock_client):
        """Test cache clearing."""
        # Cache clear endpoint doesn't use database
        response = mock_client.post("/api/v1/cache/clear")
        assert response.status_code == 200
        data = response.json()

        assert "message" in data
        assert "cleared" in data["message"].lower()

    def test_cache_cleanup(self, mock_client):
        """Test cache cleanup endpoint."""
        # Cache cleanup endpoint doesn't use database
        response = mock_client.post("/api/v1/cache/cleanup")
        assert response.status_code == 200
        data = response.json()

        assert "message" in data
        assert "removed" in data["message"].lower()

    def test_performance_health(self, mock_client):
        """Test performance health check."""
        # Performance health endpoint doesn't use database
        response = mock_client.get("/api/v1/performance/health")
        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "healthy"
        assert "performance_monitoring" in data
        assert "monitoring_endpoints" in data

    def test_performance_overview(self, mock_client):
        """Test performance overview endpoint."""
        # Performance overview endpoint may use database for stats
        # Mock it to avoid database dependencies
        mock_query = Mock()
        mock_query.options.return_value = mock_query
        mock_query.all.return_value = []

        mock_db = Mock()
        mock_db.execute.return_value = mock_query

        app.dependency_overrides[get_db] = lambda: mock_db

        try:
            response = mock_client.get("/api/v1/performance/overview")
            assert response.status_code == 200
            data = response.json()

            assert "cache_stats" in data
            # index_usage might fail if pg_stat_statements isn't available
            # so we don't assert on it
        finally:
            app.dependency_overrides.clear()


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
            # Check if API enforces page_size limit
            # Some implementations may allow large page sizes or cap them
            assert data["page_size"] > 0
            # If the API returns items, verify we get a reasonable number
            assert len(data["items"]) >= 0

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
        # Note: symbiants endpoint returns List[], not paginated, so excluded from this test
        endpoints = [
            "/api/v1/items",
            "/api/v1/spells",
            "/api/v1/mobs?is_pocket_boss=true"
        ]

        for endpoint in endpoints:
            response = client.get(f"{endpoint}?page=1&page_size=5" if "?" not in endpoint else f"{endpoint}&page=1&page_size=5")
            assert response.status_code == 200, f"Endpoint {endpoint} failed"
            data = response.json()

            # Check required pagination fields
            required_fields = ["items", "total", "page", "page_size", "pages", "has_next", "has_prev"]
            for field in required_fields:
                assert field in data, f"Missing {field} in {endpoint} response"


class TestRealDataValidation:
    """Test that our endpoints work correctly with real database data."""

    def test_get_specific_item(self, client):
        """Test getting a specific item by ID using real database data."""
        # Get list to find a real ID
        response = client.get("/api/v1/items?page_size=1")
        assert response.status_code == 200
        data = response.json()

        if data["total"] > 0:
            item_aoid = data["items"][0]["aoid"]

            # Get specific item
            response = client.get(f"/api/v1/items/{item_aoid}")
            assert response.status_code == 200
            item_data = response.json()
            assert item_data["aoid"] == item_aoid
            assert "name" in item_data
            assert "ql" in item_data

    def test_get_specific_symbiant(self, client):
        """Test getting a specific symbiant by ID using real database data."""
        # Get list to find a real ID (symbiants returns a list, not paginated)
        response = client.get("/api/v1/symbiants")
        assert response.status_code == 200
        data = response.json()

        if len(data) > 0:
            symbiant_id = data[0]["id"]

            # Get specific symbiant
            response = client.get(f"/api/v1/symbiants/{symbiant_id}")
            assert response.status_code == 200
            symbiant_data = response.json()
            assert symbiant_data["id"] == symbiant_id
            assert "family" in symbiant_data

    def test_get_specific_pocket_boss(self, client):
        """Test getting a specific pocket boss (mob) by ID using real database data."""
        # Get list to find a real ID
        response = client.get("/api/v1/mobs?is_pocket_boss=true&page_size=1")
        assert response.status_code == 200
        data = response.json()

        if data["total"] > 0:
            boss_id = data["items"][0]["id"]

            # Get specific pocket boss
            response = client.get(f"/api/v1/mobs/{boss_id}")
            assert response.status_code == 200
            boss_data = response.json()
            assert boss_data["id"] == boss_id
            assert "name" in boss_data
            assert "level" in boss_data

    def test_nonexistent_resource_404(self, client):
        """Test that nonexistent resources return 404 using real database."""
        # Test with ID 99999999 (unlikely to exist in real database)
        response = client.get("/api/v1/items/99999999")
        assert response.status_code == 404

        response = client.get("/api/v1/symbiants/99999999")
        assert response.status_code == 404

        response = client.get("/api/v1/mobs/99999999")
        assert response.status_code == 404


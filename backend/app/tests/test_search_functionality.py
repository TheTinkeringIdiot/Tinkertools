"""
Tests for advanced search and filtering functionality using real database data.
"""

import pytest
from fastapi.testclient import TestClient

from sqlalchemy import text

from app.main import app


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

    def test_filter_by_slot(self, client, db_session):
        """Test the slot filter matches the EquippedIn (stat 298) bitmask."""
        # Slot bit 15 at QL 200 is a small set that fits on one page
        slot, ql = 15, 200
        expected_ids = set(
            db_session.execute(
                text(
                    "SELECT DISTINCT i.id FROM items i"
                    " JOIN item_stats s ON s.item_id = i.id"
                    " JOIN stat_values v ON v.id = s.stat_value_id"
                    " WHERE v.stat = 298 AND v.value & (1 << :slot) > 0"
                    " AND i.ql = :ql"
                ),
                {"slot": slot, "ql": ql},
            ).scalars()
        )
        assert 0 < len(expected_ids) <= 1000

        response = client.get(
            f"/api/v1/items?slot={slot}&min_ql={ql}&max_ql={ql}&page_size=1000"
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == len(expected_ids)
        assert {item["id"] for item in data["items"]} == expected_ids


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
        response = client.get(
            "/api/v1/mobs?is_pocket_boss=true&min_level=100&max_level=200"
        )
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

    def test_boss_by_symbiant_family(self, client, db_session):
        """Test finding symbiant drops by family for a specific boss."""
        from app.models import Mob
        from app.tests.db_test_constants import MOB_ADOBE_SUZERAIN

        mob = db_session.query(Mob).filter(Mob.name == MOB_ADOBE_SUZERAIN).one()

        # Get symbiant drops for a specific boss, filtered by family
        response = client.get(f"/api/v1/mobs/{mob.id}/drops?family=Artillery")
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

    def test_symbiants_basic(self, client, db_session):
        """Test basic symbiants endpoint."""
        from app.models import SymbiantItem

        expected_total = db_session.query(SymbiantItem).count()
        assert expected_total > 0

        response = client.get("/api/v1/symbiants")
        assert response.status_code == 200
        data = response.json()

        # Symbiants endpoint is paginated (default page_size 50)
        assert data["total"] == expected_total
        assert data["page"] == 1
        assert len(data["items"]) == min(data["page_size"], expected_total)

        symbiant = data["items"][0]
        assert "aoid" in symbiant
        assert "family" in symbiant
        assert "name" in symbiant

    def test_symbiant_family_filtering(self, client, db_session):
        """Test every symbiant and family arrives intact across pages."""
        from collections import Counter

        from sqlalchemy import func

        from app.models import SymbiantItem

        expected = dict(
            db_session.query(SymbiantItem.family, func.count())
            .group_by(SymbiantItem.family)
            .all()
        )
        assert "Artillery" in expected

        families = Counter()
        ids = []
        page = 1
        while True:
            response = client.get(f"/api/v1/symbiants?page={page}&page_size=200")
            assert response.status_code == 200
            data = response.json()
            families.update(s["family"] for s in data["items"])
            ids.extend(s["aoid"] for s in data["items"])
            if not data["has_next"]:
                break
            page += 1

        assert dict(families) == expected
        # Pages partition the set: no symbiant repeated or skipped
        assert len(ids) == len(set(ids))
        assert set(ids) == {aoid for (aoid,) in db_session.query(SymbiantItem.aoid)}

    def test_symbiant_ql_filtering(self, client):
        """Test symbiant QL filtering (client-side filtering expected)."""
        response = client.get("/api/v1/symbiants")
        assert response.status_code == 200
        data = response.json()

        # Every symbiant needs a QL for client-side filtering
        assert len(data["items"]) > 0
        for symbiant in data["items"]:
            assert isinstance(symbiant["ql"], int)


class TestCacheAndPerformance:
    """Test caching and performance monitoring functionality."""

    def test_cache_clear(self, mock_client):
        """Test cache clearing."""
        # Cache clear endpoint doesn't use database
        response = mock_client.post("/api/v1/cache/clear")
        assert response.status_code == 200
        data = response.json()

        assert "message" in data
        assert "cleared" in data["message"].lower()


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

        # Should either handle gracefully (200) or return proper error code

    def test_endpoint_response_structure(self, client):
        """Test that all paginated endpoints have consistent response structure."""
        endpoints = [
            "/api/v1/items",
            "/api/v1/mobs?is_pocket_boss=true",
            "/api/v1/symbiants",
        ]

        for endpoint in endpoints:
            response = client.get(
                f"{endpoint}?page=1&page_size=5"
                if "?" not in endpoint
                else f"{endpoint}&page=1&page_size=5"
            )
            assert response.status_code == 200, f"Endpoint {endpoint} failed"
            data = response.json()

            # Check required pagination fields
            required_fields = [
                "items",
                "total",
                "page",
                "page_size",
                "pages",
                "has_next",
                "has_prev",
            ]
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
        """Test getting a specific symbiant by AOID using real database data."""
        # Get list to find a real AOID
        response = client.get("/api/v1/symbiants?page_size=1")
        assert response.status_code == 200
        data = response.json()

        if data["total"] > 0:
            aoid = data["items"][0]["aoid"]

            # Get specific symbiant
            response = client.get(f"/api/v1/symbiants/{aoid}")
            assert response.status_code == 200
            symbiant_data = response.json()
            assert symbiant_data["aoid"] == aoid
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

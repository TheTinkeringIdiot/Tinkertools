"""
Unit tests for API endpoints.

Request validation is tested without a database. The list and search
endpoints run against the real game data (the shared ``client`` fixture) and are
compared with what the store's loader reads for the same build. The same
routes are tested on controlled data in test_store_read.py and
test_item_search.py.
"""

import math

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, or_, select

from app.main import app
from app.store import tables as t
from app.store.items import load_records, load_sources
from app.store.presence import revisions
from app.tests.db_test_constants import ITEM_PISTOL_MASTERY


class TestGeneralEndpoints:
    """Test cases for general API endpoints (health, root)."""

    @pytest.fixture
    def client(self):
        """Create a test client; these requests are answered without a database."""
        return TestClient(app)

    def test_health_endpoint(self, client):
        """Test health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["status"] == "ok"

    def test_root_endpoint(self, client):
        """Test root endpoint."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "TinkerTools API"
        assert data["version"] == "1.0.0"
        assert "documentation" in data
        assert "health" in data


class TestItemEndpoints:
    """Test cases for item API endpoints."""

    @pytest.fixture
    def client(self):
        """Create a test client; these requests are answered without a database."""
        return TestClient(app)

    # ============================================================================
    # Validation Error Tests
    # ============================================================================

    def test_error_handling_validation(self, client):
        """Test validation error handling."""
        response = client.get("/api/v1/items?page=-1")
        assert response.status_code == 422
        data = response.json()
        assert "error" in data
        assert data["code"] == "VALIDATION_ERROR"

    def test_search_items_min_query_length(self, client):
        """Test search requires minimum query length."""
        response = client.get("/api/v1/items/search?q=")
        assert response.status_code == 422  # Validation error


class TestItemListAndSearchEndpoints:
    """Test cases for the item list and search endpoints against real data."""

    @pytest.fixture
    def pistol_mastery(self, store_db, build):
        """Pistol Mastery: a real item with stats, spell data and actions."""
        (record,) = load_records(store_db, build, aoids=[ITEM_PISTOL_MASTERY])
        return record

    @pytest.fixture
    def sources(self, store_db, build, pistol_mastery):
        """The sources the build serves for Pistol Mastery."""
        aoid = pistol_mastery.aoid
        return load_sources(store_db, build, [aoid]).get(aoid, [])

    # ============================================================================
    # GET /api/v1/items Tests
    # ============================================================================

    def test_get_items_empty(self, client):
        """Test getting items when no items match criteria."""
        response = client.get("/api/v1/items?min_ql=100000")

        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0
        assert data["page"] == 1
        assert data["pages"] == 1
        assert data["has_next"] is False
        assert data["has_prev"] is False

    def test_get_items_with_filters(self, client, store_db, build):
        """Test item filtering with query parameters."""
        revision = t.item_revision
        matching = revisions(build).where(
            revision.c.item_class == 1, revision.c.ql >= 100, revision.c.ql <= 200
        )
        expected_total = store_db.execute(
            select(func.count()).select_from(matching.subquery())
        ).scalar_one()
        assert expected_total > 0

        response = client.get(
            "/api/v1/items?item_class=1&min_ql=100&max_ql=200&page_size=100"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == expected_total
        assert len(data["items"]) == min(100, expected_total)
        for item in data["items"]:
            assert item["item_class"] == 1
            assert 100 <= item["ql"] <= 200

    def test_get_items_returns_detailed_items(self, client, pistol_mastery, sources):
        """Test that the items list endpoint returns detailed item information."""
        response = client.get(
            f"/api/v1/items?min_ql={pistol_mastery.ql}&max_ql={pistol_mastery.ql}"
            "&page_size=1000"
        )

        assert response.status_code == 200
        items = {item["aoid"]: item for item in response.json()["items"]}
        assert pistol_mastery.aoid in items
        self._assert_matches_store(items[pistol_mastery.aoid], pistol_mastery, sources)

    # ============================================================================
    # GET /api/v1/items/{aoid} Tests
    # ============================================================================

    def test_get_item_returns_the_item_with_its_related_data(
        self, client, pistol_mastery, sources
    ):
        """Item detail carries every part the store holds for the item."""
        response = client.get(f"/api/v1/items/{pistol_mastery.aoid}")

        assert response.status_code == 200
        data = response.json()
        assert data["aoid"] == pistol_mastery.aoid
        assert data["stats"] and data["spell_data"] and data["sources"]
        self._assert_matches_store(data, pistol_mastery, sources)

    def test_get_item_not_found(self, client):
        response = client.get("/api/v1/items/999999999")

        assert response.status_code == 404
        assert response.json() == {"error": "Item not found", "code": "HTTP_404"}

    # ============================================================================
    # GET /api/v1/items/search Tests
    # ============================================================================

    def test_search_items_success(self, client, pistol_mastery):
        """Test item search finds a real item by name."""
        response = client.get(f"/api/v1/items/search?q={pistol_mastery.name}")

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert all(
            pistol_mastery.name.lower() in item["name"].lower()
            or pistol_mastery.name.lower() in (item["description"] or "").lower()
            for item in data["items"]
        )
        assert pistol_mastery.aoid in [item["aoid"] for item in data["items"]]

    def test_search_items_returns_detailed_items(self, client, pistol_mastery, sources):
        """Test that the item search endpoint returns detailed item information."""
        response = client.get(
            f"/api/v1/items/search?q={pistol_mastery.name}&page_size=1000"
        )

        assert response.status_code == 200
        items = {item["aoid"]: item for item in response.json()["items"]}
        assert pistol_mastery.aoid in items
        self._assert_matches_store(items[pistol_mastery.aoid], pistol_mastery, sources)

    def test_pagination(self, client, store_db, build, pistol_mastery):
        """Test that search pages partition the full result set."""
        # The term matches several items sharing a name ("Nano Can: Pistol
        # Mastery"), so pages only partition cleanly with a unique sort order
        term = pistol_mastery.name
        text = t.part_text
        expected_aoids = set(
            store_db.execute(
                revisions(build, t.item_revision.c.aoid)
                .join(text, text.c.text_id == t.item_revision.c.text_id)
                .where(
                    or_(
                        text.c.name.ilike(f"%{term}%"),
                        text.c.description.ilike(f"%{term}%"),
                    )
                )
            ).scalars()
        )
        page_size = 5
        expected_pages = math.ceil(len(expected_aoids) / page_size)
        assert expected_pages > 1

        seen_aoids = []
        for page in range(1, expected_pages + 1):
            response = client.get(
                f"/api/v1/items/search?q={term}&page={page}&page_size={page_size}"
            )
            assert response.status_code == 200
            data = response.json()
            assert data["total"] == len(expected_aoids)
            assert data["pages"] == expected_pages
            assert data["has_prev"] is (page > 1)
            assert data["has_next"] is (page < expected_pages)
            seen_aoids.extend(item["aoid"] for item in data["items"])

        assert len(seen_aoids) == len(set(seen_aoids))
        assert set(seen_aoids) == expected_aoids

    def test_search_with_exact_match_parameter(self, client, pistol_mastery):
        """Test search with exact_match parameter."""
        for exact_match in ("true", "false"):
            response = client.get(
                f"/api/v1/items/search?q={pistol_mastery.name}"
                f"&exact_match={exact_match}&page_size=1000"
            )
            assert response.status_code == 200
            aoids = [item["aoid"] for item in response.json()["items"]]
            assert pistol_mastery.aoid in aoids

    @staticmethod
    def _assert_matches_store(item_json, record, sources):
        """Check an ItemDetail payload against the item the store holds."""
        assert item_json["name"] == record.name
        assert item_json["ql"] == record.ql
        assert len(item_json["stats"]) == len(record.stats)
        assert len(item_json["spell_data"]) == len(record.effects)
        assert len(item_json["actions"]) == len(record.actions)
        assert len(item_json["sources"]) == len(sources)
        assert len(item_json["attack_stats"]) == len(record.attack)
        assert len(item_json["defense_stats"]) == len(record.defense)

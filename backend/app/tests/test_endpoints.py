"""
Unit tests for API endpoints.

Single-item endpoint tests mock the database session to validate HTTP
request/response handling. The list and search endpoints build multi-step
queries that mocks cannot follow faithfully, so they run against the real
database with transaction rollback (the shared ``client`` fixture).
"""

import math

import pytest
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import get_db
from app.models import Item
from app.tests.db_test_constants import ITEM_PISTOL_MASTERY
from app.api.schemas import (
    ItemDetail,
    StatValueResponse,
    SpellDataResponse,
    ActionResponse,
    CriterionResponse,
    SpellWithCriteria,
)


class TestGeneralEndpoints:
    """Test cases for general API endpoints (health, root)."""

    @pytest.fixture
    def client(self):
        """Create a test client with mocked database dependency."""

        def override_get_db():
            return Mock(spec=Session)

        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)
        yield client
        app.dependency_overrides.clear()

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
        """Create a test client with mocked database dependency."""

        def override_get_db():
            return Mock(spec=Session)

        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)
        yield client
        app.dependency_overrides.clear()

    @pytest.fixture
    def mock_item_detail(self):
        """Create a mock ItemDetail response."""
        return ItemDetail(
            id=1,
            aoid=12345,
            name="Test Weapon",
            ql=200,
            item_class=1,
            description="A test weapon",
            is_nano=False,
            stats=[StatValueResponse(id=1, stat=16, value=50)],
            spell_data=[
                SpellDataResponse(
                    id=1,
                    event=1,
                    spells=[
                        SpellWithCriteria(
                            id=1,
                            target=1,
                            tick_count=None,
                            tick_interval=None,
                            spell_id=98765,
                            spell_format="Increase {stat} by {value}",
                            spell_params={"stat": 96, "value": 15},
                            criteria=[],
                        )
                    ],
                )
            ],
            attack_stats=[StatValueResponse(id=2, stat=100, value=200)],
            defense_stats=[StatValueResponse(id=3, stat=101, value=150)],
            actions=[
                ActionResponse(
                    id=1,
                    action=1,
                    item_id=1,
                    criteria=[
                        CriterionResponse(id=1, value1=16, value2=100, operator=1)
                    ],
                )
            ],
            sources=[],
        )

    @pytest.fixture
    def mock_enhanced_item_detail(self):
        """Create a mock ItemDetail with all fields populated."""
        return ItemDetail(
            id=2,
            aoid=54321,
            name="Enhanced Test Weapon",
            ql=150,
            item_class=1,
            description="A comprehensive test weapon",
            is_nano=False,
            stats=[
                StatValueResponse(id=4, stat=16, value=50),  # Strength
                StatValueResponse(id=5, stat=17, value=25),  # Intelligence
            ],
            spell_data=[
                SpellDataResponse(
                    id=2,
                    event=1,
                    spells=[
                        SpellWithCriteria(
                            id=2,
                            target=1,
                            tick_count=None,
                            tick_interval=None,
                            spell_id=98765,
                            spell_format="Increase {stat} by {value}",
                            spell_params={"stat": 96, "value": 15},
                            criteria=[],
                        )
                    ],
                )
            ],
            attack_stats=[StatValueResponse(id=6, stat=100, value=200)],
            defense_stats=[StatValueResponse(id=7, stat=101, value=150)],
            actions=[
                ActionResponse(
                    id=2,
                    action=1,
                    item_id=2,
                    criteria=[
                        CriterionResponse(id=2, value1=16, value2=100, operator=1)
                    ],
                )
            ],
            sources=[],
        )

    # ============================================================================
    # GET /api/v1/items/{aoid} Tests
    # ============================================================================

    @patch("app.api.routes.items.build_item_detail")
    def test_get_item_by_aoid_success(
        self, mock_build_item_detail, client, mock_item_detail
    ):
        """Test getting a specific item by AOID."""
        mock_build_item_detail.return_value = mock_item_detail

        # Mock the database query to return an item
        mock_item = Mock()
        mock_item.aoid = 12345

        with patch("app.core.database.get_db") as mock_get_db:
            mock_db = Mock()
            mock_query = Mock()
            mock_query.options.return_value.filter.return_value.first.return_value = (
                mock_item
            )
            mock_db.query.return_value = mock_query
            mock_get_db.return_value = mock_db

            # Override get_db for this test
            def override_get_db():
                yield mock_db

            app.dependency_overrides[get_db] = override_get_db

            response = client.get("/api/v1/items/12345")

            app.dependency_overrides.clear()

            assert response.status_code == 200
            data = response.json()
            assert data["name"] == "Test Weapon"
            assert data["aoid"] == 12345

            # Check that all required fields are present
            assert "stats" in data
            assert "spell_data" in data
            assert "attack_stats" in data
            assert "defense_stats" in data
            assert "actions" in data

            # Verify they are lists
            assert isinstance(data["stats"], list)
            assert isinstance(data["spell_data"], list)
            assert isinstance(data["attack_stats"], list)
            assert isinstance(data["defense_stats"], list)
            assert isinstance(data["actions"], list)

    def test_get_item_not_found(self, client):
        """Test getting non-existent item."""
        # Mock the database query to return None
        with patch("app.core.database.get_db") as mock_get_db:
            mock_db = Mock()
            mock_query = Mock()
            mock_query.options.return_value.filter.return_value.first.return_value = (
                None
            )
            mock_db.query.return_value = mock_query
            mock_get_db.return_value = mock_db

            # Override get_db for this test
            def override_get_db():
                yield mock_db

            app.dependency_overrides[get_db] = override_get_db

            response = client.get("/api/v1/items/999")

            app.dependency_overrides.clear()

            assert response.status_code == 404
            data = response.json()
            assert "error" in data

    @patch("app.api.routes.items.build_item_detail")
    def test_get_item_with_all_fields(
        self, mock_build_item_detail, client, mock_enhanced_item_detail
    ):
        """Test getting an item with all fields populated."""
        mock_build_item_detail.return_value = mock_enhanced_item_detail

        # Mock the database query to return an item
        mock_item = Mock()
        mock_item.aoid = 54321

        with patch("app.core.database.get_db") as mock_get_db:
            mock_db = Mock()
            mock_query = Mock()
            mock_query.options.return_value.filter.return_value.first.return_value = (
                mock_item
            )
            mock_db.query.return_value = mock_query
            mock_get_db.return_value = mock_db

            # Override get_db for this test
            def override_get_db():
                yield mock_db

            app.dependency_overrides[get_db] = override_get_db

            response = client.get("/api/v1/items/54321")

            app.dependency_overrides.clear()

            assert response.status_code == 200
            data = response.json()

            # Basic item info
            assert data["name"] == "Enhanced Test Weapon"
            assert data["aoid"] == 54321
            assert data["ql"] == 150
            assert data["item_class"] == 1
            assert data["is_nano"] is False

            # Test stats (should have 2 stats)
            assert len(data["stats"]) == 2
            stat_values = [stat["value"] for stat in data["stats"]]
            assert 50 in stat_values  # Strength
            assert 25 in stat_values  # Intelligence

            # Test spell data (should have 1 spell data with 1 spell)
            assert len(data["spell_data"]) == 1
            spell_data = data["spell_data"][0]
            assert spell_data["event"] == 1
            assert len(spell_data["spells"]) == 1

            spell = spell_data["spells"][0]
            assert spell["spell_id"] == 98765
            assert spell["spell_format"] == "Increase {stat} by {value}"
            assert spell["spell_params"]["stat"] == 96
            assert spell["spell_params"]["value"] == 15

            # Test attack/defense stats
            assert len(data["attack_stats"]) == 1
            assert len(data["defense_stats"]) == 1
            assert data["attack_stats"][0]["value"] == 200
            assert data["defense_stats"][0]["value"] == 150

            # Test actions (should have 1 action with 1 criterion)
            assert len(data["actions"]) == 1
            action = data["actions"][0]
            assert action["action"] == 1
            assert len(action["criteria"]) == 1

            criterion = action["criteria"][0]
            assert criterion["value1"] == 16  # Strength stat
            assert criterion["value2"] == 100  # Required value
            assert criterion["operator"] == 1  # >= operator

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
    def pistol_mastery(self, db_session):
        """Pistol Mastery: a real item with stats, spell data and actions."""
        return db_session.query(Item).filter(Item.aoid == ITEM_PISTOL_MASTERY).one()

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

    def test_get_items_with_filters(self, client, db_session):
        """Test item filtering with query parameters."""
        expected_total = (
            db_session.query(Item)
            .filter(Item.item_class == 1, Item.ql >= 100, Item.ql <= 200)
            .count()
        )
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

    def test_get_items_returns_detailed_items(self, client, pistol_mastery):
        """Test that the items list endpoint returns detailed item information."""
        response = client.get(
            f"/api/v1/items?min_ql={pistol_mastery.ql}&max_ql={pistol_mastery.ql}"
            "&page_size=1000"
        )

        assert response.status_code == 200
        items = {item["aoid"]: item for item in response.json()["items"]}
        assert pistol_mastery.aoid in items
        self._assert_matches_db(items[pistol_mastery.aoid], pistol_mastery)

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

    def test_search_items_returns_detailed_items(self, client, pistol_mastery):
        """Test that the item search endpoint returns detailed item information."""
        response = client.get(
            f"/api/v1/items/search?q={pistol_mastery.name}&page_size=1000"
        )

        assert response.status_code == 200
        items = {item["aoid"]: item for item in response.json()["items"]}
        assert pistol_mastery.aoid in items
        self._assert_matches_db(items[pistol_mastery.aoid], pistol_mastery)

    def test_pagination(self, client, db_session, pistol_mastery):
        """Test pagination functionality."""
        term = pistol_mastery.name
        expected_total = (
            db_session.query(Item)
            .filter(
                or_(Item.name.ilike(f"%{term}%"), Item.description.ilike(f"%{term}%"))
            )
            .count()
        )
        page_size = 5
        assert expected_total > page_size

        first = client.get(f"/api/v1/items/search?q={term}&page=1&page_size=5")
        assert first.status_code == 200
        data = first.json()
        assert data["total"] == expected_total
        assert data["pages"] == math.ceil(expected_total / page_size)
        assert len(data["items"]) == page_size
        assert data["has_next"] is True
        assert data["has_prev"] is False

        second = client.get(f"/api/v1/items/search?q={term}&page=2&page_size=5")
        assert second.status_code == 200
        second_data = second.json()
        assert second_data["has_prev"] is True
        first_ids = {item["id"] for item in data["items"]}
        assert first_ids.isdisjoint(item["id"] for item in second_data["items"])

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
    def _assert_matches_db(item_json, item):
        """Check an ItemDetail payload against the item's database rows."""
        assert item_json["name"] == item.name
        assert item_json["ql"] == item.ql
        assert len(item_json["stats"]) == len(item.item_stats)
        assert len(item_json["spell_data"]) == len(item.item_spell_data)
        assert len(item_json["actions"]) == len(item.actions)
        assert len(item_json["sources"]) == len(item.item_sources)
        attack_defense = item.attack_defense
        assert len(item_json["attack_stats"]) == (
            len(attack_defense.attack_stats) if attack_defense else 0
        )
        assert len(item_json["defense_stats"]) == (
            len(attack_defense.defense_stats) if attack_defense else 0
        )

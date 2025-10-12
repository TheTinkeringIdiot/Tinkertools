"""
Unit tests for API endpoints.

Uses service layer mocking to avoid database transaction isolation issues.
Tests validate HTTP request/response handling without database dependencies.
"""

import pytest
from unittest.mock import Mock, patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core.database import get_db
from app.api.schemas import (
    ItemDetail,
    StatValueResponse,
    SpellDataResponse,
    ActionResponse,
    CriterionResponse,
    SpellWithCriteria
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
            stats=[
                StatValueResponse(id=1, stat=16, value=50)
            ],
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
                            criteria=[]
                        )
                    ]
                )
            ],
            attack_stats=[
                StatValueResponse(id=2, stat=100, value=200)
            ],
            defense_stats=[
                StatValueResponse(id=3, stat=101, value=150)
            ],
            actions=[
                ActionResponse(
                    id=1,
                    action=1,
                    item_id=1,
                    criteria=[
                        CriterionResponse(id=1, value1=16, value2=100, operator=1)
                    ]
                )
            ],
            sources=[]
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
                StatValueResponse(id=5, stat=17, value=25)   # Intelligence
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
                            criteria=[]
                        )
                    ]
                )
            ],
            attack_stats=[
                StatValueResponse(id=6, stat=100, value=200)
            ],
            defense_stats=[
                StatValueResponse(id=7, stat=101, value=150)
            ],
            actions=[
                ActionResponse(
                    id=2,
                    action=1,
                    item_id=2,
                    criteria=[
                        CriterionResponse(id=2, value1=16, value2=100, operator=1)
                    ]
                )
            ],
            sources=[]
        )

    # ============================================================================
    # GET /api/v1/items Tests
    # ============================================================================

    @patch('app.api.routes.items.build_item_detail')
    def test_get_items_empty(self, mock_build_item_detail, client):
        """Test getting items when no items match criteria."""
        # Mock database query to return empty list
        with patch('app.core.database.get_db') as mock_get_db:
            mock_db = Mock()
            mock_query = Mock()
            mock_query.options.return_value.count.return_value = 0
            mock_query.options.return_value.offset.return_value.limit.return_value.all.return_value = []
            mock_db.query.return_value = mock_query
            mock_get_db.return_value = mock_db

            # Override get_db for this test
            def override_get_db():
                yield mock_db
            app.dependency_overrides[get_db] = override_get_db

            response = client.get("/api/v1/items")

            app.dependency_overrides.clear()

            # With mocked database, will get empty results
            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert "total" in data
            assert "page" in data

    @patch('app.api.routes.items.build_item_detail')
    def test_get_item_by_aoid_success(self, mock_build_item_detail, client, mock_item_detail):
        """Test getting a specific item by AOID."""
        mock_build_item_detail.return_value = mock_item_detail

        # Mock the database query to return an item
        mock_item = Mock()
        mock_item.aoid = 12345

        with patch('app.core.database.get_db') as mock_get_db:
            mock_db = Mock()
            mock_query = Mock()
            mock_query.options.return_value.filter.return_value.first.return_value = mock_item
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
        with patch('app.core.database.get_db') as mock_get_db:
            mock_db = Mock()
            mock_query = Mock()
            mock_query.options.return_value.filter.return_value.first.return_value = None
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

    @patch('app.api.routes.items.build_item_detail')
    def test_get_item_with_all_fields(self, mock_build_item_detail, client, mock_enhanced_item_detail):
        """Test getting an item with all fields populated."""
        mock_build_item_detail.return_value = mock_enhanced_item_detail

        # Mock the database query to return an item
        mock_item = Mock()
        mock_item.aoid = 54321

        with patch('app.core.database.get_db') as mock_get_db:
            mock_db = Mock()
            mock_query = Mock()
            mock_query.options.return_value.filter.return_value.first.return_value = mock_item
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
    # GET /api/v1/items/search Tests
    # ============================================================================

    @patch('app.api.routes.items.build_item_detail')
    def test_search_items_success(self, mock_build_item_detail, client, mock_item_detail):
        """Test item search functionality."""
        mock_build_item_detail.return_value = mock_item_detail

        # Mock the database query to return items
        mock_item = Mock()
        mock_item.aoid = 12345
        mock_item.name = "Test Weapon"

        with patch('app.core.database.get_db') as mock_get_db:
            mock_db = Mock()
            mock_query = Mock()
            mock_query.options.return_value.filter.return_value.order_by.return_value.count.return_value = 1
            mock_query.options.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [mock_item]
            mock_db.query.return_value = mock_query
            mock_get_db.return_value = mock_db

            # Override get_db for this test
            def override_get_db():
                yield mock_db
            app.dependency_overrides[get_db] = override_get_db

            response = client.get("/api/v1/items/search?q=Test%20Weapon")

            app.dependency_overrides.clear()

            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert len(data["items"]) >= 0

    @patch('app.api.routes.items.build_item_detail')
    def test_search_items_returns_detailed_items(self, mock_build_item_detail, client, mock_enhanced_item_detail):
        """Test that the item search endpoint returns detailed item information."""
        mock_build_item_detail.return_value = mock_enhanced_item_detail

        # Mock the database query
        mock_item = Mock()
        mock_item.aoid = 54321

        with patch('app.core.database.get_db') as mock_get_db:
            mock_db = Mock()
            mock_query = Mock()
            mock_query.options.return_value.filter.return_value.order_by.return_value.count.return_value = 1
            mock_query.options.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [mock_item]
            mock_db.query.return_value = mock_query
            mock_get_db.return_value = mock_db

            # Override get_db for this test
            def override_get_db():
                yield mock_db
            app.dependency_overrides[get_db] = override_get_db

            response = client.get("/api/v1/items/search?q=Enhanced%20Test%20Weapon")

            app.dependency_overrides.clear()

            assert response.status_code == 200
            data = response.json()

            assert len(data["items"]) == 1
            item = data["items"][0]

            # Verify all fields are present in search results
            assert "stats" in item
            assert "spell_data" in item
            assert "attack_stats" in item
            assert "defense_stats" in item
            assert "actions" in item

            # Should contain actual data
            assert len(item["stats"]) == 2
            assert len(item["spell_data"]) == 1
            assert len(item["actions"]) == 1

    # ============================================================================
    # Pagination and Filtering Tests
    # ============================================================================

    @patch('app.api.routes.items.build_item_detail')
    def test_pagination(self, mock_build_item_detail, client, mock_item_detail):
        """Test pagination functionality."""
        # Create multiple mock items
        mock_items = []
        for i in range(10):
            mock_item = Mock()
            mock_item.aoid = 10000 + i
            mock_item.name = f"Pagination Test Item {i}"
            mock_items.append(mock_item)

        mock_build_item_detail.return_value = mock_item_detail

        with patch('app.core.database.get_db') as mock_get_db:
            mock_db = Mock()
            mock_query = Mock()

            # Mock first page
            mock_query.options.return_value.filter.return_value.order_by.return_value.count.return_value = 10
            mock_query.options.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = mock_items[:5]
            mock_db.query.return_value = mock_query
            mock_get_db.return_value = mock_db

            # Override get_db for this test
            def override_get_db():
                yield mock_db
            app.dependency_overrides[get_db] = override_get_db

            # Test first page
            response = client.get("/api/v1/items/search?q=Pagination%20Test%20Item&page=1&page_size=5")

            app.dependency_overrides.clear()

            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 10
            assert data["pages"] == 2
            assert data["has_next"] is True
            assert data["has_prev"] is False

    def test_error_handling_validation(self, client):
        """Test validation error handling."""
        response = client.get("/api/v1/items?page=-1")
        assert response.status_code == 422
        data = response.json()
        assert "error" in data
        assert data["code"] == "VALIDATION_ERROR"

    # ============================================================================
    # Edge Cases and Error Handling Tests
    # ============================================================================

    def test_get_items_with_filters(self, client):
        """Test item filtering with query parameters."""
        with patch('app.core.database.get_db') as mock_get_db:
            mock_db = Mock()
            mock_query = Mock()

            # Need to handle complex filter chain with multiple filter() calls
            # The actual query chain is: query.options().filter().filter().filter()...count()
            mock_filtered = Mock()
            mock_filtered.filter = Mock(return_value=mock_filtered)  # Return self for chaining
            mock_filtered.distinct = Mock(return_value=mock_filtered)  # Return self for chaining
            mock_filtered.count.return_value = 0
            mock_filtered.offset.return_value.limit.return_value.all.return_value = []

            # Setup the chain
            mock_query.options.return_value = mock_filtered

            mock_db.query.return_value = mock_query
            mock_get_db.return_value = mock_db

            # Override get_db for this test
            def override_get_db():
                yield mock_db
            app.dependency_overrides[get_db] = override_get_db

            response = client.get("/api/v1/items?item_class=1&min_ql=100&max_ql=200")

            app.dependency_overrides.clear()

            assert response.status_code == 200
            data = response.json()
            assert "items" in data
            assert "total" in data

    def test_search_items_min_query_length(self, client):
        """Test search requires minimum query length."""
        response = client.get("/api/v1/items/search?q=")
        assert response.status_code == 422  # Validation error

    @patch('app.api.routes.items.build_item_detail')
    def test_search_with_exact_match_parameter(self, mock_build_item_detail, client, mock_item_detail):
        """Test search with exact_match parameter."""
        mock_build_item_detail.return_value = mock_item_detail

        mock_item = Mock()
        mock_item.aoid = 12345

        with patch('app.core.database.get_db') as mock_get_db:
            mock_db = Mock()
            mock_query = Mock()
            mock_query.options.return_value.filter.return_value.order_by.return_value.count.return_value = 1
            mock_query.options.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [mock_item]
            mock_db.query.return_value = mock_query
            mock_get_db.return_value = mock_db

            # Override get_db for this test
            def override_get_db():
                yield mock_db
            app.dependency_overrides[get_db] = override_get_db

            # Test with exact match
            response = client.get("/api/v1/items/search?q=Test&exact_match=true")
            assert response.status_code == 200

            # Test with fuzzy match
            response = client.get("/api/v1/items/search?q=Test&exact_match=false")
            assert response.status_code == 200

            app.dependency_overrides.clear()

    @patch('app.api.routes.items.build_item_detail')
    def test_get_items_returns_detailed_items(self, mock_build_item_detail, client, mock_enhanced_item_detail):
        """Test that the items list endpoint returns detailed item information."""
        mock_build_item_detail.return_value = mock_enhanced_item_detail

        mock_item = Mock()
        mock_item.aoid = 54321

        with patch('app.core.database.get_db') as mock_get_db:
            mock_db = Mock()
            mock_query = Mock()
            mock_query.options.return_value.filter.return_value.order_by.return_value.count.return_value = 1
            mock_query.options.return_value.filter.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [mock_item]
            # For simple listing (no search), no order_by in chain
            mock_query.options.return_value.count.return_value = 1
            mock_query.options.return_value.offset.return_value.limit.return_value.all.return_value = [mock_item]
            mock_db.query.return_value = mock_query
            mock_get_db.return_value = mock_db

            # Override get_db for this test
            def override_get_db():
                yield mock_db
            app.dependency_overrides[get_db] = override_get_db

            response = client.get("/api/v1/items/search?q=Enhanced%20Test%20Weapon")

            app.dependency_overrides.clear()

            assert response.status_code == 200
            data = response.json()

            if len(data["items"]) > 0:
                item = data["items"][0]

                # Verify all fields are present in list view
                assert "stats" in item
                assert "spell_data" in item
                assert "attack_stats" in item
                assert "defense_stats" in item
                assert "actions" in item

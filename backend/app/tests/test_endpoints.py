"""
Unit tests for API endpoints.
"""

import pytest


def test_health_endpoint(client):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data


def test_root_endpoint(client):
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "TinkerTools API"
    assert data["version"] == "1.0.0"


def test_get_items_empty(client):
    """Test getting items when database is empty."""
    response = client.get("/api/v1/items")
    assert response.status_code == 200
    data = response.json()
    assert data["items"] == []
    assert data["total"] == 0
    assert data["page"] == 1


def test_get_items_with_data(client, sample_item):
    """Test getting items with data."""
    response = client.get("/api/v1/items")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["name"] == "Test Weapon"
    assert data["total"] == 1


def test_get_item_by_aoid(client, sample_item):
    """Test getting a specific item by AOID."""
    response = client.get(f"/api/v1/items/{sample_item.aoid}")
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
    
    # Verify they are lists (even if empty)
    assert isinstance(data["stats"], list)
    assert isinstance(data["spell_data"], list)
    assert isinstance(data["attack_stats"], list)
    assert isinstance(data["defense_stats"], list)
    assert isinstance(data["actions"], list)


def test_get_item_not_found(client):
    """Test getting non-existent item."""
    response = client.get("/api/v1/items/999")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data


def test_search_items(client, sample_item):
    """Test item search functionality."""
    response = client.get("/api/v1/items/search?q=Test")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["name"] == "Test Weapon"


def test_get_symbiants(client, sample_symbiant):
    """Test getting symbiants."""
    response = client.get("/api/v1/symbiants")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["name"] == "Test Symbiant"


def test_get_symbiant_by_id(client, sample_symbiant):
    """Test getting a specific symbiant."""
    response = client.get(f"/api/v1/symbiants/{sample_symbiant.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Symbiant"
    assert data["family"] == "Artillery"


def test_get_pocket_bosses(client, sample_pocket_boss):
    """Test getting pocket bosses."""
    response = client.get("/api/v1/pocket-bosses")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["name"] == "Test Boss"


def test_get_pocket_boss_by_id(client, sample_pocket_boss):
    """Test getting a specific pocket boss."""
    response = client.get(f"/api/v1/pocket-bosses/{sample_pocket_boss.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Boss"
    assert data["level"] == 200


def test_pagination(client, db_session):
    """Test pagination functionality."""
    from app.models import Item
    
    # Create multiple items
    for i in range(10):
        item = Item(
            aoid=10000 + i,
            name=f"Item {i}",
            ql=100 + i
        )
        db_session.add(item)
    db_session.commit()
    
    # Test first page
    response = client.get("/api/v1/items?page=1&page_size=5")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 5
    assert data["total"] == 10
    assert data["pages"] == 2
    assert data["has_next"] is True
    assert data["has_prev"] is False
    
    # Test second page
    response = client.get("/api/v1/items?page=2&page_size=5")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 5
    assert data["has_next"] is False
    assert data["has_prev"] is True


def test_error_handling_validation(client):
    """Test validation error handling."""
    response = client.get("/api/v1/items?page=-1")
    assert response.status_code == 422
    data = response.json()
    assert "error" in data
    assert data["code"] == "VALIDATION_ERROR"


def test_get_item_with_all_fields(client, sample_item_with_all_fields):
    """Test getting an item with all fields populated."""
    item = sample_item_with_all_fields
    response = client.get(f"/api/v1/items/{item.aoid}")
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
    


def test_get_items_returns_detailed_items(client, sample_item_with_all_fields):
    """Test that the items list endpoint returns detailed item information."""
    response = client.get("/api/v1/items")
    assert response.status_code == 200
    data = response.json()
    
    assert len(data["items"]) == 1
    item = data["items"][0]
    
    # Verify all fields are present in list view too
    assert "stats" in item
    assert "spell_data" in item
    assert "attack_stats" in item
    assert "defense_stats" in item
    assert "actions" in item
    
    # Should contain actual data
    assert len(item["stats"]) == 2
    assert len(item["spell_data"]) == 1
    assert len(item["actions"]) == 1


def test_search_items_returns_detailed_items(client, sample_item_with_all_fields):
    """Test that the item search endpoint returns detailed item information."""
    response = client.get("/api/v1/items/search?q=Enhanced")
    assert response.status_code == 200
    data = response.json()
    
    assert len(data["items"]) == 1
    item = data["items"][0]
    
    # Verify all fields are present in search results too
    assert "stats" in item
    assert "spell_data" in item
    assert "attack_stats" in item
    assert "defense_stats" in item
    assert "actions" in item
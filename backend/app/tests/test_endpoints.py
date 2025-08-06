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


def test_get_item_by_id(client, sample_item):
    """Test getting a specific item by ID."""
    response = client.get(f"/api/v1/items/{sample_item.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Weapon"
    assert data["aoid"] == 12345


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
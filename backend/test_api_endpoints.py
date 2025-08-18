"""
Test the new advanced search API endpoints
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_search_with_ql_filters():
    """Test search with quality level filters"""
    response = client.get("/api/v1/items/search?q=implant&min_ql=100&max_ql=200")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data

def test_search_with_item_class():
    """Test search with item class filter"""
    response = client.get("/api/v1/items/search?q=weapon&item_class=1")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data

def test_search_with_froob_friendly():
    """Test search with froob friendly filter"""
    response = client.get("/api/v1/items/search?q=implant&froob_friendly=true")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data

def test_search_with_stat_bonuses():
    """Test search with stat bonuses filter"""
    response = client.get("/api/v1/items/search?q=implant&stat_bonuses=16,17")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data

def test_search_with_multiple_filters():
    """Test search with multiple filters combined"""
    response = client.get("/api/v1/items/search?q=implant&min_ql=100&item_class=3&froob_friendly=true")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data

def test_items_endpoint_with_new_filters():
    """Test the regular items endpoint with new filters"""
    response = client.get("/api/v1/items?min_ql=200&item_class=1&page_size=5")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data

if __name__ == "__main__":
    # Run basic tests
    print("Testing advanced search endpoints...")
    
    try:
        test_search_with_ql_filters()
        print("✓ QL filters test passed")
    except Exception as e:
        print(f"✗ QL filters test failed: {e}")
    
    try:
        test_search_with_item_class()
        print("✓ Item class filter test passed")
    except Exception as e:
        print(f"✗ Item class filter test failed: {e}")
    
    try:
        test_search_with_froob_friendly()
        print("✓ Froob friendly filter test passed")
    except Exception as e:
        print(f"✗ Froob friendly filter test failed: {e}")
    
    try:
        test_search_with_stat_bonuses()
        print("✓ Stat bonuses filter test passed")
    except Exception as e:
        print(f"✗ Stat bonuses filter test failed: {e}")
    
    try:
        test_search_with_multiple_filters()
        print("✓ Multiple filters test passed")
    except Exception as e:
        print(f"✗ Multiple filters test failed: {e}")
    
    try:
        test_items_endpoint_with_new_filters()
        print("✓ Items endpoint with new filters test passed")
    except Exception as e:
        print(f"✗ Items endpoint with new filters test failed: {e}")
    
    print("\nAll tests completed!")
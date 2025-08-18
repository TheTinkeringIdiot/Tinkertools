#!/usr/bin/env python3
"""
Quick test script to verify the advanced search functionality works
"""

import requests
import sys
import json

def test_advanced_search():
    """Test the advanced search API endpoint with various parameters"""
    base_url = "http://localhost:8000/api/v1/items/search"
    
    print("Testing Advanced Search API...")
    
    # Test 1: Basic search
    print("\n1. Testing basic search...")
    try:
        response = requests.get(f"{base_url}?q=implant&page_size=5")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Basic search returned {len(data.get('items', []))} items")
        else:
            print(f"✗ Basic search failed: {response.status_code}")
    except Exception as e:
        print(f"✗ Basic search error: {e}")
    
    # Test 2: Quality level filter
    print("\n2. Testing QL filter...")
    try:
        response = requests.get(f"{base_url}?q=implant&min_ql=200&max_ql=300&page_size=5")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ QL filter returned {len(data.get('items', []))} items")
        else:
            print(f"✗ QL filter failed: {response.status_code}")
    except Exception as e:
        print(f"✗ QL filter error: {e}")
    
    # Test 3: Item class filter
    print("\n3. Testing item class filter...")
    try:
        response = requests.get(f"{base_url}?q=weapon&item_class=1&page_size=5")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Item class filter returned {len(data.get('items', []))} items")
        else:
            print(f"✗ Item class filter failed: {response.status_code}")
    except Exception as e:
        print(f"✗ Item class filter error: {e}")
    
    # Test 4: Froob friendly filter
    print("\n4. Testing froob friendly filter...")
    try:
        response = requests.get(f"{base_url}?q=implant&froob_friendly=true&page_size=5")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Froob friendly filter returned {len(data.get('items', []))} items")
        else:
            print(f"✗ Froob friendly filter failed: {response.status_code}")
    except Exception as e:
        print(f"✗ Froob friendly filter error: {e}")
    
    # Test 5: Stat bonus filter
    print("\n5. Testing stat bonus filter...")
    try:
        response = requests.get(f"{base_url}?q=implant&stat_bonuses=16,17&page_size=5")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Stat bonus filter returned {len(data.get('items', []))} items")
        else:
            print(f"✗ Stat bonus filter failed: {response.status_code}")
    except Exception as e:
        print(f"✗ Stat bonus filter error: {e}")
    
    # Test 6: Combined filters
    print("\n6. Testing combined filters...")
    try:
        response = requests.get(f"{base_url}?q=implant&min_ql=100&item_class=3&froob_friendly=true&page_size=5")
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Combined filters returned {len(data.get('items', []))} items")
            print(f"  Total results: {data.get('total', 0)}")
        else:
            print(f"✗ Combined filters failed: {response.status_code}")
    except Exception as e:
        print(f"✗ Combined filters error: {e}")

if __name__ == "__main__":
    test_advanced_search()
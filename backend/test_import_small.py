#!/usr/bin/env python3
"""
Test import with a small subset of data to verify fixes.
"""

import json
import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
sys.path.append(str(Path(__file__).parent))

from app.core.importer import DataImporter

def test_small_import():
    """Test import with just the first 10 items."""
    print("Loading first 10 items for testing...")
    
    with open('items.json', 'r') as f:
        all_data = json.load(f)
    
    # Take just first 10 items
    test_data = all_data[:10]
    
    # Save to temporary file
    with open('test_items.json', 'w') as f:
        json.dump(test_data, f)
    
    print(f"Testing with {len(test_data)} items...")
    
    # Import test data
    importer = DataImporter(chunk_size=5)
    try:
        stats = importer.import_items_from_json('test_items.json', is_nano=False, clear_existing=False)
        print(f"✅ Test import completed successfully!")
        print(f"Created: {stats.items_created}, Updated: {stats.items_updated}, Errors: {stats.errors}")
        
        if stats.errors > 0:
            print("⚠️  Some errors occurred - check import.log")
        else:
            print("🎉 All items imported without errors!")
            
        return stats.errors == 0
        
    except Exception as e:
        print(f"❌ Test import failed: {e}")
        return False
    finally:
        # Clean up
        if Path('test_items.json').exists():
            Path('test_items.json').unlink()

if __name__ == "__main__":
    if not os.getenv("DATABASE_URL"):
        print("❌ DATABASE_URL environment variable must be set")
        sys.exit(1)
    
    success = test_small_import()
    sys.exit(0 if success else 1)
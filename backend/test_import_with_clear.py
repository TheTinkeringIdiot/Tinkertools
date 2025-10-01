#!/usr/bin/env python
"""
Test the new import system with database reset functionality.
"""

import os
import sys
import time
import psycopg2

# Set environment
os.environ['DATABASE_URL'] = 'postgresql://aodbuser:password@localhost:5432/tinkertools'

from app.import_v2 import UnifiedImporter, ImportConfig

def check_database_state():
    """Check current database state."""
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM items")
    item_count = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM items WHERE is_nano = true")
    nano_count = cursor.fetchone()[0]

    cursor.close()
    conn.close()

    return item_count, nano_count

def main():
    print("=" * 60)
    print("TESTING IMPORT WITH DATABASE RESET")
    print("=" * 60)

    # Check initial state
    items_before, nanos_before = check_database_state()
    print(f"\nBefore import:")
    print(f"  Items: {items_before:,}")
    print(f"  Nanos: {nanos_before:,}")

    # Configure import with clear flag
    config = ImportConfig(
        data_path='database/benchmark_test.json',
        batch_size=10000,
        use_two_pass=False,
        clear_database=True  # This should reset the database
    )

    print("\nRunning import with --clear flag...")
    print("This should:")
    print("  1. Drop all TinkerTools tables")
    print("  2. Recreate schema from scratch")
    print("  3. Import new data")

    # Run import
    importer = UnifiedImporter(config)
    start = time.time()
    stats = importer.import_all()
    elapsed = time.time() - start

    # Check results
    items_after, nanos_after = check_database_state()

    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"\nDatabase state before:")
    print(f"  Items: {items_before:,}")
    print(f"  Nanos: {nanos_before:,}")

    print(f"\nDatabase state after:")
    print(f"  Items: {items_after:,}")
    print(f"  Nanos: {nanos_after:,}")

    print(f"\nImport performance:")
    print(f"  Items imported: {stats.get('items_imported', 0):,}")
    print(f"  Time: {elapsed:.2f} seconds")
    print(f"  Speed: {stats.get('speed', 0):,.0f} items/sec")

    # Verify reset worked
    if items_after == 2000:  # benchmark_test.json has 2000 items
        print("\n✓ SUCCESS: Database was properly reset and data imported")
    else:
        print(f"\n✗ WARNING: Expected 2000 items, found {items_after}")
        print("  The database may not have been properly reset")

if __name__ == "__main__":
    main()
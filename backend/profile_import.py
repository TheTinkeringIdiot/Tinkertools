#!/usr/bin/env python3
"""
Profile the import process to identify bottlenecks.
"""

import json
import time
import cProfile
import pstats
import io
import os
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Setup path
import sys
sys.path.append(str(Path(__file__).parent))

from app.core.importer import DataImporter

def profile_import():
    """Profile the import process with a small dataset."""

    # Load environment
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / '.env.claude'
    load_dotenv(env_path)

    # Create test data file if needed
    test_file = Path(__file__).parent / 'database' / 'test_profile.json'
    if not test_file.exists():
        print("Creating test dataset...")
        with open(Path(__file__).parent / 'database' / 'items.json', 'r') as f:
            data = json.load(f)
            # Take first 100 items for profiling
            test_data = data[:100]
        with open(test_file, 'w') as f:
            json.dump(test_data, f)

    print("Starting profiled import...")

    # Profile the import
    pr = cProfile.Profile()
    pr.enable()

    importer = DataImporter(chunk_size=20)
    stats = importer.import_items_from_json(str(test_file), clear_existing=True)

    pr.disable()

    # Print stats
    s = io.StringIO()
    ps = pstats.Stats(pr, stream=s).sort_stats('cumulative')
    ps.print_stats(30)

    print("\n=== PROFILING RESULTS ===")
    print(s.getvalue())

    print("\n=== IMPORT STATS ===")
    print(f"Items created: {stats.items_created}")
    print(f"Items updated: {stats.items_updated}")
    print(f"Errors: {stats.errors}")
    print(f"Time taken: {time.time() - stats.start_time:.2f} seconds")

    # Analyze database operations
    analyze_db_operations(importer.db_url)

def analyze_db_operations(db_url):
    """Analyze database query patterns."""
    engine = create_engine(db_url)

    with engine.connect() as conn:
        # Check table sizes
        tables = ['items', 'stat_values', 'criteria', 'item_stats', 'spells', 'spell_data']
        print("\n=== TABLE SIZES ===")
        for table in tables:
            result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            count = result.scalar()
            print(f"{table}: {count} rows")

        # Check index usage
        print("\n=== INDEX USAGE ===")
        result = conn.execute(text("""
            SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
            FROM pg_stat_user_indexes
            WHERE schemaname = 'public'
            ORDER BY idx_scan DESC
            LIMIT 10
        """))
        for row in result:
            print(f"{row.tablename}.{row.indexname}: {row.idx_scan} scans")

if __name__ == "__main__":
    profile_import()
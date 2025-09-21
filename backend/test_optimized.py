#!/usr/bin/env python3
"""
Test the optimized importer with a small dataset.
"""

import json
import time
import os
from pathlib import Path
import sys
from dotenv import load_dotenv

sys.path.append(str(Path(__file__).parent))

# Load environment variables
env_path = Path(__file__).parent / '.env.claude'
if env_path.exists():
    load_dotenv(env_path)
    print(f"Loaded environment from {env_path}")

from app.core.optimized_importer import OptimizedImporter
from app.core.importer import DataImporter

# Create a small test dataset
test_file = Path(__file__).parent / 'database' / 'test_optimized.json'

if not test_file.exists():
    print("Creating test dataset...")
    with open(Path(__file__).parent / 'database' / 'items.json', 'r') as f:
        data = json.load(f)
        # Take first 500 items for testing
        test_data = data[:500]
    with open(test_file, 'w') as f:
        json.dump(test_data, f)
    print(f"Created test file with {len(test_data)} items")

print("\n=== Testing STANDARD Importer ===")
standard_importer = DataImporter(chunk_size=100)
start = time.time()
standard_stats = standard_importer.import_items_from_json(
    str(test_file),
    clear_existing=True,
    full_reset=True
)
standard_time = time.time() - start

print(f"\nStandard Results:")
print(f"  Time: {standard_time:.2f}s")
print(f"  Items created: {standard_stats.items_created}")
print(f"  Rate: {standard_stats.items_created/standard_time:.1f} items/sec")

print("\n=== Testing OPTIMIZED Importer ===")
optimized_importer = OptimizedImporter(batch_size=500)
start = time.time()
optimized_stats = optimized_importer.import_items_from_json(
    str(test_file),
    clear_existing=True
)
optimized_time = time.time() - start

print(f"\nOptimized Results:")
print(f"  Time: {optimized_time:.2f}s")
print(f"  Items created: {optimized_stats['items_created']}")
print(f"  Rate: {optimized_stats['items_per_second']:.1f} items/sec")

print(f"\n=== COMPARISON ===")
speedup = standard_time / optimized_time if optimized_time > 0 else 0
print(f"Speedup: {speedup:.1f}x faster")
print(f"Standard: {standard_time:.2f}s ({standard_stats.items_created/standard_time:.1f} items/sec)")
print(f"Optimized: {optimized_time:.2f}s ({optimized_stats['items_per_second']:.1f} items/sec)")
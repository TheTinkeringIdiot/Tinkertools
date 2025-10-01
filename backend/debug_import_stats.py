#!/usr/bin/env python3
"""Debug stat value lookups during import."""

import os
import sys
import psycopg2
from dotenv import load_dotenv

# Add app to path
sys.path.insert(0, '/home/quigley/projects/Tinkertools/backend')

from app.import_v2.postgres_copy import SingletonPreloader

# Load environment
load_dotenv('.env.claude')
DATABASE_URL = os.getenv('DATABASE_URL')

# Create preloader
preloader = SingletonPreloader(DATABASE_URL)

# Call preload to initialize
print("Loading stat_values from database...")
preloader.preload_stat_values(set())  # Pass empty set to just load existing values

print(f"Loaded {len(preloader.stat_values)} stat_value entries")

# Test the problematic lookups
test_cases = [
    (23, 11099),
    (76, 2),
    (6, 15)
]

print("\nTesting lookups:")
for stat, value in test_cases:
    stat_value_id = preloader.get_stat_value_id(stat, value)
    if stat_value_id:
        print(f"✓ Found: stat={stat}, value={value} -> id={stat_value_id}")
    else:
        print(f"✗ Missing: stat={stat}, value={value}")
        # Check if it's in the dict
        if (stat, value) in preloader.stat_values:
            print(f"  └─ BUT IT IS IN THE DICT: {preloader.stat_values[(stat, value)]}")

# Show some sample entries
print("\nSample entries in cache:")
sample = list(preloader.stat_values.items())[:10]
for key, value_id in sample:
    print(f"  {key} -> {value_id}")

# Check specific stat 23 entries
print("\nAll stat=23 entries in cache:")
stat_23_entries = [(k, v) for k, v in preloader.stat_values.items() if k[0] == 23]
print(f"Found {len(stat_23_entries)} entries for stat=23")
# Show a few samples
for key, value_id in stat_23_entries[:5]:
    print(f"  {key} -> {value_id}")
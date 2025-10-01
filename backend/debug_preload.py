#!/usr/bin/env python3
"""Debug the preloader issue with stat_values."""

import os
import sys
import logging
from dotenv import load_dotenv

# Setup detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Add app to path
sys.path.insert(0, '/home/quigley/projects/Tinkertools/backend')

from app.import_v2.postgres_copy import SingletonPreloader

# Load environment
load_dotenv('.env.claude')
DATABASE_URL = os.getenv('DATABASE_URL')

print("Testing preloader with many stat values...")
print("=" * 60)

# Create a large set of stat values to insert
test_stats = set()

# Add some real stat values we know are needed
real_stats = [
    (4, 15), (23, 15135), (76, 0), (76, 2),
    (2, 15), (23, 14126), (30, 517), (54, 1),
    (23, 12108), (23, 16144), (23, 17153),
    (3, 15), (5, 15), (6, 15)
]

for stat, value in real_stats:
    test_stats.add((stat, value))

# Add more stat values to test bulk insert
for stat_id in range(1, 100):  # Various stat IDs
    for value in [0, 1, 5, 10, 15, 20, 50, 100, 500, 1000]:
        test_stats.add((stat_id, value))

print(f"Testing with {len(test_stats)} stat values")

# Create preloader and try to preload
preloader = SingletonPreloader(DATABASE_URL)
print(f"Initial cache size: {len(preloader.stat_values)}")

# Call preload
print("\nPreloading stat values...")
preloader.preload_stat_values(test_stats)

print(f"Final cache size: {len(preloader.stat_values)}")

# Test some lookups
print("\nTesting lookups:")
for stat, value in real_stats[:5]:
    result = preloader.get_stat_value_id(stat, value)
    print(f"  ({stat:3}, {value:5}): {'Found' if result else 'MISSING'}")

print("\n" + "=" * 60)
print(f"Summary: {len(preloader.stat_values)} entries in cache")

# Check database directly
import psycopg2
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()
cur.execute("SELECT COUNT(*) FROM stat_values")
count = cur.fetchone()[0]
print(f"Database has {count} stat_values total")
cur.close()
conn.close()
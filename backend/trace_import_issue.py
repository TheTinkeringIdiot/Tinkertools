#!/usr/bin/env python3
"""Trace why stat lookups fail during import."""

import os
import sys
import logging
from dotenv import load_dotenv

# Add app to path
sys.path.insert(0, '/home/quigley/projects/Tinkertools/backend')

from app.import_v2.postgres_copy import SingletonPreloader

# Set up detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment
load_dotenv('.env.claude')
DATABASE_URL = os.getenv('DATABASE_URL')

print("Testing SingletonPreloader behavior...")
print("=" * 60)

# Test 1: Create fresh preloader and check if it loads properly
print("\n1. Creating fresh preloader...")
preloader1 = SingletonPreloader(DATABASE_URL)
print(f"   Initial cache size: {len(preloader1.stat_values)}")

# Test 2: Call preload with empty set (simulates what happens in import)
print("\n2. Calling preload_stat_values with empty set...")
preloader1.preload_stat_values(set())
print(f"   Cache size after preload: {len(preloader1.stat_values)}")

# Test 3: Check specific values
test_values = [(23, 11099), (76, 2), (6, 15), (30, 2097193)]
print("\n3. Checking specific values in cache:")
for stat, value in test_values:
    stat_value_id = preloader1.get_stat_value_id(stat, value)
    in_cache = (stat, value) in preloader1.stat_values
    print(f"   ({stat:3}, {value:8}): id={stat_value_id}, in_cache={in_cache}")

# Test 4: Create second instance (simulating Pass 2)
print("\n4. Creating second preloader instance...")
preloader2 = SingletonPreloader(DATABASE_URL)
print(f"   New instance cache size: {len(preloader2.stat_values)}")

# Test 5: Call preload with some values
print("\n5. Calling preload_stat_values with specific values...")
required_stats = {(23, 11099), (76, 2), (6, 15)}
preloader2.preload_stat_values(required_stats)
print(f"   Cache size after preload: {len(preloader2.stat_values)}")

print("\n6. Checking values again:")
for stat, value in test_values:
    stat_value_id = preloader2.get_stat_value_id(stat, value)
    print(f"   ({stat:3}, {value:8}): id={stat_value_id}")

print("\n" + "=" * 60)
print("Key findings:")
print("- Preloader starts with empty cache")
print("- preload_stat_values() loads ALL existing values from DB")
print("- Cache should persist throughout import")
print("- If cache is empty during Pass 2, that's the problem")
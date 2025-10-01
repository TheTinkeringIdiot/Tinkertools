#!/usr/bin/env python3
"""Check for missing stat_value combinations in database."""

import os
import psycopg2
from dotenv import load_dotenv

# Load environment
load_dotenv('.env.claude')

DATABASE_URL = os.getenv('DATABASE_URL')

# Missing combinations from the warnings
missing_combos = [
    (23, 11099), (76, 2), (6, 15),
    (4, 15), (23, 15135), (30, 517),
    (88, 10), (88, 9), (2, 40), (2, 20),
    (12, 26160), (54, 1), (74, 80), (79, 32168),
    (211, 150), (212, 100), (420, 3), (688, 2),
    (0, -2143288317), (0, -2143288319)  # Special case negative values
]

print('Checking missing stat_value combinations in database...')
print('=' * 60)

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

missing_count = 0
found_count = 0

for stat_id, value in missing_combos:
    cur.execute('SELECT id FROM stat_values WHERE stat = %s AND value = %s', (stat_id, value))
    result = cur.fetchone()

    if result:
        print(f'✓ Found: stat={stat_id:3}, value={value:12} -> id={result[0]}')
        found_count += 1
    else:
        print(f'✗ Missing: stat={stat_id:3}, value={value:12}')
        missing_count += 1

        # Check if stat_id exists at all
        cur.execute('SELECT COUNT(*) FROM stat_values WHERE stat = %s', (stat_id,))
        stat_count = cur.fetchone()[0]

        if stat_count == 0:
            print(f'  └─ No values exist for stat={stat_id}')
        else:
            # Get sample values for this stat
            cur.execute('''
                SELECT MIN(value), MAX(value), COUNT(*)
                FROM stat_values
                WHERE stat = %s
            ''', (stat_id,))
            min_val, max_val, count = cur.fetchone()
            print(f'  └─ Stat {stat_id} has {count} values (range: {min_val} to {max_val})')

print()
print('=' * 60)
print(f'Summary: {found_count} found, {missing_count} missing')

# Check stat_values table structure
print()
print('Checking stat_values table info...')
cur.execute('''
    SELECT COUNT(*) as total,
           COUNT(DISTINCT stat) as unique_stats,
           MIN(value) as min_value,
           MAX(value) as max_value
    FROM stat_values
''')
total, unique_stats, min_val, max_val = cur.fetchone()
print(f'Total stat_values: {total}')
print(f'Unique stat_ids: {unique_stats}')
print(f'Value range: {min_val} to {max_val}')

cur.close()
conn.close()
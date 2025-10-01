#!/usr/bin/env python3
"""Check specific stat values that are causing warnings."""

import os
import psycopg2
from dotenv import load_dotenv

# Load environment
load_dotenv('.env.claude')
DATABASE_URL = os.getenv('DATABASE_URL')

# Unique stat/value combinations from the warnings
missing_combos = [
    (23, 11099),
    (76, 2),
    (6, 15),
    (30, 2097193),
    (30, 41)
]

print('Checking stat_values in database...')
print('=' * 60)

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

for stat_id, value in missing_combos:
    cur.execute('SELECT id FROM stat_values WHERE stat = %s AND value = %s', (stat_id, value))
    result = cur.fetchone()

    if result:
        print(f'✓ EXISTS in DB: stat={stat_id:3}, value={value:8} -> id={result[0]}')
    else:
        print(f'✗ MISSING in DB: stat={stat_id:3}, value={value:8}')

        # Check if we need to add it
        cur.execute('''
            INSERT INTO stat_values (stat, value)
            VALUES (%s, %s)
            ON CONFLICT (stat, value) DO NOTHING
            RETURNING id
        ''', (stat_id, value))

        new_id = cur.fetchone()
        if new_id:
            print(f'  └─ ADDED with id={new_id[0]}')
            conn.commit()

print()
print('Rechecking after potential inserts...')
print('-' * 60)

for stat_id, value in missing_combos:
    cur.execute('SELECT id FROM stat_values WHERE stat = %s AND value = %s', (stat_id, value))
    result = cur.fetchone()
    if result:
        print(f'stat=({stat_id:3}, {value:8}) -> id={result[0]}')

cur.close()
conn.close()
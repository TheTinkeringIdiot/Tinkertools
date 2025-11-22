#!/usr/bin/env python3
"""Apply new performance indexes to the database"""

from app.core.database import engine
from app.core.indexes import PERFORMANCE_INDEXES
from sqlalchemy import text

# Apply only the 4 new indexes (last 4 in the list)
new_indexes = PERFORMANCE_INDEXES[-4:]

print("Applying 4 new performance indexes...")
print()

with engine.connect() as conn:
    for idx in new_indexes:
        try:
            print(f'Creating {idx["name"]}...')
            conn.execute(text(idx['query']))
            conn.commit()
            print(f'✓ {idx["name"]} created successfully')
            print()
        except Exception as e:
            print(f'✗ {idx["name"]} failed: {e}')
            print()

print("Index application complete!")

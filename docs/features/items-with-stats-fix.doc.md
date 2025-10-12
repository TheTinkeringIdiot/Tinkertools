# Items With Stats Endpoint - SQLAlchemy Aliasing Fix

## Overview
Fixed a critical SQL generation bug in the `/api/v1/items/with-stats` endpoint that caused "table name item_stats specified more than once" errors when filtering items with multiple stat requirements using AND logic. The bug was discovered through real database testing after refactoring tests from mocks to use actual database connections.

## User Perspective
Users can now successfully search for items that meet multiple stat requirements simultaneously. For example, finding items that require both Strength >= 500 AND Intelligence >= 400 now works correctly, whereas previously it would fail with a SQL error.

## The Bug

### Root Cause
When a user requested multiple stat requirements with AND logic (e.g., `stat_requirements=16:>=500,17:>=400&logic=and`), the endpoint would join the same tables (`item_stats` and `stat_values`) multiple times without using SQLAlchemy aliases. This caused PostgreSQL to reject the query with:

```
table name "item_stats" specified more than once
```

### Discovery
The bug was hidden by mock-based tests that didn't execute real SQL queries. After refactoring `/home/quigley/projects/Tinkertools/backend/app/tests/test_search_functionality.py` to use real database connections instead of mocks, the test `test_multiple_stat_requirements` immediately exposed the issue.

This demonstrates the critical value of real database testing - the bug had been present but undetected because mock tests don't validate SQL query generation.

## The Fix

### Implementation
**File**: `/home/quigley/projects/Tinkertools/backend/app/api/routes/items.py` (lines 895-921)

The fix uses SQLAlchemy's `aliased()` function to create unique table aliases for each stat requirement in the loop:

```python
from sqlalchemy.orm import aliased

# Apply stat filters
for i, (stat_id, op, value) in enumerate(requirements):
    if logic == "and" or len(requirements) == 1:
        # JOIN for AND logic - item must have ALL specified stats
        # Use aliases to avoid "table name specified more than once" error
        item_stats_alias = aliased(ItemStats)
        stat_value_alias = aliased(StatValue)

        query = query.join(
            item_stats_alias,
            Item.id == item_stats_alias.item_id
        ).join(
            stat_value_alias,
            item_stats_alias.stat_value_id == stat_value_alias.id
        ).filter(
            stat_value_alias.stat == stat_id
        )

        # Apply condition (>=, <=, >, <, =)
        if op == '>=':
            query = query.filter(stat_value_alias.value >= value)
        # ... other operators
```

### Before (Broken)
```python
query = query.join(
    ItemStats,
    Item.id == ItemStats.item_id
).join(
    StatValue,
    ItemStats.stat_value_id == StatValue.id
)
# Multiple iterations would reuse the same table names
```

### After (Fixed)
```python
item_stats_alias = aliased(ItemStats)  # Creates ist_1, ist_2, etc.
stat_value_alias = aliased(StatValue)   # Creates sv_1, sv_2, etc.

query = query.join(
    item_stats_alias,
    Item.id == item_stats_alias.item_id
).join(
    stat_value_alias,
    item_stats_alias.stat_value_id == stat_value_alias.id
)
```

## Data Flow
1. User sends GET request: `/api/v1/items/with-stats?stat_requirements=16:>=500,17:>=400&logic=and`
2. Endpoint parses stat requirements into list: `[(16, '>=', 500), (17, '>=', 400)]`
3. For each requirement, creates unique SQLAlchemy aliases for `ItemStats` and `StatValue`
4. Builds query with aliased joins: `items JOIN item_stats AS ist_1 ... JOIN item_stats AS ist_2 ...`
5. PostgreSQL executes query with distinct table aliases
6. Returns paginated results with items meeting ALL requirements

## Key Files
- `/home/quigley/projects/Tinkertools/backend/app/api/routes/items.py` - Fixed endpoint implementation
- `/home/quigley/projects/Tinkertools/backend/app/tests/test_search_functionality.py` - Test that discovered the bug

## Usage Example

```bash
# Find items requiring both high Strength AND high Intelligence
GET /api/v1/items/with-stats?stat_requirements=16:>=500,17:>=400&logic=and

# Find items requiring EITHER high Strength OR high Intelligence
GET /api/v1/items/with-stats?stat_requirements=16:>=500,17:>=400&logic=or

# Single stat requirement (always works, even before fix)
GET /api/v1/items/with-stats?stat_requirements=16:>=500

# Multiple stats with additional filters
GET /api/v1/items/with-stats?stat_requirements=16:>=500,17:>=400&logic=and&min_ql=200
```

## Testing

### Manual Test
1. Start backend server: `cd backend && uvicorn app.main:app --reload`
2. Test with curl:
   ```bash
   curl "http://localhost:8000/api/v1/items/with-stats?stat_requirements=16:>=50,17:>=50&logic=and"
   ```
3. Expected: HTTP 200 with valid JSON response containing items
4. Previous behavior: HTTP 500 with SQL error

### Automated Test
```bash
cd backend
pytest app/tests/test_search_functionality.py::TestStatBasedQueries::test_multiple_stat_requirements -v
```

## Impact
- **Scope**: Affects only the `/api/v1/items/with-stats` endpoint with multiple AND requirements
- **OR logic**: Was already using subqueries, so unaffected
- **Single stat**: Was working correctly (no duplicate joins)
- **Performance**: No negative impact - aliasing is a standard SQLAlchemy pattern

## Related Documentation
- Database schema: `/home/quigley/projects/Tinkertools/backend/DATABASE.md`
- API documentation: Available at `http://localhost:8000/docs` (FastAPI auto-generated)
- SQLAlchemy aliasing: https://docs.sqlalchemy.org/en/14/orm/query.html#sqlalchemy.orm.aliased

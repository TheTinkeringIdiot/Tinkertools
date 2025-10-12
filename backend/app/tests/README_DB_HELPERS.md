# Database Test Helpers

## Overview

This directory contains helper infrastructure for testing with real database records instead of mock fixtures.

## Files

### `db_test_constants.py`
Contains constants for known AOIDs and IDs from the production database:
- **Items**: Various items with different stat counts (6-27 stats)
- **Perks**: SL, AI, and LE perks with known progression
- **Spells**: Spells with varying criteria counts (0-34 criteria)
- **Mobs**: Pocket bosses with known levels and drops
- **Sources**: Source types and specific source records
- **Stats**: Common and rare stat values

### `db_helpers.py`
Helper functions to query real database records:
- **Item queries**: `get_item_by_aoid()`, `get_item_with_sources()`, etc.
- **Perk queries**: `get_perk_by_item_id()`, `get_perk_series()`, etc.
- **Spell queries**: `get_spell_by_id()`, `get_spells_with_criteria_count()`, etc.
- **Mob queries**: `get_mob_by_id()`, `get_mob_with_drops()`, etc.
- **Source queries**: `get_source_by_id()`, `get_item_sources()`, etc.
- **Stat queries**: `get_stat_value_by_id()`, `get_stats_by_stat_type()`, etc.

All helper functions use proper relationship loading (selectinload) to avoid N+1 query problems.

### `EXAMPLE_USAGE.md`
Comprehensive examples demonstrating how to use the helpers in tests.

## Quick Start

```python
import pytest
from app.tests.db_test_constants import ITEM_PISTOL_MASTERY
from app.tests.db_helpers import get_item_by_aoid


@pytest.mark.asyncio
async def test_item_example(session):
    """Example test using real database data."""
    # Query real item from database
    item = await get_item_by_aoid(session, ITEM_PISTOL_MASTERY)

    # Test with known values from database
    assert item.aoid == 29246
    assert item.name == "Pistol Mastery"
    assert item.ql == 24
    assert len(item.item_stats) == 26
```

## Benefits

1. **Real Data Testing**: Tests validate actual database relationships and data
2. **Less Maintenance**: No need to create and maintain mock fixtures
3. **Reliable Tests**: Tests fail when database schema or relationships change
4. **Performance**: Proper relationship loading prevents N+1 queries
5. **Readability**: Constants make tests self-documenting

## Research Documents

The constants are based on research documented in:
- `.docs/plans/test-data-replacement/real-database-fixtures.docs.md`
- `.docs/plans/test-data-replacement/query-patterns.docs.md`

## Migration from Mock Data

Instead of creating fixtures:
```python
# OLD: Mock data
@pytest.fixture
async def mock_item(session):
    item = Item(id=1, aoid=12345, name="Test Item")
    session.add(item)
    await session.commit()
    return item
```

Use real data queries:
```python
# NEW: Real data
from app.tests.db_test_constants import ITEM_PISTOL_MASTERY
from app.tests.db_helpers import get_item_by_aoid

async def test_item(session):
    item = await get_item_by_aoid(session, ITEM_PISTOL_MASTERY)
    assert item.name == "Pistol Mastery"
```

## Available Test Records

### Items
- `ITEM_PISTOL_MASTERY` (29246) - 26 stats, 29 sources, QL 24
- `ITEM_NEURONAL_STIMULATOR` (220345) - 27 stats, 18 sources, QL 25
- `ITEM_CELL_SCANNER` (24562) - 6 stats, QL 1 (simple item)
- `ITEM_UNNAMED` (42131) - No name (edge case)

### Perks
- `PERK_SL_ACCUMULATOR_1_ITEM_ID` (82832) - SL perk, counter 1
- `PERK_AI_OPPORTUNIST_1_ITEM_ID` (102602) - AI perk, counter 1
- `PERK_LE_EXPLORATION_1_ITEM_ID` (104965) - LE perk, counter 1

### Spells
- `SPELL_ID_COMPLEX_1` (234997) - 34 criteria (complex)
- `SPELL_ID_SIMPLE_1` (1) - 0 criteria (edge case)

### Mobs
- `MOB_ID_ADOBE_SUZERAIN` (1171) - Level 125, 7 drops
- `MOB_ID_AHPTA` (1173) - Level 220, 5 drops

### Stats
- `STAT_ID_COMMON_0` (103) - Common stat (714 occurrences)
- `STAT_ID_RARE_4` (11066) - Rare stat (1 occurrence)
- `STAT_ID_HIGH_VALUE_1` (2144) - Extreme high value
- `STAT_ID_LOW_VALUE_1` (28015) - Extreme low value (negative)

## Helper Functions Summary

| Function | Description |
|----------|-------------|
| `get_item_by_aoid()` | Get item with stats by AOID |
| `get_item_with_sources()` | Get item with all sources loaded |
| `get_perk_by_item_id()` | Get perk with item by item_id |
| `get_spell_by_id()` | Get spell with criteria |
| `get_mob_by_id()` | Get mob by ID |
| `get_mob_with_drops()` | Get mob with all dropped items |
| `get_source_by_id()` | Get source with type |
| `get_stat_value_by_id()` | Get stat value by ID |

See `EXAMPLE_USAGE.md` for complete list and detailed examples.

## Type Safety

All helper functions include proper type hints:
```python
async def get_item_by_aoid(session: AsyncSession, aoid: int) -> Item:
    """Get item by AOID with all stats loaded."""
    ...
```

## Performance Considerations

All helpers use proper eager loading:
- `selectinload()` for one-to-many relationships
- `joinedload()` for many-to-one relationships (where appropriate)
- Efficient batching functions for multiple records
- Count functions that don't load full objects

## Testing the Helpers

Run the import test:
```bash
cd backend
source venv/bin/activate
python -c "from app.tests.db_helpers import *; print('OK')"
```

The helpers are async functions designed for use with AsyncSession in pytest tests.

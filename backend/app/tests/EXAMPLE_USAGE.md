# Database Test Helpers - Example Usage

This document demonstrates how to use the `db_test_constants.py` and `db_helpers.py` modules in your tests.

## Overview

Instead of creating mock fixtures, these helpers let you query real database records using known AOIDs and IDs. This ensures your tests validate actual database relationships and data.

## Basic Usage

### 1. Import Constants and Helpers

```python
import pytest
from app.tests.db_test_constants import (
    ITEM_PISTOL_MASTERY,
    PERK_SL_ACCUMULATOR_1_ITEM_ID,
    MOB_ID_ADOBE_SUZERAIN,
)
from app.tests.db_helpers import (
    get_item_by_aoid,
    get_perk_by_item_id,
    get_mob_by_id,
)
```

### 2. Use in Async Tests

```python
@pytest.mark.asyncio
async def test_item_with_stats(session):
    """Test item retrieval with stats using real data."""
    item = await get_item_by_aoid(session, ITEM_PISTOL_MASTERY)

    assert item.aoid == 29246
    assert item.name == "Pistol Mastery"
    assert item.ql == 24
    assert len(item.item_stats) == 26

    # Check specific stats
    stat_map = {sv.stat_value.stat: sv.stat_value.value
                for sv in item.item_stats}
    assert 6 in stat_map
    assert 23 in stat_map
```

## Complete Test Examples

### Testing Items with Stats

```python
import pytest
from app.tests.db_test_constants import (
    ITEM_PISTOL_MASTERY,
    ITEM_CELL_SCANNER,
)
from app.tests.db_helpers import get_item_by_aoid


@pytest.mark.asyncio
async def test_item_complex_stats(session):
    """Test item with many stats (26 stats)."""
    item = await get_item_by_aoid(session, ITEM_PISTOL_MASTERY)

    assert len(item.item_stats) == 26
    assert item.ql == 24

    # Verify stats are loaded with values
    for item_stat in item.item_stats:
        assert item_stat.stat_value is not None
        assert item_stat.stat_value.stat is not None
        assert item_stat.stat_value.value is not None


@pytest.mark.asyncio
async def test_item_simple_stats(session):
    """Test item with few stats (6 stats)."""
    item = await get_item_by_aoid(session, ITEM_CELL_SCANNER)

    assert len(item.item_stats) == 6
    assert item.ql == 1
```

### Testing Items with Sources

```python
import pytest
from app.tests.db_test_constants import ITEM_PISTOL_MASTERY
from app.tests.db_helpers import get_item_with_sources


@pytest.mark.asyncio
async def test_item_with_multiple_sources(session):
    """Test item with many sources."""
    item = await get_item_with_sources(session, ITEM_PISTOL_MASTERY)

    assert len(item.item_sources) == 29

    # Verify source relationships are loaded
    for item_source in item.item_sources:
        assert item_source.source is not None
        assert item_source.source.source_type is not None
        assert item_source.source.name is not None
```

### Testing Perks

```python
import pytest
from app.tests.db_test_constants import (
    PERK_SL_ACCUMULATOR_1_ITEM_ID,
    PERK_SL_ACCUMULATOR_2_ITEM_ID,
    PERK_AI_OPPORTUNIST_1_ITEM_ID,
)
from app.tests.db_helpers import get_perk_by_item_id, get_perk_series


@pytest.mark.asyncio
async def test_perk_basic(session):
    """Test basic perk retrieval."""
    perk = await get_perk_by_item_id(session, PERK_SL_ACCUMULATOR_1_ITEM_ID)

    assert perk.name == "Accumulator I"
    assert perk.type == "SL"
    assert perk.counter == 1
    assert perk.level_required == 10
    assert perk.perk_series == "Accumulator"


@pytest.mark.asyncio
async def test_perk_types(session):
    """Test different perk types."""
    # SL perk
    perk_sl = await get_perk_by_item_id(session, PERK_SL_ACCUMULATOR_1_ITEM_ID)
    assert perk_sl.type == "SL"

    # AI perk
    perk_ai = await get_perk_by_item_id(session, PERK_AI_OPPORTUNIST_1_ITEM_ID)
    assert perk_ai.type == "AI"


@pytest.mark.asyncio
async def test_perk_series_progression(session):
    """Test perk series with multiple counters."""
    perks = await get_perk_series(session, "Accumulator")

    # Should have 5 levels (counter 1-5)
    assert len(perks) == 5

    # Verify progression
    for i, (perk, item) in enumerate(perks, 1):
        assert perk.counter == i
        assert perk.perk_series == "Accumulator"
        assert perk.type == "SL"
```

### Testing Spells

```python
import pytest
from app.tests.db_test_constants import (
    SPELL_ID_COMPLEX_1,
    SPELL_ID_SIMPLE_1,
)
from app.tests.db_helpers import get_spell_by_id


@pytest.mark.asyncio
async def test_spell_with_criteria(session):
    """Test spell with many criteria."""
    spell = await get_spell_by_id(session, SPELL_ID_COMPLEX_1)

    assert spell.id == 234997
    assert spell.spell_id == 53016
    assert len(spell.spell_criteria) == 34

    # Verify criteria are loaded
    for spell_criterion in spell.spell_criteria:
        assert spell_criterion.criterion is not None


@pytest.mark.asyncio
async def test_spell_without_criteria(session):
    """Test spell with no criteria (edge case)."""
    spell = await get_spell_by_id(session, SPELL_ID_SIMPLE_1)

    assert spell.id == 1
    assert len(spell.spell_criteria) == 0
```

### Testing Mobs

```python
import pytest
from app.tests.db_test_constants import (
    MOB_ID_ADOBE_SUZERAIN,
    MOB_ID_AHPTA,
)
from app.tests.db_helpers import (
    get_mob_by_id,
    get_mob_with_drops,
    get_pocket_boss_mobs,
)


@pytest.mark.asyncio
async def test_mob_basic(session):
    """Test basic mob retrieval."""
    mob = await get_mob_by_id(session, MOB_ID_ADOBE_SUZERAIN)

    assert mob.id == 1171
    assert mob.name == "Adobe Suzerain"
    assert mob.level == 125
    assert mob.playfield == "Scheol Upper"
    assert mob.is_pocket_boss is True


@pytest.mark.asyncio
async def test_mob_with_drops(session):
    """Test mob with item drops."""
    mob = await get_mob_with_drops(session, MOB_ID_ADOBE_SUZERAIN)

    # Adobe Suzerain drops 7 items
    assert len(mob.dropped_items_cached) == 7

    # Verify dropped items
    for item in mob.dropped_items_cached:
        assert item.id is not None
        assert item.aoid is not None
        assert item.name is not None


@pytest.mark.asyncio
async def test_all_pocket_bosses(session):
    """Test retrieving all pocket bosses."""
    bosses = await get_pocket_boss_mobs(session)

    # All mobs in database are pocket bosses
    assert len(bosses) > 0

    for boss in bosses:
        assert boss.is_pocket_boss is True
        assert boss.level is not None
```

### Testing Endpoints

```python
import pytest
from httpx import AsyncClient
from app.tests.db_test_constants import ITEM_PISTOL_MASTERY


@pytest.mark.asyncio
async def test_item_endpoint(client: AsyncClient, session):
    """Test GET /api/items/{aoid} endpoint."""
    response = await client.get(f"/api/items/{ITEM_PISTOL_MASTERY}")

    assert response.status_code == 200
    data = response.json()

    assert data["aoid"] == 29246
    assert data["name"] == "Pistol Mastery"
    assert data["ql"] == 24
    assert len(data["stats"]) == 26
```

## Batch Operations

### Loading Multiple Items

```python
import pytest
from app.tests.db_test_constants import (
    ITEM_PISTOL_MASTERY,
    ITEM_NEURONAL_STIMULATOR,
    ITEM_SILENT_DAGGER,
)
from app.tests.db_helpers import get_items_by_aoid_batch


@pytest.mark.asyncio
async def test_batch_item_loading(session):
    """Test loading multiple items efficiently."""
    aoids = [
        ITEM_PISTOL_MASTERY,
        ITEM_NEURONAL_STIMULATOR,
        ITEM_SILENT_DAGGER,
    ]

    items = await get_items_by_aoid_batch(session, aoids)

    assert len(items) == 3

    # Verify all items loaded with stats
    for item in items:
        assert item.aoid in aoids
        assert len(item.item_stats) > 0
```

## Performance Testing

### Counting Without Loading

```python
import pytest
from app.tests.db_test_constants import ITEM_PISTOL_MASTERY
from app.tests.db_helpers import count_item_sources


@pytest.mark.asyncio
async def test_count_sources_efficiently(session):
    """Test counting item sources without loading them all."""
    count = await count_item_sources(session, ITEM_PISTOL_MASTERY)

    assert count == 29  # Known from database research
```

## Best Practices

### 1. Use Real Data for Integration Tests

✅ **DO**: Use real AOIDs for tests that validate database relationships
```python
item = await get_item_by_aoid(session, ITEM_PISTOL_MASTERY)
assert len(item.item_stats) == 26
```

❌ **DON'T**: Create mock data for integration tests
```python
# Avoid this pattern
item = Item(id=1, aoid=12345, name="Mock Item")
session.add(item)
```

### 2. Use Constants for Maintainability

✅ **DO**: Import and use constants
```python
from app.tests.db_test_constants import ITEM_PISTOL_MASTERY
item = await get_item_by_aoid(session, ITEM_PISTOL_MASTERY)
```

❌ **DON'T**: Hard-code AOIDs in tests
```python
# Avoid this pattern
item = await get_item_by_aoid(session, 29246)  # What is 29246?
```

### 3. Test Edge Cases with Real Data

Use items/records that have interesting characteristics:
- `ITEM_UNNAMED` - Item with no name (edge case)
- `SPELL_ID_SIMPLE_1` - Spell with no criteria (edge case)
- `ITEM_PISTOL_MASTERY` - Item with many stats (complex case)

### 4. Keep Tests Readable

Add comments explaining why specific constants are used:
```python
# Use Pistol Mastery because it has 26 stats and 29 sources
item = await get_item_by_aoid(session, ITEM_PISTOL_MASTERY)
```

## Migration from Mock Data

### Before (Mock Data):
```python
@pytest.fixture
async def mock_item(session):
    item = Item(id=1, aoid=12345, name="Test Item", ql=50)
    stat = StatValue(id=1, stat=6, value=100)
    item_stat = ItemStats(item_id=1, stat_value_id=1)
    session.add_all([item, stat, item_stat])
    await session.commit()
    return item

async def test_item(mock_item):
    assert mock_item.name == "Test Item"
```

### After (Real Data):
```python
from app.tests.db_test_constants import ITEM_PISTOL_MASTERY
from app.tests.db_helpers import get_item_by_aoid

async def test_item(session):
    item = await get_item_by_aoid(session, ITEM_PISTOL_MASTERY)
    assert item.name == "Pistol Mastery"
    assert len(item.item_stats) == 26
```

## Available Helpers Summary

### Item Helpers
- `get_item_by_aoid()` - Get item with stats
- `get_item_with_sources()` - Get item with sources
- `get_items_by_aoid_batch()` - Batch load items
- `get_item_by_id()` - Get item by internal ID

### Perk Helpers
- `get_perk_by_item_id()` - Get perk with item
- `get_perk_series()` - Get all perks in a series
- `get_perks_by_type()` - Get perks by type (SL/AI/LE)

### Spell Helpers
- `get_spell_by_id()` - Get spell with criteria
- `get_spells_with_criteria_count()` - Get complex spells

### Mob Helpers
- `get_mob_by_id()` - Get mob
- `get_mob_with_drops()` - Get mob with dropped items
- `get_pocket_boss_mobs()` - Get all pocket bosses
- `get_mobs_by_level_range()` - Get mobs by level

### Source Helpers
- `get_source_by_id()` - Get source
- `get_source_with_items()` - Get source with items
- `get_sources_by_type()` - Get sources by type
- `get_item_sources()` - Get all sources for an item

### Stat Helpers
- `get_stat_value_by_id()` - Get stat value
- `get_stats_by_stat_type()` - Get all values for a stat type
- `count_item_sources()` - Count sources efficiently

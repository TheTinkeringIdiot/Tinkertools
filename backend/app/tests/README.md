# TinkerTools Backend Test Suite

## Overview
The TinkerTools backend uses a real database testing approach where tests query actual production data instead of creating mock fixtures. This architectural decision prioritizes bug detection and maintainability over test isolation.

## Quick Start

### Running Tests
```bash
cd /home/quigley/projects/Tinkertools/backend
source venv/bin/activate
export $(cat .env.local | xargs)
pytest app/tests/ -v
```

### Writing a New Test
```python
import pytest
from app.tests.db_test_constants import ITEM_PISTOL_MASTERY
from app.tests.db_helpers import get_item_by_aoid

@pytest.mark.asyncio
async def test_my_feature(session):
    """Test using real database data."""
    # Query real item from database
    item = await get_item_by_aoid(session, ITEM_PISTOL_MASTERY)

    # Test with known values
    assert item.aoid == 29246
    assert item.name == "Pistol Mastery"
    assert len(item.item_stats) == 26
```

## Test Infrastructure

### Core Files
- **`conftest.py`** - Pytest fixtures including database session
- **`db_helpers.py`** - 20 helper functions for querying real data with proper eager loading
- **`db_test_constants.py`** - 77 documented constants for stable AOIDs and IDs
- **`README_DB_HELPERS.md`** - Comprehensive helper function documentation
- **`EXAMPLE_USAGE.md`** - Code examples for all test patterns
- **`pytest.ini`** - Pytest configuration (pythonpath, markers, coverage)

### Test Organization
```
app/tests/
├── conftest.py                 # Shared fixtures
├── db_helpers.py               # Real data query helpers
├── db_test_constants.py        # Stable test data constants
├── README_DB_HELPERS.md        # Helper documentation
├── EXAMPLE_USAGE.md            # Usage examples
├── fixtures/                   # Perk and import fixtures
│   ├── README.md
│   ├── perk_fixtures.py
│   └── import_fixtures.py
├── test_endpoints.py           # API endpoint tests
├── test_search_functionality.py # Search feature tests
├── test_models.py              # Model unit tests
├── test_implant_service.py     # Implant service tests
├── test_interpolation_*.py     # Interpolation tests
├── test_perk_*.py              # Perk-related tests
├── test_nano_endpoints.py      # Nano endpoint tests
├── test_mob_endpoints.py       # Mob endpoint tests
├── test_spell_endpoints.py     # Spell endpoint tests
└── test_equipment_bonus_endpoints.py
```

## Real Database Testing Philosophy

### Why Real Data?
1. **Catches Real Bugs**: Tests validate against actual database relationships and constraints
2. **Less Maintenance**: No need to maintain hundreds of mock fixtures
3. **Better Coverage**: Tests exercise real SQLAlchemy relationships and eager loading
4. **Self-Documenting**: `ITEM_PISTOL_MASTERY` is clearer than `mock_item_123`
5. **Validates Schema**: Tests fail when database changes unexpectedly

### When to Use Mocks
Use mocks only for:
- **Pure unit tests** testing model methods/properties in isolation
- **External dependencies** like HTTP clients, email services
- **Error conditions** that are hard to reproduce with real data

All integration tests should use real database queries.

## Test Patterns

### Pattern 1: Simple Item Query
```python
from app.tests.db_test_constants import ITEM_CELL_SCANNER
from app.tests.db_helpers import get_item_by_aoid

async def test_item_query(session):
    item = await get_item_by_aoid(session, ITEM_CELL_SCANNER)
    assert item.aoid == 24562
    assert len(item.item_stats) == 6
```

### Pattern 2: Complex Relationships
```python
from app.tests.db_test_constants import MOB_ID_ADOBE_SUZERAIN
from app.tests.db_helpers import get_mob_with_drops

async def test_mob_drops(session):
    mob = await get_mob_with_drops(session, MOB_ID_ADOBE_SUZERAIN)
    assert mob.level == 125
    assert len(mob.dropped_items_cached) == 7
```

### Pattern 3: Batch Loading
```python
from app.tests.db_test_constants import (
    ITEM_PISTOL_MASTERY,
    ITEM_NEURONAL_STIMULATOR,
    ITEM_SILENT_DAGGER
)
from app.tests.db_helpers import get_items_by_aoid_batch

async def test_batch_loading(session):
    items = await get_items_by_aoid_batch(
        session,
        [ITEM_PISTOL_MASTERY, ITEM_NEURONAL_STIMULATOR, ITEM_SILENT_DAGGER]
    )
    assert len(items) == 3
```

## Available Test Data

### Items (26 constants)
- `ITEM_PISTOL_MASTERY` (29246) - 26 stats, 29 sources, QL 24
- `ITEM_NEURONAL_STIMULATOR` (220345) - 27 stats, 18 sources
- `ITEM_CELL_SCANNER` (24562) - 6 stats (simple item)
- `ITEM_UNNAMED` (42131) - Edge case with no name

### Perks (15 constants)
- `PERK_SL_ACCUMULATOR_1_ITEM_ID` (82832) - SL perk progression
- `PERK_AI_OPPORTUNIST_1_ITEM_ID` (102602) - AI perk
- `PERK_LE_EXPLORATION_1_ITEM_ID` (104965) - LE perk

### Spells (10 constants)
- `SPELL_ID_COMPLEX_1` (234997) - 34 criteria (most complex)
- `SPELL_ID_SIMPLE_1` (1) - 0 criteria (edge case)

### Mobs (5 constants)
- `MOB_ID_ADOBE_SUZERAIN` (1171) - Level 125, drops 7 symbiants
- `MOB_ID_AHPTA` (1173) - Level 220, drops 5 symbiants

See `db_test_constants.py` for complete list with documentation.

## Helper Functions

### Item Helpers
- `get_item_by_aoid(session, aoid)` - Get item with stats
- `get_item_with_sources(session, aoid)` - Get item with sources
- `get_items_by_aoid_batch(session, aoids)` - Batch loading

### Perk Helpers
- `get_perk_by_item_id(session, item_id)` - Get perk with item
- `get_perk_series(session, series_name)` - Get perk progression
- `get_perks_by_type(session, perk_type)` - Get SL/AI/LE perks

### Spell Helpers
- `get_spell_by_id(session, spell_id)` - Get spell with criteria
- `get_spells_with_criteria_count(session, min_count)` - Complex spells

### Mob Helpers
- `get_mob_by_id(session, mob_id)` - Get mob
- `get_mob_with_drops(session, mob_id)` - Get mob with dropped items
- `get_pocket_boss_mobs(session)` - Get all pocket bosses

See `README_DB_HELPERS.md` for complete documentation with examples.

## Test Categories

### Unit Tests
Located in `test_models.py` - Test model methods and properties using mocks:
```python
def test_stat_value_initialization():
    """Test StatValue model initialization."""
    from app.models import StatValue
    stat_value = StatValue(stat=16, value=500)
    assert stat_value.stat == 16
```

### Integration Tests
Most test files - Test API endpoints and services using real database:
```python
async def test_search_endpoint(client, session):
    """Test search endpoint with real data."""
    response = await client.get("/api/items/search?q=Pistol")
    assert response.status_code == 200
```

### Endpoint Tests
Test API routes with real database queries:
- `test_endpoints.py` - Core item endpoints
- `test_nano_endpoints.py` - Nano program endpoints
- `test_mob_endpoints.py` - Mob and pocket boss endpoints
- `test_spell_endpoints.py` - Spell endpoints
- `test_perk_endpoints.py` - Perk endpoints

## Test Markers

```python
@pytest.mark.slow
def test_expensive_operation():
    """Mark slow tests for optional exclusion."""
    pass

@pytest.mark.integration
async def test_full_workflow():
    """Mark integration tests."""
    pass

@pytest.mark.unit
def test_isolated_function():
    """Mark unit tests."""
    pass
```

Run specific markers:
```bash
pytest -m "not slow"        # Skip slow tests
pytest -m integration       # Only integration tests
pytest -m unit             # Only unit tests
```

## Coverage Requirements
- Minimum coverage: 60% (configured in `pytest.ini`)
- Coverage reports generated in `htmlcov/`
- Coverage JSON for CI in `coverage.json`

```bash
# Generate coverage report
pytest --cov=app --cov-report=html

# View report
open htmlcov/index.html
```

## Common Issues

### Issue: Test fails with "table not found"
**Solution**: Ensure database is populated:
```bash
cd /home/quigley/projects/Tinkertools/database
./setup.sh
```

### Issue: Import error for db_helpers
**Solution**: Ensure pythonpath is configured:
```bash
cd /home/quigley/projects/Tinkertools/backend
pytest  # pytest.ini sets pythonpath automatically
```

### Issue: Async session errors
**Solution**: Use `@pytest.mark.asyncio` decorator:
```python
@pytest.mark.asyncio
async def test_async_function(session):
    result = await session.execute(...)
```

## Migration from Mock Data

### Old Pattern (Mock)
```python
@pytest.fixture
async def mock_item(session):
    item = Item(aoid=99999, name="Test")
    session.add(item)
    await session.commit()
    return item

async def test_item(session, mock_item):
    assert mock_item.name == "Test"
```

### New Pattern (Real Data)
```python
from app.tests.db_test_constants import ITEM_CELL_SCANNER
from app.tests.db_helpers import get_item_by_aoid

async def test_item(session):
    item = await get_item_by_aoid(session, ITEM_CELL_SCANNER)
    assert item.name == "Cell Scanner"
```

## Performance
- Individual tests: 10-50ms
- Full test suite: ~45 seconds
- Real data queries add minimal overhead vs mocks
- Benefits outweigh slight performance cost

## Recent Refactoring (2025-10)
The test suite underwent major refactoring to adopt real database testing:
- **Removed**: 1,414 lines of mock fixtures and obsolete tests (-30%)
- **Added**: `db_helpers.py` and `db_test_constants.py` infrastructure
- **Deleted**: 4 obsolete test files (test_advanced_search.py, etc.)
- **Fixed**: 5 problematic tests in test_models.py that corrupted SQLAlchemy models
- **Result**: Better bug detection, reduced maintenance, improved clarity

See `/home/quigley/projects/Tinkertools/.docs/features/test-real-database.doc.md` for detailed refactoring documentation.

## Related Documentation
- **Feature Documentation**: `/.docs/features/test-real-database.doc.md`
- **Helper Functions**: `/home/quigley/projects/Tinkertools/backend/app/tests/README_DB_HELPERS.md`
- **Usage Examples**: `/home/quigley/projects/Tinkertools/backend/app/tests/EXAMPLE_USAGE.md`
- **Fixture Guide**: `/home/quigley/projects/Tinkertools/backend/app/tests/fixtures/README.md`
- **Database Schema**: `/home/quigley/projects/Tinkertools/DATABASE.md`

## Contributing
When adding new tests:
1. Use real data from `db_test_constants.py` when possible
2. Add new constants if needed (with documentation)
3. Create helper functions for complex queries
4. Ensure proper eager loading to prevent N+1 queries
5. Write clear assertions based on real data values
6. Add docstrings explaining what behavior is being tested

# Test Fixtures for Perk Identification

This directory contains test fixtures for the perk identification functionality in TinkerTools backend.

## Overview

The perk identification system uses a separate Perk model with a one-to-one relationship to the Item model. Items are identified as perks if they have an associated Perk record, not based on a boolean field. This design is based on the authoritative `backend/database/perks.json` file, replacing the unreliable `item_class=99999` approach.

## Fixture Files

### `perk_fixtures.py`

Contains pytest fixtures for creating test items with associated Perk records:

#### Perk Item Fixtures
- `perk_accumulator_level_1` - AOID 210830 (Accumulator Level 1)
- `perk_accumulator_level_5` - AOID 210834 (Accumulator Level 5)
- `perk_acquisition_level_1` - AOID 261355 (Acquisition Level 1)
- `perk_acrobat_level_1` - AOID 211655 (Acrobat Level 1)
- `perk_alien_tech_expertise_level_1` - AOID 247748 (Alien Technology Expertise Level 1)

Each perk fixture creates both an Item record and an associated Perk record linked via the item_id foreign key.

#### Non-Perk Item Fixtures
- `non_perk_weapon` - AOID 100001 (Test Blaster weapon)
- `non_perk_armor` - AOID 200001 (Test Armor)
- `non_perk_implant` - AOID 300001 (Test Implant)
- `nano_program` - AOID 400001 (Test Nano Program with `is_nano=True`)

These fixtures create Item records without associated Perk records.

#### Composite Fixtures
- `mixed_item_list` - Returns a list containing both perk and non-perk items

#### Constants
- `PERK_AOIDS_IN_FIXTURES` - Set of all perk AOIDs used in fixtures
- `NON_PERK_AOIDS_IN_FIXTURES` - Set of all non-perk AOIDs used in fixtures

### `import_fixtures.py`

REMOVED: This file has been removed as it provided fixtures for testing an is_perk boolean field that does not exist. See the file for guidance on creating new import fixtures if needed.

## Real AOIDs Used

All perk fixtures use real AOIDs from the actual `backend/database/perks.json` file:

| AOID   | Perk Name                    | Level | Type | Profession(s)                             |
|--------|------------------------------|-------|------|-------------------------------------------|
| 210830 | Accumulator                  | 1     | SL   | Trader                                    |
| 210834 | Accumulator                  | 5     | SL   | Trader                                    |
| 261355 | Acquisition                  | 1     | LE   | Fixer                                     |
| 211655 | Acrobat                      | 1     | SL   | Fixer, Martial Artist, Shade, Adventurer |
| 247748 | Alien Technology Expertise   | 1     | AI   | (Any)                                     |

## Usage Examples

### Basic Perk Testing

```python
def test_perk_identification(perk_accumulator_level_1):
    """Test that a perk is properly identified."""
    assert perk_accumulator_level_1.aoid == 210830
    assert perk_accumulator_level_1.perk is not None  # Has associated Perk record
    assert perk_accumulator_level_1.is_nano is False
    # Access Perk details
    assert perk_accumulator_level_1.perk.name == "Accumulator"
    assert perk_accumulator_level_1.perk.counter == 1
```

### Database Query Testing

```python
from app.models.perk import Perk

def test_query_perks_only(db_session, mixed_item_list):
    """Test querying for perks using the Perk relationship."""
    # Query for items that have associated Perk records
    perks = db_session.query(Item).join(Perk, Item.id == Perk.item_id).all()
    assert len(perks) == 2  # From mixed_item_list fixture

    # Verify all have perk relationships
    for item in perks:
        assert item.perk is not None
```

### Querying Non-Perks

```python
def test_query_non_perks(db_session, mixed_item_list):
    """Test querying for non-perks by excluding items with Perk records."""
    # Use left outer join and filter for NULL
    non_perks = db_session.query(Item).outerjoin(
        Perk, Item.id == Perk.item_id
    ).filter(Perk.item_id.is_(None)).all()

    assert len(non_perks) == 3
    for item in non_perks:
        assert item.perk is None
```

### Import System Testing

Import testing should verify that:
1. Item records are imported correctly
2. Perk records are imported from perks.json
3. Perk.item_id correctly references Item.id
4. The relationship is properly established

## Key Design Decisions

1. **Real AOIDs**: All fixtures use real AOIDs from perks.json to ensure realistic testing
2. **Separate Perk Model**: Perks are a separate table with one-to-one relationship to Items
3. **Relationship-Based**: Perk identification via `item.perk is not None`, not boolean field
4. **Contrast Items**: Non-perk fixtures provide clear contrast for testing identification logic
5. **Mixed Data**: Composite fixtures enable comprehensive integration testing
6. **Business Rules**: Fixtures enforce the rule that perks are never nano programs

## Testing Strategy

These fixtures support testing:

1. **Model Validation**: Items with Perk records are properly linked
2. **Database Queries**: Filtering and querying based on Perk relationship
3. **Import Logic**: Verification that import system creates proper Perk records
4. **Service Layer**: PerkService queries return items with Perk relationships
5. **API Responses**: Endpoints return proper perk data from Perk model

## Integration with Existing Tests

These fixtures integrate with the existing test infrastructure:

- Use the same `db_session` fixture from `conftest.py`
- Follow the same naming conventions as existing fixtures
- Are automatically imported via `conftest.py` imports
- Can be combined with existing fixtures like `sample_item`

## Future Extensions

Additional fixtures can be added for:

- More perk types (AI, LE, SL variations)
- Edge cases (special profession requirements)
- Performance testing (large datasets)
- Testing Perk model fields (professions, breeds arrays, etc.)

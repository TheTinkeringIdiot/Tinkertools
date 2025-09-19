# Test Fixtures for Perk Identification

This directory contains test fixtures for the perk identification functionality in TinkerTools backend.

## Overview

The perk identification system adds an `is_perk` boolean field to the Item model to properly identify perk items based on the authoritative `backend/database/perks.json` file, replacing the unreliable `item_class=99999` approach.

## Fixture Files

### `perk_fixtures.py`

Contains pytest fixtures for creating test items with the `is_perk` field properly set:

#### Perk Item Fixtures
- `perk_accumulator_level_1` - AOID 210830 (Accumulator Level 1)
- `perk_accumulator_level_5` - AOID 210834 (Accumulator Level 5)
- `perk_acquisition_level_1` - AOID 261355 (Acquisition Level 1)
- `perk_acrobat_level_1` - AOID 211655 (Acrobat Level 1)
- `perk_alien_tech_expertise_level_1` - AOID 247748 (Alien Technology Expertise Level 1)

#### Non-Perk Item Fixtures
- `non_perk_weapon` - AOID 100001 (Test Blaster weapon)
- `non_perk_armor` - AOID 200001 (Test Armor)
- `non_perk_implant` - AOID 300001 (Test Implant)
- `nano_program` - AOID 400001 (Test Nano Program with `is_nano=True`)

#### Composite Fixtures
- `mixed_item_list` - Returns a list containing both perk and non-perk items

#### Constants
- `PERK_AOIDS_IN_FIXTURES` - Set of all perk AOIDs used in fixtures
- `NON_PERK_AOIDS_IN_FIXTURES` - Set of all non-perk AOIDs used in fixtures

### `import_fixtures.py`

Contains fixtures for testing the import system's perk identification logic:

#### Data Fixtures
- `sample_perks_data` - Sample perks.json structure with real perk data
- `sample_perk_aoids` - Set of AOIDs extracted from sample perks data
- `item_import_data_with_perks` - Sample item data for import testing

#### File Fixtures
- `temp_perks_json_file` - Temporary perks.json file for testing
- `empty_perks_json_file` - Empty perks.json for error handling tests
- `malformed_perks_json_file` - Invalid JSON for error handling tests

#### Validation Fixtures
- `expected_perk_identification` - Expected results for perk identification tests

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
    assert perk_accumulator_level_1.is_perk is True
    assert perk_accumulator_level_1.is_nano is False
```

### Database Query Testing

```python
def test_query_perks_only(db_session, mixed_item_list):
    """Test querying for perks using the is_perk field."""
    perks = db_session.query(Item).filter(Item.is_perk == True).all()
    assert len(perks) == 2  # From mixed_item_list fixture
```

### Import System Testing

```python
def test_import_perk_identification(temp_perks_json_file, item_import_data_with_perks):
    """Test that import system correctly identifies perks."""
    # Use temp_perks_json_file and item_import_data_with_perks
    # to test DataImporter.load_perk_aoids() functionality
```

## Key Design Decisions

1. **Real AOIDs**: All fixtures use real AOIDs from perks.json to ensure realistic testing
2. **Contrast Items**: Non-perk fixtures provide clear contrast for testing identification logic
3. **Mixed Data**: Composite fixtures enable comprehensive integration testing
4. **Error Cases**: Import fixtures include error scenarios (missing/malformed files)
5. **Business Rules**: Fixtures enforce the rule that perks are never nano programs

## Testing Strategy

These fixtures support testing:

1. **Model Validation**: Items are created with correct `is_perk` values
2. **Database Queries**: Filtering and querying based on `is_perk` field
3. **Import Logic**: Verification that import system sets `is_perk` correctly
4. **Service Layer**: PerkService queries return only items with `is_perk=True`
5. **API Responses**: Endpoints return proper `is_perk` field values

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
- Migration testing (old vs new identification methods)
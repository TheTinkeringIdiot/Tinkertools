# Perk Validation and Import System

## Overview

TinkerTools features a comprehensive perk validation and import system that ensures data integrity when importing perk data from JSON sources. The system validates profession mappings, breed mappings, perk types, and level requirements while providing detailed error reporting.

## Key Components

### PerkValidator (`backend/app/core/perk_validator.py`)

The `PerkValidator` module provides data validation utilities for converting perk metadata from JSON format to database-compatible formats:

- **Profession Mapping**: Maps profession names to integer IDs (1-15)
- **Breed Mapping**: Maps breed names to integer IDs (1-4)
- **Perk Type Validation**: Validates perk types (SL/AI/LE)
- **Counter Validation**: Ensures counter values are within valid range (1-10)
- **Level Requirement Parsing**: Safely converts level requirements to integers

#### Profession Mapping
```python
PROFESSION_NAME_TO_ID = {
    "Soldier": 1, "Martial Artist": 2, "Engineer": 3, "Fixer": 4,
    "Agent": 5, "Adventurer": 6, "Trader": 7, "Bureaucrat": 8,
    "Enforcer": 9, "Doctor": 10, "Nano-Technician": 11,
    "Meta Physicist": 12, "Keeper": 14, "Shade": 15
}
```

#### Breed Mapping
```python
BREED_NAME_TO_ID = {
    "Solitus": 1, "Opifex": 2, "Nanomage": 3, "Atrox": 4
}
```

### Perk table (`backend/database/cas/002_curated_and_derived.sql`)

Perks are curated data of the content-addressed store: one row of `perk` per perk item, keyed by AOID, with `name`, `perk_series`, `counter`, `type` (SL/AI/LE), `level_required`, `ai_level_required`, `professions` and `breeds`. A build is served with perks when it has the `perks` feature and the perk item is present in it.

### Import (`backend/app/core/cas_curated.py`)

`read_perks` reads `backend/database/perks.json`, validates every row with the perk validator and leaves out profession and breed names the application does not know (with a warning). `sync_curated` makes the table equal to the file on every `import_cli.py import-cas` run.

## Data Flow

1. **JSON Source Processing**: Raw perk data loaded from JSON files
2. **Data Validation**: Each field validated using PerkValidator functions
3. **Type Conversion**: String values converted to appropriate database types
4. **Database Insertion**: The store's `perk` table is made equal to the validated rows
5. **Error Reporting**: Validation failures logged with detailed messages

## Validation Rules

### Profession Validation
- Maps profession names to integer IDs
- Supports both standard names and alternative formats (e.g., "MartialArtist", "NanoTechnician")
- Raises `ValueError` for unrecognized profession names

### Breed Validation
- Maps breed names to integer IDs
- Validates against four standard breeds: Solitus, Opifex, Nanomage, Atrox
- Case-sensitive matching with whitespace trimming

### Perk Type Validation
- Validates against allowed types: SL, AI, LE
- Case-insensitive validation with automatic upper-case conversion
- Rejects invalid or empty perk types

### Counter Validation
- Ensures counter values are integers between 1 and 10
- Type checking prevents non-integer values
- Range validation prevents invalid counter values

### Level Requirement Parsing
- Safely converts various input types to integers
- Handles null/None values by defaulting to 0
- Prevents negative level requirements
- Provides detailed error messages for unparseable values

## Implementation Files

### Core Validation Files
- `backend/app/core/perk_validator.py` - Main validation utilities
- `backend/app/core/cas_curated.py` - `read_perks`, `sync_curated`
- `backend/app/store/curated.py` - `lookup_perks`, the perk lookup the API serves

### API Integration
- `backend/app/api/routes/perks.py` - Perk API endpoints
- Enhanced error handling for validation failures
- Consistent error response formats

### Test Infrastructure
- `backend/app/tests/test_cas_store.py` - Import of the perk file (`test_perks_keep_the_professions_the_application_knows`)
- `backend/app/tests/test_perk_endpoints.py`, `test_curated_endpoints.py` - API endpoint tests
- Comprehensive test coverage for validation scenarios

## Usage Examples

### Basic Validation
```python
from app.core.perk_validator import map_profession_to_id, validate_perk_type

# Map profession name to ID
prof_id = map_profession_to_id("Martial Artist")  # Returns 2

# Validate perk type
perk_type = validate_perk_type("sl")  # Returns "SL"
```

### Batch Processing
```python
from app.core.perk_validator import map_professions_list

# Map list of professions
prof_ids = map_professions_list(["Soldier", "Doctor", "Agent"])  # Returns [1, 10, 5]
```

### Error Handling
```python
try:
    prof_id = map_profession_to_id("Invalid Profession")
except ValueError as e:
    print(f"Validation error: {e}")
    # Output: "Unknown profession name: 'Invalid Profession'. Valid names: [...]"
```

## Error Recovery

The system provides comprehensive error handling:

- **Detailed Error Messages**: Specific information about validation failures
- **Context Preservation**: Error messages include the invalid value and expected format
- **Graceful Degradation**: Individual record failures don't stop batch processing
- **Logging Integration**: All validation errors logged for debugging

## Performance Optimizations

- **Lookup Tables**: Fast O(1) profession and breed name lookups
- **Batch Validation**: Process multiple records efficiently
- **Type Checking**: Early type validation prevents expensive operations
- **Memory Efficiency**: Streaming processing for large datasets

## Future Enhancements

- **Dynamic Mapping**: Support for configurable profession/breed mappings
- **Validation Caching**: Cache validation results for repeated values
- **Custom Validators**: Plugin system for custom validation rules
- **Validation Reporting**: Detailed validation reports with statistics
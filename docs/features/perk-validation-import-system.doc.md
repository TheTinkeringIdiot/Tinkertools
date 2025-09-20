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

### Enhanced Perk Model (`backend/app/models/perk.py`)

The `Perk` model defines the database structure for storing perk data:

```python
class Perk(Base):
    __tablename__ = 'perks'

    item_id = Column(Integer, ForeignKey('items.id', ondelete='CASCADE'), primary_key=True)
    name = Column(String(128), nullable=False)
    perk_series = Column(String(128), nullable=False)
    counter = Column(Integer, nullable=False)
    type = Column(String(10), nullable=False)  # SL/AI/LE
    level_required = Column(Integer, nullable=False)
    ai_level_required = Column(Integer, nullable=False)
    professions = Column(ARRAY(Integer), nullable=False)
    breeds = Column(ARRAY(Integer), nullable=False)
```

### Enhanced Import System (`backend/app/core/importer.py`)

The import system has been enhanced with:

- **Validation Integration**: Uses PerkValidator for all perk data validation
- **Error Handling**: Comprehensive error logging and recovery
- **Batch Processing**: Efficient bulk import operations
- **Progress Tracking**: Real-time import progress reporting

## Data Flow

1. **JSON Source Processing**: Raw perk data loaded from JSON files
2. **Data Validation**: Each field validated using PerkValidator functions
3. **Type Conversion**: String values converted to appropriate database types
4. **Database Insertion**: Validated data inserted into perks table
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
- `backend/app/models/perk.py` - Perk database model
- `backend/app/api/schemas/perk.py` - Perk API schemas
- `backend/app/services/perk_service.py` - Perk business logic

### API Integration
- `backend/app/api/routes/perks.py` - Perk API endpoints
- Enhanced error handling for validation failures
- Consistent error response formats

### Test Infrastructure
- `backend/tests/test_perk_import.py` - Import system tests
- `backend/tests/test_perk_api.py` - API endpoint tests
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
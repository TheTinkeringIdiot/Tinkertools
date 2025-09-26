# Perk System Research Report

## Summary
The TinkerTools codebase has a comprehensive perk system already implemented with backend API routes, database models, frontend types, and import functionality. Perks are stored as Items in the database (not separate models) with special item_class=99999 to distinguish them from regular items. The system supports three perk types: SL (Shadowlands), AI (Alien Invasion), and LE (Lost Eden) with different point systems and requirements.

## Key Components
- `/home/quigley/projects/Tinkertools/backend/database/perks.json`: Large JSON file (~47k tokens) with columnar format containing perk data (aoid, name, counter, type, professions, breeds, level, aiTitle)
- `/home/quigley/projects/Tinkertools/backend/app/services/perk_service.py`: Comprehensive service for perk operations including validation, effect calculation, and business logic
- `/home/quigley/projects/Tinkertools/backend/app/api/routes/perks.py`: Full REST API with endpoints for search, series, stats, validation, and calculations
- `/home/quigley/projects/Tinkertools/backend/app/api/schemas/perk.py`: Complete Pydantic schemas for all perk operations and responses
- `/home/quigley/projects/Tinkertools/backend/app/importers/perk_importer.py`: Specialized importer for transforming columnar perk data to item format
- `/home/quigley/projects/Tinkertools/frontend/src/lib/tinkerprofiles/perk-types.ts`: TypeScript definitions for perk system integration
- `/home/quigley/projects/Tinkertools/frontend/src/lib/tinkerprofiles/perk-manager.ts`: Frontend perk management with point calculation and validation
- `/home/quigley/projects/Tinkertools/frontend/src/components/profiles/perks/`: Vue components for perk UI (PerkSelector, PerkTabs, etc.)

## Implementation Patterns
- **Item-based Storage**: Perks are stored as Items with special item_class=99999, using existing infrastructure (`/home/quigley/projects/Tinkertools/backend/app/models/item.py`)
- **Metadata in Description**: Perk-specific data (type, requirements) encoded in item description field during import (`perk_importer.py`)
- **Service Layer Pattern**: Business logic centralized in PerkService class with async methods for all operations (`perk_service.py`)
- **Columnar Data Transformation**: JSON data transformed from columnar format to item structure during import (`perk_importer.py:_transform_perk_data`)
- **Point System Calculations**: Separate calculations for SL points (character level-based) and AI points (alien level-based) (`perk-manager.ts`)

## Considerations
- **Metadata Storage Limitation**: Perk metadata currently stored in description strings rather than structured fields, making queries complex
- **Incomplete Service Implementation**: Many PerkService methods have placeholder implementations that need spell_data integration
- **Frontend-Backend Gap**: Frontend has detailed type definitions but backend extraction methods are not fully implemented
- **Import Process**: Perks can be imported via CLI but require special handling due to columnar format vs standard item JSON
- **Database Schema**: No dedicated perk table - relies on Item model with special item_class identifier

## Next Steps
- **Complete Backend Service**: Implement the placeholder methods in PerkService for extracting requirements, effects, and spell data from items
- **Database Optimization**: Consider adding perk-specific fields to Item model or creating junction table for perk metadata
- **API Integration**: Connect frontend perk components to backend API endpoints for live data
- **Import Refinement**: Enhance perk import to better handle spell_data and effect parsing from game data
# Perk Import System Validation Research

## Summary
The current DataImporter implementation properly handles perk identification via AOID lookup from perks.json, but has several critical issues including database schema mismatches and incomplete string-to-ID mapping logic. The proposed changes to remove is_perk flag logic would break existing perk identification patterns without providing adequate replacement mechanisms.

## Key Components
- `/home/quigley/projects/Tinkertools/backend/app/core/importer.py`: Main import logic with perk AOID caching (lines 76-114, 289-293)
- `/home/quigley/projects/Tinkertools/backend/database/perks.json`: Columnar perk data with profession/breed strings in arrays
- `/home/quigley/projects/Tinkertools/frontend/src/services/game-data.ts`: Contains PROFESSION and BREEDS ID mappings (lines 1178-1189, 3128+)
- `/home/quigley/projects/Tinkertools/backend/app/models/item.py`: Item model with is_perk boolean field (line 20)
- `/home/quigley/projects/Tinkertools/backend/app/services/perk_service.py`: Service using is_perk for queries (line 67)

## Implementation Patterns
- **AOID-based Identification**: Perks identified by loading AOIDs from perks.json into _perk_aoids set for O(1) lookup (`importer.py:85-114`)
- **Boolean Flag Setting**: is_perk flag set based on AOID presence in perk set during import (`importer.py:289-293`)
- **Columnar Data Format**: Perk data stored as {"columns": [...], "values": [...]} with profession/breed as string arrays
- **Service Layer Filtering**: PerkService queries items with is_perk=True for perk operations (`perk_service.py:67`)

## Considerations
- **Database Schema Mismatch**: Import logs show is_perk column doesn't exist in current database despite being in schema definition
- **Missing String-to-ID Mapping**: No implementation exists for converting profession/breed strings to integer IDs during import
- **Service Dependencies**: PerkService and existing queries rely on is_perk flag for efficient perk filtering
- **Test Coverage Gap**: Perk import tests validate AOID loading but don't test profession/breed ID conversion
- **Data Transformation Required**: Perks.json format (string arrays) incompatible with standard item import expecting single values

## Next Steps
- **Fix Database Schema**: Apply migration 003_add_perk_support.sql to add missing is_perk column before removing logic
- **Implement ID Mapping Service**: Create utility functions to map profession/breed strings to IDs using game-data.ts constants
- **Preserve Perk Identification**: Maintain is_perk flag logic until alternative efficient perk filtering mechanism is implemented
- **Add Integration Tests**: Test complete perk import flow including string-to-ID conversion and database persistence
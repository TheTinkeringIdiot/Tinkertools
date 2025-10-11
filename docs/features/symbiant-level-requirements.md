# Symbiant Level Requirement Display and Filtering

## Overview
Comprehensive level requirement display and filtering system for symbiants that extracts minimum level requirements from item actions and provides multi-faceted filtering capabilities including level range sliders with intelligent profile integration.

## User Perspective
Users can now filter symbiants by level requirements using a range slider (1-220) in the FindGear view. The level requirement is displayed prominently in three views:
- List view: Shows "Lvl 200+" format next to QL and slot information
- Comparison view: Displays level as an info Tag next to the QL Tag
- Boss drops table: Sortable "Level Req" column showing level requirements

When a profile is loaded, the max level filter automatically adjusts to match the character's level, making it easy to find equipment usable by that character. The level filter is persisted in URL query parameters (minlvl/maxlvl) for shareable searches.

## Data Flow
1. User adjusts level range slider in FindGear view
2. Frontend extracts level from WEAR action criteria using getMinimumLevel() utility
3. Level filter values sent to backend as min_level/max_level query parameters
4. Backend joins through Item -> Action -> ActionCriteria -> Criterion tables
5. Database filters on action=6 (WEAR), stat=54 (level), with operator transformation
6. Results returned with actions so frontend can extract and display levels
7. UI updates symbiant list with filtered results and displays level in all views

## Implementation

### Key Files

#### Backend
- `backend/app/api/routes/symbiants.py` - Added min_level/max_level query parameters with SQL filtering through action criteria. Uses CASE expression to transform operator 2 (GreaterThan) by adding 1 to value2 (e.g., value2=29 with operator=2 becomes level 30+). Joins through Item -> Action -> ActionCriteria -> Criterion tables filtering on action=6 (WEAR) and value1=54 (level stat).

- `backend/app/api/routes/mobs.py` - Updated get_mob_drops endpoint to return full SymbiantResponse with actions and spell_data instead of minimal SymbiantDropInfo. Uses eager loading with joinedload to include all related data needed for level extraction.

#### Frontend
- `frontend/src/services/game-utils.ts` - Added getMinimumLevel() utility function that extracts minimum level from WEAR action (action=6) criteria where stat=54. Handles operator transformation: operator 2 (GreaterThan) adds 1 to value2, operator 0 (Equal) uses value2 as-is. Throws descriptive errors if WEAR action or level criterion missing.

- `frontend/src/types/api.ts` - Extended SymbiantSearchQuery interface with min_level and max_level optional parameters for API requests.

- `frontend/src/apps/tinkerpocket/views/FindGear.vue` - Added level range slider UI component with symbiantMinLevel/symbiantMaxLevel refs (default 1-220). Implements applyLevelFilter() to update query parameters and URL. Watches activeProfile changes to auto-set max level to character's level. Added formatMinimumLevel() to display level in list view. Persists level filter in URL as minlvl/maxlvl query params.

- `frontend/src/components/pocket/SymbiantCompare.vue` - Added level Tag display next to QL Tag for all three comparison slots. Uses formatMinimumLevel() with error handling to safely extract and display level requirements.

- `frontend/src/views/BossDetail.vue` - Added sortable "Level Req" column to boss drops DataTable showing level as Tag format. Implements formatMinimumLevel() for level extraction with fallback to '--' on errors.

### Database
The level requirement data is stored in the criteria system:
- Tables: `actions` (action=6 for WEAR), `action_criteria` (junction), `criteria` (value1=54 for level stat, value2 for actual level value, operator for comparison type)
- Operator mapping: 0 = Equal, 1 = LessThan, 2 = GreaterThan
- Level requirements typically use operator 2 (GreaterThan), requiring +1 transformation for display

### Critical Implementation Detail: Operator Transformation
The most important aspect of this feature is understanding operator 2 (GreaterThan):
- Database stores: `operator=2, value2=29` meaning "stat > 29"
- Display shows: "Level 30+" (because level must be at least 30)
- Both backend SQL and frontend extraction apply this +1 transformation
- Backend uses CASE expression: `CASE WHEN operator=2 THEN value2+1 ELSE value2 END`
- Frontend uses conditional: `if (operator === 2) return value2 + 1; return value2;`

## Configuration
No environment variables or feature flags required. Level filtering is always available for symbiant searches.

## Usage Example
```typescript
// Extract minimum level from symbiant
import { getMinimumLevel } from '@/services/game-utils';

const symbiant: SymbiantItem = {
  id: 1,
  name: "Ocular Chitin",
  actions: [
    {
      action: 6, // WEAR action
      criteria: [
        { value1: 54, value2: 199, operator: 2 } // Level > 199 = Lvl 200+
      ]
    }
  ]
};

const minLevel = getMinimumLevel(symbiant); // Returns 200

// Filter symbiants by level range
const query: SymbiantSearchQuery = {
  min_level: 180,
  max_level: 200,
  families: ['Ocular']
};

const results = await symbiantsStore.searchSymbiants(query);
```

## Testing

### Manual Test
1. Navigate to TinkerPocket > Find Gear > Symbiants tab
2. Adjust the Level Range slider to 180-200
3. Verify URL updates with minlvl=180&maxlvl=200
4. Verify results show only symbiants with level requirements in that range
5. Load a character profile (e.g., level 150)
6. Verify max level slider automatically adjusts to 150
7. Check comparison view - select symbiants and verify level Tags display correctly
8. Check boss detail page - verify Level Req column is sortable and displays correctly

### Expected Behavior
- Level slider filters results accurately with operator transformation applied
- Profile integration auto-adjusts max level to character's level
- Level displayed consistently across all views (list, comparison, boss drops)
- URL parameters preserve level filter state for sharing
- Sorting by Level Req column works correctly in boss drops table
- Error handling gracefully falls back to '--' or 'Lvl ?' if level extraction fails

## Related Documentation
- Action/Criteria system: `frontend/src/services/action-criteria.ts`
- Game data constants: `frontend/src/services/game-data.ts`
- Profile stats mapping: `frontend/src/utils/profile-stats-mapper.ts`

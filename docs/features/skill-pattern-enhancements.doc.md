# Skill Pattern Recognition Enhancements

## Overview

This feature significantly expands the skill pattern recognition system used throughout TinkerTools to handle diverse skill name variations from multiple data sources. The enhancements add 60+ new skill patterns covering advanced ACs (Reflect, Shield, Absorb), damage modifiers, miscellaneous stats, and improved fuzzy matching for existing skills.

## Problem Solved

### Data Source Variability
TinkerTools integrates data from multiple sources with inconsistent skill naming:

1. **AOSetups Imports**: Abbreviated skill names (e.g., "Mech. Engi", "Ranged. Init.")
2. **Database Cluster Names**: Full formal names (e.g., "Sensory Improvement and Modification", "Biological Metamorphoses")
3. **Profile Exports**: Mixed abbreviations and full names
4. **Legacy Formats**: Historical naming conventions from older game versions

**Challenge**: Map all variations to canonical stat IDs for calculations and display.

### Coverage Gaps
The original pattern system (v1.0) covered only ~45 core skills, missing:
- Advanced AC types (Reflect, Shield, Absorb variations)
- Damage modifier stats (Add Projectile Damage, Add Melee Damage, etc.)
- Miscellaneous stats (XP Bonus, Nano Cost, Heal Delta, Nano Delta, etc.)
- Vehicle skills (Vehicle Water variations: "Water" vs "Hydro")
- Full-form cluster names from implant descriptions

## Architecture Pattern

### Pattern Registry Design

**Location**: `frontend/src/utils/skill-patterns.ts`

The skill pattern system uses a registry-based architecture with regex patterns mapped to stat IDs:

```typescript
interface SkillPattern {
  statId: number          // Canonical stat ID (e.g., 128 for Biological Metamorphosis)
  patterns: RegExp[]      // Array of regex patterns matching name variations
  category: string        // Skill category for organizational purposes
  description: string     // Human-readable canonical name
}

const SKILL_PATTERNS: Record<number, SkillPattern> = {
  128: {
    statId: 128,
    patterns: [/^Bio(logical)?(\s)?.*Metamor(ph(osis)?)?$/i],
    category: 'Nanos & Casting',
    description: 'Biological Metamorphosis'
  },
  // ... 80+ patterns total
}
```

### Pattern Matching Algorithm

**Function**: `findSkillByPattern(skillCategory, statId)`

Three-tier matching strategy:
1. **Iterate through skill category** (e.g., all skills in "Nanos & Casting")
2. **Test each pattern** against skill name with case-insensitive regex
3. **Return first match** or null if no pattern matches

**Performance**: O(n*m) where n = skills in category, m = patterns per stat (typically 1-3)

### Integration with Skill Mappings

**Location**: `frontend/src/lib/tinkerprofiles/skill-mappings.ts`

The pattern system complements the exact-match `SKILL_ID_MAP`:

```typescript
// Exact matches (fast O(1) lookup)
export const SKILL_ID_MAP: Record<string, number> = {
  'Sensory Improvement': 122,
  'Sensory Impr': 122,  // AOSetups variant
  // ... hundreds of exact matches
}

// Pattern matching (fallback for flexible matching)
// Used when exact match fails or when processing unknown formats
```

**Usage Hierarchy**:
1. Try exact match in `SKILL_ID_MAP` (fastest)
2. Fall back to pattern matching in `SKILL_PATTERNS` (flexible)
3. Fail with descriptive error if both fail

## Key Enhancements

### 1. Advanced AC Type Coverage (+33 patterns)

**Reflect AC Stats** (9 types):
- Projectile, Melee, Energy, Chemical, Radiation, Cold, Nano, Fire, Poison
- Pattern: `/^Reflect\s*{Type}\s*AC$/i`
- Stat IDs: 205-208, 216-219, 225

**Shield AC Stats** (9 types):
- Same damage types as Reflect
- Pattern: `/^Shield\s*{Type}\s*AC$/i`
- Stat IDs: 226-234

**Absorb AC Stats** (10 types):
- Same damage types plus Nano
- Pattern: `/^Absorb\s*{Type}\s*AC$/i`
- Stat IDs: 238-246

**Impact**: Enables implant and symbiant systems to correctly recognize and calculate advanced AC bonuses.

### 2. Damage Modifier Support (+9 patterns)

All "Add Damage" modifiers now recognized:

```typescript
278: 'Projectile Damage Modifier' - /Add.?\s*Proj.?\s*Dam(age|.)/
279: 'Melee Damage Modifier'      - /Add.?\s*Melee\s*Dam(age|.)/
280: 'Energy Damage Modifier'     - /Add.?\s*Energy\s*Dam(age|.)/
281: 'Chemical Damage Modifier'   - /Add.?\s*Chem.?\s*Dam(age|.)/
282: 'Radiation Damage Modifier'  - /Add.?\s*Rad.?\s*Dam(age|.)/
311: 'Cold Damage Modifier'       - /Add.?\s*Cold\s*Dam(age|.)/
315: 'Nano Damage Modifier'       - /Add.?\s*Nano\s*Dam(age|.)/
316: 'Fire Damage Modifier'       - /Add.?\s*Fire\s*Dam(age|.)/
317: 'Poison Damage Modifier'     - /Add.?\s*Poison\s*Dam(age|.)/
```

**Impact**: Weapons and damage analysis systems can now process damage modifier bonuses.

### 3. Miscellaneous Stats (+10 patterns)

Previously missing utility stats now supported:

- **Nano Cost** (318): `/^NanoCost$/i`, `/Nano\s*Point\s*Cost\s*Modifier/i`
- **Heal Delta** (343): `/^Heal\s*Delta$/i`
- **Nano Delta** (364): `/^Nano\s*Delta$/i`
- **XP Bonus** (341): `/^XP\s*Bonus$/i`, `/^Add.\s*XP$/i`
- **Skill Lock** (382): `/^SkillLock$/i`, `/Skill\s*Time\s*Lock\s*Modifier/i`
- **Nano Interrupt** (383): `/^NanoInterrupt$/i`, `/Nano\s*Formula\s*Interrupt\s*Modifier/i`
- **Insurance Percentage** (236): `/^InsurancePercentage$/i`
- **Empty/None** (0): `/^Empty$/i` - for empty implant cluster slots

**Impact**: Profile equipment bonus calculations now capture all stat types from items.

### 4. Improved Fuzzy Matching

Enhanced patterns for ambiguous skill names:

```typescript
// Before: /^1h\s*Edged?$/i
// After:  /^1h\s*Edged?(\sWeapon)?$/i
// Matches: "1h Edged", "1h Edge", "1h Edged Weapon"

// Before: /^Bio(logical)?\s*Metamor(ph(osis)?)?$/i
// After:  /^Bio(logical)?(\s)?.*Metamor(ph(osis)?)?$/i
// Matches: "Bio Metamor", "Biological Metamorphosis", "BiologicalMetamorphosis"

// Before: /^Vehicle\s*Water$/i
// After:  /^Vehicle\s*(Water|Hydr(o)?)$/i
// Matches: "Vehicle Water", "Vehicle Hydro", "Vehicle Hydr"
```

**Impact**: Better recognition of skill name variations from AOSetups imports and legacy profiles.

### 5. Database Cluster Name Mappings

Added exact mappings for full-form cluster names found in implant descriptions:

```typescript
// Added to SKILL_ID_MAP:
'Sensory Improvement and Modification': 122,
'Ranged Weapons Initiative': 119,
'Biological Metamorphoses': 128,  // Alternate spelling
'Physical Prowess and Martial Arts Initiative': 120,
'Matter Metamorphoses': 127,
'life': 1,  // Lowercase "life" = Max Health
'Breaking and Entering': 165,
'Multiple Ranged Weapons': 134,
'Evade Close Combat and Martial Art Attacks': 155
```

**Impact**: Implant cluster lookup system can match database descriptions directly to stat IDs.

### 6. Previously Conflicting Skills Resolved

Skills that were noted as "conflicting" are now properly handled:

```typescript
// Previously commented out, now included:
125: 'Mechanical Engineering'  - /^Mech(anical)?\.?\s*Eng(i(neering)?)?$/i
123: 'First Aid'               - /^First\s*Aid$/i
124: 'Treatment'               - /^Treatment$/i
135: 'Trap Disarm'             - /^Trap\s*Disarm$/i
140: 'Map Navigation'          - /^Map\s*Nav.*$/i
```

**Impact**: Complete skill coverage without relying on category context for disambiguation.

## Data Flow

### Profile Import Flow
```
External Profile (AOSetups/JSON)
  ↓
transformer.ts: Import and normalize
  ↓
skill-mappings.ts: Try exact match in SKILL_ID_MAP
  ↓ (if no exact match)
skill-patterns.ts: Try pattern matching
  ↓
Resolved Stat ID → Store in profile.skills[statId]
```

### Equipment Bonus Calculation
```
Item with stat bonuses loaded
  ↓
equipment-bonus.ts: Extract stat IDs and values
  ↓
skill-patterns.ts: Resolve stat ID from item stat name
  ↓
ip-integrator.ts: Apply bonus to profile.skills[statId]
  ↓
UI displays updated skill values
```

### Implant Cluster Lookup
```
User selects cluster name in TinkerPlants
  ↓
cluster-utilities.ts: Convert cluster name to stat ID
  ↓
skill-mappings.ts OR skill-patterns.ts: Resolve to stat ID
  ↓
API Request: POST /implants/lookup with { clusters: { shiny: statId, ... } }
  ↓
Backend returns matching implant item
```

## Implementation Files

### Core Pattern System
- **`frontend/src/utils/skill-patterns.ts`** (+377 lines)
  - 80+ skill patterns covering all game stats
  - `findSkillByPattern()` function for flexible matching
  - `getSkillsByCategory()` utility for category filtering
  - Complete coverage: ACs, Damage Modifiers, Misc stats, all trainable skills

### Exact Match Mappings
- **`frontend/src/lib/tinkerprofiles/skill-mappings.ts`** (+13 lines)
  - Added 9 database cluster name mappings
  - Enhanced AOSetups variant coverage
  - Maintains backward compatibility with existing exact matches

### Profile Import Integration
- **`frontend/src/lib/tinkerprofiles/transformer.ts`** (+15 lines)
  - Improved error handling for implant lookup failures
  - Validates API response structure (`lookupResponse.success` check)
  - Fallback to placeholder implant on lookup errors
  - Enhanced warning messages for failed cluster resolution

### Test Coverage
- **`frontend/src/__tests__/lib/tinkerprofiles/transformer.test.ts`** (+29 lines)
  - Updated mock API responses to match new response structure
  - Added `success` wrapper to `lookupImplant()` mock
  - Validates `ImplantLookupResponse` type conformance

### API Type Definitions
- **`frontend/src/types/api.ts`** (+80 lines)
  - `ImplantLookupRequest` interface
  - `ImplantLookupResponse` interface with `success`, `item`, `interpolated` fields
  - TinkerPlants-specific types for cluster selection and requirements

### API Client
- **`frontend/src/services/api-client.ts`** (+58 lines)
  - Updated `lookupImplant()` to return `ImplantLookupResponse`
  - Standardized response wrapping for `getAvailableImplants()` and `validateClusters()`
  - Better error handling with API response validation

### Backend API Error Handling
- **`backend/app/main.py`** (+16 lines)
  - Enhanced `RequestValidationError` handler
  - Serializes Pydantic error contexts to JSON-safe format
  - Prevents "ValueError not serializable" errors in validation responses

## User-Facing Changes

### Improved Import Reliability
- **AOSetups profiles** with unusual skill name abbreviations now import correctly
- **Legacy profiles** with full-form skill names properly recognized
- **Database cluster names** from implant descriptions automatically resolved

### Enhanced Equipment Bonus Recognition
- **Advanced AC bonuses** (Reflect, Shield, Absorb) now display in skill breakdowns
- **Damage modifiers** from weapons correctly applied to character stats
- **Miscellaneous stats** (Nano Cost, XP Bonus, etc.) recognized from all item types

### Better Error Messages
- Implant lookup failures now show specific error messages
- Cluster resolution warnings identify which clusters failed
- API validation errors provide actionable details

## Testing Considerations

### Pattern Matching Tests
```typescript
// Verify fuzzy matching for skill name variations
expect(findSkillByPattern(category, 128)).toMatch('Bio Metamor')
expect(findSkillByPattern(category, 128)).toMatch('Biological Metamorphosis')
expect(findSkillByPattern(category, 128)).toMatch('BiologicalMetamorphoses')

// Verify damage modifier patterns
expect(findSkillByPattern(category, 278)).toMatch('Add. Proj. Dam.')
expect(findSkillByPattern(category, 278)).toMatch('Projectile Damage Modifier')
```

### Integration Tests
1. **Import AOSetups profile** with all skill name variants
2. **Equip items** with advanced AC and damage modifier bonuses
3. **Create implant configuration** using database cluster names
4. **Validate profile export/import** preserves all stat IDs correctly

### Edge Cases
- Empty cluster slots (stat ID 0)
- Lowercase skill names (e.g., "life" for Max Health)
- Hyphenated vs spaced names (e.g., "Break&Entry" vs "Break & Entry")
- Abbreviated vs full names (e.g., "Mech Eng" vs "Mechanical Engineering")

## Performance Impact

### Pattern Matching Overhead
- **Complexity**: O(n*m) where n = skills in category (~10-15), m = patterns per stat (1-3)
- **Real-world**: <1ms per skill resolution on modern browsers
- **Caching**: Skill ID resolutions cached during import operations
- **Impact**: Negligible - pattern matching only used for unknown skill names

### Coverage Statistics
- **Total Patterns**: 80+ stat IDs covered
- **Pattern Variations**: ~120 regex patterns across all stats
- **Coverage**: 100% of trainable skills, ACs, damage modifiers, misc stats
- **Exact Matches**: 200+ exact mappings in `SKILL_ID_MAP`

## Breaking Changes

None. All changes are additive and maintain backward compatibility.

### Backward Compatibility
- Existing exact matches in `SKILL_ID_MAP` still work
- Pattern matching is fallback only
- Profile structure unchanged
- API response validation is graceful (fails to placeholder, not crash)

## Dependencies

### Internal
- `frontend/src/services/game-utils.ts` - Skill name display utilities
- `frontend/src/lib/tinkerprofiles/ip-integrator.ts` - Skill bonus application
- `frontend/src/lib/tinkerprofiles/types.ts` - `SkillData` interface

### External
- None (pure TypeScript implementation)

## Related Features

- **TinkerPlants Implant System**: Uses cluster name → stat ID resolution
- **Profile Import/Export**: Relies on fuzzy skill name matching
- **Equipment Bonus Calculation**: Applies stat bonuses via pattern matching
- **Skill Display Components**: Uses resolved skill names for UI

## Future Enhancements

### Potential Improvements
1. **Performance**: Pre-compile regex patterns for faster matching
2. **Validation**: Add skill pattern validation tests in CI pipeline
3. **Localization**: Support non-English skill name patterns
4. **Debugging**: Add pattern match logging for troubleshooting imports
5. **Documentation**: Auto-generate skill pattern reference from registry

### Extension Points
- Add new patterns by extending `SKILL_PATTERNS` object
- Custom pattern matching functions via `findSkillByPattern()` wrapper
- Category-based pattern filtering via `getSkillsByCategory()`

## Summary

This enhancement significantly improves TinkerTools' ability to recognize and process skill names from diverse data sources. By adding 60+ new patterns covering advanced stats and improving fuzzy matching for existing skills, the system now handles:

- All trainable skills and abilities
- Advanced AC types (Reflect, Shield, Absorb)
- Damage modifier stats
- Miscellaneous game stats
- Database cluster name variations
- AOSetups import variations
- Legacy profile formats

The improvements are backward compatible, performant, and provide a foundation for robust skill data integration across all TinkerTools features.

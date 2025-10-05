# WornItem Requirement Filtering for TinkerNukes

## Overview
WornItem requirement filtering enables TinkerNukes to properly filter offensive nanos based on equipment-specific flags. This ensures that nanos requiring specific worn equipment (like weapons or armor with special properties) are only shown when the character has the required equipment equipped.

## User Perspective
When a user loads a TinkerProfile into TinkerNukes, nanos that require specific equipment flags are now correctly filtered. For example, if a nano requires a specific weapon type to be worn, it will only appear in the results table if the character's equipped items provide that WornItem flag.

The filtering happens automatically when:
1. User loads a TinkerProfile with equipped items
2. Equipment bonuses are calculated, including WornItem flags (stat 355)
3. Nanos are filtered using action-criteria validation
4. Only nanos with all requirements met (including WornItem flags) are displayed

## Data Flow
1. **Equipment Loading**: Profile equipment is loaded from TinkerProfile
2. **Flag Extraction**: `equipment-bonus-calculator` extracts WornItem flags from spell 53139 on equipped items
3. **Flag Aggregation**: Multiple WornItem flags are combined using bitwise OR operation
4. **Profile Integration**: Aggregated flags stored in `profile.skills[355].total`
5. **Character Conversion**: `convertInputStateToCharacter()` maps `profile.skills[355]` to `Character.baseStats[355]`
6. **Requirement Validation**: `checkActionRequirements()` validates WornItem flags against nano requirements
7. **Display**: Only nanos with met WornItem requirements appear in results table

## Implementation

### Key Files
- `frontend/src/utils/input-to-character.ts` - Maps WornItem flags from profile to Character baseStats
- `frontend/src/utils/nuke-filtering.ts` - Filters nanos using action-criteria validation, logs filtered nanos
- `frontend/src/services/equipment-bonus-calculator.ts` - Extracts and aggregates WornItem flags from equipment

### WornItem Flag Extraction
WornItem flags are extracted from equipped items using spell ID 53139:
```typescript
// In equipment-bonus-calculator.ts
if (spell.spell_id === 53139) {
  const bitNumValue = params.BitNum ?? params.bitNum
  if (typeof bitNumValue === 'number') {
    amount = 1 << bitNumValue  // Convert bit position to flag value
  }
}
```

### Flag Aggregation
Multiple WornItem flags are combined using bitwise OR to preserve all equipped flags:
```typescript
// In equipment-bonus-calculator.ts - aggregateBonuses()
if (bonus.statId === 355) {
  aggregated[bonus.statId] |= bonus.amount  // Bitwise OR for flags
} else {
  aggregated[bonus.statId] += bonus.amount  // Addition for normal stats
}
```

### Character Mapping
WornItem flags flow from profile to Character interface:
```typescript
// In input-to-character.ts
const baseStats: Record<number, number> = {
  // ... other stats ...

  // WornItem equipment flags (stat 355) - pulled from profile equipment bonuses
  355: profile?.skills[355]?.total ?? 0,
}
```

### Debug Logging
Console logging added to help debug filtered nanos:
```typescript
// In nuke-filtering.ts - filterByCharacterProfile()
if (!result.canPerform) {
  console.log(`[FILTERED OUT] ${nano.name} (ID: ${nano.id}, QL: ${nano.qualityLevel})`)
  console.log('  Unmet requirements:', result.unmetRequirements)
}
```

## Technical Details

### WornItem Stat (355)
- **Purpose**: Bitfield representing equipped item flags
- **Format**: Each bit position represents a different equipment requirement
- **Extraction**: Spell 53139 uses `BitNum` parameter to set specific bits
- **Aggregation**: Bitwise OR combines flags from multiple equipped items
- **Validation**: Action-criteria system checks flags against nano requirements

### Spell 53139 Format
```typescript
{
  spell_id: 53139,
  params: {
    Stat: 355,      // WornItem stat ID
    BitNum: 5       // Bit position (e.g., 5 = flag value 32)
  }
}
```

## Configuration
- No environment variables required
- Requires TinkerProfile with equipped items to function
- Falls back to 0 (no flags) when no profile loaded

## Usage Example
```typescript
// Load profile and convert to Character
const profile = loadTinkerProfile()
const character = convertInputStateToCharacter(inputState, profile)

// Character.baseStats[355] now contains aggregated WornItem flags
console.log(character.baseStats[355]) // e.g., 96 (flags at bit positions 5 and 6)

// Filter nanos - WornItem requirements automatically validated
const castableNanos = filterByCharacterProfile(allNanos, character)
```

## Testing
**Manual test**:
1. Load a TinkerProfile with equipped items that have WornItem flags
2. Open browser console to view debug logging
3. Observe filtered nanos with unmet WornItem requirements in console
4. Verify that only nanos with met requirements appear in table

**Expected behavior**:
- Nanos requiring specific equipment flags only appear when those flags are present
- Console shows filtered nanos with detailed requirement information
- WornItem flags are correctly aggregated from multiple equipped items using bitwise OR

## Related Documentation
- Equipment bonus calculation: `frontend/src/services/equipment-bonus-calculator.ts`
- Action-criteria validation: `frontend/src/services/action-criteria.ts`
- TinkerNukes feature: `.docs/features/tinker-nukes.doc.md`

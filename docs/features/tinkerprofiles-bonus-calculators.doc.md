# TinkerProfiles Bonus Calculator Architecture

## Overview

The TinkerProfiles bonus calculator system underwent a major architectural refactoring in September 2025 to improve type safety, performance, and maintainability. This document describes the enhanced service architecture and calculation logic changes.

## What Changed

### Service Architecture Improvements

**Before**: Each calculator returned `Record<string, number>` (skill name → bonus)
**After**: All calculators return `Record<number, number>` (skill ID → bonus)

This change provides:
- **Type Safety**: Eliminates string-based skill name inconsistencies
- **Performance**: Avoids repeated skill name lookups and conversions
- **Consistency**: Unified interface across all bonus calculation services
- **Maintainability**: Single source of truth for skill identification

### Enhanced Calculation Logic

#### Equipment Bonus Calculator (`equipment-bonus-calculator.ts`)
- **Skill Service Integration**: Replaced `skill-registry` utility with `skillService` for ID validation
- **Removed Redundant Conversions**: Eliminated intermediate skill name conversions during parsing
- **Enhanced Error Handling**: Better validation of stat IDs with structured error reporting
- **Type System Updates**: `StatBonus` interface simplified to use only `statId` field

#### Nano Bonus Calculator (`nano-bonus-calculator.ts`)
- **Preserved All Bonuses**: Removed stat ID validation to capture all nano effects
- **Caller-Side Filtering**: Delegated skill ID filtering to consuming code
- **Streamlined Parsing**: Eliminated skill name conversion during nano spell parsing
- **Performance Optimization**: Reduced overhead in nano-specific calculations

#### Perk Bonus Calculator (`perk-bonus-calculator.ts`)
- **Direct Stat ID Usage**: Perks now work directly with stat IDs without name conversion
- **Enhanced Error Recovery**: Improved fallback mechanisms for corrupt cache or invalid data
- **Safe Aggregation**: Added `safeAggregateBonuses` method with individual error handling
- **Robust Validation**: Enhanced input validation with type checking at multiple levels

### AC Calculator Refinements (`ac-calculator.ts`)

**New Conversion Pattern**: The AC calculator now handles the skill ID → name conversion at the point of use:

```typescript
// Convert skill IDs back to skill names for AC lookup
const perkBonusesBySkillId = calculatePerkBonuses(allPerkItems);
perkBonuses = {};
for (const [skillIdStr, bonusAmount] of Object.entries(perkBonusesBySkillId)) {
  const skillId = Number(skillIdStr);
  try {
    const skillName = skillService.getName(skillId);
    perkBonuses[skillName] = bonusAmount;
  } catch (error) {
    console.warn(`Failed to convert skill ID ${skillId} to name in AC calculation:`, error);
  }
}
```

### Profile Stats Mapper Overhaul (`profile-stats-mapper.ts`)

**Complete Rewrite** to support TinkerProfiles v4.0.0 structure:

- **Direct ID Access**: Uses `profile.skills` with direct skill ID keys
- **Unified Skill Structure**: Leverages new SkillData structure with `total` values
- **Enhanced Character Properties**: Improved handling of MaxHealth, MaxNano, Level, Breed, Profession
- **Default Value Management**: Comprehensive default skill value handling for requirements checking

## Data Flow

### New Architecture Data Flow

```
Equipment/Nano/Perk Items
         ↓
[Parse Spell Data → Extract stat ID + amount]
         ↓
[Aggregate by Stat ID → Record<number, number>]
         ↓
[Consumer converts to names if needed]
         ↓
Apply to Profile Skills
```

### Key Benefits

1. **Single Conversion Point**: Skill ID → name conversion happens only where needed
2. **Error Isolation**: Invalid skill IDs don't break entire calculation chains
3. **Performance**: Eliminates redundant conversions during aggregation
4. **Debugging**: Clearer error messages with specific stat ID information

## File Impact Summary

### Core Calculator Services
- `equipment-bonus-calculator.ts`: Enhanced type safety, integrated `skillService`
- `nano-bonus-calculator.ts`: Preserved all bonuses, removed validation filtering
- `perk-bonus-calculator.ts`: Added robust error recovery, safe aggregation patterns

### Utility Components
- `ac-calculator.ts`: Handles skill ID to name conversion for AC lookups
- `profile-stats-mapper.ts`: Complete rewrite for v4.0.0 profile structure

## Implementation Patterns

### Bonus Calculation Pattern
```typescript
// All calculators follow this signature
calculateBonuses(items: Item[]): Record<number, number>

// Consumer handles name conversion if needed
const bonusesBySkillId = calculateEquipmentBonuses(profile);
const bonusesBySkillName = convertSkillIdsToNames(bonusesBySkillId);
```

### Error Handling Pattern
```typescript
// Enhanced error reporting with recoverable/non-recoverable classification
interface CalculationResult {
  bonuses: Record<number, number>
  warnings: BonusError[]
  errors: BonusError[]
  success: boolean
}
```

### Cache Optimization Pattern
```typescript
// LRU caches optimized for skill ID-based aggregation
class BonusAggregationCache {
  private cache = new Map<string, Record<number, number>>()
  // ... cache management with error recovery
}
```

## Performance Impact

### Improvements
- **Reduced Conversions**: Eliminated redundant skill name lookups during aggregation
- **Optimized Caching**: Cache keys based on stat IDs instead of variable skill names
- **Faster Aggregation**: Direct numeric operations instead of string manipulations

### Monitoring
- Equipment bonuses: Target <100ms (maintained)
- Nano bonuses: Target <50ms (improved due to reduced validation)
- Perk bonuses: Target <200ms (maintained with better error recovery)

## Migration Notes

### Breaking Changes
- All bonus calculator return types changed from `Record<string, number>` to `Record<number, number>`
- `StatBonus`, `NanoStatBonus`, `PerkStatBonus` interfaces no longer include `skillName` field
- `profile-stats-mapper.ts` completely rewritten for v4.0.0 structure

### Compatibility
- AC calculations continue to work with skill names via runtime conversion
- Error handling improved with better fallback mechanisms
- Existing profile data structures remain compatible

## Future Considerations

### Planned Enhancements
- **Streaming Calculations**: Process large bonus sets in chunks
- **Worker Thread Support**: Move heavy calculations to web workers
- **Memoization Expansion**: Cache entire calculation chains, not just individual steps

### Architecture Benefits
- **Extensibility**: Easy to add new bonus sources without string mapping concerns
- **Testing**: More predictable behavior with numeric IDs
- **Debugging**: Clear stat ID trails through calculation pipelines
- **Performance**: Optimized for scale with large equipment/perk combinations

## Symbiant Integration (November 2025)

### Overview
The equipment bonus calculator was enhanced to support symbiants alongside traditional items. Symbiants are treated as a distinct item type that can occupy implant slots but have different data structures.

### Key Changes

#### Type System Enhancements
All bonus calculation methods now accept `Item | SymbiantItem` union types:
```typescript
parseItemSpells(item: Item | SymbiantItem): StatBonus[]
processEquipmentSlots(equipmentSlots: Record<string, Item | SymbiantItem | null>, bonuses: StatBonus[]): void
```

#### Profile Processing Updates
- **Slot Renaming**: `profile.HUD` renamed to `profile.Symbiants` for semantic accuracy
- **Unified Processing**: Symbiants processed through same bonus calculation pipeline as items
- **Cache Compatibility**: AOID-based cache keys work for both items and symbiants

#### Equipment Display Integration
The `EquipmentSlotsDisplay.vue` component handles mixed implant/symbiant slots:
```typescript
// Type guard distinguishes item types
if (isSymbiant(item)) {
  // Symbiants use AOID for icon lookup (no stats property)
  iconUrl = `https://cdn.tinkeringidiot.com/static/icons/${item.aoid}.png`;
} else {
  // Regular items use stats
  iconUrl = getItemIconUrl((item as Item).stats);
}
```

### Data Structure Differences

| Property | Item | SymbiantItem |
|----------|------|--------------|
| `stats` | Array of StatValue | Not present |
| `family` | Not present | String (Artillery, Control, etc.) |
| `slot_id` | Via stats lookup | Direct property |
| Icon lookup | Via stats | Via AOID |
| Bonus source | `spell_data` | `spell_data` |

### Type Guard Usage
The `isSymbiant()` type guard enables safe type discrimination:
```typescript
export function isSymbiant(item: Item | SymbiantItem): item is SymbiantItem {
  return 'family' in item && 'slot_id' in item;
}
```

### Implementation Impact
- **No Performance Degradation**: Cache and parsing logic unchanged
- **Backward Compatible**: Existing profiles with items continue to work
- **Unified Bonus Calculation**: Both item types processed identically for spell_data parsing
- **Correct Icon Display**: Symbiants now render with proper icons

## Developer Guidelines

### When Working with Bonuses
1. **Use Skill IDs**: Work with numeric stat IDs throughout calculation pipelines
2. **Convert at Edges**: Only convert to skill names at UI or AC calculation boundaries
3. **Handle Errors Gracefully**: Use error recovery patterns from the enhanced calculators
4. **Cache Wisely**: Leverage existing cache infrastructure rather than adding new layers
5. **Support Both Item Types**: Use `Item | SymbiantItem` union types in equipment-related code
6. **Use Type Guards**: Apply `isSymbiant()` when item-type-specific logic is needed

### Testing Considerations
- **Stat ID Validation**: Test with valid and invalid stat IDs
- **Error Recovery**: Verify calculations continue when individual items fail
- **Performance Bounds**: Ensure calculations stay within target time limits
- **Cache Behavior**: Test cache hit/miss scenarios and corruption recovery
- **Mixed Equipment**: Test profiles with both items and symbiants equipped
- **Icon Rendering**: Verify both item types display correct icons

This refactoring establishes a robust foundation for bonus calculations while maintaining backward compatibility and improving system reliability. The symbiant integration extends this foundation to support both traditional items and symbiants seamlessly.
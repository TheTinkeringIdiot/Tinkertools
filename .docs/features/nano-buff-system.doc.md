# Nano Buff System

## Overview
The Nano Buff System allows players to cast nano programs as temporary buffs on their TinkerProfiles, automatically calculating stat bonuses and managing NCU (Nano Computer Unit) consumption for accurate profile representation.

## User Perspective
Players can cast nano programs as buffs from any item view (ItemDetail, ItemCard, ItemList, ItemQuickView) by clicking the "Cast Buff" button on nano items. Active buffs appear in a dedicated BuffTable component within their profile view, showing each buff's icon, name, NCU cost, and removal options. The system automatically prevents conflicts based on NanoStrain properties and enforces NCU limits, providing clear feedback when buffs cannot be cast.

## Data Flow
1. **User clicks "Cast Buff"** on a nano item from TinkerItems views
2. **System validates** NCU availability and buff conflicts using NanoStrain (stat 75)
3. **Conflict resolution** removes existing buffs with lower StackingOrder priority (stat 551)
4. **Nano bonus calculator** parses spell_data for stat modifications using spell IDs 53045, 53012, 53014, 53175
5. **Profile recalculation** updates all skill values with new buff bonuses
6. **UI updates** refresh skill displays, BuffTable, and NCU tracking

## Implementation

### Key Files
- `frontend/src/services/nano-bonus-calculator.ts` - Core service for parsing nano spell effects and calculating stat bonuses
- `frontend/src/components/profiles/buffs/BuffTable.vue` - Visual display of active buffs with NCU management
- `frontend/src/stores/tinkerProfiles.ts` - Pinia store managing buff state and profile integration
- `frontend/src/lib/tinkerprofiles/types.ts` - Type definitions including buff arrays in TinkerProfile
- `frontend/src/lib/tinkerprofiles/ip-integrator.ts` - IP calculation integration with buff bonuses
- `frontend/src/components/profiles/skills/SkillSlider.vue` - Skill display with buff effect visualization
- `frontend/src/components/profiles/skills/StatBreakdownTooltip.vue` - Detailed breakdown showing buff contributions

### Database
- Uses existing item data with `spell_data` arrays containing nano program effects
- NCU cost stored in stat 54 (Level stat for nano programs)
- NanoStrain stored in stat 75 for conflict detection
- StackingOrder stored in stat 551 for priority resolution

## Configuration
- Buff system integrated into existing TinkerProfiles without additional configuration
- Performance optimization with LRU caching (200 item cache for nano spells)
- Sub-50ms calculation requirement for nano bonus processing

## Usage Example
```typescript
// Cast a buff from ItemDetail view
const profilesStore = useTinkerProfilesStore()

async function castBuff() {
  if (!item.is_nano) return

  try {
    await profilesStore.castBuff(item)
    // System automatically:
    // - Validates NCU capacity
    // - Resolves buff conflicts
    // - Calculates stat bonuses
    // - Updates profile skills
  } catch (error) {
    // Handle casting errors (NCU full, conflicts, etc.)
  }
}

// Remove specific buff
await profilesStore.removeBuff(buffItem.id)

// Clear all buffs
await profilesStore.removeAllBuffs()
```

## Testing
- **Manual test**: Navigate to TinkerItems, select a nano program, click "Cast Buff" while having an active TinkerProfile
- **Expected behavior**:
  - Buff appears in profile's BuffTable
  - NCU count increases appropriately
  - Skill values update with buff bonuses
  - Conflict detection prevents duplicate NanoStrains
  - Removal functions work correctly

## Architecture Decisions

### Nano Bonus Calculator Service
- **Comprehensive error handling**: Individual nano parsing failures don't break entire calculation
- **Performance optimization**: LRU caching and memoization for sub-50ms requirement
- **Flexible parsing**: Handles multiple spell parameter formats and spell IDs
- **Event filtering**: Only processes nano-specific events (Cast=1, Wear=14)

### Buff Management in Store
- **Conflict resolution**: Automatic handling of NanoStrain conflicts with StackingOrder priority
- **NCU tracking**: Real-time calculation and validation of nano computer usage
- **Reactive updates**: Vue watchers ensure UI stays synchronized with buff changes
- **Error recovery**: Graceful handling of parsing errors with fallback to zero bonuses

### UI Integration
- **Contextual casting**: "Cast Buff" buttons appear throughout item views for nano programs
- **Visual feedback**: BuffTable shows active effects with tooltips and NCU tracking
- **Skill integration**: Skill displays automatically include buff bonuses in calculations
- **Responsive design**: BuffTable adapts to different screen sizes

## Related Documentation
- API: Item data structure in `frontend/src/types/api.ts`
- Architecture: TinkerProfiles storage system in `frontend/src/lib/tinkerprofiles/CLAUDE.md`
- Skill mappings: `frontend/src/lib/tinkerprofiles/skill-mappings.ts`
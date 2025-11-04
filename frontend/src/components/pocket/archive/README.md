# Archived TinkerPocket Components

These components have been archived as part of the TinkerPocket refactor. They have been replaced by:

## Replaced Components

### PocketBossDatabase.vue

**Replaced by:** `FindGear.vue` (Boss view)

- Boss listing is now integrated into the unified FindGear component
- Boss details moved to dedicated BossDetail.vue view
- Features preserved: search, playfield filter, level range, grid/list view

### SymbiantLookup.vue

**Replaced by:** `FindGear.vue` (Symbiant view)

- Symbiant search is now integrated into the unified FindGear component
- Enhanced with profile-based filtering
- Smart filtering by family, slot, QL range

### BossSymbiantMatcher.vue

**Status:** Archived for potential future enhancement

- Functionality may be reintegrated as a special view mode
- Keep for reference if matching feature is requested

## Migration Notes

- Main route `/pocket` now shows FindGear with two internal views: Symbiants and Bosses
- Compare functionality preserved in SymbiantCompare.vue component
- CollectionTracker.vue kept for future use
- Boss detail route: `/pocket/bosses/:id` → BossDetail.vue
- Symbiant detail route: `/items/:aoid` → ItemDetail.vue (TinkerItems)

## Date Archived

2025-10-07

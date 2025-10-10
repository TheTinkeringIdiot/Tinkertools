# Symbiant Comparison Feature

## Overview

The Symbiant Comparison feature allows players to compare up to 3 symbiants side-by-side, viewing their requirements and stat bonuses simultaneously. This helps players make informed decisions about which symbiants to farm or equip.

## User Perspective

### What It Does

- Enables 3-way comparison of any symbiants in the database
- Displays requirements and stat modifiers in separate, organized tables
- Highlights the best value for each stat (lowest requirement / highest bonus)
- Provides shareable URLs for comparison configurations
- Intuitive "select for comparison" pattern with visual feedback

### How To Use

1. Navigate to the TinkerPocket app and select the "Browse" tab
2. Use filters to find symbiants of interest (family, slot, quality level, etc.)
3. Click the "Compare" button (clone icon) on any symbiant card to add it to comparison
   - Button shows checkmark icon when selected
   - Badge displays "X/3 selected" count
   - Toast notification appears when comparison is full (3 symbiants)
4. Click the "Compare" tab to view selected symbiants side-by-side
5. View the comparison tables that automatically populate:
   - **Requirements**: Shows stat requirements with lowest values highlighted in green
   - **Stat Bonuses**: Shows stat modifications with highest values highlighted in green
6. Clear individual selections with the X button on each symbiant card or clear all with "Clear All"
7. Share the comparison by copying the URL (includes selected symbiants as query parameters)

### Key Benefits

- **Quick Comparison**: See requirements and bonuses at a glance
- **Best Value Highlighting**: Green highlighting shows which symbiant has the best value for each stat
- **Shareable Links**: URL includes selection state for easy sharing with teammates
- **Flexible Selection**: Compare across different families, slots, or quality levels
- **Cross-Tab State**: Selection persists when navigating between Browse and Compare tabs
- **Visual Feedback**: Clear indication of selected items and selection count

## Data Flow

### Selection Flow

```
FindGear.vue (Browse Tab)
  ↓ User clicks "Compare" button on symbiant card
useSymbiantsStore.addToComparison()
  ↓ Updates selectedForComparison array [null, null, null] → [symbiant1, null, null]
  ↓ Returns false if all 3 slots full
FindGear.vue shows toast notification (if full)
  ↓ Visual feedback: button icon changes to checkmark, badge updates "1/3 selected"
User navigates to Compare tab
  ↓
SymbiantCompare.vue loads
  ↓ Checks URL params first, then store state
  ↓ Loads selectedForComparison from store
Displays selected symbiants in slot-based UI
  ↓ User can clear individual slots or all
  ↓ Updates sync back to store
```

### Component Flow

```
SymbiantCompare.vue
  ↓ (loads symbiant list)
useSymbiantsStore
  ↓ (API call)
/api/v1/symbiants (Backend)
  ↓ (queries with spell_data)
symbiant_items materialized view + items + spells tables
  ↓ (returns symbiants with full spell data)
SymbiantCompare.vue
  ↓ (extracts stats from spell_data)
Displays comparison tables
```

### Data Extraction

1. **Symbiant Loading**: Component loads all symbiants via `loadAllSymbiants()` store action
2. **User Selection**: User clicks compare buttons on symbiant cards in Browse tab
3. **Store State Management**: Store maintains array of 3 symbiant slots, filled sequentially
4. **Spell Data Parsing**: Selected symbiants' spell_data is parsed to extract stat bonuses
   - Filters for spell_id 53045 (Modify stat spell)
   - Extracts Stat ID and Amount from spell_params
5. **Stat Aggregation**: Stats from all selected symbiants are aggregated into comparison rows
6. **Value Highlighting**: Best values calculated per stat (min for requirements, max for modifiers)
7. **URL Persistence**: Selection state encoded in query params (s1, s2, s3), overrides store on load

### Critical Stat Extraction Logic

The component uses spell_data to determine stat bonuses:
- **spell_id 53045**: "Modify stat" spell that provides symbiant bonuses
- **spell_params.Stat**: The stat ID (maps to STAT constants)
- **spell_params.Amount**: The stat bonus amount

## Implementation Files

### Frontend Components

- **`frontend/src/components/pocket/SymbiantCompare.vue`**: Main comparison component
  - Displays selected symbiants in 3 slot-based UI cards
  - Loads selection state from Pinia store
  - Stat extraction from spell_data
  - Comparison table rendering with highlighting
  - URL persistence logic (URL params take priority over store state)
  - Bi-directional sync with store (updates store when cleared)

- **`frontend/src/apps/tinkerpocket/views/FindGear.vue`**: Browse/search view
  - Compare buttons on each symbiant card
  - Visual feedback for selected items (icon changes, severity color)
  - Badge displaying "X/3 selected" count
  - Toast notifications when comparison is full
  - Clear comparison button when items are selected

### Frontend Stores

- **`frontend/src/stores/symbiants.ts`**: Symbiant data store with comparison state
  - **State**: `selectedForComparison: ref<(Symbiant | null)[]>` - Array of 3 slots
  - **Actions**:
    - `addToComparison(symbiant)`: Adds symbiant to first empty slot, returns false if full
    - `removeFromComparison(symbiantId)`: Removes symbiant by ID from comparison
    - `clearComparison()`: Clears all comparison selections
    - `isInComparison(symbiantId)`: Checks if symbiant is selected, returns slot index or null
    - `getComparisonCount()`: Returns count of selected symbiants
  - `loadAllSymbiants()`: Fetches all symbiants (cached)
  - `allSymbiants`: Computed property with all loaded symbiants

### Frontend Types

- **`frontend/src/types/api.ts`**: TypeScript type definitions
  - `Symbiant`: Symbiant response type with spell_data
  - `SpellData`: Spell information including spell_id and spell_params
  - `SpellParams`: Parameters including Stat and Amount for stat modifications

### Backend API

- **`backend/app/api/routes/symbiants.py`**: Symbiant API endpoints
  - `list_symbiants()`: Returns symbiants with spell_data for stat extraction
  - `get_symbiant()`: Returns individual symbiant with spell_data
  - Efficient eager loading prevents N+1 query issues

### Backend Schemas

- **`backend/app/api/schemas/symbiant.py`**: Response schemas
  - `SymbiantResponse`: Includes spell_data field
  - Spell data supports stat bonus extraction

## Technical Details

### Database Dependencies

- **`symbiant_items` materialized view**: Provides symbiant metadata (name, family, slot, QL)
- **`items` table**: Base item data
- **`spells` table**: Spell data for stat modifications

### Performance Considerations

- **Store Caching**: Symbiant data cached in Pinia store to minimize API calls
- **Reactive State**: Comparison state managed via Pinia for cross-component reactivity
- **Sequential Slot Filling**: Fills first available slot for predictable behavior
- **Memoization**: Comparison data computed via Vue computed properties (cached)
- **Cross-Tab Sync**: Store state persists across tab navigation without re-fetching

### URL State Management

Query parameters:
- `s1`: First symbiant ID
- `s2`: Second symbiant ID
- `s3`: Third symbiant ID

Example: `/pocket?s1=123&s2=456&s3=789`

**Priority**: URL params override store state on load, allowing shareable links to work regardless of local selection state.

## Related Features

- **Boss Detail Page**: Shows symbiants dropped by specific boss
- **Find Gear**: Main symbiant search and filtering interface
- **TinkerItems**: Detailed view of individual symbiants

## Testing

### Manual Testing Steps

1. **Selection Flow**:
   - Navigate to TinkerPocket Browse tab
   - Click compare button on a symbiant card
   - Verify button icon changes to checkmark and severity changes to success
   - Verify badge shows "1/3 selected"
   - Select 2 more symbiants
   - Verify badge updates to "2/3 selected" then "3/3 selected"
   - Try to select a 4th symbiant
   - Verify toast notification appears: "Comparison full (maximum 3 symbiants)"

2. **Cross-Tab State**:
   - With 3 symbiants selected in Browse tab
   - Navigate to Compare tab
   - Verify all 3 selected symbiants appear in slot cards
   - Clear one symbiant using X button on slot card
   - Return to Browse tab
   - Verify that symbiant's button is no longer in selected state
   - Verify badge shows "2/3 selected"

3. **URL Sharing**:
   - Select 3 symbiants
   - Navigate to Compare tab
   - Copy URL from browser
   - Clear all selections
   - Paste URL and navigate
   - Verify comparison loads with the 3 symbiants from URL

4. **Clear Functions**:
   - Select multiple symbiants
   - Click "Clear Selection" in Browse tab
   - Verify all compare buttons return to unselected state
   - Verify badge disappears
   - Navigate to Compare tab
   - Verify all 3 slots show "Empty slot" placeholders

### Expected Behavior

- **Selection Limit**: Maximum 3 symbiants, toast shown when full
- **Visual Feedback**: Button icons and colors change immediately
- **State Persistence**: Selection persists across tab navigation
- **URL Priority**: URL params override store state
- **Bi-directional Sync**: Changes in either tab reflect in the other

## Future Enhancements

- Drag-and-drop to reorder comparison slots
- Export comparison to image/PDF
- Compare more than 3 symbiants
- Side-by-side slot comparisons (all Artillery chest pieces)
- Integration with character profiles for requirement checking
- Quick-add from boss detail page

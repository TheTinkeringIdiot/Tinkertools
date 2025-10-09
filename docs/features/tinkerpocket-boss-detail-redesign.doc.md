# TinkerPocket Boss Detail Page Redesign

## Overview
The boss detail page redesign provides a hierarchical, visually intuitive display of pocket boss information with improved geographic context and complete drop source information. The redesign emphasizes the relationship between playfield, location, and specific mob NPCs, while prominently displaying previously hidden mob names data.

## User Perspective
Users viewing a pocket boss detail page now see:
- **Boss level** prominently displayed with color-coded severity tags
- **Geographic hierarchy** showing Zone → Location → NPCs with visual connectors
- **Mob names** (NPCs that drop the pattern) displayed as interactive tags
- **Symbiant drops table** with corrected slot names using standardized game utilities

The hierarchical layout helps players understand the "where to find" question at a glance: which zone to travel to, which specific location within that zone, and which NPCs to defeat for the pattern.

## Data Flow

### Page Load
1. Frontend route `/pocket/:id` loads `BossDetail.vue` component
2. Component extracts boss ID from route params
3. Parallel API calls fetch boss data and drops:
   - `GET /api/mobs/{id}` → returns `Mob` object with `mob_names` array
   - `GET /api/mobs/{id}/drops` → returns `SymbiantItem[]` array
4. Data rendered in hierarchical layout with visual connectors

### Visual Hierarchy
1. **Root Level**: Playfield (zone) with map marker icon
2. **Child Level**: Location with left border connector and angle-right icon
3. **Grandchild Level**: Mob names as tags with deeper indentation and border connector
4. Border colors use PrimeVue theme tokens (`border-primary-200/dark:border-primary-800`)

### Interactive Elements
- **Symbiant names**: Clickable links navigate to item detail page
- **Mob name tags**: Hover effects with `scale-105` transform
- **Share button**: Copies current page URL to clipboard with toast feedback

## Implementation

### Key Files

#### Frontend Components
- `frontend/src/views/BossDetail.vue` - Main boss detail page with redesigned layout

#### Frontend Services
- `frontend/src/services/api-client.ts` - API methods: `getMob()`, `getMobDrops()`
- `frontend/src/services/game-utils.ts` - `getImplantSlotNameFromBitflag()` utility

#### Frontend Types
- `frontend/src/types/api.ts` - `Mob` interface with `mob_names: string[]` field

### Component Architecture

#### Removed Code
- **Local slot mapping**: Removed hardcoded `slotNames` object (14 entries)
- **Local slot function**: Removed `getSlotName(slotId)` helper function
- **Three-column grid**: Removed flat 3-column layout for boss info

#### Added Code
- **Hierarchical structure**: Nested divs with progressive indentation
- **Visual connectors**: Left borders with theme-aware colors
- **Icons**: Map marker (`pi-map-marker`) and angle-right (`pi-angle-right`) icons
- **Mob names display**: Conditional rendering of `mob_names` array as tags
- **Standardized utilities**: Import and use `getImplantSlotNameFromBitflag()`

#### Layout Structure
```vue
<Card>
  <!-- Boss Level (prominent) -->
  <div class="mb-6">
    <Tag :value="`Level ${boss.level}`" />
  </div>

  <!-- Where to Find (hierarchical) -->
  <div class="space-y-3">
    <i class="pi pi-map-marker"></i>
    <div class="playfield">
      {{ boss.playfield }}

      <!-- Location (child with connector) -->
      <div class="border-l-2 border-primary-200 pl-4">
        <i class="pi pi-angle-right"></i>
        {{ boss.location }}

        <!-- Mob names (grandchild with deeper connector) -->
        <div class="border-l-2 border-primary-200 pl-4">
          <Tag v-for="mob in boss.mob_names" />
        </div>
      </div>
    </div>
  </div>
</Card>
```

### Key Technical Decisions

#### Use Game Utilities for Slot Names
**Decision**: Replace local `slotNames` mapping with `getImplantSlotNameFromBitflag()` utility

**Rationale**:
- Centralized slot name mapping prevents inconsistencies
- Slot IDs are bitflags, not simple IDs (requires bitwise operations)
- Game utilities already handle edge cases and special slots
- Single source of truth for slot name display

**Impact**: Removes 22 lines of duplicate code, fixes slot name bugs

#### Hierarchical Visual Design
**Decision**: Use nested divs with left borders and progressive indentation instead of grid layout

**Rationale**:
- Geographic relationships are inherently hierarchical (Zone → Location → NPCs)
- Visual connectors clarify parent-child relationships
- Easier to scan than flat 3-column grid
- Responsive design works better with vertical hierarchy

**Tradeoff**: Uses more vertical space, but improves information clarity

#### Display Mob Names
**Decision**: Show `mob_names` array as interactive tags with hover effects

**Rationale**:
- Previously hidden data now visible to users
- Critical for players hunting specific symbiants
- Tags provide visual separation and interactive affordance
- Hover effects indicate interactivity (future: click to filter drops)

**API Dependency**: Requires `mob_names` field from `Mob` API response

#### Theme-Aware Colors
**Decision**: Use PrimeVue theme tokens for all colors

**Rationale**:
- Automatic dark mode support without custom CSS
- Consistent with rest of application
- Border colors: `border-primary-200` (light) / `border-primary-800` (dark)
- Text colors: `text-surface-900` (light) / `text-surface-50` (dark)

**Implementation**: All color classes use `dark:` variant for dark mode

### Visual Design Tokens

#### Spacing
- Root level: No left margin
- Child level (location): `ml-4` (1rem indentation)
- Grandchild level (mobs): Additional `ml-4` (total 2rem indentation)
- Vertical spacing: `mt-3` between hierarchy levels

#### Typography
- Playfield: `text-lg font-semibold`
- Location: `font-medium`
- Mob names label: `text-sm font-medium`
- Progressive size reduction shows hierarchy

#### Colors (Light/Dark Mode)
- Primary borders: `border-primary-200` / `border-primary-800`
- Headings: `text-surface-900` / `text-surface-50`
- Body text: `text-surface-700` / `text-surface-300`
- Labels: `text-surface-600` / `text-surface-400`
- Icons: `text-primary-500` (same in both modes)

#### Interactive Effects
- Mob tags: `transition-all hover:scale-105`
- Tag severity: `secondary` (neutral gray)
- Symbiant links: `text-primary-500 hover:text-primary-600`

## Configuration
No configuration required. Component uses:
- PrimeVue Aura theme for color tokens
- PrimeIcons for map-marker and angle-right icons
- Vue Router for navigation
- PrimeVue Toast for clipboard feedback

## Usage Example

### Viewing Boss Details
1. Navigate to `/pocket` (boss list page)
2. Click on any boss row or "View Details" button
3. Boss detail page loads with:
   - Boss name in header
   - Level tag (color-coded by difficulty)
   - Geographic hierarchy showing zone → location → mob names
   - Symbiant drops table with clickable item names

### Visual Hierarchy Example
```
📍 Perpetual Wastelands (playfield)
   │
   └─→ Hollow Island (location)
       │
       └─→ Pattern Dropped By:
           [Mercurial Mage] [Crystalline Warrior] [Temporal Guardian]
```

### Symbiant Drops Table
- **Name**: Clickable link to item detail page
- **Family**: Tag showing symbiant family (Artillery, Control, etc.)
- **Slot**: Human-readable slot name (Head, Eye, Chest, etc.)
- **QL**: Color-coded quality level tag

## Testing
- **Visual Testing**: Verify hierarchical layout renders correctly in light/dark modes
- **Data Display**: Confirm `mob_names` array displays as tags
- **Slot Names**: Verify slot names match game data (use `getImplantSlotNameFromBitflag`)
- **Responsive**: Test layout on mobile/tablet/desktop viewports
- **Navigation**: Click symbiant names to navigate to item detail pages
- **Clipboard**: Test share button copies URL correctly

## Migration Notes
This is a UI-only change with no database migrations required. The `mob_names` field already exists in the `mobs` table and API responses.

### Before (Flat Grid Layout)
```
Level: 200       Playfield: Perpetual Wastelands       Location: Hollow Island
```

### After (Hierarchical Layout)
```
Boss Level
  Level 200

Where to Find This Pattern
  📍 Perpetual Wastelands
     └─→ Hollow Island
         └─→ Pattern Dropped By:
             [Mob Name 1] [Mob Name 2] [Mob Name 3]
```

## Related Documentation
- Symbiant system: `docs/features/symbiant-system.doc.md`
- TinkerPocket overview: `docs/work_plan.md` (Task 16: TinkerPocket)
- Mob API: `backend/app/api/routes/mobs.py`
- Game utilities: `frontend/src/services/game-utils.ts`

# TinkerPlants - Implant and Symbiant Planning System

## Overview
TinkerPlants is a comprehensive implant and symbiant planning tool that enables users to design, optimize, and manage equipment configurations for their Anarchy Online characters. The system supports both custom implants (with cluster selection) and fixed symbiants in a unified interface. As of November 2025, TinkerPlants operates in **hybrid mode**: it works standalone without a profile (showing raw requirements) or integrates with TinkerProfiles when a profile is selected (showing comparison and met/unmet status), providing flexible planning for both character-specific and theoretical builds.

## User Perspective
Users can configure implants and symbiants across 13 body slots (Eye, Head, Ear, Right Arm, Chest, Left Arm, Right Wrist, Waist, Left Wrist, Right Hand, Leg, Left Hand, Feet). Each slot can be configured as either a custom implant (with cluster selections) or a fixed symbiant. The interface is organized into five dedicated tabs:

**Build Tab** (Configuration):
- Per-slot type toggle (Implant vs Symbiant) for flexible equipment planning
- **Implant mode**: Configure clusters (Shiny/Bright/Faded) and QLs via dropdowns
- **Symbiant mode**: Search and select symbiants by name/family via autocomplete
- Inline ClusterLookup search component for finding clusters across slots (implant mode)
- QL inputs trigger lookups on blur (not every keystroke) for optimal performance
- Auto-recalculation: Results update automatically after each change
- Attribute preference selection (defaults to "None" for no filtering)

**Requirements Tab** (Validation):
- View total attribute requirements (Treatment, Strength, etc.) with color-coded met/unmet status
- **Profile selected**: Green (met), red (unmet), shows current vs required values
- **No profile**: Neutral gray, shows requirements only without comparison
- Inspect per-implant requirement breakdowns showing which implants need which stats
- Review build requirements (Nano Programming, Jobe combining skills)
- All requirements automatically recalculated after configuration changes

**Bonuses Tab** (Results):
- Review aggregate stat bonuses across all equipped implants
- Inspect per-implant bonus breakdowns
- Automatically updated after any configuration change

**Construction Tab** (Planning):
- Automatic construction analysis as implants are configured
- Real-time NP and Jobe skill requirements display
- Construction steps guide with order-independent instructions
- Skill feasibility checking (green = ready, red = insufficient skills)
- Integrated with store configuration (reads directly from currentConfiguration)

**Shopping Tab** (Organization):
- Generate shopping lists organized by vendor/cluster type
- Four sections: Empty Implants, Shiny Clusters, Bright Clusters, Faded Clusters
- Checkboxes to track purchases across multiple vendors
- Progress badges showing items checked/total
- Automatically updates when configuration changes

The system automatically:
- Looks up matching implants from the database based on cluster selections
- Recalculates bonuses and requirements immediately after any state change (no manual refresh needed)
- Validates equipment requirements (Treatment, Attributes) against the active profile **if selected**
- Shows raw requirement values when no profile is active (enables theoretical planning)
- Computes build requirements (Nano Programming, Jobe combining skills)
- Tracks Treatment requirements and displays surplus/deficit relative to character skills (when profile selected)
- Provides cluster search functionality to identify which slots support specific skills
- Saves implant configurations to profiles for persistent storage (requires active profile)

## Data Flow

### Implant Configuration Workflow
1. **User configures slot** → Selects clusters (by stat ID) and QL in TinkerPlants.vue
2. **Store update** → tinkerPlantsStore.updateSlot() updates currentConfiguration
3. **Debounced lookup** → After 100ms delay, lookupImplantForSlot() calls backend API
4. **Cache check** → System checks 5-minute in-memory cache before API call
5. **API call** → POST /api/implants/lookup with slot, QL, and cluster stat IDs
6. **Item fetch** → Backend queries items table with criteria matching
7. **Item storage** → Fetched item stored in selection.item with full metadata
8. **Bonus calculation** → equipmentBonusCalculator.parseItemSpells() extracts stat bonuses
9. **Requirement extraction** → getCriteriaRequirements() parses action criteria for requirements
10. **Display update** → Vue components reactively display bonuses and requirements

### Profile Integration
1. **Load from profile** → profile.Implants (bitflag → Item mapping) → store.currentConfiguration
2. **Cluster parsing** → parseImplantClusters() extracts cluster stat IDs from item descriptions
3. **Working state** → User modifies currentConfiguration (dirty checking via hasChanges)
4. **Save to profile** → currentConfiguration → profile.Implants → ProfileStorage
5. **Revert support** → profileConfiguration holds last saved state for revert operations

### Cluster Lookup System
1. **User searches** → ClusterLookup.vue AutoComplete component
2. **Filtering** → getAllUniqueClusters() provides searchable cluster list
3. **Slot matching** → getSlotsForCluster() identifies which slots/types support cluster
4. **UI highlighting** → Parent component highlights matching dropdowns with visual borders
5. **Fill all** → Optional bulk-fill operation populates all matching slots with selected cluster

### Treatment Calculation
1. **Requirement scan** → Iterate all configured implants' action criteria
2. **Treatment extraction** → Find highest Treatment (stat 124) requirement across items
3. **Profile comparison** → Compare to profile.skills[124].total
4. **Delta calculation** → treatmentInfo = { required, current, delta, sufficient }
5. **Display** → TreatmentDisplay.vue shows prominent status with color-coded tags (now in Bonuses tab)

## Implementation

### Key Files

#### Frontend Components
- **`frontend/src/views/TinkerPlants.vue`** - Main view with 13-slot grid, five tabs (Build/Requirements/Bonuses/Construction/Shopping)
  - Build tab: Inline ClusterLookup + AttributePreference + ImplantGrid (configuration only)
  - Requirements tab: AttributeRequirementsDisplay + PerImplantRequirements (equipment and build requirements)
  - Bonuses tab: BonusDisplay (aggregate and per-implant bonus displays)
  - Construction tab: ConstructionPlanner (auto-analyzing build order planning)
  - Shopping tab: ShoppingList (vendor-organized purchase tracking)
  - Auto-recalculation: Bonuses/requirements update automatically after state changes
  - QL inputs: Blur-triggered lookups to prevent keystroke spam
- **`frontend/src/components/plants/ClusterLookup.vue`** - Inline AutoComplete cluster search with label (no Card wrapper)
- **`frontend/src/components/plants/AttributePreference.vue`** - Attribute preference selection (defaults to "None" instead of profile's top attribute)
- **`frontend/src/components/plants/ShoppingList.vue`** - Shopping list organized by vendor type (Empty Implants, Shiny/Bright/Faded Clusters) with checkbox tracking
- **`frontend/src/components/plants/BonusDisplay.vue`** - Aggregate and per-implant bonus display with responsive layout, graceful fallback for unknown stat IDs
- **`frontend/src/components/plants/AttributeRequirementsDisplay.vue`** - Attribute requirements display (Treatment, Strength, etc.) with color-coded status tags
- **`frontend/src/components/plants/PerImplantRequirements.vue`** - Per-slot requirement breakdown with DataTable and mobile card layout
- **`frontend/src/components/plants/TreatmentDisplay.vue`** - Prominent Treatment status display with color-coded tags (legacy, may be deprecated)
- **`frontend/src/components/plants/ConstructionPlanner.vue`** - Automatic construction analysis integrated with TinkerPlants store, real-time NP/Jobe requirements

#### Frontend Store
- **`frontend/src/stores/tinkerPlants.ts`** - Pinia store managing implant state, API calls, caching, calculations
  - State: currentConfiguration, profileConfiguration, calculatedBonuses, calculatedRequirements, treatmentInfo, perImplantRequirements
  - Actions: loadFromProfile, saveToProfile, revertToProfile, updateSlot, lookupImplantForSlot, calculateBonuses, calculateRequirements, recalculate
  - Cache: In-memory Map with 5-minute TTL for implant lookups
  - Debouncing: 100ms delay on manual changes to avoid rapid-fire API calls
  - Auto-recalculation: recalculate() helper automatically updates bonuses/requirements after state changes
  - Bug fix: Treatment stat ID corrected from 134 to 124
  - Type safety: Proper type casting for ImplantWithClusters → Item conversion

#### Frontend Utilities
- **`frontend/src/utils/cluster-utilities.ts`** - Comprehensive cluster operations
  - Availability: getAvailableClusters(), isClusterAvailableForSlot()
  - Validation: validateClusterConfig(), isValidClusterName()
  - NP Requirements: getClusterNPRequirement(), getMinimumClusterQL()
  - Jobe Detection: isJobeCluster(), getJobeRequiredSkill(), getAllJobeClusters()
  - Slot Normalization: normalizeSlotName(), getSlotNameVariations()
  - Search: getSlotsForCluster(), getAllUniqueClusters()
  - Empty cluster handling: Returns empty arrays instead of ['Empty'] for unconfigured slots

#### Integration Points
- **`frontend/src/services/api-client.ts`** - lookupImplant() method (POST /api/implants/lookup)
- **`frontend/src/services/equipment-bonus-calculator.ts`** - parseItemSpells() for bonus extraction
  - Critical fix: Now extracts bonuses ONLY from spell_data (item.stats does NOT contain implant bonuses)
  - Removed incorrect double-extraction that was causing duplicate/incorrect bonuses
  - Improved stat ID validation to skip non-trainable stats like Mass (stat 2)
- **`frontend/src/services/action-criteria.ts`** - getCriteriaRequirements() for requirement parsing
- **`frontend/src/services/skill-service.ts`** - resolveId() for cluster name → stat ID conversion
- **`frontend/src/services/game-data.ts`** - IMP_SKILLS, IMP_SLOTS, NP_MODS, JOBE_SKILL, CLUSTER_MIN_QL (all 'Empty' strings removed from IMP_SKILLS arrays)

#### Backend Endpoint
- **`backend/app/main.py`** - POST /api/implants/lookup endpoint (existing, no changes)
  - Accepts: slot (bitflag), ql (number), clusters (Shiny/Bright/Faded → stat ID)
  - Returns: { success: boolean, item: Item | null }
  - Query strategy: Match item stats, QL, and description cluster patterns

### Data Structures

#### ImplantSelection (Store State)
```typescript
interface ImplantSelection {
  type: 'implant' | 'symbiant';  // Equipment type discriminator
  shiny: number | null;          // Stat ID or null (implants only)
  bright: number | null;         // Stat ID or null (implants only)
  faded: number | null;          // Stat ID or null (implants only)
  ql: number;                    // Quality Level (1-300)
  slotBitflag: string;           // Slot identifier (e.g., "2" for Eyes)
  item: Item | null;             // Fetched implant data (null for symbiants or until lookup completes)
  symbiant: SymbiantItem | null; // Symbiant data (null for implants)
}
```

#### TreatmentInfo (Store State)
```typescript
interface TreatmentInfo {
  required: number;    // Highest Treatment requirement
  current: number;     // Profile's Treatment skill value
  delta: number;       // Difference (positive = need more, negative = surplus)
  sufficient: boolean; // Whether current >= required
}
```

#### ImplantRequirement (Computed)
```typescript
interface ImplantRequirement {
  stat: number;        // Stat ID
  statName: string;    // Display name
  required: number;    // Required value
  current: number;     // Profile's current value
  met: boolean;        // Whether requirement is met
}
```

#### Profile Storage Format
```typescript
profile.Implants = {
  "2": ImplantWithClusters,  // Eyes slot (implant or symbiant)
  "4": ImplantWithClusters,  // Head slot (implant or symbiant)
  "8": ImplantWithClusters,  // Ears slot (implant or symbiant)
  // ... etc for all 13 slots
}

// ImplantWithClusters structure:
{
  ...Item,                   // Full item data
  slot: 2,                   // Numeric slot position
  type: 'implant' | 'symbiant',
  clusters?: {               // Only for type='implant'
    Shiny?: { stat: number, skillName: string },
    Bright?: { stat: number, skillName: string },
    Faded?: { stat: number, skillName: string }
  }
}

// Legacy (deprecated v5.0.0):
profile.Symbiants = {
  "2": SymbiantItem,  // Separate symbiant storage (backward compatibility only)
}
```

### Recent Improvements (November 2025)

#### Profile Decoupling - Hybrid Mode (November 26, 2025)
**Problem**: TinkerPlants required an active profile to function, blocking users from theoretical planning or exploring implant configurations without character-specific data. Requirements tab would fail or show errors when no profile was selected.

**Solution**: Decoupled profile dependency to enable **hybrid mode** operation:
- **No profile selected**: Shows raw requirement values without comparison (neutral gray styling)
- **Profile selected**: Shows full comparison with current vs required values (green/red met/unmet status)
- System gracefully transitions between states as profiles are selected/deselected

**User Experience Changes**:
1. **Requirements Tab** - Three-state rendering:
   - Green tags/borders: Requirement met (current >= required)
   - Red tags/borders: Requirement unmet (current < required, shows +delta needed)
   - Neutral gray tags/borders: No profile, shows requirement value only

2. **Treatment Display** - Conditional comparison section:
   - Profile selected: Shows "Required | Your Treatment | Need/Surplus" with color-coded tags
   - No profile: Shows "Required | (Select a profile to compare)" message

3. **Per-Implant Requirements** - Three icon states:
   - ✓ Check icon (green): Requirement met
   - ⚠ Warning triangle (red): Requirement unmet with +delta
   - ℹ Info circle (gray): No profile, requirement value only

4. **Profile Transitions** - Automatic state updates:
   - Profile selected → profile loaded → requirements recalculated with comparison
   - Profile deselected → implants cleared → UI reset to defaults → neutral requirement display
   - Profile switched → new profile loaded → requirements updated with new comparison

**Implementation Details**:

**Type System Changes** (`frontend/src/types/api.ts`):
- `ImplantRequirement.current`: `number` → `number | undefined`
- `ImplantRequirement.met`: `boolean` → `boolean | undefined`
- `TreatmentInfo.current`: `number` → `number | undefined`
- `TreatmentInfo.delta`: `number` → `number | undefined`
- `TreatmentInfo.sufficient`: `boolean` → `boolean | undefined`
- `AttributeRequirementInfo.current`: `number` → `number | undefined`
- `AttributeRequirementInfo.delta`: `number` → `number | undefined`
- `AttributeRequirementInfo.sufficient`: `boolean` → `boolean | undefined`

**Store Changes** (`frontend/src/stores/tinkerPlants.ts`):
- `calculateRequirements()`: Removed blocking early return when no profile
- Added `hasProfile` flag to conditionally populate comparison fields
- Profile comparison fields set to `undefined` when `hasProfile = false`
- Improved symbiant detection with `isSymbiant()` type guard for reliability
- `reset()`: Updated to use `undefined` for comparison fields (not 0/false)
- Treatment calculation: Conditional branch for profile vs no-profile scenarios

**View Changes** (`frontend/src/views/TinkerPlants.vue`):
- Added `resetLocalImplantState()`: Clears all slot selections and resets to Implant mode
- Profile watcher handles all transition scenarios:
  - No profile → profile: Load and sync
  - Profile → profile: Reload and sync
  - Profile → no profile: Reset and clear
- Fixed `hasAnySymbiants` computed to check `slotType` values (prevents all-symbiant bug)
- `showResults` now checks both `hasAnyImplants` and `hasAnySymbiants`

**Component Changes**:

1. **AttributeRequirementsDisplay.vue**:
   - Three-state styling using strict equality checks (`=== true`, `=== false`, else neutral)
   - Conditional rendering: Shows "Current: X" when defined, "(No profile)" when undefined
   - Tag states: Success (met), Danger (unmet), Secondary (no profile)
   - Border colors: Green (met), Red (unmet), Surface (neutral)

2. **PerImplantRequirements.vue**:
   - Three-state Tag rendering with conditional icons
   - `req.met === true`: Check icon + "Stat: Value"
   - `req.met === false`: Warning icon + "Stat: Value (Need +delta)"
   - `req.met === undefined`: Info icon + "Stat: Value"
   - Border colors match AttributeRequirementsDisplay (green/red/gray)

3. **TreatmentDisplay.vue**:
   - Conditional profile comparison section using `v-if="profileTreatment !== undefined"`
   - Shows full three-column layout when profile exists
   - Shows minimal layout with message when no profile
   - `formatValue()`: Returns "N/A" for undefined values
   - `deltaText`, `needLabel`, `tagSeverity`, `tagIcon`: Handle undefined gracefully
   - Accessibility label includes no-profile scenario
   - Border colors: Neutral (no profile), Green (sufficient), Red (insufficient)

**Data Flow**:
1. **No profile scenario**:
   - `hasProfile = false` in `calculateRequirements()`
   - `current`, `met`, `delta`, `sufficient` set to `undefined`
   - Components render neutral state (gray, info icons, "No profile" text)

2. **Profile selected**:
   - `hasProfile = true` in `calculateRequirements()`
   - `current = profile.skills[statId].total || 0`
   - `met = current >= required`
   - `delta = required - current`
   - `sufficient = current >= required`
   - Components render comparison state (green/red, check/warning icons, delta values)

3. **Profile deselected**:
   - View watcher detects `newProfile === null`
   - Calls `tinkerPlantsStore.reset()` to clear configuration
   - Calls `resetLocalImplantState()` to reset UI
   - Store recalculates with `hasProfile = false`
   - Components transition to neutral state

**Benefits**:
- Users can explore implant configurations without creating a profile
- Theoretical planning enabled (e.g., "What QL can I build at 1000 Treatment?")
- Cleaner error handling (no blocking errors when profile missing)
- More predictable UX with explicit visual states
- Maintains full functionality when profile is selected
- Graceful degradation instead of hard failure

**Edge Cases Handled**:
- All-symbiant configurations: `hasAnySymbiants` computed prevents empty results bug
- Switching between profiles: Proper cleanup and reload of data
- Deselecting profile: Full reset to defaults (Implant mode, no selections)
- Undefined skill values: Defaults to 0 for comparison when profile exists but skill missing
- Type guards: `isSymbiant()` checks for family/slot_id properties for robust detection

**Files Modified**:
- `frontend/src/types/api.ts` - Made comparison fields optional (+15 lines)
- `frontend/src/stores/tinkerPlants.ts` - Profile-optional calculation logic (+40 lines)
- `frontend/src/views/TinkerPlants.vue` - Profile transition handling (+30 lines)
- `frontend/src/components/plants/AttributeRequirementsDisplay.vue` - Three-state rendering (+10 lines)
- `frontend/src/components/plants/PerImplantRequirements.vue` - Three-state tags (+20 lines)
- `frontend/src/components/plants/TreatmentDisplay.vue` - Conditional comparison (+40 lines)

**Future Considerations**:
- Could add "Import from profile" button when no profile selected
- Could show comparison against multiple profiles (side-by-side)
- Could persist last viewed configuration independent of profile
- Could add "Create profile from build" workflow

#### Symbiant Integration (November 21, 2025)
**Problem**: Users could not plan symbiant equipment alongside traditional implants, requiring separate tracking and manual comparison of stat bonuses and requirements.

**Solution**: Integrated symbiant support directly into TinkerPlants with unified implant/symbiant slot configuration:
- Per-slot type toggle (Implant vs Symbiant) using SelectButton component
- Symbiant autocomplete selection with fuzzy search by name/family
- Unified bonus calculation supporting both implants and symbiants
- Unified requirement calculation across equipment types
- Profile storage integration using type discriminator pattern

**Data Flow**:
1. User toggles slot type to "Symbiant" → `setSlotType()` clears implant data
2. AutoComplete searches symbiants filtered by slot bitflag
3. Selection triggers `setSymbiant()` → enriches minimal symbiant with full Item data from API
4. Store updates `currentConfiguration` with symbiant type and enriched data
5. Bonuses/requirements recalculated using existing equipment calculator
6. Save converts to unified `ImplantWithClusters` format with type='symbiant'

**Implementation Details**:
- **Store Changes** (`tinkerPlants.ts`):
  - Enhanced `ImplantSelection` with type discriminator ('implant' | 'symbiant')
  - Added `symbiant` field to selection (null for implants, SymbiantItem for symbiants)
  - New `setSlotType()` action to toggle equipment type (clears conflicting data)
  - New `setSymbiant()` action to enrich and store symbiant with full Item data
  - Modified `loadFromProfile()` to detect and load symbiants using type discriminator
  - Modified `saveToProfile()` to convert symbiants to `ImplantWithClusters` format
  - Bonus/requirement calculations now handle both types uniformly

- **UI Changes** (`TinkerPlants.vue`):
  - Added SelectButton type toggle (I=Implant, S=Symbiant) per slot
  - Conditional rendering: Implant mode shows cluster dropdowns, Symbiant mode shows AutoComplete
  - Symbiant AutoComplete spans 3 columns (Shiny/Bright/Faded grid columns) for width
  - Symbiant selection searches by name/family with QL display in dropdown options
  - QL input hidden in symbiant mode (QL fixed per symbiant item)
  - Slot loading spinner shows during symbiant API enrichment

- **Type System Changes** (`types.ts`, `api.ts`):
  - Extended `ImplantSelection` interface with type and symbiant fields
  - Added `SymbiantItem` import to tinkerprofiles types
  - Profile `Implants` field now accepts `ImplantWithClusters` (implants + symbiants)
  - Deprecated `profile.Symbiants` field (will be removed in v5.0.0)

- **Profile Storage** (`transformer.ts`):
  - Added `Symbiants` field to JSON export (backward compatibility)
  - Import handles both new unified format and legacy separate fields
  - Migration support: Reads legacy `Symbiants` if present during import

**Benefits**:
- Single interface for all implant slot equipment planning
- Direct stat comparison between implants and symbiants
- Unified save/load workflow (no separate symbiant management needed)
- Accurate bonus aggregation across mixed equipment types
- Future-proof architecture for additional equipment types

**Files Modified**:
- `frontend/src/stores/tinkerPlants.ts` - Core symbiant integration logic (+313 lines)
- `frontend/src/views/TinkerPlants.vue` - UI type toggle and selection (+346 lines)
- `frontend/src/types/api.ts` - Enhanced ImplantSelection interface (+28 lines)
- `frontend/src/lib/tinkerprofiles/types.ts` - Added deprecated Symbiants field (+6 lines)
- `frontend/src/lib/tinkerprofiles/transformer.ts` - Export/import support (+2 lines)

**Edge Cases Handled**:
- Type switching clears conflicting data (implant clusters cleared when switching to symbiant)
- Symbiant API fetch failures gracefully fall back to minimal data structure
- Empty symbiant selections handled (null symbiant field)
- QL preservation across type switches
- Legacy profile migration (separate Symbiants field → unified Implants)

**Integration Points**:
- Uses existing `useSymbiantsStore` for symbiant data loading
- Leverages `apiClient.getItem()` for symbiant enrichment with full metadata
- Reuses `equipmentBonusCalculator` for symbiant bonus extraction (spell_data parsing)
- Reuses `getCriteriaRequirements()` for symbiant requirement parsing (actions criteria)

### Recent Improvements (October 2025)

#### Shopping List Feature (October 28, 2025)
**Problem**: Users needed an organized way to track which implants and clusters to purchase across multiple in-game vendors.

**Solution**: Added new Shopping tab with vendor-organized shopping lists:
- Four sections: Empty Implants, Shiny Clusters, Bright Clusters, Faded Clusters
- Checkbox tracking for each item with strikethrough on completion
- Progress badges showing checked/total items per section
- Auto-updates when configuration changes
- Sorted alphabetically to match in-game vendor presentation

**Data Flow**:
1. Reads currentConfiguration from TinkerPlants store
2. Extracts configured slots and clusters
3. Converts stat IDs to cluster names via skillService
4. Groups by vendor type (Empty/Shiny/Bright/Faded)
5. Maintains local checked state (not persisted)

**Benefits**:
- Reduces in-game confusion about what to buy
- Separates shopping trips by vendor (efficient vendor navigation)
- Visual progress tracking prevents duplicate purchases
- No need for external note-taking or spreadsheets

**Files**:
- `frontend/src/components/plants/ShoppingList.vue` - New component
- `frontend/src/views/TinkerPlants.vue` - Added Shopping tab

#### Construction Planner Auto-Analysis (October 28, 2025)
**Problem**: Manual "Analyze Construction" button required extra clicks and was easy to forget, leading to stale or missing construction guidance.

**Solution**: Removed manual analysis button and integrated construction planner directly with TinkerPlants store:
- Reads implant configuration from `tinkerPlantsStore.currentConfiguration`
- Auto-analyzes as implants are configured (reactive updates)
- Real-time NP and Jobe skill requirement calculations
- Uses actual cluster NP formulas instead of estimates
- Skill feasibility checking with color-coded status

**Implementation**:
- ConstructionPlanner now reads from TinkerPlants store bitflag keys
- Converts bitflag keys to construction planner slot names
- Converts stat IDs to cluster names for analysis
- Skills sync from profile to construction planner composable
- Requirements calculated using rkClusterNP() and jobeClusterSkill()

**Benefits**:
- Always-current construction guidance
- More accurate NP requirements (formula-based, not estimates)
- Better skill requirement display (exact values, not ranges)
- Cleaner UI without manual button
- Seamless integration with Build tab workflow

**Files**:
- `frontend/src/components/plants/ConstructionPlanner.vue` - Integrated with store
- `frontend/src/composables/useConstructionPlanner.ts` - Added stat ID to name conversion
- `frontend/src/services/construction-planner.ts` - Improved NP calculation accuracy

#### Attribute Preference Default Change (October 28, 2025)
**Problem**: Attribute preference defaulted to profile's top attribute, which could lead to unintended filtering or confusion when backend filtering is implemented.

**Solution**: Changed default attribute preference from auto-detected top attribute to "None" (null):
- Added "None" option as first dropdown choice
- Default selection is now null (no preference)
- Removed complex profile attribute analysis logic
- Clear localStorage key when "None" selected

**Benefits**:
- Clearer user intent (explicit choice vs automatic assumption)
- Simpler code without profile attribute ranking
- Prevents future issues when backend attribute filtering is added
- More predictable behavior for new users

**Files**:
- `frontend/src/components/plants/AttributePreference.vue` - Changed default logic
- `frontend/src/stores/tinkerPlants.ts` - Updated attributePreference type to allow null

#### Cluster Lookup UI Simplification (October 28, 2025)
**Problem**: ClusterLookup component used bulky Card wrapper with title header, taking excessive vertical space in Build tab.

**Solution**: Converted to inline layout with label:
- Replaced Card component with simple div + border styling
- Inline label "Cluster Lookup:" instead of Card title
- Horizontal flexbox layout (label + input + clear button)
- Consistent styling with surrounding controls

**Benefits**:
- Reduced vertical space consumption (~40px saved)
- Better visual integration with Build tab controls
- Cleaner, more compact appearance
- Improved mobile layout efficiency

**Files**:
- `frontend/src/components/plants/ClusterLookup.vue` - Removed Card wrapper

#### Five-Tab UI Organization
**Problem**: Build tab was cluttered with both configuration controls and calculation results, making it difficult to focus on either task.

**Solution**: Split functionality across five focused tabs:
- Build tab: Pure configuration (ClusterLookup + AttributePreference + ImplantGrid)
- Requirements tab: Equipment and build requirements with per-implant breakdown
- Bonuses tab: Aggregate and per-implant bonus displays
- Construction tab: Auto-analyzing build order planning
- Shopping tab: Vendor-organized purchase tracking

**Benefits**:
- Clearer user mental model (configure → validate → review → plan → shop)
- Reduced visual clutter in each tab
- Better mobile experience (less scrolling within tabs)
- Easier to find specific information
- Dedicated space for each workflow phase

#### Auto-Recalculation System (October 21, 2025)
**Problem**: Manual Calculate button required users to remember to recalculate after each change, leading to stale or confusing data displays.

**Solution**: Removed Calculate button entirely and implemented automatic recalculation after all state-changing operations:
- After implant lookup completes
- After loading configuration from profile
- After reverting to saved configuration

**Implementation**: Added `recalculate()` helper function that triggers both `calculateBonuses()` and `calculateRequirements()` atomically.

**Benefits**:
- Always-current data - no manual refresh needed
- Reduced cognitive load - one less button to remember
- Cleaner UI - removed unnecessary control
- Better UX consistency with other TinkerTools views

#### Equipment Bonus Extraction Fix
**Problem**: equipmentBonusCalculator was extracting bonuses from both item.stats AND spell_data, causing duplicate/incorrect bonuses. Implant bonuses are ONLY in spell_data.

**Solution**: Removed item.stats extraction entirely from parseItemSpells() and parseEquipmentItem(). Now only processes spell_data for bonuses.

**Impact**: Accurate bonus calculations for all equipment types, especially implants.

#### Treatment Stat ID Correction
**Problem**: Code was using stat ID 134 for Treatment skill, which is incorrect.

**Solution**: Corrected to stat ID 124 (the actual Treatment skill ID) in all Treatment-related calculations.

**Files affected**: tinkerPlants.ts (treatment calculations and requirement checks)

#### "Empty" Cluster Redundancy Removal (October 21, 2025)
**Problem**: All IMP_SKILLS arrays started with 'Empty' string, and cluster utilities returned ['Empty'] for empty slots. This caused validation errors and UI confusion since 'Empty' is not a valid cluster name for lookups.

**Solution**:
- Removed 'Empty' string from all 13 slot arrays in IMP_SKILLS (game-data.ts)
- Modified cluster-utilities.ts to return empty arrays instead of ['Empty']
- Updated cluster validation logic to handle null/undefined properly

**Benefits**:
- Cleaner dropdown UI without meaningless 'Empty' option
- Prevents validation errors from invalid cluster selections
- More intuitive UX - empty means unconfigured, not a cluster type
- Simpler code without special-casing 'Empty' everywhere

#### QL Input Performance Optimization (October 21, 2025)
**Problem**: QL inputs triggered implant lookups on every keystroke, causing rapid-fire API calls and UI flickering during user input (e.g., typing "200" triggers 3 lookups: QL 2, 20, 200).

**Solution**: Changed both global and per-slot QL inputs to trigger lookups only on blur event instead of input event.

**Implementation**:
- Global QL: `@blur="onGlobalQLComplete"` (previously `@input="onGlobalQLChange"`)
- Per-slot QL: `@blur="onQLComplete(slotId)"` (previously `@input="onQLChange"`)
- Input events still update local reactive state for immediate visual feedback
- Lookups only fire when user finishes editing (tabs away or clicks elsewhere)

**Benefits**:
- 70-90% reduction in API calls during QL adjustment
- Smoother typing experience without loading spinner flicker
- Better server performance with fewer redundant requests
- Existing 100ms debounce still applies for additional safety

#### UI State Synchronization Fixes (October 21, 2025)
**Problem 1**: Revert button restored store state but did not sync dropdown selections back to UI, causing visual desync between displayed selections and actual configuration.

**Problem 2**: Clear All button cleared selections but did not enable the Revert button, making it impossible to undo a mass clear operation.

**Solutions**:
1. **Revert sync**: Enhanced `revertToProfile()` to explicitly sync store configuration back to local reactive `implantSelections` object, ensuring dropdowns reflect reverted state
2. **Clear All state**: Modified `clearAllImplants()` to update store's `currentConfiguration`, which triggers `hasChanges` computed property via dirty checking

**Benefits**:
- Visual consistency between UI controls and underlying data
- Predictable undo/redo behavior
- Users can safely experiment with Clear All knowing Revert will restore

#### Save Button Layout Improvements (October 21, 2025)
**Problem**: Save button used nested Badge component to display unsaved changes indicator (*). This caused button size to change when badge appeared/disappeared, creating jarring layout shift.

**Solution**: Replaced nested `<Badge>` component with PrimeVue Button's built-in `badge` prop:
```vue
<!-- Before (nested component, causes layout shift) -->
<Button>
  <Badge v-if="hasChanges" value="*" />
</Button>

<!-- After (built-in prop, stable layout) -->
<Button
  :badge="hasChanges ? '*' : undefined"
  badgeSeverity="danger"
/>
```

**Benefits**:
- Stable button dimensions - no layout shift on state changes
- Cleaner component template
- Better accessibility with proper badge ARIA attributes
- Consistent with PrimeVue design patterns

#### Type Safety Improvements
**Problem**: Type casting issues when converting ImplantWithClusters to Item in loadFromProfile().

**Solution**: Added explicit type casting chain (ImplantWithClusters → unknown → Item) with comments explaining safety.

**Problem**: RequirementsDisplay was importing ImplantRequirement type from store instead of centralized types.

**Solution**: Changed import to @/types/api for better type organization and reusability.

#### Error Handling Improvements
**Problem**: BonusDisplay would crash if encountering unknown stat IDs.

**Solution**: Added try/catch around skillService.getName() with graceful fallback to "Stat {ID}" format. Logs warning to console for debugging.

### Key Technical Decisions

#### Stat IDs for Clusters
**Decision**: Store cluster selections as stat IDs (numbers) throughout the system

**Rationale**:
- Consistent with TinkerProfiles' skill storage pattern
- Enables efficient lookup and comparison operations
- Simplifies API communication (backend expects stat IDs)
- Avoids string normalization issues across variations

**Implementation**: skillService.resolveId() converts cluster names to IDs at input boundaries

#### In-Memory Caching
**Decision**: 5-minute in-memory cache for implant lookups (Map-based)

**Rationale**:
- Reduces API load for repeated lookups (e.g., QL adjustments)
- Fast cache lookups (O(1) Map operations)
- Memory-efficient (cache key = slot + QL + clusters hash)
- Automatic expiration prevents stale data

**Tradeoff**: Cache does not persist across page reloads (intentional for data freshness)

#### Debounced Lookups
**Decision**: 100ms debounce delay for manual cluster/QL changes

**Rationale**:
- Prevents rapid-fire API calls during dropdown scrolling
- Improves perceived responsiveness (no flicker from immediate loading states)
- Reduces server load significantly (80%+ reduction in API calls)

**Implementation**: Map-based timeout tracking per slot for independent debouncing

#### Store-Based Calculations
**Decision**: Calculate bonuses and requirements in Pinia store, not components

**Rationale**:
- Centralized calculation logic (single source of truth)
- Enables sharing calculated data across multiple components
- Simplifies testing (test store methods, not component logic)
- Supports future features (e.g., comparison mode, optimization algorithms)

**Bonus Calculation**: equipmentBonusCalculator.parseItemSpells() extracts bonuses from item.actions[].spell_data
**Requirement Calculation**: getCriteriaRequirements() parses item.actions[].criteria for stat requirements

#### Component Decomposition
**Decision**: Split TinkerPlants into 5 specialized child components

**Rationale**:
- ClusterLookup: Reusable search functionality with slot highlighting
- AttributePreference: Isolated preference management with localStorage persistence
- BonusDisplay: Complex responsive layout (grid/table hybrid)
- RequirementsDisplay: Two-column categorization (Equipment vs Build)
- TreatmentDisplay: Prominent status display with custom styling

**Benefit**: Each component has single responsibility, easier to maintain and test

#### Profile Dirty Checking
**Decision**: Maintain separate currentConfiguration and profileConfiguration

**Rationale**:
- Enables "unsaved changes" detection via hasChanges computed property
- Supports Revert functionality (restore profileConfiguration)
- Clarifies data flow (currentConfiguration = working state, profileConfiguration = saved state)
- Prevents accidental saves (explicit save button required)

**Implementation**: JSON deep clone on load/save to prevent reference sharing

### Cluster System Architecture

#### Cluster Data Sources
**IMP_SKILLS** (game-data.ts): Defines available clusters per slot/type
```typescript
IMP_SKILLS = {
  'Eye': { Shiny: ['Rifle', 'Pistol', ...], Bright: [...], Faded: [...] },
  'Head': { ... },
  // ... 13 slots total
}
```

**NP_MODS** (game-data.ts): Nano Programming multipliers for regular clusters
```typescript
NP_MODS = {
  'Strength': 4.5,
  'Intelligence': 4.5,
  'Rifle': 4.5,
  // ... etc
}
```

**JOBE_SKILL** (game-data.ts): Jobe cluster → combining skill mappings
```typescript
JOBE_SKILL = {
  'Max NCU': 'Computer Literacy',
  'Add All Def.': 'Psychology',
  'Nano Delta': 'Nano Programming',
  // ... 8 Jobe clusters total
}
```

#### Cluster Requirements Calculation
**Regular Clusters**:
- NP Required = NP_MODS[cluster] * QL * slotMod
- slotMod: Shiny = 2.0, Bright = 1.5, Faded = 1.0

**Jobe Clusters**:
- Skill Required = QL * slotMod (uses Jobe combining skill, not NP)
- slotMod: Shiny = 5.5, Bright = 4.0, Faded = 3.0 (generally)
- Exception: Nano Delta has custom multipliers (5.25 / 4.0 / 2.75)

#### Cluster Normalization
**Challenge**: Cluster names have variations ("1h Blunt" vs "1h Blunt" vs "1hBlunt")

**Solution**: skillService.resolveId() uses skill-patterns.ts regex patterns for fuzzy matching
- Handles spaces, hyphens, abbreviations
- Returns canonical stat ID for consistent storage
- Throws descriptive error if no match found

### UI/UX Features

#### Three-Tab Interface
**Build Tab** (Configuration-focused):
- 13-row grid (one per slot) with 5 columns: Slot | Shiny | Bright | Faded | QL
- ClusterLookup search component at top for finding clusters across slots
- Calculate button with validation (ensures all configured implants complete lookups)
- Responsive: Maintains structure on mobile (horizontal scroll if needed)
- Visual feedback: Per-slot loading spinners during API calls
- Keyboard accessible: Full tab navigation and screen reader support

**Bonuses Tab** (Results-focused):
- TreatmentDisplay showing Treatment requirements and deltas (moved from Build tab)
- BonusDisplay with aggregate totals and per-implant breakdowns (moved from Build tab)
- RequirementsDisplay with Equipment and Build requirements (moved from Build tab)
- Empty state: Informative message prompting users to configure implants in Build tab
- Clean separation: Results only, no configuration controls

**Construction Tab** (Planning-focused):
- ConstructionPlanner for build order optimization
- Tracks NP and Jobe combining skill requirements

#### Cluster Highlighting
- ClusterLookup search highlights matching slots with colored borders
- Visual hierarchy: Blue border + light background on matching dropdowns
- Persistent until reset: Highlights remain until user clears search
- Slot normalization: Handles variations like "Right-Arm" vs "Right Arm"

#### Treatment Display
- Prominent visual treatment: Large colored card with gradient tag
- Status colors: Green (sufficient) vs Red (insufficient)
- Real-time delta: Shows exact +/- treatment needed
- Responsive layout: Switches to vertical stack on mobile
- Location: Bonuses tab (previously in Build tab)

#### Bonus Display
- Dual view: Aggregate totals (grid cards) + per-implant breakdown (table)
- Responsive: Grid cards → mobile-friendly cards on small screens
- Sorting: Bonuses sorted by value descending for quick scanning
- Graceful error handling: Falls back to "Stat {ID}" for unknown stat IDs
- Empty state: Informative message when no implants configured
- Location: Bonuses tab (previously in Build tab)

#### Save/Revert System
- Visual indicators: Badge with "*" on Save button when hasChanges = true
- Disabled states: Save/Revert disabled when no changes present
- Toast notifications: Success/error feedback on save operations
- Optimistic updates: UI updates immediately, errors rolled back on failure

### Performance Characteristics

#### API Call Optimization
- Debouncing: 100ms delay reduces API calls by 80%+ during user input
- Caching: 5-minute cache provides instant results for repeated lookups
- Per-slot loading: Only show spinner for actively loading slot (not global overlay)
- Abort handling: Cancel pending requests on rapid changes (future enhancement)

#### Memory Management
- Cache size: Typically <100 entries (13 slots × ~7 configurations per session)
- Cache expiration: Automatic cleanup after 5 minutes (no manual intervention)
- Profile storage: Implants stored as Item objects (efficient, no duplication)
- Deep cloning: Only performed on load/save (not during user input)

#### Calculation Performance
- Bonus aggregation: O(n) where n = number of configured implants (max 13)
- Requirement extraction: O(m) where m = number of item actions (typically 1-2 per item)
- Treatment calculation: Single pass through requirements (O(k) where k = total requirements)
- UI updates: Reactive computed properties prevent unnecessary recalculations

### Integration with TinkerProfiles

#### Profile Data Structure
```typescript
profile = {
  Implants: {
    "2": Item,  // Eyes
    "4": Item,  // Head
    // ... etc
  },
  Skills: {
    134: { total: 1200 },  // Treatment
    160: { total: 800 },   // Nano Programming
    // ... etc
  }
}
```

#### Load Sequence
1. tinkerPlantsStore.loadFromProfile() called on mount
2. Extract profile.Implants (bitflag keys)
3. For each implant: parseImplantClusters(item) extracts cluster stat IDs from description
4. Build ImplantSelection objects with clusters, QL, and item data
5. Set currentConfiguration and profileConfiguration (deep clone)
6. Sync UI reactive state (implantSelections) from currentConfiguration

#### Save Sequence
1. User clicks Save button → tinkerPlantsStore.saveToProfile()
2. Convert currentConfiguration to profile.Implants format
3. Only save slots with fetched items (skip empty/partial configurations)
4. Call profilesStore.updateProfile() → ProfileStorage.saveProfile()
5. Update profileConfiguration to match currentConfiguration (clear dirty state)
6. Toast notification confirms success

#### Bonus Application
**Important**: TinkerPlants does NOT automatically apply bonuses to profile skills
- Bonuses are displayed for user review only
- User must manually apply via TinkerProfiles if desired
- This prevents unintended skill modifications during planning
- Future enhancement: "Apply Bonuses" button could integrate with equipment bonus system

### Accessibility Features

#### Keyboard Navigation
- Full tab order through all interactive elements
- Dropdown keyboard selection (arrow keys, Enter to select)
- Clear/Reset buttons accessible via keyboard
- Focus indicators on all interactive components

#### Screen Reader Support
- ARIA labels on all inputs and buttons
- Live regions for dynamic content updates (announcements)
- Descriptive status messages (e.g., "Loading implant for Eye slot")
- Semantic HTML structure (headings, sections, forms)

#### Visual Accessibility
- High contrast color schemes (light and dark mode)
- Color-blind friendly status indicators (icons + text)
- Large touch targets (44px minimum) for mobile
- Clear focus indicators (ring styles) on interactive elements

### Edge Cases and Error Handling

#### Cluster Parsing Failures
- **Scenario**: Item description lacks cluster info or has malformed text
- **Handling**: parseImplantClusters() returns null, slot skipped during load
- **User feedback**: Console warning, no error toast (graceful degradation)

#### API Lookup Failures
- **Scenario**: Backend returns 404 or 500 error
- **Handling**: selection.item = null, error toast displayed
- **Recovery**: User can retry by changing cluster/QL (triggers new lookup)

#### No Matching Implant
- **Scenario**: Backend finds no item matching cluster combination
- **Handling**: response.success = false, informative toast shown
- **User feedback**: "No implant found for selected cluster combination in slot X"

#### Profile Without Active Profile
- **Scenario**: User navigates to TinkerPlants without selecting profile
- **Handling**: loadFromProfile() shows error toast, UI remains functional
- **Limitation**: Cannot save, revert, or calculate requirements without profile

#### Treatment Calculation Edge Cases
- **No configured implants**: treatmentInfo = { required: 0, current: 0, delta: 0, sufficient: true }
- **Profile missing Treatment skill**: Defaults to 0 (shows full deficit)
- **Multiple implants same requirement**: Only highest requirement tracked (correct behavior)

### Future Enhancements

#### Attribute Filtering (Partially Implemented)
- AttributePreference component exists, stores preference in localStorage
- Backend /api/implants/lookup does not yet support attribute parameter
- Future: Filter implant variants by preferred attribute (e.g., Strength Ocular vs Intelligence Ocular)

#### Construction Order Optimization
- ConstructionPlanner.vue exists but basic implementation
- Future: Smart ordering based on Treatment requirements (ladder implants)
- Calculate build order minimizing wasted NP (build lowest NP clusters first)

#### Implant Comparison Mode
- Side-by-side comparison of two implant configurations
- Diff view showing bonus changes between configs
- "What-if" scenarios without modifying saved configuration

#### Cluster Recommendations
- AI/algorithm-based cluster suggestions for specific goals
- "Maximize X skill" → suggest optimal cluster combinations
- Profession-specific templates (e.g., "Doctor Implant Setup")

#### Import/Export Configurations
- Export implant config as shareable JSON or URL
- Import configs from legacy TinkerPlants or community builds
- Backup/restore multiple configurations per profile

#### Build Requirements Integration
- Auto-calculate Jobe combining skills needed for build
- Show minimum cluster QLs required for each implant
- Break & Entry requirements for cleaning failed builds

## Configuration
No environment variables required. System uses:
- Backend implant lookup API (existing endpoint)
- Profile storage via TinkerProfiles store
- Client-side localStorage for AttributePreference (per-profile key)

## API Endpoints

### POST /api/implants/lookup
Lookup implant by cluster configuration
- Request body: `{ slot: number, ql: number, clusters: { Shiny?: number, Bright?: number, Faded?: number } }`
- Response: `{ success: boolean, item?: Item }`
- Used by: tinkerPlantsStore.lookupImplantForSlot()

## Usage Example

### Basic Implant Configuration
```typescript
// Mount TinkerPlants view
<TinkerPlants />

// User flow:
1. Select "Eye" slot → Shiny: "Rifle" (stat ID 105)
2. Select Bright: "Intelligence" (stat ID 19)
3. Select Faded: "1h Blunt" (stat ID 103)
4. Set QL: 200
5. System auto-fetches matching implant (debounced)
6. Display bonuses: +40 Rifle, +20 Intelligence, +10 1h Blunt
7. Show requirements: Treatment 900, NP 1600
8. User clicks "Calculate" → aggregate bonuses displayed
9. User clicks "Save" → persisted to profile.Implants["2"]
```

### Cluster Lookup
```typescript
// User searches for "Rifle" in ClusterLookup
1. AutoComplete suggests "Rifle"
2. User selects → system calls getSlotsForCluster("Rifle")
3. Results: [{ slot: "Eye", types: ["Shiny"] }, { slot: "Right-Wrist", types: ["Bright"] }, ...]
4. UI highlights Eye (Shiny) and Right-Wrist (Bright) dropdowns
5. User clicks "Fill All" → populates all matching slots with Rifle cluster
6. User clicks "X" to reset → highlighting clears
```

### Treatment Validation
```typescript
// Profile has Treatment 1000
// User configures QL 200 implants (require Treatment 900-1100)
// TreatmentDisplay shows:
// - Treatment Required: 1,100
// - Your Treatment: 1,000
// - Need: +100 (red tag with warning icon)

// User buffs Treatment to 1150
// System recalculates:
// - Treatment Required: 1,100
// - Your Treatment: 1,150
// - Surplus: -50 (green tag with check icon)
```

## Testing
- **Unit tests**: cluster-utilities.ts functions (validation, NP calculations, slot normalization)
- **Integration tests**: tinkerPlantsStore methods (load, save, calculate)
- **Component tests**: ClusterLookup search/filter, BonusDisplay rendering
- **E2E tests**: Full user workflow (configure → calculate → save)

## Related Documentation
- TinkerProfiles v4 Architecture: `docs/features/tinkerprofiles-v4-architecture.doc.md`
- Equipment Bonus System: `docs/features/tinkerprofiles-bonus-calculators.doc.md`
- Skill Pattern Enhancements: `docs/features/skill-pattern-enhancements.doc.md`
- Action Criteria System: Backend action-criteria parsing for requirements
- Game Data Constants: `frontend/src/services/game-data.ts` (IMP_SKILLS, NP_MODS, etc.)

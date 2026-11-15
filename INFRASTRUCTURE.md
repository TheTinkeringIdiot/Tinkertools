# TinkerTools Infrastructure & Shared Data Reference

This document provides a comprehensive overview of the shared infrastructure, data, and services available across all TinkerTools applications. Use this as a quick reference to understand what's already available before implementing new features.

## 🎯 Quick Reference

- **Game Data Constants**: 2,150+ entries in `frontend/src/services/game-data.ts`
- **API Client**: Unified typed client in `frontend/src/services/api-client.ts`
- **State Management**: Pinia stores with cross-app sharing in `frontend/src/stores/`
- **Database**: PostgreSQL; game data in the content-addressed store (schema `cas`), read through `backend/app/store/`
- **Interpolation System**: Quality level interpolation across all items
- **Profile System**: Character data management in `frontend/src/lib/tinkerprofiles/`

---

## 🗃️ Shared Data Layer

### Game Data Constants (`frontend/src/services/game-data.ts`)

**Complete Anarchy Online reference data (2,150+ entries):**

- **STAT** (600+ entries): Stat ID to human-readable name mapping
  - Core stats: Strength, Agility, Intelligence, Psychic, Sense, Stamina
  - Skills: All weapon skills, nano skills, trade skills
  - ACs: Projectile, Melee, Energy, Chemical, Radiation, Cold, Fire, Poison
  
- **PROFESSION** (15 entries): Profession ID to name mapping
  - Solider, MartialArtist, Engineer, Fixer, Agent, Adventurer, Trader, etc.

- **REQUIREMENTS** (200+ entries): Item/nano requirement mappings
  - Same as STAT but used specifically for requirements context

- **INTERP_STATS** (183 entries): Stats that support quality level interpolation
  - Used by interpolation system to determine which stats can be scaled

- **Breed, Gender, Faction Classifications**:
  - BREED: Solitus, Opifex, Nanomage, Atrox
  - GENDER: Male, Female, Uni
  - FACTION: Neutral, Clan, Omni

### Implant Planning Constants (TinkerPlants Integration)

- **NP_MODS**: Nano Programming skill modifiers for implant clusters
- **JOBE_SKILL**: Maps Jobe cluster skills to required combining skills  
- **ALL_SKILLS** (80+ entries): Complete list of implant skills
- **IMP_SKILLS**: Implant skills by slot and cluster type (Eye, Head, Ear, etc.)
- **IMP_SLOTS**: Ordered list of 13 implant slot positions

### TinkerNukes Specialization Data

- **DECKS**: Cyberdeck types for Nanotechnician specialization
- **Damage Bonus Constants**: HUMIDITY, CRUNCHCOM, NOTUM_SIPHON, etc.
- **SPECS**: Specialization level mapping (0-4)
- **DAMAGE_TYPES**: Chemical, Cold, Energy, Fire, Melee, Poison, Projectile, Radiation

### Spell Data Constants

- **SPELL_FORMATS** (111+ entries): Spell format ID to format string mapping
  - Used for spell description interpolation with parameter substitution
  - Example: `53002: 'Hit {Stat} for {MinValue} to {MaxValue}'`
  - Supports dynamic parameter interpolation (NanoID links, percentages, stat names)

---

## 🌐 API Infrastructure

### Unified API Client (`frontend/src/services/api-client.ts`)

**Features:**
- Typed HTTP client with Axios integration
- Request/response typing for all endpoints
- Error handling and retry logic (3 attempts, 1s delay)
- Timeout configuration (30s default)

**Available Endpoints:**
```typescript
// Items
searchItems(query: ItemSearchQuery): Promise<PaginatedResponse<Item>>
getItem(aoid: number): Promise<ApiResponse<Item>>  // Uses AOID for item lookup
interpolateItem(aoid: number, targetQl: number): Promise<InterpolationResponse>

// Symbiants
searchSymbiants(query: SymbiantSearchQuery): Promise<PaginatedResponse<SymbiantItem>>
getSymbiant(aoid: number): Promise<ApiResponse<SymbiantItem>>  // By AOID
getSymbiantDroppedBy(aoid: number): Promise<ApiResponse<Mob[]>>

// Mobs / Pocket Bosses
searchMobs(query: MobSearchQuery): Promise<PaginatedResponse<Mob>>
getMob(id: number): Promise<ApiResponse<Mob>>
searchPocketBosses(query: MobSearchQuery): Promise<PaginatedResponse<Mob>>
getPocketBoss(id: number): Promise<ApiResponse<Mob>>
getPocketBossDrops(id: number): Promise<ApiResponse<SymbiantItem[]>>
```

### Backend API Routes (`backend/app/api/routes/`)

- **items.py**: Item list, search, detail and interpolation
- **item_revisions.py**: Item change history across game versions
- **nanos.py**: Nano lists, search, strains, profession and offensive lists
- **weapons.py**: Weapon analysis for TinkerFite
- **implants.py**: Implant lookup by slot and clusters
- **symbiants.py**, **mobs.py**: Symbiants, mobs and pocket boss drops
- **perks.py**: Batch perk lookup for profile imports
- **versions.py**: The builds the API serves
- **legacy_item_ids.py**: Internal item ids of the old database to AOIDs (transitional; map loaded by the importer)
- **aosetups.py**: Proxy for AO Setups profile imports
- **health.py**, **cache.py**: Liveness check, response cache clearing

### Store Read Layer (`backend/app/store/`)

Every game-data route reads the content-addressed store (PostgreSQL schema `cas`) through this package: `context` (the build a request names, the session), `tables`, `presence` (the revisions of a build, filters, paging), `items` (item loader and the `ItemDetail` document) and `curated` (symbiants, mobs, perks). The module docstring of `backend/app/store/__init__.py` is the guide. Nothing reads any other schema: `backend/app/core/database.py` is the engine and no more.

### Source System

**Item origins, as the store serves them** (`source_type`, `source`, `item_source` in `backend/database/cas/002_curated_and_derived.sql`):
- Nanocrystals → nanoprograms (from `all_nanos_compacted.csv`); served when the build has the `sources` feature and the crystal is present in the build
- Mobs → symbiants (from `database/symbiants.csv`); served when the build has the `symbiants` feature

### Data Utilities (`backend/`)

- `import_cli.py import-cas`: loads the store from extracted client builds and the committed curated files (`backend/IMPORT_README.md`)
- `extract_builds.py`: extracts client builds with TinkerParse
- `tools/verify_cas.py`, `tools/golden.py`: verification of the store and of API responses
- `tools/export_legacy_item_ids.py`, `tools/drop_old_store.sql`: leaving the old store behind
- `substrain_manager.py`: Substrain ID assignment
- `compact_nanos.py`: CSV compaction tool
- `comprehensive_nano_extractor.py`: Database export tool

---

## 🏪 State Management System

### Pinia Store Architecture (`frontend/src/stores/`)

**Available Stores:**
- **useAppStore**: Global application state, theme, notifications
- **useProfileStore**: Character profile management, LocalStorage persistence
- **useItemsStore**: Item data caching and search state (cached by AOID)
- **useSymbiantsStore**: Symbiant data for TinkerPlants
- **usePocketBossesStore**: Pocket boss data for TinkerPocket

**Items Store Features:**
- **AOID-Based Caching**: Items cached using Anarchy Online Item ID as key
- **Efficient Lookup**: Direct item access via `getItem(aoid)` function
- **URL Consistency**: Store caching aligns with AOID-based routing system
- **Game Data Alignment**: Cache keys match game item identification system

### Store Initialization (`frontend/src/stores/index.ts`)

**Features:**
- Centralized store initialization sequence
- Preloading system for commonly used data
- Cross-app state sharing capabilities
- Store reset and hydration utilities
- Offline capability initialization

**Usage:**
```typescript
import { initializeStores, resetAllStores } from '@/stores'

// Initialize all stores and services
await initializeStores()

// Reset all state (useful for testing/logout)
await resetAllStores()
```

---

## 📝 Type System & Interfaces

### Core API Types (`frontend/src/types/api.ts`)

**Base Types:**
```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: { code: string; message: string; details?: any }
  meta?: { timestamp: string; requestId: string; version: string }
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: { page: number; limit: number; total: number; hasNext: boolean; hasPrev: boolean }
}
```

**Game Data Models:**
- **Item**: Complete item structure with stats, spells, actions
- **Spell**: Nano program data with parameters and requirements (spell_format deprecated)
- **Symbiant**: Symbiant data with stat bonuses and requirements
- **PocketBoss**: Pocket boss data with drop information
- **StatValue**: Stat ID and value pairs
- **Criterion**: Requirement criteria for items/spells

**Enhanced Search Types:**
- **ItemSearchQuery**: Includes `search_fields` parameter for targeted field searching
- **Advanced Search Support**: Search within specific fields (name, description, etc.)

### Application-Specific Types

- **nano.ts**: Nano program filtering and school classifications
- **plants.ts**: Implant planning and symbiant data structures
- **weapon.ts**: Weapon analysis and comparison types

---

## ⚙️ Shared Services

### Interpolation System (Quality Level Scaling)

**Backend Service** (`backend/app/services/interpolation.py`):
- Item quality level interpolation using legacy InterpItem.py logic
- Stat interpolation for INTERP_STATS (183 supported stats)
- Spell parameter interpolation for specific spell IDs
- Action criteria interpolation
- Range calculation and boundary validation

**Frontend Integration** (`frontend/src/services/interpolation-service.ts`):
- Client-side caching with TTL expiration
- Reactive state management
- Error handling and retry logic

**Vue Composables** (`frontend/src/composables/useInterpolation.ts`):
- `useInterpolation()`: Main interpolation composable with debouncing
- `useInterpolationCheck()`: Quick interpolation capability checking
- `useInterpolationBatch()`: Multi-item interpolation management

### Cache Management (`frontend/src/services/cache-manager.ts`)

**Features:**
- Client-side caching with automatic cleanup
- TTL-based expiration
- Memory usage monitoring
- Cache statistics and management APIs

### Game Utilities (`frontend/src/services/game-utils.ts`)

**Available Functions:**
- Stat calculation utilities
- Data transformation helpers
- Game-specific formatting functions
- Cross-application utility functions

**Flag Resolution Functions:**
- `getFlagNameFromValue(statId, value)`: Resolves flag values to human-readable names
- `getFlagNameFromBit(statId, bitNumber)`: Resolves bit flags to names
- `resolveFlags(statId, value)`: Universal flag resolution with automatic detection

**Name Resolution Functions:**
- `getStatName(statId)`: Get stat name from STAT constant
- `getProfessionName(professionId)`: Get profession name from PROFESSION constant
- `getBreedName(breedId)`: Get breed name from BREED constant
- `getGenderName(genderId)`: Get gender name from GENDER constant
- `getNPCFamilyName(familyId)`: Get NPC family name resolution

**Special Attack Calculations:**
- `calculateFling(attackTime)`: Fling Shot skill requirements and damage cap
- `calculateBurst(attackTime, rechTime, burstCycle)`: Burst fire calculations
- `calculateFullAuto(attackTime, rechTime, faCycle)`: Full Auto requirements
- `calculateAimedShot(attackTime, rechTime)`: Aimed Shot calculations
- `calculateFastAttack(attackTime)`: Fast Attack requirements

*Note: Special attack functions migrated from legacy TinkerPlants codebase (~/projects/Tinkerplants/tinkertools/views.py) to provide unified weapon analysis capabilities across all TinkerTools applications.*

### Spell Data Utilities (`frontend/src/services/spell-data-utils.ts`)

**Core Functions:**
- `getSpellFormat(spellId)`: Look up format strings from SPELL_FORMATS constant using spell_id
- `formatSpell(spell)`: Format spell data with spell_id-based format lookup
- `interpolateSpellText(format, params)`: Interpolate spell format strings with parameters
- `formatSpellParameters(params)`: Format spell parameters for display

**Text Interpolation Features:**
- Parameter substitution: `{Stat}`, `{MinValue}`, `{MaxValue}`, `{TickCount}`, `{TickInterval}`
- NanoID/ItemID links: Converts to `[LINK:12345]` format for component processing
- Chance percentages: Automatically converts to percentage display
- Stat name resolution: Converts stat IDs to human-readable names
- Spell field integration: Uses `spell.tick_count` and `spell.tick_interval` for timing data

**Event and Target Translation:**
- `getEventName(eventId)`: Translate event IDs (Use, Wield, Wear, etc.)
- `getTargetName(targetId)`: Translate target IDs (Self, User, Target, etc.)
- `getEventDisplayPriority(eventId)`: Sorting priority for spell events

---

## 🎨 Shared UI Components

### Cross-App Components (`frontend/src/components/shared/`)

- **LoadingSpinner.vue**: Consistent loading indicators
- **AccessibilityAnnouncer.vue**: Screen reader announcements
- **InterpolationControl.vue**: Quality level adjustment UI

### Criteria Display Components (`frontend/src/components/`)

**Core Components:**
- **CriteriaDisplay.vue**: Main criteria display with tree/chip mode detection
- **CriteriaTreeDisplay.vue**: Tree-structured criteria display with summary
- **CriteriaTreeNode.vue**: Individual tree nodes with status indicators
- **CriterionChip.vue**: Individual criterion chips with status colors
- **ActionRequirements.vue**: Action-based requirements display

**Features:**
- Automatic tree vs. chip display mode based on complexity
- Character stat evaluation with met/unmet status
- Professional name resolution (VisualProfession → "NanoTechnician")
- Flag name resolution for WornItem and other flag-based criteria
- NPCFamily name resolution for targeting criteria
- Expandable/collapsible requirements sections

### Theme System

**PrimeVue Integration:**
- Aura theme with dark/light mode support
- Global component registration
- Consistent styling across all applications

**Theme Switching:**
- Unified dark/light theme management
- TailwindCSS + PrimeVue integration
- Persistent theme preferences

### Global Tag Styling System (`frontend/src/styles/main.css`)

**Outlined Tag Components:**
- Custom CSS classes for consistent flag display across all TinkerTools
- Overrides PrimeVue Tag components to provide outlined appearance
- Supports all standard severity levels with appropriate color coding

**Available Classes:**
```css
.outline-tag                 /* Base outline styling */
.outline-tag-danger         /* Red outline (e.g., NoDrop flags) */
.outline-tag-secondary      /* Gray outline (standard informational) */
.outline-tag-success        /* Green outline (positive indicators) */
.outline-tag-warning        /* Yellow outline (caution indicators) */
.outline-tag-info          /* Blue outline (informational) */
```

**Usage Example:**
```vue
<Tag 
  :value="flag.name" 
  :severity="flag.severity"
  :class="['outline-tag', `outline-tag-${flag.severity}`]" 
/>
```

**Features:**
- Automatic dark mode color adjustments
- Transparent backgrounds with colored borders
- Consistent color palette across light/dark themes
- Works with all PrimeVue Tag severity levels

---

## 🗄️ Database Schema Reference

### Content-addressed store (schema `cas`)

Defined in `backend/database/cas/001_store.sql` and `002_curated_and_derived.sql`; the part documents are described in `backend/app/core/parts.py`.

- **build**: One row per client build (branch, ordinal, display fields, feature flags)
- **item_revision**: One row per distinct content of an item; points to its parts
- **part_text / part_stats / part_effects / part_actions / part_atkdef / part_misc**: De-duplicated part documents
- **item_presence**: Runs of consecutive builds in which an item has one revision
- **stat_entry / requirement / effect_entry / atkdef_entry**: Search projections of the parts
- **nano_properties**, **symbiant_items**: Derived from items
- **nano_overlay**, **perk**, **mob**, **source_type**, **source**, **item_source**: Curated data

- **build**: One row per client build; also the list of versions the API serves (presentation from `backend/database/builds.toml`)
- **legacy_item_id**: Internal item ids of the old database, for the one-time client migration

### Performance Optimizations

**Indexing Strategy:**
- B-tree indexes for standard queries
- GIN indexes for full-text search
- Composite indexes for common query patterns

**Query Performance Targets:**
- Complex stat queries: < 500ms (REQ-PERF-001)
- Route navigation: < 200ms (REQ-PERF-002)  
- Initial page load: < 3 seconds (REQ-PERF-003)

---

## 🔗 Cross-Application Integration

### Profile System (`frontend/src/lib/tinkerprofiles/`)

**Features:**
- Character profile management across all applications
- LocalStorage-based persistence (client-side only)
- Profile import/export capabilities
- Character stat tracking and calculation
- Cross-app profile sharing

**Components:**
- **ProfileManager**: Profile CRUD operations
- **ProfileStorage**: LocalStorage integration
- **ProfileValidator**: Data validation and integrity
- **ProfileTransformer**: Data format conversion

### Navigation & Routing (`frontend/src/router/index.ts`)

**Vue Router Configuration:**
- SPA navigation without page refreshes
- Cross-app context preservation
- Route-based application switching

**AOID-Based URL System:**
- **Item URLs**: `/items/{aoid}` where `aoid` is the Anarchy Online Item ID
- **User-Friendly**: URLs use game-recognizable item identifiers instead of database IDs
- **Shareable**: Direct links work with AOIDs that players recognize from the game
- **API Consistency**: Backend `/items/{aoid}` endpoint uses same identifier as URLs

**Route Examples:**
```
/items/72226         // Anarchy Online Item ID (AOID)
/nanos               // Nano programs list
/fite                // Weapon comparison tool
/plants              // Implant planning
/pocket              // Pocket boss tracker
```

**Implementation Details:**
- **Frontend Store Caching**: Items cached by AOID for efficient lookup
- **Backend Database Query**: Items are looked up by AOID in the requested build (`load_item_details`)
- **URL Generation**: Item links automatically use `item.aoid` for navigation
- **Share Functionality**: Generated URLs use AOID for game-relevant sharing

### Collection Tracking (TinkerPocket Integration)

**Features:**
- Symbiant collection progress tracking
- Pocket boss completion status
- Cross-reference with TinkerPlants implant planning

---

## 🧪 Development & Testing Infrastructure

### Test Suite Coverage

**Interpolation System** (90+ test scenarios):
- Backend: Unit tests, API tests, integration tests
- Frontend: Service tests, composable tests, UI tests
- Test runner: `./run_interpolation_tests.sh`

**Spell Data System** (23+ test scenarios):
- `spell-data-utils.test.ts`: Comprehensive spell formatting and interpolation tests
- Format lookup testing with SPELL_FORMATS constant
- Parameter interpolation validation (TickCount, TickInterval, stat names)
- Event and target name translation testing

**Application Tests:**
- Unit tests for all stores and services
- Integration tests for cross-app functionality
- E2E tests for critical user workflows

### Build System

**Vite Configuration:**
- TypeScript strict mode enabled
- Environment variable management
- Development and production optimizations

**Environment Variables:**
- `VITE_API_BASE_URL`: Backend API base URL (default: `http://localhost:8000/api/v1`)
- `VITE_ICON_BASE_URL`: Icon CDN base URL including folder path (default: `https://cdn.tinkeringidiot.com/aoicons`)
- `DATABASE_URL`: PostgreSQL connection string
- `SQL_DEBUG`: Enable SQL query logging

---

## 📊 Performance & Monitoring

### Caching Strategy

**Multi-Level Caching:**
1. **Browser Cache**: Static assets and API responses
2. **Service Cache**: Client-side data caching with TTL
3. **Response Cache**: In-process cache of API responses (`backend/app/core/cache.py`)

**Cache Management:**
- Automatic cleanup based on TTL
- Manual cache invalidation APIs
- Memory usage monitoring

### Performance Monitoring

**Available Endpoints:**
- `/health`: Liveness check

**Monitoring Targets:**
- API response times under performance thresholds
- Cache hit/miss ratios
- Database query performance
- Memory usage patterns

---

## 🚀 Quick Start Guide

### For New Features:

1. **Check Game Data**: Review `game-data.ts` for existing constants
2. **Use API Client**: Leverage existing typed endpoints
3. **State Management**: Use appropriate Pinia store
4. **UI Components**: Reuse shared components when possible
5. **Testing**: Add tests to existing test suites

### For Cross-App Integration:

1. **Profile System**: Use tinkerprofiles for character data
2. **State Sharing**: Use app store for cross-app communication
3. **Theme Consistency**: Follow existing theme patterns
4. **Type Safety**: Use shared type definitions

### For Performance:

1. **Caching**: Leverage existing cache infrastructure
2. **Interpolation**: Use interpolation system for quality scaling
3. **Batching**: Use the batch endpoints (`POST /items/batch/interpolate`, `POST /perks/batch/lookup`) for multiple items

---

## 📚 Additional Resources

- **CLAUDE.md**: Project overview and development commands
- **DATABASE.md**: Detailed database schema documentation
- **Requirements.md**: Complete project requirements (47 total)
- **docs/work_plan.md**: Implementation task roadmap
- **API Documentation**: Available at `http://localhost:8000/docs`

---

*Last Updated: This document reflects the current state after successful implementation of Tasks 1-11, plus major infrastructure enhancements including:*

*- **Comprehensive Criteria System**: Tree-structured requirement display with status evaluation*
*- **Spell Data Infrastructure**: spell_id-based format lookup with SPELL_FORMATS constant*  
*- **Enhanced Search System**: Advanced search with field-specific filtering*
*- **Flag Resolution System**: Unified flag name resolution across all criteria types*
*- **Professional/Family Name Resolution**: Support for VisualProfession and NPCFamily display*
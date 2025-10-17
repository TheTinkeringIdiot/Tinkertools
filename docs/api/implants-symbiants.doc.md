# API Documentation: Implants & Symbiants

**Feature**: TinkerPlants API Client & Type System
**Status**: Complete
**Created**: January 2025
**Last Updated**: January 2025

## Overview

This document describes the API client enhancements and TypeScript type system additions for the **TinkerPlants** implant and symbiant planning feature. The changes provide a complete type-safe interface between the frontend Pinia store and the backend FastAPI implant lookup service.

## API Client Changes

### Location
`frontend/src/services/api-client.ts`

### New Methods

#### `lookupImplant()`

Lookup a specific implant by slot, QL, and cluster configuration.

**Signature**:
```typescript
async lookupImplant(
  slot: number,
  ql: number,
  clusters: Record<string, number>
): Promise<ImplantLookupResponse>
```

**Parameters**:
- `slot` (number): Slot bitflag or position number (e.g., 2 for Eyes, 4 for Head)
- `ql` (number): Quality Level (1-300)
- `clusters` (Record<string, number>): Cluster configuration mapping position → stat ID
  - Keys: `"Shiny"`, `"Bright"`, `"Faded"` (capitalized, as expected by backend)
  - Values: Stat IDs (e.g., 112 for Pistol, 134 for Treatment)

**Returns**: `ImplantLookupResponse`
- `success` (boolean): Whether lookup succeeded
- `item` (Item | null): Found implant item data (null if not found)
- `interpolated` (boolean): Whether item was interpolated to target QL
- `base_ql` (number, optional): Base QL of database item before interpolation
- `message` (string, optional): Success or error message

**Backend Endpoint**: `POST /implants/lookup`

**Example**:
```typescript
const response = await apiClient.lookupImplant(2, 200, {
  'Shiny': 112,    // Pistol
  'Bright': 131,   // Time & Space
  'Faded': 134     // Treatment
});

if (response.success && response.item) {
  console.log('Found implant:', response.item.name);
  if (response.interpolated) {
    console.log('Interpolated from QL', response.base_ql);
  }
}
```

**Changes from Previous**:
- Now returns full `ImplantLookupResponse` wrapper (was bare `Item`)
- Exposes `interpolated` flag for transparency
- Uses proper TypeScript typing

---

#### `getAvailableImplants()`

Get all available implants for a specific slot at a given QL.

**Signature**:
```typescript
async getAvailableImplants(
  slot: number,
  ql: number = 1
): Promise<ApiResponse<Item[]>>
```

**Parameters**:
- `slot` (number): Slot bitflag or position number
- `ql` (number, default: 1): Quality Level for filtering

**Returns**: `ApiResponse<Item[]>`
- Wrapped in standard `ApiResponse` format
- `success` (boolean): Whether request succeeded
- `data` (Item[]): Array of available implant items

**Backend Endpoint**: `GET /implants/slots/{slot}/available?ql={ql}`

**Example**:
```typescript
const response = await apiClient.getAvailableImplants(2, 200);
if (response.success) {
  console.log(`Found ${response.data.length} implants for Eyes at QL 200`);
}
```

**Changes from Previous**:
- Now wraps response in `ApiResponse<T>` format
- Handles both wrapped and unwrapped backend responses
- Returns empty array on failure instead of throwing

---

#### `validateClusters()`

Validate cluster configuration for correctness (no duplicate stats, valid cluster positions).

**Signature**:
```typescript
async validateClusters(
  clusters: Record<string, number>
): Promise<ApiResponse<{ valid: boolean; message: string }>>
```

**Parameters**:
- `clusters` (Record<string, number>): Cluster configuration (same format as `lookupImplant()`)

**Returns**: `ApiResponse<{ valid: boolean; message: string }>`
- `valid` (boolean): Whether configuration is valid
- `message` (string): Validation message or error details

**Backend Endpoint**: `POST /implants/validate-clusters`

**Example**:
```typescript
const response = await apiClient.validateClusters({
  'Shiny': 112,
  'Bright': 112,  // Duplicate stat!
  'Faded': 134
});

if (response.success && !response.data.valid) {
  console.error('Invalid clusters:', response.data.message);
}
```

**Changes from Previous**:
- Now wraps response in `ApiResponse<T>` format
- Provides type-safe validation result

---

### API Client Enhancements

**Error Handling**:
- All methods use centralized `handleError()` for consistent error formatting
- Backend validation errors are properly serialized (see backend changes)

**Response Wrapping**:
- Methods now check if backend response is already wrapped in `ApiResponse` format
- If not, they wrap it client-side for consistency
- This maintains compatibility with varying backend response formats

**Type Safety**:
- All methods use generic TypeScript types (`ApiResponse<T>`)
- Return types are explicit and documented
- No `any` types in method signatures

---

## TypeScript Type Definitions

### Location
`frontend/src/types/api.ts`

### New Types (80 lines added)

---

#### `ImplantSelection`

Represents the configuration of a single implant slot.

```typescript
interface ImplantSelection {
  /** Shiny cluster stat ID (e.g., 112 for Pistol) or null if empty */
  shiny: number | null
  /** Bright cluster stat ID or null if empty */
  bright: number | null
  /** Faded cluster stat ID or null if empty */
  faded: number | null
  /** Quality level (1-300) */
  ql: number
  /** Slot bitflag string key (e.g., "2" for Eyes, "4" for Head) */
  slotBitflag: string
  /** Full item data from API (null if not yet loaded) */
  item: Item | null
}
```

**Usage Context**:
- Used by `useTinkerPlantsStore()` in `currentConfiguration` and `profileConfiguration`
- Stored in profile data at `profile.Implants[slotBitflag]`
- Clusters are **stat IDs** (numbers), not names (strings)

**Key Design Decisions**:
- Clusters stored as stat IDs for consistency with rest of TinkerTools architecture
- `slotBitflag` uses string keys (profile storage format)
- `item` is nullable to support incomplete/pending lookups

---

#### `ImplantLookupRequest`

Request payload for implant lookup API.

```typescript
interface ImplantLookupRequest {
  /** Slot position number or bitflag */
  slot: number
  /** Quality level (1-300) */
  ql: number
  /** Cluster configuration as stat ID → cluster name mapping */
  clusters: Record<string, number>
}
```

**Backend Expectations**:
- `clusters` keys must be capitalized: `"Shiny"`, `"Bright"`, `"Faded"`
- `clusters` values are stat IDs (e.g., 112 for Pistol)

**Example Payload**:
```json
{
  "slot": 2,
  "ql": 200,
  "clusters": {
    "Shiny": 112,
    "Bright": 131,
    "Faded": 134
  }
}
```

---

#### `ImplantLookupResponse`

Response format from implant lookup API.

```typescript
interface ImplantLookupResponse {
  /** Whether the lookup was successful */
  success: boolean
  /** The found implant item data (null if not found) */
  item: Item | null
  /** Success or error message */
  message?: string
  /** Whether the item was interpolated to target QL */
  interpolated: boolean
  /** Base QL of the database item used */
  base_ql?: number
}
```

**Key Fields**:
- `interpolated`: Indicates if stats were calculated vs. exact database match
- `base_ql`: Shows which database QL was used as interpolation source
- `message`: Provides context for success/failure

**Backend Behavior**:
- Returns `success: false` if no matching implant exists
- Returns `success: true` with `item: null` if clusters are invalid
- Performs QL interpolation transparently when exact QL not in database

---

#### `ImplantRequirement`

Requirement check result for a single stat.

```typescript
interface ImplantRequirement {
  /** Stat ID (e.g., 134 for Treatment) */
  stat: number
  /** Human-readable stat name */
  statName: string
  /** Required value for this stat */
  required: number
  /** Current profile value for this stat */
  current: number
  /** Whether requirement is met */
  met: boolean
}
```

**Usage Context**:
- Generated by `useTinkerPlantsStore().calculateRequirements()`
- Compares implant action criteria against active profile skills
- Used by `RequirementsDisplay.vue` to show unmet requirements

**Example**:
```typescript
{
  stat: 134,
  statName: "Treatment",
  required: 1200,
  current: 1000,
  met: false  // Need 200 more Treatment
}
```

---

#### `TreatmentInfo`

Aggregated treatment requirement information.

```typescript
interface TreatmentInfo {
  /** Treatment value required by implant configuration */
  required: number
  /** Current Treatment value from profile */
  current: number
  /** Delta between required and current (positive = need more) */
  delta: number
  /** Whether profile treatment meets requirement */
  sufficient: boolean
}
```

**Usage Context**:
- Calculated by `useTinkerPlantsStore().calculateRequirements()`
- Tracks maximum Treatment requirement across all configured implants
- Used by `TreatmentDisplay.vue` for prominent treatment indicator

**Key Logic**:
- `delta` is always non-negative (0 if sufficient)
- `sufficient` is true when `current >= required`
- `required` is the **maximum** Treatment across all slots (not sum)

---

#### `ImplantValidationResult`

Validation result for implant configuration.

```typescript
interface ImplantValidationResult {
  /** Whether configuration is valid */
  valid: boolean
  /** Blocking errors (invalid clusters, QL out of range, etc.) */
  errors: string[]
  /** Non-blocking warnings (suboptimal choices, etc.) */
  warnings: string[]
}
```

**Usage Context**:
- Returned by client-side validation logic (not yet implemented)
- Distinguishes between blocking errors and informational warnings
- Future: Used for pre-submission validation in UI

**Design Intent**:
- `errors`: Prevent save/apply (e.g., "Duplicate stat in clusters")
- `warnings`: Allow save but inform user (e.g., "Low-value cluster choice")

---

## Backend Changes

### Location
`backend/app/main.py`

### Validation Error Handling Enhancement

**Problem**: Pydantic validation errors contained non-JSON-serializable objects (e.g., `ValueError` instances in error context), causing FastAPI to crash with 500 errors instead of returning 422 validation errors.

**Solution**: Convert validation errors to fully JSON-serializable format before returning.

**Implementation**:
```python
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Convert errors to JSON-serializable format
    errors = []
    for error in exc.errors():
        error_dict = {
            "type": error.get("type"),
            "loc": error.get("loc"),
            "msg": error.get("msg"),
            "input": error.get("input")
        }
        # Convert ctx ValueError to string if present
        if "ctx" in error and "error" in error["ctx"]:
            error_dict["ctx"] = {"error": str(error["ctx"]["error"])}
        errors.append(error_dict)

    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation error",
            "code": "VALIDATION_ERROR",
            "details": errors
        }
    )
```

**Impact**:
- Fixes crashes when cluster stat IDs are invalid
- Provides proper 422 responses with detailed error information
- Maintains error context for debugging while ensuring serializability

---

## Data Flow

### Implant Lookup Workflow

```
User selects clusters in UI (ClusterLookup.vue)
  ↓
Store.updateSlot() updates currentConfiguration
  ↓
Store.lookupImplantForSlotDebounced() debounces API call (100ms)
  ↓
Store.lookupImplantForSlot() checks cache
  ↓ (cache miss)
apiClient.lookupImplant() calls POST /implants/lookup
  ↓
Backend ImplantService finds/interpolates item
  ↓
ImplantLookupResponse returned with item data
  ↓
Store caches result (5min TTL) and updates currentConfiguration
  ↓
Store.calculateBonuses() extracts stat bonuses
  ↓
Store.calculateRequirements() checks profile compatibility
  ↓
UI reactively updates (BonusDisplay, RequirementsDisplay, TreatmentDisplay)
```

### Key Files in Workflow

**Frontend**:
- `stores/tinkerPlants.ts` - State management (842 lines)
- `services/api-client.ts` - API communication
- `types/api.ts` - Type definitions
- `components/plants/ClusterLookup.vue` - Cluster selection UI (205 lines)
- `components/plants/BonusDisplay.vue` - Bonus aggregation display (294 lines)
- `components/plants/RequirementsDisplay.vue` - Requirement checking (164 lines)
- `components/plants/TreatmentDisplay.vue` - Treatment indicator (259 lines)

**Backend**:
- `app/api/routes/implants.py` - API endpoints (241 lines)
- `app/services/implant_service.py` - Lookup and interpolation logic (325 lines)

---

## Type System Architecture

### Cluster Stat ID Storage

**Decision**: Store cluster configurations as **stat IDs** (numbers), not stat names (strings).

**Rationale**:
- Consistency with rest of TinkerTools (skills, stats, bonuses all use IDs)
- Avoids name normalization issues (e.g., "Pistol" vs. "1h Blunt Weapons")
- Enables type-safe skill resolution via `skillService.resolveId()`
- Simplifies backend API (expects IDs, not names)

**Implementation**:
```typescript
// ❌ OLD: String names (fragile, requires normalization)
{ shiny: "Pistol", bright: "Time & Space", faded: "Treatment" }

// ✅ NEW: Stat IDs (robust, type-safe)
{ shiny: 112, bright: 131, faded: 134 }
```

**Conversion Points**:
- UI displays names via `skillService.getName(statId)`
- User selects via dropdown → store converts name to ID via `skillService.resolveId(name)`
- API requests use IDs directly
- Database descriptions parsed via regex → converted to IDs via `skillService.resolveId()`

---

### Nullable vs. Optional Fields

**Pattern**: Use `null` for "empty but valid" states, `undefined`/`?` for "not yet set" states.

**Examples**:

```typescript
// Cluster can be explicitly empty (null) or configured (number)
shiny: number | null  // ✅ Supports "empty shiny cluster"

// Item data may not exist yet (optional)
item?: Item  // ❌ Ambiguous - is it loading or failed?
item: Item | null  // ✅ Clear - null means "no item loaded/found"
```

**Design Rule**: If a field represents a "configured empty state" (like an empty cluster slot), use `null`. If it represents "data not yet available", use `null` with explicit documentation.

---

### ApiResponse Wrapper Pattern

**Pattern**: Standardize all API responses with `ApiResponse<T>` wrapper.

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  code?: string
}
```

**Enforcement**:
- Client-side methods wrap responses if backend doesn't
- Provides consistent error handling across all API methods
- Enables type-safe response checking

**Example**:
```typescript
// Backend returns raw array
const response = await apiClient.getAvailableImplants(2, 200);

// Client wraps it
if (response.success) {
  const items: Item[] = response.data;  // Type-safe access
}
```

---

## Related Systems

### Integration with TinkerProfiles

**Profile Storage Format**:
- Implants stored at `profile.Implants[slotBitflag]` (e.g., `profile.Implants["2"]` for Eyes)
- Value is full `Item` object (not `ImplantSelection`)
- Cluster info encoded in `item.description` via regex parsing

**Store Synchronization**:
- `loadFromProfile()` parses `profile.Implants` → `currentConfiguration`
- `saveToProfile()` converts `currentConfiguration` → `profile.Implants`
- Dirty tracking via `hasChanges` computed property

### Integration with Equipment Bonus System

**Bonus Extraction**:
- Uses `equipmentBonusCalculator.parseItemSpells()` (not item.stats directly)
- Extracts bonuses from both `item.stats` and `item.spell_data`
- Handles wear/wield events (event 14 = Wear, event 2 = Wield)

**Special Handling**:
- Stat 355 (WornItem) uses bitwise OR, not addition
- All other stats use addition for aggregation

### Integration with Action Criteria System

**Requirement Parsing**:
- Uses `getCriteriaRequirements()` from `services/action-criteria.ts`
- Extracts minimum/exact value requirements from item actions
- Handles AND/OR logic in criteria groups

**Profile Comparison**:
- Compares `requirement.minValue` against `profile.skills[statId].total`
- Marks requirement as `met` if profile value >= required value

---

## Performance Considerations

### Client-Side Caching

**Cache Implementation**:
- In-memory `Map<string, CacheEntry>` with 5-minute TTL
- Cache key: `implant_${slot}_${ql}_${clustersHash}`
- Automatic expiration on TTL exceeded

**Cache Hit Rate**:
- High for repeated slot views (e.g., toggling between slots)
- Low for manual cluster changes (different cache key)
- Debouncing (100ms) reduces unnecessary cache misses

### Debounced Lookups

**Implementation**:
- 100ms debounce on `lookupImplantForSlotDebounced()`
- Prevents API spam during dropdown changes
- Per-slot debounce timers (independent slots don't block each other)

**User Experience**:
- Instant UI feedback (cluster selection updates immediately)
- Brief delay before API call (user doesn't notice 100ms)
- Loading indicator shows during API call

### Backend Interpolation

**Performance**:
- Backend performs QL interpolation when exact QL not in database
- Interpolation is fast (simple stat scaling based on QL formula)
- Response includes `interpolated: true` flag for transparency

**Accuracy**:
- Interpolation uses game formulas (stat scaling based on QL)
- More accurate than client-side estimation
- Matches in-game values for most stats

---

## Testing Strategy

### Unit Tests

**API Client Methods**:
- Mock axios responses for each method
- Test error handling (network errors, validation errors, 404s)
- Test response wrapping logic

**Type Validation**:
- Test that all types compile without errors
- Use `expectType<T>()` helper for type assertions

### Integration Tests

**Store + API Client**:
- Use real Pinia store with mocked API client
- Test full lookup workflow (select clusters → lookup → bonus calculation)
- Verify cache behavior (hit/miss scenarios)
- Test dirty tracking (hasChanges computed property)

**Backend Integration**:
- Test real API endpoints with test database
- Verify interpolation accuracy
- Test validation error responses

### E2E Tests (Future)

**Critical Paths**:
1. Load profile → select clusters → lookup → save
2. Manual cluster changes → debounced lookup → bonus update
3. Treatment requirement warning display
4. Unmet requirements prevent save

---

## Future Enhancements

### Short Term

1. **Attribute Preference Filtering**:
   - Backend support for filtering implants by preferred attribute
   - Client-side filtering in `getAvailableImplants()`

2. **Batch Lookup API**:
   - Single API call to lookup all slots at once
   - Reduces network overhead for full configuration loads

3. **Optimistic UI Updates**:
   - Show estimated bonuses before API response
   - Replace with real data when API returns

### Medium Term

1. **Implant Optimization**:
   - Suggest optimal cluster combinations for target stats
   - Auto-fill based on build goals

2. **Build Templates**:
   - Save/load named implant configurations
   - Share builds via URL/JSON export

3. **Visual Diff**:
   - Compare current vs. saved configuration side-by-side
   - Highlight changed slots and stat deltas

### Long Term

1. **Multi-Profile Comparison**:
   - Compare implant configurations across multiple profiles
   - Show which profile meets requirements for each build

2. **Symbiant Integration**:
   - Combined implant + symbiant planning
   - Optimization across both systems

3. **Requirement Solver**:
   - Calculate IP investment needed to meet unmet requirements
   - Suggest ladder items/buffs to bridge gaps

---

## Related Documentation

- **Feature Documentation**: `.docs/features/tinkerplants-implant-planning.doc.md` (to be created)
- **Store Documentation**: `frontend/src/stores/tinkerPlants.ts` (inline JSDoc)
- **Backend Service**: `backend/app/services/implant_service.py`
- **Component Docs**: Inline JSDoc in `frontend/src/components/plants/`

---

## Conclusion

The implants & symbiants API client and type system provides a robust, type-safe foundation for the TinkerPlants feature. Key achievements:

- ✅ **Type Safety**: Comprehensive TypeScript types for all API interactions
- ✅ **Error Handling**: Proper validation error serialization and client-side handling
- ✅ **Performance**: Client-side caching and debouncing reduce API load
- ✅ **Transparency**: Interpolation flags and base QL tracking
- ✅ **Consistency**: Standardized `ApiResponse<T>` wrapper pattern
- ✅ **Integration**: Seamless connection to TinkerProfiles, equipment bonuses, and action criteria systems

The implementation supports ~4,600 lines of UI components and provides a solid foundation for future enhancements like attribute filtering, batch lookups, and build optimization.

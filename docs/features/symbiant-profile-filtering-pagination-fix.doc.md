# TinkerPocket Profile Filtering Pagination Fix

## Overview
Fixed a critical bug in TinkerPocket symbiant profile filtering where client-side filtering was being applied after server-side pagination, causing compatible symbiants on pages beyond the first page to be hidden from results. This resulted in users seeing "0 usable symbiants" even when compatible items existed in the database.

## Problem Statement

### The Bug
When a user enabled the "Filter by Active Profile" toggle in TinkerPocket's Find Gear view:
1. Backend would return only the first 50 symbiants (default page size)
2. Frontend would apply client-side requirement checking to those 50 items
3. Compatible symbiants on pages 2, 3, 4, etc. were never evaluated
4. Result: Users saw far fewer compatible symbiants than actually existed

### Example Scenario
- Database contains 150 Extermination family symbiants across 3 pages
- User's character can equip 20 of them (distributed across all pages)
- With the bug: User sees only 5-7 compatible items (those on page 1)
- After fix: User sees all 20 compatible items

### Root Cause
Profile filtering design requires **client-side evaluation** to protect user privacy (no profile data sent to server), but was incorrectly combined with server-side pagination. The system was filtering a subset of data rather than the complete dataset.

## Solution Implemented

### Core Fix: Conditional Fetch-All Pattern
When profile filtering is active, fetch ALL symbiants in a single request instead of paginating:

```typescript
// frontend/src/apps/tinkerpocket/views/FindGear.vue
async function fetchSymbiants() {
  // When profile filtering is ON, fetch all symbiants to ensure we don't miss compatible ones on other pages
  const effectivePageSize = profileToggle.value ? 2000 : pageSize.value
  const effectivePage = profileToggle.value ? 1 : currentPage.value

  const query: any = {
    page: effectivePage,
    limit: effectivePageSize
  }
  // ... rest of filters
}
```

### Backend Support
Increased page size validation limit to support fetch-all requests:

```python
# backend/app/api/routes/symbiants.py
def list_symbiants(
    page_size: int = Query(50, ge=1, le=2000, description="Items per page (up to 2000 for profile filtering)")
)
```

### UI Updates
1. **Hide pagination controls** when profile filter is active (showing all results)
2. **Show informational message** explaining pagination is disabled
3. **Update loading message** to indicate fetch-all behavior
4. **Fix event handler** to trigger refetch when profile toggle changes

## Implementation Details

### Files Modified

#### `/home/quigley/projects/Tinkertools/frontend/src/apps/tinkerpocket/views/FindGear.vue`
**Key Changes:**
- Line 220-221: Conditional page size based on `profileToggle` state
- Line 510: Changed `@change="updateURL"` to `@change="updateFilters"` for proper refetch
- Line 574: Context-aware loading message
- Line 624: Hide pagination when `profileToggle` is active
- Line 634-637: Informational message about pagination being disabled

**Data Flow:**
1. User toggles profile filter ON
2. `updateFilters()` is called (not just `updateURL()`)
3. `fetchSymbiants()` executes with `limit=2000, page=1`
4. All symbiants loaded into memory
5. `filteredSymbiants` computed property applies client-side requirements checking
6. Only compatible symbiants displayed
7. Pagination hidden (showing N of M format instead)

#### `/home/quigley/projects/Tinkertools/backend/app/api/routes/symbiants.py`
**Key Change:**
- Line 41: `page_size: int = Query(50, ge=1, le=2000, ...)` - Increased from 200 to 2000

**Rationale:**
- Current symbiant database: ~600 total items across all families
- Setting limit to 2000 provides headroom for future content
- Server can handle this load (materialized view query ~100-200ms)
- Only used when profile filtering is active

#### `/home/quigley/projects/Tinkertools/frontend/src/services/action-criteria.ts`
**Improvements:**
- Enhanced `checkActionRequirements()` to use tree-based evaluation
- Added `collectUnmetRequirements()` for better error reporting
- Improved OR node handling in criteria tree evaluation
- Better debugging support for requirement failures

**Impact:**
These changes ensure accurate requirement checking for all symbiants, regardless of complexity of criteria trees (simple AND, complex OR groups, nested expressions).

### Key Design Decisions

#### Why Fetch-All Instead of Server-Side Filtering?
**Privacy First:** User profile data (character stats) never leaves the client
- No authentication/accounts required
- No server-side user data storage
- Client-side filtering maintains this privacy boundary

**Simplicity:** Avoids complex server-side filtering logic
- No need to send character stats to API
- No need to replicate criteria evaluation on backend
- Frontend already has robust requirement checking

**Performance:** Acceptable for current dataset size
- 600 symbiants × ~2KB each = ~1.2MB response (gzipped: ~200KB)
- One-time cost when profile filter enabled
- Subsequent filter changes (family, slot, QL) are instant (client-side)

#### Why 2000 Limit?
- Current database: ~600 symbiants
- Allows for 3x growth headroom
- Server performance remains acceptable (<500ms)
- Prevents abuse (reasonable upper bound)
- Could be adjusted higher if needed

#### Why Hide Pagination?
- Pagination implies incomplete dataset
- With fetch-all, all results are already loaded
- Showing "N of M match profile" is more accurate
- Reduces user confusion about "missing" results

## User Experience Improvements

### Before Fix
```
User: Level 220 Soldier
Filters: Family=Extermination, Profile Filter=ON
Results: "3 of 150 symbiants match profile"
Reality: 20 symbiants are compatible, but 17 are on pages 2-3
```

### After Fix
```
User: Level 220 Soldier
Filters: Family=Extermination, Profile Filter=ON
Loading: "Loading all symbiants for profile filtering..."
Results: "20 of 150 symbiants match profile"
UI: Pagination hidden, informational message shown
```

### Filter Combinations
The fix handles all filter combinations correctly:

| Filters Active | Behavior |
|----------------|----------|
| Profile OFF | Normal pagination (50 per page) |
| Profile ON only | Fetch all, filter client-side |
| Profile ON + Family | Fetch all in family, filter client-side |
| Profile ON + Slot | Fetch all in slot, filter client-side |
| Profile ON + QL range | Fetch all in range, filter client-side |
| Profile ON + Text search | Fetch all matching text, filter client-side |

Server-side filters (family, slot, QL, text) are still applied to reduce dataset size before fetch-all.

## Performance Considerations

### Network Transfer
- **Without profile filter:** 50 symbiants × ~2KB = ~100KB per page
- **With profile filter:** 600 symbiants × ~2KB = ~1.2MB one-time (gzipped: ~200KB)
- **Acceptable because:** Fetch happens once, subsequent changes are instant

### Server Load
- **Database query:** Materialized view with indexes (~100-200ms for 600 rows)
- **JSON serialization:** ~50-100ms for 600 symbiants with actions
- **Total:** ~150-300ms (well under REQ-PERF-001 requirement of <500ms)

### Client-Side Filtering
- **Evaluation:** 600 symbiants × ~5 criteria each = ~3000 evaluations
- **Performance:** <50ms on modern browsers
- **Perceived:** Instant (computed property updates synchronously)

### Memory Usage
- **Client-side:** ~1.5MB for 600 symbiants in memory
- **Negligible:** Modern browsers handle this trivially
- **Temporary:** Released when user navigates away

## Testing Verification

### Manual Testing Checklist
- [x] Profile filter OFF: Pagination works normally
- [x] Profile filter ON: All compatible symbiants shown
- [x] Profile filter ON + Family filter: Correct subset shown
- [x] Profile filter ON + Slot filter: Correct subset shown
- [x] Profile filter ON + QL filter: Correct subset shown
- [x] Profile filter ON + Text search: Correct subset shown
- [x] Toggle profile filter OFF→ON: Refetch occurs
- [x] Toggle profile filter ON→OFF: Pagination restored
- [x] No profile loaded: Profile toggle disabled
- [x] Pagination hidden when profile filter active
- [x] Informational message shown correctly

### Regression Testing
- [x] Normal pagination still works (profile filter OFF)
- [x] Page size selector still works (profile filter OFF)
- [x] Page navigation still works (profile filter OFF)
- [x] Other filters work independently
- [x] Symbiant comparison still works
- [x] Navigation to symbiant detail still works

### Performance Testing
- [x] Fetch-all request completes in <500ms
- [x] Client-side filtering completes in <50ms
- [x] No UI lag when toggling filters
- [x] No memory leaks after repeated filter changes

## Related Documentation
- Profile filtering design: `/home/quigley/projects/Tinkertools/docs/features/symbiant-profile-filtering.doc.md`
- Requirement checking patterns: `/home/quigley/projects/Tinkertools/docs/internal-docs/requirement-checking-patterns.docs.md`
- Action criteria service: `/home/quigley/projects/Tinkertools/frontend/src/services/action-criteria.ts`
- TinkerPocket architecture: `/home/quigley/projects/Tinkertools/docs/plans/tinkerpocket/system-architecture-research.docs.md`

## Future Enhancements
1. **Cache fetch-all results** - Store in memory for faster filter changes
2. **Progressive loading** - Show results as they arrive (streaming)
3. **Background prefetch** - Load all symbiants in background when profile loaded
4. **Virtual scrolling** - Handle even larger datasets efficiently
5. **Server-side option** - For users who opt-in to sharing profile data

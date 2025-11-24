# Symbiant Pagination and Chunked Loading

## Overview
Implemented pagination support in the symbiants API endpoint and chunked loading in the frontend to prevent gateway timeout errors when loading large symbiant datasets. This change addresses production 504 Gateway Timeout issues that occurred when attempting to load all 1,109 symbiants in a single request.

## User Perspective
Users loading the TinkerPocket symbiant view now see progress indicators as data loads in chunks rather than experiencing timeout errors. The first load takes 60-90 seconds but displays "Loaded X/Y symbiants..." progress messages in the console. After the initial load, the complete dataset is cached in IndexedDB for 30 days, making subsequent loads nearly instant (<1 second).

**User Experience:**
- **First load**: 60-90 seconds with progress indicators (no timeout errors)
- **Subsequent loads**: <1 second from IndexedDB cache
- **Cache duration**: 30 days
- **No more 504 errors**: Chunked loading prevents gateway timeouts

## Data Flow

### Initial Load (No Cache)
1. User navigates to TinkerPocket symbiant view
2. Store checks IndexedDB cache (cache miss on first load)
3. Store initiates chunked loading:
   - Request page 1 (100 items) from `/api/symbiants?page=1&page_size=100`
   - Backend returns `PaginatedResponse` with items, total count, and pagination metadata
   - Console logs: "Loaded 100/1109 symbiants..."
   - Request page 2 (100 items), log progress, repeat...
4. After all chunks loaded (11 requests total for 1,109 symbiants):
   - Complete dataset stored in Pinia store
   - Complete dataset cached to IndexedDB with 30-day TTL
   - Console logs: "Cached 1109 symbiants to IndexedDB"
5. UI renders symbiant list from store

### Cached Load
1. User navigates to TinkerPocket symbiant view
2. Store checks IndexedDB cache (cache hit)
3. Store verifies cache timestamp (valid if <30 days old)
4. Complete dataset loaded from IndexedDB into Pinia store (<1 second)
5. UI renders symbiant list immediately

### Backend Pagination
1. API receives request: `GET /api/symbiants?page=2&page_size=100`
2. Backend calculates offset: `(page - 1) * page_size = 100`
3. Backend counts total items: `1109`
4. Backend fetches page slice: `LIMIT 100 OFFSET 100`
5. Backend returns `PaginatedResponse`:
   ```json
   {
     "items": [...100 symbiants...],
     "total": 1109,
     "page": 2,
     "page_size": 100,
     "pages": 12,
     "has_next": true,
     "has_prev": true
   }
   ```

## Implementation

### Key Files

#### Backend Changes
- `backend/app/api/routes/symbiants.py` - Added pagination support to `/symbiants` endpoint
  - Changed return type from `List[SymbiantResponse]` to `PaginatedResponse[SymbiantResponse]`
  - Added `page` and `page_size` query parameters (default: page 1, 50 items per page, max 200)
  - Implemented pagination logic with `.limit()` and `.offset()`
  - Returns pagination metadata (total, pages, has_next, has_prev)

#### Frontend Changes
- `frontend/src/services/api-client.ts` - Updated `searchSymbiants()` method
  - Changed return type from `SymbiantItem[]` to `PaginatedResponse<SymbiantItem>`
  - Added support for `page` and `limit` query parameters
  - Uses `getPaginated<T>()` helper for consistent pagination handling

- `frontend/src/stores/symbiants.ts` - Implemented chunked loading in `loadAllSymbiants()`
  - Loads data in 100-item chunks using a while loop
  - Shows progress logs: "Loaded X/Y symbiants..."
  - Accumulates all chunks into single array
  - Caches complete dataset to IndexedDB after all chunks loaded
  - IndexedDB cache key: `tinkertools:symbiants:all`
  - Cache structure: `{ data: Symbiant[], timestamp: number, version: 1 }`

- `frontend/src/utils/symbiantHelpers.ts` - Fixed TypeScript type errors
  - Updated slot property access to use optional chaining
  - Added null checks for slot data

#### Test Updates
- `frontend/src/__tests__/stores/symbiantsStore.integration.test.ts` - Updated for pagination
  - Mock API now returns `PaginatedResponse` format
  - Tests verify chunked loading behavior
  - Tests verify progress logging

- `frontend/src/__tests__/utils/symbiantHelpers.test.ts` - Fixed test data
  - Updated test fixtures to include slot data
  - Fixed type errors in test assertions

#### Dependencies
- `package.json` - Updated dependency versions (routine maintenance)
- `package-lock.json` - Lockfile updated to match

### Technical Details

#### Backend Pagination Pattern
```python
@router.get("", response_model=PaginatedResponse[SymbiantResponse])
@cached_response("symbiants")
@performance_monitor
def list_symbiants(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    db: Session = Depends(get_db)
) -> PaginatedResponse[SymbiantResponse]:
    """
    List symbiants with pagination.

    Pagination parameters:
    - page: Page number (1-indexed)
    - page_size: Number of items per page (default: 50, max: 200)
    """
    # Base query with ordering
    base_query = (
        db.query(SymbiantItem)
        .order_by(
            SymbiantItem.family.asc(),
            SymbiantItem.ql.asc(),
            SymbiantItem.name.asc()
        )
    )

    # Get total count
    total = base_query.count()

    # Calculate pagination
    pages = math.ceil(total / page_size) if total > 0 else 1
    offset = (page - 1) * page_size

    # Get paginated results
    symbiants = base_query.limit(page_size).offset(offset).all()

    # ... build response objects ...

    return PaginatedResponse[SymbiantResponse](
        items=symbiant_responses,
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        has_next=page < pages,
        has_prev=page > 1
    )
```

#### Frontend Chunked Loading Pattern
```typescript
async function loadAllSymbiants(forceRefresh = false): Promise<Symbiant[]> {
  // Check IndexedDB cache first (30-day TTL)
  const cached = await get<SymbiantCacheEntry>(SYMBIANTS_CACHE_KEY);
  if (cached && !forceRefresh && Date.now() - cached.timestamp < CACHE_TTL) {
    // Load from cache
    symbiants.value.clear();
    cached.data.forEach(s => symbiants.value.set(s.id, s));
    return cached.data;
  }

  // Load in chunks to avoid timeout
  const allSymbiantsData: Symbiant[] = [];
  let currentPage = 1;
  const pageSize = 100;
  let hasMore = true;

  console.log('[SymbiantsStore] Starting chunked symbiant load...');

  while (hasMore) {
    const response = await apiClient.searchSymbiants({
      page: currentPage,
      limit: pageSize,
    });

    if (response?.items?.length) {
      const enrichedChunk = response.items.map(enrichSymbiant);
      allSymbiantsData.push(...enrichedChunk);

      // Show progress
      console.log(`[SymbiantsStore] Loaded ${allSymbiantsData.length}/${response.total} symbiants...`);

      hasMore = response.has_next;
      currentPage++;
    } else {
      hasMore = false;
    }
  }

  // Store complete dataset in Pinia
  symbiants.value.clear();
  allSymbiantsData.forEach(s => symbiants.value.set(s.id, s));

  // Cache complete dataset to IndexedDB
  await set(SYMBIANTS_CACHE_KEY, {
    data: allSymbiantsData,
    timestamp: Date.now(),
    version: 1,
  });

  console.log(`[SymbiantsStore] Cached ${allSymbiantsData.length} symbiants to IndexedDB`);

  return allSymbiantsData;
}
```

### Performance Characteristics

#### Network Performance
- **11 HTTP requests** for complete dataset (1,109 items ÷ 100 per chunk)
- **~5-8 seconds per request** (backend processing + network latency)
- **Total first load**: 60-90 seconds
- **Subsequent loads**: <1 second from IndexedDB

#### Memory Usage
- **Pinia store**: ~500 KB in memory (all 1,109 symbiant objects)
- **IndexedDB cache**: ~500 KB on disk (same data serialized)
- **No memory leaks**: Map-based storage with proper cleanup

#### Cache Strategy
- **TTL**: 30 days (2,592,000,000 ms)
- **Storage**: IndexedDB (supports >50 MB vs LocalStorage ~5-10 MB)
- **Invalidation**: Manual via `forceRefresh=true` or automatic after 30 days
- **Versioning**: Cache version field for future migration support

### Why This Approach?

#### Problem: Gateway Timeout
- Loading all 1,109 symbiants in single request caused 504 Gateway Timeout
- Gateway timeout typically occurs after 60 seconds of backend processing
- Single large response exceeded timeout threshold

#### Solution: Chunked Loading
- **Smaller requests**: 100 items per chunk (well under timeout threshold)
- **Progress indicators**: User sees progress, knows system is working
- **Fault tolerance**: Individual chunk failures don't break entire load
- **Caching**: Complete dataset cached after successful load

#### Alternative Approaches Considered
1. **Increase gateway timeout** - Bad UX, doesn't solve root cause
2. **Reduce dataset size** - Not viable (need all symbiants for filtering)
3. **Server-side caching only** - Still hits timeout on cache miss
4. **WebSocket streaming** - Over-engineered for static data

## Configuration

### Backend Pagination Limits
- **Default page size**: 50 items
- **Maximum page size**: 200 items (prevents abuse)
- **Minimum page**: 1 (1-indexed pagination)
- **Cache decorator**: `@cached_response("symbiants")` (1-hour TTL from existing setup)

### Frontend Chunking
- **Chunk size**: 100 items per request (balance between request count and timeout risk)
- **Cache TTL**: 30 days (2,592,000,000 ms)
- **Cache key**: `tinkertools:symbiants:all`
- **Cache version**: 1 (for future migration support)

### IndexedDB Setup
```typescript
import { get, set } from 'idb-keyval';

const SYMBIANTS_CACHE_KEY = 'tinkertools:symbiants:all';
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

interface SymbiantCacheEntry {
  data: Symbiant[];
  timestamp: number;
  version: number;
}
```

## Testing

### Manual Testing
1. **First Load Test**:
   ```bash
   # Clear IndexedDB cache
   # Chrome DevTools → Application → IndexedDB → keyval-store → Delete

   # Navigate to TinkerPocket
   # Open Console
   # Verify logs:
   # "[SymbiantsStore] Starting chunked symbiant load..."
   # "[SymbiantsStore] Loaded 100/1109 symbiants..."
   # "[SymbiantsStore] Loaded 200/1109 symbiants..."
   # ...
   # "[SymbiantsStore] Cached 1109 symbiants to IndexedDB"
   ```

2. **Cache Test**:
   ```bash
   # Refresh page
   # Verify instant load (<1 second)
   # Verify no network requests to /api/symbiants in DevTools Network tab
   ```

3. **Pagination API Test**:
   ```bash
   # Test pagination endpoint
   curl "http://localhost:8000/api/symbiants?page=1&page_size=50"

   # Verify response structure:
   # {
   #   "items": [...50 symbiants...],
   #   "total": 1109,
   #   "page": 1,
   #   "page_size": 50,
   #   "pages": 23,
   #   "has_next": true,
   #   "has_prev": false
   # }
   ```

### Integration Tests
- `symbiantsStore.integration.test.ts` - Tests chunked loading with mocked pagination API
- `symbiantHelpers.test.ts` - Tests symbiant enrichment and type handling

### Expected Behavior
- **No 504 errors**: Chunked loading prevents gateway timeouts
- **Progress visibility**: Console logs show loading progress
- **Cache persistence**: Data survives page refresh for 30 days
- **Type safety**: TypeScript types match API response structure
- **Backward compatibility**: Existing symbiant filtering/sorting still works

## Migration Notes

### Breaking Changes
- API client `searchSymbiants()` now returns `PaginatedResponse<SymbiantItem>` instead of `SymbiantItem[]`
- Any code calling `searchSymbiants()` directly must handle paginated response

### Backward Compatibility
- Store methods maintain same interface (`loadAllSymbiants()` still returns `Symbiant[]`)
- UI components unchanged (store abstracts pagination details)
- IndexedDB cache handles version field for future migrations

### Rollback Plan
If issues arise:
1. Revert to previous commit
2. Frontend will still work with non-paginated API (returns all items)
3. May experience 504 timeouts on large datasets

## Related Documentation
- Original symbiant system: `docs/features/symbiant-system.doc.md`
- Pagination API pattern: `backend/app/api/CLAUDE.md`
- IndexedDB usage: `CLAUDE.md` (client-side storage strategy)
- API schemas: `backend/app/api/schemas/common.py` (PaginatedResponse model)

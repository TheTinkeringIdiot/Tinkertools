# API Pagination Pattern

## Overview
This document describes the pagination architecture used throughout the TinkerTools API client layer. The system was refactored to eliminate double-wrapping issues where backend responses were incorrectly being wrapped in an additional `ApiResponse` layer, causing type mismatches and complex unwrapping logic in stores.

## Architecture Pattern

### Backend Response Format
The FastAPI backend returns paginated responses in a flat structure:

```typescript
interface PaginatedResponse<T> {
  items: T[]          // Array of result items
  total: number       // Total count of items matching query
  page: number        // Current page number (1-indexed)
  page_size: number   // Items per page
  pages: number       // Total number of pages
  has_next: boolean   // True if there's a next page
  has_prev: boolean   // True if there's a previous page
}
```

**Key characteristics:**
- Flat structure (not wrapped in `ApiResponse`)
- Snake_case field names matching backend Pydantic models
- Pagination metadata included at top level
- Generic type `T` represents the item type (Item, Spell, Mob, etc.)

### API Client Methods

The API client provides specialized methods for paginated requests:

```typescript
class TinkerToolsApiClient {
  // GET request returning paginated response
  async getPaginated<T>(url: string, config?: AxiosRequestConfig): Promise<PaginatedResponse<T>>

  // POST request returning paginated response
  async postPaginated<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<PaginatedResponse<T>>
}
```

**Design decisions:**
- Separate methods from `get<T>()` and `post<T>()` which return `ApiResponse<T>`
- No wrapping - returns backend response directly
- Type-safe generics ensure correct item type throughout stack
- Axios response unwrapping happens once: `response.data`

### Store Integration

Pinia stores consume paginated responses and transform them to internal pagination format:

```typescript
// Before (incorrect - assumed wrapped response)
const response = await apiClient.searchItems(query)
if (response.success && response.data) {
  return response.data  // Type error: data is T[], not PaginatedResponse<T>
}

// After (correct - flat response)
const response = await apiClient.searchItems(query)
if (response.items) {
  searchResults.value = {
    results: response.items,
    pagination: {
      page: response.page,
      limit: response.page_size,
      total: response.total,
      hasNext: response.has_next,
      hasPrev: response.has_prev
    }
  }
  return response.items
}
```

**Store pagination format** (internal, camelCase):
```typescript
interface StorePagination {
  page: number
  limit: number      // Renamed from page_size
  total: number
  hasNext: boolean   // Camelized from has_next
  hasPrev: boolean   // Camelized from has_prev
}
```

## Problem Solved

### Original Issue: Double-Wrapping
The original implementation incorrectly assumed paginated responses were wrapped in `ApiResponse`:

```typescript
// OLD (incorrect type definition)
interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// OLD (incorrect usage with type casting)
return this.get<Spell[]>(`/spells?${params}`) as Promise<PaginatedResponse<Spell>>
```

**Problems:**
1. Type mismatch: backend returns flat structure, frontend expected wrapped structure
2. Type casting silenced TypeScript errors
3. Stores had inconsistent unwrapping: `response.data` vs `response.items`
4. Pagination metadata was in wrong location

### Solution: Dedicated Paginated Methods
New implementation uses specialized methods that understand the backend schema:

```typescript
// NEW (correct type definition)
interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
  has_next: boolean
  has_prev: boolean
}

// NEW (correct usage without casting)
return this.getPaginated<Spell>(`/spells?${params}`)
```

**Benefits:**
1. Type safety: TypeScript validates response structure
2. No type casting needed
3. Consistent unwrapping: always `response.items`
4. Clear separation: `get()` vs `getPaginated()`, `post()` vs `postPaginated()`

## Affected Endpoints

All paginated endpoints were migrated to use the new pattern:

### Items
- `GET /items/search` - `getPaginated<Item>()`
- `GET /items` - `getPaginated<Item>()`
- `POST /items/filter` - `postPaginated<Item>()`

### Spells
- `GET /spells` - `getPaginated<Spell>()`

### Symbiants
- `GET /symbiants` - `getPaginated<SymbiantItem>()`

### Mobs/Pocket Bosses
- `GET /mobs` - `getPaginated<Mob>()`

### Stat Values
- `GET /stat-values` - `getPaginated<any>()`

## Implementation Files

### Core Types
- **`frontend/src/types/api.ts`**
  - `PaginatedResponse<T>` interface (flat structure)
  - `ApiResponse<T>` interface (used for non-paginated endpoints)

### API Client
- **`frontend/src/services/api-client.ts`**
  - `getPaginated<T>()` - GET requests returning paginated data
  - `postPaginated<T>()` - POST requests returning paginated data
  - Updated endpoint methods: `searchItems()`, `searchSpells()`, `searchSymbiants()`, `searchPocketBosses()`, `filterItems()`

### Stores (Pinia)
- **`frontend/src/stores/items.ts`** - Item search and filtering
- **`frontend/src/stores/spells.ts`** - Spell search
- **`frontend/src/stores/symbiants.ts`** - Symbiant browsing
- **`frontend/src/stores/pocket-bosses.ts`** - Pocket boss search
- **`frontend/src/stores/pocketBossStore.ts`** - Alternative boss store

## Migration Guide

### For New Paginated Endpoints

When adding a new paginated endpoint:

1. **Use the correct method:**
   ```typescript
   // For GET requests
   return this.getPaginated<YourType>(`/your-endpoint?${params}`)

   // For POST requests
   return this.postPaginated<YourType>(`/your-endpoint`, requestBody)
   ```

2. **Access items directly:**
   ```typescript
   const response = await apiClient.yourPaginatedMethod(query)
   if (response.items) {
     // Process response.items array
     // Access pagination: response.page, response.total, response.has_next, etc.
   }
   ```

3. **Transform to store format (if needed):**
   ```typescript
   searchResults.value = {
     results: response.items,
     pagination: {
       page: response.page,
       limit: response.page_size,
       total: response.total,
       hasNext: response.has_next,
       hasPrev: response.has_prev
     }
   }
   ```

### For Non-Paginated Endpoints

Non-paginated endpoints continue using `get<T>()` and `post<T>()`:

```typescript
// Single item response
const response = await this.get<Item>(`/items/${id}`)
if (response.success && response.data) {
  return response.data  // Type: Item
}

// Array response (not paginated)
const response = await this.get<Item[]>(`/items/featured`)
if (response.success && response.data) {
  return response.data  // Type: Item[]
}
```

## Testing Considerations

When testing paginated responses:

1. **Mock the flat structure:**
   ```typescript
   const mockResponse: PaginatedResponse<Item> = {
     items: [item1, item2],
     total: 2,
     page: 1,
     page_size: 50,
     pages: 1,
     has_next: false,
     has_prev: false
   }
   ```

2. **Verify field names:**
   - Use snake_case: `page_size`, `has_next`, `has_prev`
   - Items are in `items` field, not `data`

3. **Test boundary conditions:**
   - Empty results: `items: [], total: 0`
   - Single page: `has_next: false, has_prev: false`
   - Multi-page: Verify `has_next` and `has_prev` logic

## Performance Impact

The refactor has no performance impact, but improves reliability:

- **Before**: Type casting masked runtime errors
- **After**: TypeScript catches schema mismatches at compile time
- **Bundle size**: No change (same number of methods)
- **Runtime overhead**: Minimal (one less property access)

## Related Documentation

- API Response Types: `frontend/src/types/api.ts`
- API Client Implementation: `frontend/src/services/api-client.ts`
- Backend Pagination Schema: `backend/app/api/schemas/common.py` (if exists)
- Store Patterns: `.docs/internal-docs/requirement-checking-patterns.docs.md`

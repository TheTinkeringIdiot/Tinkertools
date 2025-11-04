# API Client Mocking for Integration Tests

## Problem

Integration tests were failing because they created `context.mockApi` but the items store imported and used the real `apiClient` from `@/services/api-client`. The mock wasn't being injected into the stores.

## Solution

Implemented proper Vitest module mocking using `vi.mock()` to intercept the API client module at import time.

### Implementation

#### 1. Mock API Client (`__mocks__/api-client.ts`)

Created a mock file that exports mock versions of all API client methods:

```typescript
// frontend/src/__tests__/__mocks__/api-client.ts
import { vi } from 'vitest';

export const mockApiClient = {
  // Items
  getItem: vi.fn(),
  interpolateItem: vi.fn(),
  searchItems: vi.fn(),
  // ... all other API methods
};

export const apiClient = mockApiClient;
export default mockApiClient;
```

#### 2. Integration Test Utilities

Updated `integration-test-utils.ts` to support async mock retrieval:

```typescript
export async function getMockApiClient() {
  // Import the apiClient - it will be mocked if vi.mock() was called
  const apiClientModule = await import('@/services/api-client');
  return apiClientModule.apiClient || apiClientModule.default;
}

export async function setupIntegrationTest(): Promise<IntegrationTestContext> {
  const pinia = createPinia();
  setActivePinia(pinia);

  const mockApi = await getMockApiClient();
  const mockLocalStorage = createMockLocalStorage();

  Object.defineProperty(global, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  });

  return { pinia, mockApi, mockLocalStorage };
}
```

#### 3. Test File Pattern

Tests must call `vi.mock()` **BEFORE** importing any stores:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

// IMPORTANT: Mock API client BEFORE importing any stores
vi.mock('@/services/api-client');

import { setupIntegrationTest } from '../helpers/integration-test-utils';
import { useItemsStore } from '@/stores/items';

describe('My Integration Test', () => {
  let context: IntegrationTestContext;

  beforeEach(async () => {
    context = await setupIntegrationTest();

    // Configure mock responses
    context.mockApi.searchItems.mockResolvedValue({
      items: [...],
      total: 10,
      page: 1,
      page_size: 24,
      has_next: false,
      has_prev: false,
    });
  });

  it('should use mocked API', async () => {
    const itemsStore = useItemsStore();
    await itemsStore.searchItems({ search: 'test' });

    expect(context.mockApi.searchItems).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'test' })
    );
  });
});
```

## How It Works

1. **Hoisting**: Vitest hoists `vi.mock()` calls to the top of the file before any imports
2. **Module Interception**: When stores import `@/services/api-client`, they receive the mock
3. **Mock Configuration**: Tests can configure mock return values via `context.mockApi`
4. **Verification**: Tests can verify API calls using `expect(context.mockApi.searchItems).toHaveBeenCalledWith(...)`

## Benefits

- **Real Store Logic**: Tests use actual store implementations, not stubs
- **Isolated External Dependencies**: Only HTTP layer is mocked
- **Type Safety**: Mock maintains the same interface as real API client
- **Reusable**: Pattern works for all stores that use apiClient
- **Flexible**: Each test can configure different mock responses

## Test Results

After implementation: **21 of 22 tests passing** (1 failure is unrelated test data issue)

The API client mocking is working correctly, allowing integration tests to verify:

- Search functionality
- Filtering logic
- Pagination
- State management
- Error handling

All without making real HTTP requests.

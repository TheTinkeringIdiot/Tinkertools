# Test Mocks

This directory contains reusable mock implementations for common dependencies.

## Available Mocks

### `axios.ts`
Complete mock of axios with interceptors and all HTTP methods.

**Usage:**
```typescript
import { vi } from 'vitest';

// Option 1: Use the complete mock
vi.mock('axios', async () => {
  return await import('./__mocks__/axios');
});

// Option 2: Use specific parts
import { createMockAxiosInstance } from '../__mocks__/axios';

const mockAxios = createMockAxiosInstance();
mockAxios.get.mockResolvedValue({ data: { ... }, status: 200 });
```

### `vue-router.ts`
Complete mock of vue-router with all exports (createRouter, useRoute, useRouter, etc.)

**Usage:**
```typescript
import { vi } from 'vitest';

// Use in tests
vi.mock('vue-router', async () => {
  return await import('./__mocks__/vue-router');
});

// Access mock instances for assertions
import { mockRouterInstance, mockRouteInstance } from '../__mocks__/vue-router';

expect(mockRouterInstance.push).toHaveBeenCalledWith('/some-path');
```

### `api-client.ts`
Mock of the TinkerTools API client with proper response structures.

**Usage:**
```typescript
import { vi } from 'vitest';

// Use in tests
vi.mock('@/services/api-client', async () => {
  return await import('../__mocks__/api-client');
});

// Configure responses
import { mockApiClient } from '../__mocks__/api-client';

mockApiClient.getItem.mockResolvedValue({
  success: true,
  data: { id: 1, name: 'Test Item', ... },
  meta: { ... }
});
```

## Best Practices

### 1. Mock at Test File Top
Place mock calls **before** any imports that use those modules:

```typescript
import { vi } from 'vitest';

// ❌ BAD - imports before mocks
import { useInterpolation } from '../useInterpolation';
vi.mock('@/services/api-client');

// ✅ GOOD - mocks before imports
vi.mock('@/services/api-client');
import { useInterpolation } from '../useInterpolation';
```

### 2. Reset Mocks in beforeEach
Always clear mock history between tests:

```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

### 3. Configure Mock Responses
Set up specific responses for each test:

```typescript
it('should handle API error', async () => {
  mockApiClient.getItem.mockRejectedValue(new Error('Network error'));
  // ... test code
});
```

### 4. Assert on Mock Calls
Verify mocks were called correctly:

```typescript
expect(mockApiClient.getItem).toHaveBeenCalledWith(12345);
expect(mockApiClient.getItem).toHaveBeenCalledTimes(1);
```

## Common Issues

### "is not a function" errors
Make sure the mock exports the method you're trying to call. Check the mock file to see what's available.

### Mock not being used
Ensure `vi.mock()` is called **before** any imports that depend on that module.

### Mock calls not clearing
Add `vi.clearAllMocks()` to your `beforeEach()` hook.

### Type errors with mocks
Use type assertions when needed:
```typescript
const mockGet = mockApiClient.getItem as Mock;
mockGet.mockResolvedValue({ ... });
```

## Extending Mocks

To add new methods to existing mocks:

1. Add the method to the mock object
2. Provide a default implementation (usually a mock function)
3. Document usage in this README

Example:
```typescript
// In api-client.ts
export const mockApiClient = {
  // ... existing methods
  newMethod: vi.fn(() => createSuccessResponse(null)),
};
```

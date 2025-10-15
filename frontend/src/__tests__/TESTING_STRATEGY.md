# Testing Strategy Documentation

## Overview

This document explains the testing strategy for the TinkerTools frontend, specifically how integration tests are categorized and handled to prevent timeout issues when the backend is unavailable.

## Problem

Previously, ~150 tests were timing out because they attempted to make real backend API calls when the backend wasn't running. This caused:
- Long test suite execution times (multiple minutes of timeouts)
- CI/CD pipeline failures
- Developer frustration during local development

## Solution

Tests are now categorized into two types with different strategies:

### 1. TRUE INTEGRATION TESTS (Option B: Skip when backend unavailable)

These tests **require a real backend** and should only run when the backend is available.

**Strategy**: Use `describe.skipIf(!BACKEND_AVAILABLE)` to skip entire test suites when backend is unavailable.

**Implementation**:
```typescript
import { isBackendAvailable } from '../helpers/backend-check'

let BACKEND_AVAILABLE = false

beforeAll(async () => {
  BACKEND_AVAILABLE = await isBackendAvailable()
  if (!BACKEND_AVAILABLE) {
    console.warn('Backend not available - skipping integration tests')
  }
})

describe.skipIf(!BACKEND_AVAILABLE)('My Integration Tests', () => {
  // Tests that require real backend...
})
```

**Files in this category**:
1. `TinkerItems.integration.test.ts` - Tests real backend API integration
2. `interpolation-ranges.test.ts` - Tests real interpolation endpoints
3. `backend-integration.test.ts` - Explicitly tests backend integration
4. `pocketBossStore.integration.test.ts` - Tests real pocket boss API
5. `symbiantsStore.integration.test.ts` - Tests real symbiant API
6. `pagination-integration.test.ts` - Tests real pagination behavior
7. `TinkerPocket.integration.test.ts` - Full view with real APIs
8. `nano-backend.integration.test.ts` - Tests real nano backend

### 2. UNIT TESTS (Mocked, no backend required)

These tests **use mocks** and don't require a real backend.

**Strategy**: Already use proper mocks (global.fetch, vi.mock). No changes needed except clarifying documentation.

**Why these work without backend**:
- Mock all API calls using vitest's `vi.fn()` and `vi.mock()`
- Test component behavior in isolation
- Focus on logic, state management, and UI interactions

**Files in this category**:
1. `nanosStore.integration.test.ts` - Uses mocked fetch (Note: Named "integration" but actually a unit test)
2. `plants-integration.test.ts` - Uses mocked API client (Note: Named "integration" but actually a unit test)
3. `AdvancedItemSearch.integration.test.ts` - Component tests, no real API calls
4. `TinkerNukes.integration.test.ts` - Component tests with mocks

**Note**: Some files are named "integration" for historical reasons but are actually unit tests using mocks.

## Backend Availability Check

### Helper Module: `helpers/backend-check.ts`

Provides utilities for checking if the backend is available:

```typescript
import { isBackendAvailable, getBackendUrl } from '../helpers/backend-check'

// Check if backend is available (cached)
const available = await isBackendAvailable()

// Get configured backend URL
const url = getBackendUrl()
```

**How it works**:
1. Makes a lightweight request to `/api/v1/health` endpoint
2. 2-second timeout to fail fast
3. Caches result to avoid repeated checks
4. Returns `true` if backend responds OK, `false` otherwise

### Configuration

Backend URL is configured via environment variable:

```bash
# In vitest.config.ts
test: {
  env: {
    VITE_BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:8000'
  }
}
```

To run tests with a different backend URL:
```bash
BACKEND_URL=http://my-backend:8000 npm test
```

## Test Execution Behavior

### When backend is NOT available:
- TRUE INTEGRATION tests: **Skipped** with warning message
- UNIT tests: **Run normally** (use mocks)
- Total execution time: < 30 seconds
- No timeouts

### When backend IS available:
- TRUE INTEGRATION tests: **Run normally** against real backend
- UNIT tests: **Run normally** (still use mocks)
- Total execution time: ~2-3 minutes (with real API calls)
- No timeouts (tests wait for real responses)

## Test Timeout Configuration

```typescript
// In vitest.config.ts
test: {
  testTimeout: 10000,  // 10 seconds default
  hookTimeout: 10000   // 10 seconds for hooks
}
```

Individual tests can override:
```typescript
it('should handle large dataset', { timeout: 30000 }, async () => {
  // Long-running test with 30s timeout
})
```

## Best Practices

### Writing New Integration Tests

**For TRUE INTEGRATION tests (require real backend)**:
```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { isBackendAvailable } from '../helpers/backend-check'

let BACKEND_AVAILABLE = false

beforeAll(async () => {
  BACKEND_AVAILABLE = await isBackendAvailable()
  if (!BACKEND_AVAILABLE) {
    console.warn('Backend not available - skipping tests')
  }
})

describe.skipIf(!BACKEND_AVAILABLE)('My Integration Tests', () => {
  it('should fetch real data', async () => {
    const response = await fetch('http://localhost:8000/api/v1/items')
    expect(response.ok).toBe(true)
  })
})
```

**For UNIT tests (use mocks)**:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the API
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: [] })
})

describe('My Component Tests', () => {
  it('should handle data', async () => {
    // Test logic with mocked responses
  })
})
```

### Debugging Test Timeouts

If a test times out:

1. **Check if it's making real API calls**
   - Look for `fetch()`, `apiClient.`, or store methods that call APIs
   - If yes → Should be TRUE INTEGRATION test with skipIf

2. **Verify mocks are in place**
   - Check for `vi.mock()` or `global.fetch = vi.fn()`
   - If missing → Add proper mocks

3. **Check timeout value**
   - Default is 10 seconds
   - Slow operations may need longer: `{ timeout: 30000 }`

4. **Verify backend availability check**
   - Make sure `beforeAll` with `isBackendAvailable()` is present
   - Make sure `describe.skipIf(!BACKEND_AVAILABLE)` wraps tests

## CI/CD Integration

In CI/CD pipelines where backend may not be available:

```yaml
# GitHub Actions example
- name: Run frontend tests
  run: npm test
  env:
    # Backend not available in this pipeline
    BACKEND_URL: ''  # Empty = backend unavailable
```

TRUE INTEGRATION tests will be skipped, UNIT tests will run normally.

For full integration testing in CI:

```yaml
- name: Start backend
  run: docker-compose up -d backend

- name: Run all tests (including integration)
  run: npm test
  env:
    BACKEND_URL: 'http://localhost:8000'
```

## Summary

| Test Type | Backend Required | Strategy | Files |
|-----------|-----------------|----------|-------|
| TRUE INTEGRATION | Yes | Skip when unavailable | 8 files |
| UNIT (mocked) | No | Run with mocks | 4 files |

**Key Benefits**:
- ✅ No test timeouts when backend unavailable
- ✅ Fast local development (< 30s test run)
- ✅ Full integration testing when backend available
- ✅ Clear separation between unit and integration tests
- ✅ CI/CD friendly (can run without backend)

## Integration Test Architecture (September 2025 Refactoring)

### Overview

The frontend test suite was refactored to replace wrong-level store unit tests with true integration tests using **real Pinia stores + mocked backend only**. This approach catches real bugs that mocked store tests miss while maintaining test speed and reliability.

### Test Architecture Layers

```
┌─────────────────────────────────────────┐
│  Component (Vue)                        │
│  ↕                                      │
│  Real Pinia Stores                      │
│  ↕                                      │
│  Mocked API Client + localStorage       │
└─────────────────────────────────────────┘
```

**Key Principles**:
- ✅ Use **real** Pinia stores (actual state management logic)
- ✅ Use **real** Vue components (actual rendering + reactivity)
- ✅ Mock **only** external boundaries (API, localStorage, router)
- ❌ Never mock store internals or Vue reactivity

### Integration Test Infrastructure

#### Core Utilities (`integration-test-utils.ts`)

```typescript
// Setup function: Real Pinia + mocked externals
const context = await setupIntegrationTest();
// Returns: { pinia, mockLocalStorage, mockRouter, apiClient }

// Component mounting with full context
const wrapper = mountForIntegration(MyComponent, {
  pinia: context.pinia,
  props: { profileId: 'test-id' }
});

// Wait for async Vue updates
await waitForUpdates(wrapper);

// Wait for equipment stat recalculation
await waitForStatRecalculation();
```

**Features**:
- Real Pinia with proper PrimeVue + ToastService setup
- Mocked localStorage (in-memory store)
- Mocked API client via `vi.mock('@/services/api-client')`
- Test router with navigation support
- Stubbed PrimeVue components (Dialog, DataTable, etc.)

#### Test Fixtures

**Profile Fixtures** (`profile-fixtures.ts`):
```typescript
// Factory with sensible defaults
const profile = createTestProfile({
  name: 'Test Character',
  level: 100,
  profession: PROFESSION.SOLDIER,
  breed: BREED.SOLITUS,
  skills: {
    [SKILL_ID.ASSAULT_RIF]: { pointsFromIp: 250, equipmentBonus: 50 }
  }
});

// Pre-configured profiles
const freshProfile = createTestProfile(FRESH_PROFILE_L1);
const endgameProfile = createTestProfile(ENDGAME_PROFILE_L220);
```

**Item Fixtures** (`item-fixtures.ts`):
```typescript
const item = createTestItem({ name: 'Combat Armor', ql: 100 });
const weapon = createWeaponItem({ damageType: 'Energy', damage: 50 });
const armor = createArmorItem({ ac: 500, slot: 'Chest' });
const implant = createImplantItem({ slot: 'Head' });
```

**Nano Fixtures** (`nano-fixtures.ts`):
```typescript
const nano = createTestNano({
  name: 'Heal',
  ncu: 10,
  strain: 'NanoStrain1'
});
```

### Standard Integration Test Pattern

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { setupIntegrationTest, mountForIntegration, waitForUpdates } from '../helpers/integration-test-utils';
import { createTestProfile } from '../helpers/profile-fixtures';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';

// CRITICAL: Mock API client BEFORE store imports
vi.mock('@/services/api-client');

describe('Feature Integration Tests', () => {
  let context: any;
  let store: any;

  beforeEach(async () => {
    // Setup PrimeVue + ToastService (required for store toasts)
    const app = createApp({});
    app.use(PrimeVue);
    app.use(ToastService);

    // Setup test context
    context = await setupIntegrationTest();
    app.use(context.pinia);

    // Initialize store
    store = useTinkerProfilesStore();
  });

  it('should test feature workflow', async () => {
    // Arrange: Create test data
    const profile = createTestProfile({ level: 100 });
    const profileId = await store.createProfile('Test', profile);

    // Act: Perform action
    await store.someAction(profileId);

    // Assert: Verify results
    expect(store.someState).toBe('expected');
  });
});
```

### Component Integration Test Pattern

```typescript
import { mountForIntegration, waitForUpdates } from '../helpers/integration-test-utils';
import MyComponent from '@/components/MyComponent.vue';

it('should render component with store integration', async () => {
  // Arrange: Setup store state
  const profile = createTestProfile({ level: 100 });
  await store.createProfile('Test', profile);

  // Act: Mount component
  const wrapper = mountForIntegration(MyComponent, {
    pinia: context.pinia,
    props: { profileId: profile.id }
  });

  await waitForUpdates(wrapper);

  // Assert: Check rendered output
  expect(wrapper.text()).toContain('Level 100');
});
```

### Critical Setup Requirements

#### 1. PrimeVue + ToastService

**Why Required**: Stores use `useToast()` for user notifications. Without PrimeVue setup, tests fail with "No PrimeVue Toast provided!".

```typescript
beforeEach(async () => {
  // CRITICAL: Setup BEFORE creating Pinia
  const app = createApp({});
  app.use(PrimeVue);
  app.use(ToastService);

  const pinia = createPinia();
  app.use(pinia); // Attach Pinia to app
  setActivePinia(pinia);

  store = useTinkerProfilesStore();
});
```

#### 2. Mock API Client Placement

**Why Critical**: Mock must be declared BEFORE any store imports, or stores will bind to real API client.

```typescript
// CORRECT: Mock FIRST
vi.mock('@/services/api-client');
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';

// WRONG: Import first, mock second
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
vi.mock('@/services/api-client'); // Too late!
```

#### 3. localStorage Key Format

**Current Format**: Individual profile keys (not legacy combined format)

```typescript
// CORRECT: Individual profile keys
const profileKey = `tinkertools_profile_${profileId}`;
const storedData = context.mockLocalStorage.getItem(profileKey);

// WRONG: Legacy combined format
const storedData = context.mockLocalStorage.getItem('tinkertools_profiles');
const profile = JSON.parse(storedData)[profileId]; // Not used anymore
```

### Test Fixture Best Practices

#### Profile Creation

```typescript
// Basic profile with defaults
const profile = createTestProfile({
  name: 'Test Character',
  level: 100
});

// Profile with custom abilities
const profile = createTestProfile({
  level: 150,
  abilities: {
    [ABILITY_ID.STRENGTH]: 800,
    [ABILITY_ID.STAMINA]: 700
  }
});

// Profile with custom skills
const profile = createTestProfile({
  level: 200,
  skills: {
    [SKILL_ID.ASSAULT_RIF]: { pointsFromIp: 500, equipmentBonus: 100 }
  }
});
```

**Auto-Initialization**:
- Abilities: `level * 4` IP improvements per ability
- MaxNCU: `Math.max(1200, level * 6)`
- Skills: Proper structure with `pointsFromIp`, `equipmentBonus`, etc.

#### Item Creation with Stats

```typescript
const item = createTestItem({
  name: 'Combat Armor',
  ql: 100,
  stats: [
    createStatValue({ stat: STAT_ID.STRENGTH, value: 50 }),
    createStatValue({ stat: STAT_ID.STAMINA, value: 30 })
  ],
  spell_data: [
    {
      id: 1,
      event: 14, // Wear event
      spells: [
        { id: 100, name: 'Strength Buff', stats: [{ stat: 16, value: 50 }] }
      ]
    }
  ]
});
```

**Important Spell Event IDs**:
- Event 14: Wear (on equip)
- Event 2: Wield (for weapons)
- Event 0: Use

### Common Integration Test Scenarios

#### Equipment Management

```typescript
it('should apply equipment bonuses to profile stats', async () => {
  // Arrange
  const profile = createTestProfile({ level: 100 });
  const profileId = await store.createProfile('Test', profile);

  const armor = createArmorItem({
    slot: 'Chest',
    stats: [createStatValue({ stat: STAT_ID.STRENGTH, value: 50 })]
  });

  // Mock API response
  const { apiClient } = await import('@/services/api-client');
  vi.mocked(apiClient).getItem.mockResolvedValue({
    success: true,
    item: armor
  });

  // Act
  await store.equipItem(profileId, armor.aoid, 'Chest');
  await waitForStatRecalculation();

  // Assert
  const updatedProfile = store.activeProfile;
  expect(updatedProfile.skills[SKILL_ID.STRENGTH].equipmentBonus).toBe(50);
});
```

#### Buff Management

```typescript
it('should track NCU usage when casting nanos', async () => {
  // Arrange
  const profile = createTestProfile({
    level: 100,
    skills: {
      [SKILL_ID.MAX_NCU]: { total: 1500 }
    }
  });
  const profileId = await store.createProfile('Test', profile);

  const nano = createTestNano({ name: 'Heal', ncu: 50 });

  // Act
  await store.castNano(profileId, nano);

  // Assert
  expect(store.activeProfile.currentNCU).toBe(1450); // 1500 - 50
  expect(store.activeProfile.activeNanos).toContain(nano);
});
```

#### Profile CRUD Operations

```typescript
it('should persist profile to localStorage on creation', async () => {
  // Arrange
  const profile = createTestProfile({ name: 'Test Character', level: 100 });

  // Act
  const profileId = await store.createProfile('Test Character', profile);

  // Assert
  const profileKey = `tinkertools_profile_${profileId}`;
  const storedData = context.mockLocalStorage.getItem(profileKey);
  expect(storedData).toBeTruthy();

  const storedProfile = JSON.parse(storedData);
  expect(storedProfile.Character.Level).toBe(100);
});
```

### Debugging Integration Tests

#### Test Failures

**"No PrimeVue Toast provided!"**
- **Cause**: Missing PrimeVue + ToastService setup
- **Fix**: Add PrimeVue setup in `beforeEach` before creating Pinia

**"expected null to be truthy" (localStorage)**
- **Cause**: Using wrong localStorage key format
- **Fix**: Use `tinkertools_profile_${profileId}` not legacy format

**"expected 0 to be greater than 0" (equipment bonuses)**
- **Cause**: Wrong spell event ID or stat not being applied
- **Fix**: Verify event 14 for Wear, event 2 for Wield

**MaxNCU calculation issues**
- **Cause**: MaxNCU has special base + bonus calculation
- **Fix**: See `ip-integrator.ts` lines 492-511 for proper handling

#### Async Timing Issues

```typescript
// Wait for Vue updates
await waitForUpdates(wrapper);

// Wait for equipment recalculation
await waitForStatRecalculation();

// Longer wait for complex operations
await new Promise(resolve => setTimeout(resolve, 100));
```

### Test Suite Results (September 2025)

| Suite | Tests | Pass Rate | Status |
|-------|-------|-----------|--------|
| Buff Management | 19 | 19/19 (100%) | ✅ Complete |
| Item Search | 22 | 22/22 (100%) | ✅ Complete |
| Equipment Interaction | 23 | 23/23 (100%) | ✅ Complete |
| Nano Compatibility | 21 | 16/21 (76%) | ⚠️ Test design issues |
| Profile Management | 22 | 11/22 (50%) | ⚠️ Component selectors |

**Overall: 91/107 (85%)**

### Infrastructure Fixes Applied

1. **MaxNCU Calculation** - Fixed to properly handle base (1200 + level*6) + bonuses
2. **Equipment Bonus Calculator** - Extract bonuses from both `item.stats` and `spell_data`
3. **Skill Auto-Creation** - Auto-create trainable skills in `modifySkill()` if missing
4. **PrimeVue Toast Setup** - Required in all integration test files
5. **localStorage Key Format** - Migrated from legacy combined to individual profile keys

### Best Practices Summary

#### Do's ✅
- Use real Pinia stores with actual state management logic
- Mock only external boundaries (API, localStorage, router)
- Setup PrimeVue + ToastService before creating Pinia
- Use test fixtures for consistent, realistic data
- Wait for async updates with helper functions
- Use individual profile localStorage keys

#### Don'ts ❌
- Don't mock store internals or Vue reactivity
- Don't skip PrimeVue setup (causes toast errors)
- Don't use legacy localStorage key formats
- Don't import stores before mocking API client
- Don't use invalid game formula values in test data
- Don't forget to wait for async operations

### Related Documentation

- **Test Infrastructure**: `src/__tests__/helpers/integration-test-utils.ts`
- **Test Fixtures**: `src/__tests__/helpers/profile-fixtures.ts`, `item-fixtures.ts`, `nano-fixtures.ts`
- **Refactoring Results**: `/frontend/TEST_REFACTORING_RESULTS.md`
- **Integration Test Examples**:
  - `src/__tests__/integration/buff-management.integration.test.ts`
  - `src/__tests__/integration/equipment-interaction.integration.test.ts`
  - `src/__tests__/integration/item-search.integration.test.ts`

## Questions?

See the test files themselves for implementation examples. Each test file now has a header comment explaining its category and strategy.

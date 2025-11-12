# Testing Strategy Documentation

## Overview

This document explains the testing strategy for the TinkerTools frontend, which has been refactored (November 2025) to use an E2E-first approach with real Pinia stores and minimal component mocking.

## Philosophy

**Test the behavior users care about, not implementation details.**

We follow a pragmatic test pyramid:
- **55% Unit Tests** - Pure functions, calculators, business logic
- **40% Integration Tests** - Real Pinia stores with mocked API
- **5% E2E Tests** - Real browser testing critical user workflows

## What We Don't Test

**Component Tests** - We aggressively deleted 31 component test files because:
- Fragile selectors break on every UI change
- Mocked stores don't catch real bugs
- Provide false confidence (passing tests, broken production)
- Better covered by E2E tests

**Store Unit Tests** - We deleted 6 store test files that mocked Pinia internals because:
- Mocking stores defeats the purpose (not testing real state management)
- Better covered by integration tests with REAL stores

**View Tests** - We deleted 8 view test files because:
- Just large component tests with same fragility issues
- Better covered by E2E workflow tests

## Test Categories

Tests are categorized into three types with different strategies:

### 1. Unit/Service Tests (~23 files - Core Value)

These tests **use no mocks** and test pure business logic.

**What to test**:
- Calculation services (IP cost, bonus calculation, weapon DPS)
- Utility functions (game formulas, stat lookups, data parsing)
- Pure transformers (data mapping, filtering, sorting)
- Action criteria evaluation
- Interpolation services

**Why valuable**:
- Fast execution (< 50ms per test)
- No dependencies on external systems
- Stable APIs (business logic rarely changes)
- High confidence (pure functions = predictable)

**Examples**:
- `action-criteria.test.ts` - 39 tests for requirement checking
- `perk-bonus-calculator.test.ts` - 36 tests for perk bonuses
- `nano-bonus-calculator.test.ts` - 39 tests for nano bonuses
- `nuke-calculations.test.ts` - 83 tests for weapon DPS
- `ip-calculator.test.ts` - IP cost formulas
- `ip-integrator.test.ts` - Profile stat integration

**Pattern**:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateIPCost } from '@/services/ip-calculator';

describe('IP Calculator', () => {
  it('should calculate cost for skill level 1-20', () => {
    expect(calculateIPCost(1, 10)).toBe(50);
    expect(calculateIPCost(1, 20)).toBe(190);
  });
});
```

**Pass Rate**: ~95% (stable and reliable)

### 2. Integration Tests (~13 files - Real Store Testing)

These tests use **real Pinia stores** with **mocked API client only**.

**What to test**:
- Profile CRUD operations (create, edit, delete, switch)
- Equipment management (equip, unequip, stat effects)
- Nano management (cast, remove, NCU tracking, strain conflicts)
- Item search (filters, pagination, sorting)
- Skill/ability modification with IP recalculation
- Cross-tool workflows (equipment → stats → requirements)

**Why valuable**:
- Tests real state management logic (reactivity, actions, getters)
- Tests real component integration (mounting, props, events)
- Catches bugs mocked tests miss (equipment persistence, stat recalculation)
- Fast enough for TDD (< 500ms per test)

**Examples**:
- `buff-management.integration.test.ts` - NCU tracking, nano strain conflicts
- `equipment-interaction.integration.test.ts` - Equip/unequip with stat effects
- `item-search-interaction.integration.test.ts` - Search filters, pagination
- `nano-compatibility.integration.test.ts` - Nano requirement checking
- `profile-management.integration.test.ts` - CRUD operations, profile switching
- `ip-calculation-workflow.test.ts` - IP spending and recalculation

**Pattern**:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { setupIntegrationTest } from '../helpers/integration-test-utils';
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

    context = await setupIntegrationTest();
    app.use(context.pinia);

    store = useTinkerProfilesStore();
  });

  it('should test feature workflow', async () => {
    const profile = createTestProfile({ level: 100 });
    const profileId = await store.createProfile('Test', profile);
    await store.someAction(profileId);
    expect(store.someState).toBe('expected');
  });
});
```

**Pass Rate**: ~80% (some test design issues remain)

### 3. E2E Tests (~8 files - Critical User Workflows)

These tests use **Playwright** to test complete workflows in a **real browser**.

**What to test**:
- Critical user workflows (happy paths)
- Cross-tool workflows (item → profile → nano)
- Complex UI interactions (drag-drop, modals, multi-step forms)
- Visual validation (layout, responsive, accessibility)
- Backend integration (optional - can mock)

**Why valuable**:
- Tests real user experience (browser, rendering, interactions)
- Tests real integrations (frontend + backend)
- Catches bugs integration tests miss (CSS, animations, responsive)
- Validates accessibility (screen readers, keyboard nav)

**Examples**:
- `item-search-workflow.test.ts` - Search, filter, select, view details
- `profile-management-workflow.test.ts` - Create, edit, delete, switch profiles
- `nano-compatibility-workflow.test.ts` - Check requirements, filter nanos
- `tinker-plants-workflow.test.ts` - Implant planning workflow

**Pattern**:
```typescript
import { test, expect } from '@playwright/test';

test('user can search for items', async ({ page }) => {
  await page.goto('/items');

  // Search for item
  await page.fill('[data-testid="search-input"]', 'Assault Rifle');
  await page.click('[data-testid="search-button"]');

  // Verify results
  await expect(page.locator('[data-testid="item-result"]')).toHaveCount(5);
  await expect(page.locator('text=Assault Rifle')).toBeVisible();
});
```

**Pass Rate**: ~60% (backend integration needed for some)

### 4. Backend Integration Tests (~3 files - Real API Testing)

These tests **require a real backend** and should only run when the backend is available.

**Strategy**: Use `describe.skipIf(!BACKEND_AVAILABLE)` to skip entire test suites when backend is unavailable.

**Files**:
- `backend-integration.test.ts` - Explicitly tests backend integration
- `pocketBossStore.integration.test.ts` - Tests real pocket boss API
- `symbiantsStore.integration.test.ts` - Tests real symbiant API
- `interpolation-ranges.test.ts` - Tests real interpolation endpoints
- `pagination-integration.test.ts` - Tests real pagination behavior

**Pattern**:
```typescript
import { isBackendAvailable } from '../helpers/backend-check';

let BACKEND_AVAILABLE = false;

beforeAll(async () => {
  BACKEND_AVAILABLE = await isBackendAvailable();
  if (!BACKEND_AVAILABLE) {
    console.warn('Backend not available - skipping integration tests');
  }
});

describe.skipIf(!BACKEND_AVAILABLE)('My Backend Tests', () => {
  it('should fetch real data', async () => {
    const response = await fetch('http://localhost:8000/api/v1/items');
    expect(response.ok).toBe(true);
  });
});
```

## Backend Availability Check

### Helper Module: `helpers/backend-check.ts`

Provides utilities for checking if the backend is available:

```typescript
import { isBackendAvailable, getBackendUrl } from '../helpers/backend-check';

// Check if backend is available (cached)
const available = await isBackendAvailable();

// Get configured backend URL
const url = getBackendUrl();
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

## Test Execution

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run specific test file
npm test -- path/to/test.test.ts

# Run E2E tests (requires Playwright setup)
npx playwright test

# Run E2E tests with UI
npx playwright test --ui
```

### Execution Behavior

**When backend is NOT available**:
- Backend integration tests: **Skipped** with warning message
- Unit tests: **Run normally** (no external dependencies)
- Integration tests: **Run normally** (use mocked API)
- E2E tests: **May fail** (depend on backend availability)
- Total execution time: < 30 seconds

**When backend IS available**:
- Backend integration tests: **Run normally** against real backend
- Unit tests: **Run normally** (no change)
- Integration tests: **Run normally** (still use mocked API)
- E2E tests: **Run normally** (test against real backend)
- Total execution time: ~2-3 minutes (with E2E tests)

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
});
```

## E2E Testing with Playwright

### Page Object Pattern

Use page objects to encapsulate page interactions and reduce test fragility:

```typescript
// pages/item-search.page.ts
export class ItemSearchPage {
  constructor(public page: Page) {}

  async goto() {
    await this.page.goto('/items');
  }

  async search(query: string) {
    await this.page.fill('[data-testid="search-input"]', query);
    await this.page.click('[data-testid="search-button"]');
  }

  async getResults() {
    return this.page.locator('[data-testid="item-result"]');
  }

  async selectItem(index: number) {
    await this.page.click(`[data-testid="item-result"]:nth-child(${index})`);
  }
}

// item-search.e2e.test.ts
import { test, expect } from '@playwright/test';
import { ItemSearchPage } from './pages/item-search.page';

test('user can search for items', async ({ page }) => {
  const itemSearch = new ItemSearchPage(page);

  await itemSearch.goto();
  await itemSearch.search('Assault Rifle');

  const results = await itemSearch.getResults();
  await expect(results).toHaveCount(5);
});
```

### E2E Best Practices

1. **Use data-testid attributes** - Avoid brittle selectors
   ```html
   <button data-testid="search-button">Search</button>
   ```

2. **Wait for network** - Use Playwright's auto-wait
   ```typescript
   await page.click('[data-testid="search-button"]');
   await page.waitForResponse(resp => resp.url().includes('/api/items'));
   ```

3. **Mock backend when needed** - Fast E2E tests
   ```typescript
   await page.route('**/api/items*', route => {
     route.fulfill({ json: mockItems });
   });
   ```

4. **Test happy paths only** - E2E tests are expensive
   - Don't test every edge case in E2E
   - Cover edge cases in integration/unit tests
   - E2E tests validate critical user workflows

5. **Visual validation** - Use screenshots
   ```typescript
   await expect(page).toHaveScreenshot('item-search.png');
   ```

## Best Practices

### Writing Unit Tests

**Test pure functions only**:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateIPCost } from '@/services/ip-calculator';

describe('IP Calculator', () => {
  it('should calculate cost for skill levels', () => {
    expect(calculateIPCost(1, 10)).toBe(50);
    expect(calculateIPCost(1, 20)).toBe(190);
  });

  it('should handle edge cases', () => {
    expect(calculateIPCost(0, 0)).toBe(0);
    expect(calculateIPCost(1000, 1200)).toBe(200000);
  });
});
```

### Writing Integration Tests

**Use real stores, mock API only**:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { setupIntegrationTest } from '../helpers/integration-test-utils';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';

// CRITICAL: Mock API BEFORE store imports
vi.mock('@/services/api-client');

describe('Profile Management Integration', () => {
  let context: any;
  let store: any;

  beforeEach(async () => {
    const app = createApp({});
    app.use(PrimeVue);
    app.use(ToastService);

    context = await setupIntegrationTest();
    app.use(context.pinia);

    store = useTinkerProfilesStore();
  });

  it('should create profile', async () => {
    const profile = createTestProfile({ level: 100 });
    const profileId = await store.createProfile('Test', profile);

    expect(store.profiles[profileId]).toBeDefined();
    expect(store.profiles[profileId].Character.Level).toBe(100);
  });
});
```

### Writing E2E Tests

**Test user workflows, not implementation**:

```typescript
import { test, expect } from '@playwright/test';

test('user can create and equip profile', async ({ page }) => {
  // Navigate to profiles
  await page.goto('/profiles');

  // Create profile
  await page.click('[data-testid="create-profile-button"]');
  await page.fill('[data-testid="profile-name"]', 'Test Character');
  await page.selectOption('[data-testid="profession"]', 'Soldier');
  await page.click('[data-testid="save-profile"]');

  // Verify creation
  await expect(page.locator('text=Test Character')).toBeVisible();

  // Navigate to items
  await page.click('[data-testid="nav-items"]');

  // Search for item
  await page.fill('[data-testid="search-input"]', 'Combat Armor');
  await page.click('[data-testid="search-button"]');

  // Equip item
  await page.click('[data-testid="item-result"]:first-child');
  await page.click('[data-testid="equip-button"]');

  // Verify equipped
  await expect(page.locator('text=Equipped to Chest')).toBeVisible();
});
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
    BACKEND_URL: '' # Empty = backend unavailable
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

| Test Type             | Files | Tests | Pass Rate | Backend Required | Execution Time |
| --------------------- | ----- | ----- | --------- | ---------------- | -------------- |
| Unit/Service Tests    | ~23   | ~400  | 95%       | No               | < 5s           |
| Integration Tests     | ~13   | ~250  | 80%       | No (mocked API)  | < 10s          |
| E2E Tests             | ~8    | ~80   | 60%       | Optional         | ~2-3 min       |
| Backend API Tests     | ~3    | ~50   | Skipped   | Yes              | ~30s           |
| Component Tests       | ~7    | ~100  | 70%       | No               | < 3s           |
| **Total**             | **55**| **~900** | **~75%** | **Optional**    | **< 30s**     |

**Key Benefits**:

- ✅ No fragile component tests (deleted 31 files)
- ✅ Real store testing catches real bugs (4 production bugs fixed)
- ✅ E2E tests validate actual user workflows
- ✅ Fast feedback loop (< 30s without E2E)
- ✅ CI/CD friendly (backend optional for most tests)
- ✅ Test pyramid correctly balanced (55% unit, 40% integration, 5% E2E)

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
  props: { profileId: 'test-id' },
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
    [SKILL_ID.ASSAULT_RIF]: { pointsFromIp: 250, equipmentBonus: 50 },
  },
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
  strain: 'NanoStrain1',
});
```

### Standard Integration Test Pattern

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import {
  setupIntegrationTest,
  mountForIntegration,
  waitForUpdates,
} from '../helpers/integration-test-utils';
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
    props: { profileId: profile.id },
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
  level: 100,
});

// Profile with custom abilities
const profile = createTestProfile({
  level: 150,
  abilities: {
    [ABILITY_ID.STRENGTH]: 800,
    [ABILITY_ID.STAMINA]: 700,
  },
});

// Profile with custom skills
const profile = createTestProfile({
  level: 200,
  skills: {
    [SKILL_ID.ASSAULT_RIF]: { pointsFromIp: 500, equipmentBonus: 100 },
  },
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
    createStatValue({ stat: STAT_ID.STAMINA, value: 30 }),
  ],
  spell_data: [
    {
      id: 1,
      event: 14, // Wear event
      spells: [{ id: 100, name: 'Strength Buff', stats: [{ stat: 16, value: 50 }] }],
    },
  ],
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
    stats: [createStatValue({ stat: STAT_ID.STRENGTH, value: 50 })],
  });

  // Mock API response
  const { apiClient } = await import('@/services/api-client');
  vi.mocked(apiClient).getItem.mockResolvedValue({
    success: true,
    item: armor,
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
      [SKILL_ID.MAX_NCU]: { total: 1500 },
    },
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
await new Promise((resolve) => setTimeout(resolve, 100));
```

### Current Test Results (November 2025)

| Suite                 | Type        | Tests | Pass Rate    | Status          |
| --------------------- | ----------- | ----- | ------------ | --------------- |
| Service Tests         | Unit        | ~400  | ~380 (95%)   | ✅ Excellent    |
| Integration Tests     | Integration | ~250  | ~200 (80%)   | ✅ Good         |
| E2E Tests             | E2E         | ~80   | ~48 (60%)    | ⚠️ In Progress  |
| Component Tests       | Unit        | ~100  | ~70 (70%)    | ⚠️ Some Issues  |
| Backend API Tests     | Integration | ~50   | Skipped      | ⏸️ Backend Only |

**Overall: ~700/~900 passing (~78%)**

Note: Some failures are expected during active development. Core functionality is well-tested.

### Infrastructure Fixes Applied

1. **MaxNCU Calculation** - Fixed to properly handle base (1200 + level\*6) + bonuses
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

## Related Documentation

- **Test Refactoring Summary**: `/frontend/TEST_REFACTORING_SUMMARY.md` - What was deleted, why, and what was fixed
- **Main Project Docs**: `/CLAUDE.md` - Testing section with overview
- **Test Infrastructure**: `src/__tests__/helpers/integration-test-utils.ts` - Setup utilities
- **Test Fixtures**: `src/__tests__/helpers/` - profile-fixtures, item-fixtures, nano-fixtures
- **Integration Test Examples**:
  - `src/__tests__/integration/buff-management.integration.test.ts`
  - `src/__tests__/integration/equipment-interaction.integration.test.ts`
  - `src/__tests__/integration/item-search-interaction.integration.test.ts`
- **E2E Test Examples**:
  - `src/__tests__/e2e/item-search-workflow.test.ts`
  - `src/__tests__/e2e/profile-management-workflow.test.ts`

## Quick Reference

### When to Write Each Type of Test

**Unit Test** - Pure function, no external dependencies
```typescript
// ✅ Good: Pure calculation
test('calculateIPCost', () => {
  expect(calculateIPCost(1, 10)).toBe(50);
});

// ❌ Bad: Has external dependencies
test('loadProfile', () => {
  const profile = loadProfile('123'); // Uses localStorage
});
```

**Integration Test** - Real stores, mocked API
```typescript
// ✅ Good: Tests real store with mocked API
test('create profile', async () => {
  const store = useTinkerProfilesStore();
  const id = await store.createProfile('Test', profile);
  expect(store.profiles[id]).toBeDefined();
});

// ❌ Bad: Component with brittle selectors
test('profile form', () => {
  const wrapper = mount(ProfileForm);
  wrapper.find('#name-input').setValue('Test'); // Fragile!
});
```

**E2E Test** - Critical user workflow
```typescript
// ✅ Good: Complete user workflow
test('user creates and equips profile', async ({ page }) => {
  await page.goto('/profiles');
  await page.click('[data-testid="create-profile"]');
  // ... complete workflow
});

// ❌ Bad: Testing implementation details
test('profile store state', async ({ page }) => {
  await page.evaluate(() => window.__PINIA_STATE__); // Wrong level!
});
```

## Questions?

- See test files for examples - each has patterns you can copy
- Check TEST_REFACTORING_SUMMARY.md for decisions and rationale
- Review integration-test-utils.ts for available helpers
- Look at existing E2E tests for page object patterns

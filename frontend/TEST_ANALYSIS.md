# Frontend Test Suite Analysis

**Date**: 2025-10-13
**Purpose**: Inform test refactoring strategy - identify wrong-level tests to delete and good tests to keep
**Total Test Files**: 86

## Executive Summary

The frontend test suite contains a mix of **good pure function tests** (lib, utils, services) and **problematic store unit tests** that fight Vue's reactivity and mock internal implementation details. The key finding: **store tests should either be deleted or migrated to integration tests using real TinkerProfilesManager**.

### Key Metrics

- **Pure Function Tests (GOOD)**: ~13 files (utils, lib, services)
- **Store Unit Tests (DELETE/MIGRATE)**: 8 files - heavy mocking, fights reactivity
- **Integration Tests (GOOD)**: 8 files - real database/API testing
- **E2E Tests (GOOD)**: 8 files - real workflow testing
- **Component Tests (MIXED)**: ~49 files - need case-by-case evaluation

### Test Quality Patterns

#### ✅ **EXCELLENT** - Pure Function Tests

- No mocking of framework internals
- Clear inputs → outputs
- Fast, reliable, maintainable
- Examples: `nuke-calculations.test.ts`, `ip-calculator.test.ts`

#### ✅ **GOOD** - Real Integration Tests

- Use real backend/database
- Test actual data flows
- Examples: `nanosStore.integration.test.ts`, `backend-integration.test.ts`

#### ❌ **WRONG LEVEL** - Store Unit Tests

- Mock TinkerProfilesManager (wrong level)
- Use `$patch`, `as any` to bypass readonly
- Test computed properties in isolation
- Fight Vue's reactivity system
- Examples: `profile.test.ts`, `profilesStore.test.ts`, `nanosStore.test.ts`

#### ⚠️ **MIXED** - Component Tests

- Some good (test UI behavior): `SkillSlider.test.ts`, `CharacterInfoPanel.test.ts`
- Some problematic (mock stores heavily)
- Need case-by-case evaluation

---

## 1. Directory Structure

```
frontend/src/__tests__/
├── components/           # 27 component tests (MIXED - evaluate case-by-case)
│   ├── items/           # 3 files
│   ├── plants/          # 4 files
│   ├── pocket/          # 6 files
│   ├── profiles/        # 5 files
│   ├── shared/          # 2 files
│   └── *.test.ts        # 7 files
├── composables/         # 3 composable tests (MIXED)
├── e2e/                 # 8 E2E tests (KEEP - real workflows)
├── integration/         # 8 integration tests (KEEP - real data)
├── lib/                 # 6 library tests (KEEP - pure functions)
│   └── tinkerprofiles/  # 5 files - IP calculation, transformers
├── services/            # 4 service tests (KEEP - pure functions)
├── stores/              # 8 store tests (DELETE/MIGRATE - wrong level)
├── tinkerprofiles/      # 3 tests (MIXED)
├── utils/               # 1 util test (KEEP)
├── views/               # 8 view tests (MIXED)
├── helpers/             # Test helpers (KEEP)
└── pagination-*.test.ts # 2 pagination tests (EVALUATE)

frontend/tests/          # Additional test directory
└── utils/               # 1 file: nuke-calculations.test.ts (KEEP - excellent)
```

---

## 2. Tests by Category

### 2.1 Pure Function Tests (KEEP - 13 files) ✅

These tests are **excellent** and should be kept. They test pure functions with clear inputs/outputs, no mocking of framework internals.

**Calculation/Utility Tests:**

- `/tests/utils/nuke-calculations.test.ts` - **922 lines** - Comprehensive damage, casting, regen, efficiency calculations
- `/__tests__/lib/tinkerprofiles/ip-calculator.test.ts` - IP system, ability caps, title level enforcement
- `/__tests__/lib/tinkerprofiles/cluster-mappings.test.ts` - Implant cluster mappings
- `/__tests__/lib/tinkerprofiles/aosetups-implant-import.test.ts` - Import logic
- `/__tests__/lib/tinkerprofiles/aosetups-perk-import.test.ts` - Perk import
- `/__tests__/lib/tinkerprofiles/transformer.test.ts` - Profile transformations
- `/__tests__/lib/tinkerprofiles/ip-integrator.test.ts` - IP integration

**Service Tests:**

- `/__tests__/services/api-client.test.ts` - API client logic
- `/__tests__/services/cache-manager.test.ts` - Cache management
- `/__tests__/services/game-utils.test.ts` - Game utility functions
- `/__tests__/services/spell-data-utils.test.ts` - Spell data utilities
- `/__tests__/services/profile-equipment-health.test.ts` - Equipment health checks

**Utility Tests:**

- `/__tests__/utils/symbiantHelpers.test.ts` - Symbiant helper functions

**Helper Tests:**

- `/__tests__/helpers/helpers.test.ts` - Test helper utilities

---

### 2.2 Store Unit Tests (DELETE/MIGRATE - 8 files) ❌

These tests are **wrong-level** and should be **deleted** or **migrated to integration tests**. They mock TinkerProfilesManager and fight Vue's reactivity.

#### Problems with Store Unit Tests:

1. **Mock TinkerProfilesManager** - Wrong abstraction level

   - Store should be tested WITH real manager, not mocking it
   - Mocks create false confidence - tests pass but integration fails

2. **Fight Vue Reactivity** - Use `$patch`, `as any` to bypass readonly

   - `store.$patch({ pocketBosses: mockBosses })` - Violates encapsulation
   - `(store as any).activeProfile = mockProfile` - Bypasses readonly
   - Tests become brittle when store implementation changes

3. **Test Computed Properties in Isolation** - Wrong level

   - Should test through user actions, not direct state manipulation
   - Example: Testing `filteredPocketBosses` by patching state instead of calling `updateFilters()`

4. **Heavy Setup Required** - Complex mocks for each test
   - Event listeners, mock implementations
   - Shows tests are at wrong abstraction level

#### Files to DELETE:

1. **`/__tests__/stores/profile.test.ts`** (565 lines)

   - **Why Delete**: Basic CRUD operations, localStorage mocking, no unique logic
   - Mocks localStorage extensively
   - Tests basic state management covered by integration tests
   - No complex business logic that needs unit testing

2. **`/__tests__/stores/profilesStore.test.ts`** (567 lines)

   - **Why Delete**: Duplicate of profile.test.ts functionality
   - Tests same create/update/delete operations
   - Uses mocked localStorage
   - Same coverage as `profile.test.ts` but less clear

3. **`/__tests__/stores/nanosStore.test.ts`** (391 lines)

   - **Why Delete**: Mocks fetch, tests basic filtering
   - All functionality tested in `nanosStore.integration.test.ts` with real data
   - No complex business logic
   - Integration test is more valuable

4. **`/__tests__/stores/items.test.ts`** (439 lines)

   - **Why Delete**: Mocks apiClient, tests basic CRUD
   - Cache management tested at service level
   - Filtering logic simple, covered by integration tests
   - No unique business logic

5. **`/__tests__/stores/pocketBossStore.test.ts`** (275 lines)
   - **Why Delete**: Uses `$patch` to set state, tests computed properties
   - Simple filtering logic
   - `pocketBossStore.integration.test.ts` provides better coverage

#### Files to MIGRATE (consider keeping IF refactored):

6. **`/stores/__tests__/tinkerProfiles.buff.test.ts`** (617 lines)

   - **Current State**: Mocks TinkerProfilesManager, mocks IP integrator
   - **Why Keep Logic**: NCU tracking, NanoStrain conflicts, stacking order - **complex game rules**
   - **Migration Strategy**: Rewrite as integration test using **real TinkerProfilesManager**
   - **Key Business Logic**:
     - NCU capacity validation (max 1200 from skill 181)
     - NanoStrain conflict resolution (same strain = conflict)
     - Stacking order priority (higher order wins)
     - 4-tier buff replacement logic
   - **Action**: **Migrate to integration test** - This is valuable domain logic

7. **`/__tests__/stores/symbiantsStore.integration.test.ts`**

   - **Current State**: Name says "integration" but likely uses mocks
   - **Action**: Verify if truly integration test, otherwise migrate

8. **`/__tests__/stores/plants-integration.test.ts`**
   - **Current State**: Name says "integration" but likely uses mocks
   - **Action**: Verify if truly integration test, otherwise migrate

---

### 2.3 Integration Tests (KEEP - 8 files) ✅

These tests use **real backend/database** and provide valuable coverage. **Keep all of them.**

- `/__tests__/integration/nanosStore.integration.test.ts` - **Real backend API testing**
- `/__tests__/integration/backend-integration.test.ts` - Real API integration
- `/__tests__/integration/TinkerItems.integration.test.ts` - Real item data
- `/__tests__/integration/AdvancedItemSearch.integration.test.ts` - Real search
- `/__tests__/integration/profile-equipment.integration.test.ts` - Real profile operations
- `/__tests__/integration/ip-calculation-workflow.test.ts` - Real IP calculations
- `/__tests__/integration/interpolation-ranges.test.ts` - Real interpolation
- `/__tests__/integration/action-criteria-cross-tool.test.ts` - Cross-tool integration

---

### 2.4 E2E Tests (KEEP - 8 files) ✅

These tests cover **real user workflows** through the UI. **Keep all of them.**

- `/__tests__/e2e/item-search-workflow.test.ts`
- `/__tests__/e2e/nano-search-workflow.test.ts`
- `/__tests__/e2e/nano-compatibility-workflow.test.ts`
- `/__tests__/e2e/nano-backend.integration.test.ts`
- `/__tests__/e2e/profile-management-workflow.test.ts`
- `/__tests__/e2e/item-interpolation-workflow.test.ts`
- `/__tests__/e2e/tinker-plants-workflow.test.ts`
- `/__tests__/e2e/TinkerPocket.workflow.test.ts`

---

### 2.5 Component Tests (MIXED - 27 files) ⚠️

Component tests need **case-by-case evaluation**. Good pattern: test UI behavior, not store internals.

#### GOOD Component Tests (Keep):

**Profile Components:**

- `SkillSlider.test.ts` (510 lines) - **Excellent UI testing**

  - Tests slider/input synchronization
  - Tests emit events
  - Tests visual display
  - Mocks PrimeVue components (appropriate)
  - Mocks IP calculator (appropriate - pure function)
  - **No store mocking**

- `CharacterInfoPanel.test.ts` (644 lines) - **Good UI testing**
  - Tests visual display of character data
  - Tests formatting functions
  - Tests error handling
  - **No store mocking**

#### Component Tests to EVALUATE:

Need to check which ones:

1. Mock stores heavily (migrate/delete)
2. Test UI behavior with minimal mocking (keep)

**Items Components (7 files):**

- `AdvancedItemSearch.test.ts`
- `ItemCard.test.ts`
- `ItemFilters.test.ts`
- `ItemList.test.ts`
- `ItemQuickView.test.ts`
- `ItemSearch.test.ts`
- `items/EquipmentSlotsDisplay.test.ts`
- `items/ItemInterpolationBar.debounce.test.ts`
- `items/NanoStatistics.test.ts`

**Nano Components (5 files):**

- `NanoCard.test.ts`
- `NanoCard.simple.test.ts`
- `NanoFilters.test.ts`
- `NanoList.test.ts`
- `NanoSearch.test.ts`

**Plants Components (4 files):**

- `plants/BuildSummary.test.ts`
- `plants/CharacterStatsPanel.test.ts`
- `plants/SymbiantFilters.test.ts`
- `plants/SymbiantList.test.ts`
- `plants/SymbiantSearch.test.ts`

**Pocket Components (6 files):**

- `pocket/CollectionTracker.test.ts`
- `pocket/CollectionTracker.simple.test.ts`
- `pocket/PocketBossDatabase.test.ts`
- `pocket/PocketBossDatabase.simple.test.ts`
- `pocket/SymbiantLookup.test.ts`
- `pocket/SymbiantLookup.simple.test.ts`

**Profiles Components (5 files):**

- `profiles/CharacterInfoPanel.test.ts` ✅ KEEP
- `profiles/ProfileCard.test.ts`
- `profiles/ProfileCreateModal.test.ts`
- `profiles/ProfileDropdown.test.ts`
- `profiles/SkillSlider.test.ts` ✅ KEEP

**Shared Components (2 files):**

- `shared/AccessibilityAnnouncer.test.ts`
- `shared/LoadingSpinner.test.ts`

**Other Components (4 files):**

- `ActionRequirements.test.ts`
- `CriteriaDisplay.test.ts`
- `CriterionChip.test.ts`
- `ItemInterpolationBar.test.ts`

---

### 2.6 Composables Tests (MIXED - 3 files) ⚠️

- `useItems.test.ts` - Check if mocks store heavily
- `useTheme.test.ts` - Check if mocks store heavily
- `useActionCriteria.test.ts` - Likely pure logic
- `useInterpolation.test.ts` - Likely pure logic

---

### 2.7 View Tests (MIXED - 8 files) ⚠️

Views typically need stores - evaluate for heavy mocking:

- `ItemDetail.test.ts`
- `TinkerNukes.test.ts`
- `TinkerNukes.simple.test.ts`
- `TinkerNukes.integration.test.ts` ✅ KEEP (integration)
- `TinkerPlants.simple.test.ts`
- `TinkerPocket.test.ts`
- `TinkerPocket.simple.test.ts`
- `TinkerPocket.integration.test.ts` ✅ KEEP (integration)
- `TinkerProfileDetail.equipment.test.ts`

---

### 2.8 TinkerProfiles Tests (MIXED - 3 files) ⚠️

- `lib/tinkerprofiles.test.ts` - Core library tests
- `tinkerprofiles/misc-skills-fix.test.ts`
- `tinkerprofiles/ncu-equipment.test.ts`
- `tinkerprofiles/ncu-equipment-fix.test.ts`
- `tinkerprofiles/misc-equipment-bonuses.test.ts`

---

### 2.9 Pagination Tests (EVALUATE - 2 files) ⚠️

- `pagination-fix.test.ts`
- `pagination-integration.test.ts`

---

## 3. Patterns of Wrong-Level Testing

### 3.1 Store Tests with Heavy Mocking

**Example from `tinkerProfiles.buff.test.ts`:**

```typescript
// ❌ WRONG - Mocking TinkerProfilesManager
vi.mock('@/lib/tinkerprofiles', () => {
  return {
    TinkerProfilesManager: vi.fn().mockImplementation(() => {
      const manager = {
        loadProfile: vi.fn().mockResolvedValue(mockProfile),
        updateProfile: vi.fn().mockResolvedValue(undefined),
        // ... complex mock setup
      };
      return manager;
    }),
  };
});

// ❌ WRONG - Testing store with mocked manager
const store = useTinkerProfilesStore();
await store.castBuff(nano);
```

**Why Wrong:**

- Store logic **depends on TinkerProfilesManager** - testing with mock doesn't validate real integration
- If manager API changes, tests pass but app breaks
- Integration test with real manager would catch real bugs

### 3.2 Direct State Manipulation

**Example from `pocketBossStore.test.ts`:**

```typescript
// ❌ WRONG - Using $patch to bypass store encapsulation
store.$patch({ pocketBosses: mockBosses });
expect(store.filteredPocketBosses).toEqual(mockBosses);

// ❌ WRONG - Testing computed property in isolation
store.$patch({ pocketBosses: mockBosses });
store.updateFilters({ search: 'Test' });
expect(store.filteredPocketBosses).toHaveLength(1);
```

**Why Wrong:**

- Bypasses store's public API
- Tests internal implementation, not behavior
- Should test through actions: `await store.fetchPocketBosses()` then `store.updateFilters()`

### 3.3 Mocking Pure Functions

**Example from component tests:**

```typescript
// ⚠️ ACCEPTABLE - Mocking pure function to isolate UI behavior
vi.mock('@/lib/tinkerprofiles/ip-calculator', () => ({
  calcIP: vi.fn(() => 100000),
  getBreedInitValue: vi.fn(() => 6),
}));

// ✅ GOOD - Testing UI behavior, not calculation logic
const wrapper = mount(SkillSlider, { props: defaultProps });
expect(wrapper.text()).toContain('6 / 13');
```

**Why Acceptable:**

- Component test focuses on **UI rendering**, not calculation logic
- Calculation logic tested separately in `ip-calculator.test.ts`
- Appropriate level of abstraction

---

## 4. Recommendations

### 4.1 Immediate Actions (DELETE)

**Delete these 5 store unit test files** (~2,237 lines):

1. `/__tests__/stores/profile.test.ts` (565 lines)
2. `/__tests__/stores/profilesStore.test.ts` (567 lines)
3. `/__tests__/stores/nanosStore.test.ts` (391 lines)
4. `/__tests__/stores/items.test.ts` (439 lines)
5. `/__tests__/stores/pocketBossStore.test.ts` (275 lines)

**Rationale:**

- No unique business logic - just CRUD operations
- Coverage provided by integration tests
- Maintenance burden > value
- Tests fight Vue's reactivity system

### 4.2 Migration Tasks (REFACTOR)

**Migrate 1 store test to integration test:**

1. **`/stores/__tests__/tinkerProfiles.buff.test.ts`** (617 lines)
   - **Keep the business logic tests** (NCU, NanoStrain, stacking order)
   - **Rewrite to use real TinkerProfilesManager**
   - Move to `/__tests__/integration/tinkerProfiles.buff.integration.test.ts`

**Migration Template:**

```typescript
// ✅ GOOD - Integration test with real manager
import { TinkerProfilesManager } from '@/lib/tinkerprofiles';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';

describe('TinkerProfiles Store - Buff Management (Integration)', () => {
  let manager: TinkerProfilesManager;
  let store: ReturnType<typeof useTinkerProfilesStore>;

  beforeEach(async () => {
    setActivePinia(createPinia());

    // Use REAL manager, not mock
    manager = new TinkerProfilesManager();

    // Initialize store with real manager
    store = useTinkerProfilesStore();

    // Create real profile through manager
    const profileId = await manager.createProfile('Test Character');
    await store.setActiveProfile(profileId);
  });

  it('should track NCU from cast buffs', async () => {
    // Real nano item from test data
    const nano = createTestNano({ ncuCost: 25 });

    // Real integration through store
    await store.castBuff(nano);

    // Verify real behavior
    expect(store.currentNCU).toBe(25);
    expect(store.availableNCU).toBe(1175); // Real calculation
  });
});
```

### 4.3 Component Test Evaluation (MANUAL REVIEW)

**For each component test file (~49 files), check:**

1. **Does it mock stores?**

   - If YES: Can the test be rewritten without store mocking?
   - If mock is essential: Is the component too coupled to store? Refactor component first.

2. **Does it test UI behavior?**

   - If YES: Keep the test
   - Focus on: rendering, user interaction, emitted events

3. **Does it test business logic?**
   - If YES: Move logic to service/util and test there
   - Components should be thin

**Keep these component test patterns:**

- ✅ Mock PrimeVue components (UI framework, not business logic)
- ✅ Mock pure utility functions (already tested separately)
- ✅ Test component props, events, rendering
- ❌ Don't mock stores (use integration test instead)
- ❌ Don't test complex logic in component tests (extract to service)

### 4.4 Testing Strategy Going Forward

**Three-Tier Testing Pyramid:**

```
           E2E Tests (8 files)
      [Real user workflows through UI]
                  ▲
                  │
       Integration Tests (8 files)
    [Real backend/database, real stores]
                  ▲
                  │
          Unit Tests (~13 files)
     [Pure functions: utils, services, lib]
```

**What to Test Where:**

| Type                   | Test Level  | Example                               | Mocking                  |
| ---------------------- | ----------- | ------------------------------------- | ------------------------ |
| **Pure Functions**     | Unit        | `calcIP()`, `calculateDamage()`       | None                     |
| **Services**           | Unit        | `apiClient`, `cacheManager`           | Mock fetch/HTTP          |
| **Store Logic**        | Integration | `useTinkerProfilesStore()`            | Real manager, mock API   |
| **Components (UI)**    | Component   | `<SkillSlider>` rendering             | Mock PrimeVue, pure fns  |
| **Components (Logic)** | Integration | `<SkillSlider>` with store            | Real store, real manager |
| **User Workflows**     | E2E         | Profile creation → equipment → export | Real everything          |

---

## 5. Edge Cases and Considerations

### 5.1 Tests Marked as "integration" but Aren't

Some files named `*.integration.test.ts` may still use mocks:

- `/__tests__/stores/symbiantsStore.integration.test.ts` - Verify
- `/__tests__/stores/plants-integration.test.ts` - Verify
- `/__tests__/stores/pocketBossStore.integration.test.ts` - Verify

**Action**: Check if they use real backend. If not, consider deleting or refactoring.

### 5.2 "Simple" Test Variants

Several tests have `.simple.test.ts` variants:

- `NanoCard.simple.test.ts` vs `NanoCard.test.ts`
- `CollectionTracker.simple.test.ts` vs `CollectionTracker.test.ts`
- `TinkerPocket.simple.test.ts` vs `TinkerPocket.test.ts`

**Question**: What's the difference? Are both needed?
**Recommendation**: Consolidate if possible, or document distinction clearly.

### 5.3 Tests in Multiple Locations

Some tests are in `/src/__tests__/`, others in `/tests/`:

- `/tests/utils/nuke-calculations.test.ts`
- `/tests/components/nukes/NukeInputForm.test.ts`
- `/tests/views/TinkerNukes.test.ts`

**Recommendation**: Consolidate to `/src/__tests__/` for consistency.

### 5.4 Mock Cleanup

After deleting store unit tests, clean up unused mocks:

- Remove mock localStorage implementations that aren't used
- Remove TinkerProfilesManager mock helpers
- Keep test data factories (createTestNano, etc.) - still useful

---

## 6. Summary Statistics

### Before Refactoring:

- **Total Test Files**: 86
- **Store Unit Tests (wrong-level)**: 8 files (~2,854 lines)
- **Pure Function Tests**: 13 files
- **Integration Tests**: 8 files
- **E2E Tests**: 8 files

### After Refactoring:

- **Delete**: 5 store unit tests (~2,237 lines)
- **Migrate to Integration**: 1 store test (~617 lines)
- **Keep**: ~80 files (pure function, integration, E2E, good component tests)

### Expected Benefits:

- **Less maintenance burden** - No fighting Vue reactivity
- **More confidence** - Integration tests catch real bugs
- **Faster test suite** - Fewer complex mocks to set up
- **Clearer test intent** - Each test at appropriate level

---

## 7. Test File Classification

### Files to DELETE (5 files, ~2,237 lines):

1. `/src/__tests__/stores/profile.test.ts` (565 lines)
2. `/src/__tests__/stores/profilesStore.test.ts` (567 lines)
3. `/src/__tests__/stores/nanosStore.test.ts` (391 lines)
4. `/src/__tests__/stores/items.test.ts` (439 lines)
5. `/src/__tests__/stores/pocketBossStore.test.ts` (275 lines)

### Files to MIGRATE (1 file, ~617 lines):

1. `/src/stores/__tests__/tinkerProfiles.buff.test.ts` (617 lines)
   → Migrate to `/src/__tests__/integration/tinkerProfiles.buff.integration.test.ts`

### Files to KEEP (80 files):

**Pure Function Tests (13 files):**

- All tests in `/__tests__/lib/` (6 files)
- All tests in `/__tests__/services/` (4 files)
- All tests in `/__tests__/utils/` (1 file)
- All tests in `/tests/utils/` (1 file)
- All tests in `/__tests__/helpers/` (1 file)

**Integration Tests (8 files):**

- All tests in `/__tests__/integration/` (8 files)

**E2E Tests (8 files):**

- All tests in `/__tests__/e2e/` (8 files)

**Good Component Tests (2 files confirmed, others need review):**

- `/__tests__/components/profiles/SkillSlider.test.ts`
- `/__tests__/components/profiles/CharacterInfoPanel.test.ts`

**Files to EVALUATE (47 files):**

- Component tests (25 files) - check for store mocking
- View tests (6 files) - check for store mocking
- Composable tests (3 files) - check for store mocking
- TinkerProfiles tests (3 files) - check for store mocking
- Pagination tests (2 files)
- Other integration tests (8 files in stores/) - verify they're truly integration tests

---

## 8. Next Steps

1. **Immediate**: Delete 5 store unit test files
2. **Week 1**: Migrate buff management test to integration test
3. **Week 2**: Evaluate component tests for store mocking (case-by-case)
4. **Week 3**: Clean up unused mocks and test helpers
5. **Week 4**: Document testing strategy and update contribution guide

---

## 9. Testing Principles (Going Forward)

### ✅ DO:

- Test pure functions at unit level
- Test stores with real TinkerProfilesManager (integration level)
- Test components' UI behavior with minimal mocking
- Test user workflows end-to-end
- Mock external dependencies (API, database)
- Mock UI framework components (PrimeVue)

### ❌ DON'T:

- Mock TinkerProfilesManager in store tests
- Use `$patch` or `as any` to manipulate store state
- Test computed properties in isolation
- Mock stores in component tests (use integration test instead)
- Test business logic in component tests (extract to service)
- Create store unit tests that fight Vue's reactivity

### 🎯 Test at the Right Level:

- **Pure Functions**: Unit test with real inputs/outputs
- **Stores**: Integration test with real manager
- **Components**: Test UI behavior, not store logic
- **Workflows**: E2E test with real everything

---

## Appendix A: Test File Manifest

### `/src/__tests__/` (78 files)

#### `components/` (27 files)

- `AdvancedItemSearch.test.ts`
- `ItemCard.test.ts`
- `ItemFilters.test.ts`
- `ItemList.test.ts`
- `ItemQuickView.test.ts`
- `ItemSearch.test.ts`
- `NanoCard.test.ts`
- `NanoCard.simple.test.ts`
- `NanoFilters.test.ts`
- `NanoList.test.ts`
- `NanoSearch.test.ts`
- `items/EquipmentSlotsDisplay.test.ts`
- `items/ItemInterpolationBar.debounce.test.ts`
- `items/NanoStatistics.test.ts`
- `plants/BuildSummary.test.ts`
- `plants/CharacterStatsPanel.test.ts`
- `plants/SymbiantFilters.test.ts`
- `plants/SymbiantList.test.ts`
- `plants/SymbiantSearch.test.ts`
- `pocket/CollectionTracker.test.ts`
- `pocket/CollectionTracker.simple.test.ts`
- `pocket/PocketBossDatabase.test.ts`
- `pocket/PocketBossDatabase.simple.test.ts`
- `pocket/SymbiantLookup.test.ts`
- `pocket/SymbiantLookup.simple.test.ts`
- `profiles/CharacterInfoPanel.test.ts` ✅
- `profiles/ProfileCard.test.ts`
- `profiles/ProfileCreateModal.test.ts`
- `profiles/ProfileDropdown.test.ts`
- `profiles/SkillSlider.test.ts` ✅
- `shared/AccessibilityAnnouncer.test.ts`
- `shared/LoadingSpinner.test.ts`
- `ActionRequirements.test.ts`
- `CriteriaDisplay.test.ts`
- `CriterionChip.test.ts`
- `ItemInterpolationBar.test.ts`

#### `composables/` (3 files)

- `useActionCriteria.test.ts`
- `useInterpolation.test.ts`
- `useItems.test.ts`
- `useTheme.test.ts`

#### `e2e/` (8 files) ✅

- `item-search-workflow.test.ts`
- `nano-search-workflow.test.ts`
- `nano-compatibility-workflow.test.ts`
- `nano-backend.integration.test.ts`
- `profile-management-workflow.test.ts`
- `item-interpolation-workflow.test.ts`
- `tinker-plants-workflow.test.ts`
- `TinkerPocket.workflow.test.ts`

#### `integration/` (8 files) ✅

- `nanosStore.integration.test.ts`
- `backend-integration.test.ts`
- `TinkerItems.integration.test.ts`
- `AdvancedItemSearch.integration.test.ts`
- `profile-equipment.integration.test.ts`
- `ip-calculation-workflow.test.ts`
- `interpolation-ranges.test.ts`
- `action-criteria-cross-tool.test.ts`

#### `lib/` (6 files) ✅

- `tinkerprofiles.test.ts`
- `tinkerprofiles/ip-calculator.test.ts`
- `tinkerprofiles/cluster-mappings.test.ts`
- `tinkerprofiles/aosetups-implant-import.test.ts`
- `tinkerprofiles/aosetups-perk-import.test.ts`
- `tinkerprofiles/transformer.test.ts`
- `tinkerprofiles/ip-integrator.test.ts`

#### `services/` (4 files) ✅

- `api-client.test.ts`
- `cache-manager.test.ts`
- `game-utils.test.ts`
- `spell-data-utils.test.ts`
- `profile-equipment-health.test.ts`

#### `stores/` (8 files)

- `items.test.ts` ❌ DELETE
- `nanosStore.test.ts` ❌ DELETE
- `pocketBossStore.test.ts` ❌ DELETE
- `profile.test.ts` ❌ DELETE
- `profilesStore.test.ts` ❌ DELETE
- `symbiantsStore.integration.test.ts` ⚠️ VERIFY
- `plants-integration.test.ts` ⚠️ VERIFY
- `pocketBossStore.integration.test.ts` ⚠️ VERIFY

#### `tinkerprofiles/` (3 files)

- `misc-skills-fix.test.ts`
- `ncu-equipment.test.ts`
- `ncu-equipment-fix.test.ts`
- `misc-equipment-bonuses.test.ts`

#### `utils/` (1 file) ✅

- `symbiantHelpers.test.ts`

#### `views/` (8 files)

- `ItemDetail.test.ts`
- `TinkerNukes.test.ts`
- `TinkerNukes.simple.test.ts`
- `TinkerNukes.integration.test.ts` ✅
- `TinkerPlants.simple.test.ts`
- `TinkerPocket.test.ts`
- `TinkerPocket.simple.test.ts`
- `TinkerPocket.integration.test.ts` ✅
- `TinkerProfileDetail.equipment.test.ts`

#### Root Level (4 files)

- `helpers/helpers.test.ts` ✅
- `pagination-fix.test.ts`
- `pagination-integration.test.ts`
- `TESTING_STRATEGY.md` (Documentation)

### `/tests/` (4 files)

#### `utils/` (1 file) ✅

- `nuke-calculations.test.ts`

#### `components/nukes/` (2 files)

- `NukeInputForm.test.ts`
- `NukeTable.test.ts`

#### `views/` (1 file)

- `TinkerNukes.test.ts`

### `/src/stores/__tests__/` (1 file)

- `tinkerProfiles.buff.test.ts` ⚠️ MIGRATE

---

## Appendix B: Test Smell Checklist

Use this checklist to evaluate any test file:

**🚩 RED FLAGS (Consider deleting/migrating):**

- [ ] Mocks `TinkerProfilesManager`
- [ ] Uses `$patch` to set store state
- [ ] Uses `as any` to bypass readonly
- [ ] Tests computed properties by patching state
- [ ] Complex mock setup (>20 lines)
- [ ] Tests internal implementation, not behavior
- [ ] Duplicates integration test coverage

**✅ GREEN FLAGS (Keep):**

- [ ] Tests pure functions with real inputs/outputs
- [ ] Uses real backend/database (integration)
- [ ] Tests UI rendering and user interaction (component)
- [ ] Tests complete user workflows (E2E)
- [ ] Minimal mocking (only external deps)
- [ ] Clear test intent and purpose
- [ ] Provides unique coverage not found elsewhere

**⚠️ YELLOW FLAGS (Evaluate case-by-case):**

- [ ] Mocks PrimeVue components (OK for component tests)
- [ ] Mocks pure utility functions (OK if tested elsewhere)
- [ ] Tests store actions (OK if using real manager)
- [ ] Complex test setup (may indicate wrong level)
- [ ] ".simple" variant exists (may be redundant)

---

**End of Analysis**

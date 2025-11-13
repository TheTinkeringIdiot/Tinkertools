# Profile System Bug Fixes (November 2025)

## Overview
Critical bug fixes for the TinkerTools profile system discovered through integration testing. These fixes address equipment bonus application, MaxNCU calculation, skill auto-creation, and localStorage key format issues that were causing incorrect character stat calculations and profile storage failures.

## User Perspective
Users experienced several issues prior to these fixes:
1. **Equipment bonuses not applying**: Equipped items appeared to provide no stat benefits
2. **MaxNCU showing 0**: Character NCU capacity showed as zero instead of proper base + level formula
3. **Skill modification failures**: Attempting to modify trainable skills that didn't exist in the profile failed silently
4. **Profile save/load errors**: Profiles failed to save or load correctly due to localStorage key mismatches

These bugs resulted in incorrect character stats, broken build planning, and lost profile data.

## Root Cause Analysis

### Bug 1: Equipment Bonuses Not Applied
**Impact**: All equipped items appeared to provide zero stat bonuses, making build planning impossible.

**Root Cause**: The `ip-integrator.ts` bonus calculation only checked `spell_data` for item bonuses:
```typescript
// OLD - BROKEN
const equipmentBonuses = calculateEquipmentBonuses(profile);
// Only checked items with spell_data, missed pure equipment bonuses
```

Equipment items that provide bonuses without nano effects (most armor/weapons) were completely ignored. The bonus system assumed all bonuses came from nano spells cast by items.

**Fix**: Expanded bonus calculation to check both `spell_data` AND item stat arrays:
```typescript
// NEW - FIXED
// Check both spell_data (nano effects) AND item stats (direct bonuses)
for (const item of equippedItems) {
  if (item.spell_data) {
    // Nano effect bonuses
    applySpellBonuses(item.spell_data);
  }
  if (item.stats) {
    // Direct equipment bonuses
    applyItemStatBonuses(item.stats);
  }
}
```

**Validation**: Integration tests verified equipment bonuses now apply correctly by checking stat totals after equipping test items.

### Bug 2: MaxNCU Calculation Formula (REVERTED - Was Incorrect Fix)
**Impact**: MaxNCU incorrectly calculated with base formula instead of pure bonuses.

**Root Cause**: MaxNCU (stat 181) was incorrectly moved to `CALCULATED_BASE_STAT_IDS` with formula `1200 + (level * 6)`. This was wrong - in Anarchy Online, MaxNCU is purely from equipment and buff bonuses, with no base value.

**Correct Behavior**: MaxNCU is a bonus-only stat:
```typescript
// CORRECT
const BONUS_ONLY_STAT_IDS = new Set([
  181, // MaxNCU - NO base value, only equipment/buff bonuses
  45, // BeltSlots
  // ... other bonus-only stats
]);

// MaxNCU calculated as pure bonuses
skillData.total = equipmentBonus + perkBonus + buffBonus;
```

**Previous Incorrect Fix** (November 2025 - REVERTED):
The stat was incorrectly moved to `CALCULATED_BASE_STAT_IDS` with formula `1200 + (level * 6)`. This resulted in inflated MaxNCU values (e.g., 1752 for level 92 instead of just equipment bonuses).

**Validation**: Integration tests verify MaxNCU = equipmentBonus + perkBonus + buffBonus (no base value).

### Bug 3: Skill Auto-Creation Missing for Trainable Skills
**Impact**: Modifying trainable skills (Body Dev, Nano Pool, etc.) that weren't in the profile failed silently.

**Root Cause**: `modifySkill()` only auto-created attribute skills (STR, AGI, etc.), not trainable skills:
```typescript
// OLD - BROKEN
export function modifySkill(profile, skillId, newValue) {
  let skillData = profile.skills[skillId];
  // If skillData is undefined and not an attribute, this fails
  if (!skillData) {
    return { success: false, error: 'Skill not found' };
  }
}
```

New profiles or imports from AOSetups often didn't have all trainable skills initialized.

**Fix**: Auto-create missing trainable skills with proper breed-based defaults:
```typescript
// NEW - FIXED
export function modifySkill(profile, skillId, newValue) {
  let skillData = profile.skills[skillId];

  // Auto-create missing trainable skills
  if (!skillData && TRAINABLE_SKILL_IDS.has(skillId)) {
    const breedBase = getBreedInitValue(profile.Character.Breed, skillId);
    skillData = {
      base: breedBase,
      trickle: 0,
      pointsFromIp: 0,
      equipmentBonus: 0,
      perkBonus: 0,
      buffBonus: 0,
      ipSpent: 0,
      cap: breedBase,
      total: breedBase,
    };
    profile.skills[skillId] = skillData;
  }
}
```

**Validation**: Integration tests verify trainable skills auto-create when modified, with correct breed-based base values.

### Bug 4: Profile LocalStorage Keys Wrong Format
**Impact**: Profiles failed to save/load correctly, causing data loss.

**Root Cause**: Profile manager expected individual keys (`tinkertools_profile_{id}`), but some code used legacy batch key (`tinkertools_profiles`):
```typescript
// MIXED - CAUSED CONFLICTS
// Some code used new individual keys
localStorage.setItem(`tinkertools_profile_${profileId}`, JSON.stringify(profile));

// Other code used legacy batch key
localStorage.setItem('tinkertools_profiles', JSON.stringify(allProfiles));
```

This caused race conditions where updates to one storage format didn't reflect in the other.

**Fix**: Enforced individual key format throughout codebase and added migration:
```typescript
// CONSISTENT - ALL USE INDIVIDUAL KEYS
const profileKey = `${STORAGE_KEYS.PROFILE_PREFIX}${profileId}`;
localStorage.setItem(profileKey, JSON.stringify(profile));

// Migration from legacy format
if (localStorage.getItem('tinkertools_profiles')) {
  migrateFromLegacyStorage();
}
```

**Validation**: Integration tests verify profiles save/load with correct individual keys.

## Implementation

### Key Files Changed
- `/frontend/src/lib/tinkerprofiles/ip-integrator.ts` - Bonus calculation and skill initialization (190 lines)
- `/frontend/src/lib/tinkerprofiles/transformer.ts` - Implant cluster capitalization (10 lines)
- `/frontend/src/lib/tinkerprofiles/constants.ts` - Implant slot bitflag keys (26 lines)
- `/frontend/src/stores/tinkerProfiles.ts` - Profile update synchronization (30 lines)
- `/frontend/src/composables/useSkills.ts` - Reactive profile injection (10 lines)
- `/frontend/src/components/profiles/skills/SkillsManager.vue` - Computed profile provide (8 lines)
- `/frontend/src/services/equipment-slot-mapper.ts` - Implant bitflag mapping (78 lines)

### Data Flow
1. **Equipment Bonus Application**:
   - User equips item → Store calls `updateProfileSkillInfo()`
   - `calculateEquipmentBonuses()` checks both `spell_data` AND `item.stats`
   - Bonuses stored in `skillData.equipmentBonus` (separate from base/IP/trickle)
   - Total recalculated: `base + trickle + pointsFromIp + equipmentBonus + perkBonus + buffBonus`

2. **MaxNCU Calculation**:
   - Profile loaded/level changed → `updateProfileSkillInfo()` called
   - Stat 181 recognized as `CALCULATED_BASE_STAT_IDS`
   - Base calculated: `1200 + (level * 6)`
   - Bonuses applied: `total = base + equipmentBonus + perkBonus + buffBonus`

3. **Skill Auto-Creation**:
   - User modifies skill via UI → `modifySkill(skillId, value)` called
   - If `!profile.skills[skillId]` AND `TRAINABLE_SKILL_IDS.has(skillId)`
   - Create skill with breed base: `getBreedInitValue(breed, skillId)`
   - Apply modification and recalculate IP

4. **Profile Save/Load**:
   - Profile updated → `updateProfile(profileId, updates)` called
   - Save to individual key: `tinkertools_profile_{profileId}`
   - Reload from localStorage → sync reactive refs
   - Update `activeProfile` if currently active

## Testing Strategy

### Integration Tests Caught These Bugs
All four bugs were discovered by integration tests that used **real Pinia stores** with **mocked API only** (no store mocking). This approach caught issues that unit tests with mocked stores completely missed.

**Key Test Files**:
- `/frontend/src/__tests__/integration/equipment-interaction.integration.test.ts` - Caught Bug 1 (equipment bonuses)
- `/frontend/src/__tests__/integration/profile-management.integration.test.ts` - Caught Bug 2 (MaxNCU) and Bug 4 (localStorage)
- `/frontend/src/__tests__/integration/buff-management.integration.test.ts` - Caught Bug 3 (skill auto-creation)

**Test Pattern**:
```typescript
// Setup: Real stores + mocked API
import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';

vi.mock('@/services/api-client'); // ONLY mock API

beforeEach(async () => {
  const app = createApp({});
  app.use(PrimeVue);
  app.use(ToastService);

  context = await setupIntegrationTest(); // Real Pinia
  app.use(context.pinia);

  store = useTinkerProfilesStore(); // Real store instance
});

// Test: Verify real state management
it('applies equipment bonuses correctly', async () => {
  const profile = await store.createProfile('Test', 'Solitus');
  await store.equipItem(testItem);

  // This caught the bug - equipmentBonus was 0 when it should be > 0
  expect(profile.skills[skillId].equipmentBonus).toBeGreaterThan(0);
});
```

### Why Integration Tests > Unit Tests
**Unit tests with mocked stores** would have passed despite these bugs:
```typescript
// BAD - Unit test with mocked store (would NOT catch bugs)
const mockStore = {
  updateProfile: vi.fn().mockResolvedValue(undefined),
  activeProfile: ref({ skills: {} }),
};

// Test passes even with broken implementation
expect(mockStore.updateProfile).toHaveBeenCalled(); // ✅ False confidence
```

**Integration tests with real stores** caught all four bugs:
```typescript
// GOOD - Integration test with real store (caught all bugs)
const store = useTinkerProfilesStore(); // Real Pinia store

await store.equipItem(testItem);
expect(store.activeProfile.skills[skillId].equipmentBonus).toBeGreaterThan(0);
// ❌ FAILED - caught Bug 1!
```

## Related Documentation
- Testing Strategy: `/frontend/src/__tests__/TESTING_STRATEGY.md` - E2E-first approach
- Test Refactoring: `/frontend/TEST_REFACTORING_SUMMARY.md` - What was deleted and why
- IP Integration: `/frontend/src/lib/tinkerprofiles/ip-integrator.ts` - Central calculation hub
- Storage Layer: `/frontend/src/lib/tinkerprofiles/CLAUDE.md` - Individual profile storage pattern

## Additional Improvement: IndexedDB Weapon Cache

**Not a bug fix**, but included in this commit: TinkerFite weapon analysis cache migrated from LocalStorage to IndexedDB.

**Problem**: LocalStorage has 5-10MB quota limit. Weapon cache was hitting quota exceeded errors with 5+ cached profiles (~6MB total).

**Solution**: New `/frontend/src/services/indexed-db-weapon-cache.ts`:
- Uses `idb-keyval` library (500 bytes gzipped)
- 50MB+ storage capacity (10x improvement)
- 1 hour TTL with LRU eviction (max 5 cached profiles)
- Automatic cleanup of legacy LocalStorage keys on first load
- Metrics tracking (hit rate, average response time)

**Benefits**:
- No more quota exceeded errors
- Faster weapon analysis (cache hit: <50ms vs backend: 500-2000ms)
- Better UX for users with multiple profiles

**Debug**: Chrome DevTools → Application → IndexedDB → `keyval-store`

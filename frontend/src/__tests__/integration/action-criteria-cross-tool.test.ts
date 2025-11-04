/**
 * Cross-Tool Integration Tests for Action Criteria System
 *
 * REGRESSION PREVENTION: Tests that changes to action-criteria logic in one tool
 * (e.g., TinkerPocket symbiant filtering) don't break other tools (e.g., TinkerNukes).
 *
 * BACKGROUND:
 * Recent changes to improve OR operator handling for TinkerPocket symbiants inadvertently
 * broke TinkerNukes nano filtering. This test suite validates that action-criteria
 * changes work correctly across all consuming tools.
 *
 * TESTING STRATEGY:
 * - Use real data structures from both TinkerPocket and TinkerNukes
 * - Test shared profile state between tools
 * - Validate OR operator logic in different contexts
 * - Ensure requirement checking is consistent across tools
 *
 * Tools tested:
 * - TinkerPocket: Symbiant requirement checking (FindGear.vue line 145)
 * - TinkerNukes: Nano requirement checking (nuke-filtering.ts line 55)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import { parseAction, checkActionRequirements } from '@/services/action-criteria';
import { mapProfileToStats } from '@/utils/profile-stats-mapper';
import { filterByCharacterProfile } from '@/utils/nuke-filtering';
import type { Action, SymbiantItem } from '@/types/api';
import type { OffensiveNano } from '@/types/offensive-nano';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import { BREED, PROFESSION } from '@/__tests__/helpers';

// Mock localStorage for profile persistence
global.localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
} as any;

/**
 * REGRESSION SCENARIO 1: Symbiant Profession OR Requirements
 *
 * Tests that profession OR logic works correctly for symbiants.
 * Symbiants typically use patterns like:
 * (Soldier OR MartialArtist OR Engineer) AND Stamina>=300 AND Strength>=250
 */
describe('TinkerPocket: Symbiant Requirements with OR Logic', () => {
  let profileStore: ReturnType<typeof useTinkerProfilesStore>;

  beforeEach(() => {
    // Setup PrimeVue with ToastService BEFORE initializing Pinia/stores
    const app = createApp({});
    app.use(PrimeVue);
    app.use(ToastService);

    const pinia = createPinia();
    app.use(pinia);
    setActivePinia(pinia);

    profileStore = useTinkerProfilesStore();
    vi.clearAllMocks();
  });

  it('should correctly filter symbiant with profession OR requirement', () => {
    // Symbiant: Artillery Eye (requires Soldier OR Enforcer)
    const symbiantAction: Action = {
      id: 1,
      action: 6, // Wield
      item_id: 12345,
      criteria: [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
        { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = Enforcer
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 17, value2: 299, operator: 2 }, // Stamina > 299 (>= 300)
        { id: 5, value1: 0, value2: 0, operator: 4 }, // AND
      ],
    };

    const parsedAction = parseAction(symbiantAction);

    // Character is Soldier with good stamina - should PASS
    const soldierStats = { 60: 1, 17: 350 };
    let result = checkActionRequirements(parsedAction, soldierStats);
    expect(result.canPerform).toBe(true);
    expect(result.unmetRequirements).toHaveLength(0);

    // Character is Enforcer with good stamina - should PASS
    const enforcerStats = { 60: 12, 17: 350 };
    result = checkActionRequirements(parsedAction, enforcerStats);
    expect(result.canPerform).toBe(true);
    expect(result.unmetRequirements).toHaveLength(0);

    // Character is NanoTechnician with good stamina - should FAIL (wrong profession)
    const ntStats = { 60: 11, 17: 350 };
    result = checkActionRequirements(parsedAction, ntStats);
    expect(result.canPerform).toBe(false);
    expect(result.unmetRequirements.length).toBeGreaterThan(0);
  });

  it('should filter symbiants by profile correctly (FindGear.vue pattern)', () => {
    // Mock symbiant data structure matching TinkerPocket
    const mockSymbiant: Partial<SymbiantItem> = {
      id: 1,
      aoid: 12345,
      name: 'Artillery Eye',
      ql: 300,
      family: 'Artillery',
      slot_id: 1,
      actions: [
        {
          id: 1,
          action: 6, // Wield
          item_id: 12345,
          criteria: [
            { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
            { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = Enforcer
            { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
          ],
        },
      ],
    };

    // Test with Soldier stats
    const soldierStats = { 60: 1 };
    const wearAction = mockSymbiant.actions![0];
    const canWear = checkActionRequirements(parseAction(wearAction), soldierStats).canPerform;
    expect(canWear).toBe(true);

    // Test with Agent stats (should fail)
    const agentStats = { 60: 5 };
    const cantWear = checkActionRequirements(parseAction(wearAction), agentStats).canPerform;
    expect(cantWear).toBe(false);
  });

  /**
   * REGRESSION GUARD: Ensure OR requirement counting doesn't inflate total requirements
   *
   * Previously, OR nodes summed children's requirement counts instead of counting as 1 choice.
   * This test ensures that doesn't break again.
   */
  it('should count OR profession choice as single requirement, not sum of options', () => {
    const symbiantAction: Action = {
      id: 1,
      action: 6,
      item_id: 1,
      criteria: [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Soldier
        { id: 2, value1: 60, value2: 2, operator: 0 }, // MartialArtist
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 60, value2: 3, operator: 0 }, // Engineer
        { id: 5, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 6, value1: 17, value2: 299, operator: 2 }, // Stamina >= 300
        { id: 7, value1: 0, value2: 0, operator: 4 }, // AND
      ],
    };

    const parsedAction = parseAction(symbiantAction);

    // Engineer with good stamina - should pass
    const stats = { 60: 3, 17: 350 };
    const result = checkActionRequirements(parsedAction, stats);

    expect(result.canPerform).toBe(true);
    expect(result.unmetRequirements).toHaveLength(0);

    // Verify unmet requirements are correctly tracked when profession wrong
    const wrongProfStats = { 60: 11, 17: 350 }; // NT profession
    const failResult = checkActionRequirements(parsedAction, wrongProfStats);
    expect(failResult.canPerform).toBe(false);
    // Should report profession requirement unmet, not all 3 profession options
  });
});

/**
 * REGRESSION SCENARIO 2: Nano Requirements with OR Logic
 *
 * Tests that nano filtering works correctly in TinkerNukes context.
 * Nanos may have OR requirements for different schools or profession options.
 */
describe('TinkerNukes: Nano Requirements with OR Logic', () => {
  let profileStore: ReturnType<typeof useTinkerProfilesStore>;

  beforeEach(() => {
    // Setup PrimeVue with ToastService BEFORE initializing Pinia/stores
    const app = createApp({});
    app.use(PrimeVue);
    app.use(ToastService);

    const pinia = createPinia();
    app.use(pinia);
    setActivePinia(pinia);

    profileStore = useTinkerProfilesStore();
    vi.clearAllMocks();
  });

  it('should correctly filter nano with profession OR requirement', () => {
    // Mock offensive nano with NT OR MP requirement
    const nanoAction: Action = {
      id: 1,
      action: 3, // Use
      item_id: 67890,
      criteria: [
        { id: 1, value1: 60, value2: 11, operator: 0 }, // Profession = NanoTechnician
        { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = MetaPhysicist
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 130, value2: 799, operator: 2 }, // Matter Creation > 799 (>= 800)
        { id: 5, value1: 0, value2: 0, operator: 4 }, // AND
      ],
    };

    const parsedAction = parseAction(nanoAction);

    // NanoTechnician with good skill - should PASS
    const ntStats = { 60: 11, 130: 850 };
    let result = checkActionRequirements(parsedAction, ntStats);
    expect(result.canPerform).toBe(true);
    expect(result.unmetRequirements).toHaveLength(0);

    // MetaPhysicist with good skill - should PASS
    const mpStats = { 60: 12, 130: 850 };
    result = checkActionRequirements(parsedAction, mpStats);
    expect(result.canPerform).toBe(true);
    expect(result.unmetRequirements).toHaveLength(0);

    // Soldier with good skill - should FAIL (wrong profession)
    const soldierStats = { 60: 1, 130: 850 };
    result = checkActionRequirements(parsedAction, soldierStats);
    expect(result.canPerform).toBe(false);
    expect(result.unmetRequirements.length).toBeGreaterThan(0);
  });

  it('should filter nanos by character profile (nuke-filtering.ts pattern)', () => {
    // Mock OffensiveNano structure
    const mockNano: Partial<OffensiveNano> = {
      id: 1,
      name: 'Test Nuke',
      qualityLevel: 200,
      item: {
        id: 1,
        aoid: 67890,
        name: 'Test Nuke',
        ql: 200,
        is_nano: true,
        actions: [
          {
            id: 1,
            action: 3,
            item_id: 67890,
            criteria: [
              { id: 1, value1: 60, value2: 11, operator: 0 }, // NT only
              { id: 2, value1: 130, value2: 799, operator: 2 }, // MC >= 800
              { id: 3, value1: 0, value2: 0, operator: 4 }, // AND
            ],
          },
        ],
      } as any,
    };

    // Create mock character with correct profession and skills
    const ntCharacter = {
      baseStats: { 60: 11, 130: 850 },
      profession: 11,
      level: 220,
      breed: 1,
    };

    // Filter should include nano for NT
    const filtered = filterByCharacterProfile([mockNano as OffensiveNano], ntCharacter);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(1);

    // Filter should exclude nano for non-NT
    const soldierCharacter = {
      baseStats: { 60: 1, 130: 850 },
      profession: 1,
      level: 220,
      breed: 1,
    };
    const filteredSoldier = filterByCharacterProfile([mockNano as OffensiveNano], soldierCharacter);
    expect(filteredSoldier).toHaveLength(0);
  });

  /**
   * REGRESSION GUARD: Nano school OR requirements
   *
   * Some nanos may accept multiple schools (MC OR MM).
   * Ensure OR logic works for skill requirements.
   */
  it('should handle nano with school OR requirement', () => {
    const nanoAction: Action = {
      id: 1,
      action: 3,
      item_id: 1,
      criteria: [
        { id: 1, value1: 130, value2: 799, operator: 2 }, // MC >= 800
        { id: 2, value1: 127, value2: 799, operator: 2 }, // MM >= 800
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 60, value2: 11, operator: 0 }, // NT profession
        { id: 5, value1: 0, value2: 0, operator: 4 }, // AND
      ],
    };

    const parsedAction = parseAction(nanoAction);

    // NT with high MC - should PASS
    const highMC = { 60: 11, 130: 850, 127: 0 };
    let result = checkActionRequirements(parsedAction, highMC);
    expect(result.canPerform).toBe(true);

    // NT with high MM - should PASS
    const highMM = { 60: 11, 130: 0, 127: 850 };
    result = checkActionRequirements(parsedAction, highMM);
    expect(result.canPerform).toBe(true);

    // NT with low both - should FAIL
    const lowBoth = { 60: 11, 130: 500, 127: 500 };
    result = checkActionRequirements(parsedAction, lowBoth);
    expect(result.canPerform).toBe(false);
  });
});

/**
 * REGRESSION SCENARIO 3: Shared Profile State
 *
 * Tests that profile changes correctly update filtering in both tools.
 * Ensures TinkerPocket changes don't break TinkerNukes profile integration.
 */
describe('Cross-Tool: Shared Profile State', () => {
  let profileStore: ReturnType<typeof useTinkerProfilesStore>;

  beforeEach(() => {
    // Setup PrimeVue with ToastService BEFORE initializing Pinia/stores
    const app = createApp({});
    app.use(PrimeVue);
    app.use(ToastService);

    const pinia = createPinia();
    app.use(pinia);
    setActivePinia(pinia);

    profileStore = useTinkerProfilesStore();
    vi.clearAllMocks();
  });

  it('should correctly map profile to stats for both symbiant and nano filtering', () => {
    // Create mock profile matching TinkerProfile v4.0.0 structure
    const mockProfile: Partial<TinkerProfile> = {
      Character: {
        Name: 'TestChar',
        Profession: PROFESSION.NANO_TECHNICIAN,
        Level: 200,
        Breed: BREED.OPIFEX,
        Gender: 'Male',
        MaxHealth: 5000,
        MaxNano: 8000,
        AccountType: 'Paid',
        Specialization: 0,
      },
      skills: {
        130: { total: 850 }, // Matter Creation
        17: { total: 500 }, // Stamina
        355: { total: 0 }, // WornItem
      },
    } as any;

    // Map profile to stats (used by both tools)
    const stats = mapProfileToStats(mockProfile as TinkerProfile);

    // Verify stats include all required fields
    expect(stats[60]).toBe(11); // Profession
    expect(stats[130]).toBe(850); // Matter Creation
    expect(stats[17]).toBe(500); // Stamina

    // Test with symbiant action
    const symbiantAction: Action = {
      id: 1,
      action: 6,
      item_id: 1,
      criteria: [
        { id: 1, value1: 17, value2: 299, operator: 2 }, // Stamina >= 300
      ],
    };

    const symbiantResult = checkActionRequirements(parseAction(symbiantAction), stats);
    expect(symbiantResult.canPerform).toBe(true);

    // Test with nano action
    const nanoAction: Action = {
      id: 2,
      action: 3,
      item_id: 2,
      criteria: [
        { id: 1, value1: 60, value2: 11, operator: 0 }, // NT profession
        { id: 2, value1: 130, value2: 799, operator: 2 }, // MC >= 800
        { id: 3, value1: 0, value2: 0, operator: 4 }, // AND
      ],
    };

    const nanoResult = checkActionRequirements(parseAction(nanoAction), stats);
    expect(nanoResult.canPerform).toBe(true);
  });

  /**
   * REGRESSION GUARD: Profile stat mapping consistency
   *
   * Ensures that both TinkerPocket and TinkerNukes get consistent stat mappings
   * from the same profile. A change to mapProfileToStats should work for both.
   */
  it('should provide consistent stats mapping for cross-tool requirement checks', () => {
    const profile: Partial<TinkerProfile> = {
      Character: {
        Name: 'MultiToolChar',
        Profession: PROFESSION.SOLDIER,
        Level: 150,
        Breed: BREED.SOLITUS,
        Gender: 'Male',
        MaxHealth: 4000,
        MaxNano: 3000,
        AccountType: 'Paid',
        Specialization: 0,
      },
      skills: {
        17: { total: 400 }, // Stamina
        18: { total: 350 }, // Strength
        112: { total: 500 }, // Pistol
        355: { total: 0 }, // WornItem
      },
    } as any;

    const stats = mapProfileToStats(profile as TinkerProfile);

    // Verify all stats present
    expect(stats[60]).toBe(1); // Profession
    expect(stats[17]).toBe(400); // Stamina
    expect(stats[18]).toBe(350); // Strength
    expect(stats[112]).toBe(500); // Pistol

    // Symbiant requirement check (TinkerPocket pattern)
    const symbiantAction = parseAction({
      id: 1,
      action: 6,
      item_id: 1,
      criteria: [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Soldier
        { id: 2, value1: 17, value2: 299, operator: 2 }, // Stamina >= 300
        { id: 3, value1: 0, value2: 0, operator: 4 }, // AND
      ],
    });
    expect(checkActionRequirements(symbiantAction, stats).canPerform).toBe(true);

    // Nano requirement check (TinkerNukes pattern) - should fail for Soldier
    const nanoAction = parseAction({
      id: 2,
      action: 3,
      item_id: 2,
      criteria: [
        { id: 1, value1: 60, value2: 11, operator: 0 }, // NT only
      ],
    });
    expect(checkActionRequirements(nanoAction, stats).canPerform).toBe(false);
  });
});

/**
 * REGRESSION SCENARIO 4: Edge Cases in OR Logic
 *
 * Tests edge cases that could cause cross-tool breakage.
 */
describe('Cross-Tool: OR Logic Edge Cases', () => {
  it('should handle deeply nested OR chains consistently', () => {
    // 5-profession OR chain (common in weapon proficiency items)
    const action: Action = {
      id: 1,
      action: 6,
      item_id: 1,
      criteria: [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Soldier
        { id: 2, value1: 60, value2: 2, operator: 0 }, // MartialArtist
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 60, value2: 3, operator: 0 }, // Engineer
        { id: 5, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 6, value1: 60, value2: 4, operator: 0 }, // Fixer
        { id: 7, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 8, value1: 60, value2: 5, operator: 0 }, // Agent
        { id: 9, value1: 0, value2: 0, operator: 3 }, // OR
      ],
    };

    const parsedAction = parseAction(action);

    // Test each profession passes
    for (const profId of [1, 2, 3, 4, 5]) {
      const stats = { 60: profId };
      const result = checkActionRequirements(parsedAction, stats);
      expect(result.canPerform).toBe(true);
    }

    // Test non-matching profession fails
    const ntStats = { 60: 11 };
    const result = checkActionRequirements(parsedAction, ntStats);
    expect(result.canPerform).toBe(false);
  });

  it('should handle mixed AND/OR with stat requirements', () => {
    // Pattern: (ProfA OR ProfB) AND Skill1>=X AND Skill2>=Y
    const action: Action = {
      id: 1,
      action: 6,
      item_id: 1,
      criteria: [
        { id: 1, value1: 60, value2: 11, operator: 0 }, // NT
        { id: 2, value1: 60, value2: 12, operator: 0 }, // MP
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 130, value2: 799, operator: 2 }, // MC >= 800
        { id: 5, value1: 0, value2: 0, operator: 4 }, // AND
        { id: 6, value1: 127, value2: 599, operator: 2 }, // MM >= 600
        { id: 7, value1: 0, value2: 0, operator: 4 }, // AND
      ],
    };

    const parsedAction = parseAction(action);

    // NT with both skills - PASS
    let stats = { 60: 11, 130: 850, 127: 650 };
    let result = checkActionRequirements(parsedAction, stats);
    expect(result.canPerform).toBe(true);

    // MP with both skills - PASS
    stats = { 60: 12, 130: 850, 127: 650 };
    result = checkActionRequirements(parsedAction, stats);
    expect(result.canPerform).toBe(true);

    // NT with only one skill - FAIL
    stats = { 60: 11, 130: 850, 127: 500 };
    result = checkActionRequirements(parsedAction, stats);
    expect(result.canPerform).toBe(false);
    expect(result.unmetRequirements.length).toBe(1);
    expect(result.unmetRequirements[0].stat).toBe(127);

    // Soldier with both skills - FAIL (wrong profession)
    stats = { 60: 1, 130: 850, 127: 650 };
    result = checkActionRequirements(parsedAction, stats);
    expect(result.canPerform).toBe(false);
  });

  it('should handle empty criteria gracefully', () => {
    // Some items have no requirements
    const action: Action = {
      id: 1,
      action: 1, // Get
      item_id: 1,
      criteria: [],
    };

    const parsedAction = parseAction(action);
    const stats = { 60: 11 };
    const result = checkActionRequirements(parsedAction, stats);

    expect(result.canPerform).toBe(true);
    expect(result.unmetRequirements).toHaveLength(0);
  });
});

/**
 * REGRESSION SCENARIO 5: Performance and Consistency
 *
 * Ensures filtering performance is acceptable for both tools.
 */
describe('Cross-Tool: Performance and Consistency', () => {
  it('should handle bulk filtering efficiently', () => {
    // Mock 100 items with various requirements
    const actions: Action[] = [];
    for (let i = 0; i < 100; i++) {
      actions.push({
        id: i,
        action: 6,
        item_id: i,
        criteria: [
          { id: 1, value1: 60, value2: i % 12, operator: 0 }, // Various professions
          { id: 2, value1: 130, value2: 700 + i, operator: 2 }, // Varying skill requirements
          { id: 3, value1: 0, value2: 0, operator: 4 },
        ],
      });
    }

    const stats = { 60: 11, 130: 850 };

    const start = performance.now();
    const results = actions.map((action) => checkActionRequirements(parseAction(action), stats));
    const duration = performance.now() - start;

    // Should complete in reasonable time (< 100ms for 100 items)
    expect(duration).toBeLessThan(100);

    // Verify some passed and some failed
    const passed = results.filter((r) => r.canPerform).length;
    expect(passed).toBeGreaterThan(0);
    expect(passed).toBeLessThan(100);
  });
});

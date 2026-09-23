/**
 * Buff Management Integration Tests
 *
 * Integration tests for buff management covering NCU tracking, NanoStrain conflict
 * resolution, and buff stacking. Tests through real components and store interactions.
 *
 * MaxNCU (stat 181) has no base value in Anarchy Online: it comes entirely from
 * equipment (NCU memory in the NCU1-6 deck slots) and buffs. Each test character
 * therefore wears an NCU memory that sets its capacity.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import type { Item } from '@/types/api';
import {
  BREED,
  PROFESSION,
  createTestProfile,
  createTestItem,
  createSpellData,
  createSpell,
} from '@/__tests__/helpers';

// Mock PrimeVue Toast
const mockToast = {
  add: vi.fn(),
};

vi.mock('primevue/usetoast', () => ({
  useToast: () => mockToast,
}));

describe('Buff Management Integration', () => {
  let pinia: ReturnType<typeof createPinia>;
  let store: ReturnType<typeof useTinkerProfilesStore>;
  let profileId: string;

  // NCU memory: a deck item whose Wear effect modifies MaxNCU (stat 181)
  const ncuMemory = (amount: number): Item =>
    createTestItem({
      name: `NCU Memory (+${amount})`,
      spell_data: [
        createSpellData({
          event: 14, // Wear
          spells: [createSpell({ spell_id: 53045, spell_params: { Stat: 181, Amount: amount } })],
        }),
      ],
    });

  // Create a stored character whose only NCU source is an equipped NCU memory
  const createCharacter = async (
    name: string,
    options: { level: number; profession: number; breed: number; maxNCU: number }
  ): Promise<string> => {
    const profile = createTestProfile({
      name,
      level: options.level,
      profession: options.profession,
      breed: options.breed,
    });
    return store.createProfile(name, {
      ...profile,
      Weapons: { ...profile.Weapons, NCU1: ncuMemory(options.maxNCU) },
      buffs: [],
    });
  };

  // Swap the active character's NCU memory for one of a different size
  const equipNcuMemory = async (amount: number): Promise<void> => {
    const profile = await store.loadProfile(profileId);
    expect(profile).toBeDefined();
    await store.updateProfile(profileId, {
      Weapons: { ...profile!.Weapons, NCU1: ncuMemory(amount) },
    });
    await store.setActiveProfile(profileId);
    await nextTick();
  };

  // Test buff items with different NCU costs and strains
  const createBuffItem = (overrides: Partial<Item> = {}): Item => ({
    id: Math.floor(Math.random() * 100000),
    aoid: Math.floor(Math.random() * 100000),
    name: 'Test Buff',
    ql: 200,
    description: 'A test buff nano',
    item_class: 0, // Nano class
    is_nano: true,
    stats: [
      { id: 1, stat: 54, value: 30 }, // NCU cost (stat 54)
      { id: 2, stat: 75, value: 1000 }, // NanoStrain (stat 75)
      { id: 3, stat: 551, value: 100 }, // StackingOrder (stat 551)
    ],
    spell_data: [],
    actions: [],
    attack_stats: [],
    defense_stats: [],
    ...overrides,
  });

  const buffLowNCU = createBuffItem({
    id: 1001,
    name: 'Iron Circle',
    stats: [
      { id: 1, stat: 54, value: 25 }, // Low NCU cost
      { id: 2, stat: 75, value: 1000 }, // Strain A
      { id: 3, stat: 551, value: 100 }, // Priority 100
    ],
  });

  const buffMediumNCU = createBuffItem({
    id: 1002,
    name: 'Fortification',
    stats: [
      { id: 1, stat: 54, value: 30 }, // Medium NCU cost
      { id: 2, stat: 75, value: 2000 }, // Strain B (different)
      { id: 3, stat: 551, value: 120 }, // Priority 120
    ],
  });

  const buffHighNCU = createBuffItem({
    id: 1003,
    name: 'Massive Enhancement',
    stats: [
      { id: 1, stat: 54, value: 1100 }, // High NCU cost - won't fit
      { id: 2, stat: 75, value: 3000 }, // Strain C
      { id: 3, stat: 551, value: 150 },
    ],
  });

  const buffSameStrainHighPriority = createBuffItem({
    id: 1004,
    name: 'Iron Circle Superior',
    stats: [
      { id: 1, stat: 54, value: 35 },
      { id: 2, stat: 75, value: 1000 }, // Same strain as buffLowNCU
      { id: 3, stat: 551, value: 200 }, // Higher priority than buffLowNCU
    ],
  });

  const buffSameStrainLowPriority = createBuffItem({
    id: 1005,
    name: 'Iron Circle Basic',
    stats: [
      { id: 1, stat: 54, value: 20 },
      { id: 2, stat: 75, value: 1000 }, // Same strain as buffLowNCU
      { id: 3, stat: 551, value: 50 }, // Lower priority than buffLowNCU
    ],
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Clear localStorage
    localStorage.clear();

    // Create fresh Pinia instance
    pinia = createPinia();
    setActivePinia(pinia);
    store = useTinkerProfilesStore();

    // Level 200 adventurer wearing a 2400 NCU memory
    profileId = await createCharacter('Test Character', {
      level: 200,
      profession: PROFESSION.ADVENTURER,
      breed: BREED.SOLITUS,
      maxNCU: 2400,
    });

    // Set as active profile (this triggers IP recalculation)
    await store.setActiveProfile(profileId);
  });

  describe('Casting Buffs', () => {
    it('should cast a buff and update NCU usage', async () => {
      // Wait for profile to be fully initialized
      await nextTick();

      // Verify profile is properly set up
      expect(store.activeProfileId).toBe(profileId);
      expect(store.activeProfile).toBeDefined();
      expect(store.activeProfile?.Character.Name).toBe('Test Character');

      // MaxNCU comes from the equipped 2400 NCU memory
      const expectedMaxNCU = 2400;
      expect(store.maxNCU).toBe(expectedMaxNCU);

      // Initial state - no buffs
      expect(store.currentNCU).toBe(0);
      expect(store.availableNCU).toBe(expectedMaxNCU);

      // Cast buff
      await store.castBuff(buffLowNCU);
      await nextTick();

      // Verify buff was added
      const profile = store.activeProfile;
      expect(profile?.buffs).toBeDefined();
      expect(profile?.buffs?.length).toBe(1);
      expect(profile?.buffs?.[0].id).toBe(buffLowNCU.id);

      // Verify NCU was updated
      expect(store.currentNCU).toBe(25);
      expect(store.availableNCU).toBe(expectedMaxNCU - 25);

      // Verify success toast was shown
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'success',
          summary: 'Buff Cast',
        })
      );
    });

    it('should cast multiple buffs and accumulate NCU correctly', async () => {
      const expectedMaxNCU = 2400;

      // Cast first buff
      await store.castBuff(buffLowNCU);
      await nextTick();

      expect(store.currentNCU).toBe(25);
      expect(store.availableNCU).toBe(expectedMaxNCU - 25); // 2400 - 25 = 2375

      // Cast second buff with different strain
      await store.castBuff(buffMediumNCU);
      await nextTick();

      // Verify both buffs are active
      const profile = store.activeProfile;
      expect(profile?.buffs?.length).toBe(2);

      // Verify NCU accumulation
      expect(store.currentNCU).toBe(55); // 25 + 30
      expect(store.availableNCU).toBe(expectedMaxNCU - 55); // 2400 - 55 = 2345
    });

    it('should reject buff when NCU is full and show error', async () => {
      // Swap to a 1200 NCU memory so the 1100 NCU buff nearly fills it
      await equipNcuMemory(1200);
      expect(store.maxNCU).toBe(1200);

      // Cast the high NCU buff first to consume most NCU
      await store.castBuff(buffHighNCU);
      await nextTick();

      const ncuBeforeCast = store.currentNCU;
      const buffCountBefore = store.activeProfile?.buffs?.length || 0;
      expect(buffCountBefore).toBe(1);
      expect(ncuBeforeCast).toBe(1100);

      // Only 1200 - 1100 = 100 NCU left: a 200 NCU buff must be rejected
      expect(store.availableNCU).toBe(100);
      const buffTooLarge = createBuffItem({
        id: 9999,
        name: 'Too Large Buff',
        stats: [
          { id: 1, stat: 54, value: 200 }, // Requires 200 NCU, but only 100 available
          { id: 2, stat: 75, value: 9999 }, // Unique strain
          { id: 3, stat: 551, value: 100 },
        ],
      });

      await store.castBuff(buffTooLarge);
      await nextTick();

      // Verify buff was NOT added
      const profileAfter = store.activeProfile;
      expect(profileAfter?.buffs?.length).toBe(buffCountBefore);

      // Verify NCU didn't change
      expect(store.currentNCU).toBe(ncuBeforeCast);

      // Verify error toast was shown
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          summary: 'Insufficient NCU',
        })
      );
    });

    it('should calculate canCastBuff correctly based on available NCU', async () => {
      await equipNcuMemory(1200);
      expect(store.maxNCU).toBe(1200);

      // Both fit into an empty 1200 NCU
      expect(store.canCastBuff(buffLowNCU)).toBe(true); // 25 NCU
      expect(store.canCastBuff(buffHighNCU)).toBe(true); // 1100 NCU

      // With 1100 used, only 100 NCU remain
      await store.castBuff(buffHighNCU);
      await nextTick();
      expect(store.canCastBuff(buffLowNCU)).toBe(true);
      expect(
        store.canCastBuff(
          createBuffItem({
            id: 1007,
            name: 'Wide Buff',
            stats: [
              { id: 1, stat: 54, value: 101 },
              { id: 2, stat: 75, value: 7000 },
              { id: 3, stat: 551, value: 100 },
            ],
          })
        )
      ).toBe(false);
    });
  });

  describe('NanoStrain Conflicts', () => {
    it('should replace existing buff when casting higher priority buff with same strain', async () => {
      // Cast initial buff
      await store.castBuff(buffLowNCU);
      await nextTick();

      expect(store.activeProfile?.buffs?.length).toBe(1);
      expect(store.activeProfile?.buffs?.[0].id).toBe(buffLowNCU.id);
      expect(store.currentNCU).toBe(25);

      // Cast higher priority buff with same strain
      await store.castBuff(buffSameStrainHighPriority);
      await nextTick();

      // Verify old buff was replaced
      const profile = store.activeProfile;
      expect(profile?.buffs?.length).toBe(1);
      expect(profile?.buffs?.[0].id).toBe(buffSameStrainHighPriority.id);
      expect(profile?.buffs?.[0].name).toBe('Iron Circle Superior');

      // Verify NCU updated to new buff's cost
      expect(store.currentNCU).toBe(35);
    });

    it('should reject lower priority buff when higher priority buff exists with same strain', async () => {
      // Cast higher priority buff first
      await store.castBuff(buffSameStrainHighPriority);
      await nextTick();

      expect(store.activeProfile?.buffs?.length).toBe(1);
      expect(store.currentNCU).toBe(35);

      // Try to cast lower priority buff with same strain
      await store.castBuff(buffSameStrainLowPriority);
      await nextTick();

      // Verify original buff remains
      const profile = store.activeProfile;
      expect(profile?.buffs?.length).toBe(1);
      expect(profile?.buffs?.[0].id).toBe(buffSameStrainHighPriority.id);

      // Verify NCU didn't change
      expect(store.currentNCU).toBe(35);

      // Verify error toast was shown
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          summary: 'Buff Conflict',
        })
      );
    });

    it('should allow multiple buffs with different strains to coexist', async () => {
      // Cast three buffs with different strains
      await store.castBuff(buffLowNCU); // Strain 1000
      await nextTick();

      await store.castBuff(buffMediumNCU); // Strain 2000
      await nextTick();

      const buffDifferentStrain = createBuffItem({
        id: 1006,
        name: 'Different Strain Buff',
        stats: [
          { id: 1, stat: 54, value: 40 },
          { id: 2, stat: 75, value: 3000 }, // Unique strain
          { id: 3, stat: 551, value: 100 },
        ],
      });

      await store.castBuff(buffDifferentStrain);
      await nextTick();

      // Verify all three buffs are active
      const profile = store.activeProfile;
      expect(profile?.buffs?.length).toBe(3);

      // Verify NCU accumulation
      expect(store.currentNCU).toBe(95); // 25 + 30 + 40
    });

    it('should detect strain conflicts correctly with getBuffConflicts', async () => {
      // Cast initial buff
      await store.castBuff(buffLowNCU);
      await nextTick();

      // Check conflicts for buff with same strain
      const conflicts = store.getBuffConflicts(buffSameStrainHighPriority);
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].id).toBe(buffLowNCU.id);

      // Check conflicts for buff with different strain
      const noConflicts = store.getBuffConflicts(buffMediumNCU);
      expect(noConflicts.length).toBe(0);
    });
  });

  describe('Buff Removal', () => {
    it('should remove a specific buff and decrease NCU', async () => {
      // Cast two buffs
      await store.castBuff(buffLowNCU);
      await store.castBuff(buffMediumNCU);
      await nextTick();

      expect(store.currentNCU).toBe(55);
      expect(store.activeProfile?.buffs?.length).toBe(2);

      // Remove first buff
      await store.removeBuff(buffLowNCU.id);
      await nextTick();

      // Verify buff was removed
      const profile = store.activeProfile;
      expect(profile?.buffs?.length).toBe(1);
      expect(profile?.buffs?.[0].id).toBe(buffMediumNCU.id);

      // Verify NCU decreased
      // MaxNCU 2400, with 30 NCU used = 2370 available
      const expectedMaxNCU = 2400;
      expect(store.currentNCU).toBe(30);
      expect(store.availableNCU).toBe(expectedMaxNCU - 30); // 2370

      // Verify success toast
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'success',
          summary: 'Buff Removed',
        })
      );
    });

    it('should remove all buffs and return NCU to 0', async () => {
      // Cast multiple buffs
      await store.castBuff(buffLowNCU);
      await store.castBuff(buffMediumNCU);
      await nextTick();

      expect(store.currentNCU).toBe(55);
      expect(store.activeProfile?.buffs?.length).toBe(2);

      // Remove all buffs
      await store.removeAllBuffs();
      await nextTick();

      // Verify all buffs removed
      const profile = store.activeProfile;
      expect(profile?.buffs?.length).toBe(0);

      // Verify NCU reset
      const expectedMaxNCU = 2400;
      expect(store.currentNCU).toBe(0);
      expect(store.availableNCU).toBe(expectedMaxNCU); // 2400

      // Verify success toast
      expect(mockToast.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'success',
          summary: 'All Buffs Removed',
        })
      );
    });

    it('should handle removing non-existent buff gracefully', async () => {
      await store.castBuff(buffLowNCU);
      await nextTick();

      const buffCountBefore = store.activeProfile?.buffs?.length || 0;

      // Try to remove buff that doesn't exist
      await store.removeBuff(99999);
      await nextTick();

      // Verify nothing changed
      expect(store.activeProfile?.buffs?.length).toBe(buffCountBefore);
    });

    it('should handle removing from empty buff list gracefully', async () => {
      // No buffs cast
      expect(store.activeProfile?.buffs?.length).toBe(0);

      // Try to remove buff
      await store.removeBuff(buffLowNCU.id);
      await nextTick();

      // Should not error
      expect(store.activeProfile?.buffs?.length).toBe(0);
    });
  });

  describe('Profile Switching', () => {
    it('should show correct buffs for each profile after switching', async () => {
      // Create a second character with its own NCU memory
      const profileId2 = await createCharacter('Second Character', {
        level: 150,
        profession: PROFESSION.DOCTOR,
        breed: BREED.ATROX,
        maxNCU: 2100,
      });

      // Cast buff on first profile
      await store.setActiveProfile(profileId);
      await nextTick();

      await store.castBuff(buffLowNCU);
      await nextTick();

      expect(store.activeProfile?.buffs?.length).toBe(1);
      expect(store.currentNCU).toBe(25);

      // Switch to second profile
      await store.setActiveProfile(profileId2);
      await nextTick();

      // Verify second profile has no buffs
      // Second character wears a 2100 NCU memory
      const expectedMaxNCU2 = 2100;
      expect(store.activeProfile?.buffs?.length).toBe(0);
      expect(store.currentNCU).toBe(0);
      expect(store.maxNCU).toBe(expectedMaxNCU2); // 2100

      // Cast different buff on second profile
      await store.castBuff(buffMediumNCU);
      await nextTick();

      expect(store.activeProfile?.buffs?.length).toBe(1);
      expect(store.activeProfile?.buffs?.[0].id).toBe(buffMediumNCU.id);
      expect(store.currentNCU).toBe(30);

      // Switch back to first profile
      await store.setActiveProfile(profileId);
      await nextTick();

      // Verify first profile still has its original buff
      expect(store.activeProfile?.buffs?.length).toBe(1);
      expect(store.activeProfile?.buffs?.[0].id).toBe(buffLowNCU.id);
      expect(store.currentNCU).toBe(25);
    });

    it('should not leak buffs between profiles', async () => {
      // Create a second character with its own NCU memory
      const profileId2 = await createCharacter('Isolated Profile', {
        level: 100,
        profession: PROFESSION.ENFORCER,
        breed: BREED.NANOMAGE,
        maxNCU: 1800,
      });

      // Cast multiple buffs on first profile
      await store.setActiveProfile(profileId);
      await nextTick();

      await store.castBuff(buffLowNCU);
      await store.castBuff(buffMediumNCU);
      await nextTick();

      const profile1BuffIds = store.activeProfile?.buffs?.map((b) => b.id) || [];
      expect(profile1BuffIds).toHaveLength(2);

      // Switch to second profile
      await store.setActiveProfile(profileId2);
      await nextTick();

      // Verify second profile is clean
      expect(store.activeProfile?.buffs?.length).toBe(0);

      // Verify no buff IDs from profile 1 leaked
      const profile2BuffIds = store.activeProfile?.buffs?.map((b) => b.id) || [];
      for (const id of profile1BuffIds) {
        expect(profile2BuffIds).not.toContain(id);
      }
    });

    it('should maintain NCU calculations correctly per profile', async () => {
      // Create a second character with its own NCU memory
      const profileId2 = await createCharacter('Low NCU Character', {
        level: 50,
        profession: PROFESSION.SOLDIER,
        breed: BREED.SOLITUS,
        maxNCU: 1500,
      });

      // Profile 1 wears a 2400 NCU memory
      const expectedMaxNCU1 = 2400;
      await store.setActiveProfile(profileId);
      await nextTick();
      expect(store.maxNCU).toBe(expectedMaxNCU1); // 2400

      await store.castBuff(buffLowNCU);
      await nextTick();
      expect(store.availableNCU).toBe(expectedMaxNCU1 - 25); // 2375

      // Switch to profile 2, which wears a 1500 NCU memory
      const expectedMaxNCU2 = 1500;
      await store.setActiveProfile(profileId2);
      await nextTick();
      expect(store.maxNCU).toBe(expectedMaxNCU2); // 1500
      expect(store.availableNCU).toBe(expectedMaxNCU2); // 1500

      // Cast buff on profile 2
      await store.castBuff(buffLowNCU);
      await nextTick();
      expect(store.currentNCU).toBe(25);
      expect(store.availableNCU).toBe(expectedMaxNCU2 - 25); // 1475

      // Switch back to profile 1
      await store.setActiveProfile(profileId);
      await nextTick();
      expect(store.maxNCU).toBe(expectedMaxNCU1); // 2400
      expect(store.currentNCU).toBe(25);
      expect(store.availableNCU).toBe(expectedMaxNCU1 - 25); // 2375
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle buff with missing NCU stat gracefully', async () => {
      const buffNoNCU = createBuffItem({
        id: 2001,
        name: 'Broken Buff',
        stats: [
          { id: 2, stat: 75, value: 5000 }, // Has strain but no NCU stat
          { id: 3, stat: 551, value: 100 },
        ],
      });

      await store.castBuff(buffNoNCU);
      await nextTick();

      // Should treat as 0 NCU cost
      expect(store.activeProfile?.buffs?.length).toBe(1);
      expect(store.currentNCU).toBe(0);
    });

    it('should handle buff with missing strain stat gracefully', async () => {
      const buffNoStrain = createBuffItem({
        id: 2002,
        name: 'Strainless Buff',
        stats: [
          { id: 1, stat: 54, value: 30 }, // Has NCU but no strain
        ],
      });

      await store.castBuff(buffNoStrain);
      await nextTick();

      // Should still cast successfully
      expect(store.activeProfile?.buffs?.length).toBe(1);
      expect(store.currentNCU).toBe(30);
    });

    it('should handle buff with equal stacking priority correctly', async () => {
      const buffEqualPriority = createBuffItem({
        id: 2003,
        name: 'Equal Priority Buff',
        stats: [
          { id: 1, stat: 54, value: 30 },
          { id: 2, stat: 75, value: 1000 }, // Same strain as buffLowNCU
          { id: 3, stat: 551, value: 100 }, // EQUAL priority to buffLowNCU
        ],
      });

      // Cast first buff
      await store.castBuff(buffLowNCU);
      await nextTick();
      expect(store.activeProfile?.buffs?.length).toBe(1);

      // Cast buff with equal priority
      await store.castBuff(buffEqualPriority);
      await nextTick();

      // Should replace (new replaces existing when equal)
      expect(store.activeProfile?.buffs?.length).toBe(1);
      expect(store.activeProfile?.buffs?.[0].id).toBe(buffEqualPriority.id);
    });

    it('should persist buffs to localStorage correctly', async () => {
      // Cast buffs
      await store.castBuff(buffLowNCU);
      await store.castBuff(buffMediumNCU);
      await nextTick();

      const buffCount = store.activeProfile?.buffs?.length || 0;
      expect(buffCount).toBe(2);

      // Verify persistence by creating new store instance
      const newPinia = createPinia();
      setActivePinia(newPinia);
      const newStore = useTinkerProfilesStore();

      // Load the profile
      const loadedProfile = await newStore.loadProfile(profileId);

      // Verify buffs persisted
      expect(loadedProfile?.buffs?.length).toBe(2);
    });
  });
});

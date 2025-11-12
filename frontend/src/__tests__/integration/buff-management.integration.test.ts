/**
 * Buff Management Integration Tests
 *
 * Integration tests for buff management covering NCU tracking, NanoStrain conflict
 * resolution, and buff stacking. Tests through real components and store interactions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import type { Item } from '@/types/api';
import { BREED, PROFESSION } from '@/__tests__/helpers';

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

    // Create a test profile with MaxNCU skill set
    const testProfile = {
      Character: {
        Name: 'Test Character',
        Level: 200,
        Profession: PROFESSION.ADVENTURER,
        Breed: BREED.SOLITUS,
        Faction: 'Neutral',
        Expansion: 'Shadow Lands',
        AccountType: 'Paid',
        MaxHealth: 2000,
        MaxNano: 1000,
      },
      Skills: {},
      skills: {
        // MaxNCU is skill ID 181 - set proper structure for IP integrator
        181: {
          base: 1200, // Base value that won't be overwritten
          trickle: 0,
          pointsFromIp: 0,
          equipmentBonus: 0,
          perkBonus: 0,
          buffBonus: 0,
          ipSpent: 0,
          cap: 2000,
          total: 1200,
        },
      },
      Clothing: {},
      Weapons: {},
      Implants: {},
      buffs: [], // Start with no buffs
    };

    // Create profile using the store's createProfile method (omit PerksAndResearch - will be created automatically)
    profileId = await store.createProfile('Test Character', testProfile);

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

      // MaxNCU for level 200 character = 1200 + (200 * 6) = 2400
      const expectedMaxNCU = 1200 + 200 * 6;
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
      // MaxNCU for level 200 character = 1200 + (200 * 6) = 2400
      const expectedMaxNCU = 1200 + 200 * 6;

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
      // Create a level 1 character to get minimal MaxNCU
      // Level 1 MaxNCU = 1200 + (1 * 6) = 1206
      // With buffLowNCU (25) + buffMediumNCU (30) = 55 NCU used
      // Available = 1206 - 55 = 1151 NCU
      // buffHighNCU requires 1100 NCU, which would still fit!
      // So we need to create a character where MaxNCU < 1100 + 55 = 1155
      // That would require a negative level, which isn't possible.
      // Instead, let's test by filling the NCU completely with smaller buffs first

      // Set to level 1 for minimal MaxNCU
      const profile = await store.loadProfile(profileId);
      if (profile) {
        profile.Character.Level = 1;
        await store.updateProfile(profileId, profile);
        await store.setActiveProfile(profileId); // Reload with new MaxNCU
      }
      await nextTick();

      const expectedMaxNCU = 1200 + 1 * 6; // 1206
      expect(store.maxNCU).toBe(expectedMaxNCU);

      // Cast the high NCU buff first to consume most NCU
      await store.castBuff(buffHighNCU);
      await nextTick();

      const ncuBeforeCast = store.currentNCU;
      const buffCountBefore = store.activeProfile?.buffs?.length || 0;
      expect(buffCountBefore).toBe(1);
      expect(ncuBeforeCast).toBe(1100);

      // Now try to cast buffMediumNCU which requires 30 NCU
      // Available = 1206 - 1100 = 106 NCU, so this should succeed
      // Let's try buffHighNCU again (same strain, so it might replace or fail)
      // Actually, let's create a new buff that requires more than available
      const buffTooLarge = createBuffItem({
        id: 9999,
        name: 'Too Large Buff',
        stats: [
          { id: 1, stat: 54, value: 200 }, // Requires 200 NCU, but only 106 available
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
      // Temporarily set character to level 1 to test with low MaxNCU
      // Level 1 MaxNCU = 1200 + (1 * 6) = 1206
      const profile = await store.loadProfile(profileId);
      if (profile) {
        profile.Character.Level = 1;
        await store.updateProfile(profileId, profile);
        await store.setActiveProfile(profileId); // Reload with new MaxNCU
      }
      await nextTick();

      const expectedMaxNCU = 1200 + 1 * 6; // 1206
      expect(store.maxNCU).toBe(expectedMaxNCU);

      // With MaxNCU of 1206, should be able to cast low NCU buff (25 NCU)
      expect(store.canCastBuff(buffLowNCU)).toBe(true);
      // But not high NCU buff (1100 NCU) - while technically possible, let's check
      // Actually 1100 < 1206, so it should be castable
      expect(store.canCastBuff(buffHighNCU)).toBe(true);
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
      // MaxNCU for level 200 = 2400, with 30 NCU used = 2370 available
      const expectedMaxNCU = 1200 + 200 * 6;
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
      // MaxNCU for level 200 = 2400
      const expectedMaxNCU = 1200 + 200 * 6;
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
      // Create second profile
      const profile2Data = {
        Character: {
          Name: 'Second Character',
          Level: 150,
          Profession: PROFESSION.DOCTOR,
          Breed: BREED.ATROX,
          Faction: 'Clan',
          Expansion: 'Shadow Lands',
          AccountType: 'Paid',
          MaxHealth: 1500,
          MaxNano: 800,
        },
        Skills: {},
        skills: {
          181: {
            base: 1000,
            trickle: 0,
            pointsFromIp: 0,
            equipmentBonus: 0,
            perkBonus: 0,
            buffBonus: 0,
            ipSpent: 0,
            cap: 2000,
            total: 1000,
          },
        },
        Clothing: {},
        Weapons: {},
        Implants: {},
        buffs: [],
      };

      const profileId2 = await store.createProfile('Second Character', profile2Data);

      // Fix MaxNCU after creation
      const prof2 = await store.loadProfile(profileId2);
      if (prof2 && prof2.skills && prof2.skills[181]) {
        prof2.skills[181].base = 1000;
        prof2.skills[181].total = 1000;
        await store.updateProfile(profileId2, prof2);
      }

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
      // MaxNCU for level 150 character = 1200 + (150 * 6) = 2100
      const expectedMaxNCU2 = 1200 + 150 * 6;
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
      // Create second profile
      const profile2Data = {
        Character: {
          Name: 'Isolated Profile',
          Level: 100,
          Profession: PROFESSION.ENFORCER,
          Breed: BREED.NANOMAGE,
          Faction: 'Neutral',
          Expansion: 'Shadow Lands',
          AccountType: 'Paid',
          MaxHealth: 1000,
          MaxNano: 500,
        },
        Skills: {},
        skills: {
          181: {
            base: 800,
            trickle: 0,
            pointsFromIp: 0,
            equipmentBonus: 0,
            perkBonus: 0,
            buffBonus: 0,
            ipSpent: 0,
            cap: 2000,
            total: 800,
          },
        },
        Clothing: {},
        Weapons: {},
        Implants: {},
        buffs: [],
      };

      const profileId2 = await store.createProfile('Isolated Profile', profile2Data);

      // Fix MaxNCU after creation
      const prof2 = await store.loadProfile(profileId2);
      if (prof2 && prof2.skills && prof2.skills[181]) {
        prof2.skills[181].base = 800;
        prof2.skills[181].total = 800;
        await store.updateProfile(profileId2, prof2);
      }

      // Cast multiple buffs on first profile
      await store.setActiveProfile(profileId);
      await nextTick();

      await store.castBuff(buffLowNCU);
      await store.castBuff(buffMediumNCU);
      await nextTick();

      const profile1BuffCount = store.activeProfile?.buffs?.length || 0;
      const profile1BuffIds = store.activeProfile?.buffs?.map((b) => b.id) || [];

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
      // Create profile with different MaxNCU
      const profile2Data = {
        Character: {
          Name: 'Low NCU Character',
          Level: 50,
          Profession: PROFESSION.SOLDIER,
          Breed: BREED.SOLITUS,
          Faction: 'Omni',
          Expansion: 'Shadow Lands',
          AccountType: 'Paid',
          MaxHealth: 800,
          MaxNano: 300,
        },
        Skills: {},
        skills: {
          181: {
            base: 500,
            trickle: 0,
            pointsFromIp: 0,
            equipmentBonus: 0,
            perkBonus: 0,
            buffBonus: 0,
            ipSpent: 0,
            cap: 2000,
            total: 500,
          },
        },
        Clothing: {},
        Weapons: {},
        Implants: {},
        buffs: [],
      };

      const profileId2 = await store.createProfile('Low NCU Character', profile2Data);

      // Fix MaxNCU after creation
      const prof2 = await store.loadProfile(profileId2);
      if (prof2 && prof2.skills && prof2.skills[181]) {
        prof2.skills[181].base = 500;
        prof2.skills[181].total = 500;
        await store.updateProfile(profileId2, prof2);
      }

      // Profile 1 (level 200) has MaxNCU = 1200 + (200 * 6) = 2400
      const expectedMaxNCU1 = 1200 + 200 * 6;
      await store.setActiveProfile(profileId);
      await nextTick();
      expect(store.maxNCU).toBe(expectedMaxNCU1); // 2400

      await store.castBuff(buffLowNCU);
      await nextTick();
      expect(store.availableNCU).toBe(expectedMaxNCU1 - 25); // 2375

      // Switch to profile 2 (level 50) with MaxNCU = 1200 + (50 * 6) = 1500
      const expectedMaxNCU2 = 1200 + 50 * 6;
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

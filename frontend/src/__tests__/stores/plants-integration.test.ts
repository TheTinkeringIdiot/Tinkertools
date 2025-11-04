/**
 * Plants Store Unit Tests
 *
 * UNIT TEST - Uses mocks, not real backend
 * Strategy: Already uses mocked API client correctly
 *
 * Tests integration between TinkerPlants and related stores using mocks
 *
 * Note: This file is named "integration" but actually uses mocks.
 * It tests store logic in isolation, not real API integration.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { useSymbiantsStore } from '@/stores/symbiants';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import type { PlantSymbiant, CharacterBuild, CharacterStats } from '@/types/plants';

// Mock API client for unit testing
vi.mock('@/services/api-client', () => ({
  apiClient: {
    searchSymbiants: vi.fn(() =>
      Promise.resolve({
        success: true,
        data: [
          {
            id: 1,
            aoid: 101,
            name: 'Seeker Head Unit',
            family: 'Seeker',
          },
          {
            id: 2,
            aoid: 102,
            name: 'Hacker Chest Unit',
            family: 'Hacker',
          },
        ],
        pagination: {
          page: 1,
          limit: 100,
          total: 2,
          hasNext: false,
          hasPrev: false,
        },
      })
    ),
    getSymbiant: vi.fn((id: number) =>
      Promise.resolve({
        success: true,
        data: {
          id,
          aoid: 100 + id,
          name: `Test Symbiant ${id}`,
          family: 'Test',
        },
      })
    ),
  },
}));

// Mock localStorage
const localStorageData: Record<string, string> = {
  tinkerplants_builds: JSON.stringify([
    {
      id: 'build1',
      name: 'Test Build',
      symbiants: {
        head: {
          id: 1,
          aoid: 101,
          name: 'Test Head Symbiant',
        },
      },
      totalStats: { strength: 450 },
      createdAt: '2024-01-01T00:00:00.000Z',
    },
  ]),
};

global.localStorage = {
  getItem: vi.fn((key: string) => {
    return localStorageData[key] || null;
  }),
  setItem: vi.fn((key: string, value: string) => {
    localStorageData[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageData[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageData).forEach((key) => delete localStorageData[key]);
  }),
  length: 0,
  key: vi.fn(),
} as any;

describe('Plants Store Unit Tests', () => {
  let symbiantsStore: any;
  let profilesStore: any;

  beforeEach(async () => {
    // Setup PrimeVue with ToastService for stores
    const app = createApp({});
    app.use(PrimeVue);
    app.use(ToastService);

    // Reset localStorage data for each test
    Object.keys(localStorageData).forEach((key) => {
      if (key.startsWith('tinkertools_profile')) {
        delete localStorageData[key];
      }
    });

    const pinia = createPinia();
    setActivePinia(pinia);
    app.use(pinia);

    symbiantsStore = useSymbiantsStore();
    profilesStore = useTinkerProfilesStore();

    // Initialize profile manager
    await profilesStore.loadProfiles();
  });

  describe('Symbiants Store Integration', () => {
    it('loads symbiants for plants use', async () => {
      await symbiantsStore.loadAllSymbiants();

      expect(symbiantsStore.allSymbiants.length).toBeGreaterThan(0);
      expect(symbiantsStore.symbiantFamilies.length).toBeGreaterThan(0);
    });

    it('provides symbiant family organization', async () => {
      await symbiantsStore.loadAllSymbiants();

      const familyMap = symbiantsStore.symbiantsByFamilyMap;
      expect(familyMap.size).toBeGreaterThan(0);

      // Each family should have symbiants
      familyMap.forEach((symbiants: any[], family: string) => {
        expect(symbiants.length).toBeGreaterThan(0);
        expect(typeof family).toBe('string');
      });
    });

    it('searches symbiants with filtering capabilities', async () => {
      const searchResults = await symbiantsStore.searchSymbiants({
        family: 'Seeker',
        limit: 10,
      });

      expect(Array.isArray(searchResults)).toBe(true);
      expect(symbiantsStore.currentSearchResults.length).toBeGreaterThanOrEqual(0);
    });

    it('retrieves individual symbiant details', async () => {
      const symbiant = await symbiantsStore.getSymbiant(1);

      expect(symbiant).toBeTruthy();
      expect(symbiant.id).toBe(1);
      expect(symbiant.name).toBeDefined();
    });

    it('provides symbiant statistics for UI', () => {
      const stats = symbiantsStore.getStats;

      expect(stats.totalSymbiants).toBeDefined();
      expect(stats.uniqueFamilies).toBeDefined();
      expect(stats.familyBreakdown).toBeDefined();
    });

    it('caches symbiants for performance', async () => {
      // First load
      await symbiantsStore.loadAllSymbiants();
      const firstLoadTime = Date.now();

      // Second load should use cache
      await symbiantsStore.loadAllSymbiants();
      const secondLoadTime = Date.now();

      expect(symbiantsStore.symbiants.size).toBeGreaterThan(0);
      // Cache should make second load faster (not a perfect test, but indicative)
      expect(secondLoadTime - firstLoadTime).toBeLessThan(100);
    });
  });

  describe('Profiles Store Integration', () => {
    it('loads character profiles for plants use', () => {
      // Profile manager is initialized in beforeEach
      expect(profilesStore.profileMetadata.length).toBeGreaterThanOrEqual(0);
    });

    it('manages active profile selection', async () => {
      // Create a test profile with proper structure
      const profileId = await profilesStore.createProfile('Test Doctor', {
        Character: {
          Profession: 10, // Doctor
          Breed: 1, // Solitus
          Level: 100,
        },
      });

      // Set the profile as active (async operation)
      await profilesStore.setActiveProfile(profileId);

      expect(profilesStore.activeProfile).toBeTruthy();
      expect(profilesStore.activeProfileId).toBe(profileId);
    });

    it('clears active profile', async () => {
      // Create a test profile
      const profileId = await profilesStore.createProfile('Test Character', {
        Character: {
          Profession: 6, // Adventurer
          Breed: 1, // Solitus
          Level: 50,
        },
      });

      // Set it as active (async operation)
      await profilesStore.setActiveProfile(profileId);
      expect(profilesStore.activeProfile).toBeTruthy();

      // Clear active profile (async operation)
      await profilesStore.clearActiveProfile();
      expect(profilesStore.activeProfile).toBeNull();
    });

    it('provides profile statistics for character building', async () => {
      // Create a test profile with proper structure
      const profileId = await profilesStore.createProfile('Test Soldier', {
        Character: {
          Profession: 1, // Soldier
          Breed: 1, // Solitus
          Level: 150,
        },
      });

      const profile = await profilesStore.loadProfile(profileId);
      expect(profile).toBeTruthy();
      expect(profile!.Character.Level).toBe(150);
      expect(typeof profile!.Character.Profession).toBe('number');
    });
  });

  describe('Build Persistence Integration', () => {
    it('loads saved builds from localStorage', () => {
      const savedBuildsJson = localStorage.getItem('tinkerplants_builds');
      expect(savedBuildsJson).toBeTruthy();

      const savedBuilds = JSON.parse(savedBuildsJson!);
      expect(Array.isArray(savedBuilds)).toBe(true);
      expect(savedBuilds.length).toBeGreaterThan(0);

      const build = savedBuilds[0];
      expect(build.id).toBeDefined();
      expect(build.name).toBeDefined();
      expect(build.symbiants).toBeDefined();
    });

    it('saves builds to localStorage', () => {
      const testBuild: CharacterBuild = {
        id: 'new-build',
        name: 'New Test Build',
        symbiants: {
          chest: {
            id: 2,
            aoid: 102,
            name: 'Test Chest Symbiant',
            family: 'Hacker',
            slot: 'chest',
          },
        },
        totalStats: { intelligence: 375 },
        createdAt: new Date().toISOString(),
      };

      const existingBuilds = JSON.parse(localStorage.getItem('tinkerplants_builds') || '[]');
      const updatedBuilds = [...existingBuilds, testBuild];

      localStorage.setItem('tinkerplants_builds', JSON.stringify(updatedBuilds));

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'tinkerplants_builds',
        expect.stringContaining('New Test Build')
      );
    });

    it('manages build collections', () => {
      const builds = JSON.parse(localStorage.getItem('tinkerplants_builds') || '[]');

      // Test build operations
      const buildToDelete = builds[0];
      const remainingBuilds = builds.filter((b: CharacterBuild) => b.id !== buildToDelete.id);

      expect(remainingBuilds.length).toBe(builds.length - 1);

      // Test build duplication
      const duplicatedBuild = {
        ...buildToDelete,
        id: `${buildToDelete.id}_copy`,
        name: `${buildToDelete.name} (Copy)`,
      };

      expect(duplicatedBuild.id).not.toBe(buildToDelete.id);
      expect(duplicatedBuild.name).toContain('(Copy)');
    });
  });

  describe('Character Stat Calculations', () => {
    it('calculates base character stats from profile', async () => {
      // Create a proper TinkerProfile with correct structure
      const profileId = await profilesStore.createProfile('Test Soldier', {
        Character: {
          Profession: 1, // Soldier
          Breed: 1, // Solitus
          Level: 150,
        },
      });

      const profile = await profilesStore.loadProfile(profileId);
      expect(profile).toBeTruthy();

      // Check that skills are properly initialized with numeric IDs
      expect(profile!.skills).toBeDefined();
      expect(typeof profile!.skills[16]).toBe('object'); // Strength ability ID
      expect(profile!.skills[16].total).toBeGreaterThan(0);
    });

    it('calculates symbiant stat bonuses', () => {
      const testSymbiant: PlantSymbiant = {
        id: 1,
        aoid: 101,
        name: 'Test Symbiant',
        statBonuses: [
          { statId: 'strength', statName: 'Strength', value: 50, type: 'bonus' },
          { statId: 'agility', statName: 'Agility', value: 25, type: 'bonus' },
        ],
      };

      const bonuses: CharacterStats = {};
      testSymbiant.statBonuses?.forEach((bonus) => {
        bonuses[bonus.statId] = (bonuses[bonus.statId] || 0) + bonus.value;
      });

      expect(bonuses.strength).toBe(50);
      expect(bonuses.agility).toBe(25);
    });

    it('combines base stats with symbiant bonuses', () => {
      const baseStats: CharacterStats = {
        strength: 400,
        agility: 300,
        intelligence: 250,
      };

      const symbiantBonuses: CharacterStats = {
        strength: 50,
        intelligence: 75,
      };

      const totalStats: CharacterStats = { ...baseStats };
      Object.entries(symbiantBonuses).forEach(([statId, bonus]) => {
        totalStats[statId] = (totalStats[statId] || 0) + bonus;
      });

      expect(totalStats.strength).toBe(450); // 400 + 50
      expect(totalStats.agility).toBe(300); // No bonus
      expect(totalStats.intelligence).toBe(325); // 250 + 75
    });

    it('validates stat requirements for symbiants', () => {
      const characterStats: CharacterStats = {
        strength: 400,
        treatment: 1000,
      };

      // Mock symbiant requirement checking
      const checkRequirement = (required: number, current: number) => current >= required;

      expect(checkRequirement(350, characterStats.strength)).toBe(true);
      expect(checkRequirement(500, characterStats.strength)).toBe(false);
      expect(checkRequirement(800, characterStats.treatment)).toBe(true);
    });
  });

  describe('Performance and Caching', () => {
    it('handles large symbiant datasets efficiently', async () => {
      const startTime = Date.now();
      await symbiantsStore.loadAllSymbiants();
      const loadTime = Date.now() - startTime;

      // Should load within reasonable time (adjust threshold as needed)
      expect(loadTime).toBeLessThan(2000);
      expect(symbiantsStore.symbiants.size).toBeGreaterThanOrEqual(0);
    });

    it('uses efficient filtering for large datasets', () => {
      const mockSymbiants: PlantSymbiant[] = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        aoid: 100 + i,
        name: `Test Symbiant ${i}`,
        family: i % 2 === 0 ? 'Even' : 'Odd',
        slot: i % 3 === 0 ? 'head' : 'chest',
      }));

      const startTime = Date.now();

      // Simulate filtering
      const filtered = mockSymbiants.filter((s) => s.family === 'Even' && s.slot === 'head');

      const filterTime = Date.now() - startTime;

      expect(filterTime).toBeLessThan(100); // Should be very fast
      expect(filtered.length).toBeGreaterThan(0);
    });

    it('manages memory efficiently with large builds', () => {
      const largeBuild: CharacterBuild = {
        id: 'large-build',
        name: 'Large Build',
        symbiants: {},
        totalStats: {},
      };

      // Populate all 13 symbiant slots
      const slots = [
        'head',
        'eye',
        'ear',
        'rarm',
        'chest',
        'larm',
        'waist',
        'rwrist',
        'legs',
        'lwrist',
        'rfinger',
        'feet',
        'lfinger',
      ];

      slots.forEach((slot, index) => {
        largeBuild.symbiants[slot] = {
          id: index + 1,
          aoid: 100 + index,
          name: `${slot} symbiant`,
          family: 'Test',
          slot,
          statBonuses: [{ statId: 'strength', statName: 'Strength', value: 10, type: 'bonus' }],
        };
      });

      // Calculate total bonuses
      const totalBonuses: CharacterStats = {};
      Object.values(largeBuild.symbiants).forEach((symbiant) => {
        symbiant.statBonuses?.forEach((bonus) => {
          totalBonuses[bonus.statId] = (totalBonuses[bonus.statId] || 0) + bonus.value;
        });
      });

      expect(Object.keys(largeBuild.symbiants).length).toBe(13);
      expect(totalBonuses.strength).toBe(130); // 13 symbiants * 10 each
    });
  });
});

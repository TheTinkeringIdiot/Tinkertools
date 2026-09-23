/**
 * Plants Store Integration Tests
 *
 * The stores TinkerPlants depends on (symbiants, profiles), run as real Pinia
 * stores with only the API client mocked.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// CRITICAL: Mock API BEFORE store imports
vi.mock('@/services/api-client');

import { setupIntegrationTest } from '../helpers/integration-test-utils';
import { createTestProfile, PROFESSION, BREED } from '../helpers/profile-fixtures';
import { apiClient } from '@/services/api-client';
import { useSymbiantsStore } from '@/stores/symbiants';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import type { PaginatedResponse, Symbiant } from '@/types/api';

function createSymbiant(overrides: Partial<Symbiant> & Pick<Symbiant, 'id'>): Symbiant {
  return {
    aoid: 100 + overrides.id,
    name: `Test Symbiant ${overrides.id}`,
    ql: 100,
    slot_id: 1,
    family: 'Artillery',
    actions: [],
    ...overrides,
  };
}

function symbiantPage(
  items: Symbiant[],
  { page = 1, total = items.length, hasNext = false } = {}
): PaginatedResponse<Symbiant> {
  return {
    items,
    total,
    page,
    page_size: 100,
    pages: hasNext ? page + 1 : page,
    has_next: hasNext,
    has_prev: page > 1,
  };
}

const SYMBIANTS: Symbiant[] = [
  createSymbiant({ id: 1, name: 'Seeker Head Unit', family: 'Artillery' }),
  createSymbiant({ id: 2, name: 'Hacker Chest Unit', family: 'Control' }),
  createSymbiant({ id: 3, name: 'Hacker Eye Unit', family: 'Control' }),
];

describe('Plants Store Integration', () => {
  let symbiantsStore: ReturnType<typeof useSymbiantsStore>;
  let profilesStore: ReturnType<typeof useTinkerProfilesStore>;

  beforeEach(async () => {
    await setupIntegrationTest();

    vi.mocked(apiClient.searchSymbiants).mockResolvedValue(symbiantPage(SYMBIANTS));
    vi.mocked(apiClient.getSymbiant).mockImplementation((id: number) =>
      Promise.resolve({ success: true, data: createSymbiant({ id }) })
    );

    symbiantsStore = useSymbiantsStore();
    profilesStore = useTinkerProfilesStore();

    await profilesStore.loadProfiles();
  });

  describe('Symbiants Store', () => {
    it('loads symbiants for plants use', async () => {
      await symbiantsStore.loadAllSymbiants();

      expect(symbiantsStore.allSymbiants).toHaveLength(3);
      expect(symbiantsStore.symbiantFamilies).toEqual(['Artillery', 'Control']);
    });

    it('provides symbiant family organization', async () => {
      await symbiantsStore.loadAllSymbiants();

      const familyMap = symbiantsStore.symbiantsByFamilyMap;
      expect(familyMap.get('Artillery')?.map((s) => s.id)).toEqual([1]);
      expect(familyMap.get('Control')?.map((s) => s.id)).toEqual([2, 3]);
    });

    it('pages search results', async () => {
      const searchResults = await symbiantsStore.searchSymbiants({ page: 2, limit: 2 });

      expect(searchResults.map((s) => s.id)).toEqual([3]);
    });

    it('retrieves individual symbiant details', async () => {
      const symbiant = await symbiantsStore.getSymbiant(1);

      expect(symbiant).toBeTruthy();
      expect(symbiant?.id).toBe(1);
      expect(symbiant?.name).toBe('Test Symbiant 1');
    });

    it('provides symbiant statistics for UI', async () => {
      await symbiantsStore.loadAllSymbiants();
      const stats = symbiantsStore.getStats;

      expect(stats.totalSymbiants).toBe(3);
      expect(stats.uniqueFamilies).toBe(2);
      expect(stats.familyBreakdown).toEqual({ Artillery: 1, Control: 2 });
    });

    it('serves a second load from the in-memory cache', async () => {
      await symbiantsStore.loadAllSymbiants();
      await symbiantsStore.loadAllSymbiants();

      expect(apiClient.searchSymbiants).toHaveBeenCalledTimes(1);
      expect(symbiantsStore.symbiants.size).toBe(3);
    });

    it('loads every page of a multi-page symbiant list', async () => {
      const firstPage = Array.from({ length: 100 }, (_, i) => createSymbiant({ id: i + 1 }));
      const secondPage = Array.from({ length: 50 }, (_, i) => createSymbiant({ id: i + 101 }));
      vi.mocked(apiClient.searchSymbiants)
        .mockResolvedValueOnce(symbiantPage(firstPage, { total: 150, hasNext: true }))
        .mockResolvedValueOnce(symbiantPage(secondPage, { page: 2, total: 150 }));

      await symbiantsStore.loadAllSymbiants();

      expect(apiClient.searchSymbiants).toHaveBeenCalledTimes(2);
      expect(symbiantsStore.symbiants.size).toBe(150);
      expect(symbiantsStore.loadingProgress).toBe(100);
    });
  });

  describe('Profiles Store', () => {
    it('starts with no profiles', () => {
      expect(profilesStore.profileMetadata).toEqual([]);
    });

    it('manages active profile selection', async () => {
      const { Character } = createTestProfile({
        profession: PROFESSION.DOCTOR,
        breed: BREED.SOLITUS,
        level: 100,
      });
      const profileId = await profilesStore.createProfile('Test Doctor', { Character });

      await profilesStore.setActiveProfile(profileId);

      expect(profilesStore.activeProfile).toBeTruthy();
      expect(profilesStore.activeProfileId).toBe(profileId);
    });

    it('clears active profile', async () => {
      const { Character } = createTestProfile({
        profession: PROFESSION.ADVENTURER,
        breed: BREED.SOLITUS,
        level: 50,
      });
      const profileId = await profilesStore.createProfile('Test Character', { Character });

      await profilesStore.setActiveProfile(profileId);
      expect(profilesStore.activeProfile).toBeTruthy();

      await profilesStore.clearActiveProfile();
      expect(profilesStore.activeProfile).toBeNull();
    });

    it('provides profile statistics for character building', async () => {
      const { Character } = createTestProfile({
        profession: PROFESSION.SOLDIER,
        breed: BREED.SOLITUS,
        level: 150,
      });
      const profileId = await profilesStore.createProfile('Test Soldier', { Character });

      const profile = await profilesStore.loadProfile(profileId);
      expect(profile).toBeTruthy();
      expect(profile!.Character.Level).toBe(150);
      expect(profile!.Character.Profession).toBe(PROFESSION.SOLDIER);
    });

    it('calculates base character stats from profile', async () => {
      const { Character } = createTestProfile({
        profession: PROFESSION.SOLDIER,
        breed: BREED.SOLITUS,
        level: 150,
      });
      const profileId = await profilesStore.createProfile('Test Soldier', { Character });

      const profile = await profilesStore.loadProfile(profileId);
      expect(profile).toBeTruthy();

      // Skills are keyed by numeric stat ID; 16 is Strength
      expect(typeof profile!.skills[16]).toBe('object');
      expect(profile!.skills[16].total).toBeGreaterThan(0);
    });
  });
});

/**
 * User data is keyed by AOID.
 *
 * Nano favorites and the symbiant farm list are read and written as AOIDs,
 * and what players stored before that (internal row ids) is migrated once:
 *
 *   - ids the backend resolves become AOIDs;
 *   - ids it cannot resolve are left out, and the original list is kept under
 *     a backup key;
 *   - a migrated list is never migrated again;
 *   - nothing is lost while the backend cannot be reached.
 *
 * Real stores and real storage; only the API client is mocked.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// CRITICAL: mock the API before any store import pulls it in.
vi.mock('@/services/api-client');

// jsdom has no IndexedDB: back idb-keyval with an in-memory map.
vi.mock('idb-keyval', () => {
  const entries = new Map<IDBValidKey, unknown>();
  return {
    get: vi.fn((key: IDBValidKey) => Promise.resolve(entries.get(key))),
    set: vi.fn((key: IDBValidKey, value: unknown) => {
      entries.set(key, value);
      return Promise.resolve();
    }),
    del: vi.fn((key: IDBValidKey) => {
      entries.delete(key);
      return Promise.resolve();
    }),
    keys: vi.fn(() => Promise.resolve(Array.from(entries.keys()))),
  };
});

import { setupIntegrationTest } from '../helpers/integration-test-utils';
import { TEST_VERSION, TEST_ALT_VERSION } from '../helpers/version-fixtures';
import { setCurrentVersion } from '@/composables/useGameVersion';
import { apiClient } from '@/services/api-client';
import { internalIdBackupKey } from '@/services/legacy-id-migration';
import { versionKey } from '@/services/version-keys';
import { useNanosStore } from '@/stores/nanosStore';
import { useSymbiantsStore } from '@/stores/symbiants';
import type { Mob, Symbiant } from '@/types/api';

const FAVORITES_BASE = 'tinkertools_nano_favorites';
const FARM_LIST_BASE = 'tinkertools-farm-list';
const FARM_PROGRESS_BASE = 'tinkertools-farm-progress';

const favoritesKey = (slug = TEST_VERSION) => versionKey(FAVORITES_BASE, slug);
const farmListKey = (slug = TEST_VERSION) => versionKey(FARM_LIST_BASE, slug);

function stored(key: string): unknown {
  const raw = localStorage.getItem(key);
  return raw === null ? null : JSON.parse(raw);
}

/** The backend knows these internal ids, and no others. */
function backendResolves(known: Record<number, number>) {
  vi.mocked(apiClient.resolveLegacyItemIds).mockImplementation(async (ids: number[]) => {
    const resolved = new Map<number, number>();
    for (const id of ids) {
      if (id in known) resolved.set(id, known[id]);
    }
    return resolved;
  });
}

function symbiant(aoid: number, name: string): Symbiant {
  return { aoid, name, ql: 200, slot_id: 2, family: 'Artillery', actions: [] };
}

function boss(id: number, name: string): Mob {
  return {
    id,
    name,
    level: 200,
    playfield: 'Inferno',
    location: '',
    mob_names: [],
    is_pocket_boss: true,
  };
}

describe('User data keyed by AOID', () => {
  beforeEach(async () => {
    await setupIntegrationTest();
    await setCurrentVersion(TEST_VERSION);
    localStorage.clear();
    vi.mocked(apiClient.resolveLegacyItemIds).mockReset();
    backendResolves({});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    await setCurrentVersion(TEST_VERSION);
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Nano favorites
  // ==========================================================================

  describe('nano favorites', () => {
    it('are stored as AOIDs and read back by AOID', () => {
      const store = useNanosStore();

      store.toggleFavorite(246660);
      store.addToFavorites(29246);

      expect(stored(favoritesKey())).toEqual({ version: 2, aoids: [246660, 29246] });

      // What a later visit reads
      store.resetForVersionChange();

      expect(store.favorites).toEqual([246660, 29246]);
      expect(store.isFavorite(246660)).toBe(true);
      expect(store.isFavorite(1)).toBe(false);
      expect(apiClient.resolveLegacyItemIds).not.toHaveBeenCalled();
    });

    it('lists the loaded nanos that are favorites by their AOID', () => {
      const store = useNanosStore();
      store.nanos.push(
        { aoid: 246660, name: 'Favorite', school: null, strainId: null, strain: null } as never,
        { aoid: 5, name: 'Other', school: null, strainId: null, strain: null } as never
      );

      store.addToFavorites(246660);

      expect(store.favoriteNanos.map((nano) => nano.name)).toEqual(['Favorite']);
    });

    it('migrates favorites stored as internal ids to AOIDs', async () => {
      localStorage.setItem(favoritesKey(), JSON.stringify([11, 12]));
      backendResolves({ 11: 246660, 12: 29246 });
      const store = useNanosStore();

      store.resetForVersionChange();
      // Until the backend has answered, an internal id is not shown as a favorite
      expect(store.favorites).toEqual([]);
      await store.favoritesReady();

      expect(apiClient.resolveLegacyItemIds).toHaveBeenCalledWith([11, 12], TEST_VERSION);
      expect(store.favorites).toEqual([246660, 29246]);
      expect(stored(favoritesKey())).toEqual({ version: 2, aoids: [246660, 29246] });
      expect(localStorage.getItem(internalIdBackupKey(FAVORITES_BASE, TEST_VERSION))).toBeNull();
    });

    it('migrates favorites saved before versions existed', async () => {
      localStorage.setItem(FAVORITES_BASE, JSON.stringify([11]));
      backendResolves({ 11: 246660 });
      const store = useNanosStore();

      store.resetForVersionChange();
      await store.favoritesReady();

      expect(store.favorites).toEqual([246660]);
      expect(stored(favoritesKey())).toEqual({ version: 2, aoids: [246660] });
      expect(localStorage.getItem(FAVORITES_BASE)).toBeNull();
    });

    it('keeps the original list in a backup key when an id cannot be resolved', async () => {
      localStorage.setItem(favoritesKey(), JSON.stringify([11, 999, 12]));
      backendResolves({ 11: 246660, 12: 29246 });
      const store = useNanosStore();

      store.resetForVersionChange();
      await store.favoritesReady();

      expect(store.favorites).toEqual([246660, 29246]);
      expect(stored(favoritesKey())).toEqual({ version: 2, aoids: [246660, 29246] });
      expect(stored(internalIdBackupKey(FAVORITES_BASE, TEST_VERSION))).toEqual({
        internalIds: [11, 999, 12],
        unresolved: [999],
        resolvedAgainst: TEST_VERSION,
      });
    });

    it('does not migrate again once migrated', async () => {
      localStorage.setItem(favoritesKey(), JSON.stringify([11, 999]));
      backendResolves({ 11: 246660 });
      const store = useNanosStore();
      store.resetForVersionChange();
      await store.favoritesReady();
      const migrated = localStorage.getItem(favoritesKey());
      const backup = localStorage.getItem(internalIdBackupKey(FAVORITES_BASE, TEST_VERSION));
      vi.mocked(apiClient.resolveLegacyItemIds).mockClear();

      store.resetForVersionChange();
      await store.favoritesReady();

      expect(apiClient.resolveLegacyItemIds).not.toHaveBeenCalled();
      expect(store.favorites).toEqual([246660]);
      expect(localStorage.getItem(favoritesKey())).toBe(migrated);
      expect(localStorage.getItem(internalIdBackupKey(FAVORITES_BASE, TEST_VERSION))).toBe(backup);
    });

    it('leaves the stored ids untouched while the backend cannot be reached, then migrates', async () => {
      localStorage.setItem(favoritesKey(), JSON.stringify([11, 12]));
      vi.mocked(apiClient.resolveLegacyItemIds).mockRejectedValue(new Error('offline'));
      const store = useNanosStore();

      store.resetForVersionChange();
      await store.favoritesReady();

      expect(store.favorites).toEqual([]);
      expect(stored(favoritesKey())).toEqual([11, 12]);

      // A favorite added meanwhile is saved without dropping the unmigrated ids
      store.addToFavorites(500);
      expect(stored(favoritesKey())).toEqual({
        version: 2,
        aoids: [500],
        pendingInternalIds: [11, 12],
      });

      // Next visit, with the backend back
      backendResolves({ 11: 246660, 12: 29246 });
      store.resetForVersionChange();
      await store.favoritesReady();

      expect(store.favorites).toEqual([246660, 29246, 500]);
      expect(stored(favoritesKey())).toEqual({ version: 2, aoids: [246660, 29246, 500] });
    });

    it('keeps a favorite added while the migration is running', async () => {
      localStorage.setItem(favoritesKey(), JSON.stringify([11]));
      let answer: (resolved: Map<number, number>) => void = () => {};
      vi.mocked(apiClient.resolveLegacyItemIds).mockReturnValue(
        new Promise((resolve) => {
          answer = resolve;
        })
      );
      const store = useNanosStore();
      store.resetForVersionChange();

      store.addToFavorites(500);
      answer(new Map([[11, 246660]]));
      await store.favoritesReady();

      expect(store.favorites).toEqual([246660, 500]);
      expect(stored(favoritesKey())).toEqual({ version: 2, aoids: [246660, 500] });
    });

    it("resolves each version's ids against that version", async () => {
      localStorage.setItem(favoritesKey(TEST_VERSION), JSON.stringify([11]));
      localStorage.setItem(favoritesKey(TEST_ALT_VERSION), JSON.stringify([11]));
      vi.mocked(apiClient.resolveLegacyItemIds).mockImplementation(
        async (_ids: number[], gameVersion: string) =>
          new Map([[11, gameVersion === TEST_VERSION ? 246660 : 777]])
      );
      const store = useNanosStore();

      store.resetForVersionChange();
      await store.favoritesReady();
      expect(store.favorites).toEqual([246660]);

      await setCurrentVersion(TEST_ALT_VERSION);
      store.resetForVersionChange();
      await store.favoritesReady();

      expect(store.favorites).toEqual([777]);
      expect(stored(favoritesKey(TEST_VERSION))).toEqual({ version: 2, aoids: [246660] });
      expect(stored(favoritesKey(TEST_ALT_VERSION))).toEqual({ version: 2, aoids: [777] });
    });
  });

  // ==========================================================================
  // Symbiant farm list and progress
  // ==========================================================================

  describe('symbiant farm list', () => {
    const OCULAR = symbiant(219135, 'Artillery Ocular');
    const THIGH = symbiant(235792, 'Infantry Thigh');
    const SUZERAIN = boss(1, 'Adobe Suzerain');
    const AHPTA = boss(3, 'Ahpta');

    beforeEach(() => {
      vi.mocked(apiClient.searchSymbiants).mockResolvedValue({
        items: [OCULAR, THIGH],
        total: 2,
        page: 1,
        page_size: 100,
        pages: 1,
        has_next: false,
        has_prev: false,
      });
      vi.mocked(apiClient.getSymbiantDroppedBy).mockImplementation(async (aoid: number) => ({
        success: true,
        data: aoid === OCULAR.aoid ? [SUZERAIN] : [SUZERAIN, AHPTA],
      }));
    });

    it('is stored as AOIDs and read back by AOID', () => {
      const store = useSymbiantsStore();

      store.addToFarmList(OCULAR);
      store.addToFarmList(THIGH);

      expect(stored(farmListKey())).toEqual({ version: 2, aoids: [219135, 235792] });

      store.resetForVersionChange();

      expect(store.farmListAoids).toEqual([219135, 235792]);
      expect(store.isInFarmList(219135)).toBe(true);
    });

    it('asks which bosses drop a symbiant by its AOID, and keeps farm progress across visits', async () => {
      const store = useSymbiantsStore();
      await store.loadAllSymbiants(true);
      store.addToFarmList(OCULAR);
      store.addToFarmList(THIGH);

      await store.aggregateBossesForFarmList();

      expect(apiClient.getSymbiantDroppedBy).toHaveBeenCalledWith(219135);
      expect(apiClient.getSymbiantDroppedBy).toHaveBeenCalledWith(235792);
      expect(
        Array.from(store.aggregatedBosses.values()).map((entry) => [
          entry.boss.name,
          entry.symbiants.map((s) => s.aoid),
        ])
      ).toEqual([
        ['Adobe Suzerain', [219135, 235792]],
        ['Ahpta', [235792]],
      ]);

      store.toggleBossFarmed(SUZERAIN.id);

      // What a later visit reads
      store.resetForVersionChange();
      await store.loadAllSymbiants();
      await store.aggregateBossesForFarmList();

      expect(store.isBossFarmed(SUZERAIN.id)).toBe(true);
      expect(store.isBossFarmed(AHPTA.id)).toBe(false);
      expect(store.aggregatedBosses.get(SUZERAIN.id)?.farmed).toBe(true);
      expect(stored(versionKey(FARM_PROGRESS_BASE, TEST_VERSION))).toEqual({
        farmedBossIds: [SUZERAIN.id],
        version: 1,
      });
    });

    it('migrates a farm list stored as internal ids, backing up what cannot be resolved', async () => {
      localStorage.setItem(farmListKey(), JSON.stringify({ symbiantIds: [86188, 4], version: 1 }));
      backendResolves({ 86188: 219135 });
      const store = useSymbiantsStore();

      store.loadFarmList();
      await store.farmListReady();

      expect(store.farmListAoids).toEqual([219135]);
      expect(stored(farmListKey())).toEqual({ version: 2, aoids: [219135] });
      expect(stored(internalIdBackupKey(FARM_LIST_BASE, TEST_VERSION))).toEqual({
        internalIds: [86188, 4],
        unresolved: [4],
        resolvedAgainst: TEST_VERSION,
      });

      // Second run: nothing left to migrate
      vi.mocked(apiClient.resolveLegacyItemIds).mockClear();
      store.loadFarmList();
      await store.farmListReady();

      expect(apiClient.resolveLegacyItemIds).not.toHaveBeenCalled();
      expect(store.farmListAoids).toEqual([219135]);
    });
  });
});

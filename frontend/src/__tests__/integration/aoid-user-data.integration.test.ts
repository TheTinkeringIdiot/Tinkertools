/**
 * User data is keyed by AOID.
 *
 * Nano favorites and the symbiant farm list are read and written as AOIDs,
 * and what players stored before that (internal row ids) is migrated once:
 *
 *   - ids the backend resolves become AOIDs;
 *   - ids it cannot resolve are left out, the original list is kept under a
 *     backup key, and the player is told once;
 *   - a migrated list is never migrated again;
 *   - nothing is lost while the backend cannot be reached;
 *   - what the player changes while the backend is answering stands;
 *   - data saved before game versions existed goes to the version it was
 *     saved against, whichever version is browsed first.
 *
 * Real stores and real storage; only the API client is mocked.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { nextTick, watch } from 'vue';
import type { ToastMessageOptions } from 'primevue/toast';

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
import { TEST_VERSION, TEST_ALT_VERSION, TEST_VERSIONS } from '../helpers/version-fixtures';
import { setCurrentVersion, versions } from '@/composables/useGameVersion';
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

/**
 * The backend answers each lookup only when told to. Returns the lookups made
 * so far, oldest first; `answer` completes one with the ids the backend knows.
 */
function backendAnswersOnDemand() {
  const lookups: { ids: number[]; answer: (known: Record<number, number>) => void }[] = [];
  vi.mocked(apiClient.resolveLegacyItemIds).mockImplementation(
    (ids: number[]) =>
      new Promise((resolve) => {
        lookups.push({
          ids,
          answer: (known) =>
            resolve(new Map(ids.filter((id) => id in known).map((id) => [id, known[id]]))),
        });
      })
  );
  return lookups;
}

/** Everything pending has run: lookups answered so far have been applied. */
const migrationSettles = () => flushPromises();

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
  /** Toasts shown to the player */
  const notices: ToastMessageOptions[] = [];

  beforeEach(async () => {
    const { app } = await setupIntegrationTest();
    await setCurrentVersion(TEST_VERSION);
    localStorage.clear();
    vi.mocked(apiClient.resolveLegacyItemIds).mockReset();
    backendResolves({});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    notices.length = 0;
    vi.spyOn(app.config.globalProperties.$toast, 'add').mockImplementation((notice) => {
      notices.push(notice);
    });
  });

  afterEach(async () => {
    versions.value = TEST_VERSIONS;
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

    it('migrates favorites stored as internal ids to AOIDs', async () => {
      localStorage.setItem(favoritesKey(), JSON.stringify([11, 12]));
      const lookups = backendAnswersOnDemand();
      const store = useNanosStore();

      // Until the backend has answered, an internal id is not shown as a favorite
      expect(store.favorites).toEqual([]);
      lookups[0].answer({ 11: 246660, 12: 29246 });
      await migrationSettles();

      expect(apiClient.resolveLegacyItemIds).toHaveBeenCalledWith([11, 12], TEST_VERSION);
      expect(store.favorites).toEqual([246660, 29246]);
      expect(stored(favoritesKey())).toEqual({ version: 2, aoids: [246660, 29246] });
      expect(localStorage.getItem(internalIdBackupKey(FAVORITES_BASE, TEST_VERSION))).toBeNull();
      expect(notices).toEqual([]);
    });

    it('keeps the original list in a backup key when an id cannot be resolved', async () => {
      localStorage.setItem(favoritesKey(), JSON.stringify([11, 999, 12]));
      backendResolves({ 11: 246660, 12: 29246 });
      const store = useNanosStore();

      await migrationSettles();

      expect(store.favorites).toEqual([246660, 29246]);
      expect(stored(favoritesKey())).toEqual({ version: 2, aoids: [246660, 29246] });
      expect(stored(internalIdBackupKey(FAVORITES_BASE, TEST_VERSION))).toEqual({
        internalIds: [11, 999, 12],
        unresolved: [999],
        resolvedAgainst: TEST_VERSION,
        resolvedAgainstBuild: TEST_VERSION,
      });
    });

    it('records the build behind an alias in the backup', async () => {
      versions.value = [
        ...TEST_VERSIONS,
        { ...TEST_VERSIONS[0], slug: 'ao', alias_of: TEST_VERSION, is_default: false },
      ];
      await setCurrentVersion('ao');
      localStorage.setItem(favoritesKey('ao'), JSON.stringify([11, 999]));
      backendResolves({ 11: 246660 });
      useNanosStore();

      await migrationSettles();

      expect(apiClient.resolveLegacyItemIds).toHaveBeenCalledWith([11, 999], 'ao');
      expect(stored(internalIdBackupKey(FAVORITES_BASE, 'ao'))).toEqual({
        internalIds: [11, 999],
        unresolved: [999],
        resolvedAgainst: 'ao',
        resolvedAgainstBuild: TEST_VERSION,
      });
    });

    it('tells the player once how many favorites could not be carried over', async () => {
      localStorage.setItem(favoritesKey(), JSON.stringify([11, 999, 12]));
      backendResolves({ 11: 246660, 12: 29246 });
      const store = useNanosStore();

      await migrationSettles();

      expect(notices).toHaveLength(1);
      expect(notices[0].severity).toBe('warn');
      expect(notices[0].detail).toBe(
        '1 of your 3 favorite nanos could not be carried over to this version of TinkerTools.'
      );

      // A later visit has nothing left to migrate, and nothing more to say
      store.resetForVersionChange();
      await migrationSettles();

      expect(notices).toHaveLength(1);
    });

    it('says nothing when every favorite is carried over', async () => {
      localStorage.setItem(favoritesKey(), JSON.stringify([11, 12]));
      backendResolves({ 11: 246660, 12: 29246 });
      const store = useNanosStore();

      await migrationSettles();

      expect(store.favorites).toEqual([246660, 29246]);
      expect(notices).toEqual([]);
    });

    it('says nothing when there is nothing to migrate', async () => {
      localStorage.setItem(favoritesKey(), JSON.stringify({ version: 2, aoids: [246660] }));
      const store = useNanosStore();

      await migrationSettles();

      expect(store.favorites).toEqual([246660]);
      expect(apiClient.resolveLegacyItemIds).not.toHaveBeenCalled();
      expect(notices).toEqual([]);
    });

    it('does not migrate again once migrated', async () => {
      localStorage.setItem(favoritesKey(), JSON.stringify([11, 999]));
      backendResolves({ 11: 246660 });
      const store = useNanosStore();
      await migrationSettles();
      const migrated = localStorage.getItem(favoritesKey());
      const backup = localStorage.getItem(internalIdBackupKey(FAVORITES_BASE, TEST_VERSION));
      vi.mocked(apiClient.resolveLegacyItemIds).mockClear();

      store.resetForVersionChange();
      await migrationSettles();

      expect(apiClient.resolveLegacyItemIds).not.toHaveBeenCalled();
      expect(store.favorites).toEqual([246660]);
      expect(localStorage.getItem(favoritesKey())).toBe(migrated);
      expect(localStorage.getItem(internalIdBackupKey(FAVORITES_BASE, TEST_VERSION))).toBe(backup);
    });

    it('leaves the stored ids untouched while the backend cannot be reached, then migrates', async () => {
      localStorage.setItem(favoritesKey(), JSON.stringify([11, 12]));
      vi.mocked(apiClient.resolveLegacyItemIds).mockRejectedValue(new Error('offline'));
      const store = useNanosStore();

      await migrationSettles();

      expect(store.favorites).toEqual([]);
      expect(stored(favoritesKey())).toEqual([11, 12]);
      expect(notices).toEqual([]);

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
      await migrationSettles();

      expect(store.favorites).toEqual([246660, 29246, 500]);
      expect(stored(favoritesKey())).toEqual({ version: 2, aoids: [246660, 29246, 500] });
    });

    it("resolves each version's ids against that version", async () => {
      localStorage.setItem(favoritesKey(TEST_VERSION), JSON.stringify([11]));
      localStorage.setItem(favoritesKey(TEST_ALT_VERSION), JSON.stringify([11]));
      vi.mocked(apiClient.resolveLegacyItemIds).mockImplementation(
        async (_ids: number[], gameVersion: string) =>
          new Map([[11, gameVersion === TEST_VERSION ? 246660 : 777]])
      );
      const store = useNanosStore();

      await migrationSettles();
      expect(store.favorites).toEqual([246660]);

      await setCurrentVersion(TEST_ALT_VERSION);
      store.resetForVersionChange();
      await migrationSettles();

      expect(store.favorites).toEqual([777]);
      expect(stored(favoritesKey(TEST_VERSION))).toEqual({ version: 2, aoids: [246660] });
      expect(stored(favoritesKey(TEST_ALT_VERSION))).toEqual({ version: 2, aoids: [777] });
    });

    describe('saved before game versions existed', () => {
      it('are migrated when the version they were saved against is browsed', async () => {
        localStorage.setItem(FAVORITES_BASE, JSON.stringify([11]));
        backendResolves({ 11: 246660 });
        const store = useNanosStore();

        await migrationSettles();

        expect(store.favorites).toEqual([246660]);
        expect(stored(favoritesKey())).toEqual({ version: 2, aoids: [246660] });
        expect(localStorage.getItem(FAVORITES_BASE)).toBeNull();
      });

      it('are left alone on another version, and migrated once their own is visited', async () => {
        localStorage.setItem(FAVORITES_BASE, JSON.stringify([11, 12]));
        backendResolves({ 11: 246660, 12: 29246 });

        // First visit after the update lands on a version the ids do not belong to
        await setCurrentVersion(TEST_ALT_VERSION);
        const store = useNanosStore();
        await migrationSettles();

        expect(store.favorites).toEqual([]);
        expect(apiClient.resolveLegacyItemIds).not.toHaveBeenCalled();
        expect(stored(FAVORITES_BASE)).toEqual([11, 12]);
        expect(localStorage.getItem(favoritesKey(TEST_ALT_VERSION))).toBeNull();

        // A favorite of that version does not disturb them either
        store.addToFavorites(777);
        expect(stored(FAVORITES_BASE)).toEqual([11, 12]);

        await setCurrentVersion(TEST_VERSION);
        store.resetForVersionChange();
        await migrationSettles();

        expect(apiClient.resolveLegacyItemIds).toHaveBeenCalledTimes(1);
        expect(apiClient.resolveLegacyItemIds).toHaveBeenCalledWith([11, 12], TEST_VERSION);
        expect(store.favorites).toEqual([246660, 29246]);
        expect(localStorage.getItem(FAVORITES_BASE)).toBeNull();
        expect(stored(favoritesKey(TEST_ALT_VERSION))).toEqual({ version: 2, aoids: [777] });
      });
    });

    describe('changed while the backend is answering', () => {
      it('keeps a favorite added meanwhile', async () => {
        localStorage.setItem(favoritesKey(), JSON.stringify([11]));
        const lookups = backendAnswersOnDemand();
        const store = useNanosStore();

        store.addToFavorites(500);
        lookups[0].answer({ 11: 246660 });
        await migrationSettles();

        expect(store.favorites).toEqual([246660, 500]);
        expect(stored(favoritesKey())).toEqual({ version: 2, aoids: [246660, 500] });
      });

      it('does not bring back a favorite removed meanwhile', async () => {
        localStorage.setItem(
          favoritesKey(),
          JSON.stringify({ version: 2, aoids: [500, 600], pendingInternalIds: [11] })
        );
        const lookups = backendAnswersOnDemand();
        const store = useNanosStore();

        store.removeFromFavorites(500);
        lookups[0].answer({ 11: 246660 });
        await migrationSettles();

        expect(store.favorites).toEqual([246660, 600]);
        expect(stored(favoritesKey())).toEqual({ version: 2, aoids: [246660, 600] });
      });

      it('asks the backend once when the favorites are loaded twice, and a removal afterwards stands', async () => {
        localStorage.setItem(favoritesKey(), JSON.stringify([11, 999]));
        const lookups = backendAnswersOnDemand();
        const store = useNanosStore();
        store.resetForVersionChange();
        store.resetForVersionChange();

        expect(lookups).toHaveLength(1);
        lookups[0].answer({ 11: 246660 });
        await migrationSettles();
        expect(store.favorites).toEqual([246660]);

        store.removeFromFavorites(246660);
        await migrationSettles();

        expect(store.favorites).toEqual([]);
        expect(stored(favoritesKey())).toEqual({ version: 2, aoids: [] });
        expect(notices).toHaveLength(1);
      });

      it('keeps what another tab stored meanwhile', async () => {
        localStorage.setItem(favoritesKey(), JSON.stringify([11]));
        const lookups = backendAnswersOnDemand();
        const store = useNanosStore();

        // The other tab finished the migration, then its player added and removed favorites
        localStorage.setItem(favoritesKey(), JSON.stringify({ version: 2, aoids: [500] }));
        lookups[0].answer({ 11: 246660 });
        await migrationSettles();

        expect(stored(favoritesKey())).toEqual({ version: 2, aoids: [500] });
        expect(store.favorites).toEqual([500]);
      });

      it('files the answer under the version it was asked for after a version switch', async () => {
        localStorage.setItem(favoritesKey(TEST_VERSION), JSON.stringify([11]));
        const lookups = backendAnswersOnDemand();
        const store = useNanosStore();

        await setCurrentVersion(TEST_ALT_VERSION);
        store.resetForVersionChange();
        store.addToFavorites(777);
        lookups[0].answer({ 11: 246660 });
        await migrationSettles();

        expect(store.favorites).toEqual([777]);
        expect(stored(favoritesKey(TEST_ALT_VERSION))).toEqual({ version: 2, aoids: [777] });
        expect(stored(favoritesKey(TEST_VERSION))).toEqual({ version: 2, aoids: [246660] });

        // Back on the first version, the migrated favorites are there
        await setCurrentVersion(TEST_VERSION);
        store.resetForVersionChange();

        expect(store.favorites).toEqual([246660]);
      });
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

    it('does not redraw the list when loading finds it unchanged', async () => {
      const store = useSymbiantsStore();
      store.loadFarmList();
      await migrationSettles();
      const redraws = vi.fn();
      const stop = watch(() => store.farmListAoids, redraws, { deep: true });

      // Nothing stored: every visit to TinkerPocket loads the list again
      store.loadFarmList();
      await migrationSettles();
      store.addToFarmList(OCULAR);
      await nextTick();
      expect(redraws).toHaveBeenCalledTimes(1);

      // Stored and unchanged
      store.loadFarmList();
      await migrationSettles();
      await nextTick();
      stop();

      expect(redraws).toHaveBeenCalledTimes(1);
      expect(store.farmListAoids).toEqual([OCULAR.aoid]);
    });

    it('migrates a farm list stored as internal ids, backing up what cannot be resolved', async () => {
      localStorage.setItem(farmListKey(), JSON.stringify({ symbiantIds: [86188, 4], version: 1 }));
      backendResolves({ 86188: 219135 });
      const store = useSymbiantsStore();

      store.loadFarmList();
      await migrationSettles();

      expect(store.farmListAoids).toEqual([219135]);
      expect(stored(farmListKey())).toEqual({ version: 2, aoids: [219135] });
      expect(stored(internalIdBackupKey(FARM_LIST_BASE, TEST_VERSION))).toEqual({
        internalIds: [86188, 4],
        unresolved: [4],
        resolvedAgainst: TEST_VERSION,
        resolvedAgainstBuild: TEST_VERSION,
      });
      expect(notices.map((notice) => notice.detail)).toEqual([
        '1 of your 2 farm list symbiants could not be carried over to this version of TinkerTools.',
      ]);

      // Second run: nothing left to migrate
      vi.mocked(apiClient.resolveLegacyItemIds).mockClear();
      store.loadFarmList();
      await migrationSettles();

      expect(apiClient.resolveLegacyItemIds).not.toHaveBeenCalled();
      expect(store.farmListAoids).toEqual([219135]);
      expect(notices).toHaveLength(1);
    });

    it('leaves a list and progress saved before game versions existed to their own version', async () => {
      localStorage.setItem(FARM_LIST_BASE, JSON.stringify({ symbiantIds: [86188], version: 1 }));
      localStorage.setItem(
        FARM_PROGRESS_BASE,
        JSON.stringify({ farmedBossIds: [SUZERAIN.id], version: 1 })
      );
      backendResolves({ 86188: 219135 });

      await setCurrentVersion(TEST_ALT_VERSION);
      const store = useSymbiantsStore();
      store.loadFarmList();
      store.loadFarmProgress();
      await migrationSettles();

      expect(store.farmListAoids).toEqual([]);
      expect(store.isBossFarmed(SUZERAIN.id)).toBe(false);
      expect(apiClient.resolveLegacyItemIds).not.toHaveBeenCalled();
      expect(stored(FARM_LIST_BASE)).toEqual({ symbiantIds: [86188], version: 1 });

      await setCurrentVersion(TEST_VERSION);
      store.resetForVersionChange();
      await migrationSettles();

      expect(apiClient.resolveLegacyItemIds).toHaveBeenCalledWith([86188], TEST_VERSION);
      expect(store.farmListAoids).toEqual([219135]);
      expect(store.isBossFarmed(SUZERAIN.id)).toBe(true);
      expect(localStorage.getItem(FARM_LIST_BASE)).toBeNull();
      expect(localStorage.getItem(FARM_PROGRESS_BASE)).toBeNull();
    });

    it('stays empty when cleared while the backend is answering', async () => {
      localStorage.setItem(farmListKey(), JSON.stringify({ symbiantIds: [86188, 4], version: 1 }));
      const lookups = backendAnswersOnDemand();
      const store = useSymbiantsStore();
      store.loadFarmList();

      store.clearFarmList();
      lookups[0].answer({ 86188: 219135 });
      await migrationSettles();

      expect(store.farmListAoids).toEqual([]);
      expect(stored(farmListKey())).toEqual({ version: 2, aoids: [] });
      // Nothing was migrated, so nothing was left out
      expect(notices).toEqual([]);

      store.loadFarmList();
      await migrationSettles();

      expect(lookups).toHaveLength(1);
      expect(store.farmListAoids).toEqual([]);
    });

    it('is exactly the shared list when one is opened while the backend is answering', async () => {
      localStorage.setItem(farmListKey(), JSON.stringify({ symbiantIds: [86188], version: 1 }));
      const lookups = backendAnswersOnDemand();
      const store = useSymbiantsStore();
      store.loadFarmList();

      store.importFarmListFromUrl(`${THIGH.aoid}`);
      lookups[0].answer({ 86188: 219135 });
      await migrationSettles();

      expect(store.farmListAoids).toEqual([THIGH.aoid]);
      expect(stored(farmListKey())).toEqual({ version: 2, aoids: [THIGH.aoid] });
    });
  });
});

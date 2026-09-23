/**
 * Game version switch integration test.
 *
 * Switching game version swaps the whole backing database. Anything the client
 * cached from the old one is wrong for the new one, so this test checks the
 * two halves of that contract end to end:
 *
 *   1. resetAllStores() empties every cache, not just the Pinia stores.
 *   2. purgeOtherVersionCaches() reclaims the storage the other versions hold.
 *   3. A switch keeps user data (favorites, farm lists) of every version and
 *      reuses the new version's persisted caches.
 *
 * Real stores, real caches, mocked API only.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// CRITICAL: mock the API before any store import pulls it in.
vi.mock('@/services/api-client');

import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import {
  setupIntegrationTest,
  type IntegrationTestContext,
} from '../helpers/integration-test-utils';
import { TEST_VERSION, TEST_ALT_VERSION } from '../helpers/version-fixtures';
import {
  setCurrentVersion,
  currentVersion,
  onGameVersionChange,
  resolveVersion,
} from '@/composables/useGameVersion';
import { versionKey, versionPrefix } from '@/services/version-keys';
import { cacheManager } from '@/services/cache-manager';
import { resetAllStores, purgeOtherVersionCaches, handleGameVersionChange } from '@/stores';
import { useItemsStore } from '@/stores/items';
import { useNanosStore } from '@/stores/nanosStore';
import { usePocketBossStore } from '@/stores/pocketBossStore';
import type { NanoProgram } from '@/types/nano';
import type { Mob } from '@/types/api';
import { createTestNano } from '../helpers/nano-fixtures';

const NANOS_CACHE_BASE = 'tinkertools_nanos_cache';
const FAVORITES_BASE = 'tinkertools_nano_favorites';
const WEAPON_CACHE_BASE = 'tinkertools_weapon_cache';
const NANO_FILTERS_KEY = 'tinkertools_nano_filters';
const FARM_LIST_BASE = 'tinkertools-farm-list';

function sampleNano(id: number, name: string): NanoProgram {
  return createTestNano({ id, name, school: 'Combat', strain: 'Test Strain' });
}

function samplePocketBoss(id: number, name: string): Mob {
  return {
    id,
    name,
    level: 100,
    playfield: 'Nascense',
    location: '',
    mob_names: [],
    is_pocket_boss: true,
  };
}

/**
 * Enumerate the mock localStorage. Object.keys() would return the mock's own
 * methods rather than the stored keys, so go through the Storage API.
 */
function storedKeys(prefix = ''): string[] {
  const found: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) found.push(key);
  }
  return found;
}

describe('Game version switch', () => {
  let context: IntegrationTestContext;

  beforeEach(async () => {
    const app = createApp({});
    app.use(PrimeVue);
    app.use(ToastService);

    context = await setupIntegrationTest();
    app.use(context.pinia);

    await setCurrentVersion(TEST_VERSION);
    localStorage.clear();
  });

  afterEach(async () => {
    await setCurrentVersion(TEST_VERSION);
  });

  describe('cache key namespacing', () => {
    it('writes API cache entries under the active version', async () => {
      await cacheManager.cacheApiResponse('/items/1', { ql: 200 }, { name: 'Item' });

      const keyForThisVersion = storedKeys().find((key) => key.endsWith(`:${TEST_VERSION}`));

      expect(keyForThisVersion).toBeDefined();
    });

    it('does not serve another version an entry cached for this one', async () => {
      await cacheManager.cacheApiResponse('/items/1', { ql: 200 }, { name: 'From AO' });
      expect(await cacheManager.getCachedApiResponse('/items/1', { ql: 200 })).toEqual({
        name: 'From AO',
      });

      await setCurrentVersion(TEST_ALT_VERSION);

      expect(await cacheManager.getCachedApiResponse('/items/1', { ql: 200 })).toBeNull();
    });

    it('keeps the nano favorites of each version separate', () => {
      const nanosStore = useNanosStore();

      nanosStore.addToFavorites(101);
      expect(localStorage.getItem(versionKey(FAVORITES_BASE, TEST_VERSION))).toContain('101');
      expect(localStorage.getItem(versionKey(FAVORITES_BASE, TEST_ALT_VERSION))).toBeNull();
    });
  });

  describe('resetAllStores', () => {
    it('empties store state that came from the previous version', async () => {
      const itemsStore = useItemsStore();
      const nanosStore = useNanosStore();
      const pocketBossStore = usePocketBossStore();

      nanosStore.nanos.push(sampleNano(1, 'Superior Heal'));
      pocketBossStore.pocketBosses.push(samplePocketBoss(1, 'Test Boss'));
      await cacheManager.set('offline_items', [{ id: 1 }]);

      expect(nanosStore.nanos.length).toBe(1);
      expect(pocketBossStore.pocketBosses.length).toBe(1);

      await resetAllStores();

      expect(nanosStore.nanos.length).toBe(0);
      expect(pocketBossStore.pocketBosses.length).toBe(0);
      expect(itemsStore.items.size).toBe(0);
      expect(await cacheManager.get('offline_items')).toBeNull();
    });

    it('clears the persisted nano list for the active version', async () => {
      localStorage.setItem(versionKey(NANOS_CACHE_BASE), JSON.stringify({ data: [] }));

      await resetAllStores();

      expect(localStorage.getItem(versionKey(NANOS_CACHE_BASE))).toBeNull();
    });

    it('leaves version-independent UI preferences alone', async () => {
      localStorage.setItem(NANO_FILTERS_KEY, '{"schools":[]}');

      await resetAllStores();

      expect(localStorage.getItem(NANO_FILTERS_KEY)).toBe('{"schools":[]}');
    });
  });

  describe('purgeOtherVersionCaches', () => {
    it('removes cached API responses belonging to other versions', async () => {
      await cacheManager.cacheApiResponse('/items/1', {}, { name: 'From AO' });
      await setCurrentVersion(TEST_ALT_VERSION);
      await cacheManager.cacheApiResponse('/items/1', {}, { name: 'From PRK' });

      expect(storedKeys('tinkertools_cache_').length).toBe(2);

      await purgeOtherVersionCaches(TEST_ALT_VERSION);

      const after = storedKeys('tinkertools_cache_');
      expect(after.length).toBe(1);
      expect(after[0].endsWith(`:${TEST_ALT_VERSION}`)).toBe(true);
    });

    it('removes weapon cache entries belonging to other versions', async () => {
      localStorage.setItem(`${versionPrefix(WEAPON_CACHE_BASE, TEST_VERSION)}200_1`, '{}');
      localStorage.setItem(`${versionPrefix(WEAPON_CACHE_BASE, TEST_ALT_VERSION)}200_1`, '{}');

      await purgeOtherVersionCaches(TEST_ALT_VERSION);

      expect(
        localStorage.getItem(`${versionPrefix(WEAPON_CACHE_BASE, TEST_VERSION)}200_1`)
      ).toBeNull();
      expect(
        localStorage.getItem(`${versionPrefix(WEAPON_CACHE_BASE, TEST_ALT_VERSION)}200_1`)
      ).toBe('{}');
    });

    it('retires the pre-version weapon cache key family', async () => {
      localStorage.setItem('tinkertools_weapon_cache_200_1_5_clan_', '{}');

      await purgeOtherVersionCaches(TEST_VERSION);

      expect(localStorage.getItem('tinkertools_weapon_cache_200_1_5_clan_')).toBeNull();
    });
  });

  describe('the version change hook', () => {
    it('resets stores and purges the old version when the version changes', async () => {
      const nanosStore = useNanosStore();
      nanosStore.nanos.push(sampleNano(1, 'Superior Heal'));

      await cacheManager.cacheApiResponse('/items/1', {}, { name: 'From AO' });
      expect(storedKeys('tinkertools_cache_').length).toBe(1);

      await handleGameVersionChange(TEST_ALT_VERSION, TEST_VERSION);

      expect(nanosStore.nanos.length).toBe(0);
      expect(storedKeys('tinkertools_cache_').length).toBe(0);
    });

    it('notifies registered listeners on a switch but not on first resolution', async () => {
      const listener = vi.fn();
      const unregister = onGameVersionChange(listener);

      try {
        // Already on TEST_VERSION from beforeEach: setting it again is a no-op.
        await setCurrentVersion(TEST_VERSION);
        expect(listener).not.toHaveBeenCalled();

        await setCurrentVersion(TEST_ALT_VERSION);
        await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
        expect(listener).toHaveBeenCalledWith(TEST_ALT_VERSION, TEST_VERSION);
      } finally {
        unregister();
      }
    });

    it('does not fire listeners for the very first version resolution', async () => {
      currentVersion.value = null;

      const listener = vi.fn();
      const unregister = onGameVersionChange(listener);

      try {
        await setCurrentVersion(TEST_VERSION);
        expect(listener).not.toHaveBeenCalled();
      } finally {
        unregister();
      }
    });
    it('keeps favorites and farm lists of the version being left', async () => {
      const nanosStore = useNanosStore();
      nanosStore.addToFavorites(101);
      localStorage.setItem(
        versionKey(FARM_LIST_BASE, TEST_VERSION),
        JSON.stringify({ aoids: [5] })
      );

      await setCurrentVersion(TEST_ALT_VERSION);
      await handleGameVersionChange(TEST_ALT_VERSION, TEST_VERSION);

      expect(localStorage.getItem(versionKey(FAVORITES_BASE, TEST_VERSION))).toContain('101');
      expect(localStorage.getItem(versionKey(FARM_LIST_BASE, TEST_VERSION))).not.toBeNull();
      expect(nanosStore.favorites).toEqual([]);

      await setCurrentVersion(TEST_VERSION);
      await handleGameVersionChange(TEST_VERSION, TEST_ALT_VERSION);

      expect(nanosStore.favorites).toEqual([101]);
    });

    it("reuses the new version's persisted nano cache and drops the old one", async () => {
      const altNanos = { data: [sampleNano(7, 'PRK Nano')], totalCount: 1, timestamp: Date.now() };
      localStorage.setItem(
        versionKey(NANOS_CACHE_BASE, TEST_ALT_VERSION),
        JSON.stringify(altNanos)
      );
      localStorage.setItem(
        versionKey(NANOS_CACHE_BASE, TEST_VERSION),
        JSON.stringify({ ...altNanos, data: [sampleNano(8, 'AO Nano')] })
      );

      const nanosStore = useNanosStore();
      await setCurrentVersion(TEST_ALT_VERSION);
      await handleGameVersionChange(TEST_ALT_VERSION, TEST_VERSION);

      expect(nanosStore.nanos.map((n) => n.name)).toEqual(['PRK Nano']);
      expect(localStorage.getItem(versionKey(NANOS_CACHE_BASE, TEST_ALT_VERSION))).not.toBeNull();
      expect(localStorage.getItem(versionKey(NANOS_CACHE_BASE, TEST_VERSION))).toBeNull();
    });

    it('waits for listeners before setCurrentVersion resolves', async () => {
      let finished = false;
      const unregister = onGameVersionChange(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        finished = true;
      });

      try {
        await setCurrentVersion(TEST_ALT_VERSION);
        expect(finished).toBe(true);
      } finally {
        unregister();
      }
    });

    it('treats a first resolution that differs from the provisional guess as a switch', async () => {
      currentVersion.value = null;
      // Something (the profile dropdown on mount) acted on a guess before routing settled.
      const guess = resolveVersion();
      const actual = guess === TEST_VERSION ? TEST_ALT_VERSION : TEST_VERSION;

      const listener = vi.fn();
      const unregister = onGameVersionChange(listener);

      try {
        await setCurrentVersion(actual);
        expect(listener).toHaveBeenCalledWith(actual, guess);
      } finally {
        unregister();
      }
    });
  });
});

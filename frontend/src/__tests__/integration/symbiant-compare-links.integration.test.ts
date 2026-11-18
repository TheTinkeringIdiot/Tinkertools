/**
 * Shared symbiant comparison links.
 *
 * The compare view names its selection in the URL (a1..a3, AOIDs), so a copied
 * link shows the same comparison to whoever opens it. Links made before AOIDs
 * (s1..s3, internal ids) are translated; what cannot be translated is reported
 * to the visitor instead of silently showing an empty comparison, and a link
 * that could not be looked up at all is kept so that it can be tried again.
 *
 * Real component, stores and router; only the API client is mocked.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flushPromises, type VueWrapper } from '@vue/test-utils';
import type { ToastMessageOptions } from 'primevue/toast';
import type { Router } from 'vue-router';

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

import {
  mountForIntegration,
  setupIntegrationTest,
  type IntegrationTestContext,
} from '../helpers/integration-test-utils';
import { createTestRouter } from '../helpers/vue-test-utils';
import { TEST_VERSION, TEST_ALT_VERSION, TEST_VERSIONS } from '../helpers/version-fixtures';
import { setCurrentVersion, useGameVersion, versions } from '@/composables/useGameVersion';
import { apiClient } from '@/services/api-client';
import { useSymbiantsStore } from '@/stores/symbiants';
import SymbiantCompare from '@/components/pocket/SymbiantCompare.vue';
import type { Symbiant } from '@/types/api';

function symbiant(aoid: number, name: string): Symbiant {
  return { aoid, name, ql: 200, slot_id: 2, family: 'Artillery', actions: [] };
}

const OCULAR = symbiant(219135, 'Excited Ocular Symbiant, Artillery Unit Aban');
const THIGH = symbiant(235792, 'Working Thigh Symbiant, Infantry Unit Beta');
const BRAIN = symbiant(219140, 'Vital Brain Symbiant, Control Unit Aban');

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

describe('Symbiant comparison links', () => {
  let context: IntegrationTestContext;
  let router: Router;
  let wrapper: VueWrapper | undefined;

  /** Toasts shown to the visitor */
  const notices: ToastMessageOptions[] = [];

  /** Open the compare view the way a visitor following `link` does */
  async function open(link: string, version = TEST_VERSION): Promise<VueWrapper> {
    await setCurrentVersion(version);
    router = createTestRouter();
    await router.push(`/${version}${link}`);
    wrapper = mountForIntegration(SymbiantCompare, { pinia: context.pinia, router });
    vi.spyOn(wrapper.vm.$toast, 'add').mockImplementation((notice) => {
      notices.push(notice);
    });
    await flushPromises();
    return wrapper;
  }

  const query = () => router.currentRoute.value.query;

  beforeEach(async () => {
    context = await setupIntegrationTest();
    await setCurrentVersion(TEST_VERSION);
    localStorage.clear();
    vi.mocked(apiClient.searchSymbiants).mockResolvedValue({
      items: [OCULAR, THIGH, BRAIN],
      total: 3,
      page: 1,
      page_size: 100,
      pages: 1,
      has_next: false,
      has_prev: false,
    });
    vi.mocked(apiClient.resolveLegacyItemIds).mockReset();
    backendResolves({});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    notices.length = 0;
  });

  afterEach(async () => {
    wrapper?.unmount();
    wrapper = undefined;
    await setCurrentVersion(TEST_VERSION);
    vi.restoreAllMocks();
  });

  describe('a link naming symbiants by AOID', () => {
    it('shows those symbiants', async () => {
      const view = await open('/pocket?tab=compare&a1=219135&a2=235792');

      expect(view.text()).toContain(OCULAR.name);
      expect(view.text()).toContain(THIGH.name);
      expect(view.text()).not.toContain(BRAIN.name);
      expect(view.text()).not.toContain('Select Symbiants to Compare');
      expect(query()).toEqual({ tab: 'compare', a1: '219135', a2: '235792' });
      expect(apiClient.resolveLegacyItemIds).not.toHaveBeenCalled();
      expect(notices).toEqual([]);
    });

    it('shows them to a visitor who already had another comparison going', async () => {
      useSymbiantsStore().addToComparison(BRAIN);

      const view = await open('/pocket?tab=compare&a1=219135');

      expect(view.text()).toContain(OCULAR.name);
      expect(view.text()).not.toContain(BRAIN.name);
    });

    it('leaves out a symbiant this game version does not have', async () => {
      const view = await open('/pocket?tab=compare&a1=219135&a2=999999');

      expect(view.text()).toContain(OCULAR.name);
      expect(query()).toEqual({ tab: 'compare', a1: '219135' });
    });
  });

  describe('the selection', () => {
    it('is written to the URL as AOIDs when symbiants are selected', async () => {
      const view = await open('/pocket?tab=compare');
      expect(view.text()).toContain('Select Symbiants to Compare');

      // What "Compare" on a symbiant in the Browse tab does
      const store = useSymbiantsStore();
      store.addToComparison(OCULAR);
      store.addToComparison(THIGH);
      await flushPromises();

      expect(view.text()).toContain(OCULAR.name);
      expect(view.text()).toContain(THIGH.name);
      expect(query()).toEqual({ tab: 'compare', a1: '219135', a2: '235792' });
    });

    it('is written to the URL when the visitor comes to the compare tab with one', async () => {
      useSymbiantsStore().addToComparison(OCULAR);
      await open('/pocket?tab=symbiants&family=Artillery');
      expect(query()).toEqual({ tab: 'symbiants', family: 'Artillery' });

      await router.replace({ query: { ...query(), tab: 'compare' } });
      await flushPromises();

      expect(query()).toEqual({ tab: 'compare', family: 'Artillery', a1: '219135' });
    });

    it('leaves the URL when a symbiant is removed', async () => {
      const view = await open('/pocket?tab=compare&a1=219135&a2=235792');

      const remove = view.findAll('button').find((button) => !button.text().includes('Clear All'));
      await remove?.trigger('click');
      await flushPromises();

      expect(view.text()).not.toContain(OCULAR.name);
      expect(view.text()).toContain(THIGH.name);
      expect(query()).toEqual({ tab: 'compare', a2: '235792' });
    });

    it('is not replaced by a stale link when only the tab changes', async () => {
      const view = await open('/pocket?tab=compare&a1=219135');
      await router.replace({ query: { ...query(), tab: 'symbiants' } });
      await flushPromises();

      useSymbiantsStore().addToComparison(THIGH);
      await router.replace({ query: { ...query(), tab: 'compare' } });
      await flushPromises();

      expect(view.text()).toContain(OCULAR.name);
      expect(view.text()).toContain(THIGH.name);
      expect(query()).toEqual({ tab: 'compare', a1: '219135', a2: '235792' });
    });
  });

  describe('a link made before AOIDs, naming internal ids', () => {
    it('is translated, shown, and rewritten to the AOID form', async () => {
      backendResolves({ 86188: 219135, 90001: 235792 });

      const view = await open('/pocket?tab=compare&s1=86188&s2=90001');

      expect(apiClient.resolveLegacyItemIds).toHaveBeenCalledWith([86188, 90001], TEST_VERSION);
      expect(view.text()).toContain(OCULAR.name);
      expect(view.text()).toContain(THIGH.name);
      expect(query()).toEqual({ tab: 'compare', a1: '219135', a2: '235792' });
      expect(notices).toEqual([]);
    });

    it('is translated against the database it was made on, whichever version is browsed', async () => {
      backendResolves({ 86188: 219135 });

      const view = await open('/pocket?tab=compare&s1=86188', TEST_ALT_VERSION);

      expect(apiClient.resolveLegacyItemIds).toHaveBeenCalledWith([86188], TEST_VERSION);
      expect(view.text()).toContain(OCULAR.name);
      expect(query()).toEqual({ tab: 'compare', a1: '219135' });
    });

    it('tells the visitor which symbiants could not be loaded', async () => {
      backendResolves({ 86188: 219135 });

      const view = await open('/pocket?tab=compare&s1=86188&s2=4&s3=5');

      expect(view.text()).toContain(OCULAR.name);
      expect(query()).toEqual({ tab: 'compare', a1: '219135' });
      expect(notices).toHaveLength(1);
      expect(notices[0].severity).toBe('warn');
      expect(notices[0].summary).toBe('Outdated comparison link');
      expect(notices[0].detail).toBe(
        'This link was made with an older version of TinkerTools. Symbiants 2 and 3 could not be loaded.'
      );
    });

    it('tells the visitor when none of it could be loaded', async () => {
      const view = await open('/pocket?tab=compare&s2=4');

      expect(view.text()).toContain('Select Symbiants to Compare');
      expect(query()).toEqual({ tab: 'compare' });
      expect(notices.map((notice) => notice.detail)).toEqual([
        'This link was made with an older version of TinkerTools. Symbiant 2 could not be loaded.',
      ]);
    });

    describe('that cannot be translated on this visit', () => {
      const TRY_AGAIN =
        'This link was made with an older version of TinkerTools and could not be converted right now. Reload the page to try again.';

      /** What the API client does on a network failure, and when the server holds no ids yet */
      function lookupFails() {
        vi.mocked(apiClient.resolveLegacyItemIds).mockRejectedValue(new Error('offline'));
      }

      it('stays in the URL, and the visitor is told to try again', async () => {
        lookupFails();

        const view = await open('/pocket?tab=compare&s1=86188&s2=90001');

        expect(view.text()).toContain('Select Symbiants to Compare');
        expect(query()).toEqual({ tab: 'compare', s1: '86188', s2: '90001' });
        expect(notices.map((notice) => notice.detail)).toEqual([TRY_AGAIN]);
      });

      it('is not looked up while the version it was made on is unknown', async () => {
        const { defaultVersion, registryFailed } = useGameVersion();
        const loaded = { default: defaultVersion.value, failed: registryFailed.value };
        backendResolves({ 86188: 219135, 90001: 235792 });
        // What a failed `GET /versions` leaves
        versions.value = [];
        defaultVersion.value = null;
        registryFailed.value = true;

        try {
          const view = await open('/pocket?tab=compare&s1=86188&s2=90001');

          expect(apiClient.resolveLegacyItemIds).not.toHaveBeenCalled();
          expect(view.text()).toContain('Select Symbiants to Compare');
          expect(query()).toEqual({ tab: 'compare', s1: '86188', s2: '90001' });
          expect(notices.map((notice) => notice.detail)).toEqual([TRY_AGAIN]);
        } finally {
          versions.value = TEST_VERSIONS;
          defaultVersion.value = loaded.default;
          registryFailed.value = loaded.failed;
        }
      });

      it('is translated when opened again once the lookup works', async () => {
        lookupFails();
        const failed = await open('/pocket?tab=compare&s1=86188&s2=90001');
        const kept = router.currentRoute.value.fullPath;
        failed.unmount();
        notices.length = 0;

        backendResolves({ 86188: 219135, 90001: 235792 });
        const view = await open(kept.replace(`/${TEST_VERSION}`, ''));

        expect(view.text()).toContain(OCULAR.name);
        expect(view.text()).toContain(THIGH.name);
        expect(query()).toEqual({ tab: 'compare', a1: '219135', a2: '235792' });
        expect(notices).toEqual([]);
      });

      it('survives a change of tab', async () => {
        lookupFails();
        await open('/pocket?tab=compare&s1=86188');

        await router.replace({ query: { ...query(), tab: 'symbiants' } });
        await flushPromises();
        await router.replace({ query: { ...query(), tab: 'compare' } });
        await flushPromises();

        expect(query()).toEqual({ tab: 'compare', s1: '86188' });
      });

      it('gives way to a selection the visitor makes instead', async () => {
        lookupFails();
        const view = await open('/pocket?tab=compare&s1=86188&s2=90001');

        useSymbiantsStore().addToComparison(BRAIN);
        await flushPromises();

        expect(view.text()).toContain(BRAIN.name);
        expect(query()).toEqual({ tab: 'compare', a1: '219140' });
      });
    });
  });
});

/**
 * TinkerPocket on a game version without its data.
 *
 * Builds from before symbiants existed answer with empty lists. That is shown
 * as what it is (the version has none), not as a failure with a Retry button,
 * and a real failure is shown as a sentence, not as the error object.
 *
 * Real component and stores; only the API client is mocked.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flushPromises, type VueWrapper } from '@vue/test-utils';

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
import { TEST_VERSION, TEST_VERSIONS } from '../helpers/version-fixtures';
import { del, keys } from 'idb-keyval';
import { apiClient } from '@/services/api-client';
import FindGear from '@/apps/tinkerpocket/views/FindGear.vue';
import type { Symbiant, UserFriendlyError } from '@/types/api';

const VERSION_NAME = TEST_VERSIONS[0].display_name;

function page<T>(items: T[]) {
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 100,
    pages: items.length > 0 ? 1 : 0,
    has_next: false,
    has_prev: false,
  };
}

const OCULAR: Symbiant = {
  aoid: 219135,
  name: 'Excited Ocular Symbiant, Artillery Unit Aban',
  ql: 200,
  slot_id: 2,
  family: 'Artillery',
  actions: [],
};

describe('TinkerPocket on a game version without symbiants', () => {
  let context: IntegrationTestContext;
  let wrapper: VueWrapper | undefined;

  async function open(view: 'symbiants' | 'bosses'): Promise<VueWrapper> {
    const router = createTestRouter();
    await router.push(`/${TEST_VERSION}/pocket`);
    wrapper = mountForIntegration(FindGear, { pinia: context.pinia, router, props: { view } });
    await flushPromises();
    return wrapper;
  }

  beforeEach(async () => {
    context = await setupIntegrationTest();
    localStorage.clear();
    // The symbiant list an earlier test left cached
    await Promise.all((await keys()).map((key) => del(key)));
    vi.mocked(apiClient.searchSymbiants).mockResolvedValue(page<Symbiant>([]));
    vi.mocked(apiClient.searchPocketBosses).mockResolvedValue(page([]));
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('says the version has no symbiants, and offers nothing to retry', async () => {
    const view = await open('symbiants');

    expect(view.text()).toContain(`${VERSION_NAME} has no symbiants`);
    expect(view.text()).not.toContain('Retry');
    expect(view.text()).not.toContain('Try adjusting your filters');
  });

  it('says the version has no pocket bosses', async () => {
    const view = await open('bosses');

    expect(view.text()).toContain(`${VERSION_NAME} has no pocket bosses`);
    expect(view.text()).not.toContain('Try adjusting your filters');
  });

  it('still blames the filters when the version has symbiants and none match', async () => {
    vi.mocked(apiClient.searchSymbiants).mockResolvedValue(page([OCULAR]));
    const router = createTestRouter();
    await router.push(`/${TEST_VERSION}/pocket?family=Control`);
    wrapper = mountForIntegration(FindGear, {
      pinia: context.pinia,
      router,
      props: { view: 'symbiants' },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('No symbiants found');
    expect(wrapper.text()).toContain('Try adjusting your filters');
    expect(wrapper.text()).not.toContain('has no symbiants');
  });

  it('shows a failure as a sentence with a way to retry', async () => {
    const offline: UserFriendlyError = {
      type: 'error',
      title: 'Network Error',
      message: 'Unable to connect to the server',
      action: 'Check your internet connection and try again',
      recoverable: true,
    };
    vi.mocked(apiClient.searchSymbiants).mockRejectedValue(offline);

    const view = await open('symbiants');

    expect(view.text()).toContain('Unable to connect to the server');
    expect(view.text()).toContain('Retry');
    expect(view.text()).not.toContain('"recoverable"');
    expect(view.text()).not.toContain('has no symbiants');
  });
});

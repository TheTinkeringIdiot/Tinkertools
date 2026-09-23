/**
 * Item Version History Integration Tests
 *
 * The "History" control on an item, peeking at another snapshot through
 * ?as=<slug>, and the message shown for an item the browsing version does not
 * carry. Real stores, mocked API client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/services/api-client');

const mockToast = { add: vi.fn(), remove: vi.fn(), removeGroup: vi.fn(), removeAllGroups: vi.fn() };
vi.mock('primevue/usetoast', () => ({ useToast: () => mockToast }));

import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import PrimeVue from 'primevue/config';
import Button from 'primevue/button';
import ItemDetail from '@/views/ItemDetail.vue';
import ItemHistoryControl from '@/components/versions/ItemHistoryControl.vue';
import ItemInterpolationBar from '@/components/items/ItemInterpolationBar.vue';
import { apiClient } from '@/services/api-client';
import {
  versions as versionRegistry,
  currentVersion,
  setCurrentVersion,
  useGameVersion,
} from '@/composables/useGameVersion';
import type { GameVersion, ItemRevisionsResponse } from '@/types/game-version';
import type { Item } from '@/types/api';

const mockApi = apiClient as any;

const LIVE: GameVersion = {
  slug: 'ao-2024-02',
  display_name: 'Anarchy Online (Feb 2024)',
  family: 'ao',
  parent_slug: 'ao-2019-11',
  client_build: '18.8.72',
  snapshot_date: '2024-02-24',
  sort_order: 10,
  enabled: true,
  is_default: true,
  features: { items: true },
  notes: null,
  is_current: true,
};

const OLD: GameVersion = {
  ...LIVE,
  slug: 'ao-2019-11',
  display_name: 'Anarchy Online (Nov 2019)',
  parent_slug: null,
  client_build: '18.7',
  snapshot_date: '2019-11-01',
  sort_order: 20,
  is_default: false,
  is_current: false,
};

const REVISIONS: ItemRevisionsResponse = {
  aoid: 24562,
  present_in: ['ao-2019-11', 'ao-2024-02'],
  first_seen_in: 'ao-2019-11',
  revisions: [
    {
      version_slug: 'ao-2019-11',
      display_name: 'Anarchy Online (Nov 2019)',
      family: 'ao',
      snapshot_date: '2019-11-01',
      client_build: '18.7',
      changed: [],
      first_seen: true,
    },
    {
      version_slug: 'ao-2024-02',
      display_name: 'Anarchy Online (Feb 2024)',
      family: 'ao',
      snapshot_date: '2024-02-24',
      client_build: '18.8.72',
      changed: ['stats', 'actions'],
      first_seen: false,
    },
  ],
  missing_in: [],
};

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 1,
    aoid: 24562,
    name: 'Notum Splice',
    ql: 200,
    is_nano: false,
    stats: [],
    spell_data: [],
    actions: [],
    attack_stats: [],
    defense_stats: [],
    ...overrides,
  };
}

function makeRouter(): Router {
  const blank = { template: '<div />' };
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'Root', component: blank },
      { path: '/:version/items', name: 'TinkerItems', component: blank },
      { path: '/:version/items/:aoid', name: 'ItemDetail', component: blank },
    ],
  });
}

async function mountItemDetail(router: Router, pinia: Pinia) {
  const wrapper = mount(ItemDetail, {
    props: { aoid: '24562' },
    shallow: true,
    global: {
      plugins: [PrimeVue, pinia, router],
      // main.ts registers PrimeVue components globally; tests must do the same.
      components: { Button },
      // The history control and the plain markup around it are under test.
      stubs: { ItemHistoryControl: false, Button: false },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('ItemDetail version history', () => {
  let pinia: Pinia;
  let router: Router;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();

    versionRegistry.value = [LIVE, OLD];
    currentVersion.value = null;
    setCurrentVersion('ao-2024-02');
    useGameVersion().defaultVersion.value = 'ao-2024-02';

    mockApi.getItem = vi.fn(async () => ({ success: true, data: makeItem() }));
    mockApi.getItemRevisions = vi.fn(async () => REVISIONS);

    router = makeRouter();
    await router.push('/ao-2024-02/items/24562');
    await router.isReady();
  });

  it('renders a history entry per patch point, newest first', async () => {
    const wrapper = await mountItemDetail(router, pinia);

    expect(mockApi.getItemRevisions).toHaveBeenCalledWith(24562);

    await wrapper.find('[data-testid="item-history-trigger"]').trigger('click');
    const entries = wrapper.findAll('[data-testid="item-history-entry"]');

    expect(entries).toHaveLength(2);
    expect(entries[0].attributes('data-slug')).toBe('ao-2024-02');
    expect(entries[0].text()).toContain('current');
    expect(entries[1].attributes('data-slug')).toBe('ao-2019-11');
    expect(entries[1].text()).toContain('first seen');
  });

  it('peeking sets ?as and loads the item from that snapshot', async () => {
    const wrapper = await mountItemDetail(router, pinia);

    await wrapper.find('[data-testid="item-history-trigger"]').trigger('click');
    await wrapper
      .find('[data-testid="item-history-entry"][data-slug="ao-2019-11"]')
      .trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.query.as).toBe('ao-2019-11');
    expect(mockApi.getItem).toHaveBeenCalledWith(24562, { gameVersion: 'ao-2019-11' });
    expect(wrapper.find('[data-testid="item-peek-banner"]').text()).toContain(
      'Anarchy Online (Nov 2019)'
    );
  });

  it('interpolates against the peeked snapshot, and the browsing one otherwise', async () => {
    const wrapper = await mountItemDetail(router, pinia);

    const bar = wrapper.findComponent(ItemInterpolationBar);
    expect(bar.exists()).toBe(true);
    expect(bar.props('gameVersion')).toBeNull();

    await wrapper.find('[data-testid="item-history-trigger"]').trigger('click');
    await wrapper
      .find('[data-testid="item-history-entry"][data-slug="ao-2019-11"]')
      .trigger('click');
    await flushPromises();

    // The bar stays available while peeking and targets that snapshot.
    expect(wrapper.findComponent(ItemInterpolationBar).props('gameVersion')).toBe('ao-2019-11');
  });

  it('keeps other query params when peeking and when leaving the peek', async () => {
    await router.push('/ao-2024-02/items/24562?ql=150');
    const wrapper = await mountItemDetail(router, pinia);

    await wrapper.find('[data-testid="item-history-trigger"]').trigger('click');
    await wrapper
      .find('[data-testid="item-history-entry"][data-slug="ao-2019-11"]')
      .trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.query).toMatchObject({ ql: '150', as: 'ao-2019-11' });

    await wrapper.find('[data-testid="item-peek-exit"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.query.as).toBeUndefined();
    expect(router.currentRoute.value.query.ql).toBe('150');
  });

  it('offers the first snapshot that has an item missing from this version', async () => {
    mockApi.getItem = vi.fn(async () => ({ success: false, data: null }));
    mockApi.getItemRevisions = vi.fn(async () => ({
      ...REVISIONS,
      present_in: ['ao-2019-11'],
      first_seen_in: 'ao-2019-11',
      missing_in: ['ao-2024-02'],
      revisions: [REVISIONS.revisions[0]],
    }));

    const wrapper = await mountItemDetail(router, pinia);

    const message = wrapper.find('[data-testid="item-missing-in-version"]');
    expect(message.exists()).toBe(true);
    expect(message.text()).toContain('Not present in Anarchy Online (Feb 2024)');
    expect(message.text()).toContain('Anarchy Online (Nov 2019)');

    await wrapper.find('[data-testid="item-missing-view"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.query.as).toBe('ao-2019-11');
  });

  it('hides the history control when the item has a single patch point', async () => {
    mockApi.getItemRevisions = vi.fn(async () => ({
      ...REVISIONS,
      present_in: ['ao-2024-02'],
      first_seen_in: 'ao-2024-02',
      revisions: [REVISIONS.revisions[1]],
      missing_in: [],
    }));

    const wrapper = await mountItemDetail(router, pinia);

    expect(wrapper.find('[data-testid="item-history-trigger"]').exists()).toBe(false);
  });

  it('keeps the page usable when the revisions endpoint fails', async () => {
    mockApi.getItemRevisions = vi.fn(async () => {
      throw new Error('revisions unavailable');
    });

    const wrapper = await mountItemDetail(router, pinia);

    expect(wrapper.find('[data-testid="item-history-trigger"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="item-missing-in-version"]').exists()).toBe(false);
  });
});

describe('ItemHistoryControl labels', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    versionRegistry.value = [LIVE, OLD];
  });

  it('labels a point by what changed in it', async () => {
    const wrapper = mount(ItemHistoryControl, {
      props: { revisions: REVISIONS, requestVersion: 'ao-2019-11' },
      global: { plugins: [PrimeVue] },
    });

    await wrapper.find('[data-testid="item-history-trigger"]').trigger('click');
    const entries = wrapper.findAll('[data-testid="item-history-entry"]');

    // Peeked snapshot is "current"; the other point lists its changes.
    expect(entries[0].text()).toContain('stats, requirements');
    expect(entries[1].text()).toContain('current');
    // It is also where the item first appears, and that still shows.
    expect(entries[1].text()).toContain('first seen');
  });

  it('says what changed in the version being viewed, not just "current"', async () => {
    // A PRK snapshot that sorts ahead of the AO release it branches from.
    const prk: GameVersion = {
      ...LIVE,
      slug: 'prk-2026-01',
      display_name: 'Project Rubi-Ka (Jan 2026)',
      family: 'prk',
      parent_slug: 'ao-2024-02',
      snapshot_date: '2026-01-26',
      sort_order: 0,
      is_default: false,
      is_current: false,
    };
    versionRegistry.value = [prk, LIVE];

    const wrapper = mount(ItemHistoryControl, {
      props: {
        revisions: {
          aoid: 21793,
          present_in: ['ao-2024-02', 'prk-2026-01'],
          first_seen_in: 'ao-2024-02',
          missing_in: [],
          revisions: [
            { ...REVISIONS.revisions[1], changed: [], first_seen: true },
            {
              version_slug: 'prk-2026-01',
              display_name: 'Project Rubi-Ka (Jan 2026)',
              family: 'prk',
              snapshot_date: '2026-01-26',
              client_build: null,
              changed: ['stats'],
              first_seen: false,
            },
          ],
        },
        requestVersion: 'prk-2026-01',
      },
      global: { plugins: [PrimeVue] },
    });

    await wrapper.find('[data-testid="item-history-trigger"]').trigger('click');
    const entries = wrapper.findAll('[data-testid="item-history-entry"]');

    // Registry order: the PRK snapshot sorts first.
    expect(entries[0].attributes('data-slug')).toBe('prk-2026-01');
    expect(entries[0].text()).toContain('Project Rubi-Ka (Jan 2026) · current · stats');
    expect(entries[1].attributes('data-slug')).toBe('ao-2024-02');
    expect(entries[1].text()).toContain('first seen');
  });

  it('names the versions an item is missing from', async () => {
    const wrapper = mount(ItemHistoryControl, {
      props: {
        revisions: { ...REVISIONS, missing_in: ['ao-2019-11'] },
        requestVersion: 'ao-2024-02',
      },
      global: { plugins: [PrimeVue] },
    });

    await wrapper.find('[data-testid="item-history-trigger"]').trigger('click');
    expect(wrapper.find('[data-testid="item-history-missing"]').text()).toContain(
      'Anarchy Online (Nov 2019)'
    );
  });
});

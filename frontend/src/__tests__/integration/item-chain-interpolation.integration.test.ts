/**
 * An item chain on the item page.
 *
 * The rungs of a chain (the NCU belts, the NCU memory chips) are differently
 * named items that interpolate into one another: at a QL between two rungs the
 * API answers with the name, description and icon of the rung the item has
 * become. The page shows those, not the ones of the item it was opened on.
 * Real stores, router and interpolation bar, mocked API client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/services/api-client');

const mockToast = { add: vi.fn(), remove: vi.fn(), removeGroup: vi.fn(), removeAllGroups: vi.fn() };
vi.mock('primevue/usetoast', () => ({ useToast: () => mockToast }));

import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import PrimeVue from 'primevue/config';
import Card from 'primevue/card';
import ItemDetail from '@/views/ItemDetail.vue';
import ItemSlotsDisplay from '@/components/items/ItemSlotsDisplay.vue';
import { apiClient } from '@/services/api-client';
import interpolationService from '@/services/interpolation-service';
import {
  versions as versionRegistry,
  currentVersion,
  setCurrentVersion,
  useGameVersion,
} from '@/composables/useGameVersion';
import type { InterpolatedItem, Item } from '@/types/api';
import { DIFF_REGISTRY, emptyTimeline } from '../helpers/change-fixtures';

const mockApi = vi.mocked(apiClient);

const ICON = 79;
const TI_200X = 36782;
const BELT_300X = 36777;
const BELT_SLOTS = 45;

function slots(amount: number): Item['spell_data'] {
  return [
    {
      event: 14,
      spells: [
        {
          spell_id: 53045,
          target: 2,
          tick_count: 1,
          tick_interval: 0,
          spell_format: 'Modify {Stat} {Amount}',
          spell_params: { Stat: BELT_SLOTS, Amount: amount },
          criteria: [],
        },
      ],
    },
  ] as Item['spell_data'];
}

const ti200x: Item = {
  aoid: TI_200X,
  name: 'Belt Component Platform Ti-200X',
  description: 'Two slots.',
  ql: 20,
  item_class: 0,
  is_nano: false,
  stats: [{ stat: ICON, value: 119145 }],
  spell_data: slots(2),
  actions: [],
  attack_stats: [],
  defense_stats: [],
};

/** What the API answers for the Ti-200X at a QL between it and the 300X. */
function interpolated(ql: number): InterpolatedItem {
  const is300x = ql >= 30;
  return {
    aoid: TI_200X,
    name: is300x ? 'Belt Component Platform 300X' : ti200x.name,
    description: is300x ? 'Three slots.' : ti200x.description,
    ql,
    item_class: 0,
    is_nano: false,
    interpolating: true,
    low_ql: 20,
    high_ql: 40,
    target_ql: ql,
    ql_delta: ql - 20,
    ql_delta_full: 20,
    stats: [{ stat: ICON, value: is300x ? 119142 : 119145 }],
    spell_data: slots(is300x ? 3 : 2),
    actions: [],
  } as InterpolatedItem;
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

async function openItemPage(router: Router, pinia: Pinia, query: string): Promise<VueWrapper> {
  await router.push(`/ao-14-6-0/items/${TI_200X}${query}`);
  await router.isReady();
  const wrapper = mount(ItemDetail, {
    props: { aoid: String(TI_200X) },
    shallow: true,
    global: {
      plugins: [PrimeVue, pinia, router],
      components: { Card },
      stubs: { ItemInterpolationBar: false, Card: false },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('item page: a QL along an item chain', () => {
  let pinia: Pinia;
  let router: Router;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
    interpolationService.clearAllCaches();

    versionRegistry.value = DIFF_REGISTRY;
    currentVersion.value = null;
    await setCurrentVersion('ao-14-6-0');
    useGameVersion().defaultVersion.value = 'ao-14-6-0';

    mockApi.getItem.mockResolvedValue({ success: true, data: ti200x });
    mockApi.getItemTimeline.mockResolvedValue(emptyTimeline(TI_200X));
    mockApi.getInterpolationInfo.mockResolvedValue({
      success: true,
      data: {
        aoid: TI_200X,
        interpolatable: true,
        min_ql: 20,
        max_ql: 40,
        ql_range: 21,
        ranges: [
          { min_ql: 20, max_ql: 40, interpolatable: true, base_aoid: TI_200X },
          { min_ql: 40, max_ql: 40, interpolatable: false, base_aoid: BELT_300X },
        ],
      },
    });
    mockApi.interpolateItem.mockImplementation(async (_aoid: number, ql: number) => ({
      success: true,
      item: interpolated(ql),
    }));
    router = makeRouter();
  });

  it('shows the name, description and icon of the rung the item has become', async () => {
    const wrapper = await openItemPage(router, pinia, '?ql=30');

    expect(mockApi.interpolateItem).toHaveBeenCalledWith(TI_200X, 30);
    expect(wrapper.find('[data-testid="item-heading"]').text()).toBe(
      'Belt Component Platform 300X'
    );
    expect(wrapper.text()).toContain('Three slots.');
    expect(wrapper.text()).not.toContain('Two slots.');
    const shown = wrapper.findComponent(ItemSlotsDisplay).props('item') as Item;
    expect(shown.name).toBe('Belt Component Platform 300X');
    expect(shown.stats).toEqual([{ stat: ICON, value: 119142 }]);
  });

  it('keeps the name of the item below the QL at which the next rung takes over', async () => {
    const wrapper = await openItemPage(router, pinia, '?ql=29');

    expect(mockApi.interpolateItem).toHaveBeenCalledWith(TI_200X, 29);
    expect(wrapper.find('[data-testid="item-heading"]').text()).toBe(ti200x.name);
    expect(wrapper.text()).toContain('Two slots.');
  });

  it('shows the item as it is at its own QL', async () => {
    const wrapper = await openItemPage(router, pinia, '');

    expect(mockApi.interpolateItem).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="item-heading"]').text()).toBe(ti200x.name);
    expect((wrapper.findComponent(ItemSlotsDisplay).props('item') as Item).name).toBe(ti200x.name);
  });
});

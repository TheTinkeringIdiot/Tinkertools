/**
 * Item Interpolation Workflow Tests
 *
 * The user journey on an item page: open an item at a QL from the URL, change
 * the QL, cross into another QL range (a different base item), and recover
 * from bad input. Real stores and real interpolation service; only the API
 * client is mocked, serving an Otek Slicer shaped like the backend's data.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/services/api-client');

const mockToast = { add: vi.fn(), remove: vi.fn(), removeGroup: vi.fn(), removeAllGroups: vi.fn() };
vi.mock('primevue/usetoast', () => ({ useToast: () => mockToast }));

import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import PrimeVue from 'primevue/config';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Card from 'primevue/card';
import InputNumber from 'primevue/inputnumber';
import ItemDetail from '@/views/ItemDetail.vue';
import WeaponStats from '@/components/items/WeaponStats.vue';
import ActionRequirements from '@/components/ActionRequirements.vue';
import { apiClient } from '@/services/api-client';
import interpolationService from '@/services/interpolation-service';
import type {
  InterpolatedItem,
  InterpolationInfo,
  InterpolationRange,
  Item,
  UserFriendlyError,
} from '@/types/api';
import {
  createAction,
  createCriterion,
  createStatValue,
  createWeaponItem,
} from '../helpers/item-fixtures';
import { TEST_VERSION } from '../helpers/version-fixtures';

const mockApi = vi.mocked(apiClient);

// ============================================================================
// Otek Slicer fixture: one base item per patch point, as the backend has it
// ============================================================================

const QL_STAT = 54;
const DAMAGE_STAT = 285;
const ONE_HAND_EDGED = 103;
const WIELD_ACTION = 6;

const BASES = [
  { aoid: 262757, ql: 1 },
  { aoid: 262758, ql: 99 },
  { aoid: 262759, ql: 100 },
  { aoid: 262760, ql: 199 },
  { aoid: 262761, ql: 200 },
  { aoid: 262762, ql: 299 },
  { aoid: 262763, ql: 300 },
];

/** Stat values scale with QL, so an interpolated item is recognisable by them. */
const damageAt = (ql: number) => 100 + ql;
const requirementAt = (ql: number) => 5 * ql;

function otekAt(aoid: number, ql: number): Item {
  return createWeaponItem({
    id: aoid,
    aoid,
    name: 'Otek Slicer',
    ql,
    stats: [createStatValue(QL_STAT, ql, 1), createStatValue(DAMAGE_STAT, damageAt(ql), 2)],
    actions: [
      createAction({
        id: 1,
        action: WIELD_ACTION,
        criteria: [createCriterion(ONE_HAND_EDGED, requirementAt(ql), 2, 1)],
      }),
    ],
  });
}

const RANGES: InterpolationRange[] = BASES.map((base, index) => ({
  min_ql: base.ql,
  max_ql: (BASES[index + 1] ?? base).ql,
  interpolatable: index < BASES.length - 1,
  base_aoid: base.aoid,
}));

const OTEK_INFO: InterpolationInfo = {
  aoid: 262759,
  interpolatable: true,
  ranges: RANGES,
  min_ql: 1,
  max_ql: 300,
  ql_range: 300,
};

/** What the backend returns: the item at the target QL, based on the lower patch point. */
function interpolatedOtek(ql: number): InterpolatedItem {
  const low = [...BASES].reverse().find((base) => base.ql <= ql) ?? BASES[0];
  const high = BASES.find((base) => base.ql > low.ql) ?? low;
  const item = otekAt(low.aoid, ql);
  return {
    ...item,
    interpolating: high !== low,
    low_ql: low.ql,
    high_ql: high.ql,
    target_ql: ql,
    spell_data: [],
    actions: item.actions.map((action) => ({ action: action.action, criteria: action.criteria })),
  };
}

const NOT_FOUND: UserFriendlyError = {
  type: 'info',
  title: 'Not Found',
  message: 'Item not found',
  action: 'Check the item ID',
  recoverable: true,
};

// ============================================================================
// Mounting
// ============================================================================

function makeRouter(): Router {
  const blank = { template: '<div />' };
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/:version/items', name: 'TinkerItems', component: blank },
      { path: '/:version/items/:aoid', name: 'ItemDetail', component: blank },
    ],
  });
}

let router: Router;
let wrapper: VueWrapper | null = null;

async function openItem(aoid: number, ql?: number): Promise<VueWrapper> {
  await router.push({
    path: `/${TEST_VERSION}/items/${aoid}`,
    query: ql === undefined ? {} : { ql: String(ql) },
  });

  wrapper = mount(ItemDetail, {
    shallow: true,
    global: {
      plugins: [PrimeVue, router],
      // main.ts registers these PrimeVue components globally
      components: { Badge, Button, Card },
      // Render the page header and the interpolation controls; stub the rest
      stubs: {
        ItemInterpolationBar: false,
        Badge: false,
        Button: false,
        Card: false,
        InputNumber: false,
        Slider: false,
      },
    },
  });
  await settle();
  return wrapper;
}

/** Let loading, interpolation and navigation (including chained ones) finish. */
async function settle() {
  for (let i = 0; i < 5; i++) {
    await flushPromises();
  }
}

/** Type a QL into the interpolation bar's QL field and wait out its debounce. */
async function enterQl(page: VueWrapper, ql: number) {
  page.findComponent(InputNumber).vm.$emit('update:modelValue', ql);
  await new Promise((resolve) => setTimeout(resolve, 600));
  await settle();
}

function headerQl(page: VueWrapper): string {
  return page.find('h1').element.parentElement!.textContent ?? '';
}

function shownItem(page: VueWrapper): Item {
  return page.findComponent(WeaponStats).props('item') as Item;
}

// ============================================================================
// Tests
// ============================================================================

describe('Item Interpolation Workflow', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    interpolationService.clearAllCaches();
    router = makeRouter();

    mockApi.getItem.mockImplementation(async (aoid: number) => {
      const base = BASES.find((b) => b.aoid === aoid);
      if (!base) throw NOT_FOUND;
      return { success: true, data: otekAt(base.aoid, base.ql) };
    });
    mockApi.getInterpolationInfo.mockResolvedValue({ success: true, data: OTEK_INFO });
    mockApi.checkItemInterpolatable.mockResolvedValue(true);
    mockApi.interpolateItem.mockImplementation(async (_aoid: number, ql: number) => ({
      success: true,
      item: interpolatedOtek(ql),
    }));
    mockApi.getItemRevisions.mockRejectedValue(new Error('no revision history'));
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
  });

  describe('Opening an item', () => {
    it('shows the base item at its own QL when the URL has none', async () => {
      const page = await openItem(262759);

      expect(headerQl(page)).toContain('QL 100');
      expect(page.text()).toContain('Original');
      expect(page.text()).toContain('Range: 100-199');
      expect(mockApi.interpolateItem).not.toHaveBeenCalled();
      expect(shownItem(page).ql).toBe(100);
    });

    it('interpolates to the QL given in the URL', async () => {
      const page = await openItem(262759, 150);

      expect(mockApi.interpolateItem).toHaveBeenCalledWith(262759, 150);
      expect(headerQl(page)).toContain('QL 150');
      expect(page.text()).toContain('Interpolated');

      const shown = shownItem(page);
      expect(shown.ql).toBe(150);
      expect(shown.stats.find((s) => s.stat === DAMAGE_STAT)?.value).toBe(damageAt(150));

      // Requirements follow the interpolated QL too
      const actions = page.findComponent(ActionRequirements).props('actions') as Item['actions'];
      expect(actions[0].criteria[0].value2).toBe(requirementAt(150));
      expect(router.currentRoute.value.query.ql).toBe('150');
    });

    it('clamps a QL beyond the item maximum to the top QL', async () => {
      const page = await openItem(262759, 9999);

      expect(router.currentRoute.value.query.ql).toBe('300');
      expect(headerQl(page)).toContain('QL 300');
      expect(shownItem(page).ql).toBe(300);
    });

    it('reports an item that does not exist', async () => {
      const page = await openItem(999999);

      expect(page.text()).toContain('Failed to Load Item');
      expect(page.text()).toContain('Item not found');
      expect(page.findComponent(WeaponStats).exists()).toBe(false);
    });
  });

  describe('Changing the QL', () => {
    it('interpolates within the range and records the QL in the URL', async () => {
      const page = await openItem(262759);

      await enterQl(page, 175);

      expect(mockApi.interpolateItem).toHaveBeenCalledWith(262759, 175);
      expect(router.currentRoute.value.params.aoid).toBe('262759');
      expect(router.currentRoute.value.query.ql).toBe('175');
      expect(headerQl(page)).toContain('QL 175');
      expect(shownItem(page).stats.find((s) => s.stat === DAMAGE_STAT)?.value).toBe(damageAt(175));
    });

    it('moves to the base item of another range', async () => {
      const page = await openItem(262759);

      await enterQl(page, 250);

      // The 200-299 range is defined by a different base item
      expect(router.currentRoute.value.params.aoid).toBe('262761');
      expect(router.currentRoute.value.query.ql).toBe('250');
      expect(mockApi.getItem).toHaveBeenCalledWith(262761);
      expect(mockApi.interpolateItem).toHaveBeenCalledWith(262761, 250);
      expect(headerQl(page)).toContain('QL 250');
      expect(shownItem(page).aoid).toBe(262761);
      expect(shownItem(page).ql).toBe(250);
    });

    it('opens the base item defined at a boundary QL', async () => {
      const page = await openItem(262759);

      // QL 200 ends the 199-200 range but is where the 200-299 base item is defined
      await enterQl(page, 200);

      expect(router.currentRoute.value.params.aoid).toBe('262761');
      expect(router.currentRoute.value.query.ql).toBe('200');
      expect(shownItem(page).aoid).toBe(262761);
      expect(page.text()).toContain('Range: 200-299');
    });

    it('settles on the last of several quick changes', async () => {
      const page = await openItem(262759);

      for (const ql of [140, 145, 150, 155]) {
        page.findComponent(InputNumber).vm.$emit('update:modelValue', ql);
      }
      await enterQl(page, 160);

      // Debounced: only the final value reaches the backend
      expect(mockApi.interpolateItem).toHaveBeenCalledTimes(1);
      expect(mockApi.interpolateItem).toHaveBeenCalledWith(262759, 160);
      expect(router.currentRoute.value.query.ql).toBe('160');
      expect(shownItem(page).ql).toBe(160);
    });

    it('keeps showing the base item when interpolation fails', async () => {
      mockApi.interpolateItem.mockResolvedValue({ success: false, error: 'Interpolation failed' });
      const page = await openItem(262759);

      await enterQl(page, 175);

      expect(shownItem(page).ql).toBe(100);
      expect(shownItem(page).stats.find((s) => s.stat === DAMAGE_STAT)?.value).toBe(damageAt(100));
      // A failed attempt is not recorded as the item's QL
      expect(router.currentRoute.value.query.ql).toBeUndefined();
    });
  });
});

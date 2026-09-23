/**
 * ItemInterpolationBar Component Tests
 *
 * Mounts the real component with real PrimeVue controls, the real
 * interpolation service and a real router; only the API client is mocked.
 * Covers what a user sees and what happens when they pick a quality level:
 * interpolating within the current range, jumping to another base item when
 * the QL crosses into a different range, and error reporting.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import PrimeVue from 'primevue/config';
import Tooltip from 'primevue/tooltip';
import InputNumber from 'primevue/inputnumber';
import Slider from 'primevue/slider';
import Button from 'primevue/button';
import ItemInterpolationBar from '../items/ItemInterpolationBar.vue';
import type {
  ApiResponse,
  Item,
  InterpolatedItem,
  InterpolationInfo,
  InterpolationResponse,
} from '../../types/api';
import { interpolationService } from '../../services/interpolation-service';
import { TEST_VERSION } from '../../__tests__/helpers/version-fixtures';

vi.mock('../../services/api-client', () => ({
  apiClient: {
    getInterpolationInfo: vi.fn(),
    interpolateItem: vi.fn(),
  },
}));

import { apiClient } from '../../services/api-client';

const mockGetInterpolationInfo = vi.mocked(apiClient.getInterpolationInfo);
const mockInterpolateItem = vi.mocked(apiClient.interpolateItem);

const BASE_AOID = 12345;
const DEBOUNCE_MS = 500;

const mockItem: Item = {
  id: 1,
  aoid: BASE_AOID,
  name: 'Test Weapon',
  ql: 150,
  description: 'A test weapon',
  item_class: 1,
  is_nano: false,
  stats: [{ id: 1, stat: 1, value: 100 }],
  spell_data: [],
  actions: [],
  attack_stats: [],
  defense_stats: [],
  sources: [],
};

const mockInfo: InterpolationInfo = {
  aoid: BASE_AOID,
  interpolatable: true,
  min_ql: 1,
  max_ql: 299,
  ql_range: 298,
  ranges: [
    { min_ql: 1, max_ql: 99, interpolatable: true, base_aoid: 12340 },
    { min_ql: 100, max_ql: 199, interpolatable: true, base_aoid: BASE_AOID },
    { min_ql: 200, max_ql: 299, interpolatable: true, base_aoid: 12350 },
  ],
};

const mockInterpolatedItem: InterpolatedItem = {
  id: 1,
  aoid: BASE_AOID,
  name: 'Test Weapon',
  ql: 175,
  is_nano: false,
  interpolating: true,
  low_ql: 100,
  high_ql: 199,
  target_ql: 175,
  ql_delta: 75,
  ql_delta_full: 99,
  stats: [{ id: 1, stat: 1, value: 125 }],
};

function infoResponse(info: InterpolationInfo): ApiResponse<InterpolationInfo> {
  return { success: true, data: info };
}

describe('ItemInterpolationBar', () => {
  let router: Router;
  let wrapper: VueWrapper | undefined;

  beforeEach(async () => {
    interpolationService.clearAllCaches();
    mockGetInterpolationInfo.mockResolvedValue(infoResponse(mockInfo));
    mockInterpolateItem.mockResolvedValue({
      success: true,
      item: mockInterpolatedItem,
    } satisfies InterpolationResponse);

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/:version/items/:aoid',
          name: 'ItemDetail',
          component: { template: '<div />' },
        },
      ],
    });
    await router.push(`/${TEST_VERSION}/items/${BASE_AOID}`);
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.useRealTimers();
  });

  async function mountBar(props: Record<string, unknown> = {}): Promise<VueWrapper> {
    wrapper = mount(ItemInterpolationBar, {
      props: { item: mockItem, showResetButton: true, ...props },
      global: {
        plugins: [router, PrimeVue],
        directives: { tooltip: Tooltip },
      },
    });
    await flushPromises();
    return wrapper;
  }

  /** Simulates the user typing a QL, then waits out the input debounce. */
  async function enterQl(bar: VueWrapper, ql: number): Promise<void> {
    vi.useFakeTimers();
    bar.findComponent(InputNumber).vm.$emit('update:modelValue', ql);
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
    vi.useRealTimers();
    await flushPromises();
  }

  describe('Rendering', () => {
    it('renders nothing for an item that cannot be interpolated', async () => {
      mockGetInterpolationInfo.mockResolvedValue(
        infoResponse({ ...mockInfo, interpolatable: false, ranges: [] })
      );
      const bar = await mountBar();

      expect(bar.find('.interpolation-bar').exists()).toBe(false);
    });

    it('shows the QL controls, the full QL span and the current range', async () => {
      const bar = await mountBar();

      expect(bar.find('.interpolation-bar').exists()).toBe(true);
      expect(bar.findComponent(InputNumber).props('modelValue')).toBe(150);
      expect(bar.findComponent(Slider).props('min')).toBe(1);
      expect(bar.findComponent(Slider).props('max')).toBe(299);
      expect(bar.text()).toContain('Range: 100-199');
    });

    it('labels the item as original while its own QL is selected', async () => {
      const bar = await mountBar();

      expect(bar.text()).toContain('Original');
      expect(bar.text()).not.toContain('Interpolated');
    });

    it('requests interpolation info for the peeked game version', async () => {
      await mountBar({ gameVersion: 'prk' });

      expect(mockGetInterpolationInfo).toHaveBeenCalledWith(BASE_AOID, { gameVersion: 'prk' });
    });
  });

  describe('Changing QL within the current range', () => {
    it('interpolates once after the user stops typing', async () => {
      const bar = await mountBar();

      vi.useFakeTimers();
      const input = bar.findComponent(InputNumber);
      input.vm.$emit('update:modelValue', 160);
      input.vm.$emit('update:modelValue', 170);
      input.vm.$emit('update:modelValue', 175);
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
      expect(mockInterpolateItem).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      vi.useRealTimers();
      await flushPromises();

      expect(mockInterpolateItem).toHaveBeenCalledTimes(1);
      expect(mockInterpolateItem).toHaveBeenCalledWith(BASE_AOID, 175);
    });

    it('emits the interpolated item, marks it interpolated and records the QL in the URL', async () => {
      const bar = await mountBar();

      await enterQl(bar, 175);

      expect(bar.emitted('item-update')).toEqual([[mockInterpolatedItem]]);
      expect(bar.text()).toContain('Interpolated');
      expect(router.currentRoute.value.query.ql).toBe('175');
      expect(router.currentRoute.value.params.aoid).toBe(String(BASE_AOID));
    });

    it('interpolates when the user releases the slider', async () => {
      const bar = await mountBar();

      const slider = bar.findComponent(Slider);
      slider.vm.$emit('update:modelValue', 180);
      slider.vm.$emit('slideend', { originalEvent: new Event('mouseup'), value: 180 });
      await flushPromises();

      expect(mockInterpolateItem).toHaveBeenCalledWith(BASE_AOID, 180);
    });

    it('interpolates against the peeked game version', async () => {
      const bar = await mountBar({ gameVersion: 'prk' });

      await enterQl(bar, 175);

      expect(mockInterpolateItem).toHaveBeenCalledWith(BASE_AOID, 175, { gameVersion: 'prk' });
    });
  });

  describe('Changing QL into another range', () => {
    it('navigates to the base item for that range instead of interpolating', async () => {
      const bar = await mountBar();

      await enterQl(bar, 250);

      expect(mockInterpolateItem).not.toHaveBeenCalled();
      expect(router.currentRoute.value.params.aoid).toBe('12350');
      expect(router.currentRoute.value.params.version).toBe(TEST_VERSION);
      expect(router.currentRoute.value.query.ql).toBe('250');
    });
  });

  describe('Initial QL from the URL', () => {
    it('interpolates straight away when the initial QL differs from the item QL', async () => {
      const bar = await mountBar({ initialQl: 175 });

      expect(bar.findComponent(InputNumber).props('modelValue')).toBe(175);
      expect(mockInterpolateItem).toHaveBeenCalledWith(BASE_AOID, 175);
      expect(bar.emitted('item-update')).toEqual([[mockInterpolatedItem]]);
    });

    it('clamps an initial QL above the maximum', async () => {
      const bar = await mountBar({ initialQl: 999 });

      expect(bar.findComponent(InputNumber).props('modelValue')).toBe(299);
    });
  });

  describe('Errors', () => {
    it('reports an API failure', async () => {
      mockInterpolateItem.mockRejectedValue(new Error('API Error'));
      const bar = await mountBar();

      await enterQl(bar, 175);

      expect(bar.emitted('error')).toEqual([['API Error']]);
      expect(bar.emitted('item-update')).toBeUndefined();
    });

    it('reports the error from an unsuccessful interpolation response', async () => {
      mockInterpolateItem.mockResolvedValue({ success: false, error: 'Item not found' });
      const bar = await mountBar();

      await enterQl(bar, 175);

      expect(bar.emitted('error')).toEqual([['Item not found']]);
    });

    it('reports a QL outside every range', async () => {
      mockGetInterpolationInfo.mockResolvedValue(
        infoResponse({ ...mockInfo, ranges: [mockInfo.ranges[1]] })
      );
      const bar = await mountBar();

      await enterQl(bar, 250);

      expect(bar.emitted('error')).toEqual([['Invalid QL for this item']]);
      expect(mockInterpolateItem).not.toHaveBeenCalled();
    });
  });

  describe('Reset', () => {
    it('restores the item QL, clears the interpolated item and drops QL from the URL', async () => {
      const bar = await mountBar({ initialQl: 175 });
      expect(router.currentRoute.value.query.ql).toBe('175');

      const reset = bar.findAllComponents(Button).find((b) => b.props('icon') === 'pi pi-refresh');
      expect(reset).toBeDefined();
      await reset!.trigger('click');
      await flushPromises();

      expect(bar.findComponent(InputNumber).props('modelValue')).toBe(150);
      expect(bar.emitted('item-update')?.at(-1)).toEqual([null]);
      expect(router.currentRoute.value.query.ql).toBeUndefined();
      expect(bar.text()).toContain('Original');
    });
  });
});

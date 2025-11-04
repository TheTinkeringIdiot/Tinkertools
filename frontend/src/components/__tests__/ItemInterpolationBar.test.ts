/**
 * ItemInterpolationBar Component Tests
 *
 * Tests the new simplified interpolation component functionality including
 * range transitions, debounced input, and API integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import ItemInterpolationBar from '../items/ItemInterpolationBar.vue';
import type { Item, InterpolatedItem, InterpolationRange } from '../../types/api';

// Mock the useInterpolation composable
vi.mock('../../composables/useInterpolation', () => ({
  useInterpolation: vi.fn(),
}));

// Mock the API client
vi.mock('../../services/api-client', () => ({
  apiClient: {
    interpolateItem: vi.fn(),
  },
}));

// Mock PrimeVue components
vi.mock('primevue/inputnumber', () => ({
  default: {
    name: 'InputNumber',
    template:
      '<input type="number" v-model="modelValue" @update:model-value="$emit(\'update:model-value\', $event)" />',
    props: ['modelValue', 'min', 'max', 'placeholder'],
    emits: ['update:model-value'],
  },
}));

vi.mock('primevue/slider', () => ({
  default: {
    name: 'Slider',
    template:
      '<input type="range" v-model="modelValue" @update:model-value="$emit(\'update:model-value\', $event)" />',
    props: ['modelValue', 'min', 'max', 'step'],
    emits: ['update:model-value'],
  },
}));

vi.mock('primevue/badge', () => ({
  default: {
    name: 'Badge',
    template: '<span class="p-badge">{{ value }}</span>',
    props: ['value', 'severity', 'size'],
  },
}));

import { apiClient } from '../../services/api-client';
import { useInterpolation } from '../../composables/useInterpolation';

const mockApiClient = apiClient as {
  interpolateItem: ReturnType<typeof vi.fn>;
};

const mockUseInterpolation = useInterpolation as ReturnType<typeof vi.fn>;

describe('ItemInterpolationBar', () => {
  const mockItem: Item = {
    id: 1,
    aoid: 12345,
    name: 'Test Weapon',
    ql: 150,
    description: 'A test weapon',
    item_class: 1,
    is_nano: false,
    stats: [{ id: 1, stat: 1, value: 100 }],
    spell_data: [],
    actions: [],
  };

  const mockRanges: InterpolationRange[] = [
    {
      min_ql: 1,
      max_ql: 99,
      base_aoid: 12340,
    },
    {
      min_ql: 100,
      max_ql: 199,
      base_aoid: 12345,
    },
    {
      min_ql: 200,
      max_ql: 299,
      base_aoid: 12350,
    },
  ];

  const mockInterpolatedItem: InterpolatedItem = {
    ...mockItem,
    interpolating: true,
    low_ql: 100,
    high_ql: 199,
    target_ql: 175,
    ql_delta: 75,
    ql_delta_full: 100,
    stats: [{ id: 1, stat: 1, value: 125 }],
  };

  let router: any;
  let wrapper: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create a mock router
    router = createRouter({
      history: createWebHistory(),
      routes: [{ path: '/items/:aoid', name: 'ItemDetail', component: { template: '<div />' } }],
    });

    mockApiClient.interpolateItem.mockResolvedValue({
      success: true,
      item: mockInterpolatedItem,
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
    vi.useRealTimers();
  });

  const createWrapper = (props = {}) => {
    return mount(ItemInterpolationBar, {
      props: {
        item: mockItem,
        initialQl: 150,
        showResetButton: true,
        ...props,
      },
      global: {
        plugins: [router],
      },
    });
  };

  describe('Component Initialization', () => {
    it('should mount without errors', () => {
      wrapper = createWrapper();
      expect(wrapper.exists()).toBe(true);
    });

    it('should initialize with correct QL value from item', () => {
      wrapper = createWrapper();
      expect(wrapper.vm.localTargetQl).toBe(150);
    });

    it('should compute correct min/max values from ranges', () => {
      wrapper = createWrapper();
      expect(wrapper.vm.minQl).toBe(1);
      expect(wrapper.vm.maxQl).toBe(299);
    });

    it('should identify current range correctly', () => {
      wrapper = createWrapper();
      const currentRange = wrapper.vm.currentRange;
      expect(currentRange.min_ql).toBe(100);
      expect(currentRange.max_ql).toBe(199);
      expect(currentRange.base_aoid).toBe(12345);
    });

    it('should show interpolated badge when item is interpolated', () => {
      const interpolatedItem = { ...mockItem, interpolating: true };
      wrapper = createWrapper({ item: interpolatedItem });

      const badge = wrapper.find('.p-badge');
      expect(badge.exists()).toBe(true);
      expect(badge.text()).toContain('Interpolated');
    });
  });

  describe('Input Handling', () => {
    it('should update local QL when slider changes', async () => {
      wrapper = createWrapper();

      const slider = wrapper.find('input[type="range"]');
      await slider.setValue('175');
      await slider.trigger('update:model-value');

      expect(wrapper.vm.localTargetQl).toBe(175);
    });

    it('should update local QL when input field changes', async () => {
      wrapper = createWrapper();

      const input = wrapper.find('input[type="number"]');
      await input.setValue('175');
      await input.trigger('update:model-value');

      expect(wrapper.vm.localTargetQl).toBe(175);
    });

    it('should debounce rapid input changes', async () => {
      wrapper = createWrapper();

      // Trigger multiple rapid changes
      await wrapper.vm.debouncedQlChange();
      await wrapper.vm.debouncedQlChange();
      await wrapper.vm.debouncedQlChange();

      // No API calls yet
      expect(mockApiClient.interpolateItem).not.toHaveBeenCalled();

      // Advance timers to trigger debounced call
      vi.advanceTimersByTime(301);
      await nextTick();

      // Should only make one API call
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('Range Transitions', () => {
    it('should navigate to different base item when crossing ranges', async () => {
      wrapper = createWrapper();
      const mockPush = vi.spyOn(router, 'push').mockResolvedValue();

      // Change to QL that's in a different range (250 -> range 200-299 with base_aoid 12350)
      wrapper.vm.localTargetQl = 250;
      await wrapper.vm.handleQlChange();

      expect(mockPush).toHaveBeenCalledWith({
        path: '/items/12350',
        query: { ql: '250' },
      });
      expect(mockApiClient.interpolateItem).not.toHaveBeenCalled();
    });

    it('should interpolate when staying within same range', async () => {
      wrapper = createWrapper();
      const mockReplace = vi.spyOn(router, 'replace').mockResolvedValue();

      // Change to QL within same range (175 -> still in 100-199 range)
      wrapper.vm.localTargetQl = 175;
      await wrapper.vm.handleQlChange();

      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(12345, 175);
      expect(mockReplace).toHaveBeenCalledWith({
        path: expect.any(String),
        query: expect.objectContaining({ ql: '175' }),
      });
    });

    it('should emit item-update event after successful interpolation', async () => {
      wrapper = createWrapper();

      wrapper.vm.localTargetQl = 175;
      await wrapper.vm.handleQlChange();
      await nextTick();

      expect(wrapper.emitted('item-update')).toBeTruthy();
      expect(wrapper.emitted('item-update')[0]).toEqual([mockInterpolatedItem]);
    });

    it('should emit error event for invalid QL', async () => {
      wrapper = createWrapper();

      // QL outside all ranges
      wrapper.vm.localTargetQl = 500;
      await wrapper.vm.handleQlChange();

      expect(wrapper.emitted('error')).toBeTruthy();
      expect(wrapper.emitted('error')[0][0]).toContain('Invalid QL');
    });
  });

  describe('Error Handling', () => {
    it('should handle API interpolation errors', async () => {
      mockApiClient.interpolateItem.mockRejectedValue(new Error('API Error'));
      wrapper = createWrapper();

      wrapper.vm.localTargetQl = 175;
      await wrapper.vm.handleQlChange();

      expect(wrapper.emitted('error')).toBeTruthy();
      expect(wrapper.emitted('error')[0][0]).toContain('Failed to interpolate item');
    });

    it('should handle unsuccessful interpolation response', async () => {
      mockApiClient.interpolateItem.mockResolvedValue({
        success: false,
        error: 'Item not found',
      });
      wrapper = createWrapper();

      wrapper.vm.localTargetQl = 175;
      await wrapper.vm.handleQlChange();

      expect(wrapper.emitted('error')).toBeTruthy();
      expect(wrapper.emitted('error')[0][0]).toBe('Item not found');
    });
  });

  describe('Prop Updates', () => {
    it('should update local QL when item prop changes', async () => {
      wrapper = createWrapper();

      const newItem = { ...mockItem, ql: 200 };
      await wrapper.setProps({ item: newItem });

      expect(wrapper.vm.localTargetQl).toBe(200);
    });

    it('should handle item without QL', async () => {
      const itemWithoutQl = { ...mockItem, ql: undefined };
      wrapper = createWrapper({ item: itemWithoutQl });

      expect(wrapper.vm.localTargetQl).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty interpolation ranges', () => {
      wrapper = createWrapper({ interpolationRanges: [] });

      expect(wrapper.vm.minQl).toBe(1);
      expect(wrapper.vm.maxQl).toBe(300);
      expect(wrapper.vm.currentRange).toBeUndefined();
    });

    it('should handle ranges without base_aoid', () => {
      const rangesWithoutBaseAoid = [{ min_ql: 100, max_ql: 200 }];
      wrapper = createWrapper({
        interpolationRanges: rangesWithoutBaseAoid,
        itemAoid: undefined,
      });

      wrapper.vm.localTargetQl = 150;
      wrapper.vm.handleQlChange();

      expect(wrapper.emitted('error')).toBeTruthy();
    });
  });
});

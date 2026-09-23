/**
 * TinkerItems Full Integration Tests
 *
 * TRUE INTEGRATION TEST - Requires real backend
 * Runs the real API client, items store and TinkerItems view against a live
 * backend (scoped to the test game version), to catch contract drift between
 * frontend and backend.
 *
 * Skipped when the backend is not available.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import TinkerItems from '@/views/TinkerItems.vue';
import { apiClient } from '@/services/api-client';
import { useItemsStore } from '@/stores/items';
import { versionedPath } from '@/composables/useGameVersion';
import type { Criterion } from '@/types/api';
import { isBackendAvailable } from '../helpers/backend-check';
import { appGlobals } from '../helpers/app-globals';
import { createTestRouter } from '../helpers/vue-test-utils';
import { itemSearchForm } from '../helpers/item-search-page';

// Top-level await: describe.skipIf reads this while tests are collected.
const BACKEND_AVAILABLE = await isBackendAvailable();

/** Otek Slicer: an interpolatable weapon with several QL ranges. */
const OTEK_SLICER = 262759;

/** The criterion values of an item's first action that has requirements. */
function firstRequirementValues(item: { actions: { criteria: Criterion[] }[] }): number[] {
  const action = item.actions.find((candidate) => candidate.criteria.length > 0);
  return action ? action.criteria.map((criterion) => criterion.value2) : [];
}

describe.skipIf(!BACKEND_AVAILABLE)('TinkerItems Full Integration', () => {
  let pinia: Pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  describe('Item search API', () => {
    it('finds items by name', async () => {
      const response = await apiClient.searchItems({
        search: 'implant',
        exact_match: false,
        search_fields: ['name', 'description'],
        limit: 5,
      });

      expect(response.total).toBeGreaterThan(0);
      expect(response.items.length).toBeGreaterThan(0);
      expect(response.items.length).toBeLessThanOrEqual(5);
      for (const item of response.items) {
        expect(item.aoid).toEqual(expect.any(Number));
        expect(item.name).toEqual(expect.any(String));
        expect(item.ql).toEqual(expect.any(Number));
      }
    });

    it('applies quality level and item class filters', async () => {
      const response = await apiClient.searchItems({
        search: 'rifle',
        min_ql: 100,
        max_ql: 200,
        item_class: 1, // Weapon
        limit: 10,
      });

      expect(response.items.length).toBeGreaterThan(0);
      for (const item of response.items) {
        expect(item.ql).toBeGreaterThanOrEqual(100);
        expect(item.ql).toBeLessThanOrEqual(200);
        expect(item.item_class).toBe(1);
      }
    });

    it.each([
      { itemClass: 1, name: 'weapons' },
      { itemClass: 2, name: 'armor' },
      { itemClass: 3, name: 'implants' },
    ])('returns only $name for item class $itemClass', async ({ itemClass }) => {
      const response = await apiClient.searchItems({
        search: 'a',
        item_class: itemClass,
        limit: 5,
      });

      expect(response.items.length).toBeGreaterThan(0);
      for (const item of response.items) {
        expect(item.item_class).toBe(itemClass);
      }
    });

    it('returns an empty page for a term that matches nothing', async () => {
      const response = await apiClient.searchItems({ search: 'nonexistentitem12345randomstring' });

      expect(response.items).toEqual([]);
      expect(response.total).toBe(0);
    });

    it('serves consecutive pages of a large result set', async () => {
      const page1 = await apiClient.searchItems({ search: 'implant', page: 1, limit: 10 });
      expect(page1.total).toBeGreaterThan(10);
      expect(page1.items).toHaveLength(10);

      const page2 = await apiClient.searchItems({ search: 'implant', page: 2, limit: 10 });
      expect(page2.page).toBe(2);
      expect(page2.items.length).toBeGreaterThan(0);
      const page1Ids = page1.items.map((item) => item.id);
      expect(page2.items.some((item) => page1Ids.includes(item.id))).toBe(false);
    });

    it('answers a search within the 5 second budget', async () => {
      const start = performance.now();
      await apiClient.searchItems({ search: 'weapon', limit: 10 });
      expect(performance.now() - start).toBeLessThan(5000);
    });
  });

  describe('Items store', () => {
    it('caches search results and pagination', async () => {
      const store = useItemsStore();

      const items = await store.searchItems({ search: 'nano', search_fields: ['name'] });

      expect(items.length).toBeGreaterThan(0);
      expect(store.currentSearchResults).toEqual(items);
      expect(store.currentPagination.total).toBeGreaterThanOrEqual(items.length);
      expect(store.loading).toBe(false);
    });

    it('is loading only while a search is in flight', async () => {
      const store = useItemsStore();

      const search = store.searchItems({ search: 'test' });
      expect(store.loading).toBe(true);

      await search;
      expect(store.loading).toBe(false);
    });
  });

  describe('TinkerItems view', () => {
    let wrapper: VueWrapper;

    afterEach(() => {
      wrapper.unmount();
    });

    it('shows real results for a search typed into the sidebar', async () => {
      const router = createTestRouter();
      await router.push(versionedPath('/items'));
      await router.isReady();
      wrapper = mount(TinkerItems, {
        global: appGlobals(pinia, router),
        attachTo: document.body,
      });
      await flushPromises();
      const form = itemSearchForm(wrapper);

      await form.typeName('Otek Slicer');
      await form.search();
      await vi.waitFor(() => expect(wrapper.text()).toMatch(/[1-9]\d* items found/));

      const names = wrapper.findAll('.item-list .space-y-2 h3').map((h) => h.text());
      expect(names.length).toBeGreaterThan(0);
      expect(names.every((name) => /otek slicer/i.test(name))).toBe(true);
    });
  });

  describe('Item interpolation', () => {
    it('interpolates an item to a requested quality level', async () => {
      const response = await apiClient.interpolateItem(OTEK_SLICER, 150);

      expect(response.success).toBe(true);
      expect(response.item?.aoid).toBe(OTEK_SLICER);
      expect(response.item?.ql).toBe(150);
      expect(response.item?.interpolating).toBe(true);
      expect(response.item?.target_ql).toBe(150);
      expect(response.item?.stats.length).toBeGreaterThan(0);
      expect(response.item?.actions.length).toBeGreaterThan(0);
    });

    it('reports every QL range of a multi-range item', async () => {
      const response = await apiClient.getInterpolationInfo(OTEK_SLICER);

      expect(response.success).toBe(true);
      const ranges = response.data?.ranges ?? [];
      expect(ranges.length).toBeGreaterThan(1);
      for (const range of ranges) {
        expect(range.min_ql).toEqual(expect.any(Number));
        expect(range.max_ql).toEqual(expect.any(Number));
        expect(range.base_aoid).toEqual(expect.any(Number));
        expect(range.max_ql).toBeGreaterThanOrEqual(range.min_ql);
      }
    });

    it('rejects a quality level outside the item range', async () => {
      await expect(apiClient.interpolateItem(OTEK_SLICER, 9999)).rejects.toBeDefined();
    });

    it('scales requirements with quality level', async () => {
      const base = await apiClient.getItem(OTEK_SLICER);
      const interpolated = await apiClient.interpolateItem(OTEK_SLICER, 150);

      expect(base.data).toBeDefined();
      expect(interpolated.item).toBeDefined();
      const baseRequirements = firstRequirementValues(base.data!);
      const scaledRequirements = firstRequirementValues(interpolated.item!);
      expect(baseRequirements.length).toBeGreaterThan(0);
      expect(scaledRequirements).not.toEqual(baseRequirements);
    });
  });
});

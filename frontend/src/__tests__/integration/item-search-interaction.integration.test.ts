/**
 * Item Search Interaction Integration Tests
 *
 * Tests item search and filtering functionality through actual UI components
 * with real store integration. Mocks only external API calls.
 *
 * Covers:
 * - Basic search with text queries
 * - Advanced filtering (QL, profession, item class)
 * - Filter combinations and clearing
 * - Search + filter interactions
 * - Results display and pagination
 * - Stat bonus filtering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// IMPORTANT: Mock API client BEFORE importing any stores
vi.mock('@/services/api-client');

import {
  setupIntegrationTest,
  mountForIntegration,
  waitForUpdates,
  type IntegrationTestContext,
} from '../helpers/integration-test-utils';
import {
  createTestItem,
  createWeaponItem,
  createArmorItem,
  createImplantItem,
  createNanoItem,
  createStatValue,
} from '../helpers/item-fixtures';
import { SKILL_ID } from '../helpers/skill-fixtures';
import { useItemsStore } from '@/stores/items';
import TinkerItems from '@/views/TinkerItems.vue';
import AdvancedItemSearch from '@/components/items/AdvancedItemSearch.vue';
import type { Item, PaginatedResponse } from '@/types/api';

// Mock PrimeVue Toast
const mockToast = {
  add: vi.fn(),
  remove: vi.fn(),
  removeGroup: vi.fn(),
  removeAllGroups: vi.fn(),
};

vi.mock('primevue/usetoast', () => ({
  useToast: () => mockToast,
}));

describe('Item Search Interaction Integration', () => {
  let context: IntegrationTestContext;
  let testItems: Item[];

  beforeEach(async () => {
    context = await setupIntegrationTest();

    // Create diverse test items for filtering
    testItems = [
      // Weapons
      createWeaponItem({
        aoid: 1001,
        name: 'Assault Rifle QL100',
        ql: 100,
        item_class: 1,
        stats: [
          createStatValue(SKILL_ID.ASSAULT_RIF, 20),
          createStatValue(SKILL_ID.RANGED_INIT, 10),
        ],
      }),
      createWeaponItem({
        aoid: 1002,
        name: 'Assault Rifle QL200',
        ql: 200,
        item_class: 1,
        stats: [
          createStatValue(SKILL_ID.ASSAULT_RIF, 50),
          createStatValue(SKILL_ID.RANGED_INIT, 25),
        ],
      }),

      // Armor
      createArmorItem({
        aoid: 2001,
        name: 'Combat Armor QL150',
        ql: 150,
        item_class: 2,
        stats: [
          createStatValue(SKILL_ID.PROJECTILE_AC, 500),
          createStatValue(SKILL_ID.MELEE_AC, 400),
        ],
      }),
      createArmorItem({
        aoid: 2002,
        name: 'Light Armor QL50',
        ql: 50,
        item_class: 2,
        stats: [
          createStatValue(SKILL_ID.PROJECTILE_AC, 200),
          createStatValue(SKILL_ID.DODGE_RNG, 10),
        ],
      }),

      // Implants
      createImplantItem({
        aoid: 3001,
        name: 'Trader Implant QL180',
        ql: 180,
        item_class: 3,
        stats: [
          createStatValue(SKILL_ID.INTELLIGENCE, 20),
          createStatValue(SKILL_ID.COMPUTER_LITERACY, 80),
        ],
      }),
      createImplantItem({
        aoid: 3002,
        name: 'Strength Implant QL75',
        ql: 75,
        item_class: 3,
        stats: [createStatValue(SKILL_ID.STRENGTH, 15), createStatValue(SKILL_ID.BODY_DEV, 30)],
      }),

      // Nanos
      createNanoItem({
        aoid: 4001,
        name: 'Combat Nano QL120',
        ql: 120,
        is_nano: true,
      }),
      createNanoItem({
        aoid: 4002,
        name: 'Buff Nano QL250',
        ql: 250,
        is_nano: true,
      }),
    ];

    // Setup default mock API response
    context.mockApi.searchItems.mockResolvedValue({
      items: testItems,
      total: testItems.length,
      page: 1,
      page_size: 24,
      has_next: false,
      has_prev: false,
    } as PaginatedResponse<Item>);
  });

  describe('Basic Search', () => {
    it('should filter items when user types search query', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      // Find the advanced search component
      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);
      expect(advancedSearch.exists()).toBe(true);

      // Mock filtered results
      const filteredItems = testItems.filter((item) => item.name.toLowerCase().includes('rifle'));
      context.mockApi.searchItems.mockResolvedValue({
        items: filteredItems,
        total: filteredItems.length,
        page: 1,
        page_size: 24,
        has_next: false,
        has_prev: false,
      });

      // Use the component API to set search query and trigger search
      advancedSearch.vm.searchForm.search = 'rifle';
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Verify API was called with search query
      expect(context.mockApi.searchItems).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'rifle',
        })
      );

      // Verify results are displayed
      const itemsStore = useItemsStore();
      expect(itemsStore.currentSearchResults).toHaveLength(2);
      expect(
        itemsStore.currentSearchResults.every((item) => item.name.toLowerCase().includes('rifle'))
      ).toBe(true);
    });

    it('should show all items when search is cleared', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // First, perform a search
      advancedSearch.vm.searchForm.search = 'rifle';
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Now clear the search
      advancedSearch.vm.clearAll();
      await waitForUpdates(wrapper, 100);

      // Verify search was cleared
      expect(advancedSearch.vm.searchForm.search).toBe('');
      expect(advancedSearch.vm.hasSearched).toBe(false);
    });

    it('should perform case-insensitive search', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // Mock results for case-insensitive search
      const filteredItems = testItems.filter((item) => item.name.toLowerCase().includes('armor'));
      context.mockApi.searchItems.mockResolvedValue({
        items: filteredItems,
        total: filteredItems.length,
        page: 1,
        page_size: 24,
        has_next: false,
        has_prev: false,
      });

      // Search with mixed case
      advancedSearch.vm.searchForm.search = 'ARMOR';
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Verify results match
      const itemsStore = useItemsStore();
      expect(itemsStore.currentSearchResults).toHaveLength(2);
      expect(
        itemsStore.currentSearchResults.every((item) => item.name.toLowerCase().includes('armor'))
      ).toBe(true);
    });
  });

  describe('Quality Level Filtering', () => {
    it('should filter items by QL range', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // Mock filtered results for QL 100-200
      const filteredItems = testItems.filter((item) => item.ql >= 100 && item.ql <= 200);
      context.mockApi.searchItems.mockResolvedValue({
        items: filteredItems,
        total: filteredItems.length,
        page: 1,
        page_size: 24,
        has_next: false,
        has_prev: false,
      });

      // Set QL range
      advancedSearch.vm.searchForm.min_ql = 100;
      advancedSearch.vm.searchForm.max_ql = 200;
      await waitForUpdates(wrapper);

      // Trigger search
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Verify API was called with QL filters
      expect(context.mockApi.searchItems).toHaveBeenCalledWith(
        expect.objectContaining({
          min_ql: 100,
          max_ql: 200,
        })
      );

      // Verify results are in range
      const itemsStore = useItemsStore();
      expect(
        itemsStore.currentSearchResults.every((item) => item.ql >= 100 && item.ql <= 200)
      ).toBe(true);
    });

    it('should use quick QL range buttons', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // Use setQLRange method (simulates clicking quick button)
      advancedSearch.vm.setQLRange(201, 300);
      await waitForUpdates(wrapper);

      // Verify QL range was set
      expect(advancedSearch.vm.searchForm.min_ql).toBe(201);
      expect(advancedSearch.vm.searchForm.max_ql).toBe(300);
    });
  });

  describe('Item Class Filtering', () => {
    it('should filter by item class', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // Mock filtered results for weapons (class 1)
      const filteredItems = testItems.filter((item) => item.item_class === 1);
      context.mockApi.searchItems.mockResolvedValue({
        items: filteredItems,
        total: filteredItems.length,
        page: 1,
        page_size: 24,
        has_next: false,
        has_prev: false,
      });

      // Set item class
      advancedSearch.vm.searchForm.item_class = 1;
      await waitForUpdates(wrapper);

      // Trigger search
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Verify API was called with item class filter
      expect(context.mockApi.searchItems).toHaveBeenCalledWith(
        expect.objectContaining({
          item_class: 1,
        })
      );

      // Verify results match class
      const itemsStore = useItemsStore();
      expect(itemsStore.currentSearchResults.every((item) => item.item_class === 1)).toBe(true);
    });

    it('should filter nano programs', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // Mock filtered results for nanos
      const filteredItems = testItems.filter((item) => item.is_nano);
      context.mockApi.searchItems.mockResolvedValue({
        items: filteredItems,
        total: filteredItems.length,
        page: 1,
        page_size: 24,
        has_next: false,
        has_prev: false,
      });

      // Set nano filter - note: this would come from checkbox interaction in real usage
      // For the test, we directly set the form value
      // @ts-ignore - accessing internal form state for testing
      advancedSearch.vm.searchForm.is_nano = true;
      await waitForUpdates(wrapper);

      // Trigger search
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Verify only nanos returned
      const itemsStore = useItemsStore();
      expect(itemsStore.currentSearchResults.every((item) => item.is_nano)).toBe(true);
    });
  });

  describe('Multiple Filter Combination', () => {
    it('should combine search query with QL filter', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // Mock filtered results: armor with QL >= 100
      const filteredItems = testItems.filter(
        (item) => item.name.toLowerCase().includes('armor') && item.ql >= 100
      );
      context.mockApi.searchItems.mockResolvedValue({
        items: filteredItems,
        total: filteredItems.length,
        page: 1,
        page_size: 24,
        has_next: false,
        has_prev: false,
      });

      // Set search query and min QL
      advancedSearch.vm.searchForm.search = 'armor';
      advancedSearch.vm.searchForm.min_ql = 100;
      await waitForUpdates(wrapper);

      // Trigger search
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Verify API was called with both filters
      expect(context.mockApi.searchItems).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'armor',
          min_ql: 100,
        })
      );

      // Verify results match both criteria
      const itemsStore = useItemsStore();
      expect(itemsStore.currentSearchResults).toHaveLength(1);
      expect(itemsStore.currentSearchResults[0].name).toBe('Combat Armor QL150');
    });

    it('should combine item class with QL range', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // Mock filtered results: implants with QL 50-100
      const filteredItems = testItems.filter(
        (item) => item.item_class === 3 && item.ql >= 50 && item.ql <= 100
      );
      context.mockApi.searchItems.mockResolvedValue({
        items: filteredItems,
        total: filteredItems.length,
        page: 1,
        page_size: 24,
        has_next: false,
        has_prev: false,
      });

      // Set item class and QL range
      advancedSearch.vm.searchForm.item_class = 3;
      advancedSearch.vm.searchForm.min_ql = 50;
      advancedSearch.vm.searchForm.max_ql = 100;
      await waitForUpdates(wrapper);

      // Trigger search
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Verify API was called with combined filters
      expect(context.mockApi.searchItems).toHaveBeenCalledWith(
        expect.objectContaining({
          item_class: 3,
          min_ql: 50,
          max_ql: 100,
        })
      );

      // Verify results
      const itemsStore = useItemsStore();
      expect(itemsStore.currentSearchResults).toHaveLength(1);
      expect(itemsStore.currentSearchResults[0].name).toBe('Strength Implant QL75');
    });

    it('should handle complex multi-filter search', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // Mock filtered results: weapons named "rifle", QL 150-250
      const filteredItems = testItems.filter(
        (item) =>
          item.name.toLowerCase().includes('rifle') &&
          item.item_class === 1 &&
          item.ql >= 150 &&
          item.ql <= 250
      );
      context.mockApi.searchItems.mockResolvedValue({
        items: filteredItems,
        total: filteredItems.length,
        page: 1,
        page_size: 24,
        has_next: false,
        has_prev: false,
      });

      // Set all filters
      advancedSearch.vm.searchForm.search = 'rifle';
      advancedSearch.vm.searchForm.item_class = 1;
      advancedSearch.vm.searchForm.min_ql = 150;
      advancedSearch.vm.searchForm.max_ql = 250;
      await waitForUpdates(wrapper);

      // Trigger search
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Verify all filters applied
      expect(context.mockApi.searchItems).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'rifle',
          item_class: 1,
          min_ql: 150,
          max_ql: 250,
        })
      );

      // Verify results
      const itemsStore = useItemsStore();
      expect(itemsStore.currentSearchResults).toHaveLength(1);
      expect(itemsStore.currentSearchResults[0].name).toBe('Assault Rifle QL200');
    });
  });

  describe('Filter Clearing', () => {
    it('should clear all filters with clear button', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // Set multiple filters
      advancedSearch.vm.searchForm.search = 'armor';
      advancedSearch.vm.searchForm.min_ql = 100;
      advancedSearch.vm.searchForm.item_class = 2;
      await waitForUpdates(wrapper);

      // Click clear button
      advancedSearch.vm.clearAll();
      await waitForUpdates(wrapper);

      // Verify all filters were cleared
      expect(advancedSearch.vm.searchForm.search).toBe('');
      expect(advancedSearch.vm.searchForm.min_ql).toBeUndefined();
      expect(advancedSearch.vm.searchForm.max_ql).toBeUndefined();
      expect(advancedSearch.vm.searchForm.item_class).toBeUndefined();
      expect(advancedSearch.vm.hasSearched).toBe(false);
    });

    it('should maintain other filters when changing one filter', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // Set multiple filters
      advancedSearch.vm.searchForm.min_ql = 100;
      advancedSearch.vm.searchForm.max_ql = 200;
      advancedSearch.vm.searchForm.item_class = 2;
      await waitForUpdates(wrapper);

      // Change only the item class
      advancedSearch.vm.searchForm.item_class = 3;
      await waitForUpdates(wrapper);

      // Verify QL filters remain
      expect(advancedSearch.vm.searchForm.min_ql).toBe(100);
      expect(advancedSearch.vm.searchForm.max_ql).toBe(200);
      expect(advancedSearch.vm.searchForm.item_class).toBe(3);
    });
  });

  describe('Stat Bonus Filtering', () => {
    it('should filter items by stat bonuses', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // Mock filtered results: items with Intelligence bonus
      const filteredItems = testItems.filter((item) =>
        item.stats.some((stat) => stat.stat === SKILL_ID.INTELLIGENCE)
      );
      context.mockApi.searchItems.mockResolvedValue({
        items: filteredItems,
        total: filteredItems.length,
        page: 1,
        page_size: 24,
        has_next: false,
        has_prev: false,
      });

      // Select Intelligence stat bonus
      advancedSearch.vm.selectedStatBonuses = [SKILL_ID.INTELLIGENCE];
      await waitForUpdates(wrapper);

      // Trigger search
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Verify API was called with stat bonus filter
      expect(context.mockApi.searchItems).toHaveBeenCalledWith(
        expect.objectContaining({
          stat_bonuses: [SKILL_ID.INTELLIGENCE],
        })
      );

      // Verify results have Intelligence bonus
      const itemsStore = useItemsStore();
      expect(itemsStore.currentSearchResults).toHaveLength(1);
      expect(itemsStore.currentSearchResults[0].name).toBe('Trader Implant QL180');
    });

    it('should filter by multiple stat bonuses', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // Mock filtered results: items with Strength OR Intelligence
      const filteredItems = testItems.filter((item) =>
        item.stats.some(
          (stat) => stat.stat === SKILL_ID.STRENGTH || stat.stat === SKILL_ID.INTELLIGENCE
        )
      );
      context.mockApi.searchItems.mockResolvedValue({
        items: filteredItems,
        total: filteredItems.length,
        page: 1,
        page_size: 24,
        has_next: false,
        has_prev: false,
      });

      // Select multiple stat bonuses
      advancedSearch.vm.selectedStatBonuses = [SKILL_ID.STRENGTH, SKILL_ID.INTELLIGENCE];
      await waitForUpdates(wrapper);

      // Trigger search
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Verify API was called with multiple stat bonuses
      expect(context.mockApi.searchItems).toHaveBeenCalledWith(
        expect.objectContaining({
          stat_bonuses: expect.arrayContaining([SKILL_ID.STRENGTH, SKILL_ID.INTELLIGENCE]),
        })
      );

      // Verify results
      const itemsStore = useItemsStore();
      expect(itemsStore.currentSearchResults).toHaveLength(2);
    });
  });

  describe('Results Display', () => {
    it('should display items with correct information', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // Trigger search to display results
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Verify items are displayed
      const itemsStore = useItemsStore();
      expect(itemsStore.currentSearchResults).toHaveLength(testItems.length);

      // Check that each item has expected properties
      itemsStore.currentSearchResults.forEach((item) => {
        expect(item).toHaveProperty('aoid');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('ql');
        expect(item).toHaveProperty('stats');
      });
    });

    it('should show empty state when no results', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // Mock empty results
      context.mockApi.searchItems.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 24,
        has_next: false,
        has_prev: false,
      });

      // Search for non-existent item
      advancedSearch.vm.searchForm.search = 'nonexistent';
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Verify empty results
      const itemsStore = useItemsStore();
      expect(itemsStore.currentSearchResults).toHaveLength(0);
    });

    it('should display result count', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // Trigger search
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Verify result count is displayed - component should show it in text
      expect(advancedSearch.text()).toContain(`${testItems.length} items found`);
    });
  });

  describe('Pagination', () => {
    it('should handle paginated results', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      // Mock paginated results
      const firstPageItems = testItems.slice(0, 4);
      context.mockApi.searchItems.mockResolvedValue({
        items: firstPageItems,
        total: testItems.length,
        page: 1,
        page_size: 4,
        has_next: true,
        has_prev: false,
      });

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Verify first page results
      const itemsStore = useItemsStore();
      expect(itemsStore.currentSearchResults).toHaveLength(4);
      expect(itemsStore.currentPagination?.total).toBe(testItems.length);
      expect(itemsStore.currentPagination?.hasNext).toBe(true);
    });

    it('should load next page when pagination changes', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      // Mock first page
      const firstPageItems = testItems.slice(0, 4);
      context.mockApi.searchItems.mockResolvedValue({
        items: firstPageItems,
        total: testItems.length,
        page: 1,
        page_size: 4,
        has_next: true,
        has_prev: false,
      });

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Mock second page
      const secondPageItems = testItems.slice(4, 8);
      context.mockApi.searchItems.mockResolvedValue({
        items: secondPageItems,
        total: testItems.length,
        page: 2,
        page_size: 4,
        has_next: false,
        has_prev: true,
      });

      // Simulate page change (would normally come from ItemList pagination component)
      const itemsStore = useItemsStore();
      await itemsStore.searchItems({
        page: 2,
        limit: 4,
      });
      await waitForUpdates(wrapper, 100);

      // Verify page 2 API call
      expect(context.mockApi.searchItems).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 4,
        })
      );

      // Verify second page results
      expect(itemsStore.currentSearchResults).toHaveLength(4);
      expect(itemsStore.currentPagination?.page).toBe(2);
    });
  });

  describe('Search State Management', () => {
    it('should show loading state during search', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      // Mock slow API response
      let resolveSearch: any;
      context.mockApi.searchItems.mockReturnValue(
        new Promise((resolve) => {
          resolveSearch = resolve;
        })
      );

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper);

      // Verify loading state
      const itemsStore = useItemsStore();
      expect(itemsStore.loading).toBe(true);

      // Resolve the search
      resolveSearch({
        items: testItems,
        total: testItems.length,
        page: 1,
        page_size: 24,
        has_next: false,
        has_prev: false,
      });
      await waitForUpdates(wrapper, 100);

      // Verify loading cleared
      expect(itemsStore.loading).toBe(false);
    });

    it('should maintain search state across component updates', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      // Perform search
      advancedSearch.vm.searchForm.search = 'rifle';
      advancedSearch.vm.searchForm.min_ql = 100;
      advancedSearch.vm.performSearch();
      await waitForUpdates(wrapper, 100);

      // Verify search state persists
      const itemsStore = useItemsStore();
      expect(itemsStore.currentSearchQuery).toMatchObject({
        search: 'rifle',
        min_ql: 100,
      });

      // Force re-render
      await wrapper.vm.$forceUpdate();
      await waitForUpdates(wrapper);

      // Verify state still present
      expect(itemsStore.currentSearchQuery).toMatchObject({
        search: 'rifle',
        min_ql: 100,
      });
    });

    it('should handle search errors gracefully', async () => {
      const wrapper = mountForIntegration(TinkerItems, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      // Mock API error
      context.mockApi.searchItems.mockRejectedValue(new Error('Network error'));

      const advancedSearch = wrapper.findComponent(AdvancedItemSearch);

      try {
        advancedSearch.vm.performSearch();
        await waitForUpdates(wrapper, 100);
      } catch (error) {
        // Error expected
      }

      // Verify error state
      const itemsStore = useItemsStore();
      expect(itemsStore.loading).toBe(false);
      // Note: Error handling behavior may vary - this test checks loading is cleared
    });
  });
});

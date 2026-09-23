/**
 * Item Search Interaction Integration Tests
 *
 * TinkerItems searched the way a user does it: filling in the search sidebar,
 * using the quick searches, paging and sorting results. Real stores, router
 * and PrimeVue widgets; only the API client is mocked.
 *
 * Covers:
 * - Text search, from the Search button and the Enter key
 * - Quality level, item class and stat bonus filters, alone and combined
 * - Clearing the form
 * - Quick searches on the landing state
 * - Results display, empty state, loading and errors
 * - Pagination and sorting
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// IMPORTANT: Mock API client BEFORE importing any stores
vi.mock('@/services/api-client');

import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import type { Router } from 'vue-router';
import {
  setupIntegrationTest,
  type IntegrationTestContext,
} from '../helpers/integration-test-utils';
import { createTestRouter } from '../helpers/vue-test-utils';
import { appGlobals } from '../helpers/app-globals';
import { chooseOption, clickButton, findButton, itemSearchForm } from '../helpers/item-search-page';
import {
  createArmorItem,
  createImplantItem,
  createNanoItem,
  createStatValue,
  createWeaponItem,
} from '../helpers/item-fixtures';
import { SKILL_ID } from '../helpers/skill-fixtures';
import { TEST_VERSION } from '../helpers/version-fixtures';
import { versionedPath } from '@/composables/useGameVersion';
import TinkerItems from '@/views/TinkerItems.vue';
import type { Item, PaginatedResponse } from '@/types/api';

const rifle100 = createWeaponItem({ id: 1, aoid: 1001, name: 'Assault Rifle', ql: 100 });
const rifle200 = createWeaponItem({ id: 2, aoid: 1002, name: 'Superior Assault Rifle', ql: 200 });
const combatArmor = createArmorItem({ id: 3, aoid: 2001, name: 'Combat Armor', ql: 150 });
const lightArmor = createArmorItem({ id: 4, aoid: 2002, name: 'Light Armor', ql: 50 });
const traderImplant = createImplantItem({
  id: 5,
  aoid: 3001,
  name: 'Trader Implant',
  ql: 180,
  item_class: 3,
  stats: [createStatValue(SKILL_ID.INTELLIGENCE, 20)],
});
const strengthImplant = createImplantItem({
  id: 6,
  aoid: 3002,
  name: 'Strength Implant',
  ql: 75,
  item_class: 3,
  stats: [createStatValue(SKILL_ID.STRENGTH, 15)],
});
const combatNano = createNanoItem({ id: 7, aoid: 4001, name: 'Combat Nano', ql: 120 });
const buffNano = createNanoItem({ id: 8, aoid: 4002, name: 'Buff Nano', ql: 250 });

const allItems = [
  rifle100,
  rifle200,
  combatArmor,
  lightArmor,
  traderImplant,
  strengthImplant,
  combatNano,
  buffNano,
];

function results(
  items: Item[],
  { total = items.length, page = 1, pageSize = 24 } = {}
): PaginatedResponse<Item> {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items,
    total,
    page,
    page_size: pageSize,
    pages,
    has_next: page < pages,
    has_prev: page > 1,
  };
}

describe('Item Search Interaction Integration', () => {
  let context: IntegrationTestContext;
  let router: Router;
  let wrapper: VueWrapper;

  async function mountTinkerItems() {
    router = createTestRouter();
    await router.push(versionedPath('/items'));
    await router.isReady();

    wrapper = mount(TinkerItems, {
      global: appGlobals(context.pinia, router),
      attachTo: document.body,
    });
    await flushPromises();
    return itemSearchForm(wrapper);
  }

  function lastQuery() {
    const calls = context.mockApi.searchItems.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    return calls[calls.length - 1][0];
  }

  /** Names of the result rows, in display order. */
  function shownItems(): string[] {
    return wrapper.findAll('.item-list h3').map((heading) => heading.text());
  }

  beforeEach(async () => {
    context = await setupIntegrationTest();
    context.mockApi.searchItems.mockResolvedValue(results(allItems));
  });

  afterEach(() => {
    wrapper.unmount();
  });

  describe('Basic Search', () => {
    it('searches by name and lists the matching items', async () => {
      const form = await mountTinkerItems();
      context.mockApi.searchItems.mockResolvedValue(results([rifle100, rifle200]));

      await form.typeName('rifle');
      await form.search();

      expect(lastQuery()).toMatchObject({
        search: 'rifle',
        exact_match: false,
        search_fields: ['name'],
        page: 1,
        limit: 24,
      });
      expect(shownItems()).toEqual(['Assault Rifle', 'Superior Assault Rifle']);
      expect(wrapper.text()).toContain('2 items found');
    });

    it('searches when the user presses Enter', async () => {
      const form = await mountTinkerItems();

      await form.typeName('armor');
      await form.pressEnter();

      expect(lastQuery()).toMatchObject({ search: 'armor' });
    });

    it('returns to the landing state when the search is cleared', async () => {
      const form = await mountTinkerItems();

      await form.typeName('rifle');
      await form.search();
      expect(shownItems().length).toBeGreaterThan(0);

      await form.clear();

      expect(form.nameInput().element.value).toBe('');
      expect(shownItems()).toEqual([]);
      expect(wrapper.text()).toContain('Search the Item Database');
      expect(wrapper.text()).toContain('Enter search terms or browse categories');
    });
  });

  describe('Quality Level Filtering', () => {
    it('sends a typed QL range', async () => {
      const form = await mountTinkerItems();

      await form.setMinQL(100);
      await form.setMaxQL(200);
      await form.search();

      expect(lastQuery()).toMatchObject({ min_ql: 100, max_ql: 200 });
    });

    it('sends the range picked with a quick QL button', async () => {
      const form = await mountTinkerItems();

      await form.quickQL('201-300');
      await form.search();

      expect(lastQuery()).toMatchObject({ min_ql: 201, max_ql: 300 });
    });
  });

  describe('Item Class Filtering', () => {
    it('sends the chosen item class', async () => {
      const form = await mountTinkerItems();
      context.mockApi.searchItems.mockResolvedValue(results([rifle100, rifle200]));

      await form.choose('Item Class', 'Weapon');
      await form.search();

      expect(lastQuery()).toMatchObject({ item_class: 1 });
      expect(shownItems()).toEqual(['Assault Rifle', 'Superior Assault Rifle']);
    });
  });

  describe('Multiple Filter Combination', () => {
    it('combines name, item class and QL range in one search', async () => {
      const form = await mountTinkerItems();
      context.mockApi.searchItems.mockResolvedValue(results([rifle200]));

      await form.typeName('rifle');
      await form.choose('Item Class', 'Weapon');
      await form.setMinQL(150);
      await form.setMaxQL(250);
      await form.search();

      expect(lastQuery()).toMatchObject({
        search: 'rifle',
        item_class: 1,
        min_ql: 150,
        max_ql: 250,
      });
      expect(shownItems()).toEqual(['Superior Assault Rifle']);
    });

    it('keeps the other filters when one filter changes', async () => {
      const form = await mountTinkerItems();

      await form.setMinQL(100);
      await form.setMaxQL(200);
      await form.choose('Item Class', 'Armor');
      await form.choose('Item Class', 'Implant');
      await form.search();

      expect(lastQuery()).toMatchObject({ min_ql: 100, max_ql: 200, item_class: 3 });
    });
  });

  describe('Stat Bonus Filtering', () => {
    it('sends the ticked stat bonuses', async () => {
      const form = await mountTinkerItems();
      context.mockApi.searchItems.mockResolvedValue(results([traderImplant, strengthImplant]));

      await form.tick('Strength');
      await form.tick('Intelligence');
      await form.search();

      expect(lastQuery().stat_bonuses).toEqual([SKILL_ID.STRENGTH, SKILL_ID.INTELLIGENCE]);
      expect(shownItems()).toEqual(['Trader Implant', 'Strength Implant']);
    });
  });

  describe('Quick Searches', () => {
    it.each([
      { button: 'Weapons', query: { item_class: 1 } },
      { button: 'Implants', query: { item_class: 3 } },
      { button: 'Nano Programs', query: { is_nano: true } },
      { button: 'High QL Items', query: { min_ql: 200, sort: 'ql', sort_order: 'desc' } },
    ])('"$button" runs its preset search', async ({ button, query }) => {
      await mountTinkerItems();

      await clickButton(wrapper, button);

      expect(lastQuery()).toMatchObject(query);
      expect(shownItems()).toHaveLength(allItems.length);
    });
  });

  describe('Results Display', () => {
    it('shows each result with its quality level and the total count', async () => {
      const form = await mountTinkerItems();

      await form.typeName('a');
      await form.search();

      expect(shownItems()).toEqual(allItems.map((item) => item.name));
      const firstRow = wrapper.findAll('.item-list .cursor-pointer')[0];
      expect(firstRow.text()).toContain('QL 100');
      expect(wrapper.text()).toContain(`${allItems.length} items found`);
    });

    it('shows the empty state when nothing matches', async () => {
      const form = await mountTinkerItems();
      context.mockApi.searchItems.mockResolvedValue(results([]));

      await form.typeName('nonexistent');
      await form.search();

      expect(shownItems()).toEqual([]);
      expect(wrapper.text()).toContain('No items found');
      expect(wrapper.text()).toContain('0 items found');
    });

    it('opens the item page, in the current game version, when a result is clicked', async () => {
      const form = await mountTinkerItems();

      await form.typeName('rifle');
      await form.search();
      await wrapper.findAll('.item-list .cursor-pointer')[0].trigger('click');
      await flushPromises();

      expect(router.currentRoute.value.path).toBe(`/${TEST_VERSION}/items/${rifle100.aoid}`);
    });
  });

  describe('Pagination', () => {
    const page1 = allItems.slice(0, 4);
    const page2 = allItems.slice(4, 8);

    it('shows which slice of the results is on screen', async () => {
      const form = await mountTinkerItems();
      context.mockApi.searchItems.mockResolvedValue(results(page1, { total: 8, pageSize: 4 }));

      await form.typeName('a');
      await form.search();

      expect(shownItems()).toEqual(page1.map((item) => item.name));
      expect(wrapper.text()).toContain('Showing 1-4 of 8 items');
    });

    it('fetches the next page of the same search', async () => {
      const form = await mountTinkerItems();
      context.mockApi.searchItems.mockResolvedValue(results(page1, { total: 8, pageSize: 4 }));
      await form.typeName('a');
      await form.search();

      context.mockApi.searchItems.mockResolvedValue(
        results(page2, { total: 8, page: 2, pageSize: 4 })
      );
      await wrapper.find('button[aria-label="Next Page"]').trigger('click');
      await flushPromises();

      expect(lastQuery()).toMatchObject({ search: 'a', page: 2, limit: 4 });
      expect(shownItems()).toEqual(page2.map((item) => item.name));
      expect(wrapper.text()).toContain('Showing 5-8 of 8 items');
    });
  });

  describe('Sorting', () => {
    it('re-runs the search in the chosen order', async () => {
      const form = await mountTinkerItems();
      await form.typeName('rifle');
      await form.search();

      const sortDropdown = wrapper
        .findAll('.p-dropdown')
        .find(
          (dropdown) => !wrapper.find('.advanced-item-search').element.contains(dropdown.element)
        );
      expect(sortDropdown).toBeDefined();
      await chooseOption(sortDropdown!, 'Quality Level (High)');

      expect(lastQuery()).toMatchObject({ search: 'rifle', sort: 'ql', sort_order: 'desc' });
    });
  });

  describe('Search State Management', () => {
    it('shows a spinner while the search is running', async () => {
      const form = await mountTinkerItems();
      let finish: (value: PaginatedResponse<Item>) => void = () => {};
      context.mockApi.searchItems.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        })
      );

      await form.typeName('rifle');
      await findButton(wrapper, 'Search').trigger('click');
      await flushPromises();

      expect(wrapper.find('.p-progress-spinner').exists()).toBe(true);

      finish(results([rifle100]));
      await flushPromises();

      expect(wrapper.find('.p-progress-spinner').exists()).toBe(false);
      expect(shownItems()).toEqual(['Assault Rifle']);
    });

    it('keeps the search criteria in the store for the next visit', async () => {
      const form = await mountTinkerItems();

      await form.typeName('rifle');
      await form.setMinQL(100);
      await form.search();
      wrapper.unmount();

      const revisited = await mountTinkerItems();

      expect(revisited.nameInput().element.value).toBe('rifle');
      expect(revisited.qlInputs()[0].element.value).toBe('100');
      expect(shownItems()).toEqual(allItems.map((item) => item.name));
    });

    it('recovers from a failed search', async () => {
      const form = await mountTinkerItems();
      context.mockApi.searchItems.mockRejectedValue(new Error('Network error'));

      await form.typeName('rifle');
      await form.search();

      expect(wrapper.find('.p-progress-spinner').exists()).toBe(false);
      expect(wrapper.text()).toContain('No items found');

      context.mockApi.searchItems.mockResolvedValue(results([rifle100]));
      await form.search();

      expect(shownItems()).toEqual(['Assault Rifle']);
    });
  });
});

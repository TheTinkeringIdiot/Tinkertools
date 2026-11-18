/**
 * AdvancedItemSearch Integration Tests
 *
 * The TinkerItems search sidebar, driven through its real PrimeVue widgets
 * with the real items store (API client mocked). Checks the search query the
 * form emits for what the user entered, and what the form shows back.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// CRITICAL: Mock API BEFORE store imports
vi.mock('@/services/api-client');

import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import AdvancedItemSearch from '@/components/items/AdvancedItemSearch.vue';
import { apiClient } from '@/services/api-client';
import { useItemsStore } from '@/stores/items';
import type { ItemSearchQuery } from '@/types/api';
import { appGlobals } from '../helpers/app-globals';
import { itemSearchForm, shownOption } from '../helpers/item-search-page';
import { SKILL_ID } from '../helpers/skill-fixtures';

describe('AdvancedItemSearch', () => {
  let pinia: Pinia;
  let wrapper: VueWrapper;

  function mountSearch(props: { loading?: boolean; resultCount?: number } = {}) {
    wrapper = mount(AdvancedItemSearch, {
      props,
      global: appGlobals(pinia),
      attachTo: document.body,
    });
    return itemSearchForm(wrapper);
  }

  function emittedQueries(): ItemSearchQuery[] {
    return (wrapper.emitted('search') ?? []).map(([query]) => query as ItemSearchQuery);
  }

  function lastQuery(): ItemSearchQuery {
    const queries = emittedQueries();
    expect(queries.length).toBeGreaterThan(0);
    return queries[queries.length - 1];
  }

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  afterEach(() => {
    wrapper.unmount();
  });

  describe('building the search query', () => {
    it('combines name, quality level and stat bonus criteria', async () => {
      const form = mountSearch();

      await form.typeName('implant');
      await form.setMinQL(100);
      await form.tick('Strength');
      await form.search();

      expect(lastQuery()).toEqual({
        search: 'implant',
        exact_match: false,
        search_fields: ['name'],
        min_ql: 100,
        stat_bonuses: [SKILL_ID.STRENGTH],
      });
    });

    it('searches when the user presses Enter in the name box', async () => {
      const form = mountSearch();

      await form.typeName('Cell Scanner');
      await form.pressEnter();

      expect(lastQuery().search).toBe('Cell Scanner');
    });

    it('trims surrounding whitespace from the name', async () => {
      const form = mountSearch();

      await form.typeName('  rifle  ');
      await form.search();

      expect(lastQuery().search).toBe('rifle');
    });

    it('sends a typed quality level range', async () => {
      const form = mountSearch();

      await form.setMinQL(50);
      await form.setMaxQL(200);
      await form.search();

      expect(lastQuery()).toEqual({ min_ql: 50, max_ql: 200 });
    });

    it('fills the quality level range from a quick range button', async () => {
      const form = mountSearch();

      await form.quickQL('101-200');

      expect(form.qlInputs().map((input) => input.element.value)).toEqual(['101', '200']);

      await form.search();
      expect(lastQuery()).toEqual({ min_ql: 101, max_ql: 200 });
    });

    it('sends every ticked stat bonus, and drops one when unticked', async () => {
      const form = mountSearch();

      await form.tick('Strength');
      await form.tick('Agility');
      await form.search();
      expect(lastQuery().stat_bonuses).toEqual([SKILL_ID.STRENGTH, SKILL_ID.AGILITY]);

      await form.tick('Strength', false);
      await form.search();
      expect(lastQuery().stat_bonuses).toEqual([SKILL_ID.AGILITY]);
    });

    it('sends the special filters', async () => {
      const form = mountSearch();

      await form.tick('Froob Friendly');
      await form.tick('NoDrop');
      await form.search();

      expect(lastQuery()).toEqual({ froob_friendly: true, nodrop: true });
    });

    it('sends the chosen match type and search fields', async () => {
      const form = mountSearch();

      await form.typeName('exact search term');
      await form.matchType('Exact Match');
      await form.searchIn('Description');
      await form.search();
      expect(lastQuery()).toMatchObject({
        search: 'exact search term',
        exact_match: true,
        search_fields: ['description'],
      });

      await form.searchIn('Both');
      await form.search();
      expect(lastQuery().search_fields).toEqual(['name', 'description']);
    });

    it('sends requirement filters as ids', async () => {
      const form = mountSearch();

      await form.choose('Profession', 'Engineer');
      await form.search();

      expect(lastQuery()).toEqual({ profession: 3 });
    });
  });

  describe('item class and slot', () => {
    it('offers equipment slots once an item class is chosen', async () => {
      const form = mountSearch();

      expect(wrapper.text()).not.toContain('Equipment Slot');

      await form.choose('Item Class', 'Weapon');
      await form.choose('Equipment Slot', 'Hud1');
      await form.search();

      expect(lastQuery()).toEqual({ item_class: 1, slot: 1 });
    });

    it('forgets the slot when the item class changes', async () => {
      const form = mountSearch();

      await form.choose('Item Class', 'Weapon');
      await form.choose('Equipment Slot', 'Hud1');
      await form.choose('Item Class', 'Implant');
      await form.search();

      expect(lastQuery()).toEqual({ item_class: 3 });
    });
  });

  describe('search and clear buttons', () => {
    it('are disabled until the user enters some criteria', async () => {
      const form = mountSearch();

      expect(form.searchButton().attributes('disabled')).toBeDefined();
      expect(form.clearButton().attributes('disabled')).toBeDefined();

      await form.typeName('test');

      expect(form.searchButton().attributes('disabled')).toBeUndefined();
      expect(form.clearButton().attributes('disabled')).toBeUndefined();
    });

    it('clear empties the form and tells the page', async () => {
      const form = mountSearch();

      await form.typeName('test search');
      await form.tick('Strength');
      await form.setMinQL(100);
      await form.clear();

      expect(wrapper.emitted('clear')).toHaveLength(1);
      expect(form.nameInput().element.value).toBe('');
      expect(form.qlInputs()[0].element.value).toBe('');
      expect(form.checkbox('Strength').element.checked).toBe(false);
      expect(form.searchButton().attributes('disabled')).toBeDefined();
    });
  });

  describe('results summary', () => {
    it('appears after a search and goes away on clear', async () => {
      const form = mountSearch({ resultCount: 42 });

      expect(wrapper.text()).not.toContain('items found');

      await form.typeName('test');
      await form.search();
      expect(wrapper.text()).toContain('42 items found');

      await form.clear();
      expect(wrapper.text()).not.toContain('items found');
    });
  });

  describe('returning to the page', () => {
    it('shows the criteria of the last search again', async () => {
      vi.mocked(apiClient.searchItems).mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        page_size: 24,
        pages: 0,
        has_next: false,
        has_prev: false,
      });
      await useItemsStore().searchItems({
        search: 'armor',
        exact_match: true,
        search_fields: ['name'],
        min_ql: 150,
        item_class: 2,
        stat_bonuses: [SKILL_ID.AGILITY],
      });

      const form = mountSearch();
      await vi.waitFor(() => expect(form.nameInput().element.value).toBe('armor'));

      expect(shownOption(form.dropdown('Item Class'))).toBe('Armor');
      expect(form.qlInputs()[0].element.value).toBe('150');
      expect(form.checkbox('Agility').element.checked).toBe(true);

      await form.search();
      expect(lastQuery()).toEqual({
        search: 'armor',
        exact_match: true,
        search_fields: ['name'],
        min_ql: 150,
        item_class: 2,
        stat_bonuses: [SKILL_ID.AGILITY],
      });
    });
  });
});

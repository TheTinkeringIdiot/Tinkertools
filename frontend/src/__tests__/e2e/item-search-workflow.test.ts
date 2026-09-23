/**
 * Item Search Workflow Tests
 *
 * End-to-end user workflows through TinkerItems: arriving from other tools
 * via links, browsing results in both layouts, comparing items, casting a
 * nano on the active character and opening an item. Real stores, router and
 * PrimeVue widgets; only the API client is mocked.
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
import { itemSearchForm } from '../helpers/item-search-page';
import {
  createArmorItem,
  createSpell,
  createSpellData,
  createStatValue,
  createTestItem,
  createWeaponItem,
} from '../helpers/item-fixtures';
import { createTestProfile } from '../helpers/profile-fixtures';
import { TEST_VERSION } from '../helpers/version-fixtures';
import { versionedPath } from '@/composables/useGameVersion';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import TinkerItems from '@/views/TinkerItems.vue';
import type { Item, PaginatedResponse } from '@/types/api';

const cellScanner = createTestItem({ id: 1, aoid: 5001, name: 'Cell Scanner', ql: 50 });
const combatArmor = createArmorItem({ id: 2, aoid: 5002, name: 'Combat Armor', ql: 150 });
const rifle = createWeaponItem({ id: 3, aoid: 5003, name: 'Assault Rifle', ql: 200 });
const ironCircle = createTestItem({
  id: 4,
  aoid: 5004,
  name: 'Iron Circle',
  ql: 60,
  is_nano: true,
  stats: [
    createStatValue(54, 20), // NCU cost
    createStatValue(75, 1000), // NanoStrain
  ],
});

/** A deck item whose Wear effect gives the character NCU (MaxNCU, stat 181). */
const ncuMemory = createTestItem({
  name: 'NCU Memory',
  spell_data: [
    createSpellData({
      event: 14, // Wear
      spells: [createSpell({ spell_id: 53045, spell_params: { Stat: 181, Amount: 100 } })],
    }),
  ],
});

function results(items: Item[]): PaginatedResponse<Item> {
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 24,
    pages: 1,
    has_next: false,
    has_prev: false,
  };
}

describe('Item Search Workflow', () => {
  let context: IntegrationTestContext;
  let router: Router;
  let wrapper: VueWrapper;

  /** Open TinkerItems at `path` (relative to the version root), as a link would. */
  async function openItems(path = '/items') {
    router = createTestRouter();
    await router.push(versionedPath(path));
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

  /** Result names in the list layout. */
  function listRows(): string[] {
    return wrapper.findAll('.item-list .space-y-2 h3').map((heading) => heading.text());
  }

  /** Header button by its PrimeVue icon class. */
  function iconButton(icon: string) {
    const button = wrapper.find(`button:has(.${icon})`);
    expect(button.exists()).toBe(true);
    return button;
  }

  beforeEach(async () => {
    context = await setupIntegrationTest();
    context.mockApi.searchItems.mockResolvedValue(results([cellScanner, combatArmor, rifle]));
  });

  afterEach(() => {
    wrapper.unmount();
  });

  describe('Arriving from a link', () => {
    it('runs the header search term and shows it in the search box', async () => {
      context.mockApi.searchItems.mockResolvedValue(results([cellScanner]));

      const form = await openItems('/items?search=Cell%20Scanner');

      expect(lastQuery()).toMatchObject({
        search: 'Cell Scanner',
        exact_match: false,
        search_fields: ['name'],
      });
      expect(form.nameInput().element.value).toBe('Cell Scanner');
      expect(wrapper.text()).toContain('1 items found');
      expect(wrapper.text()).toContain('Cell Scanner');
    });

    it('runs a new header search while already on the page', async () => {
      await openItems('/items?search=Cell');

      context.mockApi.searchItems.mockResolvedValue(results([rifle]));
      await router.push(versionedPath('/items?search=Rifle'));
      await flushPromises();

      expect(lastQuery()).toMatchObject({ search: 'Rifle' });
      expect(wrapper.text()).toContain('Assault Rifle');
      expect(wrapper.text()).not.toContain('Cell Scanner');
    });

    it('lists the nanos of a strain linked from TinkerNanos', async () => {
      context.mockApi.searchItems.mockResolvedValue(results([ironCircle]));

      await openItems('/items?strain=1000&is_nano=true');

      expect(lastQuery()).toMatchObject({ strain: 1000, is_nano: true });
      expect(lastQuery().search).toBeUndefined();
      expect(wrapper.text()).toContain('Iron Circle');
    });
  });

  describe('Browsing results', () => {
    it('switches between the list and grid layouts', async () => {
      const form = await openItems();
      await form.typeName('a');
      await form.search();

      // List layout is the default
      expect(listRows()).toEqual(['Cell Scanner', 'Combat Armor', 'Assault Rifle']);
      expect(wrapper.findAll('.item-card')).toHaveLength(0);

      await iconButton('pi-th-large').trigger('click');
      expect(wrapper.findAll('.item-card')).toHaveLength(3);
      expect(listRows()).toHaveLength(0);

      await iconButton('pi-list').trigger('click');
      expect(listRows()).toHaveLength(3);
    });

    it('opens the item page in the current game version', async () => {
      const form = await openItems();
      await form.typeName('rifle');
      await form.search();

      const row = wrapper
        .findAll('.item-list .cursor-pointer')
        .find((candidate) => candidate.text().includes('Assault Rifle'));
      await row!.trigger('click');
      await flushPromises();

      expect(router.currentRoute.value.name).toBe('ItemDetail');
      expect(router.currentRoute.value.path).toBe(`/${TEST_VERSION}/items/${rifle.aoid}`);
    });
  });

  describe('Comparing items', () => {
    it('collects up to three distinct items in the comparison panel', async () => {
      const extra = createWeaponItem({ id: 9, aoid: 5009, name: 'Spare Rifle', ql: 10 });
      context.mockApi.searchItems.mockResolvedValue(
        results([cellScanner, combatArmor, rifle, extra])
      );
      const form = await openItems();
      await form.typeName('a');
      await form.search();

      expect(wrapper.text()).not.toContain('Item Comparison');

      const compareButtons = wrapper.findAll('.item-list button:has(.pi-clone)');
      expect(compareButtons).toHaveLength(4);
      await compareButtons[0].trigger('click');
      await compareButtons[0].trigger('click'); // the same item again is ignored
      await compareButtons[1].trigger('click');
      await compareButtons[2].trigger('click');
      await compareButtons[3].trigger('click'); // a fourth item does not fit
      await flushPromises();

      const panel = document.body.querySelector('.item-comparison-sidebar');
      expect(panel).not.toBeNull();
      expect(panel!.textContent).toContain('Item Comparison');
      expect(panel!.textContent).toContain('Cell Scanner');
      expect(panel!.textContent).toContain('Combat Armor');
      expect(panel!.textContent).toContain('Assault Rifle');
      expect(panel!.textContent).not.toContain('Spare Rifle');
    });
  });

  describe('Casting nanos on the active character', () => {
    it('adds a cast nano to the active profile buffs', async () => {
      const store = useTinkerProfilesStore();
      const profile = createTestProfile({ name: 'Caster', level: 100 });
      const profileId = await store.createProfile('Caster', {
        ...profile,
        Weapons: { ...profile.Weapons, NCU1: ncuMemory },
        buffs: [],
      });
      await store.setActiveProfile(profileId);

      context.mockApi.searchItems.mockResolvedValue(results([ironCircle]));
      const form = await openItems();
      await form.typeName('Iron Circle');
      await form.search();

      const castButton = wrapper.find('.item-list button:has(.pi-sparkles)');
      expect(castButton.exists()).toBe(true);
      await castButton.trigger('click');
      await flushPromises();

      expect(store.activeProfile?.buffs?.map((buff) => buff.name)).toEqual(['Iron Circle']);
    });

    it('offers no cast button without an active character', async () => {
      context.mockApi.searchItems.mockResolvedValue(results([ironCircle]));
      const form = await openItems();
      await form.typeName('Iron Circle');
      await form.search();

      expect(wrapper.text()).toContain('Iron Circle');
      expect(wrapper.find('.item-list button:has(.pi-sparkles)').exists()).toBe(false);
    });
  });
});

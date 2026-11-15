/**
 * Item timeline and item comparison on the item page.
 *
 * "When did this change and what exactly changed": the History panel lists
 * every build that touched the item with its field-level diff, any step can
 * be peeked at (?as=<slug>), and the item can be compared with any other
 * build (?compare=<slug>). Real stores and router, mocked API client.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/services/api-client');

const mockToast = { add: vi.fn(), remove: vi.fn(), removeGroup: vi.fn(), removeAllGroups: vi.fn() };
vi.mock('primevue/usetoast', () => ({ useToast: () => mockToast }));

import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import PrimeVue from 'primevue/config';
import Button from 'primevue/button';
import ItemDetail from '@/views/ItemDetail.vue';
import ItemInterpolationBar from '@/components/items/ItemInterpolationBar.vue';
import { apiClient } from '@/services/api-client';
import {
  versions as versionRegistry,
  currentVersion,
  setCurrentVersion,
  useGameVersion,
} from '@/composables/useGameVersion';
import type { Item } from '@/types/api';
import {
  BUILD_1460,
  BUILD_PRK,
  BUILD_17105,
  CRITTER_AOID,
  CRITTER_COMPARE,
  CRITTER_NAME,
  CRITTER_TIMELINE,
  DIFF_REGISTRY,
  RETURNED_TIMELINE,
  compareResult,
  emptyTimeline,
} from '../helpers/change-fixtures';

const mockApi = vi.mocked(apiClient);

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    aoid: CRITTER_AOID,
    name: CRITTER_NAME,
    ql: 13,
    item_class: 0,
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

async function mountItemDetail(router: Router, pinia: Pinia): Promise<VueWrapper> {
  const wrapper = mount(ItemDetail, {
    props: { aoid: String(CRITTER_AOID) },
    shallow: true,
    global: {
      plugins: [PrimeVue, pinia, router],
      components: { Button },
      // The history and comparison panels, with the diff they render, are under test.
      stubs: {
        Button: false,
        RouterLink: false,
        ItemTimeline: false,
        ItemVersionCompare: false,
        BuildPicker: false,
        ItemDiffView: false,
        ChangeBadges: false,
        DiffMark: false,
        CriteriaDiffList: false,
        CriterionReference: false,
        EffectLine: false,
        SpellText: false,
        StatValueChange: false,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

async function openHistory(wrapper: VueWrapper): Promise<void> {
  await wrapper.find('[data-testid="item-history-trigger"]').trigger('click');
  await flushPromises();
}

async function pickCompare(wrapper: VueWrapper, slug: string): Promise<void> {
  await wrapper.find('[data-testid="item-compare-trigger"]').trigger('click');
  await wrapper.find('[data-testid="item-compare-picker"]').setValue(slug);
  await flushPromises();
}

describe('item page: timeline and comparison', () => {
  let pinia: Pinia;
  let router: Router;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();

    versionRegistry.value = DIFF_REGISTRY;
    currentVersion.value = null;
    await setCurrentVersion('ao-14-6-0');
    useGameVersion().defaultVersion.value = 'ao-14-6-0';

    mockApi.getItem.mockImplementation(async (aoid: number) => ({
      success: true,
      data: aoid === CRITTER_AOID ? makeItem() : makeItem({ aoid, name: 'Nano Critter Poison' }),
    }));
    mockApi.getItemTimeline.mockResolvedValue(CRITTER_TIMELINE);
    mockApi.compareItem.mockResolvedValue(CRITTER_COMPARE);

    router = makeRouter();
    await router.push(`/ao-14-6-0/items/${CRITTER_AOID}`);
    await router.isReady();
  });

  describe('timeline', () => {
    it('lists every build that touched the item, newest first', async () => {
      const wrapper = await mountItemDetail(router, pinia);

      expect(mockApi.getItemTimeline).toHaveBeenCalledTimes(1);
      expect(mockApi.getItemTimeline.mock.calls[0][0]).toBe(CRITTER_AOID);
      expect(mockApi.getItemTimeline.mock.calls[0][1]).toMatchObject({ gameVersion: 'ao-14-6-0' });
      expect(wrapper.find('[data-testid="item-history-trigger"]').text()).toContain('History (2)');

      // Closed until asked for.
      expect(wrapper.find('[data-testid="item-history-panel"]').exists()).toBe(false);
      await openHistory(wrapper);

      const entries = wrapper.findAll('[data-testid="item-history-entry"]');
      expect(entries.map((entry) => entry.attributes('data-slug'))).toEqual([
        'ao-14-6-0',
        'ao-14-2-2',
      ]);

      const newest = entries[0];
      expect(newest.text()).toContain('AO 14.6.0');
      expect(newest.text()).toContain('Changed');
      expect(newest.text()).toContain('compared with AO 14.5.1');
      expect(newest.findAll('[data-testid="change-part"]').map((part) => part.text())).toEqual([
        'Stats',
        'Effects',
        'Requirements',
        'Other',
      ]);
      expect(newest.findAll('[data-testid="change-relevance"]').map((chip) => chip.text())).toEqual(
        ['Gameplay', 'Cosmetic']
      );

      const oldest = entries[1];
      expect(oldest.attributes('data-kind')).toBe('added');
      expect(oldest.text()).toContain('Present in the oldest build on record');
    });

    it('shows what exactly changed in a step: the nerf question in one click', async () => {
      const wrapper = await mountItemDetail(router, pinia);
      await openHistory(wrapper);

      // The newest step with a diff is open from the start.
      const diff = wrapper.find('[data-testid="item-history-entry"] [data-testid="item-diff"]');
      expect(diff.exists()).toBe(true);

      // Effect parameter: old value struck through, new value underlined, with the delta.
      const field = diff.find('[data-testid="diff-effect-field"]');
      expect(field.text()).toContain('Chance');
      expect(field.find('del').text()).toBe('60%');
      expect(field.find('ins').text()).toBe('100%');
      expect(field.text()).toContain('+40');

      // The effect reads as on the item page, with the nano it casts named.
      const effect = diff.find('[data-testid="diff-effect"]');
      expect(effect.attributes('data-op')).toBe('changed');
      expect(effect.text()).toContain('100% chance to cast');
      expect(effect.text()).toContain('Nano Critter Poison');
      expect(diff.find('[data-testid="diff-event"]').text()).toContain('On Use');

      // Requirements as a sequence diff, in order, named as the item page names them.
      const criteria = diff.findAll('[data-testid="diff-criterion"]');
      // The AND that joins the two is not a row of its own.
      expect(criteria.map((row) => row.attributes('data-op'))).toEqual(['changed', 'changed']);
      expect(criteria[0].find('del').text()).toBe('PsychologicalModification ≥ 40');
      expect(criteria[0].find('ins').text()).toBe('PsychologicalModification ≥ 66');
      expect(criteria[1].text()).toContain('SensoryImprovement');
      expect(diff.find('[data-testid="diff-criteria"]').text()).not.toContain('AND');
      expect(diff.find('[data-testid="diff-action"]').text()).toContain('To use');

      // A stat that appeared, by name.
      const stat = diff.find('[data-testid="diff-stat"]');
      expect(stat.text()).toContain('AttackRange');
      expect(stat.find('ins').text()).toBe('20');
    });

    it('marks additions and removals with a sign and words, not colour alone', async () => {
      const wrapper = await mountItemDetail(router, pinia);
      await openHistory(wrapper);

      const stat = wrapper.find('[data-testid="diff-stat"]');
      const mark = stat.find('.diff-mark');
      expect(mark.attributes('data-op')).toBe('added');
      expect(mark.text()).toContain('+');
      expect(mark.find('.sr-only').text()).toBe('Added:');
    });

    it('folds cosmetic entries away until asked for', async () => {
      const wrapper = await mountItemDetail(router, pinia);
      await openHistory(wrapper);

      expect(wrapper.find('[data-testid="diff-misc"]').exists()).toBe(false);
      const toggle = wrapper.find('[data-testid="diff-cosmetic-toggle"]');
      expect(toggle.text()).toContain('Show 1 cosmetic change');

      await toggle.trigger('click');

      const misc = wrapper.find('[data-testid="diff-misc"]');
      expect(misc.text()).toContain('Client instance id');
      expect(misc.text()).toContain('10090');
      expect(misc.text()).toContain('11099');
    });

    it('folds what the API marks cosmetic: an icon swap among real changes', async () => {
      const step = CRITTER_TIMELINE.entries[0];
      mockApi.getItemTimeline.mockResolvedValue({
        ...CRITTER_TIMELINE,
        entries: [
          {
            ...step,
            diff: {
              ...step.diff!,
              stats: [
                { ...step.diff!.stats[0], relevance: 'gameplay' },
                {
                  stat: 79,
                  change: 'changed',
                  old: 21134,
                  new: 114013,
                  bits_set: null,
                  bits_cleared: null,
                  relevance: 'cosmetic',
                },
              ],
            },
          },
          CRITTER_TIMELINE.entries[1],
        ],
      });
      const wrapper = await mountItemDetail(router, pinia);
      await openHistory(wrapper);

      expect(
        wrapper.findAll('[data-testid="diff-stat"]').map((s) => s.attributes('data-stat'))
      ).toEqual(['287']);
      const toggle = wrapper.find('[data-testid="diff-cosmetic-toggle"]');
      expect(toggle.text()).toContain('Show 2 cosmetic changes');

      await toggle.trigger('click');
      const icon = wrapper.find('[data-testid="diff-stat"][data-stat="79"]');
      expect(icon.text()).toContain('Icon');
      expect(icon.text()).toContain('cosmetic');
      // An icon id is not a quantity: no "+92879".
      expect(icon.text()).not.toContain('+');
    });

    it('collapses and expands a step', async () => {
      const wrapper = await mountItemDetail(router, pinia);
      await openHistory(wrapper);

      const toggle = wrapper.find('[data-testid="item-history-toggle"]');
      expect(toggle.attributes('aria-expanded')).toBe('true');

      await toggle.trigger('click');
      expect(wrapper.find('[data-testid="item-diff"]').exists()).toBe(false);

      await toggle.trigger('click');
      expect(wrapper.find('[data-testid="item-diff"]').exists()).toBe(true);
    });

    it('shows the build note that explains a step', async () => {
      mockApi.getItemTimeline.mockResolvedValue({
        ...CRITTER_TIMELINE,
        entries: [
          {
            ...CRITTER_TIMELINE.entries[0],
            note: {
              note_id: 4,
              title: 'Weapons given an explicit attack range',
              body: 'Stat 287 (AttackRange) was written out on weapons that had none.',
            },
          },
          CRITTER_TIMELINE.entries[1],
        ],
      });
      const wrapper = await mountItemDetail(router, pinia);
      await openHistory(wrapper);

      const note = wrapper.find('[data-testid="item-history-note"]');
      expect(note.text()).toContain('Weapons given an explicit attack range');
      expect(note.text()).toContain('written out on weapons');
    });

    it('marks the step in effect for the build on the page', async () => {
      const wrapper = await mountItemDetail(router, pinia);
      await openHistory(wrapper);

      const viewed = wrapper.findAll('[data-testid="item-history-viewed"]');
      expect(viewed).toHaveLength(1);
      expect(
        wrapper
          .find('[data-testid="item-history-entry"][data-slug="ao-14-6-0"]')
          .find('[data-testid="item-history-viewed"]')
          .exists()
      ).toBe(true);
    });

    it('peeks at the item as of a build: sets ?as and loads that snapshot', async () => {
      const wrapper = await mountItemDetail(router, pinia);
      await openHistory(wrapper);

      await wrapper
        .find('[data-testid="item-history-peek"][data-slug="ao-14-2-2"]')
        .trigger('click');
      await flushPromises();

      expect(router.currentRoute.value.query.as).toBe('ao-14-2-2');
      expect(mockApi.getItem).toHaveBeenCalledWith(CRITTER_AOID, { gameVersion: 'ao-14-2-2' });
      expect(wrapper.find('[data-testid="item-peek-banner"]').text()).toContain('AO 14.2.2');
      expect(wrapper.findComponent(ItemInterpolationBar).props('gameVersion')).toBe('ao-14-2-2');

      // The history stays open and now marks the peeked step.
      expect(
        wrapper
          .find('[data-testid="item-history-entry"][data-slug="ao-14-2-2"]')
          .find('[data-testid="item-history-viewed"]')
          .exists()
      ).toBe(true);
      // One timeline request served both views.
      expect(mockApi.getItemTimeline).toHaveBeenCalledTimes(1);
    });

    it('keeps other query params when peeking and when leaving the peek', async () => {
      await router.push(`/ao-14-6-0/items/${CRITTER_AOID}?ql=150`);
      const wrapper = await mountItemDetail(router, pinia);
      await openHistory(wrapper);

      await wrapper
        .find('[data-testid="item-history-peek"][data-slug="ao-14-2-2"]')
        .trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.query).toMatchObject({ ql: '150', as: 'ao-14-2-2' });

      await wrapper.find('[data-testid="item-peek-exit"]').trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.query.as).toBeUndefined();
      expect(router.currentRoute.value.query.ql).toBe('150');
    });

    it('tells the story of an item that left and returned', async () => {
      mockApi.getItemTimeline.mockResolvedValue(RETURNED_TIMELINE);
      const wrapper = await mountItemDetail(router, pinia);
      await openHistory(wrapper);

      const entries = wrapper.findAll('[data-testid="item-history-entry"]');
      expect(entries.map((entry) => entry.attributes('data-kind'))).toEqual([
        'added',
        'removed',
        'added',
      ]);
      expect(entries[0].text()).toContain('Returned to the game data');
      expect(entries[1].text()).toContain('Removed from the game data');
      expect(entries[2].text()).toContain('Present in the oldest build on record');

      // A removed item cannot be shown as of the build that removed it: the
      // peek goes to the build before.
      const peek = entries[1].find('[data-testid="item-history-peek"]');
      expect(peek.text()).toContain('View before removal');
      expect(peek.attributes('data-slug')).toBe('ao-14-2-2');
    });

    it('offers the last build that has an item missing from this version', async () => {
      mockApi.getItem.mockResolvedValue({ success: false });
      mockApi.getItemTimeline.mockResolvedValue({
        ...RETURNED_TIMELINE,
        entries: RETURNED_TIMELINE.entries.slice(1),
      });

      const wrapper = await mountItemDetail(router, pinia);

      const message = wrapper.find('[data-testid="item-missing-in-version"]');
      expect(message.exists()).toBe(true);
      expect(message.text()).toContain('Not present in AO 14.6.0');
      expect(message.text()).toContain('Removed in AO 14.4.2');

      await wrapper.find('[data-testid="item-missing-view"]').trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.query.as).toBe('ao-14-2-2');
    });

    it('explains an item missing from a build between its removal and its return', async () => {
      await setCurrentVersion('ao-14-5-0');
      await router.push(`/ao-14-5-0/items/${CRITTER_AOID}`);
      mockApi.getItem.mockResolvedValue({ success: false });
      mockApi.getItemTimeline.mockResolvedValue(RETURNED_TIMELINE);

      const wrapper = await mountItemDetail(router, pinia);

      const message = wrapper.find('[data-testid="item-missing-in-version"]');
      expect(message.text()).toContain('Not present in AO 14.5.0');
      expect(message.text()).toContain('Removed in AO 14.4.2, returned in AO 14.5.1');
      expect(message.text()).not.toContain('First appears');
      // The page is headed by the item's name, not by a loading message.
      expect(wrapper.find('[data-testid="item-heading"]').text()).toBe(CRITTER_NAME);
    });

    it('explains an item missing from a build older than its first appearance', async () => {
      await setCurrentVersion('ao-14-2-2');
      await router.push(`/ao-14-2-2/items/${CRITTER_AOID}`);
      mockApi.getItem.mockResolvedValue({ success: false });
      mockApi.getItemTimeline.mockResolvedValue({
        ...RETURNED_TIMELINE,
        entries: RETURNED_TIMELINE.entries.slice(0, 1),
      });

      const wrapper = await mountItemDetail(router, pinia);

      expect(wrapper.find('[data-testid="item-missing-in-version"]').text()).toContain(
        'First appears in AO 14.5.1'
      );
    });

    it('shows no history control for an item no build knows', async () => {
      mockApi.getItem.mockResolvedValue({ success: false });
      mockApi.getItemTimeline.mockResolvedValue(emptyTimeline(CRITTER_AOID));

      const wrapper = await mountItemDetail(router, pinia);

      expect(wrapper.find('[data-testid="item-history-trigger"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="item-compare-trigger"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="item-missing-in-version"]').exists()).toBe(false);
      expect(wrapper.text()).toContain('Item not found');
    });

    it('keeps the page usable when the timeline cannot be loaded', async () => {
      mockApi.getItemTimeline.mockRejectedValue(new Error('timeline unavailable'));

      const wrapper = await mountItemDetail(router, pinia);

      expect(wrapper.find('[data-testid="item-history-trigger"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="item-missing-in-version"]').exists()).toBe(false);
      expect(wrapper.find('h1').text()).toContain(CRITTER_NAME);
    });
  });

  describe('compare with another version', () => {
    it('compares the item with a picked older build, older side first', async () => {
      const wrapper = await mountItemDetail(router, pinia);

      await pickCompare(wrapper, 'ao-14-2-2');

      expect(router.currentRoute.value.query.compare).toBe('ao-14-2-2');
      expect(mockApi.compareItem).toHaveBeenCalledTimes(1);
      const [aoid, base, options] = mockApi.compareItem.mock.calls[0];
      expect(aoid).toBe(CRITTER_AOID);
      expect(base).toBe('ao-14-2-2');
      expect(options).toMatchObject({ gameVersion: 'ao-14-6-0' });

      const result = wrapper.find('[data-testid="item-compare-result"]');
      expect(result.attributes('data-kind')).toBe('changed');
      expect(result.find('[data-testid="item-compare-base"]').text()).toBe('AO 14.2.2');
      expect(result.find('[data-testid="item-compare-build"]').text()).toBe('AO 14.6.0');
      // The same diff presentation as the timeline.
      expect(result.find('[data-testid="diff-effect-field"]').text()).toContain('Chance');
      expect(result.find('[data-testid="diff-effect-field"] ins').text()).toBe('100%');
    });

    it('puts the page on the older side when the picked build is newer', async () => {
      mockApi.compareItem.mockResolvedValue(compareResult('changed', BUILD_17105, BUILD_1460));
      const wrapper = await mountItemDetail(router, pinia);

      await pickCompare(wrapper, 'ao-17-10-5');

      const [, base, options] = mockApi.compareItem.mock.calls[0];
      expect(base).toBe('ao-14-6-0');
      expect(options).toMatchObject({ gameVersion: 'ao-17-10-5' });
      expect(wrapper.find('[data-testid="item-compare-base"]').text()).toBe('AO 14.6.0');
      expect(wrapper.find('[data-testid="item-compare-build"]').text()).toBe('AO 17.10.5');
    });

    it('compares across the fork: an AO build against Project Rubi-Ka', async () => {
      mockApi.compareItem.mockResolvedValue(compareResult('changed', BUILD_PRK, BUILD_1460));
      const wrapper = await mountItemDetail(router, pinia);

      // Both families are offered.
      await wrapper.find('[data-testid="item-compare-trigger"]').trigger('click');
      const labels = wrapper
        .findAll('[data-testid="item-compare-picker"] optgroup')
        .map((group) => group.attributes('label'));
      expect(labels).toEqual(['Project Rubi-Ka', 'Anarchy Online']);
      // The build on the page is not offered against itself.
      expect(
        wrapper.find('[data-testid="item-compare-picker"] option[value="ao-14-6-0"]').exists()
      ).toBe(false);

      await wrapper.find('[data-testid="item-compare-picker"]').setValue('prk-0-7-1');
      await flushPromises();

      const [, base, options] = mockApi.compareItem.mock.calls[0];
      expect(base).toBe('ao-14-6-0');
      expect(options).toMatchObject({ gameVersion: 'prk-0-7-1' });
      expect(wrapper.find('[data-testid="item-compare-build"]').text()).toBe(
        'Project Rubi-Ka 0.7.1'
      );
    });

    it('says plainly when the item is only in the newer build', async () => {
      mockApi.compareItem.mockResolvedValue(compareResult('added'));
      const wrapper = await mountItemDetail(router, pinia);
      await pickCompare(wrapper, 'ao-14-2-2');

      const plain = wrapper.find('[data-testid="item-compare-plain"]');
      expect(plain.text()).toContain('Not in AO 14.2.2');
      expect(plain.text()).toContain('It exists in AO 14.6.0');
      expect(
        wrapper.find('[data-testid="item-compare-result"] [data-testid="item-diff"]').exists()
      ).toBe(false);
    });

    it('says plainly when the item is only in the older build', async () => {
      mockApi.compareItem.mockResolvedValue(compareResult('removed'));
      const wrapper = await mountItemDetail(router, pinia);
      await pickCompare(wrapper, 'ao-14-2-2');

      const plain = wrapper.find('[data-testid="item-compare-plain"]');
      expect(plain.text()).toContain('In AO 14.2.2');
      expect(plain.text()).toContain('Not in AO 14.6.0');
    });

    it('says plainly when the two builds define the item identically', async () => {
      mockApi.compareItem.mockResolvedValue(compareResult('unchanged'));
      const wrapper = await mountItemDetail(router, pinia);
      await pickCompare(wrapper, 'ao-14-2-2');

      expect(wrapper.find('[data-testid="item-compare-plain"]').text()).toContain(
        'Identical in both builds'
      );
      expect(wrapper.find('[data-testid="change-kind"][data-kind="unchanged"]').exists()).toBe(
        true
      );
    });

    it('reports an item neither build has', async () => {
      mockApi.compareItem.mockRejectedValue({
        type: 'info',
        title: 'Not Found',
        message: "Item 88393 is in neither 'ao-14-2-2' nor 'ao-14-6-0'",
        action: 'Pick another version',
        recoverable: true,
      });
      const wrapper = await mountItemDetail(router, pinia);
      await pickCompare(wrapper, 'ao-14-2-2');

      expect(wrapper.find('[data-testid="item-compare-error"]').text()).toContain('is in neither');
    });

    it('restores a shared comparison from the URL', async () => {
      await router.push(`/ao-14-6-0/items/${CRITTER_AOID}?compare=ao-14-2-2`);
      const wrapper = await mountItemDetail(router, pinia);

      expect(wrapper.find('[data-testid="item-compare-result"]').exists()).toBe(true);
      expect(
        (wrapper.find('[data-testid="item-compare-picker"]').element as HTMLSelectElement).value
      ).toBe('ao-14-2-2');
    });

    it('compares a peeked snapshot with the current version', async () => {
      await router.push(`/ao-14-6-0/items/${CRITTER_AOID}?as=ao-14-2-2`);
      const wrapper = await mountItemDetail(router, pinia);

      await wrapper.find('[data-testid="item-compare-toggle"]').trigger('click');
      await flushPromises();

      expect(router.currentRoute.value.query).toMatchObject({
        as: 'ao-14-2-2',
        compare: 'ao-14-6-0',
      });
      const [, base, options] = mockApi.compareItem.mock.calls[0];
      expect(base).toBe('ao-14-2-2');
      expect(options).toMatchObject({ gameVersion: 'ao-14-6-0' });

      await wrapper.find('[data-testid="item-compare-toggle"]').trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.query.compare).toBeUndefined();
      expect(wrapper.find('[data-testid="item-compare-panel"]').exists()).toBe(false);
    });

    it('closes the comparison and clears it from the URL', async () => {
      const wrapper = await mountItemDetail(router, pinia);
      await pickCompare(wrapper, 'ao-14-2-2');

      await wrapper.find('[data-testid="item-compare-close"]').trigger('click');
      await flushPromises();

      expect(router.currentRoute.value.query.compare).toBeUndefined();
      expect(wrapper.find('[data-testid="item-compare-panel"]').exists()).toBe(false);
    });

    it('does not ask twice for a comparison it already has', async () => {
      const wrapper = await mountItemDetail(router, pinia);
      await pickCompare(wrapper, 'ao-14-2-2');
      await wrapper.find('[data-testid="item-compare-picker"]').setValue('ao-14-5-1');
      await flushPromises();
      await wrapper.find('[data-testid="item-compare-picker"]').setValue('ao-14-2-2');
      await flushPromises();

      const bases = mockApi.compareItem.mock.calls.map((call) => call[1]);
      expect(bases).toEqual(['ao-14-2-2', 'ao-14-5-1']);
    });
  });
});

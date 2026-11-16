/**
 * "What changed in this version" and "compare two builds".
 *
 * The change list of a build (/<version>/changes) and the net difference
 * between two builds (/<version>/compare/<base>): summary counts, build notes
 * collapsed to one line, patch notes, filters kept in the URL, paging, and a
 * row's diff opened in place. Real store and router, mocked API client.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/services/api-client');

import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import PrimeVue from 'primevue/config';
import Paginator from 'primevue/paginator';
import BuildChanges from '@/views/BuildChanges.vue';
import { apiClient } from '@/services/api-client';
import {
  versions as versionRegistry,
  currentVersion,
  setCurrentVersion,
  useGameVersion,
} from '@/composables/useGameVersion';
import type { ChangeListQuery, ChangeListResponse, ItemDiff } from '@/types/changes';
import {
  BUILD_1451,
  BUILD_1460,
  BUILD_17105,
  BUILD_PRK,
  CRITTER_AOID,
  CRITTER_COMPARE,
  DIFF_REGISTRY,
  FIRST_BUILD_LIST,
  GRAFT_DIFF,
  NOTE_ATTACK_RANGE,
  ROW_ADDED,
  ROW_CRITTER,
  ROW_GRAFT,
  ROW_REMOVED,
  TRANSITIONS_1460,
  changeList,
  changeRow,
  compareList,
  compareResult,
  emptyDiff,
  longEffectsDiff,
  manyTransitions,
  transitionsRoute,
} from '../helpers/change-fixtures';

const mockApi = vi.mocked(apiClient);

function makeRouter(): Router {
  const blank = { template: '<div />' };
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'Root', component: blank },
      { path: '/:version/changes', name: 'BuildChanges', component: blank },
      { path: '/:version/compare/:base', name: 'BuildCompare', component: blank },
      { path: '/:version/items/:aoid', name: 'ItemDetail', component: blank },
    ],
  });
}

/** The entry at `index`, counting from the end when negative. */
function last<T>(list: T[], index = -1): T | undefined {
  return list[index < 0 ? list.length + index : index];
}

let wrapper: VueWrapper | null = null;

async function mountPage(router: Router, pinia: Pinia): Promise<VueWrapper> {
  wrapper = mount(BuildChanges, {
    global: { plugins: [PrimeVue, pinia, router] },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

/** The query of the n-th list request (0 = first; negative counts from the last). */
function listQuery(index = -1): ChangeListQuery {
  const calls = mockApi.getBuildChanges.mock.calls.filter(
    ([query]) => query?.note_id === undefined
  );
  const call = last(calls, index);
  if (!call) throw new Error('no change list request was made');
  return call[0] as ChangeListQuery;
}

function listRequestCount(): number {
  return mockApi.getBuildChanges.mock.calls.filter(([query]) => query?.note_id === undefined)
    .length;
}

describe('build change list', () => {
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

    mockApi.getBuildChanges.mockImplementation(async (query?: ChangeListQuery) =>
      query?.note_id !== undefined
        ? changeList({
            items: [changeRow({ aoid: 300001, name: 'Noted Rifle', note_id: query.note_id })],
            total: 869,
            page: query.page ?? 1,
            page_size: query.page_size ?? 25,
            notes: [NOTE_ATTACK_RANGE],
          })
        : changeList({ total: 7781, page: query?.page ?? 1, page_size: query?.page_size ?? 50 })
    );
    mockApi.compareBuilds.mockImplementation(async (_base: string, query?: ChangeListQuery) =>
      compareList({ page: query?.page ?? 1, page_size: query?.page_size ?? 50 })
    );
    mockApi.getBuildTransitions.mockResolvedValue(TRANSITIONS_1460);
    mockApi.compareItem.mockResolvedValue({ ...CRITTER_COMPARE, diff: GRAFT_DIFF });

    router = makeRouter();
    await router.push('/ao-14-6-0/changes');
    await router.isReady();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.useRealTimers();
  });

  describe('default view', () => {
    it('leads with gameplay and economy changes of the build against the one before', async () => {
      const page = await mountPage(router, pinia);

      expect(listRequestCount()).toBe(1);
      expect(listQuery()).toEqual({
        page: 1,
        page_size: 50,
        sort: 'name',
        relevance: ['gameplay', 'economy'],
      });
      expect(mockApi.getBuildChanges.mock.calls[0][1]).toMatchObject({ gameVersion: 'ao-14-6-0' });

      expect(page.find('h1').text()).toContain('What changed in AO 14.6.0');
      expect(page.find('[data-testid="changes-scope"]').text()).toBe(
        'Compared with AO 14.5.1, the build before it.'
      );
      expect(page.find('[data-testid="changes-count"]').text()).toContain('1-2 of 7,781 changes');
    });

    it('shows the summary counts of the whole build as a header', async () => {
      const page = await mountPage(router, pinia);

      expect(page.find('[data-testid="summary-total"]').text()).toBe('8,650');
      expect(page.find('[data-testid="summary-added"]').text()).toBe('968');
      expect(page.find('[data-testid="summary-removed"]').text()).toBe('0');
      expect(page.find('[data-testid="summary-changed"]').text()).toBe('7,682');
      expect(page.find('[data-testid="summary-gameplay"]').text()).toBe('7,237');
      expect(page.find('[data-testid="summary-cosmetic"]').text()).toBe('5,844');
      expect(page.find('[data-testid="summary-noted"]').text()).toBe('869');
    });

    it('lists rows with what they are and how they changed, linked to the item page', async () => {
      const page = await mountPage(router, pinia);

      const rows = page.findAll('[data-testid="changes-list"] > [data-testid="change-row"]');
      expect(rows.map((row) => row.attributes('data-aoid'))).toEqual(['88805', '88393']);

      const graft = rows[0];
      expect(graft.text()).toContain('Boosted-Graft: Assault Rifle Expertise');
      expect(graft.text()).toContain('Armor');
      expect(graft.text()).toContain('QL 12');
      expect(graft.find('[data-testid="change-kind"]').text()).toContain('Changed');
      expect(graft.findAll('[data-testid="change-part"]').map((part) => part.text())).toEqual([
        'Text',
        'Stats',
        'Effects',
      ]);
      expect(graft.find('[data-testid="change-row-link"]').attributes('href')).toBe(
        '/ao-14-6-0/items/88805'
      );
    });

    it('puts cosmetic and text changes one click away', async () => {
      const page = await mountPage(router, pinia);

      await page.find('[data-testid="changes-show-all"]').trigger('click');
      await flushPromises();

      expect(router.currentRoute.value.query.relevance).toBe('all');
      expect(listQuery().relevance).toBeUndefined();
      expect(page.find('[data-testid="changes-show-all"]').exists()).toBe(false);
    });
  });

  describe('rows', () => {
    it('opens a row to its diff in place, fetching it once', async () => {
      const page = await mountPage(router, pinia);
      const row = page.find('[data-testid="change-row"][data-aoid="88805"]');

      expect(row.find('[data-testid="change-row-diff"]').exists()).toBe(false);
      await row.find('[data-testid="change-row-toggle"]').trigger('click');
      await flushPromises();

      expect(mockApi.compareItem).toHaveBeenCalledTimes(1);
      const [aoid, base, options] = mockApi.compareItem.mock.calls[0];
      expect(aoid).toBe(88805);
      expect(base).toBe('ao-14-5-1');
      expect(options).toMatchObject({ gameVersion: 'ao-14-6-0' });

      const diff = row.find('[data-testid="item-diff"]');
      // Description diffed by word.
      const text = diff.find('[data-testid="diff-text"][data-field="description"]');
      expect(text.findAll('del').map((node) => node.text())).toContain('Sensory Impr');
      expect(text.findAll('ins').map((node) => node.text())).toContain('Psycho Modi');
      // One effect removed, one added, each with its sign.
      const effects = diff.findAll('[data-testid="diff-effect"]');
      expect(effects.map((effect) => effect.attributes('data-op'))).toEqual(['removed', 'added']);
      expect(effects[0].text()).toContain('Lock skill SensoryImprovement');
      expect(effects[1].text()).toContain('Lock skill PsychologicalModification');
      // A stat that went away.
      const mass = diff.find('[data-testid="diff-stat"][data-stat="2"]');
      expect(mass.text()).toContain('Mass');
      expect(mass.find('del').text()).toBe('410');

      // Closing and reopening does not ask again.
      await row.find('[data-testid="change-row-toggle"]').trigger('click');
      await row.find('[data-testid="change-row-toggle"]').trigger('click');
      await flushPromises();
      expect(mockApi.compareItem).toHaveBeenCalledTimes(1);
    });

    it('shows every diff of the page when asked, without a request per row', async () => {
      mockApi.getBuildChanges.mockImplementation(async (query?: ChangeListQuery) =>
        changeList({
          items: [{ ...ROW_GRAFT, diff: query?.include_diff ? GRAFT_DIFF : null }],
          total: 1,
        })
      );
      const page = await mountPage(router, pinia);

      await page.find('[data-testid="changes-show-diffs"]').setValue(true);
      await flushPromises();

      expect(router.currentRoute.value.query.diffs).toBe('1');
      expect(listQuery().include_diff).toBe(true);
      expect(page.find('[data-testid="change-row"] [data-testid="item-diff"]').exists()).toBe(true);
      expect(mockApi.compareItem).not.toHaveBeenCalled();
    });

    it('leaves a diff too large for the page to be loaded when its row is opened', async () => {
      await router.push('/ao-14-6-0/changes?diffs=1');
      mockApi.getBuildChanges.mockResolvedValue(
        changeList({
          items: [
            { ...ROW_GRAFT, diff: GRAFT_DIFF },
            { ...ROW_CRITTER, diff: null, diff_omitted: true },
          ],
          total: 2,
        })
      );
      mockApi.compareItem.mockResolvedValue(compareResult('changed', BUILD_1460, BUILD_1451));
      const page = await mountPage(router, pinia);

      // Every diff the page came with is open; the large one was not fetched for it.
      expect(page.findAll('[data-testid="item-diff"]')).toHaveLength(1);
      expect(mockApi.compareItem).not.toHaveBeenCalled();
      const large = page.find(`[data-testid="change-row"][data-aoid="${CRITTER_AOID}"]`);
      expect(large.find('[data-testid="change-row-large-diff"]').exists()).toBe(true);

      await large.find('[data-testid="change-row-toggle"]').trigger('click');
      await flushPromises();

      expect(mockApi.compareItem).toHaveBeenCalledTimes(1);
      expect(mockApi.compareItem.mock.calls[0][0]).toBe(CRITTER_AOID);
      expect(large.find('[data-testid="diff-effect-field"]').text()).toContain('Chance');
      expect(large.find('[data-testid="change-row-large-diff"]').exists()).toBe(false);
    });

    it('folds a long diff: unchanged conditions and the effects past the first ten', async () => {
      await router.push('/ao-14-6-0/changes?diffs=1');
      mockApi.getBuildChanges.mockResolvedValue(
        changeList({ items: [{ ...ROW_GRAFT, diff: longEffectsDiff(43, 12) }], total: 1 })
      );
      const page = await mountPage(router, pinia);
      const diff = page.find('[data-testid="item-diff"]');

      expect(diff.findAll('[data-testid="diff-effect"]')).toHaveLength(10);
      const more = diff.find('[data-testid="diff-effects-more"]');
      expect(more.text()).toBe('Show all 43 effect changes');

      // Of an effect's conditions only the one that changed is listed.
      const conditions = diff.find('[data-testid="diff-criteria"]');
      const rows = conditions.findAll('[data-testid="diff-criterion"]');
      expect(rows).toHaveLength(1);
      expect(rows[0].attributes('data-op')).toBe('changed');
      expect(rows[0].text()).toContain('Level ≥ 100');
      expect(rows[0].text()).toContain('Level ≥ 150');
      const unchanged = conditions.find('[data-testid="diff-criteria-unchanged"]');
      expect(unchanged.text()).toBe('Show 12 unchanged');

      await unchanged.trigger('click');
      expect(conditions.findAll('[data-testid="diff-criterion"]')).toHaveLength(13);
      // No row is an AND: everything listed is required.
      expect(conditions.text()).not.toContain('AND');

      await more.trigger('click');
      expect(diff.findAll('[data-testid="diff-effect"]')).toHaveLength(43);
    });

    it('names what a number stands for and tells same-named rows apart by AOID', async () => {
      await router.push('/ao-14-6-0/changes?diffs=1');
      const diff: ItemDiff = {
        ...emptyDiff(),
        stats: [
          { stat: 440, change: 'changed', old: 118, new: 120, bits_set: null, bits_cleared: null },
          { stat: 4, change: 'removed', old: 15, new: null, bits_set: null, bits_cleared: null },
          { stat: 74, change: 'changed', old: 2, new: 7, bits_set: null, bits_cleared: null },
        ],
        actions: [
          {
            action: 6,
            change: 'changed',
            criteria: [
              { op: 'removed', old: { value1: 60, value2: 15, operator: 24 }, new: null },
              { op: 'added', old: null, new: { value1: 33, value2: 1, operator: 0 } },
            ],
          },
        ],
      };
      mockApi.getBuildChanges.mockResolvedValue(
        changeList({ items: [{ ...ROW_GRAFT, diff }, changeRow({ aoid: 88806 })], total: 2 })
      );
      const page = await mountPage(router, pinia);

      const rows = page.findAll('[data-testid="change-row"]');
      expect(rows.map((row) => row.find('[data-testid="change-row-aoid"]').text())).toEqual([
        'AOID 88805',
        'AOID 88806',
      ]);

      const initiative = page.find('[data-testid="diff-stat"][data-stat="440"]');
      expect(initiative.find('del').text()).toBe('MeleeInit');
      expect(initiative.find('ins').text()).toBe('PhysicalInit');
      // Names have no difference to show; a number without a name stays a number.
      expect(initiative.text()).not.toContain('+2');
      expect(page.find('[data-testid="diff-stat"][data-stat="4"] del').text()).toBe('15');
      expect(page.find('[data-testid="diff-stat"][data-stat="74"]').text()).toContain('(+5)');

      const criteria = page.findAll('[data-testid="diff-criterion"]').map((row) => row.text());
      expect(criteria[0]).toContain('Profession ≠ Shade');
      expect(criteria[1]).toContain('Faction = Clan');
    });

    it('lists added and removed items plainly, a removed one linked to the older build', async () => {
      mockApi.getBuildChanges.mockResolvedValue(
        changeList({
          items: [
            ROW_ADDED,
            ROW_REMOVED,
            changeRow({ aoid: 7, old_name: 'pill', name: 'Pill', old_ql: 10, ql: 12 }),
          ],
          total: 3,
        })
      );
      const page = await mountPage(router, pinia);

      const added = page.find('[data-testid="change-row"][data-kind="added"]');
      expect(added.find('[data-testid="change-kind"]').text()).toContain('+');
      expect(added.find('[data-testid="change-kind"]').text()).toContain('Added');
      expect(added.find('[data-testid="change-row-toggle"]').exists()).toBe(false);

      const removed = page.find('[data-testid="change-row"][data-kind="removed"]');
      expect(removed.find('[data-testid="change-kind"]').text()).toContain('Removed');
      expect(removed.find('[data-testid="change-row-link"]').attributes('href')).toBe(
        '/ao-14-6-0/items/200002?as=ao-14-5-1'
      );

      const renamed = page.find('[data-testid="change-row"][data-aoid="7"]');
      expect(renamed.find('[data-testid="change-row-old-name"]').text()).toContain('"pill"');
      expect(renamed.text()).toContain('QL 10 → 12');
    });
  });

  describe('build notes', () => {
    it('collapses a note to one line with its count', async () => {
      const page = await mountPage(router, pinia);

      const note = page.find('[data-testid="build-note"]');
      expect(note.text()).toContain('Weapons given an explicit attack range');
      expect(note.find('[data-testid="build-note-count"]').text()).toBe('869 changes');
      expect(note.find('[data-testid="build-note-items"]').exists()).toBe(false);
      expect(
        mockApi.getBuildChanges.mock.calls.some(([query]) => query?.note_id !== undefined)
      ).toBe(false);
    });

    it('expands a note to the items it explains, a page at a time, under the same filters', async () => {
      await router.push('/ao-14-6-0/changes?type=item&relevance=all');
      const page = await mountPage(router, pinia);

      await page.find('[data-testid="build-note-toggle"]').trigger('click');
      await flushPromises();

      const noteCalls = mockApi.getBuildChanges.mock.calls.filter(
        ([query]) => query?.note_id !== undefined
      );
      expect(noteCalls).toHaveLength(1);
      expect(noteCalls[0][0]).toMatchObject({
        note_id: 4,
        page: 1,
        page_size: 25,
        is_nano: false,
      });

      const items = page.find('[data-testid="build-note-items"]');
      expect(items.find('[data-testid="change-row"]').text()).toContain('Noted Rifle');

      await items.find('[data-testid="build-note-next"]').trigger('click');
      await flushPromises();
      expect(
        last(
          mockApi.getBuildChanges.mock.calls.filter(([query]) => query?.note_id !== undefined)
        )?.[0]
      ).toMatchObject({ note_id: 4, page: 2 });

      // Collapsing hides them again.
      await page.find('[data-testid="build-note-toggle"]').trigger('click');
      expect(page.find('[data-testid="build-note-items"]').exists()).toBe(false);
    });

    it('says how many of a note match the filters', async () => {
      mockApi.getBuildChanges.mockResolvedValue(
        changeList({ notes: [{ ...NOTE_ATTACK_RANGE, matching: 12 }] })
      );
      const page = await mountPage(router, pinia);

      expect(page.find('[data-testid="build-note-count"]').text()).toBe(
        '12 of 869 changes match the filters'
      );
    });

    it('says why a note with nothing to list under the filters cannot be opened', async () => {
      mockApi.getBuildChanges.mockResolvedValue(
        changeList({ notes: [{ ...NOTE_ATTACK_RANGE, matching: 0 }] })
      );
      const page = await mountPage(router, pinia);

      const note = page.find('[data-testid="build-note"]');
      expect(note.find('[data-testid="build-note-toggle"]').attributes('disabled')).toBeDefined();
      expect(note.find('[data-testid="build-note-hint"]').text()).toContain(
        'None of these changes match the filters'
      );
    });

    it('can list the noted changes with the rest instead', async () => {
      const page = await mountPage(router, pinia);

      await page.find('[data-testid="changes-expand-notes"]').setValue(true);
      await flushPromises();

      expect(router.currentRoute.value.query.notes).toBe('expand');
      expect(listQuery().notes).toBe('expand');
      expect(page.find('[data-testid="build-notes"]').exists()).toBe(false);
    });
  });

  describe('patch notes', () => {
    it('reads the most shared transitions as patch notes', async () => {
      const page = await mountPage(router, pinia);

      expect(mockApi.getBuildTransitions).toHaveBeenCalledTimes(1);
      expect(mockApi.getBuildTransitions.mock.calls[0][0]).toMatchObject({
        part: ['text', 'stats', 'effects', 'actions', 'atkdef'],
      });

      const notes = page.findAll('[data-testid="patch-note"]').map((note) => note.text());
      // The first few lines only, so the list below stays on the first screen.
      expect(notes).toHaveLength(3);
      // The count is a word apart from the change it counts.
      expect(notes[0]).toMatch(/^AttackRange added: 20\s+on 2,464 items/);
      expect(notes[2]).toMatch(/…% chance to cast …: Chance 60% → 100%\s+on 760 items/);

      await page.find('[data-testid="patch-notes-more"]').trigger('click');
      const all = page.findAll('[data-testid="patch-note"]').map((note) => note.text());
      // A line that only moves an AND is left out; the requirement it joins is the note.
      expect(all).toHaveLength(8);
      expect(all.some((note) => note.includes('requirement added: AND'))).toBe(false);
    });

    it('leaves out of the patch notes what the list leaves out', async () => {
      const page = await mountPage(router, pinia);

      // The default view: gameplay and economy, noted changes collapsed.
      expect(mockApi.getBuildTransitions).toHaveBeenCalledTimes(1);
      expect(mockApi.getBuildTransitions.mock.calls[0][0]).toMatchObject({
        relevance: ['gameplay', 'economy'],
        notes: 'collapse',
      });

      await page.find('[data-testid="changes-show-all"]').trigger('click');
      await flushPromises();
      expect(last(mockApi.getBuildTransitions.mock.calls)?.[0]).toMatchObject({
        relevance: ['gameplay', 'economy', 'cosmetic', 'text'],
        notes: 'collapse',
      });

      await page.find('[data-testid="changes-expand-notes"]').setValue(true);
      await flushPromises();
      expect(last(mockApi.getBuildTransitions.mock.calls)?.[0]).toMatchObject({
        relevance: ['gameplay', 'economy', 'cosmetic', 'text'],
        notes: 'expand',
      });
      expect(mockApi.getBuildTransitions).toHaveBeenCalledTimes(3);
    });

    it('reads the patch notes of a filtered view from its URL', async () => {
      await router.push('/ao-14-6-0/changes?relevance=text&notes=expand');
      await mountPage(router, pinia);

      expect(mockApi.getBuildTransitions.mock.calls[0][0]).toMatchObject({
        relevance: ['text'],
        notes: 'expand',
      });
    });

    it('leads from a patch note to the items it was done to', async () => {
      await router.push('/ao-14-6-0/changes?kind=added&sort=ql');
      const page = await mountPage(router, pinia);

      await page.find('[data-testid="patch-notes-more"]').trigger('click');
      const effectNote = page
        .findAll('[data-testid="patch-note"]')
        .find((note) => note.text().includes('chance to cast'));
      await effectNote!.find('[data-testid="patch-note-filter"]').trigger('click');
      await flushPromises();

      // The other filters give way; the sort stays, and so does what the notes were read under.
      expect(router.currentRoute.value.query).toEqual({
        sort: 'ql',
        t: 'effect:53089:spell_params.Chance',
        tfrom: '60',
        tto: '100',
      });
      expect(listQuery()).toEqual({
        page: 1,
        page_size: 50,
        sort: 'ql',
        transition: 'effect:53089:spell_params.Chance',
        transition_old: '60',
        transition_new: '100',
        relevance: ['gameplay', 'economy'],
      });
      // The patch notes did not change under the reader.
      expect(mockApi.getBuildTransitions).toHaveBeenCalledTimes(1);

      const banner = page.find('[data-testid="changes-transition"]');
      expect(banner.text()).toContain('…% chance to cast …: Chance 60% → 100%');

      await page.find('[data-testid="changes-transition-clear"]').trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.query.t).toBeUndefined();
      expect(listQuery().transition).toBeUndefined();
    });

    it('restores a patch note filter from a shared URL, an added stat included', async () => {
      await router.push('/ao-14-6-0/changes?relevance=all&t=stat:287&tfrom=null&tto=20');
      const page = await mountPage(router, pinia);

      expect(listQuery()).toMatchObject({
        transition: 'stat:287',
        transition_old: 'null',
        transition_new: '20',
      });
      expect(page.find('[data-testid="changes-transition"]').text()).toContain(
        'AttackRange added: 20'
      );
    });

    it('keeps the list usable when the patch notes cannot be loaded', async () => {
      mockApi.getBuildTransitions.mockRejectedValue(new Error('transitions unavailable'));
      const page = await mountPage(router, pinia);

      expect(page.find('[data-testid="patch-notes-error"]').exists()).toBe(true);
      expect(
        page.findAll('[data-testid="changes-list"] > [data-testid="change-row"]')
      ).toHaveLength(2);
    });
  });

  describe('filters and the URL', () => {
    it('restores a filtered, sorted, paged view from its URL', async () => {
      await router.push(
        '/ao-14-6-0/changes?kind=changed&part=effects,stats&relevance=gameplay&type=nano&class=1&slot=6&minql=100&maxql=200&prof=11&q=Rifle&sort=ql&page=3&size=25'
      );
      const page = await mountPage(router, pinia);

      expect(listQuery()).toEqual({
        page: 3,
        page_size: 25,
        sort: 'ql',
        kind: ['changed'],
        part: ['stats', 'effects'],
        relevance: ['gameplay'],
        is_nano: true,
        item_class: 1,
        min_ql: 100,
        max_ql: 200,
        profession: 11,
        slot: 6,
        search: 'Rifle',
      });

      // The controls show the restored state.
      const checked = (testId: string) =>
        page
          .findAll(`[data-testid="${testId}"]`)
          .filter((box) => (box.element as HTMLInputElement).checked)
          .map((box) => box.attributes('data-value'));
      expect(checked('change-filter-kind')).toEqual(['changed']);
      expect(checked('change-filter-part')).toEqual(['stats', 'effects']);
      expect(checked('change-filter-relevance')).toEqual(['gameplay']);
      const value = (testId: string) =>
        (page.find(`[data-testid="${testId}"]`).element as HTMLInputElement).value;
      expect(value('change-filter-type')).toBe('nano');
      expect(value('change-filter-class')).toBe('1');
      expect(value('change-filter-slot')).toBe('6');
      expect(value('change-filter-minql')).toBe('100');
      expect(value('change-filter-maxql')).toBe('200');
      expect(value('change-filter-profession')).toBe('11');
      expect(value('change-filter-search')).toBe('Rifle');
      expect(value('changes-sort')).toBe('ql');
    });

    it('writes each filter to the URL and asks for the first page again', async () => {
      await router.push('/ao-14-6-0/changes?page=4');
      const page = await mountPage(router, pinia);

      await page.find('[data-testid="change-filter-kind"][data-value="added"]').setValue(true);
      await flushPromises();
      expect(router.currentRoute.value.query).toMatchObject({ kind: 'added' });
      expect(router.currentRoute.value.query.page).toBeUndefined();
      expect(listQuery()).toMatchObject({ kind: ['added'], page: 1 });

      await page.find('[data-testid="change-filter-part"][data-value="actions"]').setValue(true);
      await page.find('[data-testid="change-filter-type"]').setValue('item');
      await page.find('[data-testid="change-filter-class"]').setValue('2');
      await flushPromises();
      await page.find('[data-testid="change-filter-slot"]').setValue('2');
      await page.find('[data-testid="change-filter-minql"]').setValue('150');
      await page.find('[data-testid="change-filter-profession"]').setValue('4');
      await page.find('[data-testid="changes-sort"]').setValue('aoid');
      await flushPromises();

      expect(router.currentRoute.value.query).toEqual({
        kind: 'added',
        part: 'actions',
        type: 'item',
        class: '2',
        slot: '2',
        minql: '150',
        prof: '4',
        sort: 'aoid',
      });
      expect(listQuery()).toEqual({
        page: 1,
        page_size: 50,
        sort: 'aoid',
        kind: ['added'],
        part: ['actions'],
        relevance: ['gameplay', 'economy'],
        is_nano: false,
        item_class: 2,
        min_ql: 150,
        profession: 4,
        slot: 2,
      });
    });

    it('offers equipment slots only for a class that has them, and drops the slot with the class', async () => {
      await router.push('/ao-14-6-0/changes?class=1&slot=6');
      const page = await mountPage(router, pinia);
      expect(page.find('[data-testid="change-filter-slot"]').exists()).toBe(true);

      await page.find('[data-testid="change-filter-class"]').setValue('');
      await flushPromises();

      expect(router.currentRoute.value.query.slot).toBeUndefined();
      expect(page.find('[data-testid="change-filter-slot"]').exists()).toBe(false);
    });

    it('resets the filters to the default view', async () => {
      await router.push('/ao-14-6-0/changes?kind=added&q=Rifle&sort=ql');
      const page = await mountPage(router, pinia);

      expect(page.find('[data-testid="change-filters-reset"]').text()).toContain('2');
      await page.find('[data-testid="change-filters-reset"]').trigger('click');
      await flushPromises();

      expect(router.currentRoute.value.query).toEqual({ sort: 'ql' });
    });

    it('follows the URL when it changes under the page (back and forward)', async () => {
      const page = await mountPage(router, pinia);

      await router.push('/ao-14-6-0/changes?kind=removed');
      await flushPromises();

      expect(listQuery().kind).toEqual(['removed']);
      expect(
        (
          page.find('[data-testid="change-filter-kind"][data-value="removed"]')
            .element as HTMLInputElement
        ).checked
      ).toBe(true);
    });

    it('undoes a filter with Back, and typing a name adds no step of its own', async () => {
      const page = await mountPage(router, pinia);

      await page.find('[data-testid="change-filter-kind"][data-value="removed"]').setValue(true);
      await flushPromises();
      await page.find('[data-testid="changes-sort"]').setValue('ql');
      await flushPromises();
      expect(router.currentRoute.value.query).toEqual({ kind: 'removed', sort: 'ql' });

      vi.useFakeTimers();
      await page.find('[data-testid="change-filter-search"]').setValue('Rifle');
      await vi.advanceTimersByTimeAsync(350);
      vi.useRealTimers();
      await flushPromises();
      expect(router.currentRoute.value.query).toEqual({ kind: 'removed', sort: 'ql', q: 'Rifle' });

      // Back undoes the sort (the typed name went into the same step).
      router.back();
      await flushPromises();
      expect(router.currentRoute.value.name).toBe('BuildChanges');
      expect(router.currentRoute.value.query).toEqual({ kind: 'removed' });
      expect((page.find('[data-testid="changes-sort"]').element as HTMLSelectElement).value).toBe(
        'name'
      );

      router.back();
      await flushPromises();
      expect(router.currentRoute.value.name).toBe('BuildChanges');
      expect(router.currentRoute.value.query).toEqual({});
      expect(
        (
          page.find('[data-testid="change-filter-kind"][data-value="removed"]')
            .element as HTMLInputElement
        ).checked
      ).toBe(false);
    });

    it('waits for a pause in typing before searching by name', async () => {
      const page = await mountPage(router, pinia);
      vi.useFakeTimers();

      const search = page.find('[data-testid="change-filter-search"]');
      await search.setValue('Ri');
      await search.setValue('Rifle');
      expect(listRequestCount()).toBe(1);

      await vi.advanceTimersByTimeAsync(350);
      vi.useRealTimers();
      await flushPromises();

      expect(router.currentRoute.value.query.q).toBe('Rifle');
      expect(listRequestCount()).toBe(2);
      expect(listQuery().search).toBe('Rifle');
    });
  });

  describe('paging and requests', () => {
    it('pages through the API and never asks for more than a page', async () => {
      const page = await mountPage(router, pinia);

      page
        .findComponent(Paginator)
        .vm.$emit('page', { page: 1, first: 50, rows: 50, pageCount: 156 });
      await flushPromises();

      expect(router.currentRoute.value.query.page).toBe('2');
      expect(listQuery()).toMatchObject({ page: 2, page_size: 50 });
      for (const [query] of mockApi.getBuildChanges.mock.calls) {
        expect(query?.page_size ?? 50).toBeLessThanOrEqual(200);
      }
    });

    it('changes the page size from the paginator and starts over', async () => {
      await router.push('/ao-14-6-0/changes?page=3');
      const page = await mountPage(router, pinia);

      page
        .findComponent(Paginator)
        .vm.$emit('page', { page: 0, first: 0, rows: 100, pageCount: 78 });
      await flushPromises();

      expect(router.currentRoute.value.query).toMatchObject({ size: '100' });
      expect(router.currentRoute.value.query.page).toBeUndefined();
      expect(listQuery()).toMatchObject({ page: 1, page_size: 100 });
    });

    it('does not repeat a request it already has the answer to', async () => {
      const page = await mountPage(router, pinia);

      await page.find('[data-testid="change-filter-kind"][data-value="added"]').setValue(true);
      await flushPromises();
      await page.find('[data-testid="change-filter-kind"][data-value="added"]').setValue(false);
      await flushPromises();

      // Default view, filtered view, and the default view again from memory.
      expect(listRequestCount()).toBe(2);
      expect(mockApi.getBuildTransitions).toHaveBeenCalledTimes(1);
    });

    it('cancels the request a newer filter change supersedes and shows only the newest answer', async () => {
      const signals: AbortSignal[] = [];
      const resolvers: Array<(value: ChangeListResponse) => void> = [];
      mockApi.getBuildChanges.mockImplementation(
        (_query?: ChangeListQuery, options?: { signal?: AbortSignal }) =>
          new Promise<ChangeListResponse>((resolve, reject) => {
            if (options?.signal) {
              signals.push(options.signal);
              options.signal.addEventListener('abort', () =>
                reject(Object.assign(new Error('canceled'), { code: 'ERR_CANCELED' }))
              );
            }
            resolvers.push(resolve);
          })
      );
      const page = await mountPage(router, pinia);
      expect(page.find('[data-testid="changes-loading"]').exists()).toBe(true);

      await router.replace('/ao-14-6-0/changes?kind=added');
      await flushPromises();
      await router.replace('/ao-14-6-0/changes?kind=removed');
      await flushPromises();

      expect(signals.map((signal) => signal.aborted)).toEqual([true, true, false]);

      // A late answer of a superseded request changes nothing.
      resolvers[1](changeList({ items: [ROW_ADDED], total: 1 }));
      await flushPromises();
      expect(page.find('[data-testid="changes-list"]').exists()).toBe(false);

      resolvers[2](changeList({ items: [ROW_REMOVED], total: 1 }));
      await flushPromises();
      const rows = page.findAll('[data-testid="changes-list"] > [data-testid="change-row"]');
      expect(rows.map((row) => row.attributes('data-aoid'))).toEqual(['200002']);
      expect(page.find('[data-testid="changes-error"]').exists()).toBe(false);
    });

    it('shows an error with a retry when the list cannot be loaded', async () => {
      mockApi.getBuildChanges.mockRejectedValueOnce({
        type: 'error',
        title: 'Network Error',
        message: 'Unable to connect to the server',
        action: 'Check your internet connection and try again',
        recoverable: true,
      });
      const page = await mountPage(router, pinia);

      expect(page.find('[data-testid="changes-error"]').text()).toContain(
        'Unable to connect to the server'
      );

      await page.find('[data-testid="changes-retry"]').trigger('click');
      await flushPromises();

      expect(page.find('[data-testid="changes-error"]').exists()).toBe(false);
      expect(
        page.findAll('[data-testid="changes-list"] > [data-testid="change-row"]')
      ).toHaveLength(2);
    });

    it('says so when no change matches the filters', async () => {
      mockApi.getBuildChanges.mockResolvedValue(changeList({ items: [], total: 0, notes: [] }));
      const page = await mountPage(router, pinia);

      expect(page.find('[data-testid="changes-empty"]').text()).toContain('No changes match');
    });
  });

  describe('edge builds', () => {
    it('explains the oldest build, where everything is added and nothing compares', async () => {
      await setCurrentVersion('ao-14-2-2');
      await router.push('/ao-14-2-2/changes');
      mockApi.getBuildChanges.mockResolvedValue(FIRST_BUILD_LIST);
      const page = await mountPage(router, pinia);

      expect(page.find('[data-testid="changes-first-build"]').text()).toContain(
        'AO 14.2.2 is the oldest build on record'
      );
      expect(page.find('[data-testid="changes-scope"]').text()).toBe('The oldest build on record.');
      expect(page.find('[data-testid="summary-added"]').text()).toBe('45,918');
      // No patch notes without a base, and an unnamed item still gets a label.
      expect(mockApi.getBuildTransitions).not.toHaveBeenCalled();
      const row = page.find('[data-testid="change-row"]');
      expect(row.text()).toContain('Unnamed item 41560');
      expect(row.find('[data-testid="change-row-toggle"]').exists()).toBe(false);
    });

    it('compares the first build of the fork with the AO build it came from', async () => {
      await setCurrentVersion('prk-0-7-1');
      await router.push('/prk-0-7-1/changes');
      mockApi.getBuildChanges.mockResolvedValue(
        changeList({ build: BUILD_PRK, base: BUILD_17105, notes: [] })
      );
      const page = await mountPage(router, pinia);

      expect(page.find('h1').text()).toContain('What changed in Project Rubi-Ka 0.7.1');
      expect(page.find('[data-testid="changes-scope"]').text()).toBe(
        'Compared with AO 17.10.5, the build it was forked from.'
      );
      expect(mockApi.getBuildChanges.mock.calls[0][1]).toMatchObject({ gameVersion: 'prk-0-7-1' });
    });
  });

  describe('compare two builds', () => {
    it('lists the net difference from the base in the URL', async () => {
      await router.push('/ao-14-6-0/compare/ao-14-2-2');
      const page = await mountPage(router, pinia);

      expect(mockApi.getBuildChanges).not.toHaveBeenCalled();
      expect(mockApi.compareBuilds).toHaveBeenCalledTimes(1);
      const [base, query, options] = mockApi.compareBuilds.mock.calls[0];
      expect(base).toBe('ao-14-2-2');
      expect(query).toMatchObject({ page: 1, page_size: 50, relevance: ['gameplay', 'economy'] });
      expect(options).toMatchObject({ gameVersion: 'ao-14-6-0' });

      expect(page.find('h1').text()).toContain('Compare builds');
      const scope = page.find('[data-testid="changes-scope"]');
      expect(scope.find('[data-testid="compare-older"]').text()).toBe('AO 14.2.2');
      expect(scope.find('[data-testid="compare-newer"]').text()).toBe('AO 14.6.0');
      expect(scope.text()).toContain('every item that is not the same in both');
      expect(scope.find('[data-testid="compare-viewed-older"]').exists()).toBe(false);
      expect(page.find('[data-testid="summary-total"]').text()).toBe('64,464');
      expect(page.find('[data-testid="changes-count"]').text()).toContain('1-2 of 51,238 changes');
      // A comparison has no build notes and no patch notes.
      expect(page.find('[data-testid="build-notes"]').exists()).toBe(false);
      expect(page.find('[data-testid="patch-notes"]').exists()).toBe(false);
      expect(mockApi.getBuildTransitions).not.toHaveBeenCalled();
      // Only the first page of tens of thousands of rows is on the page.
      expect(page.findAll('[data-testid="change-row"]')).toHaveLength(2);
    });

    it('picks a base from the change list and keeps the filters', async () => {
      await router.push('/ao-14-6-0/changes?kind=changed&page=3');
      const page = await mountPage(router, pinia);

      const picker = page.find('[data-testid="compare-base-picker"]');
      expect(picker.find('option[value="ao-14-6-0"]').exists()).toBe(false);
      await picker.setValue('ao-14-2-2');
      await flushPromises();

      expect(router.currentRoute.value.name).toBe('BuildCompare');
      expect(router.currentRoute.value.params.base).toBe('ao-14-2-2');
      expect(router.currentRoute.value.query).toEqual({ kind: 'changed' });
      expect(last(mockApi.compareBuilds.mock.calls)?.[0]).toBe('ao-14-2-2');
      expect(last(mockApi.compareBuilds.mock.calls)?.[1]).toMatchObject({
        kind: ['changed'],
        page: 1,
      });
    });

    it('reads old to new when the build being browsed is the older of the two', async () => {
      await setCurrentVersion('ao-14-2-2');
      await router.push('/ao-14-2-2/compare/ao-14-6-0');
      mockApi.compareBuilds.mockResolvedValue(
        compareList({ items: [ROW_ADDED, ROW_REMOVED, ROW_CRITTER], total: 3 })
      );
      mockApi.compareItem.mockResolvedValue(compareResult('changed'));
      const page = await mountPage(router, pinia);

      // Asked as 14.6.0 against 14.2.2 although 14.2.2 is browsed; the URL stays as chosen.
      expect(mockApi.compareBuilds).toHaveBeenCalledTimes(1);
      const [base, , options] = mockApi.compareBuilds.mock.calls[0];
      expect(base).toBe('ao-14-2-2');
      expect(options).toMatchObject({ gameVersion: 'ao-14-6-0' });
      expect(router.currentRoute.value.fullPath).toBe('/ao-14-2-2/compare/ao-14-6-0');

      const scope = page.find('[data-testid="changes-scope"]');
      expect(scope.find('[data-testid="compare-older"]').text()).toBe('AO 14.2.2');
      expect(scope.find('[data-testid="compare-newer"]').text()).toBe('AO 14.6.0');
      expect(scope.text()).toContain('Added items are only in AO 14.6.0');
      expect(scope.text()).toContain('removed items only in AO 14.2.2');
      expect(scope.find('[data-testid="compare-viewed-older"]').text()).toBe(
        'You are browsing AO 14.2.2, the older of the two.'
      );

      // An item only the newer build has is not in the build browsed: shown as the newer has it.
      const link = (kind: string): string | undefined =>
        page
          .find(`[data-testid="change-row"][data-kind="${kind}"] [data-testid="change-row-link"]`)
          .attributes('href');
      expect(link('added')).toBe('/ao-14-2-2/items/200001?as=ao-14-6-0');
      expect(link('removed')).toBe('/ao-14-2-2/items/200002');
      expect(link('changed')).toBe(`/ao-14-2-2/items/${CRITTER_AOID}?compare=ao-14-6-0`);

      // A row's diff runs the same way as the list.
      await page
        .find('[data-testid="change-row"][data-kind="changed"] [data-testid="change-row-toggle"]')
        .trigger('click');
      await flushPromises();
      const [, itemBase, itemOptions] = mockApi.compareItem.mock.calls[0];
      expect(itemBase).toBe('ao-14-2-2');
      expect(itemOptions).toMatchObject({ gameVersion: 'ao-14-6-0' });
    });

    it('changes the base, compares across the fork, and returns to the own changes', async () => {
      await setCurrentVersion('ao-17-10-5');
      await router.push('/ao-17-10-5/compare/ao-14-6-0');
      mockApi.compareBuilds.mockImplementation(async (base: string) =>
        base === 'ao-17-10-5'
          ? compareList({ build: BUILD_PRK, base: BUILD_17105 })
          : compareList({ build: BUILD_17105, base: BUILD_1460 })
      );
      const page = await mountPage(router, pinia);
      expect(page.find('[data-testid="compare-fork-rule"]').exists()).toBe(false);

      await page.find('[data-testid="compare-base-picker"]').setValue('prk-0-7-1');
      await flushPromises();

      // The URL is as chosen; the fork's build is the newer side whichever is browsed.
      expect(router.currentRoute.value.fullPath).toBe('/ao-17-10-5/compare/prk-0-7-1');
      const [base, , options] = last(mockApi.compareBuilds.mock.calls)!;
      expect(base).toBe('ao-17-10-5');
      expect(options).toMatchObject({ gameVersion: 'prk-0-7-1' });
      const scope = page.find('[data-testid="changes-scope"]');
      expect(scope.find('[data-testid="compare-older"]').text()).toBe('AO 17.10.5');
      expect(scope.find('[data-testid="compare-newer"]').text()).toBe('Project Rubi-Ka 0.7.1');
      expect(scope.find('[data-testid="compare-fork-rule"]').text()).toBe(
        'Project Rubi-Ka is a fork of Anarchy Online, so its build always counts as the newer one.'
      );

      await page.find('[data-testid="compare-exit"]').trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.fullPath).toBe('/ao-17-10-5/changes');
      expect(mockApi.getBuildChanges).toHaveBeenCalledTimes(1);
    });

    it('asks the same comparison from either build of a pair', async () => {
      await setCurrentVersion('prk-0-7-1');
      await router.push('/prk-0-7-1/compare/ao-14-6-0');
      mockApi.compareBuilds.mockResolvedValue(compareList({ build: BUILD_PRK, base: BUILD_1460 }));
      await mountPage(router, pinia);

      const [base, , options] = mockApi.compareBuilds.mock.calls[0];
      expect(base).toBe('ao-14-6-0');
      expect(options).toMatchObject({ gameVersion: 'prk-0-7-1' });
    });

    it('links a compared row to the item page with the same comparison', async () => {
      await router.push('/ao-14-6-0/compare/ao-14-2-2');
      mockApi.compareItem.mockResolvedValue(compareResult('changed'));
      const page = await mountPage(router, pinia);

      const row = page.find(`[data-testid="change-row"][data-aoid="${CRITTER_AOID}"]`);
      expect(row.find('[data-testid="change-row-link"]').attributes('href')).toBe(
        `/ao-14-6-0/items/${CRITTER_AOID}?compare=ao-14-2-2`
      );

      await row.find('[data-testid="change-row-toggle"]').trigger('click');
      await flushPromises();
      const [, base, options] = mockApi.compareItem.mock.calls[0];
      expect(base).toBe('ao-14-2-2');
      expect(options).toMatchObject({ gameVersion: 'ao-14-6-0' });
      expect(row.find('[data-testid="diff-effect-field"]').text()).toContain('Chance');
    });

    it('asks for a different build when the base is the build itself', async () => {
      await router.push('/ao-14-6-0/compare/ao-14-6-0');
      const page = await mountPage(router, pinia);

      expect(page.find('[data-testid="changes-same-build"]').exists()).toBe(true);
      expect(mockApi.compareBuilds).not.toHaveBeenCalled();
    });

    it('reports a base the backend does not know', async () => {
      await router.push('/ao-14-6-0/compare/ao-99-9-9');
      mockApi.compareBuilds.mockRejectedValue({
        type: 'info',
        title: 'Not Found',
        message: "Unknown game version 'ao-99-9-9'",
        action: 'Pick another version',
        recoverable: true,
      });
      const page = await mountPage(router, pinia);

      expect(page.find('[data-testid="changes-error"]').text()).toContain(
        "Unknown game version 'ao-99-9-9'"
      );
    });
  });
  describe('patch notes under the filters of the page', () => {
    it('keeps "every change" and "with noted changes" when a patch note is opened', async () => {
      await router.push('/ao-14-6-0/changes?relevance=all&notes=expand&kind=added');
      const page = await mountPage(router, pinia);

      await page.find('[data-testid="patch-notes-more"]').trigger('click');
      const effectNote = page
        .findAll('[data-testid="patch-note"]')
        .find((note) => note.text().includes('chance to cast'));
      await effectNote!.find('[data-testid="patch-note-filter"]').trigger('click');
      await flushPromises();

      // The line counted every change, noted ones included: so does the list it leads to.
      expect(router.currentRoute.value.query).toEqual({
        relevance: 'all',
        notes: 'expand',
        t: 'effect:53089:spell_params.Chance',
        tfrom: '60',
        tto: '100',
      });
      expect(listQuery()).toEqual({
        page: 1,
        page_size: 50,
        sort: 'name',
        notes: 'expand',
        transition: 'effect:53089:spell_params.Chance',
        transition_old: '60',
        transition_new: '100',
      });
    });

    it('keeps a narrowed relevance when a patch note is opened', async () => {
      await router.push('/ao-14-6-0/changes?relevance=gameplay');
      const page = await mountPage(router, pinia);

      await page.find('[data-testid="patch-note-filter"]').trigger('click');
      await flushPromises();

      expect(router.currentRoute.value.query.relevance).toBe('gameplay');
      expect(router.currentRoute.value.query.notes).toBeUndefined();
      expect(listQuery().relevance).toEqual(['gameplay']);
      expect(listQuery().notes).toBeUndefined();
    });

    it('opens the patch notes from the header of the panel, and closes them again', async () => {
      const page = await mountPage(router, pinia);
      const header = page.find('[data-testid="patch-notes"] header');

      expect(header.find('[data-testid="patch-notes-shown"]').text()).toBe('3 of 8');
      expect(header.find('[data-testid="patch-notes-fewer"]').exists()).toBe(false);
      await header.find('[data-testid="patch-notes-more"]').trigger('click');

      expect(page.findAll('[data-testid="patch-note"]')).toHaveLength(8);
      expect(header.find('[data-testid="patch-notes-shown"]').text()).toBe('All 8 shown');
      // The route counts 9: the one that only moves an AND is accounted for, not listed.
      expect(page.find('[data-testid="patch-notes-hidden"]').text()).toBe(
        '1 line that only regroups requirements (AND, OR) left out.'
      );
      // Everything is on screen: one way back, and nothing more to ask for.
      expect(page.find('[data-testid="patch-notes-more"]').exists()).toBe(false);
      expect(page.find('[data-testid="patch-notes-more-below"]').exists()).toBe(false);

      await header.find('[data-testid="patch-notes-fewer"]').trigger('click');
      expect(page.findAll('[data-testid="patch-note"]')).toHaveLength(3);
      expect(header.find('[data-testid="patch-notes-more"]').exists()).toBe(true);
    });

    it('lists the patch notes of the parts ticked under "What changed"', async () => {
      mockApi.getBuildTransitions.mockImplementation(
        transitionsRoute(TRANSITIONS_1460.transitions)
      );
      const page = await mountPage(router, pinia);
      const parts = () =>
        page.findAll('[data-testid="patch-note"]').map((note) => note.attributes('data-part'));

      expect(parts()).toEqual(['stats', 'stats', 'effects']);

      await page.find('[data-testid="change-filter-part"][data-value="effects"]').setValue(true);
      await flushPromises();

      // The panel describes the slice the list shows: effect lines only.
      expect(listQuery().part).toEqual(['effects']);
      expect(parts()).toEqual(['effects', 'effects']);
      expect(page.find('[data-testid="patch-notes"]').text()).toContain('chance to cast');
      expect(page.find('[data-testid="patch-notes"]').text()).not.toContain('AttackRange');

      await page.find('[data-testid="change-filter-part"][data-value="effects"]').setValue(false);
      await flushPromises();
      expect(parts()).toEqual(['stats', 'stats', 'effects']);
    });

    it('says so when no line is shared in the parts ticked', async () => {
      mockApi.getBuildTransitions.mockImplementation(
        transitionsRoute(TRANSITIONS_1460.transitions)
      );
      await router.push('/ao-14-6-0/changes?part=misc');
      const page = await mountPage(router, pinia);

      expect(page.find('[data-testid="patch-notes-empty"]').text()).toContain(
        'No change of this kind'
      );
    });

    it('keeps the parts ticked when a patch note is opened', async () => {
      mockApi.getBuildTransitions.mockImplementation(
        transitionsRoute(TRANSITIONS_1460.transitions)
      );
      await router.push('/ao-14-6-0/changes?part=effects&kind=added');
      const page = await mountPage(router, pinia);

      await page.find('[data-testid="patch-note-filter"]').trigger('click');
      await flushPromises();

      expect(router.currentRoute.value.query).toMatchObject({
        part: 'effects',
        t: 'effect:53089:spell_params.Chance',
      });
      expect(router.currentRoute.value.query.kind).toBeUndefined();
      // The patch notes did not change under the reader.
      expect(mockApi.getBuildTransitions).toHaveBeenCalledTimes(1);
      expect(page.findAll('[data-testid="patch-note"]')).toHaveLength(2);
    });

    it('brings further patch notes on screen until none remain', async () => {
      mockApi.getBuildTransitions.mockImplementation(transitionsRoute(manyTransitions(180)));
      const page = await mountPage(router, pinia);
      const notes = () => page.findAll('[data-testid="patch-note"]');
      const shownText = () => page.find('[data-testid="patch-notes-shown"]').text();
      const retargeting = () => notes().find((note) => note.attributes('data-part') === 'effects');

      expect(notes()).toHaveLength(3);
      expect(shownText()).toBe('3 shown, 177 more');

      // The first step lists what the page already holds.
      await page.find('[data-testid="patch-notes-more"]').trigger('click');
      expect(notes()).toHaveLength(40);
      expect(shownText()).toBe('40 shown, 140 more');
      expect(mockApi.getBuildTransitions).toHaveBeenCalledTimes(1);
      expect(retargeting()).toBeUndefined();

      // The next one reaches the line ranked 56th.
      await page.find('[data-testid="patch-notes-more-below"]').trigger('click');
      await flushPromises();
      expect(notes()).toHaveLength(140);
      expect(retargeting()!.text()).toContain('on 95 items (656 times)');
      expect(notes()[139].text()).toContain('AttackRange added: 140');
      expect(shownText()).toBe('140 shown, 40 more');
      // Only the lines after the ones on screen were asked for.
      expect(last(mockApi.getBuildTransitions.mock.calls)?.[0]).toMatchObject({ offset: 40 });

      await page.find('[data-testid="patch-notes-more"]').trigger('click');
      await flushPromises();
      expect(notes()).toHaveLength(180);
      expect(shownText()).toBe('All 180 shown');
      expect(page.find('[data-testid="patch-notes-foot"]').text()).toBe('All 180 shown');
      expect(mockApi.getBuildTransitions).toHaveBeenCalledTimes(3);
      expect(page.find('[data-testid="patch-notes-more"]').exists()).toBe(false);
      expect(page.find('[data-testid="patch-notes-more-below"]').exists()).toBe(false);
    });

    it('offers nothing more when the first lines are all there are', async () => {
      mockApi.getBuildTransitions.mockImplementation(transitionsRoute(manyTransitions(40)));
      const page = await mountPage(router, pinia);

      expect(page.find('[data-testid="patch-notes-shown"]').text()).toBe('3 of 40');
      await page.find('[data-testid="patch-notes-more"]').trigger('click');

      expect(page.findAll('[data-testid="patch-note"]')).toHaveLength(40);
      expect(page.find('[data-testid="patch-notes-more"]').exists()).toBe(false);
      expect(mockApi.getBuildTransitions).toHaveBeenCalledTimes(1);
    });

    it('starts over from the first lines when the filters change', async () => {
      mockApi.getBuildTransitions.mockImplementation(transitionsRoute(manyTransitions(180)));
      const page = await mountPage(router, pinia);
      await page.find('[data-testid="patch-notes-more"]').trigger('click');
      await page.find('[data-testid="patch-notes-more"]').trigger('click');
      await flushPromises();
      expect(page.findAll('[data-testid="patch-note"]')).toHaveLength(140);

      await page.find('[data-testid="change-filter-part"][data-value="stats"]').setValue(true);
      await flushPromises();

      expect(page.findAll('[data-testid="patch-note"]')).toHaveLength(40);
      expect(page.find('[data-testid="patch-notes-more"]').exists()).toBe(true);
    });

    it('keeps the lines on screen when further ones cannot be loaded, and retries', async () => {
      const route = transitionsRoute(manyTransitions(180));
      mockApi.getBuildTransitions.mockImplementation(route);
      const page = await mountPage(router, pinia);
      await page.find('[data-testid="patch-notes-more"]').trigger('click');

      mockApi.getBuildTransitions.mockRejectedValueOnce(new Error('transitions unavailable'));
      await page.find('[data-testid="patch-notes-more"]').trigger('click');
      await flushPromises();

      expect(page.findAll('[data-testid="patch-note"]')).toHaveLength(40);
      expect(page.find('[data-testid="patch-notes-more-error"]').exists()).toBe(true);

      await page.find('[data-testid="patch-notes-more-below"]').trigger('click');
      await flushPromises();
      expect(page.findAll('[data-testid="patch-note"]')).toHaveLength(140);
      expect(page.find('[data-testid="patch-notes-more-error"]').exists()).toBe(false);
    });

    it('goes on past the 500 lines of one answer until every line is shown', async () => {
      mockApi.getBuildTransitions.mockImplementation(transitionsRoute(manyTransitions(620)));
      const page = await mountPage(router, pinia);
      expect(page.find('[data-testid="patch-notes-shown"]').text()).toBe('3 shown, 617 more');

      const more = () => page.find('[data-testid="patch-notes-more"]');
      let clicks = 0;
      while (more().exists()) {
        await more().trigger('click');
        await flushPromises();
        clicks += 1;
      }
      // Each step brings as many lines again as are on screen: few steps for a long list.
      expect(clicks).toBe(5);

      const notes = page.findAll('[data-testid="patch-note"]');
      expect(notes).toHaveLength(620);
      // No line twice, none skipped: the steps join up.
      expect(new Set(notes.map((note) => note.text())).size).toBe(620);
      expect(last(notes)!.text()).toContain('AttackRange added: 620');
      expect(page.find('[data-testid="patch-notes-shown"]').text()).toBe('All 620 shown');
      expect(page.find('[data-testid="patch-notes-more"]').exists()).toBe(false);
    });

    it('stops offering more when a step comes back empty', async () => {
      // The store was imported anew meanwhile: the count of the first answer no longer holds.
      const route = transitionsRoute(manyTransitions(40));
      mockApi.getBuildTransitions.mockImplementation(async (query) => ({
        ...(await route(query)),
        total: 90,
      }));
      const page = await mountPage(router, pinia);
      await page.find('[data-testid="patch-notes-more"]').trigger('click');
      expect(page.find('[data-testid="patch-notes-shown"]').text()).toBe('40 shown, 50 more');

      await page.find('[data-testid="patch-notes-more"]').trigger('click');
      await flushPromises();

      expect(page.find('[data-testid="patch-notes-shown"]').text()).toBe('All 40 shown');
      expect(page.find('[data-testid="patch-notes-more"]').exists()).toBe(false);
    });

    it('counts what is on screen and accounts for the lines it leaves out', async () => {
      const all = manyTransitions(60);
      all[10] = { ...last(TRANSITIONS_1460.transitions)!, items: all[10].items };
      mockApi.getBuildTransitions.mockImplementation(transitionsRoute(all));
      const page = await mountPage(router, pinia);
      const shownText = () => page.find('[data-testid="patch-notes-shown"]').text();

      // 60 lines by the route's count; one of the first 40 only moves an AND.
      expect(shownText()).toBe('3 shown, 56 more');
      await page.find('[data-testid="patch-notes-more"]').trigger('click');
      expect(page.findAll('[data-testid="patch-note"]')).toHaveLength(39);
      expect(shownText()).toBe('39 shown, 20 more');
      expect(page.find('[data-testid="patch-notes-hidden"]').text()).toContain('1 line that only');

      await page.find('[data-testid="patch-notes-more"]').trigger('click');
      await flushPromises();
      expect(page.findAll('[data-testid="patch-note"]')).toHaveLength(59);
      expect(shownText()).toBe('All 59 shown');
      expect(page.find('[data-testid="patch-notes-hidden"]').text()).toContain('1 line that only');
    });
  });

  describe('links that ask for what is not there', () => {
    it('shows the last page for a page past the end, and corrects the URL in place', async () => {
      mockApi.getBuildChanges.mockImplementation(async (query?: ChangeListQuery) =>
        (query?.page ?? 1) > 531
          ? changeList({ items: [], total: 26516, page: query?.page ?? 1, pages: 531 })
          : changeList({ total: 26516, page: query?.page ?? 1, pages: 531 })
      );
      await router.push('/ao-14-6-0/changes?kind=changed');
      await router.push('/ao-14-6-0/changes?kind=changed&page=99999');
      const page = await mountPage(router, pinia);

      expect(router.currentRoute.value.query).toEqual({ kind: 'changed', page: '531' });
      expect(listQuery()).toMatchObject({ page: 531, kind: ['changed'] });
      const count = page.find('[data-testid="changes-count"]').text();
      expect(count).toContain('26,501-26,502 of 26,516 changes');
      expect(count).not.toContain('4,999,901');
      expect(
        page.findAll('[data-testid="changes-list"] > [data-testid="change-row"]')
      ).toHaveLength(2);

      // The correction replaced the bad link: Back leaves it behind.
      router.back();
      await flushPromises();
      expect(router.currentRoute.value.query).toEqual({ kind: 'changed' });
    });

    it('shows the first page when a filter leaves nothing and the link names a later page', async () => {
      mockApi.getBuildChanges.mockImplementation(async (query?: ChangeListQuery) =>
        changeList({ items: [], total: 0, page: query?.page ?? 1, pages: 1 })
      );
      await router.push('/ao-14-6-0/changes?q=nothing&page=7');
      const page = await mountPage(router, pinia);

      expect(router.currentRoute.value.query).toEqual({ q: 'nothing' });
      expect(page.find('[data-testid="changes-empty"]').exists()).toBe(true);
      expect(page.find('[data-testid="changes-count"]').text()).toContain('No changes listed');
    });

    it('says plainly that a base is not a build, without an order of builds or a retry', async () => {
      await router.push('/ao-14-6-0/compare/nonsense');
      mockApi.compareBuilds.mockRejectedValue({
        type: 'info',
        title: 'Not Found',
        message: "Unknown game version 'nonsense'",
        action: 'Pick another version',
        recoverable: true,
        status: 404,
      });
      const page = await mountPage(router, pinia);

      expect(page.find('[data-testid="changes-scope"]').text()).toBe(
        '"nonsense" is not a build on record.'
      );
      expect(page.find('[data-testid="compare-older"]').exists()).toBe(false);
      expect(page.text()).not.toContain('(older)');
      const message = page.find('[data-testid="changes-error"]');
      expect(message.text()).toContain('No build named "nonsense"');
      expect(message.text()).toContain('Pick a build to compare AO 14.6.0 with');
      expect(page.find('[data-testid="changes-retry"]').exists()).toBe(false);
      // The picker is still there to choose a real one.
      expect(page.find('[data-testid="compare-base-picker"]').exists()).toBe(true);
    });

    it('keeps the retry for a comparison that failed for another reason', async () => {
      await router.push('/ao-14-6-0/compare/ao-14-2-2');
      mockApi.compareBuilds.mockRejectedValueOnce({
        type: 'error',
        title: 'Network Error',
        message: 'Unable to connect to the server',
        action: 'Check your internet connection and try again',
        recoverable: true,
      });
      const page = await mountPage(router, pinia);

      expect(page.find('[data-testid="changes-error"]').text()).toContain(
        'Unable to connect to the server'
      );
      expect(page.find('[data-testid="compare-older"]').text()).toBe('AO 14.2.2');

      await page.find('[data-testid="changes-retry"]').trigger('click');
      await flushPromises();
      expect(page.findAll('[data-testid="change-row"]')).toHaveLength(2);
    });

    it('says that a build cannot be compared with itself', async () => {
      await router.push('/ao-14-6-0/compare/ao-14-6-0');
      const page = await mountPage(router, pinia);

      const scope = page.find('[data-testid="changes-scope"]').text();
      expect(scope).toBe('AO 14.6.0 cannot be compared with itself.');
      expect(scope).not.toContain('the build before it');
    });

    it('drops a patch note filter on a comparison, which has no patch notes', async () => {
      await router.push(
        '/ao-14-6-0/compare/ao-14-2-2?t=effect:53089:spell_params.Chance&tfrom=60&tto=100&kind=changed'
      );
      const page = await mountPage(router, pinia);

      const [, query] = mockApi.compareBuilds.mock.calls[0];
      expect(query).toEqual({
        page: 1,
        page_size: 50,
        sort: 'name',
        kind: ['changed'],
        relevance: ['gameplay', 'economy'],
      });
      expect(page.find('[data-testid="changes-transition"]').exists()).toBe(false);
    });
  });

  describe('typed filters and narrow screens', () => {
    it('applies a quality level after a pause in typing, as the name filter does', async () => {
      const page = await mountPage(router, pinia);
      vi.useFakeTimers();

      const minimum = page.find('[data-testid="change-filter-minql"]');
      (minimum.element as HTMLInputElement).value = '1';
      await minimum.trigger('input');
      (minimum.element as HTMLInputElement).value = '150';
      await minimum.trigger('input');
      // Mid-typing nothing is asked for, however long the navigation would take.
      await vi.advanceTimersByTimeAsync(200);
      expect(listRequestCount()).toBe(1);
      expect(router.currentRoute.value.query.minql).toBeUndefined();

      await vi.advanceTimersByTimeAsync(350);
      vi.useRealTimers();
      await flushPromises();

      expect(router.currentRoute.value.query.minql).toBe('150');
      expect(listRequestCount()).toBe(2);
      expect(listQuery().min_ql).toBe(150);
    });

    it('applies both quality levels and clears one that is emptied', async () => {
      await router.push('/ao-14-6-0/changes?minql=100');
      const page = await mountPage(router, pinia);
      vi.useFakeTimers();

      const minimum = page.find('[data-testid="change-filter-minql"]');
      const maximum = page.find('[data-testid="change-filter-maxql"]');
      (minimum.element as HTMLInputElement).value = '';
      await minimum.trigger('input');
      (maximum.element as HTMLInputElement).value = '200';
      await maximum.trigger('input');
      await vi.advanceTimersByTimeAsync(350);
      vi.useRealTimers();
      await flushPromises();

      expect(router.currentRoute.value.query).toEqual({ maxql: '200' });
      expect(listQuery().min_ql).toBeUndefined();
      expect(listQuery().max_ql).toBe(200);
    });

    it('typing a quality level adds no step of history of its own', async () => {
      const page = await mountPage(router, pinia);
      await page.find('[data-testid="changes-sort"]').setValue('ql');
      await flushPromises();

      await page.find('[data-testid="change-filter-minql"]').setValue('150');
      await flushPromises();
      expect(router.currentRoute.value.query).toEqual({ sort: 'ql', minql: '150' });

      router.back();
      await flushPromises();
      expect(router.currentRoute.value.query).toEqual({});
    });

    it('leads from the open filters to the list with the number of results', async () => {
      const page = await mountPage(router, pinia);
      const toggle = page.find('[data-testid="changes-filters-toggle"]');

      // Closed: the list is one tap away, with what it holds.
      expect(page.find('[data-testid="changes-jump"]').text()).toContain('7,781 changes');
      expect(page.find('[data-testid="changes-show-results"]').exists()).toBe(false);

      await toggle.trigger('click');
      expect(toggle.attributes('aria-expanded')).toBe('true');
      await page.find('[data-testid="change-filter-kind"][data-value="added"]').setValue(true);
      await flushPromises();
      // Ticking a filter keeps the panel open, with the way out in reach.
      expect(toggle.attributes('aria-expanded')).toBe('true');
      const show = page.find('[data-testid="changes-show-results"]');
      expect(show.text()).toBe('Show 7,781 changes');

      await show.trigger('click');
      await flushPromises();
      expect(toggle.attributes('aria-expanded')).toBe('false');
      expect(page.find('[data-testid="changes-show-results"]').exists()).toBe(false);
      expect(page.find('[data-testid="change-filters"]').classes()).toContain('hidden');
    });
  });

  describe('badges and values of a row', () => {
    it('shows one Text chip for a text change that matters as text', async () => {
      mockApi.getBuildChanges.mockResolvedValue(
        changeList({
          items: [
            changeRow({ parts: ['text'], relevance: ['text'] }),
            changeRow({ aoid: 88806, parts: ['text', 'stats'], relevance: ['gameplay', 'text'] }),
            changeRow({ aoid: 88807, parts: ['stats'], relevance: ['gameplay', 'cosmetic'] }),
          ],
          total: 3,
        })
      );
      const page = await mountPage(router, pinia);

      const chips = page
        .findAll('[data-testid="changes-list"] > [data-testid="change-row"]')
        .map((row) =>
          row
            .findAll('[data-testid="change-part"], [data-testid="change-relevance"]')
            .map((chip) => chip.text())
        );
      expect(chips).toEqual([
        ['Text'],
        ['Text', 'Stats', 'Gameplay'],
        ['Stats', 'Gameplay', 'Cosmetic'],
      ]);
    });

    it('words times, classes and schools as the item page does', async () => {
      await router.push('/ao-14-6-0/changes?diffs=1');
      const plain = { bits_set: null, bits_cleared: null };
      const diff: ItemDiff = {
        ...emptyDiff(),
        stats: [
          { stat: 8, change: 'changed', old: 90000, new: 1440000, ...plain },
          { stat: 210, change: 'changed', old: 950, new: 650, ...plain },
          { stat: 294, change: 'changed', old: 600, new: 100, ...plain },
          { stat: 76, change: 'changed', old: 2, new: 4, ...plain },
          { stat: 405, change: 'changed', old: 4, new: 1, ...plain },
          { stat: 298, change: 'added', old: null, new: 0, bits_set: [], bits_cleared: [] },
        ],
      };
      mockApi.getBuildChanges.mockResolvedValue(
        changeList({ items: [{ ...ROW_GRAFT, diff }], total: 1 })
      );
      const page = await mountPage(router, pinia);
      const stat = (id: number) => page.find(`[data-testid="diff-stat"][data-stat="${id}"]`);

      expect(stat(8).find('del').text()).toBe('15.00m');
      expect(stat(8).find('ins').text()).toBe('4.00h');
      expect(stat(8).text()).toContain('(+3.75h)');
      expect(stat(8).text()).not.toContain('90000');
      expect(stat(210).text()).toContain('9.50s');
      expect(stat(210).text()).toContain('6.50s');
      expect(stat(210).text()).toContain('(−3.00s)');
      expect(stat(294).text()).toContain('6.00s');
      expect(stat(294).text()).toContain('1.00s');
      expect(stat(76).find('del').text()).toBe('Armor');
      expect(stat(76).find('ins').text()).not.toBe('4');
      expect(stat(405).find('del').text()).not.toBe('4');
      expect(stat(405).text()).not.toContain('(−3)');
      // A flag stat written out with nothing in it says so, not "no flags set" alone.
      expect(stat(298).text()).toContain('added, with none set');
      expect(stat(298).text()).not.toContain('no flags set');
    });

    it('notes on a nano strain entry that the diff shows the raw client value', async () => {
      await router.push('/ao-14-6-0/changes?diffs=1');
      const plain = { bits_set: null, bits_cleared: null };
      const diff: ItemDiff = {
        ...emptyDiff(),
        stats: [
          { stat: 75, change: 'added', old: null, new: 256, ...plain },
          { stat: 1003, change: 'changed', old: 1, new: 2, ...plain },
          { stat: 74, change: 'changed', old: 2, new: 7, ...plain },
        ],
      };
      mockApi.getBuildChanges.mockResolvedValue(
        changeList({ items: [{ ...ROW_GRAFT, diff }], total: 1 })
      );
      const page = await mountPage(router, pinia);

      const notes = page.findAll('[data-testid="diff-raw-note"]');
      expect(notes.map((note) => note.attributes('data-stat'))).toEqual(['75', '1003']);
      expect(notes[0].text()).toContain("game client's raw value");
      expect(notes[0].text()).toContain('item page shows the curated strain');
      // Local to those entries: no other stat carries it.
      expect(
        page
          .find('[data-testid="diff-stat"][data-stat="74"] [data-testid="diff-raw-note"]')
          .exists()
      ).toBe(false);
    });

    it('folds unchanged conditions only when more than three stay and something changed', async () => {
      await router.push('/ao-14-6-0/changes?diffs=1');
      const same = (index: number) => {
        const criterion = { value1: 100 + index, value2: 200, operator: 2 };
        return { op: 'same' as const, old: criterion, new: criterion };
      };
      const changed = {
        op: 'changed' as const,
        old: { value1: 54, value2: 99, operator: 2 },
        new: { value1: 54, value2: 149, operator: 2 },
      };
      const action = (id: number, criteria: ItemDiff['actions'][number]['criteria']) => ({
        action: id,
        change: 'changed' as const,
        criteria,
      });
      const diff: ItemDiff = {
        ...emptyDiff(),
        actions: [
          action(3, [same(0), same(1), same(2), changed]),
          action(6, [same(0), same(1), same(2), same(3), changed]),
          action(8, [same(0), same(1), same(2), same(3), same(4)]),
        ],
      };
      mockApi.getBuildChanges.mockResolvedValue(
        changeList({ items: [{ ...ROW_GRAFT, diff }], total: 1 })
      );
      const page = await mountPage(router, pinia);
      const list = (id: number) =>
        page.find(`[data-testid="diff-action"][data-action="${id}"] [data-testid="diff-criteria"]`);

      // Three unchanged: all listed, nothing to unfold.
      expect(list(3).findAll('[data-testid="diff-criterion"]')).toHaveLength(4);
      expect(list(3).find('[data-testid="diff-criteria-unchanged"]').exists()).toBe(false);
      // Four unchanged beside a change: folded to the change.
      expect(list(6).findAll('[data-testid="diff-criterion"]')).toHaveLength(1);
      expect(list(6).find('[data-testid="diff-criteria-unchanged"]').text()).toBe(
        'Show 4 unchanged'
      );
      // Nothing changed: folding would leave an empty list, so all five stay.
      expect(list(8).findAll('[data-testid="diff-criterion"]')).toHaveLength(5);
      expect(list(8).find('[data-testid="diff-criteria-unchanged"]').exists()).toBe(false);
    });
  });
});

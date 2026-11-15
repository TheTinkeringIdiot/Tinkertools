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
import type { ChangeListQuery, ChangeListResponse } from '@/types/changes';
import {
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
  ROW_GRAFT,
  ROW_REMOVED,
  TRANSITIONS_1460,
  changeList,
  changeRow,
  compareList,
  compareResult,
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
      expect(notes[0]).toContain('AttackRange added: 20');
      expect(notes[0]).toContain('on 2,464 items');
      expect(notes[2]).toContain('…% chance to cast …: Chance 60% → 100%');
      expect(notes[2]).toContain('on 760 items');
      // A line that only moves an AND is left out; the requirement it joins is the note.
      expect(notes).toHaveLength(8);
      expect(notes.some((note) => note.includes('requirement added: AND'))).toBe(false);
    });

    it('leads from a patch note to the items it was done to', async () => {
      await router.push('/ao-14-6-0/changes?kind=added&sort=ql');
      const page = await mountPage(router, pinia);

      const effectNote = page
        .findAll('[data-testid="patch-note"]')
        .find((note) => note.text().includes('chance to cast'));
      await effectNote!.find('[data-testid="patch-note-filter"]').trigger('click');
      await flushPromises();

      // The other filters give way; the sort stays.
      expect(router.currentRoute.value.query).toEqual({
        relevance: 'all',
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
        notes: 'expand',
      });

      const banner = page.find('[data-testid="changes-transition"]');
      expect(banner.text()).toContain('…% chance to cast …: Chance 60% → 100%');
      // The notes are not collapsed away from a transition's items.
      expect(page.find('[data-testid="build-notes"]').exists()).toBe(false);

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
      expect(page.find('[data-testid="changes-scope"]').text()).toContain(
        'Net difference between AO 14.2.2 and AO 14.6.0'
      );
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

    it('changes the base, compares across the fork, and returns to the own changes', async () => {
      await setCurrentVersion('ao-17-10-5');
      await router.push('/ao-17-10-5/compare/ao-14-6-0');
      mockApi.compareBuilds.mockImplementation(async (base: string) =>
        compareList({ build: BUILD_17105, base: base === 'prk-0-7-1' ? BUILD_PRK : BUILD_1460 })
      );
      const page = await mountPage(router, pinia);

      await page.find('[data-testid="compare-base-picker"]').setValue('prk-0-7-1');
      await flushPromises();

      expect(router.currentRoute.value.fullPath).toBe('/ao-17-10-5/compare/prk-0-7-1');
      const [base, , options] = last(mockApi.compareBuilds.mock.calls)!;
      expect(base).toBe('prk-0-7-1');
      expect(options).toMatchObject({ gameVersion: 'ao-17-10-5' });
      expect(page.find('[data-testid="changes-scope"]').text()).toContain(
        'Net difference between Project Rubi-Ka 0.7.1 and AO 17.10.5'
      );

      await page.find('[data-testid="compare-exit"]').trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.fullPath).toBe('/ao-17-10-5/changes');
      expect(mockApi.getBuildChanges).toHaveBeenCalledTimes(1);
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
});

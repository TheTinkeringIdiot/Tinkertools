/**
 * Item "changed" badge Integration Tests
 *
 * After a results page loads, TinkerItems asks the backend once which of those
 * AOIDs later builds changed, and badges only those rows, in words: "Changed
 * in 2 builds". The number is the count of "changed" steps on the item's
 * timeline, not the timeline's length (which counts the first appearance).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/services/api-client');

const mockToast = { add: vi.fn(), remove: vi.fn(), removeGroup: vi.fn(), removeAllGroups: vi.fn() };
vi.mock('primevue/usetoast', () => ({ useToast: () => mockToast }));

import {
  setupIntegrationTest,
  mountForIntegration,
  waitForUpdates,
  type IntegrationTestContext,
} from '../helpers/integration-test-utils';
import { createWeaponItem } from '../helpers/item-fixtures';
import TinkerItems from '@/views/TinkerItems.vue';
import AdvancedItemSearch from '@/components/items/AdvancedItemSearch.vue';
import ItemList from '@/components/items/ItemList.vue';
import { changedBuildCount, type ItemRevisionBatchEntry } from '@/types/game-version';
import type { Item } from '@/types/api';

function revision(
  aoid: number,
  counts: { revision_count: number; change_count?: number }
): ItemRevisionBatchEntry {
  return { aoid, latest_change_slug: 'ao-2024-02', present_in_current: true, ...counts };
}

describe('TinkerItems changed badge', () => {
  let context: IntegrationTestContext;
  let items: Item[];

  beforeEach(async () => {
    context = await setupIntegrationTest();

    items = [
      createWeaponItem({ aoid: 1001, name: 'Changed Rifle', ql: 100 }),
      createWeaponItem({ aoid: 1002, name: 'Stable Rifle', ql: 100 }),
      createWeaponItem({ aoid: 1003, name: 'Tweaked Rifle', ql: 100 }),
      createWeaponItem({ aoid: 1004, name: 'Returned Rifle', ql: 100 }),
    ];

    context.mockApi.searchItems.mockResolvedValue({
      items,
      total: items.length,
      page: 1,
      page_size: 24,
      pages: 1,
      has_next: false,
      has_prev: false,
    });

    // As POST /items/revisions/batch answers: the timeline's length and its "changed" steps.
    context.mockApi.batchItemRevisions.mockResolvedValue({
      items: {
        1001: revision(1001, { revision_count: 3, change_count: 2 }),
        1002: revision(1002, { revision_count: 1, change_count: 0 }),
        1003: revision(1003, { revision_count: 2, change_count: 1 }),
        // Added, removed, added again: three steps, none of them a change.
        1004: revision(1004, { revision_count: 3, change_count: 0 }),
      },
    });
  });

  async function search(wrapper: ReturnType<typeof mountForIntegration>) {
    const searchInput = wrapper
      .findComponent(AdvancedItemSearch)
      .find('input[placeholder="Search for items..."]');
    await searchInput.setValue('rifle');
    await searchInput.trigger('keydown.enter');
    await waitForUpdates(wrapper, 100);
  }

  function badgeTexts(wrapper: ReturnType<typeof mountForIntegration>): Record<string, string> {
    return Object.fromEntries(
      wrapper
        .findAll('[data-testid="item-revision-badge"]')
        .map((badge) => [badge.attributes('data-aoid'), badge.text()])
    );
  }

  it('badges only the rows a later build changed, in words, with the number of changes', async () => {
    const wrapper = mountForIntegration(TinkerItems, { pinia: context.pinia });
    await waitForUpdates(wrapper);

    await search(wrapper);

    expect(context.mockApi.batchItemRevisions).toHaveBeenCalledTimes(1);
    expect(context.mockApi.batchItemRevisions).toHaveBeenCalledWith([1001, 1002, 1003, 1004]);

    expect(badgeTexts(wrapper)).toEqual({
      '1001': 'Changed in 2 builds',
      '1003': 'Changed in 1 build',
    });
  });

  it('counts the builds after the first appearance when the backend sends no change count', async () => {
    context.mockApi.batchItemRevisions.mockResolvedValue({
      items: {
        1001: revision(1001, { revision_count: 3 }),
        1002: revision(1002, { revision_count: 1 }),
        1003: revision(1003, { revision_count: 2 }),
        1004: revision(1004, { revision_count: 0 }),
      },
    });
    const wrapper = mountForIntegration(TinkerItems, { pinia: context.pinia });
    await waitForUpdates(wrapper);

    await search(wrapper);

    expect(badgeTexts(wrapper)).toEqual({
      '1001': 'Changed in 2 builds',
      '1003': 'Changed in 1 build',
    });
  });

  it('still shows results when the revisions batch fails', async () => {
    context.mockApi.batchItemRevisions.mockRejectedValue(new Error('offline'));

    const wrapper = mountForIntegration(TinkerItems, { pinia: context.pinia });
    await waitForUpdates(wrapper);

    await search(wrapper);

    expect(wrapper.findAll('[data-testid="item-revision-badge"]')).toHaveLength(0);
    expect(wrapper.text()).toContain('Changed Rifle');
  });

  describe.each(['list', 'grid'] as const)('%s layout', (viewMode) => {
    it('shows the badge as visible text on the changed rows only', async () => {
      const wrapper = mountForIntegration(ItemList, {
        pinia: context.pinia,
        props: {
          items,
          viewMode,
          changeCounts: { 1001: 2, 1002: 0, 1003: 1 },
        },
      });
      await waitForUpdates(wrapper);

      expect(badgeTexts(wrapper)).toEqual({
        '1001': 'Changed in 2 builds',
        '1003': 'Changed in 1 build',
      });
      const badge = wrapper.find('[data-testid="item-revision-badge"][data-aoid="1001"]');
      expect(badge.attributes('title')).toContain('since it first appeared');
    });

    it('shows no badge without counts', async () => {
      const wrapper = mountForIntegration(ItemList, {
        pinia: context.pinia,
        props: { items, viewMode },
      });
      await waitForUpdates(wrapper);

      expect(wrapper.findAll('[data-testid="item-revision-badge"]')).toHaveLength(0);
    });
  });

  it('never counts below zero', () => {
    expect(changedBuildCount(revision(1, { revision_count: 0 }))).toBe(0);
    expect(changedBuildCount(revision(1, { revision_count: 5, change_count: 0 }))).toBe(0);
    expect(changedBuildCount(revision(1, { revision_count: 5, change_count: 4 }))).toBe(4);
  });
});

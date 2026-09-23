/**
 * Item Revision Badge Integration Tests
 *
 * After a results page loads, TinkerItems asks the backend once which of those
 * AOIDs changed across snapshots and badges the rows that did.
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
import type { Item } from '@/types/api';

describe('TinkerItems revision badge', () => {
  let context: IntegrationTestContext;
  let items: Item[];

  beforeEach(async () => {
    context = await setupIntegrationTest();

    items = [
      createWeaponItem({ aoid: 1001, name: 'Changed Rifle', ql: 100 }),
      createWeaponItem({ aoid: 1002, name: 'Stable Rifle', ql: 100 }),
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

    context.mockApi.batchItemRevisions.mockResolvedValue({
      items: {
        1001: {
          aoid: 1001,
          revision_count: 3,
          latest_change_slug: 'ao-2024-02',
          present_in_current: true,
        },
        1002: { aoid: 1002, revision_count: 1, latest_change_slug: null, present_in_current: true },
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

  it('badges only the rows that changed across snapshots', async () => {
    const wrapper = mountForIntegration(TinkerItems, { pinia: context.pinia });
    await waitForUpdates(wrapper);

    await search(wrapper);

    expect(context.mockApi.batchItemRevisions).toHaveBeenCalledTimes(1);
    expect(context.mockApi.batchItemRevisions).toHaveBeenCalledWith([1001, 1002]);

    const badges = wrapper.findAll('[data-testid="item-revision-badge"]');
    expect(badges).toHaveLength(1);
    expect(badges[0].attributes('data-aoid')).toBe('1001');
    expect(badges[0].text()).toContain('3');
    expect(badges[0].attributes('title')).toBe('Changed in 3 snapshots');
  });

  it('still shows results when the revisions batch fails', async () => {
    context.mockApi.batchItemRevisions.mockRejectedValue(new Error('offline'));

    const wrapper = mountForIntegration(TinkerItems, { pinia: context.pinia });
    await waitForUpdates(wrapper);

    await search(wrapper);

    expect(wrapper.findAll('[data-testid="item-revision-badge"]')).toHaveLength(0);
    expect(wrapper.text()).toContain('Changed Rifle');
  });
});

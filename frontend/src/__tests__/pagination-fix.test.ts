/**
 * Pagination Fix Tests
 *
 * The backend pages by page number; the UI pages by record offset. These tests
 * cover both halves of that conversion: the items store turning a paginated
 * search response into PaginationInfo, and ItemList showing that offset and
 * turning paginator clicks back into page numbers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// CRITICAL: Mock API BEFORE store imports
vi.mock('@/services/api-client');

import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { apiClient } from '@/services/api-client';
import { useItemsStore } from '@/stores/items';
import ItemList from '@/components/items/ItemList.vue';
import type { Item, PaginatedResponse, PaginationInfo } from '@/types/api';
import { createTestItem } from './helpers/item-fixtures';
import { appGlobals } from './helpers/app-globals';

const mockApi = vi.mocked(apiClient, true);

// Child components that are not under test
vi.mock('@/components/items/ItemCard.vue', () => ({
  default: {
    name: 'ItemCard',
    template: '<div class="item-card">{{ item.name }}</div>',
    props: ['item', 'profile', 'showCompatibility', 'isFavorite', 'isComparing'],
  },
}));

vi.mock('@/components/items/ItemQuickView.vue', () => ({
  default: {
    name: 'ItemQuickView',
    template: '<div class="item-quick-view">{{ item.name }}</div>',
    props: ['item', 'profile', 'showCompatibility'],
  },
}));

function makeItems(count: number, firstId = 1): Item[] {
  return Array.from({ length: count }, (_, i) =>
    createTestItem({ id: firstId + i, aoid: 10000 + firstId + i, name: `Item ${firstId + i}` })
  );
}

function pageResponse(
  page: number,
  pageSize: number,
  total: number,
  items: Item[] = makeItems(1)
): PaginatedResponse<Item> {
  const pages = Math.ceil(total / pageSize);
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

function pagination(page: number, limit: number, total: number): PaginationInfo {
  return {
    page,
    limit,
    offset: (page - 1) * limit,
    total,
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}

let pinia: Pinia;

beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
});

describe('Items store pagination offset', () => {
  it.each([
    { page: 1, pageSize: 24, offset: 0 },
    { page: 2, pageSize: 24, offset: 24 },
    { page: 3, pageSize: 24, offset: 48 },
    { page: 2, pageSize: 12, offset: 12 },
    { page: 3, pageSize: 10, offset: 20 },
  ])(
    'page $page of size $pageSize starts at offset $offset',
    async ({ page, pageSize, offset }) => {
      mockApi.searchItems.mockResolvedValue(pageResponse(page, pageSize, 100));
      const store = useItemsStore();

      await store.searchItems({ search: 'test', page, limit: pageSize });

      expect(store.currentPagination).toEqual({
        page,
        limit: pageSize,
        offset,
        total: 100,
        hasNext: page < Math.ceil(100 / pageSize),
        hasPrev: page > 1,
      });
    }
  );
});

describe('ItemList pagination', () => {
  let wrapper: VueWrapper | undefined;

  function mountList(props: { items: Item[]; pagination?: PaginationInfo }) {
    wrapper = mount(ItemList, {
      props: { viewMode: 'grid', ...props },
      global: appGlobals(pinia),
    });
    return wrapper;
  }

  function paginatorFirst(w: VueWrapper): unknown {
    return w.findComponent({ name: 'Paginator' }).props('first');
  }

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('opens the paginator at the offset of the current page', () => {
    const w = mountList({ items: makeItems(24, 25), pagination: pagination(2, 24, 100) });

    expect(paginatorFirst(w)).toBe(24);
  });

  it('follows new pagination as results for other pages arrive', async () => {
    const w = mountList({ items: makeItems(24), pagination: pagination(1, 24, 100) });
    expect(paginatorFirst(w)).toBe(0);

    for (const page of [2, 3, 1, 4]) {
      await w.setProps({ pagination: pagination(page, 24, 100) });
      expect(paginatorFirst(w)).toBe((page - 1) * 24);
    }
  });

  it('shows the range of items on the current page', () => {
    const w = mountList({ items: makeItems(24, 25), pagination: pagination(2, 24, 100) });

    expect(w.text()).toContain('Showing 25-48 of 100 items');
  });

  it('requests page 2 when the user moves to the next page', async () => {
    const w = mountList({ items: makeItems(24), pagination: pagination(1, 24, 100) });

    await w.find('button[aria-label="Next Page"]').trigger('click');

    expect(w.emitted('page-change')).toEqual([[2, 24]]);
  });

  it('converts offsets to page numbers for smaller page sizes', async () => {
    const w = mountList({ items: makeItems(12), pagination: pagination(1, 12, 60) });

    const next = w.find('button[aria-label="Next Page"]');
    await next.trigger('click');
    await next.trigger('click');
    await w.find('button[aria-label="Last Page"]').trigger('click');

    expect(w.emitted('page-change')).toEqual([
      [2, 12],
      [3, 12],
      [5, 12],
    ]);
  });
});

describe('Search to list pagination workflow', () => {
  it('keeps the list in step with each page the store fetches', async () => {
    const store = useItemsStore();
    const w = mount(ItemList, {
      props: { viewMode: 'grid', items: [] as Item[] },
      global: appGlobals(pinia),
    });

    for (const page of [1, 2]) {
      mockApi.searchItems.mockResolvedValue(
        pageResponse(page, 24, 100, makeItems(24, (page - 1) * 24 + 1))
      );
      await store.searchItems({ search: 'test', page, limit: 24 });
      await w.setProps({
        items: store.currentSearchResults,
        pagination: store.currentPagination,
      });

      const first = (page - 1) * 24;
      expect(w.findComponent({ name: 'Paginator' }).props('first')).toBe(first);
      expect(w.text()).toContain(`Showing ${first + 1}-${first + 24} of 100 items`);
    }

    w.unmount();
  });
});

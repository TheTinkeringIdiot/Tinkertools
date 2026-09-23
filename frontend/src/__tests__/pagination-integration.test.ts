/**
 * Pagination Integration Tests
 *
 * TRUE INTEGRATION TEST - Requires real backend
 * Pages through real search results with the real items store and API client,
 * and checks the offsets the UI pages by are derived correctly end-to-end.
 *
 * Skipped when the backend is not available.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useItemsStore } from '../stores/items';
import type { ItemSearchQuery, PaginationInfo } from '../types/api';
import { isBackendAvailable } from './helpers/backend-check';

// Top-level await: describe.skipIf reads this while tests are collected.
const BACKEND_AVAILABLE = await isBackendAvailable();

async function searchPage(query: ItemSearchQuery) {
  const store = useItemsStore();
  const items = await store.searchItems(query, true);
  const pagination: PaginationInfo | undefined = store.currentPagination;
  if (!pagination) throw new Error('search did not record pagination');
  return { items, pagination };
}

describe.skipIf(!BACKEND_AVAILABLE)('Pagination Integration Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe('Search pagination offsets', () => {
    it.each([
      { search: 'weapon', page: 1, limit: 6, offset: 0 },
      { search: 'weapon', page: 2, limit: 6, offset: 6 },
      { search: 'weapon', page: 3, limit: 6, offset: 12 },
      { search: 'implant', page: 2, limit: 10, offset: 10 },
    ])(
      'page $page of "$search" by $limit starts at offset $offset',
      async ({ search, page, limit, offset }) => {
        const { pagination } = await searchPage({ search, page, limit });

        expect(pagination.page).toBe(page);
        expect(pagination.limit).toBe(limit);
        expect(pagination.offset).toBe(offset);
      }
    );

    it('pages filter-only queries the same way', async () => {
      const { pagination } = await searchPage({ item_class: [1], page: 2, limit: 8 });

      expect(pagination.page).toBe(2);
      expect(pagination.limit).toBe(8);
      expect(pagination.offset).toBe(8);
    });
  });

  describe('Multi-page sequence', () => {
    it('returns consecutive, non-overlapping pages', async () => {
      const pageIds: number[][] = [];

      for (const page of [1, 2, 3]) {
        const { items, pagination } = await searchPage({ search: 'nano', page, limit: 5 });

        expect(pagination.page).toBe(page);
        expect(pagination.limit).toBe(5);
        expect(pagination.offset).toBe((page - 1) * 5);
        pageIds.push(items.map((item) => item.id));
      }

      expect(pageIds[0].some((id) => pageIds[1].includes(id))).toBe(false);
      expect(pageIds[1].some((id) => pageIds[2].includes(id))).toBe(false);
    });

    it('reports complete pagination metadata for the first page', async () => {
      const { pagination } = await searchPage({ search: 'armor', page: 1, limit: 12 });

      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(12);
      expect(pagination.offset).toBe(0);
      expect(pagination.total).toBeGreaterThan(0);
      expect(pagination.hasPrev).toBe(false);
      expect(pagination.hasNext).toBe(pagination.total > 12);
    });
  });

  describe('Edge cases', () => {
    it('reaches a later page when there are enough results', async () => {
      const first = await searchPage({ search: 'item', page: 1, limit: 10 });
      expect(first.pagination.total).toBeGreaterThan(30);

      const { pagination } = await searchPage({ search: 'item', page: 4, limit: 10 });

      expect(pagination.page).toBe(4);
      expect(pagination.offset).toBe(30);
      expect(pagination.hasPrev).toBe(true);
    });

    it.each([
      { page: 1, limit: 24, offset: 0 },
      { page: 2, limit: 24, offset: 24 },
      { page: 3, limit: 12, offset: 24 },
      { page: 5, limit: 10, offset: 40 },
      { page: 1, limit: 50, offset: 0 },
    ])('page $page by $limit starts at offset $offset', async ({ page, limit, offset }) => {
      const { pagination } = await searchPage({ search: 'test', page, limit });

      expect(pagination.page).toBe(page);
      expect(pagination.limit).toBe(limit);
      expect(pagination.offset).toBe(offset);
    });
  });
});

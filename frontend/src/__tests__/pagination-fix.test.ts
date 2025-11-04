/**
 * Pagination Fix Tests
 *
 * Comprehensive tests for the pagination offset fix
 * Tests both API client pagination response transformation and ItemList component pagination behavior
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia } from 'pinia';
import axios from 'axios';
import { apiClient } from '../services/api-client';
import ItemList from '../components/items/ItemList.vue';
import type { Item, PaginationInfo, ItemSearchQuery } from '../types/api';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    })),
  },
}));
const mockedAxios = vi.mocked(axios);

// Mock PrimeVue components for ItemList tests
vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click'],
  },
}));

vi.mock('primevue/paginator', () => ({
  default: {
    name: 'Paginator',
    template: `
      <div class="p-paginator">
        <button @click="$emit('page', { first: 0, rows: 24 })" data-testid="page-1">1</button>
        <button @click="$emit('page', { first: 24, rows: 24 })" data-testid="page-2">2</button>
        <button @click="$emit('page', { first: 48, rows: 24 })" data-testid="page-3">3</button>
      </div>
    `,
    props: [
      'first',
      'rows',
      'totalRecords',
      'rowsPerPageOptions',
      'template',
      'currentPageReportTemplate',
    ],
    emits: ['page'],
    expose: ['first'],
  },
}));

// Mock other components that aren't the focus of these tests
vi.mock('../components/items/ItemCard.vue', () => ({
  default: {
    name: 'ItemCard',
    template: '<div class="item-card">{{ item.name }}</div>',
    props: ['item', 'profile', 'showCompatibility', 'isFavorite', 'isComparing'],
    emits: ['click', 'favorite', 'compare', 'quick-view'],
  },
}));

vi.mock('../components/items/ItemQuickView.vue', () => ({
  default: {
    name: 'ItemQuickView',
    template: '<div class="item-quick-view">{{ item.name }}</div>',
    props: ['item', 'profile', 'showCompatibility'],
    emits: ['close', 'view-full', 'favorite', 'compare'],
  },
}));

vi.mock('primevue/badge', () => ({
  default: { name: 'Badge', template: '<span>{{ value }}</span>', props: ['value'] },
}));

vi.mock('primevue/tag', () => ({
  default: { name: 'Tag', template: '<span>{{ value }}</span>', props: ['value'] },
}));

vi.mock('primevue/contextmenu', () => ({
  default: { name: 'ContextMenu', template: '<div></div>', props: ['model'] },
}));

vi.mock('primevue/dialog', () => ({
  default: { name: 'Dialog', template: '<div v-if="visible"><slot /></div>', props: ['visible'] },
}));

// Mock services
vi.mock('../services/game-utils', () => ({
  getItemIconUrl: () => null,
}));

// This will be the instance returned by axios.create()
let mockAxiosInstance: any;

const mockItem: Item = {
  id: 1,
  aoid: 12345,
  name: 'Test Item',
  ql: 200,
  description: 'Test item',
  item_class: 3,
  is_nano: false,
  stats: [],
  spell_data: [],
  actions: [],
  attack_defense: null,
  animation_mesh: null,
};

describe('Pagination Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Create fresh mock instance
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };

    // Make axios.create return our mock instance
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API Client Offset Calculation', () => {
    it('should calculate correct offset for page 1', async () => {
      const mockBackendResponse = {
        items: [mockItem],
        total: 100,
        page: 1,
        page_size: 24,
        pages: 5,
        has_next: true,
        has_prev: false,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockBackendResponse });

      const query: ItemSearchQuery = {
        search: 'test',
        page: 1,
        limit: 24,
      };

      const result = await apiClient.searchItems(query);

      expect(result.success).toBe(true);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 24,
        offset: 0, // (1 - 1) * 24 = 0
        total: 100,
        hasNext: true,
        hasPrev: false,
      });
    });

    it('should calculate correct offset for page 2', async () => {
      const mockBackendResponse = {
        items: [mockItem],
        total: 100,
        page: 2,
        page_size: 24,
        pages: 5,
        has_next: true,
        has_prev: true,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockBackendResponse });

      const query: ItemSearchQuery = {
        search: 'test',
        page: 2,
        limit: 24,
      };

      const result = await apiClient.searchItems(query);

      expect(result.success).toBe(true);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 24,
        offset: 24, // (2 - 1) * 24 = 24
        total: 100,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should calculate correct offset for page 3', async () => {
      const mockBackendResponse = {
        items: [mockItem],
        total: 100,
        page: 3,
        page_size: 24,
        pages: 5,
        has_next: true,
        has_prev: true,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockBackendResponse });

      const query: ItemSearchQuery = {
        search: 'test',
        page: 3,
        limit: 24,
      };

      const result = await apiClient.searchItems(query);

      expect(result.pagination?.offset).toBe(48); // (3 - 1) * 24 = 48
    });

    it('should handle different page sizes correctly', async () => {
      const mockBackendResponse = {
        items: [mockItem],
        total: 100,
        page: 2,
        page_size: 12,
        pages: 9,
        has_next: true,
        has_prev: true,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockBackendResponse });

      const query: ItemSearchQuery = {
        search: 'test',
        page: 2,
        limit: 12,
      };

      const result = await apiClient.searchItems(query);

      expect(result.pagination?.offset).toBe(12); // (2 - 1) * 12 = 12
    });

    it('should work for filter endpoint as well', async () => {
      const mockBackendResponse = {
        items: [mockItem],
        total: 50,
        page: 3,
        page_size: 10,
        pages: 5,
        has_next: true,
        has_prev: true,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockBackendResponse });

      const query: ItemSearchQuery = {
        item_class: [3],
        page: 3,
        limit: 10,
      };

      const result = await apiClient.searchItems(query);

      expect(result.pagination?.offset).toBe(20); // (3 - 1) * 10 = 20
    });
  });

  describe('ItemList Pagination State Management', () => {
    let wrapper: any;

    afterEach(() => {
      if (wrapper) {
        wrapper.unmount();
      }
    });

    it('should initialize currentOffset from pagination prop', () => {
      const pagination: PaginationInfo = {
        page: 2,
        limit: 24,
        offset: 24,
        total: 100,
        hasNext: true,
        hasPrev: true,
      };

      wrapper = mount(ItemList, {
        props: {
          items: [mockItem],
          viewMode: 'grid',
          pagination,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      // Check that currentOffset is initialized correctly
      expect(wrapper.vm.currentOffset).toBe(24);
    });

    it('should update currentOffset when pagination prop changes', async () => {
      const initialPagination: PaginationInfo = {
        page: 1,
        limit: 24,
        offset: 0,
        total: 100,
        hasNext: true,
        hasPrev: false,
      };

      wrapper = mount(ItemList, {
        props: {
          items: [mockItem],
          viewMode: 'grid',
          pagination: initialPagination,
        },
      });

      expect(wrapper.vm.currentOffset).toBe(0);

      // Update pagination to page 2
      const newPagination: PaginationInfo = {
        page: 2,
        limit: 24,
        offset: 24,
        total: 100,
        hasNext: true,
        hasPrev: true,
      };

      await wrapper.setProps({ pagination: newPagination });
      await nextTick();

      expect(wrapper.vm.currentOffset).toBe(24);
    });

    it('should emit correct page number when paginator events trigger', async () => {
      const pagination: PaginationInfo = {
        page: 1,
        limit: 24,
        offset: 0,
        total: 100,
        hasNext: true,
        hasPrev: false,
      };

      wrapper = mount(ItemList, {
        props: {
          items: [mockItem],
          viewMode: 'grid',
          pagination,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const paginator = wrapper.findComponent({ name: 'Paginator' });

      // Simulate page 2 click (offset 24, rows 24)
      await paginator.vm.$emit('page', { first: 24, rows: 24 });

      const emittedEvents = wrapper.emitted('page-change');
      expect(emittedEvents).toBeTruthy();
      expect(emittedEvents![0]).toEqual([2]); // Should emit page 2
    });

    it('should handle page calculations correctly for different page sizes', async () => {
      const pagination: PaginationInfo = {
        page: 1,
        limit: 12,
        offset: 0,
        total: 60,
        hasNext: true,
        hasPrev: false,
      };

      wrapper = mount(ItemList, {
        props: {
          items: [mockItem],
          viewMode: 'grid',
          pagination,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      const paginator = wrapper.findComponent({ name: 'Paginator' });

      // Simulate page 3 click (offset 24, rows 12)
      await paginator.vm.$emit('page', { first: 24, rows: 12 });

      const emittedEvents = wrapper.emitted('page-change');
      expect(emittedEvents![0]).toEqual([3]); // (24 / 12) + 1 = 3
    });

    it('should update currentOffset reactive to pagination changes', async () => {
      wrapper = mount(ItemList, {
        props: {
          items: [mockItem],
          viewMode: 'grid',
          pagination: {
            page: 1,
            limit: 24,
            offset: 0,
            total: 100,
            hasNext: true,
            hasPrev: false,
          },
        },
        global: {
          plugins: [createPinia()],
        },
      });

      // Sequence of pagination updates to simulate real navigation
      const paginationUpdates = [
        { page: 2, offset: 24 },
        { page: 3, offset: 48 },
        { page: 1, offset: 0 },
        { page: 4, offset: 72 },
      ];

      for (const update of paginationUpdates) {
        await wrapper.setProps({
          pagination: {
            page: update.page,
            limit: 24,
            offset: update.offset,
            total: 100,
            hasNext: update.page < 5,
            hasPrev: update.page > 1,
          },
        });
        await nextTick();

        expect(wrapper.vm.currentOffset).toBe(update.offset);
      }
    });

    it('should display correct pagination info text', () => {
      const pagination: PaginationInfo = {
        page: 2,
        limit: 24,
        offset: 24,
        total: 100,
        hasNext: true,
        hasPrev: true,
      };

      wrapper = mount(ItemList, {
        props: {
          items: Array.from({ length: 24 }, (_, i) => ({ ...mockItem, id: i + 25 })),
          viewMode: 'grid',
          pagination,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      // Component displays: "Showing 25-48 of 100 items" format at line 155-156 in ItemList.vue
      const paginationInfo = wrapper.find('.text-sm');
      expect(paginationInfo.text()).toContain('Showing 25-48 of 100 items');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete pagination workflow', async () => {
      // Test the complete flow: API response -> offset calculation -> component state update

      // 1. Mock API response for page 1
      let mockBackendResponse = {
        items: Array.from({ length: 24 }, (_, i) => ({ ...mockItem, id: i + 1 })),
        total: 100,
        page: 1,
        page_size: 24,
        pages: 5,
        has_next: true,
        has_prev: false,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockBackendResponse });

      // 2. Get page 1 results
      let result = await apiClient.searchItems({ search: 'test', page: 1, limit: 24 });

      expect(result.pagination?.offset).toBe(0);

      // 3. Mount component with page 1 results
      let wrapper = mount(ItemList, {
        props: {
          items: result.data || [],
          viewMode: 'grid',
          pagination: result.pagination,
        },
        global: {
          plugins: [createPinia()],
        },
      });

      expect(wrapper.vm.currentOffset).toBe(0);

      // 4. Mock API response for page 2
      mockBackendResponse = {
        items: Array.from({ length: 24 }, (_, i) => ({ ...mockItem, id: i + 25 })),
        total: 100,
        page: 2,
        page_size: 24,
        pages: 5,
        has_next: true,
        has_prev: true,
      };

      mockAxiosInstance.get.mockResolvedValue({ data: mockBackendResponse });

      // 5. Get page 2 results
      result = await apiClient.searchItems({ search: 'test', page: 2, limit: 24 });

      expect(result.pagination?.offset).toBe(24);

      // 6. Update component props with page 2 results
      await wrapper.setProps({
        items: result.data || [],
        pagination: result.pagination,
      });
      await nextTick();

      expect(wrapper.vm.currentOffset).toBe(24);

      wrapper.unmount();
    });
  });
});

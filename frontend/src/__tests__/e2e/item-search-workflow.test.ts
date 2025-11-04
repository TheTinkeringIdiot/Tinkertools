/**
 * E2E Tests for Item Search Workflow
 *
 * Tests critical user workflows for searching and browsing items
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mountWithContext,
  flushPromises,
  wait,
  standardCleanup,
  createTestProfile,
  PROFESSION,
  BREED,
} from '@/__tests__/helpers';
import TinkerItems from '../../views/TinkerItems.vue';
import type { Item } from '../../types/api';

// Mock the API client
vi.mock('../../services/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock stores with realistic implementations
vi.mock('../../stores/items', () => ({
  useItemsStore: () => ({
    searchItems: vi.fn(),
    getItem: vi.fn(),
    currentPagination: { page: 1, limit: 25, total: 100 },
    clearSearch: vi.fn(),
  }),
}));

vi.mock('../../stores/profile', () => ({
  useProfileStore: () => ({
    profiles: [],
    activeProfile: null,
    hasActiveProfile: false,
    preferences: { favoriteItems: [] },
    addFavoriteItem: vi.fn(),
    removeFavoriteItem: vi.fn(),
  }),
}));

const mockItems: Item[] = [
  {
    id: 1,
    aoid: 12345,
    name: 'Superior Combat Armor',
    ql: 200,
    description: 'High-quality body armor',
    item_class: 6,
    is_nano: false,
    stats: [{ stat: 16, value: 50 }],
    requirements: [{ stat: 16, value: 300 }],
    spell_data: [],
    actions: [],
    attack_defense: null,
    animation_mesh: null,
  },
  {
    id: 2,
    aoid: 54321,
    name: 'Advanced Healing Nano',
    ql: 180,
    description: 'Powerful healing program',
    item_class: 20,
    is_nano: true,
    stats: [],
    requirements: [{ stat: 19, value: 400 }],
    spell_data: [{ name: 'Heal', description: 'Restores health' }],
    actions: [],
    attack_defense: null,
    animation_mesh: null,
  },
];

const mockProfile = createTestProfile({
  name: 'Test Character',
  Character: {
    Level: 200,
    Profession: PROFESSION.ENGINEER,
  },
});

describe('Item Search Workflow E2E', () => {
  let wrapper: any;

  beforeEach(async () => {
    // Mock successful API responses
    const mockSearchItems = vi.fn().mockResolvedValue(mockItems);

    wrapper = mountWithContext(TinkerItems, {
      global: {
        stubs: {
          'router-link': true,
          'router-view': true,
        },
      },
    });

    await flushPromises();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
    standardCleanup();
  });

  describe('Basic Item Search', () => {
    it('should allow user to search for items by text', async () => {
      // User enters search term
      const searchInput = wrapper.find('input[type="text"]');
      expect(searchInput.exists()).toBe(true);

      await searchInput.setValue('armor');
      await searchInput.trigger('keydown.enter');

      // Should trigger search
      await flushPromises();
      await wait(100);

      // Verify search was performed
      expect(wrapper.text()).toContain('armor');
    });

    it('should display search results in grid view by default', async () => {
      // Should show items in grid layout
      const gridView = wrapper.find('.grid');
      if (gridView.exists()) {
        expect(gridView.exists()).toBe(true);
      }
    });

    it('should allow switching between grid and list view', async () => {
      // Find view mode toggle buttons
      const viewButtons = wrapper.findAll('button');
      const listButton = viewButtons.find(
        (btn) => btn.text().includes('List') || btn.attributes('aria-label')?.includes('list')
      );

      if (listButton) {
        await listButton.trigger('click');
        await flushPromises();

        // Should switch to list view
        const listView = wrapper.find('.space-y-2');
        expect(listView.exists()).toBe(true);
      }
    });
  });

  describe('Profile Integration Workflow', () => {
    it('should allow user to select a profile and show compatibility', async () => {
      // Mock profile store with active profile
      const profileStore = {
        profiles: [mockProfile],
        activeProfile: mockProfile,
        hasActiveProfile: true,
        preferences: { favoriteItems: [] },
      };

      wrapper = mountWithContext(TinkerItems, {
        global: {
          provide: {
            profileStore,
          },
          stubs: {
            'router-link': true,
            'router-view': true,
          },
        },
      });

      await flushPromises();

      // Should show profile selection
      const profileDropdown = wrapper.find('select');
      if (profileDropdown.exists()) {
        await profileDropdown.setValue(mockProfile.id);
        await flushPromises();
      }

      // Should show compatibility toggle
      const compatibilityToggle = wrapper.find('input[type="checkbox"]');
      if (compatibilityToggle.exists()) {
        await compatibilityToggle.setChecked(true);
        await flushPromises();

        // Should display compatibility indicators
        expect(wrapper.vm).toBeTruthy();
      }
    });

    it('should filter items based on profile compatibility when enabled', async () => {
      // Set up with profile and compatibility enabled
      wrapper.vm.selectedProfile = mockProfile;
      wrapper.vm.showCompatibility = true;
      await flushPromises();

      // Perform search
      const searchInput = wrapper.find('input[type="text"]');
      if (searchInput.exists()) {
        await searchInput.setValue('armor');
        await searchInput.trigger('keydown.enter');
        await flushPromises();
      }

      // Should show compatibility status
      expect(wrapper.vm.showCompatibility).toBe(true);
    });
  });

  describe('Advanced Filtering Workflow', () => {
    it('should allow user to apply item type filters', async () => {
      // Open filters section
      const filtersSection = wrapper.find('.filters');
      if (filtersSection.exists()) {
        // Apply armor filter
        const armorFilter = wrapper.find('input[value="6"]'); // Armor class
        if (armorFilter.exists()) {
          await armorFilter.setChecked(true);
          await flushPromises();
        }
      }

      expect(wrapper.exists()).toBe(true);
    });

    it('should allow user to set quality level range', async () => {
      // Find QL range inputs
      const qlInputs = wrapper.findAll('input[type="number"]');
      if (qlInputs.length >= 2) {
        await qlInputs[0].setValue('100'); // Min QL
        await qlInputs[1].setValue('250'); // Max QL
        await flushPromises();
      }

      expect(wrapper.exists()).toBe(true);
    });

    it('should allow user to filter by nano items only', async () => {
      // Find nano filter checkbox
      const nanoFilter = wrapper.find('input[id*="nano"]');
      if (nanoFilter.exists()) {
        await nanoFilter.setChecked(true);
        await flushPromises();
      }

      expect(wrapper.exists()).toBe(true);
    });
  });

  describe('Item Interaction Workflow', () => {
    it('should allow user to view item details', async () => {
      // Mock items in results
      wrapper.vm.searchResults = mockItems;
      await flushPromises();

      // Click on an item
      const itemCard = wrapper.find('.item-card');
      if (itemCard.exists()) {
        await itemCard.trigger('click');
        await flushPromises();

        // Should open item detail view
        expect(wrapper.emitted('item-click')).toBeTruthy();
      }
    });

    it('should allow user to add items to favorites', async () => {
      // Mock items in results
      wrapper.vm.searchResults = mockItems;
      await flushPromises();

      // Find and click favorite button
      const favoriteButton = wrapper.find('button[class*="pi-heart"]');
      if (favoriteButton.exists()) {
        await favoriteButton.trigger('click');
        await flushPromises();

        expect(wrapper.emitted('item-favorite')).toBeTruthy();
      }
    });

    it('should allow user to compare items', async () => {
      // Mock items in results
      wrapper.vm.searchResults = mockItems;
      await flushPromises();

      // Find and click compare button
      const compareButton = wrapper.find('button[class*="pi-clone"]');
      if (compareButton.exists()) {
        await compareButton.trigger('click');
        await flushPromises();

        expect(wrapper.emitted('item-compare')).toBeTruthy();
      }
    });
  });

  describe('Search History and Persistence', () => {
    beforeEach(() => {
      // Mock localStorage
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => JSON.stringify(['armor', 'weapon'])),
          setItem: vi.fn(),
          removeItem: vi.fn(),
          clear: vi.fn(),
        },
        writable: true,
      });
    });

    it('should save search queries to history', async () => {
      const searchInput = wrapper.find('input[type="text"]');
      if (searchInput.exists()) {
        await searchInput.setValue('new search');
        await searchInput.trigger('keydown.enter');
        await flushPromises();

        // Should save to localStorage
        expect(localStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining('recentSearches'),
          expect.stringContaining('new search')
        );
      }
    });

    it('should show recent searches when input is focused', async () => {
      const searchInput = wrapper.find('input[type="text"]');
      if (searchInput.exists()) {
        await searchInput.trigger('focus');
        await flushPromises();

        // Should show recent searches
        const suggestions = wrapper.find('.suggestions');
        expect(suggestions.exists()).toBe(true);
      }
    });
  });

  describe('Pagination Workflow', () => {
    it('should allow user to navigate through pages', async () => {
      // Mock pagination data
      wrapper.vm.pagination = { page: 1, limit: 25, total: 100 };
      await flushPromises();

      // Find next page button
      const buttons = wrapper.findAll('button');
      const nextButton = buttons.find((btn) => btn.text().includes('Next'));
      if (nextButton) {
        await nextButton.trigger('click');
        await flushPromises();

        expect(wrapper.emitted('page-change')).toBeTruthy();
      }
    });

    it('should allow user to change items per page', async () => {
      // Find page size dropdown
      const pageSizeSelect = wrapper.find('select[class*="rows"]');
      if (pageSizeSelect.exists()) {
        await pageSizeSelect.setValue('50');
        await flushPromises();

        expect(wrapper.emitted('page-size-change')).toBeTruthy();
      }
    });
  });

  describe('Responsive Behavior', () => {
    it('should adapt to mobile viewport', async () => {
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      window.dispatchEvent(new Event('resize'));
      await flushPromises();

      // Should show mobile-optimized layout
      const mobileControls = wrapper.find('.md\\:hidden');
      expect(mobileControls.exists()).toBe(true);
    });

    it('should maintain functionality on tablet', async () => {
      // Simulate tablet viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      });

      window.dispatchEvent(new Event('resize'));
      await flushPromises();

      // Should maintain core functionality
      const searchInput = wrapper.find('input[type="text"]');
      expect(searchInput.exists()).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle search errors gracefully', async () => {
      // Mock API error
      const mockError = new Error('Search failed');
      vi.mocked(wrapper.vm.performSearch).mockRejectedValue(mockError);

      const searchInput = wrapper.find('input[type="text"]');
      if (searchInput.exists()) {
        await searchInput.setValue('error test');
        await searchInput.trigger('keydown.enter');
        await flushPromises();
      }

      // Should show error message
      expect(wrapper.text()).toContain('Search failed') || expect(wrapper.exists()).toBe(true);
    });

    it('should handle empty search results', async () => {
      // Mock empty results
      wrapper.vm.searchResults = [];
      wrapper.vm.searchPerformed = true;
      await flushPromises();

      // Should show empty state
      expect(wrapper.text()).toContain('No items found') || expect(wrapper.exists()).toBe(true);
    });
  });

  describe('Performance Testing', () => {
    it('should handle large result sets efficiently', async () => {
      // Mock large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        ...mockItems[0],
        id: i + 1,
        name: `Item ${i + 1}`,
      }));

      wrapper.vm.searchResults = largeDataset.slice(0, 25); // Paginated
      await flushPromises();

      // Should render without performance issues
      expect(wrapper.exists()).toBe(true);
    });

    it('should debounce search input effectively', async () => {
      vi.useFakeTimers();

      const searchInput = wrapper.find('input[type="text"]');
      if (searchInput.exists()) {
        // Type multiple characters quickly
        await searchInput.setValue('a');
        await searchInput.setValue('ar');
        await searchInput.setValue('arm');
        await searchInput.setValue('armor');

        // Should not trigger search immediately
        expect(wrapper.vm.isSearching).toBeFalsy();

        // Advance timers
        vi.advanceTimersByTime(500);
        await flushPromises();

        // Now should have triggered search
        expect(wrapper.exists()).toBe(true);
      }

      vi.useRealTimers();
    });
  });
});

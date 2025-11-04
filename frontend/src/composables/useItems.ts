/**
 * Items Composable - Reactive composition API for item data operations
 *
 * Provides reusable functionality for item search, filtering, and management
 */

import { ref, computed, watch, readonly, type Ref } from 'vue';
import { useItemsStore } from '../stores/items';
import { useTinkerProfilesStore } from '../stores/tinkerProfiles';
import type {
  Item,
  ItemSearchQuery,
  ItemCompatibilityRequest,
  ItemCompatibilityResult,
} from '../types/api';
import { apiClient } from '../services/api-client';

export interface UseItemsOptions {
  autoSearch?: boolean;
  debounceMs?: number;
  defaultQuery?: Partial<ItemSearchQuery>;
}

export function useItems(options: UseItemsOptions = {}) {
  const itemsStore = useItemsStore();
  const profilesStore = useTinkerProfilesStore();

  // ============================================================================
  // Reactive State
  // ============================================================================

  const searchQuery = ref<ItemSearchQuery>({
    search: '',
    page: 1,
    limit: options.defaultQuery?.limit || 25,
    sort: 'name',
    sort_order: 'asc',
    ...options.defaultQuery,
  });

  const searchResults = ref<Item[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const searchPerformed = ref(false);

  let searchTimeout: NodeJS.Timeout | null = null;

  // ============================================================================
  // Computed Properties
  // ============================================================================

  const hasResults = computed(() => searchResults.value.length > 0);
  const isEmpty = computed(() => searchPerformed.value && searchResults.value.length === 0);
  const hasSearchQuery = computed(
    () =>
      searchQuery.value.search?.trim().length ||
      0 > 0 ||
      searchQuery.value.item_class?.length ||
      searchQuery.value.min_ql ||
      searchQuery.value.max_ql ||
      searchQuery.value.is_nano !== undefined
  );

  const pagination = computed(() => itemsStore.currentPagination);
  const totalItems = computed(() => pagination.value?.total || 0);
  const currentPage = computed(() => searchQuery.value.page || 1);
  const totalPages = computed(() =>
    pagination.value ? Math.ceil(pagination.value.total / pagination.value.limit) : 0
  );

  // Filter results based on current profile compatibility
  const compatibleItems = computed(() => {
    if (!profilesStore.hasActiveProfile) return searchResults.value;

    // This would need more complex logic based on character stats
    // For now, return all items
    return searchResults.value;
  });

  const favoriteResults = computed(() =>
    // TODO: Add favorites to tinkerProfiles store
    []
  );

  // ============================================================================
  // Search Operations
  // ============================================================================

  async function performSearch(query: ItemSearchQuery = searchQuery.value): Promise<Item[]> {
    loading.value = true;
    error.value = null;
    searchPerformed.value = true;

    try {
      const results = await itemsStore.searchItems(query);
      searchResults.value = results;
      searchQuery.value = { ...query };
      return results;
    } catch (err: any) {
      error.value = err.message || 'Search failed';
      searchResults.value = [];
      return [];
    } finally {
      loading.value = false;
    }
  }

  function debouncedSearch(query: ItemSearchQuery) {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
      performSearch(query);
    }, options.debounceMs || 300);
  }

  function updateSearchQuery(updates: Partial<ItemSearchQuery>) {
    const newQuery = { ...searchQuery.value, ...updates, page: 1 }; // Reset page on new search

    if (options.autoSearch) {
      debouncedSearch(newQuery);
    } else {
      searchQuery.value = newQuery;
    }
  }

  function setSearchText(text: string) {
    updateSearchQuery({ search: text });
  }

  function setFilters(filters: {
    item_class?: number[];
    min_ql?: number;
    max_ql?: number;
    is_nano?: boolean;
  }) {
    updateSearchQuery(filters);
  }

  function setSorting(
    sort: ItemSearchQuery['sort'],
    sort_order: ItemSearchQuery['sort_order'] = 'asc'
  ) {
    updateSearchQuery({ sort, sort_order });
  }

  function nextPage() {
    if (pagination.value?.hasNext) {
      updateSearchQuery({ page: currentPage.value + 1 });
    }
  }

  function previousPage() {
    if (pagination.value?.hasPrev) {
      updateSearchQuery({ page: Math.max(1, currentPage.value - 1) });
    }
  }

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages.value) {
      updateSearchQuery({ page });
    }
  }

  function clearSearch() {
    searchQuery.value = {
      search: '',
      page: 1,
      limit: searchQuery.value.limit,
      sort: 'name',
      sort_order: 'asc',
    };
    searchResults.value = [];
    searchPerformed.value = false;
    error.value = null;
    itemsStore.clearSearch();
  }

  // ============================================================================
  // Item Operations
  // ============================================================================

  async function getItemDetails(itemId: number): Promise<Item | null> {
    try {
      return await itemsStore.getItem(itemId);
    } catch (err: any) {
      error.value = err.message || 'Failed to load item details';
      return null;
    }
  }

  async function getMultipleItems(itemIds: number[]): Promise<Item[]> {
    try {
      return await itemsStore.getItems(itemIds);
    } catch (err: any) {
      error.value = err.message || 'Failed to load items';
      return [];
    }
  }

  function toggleFavorite(itemId: number) {
    // TODO: Add favorites to tinkerProfiles store
    console.log('Favorite toggle not yet implemented for tinkerProfiles store');
  }

  function isFavorite(itemId: number): boolean {
    // TODO: Add favorites to tinkerProfiles store
    return false;
  }

  // ============================================================================
  // Compatibility Checking
  // ============================================================================

  async function checkItemCompatibility(itemIds: number[]): Promise<ItemCompatibilityResult[]> {
    if (!profilesStore.activeProfile) {
      return [];
    }

    try {
      const request: ItemCompatibilityRequest = {
        profile: profilesStore.activeProfile,
        item_ids: itemIds,
        check_type: 'equip',
      };

      const response = await apiClient.checkItemCompatibility(request);
      if (response.success && response.data) {
        return response.data;
      }
      return [];
    } catch (err: any) {
      error.value = err.message || 'Compatibility check failed';
      return [];
    }
  }

  // ============================================================================
  // Quick Filters
  // ============================================================================

  function filterByClass(itemClass: number) {
    updateSearchQuery({ item_class: [itemClass] });
  }

  function filterByQL(minQL: number, maxQL?: number) {
    updateSearchQuery({ min_ql: minQL, max_ql: maxQL });
  }

  function filterNanos(isNano = true) {
    updateSearchQuery({ is_nano: isNano });
  }

  function showHighQLItems() {
    updateSearchQuery({ min_ql: 200, sort: 'ql', sort_order: 'desc' });
  }

  function showRecentItems() {
    // This would need actual "recent" data from the API
    updateSearchQuery({ sort: 'aoid', sort_order: 'desc' });
  }

  // ============================================================================
  // Auto-search watcher
  // ============================================================================

  if (options.autoSearch) {
    watch(
      () => searchQuery.value,
      (newQuery) => {
        debouncedSearch(newQuery);
      },
      { deep: true }
    );
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  function cleanup() {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
      searchTimeout = null;
    }
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    searchQuery: readonly(searchQuery),
    searchResults: readonly(searchResults),
    loading: readonly(loading),
    error: readonly(error),
    searchPerformed: readonly(searchPerformed),

    // Computed
    hasResults,
    isEmpty,
    hasSearchQuery,
    pagination,
    totalItems,
    currentPage,
    totalPages,
    compatibleItems,
    favoriteResults,

    // Search operations
    performSearch,
    updateSearchQuery,
    setSearchText,
    setFilters,
    setSorting,
    nextPage,
    previousPage,
    goToPage,
    clearSearch,

    // Item operations
    getItemDetails,
    getMultipleItems,
    toggleFavorite,
    isFavorite,
    checkItemCompatibility,

    // Quick filters
    filterByClass,
    filterByQL,
    filterNanos,
    showHighQLItems,
    showRecentItems,

    // Cleanup
    cleanup,
  };
}

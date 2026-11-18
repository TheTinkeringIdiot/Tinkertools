/**
 * Items Composable - Reactive composition API for item search
 *
 * Wraps the items store's search with local loading/error state
 */

import { ref, computed, readonly } from 'vue';
import { useItemsStore } from '../stores/items';
import type { Item, ItemSearchQuery } from '../types/api';

export function useItems() {
  const itemsStore = useItemsStore();

  // ============================================================================
  // Reactive State
  // ============================================================================

  const searchResults = ref<Item[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const searchPerformed = ref(false);

  // ============================================================================
  // Computed Properties
  // ============================================================================

  const pagination = computed(() => itemsStore.currentPagination);
  const totalItems = computed(() => pagination.value?.total || 0);

  // ============================================================================
  // Search Operations
  // ============================================================================

  async function performSearch(query: ItemSearchQuery): Promise<Item[]> {
    loading.value = true;
    error.value = null;
    searchPerformed.value = true;

    try {
      const results = await itemsStore.searchItems(query);
      searchResults.value = results;
      return results;
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Search failed';
      searchResults.value = [];
      return [];
    } finally {
      loading.value = false;
    }
  }

  function clearSearch() {
    searchResults.value = [];
    searchPerformed.value = false;
    error.value = null;
    itemsStore.clearSearch();
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    searchResults: readonly(searchResults),
    loading: readonly(loading),
    error: readonly(error),
    searchPerformed: readonly(searchPerformed),

    // Computed
    pagination,
    totalItems,

    // Search operations
    performSearch,
    clearSearch,
  };
}

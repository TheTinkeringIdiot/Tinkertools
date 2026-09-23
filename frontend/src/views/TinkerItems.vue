<!--
TinkerItems - Comprehensive Item Database Interface
Provides search, filtering, comparison and analysis of all AO items with optional character compatibility
-->
<template>
  <div class="tinker-items h-full flex flex-col">
    <!-- Header with Profile Selection and Options -->
    <div
      class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4"
    >
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="flex items-center gap-4">
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
            <i class="pi pi-database mr-2"></i>
            TinkerItems
          </h1>
          <Badge v-if="totalItems > 0" :value="totalItems" severity="info" />
        </div>

        <!-- Display Options -->
        <div class="flex flex-col sm:flex-row gap-3">
          <!-- Usability Toggle -->
          <div class="flex items-center gap-2">
            <InputSwitch
              v-model="showCompatibility"
              input-id="usability-toggle"
              aria-describedby="usability-help"
            />
            <label for="usability-toggle" class="text-sm text-surface-700 dark:text-surface-300">
              Usable
            </label>
            <span id="usability-help" class="sr-only">
              Show only items that your character can use based on their stats
            </span>
          </div>

          <!-- View Options -->
          <div
            class="flex items-center gap-1 border border-surface-300 dark:border-surface-600 rounded"
          >
            <Button
              v-tooltip.bottom="'Grid View'"
              icon="pi pi-th-large"
              :severity="viewMode === 'grid' ? 'primary' : 'secondary'"
              :outlined="viewMode !== 'grid'"
              size="small"
              @click="viewMode = 'grid'"
            />
            <Button
              v-tooltip.bottom="'List View'"
              icon="pi pi-list"
              :severity="viewMode === 'list' ? 'primary' : 'secondary'"
              :outlined="viewMode !== 'list'"
              size="small"
              @click="viewMode = 'list'"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 flex min-h-0">
      <!-- Advanced Search Sidebar -->
      <div class="w-80 border-r border-surface-200 dark:border-surface-700">
        <AdvancedItemSearch
          :loading="searchLoading"
          :result-count="totalResults"
          :initial-search="urlSearchTerm"
          @search="performAdvancedSearch"
          @clear="clearSearch"
        />
      </div>

      <!-- Main Results Area -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Results Header -->
        <div
          class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4"
        >
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="text-sm text-surface-600 dark:text-surface-400">
                {{
                  searchPerformed
                    ? `${totalResults} items found`
                    : 'Enter search terms or browse categories'
                }}
              </span>
            </div>

            <!-- Sorting and Actions -->
            <div v-if="hasLocalResults" class="flex items-center gap-2">
              <Dropdown
                v-model="sortOption"
                :options="sortOptions"
                option-label="label"
                option-value="value"
                placeholder="Sort by..."
                size="small"
                @change="onSortChanged"
              />

              <Button
                v-tooltip.bottom="'Refresh Results'"
                icon="pi pi-refresh"
                severity="secondary"
                outlined
                size="small"
                :loading="searchLoading"
                @click="refreshResults"
              />
            </div>
          </div>
        </div>

        <!-- Results Content -->
        <div class="flex-1 overflow-y-auto p-4">
          <!-- Loading State -->
          <div v-if="searchLoading" class="flex items-center justify-center h-64">
            <ProgressSpinner />
          </div>

          <!-- Empty State -->
          <div v-else-if="!hasLocalResults && searchPerformed" class="text-center py-16">
            <i class="pi pi-search text-4xl text-surface-400 mb-4"></i>
            <h3 class="text-lg font-medium text-surface-600 dark:text-surface-400 mb-2">
              No items found
            </h3>
            <p class="text-surface-500 dark:text-surface-500 mb-4">
              Try adjusting your search terms or filters
            </p>
            <!-- Clear filters button removed - now handled by AdvancedItemSearch component -->
          </div>

          <!-- Default State -->
          <div v-else-if="!searchPerformed" class="text-center py-16">
            <i class="pi pi-database text-4xl text-surface-400 mb-4"></i>
            <h3 class="text-lg font-medium text-surface-600 dark:text-surface-400 mb-2">
              Search the Item Database
            </h3>
            <p class="text-surface-500 dark:text-surface-500 mb-6">
              Find weapons, armor, implants, nano programs and more
            </p>
            <div class="flex flex-wrap gap-2 justify-center">
              <Button label="High QL Items" size="small" outlined @click="quickSearch('high-ql')" />
              <Button label="Weapons" size="small" outlined @click="quickSearch('weapons')" />
              <Button label="Implants" size="small" outlined @click="quickSearch('implants')" />
              <Button label="Nano Programs" size="small" outlined @click="quickSearch('nanos')" />
            </div>
          </div>

          <!-- Results List/Grid -->
          <ItemList
            v-else
            :items="searchResults"
            :view-mode="viewMode"
            :compatibility-profile="compatibilityProfile"
            :show-compatibility="showCompatibility && profilesStore.hasActiveProfile"
            :loading="searchLoading"
            :pagination="pagination"
            :revision-counts="revisionCounts"
            @item-click="onItemClick"
            @item-compare="onItemCompare"
            @item-cast-buff="onItemCastBuff"
            @page-change="onPageChange"
          />
        </div>
      </div>
    </div>

    <!-- Item Comparison Sidebar (if items selected) -->
    <ItemComparison
      v-if="comparisonItems.length > 0"
      :items="comparisonItems"
      :profile="compatibilityProfile"
      :show-compatibility="showCompatibility && profilesStore.hasActiveProfile"
      @remove-item="removeFromComparison"
      @clear-all="clearComparison"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useItems } from '@/composables/useItems';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import { useItemsStore } from '@/stores/items';
import { useToast } from 'primevue/usetoast';
import { apiClient } from '@/services/api-client';
import type { Item, ItemSearchQuery } from '@/types/api';

// Components
import AdvancedItemSearch from '@/components/items/AdvancedItemSearch.vue';
import ItemList from '@/components/items/ItemList.vue';
import ItemComparison from '@/components/items/ItemComparison.vue';

const router = useRouter();
const route = useRoute();
const profilesStore = useTinkerProfilesStore();
const toast = useToast();

// State
const searchQuery = ref('');
const showCompatibility = ref(false);
const viewMode = ref<'grid' | 'list'>('list');
// Note: activeFilters removed - now handled by AdvancedItemSearch component
const searchResults = ref<Item[]>([]);
const comparisonItems = ref<Item[]>([]);
const lastAdvancedSearchQuery = ref<ItemSearchQuery | null>(null);
const sortOption = ref('relevance');
const searchLoading = ref(false);
const searchPerformed = ref(false);
// AOID -> number of snapshots the item changed in, for the history badge
const revisionCounts = ref<Record<number, number>>({});

// Items composable with default options
const { performSearch: searchItems, totalItems, pagination, clearSearch: resetSearch } = useItems();

// Computed Properties
const compatibilityProfile = computed(() =>
  showCompatibility.value && profilesStore.hasActiveProfile
    ? (profilesStore.activeProfile as any)
    : null
);

// Note: activeFilterCount and hasActiveFilters removed - now handled by AdvancedItemSearch

const totalResults = computed(() => pagination.value?.total || 0);

const hasLocalResults = computed(() => searchResults.value.length > 0);

const sortOptions = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Name (A-Z)', value: 'name_asc' },
  { label: 'Name (Z-A)', value: 'name_desc' },
  { label: 'Quality Level (High)', value: 'ql_desc' },
  { label: 'Quality Level (Low)', value: 'ql_asc' },
  { label: 'Item Type', value: 'type' },
];

// Methods
async function performAdvancedSearch(query: ItemSearchQuery) {
  searchLoading.value = true;
  searchPerformed.value = true;

  // Store the query for pagination
  lastAdvancedSearchQuery.value = query;

  try {
    // Add pagination and sorting to the query
    const searchQuery: ItemSearchQuery = {
      ...query,
      sort: sortOption.value.includes('_')
        ? (sortOption.value.split('_')[0] as 'name' | 'ql' | 'item_class' | 'aoid')
        : (sortOption.value as 'name' | 'ql' | 'item_class' | 'aoid'),
      sort_order: sortOption.value.includes('desc') ? 'desc' : 'asc',
      limit: query.limit || pagination.value?.limit || 24,
      page: query.page || 1,
    };

    const results = await searchItems(searchQuery);
    searchResults.value = results;
    // Fire and forget: the badge must never delay results.
    void loadRevisionCounts(results);
  } catch (error) {
    console.error('Advanced search failed:', error);
  } finally {
    searchLoading.value = false;
  }
}

/**
 * One batch call per results page telling which rows changed across snapshots.
 * A failure just means no badges.
 */
async function loadRevisionCounts(items: Item[]) {
  revisionCounts.value = {};
  const aoids = items.map((item) => item.aoid).filter((aoid): aoid is number => !!aoid);
  if (aoids.length === 0) return;

  try {
    const response = await apiClient.batchItemRevisions(aoids);
    const counts: Record<number, number> = {};
    for (const [aoid, entry] of Object.entries(response?.items || {})) {
      counts[Number(aoid)] = entry.revision_count;
    }
    revisionCounts.value = counts;
  } catch {
    revisionCounts.value = {};
  }
}

// Legacy method for backwards compatibility with quick search
async function performSearch(options?: {
  query: string;
  exactMatch: boolean;
  searchFields: string[];
}) {
  // Convert legacy options to new format
  const query: ItemSearchQuery = {};

  if (options?.query) {
    query.search = options.query;
    query.exact_match = options.exactMatch;
    query.search_fields = options.searchFields;
  }

  await performAdvancedSearch(query);
}

function clearSearch() {
  searchQuery.value = '';
  resetSearch();
  searchResults.value = [];
  searchPerformed.value = false;
  lastAdvancedSearchQuery.value = null;
}

// Note: onFiltersChanged, clearFilters, and clearAllFilters removed - now handled by AdvancedItemSearch

async function onSortChanged() {
  if (searchPerformed.value) {
    // If we have an advanced search query, use it; otherwise fall back to legacy search
    if (lastAdvancedSearchQuery.value) {
      await performAdvancedSearch(lastAdvancedSearchQuery.value);
    } else {
      await performSearch();
    }
  }
}

async function refreshResults() {
  if (searchPerformed.value) {
    // If we have an advanced search query, use it; otherwise fall back to legacy search
    if (lastAdvancedSearchQuery.value) {
      await performAdvancedSearch(lastAdvancedSearchQuery.value);
    } else {
      await performSearch();
    }
  }
}

async function quickSearch(type: string) {
  const query: ItemSearchQuery = {};

  switch (type) {
    case 'high-ql':
      query.min_ql = 200;
      sortOption.value = 'ql_desc';
      break;
    case 'weapons':
      query.item_class = 1; // Weapon class
      break;
    case 'implants':
      query.item_class = 3; // Implant class
      break;
    case 'nanos':
      query.is_nano = true;
      break;
  }

  await performAdvancedSearch(query);
}

async function onItemClick(item: Item) {
  await router.push({ name: 'ItemDetail', params: { aoid: item.aoid!.toString() } });
}

function onItemCompare(item: Item) {
  if (comparisonItems.value.length < 3 && !comparisonItems.value.find((i) => i.id === item.id)) {
    comparisonItems.value.push(item);
  }
}

function removeFromComparison(itemId: number) {
  comparisonItems.value = comparisonItems.value.filter((item) => item.id !== itemId);
}

function clearComparison() {
  comparisonItems.value = [];
}

async function onItemCastBuff(item: Item) {
  try {
    await profilesStore.castBuff(item);
    toast.add({
      severity: 'success',
      summary: 'Buff Cast',
      detail: `${item.name} has been cast on your active profile`,
      life: 3000,
    });
  } catch (error) {
    console.error('Failed to cast buff:', error);
    toast.add({
      severity: 'error',
      summary: 'Cast Failed',
      detail: error instanceof Error ? error.message : 'Failed to cast the buff',
      life: 3000,
    });
  }
}

async function onPageChange(page: number, limit: number) {
  // Re-run the last advanced search with the new page and limit
  if (lastAdvancedSearchQuery.value) {
    // Create updated query with new page number and limit
    const updatedQuery = {
      ...lastAdvancedSearchQuery.value,
      page: page,
      limit: limit,
    };
    await performAdvancedSearch(updatedQuery);
  }
}

// Initialize
/** Term from the header search bar (?search=). */
const urlSearchTerm = computed(() =>
  typeof route.query.search === 'string' ? route.query.search : ''
);

async function searchFromUrl(term: string): Promise<void> {
  searchQuery.value = term;
  await performAdvancedSearch({
    search: term,
    exact_match: false,
    search_fields: ['name'],
  });
}

// A new term from the header while already on this page (no remount).
watch(urlSearchTerm, async (term, previous) => {
  if (term && term !== previous) await searchFromUrl(term);
});

onMounted(async () => {
  // Header search bar shortcut: /items?search=<term>
  if (urlSearchTerm.value.trim()) {
    await searchFromUrl(urlSearchTerm.value.trim());
    return;
  }

  // Check for strain query parameter and trigger search if present
  const strainParam = route.query.strain;
  const isNanoParam = route.query.is_nano;

  if (strainParam) {
    // Create a search query for the specified strain
    const strainQuery: ItemSearchQuery = {
      strain: parseInt(strainParam as string),
      is_nano: isNanoParam === 'true', // Filter to nanos if specified
      // Don't include 'search' parameter to use basic /items endpoint
    };

    // Trigger the advanced search
    await performAdvancedSearch(strainQuery);
    return;
  }

  // Check if we have cached search results and restore them
  const itemsStore = useItemsStore();
  if (itemsStore.currentSearchResults.length > 0 && itemsStore.currentSearchQuery) {
    searchResults.value = itemsStore.currentSearchResults;
    searchQuery.value = itemsStore.currentSearchQuery.search || '';
    searchPerformed.value = true;
    lastAdvancedSearchQuery.value = itemsStore.currentSearchQuery;
    void loadRevisionCounts(searchResults.value);
    // Note: Filter restoration would need to be handled by AdvancedItemSearch component
    // when implementing state persistence
  }
});

// Expose for tests
defineExpose({
  currentOffset: computed(() => {
    const page = pagination.value?.page || 1;
    const limit = pagination.value?.limit || 24;
    return (page - 1) * limit;
  }),
});
</script>

<style scoped>
.tinker-items {
  height: 100vh;
  max-height: 100vh;
}

/* Custom scrollbar for webkit browsers */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  @apply bg-surface-100 dark:bg-surface-800;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  @apply bg-surface-300 dark:bg-surface-600 rounded-full;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  @apply bg-surface-400 dark:bg-surface-500;
}
</style>

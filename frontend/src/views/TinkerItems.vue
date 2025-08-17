<!--
TinkerItems - Comprehensive Item Database Interface
Provides search, filtering, comparison and analysis of all AO items with optional character compatibility
-->
<template>
  <div class="tinker-items h-full flex flex-col">
    <!-- Header with Profile Selection and Options -->
    <div class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="flex items-center gap-4">
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
            <i class="pi pi-database mr-2"></i>
            TinkerItems
          </h1>
          <Badge :value="totalItems" severity="info" v-if="totalItems > 0" />
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
            <label 
              for="usability-toggle"
              class="text-sm text-surface-700 dark:text-surface-300"
            >
              Usable
            </label>
            <span id="usability-help" class="sr-only">
              Show only items that your character can use based on their stats
            </span>
          </div>
          
          <!-- View Options -->
          <div class="flex items-center gap-1 border border-surface-300 dark:border-surface-600 rounded">
            <Button
              icon="pi pi-th-large"
              :severity="viewMode === 'grid' ? 'primary' : 'secondary'"
              :outlined="viewMode !== 'grid'"
              size="small"
              @click="viewMode = 'grid'"
              v-tooltip.bottom="'Grid View'"
            />
            <Button
              icon="pi pi-list"
              :severity="viewMode === 'list' ? 'primary' : 'secondary'"
              :outlined="viewMode !== 'list'"
              size="small"
              @click="viewMode = 'list'"
              v-tooltip.bottom="'List View'"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 flex min-h-0">
      <!-- Sidebar with Search and Filters -->
      <div class="w-80 border-r border-surface-200 dark:border-surface-700 flex flex-col bg-surface-0 dark:bg-surface-950">
        <!-- Search Section -->
        <div class="p-4 border-b border-surface-200 dark:border-surface-700">
          <ItemSearch
            v-model:query="searchQuery"
            v-model:loading="searchLoading"
            :profile="compatibilityProfile"
            @search="performSearch"
            @clear="clearSearch"
          />
        </div>
        
        <!-- Filters Section -->
        <div class="flex-1 overflow-y-auto">
          <ItemFiltersComponent
            v-model:filters="activeFilters"
            :profile="compatibilityProfile"
            :search-results="searchResults"
            @filter-change="onFiltersChanged"
            @clear-filters="clearFilters"
          />
        </div>
        
        <!-- Favorites Quick Access -->
        <div class="p-4 border-t border-surface-200 dark:border-surface-700">
          <Button
            icon="pi pi-heart"
            label="My Favorites"
            :badge="favoriteCount.toString()"
            outlined
            size="small"
            class="w-full"
            @click="showFavorites"
            v-if="favoriteCount > 0"
          />
        </div>
      </div>

      <!-- Main Results Area -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Results Header -->
        <div class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="text-sm text-surface-600 dark:text-surface-400">
                {{ searchPerformed ? `${totalResults} items found` : 'Enter search terms or browse categories' }}
              </span>
              <Badge 
                v-if="hasActiveFilters"
                :value="activeFilterCount"
                severity="info"
              />
            </div>
            
            <!-- Sorting and Actions -->
            <div class="flex items-center gap-2" v-if="hasLocalResults">
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
                icon="pi pi-refresh"
                severity="secondary"
                outlined
                size="small"
                @click="refreshResults"
                :loading="searchLoading"
                v-tooltip.bottom="'Refresh Results'"
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
            <Button
              label="Clear Filters"
              icon="pi pi-filter-slash"
              outlined
              @click="clearAllFilters"
              v-if="hasActiveFilters"
            />
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
            @item-click="onItemClick"
            @item-favorite="onItemFavorite"
            @item-compare="onItemCompare"
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
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useItems } from '@/composables/useItems'
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles'
import { useItemsStore } from '@/stores/items'
import type { Item, ItemSearchQuery, ItemFilters } from '@/types/api'


// Components
import ItemSearch from '@/components/items/ItemSearch.vue'
import ItemFiltersComponent from '@/components/items/ItemFilters.vue'
import ItemList from '@/components/items/ItemList.vue'
import ItemComparison from '@/components/items/ItemComparison.vue'

const router = useRouter()
const profilesStore = useTinkerProfilesStore()

// State
const searchQuery = ref('')
const showCompatibility = ref(false)
const viewMode = ref<'grid' | 'list'>('list')
const activeFilters = ref<ItemFilters>({})
const searchResults = ref<Item[]>([])
const comparisonItems = ref<Item[]>([])
const sortOption = ref('relevance')
const searchLoading = ref(false)
const searchPerformed = ref(false)

// Items composable with default options
const {
  performSearch: searchItems,
  totalItems,
  pagination,
  hasResults,
  clearSearch: resetSearch,
  error: searchError
} = useItems({
  autoSearch: false,
  debounceMs: 300,
  defaultQuery: { limit: 24, sort: 'name', sort_order: 'asc' }
})

// Computed Properties
const compatibilityProfile = computed(() => 
  showCompatibility.value && profilesStore.hasActiveProfile ? profilesStore.activeProfile as any : null
)

const favoriteCount = computed(() => 
  // For now, return 0 since favorites might be handled differently with the new profile system
  0
)

const activeFilterCount = computed(() => 
  Object.values(activeFilters.value).filter(Boolean).length
)

const hasActiveFilters = computed(() => activeFilterCount.value > 0)

const totalResults = computed(() => pagination.value?.total || 0)

const hasLocalResults = computed(() => searchResults.value.length > 0)

const sortOptions = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Name (A-Z)', value: 'name_asc' },
  { label: 'Name (Z-A)', value: 'name_desc' },
  { label: 'Quality Level (High)', value: 'ql_desc' },
  { label: 'Quality Level (Low)', value: 'ql_asc' },
  { label: 'Item Type', value: 'type' }
]

// Search options from ItemSearch component
const searchOptions = ref({ query: '', exactMatch: true, searchFields: [] as string[] })

// Methods
async function performSearch(options?: { query: string; exactMatch: boolean; searchFields: string[] }) {
  // Update search options if provided from ItemSearch component
  if (options) {
    searchOptions.value = options
    searchQuery.value = options.query
  }
  
  if (!searchQuery.value.trim() && !hasActiveFilters.value) {
    return
  }
  
  searchLoading.value = true
  searchPerformed.value = true
  
  try {
    const query: ItemSearchQuery = {
      search: searchQuery.value,
      exact_match: searchOptions.value.exactMatch,
      search_fields: searchOptions.value.searchFields.length > 0 ? searchOptions.value.searchFields : undefined,
      ...activeFilters.value,
      sort: sortOption.value.includes('_') ? sortOption.value.split('_')[0] as 'name' | 'ql' | 'item_class' | 'aoid' : sortOption.value as 'name' | 'ql' | 'item_class' | 'aoid',
      sort_order: sortOption.value.includes('desc') ? 'desc' : 'asc',
      limit: pagination.value?.limit || 24,
      page: pagination.value?.page || 1
    }
    
    const results = await searchItems(query)
    searchResults.value = results
  } catch (error) {
    console.error('Search failed:', error)
  } finally {
    searchLoading.value = false
  }
}

function clearSearch() {
  searchQuery.value = ''
  resetSearch()
  searchResults.value = []
  searchPerformed.value = false
}


function onFiltersChanged() {
  if (searchPerformed.value) {
    performSearch()
  }
}

function clearFilters() {
  activeFilters.value = {}
  if (searchPerformed.value) {
    performSearch()
  }
}

function clearAllFilters() {
  clearFilters()
  clearSearch()
}

function onSortChanged() {
  if (searchPerformed.value) {
    performSearch()
  }
}

function refreshResults() {
  if (searchPerformed.value) {
    performSearch()
  }
}

async function quickSearch(type: string) {
  switch (type) {
    case 'high-ql':
      activeFilters.value = { minQL: 200 }
      sortOption.value = 'ql_desc'
      break
    case 'weapons':
      activeFilters.value = { itemClasses: [1, 2, 3, 4, 5] } // Weapon classes
      break
    case 'implants':
      activeFilters.value = { itemClasses: [15] } // Implant class
      break
    case 'nanos':
      activeFilters.value = { isNano: true }
      break
  }
  
  await performSearch()
}

function showFavorites() {
  // Implementation for showing favorite items
  searchQuery.value = ''
  activeFilters.value = { favorite_items: true }
  performSearch()
}

function onItemClick(item: Item) {
  router.push({ name: 'ItemDetail', params: { aoid: item.aoid!.toString() } })
}

function onItemFavorite(item: Item) {
  // TODO: Implement favorites with new profile system
  console.log('Favorite item:', item.id)
}

function onItemCompare(item: Item) {
  if (comparisonItems.value.length < 3 && !comparisonItems.value.find(i => i.id === item.id)) {
    comparisonItems.value.push(item)
  }
}

function removeFromComparison(itemId: number) {
  comparisonItems.value = comparisonItems.value.filter(item => item.id !== itemId)
}

function clearComparison() {
  comparisonItems.value = []
}

function onPageChange(page: number) {
  // Handle pagination - update the search query with the new page number
  if (searchPerformed.value) {
    const query: ItemSearchQuery = {
      search: searchQuery.value,
      exact_match: searchOptions.value.exactMatch,
      ...activeFilters.value,
      sort: sortOption.value.includes('_') ? sortOption.value.split('_')[0] as 'name' | 'ql' | 'item_class' | 'aoid' : sortOption.value as 'name' | 'ql' | 'item_class' | 'aoid',
      sort_order: sortOption.value.includes('desc') ? 'desc' : 'asc',
      page: page,
      limit: pagination.value?.limit || 24
    }
    
    searchLoading.value = true
    searchItems(query).then(results => {
      searchResults.value = results
    }).catch(error => {
      console.error('Pagination search failed:', error)
    }).finally(() => {
      searchLoading.value = false
    })
  }
}

// Initialize
onMounted(() => {
  // Check if we have cached search results and restore them
  const itemsStore = useItemsStore()
  if (itemsStore.currentSearchResults.length > 0 && itemsStore.currentSearchQuery) {
    searchResults.value = itemsStore.currentSearchResults
    searchQuery.value = itemsStore.currentSearchQuery.search || ''
    searchPerformed.value = true
    // Restore any active filters from the cached query
    if (itemsStore.currentSearchQuery) {
      const query = itemsStore.currentSearchQuery
      activeFilters.value = {
        ...(query.item_class && { itemClasses: query.item_class }),
        ...(query.min_ql && { minQL: query.min_ql }),
        ...(query.max_ql && { maxQL: query.max_ql }),
        ...(query.is_nano !== undefined && { isNano: query.is_nano })
      }
    }
  }
})
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
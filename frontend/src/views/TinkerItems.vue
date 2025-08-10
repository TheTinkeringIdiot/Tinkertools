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
        
        <!-- Profile & Display Options -->
        <div class="flex flex-col sm:flex-row gap-3">
          <!-- Profile Selection -->
          <div class="flex items-center gap-2">
            <label 
              for="profile-select"
              class="text-sm font-medium text-surface-700 dark:text-surface-300"
            >
              Profile:
            </label>
            <Dropdown 
              id="profile-select"
              v-model="selectedProfile"
              :options="profileOptions"
              option-label="label"
              option-value="value"
              placeholder="Select Profile"
              class="w-40"
              aria-describedby="profile-help"
              @change="onProfileChange"
            />
            <span id="profile-help" class="sr-only">
              Select a character profile to check item compatibility
            </span>
          </div>
          
          <!-- Profile Compatibility Toggle -->
          <div class="flex items-center gap-2">
            <InputSwitch 
              v-model="showCompatibility"
              input-id="compatibility-toggle"
              :disabled="!hasActiveProfile"
              aria-describedby="compatibility-help"
            />
            <label 
              for="compatibility-toggle"
              class="text-sm text-surface-700 dark:text-surface-300"
              :class="{ 'opacity-50': !hasActiveProfile }"
            >
              Show Compatibility
            </label>
            <span id="compatibility-help" class="sr-only">
              {{ hasActiveProfile ? 'Show which items your character can use based on their stats' : 'Select a profile first to enable compatibility checking' }}
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
      
      <!-- Active Profile Info -->
      <div v-if="hasActiveProfile && showCompatibility" class="mt-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
        <div class="flex items-center gap-2">
          <i class="pi pi-user text-primary-600"></i>
          <span class="text-sm text-primary-700 dark:text-primary-300">
            Compatibility checking for: <strong>{{ activeProfile.name }}</strong>
            (Level {{ activeProfile.level }} {{ activeProfile.profession }})
          </span>
          <Button
            icon="pi pi-times"
            size="small"
            text
            severity="secondary"
            @click="clearProfile"
            v-tooltip.bottom="'Clear Profile'"
          />
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
                size="small"
              />
            </div>
            
            <!-- Sorting and Actions -->
            <div class="flex items-center gap-2" v-if="hasResults">
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
          <div v-else-if="!hasResults && searchPerformed" class="text-center py-16">
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
            :show-compatibility="showCompatibility && hasActiveProfile"
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
      :show-compatibility="showCompatibility && hasActiveProfile"
      @remove-item="removeFromComparison"
      @clear-all="clearComparison"
    />

    <!-- Router View for Item Details -->
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useItems } from '@/composables/useItems'
import { useProfileStore } from '@/stores/profile'
import type { Item, ItemSearchQuery, ItemFilters } from '@/types/api'


// Components
import ItemSearch from '@/components/items/ItemSearch.vue'
import ItemFiltersComponent from '@/components/items/ItemFilters.vue'
import ItemList from '@/components/items/ItemList.vue'
import ItemComparison from '@/components/items/ItemComparison.vue'

const router = useRouter()
const profileStore = useProfileStore()

// State
const searchQuery = ref('')
const selectedProfile = ref<string>('none')
const showCompatibility = ref(false)
const viewMode = ref<'grid' | 'list'>('grid')
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
const profileOptions = computed(() => [
  { label: 'No Profile (View All)', value: 'none' },
  ...Array.from(profileStore.profiles.values()).map(profile => ({
    label: `${profile.Character.Name} (${profile.Character.Level} ${profile.Character.Profession})`,
    value: profile.Character.Name // Using name as the key since profiles don't have an id field
  }))
])

const hasActiveProfile = computed(() => 
  selectedProfile.value !== 'none' && profileStore.profiles.get(selectedProfile.value) !== undefined
)

const activeProfile = computed(() => 
  hasActiveProfile.value ? profileStore.profiles.get(selectedProfile.value) : null
)

const compatibilityProfile = computed(() => 
  showCompatibility.value ? activeProfile.value : null
)

const favoriteCount = computed(() => 
  profileStore.preferences.favoriteItems.length
)

const activeFilterCount = computed(() => 
  Object.values(activeFilters.value).filter(Boolean).length
)

const hasActiveFilters = computed(() => activeFilterCount.value > 0)

const totalResults = computed(() => pagination.value?.total || 0)

const sortOptions = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Name (A-Z)', value: 'name_asc' },
  { label: 'Name (Z-A)', value: 'name_desc' },
  { label: 'Quality Level (High)', value: 'ql_desc' },
  { label: 'Quality Level (Low)', value: 'ql_asc' },
  { label: 'Item Type', value: 'type' }
]

// Methods
async function performSearch() {
  if (!searchQuery.value.trim() && !hasActiveFilters.value) {
    return
  }
  
  searchLoading.value = true
  searchPerformed.value = true
  
  try {
    const query: ItemSearchQuery = {
      search: searchQuery.value,
      ...activeFilters.value,
      sort: sortOption.value.includes('_') ? sortOption.value.split('_')[0] : sortOption.value,
      sort_order: sortOption.value.includes('desc') ? 'desc' : 'asc'
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

function onProfileChange() {
  // Auto-enable compatibility if profile is selected
  if (selectedProfile.value !== 'none') {
    showCompatibility.value = true
  } else {
    showCompatibility.value = false
  }
  
  // Update profile in store if needed
  if (hasActiveProfile.value) {
    profileStore.setCurrentProfile(selectedProfile.value)
  }
}

function clearProfile() {
  selectedProfile.value = 'none'
  showCompatibility.value = false
  profileStore.setCurrentProfile(null)
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
      activeFilters.value = { min_ql: 200 }
      sortOption.value = 'ql_desc'
      break
    case 'weapons':
      activeFilters.value = { item_class: [1, 2, 3, 4, 5] } // Weapon classes
      break
    case 'implants':
      activeFilters.value = { item_class: [15] } // Implant class
      break
    case 'nanos':
      activeFilters.value = { is_nano: true }
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
  router.push({ name: 'ItemDetail', params: { id: item.id.toString() } })
}

function onItemFavorite(item: Item) {
  if (profileStore.preferences.favoriteItems.includes(item.id)) {
    profileStore.removeFavoriteItem(item.id)
  } else {
    profileStore.addFavoriteItem(item.id)
  }
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
  // Handle pagination
  if (searchPerformed.value) {
    performSearch()
  }
}

// Initialize
onMounted(() => {
  // Set current profile if available
  if (profileStore.currentProfile) {
    selectedProfile.value = profileStore.currentProfile.Character.Name
    showCompatibility.value = true
  }
})

// Watch for profile store changes
watch(() => profileStore.currentProfile, (newProfile) => {
  if (newProfile && selectedProfile.value === 'none') {
    selectedProfile.value = newProfile.Character.Name
    showCompatibility.value = true
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
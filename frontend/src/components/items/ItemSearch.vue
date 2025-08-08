<!--
ItemSearch - Advanced search component for TinkerItems
Provides full-text search with auto-complete and search suggestions
-->
<template>
  <div class="item-search space-y-3">
    <div class="space-y-2">
      <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
        Search Items
      </label>
      
      <!-- Main Search Input -->
      <div class="relative">
        <InputText
          v-model="searchQuery"
          placeholder="Search items, weapons, implants..."
          class="w-full pr-20"
          :class="{ 'border-red-500': hasError }"
          @input="onSearchInput"
          @keydown.enter="performSearch"
          @focus="showSuggestions = true"
          @blur="hideSuggestions"
        />
        
        <!-- Search Actions -->
        <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <Button
            v-if="searchQuery"
            icon="pi pi-times"
            text
            rounded
            size="small"
            @click="clearSearch"
            v-tooltip.bottom="'Clear Search'"
          />
          <Button
            icon="pi pi-search"
            size="small"
            :loading="loading"
            @click="performSearch"
            v-tooltip.bottom="'Search'"
          />
        </div>
        
        <!-- Search Suggestions Dropdown -->
        <div
          v-if="showSuggestions && (suggestions.length > 0 || recentSearches.length > 0)"
          class="absolute top-full left-0 right-0 z-50 mt-1 bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          <!-- Recent Searches -->
          <div v-if="recentSearches.length > 0 && !searchQuery" class="p-2 border-b border-surface-200 dark:border-surface-700">
            <div class="text-xs text-surface-500 dark:text-surface-400 mb-2 px-2">Recent Searches</div>
            <div class="space-y-1">
              <div
                v-for="search in recentSearches.slice(0, 5)"
                :key="search"
                class="flex items-center gap-2 px-2 py-1 hover:bg-surface-50 dark:hover:bg-surface-800 rounded cursor-pointer"
                @click="selectRecentSearch(search)"
              >
                <i class="pi pi-history text-surface-400 text-xs"></i>
                <span class="text-sm">{{ search }}</span>
              </div>
            </div>
          </div>
          
          <!-- Auto-complete Suggestions -->
          <div v-if="suggestions.length > 0" class="p-2">
            <div class="text-xs text-surface-500 dark:text-surface-400 mb-2 px-2">Suggestions</div>
            <div class="space-y-1">
              <div
                v-for="suggestion in suggestions.slice(0, 8)"
                :key="suggestion.text"
                class="flex items-center gap-2 px-2 py-1 hover:bg-surface-50 dark:hover:bg-surface-800 rounded cursor-pointer"
                @click="selectSuggestion(suggestion)"
              >
                <i :class="getSuggestionIcon(suggestion.type)" class="text-surface-400 text-xs"></i>
                <span class="text-sm" v-html="highlightMatch(suggestion.text, searchQuery)"></span>
                <Badge v-if="suggestion.count" :value="suggestion.count" size="small" severity="secondary" />
              </div>
            </div>
          </div>
          
          <!-- Quick Filters -->
          <div v-if="!searchQuery" class="p-2 border-t border-surface-200 dark:border-surface-700">
            <div class="text-xs text-surface-500 dark:text-surface-400 mb-2 px-2">Quick Filters</div>
            <div class="flex flex-wrap gap-1">
              <Button
                v-for="filter in quickFilters"
                :key="filter.label"
                :label="filter.label"
                size="small"
                text
                @click="selectQuickFilter(filter)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Advanced Search Toggle -->
    <div class="flex items-center justify-between">
      <Button
        :label="showAdvanced ? 'Hide Advanced' : 'Advanced Search'"
        :icon="showAdvanced ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
        text
        size="small"
        @click="toggleAdvanced"
      />
      
      <div v-if="profile" class="text-xs text-surface-500 dark:text-surface-400">
        <i class="pi pi-user mr-1"></i>
        Character: {{ profile.name }}
      </div>
    </div>
    
    <!-- Advanced Search Options -->
    <Transition name="slide-down">
      <div v-if="showAdvanced" class="space-y-3 p-3 bg-surface-50 dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700">
        <!-- Search in specific fields -->
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
              Search In
            </label>
            <MultiSelect
              v-model="searchFields"
              :options="searchFieldOptions"
              option-label="label"
              option-value="value"
              placeholder="All Fields"
              display="chip"
              class="w-full"
              :max-selected-labels="2"
            />
          </div>
          
          <div>
            <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
              Match Type
            </label>
            <Dropdown
              v-model="matchType"
              :options="matchTypeOptions"
              option-label="label"
              option-value="value"
              placeholder="Exact Match"
              class="w-full"
            />
          </div>
        </div>
        
        <!-- Search modifiers -->
        <div class="flex flex-wrap gap-2">
          <div class="flex items-center">
            <Checkbox v-model="caseSensitive" input-id="case-sensitive" />
            <label for="case-sensitive" class="ml-2 text-sm text-surface-600 dark:text-surface-400">
              Case sensitive
            </label>
          </div>
          
          <div class="flex items-center">
            <Checkbox v-model="exactMatch" input-id="exact-match" />
            <label for="exact-match" class="ml-2 text-sm text-surface-600 dark:text-surface-400">
              Exact match
            </label>
          </div>
          
          <div class="flex items-center" v-if="profile">
            <Checkbox v-model="compatibleOnly" input-id="compatible-only" />
            <label for="compatible-only" class="ml-2 text-sm text-surface-600 dark:text-surface-400">
              Compatible items only
            </label>
          </div>
        </div>
        
        <!-- Saved Searches -->
        <div v-if="savedSearches.length > 0">
          <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
            Saved Searches
          </label>
          <div class="flex flex-wrap gap-1">
            <Button
              v-for="saved in savedSearches"
              :key="saved.name"
              :label="saved.name"
              size="small"
              outlined
              @click="loadSavedSearch(saved)"
            />
          </div>
        </div>
      </div>
    </Transition>
    
    <!-- Search Stats -->
    <div v-if="hasSearched" class="text-xs text-surface-500 dark:text-surface-400 flex items-center justify-between">
      <span>{{ searchStats.resultCount }} results in {{ searchStats.duration }}ms</span>
      <Button
        label="Save Search"
        icon="pi pi-bookmark"
        size="small"
        text
        @click="saveCurrentSearch"
        v-if="canSaveSearch"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import type { TinkerProfile } from '@/types/api'

interface SearchSuggestion {
  text: string
  type: 'item' | 'category' | 'stat' | 'effect'
  count?: number
}

interface QuickFilter {
  label: string
  query: string
  filters?: Record<string, any>
}

interface SavedSearch {
  name: string
  query: string
  filters: Record<string, any>
  timestamp: number
}

const props = defineProps<{
  query: string
  loading?: boolean
  profile?: TinkerProfile | null
}>()

const emit = defineEmits<{
  search: []
  clear: []
  'update:query': [query: string]
}>()

// State
const searchQuery = ref(props.query)
const showSuggestions = ref(false)
const showAdvanced = ref(false)
const suggestions = ref<SearchSuggestion[]>([])
const recentSearches = ref<string[]>([])
const savedSearches = ref<SavedSearch[]>([])

// Advanced search options
const searchFields = ref<string[]>([])
const matchType = ref('contains')
const caseSensitive = ref(false)
const exactMatch = ref(false)
const compatibleOnly = ref(false)

// Search stats
const hasSearched = ref(false)
const searchStats = ref({ resultCount: 0, duration: 0 })

// Options
const searchFieldOptions = [
  { label: 'Item Name', value: 'name' },
  { label: 'Description', value: 'description' },
  { label: 'Effects', value: 'effects' },
  { label: 'Stats', value: 'stats' }
]

const matchTypeOptions = [
  { label: 'Contains', value: 'contains' },
  { label: 'Starts with', value: 'starts_with' },
  { label: 'Ends with', value: 'ends_with' },
  { label: 'Exact match', value: 'exact' }
]

const quickFilters: QuickFilter[] = [
  { label: 'Weapons', query: '', filters: { item_class: [1, 2, 3, 4, 5] } },
  { label: 'Armor', query: '', filters: { item_class: [6, 7, 8, 9, 10] } },
  { label: 'Implants', query: '', filters: { item_class: [15] } },
  { label: 'High QL', query: '', filters: { min_ql: 200 } },
  { label: 'Nano Programs', query: '', filters: { is_nano: true } }
]

// Computed
const hasError = computed(() => false) // Would integrate with validation

const canSaveSearch = computed(() => 
  searchQuery.value.trim().length > 0 && hasSearched.value
)

// Methods
let searchTimeout: NodeJS.Timeout | null = null

function onSearchInput() {
  emit('update:query', searchQuery.value)
  
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  
  // Debounce suggestions
  if (searchQuery.value.trim().length > 1) {
    searchTimeout = setTimeout(() => {
      loadSuggestions()
    }, 300)
  } else {
    suggestions.value = []
  }
}

async function loadSuggestions() {
  if (searchQuery.value.trim().length < 2) {
    suggestions.value = []
    return
  }
  
  try {
    // Mock suggestions - would integrate with backend API
    suggestions.value = [
      { text: 'Implant', type: 'category', count: 150 },
      { text: 'Viral', type: 'item', count: 23 },
      { text: 'Bio-Communal', type: 'item', count: 8 }
    ].filter(s => s.text.toLowerCase().includes(searchQuery.value.toLowerCase()))
  } catch (error) {
    console.error('Failed to load suggestions:', error)
  }
}

function performSearch() {
  if (!searchQuery.value.trim()) return
  
  // Add to recent searches
  if (!recentSearches.value.includes(searchQuery.value)) {
    recentSearches.value.unshift(searchQuery.value)
    recentSearches.value = recentSearches.value.slice(0, 10)
    saveRecentSearches()
  }
  
  hasSearched.value = true
  showSuggestions.value = false
  emit('search')
}

function clearSearch() {
  searchQuery.value = ''
  emit('update:query', '')
  suggestions.value = []
  hasSearched.value = false
  emit('clear')
}

function selectSuggestion(suggestion: SearchSuggestion) {
  searchQuery.value = suggestion.text
  emit('update:query', searchQuery.value)
  showSuggestions.value = false
  nextTick(() => performSearch())
}

function selectRecentSearch(search: string) {
  searchQuery.value = search
  emit('update:query', searchQuery.value)
  showSuggestions.value = false
  nextTick(() => performSearch())
}

function selectQuickFilter(filter: QuickFilter) {
  if (filter.query) {
    searchQuery.value = filter.query
    emit('update:query', searchQuery.value)
  }
  showSuggestions.value = false
  nextTick(() => performSearch())
}

function hideSuggestions() {
  // Delay hiding to allow clicks on suggestions
  setTimeout(() => {
    showSuggestions.value = false
  }, 200)
}

function toggleAdvanced() {
  showAdvanced.value = !showAdvanced.value
}

function getSuggestionIcon(type: string): string {
  switch (type) {
    case 'item': return 'pi pi-box'
    case 'category': return 'pi pi-tags'
    case 'stat': return 'pi pi-chart-bar'
    case 'effect': return 'pi pi-sparkles'
    default: return 'pi pi-search'
  }
}

function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return text
  
  const regex = new RegExp(`(${query})`, 'gi')
  return text.replace(regex, '<mark>$1</mark>')
}

function saveCurrentSearch() {
  const search: SavedSearch = {
    name: searchQuery.value,
    query: searchQuery.value,
    filters: {}, // Would include current filters
    timestamp: Date.now()
  }
  
  savedSearches.value.push(search)
  saveSavedSearches()
}

function loadSavedSearch(search: SavedSearch) {
  searchQuery.value = search.query
  emit('update:query', searchQuery.value)
  showSuggestions.value = false
  nextTick(() => performSearch())
}

// Persistence
function loadRecentSearches() {
  const saved = localStorage.getItem('tinkerItems.recentSearches')
  if (saved) {
    recentSearches.value = JSON.parse(saved)
  }
}

function saveRecentSearches() {
  localStorage.setItem('tinkerItems.recentSearches', JSON.stringify(recentSearches.value))
}

function loadSavedSearches() {
  const saved = localStorage.getItem('tinkerItems.savedSearches')
  if (saved) {
    savedSearches.value = JSON.parse(saved)
  }
}

function saveSavedSearches() {
  localStorage.setItem('tinkerItems.savedSearches', JSON.stringify(savedSearches.value))
}

// Watch props
watch(() => props.query, (newQuery) => {
  searchQuery.value = newQuery
})

// Initialize
onMounted(() => {
  loadRecentSearches()
  loadSavedSearches()
})
</script>

<style scoped>
/* Transitions */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease-in-out;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Highlight styling */
:deep(mark) {
  background-color: rgb(var(--primary-200));
  color: rgb(var(--primary-800));
  padding: 0 2px;
  border-radius: 2px;
}

.dark :deep(mark) {
  background-color: rgb(var(--primary-800));
  color: rgb(var(--primary-200));
}
</style>
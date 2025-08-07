/**
 * Items Store - Pinia Store for Item Data Management
 * 
 * Manages items data with caching, search, and filtering capabilities
 */

import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import type {
  Item,
  ItemSearchQuery,
  ItemFilterRequest,
  PaginatedResponse,
  UserFriendlyError
} from '../types/api'
import { apiClient } from '../services/api-client'

interface ItemsState {
  // Data
  items: Map<number, Item>
  searchResults: {
    query: ItemSearchQuery | null
    results: Item[]
    pagination: any
    timestamp: number
  } | null
  
  // UI State
  loading: boolean
  error: UserFriendlyError | null
  lastFetch: number
  
  // Cache
  cacheExpiry: number // 15 minutes
}

export const useItemsStore = defineStore('items', () => {
  // ============================================================================
  // State
  // ============================================================================
  
  const items = ref(new Map<number, Item>())
  const searchResults = ref<ItemsState['searchResults']>(null)
  const loading = ref(false)
  const error = ref<UserFriendlyError | null>(null)
  const lastFetch = ref(0)
  const cacheExpiry = 15 * 60 * 1000 // 15 minutes
  
  // ============================================================================
  // Getters
  // ============================================================================
  
  const allItems = computed(() => Array.from(items.value.values()))
  
  const itemsById = computed(() => (ids: number[]) => 
    ids.map(id => items.value.get(id)).filter(Boolean) as Item[]
  )
  
  const nanoItems = computed(() => 
    allItems.value.filter(item => item.is_nano)
  )
  
  const regularItems = computed(() => 
    allItems.value.filter(item => !item.is_nano)
  )
  
  const itemsByClass = computed(() => (itemClass: number) =>
    allItems.value.filter(item => item.item_class === itemClass)
  )
  
  const itemsCount = computed(() => items.value.size)
  
  const isDataStale = computed(() => 
    Date.now() - lastFetch.value > cacheExpiry
  )
  
  const currentSearchQuery = computed(() => searchResults.value?.query)
  const currentSearchResults = computed(() => searchResults.value?.results || [])
  const currentPagination = computed(() => searchResults.value?.pagination)
  
  // ============================================================================
  // Actions
  // ============================================================================
  
  /**
   * Search items with query parameters
   */
  async function searchItems(query: ItemSearchQuery, forceRefresh = false): Promise<Item[]> {
    // Check if we already have this exact search cached
    if (
      !forceRefresh &&
      searchResults.value &&
      JSON.stringify(searchResults.value.query) === JSON.stringify(query) &&
      Date.now() - searchResults.value.timestamp < cacheExpiry
    ) {
      return searchResults.value.results
    }
    
    loading.value = true
    error.value = null
    
    try {
      const response: PaginatedResponse<Item> = await apiClient.searchItems(query)
      
      if (response.success && response.data) {
        // Store individual items in cache
        response.data.forEach(item => {
          items.value.set(item.id, item)
        })
        
        // Store search results
        searchResults.value = {
          query,
          results: response.data,
          pagination: response.pagination,
          timestamp: Date.now()
        }
        
        lastFetch.value = Date.now()
        return response.data
      } else {
        throw new Error(response.error?.message || 'Search failed')
      }
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Get a single item by ID
   */
  async function getItem(id: number, forceRefresh = false): Promise<Item | null> {
    // Check cache first
    if (!forceRefresh && items.value.has(id)) {
      return items.value.get(id) || null
    }
    
    loading.value = true
    error.value = null
    
    try {
      const response = await apiClient.getItem(id)
      
      if (response.success && response.data) {
        items.value.set(id, response.data)
        lastFetch.value = Date.now()
        return response.data
      } else {
        throw new Error(response.error?.message || 'Item not found')
      }
    } catch (err: any) {
      error.value = err
      return null
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Get multiple items by IDs (uses batching)
   */
  async function getItems(ids: number[], forceRefresh = false): Promise<Item[]> {
    const results: Item[] = []
    const missingIds: number[] = []
    
    // Check cache for existing items
    if (!forceRefresh) {
      for (const id of ids) {
        const cachedItem = items.value.get(id)
        if (cachedItem) {
          results.push(cachedItem)
        } else {
          missingIds.push(id)
        }
      }
    } else {
      missingIds.push(...ids)
    }
    
    // Fetch missing items
    if (missingIds.length > 0) {
      loading.value = true
      error.value = null
      
      try {
        const response = await apiClient.getItems(missingIds)
        
        if (response.success && response.data) {
          response.data.forEach(item => {
            items.value.set(item.id, item)
            results.push(item)
          })
          lastFetch.value = Date.now()
        } else {
          throw new Error(response.error?.message || 'Items fetch failed')
        }
      } catch (err: any) {
        error.value = err
        throw err
      } finally {
        loading.value = false
      }
    }
    
    // Return items in original order
    return ids.map(id => items.value.get(id)!).filter(Boolean)
  }
  
  /**
   * Filter items with advanced criteria
   */
  async function filterItems(filter: ItemFilterRequest): Promise<Item[]> {
    loading.value = true
    error.value = null
    
    try {
      const response: PaginatedResponse<Item> = await apiClient.filterItems(filter)
      
      if (response.success && response.data) {
        // Store individual items in cache
        response.data.forEach(item => {
          items.value.set(item.id, item)
        })
        
        lastFetch.value = Date.now()
        return response.data
      } else {
        throw new Error(response.error?.message || 'Filter failed')
      }
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Get items with specific stat requirements
   */
  function getItemsWithStats(statRequirements: Array<{ stat: number; minValue?: number; maxValue?: number }>): Item[] {
    return allItems.value.filter(item => {
      return statRequirements.every(req => {
        const itemStat = item.stats.find(stat => stat.stat === req.stat)
        if (!itemStat) return false
        
        if (req.minValue !== undefined && itemStat.value < req.minValue) return false
        if (req.maxValue !== undefined && itemStat.value > req.maxValue) return false
        
        return true
      })
    })
  }
  
  /**
   * Clear search results
   */
  function clearSearch(): void {
    searchResults.value = null
  }
  
  /**
   * Clear error state
   */
  function clearError(): void {
    error.value = null
  }
  
  /**
   * Clear all cached data
   */
  function clearCache(): void {
    items.value.clear()
    searchResults.value = null
    lastFetch.value = 0
    error.value = null
  }
  
  /**
   * Preload common items (quality items, implants, etc.)
   */
  async function preloadCommonItems(): Promise<void> {
    if (!isDataStale.value && items.value.size > 0) {
      return // Already have recent data
    }
    
    try {
      // Load a basic set of high-quality items and common implants
      await searchItems({
        min_ql: 200,
        limit: 100,
        sort: 'ql',
        sort_order: 'desc'
      })
      
      // Load common nano programs
      await searchItems({
        is_nano: true,
        limit: 50,
        sort: 'name'
      })
    } catch (err) {
      console.warn('Failed to preload common items:', err)
    }
  }
  
  /**
   * Get item statistics
   */
  const getStats = computed(() => ({
    totalItems: itemsCount.value,
    nanoCount: nanoItems.value.length,
    itemCount: regularItems.value.length,
    lastUpdate: new Date(lastFetch.value).toLocaleString(),
    cacheHitRatio: items.value.size > 0 ? 'Available' : 'No cache'
  }))
  
  // ============================================================================
  // Return
  // ============================================================================
  
  return {
    // State
    items: readonly(items),
    loading: readonly(loading),
    error: readonly(error),
    lastFetch: readonly(lastFetch),
    
    // Getters
    allItems,
    itemsById,
    nanoItems,
    regularItems,
    itemsByClass,
    itemsCount,
    isDataStale,
    currentSearchQuery,
    currentSearchResults,
    currentPagination,
    getStats,
    
    // Actions
    searchItems,
    getItem,
    getItems,
    filterItems,
    getItemsWithStats,
    clearSearch,
    clearError,
    clearCache,
    preloadCommonItems
  }
})
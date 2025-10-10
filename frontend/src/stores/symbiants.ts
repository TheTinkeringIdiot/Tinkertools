/**
 * Symbiants Store - Pinia Store for Symbiant Data Management
 * 
 * Manages symbiant data with caching, search, and collection tracking
 */

import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import type {
  Symbiant,
  SymbiantSearchQuery,
  PaginatedResponse,
  UserFriendlyError
} from '../types/api'
import { apiClient } from '../services/api-client'
import { enrichSymbiant } from '../utils/symbiantHelpers'

export const useSymbiantsStore = defineStore('symbiants', () => {
  // ============================================================================
  // State
  // ============================================================================

  const symbiants = ref(new Map<number, Symbiant>())
  const searchResults = ref<{
    query: SymbiantSearchQuery | null
    results: Symbiant[]
    pagination: any
    timestamp: number
  } | null>(null)
  const loading = ref(false)
  const error = ref<UserFriendlyError | null>(null)
  const lastFetch = ref(0)
  const cacheExpiry = 30 * 60 * 1000 // 30 minutes (symbiants change less frequently)

  // Comparison selection state
  const selectedForComparison = ref<(Symbiant | null)[]>([null, null, null])
  
  // ============================================================================
  // Getters
  // ============================================================================
  
  const allSymbiants = computed(() => Array.from(symbiants.value.values()))
  
  const symbiantsById = computed(() => (ids: number[]) =>
    ids.map(id => symbiants.value.get(id)).filter(Boolean) as Symbiant[]
  )
  
  const symbiantsByFamily = computed(() => (family: string) =>
    allSymbiants.value.filter(symbiant => symbiant.family === family)
  )
  
  const symbiantFamilies = computed(() => {
    const families = new Set<string>()
    allSymbiants.value.forEach(symbiant => {
      if (symbiant.family) {
        families.add(symbiant.family)
      }
    })
    return Array.from(families).sort()
  })
  
  const symbiantsCount = computed(() => symbiants.value.size)
  
  const isDataStale = computed(() =>
    Date.now() - lastFetch.value > cacheExpiry
  )
  
  const currentSearchQuery = computed(() => searchResults.value?.query)
  const currentSearchResults = computed(() => searchResults.value?.results || [])
  const currentPagination = computed(() => searchResults.value?.pagination)
  
  // Family-based organization for easier browsing
  const symbiantsByFamilyMap = computed(() => {
    const familyMap = new Map<string, Symbiant[]>()
    
    allSymbiants.value.forEach(symbiant => {
      const family = symbiant.family || 'Unknown'
      if (!familyMap.has(family)) {
        familyMap.set(family, [])
      }
      familyMap.get(family)!.push(symbiant)
    })
    
    // Sort symbiants within each family by AOID
    familyMap.forEach(symbiants => {
      symbiants.sort((a, b) => (a.aoid || 0) - (b.aoid || 0))
    })
    
    return familyMap
  })
  
  // ============================================================================
  // Actions
  // ============================================================================
  
  /**
   * Search symbiants with query parameters
   */
  async function searchSymbiants(query: SymbiantSearchQuery, forceRefresh = false): Promise<Symbiant[]> {
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
      const response: PaginatedResponse<Symbiant> = await apiClient.searchSymbiants(query)
      
      if (response.items) {
        // Enrich symbiants with display data and store in cache
        const enrichedSymbiants = response.items.map(enrichSymbiant);
        enrichedSymbiants.forEach(symbiant => {
          symbiants.value.set(symbiant.id, symbiant)
        })
        
        // Store search results
        searchResults.value = {
          query,
          results: enrichedSymbiants,
          pagination: {
            page: response.page,
            limit: response.page_size,
            total: response.total,
            hasNext: response.has_next,
            hasPrev: response.has_prev
          },
          timestamp: Date.now()
        }
        
        lastFetch.value = Date.now()
        return enrichedSymbiants
      } else {
        throw new Error('No symbiant data received')
      }
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Get a single symbiant by ID
   */
  async function getSymbiant(id: number, forceRefresh = false): Promise<Symbiant | null> {
    // Check cache first
    if (!forceRefresh && symbiants.value.has(id)) {
      return symbiants.value.get(id) || null
    }
    
    loading.value = true
    error.value = null
    
    try {
      const response = await apiClient.getSymbiant(id)
      
      if (response.data) {
        const enriched = enrichSymbiant(response.data);
        symbiants.value.set(id, enriched)
        lastFetch.value = Date.now()
        return enriched
      } else {
        throw new Error('Symbiant not found')
      }
    } catch (err: any) {
      error.value = err
      return null
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Get symbiant by AOID (game ID)
   */
  function getSymbiantByAoid(aoid: number): Symbiant | null {
    return allSymbiants.value.find(symbiant => symbiant.aoid === aoid) || null
  }
  
  /**
   * Load all symbiants (they're a relatively small dataset)
   */
  async function loadAllSymbiants(forceRefresh = false): Promise<Symbiant[]> {
    if (!forceRefresh && symbiants.value.size > 900 && !isDataStale.value) {
      return allSymbiants.value // We likely have most/all symbiants cached
    }
    
    loading.value = true
    error.value = null
    
    try {
      // Load in batches to get all symbiants
      const allResults: Symbiant[] = []
      let page = 1
      let hasMore = true
      
      while (hasMore) {
        const response: PaginatedResponse<Symbiant> = await apiClient.searchSymbiants({
          page,
          limit: 100
        })

        if (response.items) {
          const enrichedSymbiants = response.items.map(enrichSymbiant)
          enrichedSymbiants.forEach(symbiant => {
            symbiants.value.set(symbiant.id, symbiant)
          })

          allResults.push(...enrichedSymbiants)
          hasMore = response.has_next || false
          page++
        } else {
          hasMore = false
        }
      }
      
      lastFetch.value = Date.now()
      return allResults
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Get symbiants that would be useful for a character build
   */
  function getSymbiantsForBuild(targetStats: Array<{ stat: number; priority: 'high' | 'medium' | 'low' }>): Symbiant[] {
    // This would need more complex logic based on symbiant stat bonuses
    // For now, return all symbiants as we don't have stat bonus data in the basic model
    return allSymbiants.value
  }
  
  /**
   * Get symbiants by quality/tier (derived from family names or other data)
   */
  function getSymbiantsByTier(tier: 'artillery' | 'infantry' | 'support' | 'control'): Symbiant[] {
    // Map family names to tiers - this would need game knowledge
    const tierFamilies: Record<string, string[]> = {
      artillery: ['Seeker', 'Hacker'],
      infantry: ['Soldier', 'Veteran'], 
      support: ['Medic', 'Engineer'],
      control: ['Commander', 'Leader']
    }
    
    const families = tierFamilies[tier] || []
    return allSymbiants.value.filter(symbiant => 
      symbiant.family && families.some(family => 
        symbiant.family!.toLowerCase().includes(family.toLowerCase())
      )
    )
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
    symbiants.value.clear()
    searchResults.value = null
    lastFetch.value = 0
    error.value = null
  }
  
  /**
   * Preload all symbiants (they're a small dataset)
   */
  async function preloadSymbiants(): Promise<void> {
    if (!isDataStale.value && symbiants.value.size > 900) {
      return // Already have recent data
    }
    
    try {
      await loadAllSymbiants()
    } catch (err) {
      console.warn('Failed to preload symbiants:', err)
    }
  }
  
  /**
   * Get symbiant statistics
   */
  const getStats = computed(() => ({
    totalSymbiants: symbiantsCount.value,
    uniqueFamilies: symbiantFamilies.value.length,
    familyBreakdown: Object.fromEntries(
      Array.from(symbiantsByFamilyMap.value.entries()).map(([family, symbiants]) =>
        [family, symbiants.length]
      )
    ),
    lastUpdate: new Date(lastFetch.value).toLocaleString(),
    cacheHitRatio: symbiants.value.size > 0 ? 'Available' : 'No cache'
  }))

  /**
   * Add symbiant to first available slot
   * Returns true if added, false if all slots are full
   */
  function addToComparison(symbiant: Symbiant): boolean {
    const firstEmptyIndex = selectedForComparison.value.findIndex(slot => slot === null)
    if (firstEmptyIndex === -1) {
      return false
    }
    selectedForComparison.value[firstEmptyIndex] = symbiant
    return true
  }

  /**
   * Remove symbiant by ID from comparison
   */
  function removeFromComparison(symbiantId: number): void {
    const index = selectedForComparison.value.findIndex(
      slot => slot !== null && slot.id === symbiantId
    )
    if (index !== -1) {
      selectedForComparison.value[index] = null
    }
  }

  /**
   * Clear all comparison selections
   */
  function clearComparison(): void {
    selectedForComparison.value = [null, null, null]
  }

  /**
   * Check if symbiant is in comparison
   * Returns slot index (0-2) or null if not found
   */
  function isInComparison(symbiantId: number): number | null {
    const index = selectedForComparison.value.findIndex(
      slot => slot !== null && slot.id === symbiantId
    )
    return index !== -1 ? index : null
  }

  /**
   * Get count of selected symbiants
   */
  function getComparisonCount(): number {
    return selectedForComparison.value.filter(slot => slot !== null).length
  }

  // ============================================================================
  // Return
  // ============================================================================
  
  return {
    // State
    symbiants: readonly(symbiants),
    loading: readonly(loading),
    error: readonly(error),
    lastFetch: readonly(lastFetch),
    selectedForComparison: readonly(selectedForComparison),

    // Getters
    allSymbiants,
    symbiantsById,
    symbiantsByFamily,
    symbiantFamilies,
    symbiantsCount,
    isDataStale,
    currentSearchQuery,
    currentSearchResults,
    currentPagination,
    symbiantsByFamilyMap,
    getStats,

    // Actions
    searchSymbiants,
    getSymbiant,
    getSymbiantByAoid,
    loadAllSymbiants,
    getSymbiantsForBuild,
    getSymbiantsByTier,
    clearSearch,
    clearError,
    clearCache,
    preloadSymbiants,
    // Comparison actions
    addToComparison,
    removeFromComparison,
    clearComparison,
    isInComparison,
    getComparisonCount
  }
})
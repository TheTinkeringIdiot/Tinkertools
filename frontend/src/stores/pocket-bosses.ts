/**
 * Pocket Bosses Store - Pinia Store for Pocket Boss Data Management
 * 
 * Manages pocket boss data with search, filtering, and drop tracking
 */

import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import type {
  PocketBoss,
  Symbiant,
  PocketBossSearchQuery,
  PaginatedResponse,
  UserFriendlyError
} from '../types/api'
import { apiClient } from '../services/api-client'

export const usePocketBossesStore = defineStore('pocketBosses', () => {
  // ============================================================================
  // State
  // ============================================================================
  
  const pocketBosses = ref(new Map<number, PocketBoss>())
  const bossDrops = ref(new Map<number, Symbiant[]>()) // boss_id -> symbiants
  const searchResults = ref<{
    query: PocketBossSearchQuery | null
    results: PocketBoss[]
    pagination: any
    timestamp: number
  } | null>(null)
  const loading = ref(false)
  const error = ref<UserFriendlyError | null>(null)
  const lastFetch = ref(0)
  const cacheExpiry = 60 * 60 * 1000 // 1 hour (pocket boss data is very static)
  
  // ============================================================================
  // Getters
  // ============================================================================
  
  const allPocketBosses = computed(() => Array.from(pocketBosses.value.values()))
  
  const pocketBossesById = computed(() => (ids: number[]) =>
    ids.map(id => pocketBosses.value.get(id)).filter(Boolean) as PocketBoss[]
  )
  
  const pocketBossesByLevel = computed(() => (minLevel: number, maxLevel: number) =>
    allPocketBosses.value.filter(boss => 
      boss.level >= minLevel && boss.level <= maxLevel
    ).sort((a, b) => a.level - b.level)
  )
  
  const pocketBossesByPlayfield = computed(() => (playfield: string) =>
    allPocketBosses.value.filter(boss => 
      boss.playfield?.toLowerCase().includes(playfield.toLowerCase())
    )
  )
  
  const uniquePlayfields = computed(() => {
    const playfields = new Set<string>()
    allPocketBosses.value.forEach(boss => {
      if (boss.playfield) {
        playfields.add(boss.playfield)
      }
    })
    return Array.from(playfields).sort()
  })
  
  const levelRanges = computed(() => {
    if (allPocketBosses.value.length === 0) return { min: 0, max: 0 }
    
    const levels = allPocketBosses.value.map(boss => boss.level)
    return {
      min: Math.min(...levels),
      max: Math.max(...levels)
    }
  })
  
  const pocketBossesCount = computed(() => pocketBosses.value.size)
  
  const isDataStale = computed(() =>
    Date.now() - lastFetch.value > cacheExpiry
  )
  
  const currentSearchQuery = computed(() => searchResults.value?.query)
  const currentSearchResults = computed(() => searchResults.value?.results || [])
  const currentPagination = computed(() => searchResults.value?.pagination)
  
  // Group bosses by level ranges for easier browsing
  const pocketBossesByLevelRange = computed(() => {
    const ranges = new Map<string, PocketBoss[]>()
    
    allPocketBosses.value.forEach(boss => {
      const rangeKey = `${Math.floor(boss.level / 50) * 50}-${Math.floor(boss.level / 50) * 50 + 49}`
      if (!ranges.has(rangeKey)) {
        ranges.set(rangeKey, [])
      }
      ranges.get(rangeKey)!.push(boss)
    })
    
    // Sort bosses within each range
    ranges.forEach(bosses => {
      bosses.sort((a, b) => a.level - b.level)
    })
    
    return ranges
  })
  
  // ============================================================================
  // Actions
  // ============================================================================
  
  /**
   * Search pocket bosses with query parameters
   */
  async function searchPocketBosses(query: PocketBossSearchQuery, forceRefresh = false): Promise<PocketBoss[]> {
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
      const response: PaginatedResponse<PocketBoss> = await apiClient.searchPocketBosses(query)
      
      if (response.success && response.data) {
        // Store individual pocket bosses in cache
        response.data.forEach(boss => {
          pocketBosses.value.set(boss.id, boss)
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
   * Get a single pocket boss by ID
   */
  async function getPocketBoss(id: number, forceRefresh = false): Promise<PocketBoss | null> {
    // Check cache first
    if (!forceRefresh && pocketBosses.value.has(id)) {
      return pocketBosses.value.get(id) || null
    }
    
    loading.value = true
    error.value = null
    
    try {
      const response = await apiClient.getPocketBoss(id)
      
      if (response.success && response.data) {
        pocketBosses.value.set(id, response.data)
        lastFetch.value = Date.now()
        return response.data
      } else {
        throw new Error(response.error?.message || 'Pocket boss not found')
      }
    } catch (err: any) {
      error.value = err
      return null
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Get drops for a specific pocket boss
   */
  async function getPocketBossDrops(bossId: number, forceRefresh = false): Promise<Symbiant[]> {
    // Check cache first
    if (!forceRefresh && bossDrops.value.has(bossId)) {
      return bossDrops.value.get(bossId) || []
    }
    
    loading.value = true
    error.value = null
    
    try {
      const response = await apiClient.getPocketBossDrops(bossId)
      
      if (response.success && response.data) {
        bossDrops.value.set(bossId, response.data)
        lastFetch.value = Date.now()
        return response.data
      } else {
        throw new Error(response.error?.message || 'Failed to load drops')
      }
    } catch (err: any) {
      error.value = err
      return []
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Load all pocket bosses (relatively small dataset)
   */
  async function loadAllPocketBosses(forceRefresh = false): Promise<PocketBoss[]> {
    if (!forceRefresh && pocketBosses.value.size > 50 && !isDataStale.value) {
      return allPocketBosses.value // We likely have most/all pocket bosses cached
    }
    
    loading.value = true
    error.value = null
    
    try {
      // Load in batches to get all pocket bosses
      const allResults: PocketBoss[] = []
      let page = 1
      let hasMore = true
      
      while (hasMore) {
        const response: PaginatedResponse<PocketBoss> = await apiClient.searchPocketBosses({
          page,
          limit: 50
        })
        
        if (response.success && response.data) {
          response.data.forEach(boss => {
            pocketBosses.value.set(boss.id, boss)
          })
          
          allResults.push(...response.data)
          hasMore = response.pagination?.hasNext || false
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
   * Find pocket bosses that drop a specific symbiant
   */
  function getBossesDropping(symbiantId: number): PocketBoss[] {
    const droppingBosses: PocketBoss[] = []
    
    pocketBosses.value.forEach(boss => {
      if (boss.drops && boss.drops.some(drop => drop.id === symbiantId)) {
        droppingBosses.push(boss)
      }
    })
    
    return droppingBosses
  }
  
  /**
   * Find pocket bosses by difficulty/level suitability
   */
  function getBossesByDifficulty(difficulty: 'low' | 'medium' | 'high' | 'endgame'): PocketBoss[] {
    const levelRanges = {
      low: [1, 100],
      medium: [100, 180],
      high: [180, 220],
      endgame: [220, 300]
    }
    
    const [minLevel, maxLevel] = levelRanges[difficulty]
    return pocketBossesByLevel.value(minLevel, maxLevel)
  }
  
  /**
   * Get comprehensive boss information including drops
   */
  async function getBossWithDrops(bossId: number): Promise<PocketBoss & { dropDetails: Symbiant[] } | null> {
    const boss = await getPocketBoss(bossId)
    if (!boss) return null
    
    const drops = await getPocketBossDrops(bossId)
    
    return {
      ...boss,
      dropDetails: drops
    }
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
    pocketBosses.value.clear()
    bossDrops.value.clear()
    searchResults.value = null
    lastFetch.value = 0
    error.value = null
  }
  
  /**
   * Preload all pocket bosses (small dataset)
   */
  async function preloadPocketBosses(): Promise<void> {
    if (!isDataStale.value && pocketBosses.value.size > 50) {
      return // Already have recent data
    }
    
    try {
      await loadAllPocketBosses()
    } catch (err) {
      console.warn('Failed to preload pocket bosses:', err)
    }
  }
  
  /**
   * Get pocket boss statistics
   */
  const getStats = computed(() => ({
    totalBosses: pocketBossesCount.value,
    levelRange: levelRanges.value,
    uniquePlayfields: uniquePlayfields.value.length,
    playfieldBreakdown: Object.fromEntries(
      uniquePlayfields.value.map(playfield => [
        playfield,
        pocketBossesByPlayfield.value(playfield).length
      ])
    ),
    levelRangeBreakdown: Object.fromEntries(
      Array.from(pocketBossesByLevelRange.value.entries()).map(([range, bosses]) => 
        [range, bosses.length]
      )
    ),
    lastUpdate: new Date(lastFetch.value).toLocaleString(),
    cacheHitRatio: pocketBosses.value.size > 0 ? 'Available' : 'No cache'
  }))
  
  // ============================================================================
  // Return
  // ============================================================================
  
  return {
    // State
    pocketBosses: readonly(pocketBosses),
    bossDrops: readonly(bossDrops),
    loading: readonly(loading),
    error: readonly(error),
    lastFetch: readonly(lastFetch),
    
    // Getters
    allPocketBosses,
    pocketBossesById,
    pocketBossesByLevel,
    pocketBossesByPlayfield,
    uniquePlayfields,
    levelRanges,
    pocketBossesCount,
    isDataStale,
    currentSearchQuery,
    currentSearchResults,
    currentPagination,
    pocketBossesByLevelRange,
    getStats,
    
    // Actions
    searchPocketBosses,
    getPocketBoss,
    getPocketBossDrops,
    loadAllPocketBosses,
    getBossesDropping,
    getBossesByDifficulty,
    getBossWithDrops,
    clearSearch,
    clearError,
    clearCache,
    preloadPocketBosses
  }
})
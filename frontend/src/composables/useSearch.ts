/**
 * Search Composable - Universal search functionality across all data types
 * 
 * Provides cross-application search capabilities for items, spells, symbiants, and pocket bosses
 */

import { ref, computed, watch } from 'vue'
import { useItemsStore } from '../stores/items'
import { useSpellsStore } from '../stores/spells'
import { useSymbiantsStore } from '../stores/symbiants'
import { usePocketBossesStore } from '../stores/pocket-bosses'
import { useProfileStore } from '../stores/profile'
import type { Item, Spell, Symbiant, PocketBoss } from '../types/api'

export type SearchableEntity = Item | Spell | Symbiant | PocketBoss
export type SearchCategory = 'items' | 'spells' | 'symbiants' | 'pocket-bosses' | 'all'

export interface SearchResult {
  type: 'item' | 'spell' | 'symbiant' | 'pocket-boss'
  entity: SearchableEntity
  relevance: number
  matchedFields: string[]
}

export interface UseSearchOptions {
  defaultCategory?: SearchCategory
  maxResults?: number
  minQueryLength?: number
  debounceMs?: number
  enableHistory?: boolean
}

export function useSearch(options: UseSearchOptions = {}) {
  const itemsStore = useItemsStore()
  const spellsStore = useSpellsStore()
  const symbiantsStore = useSymbiantsStore()
  const pocketBossesStore = usePocketBossesStore()
  const profileStore = useProfileStore()
  
  // ============================================================================
  // Reactive State
  // ============================================================================
  
  const query = ref('')
  const category = ref<SearchCategory>(options.defaultCategory || 'all')
  const results = ref<SearchResult[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchPerformed = ref(false)
  
  const recentQueries = ref<string[]>([])
  const suggestions = ref<string[]>([])
  
  let searchTimeout: NodeJS.Timeout | null = null
  
  // ============================================================================
  // Computed Properties
  // ============================================================================
  
  const hasQuery = computed(() => query.value.trim().length >= (options.minQueryLength || 2))
  const hasResults = computed(() => results.value.length > 0)
  const isEmpty = computed(() => searchPerformed.value && results.value.length === 0)
  
  const resultsByType = computed(() => {
    const grouped: Record<string, SearchResult[]> = {
      item: [],
      spell: [],
      symbiant: [],
      'pocket-boss': []
    }
    
    results.value.forEach(result => {
      grouped[result.type].push(result)
    })
    
    return grouped
  })
  
  const resultCounts = computed(() => ({
    items: resultsByType.value.item.length,
    spells: resultsByType.value.spell.length,
    symbiants: resultsByType.value.symbiant.length,
    pocketBosses: resultsByType.value['pocket-boss'].length,
    total: results.value.length
  }))
  
  const topResults = computed(() => 
    results.value
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, options.maxResults || 50)
  )
  
  // ============================================================================
  // Search Operations
  // ============================================================================
  
  async function performSearch(searchQuery: string = query.value, searchCategory: SearchCategory = category.value): Promise<SearchResult[]> {
    if (!searchQuery.trim() || searchQuery.length < (options.minQueryLength || 2)) {
      results.value = []
      return []
    }
    
    loading.value = true
    error.value = null
    searchPerformed.value = true
    
    try {
      const searchPromises: Promise<SearchResult[]>[] = []
      
      // Search items
      if (searchCategory === 'all' || searchCategory === 'items') {
        searchPromises.push(searchItems(searchQuery))
      }
      
      // Search spells
      if (searchCategory === 'all' || searchCategory === 'spells') {
        searchPromises.push(searchSpells(searchQuery))
      }
      
      // Search symbiants
      if (searchCategory === 'all' || searchCategory === 'symbiants') {
        searchPromises.push(searchSymbiants(searchQuery))
      }
      
      // Search pocket bosses
      if (searchCategory === 'all' || searchCategory === 'pocket-bosses') {
        searchPromises.push(searchPocketBosses(searchQuery))
      }
      
      const searchResults = await Promise.all(searchPromises)
      const flatResults = searchResults.flat()
      
      // Sort by relevance and apply limits
      results.value = flatResults
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, options.maxResults || 100)
      
      // Save to search history
      if (options.enableHistory && searchQuery.trim()) {
        addToSearchHistory(searchQuery.trim())
        profileStore.addRecentSearch(searchQuery.trim())
      }
      
      return results.value
    } catch (err: any) {
      error.value = err.message || 'Search failed'
      results.value = []
      return []
    } finally {
      loading.value = false
    }
  }
  
  async function searchItems(searchQuery: string): Promise<SearchResult[]> {
    try {
      const items = await itemsStore.searchItems({
        search: searchQuery,
        limit: 25
      })
      
      return items.map(item => ({
        type: 'item' as const,
        entity: item,
        relevance: calculateItemRelevance(item, searchQuery),
        matchedFields: getMatchedFields(item, searchQuery, ['name', 'description'])
      }))
    } catch (err) {
      console.warn('Item search failed:', err)
      return []
    }
  }
  
  async function searchSpells(searchQuery: string): Promise<SearchResult[]> {
    try {
      const spells = await spellsStore.searchSpells({
        search: searchQuery,
        limit: 20
      })
      
      return spells.map(spell => ({
        type: 'spell' as const,
        entity: spell,
        relevance: calculateSpellRelevance(spell, searchQuery),
        matchedFields: getMatchedFields(spell, searchQuery, ['spell_format'])
      }))
    } catch (err) {
      console.warn('Spell search failed:', err)
      return []
    }
  }
  
  async function searchSymbiants(searchQuery: string): Promise<SearchResult[]> {
    try {
      const symbiants = await symbiantsStore.searchSymbiants({
        search: searchQuery,
        limit: 15
      })
      
      return symbiants.map(symbiant => ({
        type: 'symbiant' as const,
        entity: symbiant,
        relevance: calculateSymbiantRelevance(symbiant, searchQuery),
        matchedFields: getMatchedFields(symbiant, searchQuery, ['family'])
      }))
    } catch (err) {
      console.warn('Symbiant search failed:', err)
      return []
    }
  }
  
  async function searchPocketBosses(searchQuery: string): Promise<SearchResult[]> {
    try {
      const bosses = await pocketBossesStore.searchPocketBosses({
        search: searchQuery,
        limit: 10
      })
      
      return bosses.map(boss => ({
        type: 'pocket-boss' as const,
        entity: boss,
        relevance: calculatePocketBossRelevance(boss, searchQuery),
        matchedFields: getMatchedFields(boss, searchQuery, ['name', 'playfield', 'location'])
      }))
    } catch (err) {
      console.warn('Pocket boss search failed:', err)
      return []
    }
  }
  
  // ============================================================================
  // Relevance Calculation
  // ============================================================================
  
  function calculateItemRelevance(item: Item, searchQuery: string): number {
    let relevance = 0
    const query = searchQuery.toLowerCase()
    
    // Exact name match gets highest score
    if (item.name.toLowerCase() === query) {
      relevance += 100
    } else if (item.name.toLowerCase().includes(query)) {
      relevance += 80
    }
    
    // Description match
    if (item.description?.toLowerCase().includes(query)) {
      relevance += 20
    }
    
    // Quality level bonus for high-QL items
    if (item.ql && item.ql > 200) {
      relevance += 10
    }
    
    // Nano items get slight boost for nano searches
    if (item.is_nano && (query.includes('nano') || query.includes('spell'))) {
      relevance += 15
    }
    
    return relevance
  }
  
  function calculateSpellRelevance(spell: Spell, searchQuery: string): number {
    let relevance = 0
    const query = searchQuery.toLowerCase()
    
    if (spell.spell_format?.toLowerCase().includes(query)) {
      relevance += 60
    }
    
    // Spell ID exact match
    if (spell.spell_id && spell.spell_id.toString() === query) {
      relevance += 90
    }
    
    return relevance
  }
  
  function calculateSymbiantRelevance(symbiant: Symbiant, searchQuery: string): number {
    let relevance = 0
    const query = searchQuery.toLowerCase()
    
    // Family name match
    if (symbiant.family?.toLowerCase().includes(query)) {
      relevance += 70
    }
    
    // AOID exact match
    if (symbiant.aoid && symbiant.aoid.toString() === query) {
      relevance += 90
    }
    
    return relevance
  }
  
  function calculatePocketBossRelevance(boss: PocketBoss, searchQuery: string): number {
    let relevance = 0
    const query = searchQuery.toLowerCase()
    
    // Exact name match
    if (boss.name.toLowerCase() === query) {
      relevance += 100
    } else if (boss.name.toLowerCase().includes(query)) {
      relevance += 80
    }
    
    // Playfield match
    if (boss.playfield?.toLowerCase().includes(query)) {
      relevance += 40
    }
    
    // Location match
    if (boss.location?.toLowerCase().includes(query)) {
      relevance += 30
    }
    
    return relevance
  }
  
  function getMatchedFields(entity: any, query: string, fields: string[]): string[] {
    const matched: string[] = []
    const lowerQuery = query.toLowerCase()
    
    fields.forEach(field => {
      const value = entity[field]
      if (value && typeof value === 'string' && value.toLowerCase().includes(lowerQuery)) {
        matched.push(field)
      }
    })
    
    return matched
  }
  
  // ============================================================================
  // Search History and Suggestions
  // ============================================================================
  
  function addToSearchHistory(searchQuery: string) {
    const trimmed = searchQuery.trim()
    if (!trimmed) return
    
    // Remove if already exists
    const index = recentQueries.value.indexOf(trimmed)
    if (index > -1) {
      recentQueries.value.splice(index, 1)
    }
    
    // Add to front
    recentQueries.value.unshift(trimmed)
    
    // Keep only last 20 queries
    if (recentQueries.value.length > 20) {
      recentQueries.value.splice(20)
    }
  }
  
  function clearSearchHistory() {
    recentQueries.value = []
  }
  
  function generateSuggestions(currentQuery: string): string[] {
    if (!currentQuery.trim()) return []
    
    const query = currentQuery.toLowerCase()
    const suggested = new Set<string>()
    
    // Add matching recent queries
    recentQueries.value.forEach(recentQuery => {
      if (recentQuery.toLowerCase().includes(query) && recentQuery !== currentQuery) {
        suggested.add(recentQuery)
      }
    })
    
    // Add popular search terms based on current stores data
    // This is simplified - in reality you'd want a more sophisticated suggestion system
    const commonTerms = [
      'implant', 'nano', 'weapon', 'armor', 'symbiant', 
      'doctor', 'engineer', 'trader', 'adventurer', 'soldier',
      'shadowlands', 'rubi-ka', 'alien invasion'
    ]
    
    commonTerms.forEach(term => {
      if (term.includes(query) && term !== query) {
        suggested.add(term)
      }
    })
    
    return Array.from(suggested).slice(0, 8)
  }
  
  // ============================================================================
  // Utility Functions
  // ============================================================================
  
  function debouncedSearch(searchQuery: string) {
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
    
    searchTimeout = setTimeout(() => {
      performSearch(searchQuery)
    }, options.debounceMs || 300)
  }
  
  function setQuery(newQuery: string) {
    query.value = newQuery
    suggestions.value = generateSuggestions(newQuery)
    
    if (newQuery.trim().length >= (options.minQueryLength || 2)) {
      debouncedSearch(newQuery)
    } else {
      results.value = []
      searchPerformed.value = false
    }
  }
  
  function setCategory(newCategory: SearchCategory) {
    category.value = newCategory
    if (hasQuery.value) {
      performSearch()
    }
  }
  
  function clearSearch() {
    query.value = ''
    results.value = []
    suggestions.value = []
    searchPerformed.value = false
    error.value = null
    
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
  }
  
  function clearError() {
    error.value = null
  }
  
  // ============================================================================
  // Auto-search watcher
  // ============================================================================
  
  watch(
    () => query.value,
    (newQuery) => {
      suggestions.value = generateSuggestions(newQuery)
    }
  )
  
  // ============================================================================
  // Cleanup
  // ============================================================================
  
  function cleanup() {
    if (searchTimeout) {
      clearTimeout(searchTimeout)
      searchTimeout = null
    }
  }
  
  // ============================================================================
  // Return
  // ============================================================================
  
  return {
    // State
    query: readonly(query),
    category: readonly(category),
    results: readonly(results),
    loading: readonly(loading),
    error: readonly(error),
    searchPerformed: readonly(searchPerformed),
    recentQueries: readonly(recentQueries),
    suggestions: readonly(suggestions),
    
    // Computed
    hasQuery,
    hasResults,
    isEmpty,
    resultsByType,
    resultCounts,
    topResults,
    
    // Actions
    performSearch,
    setQuery,
    setCategory,
    clearSearch,
    clearError,
    clearSearchHistory,
    cleanup
  }
}
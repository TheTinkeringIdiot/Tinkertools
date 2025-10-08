/**
 * Spells Store - Pinia Store for Spell Data Management
 * 
 * Manages spells and spell data with caching and search capabilities
 * Enhanced with nano compatibility and effect analysis
 */

import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import type {
  Spell,
  SpellSearchQuery,
  PaginatedResponse,
  UserFriendlyError
} from '../types/api'
import { apiClient } from '../services/api-client'
import { nanoCompatibility } from '../utils/nano-compatibility'
import { gameUtils } from '../services/game-utils'
import { flagOperations } from '../utils/flag-operations'

export const useSpellsStore = defineStore('spells', () => {
  // ============================================================================
  // State
  // ============================================================================
  
  const spells = ref(new Map<number, Spell>())
  const searchResults = ref<{
    query: SpellSearchQuery | null
    results: Spell[]
    pagination: any
    timestamp: number
  } | null>(null)
  const loading = ref(false)
  const error = ref<UserFriendlyError | null>(null)
  const lastFetch = ref(0)
  const cacheExpiry = 15 * 60 * 1000 // 15 minutes
  
  // ============================================================================
  // Getters
  // ============================================================================
  
  const allSpells = computed(() => Array.from(spells.value.values()))
  
  const spellsById = computed(() => (ids: number[]) =>
    ids.map(id => spells.value.get(id)).filter(Boolean) as Spell[]
  )
  
  const spellsByTarget = computed(() => (target: number) =>
    allSpells.value.filter(spell => spell.target === target)
  )
  
  const spellsWithCriteria = computed(() =>
    allSpells.value.filter(spell => spell.spell_params?.Criteria?.length > 0)
  )
  
  const spellsCount = computed(() => spells.value.size)
  
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
   * Search spells with query parameters
   */
  async function searchSpells(query: SpellSearchQuery, forceRefresh = false): Promise<Spell[]> {
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
      const response: PaginatedResponse<Spell> = await apiClient.searchSpells(query)

      if (response.items) {
        // Store individual spells in cache
        response.items.forEach(spell => {
          spells.value.set(spell.id, spell)
        })

        // Store search results
        searchResults.value = {
          query,
          results: response.items,
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
        return response.items
      } else {
        throw new Error('Search failed')
      }
    } catch (err: any) {
      error.value = err
      throw err
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Get a single spell by ID
   */
  async function getSpell(id: number, forceRefresh = false): Promise<Spell | null> {
    // Check cache first
    if (!forceRefresh && spells.value.has(id)) {
      return spells.value.get(id) || null
    }
    
    loading.value = true
    error.value = null
    
    try {
      const response = await apiClient.getSpell(id)
      
      if (response.success && response.data) {
        spells.value.set(id, response.data)
        lastFetch.value = Date.now()
        return response.data
      } else {
        throw new Error(response.error?.message || 'Spell not found')
      }
    } catch (err: any) {
      error.value = err
      return null
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Get spells by their spell_id field (game mechanic ID)
   */
  function getSpellsBySpellId(spellId: number): Spell[] {
    return allSpells.value.filter(spell => spell.spell_id === spellId)
  }
  
  /**
   * Get spells with specific parameters
   */
  function getSpellsWithParams(paramFilter: Record<string, any>): Spell[] {
    return allSpells.value.filter(spell => {
      if (!spell.spell_params) return false
      
      return Object.entries(paramFilter).every(([key, value]) => {
        const spellValue = spell.spell_params[key]
        if (Array.isArray(value)) {
          return value.includes(spellValue)
        }
        return spellValue === value
      })
    })
  }
  
  /**
   * Analyze spell effects for nano programs
   */
  function analyzeSpellEffects(spellIds: number[]): {
    statModifiers: Array<{ stat: number; amount: number; count: number }>
    schools: string[]
    targetTypes: number[]
  } {
    const targetSpells = spellsById.value(spellIds)
    const statModifiers = new Map<string, { stat: number; amount: number; count: number }>()
    const schools = new Set<string>()
    const targetTypes = new Set<number>()
    
    targetSpells.forEach(spell => {
      // Analyze stat modifications
      if (spell.spell_params?.Stat && spell.spell_params?.Amount) {
        const key = `${spell.spell_params.Stat}`
        const existing = statModifiers.get(key)
        if (existing) {
          existing.amount += spell.spell_params.Amount
          existing.count += 1
        } else {
          statModifiers.set(key, {
            stat: spell.spell_params.Stat,
            amount: spell.spell_params.Amount,
            count: 1
          })
        }
      }
      
      // Track target types
      if (spell.target) {
        targetTypes.add(spell.target)
      }
      
      // Extract school information from spell format or params
      if (spell.spell_format) {
        // This would need nano school mapping logic
      }
    })
    
    return {
      statModifiers: Array.from(statModifiers.values()),
      schools: Array.from(schools),
      targetTypes: Array.from(targetTypes)
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
    spells.value.clear()
    searchResults.value = null
    lastFetch.value = 0
    error.value = null
  }
  
  /**
   * Preload common spells
   */
  async function preloadCommonSpells(): Promise<void> {
    if (!isDataStale.value && spells.value.size > 0) {
      return // Already have recent data
    }
    
    try {
      // Load spells with criteria (most useful for analysis)
      await searchSpells({
        has_criteria: true,
        limit: 100
      })
    } catch (err) {
      console.warn('Failed to preload common spells:', err)
    }
  }
  
  /**
   * Convert spell to nano format for compatibility checking
   */
  function convertSpellToNano(spell: Spell): any {
    return {
      id: spell.id,
      name: spell.name,
      school: spell.spell_params?.School || 0,
      ncuCost: spell.spell_params?.NCU || 0,
      nanoPoints: spell.spell_params?.NanoPoints || 0,
      level: spell.spell_params?.Level,
      requirements: spell.spell_params?.Criteria || [],
      effects: spell.spell_params?.Effects || [],
      duration: spell.spell_params?.Duration || 0,
      stackingLine: spell.spell_params?.StackingLine,
      attackTime: spell.spell_params?.AttackTime || 1000,
      rechargeTime: spell.spell_params?.RechargeTime || 1000
    }
  }
  
  /**
   * Validate nano requirements for character
   */
  function validateNanoForCharacter(spell: Spell, character: any) {
    if (!character) return null
    
    const nano = convertSpellToNano(spell)
    return nanoCompatibility.validateNanoRequirements(nano, character)
  }
  
  /**
   * Check nano school effectiveness for profession
   */
  function getNanoSchoolEffectiveness(spell: Spell, professionId: number): number {
    const schoolId = spell.spell_params?.School || 0
    return nanoCompatibility.getNanoSchoolEffectiveness(professionId, schoolId)
  }
  
  /**
   * Format spell effects for display
   */
  function formatSpellEffects(spell: Spell): string[] {
    const effects = spell.spell_params?.Effects || []
    return nanoCompatibility.formatNanoEffects(effects)
  }
  
  /**
   * Get nano difficulty rating
   */
  function getSpellDifficulty(spell: Spell): string {
    const nano = convertSpellToNano(spell)
    return nanoCompatibility.getNanoDifficulty(nano)
  }
  
  /**
   * Analyze NCU cost and requirements
   */
  function analyzeNanoCost(spell: Spell, character: any): any {
    if (!character) return null
    
    const nano = convertSpellToNano(spell)
    return {
      ncuCost: nano.ncuCost,
      nanoCost: nanoCompatibility.calculateNanoCost(nano, character),
      initTime: nanoCompatibility.calculateNanoInitTime(nano, character),
      difficulty: nanoCompatibility.getNanoDifficulty(nano)
    }
  }
  
  /**
   * Get spell statistics
   */
  const getStats = computed(() => ({
    totalSpells: spellsCount.value,
    spellsWithCriteria: spellsWithCriteria.value.length,
    uniqueTargets: new Set(allSpells.value.map(s => s.target)).size,
    lastUpdate: new Date(lastFetch.value).toLocaleString(),
    cacheHitRatio: spells.value.size > 0 ? 'Available' : 'No cache'
  }))
  
  // ============================================================================
  // Return
  // ============================================================================
  
  return {
    // State
    spells: readonly(spells),
    loading: readonly(loading),
    error: readonly(error),
    lastFetch: readonly(lastFetch),
    
    // Getters
    allSpells,
    spellsById,
    spellsByTarget,
    spellsWithCriteria,
    spellsCount,
    isDataStale,
    currentSearchQuery,
    currentSearchResults,
    currentPagination,
    getStats,
    
    // Actions
    searchSpells,
    getSpell,
    getSpellsBySpellId,
    getSpellsWithParams,
    analyzeSpellEffects,
    clearSearch,
    clearError,
    clearCache,
    preloadCommonSpells,
    
    // Enhanced nano analysis methods
    convertSpellToNano,
    validateNanoForCharacter,
    getNanoSchoolEffectiveness,
    formatSpellEffects,
    getSpellDifficulty,
    analyzeNanoCost
  }
})
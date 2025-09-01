/**
 * Filters Composable - Advanced filtering functionality for all data types
 * 
 * Provides reusable filtering logic with character compatibility checking
 */

import { ref, computed, watch } from 'vue'
import { useTinkerProfilesStore } from '../stores/tinkerProfiles'
import type { Item, TinkerProfile } from '../types/api'

export interface ItemFilter {
  // Basic filters
  search?: string
  item_class?: number[]
  min_ql?: number
  max_ql?: number
  is_nano?: boolean
  
  // Stat-based filters
  requiredStats?: Array<{
    stat: number
    minValue?: number
    maxValue?: number
    operator?: 'gte' | 'lte' | 'eq'
  }>
  
  // Character compatibility
  checkCompatibility?: boolean
  professionFilter?: string[]
  levelRange?: [number, number]
  
  // Special filters
  hasSpellData?: boolean
  hasActions?: boolean
  hasAttackDefense?: boolean
  favoriteOnly?: boolean
  recentOnly?: boolean
}

export interface SymbiantFilter {
  search?: string
  family?: string[]
  collectedOnly?: boolean
  wishlistOnly?: boolean
  uncollectedOnly?: boolean
}

export interface PocketBossFilter {
  search?: string
  minLevel?: number
  maxLevel?: number
  playfield?: string[]
  hasDrops?: boolean
}

export interface UseFiltersOptions {
  persistFilters?: boolean
  storageKey?: string
}

export function useFilters(options: UseFiltersOptions = {}) {
  const profilesStore = useTinkerProfilesStore()
  
  // ============================================================================
  // Reactive State
  // ============================================================================
  
  const itemFilters = ref<ItemFilter>({})
  const symbiantFilters = ref<SymbiantFilter>({})
  const pocketBossFilters = ref<PocketBossFilter>({})
  
  const activeFilterCount = ref(0)
  
  // ============================================================================
  // Computed Properties
  // ============================================================================
  
  const hasItemFilters = computed(() => {
    const filters = itemFilters.value
    return !!(
      filters.search ||
      filters.item_class?.length ||
      filters.min_ql ||
      filters.max_ql ||
      filters.is_nano !== undefined ||
      filters.requiredStats?.length ||
      filters.checkCompatibility ||
      filters.professionFilter?.length ||
      filters.levelRange ||
      filters.hasSpellData ||
      filters.hasActions ||
      filters.hasAttackDefense ||
      filters.favoriteOnly ||
      filters.recentOnly
    )
  })
  
  const hasSymbiantFilters = computed(() => {
    const filters = symbiantFilters.value
    return !!(
      filters.search ||
      filters.family?.length ||
      filters.collectedOnly ||
      filters.wishlistOnly ||
      filters.uncollectedOnly
    )
  })
  
  const hasPocketBossFilters = computed(() => {
    const filters = pocketBossFilters.value
    return !!(
      filters.search ||
      filters.minLevel ||
      filters.maxLevel ||
      filters.playfield?.length ||
      filters.hasDrops
    )
  })
  
  const hasAnyFilters = computed(() => 
    hasItemFilters.value || hasSymbiantFilters.value || hasPocketBossFilters.value
  )
  
  // Character-based computed properties
  const characterLevel = computed(() => profilesStore.activeProfileLevel)
  const characterProfession = computed(() => profilesStore.activeProfileProfession)
  const hasCharacterProfile = computed(() => profilesStore.hasActiveProfile)
  
  // ============================================================================
  // Item Filtering
  // ============================================================================
  
  function updateItemFilters(updates: Partial<ItemFilter>) {
    itemFilters.value = { ...itemFilters.value, ...updates }
    updateActiveFilterCount()
  }
  
  function clearItemFilters() {
    itemFilters.value = {}
    updateActiveFilterCount()
  }
  
  function setQLRange(min: number, max?: number) {
    updateItemFilters({ min_ql: min, max_ql: max })
  }
  
  function setItemClass(classes: number[]) {
    updateItemFilters({ item_class: classes })
  }
  
  function setNanoFilter(isNano: boolean) {
    updateItemFilters({ is_nano: isNano })
  }
  
  function setCompatibilityCheck(enabled: boolean) {
    updateItemFilters({ checkCompatibility: enabled })
  }
  
  function addStatRequirement(stat: number, minValue?: number, maxValue?: number, operator: 'gte' | 'lte' | 'eq' = 'gte') {
    const current = itemFilters.value.requiredStats || []
    const newRequirement = { stat, minValue, maxValue, operator }
    
    // Remove existing requirement for this stat
    const filtered = current.filter(req => req.stat !== stat)
    updateItemFilters({ requiredStats: [...filtered, newRequirement] })
  }
  
  function removeStatRequirement(stat: number) {
    const current = itemFilters.value.requiredStats || []
    const filtered = current.filter(req => req.stat !== stat)
    updateItemFilters({ requiredStats: filtered })
  }
  
  function setProfessionFilter(professions: string[]) {
    updateItemFilters({ professionFilter: professions })
  }
  
  function setLevelRange(min: number, max: number) {
    updateItemFilters({ levelRange: [min, max] })
  }
  
  function toggleFavoriteOnly() {
    updateItemFilters({ favoriteOnly: !itemFilters.value.favoriteOnly })
  }
  
  // ============================================================================
  // Symbiant Filtering  
  // ============================================================================
  
  function updateSymbiantFilters(updates: Partial<SymbiantFilter>) {
    symbiantFilters.value = { ...symbiantFilters.value, ...updates }
    updateActiveFilterCount()
  }
  
  function clearSymbiantFilters() {
    symbiantFilters.value = {}
    updateActiveFilterCount()
  }
  
  function setSymbiantFamily(families: string[]) {
    updateSymbiantFilters({ family: families })
  }
  
  function toggleCollectedOnly() {
    updateSymbiantFilters({ 
      collectedOnly: !symbiantFilters.value.collectedOnly,
      uncollectedOnly: false // Clear opposite filter
    })
  }
  
  function toggleUncollectedOnly() {
    updateSymbiantFilters({ 
      uncollectedOnly: !symbiantFilters.value.uncollectedOnly,
      collectedOnly: false // Clear opposite filter
    })
  }
  
  function toggleWishlistOnly() {
    updateSymbiantFilters({ wishlistOnly: !symbiantFilters.value.wishlistOnly })
  }
  
  // ============================================================================
  // Pocket Boss Filtering
  // ============================================================================
  
  function updatePocketBossFilters(updates: Partial<PocketBossFilter>) {
    pocketBossFilters.value = { ...pocketBossFilters.value, ...updates }
    updateActiveFilterCount()
  }
  
  function clearPocketBossFilters() {
    pocketBossFilters.value = {}
    updateActiveFilterCount()
  }
  
  function setBossLevelRange(min: number, max: number) {
    updatePocketBossFilters({ minLevel: min, maxLevel: max })
  }
  
  function setPlayfieldFilter(playfields: string[]) {
    updatePocketBossFilters({ playfield: playfields })
  }
  
  function toggleHasDropsFilter() {
    updatePocketBossFilters({ hasDrops: !pocketBossFilters.value.hasDrops })
  }
  
  // ============================================================================
  // Filter Application
  // ============================================================================
  
  function applyItemFilters(items: Item[]): Item[] {
    let filtered = [...items]
    const filters = itemFilters.value
    
    // Search filter
    if (filters.search?.trim()) {
      const searchTerm = filters.search.toLowerCase()
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(searchTerm) ||
        item.description?.toLowerCase().includes(searchTerm)
      )
    }
    
    // Item class filter
    if (filters.item_class?.length) {
      filtered = filtered.filter(item => 
        item.item_class !== undefined && filters.item_class!.includes(item.item_class)
      )
    }
    
    // Quality level filters
    if (filters.min_ql) {
      filtered = filtered.filter(item => (item.ql || 0) >= filters.min_ql!)
    }
    if (filters.max_ql) {
      filtered = filtered.filter(item => (item.ql || 0) <= filters.max_ql!)
    }
    
    // Nano filter
    if (filters.is_nano !== undefined) {
      filtered = filtered.filter(item => item.is_nano === filters.is_nano)
    }
    
    // Stat requirements
    if (filters.requiredStats?.length) {
      filtered = filtered.filter(item => {
        return filters.requiredStats!.every(req => {
          const itemStat = item.stats.find(stat => stat.stat === req.stat)
          if (!itemStat) return false
          
          switch (req.operator) {
            case 'gte':
              return req.minValue ? itemStat.value >= req.minValue : true
            case 'lte':
              return req.maxValue ? itemStat.value <= req.maxValue : true
            case 'eq':
              return req.minValue ? itemStat.value === req.minValue : true
            default:
              return true
          }
        })
      })
    }
    
    // Special filters
    if (filters.hasSpellData) {
      filtered = filtered.filter(item => item.spell_data && item.spell_data.length > 0)
    }
    
    if (filters.hasActions) {
      filtered = filtered.filter(item => item.actions && item.actions.length > 0)
    }
    
    if (filters.hasAttackDefense) {
      filtered = filtered.filter(item => item.attack_defense !== null)
    }
    
    if (filters.favoriteOnly) {
      // TODO: Add favorites to tinkerProfiles store  
      filtered = []
    }
    
    // Character compatibility (simplified)
    if (filters.checkCompatibility && profilesStore.activeProfile) {
      filtered = filtered.filter(item => checkItemCompatibility(item, profilesStore.activeProfile!))
    }
    
    // Profession filter
    if (filters.professionFilter?.length && characterProfession.value) {
      filtered = filtered.filter(item => 
        filters.professionFilter!.includes(characterProfession.value)
      )
    }
    
    // Level range
    if (filters.levelRange && characterLevel.value) {
      const [minLevel, maxLevel] = filters.levelRange
      filtered = filtered.filter(item => {
        const itemQL = item.ql || 1
        return itemQL >= minLevel && itemQL <= maxLevel
      })
    }
    
    return filtered
  }
  
  function checkItemCompatibility(item: Item, profile: TinkerProfile): boolean {
    // Simplified compatibility check
    // In a real implementation, this would check character stats against item requirements
    
    // Check level compatibility (rough estimate: QL = level requirement)
    if (item.ql && profile.Character.Level < item.ql) {
      return false
    }
    
    // Check profession compatibility (would need more game data)
    // For now, assume all items are compatible
    return true
  }
  
  // ============================================================================
  // Quick Filter Presets
  // ============================================================================
  
  function applyHighQLPreset() {
    updateItemFilters({
      min_ql: 200,
      max_ql: undefined
    })
  }
  
  function applyTwinkingPreset() {
    updateItemFilters({
      min_ql: 1,
      max_ql: 50,
      hasSpellData: true
    })
  }
  
  function applyEndgamePreset() {
    updateItemFilters({
      min_ql: 250,
      checkCompatibility: true
    })
  }
  
  function applyProfessionPreset(profession: string) {
    updateItemFilters({
      professionFilter: [profession],
      checkCompatibility: true,
      levelRange: [characterLevel.value - 10, characterLevel.value + 20]
    })
  }
  
  // ============================================================================
  // Filter Persistence
  // ============================================================================
  
  function saveFilters() {
    if (!options.persistFilters) return
    
    const filterData = {
      item: itemFilters.value,
      symbiant: symbiantFilters.value,
      pocketBoss: pocketBossFilters.value,
      timestamp: Date.now()
    }
    
    try {
      const key = options.storageKey || 'tinkertools_filters'
      localStorage.setItem(key, JSON.stringify(filterData))
    } catch (err) {
      console.warn('Failed to save filters:', err)
    }
  }
  
  function loadFilters() {
    if (!options.persistFilters) return
    
    try {
      const key = options.storageKey || 'tinkertools_filters'
      const stored = localStorage.getItem(key)
      
      if (stored) {
        const filterData = JSON.parse(stored)
        
        // Only load if timestamp is recent (within 24 hours)
        if (Date.now() - filterData.timestamp < 24 * 60 * 60 * 1000) {
          itemFilters.value = filterData.item || {}
          symbiantFilters.value = filterData.symbiant || {}
          pocketBossFilters.value = filterData.pocketBoss || {}
          updateActiveFilterCount()
        }
      }
    } catch (err) {
      console.warn('Failed to load filters:', err)
    }
  }
  
  // ============================================================================
  // Utility Functions
  // ============================================================================
  
  function updateActiveFilterCount() {
    let count = 0
    
    // Count item filters
    const itemF = itemFilters.value
    if (itemF.search) count++
    if (itemF.item_class?.length) count++
    if (itemF.min_ql || itemF.max_ql) count++
    if (itemF.is_nano !== undefined) count++
    if (itemF.requiredStats?.length) count += itemF.requiredStats.length
    if (itemF.checkCompatibility) count++
    if (itemF.professionFilter?.length) count++
    if (itemF.levelRange) count++
    if (itemF.hasSpellData) count++
    if (itemF.hasActions) count++
    if (itemF.hasAttackDefense) count++
    if (itemF.favoriteOnly) count++
    
    // Count symbiant filters
    const symbF = symbiantFilters.value
    if (symbF.search) count++
    if (symbF.family?.length) count++
    if (symbF.collectedOnly) count++
    if (symbF.wishlistOnly) count++
    if (symbF.uncollectedOnly) count++
    
    // Count pocket boss filters
    const bossF = pocketBossFilters.value
    if (bossF.search) count++
    if (bossF.minLevel || bossF.maxLevel) count++
    if (bossF.playfield?.length) count++
    if (bossF.hasDrops) count++
    
    activeFilterCount.value = count
  }
  
  function clearAllFilters() {
    itemFilters.value = {}
    symbiantFilters.value = {}
    pocketBossFilters.value = {}
    updateActiveFilterCount()
  }
  
  // ============================================================================
  // Watchers for persistence
  // ============================================================================
  
  if (options.persistFilters) {
    watch([itemFilters, symbiantFilters, pocketBossFilters], saveFilters, { deep: true })
  }
  
  // ============================================================================
  // Return
  // ============================================================================
  
  return {
    // State
    itemFilters: readonly(itemFilters),
    symbiantFilters: readonly(symbiantFilters),
    pocketBossFilters: readonly(pocketBossFilters),
    activeFilterCount: readonly(activeFilterCount),
    
    // Computed
    hasItemFilters,
    hasSymbiantFilters,
    hasPocketBossFilters,
    hasAnyFilters,
    hasCharacterProfile,
    characterLevel,
    characterProfession,
    
    // Item filter actions
    updateItemFilters,
    clearItemFilters,
    setQLRange,
    setItemClass,
    setNanoFilter,
    setCompatibilityCheck,
    addStatRequirement,
    removeStatRequirement,
    setProfessionFilter,
    setLevelRange,
    toggleFavoriteOnly,
    
    // Symbiant filter actions
    updateSymbiantFilters,
    clearSymbiantFilters,
    setSymbiantFamily,
    toggleCollectedOnly,
    toggleUncollectedOnly,
    toggleWishlistOnly,
    
    // Pocket boss filter actions
    updatePocketBossFilters,
    clearPocketBossFilters,
    setBossLevelRange,
    setPlayfieldFilter,
    toggleHasDropsFilter,
    
    // Filter application
    applyItemFilters,
    
    // Quick presets
    applyHighQLPreset,
    applyTwinkingPreset,
    applyEndgamePreset,
    applyProfessionPreset,
    
    // Persistence
    saveFilters,
    loadFilters,
    clearAllFilters
  }
}
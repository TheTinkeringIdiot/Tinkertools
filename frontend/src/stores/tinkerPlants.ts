/**
 * TinkerPlants Store - Pinia Store for Implant Planning
 *
 * Manages implant configuration, lookups, bonus calculations, and requirement analysis
 * Integrates with TinkerProfiles for profile storage and backend /implants/lookup API
 */

import { defineStore } from 'pinia'
import { ref, computed, readonly } from 'vue'
import type {
  Item,
  ImplantSelection,
  ImplantRequirement,
  TreatmentInfo
} from '../types/api'
import { apiClient } from '../services/api-client'
import { useTinkerProfilesStore } from './tinkerProfiles'
import { equipmentBonusCalculator } from '../services/equipment-bonus-calculator'
import { getCriteriaRequirements } from '../services/action-criteria'
import { useToast } from 'primevue/usetoast'
import { skillService } from '../services/skill-service'

// Cache entry for implant lookups
interface CacheEntry {
  item: Item
  timestamp: number
}

// Debounced lookup tracker
interface DebouncedLookup {
  timer: number
  slotBitflag: string
}

/**
 * Parse cluster IDs from implant description
 * Descriptions contain lines like:
 * "Faded NanoCluster: Pistol"
 * "Bright NanoCluster: Sensory Improvement and Modification"
 * "Shining NanoCluster: Aimed Shot"
 *
 * Returns stat IDs for each cluster using skillService to resolve variations
 */
function parseImplantClusters(item: any): { shiny: number | null; bright: number | null; faded: number | null } | null {
  const description = item.description
  if (!description) return null

  const clusters = {
    shiny: null as number | null,
    bright: null as number | null,
    faded: null as number | null
  }

  const failedClusters: string[] = []

  // Parse each cluster line
  const fadedMatch = description.match(/Faded NanoCluster:\s*([^\r\n]+)/i)
  const brightMatch = description.match(/Bright NanoCluster:\s*([^\r\n]+)/i)
  const shinyMatch = description.match(/Shining NanoCluster:\s*([^\r\n]+)/i)

  if (fadedMatch) {
    const rawName = fadedMatch[1].trim()
    if (rawName && rawName !== 'Empty') {
      try {
        // Resolve cluster name to stat ID
        const skillId = skillService.resolveId(rawName)
        clusters.faded = skillId
      } catch (err) {
        console.error(`❌ [CLUSTER LOOKUP FAILED] Faded: "${rawName}"`)
        failedClusters.push(`Faded: "${rawName}"`)
        // Don't set fallback - leave as null
      }
    }
  }

  if (brightMatch) {
    const rawName = brightMatch[1].trim()
    if (rawName && rawName !== 'Empty') {
      try {
        // Resolve cluster name to stat ID
        const skillId = skillService.resolveId(rawName)
        clusters.bright = skillId
      } catch (err) {
        console.error(`❌ [CLUSTER LOOKUP FAILED] Bright: "${rawName}"`)
        failedClusters.push(`Bright: "${rawName}"`)
        // Don't set fallback - leave as null
      }
    }
  }

  if (shinyMatch) {
    const rawName = shinyMatch[1].trim()
    if (rawName && rawName !== 'Empty') {
      try {
        // Resolve cluster name to stat ID
        const skillId = skillService.resolveId(rawName)
        clusters.shiny = skillId
      } catch (err) {
        console.error(`❌ [CLUSTER LOOKUP FAILED] Shiny: "${rawName}"`)
        failedClusters.push(`Shiny: "${rawName}"`)
        // Don't set fallback - leave as null
      }
    }
  }

  // Log summary of failures if any
  if (failedClusters.length > 0) {
    console.error(`❌ [CLUSTER LOOKUP SUMMARY] ${failedClusters.length} cluster(s) failed normalization:`, failedClusters)
  }

  // Return null if all clusters are empty
  if (!clusters.shiny && !clusters.bright && !clusters.faded) {
    return null
  }

  return clusters
}

export const useTinkerPlantsStore = defineStore('tinkerPlants', () => {
  // ============================================================================
  // State
  // ============================================================================

  /**
   * Loading state - true when API operations are in progress
   */
  const loading = ref(false)

  /**
   * Per-slot loading state - tracks which slots are currently fetching data
   */
  const slotLoading = ref<Record<string, boolean>>({})

  /**
   * Error state - populated when operations fail
   */
  const error = ref<string | null>(null)

  /**
   * Current implant configuration (working state)
   * Key: slot bitflag (e.g., "2" for Eyes)
   * Value: ImplantSelection with cluster names, QL, and fetched item
   */
  const currentConfiguration = ref<Record<string, ImplantSelection>>({})

  /**
   * Profile configuration (saved state from profile.Implants)
   * Used for dirty checking and revert functionality
   */
  const profileConfiguration = ref<Record<string, ImplantSelection>>({})

  /**
   * Calculated stat bonuses from current implant configuration
   * Key: stat ID (number)
   * Value: total bonus amount
   */
  const calculatedBonuses = ref<Record<number, number>>({})

  /**
   * Calculated requirements for current implant configuration
   * Includes equipment requirements (Treatment, Attributes) and build requirements (NP, skills)
   */
  const calculatedRequirements = ref<ImplantRequirement[]>([])

  /**
   * Treatment requirement information
   * Contains required treatment, current profile treatment, delta, and sufficiency status
   */
  const treatmentInfo = ref<TreatmentInfo>({
    required: 0,
    current: 0,
    delta: 0,
    sufficient: false
  })

  /**
   * In-memory cache for implant lookups
   * Key: generated from slot + QL + clusters hash
   * Value: cached item data with timestamp
   */
  const lookupCache = ref<Map<string, CacheEntry>>(new Map())

  /**
   * Cache TTL in milliseconds (5 minutes)
   */
  const cacheTTL = 5 * 60 * 1000

  /**
   * Toast service for user notifications
   */
  const toast = useToast()

  /**
   * Debounced lookup timers
   * Tracks pending lookups to avoid rapid-fire API calls on manual changes
   */
  const debouncedLookups = ref<Map<string, DebouncedLookup>>(new Map())

  /**
   * Attribute preference for filtering implant variants
   * Defaults to profile's top attribute
   */
  const attributePreference = ref<string>('Strength')

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Treatment required for current implant configuration
   * Extracted from highest Treatment requirement across all implants
   */
  const treatmentRequired = computed(() => treatmentInfo.value.required)

  /**
   * Unmet requirements for current configuration
   * Returns array of requirements where met === false
   */
  const unmetRequirements = computed(() =>
    calculatedRequirements.value.filter(req => !req.met)
  )

  /**
   * Has unsaved changes
   * True if currentConfiguration differs from profileConfiguration
   */
  const hasChanges = computed(() => {
    const currentKeys = Object.keys(currentConfiguration.value).sort()
    const profileKeys = Object.keys(profileConfiguration.value).sort()

    // Different number of configured slots
    if (currentKeys.length !== profileKeys.length) {
      return true
    }

    // Check if any slot configuration differs
    for (const key of currentKeys) {
      const current = currentConfiguration.value[key]
      const profile = profileConfiguration.value[key]

      if (!profile) {
        return true
      }

      if (
        current.shiny !== profile.shiny ||
        current.bright !== profile.bright ||
        current.faded !== profile.faded ||
        current.ql !== profile.ql
      ) {
        return true
      }
    }

    return false
  })

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Load implant configuration from active profile
   * Populates currentConfiguration and profileConfiguration from profile.Implants
   */
  async function loadFromProfile(): Promise<void> {
    const profilesStore = useTinkerProfilesStore()
    const profile = profilesStore.activeProfile

    if (!profile) {
      error.value = 'No active profile selected'
      toast.add({
        severity: 'error',
        summary: 'No Active Profile',
        detail: 'Please select a profile to use the implant planner',
        life: 3000
      })
      return
    }

    try {
      loading.value = true
      error.value = null

      // Extract implants from profile.Implants (uses bitflag keys)
      const implants = profile.Implants || {}

      console.log('[TinkerPlants] Profile Implants keys:', Object.keys(implants))

      // Convert profile implant data to ImplantSelection format
      const loadedConfiguration: Record<string, ImplantSelection> = {}

      for (const [slotBitflag, implantData] of Object.entries(implants)) {
        if (!implantData || typeof implantData !== 'object') {
          console.log(`[TinkerPlants] Skipping slot ${slotBitflag}: invalid data`)
          continue
        }

        // Profile stores Item objects directly - parse cluster names from description
        if ('id' in implantData && 'name' in implantData && 'description' in implantData) {
          const clusters = parseImplantClusters(implantData)
          console.log(`[TinkerPlants] Slot ${slotBitflag} parsed clusters:`, clusters)
          if (clusters) {
            // ImplantWithClusters extends Item, so cast to unknown first then to Item
            // This is safe because we're only using the Item properties
            const item = implantData as unknown as Item
            loadedConfiguration[slotBitflag] = {
              shiny: clusters.shiny,
              bright: clusters.bright,
              faded: clusters.faded,
              ql: (implantData as any).ql || 200,
              slotBitflag,
              item: item
            }
          } else {
            console.log(`[TinkerPlants] Slot ${slotBitflag}: parser returned null`)
          }
        } else {
          console.log(`[TinkerPlants] Slot ${slotBitflag}: missing Item properties (id, name, description)`)
        }
      }

      currentConfiguration.value = loadedConfiguration
      profileConfiguration.value = JSON.parse(JSON.stringify(loadedConfiguration))

      console.log('[TinkerPlants] Loaded configuration from profile:', Object.keys(loadedConfiguration).length, 'slots')
    } catch (err: any) {
      error.value = err instanceof Error ? err.message : 'Failed to load configuration'
      toast.add({
        severity: 'error',
        summary: 'Failed to Load Configuration',
        detail: 'Could not load implant configuration from profile',
        life: 5000
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Save current implant configuration to active profile
   * Converts currentConfiguration to profile.Implants format and persists to storage
   */
  async function saveToProfile(): Promise<void> {
    const profilesStore = useTinkerProfilesStore()
    const profile = profilesStore.activeProfile

    if (!profile) {
      toast.add({
        severity: 'error',
        summary: 'No Active Profile',
        detail: 'Please select a profile before saving',
        life: 3000
      })
      return
    }

    try {
      loading.value = true
      error.value = null

      // Convert currentConfiguration to profile.Implants format
      const implantsToSave: Record<string, any> = {}

      for (const [slotBitflag, selection] of Object.entries(currentConfiguration.value)) {
        // Only save configured slots that have a fetched item
        if (selection.item) {
          // Store the Item object directly (cluster info is in description)
          implantsToSave[slotBitflag] = selection.item
        }
      }

      // Persist profile to storage using updateProfile with partial update
      await profilesStore.updateProfile(profile.id, {
        Implants: implantsToSave
      })

      // Update profileConfiguration to match currentConfiguration (no longer "dirty")
      profileConfiguration.value = JSON.parse(JSON.stringify(currentConfiguration.value))

      toast.add({
        severity: 'success',
        summary: 'Configuration Saved',
        detail: 'Implant configuration saved to profile',
        life: 3000
      })

      console.log('[TinkerPlants] Saved configuration to profile:', Object.keys(implantsToSave).length, 'slots')
    } catch (err: any) {
      error.value = err instanceof Error ? err.message : 'Failed to save configuration'
      toast.add({
        severity: 'error',
        summary: 'Save Failed',
        detail: error.value,
        life: 5000
      })
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Revert current configuration to last saved profile state
   * Discards unsaved changes and reloads from profileConfiguration
   */
  function revertToProfile(): void {
    currentConfiguration.value = JSON.parse(JSON.stringify(profileConfiguration.value))
    console.log('[TinkerPlants] Reverted to profile configuration')
  }

  /**
   * Update a single implant slot configuration
   * Updates currentConfiguration with new cluster selections or QL
   *
   * @param slotBitflag - Slot bitflag (e.g., "2" for Eyes)
   * @param updates - Partial ImplantSelection updates
   */
  function updateSlot(slotBitflag: string, updates: Partial<ImplantSelection>): void {
    // Get existing configuration for this slot or create new
    const existing = currentConfiguration.value[slotBitflag] || {
      shiny: null,
      bright: null,
      faded: null,
      ql: 200,
      slotBitflag,
      item: null
    }

    // Merge updates
    currentConfiguration.value[slotBitflag] = {
      ...existing,
      ...updates
    }
  }

  /**
   * Generate cache key for implant lookup
   * Key format: implant_${slot}_${ql}_${clustersHash}
   *
   * @param slotBitflag - Slot bitflag
   * @param ql - Quality Level
   * @param clusters - Cluster stat IDs (shiny, bright, faded)
   * @returns Cache key string
   */
  function generateCacheKey(
    slotBitflag: string,
    ql: number,
    clusters: { shiny: number | null; bright: number | null; faded: number | null }
  ): string {
    // Create a simple hash of cluster IDs
    const clusterStr = `${clusters.shiny || ''}_${clusters.bright || ''}_${clusters.faded || ''}`
    return `implant_${slotBitflag}_${ql}_${clusterStr}`
  }

  /**
   * Check cache for implant lookup result
   * Returns cached item if found and not expired
   *
   * @param cacheKey - Cache key from generateCacheKey
   * @returns Cached item or null if not found/expired
   */
  function checkCache(cacheKey: string): Item | null {
    const cached = lookupCache.value.get(cacheKey)
    if (!cached) {
      return null
    }

    // Check if cache entry is still valid (within TTL)
    const age = Date.now() - cached.timestamp
    if (age > cacheTTL) {
      // Cache expired, remove entry
      lookupCache.value.delete(cacheKey)
      return null
    }

    return cached.item
  }

  /**
   * Store item in lookup cache
   *
   * @param cacheKey - Cache key from generateCacheKey
   * @param item - Item to cache
   */
  function cacheItem(cacheKey: string, item: Item): void {
    lookupCache.value.set(cacheKey, {
      item,
      timestamp: Date.now()
    })
  }

  /**
   * Lookup implant for a specific slot
   * Calls /implants/lookup API endpoint with cluster configuration
   * Updates currentConfiguration with returned item data
   *
   * @param slotBitflag - Slot bitflag (e.g., "2" for Eyes)
   */
  async function lookupImplantForSlot(slotBitflag: string): Promise<void> {
    const selection = currentConfiguration.value[slotBitflag]
    if (!selection) {
      console.warn('[TinkerPlants] No selection found for slot:', slotBitflag)
      return
    }

    // Check if slot has any clusters configured
    const hasAnyClusters = selection.shiny !== null || selection.bright !== null || selection.faded !== null

    if (!hasAnyClusters) {
      // Clear item data for empty slots
      selection.item = null
      return
    }

    // Check cache first
    const cacheKey = generateCacheKey(slotBitflag, selection.ql, {
      shiny: selection.shiny,
      bright: selection.bright,
      faded: selection.faded
    })

    const cachedItem = checkCache(cacheKey)
    if (cachedItem) {
      console.log('[TinkerPlants] Cache hit for slot:', slotBitflag)
      selection.item = cachedItem
      return
    }

    // Set per-slot loading state
    slotLoading.value[slotBitflag] = true

    try {
      // Clusters are already stat IDs - use them directly for API request
      // Backend expects capitalized cluster position keys
      const clustersAsStatIds: Record<string, number> = {}

      if (selection.shiny !== null) {
        clustersAsStatIds['Shiny'] = selection.shiny
      }

      if (selection.bright !== null) {
        clustersAsStatIds['Bright'] = selection.bright
      }

      if (selection.faded !== null) {
        clustersAsStatIds['Faded'] = selection.faded
      }

      // Convert slot bitflag to slot number for API
      const slotNumber = parseInt(slotBitflag, 10)

      // Call API
      const response = await apiClient.lookupImplant(slotNumber, selection.ql, clustersAsStatIds)

      if (response.success && response.item) {
        // Cache the result
        cacheItem(cacheKey, response.item)

        // Update configuration with fetched item
        selection.item = response.item

        console.log('[TinkerPlants] Lookup success for slot:', slotBitflag, response.item.name)
      } else {
        // No matching implant found
        toast.add({
          severity: 'info',
          summary: 'No Match Found',
          detail: `No implant found for selected cluster combination in slot ${slotBitflag}`,
          life: 3000
        })
        selection.item = null
      }
    } catch (err: any) {
      console.error('[TinkerPlants] Lookup failed for slot:', slotBitflag, err)

      error.value = err instanceof Error ? err.message : 'Implant lookup failed'

      toast.add({
        severity: 'error',
        summary: 'Lookup Failed',
        detail: `Failed to lookup implant for slot ${slotBitflag}`,
        life: 5000
      })

      selection.item = null
    } finally {
      slotLoading.value[slotBitflag] = false
    }
  }

  /**
   * Debounced implant lookup for manual changes
   * Delays API call by 100ms to avoid rapid-fire requests during dropdown changes
   *
   * @param slotBitflag - Slot bitflag
   */
  function lookupImplantForSlotDebounced(slotBitflag: string): void {
    // Clear existing timer for this slot
    const existing = debouncedLookups.value.get(slotBitflag)
    if (existing) {
      clearTimeout(existing.timer)
    }

    // Set new timer
    const timer = window.setTimeout(() => {
      lookupImplantForSlot(slotBitflag)
      debouncedLookups.value.delete(slotBitflag)
    }, 100)

    debouncedLookups.value.set(slotBitflag, { timer, slotBitflag })
  }

  /**
   * Calculate stat bonuses from current implant configuration
   * Iterates all configured slots and aggregates bonuses using equipmentBonusCalculator
   * Updates calculatedBonuses state
   */
  function calculateBonuses(): void {
    const bonuses: Record<number, number> = {}

    // Iterate all slots in current configuration
    for (const [slotBitflag, selection] of Object.entries(currentConfiguration.value)) {
      // Skip slots without item data
      if (!selection.item) {
        continue
      }

      // Skip empty slots (all clusters null)
      const hasNonEmptyClusters =
        selection.shiny !== null ||
        selection.bright !== null ||
        selection.faded !== null

      if (!hasNonEmptyClusters) {
        continue
      }

      try {
        // Extract bonuses from item using equipment bonus calculator
        const itemBonuses = equipmentBonusCalculator.parseItemSpells(selection.item)

        // Aggregate bonuses
        for (const bonus of itemBonuses) {
          if (bonuses[bonus.statId]) {
            // Stat 355 (WornItem) is a flag field - use bitwise OR
            if (bonus.statId === 355) {
              bonuses[bonus.statId] |= bonus.amount
            } else {
              bonuses[bonus.statId] += bonus.amount
            }
          } else {
            bonuses[bonus.statId] = bonus.amount
          }
        }
      } catch (err) {
        console.error(`[TinkerPlants] Failed to parse bonuses for slot ${slotBitflag}:`, err)
        // Continue processing other slots
      }
    }

    calculatedBonuses.value = bonuses
    console.log('[TinkerPlants] Calculated bonuses:', Object.keys(bonuses).length, 'stats')
  }

  /**
   * Calculate requirements for current implant configuration
   * Analyzes item actions/criteria and compares against active profile skills
   * Updates calculatedRequirements and treatmentInfo state
   */
  function calculateRequirements(): void {
    const profilesStore = useTinkerProfilesStore()
    const profile = profilesStore.activeProfile

    if (!profile) {
      console.warn('[TinkerPlants] No active profile for requirement calculation')
      return
    }

    const requirements: ImplantRequirement[] = []
    let maxTreatmentRequired = 0

    // Iterate all slots in current configuration
    for (const [slotBitflag, selection] of Object.entries(currentConfiguration.value)) {
      // Skip slots without item data
      if (!selection.item) {
        continue
      }

      // Skip empty slots (all clusters null)
      const hasNonEmptyClusters =
        selection.shiny !== null ||
        selection.bright !== null ||
        selection.faded !== null

      if (!hasNonEmptyClusters) {
        continue
      }

      try {
        // Extract requirements from item actions
        const item = selection.item
        if (!item.actions || item.actions.length === 0) {
          continue
        }

        // Process each action's criteria
        for (const action of item.actions) {
          if (!action.criteria) {
            continue
          }

          // Use action-criteria service to parse requirements
          const actionRequirements = getCriteriaRequirements(action.criteria)

          // Convert to ImplantRequirement format with met status
          for (const req of actionRequirements) {
            const statId = req.stat
            const requiredValue = req.exactValue || req.minValue || 0
            const currentValue = profile.skills?.[statId]?.total || 0

            // Track max Treatment requirement (stat 124)
            if (statId === 124 && requiredValue > maxTreatmentRequired) {
              maxTreatmentRequired = requiredValue
            }

            requirements.push({
              stat: statId,
              statName: req.statName,
              required: requiredValue,
              current: currentValue,
              met: currentValue >= requiredValue
            })
          }
        }
      } catch (err) {
        console.error(`[TinkerPlants] Failed to parse requirements for slot ${slotBitflag}:`, err)
        // Continue processing other slots
      }
    }

    // Calculate Treatment info
    const profileTreatment = profile.skills?.[124]?.total || 0
    const delta = maxTreatmentRequired - profileTreatment

    treatmentInfo.value = {
      required: maxTreatmentRequired,
      current: profileTreatment,
      delta: delta > 0 ? delta : 0,
      sufficient: profileTreatment >= maxTreatmentRequired
    }

    calculatedRequirements.value = requirements
    console.log('[TinkerPlants] Calculated requirements:', requirements.length, 'total')
    console.log('[TinkerPlants] Treatment required:', maxTreatmentRequired, 'current:', profileTreatment)
  }

  /**
   * Set attribute preference for implant filtering
   *
   * @param attribute - Attribute name (Agility, Intelligence, Psychic, Sense, Stamina, Strength)
   */
  function setAttributePreference(attribute: string): void {
    attributePreference.value = attribute
    // Note: Client-side filtering not yet implemented in lookupImplantForSlot()
    // Backend may not support attribute filtering yet
  }

  /**
   * Clear error state
   */
  function clearError(): void {
    error.value = null
  }

  /**
   * Clear lookup cache
   * Forces fresh API calls for all subsequent lookups
   */
  function clearCache(): void {
    lookupCache.value.clear()
    console.log('[TinkerPlants] Cache cleared')
  }

  /**
   * Reset store state
   * Clears all configuration, bonuses, requirements, and cache
   */
  function reset(): void {
    currentConfiguration.value = {}
    profileConfiguration.value = {}
    calculatedBonuses.value = {}
    calculatedRequirements.value = []
    treatmentInfo.value = {
      required: 0,
      current: 0,
      delta: 0,
      sufficient: false
    }
    lookupCache.value.clear()
    debouncedLookups.value.clear()
    loading.value = false
    error.value = null
    slotLoading.value = {}
    console.log('[TinkerPlants] Store reset')
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    loading: readonly(loading),
    slotLoading: readonly(slotLoading),
    error: readonly(error),
    currentConfiguration: readonly(currentConfiguration),
    calculatedBonuses: readonly(calculatedBonuses),
    calculatedRequirements: readonly(calculatedRequirements),
    treatmentInfo: readonly(treatmentInfo),
    attributePreference: readonly(attributePreference),

    // Getters
    treatmentRequired,
    unmetRequirements,
    hasChanges,

    // Actions
    loadFromProfile,
    saveToProfile,
    revertToProfile,
    updateSlot,
    lookupImplantForSlot,
    lookupImplantForSlotDebounced,
    calculateBonuses,
    calculateRequirements,
    clearError,
    clearCache,
    reset,
    setAttributePreference
  }
})

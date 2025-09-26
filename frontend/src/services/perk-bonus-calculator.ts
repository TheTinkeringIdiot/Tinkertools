/**
 * Perk Bonus Calculator Service
 *
 * Parses spell_data from perk items to find stat modification spells
 * (spell_id=53045, 53012, 53014, 53175) and aggregates bonuses by skill name.
 * Uses PERK_EVENTS = [1, 14] to handle Cast (1) and Wear (14) events since
 * perks may use different event types than equipment.
 *
 * Features comprehensive error handling and recovery:
 * - Try-catch blocks around all parsing operations
 * - Enhanced input validation with type checking
 * - User-friendly error messages for data issues
 * - Detailed console logging for debugging
 * - Fallback to zero bonuses on parse failure
 * - Continue operation if individual perks fail
 * - Cache corruption detection and recovery
 * - Duplicate perk detection and circular reference protection
 * - Safe aggregation with individual bonus validation
 * - Performance monitoring with bounds checking
 * - LRU caching with error recovery for performance optimization
 */

import type { Item, SpellData, Spell } from '@/types/api'
import { getSkillNameFromStatId } from '@/utils/skill-registry'

// ============================================================================
// Type Definitions
// ============================================================================

export interface PerkStatBonus {
  /** STAT ID from game data */
  statId: number
  /** Human-readable skill name */
  skillName: string
  /** Bonus amount (can be negative) */
  amount: number
  /** Source perk item for debugging */
  perkName?: string
  /** Perk AOID for identification */
  perkAoid?: number
}

export interface PerkBonusError {
  /** Type of error for user display */
  type: 'warning' | 'error'
  /** User-friendly error message */
  message: string
  /** Technical details for debugging */
  details: string
  /** Source perk that caused the error */
  perkName?: string
  /** Perk AOID for identification */
  perkAoid?: number
  /** Whether calculation can continue */
  recoverable: boolean
}

export interface PerkCalculationResult {
  /** Successfully calculated bonuses */
  bonuses: Record<string, number>
  /** Non-fatal warnings */
  warnings: PerkBonusError[]
  /** Fatal errors */
  errors: PerkBonusError[]
  /** Whether calculation completed successfully */
  success: boolean
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Spell IDs that provide stat modifications for perk bonuses
 * Same as equipment but perks may use different event types
 */
export const STAT_BONUS_SPELL_IDS = [
  53045, // "Modify {Stat} by {Amount}" - primary stat bonus spell
  53012, // "Modify {Stat} by {Amount}" - alternative format
  53014, // "Modify {Stat} for {Duration}s by {Amount}" - timed bonus (some perks use this)
  53175  // "Modify {Stat} by {Amount}" - additional stat modifier format
] as const

/**
 * Perk events that provide stat bonuses
 * - 1: Cast (perks may trigger on cast)
 * - 14: Wear (standard wear effect like equipment)
 */
export const PERK_EVENTS = [1, 14] as const

// ============================================================================
// Performance Caching
// ============================================================================

/**
 * Cache for parsed perk spell data to avoid re-parsing the same perks
 * Key: perk AOID (perks don't have quality levels like equipment)
 * Value: PerkStatBonus[] array
 */
class PerkSpellDataCache {
  private cache = new Map<string, PerkStatBonus[]>()
  private maxSize = 500 // Limit cache size to prevent memory issues
  private hitCount = 0
  private missCount = 0

  private getCacheKey(perk: Item): string {
    // Use AOID for perks since they don't have quality levels
    return perk.aoid ? String(perk.aoid) : perk.name || 'unknown'
  }

  get(perk: Item): PerkStatBonus[] | null {
    const key = this.getCacheKey(perk)
    const cached = this.cache.get(key)

    if (cached) {
      this.hitCount++
      return cached
    } else {
      this.missCount++
      return null
    }
  }

  set(perk: Item, bonuses: PerkStatBonus[]): void {
    const key = this.getCacheKey(perk)

    // If cache is full, remove oldest entry (simple LRU)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, bonuses)
  }

  clear(): void {
    this.cache.clear()
    this.hitCount = 0
    this.missCount = 0
  }

  getStats(): { size: number; hitRate: number; hitCount: number; missCount: number } {
    const total = this.hitCount + this.missCount
    return {
      size: this.cache.size,
      hitRate: total > 0 ? (this.hitCount / total) * 100 : 0,
      hitCount: this.hitCount,
      missCount: this.missCount
    }
  }
}

/**
 * Memoization for aggregated perk bonuses calculation
 */
class PerkBonusAggregationCache {
  private cache = new Map<string, Record<string, number>>()
  private maxSize = 100

  private getCacheKey(bonuses: PerkStatBonus[]): string {
    // Create a deterministic key from the bonuses array
    return bonuses
      .map(b => `${b.statId}:${b.amount}`)
      .sort()
      .join('|')
  }

  get(bonuses: PerkStatBonus[]): Record<string, number> | null {
    const key = this.getCacheKey(bonuses)
    return this.cache.get(key) || null
  }

  set(bonuses: PerkStatBonus[], result: Record<string, number>): void {
    const key = this.getCacheKey(bonuses)

    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, result)
  }

  clear(): void {
    this.cache.clear()
  }
}

// ============================================================================
// Perk Bonus Calculator Service
// ============================================================================

export class PerkBonusCalculator {
  private spellCache = new PerkSpellDataCache()
  private bonusCache = new PerkBonusAggregationCache()

  // Performance tracking
  private performanceMetrics = {
    lastCalculationTime: 0,
    averageCalculationTime: 0,
    calculationCount: 0
  }

  /**
   * Calculate perk bonuses for all equipped perks
   * @param perks Array of perk items to analyze
   * @returns Record mapping skill names to total bonus amounts
   */
  calculateBonuses(perks: Item[]): Record<string, number> {
    try {
      const result = this.calculateBonusesWithErrorHandling(perks)

      // Log any warnings or errors for debugging
      if (result.warnings.length > 0) {
        console.warn('Perk bonus calculation warnings:', result.warnings)
      }

      if (result.errors.length > 0) {
        console.error('Perk bonus calculation errors:', result.errors)
        // For backward compatibility, still return bonuses even with errors
      }

      return result.bonuses

    } catch (error) {
      console.error('Critical error in perk bonus calculation:', error)
      // Fallback to empty bonuses to ensure system continues working
      return {}
    }
  }

  /**
   * Calculate perk bonuses with comprehensive error handling
   * @param perks Array of perk items to analyze
   * @returns PerkCalculationResult with bonuses, warnings, and errors
   */
  calculateBonusesWithErrorHandling(perks: Item[]): PerkCalculationResult {
    const startTime = performance.now()
    const result: PerkCalculationResult = {
      bonuses: {},
      warnings: [],
      errors: [],
      success: true
    }

    try {
      // Validate perks array
      if (!perks) {
        result.errors.push({
          type: 'error',
          message: 'Perks data is missing',
          details: 'Perks array is null or undefined',
          recoverable: false
        })
        result.success = false
        return result
      }

      if (!Array.isArray(perks)) {
        result.errors.push({
          type: 'error',
          message: 'Invalid perks data format',
          details: 'Perks data is not an array',
          recoverable: false
        })
        result.success = false
        return result
      }

      const allBonuses: PerkStatBonus[] = []
      const processedPerks = new Set<string>() // Track processed perks to prevent infinite loops

      // Enhanced bounds checking for perks array
      if (perks.length > 1000) {
        result.warnings.push({
          type: 'warning',
          message: 'Unusually large number of perks',
          details: `Processing ${perks.length} perks, which may impact performance`,
          recoverable: true
        })
      }

      // Process each perk with individual error handling
      for (let i = 0; i < perks.length; i++) {
        const perk = perks[i]

        if (!perk) {
          result.warnings.push({
            type: 'warning',
            message: 'Null perk in perks array',
            details: `Perk at index ${i} is null or undefined`,
            recoverable: true
          })
          continue
        }

        // Enhanced validation for perk structure
        if (typeof perk !== 'object') {
          result.warnings.push({
            type: 'warning',
            message: 'Invalid perk data type in array',
            details: `Perk at index ${i} is not an object (type: ${typeof perk})`,
            recoverable: true
          })
          continue
        }

        // Prevent processing the same perk multiple times (circular reference protection)
        const perkId = perk.aoid ? String(perk.aoid) : (perk.name || `index_${i}`)
        if (processedPerks.has(perkId)) {
          result.warnings.push({
            type: 'warning',
            message: 'Duplicate perk detected',
            details: `Perk ${perk.name || 'unknown'} (${perkId}) appears multiple times in the array`,
            perkName: perk.name,
            perkAoid: perk.aoid,
            recoverable: true
          })
          continue
        }
        processedPerks.add(perkId)

        try {
          const perkBonuses = this.parsePerkSpellsWithErrorHandling(perk)

          if (perkBonuses.bonuses.length > 0) {
            // Validate bonuses before adding them
            const validBonuses = perkBonuses.bonuses.filter(bonus => {
              if (!bonus || typeof bonus !== 'object') {
                result.warnings.push({
                  type: 'warning',
                  message: 'Invalid bonus structure from perk',
                  details: `Perk ${perk.name || 'unknown'} returned invalid bonus data`,
                  perkName: perk.name,
                  perkAoid: perk.aoid,
                  recoverable: true
                })
                return false
              }
              return true
            })

            if (validBonuses.length > 0) {
              allBonuses.push(...validBonuses)
            }
          }

          // Collect warnings and errors from perk parsing
          result.warnings.push(...perkBonuses.warnings)
          result.errors.push(...perkBonuses.errors)

        } catch (error) {
          result.warnings.push({
            type: 'warning',
            message: 'Failed to parse perk bonuses',
            details: `Error parsing perk ${perk.name || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
            perkName: perk.name,
            perkAoid: perk.aoid,
            recoverable: true
          })
          // Continue processing other perks - critical for error recovery
        }
      }

      // Aggregate bonuses by skill name with error handling
      try {
        result.bonuses = this.aggregateBonusesOptimized(allBonuses)
      } catch (error) {
        result.errors.push({
          type: 'error',
          message: 'Failed to aggregate perk bonuses',
          details: `Aggregation error: ${error instanceof Error ? error.message : String(error)}`,
          recoverable: false
        })
        result.success = false
        result.bonuses = {} // Fallback to empty bonuses
      }

    } catch (error) {
      result.errors.push({
        type: 'error',
        message: 'Unexpected error during perk bonus calculation',
        details: `Critical error: ${error instanceof Error ? error.message : String(error)}`,
        recoverable: false
      })
      result.success = false
      result.bonuses = {} // Ensure we always return something
    } finally {
      // Track performance metrics
      const endTime = performance.now()
      this.updatePerformanceMetrics(endTime - startTime)
    }

    return result
  }

  /**
   * Parse spell data from a perk item to extract stat bonuses
   * @param perk Perk item with spell_data to parse
   * @returns Array of stat bonuses found in the perk
   */
  parsePerkSpells(perk: Item): PerkStatBonus[] {
    const bonuses: PerkStatBonus[] = []

    if (!perk.spell_data || !Array.isArray(perk.spell_data)) {
      return bonuses
    }

    for (const spellData of perk.spell_data) {
      // Only process perk-related events (Cast=1, Wear=14)
      if (!spellData.event || !PERK_EVENTS.includes(spellData.event as any)) {
        continue
      }

      if (!spellData.spells || !Array.isArray(spellData.spells)) {
        continue
      }

      for (const spell of spellData.spells) {
        const bonus = this.parseSpellForStatBonus(spell, perk.name, perk.aoid)
        if (bonus) {
          bonuses.push(bonus)
        }
      }
    }

    return bonuses
  }

  /**
   * Optimized version of parsePerkSpells with caching and error recovery
   */
  private parsePerkSpellsOptimized(perk: Item): PerkStatBonus[] {
    try {
      // Check cache first with error handling
      const cached = this.spellCache.get(perk)
      if (cached) {
        // Validate cached data before returning
        if (Array.isArray(cached)) {
          return cached
        } else {
          console.warn(`Invalid cached data for perk ${perk.name || 'unknown'}, clearing entire cache`)
          // Clear entire cache to prevent corruption spread
          this.spellCache.clear()
        }
      }
    } catch (error) {
      console.warn(`Cache retrieval error for perk ${perk.name || 'unknown'}:`, error)
      // Continue without cache on error
    }

    // Parse as usual if not cached or cache failed
    const bonuses = this.parsePerkSpells(perk)

    try {
      // Cache the result for future use with error handling
      this.spellCache.set(perk, bonuses)
    } catch (error) {
      console.warn(`Cache storage error for perk ${perk.name || 'unknown'}:`, error)
      // Continue without caching on error
    }

    return bonuses
  }

  /**
   * Parse spell data from a perk with comprehensive error handling
   * @param perk Perk item with spell_data to parse
   * @returns Object with bonuses array and error/warning arrays
   */
  parsePerkSpellsWithErrorHandling(
    perk: Item
  ): { bonuses: PerkStatBonus[]; warnings: PerkBonusError[]; errors: PerkBonusError[] } {
    const result = {
      bonuses: [] as PerkStatBonus[],
      warnings: [] as PerkBonusError[],
      errors: [] as PerkBonusError[]
    }

    try {
      // Validate perk structure
      if (!perk) {
        result.errors.push({
          type: 'error',
          message: 'Perk data is missing',
          details: 'Perk is null or undefined',
          recoverable: true
        })
        return result
      }

      // Enhanced validation of perk data structure
      if (typeof perk !== 'object') {
        result.errors.push({
          type: 'error',
          message: 'Perk data has invalid format',
          details: `Perk is not an object: ${typeof perk}`,
          perkName: (perk as any)?.name,
          perkAoid: (perk as any)?.aoid,
          recoverable: true
        })
        return result
      }

      // Check for spell_data
      if (!perk.spell_data) {
        // This is normal for perks without spell effects, not an error
        return result
      }

      if (!Array.isArray(perk.spell_data)) {
        result.warnings.push({
          type: 'warning',
          message: 'Perk has invalid spell data format',
          details: `spell_data is not an array for perk ${perk.name || 'unknown'} (type: ${typeof perk.spell_data})`,
          perkName: perk.name,
          perkAoid: perk.aoid,
          recoverable: true
        })
        return result
      }

      // Additional safety check for empty or invalid spell_data array
      if (perk.spell_data.length === 0) {
        // Not an error - perk has spell_data array but no spells
        return result
      }

      // Process each spell data entry
      for (let i = 0; i < perk.spell_data.length; i++) {
        const spellData = perk.spell_data[i]

        try {
          // Enhanced null/undefined check for spell data entry
          if (!spellData) {
            result.warnings.push({
              type: 'warning',
              message: 'Spell data entry is missing',
              details: `spell_data[${i}] is null or undefined for perk ${perk.name || 'unknown'}`,
              perkName: perk.name,
              perkAoid: perk.aoid,
              recoverable: true
            })
            continue
          }

          // Enhanced type validation for spell data entry
          if (typeof spellData !== 'object') {
            result.warnings.push({
              type: 'warning',
              message: 'Spell data entry has invalid format',
              details: `spell_data[${i}] is not an object for perk ${perk.name || 'unknown'} (type: ${typeof spellData})`,
              perkName: perk.name,
              perkAoid: perk.aoid,
              recoverable: true
            })
            continue
          }

          // Only process perk-related events (Cast=1, Wear=14)
          if (!spellData.event) {
            // Event missing - not necessarily an error as some spells may not have events
            continue
          }

          // Enhanced event validation with type checking
          if (typeof spellData.event !== 'number' || !PERK_EVENTS.includes(spellData.event as any)) {
            // Log suspicious event IDs for debugging but continue processing
            if (typeof spellData.event === 'number' && spellData.event !== 2) {
              // Only warn about unexpected numeric events (event 2 is equipment wield, expected to be ignored)
              result.warnings.push({
                type: 'warning',
                message: 'Unexpected spell event type for perk',
                details: `spell_data[${i}].event = ${spellData.event} (type: ${typeof spellData.event}) is not a perk event for perk ${perk.name || 'unknown'}`,
                perkName: perk.name,
                perkAoid: perk.aoid,
                recoverable: true
              })
            }
            continue
          }

          if (!spellData.spells) {
            result.warnings.push({
              type: 'warning',
              message: 'Spell data entry missing spells array',
              details: `spell_data[${i}].spells is missing for perk ${perk.name || 'unknown'}`,
              perkName: perk.name,
              perkAoid: perk.aoid,
              recoverable: true
            })
            continue
          }

          if (!Array.isArray(spellData.spells)) {
            result.warnings.push({
              type: 'warning',
              message: 'Spell data entry has invalid spells array',
              details: `spell_data[${i}].spells is not an array for perk ${perk.name || 'unknown'} (type: ${typeof spellData.spells})`,
              perkName: perk.name,
              perkAoid: perk.aoid,
              recoverable: true
            })
            continue
          }

          // Additional safety check for empty spells array
          if (spellData.spells.length === 0) {
            // Not an error - spell data entry has no spells
            continue
          }

          // Process each spell in the spell data
          for (let j = 0; j < spellData.spells.length; j++) {
            const spell = spellData.spells[j]

            try {
              // Enhanced null/undefined check for individual spell
              if (!spell) {
                result.warnings.push({
                  type: 'warning',
                  message: 'Individual spell is missing',
                  details: `spell_data[${i}].spells[${j}] is null or undefined for perk ${perk.name || 'unknown'}`,
                  perkName: perk.name,
                  perkAoid: perk.aoid,
                  recoverable: true
                })
                continue
              }

              // Enhanced type validation for individual spell
              if (typeof spell !== 'object') {
                result.warnings.push({
                  type: 'warning',
                  message: 'Individual spell has invalid format',
                  details: `spell_data[${i}].spells[${j}] is not an object for perk ${perk.name || 'unknown'} (type: ${typeof spell})`,
                  perkName: perk.name,
                  perkAoid: perk.aoid,
                  recoverable: true
                })
                continue
              }

              const bonus = this.parseSpellForStatBonusWithErrorHandling(spell, perk.name, perk.aoid)

              if (bonus.bonus) {
                result.bonuses.push(bonus.bonus)
              }

              result.warnings.push(...bonus.warnings)
              result.errors.push(...bonus.errors)

            } catch (error) {
              result.warnings.push({
                type: 'warning',
                message: 'Failed to parse individual spell',
                details: `Error parsing spell ${j} in spell_data[${i}] for perk ${perk.name || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
                perkName: perk.name,
                perkAoid: perk.aoid,
                recoverable: true
              })
              // Continue processing other spells - critical for error recovery
            }
          }
        } catch (error) {
          result.warnings.push({
            type: 'warning',
            message: 'Failed to process spell data entry',
            details: `Error processing spell_data[${i}] for perk ${perk.name || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
            perkName: perk.name,
            perkAoid: perk.aoid,
            recoverable: true
          })
          // Continue processing other spell data entries
        }
      }
    } catch (error) {
      result.errors.push({
        type: 'error',
        message: 'Critical error parsing perk spells',
        details: `Unexpected error parsing perk ${perk.name || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
        perkName: perk.name,
        perkAoid: perk.aoid,
        recoverable: false
      })
    }

    return result
  }

  /**
   * Parse a single spell to extract stat bonus information
   * @param spell Spell data to parse
   * @param perkName Name of source perk for debugging
   * @param perkAoid AOID of source perk for identification
   * @returns PerkStatBonus if spell modifies stats, null otherwise
   */
  private parseSpellForStatBonus(spell: Spell, perkName?: string, perkAoid?: number): PerkStatBonus | null {
    // Fast path: check spell_id first (most common rejection case)
    if (!spell.spell_id || !STAT_BONUS_SPELL_IDS.includes(spell.spell_id as any)) {
      return null
    }

    // Fast path: check spell_params existence and type
    if (!spell.spell_params || typeof spell.spell_params !== 'object') {
      return null
    }

    // Extract parameters with hot path optimization
    const params = spell.spell_params
    const statValue = params.Stat ?? params.stat ?? params.StatID ?? params.statId
    const amountValue = params.Amount ?? params.amount ?? params.Value ?? params.value

    // Fast numeric conversion
    let statId: number | null = null
    let amount: number | null = null

    if (typeof statValue === 'number') {
      statId = statValue
    } else if (typeof statValue === 'string') {
      const parsed = parseInt(statValue, 10)
      statId = isNaN(parsed) ? null : parsed
    }

    if (typeof amountValue === 'number') {
      amount = amountValue
    } else if (typeof amountValue === 'string') {
      const parsed = parseInt(amountValue, 10)
      amount = isNaN(parsed) ? null : parsed
    }

    if (statId === null || amount === null) {
      return null
    }

    // Convert stat ID to skill name
    const skillName = getSkillNameFromStatId(statId)
    if (!skillName) {
      // Log unknown stat IDs for debugging but don't fail
      console.warn(`Unknown stat ID ${statId} in perk ${perkName}`)
      return null
    }

    return {
      statId,
      skillName,
      amount,
      perkName,
      perkAoid
    }
  }

  /**
   * Parse a single spell with comprehensive error handling
   * @param spell Spell data to parse
   * @param perkName Name of source perk for debugging
   * @param perkAoid AOID of source perk for identification
   * @returns Object with optional bonus and error/warning arrays
   */
  private parseSpellForStatBonusWithErrorHandling(
    spell: Spell,
    perkName?: string,
    perkAoid?: number
  ): { bonus: PerkStatBonus | null; warnings: PerkBonusError[]; errors: PerkBonusError[] } {
    const result = {
      bonus: null as PerkStatBonus | null,
      warnings: [] as PerkBonusError[],
      errors: [] as PerkBonusError[]
    }

    try {
      // Validate spell structure
      if (!spell) {
        result.warnings.push({
          type: 'warning',
          message: 'Spell data is missing',
          details: 'Spell is null or undefined',
          perkName,
          perkAoid,
          recoverable: true
        })
        return result
      }

      // Check if this spell modifies stats
      if (!spell.spell_id) {
        // Not an error - many spells don't have IDs or aren't stat modifiers
        return result
      }

      if (!STAT_BONUS_SPELL_IDS.includes(spell.spell_id as any)) {
        // Not an error - this spell doesn't modify stats
        return result
      }

      // Validate spell parameters
      if (!spell.spell_params) {
        result.warnings.push({
          type: 'warning',
          message: 'Stat modification spell missing parameters',
          details: `Spell ${spell.spell_id} has no parameters in perk ${perkName || 'unknown'}`,
          perkName,
          perkAoid,
          recoverable: true
        })
        return result
      }

      if (typeof spell.spell_params !== 'object') {
        result.warnings.push({
          type: 'warning',
          message: 'Spell parameters have invalid format',
          details: `Spell ${spell.spell_id} parameters are not an object in perk ${perkName || 'unknown'}`,
          perkName,
          perkAoid,
          recoverable: true
        })
        return result
      }

      // Extract and validate parameters using the same logic as parseSpellForStatBonus
      const params = spell.spell_params
      const statValue = params.Stat ?? params.stat ?? params.StatID ?? params.statId
      const amountValue = params.Amount ?? params.amount ?? params.Value ?? params.value

      let statId: number | null = null
      let amount: number | null = null

      // Extract stat ID with error handling
      if (typeof statValue === 'number') {
        if (statValue < 0 || statValue > 1000) {
          result.warnings.push({
            type: 'warning',
            message: 'Suspicious stat ID value',
            details: `Stat ID ${statValue} is outside expected range (0-1000) in perk ${perkName || 'unknown'}`,
            perkName,
            perkAoid,
            recoverable: true
          })
        }
        statId = statValue
      } else if (typeof statValue === 'string') {
        const parsed = parseInt(statValue, 10)
        if (isNaN(parsed)) {
          result.warnings.push({
            type: 'warning',
            message: 'Could not parse stat ID string',
            details: `Unable to parse stat ID "${statValue}" in perk ${perkName || 'unknown'}`,
            perkName,
            perkAoid,
            recoverable: true
          })
        } else {
          if (parsed < 0 || parsed > 1000) {
            result.warnings.push({
              type: 'warning',
              message: 'Suspicious parsed stat ID value',
              details: `Parsed stat ID ${parsed} is outside expected range (0-1000) in perk ${perkName || 'unknown'}`,
              perkName,
              perkAoid,
              recoverable: true
            })
          }
          statId = parsed
        }
      }

      // Extract amount with error handling
      if (typeof amountValue === 'number') {
        if (Math.abs(amountValue) > 10000) {
          result.warnings.push({
            type: 'warning',
            message: 'Large stat bonus amount detected',
            details: `Stat bonus amount ${amountValue} is unusually large in perk ${perkName || 'unknown'}`,
            perkName,
            perkAoid,
            recoverable: true
          })
        }
        amount = amountValue
      } else if (typeof amountValue === 'string') {
        const parsed = parseInt(amountValue, 10)
        if (isNaN(parsed)) {
          result.warnings.push({
            type: 'warning',
            message: 'Could not parse amount string',
            details: `Unable to parse amount "${amountValue}" in perk ${perkName || 'unknown'}`,
            perkName,
            perkAoid,
            recoverable: true
          })
        } else {
          if (Math.abs(parsed) > 10000) {
            result.warnings.push({
              type: 'warning',
              message: 'Large parsed stat bonus amount',
              details: `Parsed amount ${parsed} is unusually large in perk ${perkName || 'unknown'}`,
              perkName,
              perkAoid,
              recoverable: true
            })
          }
          amount = parsed
        }
      }

      if (statId === null || amount === null) {
        if (statId === null && amount === null) {
          result.warnings.push({
            type: 'warning',
            message: 'Spell parameters missing stat ID and amount',
            details: `Spell ${spell.spell_id} in perk ${perkName || 'unknown'} is missing both Stat and Amount parameters`,
            perkName,
            perkAoid,
            recoverable: true
          })
        } else if (statId === null) {
          result.warnings.push({
            type: 'warning',
            message: 'Spell parameters missing stat ID',
            details: `Spell ${spell.spell_id} in perk ${perkName || 'unknown'} is missing Stat parameter`,
            perkName,
            perkAoid,
            recoverable: true
          })
        } else {
          result.warnings.push({
            type: 'warning',
            message: 'Spell parameters missing amount',
            details: `Spell ${spell.spell_id} in perk ${perkName || 'unknown'} is missing Amount parameter`,
            perkName,
            perkAoid,
            recoverable: true
          })
        }
        return result
      }

      // Convert stat ID to skill name
      let skillName: string | null
      try {
        skillName = getSkillNameFromStatId(statId)
        if (!skillName) {
          result.warnings.push({
            type: 'warning',
            message: 'Unknown stat ID in perk bonus',
            details: `Stat ID ${statId} from spell ${spell.spell_id} in perk ${perkName || 'unknown'} does not map to a known skill`,
            perkName,
            perkAoid,
            recoverable: true
          })
          return result
        }
      } catch (error) {
        result.warnings.push({
          type: 'warning',
          message: 'Failed to convert stat ID to skill name',
          details: `Error converting stat ID ${statId} to skill name for spell ${spell.spell_id} in perk ${perkName || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
          perkName,
          perkAoid,
          recoverable: true
        })
        return result
      }

      // Successfully parsed
      result.bonus = {
        statId,
        skillName,
        amount,
        perkName,
        perkAoid
      }

    } catch (error) {
      result.errors.push({
        type: 'error',
        message: 'Critical error parsing spell for stat bonus',
        details: `Unexpected error parsing spell in perk ${perkName || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
        perkName,
        perkAoid,
        recoverable: false
      })
    }

    return result
  }

  /**
   * Aggregate stat bonuses by skill name
   * @param bonuses Array of individual perk stat bonuses
   * @returns Record mapping skill names to total bonus amounts
   */
  aggregateBonuses(bonuses: PerkStatBonus[]): Record<string, number> {
    const aggregated: Record<string, number> = {}

    for (const bonus of bonuses) {
      if (aggregated[bonus.skillName]) {
        aggregated[bonus.skillName] += bonus.amount
      } else {
        aggregated[bonus.skillName] = bonus.amount
      }
    }

    // Filter out zero bonuses to keep the result clean
    const filtered: Record<string, number> = {}
    for (const [skillName, amount] of Object.entries(aggregated)) {
      if (amount !== 0) {
        filtered[skillName] = amount
      }
    }

    return filtered
  }

  /**
   * Optimized version of aggregateBonuses with memoization and error recovery
   */
  private aggregateBonusesOptimized(bonuses: PerkStatBonus[]): Record<string, number> {
    // Early return for empty bonuses
    if (bonuses.length === 0) {
      return {}
    }

    // Enhanced validation of bonuses array
    if (!Array.isArray(bonuses)) {
      console.warn('Invalid bonuses array passed to aggregateBonusesOptimized:', typeof bonuses)
      return {}
    }

    try {
      // Check memoization cache with error handling
      const cached = this.bonusCache.get(bonuses)
      if (cached) {
        // Validate cached data before returning
        if (cached && typeof cached === 'object' && !Array.isArray(cached)) {
          return cached
        } else {
          console.warn('Invalid cached aggregation data, clearing cache')
          this.bonusCache.clear()
        }
      }
    } catch (error) {
      console.warn('Cache retrieval error in aggregateBonusesOptimized:', error)
      // Continue without cache on error
    }

    // Calculate as usual with error handling
    let result: Record<string, number>
    try {
      result = this.aggregateBonuses(bonuses)
    } catch (error) {
      console.error('Error in aggregateBonuses, falling back to safe aggregation:', error)
      // Safe fallback aggregation with individual error handling
      result = this.safeAggregateBonuses(bonuses)
    }

    try {
      // Cache the result with error handling
      this.bonusCache.set(bonuses, result)
    } catch (error) {
      console.warn('Cache storage error in aggregateBonusesOptimized:', error)
      // Continue without caching on error
    }

    return result
  }

  /**
   * Safe aggregation method with individual error handling for each bonus
   */
  private safeAggregateBonuses(bonuses: PerkStatBonus[]): Record<string, number> {
    const aggregated: Record<string, number> = {}

    for (let i = 0; i < bonuses.length; i++) {
      try {
        const bonus = bonuses[i]

        // Validate individual bonus structure
        if (!bonus || typeof bonus !== 'object') {
          console.warn(`Invalid bonus at index ${i}:`, bonus)
          continue
        }

        if (typeof bonus.skillName !== 'string' || bonus.skillName.length === 0) {
          console.warn(`Invalid skillName in bonus at index ${i}:`, bonus.skillName)
          continue
        }

        if (typeof bonus.amount !== 'number' || isNaN(bonus.amount)) {
          console.warn(`Invalid amount in bonus at index ${i}:`, bonus.amount)
          continue
        }

        // Safely aggregate
        if (aggregated[bonus.skillName]) {
          aggregated[bonus.skillName] += bonus.amount
        } else {
          aggregated[bonus.skillName] = bonus.amount
        }

      } catch (error) {
        console.warn(`Error processing bonus at index ${i}:`, error)
        // Continue processing other bonuses
      }
    }

    // Filter out zero bonuses to keep the result clean
    const filtered: Record<string, number> = {}
    for (const [skillName, amount] of Object.entries(aggregated)) {
      if (amount !== 0) {
        filtered[skillName] = amount
      }
    }

    return filtered
  }

  /**
   * Update performance metrics for monitoring
   */
  private updatePerformanceMetrics(calculationTime: number): void {
    this.performanceMetrics.lastCalculationTime = calculationTime
    this.performanceMetrics.calculationCount++

    // Calculate running average
    const { averageCalculationTime, calculationCount } = this.performanceMetrics
    this.performanceMetrics.averageCalculationTime =
      ((averageCalculationTime * (calculationCount - 1)) + calculationTime) / calculationCount
  }

  /**
   * Get performance statistics for debugging
   */
  getPerformanceStats(): {
    lastCalculationTime: number
    averageCalculationTime: number
    calculationCount: number
    cacheStats: ReturnType<PerkSpellDataCache['getStats']>
  } {
    return {
      ...this.performanceMetrics,
      cacheStats: this.spellCache.getStats()
    }
  }

  /**
   * Clear all caches (useful for memory management)
   */
  clearCaches(): void {
    this.spellCache.clear()
    this.bonusCache.clear()
  }
}

// ============================================================================
// Singleton Instance and Utility Functions
// ============================================================================

/** Singleton instance for easy access */
export const perkBonusCalculator = new PerkBonusCalculator()

/**
 * Convenience function to calculate perk bonuses with performance monitoring and enhanced error recovery
 * @param perks Array of perk items to analyze
 * @returns Record mapping skill names to total perk bonuses
 */
export function calculatePerkBonuses(perks: Item[]): Record<string, number> {
  try {
    // Enhanced input validation
    if (!perks) {
      console.warn('calculatePerkBonuses called with null/undefined perks')
      return {}
    }

    if (!Array.isArray(perks)) {
      console.warn('calculatePerkBonuses called with non-array perks:', typeof perks)
      return {}
    }

    const startTime = performance.now()
    const result = perkBonusCalculator.calculateBonuses(perks)
    const endTime = performance.now()

    // Enhanced result validation
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      console.warn('calculatePerkBonuses received invalid result from calculator:', typeof result)
      return {}
    }

    // Warn if calculation takes longer than 200ms (performance requirement for perks)
    const calculationTime = endTime - startTime
    if (calculationTime > 200) {
      console.warn(`Perk bonus calculation exceeded 200ms threshold: ${calculationTime.toFixed(2)}ms for ${perks.length} perks`)

      // Log performance stats for debugging
      try {
        const stats = perkBonusCalculator.getPerformanceStats()
        console.warn('Performance stats:', stats)
      } catch (statsError) {
        console.warn('Failed to retrieve performance stats:', statsError)
      }
    }

    return result
  } catch (error) {
    console.error('Critical error in calculatePerkBonuses convenience function:', error)
    // Return empty object to ensure system continues working
    return {}
  }
}

/**
 * Convenience function to calculate perk bonuses with full error reporting
 * @param perks Array of perk items to analyze
 * @returns PerkCalculationResult with bonuses, warnings, and errors
 */
export function calculatePerkBonusesWithErrors(perks: Item[]): PerkCalculationResult {
  try {
    return perkBonusCalculator.calculateBonusesWithErrorHandling(perks)
  } catch (error) {
    return {
      bonuses: {},
      warnings: [],
      errors: [{
        type: 'error',
        message: 'Critical error in perk bonus calculation',
        details: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        recoverable: false
      }],
      success: false
    }
  }
}

/**
 * Convenience function to parse a single perk item for stat bonuses with enhanced error recovery
 * @param perk Perk item to analyze
 * @returns Array of stat bonuses found in the perk
 */
export function parseItemForStatBonuses(perk: Item): PerkStatBonus[] {
  try {
    // Enhanced input validation
    if (!perk) {
      console.warn('parseItemForStatBonuses called with null/undefined perk')
      return []
    }

    if (typeof perk !== 'object') {
      console.warn('parseItemForStatBonuses called with non-object perk:', typeof perk)
      return []
    }

    const result = perkBonusCalculator.parsePerkSpells(perk)

    // Enhanced result validation
    if (!Array.isArray(result)) {
      console.warn('parseItemForStatBonuses received invalid result from calculator:', typeof result)
      return []
    }

    return result
  } catch (error) {
    console.error('Critical error in parseItemForStatBonuses convenience function:', error)
    // Return empty array to ensure system continues working
    return []
  }
}

/**
 * Convenience function to parse a perk item with full error reporting
 * @param perk Perk item to analyze
 * @returns Object with bonuses array and error/warning arrays
 */
export function parseItemForStatBonusesWithErrors(
  perk: Item
): { bonuses: PerkStatBonus[]; warnings: PerkBonusError[]; errors: PerkBonusError[] } {
  try {
    return perkBonusCalculator.parsePerkSpellsWithErrorHandling(perk)
  } catch (error) {
    return {
      bonuses: [],
      warnings: [],
      errors: [{
        type: 'error',
        message: 'Critical error parsing perk spells',
        details: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        perkName: perk?.name,
        perkAoid: perk?.aoid,
        recoverable: false
      }]
    }
  }
}
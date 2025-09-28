/**
 * Nano Bonus Calculator Service
 *
 * Parses spell_params from nano items to find stat modification spells
 * (spell_id=53045, 53012, 53014, 53175) and aggregates bonuses by skill name.
 * This service is specifically designed for nano programs (is_nano=true items)
 * and differs from equipment calculator by handling nano-specific events and caching.
 *
 * Features comprehensive error handling and performance optimization:
 * - Try-catch blocks around all parsing operations
 * - Enhanced input validation with nano-specific checks
 * - User-friendly error messages for data issues
 * - Detailed console logging for debugging
 * - Fallback to zero bonuses on parse failure
 * - Continue operation if individual nano items fail
 * - Performance monitoring with sub-50ms requirement
 * - LRU caching optimized for nano items
 */

import type { Item, SpellData, Spell } from '@/types/api'

// ============================================================================
// Type Definitions
// ============================================================================

export interface NanoStatBonus {
  /** STAT ID from game data */
  statId: number
  /** Bonus amount (can be negative) */
  amount: number
  /** Source nano item for debugging */
  nanoName?: string
  /** Nano AOID for identification */
  nanoAoid?: number
  /** Nano quality level */
  nanoQl?: number
}

export interface NanoBonusError {
  /** Type of error for user display */
  type: 'warning' | 'error'
  /** User-friendly error message */
  message: string
  /** Technical details for debugging */
  details: string
  /** Source nano that caused the error */
  nanoName?: string
  /** Nano AOID for identification */
  nanoAoid?: number
  /** Whether calculation can continue */
  recoverable: boolean
}

export interface NanoCalculationResult {
  /** Successfully calculated bonuses */
  bonuses: Record<number, number>
  /** Non-fatal warnings */
  warnings: NanoBonusError[]
  /** Fatal errors */
  errors: NanoBonusError[]
  /** Whether calculation completed successfully */
  success: boolean
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Spell IDs that provide stat modifications for nano bonuses
 * Based on nano-programs-research.docs.md and existing spell analysis
 */
export const STAT_BONUS_SPELL_IDS = [
  53045, // "Modify {Stat} by {Amount}" - primary stat bonus spell for skills
  53012, // "Modify {Stat} by {Amount}" - alternative skill format
  53014, // "Modify {Stat} for {Duration}s by {Amount}" - timed skill bonus
  53175  // "Modify {Stat} by {Amount}" - ability stat modifier format
] as const


// ============================================================================
// Performance Caching
// ============================================================================

/**
 * Cache for parsed nano spell data to avoid re-parsing the same nano programs
 * Key: `${nano.aoid}-${nano.ql}` or nano.name as fallback
 * Value: NanoStatBonus[] array
 */
class NanoSpellDataCache {
  private cache = new Map<string, NanoStatBonus[]>()
  private maxSize = 200 // Smaller cache than equipment since nanos are less varied
  private hitCount = 0
  private missCount = 0

  private getCacheKey(nano: Item): string {
    // Use AOID and QL for nano programs - both are important for nano identification
    return nano.aoid && nano.ql ? `${nano.aoid}-${nano.ql}` : nano.name || 'unknown'
  }

  get(nano: Item): NanoStatBonus[] | null {
    const key = this.getCacheKey(nano)
    const cached = this.cache.get(key)

    if (cached) {
      this.hitCount++
      return cached
    } else {
      this.missCount++
      return null
    }
  }

  set(nano: Item, bonuses: NanoStatBonus[]): void {
    const key = this.getCacheKey(nano)

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
 * Memoization for aggregated nano bonuses calculation
 */
class NanoBonusAggregationCache {
  private cache = new Map<string, Record<number, number>>()
  private maxSize = 50 // Smaller since nano combinations are more limited

  private getCacheKey(bonuses: NanoStatBonus[]): string {
    // Create a deterministic key from the bonuses array
    return bonuses
      .map(b => `${b.statId}:${b.amount}`)
      .sort()
      .join('|')
  }

  get(bonuses: NanoStatBonus[]): Record<number, number> | null {
    const key = this.getCacheKey(bonuses)
    return this.cache.get(key) || null
  }

  set(bonuses: NanoStatBonus[], result: Record<number, number>): void {
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
// Nano Bonus Calculator Service
// ============================================================================

export class NanoBonusCalculator {
  private spellCache = new NanoSpellDataCache()
  private bonusCache = new NanoBonusAggregationCache()

  // Performance tracking - nano calculations must be under 50ms per requirement
  private performanceMetrics = {
    lastCalculationTime: 0,
    averageCalculationTime: 0,
    calculationCount: 0
  }

  /**
   * Calculate nano bonuses for all active buff nano items
   * @param nanos Array of nano items (buffs) to analyze
   * @returns Record mapping skill IDs to total bonus amounts
   */
  calculateBonuses(nanos: Item[]): Record<number, number> {
    try {
      const result = this.calculateBonusesWithErrorHandling(nanos)

      // Log any warnings or errors for debugging
      if (result.warnings.length > 0) {
        console.warn('Nano bonus calculation warnings:', result.warnings)
      }

      if (result.errors.length > 0) {
        console.error('Nano bonus calculation errors:', result.errors)
        // For backward compatibility, still return bonuses even with errors
      }

      return result.bonuses

    } catch (error) {
      console.error('Critical error in nano bonus calculation:', error)
      // Fallback to empty bonuses to ensure system continues working
      return {}
    }
  }

  /**
   * Calculate nano bonuses with comprehensive error handling
   * @param nanos Array of nano items to analyze
   * @returns NanoCalculationResult with bonuses, warnings, and errors
   */
  calculateBonusesWithErrorHandling(nanos: Item[]): NanoCalculationResult {
    const startTime = performance.now()
    const result: NanoCalculationResult = {
      bonuses: {},
      warnings: [],
      errors: [],
      success: true
    }

    try {
      // Validate nanos array
      if (!nanos) {
        result.errors.push({
          type: 'error',
          message: 'Nano buffs data is missing',
          details: 'Nano buffs array is null or undefined',
          recoverable: false
        })
        result.success = false
        return result
      }

      if (!Array.isArray(nanos)) {
        result.errors.push({
          type: 'error',
          message: 'Invalid nano buffs data format',
          details: 'Nano buffs data is not an array',
          recoverable: false
        })
        result.success = false
        return result
      }

      const allBonuses: NanoStatBonus[] = []
      const processedNanos = new Set<string>() // Track processed nanos to prevent duplicates

      // Enhanced bounds checking for nanos array
      if (nanos.length > 100) {
        result.warnings.push({
          type: 'warning',
          message: 'Unusually large number of nano buffs',
          details: `Processing ${nanos.length} nano buffs, which exceeds typical NCU capacity`,
          recoverable: true
        })
      }

      // Process each nano with individual error handling
      for (let i = 0; i < nanos.length; i++) {
        const nano = nanos[i]

        if (!nano) {
          result.warnings.push({
            type: 'warning',
            message: 'Null nano in buffs array',
            details: `Nano at index ${i} is null or undefined`,
            recoverable: true
          })
          continue
        }

        // Enhanced validation for nano structure
        if (typeof nano !== 'object') {
          result.warnings.push({
            type: 'warning',
            message: 'Invalid nano data type in array',
            details: `Nano at index ${i} is not an object (type: ${typeof nano})`,
            recoverable: true
          })
          continue
        }

        // Validate that this is actually a nano program
        if (!nano.is_nano) {
          result.warnings.push({
            type: 'warning',
            message: 'Non-nano item in nano buffs array',
            details: `Item ${nano.name || 'unknown'} at index ${i} is not a nano program (is_nano=${nano.is_nano})`,
            nanoName: nano.name,
            nanoAoid: nano.aoid,
            recoverable: true
          })
          continue
        }

        // Prevent processing the same nano multiple times
        const nanoId = nano.aoid && nano.ql ? `${nano.aoid}-${nano.ql}` : (nano.name || `index_${i}`)
        if (processedNanos.has(nanoId)) {
          result.warnings.push({
            type: 'warning',
            message: 'Duplicate nano buff detected',
            details: `Nano ${nano.name || 'unknown'} (${nanoId}) appears multiple times in the buffs array`,
            nanoName: nano.name,
            nanoAoid: nano.aoid,
            recoverable: true
          })
          continue
        }
        processedNanos.add(nanoId)

        try {
          const nanoBonuses = this.parseNanoSpellsWithErrorHandling(nano)

          if (nanoBonuses.bonuses.length > 0) {
            // Validate bonuses before adding them
            const validBonuses = nanoBonuses.bonuses.filter(bonus => {
              if (!bonus || typeof bonus !== 'object') {
                result.warnings.push({
                  type: 'warning',
                  message: 'Invalid bonus structure from nano',
                  details: `Nano ${nano.name || 'unknown'} returned invalid bonus data`,
                  nanoName: nano.name,
                  nanoAoid: nano.aoid,
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

          // Collect warnings and errors from nano parsing
          result.warnings.push(...nanoBonuses.warnings)
          result.errors.push(...nanoBonuses.errors)

        } catch (error) {
          result.warnings.push({
            type: 'warning',
            message: 'Failed to parse nano bonuses',
            details: `Error parsing nano ${nano.name || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
            nanoName: nano.name,
            nanoAoid: nano.aoid,
            recoverable: true
          })
          // Continue processing other nanos
        }
      }

      // Aggregate bonuses by skill name with error handling
      try {
        result.bonuses = this.aggregateBonusesOptimized(allBonuses)
      } catch (error) {
        result.errors.push({
          type: 'error',
          message: 'Failed to aggregate nano bonuses',
          details: `Aggregation error: ${error instanceof Error ? error.message : String(error)}`,
          recoverable: false
        })
        result.success = false
        result.bonuses = {} // Fallback to empty bonuses
      }

    } catch (error) {
      result.errors.push({
        type: 'error',
        message: 'Unexpected error during nano bonus calculation',
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
   * Parse spell data from a nano item to extract stat bonuses
   * @param nano Nano item with spell_data to parse
   * @returns Array of stat bonuses found in the nano
   */
  parseNanoSpells(nano: Item): NanoStatBonus[] {
    const bonuses: NanoStatBonus[] = []

    if (!nano.spell_data || !Array.isArray(nano.spell_data)) {
      return bonuses
    }

    for (const spellData of nano.spell_data) {
      // Only process nano-related events (Cast=1, Wear=14)
      if (!spellData.event || !NANO_EVENTS.includes(spellData.event as any)) {
        continue
      }

      if (!spellData.spells || !Array.isArray(spellData.spells)) {
        continue
      }

      for (const spell of spellData.spells) {
        const bonus = this.parseSpellForStatBonus(spell, nano.name, nano.aoid, nano.ql)
        if (bonus) {
          bonuses.push(bonus)
        }
      }
    }

    return bonuses
  }

  /**
   * Optimized version of parseNanoSpells with caching
   */
  private parseNanoSpellsOptimized(nano: Item): NanoStatBonus[] {
    // Check cache first
    const cached = this.spellCache.get(nano)
    if (cached) {
      return cached
    }

    // Parse as usual if not cached
    const bonuses = this.parseNanoSpells(nano)

    // Cache the result for future use
    this.spellCache.set(nano, bonuses)

    return bonuses
  }

  /**
   * Parse spell data from a nano with comprehensive error handling
   * @param nano Nano item with spell_data to parse
   * @returns Object with bonuses array and error/warning arrays
   */
  parseNanoSpellsWithErrorHandling(
    nano: Item
  ): { bonuses: NanoStatBonus[]; warnings: NanoBonusError[]; errors: NanoBonusError[] } {
    const result = {
      bonuses: [] as NanoStatBonus[],
      warnings: [] as NanoBonusError[],
      errors: [] as NanoBonusError[]
    }

    try {
      // Validate nano structure
      if (!nano) {
        result.errors.push({
          type: 'error',
          message: 'Nano data is missing',
          details: 'Nano is null or undefined',
          recoverable: true
        })
        return result
      }

      // Enhanced validation of nano data structure
      if (typeof nano !== 'object') {
        result.errors.push({
          type: 'error',
          message: 'Nano data has invalid format',
          details: `Nano is not an object: ${typeof nano}`,
          nanoName: (nano as any)?.name,
          nanoAoid: (nano as any)?.aoid,
          recoverable: true
        })
        return result
      }

      // Check for spell_data
      if (!nano.spell_data) {
        // This is normal for nanos without spell effects, not an error
        return result
      }

      if (!Array.isArray(nano.spell_data)) {
        result.warnings.push({
          type: 'warning',
          message: 'Nano has invalid spell data format',
          details: `spell_data is not an array for nano ${nano.name || 'unknown'} (type: ${typeof nano.spell_data})`,
          nanoName: nano.name,
          nanoAoid: nano.aoid,
          recoverable: true
        })
        return result
      }

      // Process each spell data entry
      for (let i = 0; i < nano.spell_data.length; i++) {
        const spellData = nano.spell_data[i]

        try {
          if (!spellData || typeof spellData !== 'object') {
            result.warnings.push({
              type: 'warning',
              message: 'Spell data entry is invalid',
              details: `spell_data[${i}] is ${spellData === null ? 'null' : typeof spellData} for nano ${nano.name || 'unknown'}`,
              nanoName: nano.name,
              nanoAoid: nano.aoid,
              recoverable: true
            })
            continue
          }

          if (!spellData.spells || !Array.isArray(spellData.spells)) {
            result.warnings.push({
              type: 'warning',
              message: 'Spell data entry missing spells array',
              details: `spell_data[${i}].spells is ${spellData.spells === null ? 'null' : typeof spellData.spells} for nano ${nano.name || 'unknown'}`,
              nanoName: nano.name,
              nanoAoid: nano.aoid,
              recoverable: true
            })
            continue
          }

          // Process each spell in the spell data
          for (let j = 0; j < spellData.spells.length; j++) {
            const spell = spellData.spells[j]

            try {
              if (!spell || typeof spell !== 'object') {
                result.warnings.push({
                  type: 'warning',
                  message: 'Individual spell is invalid',
                  details: `spell_data[${i}].spells[${j}] is ${spell === null ? 'null' : typeof spell} for nano ${nano.name || 'unknown'}`,
                  nanoName: nano.name,
                  nanoAoid: nano.aoid,
                  recoverable: true
                })
                continue
              }

              const bonus = this.parseSpellForStatBonusWithErrorHandling(spell, nano.name, nano.aoid)

              if (bonus.bonus) {
                result.bonuses.push(bonus.bonus)
              }

              result.warnings.push(...bonus.warnings)
              result.errors.push(...bonus.errors)

            } catch (error) {
              result.warnings.push({
                type: 'warning',
                message: 'Failed to parse individual spell',
                details: `Error parsing spell ${j} in spell_data[${i}] for nano ${nano.name || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
                nanoName: nano.name,
                nanoAoid: nano.aoid,
                recoverable: true
              })
              // Continue processing other spells
            }
          }
        } catch (error) {
          result.warnings.push({
            type: 'warning',
            message: 'Failed to process spell data entry',
            details: `Error processing spell_data[${i}] for nano ${nano.name || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
            nanoName: nano.name,
            nanoAoid: nano.aoid,
            recoverable: true
          })
          // Continue processing other spell data entries
        }
      }
    } catch (error) {
      result.errors.push({
        type: 'error',
        message: 'Critical error parsing nano spells',
        details: `Unexpected error parsing nano ${nano.name || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
        nanoName: nano.name,
        nanoAoid: nano.aoid,
        recoverable: false
      })
    }

    return result
  }

  /**
   * Parse a single spell to extract stat bonus information
   * @param spell Spell data to parse
   * @param nanoName Name of source nano for debugging
   * @param nanoAoid AOID of source nano for identification
   * @param nanoQl Quality level of source nano
   * @returns NanoStatBonus if spell modifies stats, null otherwise
   */
  private parseSpellForStatBonus(
    spell: Spell,
    nanoName?: string,
    nanoAoid?: number,
    nanoQl?: number
  ): NanoStatBonus | null {
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

    // No need to validate stat ID - preserve all nano bonuses for aggregation
    // The caller can filter based on valid skill IDs if needed
    return {
      statId,
      amount,
      nanoName,
      nanoAoid,
      nanoQl
    }
  }

  /**
   * Parse a single spell with comprehensive error handling
   * @param spell Spell data to parse
   * @param nanoName Name of source nano for debugging
   * @param nanoAoid AOID of source nano for identification
   * @returns Object with optional bonus and error/warning arrays
   */
  private parseSpellForStatBonusWithErrorHandling(
    spell: Spell,
    nanoName?: string,
    nanoAoid?: number
  ): { bonus: NanoStatBonus | null; warnings: NanoBonusError[]; errors: NanoBonusError[] } {
    const result = {
      bonus: null as NanoStatBonus | null,
      warnings: [] as NanoBonusError[],
      errors: [] as NanoBonusError[]
    }

    try {
      // Validate spell structure
      if (!spell) {
        result.warnings.push({
          type: 'warning',
          message: 'Spell data is missing',
          details: 'Spell is null or undefined',
          nanoName,
          nanoAoid,
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
          details: `Spell ${spell.spell_id} has no parameters in nano ${nanoName || 'unknown'}`,
          nanoName,
          nanoAoid,
          recoverable: true
        })
        return result
      }

      if (typeof spell.spell_params !== 'object') {
        result.warnings.push({
          type: 'warning',
          message: 'Spell parameters have invalid format',
          details: `Spell ${spell.spell_id} parameters are not an object in nano ${nanoName || 'unknown'}`,
          nanoName,
          nanoAoid,
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
            details: `Stat ID ${statValue} is outside expected range (0-1000) in nano ${nanoName || 'unknown'}`,
            nanoName,
            nanoAoid,
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
            details: `Unable to parse stat ID "${statValue}" in nano ${nanoName || 'unknown'}`,
            nanoName,
            nanoAoid,
            recoverable: true
          })
        } else {
          if (parsed < 0 || parsed > 1000) {
            result.warnings.push({
              type: 'warning',
              message: 'Suspicious parsed stat ID value',
              details: `Parsed stat ID ${parsed} is outside expected range (0-1000) in nano ${nanoName || 'unknown'}`,
              nanoName,
              nanoAoid,
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
            details: `Stat bonus amount ${amountValue} is unusually large in nano ${nanoName || 'unknown'}`,
            nanoName,
            nanoAoid,
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
            details: `Unable to parse amount "${amountValue}" in nano ${nanoName || 'unknown'}`,
            nanoName,
            nanoAoid,
            recoverable: true
          })
        } else {
          if (Math.abs(parsed) > 10000) {
            result.warnings.push({
              type: 'warning',
              message: 'Large parsed stat bonus amount',
              details: `Parsed amount ${parsed} is unusually large in nano ${nanoName || 'unknown'}`,
              nanoName,
              nanoAoid,
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
            details: `Spell ${spell.spell_id} in nano ${nanoName || 'unknown'} is missing both Stat and Amount parameters`,
            nanoName,
            nanoAoid,
            recoverable: true
          })
        } else if (statId === null) {
          result.warnings.push({
            type: 'warning',
            message: 'Spell parameters missing stat ID',
            details: `Spell ${spell.spell_id} in nano ${nanoName || 'unknown'} is missing Stat parameter`,
            nanoName,
            nanoAoid,
            recoverable: true
          })
        } else {
          result.warnings.push({
            type: 'warning',
            message: 'Spell parameters missing amount',
            details: `Spell ${spell.spell_id} in nano ${nanoName || 'unknown'} is missing Amount parameter`,
            nanoName,
            nanoAoid,
            recoverable: true
          })
        }
        return result
      }

      // Successfully parsed - no need to validate stat ID
      // The caller can filter based on valid skill IDs if needed
      result.bonus = {
        statId,
        amount,
        nanoName,
        nanoAoid
      }

    } catch (error) {
      result.errors.push({
        type: 'error',
        message: 'Critical error parsing spell for stat bonus',
        details: `Unexpected error parsing spell in nano ${nanoName || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
        nanoName,
        nanoAoid,
        recoverable: false
      })
    }

    return result
  }

  /**
   * Aggregate stat bonuses by skill ID
   * @param bonuses Array of individual nano stat bonuses
   * @returns Record mapping skill IDs to total bonus amounts
   */
  aggregateBonuses(bonuses: NanoStatBonus[]): Record<number, number> {
    const aggregated: Record<number, number> = {}

    for (const bonus of bonuses) {
      if (aggregated[bonus.statId]) {
        aggregated[bonus.statId] += bonus.amount
      } else {
        aggregated[bonus.statId] = bonus.amount
      }
    }

    // Filter out zero bonuses to keep the result clean
    const filtered: Record<number, number> = {}
    for (const [statId, amount] of Object.entries(aggregated)) {
      const numericStatId = parseInt(statId, 10)
      if (amount !== 0) {
        filtered[numericStatId] = amount
      }
    }

    return filtered
  }

  /**
   * Optimized version of aggregateBonuses with memoization
   */
  private aggregateBonusesOptimized(bonuses: NanoStatBonus[]): Record<number, number> {
    // Early return for empty bonuses
    if (bonuses.length === 0) {
      return {}
    }

    // Check memoization cache
    const cached = this.bonusCache.get(bonuses)
    if (cached) {
      return cached
    }

    // Calculate as usual
    const result = this.aggregateBonuses(bonuses)

    // Cache the result
    this.bonusCache.set(bonuses, result)

    return result
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
    cacheStats: ReturnType<NanoSpellDataCache['getStats']>
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
export const nanoBonusCalculator = new NanoBonusCalculator()

/**
 * Convenience function to calculate nano bonuses with performance monitoring
 * @param nanos Array of nano items (buffs) to analyze
 * @returns Record mapping skill IDs to total nano bonuses
 */
export function calculateNanoBonuses(nanos: Item[]): Record<number, number> {
  try {
    const startTime = performance.now()
    const result = nanoBonusCalculator.calculateBonuses(nanos)
    const endTime = performance.now()

    // Warn if calculation takes longer than 50ms (nano performance requirement)
    const calculationTime = endTime - startTime
    if (calculationTime > 50) {
      console.warn(`Nano bonus calculation exceeded 50ms threshold: ${calculationTime.toFixed(2)}ms`)

      // Log performance stats for debugging
      const stats = nanoBonusCalculator.getPerformanceStats()
      console.warn('Nano performance stats:', stats)
    }

    return result
  } catch (error) {
    console.error('Error in calculateNanoBonuses convenience function:', error)
    return {}
  }
}

/**
 * Convenience function to calculate nano bonuses with full error reporting
 * @param nanos Array of nano items to analyze
 * @returns NanoCalculationResult with bonuses, warnings, and errors
 */
export function calculateNanoBonusesWithErrors(nanos: Item[]): NanoCalculationResult {
  try {
    return nanoBonusCalculator.calculateBonusesWithErrorHandling(nanos)
  } catch (error) {
    return {
      bonuses: {},
      warnings: [],
      errors: [{
        type: 'error',
        message: 'Critical error in nano bonus calculation',
        details: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        recoverable: false
      }],
      success: false
    }
  }
}

/**
 * Convenience function to parse nano spells for stat bonuses
 * @param nano Nano item to analyze
 * @returns Array of stat bonuses found in the nano
 */
export function parseNanoForStatBonuses(nano: Item): NanoStatBonus[] {
  try {
    return nanoBonusCalculator.parseNanoSpells(nano)
  } catch (error) {
    console.error('Error in parseNanoForStatBonuses convenience function:', error)
    return []
  }
}

/**
 * Convenience function to parse nano spells with full error reporting
 * @param nano Nano item to analyze
 * @returns Object with bonuses array and error/warning arrays
 */
export function parseNanoForStatBonusesWithErrors(
  nano: Item
): { bonuses: NanoStatBonus[]; warnings: NanoBonusError[]; errors: NanoBonusError[] } {
  try {
    return nanoBonusCalculator.parseNanoSpellsWithErrorHandling(nano)
  } catch (error) {
    return {
      bonuses: [],
      warnings: [],
      errors: [{
        type: 'error',
        message: 'Critical error parsing nano spells',
        details: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        nanoName: nano?.name,
        nanoAoid: nano?.aoid,
        recoverable: false
      }]
    }
  }
}
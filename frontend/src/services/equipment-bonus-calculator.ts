/**
 * Equipment Bonus Calculator Service
 *
 * Parses spell_data from equipped items to find stat modification spells
 * (spell_id=53045, 53012, 53014, 53175) and aggregates bonuses by STAT ID
 * across all 45 equipment slots.
 *
 * Features comprehensive error handling:
 * - Try-catch blocks around spell parsing
 * - User-friendly error messages for data issues
 * - Detailed console logging for debugging
 * - Fallback to zero bonuses on parse failure
 * - Continue operation if individual items fail
 */

import type { TinkerProfile } from '@/lib/tinkerprofiles/types'
import type { Item, SpellData, Spell } from '@/types/api'
import { skillService } from './skill-service'

// ============================================================================
// Type Definitions
// ============================================================================

export interface StatBonus {
  /** STAT ID from game data */
  statId: number
  /** Bonus amount (can be negative) */
  amount: number
  /** Source item for debugging */
  itemName?: string
}

export interface EquipmentBonusError {
  /** Type of error for user display */
  type: 'warning' | 'error'
  /** User-friendly error message */
  message: string
  /** Technical details for debugging */
  details: string
  /** Source item that caused the error */
  itemName?: string
  /** Slot where the error occurred */
  slotName?: string
  /** Whether calculation can continue */
  recoverable: boolean
}

export interface CalculationResult {
  /** Successfully calculated bonuses */
  bonuses: Record<number, number>
  /** Non-fatal warnings */
  warnings: EquipmentBonusError[]
  /** Fatal errors */
  errors: EquipmentBonusError[]
  /** Whether calculation completed successfully */
  success: boolean
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Spell IDs that provide stat modifications for equipment bonuses
 * Based on research in spell-system.docs.md and existing codebase
 */
export const STAT_BONUS_SPELL_IDS = [
  53045, // "Modify {Stat} by {Amount}" - primary stat bonus spell
  53012, // "Modify {Stat} by {Amount}" - alternative format
  53014, // "Modify {Stat} for {Duration}s by {Amount}" - timed bonus (some equipment uses this)
  53175  // "Modify {Stat} by {Amount}" - additional stat modifier format
] as const

/**
 * Equipment events that provide stat bonuses
 * - 14: Wear (armor/jewelry effects)
 * - 2: Wield (weapon effects)
 */
export const EQUIPMENT_EVENTS = [14, 2] as const

// ============================================================================
// Performance Caching
// ============================================================================

/**
 * Cache for parsed spell data to avoid re-parsing the same items
 * Key: `${item.aoid}-${item.ql}` or item.name as fallback
 * Value: StatBonus[] array
 */
class SpellDataCache {
  private cache = new Map<string, StatBonus[]>()
  private maxSize = 500 // Limit cache size to prevent memory issues
  private hitCount = 0
  private missCount = 0

  private getCacheKey(item: Item): string {
    // Use AOID and QL if available for precise caching, fallback to name
    return item.aoid && item.ql ? `${item.aoid}-${item.ql}` : item.name || 'unknown'
  }

  get(item: Item): StatBonus[] | null {
    const key = this.getCacheKey(item)
    const cached = this.cache.get(key)

    if (cached) {
      this.hitCount++
      return cached
    } else {
      this.missCount++
      return null
    }
  }

  set(item: Item, bonuses: StatBonus[]): void {
    const key = this.getCacheKey(item)

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
 * Memoization for aggregated bonuses calculation
 */
class BonusAggregationCache {
  private cache = new Map<string, Record<number, number>>()
  private maxSize = 100

  private getCacheKey(bonuses: StatBonus[]): string {
    // Create a deterministic key from the bonuses array
    return bonuses
      .map(b => `${b.statId}:${b.amount}`)
      .sort()
      .join('|')
  }

  get(bonuses: StatBonus[]): Record<number, number> | null {
    const key = this.getCacheKey(bonuses)
    return this.cache.get(key) || null
  }

  set(bonuses: StatBonus[], result: Record<number, number>): void {
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
// Equipment Bonus Calculator Service
// ============================================================================

export class EquipmentBonusCalculator {
  private spellCache = new SpellDataCache()
  private bonusCache = new BonusAggregationCache()

  // Performance tracking
  private performanceMetrics = {
    lastCalculationTime: 0,
    averageCalculationTime: 0,
    calculationCount: 0
  }
  /**
   * Calculate equipment bonuses for all equipped items in a profile
   * @param profile TinkerProfile containing equipped items
   * @returns Record mapping skill IDs to total bonus amounts
   */
  calculateBonuses(profile: TinkerProfile): Record<number, number> {
    try {
      const result = this.calculateBonusesWithErrorHandling(profile)

      // Log any warnings or errors for debugging
      if (result.warnings.length > 0) {
        console.warn('Equipment bonus calculation warnings:', result.warnings)
      }

      if (result.errors.length > 0) {
        console.error('Equipment bonus calculation errors:', result.errors)
        // For backward compatibility, still return bonuses even with errors
      }

      return result.bonuses

    } catch (error) {
      console.error('Critical error in equipment bonus calculation:', error)
      // Fallback to empty bonuses to ensure system continues working
      return {}
    }
  }

  /**
   * Calculate equipment bonuses with comprehensive error handling
   * @param profile TinkerProfile containing equipped items
   * @returns CalculationResult with bonuses, warnings, and errors
   */
  calculateBonusesWithErrorHandling(profile: TinkerProfile): CalculationResult {
    const startTime = performance.now()
    const result: CalculationResult = {
      bonuses: {},
      warnings: [],
      errors: [],
      success: true
    }

    try {
      // Validate profile structure
      if (!profile) {
        result.errors.push({
          type: 'error',
          message: 'Profile data is missing',
          details: 'TinkerProfile object is null or undefined',
          recoverable: false
        })
        result.success = false
        return result
      }

      const allBonuses: StatBonus[] = []

      // Process all equipment slots with individual error handling
      this.processEquipmentSlotsWithErrorHandling(profile.Weapons, 'Weapons', allBonuses, result)
      this.processEquipmentSlotsWithErrorHandling(profile.Clothing, 'Clothing', allBonuses, result)
      this.processEquipmentSlotsWithErrorHandling(profile.Implants, 'Implants', allBonuses, result)
      this.processEquipmentSlotsWithErrorHandling(profile.HUD, 'HUD', allBonuses, result)

      // Aggregate bonuses by skill ID with error handling
      try {
        result.bonuses = this.aggregateBonusesOptimized(allBonuses)
      } catch (error) {
        result.errors.push({
          type: 'error',
          message: 'Failed to aggregate stat bonuses',
          details: `Aggregation error: ${error instanceof Error ? error.message : String(error)}`,
          recoverable: false
        })
        result.success = false
        result.bonuses = {} // Fallback to empty bonuses
      }

    } catch (error) {
      result.errors.push({
        type: 'error',
        message: 'Unexpected error during bonus calculation',
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
   * Process equipment slots to extract stat bonuses
   * @param equipmentSlots Record of slot name to item
   * @param bonuses Array to accumulate bonuses
   */
  private processEquipmentSlots(
    equipmentSlots: Record<string, Item | null>,
    bonuses: StatBonus[]
  ): void {
    for (const [slotName, item] of Object.entries(equipmentSlots)) {
      if (item) {
        const itemBonuses = this.parseItemSpells(item)
        bonuses.push(...itemBonuses)
      }
    }
  }

  /**
   * Optimized version of processEquipmentSlots with caching
   */
  private processEquipmentSlotsOptimized(
    equipmentSlots: Record<string, Item | null>,
    bonuses: StatBonus[]
  ): void {
    // Filter out null items first to avoid unnecessary iterations
    const validItems = Object.values(equipmentSlots).filter((item): item is Item => item !== null)

    // Batch process items for better performance
    for (const item of validItems) {
      const itemBonuses = this.parseItemSpellsOptimized(item)
      if (itemBonuses.length > 0) {
        bonuses.push(...itemBonuses)
      }
    }
  }

  /**
   * Process equipment slots with comprehensive error handling
   * @param equipmentSlots Record of slot name to item
   * @param categoryName Category name for error reporting
   * @param bonuses Array to accumulate bonuses
   * @param result Result object to accumulate errors and warnings
   */
  private processEquipmentSlotsWithErrorHandling(
    equipmentSlots: Record<string, Item | null> | undefined,
    categoryName: string,
    bonuses: StatBonus[],
    result: CalculationResult
  ): void {
    // Empty equipment slots are valid - only warn if structure is invalid
    if (!equipmentSlots) {
      return
    }

    try {
      for (const [slotName, item] of Object.entries(equipmentSlots)) {
        if (item) {
          try {
            const itemBonuses = this.parseItemSpellsWithErrorHandling(item, slotName)

            if (itemBonuses.bonuses.length > 0) {
              bonuses.push(...itemBonuses.bonuses)
            }

            // Collect warnings and errors from item parsing
            result.warnings.push(...itemBonuses.warnings)
            result.errors.push(...itemBonuses.errors)

          } catch (error) {
            result.warnings.push({
              type: 'warning',
              message: `Failed to parse equipment bonuses`,
              details: `Error parsing item ${item.name || 'unknown'} in slot ${slotName}: ${error instanceof Error ? error.message : String(error)}`,
              itemName: item.name,
              slotName,
              recoverable: true
            })
            // Continue processing other items
          }
        }
      }
    } catch (error) {
      result.errors.push({
        type: 'error',
        message: `Failed to process ${categoryName} equipment`,
        details: `Error processing ${categoryName}: ${error instanceof Error ? error.message : String(error)}`,
        recoverable: false
      })
    }
  }

  /**
   * Parse spell data from an item to extract stat bonuses
   * @param item Item with spell_data to parse
   * @returns Array of stat bonuses found in the item
   */
  parseItemSpells(item: Item): StatBonus[] {
    const bonuses: StatBonus[] = []

    if (!item.spell_data || !Array.isArray(item.spell_data)) {
      return bonuses
    }

    for (const spellData of item.spell_data) {
      // Only process equipment-related events (Wear=14, Wield=2)
      if (!spellData.event || !EQUIPMENT_EVENTS.includes(spellData.event as any)) {
        continue
      }

      if (!spellData.spells || !Array.isArray(spellData.spells)) {
        continue
      }

      for (const spell of spellData.spells) {
        const bonus = this.parseSpellForStatBonus(spell, item.name)
        if (bonus) {
          bonuses.push(bonus)
        }
      }
    }

    return bonuses
  }

  /**
   * Optimized version of parseItemSpells with caching
   */
  private parseItemSpellsOptimized(item: Item): StatBonus[] {
    // Check cache first
    const cached = this.spellCache.get(item)
    if (cached) {
      return cached
    }

    // Parse as usual if not cached
    const bonuses = this.parseItemSpells(item)

    // Cache the result for future use
    this.spellCache.set(item, bonuses)

    return bonuses
  }

  /**
   * Parse spell data from an item with comprehensive error handling
   * @param item Item with spell_data to parse
   * @param slotName Slot name for error reporting
   * @returns Object with bonuses array and error/warning arrays
   */
  parseItemSpellsWithErrorHandling(
    item: Item,
    slotName: string
  ): { bonuses: StatBonus[]; warnings: EquipmentBonusError[]; errors: EquipmentBonusError[] } {
    const result = {
      bonuses: [] as StatBonus[],
      warnings: [] as EquipmentBonusError[],
      errors: [] as EquipmentBonusError[]
    }

    try {
      // Validate item structure
      if (!item) {
        result.errors.push({
          type: 'error',
          message: 'Item data is missing',
          details: 'Item is null or undefined',
          slotName,
          recoverable: true
        })
        return result
      }

      // Check for spell_data
      if (!item.spell_data) {
        // This is normal for items without spell effects, not an error
        return result
      }

      if (!Array.isArray(item.spell_data)) {
        result.warnings.push({
          type: 'warning',
          message: 'Item has invalid spell data format',
          details: `spell_data is not an array for item ${item.name || 'unknown'}`,
          itemName: item.name,
          slotName,
          recoverable: true
        })
        return result
      }

      // Process each spell data entry
      for (let i = 0; i < item.spell_data.length; i++) {
        const spellData = item.spell_data[i]

        try {
          // Only process equipment-related events (Wear=14, Wield=2)
          if (!spellData || !spellData.event || !EQUIPMENT_EVENTS.includes(spellData.event as any)) {
            continue
          }

          if (!spellData.spells || !Array.isArray(spellData.spells)) {
            result.warnings.push({
              type: 'warning',
              message: 'Spell data entry has invalid spells array',
              details: `spell_data[${i}].spells is not an array for item ${item.name || 'unknown'}`,
              itemName: item.name,
              slotName,
              recoverable: true
            })
            continue
          }

          // Process each spell in the spell data
          for (let j = 0; j < spellData.spells.length; j++) {
            const spell = spellData.spells[j]

            try {
              const bonus = this.parseSpellForStatBonusWithErrorHandling(spell, item.name, slotName)

              if (bonus.bonus) {
                result.bonuses.push(bonus.bonus)
              }

              result.warnings.push(...bonus.warnings)
              result.errors.push(...bonus.errors)

            } catch (error) {
              result.warnings.push({
                type: 'warning',
                message: 'Failed to parse individual spell',
                details: `Error parsing spell ${j} in spell_data[${i}] for item ${item.name || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
                itemName: item.name,
                slotName,
                recoverable: true
              })
              // Continue processing other spells
            }
          }
        } catch (error) {
          result.warnings.push({
            type: 'warning',
            message: 'Failed to process spell data entry',
            details: `Error processing spell_data[${i}] for item ${item.name || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
            itemName: item.name,
            slotName,
            recoverable: true
          })
          // Continue processing other spell data entries
        }
      }
    } catch (error) {
      result.errors.push({
        type: 'error',
        message: 'Critical error parsing item spells',
        details: `Unexpected error parsing item ${item.name || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
        itemName: item.name,
        slotName,
        recoverable: false
      })
    }

    return result
  }

  /**
   * Parse a single spell to extract stat bonus information
   * @param spell Spell data to parse
   * @param itemName Name of source item for debugging
   * @returns StatBonus if spell modifies stats, null otherwise
   */
  private parseSpellForStatBonus(spell: Spell, itemName?: string): StatBonus | null {
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

    // Validate that the stat ID is a known skill
    try {
      skillService.validateId(statId)
    } catch {
      // Log unknown stat IDs for debugging but don't fail
      console.warn(`Unknown stat ID ${statId} in item ${itemName}`)
      return null
    }

    return {
      statId,
      amount,
      itemName
    }
  }

  /**
   * Parse a single spell with comprehensive error handling
   * @param spell Spell data to parse
   * @param itemName Name of source item for debugging
   * @param slotName Slot name for error reporting
   * @returns Object with optional bonus and error/warning arrays
   */
  private parseSpellForStatBonusWithErrorHandling(
    spell: Spell,
    itemName?: string,
    slotName?: string
  ): { bonus: StatBonus | null; warnings: EquipmentBonusError[]; errors: EquipmentBonusError[] } {
    const result = {
      bonus: null as StatBonus | null,
      warnings: [] as EquipmentBonusError[],
      errors: [] as EquipmentBonusError[]
    }

    try {
      // Validate spell structure
      if (!spell) {
        result.warnings.push({
          type: 'warning',
          message: 'Spell data is missing',
          details: 'Spell is null or undefined',
          itemName,
          slotName,
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
          details: `Spell ${spell.spell_id} has no parameters in item ${itemName || 'unknown'}`,
          itemName,
          slotName,
          recoverable: true
        })
        return result
      }

      if (typeof spell.spell_params !== 'object') {
        result.warnings.push({
          type: 'warning',
          message: 'Spell parameters have invalid format',
          details: `Spell ${spell.spell_id} parameters are not an object in item ${itemName || 'unknown'}`,
          itemName,
          slotName,
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
            details: `Stat ID ${statValue} is outside expected range (0-1000) in item ${itemName || 'unknown'}`,
            itemName,
            slotName,
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
            details: `Unable to parse stat ID "${statValue}" in item ${itemName || 'unknown'}`,
            itemName,
            slotName,
            recoverable: true
          })
        } else {
          if (parsed < 0 || parsed > 1000) {
            result.warnings.push({
              type: 'warning',
              message: 'Suspicious parsed stat ID value',
              details: `Parsed stat ID ${parsed} is outside expected range (0-1000) in item ${itemName || 'unknown'}`,
              itemName,
              slotName,
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
            details: `Stat bonus amount ${amountValue} is unusually large in item ${itemName || 'unknown'}`,
            itemName,
            slotName,
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
            details: `Unable to parse amount "${amountValue}" in item ${itemName || 'unknown'}`,
            itemName,
            slotName,
            recoverable: true
          })
        } else {
          if (Math.abs(parsed) > 10000) {
            result.warnings.push({
              type: 'warning',
              message: 'Large parsed stat bonus amount',
              details: `Parsed amount ${parsed} is unusually large in item ${itemName || 'unknown'}`,
              itemName,
              slotName,
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
            details: `Spell ${spell.spell_id} in item ${itemName || 'unknown'} is missing both Stat and Amount parameters`,
            itemName,
            slotName,
            recoverable: true
          })
        } else if (statId === null) {
          result.warnings.push({
            type: 'warning',
            message: 'Spell parameters missing stat ID',
            details: `Spell ${spell.spell_id} in item ${itemName || 'unknown'} is missing Stat parameter`,
            itemName,
            slotName,
            recoverable: true
          })
        } else {
          result.warnings.push({
            type: 'warning',
            message: 'Spell parameters missing amount',
            details: `Spell ${spell.spell_id} in item ${itemName || 'unknown'} is missing Amount parameter`,
            itemName,
            slotName,
            recoverable: true
          })
        }
        return result
      }

      // Validate that the stat ID is a known skill
      try {
        if (!skillService.validateId(statId)) {
          result.warnings.push({
            type: 'warning',
            message: 'Unknown stat ID in equipment bonus',
            details: `Stat ID ${statId} from spell ${spell.spell_id} in item ${itemName || 'unknown'} does not map to a known skill`,
            itemName,
            slotName,
            recoverable: true
          })
          return result
        }
      } catch (error) {
        result.warnings.push({
          type: 'warning',
          message: 'Failed to validate stat ID',
          details: `Error validating stat ID ${statId} for spell ${spell.spell_id} in item ${itemName || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
          itemName,
          slotName,
          recoverable: true
        })
        return result
      }

      // Successfully parsed
      result.bonus = {
        statId,
        amount,
        itemName
      }

    } catch (error) {
      result.errors.push({
        type: 'error',
        message: 'Critical error parsing spell for stat bonus',
        details: `Unexpected error parsing spell in item ${itemName || 'unknown'}: ${error instanceof Error ? error.message : String(error)}`,
        itemName,
        slotName,
        recoverable: false
      })
    }

    return result
  }

  // Note: extractStatId and extractAmount methods were removed and inlined into parseSpellForStatBonus for performance

  /**
   * Aggregate stat bonuses by skill ID
   * @param bonuses Array of individual stat bonuses
   * @returns Record mapping skill IDs to total bonus amounts
   */
  aggregateBonuses(bonuses: StatBonus[]): Record<number, number> {
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
  private aggregateBonusesOptimized(bonuses: StatBonus[]): Record<number, number> {
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
    cacheStats: ReturnType<SpellDataCache['getStats']>
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
export const equipmentBonusCalculator = new EquipmentBonusCalculator()

/**
 * Convenience function to calculate equipment bonuses for a profile with performance monitoring
 * @param profile TinkerProfile to analyze
 * @returns Record mapping skill IDs to total equipment bonuses
 */
export function calculateEquipmentBonuses(profile: TinkerProfile): Record<number, number> {
  try {
    const startTime = performance.now()
    const result = equipmentBonusCalculator.calculateBonuses(profile)
    const endTime = performance.now()

    // Warn if calculation takes longer than 100ms (NFR-1 requirement)
    const calculationTime = endTime - startTime
    if (calculationTime > 100) {
      console.warn(`Equipment bonus calculation exceeded 100ms threshold: ${calculationTime.toFixed(2)}ms`)

      // Log performance stats for debugging
      const stats = equipmentBonusCalculator.getPerformanceStats()
      console.warn('Performance stats:', stats)
    }

    return result
  } catch (error) {
    console.error('Error in calculateEquipmentBonuses convenience function:', error)
    return {}
  }
}

/**
 * Convenience function to calculate equipment bonuses with full error reporting
 * @param profile TinkerProfile to analyze
 * @returns CalculationResult with bonuses, warnings, and errors
 */
export function calculateEquipmentBonusesWithErrors(profile: TinkerProfile): CalculationResult {
  try {
    return equipmentBonusCalculator.calculateBonusesWithErrorHandling(profile)
  } catch (error) {
    return {
      bonuses: {},
      warnings: [],
      errors: [{
        type: 'error',
        message: 'Critical error in equipment bonus calculation',
        details: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        recoverable: false
      }],
      success: false
    }
  }
}

/**
 * Convenience function to parse item spells for stat bonuses
 * @param item Item to analyze
 * @returns Array of stat bonuses found in the item
 */
export function parseItemForStatBonuses(item: Item): StatBonus[] {
  try {
    return equipmentBonusCalculator.parseItemSpells(item)
  } catch (error) {
    console.error('Error in parseItemForStatBonuses convenience function:', error)
    return []
  }
}

/**
 * Convenience function to parse item spells with full error reporting
 * @param item Item to analyze
 * @param slotName Optional slot name for error reporting
 * @returns Object with bonuses array and error/warning arrays
 */
export function parseItemForStatBonusesWithErrors(
  item: Item,
  slotName?: string
): { bonuses: StatBonus[]; warnings: EquipmentBonusError[]; errors: EquipmentBonusError[] } {
  try {
    return equipmentBonusCalculator.parseItemSpellsWithErrorHandling(item, slotName || 'unknown')
  } catch (error) {
    return {
      bonuses: [],
      warnings: [],
      errors: [{
        type: 'error',
        message: 'Critical error parsing item spells',
        details: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        itemName: item?.name,
        slotName,
        recoverable: false
      }]
    }
  }
}
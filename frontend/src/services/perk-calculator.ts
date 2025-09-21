/**
 * Perk Calculator Service
 *
 * Provides point calculations and effect aggregation for the three perk systems:
 * - SL Perks: Cost standard perk points (earned through leveling)
 * - AI Perks: Cost AI perk points (earned through alien levels)
 * - LE Research: Free to assign (no point cost, only requirements)
 *
 * Features comprehensive caching and validation following the equipment bonus calculator pattern.
 */

import type { TinkerProfile } from '@/lib/tinkerprofiles/types'
import type {
  PerkEntry,
  ResearchEntry,
  PerkValidationResult,
  PerkEffect,
  PerkEffectSummary,
  PerkCharacterData,
  PerkPointCalculation,
  PerkPurchaseTransaction,
  PerkInfo,
  AnyPerkEntry
} from '@/lib/tinkerprofiles/perk-types'
import { getSkillName } from '@/lib/tinkerprofiles/skill-mappings'

// ============================================================================
// Type Definitions
// ============================================================================

export interface PerkCalculationError {
  /** Type of error for user display */
  type: 'warning' | 'error'
  /** User-friendly error message */
  message: string
  /** Technical details for debugging */
  details: string
  /** Source perk that caused the error */
  perkName?: string
  /** Whether calculation can continue */
  recoverable: boolean
}

export interface PerkCalculationResult {
  /** Successfully calculated effects */
  effects: PerkEffectSummary
  /** Non-fatal warnings */
  warnings: PerkCalculationError[]
  /** Fatal errors */
  errors: PerkCalculationError[]
  /** Whether calculation completed successfully */
  success: boolean
}

export interface PointValidationResult {
  /** Whether the purchase is valid */
  valid: boolean
  /** Available points of each type */
  availablePoints: {
    standard: number
    ai: number
  }
  /** Points required for the purchase */
  requiredPoints: {
    standard: number
    ai: number
  }
  /** Error messages if invalid */
  errors: string[]
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Spell IDs that provide stat modifications for perk effects
 * Based on existing spell system patterns and database research
 */
export const PERK_EFFECT_SPELL_IDS = [
  53045, // "Modify {Stat} by {Amount}" - primary stat bonus spell
  53012, // "Modify {Stat} by {Amount}" - alternative format
  53014, // "Modify {Stat} for {Duration}s by {Amount}" - timed bonus
  53175, // "Modify {Stat} by {Amount}" - additional stat modifier format
  53234, // "Reset all perks" - special perk-related spell
  53187  // "Lock perk {PerkID} for {Duration}s" - perk interaction
] as const

/**
 * Perk activation events
 * - 1: Cast (for active perk abilities)
 * - 14: Wear (for passive perk effects)
 */
export const PERK_EVENTS = [1, 14] as const

// ============================================================================
// Performance Caching
// ============================================================================

/**
 * Cache for perk effect calculations to avoid re-parsing the same spell data
 */
class PerkEffectCache {
  private cache = new Map<string, PerkEffect[]>()
  private maxSize = 1000 // Larger cache for perks since they don't change often
  private hitCount = 0
  private missCount = 0

  private getCacheKey(perkAoid: number): string {
    return `perk_${perkAoid}`
  }

  get(perkAoid: number): PerkEffect[] | null {
    const key = this.getCacheKey(perkAoid)
    const cached = this.cache.get(key)

    if (cached) {
      this.hitCount++
      return cached
    } else {
      this.missCount++
      return null
    }
  }

  set(perkAoid: number, effects: PerkEffect[]): void {
    const key = this.getCacheKey(perkAoid)

    // If cache is full, remove oldest entry (simple LRU)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }

    this.cache.set(key, effects)
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
 * Cache for point calculations
 */
class PointCalculationCache {
  private cache = new Map<string, number>()
  private maxSize = 500

  private getStandardPointsKey(level: number): string {
    return `standard_${level}`
  }

  private getAIPointsKey(alienLevel: number): string {
    return `ai_${alienLevel}`
  }

  getStandardPoints(level: number): number | null {
    const key = this.getStandardPointsKey(level)
    return this.cache.get(key) ?? null
  }

  setStandardPoints(level: number, points: number): void {
    const key = this.getStandardPointsKey(level)
    this.cache.set(key, points)
  }

  getAIPoints(alienLevel: number): number | null {
    const key = this.getAIPointsKey(alienLevel)
    return this.cache.get(key) ?? null
  }

  setAIPoints(alienLevel: number, points: number): void {
    const key = this.getAIPointsKey(alienLevel)
    this.cache.set(key, points)
  }

  clear(): void {
    this.cache.clear()
  }
}

// ============================================================================
// Perk Calculator Service
// ============================================================================

export class PerkCalculatorService {
  private effectCache = new PerkEffectCache()
  private pointCache = new PointCalculationCache()

  // Performance tracking
  private performanceMetrics = {
    lastCalculationTime: 0,
    averageCalculationTime: 0,
    calculationCount: 0
  }

  /**
   * Calculate standard perk points based on character level
   * @param level Character level (1-220)
   * @returns Standard perk points available
   */
  calculateStandardPerkPoints(level: number): number {
    if (level < 10) return 0

    // Check cache first
    const cached = this.pointCache.getStandardPoints(level)
    if (cached !== null) {
      return cached
    }

    // 1 point every 10 levels up to level 200 (20 points)
    const pointsUpTo200 = Math.min(Math.floor(level / 10), 20)

    // 1 point per level from 201-220 (20 points)
    const pointsAfter200 = level > 200 ? Math.min(level - 200, 20) : 0

    // Total: maximum 40 points at level 220
    const totalPoints = pointsUpTo200 + pointsAfter200

    // Cache the result
    this.pointCache.setStandardPoints(level, totalPoints)

    return totalPoints
  }

  /**
   * Calculate AI perk points based on alien level
   * @param alienLevel Alien level (0-30)
   * @returns AI perk points available
   */
  calculateAIPerkPoints(alienLevel: number): number {
    if (alienLevel <= 0) return 0

    // Check cache first
    const cached = this.pointCache.getAIPoints(alienLevel)
    if (cached !== null) {
      return cached
    }

    // 1 AI perk point per alien level, max 30
    const totalPoints = Math.min(alienLevel, 30)

    // Cache the result
    this.pointCache.setAIPoints(alienLevel, totalPoints)

    return totalPoints
  }

  /**
   * Calculate detailed point information for a character
   * @param characterData Character information
   * @returns Detailed point calculation with formulas
   */
  calculatePerkPointsDetailed(characterData: PerkCharacterData): PerkPointCalculation {
    const standardPoints = this.calculateStandardPerkPoints(characterData.level)
    const aiPoints = this.calculateAIPerkPoints(characterData.alienLevel || 0)

    return {
      standardPoints: {
        total: standardPoints,
        formula: this.getStandardPointsFormula(characterData.level)
      },
      aiPoints: {
        total: aiPoints,
        formula: this.getAIPointsFormula(characterData.alienLevel || 0)
      }
    }
  }

  /**
   * Aggregate perk effects from a list of owned perks
   * @param perks Array of owned perks
   * @returns Aggregated stat effects and any errors
   */
  async aggregatePerkEffects(perks: AnyPerkEntry[]): Promise<PerkCalculationResult> {
    const startTime = performance.now()
    const result: PerkCalculationResult = {
      effects: {},
      warnings: [],
      errors: [],
      success: true
    }

    try {
      // Validate input
      if (!Array.isArray(perks)) {
        result.errors.push({
          type: 'error',
          message: 'Invalid perks data',
          details: 'Perks parameter is not an array',
          recoverable: false
        })
        result.success = false
        return result
      }

      // Process each perk and accumulate effects
      for (const perk of perks) {
        try {
          const perkEffects = await this.getPerkEffects(perk)

          // Aggregate effects by stat ID
          for (const effect of perkEffects) {
            if (!result.effects[effect.stat]) {
              result.effects[effect.stat] = 0
            }
            result.effects[effect.stat] += effect.value
          }

        } catch (error) {
          result.warnings.push({
            type: 'warning',
            message: 'Failed to process perk effects',
            details: `Error processing perk ${perk.name}: ${error instanceof Error ? error.message : String(error)}`,
            perkName: perk.name,
            recoverable: true
          })
          // Continue processing other perks
        }
      }

    } catch (error) {
      result.errors.push({
        type: 'error',
        message: 'Critical error aggregating perk effects',
        details: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        recoverable: false
      })
      result.success = false
    } finally {
      // Track performance metrics
      const endTime = performance.now()
      this.updatePerformanceMetrics(endTime - startTime)
    }

    return result
  }

  /**
   * Validate a perk purchase against character constraints and available points
   * @param character Character data for validation
   * @param perk Perk information
   * @param targetLevel Target level to purchase (1-10)
   * @param currentPerks Currently owned perks
   * @returns Validation result with detailed error messages
   */
  validatePerkPurchase(
    character: PerkCharacterData,
    perk: PerkInfo,
    targetLevel: number,
    currentPerks: AnyPerkEntry[]
  ): PerkValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    try {
      // Validate target level
      if (targetLevel < 1 || targetLevel > 10) {
        errors.push(`Invalid target level ${targetLevel} (must be 1-10)`)
      }

      // Find current level of this perk
      const currentPerk = currentPerks.find(p => p.name === perk.name)
      const currentLevel = currentPerk?.level || 0

      // Check sequential purchase requirement
      if (targetLevel > currentLevel + 1) {
        errors.push(`Must purchase level ${currentLevel + 1} first (sequential purchase required)`)
      }

      // Check if downgrading (not allowed)
      if (targetLevel <= currentLevel) {
        errors.push(`Cannot downgrade perk (current level: ${currentLevel}, target: ${targetLevel})`)
      }

      // Check character level requirement
      if (perk.requirements.level && character.level < perk.requirements.level) {
        errors.push(`Requires character level ${perk.requirements.level} (current: ${character.level})`)
      }

      // Check AI level requirement (for AI perks)
      if (perk.requirements.alienLevel && (!character.alienLevel || character.alienLevel < perk.requirements.alienLevel)) {
        errors.push(`Requires AI level ${perk.requirements.alienLevel} (current: ${character.alienLevel || 0})`)
      }

      // Check profession restriction
      if (perk.requirements.professions && perk.requirements.professions.length > 0) {
        if (!perk.requirements.professions.includes(character.profession)) {
          errors.push(`Not available for ${character.profession} (requires: ${perk.requirements.professions.join(', ')})`)
        }
      }

      // Check breed restriction
      if (perk.requirements.breeds && perk.requirements.breeds.length > 0) {
        if (!perk.requirements.breeds.includes(character.breed)) {
          errors.push(`Not available for ${character.breed} (requires: ${perk.requirements.breeds.join(', ')})`)
        }
      }

      // Check expansion requirement
      if (perk.requirements.expansion && character.expansion !== perk.requirements.expansion) {
        errors.push(`Requires ${perk.requirements.expansion} expansion`)
      }

      // Check perk points available (not for LE research)
      if (perk.type !== 'LE') {
        const pointsResult = this.validatePerkPoints(character, perk, targetLevel, currentPerks)
        if (!pointsResult.valid) {
          errors.push(...pointsResult.errors)
        }
      }

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate perk point availability for a purchase
   * @param character Character data
   * @param perk Perk information
   * @param targetLevel Target level to purchase
   * @param currentPerks Currently owned perks
   * @returns Point validation result
   */
  validatePerkPoints(
    character: PerkCharacterData,
    perk: PerkInfo,
    targetLevel: number,
    currentPerks: AnyPerkEntry[]
  ): PointValidationResult {
    // Calculate total available points
    const totalStandardPoints = this.calculateStandardPerkPoints(character.level)
    const totalAIPoints = this.calculateAIPerkPoints(character.alienLevel || 0)

    // Calculate currently spent points
    let spentStandardPoints = 0
    let spentAIPoints = 0

    for (const currentPerk of currentPerks) {
      if (currentPerk.type === 'SL') {
        spentStandardPoints += currentPerk.level  // Each level costs 1 point
      } else if (currentPerk.type === 'AI') {
        spentAIPoints += currentPerk.level  // Each level costs 1 point
      }
      // LE perks don't cost points
    }

    // Calculate available points
    const availableStandardPoints = totalStandardPoints - spentStandardPoints
    const availableAIPoints = totalAIPoints - spentAIPoints

    // Calculate required points for this purchase
    const currentLevel = currentPerks.find(p => p.name === perk.name)?.level || 0
    const pointsNeeded = targetLevel - currentLevel

    const requiredStandardPoints = perk.type === 'SL' ? pointsNeeded : 0
    const requiredAIPoints = perk.type === 'AI' ? pointsNeeded : 0

    // Validate availability
    const errors: string[] = []
    let valid = true

    if (perk.type === 'SL' && requiredStandardPoints > availableStandardPoints) {
      errors.push(`Insufficient standard perk points (need ${requiredStandardPoints}, have ${availableStandardPoints})`)
      valid = false
    }

    if (perk.type === 'AI' && requiredAIPoints > availableAIPoints) {
      errors.push(`Insufficient AI perk points (need ${requiredAIPoints}, have ${availableAIPoints})`)
      valid = false
    }

    return {
      valid,
      availablePoints: {
        standard: availableStandardPoints,
        ai: availableAIPoints
      },
      requiredPoints: {
        standard: requiredStandardPoints,
        ai: requiredAIPoints
      },
      errors
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Get perk effects from database/spell data
   * This would normally query the database, but for now returns mock data
   * @param perk Perk entry
   * @returns Array of perk effects
   */
  private async getPerkEffects(perk: AnyPerkEntry): Promise<PerkEffect[]> {
    // Check cache first
    const cached = this.effectCache.get(perk.aoid)
    if (cached) {
      return cached
    }

    // TODO: Implement actual database query to get spell data
    // For now, return empty effects as a placeholder
    const effects: PerkEffect[] = []

    // Cache the result
    this.effectCache.set(perk.aoid, effects)

    return effects
  }

  /**
   * Generate formula description for standard perk points
   * @param level Character level
   * @returns Human-readable formula
   */
  private getStandardPointsFormula(level: number): string {
    if (level < 10) {
      return 'No points until level 10'
    }

    const pointsUpTo200 = Math.min(Math.floor(level / 10), 20)
    const pointsAfter200 = level > 200 ? Math.min(level - 200, 20) : 0

    let formula = `${pointsUpTo200} points (1 per 10 levels up to 200)`

    if (pointsAfter200 > 0) {
      formula += ` + ${pointsAfter200} points (1 per level from 201-220)`
    }

    formula += ` = ${pointsUpTo200 + pointsAfter200} total`

    return formula
  }

  /**
   * Generate formula description for AI perk points
   * @param alienLevel AI level
   * @returns Human-readable formula
   */
  private getAIPointsFormula(alienLevel: number): string {
    if (alienLevel <= 0) {
      return 'No AI levels = 0 points'
    }

    const points = Math.min(alienLevel, 30)
    return `${alienLevel} AI level${alienLevel === 1 ? '' : 's'} = ${points} point${points === 1 ? '' : 's'} (max 30)`
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
    effectCacheStats: ReturnType<PerkEffectCache['getStats']>
  } {
    return {
      ...this.performanceMetrics,
      effectCacheStats: this.effectCache.getStats()
    }
  }

  /**
   * Clear all caches (useful for memory management)
   */
  clearCaches(): void {
    this.effectCache.clear()
    this.pointCache.clear()
  }
}

// ============================================================================
// Singleton Instance and Utility Functions
// ============================================================================

/** Singleton instance for easy access */
export const perkCalculator = new PerkCalculatorService()

/**
 * Convenience function to calculate standard perk points
 * @param level Character level
 * @returns Standard perk points available
 */
export function calculateStandardPerkPoints(level: number): number {
  return perkCalculator.calculateStandardPerkPoints(level)
}

/**
 * Convenience function to calculate AI perk points
 * @param alienLevel AI level
 * @returns AI perk points available
 */
export function calculateAIPerkPoints(alienLevel: number): number {
  return perkCalculator.calculateAIPerkPoints(alienLevel)
}

/**
 * Convenience function to aggregate perk effects
 * @param perks Array of owned perks
 * @returns Promise resolving to aggregated effects
 */
export async function aggregatePerkEffects(perks: AnyPerkEntry[]): Promise<PerkEffectSummary> {
  try {
    const result = await perkCalculator.aggregatePerkEffects(perks)

    // Log warnings for debugging
    if (result.warnings.length > 0) {
      console.warn('Perk effect calculation warnings:', result.warnings)
    }

    if (result.errors.length > 0) {
      console.error('Perk effect calculation errors:', result.errors)
    }

    return result.effects
  } catch (error) {
    console.error('Error in aggregatePerkEffects convenience function:', error)
    return {}
  }
}

/**
 * Convenience function to validate perk purchase
 * @param character Character data
 * @param perk Perk information
 * @param targetLevel Target level
 * @param currentPerks Current perks
 * @returns Validation result
 */
export function validatePerkPurchase(
  character: PerkCharacterData,
  perk: PerkInfo,
  targetLevel: number,
  currentPerks: AnyPerkEntry[]
): PerkValidationResult {
  return perkCalculator.validatePerkPurchase(character, perk, targetLevel, currentPerks)
}

/**
 * Convenience function to get detailed point calculations
 * @param characterData Character information
 * @returns Detailed point calculation
 */
export function calculatePerkPointsDetailed(characterData: PerkCharacterData): PerkPointCalculation {
  return perkCalculator.calculatePerkPointsDetailed(characterData)
}
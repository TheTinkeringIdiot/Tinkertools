/**
 * TinkerNukes - DPS and Efficiency Calculations
 *
 * Composite calculation functions that combine utilities from damage, casting,
 * and regeneration calculations to produce DPS, damage-per-nano, nano-per-second,
 * and sustain metrics.
 *
 * See: .docs/plans/tinkernukes/requirements.md (FR-6 columns 9-13)
 *      .docs/plans/tinkernukes/damage-calculations.docs.md (lines 242-268)
 */

import { formatTime } from './nuke-casting-calculations'
import { calculateSustainTime, calculateCastsToEmpty } from './nuke-regen-calculations'

// ============================================================================
// Core Efficiency Calculations
// ============================================================================

/**
 * Calculate Damage Per Second (DPS)
 *
 * Formula:
 * - For instant nanos: mid_damage / (cast_time + recharge_time)
 * - For DoT nanos: mid_damage / (cast_time + recharge_time + (tick_count * tick_interval / 100))
 *
 * @param midDamage - Mid-point damage value (after all modifiers)
 * @param castTime - Modified cast time in seconds
 * @param rechargeTime - Modified recharge time in seconds
 * @param tickCount - Number of ticks (for DoT nanos, defaults to 1 for instant)
 * @param tickInterval - Tick interval in centiseconds (for DoT nanos, defaults to 0)
 * @returns DPS as a number with 2 decimal precision
 *
 * @example
 * // Instant nano: 500 damage, 1.5s cast, 3.0s recharge
 * calculateDPS(500, 1.5, 3.0, 1, 0) // Returns 111.11
 *
 * @example
 * // DoT nano: 1000 damage, 1.0s cast, 2.0s recharge, 5 ticks @ 100cs
 * calculateDPS(1000, 1.0, 2.0, 5, 100) // Returns 125.00
 */
export function calculateDPS(
  midDamage: number,
  castTime: number,
  rechargeTime: number,
  tickCount: number = 1,
  tickInterval: number = 0
): number {
  // Validate inputs - ensure all are valid numbers
  if (!Number.isFinite(midDamage) || !Number.isFinite(castTime) || !Number.isFinite(rechargeTime)) {
    return 0
  }

  // Calculate base cycle time (cast + recharge)
  let cycleTime = castTime + rechargeTime

  // For DoT nanos, add tick duration to cycle time
  if (tickCount > 1 && tickInterval > 0) {
    const tickDuration = (tickCount * tickInterval) / 100
    cycleTime += tickDuration
  }

  // Prevent division by zero or invalid cycle time
  if (cycleTime === 0 || !Number.isFinite(cycleTime)) {
    return 0
  }

  // Calculate DPS with 2 decimal precision
  const dps = midDamage / cycleTime

  // Ensure result is valid
  if (!Number.isFinite(dps)) {
    return 0
  }

  return Number(dps.toFixed(2))
}

/**
 * Calculate Damage Per Nano
 *
 * Simple ratio of damage to nano cost, showing efficiency of nano expenditure.
 *
 * @param midDamage - Mid-point damage value (after all modifiers)
 * @param modifiedNanoCost - Nano cost after breed-specific caps and cost reduction
 * @returns Damage per nano as a number with 2 decimal precision
 *
 * @example
 * // 500 damage, 100 nano cost
 * calculateDamagePerNano(500, 100) // Returns 5.00
 *
 * @example
 * // 1000 damage, 450 nano cost
 * calculateDamagePerNano(1000, 450) // Returns 2.22
 */
export function calculateDamagePerNano(
  midDamage: number,
  modifiedNanoCost: number
): number {
  // Validate inputs
  if (!Number.isFinite(midDamage) || !Number.isFinite(modifiedNanoCost)) {
    return 0
  }

  // Prevent division by zero
  if (modifiedNanoCost === 0) {
    return 0
  }

  // Calculate ratio with 2 decimal precision
  const ratio = midDamage / modifiedNanoCost

  // Ensure result is valid
  if (!Number.isFinite(ratio)) {
    return 0
  }

  return Number(ratio.toFixed(2))
}

/**
 * Calculate Nano Per Second (consumption rate)
 *
 * Formula: modified_nano_cost / (cast_time + recharge_time)
 *
 * This represents the rate of nano consumption when casting continuously.
 *
 * @param modifiedNanoCost - Nano cost after breed-specific caps and cost reduction
 * @param castTime - Modified cast time in seconds
 * @param rechargeTime - Modified recharge time in seconds
 * @returns Nano per second as a number with 2 decimal precision
 *
 * @example
 * // 100 nano cost, 1.5s cast, 3.0s recharge
 * calculateNanoPerSecond(100, 1.5, 3.0) // Returns 22.22
 *
 * @example
 * // 450 nano cost, 1.0s cast, 2.0s recharge
 * calculateNanoPerSecond(450, 1.0, 2.0) // Returns 150.00
 */
export function calculateNanoPerSecond(
  modifiedNanoCost: number,
  castTime: number,
  rechargeTime: number
): number {
  // Validate inputs
  if (!Number.isFinite(modifiedNanoCost) || !Number.isFinite(castTime) || !Number.isFinite(rechargeTime)) {
    return 0
  }

  // Calculate cycle time (cast + recharge)
  const cycleTime = castTime + rechargeTime

  // Prevent division by zero or invalid cycle time
  if (cycleTime === 0 || !Number.isFinite(cycleTime)) {
    return 0
  }

  // Calculate consumption rate with 2 decimal precision
  const nanoPerSecond = modifiedNanoCost / cycleTime

  // Ensure result is valid
  if (!Number.isFinite(nanoPerSecond)) {
    return 0
  }

  return Number(nanoPerSecond.toFixed(2))
}

// ============================================================================
// Display Formatting Utilities
// ============================================================================

/**
 * Format DPS value for display
 *
 * @param dps - DPS value
 * @returns Formatted DPS string with 2 decimal places
 *
 * @example
 * formatDPS(111.11111) // Returns "111.11"
 */
export function formatDPS(dps: number): string {
  return dps.toFixed(2)
}

/**
 * Format damage per nano for display
 *
 * @param damagePerNano - Damage per nano value
 * @returns Formatted string with 2 decimal places
 *
 * @example
 * formatDamagePerNano(5.0) // Returns "5.00"
 */
export function formatDamagePerNano(damagePerNano: number): string {
  return damagePerNano.toFixed(2)
}

/**
 * Format nano per second for display
 *
 * @param nanoPerSecond - Nano per second value
 * @returns Formatted string with 2 decimal places
 *
 * @example
 * formatNanoPerSecond(22.222) // Returns "22.22"
 */
export function formatNanoPerSecond(nanoPerSecond: number): string {
  return nanoPerSecond.toFixed(2)
}

/**
 * Format sustain time for display
 *
 * Display format:
 * - Infinity: "∞"
 * - >= 60 seconds: "XXm YYs" (e.g., "2m 30s")
 * - < 60 seconds: "XXs" (e.g., "45s")
 *
 * @param sustainTime - Time in seconds until out of nano
 * @returns Formatted sustain time string
 *
 * @example
 * formatSustainTime(Infinity) // Returns "∞"
 * formatSustainTime(45) // Returns "45s"
 * formatSustainTime(150) // Returns "2m 30s"
 */
export function formatSustainTime(sustainTime: number): string {
  if (sustainTime === Infinity) {
    return '∞'
  }

  // Use formatTime from nuke-casting-calculations
  return formatTime(sustainTime)
}

/**
 * Format casts to empty for display
 *
 * Display format:
 * - Infinity: "∞"
 * - Otherwise: Integer value
 *
 * @param castsToEmpty - Number of casts until nano pool is empty
 * @returns Formatted casts to empty string
 *
 * @example
 * formatCastsToEmpty(Infinity) // Returns "∞"
 * formatCastsToEmpty(50) // Returns "50"
 */
export function formatCastsToEmpty(castsToEmpty: number): string {
  if (castsToEmpty === Infinity) {
    return '∞'
  }

  return Math.floor(castsToEmpty).toString()
}

// ============================================================================
// Composite Sustain Calculations
// ============================================================================

/**
 * Calculate sustain metrics for a nano
 *
 * Composes nano consumption rate, regen rate, and sustain time calculations
 * to provide complete sustainability analysis. Uses utilities from
 * nuke-regen-calculations.ts for sustain time and casts to empty.
 *
 * @param maxNano - Maximum nano pool
 * @param modifiedNanoCost - Modified nano cost (after cost reduction)
 * @param castTime - Modified cast time in seconds
 * @param rechargeTime - Modified recharge time in seconds
 * @param regenPerSecond - Nano regeneration per second
 * @returns Object with consumption rate, sustain time, casts to empty, and sustainability flag
 *
 * @example
 * // 2000 max nano, 100 cost, 2s cast, 3s recharge, 30 regen/sec
 * calculateSustainMetrics(2000, 100, 2, 3, 30)
 * // Returns: { nanoPerSecond: 20.00, sustainTime: Infinity, sustainTimeFormatted: "∞", castsToEmpty: Infinity, isSustainable: true }
 *
 * @example
 * // 2000 max nano, 100 cost, 1s cast, 1s recharge, 30 regen/sec
 * calculateSustainMetrics(2000, 100, 1, 1, 30)
 * // Returns: { nanoPerSecond: 50.00, sustainTime: 100, sustainTimeFormatted: "1m 40s", castsToEmpty: 20, isSustainable: false }
 */
export function calculateSustainMetrics(
  maxNano: number,
  modifiedNanoCost: number,
  castTime: number,
  rechargeTime: number,
  regenPerSecond: number
): {
  nanoPerSecond: number
  sustainTime: number
  sustainTimeFormatted: string
  castsToEmpty: number
  isSustainable: boolean
} {
  // Calculate nano consumption rate
  const nanoPerSecond = calculateNanoPerSecond(modifiedNanoCost, castTime, rechargeTime)

  // Check if sustainable (regen >= consumption)
  const isSustainable = regenPerSecond >= nanoPerSecond

  // Calculate sustain time using utility from nuke-regen-calculations
  const sustainTime = calculateSustainTime(maxNano, nanoPerSecond, regenPerSecond)

  // Format sustain time for display
  const sustainTimeFormatted = formatSustainTime(sustainTime)

  // Calculate casts to empty using utility from nuke-regen-calculations
  const castsToEmpty = calculateCastsToEmpty(maxNano, modifiedNanoCost, isSustainable)

  return {
    nanoPerSecond,
    sustainTime,
    sustainTimeFormatted,
    castsToEmpty,
    isSustainable,
  }
}

/**
 * Calculate all efficiency metrics for a nano in one call
 *
 * Convenience function that composes all efficiency calculations into a
 * single comprehensive analysis. Useful for table display where all metrics
 * are needed at once.
 *
 * @param midDamage - Mid-point damage value (after all modifiers)
 * @param modifiedNanoCost - Modified nano cost (after cost reduction)
 * @param castTime - Modified cast time in seconds
 * @param rechargeTime - Modified recharge time in seconds
 * @param maxNano - Maximum nano pool
 * @param regenPerSecond - Nano regeneration per second
 * @param tickCount - Number of ticks (1 for instant, >1 for DoT)
 * @param tickInterval - Time between ticks in centiseconds (for DoT only)
 * @returns Object with all efficiency metrics
 *
 * @example
 * // Instant nano: 500 damage, 100 cost, 1.5s cast, 3s recharge, 2000 max nano, 20 regen/s
 * calculateAllEfficiencyMetrics(500, 100, 1.5, 3.0, 2000, 20, 1, 0)
 * // Returns all DPS, efficiency, and sustain metrics
 */
export function calculateAllEfficiencyMetrics(
  midDamage: number,
  modifiedNanoCost: number,
  castTime: number,
  rechargeTime: number,
  maxNano: number,
  regenPerSecond: number,
  tickCount: number = 1,
  tickInterval: number = 0
): {
  dps: number
  damagePerNano: number
  nanoPerSecond: number
  sustainTime: number
  sustainTimeFormatted: string
  castsToEmpty: number
  isSustainable: boolean
} {
  // Calculate DPS
  const dps = calculateDPS(midDamage, castTime, rechargeTime, tickCount, tickInterval)

  // Calculate damage per nano
  const damagePerNano = calculateDamagePerNano(midDamage, modifiedNanoCost)

  // Calculate sustain metrics (composes nanoPerSecond + sustain calculations)
  const sustainMetrics = calculateSustainMetrics(
    maxNano,
    modifiedNanoCost,
    castTime,
    rechargeTime,
    regenPerSecond
  )

  return {
    dps,
    damagePerNano,
    ...sustainMetrics,
  }
}

// ============================================================================
// Export utilities as a group
// ============================================================================

export const nukeEfficiencyCalculations = {
  calculateDPS,
  calculateDamagePerNano,
  calculateNanoPerSecond,
  calculateSustainMetrics,
  calculateAllEfficiencyMetrics,
  formatDPS,
  formatDamagePerNano,
  formatNanoPerSecond,
  formatSustainTime,
  formatCastsToEmpty,
}

/**
 * TinkerNukes Casting Calculations
 *
 * Pure calculation functions for cast time reduction, recharge time reduction,
 * and nano cost with breed-specific caps.
 *
 * All time values are stored in centiseconds (1/100 second) and converted to
 * seconds for display.
 */

/**
 * Breed enum matching game-data.ts
 * 1 = Solitus, 2 = Opifex, 3 = Nanomage, 4 = Atrox
 */
export type Breed = 1 | 2 | 3 | 4;

/**
 * Default minimum delay when no explicit cap stat is present.
 * In Anarchy Online, cast/recharge times have a hard floor of 1.00 second (100cs)
 * unless overridden by AttackDelayCap (stat 523) or RechargeDelayCap (stat 524).
 */
const DEFAULT_DELAY_CAP_CS = 100;

/**
 * Calculate modified cast time based on Nano Init skill
 *
 * Two-tier scaling formula:
 * - Below 1200 init: 1:2 ratio (init/2 reduction)
 * - Above 1200 init: Additional 1:6 ratio ((init-1200)/6 reduction)
 *
 * Total reduction = floor(init/2) + floor(max(0, init-1200)/6)
 *
 * Hard minimum (AttackDelayCap):
 * - If stat 523 exists: use its value as minimum (can be < 100cs)
 * - If stat 523 not present: use default 100cs (1.00 second) minimum
 *
 * @param baseCastTime - Base cast time in centiseconds (from database)
 * @param nanoInit - Character's Nano Init skill value
 * @param attackDelayCap - AttackDelayCap from stat 523, or undefined for default 1.00s minimum
 * @returns Modified cast time in seconds with 2 decimal precision
 *
 * @example
 * // Nano with 300cs base cast time, 600 init, no cap stat
 * calculateCastTime(300, 600) // Returns 1.00 (300 - 300 = 0cs, clamped to 100cs default)
 *
 * @example
 * // Nano with 1000cs base cast time, 1800 init, 200cs cap from stat 523
 * calculateCastTime(1000, 1800, 200) // Returns 2.00 (1000 - 1000 = 0cs, clamped to 200cs cap)
 *
 * @example
 * // Nano with 500cs base cast time, 2000 init, 50cs cap from stat 523
 * calculateCastTime(500, 2000, 50) // Returns 0.50 (capped at 50cs from stat 523)
 */
export function calculateCastTime(
  baseCastTime: number,
  nanoInit: number,
  attackDelayCap?: number
): number {
  // Two-tier reduction calculation
  const firstTierReduction = Math.floor(nanoInit / 2);
  const secondTierReduction = Math.floor(Math.max(0, nanoInit - 1200) / 6);
  const totalReduction = firstTierReduction + secondTierReduction;

  // Apply reduction
  const reducedCastTimeCs = baseCastTime - totalReduction;

  // Determine effective cap: use stat 523 if present, otherwise default 100cs (1.00s)
  const effectiveCap = attackDelayCap !== undefined ? attackDelayCap : DEFAULT_DELAY_CAP_CS;

  // Apply hard minimum
  const modifiedCastTimeCs = Math.max(effectiveCap, reducedCastTimeCs);

  // Convert centiseconds to seconds
  return centisecondsToSeconds(modifiedCastTimeCs);
}

/**
 * Calculate modified recharge time based on Nano Init skill
 *
 * Uses the same two-tier scaling formula as cast time:
 * - Below 1200 init: 1:2 ratio (init/2 reduction)
 * - Above 1200 init: Additional 1:6 ratio ((init-1200)/6 reduction)
 *
 * Hard minimum (RechargeDelayCap):
 * - If stat 524 exists: use its value as minimum (can be < 100cs)
 * - If stat 524 not present: use default 100cs (1.00 second) minimum
 *
 * @param baseRecharge - Base recharge time in centiseconds (from database)
 * @param nanoInit - Character's Nano Init skill value
 * @param rechargeDelayCap - RechargeDelayCap from stat 524, or undefined for default 1.00s minimum
 * @returns Modified recharge time in seconds with 2 decimal precision
 *
 * @example
 * // Nano with 500cs base recharge, 1200 init, no cap stat
 * calculateRechargeTime(500, 1200) // Returns 1.00 (500 - 600 = -100cs, clamped to 100cs default)
 *
 * @example
 * // Nano with 800cs base recharge, 1800 init, 150cs cap from stat 524
 * calculateRechargeTime(800, 1800, 150) // Returns 1.50 (800 - 1000 = -200cs, clamped to 150cs cap)
 *
 * @example
 * // Nano with 300cs base recharge, 2000 init, 50cs cap from stat 524
 * calculateRechargeTime(300, 2000, 50) // Returns 0.50 (capped at 50cs from stat 524)
 */
export function calculateRechargeTime(
  baseRecharge: number,
  nanoInit: number,
  rechargeDelayCap?: number
): number {
  // Two-tier reduction calculation (same as cast time)
  const firstTierReduction = Math.floor(nanoInit / 2);
  const secondTierReduction = Math.floor(Math.max(0, nanoInit - 1200) / 6);
  const totalReduction = firstTierReduction + secondTierReduction;

  // Apply reduction
  const reducedRechargeCs = baseRecharge - totalReduction;

  // Determine effective cap: use stat 524 if present, otherwise default 100cs (1.00s)
  const effectiveCap = rechargeDelayCap !== undefined ? rechargeDelayCap : DEFAULT_DELAY_CAP_CS;

  // Apply hard minimum
  const modifiedRechargeCs = Math.max(effectiveCap, reducedRechargeCs);

  // Convert centiseconds to seconds
  return centisecondsToSeconds(modifiedRechargeCs);
}

/**
 * Calculate modified nano cost with breed-specific caps
 *
 * Formula: baseCost * (1 - costReductionPct / 100)
 *
 * Breed caps on cost reduction:
 * - Solitus (1): 50% maximum
 * - Opifex (2): 50% maximum
 * - Nanomage (3): 55% maximum
 * - Atrox (4): 45% maximum
 *
 * @param baseCost - Base nano cost from database
 * @param costReductionPct - Total cost reduction percentage (from Crunchcom buff + additional modifiers)
 * @param breed - Character breed (1=Solitus, 2=Opifex, 3=Nanomage, 4=Atrox)
 * @returns Modified nano cost rounded to nearest integer
 *
 * @example
 * // Nanomage with 1000 base cost, 60% reduction (capped at 55%)
 * calculateNanoCost(1000, 60, 3) // Returns 450 (1000 * 0.45)
 *
 * @example
 * // Atrox with 500 base cost, 50% reduction (capped at 45%)
 * calculateNanoCost(500, 50, 4) // Returns 275 (500 * 0.55)
 */
export function calculateNanoCost(
  baseCost: number,
  costReductionPct: number,
  breed: Breed
): number {
  // Apply breed-specific caps
  let cappedReduction = costReductionPct;

  if (breed === 1 || breed === 2) {
    // Solitus/Opifex: 50% cap
    cappedReduction = Math.min(costReductionPct, 50);
  } else if (breed === 3) {
    // Nanomage: 55% cap
    cappedReduction = Math.min(costReductionPct, 55);
  } else if (breed === 4) {
    // Atrox: 45% cap
    cappedReduction = Math.min(costReductionPct, 45);
  }

  // Calculate modified cost and round to nearest integer
  const modifiedCost = baseCost * (1 - cappedReduction / 100);
  return Math.round(modifiedCost);
}

/**
 * Convert centiseconds to seconds with 2 decimal precision
 *
 * Standard conversion used throughout TinkerNukes for time display.
 *
 * @param centiseconds - Time value in centiseconds (1/100 second)
 * @returns Time value in seconds as a number with 2 decimal precision
 *
 * @example
 * centisecondsToSeconds(150) // Returns 1.50
 * centisecondsToSeconds(3000) // Returns 30.00
 */
export function centisecondsToSeconds(centiseconds: number): number {
  return Number((centiseconds / 100).toFixed(2));
}

/**
 * Format seconds for display with appropriate unit labels
 *
 * Display format:
 * - >= 60 seconds: "XXm YYs" (e.g., "2m 30s")
 * - < 60 seconds: "XXs" (e.g., "45s")
 *
 * @param seconds - Time value in seconds
 * @returns Formatted time string with unit labels
 *
 * @example
 * formatTime(45) // Returns "45s"
 * formatTime(90) // Returns "1m 30s"
 * formatTime(150) // Returns "2m 30s"
 */
export function formatTime(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${Math.floor(seconds)}s`;
}

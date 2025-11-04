/**
 * Weapon Speed Calculations for TinkerFite
 *
 * Phase 4: Base DPS Calculations
 * Ported from legacy Django/Python TinkerFite (views.py lines 428-453)
 *
 * Calculates weapon attack and recharge times based on:
 * - Base weapon speeds
 * - Aggdef slider (-100 to +100, default 75)
 * - Initiative bonuses (melee/ranged/physical)
 * - Weapon-specific speed caps
 */

import type { WeaponCandidate, FiteInputState } from '@/types/weapon-analysis'
import { WEAPON_STAT_IDS, INITIATIVE_IDS } from '@/types/weapon-analysis'

const MIN_ATTACK_TIME = 100 // 1 second minimum (centiseconds)
const MIN_RECHARGE_TIME = 100

/**
 * Maps initiative type stat IDs to initiative field names
 * Legacy: INITS dict in utils.py
 */
const INITIATIVE_MAP: Record<number, 'meleeInit' | 'physicalInit' | 'rangedInit'> = {
  [INITIATIVE_IDS.MELEE_INIT]: 'meleeInit', // 118
  [INITIATIVE_IDS.PHYSICAL_INIT]: 'physicalInit', // 120
  [INITIATIVE_IDS.RANGED_INIT]: 'rangedInit' // 119
}

export interface WeaponSpeeds {
  attackTime: number // centiseconds
  rechargeTime: number // centiseconds
}

/**
 * Calculate weapon attack and recharge times with all modifiers
 *
 * Legacy source: calculate_speeds() in views.py line 428
 *
 * Formula:
 * 1. Start with base weapon times
 * 2. Apply aggdef modifier: time = time - (aggdef - 75)
 * 3. Apply initiative: attack -= init/6, recharge -= init/3
 * 4. Apply weapon-specific caps
 * 5. Enforce minimum times (100 cs = 1 second)
 */
export function calculateSpeeds(
  weapon: WeaponCandidate,
  state: FiteInputState
): WeaponSpeeds {
  const stats = weapon.stats || []

  // Get base times from weapon
  let attackTime = stats.find((s) => s.stat === WEAPON_STAT_IDS.ATTACK_DELAY)?.value || 100
  let rechargeTime = stats.find((s) => s.stat === WEAPON_STAT_IDS.RECHARGE_DELAY)?.value || 100

  // Apply aggdef modifier (slider -100 to +100, default 75)
  // Formula: time = time - (aggdef - 75)
  // Higher aggdef = more aggressive = faster attacks
  const aggdef = state.characterStats.aggdef
  attackTime = attackTime - (aggdef - 75)
  if (attackTime < MIN_ATTACK_TIME) attackTime = MIN_ATTACK_TIME

  rechargeTime = rechargeTime - (aggdef - 75)
  if (rechargeTime < MIN_RECHARGE_TIME) rechargeTime = MIN_RECHARGE_TIME

  // Apply initiative bonus based on weapon type
  // Initiative skill stat 440 tells us which init to use
  const initType = stats.find((s) => s.stat === WEAPON_STAT_IDS.INITIATIVE_TYPE)?.value

  if (initType !== undefined && INITIATIVE_MAP[initType]) {
    const initKey = INITIATIVE_MAP[initType]
    const initValue = state.initiative[initKey] || 0

    // Attack time: reduced by (init / 6)
    attackTime = Math.round(attackTime - initValue / 6)
    if (attackTime < MIN_ATTACK_TIME) attackTime = MIN_ATTACK_TIME

    // Recharge time: reduced by (init / 3)
    rechargeTime = Math.round(rechargeTime - initValue / 3)
    if (rechargeTime < MIN_RECHARGE_TIME) rechargeTime = MIN_RECHARGE_TIME
  }

  // Apply weapon-specific speed caps
  // Note: Legacy code checks weapon.other['Attack time cap'] and weapon.other['Recharge time cap']
  // In new schema, these will need to be extracted from weapon stats or provided separately
  // TODO: Map correct stat IDs once backend provides weapon.other fields
  // For now, these caps are not applied (most weapons don't have them)
  const attackCap: number | undefined = undefined // weapon.other['Attack time cap']
  const rechargeCap: number | undefined = undefined // weapon.other['Recharge time cap']

  if (attackCap !== undefined && attackTime < attackCap) {
    attackTime = attackCap
  }

  if (rechargeCap !== undefined && rechargeTime < rechargeCap) {
    rechargeTime = rechargeCap
  }

  return { attackTime, rechargeTime }
}

/**
 * Convert centiseconds to seconds for display
 */
export function centisecondsToSeconds(centiseconds: number): number {
  return centiseconds / 100
}

/**
 * Calculate cycle time (attack + recharge in seconds)
 */
export function calculateCycleTime(speeds: WeaponSpeeds): number {
  return speeds.attackTime / 100 + speeds.rechargeTime / 100
}

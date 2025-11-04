/**
 * Weapon Damage and DPS Calculations for TinkerFite
 *
 * Phase 4: Base DPS Calculations
 * Ported from legacy Django/Python TinkerFite (views.py lines 232-426)
 *
 * Calculates weapon DPS based on:
 * - Attack Rating (AR) bonus from weapon skills + AAO
 * - Base damage modified by AR bonus
 * - Target AC reduction (AC / 10)
 * - Critical hit damage
 * - 60-second DPS sample
 */

import type { WeaponCandidate, FiteInputState } from '@/types/weapon-analysis'
import { WEAPON_STAT_IDS } from '@/types/weapon-analysis'
import { calculateSpeeds, calculateCycleTime } from './weapon-speed-calculations'

const SAMPLE_LENGTH = 60 // DPS sample in seconds

export interface DamageStats {
  minDamage: number
  avgDamage: number
  maxDamage: number
  critDamage: number
}

export interface Damage60sResult {
  attackTime: number
  rechargeTime: number
  minDamage: number
  avgDamage: number
  maxDamage: number
  critDamage: number
  minDamage60s: number
  avgDamage60s: number
  maxDamage60s: number
  numBasicAttacks: number
  numCrits: number
}

/**
 * Calculate Attack Rating (AR) bonus from weapon skills and AAO
 *
 * Legacy source: calculate_ar_bonus() in views.py line 407
 *
 * Formula:
 * 1. Sum weighted attack skills from weapon.attack_stats
 * 2. Add AAO bonus
 * 3. Apply AR cap if weapon has one (MBS weapons)
 * 4. Calculate tiered AR bonus:
 *    - ar_bonus = 1 + (min(atk_skill, 1000) / 400)
 *    - if atk_skill > 1000: ar_bonus += (atk_skill - 1000) / 1200
 */
export function calculateARBonus(weapon: WeaponCandidate, state: FiteInputState): number {
  const attackStats = weapon.attack_stats || []

  // Sum attack skills weighted by percentages
  let attackSkill = 0

  for (const attackStat of attackStats) {
    const skillId = attackStat.stat
    const percentage = attackStat.value
    const skillValue = state.weaponSkills[skillId] || 0

    attackSkill += Math.round(skillValue * (percentage / 100))
  }

  // Add AAO bonus
  const aao = state.combatBonuses.aao || 0
  attackSkill += aao

  // Apply AR cap if weapon has one (e.g., MBS weapons)
  // In legacy, this is weapon.other['Attack rating cap']
  // In new schema, this is stat 538 (Max Beneficial Skill)
  const arCap = weapon.stats?.find((s) => s.stat === WEAPON_STAT_IDS.AR_CAP)?.value
  if (arCap !== undefined && attackSkill > arCap) {
    attackSkill = arCap
  }

  // Tiered AR bonus formula
  // ar_bonus = 1 + (min(atk_skill, 1000) / 400)
  // if atk_skill > 1000: ar_bonus += (atk_skill - 1000) / 1200

  let arBonus = 1 + Math.min(attackSkill, 1000) / 400

  if (attackSkill > 1000) {
    arBonus += (attackSkill - 1000) / 1200
  }

  return arBonus
}

/**
 * Calculate base weapon damage (min, avg, max, crit)
 *
 * Legacy source: calculate_dps() in views.py lines 239-255
 *
 * Formula:
 * - Min damage: (weapon_min * ar_bonus) + add_damage
 * - Max damage: (weapon_max * ar_bonus) + add_damage - (target_ac / 10)
 * - Avg damage: min + (max - min) / 2
 * - Crit damage: ((weapon_max + crit_bonus) * ar_bonus) + add_damage - (target_ac / 10)
 */
export function calculateBaseDamage(
  weapon: WeaponCandidate,
  state: FiteInputState,
  arBonus: number
): DamageStats {
  const stats = weapon.stats || []

  const weaponMinDmg = stats.find((s) => s.stat === WEAPON_STAT_IDS.MIN_DAMAGE)?.value || 0
  const weaponMaxDmg = stats.find((s) => s.stat === WEAPON_STAT_IDS.MAX_DAMAGE)?.value || 0
  const weaponCritBonus = stats.find((s) => s.stat === WEAPON_STAT_IDS.CRITICAL_BONUS)?.value || 0

  const addDamage = state.combatBonuses.addDamage || 0
  const targetAC = state.characterStats.targetAC || 0

  // Calculate min damage
  const minDamage = Math.round(weaponMinDmg * arBonus + addDamage)

  // Calculate max damage (reduced by target AC / 10)
  let maxDamage = Math.round(weaponMaxDmg * arBonus + addDamage - targetAC / 10)
  if (maxDamage < minDamage) maxDamage = minDamage

  // Calculate average damage
  const avgDamage = Math.round(minDamage + (maxDamage - minDamage) / 2)

  // Calculate crit damage
  let critDamage = Math.round(
    (weaponMaxDmg + weaponCritBonus) * arBonus + addDamage - targetAC / 10
  )
  if (critDamage < minDamage) critDamage = minDamage

  return { minDamage, avgDamage, maxDamage, critDamage }
}

/**
 * Calculate base damage over 60s (without special attacks)
 *
 * Legacy source: calculate_dps() in views.py lines 232-374
 *
 * This function calculates:
 * 1. Weapon speeds (attack + recharge time)
 * 2. Number of basic attacks in 60s sample
 * 3. AR bonus from attack skills + AAO
 * 4. Base damage values (min/avg/max/crit)
 * 5. Crit rate handling (100% crit = all crits)
 * 6. Total damage over 60s (min/avg/max)
 */
export function calculateBaseDamage60s(weapon: WeaponCandidate, state: FiteInputState): Damage60sResult {
  // Calculate speeds
  const speeds = calculateSpeeds(weapon, state)
  const cycleTime = calculateCycleTime(speeds)

  // Calculate number of basic attacks in sample window
  const numBasicAttacks = Math.floor(SAMPLE_LENGTH / cycleTime)

  // Calculate AR bonus
  const arBonus = calculateARBonus(weapon, state)

  // Calculate damage
  const damage = calculateBaseDamage(weapon, state, arBonus)

  // Handle crits
  const critRate = (state.characterStats.crit || 0) / 100
  let numCrits: number
  let numRegular: number

  if (critRate >= 1.0) {
    // 100% crit rate: all attacks are crits
    numCrits = numBasicAttacks
    numRegular = 0
  } else {
    numCrits = Math.floor(numBasicAttacks * critRate)
    numRegular = numBasicAttacks - numCrits
  }

  // Calculate total damage over 60s
  const minDamage60s = Math.round(
    damage.minDamage * numRegular + damage.critDamage * numCrits
  )

  const avgDamage60s = Math.round(
    damage.avgDamage * numRegular + damage.critDamage * numCrits
  )

  const maxDamage60s = Math.round(
    damage.maxDamage * numRegular + damage.critDamage * numCrits
  )

  return {
    attackTime: speeds.attackTime,
    rechargeTime: speeds.rechargeTime,
    minDamage: damage.minDamage,
    avgDamage: damage.avgDamage,
    maxDamage: damage.maxDamage,
    critDamage: damage.critDamage,
    minDamage60s,
    avgDamage60s,
    maxDamage60s,
    numBasicAttacks: numRegular,
    numCrits
  }
}

/**
 * Convert total damage over 60s to DPS
 */
export function convertToDPS(totalDamage60s: number): number {
  return Math.round(totalDamage60s / SAMPLE_LENGTH)
}

/**
 * Utility function for testing/debugging
 * Returns the average DPS for a weapon
 */
export function calculateWeaponDPS(weapon: WeaponCandidate, state: FiteInputState): number {
  const result = calculateBaseDamage60s(weapon, state)
  return convertToDPS(result.avgDamage60s)
}

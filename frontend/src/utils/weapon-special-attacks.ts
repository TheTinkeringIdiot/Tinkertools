/**
 * Weapon Special Attack Calculations for TinkerFite
 *
 * Phase 5: Special Attack Formulas
 * Ported from legacy Django/Python TinkerFite (views.py lines 260-405)
 *
 * Calculates damage from 8 special attack types:
 * 1. Fling Shot - Cycle-based ranged special
 * 2. Burst - 3-round burst fire
 * 3. Full Auto - Multi-round with tiered damage caps
 * 4. Aimed Shot - Single high-damage shot (1x per fight)
 * 5. Fast Attack - Rapid melee attack cycle
 * 6. Brawl - Unarmed combat (requires Brawl Item lookup)
 * 7. Sneak Attack - Stealth opener (1x per fight)
 * 8. Dimach - Not implemented (legacy pass)
 */

import type { WeaponCandidate, FiteInputState } from '@/types/weapon-analysis'
import type { DamageStats } from './weapon-damage-calculations'
import { WEAPON_STAT_IDS, SPECIAL_ATTACK_IDS } from '@/types/weapon-analysis'
import { CANFLAG, isFlagSet } from '@/utils/flag-operations'

const SAMPLE_LENGTH = 60 // DPS sample in seconds

export interface SpecialAttackResult {
  flingShot: number
  burst: number
  fullAuto: number
  aimedShot: number
  fastAttack: number
  brawl: number
  sneakAttack: number
  dimach: number
  total: number
}

/**
 * Calculate Fling Shot damage
 *
 * Legacy source: views.py line 261
 *
 * Cycle cap: 6 + (attack_time / 100) seconds
 * Cycle time: 16 * (attack_time / 100) - (skill / 100)
 * Damage: average damage per fling shot
 */
export function calculateFlingShotDamage(
  weapon: WeaponCandidate,
  state: FiteInputState,
  baseDamage: DamageStats
): number {
  const stats = weapon.stats || []
  const attackTime = stats.find((s) => s.stat === WEAPON_STAT_IDS.ATTACK_DELAY)?.value || 100
  const flingShotSkill = state.specialAttacks[SPECIAL_ATTACK_IDS.FLING_SHOT] || 0

  // Cycle cap: 6 + (attack_time / 100) seconds
  const cycleCap = Math.floor(6 + attackTime / 100)

  // Cycle time: 16 * (attack_time / 100) - (skill / 100)
  let cycleTime = Math.floor(16 * (attackTime / 100) - flingShotSkill / 100)
  if (cycleTime < cycleCap) cycleTime = cycleCap

  // Number of fling shots in 60s sample
  const numAttacks = Math.floor(SAMPLE_LENGTH / cycleTime)

  // Damage per fling shot = base average damage
  return Math.round(baseDamage.avgDamage * numAttacks)
}

/**
 * Calculate Burst damage
 *
 * Legacy source: views.py line 271
 *
 * Cycle cap: 8 + (attack_time / 100) seconds
 * Cycle time: (rech_time / 100) * 20 + (burst_cycle / 100) - (skill / 25)
 * Damage: 3x base damage per burst
 */
export function calculateBurstDamage(
  weapon: WeaponCandidate,
  state: FiteInputState,
  baseDamage: DamageStats
): number {
  const stats = weapon.stats || []
  const attackTime = stats.find((s) => s.stat === WEAPON_STAT_IDS.ATTACK_DELAY)?.value || 100
  const rechargeTime = stats.find((s) => s.stat === WEAPON_STAT_IDS.RECHARGE_DELAY)?.value || 100
  const burstCycle = stats.find((s) => s.stat === WEAPON_STAT_IDS.BURST_RECHARGE)?.value || 0
  const burstSkill = state.specialAttacks[SPECIAL_ATTACK_IDS.BURST] || 0

  // Cycle cap: 8 + (attack_time / 100) seconds
  const cycleCap = Math.floor(8 + attackTime / 100)

  // Cycle time: (rech_time / 100) * 20 + (burst_cycle / 100) - (skill / 25)
  let cycleTime = Math.floor((rechargeTime / 100) * 20 + burstCycle / 100 - burstSkill / 25)
  if (cycleTime < cycleCap) cycleTime = cycleCap

  // Number of bursts in 60s sample
  const numAttacks = Math.floor(SAMPLE_LENGTH / cycleTime)

  // Each burst fires 3 shots
  return Math.round(baseDamage.avgDamage * 3 * numAttacks)
}

/**
 * Calculate Full Auto damage with tiered damage caps
 *
 * Legacy source: views.py lines 285-306
 *
 * Cycle cap: 10 + (attack_time / 100) seconds
 * Cycle time: ((rech_time / 100) * 40) + (fa_cycle / 100) - (skill / 25) + (attack_time / 100)
 * Damage: Uses tiered cap system (10k→11.5k→13k→14.5k→15k max)
 * Rounds: All rounds in clip are fired
 */
export function calculateFullAutoDamage(
  weapon: WeaponCandidate,
  state: FiteInputState,
  baseDamage: DamageStats
): number {
  const stats = weapon.stats || []
  const attackTime = stats.find((s) => s.stat === WEAPON_STAT_IDS.ATTACK_DELAY)?.value || 100
  const rechargeTime = stats.find((s) => s.stat === WEAPON_STAT_IDS.RECHARGE_DELAY)?.value || 100
  const faCycle = stats.find((s) => s.stat === WEAPON_STAT_IDS.FULL_AUTO_RECHARGE)?.value || 1000
  const clipSize = stats.find((s) => s.stat === WEAPON_STAT_IDS.CLIP_SIZE)?.value || 0
  const faSkill = state.specialAttacks[SPECIAL_ATTACK_IDS.FULL_AUTO] || 0

  // Cycle cap: 10 + (attack_time / 100) seconds
  const cycleCap = Math.floor(10 + attackTime / 100)

  // Cycle time: ((rech_time / 100) * 40) + (fa_cycle / 100) - (skill / 25) + (attack_time / 100)
  let cycleTime = Math.floor(
    (rechargeTime / 100) * 40 + faCycle / 100 - faSkill / 25 + attackTime / 100
  )
  if (cycleTime < cycleCap) cycleTime = cycleCap

  // Number of rounds = clip size (all rounds fired)
  const numRounds = clipSize

  // Calculate FA damage with tiered caps
  const faDamage = calculateFADamageCaps(baseDamage.avgDamage, numRounds)

  // Number of FAs in 60s sample
  const numAttacks = Math.floor(SAMPLE_LENGTH / cycleTime)

  return Math.round(faDamage * numAttacks)
}

/**
 * Tiered damage cap system for Full Auto
 *
 * Legacy source: calculate_fa_dmg() in views.py line 376
 *
 * Damage caps:
 * - Base damage up to 10,000
 * - 50% of excess up to 11,500 (1,500 added damage)
 * - 50% of excess up to 13,000 (1,500 added damage)
 * - 50% of excess up to 14,500 (1,500 added damage)
 * - 50% of excess up to 15,000 (500 added damage)
 * - Hard cap at 15,000
 */
function calculateFADamageCaps(damagePerRound: number, numRounds: number): number {
  let faDamage = damagePerRound * numRounds

  if (faDamage > 10000) {
    let remain = Math.round((faDamage - 10000) / 2)
    faDamage = 10000

    if (remain > 1500) {
      remain = Math.round((remain - 1500) / 2)
      faDamage = 11500

      if (remain > 1500) {
        remain = Math.round((remain - 1500) / 2)
        faDamage = 13000

        if (remain > 1500) {
          remain = Math.round((remain - 1500) / 2)
          faDamage = 14500

          if (remain > 500) {
            faDamage = 15000
          } else {
            faDamage += remain
          }
        } else {
          faDamage += remain
        }
      } else {
        faDamage += remain
      }
    } else {
      faDamage += remain
    }
  }

  return faDamage
}

/**
 * Calculate Aimed Shot damage
 *
 * Legacy source: views.py line 308
 *
 * PvE rules: Fires only once per fight
 * Damage: (weapon_max * ar_bonus + add_dmg) * (skill / 95)
 * Damage cap: 13,000
 */
export function calculateAimedShotDamage(
  weapon: WeaponCandidate,
  state: FiteInputState,
  baseDamage: DamageStats,
  arBonus: number
): number {
  const stats = weapon.stats || []
  const weaponMaxDmg = stats.find((s) => s.stat === WEAPON_STAT_IDS.MAX_DAMAGE)?.value || 0
  const addDamage = state.combatBonuses.addDamage || 0
  const aimedShotSkill = state.specialAttacks[SPECIAL_ATTACK_IDS.AIMED_SHOT] || 0

  // Aimed shot only fires once per fight (PvE rules)
  // Damage: (weapon_max * ar_bonus + add_dmg) * (skill / 95)
  let asDamage = Math.round(weaponMaxDmg * arBonus + addDamage)
  const asBonus = aimedShotSkill / 95
  asDamage = Math.round(asDamage * asBonus)

  // 13k damage cap
  if (asDamage > 13000) asDamage = 13000

  return asDamage
}

/**
 * Calculate Fast Attack damage
 *
 * Legacy source: views.py line 323
 *
 * Cycle cap: 6 + (attack_time / 100) seconds
 * Cycle time: (attack_time / 100) * 15 - (skill / 100)
 * Damage: average damage per fast attack
 */
export function calculateFastAttackDamage(
  weapon: WeaponCandidate,
  state: FiteInputState,
  baseDamage: DamageStats
): number {
  const stats = weapon.stats || []
  const attackTime = stats.find((s) => s.stat === WEAPON_STAT_IDS.ATTACK_DELAY)?.value || 100
  const fastAttackSkill = state.specialAttacks[SPECIAL_ATTACK_IDS.FAST_ATTACK] || 0

  // Cycle cap: 6 + (attack_time / 100) seconds
  const cycleCap = Math.floor(6 + attackTime / 100)

  // Cycle time: (attack_time / 100) * 15 - (skill / 100)
  let cycleTime = Math.floor((attackTime / 100) * 15 - fastAttackSkill / 100)
  if (cycleTime < cycleCap) cycleTime = cycleCap

  // Number of fast attacks in 60s sample
  const numAttacks = Math.floor(SAMPLE_LENGTH / cycleTime)

  return Math.round(baseDamage.avgDamage * numAttacks)
}

/**
 * Calculate Brawl damage
 *
 * Legacy source: views.py line 333
 *
 * Brawl uses a special "Brawl Item" weapon
 * TODO: Implement Brawl Item lookup and interpolation
 *
 * Legacy logic:
 * 1. Fetch all "Brawl Item" weapons from database
 * 2. Interpolate to find highest equipable QL
 * 3. Calculate damage with AR bonus
 * 4. Fixed 15 second cycle time
 * 5. Number of brawls in 60s sample
 */
export function calculateBrawlDamage(
  weapon: WeaponCandidate,
  state: FiteInputState,
  arBonus: number
): number {
  // Brawl requires fetching "Brawl Item" weapons from API
  // This needs to be implemented when API supports item lookup by name
  console.warn('Brawl damage calculation not yet implemented - requires Brawl Item lookup')
  return 0
}

/**
 * Calculate Sneak Attack damage
 *
 * Legacy source: views.py line 356
 *
 * PvE rules: Fires only once per fight
 * Damage: average_damage * (skill / 95)
 * Damage cap: 13,000
 */
export function calculateSneakAttackDamage(
  weapon: WeaponCandidate,
  state: FiteInputState,
  baseDamage: DamageStats
): number {
  const sneakAttackSkill = state.specialAttacks[SPECIAL_ATTACK_IDS.SNEAK_ATTACK] || 0

  // Sneak attack only fires once per fight (PvE rules)
  const sneakBonus = Math.round(sneakAttackSkill / 95)
  let sneakDamage = Math.round(baseDamage.avgDamage * sneakBonus)

  // 13k damage cap
  if (sneakDamage > 13000) sneakDamage = 13000

  return sneakDamage
}

/**
 * Calculate Dimach damage
 *
 * Legacy source: views.py line 353
 *
 * Not implemented in legacy (pass)
 */
export function calculateDimachDamage(
  weapon: WeaponCandidate,
  state: FiteInputState
): number {
  // Dimach not implemented in legacy
  return 0
}

/**
 * Get list of special attacks supported by a weapon
 *
 * Special attacks are detected from stat 30 (CAN flag) using bit flags.
 *
 * DETECTION METHOD:
 * All special attacks are stored as bit flags in stat 30 (CAN flag).
 * Use CANFLAG enum and isFlagSet() utility from flag-operations.ts.
 *
 * CANFLAG enum values:
 * - Burst: 2048 (1 << 11)
 * - FlingShot: 4096 (1 << 12)
 * - FullAuto: 8192 (1 << 13)
 * - AimedShot: 16384 (1 << 14)
 * - SneakAttack: 131072 (1 << 17)
 * - FastAttack: 262144 (1 << 18)
 * - Brawl: 33554432 (1 << 25)
 * - Dimach: 67108864 (1 << 26)
 *
 * Example: Weapon 201269 has stat 30 value 4101 = 4096 + 4 + 1
 * - 4096 = CANFLAG.FlingShot ✓
 * - 4 = CANFLAG.Wear
 * - 1 = CANFLAG.Carry
 */
export function getWeaponSpecialAttacks(weapon: WeaponCandidate): string[] {
  const specialAttacks: string[] = []
  const stats = weapon.stats || []

  // Get CAN flag value (stat 30)
  const canFlagStat = stats.find(s => s.stat === WEAPON_STAT_IDS.CAN_FLAGS)
  if (!canFlagStat) {
    return specialAttacks
  }

  const canFlags = canFlagStat.value

  // Check each special attack bit flag
  // Note: Lowercase letters in "Aimed shot", "Fast attack", "Sneak attack" match legacy
  if (isFlagSet(canFlags, CANFLAG.FlingShot)) {
    specialAttacks.push('Fling Shot')
  }

  if (isFlagSet(canFlags, CANFLAG.Burst)) {
    specialAttacks.push('Burst')
  }

  if (isFlagSet(canFlags, CANFLAG.FullAuto)) {
    specialAttacks.push('Full Auto')
  }

  if (isFlagSet(canFlags, CANFLAG.AimedShot)) {
    specialAttacks.push('Aimed shot')
  }

  if (isFlagSet(canFlags, CANFLAG.FastAttack)) {
    specialAttacks.push('Fast attack')
  }

  if (isFlagSet(canFlags, CANFLAG.Brawl)) {
    specialAttacks.push('Brawl')
  }

  if (isFlagSet(canFlags, CANFLAG.SneakAttack)) {
    specialAttacks.push('Sneak attack')
  }

  if (isFlagSet(canFlags, CANFLAG.Dimach)) {
    specialAttacks.push('Dimach')
  }

  return specialAttacks
}

/**
 * Calculate all special attack damage for a weapon
 *
 * Legacy source: views.py lines 260-368
 *
 * Checks which special attacks the weapon supports and calculates
 * total damage contribution from all special attacks over 60s sample.
 *
 * All 8 special attacks are now supported via stat 30 (CAN flag) bit detection:
 * - Fling Shot (bit 12)
 * - Burst (bit 11)
 * - Full Auto (bit 13)
 * - Aimed shot (bit 14)
 * - Fast attack (bit 18)
 * - Sneak attack (bit 17)
 * - Brawl (bit 25)
 * - Dimach (bit 26)
 */
export function calculateAllSpecialAttacks(
  weapon: WeaponCandidate,
  state: FiteInputState,
  baseDamage: DamageStats,
  arBonus: number
): SpecialAttackResult {
  // Check which special attacks this weapon supports
  const specialProps = getWeaponSpecialAttacks(weapon)

  let flingShot = 0
  let burst = 0
  let fullAuto = 0
  let aimedShot = 0
  let fastAttack = 0
  let brawl = 0
  let sneakAttack = 0
  let dimach = 0

  // Calculate damage for each special attack the weapon supports
  if (specialProps.includes('Fling Shot')) {
    flingShot = calculateFlingShotDamage(weapon, state, baseDamage)
  }

  if (specialProps.includes('Burst')) {
    burst = calculateBurstDamage(weapon, state, baseDamage)
  }

  if (specialProps.includes('Full Auto')) {
    fullAuto = calculateFullAutoDamage(weapon, state, baseDamage)
  }

  if (specialProps.includes('Aimed shot')) {
    aimedShot = calculateAimedShotDamage(weapon, state, baseDamage, arBonus)
  }

  if (specialProps.includes('Fast attack')) {
    fastAttack = calculateFastAttackDamage(weapon, state, baseDamage)
  }

  if (specialProps.includes('Brawl')) {
    brawl = calculateBrawlDamage(weapon, state, arBonus)
  }

  if (specialProps.includes('Sneak attack')) {
    sneakAttack = calculateSneakAttackDamage(weapon, state, baseDamage)
  }

  if (specialProps.includes('Dimach')) {
    dimach = calculateDimachDamage(weapon, state)
  }

  const total = flingShot + burst + fullAuto + aimedShot + fastAttack + brawl + sneakAttack + dimach

  return {
    flingShot,
    burst,
    fullAuto,
    aimedShot,
    fastAttack,
    brawl,
    sneakAttack,
    dimach,
    total
  }
}

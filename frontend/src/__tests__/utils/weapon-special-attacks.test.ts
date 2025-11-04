/**
 * Tests for Weapon Special Attack Calculations
 *
 * Phase 5: Special Attack Formulas
 * Tests all 8 special attack damage calculations
 */

import { describe, it, expect } from 'vitest'
import {
  calculateFlingShotDamage,
  calculateBurstDamage,
  calculateFullAutoDamage,
  calculateAimedShotDamage,
  calculateFastAttackDamage,
  calculateBrawlDamage,
  calculateSneakAttackDamage,
  calculateDimachDamage,
  calculateAllSpecialAttacks,
  getWeaponSpecialAttacks
} from '@/utils/weapon-special-attacks'
import type { WeaponCandidate, FiteInputState } from '@/types/weapon-analysis'
import type { DamageStats } from '@/utils/weapon-damage-calculations'
import { WEAPON_STAT_IDS, SPECIAL_ATTACK_IDS } from '@/types/weapon-analysis'

describe('weapon-special-attacks', () => {
  // Test fixture: Base damage stats
  const baseDamage: DamageStats = {
    minDamage: 100,
    avgDamage: 150,
    maxDamage: 200,
    critDamage: 250
  }

  // Test fixture: Base weapon
  const createWeapon = (stats: Array<{ stat: number; value: number }>): WeaponCandidate => ({
    id: 1,
    name: 'Test Weapon',
    ql: 200,
    is_nano: false,
    stats: stats.map((s, index) => ({ id: index + 1, ...s })),
    spell_data: [],
    actions: [],
    attack_stats: [],
    defense_stats: [],
    equipable: true
  })

  // Test fixture: Base state
  const createState = (specialAttacks: Record<number, number> = {}): FiteInputState => ({
    characterStats: {
      breed: 1,
      level: 220,
      profession: 0,
      side: 0,
      crit: 0,
      targetAC: 1000,
      aggdef: 75
    },
    weaponSkills: {},
    specialAttacks,
    initiative: {
      meleeInit: 1000,
      physicalInit: 1000,
      rangedInit: 1000
    },
    combatBonuses: {
      aao: 0,
      addDamage: 0,
      wrangle: 0
    }
  })

  describe('calculateFlingShotDamage', () => {
    it('should calculate cycle time with cap', () => {
      const weapon = createWeapon([{ stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 100 }])
      const state = createState({ [SPECIAL_ATTACK_IDS.FLING_SHOT]: 1000 })

      // Cycle cap: 6 + (100 / 100) = 7 seconds
      // Cycle time: 16 * (100 / 100) - (1000 / 100) = 16 - 10 = 6 seconds
      // 6 < 7, so cycle_time = 7 seconds
      // Number of attacks: floor(60 / 7) = 8 attacks
      // Damage: 150 * 8 = 1200

      const damage = calculateFlingShotDamage(weapon, state, baseDamage)
      expect(damage).toBe(1200)
    })

    it('should calculate cycle time without cap applied', () => {
      const weapon = createWeapon([{ stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 300 }])
      const state = createState({ [SPECIAL_ATTACK_IDS.FLING_SHOT]: 500 })

      // Cycle cap: 6 + (300 / 100) = 9 seconds
      // Cycle time: 16 * (300 / 100) - (500 / 100) = 48 - 5 = 43 seconds
      // 43 > 9, so cycle_time = 43 seconds (cap not applied)
      // Number of attacks: floor(60 / 43) = 1 attack
      // Damage: 150 * 1 = 150

      const damage = calculateFlingShotDamage(weapon, state, baseDamage)
      expect(damage).toBe(150)
    })
  })

  describe('calculateBurstDamage', () => {
    it('should calculate burst damage (3x multiplier)', () => {
      const weapon = createWeapon([
        { stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 100 },
        { stat: WEAPON_STAT_IDS.RECHARGE_DELAY, value: 100 },
        { stat: WEAPON_STAT_IDS.BURST_RECHARGE, value: 0 }
      ])
      const state = createState({ [SPECIAL_ATTACK_IDS.BURST]: 1000 })

      // Cycle cap: 8 + (100 / 100) = 9 seconds
      // Cycle time: (100 / 100) * 20 + (0 / 100) - (1000 / 25) = 20 + 0 - 40 = -20 seconds
      // -20 < 9, so cycle_time = 9 seconds
      // Number of attacks: floor(60 / 9) = 6 bursts
      // Damage: 150 * 3 * 6 = 2700

      const damage = calculateBurstDamage(weapon, state, baseDamage)
      expect(damage).toBe(2700)
    })
  })

  describe('calculateFullAutoDamage', () => {
    it('should apply tiered damage caps for high damage', () => {
      const weapon = createWeapon([
        { stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 100 },
        { stat: WEAPON_STAT_IDS.RECHARGE_DELAY, value: 100 },
        { stat: WEAPON_STAT_IDS.FULL_AUTO_RECHARGE, value: 1000 },
        { stat: WEAPON_STAT_IDS.CLIP_SIZE, value: 100 } // High clip for testing caps
      ])
      const state = createState({ [SPECIAL_ATTACK_IDS.FULL_AUTO]: 2000 })

      // Cycle cap: 10 + (100 / 100) = 11 seconds
      // Cycle time: ((100 / 100) * 40) + (1000 / 100) - (2000 / 25) + (100 / 100)
      //           = 40 + 10 - 80 + 1 = -29 seconds
      // -29 < 11, so cycle_time = 11 seconds
      // Number of rounds: 100
      // Raw damage: 150 * 100 = 15,000
      // Apply tiered caps:
      //   15,000 > 10,000: remain = (15,000 - 10,000) / 2 = 2,500
      //   fa_dmg = 10,000
      //   2,500 > 1,500: remain = (2,500 - 1,500) / 2 = 500
      //   fa_dmg = 11,500
      //   500 < 1,500: fa_dmg = 11,500 + 500 = 12,000
      // Number of FAs: floor(60 / 11) = 5 attacks
      // Total damage: 12,000 * 5 = 60,000

      const damage = calculateFullAutoDamage(weapon, state, baseDamage)
      expect(damage).toBe(60000)
    })

    it('should apply tier 1 cap only for moderate damage', () => {
      const weapon = createWeapon([
        { stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 100 },
        { stat: WEAPON_STAT_IDS.RECHARGE_DELAY, value: 100 },
        { stat: WEAPON_STAT_IDS.FULL_AUTO_RECHARGE, value: 1000 },
        { stat: WEAPON_STAT_IDS.CLIP_SIZE, value: 80 }
      ])
      const state = createState({ [SPECIAL_ATTACK_IDS.FULL_AUTO]: 2000 })

      // Raw damage: 150 * 80 = 12,000
      // Apply tiered caps:
      //   12,000 > 10,000: remain = (12,000 - 10,000) / 2 = 1,000
      //   fa_dmg = 10,000
      //   1,000 < 1,500: fa_dmg = 10,000 + 1,000 = 11,000
      // Number of FAs: floor(60 / 11) = 5 attacks
      // Total damage: 11,000 * 5 = 55,000

      const damage = calculateFullAutoDamage(weapon, state, baseDamage)
      expect(damage).toBe(55000)
    })

    it('should not apply caps for low damage', () => {
      const weapon = createWeapon([
        { stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 100 },
        { stat: WEAPON_STAT_IDS.RECHARGE_DELAY, value: 100 },
        { stat: WEAPON_STAT_IDS.FULL_AUTO_RECHARGE, value: 1000 },
        { stat: WEAPON_STAT_IDS.CLIP_SIZE, value: 50 }
      ])
      const state = createState({ [SPECIAL_ATTACK_IDS.FULL_AUTO]: 2000 })

      // Raw damage: 150 * 50 = 7,500
      // 7,500 < 10,000: no caps applied
      // Number of FAs: floor(60 / 11) = 5 attacks
      // Total damage: 7,500 * 5 = 37,500

      const damage = calculateFullAutoDamage(weapon, state, baseDamage)
      expect(damage).toBe(37500)
    })
  })

  describe('calculateAimedShotDamage', () => {
    it('should calculate aimed shot damage with skill bonus', () => {
      const weapon = createWeapon([{ stat: WEAPON_STAT_IDS.MAX_DAMAGE, value: 500 }])
      const state = createState({ [SPECIAL_ATTACK_IDS.AIMED_SHOT]: 1900 })
      state.combatBonuses.addDamage = 200
      const arBonus = 2.5

      // Damage: (500 * 2.5 + 200) * (1900 / 95) = 1450 * 20 = 29,000
      // Cap: 13,000
      // Final: 13,000

      const damage = calculateAimedShotDamage(weapon, state, baseDamage, arBonus)
      expect(damage).toBe(13000)
    })

    it('should not cap damage below 13k', () => {
      const weapon = createWeapon([{ stat: WEAPON_STAT_IDS.MAX_DAMAGE, value: 200 }])
      const state = createState({ [SPECIAL_ATTACK_IDS.AIMED_SHOT]: 950 })
      state.combatBonuses.addDamage = 100
      const arBonus = 2.0

      // Damage: (200 * 2.0 + 100) * (950 / 95) = 500 * 10 = 5,000
      // No cap applied
      // Final: 5,000

      const damage = calculateAimedShotDamage(weapon, state, baseDamage, arBonus)
      expect(damage).toBe(5000)
    })
  })

  describe('calculateFastAttackDamage', () => {
    it('should calculate fast attack damage with cycle cap', () => {
      const weapon = createWeapon([{ stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 100 }])
      const state = createState({ [SPECIAL_ATTACK_IDS.FAST_ATTACK]: 1500 })

      // Cycle cap: 6 + (100 / 100) = 7 seconds
      // Cycle time: (100 / 100) * 15 - (1500 / 100) = 15 - 15 = 0 seconds
      // 0 < 7, so cycle_time = 7 seconds
      // Number of attacks: floor(60 / 7) = 8 attacks
      // Damage: 150 * 8 = 1,200

      const damage = calculateFastAttackDamage(weapon, state, baseDamage)
      expect(damage).toBe(1200)
    })
  })

  describe('calculateBrawlDamage', () => {
    it('should return 0 (not yet implemented)', () => {
      const weapon = createWeapon([])
      const state = createState({ [SPECIAL_ATTACK_IDS.BRAWL]: 2000 })
      const arBonus = 2.0

      const damage = calculateBrawlDamage(weapon, state, arBonus)
      expect(damage).toBe(0)
    })
  })

  describe('calculateSneakAttackDamage', () => {
    it('should calculate sneak attack damage with cap', () => {
      const weapon = createWeapon([])
      const state = createState({ [SPECIAL_ATTACK_IDS.SNEAK_ATTACK]: 2000 })

      // Bonus: round(2000 / 95) = 21
      // Damage: 150 * 21 = 3,150
      // No cap applied (< 13,000)
      // Final: 3,150

      const damage = calculateSneakAttackDamage(weapon, state, baseDamage)
      expect(damage).toBe(3150)
    })

    it('should apply 13k damage cap', () => {
      const weapon = createWeapon([])
      const state = createState({ [SPECIAL_ATTACK_IDS.SNEAK_ATTACK]: 9500 })

      // Bonus: round(9500 / 95) = 100
      // Damage: 150 * 100 = 15,000
      // Cap: 13,000
      // Final: 13,000

      const damage = calculateSneakAttackDamage(weapon, state, baseDamage)
      expect(damage).toBe(13000)
    })
  })

  describe('calculateDimachDamage', () => {
    it('should return 0 (not implemented)', () => {
      const weapon = createWeapon([])
      const state = createState({ [SPECIAL_ATTACK_IDS.DIMACH]: 2000 })

      const damage = calculateDimachDamage(weapon, state)
      expect(damage).toBe(0)
    })
  })

  describe('getWeaponSpecialAttacks', () => {
    // CANFLAG bit values for reference:
    // Burst: 2048 (1 << 11)
    // FlingShot: 4096 (1 << 12)
    // FullAuto: 8192 (1 << 13)
    // AimedShot: 16384 (1 << 14)
    // SneakAttack: 131072 (1 << 17)
    // FastAttack: 262144 (1 << 18)
    // Brawl: 33554432 (1 << 25)
    // Dimach: 67108864 (1 << 26)

    it('should detect Fling Shot from stat 30 bit flag (4096)', () => {
      const weapon = createWeapon([{ stat: 30, value: 4096 }]) // CANFLAG.FlingShot
      const specialAttacks = getWeaponSpecialAttacks(weapon)
      expect(specialAttacks).toContain('Fling Shot')
      expect(specialAttacks.length).toBe(1)
    })

    it('should detect Burst from stat 30 bit flag (2048)', () => {
      const weapon = createWeapon([{ stat: 30, value: 2048 }]) // CANFLAG.Burst
      const specialAttacks = getWeaponSpecialAttacks(weapon)
      expect(specialAttacks).toContain('Burst')
      expect(specialAttacks.length).toBe(1)
    })

    it('should detect Full Auto from stat 30 bit flag (8192)', () => {
      const weapon = createWeapon([{ stat: 30, value: 8192 }]) // CANFLAG.FullAuto
      const specialAttacks = getWeaponSpecialAttacks(weapon)
      expect(specialAttacks).toContain('Full Auto')
      expect(specialAttacks.length).toBe(1)
    })

    it('should detect Aimed shot from stat 30 bit flag (16384)', () => {
      const weapon = createWeapon([{ stat: 30, value: 16384 }]) // CANFLAG.AimedShot
      const specialAttacks = getWeaponSpecialAttacks(weapon)
      expect(specialAttacks).toContain('Aimed shot')
      expect(specialAttacks.length).toBe(1)
    })

    it('should detect Fast attack from stat 30 bit flag (262144)', () => {
      const weapon = createWeapon([{ stat: 30, value: 262144 }]) // CANFLAG.FastAttack
      const specialAttacks = getWeaponSpecialAttacks(weapon)
      expect(specialAttacks).toContain('Fast attack')
      expect(specialAttacks.length).toBe(1)
    })

    it('should detect Sneak attack from stat 30 bit flag (131072)', () => {
      const weapon = createWeapon([{ stat: 30, value: 131072 }]) // CANFLAG.SneakAttack
      const specialAttacks = getWeaponSpecialAttacks(weapon)
      expect(specialAttacks).toContain('Sneak attack')
      expect(specialAttacks.length).toBe(1)
    })

    it('should detect Brawl from stat 30 bit flag (33554432)', () => {
      const weapon = createWeapon([{ stat: 30, value: 33554432 }]) // CANFLAG.Brawl
      const specialAttacks = getWeaponSpecialAttacks(weapon)
      expect(specialAttacks).toContain('Brawl')
      expect(specialAttacks.length).toBe(1)
    })

    it('should detect Dimach from stat 30 bit flag (67108864)', () => {
      const weapon = createWeapon([{ stat: 30, value: 67108864 }]) // CANFLAG.Dimach
      const specialAttacks = getWeaponSpecialAttacks(weapon)
      expect(specialAttacks).toContain('Dimach')
      expect(specialAttacks.length).toBe(1)
    })

    it('should detect multiple special attacks when multiple bits set', () => {
      // Burst (2048) + Full Auto (8192) = 10240
      const weapon = createWeapon([{ stat: 30, value: 10240 }])
      const specialAttacks = getWeaponSpecialAttacks(weapon)
      expect(specialAttacks).toContain('Burst')
      expect(specialAttacks).toContain('Full Auto')
      expect(specialAttacks.length).toBe(2)
    })

    it('should detect Fling Shot from real weapon 201269 (stat 30 value 4101)', () => {
      // Weapon 201269 has stat 30 value 4101 = 4096 (FlingShot) + 4 (Wear) + 1 (Carry)
      const weapon = createWeapon([{ stat: 30, value: 4101 }])
      const specialAttacks = getWeaponSpecialAttacks(weapon)
      expect(specialAttacks).toContain('Fling Shot')
      expect(specialAttacks.length).toBe(1)
    })

    it('should return empty array when stat 30 not present', () => {
      const weapon = createWeapon([{ stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 100 }])
      const specialAttacks = getWeaponSpecialAttacks(weapon)
      expect(specialAttacks).toEqual([])
    })

    it('should return empty array when stat 30 has no special attack flags set', () => {
      // Carry (1) + Wear (4) + Use (8) = 13 (no special attack bits)
      const weapon = createWeapon([{ stat: 30, value: 13 }])
      const specialAttacks = getWeaponSpecialAttacks(weapon)
      expect(specialAttacks).toEqual([])
    })
  })

  describe('calculateAllSpecialAttacks', () => {
    it('should return zeros when no special attacks available', () => {
      const weapon = createWeapon([])
      const state = createState()
      const arBonus = 2.0

      const result = calculateAllSpecialAttacks(weapon, state, baseDamage, arBonus)

      expect(result).toEqual({
        flingShot: 0,
        burst: 0,
        fullAuto: 0,
        aimedShot: 0,
        fastAttack: 0,
        brawl: 0,
        sneakAttack: 0,
        dimach: 0,
        total: 0
      })
    })

    it('should calculate Fling Shot damage when weapon has stat 30 bit flag', () => {
      const weapon = createWeapon([
        { stat: 30, value: 4096 }, // CANFLAG.FlingShot
        { stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 100 }
      ])
      const state = createState({
        [SPECIAL_ATTACK_IDS.FLING_SHOT]: 1000
      })
      const arBonus = 2.0

      const result = calculateAllSpecialAttacks(weapon, state, baseDamage, arBonus)

      expect(result.flingShot).toBe(1200) // Same as individual test
      expect(result.burst).toBe(0)
      expect(result.fullAuto).toBe(0)
      expect(result.total).toBe(1200)
    })

    it('should calculate Burst damage when weapon has stat 30 bit flag', () => {
      const weapon = createWeapon([
        { stat: 30, value: 2048 }, // CANFLAG.Burst
        { stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 100 },
        { stat: WEAPON_STAT_IDS.RECHARGE_DELAY, value: 100 },
        { stat: WEAPON_STAT_IDS.BURST_RECHARGE, value: 0 }
      ])
      const state = createState({
        [SPECIAL_ATTACK_IDS.BURST]: 1000
      })
      const arBonus = 2.0

      const result = calculateAllSpecialAttacks(weapon, state, baseDamage, arBonus)

      expect(result.burst).toBe(2700) // Same as individual test
      expect(result.flingShot).toBe(0)
      expect(result.fullAuto).toBe(0)
      expect(result.total).toBe(2700)
    })

    it('should calculate Full Auto damage when weapon has stat 30 bit flag', () => {
      const weapon = createWeapon([
        { stat: 30, value: 8192 }, // CANFLAG.FullAuto
        { stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 100 },
        { stat: WEAPON_STAT_IDS.RECHARGE_DELAY, value: 100 },
        { stat: WEAPON_STAT_IDS.FULL_AUTO_RECHARGE, value: 1000 },
        { stat: WEAPON_STAT_IDS.CLIP_SIZE, value: 50 }
      ])
      const state = createState({
        [SPECIAL_ATTACK_IDS.FULL_AUTO]: 2000
      })
      const arBonus = 2.0

      const result = calculateAllSpecialAttacks(weapon, state, baseDamage, arBonus)

      expect(result.fullAuto).toBe(37500) // Same as individual test
      expect(result.flingShot).toBe(0)
      expect(result.burst).toBe(0)
      expect(result.total).toBe(37500)
    })

    it('should calculate both Burst and Full Auto when both bits set', () => {
      const weapon = createWeapon([
        { stat: 30, value: 10240 }, // CANFLAG.Burst (2048) + CANFLAG.FullAuto (8192)
        { stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 100 },
        { stat: WEAPON_STAT_IDS.RECHARGE_DELAY, value: 100 },
        { stat: WEAPON_STAT_IDS.BURST_RECHARGE, value: 0 },
        { stat: WEAPON_STAT_IDS.FULL_AUTO_RECHARGE, value: 1000 },
        { stat: WEAPON_STAT_IDS.CLIP_SIZE, value: 50 }
      ])
      const state = createState({
        [SPECIAL_ATTACK_IDS.BURST]: 1000,
        [SPECIAL_ATTACK_IDS.FULL_AUTO]: 2000
      })
      const arBonus = 2.0

      const result = calculateAllSpecialAttacks(weapon, state, baseDamage, arBonus)

      expect(result.burst).toBe(2700)
      expect(result.fullAuto).toBe(37500)
      expect(result.flingShot).toBe(0)
      expect(result.total).toBe(40200)
    })

    it('should calculate damage for multiple special attacks when multiple bits set', () => {
      // Test a more realistic scenario with Fling Shot + Aimed shot + Fast attack
      // FlingShot (4096) + AimedShot (16384) + FastAttack (262144) = 282624
      const weapon = createWeapon([
        { stat: 30, value: 282624 },
        { stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 100 },
        { stat: WEAPON_STAT_IDS.MAX_DAMAGE, value: 200 }
      ])
      const state = createState({
        [SPECIAL_ATTACK_IDS.FLING_SHOT]: 1000,
        [SPECIAL_ATTACK_IDS.AIMED_SHOT]: 1900,
        [SPECIAL_ATTACK_IDS.FAST_ATTACK]: 1500
      })
      state.combatBonuses.addDamage = 200
      const arBonus = 2.5

      const result = calculateAllSpecialAttacks(weapon, state, baseDamage, arBonus)

      // Check detected special attacks
      expect(result.flingShot).toBe(1200)
      expect(result.aimedShot).toBe(13000) // Capped
      expect(result.fastAttack).toBe(1200)
      // Others should be 0
      expect(result.burst).toBe(0)
      expect(result.fullAuto).toBe(0)
      expect(result.sneakAttack).toBe(0)
      expect(result.brawl).toBe(0)
      expect(result.dimach).toBe(0)
      expect(result.total).toBe(15400)
    })
  })
})

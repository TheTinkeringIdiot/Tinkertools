/**
 * TinkerNukes Calculation Tests
 *
 * Comprehensive test suite for offensive nano calculation utilities:
 * - Damage calculation edge cases
 * - Cast time two-tier scaling
 * - Nano cost breed caps
 * - Nano regen tick speed
 * - Sustain calculations
 * - DPS with DoT
 * - Legacy TinkerNukes value validation
 */

import { describe, it, expect } from 'vitest'
import {
  calculateDamage,
  calculateDoTDamage,
  calculateModifiedDamage,
  calculateNanoDamage,
  parseDamageType,
  getTypeModifier,
  formatDamage,
  formatDamageRange,
  type DamageModifiers,
  type SpellDamage,
} from '@/utils/nuke-damage-calculations'
import {
  calculateCastTime,
  calculateRechargeTime,
  calculateNanoCost,
  centisecondsToSeconds,
  formatTime,
  type Breed,
} from '@/utils/nuke-casting-calculations'
import {
  calculateTickSpeed,
  calculateBaseDelta,
  calculateNanoRegen,
  calculateSustainTime,
  calculateCastsToEmpty,
  type NanoRegenBuffs,
} from '@/utils/nuke-regen-calculations'
import {
  calculateDPS,
  calculateDamagePerNano,
  calculateNanoPerSecond,
  calculateSustainMetrics,
  calculateAllEfficiencyMetrics,
  formatSustainTime,
  formatCastsToEmpty,
} from '@/utils/nuke-efficiency-calculations'

// ============================================================================
// Test Data & Fixtures
// ============================================================================

const defaultModifiers: DamageModifiers = {
  projectileDamage: 0,
  meleeDamage: 0,
  energyDamage: 0,
  chemicalDamage: 0,
  radiationDamage: 0,
  coldDamage: 0,
  nanoDamage: 0,
  fireDamage: 0,
  poisonDamage: 0,
  directNanoDamageEfficiency: 0,
}

const defaultRegenBuffs: NanoRegenBuffs = {
  humidity: 0,
  notumSiphon: 0,
  channeling: 0,
}

// ============================================================================
// Damage Calculation Tests
// ============================================================================

describe('Damage Calculations', () => {
  describe('calculateDamage - 4-tier pipeline', () => {
    it('should apply base damage + type modifier + nano modifier (tier 1)', () => {
      const result = calculateDamage(100, 20, 10, 0, 0, 0)
      expect(result).toBe(130) // 100 + 20 + 10
    })

    it('should apply Direct Nano Damage Efficiency as percentage (tier 2)', () => {
      // 100 base + 0 modifiers = 100
      // DNDE 20% = 100 * 1.20 = 120
      const result = calculateDamage(100, 0, 0, 20, 0, 0)
      expect(result).toBe(120)
    })

    it('should apply AC reduction with Math.floor(AC/10) (tier 3)', () => {
      // 100 base, AC 25 = floor(25/10) = 2 reduction
      const result = calculateDamage(100, 0, 0, 0, 25, 0)
      expect(result).toBe(98)
    })

    it('should floor AC reduction correctly', () => {
      // AC 19 = floor(19/10) = 1 reduction
      const result = calculateDamage(100, 0, 0, 0, 19, 0)
      expect(result).toBe(99)

      // AC 29 = floor(29/10) = 2 reduction
      const result2 = calculateDamage(100, 0, 0, 0, 29, 0)
      expect(result2).toBe(98)
    })

    it('should clamp damage to MinValue floor (tier 4)', () => {
      // 50 base - floor(100/10) = 50 - 10 = 40, which is above MinValue 30
      // To actually trigger clamping: 20 base - floor(100/10) = 20 - 10 = 10, clamped to MinValue 30
      const result = calculateDamage(20, 0, 0, 0, 100, 30)
      expect(result).toBe(30)
    })

    it('should apply full 4-tier pipeline correctly', () => {
      // Base: 100
      // + Type modifier: 20
      // + Nano modifier: 10
      // = 130
      // * DNDE (15%): 130 * 1.15 = 149.5
      // - AC reduction: floor(35/10) = 3, so 149.5 - 3 = 146.5
      // MinValue floor: 50 (146.5 > 50, no clamping)
      const result = calculateDamage(100, 20, 10, 15, 35, 50)
      expect(result).toBe(146.5)
    })

    it('should handle negative damage gracefully with MinValue', () => {
      // Heavy AC reduction: 1000 AC = 100 reduction
      // 50 - 100 = -50, clamped to MinValue 10
      const result = calculateDamage(50, 0, 0, 0, 1000, 10)
      expect(result).toBe(10)
    })
  })

  describe('calculateDoTDamage', () => {
    it('should multiply damage by tick count', () => {
      const result = calculateDoTDamage(100, 5)
      expect(result).toBe(500)
    })

    it('should handle single tick (instant damage)', () => {
      const result = calculateDoTDamage(100, 1)
      expect(result).toBe(100)
    })

    it('should handle large tick counts', () => {
      const result = calculateDoTDamage(50, 20)
      expect(result).toBe(1000)
    })
  })

  describe('parseDamageType', () => {
    it('should map modifier_stat to damage type stat IDs', () => {
      expect(parseDamageType(90)).toBe(278) // Projectile
      expect(parseDamageType(91)).toBe(279) // Melee
      expect(parseDamageType(92)).toBe(280) // Energy
      expect(parseDamageType(93)).toBe(281) // Chemical
      expect(parseDamageType(94)).toBe(282) // Radiation
      expect(parseDamageType(95)).toBe(311) // Cold
      expect(parseDamageType(96)).toBe(317) // Poison
      expect(parseDamageType(97)).toBe(316) // Fire
    })

    it('should default to nano damage (315) for unknown types', () => {
      expect(parseDamageType(999)).toBe(315)
      expect(parseDamageType(0)).toBe(315)
    })
  })

  describe('getTypeModifier', () => {
    it('should extract correct modifier values from DamageModifiers object', () => {
      const modifiers: DamageModifiers = {
        ...defaultModifiers,
        projectileDamage: 10,
        fireDamage: 25,
        energyDamage: 15,
      }

      expect(getTypeModifier(278, modifiers)).toBe(10) // Projectile
      expect(getTypeModifier(316, modifiers)).toBe(25) // Fire
      expect(getTypeModifier(280, modifiers)).toBe(15) // Energy
    })

    it('should return 0 for unknown stat IDs', () => {
      expect(getTypeModifier(999, defaultModifiers)).toBe(0)
    })
  })

  describe('calculateModifiedDamage', () => {
    it('should calculate min, mid, max damage with absolute values', () => {
      const spell: SpellDamage = {
        minValue: -100, // Database stores as negative for offensive
        maxValue: -200,
        modifierStat: 90, // Projectile
      }

      const modifiers: DamageModifiers = {
        ...defaultModifiers,
        projectileDamage: 20,
        nanoDamage: 10,
        directNanoDamageEfficiency: 15,
      }

      const result = calculateModifiedDamage(spell, modifiers, 0)

      // Min: 100 + 20 + 10 = 130, * 1.15 = 149.5
      expect(result.min).toBe(149.5)
      // Max: 200 + 20 + 10 = 230, * 1.15 = 264.5
      expect(result.max).toBe(264.5)
      // Mid: (149.5 + 264.5) / 2 = 207
      expect(result.mid).toBe(207)
    })

    it('should floor max damage to MinValue', () => {
      const spell: SpellDamage = {
        minValue: -50,
        maxValue: -60,
        modifierStat: 90,
      }

      const result = calculateModifiedDamage(spell, defaultModifiers, 100)

      // Min: 50 - floor(100/10) = 50 - 10 = 40, clamped to 50 = 50
      // Max: 60 - floor(100/10) = 60 - 10 = 50, clamped to 50 = 50
      expect(result.min).toBe(50)
      expect(result.max).toBe(50)
    })
  })

  describe('calculateNanoDamage - multi-spell aggregation', () => {
    it('should aggregate damage from multiple instant spells', () => {
      const spells: SpellDamage[] = [
        { minValue: -100, maxValue: -150, modifierStat: 90 },
        { minValue: -50, maxValue: -80, modifierStat: 97 },
      ]

      const result = calculateNanoDamage(spells, defaultModifiers, 0)

      expect(result.min).toBe(150) // 100 + 50
      expect(result.max).toBe(230) // 150 + 80
      expect(result.mid).toBe(190) // (150 + 230) / 2
      expect(result.isDoT).toBe(false)
    })

    it('should multiply DoT damage by tick count', () => {
      const spells: SpellDamage[] = [
        {
          minValue: -100,
          maxValue: -150,
          modifierStat: 90,
          tickCount: 5,
        },
      ]

      const result = calculateNanoDamage(spells, defaultModifiers, 0)

      expect(result.min).toBe(500) // 100 * 5
      expect(result.max).toBe(750) // 150 * 5
      expect(result.mid).toBe(625) // (500 + 750) / 2
      expect(result.isDoT).toBe(true)
      expect(result.totalTickCount).toBe(5)
    })

    it('should combine instant and DoT spells correctly', () => {
      const spells: SpellDamage[] = [
        { minValue: -50, maxValue: -80, modifierStat: 90 }, // Instant
        {
          minValue: -100,
          maxValue: -150,
          modifierStat: 97,
          tickCount: 3,
        }, // DoT
      ]

      const result = calculateNanoDamage(spells, defaultModifiers, 0)

      // Instant: 50-80
      // DoT: (100-150) * 3 = 300-450
      // Total: 350-530
      expect(result.min).toBe(350)
      expect(result.max).toBe(530)
      expect(result.isDoT).toBe(true)
    })
  })

  describe('formatDamage', () => {
    it('should format damage with 2 decimal places by default', () => {
      expect(formatDamage(123.456)).toBe('123.46')
      expect(formatDamage(100)).toBe('100.00')
    })

    it('should support custom decimal places', () => {
      expect(formatDamage(123.456, 1)).toBe('123.5')
      expect(formatDamage(123.456, 0)).toBe('123')
    })
  })

  describe('formatDamageRange', () => {
    it('should format damage range as "min-max" with rounding', () => {
      expect(formatDamageRange(123.4, 456.7)).toBe('123-457')
      expect(formatDamageRange(100, 200)).toBe('100-200')
    })
  })
})

// ============================================================================
// Casting Calculation Tests
// ============================================================================

describe('Casting Calculations', () => {
  describe('calculateCastTime - two-tier scaling', () => {
    it('should apply 1:2 ratio below 1200 init', () => {
      // 600 init = 300cs reduction
      // 300cs base - 300cs = 0cs = 0.00s
      expect(calculateCastTime(300, 600)).toBe(0.0)

      // 400 init = 200cs reduction
      // 500cs base - 200cs = 300cs = 3.00s
      expect(calculateCastTime(500, 400)).toBe(3.0)
    })

    it('should apply 1:6 ratio above 1200 init', () => {
      // 1200 init: floor(1200/2) + floor(0/6) = 600 + 0 = 600cs reduction
      // 1000cs - 600cs = 400cs = 4.00s
      expect(calculateCastTime(1000, 1200)).toBe(4.0)

      // 1800 init: floor(1800/2) + floor(600/6) = 900 + 100 = 1000cs reduction
      // 1000cs - 1000cs = 0cs = 0.00s
      expect(calculateCastTime(1000, 1800)).toBe(0.0)

      // 1806 init: floor(1806/2) + floor(606/6) = 903 + 101 = 1004cs reduction
      // 1000cs - 1004cs = 0cs (clamped to 0) = 0.00s
      expect(calculateCastTime(1000, 1806)).toBe(0.0)
    })

    it('should use Math.floor for both tiers', () => {
      // 601 init: floor(601/2) = 300cs (not 300.5)
      expect(calculateCastTime(500, 601)).toBe(2.0) // 500 - 300 = 200cs

      // 1201 init: floor(1201/2) + floor(1/6) = 600 + 0 = 600cs
      expect(calculateCastTime(1000, 1201)).toBe(4.0) // 1000 - 600 = 400cs

      // 1206 init: floor(1206/2) + floor(6/6) = 603 + 1 = 604cs
      expect(calculateCastTime(1000, 1206)).toBe(3.96) // 1000 - 604 = 396cs
    })

    it('should never go below 0 cast time', () => {
      expect(calculateCastTime(100, 5000)).toBe(0.0)
      expect(calculateCastTime(0, 1000)).toBe(0.0)
    })

    it('should handle legacy TinkerNukes examples', () => {
      // Example: 300cs base, 1200 init
      expect(calculateCastTime(300, 1200)).toBe(0.0) // 300 - 600 = 0
    })
  })

  describe('calculateRechargeTime', () => {
    it('should use same two-tier formula as cast time', () => {
      // Same test cases as cast time
      expect(calculateRechargeTime(500, 1200)).toBe(0.0) // 500 - 600 = 0

      // 1800 init on 2000cs recharge
      expect(calculateRechargeTime(2000, 1800)).toBe(10.0) // 2000 - 1000 = 1000cs
    })

    it('should never go below 0 recharge time', () => {
      expect(calculateRechargeTime(100, 5000)).toBe(0.0)
    })
  })

  describe('calculateNanoCost - breed caps', () => {
    it('should apply Solitus 50% cap (breed 1)', () => {
      // 1000 base, 60% reduction -> capped at 50%
      expect(calculateNanoCost(1000, 60, 1)).toBe(500)

      // 1000 base, 40% reduction -> no capping
      expect(calculateNanoCost(1000, 40, 1)).toBe(600)

      // 1000 base, 50% reduction -> exact cap
      expect(calculateNanoCost(1000, 50, 1)).toBe(500)
    })

    it('should apply Opifex 50% cap (breed 2)', () => {
      // Same as Solitus
      expect(calculateNanoCost(1000, 60, 2)).toBe(500)
      expect(calculateNanoCost(1000, 40, 2)).toBe(600)
    })

    it('should apply Nanomage 55% cap (breed 3)', () => {
      // 1000 base, 60% reduction -> capped at 55%
      expect(calculateNanoCost(1000, 60, 3)).toBe(450)

      // 1000 base, 50% reduction -> no capping
      expect(calculateNanoCost(1000, 50, 3)).toBe(500)

      // 1000 base, 55% reduction -> exact cap
      expect(calculateNanoCost(1000, 55, 3)).toBe(450)
    })

    it('should apply Atrox 45% cap (breed 4)', () => {
      // 1000 base, 50% reduction -> capped at 45%
      expect(calculateNanoCost(1000, 50, 4)).toBe(550)

      // 1000 base, 40% reduction -> no capping
      expect(calculateNanoCost(1000, 40, 4)).toBe(600)

      // 1000 base, 45% reduction -> exact cap
      expect(calculateNanoCost(1000, 45, 4)).toBe(550)
    })

    it('should round to nearest integer', () => {
      // 999 * 0.5 = 499.5 -> 500
      expect(calculateNanoCost(999, 50, 1)).toBe(500)

      // 1001 * 0.5 = 500.5 -> 501
      expect(calculateNanoCost(1001, 50, 1)).toBe(501)
    })

    it('should handle legacy TinkerNukes examples', () => {
      // Example: Nanomage with 1000 base, 60% reduction (capped at 55%)
      expect(calculateNanoCost(1000, 60, 3)).toBe(450)

      // Example: Atrox with 500 base, 50% reduction (capped at 45%)
      expect(calculateNanoCost(500, 50, 4)).toBe(275)
    })
  })

  describe('centisecondsToSeconds', () => {
    it('should convert centiseconds to seconds with 2 decimals', () => {
      expect(centisecondsToSeconds(100)).toBe(1.0)
      expect(centisecondsToSeconds(150)).toBe(1.5)
      expect(centisecondsToSeconds(3000)).toBe(30.0)
      expect(centisecondsToSeconds(0)).toBe(0.0)
    })

    it('should use .toFixed(2) for precision', () => {
      expect(centisecondsToSeconds(333)).toBe(3.33)
      expect(centisecondsToSeconds(167)).toBe(1.67)
    })
  })

  describe('formatTime', () => {
    it('should format seconds below 60 as "XXs"', () => {
      expect(formatTime(0)).toBe('0s')
      expect(formatTime(30)).toBe('30s')
      expect(formatTime(59)).toBe('59s')
    })

    it('should format 60+ seconds as "Xm Ys"', () => {
      expect(formatTime(60)).toBe('1m 0s')
      expect(formatTime(90)).toBe('1m 30s')
      expect(formatTime(150)).toBe('2m 30s')
      expect(formatTime(3661)).toBe('61m 1s')
    })

    it('should floor seconds in display', () => {
      expect(formatTime(59.9)).toBe('59s')
      expect(formatTime(90.7)).toBe('1m 30s')
    })
  })
})

// ============================================================================
// Nano Regen Tests
// ============================================================================

describe('Nano Regen Calculations', () => {
  describe('calculateTickSpeed - psychic scaling', () => {
    it('should use formula: 28 - floor((psychic-1)/60)*2', () => {
      // Psychic 1: 28 - floor(0/60)*2 = 28 - 0 = 28
      expect(calculateTickSpeed(1)).toBe(28)

      // Psychic 60: 28 - floor(59/60)*2 = 28 - 0 = 28
      expect(calculateTickSpeed(60)).toBe(28)

      // Psychic 61: 28 - floor(60/60)*2 = 28 - 2 = 26
      expect(calculateTickSpeed(61)).toBe(26)

      // Psychic 120: 28 - floor(119/60)*2 = 28 - 2 = 26
      expect(calculateTickSpeed(120)).toBe(26)

      // Psychic 121: 28 - floor(120/60)*2 = 28 - 4 = 24
      expect(calculateTickSpeed(121)).toBe(24)

      // Psychic 1000: 28 - floor(999/60)*2 = 28 - 32 = -4 (theoretical, unlikely in game)
      expect(calculateTickSpeed(1000)).toBe(-4)
    })

    it('should handle edge cases around 60-increment boundaries', () => {
      expect(calculateTickSpeed(59)).toBe(28)
      expect(calculateTickSpeed(60)).toBe(28)
      expect(calculateTickSpeed(61)).toBe(26)

      expect(calculateTickSpeed(119)).toBe(26)
      expect(calculateTickSpeed(120)).toBe(26)
      expect(calculateTickSpeed(121)).toBe(24)
    })
  })

  describe('calculateBaseDelta - breed base values', () => {
    it('should use Solitus base 3 (breed 1)', () => {
      expect(calculateBaseDelta(1, 0)).toBe(3)
      expect(calculateBaseDelta(1, 5)).toBe(8)
    })

    it('should use Opifex base 3 (breed 2)', () => {
      expect(calculateBaseDelta(2, 0)).toBe(3)
      expect(calculateBaseDelta(2, 5)).toBe(8)
    })

    it('should use Nanomage base 4 (breed 3)', () => {
      expect(calculateBaseDelta(3, 0)).toBe(4)
      expect(calculateBaseDelta(3, 5)).toBe(9)
    })

    it('should use Atrox base 2 (breed 4)', () => {
      expect(calculateBaseDelta(4, 0)).toBe(2)
      expect(calculateBaseDelta(4, 5)).toBe(7)
    })

    it('should handle nano delta modifier', () => {
      expect(calculateBaseDelta(1, 10)).toBe(13) // 3 + 10
      expect(calculateBaseDelta(3, -2)).toBe(2) // 4 - 2
    })
  })

  describe('calculateNanoRegen', () => {
    it('should combine buff regen and base delta regen', () => {
      const buffs: NanoRegenBuffs = {
        humidity: 1, // 1.5/s
        notumSiphon: 1, // 8.34/s
        channeling: 0, // 0/s
      }

      // Psychic 1 = tick speed 28
      // Solitus (breed 1) = base delta 3
      // Regen = 1.5 + 8.34 + (3/28) = 9.84 + 0.107... ≈ 9.95
      const result = calculateNanoRegen(1, 1, 0, buffs)
      expect(result).toBeCloseTo(9.95, 1)
    })

    it('should calculate delta regen as baseDelta/tickSpeed', () => {
      // Psychic 61 = tick speed 26
      // Nanomage (breed 3) = base delta 4
      // No buffs: regen = 4/26 ≈ 0.154
      const result = calculateNanoRegen(61, 3, 0, defaultRegenBuffs)
      expect(result).toBeCloseTo(0.154, 2)
    })

    it('should scale with high psychic (faster tick speed)', () => {
      // Psychic 1 (tick 28) vs Psychic 121 (tick 24)
      const regen1 = calculateNanoRegen(1, 1, 0, defaultRegenBuffs)
      const regen121 = calculateNanoRegen(121, 1, 0, defaultRegenBuffs)

      // Higher psychic = faster ticks = more regen
      expect(regen121).toBeGreaterThan(regen1)
    })

    it('should handle multiple buff levels', () => {
      const buffs: NanoRegenBuffs = {
        humidity: 7, // 15.67/s
        notumSiphon: 10, // 83.34/s
        channeling: 4, // 15.45/s
      }

      const result = calculateNanoRegen(1, 1, 0, buffs)
      // 15.67 + 83.34 + 15.45 + (3/28) = 114.46 + 0.107 ≈ 114.57
      expect(result).toBeCloseTo(114.57, 1)
    })
  })

  describe('calculateSustainTime', () => {
    it('should return Infinity if sustainable (regen >= consumption)', () => {
      expect(calculateSustainTime(2000, 20, 30)).toBe(Infinity)
      expect(calculateSustainTime(2000, 20, 20)).toBe(Infinity)
    })

    it('should calculate time to empty if not sustainable', () => {
      // 2000 max nano, 50 consumption, 30 regen
      // Net consumption: 50 - 30 = 20/s
      // Time: 2000 / 20 = 100s
      expect(calculateSustainTime(2000, 50, 30)).toBe(100)

      // 1000 max nano, 100 consumption, 20 regen
      // Net consumption: 100 - 20 = 80/s
      // Time: 1000 / 80 = 12.5s
      expect(calculateSustainTime(1000, 100, 20)).toBe(12.5)
    })

    it('should handle zero regen', () => {
      // 2000 max, 50 consumption, 0 regen
      // Time: 2000 / 50 = 40s
      expect(calculateSustainTime(2000, 50, 0)).toBe(40)
    })
  })

  describe('calculateCastsToEmpty', () => {
    it('should return Infinity if sustainable', () => {
      expect(calculateCastsToEmpty(2000, 100, true)).toBe(Infinity)
    })

    it('should floor casts to whole number', () => {
      // 2000 max nano / 100 cost = 20 casts
      expect(calculateCastsToEmpty(2000, 100, false)).toBe(20)

      // 2050 max nano / 100 cost = 20.5 -> floor to 20
      expect(calculateCastsToEmpty(2050, 100, false)).toBe(20)

      // 2099 max nano / 100 cost = 20.99 -> floor to 20
      expect(calculateCastsToEmpty(2099, 100, false)).toBe(20)
    })
  })
})

// ============================================================================
// Efficiency & DPS Tests
// ============================================================================

describe('Efficiency Calculations', () => {
  describe('calculateDPS', () => {
    it('should calculate DPS for instant nanos', () => {
      // 500 damage, 1.5s cast, 3.0s recharge
      // Cycle: 1.5 + 3.0 = 4.5s
      // DPS: 500 / 4.5 = 111.11...
      const result = calculateDPS(500, 1.5, 3.0, 1, 0)
      expect(result).toBe(111.11)
    })

    it('should add tick duration to cycle time for DoT nanos', () => {
      // 1000 damage, 1.0s cast, 2.0s recharge, 5 ticks @ 100cs (1s) interval
      // Tick duration: 5 * 100 / 100 = 5s
      // Cycle: 1.0 + 2.0 + 5.0 = 8.0s
      // DPS: 1000 / 8.0 = 125.00
      const result = calculateDPS(1000, 1.0, 2.0, 5, 100)
      expect(result).toBe(125.0)
    })

    it('should handle DoT with different tick intervals', () => {
      // 600 damage, 1s cast, 2s recharge, 3 ticks @ 200cs (2s) interval
      // Tick duration: 3 * 200 / 100 = 6s
      // Cycle: 1 + 2 + 6 = 9s
      // DPS: 600 / 9 = 66.67
      const result = calculateDPS(600, 1.0, 2.0, 3, 200)
      expect(result).toBe(66.67)
    })

    it('should prevent division by zero', () => {
      expect(calculateDPS(500, 0, 0, 1, 0)).toBe(0)
    })

    it('should format with .toFixed(2)', () => {
      const result = calculateDPS(333, 1.0, 2.0, 1, 0)
      expect(result).toBe(111.0) // 333/3 = 111.00
    })
  })

  describe('calculateDamagePerNano', () => {
    it('should calculate damage per nano cost', () => {
      // 500 damage, 100 cost = 5.00
      expect(calculateDamagePerNano(500, 100)).toBe(5.0)

      // 1000 damage, 450 cost = 2.22...
      expect(calculateDamagePerNano(1000, 450)).toBe(2.22)
    })

    it('should prevent division by zero', () => {
      expect(calculateDamagePerNano(500, 0)).toBe(0)
    })

    it('should format with .toFixed(2)', () => {
      const result = calculateDamagePerNano(333, 100)
      expect(result).toBe(3.33)
    })
  })

  describe('calculateNanoPerSecond', () => {
    it('should calculate nano consumption rate', () => {
      // 100 cost, 1.5s cast, 3.0s recharge
      // Cycle: 4.5s
      // NPS: 100 / 4.5 = 22.22...
      expect(calculateNanoPerSecond(100, 1.5, 3.0)).toBe(22.22)

      // 450 cost, 1.0s cast, 2.0s recharge
      // Cycle: 3.0s
      // NPS: 450 / 3.0 = 150.00
      expect(calculateNanoPerSecond(450, 1.0, 2.0)).toBe(150.0)
    })

    it('should prevent division by zero', () => {
      expect(calculateNanoPerSecond(100, 0, 0)).toBe(0)
    })
  })

  describe('calculateSustainMetrics', () => {
    it('should return sustainable metrics when regen >= consumption', () => {
      // 2000 max nano, 100 cost, 2s cast, 3s recharge, 30 regen/s
      // Cycle: 5s, NPS: 100/5 = 20/s
      // Regen (30) >= NPS (20) -> sustainable
      const result = calculateSustainMetrics(2000, 100, 2, 3, 30)

      expect(result.nanoPerSecond).toBe(20.0)
      expect(result.isSustainable).toBe(true)
      expect(result.sustainTime).toBe(Infinity)
      expect(result.sustainTimeFormatted).toBe('∞')
      expect(result.castsToEmpty).toBe(Infinity)
    })

    it('should calculate finite sustain time when not sustainable', () => {
      // 2000 max nano, 100 cost, 1s cast, 1s recharge, 30 regen/s
      // Cycle: 2s, NPS: 100/2 = 50/s
      // Net consumption: 50 - 30 = 20/s
      // Sustain time: 2000 / 20 = 100s = "1m 40s"
      // Casts to empty: floor(2000/100) = 20
      const result = calculateSustainMetrics(2000, 100, 1, 1, 30)

      expect(result.nanoPerSecond).toBe(50.0)
      expect(result.isSustainable).toBe(false)
      expect(result.sustainTime).toBe(100)
      expect(result.sustainTimeFormatted).toBe('1m 40s')
      expect(result.castsToEmpty).toBe(20)
    })
  })

  describe('calculateAllEfficiencyMetrics', () => {
    it('should calculate all metrics for instant nano', () => {
      const result = calculateAllEfficiencyMetrics(
        500, // midDamage
        100, // modifiedNanoCost
        1.5, // castTime
        3.0, // rechargeTime
        2000, // maxNano
        20, // regenPerSecond
        1, // tickCount
        0 // tickInterval
      )

      // DPS: 500 / 4.5 = 111.11
      expect(result.dps).toBe(111.11)
      // Damage per nano: 500 / 100 = 5.00
      expect(result.damagePerNano).toBe(5.0)
      // NPS: 100 / 4.5 = 22.22
      expect(result.nanoPerSecond).toBe(22.22)
      // Net consumption: 22.22 - 20 = 2.22/s
      // Sustain time: 2000 / 2.22 ≈ 900s
      expect(result.isSustainable).toBe(false)
      expect(result.castsToEmpty).toBe(20) // floor(2000/100)
    })

    it('should handle DoT nano with extended cycle time', () => {
      const result = calculateAllEfficiencyMetrics(
        1000, // midDamage (total)
        100, // modifiedNanoCost
        1.0, // castTime
        2.0, // rechargeTime
        2000, // maxNano
        50, // regenPerSecond
        5, // tickCount
        100 // tickInterval (1s per tick)
      )

      // Cycle for DPS: 1 + 2 + (5*100/100) = 1 + 2 + 5 = 8s
      // DPS: 1000 / 8 = 125.00
      expect(result.dps).toBe(125.0)
      // NPS: 100 / (1 + 2) = 33.33 (nano cost paid at cast, not spread over DoT)
      expect(result.nanoPerSecond).toBe(33.33)
      // 50 regen >= 33.33 consumption -> sustainable
      expect(result.isSustainable).toBe(true)
      expect(result.sustainTime).toBe(Infinity)
    })
  })

  describe('formatSustainTime', () => {
    it('should format Infinity as "∞"', () => {
      expect(formatSustainTime(Infinity)).toBe('∞')
    })

    it('should format finite times using formatTime', () => {
      expect(formatSustainTime(45)).toBe('45s')
      expect(formatSustainTime(150)).toBe('2m 30s')
    })
  })

  describe('formatCastsToEmpty', () => {
    it('should format Infinity as "∞"', () => {
      expect(formatCastsToEmpty(Infinity)).toBe('∞')
    })

    it('should floor and format finite values', () => {
      expect(formatCastsToEmpty(20)).toBe('20')
      expect(formatCastsToEmpty(20.9)).toBe('20')
    })
  })
})

// ============================================================================
// Integration Tests with Legacy TinkerNukes Values
// ============================================================================

describe('Legacy TinkerNukes Validation', () => {
  it('should match legacy damage calculation with AC reduction', () => {
    // Legacy example: low_dmg * multiplier, high_dmg * multiplier - AC reduction
    // Base: 100-200, 10% damage buff, AC 25
    // Expected: low = 110, high = 220 - floor(25/10) = 220 - 2 = 218
    const modifiers: DamageModifiers = {
      ...defaultModifiers,
      directNanoDamageEfficiency: 10, // 10% buff
    }

    const spell: SpellDamage = {
      minValue: -100,
      maxValue: -200,
      modifierStat: 90,
    }

    const result = calculateModifiedDamage(spell, modifiers, 25)

    // Min: 100 * 1.10 = 110, - floor(25/10) = 110 - 2 = 108, clamped to 100 = 108
    expect(result.min).toBeCloseTo(108, 1)
    // Max: 200 * 1.10 = 220, - floor(25/10) = 220 - 2 = 218
    expect(result.max).toBeCloseTo(218, 1)
  })

  it('should ensure high damage never goes below low damage', () => {
    // Legacy: if high_dmg < low_dmg: high_dmg = low_dmg
    const spell: SpellDamage = {
      minValue: -100,
      maxValue: -110,
      modifierStat: 90,
    }

    const result = calculateModifiedDamage(spell, defaultModifiers, 200)

    // Min: 100 - 20 = 80, clamped to 100 = 100
    // Max: 110 - 20 = 90, clamped to 100 = 100
    expect(result.min).toBe(100)
    expect(result.max).toBe(100)
  })

  it('should calculate DPS with DoT damage multiplication', () => {
    // Legacy: if db_nano.nt_dot and db_nano.dot_hits > 1: dmg * dot_hits
    // Then: DPS = (dmg * casts) / sample_len
    // Equivalent to: DPS = total_dmg / (cast + recharge + dot_duration)

    const midDamage = 200 // Per tick
    const tickCount = 5
    const totalDamage = midDamage * tickCount // 1000

    const dps = calculateDPS(totalDamage, 1.0, 2.0, 5, 100)

    // Cycle: 1 + 2 + (5*100/100) = 8s
    // DPS: 1000 / 8 = 125.00
    expect(dps).toBe(125.0)
  })

  it('should validate nano cost with breed-specific caps', () => {
    // Legacy examples from documentation
    const baseCost = 1000

    // Nanomage with 60% reduction (capped at 55%)
    const nanomage = calculateNanoCost(baseCost, 60, 3 as Breed)
    expect(nanomage).toBe(450) // 1000 * 0.45

    // Atrox with 50% reduction (capped at 45%)
    const atrox = calculateNanoCost(500, 50, 4 as Breed)
    expect(atrox).toBe(275) // 500 * 0.55
  })

  it('should validate cast time two-tier scaling', () => {
    // Legacy example: 300cs base, 600 init
    // Reduction: floor(600/2) = 300
    // Result: 300 - 300 = 0cs = 0.00s
    expect(calculateCastTime(300, 600)).toBe(0.0)

    // Legacy example: 1000cs base, 1800 init
    // Reduction: floor(1800/2) + floor(600/6) = 900 + 100 = 1000
    // Result: 1000 - 1000 = 0cs = 0.00s
    expect(calculateCastTime(1000, 1800)).toBe(0.0)
  })

  it('should validate nano regen tick speed formula', () => {
    // Legacy: tick_sec = 28 - (floor((psychic - 1) / 60) * 2)
    expect(calculateTickSpeed(1)).toBe(28)
    expect(calculateTickSpeed(61)).toBe(26)
    expect(calculateTickSpeed(121)).toBe(24)
  })

  it('should validate sustain time calculation', () => {
    // Legacy: if nano_regen >= nps: oon_time = '∞'
    const sustainable = calculateSustainTime(2000, 20, 30)
    expect(sustainable).toBe(Infinity)

    // Legacy: else: oon_time = round(max_nano / (nps - nano_regen))
    const finite = calculateSustainTime(2000, 50, 30)
    expect(finite).toBe(100) // 2000 / (50 - 30) = 100s
  })

  it('should validate centisecond conversion with .toFixed(2)', () => {
    // Legacy pattern: all time conversions are /100 with .toFixed(2)
    expect(centisecondsToSeconds(150)).toBe(1.5)
    expect(centisecondsToSeconds(3000)).toBe(30.0)
    expect(centisecondsToSeconds(333)).toBe(3.33)
  })

  it('should validate Math.floor rounding in formulas', () => {
    // AC reduction uses Math.floor
    const damage1 = calculateDamage(100, 0, 0, 0, 19, 0)
    expect(damage1).toBe(99) // floor(19/10) = 1, 100 - 1 = 99

    const damage2 = calculateDamage(100, 0, 0, 0, 29, 0)
    expect(damage2).toBe(98) // floor(29/10) = 2, 100 - 2 = 98

    // Init reduction uses Math.floor
    expect(calculateCastTime(1000, 601)).toBe(7.0) // floor(601/2) = 300, 1000-300=700cs

    // Tick speed uses Math.floor
    expect(calculateTickSpeed(119)).toBe(26) // floor(118/60) = 1, 28-2=26
  })
})

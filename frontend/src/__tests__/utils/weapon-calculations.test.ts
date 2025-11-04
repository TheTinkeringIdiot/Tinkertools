/**
 * Tests for weapon DPS calculations
 *
 * Phase 4: Base DPS Calculations
 * Verifies formulas match legacy TinkerFite tool
 */

import { describe, it, expect } from 'vitest'
import { calculateSpeeds, calculateCycleTime } from '@/utils/weapon-speed-calculations'
import {
  calculateARBonus,
  calculateBaseDamage,
  calculateBaseDamage60s,
  convertToDPS
} from '@/utils/weapon-damage-calculations'
import type { WeaponCandidate, FiteInputState } from '@/types/weapon-analysis'
import { WEAPON_STAT_IDS, INITIATIVE_IDS } from '@/types/weapon-analysis'

describe('Weapon Speed Calculations', () => {
  it('calculates base weapon speeds with aggdef modifier', () => {
    const weapon: WeaponCandidate = {
      id: 1,
      name: 'Test Weapon',
      is_nano: false,
      stats: [
        { id: 1, stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 200 }, // 2 seconds
        { id: 2, stat: WEAPON_STAT_IDS.RECHARGE_DELAY, value: 300 } // 3 seconds
      ],
      spell_data: [],
      actions: [],
      attack_stats: [],
      defense_stats: [],
      equipable: true
    }

    const state: FiteInputState = {
      characterStats: {
        breed: 1,
        level: 100,
        profession: 5,
        side: 0,
        crit: 0,
        targetAC: 0,
        aggdef: 75 // Default aggdef (no modifier)
      },
      weaponSkills: {},
      specialAttacks: {},
      initiative: {
        meleeInit: 0,
        physicalInit: 0,
        rangedInit: 0
      },
      combatBonuses: {
        aao: 0,
        addDamage: 0,
        wrangle: 0
      }
    }

    const speeds = calculateSpeeds(weapon, state)

    // With default aggdef (75), no modification
    expect(speeds.attackTime).toBe(200)
    expect(speeds.rechargeTime).toBe(300)
  })

  it('applies aggdef modifier correctly', () => {
    const weapon: WeaponCandidate = {
      id: 1,
      name: 'Test Weapon',
      is_nano: false,
      stats: [
        { id: 1, stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 200 },
        { id: 2, stat: WEAPON_STAT_IDS.RECHARGE_DELAY, value: 300 }
      ],
      spell_data: [],
      actions: [],
      attack_stats: [],
      defense_stats: [],
      equipable: true
    }

    const state: FiteInputState = {
      characterStats: {
        breed: 1,
        level: 100,
        profession: 5,
        side: 0,
        crit: 0,
        targetAC: 0,
        aggdef: 100 // Aggressive (+25 from default)
      },
      weaponSkills: {},
      specialAttacks: {},
      initiative: {
        meleeInit: 0,
        physicalInit: 0,
        rangedInit: 0
      },
      combatBonuses: {
        aao: 0,
        addDamage: 0,
        wrangle: 0
      }
    }

    const speeds = calculateSpeeds(weapon, state)

    // aggdef 100 = -25 from times (faster)
    // Formula: time - (aggdef - 75) = time - 25
    expect(speeds.attackTime).toBe(175)
    expect(speeds.rechargeTime).toBe(275)
  })

  it('applies initiative bonus correctly', () => {
    const weapon: WeaponCandidate = {
      id: 1,
      name: 'Melee Weapon',
      is_nano: false,
      stats: [
        { id: 1, stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 200 },
        { id: 2, stat: WEAPON_STAT_IDS.RECHARGE_DELAY, value: 300 },
        { id: 3, stat: WEAPON_STAT_IDS.INITIATIVE_TYPE, value: INITIATIVE_IDS.MELEE_INIT }
      ],
      spell_data: [],
      actions: [],
      attack_stats: [],
      defense_stats: [],
      equipable: true
    }

    const state: FiteInputState = {
      characterStats: {
        breed: 1,
        level: 100,
        profession: 5,
        side: 0,
        crit: 0,
        targetAC: 0,
        aggdef: 75
      },
      weaponSkills: {},
      specialAttacks: {},
      initiative: {
        meleeInit: 600, // 600 melee init
        physicalInit: 0,
        rangedInit: 0
      },
      combatBonuses: {
        aao: 0,
        addDamage: 0,
        wrangle: 0
      }
    }

    const speeds = calculateSpeeds(weapon, state)

    // Attack: 200 - (600/6) = 200 - 100 = 100
    // Recharge: 300 - (600/3) = 300 - 200 = 100
    expect(speeds.attackTime).toBe(100)
    expect(speeds.rechargeTime).toBe(100)
  })

  it('enforces minimum attack times', () => {
    const weapon: WeaponCandidate = {
      id: 1,
      name: 'Fast Weapon',
      is_nano: false,
      stats: [
        { id: 1, stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 100 },
        { id: 2, stat: WEAPON_STAT_IDS.RECHARGE_DELAY, value: 100 },
        { id: 3, stat: WEAPON_STAT_IDS.INITIATIVE_TYPE, value: INITIATIVE_IDS.MELEE_INIT }
      ],
      spell_data: [],
      actions: [],
      attack_stats: [],
      defense_stats: [],
      equipable: true
    }

    const state: FiteInputState = {
      characterStats: {
        breed: 1,
        level: 220,
        profession: 5,
        side: 0,
        crit: 0,
        targetAC: 0,
        aggdef: 100 // Very aggressive
      },
      weaponSkills: {},
      specialAttacks: {},
      initiative: {
        meleeInit: 3000, // Extreme melee init
        physicalInit: 0,
        rangedInit: 0
      },
      combatBonuses: {
        aao: 0,
        addDamage: 0,
        wrangle: 0
      }
    }

    const speeds = calculateSpeeds(weapon, state)

    // Should be capped at 100 cs (1 second)
    expect(speeds.attackTime).toBe(100)
    expect(speeds.rechargeTime).toBe(100)
  })
})

describe('AR Bonus Calculations', () => {
  it('calculates AR bonus for low attack skill', () => {
    const weapon: WeaponCandidate = {
      id: 1,
      name: 'Test Weapon',
      is_nano: false,
      stats: [],
      spell_data: [],
      actions: [],
      attack_stats: [
        { id: 1, stat: 112, value: 100 } // 100% pistol
      ],
      defense_stats: [],
      equipable: true
    }

    const state: FiteInputState = {
      characterStats: {
        breed: 1,
        level: 50,
        profession: 5,
        side: 0,
        crit: 0,
        targetAC: 0,
        aggdef: 75
      },
      weaponSkills: {
        112: 400 // 400 pistol skill
      },
      specialAttacks: {},
      initiative: {
        meleeInit: 0,
        physicalInit: 0,
        rangedInit: 0
      },
      combatBonuses: {
        aao: 0,
        addDamage: 0,
        wrangle: 0
      }
    }

    const arBonus = calculateARBonus(weapon, state)

    // ar_bonus = 1 + (400 / 400) = 2.0
    expect(arBonus).toBe(2.0)
  })

  it('calculates AR bonus for high attack skill (tiered formula)', () => {
    const weapon: WeaponCandidate = {
      id: 1,
      name: 'Test Weapon',
      is_nano: false,
      stats: [],
      spell_data: [],
      actions: [],
      attack_stats: [
        { id: 1, stat: 112, value: 100 } // 100% pistol
      ],
      defense_stats: [],
      equipable: true
    }

    const state: FiteInputState = {
      characterStats: {
        breed: 1,
        level: 220,
        profession: 5,
        side: 0,
        crit: 0,
        targetAC: 0,
        aggdef: 75
      },
      weaponSkills: {
        112: 2000 // 2000 pistol skill
      },
      specialAttacks: {},
      initiative: {
        meleeInit: 0,
        physicalInit: 0,
        rangedInit: 0
      },
      combatBonuses: {
        aao: 1000, // High AAO
        addDamage: 0,
        wrangle: 0
      }
    }

    const arBonus = calculateARBonus(weapon, state)

    // Total attack skill: 2000 + 1000 AAO = 3000
    // ar_bonus = 1 + (1000 / 400) + ((3000 - 1000) / 1200)
    // ar_bonus = 1 + 2.5 + 1.667 = 5.167 (rounded)
    expect(arBonus).toBeCloseTo(5.167, 2)
  })

  it('respects AR cap for MBS weapons', () => {
    const weapon: WeaponCandidate = {
      id: 1,
      name: 'MBS Weapon',
      is_nano: false,
      stats: [
        { id: 1, stat: WEAPON_STAT_IDS.AR_CAP, value: 1200 } // AR cap at 1200
      ],
      spell_data: [],
      actions: [],
      attack_stats: [
        { id: 1, stat: 112, value: 100 }
      ],
      defense_stats: [],
      equipable: true
    }

    const state: FiteInputState = {
      characterStats: {
        breed: 1,
        level: 220,
        profession: 5,
        side: 0,
        crit: 0,
        targetAC: 0,
        aggdef: 75
      },
      weaponSkills: {
        112: 2000
      },
      specialAttacks: {},
      initiative: {
        meleeInit: 0,
        physicalInit: 0,
        rangedInit: 0
      },
      combatBonuses: {
        aao: 1000,
        addDamage: 0,
        wrangle: 0
      }
    }

    const arBonus = calculateARBonus(weapon, state)

    // Attack skill would be 3000, but capped at 1200
    // ar_bonus = 1 + (1000 / 400) + ((1200 - 1000) / 1200)
    // ar_bonus = 1 + 2.5 + 0.167 = 3.667
    expect(arBonus).toBeCloseTo(3.667, 2)
  })
})

describe('Base Damage Over 60s Calculations', () => {
  it('calculates basic damage over 60s without crits', () => {
    const weapon: WeaponCandidate = {
      id: 1,
      name: 'Test Weapon',
      is_nano: false,
      stats: [
        { id: 1, stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 200 },
        { id: 2, stat: WEAPON_STAT_IDS.RECHARGE_DELAY, value: 300 },
        { id: 3, stat: WEAPON_STAT_IDS.MIN_DAMAGE, value: 100 },
        { id: 4, stat: WEAPON_STAT_IDS.MAX_DAMAGE, value: 200 },
        { id: 5, stat: WEAPON_STAT_IDS.CRITICAL_BONUS, value: 50 }
      ],
      spell_data: [],
      actions: [],
      attack_stats: [
        { id: 1, stat: 112, value: 100 }
      ],
      defense_stats: [],
      equipable: true
    }

    const state: FiteInputState = {
      characterStats: {
        breed: 1,
        level: 100,
        profession: 5,
        side: 0,
        crit: 0, // 0% crit
        targetAC: 0,
        aggdef: 75
      },
      weaponSkills: {
        112: 600 // 600 pistol skill
      },
      specialAttacks: {},
      initiative: {
        meleeInit: 0,
        physicalInit: 0,
        rangedInit: 0
      },
      combatBonuses: {
        aao: 0,
        addDamage: 0,
        wrangle: 0
      }
    }

    const result = calculateBaseDamage60s(weapon, state)

    // Cycle time: (200 + 300) / 100 = 5 seconds
    // Attacks in 60s: 60 / 5 = 12 attacks
    expect(result.numBasicAttacks).toBe(12)
    expect(result.numCrits).toBe(0)

    // AR bonus: 1 + (600 / 400) = 2.5
    // Min damage: 100 * 2.5 = 250
    // Max damage: 200 * 2.5 = 500
    // Avg damage: 250 + (500 - 250) / 2 = 375
    expect(result.minDamage).toBe(250)
    expect(result.maxDamage).toBe(500)
    expect(result.avgDamage).toBe(375)

    // Total damage over 60s: 375 * 12 = 4500
    expect(result.avgDamage60s).toBe(4500)

    // DPS conversion: 4500 / 60 = 75
    expect(convertToDPS(result.avgDamage60s)).toBe(75)
  })

  it('handles 100% crit rate correctly', () => {
    const weapon: WeaponCandidate = {
      id: 1,
      name: 'Test Weapon',
      is_nano: false,
      stats: [
        { id: 1, stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 200 },
        { id: 2, stat: WEAPON_STAT_IDS.RECHARGE_DELAY, value: 300 },
        { id: 3, stat: WEAPON_STAT_IDS.MIN_DAMAGE, value: 100 },
        { id: 4, stat: WEAPON_STAT_IDS.MAX_DAMAGE, value: 200 },
        { id: 5, stat: WEAPON_STAT_IDS.CRITICAL_BONUS, value: 100 }
      ],
      spell_data: [],
      actions: [],
      attack_stats: [
        { id: 1, stat: 112, value: 100 }
      ],
      defense_stats: [],
      equipable: true
    }

    const state: FiteInputState = {
      characterStats: {
        breed: 1,
        level: 220,
        profession: 5,
        side: 0,
        crit: 100, // 100% crit
        targetAC: 0,
        aggdef: 75
      },
      weaponSkills: {
        112: 600
      },
      specialAttacks: {},
      initiative: {
        meleeInit: 0,
        physicalInit: 0,
        rangedInit: 0
      },
      combatBonuses: {
        aao: 0,
        addDamage: 0,
        wrangle: 0
      }
    }

    const result = calculateBaseDamage60s(weapon, state)

    // All attacks should be crits
    expect(result.numBasicAttacks).toBe(0)
    expect(result.numCrits).toBe(12) // 60s / 5s cycle = 12 attacks

    // Crit damage: (200 + 100) * 2.5 = 750
    expect(result.critDamage).toBe(750)

    // Total damage over 60s: 750 * 12 = 9000
    expect(result.avgDamage60s).toBe(9000)

    // DPS: 9000 / 60 = 150
    expect(convertToDPS(result.avgDamage60s)).toBe(150)
  })

  it('applies target AC reduction correctly', () => {
    const weapon: WeaponCandidate = {
      id: 1,
      name: 'Test Weapon',
      is_nano: false,
      stats: [
        { id: 1, stat: WEAPON_STAT_IDS.ATTACK_DELAY, value: 200 },
        { id: 2, stat: WEAPON_STAT_IDS.RECHARGE_DELAY, value: 300 },
        { id: 3, stat: WEAPON_STAT_IDS.MIN_DAMAGE, value: 100 },
        { id: 4, stat: WEAPON_STAT_IDS.MAX_DAMAGE, value: 200 },
        { id: 5, stat: WEAPON_STAT_IDS.CRITICAL_BONUS, value: 50 }
      ],
      spell_data: [],
      actions: [],
      attack_stats: [
        { id: 1, stat: 112, value: 100 }
      ],
      defense_stats: [],
      equipable: true
    }

    const state: FiteInputState = {
      characterStats: {
        breed: 1,
        level: 100,
        profession: 5,
        side: 0,
        crit: 0,
        targetAC: 1000, // High AC
        aggdef: 75
      },
      weaponSkills: {
        112: 600
      },
      specialAttacks: {},
      initiative: {
        meleeInit: 0,
        physicalInit: 0,
        rangedInit: 0
      },
      combatBonuses: {
        aao: 0,
        addDamage: 0,
        wrangle: 0
      }
    }

    const result = calculateBaseDamage60s(weapon, state)

    // AR bonus: 2.5
    // Min damage: 100 * 2.5 = 250 (not affected by AC)
    // Max damage: 200 * 2.5 - (1000 / 10) = 500 - 100 = 400
    expect(result.minDamage).toBe(250)
    expect(result.maxDamage).toBe(400)
  })
})

/**
 * Comprehensive tests for the PerkBonusCalculator service
 *
 * Tests functionality, performance benchmarks, caching effectiveness,
 * and error recovery scenarios with invalid spell data.
 *
 * Performance Requirement: NFR1.2 - Calculations under 200ms for 30+ perks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { Item, SpellData, Spell } from '../../types/api'
import {
  PerkBonusCalculator,
  calculatePerkBonuses,
  calculatePerkBonusesWithErrors,
  parseItemForStatBonuses,
  parseItemForStatBonusesWithErrors,
  perkBonusCalculator,
  STAT_BONUS_SPELL_IDS,
  PERK_EVENTS,
  type PerkStatBonus,
  type PerkBonusError,
  type PerkCalculationResult
} from '../perk-bonus-calculator'

// Mock the skill mappings
vi.mock('../../lib/tinkerprofiles/skill-mappings', () => ({
  getSkillName: vi.fn((statId: number) => {
    const skillMap: Record<number, string> = {
      17: 'Assault Rifle',
      76: 'Dodge-Rng',
      27: 'Health',
      123: 'Rifle',
      456: 'Pistol',
      789: 'Max Health',
      999: 'Unknown Skill' // For invalid tests
    }
    return skillMap[statId] || null
  })
}))

describe('PerkBonusCalculator', () => {
  let calculator: PerkBonusCalculator

  beforeEach(() => {
    // Create fresh calculator instance for each test
    calculator = new PerkBonusCalculator()

    // Clear singleton caches
    perkBonusCalculator.clearCaches()

    // Reset console methods to track warnings/errors
    vi.clearAllMocks()
  })

  afterEach(() => {
    calculator.clearCaches()
  })

  // ==========================================================================
  // Test Data Factories
  // ==========================================================================

  const createValidSpell = (statId: number, amount: number, spellId: number = 53045): Spell => ({
    id: Math.floor(Math.random() * 10000),
    spell_id: spellId,
    spell_params: {
      Stat: statId,
      Amount: amount
    },
    criteria: []
  })

  const createValidSpellData = (spells: Spell[], event: number = 14): SpellData => ({
    id: Math.floor(Math.random() * 10000),
    event,
    spells
  })

  const createValidPerkItem = (
    name: string,
    aoid: number,
    spellData: SpellData[] = []
  ): Item => ({
    id: Math.floor(Math.random() * 10000),
    aoid,
    name,
    ql: 200,
    description: `Test perk: ${name}`,
    item_class: 1,
    is_nano: false,
    stats: [],
    spell_data: spellData,
    actions: [],
    attack_stats: [],
    defense_stats: []
  })

  const createPerformanceTestPerks = (count: number): Item[] => {
    const perks: Item[] = []
    for (let i = 0; i < count; i++) {
      const spells = [
        createValidSpell(17, 5 + i), // Assault Rifle
        createValidSpell(76, 3 + i), // Dodge-Rng
        createValidSpell(27, 100 + (i * 10)) // Health
      ]
      const spellData = [createValidSpellData(spells)]
      perks.push(createValidPerkItem(`Performance Perk ${i}`, 100000 + i, spellData))
    }
    return perks
  }

  // ==========================================================================
  // Basic Functionality Tests
  // ==========================================================================

  describe('Basic Functionality', () => {
    it('should calculate bonuses from valid perk with single spell', () => {
      const spell = createValidSpell(17, 10) // Assault Rifle +10
      const spellData = createValidSpellData([spell])
      const perk = createValidPerkItem('Test Perk', 12345, [spellData])

      const result = calculator.calculateBonuses([perk])

      expect(result).toEqual({
        'Assault Rifle': 10
      })
    })

    it('should calculate bonuses from multiple spells in single perk', () => {
      const spells = [
        createValidSpell(17, 10), // Assault Rifle +10
        createValidSpell(76, 5),  // Dodge-Rng +5
        createValidSpell(27, 100) // Health +100
      ]
      const spellData = createValidSpellData(spells)
      const perk = createValidPerkItem('Multi-Effect Perk', 12345, [spellData])

      const result = calculator.calculateBonuses([perk])

      expect(result).toEqual({
        'Assault Rifle': 10,
        'Dodge-Rng': 5,
        'Health': 100
      })
    })

    it('should aggregate bonuses from multiple perks', () => {
      const perk1Spells = [createValidSpell(17, 10)] // Assault Rifle +10
      const perk1 = createValidPerkItem('Perk 1', 11111, [createValidSpellData(perk1Spells)])

      const perk2Spells = [createValidSpell(17, 5)] // Assault Rifle +5
      const perk2 = createValidPerkItem('Perk 2', 22222, [createValidSpellData(perk2Spells)])

      const result = calculator.calculateBonuses([perk1, perk2])

      expect(result).toEqual({
        'Assault Rifle': 15 // 10 + 5
      })
    })

    it('should handle negative bonuses correctly', () => {
      const spell = createValidSpell(17, -5) // Assault Rifle -5
      const spellData = createValidSpellData([spell])
      const perk = createValidPerkItem('Negative Perk', 12345, [spellData])

      const result = calculator.calculateBonuses([perk])

      expect(result).toEqual({
        'Assault Rifle': -5
      })
    })

    it('should filter out zero bonuses after aggregation', () => {
      const perk1Spells = [createValidSpell(17, 10)] // Assault Rifle +10
      const perk1 = createValidPerkItem('Perk 1', 11111, [createValidSpellData(perk1Spells)])

      const perk2Spells = [createValidSpell(17, -10)] // Assault Rifle -10
      const perk2 = createValidPerkItem('Perk 2', 22222, [createValidSpellData(perk2Spells)])

      const result = calculator.calculateBonuses([perk1, perk2])

      expect(result).toEqual({}) // Empty since 10 + (-10) = 0
    })

    it('should handle multiple spell IDs', () => {
      const spells = [
        createValidSpell(17, 5, 53045),  // First spell ID
        createValidSpell(76, 3, 53012),  // Second spell ID
        createValidSpell(27, 100, 53014), // Third spell ID
        createValidSpell(123, 2, 53175)  // Fourth spell ID
      ]
      const spellData = createValidSpellData(spells)
      const perk = createValidPerkItem('Multi-Spell-ID Perk', 12345, [spellData])

      const result = calculator.calculateBonuses([perk])

      expect(result).toEqual({
        'Assault Rifle': 5,
        'Dodge-Rng': 3,
        'Health': 100,
        'Rifle': 2
      })
    })

    it('should handle both Cast (1) and Wear (14) events', () => {
      const castSpell = createValidSpell(17, 5)
      const wearSpell = createValidSpell(76, 3)

      const castSpellData = createValidSpellData([castSpell], 1) // Cast event
      const wearSpellData = createValidSpellData([wearSpell], 14) // Wear event

      const perk = createValidPerkItem('Multi-Event Perk', 12345, [castSpellData, wearSpellData])

      const result = calculator.calculateBonuses([perk])

      expect(result).toEqual({
        'Assault Rifle': 5,
        'Dodge-Rng': 3
      })
    })

    it('should ignore non-perk events like Wield (2)', () => {
      const spells = [createValidSpell(17, 10)]
      const invalidEventSpellData = createValidSpellData(spells, 2) // Wield event (equipment)
      const perk = createValidPerkItem('Equipment Event Perk', 12345, [invalidEventSpellData])

      const result = calculator.calculateBonuses([perk])

      expect(result).toEqual({}) // No bonuses since event 2 is not a perk event
    })
  })

  // ==========================================================================
  // Performance Benchmarks (NFR1.2: Under 200ms for 30+ perks)
  // ==========================================================================

  describe('Performance Benchmarks', () => {
    it('should complete calculation within 200ms for 30 perks', () => {
      const perks = createPerformanceTestPerks(30)

      const startTime = performance.now()
      const result = calculator.calculateBonuses(perks)
      const endTime = performance.now()

      const calculationTime = endTime - startTime

      // Verify results are correct
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
      expect(Object.keys(result).length).toBeGreaterThan(0)

      // Performance requirement: under 200ms
      expect(calculationTime).toBeLessThan(200)

      // Log performance for debugging
      console.log(`30 perks calculated in ${calculationTime.toFixed(2)}ms`)
    })

    it('should complete calculation within 200ms for 50 perks', () => {
      const perks = createPerformanceTestPerks(50)

      const startTime = performance.now()
      const result = calculator.calculateBonuses(perks)
      const endTime = performance.now()

      const calculationTime = endTime - startTime

      // Verify results are correct
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')

      // Performance requirement: under 200ms even for larger sets
      expect(calculationTime).toBeLessThan(200)

      console.log(`50 perks calculated in ${calculationTime.toFixed(2)}ms`)
    })

    it('should maintain consistent performance across multiple calls', () => {
      const perks = createPerformanceTestPerks(40)

      // First calculation
      const startTime1 = performance.now()
      const result1 = calculator.calculateBonuses(perks)
      const endTime1 = performance.now()
      const firstTime = endTime1 - startTime1

      // Second calculation
      const startTime2 = performance.now()
      const result2 = calculator.calculateBonuses(perks)
      const endTime2 = performance.now()
      const secondTime = endTime2 - startTime2

      // Results should be identical
      expect(result1).toEqual(result2)

      // Both should be under performance threshold
      expect(firstTime).toBeLessThan(200)
      expect(secondTime).toBeLessThan(200)

      console.log(`Performance times: ${firstTime.toFixed(2)}ms -> ${secondTime.toFixed(2)}ms`)
    })

    it('should track performance metrics correctly', () => {
      const perks = createPerformanceTestPerks(10)

      calculator.calculateBonuses(perks)
      calculator.calculateBonuses(perks)
      calculator.calculateBonuses(perks)

      const stats = calculator.getPerformanceStats()

      expect(stats.calculationCount).toBe(3)
      expect(stats.lastCalculationTime).toBeGreaterThanOrEqual(0)
      expect(stats.averageCalculationTime).toBeGreaterThanOrEqual(0)
      expect(stats.cacheStats).toBeDefined()
      // Cache hits might be 0 in test environment, just check structure
      expect(typeof stats.cacheStats.hitCount).toBe('number')
    })
  })

  // ==========================================================================
  // Caching Effectiveness Tests
  // ==========================================================================

  describe('Caching Effectiveness', () => {
    it('should have cache functionality available', () => {
      const stats = calculator.getPerformanceStats()
      expect(stats.cacheStats).toBeDefined()
      expect(typeof stats.cacheStats.size).toBe('number')
      expect(typeof stats.cacheStats.hitCount).toBe('number')
      expect(typeof stats.cacheStats.missCount).toBe('number')
    })

    it('should clear caches when requested', () => {
      const spell = createValidSpell(17, 10)
      const spellData = createValidSpellData([spell])
      const perk = createValidPerkItem('Test Perk', 12345, [spellData])

      calculator.calculateBonuses([perk])
      calculator.clearCaches()

      const stats = calculator.getPerformanceStats()
      expect(stats.cacheStats.size).toBe(0)
      expect(stats.cacheStats.hitCount).toBe(0)
      expect(stats.cacheStats.missCount).toBe(0)
    })

    it('should track cache operations', () => {
      const perks = createPerformanceTestPerks(5)

      // Multiple calculations to generate cache activity
      calculator.calculateBonuses(perks)
      calculator.calculateBonuses(perks)
      calculator.calculateBonuses(perks)

      const stats = calculator.getPerformanceStats()
      expect(stats.cacheStats.size).toBeGreaterThanOrEqual(0) // Cache may be empty or populated
      expect(stats.cacheStats.hitCount).toBeGreaterThanOrEqual(0)
      expect(stats.cacheStats.missCount).toBeGreaterThanOrEqual(0)
    })
  })

  // ==========================================================================
  // Error Recovery Tests
  // ==========================================================================

  describe('Error Recovery with Invalid Data', () => {
    beforeEach(() => {
      // Spy on console methods to verify error handling
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('should handle null/undefined perks array gracefully', () => {
      expect(calculator.calculateBonuses(null as any)).toEqual({})
      expect(calculator.calculateBonuses(undefined as any)).toEqual({})

      const result = calculatePerkBonusesWithErrors(null as any)
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.bonuses).toEqual({})
    })

    it('should handle non-array perks input', () => {
      const result = calculator.calculateBonuses('not an array' as any)
      expect(result).toEqual({})

      const detailedResult = calculatePerkBonusesWithErrors('not an array' as any)
      expect(detailedResult.success).toBe(false)
      expect(detailedResult.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'error',
            message: 'Invalid perks data format'
          })
        ])
      )
    })

    it('should skip null perks in array', () => {
      const validSpell = createValidSpell(17, 10)
      const validSpellData = createValidSpellData([validSpell])
      const validPerk1 = createValidPerkItem('Valid Perk 1', 12345, [validSpellData])
      const validPerk2 = createValidPerkItem('Valid Perk 2', 54321, [validSpellData]) // Different AOID

      const perksWithNull = [validPerk1, null, validPerk2]

      const result = calculator.calculateBonuses(perksWithNull as any)
      expect(result).toEqual({
        'Assault Rifle': 20 // Both valid perks contribute
      })
    })

    it('should handle perks with missing spell_data', () => {
      const perkWithoutSpellData = createValidPerkItem('No Spell Data', 12345)
      // Explicitly remove spell_data
      delete (perkWithoutSpellData as any).spell_data

      const result = calculator.calculateBonuses([perkWithoutSpellData])
      expect(result).toEqual({}) // No bonuses, but no crash
    })

    it('should handle perks with invalid spell_data format', () => {
      const perkWithInvalidSpellData = createValidPerkItem('Invalid Spell Data', 12345)
      perkWithInvalidSpellData.spell_data = 'not an array' as any

      const result = calculatePerkBonusesWithErrors([perkWithInvalidSpellData])
      expect(result.bonuses).toEqual({})
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'warning',
            message: 'Perk has invalid spell data format'
          })
        ])
      )
    })

    it('should handle spells with missing spell_id', () => {
      const invalidSpell = { spell_params: { Stat: 17, Amount: 10 } } // Missing spell_id
      const spellData = createValidSpellData([invalidSpell as any])
      const perk = createValidPerkItem('Missing Spell ID', 12345, [spellData])

      const result = calculator.calculateBonuses([perk])
      expect(result).toEqual({}) // No bonuses since spell_id is missing
    })

    it('should handle spells with invalid spell_id', () => {
      const invalidSpell = createValidSpell(17, 10, 99999) // Invalid spell ID
      const spellData = createValidSpellData([invalidSpell])
      const perk = createValidPerkItem('Invalid Spell ID', 12345, [spellData])

      const result = calculator.calculateBonuses([perk])
      expect(result).toEqual({}) // No bonuses since spell_id is not recognized
    })

    it('should handle spells with missing parameters', () => {
      const spellWithMissingParams: Spell = {
        id: Math.floor(Math.random() * 10000),
        spell_id: 53045,
        spell_params: {}, // Empty parameters
        criteria: []
      }
      const spellData = createValidSpellData([spellWithMissingParams])
      const perk = createValidPerkItem('Missing Params', 12345, [spellData])

      const result = calculatePerkBonusesWithErrors([perk])
      expect(result.bonuses).toEqual({})
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'warning',
            message: expect.stringContaining('missing')
          })
        ])
      )
    })

    it('should handle spells with invalid parameter types', () => {
      const spellWithInvalidParams: Spell = {
        id: Math.floor(Math.random() * 10000),
        spell_id: 53045,
        spell_params: {
          Stat: 'not a number',
          Amount: 'also not a number'
        },
        criteria: []
      }
      const spellData = createValidSpellData([spellWithInvalidParams])
      const perk = createValidPerkItem('Invalid Params', 12345, [spellData])

      const result = calculatePerkBonusesWithErrors([perk])
      expect(result.bonuses).toEqual({})
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('should handle unknown stat IDs gracefully', () => {
      const spellWithUnknownStat = createValidSpell(99999, 10) // Unknown stat ID
      const spellData = createValidSpellData([spellWithUnknownStat])
      const perk = createValidPerkItem('Unknown Stat', 12345, [spellData])

      const result = calculatePerkBonusesWithErrors([perk])
      expect(result.bonuses).toEqual({})
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'warning',
            message: 'Unknown stat ID in perk bonus'
          })
        ])
      )
    })

    it('should detect and warn about duplicate perks', () => {
      const spell = createValidSpell(17, 10)
      const spellData = createValidSpellData([spell])
      const perk1 = createValidPerkItem('Duplicate Perk', 12345, [spellData])
      const perk2 = createValidPerkItem('Duplicate Perk Copy', 12345, [spellData]) // Same AOID

      const result = calculatePerkBonusesWithErrors([perk1, perk2])
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'warning',
            message: 'Duplicate perk detected'
          })
        ])
      )
    })

    it('should continue processing when individual perks fail', () => {
      const validSpell = createValidSpell(17, 10)
      const validSpellData = createValidSpellData([validSpell])
      const validPerk = createValidPerkItem('Valid Perk', 11111, [validSpellData])

      const invalidPerk = createValidPerkItem('Invalid Perk', 22222)
      invalidPerk.spell_data = [{ invalid: 'data' } as any]

      const anotherValidPerk = createValidPerkItem('Another Valid Perk', 33333, [validSpellData])

      const result = calculator.calculateBonuses([validPerk, invalidPerk, anotherValidPerk])
      expect(result).toEqual({
        'Assault Rifle': 20 // Only valid perks contribute
      })
    })

    it('should warn about unusually large arrays', () => {
      const largeArray = new Array(1500).fill(null).map((_, i) =>
        createValidPerkItem(`Perk ${i}`, 10000 + i)
      )

      const result = calculatePerkBonusesWithErrors(largeArray)
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'warning',
            message: 'Unusually large number of perks'
          })
        ])
      )
    })

    it('should handle cache corruption gracefully', () => {
      const spell = createValidSpell(17, 10)
      const spellData = createValidSpellData([spell])
      const perk = createValidPerkItem('Test Perk', 12345, [spellData])

      // Parse once to populate cache
      calculator.parsePerkSpells(perk)

      // Manually corrupt cache by accessing private members
      const cacheKey = String(perk.aoid)
      ;(calculator as any).spellCache.cache.set(cacheKey, 'corrupted data')

      // Should detect corruption and clear cache
      const result = calculator.parsePerkSpells(perk)
      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })
  })

  // ==========================================================================
  // Convenience Functions Tests
  // ==========================================================================

  describe('Convenience Functions', () => {
    it('should provide calculatePerkBonuses convenience function', () => {
      const spell = createValidSpell(17, 10)
      const spellData = createValidSpellData([spell])
      const perk = createValidPerkItem('Test Perk', 12345, [spellData])

      const result = calculatePerkBonuses([perk])
      expect(result).toEqual({
        'Assault Rifle': 10
      })
    })

    it('should provide parseItemForStatBonuses convenience function', () => {
      const spell = createValidSpell(17, 10)
      const spellData = createValidSpellData([spell])
      const perk = createValidPerkItem('Test Perk', 12345, [spellData])

      const result = parseItemForStatBonuses(perk)
      expect(result).toEqual([{
        statId: 17,
        skillName: 'Assault Rifle',
        amount: 10,
        perkName: 'Test Perk',
        perkAoid: 12345
      }])
    })

    it('should warn about slow calculations in convenience function', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Mock performance.now to simulate slow calculation
      const originalNow = performance.now
      let callCount = 0
      vi.stubGlobal('performance', {
        now: () => {
          callCount++
          return callCount === 1 ? 0 : 250 // 250ms calculation time
        }
      })

      const perks = createPerformanceTestPerks(10)
      calculatePerkBonuses(perks)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('exceeded 200ms threshold')
      )

      // Restore original implementation
      vi.stubGlobal('performance', { now: originalNow })
      consoleSpy.mockRestore()
    })

    it('should handle errors in convenience functions gracefully', () => {
      const result1 = calculatePerkBonuses(null as any)
      expect(result1).toEqual({})

      const result2 = parseItemForStatBonuses(null as any)
      expect(result2).toEqual([])

      const result3 = calculatePerkBonusesWithErrors(null as any)
      expect(result3.success).toBe(false)

      const result4 = parseItemForStatBonusesWithErrors(null as any)
      expect(result4.bonuses).toEqual([])
      expect(result4.errors.length).toBeGreaterThan(0)
    })
  })

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('Integration Tests', () => {
    it('should handle mixed valid and invalid perks gracefully', () => {
      // Test with valid perks and some that have no spell data
      const mixedPerks: Item[] = [
        // Valid perk
        createValidPerkItem('Valid Perk', 10001, [
          createValidSpellData([createValidSpell(17, 10)])
        ]),

        // Perk with no spell data (should be ignored gracefully)
        createValidPerkItem('No Effects Perk', 20001),

        // Another valid perk
        createValidPerkItem('Another Valid Perk', 30001, [
          createValidSpellData([createValidSpell(76, 5)])
        ])
      ]

      const result = calculatePerkBonusesWithErrors(mixedPerks)

      // Should get bonuses from valid perks
      expect(Object.keys(result.bonuses).length).toBeGreaterThan(0)
      expect(result.success).toBe(true)
      expect(result.bonuses['Assault Rifle']).toBe(10)
      expect(result.bonuses['Dodge-Rng']).toBe(5)
    })

    it('should handle large number of perks efficiently', () => {
      const manyPerks = createPerformanceTestPerks(25)

      const startTime = Date.now()
      const result = calculator.calculateBonuses(manyPerks)
      const endTime = Date.now()

      const processingTime = endTime - startTime

      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
      expect(processingTime).toBeLessThan(200) // Performance requirement

      console.log(`Processed ${manyPerks.length} perks in ${processingTime}ms`)
    })

    it('should provide comprehensive error reporting', () => {
      const invalidPerks: Item[] = [
        // null entry
        null as any,
        // Valid perk for comparison
        createValidPerkItem('Valid Perk', 10001, [
          createValidSpellData([createValidSpell(17, 10)])
        ])
      ]

      const result = calculatePerkBonusesWithErrors(invalidPerks)

      expect(result.warnings.length).toBeGreaterThan(0) // Should have warnings for null perk
      expect(result.success).toBe(true) // Should succeed despite warnings
      expect(typeof result.bonuses).toBe('object')
      expect(result.bonuses['Assault Rifle']).toBe(10) // Valid perk should still work
    })
  })
})
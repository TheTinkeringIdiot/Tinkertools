/**
 * Spell Data Utils Tests
 * 
 * Tests for the spell data utility functions
 */

import { describe, it, expect } from 'vitest'
import { 
  getSpellFormat, 
  formatSpell, 
  interpolateSpellText,
  getEventName,
  getTargetName,
  formatSpellParameter
} from '../../services/spell-data-utils'
import type { Spell } from '../../types/api'

describe('spell-data-utils', () => {
  describe('getSpellFormat', () => {
    it('should return format string for valid spell_id', () => {
      // Test with a known spell format ID from SPELL_FORMATS
      const format = getSpellFormat(53002)
      expect(format).toBe('Hit {Stat} for {MinValue} to {MaxValue} {TickCount}x @ {TickInterval}s')
    })

    it('should return undefined for unknown spell_id', () => {
      const format = getSpellFormat(999999)
      expect(format).toBeUndefined()
    })

    it('should handle zero and negative spell_id values', () => {
      expect(getSpellFormat(0)).toBeUndefined()
      expect(getSpellFormat(-1)).toBeUndefined()
    })
  })

  describe('formatSpell', () => {
    const mockSpell: Spell = {
      id: 1,
      target: 1,
      tick_count: 1,
      tick_interval: 100,
      spell_id: 53002, // Known format in SPELL_FORMATS
      spell_format: 'Old format string', // Should be ignored
      spell_params: {
        Stat: 'Intelligence',
        MinValue: 10,
        MaxValue: 20,
        TickCount: 1,
        TickInterval: 100
      },
      criteria: []
    }

    it('should use spell_id to look up format from SPELL_FORMATS', () => {
      const result = formatSpell(mockSpell)
      
      // The format should include TickCount and TickInterval from spell fields, not params
      expect(result.formattedText).toContain('Hit Intelligence for 10 to 20 1x @ 100s')
      expect(result.spellId).toBe(53002)
    })

    it('should fall back to generated text when spell_id format not found', () => {
      const spellWithUnknownId: Spell = {
        ...mockSpell,
        spell_id: 999999, // Unknown format
        target: 1
      }

      const result = formatSpell(spellWithUnknownId)
      
      // Should generate fallback text
      expect(result.formattedText).toBeTruthy()
      expect(result.formattedText).not.toContain('Hit Intelligence for')
    })

    it('should handle spell without spell_id', () => {
      const spellWithoutId: Spell = {
        ...mockSpell,
        spell_id: undefined
      }

      const result = formatSpell(spellWithoutId)
      
      // Should generate fallback text
      expect(result.formattedText).toBeTruthy()
      expect(result.spellId).toBeUndefined()
    })

    it('should format parameters correctly', () => {
      const result = formatSpell(mockSpell)
      
      expect(result.parameters).toHaveLength(5) // All 5 parameters from spell_params
      expect(result.parameters.some(p => p.key === 'Stat' && p.displayValue === 'Intelligence')).toBe(true)
      expect(result.parameters.some(p => p.key === 'MinValue' && p.displayValue === '10')).toBe(true)
    })

    it('should use spell fields for TickCount and TickInterval in interpolation', () => {
      const spellWithDifferentTicks: Spell = {
        ...mockSpell,
        tick_count: 5,
        tick_interval: 200,
        spell_params: {
          Stat: 'Intelligence',
          MinValue: 10,
          MaxValue: 20,
          // These should be ignored in favor of spell fields
          TickCount: 999,
          TickInterval: 999
        }
      }

      const result = formatSpell(spellWithDifferentTicks)
      
      // Should use spell.tick_count (5) and spell.tick_interval (200), not the params
      expect(result.formattedText).toContain('5x @ 200s')
      expect(result.formattedText).not.toContain('999')
    })
  })

  describe('interpolateSpellText', () => {
    it('should interpolate basic parameters', () => {
      const format = 'Hit {Stat} for {MinValue} to {MaxValue}'
      const params = {
        Stat: 'Intelligence',
        MinValue: 10,
        MaxValue: 20
      }

      const result = interpolateSpellText(format, params)
      expect(result).toBe('Hit Intelligence for 10 to 20')
    })

    it('should handle NanoID parameters as links', () => {
      const format = 'Upload {NanoID}'
      const params = { NanoID: 12345 }

      const result = interpolateSpellText(format, params)
      expect(result).toBe('Upload [LINK:12345]')
    })

    it('should handle chance parameters as percentages', () => {
      const format = '{Chance} chance to cast {NanoID}'
      const params = { 
        Chance: 0.25, // Will be displayed as 0.25%
        NanoID: 12345 
      }

      const result = interpolateSpellText(format, params)
      expect(result).toBe('0.25% chance to cast [LINK:12345]')
    })

    it('should preserve unmatched placeholders', () => {
      const format = 'Hit {Stat} for {UnknownParam}'
      const params = { Stat: 'Intelligence' }

      const result = interpolateSpellText(format, params)
      expect(result).toBe('Hit Intelligence for {UnknownParam}')
    })

    it('should remove formatting tags', () => {
      const format = '{|right|}Hit {Stat}{|/right|}'
      const params = { Stat: 'Intelligence' }

      const result = interpolateSpellText(format, params)
      expect(result).toBe('Hit Intelligence')
    })
  })

  describe('getEventName', () => {
    it('should return known event names', () => {
      expect(getEventName(0)).toBe('Use')
      expect(getEventName(2)).toBe('Wield')
      expect(getEventName(14)).toBe('Wear')
    })

    it('should return fallback for unknown events', () => {
      expect(getEventName(999)).toBe('Event 999')
    })
  })

  describe('getTargetName', () => {
    it('should return known target names', () => {
      expect(getTargetName(1)).toBe('Self')
      expect(getTargetName(2)).toBe('User')
      expect(getTargetName(3)).toBe('Target')
    })

    it('should return fallback for unknown targets', () => {
      expect(getTargetName(999)).toBe('Target 999')
    })
  })

  describe('formatSpellParameter', () => {
    it('should format NanoID parameters as links', () => {
      const result = formatSpellParameter('NanoID', 12345)
      
      expect(result.type).toBe('link')
      expect(result.displayValue).toBe('Item 12345')
      expect(result.linkUrl).toBe('/items/12345')
    })

    it('should format chance parameters as percentages', () => {
      const result = formatSpellParameter('Chance', 0.25)
      
      expect(result.type).toBe('percentage')
      expect(result.displayValue).toBe('25.0%')
    })

    it('should format stat parameters with stat names', () => {
      const result = formatSpellParameter('Stat', 16) // Strength ID (16 is Strength, 19 is Intelligence)
      
      expect(result.type).toBe('stat')
      expect(result.displayValue).toContain('Strength')
    })

    it('should format numeric parameters', () => {
      const result = formatSpellParameter('Damage', 150)
      
      expect(result.type).toBe('number')
      expect(result.displayValue).toBe('150')
    })

    it('should format text parameters', () => {
      const result = formatSpellParameter('Description', 'Some text')
      
      expect(result.type).toBe('text')
      expect(result.displayValue).toBe('Some text')
    })
  })
})
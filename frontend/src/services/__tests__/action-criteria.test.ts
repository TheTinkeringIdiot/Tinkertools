/**
 * Unit tests for action-criteria service
 * 
 * Tests all transformation logic, operator handling, and utility functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  parseCriterion,
  transformCriterionForDisplay,
  parseCriteriaExpression,
  parseAction,
  getCriteriaRequirements,
  checkActionRequirements,
  formatCriteriaText,
  actionCriteriaService
} from '../action-criteria'
import type { Criterion, Action } from '../../types/api'

// Mock game-data constants
vi.mock('../game-data', () => ({
  TEMPLATE_ACTION: {
    0: 'Any',
    1: 'Get',
    3: 'Use',
    5: 'UseItemOnItem',
    6: 'Wield',
    8: 'Attack',
    9: 'Use'
  },
  OPERATOR: {
    0: 'StatEqual',
    1: 'StatLessThan',
    2: 'StatGreaterThan',
    22: 'StatBitSet',
    24: 'StatNotEqual',
    107: 'StatBitNotSet',
    3: 'Or',
    4: 'And',
    42: 'Not'
  },
  STAT: {
    0: 'None',
    16: 'Agility',
    17: 'Stamina',
    18: 'Strength',
    19: 'Intelligence',
    20: 'Psychic',
    21: 'Sense',
    54: 'Level',
    60: 'Profession',
    112: 'Pistol',
    150: 'FlingShot'
  },
  PROFESSION: {
    0: 'Unknown',
    1: 'Soldier',
    2: 'MartialArtist',
    3: 'Engineer',
    4: 'Fixer',
    5: 'Agent',
    6: 'Adventurer',
    7: 'Trader',
    8: 'Bureaucrat'
  },
  BREED: {
    0: 'Solitus',
    1: 'Opifex',
    2: 'Nanomage',
    3: 'Atrox'
  },
  GENDER: {
    0: 'Male',
    1: 'Female',
    2: 'Neuter'
  }
}))

// Mock game-utils functions
vi.mock('../game-utils', () => ({
  getStatName: (id: number) => {
    const stats: Record<number, string> = {
      0: 'None',
      16: 'Agility',
      17: 'Stamina',
      18: 'Strength',
      19: 'Intelligence',
      20: 'Psychic',
      21: 'Sense',
      30: 'Stat 30',
      54: 'Level',
      60: 'Profession',
      112: 'Pistol',
      150: 'FlingShot'
    }
    return stats[id]
  },
  getProfessionName: (id: number) => {
    const professions: Record<number, string> = {
      0: 'Unknown',
      1: 'Soldier',
      2: 'MartialArtist',
      3: 'Engineer',
      4: 'Fixer',
      5: 'Agent',
      6: 'Adventurer',
      7: 'Trader',
      8: 'Bureaucrat'
    }
    return professions[id]
  },
  getBreedName: (id: number) => {
    const breeds: Record<number, string> = {
      0: 'Solitus',
      1: 'Opifex',
      2: 'Nanomage',
      3: 'Atrox'
    }
    return breeds[id]
  },
  getGenderName: (id: number) => {
    const genders: Record<number, string> = {
      0: 'Male',
      1: 'Female',
      2: 'Neuter'
    }
    return genders[id]
  },
  getFlagNameFromValue: (stat: number, value: number) => {
    return `flag ${value}`
  }
}))

describe('action-criteria service', () => {
  describe('parseCriterion', () => {
    it('should parse a basic criterion correctly', () => {
      const criterion: Criterion = {
        id: 1,
        value1: 112, // Pistol
        value2: 356,
        operator: 2 // StatGreaterThan
      }

      const result = parseCriterion(criterion)

      expect(result).toEqual({
        id: 1,
        stat: 112,
        statName: 'Pistol',
        value: 356,
        operator: 2,
        operatorName: 'StatGreaterThan',
        rawDescription: 'Pistol StatGreaterThan 356'
      })
    })

    it('should handle unknown stat IDs', () => {
      const criterion: Criterion = {
        id: 1,
        value1: 999, // Unknown stat
        value2: 100,
        operator: 0
      }

      const result = parseCriterion(criterion)
      expect(result.statName).toBe('Stat 999')
    })
  })

  describe('transformCriterionForDisplay', () => {
    describe('operator transformations', () => {
      it('should transform StatGreaterThan (>) to >= with +1 value', () => {
        const criterion: Criterion = {
          id: 1,
          value1: 112, // Pistol
          value2: 356,
          operator: 2 // StatGreaterThan
        }

        const result = transformCriterionForDisplay(criterion)

        expect(result.displayValue).toBe(357) // 356 + 1
        expect(result.displaySymbol).toBe('≥')
        expect(result.displayOperator).toBe('Greater than or equal to')
        expect(result.description).toBe('Pistol ≥ 357')
        expect(result.isStatRequirement).toBe(true)
      })

      it('should transform StatLessThan (<) to <= with -1 value', () => {
        const criterion: Criterion = {
          id: 1,
          value1: 127, // Psychology
          value2: 200,
          operator: 1 // StatLessThan
        }

        const result = transformCriterionForDisplay(criterion)

        expect(result.displayValue).toBe(199) // 200 - 1
        expect(result.displaySymbol).toBe('≤')
        expect(result.displayOperator).toBe('Less than or equal to')
        expect(result.description).toBe('Stat 127 ≤ 199')
        expect(result.isStatRequirement).toBe(true)
      })

      it('should handle StatEqual (=) without transformation', () => {
        const criterion: Criterion = {
          id: 1,
          value1: 60, // Profession
          value2: 8,
          operator: 0 // StatEqual
        }

        const result = transformCriterionForDisplay(criterion)

        expect(result.displayValue).toBe(8)
        expect(result.displaySymbol).toBe('=')
        expect(result.description).toBe('Profession = Bureaucrat')
        expect(result.isStatRequirement).toBe(true)
      })

      it('should handle StatNotEqual (≠)', () => {
        const criterion: Criterion = {
          id: 1,
          value1: 60,
          value2: 5,
          operator: 24 // StatNotEqual
        }

        const result = transformCriterionForDisplay(criterion)

        expect(result.displayValue).toBe(5)
        expect(result.displaySymbol).toBe('≠')
        expect(result.description).toBe('Profession ≠ 5')
        expect(result.isStatRequirement).toBe(true)
      })

      it('should handle bit set operations', () => {
        const criterion: Criterion = {
          id: 1,
          value1: 30, // Can flags
          value2: 64,
          operator: 22 // StatBitSet
        }

        const result = transformCriterionForDisplay(criterion)

        expect(result.displaySymbol).toBe('has')
        expect(result.description).toBe('Stat 30 has flag 64')
        expect(result.isStatRequirement).toBe(true)
      })
    })

    describe('logical operators', () => {
      it('should identify AND operators (separators)', () => {
        const criterion: Criterion = {
          id: 1,
          value1: 0,
          value2: 0,
          operator: 4 // And
        }

        const result = transformCriterionForDisplay(criterion)

        expect(result.isLogicalOperator).toBe(true)
        expect(result.isSeparator).toBe(true)
        expect(result.displayOperator).toBe('AND')
        expect(result.description).toBe('AND')
        expect(result.isStatRequirement).toBe(false)
      })

      it('should identify OR operators', () => {
        const criterion: Criterion = {
          id: 1,
          value1: 0,
          value2: 0,
          operator: 3 // Or
        }

        const result = transformCriterionForDisplay(criterion)

        expect(result.isLogicalOperator).toBe(true)
        expect(result.isSeparator).toBe(false)
        expect(result.displayOperator).toBe('OR')
        expect(result.description).toBe('OR')
        expect(result.isStatRequirement).toBe(false)
      })

      it('should identify NOT operators', () => {
        const criterion: Criterion = {
          id: 1,
          value1: 0,
          value2: 0,
          operator: 42 // Not
        }

        const result = transformCriterionForDisplay(criterion)

        expect(result.isLogicalOperator).toBe(true)
        expect(result.displayOperator).toBe('NOT')
        expect(result.description).toBe('NOT')
        expect(result.isStatRequirement).toBe(false)
      })
    })

    describe('special stat formatting', () => {
      it('should format Level stat with prefix', () => {
        const criterion: Criterion = {
          id: 1,
          value1: 54, // Level
          value2: 150,
          operator: 2
        }

        const result = transformCriterionForDisplay(criterion)
        expect(result.description).toBe('Level ≥ 151')
      })

      it('should format Profession stat with name lookup', () => {
        const criterion: Criterion = {
          id: 1,
          value1: 60, // Profession
          value2: 5, // Agent
          operator: 0
        }

        const result = transformCriterionForDisplay(criterion)
        expect(result.description).toBe('Profession = Agent')
      })

      it('should format Breed stat with name lookup', () => {
        const criterion: Criterion = {
          id: 1,
          value1: 4, // Breed
          value2: 1, // Opifex
          operator: 0
        }

        const result = transformCriterionForDisplay(criterion)
        expect(result.description).toBe('Breed = Opifex')
      })

      it('should format Gender stat with name lookup', () => {
        const criterion: Criterion = {
          id: 1,
          value1: 59, // Gender
          value2: 1, // Female
          operator: 0
        }

        const result = transformCriterionForDisplay(criterion)
        expect(result.description).toBe('Gender = Female')
      })
    })
  })

  describe('parseCriteriaExpression', () => {
    it('should handle simple stat requirements', () => {
      const criteria: Criterion[] = [
        { id: 1, value1: 112, value2: 356, operator: 2 }
      ]

      const result = parseCriteriaExpression(criteria)

      expect(result).toEqual({
        type: 'criterion',
        criterion: expect.objectContaining({
          description: 'Pistol ≥ 357'
        }),
        description: 'Pistol ≥ 357'
      })
    })

    it('should handle logical expressions with reverse polish notation', () => {
      const criteria: Criterion[] = [
        { id: 1, value1: 112, value2: 356, operator: 2 }, // Pistol > 356
        { id: 2, value1: 17, value2: 200, operator: 2 },  // Stamina > 200
        { id: 3, value1: 0, value2: 0, operator: 4 }      // AND
      ]

      const result = parseCriteriaExpression(criteria)

      expect(result?.type).toBe('logical')
      expect(result?.operator).toBe('AND')
      expect(result?.description).toBe('(Pistol ≥ 357 AND Stamina ≥ 201)')
    })

    it('should handle complex nested expressions', () => {
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 8, operator: 0 },   // Profession = 8
        { id: 2, value1: 112, value2: 442, operator: 2 }, // Pistol > 442
        { id: 3, value1: 0, value2: 0, operator: 4 },     // AND
        { id: 4, value1: 150, value2: 221, operator: 2 }, // FlingShot > 221
        { id: 5, value1: 0, value2: 0, operator: 4 }      // AND
      ]

      const result = parseCriteriaExpression(criteria)

      expect(result?.type).toBe('logical')
      expect(result?.operator).toBe('AND')
      expect(result?.description).toBe('((Profession = Bureaucrat AND Pistol ≥ 443) AND FlingShot ≥ 222)')
    })

    it('should handle NOT operations', () => {
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 5, operator: 0 }, // Profession = 5
        { id: 2, value1: 0, value2: 0, operator: 42 }  // NOT
      ]

      const result = parseCriteriaExpression(criteria)

      expect(result?.type).toBe('logical')
      expect(result?.operator).toBe('NOT')
      expect(result?.description).toBe('NOT (Profession = Agent)')
    })

    it('should return null for empty criteria', () => {
      const result = parseCriteriaExpression([])
      expect(result).toBeNull()
    })
  })

  describe('parseAction', () => {
    it('should parse a complete action with criteria', () => {
      const action: Action = {
        id: 1,
        action: 6, // Wield
        item_id: 123,
        criteria: [
          { id: 1, value1: 112, value2: 356, operator: 2 }
        ]
      }

      const result = parseAction(action)

      expect(result.actionName).toBe('Wield')
      expect(result.hasRequirements).toBe(true)
      expect(result.criteria).toHaveLength(1)
      expect(result.expression).toBeDefined()
      expect(result.description).toContain('Wield:')
    })

    it('should handle actions without requirements', () => {
      const action: Action = {
        id: 1,
        action: 1, // Get
        item_id: 123,
        criteria: []
      }

      const result = parseAction(action)

      expect(result.actionName).toBe('Get')
      expect(result.hasRequirements).toBe(false)
      expect(result.description).toBe('Get: No requirements')
    })

    it('should handle unknown action types', () => {
      const action: Action = {
        id: 1,
        action: 999,
        item_id: 123,
        criteria: []
      }

      const result = parseAction(action)

      expect(result.actionName).toBe('Action 999')
    })
  })

  describe('getCriteriaRequirements', () => {
    it('should extract stat requirements from criteria', () => {
      const criteria: Criterion[] = [
        { id: 1, value1: 112, value2: 356, operator: 2 }, // Pistol >= 357
        { id: 2, value1: 54, value2: 149, operator: 1 },  // Level <= 148
        { id: 3, value1: 60, value2: 8, operator: 0 },    // Profession = 8
        { id: 4, value1: 0, value2: 0, operator: 4 }      // AND (ignored)
      ]

      const result = getCriteriaRequirements(criteria)

      expect(result).toHaveLength(3)
      
      const pistolReq = result.find(r => r.stat === 112)
      expect(pistolReq).toEqual({
        stat: 112,
        statName: 'Pistol',
        minValue: 357
      })

      const levelReq = result.find(r => r.stat === 54)
      expect(levelReq).toEqual({
        stat: 54,
        statName: 'Level',
        maxValue: 148
      })

      const professionReq = result.find(r => r.stat === 60)
      expect(professionReq).toEqual({
        stat: 60,
        statName: 'Profession',
        exactValue: 8
      })
    })

    it('should handle multiple requirements for the same stat', () => {
      const criteria: Criterion[] = [
        { id: 1, value1: 112, value2: 300, operator: 2 }, // Pistol >= 301
        { id: 2, value1: 112, value2: 500, operator: 1 }, // Pistol <= 499
        { id: 3, value1: 0, value2: 0, operator: 4 }      // AND
      ]

      const result = getCriteriaRequirements(criteria)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        stat: 112,
        statName: 'Pistol',
        minValue: 301,
        maxValue: 499
      })
    })

    it('should handle bit flag requirements', () => {
      const criteria: Criterion[] = [
        { id: 1, value1: 30, value2: 64, operator: 22 },  // Must have flag
        { id: 2, value1: 30, value2: 32, operator: 107 }  // Must lack flag
      ]

      const result = getCriteriaRequirements(criteria)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        stat: 30,
        statName: 'Stat 30',
        mustHaveFlag: 64,
        mustLackFlag: 32
      })
    })
  })

  describe('checkActionRequirements', () => {
    const mockAction = {
      id: 1,
      action: 6,
      actionName: 'Wield',
      hasRequirements: true,
      description: 'Wield: Requirements',
      criteria: [
        {
          id: 1,
          stat: 112,
          statName: 'Pistol',
          displayValue: 357,
          displaySymbol: '≥',
          displayOperator: 'Greater than or equal to',
          description: 'Pistol ≥ 357',
          isLogicalOperator: false,
          isSeparator: false,
          isStatRequirement: true
        }
      ],
      rawCriteria: [
        { id: 1, value1: 112, value2: 356, operator: 2 }
      ]
    }

    it('should identify when requirements are met', () => {
      const characterStats = { 112: 400 } // Pistol: 400

      const result = checkActionRequirements(mockAction, characterStats)

      expect(result.canPerform).toBe(true)
      expect(result.unmetRequirements).toHaveLength(0)
    })

    it('should identify when requirements are not met', () => {
      const characterStats = { 112: 300 } // Pistol: 300 (too low)

      const result = checkActionRequirements(mockAction, characterStats)

      expect(result.canPerform).toBe(false)
      expect(result.unmetRequirements).toHaveLength(1)
      expect(result.unmetRequirements[0]).toEqual({
        stat: 112,
        statName: 'Pistol',
        required: 357,
        current: 300,
        operator: '≥'
      })
    })

    it('should handle missing character stats as 0', () => {
      const characterStats = {} // No stats

      const result = checkActionRequirements(mockAction, characterStats)

      expect(result.canPerform).toBe(false)
      expect(result.unmetRequirements[0].current).toBe(0)
    })

    it('should handle different operators correctly', () => {
      const equalAction = {
        ...mockAction,
        criteria: [{
          ...mockAction.criteria[0],
          displayValue: 8,
          displaySymbol: '=',
          description: 'Profession = Bureaucrat'
        }],
        rawCriteria: [
          { id: 1, value1: 112, value2: 8, operator: 0 }
        ]
      }

      // Test equal - match
      let result = checkActionRequirements(equalAction, { 112: 8 })
      expect(result.canPerform).toBe(true)

      // Test equal - no match
      result = checkActionRequirements(equalAction, { 112: 5 })
      expect(result.canPerform).toBe(false)
    })

    it('should handle OR logic correctly (profession requirements)', () => {
      // Typical OR pattern: (Prof = 1) OR (Prof = 2) OR (Prof = 3)
      // RPN: Prof=1 Prof=2 OR Prof=3 OR
      const action: Action = {
        id: 1,
        action: 6, // Wield
        item_id: 123,
        criteria: [
          { id: 1, value1: 60, value2: 1, operator: 0 },  // Profession = 1 (Soldier)
          { id: 2, value1: 60, value2: 2, operator: 0 },  // Profession = 2 (MartialArtist)
          { id: 3, value1: 0, value2: 0, operator: 3 },   // OR
          { id: 4, value1: 60, value2: 3, operator: 0 },  // Profession = 3 (Engineer)
          { id: 5, value1: 0, value2: 0, operator: 3 }    // OR
        ]
      }

      const parsedAction = parseAction(action)

      // Character is Soldier (meets first option)
      let result = checkActionRequirements(parsedAction, { 60: 1 })
      expect(result.canPerform).toBe(true)
      expect(result.unmetRequirements).toHaveLength(0)

      // Character is MartialArtist (meets second option)
      result = checkActionRequirements(parsedAction, { 60: 2 })
      expect(result.canPerform).toBe(true)
      expect(result.unmetRequirements).toHaveLength(0)

      // Character is Engineer (meets third option)
      result = checkActionRequirements(parsedAction, { 60: 3 })
      expect(result.canPerform).toBe(true)
      expect(result.unmetRequirements).toHaveLength(0)

      // Character is Agent (doesn't meet any option)
      result = checkActionRequirements(parsedAction, { 60: 5 })
      expect(result.canPerform).toBe(false)
      expect(result.unmetRequirements.length).toBeGreaterThan(0)
    })
  })

  describe('formatCriteriaText', () => {
    it('should format simple criterion expressions', () => {
      const expression = {
        type: 'criterion' as const,
        criterion: {
          id: 1,
          stat: 112,
          statName: 'Pistol',
          displayValue: 357,
          displaySymbol: '≥',
          displayOperator: 'Greater than or equal to',
          description: 'Pistol ≥ 357',
          isLogicalOperator: false,
          isSeparator: false,
          isStatRequirement: true
        },
        description: 'Pistol ≥ 357'
      }

      const result = formatCriteriaText(expression)
      expect(result).toBe('Pistol ≥ 357')
    })

    it('should format logical expressions with proper grouping', () => {
      const expression = {
        type: 'logical' as const,
        operator: 'AND',
        operands: [
          {
            type: 'criterion' as const,
            criterion: {
              id: 1,
              stat: 112,
              statName: 'Pistol',
              displayValue: 357,
              displaySymbol: '≥',
              displayOperator: 'Greater than or equal to',
              description: 'Pistol ≥ 357',
              isLogicalOperator: false,
              isSeparator: false,
              isStatRequirement: true
            },
            description: 'Pistol ≥ 357'
          },
          {
            type: 'criterion' as const,
            criterion: {
              id: 2,
              stat: 54,
              statName: 'Level',
              displayValue: 151,
              displaySymbol: '≥',
              displayOperator: 'Greater than or equal to',
              description: 'Level ≥ 151',
              isLogicalOperator: false,
              isSeparator: false,
              isStatRequirement: true
            },
            description: 'Level ≥ 151'
          }
        ],
        description: '(Pistol ≥ 357 AND Level ≥ 151)'
      }

      const result = formatCriteriaText(expression)
      expect(result).toBe('(Pistol ≥ 357 AND Level ≥ 151)')
    })

    it('should format NOT expressions', () => {
      const expression = {
        type: 'logical' as const,
        operator: 'NOT',
        operands: [{
          type: 'criterion' as const,
          criterion: {
            id: 1,
            stat: 60,
            statName: 'Profession',
            displayValue: 5,
            displaySymbol: '=',
            displayOperator: 'Equal to',
            description: 'Profession = Agent',
            isLogicalOperator: false,
            isSeparator: false,
            isStatRequirement: true
          },
          description: 'Profession = Agent'
        }],
        description: 'NOT (Profession = Agent)'
      }

      const result = formatCriteriaText(expression)
      expect(result).toBe('NOT (Profession = Agent)')
    })

    it('should return empty string for null/undefined expressions', () => {
      expect(formatCriteriaText(null as any)).toBe('')
      expect(formatCriteriaText(undefined as any)).toBe('')
    })
  })

  describe('actionCriteriaService export', () => {
    it('should export all expected functions', () => {
      expect(actionCriteriaService).toHaveProperty('parseCriterion')
      expect(actionCriteriaService).toHaveProperty('transformCriterionForDisplay')
      expect(actionCriteriaService).toHaveProperty('parseCriteriaExpression')
      expect(actionCriteriaService).toHaveProperty('parseAction')
      expect(actionCriteriaService).toHaveProperty('getCriteriaRequirements')
      expect(actionCriteriaService).toHaveProperty('checkActionRequirements')
      expect(actionCriteriaService).toHaveProperty('formatCriteriaText')
      expect(actionCriteriaService).toHaveProperty('LOGICAL_OPERATORS')
      expect(actionCriteriaService).toHaveProperty('DISPLAY_OPERATORS')
      expect(actionCriteriaService).toHaveProperty('STATE_OPERATORS')
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle criteria with unknown operators gracefully', () => {
      const criterion: Criterion = {
        id: 1,
        value1: 112,
        value2: 356,
        operator: 999 // Unknown operator
      }

      const result = transformCriterionForDisplay(criterion)

      expect(result.displayOperator).toBe('Op999')
      expect(result.displaySymbol).toBe('Op999')
      expect(result.description).toBe('Pistol Op999 356')
      expect(result.isStatRequirement).toBe(true)
    })

    it('should handle empty action criteria', () => {
      const action: Action = {
        id: 1,
        action: 6,
        item_id: 123,
        criteria: []
      }

      const result = parseAction(action)
      expect(result.hasRequirements).toBe(false)
      expect(result.criteria).toHaveLength(0)
    })

    it('should handle malformed reverse polish notation gracefully', () => {
      // Missing operands for operator
      const criteria: Criterion[] = [
        { id: 1, value1: 0, value2: 0, operator: 4 } // AND with no operands
      ]

      const result = parseCriteriaExpression(criteria)
      expect(result).toBeNull() // Should handle gracefully
    })
  })
})

describe('integration tests', () => {
  it('should handle real-world Dark Pistol example correctly', () => {
    const darkPistolAction: Action = {
      id: 93424,
      action: 8, // Attack  
      item_id: 129671,
      criteria: [
        { id: 1, value1: 60, value2: 8, operator: 0 },   // Profession = 8 (Bureaucrat)
        { id: 2, value1: 112, value2: 442, operator: 2 }, // Pistol > 442
        { id: 3, value1: 0, value2: 0, operator: 4 },     // AND
        { id: 4, value1: 150, value2: 221, operator: 2 }, // FlingShot > 221
        { id: 5, value1: 0, value2: 0, operator: 4 }      // AND
      ]
    }

    const result = parseAction(darkPistolAction)

    expect(result.actionName).toBe('Attack')
    expect(result.hasRequirements).toBe(true)
    expect(result.expression?.description).toBe('((Profession = Bureaucrat AND Pistol ≥ 443) AND FlingShot ≥ 222)')

    // Test with character that meets requirements
    const validCharacter = {
      60: 8,   // Bureaucrat
      112: 500, // Pistol 500
      150: 250  // FlingShot 250
    }

    const evalResult = checkActionRequirements(result, validCharacter)
    expect(evalResult.canPerform).toBe(true)

    // Test with character that doesn't meet requirements  
    const invalidCharacter = {
      60: 5,   // Agent (wrong profession)
      112: 400, // Pistol 400 (too low)
      150: 200  // FlingShot 200 (too low)
    }

    const evalResult2 = checkActionRequirements(result, invalidCharacter)
    expect(evalResult2.canPerform).toBe(false)
    expect(evalResult2.unmetRequirements.length).toBeGreaterThan(0)
  })
})
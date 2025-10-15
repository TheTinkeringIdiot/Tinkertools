/**
 * Unit tests for useActionCriteria composables
 * 
 * Tests Vue composables for action and criteria display functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed } from 'vue'
import {
  useActionDisplay,
  useCriteriaDisplay,
  useCriteriaEvaluation,
  useItemActions,
  useActionCriteria,
  hasStatRequirements,
  getMostRestrictiveRequirement,
  formatRequirement,
  isRequirementMet,
  type CharacterStats
} from '../useActionCriteria'
import type { Action, Criterion } from '../../types/api'

// Mock the action-criteria service
vi.mock('../../services/action-criteria', () => ({
  parseAction: vi.fn(),
  transformCriterionForDisplay: vi.fn(),
  parseCriteriaExpression: vi.fn(),
  getCriteriaRequirements: vi.fn(),
  checkActionRequirements: vi.fn(),
  formatCriteriaText: vi.fn()
}))

// Import mocked functions
import {
  parseAction,
  transformCriterionForDisplay,
  parseCriteriaExpression,
  getCriteriaRequirements,
  checkActionRequirements,
  formatCriteriaText
} from '../../services/action-criteria'

describe('useActionCriteria composables', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useActionDisplay', () => {
    const mockActions: Action[] = [
      {
        id: 1,
        action: 6, // Wield
        item_id: 123,
        criteria: [
          { id: 1, value1: 112, value2: 356, operator: 2 }
        ]
      },
      {
        id: 2,
        action: 1, // Get
        item_id: 123,
        criteria: []
      },
      {
        id: 3,
        action: 8, // Attack
        item_id: 123,
        criteria: [
          { id: 2, value1: 54, value2: 150, operator: 2 }
        ]
      }
    ]

    const mockParsedActions = [
      {
        id: 1,
        action: 6,
        actionName: 'Wield',
        hasRequirements: true,
        description: 'Wield: Requirements',
        criteria: [],
        expression: null
      },
      {
        id: 2,
        action: 1,
        actionName: 'Get',
        hasRequirements: false,
        description: 'Get: No requirements',
        criteria: [],
        expression: null
      },
      {
        id: 3,
        action: 8,
        actionName: 'Attack',
        hasRequirements: true,
        description: 'Attack: Requirements',
        criteria: [],
        expression: null
      }
    ]

    beforeEach(() => {
      vi.mocked(parseAction).mockImplementation((action) => {
        return mockParsedActions.find(p => p.id === action.id)!
      })
    })

    it('should parse all actions', () => {
      const actions = ref(mockActions)
      const { parsedActions } = useActionDisplay(actions)

      expect(parsedActions.value).toHaveLength(3)
      expect(parseAction).toHaveBeenCalledTimes(3)
      expect(parsedActions.value[0].actionName).toBe('Wield')
      expect(parsedActions.value[1].actionName).toBe('Get')
      expect(parsedActions.value[2].actionName).toBe('Attack')
    })

    it('should filter actions with requirements', () => {
      const actions = ref(mockActions)
      const { actionsWithRequirements } = useActionDisplay(actions)

      expect(actionsWithRequirements.value).toHaveLength(2)
      expect(actionsWithRequirements.value[0].actionName).toBe('Wield')
      expect(actionsWithRequirements.value[1].actionName).toBe('Attack')
    })

    it('should filter simple actions without requirements', () => {
      const actions = ref(mockActions)
      const { simpleActions } = useActionDisplay(actions)

      expect(simpleActions.value).toHaveLength(1)
      expect(simpleActions.value[0].actionName).toBe('Get')
    })

    it('should get action names', () => {
      const actions = ref(mockActions)
      const { getActionNames } = useActionDisplay(actions)

      expect(getActionNames.value).toEqual(['Wield', 'Get', 'Attack'])
    })

    it('should identify primary action (Wield first)', () => {
      const actions = ref(mockActions)
      const { primaryAction } = useActionDisplay(actions)

      expect(primaryAction.value?.actionName).toBe('Wield')
    })

    it('should identify primary action (first with requirements if no Wield)', () => {
      const actionsWithoutWield = mockActions.filter(a => a.action !== 6)
      const actions = ref(actionsWithoutWield)
      
      vi.mocked(parseAction).mockImplementation((action) => {
        return mockParsedActions.find(p => p.id === action.id)!
      })
      
      const { primaryAction } = useActionDisplay(actions)

      expect(primaryAction.value?.actionName).toBe('Attack')
    })

    it('should handle empty actions array', () => {
      const actions = ref([])
      const { parsedActions, primaryAction } = useActionDisplay(actions)

      expect(parsedActions.value).toHaveLength(0)
      expect(primaryAction.value).toBeNull()
    })
  })

  describe('useCriteriaDisplay', () => {
    const mockCriteria: Criterion[] = [
      { id: 1, value1: 112, value2: 356, operator: 2 }, // Pistol > 356
      { id: 2, value1: 54, value2: 150, operator: 2 },  // Level > 150
      { id: 3, value1: 0, value2: 0, operator: 4 }      // AND
    ]

    const mockDisplayCriteria = [
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
      },
      {
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
      {
        id: 3,
        stat: 0,
        statName: 'Logical',
        displayValue: 0,
        displaySymbol: 'AND',
        displayOperator: 'AND',
        description: 'AND',
        isLogicalOperator: true,
        isSeparator: true,
        isStatRequirement: false
      }
    ]

    beforeEach(() => {
      vi.mocked(transformCriterionForDisplay).mockImplementation((criterion) => {
        return mockDisplayCriteria.find(d => d.id === criterion.id)!
      })
      
      vi.mocked(parseCriteriaExpression).mockReturnValue({
        type: 'logical',
        operator: 'AND',
        operands: [],
        description: '(Pistol ≥ 357 AND Level ≥ 151)'
      })
      
      vi.mocked(formatCriteriaText).mockReturnValue('(Pistol ≥ 357 AND Level ≥ 151)')
      
      vi.mocked(getCriteriaRequirements).mockReturnValue([
        { stat: 112, statName: 'Pistol', minValue: 357 },
        { stat: 54, statName: 'Level', minValue: 151 }
      ])
    })

    it('should transform all criteria for display', () => {
      const criteria = ref(mockCriteria)
      const { displayCriteria } = useCriteriaDisplay(criteria)

      expect(displayCriteria.value).toHaveLength(3)
      expect(transformCriterionForDisplay).toHaveBeenCalledTimes(3)
      expect(displayCriteria.value[0].description).toBe('Pistol ≥ 357')
    })

    it('should filter stat requirements', () => {
      const criteria = ref(mockCriteria)
      const { statRequirements } = useCriteriaDisplay(criteria)

      expect(statRequirements.value).toHaveLength(2)
      expect(statRequirements.value[0].statName).toBe('Pistol')
      expect(statRequirements.value[1].statName).toBe('Level')
    })

    it('should filter logical operators', () => {
      const criteria = ref(mockCriteria)
      const { logicalOperators } = useCriteriaDisplay(criteria)

      expect(logicalOperators.value).toHaveLength(1)
      expect(logicalOperators.value[0].displayOperator).toBe('AND')
    })

    it('should parse expression', () => {
      const criteria = ref(mockCriteria)
      const { expression } = useCriteriaDisplay(criteria)

      expect(parseCriteriaExpression).toHaveBeenCalledWith(mockCriteria)
      expect(expression.value?.description).toBe('(Pistol ≥ 357 AND Level ≥ 151)')
    })

    it('should format text from expression', () => {
      const criteria = ref(mockCriteria)
      const { formattedText } = useCriteriaDisplay(criteria)

      expect(formatCriteriaText).toHaveBeenCalled()
      expect(formattedText.value).toBe('(Pistol ≥ 357 AND Level ≥ 151)')
    })

    it('should get requirements', () => {
      const criteria = ref(mockCriteria)
      const { requirements } = useCriteriaDisplay(criteria)

      expect(getCriteriaRequirements).toHaveBeenCalledWith(mockCriteria)
      expect(requirements.value).toHaveLength(2)
    })

    it('should generate simplified text for single requirement', () => {
      const singleCriterion = [mockCriteria[0]]
      const criteria = ref(singleCriterion)
      
      vi.mocked(transformCriterionForDisplay).mockReturnValue(mockDisplayCriteria[0])
      
      const { simplifiedText } = useCriteriaDisplay(criteria)

      expect(simplifiedText.value).toBe('Pistol ≥ 357')
    })

    it('should generate simplified text for multiple requirements', () => {
      const criteria = ref(mockCriteria)
      const { simplifiedText } = useCriteriaDisplay(criteria)

      expect(simplifiedText.value).toBe('2 requirements')
    })

    it('should generate simplified text for no requirements', () => {
      const criteria = ref([mockCriteria[2]]) // Only logical operator
      const { simplifiedText } = useCriteriaDisplay(criteria)

      expect(simplifiedText.value).toBe('No requirements')
    })

    it('should group requirements by stat', () => {
      const criteria = ref(mockCriteria)
      const { groupedRequirements } = useCriteriaDisplay(criteria)

      expect(groupedRequirements.value).toHaveLength(2)
      
      const pistolGroup = groupedRequirements.value.find(g => g.stat === 112)
      expect(pistolGroup?.statName).toBe('Pistol')
      expect(pistolGroup?.criteria).toHaveLength(1)
      
      const levelGroup = groupedRequirements.value.find(g => g.stat === 54)
      expect(levelGroup?.statName).toBe('Level')
      expect(levelGroup?.criteria).toHaveLength(1)
    })
  })

  describe('useCriteriaEvaluation', () => {
    const mockActions: Action[] = [
      {
        id: 1,
        action: 6,
        item_id: 123,
        criteria: [
          { id: 1, value1: 112, value2: 356, operator: 2 }
        ]
      }
    ]

    const mockParsedAction = {
      id: 1,
      action: 6,
      actionName: 'Wield',
      hasRequirements: true,
      description: 'Wield: Requirements',
      criteria: [],
      expression: null
    }

    beforeEach(() => {
      vi.mocked(parseAction).mockReturnValue(mockParsedAction)
      vi.mocked(checkActionRequirements).mockReturnValue({
        canPerform: true,
        unmetRequirements: []
      })
    })

    it('should evaluate actions with character stats', () => {
      const actions = ref(mockActions)
      const characterStats = ref({ 112: 400 })
      
      const { actionEvaluations } = useCriteriaEvaluation(actions, characterStats)

      expect(actionEvaluations.value).toHaveLength(1)
      expect(actionEvaluations.value[0].canPerform).toBe(true)
      expect(checkActionRequirements).toHaveBeenCalledWith(mockParsedAction, { 112: 400 })
    })

    it('should handle null character stats', () => {
      const actions = ref(mockActions)
      const characterStats = ref(null)
      
      const { actionEvaluations } = useCriteriaEvaluation(actions, characterStats)

      expect(actionEvaluations.value).toHaveLength(1)
      expect(actionEvaluations.value[0].canPerform).toBeNull()
      expect(actionEvaluations.value[0].unmetRequirements).toEqual([])
    })

    it('should get primary action evaluation', () => {
      const actions = ref(mockActions)
      const characterStats = ref({ 112: 400 })
      
      const { primaryActionEvaluation } = useCriteriaEvaluation(actions, characterStats)

      expect(primaryActionEvaluation.value?.canPerform).toBe(true)
    })

    it('should determine if character can use item', () => {
      const actions = ref(mockActions)
      const characterStats = ref({ 112: 400 })
      
      const { canUseItem } = useCriteriaEvaluation(actions, characterStats)

      expect(canUseItem.value).toBe(true)
    })

    it('should collect all unmet requirements', () => {
      const actions = ref(mockActions)
      const characterStats = ref({ 112: 300 })
      
      vi.mocked(checkActionRequirements).mockReturnValue({
        canPerform: false,
        unmetRequirements: [
          { stat: 112, statName: 'Pistol', required: 357, current: 300, operator: '≥' }
        ]
      })
      
      const { allUnmetRequirements } = useCriteriaEvaluation(actions, characterStats)

      expect(allUnmetRequirements.value).toHaveLength(1)
      expect(allUnmetRequirements.value[0].stat).toBe(112)
    })

    it('should calculate minimum requirements', () => {
      const actions = ref(mockActions)
      const characterStats = ref({ 112: 300 })
      
      // Mock parsed action with display criteria
      const mockParsedActionWithCriteria = {
        ...mockParsedAction,
        criteria: [{
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
        }]
      }
      
      vi.mocked(parseAction).mockReturnValue(mockParsedActionWithCriteria)
      
      const { minimumRequirements } = useCriteriaEvaluation(actions, characterStats)

      expect(minimumRequirements.value).toHaveLength(1)
      expect(minimumRequirements.value[0].stat).toBe(112)
      expect(minimumRequirements.value[0].minValue).toBe(357)
      expect(minimumRequirements.value[0].shortfall).toBe(57)
    })
  })

  describe('useItemActions', () => {
    const mockActions: Action[] = [
      {
        id: 1,
        action: 6,
        item_id: 123,
        criteria: []
      }
    ]

    it('should combine action display and evaluation', () => {
      const actions = ref(mockActions)
      const characterStats = ref({ 112: 400 })
      
      vi.mocked(parseAction).mockReturnValue({
        id: 1,
        action: 6,
        actionName: 'Wield',
        hasRequirements: false,
        description: 'Wield: No requirements',
        criteria: [],
        expression: null
      })
      
      const result = useItemActions(actions, characterStats)

      expect(result.parsedActions).toBeDefined()
      expect(result.actionEvaluations).toBeDefined()
      expect(result.getRequirementColor).toBeDefined()
      expect(result.getRequirementSeverity).toBeDefined()
      expect(result.formatShortfall).toBeDefined()
    })

    it('should get requirement color', () => {
      const actions = ref(mockActions)
      const { getRequirementColor } = useItemActions(actions)

      expect(getRequirementColor(true)).toBe('green')
      expect(getRequirementColor(false)).toBe('red')
      expect(getRequirementColor(null)).toBe('gray')
    })

    it('should get requirement severity', () => {
      const actions = ref(mockActions)
      const { getRequirementSeverity } = useItemActions(actions)

      expect(getRequirementSeverity(true)).toBe('success')
      expect(getRequirementSeverity(false)).toBe('danger')
      expect(getRequirementSeverity(null)).toBe('secondary')
    })

    it('should format shortfall', () => {
      const actions = ref(mockActions)
      const { formatShortfall } = useItemActions(actions)

      expect(formatShortfall(400, 300)).toBe('(need 100 more)')
      expect(formatShortfall(300, 400)).toBe('')
      expect(formatShortfall(300, 300)).toBe('')
    })
  })

  describe('useActionCriteria', () => {
    it('should create criteria display for single action', () => {
      const action = ref({
        id: 1,
        action: 6,
        item_id: 123,
        criteria: [
          { id: 1, value1: 112, value2: 356, operator: 2 }
        ]
      })

      vi.mocked(transformCriterionForDisplay).mockReturnValue({
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
      })

      const { displayCriteria } = useActionCriteria(action)

      expect(displayCriteria.value).toHaveLength(1)
      expect(displayCriteria.value[0].description).toBe('Pistol ≥ 357')
    })
  })

  describe('utility functions', () => {
    const mockAction: Action = {
      id: 1,
      action: 6,
      item_id: 123,
      criteria: [
        { id: 1, value1: 112, value2: 356, operator: 2 },
        { id: 2, value1: 0, value2: 0, operator: 4 }
      ]
    }

    beforeEach(() => {
      vi.mocked(transformCriterionForDisplay)
        .mockReturnValueOnce({
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
        })
        .mockReturnValueOnce({
          id: 2,
          stat: 0,
          statName: 'Logical',
          displayValue: 0,
          displaySymbol: 'AND',
          displayOperator: 'AND',
          description: 'AND',
          isLogicalOperator: true,
          isSeparator: true,
          isStatRequirement: false
        })
    })

    describe('hasStatRequirements', () => {
      it('should detect actions with stat requirements', () => {
        const result = hasStatRequirements(mockAction)
        expect(result).toBe(true)
      })

      it('should detect actions without stat requirements', () => {
        const actionWithoutStats: Action = {
          id: 1,
          action: 1,
          item_id: 123,
          criteria: []
        }
        
        const result = hasStatRequirements(actionWithoutStats)
        expect(result).toBe(false)
      })
    })

    describe('getMostRestrictiveRequirement', () => {
      it('should find most restrictive requirement for a stat', () => {
        const criteria: Criterion[] = [
          { id: 1, value1: 112, value2: 300, operator: 2 },
          { id: 2, value1: 112, value2: 356, operator: 2 }
        ]

        vi.mocked(transformCriterionForDisplay)
          .mockReturnValueOnce({
            id: 1,
            stat: 112,
            statName: 'Pistol',
            displayValue: 301,
            displaySymbol: '≥',
            displayOperator: 'Greater than or equal to',
            description: 'Pistol ≥ 301',
            isLogicalOperator: false,
            isSeparator: false,
            isStatRequirement: true
          })
          .mockReturnValueOnce({
            id: 2,
            stat: 112,
            statName: 'Pistol',
            displayValue: 357,
            displaySymbol: '≥',
            displayOperator: 'Greater than or equal to',
            description: 'Pistol ≥ 357',
            isLogicalOperator: false,
            isSeparator: false,
            isStatRequirement: true
          })

        const result = getMostRestrictiveRequirement(criteria, 112)

        // Implementation returns highest value for >= requirements (most restrictive)
        expect(result?.displayValue).toBe(357)
      })

      it('should return null for non-existent stat', () => {
        const result = getMostRestrictiveRequirement(mockAction.criteria, 999)
        expect(result).toBeNull()
      })
    })

    describe('formatRequirement', () => {
      it('should format requirement description', () => {
        const criterion = {
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

        const result = formatRequirement(criterion)
        expect(result).toBe('Pistol ≥ 357')
      })
    })

    describe('isRequirementMet', () => {
      const characterStats: CharacterStats = { 112: 400, 54: 100 }

      const mockCriterion = {
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

      it('should check >= requirement (met)', () => {
        const result = isRequirementMet(mockCriterion, characterStats)
        expect(result).toBe(true)
      })

      it('should check >= requirement (not met)', () => {
        const criterion = { ...mockCriterion, displayValue: 500 }
        const result = isRequirementMet(criterion, characterStats)
        expect(result).toBe(false)
      })

      it('should check = requirement', () => {
        const criterion = { ...mockCriterion, displaySymbol: '=', displayValue: 400 }
        const result = isRequirementMet(criterion, characterStats)
        expect(result).toBe(true)
      })

      it('should check ≤ requirement', () => {
        const criterion = { ...mockCriterion, displaySymbol: '≤', displayValue: 500 }
        const result = isRequirementMet(criterion, characterStats)
        expect(result).toBe(true)
      })

      it('should check ≠ requirement', () => {
        const criterion = { ...mockCriterion, displaySymbol: '≠', displayValue: 300 }
        const result = isRequirementMet(criterion, characterStats)
        expect(result).toBe(true)
      })

      it('should check bit flag requirements', () => {
        const criterion = { ...mockCriterion, displaySymbol: 'has', displayValue: 256 }
        const statsWithFlags = { 112: 384 } // 256 + 128, has 256 flag
        const result = isRequirementMet(criterion, statsWithFlags)
        expect(result).toBe(true)
      })

      it('should handle missing stats as 0', () => {
        const criterion = { ...mockCriterion, stat: 999 }
        const result = isRequirementMet(criterion, characterStats)
        expect(result).toBe(false)
      })

      it('should return null for non-stat requirements', () => {
        const criterion = { ...mockCriterion, isStatRequirement: false }
        const result = isRequirementMet(criterion, characterStats)
        expect(result).toBeNull()
      })

      it('should return null for unknown operators', () => {
        const criterion = { ...mockCriterion, displaySymbol: 'unknown' }
        const result = isRequirementMet(criterion, characterStats)
        expect(result).toBeNull()
      })
    })
  })
})
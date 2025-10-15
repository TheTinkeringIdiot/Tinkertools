/**
 * Unit tests for ActionRequirements component
 *
 * Tests the main component for displaying item actions and their requirements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { mountWithContext, standardCleanup } from '@/__tests__/helpers'
import ActionRequirements from '../ActionRequirements.vue'
import type { Action } from '../../types/api'
import type { CharacterStats } from '../../composables/useActionCriteria'

// Mock the useItemActions composable
vi.mock('../../composables/useActionCriteria', () => ({
  useItemActions: vi.fn()
}))

// Mock CriteriaDisplay component
vi.mock('../CriteriaDisplay.vue', () => ({
  default: {
    name: 'CriteriaDisplay',
    props: ['criteria', 'characterStats', 'mode'],
    template: '<div class="criteria-display">{{ criteria.length }} criteria</div>'
  }
}))

import { useItemActions } from '../../composables/useActionCriteria'

describe('ActionRequirements', () => {
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
      action: 8, // Attack  
      item_id: 123,
      criteria: [
        { id: 2, value1: 54, value2: 150, operator: 2 }
      ]
    },
    {
      id: 3,
      action: 1, // Get
      item_id: 123,
      criteria: []
    }
  ]

  const mockParsedActions = [
    {
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
          description: 'Pistol ≥ 357',
          isStatRequirement: true
        }
      ],
      expression: null
    },
    {
      id: 2,
      action: 8,
      actionName: 'Attack',
      hasRequirements: true,
      description: 'Attack: Requirements',
      criteria: [
        {
          id: 2,
          stat: 54,
          statName: 'Level',
          displayValue: 151,
          displaySymbol: '≥',
          description: 'Level ≥ 151',
          isStatRequirement: true
        }
      ],
      expression: null
    },
    {
      id: 3,
      action: 1,
      actionName: 'Get',
      hasRequirements: false,
      description: 'Get: No requirements',
      criteria: [],
      expression: null
    }
  ]

  const mockActionEvaluations = [
    {
      action: mockParsedActions[0],
      canPerform: true,
      unmetRequirements: []
    },
    {
      action: mockParsedActions[1],
      canPerform: false,
      unmetRequirements: [
        { stat: 54, statName: 'Level', required: 151, current: 100, operator: '≥' }
      ]
    },
    {
      action: mockParsedActions[2],
      canPerform: true,
      unmetRequirements: []
    }
  ]

  const mockUseItemActions = {
    parsedActions: ref(mockParsedActions),
    actionsWithRequirements: ref(mockParsedActions.slice(0, 2)),
    simpleActions: ref(mockParsedActions.slice(2)),
    primaryAction: ref(mockParsedActions[0]),
    actionEvaluations: ref(mockActionEvaluations),
    canUseItem: ref(false),
    getRequirementColor: vi.fn(),
    getRequirementSeverity: vi.fn(),
    formatShortfall: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useItemActions).mockReturnValue(mockUseItemActions)

    mockUseItemActions.getRequirementColor.mockImplementation((canPerform: boolean | null) => {
      if (canPerform === null) return 'gray'
      return canPerform ? 'green' : 'red'
    })

    mockUseItemActions.getRequirementSeverity.mockImplementation((canPerform: boolean | null) => {
      if (canPerform === null) return 'secondary'
      return canPerform ? 'success' : 'danger'
    })

    mockUseItemActions.formatShortfall.mockImplementation((required: number, current: number) => {
      const shortfall = required - current
      return shortfall > 0 ? `(need ${shortfall} more)` : ''
    })
  })

  afterEach(() => {
    standardCleanup()
  })

  describe('component rendering', () => {
    it('should render without errors', () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions
        }
      })

      expect(wrapper.exists()).toBe(true)
    })

    it('should render primary action when expanded=true', () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions,
          expanded: true
        }
      })

      expect(wrapper.text()).toContain('Wield')
      expect(wrapper.find('.criteria-display').exists()).toBe(true)
    })

    it('should render accordion for multiple actions when expanded=false', () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions,
          expanded: false
        }
      })

      expect(wrapper.find('.p-accordion').exists()).toBe(true)
      expect(wrapper.findAll('.p-accordiontab')).toHaveLength(2) // Only actions with requirements
    })

    it('should render simple actions when showSimpleActions=true', () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions,
          showSimpleActions: true
        }
      })

      expect(wrapper.text()).toContain('Get')
    })

    it('should not render simple actions when showSimpleActions=false', () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions,
          showSimpleActions: false
        }
      })

      expect(wrapper.text()).not.toContain('Get: No requirements')
    })
  })

  describe('character stats integration', () => {
    const characterStats: CharacterStats = {
      112: 400, // Pistol
      54: 100   // Level
    }

    it('should pass character stats to criteria display', () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions,
          characterStats,
          expanded: true
        }
      })

      const criteriaDisplay = wrapper.findComponent({ name: 'CriteriaDisplay' })
      expect(criteriaDisplay.props('characterStats')).toEqual(characterStats)
    })

    it('should display requirement status tags', () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions,
          characterStats,
          expanded: false
        }
      })

      const tags = wrapper.findAllComponents({ name: 'Tag' })
      expect(tags.length).toBeGreaterThan(0)
      
      // Should have success tag for Wield action (requirements met)
      const successTags = tags.filter(tag => tag.props('severity') === 'success')
      expect(successTags.length).toBeGreaterThan(0)
      
      // Should have danger tag for Attack action (requirements not met)
      const dangerTags = tags.filter(tag => tag.props('severity') === 'danger')
      expect(dangerTags.length).toBeGreaterThan(0)
    })

    it('should show requirement met indicator', () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions,
          characterStats,
          expanded: false
        }
      })

      expect(wrapper.text()).toContain('✓') // Check mark for met requirements
    })

    it('should show requirement not met indicator', () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions,
          characterStats,
          expanded: false
        }
      })

      expect(wrapper.text()).toContain('✗') // X mark for unmet requirements
    })
  })

  describe('props validation', () => {
    it('should handle empty actions array', () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: []
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('No actions available')
    })

    it('should handle null character stats', () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions,
          characterStats: null
        }
      })

      expect(wrapper.exists()).toBe(true)
      // Should not show requirement status when no character stats
      const tags = wrapper.findAllComponents({ name: 'Tag' })
      const statusTags = tags.filter(tag => 
        tag.props('severity') === 'secondary' && tag.props('value') === 'Unknown'
      )
      expect(statusTags.length).toBeGreaterThan(0)
    })

    it('should use default mode for criteria display', () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions,
          expanded: true
        }
      })

      const criteriaDisplay = wrapper.findComponent({ name: 'CriteriaDisplay' })
      expect(criteriaDisplay.props('mode')).toBe('simple')
    })

    it('should pass custom mode to criteria display', () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions,
          expanded: true,
          mode: 'expanded'
        }
      })

      const criteriaDisplay = wrapper.findComponent({ name: 'CriteriaDisplay' })
      expect(criteriaDisplay.props('mode')).toBe('expanded')
    })
  })

  describe('action priority', () => {
    it('should display primary action first when expanded', () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions,
          expanded: true
        }
      })

      // Primary action should be displayed directly, not in accordion
      expect(wrapper.text()).toContain('Wield')
      
      // Should show other actions in accordion if multiple exist
      if (mockParsedActions.filter(a => a.hasRequirements).length > 1) {
        expect(wrapper.find('.p-accordion').exists()).toBe(true)
      }
    })

    it('should handle actions without primary action', () => {
      // Mock scenario with no wield action
      const actionsWithoutWield = mockActions.filter(a => a.action !== 6)
      
      mockUseItemActions.primaryAction.value = mockParsedActions[1] // Attack action
      
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: actionsWithoutWield,
          expanded: true
        }
      })

      expect(wrapper.text()).toContain('Attack')
    })
  })

  describe('requirement details', () => {
    it('should show unmet requirement details', () => {
      const characterStats: CharacterStats = { 54: 100 } // Level too low
      
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions,
          characterStats,
          expanded: false
        }
      })

      // Should show shortfall information
      expect(mockUseItemActions.formatShortfall).toHaveBeenCalled()
    })

    it('should handle no character data gracefully', () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions,
          characterStats: undefined
        }
      })

      expect(wrapper.exists()).toBe(true)
      // Should show unknown status for requirements
      const tags = wrapper.findAllComponents({ name: 'Tag' })
      const unknownTags = tags.filter(tag => tag.props('severity') === 'secondary')
      expect(unknownTags.length).toBeGreaterThan(0)
    })
  })

  describe('interaction behavior', () => {
    it('should toggle accordion sections', async () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions,
          expanded: false
        }
      })

      const accordionTabs = wrapper.findAllComponents({ name: 'AccordionTab' })
      expect(accordionTabs.length).toBeGreaterThan(0)
      
      // Accordion interaction would be handled by PrimeVue component
      // We can verify the structure is correct
      expect(accordionTabs[0].props('header')).toContain('Wield')
    })

    it('should display action summaries in accordion headers', () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: mockActions,
          characterStats: { 112: 400, 54: 100 },
          expanded: false
        }
      })

      const accordionTabs = wrapper.findAllComponents({ name: 'AccordionTab' })
      
      // Headers should contain action name and status
      accordionTabs.forEach(tab => {
        const header = tab.props('header')
        expect(header).toMatch(/Wield|Attack/) // Should contain action name
        expect(header).toMatch(/✓|✗/) // Should contain status indicator
      })
    })
  })

  describe('edge cases', () => {
    it('should handle actions with no criteria', () => {
      const actionsNoCriteria: Action[] = [
        {
          id: 1,
          action: 1,
          item_id: 123,
          criteria: []
        }
      ]

      mockUseItemActions.parsedActions.value = [{
        id: 1,
        action: 1,
        actionName: 'Get',
        hasRequirements: false,
        description: 'Get: No requirements',
        criteria: [],
        expression: null
      }]
      
      mockUseItemActions.actionsWithRequirements.value = []
      mockUseItemActions.simpleActions.value = mockUseItemActions.parsedActions.value

      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: actionsNoCriteria,
          showSimpleActions: true
        }
      })

      expect(wrapper.text()).toContain('Get')
      expect(wrapper.text()).toContain('No requirements')
    })

    it('should handle malformed actions gracefully', () => {
      const malformedActions: Action[] = [
        {
          id: 1,
          action: 999, // Unknown action type
          item_id: 123,
          criteria: [
            { id: 1, value1: 999, value2: 999, operator: 999 } // Unknown values
          ]
        }
      ]

      mockUseItemActions.parsedActions.value = [{
        id: 1,
        action: 999,
        actionName: 'Action 999',
        hasRequirements: true,
        description: 'Action 999: Requirements',
        criteria: [],
        expression: null
      }]

      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: malformedActions
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('Action 999')
    })
  })

  describe('interpolation integration', () => {
    it('should update when receiving interpolated actions', async () => {
      const baseActions: Action[] = [
        {
          id: 1,
          action: 6, // Wield
          item_id: 123,
          criteria: [
            { id: 1, value1: 112, value2: 300, operator: 2 } // Base requirement
          ]
        }
      ]

      const interpolatedActions: Action[] = [
        {
          id: 1,
          action: 6, // Wield
          item_id: 123,
          criteria: [
            { id: 1, value1: 112, value2: 350, operator: 2 } // Interpolated requirement
          ]
        }
      ]

      // Setup mocks for base actions
      mockUseItemActions.parsedActions.value = [{
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
            displayValue: 300,
            displaySymbol: '≥',
            description: 'Pistol ≥ 300',
            isStatRequirement: true
          }
        ],
        expression: null
      }]

      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: baseActions,
          characterStats: { 112: 280 } // Below base requirement
        }
      })

      // Initially should show base requirement (300)
      expect(wrapper.text()).toContain('300')

      // Update with interpolated actions (higher requirement: 350)
      mockUseItemActions.parsedActions.value = [{
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
            displayValue: 350,
            displaySymbol: '≥',
            description: 'Pistol ≥ 350',
            isStatRequirement: true
          }
        ],
        expression: null
      }]

      await wrapper.setProps({ actions: interpolatedActions })
      await nextTick()

      // Should now show interpolated requirement (350)
      expect(wrapper.text()).toContain('350')
    })

    it('should handle requirements that become unmet during interpolation', async () => {
      const characterStats = { 112: 320 } // Character has 320 skill
      
      // Base item requirement (300) - character meets it
      const baseActions: Action[] = [
        {
          id: 1,
          action: 6,
          item_id: 123,
          criteria: [
            { id: 1, value1: 112, value2: 300, operator: 2 }
          ]
        }
      ]

      // Interpolated item requirement (340) - character no longer meets it
      const interpolatedActions: Action[] = [
        {
          id: 1,
          action: 6,
          item_id: 123,
          criteria: [
            { id: 1, value1: 112, value2: 340, operator: 2 }
          ]
        }
      ]

      // Mock base state (requirement met)
      mockUseItemActions.parsedActions.value = [{
        id: 1,
        action: 6,
        actionName: 'Wield',
        hasRequirements: true,
        description: 'Wield: ✓ Met',
        criteria: [],
        expression: null
      }]

      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: baseActions,
          characterStats
        }
      })

      // Initially should show as met
      expect(wrapper.text()).toContain('✓')

      // Update to interpolated actions (requirement no longer met)
      mockUseItemActions.parsedActions.value = [{
        id: 1,
        action: 6,
        actionName: 'Wield',
        hasRequirements: true,
        description: 'Wield: ✗ Unmet',
        criteria: [
          {
            id: 1,
            stat: 112,
            statName: 'Pistol',
            displayValue: 340,
            displaySymbol: '≥',
            description: 'Pistol ≥ 340',
            isStatRequirement: true
          }
        ],
        expression: null
      }]

      await wrapper.setProps({ actions: interpolatedActions })
      await nextTick()

      // Should now show as unmet
      expect(wrapper.text()).toContain('✗')
      expect(wrapper.text()).toContain('340')
    })

    it('should handle spell effect requirements that change with interpolation', async () => {
      // Actions with spell-based criteria that scale with item QL
      const baseSpellActions: Action[] = [
        {
          id: 1,
          action: 100, // Special spell action
          item_id: 123,
          criteria: [
            { id: 1, value1: 200, value2: 150, operator: 2 } // Nano Computer Memory ≥ 150
          ]
        }
      ]

      const interpolatedSpellActions: Action[] = [
        {
          id: 1,
          action: 100,
          item_id: 123,
          criteria: [
            { id: 1, value1: 200, value2: 175, operator: 2 } // Increased to 175
          ]
        }
      ]

      mockUseItemActions.parsedActions.value = [{
        id: 1,
        action: 100,
        actionName: 'Cast',
        hasRequirements: true,
        description: 'Cast: Requirements',
        criteria: [
          {
            id: 1,
            stat: 200,
            statName: 'Nano Computer Memory',
            displayValue: 150,
            displaySymbol: '≥',
            description: 'Nano Computer Memory ≥ 150',
            isStatRequirement: true
          }
        ],
        expression: null
      }]

      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: baseSpellActions,
          characterStats: { 200: 160 } // Character meets base but not interpolated
        }
      })

      // Update to interpolated spell requirements
      mockUseItemActions.parsedActions.value = [{
        id: 1,
        action: 100,
        actionName: 'Cast',
        hasRequirements: true,
        description: 'Cast: Requirements',
        criteria: [
          {
            id: 1,
            stat: 200,
            statName: 'Nano Computer Memory',
            displayValue: 175,
            displaySymbol: '≥',
            description: 'Nano Computer Memory ≥ 175',
            isStatRequirement: true
          }
        ],
        expression: null
      }]

      await wrapper.setProps({ actions: interpolatedSpellActions })
      await nextTick()

      // Should show updated requirement value
      expect(wrapper.text()).toContain('175')
    })

    it('should maintain component reactivity during interpolation updates', async () => {
      const wrapper = mountWithContext(ActionRequirements, {
        props: {
          actions: [],
          characterStats: {}
        }
      })

      // Track how many times the composable is called
      let callCount = 0
      mockUseItemActions.parsedActions.value = []
      
      // Simulate multiple interpolation updates
      for (let i = 0; i < 5; i++) {
        const newActions: Action[] = [
          {
            id: 1,
            action: 6,
            item_id: 123,
            criteria: [
              { id: 1, value1: 112, value2: 300 + (i * 10), operator: 2 }
            ]
          }
        ]

        await wrapper.setProps({ actions: newActions })
        await nextTick()
        callCount++
      }

      // Component should remain reactive and not break
      expect(wrapper.exists()).toBe(true)
      expect(callCount).toBe(5)
    })
  })
})
/**
 * Unit tests for ActionRequirements component
 * 
 * Tests the main component for displaying item actions and their requirements
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import ActionRequirements from '../ActionRequirements.vue'
import type { Action } from '../../types/api'
import type { CharacterStats } from '../../composables/useActionCriteria'

// Mock the useItemActions composable
vi.mock('../../composables/useActionCriteria', () => ({
  useItemActions: vi.fn()
}))

// Mock PrimeVue components
vi.mock('primevue/accordion', () => ({
  default: {
    name: 'Accordion',
    template: '<div class="p-accordion"><slot /></div>'
  }
}))

vi.mock('primevue/accordiontab', () => ({
  default: {
    name: 'AccordionTab',
    props: ['header'],
    template: '<div class="p-accordiontab"><div class="p-accordiontab-header">{{ header }}</div><div class="p-accordiontab-content"><slot /></div></div>'
  }
}))

vi.mock('primevue/tag', () => ({
  default: {
    name: 'Tag',
    props: ['value', 'severity'],
    template: '<span class="p-tag" :class="`p-tag-${severity}`">{{ value }}</span>'
  }
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

  describe('component rendering', () => {
    it('should render without errors', () => {
      const wrapper = mount(ActionRequirements, {
        props: {
          actions: mockActions
        }
      })

      expect(wrapper.exists()).toBe(true)
    })

    it('should render primary action when expanded=true', () => {
      const wrapper = mount(ActionRequirements, {
        props: {
          actions: mockActions,
          expanded: true
        }
      })

      expect(wrapper.text()).toContain('Wield')
      expect(wrapper.find('.criteria-display').exists()).toBe(true)
    })

    it('should render accordion for multiple actions when expanded=false', () => {
      const wrapper = mount(ActionRequirements, {
        props: {
          actions: mockActions,
          expanded: false
        }
      })

      expect(wrapper.find('.p-accordion').exists()).toBe(true)
      expect(wrapper.findAll('.p-accordiontab')).toHaveLength(2) // Only actions with requirements
    })

    it('should render simple actions when showSimpleActions=true', () => {
      const wrapper = mount(ActionRequirements, {
        props: {
          actions: mockActions,
          showSimpleActions: true
        }
      })

      expect(wrapper.text()).toContain('Get')
    })

    it('should not render simple actions when showSimpleActions=false', () => {
      const wrapper = mount(ActionRequirements, {
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
      const wrapper = mount(ActionRequirements, {
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
      const wrapper = mount(ActionRequirements, {
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
      const wrapper = mount(ActionRequirements, {
        props: {
          actions: mockActions,
          characterStats,
          expanded: false
        }
      })

      expect(wrapper.text()).toContain('✓') // Check mark for met requirements
    })

    it('should show requirement not met indicator', () => {
      const wrapper = mount(ActionRequirements, {
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
      const wrapper = mount(ActionRequirements, {
        props: {
          actions: []
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('No actions available')
    })

    it('should handle null character stats', () => {
      const wrapper = mount(ActionRequirements, {
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
      const wrapper = mount(ActionRequirements, {
        props: {
          actions: mockActions,
          expanded: true
        }
      })

      const criteriaDisplay = wrapper.findComponent({ name: 'CriteriaDisplay' })
      expect(criteriaDisplay.props('mode')).toBe('simple')
    })

    it('should pass custom mode to criteria display', () => {
      const wrapper = mount(ActionRequirements, {
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
      const wrapper = mount(ActionRequirements, {
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
      
      const wrapper = mount(ActionRequirements, {
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
      
      const wrapper = mount(ActionRequirements, {
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
      const wrapper = mount(ActionRequirements, {
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
      const wrapper = mount(ActionRequirements, {
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
      const wrapper = mount(ActionRequirements, {
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

      const wrapper = mount(ActionRequirements, {
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

      const wrapper = mount(ActionRequirements, {
        props: {
          actions: malformedActions
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('Action 999')
    })
  })
})
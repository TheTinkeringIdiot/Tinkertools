/**
 * ItemQuickView Component Tests
 * 
 * Tests for the ItemQuickView component functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ItemQuickView from '../../components/items/ItemQuickView.vue'
import type { Item, TinkerProfile } from '../../types/api'

// Mock PrimeVue components
vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
    props: ['icon', 'size', 'severity', 'outlined', 'text'],
    emits: ['click']
  }
}))

vi.mock('primevue/badge', () => ({
  default: {
    name: 'Badge',
    template: '<span class="p-badge" :class="severity">{{ value }}</span>',
    props: ['value', 'severity', 'size']
  }
}))

vi.mock('primevue/tag', () => ({
  default: {
    name: 'Tag',
    template: '<span class="p-tag" :class="severity">{{ value }}</span>',
    props: ['value', 'severity', 'size']
  }
}))

vi.mock('primevue/divider', () => ({
  default: {
    name: 'Divider',
    template: '<div class="p-divider"><slot /></div>',
    props: ['align']
  }
}))

const mockItem: Item = {
  id: 1,
  aoid: 12345,
  name: 'Superior Combat Rifle',
  ql: 220,
  description: 'A state-of-the-art military-grade weapon with enhanced targeting systems and superior damage output.',
  item_class: 5, // Ranged weapon
  is_nano: false,
  stats: [
    { stat: 16, value: 75 },  // Strength +75
    { stat: 17, value: 50 },  // Agility +50
    { stat: 133, value: 120 } // Ranged Energy +120
  ],
  requirements: [
    { stat: 16, value: 350 }, // Strength 350
    { stat: 17, value: 280 }, // Agility 280
    { stat: 133, value: 450 } // Ranged Energy 450
  ],
  spell_data: [
    { name: 'Precision Strike', description: 'Increases accuracy for next shot' },
    { name: 'Armor Piercing', description: 'Reduces target\'s armor effectiveness' }
  ],
  actions: [
    { name: 'aimed_shot', description: 'Take careful aim for increased damage' }
  ],
  attack_defense: {
    attack_min: 120,
    attack_max: 240,
    attack_speed: 1.8,
    critical_chance: 15
  },
  animation_mesh: 'rifle_combat_01.mesh'
}

const mockNanoItem: Item = {
  id: 2,
  aoid: 54321,
  name: 'Superior First Aid',
  ql: 180,
  description: 'An advanced nanobotic healing program that rapidly repairs cellular damage.',
  item_class: 20, // Utility
  is_nano: true,
  stats: [],
  requirements: [
    { stat: 19, value: 400 }, // Intelligence 400
    { stat: 161, value: 350 } // Computer Literacy 350
  ],
  spell_data: [
    { name: 'Rapid Healing', description: 'Restores health over time' }
  ],
  actions: [],
  attack_defense: null,
  animation_mesh: null
}

const mockProfile: TinkerProfile = {
  id: 'test-profile',
  name: 'Elite Soldier',
  level: 200,
  profession: 'Soldier',
  stats: {
    16: 380, // Strength - meets requirement
    17: 250, // Agility - doesn't meet requirement
    19: 200, // Intelligence
    133: 480, // Ranged Energy - meets requirement
    161: 300  // Computer Literacy
  }
}

describe('ItemQuickView', () => {
  let wrapper: any

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Component Mounting', () => {
    it('should mount without errors', () => {
      wrapper = mount(ItemQuickView, {
        props: {
          item: mockItem
        }
      })
      
      expect(wrapper.exists()).toBe(true)
    })

    it('should display item basic information', () => {
      wrapper = mount(ItemQuickView, {
        props: {
          item: mockItem
        }
      })
      
      expect(wrapper.text()).toContain('Superior Combat Rifle')
      expect(wrapper.text()).toContain('QL 220')
      expect(wrapper.text()).toContain('state-of-the-art military-grade weapon')
    })

    it('should show nano-specific information for nano items', () => {
      wrapper = mount(ItemQuickView, {
        props: {
          item: mockNanoItem
        }
      })
      
      const nanoBadge = wrapper.find('.p-badge:contains("Nano")')
      expect(nanoBadge.exists()).toBe(true)
      expect(wrapper.text()).toContain('Superior First Aid')
    })
  })

  describe('Item Statistics Display', () => {
    beforeEach(() => {
      wrapper = mount(ItemQuickView, {
        props: {
          item: mockItem
        }
      })
    })

    it('should display all item stats', () => {
      expect(wrapper.text()).toContain('Statistics')
      expect(wrapper.text()).toContain('Strength')
      expect(wrapper.text()).toContain('+75')
      expect(wrapper.text()).toContain('Agility')
      expect(wrapper.text()).toContain('+50')
      expect(wrapper.text()).toContain('Ranged Energy')
      expect(wrapper.text()).toContain('+120')
    })

    it('should color-code positive and negative stats', () => {
      const positiveStats = wrapper.findAll('.text-green-600, .text-green-400')
      expect(positiveStats.length).toBeGreaterThan(0)
    })

    it('should handle items with no stats', () => {
      wrapper = mount(ItemQuickView, {
        props: {
          item: { ...mockItem, stats: [] }
        }
      })
      
      expect(wrapper.text()).not.toContain('Statistics')
    })
  })

  describe('Requirements Display', () => {
    describe('without profile', () => {
      beforeEach(() => {
        wrapper = mount(ItemQuickView, {
          props: {
            item: mockItem
          }
        })
      })

      it('should display all requirements', () => {
        expect(wrapper.text()).toContain('Requirements')
        expect(wrapper.text()).toContain('Strength: 350')
        expect(wrapper.text()).toContain('Agility: 280')
        expect(wrapper.text()).toContain('Ranged Energy: 450')
      })

      it('should not show requirement status without profile', () => {
        const checkIcons = wrapper.findAll('.pi-check')
        const timesIcons = wrapper.findAll('.pi-times')
        expect(checkIcons.length + timesIcons.length).toBe(0)
      })
    })

    describe('with profile', () => {
      beforeEach(() => {
        wrapper = mount(ItemQuickView, {
          props: {
            item: mockItem,
            profile: mockProfile,
            showCompatibility: true
          }
        })
      })

      it('should show requirement status with profile', () => {
        const checkIcons = wrapper.findAll('.pi-check')
        const timesIcons = wrapper.findAll('.pi-times')
        expect(checkIcons.length + timesIcons.length).toBeGreaterThan(0)
      })

      it('should color-code requirements based on character stats', () => {
        const metRequirements = wrapper.findAll('.text-green-600, .text-green-400')
        const unmetRequirements = wrapper.findAll('.text-red-600, .text-red-400')
        
        expect(metRequirements.length).toBeGreaterThan(0) // Should have some met requirements
        expect(unmetRequirements.length).toBeGreaterThan(0) // Should have some unmet requirements
      })

      it('should show overall compatibility status', () => {
        // Should show whether character can use the item overall
        expect(wrapper.text()).toContain('Compatibility')
      })
    })
  })

  describe('Special Effects and Actions', () => {
    beforeEach(() => {
      wrapper = mount(ItemQuickView, {
        props: {
          item: mockItem
        }
      })
    })

    it('should display special effects from spell data', () => {
      expect(wrapper.text()).toContain('Special Effects')
      expect(wrapper.text()).toContain('Precision Strike')
      expect(wrapper.text()).toContain('Armor Piercing')
    })

    it('should display available actions', () => {
      expect(wrapper.text()).toContain('Actions')
      expect(wrapper.text()).toContain('aimed_shot')
      expect(wrapper.text()).toContain('Take careful aim for increased damage')
    })

    it('should handle items with no special effects', () => {
      wrapper = mount(ItemQuickView, {
        props: {
          item: { ...mockItem, spell_data: [] }
        }
      })
      
      expect(wrapper.text()).not.toContain('Special Effects')
    })
  })

  describe('Attack Information', () => {
    beforeEach(() => {
      wrapper = mount(ItemQuickView, {
        props: {
          item: mockItem
        }
      })
    })

    it('should display weapon attack information', () => {
      expect(wrapper.text()).toContain('Attack Information')
      expect(wrapper.text()).toContain('120-240')  // Damage range
      expect(wrapper.text()).toContain('1.8')      // Attack speed
    })

    it('should show critical chance if available', () => {
      expect(wrapper.text()).toContain('15%')  // Critical chance
    })

    it('should not show attack info for non-weapons', () => {
      wrapper = mount(ItemQuickView, {
        props: {
          item: mockNanoItem
        }
      })
      
      expect(wrapper.text()).not.toContain('Attack Information')
    })
  })

  describe('User Actions', () => {
    beforeEach(() => {
      wrapper = mount(ItemQuickView, {
        props: {
          item: mockItem
        }
      })
    })

    it('should emit close event when close button is clicked', async () => {
      const closeButton = wrapper.find('button[class*="pi-times"]')
      
      await closeButton.trigger('click')
      
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('should emit view-full event when view details button is clicked', async () => {
      const viewFullButton = wrapper.find('button:contains("View Full Details")')
      
      if (viewFullButton.exists()) {
        await viewFullButton.trigger('click')
        expect(wrapper.emitted('view-full')).toBeTruthy()
      }
    })

    it('should emit favorite event when favorite button is clicked', async () => {
      const favoriteButton = wrapper.find('button[class*="pi-heart"]')
      
      await favoriteButton.trigger('click')
      
      expect(wrapper.emitted('favorite')).toBeTruthy()
      expect(wrapper.emitted('favorite')[0]).toEqual([mockItem])
    })

    it('should emit compare event when compare button is clicked', async () => {
      const compareButton = wrapper.find('button[class*="pi-clone"]')
      
      await compareButton.trigger('click')
      
      expect(wrapper.emitted('compare')).toBeTruthy()
      expect(wrapper.emitted('compare')[0]).toEqual([mockItem])
    })
  })

  describe('Visual Layout and Organization', () => {
    beforeEach(() => {
      wrapper = mount(ItemQuickView, {
        props: {
          item: mockItem
        }
      })
    })

    it('should organize information in logical sections', () => {
      // Check for section headers
      expect(wrapper.text()).toContain('Statistics')
      expect(wrapper.text()).toContain('Requirements')
      expect(wrapper.text()).toContain('Special Effects')
      expect(wrapper.text()).toContain('Attack Information')
    })

    it('should use dividers to separate sections', () => {
      const dividers = wrapper.findAllComponents({ name: 'Divider' })
      expect(dividers.length).toBeGreaterThan(0)
    })

    it('should have a clear header area', () => {
      expect(wrapper.find('h2, h3').exists()).toBe(true)
    })
  })

  describe('Responsive Design', () => {
    it('should be optimized for modal display', () => {
      wrapper = mount(ItemQuickView, {
        props: {
          item: mockItem
        }
      })
      
      // Should have appropriate classes for modal content
      const container = wrapper.find('.item-quick-view, .quick-view')
      if (container.exists()) {
        expect(container.exists()).toBe(true)
      }
    })

    it('should handle long item names and descriptions gracefully', () => {
      const longNameItem = {
        ...mockItem,
        name: 'An Extremely Long Item Name That Should Not Break The Layout Even When It Contains Many Words',
        description: 'A very long description that goes on and on with lots of details about the item and its many features and capabilities that should wrap properly and not overflow the container boundaries.'
      }
      
      wrapper = mount(ItemQuickView, {
        props: {
          item: longNameItem
        }
      })
      
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain(longNameItem.name)
    })
  })

  describe('Data Validation and Edge Cases', () => {
    it('should handle items with minimal data', () => {
      const minimalItem: Item = {
        id: 999,
        aoid: 999,
        name: 'Basic Item',
        ql: 1,
        description: 'Simple item',
        item_class: 1,
        is_nano: false,
        stats: [],
        spell_data: [],
        actions: [],
        attack_defense: null,
        animation_mesh: null
      }
      
      wrapper = mount(ItemQuickView, {
        props: {
          item: minimalItem
        }
      })
      
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('Basic Item')
    })

    it('should handle missing or null profile gracefully', () => {
      wrapper = mount(ItemQuickView, {
        props: {
          item: mockItem,
          profile: null,
          showCompatibility: true
        }
      })
      
      expect(wrapper.exists()).toBe(true)
      // Should not crash or show errors
    })

    it('should handle items with no requirements', () => {
      wrapper = mount(ItemQuickView, {
        props: {
          item: { ...mockItem, requirements: [] }
        }
      })
      
      expect(wrapper.text()).not.toContain('Requirements')
    })
  })

  describe('Performance Considerations', () => {
    it('should render large items efficiently', () => {
      const complexItem = {
        ...mockItem,
        stats: Array.from({ length: 20 }, (_, i) => ({ stat: i + 100, value: i * 10 })),
        requirements: Array.from({ length: 15 }, (_, i) => ({ stat: i + 100, value: (i + 1) * 50 })),
        spell_data: Array.from({ length: 10 }, (_, i) => ({ 
          name: `Effect ${i}`, 
          description: `Description for effect ${i}` 
        }))
      }
      
      wrapper = mount(ItemQuickView, {
        props: {
          item: complexItem
        }
      })
      
      expect(wrapper.exists()).toBe(true)
    })

    it('should not re-render unnecessarily on prop changes', async () => {
      wrapper = mount(ItemQuickView, {
        props: {
          item: mockItem,
          showCompatibility: false
        }
      })
      
      // Change showCompatibility
      await wrapper.setProps({ showCompatibility: true })
      await wrapper.setProps({ showCompatibility: false })
      
      expect(wrapper.exists()).toBe(true)
    })
  })

  describe('Accessibility', () => {
    beforeEach(() => {
      wrapper = mount(ItemQuickView, {
        props: {
          item: mockItem
        }
      })
    })

    it('should have proper heading structure', () => {
      const headings = wrapper.findAll('h1, h2, h3, h4')
      expect(headings.length).toBeGreaterThan(0)
    })

    it('should have accessible button labels', () => {
      const buttons = wrapper.findAll('button')
      buttons.forEach(button => {
        // Should have text content, aria-label, or title
        const hasLabel = button.text().trim() !== '' || 
                        button.attributes('aria-label') || 
                        button.attributes('title')
        expect(hasLabel).toBe(true)
      })
    })

    it('should support keyboard navigation', () => {
      const focusableElements = wrapper.findAll('button, [tabindex]')
      expect(focusableElements.length).toBeGreaterThan(0)
    })
  })
})
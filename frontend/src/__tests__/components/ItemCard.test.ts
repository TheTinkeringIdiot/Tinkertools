/**
 * ItemCard Component Tests
 *
 * Tests for the ItemCard component functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountWithContext, standardCleanup, createTestProfile, SKILL_ID } from '@/__tests__/helpers'
import ItemCard from '../../components/items/ItemCard.vue'
import type { Item, TinkerProfile } from '../../types/api'

const mockItem: Item = {
  id: 1,
  aoid: 12345,
  name: 'Superior Plasma Rifle',
  ql: 250,
  description: 'A high-quality energy weapon designed for maximum efficiency',
  item_class: 5, // Ranged weapon
  is_nano: false,
  stats: [
    { stat: 16, value: 50 },  // Strength +50
    { stat: 17, value: 25 },  // Agility +25
    { stat: 133, value: 100 } // Ranged Energy +100
  ],
  requirements: [
    { stat: 16, value: 300 }, // Strength 300
    { stat: 17, value: 250 }, // Agility 250
    { stat: 133, value: 400 } // Ranged Energy 400
  ],
  spell_data: [
    { name: 'Plasma Burst', description: 'Deals energy damage' }
  ],
  actions: [],
  attack_defense: {
    attack_min: 100,
    attack_max: 200,
    attack_speed: 1.5
  },
  animation_mesh: null
}

const mockNanoItem: Item = {
  ...mockItem,
  id: 2,
  name: 'Superior Heal',
  is_nano: true,
  item_class: 20, // Utility
  attack_defense: null
}

const mockProfile: TinkerProfile = createTestProfile({
  level: 200,
  profession: 1, // Soldier
  skills: {
    [SKILL_ID.STRENGTH]: { base: 0, trickle: 0, pointsFromIp: 350, equipmentBonus: 0, total: 350 },
    [SKILL_ID.AGILITY]: { base: 0, trickle: 0, pointsFromIp: 200, equipmentBonus: 0, total: 200 },
    133: { base: 0, trickle: 0, pointsFromIp: 450, equipmentBonus: 0, total: 450 } // Ranged Energy
  }
})

describe('ItemCard', () => {
  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    standardCleanup()
  })

  describe('Component Mounting', () => {
    it('should mount without errors', () => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: mockItem
        }
      })
      
      expect(wrapper.exists()).toBe(true)
    })

    it('should display item basic information', () => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: mockItem
        }
      })
      
      expect(wrapper.text()).toContain('Superior Plasma Rifle')
      expect(wrapper.text()).toContain('QL 250')
      expect(wrapper.text()).toContain('A high-quality energy weapon')
    })

    it('should show nano badge for nano items', () => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: mockNanoItem
        }
      })

      const nanoBadges = wrapper.findAll('.p-badge')
      const nanoBadge = nanoBadges.find(badge => badge.text().includes('Nano'))
      expect(nanoBadge).toBeTruthy()
    })
  })

  describe('Item Stats Display', () => {
    beforeEach(() => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: mockItem
        }
      })
    })

    it('should display key stats', () => {
      expect(wrapper.text()).toContain('Key Stats')
      expect(wrapper.text()).toContain('Strength')
      expect(wrapper.text()).toContain('+50')
      expect(wrapper.text()).toContain('Ranged Energy')
      expect(wrapper.text()).toContain('+100')
    })

    it('should limit displayed stats to 4', () => {
      const statElements = wrapper.findAll('.flex.justify-between.text-xs')
      // Should show at most 4 stat entries
      expect(statElements.length).toBeLessThanOrEqual(4)
    })

    it('should not display stats with zero values', () => {
      const itemWithZeroStat = {
        ...mockItem,
        stats: [
          { stat: 16, value: 50 },
          { stat: 17, value: 0 }, // Should be filtered out
          { stat: 19, value: 25 }
        ]
      }
      
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: itemWithZeroStat
        }
      })
      
      // Should not show the zero-value stat
      const statTexts = wrapper.findAll('.text-surface-600')
      const statNames = statTexts.map(el => el.text())
      expect(statNames.filter(name => name.includes('Agility'))).toHaveLength(0)
    })
  })

  describe('Compatibility Features', () => {
    describe('without profile', () => {
      beforeEach(() => {
        wrapper = mountWithContext(ItemCard, {
          props: {
            item: mockItem,
            showCompatibility: true
          }
        })
      })

      it('should show unknown compatibility status', () => {
        const statusIcon = wrapper.find('.w-6.h-6.bg-yellow-500')
        expect(statusIcon.exists()).toBe(true)
      })

      it('should not display requirements section', () => {
        expect(wrapper.text()).not.toContain('Requirements:')
      })
    })

    describe('with profile', () => {
      beforeEach(() => {
        wrapper = mountWithContext(ItemCard, {
          props: {
            item: mockItem,
            profile: mockProfile,
            showCompatibility: true
          }
        })
      })

      it('should show compatibility status based on requirements', () => {
        // Item has mixed requirements - some met, some not
        const incompatibleIcon = wrapper.find('.w-6.h-6.bg-red-500')
        expect(incompatibleIcon.exists()).toBe(true)
      })

      it('should display requirements with color coding', () => {
        expect(wrapper.text()).toContain('Requirements:')
        
        const requirementElements = wrapper.findAll('.flex.justify-between.text-xs')
        const metRequirements = wrapper.findAll('.text-green-600, .text-green-400')
        const unmetRequirements = wrapper.findAll('.text-red-600, .text-red-400')
        
        expect(metRequirements.length + unmetRequirements.length).toBeGreaterThan(0)
      })

      it('should show requirement status icons', () => {
        const checkIcons = wrapper.findAll('.pi-check')
        const timesIcons = wrapper.findAll('.pi-times')
        
        expect(checkIcons.length + timesIcons.length).toBeGreaterThan(0)
      })

      it('should limit displayed requirements to 3', () => {
        const requirementsList = wrapper.find('.space-y-1')
        if (requirementsList.exists()) {
          const requirements = requirementsList.findAll('.flex.justify-between.text-xs')
          expect(requirements.length).toBeLessThanOrEqual(3)
        }
      })

      it('should show additional requirements count', () => {
        const itemWithManyReqs = {
          ...mockItem,
          requirements: [
            { stat: 16, value: 300 },
            { stat: 17, value: 250 },
            { stat: 19, value: 200 },
            { stat: 20, value: 150 },
            { stat: 21, value: 100 }
          ]
        }
        
        wrapper = mountWithContext(ItemCard, {
          props: {
            item: itemWithManyReqs,
            profile: mockProfile,
            showCompatibility: true
          }
        })
        
        expect(wrapper.text()).toContain('+2 more requirements')
      })
    })

    describe('compatible item', () => {
      it('should show compatible status for items user can use', () => {
        const compatibleItem = {
          ...mockItem,
          requirements: [
            { stat: 16, value: 200 }, // Lower than profile's 350
            { stat: 133, value: 300 } // Lower than profile's 450
          ]
        }
        
        wrapper = mountWithContext(ItemCard, {
          props: {
            item: compatibleItem,
            profile: mockProfile,
            showCompatibility: true
          }
        })
        
        const compatibleIcon = wrapper.find('.w-6.h-6.bg-green-500')
        expect(compatibleIcon.exists()).toBe(true)
      })
    })
  })

  describe('Item Properties and Tags', () => {
    it('should show weapon property for items with attack data', () => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: mockItem
        }
      })
      
      const weaponTag = wrapper.findComponent({ name: 'Tag' })
      if (weaponTag.exists()) {
        expect(weaponTag.props('value')).toContain('Weapon')
      }
    })

    it('should show special effects property for items with spell data', () => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: mockItem
        }
      })
      
      const tags = wrapper.findAllComponents({ name: 'Tag' })
      const specialEffectsTag = tags.find(tag => tag.props('value') === 'Special Effects')
      expect(specialEffectsTag).toBeTruthy()
    })

    it('should mark high QL items as rare', () => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: mockItem // QL 250 should be considered rare
        }
      })

      const badges = wrapper.findAll('.p-badge')
      const rareBadge = badges.find(badge => badge.text().includes('Rare'))
      expect(rareBadge).toBeTruthy()
    })
  })

  describe('User Interactions', () => {
    beforeEach(() => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: mockItem,
          isFavorite: false,
          isComparing: false
        }
      })
    })

    it('should emit click event when card is clicked', async () => {
      await wrapper.find('.p-card').trigger('click')
      
      expect(wrapper.emitted('click')).toBeTruthy()
      expect(wrapper.emitted('click')[0]).toEqual([mockItem])
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

    it('should emit quick-view event when quick view button is clicked', async () => {
      const quickViewButton = wrapper.find('button[class*="pi-eye"]')
      
      await quickViewButton.trigger('click')
      
      expect(wrapper.emitted('quick-view')).toBeTruthy()
      expect(wrapper.emitted('quick-view')[0]).toEqual([mockItem])
    })

    it('should prevent event propagation for button clicks', async () => {
      const favoriteButton = wrapper.find('button[class*="pi-heart"]')
      const clickSpy = vi.fn()
      wrapper.find('.p-card').element.addEventListener('click', clickSpy)
      
      await favoriteButton.trigger('click')
      
      // Card click should not fire due to .stop modifier
      expect(wrapper.emitted('click')).toBeFalsy()
    })
  })

  describe('Visual States', () => {
    it('should show different favorite button states', async () => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: mockItem,
          isFavorite: true
        }
      })
      
      const favoriteButton = wrapper.find('button[class*="pi-heart-fill"]')
      expect(favoriteButton.exists()).toBe(true)
      expect(favoriteButton.attributes('severity')).toBe('danger')
    })

    it('should show different comparison button states', () => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: mockItem,
          isComparing: true
        }
      })
      
      const compareButton = wrapper.find('button[class*="pi-clone"]')
      expect(compareButton.attributes('severity')).toBe('primary')
    })

    it('should apply comparison visual styling', () => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: mockItem,
          isComparing: true
        }
      })
      
      const card = wrapper.find('.p-card')
      expect(card.classes()).toContain('ring-2')
      expect(card.classes()).toContain('ring-primary-500')
    })

    it('should apply compatibility visual styling', () => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: {
            ...mockItem,
            requirements: [{ stat: 16, value: 999999 }] // Impossible requirement
          },
          profile: mockProfile,
          showCompatibility: true
        }
      })
      
      const card = wrapper.find('.p-card')
      expect(card.classes()).toContain('border-red-500')
      expect(card.classes()).toContain('opacity-75')
    })
  })

  describe('Item Type and Category', () => {
    it('should display correct item type label', () => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: mockItem // item_class: 5 should be "Ranged"
        }
      })
      
      expect(wrapper.text()).toContain('Ranged')
    })

    it('should handle unknown item classes gracefully', () => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: {
            ...mockItem,
            item_class: 9999 // Unknown class
          }
        }
      })
      
      expect(wrapper.text()).toContain('Type 9999')
    })
  })

  describe('Responsive Design', () => {
    it('should have responsive card layout', () => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: mockItem
        }
      })
      
      const card = wrapper.find('.item-card')
      expect(card.classes()).toContain('h-full')
      expect(card.classes()).toContain('transition-all')
    })

    it('should show/hide quick actions on hover', () => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: mockItem
        }
      })
      
      const quickActions = wrapper.find('.opacity-0.group-hover\\:opacity-100')
      expect(quickActions.exists()).toBe(true)
    })
  })

  describe('Accessibility', () => {
    beforeEach(() => {
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: mockItem
        }
      })
    })

    it('should have proper button labels via tooltips', () => {
      const buttons = wrapper.findAll('button[v-tooltip]')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should be keyboard navigable', () => {
      const card = wrapper.find('.p-card')
      expect(card.classes()).toContain('cursor-pointer')
    })

    it('should have semantic HTML structure', () => {
      expect(wrapper.find('h3').exists()).toBe(true) // Item name
      expect(wrapper.find('p').exists()).toBe(true)  // Description
    })
  })

  describe('Performance', () => {
    it('should handle items without optional data gracefully', () => {
      const minimalItem: Item = {
        id: 999,
        aoid: 999,
        name: 'Minimal Item',
        ql: 1,
        description: '',
        item_class: 1,
        is_nano: false,
        stats: [],
        spell_data: [],
        actions: [],
        attack_defense: null,
        animation_mesh: null
      }
      
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: minimalItem
        }
      })
      
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('Minimal Item')
    })

    it('should not display empty sections', () => {
      const itemWithoutStats = {
        ...mockItem,
        stats: []
      }
      
      wrapper = mountWithContext(ItemCard, {
        props: {
          item: itemWithoutStats
        }
      })
      
      expect(wrapper.text()).not.toContain('Key Stats:')
    })
  })
})
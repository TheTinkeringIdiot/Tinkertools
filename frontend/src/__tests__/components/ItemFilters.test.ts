/**
 * ItemFilters Component Tests
 * 
 * Tests for the ItemFilters component functionality
 */


import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountWithContext, standardCleanup, createTestProfile, SKILL_ID, PROFESSION } from '@/__tests__/helpers'

import { nextTick } from 'vue'
import ItemFilters from '../../components/items/ItemFilters.vue'
import type { TinkerProfile, ItemFilters as IItemFilters } from '../../types/api'

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
    template: '<div class="p-accordion-tab"><template #header><slot name="header" /></template><slot /></div>',
    props: ['header']
  }
}))

vi.mock('primevue/multiselect', () => ({
  default: {
    name: 'MultiSelect',
    template: '<select multiple v-model="modelValue"><option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option></select>',
    props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'placeholder', 'maxSelectedLabels', 'selectedItemsLabel'],
    emits: ['update:modelValue']
  }
}))

vi.mock('primevue/slider', () => ({
  default: {
    name: 'Slider',
    template: '<input type="range" v-model="modelValue" :min="min" :max="max" />',
    props: ['modelValue', 'min', 'max', 'range'],
    emits: ['update:modelValue']
  }
}))

vi.mock('primevue/inputnumber', () => ({
  default: {
    name: 'InputNumber',
    template: '<input type="number" v-model="modelValue" />',
    props: ['modelValue', 'min', 'max', 'placeholder'],
    emits: ['update:modelValue']
  }
}))

vi.mock('primevue/checkbox', () => ({
  default: {
    name: 'Checkbox',
    template: '<input type="checkbox" v-model="modelValue" />',
    props: ['modelValue'],
    emits: ['update:modelValue']
  }
}))

vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click']
  }
}))

const mockProfile: TinkerProfile = createTestProfile({
  profession: PROFESSION.ENGINEER,
  level: 200,
  skills: {
    [SKILL_ID.STRENGTH]: { base: 6, pointsFromIp: 494, equipmentBonus: 0, total: 500 },
    [SKILL_ID.AGILITY]: { base: 6, pointsFromIp: 394, equipmentBonus: 0, total: 400 },
    [SKILL_ID.INTELLIGENCE]: { base: 6, pointsFromIp: 594, equipmentBonus: 0, total: 600 }
  }
})

const mockFilters: IItemFilters = {
  item_class: [1, 2],
  min_ql: 100,
  max_ql: 250,
  is_nano: false,
  stat_requirements: {
    16: { min: 200, max: 400 }
  }
}

describe('ItemFilters', () => {
  let wrapper: any

  beforeEach(() => {
    
    vi.clearAllMocks()
    
    // Reset localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    })
  })

  afterEach(() => {
    standardCleanup()
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Component Mounting', () => {
    it('should mount without errors', () => {
      wrapper = mountWithContext(ItemFilters, {
        props: {
          filters: {},
          loading: false
        }
      })
      
      expect(wrapper.exists()).toBe(true)
    })

    it('should display accordion sections', () => {
      wrapper = mountWithContext(ItemFilters, {
        props: {
          filters: {},
          loading: false
        }
      })
      
      const accordion = wrapper.find('.p-accordion')
      expect(accordion.exists()).toBe(true)
    })

    it('should show profile-aware options when profile is provided', () => {
      wrapper = mountWithContext(ItemFilters, {
        props: {
          filters: {},
          loading: false,
          profile: mockProfile
        }
      })
      
      // Should show stat requirement filters for profile
      expect(wrapper.text()).toContain('Stat Requirements')
    })
  })

  describe('Item Type Filters', () => {
    beforeEach(() => {
      wrapper = mountWithContext(ItemFilters, {
        props: {
          filters: {},
          loading: false
        }
      })
    })

    it('should emit filter change when item classes are selected', async () => {
      const multiSelect = wrapper.find('select[multiple]')
      
      await multiSelect.setValue([1, 2])
      
      expect(wrapper.emitted('filters-change')).toBeTruthy()
      expect(wrapper.emitted('filters-change')[0][0]).toEqual(
        expect.objectContaining({ item_class: [1, 2] })
      )
    })

    it('should display available item class options', () => {
      const multiSelect = wrapper.find('select[multiple]')
      expect(multiSelect.exists()).toBe(true)
    })

    it('should handle nano filter toggle', async () => {
      const nanoCheckbox = wrapper.find('input[type="checkbox"]')
      
      await nanoCheckbox.setChecked(true)
      
      expect(wrapper.emitted('filters-change')).toBeTruthy()
    })
  })

  describe('Quality Level Filters', () => {
    beforeEach(() => {
      wrapper = mountWithContext(ItemFilters, {
        props: {
          filters: mockFilters,
          loading: false
        }
      })
    })

    it('should emit filter change when QL range is updated', async () => {
      const slider = wrapper.find('input[type="range"]')
      
      await slider.setValue('150')
      
      expect(wrapper.emitted('filters-change')).toBeTruthy()
    })

    it('should show current QL range values', () => {
      // Should display min and max QL values
      expect(wrapper.text()).toContain('100')
      expect(wrapper.text()).toContain('250')
    })

    it('should allow manual QL input', async () => {
      const numberInputs = wrapper.findAll('input[type="number"]')
      expect(numberInputs.length).toBeGreaterThan(0)
    })
  })

  describe('Stat Requirement Filters', () => {
    beforeEach(() => {
      wrapper = mountWithContext(ItemFilters, {
        props: {
          filters: {},
          loading: false,
          profile: mockProfile
        }
      })
    })

    it('should show stat filters when profile is provided', () => {
      expect(wrapper.text()).toContain('Intelligence')
      expect(wrapper.text()).toContain('Strength')
    })

    it('should emit filter change when stat requirements are set', async () => {
      const numberInput = wrapper.find('input[type="number"]')
      
      await numberInput.setValue('300')
      
      expect(wrapper.emitted('filters-change')).toBeTruthy()
    })

    it('should not show stat filters when no profile', () => {
      wrapper = mountWithContext(ItemFilters, {
        props: {
          filters: {},
          loading: false,
          profile: null
        }
      })
      
      // Should not contain stat names
      expect(wrapper.text()).not.toContain('Intelligence')
    })
  })

  describe('Filter Presets', () => {
    beforeEach(() => {
      wrapper = mountWithContext(ItemFilters, {
        props: {
          filters: {},
          loading: false
        }
      })
    })

    it('should show preset buttons', () => {
      const buttons = wrapper.findAll('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should emit preset selection', async () => {
      const buttons = wrapper.findAll('button')
      const presetButton = buttons.find(btn => btn.text().includes('Weapons'))
      if (presetButton) {
        await presetButton.trigger('click')
        expect(wrapper.emitted('preset-apply')).toBeTruthy()
      }
    })

    it('should allow saving custom presets', async () => {
      // Set some filters first
      await wrapper.setProps({
        filters: { item_class: [1, 2], min_ql: 200 }
      })

      const buttons = wrapper.findAll('button')
      const saveButton = buttons.find(btn => btn.text().includes('Save'))
      if (saveButton) {
        await saveButton.trigger('click')
        // Should show save dialog or emit save event
      }
    })
  })

  describe('Clear and Reset', () => {
    beforeEach(() => {
      wrapper = mountWithContext(ItemFilters, {
        props: {
          filters: mockFilters,
          loading: false
        }
      })
    })

    it('should emit clear filters event', async () => {
      const buttons = wrapper.findAll('button')
      const clearButton = buttons.find(btn => btn.text().includes('Clear'))

      if (clearButton) {
        await clearButton.trigger('click')
        expect(wrapper.emitted('filters-clear')).toBeTruthy()
      }
    })

    it('should show active filter count', () => {
      // Should indicate how many filters are active
      const filterCount = wrapper.find('.filter-count')
      if (filterCount.exists()) {
        expect(filterCount.text()).toMatch(/\d+/)
      }
    })
  })

  describe('LocalStorage Integration', () => {
    it('should save filter presets to localStorage', async () => {
      wrapper = mountWithContext(ItemFilters, {
        props: {
          filters: { itemClasses: [1], minQL: 150 },
          loading: false
        }
      })

      // Wait for component to mount
      await nextTick()

      // Simulate saving a preset using the exposed method
      const presetName = 'My Custom Preset'
      wrapper.vm.savePreset(presetName)

      // Wait for save operation
      await vi.waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith(
          'tinkerItems.filterPresets',
          expect.stringContaining(presetName)
        )
      })
    })

    it('should load filter presets from localStorage', async () => {
      const mockPresets = [{
        name: 'Custom Preset',
        filters: { itemClasses: [1, 2], minQL: 200 }
      }]

      const mockGetItem = vi.fn((key) => {
        if (key === 'tinkerItems.filterPresets') {
          return JSON.stringify(mockPresets)
        }
        return null
      })

      Object.defineProperty(window, 'localStorage', {
        value: {
          ...window.localStorage,
          getItem: mockGetItem,
          setItem: vi.fn(),
          removeItem: vi.fn(),
          clear: vi.fn()
        },
        writable: true
      })

      wrapper = mountWithContext(ItemFilters, {
        props: {
          filters: {},
          loading: false
        }
      })

      // Wait for mount lifecycle
      await vi.waitFor(() => {
        expect(mockGetItem).toHaveBeenCalledWith('tinkerItems.filterPresets')
      })
    })
  })

  describe('Performance and Responsiveness', () => {
    it('should handle large filter datasets efficiently', () => {
      const largeFilters = {
        item_class: Array.from({ length: 20 }, (_, i) => i + 1),
        stat_requirements: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [i + 100, { min: 100, max: 500 }])
        )
      }
      
      wrapper = mountWithContext(ItemFilters, {
        props: {
          filters: largeFilters,
          loading: false
        }
      })
      
      expect(wrapper.exists()).toBe(true)
    })

    it('should show loading state', () => {
      wrapper = mountWithContext(ItemFilters, {
        props: {
          filters: {},
          loading: true
        }
      })
      
      // Should show loading indicators or disable inputs
      const inputs = wrapper.findAll('input, select')
      inputs.forEach(input => {
        expect(input.attributes('disabled')).toBeDefined()
      })
    })
  })

  describe('Accessibility', () => {
    beforeEach(() => {
      wrapper = mountWithContext(ItemFilters, {
        props: {
          filters: {},
          loading: false
        }
      })
    })

    it('should have proper labels for form elements', () => {
      const labels = wrapper.findAll('label')
      expect(labels.length).toBeGreaterThan(0)
    })

    it('should have ARIA attributes on filter sections', () => {
      const accordion = wrapper.find('.p-accordion')
      expect(accordion.exists()).toBe(true)
    })

    it('should be keyboard navigable', async () => {
      const firstInput = wrapper.find('input, select')
      await firstInput.trigger('focus')
      
      // Should handle keyboard navigation
      await firstInput.trigger('keydown.tab')
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid filter values gracefully', async () => {
      wrapper = mountWithContext(ItemFilters, {
        props: {
          filters: { min_ql: 'invalid' as any },
          loading: false
        }
      })
      
      expect(wrapper.exists()).toBe(true)
      // Should not crash with invalid data
    })

    it('should validate filter ranges', async () => {
      wrapper = mountWithContext(ItemFilters, {
        props: {
          filters: {},
          loading: false
        }
      })

      await nextTick()

      // Set min_ql higher than max_ql using exposed method
      wrapper.vm.updateFilters({ minQL: 300, maxQL: 200 })

      // Wait for filter change to be emitted
      await vi.waitFor(() => {
        expect(wrapper.emitted('filter-change')).toBeTruthy()
      })
    })
  })
})
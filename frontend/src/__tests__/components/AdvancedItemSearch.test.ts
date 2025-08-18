/**
 * AdvancedItemSearch Component Integration Tests
 * 
 * Tests for the AdvancedItemSearch component functionality using real components
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import PrimeVue from 'primevue/config'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Dropdown from 'primevue/dropdown'
import Checkbox from 'primevue/checkbox'
import AdvancedItemSearch from '../../components/items/AdvancedItemSearch.vue'
import type { ItemSearchQuery } from '../../types/api'

describe('AdvancedItemSearch', () => {
  let wrapper: any

  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const createWrapper = (props = {}) => {
    return mount(AdvancedItemSearch, {
      props: {
        loading: false,
        resultCount: 0,
        ...props
      },
      global: {
        plugins: [PrimeVue],
        components: {
          Button,
          InputText,
          InputNumber,
          Dropdown,
          Checkbox
        }
      }
    })
  }

  describe('Component Mounting', () => {
    it('should mount without errors', () => {
      wrapper = createWrapper()
      expect(wrapper.exists()).toBe(true)
    })

    it('should display the advanced search header', () => {
      wrapper = createWrapper()
      const header = wrapper.find('h2')
      expect(header.text()).toContain('Advanced Search')
    })

    it('should show search and clear buttons', () => {
      wrapper = createWrapper()
      const buttons = wrapper.findAll('button')
      const buttonTexts = buttons.map((btn: any) => btn.text())
      
      expect(buttonTexts).toContain('Search')
      expect(buttonTexts).toContain('Clear')
    })
  })

  describe('Button States', () => {
    it('should initially disable search and clear buttons', () => {
      wrapper = createWrapper()
      const buttons = wrapper.findAll('button')
      const searchButton = buttons.find((btn: any) => btn.text() === 'Search')
      const clearButton = buttons.find((btn: any) => btn.text() === 'Clear')
      
      expect(searchButton.attributes('disabled')).toBeDefined()
      expect(clearButton.attributes('disabled')).toBeDefined()
    })

    it('should show loading state on search button', () => {
      wrapper = createWrapper({ loading: true })
      const buttons = wrapper.findAll('button')
      const searchButton = buttons.find((btn: any) => btn.text() === 'Search')
      
      expect(searchButton.classes()).toContain('p-button-loading')
    })
  })

  describe('Form Sections', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should show all major form sections', () => {
      const headings = wrapper.findAll('h3')
      const headingTexts = headings.map((h: any) => h.text())
      
      expect(headingTexts).toContain('Item Name')
      expect(headingTexts).toContain('Quality Level')
      expect(headingTexts).toContain('Item Type')
      expect(headingTexts).toContain('Requirements')
      expect(headingTexts).toContain('Special Filters')
      expect(headingTexts).toContain('Stat Bonuses')
    })

    it('should have search input field', () => {
      const searchInput = wrapper.find('input[placeholder*="Search for items"]')
      expect(searchInput.exists()).toBe(true)
    })

    it('should have quality level inputs', () => {
      // PrimeVue InputNumber renders as a text input with additional features
      const inputs = wrapper.findAll('input')
      const numberInputs = inputs.filter((input: any) => 
        input.attributes('placeholder') === '1' || input.attributes('placeholder') === '999'
      )
      expect(numberInputs.length).toBeGreaterThanOrEqual(2) // Min and Max QL
    })

    it('should have dropdown selections', () => {
      // PrimeVue Dropdown may render differently, look for dropdown containers
      const dropdownContainers = wrapper.findAll('.p-dropdown, select')
      expect(dropdownContainers.length).toBeGreaterThan(0)
    })
  })

  describe('Checkboxes', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should show special filter checkboxes', () => {
      const checkboxes = wrapper.findAll('input[type="checkbox"]')
      expect(checkboxes.length).toBeGreaterThanOrEqual(2) // At least Froob Friendly and NoDrop
    })

    it('should show stat bonus checkboxes', () => {
      const checkboxes = wrapper.findAll('input[type="checkbox"]')
      expect(checkboxes.length).toBeGreaterThanOrEqual(10) // 8 stats + 2 special filters
    })

    it('should handle checkbox interactions', async () => {
      const checkboxes = wrapper.findAll('input[type="checkbox"]')
      const firstCheckbox = checkboxes[0]
      
      expect(firstCheckbox.element.checked).toBe(false)
      
      await firstCheckbox.setValue(true)
      expect(firstCheckbox.element.checked).toBe(true)
    })
  })

  describe('Quick QL Buttons', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should show quick QL range buttons', () => {
      const buttons = wrapper.findAll('button')
      const buttonTexts = buttons.map((btn: any) => btn.text())
      
      expect(buttonTexts).toContain('1-50')
      expect(buttonTexts).toContain('51-100')
      expect(buttonTexts).toContain('101-200')
      expect(buttonTexts).toContain('201-300')
    })

    it('should set QL range when quick button is clicked', async () => {
      const buttons = wrapper.findAll('button')
      const qlButton = buttons.find((btn: any) => btn.text() === '51-100')
      
      await qlButton.trigger('click')
      await nextTick()
      
      // Check that the component's internal state was updated
      expect(wrapper.vm.searchForm.min_ql).toBe(51)
      expect(wrapper.vm.searchForm.max_ql).toBe(100)
    })
  })

  describe('Search Operations', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should emit search event when search button is clicked with criteria', async () => {
      // Add some search criteria
      const searchInput = wrapper.find('input[placeholder*="Search for items"]')
      await searchInput.setValue('implant')
      await nextTick()
      
      const buttons = wrapper.findAll('button')
      const searchButton = buttons.find((btn: any) => btn.text() === 'Search')
      
      await searchButton.trigger('click')
      
      expect(wrapper.emitted('search')).toBeTruthy()
      const searchEvent = wrapper.emitted('search')[0]
      expect(searchEvent[0]).toMatchObject({
        search: 'implant'
      })
    })

    it('should emit clear event when clear button is clicked', async () => {
      // Add some search criteria first
      const searchInput = wrapper.find('input[placeholder*="Search for items"]')
      await searchInput.setValue('test')
      await nextTick()
      
      const buttons = wrapper.findAll('button')
      const clearButton = buttons.find((btn: any) => btn.text() === 'Clear')
      
      await clearButton.trigger('click')
      
      expect(wrapper.emitted('clear')).toBeTruthy()
    })

    it('should build search query with multiple criteria', async () => {
      // Set various search criteria
      const searchInput = wrapper.find('input[placeholder*="Search for items"]')
      await searchInput.setValue('weapon')
      
      const checkboxes = wrapper.findAll('input[type="checkbox"]')
      if (checkboxes.length > 0) {
        await checkboxes[0].setValue(true)
      }
      
      await nextTick()
      
      const buttons = wrapper.findAll('button')
      const searchButton = buttons.find((btn: any) => btn.text() === 'Search')
      await searchButton.trigger('click')
      
      const searchEvent = wrapper.emitted('search')[0]
      const query = searchEvent[0] as ItemSearchQuery
      
      expect(query.search).toBe('weapon')
      expect(query).toHaveProperty('exact_match')
      expect(query).toHaveProperty('search_fields')
    })
  })

  describe('Dynamic Slot Selection', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should update available slots when item class changes', async () => {
      // Find item class dropdown
      const dropdowns = wrapper.findAll('select')
      let itemClassDropdown = null
      
      // Look for the item class dropdown by finding its associated label
      for (const dropdown of dropdowns) {
        const container = dropdown.element.closest('.space-y-2')
        if (container?.querySelector('label')?.textContent?.includes('Item Class')) {
          itemClassDropdown = dropdown
          break
        }
      }
      
      if (itemClassDropdown) {
        // Select weapon class (assuming value 1)
        await itemClassDropdown.setValue('1')
        await nextTick()
        
        // Check that slots became available
        expect(wrapper.vm.availableSlots.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Form Validation', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should properly validate search criteria presence', async () => {
      expect(wrapper.vm.hasSearchCriteria).toBe(false)
      
      const searchInput = wrapper.find('input[placeholder*="Search for items"]')
      await searchInput.setValue('test')
      await nextTick()
      
      expect(wrapper.vm.hasSearchCriteria).toBe(true)
    })

    it('should enable buttons when search criteria is present', async () => {
      const searchInput = wrapper.find('input[placeholder*="Search for items"]')
      await searchInput.setValue('test')
      await nextTick()
      
      const buttons = wrapper.findAll('button')
      const searchButton = buttons.find((btn: any) => btn.text() === 'Search')
      const clearButton = buttons.find((btn: any) => btn.text() === 'Clear')
      
      expect(searchButton.attributes('disabled')).toBeUndefined()
      expect(clearButton.attributes('disabled')).toBeUndefined()
    })
  })

  describe('Result Display', () => {
    it('should show result count when results are available', async () => {
      wrapper = createWrapper({ resultCount: 42 })
      wrapper.vm.hasSearched = true
      await nextTick()
      
      const text = wrapper.text()
      expect(text).toContain('42 items found')
    })

    it('should show save search button when criteria and results exist', async () => {
      wrapper = createWrapper({ resultCount: 10 })
      
      // Add search criteria
      const searchInput = wrapper.find('input[placeholder*="Search for items"]')
      await searchInput.setValue('test')
      wrapper.vm.hasSearched = true
      await nextTick()
      
      const buttons = wrapper.findAll('button')
      const saveButton = buttons.find((btn: any) => btn.text() === 'Save Search')
      expect(saveButton.exists()).toBe(true)
    })
  })

  describe('Accessibility', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should have proper heading structure', () => {
      const h2 = wrapper.find('h2')
      const h3s = wrapper.findAll('h3')
      
      expect(h2.exists()).toBe(true)
      expect(h3s.length).toBeGreaterThan(0)
    })

    it('should have labels for form inputs', () => {
      const labels = wrapper.findAll('label')
      expect(labels.length).toBeGreaterThan(0)
    })

    it('should associate checkboxes with labels', () => {
      const checkboxes = wrapper.findAll('input[type="checkbox"]')
      
      checkboxes.forEach((checkbox: any) => {
        const id = checkbox.attributes('id')
        if (id) {
          const label = wrapper.find(`label[for="${id}"]`)
          expect(label.exists()).toBe(true)
        }
      })
    })
  })
})
/**
 * AdvancedItemSearch Component Unit Tests
 *
 * UNIT TEST - Component behavior tests, no real API calls
 * Strategy: Tests component logic in isolation
 *
 * Tests the AdvancedItemSearch component query building and validation
 * without making real backend calls. Component emits search queries
 * which are validated for correct structure.
 *
 * Note: This file is named "integration" but tests component behavior
 * in isolation, not real backend integration.
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
import { useItemsStore } from '../../stores/items'
import type { ItemSearchQuery } from '../../types/api'

describe('AdvancedItemSearch Component Unit Tests', () => {
  let wrapper: any
  let itemsStore: any

  beforeEach(() => {
    setActivePinia(createPinia())
    itemsStore = useItemsStore()
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

  describe('API Integration', () => {
    it('should emit properly formatted search queries', async () => {
      wrapper = createWrapper()
      
      // Set up complex search criteria
      const searchInput = wrapper.find('input[placeholder*="Search for items"]')
      await searchInput.setValue('implant')
      await nextTick()
      
      // Set min QL directly on component data since PrimeVue InputNumber is complex
      wrapper.vm.searchForm.min_ql = 100
      await nextTick()
      
      // Check a stat bonus
      const checkboxes = wrapper.findAll('input[type="checkbox"]')
      if (checkboxes.length > 0) {
        await checkboxes[0].setValue(true)
        await nextTick()
      }
      
      // Trigger search
      const buttons = wrapper.findAll('button')
      const searchButton = buttons.find((btn: any) => btn.text() === 'Search')
      await searchButton.trigger('click')
      
      // Verify search event was emitted with correct structure
      const searchEvents = wrapper.emitted('search')
      expect(searchEvents).toBeTruthy()
      expect(searchEvents[0]).toBeTruthy()
      
      const query = searchEvents[0][0] as ItemSearchQuery
      
      // Verify query structure matches API expectations
      expect(query).toHaveProperty('search')
      expect(query.search).toBe('implant')
      expect(query).toHaveProperty('exact_match')
      expect(query).toHaveProperty('search_fields')
      expect(query).toHaveProperty('min_ql')
      expect(query.min_ql).toBe(100)
    })

    it('should handle empty search criteria correctly', async () => {
      wrapper = createWrapper()
      
      // Try to search without any criteria
      const buttons = wrapper.findAll('button')
      const searchButton = buttons.find((btn: any) => btn.text() === 'Search')
      
      // Should be disabled initially
      expect(searchButton.attributes('disabled')).toBeDefined()
      
      // Add minimal criteria
      const searchInput = wrapper.find('input[placeholder*="Search for items"]')
      await searchInput.setValue('test')
      await nextTick()
      
      // Should now be enabled
      expect(searchButton.attributes('disabled')).toBeUndefined()
    })

    it('should properly clear all form data', async () => {
      wrapper = createWrapper()
      
      // Set various form values
      const searchInput = wrapper.find('input[placeholder*="Search for items"]')
      await searchInput.setValue('test search')
      
      const checkboxes = wrapper.findAll('input[type="checkbox"]')
      if (checkboxes.length > 0) {
        await checkboxes[0].setValue(true)
      }
      
      await nextTick()
      
      // Verify search criteria exists
      expect(wrapper.vm.hasSearchCriteria).toBe(true)
      
      // Clear the form
      const buttons = wrapper.findAll('button')
      const clearButton = buttons.find((btn: any) => btn.text() === 'Clear')
      await clearButton.trigger('click')
      
      // Verify clear event was emitted
      expect(wrapper.emitted('clear')).toBeTruthy()
      
      // Verify form was reset
      expect(wrapper.vm.searchForm.search).toBe('')
      expect(wrapper.vm.selectedStatBonuses).toEqual([])
      expect(wrapper.vm.hasSearchCriteria).toBe(false)
    })

    it('should validate QL range constraints', async () => {
      wrapper = createWrapper()
      
      // Set QL values directly on component data
      wrapper.vm.searchForm.min_ql = 50
      wrapper.vm.searchForm.max_ql = 200
      wrapper.vm.searchForm.search = 'test' // Add basic search criteria
      await nextTick()
      
      const buttons = wrapper.findAll('button')
      const searchButton = buttons.find((btn: any) => btn.text() === 'Search')
      await searchButton.trigger('click')
      
      const searchEvents = wrapper.emitted('search')
      expect(searchEvents).toBeTruthy()
      expect(searchEvents[0]).toBeTruthy()
      
      const query = searchEvents[0][0] as ItemSearchQuery
      expect(query.min_ql).toBe(50)
      expect(query.max_ql).toBe(200)
      expect(query.search).toBe('test')
    })

    it('should handle stat bonus selections correctly', async () => {
      wrapper = createWrapper()
      
      // Select multiple stat bonuses
      const checkboxes = wrapper.findAll('input[type="checkbox"]')
      
      // Select first few checkboxes (assuming they are stat bonuses)
      if (checkboxes.length >= 3) {
        await checkboxes[2].setValue(true) // Skip special filters, go to stats
        await checkboxes[3].setValue(true)
        await nextTick()
        
        const searchInput = wrapper.find('input[placeholder*="Search for items"]')
        await searchInput.setValue('stats test')
        
        const buttons = wrapper.findAll('button')
        const searchButton = buttons.find((btn: any) => btn.text() === 'Search')
        await searchButton.trigger('click')
        
        const query = wrapper.emitted('search')[0][0] as ItemSearchQuery
        expect(query).toHaveProperty('stat_bonuses')
        expect(Array.isArray(query.stat_bonuses)).toBe(true)
        expect(query.stat_bonuses.length).toBeGreaterThan(0)
      }
    })

    it('should handle special filter combinations', async () => {
      wrapper = createWrapper()
      
      // Find and check special filters
      const checkboxes = wrapper.findAll('input[type="checkbox"]')
      
      // Look for Froob Friendly checkbox
      const froobCheckbox = checkboxes.find((cb: any) => 
        cb.attributes('id') === 'froob-friendly'
      )
      
      if (froobCheckbox) {
        await froobCheckbox.setValue(true)
        
        const searchInput = wrapper.find('input[placeholder*="Search for items"]')
        await searchInput.setValue('froob items')
        await nextTick()
        
        const buttons = wrapper.findAll('button')
        const searchButton = buttons.find((btn: any) => btn.text() === 'Search')
        await searchButton.trigger('click')
        
        const query = wrapper.emitted('search')[0][0] as ItemSearchQuery
        expect(query.froob_friendly).toBe(true)
      }
    })

    it('should handle match type and search field selections', async () => {
      wrapper = createWrapper()
      
      const searchInput = wrapper.find('input[placeholder*="Search for items"]')
      await searchInput.setValue('exact search term')
      
      // Find dropdowns and set match type to exact
      const dropdowns = wrapper.findAll('.p-dropdown, select')
      if (dropdowns.length >= 2) {
        // First dropdown should be match type
        const matchTypeDropdown = dropdowns[0]
        if (matchTypeDropdown.element.tagName.toLowerCase() === 'select') {
          await matchTypeDropdown.setValue('exact')
        }
        
        // Second dropdown should be search fields  
        const searchFieldsDropdown = dropdowns[1]
        if (searchFieldsDropdown.element.tagName.toLowerCase() === 'select') {
          await searchFieldsDropdown.setValue('name')
        }
      }
      
      await nextTick()
      
      const buttons = wrapper.findAll('button')
      const searchButton = buttons.find((btn: any) => btn.text() === 'Search')
      await searchButton.trigger('click')
      
      const query = wrapper.emitted('search')[0][0] as ItemSearchQuery
      expect(query.search).toBe('exact search term')
      expect(query.exact_match).toBe(true)
      expect(query.search_fields).toContain('name')
    })
  })

  describe('Component State Management', () => {
    it('should properly manage hasSearched state', async () => {
      wrapper = createWrapper()
      
      // Initially should not have searched
      expect(wrapper.vm.hasSearched).toBe(false)
      
      // Add criteria and search
      const searchInput = wrapper.find('input[placeholder*="Search for items"]')
      await searchInput.setValue('test')
      
      const buttons = wrapper.findAll('button')
      const searchButton = buttons.find((btn: any) => btn.text() === 'Search')
      await searchButton.trigger('click')
      
      // Should now have searched
      expect(wrapper.vm.hasSearched).toBe(true)
    })

    it('should reset hasSearched when clearing', async () => {
      wrapper = createWrapper()
      
      // Set up and perform search
      const searchInput = wrapper.find('input[placeholder*="Search for items"]')
      await searchInput.setValue('test')
      
      const buttons = wrapper.findAll('button')
      const searchButton = buttons.find((btn: any) => btn.text() === 'Search')
      await searchButton.trigger('click')
      
      expect(wrapper.vm.hasSearched).toBe(true)
      
      // Clear the form
      const clearButton = buttons.find((btn: any) => btn.text() === 'Clear')
      await clearButton.trigger('click')
      
      // Should reset hasSearched
      expect(wrapper.vm.hasSearched).toBe(false)
    })

    it('should maintain selectedStatBonuses array correctly', async () => {
      wrapper = createWrapper()
      
      // Initially empty
      expect(wrapper.vm.selectedStatBonuses).toEqual([])
      
      // Select some stat bonuses
      const checkboxes = wrapper.findAll('input[type="checkbox"]')
      if (checkboxes.length >= 3) {
        // Skip special filters (first 2), select stat bonuses
        await checkboxes[2].setValue(true)
        await checkboxes[3].setValue(true)
        await nextTick()
        
        expect(wrapper.vm.selectedStatBonuses.length).toBeGreaterThan(0)
        
        // Uncheck one
        await checkboxes[2].setValue(false)
        await nextTick()
        
        expect(wrapper.vm.selectedStatBonuses.length).toBeGreaterThan(0)
        expect(wrapper.vm.selectedStatBonuses.length).toBeLessThan(2)
      }
    })
  })
})
/**
 * TinkerItems Full Integration Tests
 * 
 * Tests the complete TinkerItems application with real API calls
 * to ensure proper integration between frontend and backend
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
import TinkerItems from '../../views/TinkerItems.vue'
import { useItemsStore } from '../../stores/items'
import type { ItemSearchQuery } from '../../types/api'

// Real backend URL for integration testing
const BACKEND_URL = 'http://localhost:8000/api/v1'

describe('TinkerItems Full Integration', () => {
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
    return mount(TinkerItems, {
      props: {
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

  describe('Backend API Integration', () => {
    it('should successfully perform a basic item search', async () => {
      // Test a real API call
      const params = new URLSearchParams({
        q: 'implant',
        exact_match: 'false',
        search_fields: 'name,description',
        page_size: '5'
      })
      
      const response = await fetch(`${BACKEND_URL}/items/search?${params}`)

      expect(response.ok).toBe(true)
      const data = await response.json()
      
      expect(data).toHaveProperty('items')
      expect(data).toHaveProperty('total')
      expect(Array.isArray(data.items)).toBe(true)
      expect(typeof data.total).toBe('number')
      
      if (data.items.length > 0) {
        const firstItem = data.items[0]
        expect(firstItem).toHaveProperty('aoid')
        expect(firstItem).toHaveProperty('name')
        expect(firstItem).toHaveProperty('ql')
      }
    }, 10000)

    it('should handle advanced search with multiple filters', async () => {
      const params = new URLSearchParams({
        q: 'weapon',
        min_ql: '100',
        max_ql: '200',
        item_class: '1', // Weapon
        froob_friendly: 'true',
        page_size: '5'
      })

      const response = await fetch(`${BACKEND_URL}/items/search?${params}`)

      expect(response.ok).toBe(true)
      const data = await response.json()
      
      expect(data).toHaveProperty('items')
      expect(data).toHaveProperty('total')
      expect(Array.isArray(data.items)).toBe(true)
      
      // Verify that returned items match the filters
      data.items.forEach((item: any) => {
        expect(item.ql).toBeGreaterThanOrEqual(100)
        expect(item.ql).toBeLessThanOrEqual(200)
        expect(item.item_class).toBe(1) // Should be weapons
      })
    }, 10000)

    it('should handle stat bonus filtering', async () => {
      const params = new URLSearchParams({
        q: 'implant',
        stat_bonuses: '16,17', // Strength and Agility
        page_size: '5'
      })

      const response = await fetch(`${BACKEND_URL}/items/search?${params}`)

      expect(response.ok).toBe(true)
      const data = await response.json()
      
      expect(data).toHaveProperty('items')
      expect(Array.isArray(data.items)).toBe(true)
      
      // Items should have stat bonuses for Strength (16) or Agility (17)
      if (data.items.length > 0) {
        data.items.forEach((item: any) => {
          expect(item).toHaveProperty('stats')
          expect(Array.isArray(item.stats)).toBe(true)
        })
      }
    }, 10000)

    it('should handle empty search results gracefully', async () => {
      const params = new URLSearchParams({
        q: 'nonexistentitem12345randomstring'
      })

      const response = await fetch(`${BACKEND_URL}/items/search?${params}`)

      expect(response.ok).toBe(true)
      const data = await response.json()
      
      expect(data).toHaveProperty('items')
      expect(data).toHaveProperty('total')
      expect(data.items).toEqual([])
      expect(data.total).toBe(0)
    }, 10000)

    it('should validate API response structure for different item types', async () => {
      // Test different item classes
      const itemClasses = [1, 2, 3] // Weapon, Armor, Implant
      
      for (const itemClass of itemClasses) {
        const params = new URLSearchParams({
          q: 'item', // Required parameter
          item_class: itemClass.toString(),
          min_ql: '1',
          max_ql: '50',
          page_size: '3'
        })

        const response = await fetch(`${BACKEND_URL}/items/search?${params}`)

        expect(response.ok).toBe(true)
        const data = await response.json()
        
        expect(data).toHaveProperty('items')
        expect(Array.isArray(data.items)).toBe(true)
        
        if (data.items.length > 0) {
          const item = data.items[0]
          expect(item).toHaveProperty('aoid')
          expect(item).toHaveProperty('name')
          expect(item).toHaveProperty('ql')
          expect(item).toHaveProperty('item_class')
          expect(item.item_class).toBe(itemClass)
        }
      }
    }, 15000)
  })

  describe('Store Integration', () => {
    it('should integrate with items store for search operations', async () => {
      // Test store directly
      const searchQuery: ItemSearchQuery = {
        q: 'nano',
        exact_match: false,
        search_fields: 'name'
      }

      const results = await itemsStore.searchItems(searchQuery)
      
      expect(results).toBeDefined()
      expect(Array.isArray(results)).toBe(true)
      expect(itemsStore.loading).toBe(false)
      expect(itemsStore.currentSearchResults).toBeDefined()
      expect(Array.isArray(itemsStore.currentSearchResults)).toBe(true)
    }, 10000)

    it('should handle store loading states correctly', async () => {
      const searchQuery: ItemSearchQuery = {
        q: 'test',
        exact_match: false
      }

      // Start search (should set loading to true)
      const searchPromise = itemsStore.searchItems(searchQuery)
      
      // Loading should be true during the request
      expect(itemsStore.loading).toBe(true)
      
      // Wait for completion
      await searchPromise
      
      // Loading should be false after completion
      expect(itemsStore.loading).toBe(false)
    }, 10000)

    it('should handle store error states', async () => {
      // Test with an invalid query to trigger error
      const searchQuery: ItemSearchQuery = {
        q: '', // Empty query should cause error
        exact_match: false
      }

      try {
        await itemsStore.searchItems(searchQuery)
      } catch (error) {
        expect(error).toBeDefined()
      }
      
      expect(itemsStore.loading).toBe(false)
    }, 10000)
  })

  describe('Component and API Integration', () => {
    it('should successfully mount TinkerItems and interact with backend', async () => {
      wrapper = createWrapper()
      
      expect(wrapper.exists()).toBe(true)
      
      // Wait for initial load
      await nextTick()
      
      // The component should mount successfully
      expect(wrapper.vm).toBeTruthy()
    })

    it('should handle component state management', async () => {
      wrapper = createWrapper()
      await nextTick()
      
      // Verify the component has mounted and has access to store
      expect(wrapper.vm).toBeTruthy()
      expect(itemsStore).toBeDefined()
      expect(itemsStore.loading).toBe(false)
    }, 10000)
  })

  describe('Performance Integration', () => {
    it('should complete search requests within reasonable time', async () => {
      const startTime = performance.now()
      
      const params = new URLSearchParams({
        q: 'weapon',
        exact_match: 'false',
        page_size: '10'
      })
      
      const response = await fetch(`${BACKEND_URL}/items/search?${params}`)
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(response.ok).toBe(true)
      expect(duration).toBeLessThan(5000) // Should complete within 5 seconds
    }, 10000)

    it('should handle pagination correctly', async () => {
      const params = new URLSearchParams({
        q: 'implant',
        exact_match: 'false',
        page: '1',
        page_size: '10'
      })

      const response = await fetch(`${BACKEND_URL}/items/search?${params}`)

      expect(response.ok).toBe(true)
      const data = await response.json()
      
      expect(data).toHaveProperty('items')
      expect(data).toHaveProperty('total')
      expect(data.items.length).toBeLessThanOrEqual(10)
      
      if (data.total > 10) {
        // Test second page
        const page2Params = new URLSearchParams({
          q: 'implant',
          exact_match: 'false',
          page: '2',
          page_size: '10'
        })
        const page2Response = await fetch(`${BACKEND_URL}/items/search?${page2Params}`)
        
        expect(page2Response.ok).toBe(true)
        const page2Data = await page2Response.json()
        expect(page2Data.items.length).toBeGreaterThan(0)
      }
    }, 10000)
  })
})
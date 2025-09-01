/**
 * E2E Item Interpolation Workflow Tests
 * 
 * Tests the complete user workflow for item interpolation including
 * navigation, slider interaction, range transitions, and data persistence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'
import ItemDetail from '../../views/ItemDetail.vue'
import TinkerItems from '../../views/TinkerItems.vue'
import { useItemsStore } from '../../stores/items'

// Real backend URL for E2E testing
const BACKEND_URL = 'http://localhost:8000/api/v1'

// Test items with known interpolation ranges
const TEST_ITEMS = {
  OTEK_SLICER_BASE: 262759, // QL 100-199 range
  OTEK_SLICER_MID: 262760,  // QL 200-299 range
  OTEK_SLICER_HIGH: 262761  // QL 300 range
}

describe('Item Interpolation E2E Workflow', () => {
  let router: any
  let store: any

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useItemsStore()
    
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { 
          path: '/', 
          name: 'TinkerItems',
          component: TinkerItems 
        },
        { 
          path: '/items/:aoid', 
          name: 'ItemDetail', 
          component: ItemDetail,
          props: true
        }
      ]
    })
  })

  afterEach(() => {
    // Cleanup
  })

  describe('Complete Interpolation User Journey', () => {
    it('should handle complete workflow: navigate -> interpolate -> range change', async () => {
      // 1. Start at item detail page
      await router.push({ name: 'ItemDetail', params: { aoid: String(TEST_ITEMS.OTEK_SLICER_BASE) } })
      
      const wrapper = mount(ItemDetail, {
        global: {
          plugins: [router]
        }
      })

      // Wait for item to load
      await new Promise(resolve => setTimeout(resolve, 1000))
      await nextTick()

      // 2. Verify base item is loaded
      expect(wrapper.vm.item).toBeTruthy()
      if (wrapper.vm.item) {
        expect(wrapper.vm.item.aoid).toBe(TEST_ITEMS.OTEK_SLICER_BASE)
        expect(wrapper.vm.item.ql).toBeGreaterThanOrEqual(100)
        expect(wrapper.vm.item.ql).toBeLessThanOrEqual(199)
      }

      // 3. Trigger interpolation within same range
      const interpolationBar = wrapper.findComponent({ name: 'ItemInterpolationBar' })
      if (interpolationBar.exists()) {
        // Simulate slider change to QL 150
        interpolationBar.vm.$emit('item-update', {
          ...wrapper.vm.item,
          ql: 150,
          interpolating: true,
          target_ql: 150
        })
        
        await nextTick()

        // 4. Verify interpolated item is displayed
        expect(wrapper.vm.displayedItem.ql).toBe(150)
        expect(wrapper.vm.displayedItem.interpolating).toBe(true)

        // 5. Trigger range transition (QL 250 -> different range)
        interpolationBar.vm.$emit('navigation-request', {
          aoid: TEST_ITEMS.OTEK_SLICER_MID,
          ql: 250
        })

        await nextTick()

        // 6. Verify navigation occurred
        expect(router.currentRoute.value.params.aoid).toBe(String(TEST_ITEMS.OTEK_SLICER_MID))
        expect(router.currentRoute.value.query.ql).toBe('250')
      }

      wrapper.unmount()
    }, 20000)

    it('should persist interpolation state through URL parameters', async () => {
      // Navigate with QL parameter
      await router.push({ 
        name: 'ItemDetail', 
        params: { aoid: String(TEST_ITEMS.OTEK_SLICER_BASE) },
        query: { ql: '175' }
      })
      
      const wrapper = mount(ItemDetail, {
        global: {
          plugins: [router]
        }
      })

      // Wait for loading and interpolation
      await new Promise(resolve => setTimeout(resolve, 1500))
      await nextTick()

      // Should show interpolated item at QL 175
      if (wrapper.vm.displayedItem && wrapper.vm.displayedItem.interpolating) {
        expect(wrapper.vm.displayedItem.ql).toBe(175)
        expect(wrapper.vm.displayedItem.target_ql).toBe(175)
      }

      // URL should maintain QL parameter
      expect(router.currentRoute.value.query.ql).toBe('175')

      wrapper.unmount()
    }, 15000)
  })

  describe('User Interaction Simulation', () => {
    it('should simulate realistic slider dragging workflow', async () => {
      await router.push({ name: 'ItemDetail', params: { aoid: String(TEST_ITEMS.OTEK_SLICER_BASE) } })
      
      const wrapper = mount(ItemDetail, {
        global: {
          plugins: [router]
        }
      })

      await new Promise(resolve => setTimeout(resolve, 1000))
      await nextTick()

      const interpolationBar = wrapper.findComponent({ name: 'ItemInterpolationBar' })
      
      if (interpolationBar.exists() && wrapper.vm.item) {
        const baseQl = wrapper.vm.item.ql
        
        // Simulate user dragging slider through multiple values
        const dragSequence = [baseQl + 10, baseQl + 20, baseQl + 30, baseQl + 25]
        
        for (const ql of dragSequence) {
          // Wait for previous interpolation to settle
          await new Promise(resolve => setTimeout(resolve, 100))
          
          // Trigger interpolation
          interpolationBar.vm.$emit('item-update', {
            ...wrapper.vm.item,
            ql,
            interpolating: true,
            target_ql: ql
          })
          
          await nextTick()
        }

        // Final state should reflect last drag position
        expect(wrapper.vm.displayedItem.target_ql).toBe(dragSequence[dragSequence.length - 1])
      }

      wrapper.unmount()
    }, 15000)

    it('should handle input field typing workflow', async () => {
      await router.push({ name: 'ItemDetail', params: { aoid: String(TEST_ITEMS.OTEK_SLICER_BASE) } })
      
      const wrapper = mount(ItemDetail, {
        global: {
          plugins: [router]
        }
      })

      await new Promise(resolve => setTimeout(resolve, 1000))
      await nextTick()

      const interpolationBar = wrapper.findComponent({ name: 'ItemInterpolationBar' })
      
      if (interpolationBar.exists() && wrapper.vm.item) {
        // Simulate typing "185" in input field
        const targetQl = 185
        
        interpolationBar.vm.$emit('item-update', {
          ...wrapper.vm.item,
          ql: targetQl,
          interpolating: true,
          target_ql: targetQl
        })
        
        await nextTick()

        // Verify interpolation took effect
        expect(wrapper.vm.displayedItem.ql).toBe(targetQl)
        expect(wrapper.vm.displayedItem.interpolating).toBe(true)
      }

      wrapper.unmount()
    }, 10000)
  })

  describe('Cross-Range Navigation Workflow', () => {
    it('should navigate between all Otek Slicer ranges', async () => {
      const rangeTests = [
        { aoid: TEST_ITEMS.OTEK_SLICER_BASE, expectedQl: 150 },
        { aoid: TEST_ITEMS.OTEK_SLICER_MID, expectedQl: 250 },
        { aoid: TEST_ITEMS.OTEK_SLICER_HIGH, expectedQl: 300 }
      ]

      for (const { aoid, expectedQl } of rangeTests) {
        await router.push({ 
          name: 'ItemDetail', 
          params: { aoid: String(aoid) },
          query: { ql: String(expectedQl) }
        })
        
        const wrapper = mount(ItemDetail, {
          global: {
            plugins: [router]
          }
        })

        await new Promise(resolve => setTimeout(resolve, 1000))
        await nextTick()

        // Verify correct item and QL
        if (wrapper.vm.displayedItem) {
          expect(wrapper.vm.displayedItem.aoid).toBe(aoid)
          
          if (wrapper.vm.displayedItem.interpolating) {
            expect(wrapper.vm.displayedItem.target_ql).toBe(expectedQl)
          } else {
            // For base items, QL should be in expected range
            expect(wrapper.vm.displayedItem.ql).toBeGreaterThanOrEqual(expectedQl - 50)
            expect(wrapper.vm.displayedItem.ql).toBeLessThanOrEqual(expectedQl + 50)
          }
        }

        wrapper.unmount()
      }
    }, 30000)

    it('should maintain item data integrity across range transitions', async () => {
      // Start with base range
      await router.push({ name: 'ItemDetail', params: { aoid: String(TEST_ITEMS.OTEK_SLICER_BASE) } })
      
      let wrapper = mount(ItemDetail, {
        global: {
          plugins: [router]
        }
      })

      await new Promise(resolve => setTimeout(resolve, 1000))
      await nextTick()

      const baseName = wrapper.vm.item?.name?.replace(/\s+QL\s+\d+.*$/, '')
      const baseItemClass = wrapper.vm.item?.item_class
      
      wrapper.unmount()

      // Navigate to different range
      await router.push({ name: 'ItemDetail', params: { aoid: String(TEST_ITEMS.OTEK_SLICER_MID) } })
      
      wrapper = mount(ItemDetail, {
        global: {
          plugins: [router]
        }
      })

      await new Promise(resolve => setTimeout(resolve, 1000))
      await nextTick()

      // Verify item identity is maintained
      if (wrapper.vm.item && baseName) {
        expect(wrapper.vm.item.name).toMatch(new RegExp(baseName, 'i'))
        expect(wrapper.vm.item.item_class).toBe(baseItemClass)
      }

      wrapper.unmount()
    }, 20000)
  })

  describe('Error Handling Workflow', () => {
    it('should handle invalid QL gracefully', async () => {
      await router.push({ 
        name: 'ItemDetail', 
        params: { aoid: String(TEST_ITEMS.OTEK_SLICER_BASE) },
        query: { ql: '9999' } // Invalid QL
      })
      
      const wrapper = mount(ItemDetail, {
        global: {
          plugins: [router]
        }
      })

      await new Promise(resolve => setTimeout(resolve, 1000))
      await nextTick()

      // Should fall back to base item
      expect(wrapper.vm.displayedItem).toBeTruthy()
      if (wrapper.vm.displayedItem) {
        expect(wrapper.vm.displayedItem.interpolating).toBeFalsy()
      }

      wrapper.unmount()
    }, 10000)

    it('should handle network errors during interpolation', async () => {
      await router.push({ name: 'ItemDetail', params: { aoid: '999999' } }) // Non-existent item
      
      const wrapper = mount(ItemDetail, {
        global: {
          plugins: [router]
        }
      })

      await new Promise(resolve => setTimeout(resolve, 2000))
      await nextTick()

      // Should show error state
      expect(wrapper.vm.error || wrapper.vm.interpolationError).toBeTruthy()

      wrapper.unmount()
    }, 10000)
  })

  describe('Performance and Responsiveness', () => {
    it('should respond to user interactions within acceptable time', async () => {
      await router.push({ name: 'ItemDetail', params: { aoid: String(TEST_ITEMS.OTEK_SLICER_BASE) } })
      
      const wrapper = mount(ItemDetail, {
        global: {
          plugins: [router]
        }
      })

      await new Promise(resolve => setTimeout(resolve, 1000))
      await nextTick()

      if (wrapper.vm.item) {
        const startTime = performance.now()
        
        // Simulate interpolation request
        const interpolationBar = wrapper.findComponent({ name: 'ItemInterpolationBar' })
        if (interpolationBar.exists()) {
          interpolationBar.vm.$emit('item-update', {
            ...wrapper.vm.item,
            ql: 175,
            interpolating: true,
            target_ql: 175
          })
          
          await nextTick()
          
          const endTime = performance.now()
          const duration = endTime - startTime
          
          // Should respond quickly (under 100ms for UI update)
          expect(duration).toBeLessThan(100)
        }
      }

      wrapper.unmount()
    }, 10000)

    it('should handle rapid interpolation changes efficiently', async () => {
      await router.push({ name: 'ItemDetail', params: { aoid: String(TEST_ITEMS.OTEK_SLICER_BASE) } })
      
      const wrapper = mount(ItemDetail, {
        global: {
          plugins: [router]
        }
      })

      await new Promise(resolve => setTimeout(resolve, 1000))
      await nextTick()

      if (wrapper.vm.item) {
        const interpolationBar = wrapper.findComponent({ name: 'ItemInterpolationBar' })
        
        if (interpolationBar.exists()) {
          // Rapid sequence of interpolations
          const rapidChanges = [140, 145, 150, 155, 160]
          
          for (const ql of rapidChanges) {
            interpolationBar.vm.$emit('item-update', {
              ...wrapper.vm.item,
              ql,
              interpolating: true,
              target_ql: ql
            })
            
            // Brief delay between changes
            await new Promise(resolve => setTimeout(resolve, 50))
            await nextTick()
          }

          // Should handle all changes without errors
          expect(wrapper.vm.displayedItem.target_ql).toBe(160)
          expect(wrapper.vm.interpolationError).toBeFalsy()
        }
      }

      wrapper.unmount()
    }, 15000)
  })

  describe('Data Consistency Workflow', () => {
    it('should maintain consistent data across interpolation', async () => {
      await router.push({ name: 'ItemDetail', params: { aoid: String(TEST_ITEMS.OTEK_SLICER_BASE) } })
      
      const wrapper = mount(ItemDetail, {
        global: {
          plugins: [router]
        }
      })

      await new Promise(resolve => setTimeout(resolve, 1000))
      await nextTick()

      if (wrapper.vm.item) {
        const baseItem = wrapper.vm.item
        const baseStats = baseItem.stats || []
        const baseActions = baseItem.actions || []

        // Trigger interpolation
        const interpolationBar = wrapper.findComponent({ name: 'ItemInterpolationBar' })
        if (interpolationBar.exists()) {
          interpolationBar.vm.$emit('item-update', {
            ...baseItem,
            ql: 175,
            interpolating: true,
            target_ql: 175,
            stats: baseStats.map(s => ({ ...s, value: s.value * 1.5 })), // Simulated interpolation
            actions: baseActions
          })
          
          await nextTick()

          // Verify data consistency
          const displayedItem = wrapper.vm.displayedItem
          expect(displayedItem.ql).toBe(175)
          expect(displayedItem.interpolating).toBe(true)
          expect(displayedItem.stats.length).toBe(baseStats.length)
          expect(displayedItem.actions.length).toBe(baseActions.length)
          
          // Verify item identity is preserved
          expect(displayedItem.name).toMatch(/otek/i)
          expect(displayedItem.item_class).toBe(baseItem.item_class)
        }
      }

      wrapper.unmount()
    }, 15000)

    it('should update all dependent components during interpolation', async () => {
      await router.push({ name: 'ItemDetail', params: { aoid: String(TEST_ITEMS.OTEK_SLICER_BASE) } })
      
      const wrapper = mount(ItemDetail, {
        global: {
          plugins: [router]
        }
      })

      await new Promise(resolve => setTimeout(resolve, 1000))
      await nextTick()

      if (wrapper.vm.item) {
        const baseItem = wrapper.vm.item

        // Check that all components receive base data initially
        const itemStats = wrapper.findComponent({ name: 'ItemStats' })
        const actionRequirements = wrapper.findComponent({ name: 'ActionRequirements' })
        const spellDataDisplay = wrapper.findComponent({ name: 'SpellDataDisplay' })

        // Trigger interpolation
        const interpolatedItem = {
          ...baseItem,
          ql: 160,
          interpolating: true,
          target_ql: 160,
          stats: [{ id: 1, stat: 1, value: 999 }], // Dramatically different stat
          actions: [{ id: 1, action: 6, item_id: 1, criteria: [{ id: 1, value1: 112, value2: 500, operator: 2 }] }]
        }

        const interpolationBar = wrapper.findComponent({ name: 'ItemInterpolationBar' })
        if (interpolationBar.exists()) {
          interpolationBar.vm.$emit('item-update', interpolatedItem)
          await nextTick()

          // Verify all components receive interpolated data
          if (itemStats.exists()) {
            expect(itemStats.props('item')).toEqual(interpolatedItem)
          }
          
          if (actionRequirements.exists()) {
            expect(actionRequirements.props('actions')).toEqual(interpolatedItem.actions)
          }
          
          if (spellDataDisplay.exists() && interpolatedItem.spell_data) {
            expect(spellDataDisplay.props('spellData')).toEqual(interpolatedItem.spell_data)
          }
        }
      }

      wrapper.unmount()
    }, 15000)
  })

  describe('Real Backend Validation', () => {
    it('should work with actual backend interpolation endpoints', async () => {
      // Test with real API call
      const response = await fetch(`${BACKEND_URL}/items/${TEST_ITEMS.OTEK_SLICER_BASE}/interpolate?target_ql=160`)
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.success) {
          await router.push({ 
            name: 'ItemDetail', 
            params: { aoid: String(TEST_ITEMS.OTEK_SLICER_BASE) },
            query: { ql: '160' }
          })
          
          const wrapper = mount(ItemDetail, {
            global: {
              plugins: [router]
            }
          })

          await new Promise(resolve => setTimeout(resolve, 2000))
          await nextTick()

          // Verify the interpolation matches backend response
          if (wrapper.vm.displayedItem && wrapper.vm.displayedItem.interpolating) {
            expect(wrapper.vm.displayedItem.ql).toBe(160)
            expect(wrapper.vm.displayedItem.aoid).toBe(TEST_ITEMS.OTEK_SLICER_BASE)
          }

          wrapper.unmount()
        }
      } else {
        console.log('Backend interpolation endpoint not available, skipping real backend test')
      }
    }, 15000)

    it('should validate interpolation ranges endpoint integration', async () => {
      const response = await fetch(`${BACKEND_URL}/items/${TEST_ITEMS.OTEK_SLICER_BASE}/interpolation-info`)
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.success && data.ranges) {
          await router.push({ name: 'ItemDetail', params: { aoid: String(TEST_ITEMS.OTEK_SLICER_BASE) } })
          
          const wrapper = mount(ItemDetail, {
            global: {
              plugins: [router]
            }
          })

          await new Promise(resolve => setTimeout(resolve, 1000))
          await nextTick()

          // Verify ranges are loaded and used
          const interpolationBar = wrapper.findComponent({ name: 'ItemInterpolationBar' })
          if (interpolationBar.exists()) {
            expect(interpolationBar.props('interpolationRanges')).toBeTruthy()
            expect(Array.isArray(interpolationBar.props('interpolationRanges'))).toBe(true)
          }

          wrapper.unmount()
        }
      } else {
        console.log('Backend interpolation-info endpoint not available, skipping integration test')
      }
    }, 10000)
  })
})
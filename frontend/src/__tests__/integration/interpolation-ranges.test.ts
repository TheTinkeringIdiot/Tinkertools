/**
 * Interpolation Range Transition Tests
 *
 * TRUE INTEGRATION TEST - Requires real backend
 * Tests multi-range item interpolation and navigation between
 * different base items using real backend data
 *
 * Strategy: Skip when backend not available (Option B)
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import ItemDetail from '../../views/ItemDetail.vue'
import { useItemsStore } from '../../stores/items'
import { apiClient } from '../../services/api-client'
import { isBackendAvailable, getBackendUrl } from '../helpers/backend-check'

// Real backend URL for integration testing
const BACKEND_URL = getBackendUrl() + '/api/v1'

// Check backend availability before running tests
let BACKEND_AVAILABLE = false

beforeAll(async () => {
  BACKEND_AVAILABLE = await isBackendAvailable()
  if (!BACKEND_AVAILABLE) {
    console.warn('Backend not available - skipping interpolation range tests')
  }
})

// Known multi-range items for testing
const TEST_ITEMS = {
  OTEK_SLICER: {
    ranges: [
      { aoid: 262759, min_ql: 100, max_ql: 199, name: 'Otek Slicer QL 100-199' },
      { aoid: 262760, min_ql: 200, max_ql: 299, name: 'Otek Slicer QL 200-299' },
      { aoid: 262761, min_ql: 300, max_ql: 300, name: 'Otek Slicer QL 300' }
    ]
  }
}

describe.skipIf(!BACKEND_AVAILABLE)('Interpolation Range Transitions', () => {
  let router: any
  let store: any

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useItemsStore()

    router = createRouter({
      history: createWebHistory(),
      routes: [
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

  describe('Multi-Range Item Detection', () => {
    it('should detect multiple ranges for Otek Slicer', async () => {
      const response = await fetch(`${BACKEND_URL}/items/${TEST_ITEMS.OTEK_SLICER.ranges[0].aoid}/interpolation-info`)
      
      expect(response.ok).toBe(true)
      const data = await response.json()
      
      expect(data.success).toBe(true)
      expect(Array.isArray(data.ranges)).toBe(true)
      expect(data.ranges.length).toBeGreaterThan(1)
      
      // Verify we have the expected ranges
      const ranges = data.ranges.sort((a: any, b: any) => a.min_ql - b.min_ql)
      
      expect(ranges[0].min_ql).toBe(100)
      expect(ranges[0].max_ql).toBe(199)
      expect(ranges[1].min_ql).toBe(200)
      expect(ranges[1].max_ql).toBe(299)
      
      console.log('Detected ranges:', ranges.map((r: any) => 
        `QL ${r.min_ql}-${r.max_ql} (AOID: ${r.base_aoid})`
      ))
    }, 10000)

    it('should have correct base_aoid for each range', async () => {
      for (const range of TEST_ITEMS.OTEK_SLICER.ranges) {
        const response = await fetch(`${BACKEND_URL}/items/${range.aoid}`)
        
        expect(response.ok).toBe(true)
        const item = await response.json()
        
        expect(item.aoid).toBe(range.aoid)
        expect(item.ql).toBeGreaterThanOrEqual(range.min_ql)
        expect(item.ql).toBeLessThanOrEqual(range.max_ql)
        
        console.log(`Range ${range.min_ql}-${range.max_ql}: ${item.name} (QL ${item.ql})`)
      }
    }, 15000)
  })

  describe('Range Boundary Testing', () => {
    it('should interpolate correctly at range boundaries', async () => {
      const testCases = [
        { aoid: 262759, ql: 199 }, // Top of first range
        { aoid: 262760, ql: 200 }, // Bottom of second range
        { aoid: 262760, ql: 299 }, // Top of second range
        { aoid: 262761, ql: 300 }  // Third range (single QL)
      ]

      for (const { aoid, ql } of testCases) {
        const response = await fetch(`${BACKEND_URL}/items/${aoid}/interpolate?target_ql=${ql}`)
        
        expect(response.ok).toBe(true)
        const data = await response.json()
        
        expect(data.success).toBe(true)
        expect(data.item.ql).toBe(ql)
        expect(data.item.aoid).toBe(aoid)
        
        console.log(`Boundary test: ${data.item.name} QL ${ql} ✓`)
      }
    }, 20000)

    it('should reject interpolation outside valid ranges', async () => {
      // Test QLs outside any valid range
      const invalidQls = [50, 99, 301, 500] // Below min, gap between ranges, above max
      
      for (const ql of invalidQls) {
        const response = await fetch(`${BACKEND_URL}/items/262759/interpolate?target_ql=${ql}`)
        
        // Should return error for invalid QL
        expect(response.ok).toBe(false)
        
        console.log(`Invalid QL ${ql} correctly rejected`)
      }
    }, 15000)
  })

  describe('Cross-Range Item Properties', () => {
    it('should maintain item identity across ranges', async () => {
      const ranges = TEST_ITEMS.OTEK_SLICER.ranges
      const itemProperties: any[] = []

      // Get base properties from each range
      for (const range of ranges) {
        const response = await fetch(`${BACKEND_URL}/items/${range.aoid}`)
        expect(response.ok).toBe(true)
        
        const item = await response.json()
        itemProperties.push({
          aoid: item.aoid,
          name: item.name,
          description: item.description,
          item_class: item.item_class,
          is_nano: item.is_nano
        })
      }

      // Verify core properties are consistent (should be same item, different QLs)
      const baseName = itemProperties[0].name.replace(/\s+QL\s+\d+.*$/, '').trim()
      
      itemProperties.forEach(props => {
        expect(props.name).toMatch(new RegExp(baseName, 'i'))
        expect(props.item_class).toBe(itemProperties[0].item_class)
        expect(props.is_nano).toBe(itemProperties[0].is_nano)
      })

      console.log('Cross-range consistency verified:', {
        baseName,
        ranges: itemProperties.length,
        itemClass: itemProperties[0].item_class
      })
    }, 15000)

    it('should have different stat values across ranges', async () => {
      // Compare stats between different range base items
      const responses = await Promise.all(
        TEST_ITEMS.OTEK_SLICER.ranges.slice(0, 2).map(range => 
          fetch(`${BACKEND_URL}/items/${range.aoid}`)
        )
      )

      expect(responses.every(r => r.ok)).toBe(true)
      
      const [item1, item2] = await Promise.all(
        responses.map(r => r.json())
      )

      // Stats should be different between different QL ranges
      if (item1.stats && item2.stats && item1.stats.length > 0 && item2.stats.length > 0) {
        const stat1 = item1.stats.find((s: any) => s.stat === item2.stats[0].stat)
        const stat2 = item2.stats[0]
        
        if (stat1) {
          expect(stat1.value).not.toBe(stat2.value)
          console.log('Stat progression verified:', {
            stat: stat1.stat,
            ql1: item1.ql,
            value1: stat1.value,
            ql2: item2.ql,
            value2: stat2.value
          })
        }
      }
    }, 15000)
  })

  describe('Interpolation Within Ranges', () => {
    it('should interpolate stats correctly within a range', async () => {
      const baseAoid = 262759 // 100-199 range
      const baseQl = 100
      const targetQl = 150
      
      // Get base item stats
      const baseResponse = await fetch(`${BACKEND_URL}/items/${baseAoid}`)
      expect(baseResponse.ok).toBe(true)
      const baseItem = await baseResponse.json()
      
      // Get interpolated item stats
      const interpResponse = await fetch(`${BACKEND_URL}/items/${baseAoid}/interpolate?target_ql=${targetQl}`)
      expect(interpResponse.ok).toBe(true)
      const interpData = await interpResponse.json()
      
      expect(interpData.success).toBe(true)
      const interpolatedItem = interpData.item
      
      // Compare stats - they should be proportionally increased
      if (baseItem.stats && interpolatedItem.stats) {
        const baseStatMap = new Map(baseItem.stats.map((s: any) => [s.stat, s.value]))
        const interpStatMap = new Map(interpolatedItem.stats.map((s: any) => [s.stat, s.value]))
        
        // Find a stat that should interpolate
        const testStatId = Array.from(baseStatMap.keys())[0]
        const baseStat = baseStatMap.get(testStatId)
        const interpStat = interpStatMap.get(testStatId)
        
        if (baseStat && interpStat) {
          // Interpolated stat should be higher than base (since we're going from 100 to 150)
          expect(interpStat).toBeGreaterThan(baseStat)
          
          console.log('Stat interpolation verified:', {
            stat: testStatId,
            baseValue: baseStat,
            interpValue: interpStat,
            qlIncrease: targetQl - baseQl
          })
        }
      }
    }, 10000)

    it('should interpolate requirements correctly within a range', async () => {
      const baseAoid = 262759
      const targetQl = 175
      
      // Get interpolated item
      const response = await fetch(`${BACKEND_URL}/items/${baseAoid}/interpolate?target_ql=${targetQl}`)
      expect(response.ok).toBe(true)
      const data = await response.json()
      
      expect(data.success).toBe(true)
      const interpolatedItem = data.item
      
      // Verify requirements are present and interpolated
      if (interpolatedItem.actions) {
        const actionsWithRequirements = interpolatedItem.actions.filter((a: any) => 
          a.criteria && a.criteria.length > 0
        )
        
        expect(actionsWithRequirements.length).toBeGreaterThan(0)
        
        actionsWithRequirements.forEach((action: any) => {
          action.criteria.forEach((criterion: any) => {
            expect(criterion).toHaveProperty('value2')
            expect(typeof criterion.value2).toBe('number')
            expect(criterion.value2).toBeGreaterThan(0)
          })
        })
        
        console.log('Requirements verified:', {
          actionsWithReq: actionsWithRequirements.length,
          totalCriteria: actionsWithRequirements.reduce((sum: number, a: any) => sum + a.criteria.length, 0)
        })
      }
    }, 10000)
  })

  describe('Range Navigation Logic', () => {
    it('should identify correct target range for any QL', async () => {
      // Get ranges for Otek Slicer
      const response = await fetch(`${BACKEND_URL}/items/262759/interpolation-info`)
      expect(response.ok).toBe(true)
      const data = await response.json()
      
      const ranges = data.ranges.sort((a: any, b: any) => a.min_ql - b.min_ql)
      
      // Test various QLs and verify they map to correct ranges
      const testCases = [
        { ql: 150, expectedRangeIndex: 0 }, // Should be in 100-199
        { ql: 250, expectedRangeIndex: 1 }, // Should be in 200-299
        { ql: 300, expectedRangeIndex: 2 }  // Should be in 300-300
      ]
      
      testCases.forEach(({ ql, expectedRangeIndex }) => {
        const targetRange = ranges.find((r: any) => ql >= r.min_ql && ql <= r.max_ql)
        expect(targetRange).toBeDefined()
        expect(ranges.indexOf(targetRange)).toBe(expectedRangeIndex)
        
        console.log(`QL ${ql} maps to range ${targetRange.min_ql}-${targetRange.max_ql} (AOID: ${targetRange.base_aoid})`)
      })
    }, 10000)

    it('should validate that each range has unique AOID', async () => {
      const response = await fetch(`${BACKEND_URL}/items/262759/interpolation-info`)
      expect(response.ok).toBe(true)
      const data = await response.json()
      
      const aoids = data.ranges.map((r: any) => r.base_aoid)
      const uniqueAoids = new Set(aoids)
      
      expect(uniqueAoids.size).toBe(aoids.length) // All AOIDs should be unique
      
      console.log('Range AOIDs verified unique:', Array.from(uniqueAoids))
    }, 10000)
  })

  describe('Cross-Range Consistency', () => {
    it('should maintain spell effects across ranges', async () => {
      const ranges = TEST_ITEMS.OTEK_SLICER.ranges.slice(0, 2) // Test first two ranges
      const spellDataSets: any[] = []

      for (const range of ranges) {
        const response = await fetch(`${BACKEND_URL}/items/${range.aoid}`)
        expect(response.ok).toBe(true)
        const item = await response.json()
        
        if (item.spell_data) {
          spellDataSets.push({
            aoid: range.aoid,
            ql: item.ql,
            spellData: item.spell_data
          })
        }
      }

      // If any ranges have spell data, verify structure consistency
      if (spellDataSets.length > 1) {
        const baseStructure = spellDataSets[0].spellData
        
        spellDataSets.slice(1).forEach(({ aoid, ql, spellData }) => {
          expect(spellData.length).toBe(baseStructure.length)
          
          // Each spell event should have same structure but potentially different values
          spellData.forEach((spellEvent: any, index: number) => {
            expect(spellEvent.event).toBe(baseStructure[index].event)
            expect(Array.isArray(spellEvent.spells)).toBe(true)
          })
        })
        
        console.log('Spell data consistency verified across ranges')
      }
    }, 15000)

    it('should maintain action types across ranges', async () => {
      const ranges = TEST_ITEMS.OTEK_SLICER.ranges.slice(0, 2)
      const actionSets: any[] = []

      for (const range of ranges) {
        const response = await fetch(`${BACKEND_URL}/items/${range.aoid}`)
        expect(response.ok).toBe(true)
        const item = await response.json()
        
        if (item.actions) {
          actionSets.push({
            aoid: range.aoid,
            ql: item.ql,
            actions: item.actions
          })
        }
      }

      // Verify action consistency across ranges
      if (actionSets.length > 1) {
        const baseActions = actionSets[0].actions
        const actionTypes = baseActions.map((a: any) => a.action).sort()
        
        actionSets.slice(1).forEach(({ aoid, ql, actions }) => {
          const rangeActionTypes = actions.map((a: any) => a.action).sort()
          expect(rangeActionTypes).toEqual(actionTypes)
        })
        
        console.log('Action types consistent across ranges:', actionTypes)
      }
    }, 15000)
  })

  describe('Performance Testing', () => {
    it('should retrieve interpolation info quickly', async () => {
      const startTime = performance.now()
      
      const response = await fetch(`${BACKEND_URL}/items/262759/interpolation-info`)
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(response.ok).toBe(true)
      expect(duration).toBeLessThan(1000) // Should be under 1 second
      
      console.log(`Interpolation info retrieved in ${duration.toFixed(2)}ms`)
    }, 10000)

    it('should interpolate items efficiently', async () => {
      const startTime = performance.now()
      
      const response = await fetch(`${BACKEND_URL}/items/262759/interpolate?target_ql=150`)
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(response.ok).toBe(true)
      expect(duration).toBeLessThan(2000) // Should be under 2 seconds
      
      console.log(`Item interpolation completed in ${duration.toFixed(2)}ms`)
    }, 10000)
  })

  describe('Edge Case Testing', () => {
    it('should handle interpolation at exact base QLs', async () => {
      // Test interpolating to the exact QL of base items
      const testCases = [
        { aoid: 262759, ql: 100 }, // Exact base QL
        { aoid: 262760, ql: 200 }, // Exact base QL of next range
      ]

      for (const { aoid, ql } of testCases) {
        const response = await fetch(`${BACKEND_URL}/items/${aoid}/interpolate?target_ql=${ql}`)
        
        expect(response.ok).toBe(true)
        const data = await response.json()
        
        expect(data.success).toBe(true)
        expect(data.item.ql).toBe(ql)
        
        // Should still be marked as interpolating even at base QL
        expect(data.item.interpolating).toBe(true)
      }
    }, 15000)

    it('should handle non-interpolatable items gracefully', async () => {
      // Test with an item that's not interpolatable (like a nano)
      const nanoParams = new URLSearchParams({
        q: 'nano',
        is_nano: 'true',
        page_size: '1'
      })
      
      const searchResponse = await fetch(`${BACKEND_URL}/items/search?${nanoParams}`)
      expect(searchResponse.ok).toBe(true)
      const searchData = await searchResponse.json()
      
      if (searchData.items.length > 0) {
        const nanoAoid = searchData.items[0].aoid
        
        const interpResponse = await fetch(`${BACKEND_URL}/items/${nanoAoid}/interpolate?target_ql=200`)
        
        // Should return error for non-interpolatable items
        expect(interpResponse.ok).toBe(false)
        
        console.log('Non-interpolatable item correctly rejected:', searchData.items[0].name)
      }
    }, 10000)
  })
})
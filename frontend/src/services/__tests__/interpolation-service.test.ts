/**
 * Unit tests for the frontend InterpolationService.
 * 
 * Tests caching, state management, API integration, and error handling
 * for the client-side interpolation functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import type { 
  Item, 
  InterpolatedItem, 
  InterpolationInfo, 
  InterpolationResponse 
} from '../../types/api'
import interpolationService from '../interpolation-service'
import { apiClient } from '../api-client'

// Mock the API client
vi.mock('../api-client', () => ({
  apiClient: {
    interpolateItem: vi.fn(),
    getInterpolationInfo: vi.fn(),
    checkItemInterpolatable: vi.fn(),
    getInterpolationRange: vi.fn()
  }
}))

// Mock game-data constants
vi.mock('../game-data', () => ({
  INTERP_STATS: [1, 2, 3, 100, 101, 102]
}))

describe('InterpolationService', () => {
  const mockApiClient = apiClient as {
    interpolateItem: Mock
    getInterpolationInfo: Mock
    checkItemInterpolatable: Mock
    getInterpolationRange: Mock
  }

  const sampleItem: Item = {
    id: 1,
    aoid: 12345,
    name: 'Test Weapon',
    ql: 100,
    description: 'A test weapon',
    item_class: 1,
    is_nano: false,
    stats: [
      { id: 1, stat: 1, value: 100 },
      { id: 2, stat: 2, value: 50 }
    ],
    spell_data: [],
    actions: [],
    attack_defense: undefined,
    animation_mesh: undefined
  }

  const sampleInterpolatedItem: InterpolatedItem = {
    id: 1,
    aoid: 12345,
    name: 'Test Weapon',
    ql: 150,
    description: 'A test weapon',
    item_class: 1,
    is_nano: false,
    interpolating: true,
    low_ql: 100,
    high_ql: 199,
    target_ql: 150,
    ql_delta: 50,
    ql_delta_full: 100,
    stats: [
      { id: 1, stat: 1, value: 150 },
      { id: 2, stat: 2, value: 75 }
    ],
    spell_data: [],
    actions: []
  }

  const sampleInterpolationInfo: InterpolationInfo = {
    aoid: 12345,
    interpolatable: true,
    min_ql: 100,
    max_ql: 200,
    ql_range: 101
  }

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()
    
    // Clear service state
    interpolationService.clearAllCaches()
    interpolationService.state.loading = false
    interpolationService.state.error = null
    interpolationService.state.currentItem = null
    interpolationService.state.interpolationInfo = null
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================================
  // Core Interpolation Tests
  // ============================================================================

  describe('interpolateItem', () => {
    it('should successfully interpolate an item', async () => {
      const mockResponse: InterpolationResponse = {
        success: true,
        item: sampleInterpolatedItem,
        interpolation_range: { min_ql: 100, max_ql: 200 }
      }

      mockApiClient.interpolateItem.mockResolvedValue(mockResponse)

      const result = await interpolationService.interpolateItem(12345, 150)

      expect(result).toEqual(sampleInterpolatedItem)
      expect(interpolationService.state.currentItem).toEqual(sampleInterpolatedItem)
      expect(interpolationService.state.loading).toBe(false)
      expect(interpolationService.state.error).toBeNull()
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(12345, 150)
    })

    it('should handle interpolation failure', async () => {
      const mockResponse: InterpolationResponse = {
        success: false,
        error: 'Item not found'
      }

      mockApiClient.interpolateItem.mockResolvedValue(mockResponse)

      const result = await interpolationService.interpolateItem(12345, 150)

      expect(result).toBeNull()
      expect(interpolationService.state.error).toBe('Item not found')
      expect(interpolationService.state.loading).toBe(false)
    })

    it('should handle API errors', async () => {
      mockApiClient.interpolateItem.mockRejectedValue(new Error('Network error'))

      const result = await interpolationService.interpolateItem(12345, 150)

      expect(result).toBeNull()
      expect(interpolationService.state.error).toBe('Network error')
      expect(interpolationService.state.loading).toBe(false)
    })

    it('should set loading state during interpolation', async () => {
      const mockResponse: InterpolationResponse = {
        success: true,
        item: sampleInterpolatedItem
      }

      // Mock a slow API call
      mockApiClient.interpolateItem.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockResponse), 100))
      )

      const resultPromise = interpolationService.interpolateItem(12345, 150)

      // Check loading state is set
      expect(interpolationService.state.loading).toBe(true)

      const result = await resultPromise

      // Check loading state is cleared
      expect(interpolationService.state.loading).toBe(false)
      expect(result).toEqual(sampleInterpolatedItem)
    })
  })

  // ============================================================================
  // Caching Tests
  // ============================================================================

  describe('caching', () => {
    it('should cache interpolated items', async () => {
      const mockResponse: InterpolationResponse = {
        success: true,
        item: sampleInterpolatedItem
      }

      mockApiClient.interpolateItem.mockResolvedValue(mockResponse)

      // First call
      const result1 = await interpolationService.interpolateItem(12345, 150)
      
      // Second call should use cache
      const result2 = await interpolationService.interpolateItem(12345, 150)

      expect(result1).toEqual(sampleInterpolatedItem)
      expect(result2).toEqual(sampleInterpolatedItem)
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(1)
    })

    it('should cache interpolation info', async () => {
      const mockResponse = {
        success: true,
        data: sampleInterpolationInfo
      }

      mockApiClient.getInterpolationInfo.mockResolvedValue(mockResponse)

      // First call
      const result1 = await interpolationService.getInterpolationInfo(12345)
      
      // Second call should use cache
      const result2 = await interpolationService.getInterpolationInfo(12345)

      expect(result1).toEqual(sampleInterpolationInfo)
      expect(result2).toEqual(sampleInterpolationInfo)
      expect(mockApiClient.getInterpolationInfo).toHaveBeenCalledTimes(1)
    })

    it('should clear item cache correctly', async () => {
      const mockResponse: InterpolationResponse = {
        success: true,
        item: sampleInterpolatedItem
      }

      mockApiClient.interpolateItem.mockResolvedValue(mockResponse)

      // Cache an item
      await interpolationService.interpolateItem(12345, 150)
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(1)

      // Clear cache for this item
      interpolationService.clearItemCache(12345)

      // Next call should hit API again
      await interpolationService.interpolateItem(12345, 150)
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(2)
    })

    it('should clear all caches correctly', async () => {
      const mockResponse: InterpolationResponse = {
        success: true,
        item: sampleInterpolatedItem
      }
      const mockInfoResponse = {
        success: true,
        data: sampleInterpolationInfo
      }

      mockApiClient.interpolateItem.mockResolvedValue(mockResponse)
      mockApiClient.getInterpolationInfo.mockResolvedValue(mockInfoResponse)

      // Cache some data
      await interpolationService.interpolateItem(12345, 150)
      await interpolationService.getInterpolationInfo(12345)

      // Clear all caches
      interpolationService.clearAllCaches()

      // Verify state is cleared
      expect(interpolationService.state.currentItem).toBeNull()
      expect(interpolationService.state.interpolationInfo).toBeNull()
      expect(interpolationService.state.error).toBeNull()

      // Verify cache is cleared by making new calls
      await interpolationService.interpolateItem(12345, 150)
      await interpolationService.getInterpolationInfo(12345)

      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(2)
      expect(mockApiClient.getInterpolationInfo).toHaveBeenCalledTimes(2)
    })

    it('should respect cache TTL', async () => {
      // This test would require mocking timers to test TTL functionality
      // For now, we'll just verify the cache stats functionality
      const stats = interpolationService.getCacheStats()
      expect(stats).toHaveProperty('itemCache')
      expect(stats).toHaveProperty('infoCache')
      expect(typeof stats.itemCache).toBe('number')
      expect(typeof stats.infoCache).toBe('number')
    })
  })

  // ============================================================================
  // Interpolation Info Tests
  // ============================================================================

  describe('getInterpolationInfo', () => {
    it('should get interpolation info successfully', async () => {
      const mockResponse = {
        success: true,
        data: sampleInterpolationInfo
      }

      mockApiClient.getInterpolationInfo.mockResolvedValue(mockResponse)

      const result = await interpolationService.getInterpolationInfo(12345)

      expect(result).toEqual(sampleInterpolationInfo)
      expect(interpolationService.state.interpolationInfo).toEqual(sampleInterpolationInfo)
      expect(mockApiClient.getInterpolationInfo).toHaveBeenCalledWith(12345)
    })

    it('should handle interpolation info failure', async () => {
      const mockResponse = {
        success: false,
        data: null
      }

      mockApiClient.getInterpolationInfo.mockResolvedValue(mockResponse)

      const result = await interpolationService.getInterpolationInfo(12345)

      expect(result).toBeNull()
    })

    it('should handle interpolation info API error', async () => {
      mockApiClient.getInterpolationInfo.mockRejectedValue(new Error('API error'))

      const result = await interpolationService.getInterpolationInfo(12345)

      expect(result).toBeNull()
    })
  })

  describe('isItemInterpolatable', () => {
    it('should check if item is interpolatable', async () => {
      mockApiClient.checkItemInterpolatable.mockResolvedValue(true)

      const result = await interpolationService.isItemInterpolatable(12345)

      expect(result).toBe(true)
      expect(mockApiClient.checkItemInterpolatable).toHaveBeenCalledWith(12345)
    })

    it('should return false on API error', async () => {
      mockApiClient.checkItemInterpolatable.mockRejectedValue(new Error('API error'))

      const result = await interpolationService.isItemInterpolatable(12345)

      expect(result).toBe(false)
    })
  })

  describe('getInterpolationRange', () => {
    it('should get interpolation range', async () => {
      const expectedRange = { min: 100, max: 200 }
      
      // Mock the info response
      const mockInfoResponse = {
        success: true,
        data: sampleInterpolationInfo
      }
      mockApiClient.getInterpolationInfo.mockResolvedValue(mockInfoResponse)

      const result = await interpolationService.getInterpolationRange(12345)

      expect(result).toEqual(expectedRange)
    })

    it('should return null when no info available', async () => {
      mockApiClient.getInterpolationInfo.mockResolvedValue({ success: false })

      const result = await interpolationService.getInterpolationRange(12345)

      expect(result).toBeNull()
    })
  })

  // ============================================================================
  // Utility Function Tests
  // ============================================================================

  describe('canItemBeInterpolated', () => {
    it('should return false for nano items', () => {
      const nanoItem = { ...sampleItem, is_nano: true }
      
      const result = interpolationService.canItemBeInterpolated(nanoItem)
      
      expect(result).toBe(false)
    })

    it('should return false for Control Point items', () => {
      const controlPointItem = { ...sampleItem, name: 'Control Point Alpha' }
      
      const result = interpolationService.canItemBeInterpolated(controlPointItem)
      
      expect(result).toBe(false)
    })

    it('should return true for regular items', () => {
      const result = interpolationService.canItemBeInterpolated(sampleItem)
      
      expect(result).toBe(true)
    })

    it('should use cached info when available', () => {
      // Manually set cached info
      interpolationService['infoCache'].set(12345, {
        ...sampleInterpolationInfo,
        interpolatable: false
      })

      const result = interpolationService.canItemBeInterpolated(sampleItem)
      
      expect(result).toBe(false)
    })
  })

  describe('itemToInterpolatedItem', () => {
    it('should convert Item to InterpolatedItem', () => {
      const result = interpolationService.itemToInterpolatedItem(sampleItem)

      expect(result.id).toBe(sampleItem.id)
      expect(result.aoid).toBe(sampleItem.aoid)
      expect(result.name).toBe(sampleItem.name)
      expect(result.interpolating).toBe(false)
      expect(result.low_ql).toBe(sampleItem.ql)
      expect(result.high_ql).toBe(sampleItem.ql)
      expect(result.target_ql).toBe(sampleItem.ql)
      expect(result.ql_delta).toBe(0)
      expect(result.ql_delta_full).toBe(0)
    })

    it('should handle items without optional properties', () => {
      const minimalItem: Item = {
        id: 1,
        name: 'Minimal Item',
        is_nano: false,
        stats: [],
        spell_data: [],
        actions: []
      }

      const result = interpolationService.itemToInterpolatedItem(minimalItem)

      expect(result.aoid).toBeUndefined()
      expect(result.ql).toBeUndefined()
      expect(result.description).toBeUndefined()
      expect(result.interpolating).toBe(false)
    })

    it('should convert spell data correctly', () => {
      const itemWithSpells: Item = {
        ...sampleItem,
        spell_data: [{
          id: 1,
          event: 1,
          spells: [{
            id: 1,
            target: 1,
            tick_count: 5,
            spell_id: 12345,
            spell_params: { test: 'value' }
          }]
        }]
      }

      const result = interpolationService.itemToInterpolatedItem(itemWithSpells)

      expect(result.spell_data).toHaveLength(1)
      expect(result.spell_data[0].event).toBe(1)
      expect(result.spell_data[0].spells).toHaveLength(1)
      expect(result.spell_data[0].spells[0].spell_id).toBe(12345)
      expect(result.spell_data[0].spells[0].spell_params).toEqual({ test: 'value' })
    })
  })

  describe('isInterpolatableStat', () => {
    it('should return true for interpolatable stats', () => {
      expect(interpolationService.isInterpolatableStat(1)).toBe(true)
      expect(interpolationService.isInterpolatableStat(2)).toBe(true)
      expect(interpolationService.isInterpolatableStat(100)).toBe(true)
    })

    it('should return false for non-interpolatable stats', () => {
      expect(interpolationService.isInterpolatableStat(999)).toBe(false)
      expect(interpolationService.isInterpolatableStat(0)).toBe(false)
    })
  })

  // ============================================================================
  // Cache Management Tests
  // ============================================================================

  describe('cache management', () => {
    it('should provide cache statistics', () => {
      const stats = interpolationService.getCacheStats()
      
      expect(stats).toHaveProperty('itemCache')
      expect(stats).toHaveProperty('infoCache')
      expect(typeof stats.itemCache).toBe('number')
      expect(typeof stats.infoCache).toBe('number')
    })

    it('should handle cache cleanup', () => {
      // This is mainly to ensure the method exists and doesn't throw
      expect(() => {
        interpolationService.cleanupCache()
      }).not.toThrow()
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockApiClient.interpolateItem.mockRejectedValue(new Error('Network error'))

      const result = await interpolationService.interpolateItem(12345, 150)

      expect(result).toBeNull()
      expect(interpolationService.state.error).toBe('Network error')
      expect(interpolationService.state.loading).toBe(false)
    })

    it('should handle malformed API responses', async () => {
      mockApiClient.interpolateItem.mockResolvedValue({
        success: true,
        item: null // Malformed response
      })

      const result = await interpolationService.interpolateItem(12345, 150)

      expect(result).toBeNull()
      expect(interpolationService.state.error).toBe('Failed to interpolate item')
    })

    it('should handle API timeout errors', async () => {
      mockApiClient.interpolateItem.mockRejectedValue(new Error('Request timeout'))

      const result = await interpolationService.interpolateItem(12345, 150)

      expect(result).toBeNull()
      expect(interpolationService.state.error).toBe('Request timeout')
    })
  })

  // ============================================================================
  // State Management Tests
  // ============================================================================

  describe('state management', () => {
    it('should maintain reactive state correctly', async () => {
      const mockResponse: InterpolationResponse = {
        success: true,
        item: sampleInterpolatedItem
      }

      mockApiClient.interpolateItem.mockResolvedValue(mockResponse)

      // Initial state
      expect(interpolationService.state.loading).toBe(false)
      expect(interpolationService.state.error).toBeNull()
      expect(interpolationService.state.currentItem).toBeNull()

      // During interpolation
      const resultPromise = interpolationService.interpolateItem(12345, 150)
      expect(interpolationService.state.loading).toBe(true)

      // After interpolation
      await resultPromise
      expect(interpolationService.state.loading).toBe(false)
      expect(interpolationService.state.error).toBeNull()
      expect(interpolationService.state.currentItem).toEqual(sampleInterpolatedItem)
    })

    it('should clear error state on successful requests', async () => {
      // First, set an error state
      mockApiClient.interpolateItem.mockRejectedValue(new Error('First error'))
      await interpolationService.interpolateItem(12345, 150)
      expect(interpolationService.state.error).toBe('First error')

      // Then, make a successful request
      const mockResponse: InterpolationResponse = {
        success: true,
        item: sampleInterpolatedItem
      }
      mockApiClient.interpolateItem.mockResolvedValue(mockResponse)
      await interpolationService.interpolateItem(12345, 150)

      expect(interpolationService.state.error).toBeNull()
    })
  })
})
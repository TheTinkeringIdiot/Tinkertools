/**
 * Unit tests for the useInterpolation composable.
 * 
 * Tests reactive state management, debouncing, error handling, and Vue integration
 * for the interpolation composable.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { ref, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import type { 
  Item, 
  InterpolatedItem, 
  InterpolationInfo 
} from '../../types/api'
import { useInterpolation, useInterpolationCheck, useInterpolationBatch } from '../useInterpolation'
import interpolationService from '../../services/interpolation-service'

// Mock the interpolation service
vi.mock('../../services/interpolation-service', () => ({
  default: {
    interpolateItem: vi.fn(),
    getInterpolationInfo: vi.fn(),
    isItemInterpolatable: vi.fn(),
    itemToInterpolatedItem: vi.fn()
  }
}))

// Mock timers for debouncing tests
vi.useFakeTimers()

describe('useInterpolation', () => {
  const mockInterpolationService = interpolationService as {
    interpolateItem: Mock
    getInterpolationInfo: Mock
    isItemInterpolatable: Mock
    itemToInterpolatedItem: Mock
  }

  const sampleItem: Item = {
    id: 1,
    aoid: 12345,
    name: 'Test Weapon',
    ql: 100,
    description: 'A test weapon',
    item_class: 1,
    is_nano: false,
    stats: [{ id: 1, stat: 1, value: 100 }],
    spell_data: [],
    actions: []
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
    stats: [{ id: 1, stat: 1, value: 150 }],
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
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  // ============================================================================
  // Basic Functionality Tests
  // ============================================================================

  describe('basic functionality', () => {
    it('should initialize with correct default state', () => {
      const { 
        currentAoid, 
        targetQl, 
        interpolatedItem, 
        interpolationInfo, 
        isLoading, 
        error,
        isInterpolatable,
        canInterpolate,
        qualityRange,
        isTargetQlValid,
        interpolationStatus
      } = useInterpolation()

      expect(currentAoid.value).toBeNull()
      expect(targetQl.value).toBeNull()
      expect(interpolatedItem.value).toBeNull()
      expect(interpolationInfo.value).toBeNull()
      expect(isLoading.value).toBe(false)
      expect(error.value).toBeNull()
      expect(isInterpolatable.value).toBe(false)
      expect(canInterpolate.value).toBe(false)
      expect(qualityRange.value).toBeNull()
      expect(isTargetQlValid.value).toBe(false)
      expect(interpolationStatus.value).toBe('idle')
    })

    it('should initialize with provided AOID', () => {
      const aoidRef = ref(12345)
      const { currentAoid } = useInterpolation(aoidRef)

      expect(currentAoid.value).toBe(12345)
    })

    it('should disable auto-load when specified', () => {
      const aoidRef = ref(12345)
      useInterpolation(aoidRef, { autoLoad: false })

      expect(mockInterpolationService.getInterpolationInfo).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Computed Properties Tests
  // ============================================================================

  describe('computed properties', () => {
    it('should compute isInterpolatable correctly', async () => {
      const { setItem, isInterpolatable } = useInterpolation()

      // Mock interpolation info response
      mockInterpolationService.getInterpolationInfo.mockResolvedValue(sampleInterpolationInfo)

      await setItem(12345)
      await nextTick()

      expect(isInterpolatable.value).toBe(true)
    })

    it('should compute canInterpolate correctly', async () => {
      const { setItem, interpolateToQl, canInterpolate } = useInterpolation()

      // Mock interpolation info response
      mockInterpolationService.getInterpolationInfo.mockResolvedValue(sampleInterpolationInfo)

      await setItem(12345)
      await nextTick()

      // Should be false without target QL
      expect(canInterpolate.value).toBe(false)

      // Should be true with valid target QL
      await interpolateToQl(150)
      expect(canInterpolate.value).toBe(true)
    })

    it('should compute qualityRange correctly', async () => {
      const { setItem, qualityRange } = useInterpolation()

      mockInterpolationService.getInterpolationInfo.mockResolvedValue(sampleInterpolationInfo)

      await setItem(12345)
      await nextTick()

      expect(qualityRange.value).toEqual({
        min: 100,
        max: 200,
        range: 101
      })
    })

    it('should compute isTargetQlValid correctly', async () => {
      const { setItem, interpolateToQl, isTargetQlValid } = useInterpolation()

      mockInterpolationService.getInterpolationInfo.mockResolvedValue(sampleInterpolationInfo)

      await setItem(12345)
      await nextTick()

      // Test valid QL
      await interpolateToQl(150)
      expect(isTargetQlValid.value).toBe(true)

      // Test invalid QL (too low)
      await interpolateToQl(50)
      expect(isTargetQlValid.value).toBe(false)

      // Test invalid QL (too high)
      await interpolateToQl(300)
      expect(isTargetQlValid.value).toBe(false)
    })

    it('should compute interpolationStatus correctly', async () => {
      const { setItem, interpolateToQl, interpolationStatus } = useInterpolation()

      // Initially idle
      expect(interpolationStatus.value).toBe('idle')

      // Mock responses
      mockInterpolationService.getInterpolationInfo.mockResolvedValue(sampleInterpolationInfo)
      mockInterpolationService.interpolateItem.mockResolvedValue(sampleInterpolatedItem)

      await setItem(12345)
      await nextTick()

      // After interpolation
      await interpolateToQl(150)
      expect(interpolationStatus.value).toBe('interpolated')
    })
  })

  // ============================================================================
  // Core Methods Tests
  // ============================================================================

  describe('loadInterpolationInfo', () => {
    it('should load interpolation info successfully', async () => {
      const { setItem, loadInterpolationInfo } = useInterpolation(ref(null), { autoLoad: false })

      mockInterpolationService.getInterpolationInfo.mockResolvedValue(sampleInterpolationInfo)

      await setItem(12345, false)
      const result = await loadInterpolationInfo()

      expect(result).toBe(true)
      expect(mockInterpolationService.getInterpolationInfo).toHaveBeenCalledWith(12345)
    })

    it('should handle interpolation info failure', async () => {
      const { setItem, loadInterpolationInfo, error } = useInterpolation(ref(null), { autoLoad: false })

      mockInterpolationService.getInterpolationInfo.mockRejectedValue(new Error('API error'))

      await setItem(12345, false)
      const result = await loadInterpolationInfo()

      expect(result).toBe(false)
      expect(error.value?.message).toBe('API error')
    })

    it('should return false when no AOID is set', async () => {
      const { loadInterpolationInfo } = useInterpolation()

      const result = await loadInterpolationInfo()

      expect(result).toBe(false)
      expect(mockInterpolationService.getInterpolationInfo).not.toHaveBeenCalled()
    })
  })

  describe('interpolateToQl', () => {
    it('should interpolate to quality level successfully', async () => {
      const { setItem, interpolateToQl } = useInterpolation(ref(null), { autoLoad: false })

      mockInterpolationService.interpolateItem.mockResolvedValue(sampleInterpolatedItem)

      await setItem(12345, false)
      const result = await interpolateToQl(150)

      expect(result).toEqual(sampleInterpolatedItem)
      expect(mockInterpolationService.interpolateItem).toHaveBeenCalledWith(12345, 150)
    })

    it('should handle interpolation failure', async () => {
      const { setItem, interpolateToQl, error } = useInterpolation(ref(null), { autoLoad: false })

      mockInterpolationService.interpolateItem.mockRejectedValue(new Error('Interpolation failed'))

      await setItem(12345, false)
      const result = await interpolateToQl(150)

      expect(result).toBeNull()
      expect(error.value?.message).toBe('Interpolation failed')
    })

    it('should return error when no AOID is set', async () => {
      const { interpolateToQl, error } = useInterpolation()

      const result = await interpolateToQl(150)

      expect(result).toBeNull()
      expect(error.value?.message).toBe('No item AOID specified')
      expect(error.value?.retryable).toBe(false)
    })

    it('should debounce interpolation requests', async () => {
      const { setItem, interpolateToQl } = useInterpolation(ref(null), { 
        autoLoad: false, 
        debounceMs: 300 
      })

      mockInterpolationService.interpolateItem.mockResolvedValue(sampleInterpolatedItem)

      await setItem(12345, false)

      // Make multiple rapid calls
      const promise1 = interpolateToQl(150)
      const promise2 = interpolateToQl(160)
      const promise3 = interpolateToQl(170)

      // Fast-forward timers
      vi.advanceTimersByTime(300)

      await Promise.all([promise1, promise2, promise3])

      // Should only have been called once with the last value
      expect(mockInterpolationService.interpolateItem).toHaveBeenCalledTimes(1)
      expect(mockInterpolationService.interpolateItem).toHaveBeenCalledWith(12345, 170)
    })
  })

  describe('setItem', () => {
    it('should set item AOID and load info', async () => {
      const { setItem, currentAoid } = useInterpolation(ref(null), { autoLoad: false })

      mockInterpolationService.getInterpolationInfo.mockResolvedValue(sampleInterpolationInfo)

      await setItem(12345)

      expect(currentAoid.value).toBe(12345)
      expect(mockInterpolationService.getInterpolationInfo).toHaveBeenCalledWith(12345)
    })

    it('should reset state when setting new item', async () => {
      const { setItem, interpolateToQl, interpolatedItem, targetQl } = useInterpolation(ref(null), { autoLoad: false })

      mockInterpolationService.interpolateItem.mockResolvedValue(sampleInterpolatedItem)
      mockInterpolationService.getInterpolationInfo.mockResolvedValue(sampleInterpolationInfo)

      // Set up initial state
      await setItem(12345, false)
      await interpolateToQl(150)

      expect(interpolatedItem.value).not.toBeNull()
      expect(targetQl.value).toBe(150)

      // Set new item should reset state
      await setItem(67890)

      expect(interpolatedItem.value).toBeNull()
      expect(targetQl.value).toBeNull()
    })
  })

  describe('setItemFromObject', () => {
    it('should set item from Item object', async () => {
      const { setItemFromObject, currentAoid } = useInterpolation(ref(null), { autoLoad: false })

      mockInterpolationService.getInterpolationInfo.mockResolvedValue({
        ...sampleInterpolationInfo,
        interpolatable: false
      })
      mockInterpolationService.itemToInterpolatedItem.mockReturnValue(sampleInterpolatedItem)

      await setItemFromObject(sampleItem)

      expect(currentAoid.value).toBe(12345)
      expect(mockInterpolationService.getInterpolationInfo).toHaveBeenCalledWith(12345)
    })

    it('should handle item without AOID', async () => {
      const { setItemFromObject, error } = useInterpolation()

      const itemWithoutAoid = { ...sampleItem, aoid: undefined }
      await setItemFromObject(itemWithoutAoid)

      expect(error.value?.message).toBe('Item has no AOID')
      expect(error.value?.retryable).toBe(false)
    })

    it('should set non-interpolatable item directly', async () => {
      const { setItemFromObject, interpolatedItem } = useInterpolation(ref(null), { autoLoad: false })

      mockInterpolationService.getInterpolationInfo.mockResolvedValue({
        ...sampleInterpolationInfo,
        interpolatable: false
      })
      mockInterpolationService.itemToInterpolatedItem.mockReturnValue({
        ...sampleInterpolatedItem,
        interpolating: false
      })

      await setItemFromObject(sampleItem)

      expect(interpolatedItem.value?.interpolating).toBe(false)
      expect(mockInterpolationService.itemToInterpolatedItem).toHaveBeenCalledWith(sampleItem)
    })
  })

  // ============================================================================
  // Utility Methods Tests
  // ============================================================================

  describe('utility methods', () => {
    it('should clear all state', () => {
      const { 
        setItem, 
        clear, 
        currentAoid, 
        targetQl, 
        interpolatedItem, 
        interpolationInfo, 
        error 
      } = useInterpolation(ref(12345), { autoLoad: false })

      // Set some state
      setItem(12345, false)

      // Clear all state
      clear()

      expect(currentAoid.value).toBeNull()
      expect(targetQl.value).toBeNull()
      expect(interpolatedItem.value).toBeNull()
      expect(interpolationInfo.value).toBeNull()
      expect(error.value).toBeNull()
    })

    it('should retry failed operations', async () => {
      const { setItem, interpolateToQl, retry } = useInterpolation(ref(null), { autoLoad: false })

      // First call fails
      mockInterpolationService.interpolateItem
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue(sampleInterpolatedItem)

      await setItem(12345, false)
      await interpolateToQl(150) // This will fail

      // Retry should work
      await retry()

      expect(mockInterpolationService.interpolateItem).toHaveBeenCalledTimes(2)
    })

    it('should not retry non-retryable errors', async () => {
      const { interpolateToQl, retry, error } = useInterpolation()

      // This creates a non-retryable error
      await interpolateToQl(150)

      expect(error.value?.retryable).toBe(false)

      // Retry should not do anything
      await retry()

      expect(mockInterpolationService.interpolateItem).not.toHaveBeenCalled()
    })

    it('should generate suggested quality levels', async () => {
      const { setItem, getSuggestedQualityLevels } = useInterpolation(ref(null), { autoLoad: false })

      mockInterpolationService.getInterpolationInfo.mockResolvedValue(sampleInterpolationInfo)

      await setItem(12345)
      await nextTick()

      const suggestions = getSuggestedQualityLevels()

      expect(suggestions).toContain(100) // min
      expect(suggestions).toContain(200) // max
      expect(suggestions.length).toBeGreaterThan(2) // Should include intermediate values
      expect(suggestions).toEqual([...suggestions].sort((a, b) => a - b)) // Should be sorted
    })

    it('should handle small quality ranges', async () => {
      const { setItem, getSuggestedQualityLevels } = useInterpolation(ref(null), { autoLoad: false })

      mockInterpolationService.getInterpolationInfo.mockResolvedValue({
        ...sampleInterpolationInfo,
        min_ql: 100,
        max_ql: 102,
        ql_range: 3
      })

      await setItem(12345)
      await nextTick()

      const suggestions = getSuggestedQualityLevels()

      expect(suggestions).toContain(100)
      expect(suggestions).toContain(102)
      expect(suggestions.length).toBeLessThanOrEqual(3) // Limited suggestions for small range
    })
  })

  // ============================================================================
  // Watchers Tests
  // ============================================================================

  describe('watchers', () => {
    it('should watch AOID changes', async () => {
      const aoidRef = ref(12345)
      useInterpolation(aoidRef, { autoLoad: false })

      mockInterpolationService.getInterpolationInfo.mockResolvedValue(sampleInterpolationInfo)

      // Change AOID
      aoidRef.value = 67890
      await nextTick()

      expect(mockInterpolationService.getInterpolationInfo).toHaveBeenCalledWith(67890)
    })

    it('should not trigger watcher when AOID is same', async () => {
      const aoidRef = ref(12345)
      useInterpolation(aoidRef, { autoLoad: false })

      mockInterpolationService.getInterpolationInfo.mockResolvedValue(sampleInterpolationInfo)

      // Set same AOID
      aoidRef.value = 12345
      await nextTick()

      // Should not be called again
      expect(mockInterpolationService.getInterpolationInfo).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      const { setItem, error, isLoading } = useInterpolation(ref(null), { autoLoad: false })

      mockInterpolationService.getInterpolationInfo.mockRejectedValue(new Error('Service error'))

      await setItem(12345)

      expect(error.value?.message).toBe('Service error')
      expect(error.value?.retryable).toBe(true)
      expect(isLoading.value).toBe(false)
    })

    it('should clear errors on successful operations', async () => {
      const { setItem, interpolateToQl, error } = useInterpolation(ref(null), { autoLoad: false })

      // First operation fails
      mockInterpolationService.interpolateItem.mockRejectedValue(new Error('First error'))

      await setItem(12345, false)
      await interpolateToQl(150)

      expect(error.value?.message).toBe('First error')

      // Second operation succeeds
      mockInterpolationService.interpolateItem.mockResolvedValue(sampleInterpolatedItem)

      await interpolateToQl(150)

      expect(error.value).toBeNull()
    })
  })
})

// ============================================================================
// useInterpolationCheck Tests
// ============================================================================

describe('useInterpolationCheck', () => {
  const mockInterpolationService = interpolationService as {
    isItemInterpolatable: Mock
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should check interpolation status', async () => {
    const aoidRef = ref(12345)
    const { isInterpolatable, isLoading } = useInterpolationCheck(aoidRef)

    mockInterpolationService.isItemInterpolatable.mockResolvedValue(true)

    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(isInterpolatable.value).toBe(true)
    expect(isLoading.value).toBe(false)
    expect(mockInterpolationService.isItemInterpolatable).toHaveBeenCalledWith(12345)
  })

  it('should handle null AOID', async () => {
    const aoidRef = ref(null)
    const { isInterpolatable, checkInterpolation } = useInterpolationCheck(aoidRef)

    await checkInterpolation()

    expect(isInterpolatable.value).toBeNull()
    expect(mockInterpolationService.isItemInterpolatable).not.toHaveBeenCalled()
  })

  it('should handle API errors', async () => {
    const aoidRef = ref(12345)
    const { isInterpolatable } = useInterpolationCheck(aoidRef)

    mockInterpolationService.isItemInterpolatable.mockRejectedValue(new Error('API error'))

    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(isInterpolatable.value).toBe(false)
  })

  it('should react to AOID changes', async () => {
    const aoidRef = ref(12345)
    useInterpolationCheck(aoidRef)

    mockInterpolationService.isItemInterpolatable.mockResolvedValue(true)

    // Change AOID
    aoidRef.value = 67890
    await nextTick()

    expect(mockInterpolationService.isItemInterpolatable).toHaveBeenCalledWith(67890)
  })
})

// ============================================================================
// useInterpolationBatch Tests
// ============================================================================

describe('useInterpolationBatch', () => {
  const mockInterpolationService = interpolationService as {
    interpolateItem: Mock
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should manage multiple interpolated items', async () => {
    const { items, addItem } = useInterpolationBatch()

    const item1: InterpolatedItem = { ...sampleInterpolatedItem, aoid: 12345 }
    const item2: InterpolatedItem = { ...sampleInterpolatedItem, aoid: 67890 }

    mockInterpolationService.interpolateItem
      .mockResolvedValueOnce(item1)
      .mockResolvedValueOnce(item2)

    await addItem(12345, 150)
    await addItem(67890, 200)

    expect(items.value.size).toBe(2)
    expect(items.value.get('12345:150')).toEqual(item1)
    expect(items.value.get('67890:200')).toEqual(item2)
  })

  it('should handle interpolation errors', async () => {
    const { errors, addItem } = useInterpolationBatch()

    mockInterpolationService.interpolateItem.mockRejectedValue(new Error('Interpolation failed'))

    await addItem(12345, 150)

    expect(errors.value.get('12345:150')).toBe('Interpolation failed')
  })

  it('should remove items correctly', async () => {
    const { items, addItem, removeItem } = useInterpolationBatch()

    mockInterpolationService.interpolateItem.mockResolvedValue(sampleInterpolatedItem)

    await addItem(12345, 150)
    expect(items.value.size).toBe(1)

    removeItem(12345, 150)
    expect(items.value.size).toBe(0)
  })

  it('should clear all items and errors', async () => {
    const { items, errors, addItem, clearAll } = useInterpolationBatch()

    mockInterpolationService.interpolateItem
      .mockResolvedValueOnce(sampleInterpolatedItem)
      .mockRejectedValueOnce(new Error('Error'))

    await addItem(12345, 150)
    await addItem(67890, 200)

    expect(items.value.size).toBe(1)
    expect(errors.value.size).toBe(1)

    clearAll()

    expect(items.value.size).toBe(0)
    expect(errors.value.size).toBe(0)
  })

  it('should track loading state', async () => {
    const { isLoading, addItem } = useInterpolationBatch()

    mockInterpolationService.interpolateItem.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(sampleInterpolatedItem), 100))
    )

    const promise = addItem(12345, 150)

    expect(isLoading.value).toBe(true)

    await promise

    expect(isLoading.value).toBe(false)
  })
})
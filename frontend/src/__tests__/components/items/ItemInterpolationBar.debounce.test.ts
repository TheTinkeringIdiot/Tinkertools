/**
 * ItemInterpolationBar Debounce Tests
 * 
 * Focused tests for the debounced input handling functionality
 * to ensure performance optimization works correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ItemInterpolationBar from '../../../components/items/ItemInterpolationBar.vue'
import type { Item, InterpolatedItem, InterpolationRange } from '../../../types/api'

// Mock the API client
vi.mock('../../../services/api-client', () => ({
  apiClient: {
    interpolateItem: vi.fn()
  }
}))

// Mock PrimeVue components with event handling
vi.mock('primevue/inputnumber', () => ({
  default: {
    name: 'InputNumber',
    template: '<input type="number" :value="modelValue" @input="$emit(\'update:model-value\', parseInt($event.target.value))" />',
    props: ['modelValue', 'min', 'max', 'placeholder'],
    emits: ['update:model-value']
  }
}))

vi.mock('primevue/slider', () => ({
  default: {
    name: 'Slider',
    template: '<input type="range" :value="modelValue" @input="$emit(\'update:model-value\', parseInt($event.target.value))" />',
    props: ['modelValue', 'min', 'max', 'step'],
    emits: ['update:model-value']
  }
}))

vi.mock('primevue/badge', () => ({
  default: {
    name: 'Badge',
    template: '<span class="p-badge">{{ value }}</span>',
    props: ['value', 'severity', 'size']
  }
}))

import { apiClient } from '../../../services/api-client'

const mockApiClient = apiClient as {
  interpolateItem: ReturnType<typeof vi.fn>
}

describe('ItemInterpolationBar - Debounce Functionality', () => {
  const mockItem: Item = {
    id: 1,
    aoid: 12345,
    name: 'Test Weapon',
    ql: 150,
    description: 'A test weapon',
    item_class: 1,
    is_nano: false,
    stats: [],
    spell_data: [],
    actions: []
  }

  const mockRanges: InterpolationRange[] = [
    {
      min_ql: 100,
      max_ql: 199,
      base_aoid: 12345
    }
  ]

  const mockInterpolatedItem: InterpolatedItem = {
    ...mockItem,
    interpolating: true,
    low_ql: 100,
    high_ql: 199,
    target_ql: 175,
    ql_delta: 75,
    ql_delta_full: 100
  }

  let router: any
  let wrapper: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/items/:aoid', name: 'ItemDetail', component: { template: '<div />' } }
      ]
    })
    
    mockApiClient.interpolateItem.mockResolvedValue({
      success: true,
      item: mockInterpolatedItem
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.useRealTimers()
  })

  const createWrapper = () => {
    return mount(ItemInterpolationBar, {
      props: {
        item: mockItem,
        itemAoid: 12345,
        interpolationRanges: mockRanges
      },
      global: {
        plugins: [router]
      }
    })
  }

  describe('Debounce Timing', () => {
    it('should debounce rapid input changes', async () => {
      wrapper = createWrapper()
      
      // Trigger multiple rapid changes
      wrapper.vm.localTargetQl = 160
      wrapper.vm.debouncedQlChange()
      
      wrapper.vm.localTargetQl = 165
      wrapper.vm.debouncedQlChange()
      
      wrapper.vm.localTargetQl = 170
      wrapper.vm.debouncedQlChange()
      
      // No API calls should happen immediately
      expect(mockApiClient.interpolateItem).not.toHaveBeenCalled()
      
      // Advance timer by less than debounce delay
      vi.advanceTimersByTime(200)
      await nextTick()
      
      // Still no API calls
      expect(mockApiClient.interpolateItem).not.toHaveBeenCalled()
      
      // Advance timer past debounce delay (300ms)
      vi.advanceTimersByTime(150)
      await nextTick()
      
      // Now API should be called once with final value
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(1)
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(12345, 170)
    })

    it('should reset debounce timer on new input', async () => {
      wrapper = createWrapper()
      
      // First input
      wrapper.vm.localTargetQl = 160
      wrapper.vm.debouncedQlChange()
      
      // Wait almost full debounce period
      vi.advanceTimersByTime(250)
      
      // Second input resets timer
      wrapper.vm.localTargetQl = 170
      wrapper.vm.debouncedQlChange()
      
      // Wait original timer duration
      vi.advanceTimersByTime(100) // Total 350ms from first input
      await nextTick()
      
      // Should still not be called because timer was reset
      expect(mockApiClient.interpolateItem).not.toHaveBeenCalled()
      
      // Wait for new timer to complete
      vi.advanceTimersByTime(300)
      await nextTick()
      
      // Now should be called with second value
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(1)
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(12345, 170)
    })

    it('should handle multiple components with independent debouncing', async () => {
      // Create two instances of the component
      const wrapper1 = createWrapper()
      const wrapper2 = mount(ItemInterpolationBar, {
        props: {
          item: { ...mockItem, aoid: 54321 },
          itemAoid: 54321,
          interpolationRanges: mockRanges
        },
        global: {
          plugins: [router]
        }
      })
      
      // Trigger changes in both components
      wrapper1.vm.localTargetQl = 160
      wrapper1.vm.debouncedQlChange()
      
      wrapper2.vm.localTargetQl = 170
      wrapper2.vm.debouncedQlChange()
      
      // Advance timers
      vi.advanceTimersByTime(350)
      await nextTick()
      
      // Both should make API calls independently
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(2)
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(12345, 160)
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(54321, 170)
      
      wrapper2.unmount()
    })
  })

  describe('User Interaction Patterns', () => {
    it('should handle slider drag simulation', async () => {
      wrapper = createWrapper()
      
      const slider = wrapper.find('input[type="range"]')
      
      // Simulate dragging slider through multiple values quickly
      const dragValues = [155, 160, 165, 170, 175]
      
      for (const value of dragValues) {
        await slider.setValue(value)
        await slider.trigger('input')
        
        // Small delay to simulate real drag behavior
        vi.advanceTimersByTime(50)
      }
      
      // No API calls during dragging
      expect(mockApiClient.interpolateItem).not.toHaveBeenCalled()
      
      // Complete debounce delay
      vi.advanceTimersByTime(300)
      await nextTick()
      
      // Should call once with final value
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(1)
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(12345, 175)
    })

    it('should handle input field typing simulation', async () => {
      wrapper = createWrapper()
      
      const input = wrapper.find('input[type="number"]')
      
      // Simulate typing "175" character by character
      const typingSequence = [1, 17, 175]
      
      for (const value of typingSequence) {
        await input.setValue(value)
        await input.trigger('input')
        
        // Brief delay between keystrokes
        vi.advanceTimersByTime(100)
      }
      
      // No API calls during typing
      expect(mockApiClient.interpolateItem).not.toHaveBeenCalled()
      
      // Complete debounce delay
      vi.advanceTimersByTime(300)
      await nextTick()
      
      // Should call once with final typed value
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(1)
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(12345, 175)
    })

    it('should handle mixed input interactions', async () => {
      wrapper = createWrapper()
      
      const slider = wrapper.find('input[type="range"]')
      const input = wrapper.find('input[type="number"]')
      
      // Start with slider
      await slider.setValue(160)
      await slider.trigger('input')
      vi.advanceTimersByTime(150)
      
      // Switch to input field
      await input.setValue(175)
      await input.trigger('input')
      vi.advanceTimersByTime(150)
      
      // Back to slider
      await slider.setValue(180)
      await slider.trigger('input')
      
      // Complete debounce
      vi.advanceTimersByTime(350)
      await nextTick()
      
      // Should only call with final value from last interaction
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(1)
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(12345, 180)
    })
  })

  describe('Error Handling During Debounce', () => {
    it('should handle API errors during debounced call', async () => {
      mockApiClient.interpolateItem.mockRejectedValue(new Error('Network error'))
      
      wrapper = createWrapper()
      
      wrapper.vm.localTargetQl = 175
      wrapper.vm.debouncedQlChange()
      
      vi.advanceTimersByTime(350)
      await nextTick()
      
      // Should emit error event
      expect(wrapper.emitted('error')).toBeTruthy()
      expect(wrapper.emitted('error')[0][0]).toContain('Failed to interpolate item')
    })

    it('should clear pending timers when component unmounts', async () => {
      wrapper = createWrapper()
      
      // Trigger debounced change
      wrapper.vm.localTargetQl = 175
      wrapper.vm.debouncedQlChange()
      
      // Unmount before timer completes
      wrapper.unmount()
      
      // Advance timer
      vi.advanceTimersByTime(350)
      await nextTick()
      
      // API should not be called after unmount
      expect(mockApiClient.interpolateItem).not.toHaveBeenCalled()
    })

    it('should handle component prop updates during debounce', async () => {
      wrapper = createWrapper()
      
      // Start debounced change
      wrapper.vm.localTargetQl = 175
      wrapper.vm.debouncedQlChange()
      
      // Update item prop before timer fires
      const newItem = { ...mockItem, ql: 200 }
      await wrapper.setProps({ item: newItem })
      
      // Complete timer
      vi.advanceTimersByTime(350)
      await nextTick()
      
      // Should still use the debounced QL, not the new item QL
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(12345, 175)
    })
  })

  describe('Performance Considerations', () => {
    it('should not create memory leaks with many rapid changes', async () => {
      wrapper = createWrapper()
      
      // Simulate many rapid changes (like fast slider dragging)
      for (let i = 0; i < 50; i++) {
        wrapper.vm.localTargetQl = 100 + i
        wrapper.vm.debouncedQlChange()
        vi.advanceTimersByTime(10) // Very rapid changes
      }
      
      // Complete all debounce periods
      vi.advanceTimersByTime(500)
      await nextTick()
      
      // Should only make one final API call
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(1)
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(12345, 149) // Final value
    })

    it('should cancel previous timers efficiently', () => {
      wrapper = createWrapper()
      
      // Track timer creation
      const originalSetTimeout = global.setTimeout
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      
      // Trigger multiple rapid changes
      wrapper.vm.debouncedQlChange()
      wrapper.vm.debouncedQlChange()
      wrapper.vm.debouncedQlChange()
      
      // Should create timers and clear previous ones
      expect(setTimeoutSpy).toHaveBeenCalledTimes(3)
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(2) // Clear first two
      
      setTimeoutSpy.mockRestore()
      clearTimeoutSpy.mockRestore()
    })
  })

  describe('Debounce Configuration', () => {
    it('should use correct debounce delay', () => {
      wrapper = createWrapper()
      
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
      
      wrapper.vm.debouncedQlChange()
      
      // Verify timeout is called with 300ms delay
      expect(setTimeoutSpy).toHaveBeenCalledWith(
        expect.any(Function),
        300
      )
      
      setTimeoutSpy.mockRestore()
    })

    it('should maintain debounce delay consistency across multiple calls', () => {
      wrapper = createWrapper()
      
      const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
      
      // Multiple calls should all use same delay
      wrapper.vm.debouncedQlChange()
      wrapper.vm.debouncedQlChange()
      wrapper.vm.debouncedQlChange()
      
      const timeoutCalls = setTimeoutSpy.mock.calls
      timeoutCalls.forEach(call => {
        expect(call[1]).toBe(300) // All should use 300ms delay
      })
      
      setTimeoutSpy.mockRestore()
    })
  })

  describe('Real-World Usage Patterns', () => {
    it('should handle user pausing during input', async () => {
      wrapper = createWrapper()
      
      // User types quickly then pauses
      wrapper.vm.localTargetQl = 160
      wrapper.vm.debouncedQlChange()
      
      vi.advanceTimersByTime(100)
      
      wrapper.vm.localTargetQl = 165
      wrapper.vm.debouncedQlChange()
      
      // User pauses for longer than debounce delay
      vi.advanceTimersByTime(400)
      await nextTick()
      
      // Should trigger API call
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(1)
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(12345, 165)
      
      // User continues after pause
      wrapper.vm.localTargetQl = 170
      wrapper.vm.debouncedQlChange()
      
      vi.advanceTimersByTime(350)
      await nextTick()
      
      // Should trigger second API call
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(2)
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(12345, 170)
    })

    it('should handle component reuse with different items', async () => {
      wrapper = createWrapper()
      
      // First item interpolation
      wrapper.vm.localTargetQl = 175
      wrapper.vm.debouncedQlChange()
      
      vi.advanceTimersByTime(350)
      await nextTick()
      
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(12345, 175)
      
      // Change to different item
      const newItem = { ...mockItem, aoid: 54321 }
      await wrapper.setProps({ 
        item: newItem,
        itemAoid: 54321
      })
      
      // New interpolation
      wrapper.vm.localTargetQl = 180
      wrapper.vm.debouncedQlChange()
      
      vi.advanceTimersByTime(350)
      await nextTick()
      
      // Should call with new item AOID
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(54321, 180)
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(2)
    })
  })

  describe('Stress Testing', () => {
    it('should handle extremely rapid input without breaking', async () => {
      wrapper = createWrapper()
      
      // Simulate very fast dragging (100 changes in 1 second)
      for (let i = 0; i < 100; i++) {
        wrapper.vm.localTargetQl = 100 + i
        wrapper.vm.debouncedQlChange()
        vi.advanceTimersByTime(10)
      }
      
      // Complete all timers
      vi.advanceTimersByTime(500)
      await nextTick()
      
      // Should only make one final API call
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(1)
      expect(mockApiClient.interpolateItem).toHaveBeenCalledWith(12345, 199)
    })

    it('should handle concurrent API responses correctly', async () => {
      wrapper = createWrapper()
      
      let resolveCount = 0
      mockApiClient.interpolateItem.mockImplementation(() => 
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              item: { ...mockInterpolatedItem, ql: 160 + resolveCount }
            })
            resolveCount++
          }, 100)
        })
      )
      
      // Trigger first change
      wrapper.vm.localTargetQl = 160
      wrapper.vm.debouncedQlChange()
      
      vi.advanceTimersByTime(350)
      await nextTick()
      
      // Immediately trigger second change before first response
      wrapper.vm.localTargetQl = 170
      wrapper.vm.debouncedQlChange()
      
      vi.advanceTimersByTime(350)
      await nextTick()
      
      // Advance time to allow API responses
      vi.advanceTimersByTime(200)
      await nextTick()
      
      // Both calls should complete but component should use latest
      expect(mockApiClient.interpolateItem).toHaveBeenCalledTimes(2)
    })
  })
})
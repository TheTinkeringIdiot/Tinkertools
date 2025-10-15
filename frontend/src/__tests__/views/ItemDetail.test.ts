/**
 * ItemDetail View Tests
 * 
 * Tests the ItemDetail view's displayedItem computed property and
 * how it integrates with interpolation functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mountWithContext } from '@/__tests__/helpers'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { nextTick } from 'vue'
import ItemDetail from '../../views/ItemDetail.vue'
import type { Item, InterpolatedItem, InterpolationRange } from '../../types/api'

// Mock stores
vi.mock('../../stores/items', () => ({
  useItemsStore: vi.fn(() => ({
    currentItem: null,
    loading: false,
    error: null,
    fetchItem: vi.fn(),
    searchHistory: []
  }))
}))

vi.mock('../../stores/profilesStore', () => ({
  useProfilesStore: vi.fn(() => ({
    currentProfile: null,
    profiles: []
  }))
}))

// Mock composables
vi.mock('../../composables/useInterpolation', () => ({
  useInterpolation: vi.fn(() => ({
    interpolationRanges: [],
    getInterpolationRanges: vi.fn().mockResolvedValue([]),
    interpolateItem: vi.fn()
  }))
}))

vi.mock('../../composables/useTheme', () => ({
  useTheme: vi.fn(() => ({
    isDark: false,
    surfaceClass: 'bg-white'
  }))
}))

// Mock child components
vi.mock('../../components/items/ItemCard.vue', () => ({
  default: {
    name: 'ItemCard',
    template: '<div class="item-card">{{ item.name }}</div>',
    props: ['item']
  }
}))

vi.mock('../../components/items/ItemStats.vue', () => ({
  default: {
    name: 'ItemStats',
    template: '<div class="item-stats">Stats for {{ item.name }}</div>',
    props: ['item']
  }
}))

vi.mock('../../components/items/ItemInterpolationBar.vue', () => ({
  default: {
    name: 'ItemInterpolationBar',
    template: '<div class="interpolation-bar" @item-update="$emit(\'item-update\', $event)" @error="$emit(\'error\', $event)"></div>',
    props: ['item', 'itemAoid', 'interpolationRanges'],
    emits: ['item-update', 'error']
  }
}))

vi.mock('../../components/ActionRequirements.vue', () => ({
  default: {
    name: 'ActionRequirements',
    template: '<div class="action-requirements">{{ actions.length }} actions</div>',
    props: ['actions', 'characterStats', 'expanded']
  }
}))

vi.mock('../../components/SpellDataDisplay.vue', () => ({
  default: {
    name: 'SpellDataDisplay',
    template: '<div class="spell-data">{{ spellData.length }} spell effects</div>',
    props: ['spellData', 'profile', 'showHidden', 'advancedView']
  }
}))

vi.mock('../../components/shared/LoadingSpinner.vue', () => ({
  default: {
    name: 'LoadingSpinner',
    template: '<div class="loading">Loading...</div>'
  }
}))

describe('ItemDetail', () => {
  const mockItem: Item = {
    id: 1,
    aoid: 12345,
    name: 'Test Weapon',
    ql: 150,
    description: 'A test weapon',
    item_class: 1,
    is_nano: false,
    stats: [
      { id: 1, stat: 1, value: 100 }
    ],
    spell_data: [
      { id: 1, event: 1, spells: [] }
    ],
    actions: [
      { id: 1, action: 6, item_id: 1, criteria: [] }
    ]
  }

  const mockInterpolatedItem: InterpolatedItem = {
    ...mockItem,
    ql: 175,
    interpolating: true,
    low_ql: 100,
    high_ql: 199,
    target_ql: 175,
    ql_delta: 75,
    ql_delta_full: 100,
    stats: [
      { id: 1, stat: 1, value: 125 }
    ],
    actions: [
      { id: 1, action: 6, item_id: 1, criteria: [{ id: 1, value1: 112, value2: 400, operator: 2 }] }
    ]
  }

  const mockRanges: InterpolationRange[] = [
    {
      min_ql: 100,
      max_ql: 199,
      base_aoid: 12345
    }
  ]

  let router: any
  let wrapper: any
  let mockItemsStore: any
  let mockInterpolationComposable: any

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/items/:aoid', name: 'ItemDetail', component: { template: '<div />' } }
      ]
    })

    // Setup store mock
    const { useItemsStore } = await import('../../stores/items')
    mockItemsStore = {
      currentItem: mockItem,
      loading: false,
      error: null,
      fetchItem: vi.fn().mockResolvedValue(mockItem)
    }
    ;(useItemsStore as any).mockReturnValue(mockItemsStore)

    // Setup interpolation composable mock
    const { useInterpolation } = await import('../../composables/useInterpolation')
    mockInterpolationComposable = {
      interpolationRanges: mockRanges,
      getInterpolationRanges: vi.fn().mockResolvedValue(mockRanges),
      interpolateItem: vi.fn()
    }
    ;(useInterpolation as any).mockReturnValue(mockInterpolationComposable)
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const createWrapper = (routeParams = { aoid: '12345' }) => {
    router.push({ name: 'ItemDetail', params: routeParams })
    
    return mount(ItemDetail, {
      global: {
        plugins: [router]
      }
    })
  }

  describe('displayedItem Computed Property', () => {
    it('should return interpolated item when available', async () => {
      wrapper = createWrapper()
      
      // Set interpolated item
      wrapper.vm.interpolatedItem = mockInterpolatedItem
      await nextTick()
      
      expect(wrapper.vm.displayedItem).toEqual(mockInterpolatedItem)
      expect(wrapper.vm.displayedItem.ql).toBe(175)
      expect(wrapper.vm.displayedItem.interpolating).toBe(true)
    })

    it('should return base item when no interpolated item', async () => {
      wrapper = createWrapper()
      
      expect(wrapper.vm.displayedItem).toEqual(mockItem)
      expect(wrapper.vm.displayedItem.ql).toBe(150)
      expect(wrapper.vm.displayedItem.interpolating).toBeUndefined()
    })
  })

  describe('Component Integration', () => {
    it('should pass displayedItem to ItemStats component', async () => {
      wrapper = createWrapper()
      wrapper.vm.interpolatedItem = mockInterpolatedItem
      await nextTick()
      
      const itemStats = wrapper.findComponent({ name: 'ItemStats' })
      expect(itemStats.props('item')).toEqual(mockInterpolatedItem)
    })

    it('should pass displayedItem.actions to ActionRequirements', async () => {
      wrapper = createWrapper()
      wrapper.vm.interpolatedItem = mockInterpolatedItem
      await nextTick()
      
      const actionRequirements = wrapper.findComponent({ name: 'ActionRequirements' })
      expect(actionRequirements.props('actions')).toEqual(mockInterpolatedItem.actions)
    })

    it('should pass displayedItem.spell_data to SpellDataDisplay', async () => {
      wrapper = createWrapper()
      wrapper.vm.interpolatedItem = mockInterpolatedItem
      await nextTick()
      
      const spellDataDisplay = wrapper.findComponent({ name: 'SpellDataDisplay' })
      expect(spellDataDisplay.props('spellData')).toEqual(mockInterpolatedItem.spell_data)
    })
  })

  describe('Interpolation Bar Integration', () => {
    it('should handle item-update event from interpolation bar', async () => {
      wrapper = createWrapper()
      
      const interpolationBar = wrapper.findComponent({ name: 'ItemInterpolationBar' })
      
      // Simulate item-update event
      interpolationBar.vm.$emit('item-update', mockInterpolatedItem)
      await nextTick()
      
      expect(wrapper.vm.interpolatedItem).toEqual(mockInterpolatedItem)
      expect(wrapper.vm.displayedItem).toEqual(mockInterpolatedItem)
    })

    it('should handle error event from interpolation bar', async () => {
      wrapper = createWrapper()
      
      const interpolationBar = wrapper.findComponent({ name: 'ItemInterpolationBar' })
      
      // Simulate error event
      interpolationBar.vm.$emit('error', 'Test error message')
      await nextTick()
      
      expect(wrapper.vm.interpolationError).toBe('Test error message')
    })

    it('should clear interpolated item when error occurs', async () => {
      wrapper = createWrapper()
      wrapper.vm.interpolatedItem = mockInterpolatedItem
      
      const interpolationBar = wrapper.findComponent({ name: 'ItemInterpolationBar' })
      interpolationBar.vm.$emit('error', 'Test error')
      await nextTick()
      
      expect(wrapper.vm.interpolatedItem).toBeNull()
    })
  })

  describe('URL Parameter Handling', () => {
    it('should trigger interpolation when QL is in URL query', async () => {
      // Mock route with QL parameter
      await router.push({ name: 'ItemDetail', params: { aoid: '12345' }, query: { ql: '175' } })
      
      wrapper = mount(ItemDetail, {
        global: {
          plugins: [router]
        }
      })
      
      await nextTick()
      
      // Should attempt to load interpolation ranges and interpolate
      expect(mockInterpolationComposable.getInterpolationRanges).toHaveBeenCalledWith(12345)
    })

    it('should handle invalid QL parameter gracefully', async () => {
      await router.push({ name: 'ItemDetail', params: { aoid: '12345' }, query: { ql: 'invalid' } })
      
      wrapper = mount(ItemDetail, {
        global: {
          plugins: [router]
        }
      })
      
      await nextTick()
      
      // Should not crash and should use base item
      expect(wrapper.vm.displayedItem).toEqual(mockItem)
    })
  })

  describe('Loading States', () => {
    it('should show loading spinner when fetching item', () => {
      mockItemsStore.loading = true
      wrapper = createWrapper()
      
      const loadingSpinner = wrapper.findComponent({ name: 'LoadingSpinner' })
      expect(loadingSpinner.exists()).toBe(true)
    })

    it('should hide content when loading', () => {
      mockItemsStore.loading = true
      wrapper = createWrapper()
      
      const itemCard = wrapper.findComponent({ name: 'ItemCard' })
      expect(itemCard.exists()).toBe(false)
    })
  })

  describe('Error States', () => {
    it('should display store error when item fails to load', () => {
      mockItemsStore.error = 'Item not found'
      wrapper = createWrapper()
      
      expect(wrapper.text()).toContain('Item not found')
    })

    it('should display interpolation error', async () => {
      wrapper = createWrapper()
      
      const interpolationBar = wrapper.findComponent({ name: 'ItemInterpolationBar' })
      interpolationBar.vm.$emit('error', 'Interpolation failed')
      await nextTick()
      
      expect(wrapper.text()).toContain('Interpolation failed')
    })
  })
})
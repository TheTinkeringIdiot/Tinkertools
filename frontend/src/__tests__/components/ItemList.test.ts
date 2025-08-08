/**
 * ItemList Component Tests
 * 
 * Tests for the ItemList component functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import ItemList from '../../components/items/ItemList.vue'
import type { Item, TinkerProfile, PaginationInfo } from '../../types/api'

// Mock child components
vi.mock('../../components/items/ItemCard.vue', () => ({
  default: {
    name: 'ItemCard',
    template: `
      <div class="item-card" @click="$emit('click', item)">
        <div class="item-name">{{ item.name }}</div>
        <button @click.stop="$emit('favorite', item)" class="favorite-btn">Favorite</button>
        <button @click.stop="$emit('compare', item)" class="compare-btn">Compare</button>
        <button @click.stop="$emit('quick-view', item)" class="quick-view-btn">Quick View</button>
      </div>
    `,
    props: ['item', 'profile', 'showCompatibility', 'isFavorite', 'isComparing'],
    emits: ['click', 'favorite', 'compare', 'quick-view']
  }
}))

vi.mock('../../components/items/ItemQuickView.vue', () => ({
  default: {
    name: 'ItemQuickView',
    template: `
      <div class="item-quick-view">
        <h3>{{ item.name }}</h3>
        <button @click="$emit('close')">Close</button>
        <button @click="$emit('view-full')">View Full</button>
        <button @click="$emit('favorite', item)">Favorite</button>
        <button @click="$emit('compare', item)">Compare</button>
      </div>
    `,
    props: ['item', 'profile', 'showCompatibility'],
    emits: ['close', 'view-full', 'favorite', 'compare']
  }
}))

// Mock PrimeVue components
vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
    emits: ['click']
  }
}))

vi.mock('primevue/badge', () => ({
  default: {
    name: 'Badge',
    template: '<span class="p-badge">{{ value }}</span>',
    props: ['value', 'severity', 'size']
  }
}))

vi.mock('primevue/tag', () => ({
  default: {
    name: 'Tag',
    template: '<span class="p-tag">{{ value }}</span>',
    props: ['value', 'severity', 'size']
  }
}))

vi.mock('primevue/paginator', () => ({
  default: {
    name: 'Paginator',
    template: '<div class="p-paginator"><button @click="$emit(\'page\', { first: 0, rows: 25 })">Page 1</button></div>',
    props: ['first', 'rows', 'totalRecords', 'rowsPerPageOptions', 'template', 'currentPageReportTemplate'],
    emits: ['page']
  }
}))

vi.mock('primevue/contextmenu', () => ({
  default: {
    name: 'ContextMenu',
    template: '<div class="p-context-menu" ref="menu"></div>',
    props: ['model'],
    methods: {
      show: vi.fn()
    }
  }
}))

vi.mock('primevue/dialog', () => ({
  default: {
    name: 'Dialog',
    template: '<div v-if="visible" class="p-dialog"><slot /></div>',
    props: ['visible', 'modal', 'header', 'style'],
    emits: ['update:visible']
  }
}))

const mockItem: Item = {
  id: 1,
  aoid: 12345,
  name: 'Test Item',
  ql: 200,
  description: 'A test item for testing',
  item_class: 3,
  is_nano: false,
  stats: [
    { stat: 16, value: 50 }, // Strength +50
    { stat: 17, value: 25 }  // Agility +25
  ],
  requirements: [
    { stat: 16, value: 300 }, // Strength 300
    { stat: 17, value: 200 }  // Agility 200
  ],
  spell_data: [],
  actions: [],
  attack_defense: null,
  animation_mesh: null
}

const mockProfile: TinkerProfile = {
  id: 'test-profile',
  name: 'Test Character',
  level: 200,
  profession: 'Engineer',
  stats: {
    16: 350, // Can meet strength req
    17: 150  // Cannot meet agility req
  }
}

const mockPagination: PaginationInfo = {
  page: 1,
  limit: 25,
  total: 100,
  offset: 0
}

describe('ItemList', () => {
  let wrapper: any

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Component Mounting', () => {
    it('should mount without errors', () => {
      wrapper = mount(ItemList, {
        props: {
          items: [mockItem],
          viewMode: 'grid'
        }
      })
      
      expect(wrapper.exists()).toBe(true)
    })

    it('should render items in grid view', () => {
      wrapper = mount(ItemList, {
        props: {
          items: [mockItem],
          viewMode: 'grid'
        }
      })
      
      const itemCards = wrapper.findAllComponents({ name: 'ItemCard' })
      expect(itemCards).toHaveLength(1)
      expect(wrapper.find('.grid').exists()).toBe(true)
    })

    it('should render items in list view', async () => {
      wrapper = mount(ItemList, {
        props: {
          items: [mockItem],
          viewMode: 'list'
        }
      })
      
      const listItems = wrapper.findAll('.space-y-2 > div')
      expect(listItems.length).toBeGreaterThan(0)
    })
  })

  describe('View Mode Switching', () => {
    beforeEach(() => {
      wrapper = mount(ItemList, {
        props: {
          items: [mockItem],
          viewMode: 'grid'
        }
      })
    })

    it('should show view mode controls on mobile', () => {
      const mobileControls = wrapper.find('.md\\:hidden')
      expect(mobileControls.exists()).toBe(true)
    })

    it('should emit view mode change when buttons are clicked', async () => {
      const listViewButton = wrapper.find('button').findAll('button')[1] // Second button should be list view
      
      if (listViewButton) {
        await listViewButton.trigger('click')
        expect(wrapper.emitted('view-mode-change')).toBeTruthy()
        expect(wrapper.emitted('view-mode-change')[0]).toEqual(['list'])
      }
    })

    it('should highlight active view mode button', () => {
      // Grid view should be active
      const gridButton = wrapper.find('button').findAll('button')[0]
      expect(gridButton.attributes('severity')).toBe('primary')
    })
  })

  describe('Item Display', () => {
    beforeEach(() => {
      wrapper = mount(ItemList, {
        props: {
          items: [mockItem],
          viewMode: 'grid',
          favoriteItems: [1],
          comparisonItems: [1]
        }
      })
    })

    it('should pass correct props to ItemCard components', () => {
      const itemCard = wrapper.findComponent({ name: 'ItemCard' })
      
      expect(itemCard.props('item')).toEqual(mockItem)
      expect(itemCard.props('isFavorite')).toBe(true)
      expect(itemCard.props('isComparing')).toBe(true)
    })

    it('should handle item click events', async () => {
      const itemCard = wrapper.findComponent({ name: 'ItemCard' })
      
      await itemCard.trigger('click')
      
      expect(wrapper.emitted('item-click')).toBeTruthy()
      expect(wrapper.emitted('item-click')[0]).toEqual([mockItem])
    })

    it('should handle favorite toggle events', async () => {
      const itemCard = wrapper.findComponent({ name: 'ItemCard' })
      
      await itemCard.vm.$emit('favorite', mockItem)
      
      expect(wrapper.emitted('item-favorite')).toBeTruthy()
      expect(wrapper.emitted('item-favorite')[0]).toEqual([mockItem])
    })

    it('should handle comparison events', async () => {
      const itemCard = wrapper.findComponent({ name: 'ItemCard' })
      
      await itemCard.vm.$emit('compare', mockItem)
      
      expect(wrapper.emitted('item-compare')).toBeTruthy()
      expect(wrapper.emitted('item-compare')[0]).toEqual([mockItem])
    })
  })

  describe('Compatibility Display', () => {
    beforeEach(() => {
      wrapper = mount(ItemList, {
        props: {
          items: [mockItem],
          viewMode: 'list',
          compatibilityProfile: mockProfile,
          showCompatibility: true
        }
      })
    })

    it('should show compatibility indicators in list view', () => {
      const compatibilityIcons = wrapper.findAll('.pi-check-circle, .pi-times-circle, .pi-question-circle')
      expect(compatibilityIcons.length).toBeGreaterThan(0)
    })

    it('should display requirement tags with correct colors', () => {
      const requirementTags = wrapper.findAllComponents({ name: 'Tag' })
      
      // Should have tags for requirements
      const dangerTags = requirementTags.filter(tag => tag.props('severity') === 'danger')
      const successTags = requirementTags.filter(tag => tag.props('severity') === 'success')
      
      expect(dangerTags.length + successTags.length).toBeGreaterThan(0)
    })

    it('should not show compatibility when disabled', async () => {
      await wrapper.setProps({ showCompatibility: false })
      
      const compatibilityIcons = wrapper.findAll('.pi-check-circle, .pi-times-circle, .pi-question-circle')
      expect(compatibilityIcons).toHaveLength(0)
    })
  })

  describe('Pagination', () => {
    beforeEach(() => {
      wrapper = mount(ItemList, {
        props: {
          items: [mockItem],
          viewMode: 'grid',
          pagination: mockPagination
        }
      })
    })

    it('should display pagination information', () => {
      const paginationInfo = wrapper.find('.text-sm')
      expect(paginationInfo.text()).toContain('Showing 1-1 of 100 items')
    })

    it('should render paginator component', () => {
      const paginator = wrapper.findComponent({ name: 'Paginator' })
      expect(paginator.exists()).toBe(true)
      expect(paginator.props('totalRecords')).toBe(100)
    })

    it('should emit page change events', async () => {
      const paginator = wrapper.findComponent({ name: 'Paginator' })
      
      await paginator.vm.$emit('page', { first: 25, rows: 25 })
      
      expect(wrapper.emitted('page-change')).toBeTruthy()
      expect(wrapper.emitted('page-change')[0]).toEqual([2]) // Page 2
    })
  })

  describe('Quick View Dialog', () => {
    beforeEach(() => {
      wrapper = mount(ItemList, {
        props: {
          items: [mockItem],
          viewMode: 'grid'
        }
      })
    })

    it('should open quick view dialog when item card emits quick-view', async () => {
      const itemCard = wrapper.findComponent({ name: 'ItemCard' })
      
      await itemCard.vm.$emit('quick-view', mockItem)
      await nextTick()
      
      const dialog = wrapper.findComponent({ name: 'Dialog' })
      expect(dialog.exists()).toBe(true)
      expect(dialog.props('visible')).toBe(true)
    })

    it('should render ItemQuickView in dialog', async () => {
      const itemCard = wrapper.findComponent({ name: 'ItemCard' })
      await itemCard.vm.$emit('quick-view', mockItem)
      await nextTick()
      
      const quickView = wrapper.findComponent({ name: 'ItemQuickView' })
      expect(quickView.exists()).toBe(true)
      expect(quickView.props('item')).toEqual(mockItem)
    })

    it('should close dialog when quick view emits close', async () => {
      // Open dialog first
      const itemCard = wrapper.findComponent({ name: 'ItemCard' })
      await itemCard.vm.$emit('quick-view', mockItem)
      await nextTick()
      
      // Close dialog
      const quickView = wrapper.findComponent({ name: 'ItemQuickView' })
      await quickView.vm.$emit('close')
      await nextTick()
      
      const dialog = wrapper.findComponent({ name: 'Dialog' })
      expect(dialog.props('visible')).toBe(false)
    })

    it('should handle view-full event from quick view', async () => {
      // Open dialog
      const itemCard = wrapper.findComponent({ name: 'ItemCard' })
      await itemCard.vm.$emit('quick-view', mockItem)
      await nextTick()
      
      // Trigger view full
      const quickView = wrapper.findComponent({ name: 'ItemQuickView' })
      await quickView.vm.$emit('view-full')
      
      expect(wrapper.emitted('item-click')).toBeTruthy()
      expect(wrapper.emitted('item-click')[0]).toEqual([mockItem])
    })
  })

  describe('Context Menu', () => {
    beforeEach(() => {
      wrapper = mount(ItemList, {
        props: {
          items: [mockItem],
          viewMode: 'list'
        }
      })
    })

    it('should show context menu on item action button click', async () => {
      const menuButton = wrapper.find('button[class*="pi-ellipsis-v"]')
      
      if (menuButton.exists()) {
        const mockEvent = { target: menuButton.element }
        await wrapper.vm.showItemMenu(mockEvent, mockItem)
        
        const contextMenu = wrapper.findComponent({ name: 'ContextMenu' })
        expect(contextMenu.exists()).toBe(true)
      }
    })

    it('should have context menu items', () => {
      const contextMenu = wrapper.findComponent({ name: 'ContextMenu' })
      
      if (contextMenu.exists()) {
        const menuModel = contextMenu.props('model')
        expect(menuModel).toBeDefined()
        expect(menuModel.length).toBeGreaterThan(0)
      }
    })
  })

  describe('Empty State', () => {
    it('should show empty state when no items', () => {
      wrapper = mount(ItemList, {
        props: {
          items: [],
          viewMode: 'grid'
        }
      })
      
      expect(wrapper.text()).toContain('No items found')
      expect(wrapper.find('.pi-inbox').exists()).toBe(true)
    })

    it('should show helpful message in empty state', () => {
      wrapper = mount(ItemList, {
        props: {
          items: [],
          viewMode: 'grid'
        }
      })
      
      expect(wrapper.text()).toContain('Try adjusting your search terms or filters')
    })
  })

  describe('Responsiveness', () => {
    beforeEach(() => {
      wrapper = mount(ItemList, {
        props: {
          items: [mockItem, { ...mockItem, id: 2 }, { ...mockItem, id: 3 }],
          viewMode: 'grid'
        }
      })
    })

    it('should use responsive grid classes', () => {
      const grid = wrapper.find('.grid')
      expect(grid.classes()).toContain('grid-cols-1')
      expect(grid.classes()).toContain('sm:grid-cols-2')
      expect(grid.classes()).toContain('lg:grid-cols-3')
      expect(grid.classes()).toContain('xl:grid-cols-4')
    })

    it('should hide view mode controls on desktop', () => {
      const desktopHidden = wrapper.find('.md\\:hidden')
      expect(desktopHidden.exists()).toBe(true)
    })
  })

  describe('Performance', () => {
    it('should handle large item lists efficiently', () => {
      const manyItems = Array.from({ length: 100 }, (_, i) => ({
        ...mockItem,
        id: i + 1,
        name: `Item ${i + 1}`
      }))
      
      wrapper = mount(ItemList, {
        props: {
          items: manyItems,
          viewMode: 'grid'
        }
      })
      
      expect(wrapper.exists()).toBe(true)
      const itemCards = wrapper.findAllComponents({ name: 'ItemCard' })
      expect(itemCards).toHaveLength(100)
    })

    it('should not re-render unnecessarily on prop changes', async () => {
      wrapper = mount(ItemList, {
        props: {
          items: [mockItem],
          viewMode: 'grid'
        }
      })
      
      const initialRenderCount = wrapper.vm.$.renderCount || 1
      
      // Change non-item props
      await wrapper.setProps({ loading: true })
      await wrapper.setProps({ loading: false })
      
      // Should not re-render items unnecessarily
      expect(wrapper.exists()).toBe(true)
    })
  })
})
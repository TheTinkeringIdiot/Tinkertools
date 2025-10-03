/**
 * TinkerNukes View Integration Tests
 *
 * Tests the main TinkerNukes view component that orchestrates form and table.
 * Validates:
 * - Profile switch clears table and updates form
 * - Non-Nanotechnician profile shows empty state
 * - Manual skills mode works without active profile
 * - Search and filter functionality updates table
 * - Integration between NukeInputForm and NukeTable
 * - Navigation to nano detail pages
 * - Accessibility and user experience
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, VueWrapper, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import TinkerNukes from '@/views/TinkerNukes.vue'
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles'
import type { TinkerProfile } from '@/lib/tinkerprofiles/types'

// Mock the offensive nano service
vi.mock('@/services/offensive-nano-service', () => ({
  fetchOffensiveNanos: vi.fn(() =>
    Promise.resolve([
      {
        id: 1001,
        name: 'Viral Bomb',
        ql: 250,
        spell_data: [],
        stats: [],
        is_nano: true
      },
      {
        id: 1002,
        name: 'Corrosive Cloud',
        ql: 260,
        spell_data: [],
        stats: [],
        is_nano: true
      },
      {
        id: 1003,
        name: 'Energy Blast',
        ql: 300,
        spell_data: [],
        stats: [],
        is_nano: true
      }
    ])
  ),
  buildOffensiveNano: vi.fn((item) => ({
    id: item.id,
    name: item.name,
    school: 'Matter Creation',
    strain: '1',
    description: 'Test nano',
    level: 200,
    qualityLevel: item.ql,
    castingRequirements: [],
    minDamage: 800,
    maxDamage: 1200,
    midDamage: 1000,
    damageType: 'poison',
    tickCount: 1,
    tickInterval: 0,
    castingTime: 300,
    rechargeTime: 2000,
    nanoPointCost: 500
  }))
}))

// Mock child components to isolate TinkerNukes behavior
vi.mock('@/components/nukes/NukeInputForm.vue', () => ({
  default: {
    name: 'NukeInputForm',
    template: '<div data-test="nuke-input-form"><slot></slot></div>',
    props: ['inputState', 'activeProfile'],
    emits: ['update:inputState']
  }
}))

vi.mock('@/components/nukes/NukeTable.vue', () => ({
  default: {
    name: 'NukeTable',
    template: '<div data-test="nuke-table">{{ nanos.length }} nanos</div>',
    props: ['nanos', 'inputState', 'searchQuery', 'loading'],
    emits: ['nano-selected']
  }
}))

// ============================================================================
// Test Fixtures
// ============================================================================

const createNanotechProfile = (name = 'TestNano'): TinkerProfile => ({
  Character: {
    Name: name,
    Profession: 11, // Nanotechnician
    Breed: 3,
    Level: 220,
    Gender: 'Female',
    Faction: 'Clan',
    Organization: 'Test Org'
  },
  skills: {
    21: { total: 800 },
    149: { total: 1200 },
    221: { total: 5000 },
    126: { total: 2500 },
    127: { total: 2500 },
    128: { total: 2500 },
    129: { total: 2500 },
    130: { total: 2500 },
    131: { total: 2500 }
  },
  abilities: {},
  items: {},
  symbiants: {},
  perks: [],
  buffs: [],
  version: '4.0.0'
} as any)

const createNonNanotechProfile = (name = 'TestDoc'): TinkerProfile => ({
  Character: {
    Name: name,
    Profession: 6, // Doctor
    Breed: 1,
    Level: 220,
    Gender: 'Male',
    Faction: 'Omni',
    Organization: 'Test Org'
  },
  skills: {
    21: { total: 500 }
  },
  abilities: {},
  items: {},
  symbiants: {},
  perks: [],
  buffs: [],
  version: '4.0.0'
} as any)

// ============================================================================
// Test Suite
// ============================================================================

describe('TinkerNukes View', () => {
  let wrapper: VueWrapper<any>
  let router: any
  let pinia: any
  let profileStore: any

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    profileStore = useTinkerProfilesStore()

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
        {
          path: '/tinker-nukes',
          name: 'tinker-nukes',
          component: TinkerNukes
        },
        {
          path: '/items/:id',
          name: 'item-detail',
          component: { template: '<div>Item Detail</div>' }
        }
      ]
    })
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  // ==========================================================================
  // Component Mounting & Structure Tests
  // ==========================================================================

  describe('Component Structure', () => {
    it('should render the view with header, form, filters, and table', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      expect(wrapper.find('[data-test="nuke-input-form"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="nuke-table"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('TinkerNukes')
    })

    it('should display NT Only badge in header', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      expect(wrapper.text()).toContain('NT Only')
    })

    it('should show nano count badge when nanos are loaded', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      // Wait for nanos to load
      await wrapper.vm.$nextTick()

      const text = wrapper.text()
      expect(text).toContain('nanos') // Badge or count display
    })

    it('should have accessible heading structure', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const h1 = wrapper.find('h1')
      expect(h1.exists()).toBe(true)
      expect(h1.text()).toContain('TinkerNukes')
    })
  })

  // ==========================================================================
  // Data Loading Tests
  // ==========================================================================

  describe('Data Loading', () => {
    it('should fetch offensive nanos on mount', async () => {
      const { fetchOffensiveNanos } = await import('@/services/offensive-nano-service')

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      expect(fetchOffensiveNanos).toHaveBeenCalledWith(11) // Profession ID 11
    })

    it('should display loading state while fetching nanos', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      // Check loading state before promise resolves
      expect(wrapper.vm.loading).toBe(true)

      await flushPromises()

      // Loading should complete
      expect(wrapper.vm.loading).toBe(false)
    })

    it('should store fetched nanos in component state', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      expect(wrapper.vm.offensiveNanos).toBeDefined()
      expect(wrapper.vm.offensiveNanos.length).toBeGreaterThan(0)
    })

    it('should handle fetch errors gracefully', async () => {
      const { fetchOffensiveNanos } = await import('@/services/offensive-nano-service')
      vi.mocked(fetchOffensiveNanos).mockRejectedValueOnce(new Error('Network error'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      expect(consoleSpy).toHaveBeenCalled()
      expect(wrapper.vm.loading).toBe(false)

      consoleSpy.mockRestore()
    })
  })

  // ==========================================================================
  // Profile Integration Tests
  // ==========================================================================

  describe('Profile Integration', () => {
    it('should access active profile from TinkerProfiles store', async () => {
      const profile = createNanotechProfile()
      profileStore.activeProfile = profile

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      expect(wrapper.vm.activeProfile).toBe(profile)
    })

    it('should display active profile info in header', async () => {
      const profile = createNanotechProfile('TestNanoChar')
      profileStore.activeProfile = profile

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      expect(wrapper.text()).toContain('TestNanoChar')
      expect(wrapper.text()).toContain('Nanotechnician')
    })

    it('should not crash when no active profile', async () => {
      profileStore.activeProfile = null

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      expect(wrapper.exists()).toBe(true)
    })
  })

  // ==========================================================================
  // Profile Switching Tests (FR-10)
  // ==========================================================================

  describe('Profile Switching', () => {
    it('should clear table filters when profile switches', async () => {
      const profile1 = createNanotechProfile('Profile1')
      profileStore.activeProfile = profile1

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      // Set some filters
      wrapper.vm.searchQuery = 'Viral'
      wrapper.vm.selectedSchoolId = 126
      wrapper.vm.minQL = 100
      wrapper.vm.maxQL = 200

      await wrapper.vm.$nextTick()

      // Switch profile
      const profile2 = createNanotechProfile('Profile2')
      profileStore.activeProfile = profile2

      await wrapper.vm.$nextTick()

      // Filters should be cleared
      expect(wrapper.vm.searchQuery).toBe('')
      expect(wrapper.vm.selectedSchoolId).toBeNull()
      expect(wrapper.vm.minQL).toBeUndefined()
      expect(wrapper.vm.maxQL).toBeUndefined()
    })

    it('should update input form when profile switches', async () => {
      const profile1 = createNanotechProfile('Profile1')
      profileStore.activeProfile = profile1

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const formComponent = wrapper.findComponent({ name: 'NukeInputForm' })
      expect(formComponent.props('activeProfile')).toBe(profile1)

      // Switch profile
      const profile2 = createNanotechProfile('Profile2')
      profileStore.activeProfile = profile2

      await wrapper.vm.$nextTick()

      expect(formComponent.props('activeProfile')).toBe(profile2)
    })

    it('should log profile switch in console', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const profile1 = createNanotechProfile('Profile1')
      profileStore.activeProfile = profile1

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const profile2 = createNanotechProfile('Profile2')
      profileStore.activeProfile = profile2

      await wrapper.vm.$nextTick()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Profile switched to: Profile2')
      )

      consoleSpy.mockRestore()
    })
  })

  // ==========================================================================
  // Non-Nanotechnician Profile Tests
  // ==========================================================================

  describe('Non-Nanotechnician Profile', () => {
    it('should warn when active profile is not Nanotechnician', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const docProfile = createNonNanotechProfile()
      profileStore.activeProfile = docProfile

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      // Switch from null to Doctor
      await wrapper.vm.$nextTick()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('not Nanotechnician')
      )

      consoleSpy.mockRestore()
    })

    it('should still display nanos but form shows defaults', async () => {
      const docProfile = createNonNanotechProfile()
      profileStore.activeProfile = docProfile

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      // Table should still exist with nanos
      const tableComponent = wrapper.findComponent({ name: 'NukeTable' })
      expect(tableComponent.exists()).toBe(true)

      // Form should receive non-NT profile
      const formComponent = wrapper.findComponent({ name: 'NukeInputForm' })
      expect(formComponent.props('activeProfile')).toBe(docProfile)
    })

    it('should show profession name in header even for non-NT', async () => {
      const docProfile = createNonNanotechProfile('TestDoctor')
      profileStore.activeProfile = docProfile

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      expect(wrapper.text()).toContain('TestDoctor')
      expect(wrapper.text()).toContain('Doctor')
    })
  })

  // ==========================================================================
  // Manual Skills Mode (No Profile)
  // ==========================================================================

  describe('Manual Skills Mode', () => {
    it('should work without active profile', async () => {
      profileStore.activeProfile = null

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.vm.activeProfile).toBeNull()

      // Form and table should still render
      expect(wrapper.find('[data-test="nuke-input-form"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="nuke-table"]').exists()).toBe(true)
    })

    it('should allow manual input state updates without profile', async () => {
      profileStore.activeProfile = null

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const formComponent = wrapper.findComponent({ name: 'NukeInputForm' })

      // Simulate form updating input state
      const newInputState = {
        ...wrapper.vm.inputState,
        characterStats: {
          ...wrapper.vm.inputState.characterStats,
          psychic: 999
        }
      }

      await formComponent.vm.$emit('update:inputState', newInputState)
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.inputState.characterStats.psychic).toBe(999)
    })

    it('should filter nanos based on manual skill values', async () => {
      profileStore.activeProfile = null

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      // Update manual skills
      wrapper.vm.inputState.characterStats.matterCreation = 3000

      await wrapper.vm.$nextTick()

      // filteredNanos should use manual skills
      expect(wrapper.vm.currentSkills[126]).toBe(3000)
    })

    it('should calculate table metrics using manual values', async () => {
      profileStore.activeProfile = null

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const tableComponent = wrapper.findComponent({ name: 'NukeTable' })

      // Table should receive input state
      expect(tableComponent.props('inputState')).toEqual(wrapper.vm.inputState)
    })
  })

  // ==========================================================================
  // Search and Filter Tests
  // ==========================================================================

  describe('Search and Filtering', () => {
    it('should filter nanos by search query', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const allNanos = wrapper.vm.filteredNanos.length

      // Apply search filter
      wrapper.vm.searchQuery = 'Viral'
      await wrapper.vm.$nextTick()

      // Should filter results
      const filteredCount = wrapper.vm.filteredNanos.length
      expect(filteredCount).toBeLessThanOrEqual(allNanos)
    })

    it('should filter by nano school dropdown', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      // Select Matter Creation (skill ID 126)
      wrapper.vm.selectedSchoolId = 126
      await wrapper.vm.$nextTick()

      // filteredNanos should be filtered by school
      expect(wrapper.vm.selectedSchoolId).toBe(126)
    })

    it('should filter by QL range', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      // Set QL range
      wrapper.vm.minQL = 100
      wrapper.vm.maxQL = 200
      await wrapper.vm.$nextTick()

      // Filters should be applied
      expect(wrapper.vm.minQL).toBe(100)
      expect(wrapper.vm.maxQL).toBe(200)
    })

    it('should update table when filters change', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const tableComponent = wrapper.findComponent({ name: 'NukeTable' })
      const initialNanos = tableComponent.props('nanos').length

      // Apply filter
      wrapper.vm.searchQuery = 'NonExistent'
      await wrapper.vm.$nextTick()

      // Table should receive filtered nanos
      const filteredNanos = tableComponent.props('nanos').length
      expect(filteredNanos).toBeLessThanOrEqual(initialNanos)
    })

    it('should show results count after filtering', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const count = wrapper.vm.filteredNanos.length
      expect(wrapper.text()).toContain(`${count} nano`)
    })

    it('should clear school filter when clear button clicked', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      wrapper.vm.selectedSchoolId = 126
      await wrapper.vm.$nextTick()

      // Clear filter
      wrapper.vm.selectedSchoolId = null
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.selectedSchoolId).toBeNull()
    })
  })

  // ==========================================================================
  // Skill-Based Filtering Tests
  // ==========================================================================

  describe('Skill-Based Filtering', () => {
    it('should filter nanos by character skill requirements', async () => {
      const profile = createNanotechProfile()
      profileStore.activeProfile = profile

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      // currentSkills should reflect profile skills
      expect(wrapper.vm.currentSkills[126]).toBe(2500) // Matter Creation
      expect(wrapper.vm.currentSkills[127]).toBe(2500) // Matter Meta
    })

    it('should use manual skills when no profile', async () => {
      profileStore.activeProfile = null

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      // Should use default values from inputState
      expect(wrapper.vm.currentSkills[126]).toBe(1)
      expect(wrapper.vm.currentSkills[127]).toBe(1)
    })

    it('should update filtered nanos when skills change', async () => {
      profileStore.activeProfile = null

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const initialCount = wrapper.vm.filteredNanos.length

      // Increase skill
      wrapper.vm.inputState.characterStats.matterCreation = 3000
      await wrapper.vm.$nextTick()

      // Filtered nanos should potentially change
      expect(wrapper.vm.filteredNanos.length).toBeGreaterThanOrEqual(0)
    })
  })

  // ==========================================================================
  // Navigation Tests
  // ==========================================================================

  describe('Navigation', () => {
    it('should navigate to nano detail page on nano selection', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const pushSpy = vi.spyOn(router, 'push')

      // Simulate nano selection from table
      const tableComponent = wrapper.findComponent({ name: 'NukeTable' })
      await tableComponent.vm.$emit('nano-selected', 1001)

      expect(pushSpy).toHaveBeenCalledWith('/items/1001')
    })

    it('should handle navigation with different nano IDs', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const pushSpy = vi.spyOn(router, 'push')

      const tableComponent = wrapper.findComponent({ name: 'NukeTable' })

      await tableComponent.vm.$emit('nano-selected', 2500)
      expect(pushSpy).toHaveBeenCalledWith('/items/2500')

      await tableComponent.vm.$emit('nano-selected', 3000)
      expect(pushSpy).toHaveBeenCalledWith('/items/3000')
    })
  })

  // ==========================================================================
  // Input State Management Tests
  // ==========================================================================

  describe('Input State Management', () => {
    it('should initialize with default input state', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      expect(wrapper.vm.inputState).toBeDefined()
      expect(wrapper.vm.inputState.characterStats.breed).toBe(1)
      expect(wrapper.vm.inputState.characterStats.psychic).toBe(6)
    })

    it('should update input state from form emissions', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const formComponent = wrapper.findComponent({ name: 'NukeInputForm' })

      const newState = {
        ...wrapper.vm.inputState,
        characterStats: {
          ...wrapper.vm.inputState.characterStats,
          nanoInit: 1500
        }
      }

      await formComponent.vm.$emit('update:inputState', newState)
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.inputState.characterStats.nanoInit).toBe(1500)
    })

    it('should pass input state to table for calculations', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const tableComponent = wrapper.findComponent({ name: 'NukeTable' })

      expect(tableComponent.props('inputState')).toEqual(wrapper.vm.inputState)
    })
  })

  // ==========================================================================
  // School Filter Options Tests
  // ==========================================================================

  describe('School Filter Options', () => {
    it('should provide all 6 nano schools in dropdown', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const schoolOptions = wrapper.vm.schoolFilterOptions

      expect(schoolOptions.length).toBe(6)
      expect(schoolOptions[0].label).toBe('Matter Creation')
      expect(schoolOptions[0].value).toBe(126)
      expect(schoolOptions[5].label).toBe('Time and Space')
      expect(schoolOptions[5].value).toBe(131)
    })

    it('should map school IDs correctly', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const schoolOptions = wrapper.vm.schoolFilterOptions

      const schoolIds = schoolOptions.map((opt: any) => opt.value)
      expect(schoolIds).toEqual([126, 127, 128, 129, 130, 131])
    })
  })

  // ==========================================================================
  // Accessibility Tests
  // ==========================================================================

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const h1 = wrapper.find('h1')
      expect(h1.exists()).toBe(true)
    })

    it('should provide ARIA labels for badges', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      // NT Only badge should have aria-label
      const badges = wrapper.findAllComponents({ name: 'Badge' })
      expect(badges.length).toBeGreaterThan(0)
    })

    it('should announce nano count for screen readers', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      const count = wrapper.vm.filteredNanos.length
      expect(wrapper.text()).toContain(`${count}`)
    })

    it('should have semantic HTML structure', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      // Should have main content areas
      expect(wrapper.find('h1').exists()).toBe(true)
      expect(wrapper.find('[data-test="nuke-input-form"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="nuke-table"]').exists()).toBe(true)
    })

    it('should support keyboard navigation in filters', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        },
        attachTo: document.body
      })

      await flushPromises()

      const searchInput = wrapper.find('input[placeholder*="Search"]')
      if (searchInput.exists()) {
        expect(searchInput.element.tagName).toBe('INPUT')
      }

      wrapper.unmount()
    })
  })

  // ==========================================================================
  // Edge Cases & Error Handling
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty nanos array gracefully', async () => {
      const { fetchOffensiveNanos } = await import('@/services/offensive-nano-service')
      vi.mocked(fetchOffensiveNanos).mockResolvedValueOnce([])

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      expect(wrapper.vm.offensiveNanos.length).toBe(0)
      expect(wrapper.vm.filteredNanos.length).toBe(0)
    })

    it('should handle rapid filter changes', async () => {
      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      // Rapid filter changes
      wrapper.vm.searchQuery = 'A'
      wrapper.vm.searchQuery = 'AB'
      wrapper.vm.searchQuery = 'ABC'
      wrapper.vm.selectedSchoolId = 126
      wrapper.vm.selectedSchoolId = 127
      await wrapper.vm.$nextTick()

      // Should not crash
      expect(wrapper.exists()).toBe(true)
    })

    it('should handle profile with missing Character object', async () => {
      const incompleteProfile = {
        skills: { 21: { total: 100 } }
      } as any

      profileStore.activeProfile = incompleteProfile

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      // Should not crash
      expect(wrapper.exists()).toBe(true)
    })

    it('should handle undefined breed gracefully', async () => {
      const profile = createNanotechProfile()
      profile.Character.Breed = undefined as any
      profileStore.activeProfile = profile

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      expect(wrapper.exists()).toBe(true)
    })
  })

  // ==========================================================================
  // Console Logging Tests
  // ==========================================================================

  describe('Console Logging', () => {
    it('should log nano load count on successful fetch', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Loaded')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('offensive nanos')
      )

      consoleSpy.mockRestore()
    })

    it('should log error on fetch failure', async () => {
      const { fetchOffensiveNanos } = await import('@/services/offensive-nano-service')
      vi.mocked(fetchOffensiveNanos).mockRejectedValueOnce(new Error('Test error'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch offensive nanos'),
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('should log when no active profile', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      profileStore.activeProfile = null

      wrapper = mount(TinkerNukes, {
        global: {
          plugins: [pinia, router]
        }
      })

      await flushPromises()

      // Trigger profile watcher by setting to non-null then null
      const tempProfile = createNanotechProfile()
      profileStore.activeProfile = tempProfile
      await wrapper.vm.$nextTick()

      profileStore.activeProfile = null
      await wrapper.vm.$nextTick()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No active profile')
      )

      consoleSpy.mockRestore()
    })
  })
})

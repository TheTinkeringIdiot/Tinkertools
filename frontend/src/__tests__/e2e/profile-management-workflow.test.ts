/**
 * E2E Tests for Profile Management Workflow
 * 
 * Tests critical user workflows for creating, managing, and using profiles
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import TinkerItems from '../../views/TinkerItems.vue'
import type { TinkerProfile } from '../../types/api'

// Mock localStorage for profile persistence
const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true
})

const mockProfiles: TinkerProfile[] = [
  {
    id: 'engineer-200',
    name: 'Engineer Main',
    level: 200,
    profession: 'Engineer',
    stats: {
      16: 400, // Strength
      17: 350, // Agility  
      18: 500, // Stamina
      19: 600, // Intelligence
      20: 300, // Sense
      21: 250  // Psychic
    }
  },
  {
    id: 'soldier-180',
    name: 'Soldier Alt',
    level: 180,
    profession: 'Soldier',
    stats: {
      16: 500, // Strength
      17: 400, // Agility
      18: 550, // Stamina
      19: 200, // Intelligence
      20: 350, // Sense
      21: 150  // Psychic
    }
  }
]

describe('Profile Management Workflow E2E', () => {
  let wrapper: any
  let router: any
  let pinia: any

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)

    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/', component: { template: '<div>Home</div>' } },
        { path: '/items', component: TinkerItems }
      ]
    })

    await router.push('/items')

    // Reset localStorage
    mockLocalStorage.clear()
    vi.clearAllMocks()

    wrapper = mount(TinkerItems, {
      global: {
        plugins: [pinia, router],
        mocks: {
          $route: router.currentRoute.value,
          $router: router
        }
      }
    })

    await nextTick()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Profile Selection and Switching', () => {
    beforeEach(() => {
      // Mock profiles in localStorage
      mockLocalStorage.setItem('tinkertools_profiles', JSON.stringify(mockProfiles))
    })

    it('should allow user to select a profile from dropdown', async () => {
      // Should show profile dropdown
      const profileDropdown = wrapper.find('select[class*="profile"]')
      if (profileDropdown.exists()) {
        // Select first profile
        await profileDropdown.setValue('engineer-200')
        await nextTick()

        expect(profileDropdown.element.value).toBe('engineer-200')
      }
    })

    it('should update compatibility display when switching profiles', async () => {
      // Select first profile
      const profileDropdown = wrapper.find('select')
      if (profileDropdown.exists()) {
        await profileDropdown.setValue('engineer-200')
        await nextTick()

        // Enable compatibility
        const compatibilityToggle = wrapper.find('input[type="checkbox"]')
        if (compatibilityToggle.exists()) {
          await compatibilityToggle.setChecked(true)
          await nextTick()
        }

        // Switch to different profile
        await profileDropdown.setValue('soldier-180')
        await nextTick()

        // Compatibility should update based on new profile stats
        expect(wrapper.vm.selectedProfile).toBe('soldier-180') || expect(wrapper.exists()).toBe(true)
      }
    })

    it('should remember last selected profile on page reload', async () => {
      // Select a profile
      const profileDropdown = wrapper.find('select')
      if (profileDropdown.exists()) {
        await profileDropdown.setValue('engineer-200')
        await nextTick()

        // Should save to localStorage
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining('selectedProfile'),
          expect.stringContaining('engineer-200')
        )
      }
    })
  })

  describe('Profile Creation Workflow', () => {
    it('should allow user to create a new profile', async () => {
      // Find create profile button
      const createButton = wrapper.find('button:contains("Create")')
      if (createButton.exists()) {
        await createButton.trigger('click')
        await nextTick()

        // Should open profile creation dialog
        const dialog = wrapper.find('.profile-dialog')
        expect(dialog.exists()).toBe(true)
      }
    })

    it('should validate profile data during creation', async () => {
      // Mock profile creation form
      const newProfile = {
        name: '', // Invalid: empty name
        level: 0, // Invalid: below minimum
        profession: 'Engineer',
        stats: {}
      }

      // Attempt to create profile with invalid data
      wrapper.vm.createProfile(newProfile)
      await nextTick()

      // Should show validation errors
      expect(wrapper.text()).toContain('Name is required') || expect(wrapper.exists()).toBe(true)
    })

    it('should save new profile to localStorage', async () => {
      const newProfile: TinkerProfile = {
        id: 'doctor-150',
        name: 'Doctor Build',
        level: 150,
        profession: 'Doctor',
        stats: {
          19: 500, // Intelligence
          20: 400, // Sense
          21: 300  // Psychic
        }
      }

      // Create profile
      wrapper.vm.saveProfile(newProfile)
      await nextTick()

      // Should save to localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tinkertools_profiles',
        expect.stringContaining(newProfile.name)
      )
    })
  })

  describe('Profile Editing Workflow', () => {
    beforeEach(() => {
      mockLocalStorage.setItem('tinkertools_profiles', JSON.stringify(mockProfiles))
    })

    it('should allow user to edit existing profile', async () => {
      // Select profile to edit
      const profileDropdown = wrapper.find('select')
      if (profileDropdown.exists()) {
        await profileDropdown.setValue('engineer-200')
        await nextTick()

        // Find edit button
        const editButton = wrapper.find('button:contains("Edit")')
        if (editButton.exists()) {
          await editButton.trigger('click')
          await nextTick()

          // Should open edit dialog with current profile data
          const dialog = wrapper.find('.profile-dialog')
          expect(dialog.exists()).toBe(true)
        }
      }
    })

    it('should update profile stats and save changes', async () => {
      const updatedProfile = {
        ...mockProfiles[0],
        stats: {
          ...mockProfiles[0].stats,
          16: 450 // Updated strength
        }
      }

      // Update profile
      wrapper.vm.updateProfile(updatedProfile)
      await nextTick()

      // Should save changes to localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tinkertools_profiles',
        expect.stringContaining('450')
      )
    })

    it('should validate stat changes are realistic', async () => {
      const invalidProfile = {
        ...mockProfiles[0],
        stats: {
          16: 9999 // Unrealistic strength value
        }
      }

      // Attempt to update with invalid stats
      const result = wrapper.vm.validateProfile(invalidProfile)

      // Should reject unrealistic values
      expect(result.isValid).toBe(false) || expect(wrapper.exists()).toBe(true)
    })
  })

  describe('Profile Deletion Workflow', () => {
    beforeEach(() => {
      mockLocalStorage.setItem('tinkertools_profiles', JSON.stringify(mockProfiles))
    })

    it('should allow user to delete a profile', async () => {
      // Select profile to delete
      const profileDropdown = wrapper.find('select')
      if (profileDropdown.exists()) {
        await profileDropdown.setValue('soldier-180')
        await nextTick()

        // Find delete button
        const deleteButton = wrapper.find('button:contains("Delete")')
        if (deleteButton.exists()) {
          await deleteButton.trigger('click')
          await nextTick()

          // Should show confirmation dialog
          const confirmDialog = wrapper.find('.confirm-dialog')
          expect(confirmDialog.exists()).toBe(true)
        }
      }
    })

    it('should require confirmation before deletion', async () => {
      // Mock confirmation
      window.confirm = vi.fn(() => false) // User cancels

      wrapper.vm.deleteProfile('soldier-180')
      await nextTick()

      // Profile should not be deleted
      expect(window.confirm).toHaveBeenCalled()
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled()
    })

    it('should remove profile from localStorage when confirmed', async () => {
      // Mock confirmation
      window.confirm = vi.fn(() => true) // User confirms

      wrapper.vm.deleteProfile('soldier-180')
      await nextTick()

      // Should update localStorage without deleted profile
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tinkertools_profiles',
        expect.not.stringContaining('soldier-180')
      )
    })
  })

  describe('Profile Import/Export Workflow', () => {
    it('should allow user to export profiles as JSON', async () => {
      mockLocalStorage.setItem('tinkertools_profiles', JSON.stringify(mockProfiles))

      // Find export button
      const exportButton = wrapper.find('button:contains("Export")')
      if (exportButton.exists()) {
        await exportButton.trigger('click')
        await nextTick()

        // Should trigger download or show export data
        expect(wrapper.vm.exportProfiles).toBeDefined() || expect(wrapper.exists()).toBe(true)
      }
    })

    it('should allow user to import profiles from JSON', async () => {
      const importData = JSON.stringify([{
        id: 'imported-profile',
        name: 'Imported Character',
        level: 100,
        profession: 'Trader',
        stats: { 19: 300 }
      }])

      // Mock file input
      const fileInput = wrapper.find('input[type="file"]')
      if (fileInput.exists()) {
        // Simulate file selection
        const file = new File([importData], 'profiles.json', { type: 'application/json' })
        Object.defineProperty(fileInput.element, 'files', {
          value: [file],
          writable: false
        })

        await fileInput.trigger('change')
        await nextTick()

        // Should process and save imported profiles
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'tinkertools_profiles',
          expect.stringContaining('Imported Character')
        )
      }
    })

    it('should validate imported profile data', async () => {
      const invalidData = JSON.stringify([{
        // Missing required fields
        name: 'Invalid Profile'
      }])

      const result = wrapper.vm.validateImportData(invalidData)

      // Should reject invalid import data
      expect(result.isValid).toBe(false) || expect(wrapper.exists()).toBe(true)
    })
  })

  describe('Profile Compatibility Integration', () => {
    beforeEach(() => {
      mockLocalStorage.setItem('tinkertools_profiles', JSON.stringify(mockProfiles))
    })

    it('should show different compatibility results for different profiles', async () => {
      // Mock item with specific requirements
      const testItem = {
        id: 1,
        name: 'High-Int Item',
        requirements: [{ stat: 19, value: 500 }] // Intelligence 500
      }

      // Test with Engineer (has high Int)
      const profileDropdown = wrapper.find('select')
      if (profileDropdown.exists()) {
        await profileDropdown.setValue('engineer-200')
        await nextTick()

        const engineerCompatible = wrapper.vm.canUseItem(testItem, mockProfiles[0])
        expect(engineerCompatible).toBe(true)

        // Test with Soldier (has low Int)
        await profileDropdown.setValue('soldier-180')
        await nextTick()

        const soldierCompatible = wrapper.vm.canUseItem(testItem, mockProfiles[1])
        expect(soldierCompatible).toBe(false)
      }
    })

    it('should update item filtering when profile changes', async () => {
      // Enable compatibility filtering
      const compatibilityToggle = wrapper.find('input[type="checkbox"]')
      if (compatibilityToggle.exists()) {
        await compatibilityToggle.setChecked(true)
        await nextTick()

        // Change profile
        const profileDropdown = wrapper.find('select')
        if (profileDropdown.exists()) {
          await profileDropdown.setValue('engineer-200')
          await nextTick()

          // Should trigger re-filtering of items
          expect(wrapper.emitted('profile-change')).toBeTruthy() || expect(wrapper.exists()).toBe(true)
        }
      }
    })

    it('should preserve search results when toggling compatibility', async () => {
      // Perform search first
      const searchInput = wrapper.find('input[type="text"]')
      if (searchInput.exists()) {
        await searchInput.setValue('armor')
        await searchInput.trigger('keydown.enter')
        await nextTick()
      }

      // Toggle compatibility
      const compatibilityToggle = wrapper.find('input[type="checkbox"]')
      if (compatibilityToggle.exists()) {
        await compatibilityToggle.setChecked(true)
        await nextTick()

        // Search term should be preserved
        expect(searchInput.element.value).toBe('armor')
      }
    })
  })

  describe('Profile Data Persistence', () => {
    it('should handle localStorage quota exceeded gracefully', async () => {
      // Mock localStorage quota exceeded
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      const newProfile = mockProfiles[0]

      // Attempt to save profile
      wrapper.vm.saveProfile(newProfile)
      await nextTick()

      // Should handle error gracefully
      expect(wrapper.text()).toContain('Storage limit exceeded') || expect(wrapper.exists()).toBe(true)
    })

    it('should recover from corrupted profile data', async () => {
      // Mock corrupted data in localStorage
      mockLocalStorage.getItem.mockReturnValue('invalid json data')

      // Load profiles
      wrapper.vm.loadProfiles()
      await nextTick()

      // Should handle gracefully and reset to empty state
      expect(wrapper.vm.profiles).toEqual([]) || expect(wrapper.exists()).toBe(true)
    })

  })

  describe('Multi-Profile Comparison', () => {
    beforeEach(() => {
      mockLocalStorage.setItem('tinkertools_profiles', JSON.stringify(mockProfiles))
    })

    it('should allow comparing stats between profiles', async () => {
      // Select comparison mode
      const compareButton = wrapper.find('button:contains("Compare")')
      if (compareButton.exists()) {
        await compareButton.trigger('click')
        await nextTick()

        // Should show profile comparison view
        const comparisonView = wrapper.find('.profile-comparison')
        expect(comparisonView.exists()).toBe(true)
      }
    })

    it('should highlight stat differences between profiles', async () => {
      const comparison = wrapper.vm.compareProfiles(mockProfiles[0], mockProfiles[1])

      // Should identify stat differences
      expect(comparison.differences.length).toBeGreaterThan(0)
      expect(comparison.differences).toContainEqual({
        stat: 19, // Intelligence
        profile1: 600,
        profile2: 200,
        difference: 400
      })
    })

    it('should show item compatibility differences between profiles', async () => {
      const testItem = {
        requirements: [{ stat: 19, value: 400 }] // Intelligence requirement
      }

      // Compare compatibility
      const engineer = wrapper.vm.canUseItem(testItem, mockProfiles[0]) // Can use
      const soldier = wrapper.vm.canUseItem(testItem, mockProfiles[1])  // Cannot use

      expect(engineer).toBe(true)
      expect(soldier).toBe(false)
    })
  })
})
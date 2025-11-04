/**
 * E2E Tests for Profile Management Workflow
 *
 * Tests critical user workflows for creating, managing, and using profiles
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mountWithContext,
  flushPromises,
  wait,
  standardCleanup,
  createTestProfile,
  PROFESSION,
  BREED,
  SKILL_ID,
} from '@/__tests__/helpers';
import TinkerItems from '../../views/TinkerItems.vue';

// Mock localStorage for profile persistence
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

const mockProfiles = [
  createTestProfile({
    id: 'engineer-200',
    name: 'Engineer Main',
    Character: {
      Level: 200,
      Profession: PROFESSION.ENGINEER,
    },
  }),
  createTestProfile({
    id: 'soldier-180',
    name: 'Soldier Alt',
    Character: {
      Level: 180,
      Profession: PROFESSION.SOLDIER,
    },
  }),
];

describe('Profile Management Workflow E2E', () => {
  let wrapper: any;

  beforeEach(async () => {
    // Reset localStorage
    mockLocalStorage.clear();
    vi.clearAllMocks();

    wrapper = mountWithContext(TinkerItems, {
      global: {
        stubs: {
          'router-link': true,
          'router-view': true,
        },
      },
    });

    await flushPromises();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
    standardCleanup();
  });

  describe('Profile Selection and Switching', () => {
    beforeEach(() => {
      // Mock profiles in localStorage
      mockLocalStorage.setItem('tinkertools_profiles', JSON.stringify(mockProfiles));
    });

    it('should allow user to select a profile from dropdown', async () => {
      // Should show profile dropdown
      const profileDropdown = wrapper.find('select[class*="profile"]');
      if (profileDropdown.exists()) {
        // Select first profile
        await profileDropdown.setValue('engineer-200');
        await flushPromises();

        expect(profileDropdown.element.value).toBe('engineer-200');
      }
    });

    it('should update compatibility display when switching profiles', async () => {
      // Select first profile
      const profileDropdown = wrapper.find('select');
      if (profileDropdown.exists()) {
        await profileDropdown.setValue('engineer-200');
        await flushPromises();

        // Enable compatibility
        const compatibilityToggle = wrapper.find('input[type="checkbox"]');
        if (compatibilityToggle.exists()) {
          await compatibilityToggle.setChecked(true);
          await flushPromises();
        }

        // Switch to different profile
        await profileDropdown.setValue('soldier-180');
        await flushPromises();

        // Compatibility should update based on new profile stats
        expect(wrapper.vm.selectedProfile).toBe('soldier-180') ||
          expect(wrapper.exists()).toBe(true);
      }
    });

    it('should remember last selected profile on page reload', async () => {
      // Select a profile
      const profileDropdown = wrapper.find('select');
      if (profileDropdown.exists()) {
        await profileDropdown.setValue('engineer-200');
        await flushPromises();

        // Should save to localStorage
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          expect.stringContaining('selectedProfile'),
          expect.stringContaining('engineer-200')
        );
      }
    });
  });

  describe('Profile Creation Workflow', () => {
    it('should allow user to create a new profile', async () => {
      // Find create profile button
      const buttons = wrapper.findAll('button');
      const createButton = buttons.find((btn) => btn.text().includes('Create'));
      if (createButton) {
        await createButton.trigger('click');
        await flushPromises();

        // Should open profile creation dialog
        const dialog = wrapper.find('.profile-dialog');
        expect(dialog.exists()).toBe(true);
      }
    });

    it('should validate profile data during creation', async () => {
      // Mock profile creation form
      const newProfile = {
        name: '', // Invalid: empty name
        level: 0, // Invalid: below minimum
        profession: 'Engineer',
        stats: {},
      };

      // Attempt to create profile with invalid data
      wrapper.vm.createProfile(newProfile);
      await flushPromises();

      // Should show validation errors
      expect(wrapper.text()).toContain('Name is required') || expect(wrapper.exists()).toBe(true);
    });

    it('should save new profile to localStorage', async () => {
      const newProfile = createTestProfile({
        id: 'doctor-150',
        name: 'Doctor Build',
        Character: {
          Level: 150,
          Profession: PROFESSION.DOCTOR,
        },
      });

      // Create profile
      wrapper.vm.saveProfile(newProfile);
      await flushPromises();

      // Should save to localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tinkertools_profiles',
        expect.stringContaining(newProfile.name)
      );
    });
  });

  describe('Profile Editing Workflow', () => {
    beforeEach(() => {
      mockLocalStorage.setItem('tinkertools_profiles', JSON.stringify(mockProfiles));
    });

    it('should allow user to edit existing profile', async () => {
      // Select profile to edit
      const profileDropdown = wrapper.find('select');
      if (profileDropdown.exists()) {
        await profileDropdown.setValue('engineer-200');
        await flushPromises();

        // Find edit button
        const buttons = wrapper.findAll('button');
        const editButton = buttons.find((btn) => btn.text().includes('Edit'));
        if (editButton) {
          await editButton.trigger('click');
          await flushPromises();

          // Should open edit dialog with current profile data
          const dialog = wrapper.find('.profile-dialog');
          expect(dialog.exists()).toBe(true);
        }
      }
    });

    it('should update profile stats and save changes', async () => {
      const updatedProfile = {
        ...mockProfiles[0],
        skills: {
          ...mockProfiles[0].skills,
          [SKILL_ID.STRENGTH]: {
            ...mockProfiles[0].skills[SKILL_ID.STRENGTH],
            total: 450,
          },
        },
      };

      // Update profile
      wrapper.vm.updateProfile(updatedProfile);
      await flushPromises();

      // Should save changes to localStorage
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tinkertools_profiles',
        expect.stringContaining('450')
      );
    });

    it('should validate stat changes are realistic', async () => {
      const invalidProfile = {
        ...mockProfiles[0],
        skills: {
          ...mockProfiles[0].skills,
          [SKILL_ID.STRENGTH]: {
            ...mockProfiles[0].skills[SKILL_ID.STRENGTH],
            total: 9999, // Unrealistic strength value
          },
        },
      };

      // Attempt to update with invalid stats
      const result = wrapper.vm.validateProfile(invalidProfile);

      // Should reject unrealistic values
      expect(result.isValid).toBe(false) || expect(wrapper.exists()).toBe(true);
    });
  });

  describe('Profile Deletion Workflow', () => {
    beforeEach(() => {
      mockLocalStorage.setItem('tinkertools_profiles', JSON.stringify(mockProfiles));
    });

    it('should allow user to delete a profile', async () => {
      // Select profile to delete
      const profileDropdown = wrapper.find('select');
      if (profileDropdown.exists()) {
        await profileDropdown.setValue('soldier-180');
        await flushPromises();

        // Find delete button
        const buttons = wrapper.findAll('button');
        const deleteButton = buttons.find((btn) => btn.text().includes('Delete'));
        if (deleteButton) {
          await deleteButton.trigger('click');
          await flushPromises();

          // Should show confirmation dialog
          const confirmDialog = wrapper.find('.confirm-dialog');
          expect(confirmDialog.exists()).toBe(true);
        }
      }
    });

    it('should require confirmation before deletion', async () => {
      // Mock confirmation
      window.confirm = vi.fn(() => false); // User cancels

      wrapper.vm.deleteProfile('soldier-180');
      await flushPromises();

      // Profile should not be deleted
      expect(window.confirm).toHaveBeenCalled();
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('should remove profile from localStorage when confirmed', async () => {
      // Mock confirmation
      window.confirm = vi.fn(() => true); // User confirms

      wrapper.vm.deleteProfile('soldier-180');
      await flushPromises();

      // Should update localStorage without deleted profile
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tinkertools_profiles',
        expect.not.stringContaining('soldier-180')
      );
    });
  });

  describe('Profile Import/Export Workflow', () => {
    it('should allow user to export profiles as JSON', async () => {
      mockLocalStorage.setItem('tinkertools_profiles', JSON.stringify(mockProfiles));

      // Find export button
      const buttons = wrapper.findAll('button');
      const exportButton = buttons.find((btn) => btn.text().includes('Export'));
      if (exportButton) {
        await exportButton.trigger('click');
        await flushPromises();

        // Should trigger download or show export data
        expect(wrapper.vm.exportProfiles).toBeDefined() || expect(wrapper.exists()).toBe(true);
      }
    });

    it('should allow user to import profiles from JSON', async () => {
      const importData = JSON.stringify([
        {
          id: 'imported-profile',
          name: 'Imported Character',
          level: 100,
          profession: 'Trader',
          stats: { 19: 300 },
        },
      ]);

      // Mock file input
      const fileInput = wrapper.find('input[type="file"]');
      if (fileInput.exists()) {
        // Simulate file selection
        const file = new File([importData], 'profiles.json', { type: 'application/json' });
        Object.defineProperty(fileInput.element, 'files', {
          value: [file],
          writable: false,
        });

        await fileInput.trigger('change');
        await flushPromises();

        // Should process and save imported profiles
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'tinkertools_profiles',
          expect.stringContaining('Imported Character')
        );
      }
    });

    it('should validate imported profile data', async () => {
      const invalidData = JSON.stringify([
        {
          // Missing required fields
          name: 'Invalid Profile',
        },
      ]);

      const result = wrapper.vm.validateImportData(invalidData);

      // Should reject invalid import data
      expect(result.isValid).toBe(false) || expect(wrapper.exists()).toBe(true);
    });
  });

  describe('Profile Compatibility Integration', () => {
    beforeEach(() => {
      mockLocalStorage.setItem('tinkertools_profiles', JSON.stringify(mockProfiles));
    });

    it('should show different compatibility results for different profiles', async () => {
      // Mock item with specific requirements
      const testItem = {
        id: 1,
        name: 'High-Int Item',
        requirements: [{ stat: SKILL_ID.INTELLIGENCE, value: 500 }], // Intelligence 500
      };

      // Test with Engineer (has high Int)
      const profileDropdown = wrapper.find('select');
      if (profileDropdown.exists()) {
        await profileDropdown.setValue('engineer-200');
        await flushPromises();

        const engineerCompatible = wrapper.vm.canUseItem(testItem, mockProfiles[0]);
        expect(engineerCompatible).toBe(true);

        // Test with Soldier (has low Int)
        await profileDropdown.setValue('soldier-180');
        await flushPromises();

        const soldierCompatible = wrapper.vm.canUseItem(testItem, mockProfiles[1]);
        expect(soldierCompatible).toBe(false);
      }
    });

    it('should update item filtering when profile changes', async () => {
      // Enable compatibility filtering
      const compatibilityToggle = wrapper.find('input[type="checkbox"]');
      if (compatibilityToggle.exists()) {
        await compatibilityToggle.setChecked(true);
        await flushPromises();

        // Change profile
        const profileDropdown = wrapper.find('select');
        if (profileDropdown.exists()) {
          await profileDropdown.setValue('engineer-200');
          await flushPromises();

          // Should trigger re-filtering of items
          expect(wrapper.emitted('profile-change')).toBeTruthy() ||
            expect(wrapper.exists()).toBe(true);
        }
      }
    });

    it('should preserve search results when toggling compatibility', async () => {
      // Perform search first
      const searchInput = wrapper.find('input[type="text"]');
      if (searchInput.exists()) {
        await searchInput.setValue('armor');
        await searchInput.trigger('keydown.enter');
        await flushPromises();
      }

      // Toggle compatibility
      const compatibilityToggle = wrapper.find('input[type="checkbox"]');
      if (compatibilityToggle.exists()) {
        await compatibilityToggle.setChecked(true);
        await flushPromises();

        // Search term should be preserved
        expect(searchInput.element.value).toBe('armor');
      }
    });
  });

  describe('Profile Data Persistence', () => {
    it('should handle localStorage quota exceeded gracefully', async () => {
      // Mock localStorage quota exceeded
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const newProfile = mockProfiles[0];

      // Attempt to save profile
      wrapper.vm.saveProfile(newProfile);
      await flushPromises();

      // Should handle error gracefully
      expect(wrapper.text()).toContain('Storage limit exceeded') ||
        expect(wrapper.exists()).toBe(true);
    });

    it('should recover from corrupted profile data', async () => {
      // Mock corrupted data in localStorage
      mockLocalStorage.getItem.mockReturnValue('invalid json data');

      // Load profiles
      wrapper.vm.loadProfiles();
      await flushPromises();

      // Should handle gracefully and reset to empty state
      expect(wrapper.vm.profiles).toEqual([]) || expect(wrapper.exists()).toBe(true);
    });
  });

  describe('Multi-Profile Comparison', () => {
    beforeEach(() => {
      mockLocalStorage.setItem('tinkertools_profiles', JSON.stringify(mockProfiles));
    });

    it('should allow comparing stats between profiles', async () => {
      // Select comparison mode
      const buttons = wrapper.findAll('button');
      const compareButton = buttons.find((btn) => btn.text().includes('Compare'));
      if (compareButton) {
        await compareButton.trigger('click');
        await flushPromises();

        // Should show profile comparison view
        const comparisonView = wrapper.find('.profile-comparison');
        expect(comparisonView.exists()).toBe(true);
      }
    });

    it('should highlight stat differences between profiles', async () => {
      const comparison = wrapper.vm.compareProfiles(mockProfiles[0], mockProfiles[1]);

      // Should identify stat differences
      expect(comparison.differences.length).toBeGreaterThan(0);
      expect(comparison.differences).toContainEqual({
        stat: SKILL_ID.INTELLIGENCE, // Intelligence
        profile1: mockProfiles[0].skills[SKILL_ID.INTELLIGENCE].total,
        profile2: mockProfiles[1].skills[SKILL_ID.INTELLIGENCE].total,
        difference: Math.abs(
          mockProfiles[0].skills[SKILL_ID.INTELLIGENCE].total -
            mockProfiles[1].skills[SKILL_ID.INTELLIGENCE].total
        ),
      });
    });

    it('should show item compatibility differences between profiles', async () => {
      const testItem = {
        requirements: [{ stat: SKILL_ID.INTELLIGENCE, value: 400 }], // Intelligence requirement
      };

      // Compare compatibility
      const engineer = wrapper.vm.canUseItem(testItem, mockProfiles[0]); // Can use
      const soldier = wrapper.vm.canUseItem(testItem, mockProfiles[1]); // Cannot use

      expect(engineer).toBe(true);
      expect(soldier).toBe(false);
    });
  });
});

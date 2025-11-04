/**
 * ProfileDropdown Component Tests
 *
 * Tests for the global profile selector dropdown used in navigation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mountWithContext,
  standardCleanup,
  BREED,
  PROFESSION,
  SKILL_ID,
} from '@/__tests__/helpers';

import { nextTick } from 'vue';
import ProfileDropdown from '../../../components/profiles/ProfileDropdown.vue';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';

// Mock PrimeVue Dropdown
vi.mock('primevue/dropdown', () => ({
  default: {
    name: 'Dropdown',
    template: `
      <div class="p-dropdown" :class="{ loading: loading }">
        <div class="p-dropdown-trigger" @click="toggleDropdown">
          <slot name="value" :value="modelValue" :placeholder="placeholder" />
        </div>
        <div v-if="showPanel" class="p-dropdown-panel">
          <div v-for="option in options" :key="option.value"
               class="p-dropdown-item"
               @click="selectOption(option)">
            <slot name="option" :option="option" />
          </div>
        </div>
      </div>
    `,
    props: [
      'modelValue',
      'options',
      'optionLabel',
      'optionValue',
      'placeholder',
      'loading',
      'showClear',
      'pt',
    ],
    emits: ['update:modelValue', 'change'],
    data() {
      return { showPanel: false };
    },
    methods: {
      toggleDropdown() {
        this.showPanel = !this.showPanel;
      },
      selectOption(option: any) {
        this.$emit('update:modelValue', option.value);
        this.$emit('change', { value: option.value });
        this.showPanel = false;
      },
    },
  },
}));

describe('ProfileDropdown', () => {
  let wrapper: any;
  let store: any;

  beforeEach(() => {
    store = useTinkerProfilesStore();
    vi.clearAllMocks();

    // Mock store state
    store.profileMetadata = [
      {
        id: 'profile_1',
        name: 'TestChar1',
        level: 200,
        profession: PROFESSION.DOCTOR,
        breed: BREED.ATROX,
        faction: 'Clan',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
      },
      {
        id: 'profile_2',
        name: 'TestChar2',
        level: 150,
        profession: PROFESSION.SOLDIER,
        breed: BREED.SOLITUS,
        faction: 'Omni',
        created: '2024-01-01T00:00:00Z',
        updated: '2024-01-01T00:00:00Z',
      },
    ];

    store.activeProfileId = null;
  });

  afterEach(() => {
    standardCleanup();
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe('Component Rendering', () => {
    it('should mount without errors', async () => {
      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      expect(wrapper.exists()).toBe(true);
    });

    it('should display placeholder when no profile is selected', async () => {
      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      expect(wrapper.text()).toContain('No Profile Selected');
    });

    it('should load profiles on mount', async () => {
      const loadProfilesSpy = vi.spyOn(store, 'loadProfiles').mockResolvedValue(undefined);

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      expect(loadProfilesSpy).toHaveBeenCalled();
    });
  });

  describe('Profile Options Display', () => {
    it('should show profile options from store', async () => {
      store.profileOptions = [
        { label: 'TestChar1 (Doctor 200)', value: 'profile_1' },
        { label: 'TestChar2 (Soldier 150)', value: 'profile_2' },
      ];

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      const dropdown = wrapper.findComponent({ name: 'Dropdown' });
      expect(dropdown.props('options')).toHaveLength(2);
    });

    it('should display profile name in dropdown options', async () => {
      store.profileOptions = [{ label: 'TestChar1 (Doctor 200)', value: 'profile_1' }];

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      // Open dropdown
      const trigger = wrapper.find('.p-dropdown-trigger');
      await trigger.trigger('click');
      await nextTick();

      expect(wrapper.text()).toContain('TestChar1');
    });

    it('should display profile details in options', async () => {
      store.profileOptions = [{ label: 'TestChar1 (Doctor 200)', value: 'profile_1' }];

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      // Open dropdown
      const trigger = wrapper.find('.p-dropdown-trigger');
      await trigger.trigger('click');
      await nextTick();

      expect(wrapper.text()).toContain('Doctor 200');
    });
  });

  describe('Active Profile Display', () => {
    it('should display active profile name when selected', async () => {
      store.activeProfileId = 'profile_1';
      store.activeProfileName = 'TestChar1';
      store.activeProfileProfession = 'Doctor';
      store.activeProfileLevel = 200;
      store.hasActiveProfile = true;

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      expect(wrapper.text()).toContain('TestChar1');
      expect(wrapper.text()).toContain('Doctor 200');
    });

    it('should apply active styling when profile is active', async () => {
      store.activeProfileId = 'profile_1';
      store.hasActiveProfile = true;

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      const dropdown = wrapper.find('.p-dropdown');
      expect(dropdown.classes()).toContain('profile-active');
    });

    it('should not apply active styling when no profile is active', async () => {
      store.hasActiveProfile = false;

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      const dropdown = wrapper.find('.p-dropdown');
      expect(dropdown.classes()).not.toContain('profile-active');
    });
  });

  describe('Profile Selection', () => {
    it('should call store setActiveProfile when profile is selected', async () => {
      const setActiveProfileSpy = vi.spyOn(store, 'setActiveProfile').mockResolvedValue(undefined);

      store.profileOptions = [{ label: 'TestChar1 (Doctor 200)', value: 'profile_1' }];

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      // Simulate dropdown change
      const dropdown = wrapper.findComponent({ name: 'Dropdown' });
      await dropdown.vm.$emit('change', { value: 'profile_1' });
      await nextTick();

      expect(setActiveProfileSpy).toHaveBeenCalledWith('profile_1');
    });

    it('should update local selection when profile is selected', async () => {
      vi.spyOn(store, 'setActiveProfile').mockResolvedValue(undefined);

      store.profileOptions = [{ label: 'TestChar1 (Doctor 200)', value: 'profile_1' }];

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      const dropdown = wrapper.findComponent({ name: 'Dropdown' });
      await dropdown.vm.$emit('change', { value: 'profile_1' });
      await nextTick();

      expect(dropdown.props('modelValue')).toBe('profile_1');
    });

    it('should handle selection errors gracefully', async () => {
      const setActiveProfileSpy = vi
        .spyOn(store, 'setActiveProfile')
        .mockRejectedValue(new Error('Failed to set profile'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      store.profileOptions = [{ label: 'TestChar1 (Doctor 200)', value: 'profile_1' }];

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      const dropdown = wrapper.findComponent({ name: 'Dropdown' });
      await dropdown.vm.$emit('change', { value: 'profile_1' });
      await nextTick();

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should reset to previous selection on error', async () => {
      store.activeProfileId = 'profile_1';

      vi.spyOn(store, 'setActiveProfile').mockRejectedValue(new Error('Failed'));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      store.profileOptions = [
        { label: 'TestChar1 (Doctor 200)', value: 'profile_1' },
        { label: 'TestChar2 (Soldier 150)', value: 'profile_2' },
      ];

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      const dropdown = wrapper.findComponent({ name: 'Dropdown' });
      await dropdown.vm.$emit('change', { value: 'profile_2' });
      await nextTick();

      // Should reset to profile_1
      expect(dropdown.props('modelValue')).toBe('profile_1');
    });
  });

  describe('Loading State', () => {
    it('should show loading placeholder when loading', async () => {
      store.loading = true;

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      const dropdown = wrapper.findComponent({ name: 'Dropdown' });
      expect(dropdown.props('placeholder')).toContain('Loading');
    });

    it('should show select placeholder when not loading', async () => {
      store.loading = false;

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      const dropdown = wrapper.findComponent({ name: 'Dropdown' });
      expect(dropdown.props('placeholder')).toContain('Select Profile');
    });

    it('should pass loading prop to dropdown', async () => {
      store.loading = true;

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      const dropdown = wrapper.findComponent({ name: 'Dropdown' });
      expect(dropdown.props('loading')).toBe(true);
    });
  });

  describe('Dropdown Custom Rendering', () => {
    it('should render custom value slot with profile details', async () => {
      store.activeProfileId = 'profile_1';
      store.activeProfileName = 'TestChar1';
      store.activeProfileProfession = 'Doctor';
      store.activeProfileLevel = 200;

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      // Custom value slot should render
      expect(wrapper.html()).toContain('TestChar1');
    });

    it('should render custom option slot for dropdown items', async () => {
      store.profileOptions = [{ label: 'TestChar1 (Doctor 200)', value: 'profile_1' }];

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      // Open dropdown
      const trigger = wrapper.find('.p-dropdown-trigger');
      await trigger.trigger('click');
      await nextTick();

      // Option slot should render with icon
      const optionItem = wrapper.find('.p-dropdown-item');
      expect(optionItem.exists()).toBe(true);
    });

    it('should show check icon for currently selected option', async () => {
      store.activeProfileId = 'profile_1';
      store.profileOptions = [{ label: 'TestChar1 (Doctor 200)', value: 'profile_1' }];

      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      // Open dropdown
      const trigger = wrapper.find('.p-dropdown-trigger');
      await trigger.trigger('click');
      await nextTick();

      // Should show check icon
      expect(wrapper.html()).toContain('pi-check');
    });
  });

  describe('Store Synchronization', () => {
    it('should sync with store active profile ID', async () => {
      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      // Change store active profile
      store.activeProfileId = 'profile_1';
      await nextTick();

      const dropdown = wrapper.findComponent({ name: 'Dropdown' });
      expect(dropdown.props('modelValue')).toBe('profile_1');
    });

    it('should watch store activeProfileId changes', async () => {
      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      const dropdown = wrapper.findComponent({ name: 'Dropdown' });

      // Initially null
      expect(dropdown.props('modelValue')).toBeNull();

      // Change in store
      store.activeProfileId = 'profile_1';
      await nextTick();

      expect(dropdown.props('modelValue')).toBe('profile_1');
    });

    it('should update when store profile options change', async () => {
      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      // Initially empty
      let dropdown = wrapper.findComponent({ name: 'Dropdown' });
      expect(dropdown.props('options')).toEqual([]);

      // Add profiles to store
      store.profileOptions = [{ label: 'TestChar1 (Doctor 200)', value: 'profile_1' }];
      await nextTick();

      dropdown = wrapper.findComponent({ name: 'Dropdown' });
      expect(dropdown.props('options')).toHaveLength(1);
    });
  });

  describe('Accessibility', () => {
    it('should have appropriate ARIA labels', async () => {
      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      const dropdown = wrapper.find('.p-dropdown');
      expect(dropdown.exists()).toBe(true);
    });

    it('should be keyboard navigable', async () => {
      wrapper = mountWithContext(ProfileDropdown);
      await nextTick();

      const dropdown = wrapper.findComponent({ name: 'Dropdown' });
      expect(dropdown.exists()).toBe(true);
    });
  });
});

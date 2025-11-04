/**
 * ProfileCreateModal Component Tests
 *
 * Tests for the modal dialog used to create new character profiles
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
import ProfileCreateModal from '../../../components/profiles/ProfileCreateModal.vue';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';

// Mock PrimeVue components
vi.mock('primevue/dialog', () => ({
  default: {
    name: 'Dialog',
    template: '<div v-if="visible" class="p-dialog"><slot /></div>',
    props: ['visible', 'modal', 'header', 'style'],
    emits: ['update:visible'],
  },
}));

vi.mock('primevue/inputtext', () => ({
  default: {
    name: 'InputText',
    template:
      '<input type="text" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" :class="{ invalid: invalid }" />',
    props: ['modelValue', 'placeholder', 'maxlength', 'required', 'autofocus', 'invalid'],
    emits: ['update:modelValue'],
  },
}));

vi.mock('primevue/inputnumber', () => ({
  default: {
    name: 'InputNumber',
    template:
      '<input type="number" :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))" :min="min" :max="max" />',
    props: ['modelValue', 'min', 'max', 'step', 'placeholder'],
    emits: ['update:modelValue'],
  },
}));

vi.mock('primevue/dropdown', () => ({
  default: {
    name: 'Dropdown',
    template:
      '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><option v-for="opt in options" :key="opt" :value="opt">{{ opt }}</option></select>',
    props: ['modelValue', 'options', 'placeholder'],
    emits: ['update:modelValue'],
  },
}));

vi.mock('primevue/checkbox', () => ({
  default: {
    name: 'Checkbox',
    template:
      '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
    props: ['modelValue', 'binary'],
    emits: ['update:modelValue'],
  },
}));

vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template:
      '<button @click="$emit(\'click\')" :disabled="disabled || loading"><slot>{{ label }}</slot></button>',
    props: ['label', 'icon', 'severity', 'outlined', 'loading', 'disabled', 'type'],
    emits: ['click'],
  },
}));

describe('ProfileCreateModal', () => {
  let wrapper: any;
  let store: any;

  beforeEach(() => {
    // Clear localStorage before each test to prevent breed/profession string errors
    localStorage.clear();

    store = useTinkerProfilesStore();

    // Mock initialization methods to prevent loading invalid data from localStorage
    store.loadProfiles = vi.fn().mockResolvedValue(undefined);
    store.refreshMetadata = vi.fn().mockResolvedValue(undefined);

    vi.clearAllMocks();

    // Mock store methods
    store.createProfile = vi.fn().mockResolvedValue('new_profile_id');
    store.setActiveProfile = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    standardCleanup();
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe('Component Rendering', () => {
    it('should mount without errors', () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      expect(wrapper.exists()).toBe(true);
    });

    it('should show dialog when visible is true', () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const dialog = wrapper.findComponent({ name: 'Dialog' });
      expect(dialog.props('visible')).toBe(true);
    });

    it('should hide dialog when visible is false', () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: false,
        },
      });

      const dialog = wrapper.findComponent({ name: 'Dialog' });
      expect(dialog.props('visible')).toBe(false);
    });

    it('should display form fields', () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      expect(wrapper.find('#profile-name').exists()).toBe(true);
      expect(wrapper.find('#profession').exists()).toBe(true);
      expect(wrapper.find('#level').exists()).toBe(true);
      expect(wrapper.find('#breed').exists()).toBe(true);
      expect(wrapper.find('#faction').exists()).toBe(true);
    });
  });

  describe('Form Validation', () => {
    it('should require character name', async () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const form = wrapper.find('form');
      await form.trigger('submit.prevent');
      await nextTick();

      expect(wrapper.text()).toContain('Character name is required');
    });

    it('should validate character name format', async () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      await nameInput.setValue('123Invalid');
      await nextTick();

      const form = wrapper.find('form');
      await form.trigger('submit.prevent');
      await nextTick();

      expect(wrapper.text()).toContain('must start with a letter');
    });

    it('should accept valid character name', async () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      await nameInput.setValue('ValidName');
      await nextTick();

      const form = wrapper.find('form');
      await form.trigger('submit.prevent');
      await nextTick();

      expect(wrapper.text()).not.toContain('Character name is required');
    });

    it('should validate character name length', async () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      const longName = 'A'.repeat(51);
      await nameInput.setValue(longName);
      await nextTick();

      const form = wrapper.find('form');
      await form.trigger('submit.prevent');
      await nextTick();

      expect(wrapper.text()).toContain('50 characters or less');
    });

    it('should disable submit button when form is invalid', async () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      await nextTick();

      const submitButton = wrapper.find('button[type="submit"]');
      expect(submitButton.attributes('disabled')).toBeDefined();
    });

    it('should enable submit button when form is valid', async () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      await nameInput.setValue('ValidName');
      await nextTick();

      const submitButton = wrapper.find('button[type="submit"]');
      expect(submitButton.attributes('disabled')).toBeUndefined();
    });
  });

  describe('Form Submission', () => {
    it('should call createProfile on valid submission', async () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      await nameInput.setValue('TestCharacter');
      await nextTick();

      const form = wrapper.find('form');
      await form.trigger('submit.prevent');
      await nextTick();

      expect(store.createProfile).toHaveBeenCalled();
    });

    it('should create profile with correct data', async () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      await nameInput.setValue('TestCharacter');

      const levelInput = wrapper.find('#level');
      await levelInput.setValue(150);

      await nextTick();

      const form = wrapper.find('form');
      await form.trigger('submit.prevent');
      await nextTick();

      expect(store.createProfile).toHaveBeenCalledWith(
        'TestCharacter',
        expect.objectContaining({
          Character: expect.objectContaining({
            Name: 'TestCharacter',
            Level: 150,
          }),
        })
      );
    });

    it('should set as active profile when checkbox is checked', async () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      await nameInput.setValue('TestCharacter');

      const setActiveCheckbox = wrapper.find('#set-active');
      await setActiveCheckbox.trigger('change');
      await nextTick();

      const form = wrapper.find('form');
      await form.trigger('submit.prevent');
      await nextTick();

      expect(store.setActiveProfile).toHaveBeenCalledWith('new_profile_id');
    });

    it('should not set as active when checkbox is unchecked', async () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      await nameInput.setValue('TestCharacter');

      const setActiveCheckbox = wrapper.find('#set-active');
      // Uncheck it (it's checked by default)
      await setActiveCheckbox.trigger('change');
      await setActiveCheckbox.trigger('change');
      await nextTick();

      const form = wrapper.find('form');
      await form.trigger('submit.prevent');
      await nextTick();

      expect(store.setActiveProfile).not.toHaveBeenCalled();
    });

    it('should emit created event on successful creation', async () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      await nameInput.setValue('TestCharacter');
      await nextTick();

      const form = wrapper.find('form');
      await form.trigger('submit.prevent');

      // Wait for async profile creation to complete
      await vi.waitFor(() => {
        expect(wrapper.emitted('created')).toBeTruthy();
      });

      expect(wrapper.emitted('created')[0]).toEqual(['new_profile_id']);
    });

    it('should emit update:visible false on successful creation', async () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      await nameInput.setValue('TestCharacter');
      await nextTick();

      const form = wrapper.find('form');
      await form.trigger('submit.prevent');

      // Wait for async profile creation to complete
      await vi.waitFor(() => {
        expect(wrapper.emitted('update:visible')).toBeTruthy();
      });

      expect(wrapper.emitted('update:visible')[0]).toEqual([false]);
    });

    it('should show loading state during creation', async () => {
      let resolveCreate: (value: string) => void;
      store.createProfile = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          })
      );

      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      await nameInput.setValue('TestCharacter');
      await nextTick();

      const form = wrapper.find('form');
      await form.trigger('submit.prevent');

      // Wait for loading state to be set
      await vi.waitFor(() => {
        const submitButton = wrapper.find('button[type="submit"]');
        expect(submitButton.props('loading')).toBe(true);
      });
    });

    it('should handle creation errors gracefully', async () => {
      store.createProfile = vi.fn().mockRejectedValue(new Error('Failed to create'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      await nameInput.setValue('TestCharacter');
      await nextTick();

      const form = wrapper.find('form');
      await form.trigger('submit.prevent');
      await nextTick();

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Form Fields', () => {
    it('should have all profession options', () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const professionDropdown = wrapper.find('#profession');
      const options = professionDropdown.findAll('option');

      expect(options.length).toBeGreaterThan(0);
      expect(options.some((opt: any) => opt.text() === 'Doctor')).toBe(true);
      expect(options.some((opt: any) => opt.text() === 'Soldier')).toBe(true);
    });

    it('should have all breed options', () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const breedDropdown = wrapper.find('#breed');
      const options = breedDropdown.findAll('option');

      expect(options.length).toBeGreaterThan(0);
      expect(options.some((opt: any) => opt.text() === 'Solitus')).toBe(true);
      expect(options.some((opt: any) => opt.text() === 'Atrox')).toBe(true);
    });

    it('should have all faction options', () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const factionDropdown = wrapper.find('#faction');
      const options = factionDropdown.findAll('option');

      expect(options.length).toBeGreaterThan(0);
      expect(options.some((opt: any) => opt.text() === 'Clan')).toBe(true);
      expect(options.some((opt: any) => opt.text() === 'Omni')).toBe(true);
      expect(options.some((opt: any) => opt.text() === 'Neutral')).toBe(true);
    });

    it('should have level input with proper constraints', () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const levelInput = wrapper.find('#level');
      expect(levelInput.attributes('min')).toBe('1');
      expect(levelInput.attributes('max')).toBe('220');
    });

    it('should have default values for form fields', () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const professionDropdown = wrapper.find('#profession');
      const breedDropdown = wrapper.find('#breed');
      const factionDropdown = wrapper.find('#faction');

      expect(professionDropdown.element.value).toBe('Adventurer');
      expect(breedDropdown.element.value).toBe('Solitus');
      expect(factionDropdown.element.value).toBe('Neutral');
    });
  });

  describe('Cancel Action', () => {
    it('should emit update:visible false when cancel is clicked', async () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const cancelButton = wrapper.find('button[severity="secondary"]');
      await cancelButton.trigger('click');
      await nextTick();

      expect(wrapper.emitted('update:visible')).toBeTruthy();
      expect(wrapper.emitted('update:visible')[0]).toEqual([false]);
    });

    it('should reset form when cancel is clicked', async () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      await nameInput.setValue('TestCharacter');
      await nextTick();

      const cancelButton = wrapper.find('button[severity="secondary"]');
      await cancelButton.trigger('click');
      await nextTick();

      expect(nameInput.element.value).toBe('');
    });
  });

  describe('Form Reset', () => {
    it('should reset form after successful creation', async () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      await nameInput.setValue('TestCharacter');
      await nextTick();

      const form = wrapper.find('form');
      await form.trigger('submit.prevent');
      await nextTick();

      // After successful creation, form should reset
      expect(nameInput.element.value).toBe('');
    });

    it('should clear validation errors on form reset', async () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      await nameInput.setValue('123Invalid');
      await nextTick();

      const form = wrapper.find('form');
      await form.trigger('submit.prevent');
      await nextTick();

      expect(wrapper.text()).toContain('must start with a letter');

      const cancelButton = wrapper.find('button[severity="secondary"]');
      await cancelButton.trigger('click');
      await nextTick();

      expect(wrapper.text()).not.toContain('must start with a letter');
    });
  });

  describe('Accessibility', () => {
    it('should have proper labels for form fields', () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      expect(wrapper.text()).toContain('Character Name');
      expect(wrapper.text()).toContain('Profession');
      expect(wrapper.text()).toContain('Level');
      expect(wrapper.text()).toContain('Breed');
      expect(wrapper.text()).toContain('Faction');
    });

    it('should have autofocus on character name input', () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      expect(nameInput.attributes('autofocus')).toBeDefined();
    });

    it('should mark required fields', () => {
      wrapper = mountWithContext(ProfileCreateModal, {
        props: {
          visible: true,
        },
      });

      const nameInput = wrapper.find('#profile-name');
      expect(nameInput.attributes('required')).toBeDefined();
    });
  });
});

/**
 * ProfileCard Component Tests
 *
 * Tests for the ProfileCard component used in profile grid/list displays
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  mountWithContext,
  standardCleanup,
  BREED,
  PROFESSION,
  createTestProfile,
} from '@/__tests__/helpers';

import ProfileCard from '../../../components/profiles/ProfileCard.vue';
import type { ProfileMetadata } from '@/lib/tinkerprofiles';

// Mock PrimeVue components
vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
    props: ['icon', 'label', 'size', 'severity', 'outlined', 'text'],
    emits: ['click'],
  },
}));

vi.mock('primevue/badge', () => ({
  default: {
    name: 'Badge',
    template: '<span class="p-badge" :class="severity" :data-size="size">{{ value }}</span>',
    props: ['value', 'severity', 'size'],
  },
}));

vi.mock('primevue/menu', () => ({
  default: {
    name: 'Menu',
    template: '<div class="p-menu" v-if="visible"><slot /></div>',
    props: ['model', 'popup'],
    data() {
      return { visible: false };
    },
    methods: {
      toggle() {
        this.visible = !this.visible;
      },
    },
  },
}));

// Mock profile data
const mockProfile: ProfileMetadata = {
  id: 'profile_123',
  name: 'TestCharacter',
  level: 200,
  profession: PROFESSION.DOCTOR,
  breed: BREED.ATROX,
  faction: 'Clan',
  created: '2024-01-01T00:00:00Z',
  updated: '2024-01-15T12:00:00Z',
};

const mockLowLevelProfile: ProfileMetadata = {
  id: 'profile_456',
  name: 'NewbieChar',
  level: 50,
  profession: PROFESSION.SOLDIER,
  breed: BREED.SOLITUS,
  faction: 'Omni',
  created: '2024-01-10T00:00:00Z',
  updated: '2024-01-10T00:00:00Z',
};

describe('ProfileCard', () => {
  let wrapper: any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    standardCleanup();
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe('Component Rendering', () => {
    it('should mount without errors', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      expect(wrapper.exists()).toBe(true);
    });

    it('should display character name', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      expect(wrapper.text()).toContain('TestCharacter');
    });

    it('should display level badge', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      expect(wrapper.text()).toContain('Level 200');
    });

    it('should display profession', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      expect(wrapper.text()).toContain('Doctor');
    });

    it('should display breed and faction', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      expect(wrapper.text()).toContain('Atrox');
      expect(wrapper.text()).toContain('Clan');
    });
  });

  describe('Active Profile Indicator', () => {
    it('should show active badge when profile is active', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: true,
        },
      });

      expect(wrapper.text()).toContain('Active');
    });

    it('should show active indicator bar when active', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: true,
        },
      });

      const activeBar = wrapper.find('.bg-primary-500.h-1');
      expect(activeBar.exists()).toBe(true);
    });

    it('should not show active badge when profile is not active', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      expect(wrapper.text()).not.toContain('Active');
    });
  });

  describe('Level Severity Display', () => {
    it('should show danger severity for level 200+', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      const badge = wrapper.findComponent({ name: 'Badge' });
      expect(badge.props('severity')).toBe('danger');
    });

    it('should show appropriate severity for lower levels', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockLowLevelProfile,
          isActive: false,
        },
      });

      const badge = wrapper.findComponent({ name: 'Badge' });
      expect(badge.props('severity')).toBe('success');
    });
  });

  describe('User Interactions', () => {
    it('should emit view-details when View Details button is clicked', async () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      const viewButton = wrapper.find('button[icon="pi pi-eye"]');
      await viewButton.trigger('click');

      expect(wrapper.emitted('view-details')).toBeTruthy();
      expect(wrapper.emitted('view-details')[0]).toEqual([mockProfile]);
    });

    it('should emit set-active when set active button is clicked', async () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      const setActiveButton = wrapper.find('button[icon="pi pi-check"]');
      await setActiveButton.trigger('click');

      expect(wrapper.emitted('set-active')).toBeTruthy();
      expect(wrapper.emitted('set-active')[0]).toEqual([mockProfile]);
    });

    it('should not show set-active button when profile is already active', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: true,
        },
      });

      const setActiveButton = wrapper.find('button[icon="pi pi-check"]');
      expect(setActiveButton.exists()).toBe(false);
    });

    it('should toggle actions menu when more actions button is clicked', async () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      const moreActionsButton = wrapper.find('button[icon="pi pi-ellipsis-v"]');
      await moreActionsButton.trigger('click');

      // Menu should have toggle method called
      const menu = wrapper.findComponent({ name: 'Menu' });
      expect(menu.exists()).toBe(true);
    });
  });

  describe('Action Menu', () => {
    it('should have duplicate action in menu', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      const menu = wrapper.findComponent({ name: 'Menu' });
      const menuItems = menu.props('model');

      const duplicateAction = menuItems.find((item: any) => item.label === 'Duplicate');
      expect(duplicateAction).toBeTruthy();
      expect(duplicateAction.icon).toBe('pi pi-clone');
    });

    it('should have export action in menu', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      const menu = wrapper.findComponent({ name: 'Menu' });
      const menuItems = menu.props('model');

      const exportAction = menuItems.find((item: any) => item.label === 'Export');
      expect(exportAction).toBeTruthy();
      expect(exportAction.icon).toBe('pi pi-download');
    });

    it('should have delete action in menu', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      const menu = wrapper.findComponent({ name: 'Menu' });
      const menuItems = menu.props('model');

      const deleteAction = menuItems.find((item: any) => item.label === 'Delete');
      expect(deleteAction).toBeTruthy();
      expect(deleteAction.icon).toBe('pi pi-trash');
    });

    it('should emit duplicate event when duplicate action is triggered', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      const menu = wrapper.findComponent({ name: 'Menu' });
      const menuItems = menu.props('model');
      const duplicateAction = menuItems.find((item: any) => item.label === 'Duplicate');

      duplicateAction.command();

      expect(wrapper.emitted('duplicate')).toBeTruthy();
      expect(wrapper.emitted('duplicate')[0]).toEqual([mockProfile]);
    });

    it('should emit export event when export action is triggered', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      const menu = wrapper.findComponent({ name: 'Menu' });
      const menuItems = menu.props('model');
      const exportAction = menuItems.find((item: any) => item.label === 'Export');

      exportAction.command();

      expect(wrapper.emitted('export')).toBeTruthy();
      expect(wrapper.emitted('export')[0]).toEqual([mockProfile]);
    });

    it('should emit delete event when delete action is triggered', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      const menu = wrapper.findComponent({ name: 'Menu' });
      const menuItems = menu.props('model');
      const deleteAction = menuItems.find((item: any) => item.label === 'Delete');

      deleteAction.command();

      expect(wrapper.emitted('delete')).toBeTruthy();
      expect(wrapper.emitted('delete')[0]).toEqual([mockProfile]);
    });
  });

  describe('Profession Icon Display', () => {
    it('should show correct icon for Doctor profession', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      const professionIcon = wrapper.find('.pi-heart');
      expect(professionIcon.exists()).toBe(true);
    });

    it('should show correct icon for Soldier profession', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockLowLevelProfile,
          isActive: false,
        },
      });

      const professionIcon = wrapper.find('.pi-rifle');
      expect(professionIcon.exists()).toBe(true);
    });

    it('should show default user icon for unknown profession', () => {
      const unknownProfessionProfile = {
        ...mockProfile,
        profession: 'UnknownClass',
      };

      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: unknownProfessionProfile,
          isActive: false,
        },
      });

      const professionIcon = wrapper.find('.pi-user');
      expect(professionIcon.exists()).toBe(true);
    });
  });

  describe('Date Formatting', () => {
    it('should display formatted created date', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      expect(wrapper.text()).toContain('Created:');
      // Should contain some date representation
      expect(wrapper.text()).toMatch(/Jan|01|2024/);
    });

    it('should display formatted updated date', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      expect(wrapper.text()).toContain('Updated:');
      // Should contain some date representation
      expect(wrapper.text()).toMatch(/Jan|15|2024/);
    });
  });

  describe('Visual Styling', () => {
    it('should have profile-card class', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      const card = wrapper.find('.profile-card');
      expect(card.exists()).toBe(true);
    });

    it('should have breed color indicator', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      // Should have color indicator for Atrox (red)
      const breedIndicator = wrapper.find('.text-red-500');
      expect(breedIndicator.exists()).toBe(true);
    });

    it('should have faction color indicator', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      // Should have color indicator for Clan (orange)
      const factionIndicator = wrapper.find('.text-orange-500');
      expect(factionIndicator.exists()).toBe(true);
    });
  });

  describe('Accessibility', () => {
    it('should have tooltips on buttons', () => {
      wrapper = mountWithContext(ProfileCard, {
        props: {
          profile: mockProfile,
          isActive: false,
        },
      });

      const buttons = wrapper.findAll('button[v-tooltip]');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});

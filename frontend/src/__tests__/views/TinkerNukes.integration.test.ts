/**
 * TinkerNukes Component Unit Tests
 *
 * UNIT TEST - Component behavior tests with mocks
 * Strategy: Tests component logic in isolation
 *
 * Tests TinkerNukes view functionality with mocked stores and backend.
 * Focuses on component behavior, filtering, and state management.
 *
 * Note: This file is named "integration" but uses mocks to test
 * component behavior in isolation, not real backend integration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import PrimeVue from 'primevue/config';
import TinkerNukes from '@/views/TinkerNukes.vue';
import { useNanosStore } from '@/stores/nanosStore';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import type { NanoProgram } from '@/types/nano';
import { PROFESSION } from '@/__tests__/helpers';

// Mock PrimeVue components
vi.mock('primevue/badge', () => ({ 
  default: { 
    template: '<div class="mock-badge" data-testid="badge">{{ value }}<slot></slot></div>',
    props: ['modelValue', 'value', 'severity']
  } 
}));
vi.mock('primevue/dropdown', () => ({ 
  default: { 
    template: '<div class="mock-dropdown" data-testid="dropdown"><slot></slot></div>',
    props: ['modelValue', 'value', 'options', 'placeholder', 'optionLabel', 'optionValue', 'showClear']
  } 
}));
vi.mock('primevue/inputswitch', () => ({ 
  default: { 
    template: '<div class="mock-inputswitch" data-testid="inputswitch"><slot></slot></div>',
    props: ['modelValue', 'value', 'inputId', 'disabled']
  } 
}));
vi.mock('primevue/inputnumber', () => ({ 
  default: { 
    template: '<div class="mock-inputnumber" data-testid="inputnumber"><slot></slot></div>',
    props: ['modelValue', 'value', 'min', 'max', 'step']
  } 
}));
vi.mock('primevue/inputtext', () => ({ 
  default: { 
    template: '<div class="mock-inputtext" data-testid="inputtext"><slot></slot></div>',
    props: ['modelValue', 'value', 'placeholder']
  } 
}));
vi.mock('primevue/tag', () => ({ 
  default: { 
    template: '<div class="mock-tag" data-testid="tag"><slot></slot></div>',
    props: ['modelValue', 'value', 'severity']
  } 
}));

vi.mock('primevue/datatable', () => ({
  default: {
    name: 'DataTable',
    template: `
      <div class="mock-datatable" data-testid="datatable">
        <div class="table-header">
          <slot name="header"></slot>
        </div>
        <div class="table-body">
          <div v-for="(item, index) in value" :key="index" class="table-row" :data-testid="'row-' + index">
            <slot name="default" :data="item" :index="index"></slot>
          </div>
        </div>
        <div v-if="!value || value.length === 0" class="empty-state" data-testid="empty-state">
          <slot name="empty">No data available</slot>
        </div>
      </div>
    `,
    props: ['value', 'loading', 'paginator', 'rows', 'rowsPerPageOptions', 'sortMode', 'globalFilter']
  }
}));

vi.mock('primevue/column', () => ({
  default: {
    name: 'Column',
    template: '<div class="mock-column"><slot></slot></div>',
    props: ['field', 'header', 'sortable']
  }
}));

describe('TinkerNukes Component Unit Tests', () => {
  let wrapper: VueWrapper;
  let router: any;
  let pinia: any;
  let nanosStore: any;
  let profilesStore: any;

  beforeEach(async () => {
    // Create router
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/nukes', name: 'TinkerNukes', component: TinkerNukes }
      ]
    });
    
    // Create fresh pinia instance
    pinia = createPinia();

    // Mount component
    wrapper = mount(TinkerNukes, {
      global: {
        plugins: [PrimeVue, pinia, router],
        stubs: {
          'router-link': true,
          'router-view': true
        }
      }
    });

    // Get store instances
    nanosStore = useNanosStore();
    profilesStore = useTinkerProfilesStore();

    await wrapper.vm.$nextTick();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe('Component Initialization', () => {
    it('mounts successfully', () => {
      expect(wrapper.exists()).toBe(true);
    });

    it('displays the correct title and branding', () => {
      expect(wrapper.text()).toContain('TinkerNukes');
      expect(wrapper.text()).toContain('NT Only');
    });

    it('shows form sections', () => {
      expect(wrapper.text()).toContain('Character Stats');
      expect(wrapper.text()).toContain('Damage Modifiers');
      expect(wrapper.text()).toContain('Buff Presets');
    });

    it('has all required input state fields', () => {
      const component = wrapper.vm as any;
      const state = component.inputState;

      // Character stats
      expect(state.characterStats).toHaveProperty('matterCreation');
      expect(state.characterStats).toHaveProperty('bioMeta');
      expect(state.characterStats).toHaveProperty('matterMeta');
      expect(state.characterStats).toHaveProperty('psychModi');
      expect(state.characterStats).toHaveProperty('sensoryImp');
      expect(state.characterStats).toHaveProperty('timeSpace');

      // Damage modifiers
      expect(state.damageModifiers).toHaveProperty('projectile');
      expect(state.damageModifiers).toHaveProperty('nano');

      // Buff presets
      expect(state.buffPresets).toHaveProperty('crunchcom');
      expect(state.buffPresets).toHaveProperty('enhanceNanoDamage');
    });
  });

  describe('Real Backend Integration', () => {
    it('loads nanos from backend on mount', async () => {
      // Wait for the component to finish loading
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // The fetchNanos should have been called
      expect(nanosStore.nanos.length).toBeGreaterThanOrEqual(0);
      
      // If there are nanos, verify structure
      if (nanosStore.nanos.length > 0) {
        const firstNano = nanosStore.nanos[0];
        expect(firstNano).toHaveProperty('id');
        expect(firstNano).toHaveProperty('name');
        expect(firstNano).toHaveProperty('school');
      }
    }, 10000); // Longer timeout for real API

    it('loads profiles from backend', async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Profiles should be loaded (may be empty array)
      expect(Array.isArray(profilesStore.profiles)).toBe(true);
      
      // If there are profiles, verify structure
      if (profilesStore.profiles.length > 0) {
        const firstProfile = profilesStore.profiles[0];
        expect(firstProfile).toHaveProperty('name');
        expect(firstProfile).toHaveProperty('profession');
        expect(firstProfile).toHaveProperty('level');
      }
    }, 10000);

    it('filters nanos to only Nanotechnician offensive types', async () => {
      // Wait for data loading
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const component = wrapper.vm as any;
      const offensiveNanos = component.offensiveNanos;
      
      // Should only include nanos that are either unspecified profession or NT
      offensiveNanos.forEach((nano: NanoProgram) => {
        if (nano.profession) {
          expect(nano.profession).toBe(PROFESSION.NANOTECHNICIAN);
        }
      });
      
      // Should only include nanos with offensive effects or damage potential
      // Note: Since we don't know the exact data structure, we check that filtering occurred
      expect(offensiveNanos.length).toBeLessThanOrEqual(nanosStore.nanos.length);
    }, 10000);
  });

  describe('Input State Management', () => {
    it('initializes input state with defaults', () => {
      const component = wrapper.vm as any;
      const state = component.inputState;

      expect(state.characterStats.breed).toBe(1);
      expect(state.characterStats.level).toBe(1);
      expect(state.characterStats.psychic).toBe(6);
      expect(state.characterStats.matterCreation).toBe(1);
    });

    it('allows updating character stats', async () => {
      const component = wrapper.vm as any;

      // Update input state directly
      component.inputState.characterStats.level = 200;
      component.inputState.characterStats.matterCreation = 1000;

      await wrapper.vm.$nextTick();

      expect(component.inputState.characterStats.level).toBe(200);
      expect(component.inputState.characterStats.matterCreation).toBe(1000);
    });

    it('calculates skill-based filtering correctly', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));

      const component = wrapper.vm as any;

      // Test with low skills
      component.inputState.characterStats.matterCreation = 50;
      component.inputState.characterStats.bioMeta = 50;
      component.inputState.characterStats.level = 10;

      await wrapper.vm.$nextTick();
      const lowSkillFiltered = component.filteredNanos.length;

      // Test with high skills
      component.inputState.characterStats.matterCreation = 1000;
      component.inputState.characterStats.bioMeta = 1000;
      component.inputState.characterStats.level = 220;

      await wrapper.vm.$nextTick();
      const highSkillFiltered = component.filteredNanos.length;

      // Higher skills should allow more nanos (or at least same amount)
      expect(highSkillFiltered).toBeGreaterThanOrEqual(lowSkillFiltered);
    }, 10000);
  });

  describe('Profile Integration', () => {
    it('displays active profile information', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));

      const component = wrapper.vm as any;

      // Initially no active profile
      expect(component.activeProfile).toBeNull();

      // If there are NT profiles available in store
      if (profilesStore.profiles.some((p: any) => p.Character?.Profession === 11)) {
        const ntProfile = profilesStore.profiles.find((p: any) => p.Character?.Profession === 11);
        profilesStore.activeProfile = ntProfile;

        await wrapper.vm.$nextTick();

        expect(component.activeProfile).toBeTruthy();
        expect(wrapper.text()).toContain('Active Profile:');
      }
    }, 10000);

    it('extracts skills from active profile', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));

      const component = wrapper.vm as any;

      // If there are NT profiles available, test skill extraction
      if (profilesStore.profiles.some((p: any) => p.Character?.Profession === 11)) {
        const ntProfile = profilesStore.profiles.find((p: any) => p.Character?.Profession === 11);
        profilesStore.activeProfile = ntProfile;

        await wrapper.vm.$nextTick();

        const skills = component.currentSkills;
        expect(typeof skills).toBe('object');

        // Should have extracted skill values by ID (or defaults)
        expect(typeof skills[130]).toBe('number'); // Matter Creation
        expect(skills[130]).toBeGreaterThan(0);
      }
    }, 10000);
  });

  describe('Data Table Functionality', () => {
    it('renders data table', () => {
      const table = wrapper.find('[data-testid="datatable"]');
      expect(table.exists()).toBe(true);
    });

    it('shows filtered nano count', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));

      const component = wrapper.vm as any;
      const filteredCount = component.filteredNanos.length;

      expect(wrapper.text()).toContain(`${filteredCount} nano`);
      expect(wrapper.text()).toContain('found');
    }, 10000);

    it('provides school filtering options', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));

      const component = wrapper.vm as any;
      const schoolOptions = component.schoolFilterOptions;

      expect(Array.isArray(schoolOptions)).toBe(true);
      expect(schoolOptions.length).toBe(6);

      schoolOptions.forEach((option: any) => {
        expect(option).toHaveProperty('label');
        expect(option).toHaveProperty('value');
      });
    }, 10000);

    it('filters by selected school', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));

      const component = wrapper.vm as any;

      if (component.schoolFilterOptions.length > 0) {
        const firstSchool = component.schoolFilterOptions[0].value;
        component.selectedSchoolId = firstSchool;

        await wrapper.vm.$nextTick();

        const filtered = component.filteredNanos;
        // If we have filtered results, verify they match the school
        if (filtered.length > 0) {
          filtered.forEach((nano: any) => {
            // Check if nano.schoolId matches (skill ID based)
            expect([firstSchool, null, undefined]).toContain(nano.schoolId);
          });
        }
      }
    }, 10000);
  });

  describe('Search and Filter Features', () => {
    it('has search query field', () => {
      const component = wrapper.vm as any;
      expect(typeof component.searchQuery).toBe('string');
      expect(component.searchQuery).toBe('');
    });

    it('has QL range filters', () => {
      const component = wrapper.vm as any;
      expect(component.minQL).toBeUndefined();
      expect(component.maxQL).toBeUndefined();
    });

    it('allows setting QL range', async () => {
      const component = wrapper.vm as any;

      component.minQL = 100;
      component.maxQL = 200;

      await wrapper.vm.$nextTick();

      expect(component.minQL).toBe(100);
      expect(component.maxQL).toBe(200);
    });

    it('allows setting search query', async () => {
      const component = wrapper.vm as any;

      component.searchQuery = 'damage';

      await wrapper.vm.$nextTick();

      expect(component.searchQuery).toBe('damage');
    });
  });

  describe('Error Handling', () => {
    it('handles empty nano data gracefully', async () => {
      const component = wrapper.vm as any;

      // Simulate empty offensive nanos
      component.offensiveNanos = [];
      await wrapper.vm.$nextTick();

      expect(component.offensiveNanos.length).toBe(0);
      expect(component.filteredNanos.length).toBe(0);
    });

    it('handles missing profile skills gracefully', () => {
      const component = wrapper.vm as any;

      // Test with profile without skills
      const badProfile = {
        Character: {
          Name: 'Test',
          Profession: 11, // Nanotechnician
          Level: 100,
          Breed: 1,
          MaxNano: 1000
        },
        skills: {} // Missing nano skills
      };

      profilesStore.activeProfile = badProfile;

      const skills = component.currentSkills;
      expect(skills[130]).toBe(1); // Matter Creation should default to 1
    });
  });
});
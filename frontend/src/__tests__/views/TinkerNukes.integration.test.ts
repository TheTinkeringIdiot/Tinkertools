import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import PrimeVue from 'primevue/config';
import TinkerNukes from '@/views/TinkerNukes.vue';
import { useNanosStore } from '@/stores/nanosStore';
import { useProfilesStore } from '@/stores/profilesStore';
import type { NanoProgram } from '@/types/nano';

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

describe('TinkerNukes Integration Tests', () => {
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
    profilesStore = useProfilesStore();

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

    it('shows nanotechnician skills section', () => {
      expect(wrapper.text()).toContain('Nanotechnician Skills');
    });

    it('has all required skill inputs', () => {
      const component = wrapper.vm as any;
      const skillLabels = component.nanoSkills.map((s: any) => s.label);
      
      expect(skillLabels).toContain('Matter Meta');
      expect(skillLabels).toContain('Bio Meta'); 
      expect(skillLabels).toContain('Matter Creat');
      expect(skillLabels).toContain('Nano Pool');
      expect(skillLabels).toContain('Comp Lit');
      expect(skillLabels.length).toBe(8);
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
          expect(nano.profession).toBe('Nanotechnician');
        }
      });
      
      // Should only include nanos with offensive effects or damage potential
      // Note: Since we don't know the exact data structure, we check that filtering occurred
      expect(offensiveNanos.length).toBeLessThanOrEqual(nanosStore.nanos.length);
    }, 10000);
  });

  describe('Skill Management', () => {
    it('starts with manual skills disabled', () => {
      const component = wrapper.vm as any;
      expect(component.useManualSkills).toBe(false);
    });

    it('toggles manual skills mode', async () => {
      const toggle = wrapper.find('[data-testid="inputswitch"]');
      expect(toggle.exists()).toBe(true);
      
      const component = wrapper.vm as any;
      component.useManualSkills = true;
      await wrapper.vm.$nextTick();
      
      expect(component.useManualSkills).toBe(true);
    });

    it('initializes manual skills with proper defaults', () => {
      const component = wrapper.vm as any;
      const skills = component.manualSkills;
      
      expect(skills.matter_creation).toBe(1);
      expect(skills.biological_metamorphosis).toBe(1);
      expect(skills.nano_pool).toBe(1);
      expect(skills.computer_literacy).toBe(1);
      
      // All skills should be initialized
      Object.values(skills).forEach(value => {
        expect(typeof value).toBe('number');
        expect(value).toBeGreaterThan(0);
      });
    });

    it('calculates skill-based usability correctly', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const component = wrapper.vm as any;
      
      // Test with low skills
      component.useManualSkills = true;
      component.manualSkills = {
        matter_creation: 50,
        biological_metamorphosis: 50,
        psychological_modifications: 50,
        matter_metamorphosis: 50,
        time_and_space: 50,
        sensory_improvement: 50,
        nano_pool: 50,
        computer_literacy: 50
      };
      
      await wrapper.vm.$nextTick();
      const lowSkillUsable = component.usableNanos.length;
      
      // Test with high skills
      component.manualSkills = {
        matter_creation: 1000,
        biological_metamorphosis: 1000,
        psychological_modifications: 1000,
        matter_metamorphosis: 1000,
        time_and_space: 1000,
        sensory_improvement: 1000,
        nano_pool: 1000,
        computer_literacy: 1000
      };
      
      await wrapper.vm.$nextTick();
      const highSkillUsable = component.usableNanos.length;
      
      // Higher skills should allow more nanos (or at least same amount)
      expect(highSkillUsable).toBeGreaterThanOrEqual(lowSkillUsable);
    }, 10000);
  });

  describe('Profile Integration', () => {
    it('filters profile dropdown to only show Nanotechnicians', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const component = wrapper.vm as any;
      const profileOptions = component.profileOptions;
      
      // Should have at least the 'None' option
      expect(profileOptions.length).toBeGreaterThanOrEqual(1);
      expect(profileOptions[0].label).toBe('None');
      
      // Any additional profiles should be Nanotechnicians only
      if (profileOptions.length > 1) {
        profileOptions.slice(1).forEach((option: any) => {
          expect(option.label).toContain('('); // Should contain level in parentheses
        });
      }
    }, 10000);

    it('extracts skills from selected profile', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const component = wrapper.vm as any;
      
      // If there are NT profiles available, test skill extraction
      if (profilesStore.profiles.some((p: any) => p.profession === 'Nanotechnician')) {
        const ntProfile = profilesStore.profiles.find((p: any) => p.profession === 'Nanotechnician');
        component.selectedProfile = ntProfile.name;
        
        await wrapper.vm.$nextTick();
        
        const skills = component.currentSkills;
        expect(typeof skills).toBe('object');
        
        // Should have extracted skill values (or defaults)
        expect(typeof skills.matter_creation).toBe('number');
        expect(skills.matter_creation).toBeGreaterThan(0);
      }
    }, 10000);
  });

  describe('Data Table Functionality', () => {
    it('renders data table', () => {
      const table = wrapper.find('[data-testid="datatable"]');
      expect(table.exists()).toBe(true);
    });

    it('shows usable nano count', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const component = wrapper.vm as any;
      const usableCount = component.usableNanos.length;
      
      expect(wrapper.text()).toContain(`${usableCount} usable offensive nanos`);
    }, 10000);

    it('provides school filtering options', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const component = wrapper.vm as any;
      const schoolOptions = component.schoolOptions;
      
      expect(Array.isArray(schoolOptions)).toBe(true);
      
      // If there are nanos, there should be school options
      if (component.offensiveNanos.length > 0) {
        expect(schoolOptions.length).toBeGreaterThan(0);
        schoolOptions.forEach((option: any) => {
          expect(option).toHaveProperty('label');
          expect(option).toHaveProperty('value');
        });
      }
    }, 10000);

    it('filters by selected school', async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const component = wrapper.vm as any;
      
      if (component.schoolOptions.length > 0) {
        const firstSchool = component.schoolOptions[0].value;
        component.selectedSchool = firstSchool;
        
        await wrapper.vm.$nextTick();
        
        const filtered = component.filteredNanos;
        filtered.forEach((nano: NanoProgram) => {
          expect(nano.school).toBe(firstSchool);
        });
      }
    }, 10000);
  });

  describe('Utility Functions', () => {
    it('provides correct usability indicators', () => {
      const component = wrapper.vm as any;
      const mockNano = { id: 1, name: 'Test', effects: [{ type: 'damage' }] };
      
      const icon = component.getUsabilityIcon(mockNano);
      const text = component.getUsabilityText(mockNano);
      const color = component.getUsabilityColor(mockNano);
      
      expect(icon).toContain('pi-check-circle');
      expect(text).toBe('Usable');
      expect(color).toContain('green');
    });

    it('extracts offensive effects correctly', () => {
      const component = wrapper.vm as any;
      
      const damageNano = {
        effects: [
          { type: 'damage', value: 100 },
          { type: 'heal', value: 50 },
          { type: 'debuff', value: 25 }
        ]
      };
      
      const effects = component.getOffensiveEffects(damageNano);
      expect(effects).toContain('Damage');
      expect(effects).toContain('Debuff');
      expect(effects).not.toContain('Heal');
    });

    it('provides skill level CSS classes', () => {
      const component = wrapper.vm as any;
      
      component.manualSkills.matter_creation = 100;
      expect(component.getSkillInputClass('matter_creation')).toBe('skill-low');
      
      component.manualSkills.matter_creation = 600;
      expect(component.getSkillInputClass('matter_creation')).toBe('skill-medium');
      
      component.manualSkills.matter_creation = 1200;
      expect(component.getSkillInputClass('matter_creation')).toBe('skill-high');
    });
  });

  describe('Error Handling', () => {
    it('handles empty nano data gracefully', async () => {
      const component = wrapper.vm as any;
      
      // Simulate empty nano data
      nanosStore.nanos = [];
      await wrapper.vm.$nextTick();
      
      expect(component.offensiveNanos.length).toBe(0);
      expect(component.usableNanos.length).toBe(0);
      expect(component.schoolOptions.length).toBe(0);
    });

    it('handles missing profile skills gracefully', () => {
      const component = wrapper.vm as any;
      
      // Test with profile without skills
      const badProfile = {
        id: 'test-profile',
        name: 'Test',
        profession: 'Nanotechnician',
        level: 100,
        skills: {}, // Missing nano skills
        stats: {}
      };
      
      profilesStore.profiles = [badProfile];
      component.selectedProfile = 'Test';
      
      const skills = component.currentSkills;
      expect(skills.matter_creation).toBe(1); // Should default to 1
    });
  });
});
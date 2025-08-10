import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import PrimeVue from 'primevue/config';
import TinkerNukes from '@/views/TinkerNukes.vue';

// Mock PrimeVue components
vi.mock('primevue/badge', () => ({ 
  default: { template: '<span class="mock-badge">{{ value }}<slot></slot></span>', props: ['value', 'severity'] }
}));
vi.mock('primevue/dropdown', () => ({ 
  default: { template: '<div class="mock-dropdown"><slot></slot></div>', props: ['modelValue', 'options', 'placeholder'] }
}));
vi.mock('primevue/inputswitch', () => ({ 
  default: { template: '<div class="mock-inputswitch"><slot></slot></div>', props: ['modelValue', 'inputId'] }
}));
vi.mock('primevue/inputnumber', () => ({ 
  default: { template: '<input class="mock-inputnumber" type="number" />', props: ['modelValue', 'min', 'max'] }
}));
vi.mock('primevue/inputtext', () => ({ 
  default: { template: '<input class="mock-inputtext" type="text" />', props: ['modelValue', 'placeholder'] }
}));
vi.mock('primevue/datatable', () => ({ 
  default: { template: '<div class="mock-datatable"><slot></slot><slot name="empty"></slot></div>', props: ['value', 'loading'] }
}));
vi.mock('primevue/column', () => ({ 
  default: { template: '<div class="mock-column"><slot></slot></div>', props: ['field', 'header'] }
}));
vi.mock('primevue/tag', () => ({ 
  default: { template: '<span class="mock-tag"><slot></slot></span>', props: ['value', 'severity'] }
}));

describe('TinkerNukes Simple Tests', () => {
  let wrapper: any;
  let router: any;

  beforeEach(async () => {
    router = createRouter({
      history: createWebHistory(),
      routes: [{ path: '/nukes', name: 'TinkerNukes', component: TinkerNukes }]
    });

    const pinia = createPinia();

    wrapper = mount(TinkerNukes, {
      global: {
        plugins: [PrimeVue, pinia, router],
        stubs: {
          RouterLink: true,
          RouterView: true
        }
      }
    });

    await wrapper.vm.$nextTick();
  });

  it('mounts successfully', () => {
    expect(wrapper.exists()).toBe(true);
  });

  it('displays the correct title', () => {
    expect(wrapper.text()).toContain('TinkerNukes');
  });

  it('shows NT Only badge', () => {
    expect(wrapper.text()).toContain('NT Only');
  });

  it('shows nanotechnician skills section', () => {
    expect(wrapper.text()).toContain('Nanotechnician Skills');
  });

  it('has manual skills toggle', () => {
    expect(wrapper.text()).toContain('Manual Skills');
  });

  it('initializes with correct default state', () => {
    const component = wrapper.vm;
    expect(component.selectedProfile).toBeNull();
    expect(component.useManualSkills).toBe(false);
    expect(component.searchQuery).toBe('');
    expect(component.selectedSchool).toBeNull();
  });

  it('has proper manual skills defaults', () => {
    const component = wrapper.vm;
    const skills = component.manualSkills;
    
    expect(skills.matter_creation).toBe(1);
    expect(skills.biological_metamorphosis).toBe(1);
    expect(skills.nano_pool).toBe(1);
    expect(skills.computer_literacy).toBe(1);
    
    // Verify all 8 skills are present
    const skillKeys = Object.keys(skills);
    expect(skillKeys.length).toBe(8);
  });

  it('provides correct nano skills configuration', () => {
    const component = wrapper.vm;
    const skills = component.nanoSkills;
    
    expect(skills.length).toBe(8);
    
    const skillKeys = skills.map((s: any) => s.key);
    expect(skillKeys).toContain('matter_metamorphosis');
    expect(skillKeys).toContain('biological_metamorphosis');
    expect(skillKeys).toContain('psychological_modifications');
    expect(skillKeys).toContain('matter_creation');
    expect(skillKeys).toContain('time_and_space');
    expect(skillKeys).toContain('sensory_improvement');
    expect(skillKeys).toContain('nano_pool');
    expect(skillKeys).toContain('computer_literacy');
  });

  it('has proper skill labels', () => {
    const component = wrapper.vm;
    const skills = component.nanoSkills;
    
    const labels = skills.map((s: any) => s.label);
    expect(labels).toContain('Matter Meta');
    expect(labels).toContain('Bio Meta');
    expect(labels).toContain('Matter Creat');
    expect(labels).toContain('Nano Pool');
    expect(labels).toContain('Comp Lit');
  });

  it('renders data table component', () => {
    expect(wrapper.find('.mock-datatable').exists()).toBe(true);
  });

  it('shows offensive nano count message', () => {
    expect(wrapper.text()).toContain('usable offensive nanos');
  });

  it('has skill input class calculation', () => {
    const component = wrapper.vm;
    
    // Test skill level classifications
    component.manualSkills.matter_creation = 100;
    expect(component.getSkillInputClass('matter_creation')).toBe('skill-low');
    
    component.manualSkills.matter_creation = 600;
    expect(component.getSkillInputClass('matter_creation')).toBe('skill-medium');
    
    component.manualSkills.matter_creation = 1200;
    expect(component.getSkillInputClass('matter_creation')).toBe('skill-high');
  });

  it('provides usability helper functions', () => {
    const component = wrapper.vm;
    const mockNano = { id: 1, name: 'Test Nano' };
    
    expect(typeof component.getUsabilityIcon(mockNano)).toBe('string');
    expect(typeof component.getUsabilityText(mockNano)).toBe('string');
    expect(typeof component.getUsabilityColor(mockNano)).toBe('string');
    expect(component.getUsabilityText(mockNano)).toBe('Usable');
  });

  it('handles offensive effects extraction', () => {
    const component = wrapper.vm;
    
    const nanoWithEffects = {
      effects: [
        { type: 'damage', value: 100 },
        { type: 'heal', value: 50 },
        { type: 'debuff', value: 25 }
      ]
    };
    
    const effects = component.getOffensiveEffects(nanoWithEffects);
    expect(Array.isArray(effects)).toBe(true);
    expect(effects).toContain('Damage');
    expect(effects).toContain('Debuff');
  });

  it('handles empty effects gracefully', () => {
    const component = wrapper.vm;
    const nanoWithoutEffects = { id: 1, name: 'Test' };
    
    const effects = component.getOffensiveEffects(nanoWithoutEffects);
    expect(Array.isArray(effects)).toBe(true);
    expect(effects.length).toBe(0);
  });

  it('handles profile changes correctly', () => {
    const component = wrapper.vm;
    
    // Test profile change method
    component.selectedProfile = 'TestProfile';
    component.onProfileChange();
    
    // Should disable manual skills when profile is selected
    expect(component.useManualSkills).toBe(false);
  });
});
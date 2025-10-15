import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
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
        plugins: [pinia, router],
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

  it('shows character stats section', () => {
    expect(wrapper.text()).toContain('Character Stats');
  });

  it('shows damage modifiers section', () => {
    expect(wrapper.text()).toContain('Damage Modifiers');
  });

  it('shows buff presets section', () => {
    expect(wrapper.text()).toContain('Buff Presets');
  });

  it('initializes with correct default state', () => {
    const component = wrapper.vm;
    expect(component.activeProfile).toBeNull();
    expect(component.searchQuery).toBe('');
    expect(component.selectedSchoolId).toBeNull();
  });

  it('has proper input state defaults', () => {
    const component = wrapper.vm;
    const state = component.inputState;

    expect(state.characterStats.matterCreation).toBe(1);
    expect(state.characterStats.bioMeta).toBe(1);
    expect(state.characterStats.level).toBe(1);
    expect(state.characterStats.psychic).toBe(6);

    // Verify character stats structure
    expect(state.characterStats).toHaveProperty('breed');
    expect(state.characterStats).toHaveProperty('nanoInit');
    expect(state.characterStats).toHaveProperty('maxNano');
  });

  it('provides correct school filter options', () => {
    const component = wrapper.vm;
    const options = component.schoolFilterOptions;

    expect(options.length).toBe(6);

    const labels = options.map((o: any) => o.label);
    expect(labels).toContain('Matter Creation');
    expect(labels).toContain('Biological Metamorphosis');
    expect(labels).toContain('Psychological Modifications');
    expect(labels).toContain('Matter Metamorphosis');
    expect(labels).toContain('Time and Space');
    expect(labels).toContain('Sensory Improvement');
  });

  it('has proper current skills mapping', () => {
    const component = wrapper.vm;
    const skills = component.currentSkills;

    // currentSkills is a computed that maps skill IDs
    expect(skills[130]).toBe(1); // Matter Creation
    expect(skills[128]).toBe(1); // Bio Meta
    expect(skills[127]).toBe(1); // Matter Meta
    expect(skills[129]).toBe(1); // Psych Modi
    expect(skills[122]).toBe(1); // Sensory Imp
    expect(skills[131]).toBe(1); // Time Space
  });

  it('renders data table component', () => {
    expect(wrapper.find('.mock-datatable').exists()).toBe(true);
  });

  it('shows offensive nano count message', () => {
    expect(wrapper.text()).toContain('found');
  });

  it('displays filtered nanos count', () => {
    const component = wrapper.vm;
    const count = component.filteredNanos.length;

    // Check that the count is displayed in the text
    expect(wrapper.text()).toContain(`${count} nano`);
  });

  it('has loading state', () => {
    const component = wrapper.vm;
    expect(typeof component.loading).toBe('boolean');
    expect(component.loading).toBe(false);
  });

  it('has offensive nanos array', () => {
    const component = wrapper.vm;
    expect(Array.isArray(component.offensiveNanos)).toBe(true);
  });

  it('has filtered nanos computed property', () => {
    const component = wrapper.vm;
    expect(Array.isArray(component.filteredNanos)).toBe(true);
  });
});
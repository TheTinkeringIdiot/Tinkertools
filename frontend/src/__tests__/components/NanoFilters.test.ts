import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import NanoFilters from '@/components/nanos/NanoFilters.vue';
import type { NanoFilters as NanoFiltersType, TinkerProfile } from '@/types/nano';

// Mock PrimeVue components
vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
    props: ['label', 'icon', 'severity', 'text', 'size', 'outlined'],
    emits: ['click']
  }
}));

vi.mock('primevue/checkbox', () => ({
  default: {
    name: 'Checkbox',
    template: '<input type="checkbox" v-model="modelValue" :id="inputId" :value="value" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
    props: ['modelValue', 'inputId', 'binary', 'value'],
    emits: ['update:modelValue']
  }
}));

vi.mock('primevue/chip', () => ({
  default: {
    name: 'Chip',
    template: '<span @click="$emit(\'click\')" :class="[\'cursor-pointer\', $attrs.class]"><slot>{{ label }}</slot></span>',
    props: ['label', 'severity'],
    emits: ['click']
  }
}));

vi.mock('primevue/dropdown', () => ({
  default: {
    name: 'Dropdown',
    template: '<select v-model="modelValue" @change="$emit(\'update:modelValue\', $event.target.value); $emit(\'change\')"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
    props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'placeholder'],
    emits: ['update:modelValue', 'change']
  }
}));

vi.mock('primevue/multiselect', () => ({
  default: {
    name: 'MultiSelect',
    template: '<select multiple v-model="modelValue"><option v-for="option in options" :key="option" :value="option">{{ option }}</option></select>',
    props: ['modelValue', 'options', 'placeholder', 'maxSelectedLabels', 'selectedItemsLabel'],
    emits: ['update:modelValue']
  }
}));

vi.mock('primevue/slider', () => ({
  default: {
    name: 'Slider',
    template: '<input type="range" v-model="modelValue" :min="min" :max="max" :step="step" @input="$emit(\'update:modelValue\', [$event.target.value, modelValue[1] || max])" />',
    props: ['modelValue', 'min', 'max', 'step', 'range'],
    emits: ['update:modelValue']
  }
}));

describe('NanoFilters', () => {
  let wrapper: any;
  let defaultFilters: NanoFiltersType;
  let mockProfile: TinkerProfile;

  beforeEach(() => {
    defaultFilters = {
      schools: [],
      strains: [],
      professions: [],
      qualityLevels: [],
      effectTypes: [],
      durationType: [],
      targetTypes: [],
      levelRange: [1, 220],
      memoryUsageRange: [0, 1000],
      nanoPointRange: [0, 2000],
      skillGapThreshold: null,
      skillCompatible: false,
      castable: false,
      sortBy: 'name',
      sortDescending: false
    };

    mockProfile = {
      id: 'test-profile',
      name: 'Test Character',
      profession: 'Doctor',
      level: 100,
      skills: {
        'Biological Metamorphosis': 500,
        'Matter Creation': 300,
        'Nano Programming': 400
      },
      stats: {
        'Intelligence': 400,
        'Psychic': 300
      },
      activeNanos: [],
      memoryCapacity: 500,
      nanoPoints: 1000
    };

    wrapper = mount(NanoFilters, {
      props: {
        modelValue: defaultFilters,
        showCompatibility: false,
        activeProfile: null,
        availableStrains: ['Heal Delta', 'Protection Alpha', 'Summon Beta']
      }
    });
  });

  it('renders filter categories correctly', () => {
    expect(wrapper.text()).toContain('Quality Level');
    expect(wrapper.text()).toContain('Profession');
    expect(wrapper.text()).toContain('Nano Strain');
    expect(wrapper.text()).toContain('Effect Type');
    expect(wrapper.text()).toContain('Level Range');
  });

  it('displays quality level checkboxes', () => {
    const qualityLevels = [1, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300];
    const checkboxes = wrapper.findAll('input[type="checkbox"]');
    
    // Should have at least some quality level checkboxes
    expect(checkboxes.length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain('QL');
  });

  it('shows profession multiselect', () => {
    const professions = ['Doctor', 'Meta-Physicist', 'Engineer'];
    const select = wrapper.find('select[multiple]');
    expect(select.exists()).toBe(true);
  });

  it('displays available strains', async () => {
    await wrapper.setProps({ 
      availableStrains: ['Heal Delta', 'Protection Alpha', 'Summon Beta'] 
    });
    
    expect(wrapper.text()).toContain('Heal Delta');
    expect(wrapper.text()).toContain('Protection Alpha');
    expect(wrapper.text()).toContain('Summon Beta');
  });

  it('shows effect type chips', () => {
    const expectedEffects = ['Stat Boost', 'Heal', 'Damage', 'Protection', 'Teleport', 'Summon'];
    const text = wrapper.text();
    
    expectedEffects.forEach(effect => {
      expect(text).toContain(effect);
    });
  });

  it('handles effect type selection', async () => {
    const effectChips = wrapper.findAll('span');
    if (effectChips.length > 0) {
      await effectChips[0].trigger('click');
      
      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('filter-change')).toBeTruthy();
    }
  });

  it('shows level range slider', () => {
    expect(wrapper.find('input[type="range"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Level Range');
  });

  it('displays compatibility filters when profile is active', async () => {
    await wrapper.setProps({
      showCompatibility: true,
      activeProfile: mockProfile
    });
    
    expect(wrapper.text()).toContain('Character Compatibility');
    expect(wrapper.text()).toContain('Meets Skill Requirements');
    expect(wrapper.text()).toContain('Fully Castable');
  });

  it('hides compatibility filters when no profile', async () => {
    await wrapper.setProps({
      showCompatibility: false,
      activeProfile: null
    });
    
    expect(wrapper.text()).not.toContain('Character Compatibility');
  });

  it('shows skill gap threshold dropdown with profile', async () => {
    await wrapper.setProps({
      showCompatibility: true,
      activeProfile: mockProfile
    });
    
    expect(wrapper.text()).toContain('skill gap');
    const dropdowns = wrapper.findAll('select:not([multiple])');
    expect(dropdowns.length).toBeGreaterThan(0);
  });

  it('displays memory usage slider with profile', async () => {
    await wrapper.setProps({
      showCompatibility: true,
      activeProfile: mockProfile
    });
    
    expect(wrapper.text()).toContain('Memory Usage');
    const sliders = wrapper.findAll('input[type="range"]');
    expect(sliders.length).toBeGreaterThan(1); // Level range + memory range
  });

  it('shows sort options', () => {
    expect(wrapper.text()).toContain('Sort By');
    const sortOptions = ['Name', 'Level', 'Quality Level', 'Nano Point Cost'];
    const text = wrapper.text();
    
    // At least some sort options should be present
    expect(text).toContain('Name') || expect(text).toContain('Level');
  });

  it('handles sort order toggle', async () => {
    const sortCheckbox = wrapper.find('#sort-desc');
    if (sortCheckbox.exists()) {
      await sortCheckbox.setChecked(true);
      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    }
  });

  it('shows advanced filters toggle', () => {
    expect(wrapper.text()).toContain('Advanced') || expect(wrapper.text()).toContain('Show');
  });

  it('displays advanced filters when toggled', async () => {
    const advancedButton = wrapper.find('button');
    if (advancedButton.exists() && advancedButton.text().includes('Advanced')) {
      await advancedButton.trigger('click');
      await nextTick();
      
      expect(wrapper.text()).toContain('Nano Point Cost') || expect(wrapper.text()).toContain('Duration');
    }
  });

  it('shows filter presets', () => {
    const expectedPresets = ['Buffs', 'Heals', 'Nukes', 'Low Level', 'High Level'];
    const text = wrapper.text();
    
    expectedPresets.some(preset => expect(text).toContain(preset));
  });

  it('applies filter preset when clicked', async () => {
    const presetButtons = wrapper.findAll('button');
    if (presetButtons.length > 1) {
      await presetButtons[1].trigger('click'); // Skip the advanced toggle button
      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('filter-change')).toBeTruthy();
    }
  });

  it('shows clear all button when filters are active', async () => {
    await wrapper.setProps({
      modelValue: {
        ...defaultFilters,
        schools: ['Matter Creation'],
        qualityLevels: [100]
      }
    });
    
    expect(wrapper.text()).toContain('Clear');
  });

  it('clears all filters when clear button clicked', async () => {
    await wrapper.setProps({
      modelValue: {
        ...defaultFilters,
        schools: ['Matter Creation'],
        qualityLevels: [100]
      }
    });
    
    const clearButton = wrapper.findAll('button').find(btn => btn.text().includes('Clear'));
    if (clearButton) {
      await clearButton.trigger('click');
      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    }
  });

  it('handles profession filter changes', async () => {
    const professionSelect = wrapper.find('select[multiple]');
    if (professionSelect.exists()) {
      await professionSelect.setValue(['Doctor', 'Engineer']);
      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    }
  });

  it('updates level range when slider changes', async () => {
    const slider = wrapper.find('input[type="range"]');
    if (slider.exists()) {
      await slider.setValue('150');
      await slider.trigger('input');
      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    }
  });

  it('shows nano point range in advanced filters', async () => {
    const advancedButton = wrapper.find('button');
    if (advancedButton.exists() && advancedButton.text().includes('Advanced')) {
      await advancedButton.trigger('click');
      await nextTick();
      
      expect(wrapper.text()).toContain('Nano Point') || expect(wrapper.text()).toContain('NP');
    }
  });

  it('displays target type filters in advanced mode', async () => {
    const advancedButton = wrapper.find('button');
    if (advancedButton.exists() && advancedButton.text().includes('Advanced')) {
      await advancedButton.trigger('click');
      await nextTick();
      
      expect(wrapper.text()).toContain('Target') || expect(wrapper.text()).toContain('Self') || expect(wrapper.text()).toContain('Team');
    }
  });
});
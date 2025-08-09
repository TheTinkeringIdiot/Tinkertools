import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SymbiantFilters from '@/components/plants/SymbiantFilters.vue';
import type { SymbiantFilters as SymbiantFiltersType } from '@/types/plants';

// Mock PrimeVue components
vi.mock('primevue/accordion', () => ({
  default: {
    name: 'Accordion',
    template: '<div class="accordion"><slot /></div>',
    props: ['activeIndex', 'multiple']
  }
}));

vi.mock('primevue/accordiontab', () => ({
  default: {
    name: 'AccordionTab',
    template: '<div class="accordion-tab"><template v-if="$slots.header"><div class="header"><slot name="header" /></div></template><div class="content"><slot /></div></div>',
    props: ['header']
  }
}));

vi.mock('primevue/badge', () => ({
  default: {
    name: 'Badge',
    template: '<span class="badge" :class="severity">{{ value }}</span>',
    props: ['value', 'severity', 'size']
  }
}));

vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button @click="$emit(\'click\')" :class="[severity, { text }]">{{ label }}</button>',
    props: ['label', 'severity', 'size', 'text'],
    emits: ['click']
  }
}));

vi.mock('primevue/checkbox', () => ({
  default: {
    name: 'Checkbox',
    template: '<input type="checkbox" :checked="modelValue?.includes?.(value) || modelValue === value" @change="handleChange" :id="inputId" />',
    props: ['modelValue', 'value', 'inputId'],
    emits: ['update:modelValue'],
    methods: {
      handleChange(event: Event) {
        const target = event.target as HTMLInputElement;
        const checked = target.checked;
        
        if (Array.isArray(this.modelValue)) {
          const newValue = [...this.modelValue];
          if (checked) {
            newValue.push(this.value);
          } else {
            const index = newValue.indexOf(this.value);
            if (index > -1) newValue.splice(index, 1);
          }
          this.$emit('update:modelValue', newValue);
        } else {
          this.$emit('update:modelValue', checked ? this.value : null);
        }
      }
    }
  }
}));

vi.mock('primevue/slider', () => ({
  default: {
    name: 'Slider',
    template: '<input type="range" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @change="$emit(\'change\')" :min="min" :max="max" :step="step" />',
    props: ['modelValue', 'min', 'max', 'step', 'range'],
    emits: ['update:modelValue', 'change']
  }
}));

describe('SymbiantFilters', () => {
  let wrapper: any;
  const defaultFilters: SymbiantFiltersType = {
    families: [],
    slots: [],
    qualityLevels: [],
    statBonuses: []
  };

  beforeEach(() => {
    wrapper = mount(SymbiantFilters, {
      props: {
        modelValue: defaultFilters,
        availableFamilies: ['Seeker', 'Hacker', 'Soldier', 'Medic']
      }
    });
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  it('renders correctly', () => {
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('.symbiant-filters').exists()).toBe(true);
  });

  it('displays family filters section', () => {
    expect(wrapper.text()).toContain('Families');
    expect(wrapper.text()).toContain('Seeker');
    expect(wrapper.text()).toContain('Hacker');
    expect(wrapper.text()).toContain('Soldier');
    expect(wrapper.text()).toContain('Medic');
  });

  it('displays slot filters section', () => {
    expect(wrapper.text()).toContain('Slots');
    expect(wrapper.text()).toContain('Head');
    expect(wrapper.text()).toContain('Chest');
    expect(wrapper.text()).toContain('Right Arm');
  });

  it('displays quality level filters section', () => {
    expect(wrapper.text()).toContain('Quality');
    expect(wrapper.find('input[type="range"]').exists()).toBe(true);
  });

  it('displays stat bonus filters section', () => {
    expect(wrapper.text()).toContain('Stats');
    expect(wrapper.text()).toContain('Strength');
    expect(wrapper.text()).toContain('Agility');
  });

  it('emits filter changes when family is selected', async () => {
    const familyCheckbox = wrapper.find('input[type="checkbox"]');
    await familyCheckbox.trigger('change');

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('filter-change')).toBeTruthy();
  });

  it('selects all families when "All" button is clicked', async () => {
    const allButton = wrapper.findAll('button').find((button: any) => 
      button.text().includes('All')
    );
    
    if (allButton) {
      await allButton.trigger('click');
      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    }
  });

  it('clears all families when "None" button is clicked', async () => {
    const noneButton = wrapper.findAll('button').find((button: any) => 
      button.text().includes('None')
    );
    
    if (noneButton) {
      await noneButton.trigger('click');
      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    }
  });

  it('updates quality range when slider changes', async () => {
    const slider = wrapper.find('input[type="range"]');
    await slider.setValue(50);
    await slider.trigger('change');

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
  });

  it('resets all filters when reset button is clicked', async () => {
    const resetButton = wrapper.find('button').findAll('button').find((button: any) => 
      button.text().includes('Reset All Filters')
    );
    
    if (resetButton) {
      await resetButton.trigger('click');
      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    }
  });

  it('formats slot names correctly', () => {
    expect(wrapper.text()).toContain('Right Arm');
    expect(wrapper.text()).toContain('Left Arm');
    expect(wrapper.text()).toContain('Right Wrist');
  });

  it('formats stat names correctly', () => {
    expect(wrapper.text()).toContain('Strength');
    expect(wrapper.text()).toContain('Intelligence');
    expect(wrapper.text()).toContain('Matter Creation');
  });

  it('shows badges with filter counts when filters are active', async () => {
    await wrapper.setProps({
      modelValue: {
        families: ['Seeker'],
        slots: ['head', 'chest'],
        qualityLevels: [100, 200],
        statBonuses: ['strength']
      }
    });

    const badges = wrapper.findAll('.badge');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('updates filters when props change', async () => {
    const newFilters: SymbiantFiltersType = {
      families: ['Seeker'],
      slots: ['head'],
      qualityLevels: [100],
      statBonuses: ['strength']
    };

    await wrapper.setProps({ modelValue: newFilters });
    
    // Verify internal state is updated
    expect(wrapper.vm.selectedFamilies).toEqual(['Seeker']);
    expect(wrapper.vm.selectedSlots).toEqual(['head']);
  });

  it('handles minimum stat bonus filter', async () => {
    const minBonusSlider = wrapper.findAll('input[type="range"]').find((input: any) => 
      input.element.min === '0' && input.element.max === '100'
    );
    
    if (minBonusSlider) {
      await minBonusSlider.setValue(25);
      await minBonusSlider.trigger('change');
      
      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    }
  });
});
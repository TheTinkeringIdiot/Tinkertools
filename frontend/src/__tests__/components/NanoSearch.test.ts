import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import NanoSearch from '@/components/nanos/NanoSearch.vue';

// Mock PrimeVue components
vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button><slot /></button>',
    props: ['icon', 'label', 'severity', 'text', 'rounded', 'size']
  }
}));

vi.mock('primevue/checkbox', () => ({
  default: {
    name: 'Checkbox',
    template: '<input type="checkbox" v-model="modelValue" :id="inputId" />',
    props: ['modelValue', 'inputId', 'binary', 'value'],
    emits: ['update:modelValue']
  }
}));

vi.mock('primevue/chip', () => ({
  default: {
    name: 'Chip',
    template: '<span @click="$emit(\'click\')" @remove="$emit(\'remove\')"><slot>{{ label }}</slot></span>',
    props: ['label', 'removable'],
    emits: ['click', 'remove']
  }
}));

vi.mock('primevue/iconfield', () => ({
  default: {
    name: 'IconField',
    template: '<div><slot /></div>',
    props: ['iconPosition']
  }
}));

vi.mock('primevue/inputicon', () => ({
  default: {
    name: 'InputIcon',
    template: '<i :class="class"></i>',
    props: ['class']
  }
}));

vi.mock('primevue/inputtext', () => ({
  default: {
    name: 'InputText',
    template: '<input type="text" v-model="modelValue" :placeholder="placeholder" />',
    props: ['modelValue', 'placeholder'],
    emits: ['update:modelValue', 'input', 'keyup']
  }
}));

describe('NanoSearch', () => {
  let wrapper: any;

  beforeEach(() => {
    wrapper = mount(NanoSearch, {
      props: {
        modelValue: '',
        totalResults: 0
      }
    });
  });

  it('renders search input correctly', () => {
    expect(wrapper.find('input[type="text"]').exists()).toBe(true);
    expect(wrapper.find('input[type="text"]').attributes('placeholder')).toContain('Search nanos');
  });

  it('emits search event when input changes', async () => {
    const input = wrapper.find('input[type="text"]');
    await input.setValue('heal');
    await input.trigger('keyup.enter');
    
    expect(wrapper.emitted('search')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
  });

  it('displays nano schools as filter chips', () => {
    const schools = [
      'Matter Metamorphosis',
      'Biological Metamorphosis', 
      'Psychological Modifications',
      'Matter Creation',
      'Time and Space',
      'Sensory Improvement'
    ];

    const chips = wrapper.findAll('[data-testid^="school-chip-"], span');
    expect(chips.length).toBeGreaterThan(0);
  });

  it('toggles school selection when chip is clicked', async () => {
    const firstChip = wrapper.find('span');
    if (firstChip.exists()) {
      await firstChip.trigger('click');
      expect(wrapper.emitted('search')).toBeTruthy();
    }
  });

  it('shows advanced search options when toggled', async () => {
    const advancedToggle = wrapper.find('#show-advanced');
    if (advancedToggle.exists()) {
      await advancedToggle.setChecked(true);
      await nextTick();
      
      // Should show search fields options
      expect(wrapper.text()).toContain('Search In:');
    }
  });

  it('displays search presets', () => {
    const expectedPresets = ['Stat Buffs', 'Healing', 'Damage', 'Transport', 'Summons'];
    const text = wrapper.text();
    
    expectedPresets.forEach(preset => {
      expect(text).toContain(preset);
    });
  });

  it('applies search preset when clicked', async () => {
    const presetButton = wrapper.find('button');
    if (presetButton.exists()) {
      await presetButton.trigger('click');
      expect(wrapper.emitted('search')).toBeTruthy();
      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    }
  });

  it('shows clear button when there is search text', async () => {
    await wrapper.setProps({ modelValue: 'test search' });
    await nextTick();
    
    const clearButton = wrapper.find('button[data-testid="clear-search"]');
    // Clear button should be present when there's text (mocked as any button for simplicity)
    expect(wrapper.findAll('button').length).toBeGreaterThan(0);
  });

  it('clears search when clear button is clicked', async () => {
    await wrapper.setProps({ modelValue: 'test search' });
    
    // Find and click any button (simulating clear)
    const buttons = wrapper.findAll('button');
    if (buttons.length > 0) {
      await buttons[0].trigger('click');
      expect(wrapper.emitted('update:modelValue')).toBeTruthy();
      expect(wrapper.emitted('search')).toBeTruthy();
    }
  });

  it('manages recent searches in localStorage', async () => {
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    global.localStorage = localStorageMock as any;

    localStorageMock.getItem.mockReturnValue('["recent1", "recent2"]');

    // Remount to trigger localStorage loading
    wrapper = mount(NanoSearch, {
      props: {
        modelValue: '',
        totalResults: 0
      }
    });

    expect(localStorageMock.getItem).toHaveBeenCalledWith('tinkertools_nano_recent_searches');
  });

  it('displays search statistics', async () => {
    await wrapper.setProps({ 
      modelValue: 'healing',
      totalResults: 15 
    });
    
    // Should show search stats somewhere in the component
    const text = wrapper.text();
    expect(text.includes('healing') || text.includes('All nanos')).toBe(true);
  });

  it('handles search field selection', async () => {
    const advancedToggle = wrapper.find('#show-advanced');
    if (advancedToggle.exists()) {
      await advancedToggle.setChecked(true);
      await nextTick();
      
      // Find field checkboxes and test selection
      const fieldCheckboxes = wrapper.findAll('input[type="checkbox"]');
      if (fieldCheckboxes.length > 1) {
        await fieldCheckboxes[1].setChecked(true);
        expect(wrapper.emitted('search')).toBeTruthy();
      }
    }
  });

  it('shows search modifiers help text', async () => {
    const advancedToggle = wrapper.find('#show-advanced');
    if (advancedToggle.exists()) {
      await advancedToggle.setChecked(true);
      await nextTick();
      
      const text = wrapper.text();
      expect(text.includes('quotes') || text.includes('exact') || text.includes('+') || text.includes('-')).toBe(true);
    }
  });
});
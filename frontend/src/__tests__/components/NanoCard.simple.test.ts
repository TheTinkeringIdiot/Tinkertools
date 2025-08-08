import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import NanoCard from '@/components/nanos/NanoCard.vue';
import type { NanoProgram } from '@/types/nano';

// Mock localStorage
global.localStorage = {
  getItem: vi.fn(() => '[]'),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
} as any;

// Minimal PrimeVue component mocks - just render basic HTML
vi.mock('primevue/card', () => ({
  default: {
    name: 'Card',
    template: '<div class="nano-card"><slot name="header" /><slot /></div>'
  }
}));

vi.mock('primevue/avatar', () => ({
  default: {
    name: 'Avatar',
    template: '<div class="avatar">{{ label || "?" }}</div>',
    props: ['label', 'size', 'shape']
  }
}));

vi.mock('primevue/badge', () => ({
  default: {
    name: 'Badge',
    template: '<span class="badge">{{ value }}</span>',
    props: ['value', 'severity', 'size']
  }
}));

vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button class="nano-favorite-btn" @click="$emit(\'click\')"><i :class="icon"></i>{{ label }}</button>',
    props: ['icon', 'label', 'severity', 'text', 'rounded', 'size'],
    emits: ['click']
  }
}));

vi.mock('primevue/chip', () => ({
  default: {
    name: 'Chip',
    template: '<span class="chip">{{ label }}</span>',
    props: ['label', 'severity']
  }
}));

describe('NanoCard Simple Tests', () => {
  let pinia: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  const createNano = (overrides = {}): NanoProgram => ({
    id: 1,
    name: 'Test Nano',
    aoid: 123456,
    ql: 100,
    item_class: 0,
    description: 'A test nano program',
    is_nano: true,
    ...overrides
  });

  it('renders nano name correctly', () => {
    const nano = createNano({ name: 'Superior Heal' });
    
    const wrapper = mount(NanoCard, {
      global: { plugins: [pinia] },
      props: {
        nano,
        compact: false,
        showCompatibility: false
      }
    });

    expect(wrapper.text()).toContain('Superior Heal');
  });

  it('displays quality level badge', () => {
    const nano = createNano({ ql: 175 });
    
    const wrapper = mount(NanoCard, {
      global: { plugins: [pinia] },
      props: {
        nano,
        compact: false,
        showCompatibility: false
      }
    });

    expect(wrapper.text()).toContain('175');
  });

  it('shows favorite button', () => {
    const nano = createNano();
    
    const wrapper = mount(NanoCard, {
      global: { plugins: [pinia] },
      props: {
        nano,
        compact: false,
        showCompatibility: false
      }
    });

    const favoriteBtn = wrapper.find('.nano-favorite-btn');
    expect(favoriteBtn.exists()).toBe(true);
  });

  it('emits select event when card is clicked', async () => {
    const nano = createNano();
    
    const wrapper = mount(NanoCard, {
      global: { plugins: [pinia] },
      props: {
        nano,
        compact: false,
        showCompatibility: false
      }
    });

    const card = wrapper.find('.nano-card');
    await card.trigger('click');
    
    expect(wrapper.emitted('select')).toBeTruthy();
    expect(wrapper.emitted('select')?.[0]).toEqual([nano]);
  });

  it('toggles favorite when favorite button is clicked', async () => {
    const nano = createNano();
    
    const wrapper = mount(NanoCard, {
      global: { plugins: [pinia] },
      props: {
        nano,
        compact: false,
        showCompatibility: false
      }
    });

    const favoriteBtn = wrapper.find('.nano-favorite-btn');
    await favoriteBtn.trigger('click');
    
    expect(wrapper.emitted('favorite')).toBeTruthy();
    expect(wrapper.emitted('favorite')?.[0]).toEqual([nano.id, true]);
  });

  it('renders in compact mode when compact prop is true', () => {
    const nano = createNano();
    
    const wrapper = mount(NanoCard, {
      global: { plugins: [pinia] },
      props: {
        nano,
        compact: true,
        showCompatibility: false
      }
    });
    
    // Should still render the nano name in compact mode
    expect(wrapper.text()).toContain('Test Nano');
  });

  it('handles minimal nano data without errors', () => {
    const minimalNano = {
      id: 2,
      name: 'Minimal Nano',
      aoid: 999,
      ql: 1,
      item_class: 0,
      is_nano: true
    };
    
    const wrapper = mount(NanoCard, {
      global: { plugins: [pinia] },
      props: {
        nano: minimalNano,
        compact: false,
        showCompatibility: false
      }
    });
    
    expect(wrapper.text()).toContain('Minimal Nano');
    expect(wrapper.find('.nano-card').exists()).toBe(true);
  });

  it('shows description when provided', () => {
    const nano = createNano({ 
      description: 'This is a test nano description' 
    });
    
    const wrapper = mount(NanoCard, {
      global: { plugins: [pinia] },
      props: {
        nano,
        compact: false,
        showCompatibility: false
      }
    });

    expect(wrapper.text()).toContain('This is a test nano description');
  });

  it('loads favorite status from localStorage on mount', () => {
    const nano = createNano();
    
    mount(NanoCard, {
      global: { plugins: [pinia] },
      props: {
        nano,
        compact: false,
        showCompatibility: false
      }
    });
    
    expect(localStorage.getItem).toHaveBeenCalledWith('tinkertools_nano_favorites');
  });
});
/**
 * TinkerNanos Backend Integration Tests
 *
 * TRUE INTEGRATION TEST - Requires real backend
 * Tests TinkerNanos view with real backend integration
 *
 * Strategy: Skip when backend not available (Option B)
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import TinkerNanos from '@/views/TinkerNanos.vue';
import { useNanosStore } from '@/stores/nanosStore';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import { BREED, PROFESSION } from '@/__tests__/helpers';
import { isBackendAvailable } from '../helpers/backend-check';

// Mock localStorage
global.localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
} as any;

// Create a minimal router for the test
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div>Home</div>' } },
    { path: '/nanos', component: TinkerNanos }
  ]
});

// Simple component mocks that just render content
vi.mock('@/components/nanos/NanoSearch.vue', () => ({
  default: {
    name: 'NanoSearch',
    template: '<div class="nano-search"><input type="text" placeholder="Search nanos" /></div>',
    props: ['modelValue', 'totalResults'],
    emits: ['search', 'update:modelValue']
  }
}));

vi.mock('@/components/nanos/NanoFilters.vue', () => ({
  default: {
    name: 'NanoFilters', 
    template: '<div class="nano-filters">Filters</div>',
    props: ['modelValue', 'showCompatibility', 'activeProfile'],
    emits: ['update:modelValue', 'filter-change']
  }
}));

vi.mock('@/components/nanos/NanoList.vue', () => ({
  default: {
    name: 'NanoList',
    template: '<div class="nano-list">{{ nanos.length }} nanos</div>',
    props: ['nanos', 'loading', 'showCompatibility', 'activeProfile'],
    emits: ['nano-select', 'page-change', 'favorite']
  }
}));

vi.mock('@/components/nanos/NanoSchoolView.vue', () => ({
  default: {
    name: 'NanoSchoolView',
    template: '<div class="nano-school-view">School view</div>',
    props: ['nanos', 'showCompatibility', 'activeProfile'],
    emits: ['nano-select', 'strain-conflict', 'favorite']
  }
}));

vi.mock('@/components/nanos/NanoDetail.vue', () => ({
  default: {
    name: 'NanoDetail',
    template: '<div class="nano-detail" v-if="visible">{{ nano?.name }}</div>',
    props: ['visible', 'nano', 'activeProfile', 'showCompatibility'],
    emits: ['update:visible', 'close']
  }
}));

// Mock PrimeVue components minimally
vi.mock('primevue/badge', () => ({
  default: {
    name: 'Badge',
    template: '<span>{{ value }}</span>',
    props: ['value', 'severity']
  }
}));

vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template: '<button @click="$emit(\'click\')">{{ label }}</button>',
    props: ['label', 'severity', 'text'],
    emits: ['click']
  }
}));

vi.mock('primevue/dropdown', () => ({
  default: {
    name: 'Dropdown',
    template: `<select v-model="modelValue" @change="$emit('update:modelValue', $event.target.value)">
      <option value="">No Profile</option>
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>`,
    props: ['modelValue', 'options', 'placeholder'],
    emits: ['update:modelValue', 'change']
  }
}));

vi.mock('primevue/inputswitch', () => ({
  default: {
    name: 'InputSwitch',
    template: '<input type="checkbox" v-model="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
    props: ['modelValue'],
    emits: ['update:modelValue']
  }
}));

vi.mock('primevue/progressspinner', () => ({
  default: {
    name: 'ProgressSpinner',
    template: '<div class="loading">Loading...</div>'
  }
}));

vi.mock('primevue/togglebutton', () => ({
  default: {
    name: 'ToggleButton',
    template: '<button @click="$emit(\'update:modelValue\', !modelValue)">{{ modelValue ? "List" : "Schools" }}</button>',
    props: ['modelValue', 'onLabel', 'offLabel'],
    emits: ['update:modelValue']
  }
}));

// Check backend availability before running tests
let BACKEND_AVAILABLE = false;

beforeAll(async () => {
  BACKEND_AVAILABLE = await isBackendAvailable();
  if (!BACKEND_AVAILABLE) {
    console.warn('Backend not available - skipping TinkerNanos backend integration tests');
  }
});

describe.skipIf(!BACKEND_AVAILABLE)('TinkerNanos Backend Integration', () => {
  let pinia: any;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    await router.push('/nanos');
    await router.isReady();
  });

  it('loads and displays TinkerNanos view', () => {
    const wrapper = mount(TinkerNanos, {
      global: {
        plugins: [pinia, router]
      }
    });

    expect(wrapper.find('h1').text()).toContain('TinkerNanos');
    expect(wrapper.find('.nano-search').exists()).toBe(true);
    expect(wrapper.find('.nano-filters').exists()).toBe(true);
  });

  it('initializes stores and fetches nano data from backend', async () => {
    const nanosStore = useNanosStore();
    const profilesStore = useTinkerProfilesStore();

    const wrapper = mount(TinkerNanos, {
      global: {
        plugins: [pinia, router]
      }
    });

    // Wait for component to mount and stores to initialize
    await wrapper.vm.$nextTick();

    expect(nanosStore).toBeDefined();
    expect(profilesStore).toBeDefined();
    
    // Manually trigger fetch to test backend integration
    expect(nanosStore.loading).toBe(false);
    
    // Start fetch
    const fetchPromise = nanosStore.fetchNanos();
    expect(nanosStore.loading).toBe(true);
    
    // Wait for real backend data
    await fetchPromise;
    
    expect(nanosStore.loading).toBe(false);
    expect(nanosStore.nanos.length).toBeGreaterThan(0);
    expect(nanosStore.totalCount).toBeGreaterThan(0);
  }, 10000);

  it('displays nano count when data is loaded', async () => {
    const nanosStore = useNanosStore();

    const wrapper = mount(TinkerNanos, {
      global: {
        plugins: [pinia, router]
      }
    });

    // Load real data
    await nanosStore.fetchNanos();

    // Force update to show loaded data
    await wrapper.vm.$nextTick();

    // Should show nano count in the list component
    const nanoList = wrapper.find('.nano-list');
    expect(nanoList.exists()).toBe(true);
    expect(nanoList.text()).toMatch(/\d+ nanos/);
  }, 10000);

  it('handles profile selection', async () => {
    const profilesStore = useTinkerProfilesStore();

    const wrapper = mount(TinkerNanos, {
      global: {
        plugins: [pinia, router]
      }
    });

    // Create a test profile
    const profile = await profilesStore.createProfile('Test Profile', {
      Character: {
        Profession: PROFESSION.DOCTOR, // 10
        Breed: BREED.SOLITUS, // 1
        Level: 100
      }
    });

    await wrapper.vm.$nextTick();

    // Should show profile in dropdown
    const dropdown = wrapper.find('select');
    expect(dropdown.exists()).toBe(true);
    
    // Select the profile
    await dropdown.setValue(profile.id);
    await dropdown.trigger('change');
    
    expect(profilesStore.activeProfile).toBeTruthy();
    expect(profilesStore.activeProfile?.id).toBe(profile.id);
  }, 10000);

  it('toggles between list and school view modes', async () => {
    const wrapper = mount(TinkerNanos, {
      global: {
        plugins: [pinia, router]
      }
    });

    await wrapper.vm.$nextTick();

    // Find view toggle button
    const viewToggle = wrapper.findAll('button').find(btn => 
      btn.text().includes('List') || btn.text().includes('Schools')
    );
    
    expect(viewToggle).toBeDefined();

    // Should initially show one view
    expect(
      wrapper.find('.nano-list').exists() || 
      wrapper.find('.nano-school-view').exists()
    ).toBe(true);

    // Toggle view mode
    if (viewToggle) {
      await viewToggle.trigger('click');
      await wrapper.vm.$nextTick();

      // Should still show a view component
      expect(
        wrapper.find('.nano-list').exists() || 
        wrapper.find('.nano-school-view').exists()
      ).toBe(true);
    }
  });

  it('handles loading states correctly', async () => {
    const nanosStore = useNanosStore();
    
    const wrapper = mount(TinkerNanos, {
      global: {
        plugins: [pinia, router]
      }
    });

    // Initially not loading
    expect(nanosStore.loading).toBe(false);
    
    // Start loading
    const fetchPromise = nanosStore.fetchNanos();
    expect(nanosStore.loading).toBe(true);
    
    await wrapper.vm.$nextTick();
    
    // Should show loading indicator
    const loading = wrapper.find('.loading');
    expect(loading.exists()).toBe(true);
    
    // Wait for completion
    await fetchPromise;
    expect(nanosStore.loading).toBe(false);
    
    await wrapper.vm.$nextTick();
    
    // Loading should be gone
    expect(wrapper.find('.loading').exists()).toBe(false);
  }, 10000);
});
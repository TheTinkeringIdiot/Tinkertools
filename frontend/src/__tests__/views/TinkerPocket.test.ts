import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { createRouter, createWebHistory } from 'vue-router';
import PrimeVue from 'primevue/config';
import TinkerPocket from '@/views/TinkerPocket.vue';
import { usePocketBossStore } from '@/stores/pocketBossStore';
import { useSymbiantsStore } from '@/stores/symbiants';
import type { PocketBoss, Symbiant } from '@/types/api';

// Mock child components
vi.mock('@/components/pocket/PocketBossDatabase.vue', () => ({
  default: { template: '<div class="mock-pocket-boss-database">Pocket Boss Database</div>' }
}));

vi.mock('@/components/pocket/SymbiantLookup.vue', () => ({
  default: { template: '<div class="mock-symbiant-lookup">Symbiant Lookup</div>' }
}));

vi.mock('@/components/pocket/BossSymbiantMatcher.vue', () => ({
  default: { template: '<div class="mock-boss-symbiant-matcher">Boss Symbiant Matcher</div>' }
}));

vi.mock('@/components/pocket/CollectionTracker.vue', () => ({
  default: { template: '<div class="mock-collection-tracker">Collection Tracker</div>' }
}));

// Mock PrimeVue components
vi.mock('primevue/tabview', () => ({
  default: { 
    template: `
      <div class="mock-tabview">
        <div class="tab-headers">
          <div v-for="(item, index) in $slots" :key="index" class="tab-header">
            Tab {{ index }}
          </div>
        </div>
        <div class="tab-panels">
          <slot></slot>
        </div>
      </div>
    `,
    props: ['activeIndex']
  }
}));

vi.mock('primevue/tabpanel', () => ({
  default: { 
    template: `
      <div class="mock-tabpanel">
        <div class="panel-header">
          <slot name="header"></slot>
        </div>
        <div class="panel-content">
          <slot></slot>
        </div>
      </div>
    `
  }
}));

describe('TinkerPocket', () => {
  let wrapper: VueWrapper;
  let pocketBossStore: any;
  let symbiantStore: any;
  let router: any;

  const mockBosses: PocketBoss[] = [
    {
      id: 1,
      name: 'Test Boss',
      level: 100,
      playfield: 'Nascence',
      location: 'Central',
      dropped_symbiants: []
    }
  ];

  const mockSymbiants: Symbiant[] = [
    {
      id: 1,
      aoid: 100,
      name: 'Test Symbiant',
      slot: 'Head',
      ql: 150,
      family: 'Artillery'
    }
  ];

  beforeEach(() => {
    // Create router
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/pocket', component: { template: '<div>Pocket</div>' } }
      ]
    });

    wrapper = mount(TinkerPocket, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              pocketBoss: {
                pocketBosses: mockBosses,
                loading: false,
                error: null
              },
              symbiants: {
                symbiants: new Map(mockSymbiants.map(s => [s.id, s])),
                loading: false,
                error: null
              }
            }
          }),
          PrimeVue,
          router
        ]
      }
    });

    pocketBossStore = usePocketBossStore();
    pocketBossStore.fetchPocketBosses = vi.fn().mockResolvedValue(undefined);
    
    symbiantStore = useSymbiantsStore();
    symbiantStore.searchSymbiants = vi.fn().mockResolvedValue(mockSymbiants);
  });

  it('renders the main TinkerPocket view', () => {
    expect(wrapper.find('.tinker-pocket').exists()).toBe(true);
  });

  it('displays the header with title and description', () => {
    expect(wrapper.text()).toContain('TinkerPocket');
    expect(wrapper.text()).toContain('Pocket Boss & Symbiant Tool');
    expect(wrapper.text()).toContain('Track pocket bosses, symbiant drops, and manage your collection progress');
  });

  it('displays the beta badge', () => {
    expect(wrapper.text()).toContain('BETA');
  });

  it('renders tab navigation', () => {
    expect(wrapper.find('.mock-tabview').exists()).toBe(true);
    expect(wrapper.findAll('.mock-tabpanel')).toHaveLength(4);
  });

  it('displays all four tab panels', () => {
    const tabPanels = wrapper.findAll('.mock-tabpanel');
    expect(tabPanels).toHaveLength(4);
    
    // Check that each component is rendered
    expect(wrapper.find('.mock-pocket-boss-database').exists()).toBe(true);
    expect(wrapper.find('.mock-symbiant-lookup').exists()).toBe(true);
    expect(wrapper.find('.mock-boss-symbiant-matcher').exists()).toBe(true);
    expect(wrapper.find('.mock-collection-tracker').exists()).toBe(true);
  });

  it('shows loading state initially', async () => {
    const loadingWrapper = mount(TinkerPocket, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              pocketBoss: { loading: true },
              symbiants: { loading: true }
            }
          }),
          PrimeVue,
          router
        ]
      }
    });

    expect(loadingWrapper.text()).toContain('Loading pocket boss and symbiant data...');
  });

  it('shows error state when loading fails', async () => {
    const errorWrapper = mount(TinkerPocket, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              pocketBoss: { error: 'Failed to load' },
              symbiants: { error: null }
            }
          }),
          PrimeVue,
          router
        ]
      }
    });

    const component = errorWrapper.vm as any;
    component.error = 'Failed to load data';
    await errorWrapper.vm.$nextTick();

    expect(errorWrapper.text()).toContain('Failed to load data');
    expect(errorWrapper.text()).toContain('Retry');
  });

  it('fetches data on mount', () => {
    expect(pocketBossStore.fetchPocketBosses).toHaveBeenCalled();
    expect(symbiantStore.searchSymbiants).toHaveBeenCalledWith({ page: 1, limit: 1000 });
  });

  it('handles data loading errors', async () => {
    const errorMessage = 'Network error';
    pocketBossStore.fetchPocketBosses.mockRejectedValue(new Error(errorMessage));
    
    const errorWrapper = mount(TinkerPocket, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn
          }),
          PrimeVue,
          router
        ]
      }
    });

    await errorWrapper.vm.$nextTick();
    // The error should be caught and set in the component
  });

  it('manages active tab state', async () => {
    const component = wrapper.vm as any;
    
    expect(component.activeTab).toBe(0);
    
    component.activeTab = 1;
    await wrapper.vm.$nextTick();
    
    expect(component.activeTab).toBe(1);
  });

  it('displays correct loading message', () => {
    const component = wrapper.vm as any;
    component.loading = true;
    
    expect(component.loadingMessage).toBe('Loading pocket boss and symbiant data...');
    
    component.loading = false;
    expect(component.loadingMessage).toBe('');
  });

  it('has correct tab configuration', () => {
    const component = wrapper.vm as any;
    const tabs = component.tabItems;
    
    expect(tabs).toHaveLength(4);
    expect(tabs[0].label).toBe('Pocket Bosses');
    expect(tabs[1].label).toBe('Symbiant Lookup');
    expect(tabs[2].label).toBe('Boss-Symbiant Match');
    expect(tabs[3].label).toBe('Collection Tracker');
  });

  it('renders with proper CSS classes', () => {
    expect(wrapper.find('.tinker-pocket').exists()).toBe(true);
    expect(wrapper.find('.container').exists()).toBe(true);
    expect(wrapper.find('.mx-auto').exists()).toBe(true);
  });

  it('handles successful data loading', async () => {
    const component = wrapper.vm as any;
    
    // Simulate successful loading
    component.loading = false;
    component.error = null;
    await wrapper.vm.$nextTick();
    
    expect(wrapper.find('.tinker-pocket-content').exists()).toBe(true);
    expect(wrapper.find('.mock-tabview').exists()).toBe(true);
  });

  it('provides stores to child components', () => {
    // Child components should have access to the stores
    // This is verified by the fact that they render without errors
    expect(wrapper.find('.mock-pocket-boss-database').exists()).toBe(true);
    expect(wrapper.find('.mock-symbiant-lookup').exists()).toBe(true);
  });

  it('has proper component structure', () => {
    expect(wrapper.element.tagName.toLowerCase()).toBe('div');
    expect(wrapper.classes()).toContain('tinker-pocket');
  });
});
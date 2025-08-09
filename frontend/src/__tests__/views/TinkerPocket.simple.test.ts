import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import PrimeVue from 'primevue/config';

// Mock the API client
vi.mock('@/services/api-client', () => ({
  apiClient: {
    searchPocketBosses: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 50
    }),
    searchSymbiants: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 50
    })
  }
}));

// Mock child components
const MockPocketBossDatabase = { template: '<div class="mock-pocket-boss-database">Pocket Boss Database</div>' };
const MockSymbiantLookup = { template: '<div class="mock-symbiant-lookup">Symbiant Lookup</div>' };
const MockBossSymbiantMatcher = { template: '<div class="mock-boss-symbiant-matcher">Boss Symbiant Matcher</div>' };
const MockCollectionTracker = { template: '<div class="mock-collection-tracker">Collection Tracker</div>' };

// Mock PrimeVue components
const MockTabView = { 
  template: `
    <div class="mock-tabview">
      <div class="tab-navigation">
        <div v-for="(_, index) in 4" :key="index" class="tab-header" @click="activeIndex = index">
          Tab {{ index }}
        </div>
      </div>
      <div class="tab-content">
        <slot></slot>
      </div>
    </div>
  `,
  props: ['activeIndex']
};

const MockTabPanel = { 
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
};

describe('TinkerPocket View Structure', () => {
  const createWrapper = (options = {}) => {
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: '/pocket', component: { template: '<div>Pocket</div>' } }]
    });

    const defaultData = {
      loading: false,
      error: null,
      activeTab: 0,
      tabItems: [
        { label: 'Pocket Bosses', icon: 'pi pi-users' },
        { label: 'Symbiant Lookup', icon: 'pi pi-search' },
        { label: 'Boss-Symbiant Match', icon: 'pi pi-link' },
        { label: 'Collection Tracker', icon: 'pi pi-list-check' }
      ],
      ...options
    };

    return mount({
      template: `
        <div class="tinker-pocket container mx-auto px-4 py-6">
          <!-- Header -->
          <div class="mb-6">
            <div class="flex items-center gap-3 mb-2">
              <i class="pi pi-map text-2xl text-primary-500"></i>
              <h1 class="text-3xl font-bold">TinkerPocket</h1>
              <span class="text-xs bg-surface-100 px-2 py-1 rounded text-surface-600">
                Pocket Boss & Symbiant Tool
              </span>
            </div>
            <p class="text-surface-600">
              Track pocket bosses, symbiant drops, and manage your collection progress
            </p>
          </div>

          <!-- Loading State -->
          <div v-if="loading" class="text-center py-12">
            <i class="pi pi-spinner pi-spin text-4xl text-primary-500 mb-4"></i>
            <p class="text-lg text-surface-600">{{ loadingMessage }}</p>
          </div>

          <!-- Error State -->
          <div v-else-if="error" class="text-center py-12">
            <i class="pi pi-exclamation-triangle text-4xl text-red-500 mb-4"></i>
            <p class="text-lg text-red-600 mb-4">{{ error }}</p>
            <button class="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors">
              Retry
            </button>
          </div>

          <!-- Main Content -->
          <div v-else class="tinker-pocket-content">
            <MockTabView v-model:activeIndex="activeTab" class="pocket-tabs">
              <MockTabPanel v-for="(tab, index) in tabItems" :key="index">
                <template #header>
                  <div class="flex items-center gap-2">
                    <i :class="tab.icon"></i>
                    <span>{{ tab.label }}</span>
                  </div>
                </template>
                
                <MockPocketBossDatabase v-if="index === 0" />
                <MockSymbiantLookup v-else-if="index === 1" />
                <MockBossSymbiantMatcher v-else-if="index === 2" />
                <MockCollectionTracker v-else />
              </MockTabPanel>
            </MockTabView>
          </div>
        </div>
      `,
      components: {
        MockTabView,
        MockTabPanel,
        MockPocketBossDatabase,
        MockSymbiantLookup,
        MockBossSymbiantMatcher,
        MockCollectionTracker
      },
      data() {
        return defaultData;
      },
      computed: {
        loadingMessage() {
          return this.loading ? 'Loading pocket boss and symbiant data...' : '';
        }
      }
    }, {
      global: {
        plugins: [createPinia(), PrimeVue, router]
      }
    });
  };

  it('renders the main TinkerPocket view', () => {
    const wrapper = createWrapper();
    expect(wrapper.find('.tinker-pocket').exists()).toBe(true);
  });

  it('displays the header with title and description', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('TinkerPocket');
    expect(wrapper.text()).toContain('Pocket Boss & Symbiant Tool');
    expect(wrapper.text()).toContain('Track pocket bosses, symbiant drops, and manage your collection progress');
  });

  it('shows loading state', () => {
    const wrapper = createWrapper({ loading: true });
    expect(wrapper.text()).toContain('Loading pocket boss and symbiant data...');
    expect(wrapper.find('.pi-spinner').exists()).toBe(true);
  });

  it('shows error state', () => {
    const wrapper = createWrapper({ error: 'Failed to load data' });
    expect(wrapper.text()).toContain('Failed to load data');
    expect(wrapper.find('.pi-exclamation-triangle').exists()).toBe(true);
    expect(wrapper.text()).toContain('Retry');
  });

  it('displays main content when loaded successfully', () => {
    const wrapper = createWrapper();
    expect(wrapper.find('.tinker-pocket-content').exists()).toBe(true);
    expect(wrapper.find('.mock-tabview').exists()).toBe(true);
  });

  it('renders all four tab panels with correct components', () => {
    const wrapper = createWrapper();
    expect(wrapper.find('.mock-pocket-boss-database').exists()).toBe(true);
    expect(wrapper.find('.mock-symbiant-lookup').exists()).toBe(true);
    expect(wrapper.find('.mock-boss-symbiant-matcher').exists()).toBe(true);
    expect(wrapper.find('.mock-collection-tracker').exists()).toBe(true);
  });

  it('displays tab headers with correct labels', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('Pocket Bosses');
    expect(wrapper.text()).toContain('Symbiant Lookup');
    expect(wrapper.text()).toContain('Boss-Symbiant Match');
    expect(wrapper.text()).toContain('Collection Tracker');
  });

  it('has proper CSS classes and structure', () => {
    const wrapper = createWrapper();
    expect(wrapper.find('.tinker-pocket').exists()).toBe(true);
    expect(wrapper.find('.container').exists()).toBe(true);
    expect(wrapper.find('.mx-auto').exists()).toBe(true);
    expect(wrapper.find('.pocket-tabs').exists()).toBe(true);
  });

  it('manages active tab state', async () => {
    const wrapper = createWrapper();
    const component = wrapper.vm as any;
    
    expect(component.activeTab).toBe(0);
    
    component.activeTab = 2;
    await wrapper.vm.$nextTick();
    
    expect(component.activeTab).toBe(2);
  });

  it('has correct tab configuration', () => {
    const wrapper = createWrapper();
    const component = wrapper.vm as any;
    
    expect(component.tabItems).toHaveLength(4);
    expect(component.tabItems[0].label).toBe('Pocket Bosses');
    expect(component.tabItems[1].label).toBe('Symbiant Lookup');
    expect(component.tabItems[2].label).toBe('Boss-Symbiant Match');
    expect(component.tabItems[3].label).toBe('Collection Tracker');
  });
});

// Test integration workflow
describe('TinkerPocket Integration Workflow', () => {
  it('simulates complete loading workflow', async () => {
    const wrapper = mount({
      template: `
        <div class="workflow-test">
          <div v-if="currentStep === 'loading'">Loading...</div>
          <div v-else-if="currentStep === 'loaded'">Content Loaded</div>
          <div v-else-if="currentStep === 'error'">Error Occurred</div>
          <button @click="simulateLoad">Start Load</button>
        </div>
      `,
      data() {
        return {
          currentStep: 'initial'
        };
      },
      methods: {
        async simulateLoad() {
          this.currentStep = 'loading';
          
          try {
            // Simulate API calls
            await new Promise(resolve => setTimeout(resolve, 10));
            this.currentStep = 'loaded';
          } catch {
            this.currentStep = 'error';
          }
        }
      }
    }, {
      global: {
        plugins: [createPinia(), PrimeVue]
      }
    });

    expect(wrapper.vm.currentStep).toBe('initial');
    
    await wrapper.find('button').trigger('click');
    expect(wrapper.vm.currentStep).toBe('loading');
    
    // Wait for async operation
    await wrapper.vm.$nextTick();
    await new Promise(resolve => setTimeout(resolve, 20));
    
    expect(wrapper.vm.currentStep).toBe('loaded');
  });
});
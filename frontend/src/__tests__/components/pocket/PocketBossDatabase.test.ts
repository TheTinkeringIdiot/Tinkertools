import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';
import PocketBossDatabase from '@/components/pocket/PocketBossDatabase.vue';
import { usePocketBossStore } from '@/stores/pocketBossStore';
import type { PocketBoss } from '@/types/api';

// Mock the API client
vi.mock('@/services/api-client', () => ({
  apiClient: {
    searchPocketBosses: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 50,
      pages: 0,
      has_next: false,
      has_prev: false
    })
  }
}));

// Mock PrimeVue components
vi.mock('primevue/card', () => ({
  default: { template: '<div class="mock-card"><slot name="content"></slot></div>' }
}));

vi.mock('primevue/inputtext', () => ({
  default: { template: '<input class="mock-inputtext" v-bind="$attrs" />' }
}));

vi.mock('primevue/dropdown', () => ({
  default: { template: '<select class="mock-dropdown" v-bind="$attrs"><option value="">All</option></select>' }
}));

vi.mock('primevue/slider', () => ({
  default: { template: '<input type="range" class="mock-slider" v-bind="$attrs" />' }
}));

vi.mock('primevue/button', () => ({
  default: { template: '<button class="mock-button" v-bind="$attrs"><slot></slot></button>' }
}));

vi.mock('primevue/dataview', () => ({
  default: { 
    template: `
      <div class="mock-dataview">
        <slot name="empty" v-if="!value || value.length === 0"></slot>
        <slot name="grid" v-else :items="value"></slot>
      </div>
    `,
    props: ['value', 'layout', 'paginator', 'rows', 'rowsPerPageOptions']
  }
}));

vi.mock('primevue/tag', () => ({
  default: { 
    template: '<span class="mock-tag" :class="`severity-${severity}`">{{ value }}</span>',
    props: ['value', 'severity']
  }
}));

vi.mock('primevue/dialog', () => ({
  default: { 
    template: `
      <div class="mock-dialog" v-if="visible">
        <slot name="header"></slot>
        <slot></slot>
      </div>
    `,
    props: ['visible']
  }
}));

describe('PocketBossDatabase', () => {
  let wrapper: VueWrapper;
  let store: any;

  const mockBosses: PocketBoss[] = [
    {
      id: 1,
      name: 'Test Boss 1',
      level: 100,
      playfield: 'Nascence',
      location: 'Central Complex',
      mobs: 'Test mobs 1',
      dropped_symbiants: [
        { id: 1, aoid: 100, name: 'Test Symbiant 1', slot: 'Head', ql: 150 }
      ]
    },
    {
      id: 2,
      name: 'Test Boss 2',
      level: 150,
      playfield: 'Shadowlands',
      location: 'Dark Tunnels',
      mobs: 'Test mobs 2',
      dropped_symbiants: []
    }
  ];

  beforeEach(() => {
    const pinia = createPinia();
    
    wrapper = mountWithContext(PocketBossDatabase, {
      global: {
        plugins: [pinia, PrimeVue]
      }
    });

    store = usePocketBossStore(pinia);
    // Set up mock data
    store.pocketBosses = mockBosses;
    store.updateFilters = vi.fn();
    store.clearFilters = vi.fn();
  });

  it('renders the component', () => {
    expect(wrapper.find('[data-testid="pocket-boss-database"]').exists()).toBe(false);
    expect(wrapper.find('.pocket-boss-database').exists()).toBe(true);
  });

  it('displays filter controls', () => {
    expect(wrapper.find('.mock-inputtext').exists()).toBe(true);
    expect(wrapper.find('.mock-dropdown').exists()).toBe(true);
    expect(wrapper.find('.mock-slider').exists()).toBe(true);
  });

  it('displays boss count', () => {
    expect(wrapper.text()).toContain('2 bosses found');
  });

  it('displays clear filters button', () => {
    const clearButton = wrapper.find('.mock-button');
    expect(clearButton.exists()).toBe(true);
    expect(clearButton.text()).toContain('Clear Filters');
  });

  it('displays view mode toggle buttons', () => {
    const buttons = wrapper.findAll('.mock-button');
    expect(buttons.length).toBeGreaterThan(2); // Clear filters + grid/list toggles
  });

  it('shows empty state when no bosses found', async () => {
    store.filteredPocketBosses = [];
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('No pocket bosses found');
  });

  it('calls updateFilters when search input changes', async () => {
    const searchInput = wrapper.find('.mock-inputtext');
    await searchInput.setValue('test search');
    await searchInput.trigger('input');

    expect(store.updateFilters).toHaveBeenCalledWith({ search: 'test search' });
  });

  it('calls clearFilters when clear button is clicked', async () => {
    const clearButton = wrapper.find('.mock-button');
    await clearButton.trigger('click');

    expect(store.clearFilters).toHaveBeenCalled();
  });

  it('formats location correctly', () => {
    const component = wrapper.vm as any;
    
    const bossWithBoth = {
      playfield: 'Nascence',
      location: 'Central Complex'
    };
    expect(component.formatLocation(bossWithBoth)).toBe('Nascence - Central Complex');

    const bossWithPlayfield = {
      playfield: 'Nascence'
    };
    expect(component.formatLocation(bossWithPlayfield)).toBe('Nascence');

    const bossWithLocation = {
      location: 'Central Complex'
    };
    expect(component.formatLocation(bossWithLocation)).toBe('Central Complex');

    const bossWithNeither = {};
    expect(component.formatLocation(bossWithNeither)).toBe('Unknown Location');
  });

  it('calculates severity correctly for different levels', () => {
    const component = wrapper.vm as any;
    
    expect(component.getSeverity(30)).toBe('success');
    expect(component.getSeverity(70)).toBe('info');
    expect(component.getSeverity(120)).toBe('warning');
    expect(component.getSeverity(180)).toBe('danger');
  });

  it('handles boss details dialog', async () => {
    const component = wrapper.vm as any;
    
    // Initially dialog should be closed
    expect(component.showBossDetails).toBe(false);
    expect(component.selectedBoss).toBeNull();

    // Show details for a boss
    component.showDetails(mockBosses[0]);
    await wrapper.vm.$nextTick();

    expect(component.showBossDetails).toBe(true);
    expect(component.selectedBoss).toEqual(mockBosses[0]);
  });

  it('displays boss information in grid view', () => {
    // The DataView component should receive the filtered bosses
    const dataView = wrapper.findComponent({ name: 'DataView' });
    expect(dataView.exists()).toBe(false); // Mocked component won't have name

    // Check that boss data is passed to the view
    expect(wrapper.text()).toContain('Test Boss 1');
    expect(wrapper.text()).toContain('Test Boss 2');
  });

  it('handles level range updates', async () => {
    const component = wrapper.vm as any;
    
    // Simulate level filter change
    component.levelFilter = [75, 125];
    component.updateLevelRange();

    expect(store.updateFilters).toHaveBeenCalledWith({
      minLevel: 75,
      maxLevel: 125
    });
  });

  it('handles playfield filter updates', async () => {
    const component = wrapper.vm as any;
    
    component.selectedPlayfield = 'Nascence';
    component.updatePlayfield();

    expect(store.updateFilters).toHaveBeenCalledWith({ playfield: 'Nascence' });
  });
});
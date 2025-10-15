import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { nextTick } from 'vue';
import { mount, VueWrapper } from '@vue/test-utils';
import { mountWithContext, standardCleanup } from '@/__tests__/helpers';
import { createTestingPinia } from '@pinia/testing';
import PrimeVue from 'primevue/config';
import CollectionTracker from '@/components/pocket/CollectionTracker.vue';
import { useSymbiantsStore } from '@/stores/symbiants';
import { usePocketBossStore } from '@/stores/pocketBossStore';
import type { Symbiant, PocketBoss } from '@/types/api';

// Mock PrimeVue components
vi.mock('primevue/card', () => ({
  default: { template: '<div class="mock-card"><slot name="content"></slot></div>' }
}));

vi.mock('primevue/button', () => ({
  default: { template: '<button class="mock-button" v-bind="$attrs" @click="$emit(\'click\')"><slot></slot></button>' }
}));

vi.mock('primevue/checkbox', () => ({
  default: { 
    template: '<input type="checkbox" class="mock-checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', $event.target.checked)" />',
    props: ['modelValue'],
    emits: ['update:modelValue']
  }
}));

vi.mock('primevue/progressbar', () => ({
  default: { 
    template: '<div class="mock-progressbar" :style="`width: ${value}%`">{{ value }}%</div>',
    props: ['value']
  }
}));

vi.mock('primevue/inputtext', () => ({
  default: { template: '<input class="mock-inputtext" v-bind="$attrs" />' }
}));

vi.mock('primevue/dropdown', () => ({
  default: { template: '<select class="mock-dropdown" v-bind="$attrs"></select>' }
}));

vi.mock('primevue/datatable', () => ({
  default: { 
    template: `
      <div class="mock-datatable">
        <slot name="empty" v-if="!value || value.length === 0"></slot>
        <div v-else v-for="item in value" :key="item.id" class="table-row">
          <slot name="body" :data="item"></slot>
        </div>
      </div>
    `,
    props: ['value']
  }
}));

vi.mock('primevue/column', () => ({
  default: { template: '<div class="mock-column"><slot></slot></div>' }
}));

vi.mock('primevue/tag', () => ({
  default: { 
    template: '<span class="mock-tag" :class="`severity-${severity}`">{{ value }}</span>',
    props: ['value', 'severity']
  }
}));

vi.mock('primevue/confirmdialog', () => ({
  default: { template: '<div class="mock-confirmdialog"></div>' }
}));

// Mock useConfirm
vi.mock('primevue/useconfirm', () => ({
  useConfirm: () => ({
    require: vi.fn()
  })
}));

describe('CollectionTracker', () => {
  let wrapper: VueWrapper;
  let symbiantStore: any;
  let pocketBossStore: any;

  const mockSymbiants: Symbiant[] = [
    {
      id: 1,
      aoid: 100,
      name: 'Artillery Head',
      slot: 'Head',
      ql: 150,
      family: 'Artillery'
    },
    {
      id: 2,
      aoid: 200,
      name: 'Control Chest',
      slot: 'Chest',
      ql: 200,
      family: 'Control'
    }
  ];

  const mockBosses: PocketBoss[] = [
    {
      id: 1,
      name: 'Test Boss',
      level: 100,
      playfield: 'Nascence',
      dropped_symbiants: [mockSymbiants[0]]
    }
  ];

  // Mock localStorage
  const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  };

  beforeEach(() => {
    // Mock localStorage
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });

    wrapper = mountWithContext(CollectionTracker, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              symbiants: {
                symbiants: new Map(mockSymbiants.map(s => [s.id, s]))
              },
              pocketBoss: {
                pocketBosses: mockBosses
              }
            }
          }),
          PrimeVue
        ]
      }
    });

    symbiantStore = useSymbiantsStore();
    symbiantStore.symbiants = mockSymbiants;
    
    pocketBossStore = usePocketBossStore();
    pocketBossStore.getPocketBossesBySymbiant = vi.fn((id: number) => 
      mockBosses.filter(boss => 
        boss.dropped_symbiants?.some(s => s.id === id)
      )
    );
  });

  afterEach(() => {
    standardCleanup()
    vi.clearAllMocks();
  });

  it('renders the component', () => {
    expect(wrapper.find('.collection-tracker').exists()).toBe(true);
  });

  it('displays collection progress', () => {
    expect(wrapper.text()).toContain('Collection Progress');
    expect(wrapper.find('.mock-progressbar').exists()).toBe(true);
  });

  it('calculates collection statistics correctly', () => {
    const component = wrapper.vm as any;
    const stats = component.collectionStats;
    
    expect(stats.total).toBe(2);
    expect(stats.collected).toBe(0); // Initially no items collected
    expect(stats.percentage).toBe(0);
    expect(stats.remaining).toBe(2);
  });

  it('calculates progress by slot', () => {
    const component = wrapper.vm as any;
    const stats = component.collectionStats;
    
    expect(stats.bySlot).toHaveLength(2);
    expect(stats.bySlot.find((s: any) => s.slot === 'Head')).toBeDefined();
    expect(stats.bySlot.find((s: any) => s.slot === 'Chest')).toBeDefined();
  });

  it('handles collection item toggle', async () => {
    const component = wrapper.vm as any;
    
    // Initially not collected
    expect(component.getCollectionItem(1).collected).toBe(false);
    
    // Toggle collection
    component.toggleCollection(1);
    expect(component.getCollectionItem(1).collected).toBe(true);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
    
    // Toggle again
    component.toggleCollection(1);
    expect(component.getCollectionItem(1).collected).toBe(false);
  });

  it('creates collection items for unknown symbiants', () => {
    const component = wrapper.vm as any;
    const item = component.getCollectionItem(1);
    
    expect(item).toBeDefined();
    expect(item.collected).toBe(false);
    expect(item.symbiant.id).toBe(1);
  });

  it('filters by search query', async () => {
    const component = wrapper.vm as any;
    
    component.searchQuery = 'Artillery';
    await wrapper.vm.$nextTick();
    
    const filtered = component.filteredSymbiants;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Artillery Head');
  });

  it('filters by selected slots', async () => {
    const component = wrapper.vm as any;
    
    component.selectedSlots = ['Head'];
    await wrapper.vm.$nextTick();
    
    const filtered = component.filteredSymbiants;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].slot).toBe('Head');
  });

  it('filters by selected qualities', async () => {
    const component = wrapper.vm as any;
    
    component.selectedQualities = [150];
    await wrapper.vm.$nextTick();
    
    const filtered = component.filteredSymbiants;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].ql).toBe(150);
  });

  it('filters by family', async () => {
    const component = wrapper.vm as any;
    
    component.selectedFamily = 'Artillery';
    await wrapper.vm.$nextTick();
    
    const filtered = component.filteredSymbiants;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].family).toBe('Artillery');
  });

  it('shows only uncollected when filter is enabled', async () => {
    const component = wrapper.vm as any;
    
    // Collect one item
    component.toggleCollection(1);
    
    // Enable uncollected filter
    component.showOnlyUncollected = true;
    await wrapper.vm.$nextTick();
    
    const filtered = component.filteredSymbiants;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(2); // Only uncollected item
  });

  it('clears all filters', async () => {
    const component = wrapper.vm as any;
    
    // Set filters
    component.searchQuery = 'test';
    component.selectedSlots = ['Head'];
    component.selectedQualities = [150];
    component.selectedFamily = 'Artillery';
    component.showOnlyUncollected = true;
    
    // Clear filters
    component.clearFilters();
    await wrapper.vm.$nextTick();
    
    expect(component.searchQuery).toBe('');
    expect(component.selectedSlots).toEqual([]);
    expect(component.selectedQualities).toEqual([]);
    expect(component.selectedFamily).toBeNull();
    expect(component.showOnlyUncollected).toBe(false);
  });

  it('creates collection goals', async () => {
    const component = wrapper.vm as any;
    
    component.newGoalName = 'Test Goal';
    component.newGoalDescription = 'Test Description';
    component.createCollectionGoal();
    
    expect(component.collectionGoals).toHaveLength(1);
    expect(component.collectionGoals[0].name).toBe('Test Goal');
    expect(component.collectionGoals[0].description).toBe('Test Description');
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('tinkertools-collection-goals', expect.any(String));
  });

  it('calculates goal progress', () => {
    const component = wrapper.vm as any;
    
    const goal = {
      id: '1',
      name: 'Test Goal',
      description: 'Test',
      targetSymbiants: [1, 2],
      createdAt: new Date()
    };
    
    // No items collected
    let progress = component.getGoalProgress(goal);
    expect(progress.total).toBe(2);
    expect(progress.collected).toBe(0);
    expect(progress.percentage).toBe(0);
    
    // Collect one item
    component.toggleCollection(1);
    progress = component.getGoalProgress(goal);
    expect(progress.collected).toBe(1);
    expect(progress.percentage).toBe(50);
  });

  it('exports collection data', () => {
    const component = wrapper.vm as any;
    
    // Mock URL.createObjectURL and related methods
    const mockUrl = 'mock-url';
    global.URL.createObjectURL = vi.fn(() => mockUrl);
    global.URL.revokeObjectURL = vi.fn();
    
    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn()
    };
    document.createElement = vi.fn(() => mockAnchor);
    document.body.appendChild = vi.fn();
    document.body.removeChild = vi.fn();
    
    component.exportCollectionData();
    
    expect(mockAnchor.download).toContain('symbiant-collection-');
    expect(mockAnchor.click).toHaveBeenCalled();
  });

  it('gets drop sources for symbiant', () => {
    const component = wrapper.vm as any;
    const sources = component.getDropSources(mockSymbiants[0]);
    
    expect(sources).toHaveLength(1);
    expect(sources[0].name).toBe('Test Boss');
  });

  it('gets correct slot icons', () => {
    const component = wrapper.vm as any;
    
    expect(component.getSlotIcon('Head')).toBe('pi-user');
    expect(component.getSlotIcon('Chest')).toBe('pi-shield');
    expect(component.getSlotIcon('Unknown')).toBe('pi-circle');
  });

  it('gets quality severity', () => {
    const component = wrapper.vm as any;
    
    expect(component.getQualitySeverity(50)).toBe('success');
    expect(component.getQualitySeverity(120)).toBe('info');
    expect(component.getQualitySeverity(180)).toBe('warning');
    expect(component.getQualitySeverity(250)).toBe('danger');
  });

  it('loads data from localStorage on mount', () => {
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('tinkertools-symbiant-collection');
    expect(mockLocalStorage.getItem).toHaveBeenCalledWith('tinkertools-collection-goals');
  });

  it('saves data to localStorage when collection changes', async () => {
    const component = wrapper.vm as any;
    
    component.toggleCollection(1);
    
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'tinkertools-symbiant-collection',
      expect.any(String)
    );
  });

  it('handles import collection data', () => {
    const component = wrapper.vm as any;
    
    const mockFile = new File(['{"collection": {}, "goals": []}'], 'test.json', {
      type: 'application/json'
    });
    
    const mockEvent = {
      target: {
        files: [mockFile],
        value: ''
      }
    };
    
    // Mock FileReader
    const mockReader = {
      onload: vi.fn(),
      readAsText: vi.fn()
    };
    global.FileReader = vi.fn(() => mockReader);
    
    component.importCollectionData(mockEvent);
    
    expect(mockReader.readAsText).toHaveBeenCalledWith(mockFile);
    expect(mockEvent.target.value).toBe('');
  });
});
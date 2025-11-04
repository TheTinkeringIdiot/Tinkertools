import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount, VueWrapper } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import PrimeVue from 'primevue/config';
import SymbiantLookup from '@/components/pocket/SymbiantLookup.vue';
import { useSymbiantsStore } from '@/stores/symbiants';
import { usePocketBossStore } from '@/stores/pocketBossStore';
import type { Symbiant, PocketBoss } from '@/types/api';

// Mock PrimeVue components
vi.mock('primevue/card', () => ({
  default: { template: '<div class="mock-card"><slot name="content"></slot></div>' },
}));

vi.mock('primevue/inputtext', () => ({
  default: { template: '<input class="mock-inputtext" v-bind="$attrs" />' },
}));

vi.mock('primevue/multiselect', () => ({
  default: { template: '<select multiple class="mock-multiselect" v-bind="$attrs"></select>' },
}));

vi.mock('primevue/dropdown', () => ({
  default: { template: '<select class="mock-dropdown" v-bind="$attrs"></select>' },
}));

vi.mock('primevue/button', () => ({
  default: { template: '<button class="mock-button" v-bind="$attrs"><slot></slot></button>' },
}));

vi.mock('primevue/dataview', () => ({
  default: {
    template: `
      <div class="mock-dataview">
        <slot name="empty" v-if="!value || value.length === 0"></slot>
        <slot name="grid" v-else :items="value"></slot>
      </div>
    `,
    props: ['value', 'layout', 'paginator', 'rows', 'rowsPerPageOptions'],
  },
}));

vi.mock('primevue/tag', () => ({
  default: {
    template: '<span class="mock-tag" :class="`severity-${severity}`">{{ value }}</span>',
    props: ['value', 'severity'],
  },
}));

vi.mock('primevue/dialog', () => ({
  default: {
    template: `
      <div class="mock-dialog" v-if="visible">
        <slot name="header"></slot>
        <slot></slot>
      </div>
    `,
    props: ['visible'],
  },
}));

describe('SymbiantLookup', () => {
  let wrapper: VueWrapper;
  let symbiantStore: any;
  let pocketBossStore: any;

  const mockSymbiants: Symbiant[] = [
    {
      id: 1,
      aoid: 100,
      name: 'Artillery Symbiant',
      slot: 'Head',
      ql: 150,
      family: 'Artillery',
    },
    {
      id: 2,
      aoid: 200,
      name: 'Control Symbiant',
      slot: 'Chest',
      ql: 200,
      family: 'Control',
    },
  ];

  const mockBosses: PocketBoss[] = [
    {
      id: 1,
      name: 'Test Boss 1',
      level: 100,
      playfield: 'Nascence',
      dropped_symbiants: [mockSymbiants[0]],
    },
  ];

  beforeEach(() => {
    wrapper = mountWithContext(SymbiantLookup, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn,
            initialState: {
              symbiants: {
                symbiants: new Map(mockSymbiants.map((s) => [s.id, s])),
                loading: false,
                error: null,
              },
              pocketBoss: {
                pocketBosses: mockBosses,
              },
            },
          }),
          PrimeVue,
        ],
      },
    });

    symbiantStore = useSymbiantsStore();
    symbiantStore.symbiants = mockSymbiants;

    pocketBossStore = usePocketBossStore();
    pocketBossStore.getPocketBossesBySymbiant = vi.fn((id: number) =>
      mockBosses.filter((boss) => boss.dropped_symbiants?.some((s) => s.id === id))
    );
  });

  it('renders the component', () => {
    expect(wrapper.find('.symbiant-lookup').exists()).toBe(true);
  });

  it('displays filter controls', () => {
    expect(wrapper.find('.mock-inputtext').exists()).toBe(true);
    expect(wrapper.findAll('.mock-multiselect').length).toBeGreaterThan(0);
    expect(wrapper.find('.mock-dropdown').exists()).toBe(true);
  });

  it('computes available slots from symbiants', () => {
    const component = wrapper.vm as any;
    expect(component.availableSlots).toEqual(['Chest', 'Head']); // Sorted alphabetically
  });

  it('computes available qualities from symbiants', () => {
    const component = wrapper.vm as any;
    expect(component.availableQualities).toEqual([200, 150]); // Descending order
  });

  it('computes available families from symbiants', () => {
    const component = wrapper.vm as any;
    expect(component.availableFamilies).toEqual(['Artillery', 'Control']); // Sorted
  });

  it('filters symbiants by search query', async () => {
    const component = wrapper.vm as any;

    component.searchQuery = 'Artillery';
    await wrapper.vm.$nextTick();

    const filtered = component.symbiants;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Artillery Symbiant');
  });

  it('filters symbiants by slot', async () => {
    const component = wrapper.vm as any;

    component.selectedSlots = ['Head'];
    await wrapper.vm.$nextTick();

    const filtered = component.symbiants;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].slot).toBe('Head');
  });

  it('filters symbiants by quality', async () => {
    const component = wrapper.vm as any;

    component.selectedQualities = [200];
    await wrapper.vm.$nextTick();

    const filtered = component.symbiants;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].ql).toBe(200);
  });

  it('filters symbiants by family', async () => {
    const component = wrapper.vm as any;

    component.selectedFamily = 'Control';
    await wrapper.vm.$nextTick();

    const filtered = component.symbiants;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].family).toBe('Control');
  });

  it('applies multiple filters simultaneously', async () => {
    const component = wrapper.vm as any;

    component.searchQuery = 'Control';
    component.selectedSlots = ['Chest'];
    component.selectedQualities = [200];
    component.selectedFamily = 'Control';
    await wrapper.vm.$nextTick();

    const filtered = component.symbiants;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Control Symbiant');
  });

  it('sorts symbiants correctly', async () => {
    const component = wrapper.vm as any;
    const sorted = component.symbiants;

    // Should be sorted by slot, then QL desc, then name
    expect(sorted[0].slot).toBe('Chest');
    expect(sorted[1].slot).toBe('Head');
  });

  it('clears all filters', async () => {
    const component = wrapper.vm as any;

    // Set some filters
    component.searchQuery = 'test';
    component.selectedSlots = ['Head'];
    component.selectedQualities = [150];
    component.selectedFamily = 'Artillery';

    // Clear filters
    component.clearAllFilters();
    await wrapper.vm.$nextTick();

    expect(component.searchQuery).toBe('');
    expect(component.selectedSlots).toEqual([]);
    expect(component.selectedQualities).toEqual([]);
    expect(component.selectedFamily).toBeNull();
  });

  it('shows symbiant details dialog', async () => {
    const component = wrapper.vm as any;

    expect(component.showSymbiantDetails).toBe(false);
    expect(component.selectedSymbiant).toBeNull();

    component.showDetails(mockSymbiants[0]);
    await wrapper.vm.$nextTick();

    expect(component.showSymbiantDetails).toBe(true);
    expect(component.selectedSymbiant).toEqual(mockSymbiants[0]);
  });

  it('gets correct drop sources for symbiant', () => {
    const component = wrapper.vm as any;
    const sources = component.getDropSources(mockSymbiants[0]);

    expect(sources).toHaveLength(1);
    expect(sources[0].name).toBe('Test Boss 1');
  });

  it('calculates quality severity correctly', () => {
    const component = wrapper.vm as any;

    expect(component.getQualitySeverity(50)).toBe('success');
    expect(component.getQualitySeverity(120)).toBe('info');
    expect(component.getQualitySeverity(180)).toBe('warning');
    expect(component.getQualitySeverity(250)).toBe('danger');
  });

  it('gets correct slot icons', () => {
    const component = wrapper.vm as any;

    expect(component.getSlotIcon('Head')).toBe('pi-user');
    expect(component.getSlotIcon('Eye')).toBe('pi-eye');
    expect(component.getSlotIcon('Chest')).toBe('pi-shield');
    expect(component.getSlotIcon('Unknown')).toBe('pi-circle');
  });

  it('displays symbiant count', () => {
    expect(wrapper.text()).toContain('2 symbiants found');
  });

  it('shows empty state when no symbiants found', async () => {
    const component = wrapper.vm as any;
    component.searchQuery = 'nonexistent';
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('No symbiants found');
  });

  it('handles case insensitive search', async () => {
    const component = wrapper.vm as any;

    component.searchQuery = 'artillery';
    await wrapper.vm.$nextTick();

    const filtered = component.symbiants;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Artillery Symbiant');
  });

  it('searches across multiple fields', async () => {
    const component = wrapper.vm as any;

    // Search by slot
    component.searchQuery = 'head';
    await wrapper.vm.$nextTick();
    expect(component.symbiants).toHaveLength(1);

    // Search by family
    component.searchQuery = 'control';
    await wrapper.vm.$nextTick();
    expect(component.symbiants).toHaveLength(1);
  });
});

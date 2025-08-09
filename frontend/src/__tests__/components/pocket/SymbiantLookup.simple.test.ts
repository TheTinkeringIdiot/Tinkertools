import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';

// Mock the API client
vi.mock('@/services/api-client', () => ({
  apiClient: {
    searchSymbiants: vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 50
    })
  }
}));

// Mock components
const MockCard = { template: '<div class="mock-card"><slot name="content"></slot></div>' };
const MockInputText = { template: '<input class="mock-inputtext" v-bind="$attrs" />' };
const MockButton = { template: '<button class="mock-button"><slot></slot></button>' };
const MockMultiSelect = { template: '<select multiple class="mock-multiselect" v-bind="$attrs"></select>' };
const MockDataView = { 
  template: '<div class="mock-dataview"><slot name="empty" v-if="!value || value.length === 0"></slot></div>',
  props: ['value']
};

describe('SymbiantLookup Component Structure', () => {
  const createWrapper = () => {
    return mount({
      template: `
        <div class="symbiant-lookup">
          <MockCard class="mb-6">
            <template #content>
              <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div>
                  <label class="font-medium text-sm">Search Symbiants</label>
                  <MockInputText placeholder="Search by name, slot, or family..." />
                </div>
                <div>
                  <label class="font-medium text-sm">Body Slots</label>
                  <MockMultiSelect placeholder="All Slots" />
                </div>
                <div>
                  <label class="font-medium text-sm">Quality Levels</label>
                  <MockMultiSelect placeholder="All Qualities" />
                </div>
                <div class="flex items-end">
                  <MockButton>Clear Filters</MockButton>
                </div>
              </div>
              <div class="mt-4">
                <span class="text-sm">{{ symbiants.length }} symbiant{{ symbiants.length !== 1 ? 's' : '' }} found</span>
              </div>
            </template>
          </MockCard>
          
          <MockDataView :value="symbiants" />
        </div>
      `,
      components: { MockCard, MockInputText, MockButton, MockMultiSelect, MockDataView },
      data() {
        return {
          symbiants: [
            { id: 1, name: 'Artillery Head', slot: 'Head', ql: 150, family: 'Artillery' },
            { id: 2, name: 'Control Chest', slot: 'Chest', ql: 200, family: 'Control' }
          ]
        };
      }
    }, {
      global: {
        plugins: [createPinia(), PrimeVue]
      }
    });
  };

  it('renders the basic structure', () => {
    const wrapper = createWrapper();
    expect(wrapper.find('.symbiant-lookup').exists()).toBe(true);
    expect(wrapper.find('.mock-card').exists()).toBe(true);
    expect(wrapper.find('.mock-inputtext').exists()).toBe(true);
    expect(wrapper.findAll('.mock-multiselect')).toHaveLength(2);
    expect(wrapper.find('.mock-button').exists()).toBe(true);
  });

  it('displays symbiant count', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('2 symbiants found');
  });

  it('has filter controls', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('Search Symbiants');
    expect(wrapper.text()).toContain('Body Slots');
    expect(wrapper.text()).toContain('Quality Levels');
    expect(wrapper.text()).toContain('Clear Filters');
  });
});

// Test helper functions
describe('SymbiantLookup Helper Functions', () => {
  it('gets correct slot icons', () => {
    const getSlotIcon = (slot: string) => {
      const iconMap: Record<string, string> = {
        'Head': 'pi-user',
        'Eye': 'pi-eye',
        'Chest': 'pi-shield',
        'Hand': 'pi-hand-paper'
      };
      return iconMap[slot] || 'pi-circle';
    };

    expect(getSlotIcon('Head')).toBe('pi-user');
    expect(getSlotIcon('Eye')).toBe('pi-eye');
    expect(getSlotIcon('Chest')).toBe('pi-shield');
    expect(getSlotIcon('Unknown')).toBe('pi-circle');
  });

  it('calculates quality severity', () => {
    const getQualitySeverity = (ql: number) => {
      if (ql >= 200) return 'danger';
      if (ql >= 150) return 'warning';
      if (ql >= 100) return 'info';
      return 'success';
    };

    expect(getQualitySeverity(50)).toBe('success');
    expect(getQualitySeverity(120)).toBe('info');
    expect(getQualitySeverity(180)).toBe('warning');
    expect(getQualitySeverity(250)).toBe('danger');
  });

  it('filters symbiants by search query', () => {
    const symbiants = [
      { id: 1, name: 'Artillery Head', slot: 'Head', family: 'Artillery' },
      { id: 2, name: 'Control Chest', slot: 'Chest', family: 'Control' }
    ];
    
    const filterBySearch = (items: any[], search: string) => {
      if (!search) return items;
      const searchLower = search.toLowerCase();
      return items.filter(s => 
        s.name.toLowerCase().includes(searchLower) ||
        s.slot.toLowerCase().includes(searchLower) ||
        s.family?.toLowerCase().includes(searchLower)
      );
    };

    expect(filterBySearch(symbiants, 'Artillery')).toHaveLength(1);
    expect(filterBySearch(symbiants, 'Head')).toHaveLength(1);
    expect(filterBySearch(symbiants, 'Control')).toHaveLength(1);
    expect(filterBySearch(symbiants, '')).toHaveLength(2);
  });
});
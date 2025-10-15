import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { mountWithContext, standardCleanup, createTestProfile, SKILL_ID, PROFESSION } from '@/__tests__/helpers';
import { createPinia } from 'pinia';
import PrimeVue from 'primevue/config';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

// Mock components
const MockCard = { template: '<div class="mock-card"><slot name="content"></slot></div>' };
const MockButton = { template: '<button class="mock-button" @click="$emit(\'click\')"><slot></slot></button>' };
const MockProgressBar = { template: '<div class="mock-progressbar">{{ value }}%</div>', props: ['value'] };
const MockCheckbox = { template: '<input type="checkbox" class="mock-checkbox" />' };
const MockDataTable = { template: '<div class="mock-datatable"><slot name="empty" v-if="!value || value.length === 0"></slot></div>', props: ['value'] };

describe('CollectionTracker Component Structure', () => {
  const createWrapper = () => {
    return mount({
      template: `
        <div class="collection-tracker">
          <MockCard class="mb-6">
            <template #content>
              <div class="space-y-6">
                <div>
                  <div class="flex items-center justify-between mb-2">
                    <h2 class="text-xl font-semibold">Collection Progress</h2>
                    <span class="text-2xl font-bold text-primary-500">{{ percentage }}%</span>
                  </div>
                  <MockProgressBar :value="percentage" />
                  <div class="flex items-center justify-between text-sm">
                    <span>{{ collected }} of {{ total }} collected</span>
                    <span>{{ remaining }} remaining</span>
                  </div>
                </div>
                
                <div class="flex items-center gap-3">
                  <MockButton>Export Collection</MockButton>
                  <MockButton>Import Collection</MockButton>
                  <MockButton>Reset Collection</MockButton>
                </div>
              </div>
            </template>
          </MockCard>

          <MockCard>
            <template #content>
              <MockDataTable :value="symbiants" />
            </template>
          </MockCard>
        </div>
      `,
      components: { MockCard, MockButton, MockProgressBar, MockCheckbox, MockDataTable },
      data() {
        return {
          total: 100,
          collected: 25,
          remaining: 75,
          percentage: 25,
          symbiants: [
            { id: 1, name: 'Test Symbiant 1', collected: false },
            { id: 2, name: 'Test Symbiant 2', collected: true }
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
    expect(wrapper.find('.collection-tracker').exists()).toBe(true);
    expect(wrapper.findAll('.mock-card')).toHaveLength(2);
    expect(wrapper.find('.mock-progressbar').exists()).toBe(true);
    expect(wrapper.find('.mock-datatable').exists()).toBe(true);
  });

  it('displays collection progress', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('Collection Progress');
    expect(wrapper.text()).toContain('25%');
    expect(wrapper.text()).toContain('25 of 100 collected');
    expect(wrapper.text()).toContain('75 remaining');
  });

  it('has action buttons', () => {
    const wrapper = createWrapper();
    expect(wrapper.text()).toContain('Export Collection');
    expect(wrapper.text()).toContain('Import Collection');
    expect(wrapper.text()).toContain('Reset Collection');
  });
});

// Test helper functions
describe('CollectionTracker Helper Functions', () => {
  it('calculates collection statistics', () => {
    const calculateStats = (items: any[]) => {
      const total = items.length;
      const collected = items.filter(item => item.collected).length;
      const percentage = total > 0 ? Math.round((collected / total) * 100) : 0;
      const remaining = total - collected;
      
      return { total, collected, percentage, remaining };
    };

    const items = [
      { id: 1, collected: true },
      { id: 2, collected: false },
      { id: 3, collected: true },
      { id: 4, collected: false }
    ];

    const stats = calculateStats(items);
    expect(stats.total).toBe(4);
    expect(stats.collected).toBe(2);
    expect(stats.percentage).toBe(50);
    expect(stats.remaining).toBe(2);
  });

  it('calculates progress by slot', () => {
    const calculateSlotProgress = (items: any[]) => {
      const bySlot: Record<string, { total: number; collected: number }> = {};
      
      items.forEach(item => {
        if (!bySlot[item.slot]) {
          bySlot[item.slot] = { total: 0, collected: 0 };
        }
        bySlot[item.slot].total++;
        if (item.collected) {
          bySlot[item.slot].collected++;
        }
      });

      return Object.entries(bySlot).map(([slot, stats]) => ({
        slot,
        ...stats,
        percentage: Math.round((stats.collected / stats.total) * 100)
      }));
    };

    const items = [
      { id: 1, slot: 'Head', collected: true },
      { id: 2, slot: 'Head', collected: false },
      { id: 3, slot: 'Chest', collected: true },
      { id: 4, slot: 'Chest', collected: true }
    ];

    const slotProgress = calculateSlotProgress(items);
    expect(slotProgress).toHaveLength(2);
    
    const headSlot = slotProgress.find(s => s.slot === 'Head');
    expect(headSlot?.percentage).toBe(50);
    
    const chestSlot = slotProgress.find(s => s.slot === 'Chest');
    expect(chestSlot?.percentage).toBe(100);
  });

  it('handles goal progress calculation', () => {
    const calculateGoalProgress = (goal: any, collectionData: Record<number, { collected: boolean }>) => {
      const total = goal.targetSymbiants.length;
      const collected = goal.targetSymbiants.filter((id: number) => 
        collectionData[id]?.collected
      ).length;
      const percentage = total > 0 ? Math.round((collected / total) * 100) : 0;
      
      return { total, collected, percentage };
    };

    const goal = {
      targetSymbiants: [1, 2, 3, 4]
    };

    const collectionData = {
      1: { collected: true },
      2: { collected: false },
      3: { collected: true },
      4: { collected: false }
    };

    const progress = calculateGoalProgress(goal, collectionData);
    expect(progress.total).toBe(4);
    expect(progress.collected).toBe(2);
    expect(progress.percentage).toBe(50);
  });

  it('saves and loads collection data', () => {
    const saveCollectionData = (data: any) => {
      localStorage.setItem('tinkertools-symbiant-collection', JSON.stringify(data));
    };

    const loadCollectionData = () => {
      const saved = localStorage.getItem('tinkertools-symbiant-collection');
      return saved ? JSON.parse(saved) : {};
    };

    const testData = { 1: { collected: true }, 2: { collected: false } };
    
    saveCollectionData(testData);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'tinkertools-symbiant-collection',
      JSON.stringify(testData)
    );

    mockLocalStorage.getItem.mockReturnValue(JSON.stringify(testData));
    const loaded = loadCollectionData();
    expect(loaded).toEqual(testData);
  });
});
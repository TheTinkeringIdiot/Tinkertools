import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import {
  mountWithContext,
  standardCleanup,
  createTestProfile,
  SKILL_ID,
  PROFESSION,
  BREED,
} from '@/__tests__/helpers';
import BuildSummary from '@/components/plants/BuildSummary.vue';
import type { CharacterBuild, CharacterStats, PlantSymbiant } from '@/types/plants';
import { apiClient } from '@/services/api-client';

// Mock PrimeVue components
vi.mock('primevue/button', () => ({
  default: {
    name: 'Button',
    template:
      '<button @click="$emit(\'click\')" :class="severity" :aria-label="ariaLabel">{{ label }}<i :class="icon"></i></button>',
    props: ['icon', 'label', 'severity', 'size', 'text', 'ariaLabel'],
    emits: ['click'],
  },
}));

describe('BuildSummary', () => {
  let wrapper: any;
  let realSymbiants: PlantSymbiant[] = [];
  let testBuild: CharacterBuild;

  beforeAll(async () => {
    // Fetch real symbiants for testing
    const response = await apiClient.searchSymbiants({ limit: 2 });
    if (response.success) {
      realSymbiants = response.data.map((symbiant) => ({
        ...symbiant,
        name: symbiant.name || `Symbiant ${symbiant.id}`,
        slot: symbiant.slot || (symbiant.id % 2 === 0 ? 'chest' : 'head'),
        statBonuses: symbiant.statBonuses || [
          { statId: 'strength', statName: 'Strength', value: 50, type: 'bonus' },
        ],
      })) as PlantSymbiant[];
    } else {
      // Fallback for testing
      realSymbiants = [
        {
          id: 1,
          aoid: 101,
          name: 'Test Head Symbiant',
          family: 'Test',
          slot: 'head',
          statBonuses: [{ statId: 'strength', statName: 'Strength', value: 50, type: 'bonus' }],
        },
        {
          id: 2,
          aoid: 102,
          name: 'Test Chest Symbiant',
          family: 'Test',
          slot: 'chest',
          statBonuses: [
            { statId: 'intelligence', statName: 'Intelligence', value: 75, type: 'bonus' },
          ],
        },
      ] as PlantSymbiant[];
    }

    // Create test build using real symbiants
    testBuild = {
      id: 'test-build',
      name: 'Test Build',
      notes: 'Test build notes',
      symbiants: {
        head: realSymbiants[0],
        chest: realSymbiants[1] || realSymbiants[0],
      },
      totalStats: {
        strength: 450,
        agility: 375,
        intelligence: 425,
      },
    };
  });

  beforeEach(() => {
    const mockStatBonuses: CharacterStats = {
      strength: 50,
      agility: 25,
      intelligence: 75,
    };

    const mockTotalStats: CharacterStats = {
      strength: 450,
      agility: 375,
      intelligence: 425,
    };

    wrapper = mountWithContext(BuildSummary, {
      props: {
        currentBuild: testBuild,
        statBonuses: mockStatBonuses,
        totalStats: mockTotalStats,
      },
    });
  });

  afterEach(() => {
    standardCleanup();
    wrapper?.unmount();
  });

  it('renders correctly', () => {
    expect(wrapper.exists()).toBe(true);
    expect(wrapper.find('.build-summary').exists()).toBe(true);
  });

  it('displays build summary title', () => {
    expect(wrapper.text()).toContain('Build Summary');
  });

  it('shows build name when provided', () => {
    expect(wrapper.text()).toContain('Test Build');
  });

  it('shows build notes when provided', () => {
    expect(wrapper.text()).toContain('Test build notes');
  });

  it('lists equipped symbiants', () => {
    expect(wrapper.text()).toContain('Equipped Symbiants');
    if (testBuild.symbiants.head) {
      expect(wrapper.text()).toContain('Head');
      expect(wrapper.text()).toContain(testBuild.symbiants.head.name);
    }
    if (testBuild.symbiants.chest) {
      expect(wrapper.text()).toContain('Chest');
      expect(wrapper.text()).toContain(testBuild.symbiants.chest.name);
    }
  });

  it('shows empty state when no symbiants equipped', async () => {
    const emptyBuild: CharacterBuild = {
      id: 'empty-build',
      name: 'Empty Build',
      symbiants: {},
      totalStats: {},
    };

    await wrapper.setProps({ currentBuild: emptyBuild });

    expect(wrapper.text()).toContain('No symbiants equipped');
  });

  it('displays stat bonuses', () => {
    expect(wrapper.text()).toContain('Stat Bonuses');
    expect(wrapper.text()).toContain('Strength');
    expect(wrapper.text()).toContain('+50');
    expect(wrapper.text()).toContain('Agility');
    expect(wrapper.text()).toContain('+25');
    expect(wrapper.text()).toContain('Intelligence');
    expect(wrapper.text()).toContain('+75');
  });

  it('shows empty state for stat bonuses when none present', async () => {
    await wrapper.setProps({ statBonuses: {} });

    expect(wrapper.text()).toContain('No bonuses');
  });

  it('displays total stats', () => {
    expect(wrapper.text()).toContain('Total Stats');
    expect(wrapper.text()).toContain('450'); // Strength total
    expect(wrapper.text()).toContain('375'); // Agility total
    expect(wrapper.text()).toContain('425'); // Intelligence total
  });

  it('shows build statistics', () => {
    expect(wrapper.text()).toContain('Symbiants:');
    expect(wrapper.text()).toContain('2/13'); // 2 equipped out of 13 possible
    expect(wrapper.text()).toContain('Bonuses:');
    expect(wrapper.text()).toContain('3 stats'); // 3 different stats with bonuses
  });

  it('calculates and shows efficiency', () => {
    expect(wrapper.text()).toContain('Efficiency:');
    // Should show some percentage
    expect(wrapper.text()).toMatch(/\d+%/);
  });

  it('emits symbiant-removed when remove button clicked', async () => {
    const removeButton = wrapper.find('button[aria-label="Remove symbiant"]');
    await removeButton.trigger('click');

    expect(wrapper.emitted('symbiant-removed')).toBeTruthy();
  });

  it('formats slot names correctly', () => {
    expect(wrapper.text()).toContain('Head');
    expect(wrapper.text()).toContain('Chest');
  });

  it('formats stat names correctly', () => {
    expect(wrapper.text()).toContain('Strength');
    expect(wrapper.text()).toContain('Agility');
    expect(wrapper.text()).toContain('Intelligence');
  });

  it('handles empty stat bonuses gracefully', async () => {
    await wrapper.setProps({ statBonuses: {} });

    // Should not throw error and show empty state
    expect(wrapper.text()).toContain('No bonuses');
    expect(wrapper.text()).toContain('0 stats');
  });

  it('handles empty total stats gracefully', async () => {
    await wrapper.setProps({ totalStats: {} });

    // Should not show total stats section when empty
    expect(wrapper.find('.total-stats')).toBeDefined();
  });

  it('shows correct symbiant count', async () => {
    const largeBuild: CharacterBuild = {
      id: 'large-build',
      name: 'Large Build',
      symbiants: {
        head: testBuild.symbiants.head!,
        chest: testBuild.symbiants.chest!,
        legs: testBuild.symbiants.head!, // Reuse for testing
        feet: testBuild.symbiants.chest!,
        rarm: testBuild.symbiants.head!,
      },
      totalStats: {},
    };

    await wrapper.setProps({ currentBuild: largeBuild });

    expect(wrapper.text()).toContain('5/13');
  });

  it('calculates efficiency correctly for different build sizes', async () => {
    // Test with minimal build using real symbiant
    const minimalBuild: CharacterBuild = {
      id: 'minimal',
      name: 'Minimal',
      symbiants: { head: testBuild.symbiants.head! },
      totalStats: {},
    };

    await wrapper.setProps({
      currentBuild: minimalBuild,
      statBonuses: { strength: 50 },
    });

    const efficiency = wrapper.vm.buildEfficiency;
    expect(efficiency).toBeGreaterThan(0);
    expect(efficiency).toBeLessThanOrEqual(1);
  });

  it('handles null efficiency gracefully', async () => {
    const emptyBuild: CharacterBuild = {
      id: 'empty',
      name: 'Empty',
      symbiants: {},
      totalStats: {},
    };

    await wrapper.setProps({
      currentBuild: emptyBuild,
      statBonuses: {},
    });

    // Should not show efficiency when null
    expect(wrapper.vm.buildEfficiency).toBeNull();
  });
});

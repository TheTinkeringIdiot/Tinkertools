/**
 * Unit tests for CriteriaDisplay component
 *
 * Tests the component for displaying criteria with different view modes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import CriteriaDisplay from '../CriteriaDisplay.vue';
import type { Criterion } from '../../types/api';
import type { CharacterStats } from '../../composables/useActionCriteria';

// Mock the useCriteriaDisplay composable
vi.mock('../../composables/useActionCriteria', () => ({
  useCriteriaDisplay: vi.fn(),
  isRequirementMet: vi.fn(),
}));

// Mock PrimeVue components
vi.mock('primevue/tag', () => ({
  default: {
    name: 'Tag',
    props: ['value', 'severity', 'class'],
    template: '<span class="p-tag" :class="`p-tag-${severity} ${$attrs.class}`">{{ value }}</span>',
  },
}));

// Mock CriterionChip component
vi.mock('../CriterionChip.vue', () => ({
  default: {
    name: 'CriterionChip',
    props: ['criterion', 'characterStats'],
    template: '<div class="criterion-chip">{{ criterion.description }}</div>',
  },
}));

import { useCriteriaDisplay, isRequirementMet } from '../../composables/useActionCriteria';

describe('CriteriaDisplay', () => {
  const mockCriteria: Criterion[] = [
    { id: 1, value1: 112, value2: 356, operator: 2 }, // Pistol > 356
    { id: 2, value1: 54, value2: 150, operator: 2 }, // Level > 150
    { id: 3, value1: 0, value2: 0, operator: 4 }, // AND
  ];

  const mockDisplayCriteria = [
    {
      id: 1,
      stat: 112,
      statName: 'Pistol',
      displayValue: 357,
      displaySymbol: '≥',
      displayOperator: 'Greater than or equal to',
      description: 'Pistol ≥ 357',
      isLogicalOperator: false,
      isSeparator: false,
      isStatRequirement: true,
    },
    {
      id: 2,
      stat: 54,
      statName: 'Level',
      displayValue: 151,
      displaySymbol: '≥',
      displayOperator: 'Greater than or equal to',
      description: 'Level ≥ 151',
      isLogicalOperator: false,
      isSeparator: false,
      isStatRequirement: true,
    },
    {
      id: 3,
      stat: 0,
      statName: 'Logical',
      displayValue: 0,
      displaySymbol: 'AND',
      displayOperator: 'AND',
      description: 'AND',
      isLogicalOperator: true,
      isSeparator: true,
      isStatRequirement: false,
    },
  ];

  const mockUseCriteriaDisplay = {
    displayCriteria: ref(mockDisplayCriteria),
    statRequirements: ref(mockDisplayCriteria.slice(0, 2)),
    logicalOperators: ref(mockDisplayCriteria.slice(2)),
    expression: ref({
      type: 'logical',
      operator: 'AND',
      operands: [],
      description: '(Pistol ≥ 357 AND Level ≥ 151)',
    }),
    formattedText: ref('(Pistol ≥ 357 AND Level ≥ 151)'),
    requirements: ref([
      { stat: 112, statName: 'Pistol', minValue: 357 },
      { stat: 54, statName: 'Level', minValue: 151 },
    ]),
    simplifiedText: ref('2 requirements'),
    groupedRequirements: ref([
      { stat: 112, statName: 'Pistol', criteria: [mockDisplayCriteria[0]] },
      { stat: 54, statName: 'Level', criteria: [mockDisplayCriteria[1]] },
    ]),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCriteriaDisplay).mockReturnValue(mockUseCriteriaDisplay);
    vi.mocked(isRequirementMet).mockReturnValue(true);
  });

  describe('component rendering', () => {
    it('should render without errors', () => {
      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
        },
      });

      expect(wrapper.exists()).toBe(true);
    });

    it('should render simple mode by default', () => {
      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
        },
      });

      expect(wrapper.text()).toContain('2 requirements');
    });

    it('should render compact mode', () => {
      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
          mode: 'compact',
        },
      });

      // In compact mode, should show criterion chips
      const chips = wrapper.findAllComponents({ name: 'CriterionChip' });
      expect(chips.length).toBe(2); // Only stat requirements
    });

    it('should render expanded mode', () => {
      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
          mode: 'expanded',
        },
      });

      // In expanded mode, should show full formatted text
      expect(wrapper.text()).toContain('(Pistol ≥ 357 AND Level ≥ 151)');
    });

    it('should render full mode with all details', () => {
      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
          mode: 'full',
        },
      });

      // In full mode, should show grouped requirements
      expect(wrapper.text()).toContain('Pistol');
      expect(wrapper.text()).toContain('Level');

      const chips = wrapper.findAllComponents({ name: 'CriterionChip' });
      expect(chips.length).toBe(2);
    });
  });

  describe('character stats integration', () => {
    const characterStats: CharacterStats = {
      112: 400, // Pistol
      54: 100, // Level (too low)
    };

    it('should pass character stats to criterion chips', () => {
      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
          characterStats,
          mode: 'compact',
        },
      });

      const chips = wrapper.findAllComponents({ name: 'CriterionChip' });
      chips.forEach((chip) => {
        expect(chip.props('characterStats')).toEqual(characterStats);
      });
    });

    it('should show requirement met indicator', () => {
      vi.mocked(isRequirementMet).mockReturnValue(true);

      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
          characterStats,
          mode: 'simple',
        },
      });

      expect(wrapper.text()).toContain('✓');
    });

    it('should show requirement not met indicator', () => {
      vi.mocked(isRequirementMet).mockReturnValue(false);

      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
          characterStats,
          mode: 'simple',
        },
      });

      expect(wrapper.text()).toContain('✗');
    });

    it('should show unknown status when no character stats', () => {
      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
          mode: 'simple',
        },
      });

      expect(wrapper.text()).toContain('?');
    });

    it('should calculate overall requirement status', () => {
      vi.mocked(isRequirementMet)
        .mockReturnValueOnce(true) // Pistol requirement met
        .mockReturnValueOnce(false); // Level requirement not met

      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
          characterStats,
          mode: 'simple',
        },
      });

      // Overall status should be false (not all requirements met)
      expect(wrapper.text()).toContain('✗');
    });
  });

  describe('empty states', () => {
    it('should handle empty criteria array', () => {
      mockUseCriteriaDisplay.displayCriteria.value = [];
      mockUseCriteriaDisplay.statRequirements.value = [];
      mockUseCriteriaDisplay.simplifiedText.value = 'No requirements';

      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: [],
        },
      });

      expect(wrapper.text()).toContain('No requirements');
    });

    it('should handle criteria with only logical operators', () => {
      mockUseCriteriaDisplay.statRequirements.value = [];
      mockUseCriteriaDisplay.simplifiedText.value = 'No requirements';

      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: [{ id: 1, value1: 0, value2: 0, operator: 4 }],
        },
      });

      expect(wrapper.text()).toContain('No requirements');
    });
  });

  describe('mode-specific behavior', () => {
    it('should show different content in simple mode', () => {
      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
          mode: 'simple',
        },
      });

      // Simple mode shows count or single requirement
      expect(wrapper.text()).toContain('2 requirements');
    });

    it('should show individual chips in compact mode', () => {
      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
          mode: 'compact',
        },
      });

      const chips = wrapper.findAllComponents({ name: 'CriterionChip' });
      expect(chips).toHaveLength(2);
      expect(chips[0].props('criterion')).toEqual(mockDisplayCriteria[0]);
      expect(chips[1].props('criterion')).toEqual(mockDisplayCriteria[1]);
    });

    it('should show formatted expression in expanded mode', () => {
      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
          mode: 'expanded',
        },
      });

      expect(wrapper.text()).toContain('(Pistol ≥ 357 AND Level ≥ 151)');
    });

    it('should group requirements by stat in full mode', () => {
      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
          mode: 'full',
        },
      });

      // Should show stat names as headers
      expect(wrapper.text()).toContain('Pistol');
      expect(wrapper.text()).toContain('Level');
    });
  });

  describe('single requirement handling', () => {
    const singleCriterion: Criterion[] = [{ id: 1, value1: 112, value2: 356, operator: 2 }];

    beforeEach(() => {
      mockUseCriteriaDisplay.statRequirements.value = [mockDisplayCriteria[0]];
      mockUseCriteriaDisplay.simplifiedText.value = 'Pistol ≥ 357';
    });

    it('should show single requirement directly in simple mode', () => {
      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: singleCriterion,
          mode: 'simple',
        },
      });

      expect(wrapper.text()).toContain('Pistol ≥ 357');
    });

    it('should show single chip in compact mode', () => {
      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: singleCriterion,
          mode: 'compact',
        },
      });

      const chips = wrapper.findAllComponents({ name: 'CriterionChip' });
      expect(chips).toHaveLength(1);
    });
  });

  describe('complex criteria', () => {
    const complexCriteria: Criterion[] = [
      { id: 1, value1: 112, value2: 300, operator: 2 }, // Pistol > 300
      { id: 2, value1: 112, value2: 500, operator: 1 }, // Pistol < 500
      { id: 3, value1: 0, value2: 0, operator: 4 }, // AND
      { id: 4, value1: 54, value2: 150, operator: 2 }, // Level > 150
      { id: 5, value1: 0, value2: 0, operator: 4 }, // AND
    ];

    it('should handle multiple requirements for same stat', () => {
      // Mock grouped requirements with multiple criteria for same stat
      mockUseCriteriaDisplay.groupedRequirements.value = [
        {
          stat: 112,
          statName: 'Pistol',
          criteria: [
            mockDisplayCriteria[0],
            {
              ...mockDisplayCriteria[0],
              id: 2,
              displayValue: 499,
              displaySymbol: '≤',
              description: 'Pistol ≤ 499',
            },
          ],
        },
        { stat: 54, statName: 'Level', criteria: [mockDisplayCriteria[1]] },
      ];

      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: complexCriteria,
          mode: 'full',
        },
      });

      expect(wrapper.text()).toContain('Pistol');

      // Should show multiple chips for the same stat
      const chips = wrapper.findAllComponents({ name: 'CriterionChip' });
      expect(chips.length).toBeGreaterThan(2);
    });

    it('should handle nested logical expressions', () => {
      mockUseCriteriaDisplay.formattedText.value =
        '((Pistol ≥ 301 AND Pistol ≤ 499) AND Level ≥ 151)';

      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: complexCriteria,
          mode: 'expanded',
        },
      });

      expect(wrapper.text()).toContain('((Pistol ≥ 301 AND Pistol ≤ 499) AND Level ≥ 151)');
    });
  });

  describe('requirement status calculation', () => {
    it('should handle mixed requirement results', () => {
      const characterStats: CharacterStats = { 112: 400, 54: 100 };

      vi.mocked(isRequirementMet)
        .mockReturnValueOnce(true) // First requirement met
        .mockReturnValueOnce(false); // Second requirement not met

      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
          characterStats,
          mode: 'simple',
        },
      });

      // Should show overall status as not met
      expect(wrapper.text()).toContain('✗');
    });

    it('should handle null requirement results', () => {
      vi.mocked(isRequirementMet).mockReturnValue(null);

      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
          characterStats: { 112: 400 },
          mode: 'simple',
        },
      });

      // Should show unknown status
      expect(wrapper.text()).toContain('?');
    });

    it('should handle requirements when all are met', () => {
      vi.mocked(isRequirementMet).mockReturnValue(true);

      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
          characterStats: { 112: 400, 54: 200 },
          mode: 'simple',
        },
      });

      expect(wrapper.text()).toContain('✓');
    });
  });

  describe('edge cases', () => {
    it('should handle malformed criteria gracefully', () => {
      const malformedCriteria: Criterion[] = [{ id: 1, value1: 999, value2: 999, operator: 999 }];

      mockUseCriteriaDisplay.displayCriteria.value = [
        {
          id: 1,
          stat: 999,
          statName: 'Stat 999',
          displayValue: 999,
          displaySymbol: 'Op999',
          displayOperator: 'Op999',
          description: 'Stat 999 Op999 999',
          isLogicalOperator: false,
          isSeparator: false,
          isStatRequirement: true,
        },
      ];
      mockUseCriteriaDisplay.statRequirements.value = mockUseCriteriaDisplay.displayCriteria.value;

      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: malformedCriteria,
        },
      });

      expect(wrapper.exists()).toBe(true);
      expect(wrapper.text()).toContain('Stat 999');
    });

    it('should handle undefined mode gracefully', () => {
      const wrapper = mount(CriteriaDisplay, {
        props: {
          criteria: mockCriteria,
          mode: undefined,
        },
      });

      // Should default to simple mode
      expect(wrapper.exists()).toBe(true);
      expect(wrapper.text()).toContain('2 requirements');
    });
  });
});

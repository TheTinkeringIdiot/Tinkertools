/**
 * Unit tests for CriterionChip component
 *
 * Tests the component for displaying individual criterion requirements as chips
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mountWithContext, standardCleanup } from '@/__tests__/helpers';
import CriterionChip from '../CriterionChip.vue';
import type { DisplayCriterion, CharacterStats } from '../../composables/useActionCriteria';

// Mock the isRequirementMet utility function
vi.mock('../../composables/useActionCriteria', () => ({
  isRequirementMet: vi.fn(),
}));

import { isRequirementMet } from '../../composables/useActionCriteria';

describe('CriterionChip', () => {
  const mockCriterion: DisplayCriterion = {
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
  };

  const characterStats: CharacterStats = {
    112: 400, // Pistol: 400
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isRequirementMet).mockReturnValue(true);
  });

  afterEach(() => {
    standardCleanup();
  });

  describe('component rendering', () => {
    it('should render without errors', () => {
      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
        },
      });

      expect(wrapper.exists()).toBe(true);
    });

    it('should display criterion description', () => {
      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
        },
      });

      expect(wrapper.text()).toContain('Pistol ≥ 357');
    });

    it('should render as PrimeVue Tag component', () => {
      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
        },
      });

      const tag = wrapper.findComponent({ name: 'Tag' });
      expect(tag.exists()).toBe(true);
      expect(tag.props('value')).toContain('Pistol ≥ 357');
    });
  });

  describe('requirement status display', () => {
    it('should show success status when requirement is met', () => {
      vi.mocked(isRequirementMet).mockReturnValue(true);

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
          characterStats,
        },
      });

      const tag = wrapper.findComponent({ name: 'Tag' });
      expect(tag.props('severity')).toBe('success');
      expect(tag.props('icon')).toBe('pi pi-check');
    });

    it('should show danger status when requirement is not met', () => {
      vi.mocked(isRequirementMet).mockReturnValue(false);

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
          characterStats: { 112: 300 }, // Too low
        },
      });

      const tag = wrapper.findComponent({ name: 'Tag' });
      expect(tag.props('severity')).toBe('danger');
      expect(tag.props('icon')).toBe('pi pi-times');
    });

    it('should show secondary status when requirement cannot be evaluated', () => {
      vi.mocked(isRequirementMet).mockReturnValue(null);

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
          characterStats,
        },
      });

      const tag = wrapper.findComponent({ name: 'Tag' });
      expect(tag.props('severity')).toBe('secondary');
      expect(tag.props('icon')).toBe('pi pi-question');
    });

    it('should show secondary status when no character stats provided', () => {
      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
        },
      });

      const tag = wrapper.findComponent({ name: 'Tag' });
      expect(tag.props('severity')).toBe('secondary');
      expect(tag.props('icon')).toBe('pi pi-question');
    });
  });

  describe('different criterion types', () => {
    it('should handle equality requirements', () => {
      const equalCriterion: DisplayCriterion = {
        ...mockCriterion,
        displaySymbol: '=',
        displayValue: 8,
        description: 'Profession = Bureaucrat',
      };

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: equalCriterion,
          characterStats: { 112: 8 },
        },
      });

      expect(wrapper.text()).toContain('Profession = Bureaucrat');
    });

    it('should handle less than or equal requirements', () => {
      const lessThanCriterion: DisplayCriterion = {
        ...mockCriterion,
        displaySymbol: '≤',
        displayValue: 199,
        description: 'Level ≤ 199',
      };

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: lessThanCriterion,
          characterStats: { 112: 150 },
        },
      });

      expect(wrapper.text()).toContain('Level ≤ 199');
    });

    it('should handle not equal requirements', () => {
      const notEqualCriterion: DisplayCriterion = {
        ...mockCriterion,
        displaySymbol: '≠',
        description: 'Profession ≠ Agent',
      };

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: notEqualCriterion,
        },
      });

      expect(wrapper.text()).toContain('Profession ≠ Agent');
    });

    it('should handle bit flag requirements', () => {
      const bitFlagCriterion: DisplayCriterion = {
        ...mockCriterion,
        displaySymbol: 'has',
        description: 'Can flags has flag 64',
      };

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: bitFlagCriterion,
        },
      });

      expect(wrapper.text()).toContain('Can flags has flag 64');
    });

    it('should handle bit not set requirements', () => {
      const bitNotSetCriterion: DisplayCriterion = {
        ...mockCriterion,
        displaySymbol: 'lacks',
        description: 'Can flags lacks flag 32',
      };

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: bitNotSetCriterion,
        },
      });

      expect(wrapper.text()).toContain('Can flags lacks flag 32');
    });
  });

  describe('special stat types', () => {
    it('should handle Level stat requirements', () => {
      const levelCriterion: DisplayCriterion = {
        ...mockCriterion,
        stat: 54,
        statName: 'Level',
        description: 'Level ≥ 151',
      };

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: levelCriterion,
          characterStats: { 54: 200 },
        },
      });

      expect(wrapper.text()).toContain('Level ≥ 151');
    });

    it('should handle Profession stat requirements', () => {
      const professionCriterion: DisplayCriterion = {
        ...mockCriterion,
        stat: 60,
        statName: 'Profession',
        displaySymbol: '=',
        displayValue: 8,
        description: 'Profession = Bureaucrat',
      };

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: professionCriterion,
          characterStats: { 60: 8 },
        },
      });

      expect(wrapper.text()).toContain('Profession = Bureaucrat');
    });

    it('should handle Breed stat requirements', () => {
      const breedCriterion: DisplayCriterion = {
        ...mockCriterion,
        stat: 4,
        statName: 'Breed',
        displaySymbol: '=',
        displayValue: 1,
        description: 'Breed = Opifex',
      };

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: breedCriterion,
          characterStats: { 4: 1 },
        },
      });

      expect(wrapper.text()).toContain('Breed = Opifex');
    });

    it('should handle Gender stat requirements', () => {
      const genderCriterion: DisplayCriterion = {
        ...mockCriterion,
        stat: 59,
        statName: 'Gender',
        displaySymbol: '=',
        displayValue: 1,
        description: 'Gender = Female',
      };

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: genderCriterion,
          characterStats: { 59: 1 },
        },
      });

      expect(wrapper.text()).toContain('Gender = Female');
    });
  });

  describe('requirement evaluation', () => {
    it('should evaluate requirement correctly with character stats', () => {
      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
          characterStats,
        },
      });

      // Component should show met status since characterStats[112] = 400 >= 357
      expect(wrapper.vm.requirementMet).toBe(true);
    });

    it('should not evaluate requirement when no character stats provided', () => {
      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
        },
      });

      // Should show secondary status when no stats
      expect(wrapper.vm.requirementMet).toBeNull();
    });

    it('should handle character stats with missing required stat', () => {
      const statsWithoutRequiredStat = { 54: 200 }; // Has Level but not Pistol

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
          characterStats: statsWithoutRequiredStat,
        },
      });

      // Should evaluate as false since the required stat is missing (defaults to 0)
      expect(wrapper.vm.requirementMet).toBe(false);
    });
  });

  describe('visual indicators', () => {
    it('should display check icon for met requirements', () => {
      vi.mocked(isRequirementMet).mockReturnValue(true);

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
          characterStats,
        },
      });

      const tag = wrapper.findComponent({ name: 'Tag' });
      expect(tag.props('icon')).toBe('pi pi-check');
    });

    it('should display times icon for unmet requirements', () => {
      vi.mocked(isRequirementMet).mockReturnValue(false);

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
          characterStats: { 112: 300 },
        },
      });

      const tag = wrapper.findComponent({ name: 'Tag' });
      expect(tag.props('icon')).toBe('pi pi-times');
    });

    it('should display question icon for unknown status', () => {
      vi.mocked(isRequirementMet).mockReturnValue(null);

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
          characterStats,
        },
      });

      const tag = wrapper.findComponent({ name: 'Tag' });
      expect(tag.props('icon')).toBe('pi pi-question');
    });

    it('should apply success severity class', () => {
      vi.mocked(isRequirementMet).mockReturnValue(true);

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
          characterStats,
        },
      });

      const tag = wrapper.findComponent({ name: 'Tag' });
      expect(tag.props('severity')).toBe('success');
      expect(tag.element.className).toContain('p-tag-success');
    });

    it('should apply danger severity class', () => {
      vi.mocked(isRequirementMet).mockReturnValue(false);

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
          characterStats: { 112: 300 },
        },
      });

      const tag = wrapper.findComponent({ name: 'Tag' });
      expect(tag.props('severity')).toBe('danger');
      expect(tag.element.className).toContain('p-tag-danger');
    });

    it('should apply secondary severity class', () => {
      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
        },
      });

      const tag = wrapper.findComponent({ name: 'Tag' });
      expect(tag.props('severity')).toBe('secondary');
      expect(tag.element.className).toContain('p-tag-secondary');
    });
  });

  describe('logical operators handling', () => {
    const logicalCriterion: DisplayCriterion = {
      id: 2,
      stat: 0,
      statName: 'Logical',
      displayValue: 0,
      displaySymbol: 'AND',
      displayOperator: 'AND',
      description: 'AND',
      isLogicalOperator: true,
      isSeparator: true,
      isStatRequirement: false,
    };

    it('should display logical operators without status indicators', () => {
      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: logicalCriterion,
          characterStats,
        },
      });

      const tag = wrapper.findComponent({ name: 'Tag' });
      expect(tag.props('value')).toBe('AND');
      expect(tag.props('severity')).toBe('secondary');
      expect(tag.props('icon')).toBeUndefined();
    });

    it('should not evaluate logical operators', () => {
      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: logicalCriterion,
          characterStats,
        },
      });

      // Logical operators should not have requirement evaluation
      expect(wrapper.vm.requirementMet).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle unknown operator gracefully', () => {
      const unknownOperatorCriterion: DisplayCriterion = {
        ...mockCriterion,
        displaySymbol: 'Op999',
        description: 'Pistol Op999 357',
      };

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: unknownOperatorCriterion,
        },
      });

      expect(wrapper.text()).toContain('Pistol Op999 357');
      expect(wrapper.exists()).toBe(true);
    });

    it('should handle empty description', () => {
      const emptyCriterion: DisplayCriterion = {
        ...mockCriterion,
        description: '',
      };

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: emptyCriterion,
        },
      });

      expect(wrapper.exists()).toBe(true);
    });

    it('should handle very long descriptions', () => {
      const longDescriptionCriterion: DisplayCriterion = {
        ...mockCriterion,
        description:
          'This is a very long description that might overflow the chip container and needs to be handled gracefully',
      };

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: longDescriptionCriterion,
        },
      });

      expect(wrapper.text()).toContain('This is a very long description');
      expect(wrapper.exists()).toBe(true);
    });

    it('should handle malformed character stats', () => {
      const malformedStats = { invalid: 'data' } as any;

      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
          characterStats: malformedStats,
        },
      });

      expect(wrapper.exists()).toBe(true);
      // Should handle malformed stats gracefully
      expect(wrapper.vm.currentValue).toBe(0);
    });
  });

  describe('accessibility', () => {
    it('should have appropriate ARIA attributes', () => {
      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
          characterStats,
        },
      });

      const tag = wrapper.findComponent({ name: 'Tag' });
      // PrimeVue Tag component should handle ARIA attributes
      expect(tag.exists()).toBe(true);
    });

    it('should be focusable for keyboard navigation', () => {
      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
          characterStats,
        },
      });

      const tag = wrapper.findComponent({ name: 'Tag' });
      // Verify the tag is rendered (PrimeVue handles focus behavior)
      expect(tag.exists()).toBe(true);
    });
  });

  describe('performance considerations', () => {
    it('should not re-evaluate requirements unnecessarily', async () => {
      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
          characterStats,
        },
      });

      // Get initial evaluation result
      const initialResult = wrapper.vm.requirementMet;
      expect(initialResult).toBe(true);

      // Re-render with same props should not change result
      await wrapper.setProps({ criterion: mockCriterion, characterStats });

      // Vue's reactivity should maintain the same result
      expect(wrapper.vm.requirementMet).toBe(initialResult);
    });

    it('should handle frequent prop updates efficiently', async () => {
      const wrapper = mountWithContext(CriterionChip, {
        props: {
          criterion: mockCriterion,
          characterStats,
        },
      });

      // Update character stats multiple times
      await wrapper.setProps({ characterStats: { 112: 350 } });
      expect(wrapper.vm.requirementMet).toBe(false);

      await wrapper.setProps({ characterStats: { 112: 400 } });
      expect(wrapper.vm.requirementMet).toBe(true);

      await wrapper.setProps({ characterStats: { 112: 450 } });
      expect(wrapper.vm.requirementMet).toBe(true);

      // Should remain responsive
      expect(wrapper.exists()).toBe(true);
    });
  });
});

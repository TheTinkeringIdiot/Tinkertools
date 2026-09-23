/**
 * CriterionChip Component Tests
 *
 * Renders the real chip for each kind of criterion and checks what the user
 * sees: the requirement text, readable names for enum and flag values, the
 * character's current value, met/unmet colouring, OE breakpoints, and links to
 * the nanos referenced by function operators. Only the API client is mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createTestRouter, standardCleanup } from '@/__tests__/helpers';
import { TEST_VERSION } from '@/__tests__/helpers/version-fixtures';
import CriterionChip from '../CriterionChip.vue';
import type { DisplayCriterion } from '../../services/action-criteria';
import type { CharacterStats } from '../../composables/useActionCriteria';
import { clearNanoNameCache } from '../../composables/useNanoNameResolver';

vi.mock('@/services/api-client', () => {
  const client = { getItem: vi.fn() };
  return { default: client, apiClient: client };
});

import apiClient from '@/services/api-client';

const mockGetItem = vi.mocked(apiClient.getItem);

function statCriterion(overrides: Partial<DisplayCriterion> = {}): DisplayCriterion {
  return {
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
    ...overrides,
  };
}

function mountChip(props: {
  criterion: DisplayCriterion;
  characterStats?: CharacterStats | null;
  showStatus?: boolean;
  showOeBreakpoints?: boolean;
  size?: 'small' | 'normal' | 'large';
}) {
  return mount(CriterionChip, { props, global: { plugins: [router] } });
}

/** Rendered text with whitespace runs collapsed, as the browser displays it. */
function visibleText(wrapper: ReturnType<typeof mountChip>): string {
  return wrapper.text().replace(/\s+/g, ' ');
}

let router: ReturnType<typeof createTestRouter>;

describe('CriterionChip', () => {
  beforeEach(async () => {
    clearNanoNameCache();
    // Function-operator chips link to named routes, which inherit `version`.
    router = createTestRouter();
    await router.push(`/${TEST_VERSION}/`);
  });

  afterEach(() => {
    standardCleanup();
  });

  describe('stat requirements', () => {
    it('shows stat name, operator and required value', () => {
      const wrapper = mountChip({ criterion: statCriterion() });

      expect(wrapper.text()).toBe('Pistol ≥ 357');
    });

    it("shows the character's current value next to the requirement", () => {
      const wrapper = mountChip({ criterion: statCriterion(), characterStats: { 112: 400 } });

      expect(wrapper.text()).toContain('Pistol ≥ 357');
      expect(wrapper.find('.status').text()).toBe('(400)');
    });

    it('shows 0 as the current value when the character lacks the stat', () => {
      const wrapper = mountChip({ criterion: statCriterion(), characterStats: { 17: 50 } });

      expect(wrapper.find('.status').text()).toBe('(0)');
      expect(wrapper.classes()).toContain('requirement-unmet');
    });

    it('hides the current value when showStatus is false', () => {
      const wrapper = mountChip({
        criterion: statCriterion(),
        characterStats: { 112: 400 },
        showStatus: false,
      });

      expect(wrapper.find('.status').exists()).toBe(false);
    });

    it('is neutral when no character is selected', () => {
      const wrapper = mountChip({ criterion: statCriterion() });

      expect(wrapper.classes()).toContain('requirement-neutral');
      expect(wrapper.find('.status').exists()).toBe(false);
    });
  });

  describe('met / unmet evaluation', () => {
    it.each([
      ['≥', 357, 400, true],
      ['≥', 357, 357, true],
      ['≥', 357, 356, false],
      ['≤', 199, 150, true],
      ['≤', 199, 200, false],
      ['=', 8, 8, true],
      ['=', 8, 5, false],
      ['≠', 5, 8, true],
      ['≠', 5, 5, false],
    ])('%s %i with current %i is met: %s', (symbol, required, current, met) => {
      const wrapper = mountChip({
        criterion: statCriterion({ displaySymbol: symbol, displayValue: required }),
        characterStats: { 112: current },
      });

      expect(wrapper.classes()).toContain(met ? 'requirement-met' : 'requirement-unmet');
      expect(wrapper.find('.status').classes()).toContain(met ? 'status-met' : 'status-unmet');
    });

    it('evaluates "has" flag requirements bitwise', () => {
      const criterion = statCriterion({ stat: 30, displaySymbol: 'has', displayValue: 4 });

      expect(mountChip({ criterion, characterStats: { 30: 4 | 1 } }).classes()).toContain(
        'requirement-met'
      );
      expect(mountChip({ criterion, characterStats: { 30: 1 } }).classes()).toContain(
        'requirement-unmet'
      );
    });

    it('evaluates "lacks" flag requirements bitwise', () => {
      const criterion = statCriterion({ stat: 30, displaySymbol: 'lacks', displayValue: 32 });

      expect(mountChip({ criterion, characterStats: { 30: 4 } }).classes()).toContain(
        'requirement-met'
      );
      expect(mountChip({ criterion, characterStats: { 30: 32 | 4 } }).classes()).toContain(
        'requirement-unmet'
      );
    });

    it('marks requirements with an unrecognised operator as unknown', () => {
      const wrapper = mountChip({
        criterion: statCriterion({ displaySymbol: 'Op999' }),
        characterStats: { 112: 400 },
      });

      expect(wrapper.classes()).toContain('requirement-unknown');
      expect(wrapper.text()).toContain('Pistol Op999 357');
    });

    it('re-evaluates when the character stats change', async () => {
      const wrapper = mountChip({ criterion: statCriterion(), characterStats: { 112: 100 } });
      expect(wrapper.classes()).toContain('requirement-unmet');

      await wrapper.setProps({ characterStats: { 112: 500 } });

      expect(wrapper.classes()).toContain('requirement-met');
      expect(wrapper.find('.status').text()).toBe('(500)');
    });
  });

  describe('value formatting', () => {
    it.each([
      [60, 'Profession', 8, 'Profession = Bureaucrat'],
      [368, 'VisualProfession', 5, 'VisualProfession = Agent'],
      [4, 'Breed', 2, 'Breed = Opifex'],
      [59, 'Gender', 3, 'Gender = Female'],
      [54, 'Level', 151, 'Level = 151'],
    ])('stat %i (%s) = %i reads "%s"', (stat, statName, value, expected) => {
      const wrapper = mountChip({
        criterion: statCriterion({ stat, statName, displaySymbol: '=', displayValue: value }),
      });

      expect(wrapper.text()).toBe(expected);
    });

    it('names Can flags in flag requirements', () => {
      const wrapper = mountChip({
        criterion: statCriterion({
          stat: 30,
          statName: 'Can',
          displaySymbol: 'has',
          displayValue: 64,
        }),
      });

      expect(wrapper.text()).toBe('Can has TutorChip');
    });

    it('falls back to the bit value for flags it cannot name', () => {
      const wrapper = mountChip({
        criterion: statCriterion({ displaySymbol: 'lacks', displayValue: 32 }),
      });

      expect(wrapper.text()).toBe('Pistol lacks Flag 32');
    });
  });

  describe('OE breakpoints', () => {
    it('shows 80/60/40/20% breakpoints for skills when enabled', () => {
      const wrapper = mountChip({ criterion: statCriterion(), showOeBreakpoints: true });

      expect(wrapper.find('.oe-breakpoints').text()).toBe('OE: 285/214/142/71');
    });

    it('does not show breakpoints unless enabled', () => {
      const wrapper = mountChip({ criterion: statCriterion() });

      expect(wrapper.find('.oe-breakpoints').exists()).toBe(false);
    });

    it('does not show breakpoints for Treatment, which has no OE', () => {
      const wrapper = mountChip({
        criterion: statCriterion({ stat: 124, statName: 'Treatment' }),
        showOeBreakpoints: true,
      });

      expect(wrapper.find('.oe-breakpoints').exists()).toBe(false);
    });

    it('does not show breakpoints for non-skill stats such as Level', () => {
      const wrapper = mountChip({
        criterion: statCriterion({ stat: 54, statName: 'Level' }),
        showOeBreakpoints: true,
      });

      expect(wrapper.find('.oe-breakpoints').exists()).toBe(false);
    });
  });

  describe('non-stat criteria', () => {
    it('shows logical operators without any character status', () => {
      const wrapper = mountChip({
        criterion: statCriterion({
          stat: 0,
          statName: '',
          displayValue: 0,
          displaySymbol: 'AND',
          displayOperator: 'AND',
          description: 'AND',
          isLogicalOperator: true,
          isStatRequirement: false,
        }),
        characterStats: { 112: 400 },
      });

      expect(wrapper.text()).toBe('AND');
      expect(wrapper.classes()).toContain('logical-operator-chip');
      expect(wrapper.classes()).toContain('requirement-neutral');
      expect(wrapper.find('.status').exists()).toBe(false);
    });

    it('shows state requirements by their description', () => {
      const wrapper = mountChip({
        criterion: statCriterion({
          description: 'Must be in combat',
          isStatRequirement: false,
        }),
      });

      expect(wrapper.text()).toBe('Must be in combat');
      expect(wrapper.classes()).toContain('state-requirement-chip');
    });

    it('links a running-nano requirement to the nano, using its resolved name', async () => {
      mockGetItem.mockResolvedValue({
        success: true,
        data: { name: 'Composite Attribute Boost' },
      } as Awaited<ReturnType<typeof apiClient.getItem>>);

      const wrapper = mountChip({
        criterion: statCriterion({
          isStatRequirement: false,
          isFunctionOperator: true,
          functionType: 'CheckNcu',
          referenceAoid: 95409,
          description: 'Not running: Nano 95409',
        }),
      });
      await flushPromises();

      expect(mockGetItem).toHaveBeenCalledWith(95409);
      const link = wrapper.find('a.function-link');
      expect(link.text()).toBe('Composite Attribute Boost');
      expect(link.attributes('href')).toContain('/items/95409');
      expect(visibleText(wrapper)).toBe('Not running: Composite Attribute Boost');
    });

    it('falls back to "Nano <aoid>" when the name cannot be resolved', async () => {
      mockGetItem.mockRejectedValue(new Error('offline'));

      const wrapper = mountChip({
        criterion: statCriterion({
          isStatRequirement: false,
          isFunctionOperator: true,
          functionType: 'RunningNano',
          referenceAoid: 12345,
          description: 'Running: Nano 12345',
        }),
      });
      await flushPromises();

      expect(wrapper.find('a.function-link').text()).toBe('Nano 12345');
      expect(visibleText(wrapper)).toBe('Running: Nano 12345');
    });

    it('shows a nano line requirement by line name without a link', () => {
      const wrapper = mountChip({
        criterion: statCriterion({
          isStatRequirement: false,
          isFunctionOperator: true,
          functionType: 'NotRunningNanoLine',
          description: 'Not running: Damage Shields',
        }),
      });

      expect(wrapper.find('a').exists()).toBe(false);
      expect(visibleText(wrapper)).toBe('Not running: Damage Shields');
      expect(mockGetItem).not.toHaveBeenCalled();
    });
  });

  describe('size', () => {
    it.each(['small', 'normal', 'large'] as const)('applies the %s size', (size) => {
      const wrapper = mountChip({ criterion: statCriterion(), size });

      expect(wrapper.classes()).toContain(`size-${size}`);
    });
  });
});

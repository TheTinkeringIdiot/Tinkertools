/**
 * CriteriaDisplay Component Tests
 *
 * Mounts the real component with the real criteria transformation, chips and
 * tree display. Raw game criteria go in (value1 = stat, value2 = value,
 * operator = AO operator code); the tests check which layout the user gets
 * and what it says about their character.
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import CriteriaDisplay from '../CriteriaDisplay.vue';
import type { Criterion } from '../../types/api';
import type { CharacterStats } from '../../composables/useActionCriteria';

// AO operator codes: 0 equal, 1 less than, 2 greater than, 4 AND.
const PISTOL_OVER_356: Criterion = { id: 1, value1: 112, value2: 356, operator: 2 };
const LEVEL_OVER_150: Criterion = { id: 2, value1: 54, value2: 150, operator: 2 };
const AGILITY_OVER_199: Criterion = { id: 3, value1: 17, value2: 199, operator: 2 };
const AND: Criterion = { id: 4, value1: 0, value2: 0, operator: 4 };

function mountDisplay(props: {
  criteria: Criterion[];
  characterStats?: CharacterStats | null;
  expanded?: boolean;
  showOeBreakpoints?: boolean;
}) {
  return mount(CriteriaDisplay, { props, global: { plugins: [PrimeVue] } });
}

function chipTexts(wrapper: ReturnType<typeof mountDisplay>): string[] {
  return wrapper.findAll('.criterion-chip').map((chip) => chip.text());
}

describe('CriteriaDisplay', () => {
  describe('no requirements', () => {
    it('says so when there are no criteria', () => {
      const wrapper = mountDisplay({ criteria: [] });

      expect(wrapper.text()).toBe('No requirements');
      expect(wrapper.findAll('.criterion-chip')).toHaveLength(0);
    });

    it('says so in the expanded layout too', () => {
      const wrapper = mountDisplay({ criteria: [], expanded: true });

      expect(wrapper.text()).toBe('No requirements');
    });
  });

  describe('one or two requirements', () => {
    it('shows each requirement as a chip', () => {
      const wrapper = mountDisplay({ criteria: [PISTOL_OVER_356, LEVEL_OVER_150] });

      expect(chipTexts(wrapper)).toEqual(['Pistol ≥ 357', 'Level ≥ 151']);
      expect(wrapper.find('button').exists()).toBe(false);
    });

    it('colours each chip by whether the character meets it', () => {
      const wrapper = mountDisplay({
        criteria: [PISTOL_OVER_356, LEVEL_OVER_150],
        characterStats: { 112: 400, 54: 100 },
      });

      const chips = wrapper.findAll('.criterion-chip');
      expect(chips[0].classes()).toContain('requirement-met');
      expect(chips[0].text()).toContain('(400)');
      expect(chips[1].classes()).toContain('requirement-unmet');
      expect(chips[1].text()).toContain('(100)');
    });

    it('shows OE breakpoints on skill chips when asked', () => {
      const wrapper = mountDisplay({ criteria: [PISTOL_OVER_356], showOeBreakpoints: true });

      expect(wrapper.text()).toContain('OE: 285/214/142/71');
    });
  });

  describe('several requirements without logical operators', () => {
    const criteria = [PISTOL_OVER_356, LEVEL_OVER_150, AGILITY_OVER_199];

    it('collapses them behind a count with a Show toggle', async () => {
      const wrapper = mountDisplay({ criteria });

      expect(wrapper.text()).toContain('3 requirements');
      expect(wrapper.findAll('.criterion-chip')).toHaveLength(0);

      const toggle = wrapper.find('button');
      expect(toggle.text()).toBe('Show');
      await toggle.trigger('click');

      expect(chipTexts(wrapper)).toEqual(['Pistol ≥ 357', 'Level ≥ 151', 'Agility ≥ 200']);
      expect(toggle.text()).toBe('Hide');

      await toggle.trigger('click');
      expect(wrapper.findAll('.criterion-chip')).toHaveLength(0);
    });
  });

  describe('expanded layout', () => {
    const criteria = [PISTOL_OVER_356, LEVEL_OVER_150];

    it('lists every requirement without evaluation when no character is selected', () => {
      const wrapper = mountDisplay({ criteria, expanded: true });

      expect(wrapper.text()).toContain('Requirements:');
      expect(chipTexts(wrapper)).toEqual(['Pistol ≥ 357', 'Level ≥ 151']);
      expect(wrapper.text()).not.toContain('Your Character:');
    });

    it('tells the user their character meets every requirement', () => {
      const wrapper = mountDisplay({
        criteria,
        expanded: true,
        characterStats: { 112: 400, 54: 200 },
      });

      expect(wrapper.text()).toContain('Meets Requirements');
      expect(wrapper.text()).not.toContain('Missing:');
    });

    it('lists what the character is missing and by how much', () => {
      const wrapper = mountDisplay({
        criteria,
        expanded: true,
        characterStats: { 112: 400, 54: 100 },
      });

      expect(wrapper.text()).toContain('Missing Requirements');
      const missing = wrapper.findAll('.text-danger');
      expect(missing).toHaveLength(1);
      expect(missing[0].text()).toContain('Level');
      expect(missing[0].text()).toContain('100/151 (need 51 more)');
    });
  });

  describe('logical expressions', () => {
    it('shows criteria joined by logical operators as a requirement tree', () => {
      const wrapper = mountDisplay({
        criteria: [PISTOL_OVER_356, LEVEL_OVER_150, AND],
        characterStats: { 112: 400, 54: 100 },
        expanded: true,
      });

      expect(wrapper.find('.criteria-tree-display').exists()).toBe(true);
      expect(wrapper.text()).toContain('All Required (1/2 met)');
      const requirements = wrapper.findAll('.tree-content .stat-name').map((n) => n.text());
      expect(requirements).toEqual(['Pistol', 'Level']);
      expect(wrapper.find('.unmet-list').text()).toBe('Level100/151 (need 51 more)');
    });
  });
});

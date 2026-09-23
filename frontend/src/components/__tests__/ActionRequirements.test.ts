/**
 * ActionRequirements Component Tests
 *
 * Mounts the real component with the real action parsing, criteria evaluation
 * and child displays. Raw item actions go in; the tests check which action is
 * featured, what the user is told about their character, and that the view
 * follows new actions (e.g. after QL interpolation changes requirements).
 */

import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import ActionRequirements from '../ActionRequirements.vue';
import type { Action, Criterion } from '../../types/api';
import type { CharacterStats } from '../../composables/useActionCriteria';

// TEMPLATE_ACTION ids
const GET = 1;
const USE = 3;
const WEAR = 6;
const WIELD = 8;

// Stat ids
const PISTOL = 112;
const LEVEL = 54;
const AGILITY = 17;
const STRENGTH = 16;
const STAMINA = 18;

/** A "stat > value" criterion, displayed as "stat ≥ value + 1". */
function atLeast(id: number, stat: number, value: number): Criterion {
  return { id, value1: stat, value2: value - 1, operator: 2 };
}

function action(id: number, actionType: number, criteria: Criterion[] = []): Action {
  return { id, action: actionType, item_id: 123, criteria };
}

function mountRequirements(
  props: {
    actions: Action[];
    characterStats?: CharacterStats | null;
    showOeBreakpoints?: boolean;
  },
  options: { attachTo?: HTMLElement } = {}
) {
  return mount(ActionRequirements, { props, global: { plugins: [PrimeVue] }, ...options });
}

function primaryText(wrapper: ReturnType<typeof mountRequirements>): string {
  return wrapper.find('.primary-action').text();
}

function accordionHeaders(wrapper: ReturnType<typeof mountRequirements>): string[] {
  return wrapper.findAll('.other-actions .p-accordion-header-text').map((h) => h.text());
}

describe('ActionRequirements', () => {
  describe('without actions', () => {
    it('says no actions are available', () => {
      const wrapper = mountRequirements({ actions: [] });

      expect(wrapper.text()).toBe('No actions available');
    });
  });

  describe('single action', () => {
    const wield = action(1, WIELD, [atLeast(1, PISTOL, 357)]);

    it('features the action with its requirements', () => {
      const wrapper = mountRequirements({ actions: [wield] });

      expect(wrapper.find('.primary-action h4').text()).toBe('Wield');
      expect(primaryText(wrapper)).toContain('Pistol ≥ 357');
      expect(wrapper.text()).not.toContain('Item Usage');
    });

    it('does not evaluate usability without a character', () => {
      const wrapper = mountRequirements({ actions: [wield] });

      expect(wrapper.text()).not.toContain('Can Use');
      expect(wrapper.text()).not.toContain('Cannot Use');
    });

    it('tells the user when their character can use it', () => {
      const wrapper = mountRequirements({ actions: [wield], characterStats: { [PISTOL]: 400 } });

      expect(wrapper.find('.primary-action .p-tag').text()).toBe('Can Use');
    });

    it('tells the user when their character cannot use it, and what is missing', () => {
      const wrapper = mountRequirements({ actions: [wield], characterStats: { [PISTOL]: 300 } });

      expect(wrapper.find('.primary-action .p-tag').text()).toBe('Cannot Use');
      expect(primaryText(wrapper)).toContain('Missing Requirements');
      expect(primaryText(wrapper)).toContain('300/357 (need 57 more)');
    });

    it('says an action without criteria has no requirements', () => {
      const wrapper = mountRequirements({ actions: [action(1, WIELD)] });

      expect(primaryText(wrapper)).toBe('WieldNo requirements');
    });

    it('names unknown action types by number', () => {
      const wrapper = mountRequirements({ actions: [action(1, 999, [atLeast(1, LEVEL, 10)])] });

      expect(wrapper.find('.primary-action h4').text()).toBe('Action 999');
    });

    it('shows OE breakpoints when asked', () => {
      const wrapper = mountRequirements({ actions: [wield], showOeBreakpoints: true });

      expect(primaryText(wrapper)).toContain('OE: 285/214/142/71');
    });
  });

  describe('choosing the featured action', () => {
    it('prefers Wield or Wear over other actions', () => {
      const wrapper = mountRequirements({
        actions: [
          action(1, USE, [atLeast(1, LEVEL, 50)]),
          action(2, WEAR, [atLeast(2, AGILITY, 200)]),
        ],
      });

      expect(wrapper.find('.primary-action h4').text()).toBe('Wear');
      expect(accordionHeaders(wrapper)).toEqual(['Use (1 requirement)']);
    });

    it('otherwise features the first action with requirements', () => {
      const wrapper = mountRequirements({
        actions: [action(1, GET), action(2, USE, [atLeast(2, LEVEL, 50)])],
      });

      expect(wrapper.find('.primary-action h4').text()).toBe('Use');
      expect(accordionHeaders(wrapper)).toEqual(['Get']);
    });

    it('evaluates the featured action, not the first action in the list', () => {
      // Get has no requirements and is always possible; the featured Use action is not.
      const wrapper = mountRequirements({
        actions: [action(1, GET), action(2, USE, [atLeast(2, LEVEL, 50)])],
        characterStats: { [LEVEL]: 10 },
      });

      expect(wrapper.find('.primary-action .p-tag').text()).toBe('Cannot Use');
    });
  });

  describe('multiple actions', () => {
    const actions = [
      action(1, WIELD, [atLeast(1, PISTOL, 357)]),
      action(2, USE, [atLeast(2, LEVEL, 151), atLeast(3, AGILITY, 100)]),
      action(3, GET),
    ];

    it('lists the other actions with their requirement counts', () => {
      const wrapper = mountRequirements({ actions });

      expect(accordionHeaders(wrapper)).toEqual(['Use (2 requirements)', 'Get']);
    });

    it('marks each other action as met or unmet for the character', () => {
      const met = mountRequirements({
        actions,
        characterStats: { [PISTOL]: 400, [LEVEL]: 200, [AGILITY]: 100 },
      });
      expect(accordionHeaders(met)).toEqual(['Use ✓ (2 requirements)', 'Get']);

      const unmet = mountRequirements({
        actions,
        characterStats: { [PISTOL]: 400, [LEVEL]: 100, [AGILITY]: 100 },
      });
      expect(accordionHeaders(unmet)).toEqual(['Use ✗ (2 requirements)', 'Get']);
    });

    it("reveals an action's requirements when its header is clicked", async () => {
      const wrapper = mountRequirements({ actions }, { attachTo: document.body });
      const header = wrapper.find('.other-actions [role="button"]');
      const content = wrapper.find(`#${header.attributes('aria-controls')}`);
      expect(header.attributes('aria-expanded')).toBe('false');
      expect(content.isVisible()).toBe(false);

      await header.trigger('click');

      expect(header.attributes('aria-expanded')).toBe('true');
      expect(content.isVisible()).toBe(true);
      expect(content.text()).toContain('Level ≥ 151');
      expect(content.text()).toContain('Agility ≥ 100');
      wrapper.unmount();
    });

    it('summarises whether the item is usable at all', () => {
      const usable = mountRequirements({ actions, characterStats: { [PISTOL]: 100 } });
      expect(usable.find('.mt-4 .p-tag').text()).toBe('Usable');

      const notUsable = mountRequirements({
        actions: [actions[0], actions[1]],
        characterStats: { [PISTOL]: 100 },
      });
      expect(notUsable.find('.mt-4 .p-tag').text()).toBe('Not Usable');
    });

    it('lists the largest shortfalls first, up to three', () => {
      const wrapper = mountRequirements({
        actions: [
          action(1, WIELD, [atLeast(1, PISTOL, 357), atLeast(2, STRENGTH, 300)]),
          action(2, USE, [
            atLeast(3, LEVEL, 151),
            atLeast(4, AGILITY, 100),
            atLeast(5, STAMINA, 90),
          ]),
        ],
        characterStats: {
          [PISTOL]: 300,
          [STRENGTH]: 100,
          [LEVEL]: 150,
          [AGILITY]: 10,
          [STAMINA]: 80,
        },
      });

      const rows = wrapper
        .findAll('.mt-4 .space-y-1 > .flex')
        .map((r) => r.text().replace(/\s+/g, ' '));
      expect(rows).toEqual([
        'Strength100/300 (-200)',
        'Agility10/100 (-90)',
        'Pistol300/357 (-57)',
      ]);
      expect(wrapper.text()).toContain('...and 2 more');
    });
  });

  describe('when the actions change', () => {
    it('shows the new requirements and re-evaluates the character', async () => {
      const wrapper = mountRequirements({
        actions: [action(1, WIELD, [atLeast(1, PISTOL, 300)])],
        characterStats: { [PISTOL]: 320 },
      });
      expect(primaryText(wrapper)).toContain('Pistol ≥ 300');
      expect(wrapper.find('.primary-action .p-tag').text()).toBe('Can Use');

      // e.g. the item was interpolated to a higher QL
      await wrapper.setProps({ actions: [action(1, WIELD, [atLeast(1, PISTOL, 340)])] });

      expect(primaryText(wrapper)).toContain('Pistol ≥ 340');
      expect(primaryText(wrapper)).not.toContain('Pistol ≥ 300');
      expect(wrapper.find('.primary-action .p-tag').text()).toBe('Cannot Use');
    });
  });
});

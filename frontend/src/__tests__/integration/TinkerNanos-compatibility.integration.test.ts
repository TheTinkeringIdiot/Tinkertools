/**
 * TinkerNanos Compatibility Integration Tests
 *
 * The TinkerNanos search view with its "Show Compatibility" switch and the
 * compatibility filters, driven through the real widgets. Real profiles and
 * nanos stores, router and PrimeVue; only the API client is mocked.
 *
 * Covers:
 * - The switch: off by default, disabled without an active profile, remembered
 * - Castable / uncastable states for a real v4 profile
 * - "Fully Castable", "Meets Skill Requirements" and skill-gap filters
 * - Results following the active profile and its skills
 *
 * @group integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// IMPORTANT: Mock API client BEFORE importing any stores
vi.mock('@/services/api-client');

import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import {
  setupIntegrationTest,
  type IntegrationTestContext,
} from '../helpers/integration-test-utils';
import { createTestRouter } from '../helpers/vue-test-utils';
import { appGlobals } from '../helpers/app-globals';
import { chooseOption, clickButton, shownOption } from '../helpers/item-search-page';
import { createNanoUseAction } from '../helpers/nano-fixtures';
import { createTestProfile, PROFESSION } from '../helpers/profile-fixtures';
import { createTestSkillData, SKILL_ID } from '../helpers/skill-fixtures';
import { versionedPath } from '@/composables/useGameVersion';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import TinkerNanos from '@/views/TinkerNanos.vue';
import type { Action } from '@/types/api';

// Stat IDs used by the criteria below
const STAT = {
  LEVEL: 54,
  PROFESSION: 60,
  VISUAL_PROFESSION: 368,
} as const;

/**
 * Alleysweeper (QL 36), a Soldier nano. Use action:
 * PM > 193 AND SI > 193 AND Profession = Soldier AND Level > 24
 */
const ALLEYSWEEPER_USE: Array<[number, number, number]> = [
  [SKILL_ID.PSYCHO_MODI, 193, 2],
  [SKILL_ID.SENSORY_IMPROVEMENT, 193, 2],
  [0, 0, 4],
  [STAT.PROFESSION, PROFESSION.SOLDIER, 0],
  [0, 0, 4],
  [STAT.LEVEL, 24, 2],
  [0, 0, 4],
];

/**
 * Minor Suppressor (QL 1), an Agent nano. Use action:
 * PM > 4 AND SI > 4 AND Visual Profession = Agent
 */
const MINOR_SUPPRESSOR_USE: Array<[number, number, number]> = [
  [SKILL_ID.PSYCHO_MODI, 4, 2],
  [SKILL_ID.SENSORY_IMPROVEMENT, 4, 2],
  [0, 0, 4],
  [STAT.VISUAL_PROFESSION, PROFESSION.AGENT, 0],
  [0, 0, 4],
];

/** A low Soldier nano: PM > 4 AND SI > 4 AND Profession = Soldier */
const SOLDIER_STARTER_USE: Array<[number, number, number]> = [
  [SKILL_ID.PSYCHO_MODI, 4, 2],
  [SKILL_ID.SENSORY_IMPROVEMENT, 4, 2],
  [0, 0, 4],
  [STAT.PROFESSION, PROFESSION.SOLDIER, 0],
  [0, 0, 4],
];

/** A nano program as the /nanos endpoints return it (snake_case, with actions) */
function backendNano(id: number, name: string, ql: number, actions: Action[]) {
  return {
    id,
    aoid: 1000 + id,
    name,
    ql,
    description: null,
    school: null,
    strain: null,
    professions: [],
    level: null,
    actions,
    effects: [],
  };
}

const NANOS = [
  backendNano(1, 'Alleysweeper', 36, [createNanoUseAction(ALLEYSWEEPER_USE, 1)]),
  backendNano(2, 'Minor Suppressor', 1, [createNanoUseAction(MINOR_SUPPRESSOR_USE, 2)]),
  backendNano(3, 'Soldier Starter', 1, [createNanoUseAction(SOLDIER_STARTER_USE, 3)]),
];

describe('TinkerNanos Compatibility Integration', () => {
  let context: IntegrationTestContext;
  let profileStore: ReturnType<typeof useTinkerProfilesStore>;
  let wrapper: VueWrapper;

  beforeEach(async () => {
    context = await setupIntegrationTest();
    profileStore = useTinkerProfilesStore();
    await profileStore.loadProfiles();

    context.mockApi.getPaginated.mockResolvedValue({
      items: NANOS,
      total: NANOS.length,
      page: 1,
      page_size: 200,
      pages: 1,
      has_next: false,
      has_prev: false,
    });
  });

  afterEach(() => {
    wrapper?.unmount();
    document.body.innerHTML = '';
  });

  /** Create and activate a profile with the given nano skills */
  async function activateProfile(
    name: string,
    profession: number,
    level: number,
    psychoModi: number,
    sensoryImprovement: number
  ): Promise<string> {
    const profile = createTestProfile({
      name,
      profession,
      level,
      skills: {
        [SKILL_ID.PSYCHO_MODI]: createTestSkillData({ pointsFromIp: 0 }),
        [SKILL_ID.SENSORY_IMPROVEMENT]: createTestSkillData({ pointsFromIp: 0 }),
      },
    });
    const profileId = await profileStore.createProfile(name, profile);
    await profileStore.modifySkill(profileId, SKILL_ID.PSYCHO_MODI, psychoModi);
    await profileStore.modifySkill(profileId, SKILL_ID.SENSORY_IMPROVEMENT, sensoryImprovement);
    await profileStore.setActiveProfile(profileId);
    return profileId;
  }

  /** Mount TinkerNanos and switch to search mode, which loads the nano list */
  async function openNanoSearch(): Promise<void> {
    const router = createTestRouter();
    await router.push(versionedPath('/nanos'));
    await router.isReady();

    wrapper = mount(TinkerNanos, {
      global: appGlobals(context.pinia, router),
      attachTo: document.body,
    });
    await flushPromises();
    await clickButton(wrapper, 'Search Mode');
  }

  function compatibilitySwitch() {
    return wrapper.find<HTMLInputElement>('input#compatibility-toggle');
  }

  async function toggleCompatibility(): Promise<void> {
    await compatibilitySwitch().trigger('change');
    await flushPromises();
  }

  async function checkFilter(inputId: string): Promise<void> {
    const checkbox = wrapper.find<HTMLInputElement>(`input#${inputId}`);
    expect(checkbox.exists()).toBe(true);
    await checkbox.trigger('change');
    await flushPromises();
  }

  function shownNanos(): string[] {
    return wrapper.findAll('.nano-card').map((card) => card.find('h3').text().trim());
  }

  /** The compatibility icon's title for each shown nano (undefined: no icon), by name */
  function castStates(): Record<string, string | undefined> {
    return Object.fromEntries(
      wrapper.findAll('.nano-card').map((card) => {
        const icon = card.find('i[title]');
        return [
          card.find('h3').text().trim(),
          icon.exists() ? icon.attributes('title') : undefined,
        ];
      })
    );
  }

  describe('the Show Compatibility switch', () => {
    it('is off and disabled, with an explanation, when no profile is active', async () => {
      expect(profileStore.hasActiveProfile).toBe(false);
      await openNanoSearch();

      const toggle = compatibilitySwitch();
      expect(toggle.exists()).toBe(true);
      expect(toggle.element.checked).toBe(false);
      expect(toggle.element.disabled).toBe(true);

      // The tooltip explains why
      await wrapper.find('[data-testid="compatibility-toggle"]').trigger('mouseenter');
      // The tooltip opens on a (zero-delay) timer
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(document.body.querySelector('[role="tooltip"]')?.textContent).toContain(
        'Create or select an active profile'
      );

      expect(shownNanos()).toHaveLength(3);
      expect(wrapper.text()).not.toContain('Cannot Cast');
      expect(wrapper.text()).not.toContain('Character Compatibility');
    });

    it('is off by default when a profile is active', async () => {
      await activateProfile('Sarge', PROFESSION.SOLDIER, 60, 150, 200);
      await openNanoSearch();

      expect(compatibilitySwitch().element.disabled).toBe(false);
      expect(compatibilitySwitch().element.checked).toBe(false);
      expect(castStates()).toEqual({
        Alleysweeper: undefined,
        'Minor Suppressor': undefined,
        'Soldier Starter': undefined,
      });
    });

    it('shows castable and uncastable nanos for the active v4 profile', async () => {
      await activateProfile('Sarge', PROFESSION.SOLDIER, 60, 150, 200);
      await openNanoSearch();

      await toggleCompatibility();

      expect(compatibilitySwitch().element.checked).toBe(true);
      expect(castStates()).toEqual({
        Alleysweeper: 'Cannot cast: 1 unmet requirement', // PM too low
        'Minor Suppressor': 'Cannot cast: 1 unmet requirement', // not an Agent
        'Soldier Starter': 'Can cast this nano',
      });
      const pm = profileStore.activeProfile?.skills[SKILL_ID.PSYCHO_MODI]?.total;
      expect(wrapper.text()).toContain(`≥ 194 (have ${pm})`);
      expect(wrapper.text()).toContain('Character Compatibility');
    });

    it('remembers the choice as a global nano preference', async () => {
      await activateProfile('Sarge', PROFESSION.SOLDIER, 60, 150, 200);
      await openNanoSearch();
      await toggleCompatibility();

      const saved = context.mockLocalStorage.getItem('tinkertools_nano_preferences');
      expect(JSON.parse(saved ?? '{}')).toMatchObject({ showCompatibility: true });

      // A fresh visit starts with compatibility on
      wrapper.unmount();
      await openNanoSearch();
      expect(compatibilitySwitch().element.checked).toBe(true);
      expect(castStates()['Soldier Starter']).toBe('Can cast this nano');
    });
  });

  describe('compatibility filters', () => {
    it('"Fully Castable" narrows the list to nanos the profile can cast', async () => {
      await activateProfile('Sarge', PROFESSION.SOLDIER, 60, 150, 200);
      await openNanoSearch();
      await toggleCompatibility();

      await checkFilter('fully-castable');

      expect(shownNanos()).toEqual(['Soldier Starter']);
    });

    it('"Meets Skill Requirements" keeps nanos blocked only by something other than skills', async () => {
      await activateProfile('Sarge', PROFESSION.SOLDIER, 60, 150, 200);
      await openNanoSearch();
      await toggleCompatibility();

      await checkFilter('skill-compatible');

      // Alleysweeper lacks PM; Minor Suppressor's skills are met, its profession is not
      expect(shownNanos().sort()).toEqual(['Minor Suppressor', 'Soldier Starter']);
    });

    it('the skill gap keeps nanos castable by raising skills that much', async () => {
      // PM 150 against Alleysweeper's 194
      await activateProfile('Sarge', PROFESSION.SOLDIER, 60, 150, 200);
      const pm = profileStore.activeProfile?.skills[SKILL_ID.PSYCHO_MODI]?.total ?? 0;
      expect(194 - pm).toBeGreaterThan(0);
      expect(194 - pm).toBeLessThanOrEqual(50);
      await openNanoSearch();
      await toggleCompatibility();

      const gapDropdown = wrapper
        .findAll('.p-dropdown')
        .find((dropdown) => dropdown.find('#skill-gap').exists());
      if (!gapDropdown) throw new Error('No skill gap dropdown');

      await chooseOption(gapDropdown, 'No Gap (Castable)');
      expect(shownNanos()).toEqual(['Soldier Starter']);

      await chooseOption(gapDropdown, 'Within 50 points');
      // Minor Suppressor needs a profession change, not skills
      expect(shownNanos().sort()).toEqual(['Alleysweeper', 'Soldier Starter']);
    });

    it('sorts by compatibility score', async () => {
      await activateProfile('Sarge', PROFESSION.SOLDIER, 60, 150, 200);
      await openNanoSearch();
      await toggleCompatibility();

      const sortDropdown = wrapper
        .findAll('.p-dropdown')
        .find((dropdown) => shownOption(dropdown) === 'Name');
      if (!sortDropdown) throw new Error('No sort dropdown');
      await chooseOption(sortDropdown, 'Compatibility Score');

      // Minor Suppressor 67% (profession unmet), Alleysweeper 75% (PM unmet), Soldier Starter 100%
      expect(shownNanos()).toEqual(['Minor Suppressor', 'Alleysweeper', 'Soldier Starter']);

      await checkFilter('sort-desc');
      expect(shownNanos()).toEqual(['Soldier Starter', 'Alleysweeper', 'Minor Suppressor']);
    });

    it('shows the filters restored on a fresh visit', async () => {
      await activateProfile('Sarge', PROFESSION.SOLDIER, 60, 150, 200);
      await openNanoSearch();
      await toggleCompatibility();
      await checkFilter('fully-castable');
      const gapDropdown = () => {
        const dropdown = wrapper
          .findAll('.p-dropdown')
          .find((candidate) => candidate.find('#skill-gap').exists());
        if (!dropdown) throw new Error('No skill gap dropdown');
        return dropdown;
      };
      await chooseOption(gapDropdown(), 'Within 50 points');

      wrapper.unmount();
      await openNanoSearch();

      expect(shownNanos()).toEqual(['Soldier Starter']);
      expect(wrapper.find<HTMLInputElement>('input#fully-castable').element.checked).toBe(true);
      expect(shownOption(gapDropdown())).toBe('Within 50 points');
    });

    it('does not filter while compatibility is off', async () => {
      await activateProfile('Sarge', PROFESSION.SOLDIER, 60, 150, 200);
      await openNanoSearch();
      await toggleCompatibility();
      await checkFilter('fully-castable');
      expect(shownNanos()).toEqual(['Soldier Starter']);

      await toggleCompatibility();

      expect(compatibilitySwitch().element.checked).toBe(false);
      expect(shownNanos()).toHaveLength(3);
    });
  });

  describe('following the active profile', () => {
    it('updates the results when the active profile switches', async () => {
      const agentId = await activateProfile('Agent Smith', PROFESSION.AGENT, 10, 10, 10);
      await activateProfile('Sarge', PROFESSION.SOLDIER, 60, 150, 200);
      await openNanoSearch();
      await toggleCompatibility();
      await checkFilter('fully-castable');
      expect(shownNanos()).toEqual(['Soldier Starter']);

      await profileStore.setActiveProfile(agentId);
      await flushPromises();

      expect(shownNanos()).toEqual(['Minor Suppressor']);
    });

    it('updates the results when the active profile raises a skill', async () => {
      const profileId = await activateProfile('Sarge', PROFESSION.SOLDIER, 60, 150, 200);
      await openNanoSearch();
      await toggleCompatibility();
      await checkFilter('fully-castable');
      expect(shownNanos()).toEqual(['Soldier Starter']);

      await profileStore.modifySkill(profileId, SKILL_ID.PSYCHO_MODI, 200);
      await flushPromises();

      expect(shownNanos().sort()).toEqual(['Alleysweeper', 'Soldier Starter']);
    });

    it('disables the switch and drops compatibility when the profile is cleared', async () => {
      await activateProfile('Sarge', PROFESSION.SOLDIER, 60, 150, 200);
      await openNanoSearch();
      await toggleCompatibility();
      await checkFilter('fully-castable');
      expect(shownNanos()).toEqual(['Soldier Starter']);

      await profileStore.clearActiveProfile();
      await flushPromises();

      expect(compatibilitySwitch().element.disabled).toBe(true);
      expect(compatibilitySwitch().element.checked).toBe(false);
      expect(shownNanos()).toHaveLength(3);
    });
  });
});

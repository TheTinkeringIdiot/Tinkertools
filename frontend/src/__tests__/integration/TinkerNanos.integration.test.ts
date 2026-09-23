/**
 * TinkerNanos Integration Tests
 *
 * The TinkerNanos search view with its school, profession and level filters,
 * its "Show Compatibility" switch and the compatibility filters, driven
 * through the real widgets. Real profiles and nanos stores, router and
 * PrimeVue; only the API client is mocked.
 *
 * Covers:
 * - School chips and filter presets on the NanoSchool stat; profession and level filters
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
import { COMPATIBILITY_FETCH_CAP } from '@/stores/nanosStore';
import { backendNano, nanoRequests, serveNanos, type BackendNano } from '../helpers/nano-backend';

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

// School, professions and level as the backend derives them from the Use action
const NANOS: BackendNano[] = [
  backendNano({
    id: 1,
    name: 'Alleysweeper',
    ql: 36,
    actions: [createNanoUseAction(ALLEYSWEEPER_USE, 1)],
    school: 'Combat',
    professions: ['Soldier'],
    level: 25,
    strain_id: 101,
    strain: 'Street Sweeping',
  }),
  backendNano({
    id: 2,
    name: 'Minor Suppressor',
    actions: [createNanoUseAction(MINOR_SUPPRESSOR_USE, 2)],
    school: 'Psi',
    professions: ['Agent'],
    level: 1,
    strain_id: 102,
    strain: 'Suppression',
  }),
  backendNano({
    id: 3,
    name: 'Soldier Starter',
    actions: [createNanoUseAction(SOLDIER_STARTER_USE, 3)],
    school: 'Protection',
    professions: ['Soldier'],
    level: 1,
    strain_id: 101,
    strain: 'Street Sweeping',
  }),
];

describe('TinkerNanos Compatibility Integration', () => {
  let context: IntegrationTestContext;
  let profileStore: ReturnType<typeof useTinkerProfilesStore>;
  let wrapper: VueWrapper;

  beforeEach(async () => {
    context = await setupIntegrationTest();
    profileStore = useTinkerProfilesStore();
    await profileStore.loadProfiles();

    serveNanos(context.mockApi, NANOS);
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

  function schoolChip(school: string) {
    const chip = wrapper
      .find('.nano-search')
      .findAll('.p-chip')
      .find((candidate) => candidate.text().trim() === school);
    if (!chip) throw new Error(`No ${school} chip`);
    return chip;
  }

  const chipSelected = (school: string) => schoolChip(school).classes().includes('bg-primary-100');

  describe('school, profession and level filters', () => {
    it('offers the five NanoSchool values as school chips', async () => {
      await openNanoSearch();

      const chips = wrapper
        .find('.nano-search')
        .findAll('.p-chip')
        .map((chip) => chip.text().trim());
      expect(chips).toEqual(['Combat', 'Medical', 'Protection', 'Psi', 'Space']);
    });

    it('a school chip narrows the list to that school, and clears again', async () => {
      await openNanoSearch();

      await schoolChip('Combat').trigger('click');
      await flushPromises();
      expect(shownNanos()).toEqual(['Alleysweeper']);
      expect(chipSelected('Combat')).toBe(true);

      await schoolChip('Combat').trigger('click');
      await flushPromises();
      expect(shownNanos()).toHaveLength(3);
    });

    it('a school preset selects its school chip, and Clear All Filters resets both', async () => {
      await openNanoSearch();

      await clickButton(wrapper, 'Nukes');
      expect(shownNanos()).toEqual(['Alleysweeper']);
      expect(chipSelected('Combat')).toBe(true);

      await clickButton(wrapper, 'Clear All Filters');
      expect(shownNanos()).toHaveLength(3);
      expect(chipSelected('Combat')).toBe(false);
    });

    it('filters by the professions that can cast a nano', async () => {
      await openNanoSearch();

      const professionSelect = wrapper
        .findAll('.p-multiselect')
        .find((select) => select.text().includes('All Professions'));
      if (!professionSelect) throw new Error('No profession filter');
      await professionSelect.trigger('click');
      await flushPromises();
      const agent = document.body.querySelector<HTMLElement>('li[aria-label="Agent"]');
      expect(agent).not.toBeNull();
      agent?.click();
      await flushPromises();

      expect(shownNanos()).toEqual(['Minor Suppressor']);
    });

    it('filters by the level that can cast a nano', async () => {
      await openNanoSearch();

      await clickButton(wrapper, 'Low Level');
      expect(shownNanos()).toEqual(['Alleysweeper', 'Minor Suppressor', 'Soldier Starter']);

      await clickButton(wrapper, 'High Level');
      expect(shownNanos()).toEqual([]);
    });

    it('shows school and professions on each nano', async () => {
      await openNanoSearch();

      const card = wrapper.findAll('.nano-card').find((c) => c.text().includes('Alleysweeper'));
      expect(card?.text()).toContain('Combat');
      expect(card?.text()).toContain('Soldier');
    });
  });

  /** The parameters of the last nano request */
  const lastRequest = () => {
    const requests = nanoRequests(context.mockApi.getPaginated);
    return requests[requests.length - 1];
  };

  const headerCount = () => wrapper.find('h1').element.parentElement?.textContent ?? '';

  /** Many castable-by-anyone nanos; every third one needs a Soldier */
  function manyNanos(count: number): BackendNano[] {
    return Array.from({ length: count }, (_, index) =>
      backendNano({
        id: 1000 + index,
        name: `Bulk Nano ${String(index).padStart(4, '0')}`,
        school: 'Medical',
        professions: index % 3 === 0 ? ['Soldier'] : ['Doctor'],
        actions: [
          createNanoUseAction(
            [[STAT.PROFESSION, index % 3 === 0 ? PROFESSION.SOLDIER : PROFESSION.DOCTOR, 0]],
            1000 + index
          ),
        ],
      })
    );
  }

  async function goToPage(label: 'Next Page' | 'Previous Page') {
    // jsdom has no scrolling; NanoList scrolls the list back to the top
    Element.prototype.scrollTo ??= () => {};
    await wrapper.find(`button[aria-label="${label}"]`).trigger('click');
    await flushPromises();
  }

  describe('server-side filtering and paging', () => {
    it('asks the server for the first page, sorted by name', async () => {
      await openNanoSearch();

      const request = lastRequest();
      expect(request?.path).toBe('/nanos');
      expect(request?.params.toString()).toBe('sort_by=name&page=1&page_size=25');
    });

    it('sends the school, profession and level filters and the text query', async () => {
      await openNanoSearch();

      await schoolChip('Combat').trigger('click');
      await flushPromises();
      await schoolChip('Psi').trigger('click');
      await flushPromises();
      const professionSelect = wrapper
        .findAll('.p-multiselect')
        .find((select) => select.text().includes('All Professions'));
      await professionSelect?.trigger('click');
      await flushPromises();
      document.body.querySelector<HTMLElement>('li[aria-label="Soldier"]')?.click();
      await flushPromises();
      const input = wrapper.find('.nano-search input.p-inputtext');
      await input.setValue('sweep');
      await input.trigger('keyup.enter');
      await flushPromises();

      const request = lastRequest();
      expect(request?.path).toBe('/nanos/search');
      expect(request?.params.get('q')).toBe('sweep');
      expect(request?.params.getAll('school')).toEqual(['Combat', 'Psi']);
      expect(request?.params.getAll('profession')).toEqual(['Soldier']);
      expect(request?.params.get('page')).toBe('1');
      // The search endpoint sorts too
      expect(request?.params.get('sort_by')).toBe('name');
      expect(shownNanos()).toEqual(['Alleysweeper']);

      await clickButton(wrapper, 'Low Level');
      const levelRequest = lastRequest();
      expect(levelRequest?.params.get('level_max')).toBe('50');
      expect(levelRequest?.params.has('level_min')).toBe(false);
    });

    it('offers the strains the other filters leave, and filters by strain ID', async () => {
      await openNanoSearch();
      /** Open the strain picker and read its options; it stays open */
      const strainOptions = async () => {
        if (!document.body.querySelector('.p-multiselect-panel')) {
          await wrapper.find('[data-testid="strain-filter"]').trigger('click');
          await flushPromises();
        }
        return Array.from(
          document.body.querySelectorAll<HTMLElement>('.p-multiselect-panel li[role="option"]')
        ).map((option) => option.getAttribute('aria-label'));
      };

      expect(await strainOptions()).toEqual(['Street Sweeping (2)', 'Suppression (1)']);

      document.body.querySelector<HTMLElement>('li[aria-label="Street Sweeping (2)"]')?.click();
      await flushPromises();

      expect(lastRequest()?.params.getAll('strain')).toEqual(['101']);
      expect(shownNanos()).toEqual(['Alleysweeper', 'Soldier Starter']);

      // Narrowing by school narrows the strain list, whatever strain is picked
      await schoolChip('Psi').trigger('click');
      await flushPromises();
      const strainCalls = vi.mocked(context.mockApi.get).mock.calls.map(([url]) => String(url));
      expect(strainCalls[strainCalls.length - 1]).toBe('/nanos/strains?school=Psi');
      expect(await strainOptions()).toEqual(['Suppression (1)']);
      expect(shownNanos()).toEqual([]);
    });

    it('has no advanced search options', async () => {
      await openNanoSearch();

      expect(wrapper.text()).not.toContain('Advanced Search');
      expect(wrapper.text()).not.toContain('Search In');
      expect(wrapper.text()).not.toContain('Use quotes for exact matches');
    });

    it('pages through the server total', async () => {
      serveNanos(context.mockApi, manyNanos(60));
      await openNanoSearch();

      expect(headerCount()).toContain('60 nanos');
      expect(shownNanos()).toHaveLength(25);
      expect(shownNanos()[0]).toBe('Bulk Nano 0000');

      await goToPage('Next Page');

      expect(lastRequest()?.params.get('page')).toBe('2');
      expect(shownNanos()[0]).toBe('Bulk Nano 0025');
      expect(wrapper.text()).toContain('Showing 26 to 50 of 60 nanos');

      await goToPage('Next Page');
      expect(shownNanos()).toHaveLength(10);
    });

    it('sorts on the server', async () => {
      await openNanoSearch();
      const sortDropdown = wrapper
        .findAll('.p-dropdown')
        .find((dropdown) => shownOption(dropdown) === 'Name');
      if (!sortDropdown) throw new Error('No sort dropdown');

      await chooseOption(sortDropdown, 'Level');
      await checkFilter('sort-desc');

      expect(lastRequest()?.params.get('sort_by')).toBe('level');
      expect(lastRequest()?.params.get('sort_desc')).toBe('true');
      expect(shownNanos()[0]).toBe('Alleysweeper');
    });
  });

  describe('compatibility filters over every page', () => {
    it('fetches every page of the server result and filters all of it', async () => {
      serveNanos(context.mockApi, manyNanos(450));
      await activateProfile('Sarge', PROFESSION.SOLDIER, 60, 150, 200);
      await openNanoSearch();
      expect(headerCount()).toContain('450 nanos');
      await toggleCompatibility();
      context.mockApi.getPaginated.mockClear();

      await checkFilter('fully-castable');

      const requests = nanoRequests(context.mockApi.getPaginated);
      expect(requests.map((r) => [r.params.get('page'), r.params.get('page_size')])).toEqual([
        ['1', '200'],
        ['2', '200'],
        ['3', '200'],
      ]);
      // Every third bulk nano is a Soldier nano: 150 of 450
      expect(headerCount()).toContain('150 nanos');
      expect(wrapper.text()).toContain('Showing 1 to 25 of 150 nanos');
    });

    it('asks to narrow the filters when too many nanos match', async () => {
      serveNanos(context.mockApi, manyNanos(COMPATIBILITY_FETCH_CAP + 500));
      await activateProfile('Sarge', PROFESSION.SOLDIER, 60, 150, 200);
      await openNanoSearch();
      await toggleCompatibility();
      context.mockApi.getPaginated.mockClear();

      await checkFilter('fully-castable');

      // One request finds the total over the cap; nothing more is fetched
      expect(nanoRequests(context.mockApi.getPaginated)).toHaveLength(1);
      const message = wrapper.find('[data-testid="compatibility-overflow"]');
      expect(message.text()).toContain(
        `${(COMPATIBILITY_FETCH_CAP + 500).toLocaleString()} nanos match your filters`
      );
      expect(message.text()).toContain('Narrow the list by profession, school or level');
      expect(shownNanos()).toEqual([]);

      // Narrowed to Soldier nanos (a third) the filter runs over all of them
      const professionSelect = wrapper
        .findAll('.p-multiselect')
        .find((select) => select.text().includes('All Professions'));
      await professionSelect?.trigger('click');
      await flushPromises();
      document.body.querySelector<HTMLElement>('li[aria-label="Soldier"]')?.click();
      await flushPromises();

      expect(wrapper.find('[data-testid="compatibility-overflow"]').exists()).toBe(false);
      expect(headerCount()).toContain(`${(COMPATIBILITY_FETCH_CAP + 500) / 3} nanos`);
    });
  });

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

/**
 * Nano Compatibility Integration Tests
 *
 * TinkerNanos compatibility evaluates a nano's casting requirements (the criteria
 * of the nano item's Use action, as the /nanos endpoints return them) against the
 * active v4 profile from the real profiles store, through the shared
 * action-criteria machinery. Only the API client is mocked.
 *
 * The nanos below carry their real Use-action criteria from the game data.
 *
 * @group integration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock API client before any store imports
vi.mock('@/services/api-client');

import {
  mountForIntegration,
  setupIntegrationTest,
  waitForUpdates,
  type IntegrationTestContext,
} from '../helpers/integration-test-utils';
import { createNanoUseAction } from '../helpers/nano-fixtures';
import { createTestProfile, PROFESSION } from '../helpers/profile-fixtures';
import { createTestSkillData, SKILL_ID } from '../helpers/skill-fixtures';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import { useNanosStore } from '@/stores/nanosStore';
import { getNanoCompatibility } from '@/components/nanos/nano-compatibility';
import { mapProfileToStats } from '@/utils/profile-stats-mapper';
import NanoList from '@/components/nanos/NanoList.vue';
import NanoDetail from '@/components/nanos/NanoDetail.vue';
import type { NanoProgram } from '@/types/nano';
import type { Action } from '@/types/api';

// Stat IDs used by the criteria below
const STAT = {
  LEVEL: 54,
  PROFESSION: 60,
  VISUAL_PROFESSION: 368,
} as const;

/**
 * Alleysweeper (QL 36, aoid 203123), a Soldier nano. Use action:
 * Psychological Modifications > 193 AND Sensory Improvement > 193
 * AND Profession = Soldier AND Level > 24
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
 * Minor Suppressor (QL 1, aoid 43370), an Agent nano. Use action:
 * Psychological Modifications > 4 AND Sensory Improvement > 4
 * AND Visual Profession = Agent
 */
const MINOR_SUPPRESSOR_USE: Array<[number, number, number]> = [
  [SKILL_ID.PSYCHO_MODI, 4, 2],
  [SKILL_ID.SENSORY_IMPROVEMENT, 4, 2],
  [0, 0, 4],
  [STAT.VISUAL_PROFESSION, PROFESSION.AGENT, 0],
  [0, 0, 4],
];

/** A nano program as the /nanos endpoints return it (snake_case, with actions) */
function backendNano(id: number, aoid: number, name: string, ql: number, actions: Action[]) {
  return {
    id,
    aoid,
    name,
    ql,
    description: null,
    school: null,
    strain: null,
    profession: null,
    level: null,
    actions,
    effects: [],
  };
}

describe('Nano Compatibility Integration', () => {
  let context: IntegrationTestContext;
  let profileStore: ReturnType<typeof useTinkerProfilesStore>;
  let nanoStore: ReturnType<typeof useNanosStore>;
  let alleysweeper: NanoProgram;
  let minorSuppressor: NanoProgram;

  beforeEach(async () => {
    context = await setupIntegrationTest();
    profileStore = useTinkerProfilesStore();
    nanoStore = useNanosStore();
    await profileStore.loadProfiles();

    // The nanos come through the real store from a mocked /nanos response
    context.mockApi.getPaginated.mockResolvedValue({
      items: [
        backendNano(1, 203123, 'Alleysweeper', 36, [createNanoUseAction(ALLEYSWEEPER_USE, 203123)]),
        backendNano(2, 43370, 'Minor Suppressor', 1, [
          createNanoUseAction(MINOR_SUPPRESSOR_USE, 43370),
        ]),
      ],
      total: 2,
      page: 1,
      page_size: 200,
      pages: 1,
      has_next: false,
      has_prev: false,
    });
    await nanoStore.fetchNanos();

    const byName = (name: string) => {
      const nano = nanoStore.nanos.find((n) => n.name === name);
      if (!nano) throw new Error(`${name} not loaded`);
      return nano;
    };
    alleysweeper = byName('Alleysweeper');
    minorSuppressor = byName('Minor Suppressor');
  });

  /** Create and activate a profile, raising the nano skills to the given values */
  async function activateProfile(
    profession: number,
    level: number,
    psychoModi: number,
    sensoryImprovement: number
  ): Promise<string> {
    const profile = createTestProfile({
      name: `Caster ${profession}-${level}`,
      profession,
      level,
      skills: {
        [SKILL_ID.PSYCHO_MODI]: createTestSkillData({ pointsFromIp: 0 }),
        [SKILL_ID.SENSORY_IMPROVEMENT]: createTestSkillData({ pointsFromIp: 0 }),
      },
    });
    const profileId = await profileStore.createProfile(profile.Character.Name, profile);
    await profileStore.modifySkill(profileId, SKILL_ID.PSYCHO_MODI, psychoModi);
    await profileStore.modifySkill(profileId, SKILL_ID.SENSORY_IMPROVEMENT, sensoryImprovement);
    await profileStore.setActiveProfile(profileId);
    return profileId;
  }

  function activeProfile() {
    const profile = profileStore.activeProfile;
    if (!profile) throw new Error('No active profile');
    return profile;
  }

  function skillTotal(skillId: number): number {
    return activeProfile().skills[skillId]?.total ?? 0;
  }

  it('loads the Use action criteria from the /nanos response', () => {
    const useAction = alleysweeper.actions?.find((action) => action.action === 3);
    expect(useAction?.criteria.map((c) => [c.value1, c.value2, c.operator])).toEqual(
      ALLEYSWEEPER_USE
    );
  });

  describe('evaluating the store profile', () => {
    it('reports a nano castable when the profile meets every requirement', async () => {
      await activateProfile(PROFESSION.SOLDIER, 60, 200, 200);
      expect(skillTotal(SKILL_ID.PSYCHO_MODI)).toBeGreaterThanOrEqual(194);
      expect(skillTotal(SKILL_ID.SENSORY_IMPROVEMENT)).toBeGreaterThanOrEqual(194);

      const info = getNanoCompatibility(alleysweeper, mapProfileToStats(activeProfile()));

      expect(info.canCast).toBe(true);
      expect(info.unmetRequirements).toEqual([]);
      expect(info.compatibilityScore).toBe(100);
    });

    it('reports the unmet skill by ID with its current and required values', async () => {
      await activateProfile(PROFESSION.SOLDIER, 60, 150, 200);
      const current = skillTotal(SKILL_ID.PSYCHO_MODI);
      expect(current).toBeLessThan(194);
      expect(skillTotal(SKILL_ID.SENSORY_IMPROVEMENT)).toBeGreaterThanOrEqual(194);

      const info = getNanoCompatibility(alleysweeper, mapProfileToStats(activeProfile()));

      expect(info.canCast).toBe(false);
      expect(info.unmetRequirements).toHaveLength(1);
      expect(info.unmetRequirements[0]).toMatchObject({
        stat: SKILL_ID.PSYCHO_MODI,
        required: 194,
        current,
      });
      // 3 of the 4 requirements (PM, SI, profession, level) are met
      expect(info.compatibilityScore).toBe(75);
    });

    it('checks profession from the v4 profile', async () => {
      // Skills and level are met, but the character is a Doctor
      await activateProfile(PROFESSION.DOCTOR, 60, 200, 200);

      const info = getNanoCompatibility(alleysweeper, mapProfileToStats(activeProfile()));

      expect(info.canCast).toBe(false);
      expect(info.unmetRequirements).toEqual([
        expect.objectContaining({
          stat: STAT.PROFESSION,
          required: PROFESSION.SOLDIER,
          current: PROFESSION.DOCTOR,
        }),
      ]);
    });

    it('checks level from the v4 profile', async () => {
      // A level 20 Soldier can't have the skills yet either
      await activateProfile(PROFESSION.SOLDIER, 20, 10, 10);

      const info = getNanoCompatibility(alleysweeper, mapProfileToStats(activeProfile()));

      expect(info.canCast).toBe(false);
      expect(info.unmetRequirements.map((req) => req.stat).sort((a, b) => a - b)).toEqual([
        STAT.LEVEL,
        SKILL_ID.SENSORY_IMPROVEMENT,
        SKILL_ID.PSYCHO_MODI,
      ]);
      expect(info.unmetRequirements.find((req) => req.stat === STAT.LEVEL)).toMatchObject({
        required: 25,
        current: 20,
      });
    });

    it('matches a Visual Profession requirement against the profile profession', async () => {
      await activateProfile(PROFESSION.AGENT, 10, 10, 10);
      const stats = mapProfileToStats(activeProfile());
      expect(getNanoCompatibility(minorSuppressor, stats).canCast).toBe(true);

      await activateProfile(PROFESSION.SOLDIER, 10, 10, 10);
      const soldier = getNanoCompatibility(minorSuppressor, mapProfileToStats(activeProfile()));
      expect(soldier.canCast).toBe(false);
      expect(soldier.unmetRequirements.map((req) => req.stat)).toEqual([STAT.VISUAL_PROFESSION]);
    });

    it('treats a nano without a Use action as castable', async () => {
      await activateProfile(PROFESSION.SOLDIER, 1, 1, 1);
      const noActions: NanoProgram = { ...alleysweeper, actions: [] };

      const info = getNanoCompatibility(noActions, mapProfileToStats(activeProfile()));

      expect(info).toMatchObject({ canCast: true, unmetRequirements: [] });
    });
  });

  describe('rendering with the store profile', () => {
    it('NanoList shows which nanos the read-only store profile can cast', async () => {
      await activateProfile(PROFESSION.SOLDIER, 60, 150, 200);
      const current = skillTotal(SKILL_ID.PSYCHO_MODI);

      const wrapper = mountForIntegration(NanoList, {
        pinia: context.pinia,
        props: {
          nanos: nanoStore.nanos,
          showCompatibility: true,
          activeProfile: profileStore.activeProfile,
        },
      });
      await waitForUpdates(wrapper);

      const cards = wrapper.findAll('.nano-card');
      expect(cards).toHaveLength(2);
      const alleysweeperCard = cards.find((card) => card.text().includes('Alleysweeper'));
      const suppressorCard = cards.find((card) => card.text().includes('Minor Suppressor'));

      // Alleysweeper: PM too low
      expect(alleysweeperCard?.text()).toContain('Cannot Cast');
      expect(alleysweeperCard?.text()).toContain(`${current}/194`);
      expect(alleysweeperCard?.text()).toContain('75%');
      // Minor Suppressor: a Soldier is not an Agent
      expect(suppressorCard?.text()).toContain('Cannot Cast');

      wrapper.unmount();
    });

    it('NanoList updates when the profile raises the missing skill', async () => {
      const profileId = await activateProfile(PROFESSION.SOLDIER, 60, 150, 200);

      const wrapper = mountForIntegration(NanoList, {
        pinia: context.pinia,
        props: {
          nanos: [alleysweeper],
          showCompatibility: true,
          activeProfile: profileStore.activeProfile,
        },
      });
      await waitForUpdates(wrapper);
      expect(wrapper.text()).toContain('Cannot Cast');

      await profileStore.modifySkill(profileId, SKILL_ID.PSYCHO_MODI, 200);
      expect(skillTotal(SKILL_ID.PSYCHO_MODI)).toBeGreaterThanOrEqual(194);
      await wrapper.setProps({ activeProfile: profileStore.activeProfile });
      await waitForUpdates(wrapper);

      expect(wrapper.text()).not.toContain('Cannot Cast');
      expect(wrapper.text()).toContain('100%');

      wrapper.unmount();
    });

    it('NanoDetail shows the unmet requirements of the store profile', async () => {
      await activateProfile(PROFESSION.SOLDIER, 20, 10, 10);

      const wrapper = mountForIntegration(NanoDetail, {
        pinia: context.pinia,
        props: {
          visible: true,
          nano: alleysweeper,
          showCompatibility: true,
          activeProfile: profileStore.activeProfile,
        },
      });
      await waitForUpdates(wrapper);

      // The dialog renders its content into document.body
      const panel = document.body.querySelector('.compatibility-panel');
      expect(panel).not.toBeNull();
      expect(panel?.textContent).toContain('Cannot Cast');
      expect(panel?.textContent).toContain('Requirements Not Met');
      expect(panel?.textContent).toContain('(have 20)');

      wrapper.unmount();
    });

    it('renders without compatibility when no profile is active', async () => {
      const wrapper = mountForIntegration(NanoList, {
        pinia: context.pinia,
        props: {
          nanos: nanoStore.nanos,
          showCompatibility: true,
          activeProfile: null,
        },
      });
      await waitForUpdates(wrapper);

      expect(wrapper.findAll('.nano-card')).toHaveLength(2);
      expect(wrapper.text()).not.toContain('Cannot Cast');

      wrapper.unmount();
    });
  });

  /**
   * Requirements a profile can't decide, from the real Use actions of
   * ao-2024-02 nanos. None of these may read "cannot cast" without saying why.
   */
  describe('requirements the profile cannot decide', () => {
    /** Access Notum Source (aoid 227302): NotRunningNano 209909 */
    const ACCESS_NOTUM_SOURCE_USE: Array<[number, number, number]> = [[0, 209909, 101]];

    /**
     * Average Health Funnel (aoid 76727), a Trader nano: BM > 56 AND TS > 68
     * AND Visual Profession = Trader AND (on the target) MaxHealth > 42
     */
    const AVERAGE_HEALTH_FUNNEL_USE: Array<[number, number, number]> = [
      [SKILL_ID.BIO_METAMOR, 56, 2],
      [SKILL_ID.TIME_SPACE, 68, 2],
      [0, 0, 4],
      [STAT.VISUAL_PROFESSION, PROFESSION.TRADER, 0],
      [0, 0, 4],
      [0, 0, 18],
      [1, 42, 2],
      [0, 0, 4],
    ];

    /** Mezz (aoid 223444): StateIsNpc */
    const MEZZ_USE: Array<[number, number, number]> = [[0, 2, 44]];

    /** Root and Snare Resistance (aoid 291385): NOT (stat 455 = 0) */
    const ROOT_AND_SNARE_RESISTANCE_USE: Array<[number, number, number]> = [
      [455, 0, 0],
      [0, 0, 42],
    ];

    function nanoWith(name: string, aoid: number, use: Array<[number, number, number]>) {
      return { ...alleysweeper, id: aoid, aoid, name, actions: [createNanoUseAction(use, aoid)] };
    }

    /** A Trader with BM and TS raised to the given values */
    async function activateTrader(bioMetamor: number, timeSpace: number) {
      const profile = createTestProfile({
        name: `Trader ${bioMetamor}-${timeSpace}`,
        profession: PROFESSION.TRADER,
        level: 60,
        skills: {
          [SKILL_ID.BIO_METAMOR]: createTestSkillData({ pointsFromIp: 0 }),
          [SKILL_ID.TIME_SPACE]: createTestSkillData({ pointsFromIp: 0 }),
        },
      });
      const profileId = await profileStore.createProfile(profile.Character.Name, profile);
      await profileStore.modifySkill(profileId, SKILL_ID.BIO_METAMOR, bioMetamor);
      await profileStore.modifySkill(profileId, SKILL_ID.TIME_SPACE, timeSpace);
      await profileStore.setActiveProfile(profileId);
    }

    it('leaves a nano unverified, not blocked, when only a running nano decides it', async () => {
      await activateProfile(PROFESSION.SOLDIER, 60, 10, 10);
      const nano = nanoWith('Access Notum Source', 227302, ACCESS_NOTUM_SOURCE_USE);

      const info = getNanoCompatibility(nano, mapProfileToStats(activeProfile()));

      expect(info).toMatchObject({
        castState: 'unverified',
        canCast: true,
        compatibilityScore: 100,
        unmetRequirements: [],
        unverifiedRequirements: ['Not running: Nano 209909'],
      });
    });

    it('checks the caster and leaves a requirement on the target unverified', async () => {
      const nano = nanoWith('Average Health Funnel', 76727, AVERAGE_HEALTH_FUNNEL_USE);

      await activateTrader(200, 200);
      const skilled = getNanoCompatibility(nano, mapProfileToStats(activeProfile()));
      expect(skilled.castState).toBe('unverified');
      expect(skilled.unverifiedRequirements).toEqual(['Target: MaxHealth ≥ 43']);

      // Short of TS, the caster's own requirement blocks it, whatever the target
      await activateTrader(200, 10);
      const unskilled = getNanoCompatibility(nano, mapProfileToStats(activeProfile()));
      expect(unskilled.castState).toBe('blocked');
      expect(unskilled.unmetRequirements.map((req) => req.stat)).toEqual([SKILL_ID.TIME_SPACE]);
      expect(unskilled.unverifiedRequirements).toEqual([]);
    });

    it('blocks an NPC-only nano, saying why', async () => {
      await activateProfile(PROFESSION.SOLDIER, 60, 10, 10);
      const nano = nanoWith('Mezz', 223444, MEZZ_USE);

      const info = getNanoCompatibility(nano, mapProfileToStats(activeProfile()));

      expect(info.castState).toBe('blocked');
      expect(info.unmetRequirements).toEqual([
        expect.objectContaining({ description: 'Must be NPC' }),
      ]);
    });

    it('reports the requirement a NOT fails on', async () => {
      await activateProfile(PROFESSION.SOLDIER, 60, 10, 10);
      const nano = nanoWith('Root and Snare Resistance', 291385, ROOT_AND_SNARE_RESISTANCE_USE);

      const info = getNanoCompatibility(nano, mapProfileToStats(activeProfile()));

      // NOT (stat 455 = 0) fails because stat 455 is 0: it must not be
      expect(info.castState).toBe('blocked');
      expect(info.unmetRequirements).toEqual([
        expect.objectContaining({ stat: 455, operator: '≠', required: 0, current: 0 }),
      ]);
    });

    it('NanoList shows what it could not check', async () => {
      await activateProfile(PROFESSION.SOLDIER, 60, 10, 10);
      const wrapper = mountForIntegration(NanoList, {
        pinia: context.pinia,
        props: {
          nanos: [nanoWith('Access Notum Source', 227302, ACCESS_NOTUM_SOURCE_USE)],
          showCompatibility: true,
          activeProfile: profileStore.activeProfile,
        },
      });
      await waitForUpdates(wrapper);

      expect(wrapper.text()).not.toContain('Cannot Cast');
      expect(wrapper.find('[data-testid="unverified-requirements"]').text()).toContain(
        'Castable if'
      );
      expect(wrapper.text()).toContain('Not running: Nano 209909');

      wrapper.unmount();
    });
  });
});

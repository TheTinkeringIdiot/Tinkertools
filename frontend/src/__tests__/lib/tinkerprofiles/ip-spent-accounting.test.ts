/**
 * Per-skill IP accounting tests
 *
 * The stored SkillData.ipSpent feeds the IP Tracker's per-category and
 * per-skill breakdowns, so it must equal the calculator's cumulative cost for
 * the skill's pointsFromIp (AO charges more per point as the skill rises) and
 * add up to the tracker's recomputed totals.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  modifySkill,
  modifyAbility,
  recalculateProfileIP,
} from '@/lib/tinkerprofiles/ip-integrator';
import {
  calcTotalSkillCost,
  calcTotalAbilityCost,
  ABILITY_NAMES,
  ABILITY_INDEX_TO_STAT_ID,
} from '@/lib/tinkerprofiles/ip-calculator';
import { createDefaultProfile } from '@/lib/tinkerprofiles/constants';
import { SKILL_COST_FACTORS } from '@/services/game-data';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import { SKILL_ID, PROFESSION } from '@/__tests__/helpers';

const BLUNT_1H = SKILL_ID['1H_BLUNT'];
const AGILITY = SKILL_ID.AGILITY;

function sumValues(record: Record<string, number>): number {
  return Object.values(record).reduce((sum, value) => sum + value, 0);
}

function sumTrainableIpSpent(profile: TinkerProfile): number {
  return Object.entries(profile.skills)
    .filter(([id]) => SKILL_COST_FACTORS[Number(id)] !== undefined)
    .reduce((sum, [, skill]) => sum + (skill.ipSpent || 0), 0);
}

function raiseSkill(profile: TinkerProfile, skillId: number, newValue: number): TinkerProfile {
  const result = modifySkill(profile, skillId, newValue);
  expect(result.error).toBeUndefined();
  expect(result.success).toBe(true);
  return result.updatedProfile as TinkerProfile;
}

function raiseAbility(profile: TinkerProfile, abilityId: number, newValue: number): TinkerProfile {
  const result = modifyAbility(profile, abilityId, newValue);
  expect(result.error).toBeUndefined();
  expect(result.success).toBe(true);
  return result.updatedProfile as TinkerProfile;
}

describe('IP Integrator - per-skill ipSpent accounting', () => {
  let profile: TinkerProfile;
  let profession: number;
  let breed: number;

  beforeEach(() => {
    profile = createDefaultProfile('Accounting Test', 'Solitus');
    profile.Character.Level = 200;
    profile.Character.Profession = PROFESSION.ADVENTURER;
    // Raise every ability except Agility so skill caps leave room to train
    for (const statId of ABILITY_INDEX_TO_STAT_ID) {
      if (statId !== AGILITY) profile.skills[statId].pointsFromIp = 150;
    }
    profile = recalculateProfileIP(profile);
    profession = profile.Character.Profession;
    breed = profile.Character.Breed;
  });

  function skillStart(p: TinkerProfile): number {
    return p.skills[BLUNT_1H].total;
  }

  describe('modifySkill', () => {
    it('records the cumulative cost when raising several points in one call', () => {
      const start = skillStart(profile);
      const updated = raiseSkill(profile, BLUNT_1H, start + 40);

      expect(updated.skills[BLUNT_1H].pointsFromIp).toBe(40);
      expect(updated.skills[BLUNT_1H].ipSpent).toBe(calcTotalSkillCost(40, profession, BLUNT_1H));
    });

    it('records the same cost when raising one point per call', () => {
      const start = skillStart(profile);
      let updated = profile;
      for (let i = 1; i <= 40; i++) {
        updated = raiseSkill(updated, BLUNT_1H, start + i);
      }

      expect(updated.skills[BLUNT_1H].ipSpent).toBe(calcTotalSkillCost(40, profession, BLUNT_1H));
    });

    it('refunds the cost of the points removed when lowering a skill', () => {
      const start = skillStart(profile);
      const raised = raiseSkill(profile, BLUNT_1H, start + 40);
      const lowered = raiseSkill(raised, BLUNT_1H, start + 15);

      expect(lowered.skills[BLUNT_1H].pointsFromIp).toBe(15);
      expect(lowered.skills[BLUNT_1H].ipSpent).toBe(calcTotalSkillCost(15, profession, BLUNT_1H));
      expect(lowered.IPTracker?.remaining).toBe(
        (raised.IPTracker?.remaining ?? 0) +
          calcTotalSkillCost(40, profession, BLUNT_1H) -
          calcTotalSkillCost(15, profession, BLUNT_1H)
      );
    });

    it('rejects a raise the remaining IP cannot pay for at the real per-point cost', () => {
      const start = skillStart(profile);
      const realCost = calcTotalSkillCost(40, profession, BLUNT_1H);
      const firstPointCost = calcTotalSkillCost(1, profession, BLUNT_1H);
      expect(firstPointCost * 40).toBeLessThan(realCost);

      const poor = JSON.parse(JSON.stringify(profile)) as TinkerProfile;
      if (!poor.IPTracker) throw new Error('profile has no IPTracker');
      poor.IPTracker.remaining = realCost - 1;

      const result = modifySkill(poor, BLUNT_1H, start + 40);
      expect(result.success).toBe(false);
      expect(result.error).toContain(`need ${realCost}`);
    });
  });

  describe('modifyAbility', () => {
    it('records the cumulative cost when raising an ability', () => {
      const start = profile.skills[AGILITY].total;
      let updated = raiseAbility(profile, AGILITY, start + 20);
      for (let i = 21; i <= 30; i++) {
        updated = raiseAbility(updated, AGILITY, start + i);
      }

      expect(updated.skills[AGILITY].pointsFromIp).toBe(30);
      expect(updated.skills[AGILITY].ipSpent).toBe(calcTotalAbilityCost(30, breed, AGILITY));

      const lowered = raiseAbility(updated, AGILITY, start + 12);
      expect(lowered.skills[AGILITY].ipSpent).toBe(calcTotalAbilityCost(12, breed, AGILITY));
    });
  });

  describe('IPTracker consistency', () => {
    function expectConsistent(p: TinkerProfile): void {
      const tracker = p.IPTracker;
      if (!tracker?.breakdown) throw new Error('profile has no IP breakdown');

      // Per-skill ipSpent, per-category breakdown and recomputed totals all agree
      expect(sumTrainableIpSpent(p)).toBe(tracker.skillIP);
      expect(sumValues(tracker.breakdown.skillCategories)).toBe(tracker.skillIP);
      expect(sumValues(tracker.breakdown.abilities)).toBe(tracker.abilityIP);

      // Ability breakdown entries are labelled with the ability they cost
      ABILITY_INDEX_TO_STAT_ID.forEach((statId, index) => {
        expect(tracker.breakdown?.abilities[ABILITY_NAMES[index]]).toBe(
          calcTotalAbilityCost(p.skills[statId].pointsFromIp, p.Character.Breed, statId)
        );
      });
    }

    it('keeps the breakdown in step with the totals after edits', () => {
      const start = skillStart(profile);
      let updated = raiseSkill(profile, BLUNT_1H, start + 40);
      updated = raiseSkill(updated, BLUNT_1H, start + 41);
      updated = raiseSkill(updated, BLUNT_1H, start + 25);
      updated = raiseAbility(updated, AGILITY, updated.skills[AGILITY].total + 15);

      expect(updated.IPTracker?.skillIP).toBe(calcTotalSkillCost(25, profession, BLUNT_1H));
      expectConsistent(updated);
    });

    it('derives ipSpent for profiles whose points were set without it (e.g. imports)', () => {
      const imported = JSON.parse(JSON.stringify(profile)) as TinkerProfile;
      imported.skills[BLUNT_1H].pointsFromIp = 60;
      imported.skills[BLUNT_1H].ipSpent = 0;
      imported.skills[AGILITY].pointsFromIp = 20;
      imported.skills[AGILITY].ipSpent = 0;

      const recalculated = recalculateProfileIP(imported);

      expect(recalculated.skills[BLUNT_1H].ipSpent).toBe(
        calcTotalSkillCost(60, profession, BLUNT_1H)
      );
      expect(recalculated.skills[AGILITY].ipSpent).toBe(calcTotalAbilityCost(20, breed, AGILITY));
      expectConsistent(recalculated);
    });
  });
});

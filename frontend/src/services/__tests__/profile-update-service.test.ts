/**
 * Tests for character metadata changes (breed / profession) on v4 profiles
 */

import { describe, it, expect } from 'vitest';
import { updateCharacterMetadata } from '../profile-update-service';
import { createDefaultProfile } from '../../lib/tinkerprofiles/constants';
import { updateProfileWithIPTracking } from '../../lib/tinkerprofiles/ip-integrator';
import {
  calcTotalAbilityCost,
  calcTotalSkillCost,
  getBreedInitValue,
} from '../../lib/tinkerprofiles/ip-calculator';

const STRENGTH = 16;
const BODY_DEV = 152;
const SOLITUS = 1;
const ATROX = 4;
const ADVENTURER = 6;
const SOLDIER = 1;

function levelledProfile() {
  const profile = createDefaultProfile('Tester', 'Solitus');
  profile.Character.Level = 100;
  profile.skills[STRENGTH].pointsFromIp = 50;
  profile.skills[STRENGTH].ipSpent = calcTotalAbilityCost(50, SOLITUS, STRENGTH);
  profile.skills[BODY_DEV].pointsFromIp = 40;
  profile.skills[BODY_DEV].ipSpent = calcTotalSkillCost(40, ADVENTURER, BODY_DEV);
  return updateProfileWithIPTracking(profile);
}

describe('updateCharacterMetadata', () => {
  it('changes breed, keeping ability investment and repricing it', async () => {
    const result = await updateCharacterMetadata(levelledProfile(), { breed: 'Atrox' });

    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);

    const strength = result.updatedProfile!.skills[STRENGTH];
    expect(result.updatedProfile!.Character.Breed).toBe(ATROX);
    expect(strength.pointsFromIp).toBe(50);
    expect(strength.base).toBe(getBreedInitValue(ATROX, STRENGTH));
    expect(strength.ipSpent).toBe(calcTotalAbilityCost(50, ATROX, STRENGTH));
  });

  it('changes profession, repricing skill IP', async () => {
    const result = await updateCharacterMetadata(levelledProfile(), { profession: 'Soldier' });

    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);

    const bodyDev = result.updatedProfile!.skills[BODY_DEV];
    expect(result.updatedProfile!.Character.Profession).toBe(SOLDIER);
    expect(bodyDev.pointsFromIp).toBe(40);
    expect(bodyDev.ipSpent).toBe(calcTotalSkillCost(40, SOLDIER, BODY_DEV));
  });
});

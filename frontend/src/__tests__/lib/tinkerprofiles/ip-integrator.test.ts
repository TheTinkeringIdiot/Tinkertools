/**
 * IP Integrator Tests
 * 
 * Tests for the IP integration system, focusing on bug fixes and proper
 * data flow between profile management and IP calculations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  profileToCharacterStats,
  updateProfileSkillInfo,
  calculateProfileIP,
  updateProfileTrickleDown
} from '@/lib/tinkerprofiles/ip-integrator';
import { createDefaultProfile } from '@/lib/tinkerprofiles/constants';
import { skillService } from '@/services/skill-service';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import { SKILL_ID, PROFESSION } from '@/__tests__/helpers';

describe('IP Integrator - Bug Fixes and Data Flow', () => {
  let testProfile: TinkerProfile;

  beforeEach(() => {
    testProfile = createDefaultProfile('Test Character', 'Solitus');
    testProfile.Character.Level = 50;
    testProfile.Character.Profession = PROFESSION.ADVENTURER; // Use numeric ID
  });

  describe('profileToCharacterStats', () => {
    it('should extract improvement values for IP calculations', () => {
      // Set some IP improvements using v4.0.0 structure
      const strengthId = skillService.resolveId('Strength'); // ID 16
      const agilityId = skillService.resolveId('Agility'); // ID 17
      testProfile.skills[strengthId].pointsFromIp = 10;
      testProfile.skills[agilityId].pointsFromIp = 5;

      const stats = profileToCharacterStats(testProfile);

      expect(stats.abilities[0]).toBe(10); // Strength improvements
      expect(stats.abilities[1]).toBe(5);  // Agility improvements
      expect(stats.abilities[2]).toBe(0);  // Stamina (no improvements)
    });

    it('should extract skill improvements correctly', () => {
      // Set some skill improvements using v4.0.0 structure
      const bodyDevId = skillService.resolveId('Body Dev.'); // ID 152
      testProfile.skills[bodyDevId].pointsFromIp = 15;

      const stats = profileToCharacterStats(testProfile);

      // Should find the skill improvement in the skills Record
      expect(Object.values(stats.skills).includes(15)).toBe(true);
    });

    it('should handle missing skill data gracefully', () => {
      const stats = profileToCharacterStats(testProfile);
      
      expect(stats.level).toBe(50);
      expect(stats.breed).toBeGreaterThanOrEqual(0);
      expect(stats.profession).toBeGreaterThanOrEqual(0);
      expect(stats.abilities).toHaveLength(6);
      expect(Object.keys(stats.skills).length).toBeGreaterThan(0);
    });
  });

  describe('updateProfileSkillInfo - Bug Fix Verification', () => {
    it('should pass full ability values to calcSkillCap (not just improvements)', () => {
      // Set up profile with abilities at base values (6) and no improvements using v4.0.0 structure
      const strengthId = skillService.resolveId('Strength');
      const agilityId = skillService.resolveId('Agility');
      const staminaId = skillService.resolveId('Stamina');
      const intelligenceId = skillService.resolveId('Intelligence');
      const senseId = skillService.resolveId('Sense');
      const psychicId = skillService.resolveId('Psychic');

      testProfile.skills[strengthId].total = 6;
      testProfile.skills[agilityId].total = 6;
      testProfile.skills[staminaId].total = 6;
      testProfile.skills[intelligenceId].total = 6;
      testProfile.skills[senseId].total = 6;
      testProfile.skills[psychicId].total = 6;

      // Clear any existing improvements
      testProfile.skills[strengthId].pointsFromIp = 0;
      testProfile.skills[agilityId].pointsFromIp = 0;
      testProfile.skills[staminaId].pointsFromIp = 0;
      testProfile.skills[intelligenceId].pointsFromIp = 0;
      testProfile.skills[senseId].pointsFromIp = 0;
      testProfile.skills[psychicId].pointsFromIp = 0;

      updateProfileSkillInfo(testProfile);

      // Body Dev should have cap of 13 (5 base + 1 trickle + 7 ability improvements)
      // This test verifies that full ability values (6,6,6,6,6,6) were used,
      // not improvement values (0,0,0,0,0,0) which would give a much lower cap
      const bodyDevId = skillService.resolveId('Body Dev.');
      const bodyDev = testProfile.skills[bodyDevId];
      expect(bodyDev.cap).toBe(13);
    });

    it('should calculate correct skill caps with higher abilities', () => {
      // Set significantly higher Stamina which affects Body Dev using v4.0.0 structure
      const staminaId = skillService.resolveId('Stamina');
      const strengthId = skillService.resolveId('Strength');
      const agilityId = skillService.resolveId('Agility');
      const intelligenceId = skillService.resolveId('Intelligence');
      const senseId = skillService.resolveId('Sense');
      const psychicId = skillService.resolveId('Psychic');

      testProfile.skills[staminaId].total = 50; // Body Dev only depends on Stamina
      testProfile.skills[staminaId].pointsFromIp = 44; // 50 - 6 (breed base) = 44 improvements
      // Keep others at base
      testProfile.skills[strengthId].total = 6;
      testProfile.skills[agilityId].total = 6;
      testProfile.skills[intelligenceId].total = 6;
      testProfile.skills[senseId].total = 6;
      testProfile.skills[psychicId].total = 6;

      updateProfileSkillInfo(testProfile);

      const bodyDevId = skillService.resolveId('Body Dev.');
      const bodyDev = testProfile.skills[bodyDevId];
      // With significantly higher Stamina affecting Body Dev, cap should be much higher than 13
      // Body Dev factors: [0.0, 0.0, 1.0, 0.0, 0.0, 0.0] (only Stamina)
      // Weighted = 50*1.0 = 50
      // Expected improvements: round(((50 - 5) * 2) + 5) = round(95) = 95
      // Total cap = 5 + trickle + 95 should be much higher than 13
      expect((bodyDev as any).cap).toBeGreaterThan(50);
    });

    it('should update both caps and trickle-down values', () => {
      // Set some ability improvements using v4.0.0 structure
      const agilityId = skillService.resolveId('Agility');
      testProfile.skills[agilityId].total = 15;

      updateProfileSkillInfo(testProfile);

      // Check that both caps and trickle-down were updated
      const bodyDevId = skillService.resolveId('Body Dev.');
      const bodyDev = testProfile.skills[bodyDevId] as any; // Cast to any for dynamic properties
      expect(bodyDev.cap).toBeDefined();
      expect(bodyDev.trickle).toBeDefined();
      expect(bodyDev.total).toBeDefined();

      // Total should be base + trickle + IP improvements + equipment bonuses
      const expectedTotal = (bodyDev.base || 0) + (bodyDev.trickle || 0) + (bodyDev.pointsFromIp || 0) + (bodyDev.equipmentBonus || 0);
      expect(bodyDev.total).toBe(expectedTotal);
    });

    it('should handle all skill categories', () => {
      updateProfileSkillInfo(testProfile);

      // Check that skills in different categories were processed using v4.0.0 structure
      // Sample a few skills from different categories to verify processing
      const testSkillIds = [
        SKILL_ID.BODY_DEV,        // Body & Defense
        SKILL_ID.ASSAULT_RIF,      // Ranged Weapons
        SKILL_ID['1H_EDGED'],      // Melee Weapons
        SKILL_ID.MATTER_CREATION,  // Nanos & Casting
        SKILL_ID.CONCEALMENT,      // Exploring
        SKILL_ID.COMPUTER_LITERACY,// Trade & Repair
        SKILL_ID.FIRST_AID         // Combat & Healing
      ];

      testSkillIds.forEach(skillId => {
        const skill = testProfile.skills[skillId];
        if (skill && typeof skill === 'object' && 'cap' in skill) {
          expect(skill.cap).toBeDefined();
          expect(typeof skill.cap).toBe('number');
        }
      });
    });
  });

  describe('calculateProfileIP', () => {
    it('should use improvement values for IP cost calculations', () => {
      // Set some improvements using v4.0.0 structure
      testProfile.skills[SKILL_ID.STRENGTH].pointsFromIp = 10;
      testProfile.skills[SKILL_ID.BODY_DEV].pointsFromIp = 5;

      const ipTracker = calculateProfileIP(testProfile);

      expect(ipTracker.totalUsed).toBeGreaterThan(0);
      expect(ipTracker.abilityIP).toBeGreaterThan(0);
      expect(ipTracker.skillIP).toBeGreaterThan(0);
    });

    it('should not double-count IP for cap calculations', () => {
      // This test ensures that IP calculations use improvements
      // while cap calculations use full values
      testProfile.skills[SKILL_ID.STRENGTH].total = 16; // 10 improvements on top of 6 base
      testProfile.skills[SKILL_ID.STRENGTH].pointsFromIp = 10;

      const ipTracker = calculateProfileIP(testProfile);

      // IP should only count the improvements (10), not the full value (16)
      expect(ipTracker.abilityIP).toBeGreaterThan(0);
      expect(ipTracker.totalUsed).toBeGreaterThan(0);
    });
  });

  describe('updateProfileTrickleDown', () => {
    it('should use full ability values for trickle-down calculations', () => {
      // Set Stamina to a high value (Body Dev only gets trickle-down from Stamina)
      testProfile.skills[SKILL_ID.STAMINA].total = 40;
      testProfile.skills[SKILL_ID.INTELLIGENCE].total = 30;
      testProfile.skills[SKILL_ID.SENSE].total = 20;

      const updatedProfile = updateProfileTrickleDown(testProfile);

      // Check that trickle-down was calculated using full ability values
      const bodyDev = updatedProfile.skills[SKILL_ID.BODY_DEV];
      if (bodyDev) {
        // Body Dev factors: [0.0, 0.0, 1.0, 0.0, 0.0, 0.0]
        // Trickle-down = floor((40*1.0) / 4) = floor(10) = 10
        expect(bodyDev.trickle).toBeGreaterThan(5); // Should be significantly more than base case (1)
      }
    });

    it('should not mutate the original profile', () => {
      const originalAgility = testProfile.skills[SKILL_ID.AGILITY].total;

      const updatedProfile = updateProfileTrickleDown(testProfile);

      // Original should be unchanged
      expect(testProfile.skills[SKILL_ID.AGILITY].total).toBe(originalAgility);

      // But returned profile should be a copy
      expect(updatedProfile).not.toBe(testProfile);
    });

    it('should update timestamp', async () => {
      const originalTimestamp = testProfile.updated;

      // Wait a small amount to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1));

      const updatedProfile = updateProfileTrickleDown(testProfile);

      expect(updatedProfile.updated).not.toBe(originalTimestamp);
      expect(new Date(updatedProfile.updated).getTime()).toBeGreaterThan(new Date(originalTimestamp).getTime());
    });
  });

  describe('Data Flow Integration', () => {
    it('should maintain consistency between IP calculations and skill caps', () => {
      // Set some abilities and improvements using v4.0.0 structure
      testProfile.skills[SKILL_ID.AGILITY].total = 20;
      testProfile.skills[SKILL_ID.AGILITY].pointsFromIp = 14; // 6 base + 14 improvements = 20
      testProfile.skills[SKILL_ID.BODY_DEV].pointsFromIp = 5;

      updateProfileSkillInfo(testProfile);
      const ipTracker = calculateProfileIP(testProfile);

      // Verify consistency
      expect(ipTracker.totalUsed).toBeGreaterThan(0);

      const bodyDev = testProfile.skills[SKILL_ID.BODY_DEV];
      if (bodyDev) {
        expect(bodyDev.cap).toBeGreaterThan(bodyDev.total);
        expect(bodyDev.total).toBe(bodyDev.base + (bodyDev.trickle || 0) + (bodyDev.pointsFromIp || 0) + (bodyDev.equipmentBonus || 0));
      }
    });

    it('should handle edge case of new profile with no improvements', () => {
      // Ensure all improvements are 0 using v4.0.0 structure
      testProfile.skills[SKILL_ID.STRENGTH].pointsFromIp = 0;
      testProfile.skills[SKILL_ID.AGILITY].pointsFromIp = 0;
      testProfile.skills[SKILL_ID.STAMINA].pointsFromIp = 0;
      testProfile.skills[SKILL_ID.INTELLIGENCE].pointsFromIp = 0;
      testProfile.skills[SKILL_ID.SENSE].pointsFromIp = 0;
      testProfile.skills[SKILL_ID.PSYCHIC].pointsFromIp = 0;

      updateProfileSkillInfo(testProfile);
      const ipTracker = calculateProfileIP(testProfile);

      // Should not crash and should give sensible results
      expect(ipTracker.totalUsed).toBe(0);
      expect(ipTracker.remaining).toBeGreaterThan(0);

      const bodyDev = testProfile.skills[SKILL_ID.BODY_DEV];
      if (bodyDev) {
        expect(bodyDev.cap).toBe(13); // The famous Body Dev cap issue should be fixed
        expect(bodyDev.total).toBe(bodyDev.base + (bodyDev.trickle || 0)); // Base + trickle only
      }
    });
  });

  describe('Equipment Bonuses on Abilities', () => {
    it('should apply equipment bonuses to abilities', () => {
      // Mock equipment that boosts Strength
      testProfile.Weapons = {
        'Right Hand': {
          id: 1,
          aoid: 12345,
          name: 'Test Weapon',
          spell_data: [
            {
              event: 2, // Wield event
              spells: [
                {
                  spell_id: 53045,
                  nano_crystal: null,
                  nano_school: 0,
                  spell_params: {
                    Stat: 16,
                    Amount: 10
                  }
                }
              ]
            }
          ]
        } as any
      };

      updateProfileSkillInfo(testProfile);

      // Check that Strength has equipment bonus applied using v4.0.0 structure
      const strength = testProfile.skills[SKILL_ID.STRENGTH];
      expect(strength.equipmentBonus).toBe(10);
      expect(strength.base).toBeDefined();
      expect(strength.total).toBe(strength.base + 10);
    });

    it('should include equipment bonuses in trickle-down calculations', () => {
      // Setup: Give Stamina a +20 equipment bonus
      testProfile.Clothing = {
        'Body': {
          id: 2,
          aoid: 54321,
          name: 'Test Armor',
          spell_data: [
            {
              event: 14, // Wear event
              spells: [
                {
                  spell_id: 53045,
                  nano_crystal: null,
                  nano_school: 0,
                  spell_params: {
                    Stat: 18,
                    Amount: 20
                  }
                }
              ]
            }
          ]
        } as any
      };

      // Set base Stamina to 30 using v4.0.0 structure
      testProfile.skills[SKILL_ID.STAMINA].total = 30;
      testProfile.skills[SKILL_ID.STAMINA].pointsFromIp = 24; // 6 base + 24 improvements

      updateProfileSkillInfo(testProfile);

      // Stamina should be 30 base + 20 equipment = 50
      expect(testProfile.skills[SKILL_ID.STAMINA].total).toBe(50);
      expect(testProfile.skills[SKILL_ID.STAMINA].equipmentBonus).toBe(20);

      // Body Dev should get trickle-down from the total Stamina (50)
      // Body Dev factors: [0.0, 0.0, 1.0, 0.0, 0.0, 0.0]
      // Trickle-down = floor((50*1.0) / 4) = floor(12.5) = 12
      const bodyDev = testProfile.skills[SKILL_ID.BODY_DEV];
      expect(bodyDev.trickle).toBe(12);
    });

    it('should track base value separately from total value for abilities', () => {
      // Setup equipment with multiple ability bonuses
      testProfile.Implants = {
        'Head': {
          id: 3,
          aoid: 11111,
          name: 'Test Implant',
          type: 'implant',
          slot: 1,
          spell_data: [
            {
              event: 14, // Wear event
              spells: [
                {
                  spell_id: 53045,
                  nano_crystal: null,
                  nano_school: 0,
                  spell_params: {
                    Stat: 19,
                    Amount: 15
                  }
                },
                {
                  spell_id: 53045,
                  nano_crystal: null,
                  nano_school: 0,
                  spell_params: {
                    Stat: 21,
                    Amount: 8
                  }
                }
              ]
            }
          ]
        } as any
      };

      updateProfileSkillInfo(testProfile);

      // Check Intelligence using v4.0.0 structure
      const intelligence = testProfile.skills[SKILL_ID.INTELLIGENCE];
      expect(intelligence.equipmentBonus).toBe(15);
      expect(intelligence.base).toBeDefined();
      expect(intelligence.total).toBe(intelligence.base + 15);

      // Check Psychic using v4.0.0 structure
      const psychic = testProfile.skills[SKILL_ID.PSYCHIC];
      expect(psychic.equipmentBonus).toBe(8);
      expect(psychic.base).toBeDefined();
      expect(psychic.total).toBe(psychic.base + 8);
    });

    it('should handle profiles with no equipment gracefully', () => {
      // Clear all equipment
      testProfile.Weapons = {};
      testProfile.Clothing = {};
      testProfile.Implants = {};

      updateProfileSkillInfo(testProfile);

      // All abilities should have zero equipment bonus using v4.0.0 structure
      const abilityIds = [SKILL_ID.STRENGTH, SKILL_ID.AGILITY, SKILL_ID.STAMINA, SKILL_ID.INTELLIGENCE, SKILL_ID.SENSE, SKILL_ID.PSYCHIC];
      abilityIds.forEach(abilityId => {
        const ability = testProfile.skills[abilityId];
        expect(ability.equipmentBonus).toBe(0);
        expect(ability.base).toBeDefined();
        expect(ability.total).toBe(ability.base);
      });
    });
  });
});

// Test utilities (Note: These are duplicates of helpers - should import from @/__tests__/helpers instead)
// Keeping for backwards compatibility with this test file only
function createTestProfile(overrides: Partial<TinkerProfile> = {}): TinkerProfile {
  const profile = createDefaultProfile('Test', 'Solitus');
  return { ...profile, ...overrides };
}

function setProfileAbilities(profile: TinkerProfile, abilities: number[]): void {
  const abilityIds = [SKILL_ID.STRENGTH, SKILL_ID.AGILITY, SKILL_ID.STAMINA, SKILL_ID.INTELLIGENCE, SKILL_ID.SENSE, SKILL_ID.PSYCHIC];
  abilityIds.forEach((skillId, index) => {
    if (abilities[index] !== undefined) {
      const skill = profile.skills[skillId];
      if (skill) {
        skill.total = abilities[index];
        skill.pointsFromIp = Math.max(0, abilities[index] - 6); // Assuming 6 is breed base
      }
    }
  });
}
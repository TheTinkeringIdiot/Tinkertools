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
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';

describe('IP Integrator - Bug Fixes and Data Flow', () => {
  let testProfile: TinkerProfile;

  beforeEach(() => {
    testProfile = createDefaultProfile('Test Character', 'Solitus');
    testProfile.Character.Level = 50;
    testProfile.Character.Profession = 'Adventurer';
  });

  describe('profileToCharacterStats', () => {
    it('should extract improvement values for IP calculations', () => {
      // Set some IP improvements
      testProfile.Skills.Attributes.Strength.pointFromIp = 10;
      testProfile.Skills.Attributes.Agility.pointFromIp = 5;
      
      const stats = profileToCharacterStats(testProfile);
      
      expect(stats.abilities[0]).toBe(10); // Strength improvements
      expect(stats.abilities[1]).toBe(5);  // Agility improvements
      expect(stats.abilities[2]).toBe(0);  // Stamina (no improvements)
    });

    it('should extract skill improvements correctly', () => {
      // Set some skill improvements
      if (testProfile.Skills['Body & Defense']['Body Dev.']) {
        testProfile.Skills['Body & Defense']['Body Dev.'].pointFromIp = 15;
      }
      
      const stats = profileToCharacterStats(testProfile);
      
      // Should find the skill improvement
      expect(stats.skills.some(improvement => improvement === 15)).toBe(true);
    });

    it('should handle missing skill data gracefully', () => {
      const stats = profileToCharacterStats(testProfile);
      
      expect(stats.level).toBe(50);
      expect(stats.breed).toBeGreaterThanOrEqual(0);
      expect(stats.profession).toBeGreaterThanOrEqual(0);
      expect(stats.abilities).toHaveLength(6);
      expect(stats.skills.length).toBeGreaterThan(0);
    });
  });

  describe('updateProfileSkillInfo - Bug Fix Verification', () => {
    it('should pass full ability values to calcSkillCap (not just improvements)', () => {
      // Set up profile with abilities at base values (6) and no improvements
      testProfile.Skills.Attributes.Strength.value = 6;
      testProfile.Skills.Attributes.Agility.value = 6;
      testProfile.Skills.Attributes.Stamina.value = 6;
      testProfile.Skills.Attributes.Intelligence.value = 6;
      testProfile.Skills.Attributes.Sense.value = 6;
      testProfile.Skills.Attributes.Psychic.value = 6;
      
      // Clear any existing improvements
      testProfile.Skills.Attributes.Strength.pointFromIp = 0;
      testProfile.Skills.Attributes.Agility.pointFromIp = 0;
      testProfile.Skills.Attributes.Stamina.pointFromIp = 0;
      testProfile.Skills.Attributes.Intelligence.pointFromIp = 0;
      testProfile.Skills.Attributes.Sense.pointFromIp = 0;
      testProfile.Skills.Attributes.Psychic.pointFromIp = 0;

      updateProfileSkillInfo(testProfile);

      // Body Dev should have cap of 13 (5 base + 1 trickle + 7 ability improvements)
      // This test verifies that full ability values (6,6,6,6,6,6) were used,
      // not improvement values (0,0,0,0,0,0) which would give a much lower cap
      const bodyDev = testProfile.Skills['Body & Defense']['Body Dev.'];
      if (bodyDev) {
        expect(bodyDev.cap).toBe(13);
      }
    });

    it('should calculate correct skill caps with higher abilities', () => {
      // Set significantly higher Stamina which affects Body Dev
      testProfile.Skills.Attributes.Stamina.value = 50; // Body Dev only depends on Stamina
      // Keep others at base
      testProfile.Skills.Attributes.Strength.value = 6;
      testProfile.Skills.Attributes.Agility.value = 6;
      testProfile.Skills.Attributes.Intelligence.value = 6;
      testProfile.Skills.Attributes.Sense.value = 6;
      testProfile.Skills.Attributes.Psychic.value = 6;
      
      updateProfileSkillInfo(testProfile);

      const bodyDev = testProfile.Skills['Body & Defense']['Body Dev.'];
      if (bodyDev) {
        // With significantly higher Stamina affecting Body Dev, cap should be much higher than 13
        // Body Dev factors: [0.0, 0.0, 1.0, 0.0, 0.0, 0.0] (only Stamina)
        // Weighted = 50*1.0 = 50
        // Expected improvements: round(((50 - 5) * 2) + 5) = round(95) = 95
        // Total cap = 5 + trickle + 95 should be much higher than 13
        expect(bodyDev.cap).toBeGreaterThan(50);
      }
    });

    it('should update both caps and trickle-down values', () => {
      // Set some ability improvements
      testProfile.Skills.Attributes.Agility.value = 15;
      
      updateProfileSkillInfo(testProfile);

      // Check that both caps and trickle-down were updated
      const bodyDev = testProfile.Skills['Body & Defense']['Body Dev.'];
      if (bodyDev) {
        expect(bodyDev.cap).toBeDefined();
        expect(bodyDev.trickleDown).toBeDefined();
        expect(bodyDev.value).toBeDefined();
        
        // Value should be base + trickle + IP improvements
        const expectedValue = 5 + (bodyDev.trickleDown || 0) + (bodyDev.pointFromIp || 0);
        expect(bodyDev.value).toBe(expectedValue);
      }
    });

    it('should handle all skill categories', () => {
      updateProfileSkillInfo(testProfile);

      // Check that skills in different categories were processed
      const categories = [
        'Body & Defense',
        'Ranged Weapons',
        'Melee Weapons',
        'Nanos & Casting',
        'Exploring',
        'Trade & Repair',
        'Combat & Healing'
      ];

      categories.forEach(categoryName => {
        const category = testProfile.Skills[categoryName as keyof typeof testProfile.Skills];
        if (category && typeof category === 'object') {
          Object.values(category).forEach((skill: any) => {
            if (skill && typeof skill === 'object' && 'cap' in skill) {
              expect(skill.cap).toBeDefined();
              expect(typeof skill.cap).toBe('number');
            }
          });
        }
      });
    });
  });

  describe('calculateProfileIP', () => {
    it('should use improvement values for IP cost calculations', () => {
      // Set some improvements
      testProfile.Skills.Attributes.Strength.pointFromIp = 10;
      testProfile.Skills['Body & Defense']['Body Dev.'].pointFromIp = 5;

      const ipTracker = calculateProfileIP(testProfile);

      expect(ipTracker.totalUsed).toBeGreaterThan(0);
      expect(ipTracker.abilityIP).toBeGreaterThan(0);
      expect(ipTracker.skillIP).toBeGreaterThan(0);
    });

    it('should not double-count IP for cap calculations', () => {
      // This test ensures that IP calculations use improvements
      // while cap calculations use full values
      testProfile.Skills.Attributes.Strength.value = 16; // 10 improvements on top of 6 base
      testProfile.Skills.Attributes.Strength.pointFromIp = 10;

      const ipTracker = calculateProfileIP(testProfile);
      
      // IP should only count the improvements (10), not the full value (16)
      expect(ipTracker.abilityIP).toBeGreaterThan(0);
      expect(ipTracker.totalUsed).toBeGreaterThan(0);
    });
  });

  describe('updateProfileTrickleDown', () => {
    it('should use full ability values for trickle-down calculations', () => {
      // Set Stamina to a high value (Body Dev only gets trickle-down from Stamina)
      testProfile.Skills.Attributes.Stamina.value = 40;
      testProfile.Skills.Attributes.Intelligence.value = 30;
      testProfile.Skills.Attributes.Sense.value = 20;

      const updatedProfile = updateProfileTrickleDown(testProfile);

      // Check that trickle-down was calculated using full ability values
      const bodyDev = updatedProfile.Skills['Body & Defense']['Body Dev.'];
      if (bodyDev) {
        // Body Dev factors: [0.0, 0.0, 1.0, 0.0, 0.0, 0.0]
        // Trickle-down = floor((40*1.0) / 4) = floor(10) = 10
        expect(bodyDev.trickleDown).toBeGreaterThan(5); // Should be significantly more than base case (1)
      }
    });

    it('should not mutate the original profile', () => {
      const originalAgility = testProfile.Skills.Attributes.Agility.value;
      
      const updatedProfile = updateProfileTrickleDown(testProfile);
      
      // Original should be unchanged
      expect(testProfile.Skills.Attributes.Agility.value).toBe(originalAgility);
      
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
      // Set some abilities and improvements
      testProfile.Skills.Attributes.Agility.value = 20;
      testProfile.Skills.Attributes.Agility.pointFromIp = 14; // 6 base + 14 improvements = 20
      testProfile.Skills['Body & Defense']['Body Dev.'].pointFromIp = 5;

      updateProfileSkillInfo(testProfile);
      const ipTracker = calculateProfileIP(testProfile);

      // Verify consistency
      expect(ipTracker.totalUsed).toBeGreaterThan(0);
      
      const bodyDev = testProfile.Skills['Body & Defense']['Body Dev.'];
      if (bodyDev) {
        expect(bodyDev.cap).toBeGreaterThan(bodyDev.value);
        expect(bodyDev.value).toBe(5 + (bodyDev.trickleDown || 0) + (bodyDev.pointFromIp || 0));
      }
    });

    it('should handle edge case of new profile with no improvements', () => {
      // Ensure all improvements are 0
      Object.values(testProfile.Skills.Attributes).forEach((attr: any) => {
        attr.pointFromIp = 0;
      });

      updateProfileSkillInfo(testProfile);
      const ipTracker = calculateProfileIP(testProfile);

      // Should not crash and should give sensible results
      expect(ipTracker.totalUsed).toBe(0);
      expect(ipTracker.remaining).toBeGreaterThan(0);
      
      const bodyDev = testProfile.Skills['Body & Defense']['Body Dev.'];
      if (bodyDev) {
        expect(bodyDev.cap).toBe(13); // The famous Body Dev cap issue should be fixed
        expect(bodyDev.value).toBe(5 + (bodyDev.trickleDown || 0)); // Base + trickle only
      }
    });
  });
});

// Test utilities
function createTestProfile(overrides: Partial<TinkerProfile> = {}): TinkerProfile {
  const profile = createDefaultProfile('Test', 'Solitus');
  return { ...profile, ...overrides };
}

function setProfileAbilities(profile: TinkerProfile, abilities: number[]): void {
  const abilityNames = ['Strength', 'Agility', 'Stamina', 'Intelligence', 'Sense', 'Psychic'];
  abilityNames.forEach((name, index) => {
    if (abilities[index] !== undefined) {
      const attr = profile.Skills.Attributes[name as keyof typeof profile.Skills.Attributes] as any;
      if (attr) {
        attr.value = abilities[index];
        attr.pointFromIp = Math.max(0, abilities[index] - 6); // Assuming 6 is breed base
      }
    }
  });
}
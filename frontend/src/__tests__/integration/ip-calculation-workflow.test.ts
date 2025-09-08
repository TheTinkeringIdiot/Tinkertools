/**
 * IP Calculation Workflow Integration Tests
 * 
 * End-to-end tests that verify the complete workflow from profile creation
 * to IP calculations, skill caps, and UI display.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createDefaultProfile } from '@/lib/tinkerprofiles/constants';
import { 
  updateProfileSkillInfo, 
  calculateProfileIP, 
  updateProfileWithIPTracking
} from '@/lib/tinkerprofiles/ip-integrator';
import { 
  calcSkillCap, 
  calcAbilityCapImprovements,
  calcTrickleDown 
} from '@/lib/tinkerprofiles/ip-calculator';
import { STAT } from '@/services/game-data';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';

describe('IP Calculation Workflow Integration', () => {
  let profile: TinkerProfile;

  beforeEach(() => {
    profile = createDefaultProfile('Test Character', 'Solitus');
    profile.Character.Level = 50;
    profile.Character.Profession = 'Adventurer';
  });

  describe('Complete Workflow - New Profile', () => {
    it('should handle new profile creation to skill cap calculation', () => {
      // 1. Start with fresh profile (all abilities at breed base)
      profile.Skills.Attributes.Strength.value = 6;
      profile.Skills.Attributes.Agility.value = 6;
      profile.Skills.Attributes.Stamina.value = 6;
      profile.Skills.Attributes.Intelligence.value = 6;
      profile.Skills.Attributes.Sense.value = 6;
      profile.Skills.Attributes.Psychic.value = 6;

      // 2. Update skill info (this was the buggy step)
      updateProfileSkillInfo(profile);

      // 3. Verify Body Dev cap is correct (the main bug we fixed)
      const bodyDev = profile.Skills['Body & Defense']['Body Dev.'];
      expect(bodyDev).toBeDefined();
      expect(bodyDev!.cap).toBe(13); // 5 base + 1 trickle + 7 ability improvements

      // 4. Verify IP calculation doesn't count 612 IP (another bug we might have fixed)
      const ipTracker = calculateProfileIP(profile);
      expect(ipTracker.totalUsed).toBe(0); // No improvements made yet
      expect(ipTracker.remaining).toBeGreaterThan(0);
    });

    it('should correctly calculate trickle-down bonuses', () => {
      // Set specific ability values
      profile.Skills.Attributes.Stamina.value = 20; // Body Dev only gets trickle-down from Stamina
      profile.Skills.Attributes.Intelligence.value = 15;
      profile.Skills.Attributes.Sense.value = 12;

      updateProfileSkillInfo(profile);

      const bodyDev = profile.Skills['Body & Defense']['Body Dev.'];
      expect(bodyDev).toBeDefined();
      
      // Verify trickle-down is calculated correctly
      // Body Dev factors: [0.0, 0.0, 1.0, 0.0, 0.0, 0.0] (only Stamina affects it)
      // Abilities: [6, 6, 20, 15, 12, 6] (Str, Agi, Sta, Int, Sen, Psy)
      // Expected: floor((6*0 + 6*0 + 20*1.0 + 15*0 + 12*0 + 6*0) / 4)
      // = floor(20 / 4) = floor(5) = 5
      expect(bodyDev!.trickleDown).toBe(5);
      expect(bodyDev!.value).toBe(10); // 5 base + 5 trickle + 0 IP
    });
  });

  describe('Ability-Limited Scenarios', () => {
    it('should limit skills when abilities are low', () => {
      // All abilities at minimum
      setAllAbilities(profile, 6);
      updateProfileSkillInfo(profile);

      // Test multiple skills that should be ability-limited
      const testSkills = [
        'Body Dev.',
        'Nano Pool',
        'Martial Arts'
      ];

      testSkills.forEach(skillName => {
        const skill = findSkillInProfile(profile, skillName);
        if (skill) {
          expect(skill.cap).toBeDefined();
          expect(skill.cap).toBeLessThan(50); // Should be limited by low abilities
        }
      });
    });

    it('should increase caps when abilities increase', () => {
      // Start with low abilities
      setAllAbilities(profile, 6);
      updateProfileSkillInfo(profile);
      
      const bodyDev1 = profile.Skills['Body & Defense']['Body Dev.'];
      const initialCap = bodyDev1?.cap || 0;

      // Increase Stamina which affects Body Dev caps and trickle-down
      profile.Skills.Attributes.Stamina.value = 30;
      updateProfileSkillInfo(profile);

      const bodyDev2 = profile.Skills['Body & Defense']['Body Dev.'];
      const newCap = bodyDev2?.cap || 0;

      expect(newCap).toBeGreaterThan(initialCap);
    });

    it('should handle level-limited vs ability-limited correctly', () => {
      // High abilities, low level
      setAllAbilities(profile, 50);
      profile.Character.Level = 1;
      updateProfileSkillInfo(profile);

      const bodyDev = profile.Skills['Body & Defense']['Body Dev.'];
      expect(bodyDev).toBeDefined();
      
      // At level 1, should be level-limited, not ability-limited
      // (though the exact calculation depends on level progression formulas)
      expect(bodyDev!.cap).toBeDefined();
      expect(bodyDev!.cap).toBeGreaterThan(13); // Should be higher than ability-limited case
    });
  });

  describe('IP Spending Workflow', () => {
    it('should maintain consistency when spending IP on abilities', () => {
      // 1. Start with base abilities
      setAllAbilities(profile, 6);
      
      // 2. Spend IP on Stamina (affects Body Dev trickle-down)
      profile.Skills.Attributes.Stamina.value = 16;
      profile.Skills.Attributes.Stamina.pointFromIp = 10;

      // 3. Update profile
      updateProfileSkillInfo(profile);
      const ipTracker = calculateProfileIP(profile);

      // 4. Verify consistency
      expect(ipTracker.totalUsed).toBeGreaterThan(0); // Should count IP spent on Stamina
      expect(ipTracker.abilityIP).toBeGreaterThan(0);

      // 5. Verify Body Dev benefits from higher Stamina
      const bodyDev = profile.Skills['Body & Defense']['Body Dev.'];
      expect(bodyDev).toBeDefined();
      expect(bodyDev!.trickleDown).toBeGreaterThan(1); // Should be higher than base case
      expect(bodyDev!.cap).toBeGreaterThan(13); // Should be higher cap too
    });

    it('should handle IP spending on skills correctly', () => {
      // 1. Spend IP on Body Dev directly
      setAllAbilities(profile, 6);
      updateProfileSkillInfo(profile);

      const bodyDev = profile.Skills['Body & Defense']['Body Dev.'];
      if (bodyDev) {
        bodyDev.pointFromIp = 5; // Spend 5 IP improvements
        bodyDev.value = 5 + (bodyDev.trickleDown || 0) + 5; // Recalculate value
      }

      // 2. Verify IP tracking
      const ipTracker = calculateProfileIP(profile);
      expect(ipTracker.skillIP).toBeGreaterThan(0);
      expect(ipTracker.totalUsed).toBeGreaterThan(0);

      // 3. Verify skill doesn't exceed cap
      if (bodyDev) {
        expect(bodyDev.value).toBeLessThanOrEqual(bodyDev.cap);
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle missing skill data gracefully', () => {
      // Remove some skill data
      delete (profile.Skills['Body & Defense'] as any)['Body Dev.'];

      // Should not crash
      expect(() => updateProfileSkillInfo(profile)).not.toThrow();
      expect(() => calculateProfileIP(profile)).not.toThrow();
    });

    it('should handle extreme ability values', () => {
      // Set abilities to extreme values
      setAllAbilities(profile, 200);
      profile.Character.Level = 220;

      expect(() => updateProfileSkillInfo(profile)).not.toThrow();
      
      const bodyDev = profile.Skills['Body & Defense']['Body Dev.'];
      expect(bodyDev).toBeDefined();
      expect(bodyDev!.cap).toBeGreaterThan(100); // Should allow high caps
    });

    it('should handle level 1 characters', () => {
      profile.Character.Level = 1;
      setAllAbilities(profile, 6);

      expect(() => updateProfileSkillInfo(profile)).not.toThrow();
      expect(() => calculateProfileIP(profile)).not.toThrow();

      const ipTracker = calculateProfileIP(profile);
      expect(ipTracker.totalAvailable).toBeGreaterThan(0); // Should have some IP at level 1
    });
  });

  describe('Profile Integration Scenarios', () => {
    it('should work with updateProfileWithIPTracking', () => {
      setAllAbilities(profile, 6);
      
      const updatedProfile = updateProfileWithIPTracking(profile);
      
      expect(updatedProfile.IPTracker).toBeDefined();
      expect(updatedProfile.IPTracker!.totalUsed).toBe(0);
      expect(updatedProfile.IPTracker!.totalAvailable).toBeGreaterThan(0);

      // Skills should have proper caps
      const bodyDev = updatedProfile.Skills['Body & Defense']['Body Dev.'];
      expect(bodyDev?.cap).toBe(13);
    });

    it('should maintain data integrity across multiple updates', () => {
      // Multiple rounds of updates
      setAllAbilities(profile, 6);
      updateProfileSkillInfo(profile);
      
      const firstCap = profile.Skills['Body & Defense']['Body Dev.']?.cap;
      
      // Change Stamina (affects Body Dev) and update again
      profile.Skills.Attributes.Stamina.value = 15;
      updateProfileSkillInfo(profile);
      
      const secondCap = profile.Skills['Body & Defense']['Body Dev.']?.cap;
      
      expect(secondCap).toBeGreaterThan(firstCap || 0);
      
      // IP calculations should still be consistent
      const ipTracker = calculateProfileIP(profile);
      expect(ipTracker.totalUsed).toBe(0); // No IP spent yet
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical Solitus Adventurer build', () => {
      // Typical early-game Solitus Adventurer
      profile.Character.Level = 25;
      profile.Skills.Attributes.Strength.value = 12;
      profile.Skills.Attributes.Agility.value = 15;
      profile.Skills.Attributes.Stamina.value = 18;
      profile.Skills.Attributes.Intelligence.value = 8;
      profile.Skills.Attributes.Sense.value = 10;
      profile.Skills.Attributes.Psychic.value = 6;

      // Set appropriate IP improvements
      profile.Skills.Attributes.Strength.pointFromIp = 6;
      profile.Skills.Attributes.Agility.pointFromIp = 9;
      profile.Skills.Attributes.Stamina.pointFromIp = 12;
      profile.Skills.Attributes.Intelligence.pointFromIp = 2;
      profile.Skills.Attributes.Sense.pointFromIp = 4;

      updateProfileSkillInfo(profile);
      const ipTracker = calculateProfileIP(profile);

      // Verify reasonable results
      expect(ipTracker.totalUsed).toBeGreaterThan(0);
      expect(ipTracker.abilityIP).toBeGreaterThan(0); // IP spent on abilities
      expect(ipTracker.totalAvailable).toBeGreaterThan(ipTracker.totalUsed); // Should have remaining IP

      // Body Dev should have reasonable cap (enhanced by higher Stamina)
      const bodyDev = profile.Skills['Body & Defense']['Body Dev.'];
      expect(bodyDev?.cap).toBeGreaterThan(13); // Should be higher than minimum due to Stamina=18
      expect(bodyDev?.cap).toBeLessThan(50); // But not extremely high
      expect(bodyDev?.trickleDown).toBeGreaterThan(1); // Should get trickle-down from Stamina
    });

    it('should handle high-level character with optimized abilities', () => {
      profile.Character.Level = 150;
      profile.Character.Profession = 'Doctor';
      
      // Optimized for nano casting
      setAllAbilities(profile, 20); // Base level
      profile.Skills.Attributes.Intelligence.value = 80; // Heavily invested
      profile.Skills.Attributes.Psychic.value = 60;
      profile.Skills.Attributes.Intelligence.pointFromIp = 60;
      profile.Skills.Attributes.Psychic.pointFromIp = 40;

      updateProfileSkillInfo(profile);
      const ipTracker = calculateProfileIP(profile);

      // Should be using significant IP (but realistic amount)
      expect(ipTracker.totalUsed).toBeGreaterThan(5000);
      expect(ipTracker.abilityIP).toBeGreaterThan(4000); // Most IP spent on abilities
      expect(ipTracker.totalAvailable).toBeGreaterThan(ipTracker.totalUsed); // Should have some remaining

      // Nano-related skills should have high caps
      const nanoPool = findSkillInProfile(profile, 'Nano Pool');
      if (nanoPool) {
        expect(nanoPool.cap).toBeGreaterThan(100);
      }
    });
  });
});

// Helper functions
function setAllAbilities(profile: TinkerProfile, value: number): void {
  const abilities = ['Strength', 'Agility', 'Stamina', 'Intelligence', 'Sense', 'Psychic'];
  abilities.forEach(ability => {
    const attr = profile.Skills.Attributes[ability as keyof typeof profile.Skills.Attributes] as any;
    if (attr) {
      attr.value = value;
      attr.pointFromIp = Math.max(0, value - 6); // Assuming 6 is breed base
    }
  });
}

function findSkillInProfile(profile: TinkerProfile, skillName: string): any {
  const categories = [
    'Body & Defense',
    'Ranged Weapons', 
    'Ranged Specials',
    'Melee Weapons',
    'Melee Specials',
    'Nanos & Casting',
    'Exploring',
    'Trade & Repair',
    'Combat & Healing'
  ];

  for (const categoryName of categories) {
    const category = profile.Skills[categoryName as keyof typeof profile.Skills];
    if (category && typeof category === 'object') {
      const skill = (category as any)[skillName];
      if (skill) {
        return skill;
      }
    }
  }
  return null;
}

function getStatId(skillName: string): number {
  const statId = Object.keys(STAT).find(key => STAT[key as keyof typeof STAT] === skillName);
  return statId ? parseInt(statId) : 153; // Default to Body Dev
}

// Test data for different character builds
const TEST_BUILDS = {
  FRESH_SOLITUS: {
    breed: 'Solitus',
    level: 1,
    abilities: [6, 6, 6, 6, 6, 6]
  },
  EARLY_ADVENTURER: {
    breed: 'Solitus',
    level: 25,
    abilities: [12, 15, 18, 8, 10, 6]
  },
  HIGH_LEVEL_DOCTOR: {
    breed: 'Nanomage',
    level: 150,
    abilities: [10, 15, 12, 80, 25, 60]
  },
  TWINK_ENFORCER: {
    breed: 'Atrox',
    level: 50,
    abilities: [40, 12, 35, 8, 15, 6]
  }
};
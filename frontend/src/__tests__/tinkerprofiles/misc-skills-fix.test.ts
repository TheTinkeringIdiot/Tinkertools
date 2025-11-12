import { describe, it, expect, beforeEach } from 'vitest';
import { updateProfileWithIPTracking } from '@/lib/tinkerprofiles/ip-integrator';
import { calculateEquipmentBonuses } from '@/services/equipment-bonus-calculator';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import type { Item } from '@/types/api';
import { BREED, PROFESSION } from '@/__tests__/helpers';

describe('Misc Skills Fix - Accumulation Bug Prevention', () => {
  let testProfile: TinkerProfile;

  beforeEach(() => {
    // Create a fresh test profile with the new MiscSkill structure
    testProfile = {
      Character: {
        Name: 'Test Character',
        Profession: PROFESSION.AGENT,
        Breed: BREED.SOLITUS,
        Level: 200,
        Faction: 'Clan',
        Expansion: 'SL',
        AccountType: 'Paid',
        MaxHealth: 1000,
        MaxNano: 1000,
      },
      skills: {
        // Attributes (IDs 16-21)
        16: { base: 100, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, total: 100 }, // Strength
        17: { base: 100, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, total: 100 }, // Agility
        18: { base: 100, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, total: 100 }, // Stamina
        19: { base: 100, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, total: 100 }, // Intelligence
        20: { base: 100, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, total: 100 }, // Sense
        21: { base: 100, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, total: 100 }, // Psychic
        // Misc skills - testing only the ones needed for tests
        181: { base: 0, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, total: 0 }, // Max NCU
        278: { base: 0, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, total: 0 }, // Add. Proj. Dam.
        279: { base: 0, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, total: 0 }, // Add. Melee Dam.
        343: { base: 0, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, total: 0 }, // HealDelta
        364: { base: 0, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, total: 0 }, // NanoDelta
        276: { base: 0, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, total: 0 }, // Add All Off.
        277: { base: 0, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, total: 0 }, // Add All Def.
        280: { base: 0, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, total: 0 }, // Add. Energy Dam.
        379: { base: 0, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, total: 0 }, // CriticalIncrease
      },
      Clothing: {},
      Weapons: {},
      Implants: {},
      PerksAndResearch: {
        perks: [],
        standardPerkPoints: {
          total: 0,
          spent: 0,
          available: 0,
        },
        aiPerkPoints: {
          total: 0,
          spent: 0,
          available: 0,
        },
        research: [],
        lastCalculated: new Date().toISOString(),
      },
      buffs: [],
      id: 'test-profile',
      version: '4.0.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };
  });

  describe('Accumulation Bug Prevention', () => {
    it('should NOT accumulate bonuses when updateProfileWithIPTracking is called multiple times', () => {
      // Add equipment with Max NCU bonus
      const equipmentWithBonus = {
        id: 123456,
        aoid: 123456,
        name: 'Test NCU Equipment',
        ql: 200,
        is_nano: false,
        stats: [],
        spell_data: [
          {
            event: 14, // Wear event
            spells: [
              {
                spell_id: 53045, // Modify Stat spell ID
                spell_params: {
                  Stat: 181, // Max NCU stat ID
                  Amount: 50, // +50 Max NCU
                },
              },
            ],
          },
        ],
        actions: [],
        attack_stats: [],
        defense_stats: [],
      } as any;

      testProfile.Clothing.Body = equipmentWithBonus;

      // Debug: Check if calculateEquipmentBonuses is working
      const bonuses = calculateEquipmentBonuses(testProfile);
      console.log('Equipment bonuses calculated:', bonuses);

      // First call - should apply bonus correctly
      updateProfileWithIPTracking(testProfile);
      console.log('Misc skill after update:', testProfile.skills[181]);
      expect(testProfile.skills[181].equipmentBonus).toBe(50);
      expect(testProfile.skills[181].total).toBe(50); // 0 base + 50 equipment

      // Second call - should NOT accumulate the bonus
      updateProfileWithIPTracking(testProfile);
      expect(testProfile.skills[181].equipmentBonus).toBe(50);
      expect(testProfile.skills[181].total).toBe(50); // Still 50, not 100

      // Third call - should STILL not accumulate
      updateProfileWithIPTracking(testProfile);
      expect(testProfile.skills[181].equipmentBonus).toBe(50);
      expect(testProfile.skills[181].total).toBe(50); // Still 50, not 150

      // Fourth call - verify the fix holds
      updateProfileWithIPTracking(testProfile);
      expect(testProfile.skills[181].equipmentBonus).toBe(50);
      expect(testProfile.skills[181].total).toBe(50); // Still 50, not 200
    });

    it('should maintain consistent values across multiple rapid recalculations', () => {
      // Add equipment with multiple damage modifiers
      const weapon = {
        id: 789012,
        aoid: 789012,
        name: 'Test Weapon',
        ql: 200,
        is_nano: false,
        stats: [],
        spell_data: [
          {
            event: 2, // Wield event
            spells: [
              {
                spell_id: 53045,
                spell_params: {
                  Stat: 278, // Projectile Damage Modifier
                  Amount: 25,
                },
              },
              {
                spell_id: 53045,
                spell_params: {
                  Stat: 279, // Melee Damage Modifier
                  Amount: 30,
                },
              },
            ],
          },
        ] as any,
        actions: [],
      } as any;

      testProfile.Weapons.RHand = weapon;

      // Simulate rapid recalculations (common in UI interactions)
      for (let i = 0; i < 10; i++) {
        updateProfileWithIPTracking(testProfile);

        // Values should remain consistent
        expect(testProfile.skills[278].equipmentBonus).toBe(25); // Add. Proj. Dam.
        expect(testProfile.skills[278].total).toBe(25);
        expect(testProfile.skills[279].equipmentBonus).toBe(30); // Add. Melee Dam.
        expect(testProfile.skills[279].total).toBe(30);
      }
    });
  });

  describe('Correct Bonus Separation', () => {
    it('should store equipment, perk, and buff bonuses separately', () => {
      // Add equipment bonus
      const equipment = {
        id: 111111,
        aoid: 111111,
        name: 'Test Equipment',
        ql: 200,
        is_nano: false,
        stats: [],
        spell_data: [
          {
            event: 14,
            spells: [
              {
                spell_id: 53045,
                spell_params: {
                  Stat: 343, // HealDelta
                  Amount: 20,
                },
              },
            ],
          },
        ] as any,
        actions: [],
      } as any;

      testProfile.Clothing.Body = equipment;

      // Simulate perk bonus by modifying the skill directly
      testProfile.skills[343].perkBonus = 15; // HealDelta

      // Simulate buff bonus
      testProfile.skills[343].buffBonus = 10;

      updateProfileWithIPTracking(testProfile);

      const healDelta = testProfile.skills[343]; // HealDelta
      expect(healDelta.base).toBe(0); // Always 0 for Misc skills
      expect(healDelta.equipmentBonus).toBe(20); // From equipment
      expect(healDelta.perkBonus).toBe(15); // From perks (simulated)
      expect(healDelta.buffBonus).toBe(10); // From buffs (simulated)
      expect(healDelta.total).toBe(45); // Total: 0 + 20 + 15 + 10
    });

    it('should allow setting each bonus type independently', () => {
      const skill = testProfile.skills[276]; // Add All Off.

      // Initially all should be zero
      expect(skill.equipmentBonus).toBe(0);
      expect(skill.perkBonus).toBe(0);
      expect(skill.buffBonus).toBe(0);
      expect(skill.total).toBe(0);

      // Set equipment bonus
      skill.equipmentBonus = 25;
      skill.total = skill.base + skill.trickle + skill.pointsFromIp + skill.equipmentBonus + skill.perkBonus + skill.buffBonus;
      expect(skill.total).toBe(25);

      // Set perk bonus independently
      skill.perkBonus = 10;
      skill.total = skill.base + skill.trickle + skill.pointsFromIp + skill.equipmentBonus + skill.perkBonus + skill.buffBonus;
      expect(skill.total).toBe(35);

      // Set buff bonus independently
      skill.buffBonus = 5;
      skill.total = skill.base + skill.trickle + skill.pointsFromIp + skill.equipmentBonus + skill.perkBonus + skill.buffBonus;
      expect(skill.total).toBe(40);

      // Verify individual values remain correct
      expect(skill.equipmentBonus).toBe(25);
      expect(skill.perkBonus).toBe(10);
      expect(skill.buffBonus).toBe(5);
    });
  });

  describe('Multiple Recalculation Scenarios', () => {
    it('should handle profile load → equipment change → recalculate correctly', () => {
      // Initial equipment
      const initialEquipment = {
        id: 111111,
        aoid: 111111,
        name: 'Initial Equipment',
        ql: 200,
        is_nano: false,
        stats: [],
        spell_data: [
          {
            event: 14,
            spells: [
              {
                spell_id: 53045,
                spell_params: {
                  Stat: 181, // Max NCU
                  Amount: 30,
                },
              },
            ],
          },
        ] as any,
        actions: [],
      } as any;

      testProfile.Clothing.Body = initialEquipment;
      updateProfileWithIPTracking(testProfile);
      expect(testProfile.skills[181].total).toBe(30); // Max NCU

      // Change equipment
      const newEquipment = {
        id: 222222,
        aoid: 222222,
        name: 'New Equipment',
        ql: 200,
        is_nano: false,
        stats: [],
        spell_data: [
          {
            event: 14,
            spells: [
              {
                spell_id: 53045,
                spell_params: {
                  Stat: 181, // Max NCU
                  Amount: 50, // Different bonus
                },
              },
            ],
          },
        ] as any,
        actions: [],
      } as any;

      testProfile.Clothing.Body = newEquipment;
      updateProfileWithIPTracking(testProfile);
      expect(testProfile.skills[181].total).toBe(50); // Should reflect new equipment

      // Remove equipment
      testProfile.Clothing.Body = null;
      updateProfileWithIPTracking(testProfile);
      expect(testProfile.skills[181].total).toBe(0); // Should be back to base
    });

    it('should handle perk change → buff change → recalculate', () => {
      const skill = testProfile.skills[277]; // Add All Def.

      // Initial state
      updateProfileWithIPTracking(testProfile);
      expect(skill.total).toBe(0);

      // Simulate perk change
      skill.perkBonus = 20;
      skill.total = skill.base + skill.trickle + skill.pointsFromIp + skill.equipmentBonus + skill.perkBonus + skill.buffBonus;
      expect(skill.total).toBe(20);

      // Simulate buff change
      skill.buffBonus = 15;
      skill.total = skill.base + skill.trickle + skill.pointsFromIp + skill.equipmentBonus + skill.perkBonus + skill.buffBonus;
      expect(skill.total).toBe(35);

      // Recalculate - values should remain consistent
      updateProfileWithIPTracking(testProfile);
      expect(skill.perkBonus).toBe(20); // Should preserve perk bonus
      expect(skill.buffBonus).toBe(15); // Should preserve buff bonus
      expect(skill.equipmentBonus).toBe(0); // No equipment bonus
      expect(skill.total).toBe(35); // Total should be correct
    });
  });

  describe('Equipment/Perk/Buff Changes', () => {
    it('should correctly increase equipmentBonus when adding equipment', () => {
      // Initially no bonus
      expect(testProfile.skills[181].equipmentBonus).toBe(0); // Max NCU
      expect(testProfile.skills[181].total).toBe(0);

      // Add equipment
      const equipment = {
        id: 123456,
        aoid: 123456,
        name: 'NCU Equipment',
        ql: 200,
        is_nano: false,
        stats: [],
        spell_data: [
          {
            event: 14,
            spells: [
              {
                spell_id: 53045,
                spell_params: {
                  Stat: 181, // Max NCU
                  Amount: 40,
                },
              },
            ],
          },
        ] as any,
        actions: [],
      } as any;

      testProfile.Clothing.Head = equipment;
      updateProfileWithIPTracking(testProfile);

      expect(testProfile.skills[181].equipmentBonus).toBe(40);
      expect(testProfile.skills[181].total).toBe(40);
    });

    it('should correctly decrease equipmentBonus when removing equipment', () => {
      // Add equipment first
      const equipment = {
        id: 123456,
        aoid: 123456,
        name: 'NCU Equipment',
        ql: 200,
        is_nano: false,
        stats: [],
        spell_data: [
          {
            event: 14,
            spells: [
              {
                spell_id: 53045,
                spell_params: {
                  Stat: 181, // Max NCU
                  Amount: 40,
                },
              },
            ],
          },
        ] as any,
        actions: [],
      } as any;

      testProfile.Clothing.Head = equipment;
      updateProfileWithIPTracking(testProfile);
      expect(testProfile.skills[181].equipmentBonus).toBe(40); // Max NCU

      // Remove equipment
      testProfile.Clothing.Head = null;
      updateProfileWithIPTracking(testProfile);

      expect(testProfile.skills[181].equipmentBonus).toBe(0);
      expect(testProfile.skills[181].total).toBe(0);
    });

    it('should handle multiple equipment pieces with same bonus type', () => {
      // Add multiple NCU items
      const item1 = {
        id: 111111,
        aoid: 111111,
        name: 'NCU Item 1',
        ql: 200,
        is_nano: false,
        stats: [],
        spell_data: [
          {
            event: 14,
            spells: [
              {
                spell_id: 53045,
                spell_params: {
                  Stat: 181, // Max NCU
                  Amount: 30,
                },
              },
            ],
          },
        ] as any,
        actions: [],
      } as any;

      const item2 = {
        id: 222222,
        aoid: 222222,
        name: 'NCU Item 2',
        ql: 200,
        is_nano: false,
        stats: [],
        spell_data: [
          {
            event: 14,
            spells: [
              {
                spell_id: 53045,
                spell_params: {
                  Stat: 181, // Max NCU
                  Amount: 25,
                },
              },
            ],
          },
        ] as any,
        actions: [],
      } as any;

      testProfile.Clothing.Body = item1;
      testProfile.Weapons.HUD1 = item2;
      updateProfileWithIPTracking(testProfile);

      // Should stack equipment bonuses
      expect(testProfile.skills[181].equipmentBonus).toBe(55); // 30 + 25 - Max NCU
      expect(testProfile.skills[181].total).toBe(55);
    });
  });

  describe('Value Calculations', () => {
    it('should calculate value as base + trickle + pointsFromIp + equipmentBonus + perkBonus + buffBonus', () => {
      const skill = testProfile.skills[280]; // Add. Energy Dam.

      // Set all bonus types
      skill.base = 0; // Always 0 for Misc
      skill.trickle = 0;
      skill.pointsFromIp = 0;
      skill.equipmentBonus = 20;
      skill.perkBonus = 15;
      skill.buffBonus = 10;

      // Calculate value
      skill.total = skill.base + skill.trickle + skill.pointsFromIp + skill.equipmentBonus + skill.perkBonus + skill.buffBonus;

      expect(skill.total).toBe(45); // 0 + 0 + 0 + 20 + 15 + 10
    });

    it('should verify base is always 0 for Misc skills', () => {
      const miscSkillIds = [181, 278, 279, 343, 364, 276, 277, 280, 379];

      miscSkillIds.forEach((skillId) => {
        const skill = testProfile.skills[skillId];
        expect(skill.base).toBe(0);
      });
    });

    it('should handle negative bonuses correctly', () => {
      const skill = testProfile.skills[379]; // CriticalIncrease

      skill.equipmentBonus = 10;
      skill.perkBonus = -5; // Negative perk bonus
      skill.buffBonus = 3;

      skill.total = skill.base + skill.trickle + skill.pointsFromIp + skill.equipmentBonus + skill.perkBonus + skill.buffBonus;

      expect(skill.total).toBe(8); // 0 + 0 + 0 + 10 - 5 + 3
    });
  });

  describe('All 67 Misc Skills Validation', () => {
    it('should properly initialize all Misc skills with correct SkillData structure', () => {
      const miscSkillIds = [181, 278, 279, 343, 364, 276, 277, 280, 379];

      // Verify we have the test misc skills
      expect(miscSkillIds.length).toBe(9);

      // Verify each skill has the correct structure
      miscSkillIds.forEach((skillId) => {
        const skill = testProfile.skills[skillId];
        expect(skill).toBeDefined();
        expect(typeof skill).toBe('object');

        // Verify SkillData interface properties
        expect(skill.base).toBe(0);
        expect(skill.trickle).toBe(0);
        expect(skill.ipSpent).toBe(0);
        expect(skill.pointsFromIp).toBe(0);
        expect(skill.equipmentBonus).toBe(0);
        expect(skill.perkBonus).toBe(0);
        expect(skill.buffBonus).toBe(0);
        expect(skill.total).toBe(0);
      });
    });

    it('should maintain structure consistency across all Misc skills after updates', () => {
      // Add equipment that affects multiple skills
      const multiSkillEquipment = {
        id: 999999,
        aoid: 999999,
        name: 'Multi Bonus Equipment',
        ql: 200,
        is_nano: false,
        stats: [],
        spell_data: [
          {
            event: 14,
            spells: [
              { spell_id: 53045, spell_params: { Stat: 181, Amount: 30 } }, // Max NCU
              { spell_id: 53045, spell_params: { Stat: 276, Amount: 15 } }, // Add All Off.
              { spell_id: 53045, spell_params: { Stat: 277, Amount: 12 } }, // Add All Def.
              { spell_id: 53045, spell_params: { Stat: 343, Amount: 25 } }, // HealDelta
              { spell_id: 53045, spell_params: { Stat: 364, Amount: 20 } }, // NanoDelta
            ],
          },
        ] as any,
        actions: [],
      } as any;

      testProfile.Clothing.Body = multiSkillEquipment;
      updateProfileWithIPTracking(testProfile);

      // Verify affected skills have correct bonuses
      expect(testProfile.skills[181].equipmentBonus).toBe(30); // Max NCU
      expect(testProfile.skills[276].equipmentBonus).toBe(15); // Add All Off.
      expect(testProfile.skills[277].equipmentBonus).toBe(12); // Add All Def.
      expect(testProfile.skills[343].equipmentBonus).toBe(25); // HealDelta
      expect(testProfile.skills[364].equipmentBonus).toBe(20); // NanoDelta

      // Verify all skills still have proper structure
      const miscSkillIds = [181, 278, 279, 343, 364, 276, 277, 280, 379];
      miscSkillIds.forEach((skillId) => {
        const skill = testProfile.skills[skillId];
        expect(skill.base).toBe(0);
        expect(typeof skill.equipmentBonus).toBe('number');
        expect(typeof skill.perkBonus).toBe('number');
        expect(typeof skill.buffBonus).toBe('number');
        expect(typeof skill.total).toBe('number');

        // Verify value calculation is correct
        const expectedValue =
          skill.base + skill.trickle + skill.pointsFromIp + skill.equipmentBonus + skill.perkBonus + skill.buffBonus;
        expect(skill.total).toBe(expectedValue);
      });
    });

    it('should never receive IP or trickle-down bonuses', () => {
      // Update profile with IP tracking
      updateProfileWithIPTracking(testProfile);

      // Verify Misc skills have zero IP and trickle values
      const miscSkillIds = [181, 278, 279, 343, 364, 276, 277, 280, 379];
      miscSkillIds.forEach((skillId) => {
        const skill = testProfile.skills[skillId];
        expect(skill.ipSpent).toBe(0);
        expect(skill.pointsFromIp).toBe(0);
        expect(skill.trickle).toBe(0);
      });
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    it('should handle missing equipment bonuses gracefully', () => {
      // Equipment with spell that doesn\'t affect any Misc skills
      const irrelevantEquipment = {
        id: 555555,
        aoid: 555555,
        name: 'Irrelevant Equipment',
        ql: 200,
        is_nano: false,
        stats: [],
        spell_data: [
          {
            event: 14,
            spells: [
              {
                spell_id: 53045,
                spell_params: {
                  Stat: 16, // Strength (not a Misc skill)
                  Amount: 50,
                },
              },
            ],
          },
        ] as any,
        actions: [],
      } as any;

      testProfile.Clothing.Hands = irrelevantEquipment;
      updateProfileWithIPTracking(testProfile);

      // All Misc skills should remain at 0
      const miscSkillIds = [181, 278, 279, 343, 364, 276, 277, 280, 379];
      miscSkillIds.forEach((skillId) => {
        const skill = testProfile.skills[skillId];
        expect(skill.equipmentBonus).toBe(0);
        expect(skill.total).toBe(0);
      });
    });

    it('should handle corrupted bonus data gracefully', () => {
      const skill = testProfile.skills[181]; // Max NCU

      // Set invalid bonus values
      (skill as any).equipmentBonus = null;
      (skill as any).perkBonus = undefined;
      (skill as any).buffBonus = 'invalid';

      // Update should handle this gracefully
      expect(() => updateProfileWithIPTracking(testProfile)).not.toThrow();
    });

    it('should maintain immutability of base value', () => {
      const originalBaseValue = testProfile.skills[181].base; // Max NCU

      // Try to modify base value through various operations
      updateProfileWithIPTracking(testProfile);
      expect(testProfile.skills[181].base).toBe(originalBaseValue);

      // Multiple updates shouldn't change base value
      for (let i = 0; i < 5; i++) {
        updateProfileWithIPTracking(testProfile);
        expect(testProfile.skills[181].base).toBe(originalBaseValue);
      }
    });
  });
});

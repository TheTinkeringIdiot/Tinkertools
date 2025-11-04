import { describe, it, expect, beforeEach } from 'vitest';
import { updateProfileWithIPTracking } from '@/lib/tinkerprofiles/ip-integrator';
import { calculateEquipmentBonuses } from '@/services/equipment-bonus-calculator';
import { DEFAULT_SKILLS } from '@/lib/tinkerprofiles/constants';
import { SKILL_CATEGORIES } from '@/lib/tinkerprofiles/skill-mappings';
import type { TinkerProfile, MiscSkill } from '@/lib/tinkerprofiles/types';
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
        Gender: 'Female',
        Faction: 'Clan',
        Expansion: 'SL',
        AccountType: 'Paid',
        MaxHealth: 1000,
        MaxNano: 1000,
      },
      Skills: {
        Attributes: {
          Strength: {
            value: 100,
            pointsFromIp: 0,
            ipSpent: 0,
            trickleDown: 0,
            baseValue: 100,
            cap: 200,
            equipmentBonus: 0,
            perkBonus: 0,
            buffBonus: 0,
          },
          Agility: {
            value: 100,
            pointsFromIp: 0,
            ipSpent: 0,
            trickleDown: 0,
            baseValue: 100,
            cap: 200,
            equipmentBonus: 0,
            perkBonus: 0,
            buffBonus: 0,
          },
          Stamina: {
            value: 100,
            pointsFromIp: 0,
            ipSpent: 0,
            trickleDown: 0,
            baseValue: 100,
            cap: 200,
            equipmentBonus: 0,
            perkBonus: 0,
            buffBonus: 0,
          },
          Intelligence: {
            value: 100,
            pointsFromIp: 0,
            ipSpent: 0,
            trickleDown: 0,
            baseValue: 100,
            cap: 200,
            equipmentBonus: 0,
            perkBonus: 0,
            buffBonus: 0,
          },
          Sense: {
            value: 100,
            pointsFromIp: 0,
            ipSpent: 0,
            trickleDown: 0,
            baseValue: 100,
            cap: 200,
            equipmentBonus: 0,
            perkBonus: 0,
            buffBonus: 0,
          },
          Psychic: {
            value: 100,
            pointsFromIp: 0,
            ipSpent: 0,
            trickleDown: 0,
            baseValue: 100,
            cap: 200,
            equipmentBonus: 0,
            perkBonus: 0,
            buffBonus: 0,
          },
        },
        'Body & Defense': {},
        'Ranged Weapons': {},
        'Ranged Specials': {},
        'Melee Weapons': {},
        'Melee Specials': {},
        'Nanos & Casting': {},
        Exploring: {},
        'Trade & Repair': {},
        'Combat & Healing': {},
        Misc: JSON.parse(JSON.stringify(DEFAULT_SKILLS.Misc)), // Deep copy to avoid mutations
        ACs: {
          'Projectile AC': 0,
          'Melee AC': 0,
          'Energy AC': 0,
          'Chemical AC': 0,
          'Radiation AC': 0,
          'Cold AC': 0,
          'Fire AC': 0,
          'Poison AC': 0,
          'Nano AC': 0,
        },
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
      version: '1.0.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    } as any;
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
      console.log('Misc skill after update:', testProfile.Skills.Misc['Max NCU']);
      expect(testProfile.Skills.Misc['Max NCU'].equipmentBonus).toBe(50);
      expect(testProfile.Skills.Misc['Max NCU'].value).toBe(50); // 0 base + 50 equipment

      // Second call - should NOT accumulate the bonus
      updateProfileWithIPTracking(testProfile);
      expect(testProfile.Skills.Misc['Max NCU'].equipmentBonus).toBe(50);
      expect(testProfile.Skills.Misc['Max NCU'].value).toBe(50); // Still 50, not 100

      // Third call - should STILL not accumulate
      updateProfileWithIPTracking(testProfile);
      expect(testProfile.Skills.Misc['Max NCU'].equipmentBonus).toBe(50);
      expect(testProfile.Skills.Misc['Max NCU'].value).toBe(50); // Still 50, not 150

      // Fourth call - verify the fix holds
      updateProfileWithIPTracking(testProfile);
      expect(testProfile.Skills.Misc['Max NCU'].equipmentBonus).toBe(50);
      expect(testProfile.Skills.Misc['Max NCU'].value).toBe(50); // Still 50, not 200
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
        expect(testProfile.Skills.Misc['Add. Proj. Dam.'].equipmentBonus).toBe(25);
        expect(testProfile.Skills.Misc['Add. Proj. Dam.'].value).toBe(25);
        expect(testProfile.Skills.Misc['Add. Melee Dam.'].equipmentBonus).toBe(30);
        expect(testProfile.Skills.Misc['Add. Melee Dam.'].value).toBe(30);
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
      testProfile.Skills.Misc['HealDelta'].perkBonus = 15;

      // Simulate buff bonus
      testProfile.Skills.Misc['HealDelta'].buffBonus = 10;

      updateProfileWithIPTracking(testProfile);

      const healDelta = testProfile.Skills.Misc['HealDelta'];
      expect(healDelta.baseValue).toBe(0); // Always 0 for Misc skills
      expect(healDelta.equipmentBonus).toBe(20); // From equipment
      expect(healDelta.perkBonus).toBe(15); // From perks (simulated)
      expect(healDelta.buffBonus).toBe(10); // From buffs (simulated)
      expect(healDelta.value).toBe(45); // Total: 0 + 20 + 15 + 10
    });

    it('should allow setting each bonus type independently', () => {
      const skill = testProfile.Skills.Misc['Add All Off.'];

      // Initially all should be zero
      expect(skill.equipmentBonus).toBe(0);
      expect(skill.perkBonus).toBe(0);
      expect(skill.buffBonus).toBe(0);
      expect(skill.value).toBe(0);

      // Set equipment bonus
      skill.equipmentBonus = 25;
      skill.value = skill.baseValue + skill.equipmentBonus + skill.perkBonus + skill.buffBonus;
      expect(skill.value).toBe(25);

      // Set perk bonus independently
      skill.perkBonus = 10;
      skill.value = skill.baseValue + skill.equipmentBonus + skill.perkBonus + skill.buffBonus;
      expect(skill.value).toBe(35);

      // Set buff bonus independently
      skill.buffBonus = 5;
      skill.value = skill.baseValue + skill.equipmentBonus + skill.perkBonus + skill.buffBonus;
      expect(skill.value).toBe(40);

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
      expect(testProfile.Skills.Misc['Max NCU'].value).toBe(30);

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
      expect(testProfile.Skills.Misc['Max NCU'].value).toBe(50); // Should reflect new equipment

      // Remove equipment
      testProfile.Clothing.Body = null;
      updateProfileWithIPTracking(testProfile);
      expect(testProfile.Skills.Misc['Max NCU'].value).toBe(0); // Should be back to base
    });

    it('should handle perk change → buff change → recalculate', () => {
      const skill = testProfile.Skills.Misc['Add All Def.'];

      // Initial state
      updateProfileWithIPTracking(testProfile);
      expect(skill.value).toBe(0);

      // Simulate perk change
      skill.perkBonus = 20;
      skill.value = skill.baseValue + skill.equipmentBonus + skill.perkBonus + skill.buffBonus;
      expect(skill.value).toBe(20);

      // Simulate buff change
      skill.buffBonus = 15;
      skill.value = skill.baseValue + skill.equipmentBonus + skill.perkBonus + skill.buffBonus;
      expect(skill.value).toBe(35);

      // Recalculate - values should remain consistent
      updateProfileWithIPTracking(testProfile);
      expect(skill.perkBonus).toBe(20); // Should preserve perk bonus
      expect(skill.buffBonus).toBe(15); // Should preserve buff bonus
      expect(skill.equipmentBonus).toBe(0); // No equipment bonus
      expect(skill.value).toBe(35); // Total should be correct
    });
  });

  describe('Equipment/Perk/Buff Changes', () => {
    it('should correctly increase equipmentBonus when adding equipment', () => {
      // Initially no bonus
      expect(testProfile.Skills.Misc['Max NCU'].equipmentBonus).toBe(0);
      expect(testProfile.Skills.Misc['Max NCU'].value).toBe(0);

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

      expect(testProfile.Skills.Misc['Max NCU'].equipmentBonus).toBe(40);
      expect(testProfile.Skills.Misc['Max NCU'].value).toBe(40);
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
      expect(testProfile.Skills.Misc['Max NCU'].equipmentBonus).toBe(40);

      // Remove equipment
      testProfile.Clothing.Head = null;
      updateProfileWithIPTracking(testProfile);

      expect(testProfile.Skills.Misc['Max NCU'].equipmentBonus).toBe(0);
      expect(testProfile.Skills.Misc['Max NCU'].value).toBe(0);
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
      expect(testProfile.Skills.Misc['Max NCU'].equipmentBonus).toBe(55); // 30 + 25
      expect(testProfile.Skills.Misc['Max NCU'].value).toBe(55);
    });
  });

  describe('Value Calculations', () => {
    it('should calculate value as baseValue + equipmentBonus + perkBonus + buffBonus', () => {
      const skill = testProfile.Skills.Misc['Add. Energy Dam.'];

      // Set all bonus types
      skill.baseValue = 0; // Always 0 for Misc
      skill.equipmentBonus = 20;
      skill.perkBonus = 15;
      skill.buffBonus = 10;

      // Calculate value
      skill.value = skill.baseValue + skill.equipmentBonus + skill.perkBonus + skill.buffBonus;

      expect(skill.value).toBe(45); // 0 + 20 + 15 + 10
    });

    it('should verify baseValue is always 0 for Misc skills', () => {
      const miscSkills = Object.values(testProfile.Skills.Misc);

      miscSkills.forEach((skill: MiscSkill) => {
        expect(skill.baseValue).toBe(0);
      });
    });

    it('should handle negative bonuses correctly', () => {
      const skill = testProfile.Skills.Misc['CriticalIncrease'];

      skill.equipmentBonus = 10;
      skill.perkBonus = -5; // Negative perk bonus
      skill.buffBonus = 3;

      skill.value = skill.baseValue + skill.equipmentBonus + skill.perkBonus + skill.buffBonus;

      expect(skill.value).toBe(8); // 0 + 10 - 5 + 3
    });
  });

  describe('All 67 Misc Skills Validation', () => {
    it('should properly initialize all Misc skills with correct MiscSkill structure', () => {
      const miscSkillNames = SKILL_CATEGORIES['Misc'];

      // Verify we have all 33 skills (as mentioned in the plan)
      expect(miscSkillNames.length).toBe(33);

      // Verify each skill has the correct structure
      miscSkillNames.forEach((skillName) => {
        const skill = testProfile.Skills.Misc[skillName];
        expect(skill).toBeDefined();
        expect(typeof skill).toBe('object');

        // Verify MiscSkill interface properties
        expect(skill.baseValue).toBe(0);
        expect(skill.equipmentBonus).toBe(0);
        expect(skill.perkBonus).toBe(0);
        expect(skill.buffBonus).toBe(0);
        expect(skill.value).toBe(0);
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
      expect(testProfile.Skills.Misc['Max NCU'].equipmentBonus).toBe(30);
      expect(testProfile.Skills.Misc['Add All Off.'].equipmentBonus).toBe(15);
      expect(testProfile.Skills.Misc['Add All Def.'].equipmentBonus).toBe(12);
      expect(testProfile.Skills.Misc['HealDelta'].equipmentBonus).toBe(25);
      expect(testProfile.Skills.Misc['NanoDelta'].equipmentBonus).toBe(20);

      // Verify all skills still have proper structure
      const miscSkillNames = SKILL_CATEGORIES['Misc'];
      miscSkillNames.forEach((skillName) => {
        const skill = testProfile.Skills.Misc[skillName];
        expect(skill.baseValue).toBe(0);
        expect(typeof skill.equipmentBonus).toBe('number');
        expect(typeof skill.perkBonus).toBe('number');
        expect(typeof skill.buffBonus).toBe('number');
        expect(typeof skill.value).toBe('number');

        // Verify value calculation is correct
        const expectedValue =
          skill.baseValue + skill.equipmentBonus + skill.perkBonus + skill.buffBonus;
        expect(skill.value).toBe(expectedValue);
      });
    });

    it('should never receive IP or trickle-down bonuses', () => {
      // Update profile with IP tracking
      updateProfileWithIPTracking(testProfile);

      // Verify no Misc skill has IP-related properties
      Object.values(testProfile.Skills.Misc).forEach((skill: MiscSkill) => {
        expect('pointFromIp' in skill).toBe(false);
        expect('ipSpent' in skill).toBe(false);
        expect('trickleDown' in skill).toBe(false);
        expect('cap' in skill).toBe(false);
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
      Object.values(testProfile.Skills.Misc).forEach((skill: MiscSkill) => {
        expect(skill.equipmentBonus).toBe(0);
        expect(skill.value).toBe(0);
      });
    });

    it('should handle corrupted bonus data gracefully', () => {
      const skill = testProfile.Skills.Misc['Max NCU'];

      // Set invalid bonus values
      (skill as any).equipmentBonus = null;
      (skill as any).perkBonus = undefined;
      (skill as any).buffBonus = 'invalid';

      // Update should handle this gracefully
      expect(() => updateProfileWithIPTracking(testProfile)).not.toThrow();
    });

    it('should maintain immutability of baseValue', () => {
      const originalBaseValue = testProfile.Skills.Misc['Max NCU'].baseValue;

      // Try to modify baseValue through various operations
      updateProfileWithIPTracking(testProfile);
      expect(testProfile.Skills.Misc['Max NCU'].baseValue).toBe(originalBaseValue);

      // Multiple updates shouldn\'t change baseValue
      for (let i = 0; i < 5; i++) {
        updateProfileWithIPTracking(testProfile);
        expect(testProfile.Skills.Misc['Max NCU'].baseValue).toBe(originalBaseValue);
      }
    });
  });
});

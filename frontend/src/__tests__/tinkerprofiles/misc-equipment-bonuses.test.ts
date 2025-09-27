import { describe, it, expect } from 'vitest';
import { updateProfileSkillInfo } from '@/lib/tinkerprofiles/ip-integrator';
import { calculateEquipmentBonuses } from '@/services/equipment-bonus-calculator';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';

describe('Misc Skills Equipment Bonuses', () => {
  const createTestProfile = (): TinkerProfile => ({
    Character: {
      Name: 'Test Character',
      Profession: 'Agent',
      Breed: 'Solitus',
      Level: 200,
      Gender: 'Female'
    },
    // v4 structure: skills with numeric IDs
    skills: {
      // Attributes (16-21)
      16: { base: 100, trickle: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, ipSpent: 0, cap: 200, total: 100 }, // Strength
      17: { base: 100, trickle: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, ipSpent: 0, cap: 200, total: 100 }, // Agility
      18: { base: 100, trickle: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, ipSpent: 0, cap: 200, total: 100 }, // Stamina
      19: { base: 100, trickle: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, ipSpent: 0, cap: 200, total: 100 }, // Intelligence
      20: { base: 100, trickle: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, ipSpent: 0, cap: 200, total: 100 }, // Sense
      21: { base: 100, trickle: 0, pointsFromIp: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, ipSpent: 0, cap: 200, total: 100 }  // Psychic
    },
    Clothing: {},
    Weapons: {},
    HUD: {},
    Implants: {},
    id: 'test-profile',
    lastUpdated: Date.now(),
    AOVersion: '18.8.0',
    created: Date.now(),
    updated: Date.now()
  } as TinkerProfile);

  it('should apply equipment bonuses to Misc skills', () => {
    const profile = createTestProfile();

    // Add equipment with bonuses to Misc skills
    const equipmentWithMiscBonuses = {
      aoid: 123456,
      name: 'Test Equipment',
      ql: 200,
      spell_data: [{
        event: 14,  // Wear event
        spells: [{
          spell_id: 53045,  // Modify Stat spell ID
          spell_params: {
            Stat: 181,  // Max NCU stat ID
            Amount: 50  // +50 Max NCU
          }
        }, {
          spell_id: 53045,
          spell_params: {
            Stat: 276,  // Add All Offense stat ID
            Amount: 20  // +20 Add All Off.
          }
        }, {
          spell_id: 53045,
          spell_params: {
            Stat: 277,  // Add All Defense stat ID
            Amount: 15  // +15 Add All Def.
          }
        }]
      }]
    };

    // Equip the item
    profile.Clothing.Chest = equipmentWithMiscBonuses;

    // Calculate equipment bonuses
    const bonuses = calculateEquipmentBonuses(profile);

    // Verify bonuses are calculated (bonuses use numeric stat IDs)
    expect(bonuses[181]).toBe(50);  // Max NCU
    expect(bonuses[276]).toBe(20);  // Add All Off.
    expect(bonuses[277]).toBe(15);  // Add All Def.

    // Update profile with IP tracking (which applies equipment bonuses)
    updateProfileSkillInfo(profile);

    // Verify bonus-only stats have equipment bonuses applied (use numeric stat IDs)
    expect(profile.skills[181]?.total).toBe(50);   // Max NCU
    expect(profile.skills[276]?.total).toBe(20);   // Add All Off.
    expect(profile.skills[277]?.total).toBe(15);   // Add All Def.
  });

  it('should apply damage modifier equipment bonuses to Misc skills', () => {
    const profile = createTestProfile();

    // Add weapon with damage modifiers
    const weaponWithDamageModifiers = {
      aoid: 789012,
      name: 'Test Weapon',
      ql: 200,
      spell_data: [{
        event: 2,  // Wield event
        spells: [{
          spell_id: 53045,  // Modify Stat spell ID
          spell_params: {
            Stat: 278,  // Projectile Damage Modifier
            Amount: 25
          }
        }, {
          spell_id: 53045,
          spell_params: {
            Stat: 279,  // Melee Damage Modifier
            Amount: 30
          }
        }, {
          spell_id: 53045,
          spell_params: {
            Stat: 280,  // Energy Damage Modifier
            Amount: 15
          }
        }]
      }]
    };

    // Equip the weapon
    profile.Weapons['Right Hand'] = weaponWithDamageModifiers;

    // Calculate equipment bonuses
    const bonuses = calculateEquipmentBonuses(profile);

    // Verify bonuses are calculated (bonuses use numeric stat IDs)
    expect(bonuses[278]).toBe(25);  // Add. Proj. Dam.
    expect(bonuses[279]).toBe(30);  // Add. Melee Dam.
    expect(bonuses[280]).toBe(15);  // Add. Energy Dam.

    // Update profile with IP tracking
    updateProfileSkillInfo(profile);

    // Verify bonus-only stats have equipment bonuses applied (use numeric stat IDs)
    expect(profile.skills[278]?.total).toBe(25);   // Add. Proj. Dam.
    expect(profile.skills[279]?.total).toBe(30);   // Add. Melee Dam.
    expect(profile.skills[280]?.total).toBe(15);   // Add. Energy Dam.
  });

  it('should stack multiple equipment bonuses for the same Misc skill', () => {
    const profile = createTestProfile();

    // Add multiple items with Max NCU bonuses
    const item1 = {
      aoid: 111111,
      name: 'NCU Item 1',
      ql: 200,
      spell_data: [{
        event: 14,  // Wear event
        spells: [{
          spell_id: 53045,
          spell_params: {
            Stat: 181,  // Max NCU
            Amount: 30
          }
        }]
      }]
    };

    const item2 = {
      aoid: 222222,
      name: 'NCU Item 2',
      ql: 200,
      spell_data: [{
        event: 14,  // Wear event
        spells: [{
          spell_id: 53045,
          spell_params: {
            Stat: 181,  // Max NCU
            Amount: 25
          }
        }]
      }]
    };

    // Equip both items
    profile.Clothing.Chest = item1;
    profile.HUD.HUD1 = item2;

    // Calculate equipment bonuses
    const bonuses = calculateEquipmentBonuses(profile);

    // Verify bonuses stack (bonuses use numeric stat IDs)
    expect(bonuses[181]).toBe(55);  // Max NCU: 30 + 25

    // Update profile with IP tracking
    updateProfileSkillInfo(profile);

    // Verify bonus-only stat has stacked bonuses applied (use numeric stat ID)
    expect(profile.skills[181]?.total).toBe(55);   // Max NCU
  });

  it('should apply equipment, perk, and buff bonuses together for Misc skills', () => {
    const profile = createTestProfile();

    // Add equipment with bonus
    const equipment = {
      aoid: 333333,
      name: 'Test Equipment',
      ql: 200,
      spell_data: [{
        event: 14,  // Wear event
        spells: [{
          spell_id: 53045,
          spell_params: {
            Stat: 343,  // HealDelta
            Amount: 20
          }
        }]
      }]
    };

    profile.Clothing.Chest = equipment;

    // Calculate equipment bonuses
    const equipmentBonuses = calculateEquipmentBonuses(profile);

    // Verify equipment bonus is calculated (bonuses use numeric stat IDs)
    expect(equipmentBonuses[343]).toBe(20);  // HealDelta

    // Simulate perk bonuses
    const perkBonuses = { 343: 10 };  // HealDelta perk bonus

    // Update profile with IP tracking, providing both equipment and perk bonuses
    updateProfileSkillInfo(profile, equipmentBonuses, perkBonuses);

    // Verify total value includes perk + equipment bonus (use numeric stat ID)
    expect(profile.skills[343]?.total).toBe(30);  // 10 perk + 20 equipment
    expect(profile.skills[343]?.equipmentBonus).toBe(20);
    expect(profile.skills[343]?.perkBonus).toBe(10);
  });
});
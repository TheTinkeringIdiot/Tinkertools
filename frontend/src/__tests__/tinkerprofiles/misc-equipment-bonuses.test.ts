import { describe, it, expect } from 'vitest';
import { updateProfileWithIPTracking } from '@/lib/tinkerprofiles/ip-integrator';
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
    Skills: {
      Attributes: {
        Strength: { value: 100, pointFromIp: 0, trickleDown: 0, baseValue: 100, cap: 200, equipmentBonus: 0, perkBonus: 0, buffBonus: 0 },
        Agility: { value: 100, pointFromIp: 0, trickleDown: 0, baseValue: 100, cap: 200, equipmentBonus: 0, perkBonus: 0, buffBonus: 0 },
        Stamina: { value: 100, pointFromIp: 0, trickleDown: 0, baseValue: 100, cap: 200, equipmentBonus: 0, perkBonus: 0, buffBonus: 0 },
        Intelligence: { value: 100, pointFromIp: 0, trickleDown: 0, baseValue: 100, cap: 200, equipmentBonus: 0, perkBonus: 0, buffBonus: 0 },
        Sense: { value: 100, pointFromIp: 0, trickleDown: 0, baseValue: 100, cap: 200, equipmentBonus: 0, perkBonus: 0, buffBonus: 0 },
        Psychic: { value: 100, pointFromIp: 0, trickleDown: 0, baseValue: 100, cap: 200, equipmentBonus: 0, perkBonus: 0, buffBonus: 0 }
      },
      Misc: {
        'Max NCU': 0,
        'Add All Off.': 0,
        'Add All Def.': 0,
        'Add. Proj. Dam.': 0,
        'Add. Melee Dam.': 0,
        'Add. Energy Dam.': 0,
        'Add. Chem. Dam.': 0,
        'Add. Rad. Dam.': 0,
        'Add. Cold Dam.': 0,
        'Add. Fire Dam.': 0,
        'Add. Poison Dam.': 0,
        'Add. Nano Dam.': 0,
        'HealDelta': 0,
        'NanoDelta': 0
      },
      ACs: {
        'Projectile AC': 0,
        'Melee AC': 0,
        'Energy AC': 0,
        'Chemical AC': 0,
        'Radiation AC': 0,
        'Cold AC': 0,
        'Fire AC': 0,
        'Poison AC': 0,
        'Nano AC': 0
      }
    },
    Clothing: {},
    Weapons: {},
    HUD: {},
    Implants: {},
    Perks: [],
    Buffs: [],
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

    // Verify bonuses are calculated
    expect(bonuses['Max NCU']).toBe(50);
    expect(bonuses['Add All Off.']).toBe(20);
    expect(bonuses['Add All Def.']).toBe(15);

    // Update profile with IP tracking (which applies equipment bonuses)
    updateProfileWithIPTracking(profile);

    // Verify Misc skills have equipment bonuses applied
    expect(profile.Skills.Misc['Max NCU']).toBe(50);
    expect(profile.Skills.Misc['Add All Off.']).toBe(20);
    expect(profile.Skills.Misc['Add All Def.']).toBe(15);
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

    // Verify bonuses are calculated
    expect(bonuses['Add. Proj. Dam.']).toBe(25);
    expect(bonuses['Add. Melee Dam.']).toBe(30);
    expect(bonuses['Add. Energy Dam.']).toBe(15);

    // Update profile with IP tracking
    updateProfileWithIPTracking(profile);

    // Verify Misc skills have equipment bonuses applied
    expect(profile.Skills.Misc['Add. Proj. Dam.']).toBe(25);
    expect(profile.Skills.Misc['Add. Melee Dam.']).toBe(30);
    expect(profile.Skills.Misc['Add. Energy Dam.']).toBe(15);
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

    // Verify bonuses stack
    expect(bonuses['Max NCU']).toBe(55);  // 30 + 25

    // Update profile with IP tracking
    updateProfileWithIPTracking(profile);

    // Verify Misc skill has stacked bonuses applied
    expect(profile.Skills.Misc['Max NCU']).toBe(55);
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

    // Add perk bonus (simulated by setting initial value)
    profile.Skills.Misc['HealDelta'] = 10;  // Base value with perk

    // Calculate equipment bonuses
    const bonuses = calculateEquipmentBonuses(profile);

    // Verify equipment bonus is calculated
    expect(bonuses['HealDelta']).toBe(20);

    // Update profile with IP tracking
    updateProfileWithIPTracking(profile);

    // Verify total value includes base + equipment bonus
    expect(profile.Skills.Misc['HealDelta']).toBe(30);  // 10 base + 20 equipment
  });
});
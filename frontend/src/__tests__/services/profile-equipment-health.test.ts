/**
 * Test that equipment bonuses are properly applied to MaxHealth and MaxNano
 */

import { describe, it, expect } from 'vitest';
import { recalculateProfileIP } from '@/lib/tinkerprofiles/ip-integrator';
import type { TinkerProfile, SkillData } from '@/lib/tinkerprofiles/types';

// Helper to create a skill with proper structure
function createSkill(total: number): SkillData {
  return {
    base: 0,
    trickle: 0,
    ipSpent: 0,
    pointsFromIp: 0,
    equipmentBonus: 0,
    perkBonus: 0,
    buffBonus: 0,
    total,
    cap: total,
  };
}

describe('Equipment Health and Nano Bonuses', () => {
  it('should apply Max Health equipment bonuses to Character.MaxHealth', () => {
    // Create a profile with equipment that adds Max Health
    const profile: TinkerProfile = {
      Character: {
        Name: 'Test',
        Level: 100,
        Breed: 1, // Solitus
        Profession: 1, // Soldier
        AccountType: 'Froob',
        Faction: 'Neutral',
        MaxHealth: 0,
        MaxNano: 0,
      },
      skills: {
        // Abilities (stat IDs 16-21)
        16: createSkill(100), // Strength
        17: createSkill(100), // Agility
        18: createSkill(200), // Stamina - affects health
        19: createSkill(100), // Intelligence
        20: createSkill(100), // Sense
        21: createSkill(100), // Psychic

        // Important skills for health/nano calculation
        152: createSkill(500), // Body Dev - affects health
        132: createSkill(300), // Nano Pool - affects nano

        // MaxHealth and MaxNano will be calculated
        1: createSkill(0), // Max Health (will be updated by recalculateProfileIP)
        221: createSkill(0), // Max Nano (will be updated by recalculateProfileIP)
      },
      Clothing: {
        Head: {
          id: 1,
          aoid: 12345,
          name: 'Health Boosting Helmet',
          ql: 100,
          item_class: 1,
          is_nano: false,
          spell_data: [
            {
              event: 14, // Wear event
              spells: [
                {
                  spell_id: 53045,
                  spell_params: {
                    Stat: 1, // Max Health stat ID
                    Amount: 500, // Add 500 health
                  },
                },
              ],
            },
          ],
        },
      },
      Weapons: {},
      Implants: {},
      IPTracker: {
        totalIP: 0,
        spentIP: 0,
        unusedIP: 0,
        titleLevel: 1,
        abilityIP: 0,
        skillIP: 0,
      },
      id: 'test-profile',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    } as any;

    // Recalculate profile IP (which now includes health/nano calculation)
    const updated = recalculateProfileIP(profile);

    // The Max Health should include the 500 bonus from equipment
    expect(updated.Character.MaxHealth).toBeGreaterThan(500);

    // Store health with equipment
    const healthWithEquipment = updated.Character.MaxHealth;

    // Remove equipment and recalculate
    updated.Clothing = {};
    const updatedNoEquip = recalculateProfileIP(updated);

    const healthWithoutEquipment = updatedNoEquip.Character.MaxHealth;

    // The difference should be approximately 500 (the equipment bonus)
    expect(healthWithEquipment - healthWithoutEquipment).toBe(500);
  });

  it('should apply Max Nano equipment bonuses to Character.MaxNano', () => {
    const profile: TinkerProfile = {
      Character: {
        Name: 'Test',
        Level: 100,
        Breed: 1, // Solitus
        Profession: 11, // Nano Technician
        AccountType: 'Froob',
        Faction: 'Neutral',
        MaxHealth: 0,
        MaxNano: 0,
      },
      skills: {
        16: createSkill(100), // Strength
        17: createSkill(100), // Agility
        18: createSkill(100), // Stamina
        19: createSkill(200), // Intelligence - helps with nano
        20: createSkill(200), // Sense - helps with nano
        21: createSkill(200), // Psychic - helps with nano

        152: createSkill(300), // Body Dev
        132: createSkill(800), // Nano Pool - high for nano calculation

        1: createSkill(0), // Max Health
        221: createSkill(0), // Max Nano
      },
      Clothing: {
        Chest: {
          id: 2,
          aoid: 67890,
          name: 'Nano Boosting Armor',
          ql: 100,
          item_class: 1,
          is_nano: false,
          spell_data: [
            {
              event: 14,
              spells: [
                {
                  spell_id: 53046,
                  spell_params: {
                    Stat: 221, // Max Nano stat ID
                    Amount: 300,
                  },
                },
              ],
            },
          ],
        },
      },
      Weapons: {},
      Implants: {},
      IPTracker: {
        totalIP: 0,
        spentIP: 0,
        unusedIP: 0,
        titleLevel: 1,
        abilityIP: 0,
        skillIP: 0,
      },
      id: 'test-profile-2',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    } as any;

    const updated = recalculateProfileIP(profile);

    // The Max Nano should include the 300 bonus from equipment
    expect(updated.Character.MaxNano).toBeGreaterThan(300);

    const nanoWithEquipment = updated.Character.MaxNano;

    // Remove equipment and recalculate
    updated.Clothing = {};
    const updatedNoEquip = recalculateProfileIP(updated);

    const nanoWithoutEquipment = updatedNoEquip.Character.MaxNano;

    // The difference should be exactly 300 (the equipment bonus)
    expect(nanoWithEquipment - nanoWithoutEquipment).toBe(300);
  });

  it('should handle combined Max Health and Max Nano bonuses', () => {
    const profile: TinkerProfile = {
      Character: {
        Name: 'Test',
        Level: 100,
        Breed: 1, // Solitus
        Profession: 6, // Adventurer
        AccountType: 'Froob',
        Faction: 'Neutral',
        MaxHealth: 0,
        MaxNano: 0,
      },
      skills: {
        16: createSkill(150), // Strength
        17: createSkill(150), // Agility
        18: createSkill(150), // Stamina
        19: createSkill(150), // Intelligence
        20: createSkill(150), // Sense
        21: createSkill(150), // Psychic

        152: createSkill(400), // Body Dev
        132: createSkill(400), // Nano Pool

        1: createSkill(0), // Max Health
        221: createSkill(0), // Max Nano
      },
      Clothing: {
        Chest: {
          id: 3,
          aoid: 11111,
          name: 'Combined Boost Armor',
          ql: 100,
          item_class: 1,
          is_nano: false,
          spell_data: [
            {
              event: 14,
              spells: [
                {
                  spell_id: 53047,
                  spell_params: {
                    Stat: 1, // Max Health
                    Amount: 750,
                  },
                },
                {
                  spell_id: 53048,
                  spell_params: {
                    Stat: 221, // Max Nano
                    Amount: 250,
                  },
                },
              ],
            },
          ],
        },
      },
      Weapons: {},
      Implants: {},
      IPTracker: {
        totalIP: 0,
        spentIP: 0,
        unusedIP: 0,
        titleLevel: 1,
        abilityIP: 0,
        skillIP: 0,
      },
      id: 'test-profile-3',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    } as any;

    // Calculate with equipment
    const updated = recalculateProfileIP(profile);
    const healthWithEquipment = updated.Character.MaxHealth;
    const nanoWithEquipment = updated.Character.MaxNano;

    // Remove equipment and recalculate
    updated.Clothing = {};
    const updatedNoEquip = recalculateProfileIP(updated);
    const healthWithoutEquipment = updatedNoEquip.Character.MaxHealth;
    const nanoWithoutEquipment = updatedNoEquip.Character.MaxNano;

    // Verify the bonuses were applied correctly
    expect(healthWithEquipment - healthWithoutEquipment).toBe(750);
    expect(nanoWithEquipment - nanoWithoutEquipment).toBe(250);
  });
});

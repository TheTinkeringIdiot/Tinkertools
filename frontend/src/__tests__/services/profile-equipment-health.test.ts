/**
 * Test that equipment bonuses are properly applied to MaxHealth and MaxNano
 */

import { describe, it, expect } from 'vitest';
import { recalculateHealthAndNano } from '@/services/profile-update-service';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';

describe('Equipment Health and Nano Bonuses', () => {
  it('should apply Max Health equipment bonuses to Character.MaxHealth', async () => {
    // Create a minimal test profile with equipment that adds Max Health
    const profile: TinkerProfile = {
      Character: {
        Name: 'Test',
        Level: 100,
        Breed: 'Solitus',
        Profession: 'Soldier',
        AccountType: 'Free',
        Faction: 'Neutral',
        MaxHealth: 0,
        MaxNano: 0
      },
      Skills: {
        Attributes: {
          Strength: { value: 100, ipSpent: 0, pointFromIp: 0 },
          Agility: { value: 100, ipSpent: 0, pointFromIp: 0 },
          Stamina: { value: 200, ipSpent: 0, pointFromIp: 0 }, // Higher stamina for health calc
          Intelligence: { value: 100, ipSpent: 0, pointFromIp: 0 },
          Sense: { value: 100, ipSpent: 0, pointFromIp: 0 },
          Psychic: { value: 100, ipSpent: 0, pointFromIp: 0 }
        },
        'Body & Defense': {
          'Body Dev.': { value: 500, ipSpent: 0, pointFromIp: 0 }, // Body Dev affects health
          'Nano Pool': { value: 300, ipSpent: 0, pointFromIp: 0 } // Nano Pool affects nano
        }
      },
      Clothing: {
        'Head': {
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
                  spell_id: 53045, // Stat modification spell
                  spell_params: {
                    Stat: 1, // Max Health stat ID
                    Amount: 500 // Add 500 health
                  }
                }
              ]
            }
          ]
        }
      },
      Weapons: {},
      Implants: {},
      id: 'test-profile',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    } as any; // Using any to bypass strict typing for test

    // Calculate health and nano with equipment bonuses
    await recalculateHealthAndNano(profile);

    // The Max Health should include the 500 bonus from equipment
    expect(profile.Character.MaxHealth).toBeGreaterThan(500);

    // Store base health for comparison
    const healthWithEquipment = profile.Character.MaxHealth;

    // Remove the equipment and recalculate
    profile.Clothing = {};
    await recalculateHealthAndNano(profile);

    const healthWithoutEquipment = profile.Character.MaxHealth;

    // The difference should be approximately 500 (the equipment bonus)
    expect(healthWithEquipment - healthWithoutEquipment).toBe(500);
  });

  it('should apply Max Nano equipment bonuses to Character.MaxNano', async () => {
    // Create a minimal test profile with equipment that adds Max Nano
    const profile: TinkerProfile = {
      Character: {
        Name: 'Test',
        Level: 100,
        Breed: 'Solitus',
        Profession: 'Nano-Technician',
        AccountType: 'Free',
        Faction: 'Neutral',
        MaxHealth: 0,
        MaxNano: 0
      },
      Skills: {
        Attributes: {
          Strength: { value: 100, ipSpent: 0, pointFromIp: 0 },
          Agility: { value: 100, ipSpent: 0, pointFromIp: 0 },
          Stamina: { value: 100, ipSpent: 0, pointFromIp: 0 },
          Intelligence: { value: 200, ipSpent: 0, pointFromIp: 0 }, // Higher int for nano calc
          Sense: { value: 100, ipSpent: 0, pointFromIp: 0 },
          Psychic: { value: 200, ipSpent: 0, pointFromIp: 0 } // Higher psychic for nano calc
        },
        'Body & Defense': {
          'Body Dev.': { value: 300, ipSpent: 0, pointFromIp: 0 },
          'Nano Pool': { value: 500, ipSpent: 0, pointFromIp: 0 } // Higher Nano Pool
        }
      },
      Clothing: {
        'Chest': {
          id: 2,
          aoid: 23456,
          name: 'Nano Boosting Robe',
          ql: 100,
          item_class: 1,
          is_nano: false,
          spell_data: [
            {
              event: 14, // Wear event
              spells: [
                {
                  spell_id: 53045, // Stat modification spell
                  spell_params: {
                    Stat: 221, // Max Nano stat ID
                    Amount: 300 // Add 300 nano
                  }
                }
              ]
            }
          ]
        }
      },
      Weapons: {},
      Implants: {},
      id: 'test-profile-2',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    } as any; // Using any to bypass strict typing for test

    // Calculate health and nano with equipment bonuses
    await recalculateHealthAndNano(profile);

    // The Max Nano should include the 300 bonus from equipment
    expect(profile.Character.MaxNano).toBeGreaterThan(0);

    // Store base nano for comparison
    const nanoWithEquipment = profile.Character.MaxNano;

    // Remove the equipment and recalculate
    profile.Clothing = {};
    await recalculateHealthAndNano(profile);

    const nanoWithoutEquipment = profile.Character.MaxNano;

    // The difference should be approximately 300 (the equipment bonus)
    expect(nanoWithEquipment - nanoWithoutEquipment).toBe(300);
  });

  it('should handle combined Max Health and Max Nano bonuses', async () => {
    // Create a profile with equipment that adds both Max Health and Max Nano
    const profile: TinkerProfile = {
      Character: {
        Name: 'Test',
        Level: 150,
        Breed: 'Atrox',
        Profession: 'Enforcer',
        AccountType: 'Paid',
        Faction: 'Clan',
        MaxHealth: 0,
        MaxNano: 0
      },
      Skills: {
        Attributes: {
          Strength: { value: 250, ipSpent: 0, pointFromIp: 0 },
          Agility: { value: 150, ipSpent: 0, pointFromIp: 0 },
          Stamina: { value: 300, ipSpent: 0, pointFromIp: 0 },
          Intelligence: { value: 100, ipSpent: 0, pointFromIp: 0 },
          Sense: { value: 100, ipSpent: 0, pointFromIp: 0 },
          Psychic: { value: 100, ipSpent: 0, pointFromIp: 0 }
        },
        'Body & Defense': {
          'Body Dev.': { value: 700, ipSpent: 0, pointFromIp: 0 },
          'Nano Pool': { value: 400, ipSpent: 0, pointFromIp: 0 }
        }
      },
      Clothing: {
        'Back': {
          id: 3,
          aoid: 34567,
          name: 'Omni-Boost Cloak',
          ql: 150,
          item_class: 1,
          is_nano: false,
          spell_data: [
            {
              event: 14, // Wear event
              spells: [
                {
                  spell_id: 53045,
                  spell_params: {
                    Stat: 1, // Max Health
                    Amount: 750
                  }
                },
                {
                  spell_id: 53045,
                  spell_params: {
                    Stat: 221, // Max Nano
                    Amount: 250
                  }
                }
              ]
            }
          ]
        }
      },
      Weapons: {},
      Implants: {},
      id: 'test-profile-3',
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    } as any;

    // Calculate with equipment
    await recalculateHealthAndNano(profile);
    const healthWithEquipment = profile.Character.MaxHealth;
    const nanoWithEquipment = profile.Character.MaxNano;

    // Remove equipment and recalculate
    profile.Clothing = {};
    await recalculateHealthAndNano(profile);
    const healthWithoutEquipment = profile.Character.MaxHealth;
    const nanoWithoutEquipment = profile.Character.MaxNano;

    // Verify the bonuses were applied correctly
    expect(healthWithEquipment - healthWithoutEquipment).toBe(750);
    expect(nanoWithEquipment - nanoWithoutEquipment).toBe(250);
  });
});
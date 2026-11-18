/**
 * Test that equipment bonuses are properly applied to MaxHealth and MaxNano
 */

import { describe, it, expect } from 'vitest';
import { recalculateProfileIP } from '@/lib/tinkerprofiles/ip-integrator';
import type { Item } from '@/types/api';
import {
  BREED,
  PROFESSION,
  createTestProfile,
  createTestItem,
  createSpellData,
  createSpell,
} from '@/__tests__/helpers';

const MAX_HEALTH = 1;
const MAX_NANO = 221;

/** Armor whose Wear effect applies "Modify {Stat} by {Amount}" (spell 53045) per bonus */
function createBoostArmor(name: string, bonuses: Array<[number, number]>): Item {
  return createTestItem({
    name,
    item_class: 2, // Armor
    spell_data: [
      createSpellData({
        event: 14, // Wear
        spells: bonuses.map(([stat, amount]) =>
          createSpell({ spell_id: 53045, spell_params: { Stat: stat, Amount: amount } })
        ),
      }),
    ],
  });
}

describe('Equipment Health and Nano Bonuses', () => {
  it('should apply Max Health equipment bonuses to Character.MaxHealth', () => {
    const profile = createTestProfile({
      level: 100,
      breed: BREED.SOLITUS,
      profession: PROFESSION.SOLDIER,
    });
    profile.Clothing = { Head: createBoostArmor('Health Boosting Helmet', [[MAX_HEALTH, 500]]) };

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

    // The difference should be exactly 500 (the equipment bonus)
    expect(healthWithEquipment - healthWithoutEquipment).toBe(500);
  });

  it('should apply Max Nano equipment bonuses to Character.MaxNano', () => {
    const profile = createTestProfile({
      level: 100,
      breed: BREED.SOLITUS,
      profession: PROFESSION.NANO_TECHNICIAN,
    });
    profile.Clothing = { Chest: createBoostArmor('Nano Boosting Armor', [[MAX_NANO, 300]]) };

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
    const profile = createTestProfile({
      level: 100,
      breed: BREED.SOLITUS,
      profession: PROFESSION.ADVENTURER,
    });
    profile.Clothing = {
      Chest: createBoostArmor('Combined Boost Armor', [
        [MAX_HEALTH, 750],
        [MAX_NANO, 250],
      ]),
    };

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

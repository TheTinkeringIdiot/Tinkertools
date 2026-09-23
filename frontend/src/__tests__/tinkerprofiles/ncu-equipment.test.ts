import { describe, it, expect, beforeEach } from 'vitest';
import { TinkerProfilesManager } from '@/lib/tinkerprofiles';
import type { Item } from '@/types/api';
import {
  BREED,
  PROFESSION,
  createTestProfile,
  createTestItem,
  createSpellData,
  createSpell,
} from '@/__tests__/helpers';

/** NCU memory whose Wear effect modifies Max NCU (stat 181) by `amount` */
function createNcuMemory(name: string, amount: number): Item {
  return createTestItem({
    name,
    ql: 200,
    spell_data: [
      createSpellData({
        event: 14, // Wear event
        spells: [createSpell({ spell_id: 53045, spell_params: { Stat: 181, Amount: amount } })],
      }),
    ],
  });
}

describe('NCU Equipment Bonuses', () => {
  let manager: TinkerProfilesManager;
  let profileId: string;

  beforeEach(async () => {
    // Clear localStorage
    localStorage.clear();

    // Initialize manager
    manager = new TinkerProfilesManager({
      validation: {
        strictMode: false,
        autoCorrect: true,
        allowLegacyFormats: true,
      },
    });

    // Create a test profile
    const { Character } = createTestProfile({
      name: 'NCU Test',
      profession: PROFESSION.NANO_TECHNICIAN,
      breed: BREED.OPIFEX,
      level: 200,
    });
    profileId = await manager.createProfile('NCU Test', { Character });
  });

  it('should update MaxNCU when equipping NCU items', async () => {
    // Load the profile
    let profile = await manager.loadProfile(profileId);
    expect(profile).toBeDefined();

    // Get initial Max NCU value (stat ID 181)
    const initialMaxNCU = profile?.skills?.[181]?.total || 0;

    // Equip an NCU item with +20 Max NCU (stat ID 181)
    await manager.updateProfile(profileId, {
      Clothing: {
        ...profile?.Clothing,
        Chest: createNcuMemory('NCU Memory Test', 20),
      },
    });

    // Load the updated profile
    profile = await manager.loadProfile(profileId);
    expect(profile).toBeDefined();

    // Max NCU has no base value: it rises by exactly the equipment bonus
    expect(profile?.skills?.[181]?.total).toBe(initialMaxNCU + 20);
  });

  it('should update MaxNCU when equipping multiple NCU items', async () => {
    // Load the profile
    let profile = await manager.loadProfile(profileId);
    expect(profile).toBeDefined();

    // Get initial Max NCU value (stat ID 181)
    const initialMaxNCU = profile?.skills?.[181]?.total || 0;

    // Equip all items at once
    await manager.updateProfile(profileId, {
      Clothing: {
        ...profile?.Clothing,
        Chest: createNcuMemory('NCU Memory 1', 20),
        Legs: createNcuMemory('NCU Memory 2', 25),
        Head: createNcuMemory('NCU Memory 3', 30),
      },
    });

    // Load the updated profile
    profile = await manager.loadProfile(profileId);
    expect(profile).toBeDefined();

    // Increased by the sum of all bonuses (75)
    expect(profile?.skills?.[181]?.total).toBe(initialMaxNCU + 75);
  });

  it('should decrease MaxNCU when unequipping NCU items', async () => {
    // First equip an item
    let profile = await manager.loadProfile(profileId);
    await manager.updateProfile(profileId, {
      Clothing: {
        ...profile?.Clothing,
        Chest: createNcuMemory('NCU Memory', 50),
      },
    });

    // Get the value with equipment
    profile = await manager.loadProfile(profileId);
    const withEquipmentNCU = profile?.skills?.[181]?.total || 0;

    // Now unequip the item
    await manager.updateProfile(profileId, {
      Clothing: {
        ...profile?.Clothing,
        Chest: null,
      },
    });

    // Get the value without equipment
    profile = await manager.loadProfile(profileId);
    const withoutEquipmentNCU = profile?.skills?.[181]?.total || 0;

    // Max NCU dropped by exactly the removed bonus
    expect(withoutEquipmentNCU).toBe(withEquipmentNCU - 50);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { TinkerProfilesManager } from '@/lib/tinkerprofiles';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';

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
        autoCorrect: true
      }
    });

    // Create a test profile
    profileId = await manager.createProfile('NCU Test', {
      Character: {
        Name: 'NCU Test',
        Profession: 'Nanotechnician',
        Breed: 'Opifex',
        Level: 200,
        Gender: 'Male'
      }
    } as Partial<TinkerProfile>);
  });

  it('should update MaxNCU (Computer Literacy) when equipping NCU items', async () => {
    // Load the profile
    let profile = await manager.loadProfile(profileId);
    expect(profile).toBeDefined();

    // Get initial Computer Literacy value
    const initialComputerLiteracy = profile?.Skills?.Misc?.['Computer Literacy'] || 0;
    console.log('Initial Computer Literacy:', initialComputerLiteracy);

    // Simulate equipping an NCU item (e.g., NCU Memory with +20 Computer Literacy)
    // Item aoid 303992 or similar
    const ncuItem = {
      aoid: 303992,
      name: 'NCU Memory Test',
      ql: 200,
      stats: {
        'Computer Literacy': 20  // Adds +20 to Computer Literacy
      }
    };

    // Equip the item in a slot (e.g., Chest slot for testing)
    await manager.updateProfile(profileId, {
      Clothing: {
        ...profile?.Clothing,
        Chest: ncuItem
      }
    });

    // Load the updated profile
    profile = await manager.loadProfile(profileId);
    expect(profile).toBeDefined();

    // Check that Computer Literacy has increased
    const updatedComputerLiteracy = profile?.Skills?.Misc?.['Computer Literacy'] || 0;
    console.log('Updated Computer Literacy:', updatedComputerLiteracy);

    // The Computer Literacy should have increased by the equipment bonus
    expect(updatedComputerLiteracy).toBeGreaterThan(initialComputerLiteracy);

    // Verify the equipment bonus was applied (should be at least 20 more)
    // Note: The exact increase depends on how the equipment bonus calculator works
    // but it should definitely be higher than before
    expect(updatedComputerLiteracy).toBeGreaterThanOrEqual(initialComputerLiteracy + 20);
  });

  it('should update MaxNCU when equipping multiple NCU items', async () => {
    // Load the profile
    let profile = await manager.loadProfile(profileId);
    expect(profile).toBeDefined();

    // Get initial Computer Literacy value
    const initialComputerLiteracy = profile?.Skills?.Misc?.['Computer Literacy'] || 0;

    // Simulate equipping multiple NCU items
    const ncuItems = {
      Chest: {
        aoid: 303992,
        name: 'NCU Memory 1',
        ql: 200,
        stats: { 'Computer Literacy': 20 }
      },
      Legs: {
        aoid: 303993,
        name: 'NCU Memory 2',
        ql: 200,
        stats: { 'Computer Literacy': 25 }
      },
      Head: {
        aoid: 303994,
        name: 'NCU Memory 3',
        ql: 200,
        stats: { 'Computer Literacy': 30 }
      }
    };

    // Equip all items at once
    await manager.updateProfile(profileId, {
      Clothing: {
        ...profile?.Clothing,
        ...ncuItems
      }
    });

    // Load the updated profile
    profile = await manager.loadProfile(profileId);
    expect(profile).toBeDefined();

    // Check that Computer Literacy has increased significantly
    const updatedComputerLiteracy = profile?.Skills?.Misc?.['Computer Literacy'] || 0;
    console.log('Initial Computer Literacy:', initialComputerLiteracy);
    console.log('Updated Computer Literacy with 3 items:', updatedComputerLiteracy);

    // Should have increased by at least the sum of all bonuses (75)
    expect(updatedComputerLiteracy).toBeGreaterThanOrEqual(initialComputerLiteracy + 75);
  });

  it('should decrease MaxNCU when unequipping NCU items', async () => {
    // First equip an item
    let profile = await manager.loadProfile(profileId);
    const ncuItem = {
      aoid: 303992,
      name: 'NCU Memory',
      ql: 200,
      stats: { 'Computer Literacy': 50 }
    };

    await manager.updateProfile(profileId, {
      Clothing: {
        ...profile?.Clothing,
        Chest: ncuItem
      }
    });

    // Get the value with equipment
    profile = await manager.loadProfile(profileId);
    const withEquipmentNCU = profile?.Skills?.Misc?.['Computer Literacy'] || 0;

    // Now unequip the item
    await manager.updateProfile(profileId, {
      Clothing: {
        ...profile?.Clothing,
        Chest: null
      }
    });

    // Get the value without equipment
    profile = await manager.loadProfile(profileId);
    const withoutEquipmentNCU = profile?.Skills?.Misc?.['Computer Literacy'] || 0;

    console.log('Computer Literacy with equipment:', withEquipmentNCU);
    console.log('Computer Literacy without equipment:', withoutEquipmentNCU);

    // Computer Literacy should have decreased
    expect(withoutEquipmentNCU).toBeLessThan(withEquipmentNCU);
  });
});
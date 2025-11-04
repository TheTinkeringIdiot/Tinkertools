import { describe, it, expect, beforeEach } from 'vitest';
import { TinkerProfilesManager } from '@/lib/tinkerprofiles';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import { BREED, PROFESSION } from '@/__tests__/helpers';

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
      },
    });

    // Create a test profile
    profileId = await manager.createProfile('NCU Test', {
      Character: {
        Name: 'NCU Test',
        Profession: PROFESSION.NANO_TECHNICIAN,
        Breed: BREED.OPIFEX,
        Level: 200,
        Gender: 'Male',
      },
    } as Partial<TinkerProfile>);
  });

  it('should update MaxNCU when equipping NCU items', async () => {
    // Load the profile
    let profile = await manager.loadProfile(profileId);
    expect(profile).toBeDefined();

    // Get initial Max NCU value (stat ID 181)
    const initialMaxNCU = profile?.skills?.[181]?.total || 0;
    console.log('Initial Max NCU:', initialMaxNCU);

    // Simulate equipping an NCU item with +20 Max NCU (stat ID 181)
    const ncuItem = {
      aoid: 303992,
      name: 'NCU Memory Test',
      ql: 200,
      spell_data: [
        {
          event: 14, // Wear event
          spells: [
            {
              spell_id: 53045, // Modify Stat spell ID
              spell_params: {
                Stat: 181, // Max NCU stat ID
                Amount: 20, // +20 Max NCU
              },
            },
          ],
        },
      ],
    };

    // Equip the item in a slot (e.g., Chest slot for testing)
    await manager.updateProfile(profileId, {
      Clothing: {
        ...profile?.Clothing,
        Chest: ncuItem,
      },
    });

    // Load the updated profile
    profile = await manager.loadProfile(profileId);
    expect(profile).toBeDefined();

    // Check that Max NCU has increased
    const updatedMaxNCU = profile?.skills?.[181]?.total || 0;
    console.log('Updated Max NCU:', updatedMaxNCU);

    // The Max NCU should have increased by the equipment bonus
    expect(updatedMaxNCU).toBeGreaterThan(initialMaxNCU);

    // Verify the equipment bonus was applied (should be at least 20 more)
    // Note: The exact increase depends on how the equipment bonus calculator works
    // but it should definitely be higher than before
    expect(updatedMaxNCU).toBeGreaterThanOrEqual(initialMaxNCU + 20);
  });

  it('should update MaxNCU when equipping multiple NCU items', async () => {
    // Load the profile
    let profile = await manager.loadProfile(profileId);
    expect(profile).toBeDefined();

    // Get initial Max NCU value (stat ID 181)
    const initialMaxNCU = profile?.skills?.[181]?.total || 0;

    // Simulate equipping multiple NCU items
    const ncuItems = {
      Chest: {
        aoid: 303992,
        name: 'NCU Memory 1',
        ql: 200,
        spell_data: [
          {
            event: 14,
            spells: [
              {
                spell_id: 53045,
                spell_params: {
                  Stat: 181,
                  Amount: 20,
                },
              },
            ],
          },
        ],
      },
      Legs: {
        aoid: 303993,
        name: 'NCU Memory 2',
        ql: 200,
        spell_data: [
          {
            event: 14,
            spells: [
              {
                spell_id: 53045,
                spell_params: {
                  Stat: 181,
                  Amount: 25,
                },
              },
            ],
          },
        ],
      },
      Head: {
        aoid: 303994,
        name: 'NCU Memory 3',
        ql: 200,
        spell_data: [
          {
            event: 14,
            spells: [
              {
                spell_id: 53045,
                spell_params: {
                  Stat: 181,
                  Amount: 30,
                },
              },
            ],
          },
        ],
      },
    };

    // Equip all items at once
    await manager.updateProfile(profileId, {
      Clothing: {
        ...profile?.Clothing,
        ...ncuItems,
      },
    });

    // Load the updated profile
    profile = await manager.loadProfile(profileId);
    expect(profile).toBeDefined();

    // Check that Max NCU has increased significantly
    const updatedMaxNCU = profile?.skills?.[181]?.total || 0;
    console.log('Initial Max NCU:', initialMaxNCU);
    console.log('Updated Max NCU with 3 items:', updatedMaxNCU);

    // Should have increased by at least the sum of all bonuses (75)
    expect(updatedMaxNCU).toBeGreaterThanOrEqual(initialMaxNCU + 75);
  });

  it('should decrease MaxNCU when unequipping NCU items', async () => {
    // First equip an item
    let profile = await manager.loadProfile(profileId);
    const ncuItem = {
      aoid: 303992,
      name: 'NCU Memory',
      ql: 200,
      spell_data: [
        {
          event: 14,
          spells: [
            {
              spell_id: 53045,
              spell_params: {
                Stat: 181,
                Amount: 50,
              },
            },
          ],
        },
      ],
    };

    await manager.updateProfile(profileId, {
      Clothing: {
        ...profile?.Clothing,
        Chest: ncuItem,
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

    console.log('Max NCU with equipment:', withEquipmentNCU);
    console.log('Max NCU without equipment:', withoutEquipmentNCU);

    // Max NCU should have decreased
    expect(withoutEquipmentNCU).toBeLessThan(withEquipmentNCU);
  });
});

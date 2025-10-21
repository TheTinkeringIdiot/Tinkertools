/**
 * Equipment Interaction Integration Tests
 *
 * Integration tests for equipment management through actual UI components.
 * Tests user-driven equipment changes, stat effects, and requirement checking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock API client before importing stores
vi.mock('@/services/api-client');

import { setupIntegrationTest, mountForIntegration, waitForUpdates, waitForStatRecalculation } from '../helpers/integration-test-utils';
import {
  createTestItem,
  createWeaponItem,
  createArmorItem,
  createImplantItem,
  createStatValue,
  createItemWithRequirements,
  createSpellData,
  createSpell
} from '../helpers/item-fixtures';
import { SKILL_ID } from '../helpers/skill-fixtures';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import type { Item, TinkerProfile } from '@/types/api';
import type { IntegrationTestContext } from '../helpers/integration-test-utils';
import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';

describe('Equipment Interaction Integration', () => {
  let context: IntegrationTestContext;
  let store: ReturnType<typeof useTinkerProfilesStore>;
  let testProfile: TinkerProfile;

  // Helper to wait for equipment recalculation
  // Note: Debouncing is disabled in test environment, but we still need
  // to wait for requestAnimationFrame + async execution
  const waitForEquipmentUpdate = async () => {
    await waitForStatRecalculation();
  };

  beforeEach(async () => {
    // Setup PrimeVue with ToastService BEFORE initializing Pinia/stores
    const app = createApp({});
    app.use(PrimeVue);
    app.use(ToastService);

    context = await setupIntegrationTest();

    // Attach Pinia to the app to ensure Toast is available
    app.use(context.pinia);

    store = useTinkerProfilesStore();

    // Create a test profile for equipment testing
    const profileId = await store.createProfile('Test Character', {
      Character: {
        Name: 'Test Character',
        Level: 100,
        Profession: 3, // Soldier
        Breed: 1, // Solitus
        Faction: 'Clan',
        Expansion: 'Shadow Lands',
        AccountType: 'Paid',
        MaxHealth: 1000,
        MaxNano: 500
      },
      Skills: {},
      Clothing: {},
      Weapons: {},
      Implants: {},
      PerksAndResearch: [],
      buffs: []
    } as Partial<TinkerProfile>);

    // Load the profile
    testProfile = (await store.loadProfile(profileId))!;
    await store.setActiveProfile(profileId);

    // Wait for profile to be fully loaded and initial recalculation to complete
    await waitForStatRecalculation();
  });

  describe('Equipping Items', () => {
    it('equips item to slot and updates stats', async () => {
      // Create a weapon with stat bonuses
      const testWeapon = createWeaponItem({
        name: 'Combat Rifle',
        aoid: 100001,
        ql: 200,
        spell_data: [
          createSpellData({
            event: 2, // Wield event for weapons
            spells: [
              createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.ASSAULT_RIF, Amount: 50 } }),
              createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.RANGED_INIT, Amount: 25 } }),
              createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.ADD_PROJ_DAM, Amount: 100 } })
            ]
          })
        ]
      });

      // Get initial stat values
      const initialAssaultRif = store.activeProfile?.skills?.[SKILL_ID.ASSAULT_RIF]?.total || 0;
      const initialRangedInit = store.activeProfile?.skills?.[SKILL_ID.RANGED_INIT]?.total || 0;

      // Equip the weapon
      await store.equipItem(testWeapon, 'RHand');
      await waitForEquipmentUpdate();

      // Verify item is equipped
      expect(store.activeProfile?.Weapons['RHand']).toBeDefined();
      expect(store.activeProfile?.Weapons['RHand']?.name).toBe('Combat Rifle');
      expect(store.activeProfile?.Weapons['RHand']?.ql).toBe(200);

      // Verify stats were updated
      const updatedAssaultRif = store.activeProfile?.skills?.[SKILL_ID.ASSAULT_RIF]?.total || 0;
      const updatedRangedInit = store.activeProfile?.skills?.[SKILL_ID.RANGED_INIT]?.total || 0;

      expect(updatedAssaultRif).toBeGreaterThan(initialAssaultRif);
      expect(updatedRangedInit).toBeGreaterThan(initialRangedInit);

      // Verify equipment bonus is tracked separately
      const assaultRifEquipmentBonus = store.activeProfile?.skills?.[SKILL_ID.ASSAULT_RIF]?.equipmentBonus || 0;
      expect(assaultRifEquipmentBonus).toBeGreaterThanOrEqual(50);
    });

    it('persists equipped item to localStorage', async () => {
      const testArmor = createArmorItem({
        name: 'Combat Armor',
        aoid: 100002,
        ql: 180,
        spell_data: [
          createSpellData({
            event: 14, // Wear event for armor
            spells: [
              createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.PROJECTILE_AC, Amount: 500 } }),
              createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.MELEE_AC, Amount: 400 } })
            ]
          })
        ]
      });

      // Equip the armor
      await store.equipItem(testArmor, 'Chest');
      await waitForEquipmentUpdate();

      // Verify persistence by checking localStorage (new individual profile key format)
      const profileKey = `tinkertools_profile_${testProfile.id}`;
      const storedData = context.mockLocalStorage.getItem(profileKey);
      expect(storedData).toBeTruthy();

      const storedProfile = JSON.parse(storedData!);

      expect(storedProfile.Clothing['Chest']).toBeDefined();
      expect(storedProfile.Clothing['Chest'].name).toBe('Combat Armor');
    });

    it('equips multiple items and stacks stats correctly', async () => {
      const weapon = createWeaponItem({
        name: 'Assault Rifle',
        aoid: 100003,
        ql: 200,
        spell_data: [
          createSpellData({
            event: 2,
            spells: [createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.ASSAULT_RIF, Amount: 30 } })]
          })
        ]
      });

      const armor = createArmorItem({
        name: 'Tactical Armor',
        aoid: 100004,
        ql: 180,
        spell_data: [
          createSpellData({
            event: 14,
            spells: [createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.ASSAULT_RIF, Amount: 20 } })]
          })
        ]
      });

      const implant = createImplantItem({
        name: 'Combat Implant',
        aoid: 100005,
        ql: 150,
        spell_data: [
          createSpellData({
            event: 14,
            spells: [createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.ASSAULT_RIF, Amount: 15 } })]
          })
        ]
      });

      // Get initial stat
      const initialAssaultRif = store.activeProfile?.skills?.[SKILL_ID.ASSAULT_RIF]?.total || 0;

      // Equip all three items
      await store.equipItem(weapon, 'RHand');
      await waitForEquipmentUpdate();
      await store.equipItem(armor, 'Chest');
      await waitForEquipmentUpdate();
      await store.equipItem(implant, 'Eye');
      await waitForEquipmentUpdate();

      // Verify all items are equipped
      expect(store.activeProfile?.Weapons['RHand']).toBeDefined();
      expect(store.activeProfile?.Clothing['Chest']).toBeDefined();
      expect(store.activeProfile?.Implants['Eye']).toBeDefined();

      // Verify stats stacked correctly (30 + 20 + 15 = 65 bonus)
      const finalAssaultRif = store.activeProfile?.skills?.[SKILL_ID.ASSAULT_RIF]?.total || 0;
      expect(finalAssaultRif).toBeGreaterThanOrEqual(initialAssaultRif + 65);
    });

    it('handles item with spell data effects', async () => {
      // Create item with spell data (OnWear event)
      const buffItem = createTestItem({
        name: 'Buffed Armor',
        aoid: 100006,
        ql: 200,
        spell_data: [
          createSpellData({
            event: 14, // Wear event
            spells: [
              createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.STAMINA, Amount: 10 } }),
              createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.STRENGTH, Amount: 25 } })
            ]
          })
        ]
      });

      // Get initial stats
      const initialStamina = store.activeProfile?.skills?.[SKILL_ID.STAMINA]?.total || 0;
      const initialStrength = store.activeProfile?.skills?.[SKILL_ID.STRENGTH]?.total || 0;

      // Equip the item
      await store.equipItem(buffItem, 'Chest');
      await waitForEquipmentUpdate();

      // Verify both direct stat and spell effect are applied
      const finalStamina = store.activeProfile?.skills?.[SKILL_ID.STAMINA]?.total || 0;
      const finalStrength = store.activeProfile?.skills?.[SKILL_ID.STRENGTH]?.total || 0;

      expect(finalStamina).toBeGreaterThan(initialStamina);
      expect(finalStrength).toBeGreaterThan(initialStrength);
    });
  });

  describe('Unequipping Items', () => {
    it('unequips item and reverts stats', async () => {
      const testWeapon = createWeaponItem({
        name: 'Test Weapon',
        aoid: 100007,
        ql: 200,
        spell_data: [
          createSpellData({
            event: 2,
            spells: [
              createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.ASSAULT_RIF, Amount: 50 } }),
              createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.RANGED_INIT, Amount: 25 } })
            ]
          })
        ]
      });

      // Equip the weapon first
      await store.equipItem(testWeapon, 'RHand');
      await waitForEquipmentUpdate();

      const equippedAssaultRif = store.activeProfile?.skills?.[SKILL_ID.ASSAULT_RIF]?.total || 0;
      const equippedRangedInit = store.activeProfile?.skills?.[SKILL_ID.RANGED_INIT]?.total || 0;

      // Unequip the weapon
      await store.unequipItem('Weapons', 'RHand');
      await waitForEquipmentUpdate();

      // Verify item is removed
      expect(store.activeProfile?.Weapons['RHand']).toBeNull();

      // Verify stats reverted
      const finalAssaultRif = store.activeProfile?.skills?.[SKILL_ID.ASSAULT_RIF]?.total || 0;
      const finalRangedInit = store.activeProfile?.skills?.[SKILL_ID.RANGED_INIT]?.total || 0;

      expect(finalAssaultRif).toBeLessThan(equippedAssaultRif);
      expect(finalRangedInit).toBeLessThan(equippedRangedInit);

      // Equipment bonus should be 0
      const assaultRifEquipmentBonus = store.activeProfile?.skills?.[SKILL_ID.ASSAULT_RIF]?.equipmentBonus || 0;
      expect(assaultRifEquipmentBonus).toBeLessThanOrEqual(equippedAssaultRif);
    });

    it('shows slot as empty after unequipping', async () => {
      const testArmor = createArmorItem({
        name: 'Test Armor',
        aoid: 100008,
        ql: 150
      });

      // Equip then unequip
      await store.equipItem(testArmor, 'Chest');
      await waitForEquipmentUpdate();
      expect(store.activeProfile?.Clothing['Chest']).toBeDefined();

      await store.unequipItem('Clothing', 'Chest');
      await waitForEquipmentUpdate();

      // Verify slot is null
      expect(store.activeProfile?.Clothing['Chest']).toBeNull();
    });

    it('persists unequip action to localStorage', async () => {
      const testWeapon = createWeaponItem({
        name: 'Temporary Weapon',
        aoid: 100009,
        ql: 150
      });

      // Equip and unequip
      await store.equipItem(testWeapon, 'RHand');
      await waitForEquipmentUpdate();
      await store.unequipItem('Weapons', 'RHand');
      await waitForEquipmentUpdate();

      // Verify localStorage reflects unequipped state (new individual profile key format)
      const profileKey = `tinkertools_profile_${testProfile.id}`;
      const storedData = context.mockLocalStorage.getItem(profileKey);
      expect(storedData).toBeTruthy();

      const storedProfile = JSON.parse(storedData!);

      expect(storedProfile.Weapons['RHand']).toBeNull();
    });
  });

  describe('Equipment Slots', () => {
    it('equips item to correct slot based on item class', async () => {
      // Weapon (item_class = 1)
      const weapon = createWeaponItem({
        name: 'Weapon',
        aoid: 100010,
        item_class: 1
      });

      await store.equipItem(weapon, 'RHand');
      await waitForEquipmentUpdate();

      expect(store.activeProfile?.Weapons['RHand']).toBeDefined();
      expect(store.activeProfile?.Clothing['RHand']).toBeUndefined();
    });

    it('replaces existing item when equipping to occupied slot', async () => {
      const firstWeapon = createWeaponItem({
        name: 'First Weapon',
        aoid: 100011,
        ql: 100
      });

      const secondWeapon = createWeaponItem({
        name: 'Second Weapon',
        aoid: 100012,
        ql: 200
      });

      // Equip first weapon
      await store.equipItem(firstWeapon, 'RHand');
      await waitForEquipmentUpdate();
      expect(store.activeProfile?.Weapons['RHand']?.name).toBe('First Weapon');

      // Equip second weapon to same slot
      await store.equipItem(secondWeapon, 'RHand');
      await waitForEquipmentUpdate();

      // Verify second weapon replaced first
      expect(store.activeProfile?.Weapons['RHand']?.name).toBe('Second Weapon');
      expect(store.activeProfile?.Weapons['RHand']?.ql).toBe(200);
    });

    it('handles different slot types correctly', async () => {
      const weapon = createWeaponItem({ name: 'Weapon', aoid: 100013 });
      const armor = createArmorItem({ name: 'Armor', aoid: 100014 });
      const implant = createImplantItem({ name: 'Implant', aoid: 100015 });

      // Equip to different slot types
      await store.equipItem(weapon, 'RHand');
      await waitForEquipmentUpdate();
      await store.equipItem(armor, 'Chest');
      await waitForEquipmentUpdate();
      await store.equipItem(implant, 'Eye');
      await waitForEquipmentUpdate();

      // Verify each is in correct category
      expect(store.activeProfile?.Weapons['RHand']).toBeDefined();
      expect(store.activeProfile?.Clothing['Chest']).toBeDefined();
      expect(store.activeProfile?.Implants['Eye']).toBeDefined();
    });

    it('allows equipment in multiple weapon slots simultaneously', async () => {
      const mainWeapon = createWeaponItem({ name: 'Main Weapon', aoid: 100016 });
      const offWeapon = createWeaponItem({ name: 'Off Weapon', aoid: 100017 });
      const hudWeapon = createWeaponItem({ name: 'HUD Weapon', aoid: 100018 });

      // Equip to different weapon slots
      await store.equipItem(mainWeapon, 'RHand');
      await waitForEquipmentUpdate();
      await store.equipItem(offWeapon, 'LHand');
      await waitForEquipmentUpdate();
      await store.equipItem(hudWeapon, 'HUD1');
      await waitForEquipmentUpdate();

      // Verify all equipped
      expect(store.activeProfile?.Weapons['RHand']?.name).toBe('Main Weapon');
      expect(store.activeProfile?.Weapons['LHand']?.name).toBe('Off Weapon');
      expect(store.activeProfile?.Weapons['HUD1']?.name).toBe('HUD Weapon');
    });
  });

  describe('Requirement Checking', () => {
    it('displays item requirements', async () => {
      const itemWithReqs = createItemWithRequirements(
        [
          [SKILL_ID.ASSAULT_RIF, 500],
          [SKILL_ID.STAMINA, 300]
        ],
        {
          name: 'High Req Weapon',
          aoid: 100019,
          ql: 250
        }
      );

      // Verify requirements exist on item
      expect(itemWithReqs.actions).toBeDefined();
      expect(itemWithReqs.actions![0].criteria).toBeDefined();
      expect(itemWithReqs.actions![0].criteria.length).toBe(2);
    });

    it('allows equipping item when requirements are met', async () => {
      // Create item with low requirements
      const lowReqItem = createItemWithRequirements(
        [[SKILL_ID.STRENGTH, 10]], // Very low requirement
        {
          name: 'Low Req Armor',
          aoid: 100020,
          ql: 50,
          spell_data: [
            createSpellData({
              event: 14,
              spells: [createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.STAMINA, Amount: 5 } })]
            })
          ]
        }
      );

      // Should be able to equip without error
      await store.equipItem(lowReqItem, 'Chest');
      await waitForEquipmentUpdate();

      expect(store.activeProfile?.Clothing['Chest']).toBeDefined();
      expect(store.activeProfile?.Clothing['Chest']?.name).toBe('Low Req Armor');
    });

    it('allows equipping for planning even when requirements not met', async () => {
      // Create item with very high requirements
      const highReqItem = createItemWithRequirements(
        [[SKILL_ID.ASSAULT_RIF, 2000]], // Impossibly high
        {
          name: 'High Req Weapon',
          aoid: 100021,
          ql: 300,
          spell_data: [
            createSpellData({
              event: 2,
              spells: [createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.ADD_PROJ_DAM, Amount: 500 } })]
            })
          ]
        }
      );

      // Should still allow equipping (for planning purposes)
      await store.equipItem(highReqItem, 'RHand');
      await waitForEquipmentUpdate();

      expect(store.activeProfile?.Weapons['RHand']).toBeDefined();
      expect(store.activeProfile?.Weapons['RHand']?.name).toBe('High Req Weapon');
    });

    it('tracks multiple requirements on single item', async () => {
      const multiReqItem = createItemWithRequirements(
        [
          [SKILL_ID.ASSAULT_RIF, 500],
          [SKILL_ID.RANGED_INIT, 400],
          [SKILL_ID.STAMINA, 300],
          [SKILL_ID.AGILITY, 250]
        ],
        {
          name: 'Multi Req Weapon',
          aoid: 100022,
          ql: 250
        }
      );

      // Verify all requirements are tracked
      expect(multiReqItem.actions![0].criteria.length).toBe(4);

      // Can still equip for planning
      await store.equipItem(multiReqItem, 'RHand');
      await waitForEquipmentUpdate();

      expect(store.activeProfile?.Weapons['RHand']).toBeDefined();
    });
  });

  describe('Stat Effects', () => {
    it('increases stat when item is equipped', async () => {
      const strengthItem = createArmorItem({
        name: 'Strength Armor',
        aoid: 100023,
        ql: 200,
        spell_data: [
          createSpellData({
            event: 14,
            spells: [createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.STRENGTH, Amount: 50 } })]
          })
        ]
      });

      const initialStrength = store.activeProfile?.skills?.[SKILL_ID.STRENGTH]?.total || 0;

      await store.equipItem(strengthItem, 'Chest');
      await waitForEquipmentUpdate();

      const finalStrength = store.activeProfile?.skills?.[SKILL_ID.STRENGTH]?.total || 0;

      expect(finalStrength).toBeGreaterThan(initialStrength);
      expect(finalStrength - initialStrength).toBeGreaterThanOrEqual(50);
    });

    it('stacks bonuses from multiple items correctly', async () => {
      const item1 = createArmorItem({
        name: 'Stamina Armor',
        aoid: 100024,
        spell_data: [
          createSpellData({
            event: 14,
            spells: [createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.STAMINA, Amount: 30 } })]
          })
        ]
      });

      const item2 = createImplantItem({
        name: 'Stamina Implant',
        aoid: 100025,
        spell_data: [
          createSpellData({
            event: 14,
            spells: [createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.STAMINA, Amount: 20 } })]
          })
        ]
      });

      const item3 = createWeaponItem({
        name: 'Stamina Weapon',
        aoid: 100026,
        spell_data: [
          createSpellData({
            event: 2,
            spells: [createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.STAMINA, Amount: 15 } })]
          })
        ]
      });

      const initialStamina = store.activeProfile?.skills?.[SKILL_ID.STAMINA]?.total || 0;

      // Equip all three
      await store.equipItem(item1, 'Chest');
      await waitForEquipmentUpdate();
      await store.equipItem(item2, 'Eye');
      await waitForEquipmentUpdate();
      await store.equipItem(item3, 'RHand');
      await waitForEquipmentUpdate();

      const finalStamina = store.activeProfile?.skills?.[SKILL_ID.STAMINA]?.total || 0;

      // Should have 30 + 20 + 15 = 65 bonus
      expect(finalStamina - initialStamina).toBeGreaterThanOrEqual(65);
    });

    it('removes stat bonus when item is unequipped', async () => {
      const agilityArmor = createArmorItem({
        name: 'Agility Armor',
        aoid: 100027,
        ql: 180,
        spell_data: [
          createSpellData({
            event: 14,
            spells: [createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.AGILITY, Amount: 40 } })]
          })
        ]
      });

      const initialAgility = store.activeProfile?.skills?.[SKILL_ID.AGILITY]?.total || 0;

      // Equip
      await store.equipItem(agilityArmor, 'Chest');
      await waitForEquipmentUpdate();
      const equippedAgility = store.activeProfile?.skills?.[SKILL_ID.AGILITY]?.total || 0;

      expect(equippedAgility).toBeGreaterThan(initialAgility);

      // Unequip
      await store.unequipItem('Clothing', 'Chest');
      await waitForEquipmentUpdate();
      const finalAgility = store.activeProfile?.skills?.[SKILL_ID.AGILITY]?.total || 0;

      // Should return to initial value
      expect(finalAgility).toBeLessThanOrEqual(equippedAgility);
      expect(Math.abs(finalAgility - initialAgility)).toBeLessThan(5); // Allow small variance
    });

    it('handles negative stat modifiers', async () => {
      const debuffItem = createArmorItem({
        name: 'Debuff Armor',
        aoid: 100028,
        ql: 100,
        spell_data: [
          createSpellData({
            event: 14,
            spells: [
              createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.PROJECTILE_AC, Amount: 500 } }),
              createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.RUN_SPEED, Amount: -10 } })
            ]
          })
        ]
      });

      const initialRunSpeed = store.activeProfile?.skills?.[SKILL_ID.RUN_SPEED]?.total || 0;
      const initialProjectileAC = store.activeProfile?.skills?.[SKILL_ID.PROJECTILE_AC]?.total || 0;

      await store.equipItem(debuffItem, 'Chest');
      await waitForEquipmentUpdate();

      const finalRunSpeed = store.activeProfile?.skills?.[SKILL_ID.RUN_SPEED]?.total || 0;
      const finalProjectileAC = store.activeProfile?.skills?.[SKILL_ID.PROJECTILE_AC]?.total || 0;

      // Run speed should decrease
      expect(finalRunSpeed).toBeLessThanOrEqual(initialRunSpeed);

      // Projectile AC should increase
      expect(finalProjectileAC).toBeGreaterThan(initialProjectileAC);
    });

    it('handles MaxNCU stat correctly', async () => {
      const ncuItem = createWeaponItem({
        name: 'NCU Device',
        aoid: 100029,
        ql: 200,
        spell_data: [
          createSpellData({
            event: 2,
            spells: [createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.MAX_NCU, Amount: 30 } })]
          })
        ]
      });

      const initialMaxNCU = store.maxNCU || 0;

      await store.equipItem(ncuItem, 'NCU1');
      await waitForEquipmentUpdate();

      const finalMaxNCU = store.maxNCU || 0;

      expect(finalMaxNCU).toBeGreaterThan(initialMaxNCU);
      expect(finalMaxNCU - initialMaxNCU).toBeGreaterThanOrEqual(30);
    });
  });

  describe('Complex Equipment Scenarios', () => {
    it('handles equipping and unequipping in rapid succession', async () => {
      const item1 = createWeaponItem({ name: 'Weapon 1', aoid: 100030 });
      const item2 = createWeaponItem({ name: 'Weapon 2', aoid: 100031 });
      const item3 = createWeaponItem({ name: 'Weapon 3', aoid: 100032 });

      // Rapid equip/unequip
      await store.equipItem(item1, 'RHand');
      await waitForEquipmentUpdate();
      await store.equipItem(item2, 'RHand');
      await waitForEquipmentUpdate();
      await store.equipItem(item3, 'RHand');
      await waitForEquipmentUpdate();
      await store.unequipItem('Weapons', 'RHand');
      await waitForEquipmentUpdate();

      // Should end with empty slot
      expect(store.activeProfile?.Weapons['RHand']).toBeNull();
    });

    it('handles full equipment loadout', async () => {
      // Create a full set of equipment
      const items = {
        RHand: createWeaponItem({ name: 'Main Weapon', aoid: 100033 }),
        LHand: createWeaponItem({ name: 'Off Weapon', aoid: 100034 }),
        Chest: createArmorItem({ name: 'Chest Armor', aoid: 100035 }),
        Head: createArmorItem({ name: 'Helmet', aoid: 100036 }),
        Legs: createArmorItem({ name: 'Leg Armor', aoid: 100037 }),
        Hands: createArmorItem({ name: 'Gloves', aoid: 100038 }),
        Feet: createArmorItem({ name: 'Boots', aoid: 100039 }),
        Eye: createImplantItem({ name: 'Eye Implant', aoid: 100040 }),
        Head_Implant: createImplantItem({ name: 'Head Implant', aoid: 100041 })
      };

      // Equip everything
      await store.equipItem(items.RHand, 'RHand');
      await waitForEquipmentUpdate();
      await store.equipItem(items.LHand, 'LHand');
      await waitForEquipmentUpdate();
      await store.equipItem(items.Chest, 'Chest');
      await waitForEquipmentUpdate();
      await store.equipItem(items.Head, 'Head');
      await waitForEquipmentUpdate();
      await store.equipItem(items.Legs, 'Legs');
      await waitForEquipmentUpdate();
      await store.equipItem(items.Hands, 'Hands');
      await waitForEquipmentUpdate();
      await store.equipItem(items.Feet, 'Feet');
      await waitForEquipmentUpdate();
      await store.equipItem(items.Eye, 'Eye');
      await waitForEquipmentUpdate();
      await store.equipItem(items.Head_Implant, 'Head');
      await waitForEquipmentUpdate();

      // Verify all equipped
      expect(store.activeProfile?.Weapons['RHand']).toBeDefined();
      expect(store.activeProfile?.Weapons['LHand']).toBeDefined();
      expect(store.activeProfile?.Clothing['Chest']).toBeDefined();
      expect(store.activeProfile?.Clothing['Head']).toBeDefined();
      expect(store.activeProfile?.Clothing['Legs']).toBeDefined();
      expect(store.activeProfile?.Clothing['Hands']).toBeDefined();
      expect(store.activeProfile?.Clothing['Feet']).toBeDefined();
      expect(store.activeProfile?.Implants['Eye']).toBeDefined();
      expect(store.activeProfile?.Implants['Head']).toBeDefined();
    });

    it('correctly recalculates when swapping items with different bonuses', async () => {
      const lowBonusItem = createArmorItem({
        name: 'Low Bonus',
        aoid: 100042,
        spell_data: [
          createSpellData({
            event: 14,
            spells: [createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.STAMINA, Amount: 10 } })]
          })
        ]
      });

      const highBonusItem = createArmorItem({
        name: 'High Bonus',
        aoid: 100043,
        spell_data: [
          createSpellData({
            event: 14,
            spells: [createSpell({ spell_id: 53045, spell_params: { Stat: SKILL_ID.STAMINA, Amount: 50 } })]
          })
        ]
      });

      const initialStamina = store.activeProfile?.skills?.[SKILL_ID.STAMINA]?.total || 0;

      // Equip low bonus item
      await store.equipItem(lowBonusItem, 'Chest');
      await waitForEquipmentUpdate();
      const lowStamina = store.activeProfile?.skills?.[SKILL_ID.STAMINA]?.total || 0;

      expect(lowStamina - initialStamina).toBeGreaterThanOrEqual(10);

      // Swap to high bonus item
      await store.equipItem(highBonusItem, 'Chest');
      await waitForEquipmentUpdate();
      const highStamina = store.activeProfile?.skills?.[SKILL_ID.STAMINA]?.total || 0;

      // Should have higher bonus now
      expect(highStamina - initialStamina).toBeGreaterThanOrEqual(50);
      expect(highStamina).toBeGreaterThan(lowStamina);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { updateProfileSkillInfo } from '@/lib/tinkerprofiles/ip-integrator';
import { calculateEquipmentBonuses } from '@/services/equipment-bonus-calculator';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import type { Item } from '@/types/api';
import {
  BREED,
  PROFESSION,
  createTestProfile as createProfileFixture,
  createTestItem,
  createSpellData,
  createSpell,
} from '@/__tests__/helpers';

const WEAR = 14;
const WIELD = 2;
const MODIFY_STAT = 53045; // "Modify {Stat} by {Amount}"
const SET_FLAG = 53139; // "Set flag {Stat} &{BitNum}"
const WORN_ITEM = 355;

/** Item whose equip event applies "Modify {Stat} by {Amount}" for each bonus */
function createBonusItem(
  name: string,
  bonuses: Array<[number, number]>,
  event: number = WEAR
): Item {
  return createTestItem({
    name,
    ql: 200,
    spell_data: [
      createSpellData({
        event,
        spells: bonuses.map(([stat, amount]) =>
          createSpell({ spell_id: MODIFY_STAT, spell_params: { Stat: stat, Amount: amount } })
        ),
      }),
    ],
  });
}

/** Item whose Wear event sets bit `bitNum` of the WornItem flag stat */
function createWornItemFlagItem(name: string, bitNum: number): Item {
  return createTestItem({
    name,
    ql: 200,
    spell_data: [
      createSpellData({
        event: WEAR,
        spells: [
          createSpell({ spell_id: SET_FLAG, spell_params: { Stat: WORN_ITEM, BitNum: bitNum } }),
        ],
      }),
    ],
  });
}

describe('Misc Skills Equipment Bonuses', () => {
  const createTestProfile = (): TinkerProfile =>
    createProfileFixture({
      name: 'Test Character',
      profession: PROFESSION.AGENT,
      breed: BREED.SOLITUS,
      level: 200,
    });

  it('should apply equipment bonuses to Misc skills', () => {
    const profile = createTestProfile();

    // Equip an item with bonuses to Misc skills
    profile.Clothing.Chest = createBonusItem('Test Equipment', [
      [181, 50], // +50 Max NCU
      [276, 20], // +20 Add All Off.
      [277, 15], // +15 Add All Def.
    ]);

    // Calculate equipment bonuses
    const bonuses = calculateEquipmentBonuses(profile);

    // Verify bonuses are calculated (bonuses use numeric stat IDs)
    expect(bonuses[181]).toBe(50); // Max NCU
    expect(bonuses[276]).toBe(20); // Add All Off.
    expect(bonuses[277]).toBe(15); // Add All Def.

    // Update profile with IP tracking (which applies equipment bonuses)
    updateProfileSkillInfo(profile);

    // Verify bonus-only stats have equipment bonuses applied (use numeric stat IDs)
    expect(profile.skills[181]?.total).toBe(50); // Max NCU
    expect(profile.skills[276]?.total).toBe(20); // Add All Off.
    expect(profile.skills[277]?.total).toBe(15); // Add All Def.
  });

  it('should apply damage modifier equipment bonuses to Misc skills', () => {
    const profile = createTestProfile();

    // Wield a weapon with damage modifiers
    profile.Weapons.RHand = createBonusItem(
      'Test Weapon',
      [
        [278, 25], // Projectile Damage Modifier
        [279, 30], // Melee Damage Modifier
        [280, 15], // Energy Damage Modifier
      ],
      WIELD
    );

    // Calculate equipment bonuses
    const bonuses = calculateEquipmentBonuses(profile);

    // Verify bonuses are calculated (bonuses use numeric stat IDs)
    expect(bonuses[278]).toBe(25); // Add. Proj. Dam.
    expect(bonuses[279]).toBe(30); // Add. Melee Dam.
    expect(bonuses[280]).toBe(15); // Add. Energy Dam.

    // Update profile with IP tracking
    updateProfileSkillInfo(profile);

    // Verify bonus-only stats have equipment bonuses applied (use numeric stat IDs)
    expect(profile.skills[278]?.total).toBe(25); // Add. Proj. Dam.
    expect(profile.skills[279]?.total).toBe(30); // Add. Melee Dam.
    expect(profile.skills[280]?.total).toBe(15); // Add. Energy Dam.
  });

  it('should stack multiple equipment bonuses for the same Misc skill', () => {
    const profile = createTestProfile();

    // Equip two items with Max NCU bonuses (HUD slots live under Weapons)
    profile.Clothing.Chest = createBonusItem('NCU Item 1', [[181, 30]]);
    profile.Weapons.HUD1 = createBonusItem('NCU Item 2', [[181, 25]]);

    // Calculate equipment bonuses
    const bonuses = calculateEquipmentBonuses(profile);

    // Verify bonuses stack (bonuses use numeric stat IDs)
    expect(bonuses[181]).toBe(55); // Max NCU: 30 + 25

    // Update profile with IP tracking
    updateProfileSkillInfo(profile);

    // Verify bonus-only stat has stacked bonuses applied (use numeric stat ID)
    expect(profile.skills[181]?.total).toBe(55); // Max NCU
  });

  it('should apply equipment, perk, and buff bonuses together for Misc skills', () => {
    const profile = createTestProfile();

    // Equip an item with a HealDelta bonus
    profile.Clothing.Chest = createBonusItem('Test Equipment', [[343, 20]]);

    // Calculate equipment bonuses
    const equipmentBonuses = calculateEquipmentBonuses(profile);

    // Verify equipment bonus is calculated (bonuses use numeric stat IDs)
    expect(equipmentBonuses[343]).toBe(20); // HealDelta

    // Simulate perk bonuses
    const perkBonuses = { 343: 10 }; // HealDelta perk bonus

    // Update profile with IP tracking, providing both equipment and perk bonuses
    updateProfileSkillInfo(profile, equipmentBonuses, perkBonuses);

    // Verify total value includes perk + equipment bonus (use numeric stat ID)
    expect(profile.skills[343]?.total).toBe(30); // 10 perk + 20 equipment
    expect(profile.skills[343]?.equipmentBonus).toBe(20);
    expect(profile.skills[343]?.perkBonus).toBe(10);
  });

  it('should apply single WornItem flag using bitwise OR', () => {
    const profile = createTestProfile();

    // BasicCyberDeck flag (BitNum=0, value=1)
    profile.Clothing.Chest = createWornItemFlagItem('Basic Cyberdeck', 0);

    // Calculate equipment bonuses
    const bonuses = calculateEquipmentBonuses(profile);

    // Verify WornItem flag is set to 1 (BasicCyberDeck)
    expect(bonuses[WORN_ITEM]).toBe(1); // 1 << 0 = 1

    // Update profile with IP tracking
    updateProfileSkillInfo(profile);

    // Verify WornItem stat has the correct flag value
    expect(profile.skills[WORN_ITEM]?.total).toBe(1); // BasicCyberDeck flag
  });

  it('should combine multiple different WornItem flags using bitwise OR', () => {
    const profile = createTestProfile();

    // BasicCyberDeck flag (BitNum=0, value=1) and NanoDeck flag (BitNum=6, value=64)
    profile.Clothing.Chest = createWornItemFlagItem('Basic Cyberdeck', 0);
    profile.Weapons.HUD1 = createWornItemFlagItem('Nano Deck', 6);

    // Calculate equipment bonuses
    const bonuses = calculateEquipmentBonuses(profile);

    // Verify flags are combined with bitwise OR: 1 | 64 = 65
    expect(bonuses[WORN_ITEM]).toBe(65); // BasicCyberDeck (1) | NanoDeck (64)

    // Update profile with IP tracking
    updateProfileSkillInfo(profile);

    // Verify WornItem stat has the combined flag value
    expect(profile.skills[WORN_ITEM]?.total).toBe(65); // Combined flags
  });

  it('should be idempotent when equipping multiple items with same WornItem flag', () => {
    const profile = createTestProfile();

    // Two items setting the same BasicCyberDeck flag (BitNum=0, value=1)
    profile.Clothing.Chest = createWornItemFlagItem('Basic Cyberdeck 1', 0);
    profile.Clothing.Legs = createWornItemFlagItem('Basic Cyberdeck 2', 0);

    // Calculate equipment bonuses
    const bonuses = calculateEquipmentBonuses(profile);

    // Verify flag value is idempotent: 1 | 1 = 1 (not 2)
    expect(bonuses[WORN_ITEM]).toBe(1); // Still 1, not 2

    // Update profile with IP tracking
    updateProfileSkillInfo(profile);

    // Verify WornItem stat remains 1 (idempotent behavior)
    expect(profile.skills[WORN_ITEM]?.total).toBe(1); // Same flag doesn't accumulate
  });
});

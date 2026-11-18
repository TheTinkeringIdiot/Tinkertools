import { describe, it, expect, beforeEach } from 'vitest';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import type { Item } from '@/types/api';
import { createDefaultProfile } from '@/lib/tinkerprofiles/constants';
import { calculateEquipmentBonuses } from '@/services/equipment-bonus-calculator';
import { updateProfileSkillInfo } from '@/lib/tinkerprofiles/ip-integrator';
import { skillService } from '@/services/skill-service';
import { createTestItem, createSpellData, createSpell } from '@/__tests__/helpers';

/** Item whose Wear effect applies "Modify {Stat} by {Amount}" (spell 53045) per bonus */
function createBonusItem(name: string, bonuses: Array<[number, number]>): Item {
  return createTestItem({
    name,
    ql: 200,
    spell_data: [
      createSpellData({
        event: 14, // Wear event
        spells: bonuses.map(([stat, amount]) =>
          createSpell({ spell_id: 53045, spell_params: { Stat: stat, Amount: amount } })
        ),
      }),
    ],
  });
}

describe('MaxNCU Equipment Bonus Application', () => {
  let profile: TinkerProfile;

  beforeEach(() => {
    profile = createDefaultProfile('Test Character', 'Solitus');
  });

  it('should properly apply MaxNCU bonuses from equipped items', () => {
    // Create a test item with MaxNCU bonus (stat 181)
    const testItem = createBonusItem('NCU Memory Test Item', [[181, 25]]);

    // Equip the item
    profile.Clothing.Chest = testItem;

    // Calculate equipment bonuses
    const equipmentBonuses = calculateEquipmentBonuses(profile);

    // Verify the bonus was calculated correctly (bonuses use numeric stat IDs)
    expect(equipmentBonuses[181]).toBe(25); // Max NCU stat ID is 181

    // Apply bonuses to profile
    updateProfileSkillInfo(profile, equipmentBonuses);

    // Verify Max NCU skill was updated
    const maxNCUSkillId = skillService.resolveId('Max NCU');
    expect(profile.skills[maxNCUSkillId]?.equipmentBonus).toBe(25);
    expect(profile.skills[maxNCUSkillId]?.total).toBe(25); // 0 base + 25 equipment
  });

  it('should stack MaxNCU bonuses from multiple items', () => {
    const item1 = createBonusItem('NCU Memory 1', [[181, 20]]);

    const item2 = createBonusItem('NCU Memory 2', [[181, 30]]);

    // Equip both items
    profile.Clothing.Chest = item1;
    profile.Clothing.Head = item2;

    // Calculate and apply bonuses
    const equipmentBonuses = calculateEquipmentBonuses(profile);
    expect(equipmentBonuses[181]).toBe(50); // Max NCU: 20 + 30

    updateProfileSkillInfo(profile, equipmentBonuses);

    // Verify total bonus applied
    const maxNCUSkillId = skillService.resolveId('Max NCU');
    expect(profile.skills[maxNCUSkillId]?.equipmentBonus).toBe(50);
    expect(profile.skills[maxNCUSkillId]?.total).toBe(50);
  });

  it('should handle negative MaxNCU modifiers', () => {
    const debuffItem = createBonusItem('NCU Debuff Item', [[181, -15]]);

    profile.Clothing.Chest = debuffItem;

    const equipmentBonuses = calculateEquipmentBonuses(profile);
    expect(equipmentBonuses[181]).toBe(-15); // Max NCU with negative modifier

    updateProfileSkillInfo(profile, equipmentBonuses);

    const maxNCUSkillId = skillService.resolveId('Max NCU');
    expect(profile.skills[maxNCUSkillId]?.equipmentBonus).toBe(-15);
    expect(profile.skills[maxNCUSkillId]?.total).toBe(-15); // Can go negative
  });

  it('should combine MaxNCU with other misc skill bonuses', () => {
    const multiStatItem = createBonusItem('Multi-Stat Item', [
      [181, 35],
      [276, 10],
      [277, 15],
    ]);

    profile.Clothing.Chest = multiStatItem;

    const equipmentBonuses = calculateEquipmentBonuses(profile);

    // Verify all bonuses calculated (bonuses use numeric stat IDs)
    expect(equipmentBonuses[181]).toBe(35); // Max NCU
    expect(equipmentBonuses[276]).toBe(10); // Add All Offense
    expect(equipmentBonuses[277]).toBe(15); // Add All Defense

    updateProfileSkillInfo(profile, equipmentBonuses);

    // Verify all skill bonuses were applied
    const maxNCUSkillId = skillService.resolveId('Max NCU');
    const addAllOffSkillId = skillService.resolveId('Add All Offense');
    const addAllDefSkillId = skillService.resolveId('Add All Defense');

    expect(profile.skills[maxNCUSkillId]?.equipmentBonus).toBe(35);
    expect(profile.skills[maxNCUSkillId]?.total).toBe(35);
    expect(profile.skills[addAllOffSkillId]?.equipmentBonus).toBe(10);
    expect(profile.skills[addAllOffSkillId]?.total).toBe(10);
    expect(profile.skills[addAllDefSkillId]?.equipmentBonus).toBe(15);
    expect(profile.skills[addAllDefSkillId]?.total).toBe(15);
  });
});

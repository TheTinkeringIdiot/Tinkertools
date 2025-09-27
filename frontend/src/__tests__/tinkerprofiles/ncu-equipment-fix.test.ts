import { describe, it, expect, beforeEach } from 'vitest';
import type { TinkerProfile, Item } from '@/lib/tinkerprofiles/types';
import { createDefaultProfile } from '@/lib/tinkerprofiles/constants';
import { calculateEquipmentBonuses } from '@/services/equipment-bonus-calculator';
import { updateProfileSkillInfo } from '@/lib/tinkerprofiles/ip-integrator';
import { skillService } from '@/services/skill-service';

describe('MaxNCU Equipment Bonus Application', () => {
  let profile: TinkerProfile;

  beforeEach(() => {
    profile = createDefaultProfile('Test Character', 'Solitus');
  });

  it('should properly apply MaxNCU bonuses from equipped items', () => {
    // Create a test item with MaxNCU bonus (stat 181)
    const testItem: Item = {
      aoid: 12345,
      name: 'NCU Memory Test Item',
      ql: 200,
      spell_data: [
        {
          event: 14, // Wear event
          spells: [
            {
              spell_id: 53045, // Stat modification spell
              spell_params: {
                Stat: 181, // MaxNCU stat ID
                Amount: 25 // +25 NCU bonus
              }
            }
          ]
        }
      ]
    } as any;

    // Equip the item
    profile.Clothing.Chest = testItem;

    // Calculate equipment bonuses
    const equipmentBonuses = calculateEquipmentBonuses(profile);

    // Verify the bonus was calculated correctly
    expect(equipmentBonuses['Max NCU']).toBe(25);

    // Apply bonuses to profile
    updateProfileSkillInfo(profile, equipmentBonuses);

    // Verify Max NCU skill was updated
    const maxNCUSkillId = skillService.resolveId('Max NCU');
    expect(profile.skills[maxNCUSkillId].equipmentBonus).toBe(25);
    expect(profile.skills[maxNCUSkillId].value).toBe(25); // 0 base + 25 equipment
  });

  it('should stack MaxNCU bonuses from multiple items', () => {
    const item1: Item = {
      aoid: 12346,
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
                Amount: 20
              }
            }
          ]
        }
      ]
    } as any;

    const item2: Item = {
      aoid: 12347,
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
                Amount: 30
              }
            }
          ]
        }
      ]
    } as any;

    // Equip both items
    profile.Clothing.Chest = item1;
    profile.Clothing.Head = item2;

    // Calculate and apply bonuses
    const equipmentBonuses = calculateEquipmentBonuses(profile);
    expect(equipmentBonuses['Max NCU']).toBe(50); // 20 + 30

    updateProfileSkillInfo(profile, equipmentBonuses);

    // Verify total bonus applied
    const maxNCUSkillId = skillService.resolveId('Max NCU');
    expect(profile.skills[maxNCUSkillId].equipmentBonus).toBe(50);
    expect(profile.skills[maxNCUSkillId].value).toBe(50);
  });

  it('should handle negative MaxNCU modifiers', () => {
    const debuffItem: Item = {
      aoid: 12348,
      name: 'NCU Debuff Item',
      ql: 200,
      spell_data: [
        {
          event: 14,
          spells: [
            {
              spell_id: 53045,
              spell_params: {
                Stat: 181,
                Amount: -15
              }
            }
          ]
        }
      ]
    } as any;

    profile.Clothing.Chest = debuffItem;

    const equipmentBonuses = calculateEquipmentBonuses(profile);
    expect(equipmentBonuses['Max NCU']).toBe(-15);

    updateProfileSkillInfo(profile, equipmentBonuses);

    const maxNCUSkillId = skillService.resolveId('Max NCU');
    expect(profile.skills[maxNCUSkillId].equipmentBonus).toBe(-15);
    expect(profile.skills[maxNCUSkillId].value).toBe(-15); // Can go negative
  });

  it('should combine MaxNCU with other misc skill bonuses', () => {
    const multiStatItem: Item = {
      aoid: 12349,
      name: 'Multi-Stat Item',
      ql: 200,
      spell_data: [
        {
          event: 14,
          spells: [
            {
              spell_id: 53045,
              spell_params: {
                Stat: 181, // MaxNCU
                Amount: 35
              }
            },
            {
              spell_id: 53045,
              spell_params: {
                Stat: 276, // Add All Off
                Amount: 10
              }
            },
            {
              spell_id: 53045,
              spell_params: {
                Stat: 277, // Add All Def
                Amount: 15
              }
            }
          ]
        }
      ]
    } as any;

    profile.Clothing.Chest = multiStatItem;

    const equipmentBonuses = calculateEquipmentBonuses(profile);

    // Verify all bonuses calculated (using the skill names returned by getSkillNameFromStatId)
    expect(equipmentBonuses['Max NCU']).toBe(35);
    expect(equipmentBonuses['Add All Offense']).toBe(10);
    expect(equipmentBonuses['Add All Defense']).toBe(15);

    updateProfileSkillInfo(profile, equipmentBonuses);

    console.log('Skills after update:', Object.keys(profile.skills));

    // Verify all skill bonuses were applied
    const maxNCUSkillId = skillService.resolveId('Max NCU');
    const addAllOffSkillId = skillService.resolveId('Add All Offense');
    const addAllDefSkillId = skillService.resolveId('Add All Defense');

    expect(profile.skills[maxNCUSkillId].equipmentBonus).toBe(35);
    expect(profile.skills[maxNCUSkillId].value).toBe(35);
    expect(profile.skills[addAllOffSkillId].equipmentBonus).toBe(10);
    expect(profile.skills[addAllOffSkillId].value).toBe(10);
    expect(profile.skills[addAllDefSkillId].equipmentBonus).toBe(15);
    expect(profile.skills[addAllDefSkillId].value).toBe(15);
  });
});
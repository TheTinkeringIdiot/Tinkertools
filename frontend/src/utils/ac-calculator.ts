/**
 * AC Calculator Utility
 *
 * Calculates AC values on-the-fly from equipment, perk, and buff bonuses
 * ACs have no base value (always start at 0) and are purely bonus-driven
 */

import type { TinkerProfile } from '@/lib/tinkerprofiles';
import { calculateEquipmentBonuses } from '@/services/equipment-bonus-calculator';
import { calculatePerkBonuses } from '@/services/perk-bonus-calculator';
import { calculateNanoBonuses } from '@/services/nano-bonus-calculator';
import { skillService } from '@/services/skill-service';

/**
 * Calculate all AC values for a profile
 * @param profile - The TinkerProfile to calculate ACs for
 * @returns Object with AC names as keys and calculated values
 */
export function calculateACValues(profile: TinkerProfile): Record<string, number> {
  const acValues: Record<string, number> = {};

  // Get all bonuses
  const equipmentBonuses = calculateEquipmentBonuses(profile);

  // Calculate perk bonuses if perks are present
  let perkBonuses: Record<string, number> = {};
  if (profile.PerksAndResearch) {
    try {
      const allPerkItems: any[] = [];

      // Add SL/AI perks
      if (profile.PerksAndResearch.perks && Array.isArray(profile.PerksAndResearch.perks)) {
        profile.PerksAndResearch.perks.forEach(perkEntry => {
          if (perkEntry && perkEntry.item) {
            allPerkItems.push(perkEntry.item);
          }
        });
      }

      // Add LE research
      if (profile.PerksAndResearch.research && Array.isArray(profile.PerksAndResearch.research)) {
        profile.PerksAndResearch.research.forEach(researchEntry => {
          if (researchEntry && researchEntry.item) {
            allPerkItems.push(researchEntry.item);
          }
        });
      }

      if (allPerkItems.length > 0) {
        const perkBonusesBySkillId = calculatePerkBonuses(allPerkItems);

        // Convert skill IDs back to skill names for AC lookup
        perkBonuses = {};
        for (const [skillIdStr, bonusAmount] of Object.entries(perkBonusesBySkillId)) {
          const skillId = Number(skillIdStr);
          try {
            const skillName = skillService.getName(skillId);
            perkBonuses[skillName] = bonusAmount;
          } catch (error) {
            // Log unknown skill IDs but continue processing
            console.warn(`Failed to convert skill ID ${skillId} to name in AC calculation:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to calculate perk bonuses for ACs:', error);
    }
  }

  // Calculate buff bonuses if buffs are present
  let buffBonuses: Record<string, number> = {};
  if (profile.buffs && Array.isArray(profile.buffs) && profile.buffs.length > 0) {
    try {
      buffBonuses = calculateNanoBonuses(profile.buffs);
    } catch (error) {
      console.warn('Failed to calculate buff bonuses for ACs:', error);
    }
  }

  // List of AC types we track (matching profile data structure)
  const acTypes = [
    'Chemical AC',
    'Cold AC',
    'Energy AC',
    'Fire AC',
    'Melee/ma AC',  // Changed from 'Melee AC'
    'Disease AC',   // This is 'Poison AC' in STAT but 'Disease AC' in profile
    'Imp/Proj AC',  // Changed from 'Projectile AC'
    'Radiation AC'
  ];

  // Calculate each AC value as sum of all bonuses (no base value)
  acTypes.forEach(acName => {
    const equipmentBonus = equipmentBonuses[acName] || 0;
    const perkBonus = perkBonuses[acName] || 0;
    const buffBonus = buffBonuses[acName] || 0;

    acValues[acName] = equipmentBonus + perkBonus + buffBonus;
  });

  return acValues;
}

/**
 * Calculate a single AC value for a profile
 * @param profile - The TinkerProfile to calculate AC for
 * @param acName - Name of the specific AC to calculate
 * @returns The calculated AC value
 */
export function calculateSingleACValue(profile: TinkerProfile, acName: string): number {
  const allACs = calculateACValues(profile);
  return allACs[acName] || 0;
}
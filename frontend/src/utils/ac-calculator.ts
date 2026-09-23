/**
 * AC Calculator Utility
 *
 * Calculates AC values on-the-fly from equipment, perk, and buff bonuses
 * ACs have no base value (always start at 0) and are purely bonus-driven
 */

import type { TinkerProfile } from '@/lib/tinkerprofiles';
import type { Item } from '@/types/api';
import { calculateEquipmentBonuses } from '@/services/equipment-bonus-calculator';
import { calculatePerkBonuses } from '@/services/perk-bonus-calculator';
import { calculateNanoBonuses } from '@/services/nano-bonus-calculator';

/** AC names (as shown in profiles) and their stat IDs */
const AC_STAT_IDS: Record<string, number> = {
  'Imp/Proj AC': 90,
  'Melee/ma AC': 91,
  'Energy AC': 92,
  'Chemical AC': 93,
  'Radiation AC': 94,
  'Cold AC': 95,
  'Disease AC': 96, // PoisonAC in STAT
  'Fire AC': 97,
};

/**
 * Calculate all AC values for a profile
 * @param profile - The TinkerProfile to calculate ACs for
 * @returns Object with AC names as keys and calculated values
 */
export function calculateACValues(profile: TinkerProfile): Record<string, number> {
  // All bonus calculators key their results by stat ID
  const equipmentBonuses = calculateEquipmentBonuses(profile);

  // Calculate perk bonuses if perks are present
  let perkBonuses: Record<number, number> = {};
  if (profile.PerksAndResearch) {
    try {
      const allPerkItems: Item[] = [];

      // Add SL/AI perks
      if (profile.PerksAndResearch.perks && Array.isArray(profile.PerksAndResearch.perks)) {
        profile.PerksAndResearch.perks.forEach((perkEntry) => {
          if (perkEntry && perkEntry.item) {
            allPerkItems.push(perkEntry.item);
          }
        });
      }

      // Add LE research
      if (profile.PerksAndResearch.research && Array.isArray(profile.PerksAndResearch.research)) {
        profile.PerksAndResearch.research.forEach((researchEntry) => {
          if (researchEntry && researchEntry.item) {
            allPerkItems.push(researchEntry.item);
          }
        });
      }

      if (allPerkItems.length > 0) {
        perkBonuses = calculatePerkBonuses(allPerkItems);
      }
    } catch (error) {
      console.warn('Failed to calculate perk bonuses for ACs:', error);
    }
  }

  // Calculate buff bonuses if buffs are present
  let buffBonuses: Record<number, number> = {};
  if (profile.buffs && Array.isArray(profile.buffs) && profile.buffs.length > 0) {
    try {
      buffBonuses = calculateNanoBonuses(profile.buffs);
    } catch (error) {
      console.warn('Failed to calculate buff bonuses for ACs:', error);
    }
  }

  // Calculate each AC value as sum of all bonuses (no base value)
  const acValues: Record<string, number> = {};
  for (const [acName, statId] of Object.entries(AC_STAT_IDS)) {
    const equipmentBonus = equipmentBonuses[statId] || 0;
    const perkBonus = perkBonuses[statId] || 0;
    const buffBonus = buffBonuses[statId] || 0;

    acValues[acName] = equipmentBonus + perkBonus + buffBonus;
  }

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

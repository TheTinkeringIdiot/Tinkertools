/**
 * Weapon Usability Utilities
 *
 * Pure functions for checking weapon requirements against character skills.
 * Extracted from fiteStore.ts for reuse without store dependency.
 */

import type {
  Weapon,
  CharacterSkills,
  WeaponUsability,
  WeaponRequirement,
} from '@/types/weapon';
import { SKILL_NAMES } from '@/types/weapon';

/**
 * Check if a character can use a weapon based on their skills
 * @param weapon - The weapon to check
 * @param skills - Character's skill values (stat ID → value)
 * @returns Usability result with requirements breakdown
 */
export function checkWeaponUsability(
  weapon: Weapon,
  skills: CharacterSkills
): WeaponUsability {
  const requirements: WeaponRequirement[] = [];
  const missingRequirements: WeaponRequirement[] = [];

  // Check each stat requirement
  weapon.stats.forEach((stat) => {
    const skillName = SKILL_NAMES[stat.stat];
    if (skillName) {
      const characterValue = skills[stat.stat] || 0;
      const requirement: WeaponRequirement = {
        stat: stat.stat,
        statName: skillName,
        value: stat.value,
        met: characterValue >= stat.value,
        characterValue,
      };

      requirements.push(requirement);

      if (!requirement.met) {
        missingRequirements.push(requirement);
      }
    }
  });

  return {
    canUse: missingRequirements.length === 0,
    requirements,
    missingRequirements,
  };
}

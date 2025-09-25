/**
 * IP Integration for TinkerProfiles
 * 
 * Integrates IP calculation system with TinkerProfile management,
 * providing automatic IP tracking, validation, and recalculation
 */

import type { TinkerProfile, IPTracker, SkillWithIP } from './types';
import {
  calcIP,
  calcTitleLevel,
  calcTotalAbilityCost,
  calcTotalSkillCost,
  calcAllTrickleDown,
  calcSkillCap,
  calcAbilityMaxValue,
  calcIPAnalysis,
  validateCharacterBuild,
  getBreedInitValue,
  ABILITY_NAMES,
  ABILITY_INDEX_TO_STAT_ID,
  type CharacterStats,
  type IPCalculationResult
} from './ip-calculator';

import { getBreedId, getProfessionId } from '../../services/game-utils';
import { getSkillId, getSkillName } from './skill-mappings';
import { calculateEquipmentBonuses } from '../../services/equipment-bonus-calculator';
import { calculatePerkBonuses as calculatePerkBonusesService } from '../../services/perk-bonus-calculator';
import { calculateNanoBonuses } from '../../services/nano-bonus-calculator';
import type { AnyPerkEntry } from './perk-types';

// ============================================================================
// Profile to CharacterStats Conversion
// ============================================================================

/**
 * Convert TinkerProfile to CharacterStats for IP calculations
 */
export function profileToCharacterStats(profile: TinkerProfile): CharacterStats {
  // Get breed and profession IDs
  const breed = getBreedId(profile.Character.Breed) || 0;
  const profession = getProfessionId(profile.Character.Profession) || 0;
  
  // Extract abilities (improvements only for IP calculations)
  const abilities = [
    profile.Skills.Attributes.Strength.pointFromIp || 0,
    profile.Skills.Attributes.Agility.pointFromIp || 0,
    profile.Skills.Attributes.Stamina.pointFromIp || 0,
    profile.Skills.Attributes.Intelligence.pointFromIp || 0,
    profile.Skills.Attributes.Sense.pointFromIp || 0,
    profile.Skills.Attributes.Psychic.pointFromIp || 0
  ];
  
  // Extract skills (improvements only) using STAT ID mapping
  const skills: Record<string, number> = {};
  
  // Category names for skill extraction
  const categories = [
    'Body & Defense',
    'Ranged Weapons', 
    'Ranged Specials',
    'Melee Weapons',
    'Melee Specials',
    'Nanos & Casting',
    'Exploring',
    'Trade & Repair',
    'Combat & Healing'
  ];
  
  // Fill in known skills from profile using proper STAT ID mapping
  categories.forEach(categoryName => {
    const category = profile.Skills[categoryName as keyof typeof profile.Skills];
    if (category && typeof category === 'object') {
      Object.entries(category).forEach(([skillName, skillData]: [string, any]) => {
        const skillStatId = getSkillId(skillName);
        if (skillStatId !== null && skillStatId >= 0 && skillData.pointFromIp !== undefined) {
          skills[skillStatId.toString()] = skillData.pointFromIp;
        }
      });
    }
  });
  
  return {
    level: profile.Character.Level,
    breed,
    profession,
    abilities,
    skills
  };
}

// ============================================================================
// Perk Bonus Calculation
// ============================================================================

/**
 * Calculate perk bonuses for skills and abilities from profile's perk system
 */
async function calculatePerkBonuses(profile: TinkerProfile): Promise<Record<string, number>> {
  if (!profile.PerksAndResearch) {
    return {};
  }

  try {
    // Collect all equipped perks (both SL/AI perks and LE research)
    const allPerkItems: any[] = [];

    // Add SL/AI perks that have item data
    if (profile.PerksAndResearch.perks && Array.isArray(profile.PerksAndResearch.perks)) {
      profile.PerksAndResearch.perks.forEach(perkEntry => {
        if (perkEntry && perkEntry.item) {
          allPerkItems.push(perkEntry.item);
        }
      });
    }

    // Add LE research that have item data
    if (profile.PerksAndResearch.research && Array.isArray(profile.PerksAndResearch.research)) {
      profile.PerksAndResearch.research.forEach(researchEntry => {
        if (researchEntry && researchEntry.item) {
          allPerkItems.push(researchEntry.item);
        }
      });
    }

    if (allPerkItems.length === 0) {
      return {};
    }

    // Use the perk bonus calculator service to extract and aggregate stat bonuses
    const perkBonuses = calculatePerkBonusesService(allPerkItems);

    return perkBonuses;
  } catch (error) {
    console.warn('Failed to calculate perk bonuses:', error);
    return {};
  }
}

// ============================================================================
// Buff Bonus Calculation
// ============================================================================

/**
 * Calculate buff bonuses for skills and abilities from profile's active nano buffs
 */
function calculateBuffBonuses(profile: TinkerProfile): Record<string, number> {
  if (!profile.buffs || !Array.isArray(profile.buffs) || profile.buffs.length === 0) {
    return {};
  }

  try {
    // Use the nano bonus calculator service to extract and aggregate stat bonuses
    const buffBonuses = calculateNanoBonuses(profile.buffs);

    return buffBonuses;
  } catch (error) {
    console.warn('Failed to calculate buff bonuses:', error);
    return {};
  }
}

// ============================================================================
// IP Calculation and Updates
// ============================================================================

/**
 * Calculate comprehensive IP information for a profile
 */
export function calculateProfileIP(profile: TinkerProfile): IPTracker {
  const characterStats = profileToCharacterStats(profile);
  const ipAnalysis = calcIPAnalysis(characterStats);
  
  // Calculate breakdown by abilities using STAT IDs
  const abilityBreakdown: Record<string, number> = {};
  ABILITY_NAMES.forEach((abilityName, index) => {
    const breed = getBreedId(profile.Character.Breed) || 0;
    const ability = profile.Skills.Attributes[abilityName as keyof typeof profile.Skills.Attributes] as SkillWithIP;
    const improvements = ability?.pointFromIp || 0;
    const abilityStatId = ABILITY_INDEX_TO_STAT_ID[index];
    abilityBreakdown[abilityName] = calcTotalAbilityCost(improvements, breed, abilityStatId);
  });
  
  // Calculate breakdown by skill categories
  const skillCategoryBreakdown: Record<string, number> = {};
  const categories = [
    'Body & Defense',
    'Ranged Weapons', 
    'Ranged Specials',
    'Melee Weapons',
    'Melee Specials',
    'Nanos & Casting',
    'Exploring',
    'Trade & Repair',
    'Combat & Healing'
  ];
  
  categories.forEach(category => {
    skillCategoryBreakdown[category] = 0;
    const skills = profile.Skills[category as keyof typeof profile.Skills];
    if (skills && typeof skills === 'object') {
      Object.values(skills).forEach((skill: any) => {
        if (skill.ipSpent) {
          skillCategoryBreakdown[category] += skill.ipSpent;
        }
      });
    }
  });
  
  return {
    totalAvailable: ipAnalysis.totalIP,
    totalUsed: ipAnalysis.usedIP,
    remaining: ipAnalysis.availableIP,
    abilityIP: ipAnalysis.abilityIP,
    skillIP: ipAnalysis.skillIP,
    efficiency: ipAnalysis.efficiency,
    lastCalculated: new Date().toISOString(),
    breakdown: {
      abilities: abilityBreakdown,
      skillCategories: skillCategoryBreakdown
    }
  };
}

/**
 * Update all skill caps, ability caps, and trickle-down bonuses in a profile
 */
export function updateProfileSkillInfo(
  profile: TinkerProfile,
  providedEquipmentBonuses?: Record<string, number>,
  providedPerkBonuses?: Record<string, number>,
  providedBuffBonuses?: Record<string, number>
): void {
  const characterStats = profileToCharacterStats(profile);

  // Use provided equipment bonuses or calculate them
  const equipmentBonuses = providedEquipmentBonuses || calculateEquipmentBonuses(profile);

  // Use provided perk bonuses or calculate them
  const perkBonuses = providedPerkBonuses || {};

  // Use provided buff bonuses or calculate them
  const buffBonuses = providedBuffBonuses || calculateBuffBonuses(profile);

  // First, ensure pointFromIp is set for all abilities (needed for tests that set value directly)
  if (profile.Skills.Attributes) {
    const abilityNames = ['Strength', 'Agility', 'Stamina', 'Intelligence', 'Sense', 'Psychic'];
    abilityNames.forEach((abilityName, index) => {
      const ability = profile.Skills.Attributes![abilityName as keyof typeof profile.Skills.Attributes] as SkillWithIP;
      if (ability) {
        const abilityStatId = ABILITY_INDEX_TO_STAT_ID[index];
        const breedInitValue = getBreedInitValue(characterStats.breed, abilityStatId);
        const equipmentBonus = equipmentBonuses[abilityName] || 0;
        const perkBonus = perkBonuses[abilityName] || 0;
        const buffBonus = buffBonuses[abilityName] || 0;

        // Ensure pointFromIp is set (required field)
        if (ability.pointFromIp === undefined || ability.pointFromIp === null) {
          ability.pointFromIp = 0; // Default to no IP spent
        }

        // Calculate base ability cap (without equipment/perks)
        const baseAbilityCap = calcAbilityMaxValue(characterStats.level, characterStats.breed, characterStats.profession, abilityStatId);

        // Calculate base value (breed init + IP improvements, no equipment/perks)
        const baseValue = breedInitValue + ability.pointFromIp;

        // Cap the base value at the ability's natural cap
        const cappedBaseValue = Math.min(baseValue, baseAbilityCap);

        // Store computed values
        ability.baseValue = cappedBaseValue;
        ability.equipmentBonus = equipmentBonus;
        ability.perkBonus = perkBonus; // Store perk bonus separately
        ability.buffBonus = buffBonus; // Store buff bonus separately
        ability.trickleDown = 0; // Abilities don't have trickle-down

        // Final value: capped base + equipment + perks + buffs (both can exceed natural cap)
        // Apply buff effects after equipment and perk bonuses but before final caps
        ability.value = cappedBaseValue + equipmentBonus + perkBonus + buffBonus;

        // Display cap includes equipment, perk, and buff bonuses for UI
        ability.cap = baseAbilityCap + equipmentBonus + perkBonus + buffBonus;
      }
    });
  }

  // For trickle-down, use full ability values INCLUDING equipment and perk bonuses
  const fullAbilityValues: number[] = [
    profile.Skills.Attributes.Strength.value || 0,
    profile.Skills.Attributes.Agility.value || 0,
    profile.Skills.Attributes.Stamina.value || 0,
    profile.Skills.Attributes.Intelligence.value || 0,
    profile.Skills.Attributes.Sense.value || 0,
    profile.Skills.Attributes.Psychic.value || 0
  ];
  const trickleDownResults = calcAllTrickleDown(fullAbilityValues);
  
  // Update skill caps and trickle-down
  const categories = [
    'Body & Defense',
    'Ranged Weapons', 
    'Ranged Specials',
    'Melee Weapons',
    'Melee Specials',
    'Nanos & Casting',
    'Exploring',
    'Trade & Repair',
    'Combat & Healing'
  ];
  
  categories.forEach(categoryName => {
    const category = profile.Skills[categoryName as keyof typeof profile.Skills];
    if (category && typeof category === 'object') {
      Object.entries(category).forEach(([skillName, skillData]: [string, any]) => {
        const skillIndex = getSkillId(skillName);
        if (skillIndex !== null && skillIndex >= 0) {
          // Ensure pointFromIp is set (required field)
          if (skillData.pointFromIp === undefined || skillData.pointFromIp === null) {
            skillData.pointFromIp = 0; // Default to no IP spent
          }

          // Update trickle-down bonus
          skillData.trickleDown = trickleDownResults[skillIndex] || 0;

          // Calculate base skill cap (without equipment/perks)
          const baseSkillCap = calcSkillCap(
            characterStats.level,
            characterStats.profession,
            skillIndex,
            fullAbilityValues
          );

          // Calculate base value: base skill + trickle-down + IP improvements
          const baseValue = 5 + skillData.trickleDown + skillData.pointFromIp;

          // Cap the base value at the skill's natural cap
          const cappedBaseValue = Math.min(baseValue, baseSkillCap);

          // Get equipment, perk, and buff bonuses for this skill
          const equipmentBonus = equipmentBonuses[skillName] || 0;
          const perkBonus = perkBonuses[skillName] || 0;
          const buffBonus = buffBonuses[skillName] || 0;

          // Store computed values
          skillData.baseValue = cappedBaseValue;
          skillData.equipmentBonus = equipmentBonus;
          skillData.perkBonus = perkBonus; // Store perk bonus separately
          skillData.buffBonus = buffBonus; // Store buff bonus separately

          // Final value: capped base + equipment + perks + buffs (both can exceed natural cap)
          // Apply buff effects after equipment and perk bonuses but before final caps
          skillData.value = cappedBaseValue + equipmentBonus + perkBonus + buffBonus;

          // Display cap includes equipment, perk, and buff bonuses for UI
          skillData.cap = baseSkillCap + equipmentBonus + perkBonus + buffBonus;
        }
      });
    }
  });
}

/**
 * Update only trickle-down bonuses for all skills (optimized for ability changes)
 */
export function updateProfileTrickleDown(profile: TinkerProfile): TinkerProfile {
  // Create a deep copy to avoid mutations
  const updatedProfile = JSON.parse(JSON.stringify(profile)) as TinkerProfile;
  
  // Extract current abilities from profile (full values, not just improvements)
  const abilities: number[] = [
    updatedProfile.Skills.Attributes.Strength.value || 0,
    updatedProfile.Skills.Attributes.Agility.value || 0,
    updatedProfile.Skills.Attributes.Stamina.value || 0,
    updatedProfile.Skills.Attributes.Intelligence.value || 0,
    updatedProfile.Skills.Attributes.Sense.value || 0,
    updatedProfile.Skills.Attributes.Psychic.value || 0
  ];
  
  // Calculate new trickle-down values
  const trickleDownResults = calcAllTrickleDown(abilities);
  
  // Update trickle-down for all skill categories
  const categories = [
    'Body & Defense',
    'Ranged Weapons', 
    'Ranged Specials',
    'Melee Weapons',
    'Melee Specials',
    'Nanos & Casting',
    'Exploring',
    'Trade & Repair',
    'Combat & Healing'
  ];
  
  categories.forEach(categoryName => {
    const category = updatedProfile.Skills[categoryName as keyof typeof updatedProfile.Skills];
    if (category && typeof category === 'object') {
      Object.entries(category).forEach(([skillName, skillData]: [string, any]) => {
        const skillIndex = getSkillId(skillName);
        if (skillIndex !== null && skillIndex >= 0 && skillData) {
          const newTrickleDown = trickleDownResults[skillIndex] || 0;
          const oldTrickleDown = skillData.trickleDown || 0;
          
          // Update trickle-down bonus
          skillData.trickleDown = newTrickleDown;

          // Recalculate base value first
          const baseValue = 5 + newTrickleDown + (skillData.pointFromIp || 0);
          skillData.baseValue = baseValue;

          // Always include equipment, perk, and buff bonuses in final value
          const equipmentBonus = skillData.equipmentBonus || 0;
          const perkBonus = skillData.perkBonus || 0;
          const buffBonus = skillData.buffBonus || 0;
          skillData.value = baseValue + equipmentBonus + perkBonus + buffBonus;
        }
      });
    }
  });
  
  // Update timestamp
  updatedProfile.updated = new Date().toISOString();
  
  return updatedProfile;
}

/**
 * Validate a profile's IP spending and constraints
 */
export function validateProfileIP(profile: TinkerProfile): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  ipAnalysis: IPCalculationResult;
} {
  const characterStats = profileToCharacterStats(profile);
  const validation = validateCharacterBuild(characterStats);
  
  const warnings: string[] = [];
  
  // Add warnings for inefficient IP usage
  if (validation.ipAnalysis.efficiency < 80) {
    warnings.push(`Low IP efficiency: ${validation.ipAnalysis.efficiency}% of available IP used`);
  }
  
  // Check for skills near caps
  Object.entries(profile.Skills).forEach(([categoryName, category]) => {
    if (typeof category === 'object' && categoryName !== 'ACs' && categoryName !== 'Misc') {
      Object.entries(category).forEach(([skillName, skillData]: [string, any]) => {
        if (skillData.cap && skillData.value >= skillData.cap * 0.95) {
          warnings.push(`${skillName} is near its effective cap (${skillData.value}/${skillData.cap})`);
        }
      });
    }
  });
  
  return {
    valid: validation.valid,
    errors: validation.errors,
    warnings,
    ipAnalysis: validation.ipAnalysis
  };
}

/**
 * Recalculate all IP-related information for a profile
 */
export async function recalculateProfileIP(profile: TinkerProfile): Promise<TinkerProfile> {
  // Create a deep copy to avoid mutations
  const updatedProfile = JSON.parse(JSON.stringify(profile)) as TinkerProfile;

  // Calculate perk bonuses if perks are present
  let perkBonuses: Record<string, number> = {};
  try {
    perkBonuses = await calculatePerkBonuses(updatedProfile);
  } catch (error) {
    console.warn('Failed to calculate perk bonuses during IP recalculation:', error);
  }

  // Calculate buff bonuses if buffs are present
  let buffBonuses: Record<string, number> = {};
  try {
    buffBonuses = calculateBuffBonuses(updatedProfile);
  } catch (error) {
    console.warn('Failed to calculate buff bonuses during IP recalculation:', error);
  }

  // Update skill information (trickle-down, caps) with all bonuses
  updateProfileSkillInfo(updatedProfile, undefined, perkBonuses, buffBonuses);

  // Recalculate IP tracker
  updatedProfile.IPTracker = calculateProfileIP(updatedProfile);

  // Recalculate health and nano since trickle-down effects might impact Body Dev and Nano Pool
  try {
    const { recalculateHealthAndNano } = await import('@/services/profile-update-service');
    await recalculateHealthAndNano(updatedProfile);
  } catch (error) {
    console.warn('Could not recalculate health/nano in IP tracker update:', error);
  }

  // Update timestamp
  updatedProfile.updated = new Date().toISOString();

  return updatedProfile;
}

// ============================================================================
// Skill Modification Functions
// ============================================================================

/**
 * Safely modify a skill value while maintaining IP constraints
 */
export async function modifySkill(
  profile: TinkerProfile,
  category: string,
  skillName: string,
  newValue: number
): Promise<{
  success: boolean;
  error?: string;
  updatedProfile?: TinkerProfile;
}> {
  const skillData = (profile.Skills as any)[category]?.[skillName];
  if (!skillData) {
    return {
      success: false,
      error: `Skill ${skillName} not found in category ${category}`
    };
  }
  
  // Check if new value exceeds cap
  if (skillData.cap && newValue > skillData.cap) {
    return {
      success: false,
      error: `Cannot raise ${skillName} to ${newValue}, exceeds cap of ${skillData.cap}`
    };
  }
  
  // Calculate IP cost difference
  const oldImprovements = skillData.pointFromIp;
  const newImprovements = Math.max(0, newValue - (skillData.trickleDown || 0));
  const improvementDiff = newImprovements - oldImprovements;
  
  if (improvementDiff === 0) {
    return { success: true, updatedProfile: profile };
  }
  
  // Calculate IP cost
  const skillIndex = getSkillId(skillName);
  const profession = getProfessionId(profile.Character.Profession) || 0;
  let ipCost = 0;
  
  if (skillIndex !== null && skillIndex >= 0) {
    if (improvementDiff > 0) {
      // Calculate cost to raise skill
      for (let i = oldImprovements; i < newImprovements; i++) {
        ipCost += calcTotalSkillCost(1, profession, skillIndex);
      }
    } else {
      // Calculate IP refund for lowering skill
      for (let i = newImprovements; i < oldImprovements; i++) {
        ipCost -= calcTotalSkillCost(1, profession, skillIndex);
      }
    }
  }
  
  // Check IP availability
  const currentIP = profile.IPTracker?.remaining || 0;
  if (ipCost > currentIP) {
    return {
      success: false,
      error: `Insufficient IP: need ${ipCost}, have ${currentIP}`
    };
  }
  
  // Create updated profile
  const updatedProfile = JSON.parse(JSON.stringify(profile)) as TinkerProfile;
  const updatedSkill = (updatedProfile.Skills as any)[category][skillName];
  
  updatedSkill.value = newValue;
  updatedSkill.pointFromIp = newImprovements;
  updatedSkill.ipSpent = updatedSkill.ipSpent + ipCost;
  
  // Recalculate all IP information (includes perk bonuses)
  return {
    success: true,
    updatedProfile: await recalculateProfileIP(updatedProfile)
  };
}

/**
 * Safely modify an ability value while maintaining IP constraints
 */
export async function modifyAbility(
  profile: TinkerProfile,
  abilityName: string,
  newValue: number
): Promise<{
  success: boolean;
  error?: string;
  updatedProfile?: TinkerProfile;
  trickleDownChanges?: Record<string, { old: number; new: number }>;
}> {
  const abilityData = (profile.Skills.Attributes as any)[abilityName];
  if (!abilityData) {
    return {
      success: false,
      error: `Ability ${abilityName} not found`
    };
  }
  
  const abilityIndex = ABILITY_NAMES.indexOf(abilityName);
  const abilityStatId = ABILITY_INDEX_TO_STAT_ID[abilityIndex];
  const breed = getBreedId(profile.Character.Breed) || 0;

  // Calculate new improvement value
  const breedBase = getBreedInitValue(breed, abilityStatId);
  const newImprovements = Math.max(0, newValue - breedBase);
  const oldImprovements = abilityData.pointFromIp;
  const improvementDiff = newImprovements - oldImprovements;
  
  if (improvementDiff === 0) {
    return { success: true, updatedProfile: profile };
  }
  
  // Calculate IP cost
  let ipCost = 0;
  if (improvementDiff > 0) {
    for (let i = oldImprovements; i < newImprovements; i++) {
      ipCost += calcTotalAbilityCost(1, breed, abilityStatId);
    }
  } else {
    for (let i = newImprovements; i < oldImprovements; i++) {
      ipCost -= calcTotalAbilityCost(1, breed, abilityStatId);
    }
  }
  
  // Check IP availability
  const currentIP = profile.IPTracker?.remaining || 0;
  if (ipCost > currentIP) {
    return {
      success: false,
      error: `Insufficient IP: need ${ipCost}, have ${currentIP}`
    };
  }
  
  // Capture old trickle-down values for change tracking
  const oldTrickleDownChanges: Record<string, { old: number; new: number }> = {};
  const categories = [
    'Body & Defense', 'Ranged Weapons', 'Ranged Specials',
    'Melee Weapons', 'Melee Specials', 'Nanos & Casting',
    'Exploring', 'Trade & Repair', 'Combat & Healing'
  ];
  
  categories.forEach(categoryName => {
    const category = profile.Skills[categoryName as keyof typeof profile.Skills];
    if (category && typeof category === 'object') {
      Object.entries(category).forEach(([skillName, skillData]: [string, any]) => {
        if (skillData && skillData.trickleDown !== undefined) {
          oldTrickleDownChanges[skillName] = { old: skillData.trickleDown, new: 0 };
        }
      });
    }
  });
  
  // Create updated profile
  const updatedProfile = JSON.parse(JSON.stringify(profile)) as TinkerProfile;
  const updatedAbility = (updatedProfile.Skills.Attributes as any)[abilityName];
  
  updatedAbility.value = newValue;
  updatedAbility.pointFromIp = newImprovements;
  updatedAbility.ipSpent = updatedAbility.ipSpent + ipCost;
  
  // Apply optimized trickle-down update
  const profileWithTrickleDown = updateProfileTrickleDown(updatedProfile);
  
  // Capture new trickle-down values
  categories.forEach(categoryName => {
    const category = profileWithTrickleDown.Skills[categoryName as keyof typeof profileWithTrickleDown.Skills];
    if (category && typeof category === 'object') {
      Object.entries(category).forEach(([skillName, skillData]: [string, any]) => {
        if (skillData && oldTrickleDownChanges[skillName] !== undefined) {
          oldTrickleDownChanges[skillName].new = skillData.trickleDown || 0;
        }
      });
    }
  });
  
  // Full IP recalculation (for IP tracker, includes perk bonuses)
  const finalProfile = await recalculateProfileIP(profileWithTrickleDown);

  return {
    success: true,
    updatedProfile: finalProfile,
    trickleDownChanges: oldTrickleDownChanges
  };
}

/**
 * Recalculate profile with updated perk bonuses
 * Use this when perks change to ensure all skill/ability values are updated
 */
export async function recalculateProfileWithPerkChanges(profile: TinkerProfile): Promise<TinkerProfile> {
  return recalculateProfileIP(profile);
}

// ============================================================================
// Export Functions
// ============================================================================

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Main function to update profile with IP tracking (alias for recalculateProfileIP)
 * This is the primary entry point used by stores and other components
 */
export const updateProfileWithIPTracking = recalculateProfileIP;

export const ipIntegrator = {
  profileToCharacterStats,
  calculateProfileIP,
  updateProfileSkillInfo,
  updateProfileTrickleDown,
  validateProfileIP,
  recalculateProfileIP,
  updateProfileWithIPTracking,
  recalculateProfileWithPerkChanges,
  modifySkill,
  modifyAbility
};
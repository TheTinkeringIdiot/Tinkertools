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
  ABILITY_NAMES,
  ABILITY_INDEX_TO_STAT_ID,
  SKILL_NAMES,
  type CharacterStats,
  type IPCalculationResult
} from './ip-calculator';

import { getBreedId, getProfessionId } from '../../services/game-utils';
import { getSkillId } from './skill-mappings';

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
  
  // Extract skills (improvements only)
  const skills: number[] = [];
  
  // Map profile skills to skill array indices
  const skillMapping = {
    // Body & Defense
    'Max Health': 0,
    'Max Nano': 1,
    // Add more mappings as needed based on SKILL_NAMES
  };
  
  // Initialize skills array with defaults
  for (let i = 0; i < 97; i++) {
    skills[i] = 0;
  }
  
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
  
  // Fill in known skills from profile using complete mapping
  categories.forEach(categoryName => {
    const category = profile.Skills[categoryName as keyof typeof profile.Skills];
    if (category && typeof category === 'object') {
      Object.entries(category).forEach(([skillName, skillData]: [string, any]) => {
        const skillIndex = getSkillId(skillName);
        if (skillIndex !== null && skillIndex >= 0 && skillData.pointFromIp !== undefined) {
          skills[skillIndex] = skillData.pointFromIp;
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
export function updateProfileSkillInfo(profile: TinkerProfile): void {
  const characterStats = profileToCharacterStats(profile);
  // For trickle-down, we need full ability values, not improvements
  const fullAbilityValues = [
    profile.Skills.Attributes.Strength.value || 0,
    profile.Skills.Attributes.Agility.value || 0,
    profile.Skills.Attributes.Stamina.value || 0,
    profile.Skills.Attributes.Intelligence.value || 0,
    profile.Skills.Attributes.Sense.value || 0,
    profile.Skills.Attributes.Psychic.value || 0
  ];
  const trickleDownResults = calcAllTrickleDown(fullAbilityValues);
  
  // Update ability caps
  if (profile.Skills.Attributes) {
    const abilityNames = ['Strength', 'Agility', 'Stamina', 'Intelligence', 'Sense', 'Psychic'];
    abilityNames.forEach((abilityName, index) => {
      const ability = profile.Skills.Attributes![abilityName as keyof typeof profile.Skills.Attributes] as SkillWithIP;
      if (ability) {
        // Calculate and set ability cap using STAT ID
        const abilityStatId = ABILITY_INDEX_TO_STAT_ID[index];
        const abilityCap = calcAbilityMaxValue(characterStats.level, characterStats.breed, characterStats.profession, abilityStatId);
        ability.cap = abilityCap;
      }
    });
  }
  
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
          // Update trickle-down bonus
          skillData.trickleDown = trickleDownResults[skillIndex] || 0;
          
          // Update total skill value: base + trickle-down + IP improvements
          skillData.value = 5 + (skillData.trickleDown || 0) + (skillData.pointFromIp || 0);
          
          // Update skill cap (using full ability values for ability cap calculation)
          const skillCap = calcSkillCap(
            characterStats.level,
            characterStats.profession,
            skillIndex,
            fullAbilityValues
          );
          skillData.cap = skillCap;
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
  const abilities = [
    updatedProfile.Skills.Attributes.Strength.value,
    updatedProfile.Skills.Attributes.Agility.value,
    updatedProfile.Skills.Attributes.Stamina.value,
    updatedProfile.Skills.Attributes.Intelligence.value,
    updatedProfile.Skills.Attributes.Sense.value,
    updatedProfile.Skills.Attributes.Psychic.value
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
          
          // Recalculate total skill value: base + trickle-down + IP improvements
          // Note: pointFromIp represents the IP-based improvements beyond base+trickle
          skillData.value = 5 + newTrickleDown + (skillData.pointFromIp || 0);
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
  
  // Update skill information (trickle-down, caps)
  updateProfileSkillInfo(updatedProfile);
  
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
  
  // Recalculate all IP information
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
  const breed = getBreedId(profile.Character.Breed) || 0;
  
  // Calculate new improvement value
  const breedBase = getBreedId(profile.Character.Breed) || 6; // Default base
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
      ipCost += calcTotalAbilityCost(1, breed, abilityIndex);
    }
  } else {
    for (let i = newImprovements; i < oldImprovements; i++) {
      ipCost -= calcTotalAbilityCost(1, breed, abilityIndex);
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
  
  // Full IP recalculation (for IP tracker)
  const finalProfile = await recalculateProfileIP(profileWithTrickleDown);
  
  return {
    success: true,
    updatedProfile: finalProfile,
    trickleDownChanges: oldTrickleDownChanges
  };
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
  modifySkill,
  modifyAbility
};
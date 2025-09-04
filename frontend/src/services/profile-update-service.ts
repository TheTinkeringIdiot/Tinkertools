/**
 * Profile Update Service
 * Handles complex character metadata changes with proper recalculation of dependent values
 */

import type { TinkerProfile, SkillWithIP } from '@/lib/tinkerprofiles';
import { 
  PROFESSION_NAMES, 
  BREED_NAMES,
  getBreedInitValue,
  calcTotalAbilityCost,
  calcTotalSkillCost,
  calcIP,
  calcAllTrickleDown,
  calcHP,
  calcNP,
  getSkillCostFactor,
  getAbilityCostFactor
} from '@/lib/tinkerprofiles/ip-calculator';
import { getBreedId, getProfessionId } from './game-utils';
import { updateProfileWithIPTracking } from '@/lib/tinkerprofiles/ip-integrator';

export interface CharacterMetadataChanges {
  name?: string;
  level?: number;
  profession?: string;
  breed?: string;
  faction?: string;
  accountType?: string;
}

export interface UpdateResult {
  success: boolean;
  updatedProfile?: TinkerProfile;
  warnings: string[];
  errors: string[];
  ipDelta?: number; // Change in IP spent
}

/**
 * Update character metadata with proper recalculation of dependent values
 */
export async function updateCharacterMetadata(
  profile: TinkerProfile, 
  changes: CharacterMetadataChanges
): Promise<UpdateResult> {
  const result: UpdateResult = {
    success: false,
    warnings: [],
    errors: []
  };

  try {
    // Create a deep copy of the profile to work with
    const updatedProfile: TinkerProfile = JSON.parse(JSON.stringify(profile));
    
    // Track original values for comparison
    const originalBreed = getBreedId(profile.Character?.Breed || 'Solitus') || 0;
    const originalProfession = getProfessionId(profile.Character?.Profession || 'Adventurer') || 0;
    const originalLevel = profile.Character?.Level || 1;

    // Apply basic changes
    if (changes.name !== undefined) {
      updatedProfile.Character.Name = changes.name;
    }
    
    if (changes.faction !== undefined) {
      updatedProfile.Character.Faction = changes.faction;
    }
    
    if (changes.accountType !== undefined) {
      updatedProfile.Character.AccountType = changes.accountType;
    }

    // Handle level change
    let newLevel = originalLevel;
    if (changes.level !== undefined && changes.level !== originalLevel) {
      newLevel = changes.level;
      updatedProfile.Character.Level = newLevel;
      
      // Recalculate health and nano based on new level
      await recalculateHealthAndNano(updatedProfile);
    }

    // Handle breed change (most impactful)
    let newBreed = originalBreed;
    if (changes.breed !== undefined) {
      const breedId = getBreedId(changes.breed);
      if (breedId !== null && breedId !== originalBreed) {
        newBreed = breedId;
        updatedProfile.Character.Breed = changes.breed;
        
        // Recalculate abilities based on new breed
        const breedUpdateResult = await updateForBreedChange(
          updatedProfile, 
          originalBreed, 
          newBreed
        );
        
        result.warnings.push(...breedUpdateResult.warnings);
        result.errors.push(...breedUpdateResult.errors);
        
        if (breedUpdateResult.errors.length > 0) {
          return result;
        }
      }
    }

    // Handle profession change
    let newProfession = originalProfession;
    if (changes.profession !== undefined) {
      const professionId = getProfessionId(changes.profession);
      if (professionId !== null && professionId !== originalProfession) {
        newProfession = professionId;
        updatedProfile.Character.Profession = changes.profession;
        
        // Recalculate skills based on new profession
        const professionUpdateResult = await updateForProfessionChange(
          updatedProfile,
          originalProfession,
          newProfession
        );
        
        result.warnings.push(...professionUpdateResult.warnings);
        result.errors.push(...professionUpdateResult.errors);
        
        if (professionUpdateResult.errors.length > 0) {
          return result;
        }
      }
    }

    // Recalculate IP tracking
    const ipUpdateResult = await recalculateIPTracking(updatedProfile);
    if (ipUpdateResult.errors.length > 0) {
      result.errors.push(...ipUpdateResult.errors);
      return result;
    }

    // Calculate IP difference
    const originalIPSpent = profile.IPTracker?.totalUsed || 0;
    const newIPSpent = updatedProfile.IPTracker?.totalUsed || 0;
    result.ipDelta = newIPSpent - originalIPSpent;

    // Update timestamps
    updatedProfile.updated = new Date().toISOString();
    
    // Final validation to ensure all constraints are met
    const validation = validateCharacterBuild(updatedProfile);
    result.warnings.push(...validation.warnings);
    result.errors.push(...validation.errors);
    
    if (validation.valid) {
      result.success = true;
      result.updatedProfile = updatedProfile;
    } else {
      result.success = false;
    }
    
    return result;

  } catch (error) {
    console.error('Error updating character metadata:', error);
    result.errors.push(`Failed to update character: ${error.message || 'Unknown error'}`);
    return result;
  }
}

/**
 * Handle breed change - update base ability values and recalculate IP costs
 */
async function updateForBreedChange(
  profile: TinkerProfile,
  oldBreedId: number,
  newBreedId: number
): Promise<{ warnings: string[]; errors: string[] }> {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!profile.Skills?.Attributes) {
    errors.push('Profile missing ability data');
    return { warnings, errors };
  }

  const abilities = profile.Skills.Attributes;
  const abilityNames = ['Strength', 'Agility', 'Stamina', 'Intelligence', 'Sense', 'Psychic'];

  // Update each ability
  for (let i = 0; i < abilityNames.length; i++) {
    const abilityName = abilityNames[i];
    const ability = abilities[abilityName as keyof typeof abilities] as SkillWithIP;
    
    if (!ability) continue;

    // Get old and new base values
    const oldBaseValue = getBreedInitValue(oldBreedId, i);
    const newBaseValue = getBreedInitValue(newBreedId, i);
    
    // Calculate improvements (how much the user invested)
    const improvements = ability.value - oldBaseValue;
    
    // Set new total value (new base + same improvements), ensuring it's never below the new base
    ability.value = Math.max(newBaseValue + improvements, newBaseValue);
    
    // Recalculate IP cost with new breed cost factors
    if (improvements > 0) {
      ability.ipSpent = calcTotalAbilityCost(improvements, newBreedId, i);
      ability.pointFromIp = improvements;
    } else {
      ability.ipSpent = 0;
      ability.pointFromIp = 0;
    }
    
    // Add warning if base value changed significantly
    if (Math.abs(newBaseValue - oldBaseValue) > 3) {
      const change = newBaseValue > oldBaseValue ? 'increased' : 'decreased';
      warnings.push(`${abilityName} base value ${change} from ${oldBaseValue} to ${newBaseValue}`);
    }
  }

  // Recalculate trickle-down bonuses
  await recalculateTrickleDown(profile);
  
  return { warnings, errors };
}

/**
 * Handle profession change - recalculate skill IP costs
 */
async function updateForProfessionChange(
  profile: TinkerProfile,
  oldProfessionId: number,
  newProfessionId: number
): Promise<{ warnings: string[]; errors: string[] }> {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!profile.Skills) {
    errors.push('Profile missing skills data');
    return { warnings, errors };
  }

  const skillCategories = [
    'Body_Defense', 'Melee_Weapons', 'Melee_Specials',
    'Ranged_Weapons', 'Ranged_Specials', 'Nanos_Casting',
    'Exploring', 'Trade_Repair', 'Combat_Healing'
  ];

  // Map of skill names to their IDs (this would need to be expanded based on actual skill mapping)
  const skillNameToId: Record<string, number> = {
    'Body_Dev': 0,
    'Nano_Pool': 1,
    'Martial_Arts': 2,
    // ... (this would need to be completed with all skill mappings)
  };

  let significantChanges = 0;

  // Update skill costs for each category
  for (const category of skillCategories) {
    const skillCategory = profile.Skills[category as keyof typeof profile.Skills];
    if (!skillCategory || typeof skillCategory !== 'object') continue;

    for (const [skillName, skill] of Object.entries(skillCategory)) {
      if (!skill || typeof skill !== 'object' || !('value' in skill)) continue;
      
      const skillData = skill as SkillWithIP;
      const skillId = skillNameToId[skillName];
      
      if (skillId === undefined) continue;

      // Calculate improvements
      const improvements = skillData.pointFromIp || 0;
      
      if (improvements > 0) {
        // Recalculate IP cost with new profession
        const oldCost = skillData.ipSpent || 0;
        const newCost = calcTotalSkillCost(improvements, newProfessionId, skillId);
        
        skillData.ipSpent = newCost;
        
        // Track significant cost changes
        const costDifference = Math.abs(newCost - oldCost);
        if (costDifference > improvements * 0.2) { // > 20% change
          significantChanges++;
          const change = newCost > oldCost ? 'increased' : 'decreased';
          warnings.push(`${skillName} IP cost ${change} from ${oldCost} to ${newCost}`);
        }
      }
    }
  }

  if (significantChanges > 5) {
    warnings.push(`${significantChanges} skills had significant IP cost changes due to profession change`);
  }

  return { warnings, errors };
}

/**
 * Recalculate trickle-down bonuses from abilities to skills
 */
async function recalculateTrickleDown(profile: TinkerProfile): Promise<void> {
  if (!profile.Skills?.Attributes) return;

  // Get current ability values
  const abilities = [
    profile.Skills.Attributes.Strength?.value || 0,
    profile.Skills.Attributes.Agility?.value || 0,
    profile.Skills.Attributes.Stamina?.value || 0,
    profile.Skills.Attributes.Intelligence?.value || 0,
    profile.Skills.Attributes.Sense?.value || 0,
    profile.Skills.Attributes.Psychic?.value || 0
  ];

  // Calculate all trickle-down bonuses
  const trickleDownResult = calcAllTrickleDown(abilities);

  // Apply trickle-down to skills (this would need proper skill mapping)
  // For now, we'll just store the trickle values where available
  const skillCategories = Object.keys(profile.Skills).filter(key => key !== 'Attributes');
  
  for (const category of skillCategories) {
    const skillCategory = profile.Skills[category as keyof typeof profile.Skills];
    if (!skillCategory || typeof skillCategory !== 'object') continue;

    for (const [skillName, skill] of Object.entries(skillCategory)) {
      if (!skill || typeof skill !== 'object' || !('trickleDown' in skill)) continue;
      
      // This would need proper mapping from skill names to trickle-down values
      // For now, we'll leave existing trickle values or set to 0
      (skill as any).trickleDown = (skill as any).trickleDown || 0;
    }
  }
}

/**
 * Recalculate health and nano based on current stats
 */
async function recalculateHealthAndNano(profile: TinkerProfile): Promise<void> {
  if (!profile.Character || !profile.Skills?.Attributes) return;

  const level = profile.Character.Level || 1;
  const breedId = getBreedId(profile.Character.Breed || 'Solitus') || 0;
  const professionId = getProfessionId(profile.Character.Profession || 'Adventurer') || 0;

  // Get Body Dev and Nano Pool values
  const bodyDev = profile.Skills.Body_Defense?.Body_Dev?.value || 0;
  const nanoPool = profile.Skills.Body_Defense?.Nano_Pool?.value || 0;

  // Calculate health and nano
  const health = calcHP(bodyDev, level, breedId, professionId);
  const nano = calcNP(nanoPool, level, breedId, professionId);

  profile.Character.MaxHealth = health;
  profile.Character.MaxNano = nano;
}

/**
 * Recalculate complete IP tracking information with caps and trickle-down updates
 */
async function recalculateIPTracking(profile: TinkerProfile): Promise<{ warnings: string[]; errors: string[] }> {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // Use the integrated IP tracker which handles caps, trickle-down, and comprehensive IP calculations
    const updatedProfile = updateProfileWithIPTracking(profile);
    
    // Copy the updated calculations back to the original profile
    profile.IPTracker = updatedProfile.IPTracker;
    profile.Skills = updatedProfile.Skills; // This includes updated caps and trickle-down values

    // Check for IP overflow
    if (profile.IPTracker && profile.IPTracker.remaining < 0) {
      errors.push(`Character exceeds available IP by ${Math.abs(profile.IPTracker.remaining)} points`);
    }

    // Add warnings for skills near caps
    if (profile.IPTracker && profile.IPTracker.efficiency < 80) {
      warnings.push(`Low IP efficiency: ${profile.IPTracker.efficiency.toFixed(1)}% of available IP used`);
    }

  } catch (error) {
    errors.push(`Failed to recalculate IP tracking: ${error.message || 'Unknown error'}`);
  }

  return { warnings, errors };
}

/**
 * Validate that ability values meet breed minimums
 */
function validateAbilityMinimums(profile: TinkerProfile): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!profile.Character?.Breed || !profile.Skills?.Attributes) {
    return { errors, warnings };
  }
  
  const breedId = getBreedId(profile.Character.Breed) || 0;
  const abilityNames = ['Strength', 'Agility', 'Stamina', 'Intelligence', 'Sense', 'Psychic'];
  
  for (let i = 0; i < abilityNames.length; i++) {
    const abilityName = abilityNames[i];
    const ability = profile.Skills.Attributes[abilityName as keyof typeof profile.Skills.Attributes] as SkillWithIP;
    
    if (ability) {
      const minimumValue = getBreedInitValue(breedId, i);
      if (ability.value < minimumValue) {
        errors.push(`${abilityName} (${ability.value}) is below minimum value for ${profile.Character.Breed} breed (${minimumValue})`);
      }
    }
  }
  
  return { errors, warnings };
}

/**
 * Validate that a character build is still valid after changes
 */
export function validateCharacterBuild(profile: TinkerProfile): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check basic requirements
  if (!profile.Character) {
    errors.push('Profile missing character data');
  }

  if (!profile.Skills) {
    errors.push('Profile missing skills data');
  }

  // Check IP constraints
  if (profile.IPTracker && profile.IPTracker.remaining < 0) {
    errors.push(`Character exceeds available IP by ${Math.abs(profile.IPTracker.remaining)} points`);
  }

  // Check level constraints
  const level = profile.Character?.Level || 1;
  if (level < 1 || level > 220) {
    errors.push(`Invalid character level: ${level}`);
  }
  
  // Check ability minimums
  const abilityValidation = validateAbilityMinimums(profile);
  errors.push(...abilityValidation.errors);
  warnings.push(...abilityValidation.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
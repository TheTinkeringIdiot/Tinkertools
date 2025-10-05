/**
 * Profile Update Service
 * Handles complex character metadata changes with proper recalculation of dependent values
 */

import type { TinkerProfile, SkillWithIP } from '@/lib/tinkerprofiles';
import { PROFESSION_NAMES, BREED_NAMES } from '@/services/game-data';
import {
  getBreedInitValue,
  calcTotalAbilityCost,
  calcTotalSkillCost,
  calcIP,
  calcAllTrickleDown,
  calcHP,
  calcNP,
  getSkillCostFactor,
  getAbilityCostFactor,
  ABILITY_INDEX_TO_STAT_ID
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
  Specialization?: number;
}

export interface UpdateResult {
  success: boolean;
  updatedProfile?: TinkerProfile;
  warnings: string[];
  errors: string[];
  ipDelta?: number; // Change in IP spent
}

export interface EquipmentBonusResult {
  success: boolean;
  updatedProfile?: TinkerProfile;
  warnings: string[];
  errors: string[];
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
    
    // Track original values for comparison (Character stores numeric IDs)
    const originalBreed = profile.Character?.Breed || 0;
    const originalProfession = profile.Character?.Profession || 0;
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

    if (changes.Specialization !== undefined) {
      updatedProfile.Character.Specialization = changes.Specialization;
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
      // Convert incoming breed string to ID
      const breedId = getBreedId(changes.breed);
      if (breedId !== null && breedId !== undefined && breedId !== originalBreed) {
        newBreed = breedId;
        // Store numeric ID in Character
        updatedProfile.Character.Breed = breedId;
        
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
      // Convert incoming profession string to ID
      const professionId = getProfessionId(changes.profession);
      if (professionId !== null && professionId !== undefined && professionId !== originalProfession) {
        newProfession = professionId;
        // Store numeric ID in Character
        updatedProfile.Character.Profession = professionId;
        
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
    const errorMessage = `Critical error updating character metadata: ${error instanceof Error ? error.message : String(error)}`;
    console.error('Critical error updating character metadata:', error);

    result.errors.push(errorMessage);
    result.success = false;

    // Log detailed error information for debugging
    console.error('Error details:', {
      error,
      profileName: profile?.Character?.Name || 'unknown',
      changes,
      stack: error instanceof Error ? error.stack : undefined
    });

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
    const abilityStatId = ABILITY_INDEX_TO_STAT_ID[i];
    const oldBaseValue = getBreedInitValue(oldBreedId, abilityStatId);
    const newBaseValue = getBreedInitValue(newBreedId, abilityStatId);
    
    // Calculate improvements (how much the user invested)
    const improvements = ability.value - oldBaseValue;
    
    // Set new total value (new base + same improvements), ensuring it's never below the new base
    ability.value = Math.max(newBaseValue + improvements, newBaseValue);
    
    // Recalculate IP cost with new breed cost factors
    if (improvements > 0) {
      ability.ipSpent = calcTotalAbilityCost(improvements, newBreedId, abilityStatId);
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

  if (!profile.skills) {
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
export async function recalculateHealthAndNano(profile: TinkerProfile): Promise<void> {
  if (!profile.Character || !profile.skills) return;

  const level = profile.Character.Level || 1;
  // Direct access - Character stores numeric IDs
  const breedId = profile.Character.Breed || 0;
  const professionId = profile.Character.Profession || 0;

  // Get Body Dev and Nano Pool values using ID-based skill system
  const bodyDev = profile.skills[152]?.total || 0;  // Body Dev
  const nanoPool = profile.skills[132]?.total || 0;  // Nano Pool

  // Get Stamina from attributes
  const stamina = profile.skills[18]?.total || 0;  // Stamina

  // Get aggregated bonuses from skills tracking (equipment + perk + buff)
  // These are maintained by updateProfileSkillInfo in ip-integrator
  const maxHealthBonus = profile.skills[1]?.total || 0;  // Max Health bonuses (stat ID 1)
  const maxNanoBonus = profile.skills[221]?.total || 0;  // Max Nano bonuses (stat ID 221)

  // Calculate health and nano using the accurate formula
  // Note: calcHP includes the maxHealthBonus in its calculation
  const health = calcHP(bodyDev, level, breedId, professionId, stamina, maxHealthBonus);

  // For nano, we need to add the Max Nano bonus separately since calcNP doesn't include it
  const baseNano = calcNP(nanoPool, level, breedId, professionId);
  const nano = baseNano + maxNanoBonus;

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
    // Validate profile structure
    if (!profile) {
      errors.push('Profile data is missing for IP recalculation');
      return { warnings, errors };
    }

    if (!profile.Character) {
      errors.push('Profile missing character data for IP recalculation');
      return { warnings, errors };
    }

    // Use the integrated IP tracker which handles caps, trickle-down, and comprehensive IP calculations
    let updatedProfile: TinkerProfile;
    try {
      updatedProfile = await updateProfileWithIPTracking(profile);
      console.log('IP tracking recalculation completed successfully');
    } catch (ipError) {
      const errorMessage = `IP tracking calculation failed: ${ipError instanceof Error ? ipError.message : String(ipError)}`;
      errors.push(errorMessage);
      console.error('Error in updateProfileWithIPTracking:', ipError);
      return { warnings, errors };
    }

    // Safely copy the updated calculations back to the original profile
    try {
      if (updatedProfile.IPTracker) {
        profile.IPTracker = updatedProfile.IPTracker;
      } else {
        warnings.push('Updated profile missing IP tracker data');
      }

      if (updatedProfile.Skills) {
        profile.Skills = updatedProfile.Skills; // This includes updated caps and trickle-down values
      } else {
        warnings.push('Updated profile missing skills data');
      }
    } catch (copyError) {
      errors.push(`Failed to copy updated IP data back to profile: ${copyError instanceof Error ? copyError.message : String(copyError)}`);
      console.error('Error copying IP data:', copyError);
      return { warnings, errors };
    }

    // Check for IP overflow with error handling
    try {
      if (profile.IPTracker && typeof profile.IPTracker.remaining === 'number' && profile.IPTracker.remaining < 0) {
        errors.push(`Character exceeds available IP by ${Math.abs(profile.IPTracker.remaining)} points`);
      }
    } catch (overflowError) {
      warnings.push('Unable to check IP overflow due to data inconsistency');
      console.warn('Error checking IP overflow:', overflowError);
    }

    // Add warnings for skills near caps with error handling
    try {
      if (profile.IPTracker && typeof profile.IPTracker.efficiency === 'number' && profile.IPTracker.efficiency < 80) {
        warnings.push(`Low IP efficiency: ${profile.IPTracker.efficiency.toFixed(1)}% of available IP used`);
      }
    } catch (efficiencyError) {
      warnings.push('Unable to calculate IP efficiency due to data inconsistency');
      console.warn('Error calculating IP efficiency:', efficiencyError);
    }

  } catch (error) {
    const errorMessage = `Critical error during IP tracking recalculation: ${error instanceof Error ? error.message : String(error)}`;
    errors.push(errorMessage);
    console.error('Critical error in recalculateIPTracking:', error);

    // Log additional context for debugging
    console.error('IP recalculation error context:', {
      error,
      profileName: profile?.Character?.Name || 'unknown',
      hasSkills: !!profile?.Skills,
      hasIPTracker: !!profile?.IPTracker,
      stack: error instanceof Error ? error.stack : undefined
    });
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

  // Direct access - Character stores numeric IDs
  const breedId = profile.Character.Breed || 0;
  const abilityNames = ['Strength', 'Agility', 'Stamina', 'Intelligence', 'Sense', 'Psychic'];
  
  for (let i = 0; i < abilityNames.length; i++) {
    const abilityName = abilityNames[i];
    const ability = profile.Skills.Attributes[abilityName as keyof typeof profile.Skills.Attributes] as SkillWithIP;
    
    if (ability) {
      const minimumValue = getBreedInitValue(breedId, i);
      if (ability.value < minimumValue) {
        const breedName = BREED_NAMES[breedId] || 'Unknown';
        errors.push(`${abilityName} (${ability.value}) is below minimum value for ${breedName} breed (${minimumValue})`);
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

  if (!profile.skills) {
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

/**
 * Handle equipment bonus recalculation when equipment changes are detected
 */
export async function handleEquipmentBonusRecalculation(
  profile: TinkerProfile
): Promise<EquipmentBonusResult> {
  const result: EquipmentBonusResult = {
    success: false,
    warnings: [],
    errors: []
  };

  try {
    // Validate input profile
    if (!profile) {
      result.errors.push('Profile data is missing');
      console.error('Equipment bonus recalculation called with null/undefined profile');
      return result;
    }

    // Create a deep copy of the profile to work with
    let updatedProfile: TinkerProfile;
    try {
      updatedProfile = JSON.parse(JSON.stringify(profile));
    } catch (error) {
      result.errors.push('Failed to create profile copy - profile may contain invalid data');
      console.error('Error creating profile copy:', error);
      return result;
    }

    // Use the IP integrator to recalculate everything including equipment bonuses
    // This will call the equipment bonus calculator if it's integrated into the IP system
    let ipUpdatedProfile: TinkerProfile;
    try {
      ipUpdatedProfile = await updateProfileWithIPTracking(updatedProfile);
      console.log('Equipment bonus recalculation completed successfully');
    } catch (error) {
      result.errors.push(`Failed to update profile with IP tracking: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error('Error in IP tracking update during equipment bonus recalculation:', error);

      // Try to continue with the original profile as fallback
      ipUpdatedProfile = updatedProfile;
      result.warnings.push('Using profile without full IP recalculation due to processing error');
    }

    // Update timestamps
    try {
      ipUpdatedProfile.updated = new Date().toISOString();
    } catch (error) {
      result.warnings.push('Failed to update profile timestamp');
      console.warn('Error updating profile timestamp:', error);
    }

    // Final validation
    let validation: { valid: boolean; errors: string[]; warnings: string[] };
    try {
      validation = validateCharacterBuild(ipUpdatedProfile);
      result.warnings.push(...validation.warnings);
      result.errors.push(...validation.errors);
    } catch (error) {
      result.warnings.push('Profile validation failed - profile may have data consistency issues');
      console.warn('Error during profile validation:', error);
      validation = { valid: true, errors: [], warnings: [] }; // Assume valid to allow continuation
    }

    // Even if there are warnings, we should still update the profile
    // Only fail if there are critical errors
    result.success = result.errors.length === 0;
    result.updatedProfile = ipUpdatedProfile;

    // Log summary for debugging
    if (result.warnings.length > 0) {
      console.warn(`Equipment bonus recalculation completed with ${result.warnings.length} warnings:`, result.warnings);
    }

    if (result.errors.length > 0) {
      console.error(`Equipment bonus recalculation completed with ${result.errors.length} errors:`, result.errors);
    }

    return result;

  } catch (error) {
    const errorMessage = `Critical error during equipment bonus recalculation: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error('Critical error during equipment bonus recalculation:', error);

    result.errors.push(errorMessage);
    result.success = false;

    // Try to provide some meaningful fallback
    try {
      if (profile) {
        result.updatedProfile = profile; // Return original profile as fallback
        result.warnings.push('Returned original profile due to processing error');
      }
    } catch (fallbackError) {
      console.error('Even fallback failed:', fallbackError);
    }

    return result;
  }
}
/**
 * Profile Update Service
 * Handles complex character metadata changes with proper recalculation of dependent values
 */

import type { TinkerProfile } from '@/lib/tinkerprofiles';
import { SKILL_COST_FACTORS } from '@/services/game-data';
import {
  getBreedInitValue,
  calcTotalAbilityCost,
  calcTotalSkillCost,
  calcHP,
  calcNP,
  ABILITY_INDEX_TO_STAT_ID,
} from '@/lib/tinkerprofiles/ip-calculator';
import { getBreedId, getProfessionId } from './game-utils';
import { skillService } from './skill-service';
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
    errors: [],
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
    if (changes.level !== undefined && changes.level !== originalLevel) {
      updatedProfile.Character.Level = changes.level;

      // Recalculate health and nano based on new level
      recalculateHealthAndNano(updatedProfile);
    }

    // Handle breed change (most impactful)
    if (changes.breed !== undefined) {
      // Convert incoming breed string to ID
      const breedId = getBreedId(changes.breed);
      if (breedId !== null && breedId !== undefined && breedId !== originalBreed) {
        // Store numeric ID in Character
        updatedProfile.Character.Breed = breedId;

        // Recalculate abilities based on new breed
        const breedUpdateResult = updateForBreedChange(updatedProfile, originalBreed, breedId);

        result.warnings.push(...breedUpdateResult.warnings);
        result.errors.push(...breedUpdateResult.errors);

        if (breedUpdateResult.errors.length > 0) {
          return result;
        }
      }
    }

    // Handle profession change
    if (changes.profession !== undefined) {
      // Convert incoming profession string to ID
      const professionId = getProfessionId(changes.profession);
      if (
        professionId !== null &&
        professionId !== undefined &&
        professionId !== originalProfession
      ) {
        // Store numeric ID in Character
        updatedProfile.Character.Profession = professionId;

        // Recalculate skills based on new profession
        const professionUpdateResult = updateForProfessionChange(updatedProfile, professionId);

        result.warnings.push(...professionUpdateResult.warnings);
        result.errors.push(...professionUpdateResult.errors);

        if (professionUpdateResult.errors.length > 0) {
          return result;
        }
      }
    }

    // Recalculate IP tracking
    const ipUpdateResult = recalculateIPTracking(updatedProfile);
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
      stack: error instanceof Error ? error.stack : undefined,
    });

    return result;
  }
}

/**
 * Handle breed change - keep the IP investment in each ability and reprice it
 * with the new breed's cost factors. Base values, caps and totals are rebuilt
 * from the new breed by the IP recalculation that follows.
 */
function updateForBreedChange(
  profile: TinkerProfile,
  oldBreedId: number,
  newBreedId: number
): { warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!profile.skills) {
    errors.push('Profile missing ability data');
    return { warnings, errors };
  }

  for (const abilityStatId of ABILITY_INDEX_TO_STAT_ID) {
    const ability = profile.skills[abilityStatId];
    if (!ability) continue;

    const oldBaseValue = getBreedInitValue(oldBreedId, abilityStatId);
    const newBaseValue = getBreedInitValue(newBreedId, abilityStatId);
    const improvements = ability.pointsFromIp || 0;

    ability.base = newBaseValue;
    ability.ipSpent =
      improvements > 0 ? calcTotalAbilityCost(improvements, newBreedId, abilityStatId) : 0;

    // Add warning if base value changed significantly
    if (Math.abs(newBaseValue - oldBaseValue) > 3) {
      const change = newBaseValue > oldBaseValue ? 'increased' : 'decreased';
      const abilityName = skillService.getName(abilityStatId);
      warnings.push(`${abilityName} base value ${change} from ${oldBaseValue} to ${newBaseValue}`);
    }
  }

  return { warnings, errors };
}

/**
 * Handle profession change - reprice the IP invested in each trainable skill
 */
function updateForProfessionChange(
  profile: TinkerProfile,
  newProfessionId: number
): { warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!profile.skills) {
    errors.push('Profile missing skills data');
    return { warnings, errors };
  }

  let significantChanges = 0;

  for (const [skillIdStr, skillData] of Object.entries(profile.skills)) {
    const skillId = Number(skillIdStr);
    if (!SKILL_COST_FACTORS[skillId]) continue;

    const improvements = skillData.pointsFromIp || 0;
    if (improvements <= 0) continue;

    const oldCost = skillData.ipSpent || 0;
    const newCost = calcTotalSkillCost(improvements, newProfessionId, skillId);
    skillData.ipSpent = newCost;

    // Track significant cost changes (> 20%)
    if (Math.abs(newCost - oldCost) > oldCost * 0.2) {
      significantChanges++;
      const change = newCost > oldCost ? 'increased' : 'decreased';
      warnings.push(
        `${skillService.getName(skillId)} IP cost ${change} from ${oldCost} to ${newCost}`
      );
    }
  }

  if (significantChanges > 5) {
    warnings.push(
      `${significantChanges} skills had significant IP cost changes due to profession change`
    );
  }

  return { warnings, errors };
}

/**
 * Recalculate health and nano based on current stats
 */
export function recalculateHealthAndNano(profile: TinkerProfile): void {
  if (!profile.Character || !profile.skills) return;

  const level = profile.Character.Level || 1;
  // Direct access - Character stores numeric IDs
  const breedId = profile.Character.Breed || 0;
  const professionId = profile.Character.Profession || 0;

  // Get Body Dev and Nano Pool values using ID-based skill system
  const bodyDev = profile.skills[152]?.total || 0; // Body Dev
  const nanoPool = profile.skills[132]?.total || 0; // Nano Pool

  // Get Stamina from attributes
  const stamina = profile.skills[18]?.total || 0; // Stamina

  // Get aggregated bonuses from skills tracking (equipment + perk + buff)
  // These are maintained by updateProfileSkillInfo in ip-integrator
  const maxHealthBonus = profile.skills[1]?.total || 0; // Max Health bonuses (stat ID 1)
  const maxNanoBonus = profile.skills[221]?.total || 0; // Max Nano bonuses (stat ID 221)

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
function recalculateIPTracking(profile: TinkerProfile): { warnings: string[]; errors: string[] } {
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
      updatedProfile = updateProfileWithIPTracking(profile);
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

      if (updatedProfile.skills) {
        profile.skills = updatedProfile.skills; // This includes updated caps and trickle-down values
      } else {
        warnings.push('Updated profile missing skills data');
      }
    } catch (copyError) {
      errors.push(
        `Failed to copy updated IP data back to profile: ${copyError instanceof Error ? copyError.message : String(copyError)}`
      );
      console.error('Error copying IP data:', copyError);
      return { warnings, errors };
    }

    // Check for IP overflow with error handling
    try {
      if (
        profile.IPTracker &&
        typeof profile.IPTracker.remaining === 'number' &&
        profile.IPTracker.remaining < 0
      ) {
        errors.push(
          `Character exceeds available IP by ${Math.abs(profile.IPTracker.remaining)} points`
        );
      }
    } catch (overflowError) {
      warnings.push('Unable to check IP overflow due to data inconsistency');
      console.warn('Error checking IP overflow:', overflowError);
    }

    // Add warnings for skills near caps with error handling
    try {
      if (
        profile.IPTracker &&
        typeof profile.IPTracker.efficiency === 'number' &&
        profile.IPTracker.efficiency < 80
      ) {
        warnings.push(
          `Low IP efficiency: ${profile.IPTracker.efficiency.toFixed(1)}% of available IP used`
        );
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
      hasSkills: !!profile?.skills,
      hasIPTracker: !!profile?.IPTracker,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  return { warnings, errors };
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
    errors.push(
      `Character exceeds available IP by ${Math.abs(profile.IPTracker.remaining)} points`
    );
  }

  // Check level constraints
  const level = profile.Character?.Level || 1;
  if (level < 1 || level > 220) {
    errors.push(`Invalid character level: ${level}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
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
    errors: [],
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
      ipUpdatedProfile = updateProfileWithIPTracking(updatedProfile);
      console.log('Equipment bonus recalculation completed successfully');
    } catch (error) {
      result.errors.push(
        `Failed to update profile with IP tracking: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
      console.warn(
        `Equipment bonus recalculation completed with ${result.warnings.length} warnings:`,
        result.warnings
      );
    }

    if (result.errors.length > 0) {
      console.error(
        `Equipment bonus recalculation completed with ${result.errors.length} errors:`,
        result.errors
      );
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

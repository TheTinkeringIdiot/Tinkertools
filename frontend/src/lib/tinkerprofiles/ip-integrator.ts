/**
 * IP Integration for TinkerProfiles
 * 
 * Integrates IP calculation system with TinkerProfile management,
 * providing automatic IP tracking, validation, and recalculation
 */

import type { TinkerProfile, IPTracker, SkillData } from './types';
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
import { SKILL_PATTERNS } from '../../utils/skill-patterns';
import { skillService } from '../../services/skill-service';
import { SKILL_COST_FACTORS } from '../../services/game-data';
import type { AnyPerkEntry } from './perk-types';

// ============================================================================
// Skill Classification Constants
// ============================================================================

/**
 * Attribute stat IDs (have breed base values, can be improved with IP)
 */
const ATTRIBUTE_IDS = new Set([16, 17, 18, 19, 20, 21]);

/**
 * Trainable skill IDs (have IP costs defined in game data)
 * Derived from SKILL_COST_FACTORS to ensure accuracy
 */
const TRAINABLE_SKILL_IDS = new Set(
  Object.keys(SKILL_COST_FACTORS).map(Number)
);

/**
 * Bonus-only stat IDs (no base value, no IP cost, only receive bonuses)
 * These stats need to be initialized if they have any bonuses from equipment/perks/buffs
 */
const BONUS_ONLY_STAT_IDS = new Set([
  1,    // MaxHealth
  221,  // MaxNano
  45,   // BeltSlots
  181,  // MaxNCU
  90,   // ProjectileAC
  91,   // MeleeAC
  92,   // EnergyAC
  93,   // ChemicalAC
  94,   // RadiationAC
  95,   // ColdAC
  96,   // PoisonAC
  97,   // FireAC
  276,  // AddAllOffense
  277,  // AddAllDefense
  278,  // ProjectileDamageModifier
  279,  // MeleeDamageModifier
  280,  // EnergyDamageModifier
  281,  // ChemicalDamageModifier
  282,  // RadiationDamageModifier
  311,  // ColdDamageModifier
  315,  // NanoDamageModifier
  316,  // FireDamageModifier
  317,  // PoisonDamageModifier
  318,  // NanoCost
  319,  // XPModifier
  343,  // HealDelta
  364,  // NanoDelta
  379,  // CriticalIncrease
  381,  // NanoRange
  382,  // SkillLockModifier
  383,  // NanoInterruptModifier
  287,  // AttackRange
  428,  // Free deck slot (alt BeltSlots)
  535,  // HealMultiplier
  536,  // NanoDamageMultiplier
  360   // Scale
]);

/**
 * Create an empty SkillData object for initializing missing skills
 */
function createEmptySkillData(): SkillData {
  return {
    base: 0,
    trickle: 0,
    pointsFromIp: 0,
    equipmentBonus: 0,
    perkBonus: 0,
    buffBonus: 0,
    ipSpent: 0,
    cap: 0,
    total: 0
  };
}

// ============================================================================
// Helper Functions
// ============================================================================


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
  // Attribute skill IDs: Strength=16, Agility=17, Stamina=18, Intelligence=19, Sense=20, Psychic=21
  const abilities = [
    profile.skills[16]?.pointsFromIp || 0, // Strength
    profile.skills[17]?.pointsFromIp || 0, // Agility
    profile.skills[18]?.pointsFromIp || 0, // Stamina
    profile.skills[19]?.pointsFromIp || 0, // Intelligence
    profile.skills[20]?.pointsFromIp || 0, // Sense
    profile.skills[21]?.pointsFromIp || 0  // Psychic
  ];

  // Extract skills (improvements only) using skill IDs directly
  const skills: Record<string, number> = {};

  // Iterate through all skills in the profile
  for (const [skillIdStr, skillData] of Object.entries(profile.skills)) {
    const skillId = Number(skillIdStr);
    // Only include trainable skills with IP spent (exclude attributes, bonus-only stats, ACs)
    if (TRAINABLE_SKILL_IDS.has(skillId) && skillData.pointsFromIp !== undefined) {
      skills[skillIdStr] = skillData.pointsFromIp;
    }
  }

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
async function calculatePerkBonuses(profile: TinkerProfile): Promise<Record<number, number>> {
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
    const perkBonusesBySkillId = calculatePerkBonusesService(allPerkItems);

    // Return skill ID bonuses directly (no name conversion needed)
    const result: Record<number, number> = {};
    for (const [skillIdStr, bonusAmount] of Object.entries(perkBonusesBySkillId)) {
      const skillId = Number(skillIdStr);
      if (!isNaN(skillId)) {
        result[skillId] = bonusAmount;
      }
    }

    return result;
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
function calculateBuffBonuses(profile: TinkerProfile): Record<number, number> {
  if (!profile.buffs || !Array.isArray(profile.buffs) || profile.buffs.length === 0) {
    return {};
  }

  try {
    // Use the nano bonus calculator service to extract and aggregate stat bonuses
    const buffBonuses = calculateNanoBonuses(profile.buffs);

    // Convert to skill ID based structure if needed
    const result: Record<number, number> = {};
    for (const [key, value] of Object.entries(buffBonuses)) {
      const skillId = Number(key);
      if (!isNaN(skillId)) {
        result[skillId] = value;
      }
    }

    return result;
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

  // Calculate breakdown by abilities using skill IDs
  const abilityBreakdown: Record<string, number> = {};
  const abilityStatIds = [16, 17, 18, 19, 20, 21]; // Strength, Stamina, Agility, Sense, Intelligence, Psychic
  const abilityNames = ['Strength', 'Stamina', 'Agility', 'Sense', 'Intelligence', 'Psychic'];

  abilityStatIds.forEach((abilityStatId, index) => {
    const breed = getBreedId(profile.Character.Breed) || 0;
    const skillData = profile.skills[abilityStatId];
    const improvements = skillData?.pointsFromIp || 0;
    const abilityName = abilityNames[index];
    abilityBreakdown[abilityName] = calcTotalAbilityCost(improvements, breed, abilityStatId);
  });

  // Calculate breakdown by skill categories using SkillService
  const skillCategoryBreakdown: Record<string, number> = {};
  const categories = skillService.getAllCategories();

  categories.forEach(category => {
    skillCategoryBreakdown[category] = 0;
    const skillIds = skillService.getSkillsByCategory(category);

    skillIds.forEach(skillId => {
      const skillData = profile.skills[skillId];
      if (skillData && skillData.ipSpent) {
        skillCategoryBreakdown[category] += skillData.ipSpent;
      }
    });
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
  providedEquipmentBonuses?: Record<number, number>,
  providedPerkBonuses?: Record<number, number>,
  providedBuffBonuses?: Record<number, number>
): void {
  const characterStats = profileToCharacterStats(profile);

  // Use provided equipment bonuses or calculate them (converted to skill ID format)
  let equipmentBonuses: Record<number, number> = {};
  if (providedEquipmentBonuses) {
    equipmentBonuses = providedEquipmentBonuses;
  } else {
    const equipmentBonusesOld = calculateEquipmentBonuses(profile);
    // Convert string keys to numeric skill IDs
    for (const [skillIdStr, bonus] of Object.entries(equipmentBonusesOld)) {
      const skillId = parseInt(skillIdStr, 10);
      if (!isNaN(skillId)) {
        equipmentBonuses[skillId] = bonus;
      } else {
        console.warn(`Invalid skill ID in equipment bonuses: ${skillIdStr}`);
      }
    }
  }

  // Use provided perk bonuses or calculate them
  const perkBonuses = providedPerkBonuses || {};

  // Use provided buff bonuses or calculate them
  const buffBonuses = providedBuffBonuses || calculateBuffBonuses(profile);

  // Initialize any bonus-only stats that have bonuses but don't exist in profile yet
  for (const statId of BONUS_ONLY_STAT_IDS) {
    const hasBonus = (equipmentBonuses[statId] || 0) !== 0 ||
                     (perkBonuses[statId] || 0) !== 0 ||
                     (buffBonuses[statId] || 0) !== 0;

    if (hasBonus && !profile.skills[statId]) {
      profile.skills[statId] = createEmptySkillData();
    }
  }

  // Update abilities (skill IDs 16-21)
  const abilityStatIds = [16, 17, 18, 19, 20, 21]; // Strength, Stamina, Agility, Sense, Intelligence, Psychic
  const abilityIndexToStatId = [16, 18, 17, 20, 19, 21]; // Maps ABILITY_INDEX_TO_STAT_ID order

  abilityStatIds.forEach((abilityStatId, index) => {
    const skillData = profile.skills[abilityStatId];
    if (skillData) {
      const breedInitValue = getBreedInitValue(characterStats.breed, abilityStatId);
      const equipmentBonus = equipmentBonuses[abilityStatId] || 0;
      const perkBonus = perkBonuses[abilityStatId] || 0;
      const buffBonus = buffBonuses[abilityStatId] || 0;

      // Ensure pointsFromIp is set (required field)
      if (skillData.pointsFromIp === undefined || skillData.pointsFromIp === null) {
        skillData.pointsFromIp = 0; // Default to no IP spent
      }

      // Calculate base ability cap (without equipment/perks)
      const baseAbilityCap = calcAbilityMaxValue(characterStats.level, characterStats.breed, characterStats.profession, abilityStatId);

      // Calculate base value (breed init + IP improvements, no equipment/perks)
      const baseValue = breedInitValue + skillData.pointsFromIp;

      // Cap the base value at the ability's natural cap
      const cappedBaseValue = Math.min(baseValue, baseAbilityCap);

      // Store computed values in unified SkillData structure
      skillData.base = breedInitValue;
      skillData.trickle = 0; // Abilities don't have trickle-down
      skillData.equipmentBonus = equipmentBonus;
      skillData.perkBonus = perkBonus;
      skillData.buffBonus = buffBonus;
      skillData.cap = baseAbilityCap + equipmentBonus + perkBonus + buffBonus;

      // Final total: base + pointsFromIp + equipment + perks + buffs
      skillData.total = cappedBaseValue + equipmentBonus + perkBonus + buffBonus;
    }
  });

  // For trickle-down, use full ability values INCLUDING equipment and perk bonuses
  const fullAbilityValues: number[] = [
    profile.skills[16]?.total || 0, // Strength
    profile.skills[17]?.total || 0, // Agility
    profile.skills[18]?.total || 0, // Stamina
    profile.skills[19]?.total || 0, // Intelligence
    profile.skills[20]?.total || 0, // Sense
    profile.skills[21]?.total || 0  // Psychic
  ];
  const trickleDownResults = calcAllTrickleDown(fullAbilityValues);
  
  // Update trainable skills with trickle-down and bonuses
  for (const [skillIdStr, skillData] of Object.entries(profile.skills)) {
    const skillId = Number(skillIdStr);

    // Only process trainable skills (have IP costs defined in game data)
    if (TRAINABLE_SKILL_IDS.has(skillId)) {
      // Ensure pointsFromIp is set (required field)
      if (skillData.pointsFromIp === undefined || skillData.pointsFromIp === null) {
        skillData.pointsFromIp = 0; // Default to no IP spent
      }

      // Update trickle-down bonus
      skillData.trickle = trickleDownResults[skillId] || 0;

      // Calculate base skill cap (without equipment/perks)
      const baseSkillCap = calcSkillCap(
        characterStats.level,
        characterStats.profession,
        skillId,
        fullAbilityValues
      );

      // Calculate base value: base skill + trickle-down + IP improvements
      const baseValue = 5 + skillData.trickle + skillData.pointsFromIp;

      // Cap the base value at the skill's natural cap
      const cappedBaseValue = Math.min(baseValue, baseSkillCap);

      // Get equipment, perk, and buff bonuses for this skill
      const equipmentBonus = equipmentBonuses[skillId] || 0;
      const perkBonus = perkBonuses[skillId] || 0;
      const buffBonus = buffBonuses[skillId] || 0;

      // Store computed values in unified SkillData structure
      skillData.base = 5; // Regular skills have base of 5
      skillData.equipmentBonus = equipmentBonus;
      skillData.perkBonus = perkBonus;
      skillData.buffBonus = buffBonus;
      skillData.cap = baseSkillCap + equipmentBonus + perkBonus + buffBonus;

      // Final total: base + trickle + pointsFromIp + equipment + perks + buffs
      skillData.total = cappedBaseValue + equipmentBonus + perkBonus + buffBonus;
    }
  }

  // Apply equipment, perk, and buff bonuses to bonus-only stats
  for (const [skillIdStr, skillData] of Object.entries(profile.skills)) {
    const skillId = Number(skillIdStr);

    // Process bonus-only stats (no base value, no IP cost)
    if (BONUS_ONLY_STAT_IDS.has(skillId)) {
      // Get bonuses for this stat
      const equipmentBonus = equipmentBonuses[skillId] || 0;
      const perkBonus = perkBonuses[skillId] || 0;
      const buffBonus = buffBonuses[skillId] || 0;

      // Bonus-only stats have no base skill value, no trickle-down, no IP
      skillData.base = 0;
      skillData.trickle = 0;
      skillData.ipSpent = 0;
      skillData.pointsFromIp = 0;

      // Update bonus fields
      skillData.equipmentBonus = equipmentBonus;
      skillData.perkBonus = perkBonus;
      skillData.buffBonus = buffBonus;

      // Calculate total value: only bonuses for bonus-only stats
      skillData.total = equipmentBonus + perkBonus + buffBonus;
    }
  }

  // ACs are pure calculated values with no base (always start at 0)
  // They should be calculated on-the-fly in the UI, not stored in the profile
  // This prevents accumulation bugs from repeated bonus applications
  // The actual AC calculation happens in the display components
}

/**
 * Update only trickle-down bonuses for all skills (optimized for ability changes)
 */
export function updateProfileTrickleDown(profile: TinkerProfile): TinkerProfile {
  // Create a deep copy to avoid mutations
  const updatedProfile = JSON.parse(JSON.stringify(profile)) as TinkerProfile;

  // Extract current abilities from profile (full values, not just improvements)
  const abilities: number[] = [
    updatedProfile.skills[16]?.total || 0, // Strength
    updatedProfile.skills[17]?.total || 0, // Agility
    updatedProfile.skills[18]?.total || 0, // Stamina
    updatedProfile.skills[19]?.total || 0, // Intelligence
    updatedProfile.skills[20]?.total || 0, // Sense
    updatedProfile.skills[21]?.total || 0  // Psychic
  ];

  // Calculate new trickle-down values
  const trickleDownResults = calcAllTrickleDown(abilities);

  // Update trickle-down for all trainable skills
  for (const [skillIdStr, skillData] of Object.entries(updatedProfile.skills)) {
    const skillId = Number(skillIdStr);

    // Only update trainable skills that have trickle-down
    if (TRAINABLE_SKILL_IDS.has(skillId) && skillData) {
      const newTrickleDown = trickleDownResults[skillId] || 0;

      // Update trickle-down bonus
      skillData.trickle = newTrickleDown;

      // Recalculate base value: base + trickle + IP improvements
      const baseValue = 5 + newTrickleDown + (skillData.pointsFromIp || 0);

      // Always include equipment, perk, and buff bonuses in final value
      const equipmentBonus = skillData.equipmentBonus || 0;
      const perkBonus = skillData.perkBonus || 0;
      const buffBonus = skillData.buffBonus || 0;
      skillData.total = baseValue + equipmentBonus + perkBonus + buffBonus;
    }
  }

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
  for (const [skillIdStr, skillData] of Object.entries(profile.skills)) {
    const skillId = Number(skillIdStr);

    // Only check trainable skills that have caps
    if (TRAINABLE_SKILL_IDS.has(skillId)) {
      try {
        const skillName = skillService.getName(skillId);
        // Calculate theoretical cap (this would need to be calculated properly)
        const characterStats = profileToCharacterStats(profile);
        const abilities = [
          profile.skills[16]?.total || 0, // Strength
          profile.skills[17]?.total || 0, // Agility
          profile.skills[18]?.total || 0, // Stamina
          profile.skills[19]?.total || 0, // Intelligence
          profile.skills[20]?.total || 0, // Sense
          profile.skills[21]?.total || 0  // Psychic
        ];

        const baseSkillCap = calcSkillCap(
          characterStats.level,
          characterStats.profession,
          skillId,
          abilities
        );

        if (skillData.total >= baseSkillCap * 0.95) {
          warnings.push(`${skillName} is near its natural cap (${skillData.total}/${baseSkillCap})`);
        }
      } catch (error) {
        // Skip invalid skill IDs
      }
    }
  }
  
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
  let perkBonuses: Record<number, number> = {};
  try {
    perkBonuses = await calculatePerkBonuses(updatedProfile);
  } catch (error) {
    console.warn('Failed to calculate perk bonuses during IP recalculation:', error);
  }

  // Calculate buff bonuses if buffs are present
  let buffBonuses: Record<number, number> = {};
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
  skillId: number,
  newValue: number
): Promise<{
  success: boolean;
  error?: string;
  updatedProfile?: TinkerProfile;
}> {
  const skillData = profile.skills[skillId];
  if (!skillData) {
    return {
      success: false,
      error: `Skill ID ${skillId} not found in profile`
    };
  }

  // Get skill name for display purposes
  let skillName: string;
  try {
    skillName = skillService.getName(skillId);
  } catch (error) {
    return {
      success: false,
      error: `Invalid skill ID: ${skillId}`
    };
  }

  // For trainable skills, check if new value exceeds natural cap (without bonuses)
  if (TRAINABLE_SKILL_IDS.has(skillId)) {
    const characterStats = profileToCharacterStats(profile);
    const abilities = [
      profile.skills[16]?.total || 0, // Strength
      profile.skills[17]?.total || 0, // Agility
      profile.skills[18]?.total || 0, // Stamina
      profile.skills[19]?.total || 0, // Intelligence
      profile.skills[20]?.total || 0, // Sense
      profile.skills[21]?.total || 0  // Psychic
    ];

    const baseSkillCap = calcSkillCap(
      characterStats.level,
      characterStats.profession,
      skillId,
      abilities
    );

    const trickleDown = skillData.trickle || 0;
    const maxPossibleFromIP = baseSkillCap - 5 - trickleDown;

    if (newValue > baseSkillCap) {
      return {
        success: false,
        error: `Cannot raise ${skillName} to ${newValue}, exceeds natural cap of ${baseSkillCap}`
      };
    }
  }

  // Calculate IP cost difference
  const oldImprovements = skillData.pointsFromIp || 0;
  const trickleDown = skillData.trickle || 0;
  const newImprovements = Math.max(0, newValue - 5 - trickleDown);
  const improvementDiff = newImprovements - oldImprovements;

  if (improvementDiff === 0) {
    return { success: true, updatedProfile: profile };
  }

  // Calculate IP cost for trainable skills
  let ipCost = 0;
  if (TRAINABLE_SKILL_IDS.has(skillId)) {
    const profession = getProfessionId(profile.Character.Profession) || 0;

    if (improvementDiff > 0) {
      // Calculate cost to raise skill
      for (let i = oldImprovements; i < newImprovements; i++) {
        ipCost += calcTotalSkillCost(1, profession, skillId);
      }
    } else {
      // Calculate IP refund for lowering skill
      for (let i = newImprovements; i < oldImprovements; i++) {
        ipCost -= calcTotalSkillCost(1, profession, skillId);
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
  }

  // Create updated profile
  const updatedProfile = JSON.parse(JSON.stringify(profile)) as TinkerProfile;
  const updatedSkill = updatedProfile.skills[skillId];

  updatedSkill.pointsFromIp = newImprovements;
  updatedSkill.ipSpent = (updatedSkill.ipSpent || 0) + ipCost;

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
  abilityId: number,
  newValue: number
): Promise<{
  success: boolean;
  error?: string;
  updatedProfile?: TinkerProfile;
  trickleDownChanges?: Record<number, { old: number; new: number }>;
}> {
  const abilityData = profile.skills[abilityId];
  if (!abilityData) {
    return {
      success: false,
      error: `Ability ID ${abilityId} not found`
    };
  }

  // Verify this is an ability (skill IDs 16-21)
  if (abilityId < 16 || abilityId > 21) {
    return {
      success: false,
      error: `Skill ID ${abilityId} is not an ability`
    };
  }

  const breed = getBreedId(profile.Character.Breed) || 0;

  // Calculate new improvement value
  const breedBase = getBreedInitValue(breed, abilityId);
  const newImprovements = Math.max(0, newValue - breedBase);
  const oldImprovements = abilityData.pointsFromIp || 0;
  const improvementDiff = newImprovements - oldImprovements;

  if (improvementDiff === 0) {
    return { success: true, updatedProfile: profile };
  }

  // Calculate IP cost
  let ipCost = 0;
  if (improvementDiff > 0) {
    for (let i = oldImprovements; i < newImprovements; i++) {
      ipCost += calcTotalAbilityCost(1, breed, abilityId);
    }
  } else {
    for (let i = newImprovements; i < oldImprovements; i++) {
      ipCost -= calcTotalAbilityCost(1, breed, abilityId);
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
  const oldTrickleDownChanges: Record<number, { old: number; new: number }> = {};

  // Track trickle-down changes for trainable skills
  for (const [skillIdStr, skillData] of Object.entries(profile.skills)) {
    const skillId = Number(skillIdStr);
    if (TRAINABLE_SKILL_IDS.has(skillId) && skillData.trickle !== undefined) {
      oldTrickleDownChanges[skillId] = { old: skillData.trickle, new: 0 };
    }
  }

  // Create updated profile
  const updatedProfile = JSON.parse(JSON.stringify(profile)) as TinkerProfile;
  const updatedAbility = updatedProfile.skills[abilityId];

  updatedAbility.pointsFromIp = newImprovements;
  updatedAbility.ipSpent = (updatedAbility.ipSpent || 0) + ipCost;

  // Recalculate ability total before trickle-down calculation
  // This is critical: updateProfileTrickleDown reads ability.total values,
  // so we must update the total to reflect the new pointsFromIp
  const characterStats = profileToCharacterStats(updatedProfile);
  const baseAbilityCap = calcAbilityMaxValue(characterStats.level, characterStats.breed, characterStats.profession, abilityId);
  const baseValue = breedBase + newImprovements;
  const cappedBaseValue = Math.min(baseValue, baseAbilityCap);

  // Preserve existing bonuses when recalculating total
  const equipmentBonus = updatedAbility.equipmentBonus || 0;
  const perkBonus = updatedAbility.perkBonus || 0;
  const buffBonus = updatedAbility.buffBonus || 0;
  const updatedCap = baseAbilityCap + equipmentBonus + perkBonus + buffBonus;

  updatedAbility.total = cappedBaseValue + equipmentBonus + perkBonus + buffBonus;
  updatedAbility.cap = updatedCap;

  // Apply optimized trickle-down update (now uses correct ability totals)
  const profileWithTrickleDown = updateProfileTrickleDown(updatedProfile);

  // Capture new trickle-down values
  for (const [skillIdStr, skillData] of Object.entries(profileWithTrickleDown.skills)) {
    const skillId = Number(skillIdStr);
    if (oldTrickleDownChanges[skillId] !== undefined) {
      oldTrickleDownChanges[skillId].new = skillData.trickle || 0;
    }
  }

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
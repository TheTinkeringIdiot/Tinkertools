/**
 * IP Calculator - Anarchy Online Improvement Points calculation system
 * 
 * This module implements the complete IP calculation system from AOSkills4,
 * including skill costs, ability costs, caps, and trickle-down mechanics.
 * 
 * Now uses game-data.ts as the single source of truth for all game constants.
 */

import { 
  BREED_ABILITY_DATA, 
  PROFESSION_VITALS, 
  SKILL_COST_FACTORS, 
  SKILL_TRICKLE_DOWN,
  STAT
} from '@/services/game-data';

// ============================================================================
// IP Calculation Constants (IP-specific, not game data)
// ============================================================================

const BASE_SKILL = 5; // Base skill value that all characters start with

// Title level breakpoints
const TITLE_LEVELS = [1, 15, 50, 100, 150, 190, 205];

// Level adjustments by title level for IP calculation
const LEVEL_ADJUST_BY_TL = [1, 1, 14, 49, 99, 149, 189, 204];

// IP gained per level by title level
const IP_BY_TL = [0, 4000, 10000, 20000, 40000, 80000, 150000, 600000];

// Base IP by title level
const BASE_IP_BY_TL = [1500, 1500, 53500, 403500, 1403500, 3403500, 6603500, 8853500];

// Ability names (for backward compatibility)
export const ABILITY_NAMES = ['Strength', 'Agility', 'Stamina', 'Intelligence', 'Sense', 'Psychic'];

// Ability STAT IDs from game-data.ts
export const ABILITY_STAT_IDS = {
  'Strength': 16,
  'Agility': 17,
  'Stamina': 18,
  'Intelligence': 19,
  'Sense': 20,
  'Psychic': 21
} as const;

// Map from 0-based ability index to STAT ID
export const ABILITY_INDEX_TO_STAT_ID = [16, 17, 18, 19, 20, 21];

// Cost factor to skill cap conversion table
// [cost_factor, inc_per_level, tl1_cap, tl2_cap, tl3_cap, tl4_cap, tl5_cap, tl6_cap, post201_inc_per_level]
const COST_TO_RATE: number[][] = [
  [1.0, 5, 55, 195, 355, 485, 545, 595, 25],
  [1.1, 5, 55, 195, 355, 485, 545, 595, 25],
  [1.2, 5, 55, 195, 355, 485, 545, 595, 25],
  [1.3, 5, 55, 195, 355, 485, 545, 595, 25],
  [1.4, 5, 55, 195, 355, 485, 545, 595, 25],
  [1.5, 4, 50, 175, 325, 445, 495, 535, 20],
  [1.6, 4, 50, 175, 325, 445, 495, 535, 20],
  [1.7, 4, 50, 175, 325, 445, 495, 535, 20],
  [1.8, 4, 50, 175, 325, 445, 495, 535, 20],
  [1.9, 4, 50, 175, 325, 445, 495, 535, 20],
  [2.0, 4, 50, 175, 325, 445, 495, 535, 20],
  [2.1, 4, 50, 175, 325, 445, 495, 535, 20],
  [2.2, 4, 50, 175, 325, 445, 495, 535, 20],
  [2.3, 4, 50, 175, 325, 445, 495, 535, 20],
  [2.4, 4, 50, 175, 325, 445, 495, 535, 20],
  [2.5, 4, 45, 155, 295, 405, 445, 475, 15],
  [2.6, 4, 45, 155, 295, 405, 445, 475, 15],
  [2.7, 4, 45, 155, 295, 405, 445, 475, 15],
  [2.8, 4, 45, 155, 295, 405, 445, 475, 15],
  [2.9, 4, 45, 155, 295, 405, 445, 475, 15],
  [3.0, 4, 45, 155, 295, 405, 445, 475, 15],
  [3.1, 4, 45, 155, 295, 405, 445, 475, 15],
  [3.2, 4, 45, 155, 295, 405, 445, 475, 15],
  [3.3, 4, 45, 155, 295, 405, 445, 475, 10],
  [3.4, 4, 45, 155, 295, 405, 445, 475, 10],
  [3.5, 3, 40, 135, 265, 365, 395, 415, 10],
  [3.6, 3, 40, 135, 265, 365, 395, 415, 10],
  [3.7, 3, 40, 135, 265, 365, 395, 415, 10],
  [3.8, 3, 40, 135, 265, 365, 395, 415, 10],
  [3.9, 3, 40, 135, 265, 365, 395, 415, 10],
  [4.0, 3, 40, 135, 265, 365, 395, 415, 10],
  [4.1, 3, 40, 135, 265, 365, 395, 415, 10],
  [4.2, 3, 40, 135, 265, 365, 395, 415, 10],
  [4.3, 3, 40, 135, 265, 365, 395, 415, 10],
  [4.4, 3, 40, 135, 265, 365, 395, 415, 10],
  [4.5, 3, 35, 115, 245, 325, 345, 355, 5],
  [4.6, 3, 35, 115, 245, 325, 345, 355, 5],
  [4.7, 3, 35, 115, 245, 325, 345, 355, 5],
  [4.8, 3, 35, 115, 245, 325, 345, 355, 5],
  [4.9, 3, 35, 115, 245, 325, 345, 355, 5],
  [5.0, 3, 35, 115, 245, 325, 345, 355, 5]
];

// All breed and profession data now imported from game-data.ts

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface IPCalculationResult {
  totalIP: number;
  usedIP: number;
  availableIP: number;
  abilityIP: number;
  skillIP: number;
  efficiency: number;
}

export interface SkillCap {
  maxValue: number;
}

export interface TrickleDownResult {
  [skillId: number]: number;
}

export interface CharacterStats {
  level: number;
  breed: number; // 0-3
  profession: number; // 0-13
  abilities: number[]; // 6 abilities
  skills: number[]; // 97+ skills
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * AO-specific rounding (round down if < 0.5, up otherwise)
 */
function roundAO(n: number): number {
  return Math.floor(n + 0.5);
}

/**
 * Always round down
 */
function roundDown(n: number): number {
  return Math.floor(n);
}

// ============================================================================
// Core Calculation Functions
// ============================================================================

/**
 * Calculate current title level for a given character level
 */
export function calcTitleLevel(level: number): number {
  for (let i = 1; i <= 6; i++) {
    if (level < TITLE_LEVELS[i]) {
      return i;
    }
  }
  return 7;
}

/**
 * Calculate maximum level of previous title level
 */
export function calcPrevTitleLevel(level: number): number {
  for (let i = 1; i <= 6; i++) {
    if (level < TITLE_LEVELS[i]) {
      return TITLE_LEVELS[i - 1] - 1;
    }
  }
  return 204;
}

/**
 * Calculate total available IP for a given level
 */
export function calcIP(level: number): number {
  const tl = level === 1 ? 0 : calcTitleLevel(level);
  return BASE_IP_BY_TL[tl] + ((level - LEVEL_ADJUST_BY_TL[tl]) * IP_BY_TL[tl]);
}

/**
 * Calculate IP cost to raise an ability by one point
 */
export function calcAbilityCost(currentValue: number, breed: number, abilityStatId: number): number {
  // Convert STAT ID to ability index for breed data lookup
  const abilityIndex = ABILITY_INDEX_TO_STAT_ID.indexOf(abilityStatId);
  if (abilityIndex === -1) {
    console.warn(`[calcAbilityCost] Unknown ability STAT ID ${abilityStatId}`);
    return currentValue * 2; // Conservative fallback
  }
  
  return currentValue * BREED_ABILITY_DATA.cost_factors[breed][abilityIndex];
}

/**
 * Calculate total IP cost for an ability at a given level
 */
export function calcTotalAbilityCost(improvements: number, breed: number, abilityStatId: number): number {
  // Convert STAT ID to ability index for breed data lookup
  const abilityIndex = ABILITY_INDEX_TO_STAT_ID.indexOf(abilityStatId);
  if (abilityIndex === -1) {
    console.warn(`[calcTotalAbilityCost] Unknown ability STAT ID ${abilityStatId}`);
    return improvements * 10; // Conservative fallback
  }
  
  let totalIP = 0;
  if (improvements > 0) {
    for (let i = 0; i < improvements; i++) {
      totalIP += roundDown(calcAbilityCost(i + BREED_ABILITY_DATA.initial[breed][abilityIndex], breed, abilityStatId));
    }
  }
  return totalIP;
}

/**
 * Calculate IP cost to raise a skill by one point
 * Now uses STAT ID directly with profession ID
 */
export function calcSkillCost(currentValue: number, profession: number, skillId: number): number {
  const skillCosts = SKILL_COST_FACTORS[skillId];
  if (!skillCosts) {
    return currentValue * 4.0; // Default cost for unknown skills (expansion skills)
  }
  const costFactor = skillCosts[profession] ?? 4.0; // Default if profession not found
  return currentValue * costFactor;
}

/**
 * Calculate total IP cost for a skill at a given level
 */
export function calcTotalSkillCost(improvements: number, profession: number, skillId: number): number {
  let totalIP = 0;
  if (improvements > 0) {
    for (let i = 0; i < improvements; i++) {
      totalIP += roundDown(calcSkillCost(i + BASE_SKILL, profession, skillId));
    }
  }
  return totalIP;
}

/**
 * Calculate maximum value for an ability (breed base + adjustable range)
 */
export function calcAbilityMaxValue(level: number, breed: number, profession: number, abilityStatId: number): number {
  // Convert STAT ID to ability index for breed data lookup
  const abilityIndex = ABILITY_INDEX_TO_STAT_ID.indexOf(abilityStatId);
  if (abilityIndex === -1) {
    console.warn(`[calcAbilityMaxValue] Unknown ability STAT ID ${abilityStatId}`);
    return 10; // Conservative fallback
  }
  
  const baseValue = BREED_ABILITY_DATA.initial[breed][abilityIndex];
  const adjustableRange = calcAbilityIPAdjustableRange(level, breed, abilityStatId);
  
  const maxValue = baseValue + adjustableRange;
  console.log(`[DEBUG] calcAbilityMaxValue: ability ${abilityStatId}, breed base(${baseValue}) + adjustable(${adjustableRange}) = ${maxValue}`);
  
  return maxValue;
}

/**
 * Calculate IP adjustable range for a skill/ability
 * This is how much IP can be spent on the skill, not including base values
 */
export function calcIPAdjustableRange(level: number, profession: number, skillId: number): number {
  const skillCostFactors = SKILL_COST_FACTORS[skillId];
  if (!skillCostFactors) {
    console.warn(`[calcIPAdjustableRange] Unknown skill ID ${skillId}, using fallback`);
    return 10; // Minimal fallback for truly unknown skills
  }
  
  const tl = calcTitleLevel(level);
  const costFac = skillCostFactors[profession];
  const costIndex = Math.min(Math.floor(costFac * 10) - 10, COST_TO_RATE.length - 1);
  
  if (costIndex < 0 || costIndex >= COST_TO_RATE.length) {
    console.log(`[DEBUG] calcIPAdjustableRange: Invalid costIndex ${costIndex} for skill ${skillId}, profession ${profession}, costFac ${costFac}`);
    return 0;
  }
  
  const rateData = COST_TO_RATE[costIndex];
  let adjustableRange: number;
  
  if (level < 201) {
    if (tl === 1) {
      // For TL1, adjustable range is what can be gained through leveling
      adjustableRange = rateData[1] * level;
      console.log(`[DEBUG] calcIPAdjustableRange: Level ${level}, TL1, skill ${skillId}, rateData[1](${rateData[1]}) * level(${level}) = ${adjustableRange}`);
    } else {
      // For higher TLs, sum all previous TL caps plus current TL progress
      let totalRange = 0;
      
      // Add all complete previous TL ranges
      for (let i = 2; i <= tl - 1; i++) {
        totalRange += rateData[i];
      }
      
      // Add TL1 range (always complete for TL2+)
      const tl1Levels = Math.min(level, TITLE_LEVELS[1] - 1);
      totalRange += rateData[1] * tl1Levels;
      
      // Add current TL progress
      const prevTLMax = TITLE_LEVELS[tl - 1] - 1;
      const currentTLLevels = level - prevTLMax;
      totalRange += Math.min(currentTLLevels * rateData[1], rateData[tl]);
      
      adjustableRange = totalRange;
      console.log(`[DEBUG] calcIPAdjustableRange: Level ${level}, TL${tl}, skill ${skillId}, total adjustable range: ${adjustableRange}`);
    }
  } else {
    // Post-201: All TL1-TL6 ranges plus post-201 progression
    let totalRange = 0;
    
    // Sum TL1-TL6 complete ranges
    totalRange += rateData[1] * (TITLE_LEVELS[1] - 1); // TL1
    for (let i = 2; i <= 6; i++) {
      totalRange += rateData[i];
    }
    
    // Add post-201 progression
    totalRange += rateData[7] + (level - 200) * rateData[8];
    
    adjustableRange = totalRange;
    console.log(`[DEBUG] calcIPAdjustableRange: Post-201 level ${level}, skill ${skillId}, total adjustable range: ${adjustableRange}`);
  }
  
  return adjustableRange;
}

/**
 * Calculate IP adjustable range specifically for abilities
 * Abilities have breed-specific cost factors that affect their progression differently from skills
 */
export function calcAbilityIPAdjustableRange(level: number, breed: number, abilityStatId: number): number {
  // Convert STAT ID to ability index for breed data lookup
  const abilityIndex = ABILITY_INDEX_TO_STAT_ID.indexOf(abilityStatId);
  if (abilityIndex === -1) {
    console.warn(`[calcAbilityIPAdjustableRange] Unknown ability STAT ID ${abilityStatId}`);
    return 3; // Conservative fallback
  }

  const breedCostFactors = BREED_ABILITY_DATA.cost_factors[breed];
  if (!breedCostFactors) {
    console.warn(`[calcAbilityIPAdjustableRange] Unknown breed ${breed}`);
    return 3;
  }

  const costFactor = breedCostFactors[abilityIndex];
  const tl = calcTitleLevel(level);
  
  let adjustableRange: number;
  
  if (level < 201) {
    // Pre-201 ability progression based on breed cost factors
    // Cost factor 1 (cheap abilities): 5 points per level
    // Cost factor 2 (normal abilities): 3 points per level  
    // Cost factor 3 (expensive abilities): 2 points per level
    const basePointsPerLevel = costFactor === 1 ? 5 : (costFactor === 2 ? 3 : 2);
    
    if (tl === 1) {
      adjustableRange = basePointsPerLevel * level;
      console.log(`[DEBUG] calcAbilityIPAdjustableRange: Level ${level}, TL1, ability ${abilityStatId}, cost factor ${costFactor}, ${basePointsPerLevel} * level(${level}) = ${adjustableRange}`);
    } else {
      // For higher TLs, calculate cumulative progression
      let totalRange = 0;
      
      // Add TL1 range (always complete for TL2+)
      const tl1Levels = Math.min(level, TITLE_LEVELS[1] - 1);
      totalRange += basePointsPerLevel * tl1Levels;
      
      // Add any additional TL progression
      if (level > TITLE_LEVELS[1] - 1) {
        const remainingLevels = level - (TITLE_LEVELS[1] - 1);
        // Scale down progression for higher TLs
        const higherTLMultiplier = 0.8;
        totalRange += Math.floor(basePointsPerLevel * higherTLMultiplier * remainingLevels);
      }
      
      adjustableRange = totalRange;
      console.log(`[DEBUG] calcAbilityIPAdjustableRange: Level ${level}, TL${tl}, ability ${abilityStatId}, cost factor ${costFactor}, total adjustable range: ${adjustableRange}`);
    }
  } else {
    // Post-201: Use breed-specific post-201 progression
    const post201PerLevel = BREED_ABILITY_DATA.caps_post201_per_level[breed]?.[abilityIndex] || 15;
    const pre201Cap = BREED_ABILITY_DATA.caps_pre201[breed]?.[abilityIndex] || 480;
    const breedBase = BREED_ABILITY_DATA.initial[breed]?.[abilityIndex] || 6;
    
    const pre201Adjustable = pre201Cap - breedBase;
    const post201Levels = level - 200;
    const post201Adjustable = post201PerLevel * post201Levels;
    
    adjustableRange = pre201Adjustable + post201Adjustable;
    console.log(`[DEBUG] calcAbilityIPAdjustableRange: Level ${level}, post-201, ability ${abilityStatId}, pre201(${pre201Adjustable}) + post201(${post201Adjustable}) = ${adjustableRange}`);
  }
  
  return Math.max(0, adjustableRange);
}

/**
 * Calculate maximum value for a skill (base + trickle-down + adjustable range)
 */
export function calcSkillMaxValue(level: number, profession: number, skillId: number, abilities: number[]): number {
  const baseValue = BASE_SKILL; // All IP-based skills start at 5
  const trickleDown = calcTrickleDown(abilities, skillId);
  const adjustableRange = calcIPAdjustableRange(level, profession, skillId);
  
  const maxValue = baseValue + trickleDown + adjustableRange;
  console.log(`[DEBUG] calcSkillMaxValue: skill ${skillId}, base(${baseValue}) + trickle(${trickleDown}) + adjustable(${adjustableRange}) = ${maxValue}`);
  
  return maxValue;
}


/**
 * Calculate trickle-down bonus from abilities to skill
 */
export function calcTrickleDown(abilities: number[], skillId: number): number {
  const trickleFactors = SKILL_TRICKLE_DOWN[skillId];
  if (!trickleFactors) {
    return 0;
  }
  
  let weightedAbility = 0;
  for (let i = 0; i < 6; i++) {
    weightedAbility += abilities[i] * trickleFactors[i];
  }
  
  return roundDown(weightedAbility / 4.0);
}

/**
 * Calculate all trickle-down bonuses for a character
 */
export function calcAllTrickleDown(abilities: number[]): TrickleDownResult {
  const result: TrickleDownResult = {};
  
  for (const skillId of Object.keys(SKILL_TRICKLE_DOWN).map(Number)) {
    result[skillId] = calcTrickleDown(abilities, skillId);
  }
  
  return result;
}

/**
 * Calculate maximum health
 */
export function calcHP(bodyDev: number, level: number, breed: number, profession: number): number {
  let tl = calcTitleLevel(level);
  tl = tl === 7 ? 6 : tl; // Cap at TL6 for HP calculation
  
  const professionHPPerLevel = PROFESSION_VITALS.hp_per_level[profession];
  if (!professionHPPerLevel) {
    console.warn(`Unknown profession ID: ${profession}`);
    return 0;
  }
  
  // For now, we'll use temporary constants until we move all breed vitals data
  // TODO: Move these breed vitals constants to game-data.ts
  const BREED_BASE_HP = [0, 6, 6, 6, 6]; // [unknown, solitus, opifex, nanomage, atrox]
  const BREED_BODY_FAC = [1, 1, 1, 1, 1]; // Body factor multipliers
  const BREED_HP = [0, 0, 0, 0, 0]; // HP bonus per level
  
  const levelHP = (professionHPPerLevel[tl - 1] + BREED_HP[breed]) * level;
  return BREED_BASE_HP[breed] + (bodyDev * BREED_BODY_FAC[breed]) + levelHP;
}

/**
 * Calculate maximum nano pool
 */
export function calcNP(nanoPool: number, level: number, breed: number, profession: number): number {
  let tl = calcTitleLevel(level);
  tl = tl === 7 ? 6 : tl; // Cap at TL6 for NP calculation
  
  const professionNPPerLevel = PROFESSION_VITALS.np_per_level[profession];
  if (!professionNPPerLevel) {
    console.warn(`Unknown profession ID: ${profession}`);
    return 0;
  }
  
  // For now, we'll use temporary constants until we move all breed vitals data
  // TODO: Move these breed vitals constants to game-data.ts  
  const BREED_BASE_NP = [0, 10, 10, 15, 5]; // [unknown, solitus, opifex, nanomage, atrox]
  const BREED_NANO_FAC = [1, 1, 1, 1, 1]; // Nano factor multipliers
  const BREED_NP = [0, 0, 0, 0, 0]; // NP bonus per level
  
  const levelNP = (professionNPPerLevel[tl - 1] + BREED_NP[breed]) * level;
  return BREED_BASE_NP[breed] + (nanoPool * BREED_NANO_FAC[breed]) + levelNP;
}

/**
 * Calculate skill cap for a character (simplified - just returns max value)
 */
export function calcSkillCap(level: number, profession: number, skillId: number, abilities: number[]): number {
  return calcSkillMaxValue(level, profession, skillId, abilities);
}

/**
 * Calculate comprehensive IP analysis for a character
 */
export function calcIPAnalysis(stats: CharacterStats): IPCalculationResult {
  const totalIP = calcIP(stats.level);
  let abilityIP = 0;
  let skillIP = 0;
  
  // Calculate ability costs using STAT IDs
  for (let i = 0; i < 6; i++) {
    const abilityStatId = ABILITY_INDEX_TO_STAT_ID[i];
    abilityIP += calcTotalAbilityCost(stats.abilities[i], stats.breed, abilityStatId);
  }
  
  // Calculate skill costs
  for (let i = 0; i < stats.skills.length; i++) {
    skillIP += calcTotalSkillCost(stats.skills[i], stats.profession, i);
  }
  
  const usedIP = abilityIP + skillIP;
  const availableIP = totalIP - usedIP;
  const efficiency = totalIP > 0 ? Math.round((usedIP / totalIP) * 100) : 0;
  
  return {
    totalIP,
    usedIP,
    availableIP,
    abilityIP,
    skillIP,
    efficiency
  };
}

/**
 * Validate if a character build is valid within IP constraints
 */
export function validateCharacterBuild(stats: CharacterStats): {
  valid: boolean;
  errors: string[];
  ipAnalysis: IPCalculationResult;
} {
  const errors: string[] = [];
  const ipAnalysis = calcIPAnalysis(stats);
  
  // Check IP constraints
  if (ipAnalysis.availableIP < 0) {
    errors.push(`Character exceeds available IP by ${Math.abs(ipAnalysis.availableIP)} points`);
  }
  
  // Check ability caps using STAT IDs
  for (let i = 0; i < 6; i++) {
    const abilityStatId = ABILITY_INDEX_TO_STAT_ID[i];
    const cap = calcAbilityMaxValue(stats.level, stats.breed, stats.profession, abilityStatId);
    if (stats.abilities[i] > cap) {
      errors.push(`${ABILITY_NAMES[i]} exceeds cap of ${cap} (current: ${stats.abilities[i]})`);
    }
  }
  
  // Check skill caps (we'll use skill IDs directly since we moved to ID-based system)
  // Note: This validation function may need to be redesigned for the new ID-based skill system
  for (let i = 0; i < stats.skills.length; i++) {
    const skillCap = calcSkillCap(stats.level, stats.profession, i, stats.abilities);
    if (stats.skills[i] > skillCap) {
      const skillName = STAT[i as keyof typeof STAT] || `Skill ${i}`;
      errors.push(`${skillName} exceeds cap of ${skillCap} (current: ${stats.skills[i]})`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    ipAnalysis
  };
}

// ============================================================================
// Helper Functions for Integration
// ============================================================================

/**
 * Get skill cost factor for a profession and skill
 */
export function getSkillCostFactor(profession: number, skillId: number): number {
  const skillCostFactors = SKILL_COST_FACTORS[skillId];
  if (!skillCostFactors) {
    return 1.0;
  }
  return skillCostFactors[profession] || 1.0;
}

/**
 * Get ability cost factor for a breed and ability
 */
export function getAbilityCostFactor(breed: number, abilityStatId: number): number {
  // Convert STAT ID to ability index for breed data lookup
  const abilityIndex = ABILITY_INDEX_TO_STAT_ID.indexOf(abilityStatId);
  if (abilityIndex === -1 || breed < 0) {
    return 2.0; // Conservative fallback
  }
  
  const breedCostFactors = BREED_ABILITY_DATA.cost_factors[breed];
  if (!breedCostFactors) {
    return 2.0;
  }
  return breedCostFactors[abilityIndex];
}

/**
 * Get breed starting value for an ability
 */
export function getBreedInitValue(breed: number, abilityStatId: number): number {
  // Convert STAT ID to ability index for breed data lookup
  const abilityIndex = ABILITY_INDEX_TO_STAT_ID.indexOf(abilityStatId);
  if (abilityIndex === -1 || breed < 0) {
    return 6; // Conservative fallback
  }
  
  const breedInitialValues = BREED_ABILITY_DATA.initial[breed];
  if (!breedInitialValues) {
    return 6;
  }
  return breedInitialValues[abilityIndex];
}

// getBreedId function removed - use the one from game-utils.ts instead

/**
 * Get profession ID from profession name
 */
// getProfessionId function removed - use the one from game-utils.ts instead
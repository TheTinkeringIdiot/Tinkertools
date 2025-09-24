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

// Reverse mapping: STAT ID to 0-based ability index for efficient lookups
export const STAT_ID_TO_ABILITY_INDEX: Record<number, number> = {
  16: 0, // Strength
  17: 1, // Agility
  18: 2, // Stamina
  19: 3, // Intelligence
  20: 4, // Sense
  21: 5  // Psychic
};

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
  skills: Record<string, number>; // skills mapped by STAT ID
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
  const abilityIndex = STAT_ID_TO_ABILITY_INDEX[abilityStatId];
  if (abilityIndex === undefined) {
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
  const abilityIndex = STAT_ID_TO_ABILITY_INDEX[abilityStatId];
  if (abilityIndex === undefined) {
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
  const abilityIndex = STAT_ID_TO_ABILITY_INDEX[abilityStatId];
  if (abilityIndex === undefined) {
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
    return 0;
  }
  
  const rateData = COST_TO_RATE[costIndex];
  let adjustableRange: number;
  
  if (level < 201) {
    if (tl === 1) {
      // For TL1, adjustable range is limited by both leveling and TL1 cap
      const potentialRange = rateData[1] * level;
      const tl1Cap = rateData[2]; // TL1 cap from COST_TO_RATE table
      adjustableRange = Math.min(potentialRange, tl1Cap);
    } else {
      // For TL2-6, caps grow by inc_per_level for each level within the title level
      // Start with the previous TL's cap and add inc_per_level for each level into the current TL

      const prevTLCap = tl > 1 ? rateData[tl] : 0;  // Cap from previous TL (or 0 if TL2)
      const incPerLevel = rateData[1];               // Inc per level from COST_TO_RATE table
      const currentTLMaxCap = rateData[tl + 1];      // Maximum cap for current TL

      // Calculate the level range for current TL
      const tlStartLevel = TITLE_LEVELS[tl - 1];     // Start level of current TL

      // Calculate how many levels into the current TL we are
      const levelsIntoTL = level - tlStartLevel + 1; // +1 because levels 50-60 is 11 levels, not 10

      // Cap increases by inc_per_level for each level, but cannot exceed the TL max cap
      adjustableRange = Math.min(prevTLCap + (incPerLevel * levelsIntoTL), currentTLMaxCap);

      // Debug for Body Dev
      if (skillId === 152) {
        console.log(`[DEBUG] TL${tl} cap calculation:
          Level ${level}, TL start: ${tlStartLevel}
          Previous TL cap: ${prevTLCap}
          Inc per level: ${incPerLevel}
          Levels into TL: ${levelsIntoTL} (levels ${tlStartLevel}-${level} inclusive)
          Calculated: ${prevTLCap} + (${incPerLevel} * ${levelsIntoTL}) = ${prevTLCap + (incPerLevel * levelsIntoTL)}
          Capped at TL${tl} max: ${currentTLMaxCap}
          Final adjustable range: ${adjustableRange}`);
      }
    }
  } else {
    // Post-201: TL6 cap plus post-201 progression
    // For post-201 characters, we start with the TL6 cap and add post-201 progression
    // The TL caps in COST_TO_RATE are cumulative maximums, not additive ranges
    adjustableRange = rateData[7]; // TL6 cap (e.g., 595 for Body Dev)

    // Add post-201 progression: levels beyond 200 * post-201 increment per level
    const post201Levels = level - 200;
    adjustableRange += post201Levels * rateData[8];

  }

  // Debug logging for Body Dev (skill ID 152)
  if (skillId === 152) {
    console.log(`[DEBUG] calcIPAdjustableRange for Body Dev (${skillId}):
      Level: ${level}, TL: ${tl}, Profession: ${profession}
      Cost factor: ${costFac}, Cost index: ${costIndex}
      Adjustable range: ${adjustableRange}`);
  }

  return adjustableRange;
}

/**
 * Calculate IP adjustable range specifically for abilities
 * Abilities have breed-specific cost factors that affect their progression differently from skills
 */
export function calcAbilityIPAdjustableRange(level: number, breed: number, abilityStatId: number): number {
  // Convert STAT ID to ability index for breed data lookup
  const abilityIndex = STAT_ID_TO_ABILITY_INDEX[abilityStatId];
  if (abilityIndex === undefined) {
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
    // Pre-201: Calculate cap based on current title level, not always using level 200 cap
    // Use the COST_TO_RATE table with the breed's cost factor to determine the cap for this TL
    const costIndex = Math.min(Math.floor(costFactor * 10) - 10, COST_TO_RATE.length - 1);
    const breedBase = BREED_ABILITY_DATA.initial[breed]?.[abilityIndex] || 6;

    if (costIndex < 0 || costIndex >= COST_TO_RATE.length) {
      adjustableRange = 0;
    } else {
      
      let cap: number;

      cap = Math.min(level * 3 + breedBase, BREED_ABILITY_DATA.caps_pre201[breed]?.[abilityIndex])  // Breed-specific pre-201 cap

      // Adjustable range is the cap minus the base
      adjustableRange = cap - breedBase;

      console.log(`[DEBUG] calcAbilityIPAdjustableRange: Level ${level}, TL${tl}, ability ${abilityStatId}, breed ${breed}, costFactor ${costFactor}, cap(${cap}) - base(${breedBase}) = ${adjustableRange}`);
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
export function calcHP(bodyDev: number, level: number, breed: number, profession: number, stamina: number = 0, maxHealthBonus: number = 0): number {
  const professionHPPerLevel = PROFESSION_VITALS.hp_per_level[profession];
  if (!professionHPPerLevel) {
    console.warn(`Unknown profession ID: ${profession}`);
    return 0;
  }

  const breedBaseHP = BREED_ABILITY_DATA.base_hp[breed] || 0;
  const breedBodyFactor = BREED_ABILITY_DATA.body_factor[breed] || 1;

  // Calculate cumulative HP from levels across title level ranges
  // This correctly sums HP for each level range with its appropriate title level multiplier
  let cumulativeHP = 0;
  let currentLevel = 1;

  for (let tl = 0; tl < 6; tl++) {
    const tlStart = TITLE_LEVELS[tl];
    const tlEnd = tl < 5 ? TITLE_LEVELS[tl + 1] - 1 : 220;
    const hpForTL = professionHPPerLevel[tl];

    if (level < tlStart) break;

    const endLevel = Math.min(level, tlEnd);
    const levelsInRange = endLevel - currentLevel + 1;
    cumulativeHP += levelsInRange * hpForTL;

    currentLevel = endLevel + 1;
    if (currentLevel > level) break;
  }

  // Calculate using accurate AO formula:
  // HP = base_hp + cumulative_hp + (body_dev * breed_factor) + floor(stamina / 4) + max_health_bonus
  const staminaBonus = Math.floor(stamina / 4);
  return breedBaseHP + cumulativeHP + (bodyDev * breedBodyFactor) + staminaBonus + maxHealthBonus;
}

/**
 * Calculate maximum nano pool
 * Uses cumulative nano calculation through title levels
 */
export function calcNP(nanoPool: number, level: number, breed: number, profession: number): number {
  const professionNPPerLevel = PROFESSION_VITALS.np_per_level[profession];
  if (!professionNPPerLevel) {
    console.warn(`Unknown profession ID: ${profession}`);
    return 0;
  }

  const breedBaseNP = BREED_ABILITY_DATA.base_np[breed] || 0;
  const breedNanoFactor = BREED_ABILITY_DATA.nano_factor[breed] || 1;
  const breedNPModifier = BREED_ABILITY_DATA.np_modifier[breed] || 0;

  // Calculate cumulative nano from levels
  let cumulativeNano = 0;

  // Title level ranges with their end levels
  const tlRanges = [
    { start: 1, end: 14, tlIndex: 0 },    // TL1
    { start: 15, end: 49, tlIndex: 1 },   // TL2
    { start: 50, end: 99, tlIndex: 2 },   // TL3
    { start: 100, end: 149, tlIndex: 3 }, // TL4
    { start: 150, end: 189, tlIndex: 4 }, // TL5
    { start: 190, end: 204, tlIndex: 5 }, // TL6
    { start: 205, end: 220, tlIndex: 6 }  // TL7
  ];

  // Accumulate nano through each title level range
  for (const range of tlRanges) {
    if (level < range.start) break;

    const levelsInRange = Math.min(level, range.end) - range.start + 1;
    const nanoPerLevel = professionNPPerLevel[range.tlIndex] + breedNPModifier;
    cumulativeNano += levelsInRange * nanoPerLevel;
  }

  return breedBaseNP + (nanoPool * breedNanoFactor) + cumulativeNano;
}

/**
 * Calculate ability-dependent cap for skill improvements based on weighted ability values
 * Returns the maximum number of IP improvements that can be made to a skill
 * Based on AOSkills4 calcAbilityCap function
 */
export function calcAbilityCapImprovements(abilities: number[], skillId: number): number {
  const trickleFactors = SKILL_TRICKLE_DOWN[skillId];
  if (!trickleFactors) {
    return 999; // No ability dependency for skills without trickle-down
  }

  // Calculate weighted ability value using the same trickle-down factors
  let weightedAbility = 0;
  for (let i = 0; i < 6; i++) {
    weightedAbility += abilities[i] * trickleFactors[i];
  }

  // AOSkills4 formula: round(((weightedAbility - 5) * 2) + 5)
  // This returns the maximum number of improvements that can be made via IP
  const result = roundAO(((weightedAbility - 5) * 2) + 5);

  // Debug logging for Body Dev
  if (skillId === 152) {
    console.log(`[DEBUG] calcAbilityCapImprovements for Body Dev (${skillId}):
      Abilities: [${abilities.join(', ')}]
      Trickle factors: [${trickleFactors.join(', ')}]
      Weighted ability: ${weightedAbility}
      Ability cap improvements: ${result}`);
  }

  return result;
}

/**
 * Calculate skill cap for a character taking both level-based and ability-based limits into account
 */
export function calcSkillCap(level: number, profession: number, skillId: number, abilities: number[]): number {
  const baseValue = BASE_SKILL;
  const trickleDown = calcTrickleDown(abilities, skillId);

  // Level-based cap: how many improvements are allowed by level/profession
  const levelBasedImprovements = calcIPAdjustableRange(level, profession, skillId);

  // Ability-based cap: how many improvements are allowed by abilities
  const abilityBasedImprovements = calcAbilityCapImprovements(abilities, skillId);

  // The actual cap is the minimum of both limits
  const maxImprovements = Math.min(levelBasedImprovements, abilityBasedImprovements);

  const totalCap = baseValue + trickleDown + maxImprovements;

  // Debug logging for Body Dev (skill ID 152)
  if (skillId === 152) {
    console.log(`[DEBUG] calcSkillCap for Body Dev (${skillId}):
      Level: ${level}, Profession: ${profession}
      Base: ${baseValue}
      Trickle-down: ${trickleDown}
      Level-based improvements: ${levelBasedImprovements}
      Ability-based improvements: ${abilityBasedImprovements}
      Max improvements (min of both): ${maxImprovements}
      Total cap: ${totalCap}`);
  }

  return totalCap;
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
  
  // Calculate skill costs using proper STAT IDs
  for (const [statIdStr, skillValue] of Object.entries(stats.skills)) {
    const statId = parseInt(statIdStr);
    skillIP += calcTotalSkillCost(skillValue, stats.profession, statId);
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
  
  // Check skill caps using proper STAT IDs
  for (const [statIdStr, skillValue] of Object.entries(stats.skills)) {
    const statId = parseInt(statIdStr);
    const skillCap = calcSkillCap(stats.level, stats.profession, statId, stats.abilities);
    if (skillValue > skillCap) {
      const skillName = STAT[statId as keyof typeof STAT] || `Skill ${statId}`;
      errors.push(`${skillName} exceeds cap of ${skillCap} (current: ${skillValue})`);
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
  const abilityIndex = STAT_ID_TO_ABILITY_INDEX[abilityStatId];
  if (abilityIndex === undefined || breed < 0) {
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
  const abilityIndex = STAT_ID_TO_ABILITY_INDEX[abilityStatId];
  if (abilityIndex === undefined || breed < 0) {
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
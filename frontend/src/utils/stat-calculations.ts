/**
 * TinkerTools Stat Calculations Utility
 * 
 * Complex stat mathematics, modifiers, and calculations used throughout TinkerTools.
 * Handles level-based calculations, IP distributions, skill caps, and stat modifications.
 */

import { STAT, BREED, PROFESSION } from '../services/game-data';
import { getStatName, getProfessionName, getBreedName } from '../services/game-utils';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface StatModifier {
  stat: number;
  value: number;
  type: 'flat' | 'percentage' | 'multiplier';
  source?: string;
}

export interface Character {
  level: number;
  profession: number;
  breed: number;
  baseStats?: Record<number, number>;
  appliedModifiers?: StatModifier[];
}

export interface SkillCap {
  stat: number;
  cap: number;
  hardCap?: number;
}

export interface IPCalculation {
  totalIP: number;
  usedIP: number;
  remainingIP: number;
  skillCosts: Record<number, number>;
}

// ============================================================================
// Core Stat Calculations
// ============================================================================

/**
 * Calculate base stats for a character at level 1
 */
export function getBaseStatsForBreed(breedId: number): Record<number, number> {
  const baseStats: Record<number, number> = {};
  
  // Stat IDs for the 6 main attributes
  const STRENGTH = 16;
  const AGILITY = 17; 
  const STAMINA = 18;
  const INTELLIGENCE = 19;
  const SENSE = 20;
  const PSYCHIC = 21;

  switch (breedId) {
    case 1: // Solitus
      baseStats[STRENGTH] = 15;
      baseStats[AGILITY] = 15;
      baseStats[STAMINA] = 15;
      baseStats[INTELLIGENCE] = 15;
      baseStats[SENSE] = 15;
      baseStats[PSYCHIC] = 15;
      break;
      
    case 2: // Opifex
      baseStats[STRENGTH] = 8;
      baseStats[AGILITY] = 23;
      baseStats[STAMINA] = 10;
      baseStats[INTELLIGENCE] = 18;
      baseStats[SENSE] = 18;
      baseStats[PSYCHIC] = 13;
      break;
      
    case 3: // Nanomage
      baseStats[STRENGTH] = 6;
      baseStats[AGILITY] = 10;
      baseStats[STAMINA] = 6;
      baseStats[INTELLIGENCE] = 25;
      baseStats[SENSE] = 13;
      baseStats[PSYCHIC] = 30;
      break;
      
    case 4: // Atrox
      baseStats[STRENGTH] = 25;
      baseStats[AGILITY] = 10;
      baseStats[STAMINA] = 25;
      baseStats[INTELLIGENCE] = 6;
      baseStats[SENSE] = 13;
      baseStats[PSYCHIC] = 11;
      break;
      
    default:
      // Default to Solitus if unknown breed
      baseStats[STRENGTH] = 15;
      baseStats[AGILITY] = 15;
      baseStats[STAMINA] = 15;
      baseStats[INTELLIGENCE] = 15;
      baseStats[SENSE] = 15;
      baseStats[PSYCHIC] = 15;
  }

  return baseStats;
}

/**
 * Calculate total IP available at a given level
 */
export function calculateTotalIP(level: number): number {
  if (level <= 1) return 0;
  
  // IP formula: sum from level 2 to current level
  // Each level gives: level * 10 - 5 IP
  let totalIP = 0;
  for (let l = 2; l <= level; l++) {
    totalIP += l * 10 - 5;
  }
  
  return totalIP;
}

/**
 * Calculate IP cost to raise a skill from current value to target value
 */
export function calculateIPCost(currentValue: number, targetValue: number): number {
  if (targetValue <= currentValue) return 0;
  
  let cost = 0;
  for (let value = currentValue + 1; value <= targetValue; value++) {
    cost += value;
  }
  
  return cost;
}

/**
 * Calculate the maximum skill value achievable with available IP
 */
export function calculateMaxSkillWithIP(currentValue: number, availableIP: number): number {
  let maxValue = currentValue;
  let remainingIP = availableIP;
  
  while (remainingIP >= (maxValue + 1)) {
    maxValue++;
    remainingIP -= maxValue;
  }
  
  return maxValue;
}

/**
 * Calculate skill caps for a profession at a given level
 */
export function calculateSkillCaps(professionId: number, level: number): Record<number, SkillCap> {
  const caps: Record<number, SkillCap> = {};
  
  // Base formula: (level * 6) for most skills
  const baseCap = level * 6;
  
  // Get profession-specific multipliers
  const multipliers = getProfessionSkillMultipliers(professionId);
  
  // Apply multipliers to calculate caps
  for (const [statId, multiplier] of Object.entries(multipliers)) {
    const statIdNum = Number(statId);
    const cap = Math.floor(baseCap * multiplier);
    
    caps[statIdNum] = {
      stat: statIdNum,
      cap: cap,
      hardCap: cap * 1.5 // Hard cap is typically 1.5x soft cap
    };
  }
  
  return caps;
}

/**
 * Get profession-specific skill multipliers
 */
export function getProfessionSkillMultipliers(professionId: number): Record<number, number> {
  // Default multipliers (most skills cap at 1.0x for non-profession skills)
  const baseMultipliers: Record<number, number> = {};
  
  // Initialize common skills with base multipliers
  const commonSkills = [
    100, 101, 102, 103, 104, 105, 106, 107, 108, // Combat skills
    123, 124, 125, 126, 127, 128, 129, 130, 131, // Support skills
    160, 161, 162, 163, 164, 165, 166, 167, 168  // Trade and misc skills
  ];
  
  commonSkills.forEach(skill => {
    baseMultipliers[skill] = 1.0;
  });

  // Profession-specific bonuses
  switch (professionId) {
    case 1: // Soldier
      baseMultipliers[102] = 2.5; // 1hBlunt
      baseMultipliers[103] = 2.5; // 1hEdged  
      baseMultipliers[105] = 2.5; // 2hEdged
      baseMultipliers[107] = 2.5; // 2hBlunt
      baseMultipliers[113] = 2.5; // Rifle
      baseMultipliers[115] = 2.5; // Shotgun
      baseMultipliers[116] = 2.5; // AssaultRifle
      baseMultipliers[123] = 2.0; // FirstAid
      break;
      
    case 2: // MartialArtist
      baseMultipliers[100] = 2.5; // MartialArts
      baseMultipliers[142] = 2.5; // Brawl
      baseMultipliers[144] = 2.0; // Dimach
      baseMultipliers[143] = 2.0; // Riposte
      baseMultipliers[111] = 2.0; // Bow
      break;
      
    case 3: // Engineer
      baseMultipliers[125] = 2.5; // MechanicalEngineering
      baseMultipliers[126] = 2.5; // ElectricalEngineering
      baseMultipliers[158] = 2.0; // WeaponSmithing
      baseMultipliers[161] = 2.0; // ComputerLiteracy
      break;
      
    case 4: // Fixer
      baseMultipliers[165] = 2.5; // BreakingEntry
      baseMultipliers[135] = 2.5; // TrapDisarm
      baseMultipliers[164] = 2.0; // Concealment
      baseMultipliers[156] = 2.0; // RunSpeed
      baseMultipliers[112] = 2.0; // Pistol
      break;
      
    case 5: // Agent
      baseMultipliers[112] = 2.5; // Pistol
      baseMultipliers[146] = 2.5; // SneakAttack
      baseMultipliers[147] = 2.0; // FastAttack
      baseMultipliers[164] = 2.0; // Concealment
      baseMultipliers[129] = 2.0; // PsychologicalModification
      break;
      
    case 6: // Adventurer
      baseMultipliers[123] = 2.5; // FirstAid
      baseMultipliers[137] = 2.5; // Adventuring
      baseMultipliers[140] = 2.0; // MapNavigation
      baseMultipliers[138] = 2.0; // Swimming
      break;
      
    case 7: // Trader
      baseMultipliers[159] = 2.5; // Pharmaceuticals
      baseMultipliers[163] = 2.5; // Chemistry
      baseMultipliers[161] = 2.0; // ComputerLiteracy
      baseMultipliers[162] = 2.0; // Psychology
      break;
      
    case 8: // Bureaucrat
      baseMultipliers[162] = 2.5; // Psychology
      baseMultipliers[129] = 2.5; // PsychologicalModification
      baseMultipliers[141] = 2.0; // Tutoring
      break;
      
    case 9: // Enforcer
      baseMultipliers[102] = 2.5; // 1hBlunt
      baseMultipliers[107] = 2.5; // 2hBlunt
      baseMultipliers[104] = 2.0; // MeleeEnergy
      baseMultipliers[106] = 2.0; // Piercing
      break;
      
    case 10: // Doctor
      baseMultipliers[123] = 2.5; // FirstAid
      baseMultipliers[124] = 2.5; // Treatment
      baseMultipliers[128] = 2.5; // BiologicalMetamorphose
      baseMultipliers[159] = 2.0; // Pharmaceuticals
      break;
      
    case 11: // NanoTechnician
      baseMultipliers[160] = 2.5; // NanoProgramming
      baseMultipliers[161] = 2.5; // ComputerLiteracy
      baseMultipliers[127] = 2.0; // MaterialMetamorphose
      baseMultipliers[130] = 2.0; // MaterialCreation
      break;
      
    case 12: // MetaPhysicist
      baseMultipliers[129] = 2.5; // PsychologicalModification
      baseMultipliers[131] = 2.5; // SpaceTime
      baseMultipliers[157] = 2.0; // QuantumFT
      break;
      
    case 14: // Keeper
      baseMultipliers[123] = 2.0; // FirstAid
      baseMultipliers[124] = 2.0; // Treatment
      baseMultipliers[128] = 2.0; // BiologicalMetamorphose
      baseMultipliers[129] = 2.0; // PsychologicalModification
      break;
      
    case 15: // Shade
      baseMultipliers[106] = 2.5; // Piercing
      baseMultipliers[103] = 2.5; // 1hEdged
      baseMultipliers[146] = 2.0; // SneakAttack
      baseMultipliers[164] = 2.0; // Concealment
      break;
  }
  
  return baseMultipliers;
}

/**
 * Calculate effective skill value with bonuses and penalties
 */
export function calculateEffectiveSkill(
  baseValue: number,
  modifiers: StatModifier[] = [],
  skillCap?: number
): number {
  let effectiveValue = baseValue;
  
  // Apply flat modifiers first
  for (const modifier of modifiers) {
    if (modifier.type === 'flat') {
      effectiveValue += modifier.value;
    }
  }
  
  // Apply percentage modifiers
  for (const modifier of modifiers) {
    if (modifier.type === 'percentage') {
      effectiveValue = Math.floor(effectiveValue * (1 + modifier.value / 100));
    }
  }
  
  // Apply multiplier modifiers
  for (const modifier of modifiers) {
    if (modifier.type === 'multiplier') {
      effectiveValue = Math.floor(effectiveValue * modifier.value);
    }
  }
  
  // Apply skill cap if provided
  if (skillCap !== undefined) {
    effectiveValue = Math.min(effectiveValue, skillCap);
  }
  
  // Skills cannot go below 1
  return Math.max(1, effectiveValue);
}

/**
 * Calculate health and nano points based on stats
 */
export function calculateHealthAndNano(character: Character): { health: number; nano: number } {
  const baseStats = character.baseStats || {};
  const level = character.level;
  
  // Health calculation: base + (Stamina * multiplier) + level bonus
  const stamina = baseStats[18] || 15; // Default to 15 if not set
  const health = Math.floor(10 + (stamina * 1.5) + (level * 10));
  
  // Nano calculation: base + (Intelligence + Psychic) * multiplier + level bonus
  const intelligence = baseStats[19] || 15;
  const psychic = baseStats[21] || 15;
  const nano = Math.floor(10 + ((intelligence + psychic) * 1.2) + (level * 8));
  
  return { health, nano };
}

/**
 * Calculate defense values (ACs) based on stats and equipment
 */
export function calculateDefenseValues(
  character: Character,
  equipmentBonuses: Record<number, number> = {}
): Record<string, number> {
  const defenses: Record<string, number> = {};
  
  // AC calculations are typically: base + equipment + skill bonuses
  const acStats = [90, 91, 92, 93, 94, 95, 96, 97]; // ProjectileAC through FireAC
  
  acStats.forEach(statId => {
    const baseStat = character.baseStats?.[statId] || 0;
    const equipmentBonus = equipmentBonuses[statId] || 0;
    const statName = getStatName(statId) || `Stat${statId}`;
    
    defenses[statName] = baseStat + equipmentBonus;
  });
  
  return defenses;
}

/**
 * Calculate initiative values
 */
export function calculateInitiatives(character: Character): Record<string, number> {
  const initiatives: Record<string, number> = {};
  const baseStats = character.baseStats || {};
  
  // Initiative calculations
  const agility = baseStats[17] || 15;
  const sense = baseStats[20] || 15;
  const intelligence = baseStats[19] || 15;
  
  // Melee Initiative: (Agility + Sense) / 5
  initiatives['MeleeInit'] = Math.floor((agility + sense) / 5);
  
  // Ranged Initiative: (Agility + Sense) / 5  
  initiatives['RangedInit'] = Math.floor((agility + sense) / 5);
  
  // Physical Initiative: (Agility + Sense) / 5
  initiatives['PhysicalInit'] = Math.floor((agility + sense) / 5);
  
  // Nano Initiative: (Intelligence + Psychic) / 5
  const psychic = baseStats[21] || 15;
  initiatives['NanoInit'] = Math.floor((intelligence + psychic) / 5);
  
  return initiatives;
}

/**
 * Validate if a character meets requirements for an item/nano
 */
export function validateRequirements(
  character: Character,
  requirements: Array<{ stat: number; value: number; operator?: string }>
): { valid: boolean; failures: Array<{ stat: number; required: number; current: number }> } {
  const failures: Array<{ stat: number; required: number; current: number }> = [];
  const stats = character.baseStats || {};
  
  for (const req of requirements) {
    const currentValue = stats[req.stat] || 0;
    const operator = req.operator || 'GreaterThan';
    
    let valid = false;
    switch (operator) {
      case 'GreaterThan':
        valid = currentValue >= req.value;
        break;
      case 'LessThan':
        valid = currentValue <= req.value;
        break;
      case 'Equal':
        valid = currentValue === req.value;
        break;
      default:
        valid = currentValue >= req.value;
    }
    
    if (!valid) {
      failures.push({
        stat: req.stat,
        required: req.value,
        current: currentValue
      });
    }
  }
  
  return {
    valid: failures.length === 0,
    failures
  };
}

/**
 * Calculate optimal IP distribution for a target build
 */
export function optimizeIPDistribution(
  character: Character,
  targetStats: Record<number, number>,
  availableIP: number
): { distribution: Record<number, number>; usedIP: number; achievable: boolean } {
  const currentStats = character.baseStats || {};
  const distribution: Record<number, number> = {};
  let usedIP = 0;
  
  // Sort target stats by priority (lower values first for efficiency)
  const sortedTargets = Object.entries(targetStats)
    .map(([stat, target]) => ({
      stat: Number(stat),
      target,
      current: currentStats[Number(stat)] || 0
    }))
    .filter(item => item.target > item.current)
    .sort((a, b) => a.target - a.current);
  
  for (const { stat, target, current } of sortedTargets) {
    const cost = calculateIPCost(current, target);
    
    if (usedIP + cost <= availableIP) {
      distribution[stat] = target;
      usedIP += cost;
    } else {
      // Calculate maximum achievable with remaining IP
      const maxAchievable = calculateMaxSkillWithIP(current, availableIP - usedIP);
      if (maxAchievable > current) {
        distribution[stat] = maxAchievable;
        usedIP += calculateIPCost(current, maxAchievable);
      }
      break;
    }
  }
  
  return {
    distribution,
    usedIP,
    achievable: Object.keys(distribution).length === sortedTargets.length
  };
}

// ============================================================================
// Export utilities as a group
// ============================================================================

export const statCalculations = {
  getBaseStatsForBreed,
  calculateTotalIP,
  calculateIPCost,
  calculateMaxSkillWithIP,
  calculateSkillCaps,
  getProfessionSkillMultipliers,
  calculateEffectiveSkill,
  calculateHealthAndNano,
  calculateDefenseValues,
  calculateInitiatives,
  validateRequirements,
  optimizeIPDistribution
};
/**
 * TinkerFite Weapon Analysis Type Definitions
 *
 * Phase 2: Core Infrastructure
 * Defines all TypeScript interfaces for weapon analysis and DPS calculations
 */

import type { Item } from './api';

// ============================================================================
// Input State Types
// ============================================================================

/**
 * Character stats for weapon analysis
 */
export interface CharacterStats {
  breed: number; // 1-4 (Solitus, Opifex, Nanomage, Atrox)
  level: number; // 1-220
  profession: number; // 0-15
  side: number; // 0=Neutral, 1=Clan, 2=Omni
  crit: number; // Critical Increase (stat 379)
  targetAC: number; // Target's armor class
  aggdef: number; // Agg/def slider: -100 to +100, default 75
}

/**
 * Initiative types for weapon calculations
 */
export interface Initiative {
  meleeInit: number; // Skill 118
  physicalInit: number; // Skill 120
  rangedInit: number; // Skill 119
}

/**
 * Combat bonuses affecting weapon damage
 */
export interface CombatBonuses {
  aao: number; // Add All Offense (skill 276)
  addDamage: number; // Computed from damage modifiers (stats 278-282, 311, 315-317)
  wrangle: number; // Weapon skill bonus for requirements check
}

/**
 * Complete input state for TinkerFite
 * Includes all 17 weapon skills, 8 special attacks, and combat stats
 */
export interface FiteInputState {
  characterStats: CharacterStats;
  weaponSkills: Record<number, number>; // 17 weapon skills (100-116, 133-134)
  specialAttacks: Record<number, number>; // 8 special attack skills
  initiative: Initiative;
  combatBonuses: CombatBonuses;
}

// ============================================================================
// Weapon Candidate Types
// ============================================================================

/**
 * Extended Item with computed weapon analysis fields
 * Includes DPS calculations, equipability status, and interpolation data
 */
export interface WeaponCandidate extends Item {
  // Equipability
  equipable: boolean;
  interpolatedQL?: number;

  // Base weapon stats (extracted from stats array)
  minDamage?: number;
  maxDamage?: number;
  critDamage?: number;
  attackTime?: number; // centiseconds
  rechargeTime?: number; // centiseconds
  clipSize?: number;
  damageType?: number;

  // Computed DPS values
  dps?: number;
  minDPS?: number;
  avgDPS?: number;
  maxDPS?: number;

  // Special attacks available for this weapon
  specialAttacks?: string[];

  // Attack rating stats
  arBonus?: number;
  effectiveAR?: number;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Weapon skill with value for API request
 */
export interface WeaponSkillRequest {
  skill_id: number;
  value: number;
}

/**
 * Request body for POST /api/v1/weapons/analyze
 * Backend filters weapons based on character and top 3 weapon skills
 */
export interface WeaponAnalyzeRequest {
  level: number;
  breed_id: number;
  profession_id: number;
  side: number;
  top_weapon_skills: WeaponSkillRequest[];
}

// ============================================================================
// Weapon Stat Constants
// ============================================================================

/**
 * Weapon stat IDs from database
 */
export const WEAPON_STAT_IDS = {
  MIN_DAMAGE: 286,
  MAX_DAMAGE: 285,
  CRITICAL_BONUS: 284,
  ATTACK_DELAY: 294, // centiseconds
  RECHARGE_DELAY: 210, // centiseconds
  DAMAGE_TYPE: 436,
  CLIP_SIZE: 212,
  AMMO_TYPE: 420,
  BURST_RECHARGE: 374,
  FULL_AUTO_RECHARGE: 375,
  INITIATIVE_TYPE: 440,
  AR_CAP: 538, // Max Beneficial Skill (attack rating cap)
  CAN_FLAGS: 30, // CAN flag bit flags for special attacks
} as const;

/**
 * Weapon skill IDs (17 total)
 */
export const WEAPON_SKILL_IDS = {
  MARTIAL_ARTS: 100,
  MULTI_MELEE: 101,
  ONE_H_BLUNT: 102,
  ONE_H_EDGED: 103,
  MELEE_ENERGY: 104,
  TWO_H_EDGED: 105,
  PIERCING: 106,
  TWO_H_BLUNT: 107,
  SHARP_OBJECTS: 108, // Thrown
  GRENADE: 109,
  HEAVY_WEAPONS: 110,
  BOW: 111,
  PISTOL: 112,
  RIFLE: 113,
  MG_SMG: 114,
  SHOTGUN: 115,
  ASSAULT_RIFLE: 116,
  RANGED_ENERGY: 133,
  MULTI_RANGED: 134,
} as const;

/**
 * Special attack skill IDs (8 used in TinkerFite)
 */
export const SPECIAL_ATTACK_IDS = {
  BRAWL: 142,
  DIMACH: 144,
  SNEAK_ATTACK: 146,
  FAST_ATTACK: 147,
  BURST: 148,
  FLING_SHOT: 150,
  AIMED_SHOT: 151,
  FULL_AUTO: 167,
} as const;

/**
 * Initiative skill IDs (3 types)
 */
export const INITIATIVE_IDS = {
  MELEE_INIT: 118,
  RANGED_INIT: 119,
  PHYSICAL_INIT: 120,
} as const;

/**
 * Damage modifier stat IDs (9 types)
 */
export const DAMAGE_MODIFIER_IDS = {
  PROJECTILE: 278,
  MELEE: 279,
  ENERGY: 280,
  CHEMICAL: 281,
  RADIATION: 282,
  COLD: 311,
  NANO: 315,
  FIRE: 316,
  POISON: 317,
} as const;

/**
 * Damage types (matches database enum)
 */
export const DAMAGE_TYPES = {
  NONE: 0,
  MELEE: 1,
  ENERGY: 2,
  CHEMICAL: 3,
  RADIATION: 4,
  COLD: 5,
  POISON: 6,
  FIRE: 7,
  PROJECTILE: 8,
} as const;

// ============================================================================
// Calculation Constants
// ============================================================================

/**
 * Constants used in DPS calculations (from legacy code)
 */
export const CALCULATION_CONSTANTS = {
  SAMPLE_LENGTH: 60, // DPS sample in seconds
  MIN_ATTACK_TIME: 100, // 1 second minimum (centiseconds)
  MIN_RECHARGE_TIME: 100, // 1 second minimum (centiseconds)
  DEFAULT_AGGDEF: 75, // Default aggdef slider value

  // Special attack damage caps
  AIMED_SHOT_CAP: 13000,
  SNEAK_ATTACK_CAP: 13000,

  // Full Auto tiered caps
  FA_TIER_1: 10000,
  FA_TIER_2: 11500,
  FA_TIER_3: 13000,
  FA_TIER_4: 14500,
  FA_MAX: 15000,
} as const;

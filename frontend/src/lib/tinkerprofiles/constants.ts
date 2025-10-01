/**
 * TinkerProfiles Library Constants
 * 
 * Game data constants and default values for Anarchy Online profiles
 */

import type { TinkerProfile, NanoCompatibleProfile, SkillData } from './types';
import type { PerkSystem } from './perk-types';
import { getBreedInitValue, calcHP, calcNP } from './ip-calculator';
import { getBreedId, normalizeBreedToId, normalizeProfessionToId } from '../../services/game-utils';
import { skillService } from '../../services/skill-service';

// Import BASE_SKILL constant from ip-calculator
const BASE_SKILL = 5; // Base skill value that all characters start with

// ============================================================================
// Game Constants
// ============================================================================

export const ANARCHY_PROFESSIONS = [
  'Adventurer',
  'Agent', 
  'Bureaucrat',
  'Doctor',
  'Enforcer',
  'Engineer',
  'Fixer',
  'Keeper',
  'Martial Artist',
  'Meta-Physicist',
  'Nanotechnician',
  'Soldier',
  'Trader',
  'Shade'
] as const;

export const ANARCHY_BREEDS = [
  'Solitus',
  'Opifex', 
  'Nanomage',
  'Atrox'
] as const;

export const ANARCHY_FACTIONS = [
  'Omni-Tek',
  'Clan',
  'Neutral'
] as const;

export const ANARCHY_EXPANSIONS = [
  'Classic',
  'Notum Wars',
  'Shadowlands', 
  'Alien Invasion',
  'Lost Eden'
] as const;

export const ACCOUNT_TYPES = [
  'Froob',
  'Paid',
  'Sloob'
] as const;

// ============================================================================
// Default Skills Structure
// ============================================================================


// Keep the old DEFAULT_SKILLS for backward compatibility (uses Solitus breed)
// Note: This is a legacy constant that may be removed in future versions
// New code should use createDefaultSkillsV4() instead
export const DEFAULT_SKILLS = {
  Attributes: {
    Strength: { value: 15, ipSpent: 0, pointFromIp: 0, cap: undefined },
    Agility: { value: 15, ipSpent: 0, pointFromIp: 0, cap: undefined },
    Stamina: { value: 15, ipSpent: 0, pointFromIp: 0, cap: undefined },
    Intelligence: { value: 15, ipSpent: 0, pointFromIp: 0, cap: undefined },
    Sense: { value: 15, ipSpent: 0, pointFromIp: 0, cap: undefined },
    Psychic: { value: 15, ipSpent: 0, pointFromIp: 0, cap: undefined }
  },
  'Body & Defense': {
    'Nano Pool': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Nano Resist': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Body Dev.': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Dodge-Rng': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Duck-Exp': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Evade-ClsC': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Deflect': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined }
  },
  ACs: {
    'Imp/Proj AC': 1,
    'Energy AC': 1,
    'Melee/ma AC': 1,
    'Fire AC': 1,
    'Cold AC': 1,
    'Chemical AC': 1,
    'Radiation AC': 1,
    'Disease AC': 1
  },
  'Ranged Weapons': {
    'Pistol': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Ranged Init': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Grenade': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Heavy Weapons': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Bow': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Rifle': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'MG/SMG': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Shotgun': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Assault Rif': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Multi Ranged': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined }
  },
  'Ranged Specials': {
    'Fling Shot': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Sharp Obj': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Bow Spc Att': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Burst': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Full Auto': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Aimed Shot': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined }
  },
  'Melee Weapons': {
    'Piercing': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Melee Init': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Physical Init': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    '1h Blunt': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    '1h Edged': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Melee Energy': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    '2h Edged': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    '2h Blunt': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Martial Arts': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Multi Melee': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined }
  },
  'Melee Specials': {
    'Riposte': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Dimach': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Sneak Attack': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Fast Attack': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Brawling': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined }
  },
  'Nanos & Casting': {
    'Matter Creation': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'NanoC Init': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Psycho Modi': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Sensory Improvement': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Time & Space': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Bio Metamor': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Matt Metam': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined }
  },
  Exploring: {
    'Vehicle Air': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Vehicle Ground': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Vehicle Water': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Adventuring': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Run Speed': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined }
  },
  'Trade & Repair': {
    'Chemistry': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Computer Literacy': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Elec Eng': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Mech Eng': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Nano Programming': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Pharma Tech': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Quantum FT': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Tutoring': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Weapon Smith': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Break & Entry': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined }
  },
  'Combat & Healing': {
    'Concealment': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Perception': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Psychology': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Treatment': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'First Aid': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined },
    'Trap Disarm.': { value: BASE_SKILL, ipSpent: 0, pointFromIp: 0, cap: undefined }
  },
  Misc: {
    '% Add. Xp': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    '% Add. Nano Cost': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Max NCU': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Decreased Nano-Interrupt Modifier %': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'SkillLockModifier': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'HealDelta': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Add All Def.': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'NanoDelta': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'RangeInc. NF': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'RangeInc. Weapon': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'CriticalIncrease': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Free deck slot': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Healing Efficiency': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Add All Off.': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Add. Proj. Dam.': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Add. Melee Dam.': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Add. Energy Dam.': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Add. Chem. Dam.': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Add. Rad. Dam.': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Add. Cold Dam.': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Add. Fire Dam.': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Add. Poison Dam.': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'ShieldMeleeAC': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'ShieldProjectileAC': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'ShieldEnergyAC': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'ShieldFireAC': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'ShieldColdAC': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'ShieldChemicalAC': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'ShieldRadiationAC': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'ShieldPoisonAC': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Direct Nano Damage Efficiency': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Add. Nano Dam.': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 },
    'Scale': { baseValue: 0, equipmentBonus: 0, perkBonus: 0, buffBonus: 0, value: 0 }
  }
} as const;

// ============================================================================
// Default Equipment Slots
// ============================================================================

export const DEFAULT_WEAPONS = {
  HUD1: null,
  HUD2: null,
  HUD3: null,
  UTILS1: null,
  UTILS2: null,
  UTILS3: null,
  RHand: null,
  Waist: null,
  LHand: null,
  NCU1: null,
  NCU2: null,
  NCU3: null,
  NCU4: null,
  NCU5: null,
  NCU6: null
} as const;

export const DEFAULT_CLOTHING = {
  Head: null,
  Back: null,
  Body: null,
  RightArm: null,
  LeftArm: null,
  RightWrist: null,
  LeftWrist: null,
  Hands: null,
  Legs: null,
  Feet: null,
  RightShoulder: null,
  LeftShoulder: null,
  RightFinger: null,
  LeftFinger: null,
  Neck: null,
  Belt: null
} as const;

export const DEFAULT_IMPLANTS = {
  Head: null,
  Eye: null,
  Ear: null,
  Chest: null,
  RightArm: null,
  LeftArm: null,
  Waist: null,
  RightWrist: null,
  LeftWrist: null,
  Leg: null,
  RightHand: null,
  LeftHand: null,
  Feet: null
} as const;

// ============================================================================
// Storage Keys
// ============================================================================

export const STORAGE_KEYS = {
  PROFILES: 'tinkertools_profiles', // Legacy - for migration only
  PROFILE_INDEX: 'tinkertools_profile_index', // List of profile IDs
  PROFILE_PREFIX: 'tinkertools_profile_', // Individual profile prefix
  ACTIVE_PROFILE: 'tinkertools_active_profile',
  PROFILE_METADATA: 'tinkertools_profile_metadata',
  PROFILE_PREFERENCES: 'tinkertools_profile_preferences',
  VERSION: 'tinkertools_profiles_version'
} as const;

// ============================================================================
// Version and Migration
// ============================================================================

export const CURRENT_VERSION = '4.0.0';
export const SUPPORTED_VERSIONS = ['1.0.0', '1.1.0', '2.0.0'];

// ============================================================================
// Profile Factories
// ============================================================================

/**
 * Create a default empty PerkSystem for new profiles
 */
function createDefaultPerkSystem(level: number = 1, alienLevel: number = 0): PerkSystem {
  // Calculate available perk points based on level
  const standardPerkPoints = level >= 10 ? Math.min(Math.floor(level / 10), 20) + (level > 200 ? Math.min(level - 200, 20) : 0) : 0;
  const aiPerkPoints = Math.min(alienLevel, 30);

  return {
    perks: [],
    standardPerkPoints: {
      total: standardPerkPoints,
      spent: 0,
      available: standardPerkPoints
    },
    aiPerkPoints: {
      total: aiPerkPoints,
      spent: 0,
      available: aiPerkPoints
    },
    research: [],
    lastCalculated: new Date().toISOString()
  };
}

/**
 * Get breed ID from breed name
 */
function getBreedIdFromBreedName(breed: string): number {
  const breedMap: Record<string, number> = {
    'Solitus': 1,
    'Opifex': 2,
    'Nanomage': 3,
    'Atrox': 4
  };
  return breedMap[breed] || 1; // Default to Solitus
}

/**
 * Create default v4.0.0 skills map for a breed
 * Initializes all ~168 skills with appropriate base values
 */
export function createDefaultSkillsV4(breed: string): { [skillId: number]: SkillData } {
  const skills: { [skillId: number]: SkillData } = {};

  // Get all skill IDs from SkillService
  const allSkillIds = skillService.getAllSkills();

  // Get breed ID for breed-specific ability lookup
  const breedId = getBreedId(breed) || 1; // Default to Solitus

  for (const skillId of allSkillIds) {
    const category = skillService.getCategory(Number(skillId));

    let baseValue = 5; // Default for trainable skills

    if (category === 'Abilities') {
      // For abilities, use breed-specific values from ip-calculator
      baseValue = getBreedInitValue(breedId, Number(skillId));
    } else if (category === 'Misc' || category === 'ACs') {
      // Misc and ACs start at 0
      baseValue = 0;
    }

    skills[Number(skillId)] = {
      base: baseValue,
      trickle: 0,
      ipSpent: 0,
      pointsFromIp: 0,
      equipmentBonus: 0,
      perkBonus: 0,
      buffBonus: 0,
      total: baseValue
    };
  }

  return skills;
}

/**
 * Create a default comprehensive TinkerProfile
 */
export function createDefaultProfile(name: string = 'New Character', breed: string = 'Solitus'): TinkerProfile {
  const now = new Date().toISOString();

  // Calculate initial health and nano based on level 1 defaults
  const level = 1;
  const breedId = normalizeBreedToId(breed); // Updated: use normalization
  const professionId = 6; // Adventurer
  const bodyDev = BASE_SKILL; // 5
  const nanoPool = BASE_SKILL; // 5

  const initialHealth = calcHP(bodyDev, level, breedId, professionId);
  const initialNano = calcNP(nanoPool, level, breedId, professionId);

  return {
    id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    version: CURRENT_VERSION,
    created: now,
    updated: now,

    Character: {
      Name: name,
      Level: 1,
      Profession: professionId as any,  // Store as numeric ID
      Breed: breedId as any,            // Store as numeric ID
      Faction: 'Neutral',
      Expansion: 'Lost Eden',
      AccountType: 'Paid',
      MaxHealth: initialHealth,
      MaxNano: initialNano
    },

    skills: createDefaultSkillsV4(breed),

    Weapons: structuredClone(DEFAULT_WEAPONS),
    Clothing: structuredClone(DEFAULT_CLOTHING),
    Implants: structuredClone(DEFAULT_IMPLANTS),

    PerksAndResearch: createDefaultPerkSystem(level, 0)
  };
}

/**
 * Create a simplified nano-compatible profile
 */
export function createDefaultNanoProfile(name: string = 'New Character', breed: string = 'Solitus'): NanoCompatibleProfile {
  const breedId = getBreedId(breed) || 1;

  return {
    id: `nano_profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    profession: 'Adventurer',  // NanoCompatibleProfile uses string types
    level: 1,
    skills: {
      // Nano Schools
      'Biological Metamorphosis': BASE_SKILL,
      'Matter Creation': BASE_SKILL,
      'Matter Metamorphosis': BASE_SKILL,
      'Psychological Modifications': BASE_SKILL,
      'Sensory Improvement': BASE_SKILL,
      'Time and Space': BASE_SKILL,

      // Core Skills
      'Nano Programming': BASE_SKILL,
      'Computer Literacy': BASE_SKILL,
      'Tutoring': BASE_SKILL,
      'First Aid': BASE_SKILL,
      'Treatment': BASE_SKILL
    },
    stats: {
      'Strength': getBreedInitValue(breedId, 0),
      'Agility': getBreedInitValue(breedId, 1),
      'Stamina': getBreedInitValue(breedId, 2),
      'Intelligence': getBreedInitValue(breedId, 3),
      'Sense': getBreedInitValue(breedId, 4),
      'Psychic': getBreedInitValue(breedId, 5)
    },
    activeNanos: [],
    memoryCapacity: 500,
    nanoPoints: 1000
  };
}
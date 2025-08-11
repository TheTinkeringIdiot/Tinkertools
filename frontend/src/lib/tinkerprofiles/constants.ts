/**
 * TinkerProfiles Library Constants
 * 
 * Game data constants and default values for Anarchy Online profiles
 */

import type { TinkerProfile, NanoCompatibleProfile } from './types';

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

export const DEFAULT_SKILLS = {
  Attributes: {
    Intelligence: 10,
    Psychic: 10,
    Sense: 10,
    Stamina: 10,
    Strength: 10,
    Agility: 10
  },
  'Body & Defense': {
    'Max Nano': 1,
    'Nano Pool': 1,
    'Nano Resist': 1,
    'Max Health': 1,
    'Body Dev.': 1,
    'Dodge-Rng': 1,
    'Duck-Exp': 1,
    'Evade-ClsC': 1,
    'Deflect': 1
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
    'Pistol': 1,
    'Ranged. Init.': 1,
    'Grenade': 1,
    'Heavy Weapons': 1,
    'Bow': 1,
    'Rifle': 1,
    'MG / SMG': 1,
    'Shotgun': 1,
    'Assault Rif': 1,
    'Multi Ranged': 1
  },
  'Ranged Specials': {
    'Fling Shot': 1,
    'Sharp Obj': 1,
    'Bow Spc Att': 1,
    'Burst': 1,
    'Full Auto': 1,
    'Aimed Shot': 1
  },
  'Melee Weapons': {
    'Piercing': 1,
    'Melee. Init.': 1,
    'Physic. Init': 1,
    '1h Blunt': 1,
    '1h Edged': 1,
    'Melee Ener.': 1,
    '2h Edged': 1,
    '2h Blunt': 1,
    'Martial Arts': 1,
    'Mult. Melee': 1
  },
  'Melee Specials': {
    'Riposte': 1,
    'Dimach': 1,
    'Sneak Atck': 1,
    'Fast Attack': 1,
    'Brawling': 1
  },
  'Nanos & Casting': {
    'Matter Crea': 1,
    'NanoC. Init.': 1,
    'Psycho Modi': 1,
    'Sensory Impr': 1,
    'Time&Space': 1,
    'Bio Metamor': 1,
    'Matt. Metam': 1
  },
  Exploring: {
    'Vehicle Air': 1,
    'Vehicle Ground': 1,
    'Vehicle Water': 1,
    'Adventuring': 1,
    'Run Speed': 1
  },
  'Trade & Repair': {
    'Chemistry': 1,
    'Comp. Liter': 1,
    'Elec. Engi': 1,
    'Mech. Engi': 1,
    'Nano Progra': 1,
    'Pharma Tech': 1,
    'Quantum FT': 1,
    'Tutoring': 1,
    'Weapon Smt': 1,
    'Break&Entry': 1
  },
  'Combat & Healing': {
    'Concealment': 1,
    'Perception': 1,
    'Psychology': 1,
    'Treatment': 1,
    'First Aid': 1,
    'Trap Disarm.': 1
  },
  Misc: {
    '% Add. Xp': 0,
    '% Add. Nano Cost': 0,
    'Max NCU': 1,
    'Decreased Nano-Interrupt Modifier %': 0,
    'SkillLockModifier': 0,
    'HealDelta': 0,
    'Add All Def.': 0,
    'NanoDelta': 0,
    'RangeInc. NF': 0,
    'RangeInc. Weapon': 0,
    'CriticalIncrease': 0,
    'Free deck slot': 0,
    'Healing Efficiency': 0,
    'Add All Off.': 0,
    'Add. Proj. Dam.': 0,
    'Add. Melee Dam.': 0,
    'Add. Energy Dam.': 0,
    'Add. Chem. Dam.': 0,
    'Add. Rad. Dam.': 0,
    'Add. Cold Dam.': 0,
    'Add. Fire Dam.': 0,
    'Add. Poison Dam.': 0,
    'ShieldMeleeAC': 0,
    'ShieldProjectileAC': 0,
    'ShieldEnergyAC': 0,
    'ShieldFireAC': 0,
    'ShieldColdAC': 0,
    'ShieldChemicalAC': 0,
    'ShieldRadiationAC': 0,
    'ShieldPoisonAC': 0,
    'Direct Nano Damage Efficiency': 0,
    'Add. Nano Dam.': 0,
    'Scale': 1
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
  PROFILES: 'tinkertools_profiles',
  ACTIVE_PROFILE: 'tinkertools_active_profile',
  PROFILE_METADATA: 'tinkertools_profile_metadata',
  PROFILE_PREFERENCES: 'tinkertools_profile_preferences',
  PROFILE_BACKUPS: 'tinkertools_profile_backups',
  VERSION: 'tinkertools_profiles_version'
} as const;

// ============================================================================
// Version and Migration
// ============================================================================

export const CURRENT_VERSION = '2.0.0';
export const SUPPORTED_VERSIONS = ['1.0.0', '1.1.0', '2.0.0'];

// ============================================================================
// Profile Factories
// ============================================================================

/**
 * Create a default comprehensive TinkerProfile
 */
export function createDefaultProfile(name: string = 'New Character'): TinkerProfile {
  const now = new Date().toISOString();
  
  return {
    id: `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    version: CURRENT_VERSION,
    created: now,
    updated: now,
    
    Character: {
      Name: name,
      Level: 1,
      Profession: 'Adventurer',
      Breed: 'Solitus',
      Faction: 'Neutral',
      Expansion: 'Lost Eden',
      AccountType: 'Paid'
    },
    
    Skills: structuredClone(DEFAULT_SKILLS),
    
    Weapons: structuredClone(DEFAULT_WEAPONS),
    Clothing: structuredClone(DEFAULT_CLOTHING),
    Implants: structuredClone(DEFAULT_IMPLANTS),
    
    PerksAndResearch: []
  };
}

/**
 * Create a simplified nano-compatible profile
 */
export function createDefaultNanoProfile(name: string = 'New Character'): NanoCompatibleProfile {
  return {
    id: `nano_profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    profession: 'Adventurer',
    level: 1,
    skills: {
      // Nano Schools
      'Biological Metamorphosis': 1,
      'Matter Creation': 1,
      'Matter Metamorphosis': 1,
      'Psychological Modifications': 1,
      'Sensory Improvement': 1,
      'Time and Space': 1,
      
      // Core Skills
      'Nano Programming': 1,
      'Computer Literacy': 1,
      'Tutoring': 1,
      'First Aid': 1,
      'Treatment': 1
    },
    stats: {
      'Strength': 10,
      'Stamina': 10,
      'Agility': 10,
      'Sense': 10,
      'Intelligence': 10,
      'Psychic': 10
    },
    activeNanos: [],
    memoryCapacity: 500,
    nanoPoints: 1000
  };
}
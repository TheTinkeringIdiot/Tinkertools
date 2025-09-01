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
    Intelligence: { value: 10, ipSpent: 0, pointFromIp: 0 },
    Psychic: { value: 10, ipSpent: 0, pointFromIp: 0 },
    Sense: { value: 10, ipSpent: 0, pointFromIp: 0 },
    Stamina: { value: 10, ipSpent: 0, pointFromIp: 0 },
    Strength: { value: 10, ipSpent: 0, pointFromIp: 0 },
    Agility: { value: 10, ipSpent: 0, pointFromIp: 0 }
  },
  'Body & Defense': {
    'Nano Pool': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Nano Resist': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Body Dev.': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Dodge-Rng': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Duck-Exp': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Evade-ClsC': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Deflect': { value: 1, ipSpent: 0, pointFromIp: 0 }
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
    'Pistol': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Ranged. Init.': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Grenade': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Heavy Weapons': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Bow': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Rifle': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'MG / SMG': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Shotgun': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Assault Rif': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Multi Ranged': { value: 1, ipSpent: 0, pointFromIp: 0 }
  },
  'Ranged Specials': {
    'Fling Shot': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Sharp Obj': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Bow Spc Att': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Burst': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Full Auto': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Aimed Shot': { value: 1, ipSpent: 0, pointFromIp: 0 }
  },
  'Melee Weapons': {
    'Piercing': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Melee. Init.': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Physic. Init': { value: 1, ipSpent: 0, pointFromIp: 0 },
    '1h Blunt': { value: 1, ipSpent: 0, pointFromIp: 0 },
    '1h Edged': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Melee Ener.': { value: 1, ipSpent: 0, pointFromIp: 0 },
    '2h Edged': { value: 1, ipSpent: 0, pointFromIp: 0 },
    '2h Blunt': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Martial Arts': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Mult. Melee': { value: 1, ipSpent: 0, pointFromIp: 0 }
  },
  'Melee Specials': {
    'Riposte': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Dimach': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Sneak Atck': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Fast Attack': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Brawling': { value: 1, ipSpent: 0, pointFromIp: 0 }
  },
  'Nanos & Casting': {
    'Matter Crea': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'NanoC. Init.': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Psycho Modi': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Sensory Impr': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Time&Space': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Bio Metamor': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Matt. Metam': { value: 1, ipSpent: 0, pointFromIp: 0 }
  },
  Exploring: {
    'Vehicle Air': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Vehicle Ground': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Vehicle Water': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Adventuring': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Run Speed': { value: 1, ipSpent: 0, pointFromIp: 0 }
  },
  'Trade & Repair': {
    'Chemistry': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Comp. Liter': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Elec. Engi': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Mech. Engi': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Nano Progra': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Pharma Tech': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Quantum FT': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Tutoring': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Weapon Smt': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Break&Entry': { value: 1, ipSpent: 0, pointFromIp: 0 }
  },
  'Combat & Healing': {
    'Concealment': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Perception': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Psychology': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Treatment': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'First Aid': { value: 1, ipSpent: 0, pointFromIp: 0 },
    'Trap Disarm.': { value: 1, ipSpent: 0, pointFromIp: 0 }
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
      AccountType: 'Paid',
      MaxHealth: 1,
      MaxNano: 1
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
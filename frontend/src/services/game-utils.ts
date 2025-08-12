/**
 * TinkerTools Core Game Utility Functions
 * 
 * Core utility functions for common game data operations that all TinkerTools need.
 * These are lightweight helper functions for basic lookups and validations.
 */

import {
  STAT,
  REQUIREMENTS,
  PROFESSION,
  BREED,
  FACTION,
  GENDER,
  NANOSCHOOL,
  NANO_STRAIN,
  AMMOTYPE,
  ITEM_CLASS,
  TOWER_TYPE,
  TARGET,
  WEAPON_SLOT_POSITIONS,
  ARMOR_SLOT_POSITION,
  IMPLANT_SLOT_POSITION,
  type StatId,
  type StatName,
  type RequirementId,
  type RequirementName,
  type ProfessionId,
  type ProfessionName,
  type BreedId,
  type BreedName,
  type FactionId,
  type FactionName,
  type NanoSchoolId,
  type NanoSchoolName,
  type NanoStrainId,
  type NanoStrainName
} from './game-data';

// ============================================================================
// ID to Name Translation Functions
// ============================================================================

/**
 * Get human-readable stat name from ID
 */
export function getStatName(id: number): StatName | undefined {
  return STAT[id as StatId];
}

/**
 * Get human-readable requirement name from ID
 */
export function getRequirementName(id: number): RequirementName | undefined {
  return REQUIREMENTS[id as RequirementId];
}

/**
 * Get profession name from ID
 */
export function getProfessionName(id: number): ProfessionName | undefined {
  return PROFESSION[id as ProfessionId];
}

/**
 * Get breed name from ID
 */
export function getBreedName(id: number): BreedName | undefined {
  return BREED[id as BreedId];
}

/**
 * Get faction name from ID
 */
export function getFactionName(id: number): FactionName | undefined {
  return FACTION[id as FactionId];
}

/**
 * Get gender name from ID
 */
export function getGenderName(id: number): string | undefined {
  return GENDER[id as keyof typeof GENDER];
}

/**
 * Get nano school name from ID
 */
export function getNanoSchoolName(id: number): NanoSchoolName | undefined {
  return NANOSCHOOL[id as NanoSchoolId];
}

/**
 * Get nano strain name from ID
 */
export function getNanoStrainName(id: number): NanoStrainName | undefined {
  return NANO_STRAIN[id as NanoStrainId];
}

/**
 * Get ammo type name from ID
 */
export function getAmmoTypeName(id: number): string | undefined {
  return AMMOTYPE[id as keyof typeof AMMOTYPE];
}

/**
 * Get item class name from ID
 */
export function getItemClassName(id: number): string | undefined {
  return ITEM_CLASS[id as keyof typeof ITEM_CLASS];
}

/**
 * Get tower type name from ID
 */
export function getTowerTypeName(id: number): string | undefined {
  return TOWER_TYPE[id as keyof typeof TOWER_TYPE];
}

/**
 * Get target type name from ID
 */
export function getTargetName(id: number): string | undefined {
  return TARGET[id as keyof typeof TARGET];
}

/**
 * Get weapon slot name from ID
 */
export function getWeaponSlotName(id: number): string | undefined {
  return WEAPON_SLOT_POSITIONS[id as keyof typeof WEAPON_SLOT_POSITIONS];
}

/**
 * Get armor slot name from ID
 */
export function getArmorSlotName(id: number): string | undefined {
  return ARMOR_SLOT_POSITION[id as keyof typeof ARMOR_SLOT_POSITION];
}

/**
 * Get implant slot name from ID
 */
export function getImplantSlotName(id: number): string | undefined {
  return IMPLANT_SLOT_POSITION[id as keyof typeof IMPLANT_SLOT_POSITION];
}

// ============================================================================
// Name to ID Translation Functions
// ============================================================================

/**
 * Get stat ID from human-readable name
 */
export function getStatId(name: string): number | undefined {
  for (const [id, statName] of Object.entries(STAT)) {
    if (statName === name) {
      return Number(id);
    }
  }
  return undefined;
}

/**
 * Get profession ID from name
 */
export function getProfessionId(name: string): number | undefined {
  for (const [id, professionName] of Object.entries(PROFESSION)) {
    if (professionName === name) {
      return Number(id);
    }
  }
  return undefined;
}

/**
 * Get breed ID from name
 */
export function getBreedId(name: string): number | undefined {
  for (const [id, breedName] of Object.entries(BREED)) {
    if (breedName === name) {
      return Number(id);
    }
  }
  return undefined;
}

/**
 * Get faction ID from name
 */
export function getFactionId(name: string): number | undefined {
  for (const [id, factionName] of Object.entries(FACTION)) {
    if (factionName === name) {
      return Number(id);
    }
  }
  return undefined;
}

/**
 * Get nano school ID from name
 */
export function getNanoSchoolId(name: string): number | undefined {
  for (const [id, schoolName] of Object.entries(NANOSCHOOL)) {
    if (schoolName === name) {
      return Number(id);
    }
  }
  return undefined;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if a profession ID is valid
 */
export function isValidProfession(id: number): boolean {
  return id in PROFESSION;
}

/**
 * Check if a breed ID is valid
 */
export function isValidBreed(id: number): boolean {
  return id in BREED;
}

/**
 * Check if a faction ID is valid
 */
export function isValidFaction(id: number): boolean {
  return id in FACTION;
}

/**
 * Check if a stat ID is valid
 */
export function isValidStat(id: number): boolean {
  return id in STAT;
}

/**
 * Check if a nano school ID is valid
 */
export function isValidNanoSchool(id: number): boolean {
  return id in NANOSCHOOL;
}

/**
 * Check if a gender ID is valid
 */
export function isValidGender(id: number): boolean {
  return id in GENDER;
}

/**
 * Check if an item class ID is valid
 */
export function isValidItemClass(id: number): boolean {
  return id in ITEM_CLASS;
}

/**
 * Check if a slot position is valid for weapons
 */
export function isValidWeaponSlot(id: number): boolean {
  return id in WEAPON_SLOT_POSITIONS;
}

/**
 * Check if a slot position is valid for armor
 */
export function isValidArmorSlot(id: number): boolean {
  return id in ARMOR_SLOT_POSITION;
}

/**
 * Check if a slot position is valid for implants
 */
export function isValidImplantSlot(id: number): boolean {
  return id in IMPLANT_SLOT_POSITION;
}

// ============================================================================
// Collection/Array Functions
// ============================================================================

/**
 * Get all valid profession IDs
 */
export function getAllProfessionIds(): number[] {
  return Object.keys(PROFESSION).map(Number).filter(id => id > 0);
}

/**
 * Get all valid breed IDs
 */
export function getAllBreedIds(): number[] {
  return Object.keys(BREED).map(Number).filter(id => id > 0);
}

/**
 * Get all valid faction IDs
 */
export function getAllFactionIds(): number[] {
  return Object.keys(FACTION).map(Number);
}

/**
 * Get all nano school IDs
 */
export function getAllNanoSchoolIds(): number[] {
  return Object.keys(NANOSCHOOL).map(Number);
}

/**
 * Get all stat IDs (excluding 0 = 'None')
 */
export function getAllStatIds(): number[] {
  return Object.keys(STAT).map(Number).filter(id => id > 0);
}

/**
 * Get all profession names
 */
export function getAllProfessionNames(): string[] {
  return Object.values(PROFESSION).filter(name => name !== 'Unknown' && name !== 'Monster');
}

/**
 * Get all breed names
 */
export function getAllBreedNames(): string[] {
  return Object.values(BREED).filter(name => name !== 'Unknown' && name !== 'HumanMonster');
}

/**
 * Get all faction names
 */
export function getAllFactionNames(): string[] {
  return Object.values(FACTION);
}

/**
 * Get all nano school names
 */
export function getAllNanoSchoolNames(): string[] {
  return Object.values(NANOSCHOOL);
}

// ============================================================================
// Special Purpose Functions
// ============================================================================

/**
 * Check if a stat should use interpolation
 */
export function statNeedsInterpolation(statId: number): boolean {
  // Import INTERP_STATS from game-data
  const { INTERP_STATS } = require('./game-data');
  return INTERP_STATS.includes(statId);
}

/**
 * Format a stat value for display
 */
export function formatStatValue(statId: number, value: number): string {
  const statName = getStatName(statId);
  if (!statName) return value.toString();

  // Special formatting for certain stats
  switch (statName) {
    case 'Credits':
      return value.toLocaleString();
    case 'XP':
    case 'IP':
      return value.toLocaleString();
    case 'Level':
      return `Level ${value}`;
    case 'Health':
    case 'MaxHealth':
      return `${value} HP`;
    case 'CurrentNano':
    case 'MaxNanoEnergy':
      return `${value} NP`;
    case 'MaxNCU':
      return `${value} NCU`;
    default:
      return value.toString();
  }
}

/**
 * Get display name for a character
 */
export function formatCharacterName(
  name: string,
  level?: number,
  profession?: number,
  breed?: number
): string {
  let displayName = name;
  
  if (level) {
    displayName += ` (${level})`;
  }
  
  const parts: string[] = [];
  if (breed && breed > 0) {
    const breedName = getBreedName(breed);
    if (breedName && breedName !== 'Unknown') {
      parts.push(breedName);
    }
  }
  
  if (profession && profession > 0) {
    const professionName = getProfessionName(profession);
    if (professionName && professionName !== 'Unknown' && professionName !== 'Monster') {
      parts.push(professionName);
    }
  }
  
  if (parts.length > 0) {
    displayName += ` - ${parts.join(' ')}`;
  }
  
  return displayName;
}

/**
 * Check if a profession can use a specific nano school effectively
 */
export function canProfessionUseNanoSchool(professionId: number, nanoSchoolId: number): boolean {
  const profession = getProfessionName(professionId);
  const school = getNanoSchoolName(nanoSchoolId);
  
  if (!profession || !school) return false;

  // Basic profession to nano school compatibility
  const compatibility: Record<string, string[]> = {
    'Doctor': ['Medical', 'Protection'],
    'NanoTechnician': ['Combat', 'Psi'],
    'MetaPhysicist': ['Psi', 'Space'],
    'Bureaucrat': ['Psi', 'Protection'],
    'Agent': ['Psi', 'Combat'],
    'Adventurer': ['Medical', 'Protection'],
    'Trader': ['Medical', 'Protection'],
    'Engineer': ['Protection', 'Combat'],
    'Fixer': ['Medical', 'Combat'],
    'Soldier': ['Combat', 'Protection'],
    'Enforcer': ['Combat', 'Protection'],
    'MartialArtist': ['Medical', 'Combat'],
    'Keeper': ['Medical', 'Protection', 'Psi'],
    'Shade': ['Combat', 'Psi']
  };

  const compatibleSchools = compatibility[profession] || [];
  return compatibleSchools.includes(school);
}

/**
 * Get common stat names used in requirements
 */
export function getCommonRequirementStats(): Array<{id: number; name: string}> {
  const commonStats = [
    16, 17, 18, 19, 20, 21, // Attributes
    54, 60, 4, 59, // Level, Profession, Breed, Gender
    100, 101, 102, 103, 104, 105, 106, 107, 108, // Combat skills
    123, 124, 125, 126, 127, 128, 129, 130, 131, // Support skills
    160, 161, 162, 163, // Trade skills
  ];

  return commonStats
    .map(id => ({ id, name: getStatName(id) || 'Unknown' }))
    .filter(stat => stat.name !== 'Unknown');
}

/**
 * Normalize profession name for comparison (handles variations)
 */
export function normalizeProfessionName(name: string): string {
  const normalizations: Record<string, string> = {
    'ma': 'MartialArtist',
    'martial artist': 'MartialArtist',
    'nt': 'NanoTechnician',
    'nanotechnician': 'NanoTechnician',
    'nano technician': 'NanoTechnician',
    'mp': 'MetaPhysicist',
    'metaphysicist': 'MetaPhysicist',
    'meta physicist': 'MetaPhysicist',
    'crat': 'Bureaucrat',
    'doc': 'Doctor',
    'enf': 'Enforcer',
    'eng': 'Engineer',
    'adv': 'Adventurer'
  };

  const normalized = name.toLowerCase();
  return normalizations[normalized] || 
         name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/**
 * Normalize breed name for comparison
 */
export function normalizeBreedName(name: string): string {
  const normalizations: Record<string, string> = {
    'sol': 'Solitus',
    'opi': 'Opifex', 
    'nano': 'Nanomage',
    'nm': 'Nanomage'
  };

  const normalized = name.toLowerCase();
  return normalizations[normalized] || 
         name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

// ============================================================================
// Export all functions as a single object for easy importing
// ============================================================================

export const gameUtils = {
  // ID to name translations
  getStatName,
  getRequirementName,
  getProfessionName,
  getBreedName,
  getFactionName,
  getGenderName,
  getNanoSchoolName,
  getNanoStrainName,
  getAmmoTypeName,
  getItemClassName,
  getTowerTypeName,
  getTargetName,
  getWeaponSlotName,
  getArmorSlotName,
  getImplantSlotName,

  // Name to ID translations
  getStatId,
  getProfessionId,
  getBreedId,
  getFactionId,
  getNanoSchoolId,

  // Validation functions
  isValidProfession,
  isValidBreed,
  isValidFaction,
  isValidStat,
  isValidNanoSchool,
  isValidGender,
  isValidItemClass,
  isValidWeaponSlot,
  isValidArmorSlot,
  isValidImplantSlot,

  // Collection functions
  getAllProfessionIds,
  getAllBreedIds,
  getAllFactionIds,
  getAllNanoSchoolIds,
  getAllStatIds,
  getAllProfessionNames,
  getAllBreedNames,
  getAllFactionNames,
  getAllNanoSchoolNames,

  // Special functions
  statNeedsInterpolation,
  formatStatValue,
  formatCharacterName,
  canProfessionUseNanoSchool,
  getCommonRequirementStats,
  normalizeProfessionName,
  normalizeBreedName
};
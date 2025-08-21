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
  CANFLAG,
  ITEM_NONE_FLAG,
  SPECIALIZATION_FLAG,
  WEAPON_SLOT,
  ARMOR_SLOT,
  IMPLANT_SLOT,
  WORN_ITEM,
  WEAPON_TYPE,
  NPCFAMILY,
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
 * Get NPC family name from ID
 */
export function getNPCFamilyName(id: number): string | undefined {
  return NPCFAMILY[id as keyof typeof NPCFAMILY];
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
// Icon and Image Functions
// ============================================================================

/**
 * Extract icon ID from item stats
 */
export function getItemIconId(stats: Array<{stat: number, value: number}>): number | null {
  const iconStat = stats.find(stat => stat.stat === 79); // Stat ID 79 is 'Icon'
  return iconStat ? iconStat.value : null;
}

/**
 * Get icon URL from icon ID
 */
export function getIconUrl(iconId: number): string {
  return `https://cdn.tinkeringidiot.com/aoicons/${iconId}.png`;
}

/**
 * Get item icon URL from item stats
 */
export function getItemIconUrl(stats: Array<{stat: number, value: number}>): string | null {
  const iconId = getItemIconId(stats);
  return iconId ? getIconUrl(iconId) : null;
}

/**
 * Get item icon URL with fallback
 */
export function getItemIconUrlWithFallback(
  stats: Array<{stat: number, value: number}>, 
  fallbackUrl: string = '/default-item-icon.png'
): string {
  return getItemIconUrl(stats) || fallbackUrl;
}

// ============================================================================
// Bitflag Functions
// ============================================================================

/**
 * Parse CAN flags from stat 30 bitflag value
 */
export function parseCanFlags(canFlagValue: number): string[] {
  const flags: string[] = [];
  
  for (const [flagName, flagValue] of Object.entries(CANFLAG)) {
    if (flagName !== 'NONE' && (canFlagValue & flagValue) === flagValue) {
      flags.push(flagName);
    }
  }
  
  return flags;
}

/**
 * Parse item flags from stat 0 bitflag value
 */
export function parseItemFlags(itemFlagValue: number): string[] {
  const flags: string[] = [];
  
  for (const [flagName, flagValue] of Object.entries(ITEM_NONE_FLAG)) {
    if (flagName !== 'NONE' && (itemFlagValue & flagValue) === flagValue) {
      flags.push(flagName);
    }
  }
  
  return flags;
}

/**
 * Get CAN flags from item stats
 */
export function getItemCanFlags(stats: Array<{stat: number, value: number}>): string[] {
  const canStat = stats.find(stat => stat.stat === 30); // Stat 30 is 'Can'
  return canStat ? parseCanFlags(canStat.value) : [];
}

/**
 * Get item flags from item stats
 */
export function getItemFlags(stats: Array<{stat: number, value: number}>): string[] {
  const flagStat = stats.find(stat => stat.stat === 0); // Stat 0 contains item flags
  return flagStat ? parseItemFlags(flagStat.value) : [];
}

/**
 * Check if item has specific CAN flag
 */
export function hasCanFlag(stats: Array<{stat: number, value: number}>, flagName: keyof typeof CANFLAG): boolean {
  const canFlags = getItemCanFlags(stats);
  return canFlags.includes(flagName);
}

/**
 * Check if item has specific item flag
 */
export function hasItemFlag(stats: Array<{stat: number, value: number}>, flagName: keyof typeof ITEM_NONE_FLAG): boolean {
  const itemFlags = getItemFlags(stats);
  return itemFlags.includes(flagName);
}

/**
 * Get important CAN flags for display (common ones users care about)
 */
export function getDisplayCanFlags(stats: Array<{stat: number, value: number}>): Array<{name: string, severity: string}> {
  const canFlags = getItemCanFlags(stats);
  const displayFlags: Array<{name: string, severity: string}> = [];
  
  // Map flags to display with appropriate severities
  const flagSeverityMap: Record<string, string> = {
    'Carry': 'info',
    'Wear': 'success', 
    'Use': 'info',
    'Consume': 'warning',
    'NoDrop': 'danger',
    'Unique': 'warning',
    'Stackable': 'secondary',
    'Burst': 'warning',
    'FlingShot': 'warning',
    'FullAuto': 'warning',
    'AimedShot': 'warning'
  };
  
  canFlags.forEach(flag => {
    const severity = flagSeverityMap[flag] || 'secondary';
    displayFlags.push({ name: flag, severity });
  });
  
  return displayFlags;
}

/**
 * Get important item flags for display (stat 0 - ITEM_NONE_FLAG)
 */
export function getDisplayItemFlags(stats: Array<{stat: number, value: number}>): Array<{name: string, severity: string}> {
  const itemFlags = getItemFlags(stats);
  const displayFlags: Array<{name: string, severity: string}> = [];
  
  // Filter to important flags that users care about
  const importantFlags = [
    'Visible', 'NoDrop', 'Unique', 'Locked', 'Open', 'ItemSocialArmour',
    'Stationary', 'IllegalClan', 'IllegalOmni', 'CanBeAttacked', 'HasDamage',
    'ModifiedName', 'ModifiedDescription', 'HasAnimation'
  ];
  
  itemFlags.forEach(flag => {
    if (importantFlags.includes(flag)) {
      // NoDrop gets danger severity (red), all others get secondary
      const severity = flag === 'NoDrop' ? 'danger' : 'secondary';
      displayFlags.push({ name: flag, severity });
    }
  });
  
  return displayFlags;
}

// ============================================================================
// Weapon-Specific Functions
// ============================================================================

/**
 * Weapon stat IDs for easy reference
 */
export const WEAPON_STATS = {
  MIN_DAMAGE: 286,
  MAX_DAMAGE: 285,
  CRITICAL_BONUS: 284,
  ATTACK_RANGE: 287,
  ATTACK_DELAY: 294,
  RECHARGE_DELAY: 210,
  INITIATIVE_TYPE: 440,
  ATTACK_SPEED: 3,
  BURST_RECHARGE: 374,
  WEAPON_RANGE: 380,
  DAMAGE_TYPE: 436,
  MAX_ENERGY: 212,
  AMMO_TYPE: 420,
  MAX_BENEFICIAL_SKILL: 538,
  BURST: 148,
  FLING_SHOT: 150,
  MULTI_RANGED: 134,
  MULTI_MELEE: 101,
  RANGED_ENERGY: 133,
  RANGED_INIT: 119,
  FULL_AUTO: 167,
  FULL_AUTO_RECHARGE: 375
} as const;

/**
 * Damage type mapping
 */
export const DAMAGE_TYPES = {
  0: 'None',
  1: 'Melee',
  2: 'Energy',
  3: 'Chemical',
  4: 'Radiation',
  5: 'Cold',
  6: 'Poison',
  7: 'Fire',
  8: 'Projectile'
} as const;

/**
 * Get weapon statistics from item stats
 */
export function getWeaponStats(stats: Array<{stat: number, value: number}>): {
  minDamage?: number;
  maxDamage?: number;
  criticalBonus?: number;
  attackRange?: number;
  attackDelay?: number;
  rechargeDelay?: number;
  initiativeType?: number;
  attackSpeed?: number;
  burstRecharge?: number;
  range?: number;
  damageType?: number;
  maxEnergy?: number;
  ammoType?: number;
  maxBeneficialSkill?: number;
  burst?: number;
  flingShot?: number;
  multiRanged?: number;
  multiMelee?: number;
  rangedEnergy?: number;
  rangedInit?: number;
  fullAuto?: number;
  fullAutoRecharge?: number;
} {
  const weaponStats: Record<string, number> = {};
  
  stats.forEach(stat => {
    switch (stat.stat) {
      case WEAPON_STATS.MIN_DAMAGE:
        weaponStats.minDamage = stat.value;
        break;
      case WEAPON_STATS.MAX_DAMAGE:
        weaponStats.maxDamage = stat.value;
        break;
      case WEAPON_STATS.CRITICAL_BONUS:
        weaponStats.criticalBonus = stat.value;
        break;
      case WEAPON_STATS.ATTACK_RANGE:
        weaponStats.attackRange = stat.value;
        break;
      case WEAPON_STATS.ATTACK_DELAY:
        weaponStats.attackDelay = stat.value;
        break;
      case WEAPON_STATS.RECHARGE_DELAY:
        weaponStats.rechargeDelay = stat.value;
        break;
      case WEAPON_STATS.INITIATIVE_TYPE:
        weaponStats.initiativeType = stat.value;
        break;
      case WEAPON_STATS.ATTACK_SPEED:
        weaponStats.attackSpeed = stat.value;
        break;
      case WEAPON_STATS.BURST_RECHARGE:
        weaponStats.burstRecharge = stat.value;
        break;
      case WEAPON_STATS.WEAPON_RANGE:
        weaponStats.range = stat.value;
        break;
      case WEAPON_STATS.DAMAGE_TYPE:
        weaponStats.damageType = stat.value;
        break;
      case WEAPON_STATS.MAX_ENERGY:
        weaponStats.maxEnergy = stat.value;
        break;
      case WEAPON_STATS.AMMO_TYPE:
        weaponStats.ammoType = stat.value;
        break;
      case WEAPON_STATS.MAX_BENEFICIAL_SKILL:
        weaponStats.maxBeneficialSkill = stat.value;
        break;
      case WEAPON_STATS.BURST:
        weaponStats.burst = stat.value;
        break;
      case WEAPON_STATS.FLING_SHOT:
        weaponStats.flingShot = stat.value;
        break;
      case WEAPON_STATS.MULTI_RANGED:
        weaponStats.multiRanged = stat.value;
        break;
      case WEAPON_STATS.MULTI_MELEE:
        weaponStats.multiMelee = stat.value;
        break;
      case WEAPON_STATS.RANGED_ENERGY:
        weaponStats.rangedEnergy = stat.value;
        break;
      case WEAPON_STATS.RANGED_INIT:
        weaponStats.rangedInit = stat.value;
        break;
      case WEAPON_STATS.FULL_AUTO:
        weaponStats.fullAuto = stat.value;
        break;
      case WEAPON_STATS.FULL_AUTO_RECHARGE:
        weaponStats.fullAutoRecharge = stat.value;
        break;
    }
  });
  
  return weaponStats;
}

/**
 * Get damage type name from ID
 */
export function getDamageTypeName(damageTypeId: number): string {
  return DAMAGE_TYPES[damageTypeId as keyof typeof DAMAGE_TYPES] || `Type ${damageTypeId}`;
}

/**
 * Format attack time (in ticks) to seconds
 */
export function formatAttackTime(attackSpeed: number): string {
  // AO uses 1000 ticks per second
  const seconds = attackSpeed / 1000;
  return `${seconds.toFixed(2)}s`;
}

/**
 * Format recharge time to seconds
 */
export function formatRechargeTime(rechargeTime: number): string {
  const seconds = rechargeTime / 1000;
  return `${seconds.toFixed(2)}s`;
}

/**
 * Calculate DPS (Damage Per Second) for a weapon
 */
export function calculateWeaponDPS(minDamage: number, maxDamage: number, attackSpeed: number): number {
  if (!minDamage || !maxDamage || !attackSpeed) return 0;
  
  const avgDamage = (minDamage + maxDamage) / 2;
  const attacksPerSecond = 1000 / attackSpeed; // Convert ticks to seconds
  
  return avgDamage * attacksPerSecond;
}

// ============================================================================
// Special Attack Calculation Functions
// ============================================================================

/**
 * Special attack result containing skill requirement and damage cap
 */
export interface SpecialAttackResult {
  skill: number;
  cap: number;
}

/**
 * Calculate Fling Shot special attack requirements
 * @param attackTime Attack time in centiseconds
 * @returns Object with skill requirement and damage cap
 */
export function calculateFling(attackTime: number): SpecialAttackResult {
  const cap = Math.floor(5 + (attackTime / 100));
  const skill = Math.round((16 * (attackTime / 100) - 6 - 1) * 100) + 1;
  return { skill, cap };
}

/**
 * Calculate Burst special attack requirements
 * @param attackTime Attack time in centiseconds
 * @param rechTime Recharge time in centiseconds
 * @param burstCycle Burst cycle time in centiseconds
 * @returns Object with skill requirement and damage cap
 */
export function calculateBurst(attackTime: number, rechTime: number, burstCycle: number): SpecialAttackResult {
  const cap = Math.floor(8 + (attackTime / 100));
  const skill = Math.floor((((rechTime / 100) * 20) + (burstCycle / 100) - 9 - 1 + (attackTime / 100)) * 25) + 1;
  return { skill, cap };
}

/**
 * Calculate Full Auto special attack requirements
 * @param attackTime Attack time in centiseconds
 * @param rechTime Recharge time in centiseconds
 * @param faCycle Full auto cycle time in centiseconds (defaults to 1000 if 0)
 * @returns Object with skill requirement and damage cap
 */
export function calculateFullAuto(attackTime: number, rechTime: number, faCycle: number): SpecialAttackResult {
  const cap = Math.floor(10 + (attackTime / 100));
  if (faCycle === 0) {
    faCycle = 1000;
  }
  const skill = Math.floor((((rechTime / 100) * 40 + (faCycle / 100) - 11 - 1 + (attackTime / 100)) * 25)) + 1;
  return { skill, cap };
}

/**
 * Calculate Aimed Shot special attack requirements
 * @param attackTime Attack time in centiseconds
 * @param rechTime Recharge time in centiseconds
 * @returns Object with skill requirement and damage cap
 */
export function calculateAimedShot(attackTime: number, rechTime: number): SpecialAttackResult {
  const cap = Math.floor(10 + (attackTime / 100));
  const skill = Math.ceil((((rechTime / 100) * 40) + (attackTime / 100) - 11 - 1) * 100 / 3);
  return { skill, cap };
}

/**
 * Calculate Fast Attack special attack requirements
 * @param attackTime Attack time in centiseconds
 * @returns Object with skill requirement and damage cap
 */
export function calculateFastAttack(attackTime: number): SpecialAttackResult {
  const cap = Math.floor(5 + (attackTime / 100));
  const skill = Math.round(((attackTime / 100) * 16 - 5 - 1) * 100) + 1;
  return { skill, cap };
}

/**
 * Special attack information with calculated requirements
 */
export interface WeaponSpecialAttack {
  name: string;
  skill: number;
  cap: number;
}

/**
 * Get all special attacks available on a weapon based on CAN flags and stats
 * @param stats Array of stat objects from item
 * @returns Array of special attacks with calculated skill and cap values
 */
export function getWeaponSpecialAttacks(stats: Array<{stat: number, value: number}>): WeaponSpecialAttack[] {
  const specialAttacks: WeaponSpecialAttack[] = [];
  const canFlags = getItemCanFlags(stats);
  const weaponStats = getWeaponStats(stats);
  
  // Get required timing stats
  const attackDelay = weaponStats.attackDelay;
  const rechargeDelay = weaponStats.rechargeDelay;
  
  if (!attackDelay || !rechargeDelay) {
    return specialAttacks; // Can't calculate without timing stats
  }
  
  // Check each special attack type
  if (canFlags.includes('FlingShot')) {
    const result = calculateFling(attackDelay);
    specialAttacks.push({
      name: 'Fling Shot',
      skill: result.skill,
      cap: result.cap
    });
  }
  
  if (canFlags.includes('Burst')) {
    // Use BurstRecharge stat if available, otherwise default to 1000
    const burstCycle = weaponStats.burstRecharge || 1000;
    const result = calculateBurst(attackDelay, rechargeDelay, burstCycle);
    specialAttacks.push({
      name: 'Burst',
      skill: result.skill,
      cap: result.cap
    });
  }
  
  if (canFlags.includes('FullAuto')) {
    // Use FullAuto stat, then FullAutoRecharge stat, then default to 0
    const faCycle = weaponStats.fullAuto || weaponStats.fullAutoRecharge || 0;
    const result = calculateFullAuto(attackDelay, rechargeDelay, faCycle);
    specialAttacks.push({
      name: 'Full Auto',
      skill: result.skill,
      cap: result.cap
    });
  }
  
  if (canFlags.includes('AimedShot')) {
    const result = calculateAimedShot(attackDelay, rechargeDelay);
    specialAttacks.push({
      name: 'Aimed Shot',
      skill: result.skill,
      cap: result.cap
    });
  }
  
  if (canFlags.includes('FastAttack')) {
    const result = calculateFastAttack(attackDelay);
    specialAttacks.push({
      name: 'Fast Attack',
      skill: result.skill,
      cap: result.cap
    });
  }
  
  return specialAttacks;
}

/**
 * Check if an item is a weapon based on ITEM_CLASS constant
 */
export function isWeapon(itemClass: number): boolean {
  return itemClass === 1; // ITEM_CLASS[1] = 'Weapon'
}

/**
 * Check if an item is armor based on ITEM_CLASS constant
 */
export function isArmor(itemClass: number): boolean {
  return itemClass === 2; // ITEM_CLASS[2] = 'Armor'
}

/**
 * Check if an item is an implant based on ITEM_CLASS constant
 */
export function isImplant(itemClass: number): boolean {
  return itemClass === 3; // ITEM_CLASS[3] = 'Implant'
}

/**
 * Get special attack skills for a weapon
 */
export function getWeaponSpecialSkills(stats: Array<{stat: number, value: number}>): string[] {
  const skills: string[] = [];
  
  stats.forEach(stat => {
    if (stat.value > 0) {
      switch (stat.stat) {
        case WEAPON_STATS.BURST:
          skills.push('Burst');
          break;
        case WEAPON_STATS.FLING_SHOT:
          skills.push('Fling Shot');
          break;
        case WEAPON_STATS.MULTI_RANGED:
          skills.push('Multi Ranged');
          break;
      }
    }
  });
  
  return skills;
}

/**
 * Format weapon range display
 */
export function formatWeaponRange(range: number): string {
  return `${range}m`;
}

/**
 * Get item class category name
 */
export function getItemCategoryName(itemClass: number): string {
  if (isWeapon(itemClass)) return 'Weapon';
  if (isArmor(itemClass)) return 'Armor';
  if (isImplant(itemClass)) return 'Implant';
  return getItemClassName(itemClass) || 'Item';
}

// ============================================================================
// Slot Functions
// ============================================================================

/**
 * Get item class from item stats or property
 */
export function getItemClass(item: any): number {
  // First try the ItemClass stat (stat 76)
  const itemClassStat = item.stats?.find((stat: any) => stat.stat === 76);
  if (itemClassStat) {
    return itemClassStat.value;
  }
  
  // Fallback to item_class property
  return item.item_class || 0;
}

/**
 * Parse weapon slot bitflags
 */
export function parseWeaponSlots(slotValue: number): string[] {
  const slots: string[] = [];
  
  for (const [slotName, slotBit] of Object.entries(WEAPON_SLOT)) {
    if (slotName !== 'NONE' && slotName !== 'Bit0' && (slotValue & slotBit) === slotBit) {
      slots.push(slotName);
    }
  }
  
  return slots;
}

/**
 * Parse armor slot bitflags
 */
export function parseArmorSlots(slotValue: number): string[] {
  const slots: string[] = [];
  
  for (const [slotName, slotBit] of Object.entries(ARMOR_SLOT)) {
    if (slotName !== 'NONE' && slotName !== 'Bit0' && (slotValue & slotBit) === slotBit) {
      slots.push(slotName);
    }
  }
  
  return slots;
}

/**
 * Parse implant slot bitflags
 */
export function parseImplantSlots(slotValue: number): string[] {
  const slots: string[] = [];
  
  for (const [slotName, slotBit] of Object.entries(IMPLANT_SLOT)) {
    if (slotName !== 'NONE' && slotName !== 'Bit0' && (slotValue & slotBit) === slotBit) {
      slots.push(slotName);
    }
  }
  
  return slots;
}

/**
 * Get item slot information
 */
export function getItemSlotInfo(item: any): {
  type: 'weapon' | 'armor' | 'implant' | null;
  slots: string[];
  iconUrl: string | null;
} {
  const itemClass = getItemClass(item);
  const iconUrl = getItemIconUrl(item.stats);
  
  // Get slot value from stat 298
  const slotStat = item.stats?.find((stat: any) => stat.stat === 298);
  const slotValue = slotStat ? slotStat.value : 0;
  
  // Determine slot type based on which slot parser returns valid results
  // Some items (like gloves) have weapon item class but armor slot values
  const weaponSlots = parseWeaponSlots(slotValue);
  const armorSlots = parseArmorSlots(slotValue);
  const implantSlots = parseImplantSlots(slotValue);
  
  // Check implants first (item class 3)
  if (isImplant(itemClass) && implantSlots.length > 0) {
    return {
      type: 'implant',
      slots: implantSlots,
      iconUrl
    };
  }
  
  // Check weapon slots first for weapon item classes
  if (isWeapon(itemClass) && weaponSlots.length > 0) {
    return {
      type: 'weapon',
      slots: weaponSlots,
      iconUrl
    };
  }
  
  // Check armor slots (can include weapons with armor slot values like gloves)
  if (armorSlots.length > 0) {
    return {
      type: 'armor',
      slots: armorSlots,
      iconUrl
    };
  }
  
  // Check weapon slots for non-weapon classes that might still be wieldable
  if (weaponSlots.length > 0) {
    return {
      type: 'weapon',
      slots: weaponSlots,
      iconUrl
    };
  }
  
  // No valid slots found
  return {
    type: null,
    slots: [],
    iconUrl
  };
}

/**
 * Get weapon slot grid position (3x5 grid)
 */
export function getWeaponSlotPosition(slotName: string): { row: number; col: number } {
  const positions: Record<string, { row: number; col: number }> = {
    'Hud1': { row: 1, col: 1 },
    'Hud2': { row: 1, col: 2 },
    'Hud3': { row: 1, col: 3 },
    'Utils1': { row: 2, col: 1 },
    'Util1': { row: 2, col: 1 }, // Alternative name
    'Utils2': { row: 2, col: 2 },
    'Util2': { row: 2, col: 2 }, // Alternative name
    'Utils3': { row: 2, col: 3 },
    'Util3': { row: 2, col: 3 }, // Alternative name
    'LeftHand': { row: 3, col: 1 },
    'RightHand': { row: 3, col: 3 },
    'Deck': { row: 4, col: 2 },
    'Deck1': { row: 4, col: 1 },
    'Deck2': { row: 4, col: 2 },
    'Deck3': { row: 4, col: 3 },
    'Deck4': { row: 5, col: 1 },
    'Deck5': { row: 5, col: 2 },
    'Deck6': { row: 5, col: 3 }
  };
  
  return positions[slotName] || { row: 1, col: 1 };
}

/**
 * Get armor slot grid position
 */
export function getArmorSlotPosition(slotName: string): { row: number; col: number } {
  const positions: Record<string, { row: number; col: number }> = {
    'Head': { row: 1, col: 2 },
    'Neck': { row: 1, col: 1 },
    'Back': { row: 1, col: 3 },
    'LeftShoulder': { row: 2, col: 1 },
    'Chest': { row: 2, col: 2 },
    'RightShoulder': { row: 2, col: 3 },
    'LeftArm': { row: 3, col: 1 },
    'Hands': { row: 3, col: 2 },
    'RightArm': { row: 3, col: 3 },
    'LeftWrist': { row: 4, col: 1 },
    'Legs': { row: 4, col: 2 },
    'RightWrist': { row: 4, col: 3 },
    'LeftFinger': { row: 5, col: 1 },
    'Feet': { row: 5, col: 2 },
    'RightFinger': { row: 5, col: 3 }
  };
  
  return positions[slotName] || { row: 1, col: 1 };
}

/**
 * Get implant slot grid position (3x5 grid)
 */
export function getImplantSlotPosition(slotName: string): { row: number; col: number } {
  const positions: Record<string, { row: number; col: number }> = {
    'Eyes': { row: 1, col: 1 },
    'Head': { row: 1, col: 2 },
    'Ears': { row: 1, col: 3 },
    'RightArm': { row: 2, col: 1 },
    'Chest': { row: 2, col: 2 },
    'LeftArm': { row: 2, col: 3 },
    'RightWrist': { row: 3, col: 1 },
    'Waist': { row: 3, col: 2 },
    'LeftWrist': { row: 3, col: 3 },
    'RightHand': { row: 4, col: 1 },
    'Legs': { row: 4, col: 2 },
    'LeftHand': { row: 4, col: 3 },
    'Feet': { row: 5, col: 2 }
  };
  
  return positions[slotName] || { row: 1, col: 1 };
}

// ============================================================================
// Flag Bit Resolution
// ============================================================================

/**
 * Get flag name from bit number and stat ID
 * Shared utility for resolving bit numbers to flag names across criteria and spell data
 */
export function getFlagNameFromBit(statId: number, bitNum: number): string {
  // Map stat IDs to their corresponding flag constants
  const flagConstants: Record<number, Record<string, number>> = {
    30: CANFLAG,        // Can flags
    355: WORN_ITEM,     // WornItem flags
    // Add more stat ID to flag mappings as needed
  }
  
  const flagConstant = flagConstants[statId]
  if (!flagConstant) {
    return `Bit ${bitNum}`
  }
  
  // Find the flag name that corresponds to the bit position
  const bitValue = 1 << bitNum // Convert bit position to bit value
  for (const [flagName, flagValue] of Object.entries(flagConstant)) {
    if (flagValue === bitValue) {
      return flagName
    }
  }
  
  return `Bit ${bitNum}`
}

/**
 * Get flag name from bit value and stat ID
 * Similar to getFlagNameFromBit but works with the actual bit value instead of position
 */
export function getFlagNameFromValue(statId: number, bitValue: number): string {
  // Map stat IDs to their corresponding flag constants
  const flagConstants: Record<number, Record<string, number>> = {
    30: CANFLAG,        // Can flags
    182: SPECIALIZATION_FLAG,  // Specialization flags
    355: WORN_ITEM,     // WornItem flags
    455: NPCFAMILY,     // NPCFamily flags
    // Add more stat ID to flag mappings as needed
  }
  
  const flagConstant = flagConstants[statId]
  if (!flagConstant) {
    return `Flag ${bitValue}`
  }
  
  // Find the flag name that corresponds to the bit value
  for (const [flagName, flagValue] of Object.entries(flagConstant)) {
    if (flagValue === bitValue) {
      return flagName
    }
  }
  
  return `Flag ${bitValue}`
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
  getNPCFamilyName,
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
  normalizeBreedName,

  // Icon functions
  getItemIconId,
  getIconUrl,
  getItemIconUrl,
  getItemIconUrlWithFallback,

  // Weapon functions
  getWeaponStats,
  getDamageTypeName,
  formatAttackTime,
  formatRechargeTime,
  calculateWeaponDPS,
  isWeapon,
  isArmor,
  getWeaponSpecialSkills,
  formatWeaponRange,
  getItemCategoryName,

  // Special attack calculations
  calculateFling,
  calculateBurst,
  calculateFullAuto,
  calculateAimedShot,
  calculateFastAttack,
  getWeaponSpecialAttacks,

  // Bitflag functions
  parseCanFlags,
  parseItemFlags,
  getItemCanFlags,
  getItemFlags,
  hasCanFlag,
  hasItemFlag,
  getDisplayCanFlags,
  getDisplayItemFlags,

  // Slot functions
  getItemClass,
  parseWeaponSlots,
  parseArmorSlots,
  parseImplantSlots,
  getItemSlotInfo,
  getWeaponSlotPosition,
  getArmorSlotPosition,
  getImplantSlotPosition,
  
  // Flag resolution functions
  getFlagNameFromBit,
  getFlagNameFromValue
};
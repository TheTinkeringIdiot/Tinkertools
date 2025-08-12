/**
 * TinkerTools Flag Operations Utility
 * 
 * Functions for binary flag decoding, manipulation, permission checking,
 * and validation of flag-based restrictions and requirements.
 */

// ============================================================================
// Flag Enum Definitions (converted from Python)
// ============================================================================

export enum SPECIALIZATION_FLAG {
  NONE = 0,
  First = 1,
  Second = 2,
  Third = 4,
  Fourth = 8,
  Bit5 = 32,
  Bit6 = 64,
  Bit7 = 128,
  Bit8 = 256
}

export enum ACTION_FLAG {
  NONE = 0,
  Bit0 = 1,
  Fighting = 2,
  Moving = 4,
  Falling = 8,
  ImplantAccess = 16,
  Chat = 32,
  SkillTime = 64,
  Concealment = 128,
  CryForHelp = 256,
  VicinityInfo = 512,
  Attack = 1024,
  OnGrid = 2048,
  BankAccess = 4096,
  Zoning = 8192,
  Help = 16384,
  WalkOnLand = 32768,
  Bit15 = 65536,
  SwimInWater = 131072,
  FlyInAir = 262144,
  Terminate = 524288,
  Bit20 = 1048576,
  Bit21 = 2097152,
  Bit22 = 4194304,
  Bit23 = 8388608,
  Anon = 16777216,
  Bit25 = 33554432,
  PvP = 67108864,
  Bit27 = 134217728,
  Bit28 = 268435456,
  Bit29 = 536870912,
  Bit30 = 1073741824,
  Bit31 = 2147483648
}

export enum NANO_NONE_FLAG {
  NONE = 0,
  Visible = 1,
  NoResistCannotFumble = 2,
  IsShapeChange = 4,
  BreakOnAttack = 8,
  TurnOnUse = 16,
  BreakOnDebuff = 32,
  BreakOnInterval = 64,
  BreakOnSpellAttack = 128,
  NoRemoveNoNCUFriendly = 256,
  TellCollision = 512,
  NoSelectionIndicator = 1024,
  UseEmptyDestruct = 2048,
  NoIIR = 4096,
  NoResist = 8192,
  NotRemovable = 16384,
  IsHostile = 32768,
  IsBuff = 65536,
  IsDebuff = 131072,
  PlayshiftRequirements = 262144,
  NoTimerNotify = 524288,
  NoTimeoutNotify = 1048576,
  DontRemoveOnDeath = 2097152,
  DontBreakOnAttack = 4194304,
  CannotRefresh = 8388608,
  IsHidden = 16777216,
  ClassDebuffMMBM = 33554432,
  ClassDebuffMCTS = 67108864,
  ClassDebuffPMSI = 134217728,
  ClassCombatDebuff = 268435456,
  ClassAoE = 536870912,
  ClassRootOrSnare = 1073741824,
  WantCollision = 2147483648
}

export enum ITEM_NONE_FLAG {
  NONE = 0,
  Visible = 1,
  ModifiedDescription = 2,
  ModifiedName = 4,
  CanBeTemplateItem = 8,
  TurnOnUse = 16,
  HasMultipleCount = 32,
  Locked = 64,
  Open = 128,
  ItemSocialArmour = 256,
  TellCollision = 512,
  NoSelectionIndicator = 1024,
  UseEmptyDestruct = 2048,
  Stationary = 4096,
  Repulsive = 8192,
  DefaultTarget = 16384,
  ItemTextureOverride = 32768,
  Null = 65536,
  HasAnimation = 131072,
  HasRotation = 262144,
  WantCollision = 524288,
  WantSignals = 1048576,
  HasSentFirstIIR = 2097152,
  HasEnergy = 4194304,
  MirrorInLeftHand = 8388608,
  IllegalClan = 16777216,
  IllegalOmni = 33554432,
  NoDrop = 67108864,
  Unique = 134217728,
  CanBeAttacked = 268435456,
  DisableFalling = 536870912,
  HasDamage = 1073741824,
  DisableStatelCollision = 2147483648
}

export enum CANFLAG {
  NONE = 0,
  Carry = 1,
  Sit = 2,
  Wear = 4,
  Use = 8,
  ConfirmUse = 16,
  Consume = 32,
  TutorChip = 64,
  TutorDevice = 128,
  BreakingAndEntering = 256,
  Stackable = 512,
  NoAmmo = 1024,
  Burst = 2048,
  FlingShot = 4096,
  FullAuto = 8192,
  AimedShot = 16384,
  Bow = 32768,
  ThrowAttack = 65536,
  SneakAttack = 131072,
  FastAttack = 262144,
  DisarmTraps = 524288,
  AutoSelect = 1048576,
  ApplyOnFriendly = 2097152,
  ApplyOnHostile = 4194304,
  ApplyOnSelf = 8388608,
  CantSplit = 16777216,
  Brawl = 33554432,
  Dimach = 67108864,
  EnableHandAttractors = 134217728,
  CanBeWornWithSocialArmor = 268435456,
  CanParryRiposite = 536870912,
  CanBeParriedRiposited = 1073741824,
  ApplyOnFightingTarget = 2147483648
}

export enum EXPANSION_FLAG {
  NONE = 0,
  NotumWars = 1,
  Shadowlands = 2,
  ShadowlandsPreorder = 4,
  AlienInvasion = 8,
  AlienInvasionPreorder = 16,
  LostEden = 32,
  LostEdenPreorder = 64,
  LexacyOfXan = 128,
  LegacyOfXanPreorder = 256
}

export enum WORN_ITEM {
  BasicCyberDeck = 1,
  AugmentedCyberDeck = 2,
  JobeCyberDeck = 4,
  IzgimmerCyberDeck = 8,
  GridArmor = 16,
  SocialArmor = 32,
  NanoDeck = 64,
  MpSummonedWeapon = 128,
  Bit8 = 256,
  Bit9 = 512,
  Bit10 = 1024,
  Bit11 = 2048,
  Bit12 = 4096,
  Bit13 = 8192,
  Bit14 = 16384,
  Bit15 = 32768,
  Bit16 = 65536,
  Bit17 = 131072,
  Bit18 = 262144,
  Bit19 = 524288,
  Bit20 = 1048576,
  Bit21 = 2097152,
  Bit22 = 4194304,
  Bit23 = 8388608,
  Bit24 = 16777216,
  Bit25 = 33554432,
  Bit26 = 67108864,
  Bit27 = 134217728,
  Bit28 = 268435456,
  Bit29 = 536870912,
  Bit30 = 1073741824,
  Bit31 = 2147483648
}

export enum WEAPON_SLOT {
  NONE = 0,
  Bit0 = 1,
  Hud1 = 2,
  Hud3 = 4,
  Util1 = 8,
  Util2 = 16,
  Util3 = 32,
  RightHand = 64,
  Deck = 128,
  LeftHand = 256,
  Deck1 = 512,
  Deck2 = 1024,
  Deck3 = 2048,
  Deck4 = 4096,
  Deck5 = 8192,
  Deck6 = 16384,
  Hud2 = 32768
}

export enum ARMOR_SLOT {
  NONE = 0,
  Bit0 = 1,
  Neck = 2,
  Head = 4,
  Back = 8,
  RightShoulder = 16,
  Chest = 32,
  LeftShoulder = 64,
  RightArm = 128,
  Hands = 256,
  LeftArm = 512,
  RightWrist = 1024,
  Legs = 2048,
  LeftWrist = 4096,
  RightFinger = 8192,
  Feet = 16384,
  LeftFinger = 32768,
  PerkAction = 2147483648
}

export enum IMPLANT_SLOT {
  NONE = 0,
  Bit0 = 1,
  Eyes = 2,
  Head = 4,
  Ears = 8,
  RightArm = 16,
  Chest = 32,
  LeftArm = 64,
  RightWrist = 128,
  Waist = 256,
  LeftWrist = 512,
  RightHand = 1024,
  Legs = 2048,
  LeftHand = 4096,
  Feet = 8192
}

export enum SL_ZONE_PROTECTION {
  Adonis = 0,
  Penumbra = 1,
  Inferno = 2,
  Pandemonium = 4
}

export enum WEAPON_TYPE {
  NONE = 0,
  Fists = 1,
  Melee = 2,
  Ranged = 4,
  Bow = 8,
  SMG = 16,
  OneHandEdge = 32,
  OneHandBlunt = 64,
  TwoHandEdge = 128,
  TwoHandBlunt = 256,
  Piercing = 512,
  Pistol = 1024,
  AssaultRifle = 2048,
  Rifle = 4096,
  Shotgun = 8192,
  Energy = 16384,
  Grenade = 32768,
  HeavyWeapons = 65536,
  Bit17 = 131072,
  Bit18 = 262144,
  Bit19 = 524288,
  Bit20 = 1048576,
  Bit21 = 2097152,
  Bit22 = 4194304,
  TestItem = 8388608,
  Bit24 = 16777216,
  Bit25 = 33554432,
  Bit26 = 67108864,
  Bit27 = 134217728,
  Bit28 = 268435456,
  Bit29 = 536870912,
  Bit30 = 1073741824,
  Bit31 = 2147483648
}

// ============================================================================
// Core Flag Operations
// ============================================================================

/**
 * Check if a specific flag bit is set in a flag value
 */
export function isFlagSet(flags: number, flag: number): boolean {
  return (flags & flag) === flag;
}

/**
 * Set a specific flag bit in a flag value
 */
export function setFlag(flags: number, flag: number): number {
  return flags | flag;
}

/**
 * Clear a specific flag bit in a flag value
 */
export function clearFlag(flags: number, flag: number): number {
  return flags & ~flag;
}

/**
 * Toggle a specific flag bit in a flag value
 */
export function toggleFlag(flags: number, flag: number): number {
  return flags ^ flag;
}

/**
 * Check if all specified flags are set
 */
export function hasAllFlags(flags: number, requiredFlags: number[]): boolean {
  return requiredFlags.every(flag => isFlagSet(flags, flag));
}

/**
 * Check if any of the specified flags are set
 */
export function hasAnyFlag(flags: number, checkFlags: number[]): boolean {
  return checkFlags.some(flag => isFlagSet(flags, flag));
}

/**
 * Count the number of set bits in a flag value
 */
export function countSetBits(flags: number): number {
  let count = 0;
  while (flags) {
    count += flags & 1;
    flags >>>= 1;
  }
  return count;
}

/**
 * Get all set flag values from a combined flag
 */
export function getSetFlags(flags: number, flagEnum: Record<string, number>): number[] {
  const setFlags: number[] = [];
  
  for (const [name, value] of Object.entries(flagEnum)) {
    if (typeof value === 'number' && value > 0 && isFlagSet(flags, value)) {
      setFlags.push(value);
    }
  }
  
  return setFlags;
}

/**
 * Get names of all set flags from a combined flag
 */
export function getSetFlagNames(flags: number, flagEnum: Record<string, number>): string[] {
  const setFlagNames: string[] = [];
  
  for (const [name, value] of Object.entries(flagEnum)) {
    if (typeof value === 'number' && value > 0 && isFlagSet(flags, value)) {
      setFlagNames.push(name);
    }
  }
  
  return setFlagNames;
}

// ============================================================================
// Specific Flag Type Operations
// ============================================================================

/**
 * Decode ACTION_FLAG value into human-readable actions
 */
export function decodeActionFlags(flags: number): string[] {
  return getSetFlagNames(flags, ACTION_FLAG);
}

/**
 * Decode ITEM_NONE_FLAG value into item properties
 */
export function decodeItemFlags(flags: number): string[] {
  return getSetFlagNames(flags, ITEM_NONE_FLAG);
}

/**
 * Decode CANFLAG value into item capabilities
 */
export function decodeCanFlags(flags: number): string[] {
  return getSetFlagNames(flags, CANFLAG);
}

/**
 * Decode NANO_NONE_FLAG value into nano properties
 */
export function decodeNanoFlags(flags: number): string[] {
  return getSetFlagNames(flags, NANO_NONE_FLAG);
}

/**
 * Decode EXPANSION_FLAG value into required expansions
 */
export function decodeExpansionFlags(flags: number): string[] {
  return getSetFlagNames(flags, EXPANSION_FLAG);
}

/**
 * Decode WEAPON_TYPE flags into weapon types
 */
export function decodeWeaponTypeFlags(flags: number): string[] {
  return getSetFlagNames(flags, WEAPON_TYPE);
}

/**
 * Decode slot flags for weapons, armor, or implants
 */
export function decodeSlotFlags(flags: number, slotType: 'weapon' | 'armor' | 'implant'): string[] {
  switch (slotType) {
    case 'weapon':
      return getSetFlagNames(flags, WEAPON_SLOT);
    case 'armor':
      return getSetFlagNames(flags, ARMOR_SLOT);
    case 'implant':
      return getSetFlagNames(flags, IMPLANT_SLOT);
    default:
      return [];
  }
}

// ============================================================================
// Permission and Restriction Checking
// ============================================================================

/**
 * Check if an item can be used based on CAN flags
 */
export function canUseItem(itemCanFlags: number, requiredAction: keyof typeof CANFLAG): boolean {
  const flagValue = CANFLAG[requiredAction];
  return isFlagSet(itemCanFlags, flagValue);
}

/**
 * Check if an item is restricted to a specific faction
 */
export function checkFactionRestriction(itemFlags: number, characterFaction: number): { 
  allowed: boolean; 
  restriction?: string 
} {
  const isClanIllegal = isFlagSet(itemFlags, ITEM_NONE_FLAG.IllegalClan);
  const isOmniIllegal = isFlagSet(itemFlags, ITEM_NONE_FLAG.IllegalOmni);
  
  // Faction IDs: 0 = Neutral, 1 = Clan, 2 = Omni
  if (characterFaction === 1 && isClanIllegal) {
    return { allowed: false, restriction: 'Clan cannot use this item' };
  }
  
  if (characterFaction === 2 && isOmniIllegal) {
    return { allowed: false, restriction: 'Omni cannot use this item' };
  }
  
  return { allowed: true };
}

/**
 * Check if a character meets expansion requirements
 */
export function checkExpansionRequirements(
  requiredExpansions: number,
  availableExpansions: number
): { allowed: boolean; missingExpansions: string[] } {
  const missingExpansions: string[] = [];
  
  for (const [name, flag] of Object.entries(EXPANSION_FLAG)) {
    if (typeof flag === 'number' && flag > 0) {
      if (isFlagSet(requiredExpansions, flag) && !isFlagSet(availableExpansions, flag)) {
        missingExpansions.push(name);
      }
    }
  }
  
  return {
    allowed: missingExpansions.length === 0,
    missingExpansions
  };
}

/**
 * Check if an item is unique and already owned
 */
export function checkUniqueItemRestriction(
  itemFlags: number,
  ownedItems: Array<{ id: number; flags: number }>
): boolean {
  if (!isFlagSet(itemFlags, ITEM_NONE_FLAG.Unique)) {
    return true; // Not unique, no restriction
  }
  
  // Check if character already owns this unique item
  return !ownedItems.some(item => 
    isFlagSet(item.flags, ITEM_NONE_FLAG.Unique) && 
    item.flags === itemFlags
  );
}

/**
 * Check if an item can be dropped/traded
 */
export function canDropItem(itemFlags: number): boolean {
  return !isFlagSet(itemFlags, ITEM_NONE_FLAG.NoDrop);
}

/**
 * Check if a nano breaks on attack
 */
export function nanoBreaksOnAttack(nanoFlags: number): boolean {
  return isFlagSet(nanoFlags, NANO_NONE_FLAG.BreakOnAttack) &&
         !isFlagSet(nanoFlags, NANO_NONE_FLAG.DontBreakOnAttack);
}

/**
 * Check if a nano breaks on debuff
 */
export function nanoBreaksOnDebuff(nanoFlags: number): boolean {
  return isFlagSet(nanoFlags, NANO_NONE_FLAG.BreakOnDebuff);
}

/**
 * Check if a nano is removable
 */
export function isNanoRemovable(nanoFlags: number): boolean {
  return !isFlagSet(nanoFlags, NANO_NONE_FLAG.NotRemovable);
}

// ============================================================================
// Action Permission Checking
// ============================================================================

/**
 * Check if an action is allowed based on current action flags
 */
export function isActionAllowed(
  currentActionFlags: number,
  requestedAction: keyof typeof ACTION_FLAG
): boolean {
  const actionFlag = ACTION_FLAG[requestedAction];
  
  // If the restriction flag is NOT set, the action is allowed
  return !isFlagSet(currentActionFlags, actionFlag);
}

/**
 * Get list of currently restricted actions
 */
export function getRestrictedActions(actionFlags: number): string[] {
  return getSetFlagNames(actionFlags, ACTION_FLAG);
}

/**
 * Check if character can access bank
 */
export function canAccessBank(actionFlags: number): boolean {
  return isActionAllowed(actionFlags, 'BankAccess');
}

/**
 * Check if character can move
 */
export function canMove(actionFlags: number): boolean {
  return isActionAllowed(actionFlags, 'Moving');
}

/**
 * Check if character can attack
 */
export function canAttack(actionFlags: number): boolean {
  return isActionAllowed(actionFlags, 'Attack');
}

/**
 * Check if character can use concealment
 */
export function canUseConcealment(actionFlags: number): boolean {
  return isActionAllowed(actionFlags, 'Concealment');
}

// ============================================================================
// Zone and Location Restrictions
// ============================================================================

/**
 * Check if character can enter a Shadowlands zone
 */
export function canEnterSLZone(
  zoneProtection: number,
  characterSLAccess: number
): { allowed: boolean; reason?: string } {
  // Check each zone protection level
  const zones = ['Adonis', 'Penumbra', 'Inferno', 'Pandemonium'] as const;
  
  for (let i = 0; i < zones.length; i++) {
    const zoneFlag = 1 << i;
    if (isFlagSet(zoneProtection, zoneFlag)) {
      if (!isFlagSet(characterSLAccess, zoneFlag)) {
        return {
          allowed: false,
          reason: `Requires access to ${zones[i]}`
        };
      }
    }
  }
  
  return { allowed: true };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert flag value to binary string representation
 */
export function flagToBinaryString(flags: number): string {
  return flags.toString(2).padStart(32, '0');
}

/**
 * Convert flag value to hexadecimal string representation
 */
export function flagToHexString(flags: number): string {
  return '0x' + flags.toString(16).toUpperCase().padStart(8, '0');
}

/**
 * Create a human-readable description of all set flags
 */
export function describeFlagValue(
  flags: number, 
  flagEnum: Record<string, number>,
  flagTypeName: string = 'flags'
): string {
  const setFlags = getSetFlagNames(flags, flagEnum);
  
  if (setFlags.length === 0) {
    return `No ${flagTypeName} set`;
  }
  
  if (setFlags.length === 1) {
    return `${flagTypeName}: ${setFlags[0]}`;
  }
  
  return `${flagTypeName}: ${setFlags.join(', ')}`;
}

/**
 * Validate flag combinations for conflicts
 */
export function validateFlagCombination(
  flags: number,
  conflictingPairs: Array<[number, number]>
): { valid: boolean; conflicts: string[] } {
  const conflicts: string[] = [];
  
  for (const [flag1, flag2] of conflictingPairs) {
    if (isFlagSet(flags, flag1) && isFlagSet(flags, flag2)) {
      conflicts.push(`Conflicting flags: ${flag1} and ${flag2}`);
    }
  }
  
  return {
    valid: conflicts.length === 0,
    conflicts
  };
}

// ============================================================================
// Export utilities as a group
// ============================================================================

export const flagOperations = {
  // Core operations
  isFlagSet,
  setFlag,
  clearFlag,
  toggleFlag,
  hasAllFlags,
  hasAnyFlag,
  countSetBits,
  getSetFlags,
  getSetFlagNames,
  
  // Decoding functions
  decodeActionFlags,
  decodeItemFlags,
  decodeCanFlags,
  decodeNanoFlags,
  decodeExpansionFlags,
  decodeWeaponTypeFlags,
  decodeSlotFlags,
  
  // Permission checking
  canUseItem,
  checkFactionRestriction,
  checkExpansionRequirements,
  checkUniqueItemRestriction,
  canDropItem,
  nanoBreaksOnAttack,
  nanoBreaksOnDebuff,
  isNanoRemovable,
  
  // Action checking
  isActionAllowed,
  getRestrictedActions,
  canAccessBank,
  canMove,
  canAttack,
  canUseConcealment,
  
  // Zone restrictions
  canEnterSLZone,
  
  // Utilities
  flagToBinaryString,
  flagToHexString,
  describeFlagValue,
  validateFlagCombination
};
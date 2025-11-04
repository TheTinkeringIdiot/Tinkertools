/**
 * Skill Test Fixtures
 *
 * Provides skill ID constants and utilities for test data.
 * All skills are referenced by numeric IDs as per the v4.0.0 architecture.
 *
 * @see /frontend/src/lib/tinkerprofiles/skill-mappings.ts - Authoritative skill ID mappings
 */

// ============================================================================
// Ability IDs (16-21)
// ============================================================================

export const ABILITY_ID = {
  STRENGTH: 16,
  AGILITY: 17,
  STAMINA: 18,
  INTELLIGENCE: 19,
  SENSE: 20,
  PSYCHIC: 21,
} as const;

// ============================================================================
// Body & Defense Skills
// ============================================================================

export const BODY_DEFENSE_SKILL_ID = {
  BODY_DEV: 152,
  NANO_POOL: 132,
  MARTIAL_ARTS: 100,
  BRAWLING: 142,
  DIMACH: 144,
  RIPOSTE: 143,
  ADVENTURING: 137,
  SWIMMING: 138,
  DODGE_RNG: 154,
  EVADE_CLSC: 155,
  DUCK_EXP: 153,
  NANO_RESIST: 168,
  DEFLECT: 145,
} as const;

// ============================================================================
// Melee Weapons
// ============================================================================

export const MELEE_WEAPON_SKILL_ID = {
  '1H_BLUNT': 102,
  '1H_EDGED': 103,
  PIERCING: 106,
  '2H_BLUNT': 107,
  '2H_EDGED': 105,
  MELEE_ENERGY: 104,
  SNEAK_ATTACK: 146,
  MULTI_MELEE: 101,
} as const;

// ============================================================================
// Ranged Weapons
// ============================================================================

export const RANGED_WEAPON_SKILL_ID = {
  SHARP_OBJ: 108,
  GRENADE: 109,
  HEAVY_WEAPONS: 110,
  BOW: 111,
  PISTOL: 112,
  ASSAULT_RIF: 116,
  MG_SMG: 114,
  SHOTGUN: 115,
  RIFLE: 113,
  RANGED_ENERGY: 133,
} as const;

// ============================================================================
// Ranged Specials
// ============================================================================

export const RANGED_SPECIAL_SKILL_ID = {
  FLING_SHOT: 150,
  AIMED_SHOT: 151,
  BURST: 148,
  FULL_AUTO: 167,
  BOW_SPC_ATT: 121,
  MULTI_RANGED: 134,
} as const;

// ============================================================================
// Initiative Skills
// ============================================================================

export const INITIATIVE_SKILL_ID = {
  MELEE_INIT: 118,
  RANGED_INIT: 119,
  PHYSICAL_INIT: 120,
  NANOC_INIT: 149,
} as const;

// ============================================================================
// Trade & Repair Skills
// ============================================================================

export const TRADE_REPAIR_SKILL_ID = {
  MECH_ENG: 125,
  ELEC_ENG: 126,
  QUANTUM_FT: 157,
  WEAPON_SMITH: 158,
  PHARMA_TECH: 159,
  NANO_PROGRAMMING: 160,
  COMPUTER_LITERACY: 161,
  PSYCHOLOGY: 162,
  CHEMISTRY: 163,
  TUTORING: 141,
  MATT_METAM: 127,
  BIO_METAMOR: 128,
} as const;

// ============================================================================
// Nanos & Casting Skills
// ============================================================================

export const NANO_CASTING_SKILL_ID = {
  PSYCHO_MODI: 129,
  MATTER_CREATION: 130,
  TIME_SPACE: 131,
  SENSORY_IMPROVEMENT: 122,
} as const;

// ============================================================================
// Combat & Healing Skills
// ============================================================================

export const COMBAT_HEALING_SKILL_ID = {
  FIRST_AID: 123,
  TREATMENT: 124,
} as const;

// ============================================================================
// Exploring Skills
// ============================================================================

export const EXPLORING_SKILL_ID = {
  CONCEALMENT: 164,
  BREAK_ENTRY: 165,
  TRAP_DISARM: 135,
  PERCEPTION: 136,
  VEHICLE_AIR: 139,
  VEHICLE_GROUND: 166,
  VEHICLE_WATER: 117,
  MAP_NAVIGATION: 140,
  RUN_SPEED: 156,
} as const;

// ============================================================================
// AC (Armor Class) Stats
// ============================================================================

export const AC_STAT_ID = {
  CHEMICAL_AC: 93,
  COLD_AC: 95,
  ENERGY_AC: 92,
  FIRE_AC: 97,
  NANO_AC: 98,
  PROJECTILE_AC: 90,
  MELEE_AC: 91,
  RADIATION_AC: 94,
  POISON_AC: 96,

  // Reflect AC
  REFLECT_PROJECTILE_AC: 205,
  REFLECT_MELEE_AC: 206,
  REFLECT_ENERGY_AC: 207,
  REFLECT_CHEMICAL_AC: 208,
  REFLECT_RADIATION_AC: 216,
  REFLECT_COLD_AC: 217,
  REFLECT_NANO_AC: 218,
  REFLECT_FIRE_AC: 219,
  REFLECT_POISON_AC: 225,

  // Absorb AC
  ABSORB_PROJECTILE_AC: 238,
  ABSORB_MELEE_AC: 239,
  ABSORB_ENERGY_AC: 240,
  ABSORB_CHEMICAL_AC: 241,
  ABSORB_RADIATION_AC: 242,
  ABSORB_COLD_AC: 243,
  ABSORB_FIRE_AC: 244,
  ABSORB_POISON_AC: 245,
  ABSORB_NANO_AC: 246,

  // Shield AC
  SHIELD_PROJECTILE_AC: 226,
  SHIELD_MELEE_AC: 227,
  SHIELD_ENERGY_AC: 228,
  SHIELD_CHEMICAL_AC: 229,
  SHIELD_RADIATION_AC: 230,
  SHIELD_COLD_AC: 231,
  SHIELD_NANO_AC: 232,
  SHIELD_FIRE_AC: 233,
  SHIELD_POISON_AC: 234,
} as const;

// ============================================================================
// Misc Skills (Damage Modifiers and Combat Bonuses)
// ============================================================================

export const MISC_SKILL_ID = {
  MAX_HEALTH: 1, // MaxHealth stat
  MAX_NANO: 221, // MaxNanoEnergy stat
  MAX_NCU: 181, // MaxNCU
  ADD_ALL_OFF: 276, // AddAllOffense
  ADD_ALL_DEF: 277, // AddAllDefense
  ADD_PROJ_DAM: 278, // ProjectileDamageModifier
  ADD_MELEE_DAM: 279, // MeleeDamageModifier
  ADD_ENERGY_DAM: 280, // EnergyDamageModifier
  ADD_CHEM_DAM: 281, // ChemicalDamageModifier
  ADD_RAD_DAM: 282, // RadiationDamageModifier
  ADD_COLD_DAM: 311, // ColdDamageModifier
  ADD_FIRE_DAM: 316, // FireDamageModifier
  ADD_POISON_DAM: 317, // PoisonDamageModifier
  ADD_NANO_DAM: 315, // NanoDamageModifier
  PERCENT_ADD_XP: 319, // XPModifier
  PERCENT_ADD_NANO_COST: 318, // NanoCost modifier
  NANO_INTERRUPT_MOD: 383, // NanoInterruptModifier
  SKILL_LOCK_MOD: 382, // SkillLockModifier
  HEAL_DELTA: 343, // HealDelta
  NANO_DELTA: 364, // NanoDelta
  RANGE_INC_NF: 381, // NanoRange
  RANGE_INC_WEAPON: 287, // AttackRange
  CRITICAL_INCREASE: 379, // CriticalIncrease
  BELT_SLOTS: 45, // BeltSlots
  FREE_DECK_SLOT: 428, // Deck slots
  HEALING_EFFICIENCY: 535, // HealMultiplier
  NANO_DAM_EFFICIENCY: 536, // NanoDamageMultiplier
  EXPANSION: 389, // Expansion bitflag
  SCALE: 360, // Scale
  WORN_ITEM: 355, // WornItem equipment flags
} as const;

// ============================================================================
// Combined Skill ID Mapping (All Skills)
// ============================================================================

export const SKILL_ID = {
  ...ABILITY_ID,
  ...BODY_DEFENSE_SKILL_ID,
  ...MELEE_WEAPON_SKILL_ID,
  ...RANGED_WEAPON_SKILL_ID,
  ...RANGED_SPECIAL_SKILL_ID,
  ...INITIATIVE_SKILL_ID,
  ...TRADE_REPAIR_SKILL_ID,
  ...NANO_CASTING_SKILL_ID,
  ...COMBAT_HEALING_SKILL_ID,
  ...EXPLORING_SKILL_ID,
  ...AC_STAT_ID,
  ...MISC_SKILL_ID,
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a test skill bonus object using skill IDs
 *
 * @example
 * const bonuses = createSkillBonuses([
 *   [SKILL_ID.ASSAULT_RIF, 10],
 *   [SKILL_ID.DODGE_RNG, 5]
 * ]);
 * // Result: { 116: 10, 154: 5 }
 */
export function createSkillBonuses(entries: Array<[number, number]>): Record<number, number> {
  return Object.fromEntries(entries);
}

/**
 * Create a complete SkillData object for testing
 *
 * @example
 * const skill = createTestSkillData({
 *   base: 5,
 *   trickle: 100,
 *   ipSpent: 5000,
 *   pointsFromIp: 250,
 *   equipmentBonus: 50
 * });
 */
export interface SkillData {
  base: number;
  trickle: number;
  ipSpent: number;
  pointsFromIp: number;
  equipmentBonus: number;
  perkBonus: number;
  buffBonus: number;
  total: number;
}

export function createTestSkillData(overrides: Partial<SkillData> = {}): SkillData {
  const defaults: SkillData = {
    base: 5,
    trickle: 0,
    ipSpent: 0,
    pointsFromIp: 0,
    equipmentBonus: 0,
    perkBonus: 0,
    buffBonus: 0,
    total: 5,
  };

  const merged = { ...defaults, ...overrides };

  // Recalculate total if not explicitly provided
  if (!overrides.total) {
    merged.total =
      merged.base +
      merged.trickle +
      merged.pointsFromIp +
      merged.equipmentBonus +
      merged.perkBonus +
      merged.buffBonus;
  }

  return merged;
}

/**
 * Common skill combinations for testing
 */
export const SKILL_COMBOS = {
  /** Combat-focused skill set */
  COMBAT: createSkillBonuses([
    [SKILL_ID.ASSAULT_RIF, 50],
    [SKILL_ID.RANGED_INIT, 30],
    [SKILL_ID.AIMED_SHOT, 20],
    [SKILL_ID.ADD_PROJ_DAM, 100],
  ]),

  /** Defense-focused skill set */
  DEFENSE: createSkillBonuses([
    [SKILL_ID.DODGE_RNG, 50],
    [SKILL_ID.EVADE_CLSC, 40],
    [SKILL_ID.PROJECTILE_AC, 500],
    [SKILL_ID.ENERGY_AC, 400],
  ]),

  /** Nano-focused skill set */
  NANO: createSkillBonuses([
    [SKILL_ID.NANO_POOL, 200],
    [SKILL_ID.MATTER_CREATION, 100],
    [SKILL_ID.TIME_SPACE, 100],
    [SKILL_ID.NANOC_INIT, 50],
  ]),

  /** Trade skill set */
  TRADE: createSkillBonuses([
    [SKILL_ID.COMPUTER_LITERACY, 150],
    [SKILL_ID.NANO_PROGRAMMING, 100],
    [SKILL_ID.MECH_ENG, 80],
    [SKILL_ID.ELEC_ENG, 80],
  ]),

  /** Empty bonuses (no equipment) */
  EMPTY: {},
} as const;

/**
 * Type guard for skill ID validation
 */
export function isValidSkillId(id: number): boolean {
  return Object.values(SKILL_ID).includes(id as any);
}

/**
 * Get skill name for display in test output (for debugging)
 * Note: This is for test debugging only. Production code uses getSkillName() from skill-mappings.ts
 */
export function getTestSkillName(skillId: number): string {
  const entry = Object.entries(SKILL_ID).find(([_, id]) => id === skillId);
  return entry ? entry[0] : `Unknown Skill ${skillId}`;
}

/**
 * Offensive Nano Type Definitions for TinkerNukes
 *
 * Defines TypeScript interfaces for TinkerNukes offensive nanoprograms,
 * damage calculations, efficiency metrics, and manual input state.
 *
 * References:
 * - FR-1, FR-2: Offensive nano identification and filtering
 * - FR-4: Manual input field structure (27 fields)
 * - FR-5: Damage calculation pipeline
 * - FR-6: Display metrics (13 table columns)
 * - FR-7: Nano regen calculations
 * - FR-8: Buff lookup tables
 */

import type { NanoProgram } from './nano'
import type { Item } from './api'

// ============================================================================
// Core Offensive Nano Types
// ============================================================================

/**
 * Offensive Nano Program extending base NanoProgram
 * Includes damage-specific fields for calculation and display
 */
export interface OffensiveNano extends NanoProgram {
  /** Full item object with actions and criteria for requirement validation */
  item: Item

  /** Minimum damage value (after all modifiers, AC reduction, and tick count) */
  minDamage: number

  /** Maximum damage value (after all modifiers, AC reduction, and tick count) */
  maxDamage: number

  /** Midpoint damage value: (minDamage + maxDamage) / 2 */
  midDamage: number

  /** Damage type identifier mapped from spell modifier_stat (90-97) */
  damageType: DamageType

  /** Number of damage ticks (DoT mechanics). 1 for instant damage, >1 for DoT */
  tickCount: number

  /** Interval between damage ticks in centiseconds. Only relevant if tickCount > 1 */
  tickInterval: number

  /** Cast time in centiseconds from AttackDelay (stat 294) */
  castTime: number

  /** Recharge time in centiseconds from RechargeDelay (stat 210) */
  rechargeTime: number

  /** Attack delay cap in centiseconds from stat 523 (minimum cast time after init reduction) */
  attackDelayCap?: number

  /** Recharge delay cap in centiseconds from stat 524 (minimum recharge time after init reduction) */
  rechargeDelayCap?: number

  /** Base nano point cost from stat 407 (NanoPoint) */
  nanoPointCost: number
}

/**
 * Damage type enum mapped from spell modifier_stat values
 * Used to select appropriate damage modifier from character stats
 */
export type DamageType =
  | 'projectile'  // ModifierStat 90 → stat 278
  | 'melee'       // ModifierStat 91 → stat 279
  | 'energy'      // ModifierStat 92 → stat 280
  | 'chemical'    // ModifierStat 93 → stat 281
  | 'radiation'   // ModifierStat 94 → stat 282
  | 'cold'        // ModifierStat 95 → stat 311
  | 'poison'      // ModifierStat 96 → stat 317
  | 'fire'        // ModifierStat 97 → stat 316

// ============================================================================
// Damage Modifier Types
// ============================================================================

/**
 * Damage modifier stats applied to offensive nanoprograms
 * All values are numeric percentages or absolute values
 *
 * Type-specific modifiers (stats 278-282, 311, 315-317):
 * - Applied based on spell's damage type (modifier_stat)
 * - Added to base spell damage before DNDE calculation
 *
 * Direct Nano Damage Efficiency (stat 536):
 * - Applied as percentage multiplier: damage * (1 + stat536/100)
 * - Auto-calculated from Enhance Nano Damage + Ancient Matrix buffs
 * - Can be manually overridden by user
 */
export interface DamageModifiers {
  /** Projectile Damage Modifier (stat 278) */
  projectile: number

  /** Melee Damage Modifier (stat 279) */
  melee: number

  /** Energy Damage Modifier (stat 280) */
  energy: number

  /** Chemical Damage Modifier (stat 281) */
  chemical: number

  /** Radiation Damage Modifier (stat 282) */
  radiation: number

  /** Cold Damage Modifier (stat 311) */
  cold: number

  /** Nano Damage Modifier (stat 315) */
  nano: number

  /** Fire Damage Modifier (stat 316) */
  fire: number

  /** Poison Damage Modifier (stat 317) */
  poison: number

  /** Direct Nano Damage Efficiency (stat 536) - percentage modifier */
  directNanoDamageEfficiency: number

  /** Target's Armor Class (used for damage reduction: damage - AC/10) */
  targetAC: number
}

// ============================================================================
// Casting and Performance Metrics
// ============================================================================

/**
 * Casting time and nano cost statistics
 * All time values converted to seconds for display
 */
export interface CastingStats {
  /** Modified cast time in seconds (after Nano Init reduction) */
  castTime: number

  /** Modified recharge time in seconds (after Nano Init reduction) */
  rechargeTime: number

  /** Modified nano cost (after Crunchcom cost reduction and breed cap) */
  nanoCost: number

  /** Base cast time in centiseconds (raw from spell data) */
  baseCastTime: number

  /** Base recharge time in centiseconds (raw from spell data) */
  baseRechargeTime: number

  /** Base nano cost (raw from spell data, before modifiers) */
  baseNanoCost: number
}

/**
 * Efficiency and sustainability metrics for offensive nanoprograms
 * Used to compare damage output, nano efficiency, and combat sustainability
 */
export interface EfficiencyMetrics {
  /** Damage Per Second: midDamage / (castTime + rechargeTime + dotDuration) */
  dps: number

  /** Damage per nano point spent: midDamage / nanoCost */
  damagePerNano: number

  /** Time until nano pool is empty (seconds). Infinity (∞) if sustainable */
  sustainTime: number | typeof Infinity

  /** Number of casts until nano pool is empty. Infinity (∞) if sustainable */
  castsToEmpty: number | typeof Infinity

  /** Nano points consumed per second: nanoCost / (castTime + rechargeTime) */
  nanoPerSecond: number

  /** Nano points regenerated per second (from buffs + base regen) */
  regenPerSecond: number

  /** Whether nano regeneration can sustain continuous casting */
  isSustainable: boolean
}

// ============================================================================
// Manual Input State (28 Fields)
// ============================================================================

/**
 * Character statistics for offensive nano calculations
 * All fields are manually editable and can auto-populate from TinkerProfiles
 *
 * Total: 12 fields
 */
export interface CharacterStats {
  /** Character breed (1=Solitus, 2=Opifex, 3=Nanomage, 4=Atrox) */
  breed: 1 | 2 | 3 | 4

  /** Character level */
  level: number

  /** Psychic ability (affects nano regen tick speed) */
  psychic: number

  /** Nano Init skill (reduces cast time and recharge time) */
  nanoInit: number

  /** Max Nano skill (total nano pool size) */
  maxNano: number

  /** Nano Delta skill (base nano regeneration) */
  nanoDelta: number

  /** Matter Creation skill (skill ID 126) */
  matterCreation: number

  /** Matter Metamorphosis skill (skill ID 127) */
  matterMeta: number

  /** Biological Metamorphosis skill (skill ID 128) */
  bioMeta: number

  /** Psychological Modifications skill (skill ID 129) */
  psychModi: number

  /** Sensory Improvement skill (skill ID 130) */
  sensoryImp: number

  /** Time and Space skill (skill ID 131) */
  timeSpace: number

  /** Specialization level (stat ID 182, bitflags: 0, 1, 2, 4, 8) */
  spec: number
}

/**
 * Buff preset levels for offensive nano calculations
 * All buffs stored as numeric level IDs (0-10)
 * Lookup tables convert level to effect values
 *
 * Total: 6 fields
 */
export interface BuffPresets {
  /** Crunchcom level (0-7): Nano cost reduction % */
  crunchcom: number

  /** Humidity level (0-7): Nano regen per second */
  humidity: number

  /** Notum Siphon level (0-10): Nano regen per second */
  notumSiphon: number

  /** Channeling of Notum level (0-4): Nano regen per second */
  channeling: number

  /** Enhance Nano Damage level (0-6): Direct Nano Damage Efficiency % */
  enhanceNanoDamage: number

  /** Ancient Matrix level (0-10): Direct Nano Damage Efficiency % */
  ancientMatrix: number
}

/**
 * Complete manual input state for TinkerNukes
 * Consolidates all 28 manual input fields organized by category
 *
 * Used for:
 * - Auto-population from active TinkerProfile
 * - Manual theory-crafting overrides
 * - Real-time calculation updates
 * - Profile switching and reset operations
 */
export interface NukeInputState {
  /** Character stats (12 fields) */
  characterStats: CharacterStats

  /** Damage modifiers (11 fields) */
  damageModifiers: DamageModifiers

  /** Buff presets (6 fields) */
  buffPresets: BuffPresets
}

// ============================================================================
// Calculation Input/Output Types
// ============================================================================

/**
 * Input parameters for damage calculation
 * Used by damage calculation utilities (Task 2.1)
 */
export interface DamageCalculationInput {
  /** Base spell damage (MinValue or MaxValue from spell_params) */
  spellDamage: number

  /** Type-specific modifier (from damageModifiers based on damage type) */
  typeModifier: number

  /** Nano damage modifier (stat 315) */
  nanoModifier: number

  /** Direct Nano Damage Efficiency percentage (stat 536) */
  stat536: number

  /** Target's Armor Class (for damage reduction) */
  targetAC: number

  /** Spell's minimum damage value (floor for AC reduction) */
  minValue: number

  /** Tick count for DoT nanoprograms (multiplier applied after all modifiers) */
  tickCount: number
}

/**
 * Input parameters for cast time calculation
 * Used by casting calculation utilities (Task 2.2)
 */
export interface CastTimeCalculationInput {
  /** Base cast time in centiseconds (from spell data) */
  baseCastTime: number

  /** Base recharge time in centiseconds (from spell data) */
  baseRechargeTime: number

  /** Nano Init skill value (two-tier scaling reduction) */
  nanoInit: number
}

/**
 * Input parameters for nano cost calculation
 * Used by casting calculation utilities (Task 2.2)
 */
export interface NanoCostCalculationInput {
  /** Base nano cost (from spell data) */
  baseCost: number

  /** Cost reduction percentage from Crunchcom buff (0-28%) */
  costReductionPct: number

  /** Character breed (determines cost reduction cap) */
  breed: 1 | 2 | 3 | 4
}

/**
 * Input parameters for nano regen calculation
 * Used by regen calculation utilities (Task 2.3)
 */
export interface NanoRegenCalculationInput {
  /** Psychic ability (affects tick speed) */
  psychic: number

  /** Character breed (determines base nano delta) */
  breed: 1 | 2 | 3 | 4

  /** Nano Delta skill value */
  nanoDelta: number

  /** Active buff presets (for regen lookup) */
  buffs: BuffPresets
}

/**
 * Input parameters for DPS and efficiency calculation
 * Used by efficiency calculation utilities (Task 2.4)
 */
export interface EfficiencyCalculationInput {
  /** Mid damage value (from damage calculation) */
  midDamage: number

  /** Modified cast time in seconds */
  castTime: number

  /** Modified recharge time in seconds */
  rechargeTime: number

  /** Modified nano cost */
  modifiedNanoCost: number

  /** Tick count (for DoT duration in DPS calculation) */
  tickCount: number

  /** Tick interval in centiseconds (for DoT duration) */
  tickInterval: number

  /** Max nano pool size */
  maxNano: number

  /** Nano regeneration per second */
  regenPerSecond: number
}

// ============================================================================
// Field Modification Tracking
// ============================================================================

/**
 * Tracks which fields have been manually modified by user
 * Prevents auto-update of user-edited fields on profile change
 * Cleared on reset or profile switch
 */
export interface FieldModificationState {
  /** Set of field keys that have been manually edited */
  modifiedFields: Set<string>

  /** Flag to indicate programmatic update (bypass modification tracking) */
  isProgrammaticUpdate: boolean
}

// ============================================================================
// Filtering and Usability Types
// ============================================================================

/**
 * Usability status for a nano based on character skill requirements
 * Used for visual indicators and filtering
 */
export type UsabilityStatus =
  | 'usable'    // All requirements met
  | 'close'     // Within 100 points of requirements
  | 'far'       // More than 100 points from requirements

/**
 * Nano filtering criteria for TinkerNukes table
 * Applied in addition to profession and offensive spell filters
 */
export interface NanoFilterCriteria {
  /** Filter by nano school (skill ID: 126-131) */
  schoolId?: number | null

  /** Filter by QL range */
  minQL?: number
  maxQL?: number

  /** Search by nano name (case-insensitive) */
  searchQuery?: string

  /** Filter by usability status */
  usabilityStatus?: UsabilityStatus | null

  /** Only show nanoprograms with specific damage type */
  damageType?: DamageType | null
}

// ============================================================================
// Display Formatting Types
// ============================================================================

/**
 * Formatted values for table display
 * All numeric values converted to display-ready strings
 */
export interface FormattedNanoMetrics {
  /** Nano name (clickable link) */
  name: string

  /** Quality Level */
  ql: number

  /** Cast time in seconds (2 decimal places) */
  castTime: string

  /** Recharge time in seconds (2 decimal places) */
  rechargeTime: string

  /** Minimum damage (integer) */
  minDamage: string

  /** Mid damage (integer) */
  midDamage: string

  /** Maximum damage (integer) */
  maxDamage: string

  /** Nano cost (integer) */
  nanoCost: string

  /** Damage per nano (2 decimal places) */
  damagePerNano: string

  /** Damage per cast (same as midDamage) */
  damagePerCast: string

  /** DPS (2 decimal places) */
  dps: string

  /** Sustain time ("XXm YYs", "XXs", or "∞") */
  sustainTime: string

  /** Casts to empty (integer or "∞") */
  castsToEmpty: string
}

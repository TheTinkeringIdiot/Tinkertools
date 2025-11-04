/**
 * TinkerNukes Damage Calculation Utilities
 *
 * Pure functions for calculating offensive nano damage using a 4-tier pipeline:
 * 1. Base damage + type-specific modifiers + nano damage modifier
 * 2. Apply Direct Nano Damage Efficiency (stat 536)
 * 3. Apply target AC reduction
 * 4. Floor to MinValue
 *
 * For DoT (Damage over Time) nanos, damage is multiplied by tick_count AFTER
 * all modifiers are applied.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Damage modifiers for all damage types and nano efficiency
 */
export interface DamageModifiers {
  // Type-specific damage modifiers (stats 278-282, 311, 315-317)
  projectileDamage: number; // stat 278
  meleeDamage: number; // stat 279
  energyDamage: number; // stat 280
  chemicalDamage: number; // stat 281
  radiationDamage: number; // stat 282
  coldDamage: number; // stat 311
  nanoDamage: number; // stat 315
  fireDamage: number; // stat 316
  poisonDamage: number; // stat 317

  // Direct Nano Damage Efficiency (stat 536)
  directNanoDamageEfficiency: number; // stat 536 (percentage)
}

/**
 * Spell with damage parameters
 */
export interface SpellDamage {
  minValue: number;
  maxValue: number;
  modifierStat: number; // Maps to damage type (90-97)
  tickCount?: number; // For DoT spells
}

/**
 * Mapping of ModifierStat values to damage type stat IDs
 */
export const DAMAGE_TYPE_MAP: Record<number, number> = {
  90: 278, // Projectile
  91: 279, // Melee
  92: 280, // Energy
  93: 281, // Chemical
  94: 282, // Radiation
  95: 311, // Cold
  96: 317, // Poison
  97: 316, // Fire
};

/**
 * Reverse mapping: stat ID to modifier stat
 */
export const STAT_TO_MODIFIER_STAT: Record<number, number> = {
  278: 90, // Projectile
  279: 91, // Melee
  280: 92, // Energy
  281: 93, // Chemical
  282: 94, // Radiation
  311: 95, // Cold
  317: 96, // Poison
  316: 97, // Fire
};

/**
 * Human-readable damage type names
 */
export const DAMAGE_TYPE_NAMES: Record<number, string> = {
  90: 'Projectile',
  91: 'Melee',
  92: 'Energy',
  93: 'Chemical',
  94: 'Radiation',
  95: 'Cold',
  96: 'Poison',
  97: 'Fire',
};

// ============================================================================
// Core Damage Calculation Functions
// ============================================================================

/**
 * Parse damage type from modifier_stat field
 *
 * @param modifierStat - The modifier_stat value from spell_params (90-97)
 * @returns The corresponding stat ID (278-282, 311, 315-317)
 */
export function parseDamageType(modifierStat: number): number {
  const statId = DAMAGE_TYPE_MAP[modifierStat];
  if (!statId) {
    console.warn(`Unknown modifier_stat: ${modifierStat}, defaulting to nano damage (315)`);
    return 315; // Default to nano damage
  }
  return statId;
}

/**
 * Get the type-specific damage modifier value from DamageModifiers object
 *
 * @param damageTypeStatId - The stat ID for the damage type (278-282, 311, 315-317)
 * @param modifiers - The DamageModifiers object containing all modifier values
 * @returns The modifier value for the specified damage type
 */
export function getTypeModifier(damageTypeStatId: number, modifiers: DamageModifiers): number {
  switch (damageTypeStatId) {
    case 278:
      return modifiers.projectileDamage;
    case 279:
      return modifiers.meleeDamage;
    case 280:
      return modifiers.energyDamage;
    case 281:
      return modifiers.chemicalDamage;
    case 282:
      return modifiers.radiationDamage;
    case 311:
      return modifiers.coldDamage;
    case 315:
      return modifiers.nanoDamage;
    case 316:
      return modifiers.fireDamage;
    case 317:
      return modifiers.poisonDamage;
    default:
      console.warn(`Unknown damage type stat ID: ${damageTypeStatId}`);
      return 0;
  }
}

/**
 * Calculate damage using the 4-tier pipeline
 *
 * Pipeline:
 * 1. Base damage + type modifier + nano modifier
 * 2. Apply Direct Nano Damage Efficiency (DNDE)
 * 3. Apply target AC reduction
 * 4. Floor to MinValue
 *
 * @param spellDamage - Base spell damage (use absolute value)
 * @param typeModifier - Type-specific damage modifier (e.g., Projectile, Fire)
 * @param nanoModifier - General nano damage modifier (stat 315)
 * @param stat536 - Direct Nano Damage Efficiency percentage (stat 536)
 * @param targetAC - Target's armor class (defaults to 0)
 * @param minValue - Minimum damage floor (from spell MinValue)
 * @returns Final calculated damage
 */
export function calculateDamage(
  spellDamage: number,
  typeModifier: number,
  nanoModifier: number,
  stat536: number,
  targetAC: number = 0,
  minValue: number = 0
): number {
  // Tier 1: Base damage + modifiers
  const modifiedDamage = spellDamage + typeModifier + nanoModifier;

  // Tier 2: Apply Direct Nano Damage Efficiency (DNDE)
  // stat536 is a percentage, so divide by 100
  const dndeMultiplier = 1 + stat536 / 100;
  const nanoEnhancedDamage = modifiedDamage * dndeMultiplier;

  // Tier 3: Apply target AC reduction
  // AC reduces damage by AC / 10, floored
  const acReduction = Math.floor(targetAC / 10);
  const acReducedDamage = nanoEnhancedDamage - acReduction;

  // Tier 4: Floor to MinValue (damage cannot go below minimum)
  const finalDamage = Math.max(acReducedDamage, minValue);

  return finalDamage;
}

/**
 * Calculate total damage for DoT (Damage over Time) spells
 *
 * For DoT spells, damage is calculated per tick using the full pipeline,
 * then multiplied by tick_count to get total damage.
 *
 * @param perTickDamage - Damage per tick (after full pipeline)
 * @param tickCount - Number of ticks
 * @returns Total damage across all ticks
 */
export function calculateDoTDamage(perTickDamage: number, tickCount: number): number {
  return perTickDamage * tickCount;
}

/**
 * Calculate modified damage for a spell with all modifiers applied
 *
 * This function orchestrates the full damage calculation for a single spell,
 * including damage type identification and modifier application.
 *
 * @param spell - Spell damage parameters (minValue, maxValue, modifierStat)
 * @param modifiers - All damage modifiers
 * @param targetAC - Target's armor class
 * @returns Object with min, mid, and max damage values
 */
export function calculateModifiedDamage(
  spell: SpellDamage,
  modifiers: DamageModifiers,
  targetAC: number = 0
): { min: number; mid: number; max: number } {
  // Extract damage type from modifier_stat
  const damageTypeStatId = parseDamageType(spell.modifierStat);

  // Get type-specific modifier
  const typeModifier = getTypeModifier(damageTypeStatId, modifiers);

  // Get nano damage modifier (always applies in addition to type modifier)
  const nanoModifier = modifiers.nanoDamage;

  // Get DNDE value (stat 536)
  const stat536 = modifiers.directNanoDamageEfficiency;

  // Use absolute values for damage (database stores as negative for offensive)
  const absMinValue = Math.abs(spell.minValue);
  const absMaxValue = Math.abs(spell.maxValue);

  // Calculate min damage
  const minDamage = calculateDamage(
    absMinValue,
    typeModifier,
    nanoModifier,
    stat536,
    targetAC,
    absMinValue
  );

  // Calculate max damage
  const maxDamage = calculateDamage(
    absMaxValue,
    typeModifier,
    nanoModifier,
    stat536,
    targetAC,
    absMinValue // Max damage also floors to MinValue
  );

  // Calculate mid damage (midpoint between min and max)
  const midDamage = (minDamage + maxDamage) / 2;

  return {
    min: minDamage,
    mid: midDamage,
    max: maxDamage,
  };
}

/**
 * Calculate total damage for a nano with potentially multiple damaging spells
 *
 * @param spells - Array of spells on the nano
 * @param modifiers - All damage modifiers
 * @param targetAC - Target's armor class
 * @returns Object with total min, mid, and max damage, plus DoT flag
 */
export function calculateNanoDamage(
  spells: SpellDamage[],
  modifiers: DamageModifiers,
  targetAC: number = 0
): { min: number; mid: number; max: number; isDoT: boolean; totalTickCount: number } {
  let totalMin = 0;
  let totalMid = 0;
  let totalMax = 0;
  let totalTickCount = 0;
  let isDoT = false;

  for (const spell of spells) {
    const damage = calculateModifiedDamage(spell, modifiers, targetAC);

    // Check if this is a DoT spell (tick_count > 1)
    if (spell.tickCount && spell.tickCount > 1) {
      isDoT = true;
      totalTickCount += spell.tickCount;

      // Multiply damage by tick count for DoT
      totalMin += calculateDoTDamage(damage.min, spell.tickCount);
      totalMid += calculateDoTDamage(damage.mid, spell.tickCount);
      totalMax += calculateDoTDamage(damage.max, spell.tickCount);
    } else {
      // Instant damage (tick_count = 1 or null)
      totalMin += damage.min;
      totalMid += damage.mid;
      totalMax += damage.max;
    }
  }

  return {
    min: totalMin,
    mid: totalMid,
    max: totalMax,
    isDoT,
    totalTickCount,
  };
}

// ============================================================================
// Display Formatting Utilities
// ============================================================================

/**
 * Format damage value for display
 *
 * @param damage - Damage value
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted damage string
 */
export function formatDamage(damage: number, decimals: number = 2): string {
  return damage.toFixed(decimals);
}

/**
 * Format damage range for display
 *
 * @param min - Minimum damage
 * @param max - Maximum damage
 * @returns Formatted damage range string (e.g., "500-750")
 */
export function formatDamageRange(min: number, max: number): string {
  return `${Math.round(min)}-${Math.round(max)}`;
}

/**
 * Get damage type name from modifier_stat
 *
 * @param modifierStat - The modifier_stat value (90-97)
 * @returns Human-readable damage type name
 */
export function getDamageTypeName(modifierStat: number): string {
  return DAMAGE_TYPE_NAMES[modifierStat] || 'Unknown';
}

// ============================================================================
// Export utilities as a group
// ============================================================================

export const nukeDamageCalculations = {
  parseDamageType,
  getTypeModifier,
  calculateDamage,
  calculateDoTDamage,
  calculateModifiedDamage,
  calculateNanoDamage,
  formatDamage,
  formatDamageRange,
  getDamageTypeName,
};

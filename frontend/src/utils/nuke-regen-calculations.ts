/**
 * TinkerNukes - Nano Regeneration and Sustain Calculations
 *
 * Pure functions for calculating nano regen, tick speeds, and sustainability metrics.
 * See: .docs/plans/tinkernukes/requirements.md (FR-7, FR-8)
 *      .docs/plans/tinkernukes/damage-calculations.docs.md (lines 263-331)
 */

/**
 * Crunchcom - Nano Cost Reduction Percentage
 * Levels 0-7
 */
export const CRUNCHCOM_COST_REDUCTION: Record<number, number> = {
  0: 0,
  1: 4, // CrunchCom Code Sieve
  2: 8, // Run-Time Recompiler
  3: 12, // CrunchCom Nano Compressor
  4: 16, // On-The-Fly Compression
  5: 20, // CrunchCom Nano Compressor Pro
  6: 24, // Jobe Nano Libraries
  7: 28, // Izgimmer's Obfuscated Recompiler
};

/**
 * Crunchcom - AOID mapping for buff auto-population
 * Maps dropdown level (1-7) to nano program AOID
 */
export const CRUNCHCOM_AOID_MAP: Record<number, number> = {
  1: 95407, // CrunchCom Code Sieve (4%)
  2: 95416, // Run-Time Recompiler (8%)
  3: 95415, // CrunchCom Nano Compressor (12%)
  4: 95414, // On-The-Fly Compression (16%)
  5: 95412, // CrunchCom Nano Compressor Pro (20%)
  6: 95413, // Jobe Nano Libraries (24%)
  7: 95417, // Izgimmer's Obfuscated Recompiler (28%)
};

/**
 * Crunchcom - Nano names for display
 * Maps dropdown level (1-7) to nano program name
 */
export const CRUNCHCOM_NAMES: Record<number, string> = {
  1: 'CrunchCom Code Sieve',
  2: 'Run-Time Recompiler',
  3: 'CrunchCom Nano Compressor',
  4: 'On-The-Fly Compression',
  5: 'CrunchCom Nano Compressor Pro',
  6: 'Jobe Nano Libraries',
  7: "Izgimmer's Obfuscated Recompiler",
};

/**
 * Humidity Extractor - Nano Regen per Second
 * Levels 0-7
 */
export const HUMIDITY_REGEN: Record<number, number> = {
  0: 0,
  1: 1.5, // Rudimentary Humidity Extractor
  2: 3.33, // Basic Humidity Extractor
  3: 5.17, // Humidity Extractor
  4: 7.0, // Efficient Humidity Extractor
  5: 10.5, // Superior Humidity Extractor
  6: 13.09, // Boundless Humidity Extractor
  7: 15.67, // Personal Notum Harvester
};

/**
 * Humidity - AOID mapping for buff auto-population
 * Maps dropdown level (1-7) to nano program AOID
 */
export const HUMIDITY_AOID_MAP: Record<number, number> = {
  1: 90400, // Rudimentary Humidity Extractor
  2: 90405, // Basic Humidity Extractor
  3: 90404, // Humidity Extractor
  4: 90403, // Efficient Humidity Extractor
  5: 90402, // Superior Humidity Extractor
  6: 90401, // Boundless Humidity Extractor
  7: 90406, // Personal Notum Harvester
};

/**
 * Humidity - Nano names for display
 * Maps dropdown level (1-7) to nano program name
 */
export const HUMIDITY_NAMES: Record<number, string> = {
  1: 'Rudimentary Humidity Extractor',
  2: 'Basic Humidity Extractor',
  3: 'Humidity Extractor',
  4: 'Efficient Humidity Extractor',
  5: 'Superior Humidity Extractor',
  6: 'Boundless Humidity Extractor',
  7: 'Personal Notum Harvester',
};

/**
 * Notum Siphon - Nano Regen per Second
 * Levels 0-10
 */
export const NOTUM_SIPHON_REGEN: Record<number, number> = {
  0: 0,
  1: 8.34,
  2: 16.67,
  3: 25.0,
  4: 33.34,
  5: 41.67,
  6: 50.0,
  7: 58.34,
  8: 66.67,
  9: 75.0,
  10: 83.34,
};

/**
 * Channeling of Notum - Nano Regen per Second
 * Levels 0-4
 */
export const CHANNELING_REGEN: Record<number, number> = {
  0: 0,
  1: 5.15,
  2: 10.3,
  3: 12.875,
  4: 15.45,
};

/**
 * Enhance Nano Damage - Direct Nano Damage Efficiency Percentage
 * Levels 0-6
 */
export const ENHANCE_NANO_DAMAGE: Record<number, number> = {
  0: 0,
  1: 3,
  2: 6,
  3: 9,
  4: 12,
  5: 15,
  6: 18,
};

/**
 * Ancient Matrix - Direct Nano Damage Efficiency Percentage
 * Levels 0-10
 */
export const ANCIENT_MATRIX_DAMAGE: Record<number, number> = {
  0: 0,
  1: 0.33,
  2: 0.67,
  3: 1,
  4: 1.33,
  5: 1.67,
  6: 2,
  7: 2.33,
  8: 2.67,
  9: 2.83,
  10: 3,
};

/**
 * Nano regeneration buffs interface for parameter passing
 */
export interface NanoRegenBuffs {
  humidity: number;
  notumSiphon: number;
  channeling: number;
}

/**
 * Calculate nano tick speed (seconds between ticks)
 * Formula: 28 - floor((psychic - 1) / 60) * 2
 *
 * @param psychic - Character's Psychic stat
 * @returns Tick speed in seconds
 */
export function calculateTickSpeed(psychic: number): number {
  return 28 - Math.floor((psychic - 1) / 60) * 2;
}

/**
 * Calculate base nano delta per tick
 * Formula: breed_base + manual_nano_delta
 *
 * Breed base values:
 * - Solitus (ID 1): 3
 * - Opifex (ID 2): 3
 * - Nanomage (ID 3): 4
 * - Atrox (ID 4): 2
 *
 * @param breed - Breed ID (1-4)
 * @param nanoDelta - Manual nano delta adjustment
 * @returns Base nano delta per tick
 */
export function calculateBaseDelta(breed: number, nanoDelta: number): number {
  let breedBase = 3; // Default to Solitus/Opifex

  if (breed === 3) {
    breedBase = 4; // Nanomage
  } else if (breed === 4) {
    breedBase = 2; // Atrox
  }

  return breedBase + nanoDelta;
}

/**
 * Calculate total nano regeneration per second
 * Formula: buff_regen + (base_delta / tick_speed)
 *
 * @param psychic - Character's Psychic stat
 * @param breed - Breed ID (1-4)
 * @param nanoDelta - Manual nano delta adjustment
 * @param buffs - Active nano regen buffs (levels)
 * @returns Nano regeneration per second
 */
export function calculateNanoRegen(
  psychic: number,
  breed: number,
  nanoDelta: number,
  buffs: NanoRegenBuffs
): number {
  // Sum buff-based regen
  const buffRegen =
    HUMIDITY_REGEN[buffs.humidity] +
    NOTUM_SIPHON_REGEN[buffs.notumSiphon] +
    CHANNELING_REGEN[buffs.channeling];

  // Calculate base delta contribution
  const baseDelta = calculateBaseDelta(breed, nanoDelta);
  const tickSpeed = calculateTickSpeed(psychic);
  const deltaRegen = baseDelta / tickSpeed;

  return buffRegen + deltaRegen;
}

/**
 * Calculate time until out of nano (sustain time)
 * Returns Infinity if sustainable (regen >= consumption), else seconds until empty
 *
 * @param maxNano - Maximum nano pool
 * @param nanoPerSecond - Nano consumption per second
 * @param regenPerSecond - Nano regeneration per second
 * @returns Time in seconds until out of nano, or Infinity if sustainable
 */
export function calculateSustainTime(
  maxNano: number,
  nanoPerSecond: number,
  regenPerSecond: number
): number {
  if (regenPerSecond >= nanoPerSecond) {
    return Infinity;
  }

  return maxNano / (nanoPerSecond - regenPerSecond);
}

/**
 * Calculate number of casts until nano pool is empty
 * Returns Infinity if sustainable (regen >= cost per cast time), else floor of max casts
 *
 * @param maxNano - Maximum nano pool
 * @param nanoCost - Nano cost per cast
 * @param sustainable - Whether regen can sustain continuous casting
 * @returns Number of casts until empty, or Infinity if sustainable
 */
export function calculateCastsToEmpty(
  maxNano: number,
  nanoCost: number,
  sustainable: boolean
): number {
  if (sustainable) {
    return Infinity;
  }

  return Math.floor(maxNano / nanoCost);
}

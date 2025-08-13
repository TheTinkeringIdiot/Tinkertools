/**
 * TinkerTools Nanotechnician Specialization Utility
 * 
 * Functions for Nanotechnician offensive nano specialization calculations,
 * damage bonus computations, and character initialization.
 * 
 * Converted from TinkerNukes utils.py
 */

import {
  BREEDS,
  DECKS,
  SPECS,
  HUMIDITY,
  CRUNCHCOM,
  NOTUM_SIPHON,
  CHANNELING_OF_NOTUM,
  ENHANCE_NANO_DAMAGE,
  ANCIENT_MATRIX,
  DAMAGE_TYPES,
  type BreedId,
  type DeckId,
  type SpecId,
  type DamageTypeId
} from '../services/game-data';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface NukesConfiguration {
  breed: BreedId;
  level: number;
  mc: number;
  nano_init: number;
  max_nano: number;
  aggdef: number;
  he: number;
  NS: number;
  CoN: number;
  END: number;
  AM: number;
  crunchcom: number;
  deck: DeckId;
  spec: SpecId;
  nano_dmg: number;
  cost_pct: number;
  body_dev: number;
  psychic: number;
  nano_delta: number;
}

export interface DamageBonusResult {
  total: number;
  breakdown: {
    humidity?: number;
    crunchcom?: number;
    notumSiphon?: number;
    channelingOfNotum?: number;
    enhanceNanoDamage?: number;
    ancientMatrix?: number;
  };
}

// ============================================================================
// Initialization Functions
// ============================================================================

/**
 * Create initial nanotechnician specialization configuration
 */
export function initialNukes(): NukesConfiguration {
  return {
    breed: 0,
    level: 1,
    mc: 1,
    nano_init: 1,
    max_nano: 100,
    aggdef: 100,
    he: 0,
    NS: 0,
    CoN: 0,
    END: 0,
    AM: 0,
    crunchcom: 0,
    deck: 0,
    spec: 0,
    nano_dmg: 0,
    cost_pct: 0,
    body_dev: 1,
    psychic: 1,
    nano_delta: 0
  };
}

// ============================================================================
// Damage Calculation Functions
// ============================================================================

/**
 * Calculate total nano damage bonus from all sources
 */
export function calculateTotalDamageBonus(config: NukesConfiguration): DamageBonusResult {
  const breakdown: DamageBonusResult['breakdown'] = {};
  let total = 0;

  // Humidity Extractor bonus
  if (config.he > 0 && config.he <= 7) {
    const humidityBonus = HUMIDITY[config.he as keyof typeof HUMIDITY];
    if (humidityBonus > 0) {
      breakdown.humidity = humidityBonus;
      total += humidityBonus;
    }
  }

  // Crunchcom bonus
  if (config.crunchcom > 0 && config.crunchcom <= 7) {
    const crunchcomBonus = CRUNCHCOM[config.crunchcom as keyof typeof CRUNCHCOM];
    if (crunchcomBonus > 0) {
      breakdown.crunchcom = crunchcomBonus;
      total += crunchcomBonus;
    }
  }

  // Notum Siphon bonus
  if (config.NS > 0 && config.NS <= 10) {
    const notumSiphonBonus = NOTUM_SIPHON[config.NS as keyof typeof NOTUM_SIPHON];
    if (notumSiphonBonus > 0) {
      breakdown.notumSiphon = notumSiphonBonus;
      total += notumSiphonBonus;
    }
  }

  // Channeling of Notum bonus
  if (config.CoN > 0 && config.CoN <= 4) {
    const channelingBonus = CHANNELING_OF_NOTUM[config.CoN as keyof typeof CHANNELING_OF_NOTUM];
    if (channelingBonus > 0) {
      breakdown.channelingOfNotum = channelingBonus;
      total += channelingBonus;
    }
  }

  // Enhance Nano Damage bonus
  if (config.END > 0 && config.END <= 6) {
    const enhanceBonus = ENHANCE_NANO_DAMAGE[config.END as keyof typeof ENHANCE_NANO_DAMAGE];
    if (enhanceBonus > 0) {
      breakdown.enhanceNanoDamage = enhanceBonus;
      total += enhanceBonus;
    }
  }

  // Ancient Matrix bonus
  if (config.AM > 0 && config.AM <= 10) {
    const ancientMatrixBonus = ANCIENT_MATRIX[config.AM as keyof typeof ANCIENT_MATRIX];
    if (ancientMatrixBonus > 0) {
      breakdown.ancientMatrix = ancientMatrixBonus;
      total += ancientMatrixBonus;
    }
  }

  return {
    total,
    breakdown
  };
}

/**
 * Calculate damage bonus for a specific nano type
 */
export function calculateSpecificDamageBonus(
  config: NukesConfiguration, 
  damageType: DamageTypeId
): number {
  const totalBonus = calculateTotalDamageBonus(config);
  
  // For specific damage types, apply the total bonus
  // In the original implementation, all damage types benefit equally
  return totalBonus.total;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get breed name from ID
 */
export function getBreedName(breedId: BreedId): string {
  return BREEDS[breedId];
}

/**
 * Get deck name from ID
 */
export function getDeckName(deckId: DeckId): string {
  return DECKS[deckId];
}

/**
 * Get specialization level from spec ID
 */
export function getSpecLevel(specId: SpecId): number {
  return SPECS[specId];
}

/**
 * Get damage type name from ID
 */
export function getDamageTypeName(damageTypeId: DamageTypeId): string {
  return DAMAGE_TYPES[damageTypeId];
}

/**
 * Validate nanotechnician configuration
 */
export function validateNukesConfig(config: NukesConfiguration): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate breed
  if (!(config.breed in BREEDS)) {
    errors.push('Invalid breed ID');
  }

  // Validate level
  if (config.level < 1 || config.level > 220) {
    errors.push('Level must be between 1 and 220');
  }

  // Validate deck
  if (!(config.deck in DECKS)) {
    errors.push('Invalid deck ID');
  }

  // Validate specialization
  if (!(config.spec in SPECS)) {
    errors.push('Invalid specialization ID');
  }

  // Validate nano enhancement levels
  const enhancements = [
    { name: 'Humidity Extractor', value: config.he, max: 7 },
    { name: 'Crunchcom', value: config.crunchcom, max: 7 },
    { name: 'Notum Siphon', value: config.NS, max: 10 },
    { name: 'Channeling of Notum', value: config.CoN, max: 4 },
    { name: 'Enhance Nano Damage', value: config.END, max: 6 },
    { name: 'Ancient Matrix', value: config.AM, max: 10 }
  ];

  enhancements.forEach(enhancement => {
    if (enhancement.value < 0 || enhancement.value > enhancement.max) {
      errors.push(`${enhancement.name} must be between 0 and ${enhancement.max}`);
    }
  });

  // Warnings for suboptimal configurations
  if (config.level > 150 && config.he === 0) {
    warnings.push('Consider getting Humidity Extractor for higher level characters');
  }

  if (config.level > 100 && config.crunchcom === 0) {
    warnings.push('Crunchcom provides significant damage bonuses for mid-level characters');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Calculate total nano pool based on configuration
 */
export function calculateNanoPool(config: NukesConfiguration): number {
  // Base nano pool calculation would go here
  // This is a simplified version - the actual calculation would involve
  // breed bonuses, equipment, implants, etc.
  return config.max_nano;
}

/**
 * Calculate nano initiative based on configuration
 */
export function calculateNanoInitiative(config: NukesConfiguration): number {
  // Base nano initiative calculation would go here
  // This is a simplified version
  return config.nano_init;
}

// ============================================================================
// Export utilities as a group
// ============================================================================

export const nanotechnicianSpecialization = {
  // Initialization
  initialNukes,
  
  // Calculations
  calculateTotalDamageBonus,
  calculateSpecificDamageBonus,
  calculateNanoPool,
  calculateNanoInitiative,
  
  // Utilities
  getBreedName,
  getDeckName,
  getSpecLevel,
  getDamageTypeName,
  validateNukesConfig
};
/**
 * TinkerProfiles ID Validation
 *
 * Validates profession and breed IDs are within valid ranges
 */

import type { TinkerProfile } from './types';
import { PROFESSION, BREED } from '@/services/game-data';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate Character profession and breed IDs
 */
export function validateCharacterIds(profile: TinkerProfile): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate profession ID
  const professionId = profile.Character.Profession;
  if (typeof professionId !== 'number') {
    errors.push(`Profession must be a number, got ${typeof professionId}`);
  } else if (professionId < 1 || professionId > 15) {
    errors.push(`Invalid profession ID: ${professionId}. Must be between 1-15.`);
  } else if (professionId === 13) {
    warnings.push('Profession ID 13 (Monster) is unusual for player characters');
  }

  // Validate breed ID
  const breedId = profile.Character.Breed;
  if (typeof breedId !== 'number') {
    errors.push(`Breed must be a number, got ${typeof breedId}`);
  } else if (breedId < 0 || breedId > 7) {
    errors.push(`Invalid breed ID: ${breedId}. Must be between 0-7.`);
  } else if (breedId === 0 || breedId > 4) {
    warnings.push(`Breed ID ${breedId} is unusual (valid player breeds: 1-4)`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate entire profile structure and data
 */
export function validateProfile(profile: TinkerProfile): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate basic structure
  if (!profile.Character) {
    errors.push('Profile missing Character data');
    return { valid: false, errors, warnings };
  }

  // Validate Character IDs
  const idValidation = validateCharacterIds(profile);
  errors.push(...idValidation.errors);
  warnings.push(...idValidation.warnings);

  // Validate level
  if (typeof profile.Character.Level !== 'number') {
    errors.push(`Level must be a number, got ${typeof profile.Character.Level}`);
  } else if (profile.Character.Level < 1 || profile.Character.Level > 220) {
    errors.push(`Invalid level: ${profile.Character.Level}. Must be between 1-220.`);
  }

  // Validate skills structure
  if (!profile.skills || typeof profile.skills !== 'object') {
    errors.push('Profile missing or invalid skills data');
  }

  // Validate version
  if (profile.version !== '4.0.0') {
    warnings.push(`Profile version ${profile.version} may not be fully compatible`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Quick check if profession ID is valid
 */
export function isValidProfessionId(id: number): boolean {
  return typeof id === 'number' && id >= 1 && id <= 15;
}

/**
 * Quick check if breed ID is valid
 */
export function isValidBreedId(id: number): boolean {
  return typeof id === 'number' && id >= 0 && id <= 7;
}

/**
 * Get profession name with fallback for invalid IDs
 */
export function safeProfessionName(id: number): string {
  if (!isValidProfessionId(id)) {
    return `Invalid Profession (${id})`;
  }
  return PROFESSION[id as keyof typeof PROFESSION] || `Unknown (${id})`;
}

/**
 * Get breed name with fallback for invalid IDs
 */
export function safeBreedName(id: number): string {
  if (!isValidBreedId(id)) {
    return `Invalid Breed (${id})`;
  }
  return BREED[id as keyof typeof BREED] || `Unknown (${id})`;
}

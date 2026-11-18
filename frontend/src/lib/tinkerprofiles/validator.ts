/**
 * TinkerProfiles Validator
 *
 * Validates profile data structure, game rules, and consistency
 */

import type { ProfileValidationResult } from './types';
import { ANARCHY_FACTIONS, ANARCHY_EXPANSIONS, ACCOUNT_TYPES } from './constants';
import { validateProfessionAndBreedIds } from './validation';

/** A value that may be an object with arbitrary keys (validation input is untrusted) */
type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

export class ProfileValidator {
  // ============================================================================
  // Profile Structure Validation
  // ============================================================================

  /**
   * Validate a complete v4 TinkerProfile structure
   */
  validateProfile(profile: unknown): ProfileValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Basic structure validation
      if (!isRecord(profile)) {
        errors.push('Profile must be a valid object');
        return { valid: false, errors, warnings, suggestions };
      }

      // Required fields
      this.validateRequiredFields(profile, errors);

      // Character validation
      this.validateCharacter(profile.Character, errors, warnings, suggestions);

      // Skills validation
      this.validateSkills(profile.skills, errors, warnings);

      // Equipment validation
      this.validateEquipment(profile.Weapons, 'Weapons', warnings);
      this.validateEquipment(profile.Clothing, 'Clothing', warnings);
      this.validateEquipment(profile.Implants, 'Implants', warnings);

      // Metadata validation
      this.validateMetadata(profile, errors, warnings);
    } catch (error) {
      errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  // ============================================================================
  // Individual Field Validation
  // ============================================================================

  private validateRequiredFields(profile: UnknownRecord, errors: string[]): void {
    const requiredFields = ['id', 'version', 'Character', 'skills'];

    requiredFields.forEach((field) => {
      if (!(field in profile)) {
        errors.push(`Missing required field: ${field}`);
      }
    });
  }

  private validateCharacter(
    character: unknown,
    errors: string[],
    warnings: string[],
    suggestions: string[]
  ): void {
    if (!isRecord(character)) {
      errors.push('Character section must be a valid object');
      return;
    }

    // Name validation
    if (typeof character.Name !== 'string' || character.Name.trim().length === 0) {
      errors.push('Character name is required and cannot be empty');
    } else if (character.Name.length > 50) {
      warnings.push('Character name is unusually long (>50 characters)');
    }

    // Level validation
    if (typeof character.Level !== 'number' || character.Level < 1 || character.Level > 220) {
      errors.push('Character level must be between 1 and 220');
    } else if (character.Level > 200) {
      suggestions.push('High level character - consider double-checking skill values');
    }

    // Profession and breed are numeric IDs (see validation.ts)
    const idValidation = validateProfessionAndBreedIds(character.Profession, character.Breed);
    errors.push(...idValidation.errors);
    warnings.push(...idValidation.warnings);

    // Faction validation
    if (character.Faction && !this.isOneOf(character.Faction, ANARCHY_FACTIONS)) {
      warnings.push(`Invalid faction. Should be one of: ${ANARCHY_FACTIONS.join(', ')}`);
    }

    // Expansion validation
    if (character.Expansion && !this.isOneOf(character.Expansion, ANARCHY_EXPANSIONS)) {
      warnings.push(`Invalid expansion. Should be one of: ${ANARCHY_EXPANSIONS.join(', ')}`);
    }

    // Account type validation
    if (character.AccountType && !this.isOneOf(character.AccountType, ACCOUNT_TYPES)) {
      warnings.push(`Invalid account type. Should be one of: ${ACCOUNT_TYPES.join(', ')}`);
    }
  }

  /** v4 skills: a flat map of skill ID -> SkillData */
  private validateSkills(skills: unknown, errors: string[], warnings: string[]): void {
    if (!isRecord(skills)) {
      errors.push('Skills section must be a valid object');
      return;
    }

    Object.entries(skills).forEach(([skillId, skillData]) => {
      if (!/^\d+$/.test(skillId)) {
        errors.push(`Skill key ${skillId} must be a numeric skill ID`);
      } else if (!isRecord(skillData) || typeof skillData.total !== 'number') {
        errors.push(`Skill ${skillId} must have a numeric total`);
      } else if (skillData.total > 9999) {
        warnings.push(`Skill ${skillId} is unusually high (>9999)`);
      }
    });
  }

  private validateEquipment(equipment: unknown, type: string, warnings: string[]): void {
    if (!isRecord(equipment)) {
      warnings.push(`${type} section should be an object`);
      return;
    }

    // Equipment validation is more lenient since items can be null
    // We just check that the structure exists
    Object.entries(equipment).forEach(([slot, item]) => {
      if (item !== null && typeof item !== 'object') {
        warnings.push(`${type}.${slot} should be null or an item object`);
      }
    });
  }

  private validateMetadata(profile: UnknownRecord, errors: string[], warnings: string[]): void {
    if (profile.version && typeof profile.version !== 'string') {
      errors.push('Profile version must be a string');
    }

    if (profile.created && !this.isValidISODate(profile.created)) {
      warnings.push('Profile created date should be a valid ISO date string');
    }

    if (profile.updated && !this.isValidISODate(profile.updated)) {
      warnings.push('Profile updated date should be a valid ISO date string');
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private isOneOf(value: unknown, allowed: readonly string[]): boolean {
    return typeof value === 'string' && allowed.includes(value);
  }

  private isValidISODate(dateString: unknown): boolean {
    if (typeof dateString !== 'string') return false;

    try {
      const date = new Date(dateString);
      return date.toISOString() === dateString;
    } catch {
      return false;
    }
  }

  /**
   * Quick validation for profile existence and basic structure
   */
  isValidProfileStructure(profile: unknown): boolean {
    return !!(
      isRecord(profile) &&
      profile.id &&
      isRecord(profile.Character) &&
      profile.Character.Name &&
      typeof profile.Character.Level === 'number'
    );
  }
}

/**
 * TinkerProfiles Validator
 *
 * Validates profile data structure, game rules, and consistency
 */

import type { TinkerProfile, NanoCompatibleProfile, ProfileValidationResult } from './types';
import {
  ANARCHY_PROFESSIONS,
  ANARCHY_BREEDS,
  ANARCHY_FACTIONS,
  ANARCHY_EXPANSIONS,
  ACCOUNT_TYPES,
  DEFAULT_SKILLS,
} from './constants';

export class ProfileValidator {
  // ============================================================================
  // Profile Structure Validation
  // ============================================================================

  /**
   * Validate a complete TinkerProfile structure
   */
  validateProfile(profile: any): ProfileValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      // Basic structure validation
      if (!profile || typeof profile !== 'object') {
        errors.push('Profile must be a valid object');
        return { valid: false, errors, warnings, suggestions };
      }

      // Required fields
      this.validateRequiredFields(profile, errors);

      // Character validation
      this.validateCharacter(profile.Character, errors, warnings, suggestions);

      // Skills validation
      this.validateSkills(profile.Skills, errors, warnings, suggestions);

      // Equipment validation
      this.validateEquipment(profile.Weapons, 'Weapons', errors, warnings);
      this.validateEquipment(profile.Clothing, 'Clothing', errors, warnings);
      this.validateEquipment(profile.Implants, 'Implants', errors, warnings);

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

  /**
   * Validate a nano-compatible profile
   */
  validateNanoProfile(profile: any): ProfileValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    try {
      if (!profile || typeof profile !== 'object') {
        errors.push('Nano profile must be a valid object');
        return { valid: false, errors, warnings, suggestions };
      }

      // Required fields for nano profiles
      if (!profile.id || typeof profile.id !== 'string') {
        errors.push('Profile must have a valid ID');
      }

      if (!profile.name || typeof profile.name !== 'string') {
        errors.push('Profile must have a valid name');
      }

      if (!profile.profession || typeof profile.profession !== 'string') {
        errors.push('Profile must have a valid profession');
      }

      if (typeof profile.level !== 'number' || profile.level < 1 || profile.level > 220) {
        errors.push('Profile level must be between 1 and 220');
      }

      // Skills validation
      if (!profile.skills || typeof profile.skills !== 'object') {
        errors.push('Profile must have skills object');
      } else {
        this.validateNanoSkills(profile.skills, errors, warnings, suggestions);
      }

      // Stats validation
      if (!profile.stats || typeof profile.stats !== 'object') {
        errors.push('Profile must have stats object');
      } else {
        this.validateStats(profile.stats, errors, warnings, suggestions);
      }

      // Optional fields validation
      if (
        profile.memoryCapacity !== undefined &&
        (typeof profile.memoryCapacity !== 'number' || profile.memoryCapacity < 0)
      ) {
        warnings.push('Memory capacity should be a positive number');
      }

      if (
        profile.nanoPoints !== undefined &&
        (typeof profile.nanoPoints !== 'number' || profile.nanoPoints < 0)
      ) {
        warnings.push('Nano points should be a positive number');
      }
    } catch (error) {
      errors.push(
        `Nano profile validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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

  private validateRequiredFields(profile: any, errors: string[]): void {
    const requiredFields = ['id', 'version', 'Character', 'Skills'];

    requiredFields.forEach((field) => {
      if (!(field in profile)) {
        errors.push(`Missing required field: ${field}`);
      }
    });
  }

  private validateCharacter(
    character: any,
    errors: string[],
    warnings: string[],
    suggestions: string[]
  ): void {
    if (!character || typeof character !== 'object') {
      errors.push('Character section must be a valid object');
      return;
    }

    // Name validation
    if (
      !character.Name ||
      typeof character.Name !== 'string' ||
      character.Name.trim().length === 0
    ) {
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

    // Profession validation
    if (!character.Profession || !ANARCHY_PROFESSIONS.includes(character.Profession as any)) {
      errors.push(`Invalid profession. Must be one of: ${ANARCHY_PROFESSIONS.join(', ')}`);
    }

    // Breed validation
    if (character.Breed && !ANARCHY_BREEDS.includes(character.Breed as any)) {
      warnings.push(`Invalid breed. Should be one of: ${ANARCHY_BREEDS.join(', ')}`);
    }

    // Faction validation
    if (character.Faction && !ANARCHY_FACTIONS.includes(character.Faction as any)) {
      warnings.push(`Invalid faction. Should be one of: ${ANARCHY_FACTIONS.join(', ')}`);
    }

    // Expansion validation
    if (character.Expansion && !ANARCHY_EXPANSIONS.includes(character.Expansion as any)) {
      warnings.push(`Invalid expansion. Should be one of: ${ANARCHY_EXPANSIONS.join(', ')}`);
    }

    // Account type validation
    if (character.AccountType && !ACCOUNT_TYPES.includes(character.AccountType as any)) {
      warnings.push(`Invalid account type. Should be one of: ${ACCOUNT_TYPES.join(', ')}`);
    }
  }

  private validateSkills(
    skills: any,
    errors: string[],
    warnings: string[],
    suggestions: string[]
  ): void {
    if (!skills || typeof skills !== 'object') {
      errors.push('Skills section must be a valid object');
      return;
    }

    // Check for required skill categories
    const requiredCategories = Object.keys(DEFAULT_SKILLS);

    requiredCategories.forEach((category) => {
      if (!(category in skills)) {
        errors.push(`Missing skill category: ${category}`);
      } else if (typeof skills[category] !== 'object') {
        errors.push(`Skill category ${category} must be an object`);
      } else {
        this.validateSkillCategory(category, skills[category], errors, warnings, suggestions);
      }
    });
  }

  private validateSkillCategory(
    categoryName: string,
    categorySkills: any,
    errors: string[],
    warnings: string[],
    suggestions: string[]
  ): void {
    const defaultCategory = DEFAULT_SKILLS[categoryName as keyof typeof DEFAULT_SKILLS];

    if (!defaultCategory) return;

    // Check each skill in the category
    Object.entries(defaultCategory).forEach(([skillName, defaultValue]) => {
      const skillValue = categorySkills[skillName];

      if (skillValue === undefined || skillValue === null) {
        warnings.push(`Missing skill: ${categoryName}.${skillName}`);
      } else if (typeof skillValue !== 'number') {
        errors.push(`Skill ${categoryName}.${skillName} must be a number`);
      } else if (skillValue < 0) {
        errors.push(`Skill ${categoryName}.${skillName} cannot be negative`);
      } else if (skillValue > 9999) {
        warnings.push(`Skill ${categoryName}.${skillName} is unusually high (>9999)`);
      }
    });

    // Check for unknown skills
    Object.keys(categorySkills).forEach((skillName) => {
      if (!(skillName in defaultCategory)) {
        warnings.push(`Unknown skill: ${categoryName}.${skillName}`);
      }
    });
  }

  private validateNanoSkills(
    skills: any,
    errors: string[],
    warnings: string[],
    suggestions: string[]
  ): void {
    const requiredSkills = [
      'Biological Metamorphosis',
      'Matter Creation',
      'Matter Metamorphosis',
      'Psychological Modifications',
      'Sensory Improvement',
      'Time and Space',
    ];

    requiredSkills.forEach((skill) => {
      if (!(skill in skills)) {
        warnings.push(`Missing nano school: ${skill}`);
      } else if (typeof skills[skill] !== 'number' || skills[skill] < 0) {
        errors.push(`Invalid value for nano school ${skill}`);
      }
    });
  }

  private validateStats(
    stats: any,
    errors: string[],
    warnings: string[],
    suggestions: string[]
  ): void {
    const requiredStats = ['Strength', 'Stamina', 'Agility', 'Sense', 'Intelligence', 'Psychic'];

    requiredStats.forEach((stat) => {
      if (!(stat in stats)) {
        errors.push(`Missing required stat: ${stat}`);
      } else if (typeof stats[stat] !== 'number') {
        errors.push(`Stat ${stat} must be a number`);
      } else if (stats[stat] < 1) {
        errors.push(`Stat ${stat} must be at least 1`);
      } else if (stats[stat] > 9999) {
        warnings.push(`Stat ${stat} is unusually high (>9999)`);
      }
    });
  }

  private validateEquipment(
    equipment: any,
    type: string,
    errors: string[],
    warnings: string[]
  ): void {
    if (!equipment || typeof equipment !== 'object') {
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

  private validateMetadata(profile: any, errors: string[], warnings: string[]): void {
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

  private isValidISODate(dateString: any): boolean {
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
  isValidProfileStructure(profile: any): boolean {
    return !!(
      profile &&
      typeof profile === 'object' &&
      profile.id &&
      profile.Character &&
      profile.Character.Name &&
      typeof profile.Character.Level === 'number'
    );
  }

  /**
   * Check if a profile is compatible with nano operations
   */
  isNanoCompatible(profile: any): boolean {
    if (!this.isValidProfileStructure(profile)) return false;

    return !!(
      profile.Skills &&
      profile.Skills['Nanos & Casting'] &&
      typeof profile.Skills['Nanos & Casting']['Nano Progra'] === 'number'
    );
  }
}

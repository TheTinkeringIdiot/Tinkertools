/**
 * TypeScript type definitions for skill system
 *
 * Supports the ID-based skill architecture with branded types for type safety
 * and interfaces for skill metadata operations.
 */

/**
 * Branded type for skill IDs to ensure type safety
 * Prevents accidental usage of regular numbers as skill IDs
 */
export type SkillId = number & { readonly __brand: unique symbol };

/**
 * Skill metadata interface containing all display and organizational information
 */
export interface SkillMetadata {
  readonly id: SkillId;
  readonly name: string;
  readonly shortName: string;
  readonly category: string;
  readonly sortOrder: number;
}

/**
 * Skill data structure for v4.0.0 profiles
 * Replaces separate SkillWithIP and MiscSkill types with unified structure
 */
export interface SkillData {
  /** Breed-specific base value (5 for most skills, 0 for Misc/AC) */
  base: number;

  /** Attribute trickle-down value, computed separately from base */
  trickle: number;

  /** IP invested in this skill (0 for Misc/AC skills) */
  ipSpent: number;

  /** Skill points bought with IP (0 for Misc/AC skills) */
  pointsFromIp: number;

  /** Pure equipment bonus (no base included) */
  equipmentBonus: number;

  /** Pure perk bonus (no base included) */
  perkBonus: number;

  /** Pure buff bonus (no base included) */
  buffBonus: number;

  /** Computed total: base + trickle + pointsFromIp + equipmentBonus + perkBonus + buffBonus */
  total: number;
}

/**
 * Category information interface
 */
export interface SkillCategory {
  readonly name: string;
  readonly skillIds: readonly SkillId[];
  readonly sortOrder: number;
}

/**
 * Skill name resolution result for import operations
 */
export interface SkillResolutionResult {
  readonly skillId: SkillId;
  readonly resolvedName: string;
  readonly matchType: 'exact' | 'case-insensitive' | 'pattern';
}

/**
 * Error types for skill operations
 */
export class SkillNotFoundError extends Error {
  constructor(
    public readonly input: string | number,
    public readonly inputType: 'name' | 'id',
    message?: string
  ) {
    super(message || `Skill ${inputType} not found: ${input}`);
    this.name = 'SkillNotFoundError';
  }
}

export class InvalidSkillIdError extends Error {
  constructor(
    public readonly skillId: number,
    message?: string
  ) {
    super(message || `Invalid skill ID: ${skillId}`);
    this.name = 'InvalidSkillIdError';
  }
}

export class InvalidCategoryError extends Error {
  constructor(
    public readonly category: string,
    message?: string
  ) {
    super(message || `Invalid skill category: ${category}`);
    this.name = 'InvalidCategoryError';
  }
}

/**
 * Type guard to check if a number is a valid SkillId
 */
export function isSkillId(value: number): value is SkillId {
  // This will be implemented by SkillService.validateId()
  // Type guard provides compile-time safety
  return Number.isInteger(value) && value > 0;
}

/**
 * Type helper to convert number to SkillId (unsafe - use only with validation)
 */
export function toSkillId(id: number): SkillId {
  return id as SkillId;
}
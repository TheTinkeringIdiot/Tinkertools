/**
 * SkillService - Singleton service for skill ID resolution and metadata operations
 *
 * Provides centralized skill management for the v4.0.0 ID-based architecture.
 * Handles name↔ID resolution, metadata lookup, validation, and bulk operations.
 *
 * Core Features:
 * - Three-tier name resolution: exact match → case-insensitive → regex patterns
 * - Metadata lookup (name, short name, category, sort order)
 * - Bulk operations for UI rendering
 * - Comprehensive validation with descriptive errors
 * - Computes all data on-demand (no caching)
 */

import { SKILL_ID_MAP, SKILL_CATEGORIES } from '../lib/tinkerprofiles/skill-mappings';
import { SKILL_PATTERNS, type SkillPattern } from '../utils/skill-patterns';
import {
  type SkillId,
  type SkillMetadata,
  type SkillCategory,
  type SkillResolutionResult,
  SkillNotFoundError,
  InvalidSkillIdError,
  InvalidCategoryError,
  toSkillId,
} from '../types/skills';

/**
 * SkillService singleton class
 *
 * Manages all skill-related operations for the TinkerProfile system.
 * Initialized from skill-mappings.ts and skill-patterns.ts data.
 */
export class SkillService {
  private static instance: SkillService;

  // Static metadata maps for O(1) lookups
  private readonly skillIdToName: Map<number, string>;
  private readonly skillIdToShortName: Map<number, string>;
  private readonly skillIdToCategory: Map<number, string>;
  private readonly skillIdToSortOrder: Map<number, number>;
  private readonly categoryToSkillIds: Map<string, number[]>;
  private readonly nameToSkillId: Map<string, number>;

  // Pattern matching for fuzzy resolution
  private readonly skillPatterns: Map<number, RegExp[]>;

  /**
   * Private constructor - use getInstance() to access
   */
  private constructor() {
    this.skillIdToName = new Map();
    this.skillIdToShortName = new Map();
    this.skillIdToCategory = new Map();
    this.skillIdToSortOrder = new Map();
    this.categoryToSkillIds = new Map();
    this.nameToSkillId = new Map();
    this.skillPatterns = new Map();

    this.initializeMaps();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SkillService {
    if (!SkillService.instance) {
      SkillService.instance = new SkillService();
    }
    return SkillService.instance;
  }

  /**
   * Initialize all internal maps from skill-mappings.ts and skill-patterns.ts
   */
  private initializeMaps(): void {
    // Initialize from SKILL_ID_MAP
    for (const [skillName, skillId] of Object.entries(SKILL_ID_MAP)) {
      this.skillIdToName.set(skillId, skillName);
      this.nameToSkillId.set(skillName, skillId);

      // Generate short names (first letters of words, handle special cases)
      const shortName = this.generateShortName(skillName);
      this.skillIdToShortName.set(skillId, shortName);
    }

    // Initialize category mappings and sort orders
    let globalSortOrder = 0;
    for (const [categoryName, skillNames] of Object.entries(SKILL_CATEGORIES)) {
      const skillIds: number[] = [];

      for (let i = 0; i < skillNames.length; i++) {
        const skillName = skillNames[i];
        const skillId = SKILL_ID_MAP[skillName];

        if (skillId !== undefined) {
          skillIds.push(skillId);
          this.skillIdToCategory.set(skillId, categoryName);
          this.skillIdToSortOrder.set(skillId, globalSortOrder++);
        }
      }

      this.categoryToSkillIds.set(categoryName, skillIds);
    }

    // Initialize pattern matching from skill-patterns.ts
    for (const [statId, pattern] of Object.entries(SKILL_PATTERNS)) {
      const id = parseInt(statId, 10);
      this.skillPatterns.set(id, pattern.patterns);
    }
  }

  /**
   * Generate short name for a skill (for compact UI display)
   */
  private generateShortName(skillName: string): string {
    // Handle special cases first
    const specialCases: Record<string, string> = {
      '1h Blunt': '1hB',
      '1h Edged': '1hE',
      '2h Blunt': '2hB',
      '2h Edged': '2hE',
      'MG/SMG': 'MG',
      'Break & Entry': 'B&E',
      'Time & Space': 'T&S',
      'Matt Metam': 'MM',
      'Bio Metamor': 'BM',
      'Psycho Modi': 'PM',
      'Matter Creation': 'MC',
      'Sensory Improvement': 'SI',
      'Nano Programming': 'NP',
      'Computer Literacy': 'CL',
      'Comp. Liter': 'CL',
      'Body Dev.': 'BD',
      'Melee Init': 'MI',
      'Ranged Init': 'RI',
      'Physical Init': 'PI',
      'NanoC Init': 'NI',
      'Nano Pool': 'NP',
      'Nano Resist': 'NR',
      'Max Health': 'HP',
      'Max Nano': 'Nano',
      'Max NCU': 'NCU',
      'Run Speed': 'RS',
      'Vehicle Air': 'VA',
      'Vehicle Ground': 'VG',
      'Vehicle Water': 'VW',
    };

    if (specialCases[skillName]) {
      return specialCases[skillName];
    }

    // Generate from first letters of words
    const words = skillName.split(/[\s\-\.&]+/).filter((word) => word.length > 0);
    if (words.length === 1) {
      return words[0].substring(0, 3).toUpperCase();
    }

    return words.map((word) => word.charAt(0).toUpperCase()).join('');
  }

  /**
   * Generate detailed error message with context
   */
  private generateDetailedError(input: string, inputType: 'name' | 'id'): string {
    const baseMessage = `Skill ${inputType} not found: "${input}"`;

    if (inputType === 'name') {
      // Suggest similar names using Levenshtein distance
      const suggestions = this.findSimilarSkillNames(input, 3);
      const suggestionsText =
        suggestions.length > 0
          ? `\n\nDid you mean one of these?\n${suggestions.map((s) => `  - ${s}`).join('\n')}`
          : '';

      return `${baseMessage}

Unable to resolve skill name to valid ID.

Valid skill names include:
- Exact matches from skill-mappings.ts (${this.skillIdToName.size} skills)
- Pattern matches from skill-patterns.ts (${this.skillPatterns.size} patterns)

Check spelling, spacing, and capitalization.${suggestionsText}`;
    }

    const validRange = this.getValidIdRange();
    return `${baseMessage}

Valid skill ID range: ${validRange}
Total skills: ${this.skillIdToName.size}`;
  }

  /**
   * Find similar skill names using simple string similarity
   */
  private findSimilarSkillNames(input: string, maxSuggestions: number): string[] {
    const suggestions: { name: string; distance: number }[] = [];
    const inputLower = input.toLowerCase();

    const skillNames = Array.from(this.skillIdToName.values());
    for (const skillName of skillNames) {
      const skillLower = skillName.toLowerCase();

      // Simple similarity: check if input is contained in skill name or vice versa
      if (skillLower.includes(inputLower) || inputLower.includes(skillLower)) {
        const distance = Math.abs(skillName.length - input.length);
        suggestions.push({ name: skillName, distance });
      }
    }

    return suggestions
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxSuggestions)
      .map((s) => s.name);
  }

  /**
   * Get valid skill ID range description
   */
  private getValidIdRange(): string {
    const ids = Array.from(this.skillIdToName.keys()).sort((a, b) => a - b);
    const min = ids[0];
    const max = ids[ids.length - 1];
    return `${min}-${max}`;
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Resolve skill name to ID using three-tier matching:
   * 1. Exact match in static map
   * 2. Case-insensitive match
   * 3. Regex pattern matching
   *
   * @param name Skill name to resolve (e.g., "1h Blunt", "1hBlunt", "Break&Entry")
   * @returns Numeric skill ID (e.g., 102 for "1h Blunt")
   * @throws {SkillNotFoundError} If name cannot be resolved to valid skill ID
   */
  public resolveId(name: string): SkillId {
    if (!name || typeof name !== 'string') {
      throw new SkillNotFoundError(name, 'name', 'Invalid skill name: must be non-empty string');
    }

    // Step 1: Try exact match in static mapping
    const exactId = this.nameToSkillId.get(name);
    if (exactId !== undefined) {
      return toSkillId(exactId);
    }

    // Step 2: Try case-insensitive exact match
    const lowerName = name.toLowerCase();
    const nameEntries = Array.from(this.nameToSkillId.entries());
    for (const [skillName, skillId] of nameEntries) {
      if (skillName.toLowerCase() === lowerName) {
        return toSkillId(skillId);
      }
    }

    // Step 3: Try regex pattern matching
    const patternEntries = Array.from(this.skillPatterns.entries());
    for (const [skillId, patterns] of patternEntries) {
      for (const pattern of patterns) {
        if (pattern.test(name)) {
          return toSkillId(skillId);
        }
      }
    }

    // Step 4: Not found - throw descriptive error
    throw new SkillNotFoundError(name, 'name', this.generateDetailedError(name, 'name'));
  }

  /**
   * Get canonical display name for skill ID
   *
   * @param id Skill ID
   * @returns Canonical skill name (e.g., "1h Blunt")
   * @throws {InvalidSkillIdError} If skill ID is invalid
   */
  public getName(id: SkillId | number): string {
    const numericId = typeof id === 'number' ? id : Number(id);

    if (!this.validateId(numericId)) {
      throw new InvalidSkillIdError(
        numericId,
        this.generateDetailedError(numericId.toString(), 'id')
      );
    }

    return this.skillIdToName.get(numericId)!;
  }

  /**
   * Get short name for compact UI display
   *
   * @param id Skill ID
   * @returns Short skill name (e.g., "1hB")
   * @throws {InvalidSkillIdError} If skill ID is invalid
   */
  public getShortName(id: SkillId | number): string {
    const numericId = typeof id === 'number' ? id : Number(id);

    if (!this.validateId(numericId)) {
      throw new InvalidSkillIdError(numericId);
    }

    return this.skillIdToShortName.get(numericId) || this.getName(id);
  }

  /**
   * Get category name for skill ID
   *
   * @param id Skill ID
   * @returns Category name (e.g., "Melee Weapons")
   * @throws {InvalidSkillIdError} If skill ID is invalid
   */
  public getCategory(id: SkillId | number): string {
    const numericId = typeof id === 'number' ? id : Number(id);

    if (!this.validateId(numericId)) {
      throw new InvalidSkillIdError(numericId);
    }

    return this.skillIdToCategory.get(numericId) || 'Misc';
  }

  /**
   * Get sort order for skill ID (for UI ordering)
   *
   * @param id Skill ID
   * @returns Sort order number
   * @throws {InvalidSkillIdError} If skill ID is invalid
   */
  public getSortOrder(id: SkillId | number): number {
    const numericId = typeof id === 'number' ? id : Number(id);

    if (!this.validateId(numericId)) {
      throw new InvalidSkillIdError(numericId);
    }

    return this.skillIdToSortOrder.get(numericId) || 9999;
  }

  /**
   * Get all skill IDs in a category, sorted by display order
   *
   * @param category Category name (e.g., "Melee Weapons")
   * @returns Array of skill IDs sorted by display order
   * @throws {InvalidCategoryError} If category is invalid
   */
  public getSkillsByCategory(category: string): SkillId[] {
    const skillIds = this.categoryToSkillIds.get(category);
    if (!skillIds) {
      const validCategories = Array.from(this.categoryToSkillIds.keys()).join(', ');
      throw new InvalidCategoryError(
        category,
        `Unknown category: "${category}". Valid categories: ${validCategories}`
      );
    }

    return skillIds
      .slice() // Copy array to avoid mutations
      .sort((a, b) => this.getSortOrder(a) - this.getSortOrder(b))
      .map((id) => toSkillId(id));
  }

  /**
   * Get all valid skill IDs, sorted by display order
   *
   * @returns Array of all skill IDs
   */
  public getAllSkills(): SkillId[] {
    return Array.from(this.skillIdToName.keys())
      .sort((a, b) => this.getSortOrder(a) - this.getSortOrder(b))
      .map((id) => toSkillId(id));
  }

  /**
   * Get all valid category names
   *
   * @returns Array of category names
   */
  public getAllCategories(): string[] {
    return Array.from(this.categoryToSkillIds.keys());
  }

  /**
   * Validate if a number is a valid skill ID
   *
   * @param id Number to validate
   * @returns True if valid skill ID
   */
  public validateId(id: number): boolean {
    return Number.isInteger(id) && this.skillIdToName.has(id);
  }

  /**
   * Get complete metadata for a skill ID
   *
   * @param id Skill ID
   * @returns Complete skill metadata
   * @throws {InvalidSkillIdError} If skill ID is invalid
   */
  public getMetadata(id: SkillId | number): SkillMetadata {
    const skillId = typeof id === 'number' ? toSkillId(id) : id;
    const numericId = Number(skillId);

    if (!this.validateId(numericId)) {
      throw new InvalidSkillIdError(numericId);
    }

    return {
      id: skillId,
      name: this.getName(skillId),
      shortName: this.getShortName(skillId),
      category: this.getCategory(skillId),
      sortOrder: this.getSortOrder(skillId),
    };
  }

  /**
   * Resolve skill name and return detailed result
   *
   * @param name Skill name to resolve
   * @returns Resolution result with match type information
   * @throws {SkillNotFoundError} If name cannot be resolved
   */
  public resolveWithDetails(name: string): SkillResolutionResult {
    if (!name || typeof name !== 'string') {
      throw new SkillNotFoundError(name, 'name', 'Invalid skill name: must be non-empty string');
    }

    // Step 1: Try exact match
    const exactId = this.nameToSkillId.get(name);
    if (exactId !== undefined) {
      return {
        skillId: toSkillId(exactId),
        resolvedName: name,
        matchType: 'exact',
      };
    }

    // Step 2: Try case-insensitive match
    const lowerName = name.toLowerCase();
    const nameEntries2 = Array.from(this.nameToSkillId.entries());
    for (const [skillName, skillId] of nameEntries2) {
      if (skillName.toLowerCase() === lowerName) {
        return {
          skillId: toSkillId(skillId),
          resolvedName: skillName,
          matchType: 'case-insensitive',
        };
      }
    }

    // Step 3: Try pattern matching
    const patternEntries2 = Array.from(this.skillPatterns.entries());
    for (const [skillId, patterns] of patternEntries2) {
      for (const pattern of patterns) {
        if (pattern.test(name)) {
          const resolvedName = this.skillIdToName.get(skillId)!;
          return {
            skillId: toSkillId(skillId),
            resolvedName,
            matchType: 'pattern',
          };
        }
      }
    }

    // Not found
    throw new SkillNotFoundError(name, 'name', this.generateDetailedError(name, 'name'));
  }

  /**
   * Get category information including all skills
   *
   * @param category Category name
   * @returns Complete category information
   * @throws {InvalidCategoryError} If category is invalid
   */
  public getCategoryInfo(category: string): SkillCategory {
    const skillIds = this.getSkillsByCategory(category); // Validates category

    return {
      name: category,
      skillIds,
      sortOrder: 0, // Could be enhanced to support category ordering
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get statistics about the skill system
   */
  public getStats(): {
    totalSkills: number;
    totalCategories: number;
    totalPatterns: number;
    skillsByCategory: Record<string, number>;
  } {
    const skillsByCategory: Record<string, number> = {};
    const categoryEntries = Array.from(this.categoryToSkillIds.entries());
    for (const [category, skills] of categoryEntries) {
      skillsByCategory[category] = skills.length;
    }

    return {
      totalSkills: this.skillIdToName.size,
      totalCategories: this.categoryToSkillIds.size,
      totalPatterns: this.skillPatterns.size,
      skillsByCategory,
    };
  }
}

// Export singleton instance
export const skillService = SkillService.getInstance();

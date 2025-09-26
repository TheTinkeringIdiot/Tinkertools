/**
 * Skills Composable - Reactive composition API for skill operations
 *
 * Provides reusable functionality for skill name resolution, category filtering,
 * and display formatting with reactive integration to Pinia store.
 *
 * Core Features:
 * - Skill name resolution via SkillService
 * - Category-based skill filtering
 * - Common display pattern helpers
 * - Reactive integration with profile data
 * - Type-safe skill access with error handling
 */

import { computed, readonly, type ComputedRef } from 'vue';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import { skillService } from '@/services/skill-service';
import type { SkillId, SkillData } from '@/types/skills';

export interface UseSkillsOptions {
  /** Category to filter skills by (optional) */
  category?: string;
  /** Whether to include skills with zero values (default: true) */
  includeZeroValues?: boolean;
}

export interface SkillTuple {
  /** Skill ID for identification */
  id: SkillId;
  /** Skill data from profile */
  data: SkillData;
  /** Resolved display name */
  name: string;
  /** Category name */
  category: string;
  /** Short name for compact display */
  shortName: string;
}

/**
 * Vue composable for skill operations with reactive profile integration
 */
export function useSkills(options: UseSkillsOptions = {}) {
  const profilesStore = useTinkerProfilesStore();

  // ============================================================================
  // Reactive Computed Properties
  // ============================================================================

  /**
   * Get active profile's skills as reactive map
   */
  const profileSkills = computed((): Record<string, SkillData> => {
    const activeProfile = profilesStore.activeProfile;
    return activeProfile?.skills || {};
  });

  /**
   * Get all skills as [id, data] tuples for v-for iteration
   * Filtered by category if specified in options
   */
  const skillTuples = computed((): SkillTuple[] => {
    const skills = profileSkills.value;
    const results: SkillTuple[] = [];

    for (const [skillIdStr, skillData] of Object.entries(skills)) {
      try {
        const skillId = parseInt(skillIdStr, 10) as SkillId;

        // Validate skill ID
        if (!skillService.validateId(skillId)) {
          console.warn(`[useSkills] Invalid skill ID: ${skillId}`);
          continue;
        }

        // Apply category filter if specified
        if (options.category) {
          const skillCategory = skillService.getCategory(skillId);
          if (skillCategory !== options.category) {
            continue;
          }
        }

        // Apply zero value filter if specified
        if (options.includeZeroValues === false && skillData.total === 0) {
          continue;
        }

        results.push({
          id: skillId,
          data: skillData,
          name: skillService.getName(skillId),
          category: skillService.getCategory(skillId),
          shortName: skillService.getShortName(skillId)
        });

      } catch (error) {
        console.warn(`[useSkills] Error processing skill ${skillIdStr}:`, error);
      }
    }

    return results.sort((a, b) => skillService.getSortOrder(a.id) - skillService.getSortOrder(b.id));
  });

  /**
   * Get skills grouped by category
   */
  const skillsByCategory = computed(() => {
    const grouped: Record<string, SkillTuple[]> = {};

    for (const skillTuple of skillTuples.value) {
      const category = skillTuple.category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(skillTuple);
    }

    return grouped;
  });

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Resolve skill ID to display name
   *
   * @param id Skill ID
   * @returns Display name or fallback string if resolution fails
   */
  function getSkillName(id: SkillId | number): string {
    try {
      return skillService.getName(id);
    } catch (error) {
      console.warn(`[useSkills] Failed to resolve skill name for ID ${id}:`, error);
      return `Unknown Skill (${id})`;
    }
  }

  /**
   * Get skills for specific category as [id, data] tuples
   *
   * @param category Category name (e.g., "Melee Weapons")
   * @returns Array of [skillId, skillData] tuples sorted by display order
   */
  function getSkillsByCategory(category: string): Array<[SkillId, SkillData]> {
    try {
      const categorySkillIds = skillService.getSkillsByCategory(category);
      const skills = profileSkills.value;
      const results: Array<[SkillId, SkillData]> = [];

      for (const skillId of categorySkillIds) {
        const skillIdStr = skillId.toString();
        const skillData = skills[skillIdStr];

        if (skillData) {
          results.push([skillId, skillData]);
        } else {
          // Create default skill data for missing skills
          const defaultSkillData: SkillData = {
            base: 0,
            trickle: 0,
            ipSpent: 0,
            pointsFromIp: 0,
            equipmentBonus: 0,
            perkBonus: 0,
            buffBonus: 0,
            total: 0
          };
          results.push([skillId, defaultSkillData]);
        }
      }

      return results;

    } catch (error) {
      console.warn(`[useSkills] Failed to get skills for category "${category}":`, error);
      return [];
    }
  }

  /**
   * Format skill for display with common patterns
   *
   * @param id Skill ID
   * @param skill Skill data
   * @param format Display format type
   * @returns Formatted display string
   */
  function formatSkillDisplay(
    id: SkillId | number,
    skill: SkillData,
    format: 'name' | 'name_value' | 'short_value' | 'breakdown' = 'name_value'
  ): string {
    try {
      const name = skillService.getName(id);
      const shortName = skillService.getShortName(id);

      switch (format) {
        case 'name':
          return name;

        case 'name_value':
          return `${name}: ${skill.total}`;

        case 'short_value':
          return `${shortName}: ${skill.total}`;

        case 'breakdown':
          const components = [];
          if (skill.base > 0) components.push(`Base: ${skill.base}`);
          if (skill.trickle > 0) components.push(`Trickle: ${skill.trickle}`);
          if (skill.pointsFromIp > 0) components.push(`IP: ${skill.pointsFromIp}`);
          if (skill.equipmentBonus !== 0) components.push(`Equip: ${skill.equipmentBonus > 0 ? '+' : ''}${skill.equipmentBonus}`);
          if (skill.perkBonus !== 0) components.push(`Perks: ${skill.perkBonus > 0 ? '+' : ''}${skill.perkBonus}`);
          if (skill.buffBonus !== 0) components.push(`Buffs: ${skill.buffBonus > 0 ? '+' : ''}${skill.buffBonus}`);

          return `${name}: ${skill.total} (${components.join(', ')})`;

        default:
          return `${name}: ${skill.total}`;
      }

    } catch (error) {
      console.warn(`[useSkills] Failed to format skill display for ID ${id}:`, error);
      return `Unknown Skill: ${skill.total}`;
    }
  }

  /**
   * Get skill data for specific skill ID
   *
   * @param id Skill ID
   * @returns Skill data or null if not found
   */
  function getSkillData(id: SkillId | number): SkillData | null {
    const skills = profileSkills.value;
    const skillIdStr = id.toString();
    return skills[skillIdStr] || null;
  }

  /**
   * Check if skill exists in current profile
   *
   * @param id Skill ID
   * @returns True if skill has data in profile
   */
  function hasSkill(id: SkillId | number): boolean {
    return getSkillData(id) !== null;
  }

  /**
   * Get skill value (total) with fallback
   *
   * @param id Skill ID
   * @param fallback Fallback value if skill not found (default: 0)
   * @returns Skill total value or fallback
   */
  function getSkillValue(id: SkillId | number, fallback: number = 0): number {
    const skillData = getSkillData(id);
    return skillData?.total ?? fallback;
  }

  /**
   * Get all categories that have skills in current profile
   *
   * @returns Array of category names with skills
   */
  function getAvailableCategories(): string[] {
    const categories = new Set<string>();

    for (const skillTuple of skillTuples.value) {
      categories.add(skillTuple.category);
    }

    return Array.from(categories).sort();
  }

  // ============================================================================
  // Return Interface
  // ============================================================================

  return {
    // Reactive computed properties
    profileSkills: readonly(profileSkills),
    skillTuples: readonly(skillTuples),
    skillsByCategory: readonly(skillsByCategory),

    // Utility functions
    getSkillName,
    getSkillsByCategory,
    formatSkillDisplay,
    getSkillData,
    hasSkill,
    getSkillValue,
    getAvailableCategories,

    // Store integration
    activeProfile: computed(() => profilesStore.activeProfile),
    hasActiveProfile: computed(() => !!profilesStore.activeProfile)
  };
}

/**
 * Convenience function to create a category-specific skills composable
 *
 * @param category Category to filter by
 * @param options Additional options
 * @returns Category-specific skills composable
 */
export function useSkillsCategory(category: string, options: Omit<UseSkillsOptions, 'category'> = {}) {
  return useSkills({ ...options, category });
}
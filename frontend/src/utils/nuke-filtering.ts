/**
 * Pure Filtering Functions for Offensive Nanos (TinkerNukes)
 *
 * Provides client-side filtering logic for offensive nanoprograms based on:
 * - Skill requirements (ID-based O(1) lookups)
 * - Nano school filtering (Matter Creation=126, etc.)
 * - Quality Level range
 * - Name-based search
 * - Usability status calculation
 *
 * References:
 * - FR-2: Nano filtering by skills
 * - .docs/plans/tinkernukes/architecture-research.docs.md:175-188
 * - .docs/plans/tinkernukes/shared.md (ID-based skill access pattern)
 */

import type { OffensiveNano, UsabilityStatus } from '@/types/offensive-nano'
import type { Character } from './stat-calculations'
import { checkActionRequirements, parseAction } from '@/services/action-criteria'

// ============================================================================
// Profile-Based Requirement Filtering
// ============================================================================

/**
 * Filter nanos by character profile requirements
 *
 * Uses action-criteria infrastructure to check ALL requirements including:
 * - Stat requirements
 * - Skill requirements
 * - Profession compatibility
 * - Level requirements
 *
 * @param nanos - Array of offensive nanos to filter
 * @param character - Character profile with stats, skills, profession, level
 * @returns Filtered array of nanos where all requirements are met
 *
 * @example
 * const character = { baseStats: {...}, profession: 11, level: 220, breed: 1 }
 * const usableNanos = filterByCharacterProfile(allNanos, character)
 */
export function filterByCharacterProfile(
  nanos: OffensiveNano[],
  character: Character
): OffensiveNano[] {
  return nanos.filter((nano) => {
    // Check if nano has actions (should always have at least one)
    if (!nano.item.actions || nano.item.actions.length === 0) {
      console.warn(`[filterByCharacterProfile] Nano ${nano.id} has no actions`)
      return true // No requirements means always usable
    }

    // Use first action (typically "Use" action for nanos)
    const action = parseAction(nano.item.actions[0])
    const result = checkActionRequirements(action, character.baseStats || {})

    // Log filtered out items with unmet requirements
    if (!result.canPerform) {
      console.log(`[FILTERED OUT] ${nano.name} (ID: ${nano.id}, QL: ${nano.qualityLevel})`)
      console.log('  Unmet requirements:', result.unmetRequirements)
    }

    return result.canPerform
  })
}

// ============================================================================
// Skill Requirement Filtering (Legacy - prefer filterByCharacterProfile)
// ============================================================================

/**
 * Filter nanos by skill requirements only
 *
 * Returns only nanos where ALL skill requirements are met.
 * Uses ID-based skill lookup for O(1) access performance.
 *
 * @deprecated Use filterByCharacterProfile for complete validation
 * @param nanos - Array of offensive nanos to filter
 * @param skills - Record mapping skill ID to current skill value
 * @returns Filtered array of nanos where all requirements are met
 *
 * @example
 * const skills = { 126: 850, 127: 600, 128: 400 }
 * const usableNanos = filterBySkillRequirements(allNanos, skills)
 */
export function filterBySkillRequirements(
  nanos: OffensiveNano[],
  skills: Record<number, number>
): OffensiveNano[] {
  return nanos.filter((nano) => {
    // No requirements means nano is always usable
    if (!nano.castingRequirements || nano.castingRequirements.length === 0) {
      return true
    }

    // Check all skill requirements
    return nano.castingRequirements.every((requirement) => {
      // Only check skill requirements (ignore stat, level, etc.)
      if (requirement.type !== 'skill') {
        return true
      }

      // Get skill ID from requirement
      const skillId = typeof requirement.requirement === 'number'
        ? requirement.requirement
        : parseInt(requirement.requirement as string, 10)

      // Check if skill value meets requirement
      const currentSkillValue = skills[skillId] ?? 0
      return currentSkillValue >= requirement.value
    })
  })
}

// ============================================================================
// School Filtering
// ============================================================================

/**
 * Filter nanos by nano school
 *
 * Nano schools are stored as skill IDs:
 * - Matter Creation = 130
 * - Matter Metamorphosis = 127
 * - Biological Metamorphosis = 128
 * - Psychological Modifications = 129
 * - Sensory Improvement = 122
 * - Time and Space = 131
 *
 * @param nanos - Array of offensive nanos to filter
 * @param schoolId - Skill ID of the nano school, or null to show all
 * @returns Filtered array of nanos matching the school
 *
 * @example
 * const matterCreationNanos = filterBySchool(allNanos, 130)
 * const allNanos = filterBySchool(nanos, null)
 */
export function filterBySchool(
  nanos: OffensiveNano[],
  schoolId: number | null
): OffensiveNano[] {
  // null means no filtering
  if (schoolId === null) {
    return nanos
  }

  return nanos.filter((nano) => {
    // Check if nano has actions
    if (!nano.item.actions || nano.item.actions.length === 0) {
      return false
    }

    // Check first action's criteria for school requirement
    const criteria = nano.item.actions[0].criteria || []

    return criteria.some((criterion) => {
      // School requirements are skill stat checks (value1 = skill ID)
      // Skip logical operators (value1 = 0)
      if (criterion.value1 === 0) {
        return false
      }

      return criterion.value1 === schoolId
    })
  })
}

// ============================================================================
// Quality Level Filtering
// ============================================================================

/**
 * Filter nanos by quality level range
 *
 * @param nanos - Array of offensive nanos to filter
 * @param minQL - Minimum quality level (inclusive)
 * @param maxQL - Maximum quality level (inclusive)
 * @returns Filtered array of nanos within QL range
 *
 * @example
 * const midLevelNanos = filterByQLRange(allNanos, 100, 200)
 * const endgameNanos = filterByQLRange(allNanos, 200, 300)
 */
export function filterByQLRange(
  nanos: OffensiveNano[],
  minQL: number,
  maxQL: number
): OffensiveNano[] {
  return nanos.filter((nano) => {
    const ql = nano.qualityLevel
    return ql >= minQL && ql <= maxQL
  })
}

// ============================================================================
// Name Search
// ============================================================================

/**
 * Search nanos by name (case-insensitive)
 *
 * @param nanos - Array of offensive nanos to filter
 * @param query - Search query string
 * @returns Filtered array of nanos matching the search query
 *
 * @example
 * const nukeNanos = searchNanosByName(allNanos, "nuke")
 * const zapNanos = searchNanosByName(allNanos, "zap")
 */
export function searchNanosByName(
  nanos: OffensiveNano[],
  query: string
): OffensiveNano[] {
  // Empty query returns all nanos
  if (!query || query.trim() === '') {
    return nanos
  }

  const lowerQuery = query.toLowerCase().trim()

  return nanos.filter((nano) => {
    return nano.name.toLowerCase().includes(lowerQuery)
  })
}

// ============================================================================
// Usability Status Calculation
// ============================================================================

/**
 * Calculate usability status for a nano based on skill gaps
 *
 * Status categories:
 * - "usable": All skill requirements met
 * - "close": Within 100 points of all requirements (trainable range)
 * - "far": More than 100 points from any requirement
 *
 * @param nano - Offensive nano to check
 * @param skills - Record mapping skill ID to current skill value
 * @returns Usability status
 *
 * @example
 * const status = calculateUsabilityStatus(nano, { 130: 850, 127: 600 })
 * if (status === 'usable') {
 *   console.log('Nano is ready to cast!')
 * }
 */
export function calculateUsabilityStatus(
  nano: OffensiveNano,
  skills: Record<number, number>
): UsabilityStatus {
  // Check if nano has actions
  if (!nano.item.actions || nano.item.actions.length === 0) {
    return 'usable' // No requirements means always usable
  }

  // Use first action (typically "Use" action for nanos)
  const action = parseAction(nano.item.actions[0])
  const result = checkActionRequirements(action, skills)

  // If all requirements met, status is 'usable'
  if (result.canPerform) {
    return 'usable'
  }

  // Calculate maximum gap from unmet requirements
  let maxGap = 0
  for (const unmet of result.unmetRequirements) {
    const gap = unmet.required - unmet.current
    if (gap > maxGap) {
      maxGap = gap
    }
  }

  // Determine status based on maximum gap
  if (maxGap <= 100) {
    return 'close'
  } else {
    return 'far'
  }
}

// ============================================================================
// Combined Filtering
// ============================================================================

/**
 * Apply multiple filters to nano array
 *
 * Convenience function that chains all filtering operations.
 * Filters are applied in order: school → QL range → skill requirements → name search
 *
 * @param nanos - Array of offensive nanos to filter
 * @param options - Filter options
 * @returns Filtered array of nanos
 *
 * @example
 * const filtered = applyNanoFilters(allNanos, {
 *   schoolId: 126,
 *   minQL: 100,
 *   maxQL: 200,
 *   skills: { 126: 850, 127: 600 },
 *   searchQuery: "nuke"
 * })
 */
export function applyNanoFilters(
  nanos: OffensiveNano[],
  options: {
    schoolId?: number | null
    minQL?: number
    maxQL?: number
    skills?: Record<number, number>
    searchQuery?: string
  }
): OffensiveNano[] {
  let filtered = nanos

  // Apply school filter
  if (options.schoolId !== undefined) {
    filtered = filterBySchool(filtered, options.schoolId)
  }

  // Apply QL range filter
  if (options.minQL !== undefined && options.maxQL !== undefined) {
    filtered = filterByQLRange(filtered, options.minQL, options.maxQL)
  }

  // Apply skill requirements filter
  if (options.skills) {
    filtered = filterBySkillRequirements(filtered, options.skills)
  }

  // Apply name search
  if (options.searchQuery) {
    filtered = searchNanosByName(filtered, options.searchQuery)
  }

  return filtered
}

// ============================================================================
// Usability Filtering
// ============================================================================

/**
 * Filter nanos by usability status
 *
 * @param nanos - Array of offensive nanos to filter
 * @param skills - Record mapping skill ID to current skill value
 * @param status - Desired usability status ("usable", "close", or "far")
 * @returns Filtered array of nanos matching the usability status
 *
 * @example
 * const usableNanos = filterByUsabilityStatus(allNanos, skills, 'usable')
 * const almostUsable = filterByUsabilityStatus(allNanos, skills, 'close')
 */
export function filterByUsabilityStatus(
  nanos: OffensiveNano[],
  skills: Record<number, number>,
  status: UsabilityStatus
): OffensiveNano[] {
  return nanos.filter((nano) => {
    return calculateUsabilityStatus(nano, skills) === status
  })
}

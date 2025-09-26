/**
 * Profile Stats Mapper
 *
 * Converts TinkerProfile v4.0.0 structure to a flat stat ID → value map
 * for requirements checking against items and actions
 */

import type { TinkerProfile } from '@/lib/tinkerprofiles/types'
import { PROFESSION, BREED } from '@/services/game-data'
import { skillService } from '@/services/skill-service'

/**
 * Maps a TinkerProfile v4.0.0 to a flat record of stat ID → value
 * Used for checking requirements against profile skills and attributes
 */
export function mapProfileToStats(profile: TinkerProfile): Record<number, number> {
  const stats: Record<number, number> = {}

  // ============================================================================
  // Character Properties
  // ============================================================================

  // Level (stat ID 54)
  stats[54] = profile.Character.Level || 1

  // Breed (stat ID 4) - map breed name to ID
  if (profile.Character.Breed) {
    for (const [id, name] of Object.entries(BREED)) {
      if (name === profile.Character.Breed) {
        stats[4] = parseInt(id)
        break
      }
    }
  }

  // Profession (stat ID 60) - map profession name to ID
  if (profile.Character.Profession) {
    for (const [id, name] of Object.entries(PROFESSION)) {
      if (name === profile.Character.Profession) {
        stats[60] = parseInt(id)
        break
      }
    }
  }

  // MaxHealth and MaxNano (now in Character)
  stats[1] = profile.Character.MaxHealth || 1  // MaxHealth
  stats[214] = profile.Character.MaxNano || 1  // MaxNano

  // ============================================================================
  // Skills - Direct ID-based access (v4.0.0 structure)
  // ============================================================================

  // Iterate through all skills in the profile and map them directly by ID
  // This preserves the flat structure and uses the total values from calculations
  if (profile.skills) {
    for (const [skillIdStr, skillData] of Object.entries(profile.skills)) {
      const skillId = parseInt(skillIdStr, 10)

      // Use the total value from the unified SkillData structure
      // This includes: base + trickle + pointsFromIp + equipmentBonus + perkBonus + buffBonus
      stats[skillId] = (skillData as any)?.total || 1
    }
  }

  // ============================================================================
  // Default values for skills that might not be present in profile
  // ============================================================================

  // Ensure minimum values for commonly required skills if not present
  const defaultSkillIds = [
    // Attributes (16-21)
    16, 17, 18, 19, 20, 21,
    // ACs (90-97)
    90, 91, 92, 93, 94, 95, 96, 97,
    // Common skills (100-167)
    100, 101, 102, 103, 104, 105, 106, 107, // Melee weapons
    108, 109, 110, 111, 112, 113, 114, 115, 116, 117, // Ranged weapons
    118, 119, 120, 121, 122, // Initiative skills
    123, 124, 125, 126, 127, 128, 129, 130, 131, 132, 133, 134, 135, // Various skills
    136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150,
    151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167
  ]

  // Set default value of 1 for any skill not present in profile
  for (const skillId of defaultSkillIds) {
    if (stats[skillId] === undefined) {
      stats[skillId] = 1
    }
  }

  return stats
}

/**
 * Helper function to get a specific stat value from a profile
 */
export function getProfileStat(profile: TinkerProfile, statId: number): number {
  const stats = mapProfileToStats(profile)
  return stats[statId] || 0
}

/**
 * Helper function to check if a profile meets a specific requirement
 */
export function profileMeetsRequirement(
  profile: TinkerProfile, 
  statId: number, 
  operator: number, 
  requiredValue: number
): boolean {
  const currentValue = getProfileStat(profile, statId)
  
  // Map operators based on game-data.ts STAT_OPERATOR
  switch (operator) {
    case 0: // Equal
      return currentValue === requiredValue
    case 1: // LessThan
      return currentValue < requiredValue
    case 2: // GreaterThan (most common for requirements)
      return currentValue >= requiredValue
    case 24: // NotEqual
      return currentValue !== requiredValue
    default:
      console.warn(`Unknown requirement operator: ${operator}`)
      return false
  }
}
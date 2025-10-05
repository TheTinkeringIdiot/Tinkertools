/**
 * Utility to convert NukeInputState to Character interface
 *
 * Maps the manual skill inputs from TinkerNukes to the Character format
 * expected by nano validation utilities.
 */

import type { NukeInputState } from '@/types/offensive-nano'
import type { Character } from './stat-calculations'
import type { TinkerProfile } from '@/lib/tinkerprofiles/types'

/**
 * Converts NukeInputState manual inputs to Character interface
 *
 * Maps the characterStats fields from NukeInputState to baseStats
 * using the correct skill IDs for nano school validation.
 *
 * Skill ID Mappings:
 * - psychic: 21 (Psychic ability)
 * - nanoInit: 149 (Nano Init)
 * - maxNano: 221 (Max Nano)
 * - nanoDelta: 364 (Nano Delta)
 * - sensoryImp: 122 (Sensory Improvement skill)
 * - matterMeta: 127 (Material Metamorphose skill)
 * - bioMeta: 128 (Biological Metamorphose skill)
 * - psychModi: 129 (Psychological Modification skill)
 * - matterCreation: 130 (Material Creation skill)
 * - timeSpace: 131 (Space Time skill)
 *
 * @param inputState - The manual input state from TinkerNukes
 * @param profile - Optional TinkerProfile for fallback values (not currently used)
 * @returns Character object with flat baseStats for validation
 *
 * @example
 * ```typescript
 * const character = convertInputStateToCharacter(inputState, activeProfile)
 * const validation = validateRequirements(character, nanoRequirements)
 * ```
 */
export function convertInputStateToCharacter(
  inputState: NukeInputState,
  profile: Readonly<TinkerProfile> | TinkerProfile | null
): Character {
  const { characterStats } = inputState

  // Build flat baseStats object using skill IDs
  const baseStats: Record<number, number> = {
    // Core abilities and nano stats
    21: characterStats.psychic ?? 0,        // Psychic
    149: characterStats.nanoInit ?? 0,      // Nano Init
    221: characterStats.maxNano ?? 0,       // Max Nano
    364: characterStats.nanoDelta ?? 0,     // Nano Delta

    // Nano school skills (122-131)
    122: characterStats.sensoryImp ?? 0,     // Sensory Improvement
    127: characterStats.matterMeta ?? 0,     // Material Metamorphose
    128: characterStats.bioMeta ?? 0,        // Biological Metamorphose
    129: characterStats.psychModi ?? 0,      // Psychological Modification
    130: characterStats.matterCreation ?? 0, // Material Creation
    131: characterStats.timeSpace ?? 0,      // Space Time

    // WornItem equipment flags (stat 355) - pulled from profile equipment bonuses
    355: profile?.skills[355]?.total ?? 0,

    // Character-derived stats - pulled from profile (derived from Character properties)
    54: profile?.skills[54]?.total ?? characterStats.level ?? 1,    // Level
    60: profile?.skills[60]?.total ?? 11,   // Profession (Nanotechnician)
    368: profile?.skills[368]?.total ?? 11, // VisualProfession (Nanotechnician)
    182: profile?.skills[182]?.total ?? 0,  // Specialization
    389: profile?.skills[389]?.total ?? 0,  // Expansion
  }

  return {
    level: characterStats.level ?? 1,        // From manual input
    profession: 11,                          // Nanotechnician (hardcoded)
    breed: characterStats.breed ?? 1,        // From manual input
    baseStats,
  }
}

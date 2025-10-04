/**
 * Offensive Nano Service for TinkerNukes
 *
 * Provides API client and data transformation functions for offensive nanoprograms.
 * Handles fetching from backend, parsing spell damage data, and building OffensiveNano objects.
 *
 * References:
 * - Backend endpoint: GET /api/nanos/offensive/{professionId}
 * - Task 4.1: Create Offensive Nano Service
 * - FR-1: Offensive nano identification and filtering
 */

import type { Item as ItemDetail, Spell, Criterion } from '@/types/api'
import type { OffensiveNano, DamageType } from '@/types/offensive-nano'
import type { CastingRequirement, NanoSchool } from '@/types/nano'

// ============================================================================
// API Configuration
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

// ============================================================================
// Damage Type Mapping
// ============================================================================

/**
 * Maps spell modifier_stat values (90-97) to damage type strings
 * Used to identify which damage modifier stat applies to the nano
 */
const MODIFIER_STAT_TO_DAMAGE_TYPE: Record<number, DamageType> = {
  90: 'projectile',  // → stat 278
  91: 'melee',       // → stat 279
  92: 'energy',      // → stat 280
  93: 'chemical',    // → stat 281
  94: 'radiation',   // → stat 282
  95: 'cold',        // → stat 311
  96: 'poison',      // → stat 317
  97: 'fire'         // → stat 316
}

// ============================================================================
// Skill ID Mapping (from spell criteria)
// ============================================================================

/**
 * Maps criterion value1 to skill names for casting requirements
 * These are Anarchy Online skill IDs from spell_criteria
 */
const SKILL_ID_TO_NAME: Record<number, string> = {
  126: 'Matter Creation',
  127: 'Matter Metamorphosis',
  128: 'Biological Metamorphosis',
  129: 'Psychological Modifications',
  130: 'Sensory Improvement',
  131: 'Time and Space',
  157: 'Nano Programming',
  // Additional common requirement IDs
  152: 'Computer Literacy',
  21: 'Psychic'
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetches offensive nanoprograms for a specific profession
 * Calls GET /api/nanos/offensive/{professionId}
 *
 * @param professionId - Profession ID (11 = Nanotechnician)
 * @returns Array of ItemDetail objects with offensive spell data
 */
export async function fetchOffensiveNanos(professionId: number): Promise<ItemDetail[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/nanos/offensive/${professionId}?page=1&page_size=1000`)

    if (!response.ok) {
      throw new Error(`Failed to fetch offensive nanos: ${response.statusText}`)
    }

    const data = await response.json()

    // Backend returns PaginatedResponse with items array
    if (data && Array.isArray(data.items)) {
      return data.items as ItemDetail[]
    }

    console.warn('[fetchOffensiveNanos] Unexpected response format:', data)
    return []
  } catch (error) {
    console.error('[fetchOffensiveNanos] Error fetching offensive nanos:', error)
    throw error
  }
}

// ============================================================================
// Spell Parsing Functions
// ============================================================================

/**
 * Extracts MinValue and MaxValue from spell_params JSONB
 * Returns absolute values (damage values stored as negative in database)
 *
 * @param spell - Spell object with spell_params containing MinValue/MaxValue
 * @returns Tuple of [minDamage, maxDamage] as positive integers
 */
export function parseSpellDamage(spell: Spell): [number, number] {
  const params = spell.spell_params || {}

  // Extract damage values (stored as negative in database)
  const minValue = params.MinValue || params.minValue || 0
  const maxValue = params.MaxValue || params.maxValue || 0

  // Return absolute values
  return [Math.abs(minValue), Math.abs(maxValue)]
}

/**
 * Maps spell modifier_stat (90-97) to damage type string
 * Used to determine which damage modifier applies
 *
 * @param spell - Spell object with spell_params containing ModifierStat
 * @returns Damage type string ('projectile', 'melee', etc.) or 'energy' as default
 */
export function parseDamageType(spell: Spell): DamageType {
  const params = spell.spell_params || {}
  const modifierStat = params.ModifierStat || params.modifierStat || 92 // Default to energy

  return MODIFIER_STAT_TO_DAMAGE_TYPE[modifierStat] || 'energy'
}

/**
 * Extracts casting requirements from spell criteria
 * Builds CastingRequirement objects with skill IDs and required values
 *
 * @param spells - Array of spells from spell_data
 * @returns Array of CastingRequirement objects with skill requirements
 */
export function extractCastingRequirements(spells: Spell[]): CastingRequirement[] {
  const requirements: CastingRequirement[] = []
  const seen = new Set<string>() // Deduplicate requirements

  for (const spell of spells) {
    const criteria = spell.criteria || []

    for (const criterion of criteria) {
      const skillId = criterion.value1
      const requiredValue = criterion.value2

      // Check if this is a known skill requirement
      if (SKILL_ID_TO_NAME[skillId]) {
        const key = `skill_${skillId}`

        if (!seen.has(key)) {
          seen.add(key)
          requirements.push({
            type: 'skill',
            requirement: skillId, // Store as skill ID for O(1) lookups
            value: requiredValue,
            critical: true
          })
        }
      }
      // Handle level requirements (value1 = 54)
      else if (skillId === 54) {
        const key = 'level'
        if (!seen.has(key)) {
          seen.add(key)
          requirements.push({
            type: 'level',
            requirement: 'Level',
            value: requiredValue,
            critical: true
          })
        }
      }
    }
  }

  return requirements
}

/**
 * Transforms ItemDetail from API into OffensiveNano type
 * Parses spell data, extracts damage values, handles DoT mechanics
 *
 * @param item - ItemDetail object from backend API
 * @returns OffensiveNano object with parsed damage and casting data, or null if invalid
 */
export function buildOffensiveNano(item: ItemDetail): OffensiveNano | null {
  // Validate item has spell data
  if (!item.spell_data || item.spell_data.length === 0) {
    console.warn(`[buildOffensiveNano] Item ${item.id} has no spell_data`)
    return null
  }

  // Find the offensive spell (target=3, spell_id=53002)
  let offensiveSpell: Spell | null = null

  for (const spellData of item.spell_data) {
    const spells = spellData.spells || []

    for (const spell of spells) {
      if (spell.target === 3 && spell.spell_id === 53002) {
        offensiveSpell = spell
        break
      }
    }

    if (offensiveSpell) break
  }

  if (!offensiveSpell) {
    console.warn(`[buildOffensiveNano] Item ${item.id} has no offensive spell`)
    return null
  }

  // Parse damage values
  const [minDamage, maxDamage] = parseSpellDamage(offensiveSpell)
  const midDamage = Math.floor((minDamage + maxDamage) / 2)

  // Parse damage type
  const damageType = parseDamageType(offensiveSpell)

  // Parse tick mechanics (DoT detection: tickCount > 1)
  const tickCount = offensiveSpell.tick_count || 1
  const tickInterval = offensiveSpell.tick_interval || 0

  // Extract all spells for casting requirements
  const allSpells: Spell[] = []
  for (const spellData of item.spell_data) {
    allSpells.push(...(spellData.spells || []))
  }

  // Extract casting requirements
  const castingRequirements = extractCastingRequirements(allSpells)

  // Extract cast time and recharge time from stats
  const castTime = extractStatValue(item, 294) || 0
  const rechargeTime = extractStatValue(item, 210) || 0

  // Extract delay caps (minimum times after nano init reduction)
  const attackDelayCap = extractStatValue(item, 523)
  const rechargeDelayCap = extractStatValue(item, 524)

  // Build OffensiveNano object
  const offensiveNano: OffensiveNano = {
    // Base NanoProgram fields
    id: item.id,
    name: item.name,
    school: extractNanoSchool(castingRequirements), // Determine from requirements
    strain: extractStrain(item),
    description: item.description || '',
    level: extractLevel(castingRequirements),
    qualityLevel: item.ql || 0,
    castingRequirements,

    // Offensive-specific fields
    minDamage,
    maxDamage,
    midDamage,
    damageType,
    tickCount,
    tickInterval,
    castTime,
    rechargeTime,
    attackDelayCap,
    rechargeDelayCap
  }

  return offensiveNano
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extracts nano school from casting requirements
 * Maps skill ID (126-131) to school name
 */
function extractNanoSchool(requirements: CastingRequirement[]): NanoSchool {
  const SCHOOL_MAPPING: Record<number, NanoSchool> = {
    126: 'Matter Creation',
    127: 'Matter Metamorphosis',
    128: 'Biological Metamorphosis',
    129: 'Psychological Modifications',
    130: 'Sensory Improvement',
    131: 'Time and Space'
  }

  for (const req of requirements) {
    if (req.type === 'skill' && typeof req.requirement === 'number') {
      const school = SCHOOL_MAPPING[req.requirement]
      if (school) return school
    }
  }

  // Default to Matter Creation if no school requirement found
  return 'Matter Creation'
}

/**
 * Extracts strain from item stats (stat 75)
 * Returns strain value or empty string
 */
function extractStrain(item: ItemDetail): string {
  const stats = item.stats || []

  for (const stat of stats) {
    if (stat.stat === 75) {
      // Strain value stored in stat.value
      return String(stat.value)
    }
  }

  return ''
}

/**
 * Extracts level requirement from casting requirements
 */
function extractLevel(requirements: CastingRequirement[]): number {
  for (const req of requirements) {
    if (req.type === 'level') {
      return req.value
    }
  }

  return 0
}

/**
 * Extracts a specific stat value from item stats
 * @param item - ItemDetail object
 * @param statId - Stat ID to find (e.g., 294 for AttackDelay, 210 for RechargeDelay)
 * @returns Stat value or undefined if not found
 */
function extractStatValue(item: ItemDetail, statId: number): number | undefined {
  const stats = item.stats || []

  for (const stat of stats) {
    if (stat.stat === statId) {
      return stat.value
    }
  }

  return undefined
}

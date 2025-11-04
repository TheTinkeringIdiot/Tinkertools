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

import type { Item as ItemDetail, Spell } from '@/types/api';
import type { OffensiveNano, DamageType } from '@/types/offensive-nano';
import type { NanoSchool } from '@/types/nano';

// ============================================================================
// API Configuration
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// ============================================================================
// Damage Type Mapping
// ============================================================================

/**
 * Maps spell modifier_stat values (90-97) to damage type strings
 * Used to identify which damage modifier stat applies to the nano
 */
const MODIFIER_STAT_TO_DAMAGE_TYPE: Record<number, DamageType> = {
  90: 'projectile', // → stat 278
  91: 'melee', // → stat 279
  92: 'energy', // → stat 280
  93: 'chemical', // → stat 281
  94: 'radiation', // → stat 282
  95: 'cold', // → stat 311
  96: 'poison', // → stat 317
  97: 'fire', // → stat 316
};

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
    const response = await fetch(
      `${API_BASE_URL}/nanos/offensive/${professionId}?page=1&page_size=1000`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch offensive nanos: ${response.statusText}`);
    }

    const data = await response.json();

    // Backend returns PaginatedResponse with items array
    if (data && Array.isArray(data.items)) {
      return data.items as ItemDetail[];
    }

    console.warn('[fetchOffensiveNanos] Unexpected response format:', data);
    return [];
  } catch (error) {
    console.error('[fetchOffensiveNanos] Error fetching offensive nanos:', error);
    throw error;
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
  const params = spell.spell_params || {};

  // Extract damage values (stored as negative in database)
  const minValue = params.MinValue || params.minValue || 0;
  const maxValue = params.MaxValue || params.maxValue || 0;

  // Return absolute values
  return [Math.abs(minValue), Math.abs(maxValue)];
}

/**
 * Maps spell modifier_stat (90-97) to damage type string
 * Used to determine which damage modifier applies
 *
 * @param spell - Spell object with spell_params containing ModifierStat
 * @returns Damage type string ('projectile', 'melee', etc.) or 'energy' as default
 */
export function parseDamageType(spell: Spell): DamageType {
  const params = spell.spell_params || {};
  const modifierStat = params.ModifierStat || params.modifierStat || 92; // Default to energy

  return MODIFIER_STAT_TO_DAMAGE_TYPE[modifierStat] || 'energy';
}

/**
 * Extracts nano school from item's first action criteria
 * Maps skill ID (126-131) to school name
 *
 * @param item - ItemDetail object
 * @returns NanoSchool identifier
 */
function extractNanoSchool(item: ItemDetail): NanoSchool {
  const SCHOOL_MAPPING: Record<number, NanoSchool> = {
    122: 'Sensory Improvement',
    127: 'Matter Metamorphosis',
    128: 'Biological Metamorphosis',
    129: 'Psychological Modifications',
    130: 'Matter Creation',
    131: 'Time and Space',
  };

  // Check first action's criteria for school requirement
  if (item.actions && item.actions.length > 0) {
    const criteria = item.actions[0].criteria || [];
    for (const criterion of criteria) {
      const school = SCHOOL_MAPPING[criterion.value1];
      if (school) return school;
    }
  }

  // Default to Matter Creation if no school requirement found
  return 'Matter Creation';
}

/**
 * Extracts level requirement from item's first action criteria
 *
 * @param item - ItemDetail object
 * @returns Level requirement or 0
 */
function extractLevel(item: ItemDetail): number {
  if (item.actions && item.actions.length > 0) {
    const criteria = item.actions[0].criteria || [];
    for (const criterion of criteria) {
      if (criterion.value1 === 54) {
        // 54 is Level stat
        return criterion.value2;
      }
    }
  }
  return 0;
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
    console.warn(`[buildOffensiveNano] Item ${item.id} has no spell_data`);
    return null;
  }

  // Find all offensive spells (target=3, spell_id=53002)
  // Some nanos like Candycane have multiple spells that each deal damage
  const offensiveSpells: Spell[] = [];

  for (const spellData of item.spell_data) {
    const spells = spellData.spells || [];

    for (const spell of spells) {
      if (spell.target === 3 && spell.spell_id === 53002) {
        offensiveSpells.push(spell);
      }
    }
  }

  if (offensiveSpells.length === 0) {
    console.warn(`[buildOffensiveNano] Item ${item.id} has no offensive spell`);
    return null;
  }

  // Sum damage values from all offensive spells
  let totalMinDamage = 0;
  let totalMaxDamage = 0;

  for (const spell of offensiveSpells) {
    const [min, max] = parseSpellDamage(spell);
    totalMinDamage += min;
    totalMaxDamage += max;
  }

  const minDamage = totalMinDamage;
  const maxDamage = totalMaxDamage;
  const midDamage = Math.floor((minDamage + maxDamage) / 2);

  // Use first spell for damage type and tick mechanics
  // (multi-spell nanos typically have same tick behavior across all spells)
  const primarySpell = offensiveSpells[0];
  const damageType = parseDamageType(primarySpell);

  // Parse tick mechanics (DoT detection: tickCount > 1)
  const tickCount = primarySpell.tick_count || 1;
  const tickInterval = primarySpell.tick_interval || 0;

  // Extract cast time and recharge time from stats
  const castTime = extractStatValue(item, 294) || 0;
  const rechargeTime = extractStatValue(item, 210) || 0;

  // Extract delay caps (minimum times after nano init reduction)
  const attackDelayCap = extractStatValue(item, 523);
  const rechargeDelayCap = extractStatValue(item, 524);

  // Extract nano point cost (stat 407)
  const nanoPointCost = extractStatValue(item, 407) || 0;

  // Build OffensiveNano object
  const offensiveNano: OffensiveNano = {
    // Full item for action-criteria validation
    item,

    // Base NanoProgram fields
    id: item.id,
    aoid: item.aoid,
    name: item.name,
    school: extractNanoSchool(item),
    strain: extractStrain(item),
    description: item.description || '',
    level: extractLevel(item),
    qualityLevel: item.ql || 0,
    castingRequirements: [], // Legacy field, use item.actions instead

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
    rechargeDelayCap,
    nanoPointCost,
  };

  return offensiveNano;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extracts strain from item stats (stat 75)
 * Returns strain value or empty string
 */
function extractStrain(item: ItemDetail): string {
  const stats = item.stats || [];

  for (const stat of stats) {
    if (stat.stat === 75) {
      // Strain value stored in stat.value
      return String(stat.value);
    }
  }

  return '';
}

/**
 * Extracts a specific stat value from item stats
 * @param item - ItemDetail object
 * @param statId - Stat ID to find (e.g., 294 for AttackDelay, 210 for RechargeDelay)
 * @returns Stat value or undefined if not found
 */
function extractStatValue(item: ItemDetail, statId: number): number | undefined {
  const stats = item.stats || [];

  for (const stat of stats) {
    if (stat.stat === statId) {
      return stat.value;
    }
  }

  return undefined;
}

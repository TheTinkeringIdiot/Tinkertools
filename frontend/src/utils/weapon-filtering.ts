/**
 * Weapon Filtering Utilities
 *
 * Phase 3: Weapon Filtering & QL Interpolation
 * Ported from legacy TinkerFite views.py get_equipable_weapons() (line 455)
 *
 * Filters weapons by:
 * - Equipability (requirements check + QL interpolation)
 * - Weapon type (attack skill)
 * - QL range
 * - Search query (name)
 * - Profession (for Martial Arts Items)
 */

import type { WeaponCandidate, FiteInputState } from '@/types/weapon-analysis';
import { checkRequirements } from './weapon-requirements';
import { interpolateWeapon, sortWeaponsByQL } from './weapon-interpolation';

// ============================================================================
// Main Equipable Weapons Filter
// ============================================================================

/**
 * Filter weapons to only those equipable by character
 *
 * Port of legacy get_equipable_weapons() from views.py line 455
 *
 * Algorithm:
 * 1. Group weapons by name
 * 2. Handle special cases (Martial Arts Items by profession)
 * 3. For single-QL weapons: check requirements directly
 * 4. For multi-QL weapons: interpolate to find highest equipable QL
 * 5. Return all equipable weapons with interpolated QLs
 *
 * @param weapons - All candidate weapons to filter
 * @param state - Character state with all stats
 * @returns Array of equipable weapons (may include interpolated QLs)
 */
export function getEquipableWeapons(
  weapons: WeaponCandidate[],
  state: FiteInputState
): WeaponCandidate[] {
  const equipableWeapons: WeaponCandidate[] = [];
  const processedNames = new Set<string>();

  for (const weapon of weapons) {
    // Skip if already processed this weapon name
    if (processedNames.has(weapon.name)) {
      continue;
    }

    // Get all weapons with same name
    let sameWeapons = weapons.filter((w) => w.name === weapon.name);

    // Special handling for Martial Arts Items (profession-specific)
    if (weapon.name === 'Martial Arts Item') {
      sameWeapons = filterMartialArtsItemsByProfession(sameWeapons, state);
    }

    // If only one weapon variant, check if equipable
    if (sameWeapons.length === 1) {
      if (checkRequirements(sameWeapons[0], state)) {
        equipableWeapons.push({ ...sameWeapons[0], equipable: true });
      }
      processedNames.add(weapon.name);
      continue;
    }

    // Multiple QLs - interpolate
    processedNames.add(weapon.name);

    // Sort by QL ascending
    sameWeapons = sortWeaponsByQL(sameWeapons);

    // Try to interpolate from high to low QL pairs
    let found = false;
    for (let i = sameWeapons.length - 1; i > 0; i--) {
      const interpolated = interpolateWeapon(sameWeapons[i - 1], sameWeapons[i], state);

      if (interpolated) {
        equipableWeapons.push({ ...interpolated, equipable: true });
        found = true;
        break;
      }
    }

    // If no interpolation possible but can equip lowest QL
    if (!found && checkRequirements(sameWeapons[0], state)) {
      equipableWeapons.push({ ...sameWeapons[0], equipable: true });
    }
  }

  return equipableWeapons;
}

/**
 * Filter Martial Arts Items by profession
 *
 * Port of legacy code lines 462-467
 *
 * Martial Arts Items have profession-specific variants.
 * Filter to only those matching the character's profession.
 * For profession 0 ("Any"), use profession 1 (Soldier) items.
 *
 * @param martialArtsItems - All Martial Arts Item variants
 * @param state - Character state
 * @returns Filtered variants for this profession
 */
function filterMartialArtsItemsByProfession(
  martialArtsItems: WeaponCandidate[],
  state: FiteInputState
): WeaponCandidate[] {
  const profession = state.characterStats.profession;

  // Profession 0 = "Any", use profession 1 (Soldier) items
  const targetProfession = profession === 0 ? 1 : profession;

  return martialArtsItems.filter((weapon) => {
    // Find WIELD actions (action=8)
    const wearActions = weapon.actions?.filter((a) => a.action === 8) || [];

    // Check if any WEAR action has profession requirement
    for (const action of wearActions) {
      const criteria = action.criteria || [];

      // Find profession criteria (stat 60)
      const profCriteria = criteria.filter((c) => c.value1 === 60);

      if (profCriteria.length === 0) {
        // No profession requirement, include it
        return true;
      }

      // Check if any profession criterion matches
      for (const criterion of profCriteria) {
        if (criterion.value2 === targetProfession) {
          return true;
        }
      }
    }

    // No matching profession requirement found
    return false;
  });
}

// ============================================================================
// Additional Filtering Functions
// ============================================================================

/**
 * Filter weapons by weapon type (attack skill)
 *
 * Uses weapon's attack_stats to determine weapon type
 * Filters to weapons where specified skill is >= 50% of attack skill
 *
 * @param weapons - Weapons to filter
 * @param weaponSkillId - Weapon skill ID to filter by (e.g., 102 for 1h Blunt)
 * @returns Weapons using this weapon skill
 */
export function filterWeaponsByType(
  weapons: WeaponCandidate[],
  weaponSkillId: number | null
): WeaponCandidate[] {
  if (!weaponSkillId) return weapons;

  return weapons.filter((weapon) => {
    const attackStats = weapon.attack_stats || [];

    // Find the attack stat for this weapon skill
    const attackStat = attackStats.find((s) => s.stat === weaponSkillId);

    // Include if this skill is 50% or more of attack skill
    // (ported from legacy line 612)
    return attackStat && attackStat.value >= 50;
  });
}

/**
 * Filter weapons by QL range
 *
 * @param weapons - Weapons to filter
 * @param minQL - Minimum QL (inclusive), optional
 * @param maxQL - Maximum QL (inclusive), optional
 * @returns Weapons within QL range
 */
export function filterWeaponsByQL(
  weapons: WeaponCandidate[],
  minQL?: number,
  maxQL?: number
): WeaponCandidate[] {
  let filtered = weapons;

  if (minQL !== undefined) {
    filtered = filtered.filter((w) => (w.ql || 0) >= minQL);
  }

  if (maxQL !== undefined) {
    filtered = filtered.filter((w) => (w.ql || 0) <= maxQL);
  }

  return filtered;
}

/**
 * Filter weapons by search query (name)
 *
 * Case-insensitive substring match on weapon name
 *
 * @param weapons - Weapons to filter
 * @param searchQuery - Search string
 * @returns Weapons matching search query
 */
export function filterWeaponsBySearch(
  weapons: WeaponCandidate[],
  searchQuery: string
): WeaponCandidate[] {
  if (!searchQuery.trim()) return weapons;

  const query = searchQuery.toLowerCase();
  return weapons.filter((w) => w.name.toLowerCase().includes(query));
}

/**
 * Filter weapons by damage type
 *
 * @param weapons - Weapons to filter
 * @param damageType - Damage type ID (from DAMAGE_TYPES constant)
 * @returns Weapons with matching damage type
 */
export function filterWeaponsByDamageType(
  weapons: WeaponCandidate[],
  damageType: number | null
): WeaponCandidate[] {
  if (!damageType) return weapons;

  return weapons.filter((weapon) => {
    const stats = weapon.stats || [];
    const damageTypeStat = stats.find((s) => s.stat === 436); // Damage type stat ID
    return damageTypeStat && damageTypeStat.value === damageType;
  });
}

/**
 * Sort weapons by a specified field
 *
 * @param weapons - Weapons to sort
 * @param sortBy - Field to sort by
 * @param sortOrder - Sort order (asc/desc)
 * @returns Sorted weapons array
 */
export function sortWeapons(
  weapons: WeaponCandidate[],
  sortBy: 'name' | 'ql' | 'dps' | 'minDamage' | 'maxDamage',
  sortOrder: 'asc' | 'desc' = 'asc'
): WeaponCandidate[] {
  const sorted = [...weapons].sort((a, b) => {
    let aVal: number | string = 0;
    let bVal: number | string = 0;

    switch (sortBy) {
      case 'name':
        aVal = a.name;
        bVal = b.name;
        break;
      case 'ql':
        aVal = a.ql || 0;
        bVal = b.ql || 0;
        break;
      case 'dps':
        aVal = a.dps || 0;
        bVal = b.dps || 0;
        break;
      case 'minDamage':
        aVal = a.minDamage || 0;
        bVal = b.minDamage || 0;
        break;
      case 'maxDamage':
        aVal = a.maxDamage || 0;
        bVal = b.maxDamage || 0;
        break;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }

    return sortOrder === 'asc'
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  return sorted;
}

/**
 * Get unique weapon names from a weapon list
 *
 * Useful for deduplication and UI display
 *
 * @param weapons - Weapons to extract names from
 * @returns Array of unique weapon names
 */
export function getUniqueWeaponNames(weapons: WeaponCandidate[]): string[] {
  return Array.from(new Set(weapons.map((w) => w.name))).sort();
}

/**
 * Group weapons by name
 *
 * Returns a map of weapon name to array of weapon variants (different QLs)
 *
 * @param weapons - Weapons to group
 * @returns Map of name -> weapon variants
 */
export function groupWeaponsByName(weapons: WeaponCandidate[]): Map<string, WeaponCandidate[]> {
  const grouped = new Map<string, WeaponCandidate[]>();

  for (const weapon of weapons) {
    const existing = grouped.get(weapon.name) || [];
    existing.push(weapon);
    grouped.set(weapon.name, existing);
  }

  return grouped;
}

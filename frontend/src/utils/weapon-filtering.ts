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
import { interpolateWeapon, interpolateWeaponToQL, sortWeaponsByQL } from './weapon-interpolation';

// ============================================================================
// Martial Arts Item Template Selection
// ============================================================================

/**
 * Martial Arts Item families and tiers.
 *
 * The "Martial Arts Item" represents a character's unarmed combat. The client
 * (PlayerCharacter.cs:184-259) selects one of three template families based on
 * profession, then picks an MA-skill tier within that family. Each tier
 * specifies a (low_aoid, high_aoid) template pair and a QL formula derived
 * from the character's Martial Arts skill.
 *
 * Family 1: Martial Artist (profession 2)
 * Family 2: Shade (profession 15)
 * Family 3: Generic fallback (all other professions)
 */
interface MATier {
  /** MA skill upper bound (exclusive); use Infinity for the last tier */
  maxSkill: number;
  lowAoid: number;
  highAoid: number;
  /** Value subtracted from MA skill before dividing by 2 to compute QL */
  qlOffset: number;
}

const MA_TIERS: Record<1 | 2 | 3, MATier[]> = {
  // Family 1: Martial Artist
  1: [
    { maxSkill: 200,      lowAoid: 211352, highAoid: 211353, qlOffset: 0 },
    { maxSkill: 1000,     lowAoid: 211353, highAoid: 211354, qlOffset: 0 },
    { maxSkill: 2000,     lowAoid: 211357, highAoid: 211358, qlOffset: 1000 },
    { maxSkill: Infinity, lowAoid: 211363, highAoid: 211364, qlOffset: 2000 },
  ],
  // Family 2: Shade
  2: [
    { maxSkill: 200,      lowAoid: 211349, highAoid: 211350, qlOffset: 0 },
    { maxSkill: 1000,     lowAoid: 211350, highAoid: 211351, qlOffset: 0 },
    { maxSkill: 2000,     lowAoid: 211359, highAoid: 211360, qlOffset: 1000 },
    { maxSkill: Infinity, lowAoid: 211365, highAoid: 211366, qlOffset: 2000 },
  ],
  // Family 3: Generic fallback
  3: [
    { maxSkill: 200,      lowAoid: 43712,  highAoid: 144745, qlOffset: 0 },
    { maxSkill: 1000,     lowAoid: 144745, highAoid: 43713,  qlOffset: 0 },
    { maxSkill: 2000,     lowAoid: 211355, highAoid: 211356, qlOffset: 1000 },
    { maxSkill: Infinity, lowAoid: 211361, highAoid: 211362, qlOffset: 2000 },
  ],
};

function getMAFamily(profession: number): 1 | 2 | 3 {
  if (profession === 2) return 1;   // Martial Artist
  if (profession === 15) return 2;  // Shade
  return 3;                          // Everyone else (including profession 0 = "Any")
}

function getMATier(family: 1 | 2 | 3, maSkill: number): MATier {
  const tiers = MA_TIERS[family];
  for (const tier of tiers) {
    if (maSkill < tier.maxSkill) return tier;
  }
  return tiers[tiers.length - 1];
}

/**
 * Select the single Martial Arts Item appropriate for the character.
 *
 * Picks the correct template family for the profession, the correct tier
 * for the current MA skill, and interpolates between the tier's low/high
 * templates to the QL computed from the family's formula.
 *
 * Martial Arts Items have no wield requirements, so equipability is implicit.
 *
 * @param candidates - All Martial Arts Item variants returned by the backend
 * @param state - Character state (uses profession and weapon skill 100)
 * @returns Single interpolated Martial Arts Item, or null if templates missing
 */
export function selectMartialArtsItem(
  candidates: WeaponCandidate[],
  state: FiteInputState
): WeaponCandidate | null {
  const profession = state.characterStats.profession;
  const maSkill = state.weaponSkills[100] || 0;

  const family = getMAFamily(profession);
  const tier = getMATier(family, maSkill);

  // QL is computed from MA skill, floored at 1
  const targetQL = Math.max(1, Math.floor((maSkill - tier.qlOffset) / 2));

  const lowTpl = candidates.find((w) => w.aoid === tier.lowAoid);
  const highTpl = candidates.find((w) => w.aoid === tier.highAoid);

  if (!lowTpl || !highTpl) {
    return null;
  }

  return interpolateWeaponToQL(lowTpl, highTpl, targetQL);
}

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

    // Special handling for Martial Arts Item: profession + MA-skill drive
    // template selection and QL is computed from MA skill rather than
    // resolved by the generic equipability search.
    if (weapon.name === 'Martial Arts Item') {
      processedNames.add(weapon.name);
      const selected = selectMartialArtsItem(sameWeapons, state);
      if (selected) {
        equipableWeapons.push(selected);
      }
      continue;
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

/**
 * Weapon QL Interpolation
 *
 * Phase 3: Weapon Filtering & QL Interpolation
 * Ported from legacy TinkerFite views.py interpolate() (line 488)
 *
 * Calculates the highest QL a character can equip by interpolating between
 * two weapon QLs and testing requirements at each intermediate QL.
 *
 * Interpolates:
 * - Damage (min, max, crit)
 * - Attack rating cap (for MBS weapons)
 * - Skill requirements
 * - Attack/recharge times (static, not interpolated in legacy)
 */

import type { WeaponCandidate, FiteInputState } from '@/types/weapon-analysis';
import type { StatValue, Criterion } from '@/types/api';
import { checkRequirements } from './weapon-requirements';
import { WEAPON_STAT_IDS } from '@/types/weapon-analysis';

// ============================================================================
// Main Interpolation Function
// ============================================================================

/**
 * Interpolate weapon stats between two QLs to find highest equipable QL
 *
 * Port of legacy interpolate() from views.py line 488
 *
 * Algorithm:
 * 1. If can equip hi_weapon, return it
 * 2. If can't equip lo_weapon, return null
 * 3. Calculate deltas for all interpolatable stats
 * 4. For each QL from hi to lo:
 *    - Create interpolated weapon
 *    - Interpolate damage stats
 *    - Interpolate requirements
 *    - Check if can equip
 *    - Return first equipable QL
 *
 * @param loWeapon - Lower QL weapon
 * @param hiWeapon - Higher QL weapon
 * @param state - Character state with all stats
 * @returns Highest equipable weapon (interpolated), or null if can't equip even lo_weapon
 */
export function interpolateWeapon(
  loWeapon: WeaponCandidate,
  hiWeapon: WeaponCandidate,
  state: FiteInputState
): WeaponCandidate | null {
  // If can equip high QL, return it
  if (checkRequirements(hiWeapon, state)) {
    return { ...hiWeapon };
  }

  // If can't equip low QL, return null
  if (!checkRequirements(loWeapon, state)) {
    return null;
  }

  // Calculate QL delta
  const loQL = loWeapon.ql || 1;
  const hiQL = hiWeapon.ql || 1;
  const qlDelta = hiQL - loQL;

  // If no delta or negative, return hi weapon
  if (qlDelta <= 0) {
    return { ...hiWeapon };
  }

  // Extract weapon stats for interpolation
  const loStats = extractWeaponStatsForInterpolation(loWeapon);
  const hiStats = extractWeaponStatsForInterpolation(hiWeapon);

  // Calculate deltas per QL
  const minDmgDelta = (hiStats.minDamage - loStats.minDamage) / qlDelta;
  const maxDmgDelta = (hiStats.maxDamage - loStats.maxDamage) / qlDelta;
  const critDmgDelta = (hiStats.critBonus - loStats.critBonus) / qlDelta;

  // AR cap delta (only if both weapons have it)
  let arCapDelta = 0;
  if (loStats.arCap !== null && hiStats.arCap !== null) {
    arCapDelta = (hiStats.arCap - loStats.arCap) / qlDelta;
  }

  // Try each QL from high to low
  for (let i = qlDelta; i >= 0; i--) {
    const testQL = loQL + i;

    // Create interpolated weapon
    const interpolated: WeaponCandidate = {
      ...loWeapon,
      ql: testQL,
      interpolatedQL: testQL,
      equipable: false, // Will be set to true if requirements pass
    };

    // Interpolate stats
    interpolated.stats = interpolateStats(
      loWeapon.stats,
      i,
      minDmgDelta,
      maxDmgDelta,
      critDmgDelta,
      arCapDelta,
      loStats
    );

    // Interpolate requirements
    interpolated.actions = interpolateRequirements(loWeapon.actions, hiWeapon.actions, i, qlDelta);

    // Check if can equip
    if (checkRequirements(interpolated, state)) {
      interpolated.equipable = true;
      return interpolated;
    }
  }

  // Shouldn't reach here (lo_weapon passed check), but return null for safety
  return null;
}

// ============================================================================
// Stat Extraction & Interpolation
// ============================================================================

/**
 * Extract key weapon stats needed for interpolation
 */
interface WeaponStatsForInterpolation {
  minDamage: number;
  maxDamage: number;
  critBonus: number;
  arCap: number | null;
  attackTime: number;
  rechargeTime: number;
}

/**
 * Extract weapon stats from stats array
 *
 * @param weapon - Weapon to extract stats from
 * @returns Extracted stats for interpolation calculations
 */
function extractWeaponStatsForInterpolation(weapon: WeaponCandidate): WeaponStatsForInterpolation {
  const stats = weapon.stats || [];

  return {
    minDamage: findStatValue(stats, WEAPON_STAT_IDS.MIN_DAMAGE, 0),
    maxDamage: findStatValue(stats, WEAPON_STAT_IDS.MAX_DAMAGE, 0),
    critBonus: findStatValue(stats, WEAPON_STAT_IDS.CRITICAL_BONUS, 0),
    arCap: findStatValue(stats, WEAPON_STAT_IDS.AR_CAP, null),
    attackTime: findStatValue(stats, WEAPON_STAT_IDS.ATTACK_DELAY, 100),
    rechargeTime: findStatValue(stats, WEAPON_STAT_IDS.RECHARGE_DELAY, 100),
  };
}

/**
 * Find stat value by stat ID (returns number)
 */
function findStatValue(stats: StatValue[], statId: number, defaultValue: number): number;

/**
 * Find stat value by stat ID (returns number or null)
 */
function findStatValue(stats: StatValue[], statId: number, defaultValue: null): number | null;

/**
 * Find stat value by stat ID implementation
 */
function findStatValue(
  stats: StatValue[],
  statId: number,
  defaultValue: number | null
): number | null {
  const stat = stats.find((s) => s.stat === statId);
  return stat ? stat.value : defaultValue;
}

/**
 * Interpolate weapon stats based on QL offset
 *
 * Port of legacy code lines 518-532
 *
 * @param loStats - Stats from low QL weapon
 * @param qlOffset - QL offset from low weapon (0 to qlDelta)
 * @param minDmgDelta - Min damage increase per QL
 * @param maxDmgDelta - Max damage increase per QL
 * @param critDmgDelta - Crit bonus increase per QL
 * @param arCapDelta - AR cap increase per QL
 * @param baseStats - Base stats for interpolation
 * @returns New stats array with interpolated values
 */
function interpolateStats(
  loStats: StatValue[],
  qlOffset: number,
  minDmgDelta: number,
  maxDmgDelta: number,
  critDmgDelta: number,
  arCapDelta: number,
  baseStats: WeaponStatsForInterpolation
): StatValue[] {
  return loStats.map((stat) => {
    // Min damage
    if (stat.stat === WEAPON_STAT_IDS.MIN_DAMAGE) {
      return {
        ...stat,
        value: Math.round(baseStats.minDamage + qlOffset * minDmgDelta),
      };
    }

    // Max damage
    else if (stat.stat === WEAPON_STAT_IDS.MAX_DAMAGE) {
      return {
        ...stat,
        value: Math.round(baseStats.maxDamage + qlOffset * maxDmgDelta),
      };
    }

    // Crit bonus
    else if (stat.stat === WEAPON_STAT_IDS.CRITICAL_BONUS) {
      return {
        ...stat,
        value: Math.round(baseStats.critBonus + qlOffset * critDmgDelta),
      };
    }

    // AR cap
    else if (stat.stat === WEAPON_STAT_IDS.AR_CAP && baseStats.arCap !== null) {
      return {
        ...stat,
        value: Math.round(baseStats.arCap + qlOffset * arCapDelta),
      };
    }

    // All other stats stay the same
    return stat;
  });
}

// ============================================================================
// Requirement Interpolation
// ============================================================================

/**
 * Interpolate weapon requirements based on QL offset
 *
 * Port of legacy code lines 534-546
 *
 * - Breed, Profession, Expansion: kept as-is (not interpolated)
 * - Level: kept as-is (not interpolated in legacy)
 * - Skill requirements: interpolated linearly
 *
 * @param loActions - Actions from low QL weapon
 * @param hiActions - Actions from high QL weapon
 * @param qlOffset - QL offset from low weapon (0 to qlDelta)
 * @param qlDelta - Total QL difference
 * @returns New actions array with interpolated criteria
 */
function interpolateRequirements(
  loActions: WeaponCandidate['actions'] = [],
  hiActions: WeaponCandidate['actions'] = [],
  qlOffset: number,
  qlDelta: number
): WeaponCandidate['actions'] {
  if (!loActions || !hiActions) return loActions || [];

  return loActions.map((action, actionIdx) => {
    const hiAction = hiActions[actionIdx];
    if (!hiAction) return action;

    return {
      ...action,
      criteria: action.criteria?.map((criterion, critIdx) => {
        const hiCriterion = hiAction.criteria?.[critIdx];
        if (!hiCriterion) return criterion;

        // Interpolate numeric requirements (value2)
        // value1 (stat ID) stays the same
        // Breed (1), Profession (60), Expansion (473) are NOT interpolated
        const stat = criterion.value1;

        // Don't interpolate these stats
        if (stat === 1 || stat === 60 || stat === 473 || stat === 54) {
          return criterion;
        }

        // Interpolate skill requirements
        if (typeof criterion.value2 === 'number' && typeof hiCriterion.value2 === 'number') {
          const loValue = criterion.value2;
          const hiValue = hiCriterion.value2;
          const delta = (hiValue - loValue) / qlDelta;

          return {
            ...criterion,
            value2: Math.round(loValue + qlOffset * delta),
          };
        }

        // Keep non-numeric requirements as-is
        return criterion;
      }),
    };
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if two weapons are the same item (same name)
 *
 * Used by filtering logic to group weapons for interpolation
 *
 * @param weapon1 - First weapon
 * @param weapon2 - Second weapon
 * @returns true if weapons are the same item
 */
export function isSameWeapon(weapon1: WeaponCandidate, weapon2: WeaponCandidate): boolean {
  return weapon1.name === weapon2.name;
}

/**
 * Sort weapons by QL ascending
 *
 * Used by filtering logic before interpolation
 *
 * @param weapons - Array of weapons to sort
 * @returns Sorted array (ascending QL)
 */
export function sortWeaponsByQL(weapons: WeaponCandidate[]): WeaponCandidate[] {
  return [...weapons].sort((a, b) => {
    const aQL = a.ql || 0;
    const bQL = b.ql || 0;
    return aQL - bQL;
  });
}

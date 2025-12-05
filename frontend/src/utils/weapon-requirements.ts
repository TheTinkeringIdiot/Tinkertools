/**
 * Weapon Requirements Checking
 *
 * Phase 3: Weapon Filtering & QL Interpolation
 * Ported from legacy TinkerFite views.py check_requirements() (line 551)
 *
 * Determines if a character can equip a weapon based on:
 * - Breed restrictions
 * - Profession restrictions
 * - Level requirements
 * - Title level requirements
 * - Expansion/subscription tier
 * - Weapon skill requirements (with wrangle bonus)
 * - Special stat requirements
 */

import type { WeaponCandidate, FiteInputState } from '@/types/weapon-analysis';
import type { Criterion } from '@/types/api';

// ============================================================================
// Constants (from legacy utils.py)
// ============================================================================

/**
 * Stat IDs that should be skipped in requirement checks
 * These are either not relevant or checked separately
 */
const SKIPPED_STAT_IDS = [
  54, // Level (checked separately with special logic)
  152, // Team (not relevant for equipment)
  574, // Gender (not enforced)
  160, // Nano programming (not for weapons)
  125, // Mechanical engineering (not for weapons)
  157, // Weapon smithing (not for equipment)
  145, // Parry (not for equipment)
  143, // Riposte (not for equipment)
  276, // Wielded weapons (not checked)
  64, // Unknown stat
  413, // Form (not enforced)
  130, // Psychological modifications (not enforced)
  169, // Profession level (handled separately)
  16, // Strength (not blocking for weapons)
  // Add more as needed from SKIPPED_REQS
];

/**
 * Weapon skill IDs (100-116, 133-134)
 * These benefit from wrangle bonus in requirement checks
 */
const WEAPON_SKILL_IDS = [
  100, // Martial arts
  101, // Multi melee
  102, // 1h Blunt
  103, // 1h Edged
  104, // Melee energy
  105, // 2h Edged
  106, // Piercing
  107, // 2h Blunt
  108, // Sharp objects (thrown)
  109, // Grenade
  110, // Heavy weapons
  111, // Bow
  112, // Pistol
  113, // Rifle
  114, // MG/SMG
  115, // Shotgun
  116, // Assault rifle
  133, // Ranged energy
  134, // Multi ranged
];

/**
 * Stat IDs for key requirement types
 */
const STAT_IDS = {
  BREED: 1,
  LEVEL: 54,
  PROFESSION: 60,
  SIDE: 33,
  TITLE_LEVEL: 37,
  EXPANSION_SETS: 473,
  NPC_TYPE: 589,
} as const;

/**
 * Operator codes for criterion evaluation
 * Based on action-criteria-or-operator-fix.doc.md
 */
const OPERATORS = {
  EQUAL: 0,
  GREATER_THAN: 1,
  LESS_THAN: 2,
  OR: 3,
  AND: 4,
} as const;

// ============================================================================
// Main Requirement Checking Function
// ============================================================================

/**
 * Check if a weapon meets all requirements for a character
 *
 * Port of legacy check_requirements() from views.py line 551
 *
 * @param weapon - Weapon candidate to check
 * @param state - Character state with all stats and skills
 * @returns true if character can equip the weapon, false otherwise
 */
export function checkRequirements(weapon: WeaponCandidate, state: FiteInputState): boolean {
  // Extract all WIELD actions (action=8) from weapon
  const wearActions = weapon.actions?.filter((a) => a.action === 8) || [];

  // If no wear actions, weapon has no requirements
  if (wearActions.length === 0) {
    return true;
  }

  // Check all WEAR actions - all must pass
  for (const action of wearActions) {
    const criteria = action.criteria || [];

    // Process criteria with OR logic
    if (!evaluateCriteriaGroup(criteria, state)) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluate a group of criteria with RPN (Reverse Polish Notation) operator support
 *
 * Uses stack-based evaluation for OR/AND operators:
 * - When a criterion is evaluated, push result to stack
 * - When OR/AND operator is encountered, pop 2 values, apply operator, push result
 * - Final stack values are AND'd together
 *
 * Example: prof==9, prof==14, OR, prof==15, OR
 * 1. Push false (prof==9)      → stack: [false]
 * 2. Push true (prof==14)       → stack: [false, true]
 * 3. See OR → pop 2, OR, push   → stack: [true]
 * 4. Push false (prof==15)      → stack: [true, false]
 * 5. See OR → pop 2, OR, push   → stack: [true]
 * 6. Result: stack.every() → true
 *
 * @param criteria - Array of criteria in RPN order
 * @param state - Character state
 * @returns true if all criteria (with OR/AND groups) pass
 */
function evaluateCriteriaGroup(criteria: Criterion[], state: FiteInputState): boolean {
  const stack: boolean[] = [];

  for (const criterion of criteria) {
    // OR operator: pop 2 operands, apply OR, push result
    if (criterion.operator === OPERATORS.OR) {
      if (stack.length >= 2) {
        const right = stack.pop()!;
        const left = stack.pop()!;
        stack.push(left || right);
      }
      // If stack has < 2 items, OR is malformed - skip it
      continue;
    }

    // AND operator: pop 2 operands, apply AND, push result
    if (criterion.operator === OPERATORS.AND) {
      if (stack.length >= 2) {
        const right = stack.pop()!;
        const left = stack.pop()!;
        stack.push(left && right);
      }
      continue;
    }

    // Regular criterion: evaluate and push to stack
    const result = evaluateCriterion(criterion, state);
    stack.push(result);
  }

  // All remaining stack values must be true (implicit AND between independent requirements)
  return stack.every((r) => r);
}

/**
 * Evaluate a single criterion
 *
 * @param criterion - Single requirement to check
 * @param state - Character state
 * @returns true if criterion is met
 */
function evaluateCriterion(criterion: Criterion, state: FiteInputState): boolean {
  const stat = criterion.value1; // Stat ID
  const value = criterion.value2; // Required value

  // Breed check (multi-value via OR groups)
  if (stat === STAT_IDS.BREED) {
    return state.characterStats.breed === value;
  }

  // Profession check (multi-value via OR groups)
  else if (stat === STAT_IDS.PROFESSION) {
    // Profession 0 = "Any", can equip anything
    if (state.characterStats.profession === 0) {
      return true;
    }
    return state.characterStats.profession === value;
  }

  // Expansion sets (froob/sloob/paid)
  else if (stat === STAT_IDS.EXPANSION_SETS) {
    // Assume paid subscription (value 2) for now
    // 0 = froob, 1 = sloob, 2 = paid
    // If weapon requires expansion > 2, can't equip
    return value <= 2;
  }

  // Level check
  else if (stat === STAT_IDS.LEVEL) {
    return state.characterStats.level >= value;
  }

  // Title level check
  else if (stat === STAT_IDS.TITLE_LEVEL) {
    const level = state.characterStats.level;
    // Title level requirements (from legacy code line 573-585)
    if (value === 7) return level >= 205;
    if (value === 6) return level >= 190;
    if (value === 5) return level >= 150;
    if (value === 4) return level >= 100;
    if (value === 3) return level >= 50;
    if (value === 2) return level >= 15;
    return true;
  }

  // Faction/Side check
  else if (stat === STAT_IDS.SIDE) {
    // 0=Neutral, 1=Clan, 2=Omni
    // Neutral weapons (value 0) can be equipped by anyone
    if (value === 0) return true;
    // Otherwise must match character's side
    return state.characterStats.side === value;
  }

  // NPC type (exclude)
  else if (stat === STAT_IDS.NPC_TYPE) {
    // Can't equip NPC-only items
    return false;
  }

  // Skipped requirements
  else if (SKIPPED_STAT_IDS.includes(stat)) {
    return true;
  }

  // Weapon skill requirements (with wrangle bonus)
  else if (WEAPON_SKILL_IDS.includes(stat)) {
    const skillValue = state.weaponSkills[stat] || 0;
    const wrangle = state.combatBonuses.wrangle || 0;
    return skillValue + wrangle >= value;
  }

  // General stat requirements (try weapon skills first, then special attacks)
  else {
    const skillValue = state.weaponSkills[stat] || state.specialAttacks[stat] || 0;
    // For unknown stats, don't block (some may not be enforced)
    if (skillValue === 0) return true;
    return skillValue >= value;
  }
}

/**
 * Extract weapon requirements for display
 *
 * Parses weapon actions to extract human-readable requirements
 *
 * @param weapon - Weapon to extract requirements from
 * @returns Array of requirement objects for UI display
 */
export function extractWeaponRequirements(weapon: WeaponCandidate): Array<{
  stat: number;
  name: string;
  value: number;
  met?: boolean;
}> {
  const requirements: Array<{ stat: number; name: string; value: number; met?: boolean }> = [];

  const wearActions = weapon.actions?.filter((a) => a.action === 8) || [];

  for (const action of wearActions) {
    const criteria = action.criteria || [];

    for (const criterion of criteria) {
      // Skip OR operators
      if (criterion.operator === OPERATORS.OR) continue;

      const stat = criterion.value1;
      const value = criterion.value2;

      // Skip certain stats
      if (SKIPPED_STAT_IDS.includes(stat)) continue;

      requirements.push({
        stat,
        name: getStatName(stat),
        value,
      });
    }
  }

  return requirements;
}

/**
 * Get human-readable stat name from stat ID
 * TODO: Import from a shared constant file when available
 */
function getStatName(statId: number): string {
  const names: Record<number, string> = {
    1: 'Breed',
    54: 'Level',
    60: 'Profession',
    33: 'Side',
    37: 'Title Level',
    473: 'Expansion',
    100: 'Martial Arts',
    102: '1h Blunt',
    103: '1h Edged',
    105: '2h Edged',
    107: '2h Blunt',
    104: 'Melee Energy',
    106: 'Piercing',
    112: 'Pistol',
    113: 'Rifle',
    114: 'SMG',
    115: 'Shotgun',
    116: 'Assault Rifle',
    133: 'Ranged Energy',
    // Add more as needed
  };

  return names[statId] || `Stat ${statId}`;
}

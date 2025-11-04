/**
 * Tests for OR operator handling in RPN criteria tree builder
 *
 * These tests demonstrate the bug where OR nodes incorrectly sum all children's
 * requirement counts instead of counting as a single choice.
 *
 * EXPECTED BEHAVIOR: OR nodes should count as 1 requirement (choose any)
 * ACTUAL BEHAVIOR: OR nodes sum all children's counts (bug)
 */

import { describe, it, expect, vi } from 'vitest';
import { buildCriteriaTree } from '../action-criteria';
import type { Criterion } from '../../types/api';

// Mock game-data constants
vi.mock('../game-data', () => ({
  TEMPLATE_ACTION: {
    0: 'Any',
    1: 'Get',
    3: 'Use',
    5: 'UseItemOnItem',
    6: 'Wield',
    8: 'Attack',
    9: 'Use',
  },
  OPERATOR: {
    0: 'StatEqual',
    1: 'StatLessThan',
    2: 'StatGreaterThan',
    22: 'StatBitSet',
    24: 'StatNotEqual',
    107: 'StatBitNotSet',
    3: 'Or',
    4: 'And',
    42: 'Not',
  },
  STAT: {
    0: 'None',
    16: 'Agility',
    17: 'Stamina',
    18: 'Strength',
    19: 'Intelligence',
    20: 'Psychic',
    21: 'Sense',
    54: 'Level',
    60: 'Profession',
    112: 'Pistol',
    150: 'FlingShot',
  },
  PROFESSION: {
    0: 'Unknown',
    1: 'Soldier',
    2: 'MartialArtist',
    3: 'Engineer',
    4: 'Fixer',
    5: 'Agent',
    6: 'Adventurer',
    7: 'Trader',
    8: 'Bureaucrat',
    12: 'Enforcer',
  },
  BREED: {
    0: 'Solitus',
    1: 'Opifex',
    2: 'Nanomage',
    3: 'Atrox',
  },
  GENDER: {
    0: 'Male',
    1: 'Female',
    2: 'Neuter',
  },
}));

// Mock game-utils functions
vi.mock('../game-utils', () => ({
  getStatName: (id: number) => {
    const stats: Record<number, string> = {
      0: 'None',
      16: 'Agility',
      17: 'Stamina',
      18: 'Strength',
      19: 'Intelligence',
      20: 'Psychic',
      21: 'Sense',
      54: 'Level',
      60: 'Profession',
      112: 'Pistol',
      150: 'FlingShot',
    };
    return stats[id];
  },
  getProfessionName: (id: number) => {
    const professions: Record<number, string> = {
      0: 'Unknown',
      1: 'Soldier',
      2: 'MartialArtist',
      3: 'Engineer',
      4: 'Fixer',
      5: 'Agent',
      6: 'Adventurer',
      7: 'Trader',
      8: 'Bureaucrat',
      12: 'Enforcer',
    };
    return professions[id];
  },
  getBreedName: (id: number) => {
    const breeds: Record<number, string> = {
      0: 'Solitus',
      1: 'Opifex',
      2: 'Nanomage',
      3: 'Atrox',
    };
    return breeds[id];
  },
  getGenderName: (id: number) => {
    const genders: Record<number, string> = {
      0: 'Male',
      1: 'Female',
      2: 'Neuter',
    };
    return genders[id];
  },
  getFlagNameFromValue: (statId: number, value: number) => `flag ${value}`,
}));

describe('OR operator handling in criteria tree builder', () => {
  describe('Test Case 1: Simple OR (2 options)', () => {
    it('should count OR choice as 1 requirement, not sum of children', () => {
      // RPN: A B OR
      // Expression: (Soldier OR Enforcer)
      // Logical meaning: "Must be one of these professions" - single choice
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
        { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = Enforcer
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
      ];

      const tree = buildCriteriaTree(criteria, {});

      expect(tree).not.toBeNull();
      expect(tree?.type).toBe('operator');
      expect(tree?.operator).toBe('OR');

      // BUG: Currently sums children (2), should be 1 choice
      // EXPECTED: totalCount = 1 (choose any profession)
      // ACTUAL: totalCount = 2 (sum of both children)
      expect(tree?.totalCount).toBe(1); // Will fail - shows bug
      expect(tree?.metCount).toBe(0); // Neither profession met
      expect(tree?.status).toBe('unmet');
    });

    it('should mark OR as met when one option is satisfied', () => {
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
        { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = Enforcer
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
      ];

      // Character is a Soldier (satisfies first option)
      const tree = buildCriteriaTree(criteria, { 60: 1 });

      expect(tree).not.toBeNull();

      // EXPECTED: totalCount = 1, metCount = 1 (choice satisfied)
      // ACTUAL: totalCount = 2, metCount = 1 (bug)
      expect(tree?.totalCount).toBe(1); // Will fail
      expect(tree?.metCount).toBe(1); // This part correct
      expect(tree?.status).toBe('met');
    });

    it('should mark OR as met when other option is satisfied', () => {
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
        { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = Enforcer
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
      ];

      // Character is an Enforcer (satisfies second option)
      const tree = buildCriteriaTree(criteria, { 60: 12 });

      expect(tree).not.toBeNull();

      // EXPECTED: totalCount = 1, metCount = 1 (choice satisfied)
      // ACTUAL: totalCount = 2, metCount = 1 (bug)
      expect(tree?.totalCount).toBe(1); // Will fail
      expect(tree?.metCount).toBe(1); // This part correct
      expect(tree?.status).toBe('met');
    });
  });

  describe('Test Case 2: Chained OR (3+ options)', () => {
    it('should count chained OR as 1 requirement total', () => {
      // RPN: A B OR C OR
      // Expression: ((Soldier OR Enforcer) OR Adventurer)
      // Logical meaning: "Must be one of these three professions" - single choice
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
        { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = Enforcer
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 60, value2: 6, operator: 0 }, // Profession = Adventurer
        { id: 5, value1: 0, value2: 0, operator: 3 }, // OR
      ];

      const tree = buildCriteriaTree(criteria, {});

      expect(tree).not.toBeNull();
      expect(tree?.type).toBe('operator');
      expect(tree?.operator).toBe('OR');

      // BUG: Currently sums all options (3), should be 1 choice
      // EXPECTED: totalCount = 1 (choose any of 3 professions)
      // ACTUAL: totalCount = 3 (sum of all children)
      expect(tree?.totalCount).toBe(1); // Will fail - shows bug
      expect(tree?.metCount).toBe(0); // No profession met
      expect(tree?.status).toBe('unmet');
    });

    it('should mark chained OR as met when any option is satisfied', () => {
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
        { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = Enforcer
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 60, value2: 6, operator: 0 }, // Profession = Adventurer
        { id: 5, value1: 0, value2: 0, operator: 3 }, // OR
      ];

      // Character is an Adventurer (satisfies third option)
      const tree = buildCriteriaTree(criteria, { 60: 6 });

      expect(tree).not.toBeNull();

      // EXPECTED: totalCount = 1, metCount = 1 (choice satisfied)
      // ACTUAL: totalCount = 3, metCount = 1 (bug)
      expect(tree?.totalCount).toBe(1); // Will fail
      expect(tree?.metCount).toBe(1); // Status correct but count wrong
      expect(tree?.status).toBe('met');
    });

    it('should not count multiple satisfied OR options separately', () => {
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
        { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = Enforcer
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 60, value2: 6, operator: 0 }, // Profession = Adventurer
        { id: 5, value1: 0, value2: 0, operator: 3 }, // OR
      ];

      // Character is a Soldier (satisfies first option)
      const tree = buildCriteriaTree(criteria, { 60: 1 });

      expect(tree).not.toBeNull();

      // EXPECTED: totalCount = 1, metCount = 1
      // Even though only one profession met, OR is satisfied
      expect(tree?.totalCount).toBe(1); // Will fail
      expect(tree?.metCount).toBe(1);
      expect(tree?.status).toBe('met');
    });
  });

  describe('Test Case 3: Mixed AND/OR', () => {
    it('should count OR as 1 and AND requirements separately', () => {
      // RPN: A B OR C AND
      // Expression: ((Soldier OR Enforcer) AND Pistol >= 100)
      // Logical meaning: "Must be Soldier or Enforcer, AND have 100+ pistol" - 2 requirements
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
        { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = Enforcer
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 112, value2: 99, operator: 2 }, // Pistol > 99 (displays as >= 100)
        { id: 5, value1: 0, value2: 0, operator: 4 }, // AND
      ];

      const tree = buildCriteriaTree(criteria, {});

      expect(tree).not.toBeNull();
      expect(tree?.type).toBe('operator');
      expect(tree?.operator).toBe('AND');

      // BUG: Currently counts OR as 2 (sum of children) instead of 1
      // EXPECTED: totalCount = 2 (OR choice + pistol requirement)
      // ACTUAL: totalCount = 3 (2 professions + pistol)
      expect(tree?.totalCount).toBe(2); // Will fail - shows bug
      expect(tree?.metCount).toBe(0); // Nothing met
      expect(tree?.status).toBe('unmet');
    });

    it('should show partial when OR met but AND requirement not met', () => {
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
        { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = Enforcer
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 112, value2: 99, operator: 2 }, // Pistol > 99 (displays as >= 100)
        { id: 5, value1: 0, value2: 0, operator: 4 }, // AND
      ];

      // Character is Soldier but has low pistol
      const tree = buildCriteriaTree(criteria, { 60: 1, 112: 50 });

      expect(tree).not.toBeNull();

      // EXPECTED: totalCount = 2, metCount = 1 (OR met, pistol not met)
      // ACTUAL: totalCount = 3, metCount = 1 (bug inflates total)
      expect(tree?.totalCount).toBe(2); // Will fail
      expect(tree?.metCount).toBe(1);
      expect(tree?.status).toBe('partial');
    });

    it('should show met when both OR and AND requirements satisfied', () => {
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
        { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = Enforcer
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 112, value2: 99, operator: 2 }, // Pistol > 99 (displays as >= 100)
        { id: 5, value1: 0, value2: 0, operator: 4 }, // AND
      ];

      // Character is Enforcer with good pistol
      const tree = buildCriteriaTree(criteria, { 60: 12, 112: 150 });

      expect(tree).not.toBeNull();

      // EXPECTED: totalCount = 2, metCount = 2 (both requirements met)
      // ACTUAL: totalCount = 3, metCount = 2 (bug)
      expect(tree?.totalCount).toBe(2); // Will fail
      expect(tree?.metCount).toBe(2);
      expect(tree?.status).toBe('met');
    });
  });

  describe('Test Case 4: Nested OR', () => {
    it('should handle OR inside AND correctly', () => {
      // RPN: A B OR C D OR AND
      // Expression: ((Soldier OR Enforcer) AND (Pistol >= 100 OR FlingShot >= 100))
      // Logical meaning: "Must be Soldier/Enforcer AND have 100+ in pistol OR flingshot" - 2 choices
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
        { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = Enforcer
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 112, value2: 99, operator: 2 }, // Pistol > 99
        { id: 5, value1: 150, value2: 99, operator: 2 }, // FlingShot > 99
        { id: 6, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 7, value1: 0, value2: 0, operator: 4 }, // AND
      ];

      const tree = buildCriteriaTree(criteria, {});

      expect(tree).not.toBeNull();
      expect(tree?.type).toBe('operator');
      expect(tree?.operator).toBe('AND');

      // BUG: Currently counts both ORs as sums (2 + 2 = 4) instead of choices
      // EXPECTED: totalCount = 2 (profession choice + weapon skill choice)
      // ACTUAL: totalCount = 4 (2 professions + 2 weapon skills)
      expect(tree?.totalCount).toBe(2); // Will fail - shows bug
      expect(tree?.metCount).toBe(0);
      expect(tree?.status).toBe('unmet');
    });

    it('should count correctly when one OR satisfied in nested structure', () => {
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
        { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = Enforcer
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 112, value2: 99, operator: 2 }, // Pistol > 99
        { id: 5, value1: 150, value2: 99, operator: 2 }, // FlingShot > 99
        { id: 6, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 7, value1: 0, value2: 0, operator: 4 }, // AND
      ];

      // Character is Soldier with good pistol
      const tree = buildCriteriaTree(criteria, { 60: 1, 112: 150 });

      expect(tree).not.toBeNull();

      // EXPECTED: totalCount = 2, metCount = 2 (both OR choices satisfied)
      // ACTUAL: totalCount = 4, metCount = 2 (bug)
      expect(tree?.totalCount).toBe(2); // Will fail
      expect(tree?.metCount).toBe(2);
      expect(tree?.status).toBe('met');
    });

    it('should show partial when only one nested OR satisfied', () => {
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
        { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = Enforcer
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 112, value2: 99, operator: 2 }, // Pistol > 99
        { id: 5, value1: 150, value2: 99, operator: 2 }, // FlingShot > 99
        { id: 6, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 7, value1: 0, value2: 0, operator: 4 }, // AND
      ];

      // Character is Soldier but has low weapon skills
      const tree = buildCriteriaTree(criteria, { 60: 1, 112: 50, 150: 50 });

      expect(tree).not.toBeNull();

      // EXPECTED: totalCount = 2, metCount = 1 (profession OR met, weapon OR not met)
      // ACTUAL: totalCount = 4, metCount = 1 (bug)
      expect(tree?.totalCount).toBe(2); // Will fail
      expect(tree?.metCount).toBe(1);
      expect(tree?.status).toBe('partial');
    });
  });

  describe('Test Case 5: Complex real-world example', () => {
    it('should correctly count requirements in complex expression', () => {
      // RPN: A B OR C AND D AND
      // Expression: (((Soldier OR Enforcer) AND Pistol >= 100) AND Level >= 50)
      // Logical meaning: "Must be Soldier/Enforcer, have 100+ pistol, and be level 50+" - 3 requirements
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
        { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = Enforcer
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 112, value2: 99, operator: 2 }, // Pistol > 99
        { id: 5, value1: 0, value2: 0, operator: 4 }, // AND
        { id: 6, value1: 54, value2: 49, operator: 2 }, // Level > 49
        { id: 7, value1: 0, value2: 0, operator: 4 }, // AND
      ];

      const tree = buildCriteriaTree(criteria, {});

      expect(tree).not.toBeNull();
      expect(tree?.type).toBe('operator');
      expect(tree?.operator).toBe('AND');

      // BUG: Currently counts OR as 2 instead of 1
      // EXPECTED: totalCount = 3 (profession choice + pistol + level)
      // ACTUAL: totalCount = 4 (2 professions + pistol + level)
      expect(tree?.totalCount).toBe(3); // Will fail - shows bug
      expect(tree?.metCount).toBe(0);
      expect(tree?.status).toBe('unmet');
    });

    it('should track met count correctly when some requirements satisfied', () => {
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
        { id: 2, value1: 60, value2: 12, operator: 0 }, // Profession = Enforcer
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        { id: 4, value1: 112, value2: 99, operator: 2 }, // Pistol > 99
        { id: 5, value1: 0, value2: 0, operator: 4 }, // AND
        { id: 6, value1: 54, value2: 49, operator: 2 }, // Level > 49
        { id: 7, value1: 0, value2: 0, operator: 4 }, // AND
      ];

      // Character is Enforcer with good pistol but low level
      const tree = buildCriteriaTree(criteria, { 60: 12, 112: 150, 54: 30 });

      expect(tree).not.toBeNull();

      // EXPECTED: totalCount = 3, metCount = 2 (profession + pistol met, level not met)
      // ACTUAL: totalCount = 4, metCount = 2 (bug inflates total)
      expect(tree?.totalCount).toBe(3); // Will fail
      expect(tree?.metCount).toBe(2);
      expect(tree?.status).toBe('partial');
    });
  });

  describe('Test Case 6: Edge cases', () => {
    it('should handle single OR option as 1 requirement', () => {
      // Edge case: OR with only one child (shouldn't happen but test anyway)
      const criteria: Criterion[] = [
        { id: 1, value1: 60, value2: 1, operator: 0 }, // Profession = Soldier
        { id: 2, value1: 0, value2: 0, operator: 3 }, // OR (malformed but handle it)
      ];

      const tree = buildCriteriaTree(criteria, {});

      // Should handle gracefully
      expect(tree).not.toBeNull();
      // Count should be 1 regardless of implementation
      expect(tree?.totalCount).toBeGreaterThanOrEqual(1);
    });

    it('should handle stat requirements with different operators in OR', () => {
      // OR with different comparison operators
      const criteria: Criterion[] = [
        { id: 1, value1: 112, value2: 99, operator: 2 }, // Pistol >= 100
        { id: 2, value1: 150, value2: 99, operator: 2 }, // FlingShot >= 100
        { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
      ];

      const tree = buildCriteriaTree(criteria, {});

      expect(tree).not.toBeNull();
      expect(tree?.type).toBe('operator');
      expect(tree?.operator).toBe('OR');

      // EXPECTED: totalCount = 1 (choose either weapon skill)
      // ACTUAL: totalCount = 2 (sum of both)
      expect(tree?.totalCount).toBe(1); // Will fail
    });
  });
});

/**
 * Comprehensive tests for checkActionRequirements() function
 * Focusing on OR logic handling with tree evaluation
 *
 * Tests verify that OR/AND/NOT logic is correctly evaluated
 * and that unmetRequirements are properly identified.
 */

import { describe, it, expect, vi } from 'vitest';
import { checkActionRequirements, parseAction } from '../action-criteria';
import type { Action, Criterion } from '../../types/api';

// Mock game-data constants
vi.mock('../game-data', () => ({
  TEMPLATE_ACTION: {
    0: 'Any',
    1: 'Get',
    3: 'Use',
    6: 'Wield',
    8: 'Attack',
  },
  OPERATOR: {
    0: 'StatEqual',
    1: 'StatLessThan',
    2: 'StatGreaterThan',
    3: 'Or',
    4: 'And',
    42: 'Not',
  },
  STAT: {
    54: 'Level',
    60: 'Profession',
    112: 'Pistol',
    127: 'Psychology',
    150: 'FlingShot',
    368: 'Profession', // Using different ID for clarity in tests
  },
  PROFESSION: {
    1: 'Soldier',
    2: 'MartialArtist',
    3: 'Engineer',
    4: 'Fixer',
    5: 'Agent',
    6: 'Adventurer',
    7: 'Trader',
    8: 'Bureaucrat',
    10: 'Doctor',
    11: 'NanoTechnician',
    12: 'MetaPhysicist',
  },
  BREED: {},
  GENDER: {},
}));

// Mock game-utils functions
vi.mock('../game-utils', () => ({
  getStatName: (id: number) => {
    const stats: Record<number, string> = {
      54: 'Level',
      60: 'Profession',
      112: 'Pistol',
      127: 'Psychology',
      150: 'FlingShot',
      368: 'Profession',
    };
    return stats[id] || `Stat ${id}`;
  },
  getProfessionName: (id: number) => {
    const professions: Record<number, string> = {
      1: 'Soldier',
      2: 'MartialArtist',
      3: 'Engineer',
      4: 'Fixer',
      5: 'Agent',
      6: 'Adventurer',
      7: 'Trader',
      8: 'Bureaucrat',
      10: 'Doctor',
      11: 'NanoTechnician',
      12: 'MetaPhysicist',
    };
    return professions[id];
  },
  getBreedName: () => 'Unknown',
  getGenderName: () => 'Unknown',
  getFlagNameFromValue: () => 'flag',
}));

describe('checkActionRequirements - OR Logic Handling', () => {
  describe('Simple OR - character meets one requirement', () => {
    it('should pass when character meets first profession in OR', () => {
      // Action: Profession = NT OR Profession = MP
      const action: Action = {
        id: 1,
        action: 6,
        item_id: 1,
        criteria: [
          { id: 1, value1: 368, value2: 11, operator: 0 }, // Profession = NT (11)
          { id: 2, value1: 368, value2: 12, operator: 0 }, // Profession = MP (12)
          { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        ],
      };

      const parsedAction = parseAction(action);
      const characterStats = { 368: 11 }; // Character is NanoTechnician

      const result = checkActionRequirements(parsedAction, characterStats);

      expect(result.canPerform).toBe(true);
      expect(result.unmetRequirements).toHaveLength(0);
    });

    it('should pass when character meets second profession in OR', () => {
      // Action: Profession = NT OR Profession = MP
      const action: Action = {
        id: 1,
        action: 6,
        item_id: 1,
        criteria: [
          { id: 1, value1: 368, value2: 11, operator: 0 }, // Profession = NT (11)
          { id: 2, value1: 368, value2: 12, operator: 0 }, // Profession = MP (12)
          { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        ],
      };

      const parsedAction = parseAction(action);
      const characterStats = { 368: 12 }; // Character is MetaPhysicist

      const result = checkActionRequirements(parsedAction, characterStats);

      expect(result.canPerform).toBe(true);
      expect(result.unmetRequirements).toHaveLength(0);
    });
  });

  describe('Simple OR - character meets none', () => {
    it('should fail when character meets neither profession in OR', () => {
      // Action: Profession = Soldier OR Profession = Doctor
      const action: Action = {
        id: 1,
        action: 6,
        item_id: 1,
        criteria: [
          { id: 1, value1: 368, value2: 1, operator: 0 }, // Profession = Soldier (1)
          { id: 2, value1: 368, value2: 10, operator: 0 }, // Profession = Doctor (10)
          { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
        ],
      };

      const parsedAction = parseAction(action);
      const characterStats = { 368: 11 }; // Character is NanoTechnician

      const result = checkActionRequirements(parsedAction, characterStats);

      expect(result.canPerform).toBe(false);
      expect(result.unmetRequirements.length).toBeGreaterThan(0);
    });
  });

  describe('Chained OR (5 professions) - character meets one', () => {
    it('should pass when character matches one of five professions', () => {
      // Action: (((Prof=Soldier OR Prof=MA) OR Prof=Eng) OR Prof=Fix) OR Prof=Agent
      // This tests deeply nested OR chains like Pistol Mastery
      const action: Action = {
        id: 1,
        action: 6,
        item_id: 1,
        criteria: [
          { id: 1, value1: 368, value2: 1, operator: 0 }, // Soldier
          { id: 2, value1: 368, value2: 2, operator: 0 }, // MartialArtist
          { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
          { id: 4, value1: 368, value2: 3, operator: 0 }, // Engineer
          { id: 5, value1: 0, value2: 0, operator: 3 }, // OR
          { id: 6, value1: 368, value2: 4, operator: 0 }, // Fixer
          { id: 7, value1: 0, value2: 0, operator: 3 }, // OR
          { id: 8, value1: 368, value2: 5, operator: 0 }, // Agent
          { id: 9, value1: 0, value2: 0, operator: 3 }, // OR
        ],
      };

      const parsedAction = parseAction(action);
      const characterStats = { 368: 3 }; // Character is Engineer (matches 3rd option)

      const result = checkActionRequirements(parsedAction, characterStats);

      expect(result.canPerform).toBe(true);
      expect(result.unmetRequirements).toHaveLength(0);
    });

    it('should fail when character matches none of five professions', () => {
      const action: Action = {
        id: 1,
        action: 6,
        item_id: 1,
        criteria: [
          { id: 1, value1: 368, value2: 1, operator: 0 }, // Soldier
          { id: 2, value1: 368, value2: 2, operator: 0 }, // MartialArtist
          { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
          { id: 4, value1: 368, value2: 3, operator: 0 }, // Engineer
          { id: 5, value1: 0, value2: 0, operator: 3 }, // OR
          { id: 6, value1: 368, value2: 4, operator: 0 }, // Fixer
          { id: 7, value1: 0, value2: 0, operator: 3 }, // OR
          { id: 8, value1: 368, value2: 5, operator: 0 }, // Agent
          { id: 9, value1: 0, value2: 0, operator: 3 }, // OR
        ],
      };

      const parsedAction = parseAction(action);
      const characterStats = { 368: 11 }; // Character is NanoTechnician (not in list)

      const result = checkActionRequirements(parsedAction, characterStats);

      expect(result.canPerform).toBe(false);
      expect(result.unmetRequirements.length).toBeGreaterThan(0);
    });
  });

  describe('Mixed AND/OR - (A OR B) AND C', () => {
    it('should pass when profession matches OR and skill meets AND', () => {
      // Action: (Profession=NT OR Profession=MP) AND Pistol>=100
      const action: Action = {
        id: 1,
        action: 6,
        item_id: 1,
        criteria: [
          { id: 1, value1: 368, value2: 11, operator: 0 }, // Profession = NT
          { id: 2, value1: 368, value2: 12, operator: 0 }, // Profession = MP
          { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
          { id: 4, value1: 127, value2: 99, operator: 2 }, // Pistol > 99 (display as >= 100)
          { id: 5, value1: 0, value2: 0, operator: 4 }, // AND
        ],
      };

      const parsedAction = parseAction(action);
      const characterStats = {
        368: 11, // Is NanoTechnician (meets OR)
        127: 150, // Pistol 150 (meets AND)
      };

      const result = checkActionRequirements(parsedAction, characterStats);

      expect(result.canPerform).toBe(true);
      expect(result.unmetRequirements).toHaveLength(0);
    });

    it('should fail when profession matches OR but skill fails AND', () => {
      // Action: (Profession=NT OR Profession=MP) AND Pistol>=100
      const action: Action = {
        id: 1,
        action: 6,
        item_id: 1,
        criteria: [
          { id: 1, value1: 368, value2: 11, operator: 0 }, // Profession = NT
          { id: 2, value1: 368, value2: 12, operator: 0 }, // Profession = MP
          { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
          { id: 4, value1: 127, value2: 99, operator: 2 }, // Pistol > 99 (display as >= 100)
          { id: 5, value1: 0, value2: 0, operator: 4 }, // AND
        ],
      };

      const parsedAction = parseAction(action);
      const characterStats = {
        368: 11, // Is NanoTechnician (meets OR)
        127: 50, // Pistol 50 (fails AND requirement)
      };

      const result = checkActionRequirements(parsedAction, characterStats);

      expect(result.canPerform).toBe(false);
      expect(result.unmetRequirements.length).toBeGreaterThan(0);

      // Verify the unmet requirement is the pistol skill
      const pistolRequirement = result.unmetRequirements.find((req) => req.stat === 127);
      expect(pistolRequirement).toBeDefined();
      expect(pistolRequirement?.required).toBe(100); // Transformed from > 99 to >= 100
      expect(pistolRequirement?.current).toBe(50);
    });

    it('should fail when skill meets AND but profession fails OR', () => {
      // Action: (Profession=NT OR Profession=MP) AND Pistol>=100
      const action: Action = {
        id: 1,
        action: 6,
        item_id: 1,
        criteria: [
          { id: 1, value1: 368, value2: 11, operator: 0 }, // Profession = NT
          { id: 2, value1: 368, value2: 12, operator: 0 }, // Profession = MP
          { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
          { id: 4, value1: 127, value2: 99, operator: 2 }, // Pistol > 99 (display as >= 100)
          { id: 5, value1: 0, value2: 0, operator: 4 }, // AND
        ],
      };

      const parsedAction = parseAction(action);
      const characterStats = {
        368: 1, // Is Soldier (fails OR - not NT or MP)
        127: 150, // Pistol 150 (meets AND)
      };

      const result = checkActionRequirements(parsedAction, characterStats);

      expect(result.canPerform).toBe(false);
      expect(result.unmetRequirements.length).toBeGreaterThan(0);
    });
  });

  describe('Profession OR with stats - typical symbiant pattern', () => {
    it('should pass when one profession matches and all skills meet requirements', () => {
      // Typical symbiant: (Prof=Soldier OR Prof=MA OR Prof=Eng) AND Stamina>=300 AND Strength>=250
      const action: Action = {
        id: 1,
        action: 6,
        item_id: 1,
        criteria: [
          { id: 1, value1: 368, value2: 1, operator: 0 }, // Soldier
          { id: 2, value1: 368, value2: 2, operator: 0 }, // MartialArtist
          { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
          { id: 4, value1: 368, value2: 3, operator: 0 }, // Engineer
          { id: 5, value1: 0, value2: 0, operator: 3 }, // OR
          { id: 6, value1: 17, value2: 299, operator: 2 }, // Stamina > 299 (>= 300)
          { id: 7, value1: 0, value2: 0, operator: 4 }, // AND
          { id: 8, value1: 18, value2: 249, operator: 2 }, // Strength > 249 (>= 250)
          { id: 9, value1: 0, value2: 0, operator: 4 }, // AND
        ],
      };

      const parsedAction = parseAction(action);
      const characterStats = {
        368: 2, // MartialArtist (meets OR)
        17: 320, // Stamina 320 (meets requirement)
        18: 275, // Strength 275 (meets requirement)
      };

      const result = checkActionRequirements(parsedAction, characterStats);

      expect(result.canPerform).toBe(true);
      expect(result.unmetRequirements).toHaveLength(0);
    });

    it('should fail when profession matches but skills do not', () => {
      const action: Action = {
        id: 1,
        action: 6,
        item_id: 1,
        criteria: [
          { id: 1, value1: 368, value2: 1, operator: 0 }, // Soldier
          { id: 2, value1: 368, value2: 2, operator: 0 }, // MartialArtist
          { id: 3, value1: 0, value2: 0, operator: 3 }, // OR
          { id: 4, value1: 368, value2: 3, operator: 0 }, // Engineer
          { id: 5, value1: 0, value2: 0, operator: 3 }, // OR
          { id: 6, value1: 17, value2: 299, operator: 2 }, // Stamina > 299 (>= 300)
          { id: 7, value1: 0, value2: 0, operator: 4 }, // AND
          { id: 8, value1: 18, value2: 249, operator: 2 }, // Strength > 249 (>= 250)
          { id: 9, value1: 0, value2: 0, operator: 4 }, // AND
        ],
      };

      const parsedAction = parseAction(action);
      const characterStats = {
        368: 2, // MartialArtist (meets OR)
        17: 250, // Stamina 250 (too low)
        18: 200, // Strength 200 (too low)
      };

      const result = checkActionRequirements(parsedAction, characterStats);

      expect(result.canPerform).toBe(false);
      expect(result.unmetRequirements.length).toBe(2); // Both stamina and strength unmet

      // Verify both stats are in unmet requirements
      const staminaUnmet = result.unmetRequirements.find((req) => req.stat === 17);
      const strengthUnmet = result.unmetRequirements.find((req) => req.stat === 18);

      expect(staminaUnmet).toBeDefined();
      expect(staminaUnmet?.current).toBe(250);
      expect(staminaUnmet?.required).toBe(300);

      expect(strengthUnmet).toBeDefined();
      expect(strengthUnmet?.current).toBe(200);
      expect(strengthUnmet?.required).toBe(250);
    });
  });

  describe('Empty criteria', () => {
    it('should pass with no unmet requirements for empty criteria', () => {
      const action: Action = {
        id: 1,
        action: 1, // Get
        item_id: 1,
        criteria: [],
      };

      const parsedAction = parseAction(action);
      const characterStats = { 368: 11 }; // Any character stats

      const result = checkActionRequirements(parsedAction, characterStats);

      expect(result.canPerform).toBe(true);
      expect(result.unmetRequirements).toHaveLength(0);
    });
  });

  describe('Pure AND requirements', () => {
    it('should correctly evaluate multiple AND requirements', () => {
      // Action: Pistol>=400 AND Level>=150 AND Intelligence>=300
      const action: Action = {
        id: 1,
        action: 6,
        item_id: 1,
        criteria: [
          { id: 1, value1: 112, value2: 399, operator: 2 }, // Pistol > 399 (>= 400)
          { id: 2, value1: 54, value2: 149, operator: 2 }, // Level > 149 (>= 150)
          { id: 3, value1: 0, value2: 0, operator: 4 }, // AND
          { id: 4, value1: 19, value2: 299, operator: 2 }, // Intelligence > 299 (>= 300)
          { id: 5, value1: 0, value2: 0, operator: 4 }, // AND
        ],
      };

      const parsedAction = parseAction(action);

      // Test passing all requirements
      let characterStats = {
        112: 450, // Pistol 450
        54: 175, // Level 175
        19: 325, // Intelligence 325
      };

      let result = checkActionRequirements(parsedAction, characterStats);
      expect(result.canPerform).toBe(true);
      expect(result.unmetRequirements).toHaveLength(0);

      // Test failing one requirement
      characterStats = {
        112: 350, // Pistol 350 (too low)
        54: 175, // Level 175
        19: 325, // Intelligence 325
      };

      result = checkActionRequirements(parsedAction, characterStats);
      expect(result.canPerform).toBe(false);
      expect(result.unmetRequirements).toHaveLength(1);
      expect(result.unmetRequirements[0].stat).toBe(112); // Pistol unmet
    });
  });

  describe('Complex real-world scenarios', () => {
    it('should handle Dark Pistol Attack requirements (AND with profession check)', () => {
      // Real example: Profession=Bureaucrat AND Pistol>=443 AND FlingShot>=222
      const action: Action = {
        id: 93424,
        action: 8, // Attack
        item_id: 129671,
        criteria: [
          { id: 1, value1: 60, value2: 8, operator: 0 }, // Profession = Bureaucrat
          { id: 2, value1: 112, value2: 442, operator: 2 }, // Pistol > 442 (>= 443)
          { id: 3, value1: 0, value2: 0, operator: 4 }, // AND
          { id: 4, value1: 150, value2: 221, operator: 2 }, // FlingShot > 221 (>= 222)
          { id: 5, value1: 0, value2: 0, operator: 4 }, // AND
        ],
      };

      const parsedAction = parseAction(action);

      // Valid character
      let characterStats = {
        60: 8, // Bureaucrat
        112: 500, // Pistol 500
        150: 250, // FlingShot 250
      };

      let result = checkActionRequirements(parsedAction, characterStats);
      expect(result.canPerform).toBe(true);
      expect(result.unmetRequirements).toHaveLength(0);

      // Wrong profession
      characterStats = {
        60: 5, // Agent (wrong)
        112: 500, // Pistol 500
        150: 250, // FlingShot 250
      };

      result = checkActionRequirements(parsedAction, characterStats);
      expect(result.canPerform).toBe(false);
      expect(result.unmetRequirements.length).toBeGreaterThan(0);
      expect(result.unmetRequirements.find((req) => req.stat === 60)).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle missing character stats as 0', () => {
      const action: Action = {
        id: 1,
        action: 6,
        item_id: 1,
        criteria: [
          { id: 1, value1: 112, value2: 99, operator: 2 }, // Pistol > 99 (>= 100)
        ],
      };

      const parsedAction = parseAction(action);
      const characterStats = {}; // No stats provided

      const result = checkActionRequirements(parsedAction, characterStats);

      expect(result.canPerform).toBe(false);
      expect(result.unmetRequirements).toHaveLength(1);
      expect(result.unmetRequirements[0].current).toBe(0);
    });

    it('should handle zero values correctly', () => {
      const action: Action = {
        id: 1,
        action: 6,
        item_id: 1,
        criteria: [
          { id: 1, value1: 368, value2: 0, operator: 0 }, // Profession = 0 (Unknown)
        ],
      };

      const parsedAction = parseAction(action);
      const characterStats = { 368: 0 };

      const result = checkActionRequirements(parsedAction, characterStats);

      expect(result.canPerform).toBe(true);
      expect(result.unmetRequirements).toHaveLength(0);
    });
  });

  describe('Operator symbol handling', () => {
    it('should correctly evaluate not-equal operator', () => {
      const action: Action = {
        id: 1,
        action: 6,
        item_id: 1,
        criteria: [
          { id: 1, value1: 368, value2: 5, operator: 24 }, // Profession ≠ Agent
        ],
      };

      const parsedAction = parseAction(action);

      // Character is not Agent - should pass
      let characterStats = { 368: 11 }; // NanoTechnician
      let result = checkActionRequirements(parsedAction, characterStats);
      expect(result.canPerform).toBe(true);
      expect(result.unmetRequirements).toHaveLength(0);

      // Character is Agent - should fail
      characterStats = { 368: 5 }; // Agent
      result = checkActionRequirements(parsedAction, characterStats);
      expect(result.canPerform).toBe(false);
      expect(result.unmetRequirements).toHaveLength(1);
    });

    it('should correctly evaluate less-than-or-equal operator', () => {
      const action: Action = {
        id: 1,
        action: 6,
        item_id: 1,
        criteria: [
          { id: 1, value1: 54, value2: 200, operator: 1 }, // Level < 200 (display as <= 199)
        ],
      };

      const parsedAction = parseAction(action);

      // Level 150 - should pass
      let characterStats = { 54: 150 };
      let result = checkActionRequirements(parsedAction, characterStats);
      expect(result.canPerform).toBe(true);

      // Level 199 (exactly at boundary) - should pass
      characterStats = { 54: 199 };
      result = checkActionRequirements(parsedAction, characterStats);
      expect(result.canPerform).toBe(true);

      // Level 200 - should fail
      characterStats = { 54: 200 };
      result = checkActionRequirements(parsedAction, characterStats);
      expect(result.canPerform).toBe(false);
      expect(result.unmetRequirements).toHaveLength(1);
    });
  });
});

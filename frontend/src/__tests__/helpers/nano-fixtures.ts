/**
 * Nano and Buff Test Fixtures
 *
 * Factory functions for creating test nano programs with proper structure.
 * Provides fixtures for buff management and nano lineup testing.
 *
 * @see /frontend/src/types/nano.ts - NanoProgram interface
 */

import type { Action } from '@/types/api';
import type { NanoProgram, NanoSchoolName } from '@/types/nano';

// ============================================================================
// Nano Creation Factory
// ============================================================================

export interface NanoCreationOptions {
  id?: number;
  aoid?: number;
  name?: string;
  ql?: number;
  school?: NanoSchoolName | null;
  /** NanoStrain ID (stat 75) */
  strainId?: number | null;
  strain?: string | null;
  nanoPointCost?: number;
  memoryUsage?: number;
  castingTime?: number;
  rechargeTime?: number;
  level?: number | null;
  /** Professions that can cast it; empty for a nano any profession can cast */
  professions?: string[];
  actions?: Action[];
}

/**
 * Create a basic test nano with sensible defaults
 *
 * @example
 * const nano = createTestNano({
 *   name: 'Iron Circle',
 *   ql: 200,
 *   memoryUsage: 25
 * });
 */
export function createTestNano(options: NanoCreationOptions = {}): NanoProgram {
  const {
    id = Math.floor(Math.random() * 1000000),
    aoid = Math.floor(Math.random() * 1000000),
    name = 'Test Nano',
    ql = 100,
    school = 'Combat',
    strainId = 9000,
    strain = 'TestStrain',
    nanoPointCost = 50,
    memoryUsage = 20,
    castingTime = 3,
    rechargeTime = 30,
    level = 100,
    professions = [],
    actions = [],
  } = options;

  return {
    id,
    aoid,
    name,
    school,
    strainId,
    strain,
    nanoPointCost,
    memoryUsage,
    castingTime,
    rechargeTime,
    level,
    qualityLevel: ql,
    professions,
    actions,
    effects: [],
  };
}

// ============================================================================
// Pre-configured Nano Fixtures
// ============================================================================

/**
 * Iron Circle - Protection buff (QL 200)
 */
export const mockNano1: NanoProgram = {
  id: 1,
  aoid: 12345,
  name: 'Iron Circle',
  school: 'Protection',
  strainId: 9001,
  strain: 'IronCircle',
  nanoPointCost: 100,
  memoryUsage: 25,
  castingTime: 3,
  rechargeTime: 30,
  level: 150,
  qualityLevel: 200,
  professions: ['Adventurer'],
  actions: [],
  effects: [],
};

/**
 * Greater Fortification - Protection buff (QL 220)
 */
export const mockNano2: NanoProgram = {
  id: 2,
  aoid: 12346,
  name: 'Greater Fortification',
  school: 'Protection',
  strainId: 9002,
  strain: 'Fortification',
  nanoPointCost: 120,
  memoryUsage: 30,
  castingTime: 3,
  rechargeTime: 30,
  level: 160,
  qualityLevel: 220,
  professions: ['Adventurer'],
  actions: [],
  effects: [],
};

/**
 * Iron Circle Superior - Higher priority version (QL 250)
 * Same strain as mockNano1, for testing strain conflicts
 */
export const mockNanoHighPriority: NanoProgram = {
  id: 10,
  aoid: 12350,
  name: 'Iron Circle Superior',
  school: 'Protection',
  strainId: 9001,
  strain: 'IronCircle', // Same strain as mockNano1
  nanoPointCost: 150,
  memoryUsage: 35,
  castingTime: 3,
  rechargeTime: 30,
  level: 180,
  qualityLevel: 250,
  professions: ['Adventurer'],
  actions: [],
  effects: [],
};

/**
 * Iron Circle Basic - Lower priority version (QL 150)
 * Same strain as mockNano1, for testing strain conflicts
 */
export const mockNanoLowPriority: NanoProgram = {
  id: 11,
  aoid: 12340,
  name: 'Iron Circle Basic',
  school: 'Protection',
  strainId: 9001,
  strain: 'IronCircle', // Same strain as mockNano1
  nanoPointCost: 80,
  memoryUsage: 20,
  castingTime: 3,
  rechargeTime: 30,
  level: 120,
  qualityLevel: 150,
  professions: ['Adventurer'],
  actions: [],
  effects: [],
};

/**
 * Massive Buff - High NCU cost for testing memory limits (QL 300)
 * Uses 1100 NCU, almost filling a typical character's available NCU
 */
export const mockNanoHighNCU: NanoProgram = {
  id: 20,
  aoid: 99999,
  name: 'Massive Buff',
  school: 'Combat',
  strainId: 9003,
  strain: 'MassiveBuff',
  nanoPointCost: 200,
  memoryUsage: 1100, // Almost fills NCU
  castingTime: 5,
  rechargeTime: 60,
  level: 200,
  qualityLevel: 300,
  professions: [],
  actions: [],
  effects: [],
};

// ============================================================================
// Nano Collections
// ============================================================================

/**
 * Create a set of nanos with the same strain (for conflict testing)
 */
export function createStrainConflictSet(): NanoProgram[] {
  return [mockNano1, mockNanoHighPriority, mockNanoLowPriority];
}

/**
 * Create a set of nanos with different strains (no conflicts)
 */
export function createNonConflictingSet(): NanoProgram[] {
  return [mockNano1, mockNano2];
}

/**
 * Create a set of nanos that fill NCU to test capacity limits
 */
export function createNCUTestSet(): NanoProgram[] {
  return [
    createTestNano({ name: 'Buff 1', memoryUsage: 400 }),
    createTestNano({ name: 'Buff 2', memoryUsage: 400 }),
    createTestNano({ name: 'Buff 3', memoryUsage: 400 }),
    mockNanoHighNCU, // This one won't fit
  ];
}

/**
 * Create a mixed set of nanos for general testing
 */
export function createMixedNanoSet(): NanoProgram[] {
  return [
    mockNano1,
    mockNano2,
    createTestNano({
      name: 'Damage Buff',
      school: 'Combat',
      strain: 'DamageEnhancement',
      memoryUsage: 40,
      ql: 180,
    }),
    createTestNano({
      name: 'Heal Buff',
      school: 'Medical',
      strain: 'HealingAura',
      memoryUsage: 35,
      ql: 200,
    }),
  ];
}

// ============================================================================
// Buff-specific Fixtures
// ============================================================================

/**
 * Create a buff nano for perk/research testing
 */
export function createBuffNano(options: Partial<NanoCreationOptions> = {}): NanoProgram {
  return createTestNano({
    school: 'Protection',
    strain: 'BuffStrain',
    memoryUsage: 30,
    ...options,
  });
}

/**
 * Create a set of buffs with varying priorities
 */
export function createPriorityTestSet(): NanoProgram[] {
  return [
    createBuffNano({ id: 101, name: 'Low Priority Buff', ql: 100, memoryUsage: 20 }),
    createBuffNano({ id: 102, name: 'Medium Priority Buff', ql: 150, memoryUsage: 25 }),
    createBuffNano({ id: 103, name: 'High Priority Buff', ql: 200, memoryUsage: 30 }),
  ];
}

// ============================================================================
// Casting Requirement Helpers
// ============================================================================

/**
 * Create a nano's Use action (action 3), whose criteria are its casting
 * requirements, from raw [value1, value2, operator] criteria as the /nanos
 * endpoints return them
 *
 * @example
 * // Matter Creation > 99 AND Time and Space > 99 (i.e. both >= 100)
 * createNanoUseAction([[130, 99, 2], [131, 99, 2], [0, 0, 4]]);
 */
export function createNanoUseAction(
  criteria: Array<[value1: number, value2: number, operator: number]>,
  itemId: number = 1
): Action {
  return {
    id: itemId,
    action: 3,
    item_id: itemId,
    criteria: criteria.map(([value1, value2, operator], index) => ({
      id: itemId * 100 + index,
      value1,
      value2,
      operator,
    })),
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clone a nano for mutation testing
 */
export function cloneNano(nano: NanoProgram): NanoProgram {
  return JSON.parse(JSON.stringify(nano));
}

/**
 * Check if two nanos have the same strain (will conflict)
 */
export function hasSameStrain(nano1: NanoProgram, nano2: NanoProgram): boolean {
  return nano1.strain === nano2.strain;
}

/**
 * Calculate total NCU usage for a set of nanos
 */
export function calculateTotalNCU(nanos: NanoProgram[]): number {
  return nanos.reduce((total, nano) => total + (nano.memoryUsage || 0), 0);
}

/**
 * Check if nano set fits within NCU limit
 */
export function fitsInNCU(nanos: NanoProgram[], ncuLimit: number): boolean {
  return calculateTotalNCU(nanos) <= ncuLimit;
}

/**
 * Get all unique strains from a set of nanos
 */
export function getUniqueStrains(nanos: NanoProgram[]): number[] {
  return [...new Set(nanos.map((n) => n.strainId).filter((id): id is number => id !== null))];
}

/**
 * Find strain conflicts in a set of nanos
 */
export function findStrainConflicts(nanos: NanoProgram[]): Map<number, NanoProgram[]> {
  const strainMap = new Map<number, NanoProgram[]>();

  nanos.forEach((nano) => {
    if (nano.strainId === null) return;
    const existing = strainMap.get(nano.strainId) || [];
    existing.push(nano);
    strainMap.set(nano.strainId, existing);
  });

  // Filter to only strains with conflicts (more than 1 nano)
  const conflicts = new Map<number, NanoProgram[]>();
  strainMap.forEach((nanoList, strain) => {
    if (nanoList.length > 1) {
      conflicts.set(strain, nanoList);
    }
  });

  return conflicts;
}

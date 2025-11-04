/**
 * Nano and Buff Test Fixtures
 *
 * Factory functions for creating test nano programs with proper structure.
 * Provides fixtures for buff management and nano lineup testing.
 *
 * @see /frontend/src/types/nano.ts - NanoProgram interface
 */

import type { NanoProgram, NanoSchool, CastingRequirement } from '@/types/nano';

// ============================================================================
// Nano Creation Factory
// ============================================================================

export interface NanoCreationOptions {
  id?: number;
  aoid?: number;
  name?: string;
  ql?: number;
  school?: NanoSchool;
  strain?: string;
  nanoPointCost?: number;
  memoryUsage?: number;
  castingTime?: number;
  rechargeTime?: number;
  level?: number;
  profession?: string;
  castingRequirements?: CastingRequirement[];
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
    school = 'Matter Creation',
    strain = 'TestStrain',
    nanoPointCost = 50,
    memoryUsage = 20,
    castingTime = 3,
    rechargeTime = 30,
    level = 100,
    profession = 'All',
    castingRequirements = [],
  } = options;

  return {
    id,
    aoid,
    name,
    school,
    strain,
    nanoPointCost,
    memoryUsage,
    castingTime,
    rechargeTime,
    level,
    qualityLevel: ql,
    profession,
    castingRequirements,
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
  school: 'Matter Metamorphosis',
  strain: 'IronCircle',
  nanoPointCost: 100,
  memoryUsage: 25,
  castingTime: 3,
  rechargeTime: 30,
  level: 150,
  qualityLevel: 200,
  profession: 'Adventurer',
  castingRequirements: [],
  effects: [],
};

/**
 * Greater Fortification - Protection buff (QL 220)
 */
export const mockNano2: NanoProgram = {
  id: 2,
  aoid: 12346,
  name: 'Greater Fortification',
  school: 'Matter Metamorphosis',
  strain: 'Fortification',
  nanoPointCost: 120,
  memoryUsage: 30,
  castingTime: 3,
  rechargeTime: 30,
  level: 160,
  qualityLevel: 220,
  profession: 'Adventurer',
  castingRequirements: [],
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
  school: 'Matter Metamorphosis',
  strain: 'IronCircle', // Same strain as mockNano1
  nanoPointCost: 150,
  memoryUsage: 35,
  castingTime: 3,
  rechargeTime: 30,
  level: 180,
  qualityLevel: 250,
  profession: 'Adventurer',
  castingRequirements: [],
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
  school: 'Matter Metamorphosis',
  strain: 'IronCircle', // Same strain as mockNano1
  nanoPointCost: 80,
  memoryUsage: 20,
  castingTime: 3,
  rechargeTime: 30,
  level: 120,
  qualityLevel: 150,
  profession: 'Adventurer',
  castingRequirements: [],
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
  school: 'Matter Creation',
  strain: 'MassiveBuff',
  nanoPointCost: 200,
  memoryUsage: 1100, // Almost fills NCU
  castingTime: 5,
  rechargeTime: 60,
  level: 200,
  qualityLevel: 300,
  profession: 'All',
  castingRequirements: [],
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
      school: 'Matter Creation',
      strain: 'DamageEnhancement',
      memoryUsage: 40,
      ql: 180,
    }),
    createTestNano({
      name: 'Heal Buff',
      school: 'Biological Metamorphosis',
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
    school: 'Matter Creation',
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
 * Create a casting requirement
 */
export function createCastingRequirement(
  type: 'skill' | 'stat' | 'level',
  requirement: number | string,
  value: number
): CastingRequirement {
  return {
    type,
    requirement,
    value,
    operator: 'GreaterThan',
    critical: true,
  };
}

/**
 * Create a nano with skill requirements
 * Accepts skill IDs (number) or skill names (string)
 */
export function createNanoWithRequirements(
  requirements: Array<[number | string, number]>,
  options: Partial<NanoCreationOptions> = {}
): NanoProgram {
  const castingRequirements = requirements.map(([skill, value]) =>
    createCastingRequirement('skill', skill, value)
  );

  return createTestNano({
    castingRequirements,
    ...options,
  });
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
export function getUniqueStrains(nanos: NanoProgram[]): string[] {
  return [...new Set(nanos.map((n) => n.strain))];
}

/**
 * Find strain conflicts in a set of nanos
 */
export function findStrainConflicts(nanos: NanoProgram[]): Map<string, NanoProgram[]> {
  const strainMap = new Map<string, NanoProgram[]>();

  nanos.forEach((nano) => {
    const existing = strainMap.get(nano.strain) || [];
    existing.push(nano);
    strainMap.set(nano.strain, existing);
  });

  // Filter to only strains with conflicts (more than 1 nano)
  const conflicts = new Map<string, NanoProgram[]>();
  strainMap.forEach((nanoList, strain) => {
    if (nanoList.length > 1) {
      conflicts.set(strain, nanoList);
    }
  });

  return conflicts;
}

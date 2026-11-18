/**
 * Tests for the rounding of interpolated weapon values in TinkerFite: the
 * game rounds to the nearest integer and an exact half up.
 */

import { describe, it, expect } from 'vitest';
import { interpolateValue, interpolateWeaponToQL } from '@/utils/weapon-interpolation';
import type { WeaponCandidate } from '@/types/weapon-analysis';

const MIN_DAMAGE = 286;
const MAX_DAMAGE = 285;
const CRITICAL_BONUS = 284;
const AR_CAP = 538;
const ICON = 79;
const ONE_HAND_BLUNT = 102;

function weapon(ql: number, stats: [number, number][], requirement: number): WeaponCandidate {
  return {
    aoid: 1000 + ql,
    name: 'Club',
    ql,
    is_nano: false,
    stats: stats.map(([stat, value]) => ({ stat, value })),
    spell_data: [],
    actions: [
      {
        action: 6,
        criteria: [{ value1: ONE_HAND_BLUNT, value2: requirement, operator: 2 }],
      },
    ],
    attack_stats: [],
    defense_stats: [],
    equipable: false,
  };
}

function statsOf(candidate: WeaponCandidate): Record<number, number> {
  return Object.fromEntries(candidate.stats.map(({ stat, value }) => [stat, value]));
}

describe('interpolateValue', () => {
  it.each([
    // lo, hi, offset, delta, expected
    [100, 200, 0, 100, 100],
    [100, 200, 25, 100, 125],
    [100, 200, 100, 100, 200],
    [200, 100, 50, 100, 150],
    [10, 11, 1, 3, 10], // 10.33
    [10, 11, 2, 3, 11], // 10.67
    [2, 3, 10, 20, 3], // 2.5
    [3, 2, 10, 20, 3], // 2.5, falling
    [674, 806, 7, 24, 713], // 712.5
    [0, 61, 7, 14, 31], // 30.5, where 61 / 14 * 7 is 30.499999999999996
    [-3, -2, 10, 20, -2], // -2.5
    [-50, -25, 1, 50, -49], // -49.5
    [-3, -2, 9, 20, -3], // -2.55
  ])('between %i and %i, %i of %i levels up is %i', (lo, hi, offset, delta, expected) => {
    expect(interpolateValue(lo, hi, offset, delta)).toBe(expected);
  });
});

describe('a weapon interpolated to a QL', () => {
  const low = weapon(
    100,
    [
      [MIN_DAMAGE, 0],
      [MAX_DAMAGE, 674],
      [CRITICAL_BONUS, 2],
      [AR_CAP, 1000],
      [ICON, 5],
    ],
    300
  );
  const high = weapon(
    114,
    [
      [MIN_DAMAGE, 61],
      [MAX_DAMAGE, 701],
      [CRITICAL_BONUS, 3],
      [AR_CAP, 1001],
      [ICON, 6],
    ],
    301
  );

  it('rounds the halves of its damage and attack rating cap up', () => {
    const at107 = interpolateWeaponToQL(low, high, 107);

    expect(at107.ql).toBe(107);
    expect(statsOf(at107)).toEqual({
      [MIN_DAMAGE]: 31, // 30.5
      [MAX_DAMAGE]: 688, // 687.5
      [CRITICAL_BONUS]: 3, // 2.5
      [AR_CAP]: 1001, // 1000.5
      [ICON]: 5,
    });
  });

  it('rounds down below a half and is a template at its own QL', () => {
    expect(statsOf(interpolateWeaponToQL(low, high, 106))[MIN_DAMAGE]).toBe(26); // 26.14
    expect(statsOf(interpolateWeaponToQL(low, high, 100))).toEqual(statsOf(low));
    expect(statsOf(interpolateWeaponToQL(low, high, 114))).toEqual(statsOf(high));
  });
});

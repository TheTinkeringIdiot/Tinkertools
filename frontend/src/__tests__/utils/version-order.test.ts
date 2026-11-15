/**
 * Which of two builds is the older one, and when two slugs are the same build.
 * The registry order decides, not dates: a fork counts as newer than the
 * family it forked from, and a 'latest' alias stands for the build it follows.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { versions } from '@/composables/useGameVersion';
import {
  familyEntrySlugs,
  isNewerBuild,
  orderBuilds,
  registryPosition,
  sameBuild,
} from '@/utils/version-order';
import type { GameVersion } from '@/types/game-version';
import { TEST_VERSIONS } from '../helpers/version-fixtures';

function entry(
  slug: string,
  family: string,
  sortOrder: number,
  overrides: Partial<GameVersion> = {}
): GameVersion {
  return {
    slug,
    display_name: slug,
    family,
    parent_slug: null,
    client_build: null,
    snapshot_date: null,
    sort_order: sortOrder,
    enabled: true,
    is_default: false,
    features: {},
    notes: null,
    is_current: false,
    alias_of: null,
    ...overrides,
  };
}

/** As the backend lists it: the fork and its alias first, then AO from live back. */
const REGISTRY: GameVersion[] = [
  entry('prk', 'prk', 100, { alias_of: 'prk-0-7-1' }),
  // The fork was cut from an old AO build, and captured before AO's live build was.
  entry('prk-0-7-1', 'prk', 101, { snapshot_date: '2020-01-01' }),
  entry('ao', 'ao', 1000, { alias_of: 'ao-18-8-62' }),
  entry('ao-18-8-62', 'ao', 1001, { snapshot_date: '2026-10-28' }),
  entry('ao-17-10-5', 'ao', 1002, { snapshot_date: '2019-06-01' }),
];

describe('build order', () => {
  beforeEach(() => {
    versions.value = REGISTRY;
  });

  afterEach(() => {
    versions.value = TEST_VERSIONS;
  });

  it('takes the registry order, whatever the snapshot dates say', () => {
    expect(isNewerBuild('prk-0-7-1', 'ao-18-8-62')).toBe(true);
    expect(isNewerBuild('ao-18-8-62', 'prk-0-7-1')).toBe(false);
    expect(orderBuilds('ao-18-8-62', 'prk-0-7-1')).toEqual({
      older: 'ao-18-8-62',
      newer: 'prk-0-7-1',
    });
  });

  it('orders two builds of a family the same from either side', () => {
    expect(orderBuilds('ao-18-8-62', 'ao-17-10-5')).toEqual({
      older: 'ao-17-10-5',
      newer: 'ao-18-8-62',
    });
    expect(orderBuilds('ao-17-10-5', 'ao-18-8-62')).toEqual({
      older: 'ao-17-10-5',
      newer: 'ao-18-8-62',
    });
  });

  it('puts a build the registry does not list after every build it does', () => {
    expect(registryPosition('ao-99-9-9')).toBeGreaterThan(registryPosition('ao-17-10-5'));
    expect(isNewerBuild('ao-99-9-9', 'ao-17-10-5')).toBe(false);
    // The browsed build stays the newer side of a comparison with it.
    expect(orderBuilds('ao-17-10-5', 'ao-99-9-9')).toEqual({
      older: 'ao-99-9-9',
      newer: 'ao-17-10-5',
    });
  });

  it('compares an alias as the build it follows', () => {
    expect(orderBuilds('ao', 'ao-17-10-5')).toEqual({ older: 'ao-17-10-5', newer: 'ao-18-8-62' });
    expect(registryPosition('ao')).toBe(registryPosition('ao-18-8-62'));
  });

  it('knows an alias and the build it follows as the same build', () => {
    expect(sameBuild('ao', 'ao-18-8-62')).toBe(true);
    expect(sameBuild('ao-18-8-62', 'ao')).toBe(true);
    expect(sameBuild('ao', 'ao')).toBe(true);
    expect(sameBuild('ao', 'ao-17-10-5')).toBe(false);
    expect(sameBuild('ao', 'prk')).toBe(false);
    expect(sameBuild(null, 'ao')).toBe(false);
    expect(sameBuild('ao', undefined)).toBe(false);
  });

  it('enters another game by its alias, or by its newest build when it has none', () => {
    expect(familyEntrySlugs('ao')).toEqual([{ family: 'prk', slug: 'prk' }]);
    expect(familyEntrySlugs('prk')).toEqual([{ family: 'ao', slug: 'ao' }]);

    versions.value = REGISTRY.filter((version) => !version.alias_of);
    expect(familyEntrySlugs('prk')).toEqual([{ family: 'ao', slug: 'ao-18-8-62' }]);
    expect(familyEntrySlugs(null)).toEqual([
      { family: 'prk', slug: 'prk-0-7-1' },
      { family: 'ao', slug: 'ao-18-8-62' },
    ]);
  });
});

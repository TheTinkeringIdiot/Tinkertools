/**
 * Game version fixtures for tests.
 *
 * The app resolves its game version from the backend registry (`GET /versions`)
 * on first load. Tests must never make that request, so the registry is seeded
 * from these fixtures in the global setup and every test starts on
 * TEST_VERSION. Version-switch tests move to TEST_ALT_VERSION.
 */

import type { GameVersion, GameVersionListResponse } from '@/types/game-version';

export const TEST_VERSION = 'ao-2024-02';
export const TEST_ALT_VERSION = 'prk';

function version(overrides: Partial<GameVersion> & Pick<GameVersion, 'slug'>): GameVersion {
  return {
    display_name: overrides.slug,
    family: 'ao',
    parent_slug: null,
    client_build: null,
    snapshot_date: null,
    sort_order: 0,
    enabled: true,
    is_default: false,
    features: {},
    notes: null,
    is_current: false,
    ...overrides,
  };
}

export const TEST_VERSIONS: GameVersion[] = [
  version({
    slug: TEST_VERSION,
    display_name: 'Anarchy Online (Feb 2024)',
    family: 'ao',
    sort_order: 0,
    is_default: true,
    is_current: true,
  }),
  version({
    slug: TEST_ALT_VERSION,
    display_name: 'Project Rubi-Ka',
    family: 'prk',
    sort_order: 1,
  }),
];

export const TEST_VERSION_REGISTRY: GameVersionListResponse = {
  versions: TEST_VERSIONS,
  current: TEST_VERSION,
  total: TEST_VERSIONS.length,
};

/**
 * Profile <-> game version tests
 *
 * Covers the three things multi-version support changes about profiles:
 *   1. every profile is tagged with the game database it was built against,
 *      and profiles saved before that existed are tagged on load
 *   2. the active profile is remembered per version, migrating the old global key
 *   3. copying a profile to another version re-resolves its items, flagging
 *      the ones that version does not have
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// The transformer resolves items through the api client; mock it before any
// module that imports it is loaded.
vi.mock('@/services/api-client');

import { ProfileStorage } from '@/lib/tinkerprofiles/storage';
import { ProfileTransformer } from '@/lib/tinkerprofiles/transformer';
import { buildVersionCopy, buildSummary } from '@/lib/tinkerprofiles/version-copy';
import {
  versionForImport,
  stampGameVersion,
  gameVersionDisplayName,
  profileMatchesVersion,
} from '@/lib/tinkerprofiles/game-version';
import { STORAGE_KEYS } from '@/lib/tinkerprofiles/constants';
import { currentVersion, versions, setCurrentVersion } from '@/composables/useGameVersion';
import type { GameVersion } from '@/types/game-version';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import { createTestProfile } from '../../helpers/profile-fixtures';
import { createTestItem } from '../../helpers/item-fixtures';
import { apiClient } from '@/services/api-client';

// ============================================================================
// Registry fixtures
// ============================================================================

const AO_LIVE = 'ao-2024-02';
const AO_OLD = 'ao-2019-11';
const PRK = 'prk-2025-01';

function registryEntry(overrides: Partial<GameVersion> & { slug: string }): GameVersion {
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

function loadRegistry(entries: GameVersion[]): void {
  versions.value = entries;
}

const FULL_REGISTRY = [
  registryEntry({
    slug: AO_LIVE,
    display_name: 'Anarchy Online (Live)',
    family: 'ao',
    sort_order: 0,
    is_default: true,
  }),
  registryEntry({ slug: AO_OLD, display_name: 'AO 18.7 (2019-11)', family: 'ao', sort_order: 1 }),
  registryEntry({ slug: PRK, display_name: 'Project Rubi-Ka', family: 'prk', sort_order: 2 }),
];

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  versions.value = [];
  // setCurrentVersion ignores a repeat of the same slug, so reset through the ref.
  currentVersion.value = null;
});

// ============================================================================
// 1. Tagging and migration on load
// ============================================================================

describe('profile game version tagging', () => {
  it('stamps a profile that has no game version', () => {
    const profile = createTestProfile();
    delete (profile as any).gameVersion;

    expect(stampGameVersion(profile, AO_LIVE)).toBe(true);
    expect(profile.gameVersion).toBe(AO_LIVE);
  });

  it('leaves an already tagged profile alone', () => {
    const profile = createTestProfile();
    profile.gameVersion = PRK;

    expect(stampGameVersion(profile, AO_LIVE)).toBe(false);
    expect(profile.gameVersion).toBe(PRK);
  });

  it('tags a stored pre-version-support profile on load and persists the tag', async () => {
    loadRegistry(FULL_REGISTRY);
    currentVersion.value = AO_LIVE;

    const storage = new ProfileStorage();
    const profile = createTestProfile({ id: 'legacy-1', name: 'Legacy' });
    delete (profile as any).gameVersion;

    // Written the way the old code wrote it: no gameVersion anywhere.
    localStorage.setItem(`${STORAGE_KEYS.PROFILE_PREFIX}legacy-1`, JSON.stringify(profile));
    localStorage.setItem(STORAGE_KEYS.PROFILE_INDEX, JSON.stringify(['legacy-1']));

    const loaded = await storage.loadProfile('legacy-1');
    expect(loaded?.gameVersion).toBe(AO_LIVE);

    const persisted = JSON.parse(
      localStorage.getItem(`${STORAGE_KEYS.PROFILE_PREFIX}legacy-1`) as string
    );
    expect(persisted.gameVersion).toBe(AO_LIVE);
  });

  it('tags a legacy profile with the default version, not the one being browsed', async () => {
    // First visit after deploy lands on a PRK link: the profile was still built
    // against the single pre-version database, which became the default version.
    loadRegistry(FULL_REGISTRY);
    currentVersion.value = PRK;

    const storage = new ProfileStorage();
    const profile = createTestProfile({ id: 'legacy-2', name: 'Legacy' });
    delete (profile as any).gameVersion;
    localStorage.setItem(`${STORAGE_KEYS.PROFILE_PREFIX}legacy-2`, JSON.stringify(profile));
    localStorage.setItem(STORAGE_KEYS.PROFILE_INDEX, JSON.stringify(['legacy-2']));

    const loaded = await storage.loadProfile('legacy-2');
    expect(loaded?.gameVersion).toBe(AO_LIVE);
  });

  it('moves the legacy active profile under the default version', () => {
    loadRegistry(FULL_REGISTRY);
    currentVersion.value = PRK;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, 'legacy-3');

    const storage = new ProfileStorage();

    expect(storage.getActiveProfileId(PRK)).toBeNull();
    expect(storage.getActiveProfileId(AO_LIVE)).toBe('legacy-3');
  });

  it('keeps the tag of a profile built against another version', async () => {
    loadRegistry(FULL_REGISTRY);
    currentVersion.value = AO_LIVE;

    const storage = new ProfileStorage();
    const profile = createTestProfile({ id: 'prk-1', name: 'Rubi' });
    profile.gameVersion = PRK;
    await storage.saveProfile(profile);

    const loaded = await storage.loadProfile('prk-1');
    expect(loaded?.gameVersion).toBe(PRK);
  });

  it('reports the tag in profile metadata', async () => {
    currentVersion.value = AO_LIVE;
    const storage = new ProfileStorage();

    const mine = createTestProfile({ id: 'mine', name: 'Mine' });
    const theirs = createTestProfile({ id: 'theirs', name: 'Theirs' });
    theirs.gameVersion = PRK;
    await storage.saveProfile(mine);
    await storage.saveProfile(theirs);

    const metadata = await storage.getProfileMetadata();
    const byId = Object.fromEntries(metadata.map((m) => [m.id, m.gameVersion]));
    expect(byId.mine).toBe(AO_LIVE);
    expect(byId.theirs).toBe(PRK);
  });

  it('treats an untagged profile as belonging to the version asked about', () => {
    expect(profileMatchesVersion({ gameVersion: undefined }, AO_LIVE)).toBe(true);
    expect(profileMatchesVersion({ gameVersion: PRK }, AO_LIVE)).toBe(false);
  });
});

// ============================================================================
// 2. Import tagging
// ============================================================================

describe('versionForImport', () => {
  it('sends a PRK export to the first PRK version', () => {
    loadRegistry(FULL_REGISTRY);
    currentVersion.value = AO_LIVE;

    expect(versionForImport('prk')).toEqual({ slug: PRK });
  });

  it('falls back to the current version with a warning when no PRK database is loaded', () => {
    loadRegistry([FULL_REGISTRY[0]]);
    currentVersion.value = AO_LIVE;

    const target = versionForImport('prk');
    expect(target.slug).toBe(AO_LIVE);
    expect(target.warning).toContain('No PRK version is loaded');
    expect(target.warning).toContain('Anarchy Online (Live)');
  });

  it('keeps an AOSetups import on the current version when that is an AO version', () => {
    loadRegistry(FULL_REGISTRY);
    currentVersion.value = AO_OLD;

    expect(versionForImport('aosetups')).toEqual({ slug: AO_OLD });
  });

  it('moves an AOSetups import to an AO version when browsing PRK', () => {
    loadRegistry(FULL_REGISTRY);
    currentVersion.value = PRK;

    const target = versionForImport('aosetups');
    expect(target.slug).toBe(AO_LIVE);
    expect(target.warning).toContain('live Anarchy Online');
  });

  it('names a version by its display name, falling back to the slug', () => {
    loadRegistry(FULL_REGISTRY);
    expect(gameVersionDisplayName(PRK)).toBe('Project Rubi-Ka');
    expect(gameVersionDisplayName('never-imported')).toBe('never-imported');
  });
});

// ============================================================================
// 3. Active profile per version
// ============================================================================

describe('active profile per game version', () => {
  it('stores the active profile under a per-version key', async () => {
    currentVersion.value = AO_LIVE;
    const storage = new ProfileStorage();

    await storage.setActiveProfile('p1');

    expect(localStorage.getItem(`${STORAGE_KEYS.ACTIVE_PROFILE_PREFIX}${AO_LIVE}`)).toBe('p1');
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE)).toBeNull();
  });

  it('migrates the old global key to the current version, once', async () => {
    currentVersion.value = AO_LIVE;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, 'legacy-active');

    const storage = new ProfileStorage();
    expect(storage.getActiveProfileId()).toBe('legacy-active');
    expect(localStorage.getItem(`${STORAGE_KEYS.ACTIVE_PROFILE_PREFIX}${AO_LIVE}`)).toBe(
      'legacy-active'
    );
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE)).toBeNull();

    // A later switch to another version must not inherit the migrated pointer.
    expect(storage.getActiveProfileId(PRK)).toBeNull();
  });

  it('remembers a different active profile for each version', async () => {
    const storage = new ProfileStorage();

    currentVersion.value = AO_LIVE;
    await storage.setActiveProfile('ao-profile');
    currentVersion.value = PRK;
    await storage.setActiveProfile('prk-profile');

    expect(storage.getActiveProfileId(AO_LIVE)).toBe('ao-profile');
    expect(storage.getActiveProfileId(PRK)).toBe('prk-profile');

    currentVersion.value = AO_LIVE;
    expect(storage.getActiveProfileId()).toBe('ao-profile');
  });

  it('clears the pointer when the version has no profile of its own', async () => {
    currentVersion.value = AO_LIVE;
    const storage = new ProfileStorage();
    await storage.saveProfile(createTestProfile({ id: 'ao-only', name: 'AoOnly' }));
    await storage.setActiveProfile('ao-only');

    expect(await storage.loadActiveProfile(AO_LIVE)).not.toBeNull();
    expect(await storage.loadActiveProfile(PRK)).toBeNull();
  });

  it('refuses to activate a profile built against another version', async () => {
    currentVersion.value = AO_LIVE;
    const storage = new ProfileStorage();

    const foreign = createTestProfile({ id: 'foreign', name: 'Foreign' });
    foreign.gameVersion = PRK;
    await storage.saveProfile(foreign);

    // A stale pointer, e.g. written before the profile was copied elsewhere.
    localStorage.setItem(`${STORAGE_KEYS.ACTIVE_PROFILE_PREFIX}${AO_LIVE}`, 'foreign');

    expect(await storage.loadActiveProfile(AO_LIVE)).toBeNull();
    expect(localStorage.getItem(`${STORAGE_KEYS.ACTIVE_PROFILE_PREFIX}${AO_LIVE}`)).toBeNull();
  });

  it('notifies version-change listeners so the store can swap profiles', async () => {
    loadRegistry(FULL_REGISTRY);
    const { onGameVersionChange } = await import('@/composables/useGameVersion');
    const seen: Array<[string, string | null]> = [];
    const stop = onGameVersionChange((next, previous) => {
      seen.push([next, previous]);
    });

    setCurrentVersion(AO_LIVE); // first set: no previous, no notification
    setCurrentVersion(PRK);

    expect(seen).toEqual([[PRK, AO_LIVE]]);
    stop();
  });
});

// ============================================================================
// 4. Copying a profile across versions
// ============================================================================

/** Build a batch-interpolate response where only `present` AOIDs resolve. */
function mockBatchResolution(present: Record<number, string>) {
  (apiClient.batchInterpolateItems as any).mockImplementation(
    async (requests: Array<{ aoid: number; targetQl: number }>) => ({
      results: requests.map((req) =>
        present[req.aoid]
          ? {
              aoid: req.aoid,
              target_ql: req.targetQl,
              success: true,
              item: createTestItem({
                id: req.aoid * 10,
                aoid: req.aoid,
                name: present[req.aoid],
                ql: req.targetQl,
              }),
            }
          : {
              aoid: req.aoid,
              target_ql: req.targetQl,
              success: false,
              error: 'Item not found',
            }
      ),
    })
  );
}

function profileWithEquipment(): TinkerProfile {
  const profile = createTestProfile({ id: 'source', name: 'Source' });
  profile.gameVersion = PRK;

  profile.Weapons.RHand = createTestItem({ id: 1, aoid: 1001, name: 'Old Rifle', ql: 200 });
  profile.Clothing.Head = createTestItem({ id: 2, aoid: 1002, name: 'Old Helmet', ql: 150 });
  profile.Implants['2'] = {
    ...createTestItem({ id: 3, aoid: 1003, name: 'Old Implant', ql: 100 }),
    slot: 2,
    type: 'implant',
    clusters: { Shiny: { stat: 112, skillName: 'Pistol' } },
  } as any;
  profile.buffs = [createTestItem({ id: 4, aoid: 1004, name: 'Old Buff', ql: 50 })];
  profile.PerksAndResearch.perks = [
    {
      aoid: 1005,
      name: 'Old Perk',
      level: 1,
      type: 'SL',
      item: createTestItem({ id: 5, aoid: 1005, name: 'Old Perk', ql: 1 }),
    },
  ];

  return profile;
}

describe('buildVersionCopy', () => {
  it('summarises counts the way the toast reads', () => {
    expect(buildSummary(42, 2)).toBe('42 items updated · 2 not in this version');
    expect(buildSummary(1, 0)).toBe('1 item updated');
  });

  it('re-resolves every embedded item against the target version', async () => {
    loadRegistry(FULL_REGISTRY);
    currentVersion.value = AO_LIVE;
    mockBatchResolution({
      1001: 'New Rifle',
      1002: 'New Helmet',
      1003: 'New Implant',
      1004: 'New Buff',
      1005: 'New Perk',
    });

    const source = profileWithEquipment();
    const result = await buildVersionCopy(source, AO_LIVE, new ProfileTransformer());

    expect(result.updated).toBe(5);
    expect(result.missing).toEqual([]);
    expect(result.summary).toBe('5 items updated');
    expect(result.targetVersion).toBe(AO_LIVE);

    expect(result.profile.gameVersion).toBe(AO_LIVE);
    expect(result.profile.id).not.toBe(source.id);
    expect(result.profile.Weapons.RHand?.name).toBe('New Rifle');
    expect(result.profile.Clothing.Head?.name).toBe('New Helmet');
    expect(result.profile.Implants['2']?.name).toBe('New Implant');
    expect(result.profile.buffs?.[0].name).toBe('New Buff');
    expect(result.profile.PerksAndResearch.perks[0].item.name).toBe('New Perk');
  });

  it('keeps implant slot and clusters across the swap', async () => {
    currentVersion.value = AO_LIVE;
    mockBatchResolution({ 1001: 'x', 1002: 'x', 1003: 'New Implant', 1004: 'x', 1005: 'x' });

    const result = await buildVersionCopy(profileWithEquipment(), AO_LIVE);
    const implant = result.profile.Implants['2'] as any;

    expect(implant.name).toBe('New Implant');
    expect(implant.slot).toBe(2);
    expect(implant.type).toBe('implant');
    expect(implant.clusters.Shiny.skillName).toBe('Pistol');
  });

  it('flags items the target version does not have and lists them', async () => {
    currentVersion.value = AO_LIVE;
    // The helmet and the perk do not exist in the target version.
    mockBatchResolution({ 1001: 'New Rifle', 1003: 'New Implant', 1004: 'New Buff' });

    const result = await buildVersionCopy(profileWithEquipment(), AO_LIVE);

    expect(result.updated).toBe(3);
    expect(result.summary).toBe('3 items updated · 2 not in this version');
    expect(result.missing.map((m) => m.aoid).sort()).toEqual([1002, 1005]);
    expect(result.missing.map((m) => m.where)).toContain('Clothing Head');
    expect(result.missing.map((m) => m.where)).toContain('Perk');

    // The old snapshots survive, flagged rather than dropped.
    expect((result.profile.Clothing.Head as any).name).toBe('Old Helmet');
    expect((result.profile.Clothing.Head as any).missingInVersion).toBe(true);
    expect((result.profile.Weapons.RHand as any).missingInVersion).toBeUndefined();
  });

  it('never touches the source profile', async () => {
    currentVersion.value = AO_LIVE;
    mockBatchResolution({ 1001: 'New Rifle' });

    const source = profileWithEquipment();
    await buildVersionCopy(source, AO_LIVE);

    expect(source.gameVersion).toBe(PRK);
    expect(source.Weapons.RHand?.name).toBe('Old Rifle');
    expect((source.Clothing.Head as any).missingInVersion).toBeUndefined();
  });

  it('asks for each distinct aoid and ql only once', async () => {
    currentVersion.value = AO_LIVE;
    mockBatchResolution({ 1004: 'New Buff' });

    const source = createTestProfile({ id: 'dupes', name: 'Dupes' });
    const buff = createTestItem({ id: 4, aoid: 1004, name: 'Old Buff', ql: 50 });
    source.buffs = [buff, { ...buff }];

    const result = await buildVersionCopy(source, AO_LIVE);

    const requests = (apiClient.batchInterpolateItems as any).mock.calls[0][0];
    expect(requests).toHaveLength(1);
    expect(result.updated).toBe(2);
  });

  it('fails instead of flagging everything missing when the request fails', async () => {
    currentVersion.value = AO_LIVE;
    (apiClient.batchInterpolateItems as any).mockRejectedValue(
      new Error('500 Internal Server Error')
    );

    await expect(
      buildVersionCopy(profileWithEquipment(), AO_LIVE, new ProfileTransformer())
    ).rejects.toThrow('500');
  });

  it('carries weapon attack and defense stats from the target version', async () => {
    currentVersion.value = AO_LIVE;
    mockBatchResolution({ 1001: 'New Rifle', 1002: 'x', 1003: 'x', 1004: 'x', 1005: 'x' });
    (apiClient.getItem as any).mockResolvedValue({
      success: true,
      data: createTestItem({
        aoid: 1001,
        name: 'New Rifle',
        attack_stats: [{ id: 1, stat: 133, value: 100 }],
        defense_stats: [{ id: 2, stat: 51, value: 100 }],
      } as any),
    });

    const source = profileWithEquipment();
    (source.Weapons.RHand as any).attack_stats = [{ id: 9, stat: 133, value: 50 }];

    const result = await buildVersionCopy(source, AO_LIVE, new ProfileTransformer());
    const rifle = result.profile.Weapons.RHand as any;

    expect(apiClient.getItem).toHaveBeenCalledWith(1001, { gameVersion: AO_LIVE });
    expect(rifle.attack_stats).toEqual([{ id: 1, stat: 133, value: 100 }]);
    expect(rifle.defense_stats).toEqual([{ id: 2, stat: 51, value: 100 }]);
  });

  it('skips cluster-built implants that carry no aoid', async () => {
    currentVersion.value = AO_LIVE;
    mockBatchResolution({});

    const source = createTestProfile({ id: 'built', name: 'Built' });
    source.Implants['4'] = {
      id: 0,
      aoid: 0,
      name: 'Player-built implant',
      ql: 200,
      is_nano: false,
      stats: [],
      spell_data: [],
      actions: [],
      slot: 4,
      type: 'implant',
      clusters: { Shiny: { stat: 112, skillName: 'Pistol' } },
    } as any;

    const result = await buildVersionCopy(source, AO_LIVE);

    expect(result.updated).toBe(0);
    expect(result.missing).toEqual([]);
    expect(apiClient.batchInterpolateItems).not.toHaveBeenCalled();
  });
});

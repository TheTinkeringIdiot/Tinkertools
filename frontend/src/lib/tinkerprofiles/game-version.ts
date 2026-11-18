/**
 * Profile <-> game version linking
 *
 * A TinkerProfile is built against one game database snapshot: its equipment,
 * perk and buff snapshots came from that version's tables. `TinkerProfile.gameVersion`
 * records which one. This module is the single place that decides what that tag
 * should be, so storage, the manager, imports and the copy flow all agree.
 *
 * Note this is NOT `TinkerProfile.version`, which is the profile schema version
 * ('4.0.0') and is unaffected by any of this.
 */

import { currentVersion, versions, getVersion, resolveVersion } from '@/composables/useGameVersion';
import type { TinkerProfile } from './types';

/** Where an imported profile came from; decides which version it is tagged with. */
export type ProfileImportSource = 'json' | 'aosetups' | 'prk' | 'unknown';

/** The version family AOSetups profiles describe. */
const AO_FAMILY = 'ao';
/** The version family PRK server exports describe. */
const PRK_FAMILY = 'prk';

/**
 * The game version the app is currently browsing.
 *
 * Falls back to the resolution order in useGameVersion when the router has not
 * set a version yet (first paint, tests, non-component code).
 */
export function currentGameVersion(): string {
  return currentVersion.value ?? resolveVersion();
}

/** Human-readable name for a slug; the slug itself when the registry has no entry. */
export function gameVersionDisplayName(slug: string | null | undefined): string {
  if (!slug) return 'Unknown version';
  return getVersion(slug)?.display_name ?? slug;
}

/** First enabled version of a family in registry order, or null when none is loaded. */
export function firstVersionOfFamily(family: string): string | null {
  return versions.value.find((v) => v.enabled && v.family === family)?.slug ?? null;
}

/** The family a slug belongs to. Unknown slugs report no family. */
export function familyOf(slug: string | null | undefined): string | null {
  return getVersion(slug)?.family ?? null;
}

export interface ImportVersionTarget {
  /** Slug to tag the imported profile with, and to resolve its items against. */
  slug: string;
  /** Set when the chosen slug is not the obvious one for this import source. */
  warning?: string;
}

/**
 * Which game version an import should be tagged with.
 *
 * - AOSetups describes live AO, so it targets the current version when that is
 *   in the `ao` family, otherwise the first `ao` version in the registry.
 * - A PRK server export targets the first enabled `prk` version. When no PRK
 *   version is loaded it falls back to the current version and warns, because
 *   the items still have to come from somewhere.
 * - Everything else (our own JSON export, unknown) stays on the current version.
 */
export function versionForImport(source: ProfileImportSource): ImportVersionTarget {
  const current = currentGameVersion();

  if (source === 'prk') {
    const prk = firstVersionOfFamily(PRK_FAMILY);
    if (prk) return { slug: prk };
    return {
      slug: current,
      warning: `No PRK version is loaded; imported against ${gameVersionDisplayName(current)}`,
    };
  }

  if (source === 'aosetups') {
    const family = familyOf(current);
    // Unknown current version (registry not loaded): treat it as AO rather than
    // inventing a slug the backend may not serve.
    if (family === null || family === AO_FAMILY) return { slug: current };

    const ao = firstVersionOfFamily(AO_FAMILY);
    if (ao) {
      return {
        slug: ao,
        warning: `AOSetups profiles describe live Anarchy Online; imported against ${gameVersionDisplayName(ao)}`,
      };
    }
    return {
      slug: current,
      warning: `No Anarchy Online version is loaded; imported against ${gameVersionDisplayName(current)}`,
    };
  }

  return { slug: current };
}

/**
 * Tag a profile with a game version when it has none.
 *
 * Profiles created before multi-version support carry no tag. Stamping them
 * with the current version is the migration: their snapshots came from the only
 * database that existed, which is what the app is serving now.
 *
 * Returns true when the profile was changed and should be persisted.
 */
export function stampGameVersion(profile: TinkerProfile, slug?: string): boolean {
  if (profile.gameVersion) return false;
  profile.gameVersion = slug ?? currentGameVersion();
  return true;
}

/** Whether a profile belongs to the given version (untagged profiles count as current). */
export function profileMatchesVersion(
  profile: Pick<TinkerProfile, 'gameVersion'>,
  slug: string
): boolean {
  return (profile.gameVersion ?? slug) === slug;
}

/**
 * Version-namespaced storage keys.
 *
 * Any client-side cache that holds server-derived data (items, nanos, symbiants,
 * or anything keyed by AOID) belongs to exactly one game version. Sharing a key
 * across versions serves the wrong snapshot; leaving stale entries behind blows
 * the localStorage quota. Every such key therefore carries the version slug, and
 * switching versions purges the entries of the versions we are not on.
 *
 * Two key shapes are supported:
 *
 *   suffix form   `${base}:${slug}`           one blob per version
 *   family form   `${base}:${slug}:${rest}`   many entries per version
 *
 * `isVersionKey` / `versionOfKey` understand both, because the slug always sits
 * in the segment immediately after `base`.
 *
 * Pure UI preferences (sort order, theme, recent free-text searches) are NOT
 * namespaced: they mean the same thing in every version.
 */

import { currentVersion, VERSION_SLUG_PATTERN } from '@/composables/useGameVersion';

/** Used when no version has been resolved yet (early boot, tests without a router). */
export const UNKNOWN_VERSION = 'unknown';

export const VERSION_KEY_SEPARATOR = ':';

/** The slug every key written right now should carry. */
export function activeVersionSlug(): string {
  return currentVersion.value ?? UNKNOWN_VERSION;
}

/** `'tinkertools_nanos_cache'` -> `'tinkertools_nanos_cache:ao-2024-02'`. */
export function versionKey(base: string, slug?: string): string {
  return `${base}${VERSION_KEY_SEPARATOR}${slug ?? activeVersionSlug()}`;
}

/** Prefix shared by every entry of a key family for one version (trailing separator). */
export function versionPrefix(base: string, slug?: string): string {
  return `${versionKey(base, slug)}${VERSION_KEY_SEPARATOR}`;
}

function isSlugLike(value: string): boolean {
  return value === UNKNOWN_VERSION || VERSION_SLUG_PATTERN.test(value);
}

/** The version a key belongs to, or null if it is not a versioned key of `base`. */
export function versionOfKey(key: string, base: string): string | null {
  const prefix = `${base}${VERSION_KEY_SEPARATOR}`;
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const slug = rest.split(VERSION_KEY_SEPARATOR)[0];
  return slug && isSlugLike(slug) ? slug : null;
}

export function isVersionKey(key: string, base: string): boolean {
  return versionOfKey(key, base) !== null;
}

/** The version of a key that carries its slug in the LAST segment (cache-manager style). */
export function trailingVersionOf(key: string): string | null {
  const index = key.lastIndexOf(VERSION_KEY_SEPARATOR);
  if (index < 0) return null;
  const slug = key.slice(index + 1);
  return slug && isSlugLike(slug) ? slug : null;
}

// ============================================================================
// localStorage
// ============================================================================

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function localStorageKeys(): string[] {
  const storage = safeLocalStorage();
  if (!storage) return [];
  const found: string[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key) found.push(key);
    }
  } catch {
    return [];
  }
  return found;
}

/**
 * Remove every localStorage entry of `base` that belongs to another version.
 * Returns the number of keys removed.
 */
export function purgeOtherVersions(base: string, slug?: string): number {
  const keep = slug ?? activeVersionSlug();
  const storage = safeLocalStorage();
  if (!storage) return 0;

  const doomed = localStorageKeys().filter((key) => {
    const owner = versionOfKey(key, base);
    return owner !== null && owner !== keep;
  });

  for (const key of doomed) {
    try {
      storage.removeItem(key);
    } catch {
      // Best effort.
    }
  }
  return doomed.length;
}

/** Same, for keys whose slug is the trailing segment (cache-manager entries). */
export function purgeOtherVersionsBySuffix(keyPrefix: string, slug?: string): number {
  const keep = slug ?? activeVersionSlug();
  const storage = safeLocalStorage();
  if (!storage) return 0;

  const doomed = localStorageKeys().filter((key) => {
    if (!key.startsWith(keyPrefix)) return false;
    const owner = trailingVersionOf(key);
    return owner !== null && owner !== keep;
  });

  for (const key of doomed) {
    try {
      storage.removeItem(key);
    } catch {
      // Best effort.
    }
  }
  return doomed.length;
}

/** Remove every localStorage key starting with `prefix` (used to retire legacy families). */
export function purgeLocalStoragePrefix(prefix: string): number {
  const storage = safeLocalStorage();
  if (!storage) return 0;
  const doomed = localStorageKeys().filter((key) => key.startsWith(prefix));
  for (const key of doomed) {
    try {
      storage.removeItem(key);
    } catch {
      // Best effort.
    }
  }
  return doomed.length;
}

/**
 * One-time migration: an un-namespaced key written before versions existed is
 * the current version's data. Rename it rather than dropping it so users keep
 * their favorites, farm lists and collection progress.
 *
 * No-op when the versioned key already exists or the legacy key is absent.
 */
export function adoptLegacyKey(base: string, slug?: string): boolean {
  const storage = safeLocalStorage();
  if (!storage) return false;
  try {
    const legacy = storage.getItem(base);
    if (legacy === null) return false;
    const target = versionKey(base, slug);
    if (storage.getItem(target) !== null) {
      storage.removeItem(base);
      return false;
    }
    storage.setItem(target, legacy);
    storage.removeItem(base);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// idb-keyval
// ============================================================================

/** Remove every idb-keyval entry of `base` that belongs to another version. */
export async function purgeIdbOtherVersions(base: string, slug?: string): Promise<number> {
  const keep = slug ?? activeVersionSlug();
  try {
    const { keys, del } = await import('idb-keyval');
    const all = await keys();
    const doomed = all.filter((key): key is string => {
      if (typeof key !== 'string') return false;
      const owner = versionOfKey(key, base);
      return owner !== null && owner !== keep;
    });
    await Promise.all(doomed.map((key) => del(key)));
    return doomed.length;
  } catch {
    return 0;
  }
}

/** idb-keyval counterpart of adoptLegacyKey. */
export async function adoptLegacyIdbKey(base: string, slug?: string): Promise<boolean> {
  try {
    const { get, set, del } = await import('idb-keyval');
    const legacy = await get(base);
    if (legacy === undefined) return false;
    const target = versionKey(base, slug);
    if ((await get(target)) !== undefined) {
      await del(base);
      return false;
    }
    await set(target, legacy);
    await del(base);
    return true;
  } catch {
    return false;
  }
}

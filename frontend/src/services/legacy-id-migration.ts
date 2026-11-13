/**
 * Migration of user data from internal item ids to AOIDs.
 *
 * Favorites and farm lists used to hold the backend's internal row ids, which
 * differ between game versions and so point at the wrong record (or nothing)
 * after a patch. They now hold AOIDs. What was stored before is migrated once
 * per storage key, against the game version that key belongs to:
 *
 *   1. On load, a value in the old shape is read as "ids still to migrate".
 *      Nothing is rewritten yet, so a failed or interrupted migration costs
 *      nothing: the next load starts over.
 *   2. The ids are resolved by the backend of that key's version (the build
 *      behind an alias). The client never holds the whole item list, so it
 *      cannot do this from data it already has.
 *   3. The resolved AOIDs are written in the new shape. If any id could not be
 *      resolved, the complete original id list is kept under a backup key,
 *      together with the ids that were dropped.
 *
 * If the user changes the list before step 2 succeeds, the list is saved in
 * the new shape with the unmigrated ids carried along (`pendingInternalIds`),
 * so they are neither lost nor mistaken for AOIDs, and step 2 is retried on
 * the next load. Once nothing is pending the migration never runs again.
 */

import { apiClient } from './api-client';
import { VERSION_KEY_SEPARATOR } from './version-keys';

/** Bumped from the id-based shapes, which were a bare array or version 1. */
const AOID_LIST_VERSION = 2;

/** A list of AOIDs as kept in memory, with whatever is still to be migrated. */
export interface AoidList {
  aoids: number[];
  /** Internal ids stored before the move to AOIDs and not yet resolved */
  pendingInternalIds: number[];
}

/** The persisted shape of an AoidList. */
interface StoredAoidList {
  version: typeof AOID_LIST_VERSION;
  aoids: number[];
  pendingInternalIds?: number[];
}

/** What is left behind when some stored ids could not be resolved. */
export interface InternalIdBackup {
  /** Every internal id that was stored, as it was */
  internalIds: number[];
  /** The ones no item of `resolvedAgainst` has, and so are not in the migrated list */
  unresolved: number[];
  /** The version slug the ids were resolved against */
  resolvedAgainst: string;
}

const isNumberList = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'number');

const unique = (values: number[]): number[] => Array.from(new Set(values));

export function emptyAoidList(): AoidList {
  return { aoids: [], pendingInternalIds: [] };
}

/**
 * Read a stored list. `legacyIds` picks the internal ids out of a value in an
 * older shape (null when it is not one); anything unrecognised reads as empty.
 */
export function parseAoidList(
  raw: string | null,
  legacyIds: (value: unknown) => number[] | null
): AoidList {
  if (raw === null) return emptyAoidList();

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return emptyAoidList();
  }

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const stored = value as Partial<StoredAoidList>;
    if (stored.version === AOID_LIST_VERSION && isNumberList(stored.aoids)) {
      return {
        aoids: stored.aoids,
        pendingInternalIds: isNumberList(stored.pendingInternalIds)
          ? stored.pendingInternalIds
          : [],
      };
    }
  }

  return { aoids: [], pendingInternalIds: legacyIds(value) ?? [] };
}

export function serializeAoidList(list: AoidList): string {
  const stored: StoredAoidList = { version: AOID_LIST_VERSION, aoids: list.aoids };
  if (list.pendingInternalIds.length > 0) stored.pendingInternalIds = list.pendingInternalIds;
  return JSON.stringify(stored);
}

/**
 * Where the original ids of `base` are kept for `slug` when some could not be
 * resolved. Deliberately not a version key of `base`, so nothing that sweeps
 * `base` keys touches it.
 */
export function internalIdBackupKey(base: string, slug: string): string {
  return `${base}_internal_id_backup${VERSION_KEY_SEPARATOR}${slug}`;
}

/**
 * Resolve the pending ids of `list` against game version `slug` and persist
 * the outcome under `storageKey`. Returns the migrated list, or null when
 * there was nothing to do or the lookup failed (the stored value is then left
 * exactly as it was, for the next load to retry).
 */
export async function migratePendingIds(
  list: AoidList,
  target: { storageKey: string; base: string; slug: string }
): Promise<AoidList | null> {
  const pending = unique(list.pendingInternalIds);
  if (pending.length === 0) return null;

  let resolved: Map<number, number>;
  try {
    resolved = await apiClient.resolveLegacyItemIds(pending, target.slug);
  } catch (error) {
    console.warn(
      `[legacy-id-migration] Could not migrate ${target.storageKey}; will retry on next load:`,
      error
    );
    return null;
  }

  const unresolved = pending.filter((id) => !resolved.has(id));
  const migrated: AoidList = {
    // Migrated entries first: they are the older ones
    aoids: unique([...pending.flatMap((id) => resolved.get(id) ?? []), ...list.aoids]),
    pendingInternalIds: [],
  };

  try {
    if (unresolved.length > 0) {
      const backup: InternalIdBackup = {
        internalIds: pending,
        unresolved,
        resolvedAgainst: target.slug,
      };
      // Backup first: if it cannot be written, the original stays where it is
      localStorage.setItem(internalIdBackupKey(target.base, target.slug), JSON.stringify(backup));
      console.warn(
        `[legacy-id-migration] ${unresolved.length} of ${pending.length} stored ids of ` +
          `${target.storageKey} match no item of ${target.slug}; the original list is kept under ` +
          internalIdBackupKey(target.base, target.slug)
      );
    }
    localStorage.setItem(target.storageKey, serializeAoidList(migrated));
  } catch (error) {
    console.warn(`[legacy-id-migration] Could not save migrated ${target.storageKey}:`, error);
    return null;
  }

  return migrated;
}

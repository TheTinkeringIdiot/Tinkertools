/**
 * Migration of user data from internal item ids to AOIDs.
 *
 * Favorites and farm lists used to hold the backend's internal row ids, which
 * differ between game versions and so point at the wrong record (or nothing)
 * after a patch. They now hold AOIDs. What was stored before is migrated once
 * per storage key, against the game version that key belongs to:
 *
 *   1. A stored value in the old shape reads as "ids still to migrate".
 *      Nothing is rewritten yet, so a failed or interrupted migration costs
 *      nothing: the next load starts over.
 *   2. The ids are resolved by the backend of that key's version. The client
 *      never holds the whole item list, so it cannot do this from data it
 *      already has.
 *   3. When the answer arrives the stored value is read again, and the only
 *      change made to it is "these pending ids become these AOIDs". Whatever
 *      was added, removed, cleared or replaced during the lookup, in this tab
 *      or another, is therefore kept. If any id could not be resolved, the
 *      original ids are kept under a backup key and the user is told once.
 *
 * localStorage is the single source of truth throughout: every change to a
 * list goes through `writeAoids` or `replaceAoidList`, and callers refresh
 * what they hold in memory from `readAoidList` once a migration settles.
 * A list changed before step 2 succeeds is saved in the new shape with the
 * unmigrated ids carried along (`pendingInternalIds`), so they are neither
 * lost nor mistaken for AOIDs. Once nothing is pending the migration never
 * runs again.
 */

import { apiClient } from './api-client';
import { VERSION_KEY_SEPARATOR } from './version-keys';
import { dataSlug } from '@/composables/useGameVersion';

/** Bumped from the id-based shapes, which were a bare array or version 1. */
const AOID_LIST_VERSION = 2;

/** A stored list of AOIDs, with whatever is still to be migrated. */
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

/** Picks the internal ids out of a value in an older shape; null when it is not one. */
export type LegacyIdReader = (value: unknown) => number[] | null;

/** What is left behind when some stored ids could not be resolved. */
export interface InternalIdBackup {
  /** Every internal id that was looked up, as it was stored */
  internalIds: number[];
  /** The ones no item of `resolvedAgainst` has, and so are not in the migrated list */
  unresolved: number[];
  /** The version slug the list belongs to and the lookup was made for */
  resolvedAgainst: string;
  /** The build that slug served at the time (differs from it on a 'latest' alias) */
  resolvedAgainstBuild: string;
}

export interface MigrationTarget {
  storageKey: string;
  /** Un-versioned key base, for naming the backup */
  base: string;
  /** The game version the stored ids belong to */
  slug: string;
  legacyIds: LegacyIdReader;
  /**
   * Called once when the migration had to leave entries out. A caller that
   * joins a migration already in flight for the same key is not called.
   */
  onDropped?: (dropped: number, total: number) => void;
}

const isNumberList = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'number');

const unique = (values: number[]): number[] => Array.from(new Set(values));

function parseAoidList(raw: string | null, legacyIds: LegacyIdReader): AoidList {
  if (raw === null) return { aoids: [], pendingInternalIds: [] };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { aoids: [], pendingInternalIds: [] };
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

function serializeAoidList(list: AoidList): string {
  const stored: StoredAoidList = { version: AOID_LIST_VERSION, aoids: list.aoids };
  if (list.pendingInternalIds.length > 0) stored.pendingInternalIds = list.pendingInternalIds;
  return JSON.stringify(stored);
}

/** The list stored under `storageKey`; anything unrecognised or unreadable reads as empty. */
export function readAoidList(storageKey: string, legacyIds: LegacyIdReader): AoidList {
  try {
    return parseAoidList(localStorage.getItem(storageKey), legacyIds);
  } catch {
    return { aoids: [], pendingInternalIds: [] };
  }
}

/**
 * Store `aoids` as the list's entries. Ids still waiting to be migrated stay
 * stored alongside: they are entries the user has not been shown yet, not
 * entries this change removed.
 */
export function writeAoids(storageKey: string, legacyIds: LegacyIdReader, aoids: number[]): void {
  const { pendingInternalIds } = readAoidList(storageKey, legacyIds);
  localStorage.setItem(storageKey, serializeAoidList({ aoids, pendingInternalIds }));
}

/** Store `aoids` as the whole list, discarding anything still waiting to be migrated. */
export function replaceAoidList(storageKey: string, aoids: number[]): void {
  localStorage.setItem(storageKey, serializeAoidList({ aoids, pendingInternalIds: [] }));
}

/**
 * Where the original ids of `base` are kept for `slug` when some could not be
 * resolved. Deliberately not a version key of `base`, so nothing that sweeps
 * `base` keys touches it.
 */
/**
 * Puts a list read from storage on show, unless the same list already is.
 * Replacing a list with an equal one would re-render everything that depends
 * on it (every row of the symbiant table, for the farm list) for nothing.
 */
export function showAoids(shown: { value: number[] }, stored: number[]): void {
  const same =
    shown.value.length === stored.length && shown.value.every((aoid, i) => aoid === stored[i]);
  if (!same) shown.value = stored;
}

export function internalIdBackupKey(base: string, slug: string): string {
  return `${base}_internal_id_backup${VERSION_KEY_SEPARATOR}${slug}`;
}

/** The text of the notice shown when a migration left entries out. */
export function droppedEntriesMessage(dropped: number, total: number, entries: string): string {
  return `${dropped} of your ${total} ${entries} could not be carried over to this version of TinkerTools.`;
}

const inFlight = new Map<string, Promise<void>>();

/**
 * Migrate the ids pending under `target.storageKey`. Returns null when nothing
 * is pending; otherwise a promise that settles (it never rejects) once the
 * stored list has been rewritten, or the lookup or the save has failed, in
 * which case the stored value is exactly as it was for the next load to retry.
 * Either way the caller should then take its state from `readAoidList`.
 *
 * At most one migration runs per storage key: a call made while one is in
 * flight gets that one's promise.
 */
export function migratePendingIds(target: MigrationTarget): Promise<void> | null {
  const running = inFlight.get(target.storageKey);
  if (running) return running;

  const pending = unique(readAoidList(target.storageKey, target.legacyIds).pendingInternalIds);
  if (pending.length === 0) return null;

  const run = resolveAndStore(target, pending).finally(() => {
    inFlight.delete(target.storageKey);
  });
  inFlight.set(target.storageKey, run);
  return run;
}

async function resolveAndStore(target: MigrationTarget, lookedUp: number[]): Promise<void> {
  let resolved: Map<number, number>;
  try {
    resolved = await apiClient.resolveLegacyItemIds(lookedUp, target.slug);
  } catch (error) {
    console.warn(
      `[legacy-id-migration] Could not migrate ${target.storageKey}; will retry on next load:`,
      error
    );
    return;
  }

  // The stored value may have changed during the lookup: only ids that are
  // still pending now are settled, and everything else is kept as it is.
  const current = readAoidList(target.storageKey, target.legacyIds);
  const answered = new Set(lookedUp);
  const settled = unique(current.pendingInternalIds.filter((id) => answered.has(id)));
  if (settled.length === 0) return;

  const unresolved = settled.filter((id) => !resolved.has(id));
  const migrated: AoidList = {
    // Migrated entries first: they are the older ones
    aoids: unique([...settled.flatMap((id) => resolved.get(id) ?? []), ...current.aoids]),
    pendingInternalIds: current.pendingInternalIds.filter((id) => !answered.has(id)),
  };

  try {
    if (unresolved.length > 0) {
      const backup: InternalIdBackup = {
        internalIds: settled,
        unresolved,
        resolvedAgainst: target.slug,
        resolvedAgainstBuild: dataSlug(target.slug) ?? target.slug,
      };
      // Backup first: if it cannot be written, the original stays where it is
      localStorage.setItem(internalIdBackupKey(target.base, target.slug), JSON.stringify(backup));
      console.warn(
        `[legacy-id-migration] ${unresolved.length} of ${settled.length} stored ids of ` +
          `${target.storageKey} match no item of ${target.slug}; the original list is kept under ` +
          internalIdBackupKey(target.base, target.slug)
      );
    }
    localStorage.setItem(target.storageKey, serializeAoidList(migrated));
  } catch (error) {
    console.warn(`[legacy-id-migration] Could not save migrated ${target.storageKey}:`, error);
    return;
  }

  if (unresolved.length > 0) target.onDropped?.(unresolved.length, settled.length);
}

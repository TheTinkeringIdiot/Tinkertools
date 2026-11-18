/**
 * Copying a profile to another game version
 *
 * Moving a profile between versions is always a copy: the original keeps its
 * own version and its own item snapshots. The copy re-resolves every embedded
 * item (weapons, clothing, implants and their clusters, buffs, perk snapshots)
 * by AOID and QL against the target version's database.
 *
 * An AOID the target version does not have is NOT dropped. The old snapshot is
 * kept and flagged `missingInVersion`, so the profile still renders and the user
 * is told exactly what could not be verified.
 */

import { toRaw } from 'vue';
import type { Item } from '@/types/api';
import type { TinkerProfile, ImplantWithClusters, VersionFlaggedItem } from './types';
import { ProfileTransformer } from './transformer';
import { gameVersionDisplayName } from './game-version';

/** Where an embedded item lives inside a profile, for reporting and reassembly. */
type ItemLocation =
  | { kind: 'weapon'; slot: string }
  | { kind: 'clothing'; slot: string }
  | { kind: 'implant'; slot: string }
  | { kind: 'buff'; index: number }
  | { kind: 'perk'; list: 'perks' | 'research'; index: number };

interface ItemReference {
  aoid: number;
  ql: number;
  name: string;
  location: ItemLocation;
}

/** One item that does not exist in the target version. */
export interface MissingItemReport {
  aoid: number;
  ql: number;
  name: string;
  /** Human-readable place in the profile, e.g. "Weapon RHand" or "Buff". */
  where: string;
}

export interface ProfileVersionCopyResult {
  /** The new profile, not yet saved. */
  profile: TinkerProfile;
  targetVersion: string;
  /** Items re-resolved successfully against the target version. */
  updated: number;
  /** Items kept as flagged placeholders because the target version lacks them. */
  missing: MissingItemReport[];
  /** "42 items updated · 2 not in this version" */
  summary: string;
}

function describeLocation(location: ItemLocation): string {
  switch (location.kind) {
    case 'weapon':
      return `Weapon ${location.slot}`;
    case 'clothing':
      return `Clothing ${location.slot}`;
    case 'implant':
      return `Implant slot ${location.slot}`;
    case 'buff':
      return 'Buff';
    case 'perk':
      return location.list === 'research' ? 'Research' : 'Perk';
  }
}

function requestKey(aoid: number, ql: number): string {
  return `${aoid}:${ql}`;
}

/**
 * Every AOID-bearing item snapshot in a profile.
 *
 * Implants built from clusters carry no AOID (they are described by their
 * clusters, not by a database row) and are skipped: there is nothing to look up.
 */
function collectItemReferences(profile: TinkerProfile): ItemReference[] {
  const refs: ItemReference[] = [];

  const push = (item: Item | null | undefined, location: ItemLocation) => {
    if (!item || !item.aoid) return;
    refs.push({
      aoid: item.aoid,
      ql: item.ql ?? 1,
      name: item.name ?? `AOID ${item.aoid}`,
      location,
    });
  };

  for (const [slot, item] of Object.entries(profile.Weapons ?? {})) {
    push(item, { kind: 'weapon', slot });
  }
  for (const [slot, item] of Object.entries(profile.Clothing ?? {})) {
    push(item, { kind: 'clothing', slot });
  }
  for (const [slot, item] of Object.entries(profile.Implants ?? {})) {
    push(item as Item | null, { kind: 'implant', slot });
  }
  (profile.buffs ?? []).forEach((buff, index) => {
    push(buff, { kind: 'buff', index });
  });

  const perkSystem = profile.PerksAndResearch;
  if (perkSystem) {
    (perkSystem.perks ?? []).forEach((entry, index) => {
      if (entry?.item) push(entry.item as Item, { kind: 'perk', list: 'perks', index });
    });
    (perkSystem.research ?? []).forEach((entry, index) => {
      if (entry?.item) push(entry.item as Item, { kind: 'perk', list: 'research', index });
    });
  }

  return refs;
}

/**
 * Build a copy of a profile resolved against another game version.
 *
 * The returned profile has a new id and is NOT saved; the caller persists it and
 * recomputes IP/bonuses through the normal store paths. The source profile is
 * never mutated.
 */
export async function buildVersionCopy(
  source: TinkerProfile,
  targetVersion: string,
  transformer: ProfileTransformer = new ProfileTransformer()
): Promise<ProfileVersionCopyResult> {
  const copy: TinkerProfile = structuredClone(toRaw(source));
  copy.id = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  copy.created = new Date().toISOString();
  copy.updated = new Date().toISOString();
  copy.gameVersion = targetVersion;

  const refs = collectItemReferences(copy);

  // One request per distinct (aoid, ql): the same buff or perk can appear twice.
  const requests = new Map<string, { aoid: number; targetQl: number }>();
  for (const ref of refs) {
    requests.set(requestKey(ref.aoid, ref.ql), { aoid: ref.aoid, targetQl: ref.ql });
  }

  const resolved =
    requests.size > 0
      ? await transformer.resolveItems(Array.from(requests.values()), targetVersion)
      : new Map<string, Item | null>();

  let updated = 0;
  const missing: MissingItemReport[] = [];

  for (const ref of refs) {
    const found = resolved.get(requestKey(ref.aoid, ref.ql)) ?? null;

    if (!found) {
      missing.push({
        aoid: ref.aoid,
        ql: ref.ql,
        name: ref.name,
        where: describeLocation(ref.location),
      });
      flagMissing(copy, ref.location);
      continue;
    }

    applyResolvedItem(copy, ref.location, found);
    updated++;
  }

  // The batch endpoint returns weapons without attack/defense stats. Fetch them
  // from the target version for every resolved weapon whose source had any, so
  // the copy does not silently lose them.
  const weaponRefs = refs.filter((ref) => {
    if (ref.location.kind !== 'weapon') return false;
    if (!resolved.get(requestKey(ref.aoid, ref.ql))) return false;
    const original = getSlotItem(source, ref.location);
    return !!(original?.attack_stats?.length || original?.defense_stats?.length);
  });
  if (weaponRefs.length > 0) {
    const combat = await transformer.fetchCombatStats(
      weaponRefs.map((ref) => ref.aoid),
      targetVersion
    );
    for (const ref of weaponRefs) {
      const stats = combat.get(ref.aoid);
      const weapon = getSlotItem(copy, ref.location);
      if (stats && weapon) {
        weapon.attack_stats = stats.attack_stats;
        weapon.defense_stats = stats.defense_stats;
      }
    }
  }

  return {
    profile: copy,
    targetVersion,
    updated,
    missing,
    summary: buildSummary(updated, missing.length),
  };
}

/** "42 items updated · 2 not in this version" */
export function buildSummary(updated: number, missingCount: number): string {
  const items = `${updated} ${updated === 1 ? 'item' : 'items'} updated`;
  if (missingCount === 0) return items;
  return `${items} · ${missingCount} not in this version`;
}

/** Message for a copy that could not resolve anything against the target version. */
export function describeCopyTarget(targetVersion: string): string {
  return gameVersionDisplayName(targetVersion);
}

function getSlotItem(
  profile: TinkerProfile,
  location: ItemLocation
): VersionFlaggedItem | null | undefined {
  switch (location.kind) {
    case 'weapon':
      return profile.Weapons?.[location.slot];
    case 'clothing':
      return profile.Clothing?.[location.slot];
    case 'implant':
      return profile.Implants?.[location.slot];
    case 'buff':
      return profile.buffs?.[location.index];
    case 'perk':
      return profile.PerksAndResearch?.[location.list]?.[location.index]?.item;
  }
}

/** Implant slots take an ImplantWithClusters; every other location a plain item. */
function setSlotItem(
  profile: TinkerProfile,
  location: ItemLocation,
  value: VersionFlaggedItem | ImplantWithClusters
): void {
  switch (location.kind) {
    case 'weapon':
      profile.Weapons[location.slot] = value;
      return;
    case 'clothing':
      profile.Clothing[location.slot] = value;
      return;
    case 'implant':
      if ('slot' in value && 'type' in value) profile.Implants[location.slot] = value;
      return;
    case 'buff':
      if (profile.buffs) profile.buffs[location.index] = value;
      return;
    case 'perk': {
      const entry = profile.PerksAndResearch?.[location.list]?.[location.index];
      if (entry) entry.item = value;
      return;
    }
  }
}

/** Keep the old snapshot but mark it as unverified in the target version. */
function flagMissing(profile: TinkerProfile, location: ItemLocation): void {
  const existing = getSlotItem(profile, location);
  if (!existing) return;
  existing.missingInVersion = true;
}

/**
 * Replace a snapshot with the target version's item.
 *
 * Implant-specific fields (slot, type, clusters) describe how the item is worn,
 * not the item itself, so they survive the swap. The missing flag is cleared
 * because this snapshot is now verified against the target version.
 */
function applyResolvedItem(profile: TinkerProfile, location: ItemLocation, found: Item): void {
  // Drop the flag in case the resolved item carried one over
  const resolved: VersionFlaggedItem = { ...found };
  delete resolved.missingInVersion;

  const previous = location.kind === 'implant' ? profile.Implants?.[location.slot] : null;
  if (previous) {
    const merged: ImplantWithClusters = {
      ...resolved,
      slot: previous.slot,
      type: previous.type,
      ...(previous.clusters ? { clusters: previous.clusters } : {}),
    };
    setSlotItem(profile, location, merged);
    return;
  }

  setSlotItem(profile, location, resolved);
}

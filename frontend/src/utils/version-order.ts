/**
 * Ordering and naming of builds for comparisons.
 *
 * The registry lists versions newest first (ascending sort_order): a fork's
 * builds (PRK) before the family they forked from, then that family's builds
 * from live back to the oldest. A 'latest' alias stands for the build it
 * follows.
 */

import { dataSlug, getVersion, versions } from '@/composables/useGameVersion';
import type { GameVersion } from '@/types/game-version';
import type { BuildRef } from '@/types/changes';

/** Position of a build in the registry, newest first; unknown builds go last. */
export function registryPosition(slug: string | null | undefined): number {
  const build = dataSlug(slug);
  const index = versions.value.findIndex((version) => version.slug === build);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

/** Whether build `a` is newer than build `b` by registry order. */
export function isNewerBuild(a: string, b: string): boolean {
  return registryPosition(a) < registryPosition(b);
}

/**
 * The two sides of a comparison, older first. When the registry cannot tell
 * (an unknown build), `viewed` is taken as the newer side.
 */
export function orderBuilds(viewed: string, other: string): { older: string; newer: string } {
  const a = dataSlug(viewed) ?? viewed;
  const b = dataSlug(other) ?? other;
  return isNewerBuild(b, a) ? { older: a, newer: b } : { older: b, newer: a };
}

export function sameBuild(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && (dataSlug(a) ?? a) === (dataSlug(b) ?? b);
}

/** Display name of a version, from the registry or from a build named by a response. */
export function buildLabel(
  slug: string | null | undefined,
  known: Array<BuildRef | null | undefined> = []
): string {
  if (!slug) return 'this version';
  return (
    getVersion(slug)?.display_name ||
    known.find((build) => build?.slug === slug)?.display_name ||
    slug
  );
}

const FAMILY_TITLES: Record<string, string> = {
  ao: 'Anarchy Online',
  prk: 'Project Rubi-Ka',
};

export function familyTitle(family: string): string {
  return FAMILY_TITLES[family] ?? family.toUpperCase();
}

export interface BuildGroup {
  key: string;
  title: string;
  builds: GameVersion[];
}

/** Every enabled build (no aliases) grouped by family, in registry order. */
export function buildGroups(exclude: Array<string | null | undefined> = []): BuildGroup[] {
  const hidden = new Set(exclude.map((slug) => dataSlug(slug) ?? slug));
  const groups: BuildGroup[] = [];
  for (const version of versions.value) {
    if (version.alias_of || !version.enabled || hidden.has(version.slug)) continue;
    let group = groups.find((candidate) => candidate.key === version.family);
    if (!group) {
      group = { key: version.family, title: familyTitle(version.family), builds: [] };
      groups.push(group);
    }
    group.builds.push(version);
  }
  return groups;
}

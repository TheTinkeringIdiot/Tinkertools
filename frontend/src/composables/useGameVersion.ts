/**
 * Global Game Version State (singleton, mirrors useTheme.ts)
 *
 * Which game database snapshot the app is browsing. The URL is the source of
 * truth (/<version>/items/...); this module holds the reactive mirror, the
 * registry of available versions, persistence of the last-used version, and
 * the resolution order for a first visit.
 *
 * Resolution order when a URL carries no version:
 *   1. last-used version in localStorage
 *   2. hostname map (VITE_VERSION_HOSTNAME_MAP, JSON {"prk.example.com": "prk"})
 *   3. the backend registry's default version
 *   4. VITE_DEFAULT_GAME_VERSION
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import axios from 'axios';
import { API_ROOT } from '@/services/api-config';
import type { GameVersion, GameVersionListResponse } from '@/types/game-version';

export const GAME_VERSION_STORAGE_KEY = 'tinkertools-game-version';

/** Slug charset accepted by the backend (see backend/app/core/versions.py). */
export const VERSION_SLUG_PATTERN = /^[a-z0-9][a-z0-9.-]{0,39}$/;

// ============================================================================
// Module state
// ============================================================================

const currentVersion = ref<string | null>(null);
const versions = ref<GameVersion[]>([]);
const registryDefault = ref<string | null>(null);
const registryLoaded = ref(false);
const registryFailed = ref(false);

let loadPromise: Promise<void> | null = null;

/**
 * The version handed out by resolveVersion() before the router set one. Code
 * that runs before the first navigation settles (ProfileDropdown loading the
 * active profile on mount, for one) works against this guess; if the URL then
 * names a different version, the first setCurrentVersion is a real switch.
 */
let provisionalVersion: string | null = null;

/**
 * First path segments of app routes (items, nanos, ...). A pre-version bookmark
 * like /nanos matches the `:version` param as "nanos"; these are never versions.
 * Registered by the router so this module does not import it.
 */
const reservedSegments = new Set<string>();

export function reserveRouteSegments(segments: Iterable<string>): void {
  for (const segment of segments) {
    if (segment) reservedSegments.add(segment);
  }
}

type VersionChangeListener = (next: string, previous: string | null) => void | Promise<void>;
const changeListeners = new Set<VersionChangeListener>();

// ============================================================================
// Persistence and environment
// ============================================================================

function readRemembered(): string | null {
  try {
    const saved = localStorage.getItem(GAME_VERSION_STORAGE_KEY);
    return saved && VERSION_SLUG_PATTERN.test(saved) ? saved : null;
  } catch {
    return null;
  }
}

function remember(slug: string): void {
  try {
    localStorage.setItem(GAME_VERSION_STORAGE_KEY, slug);
  } catch {
    // Persistence is a convenience only.
  }
}

function hostnameDefault(): string | null {
  const raw = import.meta.env.VITE_VERSION_HOSTNAME_MAP;
  if (!raw || typeof window === 'undefined') return null;
  try {
    const map = JSON.parse(raw) as Record<string, string>;
    const slug = map[window.location.hostname];
    return slug && VERSION_SLUG_PATTERN.test(slug) ? slug : null;
  } catch {
    console.warn('[useGameVersion] VITE_VERSION_HOSTNAME_MAP is not valid JSON');
    return null;
  }
}

function envDefault(): string | null {
  const slug = import.meta.env.VITE_DEFAULT_GAME_VERSION;
  return slug && VERSION_SLUG_PATTERN.test(slug) ? slug : null;
}

// ============================================================================
// Registry
// ============================================================================

/** Fetch the version registry once. Safe to call repeatedly. */
export function ensureVersionsLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = axios
    .get<GameVersionListResponse>(`${API_ROOT}/versions`, { timeout: 15000 })
    .then((response) => {
      versions.value = [...response.data.versions].sort(
        (a, b) => a.sort_order - b.sort_order || a.slug.localeCompare(b.slug)
      );
      registryDefault.value =
        versions.value.find((v) => v.is_default)?.slug ?? response.data.current ?? null;
      registryFailed.value = false;
    })
    .catch((error) => {
      console.warn('[useGameVersion] Could not load game versions:', error?.message ?? error);
      versions.value = [];
      registryFailed.value = true;
    })
    .finally(() => {
      registryLoaded.value = true;
    });

  return loadPromise;
}

/** Drop the cached registry so the next ensureVersionsLoaded() refetches. */
export function invalidateVersions(): void {
  loadPromise = null;
  registryLoaded.value = false;
}

export function getVersion(slug: string | null | undefined): GameVersion | undefined {
  if (!slug) return undefined;
  return versions.value.find((v) => v.slug === slug);
}

export function isKnownVersion(slug: string | null | undefined): boolean {
  return !!slug && !!getVersion(slug)?.enabled;
}

/**
 * Whether a URL segment should be treated as a version. When the registry is
 * unavailable, any well-formed slug is accepted so the app still routes.
 */
export function isAcceptableVersion(slug: string | null | undefined): boolean {
  if (!slug) return false;
  if (isKnownVersion(slug)) return true;
  return registryFailed.value && VERSION_SLUG_PATTERN.test(slug) && !reservedSegments.has(slug);
}

// ============================================================================
// Resolution
// ============================================================================

/** Best version to use when none is in the URL. */
export function resolveVersion(): string {
  const slug = pickVersion();
  if (currentVersion.value === null) provisionalVersion = slug;
  return slug;
}

function pickVersion(): string {
  const candidates = [
    currentVersion.value,
    readRemembered(),
    hostnameDefault(),
    registryDefault.value,
    envDefault(),
  ];
  for (const candidate of candidates) {
    if (candidate && isAcceptableVersion(candidate)) return candidate;
  }
  // Registry loaded but nothing matched (e.g. remembered version was removed).
  if (versions.value.length > 0) return versions.value[0].slug;
  return candidates.find((c): c is string => !!c) ?? 'ao';
}

/**
 * The version legacy data (profiles saved before versions existed) belongs to:
 * the hostname's default, else the registry default. Those profiles were built
 * against the one database the hostname served, which is what was adopted as
 * that default. Falls back to the current version when neither is known.
 */
export function legacyDataVersion(): string {
  return (
    hostnameDefault() ??
    registryDefault.value ??
    versions.value.find((v) => v.is_default)?.slug ??
    envDefault() ??
    resolveVersion()
  );
}

/**
 * Set the current version without navigating. Called by the router guard once
 * a URL's version segment has been validated, and awaited there, so listeners
 * (store reset, profile swap) finish before the new version's route renders.
 *
 * Listeners run for real switches, and for the first resolution when it
 * differs from the provisional guess other code already acted on.
 */
export async function setCurrentVersion(slug: string): Promise<void> {
  if (currentVersion.value === slug) return;
  const previous = currentVersion.value ?? provisionalVersion;
  currentVersion.value = slug;
  provisionalVersion = null;
  // Do not persist a slug the registry could not vouch for.
  if (isKnownVersion(slug)) remember(slug);
  if (previous === null || previous === slug) return;

  for (const listener of changeListeners) {
    try {
      await listener(slug, previous);
    } catch (error) {
      console.error('[useGameVersion] version change listener failed:', error);
    }
  }
}

/** Register a callback for version switches (cache eviction, profile swap, ...). */
export function onGameVersionChange(listener: VersionChangeListener): () => void {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

/** Prefix an app path with the current version: '/items/1' -> '/ao-2024-02/items/1'. */
export function versionedPath(path: string, slug?: string): string {
  const version = slug ?? currentVersion.value ?? resolveVersion();
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `/${version}${clean === '/' ? '' : clean}`;
}

// ============================================================================
// Composable
// ============================================================================

export interface GameVersionState {
  /** Read-only by convention: mutate through switchVersion / the router. */
  currentVersion: Ref<string | null>;
  current: ComputedRef<GameVersion | undefined>;
  versions: Ref<GameVersion[]>;
  registryLoaded: Ref<boolean>;
  registryFailed: Ref<boolean>;
  defaultVersion: Ref<string | null>;
  isDefaultVersion: ComputedRef<boolean>;
  hasFeature: (feature: string) => boolean;
  ensureVersionsLoaded: () => Promise<void>;
  versionedPath: (path: string, slug?: string) => string;
  switchVersion: (slug: string) => Promise<void>;
}

const current = computed(() => getVersion(currentVersion.value));
const isDefaultVersion = computed(
  () => !!currentVersion.value && currentVersion.value === registryDefault.value
);

export function useGameVersion(): GameVersionState {
  /**
   * Switch to another version in place: same route, new version segment.
   * The router guard validates the segment and calls setCurrentVersion, which
   * notifies listeners (store reset, cache eviction, profile swap).
   */
  const switchVersion = async (slug: string): Promise<void> => {
    if (!isAcceptableVersion(slug) || slug === currentVersion.value) return;
    const { default: router } = await import('@/router');
    const route = router.currentRoute.value;
    if (route.name) {
      await router.replace({
        name: route.name,
        params: { ...route.params, version: slug },
        query: route.query,
        hash: route.hash,
      });
    } else {
      await router.replace(versionedPath(route.fullPath.replace(/^\/[^/]+/, ''), slug));
    }
  };

  const hasFeature = (feature: string): boolean => {
    const version = current.value;
    if (!version) return true; // unknown version: don't hide tools
    return version.features?.[feature] !== false;
  };

  return {
    currentVersion,
    current,
    versions,
    registryLoaded,
    registryFailed,
    defaultVersion: registryDefault,
    isDefaultVersion,
    hasFeature,
    ensureVersionsLoaded,
    versionedPath,
    switchVersion,
  };
}

// Direct access for non-component code (api-client, cache keys).
export { currentVersion, versions };

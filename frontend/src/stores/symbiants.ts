/**
 * Symbiants Store - Pinia Store for Symbiant Data Management
 *
 * Manages symbiant data with caching, search, and collection tracking
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import type { Symbiant, UserFriendlyError, Mob } from '../types/api';
import { apiClient } from '../services/api-client';
import { toUserFriendlyError } from '../services/error-message';
import { enrichSymbiant } from '../utils/symbiantHelpers';
import { get, set, del } from 'idb-keyval';
import { useToast } from 'primevue/usetoast';
import {
  droppedEntriesMessage,
  migratePendingIds,
  readAoidList,
  replaceAoidList,
  writeAoids,
} from '../services/legacy-id-migration';
import {
  versionKey,
  activeVersionSlug,
  browsingVersionSlug,
  userDataKey,
  adoptLegacyUserData,
  adoptLegacyIdbKey,
} from '../services/version-keys';

// ============================================================================
// Farm List Types
// ============================================================================

interface AggregatedBoss {
  boss: Mob;
  symbiants: Symbiant[];
  farmed: boolean;
}

interface FarmProgressStorage {
  farmedBossIds: number[];
  version: 1;
}

// LocalStorage key bases. Farm lists hold AOIDs and farm progress holds ids of
// the curated boss records (not items), so both are per game version; the slug
// is appended at read/write time.
const FARM_LIST_BASE = 'tinkertools-farm-list';
const FARM_PROGRESS_BASE = 'tinkertools-farm-progress';

// ============================================================================
// Cache Configuration
// ============================================================================

// IndexedDB cache of the full symbiant list: server data, so per game version.
export const SYMBIANTS_CACHE_BASE = 'tinkertools:symbiants:all';

interface SymbiantCacheEntry {
  data: Symbiant[];
  timestamp: number;
  /** Entry schema version, unrelated to the game version below. */
  version: 1;
  /** Game version this snapshot came from; absent on pre-version entries. */
  gameVersion?: string;
}

/** The internal symbiant ids of a farm list in its first format, else null */
function legacyFarmListIds(value: unknown): number[] | null {
  if (!value || typeof value !== 'object') return null;
  const ids = (value as { symbiantIds?: unknown }).symbiantIds;
  return Array.isArray(ids) && ids.every((id) => typeof id === 'number') ? ids : null;
}

export const useSymbiantsStore = defineStore('symbiants', () => {
  const toast = useToast();

  // ============================================================================
  // State
  // ============================================================================

  /** Every symbiant of the active version, by AOID */
  const symbiants = ref(new Map<number, Symbiant>());
  const loading = ref(false);
  const error = ref<UserFriendlyError | null>(null);
  const lastFetch = ref(0);
  const cacheExpiry = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

  // Loading progress state
  const loadedCount = ref(0);
  const totalCount = ref(0);
  const loadingProgress = computed(() =>
    totalCount.value > 0 ? Math.round((loadedCount.value / totalCount.value) * 100) : 0
  );

  // Comparison selection state
  const selectedForComparison = ref<(Symbiant | null)[]>([null, null, null]);

  // Farm List state (uses AOID for stability)
  const farmListAoids = ref<number[]>([]);
  const farmedBossIds = ref<Set<number>>(new Set());
  const farmListLoading = ref(false);
  const aggregatedBosses = ref<Map<number, AggregatedBoss>>(new Map());
  const bossDropCache = ref<Map<number, Mob[]>>(new Map()); // keyed by symbiant AOID

  // ============================================================================
  // Getters
  // ============================================================================

  const allSymbiants = computed(() => Array.from(symbiants.value.values()));

  const symbiantsByFamily = computed(
    () => (family: string) => allSymbiants.value.filter((symbiant) => symbiant.family === family)
  );

  const symbiantFamilies = computed(() => {
    const families = new Set<string>();
    allSymbiants.value.forEach((symbiant) => {
      if (symbiant.family) {
        families.add(symbiant.family);
      }
    });
    return Array.from(families).sort();
  });

  const symbiantsCount = computed(() => symbiants.value.size);

  const isDataStale = computed(() => Date.now() - lastFetch.value > cacheExpiry);

  // Family-based organization for easier browsing
  const symbiantsByFamilyMap = computed(() => {
    const familyMap = new Map<string, Symbiant[]>();

    allSymbiants.value.forEach((symbiant) => {
      const family = symbiant.family || 'Unknown';
      if (!familyMap.has(family)) {
        familyMap.set(family, []);
      }
      familyMap.get(family)!.push(symbiant);
    });

    // Sort symbiants within each family by AOID
    familyMap.forEach((symbiants) => {
      symbiants.sort((a, b) => (a.aoid || 0) - (b.aoid || 0));
    });

    return familyMap;
  });

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Load all symbiants with 30-day cache (using IndexedDB)
   * Loads in paginated chunks with progress indicators
   */
  async function loadAllSymbiants(forceRefresh = false): Promise<Symbiant[]> {
    // Check memory cache first
    if (!forceRefresh && symbiants.value.size > 0 && !isDataStale.value) {
      return allSymbiants.value;
    }

    // Try to load from IndexedDB before API call
    if (!forceRefresh) {
      try {
        // A pre-version cache is this version's data: adopt rather than refetch.
        await adoptLegacyIdbKey(SYMBIANTS_CACHE_BASE);
        const cached = await get<SymbiantCacheEntry>(versionKey(SYMBIANTS_CACHE_BASE));
        const cacheMatchesVersion =
          !cached?.gameVersion || cached.gameVersion === activeVersionSlug();
        if (cached && cached.data && cached.version === 1 && cacheMatchesVersion) {
          const age = Date.now() - cached.timestamp;
          if (age < cacheExpiry) {
            console.log(
              `[SymbiantsStore] Loading from IndexedDB cache (age: ${Math.round(age / 1000)}s)`
            );

            // Populate Pinia store from cached data
            symbiants.value.clear();
            cached.data.forEach((symbiant) => {
              symbiants.value.set(symbiant.aoid, symbiant);
            });
            lastFetch.value = cached.timestamp;

            return cached.data;
          } else {
            console.log(
              `[SymbiantsStore] IndexedDB cache expired (age: ${Math.round(age / 1000)}s)`
            );
          }
        }
      } catch (err) {
        console.warn('[SymbiantsStore] Failed to read from IndexedDB:', err);
      }
    }

    loading.value = true;
    error.value = null;
    loadedCount.value = 0;
    totalCount.value = 0;

    try {
      // Load symbiants in chunks with progress indicator
      const allSymbiantsData: Symbiant[] = [];
      let currentPage = 1;
      const pageSize = 100;
      let hasMore = true;

      console.log('[SymbiantsStore] Starting chunked symbiant load...');

      while (hasMore) {
        const response = await apiClient.searchSymbiants({
          page: currentPage,
          limit: pageSize,
        });

        if (response && response.items && Array.isArray(response.items)) {
          // Enrich symbiants with display data
          const enrichedChunk = response.items.map(enrichSymbiant);
          allSymbiantsData.push(...enrichedChunk);

          // Update progress state for UI
          loadedCount.value = allSymbiantsData.length;
          totalCount.value = response.total;

          // Show progress
          console.log(
            `[SymbiantsStore] Loaded ${allSymbiantsData.length}/${response.total} symbiants...`
          );

          // Check if there are more pages
          hasMore = response.has_next;
          currentPage++;
        } else {
          // No more data or invalid response
          hasMore = false;
        }
      }

      if (allSymbiantsData.length === 0) {
        throw new Error('No symbiant data received');
      }

      // Clear old data and store new data in Pinia
      symbiants.value.clear();
      allSymbiantsData.forEach((symbiant) => {
        symbiants.value.set(symbiant.aoid, symbiant);
      });

      lastFetch.value = Date.now();

      // Write complete dataset to IndexedDB cache
      try {
        const cacheEntry: SymbiantCacheEntry = {
          data: allSymbiantsData,
          timestamp: Date.now(),
          version: 1,
          gameVersion: activeVersionSlug(),
        };
        await set(versionKey(SYMBIANTS_CACHE_BASE), cacheEntry);
        console.log(`[SymbiantsStore] Cached ${allSymbiantsData.length} symbiants to IndexedDB`);
      } catch (err) {
        console.warn('[SymbiantsStore] Failed to write to IndexedDB:', err);
      }

      return allSymbiantsData;
    } catch (err) {
      error.value = toUserFriendlyError(err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Get a single symbiant by AOID
   */
  async function getSymbiant(aoid: number, forceRefresh = false): Promise<Symbiant | null> {
    // Check cache first
    if (!forceRefresh && symbiants.value.has(aoid)) {
      return symbiants.value.get(aoid) || null;
    }

    loading.value = true;
    error.value = null;

    try {
      const response = await apiClient.getSymbiant(aoid);

      if (response.data) {
        const enriched = enrichSymbiant(response.data);
        symbiants.value.set(aoid, enriched);
        lastFetch.value = Date.now();
        return enriched;
      } else {
        throw new Error('Symbiant not found');
      }
    } catch (err) {
      error.value = toUserFriendlyError(err);
      return null;
    } finally {
      loading.value = false;
    }
  }

  /**
   * Get symbiant by AOID (game ID)
   */
  function getSymbiantByAoid(aoid: number): Symbiant | null {
    return symbiants.value.get(aoid) || null;
  }

  /**
   * Get symbiants by quality/tier (derived from family names or other data)
   */
  function getSymbiantsByTier(tier: 'artillery' | 'infantry' | 'support' | 'control'): Symbiant[] {
    // Map family names to tiers - this would need game knowledge
    const tierFamilies: Record<string, string[]> = {
      artillery: ['Seeker', 'Hacker'],
      infantry: ['Soldier', 'Veteran'],
      support: ['Medic', 'Engineer'],
      control: ['Commander', 'Leader'],
    };

    const families = tierFamilies[tier] || [];
    return allSymbiants.value.filter(
      (symbiant) =>
        symbiant.family &&
        families.some((family) => symbiant.family!.toLowerCase().includes(family.toLowerCase()))
    );
  }

  /**
   * Clear error state
   */
  function clearError(): void {
    error.value = null;
  }

  /**
   * Clear all cached data for the active game version (including IndexedDB).
   * Farm list and progress are user data and survive.
   */
  async function clearCache(): Promise<void> {
    symbiants.value.clear();
    lastFetch.value = 0;
    error.value = null;

    try {
      await del(versionKey(SYMBIANTS_CACHE_BASE));
      console.log('[SymbiantsStore] Cleared IndexedDB cache');
    } catch (err) {
      console.warn('[SymbiantsStore] Failed to clear IndexedDB cache:', err);
    }
  }

  /**
   * Re-point the store at the game version just switched to: drop the old
   * version's in-memory data and load this version's farm list and progress.
   * Nothing persisted is deleted; the next load reads this version's
   * IndexedDB snapshot, and other versions' snapshots are reclaimed by
   * purgeOtherVersionCaches(). Farm lists of other versions are kept.
   */
  function resetForVersionChange(): void {
    symbiants.value.clear();
    lastFetch.value = 0;
    error.value = null;
    farmListAoids.value = [];
    farmedBossIds.value = new Set();
    aggregatedBosses.value.clear();
    bossDropCache.value.clear();
    loadFarmList();
    loadFarmProgress();
  }

  /**
   * Preload all symbiants (they're a small dataset)
   */
  async function preloadSymbiants(): Promise<void> {
    if (!isDataStale.value && symbiants.value.size > 900) {
      return; // Already have recent data
    }

    try {
      await loadAllSymbiants();
    } catch (err) {
      console.warn('Failed to preload symbiants:', err);
    }
  }

  /**
   * Get symbiant statistics
   */
  const getStats = computed(() => ({
    totalSymbiants: symbiantsCount.value,
    uniqueFamilies: symbiantFamilies.value.length,
    familyBreakdown: Object.fromEntries(
      Array.from(symbiantsByFamilyMap.value.entries()).map(([family, symbiants]) => [
        family,
        symbiants.length,
      ])
    ),
    lastUpdate: new Date(lastFetch.value).toLocaleString(),
    cacheHitRatio: symbiants.value.size > 0 ? 'Available' : 'No cache',
  }));

  /**
   * Add symbiant to first available slot
   * Returns true if added, false if all slots are full
   */
  function addToComparison(symbiant: Symbiant): boolean {
    const firstEmptyIndex = selectedForComparison.value.findIndex((slot) => slot === null);
    if (firstEmptyIndex === -1) {
      return false;
    }
    selectedForComparison.value[firstEmptyIndex] = symbiant;
    return true;
  }

  /**
   * Remove symbiant by AOID from comparison
   */
  function removeFromComparison(aoid: number): void {
    const index = selectedForComparison.value.findIndex(
      (slot) => slot !== null && slot.aoid === aoid
    );
    if (index !== -1) {
      selectedForComparison.value[index] = null;
    }
  }

  /**
   * Clear all comparison selections
   */
  function clearComparison(): void {
    selectedForComparison.value = [null, null, null];
  }

  /**
   * Check if symbiant is in comparison
   * Returns slot index (0-2) or null if not found
   */
  function isInComparison(aoid: number): number | null {
    const index = selectedForComparison.value.findIndex(
      (slot) => slot !== null && slot.aoid === aoid
    );
    return index !== -1 ? index : null;
  }

  /**
   * Get count of selected symbiants
   */
  function getComparisonCount(): number {
    return selectedForComparison.value.filter((slot) => slot !== null).length;
  }

  // ============================================================================
  // Farm List Actions
  // ============================================================================

  /**
   * Add symbiant to farm list (by AOID)
   * Returns true if added, false if already in list
   */
  function addToFarmList(symbiant: Symbiant): boolean {
    if (!symbiant.aoid) return false;
    if (farmListAoids.value.includes(symbiant.aoid)) {
      return false;
    }
    farmListAoids.value.push(symbiant.aoid);
    saveFarmList();
    return true;
  }

  /**
   * Remove symbiant from farm list (by AOID)
   */
  function removeFromFarmList(aoid: number): void {
    const index = farmListAoids.value.indexOf(aoid);
    if (index > -1) {
      farmListAoids.value.splice(index, 1);
      saveFarmList();
    }
  }

  /**
   * Clear all symbiants from farm list and reset progress
   */
  function clearFarmList(): void {
    farmedBossIds.value.clear();
    aggregatedBosses.value.clear();
    replaceFarmList([]);
    saveFarmProgress();
  }

  /**
   * Check if symbiant is in farm list (by AOID)
   */
  function isInFarmList(aoid: number): boolean {
    return farmListAoids.value.includes(aoid);
  }

  /**
   * Toggle boss farmed status
   */
  function toggleBossFarmed(bossId: number): void {
    if (farmedBossIds.value.has(bossId)) {
      farmedBossIds.value.delete(bossId);
    } else {
      farmedBossIds.value.add(bossId);
    }
    // Update aggregatedBosses map
    const entry = aggregatedBosses.value.get(bossId);
    if (entry) {
      entry.farmed = farmedBossIds.value.has(bossId);
    }
    saveFarmProgress();
  }

  /**
   * Check if boss is marked as farmed
   */
  function isBossFarmed(bossId: number): boolean {
    return farmedBossIds.value.has(bossId);
  }

  /**
   * Get count of symbiants in farm list
   */
  function getFarmListCount(): number {
    return farmListAoids.value.length;
  }

  /**
   * Aggregate bosses for all symbiants in farm list
   * Fetches boss data from API and groups by boss
   */
  async function aggregateBossesForFarmList(): Promise<void> {
    console.log('[FarmList] Starting aggregation, AOIDs:', farmListAoids.value);

    if (farmListAoids.value.length === 0) {
      aggregatedBosses.value.clear();
      return;
    }

    farmListLoading.value = true;

    try {
      const bossMap = new Map<number, AggregatedBoss>();

      for (const aoid of farmListAoids.value) {
        const symbiant = getSymbiantByAoid(aoid);
        console.log(
          '[FarmList] Processing AOID:',
          aoid,
          '-> symbiant:',
          symbiant?.name || 'NOT FOUND'
        );

        if (!symbiant) continue;

        let bosses = bossDropCache.value.get(aoid);

        if (!bosses) {
          const response = await apiClient.getSymbiantDroppedBy(aoid);
          bosses = response.data || [];
          console.log('[FarmList] API returned bosses:', bosses);
          bossDropCache.value.set(aoid, bosses);
        }

        for (const boss of bosses) {
          if (!bossMap.has(boss.id)) {
            bossMap.set(boss.id, {
              boss,
              symbiants: [],
              farmed: farmedBossIds.value.has(boss.id),
            });
          }
          // Add symbiant to this boss's list if not already there
          const entry = bossMap.get(boss.id)!;
          if (!entry.symbiants.some((s) => s.aoid === aoid)) {
            entry.symbiants.push(symbiant);
          }
        }
      }

      console.log('[FarmList] Final bossMap size:', bossMap.size);
      aggregatedBosses.value = bossMap;
    } finally {
      farmListLoading.value = false;
    }
  }

  /**
   * Save a change to the farm list. Entries still waiting to be migrated to
   * AOIDs stay stored with it.
   */
  function saveFarmList(): void {
    writeAoids(userDataKey(FARM_LIST_BASE), legacyFarmListIds, farmListAoids.value);
  }

  /** Make `aoids` the whole farm list, entries not yet migrated included */
  function replaceFarmList(aoids: number[]): void {
    farmListAoids.value = aoids;
    replaceAoidList(userDataKey(FARM_LIST_BASE), aoids);
  }

  /**
   * Show the farm list stored for the version being browsed. A list in the
   * first format (version 1, internal symbiant ids) is migrated in the
   * background (see legacy-id-migration.ts) and appears once the backend has
   * resolved it.
   */
  function loadFarmList(): void {
    const slug = browsingVersionSlug();
    const storageKey = versionKey(FARM_LIST_BASE, slug);
    adoptLegacyUserData(FARM_LIST_BASE);
    farmListAoids.value = readAoidList(storageKey, legacyFarmListIds).aoids;

    void migratePendingIds({
      storageKey,
      base: FARM_LIST_BASE,
      slug,
      legacyIds: legacyFarmListIds,
      onDropped: (dropped, total) =>
        toast.add({
          severity: 'warn',
          summary: 'Some farm list entries were not carried over',
          detail: droppedEntriesMessage(dropped, total, 'farm list symbiants'),
          life: 10000,
        }),
    })?.then(() => {
      // Another version's farm list may be on show by now
      if (browsingVersionSlug() !== slug) return;
      farmListAoids.value = readAoidList(storageKey, legacyFarmListIds).aoids;
    });
  }

  /**
   * Save farm progress to localStorage
   */
  function saveFarmProgress(): void {
    const data: FarmProgressStorage = {
      farmedBossIds: Array.from(farmedBossIds.value),
      version: 1,
    };
    localStorage.setItem(userDataKey(FARM_PROGRESS_BASE), JSON.stringify(data));
  }

  /**
   * Load farm progress from localStorage
   */
  function loadFarmProgress(): void {
    try {
      adoptLegacyUserData(FARM_PROGRESS_BASE);
      const saved = localStorage.getItem(userDataKey(FARM_PROGRESS_BASE));
      if (saved) {
        const data: FarmProgressStorage = JSON.parse(saved);
        farmedBossIds.value = new Set(data.farmedBossIds || []);
      }
    } catch (error) {
      console.error('[SymbiantsStore] Failed to load farm progress:', error);
    }
  }

  /**
   * Generate shareable URL for farm list (uses AOIDs)
   */
  function exportFarmListToUrl(): string {
    const base = window.location.origin + window.location.pathname;
    if (farmListAoids.value.length === 0) {
      return `${base}?tab=farm`;
    }
    return `${base}?tab=farm&aoids=${farmListAoids.value.join(',')}`;
  }

  /**
   * Import farm list from URL parameter (AOIDs)
   */
  function importFarmListFromUrl(aoidsParam: string): void {
    if (!aoidsParam) return;
    const aoids = aoidsParam
      .split(',')
      .map(Number)
      .filter((aoid) => !isNaN(aoid) && aoid > 0);
    replaceFarmList(aoids);
  }

  /**
   * Search symbiants with pagination parameters
   * Wrapper around loadAllSymbiants for API compatibility
   */
  async function searchSymbiants(params?: { page?: number; limit?: number }): Promise<Symbiant[]> {
    // Load all symbiants and cache them
    const allSymbs = await loadAllSymbiants();

    // If pagination params provided, slice the results
    if (params?.page && params?.limit) {
      const start = (params.page - 1) * params.limit;
      const end = start + params.limit;
      return allSymbs.slice(start, end);
    }

    return allSymbs;
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    symbiants: readonly(symbiants),
    loading: readonly(loading),
    error: readonly(error),
    lastFetch: readonly(lastFetch),
    selectedForComparison: readonly(selectedForComparison),
    loadedCount: readonly(loadedCount),
    totalCount: readonly(totalCount),
    loadingProgress,

    // Farm List State (uses AOIDs for stability)
    farmListAoids: readonly(farmListAoids),
    farmedBossIds: readonly(farmedBossIds),
    farmListLoading: readonly(farmListLoading),
    aggregatedBosses: readonly(aggregatedBosses),

    // Getters
    allSymbiants,
    symbiantsByFamily,
    symbiantFamilies,
    symbiantsCount,
    isDataStale,
    symbiantsByFamilyMap,
    getStats,

    // Actions
    loadAllSymbiants,
    searchSymbiants,
    getSymbiant,
    getSymbiantByAoid,
    getSymbiantsByTier,
    clearError,
    clearCache,
    resetForVersionChange,
    preloadSymbiants,
    // Comparison actions
    addToComparison,
    removeFromComparison,
    clearComparison,
    isInComparison,
    getComparisonCount,
    // Farm List actions
    addToFarmList,
    removeFromFarmList,
    clearFarmList,
    isInFarmList,
    toggleBossFarmed,
    isBossFarmed,
    getFarmListCount,
    aggregateBossesForFarmList,
    loadFarmList,
    loadFarmProgress,
    exportFarmListToUrl,
    importFarmListFromUrl,
  };
});

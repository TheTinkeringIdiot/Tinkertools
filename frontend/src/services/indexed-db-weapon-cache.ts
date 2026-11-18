/**
 * IndexedDB Weapon Cache Service
 *
 * Caches expensive backend weapon queries using IndexedDB for larger storage capacity
 * Cache key based on: level, breed, profession, faction, top 3 weapon skills
 * Performance metrics always recalculated when profile changes
 *
 * Migrated from LocalStorage to IndexedDB to avoid quota exceeded errors.
 * IndexedDB provides 50MB+ storage vs LocalStorage's 5-10MB limit.
 */

import { get, set, del, keys } from 'idb-keyval';
import type { Item } from '@/types/api';
import type { WeaponAnalyzeRequest } from '@/types/weapon-analysis';
import {
  versionKey,
  versionPrefix,
  purgeIdbOtherVersions,
  purgeLocalStoragePrefix,
} from './version-keys';

// ============================================================================
// Types
// ============================================================================

interface WeaponCacheEntry {
  weapons: Item[];
  timestamp: number;
  cacheKey: string;
}

interface WeaponCacheMetrics {
  hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;
  averageResponseTime: number;
}

// ============================================================================
// Cache Configuration
// ============================================================================

const CACHE_CONFIG = {
  TTL: 60 * 60 * 1000, // 1 hour (static game data)
  MAX_ENTRIES: 5, // Maximum cached profiles (LRU eviction)
  /** Base of the key family; the game version slug is inserted after it. */
  STORAGE_BASE: 'tinkertools_weapon_cache',
  METRICS_BASE: 'tinkertools_weapon_metrics',
  /** Pre-version key family in LocalStorage, cleaned up on init. */
  LEGACY_STORAGE_PREFIX: 'tinkertools_weapon_cache_',
  LEGACY_METRICS_KEY: 'tinkertools_weapon_cache_metrics',
} as const;

/**
 * Cached weapons are server data, so every entry belongs to one game version:
 * `tinkertools_weapon_cache:<slug>:<cacheKey>`. Scans (clear, LRU, stats) use
 * this prefix and therefore stay inside the active version.
 */
function storagePrefix(): string {
  return versionPrefix(CACHE_CONFIG.STORAGE_BASE);
}

function metricsKey(): string {
  return versionKey(CACHE_CONFIG.METRICS_BASE);
}

// ============================================================================
// In-Memory Cache
// ============================================================================

const memoryCache = new Map<string, WeaponCacheEntry>();

// ============================================================================
// Cache Key Generation
// ============================================================================

/**
 * Generate cache key from request parameters
 * Cache depends on: level, breed, profession, faction, expansion, top 3 weapon skills
 *
 * @param request Weapon analysis request
 * @returns Cache key string
 */
export function generateCacheKey(request: WeaponAnalyzeRequest): string {
  const { level, breed_id, profession_id, side, expansion_bitflag, top_weapon_skills } = request;

  // Sort top skills by skill_id for consistent keys
  const skillsKey = top_weapon_skills
    .sort((a, b) => a.skill_id - b.skill_id)
    .map((s) => `${s.skill_id}:${s.value}`)
    .join(',');

  return `${level}_${breed_id}_${profession_id}_${side}_${expansion_bitflag}_${skillsKey}`;
}

/**
 * Generate storage key for IndexedDB
 *
 * @param cacheKey Cache key from generateCacheKey
 * @returns Storage key
 */
function getStorageKey(cacheKey: string): string {
  return `${storagePrefix()}${cacheKey}`;
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Get cached weapons from memory or IndexedDB
 *
 * @param cacheKey Cache key
 * @returns Cached entry or null if not found/expired
 */
export async function getCachedWeapons(cacheKey: string): Promise<Item[] | null> {
  const startTime = performance.now();

  // Check memory cache first
  let entry = memoryCache.get(cacheKey);

  // Fallback to IndexedDB
  if (!entry) {
    const storageKey = getStorageKey(cacheKey);
    try {
      entry = await get<WeaponCacheEntry>(storageKey);
      if (entry) {
        // Restore to memory cache
        memoryCache.set(cacheKey, entry);
      }
    } catch (error) {
      console.warn('[WeaponCache] Failed to read from IndexedDB:', error);
      await recordCacheMiss(performance.now() - startTime);
      return null;
    }
  }

  if (!entry) {
    await recordCacheMiss(performance.now() - startTime);
    return null;
  }

  // Check if expired
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_CONFIG.TTL) {
    console.log(`[WeaponCache] Cache expired (age: ${Math.round(age / 1000)}s)`);
    await evictEntry(cacheKey);
    await recordCacheMiss(performance.now() - startTime);
    return null;
  }

  const responseTime = performance.now() - startTime;
  await recordCacheHit(responseTime);
  console.log(
    `[WeaponCache] Cache hit! (${Math.round(responseTime)}ms, ${entry.weapons.length} weapons)`
  );

  return entry.weapons;
}

/**
 * Cache weapons result
 *
 * @param cacheKey Cache key
 * @param weapons Weapons array to cache
 */
export async function cacheWeapons(cacheKey: string, weapons: Item[]): Promise<void> {
  const entry: WeaponCacheEntry = {
    weapons,
    timestamp: Date.now(),
    cacheKey,
  };

  // Store in memory
  memoryCache.set(cacheKey, entry);

  // Store in IndexedDB
  const storageKey = getStorageKey(cacheKey);
  try {
    await set(storageKey, entry);
    console.log(`[WeaponCache] Cached ${weapons.length} weapons (key: ${cacheKey})`);

    // Enforce max entries with LRU eviction
    await enforceMaxEntries();
  } catch (error) {
    console.warn('[WeaponCache] Failed to cache to IndexedDB:', error);
    // Still have memory cache, so not critical
  }
}

/**
 * Clear all cached weapons
 */
export async function clearWeaponCache(): Promise<void> {
  // Clear memory cache
  memoryCache.clear();

  // Clear IndexedDB entries
  try {
    const allKeys = await keys();
    const cacheKeys = allKeys.filter(
      (key) => typeof key === 'string' && key.startsWith(storagePrefix())
    );

    await Promise.all(cacheKeys.map((key) => del(key)));

    console.log(`[WeaponCache] Cleared ${cacheKeys.length} cache entries`);
  } catch (error) {
    console.warn('[WeaponCache] Failed to clear IndexedDB cache:', error);
  }
}

/**
 * Clear specific cache entry
 *
 * @param cacheKey Cache key to remove
 */
export async function evictEntry(cacheKey: string): Promise<void> {
  memoryCache.delete(cacheKey);
  const storageKey = getStorageKey(cacheKey);
  try {
    await del(storageKey);
  } catch (error) {
    console.warn('[WeaponCache] Failed to evict entry from IndexedDB:', error);
  }
}

/**
 * Enforce max cache entries using LRU eviction
 * Keeps MAX_ENTRIES most recent entries
 */
async function enforceMaxEntries(): Promise<void> {
  try {
    // Get all cache entries from IndexedDB
    const allKeys = await keys();
    const cacheKeys = allKeys.filter(
      (key) => typeof key === 'string' && key.startsWith(storagePrefix())
    );

    // If under limit, nothing to do
    if (cacheKeys.length <= CACHE_CONFIG.MAX_ENTRIES) {
      return;
    }

    // Load all entries with timestamps
    const entries: Array<{ key: string; timestamp: number }> = [];
    for (const key of cacheKeys) {
      if (typeof key === 'string') {
        try {
          const entry = await get<WeaponCacheEntry>(key);
          if (entry) {
            entries.push({ key, timestamp: entry.timestamp });
          }
        } catch {
          // Invalid entry, will be cleaned up
          await del(key);
        }
      }
    }

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest entries
    const toRemove = entries.length - CACHE_CONFIG.MAX_ENTRIES;
    for (let i = 0; i < toRemove; i++) {
      const key = entries[i].key;
      const cacheKey = key.replace(storagePrefix(), '');
      await evictEntry(cacheKey);
      console.log(`[WeaponCache] Evicted old entry: ${cacheKey}`);
    }
  } catch (error) {
    console.warn('[WeaponCache] Failed to enforce max entries:', error);
  }
}

// ============================================================================
// Metrics Tracking
// ============================================================================

/**
 * Load metrics from IndexedDB
 */
async function loadMetrics(): Promise<WeaponCacheMetrics> {
  try {
    const stored = await get<WeaponCacheMetrics>(metricsKey());
    if (stored) {
      return stored;
    }
  } catch (error) {
    console.warn('[WeaponCache] Failed to load metrics:', error);
  }

  return {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    hitRate: 0,
    averageResponseTime: 0,
  };
}

/**
 * Save metrics to IndexedDB
 */
async function saveMetrics(metrics: WeaponCacheMetrics): Promise<void> {
  try {
    await set(metricsKey(), metrics);
  } catch (error) {
    console.warn('[WeaponCache] Failed to save metrics:', error);
  }
}

/**
 * Record cache hit
 */
async function recordCacheHit(responseTime: number): Promise<void> {
  const metrics = await loadMetrics();
  metrics.hits++;
  metrics.totalRequests++;
  metrics.hitRate = metrics.hits / metrics.totalRequests;

  // Update running average
  const totalTime = metrics.averageResponseTime * (metrics.totalRequests - 1);
  metrics.averageResponseTime = (totalTime + responseTime) / metrics.totalRequests;

  await saveMetrics(metrics);
}

/**
 * Record cache miss
 */
async function recordCacheMiss(responseTime: number): Promise<void> {
  const metrics = await loadMetrics();
  metrics.misses++;
  metrics.totalRequests++;
  metrics.hitRate = metrics.hits / metrics.totalRequests;

  // Update running average
  const totalTime = metrics.averageResponseTime * (metrics.totalRequests - 1);
  metrics.averageResponseTime = (totalTime + responseTime) / metrics.totalRequests;

  await saveMetrics(metrics);
}

/**
 * Get cache metrics
 */
export async function getCacheMetrics(): Promise<WeaponCacheMetrics> {
  return loadMetrics();
}

/**
 * Reset cache metrics
 */
export async function resetCacheMetrics(): Promise<void> {
  const metrics: WeaponCacheMetrics = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    hitRate: 0,
    averageResponseTime: 0,
  };
  await saveMetrics(metrics);
  console.log('[WeaponCache] Reset metrics');
}

// ============================================================================
// Debug Utilities
// ============================================================================

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  memorySize: number;
  indexedDBSize: number;
  entries: Array<{ key: string; age: number; weaponCount: number }>;
  metrics: WeaponCacheMetrics;
}> {
  const entries: Array<{ key: string; age: number; weaponCount: number }> = [];

  try {
    const allKeys = await keys();
    const cacheKeys = allKeys.filter(
      (key) => typeof key === 'string' && key.startsWith(storagePrefix())
    );

    for (const key of cacheKeys) {
      if (typeof key === 'string') {
        try {
          const entry = await get<WeaponCacheEntry>(key);
          if (entry) {
            const age = Math.round((Date.now() - entry.timestamp) / 1000); // seconds
            entries.push({
              key: entry.cacheKey,
              age,
              weaponCount: entry.weapons.length,
            });
          }
        } catch {
          // Skip invalid entries
        }
      }
    }
  } catch (error) {
    console.warn('[WeaponCache] Failed to get cache stats:', error);
  }

  return {
    memorySize: memoryCache.size,
    indexedDBSize: entries.length,
    entries,
    metrics: await loadMetrics(),
  };
}

/**
 * Log cache statistics to console
 */
export async function logCacheStats(): Promise<void> {
  const stats = await getCacheStats();
  console.log('[WeaponCache] Statistics:', {
    'Memory Cache Size': stats.memorySize,
    'IndexedDB Size': stats.indexedDBSize,
    'Hit Rate': `${(stats.metrics.hitRate * 100).toFixed(1)}%`,
    'Total Requests': stats.metrics.totalRequests,
    'Average Response': `${stats.metrics.averageResponseTime.toFixed(1)}ms`,
  });

  if (stats.entries.length > 0) {
    console.log('[WeaponCache] Cached Entries:');
    stats.entries.forEach((entry) => {
      console.log(`  - ${entry.key}: ${entry.weaponCount} weapons, ${entry.age}s old`);
    });
  }
}

// ============================================================================
// Migration Utilities
// ============================================================================

/**
 * Clear old LocalStorage weapon cache entries
 * Called once during app initialization to clean up old cache format
 */
export function clearLegacyLocalStorageCache(): void {
  try {
    // Pre-version keys used an underscore after the base; versioned keys use a
    // colon, so this prefix matches only the old format.
    let removed = purgeLocalStoragePrefix(CACHE_CONFIG.LEGACY_STORAGE_PREFIX);

    if (localStorage.getItem(CACHE_CONFIG.LEGACY_METRICS_KEY) !== null) {
      localStorage.removeItem(CACHE_CONFIG.LEGACY_METRICS_KEY);
      removed++;
    }

    if (removed > 0) {
      console.log(`[WeaponCache] Cleaned up ${removed} legacy LocalStorage entries`);
    }
  } catch (error) {
    console.warn('[WeaponCache] Failed to clear legacy LocalStorage cache:', error);
  }
}

/**
 * Drop IndexedDB weapon entries belonging to other game versions. Weapon
 * results are recomputable and TTL'd at an hour, so they are dropped rather
 * than migrated.
 */
export async function purgeOtherVersionWeaponCaches(slug?: string): Promise<number> {
  memoryCache.clear();
  return purgeIdbOtherVersions(CACHE_CONFIG.STORAGE_BASE, slug);
}

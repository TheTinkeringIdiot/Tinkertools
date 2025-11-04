/**
 * Weapon Cache Service
 *
 * Caches expensive backend weapon queries while allowing performance recalculation
 * Cache key based on: level, breed, profession, faction, top 3 weapon skills
 * Performance metrics always recalculated when profile changes
 */

import type { Item } from '@/types/api';
import type { WeaponAnalyzeRequest } from '@/types/weapon-analysis';

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
  STORAGE_PREFIX: 'tinkertools_weapon_cache_',
  METRICS_KEY: 'tinkertools_weapon_cache_metrics',
} as const;

// ============================================================================
// In-Memory Cache
// ============================================================================

const memoryCache = new Map<string, WeaponCacheEntry>();

// ============================================================================
// Cache Key Generation
// ============================================================================

/**
 * Generate cache key from request parameters
 * Cache depends on: level, breed, profession, faction, top 3 weapon skills
 *
 * @param request Weapon analysis request
 * @returns Cache key string
 */
export function generateCacheKey(request: WeaponAnalyzeRequest): string {
  const { level, breed_id, profession_id, side, top_weapon_skills } = request;

  // Sort top skills by skill_id for consistent keys
  const skillsKey = top_weapon_skills
    .sort((a, b) => a.skill_id - b.skill_id)
    .map((s) => `${s.skill_id}:${s.value}`)
    .join(',');

  return `${level}_${breed_id}_${profession_id}_${side}_${skillsKey}`;
}

/**
 * Generate storage key for localStorage
 *
 * @param cacheKey Cache key from generateCacheKey
 * @returns Storage key
 */
function getStorageKey(cacheKey: string): string {
  return `${CACHE_CONFIG.STORAGE_PREFIX}${cacheKey}`;
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Get cached weapons from memory or localStorage
 *
 * @param cacheKey Cache key
 * @returns Cached entry or null if not found/expired
 */
export function getCachedWeapons(cacheKey: string): Item[] | null {
  const startTime = performance.now();

  // Check memory cache first
  let entry = memoryCache.get(cacheKey);

  // Fallback to localStorage
  if (!entry) {
    const storageKey = getStorageKey(cacheKey);
    const stored = localStorage.getItem(storageKey);

    if (stored) {
      try {
        entry = JSON.parse(stored) as WeaponCacheEntry;
        // Restore to memory cache
        memoryCache.set(cacheKey, entry);
      } catch (error) {
        console.warn('[WeaponCache] Failed to parse cached entry:', error);
        localStorage.removeItem(storageKey);
        return null;
      }
    }
  }

  if (!entry) {
    recordCacheMiss(performance.now() - startTime);
    return null;
  }

  // Check if expired
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_CONFIG.TTL) {
    console.log(`[WeaponCache] Cache expired (age: ${Math.round(age / 1000)}s)`);
    evictEntry(cacheKey);
    recordCacheMiss(performance.now() - startTime);
    return null;
  }

  const responseTime = performance.now() - startTime;
  recordCacheHit(responseTime);
  console.log(`[WeaponCache] Cache hit! (${Math.round(responseTime)}ms, ${entry.weapons.length} weapons)`);

  return entry.weapons;
}

/**
 * Cache weapons result
 *
 * @param cacheKey Cache key
 * @param weapons Weapons array to cache
 */
export function cacheWeapons(cacheKey: string, weapons: Item[]): void {
  const entry: WeaponCacheEntry = {
    weapons,
    timestamp: Date.now(),
    cacheKey,
  };

  // Store in memory
  memoryCache.set(cacheKey, entry);

  // Store in localStorage
  const storageKey = getStorageKey(cacheKey);
  try {
    localStorage.setItem(storageKey, JSON.stringify(entry));
    console.log(`[WeaponCache] Cached ${weapons.length} weapons (key: ${cacheKey})`);

    // Enforce max entries with LRU eviction
    enforceMaxEntries();
  } catch (error) {
    console.warn('[WeaponCache] Failed to cache to localStorage:', error);
    // Still have memory cache, so not critical
  }
}

/**
 * Clear all cached weapons
 */
export function clearWeaponCache(): void {
  // Clear memory cache
  memoryCache.clear();

  // Clear localStorage entries
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_CONFIG.STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));

  console.log(`[WeaponCache] Cleared ${keysToRemove.length} cache entries`);
}

/**
 * Clear specific cache entry
 *
 * @param cacheKey Cache key to remove
 */
export function evictEntry(cacheKey: string): void {
  memoryCache.delete(cacheKey);
  localStorage.removeItem(getStorageKey(cacheKey));
}

/**
 * Enforce max cache entries using LRU eviction
 * Keeps MAX_ENTRIES most recent entries
 */
function enforceMaxEntries(): void {
  // Get all cache entries from localStorage
  const entries: Array<{ key: string; timestamp: number }> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_CONFIG.STORAGE_PREFIX)) {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const entry = JSON.parse(stored) as WeaponCacheEntry;
          entries.push({ key, timestamp: entry.timestamp });
        } catch {
          // Invalid entry, will be cleaned up
          localStorage.removeItem(key);
        }
      }
    }
  }

  // If under limit, nothing to do
  if (entries.length <= CACHE_CONFIG.MAX_ENTRIES) {
    return;
  }

  // Sort by timestamp (oldest first)
  entries.sort((a, b) => a.timestamp - b.timestamp);

  // Remove oldest entries
  const toRemove = entries.length - CACHE_CONFIG.MAX_ENTRIES;
  for (let i = 0; i < toRemove; i++) {
    const key = entries[i].key;
    const cacheKey = key.replace(CACHE_CONFIG.STORAGE_PREFIX, '');
    evictEntry(cacheKey);
    console.log(`[WeaponCache] Evicted old entry: ${cacheKey}`);
  }
}

// ============================================================================
// Metrics Tracking
// ============================================================================

/**
 * Load metrics from localStorage
 */
function loadMetrics(): WeaponCacheMetrics {
  const stored = localStorage.getItem(CACHE_CONFIG.METRICS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as WeaponCacheMetrics;
    } catch {
      // Invalid metrics, start fresh
    }
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
 * Save metrics to localStorage
 */
function saveMetrics(metrics: WeaponCacheMetrics): void {
  try {
    localStorage.setItem(CACHE_CONFIG.METRICS_KEY, JSON.stringify(metrics));
  } catch (error) {
    console.warn('[WeaponCache] Failed to save metrics:', error);
  }
}

/**
 * Record cache hit
 */
function recordCacheHit(responseTime: number): void {
  const metrics = loadMetrics();
  metrics.hits++;
  metrics.totalRequests++;
  metrics.hitRate = metrics.hits / metrics.totalRequests;

  // Update running average
  const totalTime = metrics.averageResponseTime * (metrics.totalRequests - 1);
  metrics.averageResponseTime = (totalTime + responseTime) / metrics.totalRequests;

  saveMetrics(metrics);
}

/**
 * Record cache miss
 */
function recordCacheMiss(responseTime: number): void {
  const metrics = loadMetrics();
  metrics.misses++;
  metrics.totalRequests++;
  metrics.hitRate = metrics.hits / metrics.totalRequests;

  // Update running average
  const totalTime = metrics.averageResponseTime * (metrics.totalRequests - 1);
  metrics.averageResponseTime = (totalTime + responseTime) / metrics.totalRequests;

  saveMetrics(metrics);
}

/**
 * Get cache metrics
 */
export function getCacheMetrics(): WeaponCacheMetrics {
  return loadMetrics();
}

/**
 * Reset cache metrics
 */
export function resetCacheMetrics(): void {
  const metrics: WeaponCacheMetrics = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    hitRate: 0,
    averageResponseTime: 0,
  };
  saveMetrics(metrics);
  console.log('[WeaponCache] Reset metrics');
}

// ============================================================================
// Debug Utilities
// ============================================================================

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  memorySize: number;
  localStorageSize: number;
  entries: Array<{ key: string; age: number; weaponCount: number }>;
  metrics: WeaponCacheMetrics;
} {
  const entries: Array<{ key: string; age: number; weaponCount: number }> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_CONFIG.STORAGE_PREFIX)) {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const entry = JSON.parse(stored) as WeaponCacheEntry;
          const age = Math.round((Date.now() - entry.timestamp) / 1000); // seconds
          entries.push({
            key: entry.cacheKey,
            age,
            weaponCount: entry.weapons.length,
          });
        } catch {
          // Skip invalid entries
        }
      }
    }
  }

  return {
    memorySize: memoryCache.size,
    localStorageSize: entries.length,
    entries,
    metrics: loadMetrics(),
  };
}

/**
 * Log cache statistics to console
 */
export function logCacheStats(): void {
  const stats = getCacheStats();
  console.log('[WeaponCache] Statistics:', {
    'Memory Cache Size': stats.memorySize,
    'LocalStorage Size': stats.localStorageSize,
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

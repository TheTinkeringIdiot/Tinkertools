/**
 * Frontend Interpolation Service for TinkerTools
 *
 * Provides client-side interpolation utilities and caching for interpolated items.
 * Works in conjunction with the backend interpolation API to provide efficient
 * item interpolation with local caching and state management.
 */

import { reactive } from 'vue';
import type { Item, InterpolatedItem, InterpolationInfo } from '../types/api';
import { apiClient } from './api-client';
import { errorMessage } from './error-message';
import { INTERP_STATS } from './game-data';
import { currentVersion } from '../composables/useGameVersion';

/** Options accepted by every call that reaches the backend. */
export interface InterpolationRequestOptions {
  /** Game version to interpolate against; defaults to the browsing version. */
  gameVersion?: string | null;
}

/**
 * Interpolated stats differ per game version, so every cache entry is keyed by
 * the version it came from. A peek at another snapshot must never read or
 * overwrite the browsing version's entries.
 */
function versionKey(options?: InterpolationRequestOptions): string {
  return options?.gameVersion || currentVersion.value || '';
}

// ============================================================================
// Types and Interfaces
// ============================================================================

interface CacheEntry {
  item: InterpolatedItem;
  timestamp: number;
  ttl: number;
}

interface InterpolationState {
  loading: boolean;
  error: string | null;
  currentItem: InterpolatedItem | null;
  interpolationInfo: InterpolationInfo | null;
}

// ============================================================================
// Cache Manager
// ============================================================================

class InterpolationCache {
  private cache = new Map<string, CacheEntry>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes

  private getCacheKey(aoid: number, targetQl: number, version: string): string {
    return `${version}:${aoid}:${targetQl}`;
  }

  get(aoid: number, targetQl: number, version: string): InterpolatedItem | null {
    const key = this.getCacheKey(aoid, targetQl, version);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if entry has expired
    if (Date.now() > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.item;
  }

  set(
    aoid: number,
    targetQl: number,
    version: string,
    item: InterpolatedItem,
    ttl = this.defaultTTL
  ): void {
    const key = this.getCacheKey(aoid, targetQl, version);
    this.cache.set(key, {
      item,
      timestamp: Date.now(),
      ttl,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  /** Drops the item from every version's cache. */
  clearItem(aoid: number): void {
    for (const key of this.cache.keys()) {
      if (key.split(':')[1] === String(aoid)) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// ============================================================================
// Interpolation Service
// ============================================================================

class InterpolationService {
  private cache = new InterpolationCache();
  /** Keyed by "<version>:<aoid>". */
  private infoCache = new Map<string, InterpolationInfo>();

  // Reactive state for UI components
  public readonly state = reactive<InterpolationState>({
    loading: false,
    error: null,
    currentItem: null,
    interpolationInfo: null,
  });

  /**
   * Interpolate an item to a specific quality level
   */
  async interpolateItem(
    aoid: number,
    targetQl: number,
    options?: InterpolationRequestOptions
  ): Promise<InterpolatedItem | null> {
    const version = versionKey(options);

    // Check cache first
    const cached = this.cache.get(aoid, targetQl, version);
    if (cached) {
      this.state.currentItem = cached;
      return cached;
    }

    this.state.loading = true;
    this.state.error = null;

    try {
      const response = options?.gameVersion
        ? await apiClient.interpolateItem(aoid, targetQl, { gameVersion: options.gameVersion })
        : await apiClient.interpolateItem(aoid, targetQl);

      if (!response.success || !response.item) {
        this.state.error = response.error || 'Failed to interpolate item';
        return null;
      }

      // Cache the result
      this.cache.set(aoid, targetQl, version, response.item);

      // Update state
      this.state.currentItem = response.item;

      return response.item;
    } catch (error) {
      this.state.error = errorMessage(error) || 'Failed to interpolate item';
      return null;
    } finally {
      this.state.loading = false;
    }
  }

  /**
   * Get interpolation information for an item
   */
  async getInterpolationInfo(
    aoid: number,
    options?: InterpolationRequestOptions
  ): Promise<InterpolationInfo | null> {
    const key = `${versionKey(options)}:${aoid}`;

    // Check cache first
    const cached = this.infoCache.get(key);
    if (cached) {
      this.state.interpolationInfo = cached;
      return cached;
    }

    try {
      const response = options?.gameVersion
        ? await apiClient.getInterpolationInfo(aoid, { gameVersion: options.gameVersion })
        : await apiClient.getInterpolationInfo(aoid);

      if (!response.success || !response.data) {
        return null;
      }

      // Cache the result
      this.infoCache.set(key, response.data);
      this.state.interpolationInfo = response.data;

      return response.data;
    } catch (error) {
      console.warn('Failed to get interpolation info:', error);
      return null;
    }
  }

  /**
   * Check if an item can be interpolated
   */
  async isItemInterpolatable(
    aoid: number,
    options?: InterpolationRequestOptions
  ): Promise<boolean> {
    try {
      if (options?.gameVersion) {
        const info = await this.getInterpolationInfo(aoid, options);
        return info?.interpolatable ?? false;
      }
      return await apiClient.checkItemInterpolatable(aoid);
    } catch {
      return false;
    }
  }

  /**
   * Get the quality level range for interpolation
   */
  async getInterpolationRange(
    aoid: number,
    options?: InterpolationRequestOptions
  ): Promise<{ min: number; max: number } | null> {
    const info = await this.getInterpolationInfo(aoid, options);
    if (info) {
      return {
        min: info.min_ql,
        max: info.max_ql,
      };
    }
    return null;
  }

  /**
   * Check if a regular Item can be interpolated (client-side heuristic)
   */
  canItemBeInterpolated(item: Item): boolean {
    // Basic checks that don't require server round-trip
    if (item.is_nano) return false;
    if (item.name?.includes('Control Point')) return false;

    // If we have cached info for the browsing version, use it
    const cached = this.infoCache.get(`${versionKey()}:${item.aoid || 0}`);
    if (cached) {
      return cached.interpolatable;
    }

    // Otherwise, we can't determine without a server request
    return true; // Assume it might be interpolatable
  }

  /**
   * Convert a regular Item to InterpolatedItem (non-interpolated)
   */
  itemToInterpolatedItem(item: Item): InterpolatedItem {
    return {
      id: item.id,
      aoid: item.aoid,
      name: item.name,
      ql: item.ql,
      description: item.description,
      item_class: item.item_class,
      is_nano: item.is_nano,
      interpolating: false,
      low_ql: item.ql,
      high_ql: item.ql,
      target_ql: item.ql,
      ql_delta: 0,
      ql_delta_full: 0,
      stats: item.stats || [],
      spell_data:
        item.spell_data?.map((sd) => ({
          event: sd.event,
          spells:
            sd.spells?.map((spell) => ({
              target: spell.target,
              tick_count: spell.tick_count,
              tick_interval: spell.tick_interval,
              spell_id: spell.spell_id,
              spell_format: spell.spell_format,
              spell_params: spell.spell_params || {},
              criteria: [],
            })) || [],
        })) || [],
      actions:
        item.actions?.map((action) => ({
          action: action.action,
          criteria: action.criteria || [],
        })) || [],
      attack_defense_id: item.attack_defense?.id,
      animation_mesh_id: item.animation_mesh?.id,
    };
  }

  /**
   * Check if a stat ID should be interpolated
   */
  isInterpolatableStat(statId: number): boolean {
    return INTERP_STATS.includes(statId);
  }

  /**
   * Clear cache for a specific item
   */
  clearItemCache(aoid: number): void {
    this.cache.clearItem(aoid);
    for (const key of this.infoCache.keys()) {
      if (key.endsWith(`:${aoid}`)) this.infoCache.delete(key);
    }
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.cache.clear();
    this.infoCache.clear();
    this.state.currentItem = null;
    this.state.interpolationInfo = null;
    this.state.error = null;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { itemCache: number; infoCache: number } {
    return {
      itemCache: this.cache.size(),
      infoCache: this.infoCache.size,
    };
  }

  /**
   * Perform cache cleanup
   */
  cleanupCache(): void {
    this.cache.cleanup();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const interpolationService = new InterpolationService();

// Auto-cleanup cache every 10 minutes
setInterval(
  () => {
    interpolationService.cleanupCache();
  },
  10 * 60 * 1000
);

export default interpolationService;

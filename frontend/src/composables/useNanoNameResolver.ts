/**
 * Composable for resolving nano/item names from aoid
 *
 * Used by criteria display to resolve function operator references
 * (e.g., CheckNcu operator 127 references a nano by aoid)
 */

import apiClient from '@/services/api-client';

// Module-level cache shared across all component instances
// A null entry records a lookup that failed, so it is not retried every render.
const nameCache = new Map<number, string | null>();
const pendingRequests = new Map<number, Promise<string | null>>();

/**
 * Drop every resolved name. Names come from the backend and are AOID-keyed, so
 * they belong to one game version: call this whenever the version changes.
 * Exported at module level so resetAllStores() can reach it without a component.
 */
export function clearNanoNameCache(): void {
  nameCache.clear();
  pendingRequests.clear();
}

export function useNanoNameResolver() {
  /**
   * Resolve a nano/item name from its aoid, or null when it can't be found.
   * Results are cached to avoid duplicate API calls; callers supply their own
   * fallback label, since only they know whether the aoid is a nano or an item.
   */
  async function resolveNanoName(aoid: number): Promise<string | null> {
    // Check cache first
    if (nameCache.has(aoid)) {
      return nameCache.get(aoid) ?? null;
    }

    // Check if request is already in flight
    if (pendingRequests.has(aoid)) {
      return pendingRequests.get(aoid)!;
    }

    // Create new request
    const request = (async () => {
      try {
        const response = await apiClient.getItem(aoid);
        const name = response.data?.name || null;
        nameCache.set(aoid, name);
        return name;
      } catch {
        nameCache.set(aoid, null);
        return null;
      } finally {
        pendingRequests.delete(aoid);
      }
    })();

    pendingRequests.set(aoid, request);
    return request;
  }

  /**
   * Check if a name is already cached (for synchronous access)
   */
  function getCachedName(aoid: number): string | null | undefined {
    return nameCache.get(aoid);
  }

  return {
    resolveNanoName,
    getCachedName,
    clearCache: clearNanoNameCache,
  };
}

/**
 * Composable for resolving nano/item names from aoid
 *
 * Used by criteria display to resolve function operator references
 * (e.g., CheckNcu operator 127 references a nano by aoid)
 */

import apiClient from '@/services/api-client';

// Module-level cache shared across all component instances
const nameCache = new Map<number, string>();
const pendingRequests = new Map<number, Promise<string>>();

export function useNanoNameResolver() {
  /**
   * Resolve a nano/item name from its aoid
   * Results are cached to avoid duplicate API calls
   */
  async function resolveNanoName(aoid: number): Promise<string> {
    // Check cache first
    if (nameCache.has(aoid)) {
      return nameCache.get(aoid)!;
    }

    // Check if request is already in flight
    if (pendingRequests.has(aoid)) {
      return pendingRequests.get(aoid)!;
    }

    // Create new request
    const request = (async () => {
      try {
        const response = await apiClient.getItem(aoid);
        const name = response.data?.name || `Nano ${aoid}`;
        nameCache.set(aoid, name);
        return name;
      } catch {
        const fallback = `Nano ${aoid}`;
        nameCache.set(aoid, fallback);
        return fallback;
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
  function getCachedName(aoid: number): string | undefined {
    return nameCache.get(aoid);
  }

  /**
   * Clear the cache (useful for testing)
   */
  function clearCache(): void {
    nameCache.clear();
    pendingRequests.clear();
  }

  return {
    resolveNanoName,
    getCachedName,
    clearCache,
  };
}

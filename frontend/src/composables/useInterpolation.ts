/**
 * Interpolation Composable for TinkerTools
 *
 * Provides reactive state management and utilities for item interpolation.
 * Integrates with the interpolation service to provide Vue components with
 * reactive interpolation state, caching, and error handling.
 */

import { ref, computed, watch, onUnmounted, readonly } from 'vue';
import type { Ref } from 'vue';
import type { Item, InterpolatedItem, InterpolationInfo } from '../types/api';
import interpolationService from '../services/interpolation-service';

// ============================================================================
// Types
// ============================================================================

interface UseInterpolationOptions {
  autoLoad?: boolean;
  cacheResults?: boolean;
  debounceMs?: number;
}

interface InterpolationError {
  message: string;
  code?: string;
  retryable: boolean;
}

// ============================================================================
// Main Composable
// ============================================================================

export function useInterpolation(
  aoid: Ref<number | null> = ref(null),
  options: UseInterpolationOptions = {}
) {
  const { autoLoad = true, cacheResults = true, debounceMs = 300 } = options;

  // ============================================================================
  // Reactive State
  // ============================================================================

  const currentAoid = ref(aoid.value);
  const targetQl = ref<number | null>(null);
  const interpolatedItem = ref<InterpolatedItem | null>(null);
  const interpolationInfo = ref<InterpolationInfo | null>(null);
  const isLoading = ref(false);
  const error = ref<InterpolationError | null>(null);

  // Debounced loading state
  let debounceTimeout: number | null = null;

  // ============================================================================
  // Computed Properties
  // ============================================================================

  const isInterpolatable = computed(() => {
    return interpolationInfo.value?.interpolatable ?? false;
  });

  const canInterpolate = computed(() => {
    return currentAoid.value !== null && targetQl.value !== null && isInterpolatable.value;
  });

  const qualityRange = computed(() => {
    if (!interpolationInfo.value) return null;
    return {
      min: interpolationInfo.value.min_ql,
      max: interpolationInfo.value.max_ql,
      range: interpolationInfo.value.ql_range,
    };
  });

  const isTargetQlValid = computed(() => {
    if (!targetQl.value || !qualityRange.value) return false;
    return targetQl.value >= qualityRange.value.min && targetQl.value <= qualityRange.value.max;
  });

  const interpolationStatus = computed(() => {
    if (isLoading.value) return 'loading';
    if (error.value) return 'error';
    if (interpolatedItem.value?.interpolating) return 'interpolated';
    if (interpolatedItem.value) return 'original';
    return 'idle';
  });

  const interpolationRanges = computed(() => {
    return interpolationInfo.value?.ranges ?? [];
  });

  const validRangeForQl = computed(() => {
    if (!targetQl.value || !interpolationRanges.value.length) return null;

    return (
      interpolationRanges.value.find(
        (range) => targetQl.value! >= range.min_ql && targetQl.value! <= range.max_ql
      ) ?? null
    );
  });

  // ============================================================================
  // Methods
  // ============================================================================

  /**
   * Load interpolation info for the current AOID
   */
  async function loadInterpolationInfo(): Promise<boolean> {
    if (!currentAoid.value) return false;

    isLoading.value = true;
    error.value = null;

    try {
      const info = await interpolationService.getInterpolationInfo(currentAoid.value);
      interpolationInfo.value = info;
      return info !== null;
    } catch (err: any) {
      error.value = {
        message: err.message || 'Failed to load interpolation info',
        retryable: true,
      };
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Interpolate item to target quality level
   */
  async function interpolateToQl(ql: number): Promise<InterpolatedItem | null> {
    if (!currentAoid.value) {
      error.value = {
        message: 'No item AOID specified',
        retryable: false,
      };
      return null;
    }

    // Clear previous timeout
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    return new Promise((resolve) => {
      debounceTimeout = setTimeout(async () => {
        isLoading.value = true;
        error.value = null;

        try {
          const item = await interpolationService.interpolateItem(currentAoid.value!, ql);
          interpolatedItem.value = item;
          targetQl.value = ql;
          resolve(item);
        } catch (err: any) {
          error.value = {
            message: err.message || 'Failed to interpolate item',
            retryable: true,
          };
          resolve(null);
        } finally {
          isLoading.value = false;
        }
      }, debounceMs);
    });
  }

  /**
   * Set the item AOID and optionally load info
   */
  async function setItem(newAoid: number, autoLoadInfo = autoLoad): Promise<void> {
    currentAoid.value = newAoid;
    interpolatedItem.value = null;
    targetQl.value = null;
    error.value = null;

    if (autoLoadInfo) {
      await loadInterpolationInfo();
    }
  }

  /**
   * Set item from Item object
   */
  async function setItemFromObject(item: Item): Promise<void> {
    if (!item.aoid) {
      error.value = {
        message: 'Item has no AOID',
        retryable: false,
      };
      return;
    }

    await setItem(item.aoid);

    // If item is not interpolatable, set it as the current item
    if (!isInterpolatable.value) {
      interpolatedItem.value = interpolationService.itemToInterpolatedItem(item);
    }
  }

  /**
   * Reset to original (non-interpolated) item
   */
  function resetToOriginal(): void {
    if (interpolationInfo.value) {
      targetQl.value = null;
      // Could load original item here if needed
    }
  }

  /**
   * Clear all state
   */
  function clear(): void {
    currentAoid.value = null;
    targetQl.value = null;
    interpolatedItem.value = null;
    interpolationInfo.value = null;
    error.value = null;
    isLoading.value = false;
  }

  /**
   * Retry last failed operation
   */
  async function retry(): Promise<void> {
    if (!error.value?.retryable) return;

    error.value = null;

    if (currentAoid.value && !interpolationInfo.value) {
      await loadInterpolationInfo();
    } else if (currentAoid.value && targetQl.value) {
      await interpolateToQl(targetQl.value);
    }
  }

  /**
   * Get suggested quality levels for UI, accounting for multiple ranges
   */
  function getSuggestedQualityLevels(): number[] {
    if (!interpolationRanges.value.length) return [];

    const suggestions: number[] = [];

    // Add suggestions for each range
    for (const range of interpolationRanges.value) {
      // Always add range boundaries
      suggestions.push(range.min_ql, range.max_ql);

      // Add intermediate values for interpolatable ranges
      if (range.interpolatable) {
        const rangeSize = range.max_ql - range.min_ql;
        if (rangeSize > 20) {
          const step = Math.floor(rangeSize / 4);
          for (let i = 1; i < 4; i++) {
            suggestions.push(range.min_ql + step * i);
          }
        } else if (rangeSize > 5) {
          const mid = Math.floor((range.min_ql + range.max_ql) / 2);
          suggestions.push(mid);
        }
      }
    }

    // Remove duplicates and sort
    return [...new Set(suggestions)].sort((a, b) => a - b);
  }

  // ============================================================================
  // Watchers
  // ============================================================================

  // Watch for AOID changes
  watch(aoid, (newAoid) => {
    if (newAoid !== currentAoid.value) {
      setItem(newAoid);
    }
  });

  // ============================================================================
  // Lifecycle
  // ============================================================================

  onUnmounted(() => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
  });

  // ============================================================================
  // Auto-load
  // ============================================================================

  if (autoLoad && currentAoid.value) {
    loadInterpolationInfo();
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    currentAoid: readonly(currentAoid),
    targetQl: readonly(targetQl),
    interpolatedItem: readonly(interpolatedItem),
    interpolationInfo: readonly(interpolationInfo),
    isLoading: readonly(isLoading),
    error: readonly(error),

    // Computed
    isInterpolatable,
    canInterpolate,
    qualityRange,
    isTargetQlValid,
    interpolationStatus,
    interpolationRanges,
    validRangeForQl,

    // Methods
    loadInterpolationInfo,
    interpolateToQl,
    setItem,
    setItemFromObject,
    resetToOriginal,
    clear,
    retry,
    getSuggestedQualityLevels,
  };
}

// ============================================================================
// Utility Composables
// ============================================================================

/**
 * Simple composable for checking if an item can be interpolated
 */
export function useInterpolationCheck(aoid: Ref<number | null>) {
  const isInterpolatable = ref<boolean | null>(null);
  const isLoading = ref(false);

  const checkInterpolation = async () => {
    if (!aoid.value) {
      isInterpolatable.value = null;
      return;
    }

    isLoading.value = true;
    try {
      isInterpolatable.value = await interpolationService.isItemInterpolatable(aoid.value);
    } catch {
      isInterpolatable.value = false;
    } finally {
      isLoading.value = false;
    }
  };

  watch(aoid, checkInterpolation, { immediate: true });

  return {
    isInterpolatable: readonly(isInterpolatable),
    isLoading: readonly(isLoading),
    checkInterpolation,
  };
}

/**
 * Composable for managing multiple interpolated items
 */
export function useInterpolationBatch() {
  const items = ref<Map<string, InterpolatedItem>>(new Map());
  const isLoading = ref(false);
  const errors = ref<Map<string, string>>(new Map());

  const addItem = async (aoid: number, targetQl: number): Promise<void> => {
    const key = `${aoid}:${targetQl}`;
    isLoading.value = true;

    try {
      const item = await interpolationService.interpolateItem(aoid, targetQl);
      if (item) {
        items.value.set(key, item);
        errors.value.delete(key);
      } else {
        errors.value.set(key, 'Failed to interpolate item');
      }
    } catch (error: any) {
      errors.value.set(key, error.message || 'Unknown error');
    } finally {
      isLoading.value = false;
    }
  };

  const removeItem = (aoid: number, targetQl: number): void => {
    const key = `${aoid}:${targetQl}`;
    items.value.delete(key);
    errors.value.delete(key);
  };

  const clearAll = (): void => {
    items.value.clear();
    errors.value.clear();
  };

  return {
    items: readonly(items),
    isLoading: readonly(isLoading),
    errors: readonly(errors),
    addItem,
    removeItem,
    clearAll,
  };
}

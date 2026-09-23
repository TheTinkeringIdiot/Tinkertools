/**
 * Store Index - Central export for all Pinia stores and utilities
 *
 * Provides centralized access to stores, initialization, and store hydration
 */

// Store exports
export { useAppStore } from './app';
export { useTinkerProfilesStore } from './tinkerProfiles';
export { useItemsStore } from './items';
export { useSpellsStore } from './spells';
export { useSymbiantsStore } from './symbiants';
export { usePocketBossesStore } from './pocket-bosses';

// Service exports
export { apiClient } from '../services/api-client';
export { cacheManager } from '../services/cache-manager';
export { offlineManager } from '../services/offline-manager';

// Composable exports
export { useItems } from '../composables/useItems';

// Type exports
export type { ApplicationName, CrossAppContext, AppNotification } from './app';
export type { TinkerProfile, UserPreferences, CollectionTracking } from '../types/api';

/**
 * Initialize all stores and services
 */
export async function initializeStores(): Promise<void> {
  console.log('Initializing TinkerTools stores and services...');

  try {
    // Initialize in order of dependencies
    const { useAppStore } = await import('./app');
    const { useTinkerProfilesStore } = await import('./tinkerProfiles');
    const { offlineManager } = await import('../services/offline-manager');

    const appStore = useAppStore();
    const profilesStore = useTinkerProfilesStore();

    // Initialize app store first (sets up global state)
    await appStore.initialize();

    // Load profile data from storage
    await profilesStore.loadProfiles();

    // Initialize offline capabilities
    await offlineManager.initialize();

    // Preload common data if online
    if (!appStore.isOffline) {
      await preloadCommonData();
    }

    console.log('TinkerTools initialization complete');
  } catch (error) {
    console.error('Store initialization failed:', error);
    throw error;
  }
}

/**
 * Preload commonly used data for better performance
 */
async function preloadCommonData(): Promise<void> {
  try {
    // Import stores dynamically to avoid circular dependencies
    const { useSymbiantsStore } = await import('./symbiants');
    const { usePocketBossesStore } = await import('./pocket-bosses');

    const symbiantsStore = useSymbiantsStore();
    const pocketBossesStore = usePocketBossesStore();

    // Load small, commonly accessed datasets
    await Promise.allSettled([
      symbiantsStore.preloadSymbiants(),
      pocketBossesStore.preloadPocketBosses(),
    ]);
  } catch (error) {
    console.warn('Preloading common data failed:', error);
  }
}

/**
 * Clear all store caches, including the active version's persisted copies,
 * and reset to initial state.
 *
 * Everything here holds server-derived data: item, nano, spell and symbiant
 * records, anything keyed by AOID, and the derived lookups built from them.
 * This must reach every cache, not just the Pinia stores. Add new caches here
 * when you add them (and to resetForVersionChange() if they hold data from one
 * game version). A version switch uses resetForVersionChange() instead, which
 * keeps each version's persisted caches.
 */
export async function resetAllStores(): Promise<void> {
  const [
    { useAppStore },
    { useItemsStore },
    { useSpellsStore },
    { useSymbiantsStore },
    { usePocketBossesStore },
    { usePocketBossStore },
    { useNanosStore },
    { useTinkerPlantsStore },
    { offlineManager },
    { cacheManager },
    { interpolationService },
    { clearNanoNameCache },
    weaponCache,
    indexedDbWeaponCache,
  ] = await Promise.all([
    import('./app'),
    import('./items'),
    import('./spells'),
    import('./symbiants'),
    import('./pocket-bosses'),
    import('./pocketBossStore'),
    import('./nanosStore'),
    import('./tinkerPlants'),
    import('../services/offline-manager'),
    import('../services/cache-manager'),
    import('../services/interpolation-service'),
    import('../composables/useNanoNameResolver'),
    import('../services/weapon-cache'),
    import('../services/indexed-db-weapon-cache'),
  ]);

  const appStore = useAppStore();
  const itemsStore = useItemsStore();
  const spellsStore = useSpellsStore();
  const symbiantsStore = useSymbiantsStore();
  const pocketBossesStore = usePocketBossesStore();
  const pocketBossStore = usePocketBossStore();
  const nanosStore = useNanosStore();
  const plantsStore = useTinkerPlantsStore();

  // Module-level caches with no store behind them.
  clearNanoNameCache();
  interpolationService.clearAllCaches();
  weaponCache.clearWeaponCache();

  // Store-backed caches. Failures are reported, never fatal: a stale cache is
  // worse than a noisy console, so every one of these still gets its turn.
  const outcomes = await Promise.allSettled([
    itemsStore.clearCache(),
    spellsStore.clearCache(),
    symbiantsStore.clearCache(),
    pocketBossesStore.clearCache(),
    pocketBossStore.clearCache(),
    nanosStore.clearCache(),
    plantsStore.clearCache(),
    indexedDbWeaponCache.clearWeaponCache(),
    offlineManager.clearOfflineData(),
    cacheManager.clear(),
  ]);

  for (const outcome of outcomes) {
    if (outcome.status === 'rejected') {
      console.warn('Store reset: a cache failed to clear:', outcome.reason);
    }
  }

  // Clear global selections and notifications
  appStore.clearAllSelections();
  appStore.clearAllNotifications();
  appStore.clearGlobalError();

  console.log('All stores reset successfully');
}

/**
 * Re-point every cache at the game version just switched to.
 *
 * Unlike resetAllStores(), nothing persisted is deleted here: persisted caches
 * are keyed per version, so the new version's saved data is still valid and is
 * reloaded, and user data keyed by AOID (nano favorites, farm lists) stays put
 * for every version. Only in-memory state derived from the old version goes.
 */
export async function resetForVersionChange(): Promise<void> {
  const [
    { useAppStore },
    { useItemsStore },
    { useSpellsStore },
    { useSymbiantsStore },
    { usePocketBossesStore },
    { usePocketBossStore },
    { useNanosStore },
    { useTinkerPlantsStore },
    { offlineManager },
    { interpolationService },
    { clearNanoNameCache },
  ] = await Promise.all([
    import('./app'),
    import('./items'),
    import('./spells'),
    import('./symbiants'),
    import('./pocket-bosses'),
    import('./pocketBossStore'),
    import('./nanosStore'),
    import('./tinkerPlants'),
    import('../services/offline-manager'),
    import('../services/interpolation-service'),
    import('../composables/useNanoNameResolver'),
  ]);

  clearNanoNameCache();
  interpolationService.clearAllCaches();

  useItemsStore().clearCache();
  useSpellsStore().clearCache();
  usePocketBossesStore().clearCache();
  usePocketBossStore().clearCache();
  useTinkerPlantsStore().clearCache();
  useNanosStore().resetForVersionChange();
  useSymbiantsStore().resetForVersionChange();

  // Offline state keys are per version: reload the flags for this one.
  try {
    await offlineManager.initialize();
  } catch (error) {
    console.warn('Version reset: offline state could not be reloaded:', error);
  }

  const appStore = useAppStore();
  appStore.clearAllSelections();
  appStore.clearAllNotifications();
  appStore.clearGlobalError();
}

/**
 * Remove persisted server-derived caches belonging to game versions other than
 * the active one, so localStorage and IndexedDB do not fill up with snapshots
 * of versions the user is no longer browsing. User data (favorites, farm lists,
 * collection progress) is never purged.
 */
export async function purgeOtherVersionCaches(slug?: string): Promise<void> {
  const [
    { cacheManager },
    weaponCache,
    indexedDbWeaponCache,
    { NANOS_CACHE_BASE },
    { SYMBIANTS_CACHE_BASE },
    { purgeOtherVersions, purgeIdbOtherVersions },
  ] = await Promise.all([
    import('../services/cache-manager'),
    import('../services/weapon-cache'),
    import('../services/indexed-db-weapon-cache'),
    import('./nanosStore'),
    import('./symbiants'),
    import('../services/version-keys'),
  ]);

  const outcomes = await Promise.allSettled([
    cacheManager.purgeOtherVersions(slug),
    Promise.resolve(weaponCache.purgeOtherVersionWeaponCaches(slug)),
    indexedDbWeaponCache.purgeOtherVersionWeaponCaches(slug),
    Promise.resolve(purgeOtherVersions(NANOS_CACHE_BASE, slug)),
    purgeIdbOtherVersions(SYMBIANTS_CACHE_BASE, slug),
  ]);

  for (const outcome of outcomes) {
    if (outcome.status === 'rejected') {
      console.warn('Version purge: a cache could not be purged:', outcome.reason);
    }
  }
}

/**
 * Hook run on every game version switch, before the new version's route
 * renders (the router guard awaits it): drop in-memory data from the old
 * version and reclaim the storage other versions' caches use. Warming the
 * common datasets is started but not awaited, so navigation is not held up by
 * network requests.
 *
 * Registered once at startup (see main.ts).
 */
export async function handleGameVersionChange(next: string, previous: string | null) {
  console.log(`[stores] Game version changed ${previous ?? '(none)'} -> ${next}; resetting caches`);

  await resetForVersionChange();
  await purgeOtherVersionCaches(next);
  void preloadCommonData().catch((error) =>
    console.warn('[stores] Preload after version change failed:', error)
  );
}

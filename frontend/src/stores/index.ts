/**
 * Store Index - Central export for all Pinia stores and utilities
 * 
 * Provides centralized access to stores, initialization, and store hydration
 */

// Store exports
export { useAppStore } from './app'
export { useTinkerProfilesStore } from './tinkerProfiles'
export { useItemsStore } from './items'
export { useSpellsStore } from './spells'
export { useSymbiantsStore } from './symbiants'
export { usePocketBossesStore } from './pocket-bosses'

// Service exports
export { apiClient } from '../services/api-client'
export { cacheManager } from '../services/cache-manager'
export { offlineManager } from '../services/offline-manager'

// Composable exports
export { useItems } from '../composables/useItems'
export { useSearch } from '../composables/useSearch'
export { useFilters } from '../composables/useFilters'

// Type exports
export type { ApplicationName, CrossAppContext, AppNotification } from './app'
export type { TinkerProfile, UserPreferences, CollectionTracking } from '../types/api'

/**
 * Initialize all stores and services
 */
export async function initializeStores(): Promise<void> {
  console.log('Initializing TinkerTools stores and services...')
  
  try {
    // Initialize in order of dependencies
    const { useAppStore } = await import('./app')
    const { useTinkerProfilesStore } = await import('./tinkerProfiles')
    const { offlineManager } = await import('../services/offline-manager')
    
    const appStore = useAppStore()
    const profilesStore = useTinkerProfilesStore()
    
    // Initialize app store first (sets up global state)
    await appStore.initialize()
    
    // Load profile data from storage
    await profilesStore.loadProfiles()
    
    // Initialize offline capabilities
    await offlineManager.initialize()
    
    // Preload common data if online
    if (!appStore.isOffline) {
      await preloadCommonData()
    }
    
    console.log('TinkerTools initialization complete')
    
  } catch (error) {
    console.error('Store initialization failed:', error)
    throw error
  }
}

/**
 * Preload commonly used data for better performance
 */
async function preloadCommonData(): Promise<void> {
  try {
    // Import stores dynamically to avoid circular dependencies
    const { useSymbiantsStore } = await import('./symbiants')
    const { usePocketBossesStore } = await import('./pocket-bosses')
    
    const symbiantsStore = useSymbiantsStore()
    const pocketBossesStore = usePocketBossesStore()
    
    // Load small, commonly accessed datasets
    await Promise.allSettled([
      symbiantsStore.preloadSymbiants(),
      pocketBossesStore.preloadPocketBosses()
    ])
    
  } catch (error) {
    console.warn('Preloading common data failed:', error)
  }
}

/**
 * Clear all store caches and reset to initial state
 */
export async function resetAllStores(): Promise<void> {
  const { useAppStore } = await import('./app')
  const { useTinkerProfilesStore } = await import('./tinkerProfiles')
  const { useItemsStore } = await import('./items')
  const { useSpellsStore } = await import('./spells')
  const { useSymbiantsStore } = await import('./symbiants')
  const { usePocketBossesStore } = await import('./pocket-bosses')
  const { offlineManager } = await import('../services/offline-manager')
  const { cacheManager } = await import('../services/cache-manager')
  
  // Clear all store caches
  const appStore = useAppStore()
  const itemsStore = useItemsStore()
  const spellsStore = useSpellsStore()
  const symbiantsStore = useSymbiantsStore()
  const pocketBossesStore = usePocketBossesStore()
  
  await Promise.all([
    itemsStore.clearCache(),
    spellsStore.clearCache(),
    symbiantsStore.clearCache(),
    pocketBossesStore.clearCache(),
    offlineManager.clearOfflineData(),
    cacheManager.clear()
  ])
  
  // Clear global selections and notifications
  appStore.clearAllSelections()
  appStore.clearAllNotifications()
  appStore.clearGlobalError()
  
  console.log('All stores reset successfully')
}

/**
 * Get store hydration data for SSR/preloading
 */
export function getStoreHydrationData(): Record<string, any> {
  // This would be used for server-side rendering or data preloading
  // Return minimal data needed to hydrate stores on client
  return {
    // Add hydration data as needed
  }
}

/**
 * Hydrate stores with preloaded data
 */
export function hydrateStores(data: Record<string, any>): void {
  // This would hydrate stores with preloaded data
  // Useful for SSR or cached state restoration
  console.log('Hydrating stores with data:', data)
}
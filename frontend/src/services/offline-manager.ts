/**
 * Offline Manager - Handles offline capability and data synchronization
 * 
 * Provides seamless offline/online transitions with cached data
 */

import { ref, computed } from 'vue'
import { cacheManager } from './cache-manager'
import { useAppStore } from '../stores/app'
import type { Item, Spell, Symbiant, PocketBoss } from '../types/api'

export interface OfflineCapability {
  isOffline: boolean
  hasOfflineData: boolean
  lastSyncTime: number
  queuedOperations: QueuedOperation[]
}

export interface QueuedOperation {
  id: string
  type: 'favorite' | 'collection' | 'preference' | 'profile'
  action: 'create' | 'update' | 'delete'
  data: any
  timestamp: number
}

export interface OfflineDataSet {
  items: Item[]
  spells: Spell[]
  symbiants: Symbiant[]
  pocketBosses: PocketBoss[]
  lastUpdate: number
}

class OfflineManager {
  private isOffline = ref(false)
  private hasOfflineData = ref(false)
  private lastSyncTime = ref(0)
  private queuedOperations = ref<QueuedOperation[]>([])
  private syncInProgress = ref(false)
  
  private offlineDataKeys = {
    items: 'offline_items',
    spells: 'offline_spells', 
    symbiants: 'offline_symbiants',
    pocketBosses: 'offline_pocket_bosses',
    operations: 'offline_queued_operations',
    lastSync: 'offline_last_sync'
  }
  
  constructor() {
    this.setupOfflineDetection()
    this.loadOfflineState()
  }
  
  // ============================================================================
  // Public API
  // ============================================================================
  
  get status() {
    return computed(() => ({
      isOffline: this.isOffline.value,
      hasOfflineData: this.hasOfflineData.value,
      lastSyncTime: this.lastSyncTime.value,
      queuedOperations: this.queuedOperations.value.length,
      syncInProgress: this.syncInProgress.value
    }))
  }
  
  /**
   * Initialize offline capabilities
   */
  async initialize(): Promise<void> {
    await this.loadOfflineState()
    await this.checkOfflineDataAvailability()
    
    if (this.isOffline.value && this.queuedOperations.value.length > 0) {
      console.log(`Offline mode: ${this.queuedOperations.value.length} operations queued for sync`)
    }
  }
  
  /**
   * Download essential data for offline use
   */
  async downloadOfflineData(options: {
    includeItems?: boolean
    includeSpells?: boolean
    includeSymbiants?: boolean
    includePocketBosses?: boolean
    progressCallback?: (progress: number, status: string) => void
  } = {}): Promise<void> {
    const appStore = useAppStore()
    const { progressCallback } = options
    
    let progress = 0
    const totalSteps = Object.values(options).filter(Boolean).length || 4
    const stepSize = 100 / totalSteps
    
    try {
      appStore.setGlobalLoading(true, 'Downloading offline data...', 0)
      
      // Download items data
      if (options.includeItems !== false) {
        progressCallback?.(progress, 'Downloading items...')
        await this.downloadItemsData()
        progress += stepSize
        appStore.updateLoadingProgress(progress)
      }
      
      // Download spells data
      if (options.includeSpells !== false) {
        progressCallback?.(progress, 'Downloading spells...')
        await this.downloadSpellsData()
        progress += stepSize
        appStore.updateLoadingProgress(progress)
      }
      
      // Download symbiants data
      if (options.includeSymbiants !== false) {
        progressCallback?.(progress, 'Downloading symbiants...')
        await this.downloadSymbiantsData()
        progress += stepSize
        appStore.updateLoadingProgress(progress)
      }
      
      // Download pocket bosses data
      if (options.includePocketBosses !== false) {
        progressCallback?.(progress, 'Downloading pocket bosses...')
        await this.downloadPocketBossesData()
        progress += stepSize
        appStore.updateLoadingProgress(progress)
      }
      
      this.lastSyncTime.value = Date.now()
      this.hasOfflineData.value = true
      
      await this.saveOfflineState()
      progressCallback?.(100, 'Download complete')
      
      appStore.addNotification({
        type: 'success',
        title: 'Offline Data Ready',
        message: 'Data downloaded for offline use',
        duration: 5000
      })
      
    } catch (error: any) {
      appStore.addNotification({
        type: 'error',
        title: 'Offline Download Failed',
        message: error.message || 'Failed to download offline data',
        duration: 8000
      })
      throw error
    } finally {
      appStore.setGlobalLoading(false)
    }
  }
  
  /**
   * Get offline data
   */
  async getOfflineData<T>(type: 'items' | 'spells' | 'symbiants' | 'pocketBosses'): Promise<T[]> {
    const key = this.offlineDataKeys[type]
    const data = await cacheManager.get<T[]>(key)
    return data || []
  }
  
  /**
   * Queue operation for later sync
   */
  queueOperation(operation: Omit<QueuedOperation, 'id' | 'timestamp'>): void {
    const queuedOp: QueuedOperation = {
      ...operation,
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    }
    
    this.queuedOperations.value.push(queuedOp)
    this.saveQueuedOperations()
  }
  
  /**
   * Sync queued operations when back online
   */
  async syncQueuedOperations(): Promise<void> {
    if (this.isOffline.value || this.syncInProgress.value || this.queuedOperations.value.length === 0) {
      return
    }
    
    const appStore = useAppStore()
    this.syncInProgress.value = true
    
    try {
      appStore.setGlobalLoading(true, 'Syncing offline changes...')
      
      const operations = [...this.queuedOperations.value]
      let successCount = 0
      
      for (const operation of operations) {
        try {
          await this.executeQueuedOperation(operation)
          this.removeQueuedOperation(operation.id)
          successCount++
        } catch (error) {
          console.warn('Failed to sync operation:', operation, error)
        }
      }
      
      if (successCount > 0) {
        appStore.addNotification({
          type: 'success',
          title: 'Sync Complete',
          message: `${successCount} changes synchronized`,
          duration: 3000
        })
      }
      
      if (this.queuedOperations.value.length > 0) {
        appStore.addNotification({
          type: 'warning',
          title: 'Partial Sync',
          message: `${this.queuedOperations.value.length} operations failed to sync`,
          duration: 5000
        })
      }
      
    } catch (error: any) {
      appStore.addNotification({
        type: 'error',
        title: 'Sync Failed',
        message: error.message || 'Failed to sync offline changes',
        duration: 8000
      })
    } finally {
      this.syncInProgress.value = false
      appStore.setGlobalLoading(false)
      await this.saveOfflineState()
    }
  }
  
  /**
   * Check if data is available offline
   */
  async isDataAvailableOffline(type: 'items' | 'spells' | 'symbiants' | 'pocketBosses'): Promise<boolean> {
    const data = await this.getOfflineData(type)
    return data.length > 0
  }
  
  /**
   * Get offline data statistics
   */
  async getOfflineStats(): Promise<{
    totalItems: number
    totalSpells: number
    totalSymbiants: number
    totalPocketBosses: number
    totalSize: number
    lastUpdate: Date
    queuedOperations: number
  }> {
    const [items, spells, symbiants, pocketBosses] = await Promise.all([
      this.getOfflineData<Item>('items'),
      this.getOfflineData<Spell>('spells'),
      this.getOfflineData<Symbiant>('symbiants'),
      this.getOfflineData<PocketBoss>('pocketBosses')
    ])
    
    const cacheStats = await cacheManager.getStats()
    
    return {
      totalItems: items.length,
      totalSpells: spells.length,
      totalSymbiants: symbiants.length,
      totalPocketBosses: pocketBosses.length,
      totalSize: cacheStats.totalSize,
      lastUpdate: new Date(this.lastSyncTime.value),
      queuedOperations: this.queuedOperations.value.length
    }
  }
  
  /**
   * Clear all offline data
   */
  async clearOfflineData(): Promise<void> {
    const appStore = useAppStore()
    
    try {
      appStore.setGlobalLoading(true, 'Clearing offline data...')
      
      // Clear cached offline data
      await Promise.all([
        cacheManager.remove(this.offlineDataKeys.items),
        cacheManager.remove(this.offlineDataKeys.spells),
        cacheManager.remove(this.offlineDataKeys.symbiants),
        cacheManager.remove(this.offlineDataKeys.pocketBosses),
        cacheManager.remove(this.offlineDataKeys.operations),
        cacheManager.remove(this.offlineDataKeys.lastSync)
      ])
      
      // Reset state
      this.hasOfflineData.value = false
      this.lastSyncTime.value = 0
      this.queuedOperations.value = []
      
      await this.saveOfflineState()
      
      appStore.addNotification({
        type: 'success',
        title: 'Offline Data Cleared',
        message: 'All offline data has been removed',
        duration: 3000
      })
      
    } catch (error: any) {
      appStore.addNotification({
        type: 'error',
        title: 'Clear Failed',
        message: error.message || 'Failed to clear offline data',
        duration: 5000
      })
    } finally {
      appStore.setGlobalLoading(false)
    }
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private setupOfflineDetection(): void {
    if (typeof window === 'undefined') return
    
    // Monitor online/offline status
    const updateOnlineStatus = () => {
      const wasOffline = this.isOffline.value
      this.isOffline.value = !navigator.onLine
      
      const appStore = useAppStore()
      
      if (wasOffline && navigator.onLine) {
        // Just came back online - sync queued operations
        this.syncQueuedOperations()
        
        appStore.addNotification({
          type: 'success',
          title: 'Back Online',
          message: 'Syncing offline changes...',
          duration: 3000
        })
      } else if (!wasOffline && !navigator.onLine) {
        // Just went offline
        appStore.addNotification({
          type: 'info',
          title: 'Working Offline',
          message: this.hasOfflineData.value 
            ? 'Using cached data' 
            : 'Limited functionality available',
          duration: 5000
        })
      }
    }
    
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)
    
    // Initial status
    this.isOffline.value = !navigator.onLine
  }
  
  private async loadOfflineState(): Promise<void> {
    try {
      const lastSync = await cacheManager.get<number>(this.offlineDataKeys.lastSync)
      if (lastSync) {
        this.lastSyncTime.value = lastSync
      }
      
      const queuedOps = await cacheManager.get<QueuedOperation[]>(this.offlineDataKeys.operations)
      if (queuedOps) {
        this.queuedOperations.value = queuedOps
      }
    } catch (error) {
      console.warn('Failed to load offline state:', error)
    }
  }
  
  private async saveOfflineState(): Promise<void> {
    try {
      await cacheManager.set(this.offlineDataKeys.lastSync, this.lastSyncTime.value)
      await this.saveQueuedOperations()
    } catch (error) {
      console.warn('Failed to save offline state:', error)
    }
  }
  
  private async saveQueuedOperations(): Promise<void> {
    try {
      await cacheManager.set(this.offlineDataKeys.operations, this.queuedOperations.value)
    } catch (error) {
      console.warn('Failed to save queued operations:', error)
    }
  }
  
  private async checkOfflineDataAvailability(): Promise<void> {
    const hasAnyData = await Promise.all([
      this.isDataAvailableOffline('items'),
      this.isDataAvailableOffline('spells'),
      this.isDataAvailableOffline('symbiants'),
      this.isDataAvailableOffline('pocketBosses')
    ])
    
    this.hasOfflineData.value = hasAnyData.some(Boolean)
  }
  
  private async downloadItemsData(): Promise<void> {
    const { useItemsStore } = await import('../stores/items')
    const itemsStore = useItemsStore()
    
    // Download commonly used items
    const commonItems = await itemsStore.searchItems({
      min_ql: 200,
      limit: 500
    })
    
    await cacheManager.set(this.offlineDataKeys.items, commonItems, Infinity)
  }
  
  private async downloadSpellsData(): Promise<void> {
    const { useSpellsStore } = await import('../stores/spells')
    const spellsStore = useSpellsStore()
    
    // Download spells with criteria (most useful)
    const commonSpells = await spellsStore.searchSpells({
      has_criteria: true,
      limit: 200
    })
    
    await cacheManager.set(this.offlineDataKeys.spells, commonSpells, Infinity)
  }
  
  private async downloadSymbiantsData(): Promise<void> {
    const { useSymbiantsStore } = await import('../stores/symbiants')
    const symbiantsStore = useSymbiantsStore()
    
    // Download all symbiants (relatively small dataset)
    const allSymbiants = await symbiantsStore.loadAllSymbiants()
    
    await cacheManager.set(this.offlineDataKeys.symbiants, allSymbiants, Infinity)
  }
  
  private async downloadPocketBossesData(): Promise<void> {
    const { usePocketBossesStore } = await import('../stores/pocket-bosses')
    const pocketBossesStore = usePocketBossesStore()
    
    // Download all pocket bosses (small dataset)
    const allBosses = await pocketBossesStore.loadAllPocketBosses()
    
    await cacheManager.set(this.offlineDataKeys.pocketBosses, allBosses, Infinity)
  }
  
  private removeQueuedOperation(operationId: string): void {
    const index = this.queuedOperations.value.findIndex(op => op.id === operationId)
    if (index > -1) {
      this.queuedOperations.value.splice(index, 1)
    }
  }
  
  private async executeQueuedOperation(operation: QueuedOperation): Promise<void> {
    // This would implement the actual sync logic for different operation types
    // For now, just simulate success
    console.log('Executing queued operation:', operation)
    
    // In a real implementation, you would:
    // 1. Check the operation type
    // 2. Call the appropriate API endpoint
    // 3. Handle success/failure
    
    switch (operation.type) {
      case 'favorite':
        // Sync favorite items with server (if needed)
        break
      case 'collection':
        // Sync collection changes with server (if needed)
        break
      case 'preference':
        // Sync user preferences with server (if needed)
        break
      case 'profile':
        // Sync profile changes with server (if needed)
        break
    }
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const offlineManager = new OfflineManager()
export default offlineManager
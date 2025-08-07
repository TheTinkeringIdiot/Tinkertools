/**
 * Cache Manager - Client-side caching with TTL and storage management
 * 
 * Provides intelligent caching for API responses, search results, and computed data
 */

import type { CacheEntry, CacheConfig } from '../types/api'

// ============================================================================
// Cache Configuration
// ============================================================================

const DEFAULT_CACHE_CONFIG: CacheConfig = {
  staticData: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    keys: ['items', 'nanos', 'symbiants', 'pocket-bosses', 'categories']
  },
  dynamicData: {
    ttl: 5 * 60 * 1000, // 5 minutes
    keys: ['search-results', 'calculations', 'compatibility']
  },
  userData: {
    ttl: Infinity, // Until manual refresh
    keys: ['profiles', 'preferences', 'builds', 'collection']
  }
}

// ============================================================================
// Storage Adapters
// ============================================================================

interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  clear(): void
  length: number
  key(index: number): string | null
}

class MemoryStorageAdapter implements StorageAdapter {
  private storage = new Map<string, string>()
  
  get length(): number {
    return this.storage.size
  }
  
  getItem(key: string): string | null {
    return this.storage.get(key) || null
  }
  
  setItem(key: string, value: string): void {
    this.storage.set(key, value)
  }
  
  removeItem(key: string): void {
    this.storage.delete(key)
  }
  
  clear(): void {
    this.storage.clear()
  }
  
  key(index: number): string | null {
    const keys = Array.from(this.storage.keys())
    return keys[index] || null
  }
}

class LocalStorageAdapter implements StorageAdapter {
  get length(): number {
    return localStorage.length
  }
  
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch (err) {
      console.warn('LocalStorage getItem failed:', err)
      return null
    }
  }
  
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch (err) {
      console.warn('LocalStorage setItem failed:', err)
      // Handle quota exceeded by clearing some cache
      this.clearExpired()
      try {
        localStorage.setItem(key, value)
      } catch (retryErr) {
        console.error('LocalStorage setItem failed on retry:', retryErr)
      }
    }
  }
  
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch (err) {
      console.warn('LocalStorage removeItem failed:', err)
    }
  }
  
  clear(): void {
    try {
      localStorage.clear()
    } catch (err) {
      console.warn('LocalStorage clear failed:', err)
    }
  }
  
  key(index: number): string | null {
    try {
      return localStorage.key(index)
    } catch (err) {
      console.warn('LocalStorage key failed:', err)
      return null
    }
  }
  
  private clearExpired(): void {
    const keysToRemove: string[] = []
    
    for (let i = 0; i < this.length; i++) {
      const key = this.key(i)
      if (key?.startsWith('tinkertools_cache_')) {
        try {
          const cached = this.getItem(key)
          if (cached) {
            const entry = JSON.parse(cached) as CacheEntry<any>
            if (entry.expiry < Date.now()) {
              keysToRemove.push(key)
            }
          }
        } catch (err) {
          // Invalid cache entry, remove it
          keysToRemove.push(key)
        }
      }
    }
    
    keysToRemove.forEach(key => this.removeItem(key))
  }
}

// ============================================================================
// Cache Manager
// ============================================================================

export class CacheManager {
  private storage: StorageAdapter
  private config: CacheConfig
  private keyPrefix = 'tinkertools_cache_'
  
  constructor(config: CacheConfig = DEFAULT_CACHE_CONFIG, useLocalStorage = true) {
    this.config = config
    this.storage = useLocalStorage && typeof localStorage !== 'undefined' 
      ? new LocalStorageAdapter() 
      : new MemoryStorageAdapter()
  }
  
  // ============================================================================
  // Core Cache Operations
  // ============================================================================
  
  /**
   * Get cached data by key
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = this.keyPrefix + key
      const cached = this.storage.getItem(cacheKey)
      
      if (!cached) {
        return null
      }
      
      const entry: CacheEntry<T> = JSON.parse(cached)
      
      // Check expiration
      if (entry.expiry < Date.now()) {
        this.storage.removeItem(cacheKey)
        return null
      }
      
      return entry.data
    } catch (err) {
      console.warn(`Cache get failed for key ${key}:`, err)
      return null
    }
  }
  
  /**
   * Set cached data with TTL
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    try {
      const cacheKey = this.keyPrefix + key
      const cacheTTL = ttl || this.getTTLForKey(key)
      
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        expiry: Date.now() + cacheTTL
      }
      
      this.storage.setItem(cacheKey, JSON.stringify(entry))
    } catch (err) {
      console.warn(`Cache set failed for key ${key}:`, err)
    }
  }
  
  /**
   * Remove cached data
   */
  async remove(key: string): Promise<void> {
    try {
      const cacheKey = this.keyPrefix + key
      this.storage.removeItem(cacheKey)
    } catch (err) {
      console.warn(`Cache remove failed for key ${key}:`, err)
    }
  }
  
  /**
   * Check if key exists and is not expired
   */
  async has(key: string): Promise<boolean> {
    const data = await this.get(key)
    return data !== null
  }
  
  /**
   * Clear all cache data
   */
  async clear(): Promise<void> {
    try {
      // Only remove cache keys, preserve other data
      const keysToRemove: string[] = []
      
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i)
        if (key?.startsWith(this.keyPrefix)) {
          keysToRemove.push(key)
        }
      }
      
      keysToRemove.forEach(key => this.storage.removeItem(key))
    } catch (err) {
      console.warn('Cache clear failed:', err)
    }
  }
  
  // ============================================================================
  // Specialized Cache Operations
  // ============================================================================
  
  /**
   * Cache API response with automatic key generation
   */
  async cacheApiResponse<T>(endpoint: string, params: Record<string, any>, data: T, ttl?: number): Promise<void> {
    const key = this.generateApiKey(endpoint, params)
    await this.set(key, data, ttl)
  }
  
  /**
   * Get cached API response
   */
  async getCachedApiResponse<T>(endpoint: string, params: Record<string, any>): Promise<T | null> {
    const key = this.generateApiKey(endpoint, params)
    return await this.get<T>(key)
  }
  
  /**
   * Cache search results with pagination info
   */
  async cacheSearchResults<T>(query: any, results: T[], pagination: any): Promise<void> {
    const key = this.generateSearchKey(query)
    const cacheData = {
      results,
      pagination,
      query,
      timestamp: Date.now()
    }
    await this.set(key, cacheData, this.config.dynamicData.ttl)
  }
  
  /**
   * Get cached search results
   */
  async getCachedSearchResults<T>(query: any): Promise<{ results: T[]; pagination: any; query: any } | null> {
    const key = this.generateSearchKey(query)
    return await this.get(key)
  }
  
  /**
   * Cache computed/calculated data
   */
  async cacheCalculation<T>(calculationId: string, params: any, result: T): Promise<void> {
    const key = `calc_${calculationId}_${this.hashParams(params)}`
    await this.set(key, result, this.config.dynamicData.ttl)
  }
  
  /**
   * Get cached calculation result
   */
  async getCachedCalculation<T>(calculationId: string, params: any): Promise<T | null> {
    const key = `calc_${calculationId}_${this.hashParams(params)}`
    return await this.get(key)
  }
  
  // ============================================================================
  // Bulk Operations
  // ============================================================================
  
  /**
   * Set multiple cache entries at once
   */
  async setMany<T>(entries: Array<{ key: string; data: T; ttl?: number }>): Promise<void> {
    const promises = entries.map(entry => this.set(entry.key, entry.data, entry.ttl))
    await Promise.all(promises)
  }
  
  /**
   * Get multiple cache entries at once
   */
  async getMany<T>(keys: string[]): Promise<Array<{ key: string; data: T | null }>> {
    const promises = keys.map(async key => ({
      key,
      data: await this.get<T>(key)
    }))
    return Promise.all(promises)
  }
  
  /**
   * Remove multiple cache entries
   */
  async removeMany(keys: string[]): Promise<void> {
    const promises = keys.map(key => this.remove(key))
    await Promise.all(promises)
  }
  
  // ============================================================================
  // Cache Management
  // ============================================================================
  
  /**
   * Clean up expired cache entries
   */
  async cleanup(): Promise<void> {
    try {
      const keysToRemove: string[] = []
      
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i)
        if (key?.startsWith(this.keyPrefix)) {
          try {
            const cached = this.storage.getItem(key)
            if (cached) {
              const entry = JSON.parse(cached) as CacheEntry<any>
              if (entry.expiry < Date.now()) {
                keysToRemove.push(key)
              }
            }
          } catch (err) {
            // Invalid cache entry, remove it
            keysToRemove.push(key)
          }
        }
      }
      
      keysToRemove.forEach(key => this.storage.removeItem(key))
      
      console.log(`Cache cleanup: removed ${keysToRemove.length} expired entries`)
    } catch (err) {
      console.warn('Cache cleanup failed:', err)
    }
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number
    expiredEntries: number
    totalSize: number
    entries: Array<{ key: string; size: number; expiry: number; expired: boolean }>
  }> {
    const entries: Array<{ key: string; size: number; expiry: number; expired: boolean }> = []
    let totalSize = 0
    let expiredCount = 0
    
    try {
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i)
        if (key?.startsWith(this.keyPrefix)) {
          const cached = this.storage.getItem(key)
          if (cached) {
            try {
              const entry = JSON.parse(cached) as CacheEntry<any>
              const size = new Blob([cached]).size
              const expired = entry.expiry < Date.now()
              
              entries.push({
                key: key.replace(this.keyPrefix, ''),
                size,
                expiry: entry.expiry,
                expired
              })
              
              totalSize += size
              if (expired) expiredCount++
            } catch (err) {
              // Invalid entry
            }
          }
        }
      }
    } catch (err) {
      console.warn('Cache stats generation failed:', err)
    }
    
    return {
      totalEntries: entries.length,
      expiredEntries: expiredCount,
      totalSize,
      entries: entries.sort((a, b) => b.size - a.size)
    }
  }
  
  // ============================================================================
  // Utility Methods
  // ============================================================================
  
  private getTTLForKey(key: string): number {
    // Determine TTL based on key pattern
    if (this.config.staticData.keys.some(pattern => key.includes(pattern))) {
      return this.config.staticData.ttl
    }
    
    if (this.config.dynamicData.keys.some(pattern => key.includes(pattern))) {
      return this.config.dynamicData.ttl
    }
    
    if (this.config.userData.keys.some(pattern => key.includes(pattern))) {
      return this.config.userData.ttl
    }
    
    // Default to dynamic data TTL
    return this.config.dynamicData.ttl
  }
  
  private generateApiKey(endpoint: string, params: Record<string, any>): string {
    const normalizedEndpoint = endpoint.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '_')
    const paramsHash = this.hashParams(params)
    return `api_${normalizedEndpoint}_${paramsHash}`
  }
  
  private generateSearchKey(query: any): string {
    const queryHash = this.hashParams(query)
    return `search_${queryHash}`
  }
  
  private hashParams(params: any): string {
    try {
      const normalized = JSON.stringify(params, Object.keys(params).sort())
      return this.simpleHash(normalized)
    } catch (err) {
      return this.simpleHash(String(params))
    }
  }
  
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }
}

// ============================================================================
// Global Cache Instance
// ============================================================================

export const cacheManager = new CacheManager()

// Periodic cleanup every 15 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    cacheManager.cleanup()
  }, 15 * 60 * 1000)
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    cacheManager.cleanup()
  })
}

export default cacheManager
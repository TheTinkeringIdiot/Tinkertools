/**
 * API Client Service for TinkerTools
 * 
 * Provides typed HTTP client for all backend endpoints with:
 * - Axios integration with interceptors
 * - Request/response typing
 * - Error handling and retry logic
 * - Request batching and deduplication
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import type {
  ApiResponse,
  PaginatedResponse,
  Item,
  Spell,
  Symbiant,
  PocketBoss,
  ItemSearchQuery,
  SpellSearchQuery,
  SymbiantSearchQuery,
  PocketBossSearchQuery,
  ItemFilterRequest,
  ItemCompatibilityRequest,
  ItemCompatibilityResult,
  BatchItemRequest,
  UserFriendlyError,
  ApiError,
  ErrorCodes
} from '../types/api'

// ============================================================================
// Configuration
// ============================================================================

const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  batchDelay: 50 // ms to wait before executing batch requests
}

// ============================================================================
// Error Handling
// ============================================================================

class ApiErrorHandler {
  static handle(error: ApiError): UserFriendlyError {
    switch (error.code) {
      case ErrorCodes.VALIDATION_ERROR:
        return {
          type: 'warning',
          title: 'Invalid Input',
          message: error.message,
          action: 'Please check your input and try again',
          recoverable: true
        }
      
      case ErrorCodes.NOT_FOUND:
        return {
          type: 'info',
          title: 'Not Found',
          message: 'The requested item could not be found',
          action: 'Try refining your search criteria',
          recoverable: true
        }
      
      case ErrorCodes.RATE_LIMITED:
        return {
          type: 'warning',
          title: 'Too Many Requests',
          message: 'Please wait a moment before trying again',
          action: 'Retry in a few seconds',
          recoverable: true,
          retryAfter: 5000
        }
      
      case ErrorCodes.TIMEOUT:
        return {
          type: 'warning',
          title: 'Request Timeout',
          message: 'The request took too long to complete',
          action: 'Please try again',
          recoverable: true
        }
      
      default:
        return {
          type: 'error',
          title: 'Unexpected Error',
          message: 'Something went wrong. Please try again.',
          action: 'Contact support if the problem persists',
          recoverable: false
        }
    }
  }
}

// ============================================================================
// Batch Request Manager
// ============================================================================

interface PendingBatch<T> {
  ids: (string | number)[]
  promise: Promise<T[]>
  resolve: (data: T[]) => void
  reject: (error: any) => void
}

class BatchRequestManager {
  private pendingBatches = new Map<string, PendingBatch<any>>()
  
  async batchItems(itemIds: number[]): Promise<Item[]> {
    return this.createBatch('items', itemIds, (ids) => 
      apiClient.post<Item[]>('/items/batch', { item_ids: ids })
    )
  }
  
  async batchSpells(spellIds: number[]): Promise<Spell[]> {
    return this.createBatch('spells', spellIds, (ids) =>
      apiClient.post<Spell[]>('/spells/batch', { spell_ids: ids })
    )
  }
  
  private async createBatch<T>(
    batchKey: string,
    ids: (string | number)[],
    executor: (ids: (string | number)[]) => Promise<ApiResponse<T[]>>
  ): Promise<T[]> {
    const existing = this.pendingBatches.get(batchKey)
    
    if (existing) {
      existing.ids.push(...ids)
      return existing.promise
    }
    
    let resolve: (data: T[]) => void
    let reject: (error: any) => void
    
    const promise = new Promise<T[]>((res, rej) => {
      resolve = res
      reject = rej
    })
    
    const batch: PendingBatch<T> = {
      ids: [...ids],
      promise,
      resolve: resolve!,
      reject: reject!
    }
    
    this.pendingBatches.set(batchKey, batch)
    
    // Execute batch after short delay to collect more requests
    setTimeout(async () => {
      try {
        const response = await executor(batch.ids)
        batch.resolve(response.data || [])
      } catch (error) {
        batch.reject(error)
      } finally {
        this.pendingBatches.delete(batchKey)
      }
    }, API_CONFIG.batchDelay)
    
    return promise
  }
}

// ============================================================================
// Main API Client
// ============================================================================

class TinkerToolsApiClient {
  private client: AxiosInstance
  private batchManager: BatchRequestManager
  
  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.baseURL,
      timeout: API_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0',
        'X-Client-Name': 'TinkerTools-Frontend'
      }
    })
    
    this.batchManager = new BatchRequestManager()
    this.setupInterceptors()
  }
  
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add request ID for tracking
        config.headers['X-Request-ID'] = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        
        // Add timestamp
        config.headers['X-Request-Timestamp'] = new Date().toISOString()
        
        return config
      },
      (error) => Promise.reject(error)
    )
    
    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config
        
        // Retry logic for specific errors
        if (
          error.response?.status >= 500 &&
          originalRequest &&
          !originalRequest._retry &&
          originalRequest._retryCount < API_CONFIG.retryAttempts
        ) {
          originalRequest._retry = true
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1
          
          // Exponential backoff
          const delay = API_CONFIG.retryDelay * Math.pow(2, originalRequest._retryCount - 1)
          await new Promise(resolve => setTimeout(resolve, delay))
          
          return this.client(originalRequest)
        }
        
        return Promise.reject(error)
      }
    )
  }
  
  // ============================================================================
  // Generic HTTP Methods
  // ============================================================================
  
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get<ApiResponse<T>>(url, config)
      return response.data
    } catch (error: any) {
      throw this.handleError(error)
    }
  }
  
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(url, data, config)
      return response.data
    } catch (error: any) {
      throw this.handleError(error)
    }
  }
  
  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<ApiResponse<T>>(url, data, config)
      return response.data
    } catch (error: any) {
      throw this.handleError(error)
    }
  }
  
  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<ApiResponse<T>>(url, config)
      return response.data
    } catch (error: any) {
      throw this.handleError(error)
    }
  }
  
  // ============================================================================
  // Items API
  // ============================================================================
  
  async searchItems(query: ItemSearchQuery): Promise<PaginatedResponse<Item>> {
    const params = new URLSearchParams()
    
    if (query.search) params.append('search', query.search)
    if (query.item_class?.length) query.item_class.forEach(c => params.append('item_class', c.toString()))
    if (query.min_ql) params.append('min_ql', query.min_ql.toString())
    if (query.max_ql) params.append('max_ql', query.max_ql.toString())
    if (query.is_nano !== undefined) params.append('is_nano', query.is_nano.toString())
    if (query.page) params.append('page', query.page.toString())
    if (query.limit) params.append('limit', query.limit.toString())
    if (query.sort) params.append('sort', query.sort)
    if (query.sort_order) params.append('sort_order', query.sort_order)
    
    return this.get<Item[]>(`/items?${params.toString()}`) as Promise<PaginatedResponse<Item>>
  }
  
  async getItem(id: number): Promise<ApiResponse<Item>> {
    return this.get<Item>(`/items/${id}`)
  }
  
  async getItems(ids: number[]): Promise<ApiResponse<Item[]>> {
    if (ids.length === 1) {
      const response = await this.getItem(ids[0])
      return {
        ...response,
        data: response.data ? [response.data] : []
      }
    }
    return this.batchManager.batchItems(ids).then(data => ({ success: true, data }))
  }
  
  async filterItems(filter: ItemFilterRequest): Promise<PaginatedResponse<Item>> {
    return this.post<Item[]>('/items/filter', filter) as Promise<PaginatedResponse<Item>>
  }
  
  async checkItemCompatibility(request: ItemCompatibilityRequest): Promise<ApiResponse<ItemCompatibilityResult[]>> {
    return this.post<ItemCompatibilityResult[]>('/items/compatibility', request)
  }
  
  // ============================================================================
  // Spells API
  // ============================================================================
  
  async searchSpells(query: SpellSearchQuery): Promise<PaginatedResponse<Spell>> {
    const params = new URLSearchParams()
    
    if (query.search) params.append('search', query.search)
    if (query.has_criteria !== undefined) params.append('has_criteria', query.has_criteria.toString())
    if (query.spell_id) params.append('spell_id', query.spell_id.toString())
    if (query.page) params.append('page', query.page.toString())
    if (query.limit) params.append('limit', query.limit.toString())
    
    return this.get<Spell[]>(`/spells?${params.toString()}`) as Promise<PaginatedResponse<Spell>>
  }
  
  async getSpell(id: number): Promise<ApiResponse<Spell>> {
    return this.get<Spell>(`/spells/${id}`)
  }
  
  // ============================================================================
  // Symbiants API
  // ============================================================================
  
  async searchSymbiants(query: SymbiantSearchQuery): Promise<PaginatedResponse<Symbiant>> {
    const params = new URLSearchParams()
    
    if (query.search) params.append('search', query.search)
    if (query.family?.length) query.family.forEach(f => params.append('family', f))
    if (query.page) params.append('page', query.page.toString())
    if (query.limit) params.append('limit', query.limit.toString())
    
    return this.get<Symbiant[]>(`/symbiants?${params.toString()}`) as Promise<PaginatedResponse<Symbiant>>
  }
  
  async getSymbiant(id: number): Promise<ApiResponse<Symbiant>> {
    return this.get<Symbiant>(`/symbiants/${id}`)
  }
  
  // ============================================================================
  // Pocket Bosses API
  // ============================================================================
  
  async searchPocketBosses(query: PocketBossSearchQuery): Promise<PaginatedResponse<PocketBoss>> {
    const params = new URLSearchParams()
    
    if (query.search) params.append('search', query.search)
    if (query.min_level) params.append('min_level', query.min_level.toString())
    if (query.max_level) params.append('max_level', query.max_level.toString())
    if (query.playfield) params.append('playfield', query.playfield)
    if (query.page) params.append('page', query.page.toString())
    if (query.limit) params.append('limit', query.limit.toString())
    
    return this.get<PocketBoss[]>(`/pocket-bosses?${params.toString()}`) as Promise<PaginatedResponse<PocketBoss>>
  }
  
  async getPocketBoss(id: number): Promise<ApiResponse<PocketBoss>> {
    return this.get<PocketBoss>(`/pocket-bosses/${id}`)
  }
  
  async getPocketBossDrops(id: number): Promise<ApiResponse<Symbiant[]>> {
    return this.get<Symbiant[]>(`/pocket-bosses/${id}/drops`)
  }
  
  // ============================================================================
  // Stat Values API
  // ============================================================================
  
  async getStatValues(params?: { stat?: number; value?: number }): Promise<PaginatedResponse<any>> {
    const searchParams = new URLSearchParams()
    if (params?.stat) searchParams.append('stat', params.stat.toString())
    if (params?.value) searchParams.append('value', params.value.toString())
    
    return this.get<any[]>(`/stat-values?${searchParams.toString()}`) as Promise<PaginatedResponse<any>>
  }
  
  // ============================================================================
  // Health Check
  // ============================================================================
  
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.get<{ status: string; timestamp: string }>('/health')
  }
  
  // ============================================================================
  // Error Handling
  // ============================================================================
  
  private handleError(error: any): UserFriendlyError {
    if (error.response?.data?.error) {
      return ApiErrorHandler.handle(error.response.data.error)
    }
    
    if (error.code === 'NETWORK_ERROR') {
      return {
        type: 'error',
        title: 'Network Error',
        message: 'Unable to connect to the server',
        action: 'Check your internet connection and try again',
        recoverable: true
      }
    }
    
    if (error.code === 'ECONNABORTED') {
      return {
        type: 'warning',
        title: 'Request Timeout',
        message: 'The request took too long to complete',
        action: 'Please try again',
        recoverable: true
      }
    }
    
    return {
      type: 'error',
      title: 'Unexpected Error',
      message: error.message || 'An unexpected error occurred',
      action: 'Please try again or contact support',
      recoverable: false
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const apiClient = new TinkerToolsApiClient()
export { ApiErrorHandler, BatchRequestManager }
export default apiClient
/**
 * API Client Service for TinkerTools
 *
 * Provides typed HTTP client for all backend endpoints with:
 * - Axios integration with interceptors
 * - Request/response typing
 * - Error handling and retry logic
 * - Request batching and deduplication
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import type {
  ApiResponse,
  PaginatedResponse,
  Item,
  Spell,
  SymbiantItem,
  Mob,
  MobWithDrops,
  ItemSearchQuery,
  SpellSearchQuery,
  SymbiantSearchQuery,
  MobSearchQuery,
  MobDropsQuery,
  ItemFilterRequest,
  ItemCompatibilityRequest,
  ItemCompatibilityResult,
  BatchItemRequest,
  UserFriendlyError,
  ApiError,
  InterpolatedItem,
  InterpolationRequest,
  InterpolationResponse,
  InterpolationInfo,
  ImplantLookupResponse,
  BatchInterpolationResponse,
  BatchPerkLookupResponse,
} from '../types/api';
import { ErrorCodes } from '../types/api';

// ============================================================================
// Configuration
// ============================================================================

const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  timeout: 120000, // 120 seconds - increased for large dataset loads (symbiants ~900+ items, pocket bosses)
  retryAttempts: 3,
  retryDelay: 1000,
  batchDelay: 50, // ms to wait before executing batch requests
};

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
          recoverable: true,
        };

      case ErrorCodes.NOT_FOUND:
        return {
          type: 'info',
          title: 'Not Found',
          message: 'The requested item could not be found',
          action: 'Try refining your search criteria',
          recoverable: true,
        };

      case ErrorCodes.RATE_LIMITED:
        return {
          type: 'warning',
          title: 'Too Many Requests',
          message: 'Please wait a moment before trying again',
          action: 'Retry in a few seconds',
          recoverable: true,
          retryAfter: 5000,
        };

      case ErrorCodes.TIMEOUT:
        return {
          type: 'warning',
          title: 'Request Timeout',
          message: 'The request took too long to complete',
          action: 'Please try again',
          recoverable: true,
        };

      default:
        return {
          type: 'error',
          title: 'Unexpected Error',
          message: 'Something went wrong. Please try again.',
          action: 'Contact support if the problem persists',
          recoverable: false,
        };
    }
  }
}

// ============================================================================
// Batch Request Manager
// ============================================================================

interface PendingBatch<T> {
  ids: (string | number)[];
  promise: Promise<T[]>;
  resolve: (data: T[]) => void;
  reject: (error: any) => void;
}

class BatchRequestManager {
  private pendingBatches = new Map<string, PendingBatch<any>>();

  async batchItems(itemIds: number[]): Promise<Item[]> {
    return this.createBatch('items', itemIds, (ids) =>
      apiClient.post<Item[]>('/items/batch', { item_ids: ids })
    );
  }

  async batchSpells(spellIds: number[]): Promise<Spell[]> {
    return this.createBatch('spells', spellIds, (ids) =>
      apiClient.post<Spell[]>('/spells/batch', { spell_ids: ids })
    );
  }

  private async createBatch<T>(
    batchKey: string,
    ids: (string | number)[],
    executor: (ids: (string | number)[]) => Promise<ApiResponse<T[]>>
  ): Promise<T[]> {
    const existing = this.pendingBatches.get(batchKey);

    if (existing) {
      existing.ids.push(...ids);
      return existing.promise;
    }

    let resolve: (data: T[]) => void;
    let reject: (error: any) => void;

    const promise = new Promise<T[]>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const batch: PendingBatch<T> = {
      ids: [...ids],
      promise,
      resolve: resolve!,
      reject: reject!,
    };

    this.pendingBatches.set(batchKey, batch);

    // Execute batch after short delay to collect more requests
    setTimeout(async () => {
      try {
        const response = await executor(batch.ids);
        batch.resolve(response.data || []);
      } catch (error) {
        batch.reject(error);
      } finally {
        this.pendingBatches.delete(batchKey);
      }
    }, API_CONFIG.batchDelay);

    return promise;
  }
}

// ============================================================================
// Main API Client
// ============================================================================

class TinkerToolsApiClient {
  private client: AxiosInstance;
  private batchManager: BatchRequestManager;

  constructor() {
    this.client = axios.create({
      baseURL: API_CONFIG.baseURL,
      timeout: API_CONFIG.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0',
        'X-Client-Name': 'TinkerTools-Frontend',
      },
    });

    this.batchManager = new BatchRequestManager();
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add request ID for tracking
        config.headers['X-Request-ID'] =
          `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Add timestamp
        config.headers['X-Request-Timestamp'] = new Date().toISOString();

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Retry logic for specific errors
        if (
          error.response?.status >= 500 &&
          originalRequest &&
          !originalRequest._retry &&
          originalRequest._retryCount < API_CONFIG.retryAttempts
        ) {
          originalRequest._retry = true;
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

          // Exponential backoff
          const delay = API_CONFIG.retryDelay * Math.pow(2, originalRequest._retryCount - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));

          return this.client(originalRequest);
        }

        return Promise.reject(error);
      }
    );
  }

  // ============================================================================
  // Generic HTTP Methods
  // ============================================================================

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get<T>(url, config);
      // Check if response is already wrapped in ApiResponse format
      if (response.data && typeof response.data === 'object' && 'success' in response.data) {
        return response.data as ApiResponse<T>;
      }
      // Wrap raw response in ApiResponse format
      return {
        success: true,
        data: response.data,
      } as ApiResponse<T>;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async getPaginated<T>(url: string, config?: AxiosRequestConfig): Promise<PaginatedResponse<T>> {
    try {
      const response = await this.client.get<PaginatedResponse<T>>(url, config);
      // Return the paginated response directly without wrapping
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async postPaginated<T>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<PaginatedResponse<T>> {
    try {
      const response = await this.client.post<PaginatedResponse<T>>(url, data, config);
      // Return the paginated response directly without wrapping
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // ============================================================================
  // Items API
  // ============================================================================

  async searchItems(query: ItemSearchQuery): Promise<PaginatedResponse<Item>> {
    try {
      const params = new URLSearchParams();

      // Use correct parameter name for search endpoint
      if (query.search) {
        // Use the /search endpoint when search query is provided
        params.append('q', query.search);
        if (query.page) params.append('page', query.page.toString());
        if (query.limit) params.append('page_size', query.limit.toString());
        if (query.exact_match !== undefined)
          params.append('exact_match', query.exact_match.toString());
        if (query.is_nano !== undefined) params.append('weapons', (!query.is_nano).toString());
        if (query.search_fields && query.search_fields.length > 0) {
          params.append('search_fields', query.search_fields.join(','));
        }

        // Add new advanced search parameters
        if (query.min_ql !== undefined) params.append('min_ql', query.min_ql.toString());
        if (query.max_ql !== undefined) params.append('max_ql', query.max_ql.toString());
        if (query.item_class !== undefined) {
          const itemClass = Array.isArray(query.item_class)
            ? query.item_class[0]
            : query.item_class;
          params.append('item_class', itemClass.toString());
        }
        if (query.slot !== undefined) params.append('slot', query.slot.toString());
        if (query.profession !== undefined)
          params.append('profession', query.profession.toString());
        if (query.breed !== undefined) params.append('breed', query.breed.toString());
        if (query.gender !== undefined) params.append('gender', query.gender.toString());
        if (query.faction !== undefined) params.append('faction', query.faction.toString());
        if (query.froob_friendly !== undefined)
          params.append('froob_friendly', query.froob_friendly.toString());
        if (query.nodrop !== undefined) params.append('nodrop', query.nodrop.toString());
        if (query.stat_bonuses && query.stat_bonuses.length > 0) {
          params.append('stat_bonuses', query.stat_bonuses.join(','));
        }

        // Add stat filters
        if (query.stat_filters && query.stat_filters.length > 0) {
          const statFiltersParam = query.stat_filters
            .map((filter) => `${filter.function}:${filter.stat}:${filter.operator}:${filter.value}`)
            .join(',');
          params.append('stat_filters', statFiltersParam);
        }
        if (query.strain !== undefined) params.append('strain', query.strain.toString());

        return this.getPaginated<Item>(`/items/search?${params.toString()}`);
      } else {
        // Use the regular /items endpoint for filtering without search
        if (query.item_class !== undefined) {
          if (Array.isArray(query.item_class)) {
            query.item_class.forEach((c) => params.append('item_class', c.toString()));
          } else {
            params.append('item_class', query.item_class.toString());
          }
        }
        if (query.min_ql) params.append('min_ql', query.min_ql.toString());
        if (query.max_ql) params.append('max_ql', query.max_ql.toString());
        if (query.is_nano !== undefined) params.append('is_nano', query.is_nano.toString());
        if (query.page) params.append('page', query.page.toString());
        if (query.limit) params.append('page_size', query.limit.toString());
        if (query.sort) params.append('sort', query.sort);
        if (query.sort_order) params.append('sort_order', query.sort_order);

        // Add new advanced search parameters for regular endpoint too
        if (query.slot !== undefined) params.append('slot', query.slot.toString());
        if (query.profession !== undefined)
          params.append('profession', query.profession.toString());
        if (query.breed !== undefined) params.append('breed', query.breed.toString());
        if (query.gender !== undefined) params.append('gender', query.gender.toString());
        if (query.faction !== undefined) params.append('faction', query.faction.toString());
        if (query.froob_friendly !== undefined)
          params.append('froob_friendly', query.froob_friendly.toString());
        if (query.nodrop !== undefined) params.append('nodrop', query.nodrop.toString());
        if (query.stat_bonuses && query.stat_bonuses.length > 0) {
          params.append('stat_bonuses', query.stat_bonuses.join(','));
        }

        // Add stat filters
        if (query.stat_filters && query.stat_filters.length > 0) {
          const statFiltersParam = query.stat_filters
            .map((filter) => `${filter.function}:${filter.stat}:${filter.operator}:${filter.value}`)
            .join(',');
          params.append('stat_filters', statFiltersParam);
        }

        // Add strain filter
        if (query.strain !== undefined) {
          params.append('strain', query.strain.toString());
        }

        return this.getPaginated<Item>(`/items?${params.toString()}`);
      }
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async getItem(aoid: number): Promise<ApiResponse<Item>> {
    return this.get<Item>(`/items/${aoid}`);
  }

  async getItems(ids: number[]): Promise<ApiResponse<Item[]>> {
    if (ids.length === 1) {
      const response = await this.getItem(ids[0]);
      return {
        ...response,
        data: response.data ? [response.data] : [],
      };
    }
    return this.batchManager.batchItems(ids).then((data) => ({ success: true, data }));
  }

  async filterItems(filter: ItemFilterRequest): Promise<PaginatedResponse<Item>> {
    return this.postPaginated<Item>('/items/filter', filter);
  }

  async checkItemCompatibility(
    request: ItemCompatibilityRequest
  ): Promise<ApiResponse<ItemCompatibilityResult[]>> {
    return this.post<ItemCompatibilityResult[]>('/items/compatibility', request);
  }

  // ============================================================================
  // Implant API
  // ============================================================================

  async lookupImplant(
    slot: number,
    ql: number,
    clusters: Record<string, number>,
    signal?: AbortSignal
  ): Promise<ImplantLookupResponse> {
    try {
      const request = { slot, ql, clusters };
      const response = await this.client.post<ImplantLookupResponse>(
        '/implants/lookup',
        request,
        { signal }
      );

      // Backend returns ImplantLookupResponse with item in 'item' field
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async getAvailableImplants(slot: number, ql: number = 1): Promise<ApiResponse<Item[]>> {
    try {
      const response = await this.client.get<Item[]>(`/implants/slots/${slot}/available?ql=${ql}`);

      // Check if response is already wrapped in ApiResponse format
      if (response.data && typeof response.data === 'object' && 'success' in response.data) {
        return response.data as ApiResponse<Item[]>;
      }

      // Wrap raw response in ApiResponse format
      return {
        success: true,
        data: Array.isArray(response.data) ? response.data : [],
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async validateClusters(
    clusters: Record<string, number>
  ): Promise<ApiResponse<{ valid: boolean; message: string }>> {
    try {
      const response = await this.client.post<{ valid: boolean; message: string }>(
        '/implants/validate-clusters',
        clusters
      );

      // Check if response is already wrapped in ApiResponse format
      if (response.data && typeof response.data === 'object' && 'success' in response.data) {
        return response.data as ApiResponse<{ valid: boolean; message: string }>;
      }

      // Wrap raw response in ApiResponse format
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // ============================================================================
  // Perk API
  // ============================================================================

  async lookupPerkByAoid(aoid: number): Promise<any> {
    try {
      const response = await this.client.get(`/perks/lookup/${aoid}`);
      return response.data;
    } catch (error: any) {
      // Return null if perk not found
      if (error.response?.status === 404) {
        console.warn(`Perk with AOID ${aoid} not found`);
        return null;
      }
      throw this.handleError(error);
    }
  }

  async batchLookupPerks(aoids: number[]): Promise<BatchPerkLookupResponse> {
    try {
      const response = await this.client.post<BatchPerkLookupResponse>(
        '/perks/batch/lookup',
        { aoids }
      );
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // ============================================================================
  // Item Interpolation API
  // ============================================================================

  async interpolateItem(aoid: number, targetQl: number): Promise<InterpolationResponse> {
    try {
      const params = new URLSearchParams();
      params.append('target_ql', targetQl.toString());

      const response = await this.client.get<InterpolationResponse>(
        `/items/${aoid}/interpolate?${params.toString()}`
      );
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async interpolateItemByRequest(request: InterpolationRequest): Promise<InterpolationResponse> {
    try {
      const response = await this.client.post<InterpolationResponse>('/items/interpolate', request);
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async getInterpolationInfo(aoid: number): Promise<ApiResponse<InterpolationInfo>> {
    return this.get<InterpolationInfo>(`/items/${aoid}/interpolation-info`);
  }

  async checkItemInterpolatable(aoid: number): Promise<boolean> {
    try {
      const response = await this.getInterpolationInfo(aoid);
      return response.data?.interpolatable ?? false;
    } catch {
      return false;
    }
  }

  async getInterpolationRange(aoid: number): Promise<{ min: number; max: number } | null> {
    try {
      const response = await this.getInterpolationInfo(aoid);
      if (response.data) {
        return {
          min: response.data.min_ql,
          max: response.data.max_ql,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  async batchInterpolateItems(
    requests: Array<{ aoid: number; targetQl: number }>
  ): Promise<BatchInterpolationResponse> {
    try {
      const response = await this.client.post<BatchInterpolationResponse>(
        '/items/batch/interpolate',
        {
          items: requests.map(r => ({ aoid: r.aoid, target_ql: r.targetQl }))
        }
      );
      return response.data;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  // ============================================================================
  // Spells API
  // ============================================================================

  async searchSpells(query: SpellSearchQuery): Promise<PaginatedResponse<Spell>> {
    const params = new URLSearchParams();

    if (query.search) params.append('search', query.search);
    if (query.has_criteria !== undefined)
      params.append('has_criteria', query.has_criteria.toString());
    if (query.spell_id) params.append('spell_id', query.spell_id.toString());
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('limit', query.limit.toString());

    return this.getPaginated<Spell>(`/spells?${params.toString()}`);
  }

  async getSpell(id: number): Promise<ApiResponse<Spell>> {
    return this.get<Spell>(`/spells/${id}`);
  }

  // ============================================================================
  // Symbiants API
  // ============================================================================

  async searchSymbiants(query?: SymbiantSearchQuery & { page?: number; limit?: number }): Promise<PaginatedResponse<SymbiantItem>> {
    const params = new URLSearchParams();

    if (query?.page) params.append('page', query.page.toString());
    if (query?.limit) params.append('page_size', query.limit.toString());

    return this.getPaginated<SymbiantItem>(`/symbiants?${params.toString()}`);
  }

  async getSymbiant(id: number): Promise<ApiResponse<SymbiantItem>> {
    return this.get<SymbiantItem>(`/symbiants/${id}`);
  }

  async getSymbiantDroppedBy(symbiantId: number): Promise<ApiResponse<Mob[]>> {
    return this.get<Mob[]>(`/symbiants/${symbiantId}/dropped-by`);
  }

  // ============================================================================
  // Mobs API (includes Pocket Bosses)
  // ============================================================================

  async searchMobs(query: MobSearchQuery): Promise<PaginatedResponse<Mob>> {
    const params = new URLSearchParams();

    if (query.search) params.append('search', query.search);
    if (query.is_pocket_boss !== undefined)
      params.append('is_pocket_boss', query.is_pocket_boss.toString());
    if (query.playfield) params.append('playfield', query.playfield);
    if (query.min_level) params.append('min_level', query.min_level.toString());
    if (query.max_level) params.append('max_level', query.max_level.toString());
    if (query.page) params.append('page', query.page.toString());
    if (query.limit) params.append('page_size', query.limit.toString());

    return this.getPaginated<Mob>(`/mobs?${params.toString()}`);
  }

  async getMob(id: number): Promise<ApiResponse<Mob>> {
    return this.get<Mob>(`/mobs/${id}`);
  }

  async getMobDrops(id: number, filters?: MobDropsQuery): Promise<ApiResponse<SymbiantItem[]>> {
    const params = new URLSearchParams();
    if (filters?.family) params.append('family', filters.family);
    return this.get<SymbiantItem[]>(`/mobs/${id}/drops?${params.toString()}`);
  }

  // Legacy aliases for backward compatibility
  async searchPocketBosses(query: MobSearchQuery): Promise<PaginatedResponse<Mob>> {
    return this.searchMobs({ ...query, is_pocket_boss: true });
  }

  async getPocketBoss(id: number): Promise<ApiResponse<Mob>> {
    return this.getMob(id);
  }

  async getPocketBossDrops(id: number): Promise<ApiResponse<SymbiantItem[]>> {
    return this.getMobDrops(id);
  }

  // ============================================================================
  // Stat Values API
  // ============================================================================

  async getStatValues(params?: { stat?: number; value?: number }): Promise<PaginatedResponse<any>> {
    const searchParams = new URLSearchParams();
    if (params?.stat) searchParams.append('stat', params.stat.toString());
    if (params?.value) searchParams.append('value', params.value.toString());

    return this.getPaginated<any>(`/stat-values?${searchParams.toString()}`);
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.get<{ status: string; timestamp: string }>('/health');
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  private handleError(error: any): UserFriendlyError {
    if (error.response?.data?.error) {
      return ApiErrorHandler.handle(error.response.data.error);
    }

    if (error.code === 'NETWORK_ERROR') {
      return {
        type: 'error',
        title: 'Network Error',
        message: 'Unable to connect to the server',
        action: 'Check your internet connection and try again',
        recoverable: true,
      };
    }

    if (error.code === 'ECONNABORTED') {
      return {
        type: 'warning',
        title: 'Request Timeout',
        message: 'The request took too long to complete',
        action: 'Please try again',
        recoverable: true,
      };
    }

    return {
      type: 'error',
      title: 'Unexpected Error',
      message: error.message || 'An unexpected error occurred',
      action: 'Please try again or contact support',
      recoverable: false,
    };
  }
}

// ============================================================================
// Export
// ============================================================================

export const apiClient = new TinkerToolsApiClient();
export { ApiErrorHandler, BatchRequestManager };
export default apiClient;

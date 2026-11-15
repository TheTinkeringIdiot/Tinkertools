/**
 * API Client Service for TinkerTools
 *
 * Provides typed HTTP client for all backend endpoints with:
 * - Axios integration with interceptors
 * - Request/response typing
 * - Error handling and retry logic
 */

import axios, { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import type {
  ApiResponse,
  PaginatedResponse,
  Item,
  SymbiantItem,
  Mob,
  ItemSearchQuery,
  SymbiantSearchQuery,
  MobSearchQuery,
  MobDropsQuery,
  UserFriendlyError,
  ApiError,
  InterpolationResponse,
  InterpolationInfo,
  ImplantLookupResponse,
  BatchInterpolationResponse,
  BatchPerkLookupResponse,
} from '../types/api';
import { ErrorCodes } from '../types/api';
import type { ItemRevisionsBatchResponse } from '../types/game-version';
import type {
  BuildTransitionsResponse,
  ChangeListQuery,
  ChangeListResponse,
  ItemCompareResponse,
  ItemTimelineResponse,
  TransitionsQuery,
} from '../types/changes';
import { API_ROOT, apiBaseFor } from './api-config';
import { dataVersion, dataSlug } from '../composables/useGameVersion';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Route this one request to a specific game version instead of the current one. */
    gameVersion?: string;
  }
}

// ============================================================================
// Configuration
// ============================================================================

const API_CONFIG = {
  // Root only. The selected game version is applied per request in the
  // request interceptor (see apiBaseFor), so switching versions needs no new client.
  baseURL: API_ROOT,
  timeout: 120000, // 120 seconds - increased for large dataset loads (symbiants ~900+ items, pocket bosses)
  retryAttempts: 3,
  retryDelay: 1000,
};

// ============================================================================
// Error Handling
// ============================================================================

/** Request config carrying the response interceptor's retry bookkeeping */
type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _retryCount?: number;
};

/** The parts of an axios error (or a look-alike) that error handling reads */
interface RequestErrorLike {
  code?: string;
  message?: string;
  response?: { status?: number; data?: { error?: ApiError | string; detail?: unknown } };
  config?: RetryableRequestConfig;
}

function asRequestError(error: unknown): RequestErrorLike {
  return typeof error === 'object' && error !== null ? (error as RequestErrorLike) : {};
}

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

/** Options of the cross-version diff requests. */
export interface DiffRequestOptions {
  /** Newer side of the comparison; defaults to the version being browsed. */
  gameVersion?: string;
  signal?: AbortSignal;
}

function changeListParams(query: ChangeListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.page !== undefined) params.append('page', String(query.page));
  if (query.page_size !== undefined) params.append('page_size', String(query.page_size));
  if (query.sort) params.append('sort', query.sort);
  for (const kind of query.kind ?? []) params.append('kind', kind);
  for (const part of query.part ?? []) params.append('part', part);
  for (const relevance of query.relevance ?? []) params.append('relevance', relevance);
  if (query.is_nano !== undefined) params.append('is_nano', String(query.is_nano));
  if (query.item_class !== undefined) params.append('item_class', String(query.item_class));
  if (query.min_ql !== undefined) params.append('min_ql', String(query.min_ql));
  if (query.max_ql !== undefined) params.append('max_ql', String(query.max_ql));
  if (query.profession !== undefined) params.append('profession', String(query.profession));
  if (query.slot !== undefined) params.append('slot', String(query.slot));
  if (query.search) params.append('search', query.search);
  if (query.notes) params.append('notes', query.notes);
  if (query.note_id !== undefined) params.append('note_id', String(query.note_id));
  if (query.include_diff) params.append('include_diff', 'true');
  if (query.transition) {
    params.append('transition', query.transition);
    if (query.transition_old !== undefined) params.append('transition_old', query.transition_old);
    if (query.transition_new !== undefined) params.append('transition_new', query.transition_new);
  }
  return params;
}

// ============================================================================
// Main API Client
// ============================================================================

class TinkerToolsApiClient {
  private client: AxiosInstance;

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

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Scope the request to the selected game version, unless the caller
        // asked for a specific one (e.g. peeking at an item in another snapshot).
        config.baseURL = apiBaseFor(dataSlug(config.gameVersion) ?? dataVersion.value);

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
      async (error: unknown) => {
        const { response, config: originalRequest } = asRequestError(error);

        // Retry logic for specific errors
        if (
          (response?.status ?? 0) >= 500 &&
          originalRequest &&
          !originalRequest._retry &&
          (originalRequest._retryCount ?? 0) < API_CONFIG.retryAttempts
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
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getPaginated<T>(url: string, config?: AxiosRequestConfig): Promise<PaginatedResponse<T>> {
    try {
      const response = await this.client.get<PaginatedResponse<T>>(url, config);
      // Return the paginated response directly without wrapping
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async postPaginated<T>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig
  ): Promise<PaginatedResponse<T>> {
    try {
      const response = await this.client.post<PaginatedResponse<T>>(url, data, config);
      // Return the paginated response directly without wrapping
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete<ApiResponse<T>>(url, config);
      return response.data;
    } catch (error) {
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
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getItem(aoid: number, options?: { gameVersion?: string }): Promise<ApiResponse<Item>> {
    return this.get<Item>(
      `/items/${aoid}`,
      options?.gameVersion ? { gameVersion: options.gameVersion } : undefined
    );
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
      const response = await this.client.post<ImplantLookupResponse>('/implants/lookup', request, {
        signal,
      });

      // Backend returns ImplantLookupResponse with item in 'item' field
      return response.data;
    } catch (error) {
      // Let a cancellation through as-is: callers abort superseded lookups
      // and must be able to tell that apart from a failure
      if (asRequestError(error).code === 'ERR_CANCELED') throw error;
      throw this.handleError(error);
    }
  }

  // ============================================================================
  // Perk API
  // ============================================================================

  async batchLookupPerks(aoids: number[]): Promise<BatchPerkLookupResponse> {
    try {
      const response = await this.client.post<BatchPerkLookupResponse>('/perks/batch/lookup', {
        aoids,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ============================================================================
  // Item Interpolation API
  // ============================================================================

  async interpolateItem(
    aoid: number,
    targetQl: number,
    options?: { gameVersion?: string }
  ): Promise<InterpolationResponse> {
    try {
      const params = new URLSearchParams();
      params.append('target_ql', targetQl.toString());

      const response = await this.client.get<InterpolationResponse>(
        `/items/${aoid}/interpolate?${params.toString()}`,
        options?.gameVersion ? { gameVersion: options.gameVersion } : undefined
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getInterpolationInfo(
    aoid: number,
    options?: { gameVersion?: string }
  ): Promise<ApiResponse<InterpolationInfo>> {
    return this.get<InterpolationInfo>(
      `/items/${aoid}/interpolation-info`,
      options?.gameVersion ? { gameVersion: options.gameVersion } : undefined
    );
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
    requests: Array<{ aoid: number; targetQl: number }>,
    options?: { gameVersion?: string }
  ): Promise<BatchInterpolationResponse> {
    try {
      const response = await this.client.post<BatchInterpolationResponse>(
        '/items/batch/interpolate',
        {
          items: requests.map((r) => ({ aoid: r.aoid, target_ql: r.targetQl })),
        },
        options?.gameVersion ? { gameVersion: options.gameVersion } : undefined
      );
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // ============================================================================
  // Symbiants API
  // ============================================================================

  async searchSymbiants(
    query?: SymbiantSearchQuery & { page?: number; limit?: number }
  ): Promise<PaginatedResponse<SymbiantItem>> {
    const params = new URLSearchParams();

    if (query?.page) params.append('page', query.page.toString());
    if (query?.limit) params.append('page_size', query.limit.toString());

    return this.getPaginated<SymbiantItem>(`/symbiants?${params.toString()}`);
  }

  async getSymbiant(aoid: number): Promise<ApiResponse<SymbiantItem>> {
    return this.get<SymbiantItem>(`/symbiants/${aoid}`);
  }

  async getSymbiantDroppedBy(aoid: number): Promise<ApiResponse<Mob[]>> {
    return this.get<Mob[]>(`/symbiants/${aoid}/dropped-by`);
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
  // Cross-version diffs
  // ============================================================================
  //
  // `gameVersion` is the newer side of a comparison (default: the version
  // being browsed); `base` the older. A request aborted through `signal`
  // rejects with the axios cancellation as is (see isRequestCancelled).

  /** Every build in which an item was added, changed or removed, newest first. */
  async getItemTimeline(aoid: number, options?: DiffRequestOptions): Promise<ItemTimelineResponse> {
    return this.getDiff<ItemTimelineResponse>(`/items/${aoid}/timeline`, undefined, options);
  }

  /** One item in `base` and in the request's build. Rejects (Not Found) when neither has it. */
  async compareItem(
    aoid: number,
    base: string,
    options?: DiffRequestOptions
  ): Promise<ItemCompareResponse> {
    return this.getDiff<ItemCompareResponse>(
      `/items/${aoid}/compare/${encodeURIComponent(dataSlug(base) ?? base)}`,
      undefined,
      options
    );
  }

  /** What changed in a build against the one before it. */
  async getBuildChanges(
    query: ChangeListQuery = {},
    options?: DiffRequestOptions
  ): Promise<ChangeListResponse> {
    return this.getDiff<ChangeListResponse>('/changes', changeListParams(query), options);
  }

  /** Net difference between build `base` and the request's build. */
  async compareBuilds(
    base: string,
    query: ChangeListQuery = {},
    options?: DiffRequestOptions
  ): Promise<ChangeListResponse> {
    return this.getDiff<ChangeListResponse>(
      `/compare/${encodeURIComponent(dataSlug(base) ?? base)}`,
      changeListParams(query),
      options
    );
  }

  /** The field transitions most changed items of a build share. */
  async getBuildTransitions(
    query: TransitionsQuery = {},
    options?: DiffRequestOptions
  ): Promise<BuildTransitionsResponse> {
    const params = new URLSearchParams();
    for (const part of query.part ?? []) params.append('part', part);
    for (const relevance of query.relevance ?? []) params.append('relevance', relevance);
    if (query.notes) params.append('notes', query.notes);
    if (query.min_items !== undefined) params.append('min_items', String(query.min_items));
    if (query.limit !== undefined) params.append('limit', String(query.limit));
    return this.getDiff<BuildTransitionsResponse>('/changes/transitions', params, options);
  }

  private async getDiff<T>(
    url: string,
    params: URLSearchParams | undefined,
    options: DiffRequestOptions | undefined
  ): Promise<T> {
    try {
      const response = await this.client.get<T>(url, {
        params,
        signal: options?.signal,
        ...(options?.gameVersion ? { gameVersion: options.gameVersion } : {}),
      });
      return response.data;
    } catch (error) {
      const { code, response } = asRequestError(error);
      if (code === 'ERR_CANCELED') throw error;
      // These routes answer {"error": "<sentence>", "code": "HTTP_404"}.
      const detail = response?.data?.error;
      if (response?.status === 404 && typeof detail === 'string') {
        const notFound: UserFriendlyError = {
          type: 'info',
          title: 'Not Found',
          message: detail,
          action: 'Pick another version',
          recoverable: true,
          status: 404,
        };
        throw notFound;
      }
      throw this.handleError(error);
    }
  }

  // ============================================================================
  // Item revision counts and legacy ids (cross-version endpoints)
  // ============================================================================

  async batchItemRevisions(aoids: number[]): Promise<ItemRevisionsBatchResponse> {
    if (aoids.length === 0) return { items: {} };
    try {
      // The route answers the batch itself, not an ApiResponse envelope.
      const response = await this.client.post<ItemRevisionsBatchResponse>(
        '/items/revisions/batch',
        { aoids: aoids.slice(0, 500) }
      );
      return { items: response.data?.items ?? {} };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * AOIDs of internal item ids that were persisted before user data moved to
   * AOIDs, as `gameVersion` knows them. Ids it does not have are left out.
   * Only the user data migration (legacy-id-migration.ts) has a use for this.
   */
  async resolveLegacyItemIds(
    internalIds: number[],
    gameVersion: string
  ): Promise<Map<number, number>> {
    const chunkSize = 1000;
    const resolved = new Map<number, number>();
    try {
      for (let start = 0; start < internalIds.length; start += chunkSize) {
        const response = await this.client.post<{ aoids: Record<string, number> }>(
          '/legacy-item-ids/resolve',
          { item_ids: internalIds.slice(start, start + chunkSize) },
          { gameVersion }
        );
        for (const [internalId, aoid] of Object.entries(response.data.aoids)) {
          resolved.set(Number(internalId), aoid);
        }
      }
    } catch (error) {
      throw this.handleError(error);
    }
    return resolved;
  }

  // ============================================================================
  // Error Handling
  // ============================================================================

  private handleError(error: unknown): UserFriendlyError {
    const { code, message, response } = asRequestError(error);

    const detail = response?.data?.error;
    if (detail && typeof detail === 'object') {
      return ApiErrorHandler.handle(detail);
    }

    // A plain 404 answers {"error": "<sentence>", "code": "HTTP_404"}; an
    // unknown version segment answers {"detail": "<sentence>"}.
    if (response?.status === 404) {
      const sentence = typeof detail === 'string' ? detail : response.data?.detail;
      return {
        type: 'info',
        title: 'Not Found',
        message: typeof sentence === 'string' && sentence ? sentence : 'Not found',
        action: 'Check the link or pick another version',
        recoverable: true,
        status: 404,
      };
    }

    if (detail) {
      return {
        type: 'error',
        title: 'Unexpected Error',
        message: 'Something went wrong. Please try again.',
        action: 'Contact support if the problem persists',
        recoverable: false,
      };
    }

    // axios reports ERR_NETWORK; NETWORK_ERROR is the older spelling
    if (code === 'ERR_NETWORK' || code === 'NETWORK_ERROR') {
      return {
        type: 'error',
        title: 'Network Error',
        message: 'Unable to connect to the server',
        action: 'Check your internet connection and try again',
        recoverable: true,
      };
    }

    if (code === 'ECONNABORTED') {
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
      message: message || 'An unexpected error occurred',
      action: 'Please try again or contact support',
      recoverable: false,
    };
  }
}

// ============================================================================
// Export
// ============================================================================

export const apiClient = new TinkerToolsApiClient();
export { ApiErrorHandler };
export default apiClient;

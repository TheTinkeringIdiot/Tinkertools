/**
 * API Client Tests
 *
 * Tests for the TinkerTools API client service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { apiClient } from '../../services/api-client';
import { API_ROOT } from '../../services/api-config';
import { setCurrentVersion } from '../../composables/useGameVersion';
import { TEST_VERSION, TEST_ALT_VERSION } from '../helpers/version-fixtures';
import type { Item, Spell, ApiResponse } from '../../types/api';

/**
 * The client is constructed at module import, so the axios mock has to exist
 * before the import runs: build it with vi.hoisted and return it straight from
 * the vi.mock factory rather than wiring it up in beforeEach.
 *
 * The interceptors registered during that construction are captured here,
 * because the global beforeEach clears mock call records before any test runs.
 */
const mockAxiosInstance = vi.hoisted(() => {
  // Callable: the retry path invokes the instance directly as `this.client(config)`.
  const instance: any = vi.fn();
  instance.get = vi.fn();
  instance.post = vi.fn();
  instance.put = vi.fn();
  instance.delete = vi.fn();
  instance.interceptors = {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  };
  return instance;
});

const registeredInterceptors = vi.hoisted(() => ({
  request: [] as Array<(config: any) => any>,
  response: [] as Array<(response: any) => any>,
  responseError: [] as Array<(error: any) => any>,
}));

vi.mock('axios', () => {
  mockAxiosInstance.interceptors.request.use.mockImplementation((onFulfilled: any) => {
    registeredInterceptors.request.push(onFulfilled);
    return 0;
  });
  mockAxiosInstance.interceptors.response.use.mockImplementation(
    (onFulfilled: any, onRejected: any) => {
      registeredInterceptors.response.push(onFulfilled);
      registeredInterceptors.responseError.push(onRejected);
      return 0;
    }
  );

  const axiosMock = {
    create: vi.fn(() => mockAxiosInstance),
    get: vi.fn(),
    post: vi.fn(),
    isAxiosError: vi.fn(() => false),
  };
  return { default: axiosMock, ...axiosMock };
});

const mockedAxios = vi.mocked(axios);

// Mock data
const mockItem: Item = {
  id: 1,
  aoid: 12345,
  name: 'Test Item',
  ql: 200,
  description: 'A test item',
  item_class: 3,
  is_nano: false,
  stats: [],
  spell_data: [],
  actions: [],
  attack_defense: null,
  animation_mesh: null,
};

const mockApiResponse: ApiResponse<Item> = {
  success: true,
  data: mockItem,
  meta: {
    timestamp: '2024-01-01T00:00:00Z',
    requestId: 'test-123',
    version: 'v1',
  },
};

/** Config captured when the client was constructed, before mocks were cleared. */
const createCallArgs = mockedAxios.create.mock.calls[0]?.[0];

describe('API Client', () => {
  beforeEach(() => {
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
  });

  afterEach(() => {
    setCurrentVersion(TEST_VERSION);
  });

  describe('Initialization', () => {
    it('should create axios instance with correct config', () => {
      expect(createCallArgs).toEqual({
        baseURL: expect.stringContaining('api/v1'),
        timeout: 120000,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Version': '1.0.0',
          'X-Client-Name': 'TinkerTools-Frontend',
        },
      });
    });

    it('should setup request and response interceptors', () => {
      expect(registeredInterceptors.request).toHaveLength(1);
      expect(registeredInterceptors.response).toHaveLength(1);
    });
  });

  describe('Game Version Scoping', () => {
    function runRequestInterceptor(config: Record<string, any> = {}) {
      return registeredInterceptors.request[0]({ headers: {}, ...config });
    }

    it('scopes the base URL to the active game version', () => {
      setCurrentVersion(TEST_VERSION);

      const config = runRequestInterceptor();

      expect(config.baseURL).toBe(`${API_ROOT}/${TEST_VERSION}`);
    });

    it('follows the version when it changes, without rebuilding the client', () => {
      setCurrentVersion(TEST_ALT_VERSION);

      const config = runRequestInterceptor();

      expect(config.baseURL).toBe(`${API_ROOT}/${TEST_ALT_VERSION}`);
    });

    it('lets a single request override the version', () => {
      setCurrentVersion(TEST_VERSION);

      const config = runRequestInterceptor({ gameVersion: TEST_ALT_VERSION });

      expect(config.baseURL).toBe(`${API_ROOT}/${TEST_ALT_VERSION}`);
    });
  });

  describe('Items API', () => {
    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockApiResponse });
    });

    it('should search items with query parameters', async () => {
      const query = {
        search: 'test',
        item_class: [3],
        min_ql: 100,
        page: 1,
        limit: 25,
      };

      await apiClient.searchItems(query);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/items'),
        undefined
      );
    });

    it('should get single item by ID', async () => {
      await apiClient.getItem(1);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/items/1', undefined);
    });

    it('should handle item compatibility check', async () => {
      const compatibilityRequest = {
        profile: {} as any,
        item_ids: [1, 2, 3],
        check_type: 'equip' as const,
      };

      mockAxiosInstance.post.mockResolvedValue({
        data: { success: true, data: [] },
      });

      await apiClient.checkItemCompatibility(compatibilityRequest);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/items/compatibility',
        compatibilityRequest,
        undefined
      );
    });

    it('should batch multiple item requests', async () => {
      const itemIds = [1, 2, 3];
      mockAxiosInstance.post.mockResolvedValue({
        data: { success: true, data: [mockItem] },
      });

      const result = await apiClient.getItems(itemIds);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([mockItem]);
    });
  });

  describe('Spells API', () => {
    const mockSpell: Spell = {
      id: 1,
      target: 2,
      tick_count: 1,
      tick_interval: 0,
      spell_id: 53002, // Use a known spell format ID for testing
      spell_format: 'Test spell format', // This will be ignored in favor of spell_id lookup
      spell_params: {},
      criteria: [],
    };

    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: [mockSpell] },
      });
    });

    it('should search spells with query parameters', async () => {
      const query = {
        search: 'damage',
        has_criteria: true,
        limit: 20,
      };

      await apiClient.searchSpells(query);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/spells'),
        undefined
      );
    });

    it('should get single spell by ID', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, data: mockSpell },
      });

      await apiClient.getSpell(1);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/spells/1', undefined);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network Error');
      networkError.code = 'NETWORK_ERROR';

      mockAxiosInstance.get.mockRejectedValue(networkError);

      try {
        await apiClient.getItem(1);
      } catch (error: any) {
        expect(error.type).toBe('error');
        expect(error.title).toBe('Network Error');
        expect(error.recoverable).toBe(true);
      }
    });

    it('should handle API error responses', async () => {
      const apiError = {
        response: {
          data: {
            error: {
              code: 'NOT_FOUND',
              message: 'Item not found',
            },
          },
        },
      };

      mockAxiosInstance.get.mockRejectedValue(apiError);

      try {
        await apiClient.getItem(999);
      } catch (error: any) {
        expect(error.type).toBe('info');
        expect(error.title).toBe('Not Found');
        expect(error.recoverable).toBe(true);
      }
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 30000ms exceeded');
      timeoutError.code = 'ECONNABORTED';

      mockAxiosInstance.get.mockRejectedValue(timeoutError);

      try {
        await apiClient.getItem(1);
      } catch (error: any) {
        expect(error.type).toBe('warning');
        expect(error.title).toBe('Request Timeout');
        expect(error.recoverable).toBe(true);
      }
    });
  });

  describe('Request Retry Logic', () => {
    // Retries happen inside the response error interceptor, so drive that
    // directly: a mocked axios instance never runs its own interceptors.
    const onError = () => registeredInterceptors.responseError[0];

    it('should retry a 5xx response with exponential backoff', async () => {
      vi.useFakeTimers();
      try {
        const config: any = { url: '/items/1', headers: {}, _retryCount: 0 };
        mockAxiosInstance.mockResolvedValueOnce({ data: mockApiResponse });

        const pending = onError()({ response: { status: 500 }, config });
        await vi.advanceTimersByTimeAsync(1000);
        const result = await pending;

        expect(config._retry).toBe(true);
        expect(config._retryCount).toBe(1);
        expect(mockAxiosInstance).toHaveBeenCalledWith(config);
        expect(result).toEqual({ data: mockApiResponse });
      } finally {
        vi.useRealTimers();
      }
    });

    it('should not retry 4xx errors', async () => {
      const error = { response: { status: 404 }, config: { _retryCount: 0 } };

      await expect(onError()(error)).rejects.toBe(error);
      expect(mockAxiosInstance).not.toHaveBeenCalled();
    });

    it('should not retry a request that has already been retried', async () => {
      const error = { response: { status: 500 }, config: { _retry: true, _retryCount: 1 } };

      await expect(onError()(error)).rejects.toBe(error);
      expect(mockAxiosInstance).not.toHaveBeenCalled();
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      const healthResponse = {
        success: true,
        data: {
          status: 'healthy',
          timestamp: '2024-01-01T00:00:00Z',
        },
      };

      mockAxiosInstance.get.mockResolvedValue({ data: healthResponse });

      const result = await apiClient.healthCheck();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health', undefined);
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('healthy');
    });
  });
});

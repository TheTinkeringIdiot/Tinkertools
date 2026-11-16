/**
 * API Client Tests
 *
 * Tests for the TinkerTools API client service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios, { type InternalAxiosRequestConfig } from 'axios';
import { apiClient } from '../../services/api-client';
import { API_ROOT } from '../../services/api-config';
import { setCurrentVersion, versions } from '../../composables/useGameVersion';
import { TEST_VERSION, TEST_ALT_VERSION, TEST_VERSIONS } from '../helpers/version-fixtures';
import type { Item, ApiResponse } from '../../types/api';
import type { ChangeListQuery } from '../../types/changes';

type RequestInterceptor = (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig;
type ResponseErrorInterceptor = (error: unknown) => Promise<unknown>;

/** Request config fields the retry interceptor reads and writes. */
interface RetryConfig {
  url?: string;
  headers?: Record<string, string>;
  _retry?: boolean;
  _retryCount: number;
}

/**
 * The client is constructed at module import, so the axios mock has to exist
 * before the import runs: build it with vi.hoisted and return it straight from
 * the vi.mock factory rather than wiring it up in beforeEach.
 *
 * The interceptors registered during that construction are captured here,
 * because the global beforeEach clears mock call records before any test runs.
 */
const mockAxiosInstance = vi.hoisted(() =>
  // Callable: the retry path invokes the instance directly as `this.client(config)`.
  Object.assign(vi.fn(), {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  })
);

const registeredInterceptors = vi.hoisted(() => ({
  request: [] as RequestInterceptor[],
  response: [] as Array<(response: unknown) => unknown>,
  responseError: [] as ResponseErrorInterceptor[],
}));

vi.mock('axios', () => {
  mockAxiosInstance.interceptors.request.use.mockImplementation(
    (onFulfilled: RequestInterceptor) => {
      registeredInterceptors.request.push(onFulfilled);
      return 0;
    }
  );
  mockAxiosInstance.interceptors.response.use.mockImplementation(
    (onFulfilled: (response: unknown) => unknown, onRejected: ResponseErrorInterceptor) => {
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

// The real classes, for building configs and errors the client must handle.
const { AxiosError, AxiosHeaders } = await vi.importActual<typeof import('axios')>('axios');

// Mock data
const mockItem: Item = {
  aoid: 12345,
  name: 'Test Item',
  ql: 200,
  description: 'A test item',
  item_class: 3,
  is_nano: false,
  stats: [],
  spell_data: [],
  actions: [],
  attack_stats: [],
  defense_stats: [],
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
  afterEach(async () => {
    await setCurrentVersion(TEST_VERSION);
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
    function runRequestInterceptor(config: Partial<InternalAxiosRequestConfig> = {}) {
      return registeredInterceptors.request[0]({ headers: new AxiosHeaders(), ...config });
    }

    it('scopes the base URL to the active game version', async () => {
      await setCurrentVersion(TEST_VERSION);

      const config = runRequestInterceptor();

      expect(config.baseURL).toBe(`${API_ROOT}/${TEST_VERSION}`);
    });

    it('follows the version when it changes, without rebuilding the client', async () => {
      await setCurrentVersion(TEST_ALT_VERSION);

      const config = runRequestInterceptor();

      expect(config.baseURL).toBe(`${API_ROOT}/${TEST_ALT_VERSION}`);
    });

    it('lets a single request override the version', async () => {
      await setCurrentVersion(TEST_VERSION);

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
  });

  describe('Legacy Item ID Resolution', () => {
    /** Answers each request as a backend that knows every id asked for, as id + 100000. */
    function resolveEveryId() {
      mockAxiosInstance.post.mockImplementation(
        async (_url: string, body: { item_ids: number[] }) => ({
          data: {
            aoids: Object.fromEntries(body.item_ids.map((id) => [String(id), id + 100000])),
            available: true,
          },
        })
      );
    }

    it('returns the AOIDs keyed by numeric internal id, without the ids the backend omits', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { aoids: { '7': 246817, '9': 100123 }, available: true },
      });

      const resolved = await apiClient.resolveLegacyItemIds([7, 8, 9], TEST_VERSION);

      expect(resolved).toEqual(
        new Map([
          [7, 246817],
          [9, 100123],
        ])
      );
      expect(resolved.has(8)).toBe(false);
    });

    it('asks in requests of at most 1000 ids and merges the answers', async () => {
      resolveEveryId();
      const ids = Array.from({ length: 2500 }, (_, index) => index + 1);

      const resolved = await apiClient.resolveLegacyItemIds(ids, TEST_VERSION);

      const requested: Array<{ url: string; ids: number[] }> =
        mockAxiosInstance.post.mock.calls.map((call) => ({ url: call[0], ids: call[1].item_ids }));
      expect(requested.map((request) => request.url)).toEqual([
        '/legacy-item-ids/resolve',
        '/legacy-item-ids/resolve',
        '/legacy-item-ids/resolve',
      ]);
      expect(requested.map((request) => request.ids.length)).toEqual([1000, 1000, 500]);
      expect(requested.flatMap((request) => request.ids)).toEqual(ids);

      expect(resolved.size).toBe(2500);
      expect(resolved.get(1)).toBe(100001);
      expect(resolved.get(1001)).toBe(101001);
      expect(resolved.get(2500)).toBe(102500);
    });

    it('asks the game version it was given, not the one being browsed', async () => {
      await setCurrentVersion(TEST_VERSION);
      resolveEveryId();

      await apiClient.resolveLegacyItemIds([1], TEST_ALT_VERSION);

      const requestConfig: Partial<InternalAxiosRequestConfig> =
        mockAxiosInstance.post.mock.calls[0][2];
      expect(requestConfig).toEqual({ gameVersion: TEST_ALT_VERSION });
      const sent = registeredInterceptors.request[0]({
        headers: new AxiosHeaders(),
        ...requestConfig,
      });
      expect(sent.baseURL).toBe(`${API_ROOT}/${TEST_ALT_VERSION}`);
    });

    it('rejects when the backend holds no ids for the version, instead of resolving nothing', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { aoids: {}, available: false } });

      await expect(apiClient.resolveLegacyItemIds([7, 8], TEST_VERSION)).rejects.toMatchObject({
        type: 'error',
      });
    });

    it('resolves nothing when the backend holds the ids and knows none of those asked for', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { aoids: {}, available: true } });

      const resolved = await apiClient.resolveLegacyItemIds([7, 8], TEST_VERSION);

      expect(resolved.size).toBe(0);
    });

    it('makes no request for an empty list', async () => {
      const resolved = await apiClient.resolveLegacyItemIds([], TEST_VERSION);

      expect(resolved.size).toBe(0);
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });

    it('rejects when a request fails, even after earlier ones succeeded', async () => {
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { aoids: { '1': 100001 }, available: true } })
        .mockRejectedValueOnce(new AxiosError('Network Error', AxiosError.ERR_NETWORK));
      const ids = Array.from({ length: 1500 }, (_, index) => index + 1);

      await expect(apiClient.resolveLegacyItemIds(ids, TEST_VERSION)).rejects.toMatchObject({
        type: 'error',
        title: 'Network Error',
      });
    });
  });

  describe('Item Revision Counts', () => {
    it('returns the counts the batch route answers, keyed by AOID', async () => {
      // The body exactly as POST /items/revisions/batch sends it: no envelope.
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          items: {
            '271072': {
              aoid: 271072,
              revision_count: 3,
              latest_change_slug: 'ao-18-8-62-ep1',
              present_in_current: true,
            },
            '1': {
              aoid: 1,
              revision_count: 0,
              latest_change_slug: null,
              present_in_current: false,
            },
          },
        },
      });

      const answered = await apiClient.batchItemRevisions([271072, 1]);

      expect(mockAxiosInstance.post.mock.calls[0][0]).toBe('/items/revisions/batch');
      expect(mockAxiosInstance.post.mock.calls[0][1]).toEqual({ aoids: [271072, 1] });
      expect(answered.items[271072].revision_count).toBe(3);
      expect(answered.items[1].revision_count).toBe(0);
    });

    it('makes no request for an empty list', async () => {
      expect(await apiClient.batchItemRevisions([])).toEqual({ items: {} });
      expect(mockAxiosInstance.post).not.toHaveBeenCalled();
    });
  });

  describe('Cross-version diff routes', () => {
    /** What the transport was asked for: path, query string and the version it is scoped to. */
    function sentRequest(index = 0): { url: string; query: string; base: string; signal: unknown } {
      const [url, config] = mockAxiosInstance.get.mock.calls[index] as [
        string,
        Partial<InternalAxiosRequestConfig> & { params?: URLSearchParams },
      ];
      const scoped = registeredInterceptors.request[0]({
        headers: new AxiosHeaders(),
        ...config,
      });
      return {
        url,
        query: config.params ? config.params.toString() : '',
        base: scoped.baseURL ?? '',
        signal: config.signal,
      };
    }

    const EVERY_FILTER: ChangeListQuery = {
      page: 3,
      page_size: 100,
      sort: 'ql',
      kind: ['added', 'changed'],
      part: ['stats', 'effects'],
      relevance: ['gameplay', 'economy'],
      is_nano: false,
      item_class: 2,
      min_ql: 50,
      max_ql: 200,
      profession: 11,
      slot: 4,
      search: 'graft',
      notes: 'expand',
      note_id: 4,
      include_diff: true,
      transition: 'effect:53089:spell_params.Chance',
      transition_old: '60',
      transition_new: '100',
    };

    const EVERY_FILTER_QUERY =
      'page=3&page_size=100&sort=ql&kind=added&kind=changed&part=stats&part=effects' +
      '&relevance=gameplay&relevance=economy&is_nano=false&item_class=2&min_ql=50&max_ql=200' +
      '&profession=11&slot=4&search=graft&notes=expand&note_id=4&include_diff=true' +
      '&transition=effect%3A53089%3Aspell_params.Chance&transition_old=60&transition_new=100';

    beforeEach(async () => {
      // 'ao' is a family alias that follows a build, as the backend registry lists it.
      versions.value = [
        ...TEST_VERSIONS,
        { ...TEST_VERSIONS[0], slug: 'ao', is_default: false, alias_of: TEST_VERSION },
        { ...TEST_VERSIONS[0], slug: 'ao-14-5-1', is_default: false, sort_order: 5 },
      ];
      await setCurrentVersion(TEST_VERSION);
      mockAxiosInstance.get.mockResolvedValue({ data: { answered: true } });
    });

    afterEach(() => {
      versions.value = TEST_VERSIONS;
    });

    it('asks for the change list of a build with every filter as a query parameter', async () => {
      const answered = await apiClient.getBuildChanges(EVERY_FILTER, {
        gameVersion: 'ao-14-5-1',
      });

      expect(answered).toEqual({ answered: true });
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1);
      expect(sentRequest()).toMatchObject({
        url: '/changes',
        query: EVERY_FILTER_QUERY,
        base: `${API_ROOT}/ao-14-5-1`,
      });
    });

    it('sends nothing it was not asked to filter by', async () => {
      await apiClient.getBuildChanges({ page: 1, page_size: 50, sort: 'name' });

      expect(sentRequest()).toMatchObject({
        url: '/changes',
        query: 'page=1&page_size=50&sort=name',
        base: `${API_ROOT}/${TEST_VERSION}`,
      });
    });

    it('sends the values of a transition only with the transition they belong to', async () => {
      await apiClient.getBuildChanges({ transition_old: '60', transition_new: '100' });
      await apiClient.getBuildChanges({ transition: 'stat:287', transition_new: 'null' });
      await apiClient.getBuildChanges({ include_diff: false, notes: 'collapse' });

      expect(sentRequest(0).query).toBe('');
      expect(sentRequest(1).query).toBe('transition=stat%3A287&transition_new=null');
      expect(sentRequest(2).query).toBe('notes=collapse');
    });

    it('asks the newer build for its comparison with the base, under /compare', async () => {
      await apiClient.compareBuilds('ao-14-5-1', EVERY_FILTER, { gameVersion: TEST_ALT_VERSION });

      expect(sentRequest()).toMatchObject({
        url: '/compare/ao-14-5-1',
        query: EVERY_FILTER_QUERY,
        base: `${API_ROOT}/${TEST_ALT_VERSION}`,
      });
    });

    it('names the base of a build comparison by its build, not by a family alias', async () => {
      await apiClient.compareBuilds('ao', {}, { gameVersion: TEST_ALT_VERSION });

      expect(sentRequest().url).toBe(`/compare/${TEST_VERSION}`);
    });

    it('asks for the patch notes with the parts, relevance and notes setting of the page', async () => {
      await apiClient.getBuildTransitions(
        {
          part: ['text', 'stats'],
          relevance: ['gameplay', 'text'],
          notes: 'collapse',
          min_items: 2,
          limit: 40,
        },
        { gameVersion: 'ao-14-5-1' }
      );

      expect(sentRequest()).toMatchObject({
        url: '/changes/transitions',
        query:
          'part=text&part=stats&relevance=gameplay&relevance=text&notes=collapse&min_items=2&limit=40',
        base: `${API_ROOT}/ao-14-5-1`,
      });
    });

    it('asks for the patch notes of the browsed build with no parameters by default', async () => {
      await apiClient.getBuildTransitions();

      expect(sentRequest()).toMatchObject({
        url: '/changes/transitions',
        query: '',
        base: `${API_ROOT}/${TEST_VERSION}`,
      });
    });

    it("asks for an item's timeline in the version given", async () => {
      await apiClient.getItemTimeline(271072, { gameVersion: TEST_ALT_VERSION });

      expect(sentRequest()).toMatchObject({
        url: '/items/271072/timeline',
        query: '',
        base: `${API_ROOT}/${TEST_ALT_VERSION}`,
      });
    });

    it('compares one item from the newer build, naming the older one in the path', async () => {
      await apiClient.compareItem(271072, 'ao-14-5-1', { gameVersion: TEST_ALT_VERSION });

      expect(sentRequest()).toMatchObject({
        url: '/items/271072/compare/ao-14-5-1',
        query: '',
        base: `${API_ROOT}/${TEST_ALT_VERSION}`,
      });
    });

    it('resolves a family alias given as the base of an item comparison to its build', async () => {
      await apiClient.compareItem(271072, 'ao', { gameVersion: TEST_ALT_VERSION });

      expect(sentRequest().url).toBe(`/items/271072/compare/${TEST_VERSION}`);
    });

    it('compares against the browsed version when none is given', async () => {
      await setCurrentVersion(TEST_ALT_VERSION);

      await apiClient.compareItem(271072, 'ao-14-5-1');

      expect(sentRequest().base).toBe(`${API_ROOT}/${TEST_ALT_VERSION}`);
    });

    it('hands the abort signal to the transport and lets a cancellation through as is', async () => {
      const controller = new AbortController();
      const cancelled = new AxiosError('canceled', AxiosError.ERR_CANCELED);
      mockAxiosInstance.get.mockRejectedValue(cancelled);

      await expect(apiClient.getBuildChanges({}, { signal: controller.signal })).rejects.toBe(
        cancelled
      );
      expect(sentRequest().signal).toBe(controller.signal);
    });

    it('reports the sentence a diff route answers a 404 with', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 404, data: { error: 'Unknown build nonsense', code: 'HTTP_404' } },
      });

      await expect(apiClient.compareBuilds('nonsense')).rejects.toMatchObject({
        type: 'info',
        title: 'Not Found',
        message: 'Unknown build nonsense',
        // Item pages tell "not in this version" from a failure by this
        status: 404,
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(
        new AxiosError('Network Error', AxiosError.ERR_NETWORK)
      );

      await expect(apiClient.getItem(1)).rejects.toMatchObject({
        type: 'error',
        title: 'Network Error',
        recoverable: true,
      });
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

      await expect(apiClient.getItem(999)).rejects.toMatchObject({
        type: 'info',
        title: 'Not Found',
        recoverable: true,
      });
    });

    it('reports the sentence a route answers a plain 404 with', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 404, data: { error: 'Item 999 not found', code: 'HTTP_404' } },
      });

      await expect(apiClient.getItem(999)).rejects.toEqual({
        type: 'info',
        title: 'Not Found',
        message: 'Item 999 not found',
        action: 'Check the link or pick another version',
        recoverable: true,
        status: 404,
      });
    });

    it('reports the sentence an unknown game version is answered with', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 404, data: { detail: "Unknown game version 'ao-99-9-9'" } },
      });

      await expect(apiClient.getItem(1)).rejects.toMatchObject({
        type: 'info',
        title: 'Not Found',
        message: "Unknown game version 'ao-99-9-9'",
        recoverable: true,
        status: 404,
      });
    });

    it('reports a 404 that says nothing as not found, not as a failure', async () => {
      mockAxiosInstance.get.mockRejectedValue({ response: { status: 404, data: {} } });

      await expect(apiClient.getItem(1)).rejects.toMatchObject({
        type: 'info',
        title: 'Not Found',
        message: 'Not found',
        status: 404,
      });
    });

    it('reports a 404 whose detail is not a sentence as not found', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 404, data: { detail: [{ loc: ['path', 'aoid'], msg: 'no' }] } },
      });

      await expect(apiClient.getItem(1)).rejects.toMatchObject({
        type: 'info',
        title: 'Not Found',
        message: 'Not found',
        status: 404,
      });
    });

    it('does not take another failure that carries a sentence for a 404', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 400, data: { error: 'Bad request', code: 'HTTP_400' } },
      });

      await expect(apiClient.getItem(1)).rejects.toMatchObject({
        type: 'error',
        title: 'Unexpected Error',
        recoverable: false,
      });
    });

    it('should handle timeout errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(
        new AxiosError('timeout of 30000ms exceeded', AxiosError.ECONNABORTED)
      );

      await expect(apiClient.getItem(1)).rejects.toMatchObject({
        type: 'warning',
        title: 'Request Timeout',
        recoverable: true,
      });
    });
  });

  describe('Request Retry Logic', () => {
    // Retries happen inside the response error interceptor, so drive that
    // directly: a mocked axios instance never runs its own interceptors.
    const onError = () => registeredInterceptors.responseError[0];

    it('should retry a 5xx response with exponential backoff', async () => {
      vi.useFakeTimers();
      try {
        const config: RetryConfig = { url: '/items/1', headers: {}, _retryCount: 0 };
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
});

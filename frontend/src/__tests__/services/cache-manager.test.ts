/**
 * Cache Manager Tests
 *
 * Tests for the cache management functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheManager } from '../../services/cache-manager';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

// Mock global localStorage
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.length = 0;
    cacheManager = new CacheManager();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Basic Cache Operations', () => {
    it('should set and get cache entries', async () => {
      const testData = { name: 'test', value: 123 };

      await cacheManager.set('test-key', testData);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tinkertools_cache_test-key',
        expect.stringContaining('"name":"test"')
      );
    });

    it('should retrieve cached data', async () => {
      const testData = { name: 'test', value: 123 };
      const cacheEntry = {
        data: testData,
        timestamp: Date.now(),
        expiry: Date.now() + 60000, // 1 minute from now
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cacheEntry));

      const result = await cacheManager.get('test-key');

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('tinkertools_cache_test-key');
      expect(result).toEqual(testData);
    });

    it('should return null for non-existent keys', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = await cacheManager.get('non-existent');

      expect(result).toBe(null);
    });

    it('should return null for expired entries', async () => {
      const testData = { name: 'test' };
      const expiredEntry = {
        data: testData,
        timestamp: Date.now() - 120000,
        expiry: Date.now() - 60000, // Expired 1 minute ago
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(expiredEntry));

      const result = await cacheManager.get('expired-key');

      expect(result).toBe(null);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tinkertools_cache_expired-key');
    });

    it('should remove cache entries', async () => {
      await cacheManager.remove('test-key');

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tinkertools_cache_test-key');
    });

    it('should check if key exists', async () => {
      const testData = { name: 'test' };
      const validEntry = {
        data: testData,
        timestamp: Date.now(),
        expiry: Date.now() + 60000,
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(validEntry));

      const exists = await cacheManager.has('test-key');

      expect(exists).toBe(true);
    });

    it('should return false for has() with expired entries', async () => {
      const expiredEntry = {
        data: { name: 'test' },
        timestamp: Date.now() - 120000,
        expiry: Date.now() - 60000,
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(expiredEntry));

      const exists = await cacheManager.has('expired-key');

      expect(exists).toBe(false);
    });
  });

  describe('TTL Configuration', () => {
    it('should use default TTL for dynamic data keys', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(100000);

      await cacheManager.set('search-results-123', { items: [] });

      const expectedExpiry = 100000 + 5 * 60 * 1000; // 5 minutes default for dynamic data

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tinkertools_cache_search-results-123',
        expect.stringContaining(`"expiry":${expectedExpiry}`)
      );
    });

    it('should use custom TTL when provided', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(100000);

      const customTTL = 10000; // 10 seconds
      await cacheManager.set('custom-key', { data: 'test' }, customTTL);

      const expectedExpiry = 100000 + customTTL;

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tinkertools_cache_custom-key',
        expect.stringContaining(`"expiry":${expectedExpiry}`)
      );
    });

    it('should use long TTL for static data keys', async () => {
      vi.spyOn(Date, 'now').mockReturnValue(100000);

      await cacheManager.set('items-common', { items: [] });

      const expectedExpiry = 100000 + 24 * 60 * 60 * 1000; // 24 hours for static data

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tinkertools_cache_items-common',
        expect.stringContaining(`"expiry":${expectedExpiry}`)
      );
    });
  });

  describe('API Response Caching', () => {
    it('should cache API responses with generated keys', async () => {
      const endpoint = '/api/v1/items';
      const params = { search: 'test', limit: 25 };
      const responseData = { items: [{ id: 1, name: 'Test' }] };

      await cacheManager.cacheApiResponse(endpoint, params, responseData);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        expect.stringMatching(/tinkertools_cache_api_/),
        expect.stringContaining(JSON.stringify(responseData))
      );
    });

    it('should retrieve cached API responses', async () => {
      const endpoint = '/api/v1/items';
      const params = { search: 'test', limit: 25 };
      const responseData = { items: [{ id: 1, name: 'Test' }] };

      // First, cache the response
      await cacheManager.cacheApiResponse(endpoint, params, responseData);

      // Mock the retrieval
      const cacheEntry = {
        data: responseData,
        timestamp: Date.now(),
        expiry: Date.now() + 60000,
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cacheEntry));

      const result = await cacheManager.getCachedApiResponse(endpoint, params);

      expect(result).toEqual(responseData);
    });
  });

  describe('Search Results Caching', () => {
    it('should cache search results with query info', async () => {
      const query = { search: 'weapon', item_class: [1] };
      const results = [{ id: 1, name: 'Sword' }];
      const pagination = { page: 1, total: 50 };

      await cacheManager.cacheSearchResults(query, results, pagination);

      const expectedCacheData = {
        results,
        pagination,
        query,
        timestamp: expect.any(Number),
      };

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        expect.stringMatching(/tinkertools_cache_search_/),
        expect.stringContaining('"results":[{"id":1,"name":"Sword"}]')
      );
    });

    it('should retrieve cached search results', async () => {
      const query = { search: 'weapon', item_class: [1] };
      const cachedData = {
        results: [{ id: 1, name: 'Sword' }],
        pagination: { page: 1, total: 50 },
        query,
        timestamp: Date.now(),
      };

      const cacheEntry = {
        data: cachedData,
        timestamp: Date.now(),
        expiry: Date.now() + 60000,
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cacheEntry));

      const result = await cacheManager.getCachedSearchResults(query);

      expect(result).toEqual(cachedData);
    });
  });

  describe('Calculation Caching', () => {
    it('should cache calculation results', async () => {
      const calculationId = 'damage-calculation';
      const params = { weapon: 1, stats: { strength: 500 } };
      const result = { dps: 123.45, accuracy: 85 };

      await cacheManager.cacheCalculation(calculationId, params, result);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        expect.stringMatching(/tinkertools_cache_calc_damage-calculation_/),
        expect.stringContaining(JSON.stringify(result))
      );
    });

    it('should retrieve cached calculation results', async () => {
      const calculationId = 'damage-calculation';
      const params = { weapon: 1, stats: { strength: 500 } };
      const result = { dps: 123.45, accuracy: 85 };

      const cacheEntry = {
        data: result,
        timestamp: Date.now(),
        expiry: Date.now() + 60000,
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(cacheEntry));

      const retrieved = await cacheManager.getCachedCalculation(calculationId, params);

      expect(retrieved).toEqual(result);
    });
  });

  describe('Bulk Operations', () => {
    it('should set multiple entries at once', async () => {
      const entries = [
        { key: 'key1', data: { value: 1 } },
        { key: 'key2', data: { value: 2 }, ttl: 5000 },
        { key: 'key3', data: { value: 3 } },
      ];

      await cacheManager.setMany(entries);

      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(3);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tinkertools_cache_key1',
        expect.stringContaining('"value":1')
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'tinkertools_cache_key2',
        expect.stringContaining('"value":2')
      );
    });

    it('should get multiple entries at once', async () => {
      const keys = ['key1', 'key2', 'key3'];

      mockLocalStorage.getItem
        .mockReturnValueOnce(
          JSON.stringify({
            data: { value: 1 },
            timestamp: Date.now(),
            expiry: Date.now() + 60000,
          })
        )
        .mockReturnValueOnce(null) // key2 doesn't exist
        .mockReturnValueOnce(
          JSON.stringify({
            data: { value: 3 },
            timestamp: Date.now(),
            expiry: Date.now() + 60000,
          })
        );

      const results = await cacheManager.getMany(keys);

      expect(results).toEqual([
        { key: 'key1', data: { value: 1 } },
        { key: 'key2', data: null },
        { key: 'key3', data: { value: 3 } },
      ]);
    });

    it('should remove multiple entries at once', async () => {
      const keys = ['key1', 'key2', 'key3'];

      await cacheManager.removeMany(keys);

      expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(3);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tinkertools_cache_key1');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tinkertools_cache_key2');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tinkertools_cache_key3');
    });
  });

  describe('Cache Management', () => {
    it('should clear all cache data', async () => {
      mockLocalStorage.length = 5;
      mockLocalStorage.key
        .mockReturnValueOnce('tinkertools_cache_key1')
        .mockReturnValueOnce('other_data_key')
        .mockReturnValueOnce('tinkertools_cache_key2')
        .mockReturnValueOnce('tinkertools_settings')
        .mockReturnValueOnce('tinkertools_cache_key3');

      await cacheManager.clear();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(3);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tinkertools_cache_key1');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tinkertools_cache_key2');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tinkertools_cache_key3');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('other_data_key');
    });

    it('should cleanup expired entries', async () => {
      const now = Date.now();

      mockLocalStorage.length = 3;
      mockLocalStorage.key
        .mockReturnValueOnce('tinkertools_cache_valid')
        .mockReturnValueOnce('tinkertools_cache_expired')
        .mockReturnValueOnce('tinkertools_cache_invalid');

      mockLocalStorage.getItem
        .mockReturnValueOnce(
          JSON.stringify({
            data: { valid: true },
            timestamp: now,
            expiry: now + 60000, // Valid
          })
        )
        .mockReturnValueOnce(
          JSON.stringify({
            data: { expired: true },
            timestamp: now - 120000,
            expiry: now - 60000, // Expired
          })
        )
        .mockReturnValueOnce('invalid json'); // Invalid entry

      await cacheManager.cleanup();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledTimes(2);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tinkertools_cache_expired');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tinkertools_cache_invalid');
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalledWith('tinkertools_cache_valid');
    });

    it('should generate cache statistics', async () => {
      const now = Date.now();

      mockLocalStorage.length = 3;
      mockLocalStorage.key
        .mockReturnValueOnce('tinkertools_cache_key1')
        .mockReturnValueOnce('other_key')
        .mockReturnValueOnce('tinkertools_cache_key2');

      const entry1 = JSON.stringify({
        data: { size: 'small' },
        timestamp: now,
        expiry: now + 60000,
      });

      const entry2 = JSON.stringify({
        data: { size: 'large' },
        timestamp: now - 120000,
        expiry: now - 60000, // Expired
      });

      mockLocalStorage.getItem.mockReturnValueOnce(entry1).mockReturnValueOnce(entry2);

      // Mock Blob constructor
      global.Blob = vi.fn().mockImplementation((content) => ({
        size: JSON.stringify(content[0]).length,
      })) as any;

      const stats = await cacheManager.getStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.expiredEntries).toBe(1);
      expect(stats.entries).toHaveLength(2);
      expect(stats.entries[0].expired).toBe(false);
      expect(stats.entries[1].expired).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle localStorage errors gracefully', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      // Should not throw
      await expect(cacheManager.set('key', { data: 'test' })).resolves.toBeUndefined();
    });

    it('should handle invalid JSON gracefully', async () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      const result = await cacheManager.get('invalid-key');

      expect(result).toBe(null);
    });

    it('should handle missing localStorage gracefully', () => {
      // Create cache manager without localStorage
      const memoryCache = new CacheManager(
        {
          staticData: { ttl: 60000, keys: [] },
          dynamicData: { ttl: 30000, keys: [] },
          userData: { ttl: Infinity, keys: [] },
        },
        false
      );

      expect(memoryCache).toBeInstanceOf(CacheManager);
    });
  });
});

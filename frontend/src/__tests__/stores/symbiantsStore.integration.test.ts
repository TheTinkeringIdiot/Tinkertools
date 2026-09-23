/**
 * SymbiantsStore Integration Tests
 *
 * TRUE INTEGRATION TEST - Requires real backend
 * Tests real API integration with symbiants store
 *
 * Strategy: Skip when backend not available (Option B)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

// jsdom has no IndexedDB: back idb-keyval with an in-memory map so the store's
// persistent cache behaves as it does in a browser.
vi.mock('idb-keyval', () => {
  const entries = new Map<IDBValidKey, unknown>();
  return {
    get: vi.fn((key: IDBValidKey) => Promise.resolve(entries.get(key))),
    set: vi.fn((key: IDBValidKey, value: unknown) => {
      entries.set(key, value);
      return Promise.resolve();
    }),
    del: vi.fn((key: IDBValidKey) => {
      entries.delete(key);
      return Promise.resolve();
    }),
    keys: vi.fn(() => Promise.resolve(Array.from(entries.keys()))),
  };
});

import { useSymbiantsStore } from '@/stores/symbiants';
import { apiClient } from '@/services/api-client';

// Symbiant slot ids are implant-slot bit flags, eye (2) through feet (8192).
const IMPLANT_SLOT_FLAGS = Array.from({ length: 13 }, (_, i) => 2 ** (i + 1));
import { isBackendAvailable } from '../helpers/backend-check';

// Top-level await: skipIf is evaluated while tests are collected.
const BACKEND_AVAILABLE = await isBackendAvailable();

describe.skipIf(!BACKEND_AVAILABLE)('SymbiantsStore Integration Tests', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    // Every test starts from an empty IndexedDB cache
    await useSymbiantsStore().clearCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches real symbiants from the API', async () => {
    const store = useSymbiantsStore();

    // Load all symbiants (which now uses chunked loading)
    const symbiants = await store.loadAllSymbiants();

    expect(symbiants.length).toBeGreaterThan(0);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();

    // Check data structure with enriched data
    const firstSymbiant = symbiants[0];
    expect(firstSymbiant).toHaveProperty('id');
    expect(firstSymbiant).toHaveProperty('aoid');
    expect(firstSymbiant).toHaveProperty('name'); // Should be enriched
    expect(firstSymbiant).toHaveProperty('slot_id'); // Should be enriched
    expect(firstSymbiant).toHaveProperty('ql'); // Should be enriched
    expect(firstSymbiant).toHaveProperty('family'); // Should be enriched

    expect(typeof firstSymbiant.id).toBe('number');
    expect(typeof firstSymbiant.aoid).toBe('number');
    expect(typeof firstSymbiant.name).toBe('string');
    expect(typeof firstSymbiant.slot_id).toBe('number');
    expect(typeof firstSymbiant.ql).toBe('number');
    expect(typeof firstSymbiant.family).toBe('string');
  }, 30000); // Increased timeout for chunked loading

  it('enriches symbiant data correctly', async () => {
    const store = useSymbiantsStore();

    await store.loadAllSymbiants();
    const symbiants = store.allSymbiants.slice(0, 5);

    symbiants.forEach((symbiant) => {
      // All symbiants should have enriched display names
      expect(symbiant.name).toBeTruthy();
      expect(symbiant.name.length).toBeGreaterThan(0);

      // Should occupy exactly one implant slot
      expect(IMPLANT_SLOT_FLAGS).toContain(symbiant.slot_id);

      // Should have reasonable QL values
      expect(symbiant.ql).toBeGreaterThanOrEqual(1);
      expect(symbiant.ql).toBeLessThanOrEqual(300);

      // Should have valid families
      const validFamilies = ['Artillery', 'Control', 'Extermination', 'Infantry', 'Support'];
      expect(validFamilies).toContain(symbiant.family);
    });
  }, 30000);

  it('caches symbiants correctly', async () => {
    const store = useSymbiantsStore();

    // First load
    await store.loadAllSymbiants();
    const firstResults = store.allSymbiants.slice(0, 3);
    expect(firstResults.length).toBeGreaterThan(0);

    // Get individual symbiant (should use cache)
    const firstSymbiant = firstResults[0];
    const cachedSymbiant = await store.getSymbiant(firstSymbiant.id);

    expect(cachedSymbiant).toEqual(firstSymbiant);
  }, 30000);

  it('loads all symbiants in chunks with progress', async () => {
    const store = useSymbiantsStore();
    const searchSpy = vi.spyOn(apiClient, 'searchSymbiants');

    await store.loadAllSymbiants();

    // More symbiants exist than fit in one 100-item page
    expect(store.symbiantsCount).toBeGreaterThan(100);
    expect(searchSpy.mock.calls.length).toBeGreaterThan(1);
    expect(store.loadedCount).toBe(store.totalCount);
    expect(store.loadingProgress).toBe(100);
  }, 60000); // Extended timeout for full load

  it('maintains consistent enrichment for same symbiant', async () => {
    const store = useSymbiantsStore();

    await store.loadAllSymbiants();
    const symbiants = store.allSymbiants.slice(0, 3);
    if (symbiants.length === 0) return;

    const firstSymbiant = symbiants[0];

    // Get the same symbiant again
    const sameSymbiant = await store.getSymbiant(firstSymbiant.id);

    // Should have identical enriched properties
    expect(sameSymbiant?.name).toBe(firstSymbiant.name);
    expect(sameSymbiant?.slot_id).toBe(firstSymbiant.slot_id);
    expect(sameSymbiant?.ql).toBe(firstSymbiant.ql);
    expect(sameSymbiant?.family).toBe(firstSymbiant.family);
  }, 30000);

  it('uses IndexedDB cache on subsequent loads', async () => {
    const firstStore = useSymbiantsStore();

    // First load from API
    await firstStore.loadAllSymbiants();
    const firstCount = firstStore.symbiantsCount;
    expect(firstCount).toBeGreaterThan(0);

    // A new session: empty in-memory store, same IndexedDB
    setActivePinia(createPinia());
    const store = useSymbiantsStore();
    const searchSpy = vi.spyOn(apiClient, 'searchSymbiants');

    await store.loadAllSymbiants();

    expect(store.symbiantsCount).toBe(firstCount);
    expect(searchSpy).not.toHaveBeenCalled();
  }, 60000);
});

/**
 * SymbiantsStore Integration Tests
 *
 * TRUE INTEGRATION TEST - Requires real backend
 * Tests real API integration with symbiants store
 *
 * Strategy: Skip when backend not available (Option B)
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSymbiantsStore } from '@/stores/symbiants';
import { isBackendAvailable } from '../helpers/backend-check';

// Check backend availability before running tests
let BACKEND_AVAILABLE = false;

beforeAll(async () => {
  BACKEND_AVAILABLE = await isBackendAvailable();
  if (!BACKEND_AVAILABLE) {
    console.warn('Backend not available - skipping symbiants integration tests');
  }
});

describe.skipIf(!BACKEND_AVAILABLE)('SymbiantsStore Integration Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
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

      // Should have valid slot_id
      expect(symbiant.slot_id).toBeGreaterThanOrEqual(0);
      expect(symbiant.slot_id).toBeLessThan(10);

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

    // Capture console logs to verify progress
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    try {
      await store.loadAllSymbiants();

      // Should have loaded all symbiants
      expect(store.symbiantsCount).toBeGreaterThan(0);

      // Should have progress logs
      const progressLogs = logs.filter(log => log.includes('Loaded') && log.includes('symbiants'));
      expect(progressLogs.length).toBeGreaterThan(0);

      // Verify chunked loading happened
      const startLog = logs.find(log => log.includes('Starting chunked symbiant load'));
      expect(startLog).toBeTruthy();
    } finally {
      console.log = originalLog;
    }
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
    const store = useSymbiantsStore();

    // First load from API
    await store.loadAllSymbiants();
    const firstCount = store.symbiantsCount;
    expect(firstCount).toBeGreaterThan(0);

    // Clear memory cache
    await store.clearCache();

    // Second load should use IndexedDB cache
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    try {
      await store.loadAllSymbiants();

      // Should have same count
      expect(store.symbiantsCount).toBe(firstCount);

      // Should have cache hit log
      const cacheLog = logs.find(log => log.includes('Loading from IndexedDB cache'));
      expect(cacheLog).toBeTruthy();
    } finally {
      console.log = originalLog;
    }
  }, 60000);
});

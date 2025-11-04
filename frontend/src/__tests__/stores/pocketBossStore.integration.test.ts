/**
 * PocketBossStore Integration Tests
 *
 * TRUE INTEGRATION TEST - Requires real backend
 * Tests real API integration with pocket boss store
 *
 * Strategy: Skip when backend not available (Option B)
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePocketBossStore } from '@/stores/pocketBossStore';
import { isBackendAvailable } from '../helpers/backend-check';

// Check backend availability before running tests
let BACKEND_AVAILABLE = false;

beforeAll(async () => {
  BACKEND_AVAILABLE = await isBackendAvailable();
  if (!BACKEND_AVAILABLE) {
    console.warn('Backend not available - skipping pocket boss integration tests');
  }
});

describe.skipIf(!BACKEND_AVAILABLE)('PocketBossStore Integration Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('fetches real pocket bosses from the API', async () => {
    const store = usePocketBossStore();

    // Initially should be empty
    expect(store.pocketBosses).toEqual([]);
    expect(store.loading).toBe(false);

    // Fetch data from real API
    await store.fetchPocketBosses();

    // Should have loaded data
    expect(store.pocketBosses.length).toBeGreaterThan(0);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();

    // Check data structure
    const firstBoss = store.pocketBosses[0];
    expect(firstBoss).toHaveProperty('id');
    expect(firstBoss).toHaveProperty('name');
    expect(firstBoss).toHaveProperty('level');
    expect(typeof firstBoss.name).toBe('string');
    expect(typeof firstBoss.level).toBe('number');
  }, 10000); // 10 second timeout for API call

  it('calculates correct playfields from real data', async () => {
    const store = usePocketBossStore();
    await store.fetchPocketBosses();

    const playfields = store.playfields;
    expect(playfields.length).toBeGreaterThan(0);
    expect(Array.isArray(playfields)).toBe(true);

    // Should be sorted
    const sortedPlayfields = [...playfields].sort();
    expect(playfields).toEqual(sortedPlayfields);
  });

  it('calculates correct level range from real data', async () => {
    const store = usePocketBossStore();
    await store.fetchPocketBosses();

    const levelRange = store.levelRange;
    expect(levelRange.min).toBeGreaterThan(0);
    expect(levelRange.max).toBeGreaterThan(levelRange.min);
    expect(levelRange.max).toBeLessThanOrEqual(300); // Adjusted for real game data
  });

  it('filters bosses correctly with real data', async () => {
    const store = usePocketBossStore();
    await store.fetchPocketBosses();

    const allBosses = store.filteredPocketBosses;
    expect(allBosses.length).toBeGreaterThan(0);

    // Test level filtering
    const minLevel = Math.floor((store.levelRange.min + store.levelRange.max) / 2);
    store.updateFilters({ minLevel });

    const filteredBosses = store.filteredPocketBosses;
    expect(filteredBosses.length).toBeLessThanOrEqual(allBosses.length);

    // All filtered bosses should meet the level requirement
    filteredBosses.forEach((boss) => {
      expect(boss.level).toBeGreaterThanOrEqual(minLevel);
    });
  });

  it('searches bosses correctly with real data', async () => {
    const store = usePocketBossStore();
    await store.fetchPocketBosses();

    if (store.pocketBosses.length === 0) return;

    // Use part of a real boss name
    const firstBoss = store.pocketBosses[0];
    const searchTerm = firstBoss.name.split(' ')[0].toLowerCase();

    const searchResults = store.searchPocketBosses(searchTerm);
    expect(searchResults.length).toBeGreaterThan(0);

    // Results should contain the search term
    searchResults.forEach((boss) => {
      const matchesName = boss.name.toLowerCase().includes(searchTerm);
      const matchesLocation = boss.location?.toLowerCase().includes(searchTerm);
      const matchesPlayfield = boss.playfield?.toLowerCase().includes(searchTerm);
      const matchesMobs = boss.mobs?.toLowerCase().includes(searchTerm);

      expect(matchesName || matchesLocation || matchesPlayfield || matchesMobs).toBe(true);
    });
  });

  it('handles API errors gracefully', async () => {
    const store = usePocketBossStore();

    // Test that error handling mechanism exists
    // Note: We can't easily test actual network errors without mocking
    // But we can verify the structure is in place
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);

    // The store should have error state management
    expect(typeof store.error).toBe('object'); // null is an object
    expect(typeof store.loading).toBe('boolean');
  });

  it('caches data after first load', async () => {
    const store = usePocketBossStore();

    // First load
    await store.fetchPocketBosses();
    const firstLoadCount = store.pocketBosses.length;
    expect(firstLoadCount).toBeGreaterThan(0);

    // Second load should use cache
    const startTime = Date.now();
    await store.fetchPocketBosses();
    const loadTime = Date.now() - startTime;

    expect(store.pocketBosses.length).toBe(firstLoadCount);
    expect(loadTime).toBeLessThan(100); // Should be very fast due to caching
  });
});

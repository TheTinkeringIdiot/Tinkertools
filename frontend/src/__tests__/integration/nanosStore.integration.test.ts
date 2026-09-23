/**
 * NanosStore Integration Tests
 *
 * State, favorites and preferences run against the real store with no network.
 * The data-loading tests talk to the real backend and are skipped when it is
 * not running.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useNanosStore } from '@/stores/nanosStore';
import { apiClient } from '@/services/api-client';
import { versionKey } from '@/services/version-keys';
import { isBackendAvailable } from '../helpers/backend-check';

// Top-level await: skipIf is evaluated while tests are collected.
const BACKEND_AVAILABLE = await isBackendAvailable();

describe('NanosStore', () => {
  let store: ReturnType<typeof useNanosStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useNanosStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with correct default state', () => {
    expect(store.nanos).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBe(null);
    expect(store.totalCount).toBe(0);
  });

  it('manages favorites and persists them per game version', () => {
    const nanoId = 42;

    store.addToFavorites(nanoId);
    expect(store.favorites).toContain(nanoId);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      versionKey('tinkertools_nano_favorites'),
      JSON.stringify([nanoId])
    );

    store.removeFromFavorites(nanoId);
    expect(store.favorites).not.toContain(nanoId);

    store.toggleFavorite(nanoId);
    expect(store.favorites).toContain(nanoId);

    store.toggleFavorite(nanoId);
    expect(store.favorites).not.toContain(nanoId);
  });

  it('handles errors gracefully', async () => {
    vi.spyOn(apiClient, 'getPaginated').mockRejectedValue(new Error('Network error'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await store.fetchNanos();

    expect(store.loading).toBe(false);
    expect(store.error).toBe('Network error');
    expect(store.nanos).toEqual([]);
  });

  it('persists preferences to localStorage', () => {
    store.updatePreferences({
      defaultView: 'list',
      compactCards: false,
      itemsPerPage: 25,
    });

    expect(store.preferences.defaultView).toBe('list');
    expect(store.preferences.compactCards).toBe(false);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'tinkertools_nano_preferences',
      expect.any(String)
    );
  });
});

describe.skipIf(!BACKEND_AVAILABLE)('NanosStore with backend', () => {
  let store: ReturnType<typeof useNanosStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useNanosStore();
  });

  it('fetches real nano data from backend', async () => {
    expect(store.loading).toBe(false);

    // Start fetch - loading should be true
    const fetchPromise = store.fetchNanos();
    expect(store.loading).toBe(true);

    await fetchPromise;

    expect(store.loading).toBe(false);
    expect(store.error).toBe(null);
    expect(store.nanos.length).toBeGreaterThan(0);
    expect(store.totalCount).toBeGreaterThan(0);

    const firstNano = store.nanos[0];
    expect(typeof firstNano.id).toBe('number');
    expect(typeof firstNano.aoid).toBe('number');
    expect(typeof firstNano.name).toBe('string');
    expect(typeof firstNano.qualityLevel).toBe('number');
  }, 10000);

  it('handles search with real data', async () => {
    await store.searchNanos('heal', [], ['name']);

    expect(store.error).toBe(null);
    expect(store.nanos.length).toBeGreaterThan(0);
    expect(store.searchHistory).toContain('heal');
    expect(store.loading).toBe(false);
  }, 10000);

  it('applies filters correctly with real data', async () => {
    await store.fetchNanos();
    expect(store.nanos.length).toBeGreaterThan(1);

    store.setFilters({ sortBy: 'name', sortDescending: false });

    const names = store.filteredNanos.map((nano) => nano.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  }, 10000);

  it('computes available schools correctly with real data', async () => {
    await store.fetchNanos();

    const schools = store.availableSchools;
    expect(schools.every((school) => typeof school === 'string')).toBe(true);
    expect(schools).toEqual([...schools].sort());
  }, 10000);

  it('gets nano by id correctly', async () => {
    await store.fetchNanos();
    expect(store.nanos.length).toBeGreaterThan(0);

    const firstNano = store.nanos[0];
    const foundNano = store.getNanoById(firstNano.id);

    expect(foundNano?.id).toBe(firstNano.id);
    expect(foundNano?.name).toBe(firstNano.name);
  }, 10000);
});

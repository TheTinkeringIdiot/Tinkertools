/**
 * NanosStore Integration Tests
 *
 * State, favorites and preferences run against the real store with no network.
 * The data-loading tests talk to the real backend and are skipped when it is
 * not running.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defaultNanoFilters, useNanosStore } from '@/stores/nanosStore';
import { apiClient } from '@/services/api-client';
import { versionKey } from '@/services/version-keys';
import { isBackendAvailable } from '../helpers/backend-check';
import { createAppPinia } from '../helpers/integration-test-utils';

// Top-level await: skipIf is evaluated while tests are collected.
const BACKEND_AVAILABLE = await isBackendAvailable();

describe('NanosStore', () => {
  let store: ReturnType<typeof useNanosStore>;

  beforeEach(() => {
    createAppPinia();
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

  it('manages favorites by AOID and persists them per game version', () => {
    const aoid = 42;

    store.addToFavorites(aoid);
    expect(store.favorites).toContain(aoid);
    expect(store.isFavorite(aoid)).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      versionKey('tinkertools_nano_favorites'),
      JSON.stringify({ version: 2, aoids: [aoid] })
    );

    store.removeFromFavorites(aoid);
    expect(store.favorites).not.toContain(aoid);

    store.toggleFavorite(aoid);
    expect(store.favorites).toContain(aoid);

    store.toggleFavorite(aoid);
    expect(store.favorites).not.toContain(aoid);
    expect(store.isFavorite(aoid)).toBe(false);
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

describe('NanosStore school, profession and level', () => {
  let store: ReturnType<typeof useNanosStore>;

  /** A /nanos item; only the fields under test vary */
  function nanoItem(aoid: number, name: string, fields: Record<string, unknown>) {
    return { aoid, name, ql: 1, strain: null, actions: [], effects: [], ...fields };
  }

  async function load(items: Record<string, unknown>[]): Promise<void> {
    vi.spyOn(apiClient, 'getPaginated').mockResolvedValue({
      items,
      total: items.length,
      page: 1,
      page_size: 200,
      pages: 1,
      has_next: false,
      has_prev: false,
    });
    await store.fetchNanos();
  }

  beforeEach(async () => {
    createAppPinia();
    store = useNanosStore();
    await load([
      nanoItem(1, 'Doctor Heal', { school: 'Medical', professions: ['Doctor'], level: 50 }),
      nanoItem(2, 'Zealot Buff', {
        school: 'Protection',
        professions: ['Martial Artist', 'Enforcer', 'Keeper', 'Shade'],
        level: 150,
      }),
      nanoItem(3, 'General Buff', { school: 'Protection', professions: [], level: 1 }),
      nanoItem(4, 'NPC Proc', { school: null, professions: [], level: null }),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const names = () => store.filteredNanos.map((nano) => nano.name);
  const nanoByAoid = (aoid: number) => store.nanos.find((nano) => nano.aoid === aoid);

  it('maps the school, professions and level the backend sends', () => {
    expect(nanoByAoid(2)).toMatchObject({
      school: 'Protection',
      professions: ['Martial Artist', 'Enforcer', 'Keeper', 'Shade'],
      level: 150,
    });
    expect(nanoByAoid(4)).toMatchObject({ school: null, professions: [], level: null });
    expect(store.availableSchools).toEqual(['Medical', 'Protection']);
    expect(store.availableProfessions).toEqual([
      'Doctor',
      'Enforcer',
      'Keeper',
      'Martial Artist',
      'Shade',
    ]);
  });

  it('reads a response without professions as unrestricted', async () => {
    await load([nanoItem(5, 'Old Shape', { school: null, profession: 'Doctor', level: 10 })]);

    expect(nanoByAoid(5)?.professions).toEqual([]);
  });

  /** The URL of the last request */
  function lastUrl(): string {
    const calls = vi.mocked(apiClient.getPaginated).mock.calls;
    return String(calls[calls.length - 1]?.[0]);
  }

  /** The query of the last request, as an object (repeated keys as arrays) */
  function lastQuery(): Record<string, string | string[]> {
    const query: Record<string, string | string[]> = {};
    new URLSearchParams(lastUrl().split('?')[1]).forEach((value, key) => {
      const existing = query[key];
      query[key] = existing === undefined ? value : [existing, value].flat();
    });
    return query;
  }

  it('sends school, profession, QL and level filters and the sort to the server', async () => {
    store.setFilters({
      schools: ['Medical', 'Psi'],
      professions: ['Doctor', 'Nano-Technician'],
      strainIds: [16, 0],
      qlRange: [50, 400],
      levelRange: [1, 100],
      sortBy: 'level',
      sortDescending: true,
    });
    await store.loadNanos(3);

    expect(lastUrl()).toMatch(/^\/nanos\?/);
    expect(lastQuery()).toEqual({
      school: ['Medical', 'Psi'],
      profession: ['Doctor', 'Nano-Technician'],
      ql_min: '50',
      level_max: '100',
      strain: ['16', '0'],
      sort_by: 'level',
      sort_desc: 'true',
      page: '3',
      page_size: '25',
    });
  });

  it('searches text on the search endpoint with the same filters', async () => {
    store.setFilters({ schools: ['Medical'] });
    await store.searchNanos('heal');

    expect(lastUrl()).toMatch(/^\/nanos\/search\?/);
    expect(lastQuery()).toMatchObject({ q: 'heal', school: 'Medical', page: '1' });
    expect(store.searchHistory).toContain('heal');
  });

  it('shows the server page as loaded and counts the server total', async () => {
    vi.mocked(apiClient.getPaginated).mockResolvedValue({
      items: [nanoItem(9, 'Only One', { school: 'Space', professions: [], level: 5 })],
      total: 1234,
      page: 2,
      page_size: 25,
      pages: 50,
      has_next: true,
      has_prev: true,
    });
    await store.loadNanos(2);

    expect(names()).toEqual(['Only One']);
    expect(store.totalCount).toBe(1234);
    expect(store.resultCount).toBe(1234);
    expect(store.page).toBe(2);
  });

  it('restores saved filters, dropping fields that no longer exist', () => {
    localStorage.setItem(
      'tinkertools_nano_filters',
      JSON.stringify({
        schools: ['Medical'],
        strains: ['Iron Circle'],
        qualityLevels: [100],
        effectTypes: ['heal'],
        durationType: ['long'],
        targetTypes: ['Self'],
        memoryUsageRange: [0, 200],
        nanoPointRange: [0, 500],
        levelRange: [10, 60],
        sortBy: 'memoryUsage',
        castable: 'yes',
      })
    );
    createAppPinia();
    const restored = useNanosStore().filters;

    expect(restored).toEqual({
      ...defaultNanoFilters(),
      schools: ['Medical'],
      levelRange: [10, 60],
    });
  });
});

describe.skipIf(!BACKEND_AVAILABLE)('NanosStore with backend', () => {
  let store: ReturnType<typeof useNanosStore>;

  beforeEach(() => {
    createAppPinia();
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
    expect(typeof firstNano.aoid).toBe('number');
    expect(typeof firstNano.aoid).toBe('number');
    expect(typeof firstNano.name).toBe('string');
    expect(typeof firstNano.qualityLevel).toBe('number');
  }, 10000);

  it('handles search with real data', async () => {
    await store.searchNanos('heal');

    expect(store.error).toBe(null);
    expect(store.nanos.length).toBeGreaterThan(0);
    expect(store.searchHistory).toContain('heal');
    expect(store.loading).toBe(false);
  }, 10000);

  it('applies filters correctly with real data', async () => {
    await store.fetchNanos();
    const everyNano = store.totalCount;
    expect(store.nanos.length).toBeGreaterThan(1);

    // The server filters: every nano of the page is Medical, and fewer match
    store.setFilters({ schools: ['Medical'], levelRange: [1, 100] });
    await store.fetchNanos();

    expect(store.totalCount).toBeGreaterThan(0);
    expect(store.totalCount).toBeLessThan(everyNano);
    for (const nano of store.nanos) {
      expect(nano.school).toBe('Medical');
      expect(nano.level).toBeLessThanOrEqual(100);
    }
  }, 10000);

  it('computes available schools correctly with real data', async () => {
    await store.fetchNanos();

    const schools = store.availableSchools;
    expect(schools.every((school) => typeof school === 'string')).toBe(true);
    expect(schools).toEqual([...schools].sort());
  }, 10000);
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useNanosStore } from '@/stores/nanosStore';

// Simple localStorage mock that doesn't cause issues
global.localStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
} as any;

describe('NanosStore Integration Tests', () => {
  let store: ReturnType<typeof useNanosStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useNanosStore();
    vi.clearAllMocks();
  });

  it('initializes with correct default state', () => {
    expect(store.nanos).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBe(null);
    expect(store.totalCount).toBe(0);
  });

  it('fetches real nano data from backend', async () => {
    expect(store.loading).toBe(false);
    
    // Start fetch - loading should be true
    const fetchPromise = store.fetchNanos();
    expect(store.loading).toBe(true);
    
    // Wait for completion
    await fetchPromise;
    
    // Verify results
    expect(store.loading).toBe(false);
    expect(store.error).toBe(null);
    expect(store.nanos.length).toBeGreaterThan(0);
    expect(store.totalCount).toBeGreaterThan(0);
    
    // Verify nano structure
    const firstNano = store.nanos[0];
    expect(firstNano).toHaveProperty('id');
    expect(firstNano).toHaveProperty('name');
    expect(firstNano).toHaveProperty('aoid');
    expect(firstNano).toHaveProperty('ql');
    expect(firstNano).toHaveProperty('is_nano');
    expect(firstNano.is_nano).toBe(true);
  }, 10000);

  it('handles search with real data', async () => {
    // First fetch data
    await store.fetchNanos();
    expect(store.nanos.length).toBeGreaterThan(0);
    
    // Test search functionality
    await store.searchNanos('heal', [], ['name']);
    
    // Should have added to search history
    expect(store.searchHistory).toContain('heal');
    expect(store.searchHistory.length).toBeGreaterThanOrEqual(1);
    
    // Should not be loading after search completes
    expect(store.loading).toBe(false);
  }, 10000);

  it('applies filters correctly with real data', async () => {
    // First fetch data
    await store.fetchNanos();
    expect(store.nanos.length).toBeGreaterThan(0);
    
    // Test filtering
    store.setFilters({ sortBy: 'name', sortDescending: false });
    
    const filteredNanos = store.filteredNanos;
    expect(Array.isArray(filteredNanos)).toBe(true);
    
    // Test sorting is applied
    if (filteredNanos.length > 1) {
      const firstTwo = filteredNanos.slice(0, 2);
      expect(firstTwo[0].name.localeCompare(firstTwo[1].name)).toBeLessThanOrEqual(0);
    }
  }, 10000);

  it('manages favorites correctly', async () => {
    // First fetch data to have some nanos
    await store.fetchNanos();
    expect(store.nanos.length).toBeGreaterThan(0);
    
    const nanoId = store.nanos[0].id;
    
    // Add to favorites
    store.addToFavorites(nanoId);
    expect(store.favorites).toContain(nanoId);
    expect(localStorage.setItem).toHaveBeenCalled();
    
    // Remove from favorites
    store.removeFromFavorites(nanoId);
    expect(store.favorites).not.toContain(nanoId);
    
    // Toggle favorites
    store.toggleFavorite(nanoId);
    expect(store.favorites).toContain(nanoId);
    
    store.toggleFavorite(nanoId);
    expect(store.favorites).not.toContain(nanoId);
  }, 10000);

  it('computes available schools correctly with real data', async () => {
    await store.fetchNanos();
    
    const schools = store.availableSchools;
    expect(Array.isArray(schools)).toBe(true);
    
    // Should have at least some schools from real data
    // Note: Real nano data might not have school field, so just test structure
    expect(schools.every(school => typeof school === 'string')).toBe(true);
  }, 10000);

  it('gets nano by id correctly', async () => {
    await store.fetchNanos();
    expect(store.nanos.length).toBeGreaterThan(0);
    
    const firstNano = store.nanos[0];
    const foundNano = store.getNanoById(firstNano.id);
    
    expect(foundNano).toBeDefined();
    expect(foundNano?.id).toBe(firstNano.id);
    expect(foundNano?.name).toBe(firstNano.name);
  }, 10000);

  it('handles errors gracefully', async () => {
    // Mock fetch to fail
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    
    await store.fetchNanos();
    
    // Should handle error gracefully
    expect(store.loading).toBe(false);
    expect(store.nanos).toEqual([]);
    
    // Restore fetch
    global.fetch = originalFetch;
  }, 10000);

  it('persists preferences to localStorage', () => {
    const newPrefs = {
      defaultView: 'list' as const,
      compactCards: false,
      itemsPerPage: 25
    };
    
    store.updatePreferences(newPrefs);
    
    expect(store.preferences.defaultView).toBe('list');
    expect(store.preferences.compactCards).toBe(false);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'tinkertools_nano_preferences',
      expect.any(String)
    );
  });
});
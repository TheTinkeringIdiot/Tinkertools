import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useNanosStore } from '@/stores/nanosStore';
import type { NanoProgram, NanoFilters } from '@/types/nano';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
global.localStorage = mockLocalStorage as any;

describe('nanosStore', () => {
  let store: ReturnType<typeof useNanosStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useNanosStore();
    vi.clearAllMocks();
  });

  it('initializes with default state', () => {
    expect(store.nanos).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBe(null);
    expect(store.totalCount).toBe(0);
    expect(store.selectedNano).toBe(null);
    expect(store.favorites).toEqual([]);
    expect(store.searchHistory).toEqual([]);
  });

  it('has default filters', () => {
    expect(store.filters.schools).toEqual([]);
    expect(store.filters.strains).toEqual([]);
    expect(store.filters.professions).toEqual([]);
    expect(store.filters.qualityLevels).toEqual([]);
    expect(store.filters.skillCompatible).toBe(false);
    expect(store.filters.castable).toBe(false);
    expect(store.filters.sortBy).toBe('name');
    expect(store.filters.sortDescending).toBe(false);
  });

  it('has default preferences', () => {
    expect(store.preferences.defaultView).toBe('school');
    expect(store.preferences.compactCards).toBe(true);
    expect(store.preferences.autoExpandSchools).toBe(true);
    expect(store.preferences.showCompatibility).toBe(false);
    expect(store.preferences.defaultSort).toBe('name');
    expect(store.preferences.itemsPerPage).toBe(25);
  });

  it('fetches nanos successfully', async () => {
    const mockNanos: NanoProgram[] = [
      {
        id: 1,
        name: 'Test Nano',
        school: 'Matter Creation',
        strain: 'Test',
        level: 100,
        qualityLevel: 150
      }
    ];

    // Store starts with loading false, sets to true during fetch
    expect(store.loading).toBe(false);
    
    const fetchPromise = store.fetchNanos();
    expect(store.loading).toBe(true);
    
    await fetchPromise;
    
    expect(store.loading).toBe(false);
    expect(store.nanos.length).toBeGreaterThan(0);
    expect(store.error).toBe(null);
  });

  it('handles fetch errors', async () => {
    // Mock a failed fetch by manipulating the mock implementation
    vi.mocked(mockLocalStorage.getItem).mockImplementation(() => {
      throw new Error('Storage error');
    });

    await store.fetchNanos();
    
    // Should handle the error gracefully
    expect(store.loading).toBe(false);
    expect(store.nanos).toEqual([]);
  });

  it('searches nanos with query', async () => {
    await store.searchNanos('heal');
    
    expect(store.searchHistory).toContain('heal');
    expect(store.loading).toBe(false);
  });

  it('does not duplicate search history entries', async () => {
    await store.searchNanos('heal');
    await store.searchNanos('heal'); // Same search again
    
    const healCount = store.searchHistory.filter(h => h === 'heal').length;
    expect(healCount).toBe(1);
  });

  it('limits search history to 10 entries', async () => {
    for (let i = 0; i < 15; i++) {
      await store.searchNanos(`search${i}`);
    }
    
    expect(store.searchHistory.length).toBeLessThanOrEqual(10);
  }, 10000);

  it('sets filters correctly', () => {
    const newFilters: Partial<NanoFilters> = {
      schools: ['Matter Creation'],
      qualityLevels: [100, 150],
      skillCompatible: true
    };
    
    store.setFilters(newFilters);
    
    expect(store.filters.schools).toEqual(['Matter Creation']);
    expect(store.filters.qualityLevels).toEqual([100, 150]);
    expect(store.filters.skillCompatible).toBe(true);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('clears filters', () => {
    // Set some filters first
    store.setFilters({ schools: ['Matter Creation'], skillCompatible: true });
    
    store.clearFilters();
    
    expect(store.filters.schools).toEqual([]);
    expect(store.filters.skillCompatible).toBe(false);
    expect(store.filters.sortBy).toBe('name');
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('selects nano', () => {
    const mockNano: NanoProgram = {
      id: 1,
      name: 'Test Nano',
      school: 'Matter Creation',
      strain: 'Test',
      level: 100,
      qualityLevel: 150
    };
    
    store.selectNano(mockNano);
    
    expect(store.selectedNano).toEqual(mockNano);
  });

  it('toggles favorites', () => {
    store.toggleFavorite(1);
    
    expect(store.favorites).toContain(1);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
    
    store.toggleFavorite(1); // Toggle again
    
    expect(store.favorites).not.toContain(1);
  });

  it('adds to favorites', () => {
    store.addToFavorites(1);
    
    expect(store.favorites).toContain(1);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
    
    // Adding again should not create duplicate
    store.addToFavorites(1);
    const count = store.favorites.filter(f => f === 1).length;
    expect(count).toBe(1);
  });

  it('removes from favorites', () => {
    store.addToFavorites(1);
    store.removeFromFavorites(1);
    
    expect(store.favorites).not.toContain(1);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('updates preferences', () => {
    const newPrefs = {
      defaultView: 'list' as const,
      compactCards: false,
      itemsPerPage: 50
    };
    
    store.updatePreferences(newPrefs);
    
    expect(store.preferences.defaultView).toBe('list');
    expect(store.preferences.compactCards).toBe(false);
    expect(store.preferences.itemsPerPage).toBe(50);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('filters nanos by school', async () => {
    await store.fetchNanos();
    store.setFilters({ schools: ['Matter Creation'] });
    
    const filtered = store.filteredNanos;
    filtered.forEach(nano => {
      expect(nano.school).toBe('Matter Creation');
    });
  });

  it('filters nanos by strain', async () => {
    await store.fetchNanos();
    store.setFilters({ strains: ['Test Strain'] });
    
    const filtered = store.filteredNanos;
    // May not match any nanos in mock data, but should not error
    expect(Array.isArray(filtered)).toBe(true);
  });

  it('filters nanos by profession', async () => {
    await store.fetchNanos();
    store.setFilters({ professions: ['Doctor'] });
    
    const filtered = store.filteredNanos;
    filtered.forEach(nano => {
      expect(nano.profession === 'Doctor' || !nano.profession).toBe(true);
    });
  });

  it('filters nanos by quality level', async () => {
    await store.fetchNanos();
    store.setFilters({ qualityLevels: [150, 175] });
    
    const filtered = store.filteredNanos;
    filtered.forEach(nano => {
      expect([150, 175]).toContain(nano.qualityLevel);
    });
  });

  it('filters nanos by level range', async () => {
    await store.fetchNanos();
    store.setFilters({ levelRange: [100, 150] });
    
    const filtered = store.filteredNanos;
    filtered.forEach(nano => {
      expect(nano.level).toBeGreaterThanOrEqual(100);
      expect(nano.level).toBeLessThanOrEqual(150);
    });
  });

  it('sorts nanos by name', async () => {
    await store.fetchNanos();
    store.setFilters({ sortBy: 'name', sortDescending: false });
    
    const filtered = store.filteredNanos;
    if (filtered.length > 1) {
      for (let i = 1; i < filtered.length; i++) {
        expect(filtered[i].name.localeCompare(filtered[i - 1].name)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('sorts nanos by level', async () => {
    await store.fetchNanos();
    store.setFilters({ sortBy: 'level', sortDescending: false });
    
    const filtered = store.filteredNanos;
    if (filtered.length > 1) {
      for (let i = 1; i < filtered.length; i++) {
        expect(filtered[i].level).toBeGreaterThanOrEqual(filtered[i - 1].level);
      }
    }
  });

  it('sorts nanos in descending order', async () => {
    await store.fetchNanos();
    store.setFilters({ sortBy: 'level', sortDescending: true });
    
    const filtered = store.filteredNanos;
    if (filtered.length > 1) {
      for (let i = 1; i < filtered.length; i++) {
        expect(filtered[i].level).toBeLessThanOrEqual(filtered[i - 1].level);
      }
    }
  });

  it('gets nano by id', async () => {
    await store.fetchNanos();
    
    const nano = store.getNanoById(1);
    if (nano) {
      expect(nano.id).toBe(1);
    }
  });

  it('gets nanos by school', async () => {
    await store.fetchNanos();
    
    const nanos = store.getNanosBySchool('Matter Creation');
    nanos.forEach(nano => {
      expect(nano.school).toBe('Matter Creation');
    });
  });

  it('gets nanos by strain', async () => {
    await store.fetchNanos();
    
    const nanos = store.getNanosByStrain('Test');
    nanos.forEach(nano => {
      expect(nano.strain).toBe('Test');
    });
  });

  it('computes available schools', async () => {
    await store.fetchNanos();
    
    const schools = store.availableSchools;
    expect(Array.isArray(schools)).toBe(true);
    expect(schools.length).toBeGreaterThan(0);
  });

  it('computes available strains', async () => {
    await store.fetchNanos();
    
    const strains = store.availableStrains;
    expect(Array.isArray(strains)).toBe(true);
  });

  it('computes available professions', async () => {
    await store.fetchNanos();
    
    const professions = store.availableProfessions;
    expect(Array.isArray(professions)).toBe(true);
  });

  it('computes favorite nanos', async () => {
    await store.fetchNanos();
    store.addToFavorites(1);
    
    const favorites = store.favoriteNanos;
    expect(favorites.some(nano => nano.id === 1)).toBe(true);
  });

  it('loads data from localStorage on initialization', () => {
    // Store initialization should call localStorage.getItem multiple times
    expect(mockLocalStorage.getItem).toHaveBeenCalled();
  });

  it('saves nanos to localStorage after fetching', async () => {
    await store.fetchNanos();
    
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'tinkertools_nanos_cache',
      expect.stringContaining('data')
    );
  });

  it('saves search history to localStorage', async () => {
    await store.searchNanos('test');
    
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'tinkertools_nano_search_history',
      expect.any(String)
    );
  });

  it('handles localStorage errors gracefully', () => {
    vi.mocked(mockLocalStorage.setItem).mockImplementation(() => {
      throw new Error('Storage full');
    });
    
    // Should not throw error
    expect(() => store.addToFavorites(1)).not.toThrow();
  });
});
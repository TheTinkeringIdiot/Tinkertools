import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { usePocketBossStore } from '@/stores/pocketBossStore';
import type { PocketBoss, Symbiant } from '@/types/api';

// Mock the API client
vi.mock('@/services/api-client', () => ({
  apiClient: {
    searchPocketBosses: vi.fn()
  }
}));

describe('usePocketBossStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes with empty state', () => {
    const store = usePocketBossStore();
    
    expect(store.pocketBosses).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.filters).toEqual({});
  });

  it('calculates filtered bosses correctly', () => {
    const store = usePocketBossStore();
    const mockBosses: PocketBoss[] = [
      {
        id: 1,
        name: 'Test Boss 1',
        level: 100,
        playfield: 'Nascence',
        location: 'Central',
        mobs: 'Test mobs',
        dropped_symbiants: []
      },
      {
        id: 2,
        name: 'Another Boss',
        level: 150,
        playfield: 'Shadowlands',
        location: 'Dark Area',
        mobs: 'Dark creatures',
        dropped_symbiants: []
      }
    ];

    store.pocketBosses = mockBosses;
    expect(store.filteredPocketBosses).toEqual(mockBosses);
  });

  it('filters bosses by search term', () => {
    const store = usePocketBossStore();
    const mockBosses: PocketBoss[] = [
      {
        id: 1,
        name: 'Test Boss 1',
        level: 100,
        playfield: 'Nascence',
        location: 'Central',
        mobs: 'Test mobs',
        dropped_symbiants: []
      },
      {
        id: 2,
        name: 'Another Boss',
        level: 150,
        playfield: 'Shadowlands',
        location: 'Dark Area',
        mobs: 'Dark creatures',
        dropped_symbiants: []
      }
    ];

    store.pocketBosses = mockBosses;
    store.updateFilters({ search: 'Test' });

    expect(store.filteredPocketBosses).toHaveLength(1);
    expect(store.filteredPocketBosses[0].name).toBe('Test Boss 1');
  });

  it('filters bosses by level range', () => {
    const store = usePocketBossStore();
    const mockBosses: PocketBoss[] = [
      {
        id: 1,
        name: 'Low Level Boss',
        level: 50,
        playfield: 'Test Field',
        dropped_symbiants: []
      },
      {
        id: 2,
        name: 'Mid Level Boss',
        level: 100,
        playfield: 'Test Field',
        dropped_symbiants: []
      },
      {
        id: 3,
        name: 'High Level Boss',
        level: 200,
        playfield: 'Test Field',
        dropped_symbiants: []
      }
    ];

    store.pocketBosses = mockBosses;
    store.updateFilters({ minLevel: 75, maxLevel: 150 });

    expect(store.filteredPocketBosses).toHaveLength(1);
    expect(store.filteredPocketBosses[0].name).toBe('Mid Level Boss');
  });

  it('filters bosses by playfield', () => {
    const store = usePocketBossStore();
    const mockBosses: PocketBoss[] = [
      {
        id: 1,
        name: 'Nascence Boss',
        level: 100,
        playfield: 'Nascence',
        dropped_symbiants: []
      },
      {
        id: 2,
        name: 'Shadowlands Boss',
        level: 100,
        playfield: 'Shadowlands',
        dropped_symbiants: []
      }
    ];

    store.pocketBosses = mockBosses;
    store.updateFilters({ playfield: 'Nascence' });

    expect(store.filteredPocketBosses).toHaveLength(1);
    expect(store.filteredPocketBosses[0].name).toBe('Nascence Boss');
  });

  it('calculates playfields correctly', () => {
    const store = usePocketBossStore();
    const mockBosses: PocketBoss[] = [
      { id: 1, name: 'Boss 1', level: 100, playfield: 'Nascence', dropped_symbiants: [] },
      { id: 2, name: 'Boss 2', level: 100, playfield: 'Shadowlands', dropped_symbiants: [] },
      { id: 3, name: 'Boss 3', level: 100, playfield: 'Nascence', dropped_symbiants: [] }
    ];

    store.pocketBosses = mockBosses;
    expect(store.playfields).toEqual(['Nascence', 'Shadowlands']);
  });

  it('calculates level range correctly', () => {
    const store = usePocketBossStore();
    const mockBosses: PocketBoss[] = [
      { id: 1, name: 'Boss 1', level: 50, dropped_symbiants: [] },
      { id: 2, name: 'Boss 2', level: 200, dropped_symbiants: [] },
      { id: 3, name: 'Boss 3', level: 100, dropped_symbiants: [] }
    ];

    store.pocketBosses = mockBosses;
    expect(store.levelRange).toEqual({ min: 50, max: 200 });
  });

  it('returns default level range for empty bosses', () => {
    const store = usePocketBossStore();
    expect(store.levelRange).toEqual({ min: 1, max: 220 });
  });

  it('finds boss by ID', () => {
    const store = usePocketBossStore();
    const mockBoss: PocketBoss = {
      id: 1,
      name: 'Test Boss',
      level: 100,
      dropped_symbiants: []
    };

    store.pocketBosses = [mockBoss];
    expect(store.getPocketBossById(1)).toEqual(mockBoss);
    expect(store.getPocketBossById(999)).toBeUndefined();
  });

  it('finds bosses by symbiant ID', () => {
    const store = usePocketBossStore();
    const mockSymbiant: Symbiant = { id: 100, aoid: 1000 };
    const mockBosses: PocketBoss[] = [
      {
        id: 1,
        name: 'Boss 1',
        level: 100,
        dropped_symbiants: [mockSymbiant]
      },
      {
        id: 2,
        name: 'Boss 2',
        level: 150,
        dropped_symbiants: []
      }
    ];

    store.pocketBosses = mockBosses;
    const result = store.getPocketBossesBySymbiant(100);
    
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Boss 1');
  });

  it('searches bosses across multiple fields', () => {
    const store = usePocketBossStore();
    const mockBosses: PocketBoss[] = [
      {
        id: 1,
        name: 'Fire Dragon',
        level: 100,
        playfield: 'Volcano',
        location: 'Crater',
        mobs: 'Fire elementals',
        dropped_symbiants: []
      },
      {
        id: 2,
        name: 'Ice Beast',
        level: 120,
        playfield: 'Frozen Wastes',
        location: 'Ice Cave',
        mobs: 'Ice creatures',
        dropped_symbiants: []
      }
    ];

    store.pocketBosses = mockBosses;

    // Search by name
    expect(store.searchPocketBosses('Fire')).toHaveLength(1);
    
    // Search by playfield
    expect(store.searchPocketBosses('Volcano')).toHaveLength(1);
    
    // Search by mobs
    expect(store.searchPocketBosses('elementals')).toHaveLength(1);
    
    // Case insensitive
    expect(store.searchPocketBosses('ice')).toHaveLength(1);
  });

  it('clears filters correctly', () => {
    const store = usePocketBossStore();
    
    store.updateFilters({
      search: 'test',
      minLevel: 50,
      maxLevel: 150,
      playfield: 'Nascence'
    });

    expect(store.filters.search).toBe('test');
    
    store.clearFilters();
    expect(store.filters).toEqual({});
  });

  it('updates filters correctly', () => {
    const store = usePocketBossStore();
    
    store.updateFilters({ search: 'test' });
    expect(store.filters.search).toBe('test');
    
    store.updateFilters({ minLevel: 100 });
    expect(store.filters.search).toBe('test');
    expect(store.filters.minLevel).toBe(100);
  });
});
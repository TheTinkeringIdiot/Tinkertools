import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiClient } from '@/services/api-client';
import type { PocketBoss, Symbiant } from '@/types/api';

export interface PocketBossFilters {
  search?: string;
  minLevel?: number;
  maxLevel?: number;
  playfield?: string;
  symbiantSlot?: string;
  symbiantQuality?: number[];
}

export const usePocketBossStore = defineStore('pocketBoss', () => {
  // State
  const pocketBosses = ref<PocketBoss[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const filters = ref<PocketBossFilters>({});

  // Getters
  const filteredPocketBosses = computed(() => {
    let result = pocketBosses.value;

    if (filters.value.search) {
      const searchTerm = filters.value.search.toLowerCase();
      result = result.filter(boss => 
        boss.name.toLowerCase().includes(searchTerm) ||
        boss.playfield?.toLowerCase().includes(searchTerm) ||
        boss.location?.toLowerCase().includes(searchTerm)
      );
    }

    if (filters.value.minLevel !== undefined) {
      result = result.filter(boss => boss.level >= filters.value.minLevel!);
    }

    if (filters.value.maxLevel !== undefined) {
      result = result.filter(boss => boss.level <= filters.value.maxLevel!);
    }

    if (filters.value.playfield) {
      result = result.filter(boss => boss.playfield === filters.value.playfield);
    }

    return result.sort((a, b) => a.level - b.level);
  });

  const playfields = computed(() => {
    const fields = new Set(pocketBosses.value
      .map(boss => boss.playfield)
      .filter(Boolean));
    return Array.from(fields).sort();
  });

  const levelRange = computed(() => {
    if (pocketBosses.value.length === 0) return { min: 1, max: 220 };
    
    const levels = pocketBosses.value.map(boss => boss.level);
    return {
      min: Math.min(...levels),
      max: Math.max(...levels)
    };
  });

  // Actions
  async function fetchPocketBosses() {
    if (pocketBosses.value.length > 0) return; // Already loaded

    loading.value = true;
    error.value = null;

    try {
      const response = await apiClient.searchPocketBosses({ page: 1, limit: 1000 });
      pocketBosses.value = response.items || [];
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch pocket bosses';
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function updateFilters(newFilters: Partial<PocketBossFilters>) {
    filters.value = { ...filters.value, ...newFilters };
  }

  function clearFilters() {
    filters.value = {};
  }

  function getPocketBossById(id: number): PocketBoss | undefined {
    return pocketBosses.value.find(boss => boss.id === id);
  }

  function getPocketBossesBySymbiant(symbiantId: number): PocketBoss[] {
    return pocketBosses.value.filter(boss => 
      boss.dropped_symbiants?.some(s => s.id === symbiantId)
    );
  }

  function searchPocketBosses(query: string): PocketBoss[] {
    if (!query.trim()) return pocketBosses.value;

    const searchTerm = query.toLowerCase();
    return pocketBosses.value.filter(boss =>
      boss.name.toLowerCase().includes(searchTerm) ||
      boss.playfield?.toLowerCase().includes(searchTerm) ||
      boss.location?.toLowerCase().includes(searchTerm) ||
      boss.mobs?.toLowerCase().includes(searchTerm)
    );
  }

  return {
    // State
    pocketBosses,
    loading,
    error,
    filters,
    
    // Getters
    filteredPocketBosses,
    playfields,
    levelRange,
    
    // Actions
    fetchPocketBosses,
    updateFilters,
    clearFilters,
    getPocketBossById,
    getPocketBossesBySymbiant,
    searchPocketBosses
  };
});
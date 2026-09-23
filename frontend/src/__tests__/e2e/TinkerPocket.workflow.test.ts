/**
 * TinkerPocket Workflow Tests
 *
 * TRUE INTEGRATION TEST - Requires real backend
 * The pocket boss and symbiant stores behind TinkerPocket, driven through a
 * user's workflow against real data.
 *
 * Strategy: Skip when backend not available
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { usePocketBossStore } from '@/stores/pocketBossStore';
import { useSymbiantsStore } from '@/stores/symbiants';
import { apiClient } from '@/services/api-client';
import type { Symbiant } from '@/types/api';
import { isBackendAvailable } from '../helpers/backend-check';

// Top-level await: skipIf is evaluated while tests are collected.
const BACKEND_AVAILABLE = await isBackendAvailable();

describe.skipIf(!BACKEND_AVAILABLE)('TinkerPocket Workflow', () => {
  let pocketBossStore: ReturnType<typeof usePocketBossStore>;
  let symbiantStore: ReturnType<typeof useSymbiantsStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    pocketBossStore = usePocketBossStore();
    symbiantStore = useSymbiantsStore();
  });

  it('browses bosses, filters by level and searches by name', async () => {
    await pocketBossStore.fetchPocketBosses();

    const allBosses = pocketBossStore.filteredPocketBosses;
    expect(allBosses.length).toBeGreaterThan(0);

    // Filter by level
    const { min, max } = pocketBossStore.levelRange;
    const midLevel = Math.floor((min + max) / 2);
    pocketBossStore.updateFilters({ minLevel: midLevel });

    const levelFilteredBosses = pocketBossStore.filteredPocketBosses;
    expect(levelFilteredBosses.length).toBeGreaterThan(0);
    expect(levelFilteredBosses.length).toBeLessThan(allBosses.length);
    levelFilteredBosses.forEach((boss) => {
      expect(boss.level).toBeGreaterThanOrEqual(midLevel);
    });

    // Search for a specific boss
    pocketBossStore.clearFilters();
    const searchTerm = allBosses[0].name.split(' ')[0].toLowerCase();
    pocketBossStore.updateFilters({ search: searchTerm });

    const searchResults = pocketBossStore.filteredPocketBosses;
    expect(searchResults.map((boss) => boss.id)).toContain(allBosses[0].id);
    searchResults.forEach((boss) => {
      const matchFound = [boss.name, boss.playfield, boss.location].some((field) =>
        field?.toLowerCase().includes(searchTerm)
      );
      expect(matchFound).toBe(true);
    });

    // Clearing filters shows every boss again
    pocketBossStore.clearFilters();
    expect(pocketBossStore.filteredPocketBosses).toHaveLength(allBosses.length);
  }, 30000);

  it('builds a farm list of the bosses that drop the chosen symbiant', async () => {
    const symbiants = await symbiantStore.loadAllSymbiants();
    expect(symbiants.length).toBeGreaterThan(0);

    // Pick a symbiant that some boss actually drops
    let target: Symbiant | undefined;
    let expectedBossIds: number[] = [];
    for (const symbiant of symbiants.slice(0, 25)) {
      const response = await apiClient.getSymbiantDroppedBy(symbiant.id);
      if (response.data && response.data.length > 0) {
        target = symbiant;
        expectedBossIds = response.data.map((boss) => boss.id);
        break;
      }
    }
    expect(target).toBeDefined();

    expect(symbiantStore.addToFarmList(target!)).toBe(true);
    expect(symbiantStore.isInFarmList(target!.aoid)).toBe(true);

    await symbiantStore.aggregateBossesForFarmList();

    const aggregated = symbiantStore.aggregatedBosses;
    expect(Array.from(aggregated.keys()).sort()).toEqual([...expectedBossIds].sort());
    aggregated.forEach((entry) => {
      expect(entry.symbiants.map((s) => s.id)).toContain(target!.id);
      expect(entry.farmed).toBe(false);
    });

    // Mark a boss as farmed
    const bossId = expectedBossIds[0];
    symbiantStore.toggleBossFarmed(bossId);
    expect(symbiantStore.isBossFarmed(bossId)).toBe(true);
    expect(symbiantStore.aggregatedBosses.get(bossId)?.farmed).toBe(true);
  }, 60000);

  it('filters and searches bosses quickly with real data', async () => {
    await pocketBossStore.fetchPocketBosses();

    const startTime = performance.now();
    pocketBossStore.updateFilters({ minLevel: 100, maxLevel: 200, search: 'a' });
    const filteredBosses = pocketBossStore.filteredPocketBosses;
    const filterTime = performance.now() - startTime;

    expect(filterTime).toBeLessThan(100);
    filteredBosses.forEach((boss) => {
      expect(boss.level).toBeGreaterThanOrEqual(100);
      expect(boss.level).toBeLessThanOrEqual(200);
    });

    const searchStart = performance.now();
    pocketBossStore.searchPocketBosses('boss');
    const searchTime = performance.now() - searchStart;

    expect(searchTime).toBeLessThan(50);
  }, 20000);
});

import { describe, it, expect, beforeEach } from 'vitest';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import PrimeVue from 'primevue/config';
import TinkerPocket from '@/views/TinkerPocket.vue';
import { usePocketBossStore } from '@/stores/pocketBossStore';
import { useSymbiantsStore } from '@/stores/symbiants';

// Mock localStorage for collection tracking
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

describe('TinkerPocket E2E Workflow Tests', () => {
  let wrapper: VueWrapper;
  let pocketBossStore: any;
  let symbiantStore: any;

  beforeEach(() => {
    const pinia = createPinia();
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: '/pocket', component: TinkerPocket }]
    });

    wrapper = mount(TinkerPocket, {
      global: { plugins: [pinia, PrimeVue, router] }
    });

    pocketBossStore = usePocketBossStore(pinia);
    symbiantStore = useSymbiantsStore(pinia);
    
    // Clear localStorage before each test
    mockLocalStorage.clear();
  });

  it('complete user workflow: browse bosses, find symbiants, track collection', async () => {
    // Step 1: Load initial data
    await Promise.all([
      pocketBossStore.fetchPocketBosses(),
      symbiantStore.searchSymbiants({ page: 1, limit: 100 })
    ]);

    // Verify data loaded
    expect(pocketBossStore.pocketBosses.length).toBeGreaterThan(0);
    expect(symbiantStore.symbiants.size).toBeGreaterThan(0);

    console.log(`Loaded ${pocketBossStore.pocketBosses.length} pocket bosses`);
    console.log(`Loaded ${symbiantStore.symbiants.size} symbiants`);

    // Step 2: User browses pocket bosses
    const allBosses = pocketBossStore.filteredPocketBosses;
    expect(allBosses.length).toBeGreaterThan(0);

    // Step 3: User filters by level
    const levelRange = pocketBossStore.levelRange;
    const midLevel = Math.floor((levelRange.min + levelRange.max) / 2);
    pocketBossStore.updateFilters({ minLevel: midLevel });

    const levelFilteredBosses = pocketBossStore.filteredPocketBosses;
    console.log(`Filtered to ${levelFilteredBosses.length} bosses with level >= ${midLevel}`);
    
    levelFilteredBosses.forEach(boss => {
      expect(boss.level).toBeGreaterThanOrEqual(midLevel);
    });

    // Step 4: User searches for specific boss
    if (allBosses.length > 0) {
      const firstBoss = allBosses[0];
      const searchTerm = firstBoss.name.split(' ')[0].toLowerCase();
      pocketBossStore.updateFilters({ search: searchTerm });

      const searchResults = pocketBossStore.filteredPocketBosses;
      console.log(`Search for "${searchTerm}" returned ${searchResults.length} results`);
      
      expect(searchResults.length).toBeGreaterThan(0);
      
      // Verify search results contain the term
      searchResults.forEach(boss => {
        const matchFound = [
          boss.name,
          boss.playfield,
          boss.location,
          boss.mobs
        ].some(field => field?.toLowerCase().includes(searchTerm));
        expect(matchFound).toBe(true);
      });
    }

    // Step 5: Clear filters and browse symbiants
    pocketBossStore.clearFilters();
    const symbiants = Array.from(symbiantStore.symbiants.values()).slice(0, 20);
    
    console.log(`Browsing ${symbiants.length} symbiants`);
    
    // Verify enrichment worked
    symbiants.forEach(symbiant => {
      expect(symbiant.name).toBeTruthy();
      expect(symbiant.slot).toBeTruthy();
      expect(symbiant.ql).toBeGreaterThanOrEqual(50);
      expect(symbiant.family).toBeTruthy();
    });

    // Step 6: User checks which bosses drop specific symbiants
    const testSymbiant = symbiants[0];
    const dropSources = pocketBossStore.getPocketBossesBySymbiant(testSymbiant.id);
    console.log(`Symbiant ${testSymbiant.name} drops from ${dropSources.length} bosses`);
    
    // Verify drop source lookup works
    expect(Array.isArray(dropSources)).toBe(true);
    dropSources.forEach(boss => {
      expect(boss).toHaveProperty('name');
      expect(boss).toHaveProperty('level');
    });

  }, 30000); // Long timeout for full workflow

  it('collection tracking workflow with real data', async () => {
    // Load symbiant data
    const symbiants = await symbiantStore.searchSymbiants({ page: 1, limit: 10 });
    expect(symbiants.length).toBeGreaterThan(0);

    console.log(`Testing collection tracking with ${symbiants.length} symbiants`);

    // Simulate collection tracking
    const collectionData: Record<number, { symbiant: any; collected: boolean }> = {};
    
    // User "collects" some symbiants
    const collectedCount = Math.min(3, symbiants.length);
    for (let i = 0; i < collectedCount; i++) {
      const symbiant = symbiants[i];
      collectionData[symbiant.id] = {
        symbiant,
        collected: true
      };
    }

    // User hasn't collected others
    for (let i = collectedCount; i < symbiants.length; i++) {
      const symbiant = symbiants[i];
      collectionData[symbiant.id] = {
        symbiant,
        collected: false
      };
    }

    // Calculate collection statistics
    const total = Object.keys(collectionData).length;
    const collected = Object.values(collectionData).filter(item => item.collected).length;
    const percentage = Math.round((collected / total) * 100);

    console.log(`Collection stats: ${collected}/${total} (${percentage}%)`);

    expect(collected).toBe(collectedCount);
    expect(total).toBe(symbiants.length);
    expect(percentage).toBeGreaterThan(0);

    // Test progress by slot
    const bySlot: Record<string, { total: number; collected: number }> = {};
    Object.values(collectionData).forEach(item => {
      const slot = item.symbiant.slot;
      if (!bySlot[slot]) {
        bySlot[slot] = { total: 0, collected: 0 };
      }
      bySlot[slot].total++;
      if (item.collected) {
        bySlot[slot].collected++;
      }
    });

    console.log('Collection by slot:', bySlot);
    expect(Object.keys(bySlot).length).toBeGreaterThan(0);

    // Test localStorage simulation
    const storageKey = 'tinkertools-symbiant-collection';
    mockLocalStorage.setItem(storageKey, JSON.stringify(collectionData));
    
    const retrieved = JSON.parse(mockLocalStorage.getItem(storageKey) || '{}');
    expect(Object.keys(retrieved)).toHaveLength(total);
  });

  it('boss-symbiant relationship workflow', async () => {
    // Load both datasets
    await Promise.all([
      pocketBossStore.fetchPocketBosses(),
      symbiantStore.searchSymbiants({ page: 1, limit: 50 })
    ]);

    const bosses = pocketBossStore.pocketBosses;
    const symbiants = Array.from(symbiantStore.symbiants.values());

    console.log(`Testing relationships between ${bosses.length} bosses and ${symbiants.length} symbiants`);

    // Test bidirectional lookups
    let relationshipCount = 0;
    
    // For each boss, check what symbiants it drops
    bosses.forEach(boss => {
      const droppedSymbiants = boss.dropped_symbiants || [];
      relationshipCount += droppedSymbiants.length;
      
      droppedSymbiants.forEach(symbiant => {
        expect(symbiant).toHaveProperty('id');
        expect(symbiant).toHaveProperty('aoid');
      });
    });

    // For each symbiant, check what bosses drop it
    const sampleSymbiants = symbiants.slice(0, 10);
    sampleSymbiants.forEach(symbiant => {
      const dropSources = pocketBossStore.getPocketBossesBySymbiant(symbiant.id);
      expect(Array.isArray(dropSources)).toBe(true);
      
      dropSources.forEach(boss => {
        // Verify the relationship is bidirectional
        const bossDrops = boss.dropped_symbiants || [];
        const hasSymbiant = bossDrops.some(s => s.id === symbiant.id);
        expect(hasSymbiant).toBe(true);
      });
    });

    console.log(`Found ${relationshipCount} boss-symbiant relationships`);
  }, 25000);

  it('filtering and search performance with real data', async () => {
    // Load large dataset
    await Promise.all([
      pocketBossStore.fetchPocketBosses(),
      symbiantStore.searchSymbiants({ page: 1, limit: 200 })
    ]);

    const bosses = pocketBossStore.pocketBosses;
    const symbiants = Array.from(symbiantStore.symbiants.values());

    console.log(`Performance testing with ${bosses.length} bosses and ${symbiants.length} symbiants`);

    // Test filtering performance
    const startTime = performance.now();
    
    // Apply multiple filters
    pocketBossStore.updateFilters({
      minLevel: 100,
      maxLevel: 200,
      search: 'a' // Common letter to get multiple results
    });

    const filteredBosses = pocketBossStore.filteredPocketBosses;
    const filterTime = performance.now() - startTime;

    console.log(`Filtering took ${filterTime.toFixed(2)}ms, returned ${filteredBosses.length} results`);
    expect(filterTime).toBeLessThan(100); // Should be fast

    // Test search performance
    const searchStart = performance.now();
    const searchResults = pocketBossStore.searchPocketBosses('boss');
    const searchTime = performance.now() - searchStart;

    console.log(`Search took ${searchTime.toFixed(2)}ms, returned ${searchResults.length} results`);
    expect(searchTime).toBeLessThan(50); // Should be very fast

    // Verify results are correct
    filteredBosses.forEach(boss => {
      expect(boss.level).toBeGreaterThanOrEqual(100);
      expect(boss.level).toBeLessThanOrEqual(200);
    });
  }, 20000);
});
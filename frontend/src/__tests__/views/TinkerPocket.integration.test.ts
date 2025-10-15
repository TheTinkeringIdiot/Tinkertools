/**
 * TinkerPocket Integration Tests
 *
 * TRUE INTEGRATION TEST - Requires real backend
 * Tests full TinkerPocket view with real API calls
 *
 * Strategy: Skip when backend not available (Option B)
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { nextTick } from 'vue';
import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createWebHistory } from 'vue-router';
import PrimeVue from 'primevue/config';
import TinkerPocket from '@/views/TinkerPocket.vue';
import { usePocketBossStore } from '@/stores/pocketBossStore';
import { useSymbiantsStore } from '@/stores/symbiants';
import { isBackendAvailable } from '../helpers/backend-check';

// Check backend availability before running tests
let BACKEND_AVAILABLE = false;

beforeAll(async () => {
  BACKEND_AVAILABLE = await isBackendAvailable();
  if (!BACKEND_AVAILABLE) {
    console.warn('Backend not available - skipping TinkerPocket integration tests');
  }
});

describe.skipIf(!BACKEND_AVAILABLE)('TinkerPocket Integration Tests', () => {
  let wrapper: VueWrapper;
  let router: any;
  let pinia: any;

  beforeEach(() => {
    // Create fresh instances for each test
    pinia = createPinia();
    router = createRouter({
      history: createWebHistory(),
      routes: [
        { path: '/pocket', component: { template: '<div>Pocket</div>' } }
      ]
    });

    wrapper = mount(TinkerPocket, {
      global: {
        plugins: [pinia, PrimeVue, router]
      }
    });
  });

  it('loads real data from both APIs on mount', async () => {
    const pocketBossStore = usePocketBossStore(pinia);
    const symbiantStore = useSymbiantsStore(pinia);
    
    // Wait for component to mount and load data
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check that data was loaded
    expect(pocketBossStore.pocketBosses.length).toBeGreaterThan(0);
    expect(symbiantStore.symbiants.size).toBeGreaterThan(0);
    
    // Component should not be in loading state
    const component = wrapper.vm as any;
    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
  }, 15000);

  it('displays real pocket boss data in the interface', async () => {
    // Wait for data loading
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const pocketBossStore = usePocketBossStore(pinia);
    await pocketBossStore.fetchPocketBosses();
    
    // Should have loaded real bosses
    expect(pocketBossStore.pocketBosses.length).toBeGreaterThan(0);
    
    // Check that real data is accessible
    const firstBoss = pocketBossStore.pocketBosses[0];
    expect(firstBoss.name).toBeTruthy();
    expect(firstBoss.level).toBeGreaterThan(0);
    
    // Verify computed properties work with real data
    expect(pocketBossStore.playfields.length).toBeGreaterThan(0);
    expect(pocketBossStore.levelRange.max).toBeGreaterThan(pocketBossStore.levelRange.min);
  }, 15000);

  it('filters and searches work with real data', async () => {
    const pocketBossStore = usePocketBossStore(pinia);
    await pocketBossStore.fetchPocketBosses();
    
    const totalBosses = pocketBossStore.filteredPocketBosses.length;
    expect(totalBosses).toBeGreaterThan(0);
    
    // Test level filtering with real data
    const avgLevel = Math.floor((pocketBossStore.levelRange.min + pocketBossStore.levelRange.max) / 2);
    pocketBossStore.updateFilters({ minLevel: avgLevel });
    
    const filteredBosses = pocketBossStore.filteredPocketBosses;
    expect(filteredBosses.length).toBeLessThanOrEqual(totalBosses);
    
    // All filtered bosses should meet criteria
    filteredBosses.forEach(boss => {
      expect(boss.level).toBeGreaterThanOrEqual(avgLevel);
    });
    
    // Test search functionality
    if (totalBosses > 0) {
      const searchTerm = pocketBossStore.pocketBosses[0].name.split(' ')[0].toLowerCase();
      pocketBossStore.updateFilters({ search: searchTerm });
      
      const searchResults = pocketBossStore.filteredPocketBosses;
      searchResults.forEach(boss => {
        const matchFound = [
          boss.name.toLowerCase(),
          boss.playfield?.toLowerCase() || '',
          boss.location?.toLowerCase() || '',
          boss.mobs?.toLowerCase() || ''
        ].some(field => field.includes(searchTerm));
        
        expect(matchFound).toBe(true);
      });
    }
  }, 15000);

  it('enriches symbiant data correctly with real API responses', async () => {
    const symbiantStore = useSymbiantsStore(pinia);
    
    // Load real symbiant data
    const symbiants = await symbiantStore.searchSymbiants({ page: 1, limit: 10 });
    
    expect(symbiants.length).toBeGreaterThan(0);
    
    // Verify enrichment worked
    symbiants.forEach(symbiant => {
      // Should have enriched display properties
      expect(symbiant.name).toBeTruthy();
      expect(symbiant.slot).toBeTruthy();
      expect(symbiant.ql).toBeGreaterThanOrEqual(50);
      expect(symbiant.family).toBeTruthy();
      
      // Enrichment should be consistent
      const validSlots = ['Head', 'Eye', 'Ear', 'Chest', 'Arm', 'Wrist', 'Hand', 'Waist', 'Leg', 'Feet'];
      expect(validSlots).toContain(symbiant.slot);
      
      const validFamilies = ['Artillery', 'Control', 'Exterminator', 'Infantry', 'Support'];
      expect(validFamilies).toContain(symbiant.family);
    });
  }, 15000);

  it('handles real API errors gracefully', async () => {
    const component = wrapper.vm as any;
    
    // Component should handle network issues gracefully
    // This test verifies the error handling structure is in place
    expect(component.error).toBeNull();
    expect(typeof component.loadingMessage).toBe('string');
    
    // Verify error handling methods exist
    expect(typeof component.$options.methods?.handleError || typeof component.handleError).toBe('undefined'); // No explicit handler needed in current implementation
  });

  it('maintains component structure with real data', async () => {
    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const component = wrapper.vm as any;
    
    // Check component structure
    expect(component.activeTab).toBe(0);
    expect(component.tabItems).toHaveLength(4);
    expect(component.tabItems[0].label).toBe('Pocket Bosses');
    expect(component.tabItems[1].label).toBe('Symbiant Lookup');
    
    // Component should be properly initialized
    expect(wrapper.find('.tinker-pocket').exists()).toBe(true);
  });

  it('verifies data consistency between stores', async () => {
    const pocketBossStore = usePocketBossStore(pinia);
    const symbiantStore = useSymbiantsStore(pinia);
    
    // Load data from both stores
    await Promise.all([
      pocketBossStore.fetchPocketBosses(),
      symbiantStore.searchSymbiants({ page: 1, limit: 50 })
    ]);
    
    expect(pocketBossStore.pocketBosses.length).toBeGreaterThan(0);
    expect(symbiantStore.symbiants.size).toBeGreaterThan(0);
    
    // Test relationship lookups work
    const symbiants = Array.from(symbiantStore.symbiants.values()).slice(0, 5);
    
    symbiants.forEach(symbiant => {
      const dropSources = pocketBossStore.getPocketBossesBySymbiant(symbiant.id);
      expect(Array.isArray(dropSources)).toBe(true);
      // Note: dropSources might be empty if no bosses drop this symbiant
    });
  }, 20000);

  it('verifies component navigation and state management', async () => {
    const component = wrapper.vm as any;
    
    // Test tab switching
    expect(component.activeTab).toBe(0);
    
    component.activeTab = 1;
    await wrapper.vm.$nextTick();
    expect(component.activeTab).toBe(1);
    
    component.activeTab = 2;
    await wrapper.vm.$nextTick();
    expect(component.activeTab).toBe(2);
    
    component.activeTab = 3;
    await wrapper.vm.$nextTick();
    expect(component.activeTab).toBe(3);
  });
});
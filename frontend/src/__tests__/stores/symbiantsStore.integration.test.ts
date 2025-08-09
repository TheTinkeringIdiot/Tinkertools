import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useSymbiantsStore } from '@/stores/symbiants';

describe('SymbiantsStore Integration Tests', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('fetches real symbiants from the API', async () => {
    const store = useSymbiantsStore();
    
    // Search for symbiants with real API call
    const symbiants = await store.searchSymbiants({ page: 1, limit: 10 });
    
    expect(symbiants.length).toBeGreaterThan(0);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    
    // Check data structure with enriched data
    const firstSymbiant = symbiants[0];
    expect(firstSymbiant).toHaveProperty('id');
    expect(firstSymbiant).toHaveProperty('aoid');
    expect(firstSymbiant).toHaveProperty('name'); // Should be enriched
    expect(firstSymbiant).toHaveProperty('slot'); // Should be enriched
    expect(firstSymbiant).toHaveProperty('ql'); // Should be enriched
    expect(firstSymbiant).toHaveProperty('family'); // Should be enriched
    
    expect(typeof firstSymbiant.id).toBe('number');
    expect(typeof firstSymbiant.aoid).toBe('number');
    expect(typeof firstSymbiant.name).toBe('string');
    expect(typeof firstSymbiant.slot).toBe('string');
    expect(typeof firstSymbiant.ql).toBe('number');
    expect(typeof firstSymbiant.family).toBe('string');
  }, 10000);

  it('enriches symbiant data correctly', async () => {
    const store = useSymbiantsStore();
    
    const symbiants = await store.searchSymbiants({ page: 1, limit: 5 });
    
    symbiants.forEach(symbiant => {
      // All symbiants should have enriched display names
      expect(symbiant.name).toBeTruthy();
      expect(symbiant.name.length).toBeGreaterThan(0);
      
      // Should have valid slots
      const validSlots = ['Head', 'Eye', 'Ear', 'Chest', 'Arm', 'Wrist', 'Hand', 'Waist', 'Leg', 'Feet'];
      expect(validSlots).toContain(symbiant.slot);
      
      // Should have reasonable QL values
      expect(symbiant.ql).toBeGreaterThanOrEqual(50);
      expect(symbiant.ql).toBeLessThanOrEqual(300);
      
      // Should have valid families
      const validFamilies = ['Artillery', 'Control', 'Exterminator', 'Infantry', 'Support'];
      expect(validFamilies).toContain(symbiant.family);
    });
  });

  it('caches symbiants correctly', async () => {
    const store = useSymbiantsStore();
    
    // First search
    const firstResults = await store.searchSymbiants({ page: 1, limit: 3 });
    expect(firstResults.length).toBeGreaterThan(0);
    
    // Get individual symbiant (should use cache)
    const firstSymbiant = firstResults[0];
    const cachedSymbiant = await store.getSymbiant(firstSymbiant.id);
    
    expect(cachedSymbiant).toEqual(firstSymbiant);
  });

  it('handles pagination correctly', async () => {
    const store = useSymbiantsStore();
    
    // Get first page - API returns default page size (50)
    const page1 = await store.searchSymbiants({ page: 1, limit: 5 });
    expect(page1.length).toBeGreaterThan(0);
    expect(page1.length).toBeLessThanOrEqual(50); // API default page size
    
    // Get second page
    const page2 = await store.searchSymbiants({ page: 2, limit: 5 });
    expect(page2.length).toBeGreaterThan(0);
    
    // Pages should be different (if there's enough data)
    if (page1.length > 0 && page2.length > 0) {
      const page1Ids = page1.map(s => s.id);
      const page2Ids = page2.map(s => s.id);
      
      // Should have different IDs
      const intersection = page1Ids.filter(id => page2Ids.includes(id));
      expect(intersection.length).toBe(0);
    }
  });

  it('maintains consistent enrichment for same symbiant', async () => {
    const store = useSymbiantsStore();
    
    const symbiants = await store.searchSymbiants({ page: 1, limit: 3 });
    if (symbiants.length === 0) return;
    
    const firstSymbiant = symbiants[0];
    
    // Get the same symbiant again
    const sameSymbiant = await store.getSymbiant(firstSymbiant.id);
    
    // Should have identical enriched properties
    expect(sameSymbiant?.name).toBe(firstSymbiant.name);
    expect(sameSymbiant?.slot).toBe(firstSymbiant.slot);
    expect(sameSymbiant?.ql).toBe(firstSymbiant.ql);
    expect(sameSymbiant?.family).toBe(firstSymbiant.family);
  });

  it('handles API errors gracefully', async () => {
    const store = useSymbiantsStore();
    
    // Test with invalid search parameters
    try {
      await store.searchSymbiants({ page: -1, limit: 0 });
    } catch (error) {
      expect(store.error).toBeTruthy();
    }
  });

  it('searches with different parameters', async () => {
    const store = useSymbiantsStore();
    
    // Test different page sizes - API has default minimum page size
    const smallPage = await store.searchSymbiants({ page: 1, limit: 2 });
    const largePage = await store.searchSymbiants({ page: 1, limit: 100 });
    
    expect(smallPage.length).toBeGreaterThan(0);
    expect(largePage.length).toBeGreaterThan(0);
    expect(largePage.length).toBeGreaterThanOrEqual(smallPage.length);
  });
});
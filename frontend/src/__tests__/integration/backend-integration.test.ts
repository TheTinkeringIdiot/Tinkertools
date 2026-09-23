/**
 * Backend Integration Tests
 *
 * TRUE INTEGRATION TEST - Requires real backend
 * Tests backend integration with nano store
 *
 * Strategy: Skip when backend not available (Option B)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useNanosStore } from '@/stores/nanosStore';
import { apiBaseFor } from '@/services/api-config';
import { isBackendAvailable } from '../helpers/backend-check';
import { TEST_VERSION } from '../helpers/version-fixtures';

// Top-level await: describe.skipIf reads this while tests are collected.
const BACKEND_AVAILABLE = await isBackendAvailable();

describe.skipIf(!BACKEND_AVAILABLE)('Backend Integration Tests', () => {
  let store: ReturnType<typeof useNanosStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useNanosStore();
    vi.clearAllMocks();
  });

  it('fetches real nano data from new backend endpoint', async () => {
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

    // Verify nano structure matches what we expect
    const firstNano = store.nanos[0];
    expect(firstNano).toHaveProperty('id');
    expect(firstNano).toHaveProperty('name');
    expect(firstNano).toHaveProperty('ql', firstNano.qualityLevel); // qualityLevel mirrors ql
    expect(firstNano).toHaveProperty('school');
    expect(firstNano).toHaveProperty('actions');
    expect(Array.isArray(firstNano.actions)).toBe(true);

    console.log('Sample nano data:', {
      name: firstNano.name,
      school: firstNano.school,
      ql: firstNano.qualityLevel,
      actions: firstNano.actions?.length || 0,
    });
  }, 10000);

  it('searches nanos using backend search endpoint', async () => {
    // Test search functionality
    await store.searchNanos('heal');

    expect(store.searchHistory).toContain('heal');
    expect(store.loading).toBe(false);
    expect(store.nanos.length).toBeGreaterThanOrEqual(0);

    // Check if any nano names contain 'heal'
    const healNanos = store.nanos.filter((nano) => nano.name.toLowerCase().includes('heal'));

    expect(healNanos.length).toBeGreaterThan(0);
    console.log(`Found ${healNanos.length} nanos matching 'heal'`);
  }, 10000);

  it('handles school filtering correctly', async () => {
    // First get all nanos to see available schools
    await store.fetchNanos();

    const availableSchools = store.availableSchools;
    console.log('Available schools:', availableSchools);

    // If we have schools, test filtering by one
    if (availableSchools.length > 0) {
      const testSchool = availableSchools[0];
      console.log(`Testing filter for school: ${testSchool}`);

      // Filter by first available school
      const schoolNanos = store.getNanosBySchool(testSchool);
      expect(Array.isArray(schoolNanos)).toBe(true);

      // All returned nanos should have the test school
      schoolNanos.forEach((nano) => {
        expect(nano.school).toBe(testSchool);
      });
    }
  }, 10000);

  it('maps backend field names correctly', async () => {
    await store.fetchNanos();
    expect(store.nanos.length).toBeGreaterThan(0);

    const nano = store.nanos[0];

    // Test field mapping from backend snake_case to frontend camelCase
    if (nano.castingTime !== null) {
      expect(typeof nano.castingTime).toBe('number');
    }
    if (nano.rechargeTime !== null) {
      expect(typeof nano.rechargeTime).toBe('number');
    }
    if (nano.memoryUsage !== null) {
      expect(typeof nano.memoryUsage).toBe('number');
    }
    if (nano.nanoPointCost !== null) {
      expect(typeof nano.nanoPointCost).toBe('number');
    }

    // qualityLevel should be mapped from ql
    expect(nano).toHaveProperty('ql', nano.qualityLevel);
  }, 10000);

  it('gets nano statistics from backend', async () => {
    const response = await fetch(`${apiBaseFor(TEST_VERSION)}/nanos/stats`);
    expect(response.ok).toBe(true);

    const stats = await response.json();

    expect(stats).toHaveProperty('total_nanos');
    expect(stats).toHaveProperty('schools');
    expect(stats).toHaveProperty('strains');
    expect(stats).toHaveProperty('professions');
    expect(stats).toHaveProperty('level_range');
    expect(stats).toHaveProperty('quality_level_range');

    expect(typeof stats.total_nanos).toBe('number');
    expect(Array.isArray(stats.schools)).toBe(true);
    expect(Array.isArray(stats.strains)).toBe(true);
  }, 10000);
});

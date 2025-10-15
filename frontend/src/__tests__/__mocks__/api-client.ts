/**
 * Mock API Client for Integration Tests
 *
 * This mock is automatically used when vi.mock('@/services/api-client') is called.
 * It provides a mock implementation of all API client methods.
 */

import { vi } from 'vitest';

// Create mock functions for all API client methods
export const mockApiClient = {
  // Items
  getItem: vi.fn(),
  interpolateItem: vi.fn(),
  searchItems: vi.fn(),
  getItems: vi.fn(),
  filterItems: vi.fn(),
  checkItemCompatibility: vi.fn(),
  getInterpolationInfo: vi.fn(),
  checkItemInterpolatable: vi.fn(),
  getInterpolationRange: vi.fn(),
  interpolateItemByRequest: vi.fn(),

  // Nanos/Spells
  getNano: vi.fn(),
  searchNanos: vi.fn(),
  getNanoStats: vi.fn(),
  getSpell: vi.fn(),
  searchSpells: vi.fn(),

  // Symbiants
  getSymbiant: vi.fn(),
  searchSymbiants: vi.fn(),
  getSymbiantDroppedBy: vi.fn(),

  // Mobs/Pocket Bosses
  searchMobs: vi.fn(),
  getMob: vi.fn(),
  getMobDrops: vi.fn(),
  searchPocketBosses: vi.fn(),
  getPocketBoss: vi.fn(),
  getPocketBossDrops: vi.fn(),

  // Implants
  lookupImplant: vi.fn(),
  getAvailableImplants: vi.fn(),
  validateClusters: vi.fn(),

  // Perks
  lookupPerkByAoid: vi.fn(),

  // Stat Values
  getStatValues: vi.fn(),

  // Health
  healthCheck: vi.fn(),
};

// Export as both named and default
export const apiClient = mockApiClient;
export default mockApiClient;

/**
 * Mock API Client for Integration Tests
 *
 * This mock is automatically used when vi.mock('@/services/api-client') is called.
 * It provides a mock implementation of all API client methods with proper promise responses.
 */

import { vi } from 'vitest';

// Helper to create successful API response
const createSuccessResponse = (data: any = null) =>
  Promise.resolve({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'mock-request-id',
      version: 'v1',
    },
  });

// Helper to create paginated response
const createPaginatedResponse = (items: any[] = [], total = 0) =>
  Promise.resolve({
    success: true,
    data: items,
    pagination: {
      page: 1,
      page_size: 20,
      total_pages: Math.ceil(total / 20),
      total_items: total,
      has_next: false,
      has_previous: false,
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: 'mock-request-id',
      version: 'v1',
    },
  });

// Create mock functions for all API client methods with default responses
export const mockApiClient = {
  // Items
  getItem: vi.fn(() => createSuccessResponse(null)),
  interpolateItem: vi.fn(() => createSuccessResponse({ item: null })),
  searchItems: vi.fn(() => createPaginatedResponse([])),
  getItems: vi.fn(() => createPaginatedResponse([])),
  filterItems: vi.fn(() => createPaginatedResponse([])),
  checkItemCompatibility: vi.fn(() => createSuccessResponse({ compatible: true })),
  getInterpolationInfo: vi.fn(() =>
    createSuccessResponse({
      aoid: 0,
      interpolatable: false,
      min_ql: 0,
      max_ql: 0,
      ql_range: 0,
    })
  ),
  checkItemInterpolatable: vi.fn(() => Promise.resolve(false)),
  getInterpolationRange: vi.fn(() => createSuccessResponse({ min: 0, max: 0 })),
  interpolateItemByRequest: vi.fn(() => createSuccessResponse({ item: null })),

  // Nanos/Spells
  getNano: vi.fn(() => createSuccessResponse(null)),
  searchNanos: vi.fn(() => createPaginatedResponse([])),
  getNanoStats: vi.fn(() => createSuccessResponse([])),
  getSpell: vi.fn(() => createSuccessResponse(null)),
  searchSpells: vi.fn(() => createPaginatedResponse([])),

  // Symbiants
  getSymbiant: vi.fn(() => createSuccessResponse(null)),
  searchSymbiants: vi.fn(() => createPaginatedResponse([])),
  getSymbiantDroppedBy: vi.fn(() => createSuccessResponse([])),

  // Mobs/Pocket Bosses
  searchMobs: vi.fn(() => createPaginatedResponse([])),
  getMob: vi.fn(() => createSuccessResponse(null)),
  getMobDrops: vi.fn(() => createSuccessResponse([])),
  searchPocketBosses: vi.fn(() => createPaginatedResponse([])),
  getPocketBoss: vi.fn(() => createSuccessResponse(null)),
  getPocketBossDrops: vi.fn(() => createSuccessResponse([])),

  // Implants
  lookupImplant: vi.fn(() => createSuccessResponse(null)),
  getAvailableImplants: vi.fn(() => createSuccessResponse([])),
  validateClusters: vi.fn(() => createSuccessResponse({ valid: true })),

  // Perks
  lookupPerkByAoid: vi.fn(() => createSuccessResponse(null)),

  // Stat Values
  getStatValues: vi.fn(() => createPaginatedResponse([])),

  // Health
  healthCheck: vi.fn(() => createSuccessResponse({ status: 'ok', timestamp: new Date().toISOString() })),
};

// Export as both named and default
export const apiClient = mockApiClient;
export default mockApiClient;

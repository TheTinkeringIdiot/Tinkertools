/**
 * Pagination Integration Tests
 *
 * TRUE INTEGRATION TEST - Requires real backend
 * Tests pagination functionality using the real backend
 * Verifies that the offset calculation fix works correctly end-to-end
 *
 * Strategy: Skip when backend not available (Option B)
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { apiClient } from '../services/api-client'
import type { ItemSearchQuery } from '../types/api'
import { isBackendAvailable } from './helpers/backend-check'

// Check backend availability before running tests
let BACKEND_AVAILABLE = false

beforeAll(async () => {
  BACKEND_AVAILABLE = await isBackendAvailable()
  if (!BACKEND_AVAILABLE) {
    console.warn('Backend not available - skipping pagination integration tests')
  }
})

// Real integration tests using the backend
describe.skipIf(!BACKEND_AVAILABLE)('Pagination Integration Tests', () => {

  describe('API Client Pagination Response', () => {
    it('should return pagination with correct offset for page 1', async () => {
      const query: ItemSearchQuery = {
        search: 'weapon',
        page: 1,
        limit: 6  // Small limit for testing
      }

      const result = await apiClient.searchItems(query)
      
      expect(result.success).toBe(true)
      expect(result.pagination).toBeDefined()
      expect(result.pagination?.page).toBe(1)
      expect(result.pagination?.limit).toBe(6)
      expect(result.pagination?.offset).toBe(0) // (1-1) * 6 = 0
    })

    it('should return pagination with correct offset for page 2', async () => {
      const query: ItemSearchQuery = {
        search: 'weapon',
        page: 2,
        limit: 6
      }

      const result = await apiClient.searchItems(query)
      
      expect(result.success).toBe(true)
      expect(result.pagination).toBeDefined()
      expect(result.pagination?.page).toBe(2)
      expect(result.pagination?.limit).toBe(6)
      expect(result.pagination?.offset).toBe(6) // (2-1) * 6 = 6
    })

    it('should return pagination with correct offset for page 3', async () => {
      const query: ItemSearchQuery = {
        search: 'weapon',
        page: 3,
        limit: 6
      }

      const result = await apiClient.searchItems(query)
      
      expect(result.success).toBe(true)
      expect(result.pagination).toBeDefined()
      expect(result.pagination?.page).toBe(3)
      expect(result.pagination?.limit).toBe(6)
      expect(result.pagination?.offset).toBe(12) // (3-1) * 6 = 12
    })

    it('should handle different page sizes correctly', async () => {
      const query: ItemSearchQuery = {
        search: 'implant',
        page: 2,
        limit: 10
      }

      const result = await apiClient.searchItems(query)
      
      expect(result.success).toBe(true)
      expect(result.pagination).toBeDefined()
      expect(result.pagination?.page).toBe(2)
      expect(result.pagination?.limit).toBe(10)
      expect(result.pagination?.offset).toBe(10) // (2-1) * 10 = 10
    })

    it('should work with filter queries as well', async () => {
      const query: ItemSearchQuery = {
        item_class: [3], // Weapon class
        page: 2,
        limit: 8
      }

      const result = await apiClient.searchItems(query)
      
      expect(result.success).toBe(true)
      expect(result.pagination).toBeDefined()
      expect(result.pagination?.page).toBe(2)
      expect(result.pagination?.limit).toBe(8)
      expect(result.pagination?.offset).toBe(8) // (2-1) * 8 = 8
    })
  })

  describe('Multi-page Sequence Tests', () => {
    it('should maintain consistent pagination across page navigation', async () => {
      const baseQuery = {
        search: 'nano',
        limit: 5
      }

      // Test pages 1, 2, 3 in sequence
      const pages = [1, 2, 3]
      const results = []

      for (const page of pages) {
        const query: ItemSearchQuery = { ...baseQuery, page }
        const result = await apiClient.searchItems(query)
        
        expect(result.success).toBe(true)
        expect(result.pagination?.page).toBe(page)
        expect(result.pagination?.limit).toBe(5)
        expect(result.pagination?.offset).toBe((page - 1) * 5)
        
        results.push(result)
      }

      // Verify we get different items on different pages (no overlapping IDs)
      const page1Ids = results[0].data?.map(item => item.id) || []
      const page2Ids = results[1].data?.map(item => item.id) || []
      const page3Ids = results[2].data?.map(item => item.id) || []

      // Check no overlap between pages
      const overlap12 = page1Ids.some(id => page2Ids.includes(id))
      const overlap23 = page2Ids.some(id => page3Ids.includes(id))
      
      expect(overlap12).toBe(false)
      expect(overlap23).toBe(false)
    })

    it('should handle pagination metadata correctly', async () => {
      const query: ItemSearchQuery = {
        search: 'armor',
        page: 1,
        limit: 12
      }

      const result = await apiClient.searchItems(query)
      
      expect(result.success).toBe(true)
      expect(result.pagination).toBeDefined()
      
      const pagination = result.pagination!
      
      // Verify all pagination fields are present and correct
      expect(pagination.page).toBe(1)
      expect(pagination.limit).toBe(12)
      expect(pagination.offset).toBe(0)
      expect(typeof pagination.total).toBe('number')
      expect(pagination.total).toBeGreaterThan(0)
      expect(typeof pagination.hasNext).toBe('boolean')
      expect(typeof pagination.hasPrev).toBe('boolean')
      expect(pagination.hasPrev).toBe(false) // Page 1 should have no previous page
      
      if (pagination.total > 12) {
        expect(pagination.hasNext).toBe(true)
      }
    })
  })

  describe('Edge Cases', () => {
    it('should handle page 1 with no previous page', async () => {
      const query: ItemSearchQuery = {
        search: 'test',
        page: 1,
        limit: 20
      }

      const result = await apiClient.searchItems(query)
      
      expect(result.success).toBe(true)
      expect(result.pagination?.hasPrev).toBe(false)
      expect(result.pagination?.offset).toBe(0)
    })

    it('should handle large page numbers correctly', async () => {
      // First, get total count to find a valid large page
      const firstPageQuery: ItemSearchQuery = {
        search: 'item',
        page: 1,
        limit: 10
      }

      const firstResult = await apiClient.searchItems(firstPageQuery)
      
      if (firstResult.success && firstResult.pagination && firstResult.pagination.total > 30) {
        // Try a higher page number
        const largePageQuery: ItemSearchQuery = {
          search: 'item',
          page: 4,
          limit: 10
        }

        const result = await apiClient.searchItems(largePageQuery)
        
        expect(result.success).toBe(true)
        expect(result.pagination?.page).toBe(4)
        expect(result.pagination?.offset).toBe(30) // (4-1) * 10 = 30
      }
    })

    it('should handle different search terms maintaining pagination', async () => {
      const searches = ['weapon', 'armor', 'nano']
      
      for (const searchTerm of searches) {
        const query: ItemSearchQuery = {
          search: searchTerm,
          page: 2,
          limit: 8
        }

        const result = await apiClient.searchItems(query)
        
        if (result.success && result.data && result.data.length > 0) {
          expect(result.pagination?.page).toBe(2)
          expect(result.pagination?.offset).toBe(8)
          expect(result.pagination?.limit).toBe(8)
        }
      }
    })
  })

  describe('Pagination Calculation Verification', () => {
    it('should calculate pagination info correctly for various scenarios', async () => {
      const scenarios = [
        { page: 1, limit: 24, expectedOffset: 0 },
        { page: 2, limit: 24, expectedOffset: 24 },
        { page: 3, limit: 12, expectedOffset: 24 },
        { page: 5, limit: 10, expectedOffset: 40 },
        { page: 1, limit: 50, expectedOffset: 0 }
      ]

      for (const scenario of scenarios) {
        const query: ItemSearchQuery = {
          search: 'test',
          page: scenario.page,
          limit: scenario.limit
        }

        const result = await apiClient.searchItems(query)
        
        expect(result.success).toBe(true)
        expect(result.pagination?.page).toBe(scenario.page)
        expect(result.pagination?.limit).toBe(scenario.limit)
        expect(result.pagination?.offset).toBe(scenario.expectedOffset)
      }
    })
  })
})
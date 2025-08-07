/**
 * Items Store Tests
 * 
 * Tests for the items Pinia store functionality
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useItemsStore } from '../../stores/items'
import { apiClient } from '../../services/api-client'
import type { Item, PaginatedResponse } from '../../types/api'

// Mock the API client
vi.mock('../../services/api-client')
const mockedApiClient = vi.mocked(apiClient)

// Mock data
const mockItem: Item = {
  id: 1,
  aoid: 12345,
  name: 'Test Item',
  ql: 200,
  description: 'A test item for unit testing',
  item_class: 3,
  is_nano: false,
  stats: [
    { id: 1, stat: 1, value: 100 }, // Health
    { id: 2, stat: 17, value: 300 }  // Strength
  ],
  spell_data: [],
  actions: [],
  attack_defense: null,
  animation_mesh: null
}

const mockNanoItem: Item = {
  ...mockItem,
  id: 2,
  aoid: 54321,
  name: 'Test Nano',
  is_nano: true,
  item_class: 0
}

const mockSearchResponse: PaginatedResponse<Item> = {
  success: true,
  data: [mockItem],
  pagination: {
    page: 1,
    limit: 25,
    total: 1,
    hasNext: false,
    hasPrev: false
  }
}

describe('Items Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Initial State', () => {
    it('should have empty initial state', () => {
      const store = useItemsStore()
      
      expect(store.allItems).toEqual([])
      expect(store.itemsCount).toBe(0)
      expect(store.loading).toBe(false)
      expect(store.error).toBe(null)
      expect(store.currentSearchResults).toEqual([])
    })
  })

  describe('Search Items', () => {
    it('should search items and update state', async () => {
      mockedApiClient.searchItems.mockResolvedValue(mockSearchResponse)
      
      const store = useItemsStore()
      const query = { search: 'test', limit: 25 }
      
      const results = await store.searchItems(query)
      
      expect(mockedApiClient.searchItems).toHaveBeenCalledWith(query)
      expect(results).toEqual([mockItem])
      expect(store.currentSearchResults).toEqual([mockItem])
      expect(store.loading).toBe(false)
    })

    it('should handle search errors', async () => {
      const errorResponse = {
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: 'Search failed'
        }
      }
      
      mockedApiClient.searchItems.mockResolvedValue(errorResponse as any)
      
      const store = useItemsStore()
      
      try {
        await store.searchItems({ search: 'fail' })
      } catch (error: any) {
        expect(error.message).toBe('Search failed')
        expect(store.error).toBeTruthy()
      }
    })

    it('should use cached search results', async () => {
      mockedApiClient.searchItems.mockResolvedValue(mockSearchResponse)
      
      const store = useItemsStore()
      const query = { search: 'test', limit: 25 }
      
      // First search
      await store.searchItems(query)
      expect(mockedApiClient.searchItems).toHaveBeenCalledTimes(1)
      
      // Second search with same query should use cache
      await store.searchItems(query, false)
      expect(mockedApiClient.searchItems).toHaveBeenCalledTimes(1)
      
      // Force refresh should bypass cache
      await store.searchItems(query, true)
      expect(mockedApiClient.searchItems).toHaveBeenCalledTimes(2)
    })
  })

  describe('Get Single Item', () => {
    it('should get item by ID', async () => {
      mockedApiClient.getItem.mockResolvedValue({
        success: true,
        data: mockItem
      })
      
      const store = useItemsStore()
      const result = await store.getItem(1)
      
      expect(mockedApiClient.getItem).toHaveBeenCalledWith(1)
      expect(result).toEqual(mockItem)
      expect(store.items.get(1)).toEqual(mockItem)
    })

    it('should return cached item if available', async () => {
      const store = useItemsStore()
      
      // First populate cache by getting an item successfully
      mockedApiClient.getItem.mockResolvedValueOnce({
        success: true,
        data: mockItem
      })
      
      await store.getItem(1)
      expect(mockedApiClient.getItem).toHaveBeenCalledTimes(1)
      
      // Now call again - should use cache
      const result = await store.getItem(1)
      
      expect(mockedApiClient.getItem).toHaveBeenCalledTimes(1) // Still only 1 call
      expect(result).toEqual(mockItem)
    })

    it('should handle item not found', async () => {
      mockedApiClient.getItem.mockResolvedValue({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Item not found'
        }
      })
      
      const store = useItemsStore()
      const result = await store.getItem(999)
      
      expect(result).toBe(null)
      expect(store.error).toBeTruthy()
    })
  })

  describe('Get Multiple Items', () => {
    it('should get multiple items by IDs', async () => {
      mockedApiClient.getItems.mockResolvedValue({
        success: true,
        data: [mockItem, mockNanoItem]
      })
      
      const store = useItemsStore()
      const results = await store.getItems([1, 2])
      
      expect(mockedApiClient.getItems).toHaveBeenCalledWith([1, 2])
      expect(results).toEqual([mockItem, mockNanoItem])
      expect(store.items.has(1)).toBe(true)
      expect(store.items.has(2)).toBe(true)
    })

    it('should use cached items when available', async () => {
      const store = useItemsStore()
      
      // Pre-populate cache with one item
      store.items.set(1, mockItem)
      
      // Mock API to return only the missing item
      mockedApiClient.getItems.mockResolvedValue({
        success: true,
        data: [mockNanoItem]
      })
      
      const results = await store.getItems([1, 2])
      
      expect(mockedApiClient.getItems).toHaveBeenCalledWith([2])
      expect(results).toHaveLength(2)
      expect(results[0]).toEqual(mockItem)
      expect(results[1]).toEqual(mockNanoItem)
    })
  })

  describe('Computed Properties', () => {
    it('should filter nano items', async () => {
      const store = useItemsStore()
      
      // Populate cache by getting items
      mockedApiClient.getItem
        .mockResolvedValueOnce({ success: true, data: mockItem })
        .mockResolvedValueOnce({ success: true, data: mockNanoItem })
      
      await store.getItem(1)
      await store.getItem(2)
      
      expect(store.nanoItems).toEqual([mockNanoItem])
      expect(store.regularItems).toEqual([mockItem])
    })

    it('should filter items by class', async () => {
      const store = useItemsStore()
      
      // Populate cache by getting items
      mockedApiClient.getItem
        .mockResolvedValueOnce({ success: true, data: mockItem })
        .mockResolvedValueOnce({ success: true, data: mockNanoItem })
      
      await store.getItem(1)
      await store.getItem(2)
      
      expect(store.itemsByClass(3)).toEqual([mockItem])
      expect(store.itemsByClass(0)).toEqual([mockNanoItem])
    })

    it('should count items correctly', async () => {
      const store = useItemsStore()
      
      expect(store.itemsCount).toBe(0)
      
      // Populate cache by getting items
      mockedApiClient.getItem
        .mockResolvedValueOnce({ success: true, data: mockItem })
        .mockResolvedValueOnce({ success: true, data: mockNanoItem })
      
      await store.getItem(1)
      await store.getItem(2)
      
      expect(store.itemsCount).toBe(2)
    })
  })

  describe('Filter Items', () => {
    it('should filter items by advanced criteria', async () => {
      const filterRequest = {
        stat_requirements: [
          { stat: 17, operator: 'gte' as const, value: 200 }
        ],
        min_ql: 100
      }
      
      mockedApiClient.filterItems.mockResolvedValue(mockSearchResponse)
      
      const store = useItemsStore()
      const results = await store.filterItems(filterRequest)
      
      expect(mockedApiClient.filterItems).toHaveBeenCalledWith(filterRequest)
      expect(results).toEqual([mockItem])
    })
  })

  describe('Stats-based Search', () => {
    it('should find items with specific stats', () => {
      const store = useItemsStore()
      
      store.items.set(1, mockItem)
      store.items.set(2, mockNanoItem)
      
      const results = store.getItemsWithStats([
        { stat: 1, minValue: 50 },  // Health >= 50
        { stat: 17, minValue: 250 } // Strength >= 250
      ])
      
      expect(results).toEqual([mockItem])
    })

    it('should handle stat range filters', () => {
      const store = useItemsStore()
      
      store.items.set(1, mockItem)
      
      const results = store.getItemsWithStats([
        { stat: 1, minValue: 50, maxValue: 150 } // Health 50-150
      ])
      
      expect(results).toEqual([mockItem])
      
      const noResults = store.getItemsWithStats([
        { stat: 1, minValue: 150, maxValue: 200 } // Health 150-200 (mockItem has 100)
      ])
      
      expect(noResults).toEqual([])
    })
  })

  describe('Cache Management', () => {
    it('should clear search results', () => {
      const store = useItemsStore()
      
      // Simulate search results
      store.searchResults = {
        query: { search: 'test' },
        results: [mockItem],
        pagination: mockSearchResponse.pagination!,
        timestamp: Date.now()
      }
      
      store.clearSearch()
      
      expect(store.searchResults).toBe(null)
      expect(store.currentSearchResults).toEqual([])
    })

    it('should clear all cached data', () => {
      const store = useItemsStore()
      
      store.items.set(1, mockItem)
      store.searchResults = {
        query: { search: 'test' },
        results: [mockItem],
        pagination: mockSearchResponse.pagination!,
        timestamp: Date.now()
      }
      
      store.clearCache()
      
      expect(store.items.size).toBe(0)
      expect(store.searchResults).toBe(null)
      expect(store.lastFetch).toBe(0)
    })

    it('should detect stale data', async () => {
      const store = useItemsStore()
      
      // Set last fetch to 20 minutes ago
      store.lastFetch = Date.now() - (20 * 60 * 1000)
      
      expect(store.isDataStale).toBe(true)
      
      // Set last fetch to 5 minutes ago
      store.lastFetch = Date.now() - (5 * 60 * 1000)
      
      expect(store.isDataStale).toBe(false)
    })
  })

  describe('Preload Common Items', () => {
    it('should preload high-quality items and nanos', async () => {
      mockedApiClient.searchItems
        .mockResolvedValueOnce(mockSearchResponse) // High QL items
        .mockResolvedValueOnce({ ...mockSearchResponse, data: [mockNanoItem] }) // Nanos
      
      const store = useItemsStore()
      await store.preloadCommonItems()
      
      expect(mockedApiClient.searchItems).toHaveBeenCalledTimes(2)
      expect(mockedApiClient.searchItems).toHaveBeenCalledWith({
        min_ql: 200,
        limit: 100,
        sort: 'ql',
        sort_order: 'desc'
      })
      expect(mockedApiClient.searchItems).toHaveBeenCalledWith({
        is_nano: true,
        limit: 50,
        sort: 'name'
      })
    })

    it('should not preload if data is recent', async () => {
      const store = useItemsStore()
      
      // Set recent data
      store.items.set(1, mockItem)
      store.lastFetch = Date.now()
      
      await store.preloadCommonItems()
      
      expect(mockedApiClient.searchItems).not.toHaveBeenCalled()
    })
  })
})
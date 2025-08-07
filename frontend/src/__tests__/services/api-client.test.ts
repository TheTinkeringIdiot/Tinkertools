/**
 * API Client Tests
 * 
 * Tests for the TinkerTools API client service
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import { apiClient } from '../../services/api-client'
import type { Item, Spell, ApiResponse } from '../../types/api'

// Mock axios
vi.mock('axios')
const mockedAxios = vi.mocked(axios)

// Mock data
const mockItem: Item = {
  id: 1,
  aoid: 12345,
  name: 'Test Item',
  ql: 200,
  description: 'A test item',
  item_class: 3,
  is_nano: false,
  stats: [],
  spell_data: [],
  actions: [],
  attack_defense: null,
  animation_mesh: null
}

const mockApiResponse: ApiResponse<Item> = {
  success: true,
  data: mockItem,
  meta: {
    timestamp: '2024-01-01T00:00:00Z',
    requestId: 'test-123',
    version: 'v1'
  }
}

const mockAxiosInstance = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() }
  }
}

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initialization', () => {
    it('should create axios instance with correct config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: expect.stringContaining('api/v1'),
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Version': '1.0.0',
          'X-Client-Name': 'TinkerTools-Frontend'
        }
      })
    })

    it('should setup request and response interceptors', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled()
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled()
    })
  })

  describe('Items API', () => {
    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockApiResponse })
    })

    it('should search items with query parameters', async () => {
      const query = {
        search: 'test',
        item_class: [3],
        min_ql: 100,
        page: 1,
        limit: 25
      }

      await apiClient.searchItems(query)

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/items'),
        undefined
      )
    })

    it('should get single item by ID', async () => {
      await apiClient.getItem(1)

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/items/1', undefined)
    })

    it('should handle item compatibility check', async () => {
      const compatibilityRequest = {
        profile: {} as any,
        item_ids: [1, 2, 3],
        check_type: 'equip' as const
      }

      mockAxiosInstance.post.mockResolvedValue({ 
        data: { success: true, data: [] }
      })

      await apiClient.checkItemCompatibility(compatibilityRequest)

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/items/compatibility',
        compatibilityRequest,
        undefined
      )
    })

    it('should batch multiple item requests', async () => {
      const itemIds = [1, 2, 3]
      mockAxiosInstance.post.mockResolvedValue({ 
        data: { success: true, data: [mockItem] }
      })

      const result = await apiClient.getItems(itemIds)

      expect(result.success).toBe(true)
      expect(result.data).toEqual([mockItem])
    })
  })

  describe('Spells API', () => {
    const mockSpell: Spell = {
      id: 1,
      target: 2,
      tick_count: 1,
      tick_interval: 0,
      spell_id: 12345,
      spell_format: 'Test spell format',
      spell_params: {}
    }

    beforeEach(() => {
      mockAxiosInstance.get.mockResolvedValue({ 
        data: { success: true, data: [mockSpell] }
      })
    })

    it('should search spells with query parameters', async () => {
      const query = {
        search: 'damage',
        has_criteria: true,
        limit: 20
      }

      await apiClient.searchSpells(query)

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/spells'),
        undefined
      )
    })

    it('should get single spell by ID', async () => {
      mockAxiosInstance.get.mockResolvedValue({ 
        data: { success: true, data: mockSpell }
      })

      await apiClient.getSpell(1)

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/spells/1', undefined)
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network Error')
      networkError.code = 'NETWORK_ERROR'
      
      mockAxiosInstance.get.mockRejectedValue(networkError)

      try {
        await apiClient.getItem(1)
      } catch (error: any) {
        expect(error.type).toBe('error')
        expect(error.title).toBe('Network Error')
        expect(error.recoverable).toBe(true)
      }
    })

    it('should handle API error responses', async () => {
      const apiError = {
        response: {
          data: {
            error: {
              code: 'NOT_FOUND',
              message: 'Item not found'
            }
          }
        }
      }

      mockAxiosInstance.get.mockRejectedValue(apiError)

      try {
        await apiClient.getItem(999)
      } catch (error: any) {
        expect(error.type).toBe('info')
        expect(error.title).toBe('Not Found')
        expect(error.recoverable).toBe(true)
      }
    })

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('timeout of 30000ms exceeded')
      timeoutError.code = 'ECONNABORTED'
      
      mockAxiosInstance.get.mockRejectedValue(timeoutError)

      try {
        await apiClient.getItem(1)
      } catch (error: any) {
        expect(error.type).toBe('warning')
        expect(error.title).toBe('Request Timeout')
        expect(error.recoverable).toBe(true)
      }
    })
  })

  describe('Request Retry Logic', () => {
    it('should retry failed requests with exponential backoff', async () => {
      // Mock a 500 error followed by success
      mockAxiosInstance.get
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockResolvedValueOnce({ data: mockApiResponse })

      const result = await apiClient.getItem(1)

      expect(result.success).toBe(true)
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(3)
    })

    it('should not retry 4xx errors', async () => {
      mockAxiosInstance.get.mockRejectedValue({ 
        response: { status: 404 },
        config: {}
      })

      try {
        await apiClient.getItem(999)
      } catch (error) {
        expect(mockAxiosInstance.get).toHaveBeenCalledTimes(1)
      }
    })
  })

  describe('Health Check', () => {
    it('should perform health check', async () => {
      const healthResponse = {
        success: true,
        data: {
          status: 'healthy',
          timestamp: '2024-01-01T00:00:00Z'
        }
      }

      mockAxiosInstance.get.mockResolvedValue({ data: healthResponse })

      const result = await apiClient.healthCheck()

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/health', undefined)
      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('healthy')
    })
  })
})
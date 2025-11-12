/**
 * Mock Axios for Tests
 *
 * Provides a complete mock of axios with interceptors, methods, and configuration.
 * This mock is automatically used when vi.mock('axios') is called in tests.
 */

import { vi } from 'vitest';

// Create mock axios instance with all necessary methods and properties
export const createMockAxiosInstance = () => ({
  get: vi.fn(() => Promise.resolve({ data: {}, status: 200 })),
  post: vi.fn(() => Promise.resolve({ data: {}, status: 200 })),
  put: vi.fn(() => Promise.resolve({ data: {}, status: 200 })),
  patch: vi.fn(() => Promise.resolve({ data: {}, status: 200 })),
  delete: vi.fn(() => Promise.resolve({ data: {}, status: 200 })),
  head: vi.fn(() => Promise.resolve({ data: {}, status: 200 })),
  options: vi.fn(() => Promise.resolve({ data: {}, status: 200 })),
  request: vi.fn(() => Promise.resolve({ data: {}, status: 200 })),

  // Interceptors with proper structure
  interceptors: {
    request: {
      use: vi.fn((onFulfilled, onRejected) => {
        // Return interceptor ID for eject
        return Math.random();
      }),
      eject: vi.fn(),
      clear: vi.fn(),
    },
    response: {
      use: vi.fn((onFulfilled, onRejected) => {
        // Return interceptor ID for eject
        return Math.random();
      }),
      eject: vi.fn(),
      clear: vi.fn(),
    },
  },

  // Default config
  defaults: {
    headers: {
      common: {},
      delete: {},
      get: {},
      head: {},
      post: {},
      put: {},
      patch: {},
    },
    baseURL: 'http://localhost:8000/api/v1',
    timeout: 30000,
  },

  // Utility methods
  getUri: vi.fn(),
});

// Mock axios.create to return a new mock instance
const mockCreate = vi.fn(() => createMockAxiosInstance());

// Main axios export with all methods
const mockAxios = {
  ...createMockAxiosInstance(),
  create: mockCreate,

  // Axios static methods
  isCancel: vi.fn(() => false),
  CancelToken: {
    source: vi.fn(() => ({
      token: {},
      cancel: vi.fn(),
    })),
  },
  Cancel: vi.fn(),
  isAxiosError: vi.fn(() => false),
  all: vi.fn((promises) => Promise.all(promises)),
  spread: vi.fn((callback) => callback),

  // Expose for test assertions
  mockCreate,
};

export default mockAxios;

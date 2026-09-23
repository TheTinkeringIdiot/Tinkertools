/**
 * Vitest Global Setup
 *
 * This file runs before all tests and configures the test environment.
 * Configure in vite.config.ts under test.setupFiles
 *
 * NOTE: Individual test files should still call vi.mock() for their specific mocks.
 * This setup file only provides default configurations and utilities.
 */

import { vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  ensureVersionsLoaded,
  setCurrentVersion,
  currentVersion,
} from '@/composables/useGameVersion';
import { TEST_VERSION, TEST_VERSION_REGISTRY } from './helpers/version-fixtures';

// ============================================================================
// Global Test Utilities
// ============================================================================

// Suppress console warnings in tests to reduce noise (optional)
// Comment out these lines if you need to debug console output
global.console = {
  ...console,
  warn: vi.fn(),
  // Keep error for important failures
  // error: vi.fn(),
};

// ============================================================================
// Global localStorage Mock
// ============================================================================

/**
 * Create a proper localStorage mock that works across all tests
 * This fixes issues where components try to access localStorage during mount
 */
function createLocalStorageMock() {
  const storage: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => storage[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      storage[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete storage[key];
    }),
    clear: vi.fn(() => {
      Object.keys(storage).forEach((key) => delete storage[key]);
    }),
    get length() {
      return Object.keys(storage).length;
    },
    key: vi.fn((index: number) => Object.keys(storage)[index] || null),
  };
}

// Install global localStorage mock
const localStorageMock = createLocalStorageMock();
Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// ============================================================================
// Game Version Registry
// ============================================================================

/**
 * Seed the version registry so nothing reaches the network for `GET /versions`,
 * and so cache keys and versioned route paths are deterministic.
 *
 * ensureVersionsLoaded() memoizes its promise for the lifetime of the module,
 * and Vitest gives every test file a fresh module registry, so resolving it
 * once here means no later call can trigger a real request.
 */
const versionsSpy = vi
  .spyOn(axios, 'get')
  .mockResolvedValue({ data: TEST_VERSION_REGISTRY } as any);

await ensureVersionsLoaded();
versionsSpy.mockRestore();

setCurrentVersion(TEST_VERSION);

// Clear localStorage before each test to prevent cross-test contamination
beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();

  // A version-switch test may have left another version active.
  if (currentVersion.value !== TEST_VERSION) {
    setCurrentVersion(TEST_VERSION);
  }
});

/**
 * Integration Test Utilities
 *
 * Helpers for integration tests that mount components with real stores.
 * Mock only external dependencies (API, localStorage), not internal behavior.
 */

import { mount, VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { vi, expect } from 'vitest';
import type { Component } from 'vue';
import { mockPrimeVueComponents, createTestRouter } from './vue-test-utils';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';

// ============================================================================
// API Client Mock Setup
// ============================================================================

/**
 * Get the mock API client instance
 * When vi.mock('@/services/api-client') is used, this will return the mocked version
 */
export async function getMockApiClient() {
  // Import the apiClient - it will be mocked if vi.mock() was called
  const apiClientModule = await import('@/services/api-client');
  return apiClientModule.apiClient || apiClientModule.default;
}

// ============================================================================
// Integration Test Setup
// ============================================================================

export interface IntegrationTestContext {
  pinia: Pinia;
  mockApi: any; // Mock API client from __mocks__/api-client.ts
  mockLocalStorage: ReturnType<typeof createMockLocalStorage>;
}

/**
 * Setup integration test context with real Pinia, mocked externals
 *
 * IMPORTANT: Use vi.mock('@/services/api-client') at the top of your test file
 * BEFORE importing any stores.
 *
 * @example
 * // At top of test file:
 * import { vi } from 'vitest';
 * vi.mock('@/services/api-client');
 *
 * import { setupIntegrationTest } from '../helpers/integration-test-utils';
 * import { useItemsStore } from '@/stores/items';
 *
 * let context: IntegrationTestContext;
 *
 * beforeEach(async () => {
 *   context = await setupIntegrationTest();
 * });
 */
export async function setupIntegrationTest(): Promise<IntegrationTestContext> {
  const pinia = createPinia();
  setActivePinia(pinia);

  const mockApi = await getMockApiClient();
  const mockLocalStorage = createMockLocalStorage();

  // Install localStorage mock globally
  Object.defineProperty(global, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  });

  return { pinia, mockApi, mockLocalStorage };
}

/**
 * Mount component for integration testing with real store context
 *
 * @example
 * const wrapper = mountForIntegration(BuffManagementPanel, {
 *   pinia: context.pinia,
 *   props: { profileId: 'test-id' }
 * });
 */
export function mountForIntegration(
  component: Component,
  options: {
    pinia: Pinia;
    props?: Record<string, any>;
    stubs?: Record<string, any>;
    routeParams?: Record<string, any>;
  }
): VueWrapper {
  const router = createTestRouter();

  // Set route params if provided
  if (options.routeParams) {
    router.push({ params: options.routeParams });
  }

  return mount(component, {
    props: options.props,
    global: {
      plugins: [PrimeVue, ToastService, options.pinia, router],
      components: mockPrimeVueComponents,
      stubs: {
        Toast: true,
        Tooltip: true,
        Ripple: true,
        ...options.stubs,
      },
      provide: {
        // Mock PrimeVue Toast provider
        [Symbol.for('primevue_toast')]: {
          add: vi.fn(),
          remove: vi.fn(),
          removeGroup: vi.fn(),
          removeAllGroups: vi.fn(),
        },
      },
    },
  });
}

// ============================================================================
// Mock External Dependencies
// ============================================================================

/**
 * Create mock localStorage for integration tests
 */
export function createMockLocalStorage() {
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

    // Utility to get raw storage for assertions
    __getStorage: () => storage,
  };
}

// ============================================================================
// Integration Test Assertions
// ============================================================================

/**
 * Wait for async operations and Vue updates
 */
export async function waitForUpdates(wrapper?: VueWrapper, ms: number = 10): Promise<void> {
  if (wrapper) {
    await wrapper.vm.$nextTick();
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for stat recalculation to complete after equipment changes
 *
 * In production, equipment changes are debounced by 100ms. In tests,
 * debouncing is disabled for speed, but we still need to wait for:
 * 1. requestAnimationFrame callback
 * 2. Async executeEquipmentUpdate()
 * 3. Vue reactivity updates
 *
 * @param wrapper Optional Vue wrapper to wait for its $nextTick
 */
export async function waitForStatRecalculation(wrapper?: VueWrapper): Promise<void> {
  if (wrapper) {
    await wrapper.vm.$nextTick();
  }

  // Wait for requestAnimationFrame + async execution
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  // Give enough time for async IP tracking recalculation
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (wrapper) {
    await wrapper.vm.$nextTick();
  }
}

/**
 * Assert that an element with test ID is visible
 */
export function expectVisible(wrapper: VueWrapper, testId: string) {
  const element = wrapper.find(`[data-testid="${testId}"]`);
  expect(element.exists()).toBe(true);
  expect(element.isVisible()).toBe(true);
}

/**
 * Assert that an element with test ID has specific text
 */
export function expectText(wrapper: VueWrapper, testId: string, expectedText: string) {
  const element = wrapper.find(`[data-testid="${testId}"]`);
  expect(element.exists()).toBe(true);
  expect(element.text()).toContain(expectedText);
}

/**
 * Trigger click and wait for updates
 */
export async function clickAndWait(wrapper: VueWrapper, testId: string) {
  await wrapper.find(`[data-testid="${testId}"]`).trigger('click');
  await waitForUpdates(wrapper);
}

/**
 * Type into input and wait for updates
 */
export async function typeAndWait(wrapper: VueWrapper, testId: string, value: string) {
  const input = wrapper.find(`[data-testid="${testId}"]`);
  await input.setValue(value);
  await waitForUpdates(wrapper);
}

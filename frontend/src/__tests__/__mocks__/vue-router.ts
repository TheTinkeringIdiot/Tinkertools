/**
 * Mock Vue Router for Tests
 *
 * Provides complete mock of vue-router with all exports needed by tests.
 * This mock is automatically used when vi.mock('vue-router') is called in tests.
 */

import { vi } from 'vitest';
import { ref, computed } from 'vue';

// Mock route object
const mockRoute = {
  path: '/',
  name: 'home',
  params: {},
  query: {},
  hash: '',
  fullPath: '/',
  matched: [],
  meta: {},
  redirectedFrom: undefined,
};

// Mock router object
const mockRouter = {
  currentRoute: ref(mockRoute),
  options: {},

  // Navigation methods
  push: vi.fn((to) => Promise.resolve()),
  replace: vi.fn((to) => Promise.resolve()),
  go: vi.fn((delta) => {}),
  back: vi.fn(() => {}),
  forward: vi.fn(() => {}),

  // Route guards
  beforeEach: vi.fn((guard) => () => {}),
  beforeResolve: vi.fn((guard) => () => {}),
  afterEach: vi.fn((guard) => () => {}),

  // Route management
  addRoute: vi.fn((route) => {}),
  removeRoute: vi.fn((name) => {}),
  hasRoute: vi.fn((name) => true),
  getRoutes: vi.fn(() => []),

  // Error handling
  onError: vi.fn((handler) => {}),
  isReady: vi.fn(() => Promise.resolve()),

  // Installation
  install: vi.fn((app) => {}),
};

// Export composables
export const useRoute = vi.fn(() => mockRoute);
export const useRouter = vi.fn(() => mockRouter);

// Export router creation functions
export const createRouter = vi.fn((options) => mockRouter);
export const createWebHistory = vi.fn((base) => ({
  base,
  location: '/',
  state: {},
  push: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
  listen: vi.fn(() => () => {}),
}));
export const createWebHashHistory = vi.fn((base) => ({
  base,
  location: '/',
  state: {},
  push: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
  listen: vi.fn(() => () => {}),
}));
export const createMemoryHistory = vi.fn((base) => ({
  base,
  location: '/',
  state: {},
  push: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
  listen: vi.fn(() => () => {}),
}));

// Export route location utilities
export const useLink = vi.fn((props) => ({
  route: computed(() => mockRoute),
  href: computed(() => '/'),
  isActive: computed(() => false),
  isExactActive: computed(() => false),
  navigate: vi.fn(),
}));

// Export navigation guards types
export const START_LOCATION = Object.freeze({
  path: '/',
  name: undefined,
  params: {},
  query: {},
  hash: '',
  fullPath: '/',
  matched: [],
  meta: {},
  redirectedFrom: undefined,
});

// Export for custom route creation
export const createRouterMatcher = vi.fn(() => ({
  addRoute: vi.fn(),
  removeRoute: vi.fn(),
  getRoutes: vi.fn(() => []),
  resolve: vi.fn(),
}));

// Export navigation failure types
export const NavigationFailureType = {
  aborted: 4,
  cancelled: 8,
  duplicated: 16,
};

export const isNavigationFailure = vi.fn(() => false);

// Export route record utilities
export const parseQuery = vi.fn((query) => ({}));
export const stringifyQuery = vi.fn((query) => '');

// Export route components
export const RouterLink = {
  name: 'RouterLink',
  template: '<a><slot /></a>',
};

export const RouterView = {
  name: 'RouterView',
  template: '<div><slot /></div>',
};

// Expose mocks for test assertions
export const mockRouterInstance = mockRouter;
export const mockRouteInstance = mockRoute;

// Default export (some imports use default)
export default {
  createRouter,
  createWebHistory,
  createWebHashHistory,
  createMemoryHistory,
  useRoute,
  useRouter,
  useLink,
  START_LOCATION,
  RouterLink,
  RouterView,
  NavigationFailureType,
  isNavigationFailure,
  parseQuery,
  stringifyQuery,
};

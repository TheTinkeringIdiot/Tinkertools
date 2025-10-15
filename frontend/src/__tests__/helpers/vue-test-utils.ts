/**
 * Vue Test Utilities
 *
 * Provides pre-configured Vue component mounting utilities with proper context.
 * Includes PrimeVue mock components and Pinia store setup.
 *
 * @see https://test-utils.vuejs.org/ - Vue Test Utils documentation
 */

import { mount, VueWrapper, shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import { vi } from 'vitest';
import type { Component } from 'vue';

// ============================================================================
// Mount Options Interface
// ============================================================================

export interface MountOptions {
  props?: Record<string, any>;
  slots?: Record<string, any>;
  global?: {
    plugins?: any[];
    components?: Record<string, Component>;
    stubs?: Record<string, any>;
    mocks?: Record<string, any>;
    provide?: Record<string, any>;
  };
  attachTo?: HTMLElement | string;
  shallow?: boolean;
}

// ============================================================================
// Test Context Setup
// ============================================================================

/**
 * Mount a Vue component with full test context (Pinia, Router, PrimeVue mocks)
 *
 * @example
 * const wrapper = mountWithContext(MyComponent, {
 *   props: { item: mockItem },
 *   global: {
 *     stubs: { 'router-link': true }
 *   }
 * });
 */
export function mountWithContext(component: Component, options: MountOptions = {}): VueWrapper {
  const pinia = createPinia();
  const router = createTestRouter();

  const mountFn = options.shallow ? shallowMount : mount;

  return mountFn(component, {
    ...options,
    global: {
      ...options.global,
      plugins: [pinia, router, ...(options.global?.plugins || [])],
      components: {
        ...mockPrimeVueComponents,
        ...(options.global?.components || {}),
      },
      stubs: {
        Tooltip: true,
        Ripple: true,
        ...(options.global?.stubs || {}),
      },
      mocks: {
        $t: (key: string) => key, // Mock i18n if needed
        ...(options.global?.mocks || {}),
      },
    },
  });
}

/**
 * Create a fresh Pinia instance for testing
 * Use this in beforeEach() to ensure isolated test state
 *
 * @example
 * beforeEach(() => {
 *   const pinia = createTestPinia();
 *   setActivePinia(pinia);
 * });
 */
export function createTestPinia(): Pinia {
  return createPinia();
}

/**
 * Create a test router with memory history
 * Useful for testing navigation without browser
 */
export function createTestRouter(routes: any[] = []): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: routes.length > 0 ? routes : [{ path: '/', component: { template: '<div>Home</div>' } }],
  });
}

// ============================================================================
// PrimeVue Mock Components
// ============================================================================

/**
 * Mock PrimeVue components for testing
 * These provide minimal DOM structure while avoiding external dependencies
 */
export const mockPrimeVueComponents = {
  Card: {
    name: 'Card',
    template: `
      <div class="p-card" v-bind="$attrs">
        <div v-if="$slots.header" class="p-card-header"><slot name="header" /></div>
        <div v-if="$slots.title" class="p-card-title"><slot name="title" /></div>
        <div v-if="$slots.subtitle" class="p-card-subtitle"><slot name="subtitle" /></div>
        <div v-if="$slots.content" class="p-card-content"><slot name="content" /></div>
        <div v-if="$slots.default" class="p-card-body"><slot /></div>
        <div v-if="$slots.footer" class="p-card-footer"><slot name="footer" /></div>
      </div>
    `,
  },

  Button: {
    name: 'Button',
    template: `
      <button
        v-bind="$attrs"
        :class="['p-button', severity && 'p-button-' + severity, size && 'p-button-' + size]"
        @click="$emit('click', $event)"
      >
        <slot />
      </button>
    `,
    props: ['label', 'icon', 'severity', 'size', 'disabled'],
    emits: ['click'],
  },

  Badge: {
    name: 'Badge',
    template: `
      <span
        class="p-badge"
        :class="[severity && 'p-badge-' + severity, size && 'p-badge-' + size]"
      >
        {{ value }}
      </span>
    `,
    props: ['value', 'severity', 'size'],
  },

  Tag: {
    name: 'Tag',
    template: `
      <span
        class="p-tag"
        :class="[severity && 'p-tag-' + severity]"
      >
        {{ value }}<slot />
      </span>
    `,
    props: ['value', 'severity', 'icon'],
  },

  DataTable: {
    name: 'DataTable',
    template: `
      <div class="p-datatable">
        <table>
          <thead v-if="$slots.default">
            <slot />
          </thead>
          <tbody>
            <tr v-for="(item, index) in value" :key="index">
              <slot name="body" :data="item" :index="index" />
            </tr>
          </tbody>
        </table>
      </div>
    `,
    props: ['value', 'dataKey', 'paginator', 'rows'],
  },

  Column: {
    name: 'Column',
    template: '<th><slot /></th>',
    props: ['field', 'header', 'sortable'],
  },

  InputText: {
    name: 'InputText',
    template: `
      <input
        type="text"
        class="p-inputtext"
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        v-bind="$attrs"
      />
    `,
    props: ['modelValue'],
    emits: ['update:modelValue'],
  },

  Dropdown: {
    name: 'Dropdown',
    template: `
      <select
        class="p-dropdown"
        :value="modelValue"
        @change="$emit('update:modelValue', $event.target.value)"
        v-bind="$attrs"
      >
        <option v-for="option in options" :key="option[optionValue]" :value="option[optionValue]">
          {{ option[optionLabel] }}
        </option>
      </select>
    `,
    props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'placeholder'],
    emits: ['update:modelValue', 'change'],
  },

  MultiSelect: {
    name: 'MultiSelect',
    template: `
      <select
        class="p-multiselect"
        multiple
        :value="modelValue"
        @change="(event) => {
          const target = event.target;
          const selected = Array.from(target.selectedOptions).map((opt) => opt.value);
          $emit('update:modelValue', selected);
        }"
        v-bind="$attrs"
      >
        <option v-for="option in options" :key="option[optionValue]" :value="option[optionValue]">
          {{ option[optionLabel] }}
        </option>
      </select>
    `,
    props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'placeholder'],
    emits: ['update:modelValue', 'change'],
  },

  Dialog: {
    name: 'Dialog',
    template: `
      <div v-if="visible" class="p-dialog-mask">
        <div class="p-dialog">
          <div v-if="$slots.header" class="p-dialog-header"><slot name="header" /></div>
          <div class="p-dialog-content"><slot /></div>
          <div v-if="$slots.footer" class="p-dialog-footer"><slot name="footer" /></div>
        </div>
      </div>
    `,
    props: ['visible', 'header', 'modal'],
    emits: ['update:visible'],
  },

  Sidebar: {
    name: 'Sidebar',
    template: `
      <div v-if="visible" class="p-sidebar" :class="'p-sidebar-' + position">
        <div class="p-sidebar-header"><slot name="header" /></div>
        <div class="p-sidebar-content"><slot /></div>
      </div>
    `,
    props: ['visible', 'position'],
    emits: ['update:visible'],
  },

  Toast: {
    name: 'Toast',
    template: '<div class="p-toast"><slot /></div>',
    props: ['group', 'position'],
  },

  ProgressBar: {
    name: 'ProgressBar',
    template: `
      <div class="p-progressbar">
        <div class="p-progressbar-value" :style="{ width: value + '%' }"></div>
      </div>
    `,
    props: ['value', 'showValue'],
  },

  Skeleton: {
    name: 'Skeleton',
    template: `
      <div class="p-skeleton" :class="[shape && 'p-skeleton-' + shape, size && 'p-skeleton-' + size]"></div>
    `,
    props: ['shape', 'size', 'width', 'height'],
  },
};

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Wait for Vue's nextTick and requestAnimationFrame
 * Useful for testing after DOM updates
 */
export async function flushPromises(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Wait for a specific amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Find an element by test ID
 *
 * @example
 * const button = findByTestId(wrapper, 'submit-button');
 */
export function findByTestId(wrapper: VueWrapper, testId: string) {
  return wrapper.find(`[data-testid="${testId}"]`);
}

/**
 * Find all elements by test ID
 */
export function findAllByTestId(wrapper: VueWrapper, testId: string) {
  return wrapper.findAll(`[data-testid="${testId}"]`);
}

/**
 * Check if element exists by test ID
 */
export function existsByTestId(wrapper: VueWrapper, testId: string): boolean {
  return findByTestId(wrapper, testId).exists();
}

/**
 * Get text content by test ID
 */
export function getTextByTestId(wrapper: VueWrapper, testId: string): string {
  return findByTestId(wrapper, testId).text();
}

// ============================================================================
// Store Test Helpers
// ============================================================================

/**
 * Reset all Pinia stores to initial state
 *
 * @example
 * afterEach(() => {
 *   resetAllStores();
 * });
 */
export function resetAllStores(): void {
  const pinia = createTestPinia();
  setActivePinia(pinia);
}

/**
 * Mock localStorage for tests
 */
export function mockLocalStorage() {
  const storage: Record<string, string> = {};

  return {
    getItem: (key: string) => storage[key] || null,
    setItem: (key: string, value: string) => {
      storage[key] = value;
    },
    removeItem: (key: string) => {
      delete storage[key];
    },
    clear: () => {
      Object.keys(storage).forEach((key) => delete storage[key]);
    },
    get length() {
      return Object.keys(storage).length;
    },
    key: (index: number) => Object.keys(storage)[index] || null,
  };
}

/**
 * Setup localStorage mock for tests
 *
 * @example
 * beforeEach(() => {
 *   setupLocalStorageMock();
 * });
 */
export function setupLocalStorageMock() {
  const mock = mockLocalStorage();
  Object.defineProperty(global, 'localStorage', {
    value: mock,
    writable: true,
  });
  return mock;
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a component emitted an event with specific payload
 *
 * @example
 * await wrapper.vm.$emit('update', { value: 123 });
 * expectEmitted(wrapper, 'update', { value: 123 });
 */
export function expectEmitted(wrapper: VueWrapper, eventName: string, payload?: any) {
  const emitted = wrapper.emitted(eventName);
  if (!emitted) {
    throw new Error(`Event "${eventName}" was not emitted`);
  }
  if (payload !== undefined) {
    const lastEmit = emitted[emitted.length - 1];
    if (JSON.stringify(lastEmit[0]) !== JSON.stringify(payload)) {
      throw new Error(
        `Event "${eventName}" payload mismatch.\nExpected: ${JSON.stringify(payload)}\nReceived: ${JSON.stringify(lastEmit[0])}`
      );
    }
  }
}

/**
 * Assert that component has specific class
 */
export function expectToHaveClass(wrapper: VueWrapper, className: string) {
  if (!wrapper.classes().includes(className)) {
    throw new Error(`Component does not have class "${className}". Classes: ${wrapper.classes().join(', ')}`);
  }
}

/**
 * Assert that component is visible
 */
export function expectToBeVisible(wrapper: VueWrapper) {
  if (!wrapper.isVisible()) {
    throw new Error('Component is not visible');
  }
}

// ============================================================================
// Cleanup Helpers
// ============================================================================

/**
 * Standard cleanup for after each test
 *
 * @example
 * afterEach(() => {
 *   standardCleanup();
 * });
 */
export function standardCleanup() {
  // Clear localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }

  // Reset Pinia stores
  resetAllStores();

  // Clear any pending timers
  vi.clearAllTimers();
  vi.clearAllMocks();
}

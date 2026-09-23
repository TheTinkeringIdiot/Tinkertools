/**
 * TinkerNanos Backend Integration Tests
 *
 * TRUE INTEGRATION TEST - Requires real backend
 * Mounts TinkerNanos with its real components and stores against the real API.
 *
 * Strategy: Skip when backend not available
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import TinkerNanos from '@/views/TinkerNanos.vue';
import { useNanosStore } from '@/stores/nanosStore';
import { createTestRouter } from '../helpers/vue-test-utils';
import { isBackendAvailable } from '../helpers/backend-check';

// Top-level await: skipIf is evaluated while tests are collected.
const BACKEND_AVAILABLE = await isBackendAvailable();

describe.skipIf(!BACKEND_AVAILABLE)('TinkerNanos Backend Integration', () => {
  let wrapper: VueWrapper;

  beforeEach(async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    wrapper = mount(TinkerNanos, {
      global: {
        plugins: [PrimeVue, ToastService, ConfirmationService, pinia, createTestRouter()],
      },
    });
    await flushPromises();
  });

  afterEach(() => {
    wrapper.unmount();
  });

  async function enterSearchMode() {
    const toggle = wrapper.findAll('button').find((button) => button.text() === 'Search Mode');
    expect(toggle).toBeDefined();
    await toggle!.trigger('click');
    // fetchNanos is fired from the click handler; wait for the real request
    await expect.poll(() => useNanosStore().nanos.length, { timeout: 10000 }).toBeGreaterThan(0);
    await flushPromises();
  }

  it('loads and displays TinkerNanos view', () => {
    expect(wrapper.find('h1').text()).toContain('TinkerNanos');
    expect(wrapper.text()).toContain('Professions');
  });

  it('fetches nano data from backend when entering search mode', async () => {
    await enterSearchMode();

    const nanosStore = useNanosStore();
    expect(nanosStore.error).toBeNull();
    expect(nanosStore.totalCount).toBeGreaterThan(0);
    expect(wrapper.findAll('.nano-card').length).toBeGreaterThan(0);
    // The header counts the server total; the list shows its first page
    expect(wrapper.text()).toContain(`${nanosStore.totalCount} nanos`);
  }, 15000);

  it('searches nanos by name through the backend', async () => {
    await enterSearchMode();

    const input = wrapper.find('.nano-search input.p-inputtext');
    await input.setValue('heal');
    await input.trigger('keyup.enter');
    await expect.poll(() => useNanosStore().searchHistory).toContain('heal');
    // The search loads once the query reaches the store: wait for its results
    const isSearchResult = (nano: { name: string; description?: string }) =>
      `${nano.name} ${nano.description ?? ''}`.toLowerCase().includes('heal');
    await expect
      .poll(
        () => {
          const store = useNanosStore();
          return !store.loading && store.nanos.length > 0 && store.nanos.every(isSearchResult);
        },
        { timeout: 10000 }
      )
      .toBe(true);
    await flushPromises();

    const names = wrapper.findAll('.nano-card h3').map((heading) => heading.text());
    expect(names.length).toBeGreaterThan(0);
    expect(names.some((name) => name.toLowerCase().includes('heal'))).toBe(true);
  }, 15000);
});

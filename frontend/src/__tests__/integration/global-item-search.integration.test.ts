/**
 * Global Item Search Integration Tests
 *
 * The header search bar is a shortcut into TinkerItems: Enter navigates to the
 * items route with ?search=<term>, inheriting the game version segment from
 * the current route. Uses the shared test router, shaped like the app router.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/services/api-client');

import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { Router } from 'vue-router';
import PrimeVue from 'primevue/config';
import GlobalItemSearch from '@/components/shared/GlobalItemSearch.vue';
import { createTestRouter } from '../helpers/vue-test-utils';

async function mountAt(router: Router, path: string) {
  await router.push(path);
  await router.isReady();
  const wrapper = mount(GlobalItemSearch, {
    global: { plugins: [PrimeVue, router] },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

describe('GlobalItemSearch', () => {
  let router: Router;

  beforeEach(() => {
    setActivePinia(createPinia());
    // Shaped like the app router: every tool is a child of /:version
    router = createTestRouter();
  });

  it('navigates to TinkerItems with the term and keeps the version segment', async () => {
    const wrapper = await mountAt(router, '/prk-2026-01/nanos');
    const input = wrapper.get('[data-testid="global-item-search-input"]');

    await input.setValue('Ofab Wolf');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('TinkerItems');
    expect(router.currentRoute.value.params.version).toBe('prk-2026-01');
    expect(router.currentRoute.value.query.search).toBe('Ofab Wolf');
    expect(router.currentRoute.value.path).toBe('/prk-2026-01/items');
    wrapper.unmount();
  });

  it('does nothing for a blank term', async () => {
    const wrapper = await mountAt(router, '/ao-2024-02/nanos');
    await wrapper.get('[data-testid="global-item-search-input"]').setValue('   ');
    await wrapper.get('form').trigger('submit');
    await flushPromises();

    expect(router.currentRoute.value.name).toBe('TinkerNanos');
    expect(
      wrapper.get('[data-testid="global-item-search-submit"]').attributes('disabled')
    ).toBeDefined();
    wrapper.unmount();
  });

  it('shows the current term while on the items page and empties it elsewhere', async () => {
    const wrapper = await mountAt(router, '/ao-2024-02/items?search=Cell%20Scanner');
    const input = wrapper.get('[data-testid="global-item-search-input"]')
      .element as HTMLInputElement;
    expect(input.value).toBe('Cell Scanner');

    await router.push('/ao-2024-02/nanos');
    await flushPromises();
    expect(input.value).toBe('');
    wrapper.unmount();
  });

  it('clear button empties the box without navigating', async () => {
    const wrapper = await mountAt(router, '/ao-2024-02/items?search=Cell');
    await wrapper.get('[data-testid="global-item-search-clear"]').trigger('click');
    await flushPromises();

    const input = wrapper.get('[data-testid="global-item-search-input"]')
      .element as HTMLInputElement;
    expect(input.value).toBe('');
    expect(router.currentRoute.value.query.search).toBe('Cell');
    wrapper.unmount();
  });
});

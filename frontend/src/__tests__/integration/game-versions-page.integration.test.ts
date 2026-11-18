/**
 * Game Versions page: one row per build, the browsed one marked, and the way
 * into a build's change list.
 *
 * Rows are memoised (a switch from this page must not re-render every row
 * before leaving), so the marking has to follow the browsed version and the
 * registry all the same.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory, type Router } from 'vue-router';
import PrimeVue from 'primevue/config';
import GameVersions from '@/views/GameVersions.vue';
import {
  versions as versionRegistry,
  currentVersion,
  setCurrentVersion,
} from '@/composables/useGameVersion';
import { DIFF_REGISTRY } from '../helpers/change-fixtures';
import { TEST_VERSION, TEST_VERSIONS } from '../helpers/version-fixtures';

function makeRouter(): Router {
  const blank = { template: '<div />' };
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/:version/versions', name: 'GameVersions', component: blank },
      { path: '/:version/changes', name: 'BuildChanges', component: blank },
    ],
  });
}

describe('game versions page', () => {
  let router: Router;
  let page: VueWrapper;

  const row = (slug: string) => page.find(`[data-testid="version-row"][data-slug="${slug}"]`);
  const currentRows = () =>
    page
      .findAll('[data-testid="version-row"]')
      .filter((entry) => entry.find('[data-testid="version-current-badge"]').exists())
      .map((entry) => entry.attributes('data-slug'));

  beforeEach(async () => {
    setActivePinia(createPinia());
    versionRegistry.value = DIFF_REGISTRY;
    currentVersion.value = null;
    await setCurrentVersion('ao-14-6-0');

    router = makeRouter();
    await router.push('/ao-14-6-0/versions');
    await router.isReady();
    page = mount(GameVersions, { global: { plugins: [PrimeVue, router] } });
    await flushPromises();
  });

  afterEach(async () => {
    page.unmount();
    versionRegistry.value = TEST_VERSIONS;
    currentVersion.value = null;
    await setCurrentVersion(TEST_VERSION);
  });

  it('lists every build in registry order and marks the one being browsed', () => {
    expect(
      page.findAll('[data-testid="version-row"]').map((entry) => entry.attributes('data-slug'))
    ).toEqual(DIFF_REGISTRY.map((version) => version.slug));
    expect(currentRows()).toEqual(['ao-14-6-0']);
    expect(row('ao-14-6-0').find('[data-testid="version-browse"]').text()).toContain('Browsing');
    expect(row('ao-14-5-1').find('[data-testid="version-browse"]').text()).toContain('Browse');
    expect(row('prk-0-7-1').text()).toContain('AO 17.10.5');
  });

  it('moves the marking when another build is browsed', async () => {
    await setCurrentVersion('ao-14-5-1');
    await flushPromises();

    expect(currentRows()).toEqual(['ao-14-5-1']);
    expect(row('ao-14-5-1').find('[data-testid="version-browse"]').text()).toContain('Browsing');
    expect(row('ao-14-6-0').find('[data-testid="version-browse"]').text()).toContain('Browse');
    expect(
      row('ao-14-6-0').find('[data-testid="version-browse"]').attributes('disabled')
    ).toBeUndefined();
  });

  it('follows the registry when it is loaded anew', async () => {
    versionRegistry.value = DIFF_REGISTRY.map((version) =>
      version.slug === 'ao-14-5-1' ? { ...version, display_name: 'AO 14.5.1 (renamed)' } : version
    );
    await flushPromises();

    expect(row('ao-14-5-1').text()).toContain('AO 14.5.1 (renamed)');
    // The parent of 14.6.0 is named by the registry too.
    expect(row('ao-14-6-0').text()).toContain('AO 14.5.1 (renamed)');
  });

  it("leads to a build's change list", async () => {
    await row('ao-14-5-1').find('[data-testid="version-changes"]').trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/ao-14-5-1/changes');
  });
});

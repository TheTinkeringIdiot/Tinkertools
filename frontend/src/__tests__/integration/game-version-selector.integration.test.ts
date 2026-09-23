/**
 * Game Version Selector Integration Tests
 *
 * The header pill and the tool gating it drives. Uses the real version
 * composable state (the registry fetch is bypassed by setting state directly)
 * and a mocked '@/router' so switchVersion's navigation can be asserted.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/services/api-client');

const routerMock = {
  currentRoute: {
    value: {
      name: 'TinkerItems',
      params: { version: 'ao-2024-02' },
      query: {},
      hash: '',
      fullPath: '/ao-2024-02/items',
    },
  },
  replace: vi.fn(),
  push: vi.fn(),
};

vi.mock('@/router', () => ({ default: routerMock }));

const mockToast = { add: vi.fn(), remove: vi.fn(), removeGroup: vi.fn(), removeAllGroups: vi.fn() };
vi.mock('primevue/usetoast', () => ({ useToast: () => mockToast }));

import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import PrimeVue from 'primevue/config';
import GameVersionSelector from '@/components/versions/GameVersionSelector.vue';
import VersionSnapshotBanner from '@/components/versions/VersionSnapshotBanner.vue';
import App from '@/App.vue';
import {
  versions as versionRegistry,
  setCurrentVersion,
  currentVersion,
  useGameVersion,
  isAcceptableVersion,
  reserveRouteSegments,
} from '@/composables/useGameVersion';
import type { GameVersion } from '@/types/game-version';

function makeVersion(overrides: Partial<GameVersion> & { slug: string }): GameVersion {
  return {
    display_name: overrides.slug,
    family: 'ao',
    parent_slug: null,
    client_build: null,
    snapshot_date: null,
    sort_order: 0,
    enabled: true,
    is_default: false,
    features: {},
    notes: null,
    is_current: false,
    ...overrides,
  };
}

const LIVE = makeVersion({
  slug: 'ao-2024-02',
  display_name: 'Anarchy Online (Feb 2024)',
  client_build: '18.8.72',
  snapshot_date: '2024-02-24',
  sort_order: 10,
  is_default: true,
  features: { items: true, nanos: true, perks: true, symbiants: true, sources: true },
});

const OLD = makeVersion({
  slug: 'ao-2003-06',
  display_name: 'Anarchy Online (Jun 2003)',
  snapshot_date: '2003-06-01',
  sort_order: 20,
  features: { items: true, nanos: true, perks: false, symbiants: false, sources: false },
});

const PRK = makeVersion({
  slug: 'prk',
  display_name: 'Project Rubi-Ka',
  family: 'prk',
  parent_slug: 'ao-2024-02',
  sort_order: 30,
  features: { items: true, nanos: true, symbiants: true },
});

/** switchVersion resolves through a dynamic import of the router module. */
async function flushAsync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

function stubRouter() {
  const blank = { template: '<div />' };
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'Root', component: blank },
      { path: '/:version/items', name: 'TinkerItems', component: blank },
      { path: '/versions', name: 'GameVersions', component: blank },
    ],
  });
}

/** Registry order is the backend's sort_order, already sorted by the composable. */
function setRegistry(list: GameVersion[], currentSlug: string) {
  versionRegistry.value = list;
  currentVersion.value = null;
  setCurrentVersion(currentSlug);
  useGameVersion().defaultVersion.value = list.find((v) => v.is_default)?.slug ?? null;
}

describe('GameVersionSelector', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    routerMock.replace.mockClear();
    mockToast.add.mockClear();
    setRegistry([LIVE, OLD, PRK], 'ao-2024-02');
  });

  it('shows the current version and its build on the pill', () => {
    const wrapper = mount(GameVersionSelector, {
      global: { plugins: [PrimeVue, stubRouter()] },
    });

    const pill = wrapper.find('[data-testid="version-pill"]');
    expect(pill.exists()).toBe(true);
    expect(pill.text()).toContain('Anarchy Online (Feb 2024)');
    expect(wrapper.find('[data-testid="version-pill-subtitle"]').text()).toContain('18.8.72');
    expect(wrapper.find('[data-testid="version-pill-subtitle"]').text()).toContain('2024-02-24');
  });

  it('lists every version in registry order when opened', async () => {
    const wrapper = mount(GameVersionSelector, {
      global: { plugins: [PrimeVue, stubRouter()] },
    });

    expect(wrapper.find('[data-testid="version-panel"]').exists()).toBe(false);

    await wrapper.find('[data-testid="version-pill"]').trigger('click');

    const options = wrapper.findAll('[data-testid="version-option"]');
    expect(options.map((option) => option.attributes('data-slug'))).toEqual([
      'ao-2024-02',
      'ao-2003-06',
      'prk',
    ]);
    expect(options[2].text()).toContain('Project Rubi-Ka');
  });

  it('switches the route version and announces the choice', async () => {
    const wrapper = mount(GameVersionSelector, {
      global: { plugins: [PrimeVue, stubRouter()] },
    });

    await wrapper.find('[data-testid="version-pill"]').trigger('click');
    await wrapper.find('[data-testid="version-option"][data-slug="prk"]').trigger('click');
    await flushAsync();

    expect(routerMock.replace).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'TinkerItems',
        params: expect.objectContaining({ version: 'prk' }),
      })
    );
    expect(mockToast.add).toHaveBeenCalledWith(
      expect.objectContaining({ detail: 'Viewing Project Rubi-Ka' })
    );
    // Choosing a version closes the panel.
    expect(wrapper.find('[data-testid="version-panel"]').exists()).toBe(false);
  });

  it('does not navigate when the current version is chosen again', async () => {
    const wrapper = mount(GameVersionSelector, {
      global: { plugins: [PrimeVue, stubRouter()] },
    });

    await wrapper.find('[data-testid="version-pill"]').trigger('click');
    await wrapper.find('[data-testid="version-option"][data-slug="ao-2024-02"]').trigger('click');
    await flushAsync();

    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it('opens the game versions page from the info icon', async () => {
    const router = stubRouter();
    const pushSpy = vi.spyOn(router, 'push');
    const wrapper = mount(GameVersionSelector, { global: { plugins: [PrimeVue, router] } });

    await wrapper.find('[data-testid="version-pill"]').trigger('click');
    await wrapper.find('[data-testid="version-info"][data-slug="prk"]').trigger('click');

    expect(pushSpy).toHaveBeenCalledWith({ name: 'GameVersions' });
  });
});

describe('VersionSnapshotBanner', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
  });

  it('stays hidden on the default version', () => {
    setRegistry([LIVE, OLD], 'ao-2024-02');
    const wrapper = mount(VersionSnapshotBanner, { global: { plugins: [PrimeVue] } });

    expect(wrapper.find('[data-testid="version-snapshot-banner"]').exists()).toBe(false);
  });

  it('names the snapshot and the data it does not carry', () => {
    setRegistry([LIVE, OLD], 'ao-2003-06');
    const wrapper = mount(VersionSnapshotBanner, { global: { plugins: [PrimeVue] } });

    const banner = wrapper.find('[data-testid="version-snapshot-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain('Anarchy Online (Jun 2003)');
    expect(banner.text()).toContain('2003-06-01');
    expect(banner.text()).toContain('perks');
    expect(banner.text()).toContain('symbiants');
    expect(banner.text()).toContain('drop sources');
  });

  it('stays dismissed for the rest of the session', async () => {
    setRegistry([LIVE, OLD], 'ao-2003-06');
    const wrapper = mount(VersionSnapshotBanner, { global: { plugins: [PrimeVue] } });

    await wrapper.find('[data-testid="version-banner-dismiss"]').trigger('click');
    expect(wrapper.find('[data-testid="version-snapshot-banner"]').exists()).toBe(false);

    const remounted = mount(VersionSnapshotBanner, { global: { plugins: [PrimeVue] } });
    expect(remounted.find('[data-testid="version-snapshot-banner"]').exists()).toBe(false);
  });
});

describe('App navigation tool gating', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountApp() {
    return mount(App, {
      global: {
        plugins: [PrimeVue, stubRouter()],
        stubs: {
          ProfileDropdown: true,
          GameVersionSelector: true,
          VersionSnapshotBanner: true,
          AccessibilityAnnouncer: true,
          Toast: true,
          RouterView: true,
          Menubar: { name: 'Menubar', props: ['model'], template: '<div class="menubar" />' },
        },
      },
    });
  }

  function menuLabels(wrapper: ReturnType<typeof mountApp>): string[] {
    const menubar = wrapper.findComponent({ name: 'Menubar' });
    return (menubar.props('model') as Array<{ label: string }>).map((entry) => entry.label);
  }

  it('shows every tool on a full version', () => {
    setRegistry([LIVE], 'ao-2024-02');
    const labels = menuLabels(mountApp());

    expect(labels).toContain('TinkerPocket');
    expect(labels).toContain('TinkerNanos');
    expect(labels).toContain('TinkerNukes');
    expect(labels).toContain('TinkerPlants');
  });

  it('hides tools the version has no data for', () => {
    setRegistry(
      [
        makeVersion({
          ...OLD,
          is_default: true,
          features: { items: true, nanos: false, symbiants: false },
        }),
      ],
      'ao-2003-06'
    );
    const labels = menuLabels(mountApp());

    expect(labels).not.toContain('TinkerPocket');
    expect(labels).not.toContain('TinkerNanos');
    expect(labels).not.toContain('TinkerNukes');
    expect(labels).toContain('TinkerItems');
    expect(labels).toContain('TinkerPlants');
    expect(labels).toContain('TinkerFite');
  });

  it('shows everything when the version is not in the registry', () => {
    versionRegistry.value = [];
    currentVersion.value = null;
    setCurrentVersion('unknown-snapshot');
    const labels = menuLabels(mountApp());

    expect(labels).toContain('TinkerPocket');
    expect(labels).toContain('TinkerNanos');
  });
});

describe('version segment validation without a registry', () => {
  it('never accepts an app route segment as a version', () => {
    const { registryFailed } = useGameVersion();
    const wasFailed = registryFailed.value;
    registryFailed.value = true;
    reserveRouteSegments(['nanos', 'items']);

    try {
      // A pre-version bookmark like /nanos must redirect, not become version "nanos".
      expect(isAcceptableVersion('nanos')).toBe(false);
      expect(isAcceptableVersion('items')).toBe(false);
      expect(isAcceptableVersion('ao-2030-01')).toBe(true);
    } finally {
      registryFailed.value = wasFailed;
    }
  });
});

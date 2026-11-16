/**
 * Links that name a game version TinkerTools does not have.
 *
 * A removed build or a mistyped link must not drop the visitor on some other
 * page without a word: they get the page they asked for, in the version the
 * app falls back to, and a notice saying which version that is.
 *
 * Real router (with its version guard) and app shell; only the API client and
 * the toast service are mocked.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/services/api-client');

const mockToast = { add: vi.fn(), remove: vi.fn(), removeGroup: vi.fn(), removeAllGroups: vi.fn() };
vi.mock('primevue/usetoast', () => ({ useToast: () => mockToast }));

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import App from '@/App.vue';
import router from '@/router';
import { TEST_VERSION, TEST_ALT_VERSION, TEST_VERSIONS } from '../helpers/version-fixtures';

const FALLBACK_NAME = TEST_VERSIONS[0].display_name;

describe('A link to a game version that does not exist', () => {
  let app: VueWrapper;

  const shell = {
    global: {
      plugins: [PrimeVue, router],
      stubs: {
        ProfileDropdown: true,
        GameVersionSelector: true,
        GlobalItemSearch: true,
        VersionSnapshotBanner: true,
        AccessibilityAnnouncer: true,
        Toast: true,
        RouterView: true,
        Menubar: true,
      },
    },
  };

  async function follow(link: string) {
    await router.push(link);
    await flushPromises();
  }

  const landedOn = () => router.currentRoute.value.fullPath;
  const notices = () => mockToast.add.mock.calls.map(([notice]) => notice);

  beforeEach(async () => {
    setActivePinia(createPinia());
    await follow(`/${TEST_VERSION}/versions`);
    app = mount(App, shell);
    await flushPromises();
    mockToast.add.mockClear();
  });

  afterEach(() => {
    app.unmount();
  });

  it('shows the same page in the version the app falls back to, and says so', async () => {
    await follow('/ao-1999-01/changes?page=2');

    expect(landedOn()).toBe(`/${TEST_VERSION}/changes?page=2`);
    expect(notices()).toEqual([
      expect.objectContaining({
        severity: 'warn',
        summary: 'Unknown game version',
        detail: `There is no game version "ao-1999-01". Showing ${FALLBACK_NAME} instead.`,
      }),
    ]);
  });

  it('says so when the link names nothing but the version', async () => {
    await follow('/ao-1999-01');

    expect(landedOn()).toBe(`/${TEST_VERSION}`);
    expect(notices()).toHaveLength(1);
    expect(notices()[0].detail).toContain('"ao-1999-01"');
  });

  it('says so to a visitor whose first page it is', async () => {
    app.unmount();
    await follow('/ao-1999-01/versions');

    app = mount(App, shell);
    await flushPromises();

    expect(notices()).toHaveLength(1);
    expect(notices()[0].detail).toContain('"ao-1999-01"');
  });

  it('says it once', async () => {
    await follow('/ao-1999-01/versions');
    await follow(`/${TEST_VERSION}/changes`);

    expect(notices()).toHaveLength(1);
  });

  it('says nothing for a version that exists', async () => {
    await follow(`/${TEST_ALT_VERSION}/versions`);

    expect(landedOn()).toBe(`/${TEST_ALT_VERSION}/versions`);
    expect(notices()).toEqual([]);
  });

  it('says nothing for a bookmark from before versions were in the address', async () => {
    await follow('/versions');

    expect(landedOn()).toBe(`/${TEST_VERSION}/versions`);
    expect(notices()).toEqual([]);
  });
});

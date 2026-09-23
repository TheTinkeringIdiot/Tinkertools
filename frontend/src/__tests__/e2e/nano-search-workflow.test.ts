/**
 * Nano Search Workflow
 *
 * TinkerNanos in search mode, mounted with its real child components and a
 * real nanos store; only the API client is mocked. The mocked backend answers
 * `/nanos` with every nano and `/nanos/search?q=` with the nanos whose name or
 * description contains the query, the way the real search endpoint does.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// CRITICAL: Mock API BEFORE store imports
vi.mock('@/services/api-client');

import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import TinkerNanos from '@/views/TinkerNanos.vue';
import { apiClient } from '@/services/api-client';
import { useNanosStore } from '@/stores/nanosStore';
import { setupIntegrationTest } from '../helpers/integration-test-utils';
import { createTestRouter } from '../helpers/vue-test-utils';
import type { Pinia } from 'pinia';
import type { PaginatedResponse } from '@/types/api';

/** A nano as the backend's /nanos endpoints return it (snake_case). */
interface BackendNano {
  id: number;
  aoid: number;
  name: string;
  ql: number;
  description: string;
  school: string | null;
  strain: string;
  professions: string[];
  level: number | null;
  memory_usage: number | null;
}

function backendNano(overrides: Partial<BackendNano> & Pick<BackendNano, 'id' | 'name'>) {
  return {
    aoid: 10000 + overrides.id,
    ql: 100,
    description: '',
    school: 'Combat',
    strain: 'Test Strain',
    professions: [],
    level: 100,
    memory_usage: 20,
    ...overrides,
  };
}

const NANOS: BackendNano[] = [
  backendNano({
    id: 1,
    name: 'Superior Heal',
    school: 'Medical',
    description: 'Heals target for a large amount of health.',
    level: 125,
  }),
  backendNano({
    id: 2,
    name: 'Minor Heal',
    school: 'Medical',
    description: 'Basic healing nano.',
    level: 25,
  }),
  backendNano({
    id: 3,
    name: 'Matter Armor',
    school: 'Protection',
    description: 'Creates protective matter armor.',
    level: 100,
  }),
  backendNano({
    id: 4,
    name: 'Teleport',
    school: 'Space',
    description: 'Teleports the caster.',
    level: 150,
  }),
  backendNano({
    id: 5,
    name: 'Mending Aura',
    // Nanos without a Use action have no school or level; no nano has memory usage yet
    school: null,
    description: 'Slowly heals the whole team.',
    level: null,
    memory_usage: null,
  }),
];

function page(items: BackendNano[]): PaginatedResponse<BackendNano> {
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 200,
    pages: 1,
    has_next: false,
    has_prev: false,
  };
}

/** The mocked backend: `/nanos` lists everything, `/nanos/search` matches text. */
function nanoBackend(url: string): PaginatedResponse<BackendNano> {
  const [path, query] = url.split('?');
  if (path === '/nanos/search') {
    const q = (new URLSearchParams(query).get('q') ?? '').toLowerCase();
    return page(
      NANOS.filter(
        (nano) => nano.name.toLowerCase().includes(q) || nano.description.toLowerCase().includes(q)
      )
    );
  }
  return page(NANOS);
}

describe('Nano Search Workflow', () => {
  let pinia: Pinia;
  let wrapper: VueWrapper;

  beforeEach(async () => {
    ({ pinia } = await setupIntegrationTest());

    // getPaginated is generic over the item type and the store asks for <any>;
    // the fake backend always answers with backend nanos.
    vi.mocked(apiClient.getPaginated).mockImplementation(<T>(url: string) =>
      Promise.resolve(nanoBackend(url) as PaginatedResponse<unknown> as PaginatedResponse<T>)
    );

    wrapper = mount(TinkerNanos, {
      global: {
        plugins: [PrimeVue, ToastService, ConfirmationService, pinia, createTestRouter()],
      },
      attachTo: document.body,
    });
    await flushPromises();
  });

  afterEach(() => {
    wrapper.unmount();
  });

  function nanoNames(): string[] {
    return wrapper.findAll('.nano-card h3').map((heading) => heading.text());
  }

  async function enterSearchMode() {
    const toggle = wrapper.findAll('button').find((button) => button.text() === 'Search Mode');
    expect(toggle).toBeDefined();
    await toggle!.trigger('click');
    await flushPromises();
  }

  async function search(query: string) {
    const input = wrapper.find('.nano-search input.p-inputtext');
    await input.setValue(query);
    await input.trigger('keyup.enter');
    await flushPromises();
  }

  it('starts in profession browse mode without loading every nano', () => {
    expect(wrapper.find('h1').text()).toContain('TinkerNanos');
    expect(wrapper.text()).toContain('Select a profession to view its nanos');
    expect(wrapper.find('.nano-search').exists()).toBe(false);
    expect(apiClient.getPaginated).not.toHaveBeenCalled();
  });

  it('loads and lists all nanos when entering search mode', async () => {
    await enterSearchMode();

    expect(apiClient.getPaginated).toHaveBeenCalledWith(expect.stringMatching(/^\/nanos\?/));
    expect(nanoNames()).toEqual(expect.arrayContaining(NANOS.map((nano) => nano.name)));
    expect(wrapper.text()).toContain(`${NANOS.length} nanos`);
  });

  it('performs a text search against the backend', async () => {
    await enterSearchMode();
    await search('heal');

    expect(apiClient.getPaginated).toHaveBeenCalledWith(
      expect.stringMatching(/^\/nanos\/search\?q=heal/)
    );
    expect(nanoNames().sort()).toEqual(['Mending Aura', 'Minor Heal', 'Superior Heal']);
    expect(wrapper.text()).toContain('3 nanos');
  });

  it('keeps searched nanos that have no school', async () => {
    await enterSearchMode();
    await search('team');

    expect(nanoNames()).toEqual(['Mending Aura']);
  });

  it('filters results by school chip', async () => {
    await enterSearchMode();

    const medicalChip = wrapper.findAll('.p-chip').find((chip) => chip.text() === 'Medical');
    expect(medicalChip).toBeDefined();
    await medicalChip!.trigger('click');
    await flushPromises();

    expect(nanoNames().sort()).toEqual(['Minor Heal', 'Superior Heal']);
  });

  it('records searches in the search history', async () => {
    await enterSearchMode();
    await search('teleport');

    expect(useNanosStore().searchHistory).toContain('teleport');
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'tinkertools_nano_search_history',
      expect.stringContaining('teleport')
    );
  });

  it('shows an empty state when nothing matches', async () => {
    await enterSearchMode();
    await search('nonexistent nano name');

    expect(nanoNames()).toEqual([]);
    expect(wrapper.text()).toContain('No nanos found');
  });

  it('opens nano details from the results', async () => {
    await enterSearchMode();

    const card = wrapper.findAll('.nano-card').find((c) => c.text().includes('Teleport'));
    expect(card).toBeDefined();
    await card!.trigger('click');
    await flushPromises();

    const dialog = document.body.querySelector('.p-dialog');
    expect(dialog).not.toBeNull();
    expect(dialog!.querySelector('.p-dialog-title')?.textContent).toBe('Teleport');
  });

  it('clears the search and filters', async () => {
    await enterSearchMode();

    const medicalChip = wrapper.findAll('.p-chip').find((chip) => chip.text() === 'Medical');
    await medicalChip!.trigger('click');
    await flushPromises();
    expect(nanoNames()).toHaveLength(2);

    const clear = wrapper.findAll('button').find((b) => b.text() === 'Clear All Filters');
    expect(clear).toBeDefined();
    await clear!.trigger('click');
    await flushPromises();

    expect(useNanosStore().filters.schools).toEqual([]);
    expect(nanoNames()).toHaveLength(NANOS.length);
  });
});

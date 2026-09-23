/**
 * TinkerNukes View Integration Tests
 *
 * Mounts the real view with its real form and table, a real TinkerProfiles
 * store, and only the network mocked (the offensive nano endpoint via fetch).
 * Covers what a user sees:
 * - Offensive nanos load and list, with a result count
 * - Only nanos the character can cast are listed; raising a skill reveals more
 * - An active Nanotechnician profile fills the form and unlocks its nanos
 * - Switching profile clears the search filter
 * - Search narrows the list
 * - Clicking a nano opens its item page in the current game version
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia, type Pinia } from 'pinia';
import type { Router } from 'vue-router';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import Tooltip from 'primevue/tooltip';
import TinkerNukes from '@/views/TinkerNukes.vue';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import type { Item } from '@/types/api';
import {
  createNanoTechProfile,
  createTestProfile,
  PROFESSION,
  SKILL_ID,
} from '@/__tests__/helpers';
import { createTestRouter } from '@/__tests__/helpers/vue-test-utils';
import { TEST_VERSION } from '@/__tests__/helpers/version-fixtures';

// ============================================================================
// Fixtures
// ============================================================================

/** Stat 130 (Matter Creation); criterion operator 2 is "greater than". */
const MATTER_CREATION = SKILL_ID.MATTER_CREATION;
const GREATER_THAN = 2;

/** An offensive nano whose only casting requirement is Matter Creation >= `mcRequired`. */
function offensiveNanoItem(aoid: number, name: string, mcRequired: number): Item {
  return {
    id: aoid,
    aoid,
    name,
    ql: 200,
    description: `${name} description`,
    item_class: 0,
    is_nano: true,
    stats: [
      { id: 1, stat: 294, value: 100 }, // Cast time
      { id: 2, stat: 210, value: 200 }, // Recharge time
      { id: 3, stat: 407, value: 50 }, // Nano point cost
    ],
    spell_data: [
      {
        id: aoid,
        spells: [
          {
            id: aoid,
            target: 3,
            spell_id: 53002, // Hit target for damage
            spell_params: { MinValue: -500, MaxValue: -900, ModifierStat: 93 },
            criteria: [],
          },
        ],
      },
    ],
    actions: [
      {
        id: aoid,
        action: 3,
        item_id: aoid,
        criteria: [
          { id: aoid, value1: MATTER_CREATION, value2: mcRequired - 1, operator: GREATER_THAN },
        ],
      },
    ],
    attack_stats: [],
    defense_stats: [],
  };
}

const BEGINNER_NANO = offensiveNanoItem(1001, 'Viral Bomb', 1);
const MID_NANO = offensiveNanoItem(1002, 'Corrosive Cloud', 1);
const ADVANCED_NANO = offensiveNanoItem(1003, 'Energy Blast', 100);

// ============================================================================
// Setup
// ============================================================================

const fetchMock = vi.fn<typeof fetch>();

function respondWithNanos(items: Item[]): void {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ items, total: items.length }), { status: 200 })
  );
}

describe('TinkerNukes View', () => {
  let pinia: Pinia;
  let wrapper: VueWrapper;
  let router: Router;

  /** Mounts the view the way main.ts does, once the router has a versioned location. */
  async function mountView(): Promise<void> {
    router = createTestRouter();
    await router.isReady();
    wrapper = mount(TinkerNukes, {
      global: {
        plugins: [PrimeVue, ToastService, pinia, router],
        directives: { tooltip: Tooltip },
      },
    });
    await flushPromises();
  }

  const resultCount = () => wrapper.text().match(/(\d+) nanos? found/)?.[1];
  const listedNames = () => wrapper.findAll('tbody tr a').map((link) => link.text().trim());
  const searchInput = () => wrapper.find('input[placeholder="Search nanos..."]');

  beforeEach(() => {
    localStorage.clear();
    pinia = createPinia();
    setActivePinia(pinia);
    vi.stubGlobal('fetch', fetchMock);
    respondWithNanos([BEGINNER_NANO, MID_NANO, ADVANCED_NANO]);
  });

  afterEach(() => {
    wrapper?.unmount();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  // ==========================================================================
  // Loading
  // ==========================================================================

  describe('loading nanos', () => {
    it('shows the TinkerNukes header and the NT-only badge', async () => {
      await mountView();

      expect(wrapper.find('h1').text()).toContain('TinkerNukes');
      expect(wrapper.text()).toContain('NT Only');
    });

    it('requests Nanotechnician offensive nanos for the current game version', async () => {
      await mountView();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = String(fetchMock.mock.calls[0][0]);
      expect(url).toContain(`/nanos/offensive/${PROFESSION.NANO_TECHNICIAN}`);
      expect(url).toContain(TEST_VERSION);
    });

    it('lists only the nanos a fresh character can cast', async () => {
      await mountView();

      expect(listedNames()).toEqual(expect.arrayContaining(['Viral Bomb', 'Corrosive Cloud']));
      expect(listedNames()).not.toContain('Energy Blast');
      expect(resultCount()).toBe('2');
    });

    it('shows an empty list when the request fails', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      fetchMock.mockRejectedValue(new Error('Network error'));

      await mountView();

      expect(resultCount()).toBe('0');
      expect(listedNames()).toEqual([]);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch offensive nanos'),
        expect.any(Error)
      );
      errorSpy.mockRestore();
    });

    it('shows an empty list when no offensive nanos exist', async () => {
      respondWithNanos([]);

      await mountView();

      expect(resultCount()).toBe('0');
      expect(listedNames()).toEqual([]);
    });
  });

  // ==========================================================================
  // Manual skills
  // ==========================================================================

  describe('manual skill entry', () => {
    it('reveals nanos once Matter Creation meets their requirement', async () => {
      await mountView();
      expect(listedNames()).not.toContain('Energy Blast');

      // The field's input sits beside its label (the label targets the wrapper span)
      const label = wrapper.findAll('label').find((l) => l.text() === 'Matter Creation');
      const matterCreation = label!.element.parentElement!.querySelector('input')!;
      matterCreation.value = '150';
      matterCreation.dispatchEvent(new Event('input'));
      matterCreation.dispatchEvent(new Event('blur'));

      await vi.waitFor(() => expect(listedNames()).toContain('Energy Blast'));
      expect(resultCount()).toBe('3');
    });
  });

  // ==========================================================================
  // Profiles
  // ==========================================================================

  describe('active profile', () => {
    async function activateProfile(profile: ReturnType<typeof createTestProfile>) {
      const store = useTinkerProfilesStore();
      const profileId = await store.createProfile(profile.Character.Name, profile);
      await store.setActiveProfile(profileId);
      await flushPromises();
      return store;
    }

    it('shows the active profile name, profession and level in the header', async () => {
      await mountView();

      await activateProfile(createNanoTechProfile({ name: 'Nanomancer', level: 180 }));

      const header = wrapper.text();
      expect(header).toContain('Active Profile:');
      expect(header).toContain('Nanomancer');
      expect(header).toContain('NanoTechnician');
      expect(header).toContain('180');
    });

    it("fills the form from a Nanotechnician's skills and unlocks their nanos", async () => {
      await mountView();
      expect(listedNames()).not.toContain('Energy Blast');

      const store = await activateProfile(createNanoTechProfile({ name: 'Nanomancer' }));
      const profileMatterCreation = store.activeProfile?.skills[MATTER_CREATION]?.total ?? 0;
      expect(profileMatterCreation).toBeGreaterThanOrEqual(100);

      await vi.waitFor(() => expect(listedNames()).toContain('Energy Blast'));
      expect(resultCount()).toBe('3');
    });

    it('keeps default skills for a profile that is not a Nanotechnician', async () => {
      await mountView();

      await activateProfile(
        createTestProfile({
          name: 'Healbot',
          profession: PROFESSION.DOCTOR,
          skills: { [MATTER_CREATION]: { total: 2000 } },
        })
      );

      expect(wrapper.text()).toContain('Healbot');
      expect(wrapper.text()).toContain('Doctor');
      // Give the form's debounced update time to land before checking it changed nothing
      await new Promise((resolve) => setTimeout(resolve, 100));
      await flushPromises();
      expect(listedNames()).not.toContain('Energy Blast');
    });

    it('clears the search filter when the profile changes', async () => {
      await mountView();
      await activateProfile(createNanoTechProfile({ name: 'First' }));

      await searchInput().setValue('Viral');
      await vi.waitFor(() => expect(resultCount()).toBe('1'));

      await activateProfile(createNanoTechProfile({ name: 'Second' }));

      expect((searchInput().element as HTMLInputElement).value).toBe('');
      await vi.waitFor(() => expect(resultCount()).toBe('3'));
    });
  });

  // ==========================================================================
  // Search
  // ==========================================================================

  describe('search', () => {
    it('narrows the list to nanos whose name matches', async () => {
      await mountView();

      await searchInput().setValue('viral');

      expect(resultCount()).toBe('1');
      expect(listedNames()).toEqual(['Viral Bomb']);
    });

    it('shows no nanos when nothing matches', async () => {
      await mountView();

      await searchInput().setValue('NonExistent');

      expect(resultCount()).toBe('0');
      expect(listedNames()).toEqual([]);
    });
  });

  // ==========================================================================
  // Navigation
  // ==========================================================================

  describe('navigation', () => {
    it('opens the item page for a clicked nano in the current game version', async () => {
      await mountView();

      const row = wrapper.findAll('tbody tr').find((tr) => tr.text().includes('Corrosive Cloud'));
      expect(row).toBeDefined();
      await row!.trigger('click');
      await flushPromises();

      expect(router.currentRoute.value.fullPath).toBe(`/${TEST_VERSION}/items/1002`);
    });
  });
});

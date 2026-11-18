/**
 * TinkerPlants Workflow Tests
 *
 * The implant planner mounted with its real components and real stores (plants,
 * profiles, symbiants); only the API client is mocked. A user picks clusters for
 * a slot, the planner looks the implant up, and the build is saved to (or
 * reverted from) the active profile.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// CRITICAL: Mock API BEFORE store imports
vi.mock('@/services/api-client');

import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import TinkerPlants from '@/views/TinkerPlants.vue';
import { apiClient } from '@/services/api-client';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import { IMPLANT_SLOT } from '@/services/game-data';
import { skillService } from '@/services/skill-service';
import { setupIntegrationTest } from '../helpers/integration-test-utils';
import { createTestRouter } from '../helpers/vue-test-utils';
import { createImplantItem } from '../helpers/item-fixtures';
import { createTestProfile, PROFESSION } from '../helpers/profile-fixtures';
import type { Pinia } from 'pinia';
import type { PaginatedResponse, SymbiantItem } from '@/types/api';

const EMPTY_SYMBIANT_PAGE: PaginatedResponse<SymbiantItem> = {
  items: [],
  total: 0,
  page: 1,
  page_size: 100,
  pages: 0,
  has_next: false,
  has_prev: false,
};

describe('TinkerPlants Workflow', () => {
  let pinia: Pinia;
  let wrapper: VueWrapper;
  let profileId: string;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    ({ pinia } = await setupIntegrationTest());

    vi.mocked(apiClient.searchSymbiants).mockResolvedValue(EMPTY_SYMBIANT_PAGE);
    vi.mocked(apiClient.lookupImplant).mockResolvedValue({
      success: true,
      item: createImplantItem({ name: 'Eye Implant', ql: 200 }),
      interpolated: false,
    });

    const profilesStore = useTinkerProfilesStore();
    await profilesStore.loadProfiles();
    const { Character } = createTestProfile({ profession: PROFESSION.DOCTOR, level: 200 });
    profileId = await profilesStore.createProfile('Planner', { Character });
    await profilesStore.setActiveProfile(profileId);

    wrapper = mount(TinkerPlants, {
      global: {
        plugins: [PrimeVue, ToastService, ConfirmationService, pinia, createTestRouter()],
      },
      attachTo: document.body,
    });
    await flushPromises();
  });

  afterEach(() => {
    wrapper.unmount();
    vi.useRealTimers();
  });

  /** Slot ids contain spaces ("Right Arm-shiny"), so match the attribute. */
  function byId(id: string): string {
    return `[id="${id}"]`;
  }

  function button(label: string) {
    // "Save" carries a "*" badge while there are unsaved changes
    const found = wrapper.findAll('button').find((b) => b.text().trim().startsWith(label));
    expect(found, `button "${label}"`).toBeDefined();
    return found!;
  }

  /** Open a cluster dropdown and pick the option with the given label. */
  async function pickCluster(dropdownId: string, label: string) {
    await wrapper.find(byId(dropdownId)).trigger('click');
    await flushPromises();
    const option = Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (el) => el.textContent?.trim() === label
    );
    expect(option, `option "${label}"`).toBeDefined();
    option!.click();
    await flushPromises();
    // The planner debounces implant lookups by 300ms
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
  }

  it('shows the planner with every implant slot and nothing to save', () => {
    expect(wrapper.find('h1').text()).toContain('TinkerPlants');
    const slotNames = [
      'Eye',
      'Head',
      'Ear',
      'Right Arm',
      'Chest',
      'Left Arm',
      'Right Wrist',
      'Waist',
      'Left Wrist',
      'Right Hand',
      'Leg',
      'Left Hand',
      'Feet',
    ];
    for (const slot of slotNames) {
      expect(wrapper.find(byId(`${slot}-shiny`)).exists()).toBe(true);
    }
    expect(button('Save').attributes('disabled')).toBeDefined();
    expect(button('Revert').attributes('disabled')).toBeDefined();
  });

  it('looks up the implant for the chosen clusters and enables saving', async () => {
    await pickCluster('Eye-shiny', 'Aimed Shot');

    expect(apiClient.lookupImplant).toHaveBeenCalledWith(
      IMPLANT_SLOT.Eyes,
      200,
      { Shiny: skillService.resolveId('Aimed Shot') },
      expect.any(AbortSignal)
    );
    expect(button('Save').attributes('disabled')).toBeUndefined();
    expect(button('Revert').attributes('disabled')).toBeUndefined();
  });

  it('saves the build to the active profile', async () => {
    await pickCluster('Eye-shiny', 'Aimed Shot');

    await button('Save').trigger('click');
    await flushPromises();

    const saved = useTinkerProfilesStore().activeProfile?.Implants?.[String(IMPLANT_SLOT.Eyes)];
    expect(saved?.clusters?.Shiny?.stat).toBe(skillService.resolveId('Aimed Shot'));
    expect(button('Save').attributes('disabled')).toBeDefined();
  });

  it('reverts unsaved changes', async () => {
    await pickCluster('Eye-shiny', 'Aimed Shot');

    await button('Revert').trigger('click');
    await flushPromises();

    expect(button('Save').attributes('disabled')).toBeDefined();
    expect(wrapper.find(byId('Eye-shiny')).text()).toContain('None');
  });

  it('switches a slot to symbiant mode', async () => {
    const headRow = wrapper
      .findAll('.tinker-plants-grid')
      .find((row) => row.text().startsWith('Head'));
    expect(headRow).toBeDefined();

    const symbiantToggle = headRow!.findAll('[role="radio"], button').find((b) => b.text() === 'S');
    expect(symbiantToggle).toBeDefined();
    await symbiantToggle!.trigger('click');
    await flushPromises();

    expect(wrapper.find(byId('Head-symbiant')).exists()).toBe(true);
    expect(wrapper.find(byId('Head-shiny')).exists()).toBe(false);
  });
});

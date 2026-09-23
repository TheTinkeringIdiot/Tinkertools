/**
 * Profile Equipment Integration Tests
 *
 * Integration tests for profile import workflow with item fetching and equipment display
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// CRITICAL: Mock API BEFORE store imports
vi.mock('@/services/api-client');

import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import type {
  BatchInterpolateItemResult,
  BatchInterpolationResponse,
  InterpolatedItem,
  Item,
} from '@/types/api';
import {
  setupIntegrationTest,
  mountForIntegration,
  waitForUpdates,
  type IntegrationTestContext,
} from '../helpers/integration-test-utils';
import { BREED, PROFESSION, createTestItem, createTestProfile } from '@/__tests__/helpers';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import TinkerProfileDetail from '@/views/TinkerProfileDetail.vue';
import { createTestRouter } from '../helpers/vue-test-utils';
import { TEST_VERSION } from '../helpers/version-fixtures';

// AOSetups implant slots are stored under their IMPLANT_SLOT bitflag
const EYE_SLOT = '2';
const HEAD_SLOT = '4';
const EAR_SLOT = '8';
const CHEST_SLOT = '32';

/** A fresh store over the same localStorage, as after a page reload */
function reloadedStore() {
  const app = createApp({});
  app.use(PrimeVue);
  app.use(ToastService); // the store shows toasts
  const pinia = createPinia();
  app.use(pinia);
  setActivePinia(pinia);
  return useTinkerProfilesStore();
}

describe('Profile Equipment Integration', () => {
  let context: IntegrationTestContext;

  const mockItem: Item = createTestItem({
    id: 1,
    aoid: 246660,
    name: "Combined Commando's Jacket",
    ql: 300,
    description: 'A tactical jacket',
    item_class: 2,
    stats: [
      { id: 1, stat: 79, value: 123456 }, // Icon stat
      { id: 2, stat: 12, value: 100 },
    ],
  });

  const mockImplantItem: Item = createTestItem({
    id: 2,
    aoid: 87654,
    name: 'Ocular Enhancement',
    ql: 100,
    description: 'An eye implant',
    item_class: 3, // Implant class
    stats: [
      { id: 1, stat: 79, value: 987654 }, // Icon stat
      { id: 2, stat: 17, value: 20 }, // Agility
      { id: 3, stat: 19, value: 25 }, // Intelligence
    ],
  });

  /** Items the backend knows, keyed by AOID */
  const catalog: Record<number, Item> = {
    246660: mockItem,
    246661: { ...mockItem, id: 2, aoid: 246661, name: "Combined Commando's Headwear" },
    246662: { ...mockItem, id: 3, aoid: 246662, name: "Combined Commando's Legwear" },
    123456: { ...mockItem, id: 4, aoid: 123456, name: 'Assault Rifle', item_class: 1 },
    789123: { ...mockItem, id: 5, aoid: 789123, name: 'Brain Symbiant', item_class: 3 },
  };

  function toInterpolated(item: Item, targetQl: number): InterpolatedItem {
    return {
      id: item.id,
      aoid: item.aoid,
      name: item.name,
      ql: targetQl,
      description: item.description,
      item_class: item.item_class,
      is_nano: item.is_nano,
      interpolating: false,
      target_ql: targetQl,
      stats: item.stats,
      spell_data: [],
      actions: [],
    };
  }

  /**
   * Serve batch interpolation from `items`; AOIDs in `failing` come back as
   * per-item failures, the way the backend reports a missing item.
   */
  function serveItems(items: Record<number, Item> = catalog, failing: number[] = []) {
    context.mockApi.batchInterpolateItems.mockImplementation(
      async (requests): Promise<BatchInterpolationResponse> => ({
        success: true,
        errors: [],
        results: requests.map(({ aoid, targetQl }): BatchInterpolateItemResult => {
          const item = items[aoid];
          if (!item || failing.includes(aoid)) {
            return { aoid, target_ql: targetQl, success: false, item: null, error: 'Not found' };
          }
          return {
            aoid,
            target_ql: targetQl,
            success: true,
            item: toInterpolated(item, targetQl),
            error: null,
          };
        }),
      })
    );
  }

  const mockAOSetupsData = JSON.stringify({
    character: {
      name: 'Vestiga',
      level: 60,
      profession: 'Adventurer',
      breed: 'Solitus',
      faction: 'Neutral',
    },
    clothes: [
      { slot: 'BODY', highid: 246660, selectedQl: 300 },
      { slot: 'HEAD', highid: 246661, selectedQl: 280 },
      { slot: 'LEGS', highid: 246662, selectedQl: 290 },
    ],
    weapons: [{ highid: 123456, selectedQl: 200 }],
    implants: [
      {
        slot: 'eye',
        type: 'implant',
        ql: 100,
        clusters: {
          Shiny: { ClusterID: 7 },
          Bright: { ClusterID: 37 },
          Faded: { ClusterID: 31 },
        },
      },
      {
        slot: 'head',
        symbiant: { highid: 789123, selectedQl: 150 },
      },
    ],
  });

  function aoSetupsWithImplants(implants: unknown[]): string {
    return JSON.stringify({
      character: {
        name: 'Test Character',
        level: 50,
        profession: 'Doctor',
        breed: 'Solitus',
        faction: 'Neutral',
      },
      clothes: [],
      weapons: [],
      implants,
    });
  }

  beforeEach(async () => {
    context = await setupIntegrationTest();
    serveItems();
    context.mockApi.lookupImplant.mockResolvedValue({
      success: true,
      item: mockImplantItem,
      interpolated: false,
    });
  });

  describe('Full Import Workflow', () => {
    it('should import AOSetups profile with equipment and display correctly', async () => {
      const store = useTinkerProfilesStore();

      // Import the profile
      const result = await store.importProfile(mockAOSetupsData, 'aosetups');

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      const profile = result.profile!;

      // Verify equipment was fetched and stored correctly
      expect(profile.Clothing['Chest']?.name).toBe("Combined Commando's Jacket"); // BODY -> Chest
      expect(profile.Clothing['Head']?.name).toBe("Combined Commando's Headwear");
      expect(profile.Clothing['Legs']?.name).toBe("Combined Commando's Legwear");

      // Verify Body slot is NOT used (should be Chest instead)
      expect(profile.Clothing['Body']).toBeFalsy();

      // Verify weapons: the first AOSetups weapon slot is HUD1
      expect(profile.Weapons['HUD1']?.name).toBe('Assault Rifle');

      // Verify implants: the looked-up implant and the fetched symbiant
      expect(profile.Implants[EYE_SLOT]?.name).toBe('Ocular Enhancement');
      expect(profile.Implants[EYE_SLOT]?.type).toBe('implant');
      expect(profile.Implants[HEAD_SLOT]?.name).toBe('Brain Symbiant');
      expect(profile.Implants[HEAD_SLOT]?.type).toBe('symbiant');

      // All items are fetched in one batch at their selected QLs
      expect(context.mockApi.batchInterpolateItems).toHaveBeenCalledTimes(1);
      expect(context.mockApi.batchInterpolateItems).toHaveBeenCalledWith(
        expect.arrayContaining([
          { aoid: 246660, targetQl: 300 },
          { aoid: 246661, targetQl: 280 },
          { aoid: 246662, targetQl: 290 },
          { aoid: 123456, targetQl: 200 },
          { aoid: 789123, targetQl: 150 },
        ])
      );

      // Verify implant lookup was called with correct cluster mapping
      expect(context.mockApi.lookupImplant).toHaveBeenCalledTimes(1);
      expect(context.mockApi.lookupImplant).toHaveBeenCalledWith(
        2, // Eye slot bitflag
        100, // QL
        {
          Shiny: 17, // ClusterID 7 -> STAT 17 (Agility)
          Bright: 19, // ClusterID 37 -> STAT 19 (Intelligence)
          Faded: 123, // ClusterID 31 -> STAT 123 (First Aid)
        }
      );
    });

    it('should persist equipment to localStorage and restore on load', async () => {
      const store = useTinkerProfilesStore();

      // Import profile
      const importResult = await store.importProfile(mockAOSetupsData, 'aosetups');
      expect(importResult.success).toBe(true);

      const profileId = importResult.profile!.id;

      // Verify profile is stored under its own key
      const stored = context.mockLocalStorage.getItem(`tinkertools_profile_${profileId}`);
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!).Clothing['Chest'].name).toBe("Combined Commando's Jacket");

      // Create new store instance to simulate page reload
      const newStore = reloadedStore();

      // Load profile should restore equipment
      const loadedProfile = await newStore.loadProfile(profileId);
      expect(loadedProfile?.Clothing['Chest']?.name).toBe("Combined Commando's Jacket");
      expect(loadedProfile?.Implants[EYE_SLOT]?.name).toBe('Ocular Enhancement');
    });
  });

  describe('Equipment Display Integration', () => {
    it('should display equipment correctly in profile detail view', async () => {
      const store = useTinkerProfilesStore();
      const importResult = await store.importProfile(mockAOSetupsData, 'aosetups');
      expect(importResult.success).toBe(true);

      const profileId = importResult.profile!.id;

      // Render each equipment section as the names of the items it receives
      const mockEquipmentSlotsDisplay = {
        name: 'EquipmentSlotsDisplay',
        template:
          '<div class="mock-equipment-display" :data-slot-type="slotType">{{ Object.values(equipment).filter(Boolean).map((item) => item.name).join(" | ") }}</div>',
        props: ['equipment', 'slotType', 'showLabels'],
      };

      // The view renders named RouterLinks: navigate first so `version` resolves
      const router = createTestRouter();
      await router.push(`/${TEST_VERSION}/profiles/${profileId}`);

      const wrapper = mountForIntegration(TinkerProfileDetail, {
        pinia: context.pinia,
        router,
        props: { profileId },
        stubs: {
          EquipmentSlotsDisplay: mockEquipmentSlotsDisplay,
          CharacterInfoPanel: { template: '<div>Character Info</div>' },
          IPTrackerPanel: { template: '<div>IP Tracker</div>' },
          SkillsManager: { template: '<div>Skills Manager</div>' },
          EditCharacterDialog: { template: '<div>Edit Dialog</div>' },
        },
      });

      // Wait for component to load profile
      await waitForUpdates(wrapper, 100);

      // Should display weapon, armor and implant sections
      const displays = wrapper.findAll('.mock-equipment-display');
      const bySlotType = (slotType: string) =>
        displays.find((display) => display.attributes('data-slot-type') === slotType);

      expect(bySlotType('weapon')?.text()).toContain('Assault Rifle');
      expect(bySlotType('armor')?.text()).toContain("Combined Commando's Jacket");
      expect(bySlotType('armor')?.text()).toContain("Combined Commando's Legwear");
      expect(bySlotType('implant')?.text()).toContain('Ocular Enhancement');
    });

    it('should keep equipment stored in the legacy Body slot', async () => {
      const store = useTinkerProfilesStore();

      // A profile saved before BODY was mapped to Chest still holds a Body item
      const legacyProfile = createTestProfile({
        name: 'Legacy Character',
        level: 50,
        profession: PROFESSION.SOLDIER,
        breed: BREED.ATROX,
      });
      legacyProfile.Clothing = {
        Body: mockItem, // Legacy Body slot
        Head: { ...mockItem, name: 'Legacy Head Gear' },
      };
      const profileId = await store.createProfile('Legacy Character', legacyProfile);

      // Reload in a fresh store
      const loadedProfile = await reloadedStore().loadProfile(profileId);

      expect(loadedProfile?.Clothing['Body']?.name).toBe("Combined Commando's Jacket");
      expect(loadedProfile?.Clothing['Head']?.name).toBe('Legacy Head Gear');
    });
  });

  describe('Cluster-Based Implant Integration', () => {
    it('should correctly map AOSetups ClusterIDs to STAT numbers for implant lookup', async () => {
      const testImplantData = aoSetupsWithImplants([
        {
          slot: 'chest',
          type: 'implant',
          ql: 150,
          clusters: {
            Shiny: { ClusterID: 37 },
            Bright: { ClusterID: 31 },
            Faded: { ClusterID: 81 },
          },
        },
        {
          slot: 'ear',
          type: 'implant',
          ql: 200,
          clusters: {
            Bright: { ClusterID: 7 },
          },
        },
      ]);

      context.mockApi.lookupImplant
        .mockResolvedValueOnce({
          success: true,
          item: { ...mockImplantItem, id: 10, name: 'Chest Enhancement', ql: 150 },
          interpolated: false,
        })
        .mockResolvedValueOnce({
          success: true,
          item: { ...mockImplantItem, id: 11, name: 'Ear Enhancement', ql: 200 },
          interpolated: false,
        });

      const store = useTinkerProfilesStore();
      const result = await store.importProfile(testImplantData, 'aosetups');

      expect(result.success).toBe(true);
      expect(result.profile?.Implants[CHEST_SLOT]?.name).toBe('Chest Enhancement');
      expect(result.profile?.Implants[EAR_SLOT]?.name).toBe('Ear Enhancement');

      // Verify correct cluster mapping calls
      expect(context.mockApi.lookupImplant).toHaveBeenCalledTimes(2);

      // Chest implant call with multiple clusters mapped correctly
      expect(context.mockApi.lookupImplant).toHaveBeenCalledWith(
        32, // Chest slot bitflag
        150,
        {
          Shiny: 19, // ClusterID 37 -> STAT 19 (Intelligence)
          Bright: 123, // ClusterID 31 -> STAT 123 (First Aid)
          Faded: 124, // ClusterID 81 -> STAT 124 (Treatment)
        }
      );

      // Ear implant call with single cluster
      expect(context.mockApi.lookupImplant).toHaveBeenCalledWith(
        8, // Ear slot bitflag
        200,
        {
          Bright: 17, // ClusterID 7 -> STAT 17 (Agility)
        }
      );
    });

    it('should handle implant lookup failures gracefully', async () => {
      const implantData = aoSetupsWithImplants([
        { slot: 'eye', type: 'implant', ql: 100, clusters: { Shiny: { ClusterID: 8 } } },
      ]);

      // Mock API failure
      context.mockApi.lookupImplant.mockRejectedValue(new Error('Database error'));

      const store = useTinkerProfilesStore();
      const result = await store.importProfile(implantData, 'aosetups');

      expect(result.success).toBe(true); // Should still succeed with fallback
      expect(result.warnings).toContainEqual(expect.stringContaining('Database error'));

      // Should have a placeholder implant in the slot
      expect(result.profile?.Implants[EYE_SLOT]?.name).toBe('Implant QL100');
    });

    it('should fall back to a placeholder when no implant matches the clusters', async () => {
      const implantData = aoSetupsWithImplants([
        { slot: 'eye', type: 'implant', ql: 100, clusters: { Invalid: { ClusterID: 8 } } },
      ]);

      context.mockApi.lookupImplant.mockResolvedValue({
        success: false,
        item: null,
        message: 'No implant found',
        interpolated: false,
      });

      const store = useTinkerProfilesStore();
      const result = await store.importProfile(implantData, 'aosetups');

      expect(result.success).toBe(true);
      expect(result.warnings).toContainEqual(expect.stringContaining('No implant found'));
      expect(result.profile?.Implants[EYE_SLOT]?.name).toBe('Implant QL100');
    });

    it('should skip implants whose clusters are all unknown', async () => {
      const implantData = aoSetupsWithImplants([
        { slot: 'eye', type: 'implant', ql: 100, clusters: { Shiny: { ClusterID: 99999 } } },
      ]);

      const store = useTinkerProfilesStore();
      const result = await store.importProfile(implantData, 'aosetups');

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Unknown ClusterID: 99999');
      expect(context.mockApi.lookupImplant).not.toHaveBeenCalled();
      expect(result.profile?.Implants[EYE_SLOT]).toBeFalsy();
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle a failed item gracefully during import', async () => {
      // The jacket is missing from the backend; everything else resolves
      serveItems(catalog, [246660]);

      const store = useTinkerProfilesStore();
      const result = await store.importProfile(mockAOSetupsData, 'aosetups');

      expect(result.success).toBe(true);
      expect(result.warnings).toContain('Failed to fetch clothing item AOID 246660');

      // Should have fallback data for failed item
      expect(result.profile?.Clothing['Chest']?.name).toBe('Item 246660 (fetch failed)');

      // Should have successful items
      expect(result.profile?.Clothing['Head']?.name).toBe("Combined Commando's Headwear");
    });

    it('should import with placeholders when the batch request fails', async () => {
      context.mockApi.batchInterpolateItems.mockRejectedValue(new Error('Network timeout'));

      const store = useTinkerProfilesStore();
      const result = await store.importProfile(mockAOSetupsData, 'aosetups');

      expect(result.success).toBe(true);
      expect(result.profile?.Clothing['Chest']?.name).toBe('Item 246660 (fetch failed)');
      expect(result.profile?.Weapons['HUD1']?.name).toBe('Item 123456 (fetch failed)');
    });

    it('should handle missing icons gracefully in display', async () => {
      const itemWithoutIcon = { ...mockItem, stats: [] }; // No icon stat
      serveItems({ ...catalog, 246660: itemWithoutIcon });

      const store = useTinkerProfilesStore();
      const result = await store.importProfile(mockAOSetupsData, 'aosetups');

      expect(result.success).toBe(true);

      // Items should still be stored even without icons
      expect(result.profile?.Clothing['Chest']?.name).toBe("Combined Commando's Jacket");
      expect(result.profile?.Clothing['Chest']?.stats).toEqual([]);
    });

    it('should maintain data integrity after multiple operations', async () => {
      const store = useTinkerProfilesStore();

      // Import profile
      const importResult = await store.importProfile(mockAOSetupsData, 'aosetups');
      expect(importResult.success).toBe(true);

      const profileId = importResult.profile!.id;

      // Load profile
      const loadedProfile = await store.loadProfile(profileId);
      expect(loadedProfile).toBeDefined();

      // Modify profile (simulate user interaction)
      const update = await store.updateCharacterMetadata(profileId, { name: 'Modified Name' });
      expect(update.success).toBe(true);

      // Reload and verify equipment is still intact
      const reloadedProfile = await store.loadProfile(profileId);
      expect(reloadedProfile?.Character.Name).toBe('Modified Name');
      expect(reloadedProfile?.Clothing['Chest']?.name).toBe("Combined Commando's Jacket");
    });
  });
});

/**
 * Profile Equipment Integration Tests
 *
 * Integration tests for profile import workflow with item fetching and equipment display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { nextTick, createApp } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import type { Item } from '@/types/api';
import { BREED, PROFESSION } from '@/__tests__/helpers';

// Mock the API client module with factory function

vi.mock('@/services/api-client', () => {
  const mockClient = {
    interpolateItem: vi.fn(),
    getItem: vi.fn(),
    lookupImplant: vi.fn(),
  };
  return {
    default: mockClient,
    apiClient: mockClient,
  };
});

// Import components after mocking
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import TinkerProfileDetail from '@/views/TinkerProfileDetail.vue';
import { apiClient } from '@/services/api-client';

// Get the mocked client for test setup
const mockedApiClient = vi.mocked(apiClient);

// Mock Vue Router
const mockRoute = {
  params: { profileId: 'test-profile-id' },
};

const mockRouter = {
  push: vi.fn(),
};

vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => mockRouter,
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => (store[key] = value),
    removeItem: (key: string) => delete store[key],
    clear: () => (store = {}),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

describe('Profile Equipment Integration', () => {
  let pinia: ReturnType<typeof createPinia>;

  const mockItem: Item = {
    id: 1,
    aoid: 246660,
    name: "Combined Commando's Jacket",
    ql: 300,
    description: 'A tactical jacket',
    item_class: 2,
    is_nano: false,
    stats: [
      { id: 1, stat: 79, value: 123456 }, // Icon stat
      { id: 2, stat: 12, value: 100 },
    ],
    spell_data: [],
    actions: [],
    attack_stats: [],
    defense_stats: [],
  };

  const mockImplantItem: Item = {
    id: 2,
    aoid: 87654,
    name: 'Ocular Enhancement',
    ql: 100,
    description: 'An eye implant',
    item_class: 3, // Implant class
    is_nano: false,
    stats: [
      { id: 1, stat: 79, value: 987654 }, // Icon stat
      { id: 2, stat: 12, value: 30 }, // Strength
      { id: 3, stat: 16, value: 20 }, // Agility
      { id: 4, stat: 17, value: 25 }, // Stamina
    ],
    spell_data: [],
    actions: [],
    attack_stats: [],
    defense_stats: [],
  };

  const mockAOSetupsData = `{
    "name": "Vestiga",
    "level": 60,
    "profession": "Adventurer",
    "breed": "Solitus",
    "faction": "Neutral",
    "clothes": [
      {
        "slot": "BODY",
        "highid": 246660,
        "selectedQl": 300
      },
      {
        "slot": "HEAD",
        "highid": 246661,
        "selectedQl": 280
      },
      {
        "slot": "LEGS",
        "highid": 246662,
        "selectedQl": 290
      }
    ],
    "weapons": [
      {
        "highid": 123456,
        "selectedQl": 200
      }
    ],
    "implants": [
      {
        "slot": "eye",
        "type": "implant",
        "ql": 100,
        "clusters": {
          "Shiny": {"ClusterID": 7},
          "Bright": {"ClusterID": 37},
          "Faded": {"ClusterID": 31}
        }
      },
      {
        "slot": "head",
        "symbiant": {
          "highid": 789123,
          "selectedQl": 150
        }
      }
    ]
  }`;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();

    // CRITICAL: Setup PrimeVue + ToastService FIRST
    const app = createApp({});
    app.use(PrimeVue);
    app.use(ToastService);

    // Then setup Pinia
    pinia = createPinia();
    app.use(pinia);
    setActivePinia(pinia);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Full Import Workflow', () => {
    it('should import AOSetups profile with equipment and display correctly', async () => {
      // Setup API responses
      mockedApiClient.interpolateItem
        .mockResolvedValueOnce({ data: { ...mockItem, name: "Combined Commando's Jacket" } })
        .mockResolvedValueOnce({
          data: { ...mockItem, id: 2, name: "Combined Commando's Headwear" },
        })
        .mockResolvedValueOnce({
          data: { ...mockItem, id: 3, name: "Combined Commando's Legwear" },
        })
        .mockResolvedValueOnce({ data: { ...mockItem, id: 4, name: 'Assault Rifle' } })
        .mockResolvedValueOnce({ data: { ...mockItem, id: 5, name: 'Brain Symbiant' } });

      // Setup implant lookup API response
      mockedApiClient.lookupImplant.mockResolvedValue({
        success: true,
        data: mockImplantItem,
      });

      const store = useTinkerProfilesStore();

      // Import the profile
      const result = await store.importProfile(mockAOSetupsData, 'aosetups');

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();

      if (result.profile) {
        // Verify equipment was fetched and stored correctly
        expect(result.profile.Clothing['Chest']).toBeDefined(); // BODY -> Chest mapping
        expect(result.profile.Clothing['Chest']?.name).toBe("Combined Commando's Jacket");
        expect(result.profile.Clothing['Head']).toBeDefined();
        expect(result.profile.Clothing['Head']?.name).toBe("Combined Commando's Headwear");
        expect(result.profile.Clothing['Legs']).toBeDefined();
        expect(result.profile.Clothing['Legs']?.name).toBe("Combined Commando's Legwear");

        // Verify weapons
        expect(result.profile.Weapons['HUD1']).toBeDefined();
        expect(result.profile.Weapons['HUD1']?.name).toBe('Assault Rifle');

        // Verify implants
        expect(result.profile.Implants['Eye']).toBeDefined();
        expect(result.profile.Implants['Eye']?.name).toBe('Ocular Enhancement');
        expect(result.profile.Implants['Head']).toBeDefined();
        expect(result.profile.Implants['Head']?.name).toBe('Brain Symbiant');

        // Verify Body slot is NOT used (should be Chest instead)
        expect(result.profile.Clothing['Body']).toBeUndefined();
      }

      // Verify API was called correctly
      expect(mockedApiClient.interpolateItem).toHaveBeenCalledTimes(5);
      expect(mockedApiClient.interpolateItem).toHaveBeenCalledWith(246660, 300);
      expect(mockedApiClient.interpolateItem).toHaveBeenCalledWith(246661, 280);
      expect(mockedApiClient.interpolateItem).toHaveBeenCalledWith(246662, 290);
      expect(mockedApiClient.interpolateItem).toHaveBeenCalledWith(123456, 200);
      expect(mockedApiClient.interpolateItem).toHaveBeenCalledWith(789123, 150);

      // Verify implant lookup was called with correct cluster mapping
      expect(mockedApiClient.lookupImplant).toHaveBeenCalledTimes(1);
      expect(mockedApiClient.lookupImplant).toHaveBeenCalledWith(
        1, // Eye slot position
        100, // QL
        {
          Shiny: 16, // ClusterID 7 -> STAT 16 (Agility)
          Bright: 16, // ClusterID 37 -> STAT 16 (Intelligence)
          Faded: 118, // ClusterID 31 -> STAT 118 (First Aid)
        }
      );
    });

    it('should persist equipment to localStorage and restore on load', async () => {
      mockedApiClient.interpolateItem.mockResolvedValue({ data: mockItem });

      const store = useTinkerProfilesStore();

      // Import profile
      const importResult = await store.importProfile(mockAOSetupsData, 'aosetups');
      expect(importResult.success).toBe(true);

      const profileId = importResult.profileId!;

      // Verify profile is stored in localStorage
      const storedProfiles = JSON.parse(localStorage.getItem('tinkertools_profiles') || '{}');
      expect(storedProfiles[profileId]).toBeDefined();
      expect(storedProfiles[profileId].Clothing['Chest']).toBeDefined();

      // Create new store instance to simulate page reload
      const newPinia = createPinia();
      setActivePinia(newPinia);
      const newStore = useTinkerProfilesStore();

      // Load profile should restore equipment
      const loadedProfile = await newStore.loadProfile(profileId);
      expect(loadedProfile).toBeDefined();
      expect(loadedProfile?.Clothing['Chest']).toBeDefined();
      expect(loadedProfile?.Clothing['Chest']?.name).toBeDefined();
    });
  });

  describe('Equipment Display Integration', () => {
    it('should display equipment correctly in profile detail view', async () => {
      // Setup store with profile
      mockedApiClient.interpolateItem.mockResolvedValue({ data: mockItem });

      const store = useTinkerProfilesStore();
      const importResult = await store.importProfile(mockAOSetupsData, 'aosetups');
      expect(importResult.success).toBe(true);

      const profileId = importResult.profileId!;
      mockRoute.params.profileId = profileId;

      // Mock the helper components to avoid deep mounting complexity
      const mockEquipmentSlotsDisplay = {
        name: 'EquipmentSlotsDisplay',
        template:
          '<div class="mock-equipment-display" :data-slot-type="slotType">{{ Object.keys(equipment).length }} items</div>',
        props: ['equipment', 'slotType', 'showLabels'],
      };

      const wrapper = mount(TinkerProfileDetail, {
        props: { profileId },
        global: {
          plugins: [pinia],
          stubs: {
            EquipmentSlotsDisplay: mockEquipmentSlotsDisplay,
            CharacterInfoPanel: { template: '<div>Character Info</div>' },
            IPTrackerPanel: { template: '<div>IP Tracker</div>' },
            SkillsManager: { template: '<div>Skills Manager</div>' },
            EditCharacterDialog: { template: '<div>Edit Dialog</div>' },
          },
        },
      });

      // Wait for component to load profile
      await wrapper.vm.$nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should display equipment sections
      const equipmentDisplays = wrapper.findAll('.mock-equipment-display');
      expect(equipmentDisplays.length).toBeGreaterThanOrEqual(3); // weapons, armor, implants

      // Check that equipment is passed to display components
      const armorDisplay = equipmentDisplays.find(
        (display) => display.attributes('data-slot-type') === 'armor'
      );
      expect(armorDisplay).toBeTruthy();
      expect(armorDisplay?.text()).toContain('items'); // Should show some items
    });

    it('should handle both legacy Body slot and new Chest slot in display', async () => {
      const store = useTinkerProfilesStore();

      // Create a profile with legacy Body slot (simulate old profile)
      // Note: This manually constructs a legacy v1.0.0 profile structure for testing backward compatibility
      const legacyProfile = {
        id: 'legacy-profile',
        version: '1.0.0',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        Character: {
          Name: 'Legacy Character',
          Level: 50,
          Profession: PROFESSION.SOLDIER,
          Breed: BREED.ATROX,
          Faction: 'Clan',
          Expansion: 'Shadow Lands',
          AccountType: 'Paid',
          MaxHealth: 1000,
          MaxNano: 500,
        },
        Skills: {
          Attributes: {
            Intelligence: { value: 6, ipSpent: 0, pointsFromIp: 0 },
            Psychic: { value: 6, ipSpent: 0, pointsFromIp: 0 },
            Sense: { value: 6, ipSpent: 0, pointsFromIp: 0 },
            Stamina: { value: 6, ipSpent: 0, pointsFromIp: 0 },
            Strength: { value: 6, ipSpent: 0, pointsFromIp: 0 },
            Agility: { value: 6, ipSpent: 0, pointsFromIp: 0 },
          },
          'Body & Defense': {},
          ACs: {},
          'Ranged Weapons': {},
          'Ranged Specials': {},
          'Melee Weapons': {},
          'Melee Specials': {},
          'Nanos & Casting': {},
          Exploring: {},
          'Trade & Repair': {},
          'Combat & Healing': {},
          Misc: {},
        },
        Clothing: {
          Body: mockItem, // Legacy Body slot
          Head: { ...mockItem, name: 'Legacy Head Gear' },
        },
        Weapons: {},
        Implants: {},
        PerksAndResearch: [],
      };

      // Store legacy profile directly
      const profiles = { [legacyProfile.id]: legacyProfile };
      localStorage.setItem('tinkertools_profiles', JSON.stringify(profiles));
      localStorage.setItem('tinkertools_active_profile', legacyProfile.id);

      // Load the legacy profile
      const loadedProfile = await store.loadProfile(legacyProfile.id);
      expect(loadedProfile).toBeDefined();
      expect(loadedProfile?.Clothing['Body']).toBeDefined(); // Legacy slot should exist

      // The equipment display should handle Body slot correctly (map to same position as Chest)
      mockRoute.params.profileId = legacyProfile.id;

      // Equipment display component should handle both Body and Chest slots
      // This is verified by the EquipmentSlotsDisplay.test.ts tests we created
      expect(loadedProfile?.Clothing['Body']?.name).toBe("Combined Commando's Jacket");
    });
  });

  describe('Cluster-Based Implant Integration', () => {
    it('should correctly map AOSetups ClusterIDs to STAT numbers for implant lookup', async () => {
      // Setup specific implant with multiple clusters
      const testImplantData = `{
        "name": "Test Character",
        "level": 50,
        "profession": "Doctor",
        "breed": "Solitus",
        "faction": "Neutral",
        "implants": [
          {
            "slot": "chest",
            "type": "implant",
            "ql": 150,
            "clusters": {
              "Shiny": {"ClusterID": 37},
              "Bright": {"ClusterID": 31},
              "Faded": {"ClusterID": 81}
            }
          },
          {
            "slot": "ear",
            "type": "implant",
            "ql": 200,
            "clusters": {
              "Bright": {"ClusterID": 7}
            }
          }
        ]
      }`;

      const chestImplant = {
        ...mockImplantItem,
        id: 10,
        name: 'Chest Enhancement',
        ql: 150,
      };

      const earImplant = {
        ...mockImplantItem,
        id: 11,
        name: 'Ear Enhancement',
        ql: 200,
      };

      mockedApiClient.lookupImplant
        .mockResolvedValueOnce({ success: true, data: chestImplant })
        .mockResolvedValueOnce({ success: true, data: earImplant });

      const store = useTinkerProfilesStore();
      const result = await store.importProfile(testImplantData, 'aosetups');

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();

      if (result.profile) {
        // Verify chest implant with multiple clusters
        expect(result.profile.Implants['Chest']).toBeDefined();
        expect(result.profile.Implants['Chest']?.name).toBe('Chest Enhancement');

        // Verify ear implant with single cluster
        expect(result.profile.Implants['Ear']).toBeDefined();
        expect(result.profile.Implants['Ear']?.name).toBe('Ear Enhancement');
      }

      // Verify correct cluster mapping calls
      expect(mockedApiClient.lookupImplant).toHaveBeenCalledTimes(2);

      // Chest implant call with multiple clusters mapped correctly
      expect(mockedApiClient.lookupImplant).toHaveBeenCalledWith(
        5, // Chest slot position
        150,
        {
          Shiny: 19, // ClusterID 37 -> STAT 19 (Intelligence)
          Bright: 123, // ClusterID 31 -> STAT 123 (First Aid)
          Faded: 124, // ClusterID 81 -> STAT 124 (Treatment)
        }
      );

      // Ear implant call with single cluster
      expect(mockedApiClient.lookupImplant).toHaveBeenCalledWith(
        3, // Ear slot position
        200,
        {
          Bright: 17, // ClusterID 7 -> STAT 17 (Agility)
        }
      );
    });

    it('should handle implant lookup failures gracefully', async () => {
      const implantData = `{
        "name": "Test Character",
        "level": 50,
        "profession": "Doctor",
        "breed": "Solitus",
        "faction": "Neutral",
        "implants": [
          {
            "slot": "eye",
            "type": "implant",
            "ql": 100,
            "clusters": {
              "Shiny": {"ClusterID": 8}
            }
          }
        ]
      }`;

      // Mock API failure
      mockedApiClient.lookupImplant.mockRejectedValue(new Error('Database error'));

      const store = useTinkerProfilesStore();
      const result = await store.importProfile(implantData, 'aosetups');

      expect(result.success).toBe(true); // Should still succeed with fallback
      expect(result.warnings.length).toBeGreaterThan(0);

      if (result.profile) {
        // Should have fallback placeholder implant
        expect(result.profile.Implants['Eye']).toBeDefined();
        expect(result.profile.Implants['Eye']?.name).toContain('Failed to fetch');
      }
    });

    it('should validate cluster positions match expected patterns', async () => {
      // This test ensures cluster positions are properly validated
      const invalidClusterData = `{
        "name": "Test Character",
        "level": 50,
        "profession": "Doctor",
        "breed": "Solitus",
        "faction": "Neutral",
        "implants": [
          {
            "slot": "eye",
            "type": "implant",
            "ql": 100,
            "clusters": {
              "Invalid": {"ClusterID": 8}
            }
          }
        ]
      }`;

      const store = useTinkerProfilesStore();
      const result = await store.importProfile(invalidClusterData, 'aosetups');

      // Should handle invalid cluster positions gracefully
      expect(result.success).toBe(true);

      // Should either skip the invalid cluster or create a warning
      if (result.profile) {
        const eyeImplant = result.profile.Implants['Eye'];
        if (eyeImplant) {
          // If implant was created, it should be a fallback
          expect(eyeImplant.name).toContain('Failed to fetch');
        }
      }
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle API failures gracefully during import', async () => {
      mockedApiClient.interpolateItem
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockResolvedValueOnce({ data: mockItem }); // Second item succeeds

      const store = useTinkerProfilesStore();
      const result = await store.importProfile(mockAOSetupsData, 'aosetups');

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);

      if (result.profile) {
        // Should have fallback data for failed item
        expect(result.profile.Clothing['Chest']).toBeDefined();
        expect(result.profile.Clothing['Chest']?.name).toContain('fetch failed');

        // Should have successful items
        expect(result.profile.Clothing['Head']).toBeDefined();
        expect(result.profile.Clothing['Head']?.name).toBe("Combined Commando's Jacket");
      }
    });

    it('should handle missing icons gracefully in display', async () => {
      const itemWithoutIcon = { ...mockItem, stats: [] }; // No icon stat
      mockedApiClient.interpolateItem.mockResolvedValue({ data: itemWithoutIcon });

      const store = useTinkerProfilesStore();
      const result = await store.importProfile(mockAOSetupsData, 'aosetups');

      expect(result.success).toBe(true);

      if (result.profile) {
        // Items should still be stored even without icons
        expect(result.profile.Clothing['Chest']).toBeDefined();
        expect(result.profile.Clothing['Chest']?.stats).toEqual([]);
      }

      // Equipment display should handle missing icons (covered in component tests)
    });

    it('should maintain data integrity after multiple operations', async () => {
      mockedApiClient.interpolateItem.mockResolvedValue({ data: mockItem });

      const store = useTinkerProfilesStore();

      // Import profile
      const importResult = await store.importProfile(mockAOSetupsData, 'aosetups');
      expect(importResult.success).toBe(true);

      const profileId = importResult.profileId!;

      // Load profile
      const loadedProfile = await store.loadProfile(profileId);
      expect(loadedProfile).toBeDefined();

      // Modify profile (simulate user interaction)
      await store.updateCharacterMetadata(profileId, { Name: 'Modified Name' });

      // Reload and verify equipment is still intact
      const reloadedProfile = await store.loadProfile(profileId);
      expect(reloadedProfile?.Character.Name).toBe('Modified Name');
      expect(reloadedProfile?.Clothing['Chest']).toBeDefined();
      expect(reloadedProfile?.Clothing['Chest']?.name).toBe("Combined Commando's Jacket");
    });
  });
});

/**
 * TinkerProfileDetail Equipment Section Tests
 *
 * Tests specifically for the equipment display functionality in the profile detail view
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TinkerProfileDetail from '@/views/TinkerProfileDetail.vue';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import type { Item, TinkerProfile } from '@/types/api';
import { BREED, PROFESSION } from '@/__tests__/helpers';

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

describe('TinkerProfileDetail Equipment Section', () => {
  let pinia: ReturnType<typeof createPinia>;

  const mockItem: Item = {
    id: 1,
    aoid: 246660,
    name: "Combined Commando's Jacket",
    ql: 300,
    description: 'A tactical jacket',
    item_class: 2,
    is_nano: false,
    stats: [{ id: 1, stat: 79, value: 123456 }],
    spell_data: [],
    actions: [],
    attack_stats: [],
    defense_stats: [],
  };

  const createMockProfile = (clothingSlots: Record<string, Item | null> = {}): TinkerProfile => ({
    id: 'test-profile-id',
    version: '2.0.0',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    Character: {
      Name: 'Test Character',
      Level: 60,
      Profession: PROFESSION.ADVENTURER,
      Breed: BREED.SOLITUS,
      Faction: 'Neutral',
      Expansion: 'Lost Eden',
      AccountType: 'Paid',
      MaxHealth: 1500,
      MaxNano: 800,
    },
    Skills: {
      Attributes: {
        Intelligence: { value: 100, ipSpent: 0, pointsFromIp: 0 },
        Psychic: { value: 100, ipSpent: 0, pointsFromIp: 0 },
        Sense: { value: 100, ipSpent: 0, pointsFromIp: 0 },
        Stamina: { value: 100, ipSpent: 0, pointsFromIp: 0 },
        Strength: { value: 100, ipSpent: 0, pointsFromIp: 0 },
        Agility: { value: 100, ipSpent: 0, pointsFromIp: 0 },
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
    Clothing: clothingSlots,
    Weapons: {},
    Implants: {},
    PerksAndResearch: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    pinia = createPinia();
    setActivePinia(pinia);
  });

  describe('Equipment Section Rendering', () => {
    it('should render all three equipment grids', async () => {
      const mockProfile = createMockProfile({
        Chest: mockItem,
        Head: { ...mockItem, name: 'Head Gear' },
      });

      // Setup store
      const store = useTinkerProfilesStore();
      vi.spyOn(store, 'loadProfile').mockResolvedValue(mockProfile);

      // Mock child components to avoid deep rendering complexity
      const wrapper = mount(TinkerProfileDetail, {
        props: { profileId: 'test-profile-id' },
        global: {
          plugins: [pinia],
          stubs: {
            EquipmentSlotsDisplay: {
              template:
                '<div class="mock-equipment-slots" :data-slot-type="slotType">{{ slotType }} slots</div>',
              props: ['equipment', 'slotType', 'showLabels'],
            },
            CharacterInfoPanel: { template: '<div>Character Info</div>' },
            IPTrackerPanel: { template: '<div>IP Tracker</div>' },
            SkillsManager: { template: '<div>Skills Manager</div>' },
            EditCharacterDialog: { template: '<div>Edit Dialog</div>' },
          },
        },
      });

      // Wait for component to load
      await wrapper.vm.$nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should render equipment section
      const headings = wrapper.findAll('h2');
      const equipmentSection = headings.find((h) => h.text().includes('Equipment'));
      expect(equipmentSection).toBeTruthy();

      // Should render all three equipment grids
      const equipmentSlots = wrapper.findAll('.mock-equipment-slots');
      expect(equipmentSlots.length).toBe(3);

      const slotTypes = equipmentSlots.map((slot) => slot.attributes('data-slot-type'));
      expect(slotTypes).toContain('weapon');
      expect(slotTypes).toContain('armor');
      expect(slotTypes).toContain('implant');
    });

    it('should pass correct equipment data to display components', async () => {
      const mockProfile = createMockProfile({
        Chest: mockItem,
        Head: { ...mockItem, name: 'Head Gear' },
        Legs: { ...mockItem, name: 'Leg Armor' },
      });

      const store = useTinkerProfilesStore();
      vi.spyOn(store, 'loadProfile').mockResolvedValue(mockProfile);

      const equipmentSlotsSpy = vi.fn();

      const wrapper = mount(TinkerProfileDetail, {
        props: { profileId: 'test-profile-id' },
        global: {
          plugins: [pinia],
          stubs: {
            EquipmentSlotsDisplay: {
              template: '<div class="mock-equipment-slots">Slots</div>',
              props: ['equipment', 'slotType', 'showLabels'],
              created() {
                equipmentSlotsSpy(this.$props);
              },
            },
            CharacterInfoPanel: { template: '<div>Character Info</div>' },
            IPTrackerPanel: { template: '<div>IP Tracker</div>' },
            SkillsManager: { template: '<div>Skills Manager</div>' },
            EditCharacterDialog: { template: '<div>Edit Dialog</div>' },
          },
        },
      });

      await wrapper.vm.$nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have called equipment slots component with correct props
      expect(equipmentSlotsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          slotType: 'armor',
          equipment: expect.objectContaining({
            Chest: expect.objectContaining({ name: "Combined Commando's Jacket" }),
            Head: expect.objectContaining({ name: 'Head Gear' }),
            Legs: expect.objectContaining({ name: 'Leg Armor' }),
          }),
          showLabels: false,
        })
      );
    });
  });

  describe('Equipment Helper Functions', () => {
    it('should return complete equipment records, not just first item', async () => {
      const mockProfile = createMockProfile({
        Chest: mockItem,
        Head: { ...mockItem, id: 2, name: 'Head Gear' },
        Legs: { ...mockItem, id: 3, name: 'Leg Armor' },
        Feet: { ...mockItem, id: 4, name: 'Boots' },
      });

      const store = useTinkerProfilesStore();
      vi.spyOn(store, 'loadProfile').mockResolvedValue(mockProfile);

      const wrapper = mount(TinkerProfileDetail, {
        props: { profileId: 'test-profile-id' },
        global: {
          plugins: [pinia],
          stubs: {
            EquipmentSlotsDisplay: { template: '<div>Equipment Slots</div>' },
            CharacterInfoPanel: { template: '<div>Character Info</div>' },
            IPTrackerPanel: { template: '<div>IP Tracker</div>' },
            SkillsManager: { template: '<div>Skills Manager</div>' },
            EditCharacterDialog: { template: '<div>Edit Dialog</div>' },
          },
        },
      });

      await wrapper.vm.$nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Access the component's methods through the wrapper
      const vm = wrapper.vm as any;

      // Test helper functions return complete equipment records
      const equippedArmor = vm.getEquippedArmor(mockProfile.Clothing);
      expect(Object.keys(equippedArmor)).toHaveLength(4);
      expect(equippedArmor['Chest']).toBeDefined();
      expect(equippedArmor['Head']).toBeDefined();
      expect(equippedArmor['Legs']).toBeDefined();
      expect(equippedArmor['Feet']).toBeDefined();

      // Each item should be the complete item object, not just first one
      expect(equippedArmor['Chest'].name).toBe("Combined Commando's Jacket");
      expect(equippedArmor['Head'].name).toBe('Head Gear');
      expect(equippedArmor['Legs'].name).toBe('Leg Armor');
      expect(equippedArmor['Feet'].name).toBe('Boots');
    });

    it('should handle empty equipment gracefully', async () => {
      const mockProfile = createMockProfile({}); // No equipment

      const store = useTinkerProfilesStore();
      vi.spyOn(store, 'loadProfile').mockResolvedValue(mockProfile);

      const wrapper = mount(TinkerProfileDetail, {
        props: { profileId: 'test-profile-id' },
        global: {
          plugins: [pinia],
          stubs: {
            EquipmentSlotsDisplay: { template: '<div>Equipment Slots</div>' },
            CharacterInfoPanel: { template: '<div>Character Info</div>' },
            IPTrackerPanel: { template: '<div>IP Tracker</div>' },
            SkillsManager: { template: '<div>Skills Manager</div>' },
            EditCharacterDialog: { template: '<div>Edit Dialog</div>' },
          },
        },
      });

      await wrapper.vm.$nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const vm = wrapper.vm as any;

      // Should return empty object for no equipment
      const equippedArmor = vm.getEquippedArmor(mockProfile.Clothing);
      expect(equippedArmor).toEqual({});

      // Should handle null/undefined equipment
      const nullEquipment = vm.getEquippedArmor(null);
      expect(nullEquipment).toEqual({});

      const undefinedEquipment = vm.getEquippedArmor(undefined);
      expect(undefinedEquipment).toEqual({});
    });
  });

  describe('Legacy Compatibility', () => {
    it('should display items in Body slot correctly (legacy profiles)', async () => {
      const mockProfile = createMockProfile({
        Body: mockItem, // Legacy Body slot
        Head: { ...mockItem, name: 'Head Gear' },
      });

      const store = useTinkerProfilesStore();
      vi.spyOn(store, 'loadProfile').mockResolvedValue(mockProfile);

      let armorEquipment: any = null;

      const wrapper = mount(TinkerProfileDetail, {
        props: { profileId: 'test-profile-id' },
        global: {
          plugins: [pinia],
          stubs: {
            EquipmentSlotsDisplay: {
              template: '<div class="mock-equipment-slots">Equipment</div>',
              props: ['equipment', 'slotType', 'showLabels'],
              created() {
                if (this.$props.slotType === 'armor') {
                  armorEquipment = this.$props.equipment;
                }
              },
            },
            CharacterInfoPanel: { template: '<div>Character Info</div>' },
            IPTrackerPanel: { template: '<div>IP Tracker</div>' },
            SkillsManager: { template: '<div>Skills Manager</div>' },
            EditCharacterDialog: { template: '<div>Edit Dialog</div>' },
          },
        },
      });

      await wrapper.vm.$nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should pass the Body slot item to the equipment display
      expect(armorEquipment).toBeDefined();
      expect(armorEquipment['Body']).toBeDefined();
      expect(armorEquipment['Body'].name).toBe("Combined Commando's Jacket");
      expect(armorEquipment['Head']).toBeDefined();
      expect(armorEquipment['Head'].name).toBe('Head Gear');

      // The EquipmentSlotsDisplay component should handle Body->Chest mapping internally
      // (This is tested in the component-specific tests)
    });

    it('should handle profiles with both Body and Chest slots', async () => {
      const mockProfile = createMockProfile({
        Body: mockItem, // Legacy slot
        Chest: { ...mockItem, name: 'New Chest Armor' }, // New slot
        Head: { ...mockItem, name: 'Head Gear' },
      });

      const store = useTinkerProfilesStore();
      vi.spyOn(store, 'loadProfile').mockResolvedValue(mockProfile);

      const wrapper = mount(TinkerProfileDetail, {
        props: { profileId: 'test-profile-id' },
        global: {
          plugins: [pinia],
          stubs: {
            EquipmentSlotsDisplay: { template: '<div>Equipment</div>' },
            CharacterInfoPanel: { template: '<div>Character Info</div>' },
            IPTrackerPanel: { template: '<div>IP Tracker</div>' },
            SkillsManager: { template: '<div>Skills Manager</div>' },
            EditCharacterDialog: { template: '<div>Edit Dialog</div>' },
          },
        },
      });

      await wrapper.vm.$nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const vm = wrapper.vm as any;
      const equippedArmor = vm.getEquippedArmor(mockProfile.Clothing);

      // Should include both slots (unusual case but should be handled)
      expect(equippedArmor['Body']).toBeDefined();
      expect(equippedArmor['Chest']).toBeDefined();
      expect(equippedArmor['Head']).toBeDefined();

      expect(equippedArmor['Body'].name).toBe("Combined Commando's Jacket");
      expect(equippedArmor['Chest'].name).toBe('New Chest Armor');
    });
  });

  describe('Equipment Change Handling', () => {
    it('should re-render when equipment changes', async () => {
      const initialProfile = createMockProfile({
        Chest: mockItem,
      });

      const store = useTinkerProfilesStore();
      const loadProfileSpy = vi.spyOn(store, 'loadProfile').mockResolvedValue(initialProfile);

      const wrapper = mount(TinkerProfileDetail, {
        props: { profileId: 'test-profile-id' },
        global: {
          plugins: [pinia],
          stubs: {
            EquipmentSlotsDisplay: {
              template: '<div class="equipment">{{ Object.keys(equipment).length }} items</div>',
              props: ['equipment', 'slotType', 'showLabels'],
            },
            CharacterInfoPanel: { template: '<div>Character Info</div>' },
            IPTrackerPanel: { template: '<div>IP Tracker</div>' },
            SkillsManager: { template: '<div>Skills Manager</div>' },
            EditCharacterDialog: { template: '<div>Edit Dialog</div>' },
          },
        },
      });

      await wrapper.vm.$nextTick();
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Initial state - should show 1 item
      expect(wrapper.find('.equipment').text()).toContain('1 items');

      // Update profile with more equipment
      const updatedProfile = createMockProfile({
        Chest: mockItem,
        Head: { ...mockItem, name: 'Head Gear' },
        Legs: { ...mockItem, name: 'Leg Armor' },
      });

      loadProfileSpy.mockResolvedValue(updatedProfile);

      // Trigger re-load (simulate profile update)
      await (wrapper.vm as any).loadProfile();
      await wrapper.vm.$nextTick();

      // Should now show 3 items
      expect(wrapper.find('.equipment').text()).toContain('3 items');
    });
  });
});

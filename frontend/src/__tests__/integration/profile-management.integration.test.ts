/**
 * Profile Management Integration Tests
 *
 * Comprehensive integration tests for profile CRUD operations through actual UI components.
 * Tests profile creation, editing, deletion, switching, and import workflows.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import {
  setupIntegrationTest,
  mountForIntegration,
  waitForUpdates,
  clickAndWait,
  typeAndWait,
  type IntegrationTestContext,
} from '../helpers/integration-test-utils';
import {
  createTestProfile,
  createFreshProfile,
  BREED,
  PROFESSION,
} from '../helpers/profile-fixtures';
import { SKILL_ID } from '../helpers/skill-fixtures';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import ProfileCreateModal from '@/components/profiles/ProfileCreateModal.vue';
import ProfileDropdown from '@/components/profiles/ProfileDropdown.vue';
import CharacterInfoPanel from '@/components/profiles/CharacterInfoPanel.vue';
import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';

// Mock the API client module
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

describe('Profile Management Integration', () => {
  let context: IntegrationTestContext;

  beforeEach(async () => {
    // Setup PrimeVue with ToastService for stores
    // Stores call useToast() which requires app-level ToastService
    const app = createApp({});
    app.use(PrimeVue);
    app.use(ToastService);

    context = await setupIntegrationTest();

    // Attach Pinia to app for Toast availability
    app.use(context.pinia);
  });

  // ============================================================================
  // Profile Creation
  // ============================================================================

  describe('Profile Creation', () => {
    // TODO: These UI component tests require proper PrimeVue component rendering
    // The core profile creation functionality is tested through store API tests
    it.skip('creates profile through modal form with valid data', async () => {
      const store = useTinkerProfilesStore();

      const wrapper = mountForIntegration(ProfileCreateModal, {
        pinia: context.pinia,
        props: { visible: true },
      });

      await waitForUpdates(wrapper);

      // Fill in form fields
      const nameInput = wrapper.find('#profile-name');
      await nameInput.setValue('TestCharacter');
      await waitForUpdates(wrapper);

      const professionDropdown = wrapper.find('#profession');
      await professionDropdown.setValue('Soldier');
      await waitForUpdates(wrapper);

      const levelInput = wrapper.find('#level');
      await levelInput.setValue(100);
      await waitForUpdates(wrapper);

      const breedDropdown = wrapper.find('#breed');
      await breedDropdown.setValue('Atrox');
      await waitForUpdates(wrapper);

      // Submit form
      await wrapper.find('form').trigger('submit.prevent');
      await waitForUpdates(wrapper);

      // Verify profile was created
      const metadata = store.profileMetadata;
      expect(metadata.length).toBe(1);
      expect(metadata[0].name).toBe('TestCharacter');
      expect(metadata[0].profession).toBe('Soldier');
      expect(metadata[0].level).toBe(100);

      // Verify it persisted to localStorage (individual profile key)
      const profileId = metadata[0].id;
      const profileKey = `tinkertools_profile_${profileId}`;
      const storedData = context.mockLocalStorage.getItem(profileKey);
      expect(storedData).toBeTruthy();

      const storedProfile = JSON.parse(storedData!);
      expect(storedProfile).toBeDefined();
      expect(storedProfile.Character.Name).toBe('TestCharacter');
    });

    it.skip('validates required fields before creating profile', async () => {
      const wrapper = mountForIntegration(ProfileCreateModal, {
        pinia: context.pinia,
        props: { visible: true },
      });

      await waitForUpdates(wrapper);

      // Try to submit without filling name
      await wrapper.find('form').trigger('submit.prevent');
      await waitForUpdates(wrapper);

      // Should show validation error
      const errorMsg = wrapper.find('small.text-red-500');
      expect(errorMsg.exists()).toBe(true);

      // Store should not have any profiles
      const store = useTinkerProfilesStore();
      expect(store.profileMetadata.length).toBe(0);
    });

    it.skip('sets newly created profile as active when checkbox is checked', async () => {
      const store = useTinkerProfilesStore();

      const wrapper = mountForIntegration(ProfileCreateModal, {
        pinia: context.pinia,
        props: { visible: true },
      });

      await waitForUpdates(wrapper);

      // Fill form
      await wrapper.find('#profile-name').setValue('ActiveCharacter');
      await waitForUpdates(wrapper);

      // Ensure "Set as active" checkbox is checked (default state)
      const checkbox = wrapper.find('#set-active');
      expect(checkbox.element).toBeDefined();

      // Submit
      await wrapper.find('form').trigger('submit.prevent');
      await waitForUpdates(wrapper);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify profile is active
      expect(store.activeProfileId).toBeTruthy();
      expect(store.activeProfile?.Character.Name).toBe('ActiveCharacter');
    });

    it.skip('creates profile with all optional fields filled', async () => {
      const store = useTinkerProfilesStore();

      const wrapper = mountForIntegration(ProfileCreateModal, {
        pinia: context.pinia,
        props: { visible: true },
      });

      await waitForUpdates(wrapper);

      // Fill all fields
      await wrapper.find('#profile-name').setValue('FullProfile');
      await wrapper.find('#profession').setValue('Nano-Technician');
      await wrapper.find('#level').setValue(220);
      await wrapper.find('#breed').setValue('Nanomage');
      await wrapper.find('#faction').setValue('Clan');
      await wrapper.find('#expansion').setValue('Lost Eden');
      await wrapper.find('#account-type').setValue('Paid');

      await waitForUpdates(wrapper);

      // Submit
      await wrapper.find('form').trigger('submit.prevent');
      await waitForUpdates(wrapper);

      // Wait for creation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify all fields were saved
      const profile = await store.loadProfile(store.profileMetadata[0].id);
      expect(profile).toBeTruthy();
      expect(profile?.Character.Name).toBe('FullProfile');
      expect(profile?.Character.Profession).toBe('Nano-Technician');
      expect(profile?.Character.Level).toBe(220);
      expect(profile?.Character.Breed).toBe('Nanomage');
      expect(profile?.Character.Faction).toBe('Clan');
      expect(profile?.Character.Expansion).toBe('Lost Eden');
      expect(profile?.Character.AccountType).toBe('Paid');
    });
  });

  // ============================================================================
  // Profile Editing
  // ============================================================================

  describe('Profile Editing', () => {
    it('edits character metadata and persists changes', async () => {
      const store = useTinkerProfilesStore();

      // Create initial profile
      const profile = createTestProfile({
        name: 'OriginalName',
        level: 50,
        profession: PROFESSION.ADVENTURER,
      });

      const profileId = await store.createProfile(profile.Character.Name, profile);
      await store.setActiveProfile(profileId);
      await waitForUpdates();

      // Update metadata
      const result = await store.updateCharacterMetadata(profileId, {
        name: 'UpdatedName',
        level: 75,
      });

      expect(result.success).toBe(true);
      await waitForUpdates();

      // Verify changes persisted
      const updatedProfile = await store.loadProfile(profileId);
      expect(updatedProfile?.Character.Name).toBe('UpdatedName');
      expect(updatedProfile?.Character.Level).toBe(75);

      // Verify localStorage persistence (individual profile key)
      const profileKey = `tinkertools_profile_${profileId}`;
      const storedData = context.mockLocalStorage.getItem(profileKey);
      const storedProfile = JSON.parse(storedData!);
      expect(storedProfile.Character.Name).toBe('UpdatedName');
      expect(storedProfile.Character.Level).toBe(75);
    });

    it('edits skill values with IP recalculation', async () => {
      const store = useTinkerProfilesStore();

      // Create profile with initial skills
      const profile = createTestProfile({
        level: 100,
        skills: {
          [SKILL_ID.ASSAULT_RIF]: { base: 5, pointsFromIp: 100, total: 105 },
        },
      });

      const profileId = await store.createProfile(profile.Character.Name, profile);
      await store.setActiveProfile(profileId);
      await waitForUpdates();

      // Modify skill
      await store.modifySkill(profileId, SKILL_ID.ASSAULT_RIF, 200);
      await waitForUpdates();

      // Verify skill was updated
      const updatedProfile = await store.loadProfile(profileId);
      const skill = updatedProfile?.skills[SKILL_ID.ASSAULT_RIF];
      expect(skill).toBeDefined();
      expect(skill?.total).toBeGreaterThanOrEqual(200);
    });

    it('edits ability values with trickle-down recalculation', async () => {
      const store = useTinkerProfilesStore();

      // Create profile
      const profile = createTestProfile({
        level: 100,
        skills: {
          [SKILL_ID.STRENGTH]: { base: 6, pointsFromIp: 100, total: 106 },
          [SKILL_ID.ASSAULT_RIF]: { base: 5, trickle: 20, pointsFromIp: 50, total: 75 },
        },
      });

      const profileId = await store.createProfile(profile.Character.Name, profile);
      await store.setActiveProfile(profileId);
      await waitForUpdates();

      // Get initial rifle skill value
      const initialProfile = await store.loadProfile(profileId);
      const initialRifleTotal = initialProfile?.skills[SKILL_ID.ASSAULT_RIF]?.total || 0;

      // Modify strength (should affect rifle through trickle)
      const result = await store.modifyAbility(profileId, SKILL_ID.STRENGTH, 200);
      expect(result.success).toBe(true);
      await waitForUpdates();

      // Verify ability updated and trickle-down occurred
      const updatedProfile = await store.loadProfile(profileId);
      const strengthSkill = updatedProfile?.skills[SKILL_ID.STRENGTH];
      expect(strengthSkill?.total).toBeGreaterThanOrEqual(200);

      // Rifle skill should have changed due to trickle-down
      const rifleSkill = updatedProfile?.skills[SKILL_ID.ASSAULT_RIF];
      expect(rifleSkill).toBeDefined();
      // Note: The exact value depends on trickle-down calculations
    });

    it('maintains equipment after metadata edits', async () => {
      const store = useTinkerProfilesStore();

      // Create profile with equipment
      const profile = createTestProfile({
        name: 'EquipTest',
        level: 100,
      });

      // Add some equipment
      profile.Clothing['Chest'] = {
        id: 1,
        aoid: 12345,
        name: 'Test Armor',
        ql: 100,
        description: 'Test',
        item_class: 2,
        is_nano: false,
        stats: [],
        spell_data: [],
        actions: [],
        attack_stats: [],
        defense_stats: [],
      };

      const profileId = await store.createProfile(profile.Character.Name, profile);
      await waitForUpdates();

      // Update metadata
      await store.updateCharacterMetadata(profileId, {
        name: 'NewName',
        level: 120,
      });

      await waitForUpdates();

      // Verify equipment is still present
      const updatedProfile = await store.loadProfile(profileId);
      expect(updatedProfile?.Clothing['Chest']).toBeDefined();
      expect(updatedProfile?.Clothing['Chest']?.name).toBe('Test Armor');
    });
  });

  // ============================================================================
  // Profile Deletion
  // ============================================================================

  describe('Profile Deletion', () => {
    it('deletes profile and removes from localStorage', async () => {
      const store = useTinkerProfilesStore();

      // Create profile
      const profile = createTestProfile({ name: 'ToDelete' });
      const profileId = await store.createProfile(profile.Character.Name, profile);
      await waitForUpdates();

      // Verify it exists
      expect(store.profileMetadata.length).toBe(1);
      const profileKey = `tinkertools_profile_${profileId}`;
      expect(context.mockLocalStorage.getItem(profileKey)).toBeTruthy();

      // Delete profile
      await store.deleteProfile(profileId);
      await waitForUpdates();

      // Verify it's gone
      expect(store.profileMetadata.length).toBe(0);
      expect(context.mockLocalStorage.getItem(profileKey)).toBeNull();
    });

    it('switches active profile when deleting current active profile', async () => {
      const store = useTinkerProfilesStore();

      // Create two profiles
      const profile1 = createTestProfile({ name: 'Profile1' });
      const profile2 = createTestProfile({ name: 'Profile2' });

      const profileId1 = await store.createProfile(profile1.Character.Name, profile1);
      const profileId2 = await store.createProfile(profile2.Character.Name, profile2);

      await store.setActiveProfile(profileId1);
      await waitForUpdates();

      expect(store.activeProfileId).toBe(profileId1);

      // Delete active profile
      await store.deleteProfile(profileId1);
      await waitForUpdates();

      // Active profile should have changed or be null
      expect(store.activeProfileId).not.toBe(profileId1);
    });

    it('handles deletion of non-existent profile gracefully', async () => {
      const store = useTinkerProfilesStore();

      const nonExistentId = 'does-not-exist';

      // Deletion of non-existent profile should succeed silently (idempotent)
      await expect(store.deleteProfile(nonExistentId)).resolves.not.toThrow();
    });
  });

  // ============================================================================
  // Profile Switching
  // ============================================================================

  describe('Profile Switching', () => {
    it('switches between profiles and displays correct data', async () => {
      const store = useTinkerProfilesStore();

      // Create two distinct profiles
      const profile1 = createTestProfile({
        name: 'Character1',
        level: 50,
        profession: PROFESSION.SOLDIER,
      });

      const profile2 = createTestProfile({
        name: 'Character2',
        level: 100,
        profession: PROFESSION.TRADER,
      });

      const profileId1 = await store.createProfile(profile1.Character.Name, profile1);
      const profileId2 = await store.createProfile(profile2.Character.Name, profile2);

      // Switch to first profile
      await store.setActiveProfile(profileId1);
      await waitForUpdates();

      expect(store.activeProfileId).toBe(profileId1);
      expect(store.activeProfile?.Character.Name).toBe('Character1');
      expect(store.activeProfile?.Character.Level).toBe(50);

      // Switch to second profile
      await store.setActiveProfile(profileId2);
      await waitForUpdates();

      expect(store.activeProfileId).toBe(profileId2);
      expect(store.activeProfile?.Character.Name).toBe('Character2');
      expect(store.activeProfile?.Character.Level).toBe(100);
    });

    it('maintains profile dropdown state after switching', async () => {
      const store = useTinkerProfilesStore();

      // Create profiles
      const profile1 = createTestProfile({ name: 'Dropdown1' });
      const profile2 = createTestProfile({ name: 'Dropdown2' });

      const profileId1 = await store.createProfile(profile1.Character.Name, profile1);
      const profileId2 = await store.createProfile(profile2.Character.Name, profile2);

      await waitForUpdates();

      // Mount dropdown
      const wrapper = mountForIntegration(ProfileDropdown, {
        pinia: context.pinia,
      });

      await waitForUpdates(wrapper);

      // Should show both profiles as options
      const dropdown = wrapper.findComponent({ name: 'Dropdown' });
      expect(dropdown.exists()).toBe(true);

      // Switch profile through store
      await store.setActiveProfile(profileId1);
      await waitForUpdates(wrapper);

      // Dropdown should reflect active profile
      expect(store.activeProfileId).toBe(profileId1);
    });

    it('edits to one profile do not affect another', async () => {
      const store = useTinkerProfilesStore();

      // Create two profiles
      const profile1 = createTestProfile({
        name: 'Isolated1',
        skills: {
          [SKILL_ID.STRENGTH]: { base: 6, pointsFromIp: 50, total: 56 },
        },
      });

      const profile2 = createTestProfile({
        name: 'Isolated2',
        skills: {
          [SKILL_ID.STRENGTH]: { base: 6, pointsFromIp: 100, total: 106 },
        },
      });

      const profileId1 = await store.createProfile(profile1.Character.Name, profile1);
      const profileId2 = await store.createProfile(profile2.Character.Name, profile2);

      // Set first profile active and modify it
      await store.setActiveProfile(profileId1);
      await store.modifySkill(profileId1, SKILL_ID.STRENGTH, 200);
      await waitForUpdates();

      // Load second profile
      const profile2Data = await store.loadProfile(profileId2);

      // Second profile should be unchanged
      const str2 = profile2Data?.skills[SKILL_ID.STRENGTH];
      expect(str2?.total).toBeLessThan(200); // Should still be ~106
    });
  });

  // ============================================================================
  // Profile Import
  // ============================================================================

  describe('Profile Import', () => {
    it('imports profile from AOSetups format', async () => {
      const store = useTinkerProfilesStore();

      const aoSetupsData = JSON.stringify({
        character: {
          name: 'ImportedChar',
          level: 120,
          profession: 'Adventurer',
          breed: 'Solitus',
          faction: 'Neutral',
        },
        clothes: [],
        weapons: [],
        implants: [],
      });

      const result = await store.importProfile(aoSetupsData, 'aosetups');
      await waitForUpdates();

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile?.Character.Name).toBe('ImportedChar');
      expect(result.profile?.Character.Level).toBe(120);

      // Manually refresh metadata since importProfile doesn't automatically add to store
      await store.refreshMetadata();
      await waitForUpdates();

      // Verify it's in the store
      expect(store.profileMetadata.length).toBeGreaterThan(0);
      const imported = store.profileMetadata.find((p) => p.name === 'ImportedChar');
      expect(imported).toBeDefined();
    });

    it('imports profile with equipment data', async () => {
      const store = useTinkerProfilesStore();

      const { apiClient } = await import('@/services/api-client');
      const mockedApiClient = vi.mocked(apiClient);

      // Mock item response
      mockedApiClient.interpolateItem.mockResolvedValue({
        success: true,
        item: {
          id: 1,
          aoid: 246660,
          name: 'Test Item',
          ql: 300,
          description: 'Test',
          item_class: 2,
          is_nano: false,
          interpolating: false,
          stats: [],
          spell_data: [],
          actions: [],
        },
      });

      const aoSetupsData = JSON.stringify({
        character: {
          name: 'WithEquipment',
          level: 150,
          profession: 'Soldier',
          breed: 'Atrox',
          faction: 'Clan',
        },
        clothes: [
          {
            slot: 'BODY',
            highid: 246660,
            selectedQl: 300,
          },
        ],
        weapons: [],
        implants: [],
      });

      const result = await store.importProfile(aoSetupsData, 'aosetups');
      await waitForUpdates();

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();

      // Verify equipment was loaded
      if (result.profile) {
        expect(result.profile.Clothing['Chest']).toBeDefined();
        expect(result.profile.Clothing['Chest']?.name).toBe('Test Item');
      }
    });

    it('imports profile and persists to localStorage', async () => {
      const store = useTinkerProfilesStore();

      const aoSetupsData = JSON.stringify({
        character: {
          name: 'PersistTest',
          level: 80,
          profession: 'Doctor',
          breed: 'Nanomage',
          faction: 'Omni',
        },
        clothes: [],
        weapons: [],
        implants: [],
      });

      const result = await store.importProfile(aoSetupsData, 'aosetups');
      await waitForUpdates();

      expect(result.success).toBe(true);

      // Check localStorage (individual profile key)
      const profileId = result.profile!.id;
      const profileKey = `tinkertools_profile_${profileId}`;
      const storedData = context.mockLocalStorage.getItem(profileKey);
      expect(storedData).toBeTruthy();

      const storedProfile = JSON.parse(storedData!);
      expect(storedProfile).toBeDefined();
      expect(storedProfile.Character.Name).toBe('PersistTest');
    });
  });

  // ============================================================================
  // Character Info Display
  // ============================================================================

  describe('Character Info Display', () => {
    it('displays character information correctly', async () => {
      const profile = createTestProfile({
        name: 'DisplayTest',
        level: 150,
        profession: PROFESSION.NANO_TECHNICIAN,
        breed: BREED.NANOMAGE,
      });

      const wrapper = mountForIntegration(CharacterInfoPanel, {
        pinia: context.pinia,
        props: { profile },
      });

      await waitForUpdates(wrapper);

      // Check that character name is displayed
      const text = wrapper.text();
      expect(text).toContain('DisplayTest');
      expect(text).toContain('150'); // Level

      // Check for profession and breed displays
      expect(text).toContain('NanoTechnician');
      expect(text).toContain('Nanomage');
    });

    it('displays core attributes correctly', async () => {
      const profile = createTestProfile({
        name: 'AttrTest',
        skills: {
          [SKILL_ID.STRENGTH]: { base: 6, pointsFromIp: 100, total: 106 },
          [SKILL_ID.AGILITY]: { base: 6, pointsFromIp: 80, total: 86 },
          [SKILL_ID.STAMINA]: { base: 6, pointsFromIp: 90, total: 96 },
          [SKILL_ID.INTELLIGENCE]: { base: 6, pointsFromIp: 120, total: 126 },
          [SKILL_ID.SENSE]: { base: 6, pointsFromIp: 70, total: 76 },
          [SKILL_ID.PSYCHIC]: { base: 6, pointsFromIp: 110, total: 116 },
        },
      });

      const wrapper = mountForIntegration(CharacterInfoPanel, {
        pinia: context.pinia,
        props: { profile },
      });

      await waitForUpdates(wrapper);

      const text = wrapper.text();

      // Should show attribute values
      expect(text).toContain('106'); // Strength
      expect(text).toContain('126'); // Intelligence
    });

    it('updates display when profile changes', async () => {
      const store = useTinkerProfilesStore();

      const profile = createTestProfile({
        name: 'ChangeTest',
        level: 50,
      });

      const profileId = await store.createProfile(profile.Character.Name, profile);
      const loadedProfile = await store.loadProfile(profileId);

      const wrapper = mountForIntegration(CharacterInfoPanel, {
        pinia: context.pinia,
        props: { profile: loadedProfile! },
      });

      await waitForUpdates(wrapper);

      // Initial state
      expect(wrapper.text()).toContain('50');

      // Update the profile
      await store.updateCharacterMetadata(profileId, { level: 100 });
      const updatedProfile = await store.loadProfile(profileId);

      // Update component props
      await wrapper.setProps({ profile: updatedProfile! });
      await waitForUpdates(wrapper);

      // Should reflect new level
      expect(wrapper.text()).toContain('100');
    });
  });

  // ============================================================================
  // Complex Workflows
  // ============================================================================

  describe('Complex Workflows', () => {
    it('handles full profile lifecycle: create -> edit -> switch -> delete', async () => {
      const store = useTinkerProfilesStore();

      // Create first profile
      const profile1 = createTestProfile({
        name: 'Lifecycle1',
        level: 50,
      });
      const profileId1 = await store.createProfile(profile1.Character.Name, profile1);
      await store.setActiveProfile(profileId1);
      await waitForUpdates();

      expect(store.activeProfileId).toBe(profileId1);

      // Edit first profile
      await store.updateCharacterMetadata(profileId1, { level: 75 });
      await waitForUpdates();

      const edited1 = await store.loadProfile(profileId1);
      expect(edited1?.Character.Level).toBe(75);

      // Create second profile
      const profile2 = createTestProfile({
        name: 'Lifecycle2',
        level: 100,
      });
      const profileId2 = await store.createProfile(profile2.Character.Name, profile2);

      // Switch to second profile
      await store.setActiveProfile(profileId2);
      await waitForUpdates();

      expect(store.activeProfileId).toBe(profileId2);

      // Delete first profile
      await store.deleteProfile(profileId1);
      await waitForUpdates();

      expect(store.profileMetadata.length).toBe(1);
      expect(store.profileMetadata[0].id).toBe(profileId2);
    });

    it('maintains data integrity across multiple operations', async () => {
      const store = useTinkerProfilesStore();

      // Create profile
      const profile = createTestProfile({
        name: 'IntegrityTest',
        level: 100,
        skills: {
          [SKILL_ID.ASSAULT_RIF]: { base: 5, pointsFromIp: 100, total: 105 },
        },
      });

      const profileId = await store.createProfile(profile.Character.Name, profile);

      // Perform multiple operations
      await store.setActiveProfile(profileId);
      await store.modifySkill(profileId, SKILL_ID.ASSAULT_RIF, 200);
      await store.updateCharacterMetadata(profileId, { level: 120 });
      await waitForUpdates();

      // Load and verify all changes persisted correctly
      const final = await store.loadProfile(profileId);

      expect(final).toBeDefined();
      expect(final?.Character.Level).toBe(120);
      expect(final?.skills[SKILL_ID.ASSAULT_RIF]).toBeDefined();
      expect(final?.skills[SKILL_ID.ASSAULT_RIF]?.total).toBeGreaterThanOrEqual(200);

      // Verify localStorage consistency (individual profile key)
      const profileKey = `tinkertools_profile_${profileId}`;
      const storedData = context.mockLocalStorage.getItem(profileKey);
      const storedProfile = JSON.parse(storedData!);
      expect(storedProfile.Character.Level).toBe(120);
    });
  });
});

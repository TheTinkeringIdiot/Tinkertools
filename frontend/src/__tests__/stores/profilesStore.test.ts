import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useProfilesStore } from '@/stores/profilesStore';
import type { TinkerProfile } from '@/types/nano';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
global.localStorage = mockLocalStorage as any;

describe('profilesStore', () => {
  let store: ReturnType<typeof useProfilesStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    
    // Mock empty localStorage initially
    vi.mocked(mockLocalStorage.getItem).mockReturnValue(null);
    
    store = useProfilesStore();
  });

  it('initializes with default state', () => {
    expect(store.profiles).toEqual([]);
    expect(store.activeProfile).toBe(null);
    expect(store.loading).toBe(false);
    expect(store.error).toBe(null);
  });

  it('computes hasProfiles correctly', async () => {
    expect(store.hasProfiles).toBe(false);
    
    await store.createProfile({ name: 'Test Profile' });
    expect(store.hasProfiles).toBe(true);
  });

  it('computes activeProfileId correctly', async () => {
    expect(store.activeProfileId).toBe(null);
    
    const profile = await store.createProfile({ name: 'Test Profile' });
    store.setActiveProfile(profile.id);
    
    expect(store.activeProfileId).toBe(profile.id);
  });

  it('computes profileOptions correctly', async () => {
    const options = store.profileOptions;
    expect(options[0]).toEqual({ label: 'No Profile', value: null });
    
    const profile = await store.createProfile({ 
      name: 'Test Profile', 
      profession: 'Doctor',
      level: 100
    });
    
    const updatedOptions = store.profileOptions;
    expect(updatedOptions.length).toBe(2);
    expect(updatedOptions[1].label).toContain('Test Profile');
    expect(updatedOptions[1].label).toContain('Doctor');
    expect(updatedOptions[1].label).toContain('100');
  });

  it('loads profiles from storage', async () => {
    const mockProfiles = [{
      id: 'test-id',
      name: 'Stored Profile',
      profession: 'Engineer',
      level: 75,
      skills: {},
      stats: {}
    }];
    
    vi.mocked(mockLocalStorage.getItem).mockReturnValue(JSON.stringify({
      profiles: mockProfiles,
      timestamp: Date.now()
    }));
    
    await store.loadProfiles();
    
    expect(store.profiles.length).toBe(1);
    expect(store.profiles[0].name).toBe('Stored Profile');
  });

  it('creates default profile when none exist', async () => {
    vi.mocked(mockLocalStorage.getItem).mockReturnValue(null);
    
    await store.loadProfiles();
    
    expect(store.profiles.length).toBe(1);
    expect(store.profiles[0].name).toBe('Default Profile');
    expect(store.profiles[0].profession).toBe('Adventurer');
    expect(store.profiles[0].level).toBe(1);
  });

  it('creates profile with correct defaults', async () => {
    const profile = await store.createProfile({
      name: 'Test Profile',
      profession: 'Doctor',
      level: 100
    });
    
    expect(profile.id).toBeDefined();
    expect(profile.name).toBe('Test Profile');
    expect(profile.profession).toBe('Doctor');
    expect(profile.level).toBe(100);
    expect(profile.skills).toBeDefined();
    expect(profile.stats).toBeDefined();
    expect(profile.activeNanos).toEqual([]);
    expect(profile.memoryCapacity).toBe(500);
    expect(profile.nanoPoints).toBe(1000);
    
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('updates profile correctly', async () => {
    const profile = await store.createProfile({ name: 'Original' });
    
    await store.updateProfile(profile.id, { 
      name: 'Updated', 
      level: 150 
    });
    
    const updatedProfile = store.getProfileById(profile.id);
    expect(updatedProfile?.name).toBe('Updated');
    expect(updatedProfile?.level).toBe(150);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('updates active profile when it is being updated', async () => {
    const profile = await store.createProfile({ name: 'Active Profile' });
    store.setActiveProfile(profile.id);
    
    await store.updateProfile(profile.id, { name: 'Updated Active' });
    
    expect(store.activeProfile?.name).toBe('Updated Active');
  });

  it('throws error when updating non-existent profile', async () => {
    await expect(store.updateProfile('non-existent', { name: 'Test' }))
      .rejects.toThrow('Profile not found');
  });

  it('deletes profile correctly', async () => {
    const profile = await store.createProfile({ name: 'To Delete' });
    const initialCount = store.profiles.length;
    
    await store.deleteProfile(profile.id);
    
    expect(store.profiles.length).toBe(initialCount - 1);
    expect(store.getProfileById(profile.id)).toBeUndefined();
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('clears active profile when it is deleted', async () => {
    const profile = await store.createProfile({ name: 'Active to Delete' });
    store.setActiveProfile(profile.id);
    
    await store.deleteProfile(profile.id);
    
    expect(store.activeProfile).toBe(null);
  });

  it('throws error when deleting non-existent profile', async () => {
    await expect(store.deleteProfile('non-existent'))
      .rejects.toThrow('Profile not found');
  });

  it('sets active profile correctly', async () => {
    const profile = await store.createProfile({ name: 'Active Profile' });
    
    store.setActiveProfile(profile.id);
    
    expect(store.activeProfile).toEqual(profile);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'tinkertools_active_profile_id',
      profile.id
    );
  });

  it('clears active profile', async () => {
    const profile = await store.createProfile({ name: 'Active Profile' });
    store.setActiveProfile(profile.id);
    
    store.clearActiveProfile();
    
    expect(store.activeProfile).toBe(null);
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'tinkertools_active_profile_id',
      ''
    );
  });

  it('duplicates profile correctly', async () => {
    const original = await store.createProfile({
      name: 'Original',
      profession: 'Doctor',
      level: 100
    });
    
    const duplicate = await store.duplicateProfile(original.id, 'Duplicate');
    
    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.name).toBe('Duplicate');
    expect(duplicate.profession).toBe('Doctor');
    expect(duplicate.level).toBe(100);
    expect(store.profiles.length).toBe(2);
  });

  it('duplicates profile with default copy name', async () => {
    const original = await store.createProfile({ name: 'Original' });
    
    const duplicate = await store.duplicateProfile(original.id);
    
    expect(duplicate.name).toBe('Original (Copy)');
  });

  it('updates skill correctly', async () => {
    const profile = await store.createProfile({ name: 'Test Profile' });
    
    await store.updateSkill(profile.id, 'Matter Creation', 500);
    
    const updatedProfile = store.getProfileById(profile.id);
    expect(updatedProfile?.skills['Matter Creation']).toBe(500);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('clamps skill values to valid range', async () => {
    const profile = await store.createProfile({ name: 'Test Profile' });
    
    await store.updateSkill(profile.id, 'Matter Creation', -100);
    expect(store.getProfileById(profile.id)?.skills['Matter Creation']).toBe(0);
    
    await store.updateSkill(profile.id, 'Matter Creation', 10000);
    expect(store.getProfileById(profile.id)?.skills['Matter Creation']).toBe(9999);
  });

  it('updates active profile when skill is updated', async () => {
    const profile = await store.createProfile({ name: 'Active Profile' });
    store.setActiveProfile(profile.id);
    
    await store.updateSkill(profile.id, 'Matter Creation', 600);
    
    expect(store.activeProfile?.skills['Matter Creation']).toBe(600);
  });

  it('updates stat correctly', async () => {
    const profile = await store.createProfile({ name: 'Test Profile' });
    
    await store.updateStat(profile.id, 'Strength', 400);
    
    const updatedProfile = store.getProfileById(profile.id);
    expect(updatedProfile?.stats['Strength']).toBe(400);
    expect(mockLocalStorage.setItem).toHaveBeenCalled();
  });

  it('clamps stat values to valid range', async () => {
    const profile = await store.createProfile({ name: 'Test Profile' });
    
    await store.updateStat(profile.id, 'Strength', 0);
    expect(store.getProfileById(profile.id)?.stats['Strength']).toBe(1);
    
    await store.updateStat(profile.id, 'Strength', 10000);
    expect(store.getProfileById(profile.id)?.stats['Strength']).toBe(9999);
  });

  it('imports profile from JSON string', async () => {
    const profileData = {
      name: 'Imported Profile',
      profession: 'Engineer',
      level: 75,
      skills: { 'Matter Creation': 500 },
      stats: { 'Intelligence': 300 }
    };
    
    const imported = await store.importProfile(JSON.stringify(profileData));
    
    expect(imported.name).toBe('Imported Profile');
    expect(imported.profession).toBe('Engineer');
    expect(imported.level).toBe(75);
    expect(imported.skills['Matter Creation']).toBe(500);
    expect(imported.id).toBeDefined();
    expect(store.profiles).toContain(imported);
  });

  it('imports profile from object', async () => {
    const profileData: Partial<TinkerProfile> = {
      name: 'Imported Profile',
      profession: 'Engineer',
      level: 75
    };
    
    const imported = await store.importProfile(profileData as TinkerProfile);
    
    expect(imported.name).toBe('Imported Profile');
    expect(imported.id).toBeDefined();
    expect(store.profiles).toContain(imported);
  });

  it('throws error for invalid JSON import', async () => {
    await expect(store.importProfile('invalid json'))
      .rejects.toThrow('Invalid profile data format');
  });

  it('throws error for invalid profile structure', async () => {
    const invalidProfile = { invalidField: 'value' };
    
    await expect(store.importProfile(JSON.stringify(invalidProfile)))
      .rejects.toThrow('Invalid profile structure');
  });

  it('exports profile correctly', async () => {
    const profile = await store.createProfile({
      name: 'Export Profile',
      profession: 'Doctor',
      level: 100
    });
    
    const exported = store.exportProfile(profile.id);
    
    const parsed = JSON.parse(exported);
    expect(parsed.name).toBe('Export Profile');
    expect(parsed.profession).toBe('Doctor');
    expect(parsed.level).toBe(100);
  });

  it('throws error when exporting non-existent profile', () => {
    expect(() => store.exportProfile('non-existent'))
      .toThrow('Profile not found');
  });

  it('loads active profile from storage', async () => {
    const profile = await store.createProfile({ name: 'Active Profile' });
    
    vi.mocked(mockLocalStorage.getItem)
      .mockReturnValueOnce(JSON.stringify({ profiles: [profile], timestamp: Date.now() }))
      .mockReturnValueOnce(profile.id);
    
    await store.loadProfiles();
    
    expect(store.activeProfile?.id).toBe(profile.id);
  });

  it('handles storage errors gracefully', async () => {
    vi.mocked(mockLocalStorage.setItem).mockImplementation(() => {
      throw new Error('Storage error');
    });
    
    // Should not throw error but should reject promise
    await expect(store.createProfile({ name: 'Test' }))
      .rejects.toThrow('Failed to save profiles');
  });

  it('filters profiles correctly when loading from storage', async () => {
    const validProfile = {
      id: 'valid',
      name: 'Valid Profile',
      profession: 'Doctor',
      level: 100,
      skills: {},
      stats: {}
    };
    
    const invalidData = [validProfile, null, undefined, 'string', 123];
    
    vi.mocked(mockLocalStorage.getItem).mockReturnValue(JSON.stringify({
      profiles: invalidData,
      timestamp: Date.now()
    }));
    
    await store.loadProfiles();
    
    // Should only load the valid profile
    expect(store.profiles.length).toBe(1);
    expect(store.profiles[0]).toEqual(validProfile);
  });

  it('generates unique profile IDs', async () => {
    const profile1 = await store.createProfile({ name: 'Profile 1' });
    const profile2 = await store.createProfile({ name: 'Profile 2' });
    
    expect(profile1.id).not.toBe(profile2.id);
    expect(profile1.id).toMatch(/^profile_\d+_[a-z0-9]+$/);
    expect(profile2.id).toMatch(/^profile_\d+_[a-z0-9]+$/);
  });

  it('ensures imported profiles have default fields', async () => {
    const minimalProfile = {
      name: 'Minimal',
      profession: 'Doctor',
      level: 50
    };
    
    const imported = await store.importProfile(JSON.stringify(minimalProfile));
    
    expect(imported.skills).toBeDefined();
    expect(imported.stats).toBeDefined();
    expect(imported.activeNanos).toEqual([]);
    expect(imported.memoryCapacity).toBe(500);
    expect(imported.nanoPoints).toBe(1000);
  });
});
/**
 * TinkerProfiles Library Tests
 * 
 * Tests for the core TinkerProfiles functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TinkerProfilesManager, createDefaultProfile, createDefaultNanoProfile } from '@/lib/tinkerprofiles';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => store[key] = value,
    removeItem: (key: string) => delete store[key],
    clear: () => store = {}
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('TinkerProfiles Library', () => {
  let profileManager: TinkerProfilesManager;
  
  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear();
    
    // Create new profile manager instance
    profileManager = new TinkerProfilesManager({
      storage: {
        autoSave: true
      },
      validation: {
        strictMode: false,
        autoCorrect: true
      }
    });
  });
  
  describe('Profile Creation', () => {
    it('should create a default profile with correct structure', () => {
      const profile = createDefaultProfile('Test Character');
      
      expect(profile.Character.Name).toBe('Test Character');
      expect(profile.Character.Level).toBe(1);
      expect(profile.Character.Profession).toBe('Adventurer');
      expect(profile.Character.Breed).toBe('Solitus');
      expect(profile.Character.Faction).toBe('Neutral');
      expect(profile.Skills.Attributes.Strength.value).toBe(10);
      expect(profile.Skills.Attributes.Intelligence.value).toBe(10);
      expect(profile.version).toBeTruthy();
      expect(profile.id).toBeTruthy();
      expect(profile.created).toBeTruthy();
      expect(profile.updated).toBeTruthy();
    });
    
    it('should create a nano-compatible profile', () => {
      const nanoProfile = createDefaultNanoProfile('Nano Test');
      
      expect(nanoProfile.name).toBe('Nano Test');
      expect(nanoProfile.profession).toBe('Adventurer');
      expect(nanoProfile.level).toBe(1);
      expect(nanoProfile.skills['Biological Metamorphosis']).toBe(1);
      expect(nanoProfile.stats.Intelligence).toBe(10);
      expect(nanoProfile.memoryCapacity).toBe(500);
      expect(nanoProfile.nanoPoints).toBe(1000);
    });
    
    it('should create profile through manager', async () => {
      const profileId = await profileManager.createProfile('Manager Test');
      
      expect(profileId).toBeTruthy();
      
      const profile = await profileManager.loadProfile(profileId);
      expect(profile).toBeTruthy();
      expect(profile?.Character.Name).toBe('Manager Test');
    });
  });
  
  describe('Profile Management', () => {
    let testProfileId: string;
    
    beforeEach(async () => {
      testProfileId = await profileManager.createProfile('Test Profile');
    });
    
    it('should load a profile by ID', async () => {
      const profile = await profileManager.loadProfile(testProfileId);
      
      expect(profile).toBeTruthy();
      expect(profile?.id).toBe(testProfileId);
      expect(profile?.Character.Name).toBe('Test Profile');
    });
    
    it('should update a profile', async () => {
      const updates = {
        Character: {
          Name: 'Updated Profile',
          Level: 50,
          Profession: 'Nanotechnician',
          Breed: 'Nanomage',
          Faction: 'Clan',
          Expansion: 'Shadowlands',
          AccountType: 'Paid'
        }
      };
      
      await profileManager.updateProfile(testProfileId, updates);
      
      const updatedProfile = await profileManager.loadProfile(testProfileId);
      expect(updatedProfile?.Character.Name).toBe('Updated Profile');
      expect(updatedProfile?.Character.Level).toBe(50);
      expect(updatedProfile?.Character.Profession).toBe('Nanotechnician');
    });
    
    it('should delete a profile', async () => {
      await profileManager.deleteProfile(testProfileId);
      
      const deletedProfile = await profileManager.loadProfile(testProfileId);
      expect(deletedProfile).toBeNull();
    });
    
    it('should get profile metadata', async () => {
      const metadata = await profileManager.getProfileMetadata();
      
      expect(metadata).toHaveLength(1);
      expect(metadata[0].id).toBe(testProfileId);
      expect(metadata[0].name).toBe('Test Profile');
      expect(metadata[0].profession).toBe('Adventurer');
      expect(metadata[0].level).toBe(1);
    });
  });
  
  describe('Active Profile Management', () => {
    let profileId1: string;
    let profileId2: string;
    
    beforeEach(async () => {
      profileId1 = await profileManager.createProfile('Profile 1');
      profileId2 = await profileManager.createProfile('Profile 2');
    });
    
    it('should set and get active profile', async () => {
      await profileManager.setActiveProfile(profileId1);
      
      const activeId = profileManager.getActiveProfileId();
      expect(activeId).toBe(profileId1);
      
      const activeProfile = await profileManager.getActiveProfile();
      expect(activeProfile?.id).toBe(profileId1);
      expect(activeProfile?.Character.Name).toBe('Profile 1');
    });
    
    it('should switch active profile', async () => {
      await profileManager.setActiveProfile(profileId1);
      await profileManager.setActiveProfile(profileId2);
      
      const activeId = profileManager.getActiveProfileId();
      expect(activeId).toBe(profileId2);
      
      const activeProfile = await profileManager.getActiveProfile();
      expect(activeProfile?.Character.Name).toBe('Profile 2');
    });
    
    it('should clear active profile', async () => {
      await profileManager.setActiveProfile(profileId1);
      await profileManager.setActiveProfile(null);
      
      const activeId = profileManager.getActiveProfileId();
      expect(activeId).toBeNull();
      
      const activeProfile = await profileManager.getActiveProfile();
      expect(activeProfile).toBeNull();
    });
  });
  
  describe('Profile Validation', () => {
    let validProfileId: string;
    
    beforeEach(async () => {
      validProfileId = await profileManager.createProfile('Valid Profile');
    });
    
    it('should validate a valid profile', async () => {
      const result = await profileManager.validateProfile(validProfileId);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should detect validation errors', async () => {
      // Update profile with invalid data
      await profileManager.updateProfile(validProfileId, {
        Character: {
          Name: '', // Invalid empty name
          Level: -1, // Invalid negative level
          Profession: 'InvalidProfession' as any,
          Breed: 'Solitus',
          Faction: 'Neutral',
          Expansion: 'Lost Eden',
          AccountType: 'Paid'
        }
      });
      
      const result = await profileManager.validateProfile(validProfileId);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('Import/Export', () => {
    let testProfileId: string;
    let testProfile: any;
    
    beforeEach(async () => {
      testProfileId = await profileManager.createProfile('Export Test');
      testProfile = await profileManager.loadProfile(testProfileId);
    });
    
    it('should export profile to JSON', async () => {
      const exported = await profileManager.exportProfile(testProfileId, 'json');
      
      expect(exported).toBeTruthy();
      
      const parsed = JSON.parse(exported);
      expect(parsed.Character.Name).toBe('Export Test');
      expect(parsed.id).toBe(testProfileId);
    });
    
    it('should import profile from JSON', async () => {
      const exported = await profileManager.exportProfile(testProfileId, 'json');
      
      // Modify the exported data to create a new profile
      const parsed = JSON.parse(exported);
      parsed.Character.Name = 'Imported Profile';
      delete parsed.id; // Remove ID to create new profile
      
      const result = await profileManager.importProfile(JSON.stringify(parsed));
      
      expect(result.success).toBe(true);
      expect(result.profile).toBeTruthy();
      expect(result.profile?.Character.Name).toBe('Imported Profile');
      expect(result.errors).toHaveLength(0);
    });
    
    it('should handle invalid import data', async () => {
      const result = await profileManager.importProfile('invalid json data');
      
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('Profile Search', () => {
    beforeEach(async () => {
      await profileManager.createProfile('Nano Tech', {
        Character: {
          Name: 'Nano Tech',
          Level: 50,
          Profession: 'Nanotechnician',
          Breed: 'Nanomage',
          Faction: 'Clan',
          Expansion: 'Shadowlands',
          AccountType: 'Paid'
        }
      });
      
      await profileManager.createProfile('Tank Doc', {
        Character: {
          Name: 'Tank Doc',
          Level: 100,
          Profession: 'Doctor',
          Breed: 'Atrox',
          Faction: 'Omni-Tek',
          Expansion: 'Lost Eden',
          AccountType: 'Paid'
        }
      });
    });
    
    it('should search profiles by name', async () => {
      const results = await profileManager.searchProfiles({ name: 'Nano' });
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Nano Tech');
    });
    
    it('should filter profiles by profession', async () => {
      const results = await profileManager.searchProfiles({ 
        profession: ['Doctor'] 
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].profession).toBe('Doctor');
    });
    
    it('should filter profiles by level range', async () => {
      const results = await profileManager.searchProfiles({ 
        level: [75, 150] 
      });
      
      expect(results).toHaveLength(1);
      expect(results[0].level).toBe(100);
    });
    
    it('should sort profiles', async () => {
      const results = await profileManager.searchProfiles(
        {}, 
        { field: 'level', direction: 'desc' }
      );
      
      expect(results).toHaveLength(2);
      expect(results[0].level).toBe(100);
      expect(results[1].level).toBe(50);
    });
  });
  
  describe('Profile Transformations', () => {
    let fullProfileId: string;
    
    beforeEach(async () => {
      fullProfileId = await profileManager.createProfile('Transform Test', {
        Character: {
          Name: 'Transform Test',
          Level: 75,
          Profession: 'Meta-Physicist',
          Breed: 'Solitus',
          Faction: 'Neutral',
          Expansion: 'Shadowlands',
          AccountType: 'Paid'
        },
        Skills: {
          Attributes: {
            Intelligence: { value: 500, ipSpent: 0, pointFromIp: 0 },
            Psychic: { value: 400, ipSpent: 0, pointFromIp: 0 },
            Sense: { value: 300, ipSpent: 0, pointFromIp: 0 },
            Stamina: { value: 200, ipSpent: 0, pointFromIp: 0 },
            Strength: { value: 150, ipSpent: 0, pointFromIp: 0 },
            Agility: { value: 250, ipSpent: 0, pointFromIp: 0 }
          }
        }
      });
    });
    
    it('should convert to nano-compatible profile', async () => {
      const nanoProfile = await profileManager.getAsNanoCompatible(fullProfileId);
      
      expect(nanoProfile).toBeTruthy();
      expect(nanoProfile?.name).toBe('Transform Test');
      expect(nanoProfile?.profession).toBe('Meta-Physicist');
      expect(nanoProfile?.level).toBe(75);
      expect(nanoProfile?.stats.Intelligence).toBe(500);
      expect(nanoProfile?.memoryCapacity).toBeGreaterThan(500); // Should be higher for MP
    });
    
    it('should create profile from nano-compatible', async () => {
      const nanoProfile = createDefaultNanoProfile('From Nano');
      nanoProfile.profession = 'Nanotechnician';
      nanoProfile.level = 25;
      nanoProfile.stats.Intelligence = 300;
      
      const newProfileId = await profileManager.createFromNanoCompatible(nanoProfile);
      const createdProfile = await profileManager.loadProfile(newProfileId);
      
      expect(createdProfile?.Character.Name).toBe('From Nano');
      expect(createdProfile?.Character.Profession).toBe('Nanotechnician');
      expect(createdProfile?.Character.Level).toBe(25);
      expect(createdProfile?.Skills.Attributes.Intelligence.value).toBe(300);
    });
  });
  
  describe('Storage Statistics', () => {
    beforeEach(async () => {
      await profileManager.createProfile('Stats Test 1');
      await profileManager.createProfile('Stats Test 2');
      await profileManager.createProfile('Stats Test 3');
    });
    
    it('should return storage statistics', () => {
      const stats = profileManager.getStorageStats();
      
      expect(stats.profiles).toBe(3);
      expect(stats.used).toBeGreaterThan(0);
      expect(stats.total).toBeGreaterThan(0);
    });
  });
});

describe('TinkerProfiles Constants', () => {
  it('should provide correct profession options', () => {
    const profile = createDefaultProfile();
    expect(['Adventurer', 'Agent', 'Bureaucrat', 'Doctor', 'Enforcer', 'Engineer', 'Fixer', 'Keeper', 'Martial Artist', 'Meta-Physicist', 'Nanotechnician', 'Soldier', 'Trader', 'Shade']).toContain(profile.Character.Profession);
  });
  
  it('should provide correct breed options', () => {
    const profile = createDefaultProfile();
    expect(['Solitus', 'Opifex', 'Nanomage', 'Atrox']).toContain(profile.Character.Breed);
  });
  
  it('should provide correct faction options', () => {
    const profile = createDefaultProfile();
    expect(['Omni-Tek', 'Clan', 'Neutral']).toContain(profile.Character.Faction);
  });
});
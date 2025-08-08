import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { TinkerProfile } from '@/types/nano';

export const useProfilesStore = defineStore('profiles', () => {
  // State
  const profiles = ref<TinkerProfile[]>([]);
  const activeProfile = ref<TinkerProfile | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const hasProfiles = computed(() => profiles.value.length > 0);
  const activeProfileId = computed(() => activeProfile.value?.id || null);
  
  const profileOptions = computed(() => [
    { label: 'No Profile', value: null },
    ...profiles.value.map(profile => ({
      label: `${profile.name} (${profile.profession} ${profile.level})`,
      value: profile.id
    }))
  ]);

  // Actions
  const loadProfiles = async (): Promise<void> => {
    loading.value = true;
    error.value = null;
    
    try {
      await loadProfilesFromStorage();
      
      // If no profiles exist, create a default one
      if (profiles.value.length === 0) {
        await createDefaultProfile();
      }
      
      // Load active profile
      loadActiveProfile();
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load profiles';
      console.error('Failed to load profiles:', err);
    } finally {
      loading.value = false;
    }
  };

  const createProfile = async (profileData: Partial<TinkerProfile>): Promise<TinkerProfile> => {
    const newProfile: TinkerProfile = {
      id: generateProfileId(),
      name: profileData.name || 'New Profile',
      profession: profileData.profession || 'Adventurer',
      level: profileData.level || 1,
      skills: profileData.skills || getDefaultSkills(),
      stats: profileData.stats || getDefaultStats(),
      activeNanos: profileData.activeNanos || [],
      memoryCapacity: profileData.memoryCapacity || 500,
      nanoPoints: profileData.nanoPoints || 1000
    };

    profiles.value.push(newProfile);
    await saveProfilesToStorage();
    
    return newProfile;
  };

  const updateProfile = async (profileId: string, updates: Partial<TinkerProfile>): Promise<void> => {
    const index = profiles.value.findIndex(p => p.id === profileId);
    if (index === -1) {
      throw new Error('Profile not found');
    }

    profiles.value[index] = { ...profiles.value[index], ...updates };
    
    // Update active profile if it's the one being updated
    if (activeProfile.value?.id === profileId) {
      activeProfile.value = profiles.value[index];
    }
    
    await saveProfilesToStorage();
  };

  const deleteProfile = async (profileId: string): Promise<void> => {
    const index = profiles.value.findIndex(p => p.id === profileId);
    if (index === -1) {
      throw new Error('Profile not found');
    }

    profiles.value.splice(index, 1);
    
    // Clear active profile if it's the one being deleted
    if (activeProfile.value?.id === profileId) {
      activeProfile.value = null;
      saveActiveProfile();
    }
    
    await saveProfilesToStorage();
  };

  const setActiveProfile = (profileId: string | null): void => {
    if (profileId === null) {
      activeProfile.value = null;
    } else {
      const profile = profiles.value.find(p => p.id === profileId);
      if (profile) {
        activeProfile.value = profile;
      }
    }
    saveActiveProfile();
  };

  const clearActiveProfile = (): void => {
    activeProfile.value = null;
    saveActiveProfile();
  };

  const getProfileById = (id: string): TinkerProfile | undefined => {
    return profiles.value.find(profile => profile.id === id);
  };

  const duplicateProfile = async (profileId: string, newName?: string): Promise<TinkerProfile> => {
    const originalProfile = getProfileById(profileId);
    if (!originalProfile) {
      throw new Error('Profile not found');
    }

    const duplicatedProfile: TinkerProfile = {
      ...originalProfile,
      id: generateProfileId(),
      name: newName || `${originalProfile.name} (Copy)`
    };

    profiles.value.push(duplicatedProfile);
    await saveProfilesToStorage();
    
    return duplicatedProfile;
  };

  const updateSkill = async (profileId: string, skillName: string, value: number): Promise<void> => {
    const profile = getProfileById(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    profile.skills[skillName] = Math.max(0, Math.min(value, 9999)); // Clamp between 0 and 9999
    
    if (activeProfile.value?.id === profileId) {
      activeProfile.value = profile;
    }
    
    await saveProfilesToStorage();
  };

  const updateStat = async (profileId: string, statName: string, value: number): Promise<void> => {
    const profile = getProfileById(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    profile.stats[statName] = Math.max(1, Math.min(value, 9999)); // Clamp between 1 and 9999
    
    if (activeProfile.value?.id === profileId) {
      activeProfile.value = profile;
    }
    
    await saveProfilesToStorage();
  };

  const importProfile = async (profileData: string | TinkerProfile): Promise<TinkerProfile> => {
    let profile: any;
    
    if (typeof profileData === 'string') {
      // Parse JSON string
      try {
        profile = JSON.parse(profileData);
      } catch (error) {
        throw new Error('Invalid profile data format');
      }
    } else {
      profile = profileData;
    }

    // Validate profile structure
    if (!profile.name || !profile.profession || typeof profile.level !== 'number') {
      throw new Error('Invalid profile structure');
    }

    // Create proper TinkerProfile
    const validProfile: TinkerProfile = {
      id: generateProfileId(),
      name: profile.name,
      profession: profile.profession,
      level: profile.level,
      skills: profile.skills || getDefaultSkills(),
      stats: profile.stats || getDefaultStats(),
      activeNanos: profile.activeNanos || [],
      memoryCapacity: profile.memoryCapacity || 500,
      nanoPoints: profile.nanoPoints || 1000
    };

    profiles.value.push(validProfile);
    await saveProfilesToStorage();
    
    return validProfile;
  };

  const exportProfile = (profileId: string): string => {
    const profile = getProfileById(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    return JSON.stringify(profile, null, 2);
  };

  // Private helper functions
  const generateProfileId = (): string => {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const getDefaultSkills = (): Record<string, number> => {
    return {
      // Nano Schools
      'Biological Metamorphosis': 1,
      'Matter Creation': 1,
      'Matter Metamorphosis': 1,
      'Psychological Modifications': 1,
      'Sensory Improvement': 1,
      'Time and Space': 1,
      
      // Core Skills
      'Nano Programming': 1,
      'Computer Literacy': 1,
      'Tutoring': 1,
      'First Aid': 1,
      'Treatment': 1,
      
      // Combat Skills
      '1H Edged': 1,
      '2H Edged': 1,
      '1H Blunt': 1,
      '2H Blunt': 1,
      'Piercing': 1,
      'Bow': 1,
      'Pistol': 1,
      'Assault Rifle': 1,
      'SMG': 1,
      'Rifle': 1,
      'Shotgun': 1,
      'Heavy Weapons': 1,
      'Throwing Knife': 1,
      'Grenade': 1,
      
      // Other Skills
      'Dodge Ranged': 1,
      'Evade Close Combat': 1,
      'Duck Explosives': 1,
      'Multi Melee': 1,
      'Multi Ranged': 1,
      'Martial Arts': 1,
      'Parry': 1,
      'Sneak Attack': 1,
      'Fast Attack': 1,
      'Burst': 1,
      'Full Auto': 1,
      'Aimed Shot': 1,
      'Brawl': 1,
      'Dimach': 1,
      'Riposte': 1,
      'Adventuring': 1,
      'Swimming': 1,
      'Scale': 1,
      'Drive': 1,
      'Concealment': 1,
      'Psychology': 1,
      'Trap Disarm': 1,
      'Perception': 1,
      'Map Navigation': 1,
      'Bow Special Attack': 1,
      'Melee Energy': 1,
      'Ranged Energy': 1,
      'Fling Shot': 1,
      'Aimed Shot': 1,
      'Called Shot': 1,
      'Multiple Target': 1,
      'Creature Spell': 1,
      'Nano Resist': 1,
      'Shield Chemical AC': 1,
      'Shield Radiation AC': 1,
      'Shield Cold AC': 1,
      'Shield Poison AC': 1,
      'Shield Fire AC': 1,
      'Shield Projectile AC': 1,
      'Shield Melee AC': 1,
      'Shield Energy AC': 1,
      'Absorb Projectile AC': 1,
      'Absorb Melee AC': 1,
      'Absorb Energy AC': 1,
      'Absorb Chemical AC': 1,
      'Absorb Radiation AC': 1,
      'Absorb Cold AC': 1,
      'Absorb Fire AC': 1,
      'Absorb Poison AC': 1,
      'Concealment': 1,
      'Break and Entry': 1,
      'Trap Disarm': 1,
      'Vehicle Air': 1,
      'Vehicle Ground': 1,
      'Vehicle Water': 1,
      'Run Speed': 1,
      'Melee Init': 1,
      'Ranged Init': 1,
      'Physical Init': 1,
      'Nano Init': 1,
      'Dodge Ranged': 1,
      'Evade Close Combat': 1,
      'Duck Explosives': 1,
      'Nano Resist': 1,
      'Body Dev': 1,
      'Nano Pool': 1,
      'Max Health': 1,
      'Max Nano': 1,
      'Max NCU': 1,
      'NCU': 1,
      'Health': 1,
      'Nano Points': 1
    };
  };

  const getDefaultStats = (): Record<string, number> => {
    return {
      'Strength': 10,
      'Stamina': 10,
      'Agility': 10,
      'Sense': 10,
      'Intelligence': 10,
      'Psychic': 10
    };
  };

  const createDefaultProfile = async (): Promise<void> => {
    await createProfile({
      name: 'Default Profile',
      profession: 'Adventurer',
      level: 1
    });
  };

  // Storage functions
  const saveProfilesToStorage = async (): Promise<void> => {
    try {
      const data = {
        profiles: profiles.value,
        timestamp: Date.now()
      };
      localStorage.setItem('tinkertools_profiles', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save profiles to storage:', error);
      throw new Error('Failed to save profiles');
    }
  };

  const loadProfilesFromStorage = async (): Promise<void> => {
    try {
      const data = localStorage.getItem('tinkertools_profiles');
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed.profiles && Array.isArray(parsed.profiles)) {
          profiles.value = parsed.profiles.filter((p: any) => p && typeof p === 'object');
        }
      }
    } catch (error) {
      console.warn('Failed to load profiles from storage:', error);
      // Don't throw here, just start with empty profiles
    }
  };

  const saveActiveProfile = (): void => {
    try {
      localStorage.setItem('tinkertools_active_profile_id', activeProfile.value?.id || '');
    } catch (error) {
      console.warn('Failed to save active profile:', error);
    }
  };

  const loadActiveProfile = (): void => {
    try {
      const activeProfileId = localStorage.getItem('tinkertools_active_profile_id');
      if (activeProfileId && activeProfileId !== '') {
        const profile = profiles.value.find((p: TinkerProfile) => p.id === activeProfileId);
        if (profile) {
          activeProfile.value = profile;
        }
      }
    } catch (error) {
      console.warn('Failed to load active profile:', error);
    }
  };

  return {
    // State
    profiles: profiles as Readonly<typeof profiles>,
    activeProfile: activeProfile as Readonly<typeof activeProfile>,
    loading: loading as Readonly<typeof loading>,
    error: error as Readonly<typeof error>,
    
    // Getters
    hasProfiles,
    activeProfileId,
    profileOptions,
    
    // Actions
    loadProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    setActiveProfile,
    clearActiveProfile,
    getProfileById,
    duplicateProfile,
    updateSkill,
    updateStat,
    importProfile,
    exportProfile
  };
});
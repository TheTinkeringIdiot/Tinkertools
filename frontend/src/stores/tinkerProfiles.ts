/**
 * TinkerProfiles Pinia Store
 * 
 * Vue 3 Pinia store wrapper for the TinkerProfiles library,
 * providing reactive state management for profile operations
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import { 
  TinkerProfilesManager,
  type TinkerProfile,
  type NanoCompatibleProfile,
  type ProfileMetadata,
  type ProfileExportFormat,
  type ProfileImportResult,
  type ProfileValidationResult,
  type TinkerProfilesConfig
} from '@/lib/tinkerprofiles';

export const useTinkerProfilesStore = defineStore('tinkerProfiles', () => {
  // ============================================================================
  // State
  // ============================================================================
  
  // Profile manager instance
  let profileManager: TinkerProfilesManager;
  
  // Reactive state
  const profiles = ref<Map<string, TinkerProfile>>(new Map());
  const profileMetadata = ref<ProfileMetadata[]>([]);
  const activeProfileId = ref<string | null>(null);
  const activeProfile = ref<TinkerProfile | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  // ============================================================================
  // Computed Properties
  // ============================================================================
  
  const hasProfiles = computed(() => profileMetadata.value.length > 0);
  
  const hasActiveProfile = computed(() => activeProfile.value !== null);
  
  const profileOptions = computed(() => [
    { label: 'No Profile', value: null },
    ...profileMetadata.value.map(profile => ({
      label: `${profile.name} (${profile.profession} ${profile.level})`,
      value: profile.id
    }))
  ]);
  
  const activeProfileName = computed(() => activeProfile.value?.Character.Name || '');
  
  const activeProfileProfession = computed(() => activeProfile.value?.Character.Profession || '');
  
  const activeProfileLevel = computed(() => activeProfile.value?.Character.Level || 0);
  
  // ============================================================================
  // Initialization
  // ============================================================================
  
  /**
   * Initialize the profile manager with configuration
   */
  function initialize(config: Partial<TinkerProfilesConfig> = {}) {
    profileManager = new TinkerProfilesManager({
      features: {
        compression: false,
        migration: true,
        analytics: false
      },
      validation: {
        strictMode: false,
        autoCorrect: true,
        allowLegacyFormats: true
      },
      events: {
        enabled: true,
        throttle: 100
      },
      ...config
    });
    
    // Set up event listeners
    setupEventListeners();
  }
  
  /**
   * Set up event listeners for profile manager events
   */
  function setupEventListeners() {
    if (!profileManager) return;
    
    profileManager.on('profile:created', async ({ profile }) => {
      await refreshMetadata();
    });
    
    profileManager.on('profile:updated', async ({ profile }) => {
      profiles.value.set(profile.id, profile);
      if (activeProfileId.value === profile.id) {
        activeProfile.value = profile;
      }
      await refreshMetadata();
    });
    
    profileManager.on('profile:deleted', async ({ profileId }) => {
      profiles.value.delete(profileId);
      if (activeProfileId.value === profileId) {
        activeProfileId.value = null;
        activeProfile.value = null;
      }
      await refreshMetadata();
    });
    
    profileManager.on('profile:activated', ({ profile }) => {
      activeProfile.value = profile;
      activeProfileId.value = profile.id;
    });
    
    profileManager.on('storage:error', ({ error: storageError, operation }) => {
      error.value = `Storage error during ${operation}: ${storageError.message}`;
      console.error('TinkerProfiles storage error:', storageError);
    });
    
    profileManager.on('validation:failed', ({ profileId, errors }) => {
      error.value = `Profile validation failed for ${profileId}: ${errors.join(', ')}`;
    });
  }
  
  // ============================================================================
  // Profile Management Actions
  // ============================================================================
  
  /**
   * Load all profile data
   */
  async function loadProfiles(): Promise<void> {
    if (!profileManager) {
      initialize();
    }
    
    loading.value = true;
    error.value = null;
    
    try {
      // Load metadata
      await refreshMetadata();
      
      // Load active profile
      const active = await profileManager.getActiveProfile();
      if (active) {
        // Ensure caps and trickle-down are calculated for display
        const { updateProfileWithIPTracking } = await import('@/lib/tinkerprofiles/ip-integrator');
        const activeWithCaps = updateProfileWithIPTracking(active);
        
        activeProfile.value = activeWithCaps;
        activeProfileId.value = activeWithCaps.id;
        profiles.value.set(activeWithCaps.id, activeWithCaps);
      }
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load profiles';
      console.error('Failed to load profiles:', err);
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Create a new profile
   */
  async function createProfile(name: string, initialData?: Partial<TinkerProfile>): Promise<string> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }
    
    loading.value = true;
    error.value = null;
    
    try {
      const profileId = await profileManager.createProfile(name, initialData);
      await refreshMetadata();
      return profileId;
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create profile';
      throw err;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Update a profile
   */
  async function updateProfile(profileId: string, updates: Partial<TinkerProfile>): Promise<void> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }
    
    loading.value = true;
    error.value = null;
    
    try {
      await profileManager.updateProfile(profileId, updates);
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to update profile';
      throw err;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Delete a profile
   */
  async function deleteProfile(profileId: string): Promise<void> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }
    
    loading.value = true;
    error.value = null;
    
    try {
      await profileManager.deleteProfile(profileId);
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to delete profile';
      throw err;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Load a specific profile by ID
   */
  async function loadProfile(profileId: string): Promise<TinkerProfile | null> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }
    
    try {
      const profile = await profileManager.loadProfile(profileId);
      if (profile) {
        // Ensure caps and trickle-down are calculated for display
        const { updateProfileWithIPTracking } = await import('@/lib/tinkerprofiles/ip-integrator');
        const profileWithCaps = updateProfileWithIPTracking(profile);
        
        profiles.value.set(profileId, profileWithCaps);
        return profileWithCaps;
      }
      return profile;
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load profile';
      return null;
    }
  }
  
  // ============================================================================
  // Active Profile Management
  // ============================================================================
  
  /**
   * Set the active profile
   */
  async function setActiveProfile(profileId: string | null): Promise<void> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }
    
    loading.value = true;
    error.value = null;
    
    try {
      await profileManager.setActiveProfile(profileId);
      
      if (profileId) {
        const profile = await loadProfile(profileId);
        if (profile) {
          activeProfile.value = profile;
          activeProfileId.value = profileId;
        }
      } else {
        activeProfile.value = null;
        activeProfileId.value = null;
      }
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to set active profile';
      throw err;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * Clear the active profile
   */
  async function clearActiveProfile(): Promise<void> {
    await setActiveProfile(null);
  }
  
  // ============================================================================
  // Profile Transformations
  // ============================================================================
  
  /**
   * Get profile as nano-compatible format
   */
  async function getAsNanoCompatible(profileId: string): Promise<NanoCompatibleProfile | null> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }
    
    return await profileManager.getAsNanoCompatible(profileId);
  }
  
  /**
   * Create profile from nano-compatible format
   */
  async function createFromNanoCompatible(nanoProfile: NanoCompatibleProfile): Promise<string> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }
    
    return await profileManager.createFromNanoCompatible(nanoProfile);
  }
  
  // ============================================================================
  // Import/Export Operations
  // ============================================================================
  
  /**
   * Export a profile
   */
  async function exportProfile(profileId: string, format: ProfileExportFormat = 'json'): Promise<string> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }
    
    return await profileManager.exportProfile(profileId, format);
  }
  
  /**
   * Import a profile
   */
  async function importProfile(data: string, sourceFormat?: string): Promise<ProfileImportResult> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }
    
    loading.value = true;
    error.value = null;
    
    try {
      const result = await profileManager.importProfile(data, sourceFormat);
      
      if (!result.success) {
        error.value = `Import failed: ${result.errors.join(', ')}`;
      }
      
      return result;
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to import profile';
      throw err;
    } finally {
      loading.value = false;
    }
  }
  
  // ============================================================================
  // Validation Operations
  // ============================================================================
  
  /**
   * Validate a profile
   */
  async function validateProfile(profileId: string): Promise<ProfileValidationResult> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }
    
    return await profileManager.validateProfile(profileId);
  }
  
  // ============================================================================
  // Search and Filtering
  // ============================================================================
  
  /**
   * Search profiles with filters
   */
  async function searchProfiles(filters: any = {}, sort?: any): Promise<ProfileMetadata[]> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }
    
    return await profileManager.searchProfiles(filters, sort);
  }
  
  // ============================================================================
  // Utility Methods
  // ============================================================================
  
  /**
   * Refresh profile metadata
   */
  async function refreshMetadata(): Promise<void> {
    if (!profileManager) return;
    
    try {
      const metadata = await profileManager.getProfileMetadata(true);
      profileMetadata.value = metadata;
    } catch (err) {
      console.error('Failed to refresh profile metadata:', err);
    }
  }
  
  /**
   * Clear error state
   */
  function clearError(): void {
    error.value = null;
  }
  
  /**
   * Get storage statistics
   */
  function getStorageStats(): { used: number; total: number; profiles: number } {
    if (!profileManager) {
      return { used: 0, total: 0, profiles: 0 };
    }
    return profileManager.getStorageStats();
  }
  
  /**
   * Clear all profile data (dangerous!)
   */
  async function clearAllData(): Promise<void> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }
    
    loading.value = true;
    
    try {
      await profileManager.clearAllData();
      
      // Reset state
      profiles.value.clear();
      profileMetadata.value = [];
      activeProfile.value = null;
      activeProfileId.value = null;
      error.value = null;
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to clear data';
      throw err;
    } finally {
      loading.value = false;
    }
  }
  
  // ============================================================================
  // Backward Compatibility Helpers
  // ============================================================================
  
  /**
   * Get profile by ID (backward compatibility)
   */
  function getProfileById(profileId: string): TinkerProfile | undefined {
    return profiles.value.get(profileId);
  }
  
  /**
   * Duplicate a profile (backward compatibility)
   */
  async function duplicateProfile(profileId: string, newName?: string): Promise<string> {
    const original = await loadProfile(profileId);
    if (!original) {
      throw new Error('Profile not found');
    }
    
    const duplicated = structuredClone(original);
    duplicated.Character.Name = newName || `${original.Character.Name} (Copy)`;
    
    return await createProfile(duplicated.Character.Name, duplicated);
  }

  /**
   * Modify a specific skill value
   */
  async function modifySkill(profileId: string, category: string, skillName: string, newValue: number): Promise<void> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }

    const profile = await loadProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    // Update the skill value
    if (profile.Skills && profile.Skills[category as keyof typeof profile.Skills]) {
      const skillCategory = profile.Skills[category as keyof typeof profile.Skills];
      if (typeof skillCategory === 'object' && skillCategory !== null && skillName in skillCategory) {
        if (category === 'Misc') {
          // Misc skills don't use IP tracking
          (skillCategory as any)[skillName] = newValue;
        } else {
          // Other skills use SkillWithIP structure
          const skill = (skillCategory as any)[skillName];
          if (skill && typeof skill === 'object') {
            skill.value = newValue;
            // IP cost will be recalculated when IP tracker is refreshed
          }
        }
      }
    }

    await updateProfile(profileId, profile);
  }

  /**
   * Modify a specific ability value
   */
  async function modifyAbility(profileId: string, abilityName: string, newValue: number): Promise<void> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }

    const profile = await loadProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    // Update the ability value
    if (profile.Skills?.Attributes && abilityName in profile.Skills.Attributes) {
      const ability = profile.Skills.Attributes[abilityName as keyof typeof profile.Skills.Attributes];
      if (ability && typeof ability === 'object') {
        ability.value = newValue;
        // IP cost will be recalculated when IP tracker is refreshed
      }
    }

    await updateProfile(profileId, profile);
  }

  /**
   * Recalculate IP tracking for a profile
   */
  async function recalculateProfileIP(profileId: string): Promise<void> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }

    const profile = await loadProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    // Use the IP integrator to recalculate IP tracking
    const { updateProfileWithIPTracking } = await import('@/lib/tinkerprofiles/ip-integrator');
    const updatedProfile = await updateProfileWithIPTracking(profile);
    
    await updateProfile(profileId, updatedProfile);
  }

  /**
   * Update character metadata with proper recalculation of dependent values
   */
  async function updateCharacterMetadata(profileId: string, changes: {
    name?: string;
    level?: number;
    profession?: string;
    breed?: string;
    faction?: string;
    accountType?: string;
  }): Promise<{
    success: boolean;
    warnings: string[];
    errors: string[];
    ipDelta?: number;
  }> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }

    loading.value = true;
    error.value = null;

    try {
      const profile = await loadProfile(profileId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      // Use the profile update service
      const { updateCharacterMetadata } = await import('@/services/profile-update-service');
      const result = await updateCharacterMetadata(profile, changes);

      if (result.success && result.updatedProfile) {
        // Update the profile in storage
        await updateProfile(profileId, result.updatedProfile);
        
        // Refresh active profile if this is the active one
        if (activeProfileId.value === profileId) {
          activeProfile.value = result.updatedProfile;
        }
      } else if (result.errors.length > 0) {
        error.value = result.errors.join(', ');
      }

      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update character metadata';
      error.value = errorMessage;
      return {
        success: false,
        warnings: [],
        errors: [errorMessage]
      };
    } finally {
      loading.value = false;
    }
  }
  
  // ============================================================================
  // Auto-initialization
  // ============================================================================
  
  // Initialize the store automatically
  initialize();
  
  // ============================================================================
  // Return Store Interface
  // ============================================================================
  
  return {
    // State (readonly)
    profiles: readonly(profiles),
    profileMetadata: readonly(profileMetadata),
    activeProfileId: readonly(activeProfileId),
    activeProfile: readonly(activeProfile),
    loading: readonly(loading),
    error: readonly(error),
    
    // Computed properties
    hasProfiles,
    hasActiveProfile,
    profileOptions,
    activeProfileName,
    activeProfileProfession,
    activeProfileLevel,
    
    // Actions
    loadProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    loadProfile,
    setActiveProfile,
    clearActiveProfile,
    getAsNanoCompatible,
    createFromNanoCompatible,
    exportProfile,
    importProfile,
    validateProfile,
    searchProfiles,
    refreshMetadata,
    clearError,
    getStorageStats,
    clearAllData,
    
    // Backward compatibility
    getProfileById,
    duplicateProfile,
    
    // Profile modification methods
    modifySkill,
    modifyAbility,
    recalculateProfileIP,
    updateCharacterMetadata,
    
    // Direct access to manager (for advanced use cases)
    getManager: () => profileManager
  };
});
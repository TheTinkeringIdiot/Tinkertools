/**
 * TinkerProfiles Pinia Store
 * 
 * Vue 3 Pinia store wrapper for the TinkerProfiles library,
 * providing reactive state management for profile operations
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly, watch, toRaw } from 'vue';
import {
  TinkerProfilesManager,
  type TinkerProfile,
  type ProfileMetadata,
  type ProfileExportFormat,
  type ProfileImportResult,
  type ProfileValidationResult,
  type TinkerProfilesConfig
} from '@/lib/tinkerprofiles';
import { nanoCompatibility } from '@/utils/nano-compatibility';
import type { Item } from '@/types/api';
import { skillService } from '@/services/skill-service';
import type { SkillId } from '@/types/skills';

// Types that may not be exported yet
type NanoCompatibleProfile = any; // TODO: Add proper type when available
type BulkImportResult = {
  totalProfiles: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  results: Array<{
    profileName: string;
    profileId?: string;
    success: boolean;
    skipped: boolean;
    error?: string;
    warnings: string[];
  }>;
  metadata: {
    source: string;
    exportVersion: string;
    exportDate: string;
  };
};

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
        autoBackup: false,
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
        const activeWithCaps = await updateProfileWithIPTracking(active);
        
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
        const profileWithCaps = await updateProfileWithIPTracking(profile);

        // Save the updated profile back to storage to persist the recalculated values
        await profileManager.updateProfile(profileId, profileWithCaps);

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
          // First set the profile
          activeProfile.value = profile;
          activeProfileId.value = profileId;

          // Set up equipment watchers for future changes
          setupEquipmentWatchers();

          // Immediately recalculate equipment bonuses without debounce
          // This ensures MaxNCU and other equipment bonuses are properly applied
          const { updateProfileWithIPTracking } = await import('@/lib/tinkerprofiles/ip-integrator');
          const updatedProfile = await updateProfileWithIPTracking(profile);

          // Update the active profile with recalculated bonuses
          activeProfile.value = updatedProfile;
          profiles.value.set(updatedProfile.id, updatedProfile);
        }
      } else {
        activeProfile.value = null;
        activeProfileId.value = null;
        cleanupEquipmentWatchers();
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
   * Export all profiles as a single JSON file
   */
  async function exportAllProfiles(): Promise<string> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }
    
    loading.value = true;
    error.value = null;
    
    try {
      const allProfiles: TinkerProfile[] = [];
      
      // Load all profiles
      for (const metadata of profileMetadata.value) {
        const profile = await loadProfile(metadata.id);
        if (profile) {
          allProfiles.push(profile);
        }
      }
      
      // Create export object
      const exportData = {
        version: "1.0",
        exportDate: new Date().toISOString(),
        profileCount: allProfiles.length,
        profiles: allProfiles
      };
      
      return JSON.stringify(exportData, null, 2);
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to export all profiles';
      throw err;
    } finally {
      loading.value = false;
    }
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
  
  /**
   * Import multiple profiles from export all format
   */
  async function importAllProfiles(data: string, options: { 
    skipDuplicates?: boolean; 
    overwriteExisting?: boolean; 
  } = {}): Promise<BulkImportResult> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }
    
    loading.value = true;
    error.value = null;
    
    try {
      // Parse the bulk export data
      let exportData: any;
      try {
        exportData = JSON.parse(data);
      } catch (parseError) {
        throw new Error('Invalid JSON format');
      }
      
      // Validate bulk export structure
      if (!exportData.version || !exportData.profiles || !Array.isArray(exportData.profiles)) {
        throw new Error('Invalid bulk export format');
      }
      
      const profiles = exportData.profiles as TinkerProfile[];
      const existingProfiles = profileMetadata.value.map(p => p.name.toLowerCase());
      
      const result: BulkImportResult = {
        totalProfiles: profiles.length,
        successCount: 0,
        failureCount: 0,
        skippedCount: 0,
        results: [],
        metadata: {
          source: 'TinkerProfiles Bulk Export',
          exportVersion: exportData.version,
          exportDate: exportData.exportDate
        }
      };
      
      // Process each profile
      for (const profile of profiles) {
        const profileResult = {
          profileName: profile.Character?.Name || 'Unknown',
          profileId: undefined as string | undefined,
          success: false,
          skipped: false,
          error: undefined as string | undefined,
          warnings: [] as string[]
        };
        
        try {
          // Check for duplicates
          const isDuplicate = existingProfiles.includes(profileResult.profileName.toLowerCase());
          
          if (isDuplicate) {
            if (options.skipDuplicates) {
              profileResult.skipped = true;
              result.skippedCount++;
              result.results.push(profileResult);
              continue;
            } else if (!options.overwriteExisting) {
              // Generate unique name
              let counter = 1;
              let newName = `${profileResult.profileName} (${counter})`;
              while (existingProfiles.includes(newName.toLowerCase())) {
                counter++;
                newName = `${profileResult.profileName} (${counter})`;
              }
              profile.Character.Name = newName;
              profileResult.profileName = newName;
              profileResult.warnings?.push('Profile renamed to avoid duplicate');
            }
          }
          
          // Import the individual profile
          const profileJson = JSON.stringify(profile);
          const importResult = await importProfile(profileJson);
          
          if (importResult.success && importResult.profile) {
            profileResult.success = true;
            profileResult.profileId = importResult.profile.id;
            profileResult.warnings?.push(...(importResult.warnings || []));
            result.successCount++;
            
            // Add to existing profiles list to prevent duplicates within this batch
            existingProfiles.push(profileResult.profileName.toLowerCase());
          } else {
            profileResult.error = importResult.errors.join(', ');
            result.failureCount++;
          }
          
        } catch (profileError) {
          profileResult.error = profileError instanceof Error ? profileError.message : 'Unknown error';
          result.failureCount++;
        }
        
        result.results.push(profileResult);
      }
      
      return result;
      
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to import profiles';
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
   * Modify a specific skill value using skill ID
   */
  async function modifySkill(profileId: string, skillId: SkillId | number, newValue: number): Promise<void> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }

    const profile = await loadProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    // Set flag to prevent equipment watchers from firing
    isUpdatingSkills = true;

    try {
      // Use the IP integrator's modifySkill function which handles ID-based updates
      const { modifySkill } = await import('@/lib/tinkerprofiles/ip-integrator');
      const result = await modifySkill(profile, Number(skillId), newValue);

      if (result.success && result.updatedProfile) {
        // Update the profile in storage and state
        await updateProfile(profileId, result.updatedProfile);

        // Update active profile if this is the active one
        if (activeProfileId.value === profileId) {
          activeProfile.value = result.updatedProfile;
          profiles.value.set(profileId, result.updatedProfile);
        }
      } else {
        throw new Error(result.error || 'Failed to modify skill');
      }
    } finally {
      // Always clear the flag
      isUpdatingSkills = false;
    }
  }

  /**
   * Equip an item to the active profile
   */
  async function equipItem(item: any, slot: string): Promise<void> {
    if (!activeProfile.value) {
      throw new Error('No active profile selected');
    }

    // Determine equipment category based on item type or slot
    let category: 'Weapons' | 'Clothing' | 'Implants';

    // Check item class to determine category
    // Based on common AO item classes:
    // 1 = Weapon, 2 = Armor/Clothing, 3 = Implant
    if (item.item_class === 1) {
      category = 'Weapons';
    } else if (item.item_class === 2) {
      category = 'Clothing';
    } else if (item.item_class === 3) {
      category = 'Implants';
    } else {
      // Fallback: determine from slot name
      if (slot.includes('Implant') || slot.includes('Eye') || slot.includes('Head') || slot.includes('Ear')) {
        category = 'Implants';
      } else if (slot.includes('Weapon') || slot.includes('HUD') || slot.includes('NCU') || slot.includes('Hand') || slot.includes('Deck')) {
        category = 'Weapons';
      } else {
        category = 'Clothing';
      }
    }

    // Convert reactive proxies to plain objects to avoid serialization issues
    const plainProfile = toRaw(activeProfile.value);
    const plainItem = toRaw(item);

    // Update the equipment slot - this will trigger watchers for stat recalculation
    const updatedProfile = { ...plainProfile };
    updatedProfile[category][slot] = plainItem;

    // Update the profile (triggers save and recalculation)
    await updateProfile(activeProfile.value.id, updatedProfile);

    // Update local state
    activeProfile.value = updatedProfile;
    profiles.value.set(activeProfile.value.id, updatedProfile);
  }

  /**
   * Unequip an item from the active profile
   */
  async function unequipItem(category: 'Weapons' | 'Clothing' | 'Implants', slot: string): Promise<void> {
    if (!activeProfile.value) {
      throw new Error('No active profile selected');
    }

    // Convert reactive proxy to plain object to avoid serialization issues
    const plainProfile = toRaw(activeProfile.value);

    // Update the equipment slot to null
    const updatedProfile = { ...plainProfile };
    updatedProfile[category][slot] = null;

    // Update the profile (triggers save and recalculation)
    await updateProfile(activeProfile.value.id, updatedProfile);

    // Update local state
    activeProfile.value = updatedProfile;
    profiles.value.set(activeProfile.value.id, updatedProfile);
  }

  /**
   * Modify a specific ability value with real-time trickle-down updates
   */
  async function modifyAbility(profileId: string, abilityName: string, newValue: number): Promise<{
    success: boolean;
    error?: string;
    trickleDownChanges?: Record<string, { old: number; new: number }>;
  }> {
    if (!profileManager) {
      throw new Error('Profile manager not initialized');
    }

    const profile = await loadProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    // Set flag to prevent equipment watchers from firing
    isUpdatingSkills = true;

    try {
      // Use enhanced IP integrator for ability modification
      const { modifyAbility } = await import('@/lib/tinkerprofiles/ip-integrator');
      const result = await modifyAbility(profile, abilityName, newValue);

      if (result.success && result.updatedProfile) {
        // Update the profile in storage and reactive state
        await updateProfile(profileId, result.updatedProfile);

        // Update active profile if this is the active one
        if (activeProfileId.value === profileId) {
          activeProfile.value = result.updatedProfile;
          profiles.value.set(profileId, result.updatedProfile);
        }

        return {
          success: true,
          trickleDownChanges: result.trickleDownChanges
        };
      } else {
        return {
          success: false,
          error: result.error
        };
      }
    } finally {
      // Always clear the flag
      isUpdatingSkills = false;
    }
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
  // Equipment Change Detection
  // ============================================================================

  // Debounce timer for equipment changes
  let equipmentDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Batch update state to prevent multiple simultaneous updates
  const equipmentUpdateState = ref({
    isUpdating: false,
    pendingUpdate: false,
    lastUpdateTime: 0,
    batchedChanges: [] as string[] // Track which equipment slots changed
  });

  /**
   * Handle equipment changes with optimized debouncing and batching
   */
  async function handleEquipmentChange(slotName?: string): Promise<void> {
    if (!activeProfile.value) return;

    // Clear existing timer first to prevent accumulation
    if (equipmentDebounceTimer) {
      clearTimeout(equipmentDebounceTimer);
      // Clear the batched changes when cancelling a timer
      // to prevent accumulation of duplicate slot names
      equipmentUpdateState.value.batchedChanges = [];
    }

    // Track which slots are changing for better debugging
    if (slotName) {
      equipmentUpdateState.value.batchedChanges.push(slotName);
    }

    // If currently updating, mark pending and return
    if (equipmentUpdateState.value.isUpdating) {
      equipmentUpdateState.value.pendingUpdate = true;
      return;
    }

    // Use requestAnimationFrame for UI batching, then setTimeout for debouncing
    requestAnimationFrame(() => {
      equipmentDebounceTimer = setTimeout(async () => {
        await executeEquipmentUpdate();
      }, 100); // 100ms debounce as specified in requirements
    });
  }

  // Flag to prevent recursive updates when setting profile from equipment recalculation
  let isUpdatingFromEquipmentBonus = false;

  // Flag to prevent equipment watchers from firing during skill/ability updates
  let isUpdatingSkills = false;

  // Flag to prevent recursive updates when setting profile from perk recalculation
  let isUpdatingFromPerkChanges = false;

  // Flag to prevent recursive updates when setting profile from buff recalculation
  let isUpdatingFromBuffs = false;

  /**
   * Execute the actual equipment bonus recalculation
   */
  async function executeEquipmentUpdate(): Promise<void> {
    if (!activeProfile.value || equipmentUpdateState.value.isUpdating) {
      return;
    }

    equipmentUpdateState.value.isUpdating = true;
    equipmentUpdateState.value.lastUpdateTime = performance.now();
    equipmentUpdateState.value.batchedChanges = [];

    try {
      // Simply recalculate everything - the new structure handles it correctly
      const { updateProfileWithIPTracking } = await import('@/lib/tinkerprofiles/ip-integrator');
      const updatedProfile = await updateProfileWithIPTracking(activeProfile.value);

      // Set flags to prevent watchers from triggering
      isUpdatingFromEquipmentBonus = true;
      isUpdatingFromPerkChanges = true;
      isUpdatingFromBuffs = true;

      // Update profile data
      activeProfile.value = updatedProfile;
      profiles.value.set(updatedProfile.id, updatedProfile);

      // Persist to storage
      await updateProfile(activeProfile.value.id, updatedProfile);

      // Clear flags after update
      isUpdatingFromEquipmentBonus = false;
      isUpdatingFromPerkChanges = false;
      isUpdatingFromBuffs = false;

    } catch (err) {
      console.error('Equipment change handling failed:', err);
      isUpdatingFromEquipmentBonus = false; // Ensure flag is cleared on error
      isUpdatingFromPerkChanges = false; // Ensure flag is cleared on error
      isUpdatingFromBuffs = false; // Ensure flag is cleared on error
    } finally {
      equipmentUpdateState.value.isUpdating = false;

      // Process any pending updates
      if (equipmentUpdateState.value.pendingUpdate) {
        equipmentUpdateState.value.pendingUpdate = false;
        // Use a microtask to avoid stack overflow
        Promise.resolve().then(() => handleEquipmentChange());
      }
    }
  }

  // Store watcher stop handles to clean them up later
  let equipmentWatcherStopHandles: Array<() => void> = [];

  /**
   * Set up optimized equipment change watchers for the active profile
   */
  function setupEquipmentWatchers(): void {
    if (!activeProfile.value) return;

    // Clean up any existing watchers before setting up new ones
    cleanupEquipmentWatchers();

    // Watch for changes to equipment objects with slot identification
    const weaponsWatcher = watch(
      () => activeProfile.value?.Weapons,
      (newWeapons, oldWeapons) => {
        // Skip if we're updating from equipment bonus recalculation, skills, perks, or buffs
        if (isUpdatingFromEquipmentBonus || isUpdatingSkills || isUpdatingFromPerkChanges || isUpdatingFromBuffs) return;
        // Only trigger if there are actual changes
        if (newWeapons !== oldWeapons) {
          handleEquipmentChange('Weapons');
        }
      },
      { deep: true, flush: 'post' }
    );

    const clothingWatcher = watch(
      () => activeProfile.value?.Clothing,
      (newClothing, oldClothing) => {
        // Skip if we're updating from equipment bonus recalculation, skills, perks, or buffs
        if (isUpdatingFromEquipmentBonus || isUpdatingSkills || isUpdatingFromPerkChanges || isUpdatingFromBuffs) return;
        if (newClothing !== oldClothing) {
          handleEquipmentChange('Clothing');
        }
      },
      { deep: true, flush: 'post' }
    );

    const implantsWatcher = watch(
      () => activeProfile.value?.Implants,
      (newImplants, oldImplants) => {
        // Skip if we're updating from equipment bonus recalculation, skills, perks, or buffs
        if (isUpdatingFromEquipmentBonus || isUpdatingSkills || isUpdatingFromPerkChanges || isUpdatingFromBuffs) return;
        if (newImplants !== oldImplants) {
          handleEquipmentChange('Implants');
        }
      },
      { deep: true, flush: 'post' }
    );

    const perksWatcher = watch(
      () => activeProfile.value?.PerksAndResearch,
      (newPerks, oldPerks) => {
        // Skip if we're updating from equipment bonus recalculation, skills, perks, or buffs
        if (isUpdatingFromEquipmentBonus || isUpdatingSkills || isUpdatingFromPerkChanges || isUpdatingFromBuffs) return;
        if (newPerks !== oldPerks) {
          handleEquipmentChange('PerksAndResearch');
        }
      },
      { deep: true, flush: 'post' }
    );

    const buffsWatcher = watch(
      () => activeProfile.value?.buffs,
      (newBuffs, oldBuffs) => {
        // Skip if we're updating from buff recalculation
        if (isUpdatingFromBuffs) return;
        if (newBuffs !== oldBuffs) {
          handleEquipmentChange('Buffs');
        }
      },
      { deep: true, flush: 'post' }
    );

    // Store the stop handles for cleanup
    equipmentWatcherStopHandles = [weaponsWatcher, clothingWatcher, implantsWatcher, perksWatcher, buffsWatcher];
  }

  /**
   * Clean up equipment watchers to prevent memory leaks
   */
  function cleanupEquipmentWatchers(): void {
    equipmentWatcherStopHandles.forEach(stopWatcher => stopWatcher());
    equipmentWatcherStopHandles = [];
  }

  // Set up watchers when active profile changes
  watch(
    activeProfile,
    (newProfile, oldProfile) => {
      // Clear any pending updates when switching profiles
      if (oldProfile && newProfile?.id !== oldProfile.id) {
        if (equipmentDebounceTimer) {
          clearTimeout(equipmentDebounceTimer);
          equipmentDebounceTimer = null;
        }
        equipmentUpdateState.value.isUpdating = false;
        equipmentUpdateState.value.pendingUpdate = false;
        equipmentUpdateState.value.batchedChanges = [];
      }

      if (newProfile) {
        setupEquipmentWatchers();
      } else {
        // Clean up watchers when no profile is active
        cleanupEquipmentWatchers();
      }
    },
    { immediate: true }
  );

  // ============================================================================
  // Buff Management and NCU Tracking
  // ============================================================================

  /**
   * Get current NCU usage from active buffs
   */
  const currentNCU = computed(() => {
    if (!activeProfile.value || !activeProfile.value.buffs) {
      return 0;
    }

    return activeProfile.value.buffs.reduce((total, buff) => {
      // NCU cost is stored in stat 54
      const ncuStat = buff.stats?.find(stat => stat.stat === 54);
      return total + (ncuStat?.value || 0);
    }, 0);
  });

  /**
   * Get maximum NCU capacity from Max NCU skill (stat 181)
   */
  const maxNCU = computed(() => {
    if (!activeProfile.value) {
      return 0;
    }

    // MaxNCU is skill ID 181 in the new ID-based structure
    const maxNCUSkill = activeProfile.value.skills?.[181];

    if (maxNCUSkill) {
      // Use the total value from the unified SkillData structure
      return maxNCUSkill.total || 0;
    }

    return 0;
  });

  /**
   * Get available NCU space
   */
  const availableNCU = computed(() => {
    return Math.max(0, maxNCU.value - currentNCU.value);
  });

  /**
   * Check if a buff can be cast based on NCU requirements
   */
  function canCastBuff(item: Item): boolean {
    if (!item.is_nano || !activeProfile.value) {
      return false;
    }

    // Get NCU cost from stat 54
    const ncuStat = item.stats?.find(stat => stat.stat === 54);
    const ncuCost = ncuStat?.value || 0;

    return ncuCost <= availableNCU.value;
  }

  /**
   * Get buff conflicts based on NanoStrain (stat 75)
   */
  function getBuffConflicts(item: Item): Item[] {
    if (!activeProfile.value?.buffs || !item.is_nano) {
      return [];
    }

    // Get NanoStrain from stat 75
    const newStrainStat = item.stats?.find(stat => stat.stat === 75);
    if (!newStrainStat) {
      return [];
    }

    const newStrain = newStrainStat.value;

    return activeProfile.value.buffs.filter(buff => {
      const buffStrainStat = buff.stats?.find(stat => stat.stat === 75);
      return buffStrainStat && buffStrainStat.value === newStrain;
    });
  }

  /**
   * Cast a buff nano on the active profile
   */
  async function castBuff(item: Item): Promise<void> {
    if (!activeProfile.value) {
      throw new Error('No active profile selected');
    }

    if (!item.is_nano) {
      throw new Error('Only nano items can be cast as buffs');
    }

    // Initialize buffs array if it doesn't exist
    if (!activeProfile.value.buffs) {
      activeProfile.value.buffs = [];
    }

    // Check NCU requirements
    const ncuStat = item.stats?.find(stat => stat.stat === 54);
    const ncuCost = ncuStat?.value || 0;

    if (ncuCost > availableNCU.value) {
      throw new Error(`Requires ${ncuCost} NCU, but only ${availableNCU.value} available`);
    }

    // Check for NanoStrain conflicts
    const conflicts = getBuffConflicts(item);

    if (conflicts.length > 0) {
      // Get StackingOrder values for comparison (stat 551)
      const newStackingOrderStat = item.stats?.find(stat => stat.stat === 551);
      const newStackingOrder = newStackingOrderStat?.value || 0;

      for (const conflictBuff of conflicts) {
        const conflictStackingOrderStat = conflictBuff.stats?.find(stat => stat.stat === 551);
        const conflictStackingOrder = conflictStackingOrderStat?.value || 0;

        // Higher StackingOrder replaces lower, equal StackingOrder means new replaces existing
        if (newStackingOrder >= conflictStackingOrder) {
          // Remove the conflicting buff
          activeProfile.value.buffs = activeProfile.value.buffs.filter(buff => buff.id !== conflictBuff.id);
        } else {
          // New buff has lower priority, cannot cast
          throw new Error(`${conflictBuff.name} has higher stacking priority`);
        }
      }
    }

    // Convert reactive proxy to plain object to avoid serialization issues
    const plainItem = toRaw(item);

    // Add the buff
    activeProfile.value.buffs.push(plainItem);

    // Set flag to prevent watcher loops
    isUpdatingFromBuffs = true;

    try {
      // Trigger recalculation using the IP integrator
      const { updateProfileWithIPTracking } = await import('@/lib/tinkerprofiles/ip-integrator');
      const updatedProfile = await updateProfileWithIPTracking(activeProfile.value);

      // Update the profile in storage and state
      await updateProfile(activeProfile.value.id, updatedProfile);

      // Update local state
      activeProfile.value = updatedProfile;
      profiles.value.set(activeProfile.value.id, updatedProfile);
    } finally {
      isUpdatingFromBuffs = false;
    }
  }

  /**
   * Remove a specific buff from the active profile
   */
  async function removeBuff(itemId: number): Promise<void> {
    if (!activeProfile.value || !activeProfile.value.buffs) {
      return;
    }

    const buffToRemove = activeProfile.value.buffs.find(buff => buff.id === itemId);
    if (!buffToRemove) {
      return;
    }

    // Remove the buff
    activeProfile.value.buffs = activeProfile.value.buffs.filter(buff => buff.id !== itemId);

    // Set flag to prevent watcher loops
    isUpdatingFromBuffs = true;

    try {
      // Trigger recalculation using the IP integrator
      const { updateProfileWithIPTracking } = await import('@/lib/tinkerprofiles/ip-integrator');
      const updatedProfile = await updateProfileWithIPTracking(activeProfile.value);

      // Update the profile in storage and state
      await updateProfile(activeProfile.value.id, updatedProfile);

      // Update local state
      activeProfile.value = updatedProfile;
      profiles.value.set(activeProfile.value.id, updatedProfile);
    } finally {
      isUpdatingFromBuffs = false;
    }
  }

  /**
   * Remove all buffs from the active profile
   */
  async function removeAllBuffs(): Promise<void> {
    if (!activeProfile.value || !activeProfile.value.buffs || activeProfile.value.buffs.length === 0) {
      return;
    }

    // Clear all buffs
    activeProfile.value.buffs = [];

    // Set flag to prevent watcher loops
    isUpdatingFromBuffs = true;

    try {
      // Trigger recalculation using the IP integrator
      const { updateProfileWithIPTracking } = await import('@/lib/tinkerprofiles/ip-integrator');
      const updatedProfile = await updateProfileWithIPTracking(activeProfile.value);

      // Update the profile in storage and state
      await updateProfile(activeProfile.value.id, updatedProfile);

      // Update local state
      activeProfile.value = updatedProfile;
      profiles.value.set(activeProfile.value.id, updatedProfile);
    } finally {
      isUpdatingFromBuffs = false;
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
    exportAllProfiles,
    importProfile,
    importAllProfiles,
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

    // Equipment methods
    equipItem,
    unequipItem,

    // Buff management methods
    castBuff,
    removeBuff,
    removeAllBuffs,
    canCastBuff,
    getBuffConflicts,

    // NCU tracking computed properties
    currentNCU: readonly(currentNCU),
    maxNCU: readonly(maxNCU),
    availableNCU: readonly(availableNCU),

    // Direct access to manager (for advanced use cases)
    getManager: () => profileManager,

    // Performance monitoring
    getEquipmentUpdateStats: () => ({
      isUpdating: equipmentUpdateState.value.isUpdating,
      lastUpdateTime: equipmentUpdateState.value.lastUpdateTime,
      hasPendingUpdate: equipmentUpdateState.value.pendingUpdate
    })
  };
});
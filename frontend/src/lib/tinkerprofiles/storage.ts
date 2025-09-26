/**
 * TinkerProfiles Storage Manager
 * 
 * Handles persistent storage for profiles with compression and encryption
 * capabilities
 */

import type {
  TinkerProfile,
  ProfileStorageOptions,
  ProfileMetadata
} from './types';
import { STORAGE_KEYS, CURRENT_VERSION } from './constants';
import { toRaw } from 'vue';

export class ProfileStorage {
  private options: ProfileStorageOptions;

  constructor(options: ProfileStorageOptions = {}) {
    this.options = {
      compress: false,
      encrypt: false,
      autoSave: true,
      migrationEnabled: true,
      ...options
    };

    // Clean up legacy backup data on initialization
    this.cleanupLegacyBackups();

    // Migrate from old storage format if needed
    this.migrateFromLegacyStorage();
  }
  
  // ============================================================================
  // Core Storage Operations
  // ============================================================================
  
  /**
   * Strip computed values from skills before saving
   */
  private stripComputedValues(profile: TinkerProfile): TinkerProfile {
    // Convert Vue proxy to raw object first, then create a deep clone
    const rawProfile = toRaw(profile);
    const stripped = structuredClone(rawProfile);

    // Strip computed values from skills
    if (stripped.Skills) {
      // Process all skill categories
      Object.keys(stripped.Skills).forEach(category => {
        const skillCategory = stripped.Skills[category as keyof typeof stripped.Skills];
        if (skillCategory && typeof skillCategory === 'object') {
          Object.values(skillCategory).forEach((skill: any) => {
            if (skill && typeof skill === 'object') {
              // Keep only stored values
              const stored = {
                pointFromIp: skill.pointFromIp || 0,
                ipSpent: skill.ipSpent || 0
              };
              // Remove all computed values
              delete skill.value;
              delete skill.baseValue;
              delete skill.trickleDown;
              delete skill.equipmentBonus;
              delete skill.cap;
              // Set the stored values
              skill.pointFromIp = stored.pointFromIp;
              skill.ipSpent = stored.ipSpent;
            }
          });
        }
      });
    }

    // Update version to 3.0.0
    stripped.version = '3.0.0';

    return stripped;
  }

  /**
   * Save a profile to localStorage
   */
  async saveProfile(profile: TinkerProfile): Promise<void> {
    try {
      // Strip computed values before saving
      const profileToSave = this.stripComputedValues(profile);

      // Save the individual profile
      const profileKey = `${STORAGE_KEYS.PROFILE_PREFIX}${profile.id}`;
      const data = this.options.compress ? await this.compress(profileToSave) : JSON.stringify(profileToSave);
      localStorage.setItem(profileKey, data);

      // Update the index
      await this.updateProfileIndex(profile.id, 'add');

      console.log(`[ProfileStorage] Saved profile ${profile.id} to individual key (v3 minimal format)`);

    } catch (error) {
      throw new Error(`Failed to save profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Load a specific profile by ID
   */
  async loadProfile(profileId: string): Promise<TinkerProfile | null> {
    try {
      const profileKey = `${STORAGE_KEYS.PROFILE_PREFIX}${profileId}`;
      const data = localStorage.getItem(profileKey);

      if (!data || data.trim() === '' || data === 'null') {
        return null;
      }

      let profile: TinkerProfile;

      if (this.options.compress) {
        profile = await this.decompress(data);
      } else {
        profile = JSON.parse(data);
      }

      // Apply migrations including perk system migration
      profile = await this.migrateProfile(profile);

      // For v3 profiles, we need to recalculate all computed values
      // Import dynamically to avoid circular dependencies
      const { updateProfileWithIPTracking } = await import('./ip-integrator');
      profile = await updateProfileWithIPTracking(profile);

      return profile;
    } catch (error) {
      console.error('Failed to load profile:', error);
      return null;
    }
  }
  
  /**
   * Load all profiles
   */
  async loadAllProfiles(): Promise<Map<string, TinkerProfile>> {
    try {
      const profiles = new Map<string, TinkerProfile>();

      // Get the profile index
      const index = await this.getProfileIndex();

      // Load each profile individually
      for (const profileId of index) {
        const profile = await this.loadProfile(profileId);
        if (profile) {
          profiles.set(profileId, profile);
        }
      }

      return profiles;

    } catch (error) {
      console.error('Failed to load profiles from storage:', error);
      return new Map();
    }
  }
  
  /**
   * Delete a profile
   */
  async deleteProfile(profileId: string): Promise<void> {
    try {
      // Remove the individual profile
      const profileKey = `${STORAGE_KEYS.PROFILE_PREFIX}${profileId}`;
      localStorage.removeItem(profileKey);

      // Update the index
      await this.updateProfileIndex(profileId, 'remove');

      console.log(`[ProfileStorage] Deleted profile ${profileId}`);

    } catch (error) {
      console.error(`[ProfileStorage] Failed to delete profile ${profileId}:`, error);
      throw new Error(`Failed to delete profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get profile metadata (lightweight profile info)
   */
  async getProfileMetadata(): Promise<ProfileMetadata[]> {
    try {
      const metadata: ProfileMetadata[] = [];
      const index = await this.getProfileIndex();

      // Load each profile's metadata individually
      for (const profileId of index) {
        const profile = await this.loadProfile(profileId);
        if (profile) {
          metadata.push({
            id: profile.id,
            name: profile.Character.Name,
            profession: profile.Character.Profession,
            level: profile.Character.Level,
            breed: profile.Character.Breed,
            faction: profile.Character.Faction,
            created: profile.created,
            updated: profile.updated,
            version: profile.version
          });
        }
      }

      return metadata;

    } catch (error) {
      console.error('Failed to load profile metadata:', error);
      return [];
    }
  }
  
  // ============================================================================
  // Active Profile Management
  // ============================================================================
  
  /**
   * Set the active profile ID
   */
  async setActiveProfile(profileId: string | null): Promise<void> {
    try {
      if (profileId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_PROFILE, profileId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE);
      }
    } catch (error) {
      throw new Error(`Failed to set active profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get the active profile ID
   */
  getActiveProfileId(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE);
    } catch (error) {
      console.error('Failed to get active profile ID:', error);
      return null;
    }
  }
  
  /**
   * Load the active profile
   */
  async loadActiveProfile(): Promise<TinkerProfile | null> {
    const activeId = this.getActiveProfileId();
    if (!activeId) return null;
    
    return await this.loadProfile(activeId);
  }
  

  // ============================================================================
  // Migration
  // ============================================================================
  
  /**
   * Migrate a profile to the current version
   */
  private async migrateProfile(profile: TinkerProfile): Promise<TinkerProfile> {
    if (profile.version === CURRENT_VERSION) {
      // Even for current version profiles, check for BASE_SKILL and perk migrations
      const skillMigrated = await this.migrateBaseSkillValues(profile);
      return await this.migratePerkSystem(skillMigrated);
    }

    // Clone the profile for migration
    const migrated = structuredClone(profile);

    // Version-specific migrations
    if (!migrated.version || migrated.version < '2.0.0') {
      // Migrate from v1.x to v2.0
      migrated.version = CURRENT_VERSION;
      migrated.updated = new Date().toISOString();

      // Add any missing fields from current structure
      if (!migrated.created) {
        migrated.created = new Date().toISOString();
      }
    }

    // Apply BASE_SKILL migration to all profiles
    const skillMigrated = await this.migrateBaseSkillValues(migrated);

    // Apply perk system migration
    return await this.migratePerkSystem(skillMigrated);
  }

  /**
   * Migrate skills from value 1 to BASE_SKILL (5) for existing profiles
   * Only updates skills that are currently at 1 to avoid overwriting user modifications
   * Also adds cap field to all skills and calculates caps
   */
  private async migrateBaseSkillValues(profile: TinkerProfile): Promise<TinkerProfile> {
    const BASE_SKILL = 5;
    
    if (!profile.Skills) {
      return profile;
    }
    
    // Clone the profile to avoid mutating the original
    const migrated = structuredClone(profile);
    let skillsUpdated = 0;
    let capsAdded = 0;
    
    // IP-based skill categories to update
    const ipBasedCategories = [
      'Body & Defense',
      'Ranged Weapons', 
      'Ranged Specials',
      'Melee Weapons',
      'Melee Specials', 
      'Nanos & Casting',
      'Exploring',
      'Trade & Repair',
      'Combat & Healing'
    ];
    
    // Update IP-based skills
    for (const categoryName of ipBasedCategories) {
      const category = migrated.Skills[categoryName as keyof typeof migrated.Skills];
      
      if (category && typeof category === 'object') {
        for (const [skillName, skill] of Object.entries(category)) {
          if (skill && typeof skill === 'object' && 'value' in skill) {
            const skillData = skill as any;
            
            // Only update skills that are currently at 1 and have not been modified by user
            if (skillData.value === 1 && (!skillData.pointFromIp || skillData.pointFromIp === 0)) {
              skillData.value = BASE_SKILL;
              skillsUpdated++;
            }
            
            // Add cap field if missing
            if (skillData.cap === undefined) {
              skillData.cap = undefined; // Will be calculated by updateProfileSkillInfo
              capsAdded++;
            }
          }
        }
      }
    }
    
    // Update abilities to have cap field if missing
    if (migrated.Skills.Attributes) {
      const abilityNames = ['Strength', 'Agility', 'Stamina', 'Intelligence', 'Sense', 'Psychic'];
      abilityNames.forEach(abilityName => {
        const ability = migrated.Skills.Attributes![abilityName as keyof typeof migrated.Skills.Attributes] as any;
        if (ability && ability.cap === undefined) {
          ability.cap = undefined; // Will be calculated by updateProfileSkillInfo
          capsAdded++;
        }
      });
    }
    
    // Recalculate caps using the IP integrator
    if (capsAdded > 0) {
      try {
        // Import dynamically to avoid circular dependencies
        const { updateProfileSkillInfo } = await import('./ip-integrator');
        updateProfileSkillInfo(migrated);
      } catch (error) {
        console.warn('[ProfileStorage] Could not calculate caps during migration:', error);
      }
    }
    
    // If we updated any skills or added caps, mark the profile as updated
    if (skillsUpdated > 0 || capsAdded > 0) {
      migrated.updated = new Date().toISOString();
      console.log(`[ProfileStorage] Migrated profile ${migrated.Character.Name}: ${skillsUpdated} skills from value 1 to BASE_SKILL (${BASE_SKILL}), ${capsAdded} caps added`);
    }
    
    return migrated;
  }

  /**
   * Migrate Misc skills from numeric format to MiscSkill objects
   */
  private migrateMiscSkills(profile: TinkerProfile): TinkerProfile {
    if (!profile.Skills?.Misc) {
      return profile;
    }

    // Check if migration is needed by examining the first Misc skill
    const miscSkills = profile.Skills.Misc;
    const firstSkillName = Object.keys(miscSkills)[0];

    if (!firstSkillName) {
      return profile; // No Misc skills to migrate
    }

    const firstSkill = miscSkills[firstSkillName];

    // If it's already a MiscSkill object, no migration needed
    if (typeof firstSkill === 'object' && firstSkill !== null && 'baseValue' in firstSkill) {
      return profile;
    }

    console.log(`[ProfileStorage] Migrating Misc skills for profile ${profile.Character.Name}`);

    // Clone the profile to avoid mutating the original
    const migrated = structuredClone(profile);
    let skillsMigrated = 0;

    // Convert each numeric Misc skill to MiscSkill object
    for (const [skillName, skillValue] of Object.entries(miscSkills)) {
      if (typeof skillValue === 'number') {
        // Convert numeric value to MiscSkill object
        (migrated.Skills.Misc as any)[skillName] = {
          baseValue: 0,
          equipmentBonus: 0,
          perkBonus: 0,
          buffBonus: 0,
          value: skillValue // Preserve the original numeric value
        };
        skillsMigrated++;
      }
    }

    if (skillsMigrated > 0) {
      migrated.updated = new Date().toISOString();
      console.log(`[ProfileStorage] Migrated ${skillsMigrated} Misc skills from numeric to MiscSkill objects for profile ${profile.Character.Name}`);
    }

    return migrated;
  }

  /**
   * Migrate perk system to structured format if needed
   */
  private async migratePerkSystem(profile: TinkerProfile): Promise<TinkerProfile> {
    // First apply Misc skills migration
    const miscMigrated = this.migrateMiscSkills(profile);

    // Check if perk system migration is needed
    if (miscMigrated.PerksAndResearch &&
        typeof miscMigrated.PerksAndResearch === 'object' &&
        'perks' in miscMigrated.PerksAndResearch &&
        'standardPerkPoints' in miscMigrated.PerksAndResearch &&
        'aiPerkPoints' in miscMigrated.PerksAndResearch) {
      return miscMigrated; // Already migrated
    }

    console.log(`[ProfileStorage] Migrating perk system for profile ${miscMigrated.Character.Name}`);

    try {
      // Import transformer dynamically to avoid circular dependencies
      const { ProfileTransformer } = await import('./transformer');
      const transformer = new ProfileTransformer();

      const migratedProfile = transformer.migrateProfilePerks(miscMigrated);
      console.log(`[ProfileStorage] Successfully migrated perk system for profile ${miscMigrated.Character.Name}`);

      return migratedProfile;
    } catch (error) {
      console.error(`[ProfileStorage] Failed to migrate perk system for profile ${miscMigrated.Character.Name}:`, error);

      // Fallback: Create default perk system if migration fails
      const fallbackProfile = structuredClone(miscMigrated);
      const level = miscMigrated.Character.Level || 1;
      const alienLevel = miscMigrated.Character.AlienLevel || 0;

      // Calculate standard perk points
      const standardPerkPoints = level < 10 ? 0 :
        Math.min(Math.floor(level / 10), 20) + (level > 200 ? Math.min(level - 200, 20) : 0);

      // Calculate AI perk points
      const aiPerkPoints = Math.min(alienLevel, 30);

      fallbackProfile.PerksAndResearch = {
        perks: [],
        standardPerkPoints: {
          total: standardPerkPoints,
          spent: 0,
          available: standardPerkPoints
        },
        aiPerkPoints: {
          total: aiPerkPoints,
          spent: 0,
          available: aiPerkPoints
        },
        research: [],
        lastCalculated: new Date().toISOString()
      };

      fallbackProfile.updated = new Date().toISOString();
      console.log(`[ProfileStorage] Created fallback perk system for profile ${miscMigrated.Character.Name}`);

      return fallbackProfile;
    }
  }

  // ============================================================================
  // Compression (Future Enhancement)
  // ============================================================================
  
  private async compress(data: any): Promise<string> {
    // For now, just return JSON string
    // In future, could implement actual compression
    return JSON.stringify(data);
  }
  
  private async decompress(data: string): Promise<any> {
    // For now, just parse JSON
    // In future, could implement actual decompression
    return JSON.parse(data);
  }
  
  // ============================================================================
  // Private Utilities
  // ============================================================================

  /**
   * Get the profile index (list of profile IDs)
   */
  private async getProfileIndex(): Promise<string[]> {
    try {
      const indexData = localStorage.getItem(STORAGE_KEYS.PROFILE_INDEX);
      if (!indexData || indexData === 'null' || indexData === '[]') {
        return [];
      }
      return JSON.parse(indexData);
    } catch (error) {
      console.error('Failed to load profile index:', error);
      return [];
    }
  }

  /**
   * Update the profile index
   */
  private async updateProfileIndex(profileId: string, action: 'add' | 'remove'): Promise<void> {
    try {
      const index = await this.getProfileIndex();

      if (action === 'add') {
        if (!index.includes(profileId)) {
          index.push(profileId);
        }
      } else if (action === 'remove') {
        const idx = index.indexOf(profileId);
        if (idx > -1) {
          index.splice(idx, 1);
        }
      }

      localStorage.setItem(STORAGE_KEYS.PROFILE_INDEX, JSON.stringify(index));
    } catch (error) {
      console.error('Failed to update profile index:', error);
      throw new Error(`Failed to update profile index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Migrate from legacy storage format to individual profile keys
   */
  private async migrateFromLegacyStorage(): Promise<void> {
    try {
      // Check if legacy data exists
      const legacyData = localStorage.getItem(STORAGE_KEYS.PROFILES);
      if (!legacyData || legacyData === 'null' || legacyData === '{}') {
        return; // No legacy data to migrate
      }

      console.log('[ProfileStorage] Migrating from legacy storage format...');

      // Parse the legacy data
      let legacyProfiles: Record<string, TinkerProfile>;
      try {
        legacyProfiles = JSON.parse(legacyData);
      } catch (error) {
        console.error('[ProfileStorage] Failed to parse legacy data:', error);
        return;
      }

      if (!legacyProfiles || Object.keys(legacyProfiles).length === 0) {
        return;
      }

      // Migrate each profile to individual storage
      const profileIds: string[] = [];
      for (const [id, profile] of Object.entries(legacyProfiles)) {
        const profileKey = `${STORAGE_KEYS.PROFILE_PREFIX}${id}`;
        localStorage.setItem(profileKey, JSON.stringify(profile));
        profileIds.push(id);
      }

      // Save the index
      localStorage.setItem(STORAGE_KEYS.PROFILE_INDEX, JSON.stringify(profileIds));

      // Remove the legacy data
      localStorage.removeItem(STORAGE_KEYS.PROFILES);

      console.log(`[ProfileStorage] Successfully migrated ${profileIds.length} profiles to individual storage`);
    } catch (error) {
      console.error('[ProfileStorage] Migration failed:', error);
      // Don't throw - allow the app to continue even if migration fails
    }
  }

  /**
   * Save all profiles to storage (DEPRECATED - kept for backward compatibility)
   */
  private async saveAllProfiles(profiles: Map<string, TinkerProfile>): Promise<void> {
    // This method is no longer used but kept to avoid breaking changes
    // Individual profiles are now saved separately
    console.warn('[ProfileStorage] saveAllProfiles is deprecated - profiles are now saved individually');

    // Save each profile individually
    for (const [id, profile] of profiles.entries()) {
      await this.saveProfile(profile);
    }
  }

  
  // ============================================================================
  // Legacy Data Cleanup
  // ============================================================================
  
  /**
   * Clean up legacy backup data from localStorage
   */
  private cleanupLegacyBackups(): void {
    try {
      if (localStorage.getItem('tinkertools_profile_backups')) {
        localStorage.removeItem('tinkertools_profile_backups');
        console.log('[ProfileStorage] Cleaned up legacy backup data');
      }
    } catch (error) {
      console.warn('[ProfileStorage] Failed to clean up legacy backups:', error);
    }
  }
  
  // ============================================================================
  // Cleanup Operations
  // ============================================================================
  
  /**
   * Clear all profile data
   */
  async clearAllData(): Promise<void> {
    try {
      // Get all profile IDs from index
      const index = await this.getProfileIndex();

      // Remove each individual profile
      for (const profileId of index) {
        const profileKey = `${STORAGE_KEYS.PROFILE_PREFIX}${profileId}`;
        localStorage.removeItem(profileKey);
      }

      // Remove the index
      localStorage.removeItem(STORAGE_KEYS.PROFILE_INDEX);

      // Remove other storage keys
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE);
      localStorage.removeItem(STORAGE_KEYS.PROFILE_METADATA);
      localStorage.removeItem(STORAGE_KEYS.PROFILE_PREFERENCES);
      localStorage.removeItem(STORAGE_KEYS.VERSION);

      // Clean up legacy data
      localStorage.removeItem(STORAGE_KEYS.PROFILES);
      localStorage.removeItem('tinkertools_profile_backups');

    } catch (error) {
      throw new Error(`Failed to clear profile data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get storage usage statistics
   */
  getStorageStats(): { used: number; total: number; profiles: number } {
    try {
      let used = 0;

      // Count index size
      const indexData = localStorage.getItem(STORAGE_KEYS.PROFILE_INDEX);
      if (indexData) {
        used += indexData.length;
      }

      // Count individual profile sizes
      const index = indexData ? JSON.parse(indexData) : [];
      for (const profileId of index) {
        const profileKey = `${STORAGE_KEYS.PROFILE_PREFIX}${profileId}`;
        const profileData = localStorage.getItem(profileKey);
        if (profileData) {
          used += profileData.length;
        }
      }

      // Count other storage keys
      const otherKeys = [
        STORAGE_KEYS.ACTIVE_PROFILE,
        STORAGE_KEYS.PROFILE_METADATA,
        STORAGE_KEYS.PROFILE_PREFERENCES,
        STORAGE_KEYS.VERSION
      ];

      for (const key of otherKeys) {
        const item = localStorage.getItem(key);
        if (item) {
          used += item.length;
        }
      }

      const profiles = this.getProfileCount();

      return {
        used: used,
        total: 5 * 1024 * 1024, // 5MB typical localStorage limit
        profiles: profiles
      };

    } catch (error) {
      return { used: 0, total: 0, profiles: 0 };
    }
  }
  
  /**
   * Get number of stored profiles
   */
  private getProfileCount(): number {
    try {
      const indexData = localStorage.getItem(STORAGE_KEYS.PROFILE_INDEX);
      if (!indexData || indexData === 'null' || indexData === '[]') {
        return 0;
      }

      const index = JSON.parse(indexData);
      return index.length;

    } catch (error) {
      return 0;
    }
  }
}
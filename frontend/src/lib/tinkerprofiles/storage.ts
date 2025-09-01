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
  }
  
  // ============================================================================
  // Core Storage Operations
  // ============================================================================
  
  /**
   * Save a profile to localStorage
   */
  async saveProfile(profile: TinkerProfile): Promise<void> {
    try {
      const profiles = await this.loadAllProfiles();
      profiles.set(profile.id, profile);
      
      await this.saveAllProfiles(profiles);
      
    } catch (error) {
      throw new Error(`Failed to save profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Load a specific profile by ID
   */
  async loadProfile(profileId: string): Promise<TinkerProfile | null> {
    try {
      const profiles = await this.loadAllProfiles();
      return profiles.get(profileId) || null;
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
      const data = localStorage.getItem(STORAGE_KEYS.PROFILES);
      
      if (!data || data.trim() === '' || data === '{}' || data === 'null') {
        return new Map();
      }
      
      let parsed: Record<string, TinkerProfile>;
      
      if (this.options.compress) {
        parsed = await this.decompress(data);
      } else {
        parsed = JSON.parse(data);
      }
      
      if (!parsed || Object.keys(parsed).length === 0) {
        return new Map();
      }
      
      const profiles = new Map<string, TinkerProfile>();
      
      for (const [id, profile] of Object.entries(parsed)) {
        // Migrate if needed
        if (this.options.migrationEnabled) {
          const migrated = await this.migrateProfile(profile);
          profiles.set(id, migrated);
        } else {
          profiles.set(id, profile);
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
      const profiles = await this.loadAllProfiles();
      
      if (profiles.has(profileId)) {
        profiles.delete(profileId);
        await this.saveAllProfiles(profiles);
      }
      
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
      const profiles = await this.loadAllProfiles();
      
      return Array.from(profiles.values()).map(profile => ({
        id: profile.id,
        name: profile.Character.Name,
        profession: profile.Character.Profession,
        level: profile.Character.Level,
        breed: profile.Character.Breed,
        faction: profile.Character.Faction,
        created: profile.created,
        updated: profile.updated,
        version: profile.version
      }));
      
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
      return profile;
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
    
    return migrated;
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
   * Save all profiles to storage
   */
  private async saveAllProfiles(profiles: Map<string, TinkerProfile>): Promise<void> {
    try {
      const profilesObject = Object.fromEntries(profiles.entries());
      console.log(`[ProfileStorage] Saving ${profiles.size} profiles to localStorage:`, Array.from(profiles.keys()));
      
      let data: string;
      if (this.options.compress) {
        data = await this.compress(profilesObject);
      } else {
        data = JSON.stringify(profilesObject);
      }
      
      localStorage.setItem(STORAGE_KEYS.PROFILES, data);
      console.log(`[ProfileStorage] Successfully saved ${profiles.size} profiles to localStorage`);
      
    } catch (error) {
      throw new Error(`Failed to save profiles to storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      
      // Clean up legacy backup data that might still exist
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
      Object.values(STORAGE_KEYS).forEach(key => {
        const item = localStorage.getItem(key);
        if (item) {
          used += item.length;
        }
      });
      
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
      const data = localStorage.getItem(STORAGE_KEYS.PROFILES);
      if (!data) return 0;
      
      const profiles = JSON.parse(data);
      return Object.keys(profiles).length;
      
    } catch (error) {
      return 0;
    }
  }
}
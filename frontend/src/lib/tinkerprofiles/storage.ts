/**
 * TinkerProfiles Storage Manager
 * 
 * Handles persistent storage for profiles with compression, encryption,
 * and backup capabilities
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
      backup: true,
      autoSave: true,
      migrationEnabled: true,
      ...options
    };
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
      
      if (this.options.backup) {
        await this.createBackup(profile);
      }
      
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
      
      // Only attempt recovery if data is completely missing or truly empty
      if (!data || data.trim() === '' || data === '{}' || data === 'null') {
        console.log('Main profile storage empty, attempting recovery from backups...');
        const recovered = await this.recoverFromBackups();
        if (recovered.size > 0) {
          console.log(`Successfully recovered ${recovered.size} profiles from backups`);
          return recovered;
        }
        console.log('No profiles to recover, returning empty map');
        return new Map();
      }
      
      let parsed: Record<string, TinkerProfile>;
      
      if (this.options.compress) {
        parsed = await this.decompress(data);
      } else {
        parsed = JSON.parse(data);
      }
      
      // Check if parsed data is actually empty or invalid
      if (!parsed || Object.keys(parsed).length === 0) {
        console.log('Parsed profile data is empty, attempting recovery from backups...');
        const recovered = await this.recoverFromBackups();
        if (recovered.size > 0) {
          console.log(`Successfully recovered ${recovered.size} profiles from backups`);
          return recovered;
        }
        console.log('No profiles to recover, returning empty map');
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
      // Attempt recovery from backups as fallback
      try {
        console.log('Attempting recovery from backups due to parsing error...');
        const recovered = await this.recoverFromBackups();
        if (recovered.size > 0) {
          console.log(`Recovered ${recovered.size} profiles from backups after error`);
          return recovered;
        }
      } catch (recoveryError) {
        console.error('Recovery from backups also failed:', recoveryError);
      }
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
        // Create backup before deletion
        if (this.options.backup) {
          const profile = profiles.get(profileId)!;
          await this.createDeletionBackup(profile);
        }
        
        profiles.delete(profileId);
        await this.saveAllProfiles(profiles);
      }
      
    } catch (error) {
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
  // Backup Operations
  // ============================================================================
  
  /**
   * Create a backup of a profile
   */
  private async createBackup(profile: TinkerProfile): Promise<void> {
    try {
      const backups = this.getBackups();
      const timestamp = new Date().toISOString();
      const backupKey = `${profile.id}_${timestamp}`;
      
      backups[backupKey] = {
        profile,
        timestamp,
        type: 'update'
      };
      
      // Keep only last 10 backups per profile
      this.pruneBackups(profile.id, backups);
      
      localStorage.setItem(STORAGE_KEYS.PROFILE_BACKUPS, JSON.stringify(backups));
      
    } catch (error) {
      console.warn('Failed to create profile backup:', error);
    }
  }
  
  /**
   * Create a backup before deletion
   */
  private async createDeletionBackup(profile: TinkerProfile): Promise<void> {
    try {
      const backups = this.getBackups();
      const timestamp = new Date().toISOString();
      const backupKey = `${profile.id}_deleted_${timestamp}`;
      
      backups[backupKey] = {
        profile,
        timestamp,
        type: 'deletion'
      };
      
      localStorage.setItem(STORAGE_KEYS.PROFILE_BACKUPS, JSON.stringify(backups));
      
    } catch (error) {
      console.warn('Failed to create deletion backup:', error);
    }
  }
  
  /**
   * Get all backups
   */
  private getBackups(): Record<string, any> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROFILE_BACKUPS);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.warn('Failed to load backups:', error);
      return {};
    }
  }
  
  /**
   * Prune old backups for a profile
   */
  private pruneBackups(profileId: string, backups: Record<string, any>): void {
    const profileBackups = Object.entries(backups)
      .filter(([key]) => key.startsWith(profileId))
      .sort(([, a], [, b]) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Keep only the 10 most recent backups
    const toRemove = profileBackups.slice(10);
    toRemove.forEach(([key]) => {
      delete backups[key];
    });
  }
  
  // ============================================================================
  // Recovery Operations
  // ============================================================================
  
  /**
   * Recover profiles from backups when main storage is corrupted
   */
  private async recoverFromBackups(): Promise<Map<string, TinkerProfile>> {
    try {
      const backups = this.getBackups();
      const activeProfileId = this.getActiveProfileId();
      const profiles = new Map<string, TinkerProfile>();
      
      // Group backups by profile ID
      const profileBackups: Record<string, any[]> = {};
      
      for (const [backupKey, backup] of Object.entries(backups)) {
        if (backup?.profile?.id) {
          const profileId = backup.profile.id;
          if (!profileBackups[profileId]) {
            profileBackups[profileId] = [];
          }
          profileBackups[profileId].push({ key: backupKey, ...backup });
        }
      }
      
      // For each profile, get the most recent backup
      for (const [profileId, backupList] of Object.entries(profileBackups)) {
        // Skip deletion backups unless it's the only backup
        const nonDeletionBackups = backupList.filter(b => b.type !== 'deletion');
        const backupsToUse = nonDeletionBackups.length > 0 ? nonDeletionBackups : backupList;
        
        // Sort by timestamp (newest first)
        backupsToUse.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        const mostRecent = backupsToUse[0];
        if (mostRecent?.profile) {
          profiles.set(profileId, mostRecent.profile);
        }
      }
      
      // If we recovered profiles, save them to main storage WITHOUT creating new backups
      if (profiles.size > 0) {
        await this.saveAllProfilesDirectly(profiles);
        console.log(`Recovery complete: restored ${profiles.size} profiles to main storage`);
        
        // Ensure active profile is still valid
        if (activeProfileId && !profiles.has(activeProfileId)) {
          console.log(`Active profile ${activeProfileId} not found in recovery, clearing active profile`);
          localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE);
        }
      }
      
      return profiles;
      
    } catch (error) {
      console.error('Failed to recover profiles from backups:', error);
      return new Map();
    }
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
      
      let data: string;
      if (this.options.compress) {
        data = await this.compress(profilesObject);
      } else {
        data = JSON.stringify(profilesObject);
      }
      
      localStorage.setItem(STORAGE_KEYS.PROFILES, data);
      
    } catch (error) {
      throw new Error(`Failed to save profiles to storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save all profiles directly to storage without creating backups (used during recovery)
   */
  private async saveAllProfilesDirectly(profiles: Map<string, TinkerProfile>): Promise<void> {
    try {
      const profilesObject = Object.fromEntries(profiles.entries());
      
      let data: string;
      if (this.options.compress) {
        data = await this.compress(profilesObject);
      } else {
        data = JSON.stringify(profilesObject);
      }
      
      localStorage.setItem(STORAGE_KEYS.PROFILES, data);
      
    } catch (error) {
      throw new Error(`Failed to save profiles to storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
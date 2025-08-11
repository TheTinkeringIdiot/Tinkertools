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
      if (!data) {
        return new Map();
      }
      
      let parsed: Record<string, TinkerProfile>;
      
      if (this.options.compress) {
        parsed = await this.decompress(data);
      } else {
        parsed = JSON.parse(data);
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
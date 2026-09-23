/**
 * TinkerProfiles Storage Manager
 *
 * Handles persistent storage for profiles with compression and encryption
 * capabilities
 */

import type { TinkerProfile, ProfileStorageOptions, ProfileMetadata } from './types';
import { STORAGE_KEYS, CURRENT_VERSION } from './constants';
import { toRaw } from 'vue';
import { getProfessionName, getBreedName } from '../../services/game-utils';
import { currentGameVersion, stampGameVersion } from './game-version';
import { legacyDataVersion } from '@/composables/useGameVersion';

export class ProfileStorage {
  private options: ProfileStorageOptions;

  constructor(options: ProfileStorageOptions = {}) {
    this.options = {
      compress: false,
      encrypt: false,
      autoSave: true,
      migrationEnabled: true,
      ...options,
    };

    // Clean up legacy backup data on initialization
    this.cleanupLegacyBackups();
  }

  // ============================================================================
  // Core Storage Operations
  // ============================================================================

  /**
   * Prepare profile for v4.0.0 serialization
   * v4.0.0 stores computed totals and uses flat skill ID structure
   */
  private prepareProfileForSerialization(profile: TinkerProfile): TinkerProfile {
    // Validate version before serialization
    if (profile.version !== '4.0.0') {
      throw new Error(
        `Cannot serialize profile version ${profile.version}. Only v4.0.0 supported.`
      );
    }

    // Convert Vue proxy to raw object first, then create a deep clone
    const rawProfile = toRaw(profile);
    const prepared = structuredClone(rawProfile);

    // Trust that profile is correct v4.0.0 format
    // No defensive property deletion needed
    return prepared;
  }

  /**
   * Save a profile to localStorage
   */
  async saveProfile(profile: TinkerProfile): Promise<void> {
    try {
      // Validate profile version
      if (profile.version !== '4.0.0') {
        throw new Error(
          `Invalid profile version: ${profile.version}. Only v4.0.0 profiles are supported.`
        );
      }

      // Never persist an untagged profile: everything saved from here on knows
      // which game database it was built against. New profiles are tagged when
      // created, so an untagged one here predates multi-version support.
      stampGameVersion(profile, legacyDataVersion());

      // Prepare profile for v4.0.0 serialization (stores computed totals)
      const profileToSave = this.prepareProfileForSerialization(profile);

      // Save the individual profile
      const profileKey = `${STORAGE_KEYS.PROFILE_PREFIX}${profile.id}`;
      const data = this.options.compress
        ? await this.compress(profileToSave)
        : JSON.stringify(profileToSave);
      localStorage.setItem(profileKey, data);

      // Update the index
      await this.updateProfileIndex(profile.id, 'add');

      console.log(
        `[ProfileStorage] Saved profile ${profile.id} to individual key (v4.0.0 format with computed totals)`
      );
    } catch (error) {
      throw new Error(
        `Failed to save profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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

      // Strict v4.0.0 validation
      if (!profile.version || profile.version !== '4.0.0') {
        throw new Error(
          `Profile version ${profile.version || 'unknown'} not supported. Only v4.0.0 profiles can be loaded.`
        );
      }

      // Auto-migrate legacy string-based Character IDs
      const { ProfileTransformer } = await import('./transformer');
      const transformer = new ProfileTransformer();
      const migrated = transformer.migrateProfileCharacterIds(profile);

      // Validate after migration
      const { validateCharacterIds } = await import('./validation');
      const validation = validateCharacterIds(migrated);
      if (!validation.valid) {
        console.error(
          `[ProfileStorage] Loaded profile ${profileId} has invalid IDs:`,
          validation.errors
        );
        // Still return the profile, but log errors for debugging
      }

      if (validation.warnings.length > 0) {
        console.warn(
          `[ProfileStorage] Profile ${profileId} validation warnings:`,
          validation.warnings
        );
      }

      // Save back if migration occurred
      if (migrated.updated !== profile.updated) {
        await this.saveProfile(migrated);
        console.log(`[ProfileStorage] Auto-migrated profile ${profileId} Character IDs`);
      }

      // Tag profiles written before multi-version support with the version whose
      // database they were built against (the hostname's default, not whatever
      // version this visit happens to open on), and persist it so this happens once.
      if (!migrated.gameVersion) {
        const slug = legacyDataVersion();
        stampGameVersion(migrated, slug);
        await this.saveProfile(migrated);
        console.log(
          `[ProfileStorage] Tagged profile ${profileId} with game version '${slug}' (pre-version-support profile)`
        );
      }

      return migrated;
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
      throw new Error(
        `Failed to delete profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
            profession: getProfessionName(profile.Character.Profession), // Convert ID to name
            level: profile.Character.Level,
            breed: getBreedName(profile.Character.Breed), // Convert ID to name
            faction: profile.Character.Faction,
            created: profile.created,
            updated: profile.updated,
            version: profile.version,
            gameVersion: profile.gameVersion,
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
  // Active Profile Management (per game version)
  // ============================================================================

  /**
   * localStorage key holding the active profile for one game version.
   *
   * The active profile is per version so that equip checks, TinkerFite and
   * TinkerNukes never read a profile built against a different database.
   */
  private activeProfileKey(versionSlug: string): string {
    return `${STORAGE_KEYS.ACTIVE_PROFILE_PREFIX}${versionSlug}`;
  }

  /**
   * Move the old global active-profile key under the legacy data version, once.
   *
   * Before multi-version support there was a single `tinkertools_active_profile`.
   * The profile it points at is stamped with legacyDataVersion() on load, so the
   * pointer belongs under that same version, whichever version is being browsed.
   */
  private migrateLegacyActiveProfile(): void {
    try {
      const versionSlug = legacyDataVersion();
      const legacy = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROFILE);
      if (!legacy) return;

      const key = this.activeProfileKey(versionSlug);
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, legacy);
        console.log(
          `[ProfileStorage] Migrated active profile '${legacy}' to game version '${versionSlug}'`
        );
      }
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE);
    } catch (error) {
      console.warn('[ProfileStorage] Failed to migrate legacy active profile:', error);
    }
  }

  /**
   * Set the active profile ID for a game version (defaults to the current one)
   */
  async setActiveProfile(profileId: string | null, versionSlug?: string): Promise<void> {
    try {
      const slug = versionSlug ?? currentGameVersion();
      this.migrateLegacyActiveProfile();

      const key = this.activeProfileKey(slug);
      if (profileId) {
        localStorage.setItem(key, profileId);
      } else {
        localStorage.removeItem(key);
      }
    } catch (error) {
      throw new Error(
        `Failed to set active profile: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get the active profile ID for a game version (defaults to the current one)
   */
  getActiveProfileId(versionSlug?: string): string | null {
    try {
      const slug = versionSlug ?? currentGameVersion();
      this.migrateLegacyActiveProfile();
      return localStorage.getItem(this.activeProfileKey(slug));
    } catch (error) {
      console.error('Failed to get active profile ID:', error);
      return null;
    }
  }

  /**
   * Load the active profile for a game version (defaults to the current one).
   *
   * A pointer to a profile that has since been deleted, or that belongs to a
   * different version, is cleared rather than returned.
   */
  async loadActiveProfile(versionSlug?: string): Promise<TinkerProfile | null> {
    const slug = versionSlug ?? currentGameVersion();
    const activeId = this.getActiveProfileId(versionSlug);
    if (!activeId) return null;

    const profile = await this.loadProfile(activeId);
    if (!profile) {
      await this.setActiveProfile(null, slug);
      return null;
    }

    if (profile.gameVersion && profile.gameVersion !== slug) {
      console.warn(
        `[ProfileStorage] Active profile ${activeId} belongs to '${profile.gameVersion}', not '${slug}'; clearing`
      );
      await this.setActiveProfile(null, slug);
      return null;
    }

    return profile;
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
      throw new Error(
        `Failed to update profile index: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Save all profiles to storage (DEPRECATED - kept for backward compatibility)
   */
  private async saveAllProfiles(profiles: Map<string, TinkerProfile>): Promise<void> {
    // This method is no longer used but kept to avoid breaking changes
    // Individual profiles are now saved separately
    console.warn(
      '[ProfileStorage] saveAllProfiles is deprecated - profiles are now saved individually'
    );

    // Save each profile individually
    for (const [id, profile] of Array.from(profiles.entries())) {
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

      // Remove other storage keys, including every per-version active pointer
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_PROFILE);
      for (const key of this.listActiveProfileKeys()) {
        localStorage.removeItem(key);
      }
      localStorage.removeItem(STORAGE_KEYS.PROFILE_METADATA);
      localStorage.removeItem(STORAGE_KEYS.PROFILE_PREFERENCES);
      localStorage.removeItem(STORAGE_KEYS.VERSION);

      // Clean up legacy data
      localStorage.removeItem(STORAGE_KEYS.PROFILES);
      localStorage.removeItem('tinkertools_profile_backups');
    } catch (error) {
      throw new Error(
        `Failed to clear profile data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
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
        STORAGE_KEYS.VERSION,
        ...this.listActiveProfileKeys(),
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
        profiles: profiles,
      };
    } catch (error) {
      return { used: 0, total: 0, profiles: 0 };
    }
  }

  /**
   * Every `tinkertools_active_profile:<slug>` key currently in localStorage.
   */
  private listActiveProfileKeys(): string[] {
    const keys: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEYS.ACTIVE_PROFILE_PREFIX)) {
          keys.push(key);
        }
      }
    } catch (error) {
      console.warn('[ProfileStorage] Failed to enumerate active profile keys:', error);
    }
    return keys;
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

/**
 * TinkerProfiles Manager - Core Profile Management Class
 *
 * Main interface for all profile operations, combining storage, validation,
 * transformation, and event handling capabilities
 */

import type {
  TinkerProfile,
  ProfileMetadata,
  ProfileExportFormat,
  ProfileImportResult,
  ProfileImportOptions,
  ProfileValidationResult,
  ProfileEvents,
  TinkerProfilesConfig,
  ProfileSearchFilters,
  ProfileSortOptions,
  IPTracker,
} from './types';

import { ProfileStorage } from './storage';
import { ProfileValidator } from './validator';
import { ProfileTransformer } from './transformer';
import { createDefaultProfile } from './constants';
import { currentGameVersion, stampGameVersion } from './game-version';
import { buildVersionCopy, type ProfileVersionCopyResult } from './version-copy';
import { ipIntegrator } from './ip-integrator';
import { perkManager } from './perk-manager';
import type {
  PerkInfo,
  PerkValidationResult,
  PerkChangeEvent,
  PerkEffectSummary,
  PerkPointCalculation,
} from './perk-types';

// Simple event emitter for profile events
class ProfileEventEmitter {
  private listeners: { [K in keyof ProfileEvents]?: Array<(data: ProfileEvents[K]) => void> } = {};

  on<K extends keyof ProfileEvents>(event: K, listener: (data: ProfileEvents[K]) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
  }

  off<K extends keyof ProfileEvents>(event: K, listener: (data: ProfileEvents[K]) => void): void {
    const eventListeners = this.listeners[event];
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  emit<K extends keyof ProfileEvents>(event: K, data: ProfileEvents[K]): void {
    const eventListeners = this.listeners[event];
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in profile event listener for ${event}:`, error);
        }
      });
    }
  }
}

export class TinkerProfilesManager {
  private storage: ProfileStorage;
  private validator: ProfileValidator;
  private transformer: ProfileTransformer;
  private events: ProfileEventEmitter;
  private config: TinkerProfilesConfig;

  // Cache for performance
  private profilesCache: Map<string, TinkerProfile> = new Map();
  private metadataCache: ProfileMetadata[] | null = null;
  private cacheInvalidated: boolean = true;

  constructor(config: Partial<TinkerProfilesConfig> = {}) {
    this.config = {
      storage: {
        compress: false,
        encrypt: false,
        autoSave: true,
        migrationEnabled: true,
        ...config.storage,
      },
      validation: {
        strictMode: false,
        autoCorrect: true,
        allowLegacyFormats: true,
        ...config.validation,
      },
      events: {
        enabled: true,
        throttle: 100,
        ...config.events,
      },
      features: {
        autoBackup: false,
        compression: false,
        migration: true,
        analytics: false,
        ...config.features,
      },
    };

    this.storage = new ProfileStorage(this.config.storage);
    this.validator = new ProfileValidator();
    this.transformer = new ProfileTransformer();
    this.events = new ProfileEventEmitter();
  }

  // ============================================================================
  // Profile CRUD Operations
  // ============================================================================

  /**
   * Create a new profile
   */
  async createProfile(name: string, initialData?: Partial<TinkerProfile>): Promise<string> {
    try {
      // Extract breed from initialData to create profile with correct breed-specific values
      const breed = initialData?.Character?.Breed || 'Solitus';
      const profile = createDefaultProfile(name, breed);

      if (initialData) {
        Object.assign(profile, initialData);
        profile.updated = new Date().toISOString();
      }

      // New profiles belong to the version being browsed, unless the caller
      // (an import, a cross-version copy) already decided otherwise.
      stampGameVersion(profile);

      // Calculate caps and trickle-down for the new profile
      const { updateProfileWithIPTracking } = await import('./ip-integrator');
      const profileWithCaps = updateProfileWithIPTracking(profile);
      Object.assign(profile, profileWithCaps);

      // Validate the profile including ID range checks
      const { validateProfile } = await import('./validation');
      const validation = validateProfile(profile);
      if (!validation.valid) {
        console.error('[ProfileManager] Profile validation failed:', validation.errors);
        throw new Error(`Profile validation failed: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        console.warn('[ProfileManager] Profile validation warnings:', validation.warnings);
      }

      // Legacy validator check if in strict mode
      if (this.config.validation.strictMode) {
        const legacyValidation = this.validator.validateProfile(profile);
        if (!legacyValidation.valid) {
          throw new Error(`Profile validation failed: ${legacyValidation.errors.join(', ')}`);
        }
      }

      await this.storage.saveProfile(profile);
      this.invalidateCache();

      if (this.config.events.enabled) {
        this.events.emit('profile:created', { profile });
      }

      return profile.id;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to create profile';
      if (this.config.events.enabled) {
        this.events.emit('storage:error', {
          error: new Error(errorMsg),
          operation: 'create',
        });
      }
      throw new Error(errorMsg);
    }
  }

  /**
   * Load a profile by ID
   */
  async loadProfile(profileId: string): Promise<TinkerProfile | null> {
    try {
      // Check cache first
      if (this.profilesCache.has(profileId) && !this.cacheInvalidated) {
        return this.profilesCache.get(profileId)!;
      }

      let profile = await this.storage.loadProfile(profileId);

      if (profile) {
        // Ensure IP tracking is initialized
        if (!profile.IPTracker) {
          profile = ipIntegrator.recalculateProfileIP(profile);
          await this.storage.saveProfile(profile); // Save the updated profile
        }

        // Validate and potentially auto-correct
        const validation = this.validator.validateProfile(profile);

        if (!validation.valid && this.config.validation.strictMode) {
          throw new Error(`Profile validation failed: ${validation.errors.join(', ')}`);
        }

        if (this.config.validation.autoCorrect && validation.warnings.length > 0) {
          // Apply auto-corrections here if needed
          profile.updated = new Date().toISOString();
          await this.storage.saveProfile(profile);
        }

        // Update cache
        this.profilesCache.set(profileId, profile);
        return profile;
      }

      return null;
    } catch (error) {
      if (this.config.events.enabled) {
        this.events.emit('storage:error', {
          error: error instanceof Error ? error : new Error('Failed to load profile'),
          operation: 'load',
        });
      }
      return null;
    }
  }

  /**
   * Update a profile
   */
  async updateProfile(profileId: string, updates: Partial<TinkerProfile>): Promise<void> {
    try {
      const existing = await this.loadProfile(profileId);
      if (!existing) {
        throw new Error('Profile not found');
      }

      // Apply non-equipment updates as-is
      const { Weapons, Clothing, Implants, ...otherUpdates } = updates;
      let updated: TinkerProfile = { ...existing, ...otherUpdates };

      // Deep merge equipment updates to preserve other slots
      if (Weapons) {
        updated.Weapons = { ...existing.Weapons, ...Weapons };
      }
      if (Clothing) {
        updated.Clothing = { ...existing.Clothing, ...Clothing };
      }
      if (Implants) {
        updated.Implants = { ...existing.Implants, ...Implants };
      }

      updated.updated = new Date().toISOString();

      // Check if equipment, perks, or buffs changed - if so, recalculate stats
      const needsRecalc =
        updates.Weapons ||
        updates.Clothing ||
        updates.Implants ||
        updates.PerksAndResearch ||
        updates.buffs;

      if (needsRecalc) {
        // Recalculate all stats including equipment bonuses, perk bonuses, etc
        updated = ipIntegrator.recalculateProfileIP(updated);
      }

      // Validate the updated profile
      if (this.config.validation.strictMode) {
        const validation = this.validator.validateProfile(updated);
        if (!validation.valid) {
          throw new Error(`Profile validation failed: ${validation.errors.join(', ')}`);
        }
      }

      await this.storage.saveProfile(updated);
      this.profilesCache.set(profileId, updated);
      this.invalidateMetadataCache();

      if (this.config.events.enabled) {
        this.events.emit('profile:updated', { profile: updated, changes: updates });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to update profile';
      if (this.config.events.enabled) {
        this.events.emit('storage:error', {
          error: new Error(errorMsg),
          operation: 'update',
        });
      }
      throw new Error(errorMsg);
    }
  }

  /**
   * Delete a profile
   */
  async deleteProfile(profileId: string): Promise<void> {
    try {
      await this.storage.deleteProfile(profileId);
      this.profilesCache.delete(profileId);
      this.invalidateCache();

      if (this.config.events.enabled) {
        this.events.emit('profile:deleted', { profileId });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to delete profile';
      if (this.config.events.enabled) {
        this.events.emit('storage:error', {
          error: new Error(errorMsg),
          operation: 'delete',
        });
      }
      throw new Error(errorMsg);
    }
  }

  /**
   * Get all profile metadata (lightweight)
   */
  async getProfileMetadata(refresh: boolean = false): Promise<ProfileMetadata[]> {
    try {
      if (!refresh && this.metadataCache && !this.cacheInvalidated) {
        return this.metadataCache;
      }

      const metadata = await this.storage.getProfileMetadata();
      this.metadataCache = metadata;

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
   * Set the active profile
   */
  async setActiveProfile(profileId: string | null, versionSlug?: string): Promise<void> {
    try {
      if (profileId) {
        const profile = await this.loadProfile(profileId);
        if (!profile) {
          throw new Error('Profile not found');
        }

        // Activate under the profile's own version, so a profile is never
        // active in a version whose database it was not built against.
        await this.storage.setActiveProfile(
          profileId,
          versionSlug ?? profile.gameVersion ?? currentGameVersion()
        );

        if (this.config.events.enabled) {
          this.events.emit('profile:activated', { profile });
        }
      } else {
        await this.storage.setActiveProfile(null, versionSlug);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to set active profile';
      if (this.config.events.enabled) {
        this.events.emit('storage:error', {
          error: new Error(errorMsg),
          operation: 'setActive',
        });
      }
      throw new Error(errorMsg);
    }
  }

  /**
   * Get the active profile
   */
  async getActiveProfile(versionSlug?: string): Promise<TinkerProfile | null> {
    return await this.storage.loadActiveProfile(versionSlug);
  }

  /**
   * Get the active profile ID for a game version (defaults to the current one)
   */
  getActiveProfileId(versionSlug?: string): string | null {
    return this.storage.getActiveProfileId(versionSlug);
  }

  // ============================================================================
  // Cross-Version Copy
  // ============================================================================

  /**
   * Copy a profile into another game version.
   *
   * The original is untouched. The copy gets a new id, is tagged with the target
   * version, and has every embedded item re-resolved by AOID and QL against that
   * version's database. Items the version lacks stay as flagged placeholders and
   * are listed in the result.
   */
  async copyProfileToVersion(
    profileId: string,
    targetVersion: string
  ): Promise<ProfileVersionCopyResult> {
    const source = await this.loadProfile(profileId);
    if (!source) {
      throw new Error('Profile not found');
    }

    const copyResult = await buildVersionCopy(source, targetVersion, this.transformer);

    // Recompute IP, caps and bonuses against the newly resolved equipment.
    const recalculated = ipIntegrator.recalculateProfileIP(copyResult.profile);
    Object.assign(copyResult.profile, recalculated);
    copyResult.profile.gameVersion = targetVersion;

    await this.storage.saveProfile(copyResult.profile);
    this.invalidateCache();

    if (this.config.events.enabled) {
      this.events.emit('profile:created', { profile: copyResult.profile });
    }

    return copyResult;
  }

  // ============================================================================
  // Profile Search and Filtering
  // ============================================================================

  /**
   * Search profiles with filters
   */
  async searchProfiles(
    filters: ProfileSearchFilters = {},
    sort?: ProfileSortOptions
  ): Promise<ProfileMetadata[]> {
    const allMetadata = await this.getProfileMetadata();

    const filtered = allMetadata.filter((profile) => {
      // Name filter
      if (filters.name && !profile.name.toLowerCase().includes(filters.name.toLowerCase())) {
        return false;
      }

      // Profession filter
      if (
        filters.profession &&
        filters.profession.length > 0 &&
        !filters.profession.includes(profile.profession)
      ) {
        return false;
      }

      // Level filter
      if (filters.level && (profile.level < filters.level[0] || profile.level > filters.level[1])) {
        return false;
      }

      // Breed filter
      if (filters.breed && filters.breed.length > 0 && !filters.breed.includes(profile.breed)) {
        return false;
      }

      // Faction filter
      if (
        filters.faction &&
        filters.faction.length > 0 &&
        !filters.faction.includes(profile.faction)
      ) {
        return false;
      }

      // Date filters
      if (filters.created) {
        const created = new Date(profile.created);
        const start = new Date(filters.created[0]);
        const end = new Date(filters.created[1]);
        if (created < start || created > end) {
          return false;
        }
      }

      return true;
    });

    // Apply sorting
    if (sort) {
      filtered.sort((a, b) => {
        let aVal: string | number, bVal: string | number;

        switch (sort.field) {
          case 'name':
            aVal = a.name.toLowerCase();
            bVal = b.name.toLowerCase();
            break;
          case 'profession':
            aVal = a.profession;
            bVal = b.profession;
            break;
          case 'level':
            aVal = a.level;
            bVal = b.level;
            break;
          case 'created':
            aVal = new Date(a.created).getTime();
            bVal = new Date(b.created).getTime();
            break;
          case 'updated':
            aVal = new Date(a.updated).getTime();
            bVal = new Date(b.updated).getTime();
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }

  // ============================================================================
  // Import/Export Operations
  // ============================================================================

  /**
   * Export a profile
   */
  async exportProfile(profileId: string, format: ProfileExportFormat = 'json'): Promise<string> {
    const profile = await this.loadProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const exported = this.transformer.exportProfile(profile, format);

    if (this.config.events.enabled) {
      this.events.emit('profile:exported', { profile, format });
    }

    return exported;
  }

  /**
   * Parse and validate import data without saving
   */
  async previewImport(data: string, sourceFormat?: string): Promise<ProfileImportResult> {
    const result = await this.transformer.importProfile(data, sourceFormat);

    if (result.success && result.profile) {
      const validation = this.validator.validateProfile(result.profile);

      if (!validation.valid && this.config.validation.strictMode) {
        result.success = false;
        result.errors.push(...validation.errors);
        return result;
      }

      result.warnings.push(...validation.warnings);
    }

    return result;
  }

  /**
   * Import a profile
   */
  async importProfile(
    data: string,
    sourceFormat?: string,
    options: ProfileImportOptions = {}
  ): Promise<ProfileImportResult> {
    const result = await this.transformer.importProfile(data, sourceFormat);

    if (result.success && result.profile) {
      try {
        // Validate imported profile
        const validation = this.validator.validateProfile(result.profile);

        if (!validation.valid && this.config.validation.strictMode) {
          result.success = false;
          result.errors.push(...validation.errors);
          return result;
        }

        result.warnings.push(...validation.warnings);

        if (options.updateExistingId) {
          const existing = await this.loadProfile(options.updateExistingId);
          if (!existing) {
            result.success = false;
            result.errors.push(`Profile to update not found: ${options.updateExistingId}`);
            return result;
          }
          result.profile.id = existing.id;
          result.profile.created = existing.created;
          result.profile.updated = new Date().toISOString();
        }

        // Save the imported profile
        await this.storage.saveProfile(result.profile);
        this.invalidateCache();

        if (this.config.events.enabled) {
          this.events.emit('profile:imported', { profile: result.profile, result });
        }
      } catch (error) {
        result.success = false;
        result.errors.push(
          error instanceof Error ? error.message : 'Failed to save imported profile'
        );
      }
    }

    return result;
  }

  // ============================================================================
  // Validation Operations
  // ============================================================================

  /**
   * Validate a profile
   */
  async validateProfile(profileId: string): Promise<ProfileValidationResult> {
    const profile = await this.loadProfile(profileId);
    if (!profile) {
      return {
        valid: false,
        errors: ['Profile not found'],
        warnings: [],
        suggestions: [],
      };
    }

    // The v4 validator, as createProfile uses: the legacy ProfileValidator
    // expects the pre-v4 shape (Skills categories, profession names) and
    // rejects every current profile.
    const { validateProfile } = await import('./validation');
    const result: ProfileValidationResult = { ...validateProfile(profile), suggestions: [] };

    if (!result.valid && this.config.events.enabled) {
      this.events.emit('validation:failed', { profileId, errors: result.errors });
    }

    return result;
  }

  // ============================================================================
  // Event System
  // ============================================================================

  /**
   * Subscribe to profile events
   */
  on<K extends keyof ProfileEvents>(event: K, listener: (data: ProfileEvents[K]) => void): void {
    if (this.config.events.enabled) {
      this.events.on(event, listener);
    }
  }

  /**
   * Unsubscribe from profile events
   */
  off<K extends keyof ProfileEvents>(event: K, listener: (data: ProfileEvents[K]) => void): void {
    this.events.off(event, listener);
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.profilesCache.clear();
    this.metadataCache = null;
    this.cacheInvalidated = true;
  }

  private invalidateCache(): void {
    this.cacheInvalidated = true;
    this.metadataCache = null;
  }

  private invalidateMetadataCache(): void {
    this.metadataCache = null;
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get storage statistics
   */
  getStorageStats(): { used: number; total: number; profiles: number } {
    return this.storage.getStorageStats();
  }

  /**
   * Clear all profile data (dangerous!)
   */
  async clearAllData(): Promise<void> {
    if (confirm('This will permanently delete all profile data. Are you sure?')) {
      await this.storage.clearAllData();
      this.clearCache();
    }
  }

  /**
   * Get configuration
   */
  getConfig(): TinkerProfilesConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<TinkerProfilesConfig>): void {
    this.config = { ...this.config, ...updates };

    // Reinitialize components with new config if needed
    if (updates.storage) {
      this.storage = new ProfileStorage(this.config.storage);
    }
  }

  // ============================================================================
  // IP Management Methods
  // ============================================================================

  /**
   * Get IP analysis for a profile
   */
  async getProfileIPAnalysis(profileId: string): Promise<IPTracker | null> {
    const profile = await this.loadProfile(profileId);
    if (!profile) return null;

    return profile.IPTracker || ipIntegrator.calculateProfileIP(profile);
  }

  /**
   * Recalculate IP information for a profile
   */
  async recalculateProfileIP(profileId: string): Promise<void> {
    const profile = await this.loadProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const updatedProfile = ipIntegrator.recalculateProfileIP(profile);
    await this.updateProfile(profileId, updatedProfile);
  }

  /**
   * Validate profile IP constraints
   */
  async validateProfileIP(profileId: string): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const profile = await this.loadProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const validation = ipIntegrator.validateProfileIP(profile);
    return {
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    };
  }

  /**
   * Safely modify a skill value with IP validation
   */
  async modifySkill(
    profileId: string,
    skillId: number,
    newValue: number
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const profile = await this.loadProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const result = ipIntegrator.modifySkill(profile, skillId, newValue);

    if (result.success && result.updatedProfile) {
      await this.updateProfile(profileId, result.updatedProfile);
    }

    return {
      success: result.success,
      error: result.error,
    };
  }

  /**
   * Safely modify an ability value with IP validation
   */
  async modifyAbility(
    profileId: string,
    abilityId: number,
    newValue: number
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const profile = await this.loadProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const result = ipIntegrator.modifyAbility(profile, abilityId, newValue);

    if (result.success && result.updatedProfile) {
      await this.updateProfile(profileId, result.updatedProfile);
    }

    return {
      success: result.success,
      error: result.error,
    };
  }

  /**
   * Get available IP for spending
   */
  async getAvailableIP(profileId: string): Promise<number> {
    const profile = await this.loadProfile(profileId);
    if (!profile) return 0;

    const ipInfo = profile.IPTracker || ipIntegrator.calculateProfileIP(profile);
    return ipInfo.remaining;
  }

  /**
   * Get IP efficiency percentage
   */
  async getIPEfficiency(profileId: string): Promise<number> {
    const profile = await this.loadProfile(profileId);
    if (!profile) return 0;

    const ipInfo = profile.IPTracker || ipIntegrator.calculateProfileIP(profile);
    return ipInfo.efficiency;
  }

  // ============================================================================
  // Perk Management Methods
  // ============================================================================

  /**
   * Add or upgrade a perk for a profile
   */
  async addPerk(
    profileId: string,
    perkInfo: PerkInfo,
    targetLevel: number = 1
  ): Promise<{
    success: boolean;
    error?: string;
    changeEvent?: PerkChangeEvent;
  }> {
    const profile = await this.loadProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const result = perkManager.addPerk(profile, perkInfo, targetLevel);

    if (result.success && result.updatedProfile) {
      await this.updateProfile(profileId, result.updatedProfile);

      // Emit perk change event
      if (this.config.events.enabled && result.changeEvent) {
        this.events.emit('profile:updated', {
          profile: result.updatedProfile,
          changes: { PerksAndResearch: result.updatedProfile.PerksAndResearch },
        });
      }
    }

    return {
      success: result.success,
      error: result.error,
      changeEvent: result.changeEvent,
    };
  }

  /**
   * Remove or downgrade a perk from a profile
   */
  async removePerk(
    profileId: string,
    perkName: string,
    targetLevel: number = 0
  ): Promise<{
    success: boolean;
    error?: string;
    changeEvent?: PerkChangeEvent;
  }> {
    const profile = await this.loadProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const result = perkManager.removePerk(profile, perkName, targetLevel);

    if (result.success && result.updatedProfile) {
      await this.updateProfile(profileId, result.updatedProfile);

      // Emit perk change event
      if (this.config.events.enabled && result.changeEvent) {
        this.events.emit('profile:updated', {
          profile: result.updatedProfile,
          changes: { PerksAndResearch: result.updatedProfile.PerksAndResearch },
        });
      }
    }

    return {
      success: result.success,
      error: result.error,
      changeEvent: result.changeEvent,
    };
  }

  /**
   * Validate if a perk can be purchased/upgraded
   */
  async validatePerkPurchase(
    profileId: string,
    perkInfo: PerkInfo,
    targetLevel: number
  ): Promise<PerkValidationResult> {
    const profile = await this.loadProfile(profileId);
    if (!profile) {
      return {
        valid: false,
        errors: ['Profile not found'],
        warnings: [],
      };
    }

    // Import the validation function to avoid circular dependency
    const { validatePerkRequirements } = await import('./perk-manager');
    return validatePerkRequirements(profile, perkInfo, targetLevel);
  }

  /**
   * Get available perk points for a profile
   */
  async getPerkPointsInfo(profileId: string): Promise<PerkPointCalculation | null> {
    const profile = await this.loadProfile(profileId);
    if (!profile) return null;

    return perkManager.calculateAvailablePoints(profile);
  }

  /**
   * Get aggregated perk effects for a profile
   */
  async getPerkEffects(profileId: string): Promise<PerkEffectSummary> {
    const profile = await this.loadProfile(profileId);
    if (!profile) return {};

    return perkManager.getPerkEffects(profile);
  }

  /**
   * Recalculate perk points when character level or AI level changes
   */
  async recalculatePerkPoints(profileId: string): Promise<void> {
    const profile = await this.loadProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const updatedProfile = perkManager.recalculatePerkPoints(profile);
    await this.updateProfile(profileId, updatedProfile);
  }

  /**
   * Initialize perk system for a profile that doesn't have one
   */
  async initializePerkSystem(profileId: string): Promise<void> {
    const profile = await this.loadProfile(profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    if (!profile.PerksAndResearch) {
      // Force initialization by adding a dummy perk and removing it
      const dummyPerk: PerkInfo = {
        aoid: 0,
        name: 'dummy',
        level: 1,
        type: 'SL',
        cost: 1,
        requirements: {},
        effects: [],
      };

      const result = perkManager.addPerk(profile, dummyPerk, 1);
      if (result.success && result.updatedProfile) {
        const removeResult = perkManager.removePerk(result.updatedProfile, 'dummy', 0);
        if (removeResult.success && removeResult.updatedProfile) {
          await this.updateProfile(profileId, removeResult.updatedProfile);
        }
      }
    }
  }
}

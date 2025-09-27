/**
 * TinkerProfiles Library Types
 *
 * Unified type definitions for profile management across all TinkerTools applications
 *
 * Version 4.0.0 - ID-based skill architecture
 */

import type { Item } from '@/types/api';
import type { PerkSystem } from './perk-types';

// ============================================================================
// Core Profile Types
// ============================================================================

/**
 * Unified skill data structure for all skill types in v4.0.0
 *
 * Supports regular skills (with IP), Misc skills (bonus-only), and ACs (calculated)
 * through unified interface with conditional zero values.
 *
 * @example
 * // Regular skill (e.g., 1h Blunt - ID 102)
 * { base: 5, trickle: 100, ipSpent: 5000, pointsFromIp: 250, equipmentBonus: 50, perkBonus: 25, buffBonus: 10, total: 440 }
 *
 * // Misc skill (e.g., MaxHealth - ID 27)
 * { base: 0, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 100, perkBonus: 50, buffBonus: 0, total: 150 }
 *
 * // AC skill (e.g., Chemical AC - ID 92)
 * { base: 0, trickle: 0, ipSpent: 0, pointsFromIp: 0, equipmentBonus: 75, perkBonus: 20, buffBonus: 5, total: 100 }
 */
export interface SkillData {
  /** Breed-specific base value (5 for regular skills, 0 for Misc/ACs) */
  base: number;

  /** Trickle-down bonus from attributes (separate from base for clarity) */
  trickle: number;

  /** IP invested in this skill (0 for Misc/ACs that don't use IP) */
  ipSpent: number;

  /** Skill points gained from IP investment (0 for Misc/ACs) */
  pointsFromIp: number;

  /** Pure equipment bonus (no base value included) */
  equipmentBonus: number;

  /** Pure perk bonus (no base value included) */
  perkBonus: number;

  /** Pure buff bonus (no base value included) */
  buffBonus: number;

  /**
   * Total skill value: base + trickle + pointsFromIp + equipmentBonus + perkBonus + buffBonus
   * Stored to prevent recalculation overhead and ensure consistency
   */
  total: number;
}

/** Comprehensive IP tracking information */
export interface IPTracker {
  totalAvailable: number;
  totalUsed: number;
  remaining: number;
  abilityIP: number;
  skillIP: number;
  efficiency: number; // Percentage of IP used
  lastCalculated: string; // Timestamp of last calculation
  breakdown: {
    abilities: Record<string, number>; // IP spent per ability
    skillCategories: Record<string, number>; // IP spent per skill category
  };
}

/** Implant cluster information from AOSetups */
export interface ImplantCluster {
  stat: number;        // STAT ID from game-data
  skillName: string;   // Human-readable skill name
  value?: number;      // Cluster value/bonus (if applicable)
}

/** Enhanced implant item with cluster information */
export interface ImplantWithClusters extends Item {
  slot: number;        // Numeric slot position from IMPLANT_SLOT_POSITION
  type: 'implant' | 'symbiant';
  clusters?: {
    Shiny?: ImplantCluster;
    Bright?: ImplantCluster;
    Faded?: ImplantCluster;
  };
}

/**
 * TinkerProfile v4.0.0 - ID-based skill architecture
 *
 * Skills stored as flat map: profile.skills[skillId]
 * Use SkillService for name resolution and metadata
 */
export interface TinkerProfile {
  // Profile metadata
  id: string;
  version: '4.0.0';  // Fixed version for v4.0.0 profiles
  created: string;
  updated: string;

  // Character basic info (unchanged)
  Character: {
    Name: string;
    Level: number;
    Profession: string;
    Breed: string;
    Faction: string;
    Expansion: string;
    AccountType: string;
    MaxHealth: number;
    MaxNano: number;
    AlienLevel?: number; // 0-30, for AI perk points calculation
  };

  // IP tracking (unchanged)
  IPTracker?: IPTracker;

  /**
   * Flat skill storage using numeric skill IDs as keys
   *
   * Replaces nested Skills[category][name] structure with direct ID access.
   * All skill types (regular, Misc, ACs) use unified SkillData interface.
   *
   * @example
   * skills: {
   *   102: { base: 5, trickle: 100, ipSpent: 5000, pointsFromIp: 250, ... }, // 1h Blunt
   *   27: { base: 0, trickle: 0, ipSpent: 0, pointsFromIp: 0, ... },          // MaxHealth (Misc)
   *   92: { base: 0, trickle: 0, ipSpent: 0, pointsFromIp: 0, ... }           // Chemical AC
   * }
   */
  skills: {
    [skillId: number]: SkillData;
  };

  // Equipment slots (unchanged)
  Weapons: Record<string, Item | null>;
  Clothing: Record<string, Item | null>;
  Implants: Record<string, ImplantWithClusters | null>;

  // Perk system (unchanged)
  PerksAndResearch: PerkSystem;

  // Nano buff system (unchanged)
  buffs?: Item[];
}

/** Simplified nano-compatible profile for TinkerNanos */
export interface NanoCompatibleProfile {
  id: string;
  name: string;
  profession: string;
  level: number;
  skills: Record<string, number>;
  stats: Record<string, number>;
  activeNanos?: number[];
  memoryCapacity?: number;
  nanoPoints?: number;
}

/** Profile metadata for management operations */
export interface ProfileMetadata {
  id: string;
  name: string;
  profession: string;
  level: number;
  breed: string;
  faction: string;
  created: string;
  updated: string;
  version: string;
}

// ============================================================================
// Profile Management Types
// ============================================================================

/** Export format options */
export type ProfileExportFormat = 'json' | 'legacy' | 'anarchy_online';

/** Import result with validation info */
export interface ProfileImportResult {
  success: boolean;
  profile?: TinkerProfile;
  errors: string[];
  warnings: string[];
  metadata: {
    source: string;
    originalFormat?: string;
    migrated: boolean;
  };
}

/** Bulk import result for multiple profiles */
export interface BulkImportResult {
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
    warnings?: string[];
  }>;
  metadata: {
    source: string;
    exportVersion?: string;
    exportDate?: string;
  };
}

/** Validation result */
export interface ProfileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/** Storage options for persistence */
export interface ProfileStorageOptions {
  compress?: boolean;
  encrypt?: boolean;
  autoSave?: boolean;
  migrationEnabled?: boolean;
}

// ============================================================================
// Event System Types
// ============================================================================

/** Profile management events */
export interface ProfileEvents {
  'profile:created': { profile: TinkerProfile };
  'profile:updated': { profile: TinkerProfile; changes: Partial<TinkerProfile> };
  'profile:deleted': { profileId: string };
  'profile:activated': { profile: TinkerProfile };
  'profile:imported': { profile: TinkerProfile; result: ProfileImportResult };
  'profile:exported': { profile: TinkerProfile; format: ProfileExportFormat };
  'storage:error': { error: Error; operation: string };
  'validation:failed': { profileId: string; errors: string[] };
}

// ============================================================================
// Search and Filter Types
// ============================================================================

/** Profile search filters */
export interface ProfileSearchFilters {
  name?: string;
  profession?: string[];
  level?: [number, number];
  breed?: string[];
  faction?: string[];
  created?: [string, string];
  tags?: string[];
}

/** Profile sorting options */
export interface ProfileSortOptions {
  field: 'name' | 'profession' | 'level' | 'created' | 'updated';
  direction: 'asc' | 'desc';
}

// ============================================================================
// Configuration Types
// ============================================================================

/** Library configuration */
export interface TinkerProfilesConfig {
  storage: ProfileStorageOptions;
  validation: {
    strictMode: boolean;
    autoCorrect: boolean;
    allowLegacyFormats: boolean;
  };
  events: {
    enabled: boolean;
    throttle: number;
  };
  features: {
    autoBackup: boolean;
    compression: boolean;
    migration: boolean;
    analytics: boolean;
  };
}
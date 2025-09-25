/**
 * TinkerProfiles Library Types
 * 
 * Unified type definitions for profile management across all TinkerTools applications
 */

import type { Item } from '@/types/api';
import type { PerkSystem } from './perk-types';

// ============================================================================
// Core Profile Types
// ============================================================================

/** Skill entry with IP tracking */
export interface SkillWithIP {
  // Stored values (persisted to localStorage)
  pointFromIp: number;  // IP improvements made by player
  ipSpent: number;      // Total IP cost

  // Computed values (calculated at runtime, never stored)
  value?: number;         // Total: base + trickle + IP + equipment + perks + buffs (capped)
  baseValue?: number;     // Base + trickle + IP (no equipment/perks/buffs)
  trickleDown?: number;   // Bonus from abilities
  equipmentBonus?: number; // Total bonus from all equipped items
  perkBonus?: number;     // Total bonus from all equipped perks
  buffBonus?: number;     // Total bonus from all active nano buffs
  cap?: number;           // Effective skill cap (including equipment and perks for display)
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

/** Comprehensive profile structure following legacy TinkerProfiles format */
export interface TinkerProfile {
  // Profile metadata
  id: string;
  version: string;
  created: string;
  updated: string;

  // Character basic info
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

  // IP tracking (new)
  IPTracker?: IPTracker;

  // Complete skills structure with IP tracking (except Misc)
  Skills: {
    Attributes: {
      Intelligence: SkillWithIP;
      Psychic: SkillWithIP;
      Sense: SkillWithIP;
      Stamina: SkillWithIP;
      Strength: SkillWithIP;
      Agility: SkillWithIP;
    };
    'Body & Defense': Record<string, SkillWithIP>;
    ACs: Record<string, number>;
    'Ranged Weapons': Record<string, SkillWithIP>;
    'Ranged Specials': Record<string, SkillWithIP>;
    'Melee Weapons': Record<string, SkillWithIP>;
    'Melee Specials': Record<string, SkillWithIP>;
    'Nanos & Casting': Record<string, SkillWithIP>;
    Exploring: Record<string, SkillWithIP>;
    'Trade & Repair': Record<string, SkillWithIP>;
    'Combat & Healing': Record<string, SkillWithIP>;
    Misc: Record<string, number>; // Misc doesn't use IP tracking
  };

  // Equipment slots
  Weapons: Record<string, Item | null>;
  Clothing: Record<string, Item | null>;
  Implants: Record<string, ImplantWithClusters | null>;

  // Perk system with structured tracking for SL/AI points and LE research
  PerksAndResearch: PerkSystem;

  // Nano buff system - array of active nano programs providing stat bonuses
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
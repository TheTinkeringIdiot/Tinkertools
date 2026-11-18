/**
 * API Type Definitions for TinkerTools
 *
 * Defines all TypeScript interfaces for API requests and responses
 * following the patterns specified in docs/11_api_design_and_data_flow.md
 */

import type { TinkerProfile } from '../lib/tinkerprofiles/types';

// ============================================================================
// Base API Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: JsonValue;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// ============================================================================
// Game Data Models
// ============================================================================
//
// AOID is the only identity an item has: the backend's row ids differ between
// game versions, so nothing here carries one. Stats, effects, actions and
// criteria are content and have no identity of their own.

export interface StatValue {
  stat: number;
  value: number;
}

export interface Criterion {
  value1: number;
  value2: number;
  operator: number;
}

/**
 * A value parsed from JSON. Deliberately not recursive: Vue's ref unwrapping
 * and DeepReadonly recurse into recursive types without bound.
 */
export type JsonValue = string | number | boolean | null | object;

/**
 * Spell parameters: a JSON object whose keys depend on the spell format.
 * The numeric parameters the frontend reads are typed; the rest are plain JSON.
 */
export interface SpellParams {
  Stat?: number;
  StatID?: number;
  Amount?: number;
  Value?: number;
  MinValue?: number;
  MaxValue?: number;
  MinAmount?: number;
  MaxAmount?: number;
  ModifierStat?: number;
  BitNum?: number;
  School?: number;
  NCU?: number;
  NanoPoints?: number;
  Level?: number;
  Duration?: number;
  StackingLine?: number;
  AttackTime?: number;
  RechargeTime?: number;
  // Lower-case spellings seen in some records
  stat?: number;
  statId?: number;
  amount?: number;
  value?: number;
  minValue?: number;
  maxValue?: number;
  modifierStat?: number;
  [key: string]: JsonValue | undefined;
}

export interface Spell {
  target?: number;
  tick_count?: number;
  tick_interval?: number;
  spell_id?: number;
  /** @deprecated Use spell_id to look up format from SPELL_FORMATS constant instead */
  spell_format?: string;
  spell_params: SpellParams;
  criteria: Criterion[];
}

export interface SpellData {
  event?: number;
  spells: Spell[];
}

export interface AttackDefense {
  attack: StatValue[];
  defense: StatValue[];
}

export interface AnimationMesh {
  animation?: StatValue;
  mesh?: StatValue;
}

export interface Action {
  action?: number;
  criteria: Criterion[];
}

export interface SourceType {
  id: number;
  name: string;
  description?: string;
}

export interface Source {
  id: number;
  source_type_id: number;
  source_id: number;
  name: string;
  extra_data: Record<string, JsonValue>;
  source_type?: SourceType;
}

export interface ItemSource {
  source: Source;
  drop_rate?: number;
  min_ql?: number;
  max_ql?: number;
  conditions?: string;
  extra_data: Record<string, JsonValue>;
}

export interface Item {
  aoid: number;
  name: string;
  ql?: number;
  description?: string;
  item_class?: number;
  is_nano: boolean;
  stats: StatValue[];
  spell_data: SpellData[];
  actions: Action[];
  attack_defense?: AttackDefense;
  animation_mesh?: AnimationMesh;
  attack_stats: StatValue[];
  defense_stats: StatValue[];
  sources?: ItemSource[];
}

export interface InterpolatedSpell {
  target?: number;
  tick_count?: number;
  tick_interval?: number;
  spell_id?: number;
  spell_format?: string;
  spell_params: SpellParams;
  criteria: Criterion[];
}

export interface InterpolatedSpellData {
  event?: number;
  spells: InterpolatedSpell[];
}

export interface InterpolatedAction {
  action?: number;
  criteria: Criterion[];
}

export interface InterpolatedItem {
  // Original item data
  aoid: number;
  name: string;
  ql?: number;
  description?: string;
  item_class?: number;
  is_nano: boolean;

  // Interpolation metadata
  interpolating: boolean;
  low_ql?: number;
  high_ql?: number;
  target_ql?: number;
  ql_delta?: number;
  ql_delta_full?: number;

  // Interpolated data
  stats: StatValue[];
  spell_data: InterpolatedSpellData[];
  actions: InterpolatedAction[];
}

export interface InterpolationResponse {
  success: boolean;
  item?: InterpolatedItem;
  error?: string;
  interpolation_range?: {
    min_ql: number;
    max_ql: number;
  };
}

export interface InterpolationRange {
  min_ql: number;
  max_ql: number;
  interpolatable: boolean;
  base_aoid: number;
}

export interface InterpolationInfo {
  aoid: number;
  interpolatable: boolean;
  ranges: InterpolationRange[];
  min_ql: number;
  max_ql: number;
  ql_range: number;
}

export interface BatchInterpolateItemRequest {
  aoid: number;
  target_ql: number;
}

export interface BatchInterpolationRequest {
  items: BatchInterpolateItemRequest[];
}

export interface BatchInterpolateItemResult {
  aoid: number;
  target_ql: number;
  success: boolean;
  item: InterpolatedItem | null;
  error: string | null;
}

export interface BatchInterpolationResponse {
  success: boolean;
  results: BatchInterpolateItemResult[];
  errors: string[];
}

export interface BatchPerkLookupRequest {
  aoids: number[];
}

/** A perk item from the perk lookup endpoints, with its perk metadata */
export interface PerkLookupItem extends Item {
  perk_name: string;
  perk_counter: number;
  perk_type: string;
  perk_series?: string | null;
  perk_professions: string[];
  perk_breeds: string[];
  perk_level_required: number;
  perk_ai_level_required: number | null;
  // Legacy aliases of the perk_* fields
  counter: number;
  type: string;
  level: number;
  ai_title: number | null;
  formatted_name: string;
}

export interface BatchPerkResult {
  aoid: number;
  success: boolean;
  perk: PerkLookupItem | null;
  error: string | null;
}

export interface BatchPerkLookupResponse {
  success: boolean;
  results: BatchPerkResult[];
  errors: string[];
}

export interface SymbiantItem {
  aoid: number;
  name: string;
  ql: number;
  slot_id: number;
  family: 'Artillery' | 'Control' | 'Extermination' | 'Infantry' | 'Support' | null;
  actions: Action[];
  spell_data?: SpellData[];
}

/**
 * Type guard to distinguish symbiants from implants
 * Symbiants have family/slot_id, implants have item_class/icon_id
 */
export function isSymbiant(item: object): item is SymbiantItem {
  return 'family' in item && 'slot_id' in item;
}

export interface Mob {
  id: number;
  name: string;
  level: number | null;
  playfield: string;
  location: string;
  mob_names: string[];
  is_pocket_boss: boolean;
  metadata?: Record<string, JsonValue>;
  symbiant_count?: number;
}

export interface MobWithDrops extends Mob {
  dropped_items: SymbiantItem[];
}

// Legacy compatibility - will be deprecated
export type PocketBoss = Mob;
export type Symbiant = SymbiantItem;

export interface StatBonus {
  stat: string;
  bonus: number;
}

// ============================================================================
// Character Profile Types (LocalStorage)
// ============================================================================

/**
 * Character profiles live in the TinkerProfiles library (v4, ID-keyed skills).
 * Re-exported here for the many callers that import it alongside API types.
 */
export type { TinkerProfile };

export interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  itemsPerPage: number;
  defaultExpansion: string[];
  favoriteItems: number[];
  recentSearches: string[];
  lastUpdated: string;
}

export interface CollectionTracking {
  symbiants: {
    collected: number[];
    wishlist: number[];
    notes: Record<number, string>;
  };
  lastUpdated: string;
}

// ============================================================================
// Search and Filter Types
// ============================================================================

export interface StatFilter {
  function: 'requires' | 'modifies';
  stat: number;
  operator: '==' | '<=' | '>=' | '!=';
  value: number;
}

export interface ItemSearchQuery {
  search?: string;
  exact_match?: boolean;
  search_fields?: string[];
  item_class?: number | number[]; // Support both single value and array for backwards compatibility
  min_ql?: number;
  max_ql?: number;
  is_nano?: boolean;
  has_stats?: number[];
  // New advanced search parameters
  slot?: number;
  profession?: number;
  breed?: number;
  gender?: number;
  faction?: number;
  froob_friendly?: boolean;
  nodrop?: boolean;
  stat_bonuses?: number[];
  stat_filters?: StatFilter[];
  strain?: number;
  page?: number;
  limit?: number;
  sort?: 'name' | 'ql' | 'item_class' | 'aoid';
  sort_order?: 'asc' | 'desc';
}

// Pagination fields removed - all filtering now handled client-side
export interface SymbiantSearchQuery {
  search?: string;
  family?: string;
  families?: string[];
  slot_id?: number;
  min_ql?: number;
  max_ql?: number;
  min_level?: number;
  max_level?: number;
}

export interface MobSearchQuery {
  search?: string;
  is_pocket_boss?: boolean;
  playfield?: string;
  min_level?: number;
  max_level?: number;
  page?: number;
  limit?: number;
}

export interface MobDropsQuery {
  family?: string;
}

// Legacy compatibility - will be deprecated
export type PocketBossSearchQuery = MobSearchQuery;

// ============================================================================
// Advanced Query Types
// ============================================================================

export interface StatRequirement {
  stat: number;
  operator: 'gte' | 'lte' | 'eq';
  value: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  offset: number;
  total: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ============================================================================
// Build and Character Types
// ============================================================================

export interface BuildComponent {
  slot: string;
  item: Item;
  priority: number;
}

export interface CharacterBuild {
  id: string;
  name: string;
  description: string;
  profile: TinkerProfile;
  components: BuildComponent[];
  metadata: {
    created_at: string;
    updated_at: string;
    version: string;
  };
}

export interface BuildAnalysis {
  total_stats: Record<number, number>;
  conflicts: string[];
  suggestions: string[];
  missing_requirements: StatRequirement[];
  optimization_score: number;
}

// ============================================================================
// Error Types
// ============================================================================

export enum ErrorCodes {
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

export interface ApiError {
  code: ErrorCodes;
  message: string;
  details?: {
    field?: string;
    constraint?: string;
    suggestion?: string;
  };
  timestamp: string;
  requestId: string;
}

export interface UserFriendlyError {
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  action: string;
  recoverable: boolean;
  retryAfter?: number;
  /** HTTP status of the answer, when the server answered that what was asked for does not exist. */
  status?: number;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

export interface CacheConfig {
  staticData: {
    ttl: number;
    keys: string[];
  };
  dynamicData: {
    ttl: number;
    keys: string[];
  };
  userData: {
    ttl: number;
    keys: string[];
  };
}

// ============================================================================
// TinkerPlants Types
// ============================================================================

/** Implant or symbiant selection configuration for a single slot */
export interface ImplantSelection {
  /** Equipment type: 'implant' for custom implants or 'symbiant' for fixed symbiants */
  type: 'implant' | 'symbiant';
  /** Shiny cluster stat ID (e.g., 112 for Pistol, 131 for Time & Space) or null if empty (implants only) */
  shiny?: number | null;
  /** Bright cluster stat ID or null if empty (implants only) */
  bright?: number | null;
  /** Faded cluster stat ID or null if empty (implants only) */
  faded?: number | null;
  /** Quality level (1-300) */
  ql: number;
  /** Slot bitflag string key (e.g., "2" for Eyes, "4" for Head) */
  slotBitflag: string;
  /** Full implant item data from API (null if not yet loaded, implants only) */
  item: Item | null;
  /**
   * Symbiant item data (symbiants only). setSymbiant() swaps the SymbiantItem
   * it is given for the full Item, and profiles store that Item.
   */
  symbiant?: Item | null;
}

/** Request format for implant lookup API */
export interface ImplantLookupRequest {
  /** Slot position number or bitflag */
  slot: number;
  /** Quality level (1-300) */
  ql: number;
  /** Cluster configuration as stat ID → cluster name mapping */
  clusters: Record<string, number>;
}

/** Response format for implant lookup API */
export interface ImplantLookupResponse {
  /** Whether the lookup was successful */
  success: boolean;
  /** The found implant item data (null if not found) */
  item: Item | null;
  /** Success or error message */
  message?: string;
  /** Whether the item was interpolated to target QL */
  interpolated: boolean;
  /** Base QL of the database item used */
  base_ql?: number;
}

/** Requirement check result for a single stat */
export interface ImplantRequirement {
  /** Stat ID (e.g., 134 for Treatment) */
  stat: number;
  /** Human-readable stat name */
  statName: string;
  /** Required value for this stat */
  required: number;
  /** Current profile value for this stat (undefined when no profile selected) */
  current: number | undefined;
  /** Whether requirement is met (undefined when no profile selected) */
  met: boolean | undefined;
}

/** Treatment requirement information */
export interface TreatmentInfo {
  /** Treatment value required by implant configuration */
  required: number;
  /** Current Treatment value from profile (undefined when no profile selected) */
  current: number | undefined;
  /** Delta between required and current (undefined when no profile selected) */
  delta: number | undefined;
  /** Whether profile treatment meets requirement (undefined when no profile selected) */
  sufficient: boolean | undefined;
}

/** Attribute requirement information for display in Requirements tab */
export interface AttributeRequirementInfo {
  /** Stat ID (e.g., 124 for Treatment) */
  stat: number;
  /** Human-readable stat name */
  statName: string;
  /** Maximum required value for this stat */
  required: number;
  /** Current profile value for this stat (undefined when no profile selected) */
  current: number | undefined;
  /** Difference (undefined when no profile selected) */
  delta: number | undefined;
  /** Whether current meets requirement (undefined when no profile selected) */
  sufficient: boolean | undefined;
}

/** Per-implant requirements grouped by slot */
export interface PerImplantRequirement {
  /** Slot bitflag (e.g., "2" for Eyes) */
  slot: string;
  /** Display name (e.g., "Eyes") */
  slotName: string;
  /** Requirements for this implant */
  requirements: ImplantRequirement[];
}

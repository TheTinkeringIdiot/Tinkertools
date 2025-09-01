/**
 * API Type Definitions for TinkerTools
 * 
 * Defines all TypeScript interfaces for API requests and responses
 * following the patterns specified in docs/11_api_design_and_data_flow.md
 */

// ============================================================================
// Base API Types
// ============================================================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    timestamp: string
    requestId: string
    version: string
  }
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// ============================================================================
// Game Data Models
// ============================================================================

export interface StatValue {
  id: number
  stat: number
  value: number
}

export interface Criterion {
  id: number
  value1: number
  value2: number
  operator: number
}

export interface Spell {
  id: number
  target?: number
  tick_count?: number
  tick_interval?: number
  spell_id?: number
  /** @deprecated Use spell_id to look up format from SPELL_FORMATS constant instead */
  spell_format?: string
  spell_params: Record<string, any>
  criteria: Criterion[]
}

export interface SpellData {
  id: number
  event?: number
  spells: Spell[]
}

export interface AttackDefense {
  id: number
  attack: StatValue[]
  defense: StatValue[]
}

export interface AnimationMesh {
  id: number
  animation?: StatValue
  mesh?: StatValue
}

export interface Action {
  id: number
  action?: number
  item_id: number
  criteria: Criterion[]
}

export interface SourceType {
  id: number
  name: string
  description?: string
}

export interface Source {
  id: number
  source_type_id: number
  source_id: number
  name: string
  extra_data: Record<string, any>
  source_type?: SourceType
}

export interface ItemSource {
  source: Source
  drop_rate?: number
  min_ql?: number
  max_ql?: number
  conditions?: string
  extra_data: Record<string, any>
}


export interface Item {
  id: number
  aoid?: number
  name: string
  ql?: number
  description?: string
  item_class?: number
  is_nano: boolean
  stats: StatValue[]
  spell_data: SpellData[]
  actions: Action[]
  attack_defense?: AttackDefense
  animation_mesh?: AnimationMesh
  attack_stats: StatValue[]
  defense_stats: StatValue[]
  sources?: ItemSource[]
}

export interface InterpolatedSpell {
  target?: number
  tick_count?: number
  tick_interval?: number
  spell_id?: number
  spell_format?: string
  spell_params: Record<string, any>
  criteria: Criterion[]
}

export interface InterpolatedSpellData {
  event?: number
  spells: InterpolatedSpell[]
}

export interface InterpolatedAction {
  action?: number
  criteria: Criterion[]
}

export interface InterpolatedItem {
  // Original item data
  id: number
  aoid?: number
  name: string
  ql?: number
  description?: string
  item_class?: number
  is_nano: boolean
  
  // Interpolation metadata
  interpolating: boolean
  low_ql?: number
  high_ql?: number
  target_ql?: number
  ql_delta?: number
  ql_delta_full?: number
  
  // Interpolated data
  stats: StatValue[]
  spell_data: InterpolatedSpellData[]
  actions: InterpolatedAction[]
  
  // Optional related data
  attack_defense_id?: number
  animation_mesh_id?: number
}

export interface InterpolationRequest {
  aoid: number
  target_ql: number
}

export interface InterpolationResponse {
  success: boolean
  item?: InterpolatedItem
  error?: string
  interpolation_range?: {
    min_ql: number
    max_ql: number
  }
}

export interface InterpolationRange {
  min_ql: number
  max_ql: number
  interpolatable: boolean
  base_aoid: number
}

export interface InterpolationInfo {
  aoid: number
  interpolatable: boolean
  ranges: InterpolationRange[]
  min_ql: number
  max_ql: number
  ql_range: number
}

export interface Symbiant {
  id: number
  aoid: number
  name?: string
  slot?: string
  ql?: number
  family?: string
  stat_bonuses?: StatBonus[]
}

export interface StatBonus {
  stat: string
  bonus: number
}

export interface PocketBoss {
  id: number
  name: string
  level: number
  playfield?: string
  location?: string
  mobs?: string
  dropped_symbiants?: Symbiant[]
}

// ============================================================================
// Character Profile Types (LocalStorage)
// ============================================================================

/** Skill entry with IP tracking */
export interface SkillWithIP {
  value: number
  ipSpent: number
  pointFromIp: number
}

export interface TinkerProfile {
  Character: {
    Name: string
    Level: number
    Profession: string
    Breed: string
    Faction: string
    Expansion: string
    AccountType: string
    MaxHealth: number
    MaxNano: number
  }
  Skills: {
    Attributes: {
      Intelligence: SkillWithIP
      Psychic: SkillWithIP
      Sense: SkillWithIP
      Stamina: SkillWithIP
      Strength: SkillWithIP
      Agility: SkillWithIP
    }
    'Body & Defense': Record<string, SkillWithIP>
    ACs: Record<string, number>
    'Ranged Weapons': Record<string, SkillWithIP>
    'Ranged Specials': Record<string, SkillWithIP>
    'Melee Weapons': Record<string, SkillWithIP>
    'Melee Specials': Record<string, SkillWithIP>
    'Nanos & Casting': Record<string, SkillWithIP>
    Exploring: Record<string, SkillWithIP>
    'Trade & Repair': Record<string, SkillWithIP>
    'Combat & Healing': Record<string, SkillWithIP>
    Misc: Record<string, number> // Misc doesn't use IP tracking
  }
  Weapons: Record<string, Item | null>
  Clothing: Record<string, Item | null>
  Implants: Record<string, Item | null>
  PerksAndResearch: any[]
}

export interface UserPreferences {
  theme: 'light' | 'dark'
  language: string
  itemsPerPage: number
  defaultExpansion: string[]
  favoriteItems: number[]
  recentSearches: string[]
  lastUpdated: string
}

export interface CollectionTracking {
  symbiants: {
    collected: number[]
    wishlist: number[]
    notes: Record<number, string>
  }
  lastUpdated: string
}

// ============================================================================
// Search and Filter Types
// ============================================================================

export interface StatFilter {
  function: 'requires' | 'modifies'
  stat: number
  operator: '==' | '<=' | '>=' | '!='
  value: number
}

export interface ItemSearchQuery {
  search?: string
  exact_match?: boolean
  search_fields?: string[]
  item_class?: number | number[]  // Support both single value and array for backwards compatibility
  min_ql?: number
  max_ql?: number
  is_nano?: boolean
  has_stats?: number[]
  // New advanced search parameters
  slot?: number
  profession?: number
  breed?: number
  gender?: number
  faction?: number
  froob_friendly?: boolean
  nodrop?: boolean
  stat_bonuses?: number[]
  stat_filters?: StatFilter[]
  strain?: number
  page?: number
  limit?: number
  sort?: 'name' | 'ql' | 'item_class' | 'aoid'
  sort_order?: 'asc' | 'desc'
}

export interface SpellSearchQuery {
  search?: string
  has_criteria?: boolean
  spell_id?: number
  page?: number
  limit?: number
}

export interface SymbiantSearchQuery {
  search?: string
  family?: string[]
  page?: number
  limit?: number
}

export interface PocketBossSearchQuery {
  search?: string
  min_level?: number
  max_level?: number
  playfield?: string
  page?: number
  limit?: number
}

// ============================================================================
// Advanced Query Types
// ============================================================================

export interface StatRequirement {
  stat: number
  operator: 'gte' | 'lte' | 'eq'
  value: number
}

export interface ItemFilterRequest {
  stat_requirements?: StatRequirement[]
  item_class?: number[]
  ql_range?: [number, number]
  is_nano?: boolean
  has_attack_defense?: boolean
  has_spell_data?: boolean
}

export interface ItemFilters {
  // Basic type filters
  isNano?: boolean
  isWeapon?: boolean
  itemClasses?: number[]
  
  // Quality level filters
  minQL?: number
  maxQL?: number
  
  // Stat filters
  statFilterMode?: 'any' | 'can_meet' | 'cannot_meet' | 'has_stats'
  selectedStats?: number[]
  statMinValues?: Record<number, number>
  
  // Property filters
  hasEffects?: boolean | null
  hasRequirements?: boolean | null
  isTradeable?: boolean | null
  isDroppable?: boolean | null
  
  // Source filters
  sources?: string[]
  
  // Special filters
  favorite_items?: boolean
}

export interface PaginationInfo {
  page: number
  limit: number
  offset: number
  total: number
  hasNext: boolean
  hasPrev: boolean
}

export interface ItemCompatibilityRequest {
  profile: TinkerProfile
  item_ids: number[]
  check_type: 'equip' | 'use' | 'cast'
}

export interface ItemCompatibilityResult {
  item_id: number
  compatible: boolean
  missing_requirements?: StatRequirement[]
  suggestions?: string[]
}

// ============================================================================
// Build and Character Types
// ============================================================================

export interface BuildComponent {
  slot: string
  item: Item
  priority: number
}

export interface CharacterBuild {
  id: string
  name: string
  description: string
  profile: TinkerProfile
  components: BuildComponent[]
  metadata: {
    created_at: string
    updated_at: string
    version: string
  }
}

export interface BuildAnalysis {
  total_stats: Record<number, number>
  conflicts: string[]
  suggestions: string[]
  missing_requirements: StatRequirement[]
  optimization_score: number
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
  DATABASE_ERROR = 'DATABASE_ERROR'
}

export interface ApiError {
  code: ErrorCodes
  message: string
  details?: {
    field?: string
    constraint?: string
    suggestion?: string
  }
  timestamp: string
  requestId: string
}

export interface UserFriendlyError {
  type: 'error' | 'warning' | 'info'
  title: string
  message: string
  action: string
  recoverable: boolean
  retryAfter?: number
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry<T> {
  data: T
  timestamp: number
  expiry: number
}

export interface CacheConfig {
  staticData: {
    ttl: number
    keys: string[]
  }
  dynamicData: {
    ttl: number
    keys: string[]
  }
  userData: {
    ttl: number
    keys: string[]
  }
}

// ============================================================================
// Request/Response Wrappers
// ============================================================================

export interface BatchRequest<T> {
  items: T[]
  include_related?: boolean
}

export interface BatchItemRequest {
  item_ids: number[]
  include_stats?: boolean
  include_spells?: boolean
  include_actions?: boolean
}

export interface SearchResponse<T> extends PaginatedResponse<T> {
  facets?: {
    item_class?: Array<{ value: number; count: number }>
    ql_range?: { min: number; max: number }
    expansions?: Array<{ value: string; count: number }>
  }
  suggestions?: string[]
}
// Nano-related TypeScript types for TinkerNanos application

import type { Action } from './api';

export interface NanoProgram {
  id: number;
  aoid?: number;
  name: string;
  icon?: string;
  /** The game's NanoSchool stat (405); null when the nano has none */
  school: NanoSchoolName | null;
  /** The NanoStrain stat (75): nanos of one strain don't stack; null when it has none */
  strainId: number | null;
  /** strainId's name, for display; null when it has none or the ID is unnamed */
  strain: string | null;
  description?: string;

  // The nano item's actions; the Use action's criteria are its casting requirements
  actions?: Action[];
  nanoPointCost?: number;
  castingTime?: number;
  rechargeTime?: number;

  // Effects
  effects?: NanoEffect[];
  duration?: EffectDuration;
  targeting?: TargetingData;

  // Meta information
  /**
   * Lowest character level that can cast it: 1 when the Use action asks for no
   * level, null when the nano has no Use action (not player-castable)
   */
  level: number | null;
  qualityLevel: number;
  /** Professions that can cast it; empty when the Use action doesn't restrict it */
  professions: string[];
  sourceLocation?: string;
  acquisitionMethod?: string;
  memoryUsage?: number;
}

export interface NanoEffect {
  type: EffectType;
  statId?: number | string;
  value?: number;
  modifier?: EffectModifier;
  conditions?: EffectCondition[];
  stackable: boolean;
  conflicts?: number[]; // Conflicting nano IDs
}

/** NanoSchool stat (405) values, as the /nanos endpoints name them */
export type NanoSchoolName = 'Combat' | 'Medical' | 'Protection' | 'Psi' | 'Space';

/** The nano skills (MC, MM, BM, PM, SI, TS), which TinkerNukes calls schools */
export type NanoSchool =
  | 'Matter Metamorphosis'
  | 'Biological Metamorphosis'
  | 'Psychological Modifications'
  | 'Matter Creation'
  | 'Time and Space'
  | 'Sensory Improvement';

export type EffectType =
  | 'stat_boost'
  | 'heal'
  | 'damage'
  | 'protection'
  | 'teleport'
  | 'summon'
  | 'debuff'
  | 'utility';

export type EffectModifier = 'add' | 'multiply' | 'set' | 'percentage';

export interface EffectCondition {
  type: string;
  value: unknown;
}

export interface EffectDuration {
  type: 'instant' | 'duration' | 'permanent';
  value?: number; // seconds
}

export interface TargetingData {
  type: 'self' | 'team' | 'enemy' | 'area' | 'item' | 'pet';
  range?: number;
  area?: number;
}

// Nano filtering types
/**
 * TinkerNanos search filters. School, profession, strain, QL and level go to
 * the /nanos endpoints; the compatibility filters (skillCompatible, castable,
 * skillGapThreshold) run client-side against the active profile.
 */
export interface NanoFilters {
  /** NanoSchool names; a nano in any of them matches */
  schools: string[];
  /** NanoStrain IDs; a nano of any of them matches */
  strainIds: number[];
  /** Profession names; a nano any of them can cast matches */
  professions: string[];
  qlRange: [number, number];
  /** Lowest casting level; the full range filters nothing */
  levelRange: [number, number];
  skillGapThreshold: number | null;
  skillCompatible: boolean;
  castable: boolean;
  sortBy: NanoSortField;
  sortDescending: boolean;
}

/** A strain among the nanos some filters match, from GET /nanos/strains */
export interface NanoStrainOption {
  id: number;
  name: string | null;
  /** Nanos of this strain the filters match */
  count: number;
}

/** name, qualityLevel and level sort on the server; compatibility client-side */
export type NanoSortField = 'name' | 'qualityLevel' | 'level' | 'compatibility';

// Compatibility analysis results
export interface NanoCompatibilityInfo {
  /**
   * castable: every requirement is met. unverified: none the profile can
   * check fails, but some it can't check (a running nano, a perk, the
   * target...) decide it. blocked: a requirement fails.
   */
  castState: NanoCastState;
  /** Nothing the profile can check stops it: castable or unverified */
  canCast: boolean;
  compatibilityScore: number; // 0-100
  unmetRequirements: UnmetNanoRequirement[];
  /** Descriptions of the requirements that couldn't be checked, when unverified */
  unverifiedRequirements: string[];
  memoryUsage: number;
  nanoPointCost: number;
}

export type NanoCastState = 'castable' | 'unverified' | 'blocked';

/** A casting requirement the character does not meet, from checkActionRequirements */
export interface UnmetNanoRequirement {
  stat: number;
  statName: string;
  required: number;
  current: number;
  operator: string;
  /** Set for requirements that aren't a stat comparison, or read better as text */
  description?: string;
}

// Nano lineup management
export interface NanoLineup {
  id: string;
  name: string;
  description?: string;
  scenario: LineupScenario;

  // Active nanos
  uploadedNanos: number[];
  memoryUsage: MemoryUsage;

  // Lineup optimization
  priorities: NanoPriority[];
  constraints: LineupConstraints;

  // Performance metrics
  effectiveness: EffectivenessMetrics;
  conflicts: NanoConflict[];

  // Metadata
  created: Date;
  lastModified: Date;
  useCount: number;
}

export interface MemoryUsage {
  totalMemory: number;
  usedMemory: number;
  availableMemory: number;
  memoryPerNano: Record<number, number>;
  optimizationPotential: number;
}

export interface NanoPriority {
  nanoId: number;
  priority: number; // 1-10
  reason: string;
  scenario?: string;
}

export interface LineupConstraints {
  maxMemoryUsage: number;
  requiredNanos: number[];
  excludedNanos: number[];
  schoolLimitations: Record<NanoSchool, number>;
  conflictResolution: ConflictResolutionStrategy;
}

export type LineupScenario =
  | 'pvp'
  | 'pve_solo'
  | 'pve_team'
  | 'crafting'
  | 'leveling'
  | 'social'
  | 'general';

export type ConflictResolutionStrategy =
  | 'prioritize_higher'
  | 'prioritize_duration'
  | 'prioritize_efficiency'
  | 'manual_selection';

export interface EffectivenessMetrics {
  overallScore: number;
  synergies: number;
  conflicts: number;
  efficiency: number;
}

export interface NanoConflict {
  type: ConflictType;
  nanos: number[];
  severity: 'low' | 'medium' | 'high';
  description: string;
  resolution?: string;
}

export type ConflictType = 'strain' | 'effect' | 'memory' | 'resource';

// Strain conflict detection
export interface StrainConflict {
  strain: string;
  conflictingNanos: NanoProgram[];
  severity: 'warning' | 'error';
  description: string;
}

// Search and analysis types
export interface NanoSearchResult {
  nanos: NanoProgram[];
  totalCount: number;
  facets: SearchFacets;
}

export interface SearchFacets {
  schools: FacetCount[];
  strains: FacetCount[];
  professions: FacetCount[];
  effectTypes: FacetCount[];
  levelRanges: FacetCount[];
}

export interface FacetCount {
  value: string | number;
  count: number;
}

// Effect analysis
export interface EffectAnalysis {
  effectId: string;
  effects: NanoEffect[];
  interactions: EffectInteraction[];
  synergies: EffectSynergy[];
  conflicts: EffectConflict[];
}

export interface EffectInteraction {
  effect1: number;
  effect2: number;
  interactionType: InteractionType;
  result: InteractionResult;
  recommendation?: string;
}

export type InteractionType = 'stacking' | 'conflict' | 'synergy' | 'override' | 'enhancement';

export interface InteractionResult {
  type: 'positive' | 'negative' | 'neutral';
  magnitude: number;
  description: string;
}

export interface EffectSynergy {
  nanos: number[];
  synergyType: SynergyType;
  benefit: SynergyBenefit;
  requirements: SynergyRequirement[];
  effectiveness: number;
}

export type SynergyType =
  | 'multiplicative'
  | 'additive'
  | 'conditional'
  | 'sequential'
  | 'complementary';

export interface SynergyBenefit {
  type: string;
  value: number;
  description: string;
}

export interface SynergyRequirement {
  type: string;
  value: unknown;
  description: string;
}

export interface EffectConflict {
  nanos: number[];
  conflictType: ConflictType;
  severity: 'low' | 'medium' | 'high';
  resolution: ConflictResolution[];
}

export interface ConflictResolution {
  strategy: string;
  description: string;
  priority: number;
}

// State management types
export interface NanosState {
  nanos: NanoProgram[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  filters: NanoFilters;
  selectedNano: NanoProgram | null;
  favorites: number[];
  searchHistory: string[];
  preferences: NanoPreferences;
}

export interface NanoPreferences {
  defaultView: 'list' | 'school';
  compactCards: boolean;
  autoExpandSchools: boolean;
  showCompatibility: boolean;
  defaultSort: string;
  itemsPerPage: number;
}

// API response types
export interface NanoApiResponse {
  data: NanoProgram[];
  total: number;
  page: number;
  size: number;
  facets?: SearchFacets;
}

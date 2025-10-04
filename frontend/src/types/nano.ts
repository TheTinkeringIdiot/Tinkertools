// Nano-related TypeScript types for TinkerNanos application

export interface NanoProgram {
  id: number;
  aoid?: number;
  name: string;
  icon?: string;
  school: NanoSchool;
  strain: string;
  description?: string;
  
  // Casting requirements
  castingRequirements?: CastingRequirement[];
  nanoPointCost?: number;
  castingTime?: number;
  rechargeTime?: number;
  
  // Effects
  effects?: NanoEffect[];
  duration?: EffectDuration;
  targeting?: TargetingData;
  
  // Meta information
  level: number;
  qualityLevel: number;
  profession?: string;
  sourceLocation?: string;
  acquisitionMethod?: string;
  memoryUsage?: number;
}

export interface CastingRequirement {
  type: 'skill' | 'stat' | 'nano' | 'item' | 'level';
  requirement: number | string;
  value: number;
  critical?: boolean; // Must be met vs recommended
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
  value: any;
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
export interface NanoFilters {
  schools: string[];
  strains: string[];
  professions: string[];
  qualityLevels: number[];
  effectTypes?: string[];
  durationType?: string[];
  targetTypes?: string[];
  levelRange?: [number, number];
  memoryUsageRange?: [number, number];
  nanoPointRange?: [number, number];
  skillGapThreshold?: number | null;
  skillCompatible: boolean;
  castable: boolean;
  sortBy?: string;
  sortDescending?: boolean;
}

// Character profile for compatibility checking
export interface TinkerProfile {
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

// Compatibility analysis results
export interface NanoCompatibilityInfo {
  canCast: boolean;
  compatibilityScore: number; // 0-100
  averageSkillGap: number;
  skillDeficits: SkillDeficit[];
  statDeficits: StatDeficit[];
  levelDeficit: number;
  memoryUsage: number;
  nanoPointCost: number;
}

export interface SkillDeficit {
  skill: string;
  current: number;
  required: number;
  deficit: number;
}

export interface StatDeficit {
  stat: string;
  current: number;
  required: number;
  deficit: number;
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

export type ConflictType = 
  | 'strain'
  | 'effect'
  | 'memory'
  | 'resource';

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

// Analysis and recommendations
export interface NanoAnalysisResult {
  character: TinkerProfile;
  availableNanos: CastingAnalysis[];
  effects: EffectAnalysis[];
  interactions: EffectInteraction[];
  recommendedLineups: NanoLineup[];
  timestamp: Date;
}

export interface CastingAnalysis {
  nanoId: number;
  character: TinkerProfile;
  analysis: CastingResult;
  recommendations: CastingRecommendation[];
  alternatives: AlternativeNano[];
}

export interface CastingResult {
  canCast: boolean;
  successRate: number;
  requirements: RequirementCheck[];
  resourceCosts: ResourceCost;
  limitations: CastingLimitation[];
  optimizations: CastingOptimization[];
}

export interface RequirementCheck {
  requirement: CastingRequirement;
  met: boolean;
  currentValue: number;
  shortfall: number;
  timeToMeet?: number;
}

export interface ResourceCost {
  nanoPoints: number;
  nanoPointsPercentage: number;
  castingTime: number;
  rechargeTime: number;
  opportunity: OpportunityCost;
}

export interface OpportunityCost {
  alternativeNanos: number;
  memoryUsage: number;
  conflictingEffects: number;
}

export interface CastingLimitation {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface CastingOptimization {
  type: string;
  description: string;
  benefit: number;
}

export interface CastingRecommendation {
  type: string;
  description: string;
  priority: number;
  actionRequired: string;
}

export interface AlternativeNano {
  nanoId: number;
  similarity: number;
  advantages: string[];
  disadvantages: string[];
}

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

export type InteractionType = 
  | 'stacking'
  | 'conflict'
  | 'synergy'
  | 'override'
  | 'enhancement';

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
  value: any;
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

export interface NanoSearchRequest {
  query?: string;
  filters?: Partial<NanoFilters>;
  page?: number;
  size?: number;
  sort?: string;
  includeCompatibility?: boolean;
  profileId?: string;
}
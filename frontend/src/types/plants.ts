/**
 * TinkerPlants - Type Definitions
 * 
 * Types for character building, stat calculations, and implant/symbiant planning
 */

import type { Symbiant } from './api';

// Extended Symbiant interface for plants functionality
export interface PlantSymbiant extends Symbiant {
  name: string;
  description?: string;
  slot?: string;
  qualityLevel?: number;
  statBonuses?: StatModifier[];
  bossSource?: string;
}

// ============================================================================
// Character & Stats Types
// ============================================================================

export interface CharacterStats {
  [statId: string]: number;
}

export interface StatTarget {
  statId: string;
  statName: string;
  targetValue: number;
  priority: 'high' | 'medium' | 'low';
  currentValue?: number;
  deficit?: number;
}

export interface StatModifier {
  statId: string;
  statName: string;
  value: number;
  type: 'bonus' | 'penalty';
}

// ============================================================================
// Build Management Types
// ============================================================================

export interface CharacterBuild {
  id: string;
  name: string;
  symbiants: Record<string, PlantSymbiant>; // slot -> symbiant mapping
  totalStats: CharacterStats;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BuildComparison {
  builds: CharacterBuild[];
  statComparisons: Record<string, number[]>; // statId -> values for each build
  recommendations?: string[];
}

// ============================================================================
// Symbiant Planning Types
// ============================================================================

export interface SymbiantFilters {
  families: string[];
  slots: string[];
  qualityLevels: number[];
  statBonuses: string[];
  minStatValue?: number;
  maxStatValue?: number;
  unitTypes?: string[];
}

export interface SymbiantSlotSetup {
  slot: string;
  symbiant: PlantSymbiant | null;
  alternatives: PlantSymbiant[];
  priority: number;
  reason?: string;
}

export interface SymbiantBuildPlan {
  character: CharacterProfile;
  targets: StatTarget[];
  slotSetups: Record<string, SymbiantSlotSetup>;
  totalBonuses: StatModifier[];
  achievedTargets: string[];
  missingTargets: string[];
  alternatives: SymbiantBuildPlan[];
}

// ============================================================================
// Character Profile Integration
// ============================================================================

export interface CharacterProfile {
  id: string;
  name: string;
  profession: string;
  level: number;
  stats: CharacterStats;
  skills: Record<string, number>;
  breed?: string;
  gender?: string;
}

// ============================================================================
// Implant System Types (Future Implementation)
// ============================================================================

export interface ImplantSlot {
  slot: string;
  name: string;
  available: boolean;
  conflictsWith?: string[];
}

export interface ClusterSlot {
  position: 1 | 2 | 3; // Shiny=1, Bright=2, Faded=3
  type: 'shiny' | 'bright' | 'faded';
  cluster: Cluster | null;
}

export interface Cluster {
  id: number;
  name: string;
  type: 'shiny' | 'bright' | 'faded';
  statModifiers: StatModifier[];
  qualityLevel: number;
  requirements: SkillRequirement[];
}

export interface ImplantConfiguration {
  baseImplant: Implant;
  clusters: {
    shiny: ClusterSlot | null;
    bright: ClusterSlot | null;
    faded: ClusterSlot | null;
  };
  qualityLevel: number;
  totalStats: CharacterStats;
  equipRequirements: EquipRequirement[];
}

export interface Implant {
  id: number;
  name: string;
  slot: string;
  qualityLevel: number;
  description?: string;
}

export interface SkillRequirement {
  skill: string;
  level: number;
  type: 'minimum' | 'maximum';
}

export interface EquipRequirement {
  type: 'stat' | 'skill' | 'level' | 'treatment';
  requirement: string;
  value: number;
  met?: boolean;
}

// ============================================================================
// Optimization Types
// ============================================================================

export interface OptimizationSettings {
  prioritizeTargets: boolean;
  allowPartialSolutions: boolean;
  maxAlternatives: number;
  weightStatsByPriority: boolean;
}

export interface OptimizationResult {
  solution: SymbiantBuildPlan;
  score: number;
  efficiency: number;
  completeness: number;
  alternatives: SymbiantBuildPlan[];
  warnings: string[];
}

// ============================================================================
// Boss Integration Types
// ============================================================================

export interface BossInfo {
  id: number;
  name: string;
  level: number;
  location: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'very_hard';
  drops: number[]; // symbiant IDs
}

export interface BossLocation {
  playfield: string;
  zone: string;
  coordinates?: {
    x: number;
    y: number;
  };
  accessibility: 'public' | 'org_only' | 'special';
}

// ============================================================================
// UI State Types
// ============================================================================

export interface PlantsViewState {
  selectedProfile: string | null;
  buildMode: boolean;
  viewMode: boolean; // true = family view, false = list view
  searchQuery: string;
  filters: SymbiantFilters;
  showBuildDialog: boolean;
  showComparisonDialog: boolean;
}

export interface BuildDialogState {
  visible: boolean;
  mode: 'new' | 'edit' | 'compare';
  selectedBuild: CharacterBuild | null;
  isLoading: boolean;
}

// ============================================================================
// Export Types
// ============================================================================

export interface BuildExport {
  version: string;
  build: CharacterBuild;
  metadata: {
    exportDate: string;
    source: 'TinkerPlants';
    character?: CharacterProfile;
  };
}

export interface BuildImport {
  build: CharacterBuild;
  warnings: string[];
  conflicts: string[];
}

// ============================================================================
// Statistics & Analysis Types
// ============================================================================

export interface BuildStatistics {
  totalSymbiants: number;
  slotsUsed: number;
  slotsAvailable: number;
  statBonuses: Record<string, number>;
  topStats: Array<{
    statName: string;
    value: number;
    percentOfMax: number;
  }>;
  efficiency: number;
  completeness: number;
}

export interface StatAnalysis {
  current: number;
  target?: number;
  bonus: number;
  total: number;
  deficit: number;
  achievement: number; // percentage
  sources: Array<{
    source: string;
    value: number;
    type: 'base' | 'symbiant' | 'implant';
  }>;
}

// ============================================================================
// Error Types
// ============================================================================

export interface PlantsError {
  type: 'build' | 'symbiant' | 'optimization' | 'data';
  message: string;
  details?: any;
  suggestions?: string[];
}

// ============================================================================
// Events Types
// ============================================================================

export interface BuildEvent {
  type: 'symbiant_added' | 'symbiant_removed' | 'build_saved' | 'build_loaded';
  timestamp: number;
  data: any;
}

export interface PlantsEvents {
  onBuildChanged: (build: CharacterBuild) => void;
  onSymbiantSelected: (symbiant: Symbiant) => void;
  onStatsChanged: (stats: CharacterStats) => void;
  onTargetsChanged: (targets: StatTarget[]) => void;
  onOptimizationComplete: (result: OptimizationResult) => void;
}
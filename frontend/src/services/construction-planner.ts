/**
 * TinkerTools Construction Planner Service
 * 
 * High-level service for managing implant construction planning,
 * integrating construction analysis with UI state management.
 */

import { reactive, computed, ref } from 'vue';
import {
  generateConstructionPlan,
  rkClusterNP,
  jobeClusterSkill,
  type SkillSet,
  type ConstructionPlan,
  type ConstructionStep
} from '../utils/construction-analysis';
import { IMP_SLOTS, type ImpSlotName } from '../services/game-data';
import { isJobeCluster } from '../utils/cluster-utilities';

// ============================================================================
// Service State
// ============================================================================

interface ConstructionState {
  skills: SkillSet;
  selectedSlot: ImpSlotName | null;
  currentPlan: ConstructionPlan | null;
  isAnalyzing: boolean;
  lastError: string | null;
}

const state = reactive<ConstructionState>({
  skills: {
    'Nanoprogramming': 0,
    'Break & Entry': 0,
    'Psychology': 0,
    'Quantum FT': 0,
    'Computer Literacy': 0,
    'Pharma Tech': 0,
    'Weaponsmithing': 0
  },
  selectedSlot: null,
  currentPlan: null,
  isAnalyzing: false,
  lastError: null
});

// ============================================================================
// Computed Properties
// ============================================================================

const availableSlots = computed(() => {
  return IMP_SLOTS.map(slot => ({
    value: slot,
    label: slot
  }));
});

const hasValidSkills = computed(() => {
  return state.skills['Nanoprogramming'] > 0 && state.skills['Break & Entry'] > 0;
});

const canAnalyze = computed(() => {
  return state.selectedSlot !== null && hasValidSkills.value && !state.isAnalyzing;
});

// ============================================================================
// Core Service Functions
// ============================================================================

/**
 * Update character skills
 */
function updateSkills(newSkills: Partial<SkillSet>) {
  Object.assign(state.skills, newSkills);
  state.lastError = null;
  
  // Clear current plan if skills change significantly
  if (state.currentPlan && (newSkills['Nanoprogramming'] || newSkills['Break & Entry'])) {
    state.currentPlan = null;
  }
}

/**
 * Set the selected implant slot for analysis
 */
function setSelectedSlot(slot: ImpSlotName | null) {
  state.selectedSlot = slot;
  state.currentPlan = null; // Clear plan when slot changes
  state.lastError = null;
}

/**
 * Analyze construction for a specific implant configuration
 */
async function analyzeConstruction(
  slot: ImpSlotName,
  shinySkill: string,
  brightSkill: string,
  fadedSkill: string,
  targetQL: number
): Promise<ConstructionPlan | null> {
  if (!hasValidSkills.value) {
    state.lastError = 'Please enter your Nanoprogramming and Break & Entry skills';
    return null;
  }
  
  state.isAnalyzing = true;
  state.lastError = null;
  
  try {
    // Simulate analysis delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const plan = generateConstructionPlan(
      slot,
      shinySkill || 'Empty',
      brightSkill || 'Empty', 
      fadedSkill || 'Empty',
      targetQL,
      state.skills
    );
    
    state.currentPlan = plan;
    
    if (!plan.success && plan.error) {
      state.lastError = plan.error;
    }
    
    return plan;
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Construction analysis failed';
    state.lastError = errorMessage;
    state.currentPlan = null;
    return null;
  } finally {
    state.isAnalyzing = false;
  }
}

/**
 * Clear current analysis and reset state
 */
function clearAnalysis() {
  state.currentPlan = null;
  state.lastError = null;
  state.isAnalyzing = false;
}

/**
 * Reset all service state
 */
function reset() {
  state.skills = {
    'Nanoprogramming': 0,
    'Break & Entry': 0,
    'Psychology': 0,
    'Quantum FT': 0,
    'Computer Literacy': 0,
    'Pharma Tech': 0,
    'Weaponsmithing': 0
  };
  state.selectedSlot = null;
  state.currentPlan = null;
  state.isAnalyzing = false;
  state.lastError = null;
}

/**
 * Get construction feasibility for a given configuration
 */
function getConstructionFeasibility(
  shinySkill: string,
  brightSkill: string,
  fadedSkill: string,
  targetQL: number
): { feasible: boolean; reason?: string } {
  if (!hasValidSkills.value) {
    return { feasible: false, reason: 'Skill information required' };
  }

  const npSkill = state.skills['Nanoprogramming'] || 0;
  const beSkill = state.skills['Break & Entry'] || 0;

  // Calculate ACTUAL NP requirements for each cluster
  const requirements = [];

  if (shinySkill && shinySkill !== 'Empty') {
    const req = rkClusterNP(shinySkill, 'Shiny', targetQL);
    if (req > 0) requirements.push({ cluster: shinySkill, slot: 'Shiny', npReq: req });
  }

  if (brightSkill && brightSkill !== 'Empty') {
    const req = rkClusterNP(brightSkill, 'Bright', targetQL);
    if (req > 0) requirements.push({ cluster: brightSkill, slot: 'Bright', npReq: req });
  }

  if (fadedSkill && fadedSkill !== 'Empty') {
    const req = rkClusterNP(fadedSkill, 'Faded', targetQL);
    if (req > 0) requirements.push({ cluster: fadedSkill, slot: 'Faded', npReq: req });
  }

  // Find max NP requirement
  const maxNPReq = Math.max(...requirements.map(r => r.npReq), 0);

  if (maxNPReq > 0 && npSkill < maxNPReq) {
    return {
      feasible: false,
      reason: `Nanoprogramming too low (need ${maxNPReq}, have ${npSkill})`
    };
  }

  // B&E requirement for cleaning (if needed for QL bumping)
  const beReq = Math.round(targetQL * 4.75);
  if (targetQL > 50 && beSkill < beReq) {
    return {
      feasible: false,
      reason: `Break & Entry too low for QL bumping (need ${beReq}, have ${beSkill})`
    };
  }

  return { feasible: true };
}

/**
 * Get skill recommendations for a target QL
 */
function getSkillRecommendations(
  targetQL: number,
  shinySkill?: string,
  brightSkill?: string,
  fadedSkill?: string
): { skill: string; recommended: number; current: number }[] {
  const recommendations = [];

  // Calculate actual NP requirements based on clusters
  const npRequirements = [];

  if (shinySkill && shinySkill !== 'Empty') {
    const req = rkClusterNP(shinySkill, 'Shiny', targetQL);
    if (req > 0) npRequirements.push(req);
  }

  if (brightSkill && brightSkill !== 'Empty') {
    const req = rkClusterNP(brightSkill, 'Bright', targetQL);
    if (req > 0) npRequirements.push(req);
  }

  if (fadedSkill && fadedSkill !== 'Empty') {
    const req = rkClusterNP(fadedSkill, 'Faded', targetQL);
    if (req > 0) npRequirements.push(req);
  }

  // Recommend max NP requirement (or fallback to estimate if no clusters)
  const npRecommended = npRequirements.length > 0
    ? Math.max(...npRequirements)
    : Math.round(targetQL * 2.5); // Fallback for empty build

  recommendations.push({
    skill: 'Nanoprogramming',
    recommended: npRecommended,
    current: state.skills['Nanoprogramming'] || 0
  });

  // Break & Entry for QL bumping (game mechanic constant)
  if (targetQL > 50) {
    const beRecommended = Math.round(targetQL * 4.75);
    recommendations.push({
      skill: 'Break & Entry',
      recommended: beRecommended,
      current: state.skills['Break & Entry'] || 0
    });
  }

  return recommendations;
}

// ============================================================================
// Service Export
// ============================================================================

export const constructionPlannerService = {
  // State
  state: readonly(state),
  
  // Computed
  availableSlots,
  hasValidSkills,
  canAnalyze,
  
  // Methods
  updateSkills,
  setSelectedSlot,
  analyzeConstruction,
  clearAnalysis,
  reset,
  getConstructionFeasibility,
  getSkillRecommendations
};

// For TypeScript compatibility
function readonly<T>(obj: T): Readonly<T> {
  return obj as Readonly<T>;
}

export type { ConstructionPlan, ConstructionStep, SkillSet };
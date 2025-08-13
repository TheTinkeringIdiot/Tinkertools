/**
 * TinkerTools Construction Planner Service
 * 
 * High-level service for managing implant construction planning,
 * integrating construction analysis with UI state management.
 */

import { reactive, computed, ref } from 'vue';
import { 
  generateConstructionPlan,
  type SkillSet,
  type ConstructionPlan,
  type ConstructionStep
} from '../utils/construction-analysis';
import { IMP_SLOTS, type ImpSlotName } from '../services/game-data';

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
  
  // Quick feasibility check based on basic requirements
  const npSkill = state.skills['Nanoprogramming'] || 0;
  const beSkill = state.skills['Break & Entry'] || 0;
  
  // Basic NP requirement (rough estimate)
  const estimatedNPReq = Math.max(
    targetQL * 1.0, // Minimum reasonable requirement
    targetQL * 2.5  // Maximum for complex builds
  );
  
  if (npSkill < estimatedNPReq * 0.5) {
    return { 
      feasible: false, 
      reason: `Nanoprogramming skill may be too low (need ~${Math.round(estimatedNPReq * 0.5)}+)` 
    };
  }
  
  // QL bumping B&E requirement
  if (targetQL > 50 && beSkill < targetQL * 2) {
    return { 
      feasible: false, 
      reason: `Break & Entry skill too low for QL bumping (need ~${targetQL * 2}+)` 
    };
  }
  
  return { feasible: true };
}

/**
 * Get skill recommendations for a target QL
 */
function getSkillRecommendations(targetQL: number): { skill: string; recommended: number; current: number }[] {
  const recommendations = [];
  
  // Nanoprogramming recommendations
  const npRecommended = Math.round(targetQL * 2.5);
  recommendations.push({
    skill: 'Nanoprogramming',
    recommended: npRecommended,
    current: state.skills['Nanoprogramming'] || 0
  });
  
  // Break & Entry for QL bumping
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
/**
 * TinkerTools Construction Planner Composable
 *
 * Vue composable for integrating construction planning functionality
 * with reactive components and providing a clean interface for UI.
 */

import { computed, watch, ref } from 'vue';
import { constructionPlannerService } from '../services/construction-planner';
import type { ImpSlotName } from '../services/game-data';
import type { SkillSet, ConstructionPlan } from '../utils/construction-analysis';
import { skillService } from '../services/skill-service';

// ============================================================================
// Composable Interface
// ============================================================================

export interface ImplantConfig {
  shiny: string | null;
  bright: string | null;
  faded: string | null;
  ql: number;
}

export interface ImplantsData {
  [slotName: string]: ImplantConfig;
}

/**
 * Main construction planner composable
 */
export function useConstructionPlanner(implantData?: Ref<ImplantsData>) {
  // ============================================================================
  // Local State
  // ============================================================================

  const isAutoAnalyzing = ref(false);
  const selectedSlotForAnalysis = ref<ImpSlotName | null>(null);

  // ============================================================================
  // Service Integration
  // ============================================================================

  const {
    state,
    availableSlots,
    hasValidSkills,
    canAnalyze,
    updateSkills,
    setSelectedSlot,
    analyzeConstruction,
    clearAnalysis,
    reset,
    getConstructionFeasibility,
    getSkillRecommendations,
  } = constructionPlannerService;

  // ============================================================================
  // Computed Properties
  // ============================================================================

  const currentSkills = computed(() => state.skills);
  const currentPlan = computed(() => state.currentPlan);
  const isAnalyzing = computed(() => state.isAnalyzing);
  const lastError = computed(() => state.lastError);
  const selectedSlot = computed(() => state.selectedSlot);

  /**
   * Get implant configuration for the selected slot
   */
  const selectedImplantConfig = computed((): ImplantConfig | null => {
    if (!implantData?.value || !selectedSlot.value) {
      return null;
    }

    return implantData.value[selectedSlot.value] || null;
  });

  /**
   * Check if current implant configuration is valid for analysis
   */
  const hasValidImplantConfig = computed(() => {
    const config = selectedImplantConfig.value;
    if (!config) return false;

    return config.ql > 0 && (config.shiny || config.bright || config.faded);
  });

  /**
   * Get feasibility analysis for current configuration
   */
  const constructionFeasibility = computed(() => {
    const config = selectedImplantConfig.value;
    if (!config || !selectedSlot.value) {
      return { feasible: false, reason: 'No implant configuration selected' };
    }

    // Convert stat IDs to cluster names for getConstructionFeasibility
    const shinyName = config.shiny
      ? typeof config.shiny === 'number'
        ? skillService.getName(config.shiny)
        : config.shiny
      : 'Empty';
    const brightName = config.bright
      ? typeof config.bright === 'number'
        ? skillService.getName(config.bright)
        : config.bright
      : 'Empty';
    const fadedName = config.faded
      ? typeof config.faded === 'number'
        ? skillService.getName(config.faded)
        : config.faded
      : 'Empty';

    return getConstructionFeasibility(shinyName, brightName, fadedName, config.ql);
  });

  /**
   * Get skill recommendations for current target QL
   */
  const skillRecommendations = computed(() => {
    const config = selectedImplantConfig.value;
    if (!config) return [];

    // Convert stat IDs to names (same pattern as analyzeSelectedImplant)
    const shinyName = config.shiny
      ? typeof config.shiny === 'number'
        ? skillService.getName(config.shiny)
        : config.shiny
      : 'Empty';
    const brightName = config.bright
      ? typeof config.bright === 'number'
        ? skillService.getName(config.bright)
        : config.bright
      : 'Empty';
    const fadedName = config.faded
      ? typeof config.faded === 'number'
        ? skillService.getName(config.faded)
        : config.faded
      : 'Empty';

    return getSkillRecommendations(config.ql, shinyName, brightName, fadedName);
  });

  /**
   * Check if auto-analysis should run
   */
  const shouldAutoAnalyze = computed(() => {
    return (
      isAutoAnalyzing.value &&
      hasValidSkills.value &&
      hasValidImplantConfig.value &&
      !isAnalyzing.value
    );
  });

  // ============================================================================
  // Methods
  // ============================================================================

  /**
   * Analyze construction for the selected implant
   */
  async function analyzeSelectedImplant(): Promise<ConstructionPlan | null> {
    const config = selectedImplantConfig.value;
    const slot = selectedSlot.value;

    if (!config || !slot) {
      return null;
    }

    // Convert stat IDs to cluster names for analyzeConstruction
    const shinyName = config.shiny
      ? typeof config.shiny === 'number'
        ? skillService.getName(config.shiny)
        : config.shiny
      : 'Empty';
    const brightName = config.bright
      ? typeof config.bright === 'number'
        ? skillService.getName(config.bright)
        : config.bright
      : 'Empty';
    const fadedName = config.faded
      ? typeof config.faded === 'number'
        ? skillService.getName(config.faded)
        : config.faded
      : 'Empty';

    return await analyzeConstruction(slot, shinyName, brightName, fadedName, config.ql);
  }

  /**
   * Set skills with validation
   */
  function setSkills(skills: Partial<SkillSet>) {
    // Validate skill values
    const validatedSkills: Partial<SkillSet> = {};

    Object.entries(skills).forEach(([skill, value]) => {
      if (typeof value === 'number' && value >= 0 && value <= 9999) {
        validatedSkills[skill] = Math.floor(value);
      }
    });

    updateSkills(validatedSkills);
  }

  /**
   * Select slot and optionally analyze immediately
   */
  async function selectSlotForAnalysis(slot: ImpSlotName | null, analyze = false) {
    selectedSlotForAnalysis.value = slot;
    setSelectedSlot(slot);

    if (analyze && slot && hasValidSkills.value) {
      await analyzeSelectedImplant();
    }
  }

  /**
   * Toggle auto-analysis mode
   */
  function setAutoAnalysis(enabled: boolean) {
    isAutoAnalyzing.value = enabled;

    if (enabled && shouldAutoAnalyze.value) {
      analyzeSelectedImplant();
    }
  }

  /**
   * Quick analysis for any implant configuration
   */
  async function quickAnalyze(
    slot: ImpSlotName,
    config: ImplantConfig
  ): Promise<ConstructionPlan | null> {
    // Convert stat IDs to cluster names for analyzeConstruction
    const shinyName = config.shiny
      ? typeof config.shiny === 'number'
        ? skillService.getName(config.shiny)
        : config.shiny
      : 'Empty';
    const brightName = config.bright
      ? typeof config.bright === 'number'
        ? skillService.getName(config.bright)
        : config.bright
      : 'Empty';
    const fadedName = config.faded
      ? typeof config.faded === 'number'
        ? skillService.getName(config.faded)
        : config.faded
      : 'Empty';

    return await analyzeConstruction(slot, shinyName, brightName, fadedName, config.ql);
  }

  // ============================================================================
  // Watchers
  // ============================================================================

  // Auto-analyze when configuration changes
  watch(
    [selectedImplantConfig, currentSkills, shouldAutoAnalyze],
    async () => {
      if (shouldAutoAnalyze.value) {
        await analyzeSelectedImplant();
      }
    },
    { deep: true }
  );

  // ============================================================================
  // Return Interface
  // ============================================================================

  return {
    // State
    currentSkills: readonly(currentSkills),
    currentPlan: readonly(currentPlan),
    selectedSlot: readonly(selectedSlot),
    selectedImplantConfig: readonly(selectedImplantConfig),
    isAnalyzing: readonly(isAnalyzing),
    lastError: readonly(lastError),
    isAutoAnalyzing: readonly(isAutoAnalyzing),

    // Computed
    availableSlots: readonly(availableSlots),
    hasValidSkills: readonly(hasValidSkills),
    hasValidImplantConfig: readonly(hasValidImplantConfig),
    canAnalyze: readonly(canAnalyze),
    constructionFeasibility: readonly(constructionFeasibility),
    skillRecommendations: readonly(skillRecommendations),
    shouldAutoAnalyze: readonly(shouldAutoAnalyze),

    // Methods
    setSkills,
    selectSlotForAnalysis,
    analyzeSelectedImplant,
    quickAnalyze,
    setAutoAnalysis,
    clearAnalysis,
    reset,
  };
}

/**
 * Construction summary composable for displaying results
 */
export function useConstructionSummary(plan: Ref<ConstructionPlan | null>) {
  const hasBasicSteps = computed(() => plan.value?.basic_steps?.length > 0);
  const hasFTSteps = computed(() => plan.value?.ft_steps?.length > 0);
  const isSuccessful = computed(() => plan.value?.success === true);
  const hasError = computed(() => Boolean(plan.value?.error));

  const basicStepsCount = computed(() => plan.value?.basic_steps?.length || 0);
  const ftStepsCount = computed(() => plan.value?.ft_steps?.length || 0);

  const stepsDifference = computed(() => {
    if (!hasBasicSteps.value || !hasFTSteps.value) return 0;
    return basicStepsCount.value - ftStepsCount.value;
  });

  const recommendedPath = computed(() => {
    if (!hasBasicSteps.value && !hasFTSteps.value) return null;
    if (!hasFTSteps.value) return 'basic';
    if (!hasBasicSteps.value) return 'ft';

    // Recommend FT if it has fewer steps
    return ftStepsCount.value < basicStepsCount.value ? 'ft' : 'basic';
  });

  return {
    hasBasicSteps: readonly(hasBasicSteps),
    hasFTSteps: readonly(hasFTSteps),
    isSuccessful: readonly(isSuccessful),
    hasError: readonly(hasError),
    basicStepsCount: readonly(basicStepsCount),
    ftStepsCount: readonly(ftStepsCount),
    stepsDifference: readonly(stepsDifference),
    recommendedPath: readonly(recommendedPath),
  };
}

// Utility types for export
export type { ImplantConfig, ImplantsData };

// Helper for readonly refs
function readonly<T>(ref: any): Readonly<Ref<T>> {
  return ref;
}

// Type imports for Ref
import type { Ref } from 'vue';

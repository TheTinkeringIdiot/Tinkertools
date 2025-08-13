<!--
TinkerPlants Construction Steps Component
Displays step-by-step construction analysis results with basic and field tinkering paths
-->
<template>
  <div class="construction-steps space-y-6">
    <!-- Construction Plan Header -->
    <div class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4 flex items-center gap-2">
        <i class="pi pi-list text-primary-500"></i>
        Construction Plan: {{ selectedSlot }}
      </h3>
      
      <!-- Plan Summary -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div class="text-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
          <div class="text-sm text-surface-600 dark:text-surface-400">Basic Steps</div>
          <div class="text-lg font-bold text-surface-900 dark:text-surface-50">
            {{ basicStepsCount }}
          </div>
        </div>
        <div class="text-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
          <div class="text-sm text-surface-600 dark:text-surface-400">Field Tinkering Steps</div>
          <div class="text-lg font-bold text-surface-900 dark:text-surface-50">
            {{ ftStepsCount }}
          </div>
        </div>
        <div class="text-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
          <div class="text-sm text-surface-600 dark:text-surface-400">Recommended Path</div>
          <div class="text-lg font-bold" :class="recommendedPathClass">
            {{ recommendedPathText }}
          </div>
        </div>
      </div>
      
      <!-- Path Comparison -->
      <div v-if="stepsDifference > 0" class="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
        <i class="pi pi-info-circle"></i>
        <span>Field Tinkering saves {{ stepsDifference }} step{{ stepsDifference === 1 ? '' : 's' }}</span>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="hasError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-6">
      <div class="flex items-start gap-3">
        <i class="pi pi-exclamation-triangle text-red-600 dark:text-red-400 mt-0.5"></i>
        <div>
          <h4 class="font-medium text-red-900 dark:text-red-100 mb-2">Construction Failed</h4>
          <p class="text-sm text-red-700 dark:text-red-300">{{ plan.error }}</p>
        </div>
      </div>
    </div>

    <!-- Success - Show Construction Paths -->
    <div v-else-if="isSuccessful" class="space-y-6">
      <!-- Basic Construction Path -->
      <div v-if="hasBasicSteps" class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
        <div class="bg-surface-100 dark:bg-surface-800 px-6 py-4 border-b border-surface-200 dark:border-surface-700">
          <h4 class="font-semibold text-surface-900 dark:text-surface-50 flex items-center gap-2">
            <i class="pi pi-wrench text-orange-500"></i>
            Basic Construction Path
            <Badge v-if="recommendedPath === 'basic'" value="Recommended" severity="success" />
          </h4>
        </div>
        <div class="p-6">
          <div class="space-y-3">
            <div 
              v-for="(step, index) in plan.basic_steps" 
              :key="`basic-${index}`"
              class="flex items-start gap-4 p-4 bg-surface-50 dark:bg-surface-900 rounded-lg"
            >
              <div class="flex-shrink-0 w-8 h-8 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center text-sm font-medium">
                {{ index + 1 }}
              </div>
              <div class="flex-1">
                <div class="text-sm font-medium text-surface-900 dark:text-surface-50 mb-1">
                  {{ step.step }}
                </div>
                <div v-if="step.description !== step.step" class="text-xs text-surface-600 dark:text-surface-400">
                  {{ step.description }}
                </div>
                <!-- Skill Requirements -->
                <div v-if="step.requirements?.length" class="mt-2 flex flex-wrap gap-2">
                  <div 
                    v-for="req in step.requirements" 
                    :key="req.skill"
                    class="inline-flex items-center gap-1 px-2 py-1 bg-surface-100 dark:bg-surface-800 rounded text-xs"
                  >
                    <span class="text-surface-600 dark:text-surface-400">{{ req.skill }}:</span>
                    <span class="font-mono text-surface-900 dark:text-surface-50">{{ req.value }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Field Tinkering Construction Path -->
      <div v-if="hasFTSteps" class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
        <div class="bg-surface-100 dark:bg-surface-800 px-6 py-4 border-b border-surface-200 dark:border-surface-700">
          <h4 class="font-semibold text-surface-900 dark:text-surface-50 flex items-center gap-2">
            <i class="pi pi-cog text-blue-500"></i>
            Field Tinkering Path
            <Badge v-if="recommendedPath === 'ft'" value="Recommended" severity="success" />
            <Badge v-if="ftStepsCount < basicStepsCount" value="Shorter" severity="info" />
          </h4>
        </div>
        <div class="p-6">
          <div class="space-y-3">
            <div 
              v-for="(step, index) in plan.ft_steps" 
              :key="`ft-${index}`"
              class="flex items-start gap-4 p-4 bg-surface-50 dark:bg-surface-900 rounded-lg"
            >
              <div class="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-medium">
                {{ index + 1 }}
              </div>
              <div class="flex-1">
                <div class="text-sm font-medium text-surface-900 dark:text-surface-50 mb-1">
                  {{ step.step }}
                </div>
                <div v-if="step.description !== step.step" class="text-xs text-surface-600 dark:text-surface-400">
                  {{ step.description }}
                </div>
                <!-- Skill Requirements -->
                <div v-if="step.requirements?.length" class="mt-2 flex flex-wrap gap-2">
                  <div 
                    v-for="req in step.requirements" 
                    :key="req.skill"
                    class="inline-flex items-center gap-1 px-2 py-1 bg-surface-100 dark:bg-surface-800 rounded text-xs"
                  >
                    <span class="text-surface-600 dark:text-surface-400">{{ req.skill }}:</span>
                    <span class="font-mono text-surface-900 dark:text-surface-50">{{ req.value }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Skills Summary -->
      <div class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-6">
        <h4 class="font-semibold text-surface-900 dark:text-surface-50 mb-4 flex items-center gap-2">
          <i class="pi pi-user text-green-500"></i>
          Your Skills
        </h4>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div 
            v-for="(value, skill) in skills" 
            :key="skill"
            class="text-center p-3 bg-surface-50 dark:bg-surface-900 rounded"
          >
            <div class="text-xs text-surface-600 dark:text-surface-400 mb-1">{{ skill }}</div>
            <div class="font-mono text-sm font-medium text-surface-900 dark:text-surface-50">{{ value }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Valid Construction -->
    <div v-else class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-6">
      <div class="flex items-start gap-3">
        <i class="pi pi-exclamation-triangle text-yellow-600 dark:text-yellow-400 mt-0.5"></i>
        <div>
          <h4 class="font-medium text-yellow-900 dark:text-yellow-100 mb-2">No Construction Plan Available</h4>
          <p class="text-sm text-yellow-700 dark:text-yellow-300">
            Unable to generate a construction plan for this configuration. Check your skill levels and implant selections.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useConstructionSummary } from '@/composables/useConstructionPlanner';
import Badge from 'primevue/badge';
import type { ConstructionPlan, SkillSet } from '@/utils/construction-analysis';

// ============================================================================
// Props
// ============================================================================

interface Props {
  plan: ConstructionPlan;
  selectedSlot: string;
  skills: SkillSet;
}

const props = defineProps<Props>();

// ============================================================================
// Construction Summary Integration
// ============================================================================

const planRef = computed(() => props.plan);

const {
  hasBasicSteps,
  hasFTSteps,
  isSuccessful,
  hasError,
  basicStepsCount,
  ftStepsCount,
  stepsDifference,
  recommendedPath
} = useConstructionSummary(planRef);

// ============================================================================
// Computed Properties
// ============================================================================

const recommendedPathText = computed(() => {
  if (!recommendedPath.value) return 'None';
  return recommendedPath.value === 'basic' ? 'Basic' : 'Field Tinkering';
});

const recommendedPathClass = computed(() => {
  if (!recommendedPath.value) return 'text-surface-600 dark:text-surface-400';
  return recommendedPath.value === 'ft' 
    ? 'text-blue-600 dark:text-blue-400' 
    : 'text-orange-600 dark:text-orange-400';
});
</script>

<style scoped>
/* Component-specific styles */
.construction-steps {
  max-width: 100%;
}

/* Step number styling */
.construction-steps .step-number {
  min-width: 2rem;
  min-height: 2rem;
}

/* Badge positioning adjustments */
:deep(.p-badge) {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

/* Skill requirement tags */
.skill-requirement {
  white-space: nowrap;
}

/* Responsive grid adjustments */
@media (max-width: 768px) {
  .construction-steps .grid {
    grid-template-columns: 1fr;
  }
}
</style>
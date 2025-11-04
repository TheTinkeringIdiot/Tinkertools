<!--
PerkPointsTracker - Display perk points with visual indicators
Shows SL and AI point totals with progress bars and visual feedback
-->
<template>
  <div class="perk-points-tracker space-y-4">
    <!-- SL Perk Points -->
    <div
      class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-4"
    >
      <div class="flex items-center justify-between mb-3">
        <h3
          class="text-lg font-semibold text-surface-900 dark:text-surface-50 flex items-center gap-2"
        >
          <i class="pi pi-star text-primary-500" aria-hidden="true"></i>
          Standard Perks
        </h3>
        <div class="text-lg font-bold" :class="standardPointsColor">
          {{ standardPointsUsed }}/{{ maxStandardPoints }} Points
        </div>
      </div>

      <!-- Standard Points Progress Bar -->
      <div class="relative">
        <ProgressBar
          :value="standardPointsPercentage"
          :show-value="false"
          :class="['h-6', standardPointsProgressClass]"
          :aria-label="`Standard perk points: ${standardPointsUsed} of ${maxStandardPoints} used`"
        />
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-sm font-medium text-surface-50 mix-blend-difference">
            {{ standardPointsUsed }}/{{ maxStandardPoints }}
          </span>
        </div>
      </div>

      <!-- Standard Points Details -->
      <div class="mt-2 text-sm text-surface-600 dark:text-surface-400">
        <div v-if="standardPointsFormula" class="mb-1">
          {{ standardPointsFormula }}
        </div>
        <div v-if="standardPointsRemaining > 0" class="text-green-600 dark:text-green-400">
          {{ standardPointsRemaining }} points available
        </div>
        <div v-else-if="standardPointsRemaining === 0" class="text-yellow-600 dark:text-yellow-400">
          All points allocated
        </div>
        <div v-else class="text-red-600 dark:text-red-400">
          Over budget by {{ Math.abs(standardPointsRemaining) }} points
        </div>
      </div>
    </div>

    <!-- AI Perk Points -->
    <div
      class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-4"
    >
      <div class="flex items-center justify-between mb-3">
        <h3
          class="text-lg font-semibold text-surface-900 dark:text-surface-50 flex items-center gap-2"
        >
          <i class="pi pi-bolt text-cyan-500" aria-hidden="true"></i>
          AI Perks
        </h3>
        <div class="text-lg font-bold" :class="aiPointsColor">
          {{ aiPointsUsed }}/{{ maxAIPoints }} Points
        </div>
      </div>

      <!-- AI Points Progress Bar -->
      <div class="relative">
        <ProgressBar
          :value="aiPointsPercentage"
          :show-value="false"
          :class="['h-6', aiPointsProgressClass]"
          :aria-label="`AI perk points: ${aiPointsUsed} of ${maxAIPoints} used`"
        />
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-sm font-medium text-surface-50 mix-blend-difference">
            {{ aiPointsUsed }}/{{ maxAIPoints }}
          </span>
        </div>
      </div>

      <!-- AI Points Details -->
      <div class="mt-2 text-sm text-surface-600 dark:text-surface-400">
        <div v-if="aiPointsFormula" class="mb-1">
          {{ aiPointsFormula }}
        </div>
        <div v-if="aiPointsRemaining > 0" class="text-green-600 dark:text-green-400">
          {{ aiPointsRemaining }} points available
        </div>
        <div v-else-if="aiPointsRemaining === 0" class="text-yellow-600 dark:text-yellow-400">
          All points allocated
        </div>
        <div v-else class="text-red-600 dark:text-red-400">
          Over budget by {{ Math.abs(aiPointsRemaining) }} points
        </div>
        <div v-if="!hasAILevel" class="text-orange-600 dark:text-orange-400 mt-1">
          Requires AI levels to earn AI perk points
        </div>
      </div>
    </div>

    <!-- LE Research Status -->
    <div
      class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-4"
    >
      <div class="flex items-center justify-between mb-3">
        <h3
          class="text-lg font-semibold text-surface-900 dark:text-surface-50 flex items-center gap-2"
        >
          <i class="pi pi-book text-purple-500" aria-hidden="true"></i>
          LE Research
        </h3>
        <div class="text-lg font-bold text-purple-600 dark:text-purple-400">
          {{ researchCount }} Active
        </div>
      </div>

      <div class="text-sm text-surface-600 dark:text-surface-400">
        <div v-if="researchCount === 0">No research perks assigned</div>
        <div v-else-if="researchCount === 1">1 research perk assigned</div>
        <div v-else>{{ researchCount }} research perks assigned</div>
        <div class="text-green-600 dark:text-green-400 mt-1">
          Research perks are free (no point cost)
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ProgressBar from 'primevue/progressbar';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import { calculatePerkPointsDetailed } from '@/services/perk-calculator';
import type { PerkCharacterData } from '@/lib/tinkerprofiles/perk-types';

// Props
const props = defineProps<{
  profile: TinkerProfile;
}>();

// Character data for calculations
const characterData = computed(
  (): PerkCharacterData => ({
    level: props.profile.Character?.Level || 1,
    alienLevel: props.profile.Character?.AlienLevel || 0,
    profession: props.profile.Character?.Profession || 'Adventurer',
    breed: props.profile.Character?.Breed || 'Solitus',
    expansion: 'SL', // Default expansion
  })
);

// Point calculations
const pointCalculation = computed(() => {
  return calculatePerkPointsDetailed(characterData.value);
});

// Standard perk points
const maxStandardPoints = computed(() => pointCalculation.value.standardPoints.total);
const standardPointsFormula = computed(() => pointCalculation.value.standardPoints.formula);
const standardPointsUsed = computed(() => {
  const perkSystem = props.profile.PerksAndResearch as any;
  if (!perkSystem || typeof perkSystem !== 'object' || !perkSystem.standardPerkPoints) {
    return 0;
  }
  return perkSystem.standardPerkPoints.spent || 0;
});
const standardPointsRemaining = computed(() => maxStandardPoints.value - standardPointsUsed.value);
const standardPointsPercentage = computed(() => {
  if (maxStandardPoints.value === 0) return 0;
  return Math.min((standardPointsUsed.value / maxStandardPoints.value) * 100, 100);
});

// AI perk points
const maxAIPoints = computed(() => pointCalculation.value.aiPoints.total);
const aiPointsFormula = computed(() => pointCalculation.value.aiPoints.formula);
const aiPointsUsed = computed(() => {
  const perkSystem = props.profile.PerksAndResearch as any;
  if (!perkSystem || typeof perkSystem !== 'object' || !perkSystem.aiPerkPoints) {
    return 0;
  }
  return perkSystem.aiPerkPoints.spent || 0;
});
const aiPointsRemaining = computed(() => maxAIPoints.value - aiPointsUsed.value);
const aiPointsPercentage = computed(() => {
  if (maxAIPoints.value === 0) return 0;
  return Math.min((aiPointsUsed.value / maxAIPoints.value) * 100, 100);
});
const hasAILevel = computed(() => characterData.value.alienLevel > 0);

// Research count
const researchCount = computed(() => {
  const perkSystem = props.profile.PerksAndResearch as any;
  if (!perkSystem || typeof perkSystem !== 'object' || !Array.isArray(perkSystem.research)) {
    return 0;
  }
  return perkSystem.research.length;
});

// Color classes based on usage
const standardPointsColor = computed(() => {
  if (standardPointsRemaining.value > 0) return 'text-green-600 dark:text-green-400';
  if (standardPointsRemaining.value === 0) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
});

const aiPointsColor = computed(() => {
  if (aiPointsRemaining.value > 0) return 'text-green-600 dark:text-green-400';
  if (aiPointsRemaining.value === 0) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
});

// Progress bar color classes
const standardPointsProgressClass = computed(() => {
  if (standardPointsRemaining.value > 0) return '';
  if (standardPointsRemaining.value === 0) return 'progress-warning';
  return 'progress-danger';
});

const aiPointsProgressClass = computed(() => {
  if (aiPointsRemaining.value > 0) return 'progress-cyan';
  if (aiPointsRemaining.value === 0) return 'progress-warning';
  return 'progress-danger';
});
</script>

<style scoped>
/* Custom progress bar colors */
.perk-points-tracker :deep(.progress-cyan .p-progressbar-value) {
  background: linear-gradient(to right, #0891b2, #06b6d4);
}

.perk-points-tracker :deep(.progress-warning .p-progressbar-value) {
  background: linear-gradient(to right, #d97706, #f59e0b);
}

.perk-points-tracker :deep(.progress-danger .p-progressbar-value) {
  background: linear-gradient(to right, #dc2626, #ef4444);
}

/* Text contrast for progress bar labels */
.mix-blend-difference {
  mix-blend-mode: difference;
}
</style>

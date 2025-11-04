<!--
PerkPointsSummary - Compact horizontal display of perk point usage
Shows point allocation for SL, AI, and LE perks in a space-efficient format
-->
<template>
  <div class="perk-points-summary">
    <div
      class="flex flex-wrap items-center gap-4 p-3 bg-surface-50 dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700"
    >
      <!-- SL Points -->
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <i class="pi pi-star text-primary-500" aria-hidden="true"></i>
          <span class="font-semibold text-sm">SL Points:</span>
        </div>
        <div class="flex items-center gap-2">
          <ProgressBar
            :value="slPercentage"
            :showValue="false"
            class="w-24 h-2"
            :pt="{
              value: {
                style: {
                  background: slPercentage > 100 ? 'var(--red-500)' : 'var(--primary-500)',
                },
              },
            }"
          />
          <span
            class="text-sm font-medium"
            :class="slPointsUsed > maxSLPoints ? 'text-red-600 dark:text-red-400' : ''"
          >
            {{ slPointsUsed }}/{{ maxSLPoints }}
          </span>
        </div>
      </div>

      <!-- AI Points -->
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <i class="pi pi-bolt text-cyan-500" aria-hidden="true"></i>
          <span class="font-semibold text-sm">AI Points:</span>
        </div>
        <div class="flex items-center gap-2">
          <ProgressBar
            :value="aiPercentage"
            :showValue="false"
            class="w-24 h-2"
            :pt="{
              value: {
                style: {
                  background: aiPercentage > 100 ? 'var(--red-500)' : 'var(--cyan-500)',
                },
              },
            }"
          />
          <span
            class="text-sm font-medium"
            :class="aiPointsUsed > maxAIPoints ? 'text-red-600 dark:text-red-400' : ''"
          >
            {{ aiPointsUsed }}/{{ maxAIPoints }}
          </span>
        </div>
      </div>

      <!-- LE Research -->
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <i class="pi pi-book text-purple-500" aria-hidden="true"></i>
          <span class="font-semibold text-sm">LE Research:</span>
        </div>
        <Badge :value="`${researchCount} active`" severity="info" class="text-xs" />
      </div>

      <!-- Spacer -->
      <div class="flex-grow"></div>

      <!-- Character Level Info -->
      <div class="text-xs text-surface-500 dark:text-surface-400">
        <span>Level {{ characterLevel }}</span>
        <span v-if="alienLevel > 0" class="ml-2">• AI {{ alienLevel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ProgressBar from 'primevue/progressbar';
import Badge from 'primevue/badge';

// Props
const props = defineProps<{
  slPointsUsed: number;
  maxSLPoints: number;
  aiPointsUsed: number;
  maxAIPoints: number;
  researchCount: number;
  characterLevel: number;
  alienLevel: number;
}>();

// Computed percentages for progress bars
const slPercentage = computed(() => {
  if (props.maxSLPoints === 0) return 0;
  return Math.round((props.slPointsUsed / props.maxSLPoints) * 100);
});

const aiPercentage = computed(() => {
  if (props.maxAIPoints === 0) return 0;
  return Math.round((props.aiPointsUsed / props.maxAIPoints) * 100);
});
</script>

<style scoped>
.perk-points-summary {
  margin-bottom: 1rem;
}

/* Ensure progress bars have consistent styling */
.perk-points-summary :deep(.p-progressbar) {
  background: var(--surface-200);
}

.dark .perk-points-summary :deep(.p-progressbar) {
  background: var(--surface-700);
}

/* Mobile responsiveness */
@media (max-width: 640px) {
  .perk-points-summary .flex {
    flex-direction: column;
    align-items: stretch;
  }

  .perk-points-summary .flex > div {
    width: 100%;
    justify-content: space-between;
    padding: 0.25rem 0;
  }

  .perk-points-summary .flex-grow {
    display: none;
  }
}
</style>

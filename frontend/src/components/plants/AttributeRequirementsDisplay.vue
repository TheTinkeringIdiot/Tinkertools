<template>
  <div class="space-y-3">
    <!-- Attribute requirement cards -->
    <div
      v-for="req in requirements"
      :key="req.stat"
      :class="[
        'flex items-center justify-between p-4 rounded-lg border-2',
        req.sufficient
          ? 'border-green-500 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900'
          : 'border-red-500 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950 dark:to-red-900',
      ]"
    >
      <!-- Left: Stat name and values -->
      <div class="flex-1">
        <div class="text-sm text-surface-600 dark:text-surface-400 mb-1">
          {{ req.statName }}
        </div>
        <div class="flex items-center gap-4">
          <div>
            <span class="text-xs text-surface-500 dark:text-surface-400">Required:</span>
            <span class="text-surface-900 dark:text-surface-50 font-bold text-lg font-mono ml-1">
              {{ req.required.toLocaleString() }}
            </span>
          </div>
          <div>
            <span class="text-xs text-surface-500 dark:text-surface-400">Current:</span>
            <span class="text-surface-900 dark:text-surface-50 font-bold text-lg font-mono ml-1">
              {{ req.current.toLocaleString() }}
            </span>
          </div>
        </div>
      </div>

      <!-- Right: Status tag -->
      <div>
        <Tag v-if="req.sufficient" severity="success" :value="`✓ Met`" rounded />
        <Tag v-else severity="danger" :value="`Need +${req.delta.toLocaleString()}`" rounded />
      </div>
    </div>

    <!-- Empty state (if no requirements) -->
    <div
      v-if="requirements.length === 0"
      class="text-center text-surface-500 dark:text-surface-400 py-8"
    >
      No attribute requirements
    </div>
  </div>
</template>

<script setup lang="ts">
import { type AttributeRequirementInfo } from '@/types/api';
import Tag from 'primevue/tag';

// ============================================================================
// Props
// ============================================================================

interface Props {
  /** Array of attribute requirements to display */
  requirements: AttributeRequirementInfo[];
}

const props = defineProps<Props>();
</script>

<style scoped>
/* ============================================================================
 * Attribute Requirements Display Component Styles
 * ============================================================================ */

/* Enhanced tag styling for success and danger states */
:deep(.p-tag) {
  @apply rounded-full;
  @apply font-semibold;
  @apply text-sm;
  @apply tracking-wide;
  @apply shadow-sm;
}

:deep(.p-tag.p-tag-success) {
  background: linear-gradient(135deg, #059669, #10b981);
  border-color: #059669;
  @apply text-white;
}

:deep(.p-tag.p-tag-danger) {
  background: linear-gradient(135deg, #dc2626, #ef4444);
  border-color: #dc2626;
  @apply text-white;
}

/* Smooth transitions for dynamic updates */
:deep(.p-tag) {
  @apply transition-all duration-300;
}
</style>

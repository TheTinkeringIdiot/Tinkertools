<template>
  <div class="treatment-display" role="status" :aria-label="accessibilityLabel">
    <div class="treatment-content">
      <!-- Treatment Required (always shown) -->
      <div class="treatment-item">
        <span class="treatment-label">Treatment Required:</span>
        <span class="treatment-value">{{ formatValue(treatmentRequired) }}</span>
      </div>

      <!-- Profile comparison section (only if profile exists) -->
      <template v-if="profileTreatment !== undefined">
        <!-- Divider -->
        <span class="treatment-divider" aria-hidden="true">|</span>

        <!-- Your Treatment -->
        <div class="treatment-item">
          <span class="treatment-label">Your Treatment:</span>
          <span class="treatment-value">{{ formatValue(profileTreatment) }}</span>
        </div>

        <!-- Divider -->
        <span class="treatment-divider" aria-hidden="true">|</span>

        <!-- Need/Surplus with Tag -->
        <div class="treatment-item">
          <span class="treatment-label">{{ needLabel }}:</span>
          <Tag :value="deltaText" :severity="tagSeverity" :icon="tagIcon" class="treatment-tag" />
        </div>
      </template>

      <!-- No profile message -->
      <template v-else>
        <span class="treatment-divider" aria-hidden="true">|</span>
        <span class="text-surface-500 italic text-sm">(Select a profile to compare)</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Tag from 'primevue/tag';

// ============================================================================
// Props
// ============================================================================

interface Props {
  /** Treatment required by the highest QL implant */
  treatmentRequired: number;
  /** Current profile treatment skill value (undefined when no profile selected) */
  profileTreatment: number | undefined;
  /** Difference between required and profile (positive = need more) */
  delta: number | undefined;
  /** Whether profile treatment is sufficient */
  sufficient: boolean | undefined;
}

const props = defineProps<Props>();

// ============================================================================
// Computed Properties
// ============================================================================

/**
 * Format number value with comma separators
 */
const formatValue = (value: number | undefined): string => {
  if (value === undefined) return 'N/A';
  return Math.round(value).toLocaleString();
};

/**
 * Text for the delta display
 */
const deltaText = computed((): string => {
  if (props.delta === undefined) return 'N/A';

  const absDelta = Math.abs(props.delta);
  const formattedDelta = formatValue(absDelta);

  if (props.delta > 0) {
    // Need more treatment
    return `+${formattedDelta}`;
  } else if (props.delta < 0) {
    // Have surplus treatment
    return `-${formattedDelta}`;
  } else {
    // Exact match
    return 'Exact Match';
  }
});

/**
 * Label for the need/surplus section
 */
const needLabel = computed((): string => {
  if (props.delta === undefined) return 'Status';

  if (props.delta > 0) {
    return 'Need';
  } else if (props.delta < 0) {
    return 'Surplus';
  } else {
    return 'Status';
  }
});

/**
 * PrimeVue Tag severity based on sufficient status
 */
const tagSeverity = computed((): 'success' | 'danger' | 'secondary' => {
  if (props.sufficient === undefined) return 'secondary';
  return props.sufficient ? 'success' : 'danger';
});

/**
 * Icon for the Tag component
 */
const tagIcon = computed((): string | undefined => {
  if (props.sufficient === undefined) return undefined;
  return props.sufficient ? 'pi pi-check' : 'pi pi-exclamation-triangle';
});

/**
 * Accessibility label for screen readers
 */
const accessibilityLabel = computed((): string => {
  if (props.profileTreatment === undefined || props.sufficient === undefined) {
    return `Treatment required: ${props.treatmentRequired}. No profile selected for comparison.`;
  }

  if (props.sufficient) {
    return `Treatment requirement met. Required: ${props.treatmentRequired}, Your treatment: ${props.profileTreatment}`;
  } else {
    return `Treatment requirement not met. Required: ${props.treatmentRequired}, Your treatment: ${props.profileTreatment}, Need: ${Math.abs(props.delta!)} more`;
  }
});
</script>

<style scoped>
/* ============================================================================
 * Treatment Display Component Styles
 * ============================================================================ */

.treatment-display {
  @apply bg-surface-0 dark:bg-surface-900 border-2 rounded-lg shadow-md;
  @apply px-6 py-4;
  @apply transition-all duration-200;

  /* Neutral border when no profile selected */
  @apply border-surface-300 dark:border-surface-700;
}

/* Red border when treatment insufficient */
.treatment-display:has(.treatment-tag.p-tag-danger) {
  @apply border-red-500 dark:border-red-600;
}

/* Green border when treatment sufficient */
.treatment-display:has(.treatment-tag.p-tag-success) {
  @apply border-green-500 dark:border-green-600;
}

.treatment-content {
  @apply flex items-center justify-center gap-4 flex-wrap;
  @apply text-lg font-semibold;
}

.treatment-item {
  @apply flex items-center gap-2;
}

.treatment-label {
  @apply text-surface-600 dark:text-surface-400;
  @apply font-medium;
}

.treatment-value {
  @apply text-surface-900 dark:text-surface-50;
  @apply font-bold text-xl;
  @apply font-mono;
}

.treatment-divider {
  @apply text-surface-400 dark:text-surface-600;
  @apply text-2xl font-light;
}

/* Tag component customization */
.treatment-tag {
  @apply font-bold text-base;
  @apply px-4 py-1;
  @apply font-mono;
}

:deep(.treatment-tag .p-tag-icon) {
  @apply mr-2;
}

/* Responsive layout for mobile */
@media (max-width: 768px) {
  .treatment-display {
    @apply px-4 py-3;
  }

  .treatment-content {
    @apply flex-col gap-2;
    @apply text-base;
  }

  .treatment-value {
    @apply text-lg;
  }

  .treatment-divider {
    @apply hidden;
  }

  .treatment-item {
    @apply w-full justify-between;
    @apply border-b border-surface-200 dark:border-surface-700;
    @apply pb-2;
  }

  .treatment-item:last-child {
    @apply border-b-0 pb-0;
  }

  .treatment-tag {
    @apply text-sm px-3;
  }
}

/* Enhanced tag styling within this component */
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

/* Focus states for accessibility */
.treatment-display:focus-within {
  @apply ring-2 ring-primary-500 ring-offset-2;
}

/* Animation for dynamic updates */
.treatment-value,
.treatment-tag {
  @apply transition-all duration-300;
}

/* Hover effect for the entire display */
.treatment-display:hover {
  @apply shadow-lg;
  transform: translateY(-1px);
}
</style>

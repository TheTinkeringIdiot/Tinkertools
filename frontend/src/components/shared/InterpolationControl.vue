<template>
  <div class="interpolation-control">
    <!-- Header with item info -->
    <div
      class="mb-4 p-4 bg-surface-0 dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700"
    >
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100">
          Quality Level Interpolation
        </h3>
        <div class="flex items-center gap-2">
          <Badge
            v-if="interpolationStatus === 'interpolated'"
            value="Interpolated"
            severity="success"
          />
          <Badge v-else-if="interpolationStatus === 'original'" value="Original" severity="info" />
          <Button
            v-if="showClearButton && interpolatedItem"
            icon="pi pi-refresh"
            size="small"
            severity="secondary"
            @click="resetToOriginal"
            v-tooltip="'Reset to original'"
          />
        </div>
      </div>

      <div class="text-sm text-surface-600 dark:text-surface-400">
        <span v-if="interpolationInfo">
          Available range: QL {{ qualityRange?.min }} - {{ qualityRange?.max }} ({{
            qualityRange?.range
          }}
          levels)
        </span>
        <span v-else-if="!isInterpolatable"> This item cannot be interpolated </span>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center p-8">
      <ProgressSpinner size="2rem" />
      <span class="ml-3 text-surface-600 dark:text-surface-400">
        Loading interpolation data...
      </span>
    </div>

    <!-- Error state -->
    <Message v-else-if="error" severity="error" class="mb-4" :closable="false">
      <div class="flex items-center justify-between w-full">
        <span>{{ error.message }}</span>
        <Button
          v-if="error.retryable"
          label="Retry"
          size="small"
          severity="secondary"
          @click="retry"
        />
      </div>
    </Message>

    <!-- No interpolation available -->
    <Message
      v-else-if="!isInterpolatable && interpolationInfo"
      severity="info"
      class="mb-4"
      :closable="false"
    >
      This item is only available at one quality level (QL {{ interpolationInfo.min_ql }})
    </Message>

    <!-- Main control interface -->
    <div v-else-if="isInterpolatable" class="space-y-4">
      <!-- Quality Level Slider -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">
            Target Quality Level
          </label>
          <div class="flex items-center gap-2">
            <InputNumber
              v-model="localTargetQl"
              :min="qualityRange?.min"
              :max="qualityRange?.max"
              :step="1"
              size="small"
              :class="{ 'p-invalid': !isTargetQlValid }"
              @update:model-value="onQualityLevelChange"
            />
          </div>
        </div>

        <Slider
          v-model="localTargetQl"
          :min="qualityRange?.min || 1"
          :max="qualityRange?.max || 300"
          :step="1"
          class="w-full"
          @change="onQualityLevelChange"
        />

        <div class="flex justify-between text-xs text-surface-500 dark:text-surface-400">
          <span>QL {{ qualityRange?.min }}</span>
          <span>QL {{ qualityRange?.max }}</span>
        </div>
      </div>

      <!-- Quick select buttons -->
      <div v-if="suggestedLevels.length > 0" class="space-y-2">
        <div class="text-sm font-medium text-surface-700 dark:text-surface-300">Quick Select:</div>
        <div class="flex flex-wrap gap-2">
          <Button
            v-for="level in suggestedLevels"
            :key="level"
            :label="`QL ${level}`"
            size="small"
            severity="secondary"
            :outlined="localTargetQl !== level"
            @click="setQualityLevel(level)"
          />
        </div>
      </div>

      <!-- Current interpolation info -->
      <div
        v-if="interpolatedItem?.interpolating"
        class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800"
      >
        <div class="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
          <i class="pi pi-info-circle"></i>
          <span>
            Interpolated from QL {{ interpolatedItem.low_ql }} to QL
            {{ interpolatedItem.high_ql }} ({{ interpolatedItem.ql_delta }}/{{
              interpolatedItem.ql_delta_full
            }}
            steps)
          </span>
        </div>
      </div>
    </div>

    <!-- Debug info (development only) -->
    <div
      v-if="showDebugInfo && interpolatedItem"
      class="mt-4 p-3 bg-surface-100 dark:bg-surface-800 rounded text-xs"
    >
      <details>
        <summary class="cursor-pointer font-medium mb-2">Debug Info</summary>
        <pre class="whitespace-pre-wrap">{{ debugInfo }}</pre>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useInterpolation } from '../../composables/useInterpolation';
import type { Item, InterpolatedItem, InterpolationInfo } from '../../types/api';

// PrimeVue components
import Button from 'primevue/button';
import Slider from 'primevue/slider';
import InputNumber from 'primevue/inputnumber';
import ProgressSpinner from 'primevue/progressspinner';
import Message from 'primevue/message';
import Badge from 'primevue/badge';

// ============================================================================
// Props & Emits
// ============================================================================

interface Props {
  /** Item AOID or Item object */
  item?: number | Item | null;
  /** Initial target quality level */
  initialQl?: number;
  /** Show clear/reset button */
  showClearButton?: boolean;
  /** Show debug information (development) */
  showDebugInfo?: boolean;
  /** Auto-load interpolation info */
  autoLoad?: boolean;
  /** Debounce delay for QL changes */
  debounceMs?: number;
}

interface Emits {
  (e: 'interpolated', item: InterpolatedItem | null): void;
  (e: 'qualityChanged', ql: number): void;
  (e: 'error', error: string): void;
  (e: 'loaded', info: InterpolationInfo | null): void;
}

const props = withDefaults(defineProps<Props>(), {
  item: null,
  initialQl: undefined,
  showClearButton: true,
  showDebugInfo: false,
  autoLoad: true,
  debounceMs: 300,
});

const emit = defineEmits<Emits>();

// ============================================================================
// Interpolation State
// ============================================================================

const itemAoid = computed(() => {
  if (typeof props.item === 'number') return props.item;
  if (props.item && typeof props.item === 'object') return props.item.aoid || null;
  return null;
});

const {
  interpolatedItem,
  interpolationInfo,
  isLoading,
  error,
  isInterpolatable,
  qualityRange,
  isTargetQlValid,
  interpolationStatus,
  loadInterpolationInfo,
  interpolateToQl,
  setItem,
  setItemFromObject,
  resetToOriginal,
  getSuggestedQualityLevels,
  retry,
} = useInterpolation(ref(itemAoid.value), {
  autoLoad: props.autoLoad,
  debounceMs: props.debounceMs,
});

// ============================================================================
// Local State
// ============================================================================

const localTargetQl = ref<number | null>(props.initialQl || null);

// ============================================================================
// Computed Properties
// ============================================================================

const suggestedLevels = computed(() => {
  return getSuggestedQualityLevels();
});

const debugInfo = computed(() => {
  if (!interpolatedItem.value) return null;

  return {
    interpolating: interpolatedItem.value.interpolating,
    target_ql: interpolatedItem.value.target_ql,
    low_ql: interpolatedItem.value.low_ql,
    high_ql: interpolatedItem.value.high_ql,
    ql_delta: interpolatedItem.value.ql_delta,
    ql_delta_full: interpolatedItem.value.ql_delta_full,
    stats_count: interpolatedItem.value.stats?.length || 0,
    spell_data_count: interpolatedItem.value.spell_data?.length || 0,
    actions_count: interpolatedItem.value.actions?.length || 0,
  };
});

// ============================================================================
// Methods
// ============================================================================

async function onQualityLevelChange(): Promise<void> {
  if (!localTargetQl.value || !itemAoid.value || !isTargetQlValid.value) {
    return;
  }

  try {
    const result = await interpolateToQl(localTargetQl.value);
    emit('interpolated', result);
    emit('qualityChanged', localTargetQl.value);
  } catch (err: any) {
    emit('error', err.message || 'Failed to interpolate item');
  }
}

function setQualityLevel(ql: number): void {
  localTargetQl.value = ql;
  onQualityLevelChange();
}

async function handleItemChange(): Promise<void> {
  if (!props.item) return;

  try {
    if (typeof props.item === 'number') {
      await setItem(props.item);
    } else {
      await setItemFromObject(props.item);
    }

    emit('loaded', interpolationInfo.value);

    // Set initial QL if specified and item is interpolatable
    if (props.initialQl && isInterpolatable.value && qualityRange.value) {
      const clampedQl = Math.max(
        qualityRange.value.min,
        Math.min(qualityRange.value.max, props.initialQl)
      );
      localTargetQl.value = clampedQl;
      await onQualityLevelChange();
    } else if (qualityRange.value) {
      // Default to minimum QL
      localTargetQl.value = qualityRange.value.min;
    }
  } catch (err: any) {
    emit('error', err.message || 'Failed to load item');
  }
}

// ============================================================================
// Watchers
// ============================================================================

watch(() => props.item, handleItemChange, { immediate: false });

watch(error, (newError) => {
  if (newError) {
    emit('error', newError.message);
  }
});

watch(interpolatedItem, (newItem) => {
  emit('interpolated', newItem);
});

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  if (props.item) {
    handleItemChange();
  }
});

// ============================================================================
// Expose public methods
// ============================================================================

defineExpose({
  setQualityLevel,
  resetToOriginal,
  retry,
  loadInterpolationInfo,
});
</script>

<style scoped>
.interpolation-control {
  @apply w-full;
}

.p-invalid {
  @apply border-red-500 focus:border-red-500;
}

/* Custom slider styling */
:deep(.p-slider) {
  @apply bg-surface-200 dark:bg-surface-700;
}

:deep(.p-slider .p-slider-handle) {
  @apply bg-primary-500 border-primary-500;
}

:deep(.p-slider .p-slider-range) {
  @apply bg-primary-500;
}

/* Input number styling */
:deep(.p-inputnumber-input) {
  @apply w-20;
}
</style>

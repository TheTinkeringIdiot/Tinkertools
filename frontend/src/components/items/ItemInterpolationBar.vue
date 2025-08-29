<template>
  <div v-if="isInterpolatable" class="interpolation-bar flex items-center gap-3">
    <!-- QL Label and Input -->
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium text-surface-700 dark:text-surface-300 whitespace-nowrap">
        QL
      </span>
      <InputNumber
        v-model="localTargetQl"
        :min="qualityRange?.min"
        :max="qualityRange?.max"
        :step="1"
        :class="{ 'p-invalid': !isTargetQlValid }"
        class="w-16 ql-input"
        @update:model-value="debouncedQlChange"
      />
    </div>

    <!-- Slider with range indicators -->
    <div class="w-64">
      <div class="relative">
        <Slider
          v-model="localTargetQl"
          :min="qualityRange?.min || 1"
          :max="qualityRange?.max || 300"
          :step="1"
          class="w-full"
          @slideend="handleQlChange"
        />
        
        <!-- Range boundary indicators -->
        <div 
          v-for="(range, index) in interpolationRanges"
          :key="`range-${index}`"
          class="absolute top-0 h-full pointer-events-none"
          :style="getRangeIndicatorStyle(range)"
        >
          <div 
            class="h-full border-l-2 border-surface-400 dark:border-surface-500"
            :class="{ 'opacity-50': !range.interpolatable }"
          ></div>
        </div>
      </div>
      
      <!-- Range labels -->
      <div class="flex justify-between text-xs text-surface-500 dark:text-surface-400 mt-1">
        <span>{{ qualityRange?.min }}</span>
        <span class="text-center">
          {{ currentRangeText }}
        </span>
        <span>{{ qualityRange?.max }}</span>
      </div>
    </div>

    <!-- Interpolation status -->
    <div class="flex items-center gap-1">
      <Badge 
        v-if="interpolationStatus === 'interpolated'" 
        value="Interpolated" 
        severity="success"
        size="small"
      />
      <Badge 
        v-else-if="interpolationStatus === 'original'" 
        value="Original" 
        severity="info"
        size="small"
      />
    </div>

    <!-- Reset button -->
    <Button
      v-if="showResetButton && interpolatedItem"
      icon="pi pi-refresh"
      size="small"
      severity="secondary"
      outlined
      @click="resetToOriginal"
      v-tooltip="'Reset to original'"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useInterpolation } from '../../composables/useInterpolation'
import { apiClient } from '../../services/api-client'
import type { Item, InterpolatedItem, InterpolationInfo, InterpolationRange } from '../../types/api'

// PrimeVue components
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import InputNumber from 'primevue/inputnumber'
import Badge from 'primevue/badge'

// ============================================================================
// Props & Emits
// ============================================================================

interface Props {
  /** Item AOID or Item object */
  item?: number | Item | null
  /** Initial target quality level */
  initialQl?: number
  /** Show reset button */
  showResetButton?: boolean
}

interface Emits {
  (e: 'item-update', item: InterpolatedItem | null): void
  (e: 'error', error: string): void
}

const props = withDefaults(defineProps<Props>(), {
  item: null,
  initialQl: undefined,
  showResetButton: true
})

const emit = defineEmits<Emits>()
const route = useRoute()
const router = useRouter()

// ============================================================================
// State
// ============================================================================

const itemAoid = computed(() => {
  if (typeof props.item === 'number') return props.item
  if (props.item && typeof props.item === 'object') return props.item.aoid || null
  return null
})

const {
  interpolationInfo,
  isInterpolatable,
  qualityRange,
  interpolationRanges,
  loadInterpolationInfo,
  setItem,
  setItemFromObject
} = useInterpolation(ref(itemAoid.value), {
  autoLoad: true,
  debounceMs: 300
})

const localTargetQl = ref<number | null>(props.initialQl || null)

// ============================================================================
// Computed Properties
// ============================================================================

const isTargetQlValid = computed(() => {
  if (!localTargetQl.value || !qualityRange.value) return false
  return localTargetQl.value >= qualityRange.value.min && 
         localTargetQl.value <= qualityRange.value.max
})

const interpolatedItem = ref<any>(null)

const interpolationStatus = computed(() => {
  if (!props.item) return 'idle'
  const currentQl = typeof props.item === 'object' ? props.item?.ql : null
  return currentQl !== localTargetQl.value ? 'interpolated' : 'original'
})

const currentRangeText = computed(() => {
  if (!localTargetQl.value || !interpolationRanges.value.length) return ''
  
  const range = interpolationRanges.value.find(r => 
    localTargetQl.value! >= r.min_ql && localTargetQl.value! <= r.max_ql
  )
  
  if (!range) return ''
  return range.interpolatable ? `Range: ${range.min_ql}-${range.max_ql}` : `Fixed: ${range.min_ql}`
})

// ============================================================================
// Methods
// ============================================================================

function getRangeIndicatorStyle(range: InterpolationRange) {
  if (!qualityRange.value) return { left: '0%' }
  
  const totalRange = qualityRange.value.max - qualityRange.value.min
  const position = ((range.min_ql - qualityRange.value.min) / totalRange) * 100
  
  return {
    left: `${position}%`
  }
}

async function handleQlChange(): Promise<void> {
  if (!localTargetQl.value || !itemAoid.value) return

  // Find which range this QL belongs to
  const targetRange = interpolationRanges.value.find(r => 
    localTargetQl.value! >= r.min_ql && localTargetQl.value! <= r.max_ql
  )
  
  if (!targetRange) {
    emit('error', 'Invalid QL for this item')
    return
  }

  // Check if we need to navigate to a different base item
  if (targetRange.base_aoid !== itemAoid.value) {
    // Navigate to the correct base item for this range
    await router.push({
      path: `/items/${targetRange.base_aoid}`,
      query: { ql: localTargetQl.value.toString() }
    })
    return
  }

  // Same range - interpolate the current item
  try {
    const interpolated = await apiClient.interpolateItem(itemAoid.value, localTargetQl.value)
    
    if (interpolated.success && interpolated.item) {
      emit('item-update', interpolated.item)
      
      // Update URL query param
      await router.replace({
        path: route.path,
        query: { ...route.query, ql: localTargetQl.value.toString() }
      })
    } else {
      emit('error', interpolated.error || 'Failed to interpolate item')
    }
  } catch (err: any) {
    emit('error', err.message || 'Failed to interpolate item')
  }
}

// Debounced version for input changes
let debounceTimeout: NodeJS.Timeout | null = null
function debouncedQlChange(): void {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout)
  }
  debounceTimeout = setTimeout(() => {
    handleQlChange()
  }, 500)
}

function resetToOriginal(): void {
  localTargetQl.value = typeof props.item === 'object' ? props.item?.ql || null : null
  emit('item-update', null)
  
  // Remove QL from URL
  const { ql, ...queryWithoutQl } = route.query
  router.replace({ path: route.path, query: queryWithoutQl })
}

// ============================================================================
// Watchers
// ============================================================================

watch(() => props.item, async () => {
  if (!props.item) return

  // Load interpolation info
  if (typeof props.item === 'number') {
    await setItem(props.item)
  } else {
    await setItemFromObject(props.item)
  }

  // Set initial QL from URL or item
  if (props.initialQl && qualityRange.value) {
    const clampedQl = Math.max(
      qualityRange.value.min,
      Math.min(qualityRange.value.max, props.initialQl)
    )
    localTargetQl.value = clampedQl
    
    // Trigger initial interpolation if needed
    if (clampedQl !== (typeof props.item === 'object' ? props.item?.ql : null)) {
      await handleQlChange()
    }
  } else {
    localTargetQl.value = typeof props.item === 'object' ? props.item?.ql || null : null
  }
}, { immediate: true })

// ============================================================================
// Expose public methods
// ============================================================================

defineExpose({
  resetToOriginal
})
</script>

<style scoped>
.interpolation-bar {
  @apply min-w-0;
}

.p-invalid {
  @apply border-red-500 focus:border-red-500;
}

/* Custom slider styling */
:deep(.p-slider) {
  @apply bg-surface-200 dark:bg-surface-700;
  height: 4px;
}

:deep(.p-slider .p-slider-handle) {
  @apply bg-primary-500 border-primary-500;
  width: 16px;
  height: 16px;
}

:deep(.p-slider .p-slider-range) {
  @apply bg-primary-500;
}

/* QL input field width override */
:deep(.ql-input .p-inputnumber-input) {
  width: 4rem !important;
}

/* Range indicators */
.range-indicator {
  position: absolute;
  top: 0;
  bottom: 0;
  pointer-events: none;
}
</style>
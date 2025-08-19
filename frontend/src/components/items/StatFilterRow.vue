<!--
StatFilterRow - Individual stat filter component
Allows users to configure a single stat filter with function, stat, operator, and value
-->
<template>
  <div class="stat-filter-row flex items-center gap-2 p-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg">
    <!-- Function Dropdown -->
    <div class="flex-shrink-0">
      <Dropdown
        v-model="localFilter.function"
        :options="functionOptions"
        option-label="label"
        option-value="value"
        placeholder="Function"
        class="w-28"
        @change="emitUpdate"
      />
    </div>
    
    <!-- Stat Dropdown -->
    <div class="flex-1 min-w-0">
      <Dropdown
        v-model="localFilter.stat"
        :options="statOptions"
        option-label="label"
        option-value="value"
        placeholder="Stat"
        filter
        :filter-placeholder="'Search stats...'"
        class="w-full"
        @change="emitUpdate"
      />
    </div>
    
    <!-- Operator Dropdown -->
    <div class="flex-shrink-0">
      <Dropdown
        v-model="localFilter.operator"
        :options="operatorOptions"
        option-label="label"
        option-value="value"
        placeholder="Op"
        class="w-16"
        @change="emitUpdate"
      />
    </div>
    
    <!-- Value Input -->
    <div class="flex-shrink-0">
      <InputNumber
        v-model="localFilter.value"
        placeholder="Value"
        :min="0"
        :max="9999"
        class="w-20"
        @update:model-value="emitUpdate"
      />
    </div>
    
    <!-- Remove Button -->
    <div class="flex-shrink-0">
      <Button
        icon="pi pi-times"
        severity="danger"
        size="small"
        outlined
        @click="$emit('remove')"
        v-tooltip.bottom="'Remove Filter'"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { StatFilter } from '@/types/api'
import { STAT } from '@/services/game-data'

const props = defineProps<{
  filter: StatFilter
}>()

const emit = defineEmits<{
  update: [filter: StatFilter]
  remove: []
}>()

// Local copy of the filter to handle intermediate states
const localFilter = ref<StatFilter>({ ...props.filter })

// Watch for prop changes from parent
watch(() => props.filter, (newFilter) => {
  localFilter.value = { ...newFilter }
}, { deep: true })

// Options for dropdowns
const functionOptions = [
  { label: 'Requires', value: 'requires' },
  { label: 'Modifies', value: 'modifies' }
]

const operatorOptions = [
  { label: '==', value: '==' },
  { label: '<=', value: '<=' },
  { label: '>=', value: '>=' },
  { label: '!=', value: '!=' }
]

// Convert STAT mapping to dropdown options, filtering out common non-useful stats
const statOptions = computed(() => {
  const excludedStats = new Set([
    0, // None
    7, // State
    9, // MapFlags
    12, // Mesh
    13, // Anim
    14, // Name
    15, // Info
    23, // StaticInstance
    25, // StaticType
    28, // Height
    30, // Can
    31, // Face
    32, // HairMesh
    34, // DeadTimer
    35, // AccessCount
    38, // BackMesh
    39, // ShoulderMesh
    41, // FabricType
    42, // CATMesh
    43, // ParentType
    44, // ParentInstance
    50, // InventoryTimeout
    55, // InventoryId
    56, // TimeSinceCreation
    57, // LastXP
    58, // Age
    64, // HeadMesh
    65, // HairTexture
    66, // ShoulderTexture
    67, // HairColourRGB
    68, // NumConstructedQuest
    69, // MaxConstructedQuest
    72, // ItemType
    79, // Icon
    80, // PrimaryItemType
    81, // PrimaryItemInstance
    82, // SecondaryItemType
    83, // SecondaryItemInstance
    84, // UserType
    85, // UserInstance
    86, // AreaType
    87, // AreaInstance
    88, // DefaultSlot
    98, // StateAction
    99, // ItemAnim
  ])

  return Object.entries(STAT)
    .filter(([key]) => !excludedStats.has(parseInt(key)))
    .map(([key, value]) => ({
      label: value,
      value: parseInt(key)
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
})

function emitUpdate() {
  // Only emit if all required fields are filled
  if (localFilter.value.function && 
      localFilter.value.stat !== undefined && 
      localFilter.value.operator && 
      localFilter.value.value !== undefined) {
    emit('update', { ...localFilter.value })
  }
}
</script>

<style scoped>
.stat-filter-row {
  transition: all 0.2s ease;
}

.stat-filter-row:hover {
  background-color: rgb(var(--surface-100));
}

:root.dark .stat-filter-row:hover {
  background-color: rgb(var(--surface-700));
}

/* Make dropdowns more compact */
:deep(.p-dropdown) {
  min-height: 2rem;
}

:deep(.p-dropdown .p-dropdown-label) {
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
}

:deep(.p-inputnumber-input) {
  padding: 0.375rem 0.5rem;
  font-size: 0.875rem;
}
</style>
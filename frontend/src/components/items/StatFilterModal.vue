<!--
StatFilterModal - Modal interface for configuring stat filters
Provides a spacious interface for selecting function, stat, operator, and value
-->
<template>
  <Dialog
    v-model:visible="isVisible"
    modal
    header="Add Stat Filter"
    :style="{ width: '500px' }"
    class="stat-filter-modal"
  >
    <div class="space-y-4">
      <!-- Filter Configuration Form -->
      <div class="grid grid-cols-1 gap-4">
        <!-- Function Selection -->
        <div>
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            Filter Type
          </label>
          <div class="grid grid-cols-2 gap-2">
            <Button
              :label="'Requires'"
              :outlined="localFilter.function !== 'requires'"
              :severity="localFilter.function === 'requires' ? 'primary' : 'secondary'"
              @click="localFilter.function = 'requires'"
              class="w-full"
            />
            <Button
              :label="'Modifies'"
              :outlined="localFilter.function !== 'modifies'"
              :severity="localFilter.function === 'modifies' ? 'primary' : 'secondary'"
              @click="localFilter.function = 'modifies'"
              class="w-full"
            />
          </div>
          <div class="text-xs text-surface-500 dark:text-surface-400 mt-1">
            <strong>Requires:</strong> Items that need this stat to equip/use<br />
            <strong>Modifies:</strong> Items that boost this stat when equipped
          </div>
        </div>

        <!-- Stat Selection -->
        <div>
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            Stat
          </label>
          <Dropdown
            v-model="localFilter.stat"
            :options="statOptions"
            option-label="label"
            option-value="value"
            placeholder="Select a stat"
            filter
            :filter-placeholder="'Search stats...'"
            class="w-full"
          />
        </div>

        <!-- Operator Selection -->
        <div>
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            Comparison
          </label>
          <div class="grid grid-cols-4 gap-2">
            <Button
              v-for="op in operatorOptions"
              :key="op.value"
              :label="op.label"
              :outlined="localFilter.operator !== op.value"
              :severity="localFilter.operator === op.value ? 'primary' : 'secondary'"
              @click="localFilter.operator = op.value"
              class="w-full"
            />
          </div>
        </div>

        <!-- Value Input -->
        <div>
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            Value
          </label>
          <InputNumber
            v-model="localFilter.value"
            placeholder="Enter value"
            :min="0"
            :max="9999"
            class="w-full"
          />
        </div>
      </div>

      <!-- Preview -->
      <div
        v-if="isValidFilter"
        class="p-3 bg-surface-100 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700"
      >
        <div class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          Filter Preview:
        </div>
        <div class="text-sm text-surface-600 dark:text-surface-400">
          {{ formatFilterPreview() }}
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button label="Cancel" outlined @click="cancel" />
        <Button label="Add Filter" :disabled="!isValidFilter" @click="addFilter" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { StatFilter } from '@/types/api';
import { STAT } from '@/services/game-data';

const props = defineProps<{
  visible: boolean;
  initialFilter?: Partial<StatFilter>;
}>();

const emit = defineEmits<{
  'update:visible': [visible: boolean];
  'add-filter': [filter: StatFilter];
}>();

// Local state
const localFilter = ref<StatFilter>({
  function: 'requires',
  stat: 16, // Default to Strength
  operator: '>=',
  value: 100,
});

// Modal visibility
const isVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

// Options for dropdowns
const operatorOptions = [
  { label: '==', value: '==' },
  { label: '<=', value: '<=' },
  { label: '>=', value: '>=' },
  { label: '!=', value: '!=' },
];

// Convert STAT mapping to dropdown options, filtering out non-useful stats
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
  ]);

  return Object.entries(STAT)
    .filter(([key]) => !excludedStats.has(parseInt(key)))
    .map(([key, value]) => ({
      label: value,
      value: parseInt(key),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
});

// Validation
const isValidFilter = computed(() => {
  return (
    localFilter.value.function &&
    localFilter.value.stat !== undefined &&
    localFilter.value.operator &&
    localFilter.value.value !== undefined &&
    localFilter.value.value !== null
  );
});

// Methods
function formatFilterPreview(): string {
  const statName =
    statOptions.value.find((s) => s.value === localFilter.value.stat)?.label || 'Unknown';
  const functionText = localFilter.value.function === 'requires' ? 'Requires' : 'Modifies';
  return `${functionText} ${statName} ${localFilter.value.operator} ${localFilter.value.value}`;
}

function addFilter() {
  if (isValidFilter.value) {
    emit('add-filter', { ...localFilter.value });
    resetFilter();
    isVisible.value = false;
  }
}

function cancel() {
  resetFilter();
  isVisible.value = false;
}

function resetFilter() {
  localFilter.value = {
    function: 'requires',
    stat: 16, // Default to Strength
    operator: '>=',
    value: 100,
  };
}

// Watch for initial filter prop
watch(
  () => props.initialFilter,
  (newFilter) => {
    if (newFilter) {
      localFilter.value = {
        function: newFilter.function || 'requires',
        stat: newFilter.stat ?? 16,
        operator: newFilter.operator || '>=',
        value: newFilter.value ?? 100,
      };
    }
  },
  { immediate: true }
);

// Reset when modal opens
watch(isVisible, (visible) => {
  if (visible && !props.initialFilter) {
    resetFilter();
  }
});
</script>

<style scoped>
.stat-filter-modal :deep(.p-dialog-header) {
  padding: 1.5rem 1.5rem 0 1.5rem;
}

.stat-filter-modal :deep(.p-dialog-content) {
  padding: 1.5rem;
}

.stat-filter-modal :deep(.p-dialog-footer) {
  padding: 0 1.5rem 1.5rem 1.5rem;
}

/* Button styling for better visual feedback */
.stat-filter-modal :deep(.p-button) {
  transition: all 0.2s ease;
}

.stat-filter-modal :deep(.p-button:not(.p-button-outlined)) {
  background: rgb(var(--primary-500));
  border-color: rgb(var(--primary-500));
}

.stat-filter-modal :deep(.p-button.p-button-outlined) {
  background: transparent;
  color: rgb(var(--surface-500));
  border-color: rgb(var(--surface-300));
}

.stat-filter-modal :deep(.p-button.p-button-outlined:hover) {
  background: rgb(var(--surface-100));
  border-color: rgb(var(--surface-400));
}

:root.dark .stat-filter-modal :deep(.p-button.p-button-outlined) {
  color: rgb(var(--surface-400));
  border-color: rgb(var(--surface-600));
}

:root.dark .stat-filter-modal :deep(.p-button.p-button-outlined:hover) {
  background: rgb(var(--surface-800));
  border-color: rgb(var(--surface-500));
}
</style>

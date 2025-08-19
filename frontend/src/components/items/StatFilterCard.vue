<!--
StatFilterCard - Compact display of an active stat filter
Shows a summary of the filter with remove option
-->
<template>
  <div class="stat-filter-card flex items-center justify-between p-2 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg">
    <!-- Filter Description -->
    <div class="flex items-center gap-2 flex-1 min-w-0">
      <!-- Function Badge -->
      <div 
        class="px-2 py-1 rounded text-xs font-medium flex-shrink-0"
        :class="functionBadgeClass"
      >
        {{ filter.function === 'requires' ? 'REQ' : 'MOD' }}
      </div>
      
      <!-- Filter Text -->
      <div class="text-sm text-surface-700 dark:text-surface-300 truncate">
        {{ formatFilter() }}
      </div>
    </div>
    
    <!-- Remove Button -->
    <Button
      icon="pi pi-times"
      size="small"
      text
      severity="danger"
      @click="$emit('remove')"
      v-tooltip.left="'Remove Filter'"
      class="flex-shrink-0 ml-2"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StatFilter } from '@/types/api'
import { STAT } from '@/services/game-data'

const props = defineProps<{
  filter: StatFilter
}>()

const emit = defineEmits<{
  remove: []
}>()

// Get stat name from STAT mapping
const statName = computed(() => {
  return STAT[props.filter.stat] || 'Unknown'
})

// Badge styling based on function type
const functionBadgeClass = computed(() => {
  if (props.filter.function === 'requires') {
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
  } else {
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
  }
})

// Format the filter for display
function formatFilter(): string {
  return `${statName.value} ${props.filter.operator} ${props.filter.value}`
}
</script>

<style scoped>
.stat-filter-card {
  transition: all 0.2s ease;
}

.stat-filter-card:hover {
  background-color: rgb(var(--surface-200));
}

:root.dark .stat-filter-card:hover {
  background-color: rgb(var(--surface-700));
}

/* Compact button styling */
:deep(.p-button.p-button-text) {
  padding: 0.25rem;
  width: 1.5rem;
  height: 1.5rem;
}

:deep(.p-button.p-button-text .p-button-icon) {
  font-size: 0.75rem;
}
</style>
<template>
  <div class="space-y-4">
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Weapon Types -->
      <div>
        <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Weapon Types</label>
        <MultiSelect
          v-model="localFilters.weaponTypes"
          @update:model-value="updateFilters"
          :options="weaponTypeOptions"
          option-label="name"
          option-value="id"
          placeholder="All weapon types"
          class="w-full"
        />
      </div>

      <!-- Quality Levels -->
      <div>
        <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Quality Levels</label>
        <MultiSelect
          v-model="localFilters.qualityLevels"
          @update:model-value="updateFilters"
          :options="qualityLevelOptions"
          option-label="label"
          option-value="value"
          placeholder="All quality levels"
          class="w-full"
        />
      </div>

      <!-- Usability Filter -->
      <div>
        <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Usability</label>
        <div class="flex items-center space-x-2 mt-2">
          <Checkbox 
            v-model="localFilters.usableOnly"
            @update:model-value="updateFilters"
            binary
            input-id="usable-only"
          />
          <label for="usable-only" class="text-sm">Show usable only</label>
        </div>
        <div class="text-xs text-surface-500 dark:text-surface-400 mt-1">
          {{ characterSkills && Object.keys(characterSkills).length > 0 
             ? 'Based on your character skills' 
             : 'Enter character skills to enable' }}
        </div>
      </div>

      <!-- Sorting -->
      <div>
        <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Sort By</label>
        <div class="space-y-2">
          <Dropdown
            v-model="localFilters.sortBy"
            @update:model-value="updateFilters"
            :options="sortOptions"
            option-label="name"
            option-value="id"
            class="w-full"
          />
          <div class="flex items-center space-x-2">
            <Checkbox 
              v-model="localFilters.sortDescending"
              @update:model-value="updateFilters"
              binary
              input-id="sort-desc"
            />
            <label for="sort-desc" class="text-sm">Descending</label>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Filters -->
    <div class="border-t pt-4">
      <div class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Quick Filters</div>
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="quickFilter in quickFilters"
          :key="quickFilter.name"
          @click="applyQuickFilter(quickFilter)"
          :label="quickFilter.name"
          size="small"
          severity="secondary"
          outlined
        />
      </div>
    </div>

    <!-- Active Filters Summary -->
    <div v-if="hasActiveFilters" class="border-t pt-4">
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-surface-700 dark:text-surface-300">Active Filters</span>
        <Button
          @click="clearAllFilters"
          label="Clear All"
          size="small"
          severity="danger"
          text
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="filter in activeFilterSummary"
          :key="filter"
          class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
        >
          {{ filter }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import MultiSelect from 'primevue/multiselect'
import Dropdown from 'primevue/dropdown'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import type { WeaponFilters, CharacterSkills } from '@/types/weapon'
import { WEAPON_TYPES, QUALITY_RANGES } from '@/types/weapon'

interface Props {
  filters: WeaponFilters
  characterSkills?: CharacterSkills
}

interface Emits {
  (e: 'update:filters', filters: WeaponFilters): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Local state
const localFilters = ref<WeaponFilters>({ ...props.filters })

// Options
const weaponTypeOptions = computed(() => {
  return Object.entries(WEAPON_TYPES).map(([id, name]) => ({
    id: parseInt(id),
    name
  }))
})

const qualityLevelOptions = computed(() => {
  return QUALITY_RANGES.map(range => ({
    label: range.label,
    value: range.min // Using min value as identifier
  }))
})

const sortOptions = [
  { id: 'name', name: 'Name' },
  { id: 'ql', name: 'Quality Level' },
  { id: 'usability', name: 'Usability' }
]

const quickFilters = [
  {
    name: 'Rifles',
    filters: { weaponTypes: [1] } // Assuming weapon type 1 is rifles
  },
  {
    name: 'Melee Weapons',
    filters: { weaponTypes: [1] } // Would need proper weapon type mapping
  },
  {
    name: 'High QL (200+)',
    filters: { qualityLevels: [201] }
  },
  {
    name: 'Low Requirements',
    filters: {} // Would need custom logic
  }
]

// Computed
const hasActiveFilters = computed(() => {
  return localFilters.value.weaponTypes.length > 0 ||
         localFilters.value.qualityLevels.length > 0 ||
         localFilters.value.usableOnly ||
         localFilters.value.sortBy !== 'name' ||
         localFilters.value.sortDescending
})

const activeFilterSummary = computed(() => {
  const summary: string[] = []
  
  if (localFilters.value.weaponTypes.length > 0) {
    summary.push(`${localFilters.value.weaponTypes.length} weapon type(s)`)
  }
  
  if (localFilters.value.qualityLevels.length > 0) {
    summary.push(`${localFilters.value.qualityLevels.length} quality range(s)`)
  }
  
  if (localFilters.value.usableOnly) {
    summary.push('Usable only')
  }
  
  if (localFilters.value.sortBy !== 'name') {
    const sortName = sortOptions.find(opt => opt.id === localFilters.value.sortBy)?.name || 'Custom'
    summary.push(`Sort: ${sortName}${localFilters.value.sortDescending ? ' (desc)' : ''}`)
  }
  
  return summary
})

// Methods
const updateFilters = () => {
  emit('update:filters', { ...localFilters.value })
}

const applyQuickFilter = (quickFilter: any) => {
  // Apply the quick filter settings
  Object.assign(localFilters.value, quickFilter.filters)
  updateFilters()
}

const clearAllFilters = () => {
  localFilters.value = {
    weaponTypes: [],
    qualityLevels: [],
    usableOnly: false,
    sortBy: 'name',
    sortDescending: false
  }
  updateFilters()
}

// Watch for prop changes
watch(() => props.filters, (newFilters) => {
  localFilters.value = { ...newFilters }
}, { deep: true })
</script>
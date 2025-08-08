<!--
ItemFilters - Advanced filtering component for TinkerItems
Provides dynamic filtering with real-time results and profile-aware options
-->
<template>
  <div class="item-filters">
    <!-- Filter Header -->
    <div class="p-4 border-b border-surface-200 dark:border-surface-700">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-semibold text-surface-700 dark:text-surface-300">
          Filters
        </h3>
        <Button
          icon="pi pi-filter-slash"
          size="small"
          text
          severity="secondary"
          @click="clearAllFilters"
          v-if="hasActiveFilters"
          v-tooltip.left="'Clear All Filters'"
        />
      </div>
      
      <!-- Active Filters Summary -->
      <div v-if="hasActiveFilters" class="flex flex-wrap gap-1 mb-3">
        <Tag
          v-for="(filter, key) in activeFilterSummary"
          :key="key"
          :value="filter.label"
          :severity="filter.severity"
          removable
          @remove="removeFilter(key)"
        />
      </div>
      
      <!-- Quick Filter Presets -->
      <div class="flex flex-wrap gap-1">
        <Button
          v-for="preset in quickPresets"
          :key="preset.name"
          :label="preset.name"
          size="small"
          outlined
          :severity="isPresetActive(preset) ? 'primary' : 'secondary'"
          @click="applyPreset(preset)"
        />
      </div>
    </div>

    <!-- Filter Sections -->
    <div class="space-y-1">
      <!-- Item Type Filter -->
      <Accordion :multiple="true" v-model:activeIndex="openSections">
        <AccordionTab header="Item Type">
          <template #header>
            <div class="flex items-center gap-2">
              <i class="pi pi-box text-sm"></i>
              <span>Item Type</span>
              <Badge v-if="getFilterCount('itemType')" :value="getFilterCount('itemType')" size="small" />
            </div>
          </template>
          
          <div class="space-y-3">
            <!-- Basic Type Toggle -->
            <div class="grid grid-cols-2 gap-2">
              <div class="flex items-center">
                <Checkbox 
                  v-model="tempFilters.isNano" 
                  :indeterminate="tempFilters.isNano === null"
                  input-id="nano-items"
                  @change="updateFilter('isNano')"
                />
                <label for="nano-items" class="ml-2 text-sm">Nano Programs</label>
              </div>
              <div class="flex items-center">
                <Checkbox 
                  v-model="tempFilters.isWeapon" 
                  input-id="weapons"
                  @change="updateFilter('isWeapon')"
                />
                <label for="weapons" class="ml-2 text-sm">Weapons</label>
              </div>
            </div>
            
            <!-- Item Classes -->
            <div>
              <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-2">
                Item Classes
              </label>
              <div class="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                <div
                  v-for="itemClass in itemClassOptions"
                  :key="itemClass.value"
                  class="flex items-center"
                >
                  <Checkbox
                    v-model="tempFilters.itemClasses"
                    :value="itemClass.value"
                    :input-id="`class-${itemClass.value}`"
                    @change="updateFilter('itemClasses')"
                  />
                  <label :for="`class-${itemClass.value}`" class="ml-2 text-sm">
                    {{ itemClass.label }}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </AccordionTab>
        
        <!-- Quality Level Filter -->
        <AccordionTab header="Quality Level">
          <template #header>
            <div class="flex items-center gap-2">
              <i class="pi pi-star text-sm"></i>
              <span>Quality Level</span>
              <Badge v-if="hasQLFilter" :value="`${tempFilters.minQL}-${tempFilters.maxQL}`" size="small" />
            </div>
          </template>
          
          <div class="space-y-4">
            <!-- QL Range Slider -->
            <div>
              <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-2">
                Quality Level Range: {{ tempFilters.minQL }} - {{ tempFilters.maxQL }}
              </label>
              <Slider
                v-model="qlRange"
                :min="1"
                :max="300"
                :step="1"
                range
                @change="updateQLFilter"
                class="w-full"
              />
            </div>
            
            <!-- Quick QL Buttons -->
            <div class="flex flex-wrap gap-1">
              <Button
                v-for="ql in quickQLRanges"
                :key="ql.label"
                :label="ql.label"
                size="small"
                outlined
                @click="setQLRange(ql.min, ql.max)"
              />
            </div>
            
            <!-- Profile Compatibility -->
            <div v-if="profile && showCompatibility" class="p-3 bg-primary-50 dark:bg-primary-900/20 rounded">
              <div class="flex items-center gap-2 mb-2">
                <i class="pi pi-user text-primary-600"></i>
                <span class="text-sm font-medium text-primary-700 dark:text-primary-300">
                  {{ profile.name }}'s Range
                </span>
              </div>
              <div class="text-xs text-primary-600 dark:text-primary-400 mb-2">
                Recommended: {{ profileQLRange.min }} - {{ profileQLRange.max }}
              </div>
              <Button
                label="Use Profile Range"
                size="small"
                outlined
                @click="setQLRange(profileQLRange.min, profileQLRange.max)"
              />
            </div>
          </div>
        </AccordionTab>
        
        <!-- Stat Requirements -->
        <AccordionTab header="Stat Requirements">
          <template #header>
            <div class="flex items-center gap-2">
              <i class="pi pi-chart-bar text-sm"></i>
              <span>Stat Requirements</span>
              <Badge v-if="getFilterCount('stats')" :value="getFilterCount('stats')" size="small" />
            </div>
          </template>
          
          <div class="space-y-3">
            <!-- Stat Requirement Type -->
            <div>
              <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-2">
                Requirements Filter
              </label>
              <Dropdown
                v-model="tempFilters.statFilterMode"
                :options="statFilterModes"
                option-label="label"
                option-value="value"
                placeholder="Any Stats"
                class="w-full"
                @change="updateFilter('statFilterMode')"
              />
            </div>
            
            <!-- Individual Stat Filters -->
            <div class="space-y-2">
              <div
                v-for="stat in commonStats"
                :key="stat.value"
                class="flex items-center gap-2"
              >
                <Checkbox
                  v-model="tempFilters.selectedStats"
                  :value="stat.value"
                  :input-id="`stat-${stat.value}`"
                  @change="updateFilter('selectedStats')"
                />
                <label :for="`stat-${stat.value}`" class="text-sm min-w-0 flex-1">
                  {{ stat.label }}
                </label>
                <InputNumber
                  v-if="tempFilters.selectedStats.includes(stat.value)"
                  v-model="tempFilters.statMinValues[stat.value]"
                  :min="0"
                  :max="9999"
                  placeholder="Min"
                  size="small"
                  class="w-16"
                  @update:model-value="updateFilter('statMinValues')"
                />
              </div>
            </div>
            
            <!-- Character Stat Integration -->
            <div v-if="profile && showCompatibility" class="p-3 bg-primary-50 dark:bg-primary-900/20 rounded">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-primary-700 dark:text-primary-300">
                  Character Stats
                </span>
                <Button
                  label="Use My Stats"
                  size="small"
                  outlined
                  @click="useCharacterStats"
                />
              </div>
              <div class="grid grid-cols-2 gap-2 text-xs">
                <div v-for="stat in displayedCharacterStats" :key="stat.name" class="flex justify-between">
                  <span>{{ stat.name }}:</span>
                  <span class="font-mono">{{ stat.value }}</span>
                </div>
              </div>
            </div>
          </div>
        </AccordionTab>
        
        <!-- Item Properties -->
        <AccordionTab header="Item Properties">
          <template #header>
            <div class="flex items-center gap-2">
              <i class="pi pi-cog text-sm"></i>
              <span>Properties</span>
              <Badge v-if="getFilterCount('properties')" :value="getFilterCount('properties')" size="small" />
            </div>
          </template>
          
          <div class="space-y-3">
            <!-- Has Effects -->
            <div class="flex items-center justify-between">
              <label class="text-sm">Has Special Effects</label>
              <TriStateCheckbox
                v-model="tempFilters.hasEffects"
                @change="updateFilter('hasEffects')"
              />
            </div>
            
            <!-- Has Requirements -->
            <div class="flex items-center justify-between">
              <label class="text-sm">Has Requirements</label>
              <TriStateCheckbox
                v-model="tempFilters.hasRequirements"
                @change="updateFilter('hasRequirements')"
              />
            </div>
            
            <!-- Tradeable -->
            <div class="flex items-center justify-between">
              <label class="text-sm">Tradeable</label>
              <TriStateCheckbox
                v-model="tempFilters.isTradeable"
                @change="updateFilter('isTradeable')"
              />
            </div>
            
            <!-- Droppable -->
            <div class="flex items-center justify-between">
              <label class="text-sm">Droppable</label>
              <TriStateCheckbox
                v-model="tempFilters.isDroppable"
                @change="updateFilter('isDroppable')"
              />
            </div>
          </div>
        </AccordionTab>
        
        <!-- Source/Availability -->
        <AccordionTab header="Source">
          <template #header>
            <div class="flex items-center gap-2">
              <i class="pi pi-map-marker text-sm"></i>
              <span>Source</span>
              <Badge v-if="getFilterCount('source')" :value="getFilterCount('source')" size="small" />
            </div>
          </template>
          
          <div class="space-y-3">
            <!-- Source Types -->
            <div>
              <label class="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-2">
                Item Source
              </label>
              <div class="space-y-1">
                <div
                  v-for="source in sourceOptions"
                  :key="source.value"
                  class="flex items-center"
                >
                  <Checkbox
                    v-model="tempFilters.sources"
                    :value="source.value"
                    :input-id="`source-${source.value}`"
                    @change="updateFilter('sources')"
                  />
                  <label :for="`source-${source.value}`" class="ml-2 text-sm">
                    {{ source.label }}
                  </label>
                </div>
              </div>
            </div>
          </div>
        </AccordionTab>
      </Accordion>
    </div>
    
    <!-- Filter Actions -->
    <div class="p-4 border-t border-surface-200 dark:border-surface-700 space-y-2">
      <div class="flex gap-2">
        <Button
          label="Apply Filters"
          icon="pi pi-check"
          size="small"
          @click="applyFilters"
          :disabled="!hasChanges"
        />
        <Button
          label="Reset"
          icon="pi pi-refresh"
          size="small"
          outlined
          @click="resetFilters"
        />
      </div>
      
      <!-- Save Filter Preset -->
      <div v-if="hasActiveFilters" class="flex gap-2">
        <InputText
          v-model="presetName"
          placeholder="Preset name..."
          size="small"
          class="flex-1"
        />
        <Button
          icon="pi pi-save"
          size="small"
          @click="savePreset"
          :disabled="!presetName.trim()"
          v-tooltip.bottom="'Save Filter Preset'"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { ItemFilters, TinkerProfile } from '@/types/api'

interface FilterPreset {
  name: string
  filters: ItemFilters
}

const props = defineProps<{
  filters: ItemFilters
  profile?: TinkerProfile | null
  showCompatibility?: boolean
  searchResults?: any[]
}>()

const emit = defineEmits<{
  'filter-change': []
  'clear-filters': []
  'update:filters': [filters: ItemFilters]
}>()

// State
const tempFilters = ref<ItemFilters>({ ...props.filters })
const openSections = ref([0, 1]) // Open first two sections by default
const qlRange = ref([1, 300])
const presetName = ref('')
const savedPresets = ref<FilterPreset[]>([])

// Options
const itemClassOptions = [
  { label: 'Weapon - 1H Blunt', value: 1 },
  { label: 'Weapon - 1H Edged', value: 2 },
  { label: 'Weapon - 2H Blunt', value: 3 },
  { label: 'Weapon - 2H Edged', value: 4 },
  { label: 'Weapon - Ranged', value: 5 },
  { label: 'Armor - Body', value: 6 },
  { label: 'Armor - Head', value: 7 },
  { label: 'Armor - Arms', value: 8 },
  { label: 'Armor - Legs', value: 9 },
  { label: 'Armor - Feet', value: 10 },
  { label: 'Implant', value: 15 },
  { label: 'Utility', value: 20 }
]

const commonStats = [
  { label: 'Strength', value: 16 },
  { label: 'Agility', value: 17 },
  { label: 'Stamina', value: 18 },
  { label: 'Intelligence', value: 19 },
  { label: 'Sense', value: 20 },
  { label: 'Psychic', value: 21 },
  { label: '1H Blunt', value: 102 },
  { label: '1H Edged', value: 103 },
  { label: '2H Blunt', value: 109 },
  { label: '2H Edged', value: 105 },
  { label: 'Ranged Energy', value: 133 },
  { label: 'Computer Literacy', value: 161 }
]

const statFilterModes = [
  { label: 'Any Requirements', value: 'any' },
  { label: 'Can Meet All', value: 'can_meet' },
  { label: 'Cannot Meet Any', value: 'cannot_meet' },
  { label: 'Has Specific Stats', value: 'has_stats' }
]

const sourceOptions = [
  { label: 'Mission Rewards', value: 'mission' },
  { label: 'Pocket Boss Drops', value: 'pocket_boss' },
  { label: 'Regular Mobs', value: 'mob_drop' },
  { label: 'Shops', value: 'shop' },
  { label: 'Tradeskills', value: 'tradeskill' },
  { label: 'Quest Rewards', value: 'quest' }
]

const quickQLRanges = [
  { label: '1-50', min: 1, max: 50 },
  { label: '51-100', min: 51, max: 100 },
  { label: '101-200', min: 101, max: 200 },
  { label: '201-300', min: 201, max: 300 },
  { label: 'High QL', min: 200, max: 300 }
]

const quickPresets: FilterPreset[] = [
  { name: 'Weapons', filters: { itemClasses: [1, 2, 3, 4, 5] } },
  { name: 'Armor', filters: { itemClasses: [6, 7, 8, 9, 10] } },
  { name: 'Implants', filters: { itemClasses: [15] } },
  { name: 'Nanos', filters: { isNano: true } },
  { name: 'High QL', filters: { minQL: 200 } }
]

// Computed
const hasActiveFilters = computed(() => {
  return Object.values(props.filters).some(value => 
    Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null
  )
})

const hasChanges = computed(() => {
  return JSON.stringify(tempFilters.value) !== JSON.stringify(props.filters)
})

const hasQLFilter = computed(() => 
  tempFilters.value.minQL !== undefined || tempFilters.value.maxQL !== undefined
)

const profileQLRange = computed(() => {
  if (!props.profile) return { min: 1, max: 300 }
  
  const level = props.profile.level
  return {
    min: Math.max(1, level - 50),
    max: Math.min(300, level + 50)
  }
})

const displayedCharacterStats = computed(() => {
  if (!props.profile) return []
  
  return commonStats.slice(0, 6).map(stat => ({
    name: stat.label,
    value: props.profile?.stats?.[stat.value] || 0
  }))
})

const activeFilterSummary = computed(() => {
  const summary: Record<string, { label: string; severity: string }> = {}
  
  if (tempFilters.value.isNano) {
    summary.isNano = { label: 'Nano Programs', severity: 'info' }
  }
  
  if (tempFilters.value.itemClasses?.length) {
    summary.itemClasses = { 
      label: `${tempFilters.value.itemClasses.length} Classes`, 
      severity: 'info' 
    }
  }
  
  if (hasQLFilter.value) {
    summary.qlRange = { 
      label: `QL ${tempFilters.value.minQL || 1}-${tempFilters.value.maxQL || 300}`, 
      severity: 'success' 
    }
  }
  
  if (tempFilters.value.selectedStats?.length) {
    summary.stats = { 
      label: `${tempFilters.value.selectedStats.length} Stats`, 
      severity: 'warning' 
    }
  }
  
  return summary
})

// Methods
function getFilterCount(category: string): number {
  switch (category) {
    case 'itemType':
      return (tempFilters.value.itemClasses?.length || 0) + 
             (tempFilters.value.isNano ? 1 : 0) + 
             (tempFilters.value.isWeapon ? 1 : 0)
    case 'stats':
      return tempFilters.value.selectedStats?.length || 0
    case 'properties':
      let count = 0
      if (tempFilters.value.hasEffects !== null) count++
      if (tempFilters.value.hasRequirements !== null) count++
      if (tempFilters.value.isTradeable !== null) count++
      if (tempFilters.value.isDroppable !== null) count++
      return count
    case 'source':
      return tempFilters.value.sources?.length || 0
    default:
      return 0
  }
}

function updateFilter(filterKey: string) {
  // Apply filter immediately for better UX
  applyFilters()
}

function updateQLFilter() {
  tempFilters.value.minQL = qlRange.value[0]
  tempFilters.value.maxQL = qlRange.value[1]
  updateFilter('qlRange')
}

function setQLRange(min: number, max: number) {
  qlRange.value = [min, max]
  updateQLFilter()
}

function useCharacterStats() {
  if (!props.profile) return
  
  // Set stat requirements based on character's current stats
  tempFilters.value.statFilterMode = 'can_meet'
  tempFilters.value.selectedStats = commonStats.slice(0, 6).map(s => s.value)
  tempFilters.value.statMinValues = {}
  
  commonStats.slice(0, 6).forEach(stat => {
    const charStatValue = props.profile?.stats?.[stat.value] || 0
    tempFilters.value.statMinValues[stat.value] = Math.max(0, charStatValue - 100)
  })
  
  updateFilter('characterStats')
}

function applyPreset(preset: FilterPreset) {
  tempFilters.value = { ...preset.filters }
  applyFilters()
}

function isPresetActive(preset: FilterPreset): boolean {
  return JSON.stringify(preset.filters) === JSON.stringify(props.filters)
}

function applyFilters() {
  emit('update:filters', { ...tempFilters.value })
  emit('filter-change')
}

function resetFilters() {
  tempFilters.value = {}
  qlRange.value = [1, 300]
  applyFilters()
}

function clearAllFilters() {
  resetFilters()
  emit('clear-filters')
}

function removeFilter(filterKey: string) {
  switch (filterKey) {
    case 'isNano':
      tempFilters.value.isNano = undefined
      break
    case 'itemClasses':
      tempFilters.value.itemClasses = []
      break
    case 'qlRange':
      tempFilters.value.minQL = undefined
      tempFilters.value.maxQL = undefined
      qlRange.value = [1, 300]
      break
    case 'stats':
      tempFilters.value.selectedStats = []
      tempFilters.value.statMinValues = {}
      break
  }
  applyFilters()
}

function savePreset() {
  if (!presetName.value.trim()) return
  
  const preset: FilterPreset = {
    name: presetName.value,
    filters: { ...tempFilters.value }
  }
  
  savedPresets.value.push(preset)
  localStorage.setItem('tinkerItems.filterPresets', JSON.stringify(savedPresets.value))
  presetName.value = ''
}

function loadPresets() {
  const saved = localStorage.getItem('tinkerItems.filterPresets')
  if (saved) {
    savedPresets.value = JSON.parse(saved)
  }
}

// Initialize
onMounted(() => {
  loadPresets()
  
  // Initialize QL range from props
  if (props.filters.minQL || props.filters.maxQL) {
    qlRange.value = [props.filters.minQL || 1, props.filters.maxQL || 300]
  }
})

// Watch props changes
watch(() => props.filters, (newFilters) => {
  tempFilters.value = { ...newFilters }
}, { deep: true })
</script>

<style scoped>
/* Custom accordion styling */
:deep(.p-accordion-header-link) {
  padding: 0.75rem;
  font-size: 0.875rem;
}

:deep(.p-accordion-content) {
  padding: 1rem;
}

/* Custom slider styling */
:deep(.p-slider-horizontal) {
  height: 4px;
}

:deep(.p-slider-handle) {
  width: 16px;
  height: 16px;
  margin-top: -6px;
  margin-left: -8px;
}
</style>
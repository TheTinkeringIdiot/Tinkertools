<!--
NanoFilters - Advanced filtering component for nano programs
Supports filtering by school, strain, profession, quality level, and skill compatibility
-->
<template>
  <div class="nano-filters p-4 space-y-4">
    <!-- Filter Summary -->
    <div
      class="flex items-center justify-between pb-2 border-b border-surface-200 dark:border-surface-700"
    >
      <h3 class="text-sm font-medium text-surface-900 dark:text-surface-100">Filters</h3>
      <Button
        v-if="hasActiveFilters"
        label="Clear All"
        size="small"
        severity="secondary"
        text
        @click="clearAllFilters"
      />
    </div>

    <!-- Quality Level Filter -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
        Quality Level
      </label>
      <div class="flex flex-wrap gap-2">
        <div v-for="quality in qualityLevels" :key="quality" class="flex items-center gap-2">
          <Checkbox
            v-model="selectedQualityLevels"
            :inputId="`quality-${quality}`"
            :value="quality"
          />
          <label
            :for="`quality-${quality}`"
            class="text-sm text-surface-700 dark:text-surface-300 cursor-pointer"
          >
            QL {{ quality }}
          </label>
        </div>
      </div>
    </div>

    <!-- Profession Filter -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-surface-700 dark:text-surface-300"> Profession </label>
      <MultiSelect
        v-model="selectedProfessions"
        :options="professions"
        placeholder="All Professions"
        class="w-full"
        :maxSelectedLabels="2"
        selectedItemsLabel="{0} professions selected"
      />
    </div>

    <!-- Strain Filter -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
        Nano Strain
      </label>
      <div class="space-y-2 max-h-40 overflow-y-auto">
        <div v-for="strain in availableStrains" :key="strain" class="flex items-center gap-2">
          <Checkbox v-model="selectedStrains" :inputId="`strain-${strain}`" :value="strain" />
          <label
            :for="`strain-${strain}`"
            class="text-xs text-surface-700 dark:text-surface-300 cursor-pointer"
          >
            {{ strain }}
          </label>
        </div>
      </div>
    </div>

    <!-- Effect Type Filter -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
        Effect Type
      </label>
      <div class="flex flex-wrap gap-2">
        <Chip
          v-for="effectType in effectTypes"
          :key="effectType.value"
          :label="effectType.label"
          :class="[
            'cursor-pointer transition-all',
            selectedEffectTypes.includes(effectType.value)
              ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700',
          ]"
          @click="toggleEffectType(effectType.value)"
        />
      </div>
    </div>

    <!-- Level Range Filter -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
        Level Range
      </label>
      <div class="px-2">
        <Slider v-model="levelRange" :min="1" :max="220" :range="true" :step="1" class="w-full" />
        <div class="flex justify-between text-xs text-surface-500 dark:text-surface-400 mt-1">
          <span>{{ levelRange[0] }}</span>
          <span>{{ levelRange[1] }}</span>
        </div>
      </div>
    </div>

    <!-- Compatibility Filters (shown when profile is active) -->
    <div
      v-if="showCompatibility && activeProfile"
      class="space-y-4 pt-4 border-t border-surface-200 dark:border-surface-700"
    >
      <h4 class="text-sm font-medium text-surface-900 dark:text-surface-100">
        Character Compatibility
      </h4>

      <!-- Skill Requirements -->
      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <Checkbox v-model="filters.skillCompatible" inputId="skill-compatible" binary />
          <label
            for="skill-compatible"
            class="text-sm text-surface-700 dark:text-surface-300 cursor-pointer"
          >
            Meets Skill Requirements
          </label>
        </div>

        <div class="flex items-center gap-2">
          <Checkbox v-model="filters.castable" inputId="fully-castable" binary />
          <label
            for="fully-castable"
            class="text-sm text-surface-700 dark:text-surface-300 cursor-pointer"
          >
            Fully Castable (All Requirements)
          </label>
        </div>
      </div>

      <!-- Skill Gap Analysis -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
          Show nanos within skill gap:
        </label>
        <Dropdown
          v-model="skillGapThreshold"
          :options="skillGapOptions"
          option-label="label"
          option-value="value"
          placeholder="Select threshold"
          class="w-full"
        />
      </div>

      <!-- Memory Usage Filter -->
      <div class="space-y-2">
        <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
          Memory Usage
        </label>
        <div class="px-2">
          <Slider
            v-model="memoryUsageRange"
            :min="0"
            :max="1000"
            :range="true"
            :step="10"
            class="w-full"
          />
          <div class="flex justify-between text-xs text-surface-500 dark:text-surface-400 mt-1">
            <span>{{ memoryUsageRange[0] }}mb</span>
            <span>{{ memoryUsageRange[1] }}mb</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Sorting Options -->
    <div class="space-y-2 pt-4 border-t border-surface-200 dark:border-surface-700">
      <label class="text-sm font-medium text-surface-700 dark:text-surface-300"> Sort By </label>
      <Dropdown
        v-model="sortBy"
        :options="sortOptions"
        option-label="label"
        option-value="value"
        class="w-full"
      />

      <div class="flex items-center gap-2">
        <Checkbox v-model="sortDescending" inputId="sort-desc" binary />
        <label
          for="sort-desc"
          class="text-sm text-surface-700 dark:text-surface-300 cursor-pointer"
        >
          Descending Order
        </label>
      </div>
    </div>

    <!-- Advanced Filters Toggle -->
    <div class="pt-4 border-t border-surface-200 dark:border-surface-700">
      <Button
        :label="showAdvancedFilters ? 'Hide Advanced' : 'Show Advanced'"
        :icon="showAdvancedFilters ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
        severity="secondary"
        text
        size="small"
        class="w-full"
        @click="showAdvancedFilters = !showAdvancedFilters"
      />
    </div>

    <!-- Advanced Filters -->
    <Transition name="slide-down">
      <div v-if="showAdvancedFilters" class="space-y-4 pt-2">
        <!-- Nano Point Cost -->
        <div class="space-y-2">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
            Nano Point Cost
          </label>
          <div class="px-2">
            <Slider
              v-model="nanoPointRange"
              :min="0"
              :max="2000"
              :range="true"
              :step="50"
              class="w-full"
            />
            <div class="flex justify-between text-xs text-surface-500 dark:text-surface-400 mt-1">
              <span>{{ nanoPointRange[0] }}</span>
              <span>{{ nanoPointRange[1] }}</span>
            </div>
          </div>
        </div>

        <!-- Duration Filter -->
        <div class="space-y-2">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
            Effect Duration
          </label>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="duration in durationTypes"
              :key="duration.value"
              class="flex items-center gap-2"
            >
              <Checkbox
                v-model="selectedDurations"
                :inputId="`duration-${duration.value}`"
                :value="duration.value"
              />
              <label
                :for="`duration-${duration.value}`"
                class="text-sm text-surface-700 dark:text-surface-300 cursor-pointer"
              >
                {{ duration.label }}
              </label>
            </div>
          </div>
        </div>

        <!-- Target Type Filter -->
        <div class="space-y-2">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
            Target Type
          </label>
          <MultiSelect
            v-model="selectedTargetTypes"
            :options="targetTypes"
            placeholder="All Targets"
            class="w-full"
            :maxSelectedLabels="2"
            selectedItemsLabel="{0} targets selected"
          />
        </div>
      </div>
    </Transition>

    <!-- Filter Presets -->
    <div class="space-y-2 pt-4 border-t border-surface-200 dark:border-surface-700">
      <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
        Quick Filters
      </label>
      <div class="grid grid-cols-2 gap-2">
        <Button
          v-for="preset in filterPresets"
          :key="preset.name"
          :label="preset.name"
          size="small"
          severity="secondary"
          outlined
          @click="applyPreset(preset)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Chip from 'primevue/chip';
import Dropdown from 'primevue/dropdown';
import MultiSelect from 'primevue/multiselect';
import Slider from 'primevue/slider';

import type { NanoFilters, TinkerProfile } from '@/types/nano';

// Types
interface FilterPreset {
  name: string;
  filters: Partial<NanoFilters>;
}

interface SkillGapOption {
  label: string;
  value: number;
}

interface SortOption {
  label: string;
  value: string;
}

interface EffectType {
  label: string;
  value: string;
}

interface DurationType {
  label: string;
  value: string;
}

// Props
const props = withDefaults(
  defineProps<{
    modelValue: NanoFilters;
    showCompatibility?: boolean;
    activeProfile?: TinkerProfile | null;
    availableStrains?: string[];
  }>(),
  {
    showCompatibility: false,
    activeProfile: null,
    availableStrains: () => [],
  }
);

// Emits
const emit = defineEmits<{
  'update:modelValue': [filters: NanoFilters];
  'filter-change': [filters: NanoFilters];
}>();

// Reactive state
const filters = ref<NanoFilters>({ ...props.modelValue });
const selectedQualityLevels = ref<number[]>([]);
const selectedProfessions = ref<string[]>([]);
const selectedStrains = ref<string[]>([]);
const selectedEffectTypes = ref<string[]>([]);
const selectedDurations = ref<string[]>([]);
const selectedTargetTypes = ref<string[]>([]);
const levelRange = ref<[number, number]>([1, 220]);
const memoryUsageRange = ref<[number, number]>([0, 1000]);
const nanoPointRange = ref<[number, number]>([0, 2000]);
const skillGapThreshold = ref<number | null>(null);
const sortBy = ref('name');
const sortDescending = ref(false);
const showAdvancedFilters = ref(false);

// Static options
const qualityLevels = [1, 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300];

const professions = [
  'Adventurer',
  'Agent',
  'Bureaucrat',
  'Doctor',
  'Enforcer',
  'Engineer',
  'Fixer',
  'Keeper',
  'Martial Artist',
  'Meta-Physicist',
  'Nano-Technician',
  'Soldier',
  'Trader',
  'Shade',
];

const effectTypes: EffectType[] = [
  { label: 'Stat Boost', value: 'stat_boost' },
  { label: 'Heal', value: 'heal' },
  { label: 'Damage', value: 'damage' },
  { label: 'Protection', value: 'protection' },
  { label: 'Teleport', value: 'teleport' },
  { label: 'Summon', value: 'summon' },
  { label: 'Debuff', value: 'debuff' },
  { label: 'Utility', value: 'utility' },
];

const durationTypes: DurationType[] = [
  { label: 'Instant', value: 'instant' },
  { label: 'Short (< 1 min)', value: 'short' },
  { label: 'Medium (1-5 min)', value: 'medium' },
  { label: 'Long (5-15 min)', value: 'long' },
  { label: 'Very Long (> 15 min)', value: 'very_long' },
  { label: 'Permanent', value: 'permanent' },
];

const targetTypes = ['Self', 'Team Member', 'Enemy', 'Area', 'Item', 'Pet'];

const skillGapOptions: SkillGapOption[] = [
  { label: 'No Gap (Exact Match)', value: 0 },
  { label: 'Within 50 points', value: 50 },
  { label: 'Within 100 points', value: 100 },
  { label: 'Within 200 points', value: 200 },
  { label: 'Within 500 points', value: 500 },
  { label: 'Any Gap', value: 9999 },
];

const sortOptions: SortOption[] = [
  { label: 'Name', value: 'name' },
  { label: 'Level', value: 'level' },
  { label: 'Quality Level', value: 'qualityLevel' },
  { label: 'School', value: 'school' },
  { label: 'Nano Point Cost', value: 'nanoPointCost' },
  { label: 'Memory Usage', value: 'memoryUsage' },
  { label: 'Compatibility Score', value: 'compatibility' },
];

const filterPresets: FilterPreset[] = [
  {
    name: 'Buffs',
    filters: {
      effectTypes: ['stat_boost', 'protection'],
      durationType: ['long', 'very_long'],
    },
  },
  {
    name: 'Heals',
    filters: {
      effectTypes: ['heal'],
      schools: ['Biological Metamorphosis'],
    },
  },
  {
    name: 'Nukes',
    filters: {
      effectTypes: ['damage'],
      schools: ['Matter Creation', 'Psychological Modifications'],
    },
  },
  {
    name: 'Low Level',
    filters: {
      levelRange: [1, 50],
    },
  },
  {
    name: 'High Level',
    filters: {
      levelRange: [150, 220],
    },
  },
  {
    name: 'Low Memory',
    filters: {
      memoryUsageRange: [0, 200],
    },
  },
];

// Computed
const hasActiveFilters = computed(() => {
  return (
    selectedQualityLevels.value.length > 0 ||
    selectedProfessions.value.length > 0 ||
    selectedStrains.value.length > 0 ||
    selectedEffectTypes.value.length > 0 ||
    selectedDurations.value.length > 0 ||
    selectedTargetTypes.value.length > 0 ||
    levelRange.value[0] !== 1 ||
    levelRange.value[1] !== 220 ||
    memoryUsageRange.value[0] !== 0 ||
    memoryUsageRange.value[1] !== 1000 ||
    nanoPointRange.value[0] !== 0 ||
    nanoPointRange.value[1] !== 2000 ||
    filters.value.skillCompatible ||
    filters.value.castable ||
    skillGapThreshold.value !== null
  );
});

// Methods
const toggleEffectType = (effectType: string) => {
  const index = selectedEffectTypes.value.indexOf(effectType);
  if (index > -1) {
    selectedEffectTypes.value.splice(index, 1);
  } else {
    selectedEffectTypes.value.push(effectType);
  }
  updateFilters();
};

const updateFilters = () => {
  const newFilters: NanoFilters = {
    ...filters.value,
    schools: [], // This is handled by the search component
    qualityLevels: [...selectedQualityLevels.value],
    professions: [...selectedProfessions.value],
    strains: [...selectedStrains.value],
    effectTypes: [...selectedEffectTypes.value],
    durationType: [...selectedDurations.value],
    targetTypes: [...selectedTargetTypes.value],
    levelRange: [...levelRange.value] as [number, number],
    memoryUsageRange: [...memoryUsageRange.value] as [number, number],
    nanoPointRange: [...nanoPointRange.value] as [number, number],
    skillGapThreshold: skillGapThreshold.value,
    sortBy: sortBy.value,
    sortDescending: sortDescending.value,
  };

  emit('update:modelValue', newFilters);
  emit('filter-change', newFilters);
};

const clearAllFilters = () => {
  selectedQualityLevels.value = [];
  selectedProfessions.value = [];
  selectedStrains.value = [];
  selectedEffectTypes.value = [];
  selectedDurations.value = [];
  selectedTargetTypes.value = [];
  levelRange.value = [1, 220];
  memoryUsageRange.value = [0, 1000];
  nanoPointRange.value = [0, 2000];
  skillGapThreshold.value = null;
  filters.value.skillCompatible = false;
  filters.value.castable = false;
  sortBy.value = 'name';
  sortDescending.value = false;

  updateFilters();
};

const applyPreset = (preset: FilterPreset) => {
  // Reset filters first
  clearAllFilters();

  // Apply preset filters
  if (preset.filters.qualityLevels) {
    selectedQualityLevels.value = [...preset.filters.qualityLevels];
  }
  if (preset.filters.professions) {
    selectedProfessions.value = [...preset.filters.professions];
  }
  if (preset.filters.strains) {
    selectedStrains.value = [...preset.filters.strains];
  }
  if (preset.filters.effectTypes) {
    selectedEffectTypes.value = [...preset.filters.effectTypes];
  }
  if (preset.filters.durationType) {
    selectedDurations.value = [...preset.filters.durationType];
  }
  if (preset.filters.levelRange) {
    levelRange.value = [...preset.filters.levelRange] as [number, number];
  }
  if (preset.filters.memoryUsageRange) {
    memoryUsageRange.value = [...preset.filters.memoryUsageRange] as [number, number];
  }

  updateFilters();
};

// Watch for changes to emit updates
watch(
  [
    selectedQualityLevels,
    selectedProfessions,
    selectedStrains,
    selectedEffectTypes,
    selectedDurations,
    selectedTargetTypes,
    levelRange,
    memoryUsageRange,
    nanoPointRange,
    skillGapThreshold,
    sortBy,
    sortDescending,
  ],
  () => {
    updateFilters();
  },
  { deep: true }
);

watch(
  () => filters.value,
  () => {
    updateFilters();
  },
  { deep: true }
);

// Watch for external changes to modelValue
watch(
  () => props.modelValue,
  (newValue) => {
    filters.value = { ...newValue };

    // Update local state to match
    selectedQualityLevels.value = newValue.qualityLevels || [];
    selectedProfessions.value = newValue.professions || [];
    selectedStrains.value = newValue.strains || [];
    selectedEffectTypes.value = newValue.effectTypes || [];
    selectedDurations.value = newValue.durationType || [];
    selectedTargetTypes.value = newValue.targetTypes || [];

    if (newValue.levelRange) {
      levelRange.value = [...newValue.levelRange] as [number, number];
    }
    if (newValue.memoryUsageRange) {
      memoryUsageRange.value = [...newValue.memoryUsageRange] as [number, number];
    }
    if (newValue.nanoPointRange) {
      nanoPointRange.value = [...newValue.nanoPointRange] as [number, number];
    }

    skillGapThreshold.value = newValue.skillGapThreshold || null;
    sortBy.value = newValue.sortBy || 'name';
    sortDescending.value = newValue.sortDescending || false;
  },
  { deep: true }
);
</script>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  max-height: 600px;
  opacity: 1;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}
</style>

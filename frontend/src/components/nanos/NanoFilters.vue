<!--
NanoFilters - Filtering component for nano programs
Profession, strain, QL and level filter on the server; the compatibility
filters check the active profile client-side
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

    <!-- Profession Filter -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-surface-700 dark:text-surface-300"> Profession </label>
      <MultiSelect
        v-model="selectedProfessions"
        :options="professions"
        placeholder="All Professions"
        class="w-full"
        :max-selected-labels="2"
        selected-items-label="{0} professions selected"
      />
    </div>

    <!-- Strain Filter: the strains the other filters leave, from the server -->
    <div class="space-y-2">
      <label for="strain-filter" class="text-sm font-medium text-surface-700 dark:text-surface-300">
        Nano Strain
      </label>
      <MultiSelect
        v-model="selectedStrainIds"
        input-id="strain-filter"
        :options="strainChoices"
        option-label="label"
        option-value="id"
        filter
        filter-placeholder="Find a strain"
        reset-filter-on-hide
        placeholder="All Strains"
        class="w-full"
        :max-selected-labels="1"
        selected-items-label="{0} strains selected"
        data-testid="strain-filter"
      />
    </div>

    <!-- Quality Level Filter -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
        Quality Level
      </label>
      <div class="px-2">
        <Slider
          v-model="qlRange"
          :min="MIN_QL"
          :max="MAX_QL"
          :range="true"
          :step="1"
          class="w-full"
        />
        <div class="flex justify-between text-xs text-surface-500 dark:text-surface-400 mt-1">
          <span>{{ qlRange[0] }}</span>
          <span>{{ qlRange[1] }}</span>
        </div>
      </div>
    </div>

    <!-- Level Range Filter -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
        Level Range
      </label>
      <div class="px-2">
        <Slider
          v-model="levelRange"
          :min="MIN_LEVEL"
          :max="MAX_LEVEL"
          :range="true"
          :step="1"
          class="w-full"
        />
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
          <Checkbox v-model="skillCompatible" input-id="skill-compatible" binary />
          <label
            v-tooltip.right="
              'Your skills and abilities are high enough; other requirements (profession, level...) are not checked'
            "
            for="skill-compatible"
            class="text-sm text-surface-700 dark:text-surface-300 cursor-pointer"
          >
            Meets Skill Requirements
          </label>
        </div>

        <div class="flex items-center gap-2">
          <Checkbox v-model="castable" input-id="fully-castable" binary />
          <label
            v-tooltip.right="
              'Nothing your profile can check stops it. Conditions it can\'t check (a nano not already running, a perk, the target...) are listed on the nano.'
            "
            for="fully-castable"
            class="text-sm text-surface-700 dark:text-surface-300 cursor-pointer"
          >
            Castable
          </label>
        </div>
      </div>

      <!-- Skill Gap Analysis -->
      <div class="space-y-2">
        <label for="skill-gap" class="text-sm font-medium text-surface-700 dark:text-surface-300">
          Show nanos within skill gap:
        </label>
        <Dropdown
          v-model="skillGapThreshold"
          input-id="skill-gap"
          :options="skillGapOptions"
          option-label="label"
          option-value="value"
          placeholder="Select threshold"
          show-clear
          class="w-full"
        />
        <p class="text-xs text-surface-500 dark:text-surface-400">
          Nanos you could cast by raising each missing skill by at most this much. Nanos blocked by
          anything else (profession, level...) are hidden.
        </p>
      </div>

      <p class="text-xs text-surface-500 dark:text-surface-400">
        These filters check every nano the other filters match, up to
        {{ COMPATIBILITY_FETCH_CAP.toLocaleString() }}.
      </p>
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
        <Checkbox v-model="sortDescending" input-id="sort-desc" binary />
        <label
          for="sort-desc"
          class="text-sm text-surface-700 dark:text-surface-300 cursor-pointer"
        >
          Descending Order
        </label>
      </div>
    </div>

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
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Dropdown from 'primevue/dropdown';
import MultiSelect from 'primevue/multiselect';
import Slider from 'primevue/slider';

import type { ReadonlyTinkerProfile } from '@/lib/tinkerprofiles/types';
import type { NanoFilters, NanoSortField, NanoStrainOption } from '@/types/nano';
import {
  COMPATIBILITY_FETCH_CAP,
  MAX_LEVEL,
  MAX_QL,
  MIN_LEVEL,
  MIN_QL,
  defaultNanoFilters,
} from '@/stores/nanosStore';

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
  value: NanoSortField;
}

// Props
const props = withDefaults(
  defineProps<{
    modelValue: NanoFilters;
    showCompatibility?: boolean;
    activeProfile?: ReadonlyTinkerProfile | null;
    /** The strains to offer, as /nanos/strains lists them */
    strainOptions?: readonly NanoStrainOption[];
  }>(),
  {
    showCompatibility: false,
    activeProfile: null,
    strainOptions: () => [],
  }
);

// Emits
const emit = defineEmits<{
  'update:modelValue': [filters: NanoFilters];
  'filter-change': [filters: NanoFilters];
}>();

// Reactive state
const selectedSchools = ref<string[]>([]);
const selectedProfessions = ref<string[]>([]);
const selectedStrainIds = ref<number[]>([]);
const qlRange = ref<[number, number]>([MIN_QL, MAX_QL]);
const levelRange = ref<[number, number]>([MIN_LEVEL, MAX_LEVEL]);
const skillCompatible = ref(false);
const castable = ref(false);
const skillGapThreshold = ref<number | null>(null);
const sortBy = ref<NanoSortField>('name');
const sortDescending = ref(false);

// Static options
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

const skillGapOptions: SkillGapOption[] = [
  { label: 'No Gap (Castable)', value: 0 },
  { label: 'Within 50 points', value: 50 },
  { label: 'Within 100 points', value: 100 },
  { label: 'Within 200 points', value: 200 },
  { label: 'Within 500 points', value: 500 },
  { label: 'Any Skill Gap', value: 9999 },
];

// Compatibility sorts client-side, so it is offered only with compatibility on
const sortOptions = computed<SortOption[]>(() => [
  { label: 'Name', value: 'name' },
  { label: 'Level', value: 'level' },
  { label: 'Quality Level', value: 'qualityLevel' },
  ...(props.showCompatibility && props.activeProfile
    ? [{ label: 'Compatibility Score', value: 'compatibility' as const }]
    : []),
]);

// Presets use what the /nanos endpoints send: school, level
const filterPresets: FilterPreset[] = [
  {
    name: 'Heals',
    filters: {
      schools: ['Medical'],
    },
  },
  {
    name: 'Nukes',
    filters: {
      schools: ['Combat'],
    },
  },
  {
    name: 'Shields',
    filters: {
      schools: ['Protection'],
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
];

// Computed

/** Strain picker entries: the name (or the ID of an unnamed strain) and its count */
const strainChoices = computed(() =>
  props.strainOptions.map((option) => ({
    id: option.id,
    label: `${option.name ?? `Strain ${option.id}`} (${option.count})`,
  }))
);

const hasActiveFilters = computed(() => {
  return (
    selectedSchools.value.length > 0 ||
    selectedProfessions.value.length > 0 ||
    selectedStrainIds.value.length > 0 ||
    qlRange.value[0] !== MIN_QL ||
    qlRange.value[1] !== MAX_QL ||
    levelRange.value[0] !== MIN_LEVEL ||
    levelRange.value[1] !== MAX_LEVEL ||
    skillCompatible.value ||
    castable.value ||
    skillGapThreshold.value !== null
  );
});

// Methods
const updateFilters = () => {
  const newFilters: NanoFilters = {
    // Spread first so the keys keep modelValue's order for the comparison below
    ...props.modelValue,
    // Chosen with the search component's chips, or by a preset
    schools: [...selectedSchools.value],
    professions: [...selectedProfessions.value],
    strainIds: [...selectedStrainIds.value],
    qlRange: [...qlRange.value],
    levelRange: [...levelRange.value],
    skillGapThreshold: skillGapThreshold.value,
    skillCompatible: skillCompatible.value,
    castable: castable.value,
    sortBy: sortBy.value,
    sortDescending: sortDescending.value,
  };

  // Syncing local state from modelValue re-runs this; echoing an unchanged
  // value back would bounce between parent and child forever.
  if (JSON.stringify(newFilters) === JSON.stringify(props.modelValue)) return;
  emit('update:modelValue', newFilters);
  emit('filter-change', newFilters);
};

/** Mirror a set of filters into the controls */
const showFilters = (value: NanoFilters) => {
  // Copies, so the controls never edit the parent's arrays
  selectedSchools.value = [...value.schools];
  selectedProfessions.value = [...value.professions];
  selectedStrainIds.value = [...value.strainIds];
  qlRange.value = [...value.qlRange];
  levelRange.value = [...value.levelRange];
  skillCompatible.value = value.skillCompatible;
  castable.value = value.castable;
  // 0 ("no gap") is a threshold, not a missing one
  skillGapThreshold.value = value.skillGapThreshold ?? null;
  sortBy.value = value.sortBy;
  sortDescending.value = value.sortDescending;
};

const clearAllFilters = () => {
  showFilters(defaultNanoFilters());
  updateFilters();
};

const applyPreset = (preset: FilterPreset) => {
  // A preset replaces the filters, keeping the sort
  showFilters({
    ...defaultNanoFilters(),
    sortBy: sortBy.value,
    sortDescending: sortDescending.value,
    ...preset.filters,
  });
  updateFilters();
};

// Every change to a control but a slider applies at once
watch(
  [
    selectedSchools,
    selectedProfessions,
    selectedStrainIds,
    skillCompatible,
    castable,
    skillGapThreshold,
    sortBy,
    sortDescending,
  ],
  () => {
    updateFilters();
  },
  { deep: true }
);

// Sliders apply once they settle: each step would otherwise query the server
const SLIDER_SETTLE_MS = 300;
let sliderTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  [qlRange, levelRange],
  () => {
    clearTimeout(sliderTimer);
    sliderTimer = setTimeout(updateFilters, SLIDER_SETTLE_MS);
  },
  { deep: true }
);
onBeforeUnmount(() => clearTimeout(sliderTimer));

// Mirror modelValue, including on mount: filters restored from storage must show
watch(() => props.modelValue, showFilters, { deep: true, immediate: true });

// Compatibility sorting leaves with the compatibility filters
watch(sortOptions, (options) => {
  if (!options.some((option) => option.value === sortBy.value)) sortBy.value = 'name';
});
</script>

<!--
NanoSearch - Advanced search component for nano programs
Supports text search with nano school filtering and quick filters
-->
<template>
  <div class="nano-search p-4 space-y-4">
    <!-- Main Search Input -->
    <div class="relative">
      <IconField iconPosition="left">
        <InputIcon class="pi pi-search" />
        <InputText
          v-model="searchQuery"
          placeholder="Search nanos by name, description, or school..."
          class="w-full"
          @input="handleInput"
          @keyup.enter="handleSearch"
        />
      </IconField>

      <!-- Clear Search -->
      <Button
        v-if="searchQuery"
        icon="pi pi-times"
        class="absolute right-2 top-1/2 -translate-y-1/2"
        size="small"
        severity="secondary"
        text
        rounded
        @click="clearSearch"
      />
    </div>

    <!-- School Quick Filters -->
    <div class="space-y-2">
      <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
        Nano Schools:
      </label>
      <div class="flex flex-wrap gap-2">
        <Chip
          v-for="school in nanoSchools"
          :key="school"
          :label="getSchoolShortName(school)"
          :class="[
            'cursor-pointer transition-all',
            selectedSchools.includes(school)
              ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800'
              : 'bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700',
          ]"
          @click="toggleSchool(school)"
        />
      </div>
    </div>

    <!-- Advanced Search Toggle -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Checkbox v-model="showAdvanced" inputId="show-advanced" binary />
        <label
          for="show-advanced"
          class="text-sm text-surface-700 dark:text-surface-300 cursor-pointer"
        >
          Advanced Search
        </label>
      </div>

      <!-- Search Stats -->
      <div class="text-xs text-surface-500 dark:text-surface-400">
        {{ searchStats }}
      </div>
    </div>

    <!-- Advanced Search Options -->
    <Transition name="slide-down">
      <div
        v-if="showAdvanced"
        class="space-y-3 pt-2 border-t border-surface-200 dark:border-surface-700"
      >
        <!-- Search in Fields -->
        <div>
          <label class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2 block">
            Search In:
          </label>
          <div class="flex flex-wrap gap-2">
            <div v-for="field in searchFields" :key="field.value" class="flex items-center gap-2">
              <Checkbox
                v-model="selectedFields"
                :inputId="`field-${field.value}`"
                :value="field.value"
              />
              <label
                :for="`field-${field.value}`"
                class="text-sm text-surface-700 dark:text-surface-300 cursor-pointer"
              >
                {{ field.label }}
              </label>
            </div>
          </div>
        </div>

        <!-- Quick Search Presets -->
        <div>
          <label class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2 block">
            Quick Searches:
          </label>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="preset in searchPresets"
              :key="preset.name"
              :label="preset.name"
              size="small"
              severity="secondary"
              outlined
              @click="applyPreset(preset)"
            />
          </div>
        </div>

        <!-- Search Modifiers -->
        <div class="flex items-center gap-4 text-xs text-surface-600 dark:text-surface-400">
          <div class="flex items-center gap-1">
            <i class="pi pi-info-circle"></i>
            <span>Use quotes for exact matches</span>
          </div>
          <div class="flex items-center gap-1">
            <i class="pi pi-plus"></i>
            <span>Use + to require terms</span>
          </div>
          <div class="flex items-center gap-1">
            <i class="pi pi-minus"></i>
            <span>Use - to exclude terms</span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Recent Searches -->
    <div v-if="recentSearches.length > 0" class="space-y-2">
      <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
        Recent Searches:
      </label>
      <div class="flex flex-wrap gap-2">
        <Chip
          v-for="(search, index) in recentSearches"
          :key="index"
          :label="search"
          class="cursor-pointer bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700"
          removable
          @click="applyRecentSearch(search)"
          @remove="removeRecentSearch(search)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Chip from 'primevue/chip';
import IconField from 'primevue/iconfield';
import InputIcon from 'primevue/inputicon';
import InputText from 'primevue/inputtext';

// Types
interface SearchField {
  value: string;
  label: string;
}

interface SearchPreset {
  name: string;
  query: string;
  schools: string[];
  fields: string[];
}

// Props
const props = withDefaults(
  defineProps<{
    modelValue?: string;
    totalResults?: number;
  }>(),
  {
    modelValue: '',
    totalResults: 0,
  }
);

// Emits
const emit = defineEmits<{
  search: [query: string, schools: string[], fields: string[]];
  'update:modelValue': [value: string];
}>();

// Reactive state
const searchQuery = ref(props.modelValue);
const selectedSchools = ref<string[]>([]);
const selectedFields = ref<string[]>(['name', 'description']);
const showAdvanced = ref(false);
const recentSearches = ref<string[]>([]);

// Nano schools from the design document
const nanoSchools = [
  'Matter Metamorphosis',
  'Biological Metamorphosis',
  'Psychological Modifications',
  'Matter Creation',
  'Time and Space',
  'Sensory Improvement',
];

const searchFields: SearchField[] = [
  { value: 'name', label: 'Name' },
  { value: 'description', label: 'Description' },
  { value: 'school', label: 'School' },
  { value: 'strain', label: 'Strain' },
  { value: 'effects', label: 'Effects' },
  { value: 'requirements', label: 'Requirements' },
];

const searchPresets: SearchPreset[] = [
  {
    name: 'Stat Buffs',
    query: 'boost strength agility',
    schools: ['Matter Metamorphosis', 'Biological Metamorphosis'],
    fields: ['name', 'description', 'effects'],
  },
  {
    name: 'Healing',
    query: 'heal health',
    schools: ['Biological Metamorphosis'],
    fields: ['name', 'description', 'effects'],
  },
  {
    name: 'Damage',
    query: 'damage hurt nuke',
    schools: ['Matter Creation', 'Psychological Modifications'],
    fields: ['name', 'description', 'effects'],
  },
  {
    name: 'Transport',
    query: 'teleport recall gate',
    schools: ['Time and Space'],
    fields: ['name', 'description', 'effects'],
  },
  {
    name: 'Summons',
    query: 'summon pet companion',
    schools: ['Matter Creation'],
    fields: ['name', 'description', 'effects'],
  },
];

// Computed
const searchStats = computed(() => {
  const parts: string[] = [];

  if (searchQuery.value.trim()) {
    parts.push(`"${searchQuery.value.trim()}"`);
  }

  if (selectedSchools.value.length > 0) {
    parts.push(
      `${selectedSchools.value.length} school${selectedSchools.value.length !== 1 ? 's' : ''}`
    );
  }

  if (parts.length === 0) {
    return 'All nanos';
  }

  return parts.join(' • ');
});

// Methods
const getSchoolShortName = (school: string): string => {
  const shortNames: Record<string, string> = {
    'Matter Metamorphosis': 'MM',
    'Biological Metamorphosis': 'BM',
    'Psychological Modifications': 'PM',
    'Matter Creation': 'MC',
    'Time and Space': 'TS',
    'Sensory Improvement': 'SI',
  };
  return shortNames[school] || school;
};

const toggleSchool = (school: string) => {
  const index = selectedSchools.value.indexOf(school);
  if (index > -1) {
    selectedSchools.value.splice(index, 1);
  } else {
    selectedSchools.value.push(school);
  }
  performSearch();
};

const handleInput = () => {
  emit('update:modelValue', searchQuery.value);
};

const handleSearch = () => {
  performSearch();
  saveRecentSearch();
};

const performSearch = () => {
  emit('search', searchQuery.value, selectedSchools.value, selectedFields.value);
};

const clearSearch = () => {
  searchQuery.value = '';
  selectedSchools.value = [];
  emit('update:modelValue', '');
  performSearch();
};

const applyPreset = (preset: SearchPreset) => {
  searchQuery.value = preset.query;
  selectedSchools.value = [...preset.schools];
  selectedFields.value = [...preset.fields];
  emit('update:modelValue', searchQuery.value);
  performSearch();
  saveRecentSearch();
};

const applyRecentSearch = (search: string) => {
  searchQuery.value = search;
  emit('update:modelValue', search);
  performSearch();
};

const removeRecentSearch = (search: string) => {
  const index = recentSearches.value.indexOf(search);
  if (index > -1) {
    recentSearches.value.splice(index, 1);
    saveRecentSearches();
  }
};

const saveRecentSearch = () => {
  if (!searchQuery.value.trim()) return;

  const query = searchQuery.value.trim();
  const index = recentSearches.value.indexOf(query);

  if (index > -1) {
    recentSearches.value.splice(index, 1);
  }

  recentSearches.value.unshift(query);
  recentSearches.value = recentSearches.value.slice(0, 5); // Keep only 5 recent searches

  saveRecentSearches();
};

const loadRecentSearches = () => {
  try {
    const saved = localStorage.getItem('tinkertools_nano_recent_searches');
    if (saved) {
      recentSearches.value = JSON.parse(saved);
    }
  } catch (error) {
    console.warn('Failed to load recent searches:', error);
  }
};

const saveRecentSearches = () => {
  try {
    localStorage.setItem('tinkertools_nano_recent_searches', JSON.stringify(recentSearches.value));
  } catch (error) {
    console.warn('Failed to save recent searches:', error);
  }
};

// Watch for external changes to modelValue
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue !== searchQuery.value) {
      searchQuery.value = newValue;
    }
  }
);

// Lifecycle
onMounted(() => {
  loadRecentSearches();

  // Initialize selected fields with defaults
  if (selectedFields.value.length === 0) {
    selectedFields.value = ['name', 'description'];
  }
});

// Watch for changes to trigger search
watch(
  [selectedFields],
  () => {
    if (searchQuery.value.trim() || selectedSchools.value.length > 0) {
      performSearch();
    }
  },
  { deep: true }
);
</script>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  max-height: 400px;
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

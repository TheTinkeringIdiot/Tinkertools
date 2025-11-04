<!--
FiltersSection - Filtering controls for TinkerFite

Controls:
- Search query (text input with icon)
- Weapon type dropdown (17 weapon types + "All")
- QL range (dual number inputs: min/max)
-->
<template>
  <div class="filters-section">
    <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
      <!-- Left side: Search and Weapon Type filter -->
      <div class="flex flex-col sm:flex-row gap-3 flex-1">
        <!-- Search -->
        <div class="flex items-center gap-2">
          <i class="pi pi-search text-surface-400"></i>
          <InputText
            v-model="localSearchQuery"
            placeholder="Search weapons..."
            class="w-64"
            @update:model-value="onSearchChange"
          />
        </div>

        <!-- Weapon Type Filter -->
        <Dropdown
          v-model="localWeaponType"
          :options="weaponTypeOptions"
          option-label="label"
          option-value="value"
          placeholder="All Weapon Types"
          showClear
          class="w-56"
          @update:model-value="onWeaponTypeChange"
        />

        <!-- QL Range Filters -->
        <div class="flex items-center gap-2">
          <label class="text-sm text-surface-700 dark:text-surface-300">QL:</label>
          <InputNumber
            v-model="localMinQL"
            :min="1"
            :max="300"
            placeholder="Min"
            class="w-24"
            @update:model-value="onQLChange"
          />
          <span class="text-surface-500">-</span>
          <InputNumber
            v-model="localMaxQL"
            :min="1"
            :max="300"
            placeholder="Max"
            class="w-24"
            @update:model-value="onQLChange"
          />
        </div>
      </div>

      <!-- Right side: Results count -->
      <div class="text-sm text-surface-600 dark:text-surface-400">
        {{ resultCount }} weapon{{ resultCount !== 1 ? 's' : '' }} found
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Dropdown from 'primevue/dropdown';

// Props
interface Props {
  searchQuery: string;
  weaponType: number | null;
  minQL: number | undefined;
  maxQL: number | undefined;
  resultCount: number;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:searchQuery': [query: string];
  'update:weaponType': [type: number | null];
  'update:minQL': [minQL: number | undefined];
  'update:maxQL': [maxQL: number | undefined];
}>();

// Local state for two-way binding
const localSearchQuery = ref(props.searchQuery);
const localWeaponType = ref<number | null>(props.weaponType);
const localMinQL = ref<number | undefined>(props.minQL);
const localMaxQL = ref<number | undefined>(props.maxQL);

// Weapon type options (17 weapon types)
const weaponTypeOptions = [
  { label: 'Martial Arts', value: 100 },
  { label: 'Multi Melee', value: 101 },
  { label: '1h Blunt', value: 102 },
  { label: '1h Edged', value: 103 },
  { label: 'Melee Energy', value: 104 },
  { label: '2h Edged', value: 105 },
  { label: 'Piercing', value: 106 },
  { label: '2h Blunt', value: 107 },
  { label: 'Sharp Objects', value: 108 },
  { label: 'Grenade', value: 109 },
  { label: 'Heavy Weapons', value: 110 },
  { label: 'Bow', value: 111 },
  { label: 'Pistol', value: 112 },
  { label: 'Rifle', value: 113 },
  { label: 'MG/SMG', value: 114 },
  { label: 'Shotgun', value: 115 },
  { label: 'Assault Rifle', value: 116 },
  { label: 'Ranged Energy', value: 133 },
  { label: 'Multi Ranged', value: 134 },
];

// Debounce timer for search
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Event handlers
const onSearchChange = () => {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer);
  }
  searchDebounceTimer = setTimeout(() => {
    emit('update:searchQuery', localSearchQuery.value);
  }, 300);
};

const onWeaponTypeChange = () => {
  emit('update:weaponType', localWeaponType.value);
};

const onQLChange = () => {
  emit('update:minQL', localMinQL.value);
  emit('update:maxQL', localMaxQL.value);
};

// Watch for prop changes from parent
watch(
  () => props.searchQuery,
  (newValue) => {
    localSearchQuery.value = newValue;
  }
);

watch(
  () => props.weaponType,
  (newValue) => {
    localWeaponType.value = newValue;
  }
);

watch(
  () => props.minQL,
  (newValue) => {
    localMinQL.value = newValue;
  }
);

watch(
  () => props.maxQL,
  (newValue) => {
    localMaxQL.value = newValue;
  }
);
</script>

<style scoped>
.filters-section {
  @apply p-4 bg-surface-0 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700;
}
</style>

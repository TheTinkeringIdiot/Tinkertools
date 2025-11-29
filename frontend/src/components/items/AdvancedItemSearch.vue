<!--
AdvancedItemSearch - Comprehensive search interface for TinkerItems
Provides all advanced search capabilities including item class, slot, requirements, and stat bonuses
-->
<template>
  <div class="advanced-item-search h-full flex flex-col bg-surface-0 dark:bg-surface-950">
    <!-- Search Header -->
    <div class="p-4 border-b border-surface-200 dark:border-surface-700">
      <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-2">
        <i class="pi pi-search mr-2"></i>
        Advanced Search
      </h2>

      <!-- Quick Actions -->
      <div class="flex gap-2">
        <Button
          label="Search"
          icon="pi pi-search"
          size="small"
          @click="performSearch"
          :loading="loading"
          :disabled="!hasSearchCriteria"
        />
        <Button
          label="Clear"
          icon="pi pi-times"
          size="small"
          outlined
          @click="clearAll"
          :disabled="!hasSearchCriteria"
        />
      </div>
    </div>

    <!-- Search Form -->
    <div class="flex-1 overflow-y-auto p-4 space-y-6">
      <!-- Item Name Search -->
      <div class="space-y-3">
        <h3 class="text-sm font-medium text-surface-700 dark:text-surface-300">Item Name</h3>

        <div class="space-y-2">
          <InputText
            v-model="searchForm.search"
            placeholder="Search for items..."
            class="w-full"
            @keydown.enter="performSearch"
          />

          <div class="grid grid-cols-2 gap-2">
            <Dropdown
              v-model="searchForm.matchType"
              :options="matchTypeOptions"
              option-label="label"
              option-value="value"
              placeholder="Match Type"
              class="w-full"
            />

            <Dropdown
              v-model="searchForm.searchFields"
              :options="searchFieldOptions"
              option-label="label"
              option-value="value"
              placeholder="Search In"
              class="w-full"
            />
          </div>
        </div>
      </div>

      <!-- Quality Level -->
      <div class="space-y-3">
        <h3 class="text-sm font-medium text-surface-700 dark:text-surface-300">Quality Level</h3>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs text-surface-600 dark:text-surface-400 mb-1">
              Min QL
            </label>
            <InputNumber
              v-model="searchForm.min_ql"
              :min="1"
              :max="999"
              placeholder="1"
              class="w-16 ql-input"
            />
          </div>
          <div>
            <label class="block text-xs text-surface-600 dark:text-surface-400 mb-1">
              Max QL
            </label>
            <InputNumber
              v-model="searchForm.max_ql"
              :min="1"
              :max="999"
              placeholder="999"
              class="w-16 ql-input"
            />
          </div>
        </div>

        <!-- Quick QL Buttons -->
        <div class="flex flex-wrap gap-1">
          <Button
            v-for="range in quickQLRanges"
            :key="range.label"
            :label="range.label"
            size="small"
            outlined
            @click="setQLRange(range.min, range.max)"
          />
        </div>
      </div>

      <!-- Item Class and Slot -->
      <div class="space-y-3">
        <h3 class="text-sm font-medium text-surface-700 dark:text-surface-300">Item Type</h3>

        <div class="space-y-2">
          <div>
            <label class="block text-xs text-surface-600 dark:text-surface-400 mb-1">
              Item Class
            </label>
            <Dropdown
              v-model="searchForm.item_class"
              :options="itemClassOptions"
              option-label="label"
              option-value="value"
              placeholder="Any"
              class="w-full"
              @change="onItemClassChange"
            />
          </div>

          <div v-if="availableSlots.length > 0">
            <label class="block text-xs text-surface-600 dark:text-surface-400 mb-1">
              Equipment Slot
            </label>
            <Dropdown
              v-model="searchForm.slot"
              :options="availableSlots"
              option-label="label"
              option-value="value"
              placeholder="Any"
              class="w-full"
            />
          </div>
        </div>
      </div>

      <!-- Requirements -->
      <div class="space-y-3">
        <h3 class="text-sm font-medium text-surface-700 dark:text-surface-300">Requirements</h3>

        <div class="grid grid-cols-1 gap-2">
          <div>
            <label class="block text-xs text-surface-600 dark:text-surface-400 mb-1">
              Profession
            </label>
            <Dropdown
              v-model="searchForm.profession"
              :options="professionOptions"
              option-label="label"
              option-value="value"
              placeholder="Any"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-xs text-surface-600 dark:text-surface-400 mb-1"> Breed </label>
            <Dropdown
              v-model="searchForm.breed"
              :options="breedOptions"
              option-label="label"
              option-value="value"
              placeholder="Any"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-xs text-surface-600 dark:text-surface-400 mb-1">
              Gender
            </label>
            <Dropdown
              v-model="searchForm.gender"
              :options="genderOptions"
              option-label="label"
              option-value="value"
              placeholder="Any"
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-xs text-surface-600 dark:text-surface-400 mb-1">
              Faction
            </label>
            <Dropdown
              v-model="searchForm.faction"
              :options="factionOptions"
              option-label="label"
              option-value="value"
              placeholder="Any"
              class="w-full"
            />
          </div>
        </div>
      </div>

      <!-- Special Filters -->
      <div class="space-y-3">
        <h3 class="text-sm font-medium text-surface-700 dark:text-surface-300">Special Filters</h3>

        <div class="space-y-2">
          <div class="flex items-center">
            <Checkbox
              :key="`froob-${checkboxKey}`"
              v-model="searchForm.froob_friendly"
              input-id="froob-friendly"
              class="enhanced-checkbox"
            />
            <label for="froob-friendly" class="ml-2 text-sm"> Froob Friendly </label>
          </div>

          <div class="flex items-center">
            <Checkbox
              :key="`nodrop-${checkboxKey}`"
              v-model="searchForm.nodrop"
              input-id="nodrop"
              class="enhanced-checkbox"
            />
            <label for="nodrop" class="ml-2 text-sm"> NoDrop </label>
          </div>
        </div>
      </div>

      <!-- Stat Bonuses -->
      <div class="space-y-3">
        <h3 class="text-sm font-medium text-surface-700 dark:text-surface-300">Stat Bonuses</h3>

        <div class="grid grid-cols-2 gap-2">
          <div v-for="stat in statBonusOptions" :key="stat.value" class="flex items-center">
            <Checkbox
              v-model="selectedStatBonuses"
              :value="stat.value"
              :input-id="`stat-${stat.value}`"
              class="enhanced-checkbox"
            />
            <label :for="`stat-${stat.value}`" class="ml-2 text-sm">
              {{ stat.label }}
            </label>
          </div>
        </div>
      </div>

      <!-- Stat Filters -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-surface-700 dark:text-surface-300">Stat Filters</h3>
          <Button
            label="Add Filter"
            icon="pi pi-plus"
            size="small"
            outlined
            @click="showStatFilterModal = true"
          />
        </div>

        <div
          v-if="statFilters.length === 0"
          class="text-sm text-surface-500 dark:text-surface-400 text-center py-4 border border-dashed border-surface-300 dark:border-surface-600 rounded"
        >
          No stat filters added. Click "Add Filter" to search by stat requirements or modifications.
        </div>

        <div v-else class="space-y-2">
          <StatFilterCard
            v-for="(filter, index) in statFilters"
            :key="`filter-${index}`"
            :filter="filter"
            @remove="removeStatFilter(index)"
          />
        </div>

        <div v-if="statFilters.length > 0" class="text-xs text-surface-500 dark:text-surface-400">
          <div class="flex items-center gap-1">
            <i class="pi pi-info-circle"></i>
            <span>
              <strong>REQ:</strong> Items that need the stat to equip/use.
              <strong>MOD:</strong> Items that boost the stat when equipped.
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Search Results Summary -->
    <div v-if="hasSearched" class="p-4 border-t border-surface-200 dark:border-surface-700">
      <div class="text-sm text-surface-600 dark:text-surface-400">
        {{ resultCount }} items found
        <Button
          v-if="hasSearchCriteria"
          label="Save Search"
          icon="pi pi-bookmark"
          size="small"
          text
          @click="saveSearch"
          class="ml-2"
        />
      </div>
    </div>

    <!-- Stat Filter Modal -->
    <StatFilterModal v-model:visible="showStatFilterModal" @add-filter="addStatFilter" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import type { ItemSearchQuery, StatFilter } from '@/types/api';
import StatFilterModal from './StatFilterModal.vue';
import StatFilterCard from './StatFilterCard.vue';
import { useItemsStore } from '@/stores/items';
import {
  ITEM_CLASS,
  WEAPON_SLOT_POSITIONS,
  ARMOR_SLOT_POSITION,
  IMPLANT_SLOT_POSITION,
  PROFESSION,
  BREED,
  GENDER,
  FACTION,
} from '@/services/game-data';

interface SearchFormData {
  search: string;
  matchType: string;
  searchFields: string;
  min_ql?: number;
  max_ql?: number;
  item_class?: number;
  slot?: number;
  profession?: number;
  breed?: number;
  gender?: number;
  faction?: number;
  froob_friendly?: boolean;
  nodrop?: boolean;
}

const props = defineProps<{
  loading?: boolean;
  resultCount?: number;
}>();

const emit = defineEmits<{
  search: [query: ItemSearchQuery];
  clear: [];
}>();

// Form state
const searchForm = ref<SearchFormData>({
  search: '',
  matchType: 'fuzzy',
  searchFields: 'name',
});

const selectedStatBonuses = ref<number[]>([]);
const statFilters = ref<StatFilter[]>([]);
const hasSearched = ref(false);
const checkboxKey = ref(0); // Used to force checkbox re-render
const showStatFilterModal = ref(false);

// Store
const itemsStore = useItemsStore();

// Options
const matchTypeOptions = [
  { label: 'Exact Match', value: 'exact' },
  { label: 'Fuzzy Search', value: 'fuzzy' },
];

const searchFieldOptions = [
  { label: 'Both', value: 'both' },
  { label: 'Item Name', value: 'name' },
  { label: 'Description', value: 'description' },
];

const quickQLRanges = [
  { label: '1-50', min: 1, max: 50 },
  { label: '51-100', min: 51, max: 100 },
  { label: '101-200', min: 101, max: 200 },
  { label: '201-300', min: 201, max: 300 },
];

const itemClassOptions = [
  { label: 'Any', value: 0 },
  ...Object.entries(ITEM_CLASS)
    .filter(([key]) => key !== '0')
    .map(([key, value]) => ({
      label: value,
      value: parseInt(key),
    })),
];

const professionOptions = [
  { label: 'Any', value: 0 },
  ...Object.entries(PROFESSION)
    .filter(([key]) => key !== '0')
    .map(([key, value]) => ({
      label: value,
      value: parseInt(key),
    })),
];

const breedOptions = [
  { label: 'Any', value: 0 },
  ...Object.entries(BREED)
    .filter(([key]) => key !== '0')
    .map(([key, value]) => ({
      label: value,
      value: parseInt(key),
    })),
];

const genderOptions = [
  { label: 'Any', value: 0 },
  ...Object.entries(GENDER)
    .filter(([key]) => key !== '0')
    .map(([key, value]) => ({
      label: value,
      value: parseInt(key),
    })),
];

const factionOptions = [
  { label: 'Any', value: 0 },
  ...Object.entries(FACTION)
    .filter(([key]) => key !== '0')
    .map(([key, value]) => ({
      label: value,
      value: parseInt(key),
    })),
];

const statBonusOptions = [
  { label: 'Strength', value: 16 },
  { label: 'Agility', value: 17 },
  { label: 'Stamina', value: 18 },
  { label: 'Intelligence', value: 19 },
  { label: 'Sense', value: 20 },
  { label: 'Psychic', value: 21 },
  { label: 'Treatment', value: 124 },
  { label: 'CompLit', value: 161 },
];

// Computed properties
const hasSearchCriteria = computed(() => {
  return !!(
    searchForm.value.search?.trim() ||
    searchForm.value.min_ql ||
    searchForm.value.max_ql ||
    (searchForm.value.item_class && searchForm.value.item_class > 0) ||
    (searchForm.value.slot && searchForm.value.slot > 0) ||
    (searchForm.value.profession && searchForm.value.profession > 0) ||
    (searchForm.value.breed && searchForm.value.breed > 0) ||
    (searchForm.value.gender && searchForm.value.gender > 0) ||
    (searchForm.value.faction && searchForm.value.faction > 0) ||
    searchForm.value.froob_friendly ||
    searchForm.value.nodrop ||
    selectedStatBonuses.value.length > 0 ||
    statFilters.value.length > 0
  );
});

const availableSlots = computed(() => {
  if (!searchForm.value.item_class || searchForm.value.item_class === 0) {
    return [];
  }

  let slots: Record<string, string> = {};

  switch (searchForm.value.item_class) {
    case 1: // Weapon
      slots = WEAPON_SLOT_POSITIONS;
      break;
    case 2: // Armor
      slots = ARMOR_SLOT_POSITION;
      break;
    case 3: // Implant
      slots = IMPLANT_SLOT_POSITION;
      break;
    default:
      return [];
  }

  return [
    { label: 'Any', value: 0 },
    ...Object.entries(slots)
      .filter(([key]) => key !== '0')
      .map(([key, value]) => ({
        label: value,
        value: parseInt(key),
      })),
  ];
});

// Methods
function performSearch() {
  const query: ItemSearchQuery = {};

  // Basic search
  if (searchForm.value.search?.trim()) {
    query.search = searchForm.value.search.trim();
    query.exact_match = searchForm.value.matchType === 'exact';

    // Set search fields
    if (searchForm.value.searchFields === 'name') {
      query.search_fields = ['name'];
    } else if (searchForm.value.searchFields === 'description') {
      query.search_fields = ['description'];
    } else {
      query.search_fields = ['name', 'description'];
    }
  }

  // Quality level
  if (searchForm.value.min_ql) query.min_ql = searchForm.value.min_ql;
  if (searchForm.value.max_ql) query.max_ql = searchForm.value.max_ql;

  // Item class and slot
  if (searchForm.value.item_class && searchForm.value.item_class > 0) {
    query.item_class = searchForm.value.item_class;
  }
  if (searchForm.value.slot && searchForm.value.slot > 0) {
    query.slot = searchForm.value.slot;
  }

  // Requirements
  if (searchForm.value.profession && searchForm.value.profession > 0) {
    query.profession = searchForm.value.profession;
  }
  if (searchForm.value.breed && searchForm.value.breed > 0) {
    query.breed = searchForm.value.breed;
  }
  if (searchForm.value.gender && searchForm.value.gender > 0) {
    query.gender = searchForm.value.gender;
  }
  if (searchForm.value.faction && searchForm.value.faction > 0) {
    query.faction = searchForm.value.faction;
  }

  // Special filters
  if (searchForm.value.froob_friendly) {
    query.froob_friendly = true;
  }
  if (searchForm.value.nodrop) {
    query.nodrop = true;
  }

  // Stat bonuses
  if (selectedStatBonuses.value.length > 0) {
    query.stat_bonuses = [...selectedStatBonuses.value];
  }

  // Stat filters
  if (statFilters.value.length > 0) {
    // Only include complete filters (all fields filled)
    const completeFilters = statFilters.value.filter(
      (filter) =>
        filter.function &&
        filter.stat !== undefined &&
        filter.operator &&
        filter.value !== undefined
    );
    if (completeFilters.length > 0) {
      query.stat_filters = completeFilters;
    }
  }

  hasSearched.value = true;
  emit('search', query);
}

function clearAll() {
  searchForm.value = {
    search: '',
    matchType: 'fuzzy',
    searchFields: 'name',
  };
  selectedStatBonuses.value = [];
  statFilters.value = [];
  hasSearched.value = false;
  emit('clear');
}

async function restoreSearchState() {
  const storedQuery = itemsStore.currentSearchQuery;
  if (!storedQuery) return;

  console.log('Restoring search state, stored query:', storedQuery);

  // Restore basic search fields
  if (storedQuery.search) {
    searchForm.value.search = storedQuery.search;
    searchForm.value.matchType = storedQuery.exact_match ? 'exact' : 'fuzzy';

    // Determine search fields
    if (storedQuery.search_fields) {
      if (storedQuery.search_fields.length === 1) {
        searchForm.value.searchFields = storedQuery.search_fields[0];
      } else {
        searchForm.value.searchFields = 'both';
      }
    }
  }

  // Restore quality level
  if (storedQuery.min_ql) searchForm.value.min_ql = storedQuery.min_ql;
  if (storedQuery.max_ql) searchForm.value.max_ql = storedQuery.max_ql;

  // Restore item class and slot
  if (storedQuery.item_class) searchForm.value.item_class = storedQuery.item_class;
  if (storedQuery.slot) searchForm.value.slot = storedQuery.slot;

  // Restore requirements
  if (storedQuery.profession) searchForm.value.profession = storedQuery.profession;
  if (storedQuery.breed) searchForm.value.breed = storedQuery.breed;
  if (storedQuery.gender) searchForm.value.gender = storedQuery.gender;
  if (storedQuery.faction) searchForm.value.faction = storedQuery.faction;

  // Restore special filters using key-based component re-rendering
  console.log(
    'Froob friendly in stored query:',
    storedQuery.froob_friendly,
    typeof storedQuery.froob_friendly
  );
  if (storedQuery.froob_friendly !== undefined) {
    searchForm.value.froob_friendly = storedQuery.froob_friendly;
    console.log('Set froob_friendly to:', searchForm.value.froob_friendly);
  }
  if (storedQuery.nodrop !== undefined) {
    searchForm.value.nodrop = storedQuery.nodrop;
  }

  // Force checkbox components to re-render with updated state
  checkboxKey.value++;

  // Restore stat bonuses
  if (storedQuery.stat_bonuses && Array.isArray(storedQuery.stat_bonuses)) {
    selectedStatBonuses.value = storedQuery.stat_bonuses;
  }

  // Restore stat filters
  if (storedQuery.stat_filters && Array.isArray(storedQuery.stat_filters)) {
    statFilters.value = storedQuery.stat_filters.map((filter) => ({ ...filter }));
  }

  // Mark as having searched if we restored any criteria
  hasSearched.value = true;

  console.log('Final searchForm after restoration:', searchForm.value);

  // Wait for component re-render and force DOM sync
  await nextTick();
  console.log('Components re-rendered with new key, checkbox should be updated');

  // Additional DOM sync for checkboxes after component re-render
  await nextTick();
  if (storedQuery.froob_friendly) {
    const froobCheckbox = document.querySelector('#froob-friendly');
    if (froobCheckbox && !froobCheckbox.checked) {
      froobCheckbox.checked = true;
      console.log('Manually synced froob checkbox to DOM');
    }
  }
  if (storedQuery.nodrop) {
    const nodropCheckbox = document.querySelector('#nodrop');
    if (nodropCheckbox && !nodropCheckbox.checked) {
      nodropCheckbox.checked = true;
      console.log('Manually synced nodrop checkbox to DOM');
    }
  }
}

function setQLRange(min: number, max: number) {
  searchForm.value.min_ql = min;
  searchForm.value.max_ql = max;
}

function onItemClassChange() {
  // Clear slot when item class changes
  searchForm.value.slot = undefined;
}

function saveSearch() {
  // TODO: Implement saved searches functionality
  console.log('Save search functionality not yet implemented');
}

// Stat filter management methods
function addStatFilter(filter: StatFilter) {
  statFilters.value.push({ ...filter });
}

function removeStatFilter(index: number) {
  if (index >= 0 && index < statFilters.value.length) {
    statFilters.value.splice(index, 1);
  }
}

// Watch for item class changes to clear slot
watch(
  () => searchForm.value.item_class,
  () => {
    searchForm.value.slot = undefined;
  }
);

// Restore search state on mount
onMounted(async () => {
  await restoreSearchState();
});

// Expose for tests
defineExpose({
  searchForm,
  selectedStatBonuses,
  hasSearchCriteria,
  hasSearched,
});
</script>

<style scoped>
.advanced-item-search {
  min-width: 320px;
}

/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  @apply bg-surface-100 dark:bg-surface-800;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  @apply bg-surface-300 dark:bg-surface-600 rounded-full;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  @apply bg-surface-400 dark:bg-surface-500;
}

/* Enhanced checkbox styling for better visibility */
:deep(.enhanced-checkbox .p-checkbox-box) {
  width: 18px !important;
  height: 18px !important;
  border: 2px solid #6b7280 !important;
  background-color: #ffffff !important;
  border-radius: 4px !important;
  transition: all 0.2s ease !important;
  cursor: pointer !important;
  position: relative !important;
}

/* Dark mode styling */
:root.dark :deep(.enhanced-checkbox .p-checkbox-box) {
  border-color: #9ca3af !important;
  background-color: #374151 !important;
}

/* Hover state */
:deep(.enhanced-checkbox:hover .p-checkbox-box) {
  border-color: #3b82f6 !important;
  background-color: #dbeafe !important;
}

:root.dark :deep(.enhanced-checkbox:hover .p-checkbox-box) {
  border-color: #60a5fa !important;
  background-color: #1e3a8a !important;
}

/* Checked state - handle both icon-based and non-icon checkboxes */
:deep(.enhanced-checkbox .p-checkbox-box.p-highlight),
:deep(.enhanced-checkbox .p-checkbox-box:has(.p-checkbox-icon)),
:deep(.enhanced-checkbox input:checked + .p-checkbox-box) {
  border-color: #10b981 !important;
  background-color: #10b981 !important;
}

:root.dark :deep(.enhanced-checkbox .p-checkbox-box.p-highlight),
:root.dark :deep(.enhanced-checkbox .p-checkbox-box:has(.p-checkbox-icon)),
:root.dark :deep(.enhanced-checkbox input:checked + .p-checkbox-box) {
  border-color: #34d399 !important;
  background-color: #34d399 !important;
}

/* Hide PrimeVue's default SVG icons and use consistent text checkmark */
:deep(.enhanced-checkbox .p-checkbox-box .p-checkbox-icon) {
  display: none !important;
}

/* Add consistent checkmark using CSS for ALL checked checkboxes */
:deep(.enhanced-checkbox input:checked + .p-checkbox-box)::after {
  content: '✓';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ffffff !important;
  font-size: 14px !important;
  font-weight: 900 !important;
  line-height: 1;
}

:root.dark :deep(.enhanced-checkbox input:checked + .p-checkbox-box)::after {
  color: #ffffff !important;
}

/* Focus ring for accessibility */
:deep(.enhanced-checkbox .p-checkbox-box:focus-visible) {
  outline: 2px solid #3b82f6 !important;
  outline-offset: 2px !important;
}

/* QL input field width override */
:deep(.ql-input .p-inputnumber-input) {
  width: 4rem !important;
}
</style>

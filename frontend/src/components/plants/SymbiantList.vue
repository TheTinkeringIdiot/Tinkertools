<!--
SymbiantList - Display symbiants in list format
Shows symbiants with search, filtering, and pagination
-->
<template>
  <div class="symbiant-list h-full flex flex-col">
    <!-- List Header -->
    <div class="flex-shrink-0 p-3 border-b border-surface-200 dark:border-surface-700">
      <div class="flex items-center justify-between">
        <div class="text-sm text-surface-600 dark:text-surface-400">
          {{ symbiants.length }} symbiants
        </div>
        <div class="flex items-center gap-2">
          <Dropdown
            v-model="sortBy"
            :options="sortOptions"
            option-label="label"
            option-value="value"
            placeholder="Sort by"
            class="w-32"
          />
          <Button
            @click="toggleSortOrder"
            :icon="sortOrder === 'asc' ? 'pi pi-sort-up' : 'pi pi-sort-down'"
            size="small"
            text
            :aria-label="`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`"
          />
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <ProgressSpinner />
    </div>

    <!-- Symbiant List -->
    <div v-else-if="sortedSymbiants.length > 0" class="flex-1 overflow-y-auto">
      <div class="p-2 space-y-2">
        <div
          v-for="symbiant in paginatedSymbiants"
          :key="symbiant.id"
          @click="selectSymbiant(symbiant)"
          class="symbiant-card p-3 border border-surface-200 dark:border-surface-700 rounded hover:border-primary-300 dark:hover:border-primary-600 hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer transition-all"
        >
          <div class="flex items-start justify-between">
            <!-- Symbiant Info -->
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-medium text-surface-900 dark:text-surface-100">
                  {{ symbiant.name }}
                </span>
                <Badge
                  v-if="symbiant.qualityLevel"
                  :value="`QL ${symbiant.qualityLevel}`"
                  severity="info"
                />
              </div>

              <div class="text-sm text-surface-600 dark:text-surface-400 mb-2">
                <div class="flex items-center gap-3">
                  <span v-if="symbiant.family">
                    <i class="pi pi-objects-column mr-1"></i>
                    {{ symbiant.family }}
                  </span>
                  <span v-if="symbiant.slot">
                    <i class="pi pi-user mr-1"></i>
                    {{ formatSlotName(symbiant.slot) }}
                  </span>
                </div>
              </div>

              <!-- Description -->
              <p
                v-if="symbiant.description"
                class="text-xs text-surface-500 dark:text-surface-400 line-clamp-2"
              >
                {{ symbiant.description }}
              </p>

              <!-- Stat Bonuses (if available) -->
              <div v-if="symbiant.statBonuses && symbiant.statBonuses.length > 0" class="mt-2">
                <div class="flex flex-wrap gap-1">
                  <Badge
                    v-for="bonus in symbiant.statBonuses.slice(0, 3)"
                    :key="bonus.statId"
                    :value="`+${bonus.value} ${formatStatName(bonus.statId)}`"
                    severity="success"
                    size="small"
                  />
                  <Badge
                    v-if="symbiant.statBonuses.length > 3"
                    :value="`+${symbiant.statBonuses.length - 3} more`"
                    severity="secondary"
                    size="small"
                  />
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1 ml-3">
              <Button
                v-if="buildMode"
                @click.stop="addToBuild(symbiant)"
                icon="pi pi-plus"
                size="small"
                text
                severity="secondary"
                aria-label="Add to build"
              />
              <Button
                @click.stop="viewDetails(symbiant)"
                icon="pi pi-eye"
                size="small"
                text
                severity="secondary"
                aria-label="View details"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="flex-1 flex flex-col items-center justify-center text-center">
      <i class="pi pi-inbox text-4xl text-surface-400 dark:text-surface-600 mb-4"></i>
      <h3 class="text-lg font-medium text-surface-700 dark:text-surface-300 mb-2">
        No symbiants found
      </h3>
      <p class="text-surface-500 dark:text-surface-400">
        Try adjusting your search criteria or filters
      </p>
    </div>

    <!-- Pagination -->
    <div
      v-if="totalPages > 1"
      class="flex-shrink-0 p-3 border-t border-surface-200 dark:border-surface-700"
    >
      <Paginator
        :rows="pageSize"
        :totalRecords="sortedSymbiants.length"
        :first="currentPage * pageSize"
        @page="onPageChange"
        template="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
        currentPageReportTemplate="Showing {first} to {last} of {totalRecords}"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import Paginator from 'primevue/paginator';
import ProgressSpinner from 'primevue/progressspinner';

import type { PlantSymbiant } from '@/types/plants';

interface Props {
  symbiants: PlantSymbiant[];
  loading?: boolean;
  buildMode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  buildMode: false,
});

interface Emits {
  (e: 'symbiant-select', symbiant: PlantSymbiant): void;
  (e: 'add-to-build', symbiant: PlantSymbiant): void;
  (e: 'page-change', page: number): void;
}

const emit = defineEmits<Emits>();

// Reactive state
const sortBy = ref('name');
const sortOrder = ref<'asc' | 'desc'>('asc');
const currentPage = ref(0);
const pageSize = ref(20);

const sortOptions = [
  { label: 'Name', value: 'name' },
  { label: 'Family', value: 'family' },
  { label: 'Quality Level', value: 'qualityLevel' },
  { label: 'Slot', value: 'slot' },
];

// Computed
const sortedSymbiants = computed(() => {
  const sorted = [...props.symbiants].sort((a, b) => {
    let aValue: any = a[sortBy.value as keyof Symbiant];
    let bValue: any = b[sortBy.value as keyof Symbiant];

    // Handle null/undefined values
    if (aValue == null) aValue = '';
    if (bValue == null) bValue = '';

    // Convert to string for comparison
    aValue = String(aValue).toLowerCase();
    bValue = String(bValue).toLowerCase();

    if (sortOrder.value === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });

  return sorted;
});

const totalPages = computed(() => Math.ceil(sortedSymbiants.value.length / pageSize.value));

const paginatedSymbiants = computed(() => {
  const start = currentPage.value * pageSize.value;
  const end = start + pageSize.value;
  return sortedSymbiants.value.slice(start, end);
});

// Methods
const formatSlotName = (slot: string): string => {
  const slotNames: Record<string, string> = {
    head: 'Head',
    eye: 'Eye',
    ear: 'Ear',
    rarm: 'Right Arm',
    chest: 'Chest',
    larm: 'Left Arm',
    waist: 'Waist',
    rwrist: 'Right Wrist',
    legs: 'Legs',
    lwrist: 'Left Wrist',
    rfinger: 'Right Finger',
    feet: 'Feet',
    lfinger: 'Left Finger',
  };
  return slotNames[slot] || slot;
};

const formatStatName = (statId: string): string => {
  const statNames: Record<string, string> = {
    strength: 'STR',
    agility: 'AGI',
    stamina: 'STA',
    intelligence: 'INT',
    sense: 'SEN',
    psychic: 'PSY',
  };
  return statNames[statId] || statId.toUpperCase();
};

const selectSymbiant = (symbiant: PlantSymbiant) => {
  emit('symbiant-select', symbiant);
};

const addToBuild = (symbiant: PlantSymbiant) => {
  emit('add-to-build', symbiant);
};

const viewDetails = (symbiant: PlantSymbiant) => {
  emit('symbiant-select', symbiant);
};

const toggleSortOrder = () => {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
};

const onPageChange = (event: any) => {
  currentPage.value = event.page;
  emit('page-change', event.page);
};

// Reset page when symbiants change
watch(
  () => props.symbiants,
  () => {
    currentPage.value = 0;
  }
);
</script>

<style scoped>
.symbiant-card {
  transition: all 0.2s ease;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

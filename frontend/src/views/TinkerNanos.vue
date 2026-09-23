<!--
TinkerNanos - Nano Program Browser with Search
Browse nano programs by profession or search across all nanos
-->
<template>
  <div class="tinker-nanos h-full flex flex-col">
    <!-- Header with View Mode Toggle -->
    <div
      class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4"
    >
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
            <i class="pi pi-flash mr-2"></i>
            TinkerNanos
          </h1>
          <Badge v-if="selectedProfessionName" :value="selectedProfessionName" severity="info" />
          <Badge :value="`${nanoCount} nanos`" severity="secondary" />
        </div>
        <div class="flex items-center gap-4">
          <!-- Compatibility Toggle: checks the nanos against the active profile -->
          <span
            v-if="isSearchMode"
            v-tooltip.bottom="compatibilityTooltip"
            class="flex items-center gap-2"
            data-testid="compatibility-toggle"
          >
            <InputSwitch
              v-model="showCompatibility"
              input-id="compatibility-toggle"
              :disabled="!profilesStore.hasActiveProfile"
            />
            <label
              for="compatibility-toggle"
              class="text-sm text-surface-700 dark:text-surface-300"
              :class="{ 'opacity-60': !profilesStore.hasActiveProfile }"
            >
              Show Compatibility
            </label>
          </span>
          <Button
            label="Search Mode"
            :severity="isSearchMode ? 'primary' : 'secondary'"
            :outlined="!isSearchMode"
            @click="toggleSearchMode"
          />
        </div>
      </div>
    </div>

    <!-- Search Mode Content -->
    <div v-if="isSearchMode" class="flex-1 flex flex-col min-h-0">
      <!-- Search Bar -->
      <div class="p-4 border-b border-surface-200 dark:border-surface-700">
        <NanoSearch
          v-model="searchQuery"
          :total-results="nanoCount"
          :schools="nanosStore.filters.schools"
          @search="handleSearch"
        />
      </div>

      <!-- Filters -->
      <div class="p-4 border-b border-surface-200 dark:border-surface-700">
        <NanoFilters
          v-model="filters"
          :show-compatibility="showCompatibility"
          :active-profile="activeProfile"
          :available-strains="nanosStore.availableStrains"
          @filter-change="handleFilterChange"
        />
        <Button
          label="Clear All Filters"
          size="small"
          severity="secondary"
          text
          @click="clearAllFilters"
        />
      </div>

      <!-- Results -->
      <div class="flex-1 overflow-auto">
        <!-- Too many matches to check them all against the profile -->
        <Message
          v-if="nanosStore.compatibilityOverflow !== null"
          severity="warn"
          :closable="false"
          class="m-4"
          data-testid="compatibility-overflow"
        >
          {{ nanosStore.compatibilityOverflow.toLocaleString() }} nanos match your filters, more
          than the {{ COMPATIBILITY_FETCH_CAP.toLocaleString() }} the compatibility filters can
          check. Narrow the list by profession, school or level to use them.
        </Message>
        <NanoList
          v-else
          :nanos="nanosStore.filteredNanos"
          :loading="nanosStore.loading"
          :show-compatibility="showCompatibility"
          :active-profile="activeProfile"
          :total-records="nanosStore.needsAllResults ? null : nanosStore.totalCount"
          :page="nanosStore.page"
          :rows="nanosStore.pageSize"
          @nano-select="handleNanoSelect"
          @page-change="handlePageChange"
        />
      </div>
    </div>

    <!-- Profession Browse Mode Content -->
    <div v-else class="flex-1 flex min-h-0">
      <!-- Left Panel - Profession List -->
      <div class="w-80 border-r border-surface-200 dark:border-surface-700">
        <ProfessionList
          :selected-profession="nanosStore.selectedProfession"
          @profession-selected="onProfessionSelected"
        />
      </div>

      <!-- Right Panel - Profession Nanos -->
      <div class="flex-1">
        <ProfessionNanoDisplay
          :selected-profession="nanosStore.selectedProfession"
          :loading="nanosStore.loading"
        />
      </div>
    </div>

    <!-- Nano Detail Dialog -->
    <NanoDetail
      v-model:visible="showNanoDetail"
      :nano="selectedNano"
      :active-profile="activeProfile"
      :show-compatibility="showCompatibility"
      @close="showNanoDetail = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import InputSwitch from 'primevue/inputswitch';
import Message from 'primevue/message';
import ProfessionList from '@/components/nanos/ProfessionList.vue';
import ProfessionNanoDisplay from '@/components/nanos/ProfessionNanoDisplay.vue';
import NanoSearch from '@/components/nanos/NanoSearch.vue';
import NanoFilters from '@/components/nanos/NanoFilters.vue';
import NanoList from '@/components/nanos/NanoList.vue';
import NanoDetail from '@/components/nanos/NanoDetail.vue';
import { PROFESSION } from '@/services/game-data';
import { COMPATIBILITY_FETCH_CAP, useNanosStore } from '@/stores/nanosStore';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import type { NanoProgram, NanoFilters as NanoFilterState } from '@/types/nano';

// Stores
const nanosStore = useNanosStore();
const profilesStore = useTinkerProfilesStore();

// Local state
const isSearchMode = ref(false);
const searchQuery = ref('');
const showNanoDetail = ref(false);
const selectedNano = ref<NanoProgram | null>(null);
const filters = ref(nanosStore.filters);

// Computed
const selectedProfessionName = computed(() => {
  if (!nanosStore.selectedProfession) return null;
  return PROFESSION[nanosStore.selectedProfession as keyof typeof PROFESSION] || 'Unknown';
});

/**
 * Whether nanos are checked against the active profile. The choice is a
 * remembered nano preference; it only takes effect while a profile is active.
 */
const showCompatibility = computed({
  get: () => nanosStore.preferences.showCompatibility && profilesStore.hasActiveProfile,
  set: (value: boolean) => nanosStore.updatePreferences({ showCompatibility: value }),
});

const compatibilityTooltip = computed(() =>
  profilesStore.hasActiveProfile
    ? `Check each nano's casting requirements against ${profilesStore.activeProfileName}`
    : 'Create or select an active profile to check nano compatibility'
);

/** The profile compatibility is shown for, as the store evaluates it */
const activeProfile = computed(() => nanosStore.compatibilityProfile);

/**
 * The header count: every nano the filters match, server-side or, while the
 * compatibility filters run, after them
 */
const nanoCount = computed(() =>
  isSearchMode.value ? nanosStore.resultCount : nanosStore.nanos.length
);

// Methods
async function toggleSearchMode() {
  isSearchMode.value = !isSearchMode.value;
  if (isSearchMode.value) {
    await nanosStore.loadNanos(1);
  }
}

function handleSearch(query: string, schools: string[]) {
  // Both go to the server; the requestKey watcher reloads
  nanosStore.setSearchQuery(query);
  // Deselecting every school chip must clear the school filter too
  nanosStore.setFilters({ schools: [...schools] });
}

function handlePageChange(page: number, rows: number) {
  void nanosStore.setPage(page, rows);
}

function handleFilterChange(newFilters: NanoFilterState) {
  filters.value = newFilters;
  nanosStore.setFilters(newFilters);
}

function clearAllFilters() {
  searchQuery.value = '';
  nanosStore.setSearchQuery('');
  nanosStore.clearFilters();
  filters.value = nanosStore.filters;
}

function handleNanoSelect(nano: NanoProgram) {
  selectedNano.value = nano;
  showNanoDetail.value = true;
}

function onProfessionSelected(professionId: number) {
  console.log('Profession selected:', professionId);
  nanosStore.setSelectedProfession(professionId);
}

// A change to what the server is asked for reloads from the first page
watch(
  () => nanosStore.requestKey,
  () => {
    if (isSearchMode.value) void nanosStore.loadNanos(1);
  }
);

// Watch for filter changes in store
watch(
  () => nanosStore.filters,
  (newFilters) => {
    filters.value = newFilters;
  },
  { deep: true }
);
</script>

<style scoped>
.tinker-nanos {
  background: var(--surface-ground);
}
</style>

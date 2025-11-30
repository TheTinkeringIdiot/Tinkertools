<!--
ClusterLookup - Cluster search component for TinkerPlants
Provides AutoComplete search to find clusters and highlight matching implant slots
Part of TinkerPlants Revamp - Task 3.4
-->
<template>
  <div
    class="cluster-lookup bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-4"
  >
    <div class="flex items-center gap-3">
      <!-- Title Label -->
      <label
        for="cluster-search"
        class="text-sm font-medium text-surface-700 dark:text-surface-300 whitespace-nowrap"
      >
        Cluster Lookup:
      </label>

      <!-- Search Input with AutoComplete -->
      <AutoComplete
        v-model="searchQuery"
        :suggestions="filteredClusters"
        @complete="onSearch"
        @item-select="onClusterSelect"
        placeholder="Type cluster name (e.g., Rifle, Strength, Max NCU)..."
        input-id="cluster-search"
        class="flex-1"
        :min-length="1"
        complete-on-focus
        dropdown
      >
        <template #option="{ option }">
          <div class="flex items-center gap-2">
            <i class="pi pi-box text-surface-500"></i>
            <span>{{ option }}</span>
          </div>
        </template>
      </AutoComplete>

      <!-- Clear Button -->
      <Button
        v-if="selectedCluster"
        icon="pi pi-times"
        text
        rounded
        size="small"
        @click="resetSelection"
        v-tooltip.bottom="'Clear Selection'"
        aria-label="Clear cluster selection"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import AutoComplete from 'primevue/autocomplete';
import Button from 'primevue/button';
import { getAllUniqueClusters, getSlotsForCluster } from '@/utils/cluster-utilities';
import type { ClusterType, ImpSlotName } from '@/services/game-data';

// ============================================================================
// Types
// ============================================================================

interface MatchingSlot {
  slot: ImpSlotName;
  types: ClusterType[];
}

// ============================================================================
// Props & Emits
// ============================================================================

interface Props {
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
});

interface Emits {
  (e: 'clusterSelected', clusterName: string, matchingSlots: MatchingSlot[]): void;
  (e: 'cluster-reset'): void;
}

const emit = defineEmits<Emits>();

// ============================================================================
// Reactive State
// ============================================================================

const searchQuery = ref<string>('');
const selectedCluster = ref<string | null>(null);
const filteredClusters = ref<string[]>([]);

// All available clusters (cached)
const allClusters = computed<string[]>(() => {
  return getAllUniqueClusters(false).sort((a, b) => a.localeCompare(b));
});

// Matching slots for selected cluster
const matchingSlots = computed<MatchingSlot[]>(() => {
  if (!selectedCluster.value) {
    return [];
  }

  return getSlotsForCluster(selectedCluster.value);
});

// ============================================================================
// Methods
// ============================================================================

/**
 * Handle AutoComplete search event
 * Filters clusters based on user input
 */
function onSearch(event: { query: string }) {
  const query = event.query.toLowerCase().trim();

  if (!query) {
    filteredClusters.value = allClusters.value;
    return;
  }

  // Filter clusters that contain the query string
  filteredClusters.value = allClusters.value.filter((cluster) =>
    cluster.toLowerCase().includes(query)
  );
}

/**
 * Handle cluster selection from AutoComplete
 */
async function onClusterSelect(event: { value: string }) {
  const cluster = event.value;

  if (!cluster) {
    return;
  }

  selectedCluster.value = cluster;

  // Use nextTick to ensure state updates after AutoComplete's internal processing
  await nextTick();

  searchQuery.value = cluster;
  filteredClusters.value = [cluster];

  // Emit selection event with matching slots
  emit('clusterSelected', cluster, matchingSlots.value);
}

/**
 * Reset selection and clear highlights
 */
function resetSelection() {
  selectedCluster.value = null;
  searchQuery.value = '';
  filteredClusters.value = [];

  emit('cluster-reset');
}

// ============================================================================
// Watchers
// ============================================================================

// No watchers needed - onClusterSelect handles emission directly

// ============================================================================
// Expose public methods for parent component
// ============================================================================

defineExpose({
  resetSelection,
  selectedCluster: computed(() => selectedCluster.value),
  matchingSlots,
});
</script>

<style scoped>
.cluster-lookup :deep(.p-autocomplete) {
  width: 100%;
}

.cluster-lookup :deep(.p-autocomplete-input) {
  width: 100%;
}
</style>

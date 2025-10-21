<!--
ClusterLookup - Cluster search component for TinkerPlants
Provides AutoComplete search to find clusters and highlight matching implant slots
Part of TinkerPlants Revamp - Task 3.4
-->
<template>
  <Card class="cluster-lookup">
    <template #title>
      <div class="flex items-center justify-between">
        <span class="text-lg">Cluster Lookup</span>
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
    </template>

    <template #content>
      <div class="space-y-4">
        <!-- Search Input with AutoComplete -->
        <div class="flex flex-col gap-2">
          <AutoComplete
            v-model="searchQuery"
            :suggestions="filteredClusters"
            @complete="onSearch"
            @item-select="onClusterSelect"
            placeholder="Type cluster name (e.g., Rifle, Strength, Max NCU)..."
            input-id="cluster-search"
            class="w-full"
            :min-length="1"
            complete-on-focus
            dropdown
            force-selection
          >
            <template #option="{ option }">
              <div class="flex items-center gap-2">
                <i class="pi pi-box text-surface-500"></i>
                <span>{{ option }}</span>
              </div>
            </template>
          </AutoComplete>

        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import AutoComplete from 'primevue/autocomplete';
import Button from 'primevue/button';
import Card from 'primevue/card';
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
  disabled: false
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
  filteredClusters.value = allClusters.value.filter(cluster =>
    cluster.toLowerCase().includes(query)
  );
}

/**
 * Handle cluster selection from AutoComplete
 */
function onClusterSelect(event: { value: string }) {
  const cluster = event.value;

  if (!cluster) {
    return;
  }

  selectedCluster.value = cluster;
  searchQuery.value = cluster;

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

// Watch for external cluster changes (if needed for integration)
watch(() => selectedCluster.value, (newCluster) => {
  if (newCluster) {
    emit('clusterSelected', newCluster, matchingSlots.value);
  }
});

// ============================================================================
// Expose public methods for parent component
// ============================================================================

defineExpose({
  resetSelection,
  selectedCluster: computed(() => selectedCluster.value),
  matchingSlots
});
</script>

<style scoped>
.cluster-lookup :deep(.p-autocomplete) {
  width: 100%;
}

.cluster-lookup :deep(.p-autocomplete-input) {
  width: 100%;
}

/* Card title spacing */
.cluster-lookup :deep(.p-card-title) {
  margin-bottom: 0;
}
</style>

<!--
ShoppingList - Shopping list for TinkerPlants implants and clusters
Organizes items by vendor for easy in-game shopping
-->
<template>
  <div class="shopping-list p-4">
    <div class="max-w-4xl mx-auto space-y-6">
      <!-- Header -->
      <div class="text-center mb-6">
        <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-50 mb-2">
          Shopping List
        </h2>
        <p class="text-surface-600 dark:text-surface-400">
          Track your purchases across different vendors
        </p>
      </div>

      <!-- Empty State -->
      <div v-if="isEmpty" class="text-center py-12">
        <i class="pi pi-shopping-bag text-6xl text-surface-300 dark:text-surface-600 mb-4"></i>
        <p class="text-surface-600 dark:text-surface-400 text-lg">
          No implants configured yet. Configure your build in the Build tab to generate a shopping list.
        </p>
      </div>

      <!-- Shopping Lists -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Empty Implants Section -->
        <Card v-if="emptyImplants.length > 0" class="vendor-section">
          <template #header>
            <div class="p-4 bg-primary-50 dark:bg-primary-900/20 border-b border-surface-200 dark:border-surface-700">
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 flex items-center gap-2">
                  <i class="pi pi-box"></i>
                  Empty Implants
                </h3>
                <Badge :value="`${checkedImplantsCount}/${emptyImplants.length}`" severity="info" />
              </div>
            </div>
          </template>
          <template #content>
            <div class="space-y-2">
              <div
                v-for="item in emptyImplants"
                :key="item.id"
                class="flex items-center gap-3 p-2 hover:bg-surface-50 dark:hover:bg-surface-800 rounded transition-colors"
              >
                <Checkbox
                  v-model="item.checked"
                  :input-id="item.id"
                  binary
                />
                <label
                  :for="item.id"
                  class="flex-1 cursor-pointer"
                  :class="{ 'line-through text-surface-400': item.checked }"
                >
                  {{ item.name }} <span class="text-surface-500">(QL {{ item.ql }})</span>
                </label>
              </div>
            </div>
          </template>
        </Card>

        <!-- Shiny Clusters Section -->
        <Card v-if="shinyClusters.length > 0" class="vendor-section">
          <template #header>
            <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-b border-surface-200 dark:border-surface-700">
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 flex items-center gap-2">
                  <i class="pi pi-circle-fill text-yellow-500"></i>
                  Shiny Clusters
                </h3>
                <Badge :value="`${checkedShinyCount}/${shinyClusters.length}`" severity="warning" />
              </div>
            </div>
          </template>
          <template #content>
            <div class="space-y-2">
              <div
                v-for="item in shinyClusters"
                :key="item.id"
                class="flex items-center gap-3 p-2 hover:bg-surface-50 dark:hover:bg-surface-800 rounded transition-colors"
              >
                <Checkbox
                  v-model="item.checked"
                  :input-id="item.id"
                  binary
                />
                <label
                  :for="item.id"
                  class="flex-1 cursor-pointer"
                  :class="{ 'line-through text-surface-400': item.checked }"
                >
                  {{ item.name }}
                </label>
              </div>
            </div>
          </template>
        </Card>

        <!-- Bright Clusters Section -->
        <Card v-if="brightClusters.length > 0" class="vendor-section">
          <template #header>
            <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-surface-200 dark:border-surface-700">
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 flex items-center gap-2">
                  <i class="pi pi-circle-fill text-blue-500"></i>
                  Bright Clusters
                </h3>
                <Badge :value="`${checkedBrightCount}/${brightClusters.length}`" severity="info" />
              </div>
            </div>
          </template>
          <template #content>
            <div class="space-y-2">
              <div
                v-for="item in brightClusters"
                :key="item.id"
                class="flex items-center gap-3 p-2 hover:bg-surface-50 dark:hover:bg-surface-800 rounded transition-colors"
              >
                <Checkbox
                  v-model="item.checked"
                  :input-id="item.id"
                  binary
                />
                <label
                  :for="item.id"
                  class="flex-1 cursor-pointer"
                  :class="{ 'line-through text-surface-400': item.checked }"
                >
                  {{ item.name }}
                </label>
              </div>
            </div>
          </template>
        </Card>

        <!-- Faded Clusters Section -->
        <Card v-if="fadedClusters.length > 0" class="vendor-section">
          <template #header>
            <div class="p-4 bg-purple-50 dark:bg-purple-900/20 border-b border-surface-200 dark:border-surface-700">
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 flex items-center gap-2">
                  <i class="pi pi-circle-fill text-purple-500"></i>
                  Faded Clusters
                </h3>
                <Badge :value="`${checkedFadedCount}/${fadedClusters.length}`" severity="secondary" />
              </div>
            </div>
          </template>
          <template #content>
            <div class="space-y-2">
              <div
                v-for="item in fadedClusters"
                :key="item.id"
                class="flex items-center gap-3 p-2 hover:bg-surface-50 dark:hover:bg-surface-800 rounded transition-colors"
              >
                <Checkbox
                  v-model="item.checked"
                  :input-id="item.id"
                  binary
                />
                <label
                  :for="item.id"
                  class="flex-1 cursor-pointer"
                  :class="{ 'line-through text-surface-400': item.checked }"
                >
                  {{ item.name }}
                </label>
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useTinkerPlantsStore } from '@/stores/tinkerPlants';
import { skillService } from '@/services/skill-service';
import Card from 'primevue/card';
import Checkbox from 'primevue/checkbox';
import Badge from 'primevue/badge';

// ============================================================================
// Types
// ============================================================================

interface ShoppingItem {
  id: string;
  name: string;
  ql?: number;
  checked: boolean;
}

// ============================================================================
// Store
// ============================================================================

const tinkerPlantsStore = useTinkerPlantsStore();

// ============================================================================
// State
// ============================================================================

const emptyImplants = ref<ShoppingItem[]>([]);
const shinyClusters = ref<ShoppingItem[]>([]);
const brightClusters = ref<ShoppingItem[]>([]);
const fadedClusters = ref<ShoppingItem[]>([]);

// ============================================================================
// Computed
// ============================================================================

const isEmpty = computed(() => {
  return emptyImplants.value.length === 0 &&
    shinyClusters.value.length === 0 &&
    brightClusters.value.length === 0 &&
    fadedClusters.value.length === 0;
});

const checkedImplantsCount = computed(() => {
  return emptyImplants.value.filter(item => item.checked).length;
});

const checkedShinyCount = computed(() => {
  return shinyClusters.value.filter(item => item.checked).length;
});

const checkedBrightCount = computed(() => {
  return brightClusters.value.filter(item => item.checked).length;
});

const checkedFadedCount = computed(() => {
  return fadedClusters.value.filter(item => item.checked).length;
});

// ============================================================================
// Slot Name Mapping
// ============================================================================

// Mapping from bitflag to readable slot name
const slotNames: Record<string, string> = {
  '2': 'Eye',
  '4': 'Head',
  '8': 'Ear',
  '16': 'Right-Arm',
  '32': 'Chest',
  '64': 'Left-Arm',
  '128': 'Right-Wrist',
  '256': 'Waist',
  '512': 'Left-Wrist',
  '1024': 'Right-Hand',
  '2048': 'Leg',
  '4096': 'Left-Hand',
  '8192': 'Feet'
};

// ============================================================================
// Methods
// ============================================================================

/**
 * Extract shopping lists from current configuration
 */
function extractShoppingLists() {
  const config = tinkerPlantsStore.currentConfiguration;

  const implants: ShoppingItem[] = [];
  const shiny: ShoppingItem[] = [];
  const bright: ShoppingItem[] = [];
  const faded: ShoppingItem[] = [];

  // Process each configured slot
  for (const [slotBitflag, selection] of Object.entries(config)) {
    const slotName = slotNames[slotBitflag];
    if (!slotName) continue;

    // Check if slot has any configuration
    const hasConfig = selection.shiny || selection.bright || selection.faded;
    if (!hasConfig) continue;

    // Add empty implant
    implants.push({
      id: `implant-${slotBitflag}`,
      name: slotName,
      ql: selection.ql,
      checked: false
    });

    // Add shiny cluster if configured
    if (selection.shiny) {
      const clusterName = skillService.getName(selection.shiny);
      shiny.push({
        id: `shiny-${slotBitflag}`,
        name: clusterName,
        checked: false
      });
    }

    // Add bright cluster if configured
    if (selection.bright) {
      const clusterName = skillService.getName(selection.bright);
      bright.push({
        id: `bright-${slotBitflag}`,
        name: clusterName,
        checked: false
      });
    }

    // Add faded cluster if configured
    if (selection.faded) {
      const clusterName = skillService.getName(selection.faded);
      faded.push({
        id: `faded-${slotBitflag}`,
        name: clusterName,
        checked: false
      });
    }
  }

  // Sort alphabetically by name (matches in-game vendor presentation)
  implants.sort((a, b) => a.name.localeCompare(b.name));
  shiny.sort((a, b) => a.name.localeCompare(b.name));
  bright.sort((a, b) => a.name.localeCompare(b.name));
  faded.sort((a, b) => a.name.localeCompare(b.name));

  // Update state
  emptyImplants.value = implants;
  shinyClusters.value = shiny;
  brightClusters.value = bright;
  fadedClusters.value = faded;
}

// ============================================================================
// Watchers
// ============================================================================

// Rebuild shopping lists when configuration changes
watch(
  () => tinkerPlantsStore.currentConfiguration,
  () => {
    extractShoppingLists();
  },
  { deep: true, immediate: true }
);
</script>

<style scoped>
.vendor-section :deep(.p-card-body) {
  padding: 1rem;
}

.vendor-section :deep(.p-card-content) {
  padding: 0;
}
</style>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSymbiantsStore } from '@/stores/symbiants';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Card from 'primevue/card';
import Button from 'primevue/button';
import type { Symbiant } from '@/types/api';
import { STAT } from '@/services/game-data';
import { getMinimumLevel } from '@/services/game-utils';

// Extended symbiant type with enriched properties
interface EnrichedSymbiant extends Symbiant {
  slot?: string;
}

const symbiantStore = useSymbiantsStore();
const route = useRoute();
const router = useRouter();

// Symbiant selection state - now driven by store
const selectedSymbiants = ref<(EnrichedSymbiant | null)[]>([null, null, null]);

// Clear a symbiant selection
function clearSymbiant(index: number) {
  const symbiant = selectedSymbiants.value[index];
  selectedSymbiants.value[index] = null;
  // Sync to store
  if (symbiant) {
    symbiantStore.removeFromComparison(symbiant.id);
  }
  updateUrl();
}

// Clear all symbiant selections
function clearAll() {
  selectedSymbiants.value = [null, null, null];
  symbiantStore.clearComparison();
  updateUrl();
}

// Extract stats from symbiant actions
interface StatComparison {
  statId: number;
  statName: string;
  values: (number | null)[];
  isRequirement: boolean;
}

function extractStatsFromSymbiant(
  symbiant: EnrichedSymbiant | null
): Map<number, { value: number; isRequirement: boolean }> {
  const stats = new Map<number, { value: number; isRequirement: boolean }>();

  if (!symbiant) return stats;

  // Extract bonuses from spell_data
  if (symbiant.spell_data && Array.isArray(symbiant.spell_data)) {
    symbiant.spell_data.forEach((spellData) => {
      if (!spellData.spells || !Array.isArray(spellData.spells)) return;

      spellData.spells.forEach((spell) => {
        // Filter for spell_id 53045 (Modify stat spell)
        if (spell.spell_id === 53045) {
          const statId = spell.spell_params?.Stat;
          const amount = spell.spell_params?.Amount;

          if (statId && amount !== undefined) {
            // All symbiant bonuses are modifiers (not requirements)
            stats.set(statId, { value: amount, isRequirement: false });
          }
        }
      });
    });
  }

  return stats;
}

const comparisonData = computed((): StatComparison[] => {
  const allStats = new Set<number>();
  const statsBySymbiant: Map<number, { value: number; isRequirement: boolean }>[] = [];

  // Extract stats from each selected symbiant
  selectedSymbiants.value.forEach((symbiant) => {
    const stats = extractStatsFromSymbiant(symbiant);
    statsBySymbiant.push(stats);
    stats.forEach((_, statId) => allStats.add(statId));
  });

  // Build comparison rows
  const rows: StatComparison[] = [];

  allStats.forEach((statId) => {
    const statName = STAT[statId as keyof typeof STAT] || `Stat ${statId}`;
    const values: (number | null)[] = [];
    let isRequirement = false;

    selectedSymbiants.value.forEach((_, index) => {
      const stat = statsBySymbiant[index].get(statId);
      values.push(stat ? stat.value : null);
      if (stat && stat.isRequirement) {
        isRequirement = true;
      }
    });

    rows.push({
      statId,
      statName,
      values,
      isRequirement,
    });
  });

  // Sort: requirements first, then modifiers, alphabetically within each group
  return rows.sort((a, b) => {
    if (a.isRequirement !== b.isRequirement) {
      return a.isRequirement ? -1 : 1;
    }
    return a.statName.localeCompare(b.statName);
  });
});

// Group comparison data
const requirementStats = computed(() => comparisonData.value.filter((s) => s.isRequirement));

const modifierStats = computed(() => comparisonData.value.filter((s) => !s.isRequirement));

// Check if any symbiant is selected
const hasSelection = computed(() => selectedSymbiants.value.some((s) => s !== null));

// Get quality severity for tag
function getQualitySeverity(ql: number): 'success' | 'info' | 'warning' | 'danger' {
  if (ql >= 200) return 'danger';
  if (ql >= 150) return 'warning';
  if (ql >= 100) return 'info';
  return 'success';
}

// Format minimum level for display
function formatMinimumLevel(symbiant: EnrichedSymbiant | null): string {
  if (!symbiant) return '--';
  try {
    const level = getMinimumLevel(symbiant);
    return `Lvl ${level}`;
  } catch (error) {
    console.error('Failed to extract level from symbiant:', symbiant.name, error);
    return '--';
  }
}

// Format stat value
function formatStatValue(value: number | null, isRequirement: boolean): string {
  if (value === null) return '-';
  if (isRequirement) {
    return value.toString();
  }
  return value > 0 ? `+${value}` : value.toString();
}

// Get cell class based on value comparison
function getCellClass(
  value: number | null,
  values: (number | null)[],
  isRequirement: boolean
): string {
  if (value === null) return 'text-surface-400';

  if (isRequirement) {
    // For requirements, lower is better
    const nonNullValues = values.filter((v) => v !== null) as number[];
    const minValue = Math.min(...nonNullValues);
    if (value === minValue && nonNullValues.length > 1) {
      return 'text-green-600 dark:text-green-400 font-semibold';
    }
  } else {
    // For modifiers, higher is better
    const nonNullValues = values.filter((v) => v !== null) as number[];
    const maxValue = Math.max(...nonNullValues);
    if (value === maxValue && nonNullValues.length > 1) {
      return 'text-green-600 dark:text-green-400 font-semibold';
    }
  }

  return '';
}

// URL persistence
function updateUrl() {
  const query: Record<string, string> = {};

  selectedSymbiants.value.forEach((symbiant, index) => {
    if (symbiant) {
      query[`s${index + 1}`] = symbiant.id.toString();
    }
  });

  router.replace({ query }).catch(() => {
    // Ignore navigation duplicated errors
  });
}

async function loadFromUrl() {
  const s1 = route.query.s1 ? parseInt(route.query.s1 as string) : null;
  const s2 = route.query.s2 ? parseInt(route.query.s2 as string) : null;
  const s3 = route.query.s3 ? parseInt(route.query.s3 as string) : null;

  const ids = [s1, s2, s3];

  // Get all symbiants from store
  const allSymbiants = symbiantStore.allSymbiants as EnrichedSymbiant[];

  ids.forEach((id, index) => {
    if (id) {
      const symbiant = allSymbiants.find((s) => s.id === id);
      if (symbiant) {
        selectedSymbiants.value[index] = symbiant;
      }
    }
  });

  // Sync loaded symbiants back to store
  symbiantStore.clearComparison();
  selectedSymbiants.value.forEach((s) => s && symbiantStore.addToComparison(s));
}

function loadFromStore() {
  // Load from store's comparison state
  const storeSelection = symbiantStore.selectedForComparison;
  selectedSymbiants.value = [...storeSelection] as (EnrichedSymbiant | null)[];
}

// Load symbiants on mount
onMounted(async () => {
  // Ensure all symbiants are loaded (store handles caching)
  await symbiantStore.loadAllSymbiants();

  // Priority: URL params > Store state
  if (route.query.s1 || route.query.s2 || route.query.s3) {
    // Load from URL
    await loadFromUrl();
  } else {
    // Load from store
    loadFromStore();
  }
});

// Watch for URL changes
watch(
  () => route.query,
  () => {
    if (route.name === 'TinkerPocket') {
      loadFromUrl();
    }
  }
);

// Watch for store changes (from other tabs/components)
watch(
  () => symbiantStore.selectedForComparison,
  (newSelection) => {
    // Only update if there are no URL params (to respect URL priority)
    if (!route.query.s1 && !route.query.s2 && !route.query.s3) {
      selectedSymbiants.value = [...newSelection] as (EnrichedSymbiant | null)[];
    }
  },
  { deep: true }
);
</script>

<template>
  <div class="symbiant-compare">
    <!-- Selection Section -->
    <Card class="mb-6">
      <template #content>
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Selected Symbiants for Comparison</h3>
            <Button
              v-if="hasSelection"
              label="Clear All"
              icon="pi pi-times"
              @click="clearAll()"
              outlined
              size="small"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Symbiant Slot 1 -->
            <div class="flex flex-col gap-2">
              <label class="font-medium text-sm">Symbiant 1</label>
              <div
                v-if="selectedSymbiants[0]"
                class="p-3 bg-surface-50 dark:bg-surface-800 rounded border border-surface-200 dark:border-surface-700"
              >
                <div class="flex items-start justify-between mb-2">
                  <div class="font-semibold">{{ selectedSymbiants[0].name }}</div>
                  <Button
                    icon="pi pi-times"
                    @click="clearSymbiant(0)"
                    text
                    rounded
                    size="small"
                    severity="secondary"
                    class="-mt-1 -mr-1"
                  />
                </div>
                <div class="text-sm text-surface-600 dark:text-surface-400">
                  {{ selectedSymbiants[0].slot }} • {{ selectedSymbiants[0].family }}
                </div>
                <div class="flex gap-2 mt-2">
                  <Tag
                    :value="`QL ${selectedSymbiants[0].ql}`"
                    :severity="getQualitySeverity(selectedSymbiants[0].ql)"
                  />
                  <Tag :value="formatMinimumLevel(selectedSymbiants[0])" severity="info" />
                </div>
              </div>
              <div
                v-else
                class="p-6 bg-surface-50 dark:bg-surface-800 rounded border border-dashed border-surface-300 dark:border-surface-600 text-center"
              >
                <span class="text-surface-400 dark:text-surface-500 text-sm">Empty slot</span>
              </div>
            </div>

            <!-- Symbiant Slot 2 -->
            <div class="flex flex-col gap-2">
              <label class="font-medium text-sm">Symbiant 2</label>
              <div
                v-if="selectedSymbiants[1]"
                class="p-3 bg-surface-50 dark:bg-surface-800 rounded border border-surface-200 dark:border-surface-700"
              >
                <div class="flex items-start justify-between mb-2">
                  <div class="font-semibold">{{ selectedSymbiants[1].name }}</div>
                  <Button
                    icon="pi pi-times"
                    @click="clearSymbiant(1)"
                    text
                    rounded
                    size="small"
                    severity="secondary"
                    class="-mt-1 -mr-1"
                  />
                </div>
                <div class="text-sm text-surface-600 dark:text-surface-400">
                  {{ selectedSymbiants[1].slot }} • {{ selectedSymbiants[1].family }}
                </div>
                <div class="flex gap-2 mt-2">
                  <Tag
                    :value="`QL ${selectedSymbiants[1].ql}`"
                    :severity="getQualitySeverity(selectedSymbiants[1].ql)"
                  />
                  <Tag :value="formatMinimumLevel(selectedSymbiants[1])" severity="info" />
                </div>
              </div>
              <div
                v-else
                class="p-6 bg-surface-50 dark:bg-surface-800 rounded border border-dashed border-surface-300 dark:border-surface-600 text-center"
              >
                <span class="text-surface-400 dark:text-surface-500 text-sm">Empty slot</span>
              </div>
            </div>

            <!-- Symbiant Slot 3 -->
            <div class="flex flex-col gap-2">
              <label class="font-medium text-sm">Symbiant 3</label>
              <div
                v-if="selectedSymbiants[2]"
                class="p-3 bg-surface-50 dark:bg-surface-800 rounded border border-surface-200 dark:border-surface-700"
              >
                <div class="flex items-start justify-between mb-2">
                  <div class="font-semibold">{{ selectedSymbiants[2].name }}</div>
                  <Button
                    icon="pi pi-times"
                    @click="clearSymbiant(2)"
                    text
                    rounded
                    size="small"
                    severity="secondary"
                    class="-mt-1 -mr-1"
                  />
                </div>
                <div class="text-sm text-surface-600 dark:text-surface-400">
                  {{ selectedSymbiants[2].slot }} • {{ selectedSymbiants[2].family }}
                </div>
                <div class="flex gap-2 mt-2">
                  <Tag
                    :value="`QL ${selectedSymbiants[2].ql}`"
                    :severity="getQualitySeverity(selectedSymbiants[2].ql)"
                  />
                  <Tag :value="formatMinimumLevel(selectedSymbiants[2])" severity="info" />
                </div>
              </div>
              <div
                v-else
                class="p-6 bg-surface-50 dark:bg-surface-800 rounded border border-dashed border-surface-300 dark:border-surface-600 text-center"
              >
                <span class="text-surface-400 dark:text-surface-500 text-sm">Empty slot</span>
              </div>
            </div>
          </div>

          <!-- Helper text -->
          <div class="text-sm text-surface-500 dark:text-surface-400 text-center mt-2">
            <i class="pi pi-info-circle mr-1"></i>
            Select symbiants from the Browse tab to add them to comparison
          </div>
        </div>
      </template>
    </Card>

    <!-- Comparison Table -->
    <div v-if="hasSelection">
      <!-- Requirements Section -->
      <Card v-if="requirementStats.length > 0" class="mb-4">
        <template #title>
          <div class="flex items-center gap-2">
            <i class="pi pi-lock text-orange-500"></i>
            <span>Requirements</span>
          </div>
        </template>
        <template #content>
          <DataTable :value="requirementStats" stripedRows>
            <Column field="statName" header="Stat" :style="{ width: '200px' }">
              <template #body="slotProps">
                <span class="font-medium">{{ slotProps.data.statName }}</span>
              </template>
            </Column>
            <Column
              v-for="(symbiant, index) in selectedSymbiants"
              :key="`req-${index}`"
              :header="symbiant ? symbiant.name : `Symbiant ${index + 1}`"
            >
              <template #body="slotProps">
                <span
                  :class="getCellClass(slotProps.data.values[index], slotProps.data.values, true)"
                >
                  {{ formatStatValue(slotProps.data.values[index], true) }}
                </span>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>

      <!-- Modifiers Section -->
      <Card v-if="modifierStats.length > 0">
        <template #title>
          <div class="flex items-center gap-2">
            <i class="pi pi-chart-line text-green-500"></i>
            <span>Stat Bonuses</span>
          </div>
        </template>
        <template #content>
          <DataTable :value="modifierStats" stripedRows>
            <Column field="statName" header="Stat" :style="{ width: '200px' }">
              <template #body="slotProps">
                <span class="font-medium">{{ slotProps.data.statName }}</span>
              </template>
            </Column>
            <Column
              v-for="(symbiant, index) in selectedSymbiants"
              :key="`mod-${index}`"
              :header="symbiant ? symbiant.name : `Symbiant ${index + 1}`"
            >
              <template #body="slotProps">
                <span
                  :class="getCellClass(slotProps.data.values[index], slotProps.data.values, false)"
                >
                  {{ formatStatValue(slotProps.data.values[index], false) }}
                </span>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>

      <!-- No stats found -->
      <Card v-if="requirementStats.length === 0 && modifierStats.length === 0">
        <template #content>
          <div class="text-center py-6">
            <i class="pi pi-info-circle text-3xl text-surface-400 mb-3"></i>
            <p class="text-surface-600 dark:text-surface-400">
              No stat data available for selected symbiants
            </p>
          </div>
        </template>
      </Card>
    </div>

    <!-- Empty State -->
    <Card v-else>
      <template #content>
        <div class="text-center py-12">
          <i class="pi pi-search text-5xl text-surface-300 dark:text-surface-600 mb-4"></i>
          <h3 class="text-xl font-semibold mb-2">Select Symbiants to Compare</h3>
          <p class="text-surface-600 dark:text-surface-400 mb-4">
            Choose up to 3 symbiants to compare their stats and requirements side-by-side
          </p>
          <div class="text-sm text-surface-500 dark:text-surface-500 space-y-1">
            <p>Common comparisons:</p>
            <p>• Same slot across different families</p>
            <p>• Same family across different quality levels</p>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
/* Component-specific styles can be added here if needed */
</style>

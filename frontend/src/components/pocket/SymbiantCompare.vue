<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSymbiantsStore } from '@/stores/symbiants';
import AutoComplete from 'primevue/autocomplete';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Card from 'primevue/card';
import Button from 'primevue/button';
import type { Symbiant, Action, Criterion } from '@/types/api';
import { STAT } from '@/services/game-data';

// Extended symbiant type with enriched properties
interface EnrichedSymbiant extends Symbiant {
  slot?: string;
}

const symbiantStore = useSymbiantsStore();
const route = useRoute();
const router = useRouter();

// Symbiant selection state
const selectedSymbiants = ref<(EnrichedSymbiant | null)[]>([null, null, null]);
const searchQueries = ref<string[]>(['', '', '']);
const filteredSuggestions = ref<EnrichedSymbiant[][]>([[], [], []]);

// Available symbiants for autocomplete
const allSymbiants = computed(() => symbiantStore.allSymbiants as EnrichedSymbiant[]);

// Autocomplete search
function searchSymbiants(event: any, index: number) {
  const query = event.query.toLowerCase();
  filteredSuggestions.value[index] = allSymbiants.value
    .filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.family?.toLowerCase().includes(query) ||
      s.slot?.toLowerCase().includes(query)
    )
    .slice(0, 50); // Limit suggestions
}

// Format symbiant for display in dropdown
function formatSymbiant(symbiant: EnrichedSymbiant | null): string {
  if (!symbiant) return '';
  return `${symbiant.name} (${symbiant.family}, QL${symbiant.ql})`;
}

// Handle symbiant selection
function onSymbiantSelect(index: number) {
  updateUrl();
}

// Clear a symbiant selection
function clearSymbiant(index: number) {
  selectedSymbiants.value[index] = null;
  searchQueries.value[index] = '';
  updateUrl();
}

// Extract stats from symbiant actions
interface StatComparison {
  statId: number;
  statName: string;
  values: (number | null)[];
  isRequirement: boolean;
}

function extractStatsFromSymbiant(symbiant: EnrichedSymbiant | null): Map<number, { value: number; isRequirement: boolean }> {
  const stats = new Map<number, { value: number; isRequirement: boolean }>();

  if (!symbiant || !symbiant.actions) return stats;

  symbiant.actions.forEach((action: Action) => {
    if (!action.criteria) return;

    action.criteria.forEach((criterion: Criterion) => {
      // Operator 53 = requirement, 1 = modifier
      const isRequirement = criterion.operator === 53;
      const statId = criterion.value1;
      const value = criterion.value2;

      if (statId && value !== undefined) {
        stats.set(statId, { value, isRequirement });
      }
    });
  });

  return stats;
}

const comparisonData = computed((): StatComparison[] => {
  const allStats = new Set<number>();
  const statsBySymbiant: Map<number, { value: number; isRequirement: boolean }>[] = [];

  // Extract stats from each selected symbiant
  selectedSymbiants.value.forEach(symbiant => {
    const stats = extractStatsFromSymbiant(symbiant);
    statsBySymbiant.push(stats);
    stats.forEach((_, statId) => allStats.add(statId));
  });

  // Build comparison rows
  const rows: StatComparison[] = [];

  allStats.forEach(statId => {
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
      isRequirement
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
const requirementStats = computed(() =>
  comparisonData.value.filter(s => s.isRequirement)
);

const modifierStats = computed(() =>
  comparisonData.value.filter(s => !s.isRequirement)
);

// Check if any symbiant is selected
const hasSelection = computed(() =>
  selectedSymbiants.value.some(s => s !== null)
);

// Get quality severity for tag
function getQualitySeverity(ql: number): 'success' | 'info' | 'warning' | 'danger' {
  if (ql >= 200) return 'danger';
  if (ql >= 150) return 'warning';
  if (ql >= 100) return 'info';
  return 'success';
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
function getCellClass(value: number | null, values: (number | null)[], isRequirement: boolean): string {
  if (value === null) return 'text-surface-400';

  if (isRequirement) {
    // For requirements, lower is better
    const nonNullValues = values.filter(v => v !== null) as number[];
    const minValue = Math.min(...nonNullValues);
    if (value === minValue && nonNullValues.length > 1) {
      return 'text-green-600 dark:text-green-400 font-semibold';
    }
  } else {
    // For modifiers, higher is better
    const nonNullValues = values.filter(v => v !== null) as number[];
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

function loadFromUrl() {
  const s1 = route.query.s1 ? parseInt(route.query.s1 as string) : null;
  const s2 = route.query.s2 ? parseInt(route.query.s2 as string) : null;
  const s3 = route.query.s3 ? parseInt(route.query.s3 as string) : null;

  const ids = [s1, s2, s3];

  ids.forEach((id, index) => {
    if (id) {
      const symbiant = allSymbiants.value.find(s => s.id === id);
      if (symbiant) {
        selectedSymbiants.value[index] = symbiant;
        searchQueries.value[index] = formatSymbiant(symbiant);
      }
    }
  });
}

// Load symbiants on mount
onMounted(async () => {
  // Ensure symbiants are loaded
  if (allSymbiants.value.length === 0) {
    await symbiantStore.searchSymbiants({ page: 1, limit: 1000 });
  }

  // Load from URL if available
  loadFromUrl();
});

// Watch for URL changes
watch(() => route.query, () => {
  if (route.name === 'TinkerPocket') {
    loadFromUrl();
  }
});
</script>

<template>
  <div class="symbiant-compare">
    <!-- Selection Section -->
    <Card class="mb-6">
      <template #content>
        <div class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">Select Symbiants to Compare</h3>
            <Button
              v-if="hasSelection"
              label="Clear All"
              icon="pi pi-times"
              @click="selectedSymbiants = [null, null, null]; searchQueries = ['', '', '']; updateUrl()"
              outlined
              size="small"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Symbiant 1 -->
            <div class="flex flex-col gap-2">
              <label class="font-medium text-sm">Symbiant 1</label>
              <div class="flex gap-2">
                <AutoComplete
                  v-model="searchQueries[0]"
                  :suggestions="filteredSuggestions[0]"
                  @complete="searchSymbiants($event, 0)"
                  @item-select="selectedSymbiants[0] = $event.value; onSymbiantSelect(0)"
                  :optionLabel="formatSymbiant"
                  placeholder="Search symbiant..."
                  class="flex-1"
                  :dropdown="true"
                />
                <Button
                  v-if="selectedSymbiants[0]"
                  icon="pi pi-times"
                  @click="clearSymbiant(0)"
                  outlined
                  severity="secondary"
                />
              </div>
              <div v-if="selectedSymbiants[0]" class="p-3 bg-surface-50 dark:bg-surface-800 rounded">
                <div class="font-semibold">{{ selectedSymbiants[0].name }}</div>
                <div class="text-sm text-surface-600 dark:text-surface-400">
                  {{ selectedSymbiants[0].slot }} • {{ selectedSymbiants[0].family }}
                </div>
                <Tag :value="`QL ${selectedSymbiants[0].ql}`" :severity="getQualitySeverity(selectedSymbiants[0].ql)" class="mt-2" />
              </div>
            </div>

            <!-- Symbiant 2 -->
            <div class="flex flex-col gap-2">
              <label class="font-medium text-sm">Symbiant 2</label>
              <div class="flex gap-2">
                <AutoComplete
                  v-model="searchQueries[1]"
                  :suggestions="filteredSuggestions[1]"
                  @complete="searchSymbiants($event, 1)"
                  @item-select="selectedSymbiants[1] = $event.value; onSymbiantSelect(1)"
                  :optionLabel="formatSymbiant"
                  placeholder="Search symbiant..."
                  class="flex-1"
                  :dropdown="true"
                />
                <Button
                  v-if="selectedSymbiants[1]"
                  icon="pi pi-times"
                  @click="clearSymbiant(1)"
                  outlined
                  severity="secondary"
                />
              </div>
              <div v-if="selectedSymbiants[1]" class="p-3 bg-surface-50 dark:bg-surface-800 rounded">
                <div class="font-semibold">{{ selectedSymbiants[1].name }}</div>
                <div class="text-sm text-surface-600 dark:text-surface-400">
                  {{ selectedSymbiants[1].slot }} • {{ selectedSymbiants[1].family }}
                </div>
                <Tag :value="`QL ${selectedSymbiants[1].ql}`" :severity="getQualitySeverity(selectedSymbiants[1].ql)" class="mt-2" />
              </div>
            </div>

            <!-- Symbiant 3 -->
            <div class="flex flex-col gap-2">
              <label class="font-medium text-sm">Symbiant 3</label>
              <div class="flex gap-2">
                <AutoComplete
                  v-model="searchQueries[2]"
                  :suggestions="filteredSuggestions[2]"
                  @complete="searchSymbiants($event, 2)"
                  @item-select="selectedSymbiants[2] = $event.value; onSymbiantSelect(2)"
                  :optionLabel="formatSymbiant"
                  placeholder="Search symbiant..."
                  class="flex-1"
                  :dropdown="true"
                />
                <Button
                  v-if="selectedSymbiants[2]"
                  icon="pi pi-times"
                  @click="clearSymbiant(2)"
                  outlined
                  severity="secondary"
                />
              </div>
              <div v-if="selectedSymbiants[2]" class="p-3 bg-surface-50 dark:bg-surface-800 rounded">
                <div class="font-semibold">{{ selectedSymbiants[2].name }}</div>
                <div class="text-sm text-surface-600 dark:text-surface-400">
                  {{ selectedSymbiants[2].slot }} • {{ selectedSymbiants[2].family }}
                </div>
                <Tag :value="`QL ${selectedSymbiants[2].ql}`" :severity="getQualitySeverity(selectedSymbiants[2].ql)" class="mt-2" />
              </div>
            </div>
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
                <span :class="getCellClass(slotProps.data.values[index], slotProps.data.values, true)">
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
                <span :class="getCellClass(slotProps.data.values[index], slotProps.data.values, false)">
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
/* Ensure AutoComplete dropdowns are full width */
:deep(.p-autocomplete) {
  width: 100%;
}

:deep(.p-autocomplete-input) {
  width: 100%;
}
</style>

<!--
BonusDisplay.vue - Display implant stat bonuses
Shows per-implant bonuses and aggregate totals with responsive layout
-->
<template>
  <div class="bonus-display space-y-6">
    <!-- Aggregate Total Section -->
    <div class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-6">
      <h3 class="text-xl font-bold text-surface-900 dark:text-surface-50 mb-4 flex items-center gap-2">
        <i class="pi pi-chart-bar text-primary-500" aria-hidden="true"></i>
        Total Bonuses
      </h3>

      <div v-if="hasAnyBonuses" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <div
          v-for="bonus in sortedAggregateBonuses"
          :key="bonus.statId"
          class="bg-surface-50 dark:bg-surface-900 rounded-lg p-4 text-center border border-surface-200 dark:border-surface-700"
        >
          <div class="text-sm font-medium text-surface-600 dark:text-surface-400 mb-1">
            {{ bonus.statName }}
          </div>
          <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">
            +{{ bonus.value }}
          </div>
        </div>
      </div>

      <div v-else class="text-center py-8 text-surface-500 dark:text-surface-400">
        <i class="pi pi-info-circle text-3xl mb-2" aria-hidden="true"></i>
        <p>Configure implants to see total bonuses</p>
      </div>
    </div>

    <!-- Per-Implant Bonuses Section -->
    <div class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-6">
      <h3 class="text-xl font-bold text-surface-900 dark:text-surface-50 mb-4 flex items-center gap-2">
        <i class="pi pi-list text-primary-500" aria-hidden="true"></i>
        Per-Implant Bonuses
      </h3>

      <div v-if="hasPerImplantBonuses">
        <!-- Desktop/Tablet: DataTable -->
        <div class="hidden md:block">
          <DataTable
            :value="perImplantTableData"
            :rows="13"
            striped-rows
            :show-gridlines="true"
            responsive-layout="scroll"
            class="text-sm"
          >
            <Column field="slot" header="Slot" :sortable="true" class="font-medium">
              <template #body="{ data }">
                <span class="text-surface-900 dark:text-surface-50 font-semibold">
                  {{ data.slot }}
                </span>
              </template>
            </Column>
            <Column field="clusters" header="Clusters" class="text-surface-700 dark:text-surface-300">
              <template #body="{ data }">
                <span class="text-xs">{{ data.clusters }}</span>
              </template>
            </Column>
            <Column field="bonuses" header="Bonuses" class="min-w-[300px]">
              <template #body="{ data }">
                <div class="flex flex-wrap gap-2">
                  <Tag
                    v-for="bonus in data.bonusList"
                    :key="bonus.statId"
                    :value="`+${bonus.value} ${bonus.statName}`"
                    severity="success"
                    class="text-xs"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
        </div>

        <!-- Mobile: Card Layout -->
        <div class="md:hidden space-y-4">
          <div
            v-for="implantData in perImplantTableData"
            :key="implantData.slot"
            class="bg-surface-50 dark:bg-surface-900 rounded-lg p-4 border border-surface-200 dark:border-surface-700"
          >
            <div class="font-bold text-surface-900 dark:text-surface-50 mb-2">
              {{ implantData.slot }}
            </div>
            <div class="text-sm text-surface-600 dark:text-surface-400 mb-3">
              {{ implantData.clusters }}
            </div>
            <div class="flex flex-wrap gap-2">
              <Tag
                v-for="bonus in implantData.bonusList"
                :key="bonus.statId"
                :value="`+${bonus.value} ${bonus.statName}`"
                severity="success"
                class="text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-8 text-surface-500 dark:text-surface-400">
        <i class="pi pi-info-circle text-3xl mb-2" aria-hidden="true"></i>
        <p>No implants configured yet</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import { skillService } from '@/services/skill-service';

// ============================================================================
// Props
// ============================================================================

export interface BonusDisplayProps {
  /** Aggregate bonuses across all implants: statId → total bonus */
  bonuses: Record<number, number>;
  /** Per-implant bonuses: slotBitflag → (statId → bonus) */
  perImplantBonuses: Record<string, Record<number, number>>;
}

const props = withDefaults(defineProps<BonusDisplayProps>(), {
  bonuses: () => ({}),
  perImplantBonuses: () => ({})
});

// ============================================================================
// Types
// ============================================================================

interface BonusEntry {
  statId: number;
  statName: string;
  value: number;
}

interface ImplantTableRow {
  slot: string;
  clusters: string;
  bonuses: string;
  bonusList: BonusEntry[];
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Map implant slot bitflag to display name
 */
function getSlotDisplayName(slotBitflag: string): string {
  const slotMap: Record<string, string> = {
    '2': 'Eyes',
    '4': 'Head',
    '8': 'Ears',
    '16': 'Right Arm',
    '32': 'Chest',
    '64': 'Left Arm',
    '128': 'Right Wrist',
    '256': 'Waist',
    '512': 'Left Wrist',
    '1024': 'Right Hand',
    '2048': 'Legs',
    '4096': 'Left Hand',
    '8192': 'Feet'
  };
  return slotMap[slotBitflag] || `Slot ${slotBitflag}`;
}

/**
 * Convert stat bonuses to sorted array with display names
 */
function formatBonuses(bonuses: Record<number, number>): BonusEntry[] {
  return Object.entries(bonuses)
    .map(([statIdStr, value]) => {
      const statId = parseInt(statIdStr, 10);
      let statName: string;

      try {
        statName = skillService.getName(statId);
      } catch (error) {
        // Graceful fallback for unknown stat IDs
        console.warn(`Unable to get name for stat ID ${statId}:`, error);
        statName = `Stat ${statId}`;
      }

      return {
        statId,
        statName,
        value
      };
    })
    .sort((a, b) => b.value - a.value); // Sort by value descending
}

// ============================================================================
// Computed Properties
// ============================================================================

/** Check if there are any aggregate bonuses */
const hasAnyBonuses = computed(() => {
  return Object.keys(props.bonuses).length > 0;
});

/** Check if there are any per-implant bonuses */
const hasPerImplantBonuses = computed(() => {
  return Object.keys(props.perImplantBonuses).length > 0;
});

/** Sorted aggregate bonuses for display */
const sortedAggregateBonuses = computed<BonusEntry[]>(() => {
  return formatBonuses(props.bonuses);
});

/** Per-implant data formatted for table display */
const perImplantTableData = computed<ImplantTableRow[]>(() => {
  const rows: ImplantTableRow[] = [];

  // Standard slot order (by bitflag value)
  const slotOrder = ['2', '4', '8', '16', '32', '64', '128', '256', '512', '1024', '2048', '4096', '8192'];

  for (const slotBitflag of slotOrder) {
    const slotBonuses = props.perImplantBonuses[slotBitflag];
    if (!slotBonuses || Object.keys(slotBonuses).length === 0) {
      continue; // Skip empty slots
    }

    const bonusList = formatBonuses(slotBonuses);
    const bonusesText = bonusList.map(b => `+${b.value} ${b.statName}`).join(', ');

    rows.push({
      slot: getSlotDisplayName(slotBitflag),
      clusters: '', // Cluster info could be added if needed
      bonuses: bonusesText,
      bonusList
    });
  }

  return rows;
});
</script>

<style scoped>
/* DataTable styling adjustments for bonus display */
:deep(.p-datatable) {
  font-size: 0.875rem;
}

:deep(.p-datatable .p-datatable-tbody > tr > td) {
  padding: 0.75rem;
}

:deep(.p-datatable .p-datatable-thead > tr > th) {
  background-color: var(--p-surface-100);
  color: var(--p-surface-900);
  font-weight: 600;
  padding: 0.75rem;
}

:deep(.p-datatable.p-datatable-striped .p-datatable-tbody > tr:nth-child(even)) {
  background-color: var(--p-surface-50);
}

/* Tag styling for bonus display */
:deep(.p-tag) {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

/* Dark mode adjustments */
:deep(.p-datatable) {
  background-color: var(--p-surface-0);
}

:deep(.p-datatable .p-datatable-thead > tr > th) {
  background-color: var(--p-surface-100);
}

@media (prefers-color-scheme: dark) {
  :deep(.p-datatable) {
    background-color: var(--p-surface-950);
  }

  :deep(.p-datatable .p-datatable-thead > tr > th) {
    background-color: var(--p-surface-800);
    color: var(--p-surface-50);
  }

  :deep(.p-datatable.p-datatable-striped .p-datatable-tbody > tr:nth-child(even)) {
    background-color: var(--p-surface-900);
  }
}
</style>

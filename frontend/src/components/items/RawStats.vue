<!--
RawStats - Raw item statistics display component
Shows all item stats with stat numbers translated to names using game-data
-->
<template>
  <Card v-if="hasStats">
    <template #content>
      <div class="raw-stats-component">
        <!-- Header -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <i class="pi pi-list-check text-gray-500"></i>
            <h3 class="text-base font-semibold">Raw Stats</h3>
          </div>
          <div v-if="formattedStats.length > 0" class="stats-badge">
            {{ formattedStats.length }} stats
          </div>
        </div>

        <!-- Stats Table -->
        <div class="stats-table">
          <table class="w-full border-collapse">
            <!-- Headers Row -->
            <thead>
              <tr class="header-row">
                <th class="header-cell">Stat ID</th>
                <th class="header-cell">Stat Name</th>
                <th class="header-cell">Value</th>
              </tr>
            </thead>

            <!-- Data Rows -->
            <tbody>
              <tr v-for="stat in formattedStats" :key="stat.stat" class="data-row">
                <!-- Stat ID Column -->
                <td class="table-cell stat-id-cell">
                  <span class="font-mono text-xs">{{ stat.stat }}</span>
                </td>

                <!-- Stat Name Column -->
                <td class="table-cell stat-name-cell">
                  <span class="stat-name">{{ stat.name }}</span>
                </td>

                <!-- Value Column -->
                <td class="table-cell value-cell">
                  <span class="stat-value" :class="getValueClass(stat.value)">
                    {{ formatValue(stat.value) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Card from 'primevue/card';
import type { StatValue } from '@/types/api';
import { getStatName } from '@/services/game-utils';

// ============================================================================
// Props
// ============================================================================

interface Props {
  stats: StatValue[];
}

const props = withDefaults(defineProps<Props>(), {
  stats: () => [],
});

// ============================================================================
// Computed Properties
// ============================================================================

const hasStats = computed(() => {
  return props.stats && props.stats.length > 0;
});

interface FormattedStat {
  stat: number;
  name: string;
  value: number;
}

const formattedStats = computed((): FormattedStat[] => {
  if (!hasStats.value) return [];

  return props.stats
    .map((stat) => ({
      stat: stat.stat,
      name: getStatName(stat.stat) || `Unknown Stat`,
      value: stat.value,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

// ============================================================================
// Methods
// ============================================================================

function formatValue(value: number): string {
  return value.toLocaleString();
}

function getValueClass(value: number): string {
  if (value > 0) {
    return 'text-green-600 dark:text-green-400';
  } else if (value < 0) {
    return 'text-red-600 dark:text-red-400';
  } else {
    return 'text-surface-500 dark:text-surface-400';
  }
}
</script>

<style>
/* Component scoping */
.raw-stats-component .stats-badge {
  padding: 4px 12px;
  background: linear-gradient(135deg, #6b7280, #9ca3af);
  border-radius: 16px;
  font-size: 12px;
  font-weight: bold;
  color: white;
}

/* Table Styles */
.raw-stats-component .stats-table table {
  border-spacing: 2px;
}

.raw-stats-component .table-cell {
  padding: 8px;
  background: #f8fafc;
  border: 1px solid #d1d5db;
  vertical-align: middle;
}

.dark .raw-stats-component .table-cell {
  background: #0c0a09 !important;
  border-color: #374151 !important;
  color: #e5e7eb !important;
}

.raw-stats-component .header-cell {
  background: #e5e7eb;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #4b5563;
  padding: 6px 8px;
  text-align: center;
  border: 1px solid #d1d5db;
}

.dark .raw-stats-component .header-cell {
  background: #374151 !important;
  color: #9ca3af !important;
  border-color: #4b5563 !important;
}

.raw-stats-component .stat-id-cell {
  width: 15%;
  text-align: center;
}

.raw-stats-component .stat-name-cell {
  width: 60%;
}

.raw-stats-component .value-cell {
  width: 25%;
  text-align: right;
}

.raw-stats-component .stat-name {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
}

.dark .raw-stats-component .stat-name {
  color: #d1d5db !important;
}

.raw-stats-component .stat-value {
  font-size: 12px;
  font-weight: 600;
}

/* Data row hover effect */
.raw-stats-component .data-row:hover .table-cell {
  background: #f1f5f9;
}

.dark .raw-stats-component .data-row:hover .table-cell {
  background: #1c1917 !important;
}

/* Monospace font for IDs */
.font-mono {
  font-family: 'Courier New', 'Monaco', 'Lucida Console', monospace;
}
</style>

<!--
PerkTable - Display table of profile perks with effects
Shows owned perks with their levels, points used, and stat bonuses
-->
<template>
  <div class="perk-table">
    <!-- Table for perks when present -->
    <DataTable
      v-if="perks.length > 0"
      :value="perks"
      :scrollable="true"
      scrollHeight="flex"
      class="perk-data-table"
      :rowHover="true"
      :stripedRows="true"
    >
      <!-- Perk Name Column -->
      <Column field="name" header="Perk Name" :sortable="true" class="min-w-48">
        <template #body="{ data }">
          <div class="flex items-center gap-2">
            <i :class="getPerkIcon(perkType)" :aria-hidden="true"></i>
            <span class="font-medium">{{ data.name }}</span>
          </div>
        </template>
      </Column>

      <!-- Level Column -->
      <Column field="level" header="Level" :sortable="true" class="w-24">
        <template #body="{ data }">
          <div class="text-center">
            <span class="font-semibold">{{ data.level }}</span>
            <span class="text-surface-500 dark:text-surface-400">/10</span>
          </div>
        </template>
      </Column>

      <!-- Points Used Column (not for LE) -->
      <Column v-if="perkType !== 'LE'" field="level" header="Points" :sortable="true" class="w-20">
        <template #body="{ data }">
          <div class="text-center">
            <Badge :value="data.level" :severity="perkType === 'AI' ? 'info' : 'success'" />
          </div>
        </template>
      </Column>

      <!-- Effects Column -->
      <Column field="effects" header="Effects" class="min-w-64">
        <template #body="{ data }">
          <div class="perk-effects">
            <div v-if="data.effects && data.effects.length > 0" class="space-y-1">
              <div
                v-for="(effect, index) in getDisplayEffects(data.effects)"
                :key="index"
                class="text-sm"
              >
                <span class="text-primary-600 dark:text-primary-400">
                  {{ effect }}
                </span>
              </div>
            </div>
            <div v-else class="text-surface-500 dark:text-surface-400 text-sm italic">
              No effects data available
            </div>
          </div>
        </template>
      </Column>

      <!-- Actions Column (for future use) -->
      <Column v-if="editable" header="Actions" class="w-32">
        <template #body="{ data }">
          <div class="flex gap-2 justify-center">
            <Button
              icon="pi pi-arrow-up"
              size="small"
              severity="secondary"
              rounded
              text
              :disabled="data.level >= 10"
              @click="$emit('upgrade', data)"
              v-tooltip.top="'Upgrade'"
              :aria-label="`Upgrade ${data.name}`"
            />
            <Button
              icon="pi pi-times"
              size="small"
              severity="danger"
              rounded
              text
              @click="$emit('remove', data)"
              v-tooltip.top="'Remove'"
              :aria-label="`Remove ${data.name}`"
            />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- Empty State -->
    <div v-else class="empty-state p-8 text-center">
      <div class="mb-4">
        <i :class="getPerkIcon(perkType)" class="text-6xl opacity-30" :aria-hidden="true"></i>
      </div>
      <p class="text-xl text-surface-600 dark:text-surface-400 mb-2">
        No {{ getPerkTypeName(perkType) }} perks selected
      </p>
      <p class="text-sm text-surface-500 dark:text-surface-500 mb-4">
        This profile doesn't have any {{ getPerkTypeName(perkType) }} perks assigned yet.
      </p>
      <Button
        v-if="editable"
        label="Add Perks"
        icon="pi pi-plus"
        severity="primary"
        @click="$emit('add-perks')"
        :aria-label="`Add ${getPerkTypeName(perkType)} perks`"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Badge from 'primevue/badge'
import type { PerkEntry, ResearchEntry, PerkEffect } from '@/lib/tinkerprofiles/perk-types'

// Props
const props = defineProps<{
  perks: (PerkEntry | ResearchEntry)[]
  perkType: 'SL' | 'AI' | 'LE'
  editable?: boolean
}>()

// Emits
const emit = defineEmits<{
  'add-perks': []
  'upgrade': [perk: PerkEntry | ResearchEntry]
  'remove': [perk: PerkEntry | ResearchEntry]
}>()

// Helper functions
function getPerkIcon(type: 'SL' | 'AI' | 'LE'): string {
  switch (type) {
    case 'SL':
      return 'pi pi-star text-primary-500'
    case 'AI':
      return 'pi pi-bolt text-cyan-500'
    case 'LE':
      return 'pi pi-book text-purple-500'
    default:
      return 'pi pi-star'
  }
}

function getPerkTypeName(type: 'SL' | 'AI' | 'LE'): string {
  switch (type) {
    case 'SL':
      return 'Standard (SL)'
    case 'AI':
      return 'Alien (AI)'
    case 'LE':
      return 'Research (LE)'
    default:
      return type
  }
}

function getDisplayEffects(effects: PerkEffect[] | undefined): string[] {
  if (!effects || effects.length === 0) {
    return []
  }

  // For now, return placeholder effect descriptions
  // This will be replaced with actual effect parsing when database is connected
  return [
    'Effect details will be displayed here',
    'once connected to the database'
  ]
}
</script>

<style scoped>
.perk-data-table :deep(.p-datatable-tbody) {
  font-size: 0.9rem;
}

.perk-data-table :deep(.p-datatable-header) {
  background: var(--surface-50);
  border-bottom: 1px solid var(--surface-200);
}

.dark .perk-data-table :deep(.p-datatable-header) {
  background: var(--surface-900);
  border-bottom: 1px solid var(--surface-700);
}

.perk-effects {
  max-width: 400px;
}

.empty-state {
  background: var(--surface-50);
  border: 2px dashed var(--surface-300);
  border-radius: 0.5rem;
}

.dark .empty-state {
  background: var(--surface-900);
  border-color: var(--surface-700);
}
</style>
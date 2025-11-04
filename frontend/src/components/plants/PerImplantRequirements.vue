<!--
PerImplantRequirements.vue - Display requirements per implant slot
Shows individual requirements for each configured implant slot with met/unmet status
-->
<template>
  <div class="per-implant-requirements">
    <div v-if="hasRequirements">
      <!-- Desktop/Tablet: DataTable -->
      <div class="hidden md:block">
        <DataTable
          :value="props.perImplantRequirements"
          striped-rows
          :show-gridlines="true"
          responsive-layout="scroll"
          class="text-sm"
        >
          <Column field="slotName" header="Slot" :sortable="true" class="font-medium">
            <template #body="{ data }">
              <span class="text-surface-900 dark:text-surface-50 font-semibold">
                {{ data.slotName }}
              </span>
            </template>
          </Column>
          <Column field="requirements" header="Requirements" class="min-w-[400px]">
            <template #body="{ data }">
              <div class="flex flex-wrap gap-2">
                <Tag
                  v-for="req in data.requirements"
                  :key="req.stat"
                  :class="[
                    'text-xs',
                    req.met
                      ? 'border-green-500 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 text-green-700 dark:text-green-300'
                      : 'border-red-500 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 text-red-700 dark:text-red-300',
                  ]"
                >
                  <template v-if="req.met">
                    <i class="pi pi-check mr-1" aria-hidden="true"></i>
                    {{ req.statName }}: {{ req.required }}
                  </template>
                  <template v-else>
                    <i class="pi pi-exclamation-triangle mr-1" aria-hidden="true"></i>
                    {{ req.statName }}: {{ req.required }} (Need +{{ req.required - req.current }})
                  </template>
                </Tag>
              </div>
            </template>
          </Column>
        </DataTable>
      </div>

      <!-- Mobile: Card Layout -->
      <div class="md:hidden space-y-4">
        <div
          v-for="implantReq in props.perImplantRequirements"
          :key="implantReq.slot"
          class="bg-surface-50 dark:bg-surface-900 rounded-lg p-4 border border-surface-200 dark:border-surface-700"
        >
          <div class="font-bold text-surface-900 dark:text-surface-50 mb-3">
            {{ implantReq.slotName }}
          </div>
          <div class="flex flex-wrap gap-2">
            <Tag
              v-for="req in implantReq.requirements"
              :key="req.stat"
              :class="[
                'text-xs',
                req.met
                  ? 'border-green-500 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 text-green-700 dark:text-green-300'
                  : 'border-red-500 bg-gradient-to-r from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 text-red-700 dark:text-red-300',
              ]"
            >
              <template v-if="req.met">
                <i class="pi pi-check mr-1" aria-hidden="true"></i>
                {{ req.statName }}: {{ req.required }}
              </template>
              <template v-else>
                <i class="pi pi-exclamation-triangle mr-1" aria-hidden="true"></i>
                {{ req.statName }}: {{ req.required }} (Need +{{ req.required - req.current }})
              </template>
            </Tag>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-8 text-surface-500 dark:text-surface-400">
      <i class="pi pi-info-circle text-3xl mb-2" aria-hidden="true"></i>
      <p>No implants configured yet</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import type { PerImplantRequirement } from '@/types/api';

interface Props {
  perImplantRequirements: PerImplantRequirement[];
}

const props = defineProps<Props>();

const hasRequirements = computed(() => {
  return props.perImplantRequirements && props.perImplantRequirements.length > 0;
});
</script>

<style scoped>
/* DataTable styling adjustments */
:deep(.p-datatable) {
  font-size: 0.875rem;
  background-color: var(--p-surface-0);
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

/* Tag styling */
:deep(.p-tag) {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-width: 1px;
  border-style: solid;
}

/* Dark mode */
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

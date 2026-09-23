<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePocketBossStore } from '@/stores/pocketBossStore';
import { useSymbiantsStore } from '@/stores/symbiants';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import { getImplantSlotNameFromBitflag } from '@/services/game-utils';
import type { Mob, MobWithDrops, SymbiantItem } from '@/types/api';

const pocketBossStore = usePocketBossStore();
const symbiantStore = useSymbiantsStore();

// Local state
const searchQuery = ref('');
const activeTab = ref(0);

// Computed properties
const filteredBosses = computed(() => {
  if (!searchQuery.value.trim()) return pocketBossStore.pocketBosses;

  const search = searchQuery.value.toLowerCase();
  return pocketBossStore.pocketBosses.filter(
    (boss) =>
      boss.name.toLowerCase().includes(search) ||
      boss.playfield?.toLowerCase().includes(search) ||
      boss.location?.toLowerCase().includes(search) ||
      getBossDrops(boss).some(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          getSlotName(s.slot_id).toLowerCase().includes(search) ||
          s.family?.toLowerCase().includes(search)
      )
  );
});

const filteredSymbiants = computed(() => {
  if (!searchQuery.value.trim()) return Array.from(symbiantStore.symbiants.values());

  const search = searchQuery.value.toLowerCase();
  return Array.from(symbiantStore.symbiants.values()).filter(
    (symbiant) =>
      symbiant.name.toLowerCase().includes(search) ||
      getSlotName(symbiant.slot_id).toLowerCase().includes(search) ||
      symbiant.family?.toLowerCase().includes(search) ||
      getDropSources(symbiant.id).some(
        (boss) =>
          boss.name.toLowerCase().includes(search) || boss.playfield?.toLowerCase().includes(search)
      )
  );
});

const bossSymbiantTable = computed(() => {
  return filteredBosses.value
    .flatMap((boss) =>
      getBossDrops(boss).map((symbiant) => ({
        bossId: boss.id,
        bossName: boss.name,
        bossLevel: boss.level,
        bossPlayfield: boss.playfield,
        bossLocation: boss.location,
        symbiantId: symbiant.id,
        symbiantName: symbiant.name,
        symbiantSlot: getSlotName(symbiant.slot_id),
        symbiantQl: symbiant.ql,
        symbiantFamily: symbiant.family,
      }))
    )
    .sort((a, b) => {
      // Sort by boss level first, then by symbiant QL
      if (a.bossLevel !== b.bossLevel) return (a.bossLevel ?? 0) - (b.bossLevel ?? 0);
      if (a.symbiantQl !== b.symbiantQl) return b.symbiantQl - a.symbiantQl;
      return a.bossName.localeCompare(b.bossName);
    });
});

// Methods
function hasDrops(boss: Mob): boss is MobWithDrops {
  return 'dropped_items' in boss && Array.isArray(boss.dropped_items);
}

// Store bosses carry no embedded drops; only a MobWithDrops payload has them
function getBossDrops(boss: Mob): SymbiantItem[] {
  return hasDrops(boss) ? boss.dropped_items : [];
}

function getSlotName(slotId: number): string {
  return getImplantSlotNameFromBitflag(slotId);
}

function getDropSources(symbiantId: number): Mob[] {
  return pocketBossStore.getPocketBossesBySymbiant(symbiantId);
}

function getBossLevelSeverity(level: number | null): 'success' | 'info' | 'warning' | 'danger' {
  if (level === null || level < 50) return 'success';
  if (level < 100) return 'info';
  if (level < 150) return 'warning';
  return 'danger';
}

function getQualitySeverity(ql: number): 'success' | 'info' | 'warning' | 'danger' {
  if (ql >= 200) return 'danger';
  if (ql >= 150) return 'warning';
  if (ql >= 100) return 'info';
  return 'success';
}

function getSlotIcon(slot: string): string {
  const iconMap: Record<string, string> = {
    Head: 'pi-user',
    Eyes: 'pi-eye',
    Ears: 'pi-volume-up',
    Chest: 'pi-shield',
    'Right Arm': 'pi-stop',
    'Left Arm': 'pi-stop',
    'Right Wrist': 'pi-circle',
    'Left Wrist': 'pi-circle',
    'Right Hand': 'pi-hand-paper',
    'Left Hand': 'pi-hand-paper',
    Waist: 'pi-minus',
    Legs: 'pi-sort-down',
    Feet: 'pi-step-forward',
  };
  return iconMap[slot] || 'pi-circle';
}

function clearSearch() {
  searchQuery.value = '';
}

function exportTableData() {
  // Simple CSV export
  const headers = [
    'Boss Name',
    'Boss Level',
    'Location',
    'Symbiant Name',
    'Slot',
    'Quality Level',
    'Family',
  ];
  const csvContent = [
    headers.join(','),
    ...bossSymbiantTable.value.map((row) =>
      [
        `"${row.bossName}"`,
        row.bossLevel,
        `"${`${row.bossPlayfield || ''} ${row.bossLocation || ''}`.trim()}"`,
        `"${row.symbiantName}"`,
        row.symbiantSlot,
        row.symbiantQl,
        `"${row.symbiantFamily || ''}"`,
      ].join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'boss-symbiant-matches.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="boss-symbiant-matcher">
    <!-- Header Section -->
    <Card class="mb-6">
      <template #content>
        <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold mb-2">Boss-Symbiant Matcher</h2>
            <p class="text-surface-600 dark:text-surface-400">
              Explore relationships between pocket bosses and their symbiant drops
            </p>
          </div>

          <div class="flex items-center gap-3 w-full lg:w-auto">
            <InputText
              v-model="searchQuery"
              placeholder="Search bosses, symbiants, or locations..."
              class="flex-1 lg:w-80"
            />
            <Button
              v-if="searchQuery"
              icon="pi pi-times"
              outlined
              size="small"
              @click="clearSearch"
            />
            <Button
              icon="pi pi-download"
              label="Export CSV"
              outlined
              size="small"
              @click="exportTableData"
            />
          </div>
        </div>
      </template>
    </Card>

    <!-- Tab View -->
    <TabView v-model:activeIndex="activeTab">
      <!-- Boss → Symbiant View -->
      <TabPanel>
        <template #header>
          <div class="flex items-center gap-2">
            <i class="pi pi-arrow-right"></i>
            <span>Boss → Symbiant</span>
          </div>
        </template>

        <div class="space-y-4">
          <div class="text-sm text-surface-600 dark:text-surface-400">
            {{ filteredBosses.length }} bosses found
          </div>

          <div class="space-y-3">
            <Card v-for="boss in filteredBosses" :key="boss.id" class="boss-symbiant-card">
              <template #content>
                <div class="space-y-4">
                  <!-- Boss Header -->
                  <div class="flex items-start justify-between">
                    <div>
                      <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50">
                        {{ boss.name }}
                      </h3>
                      <div
                        class="flex items-center gap-3 text-sm text-surface-600 dark:text-surface-400"
                      >
                        <span>{{ boss.playfield || 'Unknown Playfield' }}</span>
                        <span v-if="boss.location">• {{ boss.location }}</span>
                      </div>
                    </div>
                    <Tag
                      :value="`Level ${boss.level}`"
                      :severity="getBossLevelSeverity(boss.level)"
                    />
                  </div>

                  <!-- Dropped Symbiants -->
                  <div v-if="getBossDrops(boss).length">
                    <h4 class="font-medium mb-2 text-surface-700 dark:text-surface-300">
                      Dropped Symbiants ({{ getBossDrops(boss).length }})
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      <div
                        v-for="symbiant in getBossDrops(boss)"
                        :key="symbiant.id"
                        class="flex items-center justify-between p-3 border border-surface-200 dark:border-surface-700 rounded-lg"
                      >
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                          <i
                            :class="`pi ${getSlotIcon(getSlotName(symbiant.slot_id))} text-primary-500`"
                          ></i>
                          <div class="min-w-0">
                            <div class="font-medium text-surface-900 dark:text-surface-50 truncate">
                              {{ symbiant.name }}
                            </div>
                            <div class="text-sm text-surface-600 dark:text-surface-400">
                              {{ getSlotName(symbiant.slot_id) }}
                              <span v-if="symbiant.family"> • {{ symbiant.family }}</span>
                            </div>
                          </div>
                        </div>
                        <Tag
                          :value="`QL ${symbiant.ql}`"
                          :severity="getQualitySeverity(symbiant.ql)"
                        />
                      </div>
                    </div>
                  </div>
                  <div v-else class="text-center py-4 text-surface-500 dark:text-surface-400">
                    No symbiants recorded for this boss
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </div>
      </TabPanel>

      <!-- Symbiant → Boss View -->
      <TabPanel>
        <template #header>
          <div class="flex items-center gap-2">
            <i class="pi pi-arrow-left"></i>
            <span>Symbiant → Boss</span>
          </div>
        </template>

        <div class="space-y-4">
          <div class="text-sm text-surface-600 dark:text-surface-400">
            {{ filteredSymbiants.length }} symbiants found
          </div>

          <div class="space-y-3">
            <Card
              v-for="symbiant in filteredSymbiants"
              :key="symbiant.id"
              class="symbiant-boss-card"
            >
              <template #content>
                <div class="space-y-4">
                  <!-- Symbiant Header -->
                  <div class="flex items-start justify-between">
                    <div class="flex items-center gap-3">
                      <i
                        :class="`pi ${getSlotIcon(getSlotName(symbiant.slot_id))} text-xl text-primary-500`"
                      ></i>
                      <div>
                        <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50">
                          {{ symbiant.name }}
                        </h3>
                        <div
                          class="flex items-center gap-3 text-sm text-surface-600 dark:text-surface-400"
                        >
                          <span>{{ getSlotName(symbiant.slot_id) }}</span>
                          <span v-if="symbiant.family">• {{ symbiant.family }}</span>
                        </div>
                      </div>
                    </div>
                    <Tag :value="`QL ${symbiant.ql}`" :severity="getQualitySeverity(symbiant.ql)" />
                  </div>

                  <!-- Drop Sources -->
                  <div>
                    <h4 class="font-medium mb-2 text-surface-700 dark:text-surface-300">
                      Drop Sources ({{ getDropSources(symbiant.id).length }})
                    </h4>
                    <div
                      v-if="getDropSources(symbiant.id).length > 0"
                      class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
                    >
                      <div
                        v-for="boss in getDropSources(symbiant.id)"
                        :key="boss.id"
                        class="flex items-center justify-between p-3 border border-surface-200 dark:border-surface-700 rounded-lg"
                      >
                        <div class="min-w-0 flex-1">
                          <div class="font-medium text-surface-900 dark:text-surface-50 truncate">
                            {{ boss.name }}
                          </div>
                          <div class="text-sm text-surface-600 dark:text-surface-400 truncate">
                            {{ boss.playfield || 'Unknown' }}
                            <span v-if="boss.location"> • {{ boss.location }}</span>
                          </div>
                        </div>
                        <Tag
                          :value="`Level ${boss.level}`"
                          :severity="getBossLevelSeverity(boss.level)"
                        />
                      </div>
                    </div>
                    <div v-else class="text-center py-4 text-surface-500 dark:text-surface-400">
                      No known drop sources
                    </div>
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </div>
      </TabPanel>

      <!-- Combined Table View -->
      <TabPanel>
        <template #header>
          <div class="flex items-center gap-2">
            <i class="pi pi-table"></i>
            <span>Combined Table</span>
          </div>
        </template>

        <Card>
          <template #content>
            <DataTable
              :value="bossSymbiantTable"
              paginator
              :rows="25"
              :rows-per-page-options="[10, 25, 50, 100]"
              sort-field="bossLevel"
              :sort-order="1"
              show-gridlines
              striped-rows
              class="boss-symbiant-table"
              :loading="symbiantStore.loading || pocketBossStore.loading"
            >
              <template #empty>
                <div class="text-center py-8">
                  <i class="pi pi-search text-3xl text-surface-400 mb-3"></i>
                  <p class="text-surface-600 dark:text-surface-400">No matches found</p>
                </div>
              </template>

              <Column field="bossName" header="Boss" sortable class="min-w-[200px]">
                <template #body="{ data }">
                  <div class="font-medium">{{ data.bossName }}</div>
                  <div class="text-sm text-surface-600 dark:text-surface-400">
                    {{ data.bossPlayfield }}
                    <span v-if="data.bossLocation"> • {{ data.bossLocation }}</span>
                  </div>
                </template>
              </Column>

              <Column field="bossLevel" header="Level" sortable class="min-w-[80px]">
                <template #body="{ data }">
                  <Tag
                    :value="`${data.bossLevel}`"
                    :severity="getBossLevelSeverity(data.bossLevel)"
                  />
                </template>
              </Column>

              <Column field="symbiantName" header="Symbiant" sortable class="min-w-[250px]">
                <template #body="{ data }">
                  <div class="flex items-center gap-2">
                    <i :class="`pi ${getSlotIcon(data.symbiantSlot)} text-primary-500`"></i>
                    <div>
                      <div class="font-medium">{{ data.symbiantName }}</div>
                      <div class="text-sm text-surface-600 dark:text-surface-400">
                        {{ data.symbiantSlot }}
                        <span v-if="data.symbiantFamily"> • {{ data.symbiantFamily }}</span>
                      </div>
                    </div>
                  </div>
                </template>
              </Column>

              <Column field="symbiantQl" header="Quality" sortable class="min-w-[80px]">
                <template #body="{ data }">
                  <Tag
                    :value="`QL ${data.symbiantQl}`"
                    :severity="getQualitySeverity(data.symbiantQl)"
                  />
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>
      </TabPanel>
    </TabView>
  </div>
</template>

<style scoped>
.boss-symbiant-card :deep(.p-card-body),
.symbiant-boss-card :deep(.p-card-body) {
  padding: 1.25rem;
}

.boss-symbiant-table :deep(.p-datatable-table) {
  font-size: 0.875rem;
}

.boss-symbiant-table :deep(.p-datatable-thead > tr > th) {
  background: var(--surface-100);
  color: var(--surface-700);
  font-weight: 600;
}

.boss-symbiant-table :deep(.p-datatable-tbody > tr:nth-child(even)) {
  background: var(--surface-50);
}

:global(.dark) .boss-symbiant-table :deep(.p-datatable-thead > tr > th) {
  background: var(--surface-800);
  color: var(--surface-300);
}

:global(.dark) .boss-symbiant-table :deep(.p-datatable-tbody > tr:nth-child(even)) {
  background: var(--surface-900);
}
</style>

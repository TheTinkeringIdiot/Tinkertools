<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { apiClient } from '@/services/api-client';
import { getImplantSlotNameFromBitflag, getMinimumLevel } from '@/services/game-utils';
import { useToast } from 'primevue/usetoast';
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import Button from 'primevue/button';
import type { Mob, SymbiantItem } from '@/types/api';

const route = useRoute();
const router = useRouter();
const toast = useToast();

// State
const boss = ref<Mob | null>(null);
const drops = ref<SymbiantItem[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

// Computed
const bossId = computed(() => parseInt(route.params.id as string));

const sortedDrops = computed(() => {
  return [...drops.value].sort((a, b) => a.ql - b.ql);
});

function getSeverity(level: number | null): 'success' | 'info' | 'warning' | 'danger' {
  if (!level) return 'info';
  if (level < 50) return 'success';
  if (level < 100) return 'info';
  if (level < 150) return 'warning';
  return 'danger';
}

function formatLocation(): string {
  if (!boss.value) return '';
  const parts = [];
  if (boss.value.playfield) parts.push(boss.value.playfield);
  if (boss.value.location) parts.push(boss.value.location);
  return parts.join(' - ') || 'Unknown Location';
}

function navigateToItem(aoid: number) {
  router.push(`/items/${aoid}`);
}

function formatMinimumLevel(symbiant: SymbiantItem): string {
  try {
    const level = getMinimumLevel(symbiant);
    return `${level}`;
  } catch (error) {
    console.error('Failed to extract level from symbiant:', symbiant.name, error);
    return '--';
  }
}

async function shareLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    toast.add({
      severity: 'success',
      summary: 'Link Copied',
      detail: 'Boss detail link copied to clipboard',
      life: 3000
    });
  } catch (err) {
    console.error('Failed to copy link:', err);
    toast.add({
      severity: 'error',
      summary: 'Copy Failed',
      detail: 'Failed to copy link to clipboard',
      life: 3000
    });
  }
}

async function fetchBossData() {
  loading.value = true;
  error.value = null;

  try {
    // Fetch boss info and drops in parallel
    const [bossResponse, dropsResponse] = await Promise.all([
      apiClient.getMob(bossId.value),
      apiClient.getMobDrops(bossId.value)
    ]);

    if (!bossResponse.data) {
      error.value = 'Boss not found';
      return;
    }

    boss.value = bossResponse.data;
    drops.value = dropsResponse.data || [];
  } catch (err: any) {
    console.error('Failed to fetch boss data:', err);
    if (err.response?.status === 404) {
      error.value = 'Boss not found';
    } else {
      error.value = err.message || 'Failed to load boss data';
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchBossData();
});
</script>

<template>
  <div class="boss-detail h-full flex flex-col">
    <!-- Header -->
    <div class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-6">
      <div class="container mx-auto">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-3">
            <Button
              icon="pi pi-arrow-left"
              text
              rounded
              @click="router.push('/pocket')"
              class="text-surface-600 dark:text-surface-400"
            />
            <i class="pi pi-users text-2xl text-primary-500"></i>
            <h1 v-if="boss" class="text-3xl font-bold text-surface-900 dark:text-surface-50">
              {{ boss.name }}
            </h1>
            <h1 v-else class="text-3xl font-bold text-surface-900 dark:text-surface-50">
              Boss Details
            </h1>
          </div>
          <Button
            v-if="boss"
            icon="pi pi-share-alt"
            label="Share"
            outlined
            @click="shareLink"
          />
        </div>
        <p v-if="boss" class="text-surface-600 dark:text-surface-400">
          {{ formatLocation() }}
        </p>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 bg-surface-0 dark:bg-surface-950">
      <div class="container mx-auto px-4 py-6">
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-12">
          <i class="pi pi-spinner pi-spin text-4xl text-primary-500 mb-4"></i>
          <p class="text-lg text-surface-600 dark:text-surface-400">Loading boss data...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-12">
          <i class="pi pi-exclamation-triangle text-4xl text-red-500 mb-4"></i>
          <p class="text-lg text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
          <div class="flex gap-2 justify-center">
            <Button
              label="Try Again"
              icon="pi pi-refresh"
              @click="fetchBossData"
            />
            <Button
              label="Back to Pocket Bosses"
              icon="pi pi-arrow-left"
              outlined
              @click="router.push('/pocket')"
            />
          </div>
        </div>

        <!-- Boss Details -->
        <div v-else-if="boss" class="space-y-6">
          <!-- Boss Info Card -->
          <Card>
            <template #content>
              <!-- Level Section (prominent, separate) -->
              <div class="mb-6">
                <h3 class="text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">Boss Level</h3>
                <Tag
                  v-if="boss.level !== null"
                  :value="`Level ${boss.level}`"
                  :severity="getSeverity(boss.level)"
                  class="text-lg px-4 py-2"
                />
                <span v-else class="text-surface-500">Unknown</span>
              </div>

              <!-- Where to Find Section (hierarchical) -->
              <div class="space-y-3">
                <h3 class="text-sm font-medium text-surface-600 dark:text-surface-400 mb-3">
                  Where to Find This Pattern
                </h3>

                <!-- Playfield (root) -->
                <div class="flex items-start gap-3">
                  <i class="pi pi-map-marker text-xl text-primary-500 mt-0.5"></i>
                  <div class="flex-1">
                    <div class="text-lg font-semibold text-surface-900 dark:text-surface-50">
                      {{ boss.playfield || 'Unknown Zone' }}
                    </div>

                    <!-- Location (child) - with visual connector -->
                    <div v-if="boss.location" class="mt-3 ml-4 border-l-2 border-primary-200 dark:border-primary-800 pl-4">
                      <div class="flex items-center gap-2 text-surface-700 dark:text-surface-300">
                        <i class="pi pi-angle-right text-sm"></i>
                        <span class="font-medium">{{ boss.location }}</span>
                      </div>

                      <!-- NPCs (grandchild) - deeper visual connector -->
                      <div
                        v-if="boss.mob_names && boss.mob_names.length > 0"
                        class="mt-3 ml-4 border-l-2 border-primary-200 dark:border-primary-800 pl-4"
                      >
                        <div class="flex items-start gap-2 mb-2">
                          <i class="pi pi-angle-right text-sm text-surface-500 mt-0.5"></i>
                          <span class="text-sm font-medium text-surface-600 dark:text-surface-400">
                            Pattern Dropped By:
                          </span>
                        </div>
                        <div class="flex flex-wrap gap-2 ml-6">
                          <Tag
                            v-for="mob in boss.mob_names"
                            :key="mob"
                            :value="mob"
                            severity="secondary"
                            class="transition-all hover:scale-105"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </Card>

          <!-- Drops Table -->
          <Card>
            <template #title>
              <div class="flex items-center justify-between">
                <span>Symbiant Drops ({{ sortedDrops.length }})</span>
              </div>
            </template>
            <template #content>
              <div v-if="sortedDrops.length > 0">
                <DataTable
                  :value="sortedDrops"
                  stripedRows
                  :paginator="sortedDrops.length > 10"
                  :rows="10"
                  :rowsPerPageOptions="[10, 25, 50]"
                  class="p-datatable-sm"
                >
                  <Column field="name" header="Symbiant Name">
                    <template #body="{ data }">
                      <a
                        @click.prevent="navigateToItem(data.aoid)"
                        class="text-primary-500 hover:text-primary-600 cursor-pointer font-medium"
                      >
                        {{ data.name }}
                      </a>
                    </template>
                  </Column>
                  <Column field="family" header="Family">
                    <template #body="{ data }">
                      <Tag :value="data.family" class="font-medium" />
                    </template>
                  </Column>
                  <Column field="slot_id" header="Slot">
                    <template #body="{ data }">
                      {{ getImplantSlotNameFromBitflag(data.slot_id) }}
                    </template>
                  </Column>
                  <Column field="ql" header="QL" sortable>
                    <template #body="{ data }">
                      <Tag :value="`QL ${data.ql}`" severity="info" />
                    </template>
                  </Column>
                  <Column header="Level Req" sortable>
                    <template #body="{ data }">
                      <Tag :value="`Lvl ${formatMinimumLevel(data)}`" severity="info" />
                    </template>
                  </Column>
                </DataTable>
              </div>
              <div v-else class="text-center py-8">
                <i class="pi pi-info-circle text-3xl text-surface-400 mb-3"></i>
                <p class="text-surface-600 dark:text-surface-400">No symbiant drops recorded for this boss</p>
              </div>
            </template>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Any component-specific styles */
</style>

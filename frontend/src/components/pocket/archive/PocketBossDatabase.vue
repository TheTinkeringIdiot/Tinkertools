<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePocketBossStore } from '@/stores/pocketBossStore';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Slider from 'primevue/slider';
import Button from 'primevue/button';
import DataView from 'primevue/dataview';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import type { PocketBoss } from '@/types/api';

const pocketBossStore = usePocketBossStore();

// Local state
const selectedBoss = ref<PocketBoss | null>(null);
const showBossDetails = ref(false);
const viewMode = ref<'grid' | 'list'>('grid');

// Computed properties
const bosses = computed(() => pocketBossStore.filteredPocketBosses);
const filters = computed(() => pocketBossStore.filters);
const playfields = computed(() => pocketBossStore.playfields);
const levelRange = computed(() => pocketBossStore.levelRange);

// Local filter state
const searchQuery = ref(filters.value.search || '');
const selectedPlayfield = ref(filters.value.playfield || null);
const levelFilter = ref([
  filters.value.minLevel || levelRange.value.min,
  filters.value.maxLevel || levelRange.value.max,
]);

// Methods
function updateSearch() {
  pocketBossStore.updateFilters({ search: searchQuery.value });
}

function updatePlayfield() {
  pocketBossStore.updateFilters({ playfield: selectedPlayfield.value || undefined });
}

function updateLevelRange() {
  pocketBossStore.updateFilters({
    minLevel: levelFilter.value[0],
    maxLevel: levelFilter.value[1],
  });
}

function clearAllFilters() {
  searchQuery.value = '';
  selectedPlayfield.value = null;
  levelFilter.value = [levelRange.value.min, levelRange.value.max];
  pocketBossStore.clearFilters();
}

function showDetails(boss: PocketBoss) {
  selectedBoss.value = boss;
  showBossDetails.value = true;
}

function getSeverity(level: number): 'success' | 'info' | 'warning' | 'danger' {
  if (level < 50) return 'success';
  if (level < 100) return 'info';
  if (level < 150) return 'warning';
  return 'danger';
}

function formatLocation(boss: PocketBoss): string {
  const parts = [];
  if (boss.playfield) parts.push(boss.playfield);
  if (boss.location) parts.push(boss.location);
  return parts.join(' - ') || 'Unknown Location';
}

// Expose methods for tests
defineExpose({
  formatLocation,
  getSeverity,
  showDetails,
  updateLevelRange,
  updatePlayfield,
});
</script>

<template>
  <div class="pocket-boss-database">
    <!-- Filters Section -->
    <Card class="mb-6">
      <template #content>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <!-- Search Input -->
          <div class="flex flex-col gap-2">
            <label class="font-medium text-sm">Search Bosses</label>
            <InputText
              v-model="searchQuery"
              @input="updateSearch"
              placeholder="Search by name, location, or playfield..."
              class="w-full"
            />
          </div>

          <!-- Playfield Filter -->
          <div class="flex flex-col gap-2">
            <label class="font-medium text-sm">Playfield</label>
            <Dropdown
              v-model="selectedPlayfield"
              @change="updatePlayfield"
              :options="playfields"
              placeholder="All Playfields"
              showClear
              class="w-full"
            />
          </div>

          <!-- Level Range -->
          <div class="flex flex-col gap-2">
            <label class="font-medium text-sm">
              Level Range: {{ levelFilter[0] }} - {{ levelFilter[1] }}
            </label>
            <Slider
              v-model="levelFilter"
              @slideend="updateLevelRange"
              :min="levelRange.min"
              :max="levelRange.max"
              :step="5"
              range
              class="w-full"
            />
          </div>
        </div>

        <!-- Action Buttons -->
        <div
          class="flex items-center justify-between mt-4 pt-4 border-t border-surface-200 dark:border-surface-700"
        >
          <div class="flex items-center gap-2">
            <Button
              @click="clearAllFilters"
              label="Clear Filters"
              icon="pi pi-filter-slash"
              outlined
              size="small"
            />
            <span class="text-sm text-surface-600 dark:text-surface-400">
              {{ bosses.length }} boss{{ bosses.length !== 1 ? 'es' : '' }} found
            </span>
          </div>

          <div class="flex items-center gap-2">
            <Button
              @click="viewMode = 'grid'"
              :class="{ 'p-button-outlined': viewMode !== 'grid' }"
              icon="pi pi-th-large"
              size="small"
            />
            <Button
              @click="viewMode = 'list'"
              :class="{ 'p-button-outlined': viewMode !== 'list' }"
              icon="pi pi-list"
              size="small"
            />
          </div>
        </div>
      </template>
    </Card>

    <!-- Boss List/Grid -->
    <DataView
      :value="bosses"
      :layout="viewMode"
      paginator
      :rows="20"
      :rowsPerPageOptions="[10, 20, 50]"
    >
      <template #empty>
        <div class="text-center py-12">
          <i class="pi pi-search text-4xl text-surface-400 mb-4"></i>
          <p class="text-lg text-surface-600 dark:text-surface-400">No pocket bosses found</p>
          <p class="text-sm text-surface-500 dark:text-surface-500">
            Try adjusting your filters or search terms
          </p>
        </div>
      </template>

      <template #grid="slotProps">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Card
            v-for="boss in slotProps.items"
            :key="boss.id"
            class="boss-card cursor-pointer hover:shadow-lg transition-all duration-200"
            @click="showDetails(boss)"
          >
            <template #content>
              <div class="space-y-3">
                <!-- Header -->
                <div class="flex items-start justify-between">
                  <div>
                    <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50">
                      {{ boss.name }}
                    </h3>
                    <p class="text-sm text-surface-600 dark:text-surface-400">
                      {{ formatLocation(boss) }}
                    </p>
                  </div>
                  <Tag :value="`Level ${boss.level}`" :severity="getSeverity(boss.level)" />
                </div>

                <!-- Mobs -->
                <div v-if="boss.mobs" class="text-sm">
                  <span class="font-medium text-surface-700 dark:text-surface-300">Mobs:</span>
                  <span class="text-surface-600 dark:text-surface-400 ml-1">{{ boss.mobs }}</span>
                </div>

                <!-- Symbiant Count -->
                <div class="flex items-center justify-between text-sm">
                  <span class="text-surface-600 dark:text-surface-400">
                    {{ boss.dropped_symbiants?.length || 0 }} symbiant{{
                      (boss.dropped_symbiants?.length || 0) !== 1 ? 's' : ''
                    }}
                  </span>
                  <i class="pi pi-arrow-right text-primary-500"></i>
                </div>
              </div>
            </template>
          </Card>
        </div>
      </template>

      <template #list="slotProps">
        <div class="space-y-2">
          <Card
            v-for="boss in slotProps.items"
            :key="boss.id"
            class="boss-list-item cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
            @click="showDetails(boss)"
          >
            <template #content>
              <div class="flex items-center justify-between py-2">
                <div class="flex items-center gap-4 flex-1">
                  <div class="min-w-0 flex-1">
                    <h3
                      class="text-lg font-semibold text-surface-900 dark:text-surface-50 truncate"
                    >
                      {{ boss.name }}
                    </h3>
                    <p class="text-sm text-surface-600 dark:text-surface-400 truncate">
                      {{ formatLocation(boss) }}
                      <span v-if="boss.mobs" class="ml-2">• {{ boss.mobs }}</span>
                    </p>
                  </div>

                  <div class="flex items-center gap-4">
                    <Tag :value="`Level ${boss.level}`" :severity="getSeverity(boss.level)" />
                    <span class="text-sm text-surface-600 dark:text-surface-400">
                      {{ boss.dropped_symbiants?.length || 0 }} symbiants
                    </span>
                    <i class="pi pi-arrow-right text-primary-500"></i>
                  </div>
                </div>
              </div>
            </template>
          </Card>
        </div>
      </template>
    </DataView>

    <!-- Boss Details Dialog -->
    <Dialog
      v-model:visible="showBossDetails"
      :modal="true"
      :closable="true"
      :draggable="false"
      class="w-full max-w-4xl mx-4"
    >
      <template #header>
        <div v-if="selectedBoss" class="flex items-center gap-3">
          <i class="pi pi-users text-xl text-primary-500"></i>
          <div>
            <h2 class="text-xl font-semibold">{{ selectedBoss.name }}</h2>
            <p class="text-sm text-surface-600 dark:text-surface-400">
              {{ formatLocation(selectedBoss) }}
            </p>
          </div>
        </div>
      </template>

      <div v-if="selectedBoss" class="space-y-6">
        <!-- Boss Info -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 class="text-lg font-semibold mb-3">Boss Information</h3>
            <div class="space-y-2">
              <div class="flex justify-between">
                <span class="font-medium">Level:</span>
                <Tag :value="`${selectedBoss.level}`" :severity="getSeverity(selectedBoss.level)" />
              </div>
              <div class="flex justify-between">
                <span class="font-medium">Playfield:</span>
                <span>{{ selectedBoss.playfield || 'Unknown' }}</span>
              </div>
              <div class="flex justify-between">
                <span class="font-medium">Location:</span>
                <span>{{ selectedBoss.location || 'Unknown' }}</span>
              </div>
            </div>
          </div>

          <div v-if="selectedBoss.mobs">
            <h3 class="text-lg font-semibold mb-3">Encounter</h3>
            <p class="text-surface-700 dark:text-surface-300">{{ selectedBoss.mobs }}</p>
          </div>
        </div>

        <!-- Dropped Symbiants -->
        <div v-if="selectedBoss.dropped_symbiants?.length">
          <h3 class="text-lg font-semibold mb-3">
            Dropped Symbiants ({{ selectedBoss.dropped_symbiants.length }})
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              v-for="symbiant in selectedBoss.dropped_symbiants"
              :key="symbiant.id"
              class="p-3 border border-surface-200 dark:border-surface-700 rounded-lg"
            >
              <div class="flex items-start justify-between">
                <div class="min-w-0 flex-1">
                  <h4 class="font-medium text-surface-900 dark:text-surface-50 truncate">
                    {{ symbiant.name }}
                  </h4>
                  <p class="text-sm text-surface-600 dark:text-surface-400">
                    {{ symbiant.slot }} • QL {{ symbiant.ql }}
                  </p>
                </div>
                <Tag :value="`QL ${symbiant.ql}`" severity="info" />
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-6">
          <i class="pi pi-info-circle text-2xl text-surface-400 mb-2"></i>
          <p class="text-surface-600 dark:text-surface-400">No symbiant drops recorded</p>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.boss-card:hover {
  transform: translateY(-2px);
}

.boss-list-item :deep(.p-card-body) {
  padding: 0.75rem;
}

.boss-card :deep(.p-card-body) {
  padding: 1rem;
}
</style>

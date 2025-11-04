<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSymbiantsStore } from '@/stores/symbiants';
import { usePocketBossStore } from '@/stores/pocketBossStore';
import Card from 'primevue/card';
import InputText from 'primevue/inputtext';
import MultiSelect from 'primevue/multiselect';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import DataView from 'primevue/dataview';
import Tag from 'primevue/tag';
import Dialog from 'primevue/dialog';
import type { Symbiant, PocketBoss } from '@/types/api';

const symbiantStore = useSymbiantsStore();
const pocketBossStore = usePocketBossStore();

// Local state
const selectedSymbiant = ref<Symbiant | null>(null);
const showSymbiantDetails = ref(false);
const viewMode = ref<'grid' | 'list'>('grid');

// Filter state
const searchQuery = ref('');
const selectedSlots = ref<string[]>([]);
const selectedQualities = ref<number[]>([]);
const selectedFamily = ref<string | null>(null);

// Computed properties
const symbiants = computed(() => {
  let result = Array.from(symbiantStore.symbiants.values());

  // Apply search filter
  if (searchQuery.value.trim()) {
    const search = searchQuery.value.toLowerCase();
    result = result.filter(
      (symbiant) =>
        symbiant.name.toLowerCase().includes(search) ||
        symbiant.slot.toLowerCase().includes(search) ||
        symbiant.family?.toLowerCase().includes(search)
    );
  }

  // Apply slot filter
  if (selectedSlots.value.length > 0) {
    result = result.filter((symbiant) => selectedSlots.value.includes(symbiant.slot));
  }

  // Apply quality filter
  if (selectedQualities.value.length > 0) {
    result = result.filter((symbiant) => selectedQualities.value.includes(symbiant.ql));
  }

  // Apply family filter
  if (selectedFamily.value) {
    result = result.filter((symbiant) => symbiant.family === selectedFamily.value);
  }

  return result.sort((a, b) => {
    // Sort by slot first, then by QL, then by name
    if (a.slot !== b.slot) return a.slot.localeCompare(b.slot);
    if (a.ql !== b.ql) return b.ql - a.ql; // Higher QL first
    return a.name.localeCompare(b.name);
  });
});

const availableSlots = computed(() => {
  const slots = new Set(Array.from(symbiantStore.symbiants.values()).map((s) => s.slot));
  return Array.from(slots).sort();
});

const availableQualities = computed(() => {
  const qualities = new Set(Array.from(symbiantStore.symbiants.values()).map((s) => s.ql));
  return Array.from(qualities).sort((a, b) => b - a); // Descending order
});

const availableFamilies = computed(() => {
  const families = new Set(
    Array.from(symbiantStore.symbiants.values())
      .map((s) => s.family)
      .filter(Boolean)
  );
  return Array.from(families).sort();
});

// Methods
function clearAllFilters() {
  searchQuery.value = '';
  selectedSlots.value = [];
  selectedQualities.value = [];
  selectedFamily.value = null;
}

function showDetails(symbiant: Symbiant) {
  selectedSymbiant.value = symbiant;
  showSymbiantDetails.value = true;
}

function getDropSources(symbiant: Symbiant): PocketBoss[] {
  return pocketBossStore.getPocketBossesBySymbiant(symbiant.id);
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
    Eye: 'pi-eye',
    Ear: 'pi-volume-up',
    Chest: 'pi-shield',
    Arm: 'pi-stop',
    Wrist: 'pi-circle',
    Hand: 'pi-hand-paper',
    Waist: 'pi-minus',
    Leg: 'pi-sort-down',
    Feet: 'pi-step-forward',
  };
  return iconMap[slot] || 'pi-circle';
}

// Expose methods for tests
defineExpose({
  clearAllFilters,
  showDetails,
  getDropSources,
  getQualitySeverity,
  getSlotIcon,
});
</script>

<template>
  <div class="symbiant-lookup">
    <!-- Filters Section -->
    <Card class="mb-6">
      <template #content>
        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          <!-- Search Input -->
          <div class="flex flex-col gap-2">
            <label class="font-medium text-sm">Search Symbiants</label>
            <InputText
              v-model="searchQuery"
              placeholder="Search by name, slot, or family..."
              class="w-full"
            />
          </div>

          <!-- Slot Filter -->
          <div class="flex flex-col gap-2">
            <label class="font-medium text-sm">Body Slots</label>
            <MultiSelect
              v-model="selectedSlots"
              :options="availableSlots"
              placeholder="All Slots"
              :maxSelectedLabels="2"
              class="w-full"
              display="chip"
            />
          </div>

          <!-- Quality Filter -->
          <div class="flex flex-col gap-2">
            <label class="font-medium text-sm">Quality Levels</label>
            <MultiSelect
              v-model="selectedQualities"
              :options="availableQualities"
              placeholder="All Qualities"
              :maxSelectedLabels="2"
              class="w-full"
              display="chip"
            />
          </div>

          <!-- Family Filter -->
          <div class="flex flex-col gap-2">
            <label class="font-medium text-sm">Symbiant Family</label>
            <Dropdown
              v-model="selectedFamily"
              :options="availableFamilies"
              placeholder="All Families"
              showClear
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
              {{ symbiants.length }} symbiant{{ symbiants.length !== 1 ? 's' : '' }} found
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

    <!-- Symbiant List/Grid -->
    <DataView
      :value="symbiants"
      :layout="viewMode"
      paginator
      :rows="24"
      :rowsPerPageOptions="[12, 24, 48]"
    >
      <template #empty>
        <div class="text-center py-12">
          <i class="pi pi-search text-4xl text-surface-400 mb-4"></i>
          <p class="text-lg text-surface-600 dark:text-surface-400">No symbiants found</p>
          <p class="text-sm text-surface-500 dark:text-surface-500">
            Try adjusting your filters or search terms
          </p>
        </div>
      </template>

      <template #grid="slotProps">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          <Card
            v-for="symbiant in slotProps.items"
            :key="symbiant.id"
            class="symbiant-card cursor-pointer hover:shadow-lg transition-all duration-200"
            @click="showDetails(symbiant)"
          >
            <template #content>
              <div class="space-y-3">
                <!-- Header -->
                <div class="flex items-start justify-between">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <i :class="`pi ${getSlotIcon(symbiant.slot)} text-primary-500`"></i>
                      <span
                        class="text-xs font-medium text-surface-600 dark:text-surface-400 uppercase"
                      >
                        {{ symbiant.slot }}
                      </span>
                    </div>
                    <h3
                      class="text-lg font-semibold text-surface-900 dark:text-surface-50 line-clamp-2"
                    >
                      {{ symbiant.name }}
                    </h3>
                  </div>
                  <Tag :value="`QL ${symbiant.ql}`" :severity="getQualitySeverity(symbiant.ql)" />
                </div>

                <!-- Family -->
                <div v-if="symbiant.family" class="text-sm">
                  <span class="font-medium text-surface-700 dark:text-surface-300">Family:</span>
                  <span class="text-surface-600 dark:text-surface-400 ml-1">{{
                    symbiant.family
                  }}</span>
                </div>

                <!-- Drop Sources -->
                <div class="flex items-center justify-between text-sm">
                  <span class="text-surface-600 dark:text-surface-400">
                    {{ getDropSources(symbiant).length }} drop source{{
                      getDropSources(symbiant).length !== 1 ? 's' : ''
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
            v-for="symbiant in slotProps.items"
            :key="symbiant.id"
            class="symbiant-list-item cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
            @click="showDetails(symbiant)"
          >
            <template #content>
              <div class="flex items-center justify-between py-2">
                <div class="flex items-center gap-4 flex-1 min-w-0">
                  <i :class="`pi ${getSlotIcon(symbiant.slot)} text-xl text-primary-500`"></i>

                  <div class="min-w-0 flex-1">
                    <h3
                      class="text-lg font-semibold text-surface-900 dark:text-surface-50 truncate"
                    >
                      {{ symbiant.name }}
                    </h3>
                    <div
                      class="flex items-center gap-3 text-sm text-surface-600 dark:text-surface-400"
                    >
                      <span>{{ symbiant.slot }}</span>
                      <span v-if="symbiant.family">• {{ symbiant.family }}</span>
                    </div>
                  </div>

                  <div class="flex items-center gap-4">
                    <Tag :value="`QL ${symbiant.ql}`" :severity="getQualitySeverity(symbiant.ql)" />
                    <span class="text-sm text-surface-600 dark:text-surface-400">
                      {{ getDropSources(symbiant).length }} sources
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

    <!-- Symbiant Details Dialog -->
    <Dialog
      v-model:visible="showSymbiantDetails"
      :modal="true"
      :closable="true"
      :draggable="false"
      class="w-full max-w-4xl mx-4"
    >
      <template #header>
        <div v-if="selectedSymbiant" class="flex items-center gap-3">
          <i :class="`pi ${getSlotIcon(selectedSymbiant.slot)} text-xl text-primary-500`"></i>
          <div>
            <h2 class="text-xl font-semibold">{{ selectedSymbiant.name }}</h2>
            <p class="text-sm text-surface-600 dark:text-surface-400">
              {{ selectedSymbiant.slot }} • QL {{ selectedSymbiant.ql }}
            </p>
          </div>
        </div>
      </template>

      <div v-if="selectedSymbiant" class="space-y-6">
        <!-- Symbiant Info -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 class="text-lg font-semibold mb-3">Symbiant Information</h3>
            <div class="space-y-2">
              <div class="flex justify-between">
                <span class="font-medium">Quality Level:</span>
                <Tag
                  :value="`${selectedSymbiant.ql}`"
                  :severity="getQualitySeverity(selectedSymbiant.ql)"
                />
              </div>
              <div class="flex justify-between">
                <span class="font-medium">Body Slot:</span>
                <div class="flex items-center gap-2">
                  <i :class="`pi ${getSlotIcon(selectedSymbiant.slot)}`"></i>
                  <span>{{ selectedSymbiant.slot }}</span>
                </div>
              </div>
              <div v-if="selectedSymbiant.family" class="flex justify-between">
                <span class="font-medium">Family:</span>
                <span>{{ selectedSymbiant.family }}</span>
              </div>
            </div>
          </div>

          <!-- Stat Bonuses (if available) -->
          <div v-if="selectedSymbiant.stat_bonuses?.length">
            <h3 class="text-lg font-semibold mb-3">Stat Bonuses</h3>
            <div class="space-y-2">
              <div
                v-for="bonus in selectedSymbiant.stat_bonuses"
                :key="bonus.stat"
                class="flex justify-between items-center"
              >
                <span class="font-medium">{{ bonus.stat }}:</span>
                <span class="text-green-600 dark:text-green-400 font-mono">
                  +{{ bonus.bonus }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Drop Sources -->
        <div>
          <h3 class="text-lg font-semibold mb-3">
            Drop Sources ({{ getDropSources(selectedSymbiant).length }})
          </h3>
          <div
            v-if="getDropSources(selectedSymbiant).length > 0"
            class="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <div
              v-for="boss in getDropSources(selectedSymbiant)"
              :key="boss.id"
              class="p-3 border border-surface-200 dark:border-surface-700 rounded-lg"
            >
              <div class="flex items-start justify-between">
                <div class="min-w-0 flex-1">
                  <h4 class="font-medium text-surface-900 dark:text-surface-50 truncate">
                    {{ boss.name }}
                  </h4>
                  <p class="text-sm text-surface-600 dark:text-surface-400">
                    {{ boss.playfield || 'Unknown Playfield' }}
                    <span v-if="boss.location"> • {{ boss.location }}</span>
                  </p>
                </div>
                <Tag :value="`Level ${boss.level}`" severity="info" />
              </div>
            </div>
          </div>
          <div v-else class="text-center py-6">
            <i class="pi pi-info-circle text-2xl text-surface-400 mb-2"></i>
            <p class="text-surface-600 dark:text-surface-400">No known drop sources</p>
          </div>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.symbiant-card:hover {
  transform: translateY(-2px);
}

.symbiant-list-item :deep(.p-card-body) {
  padding: 0.75rem;
}

.symbiant-card :deep(.p-card-body) {
  padding: 1rem;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

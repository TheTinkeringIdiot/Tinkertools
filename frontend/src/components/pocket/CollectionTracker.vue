<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSymbiantsStore } from '@/stores/symbiants';
import { usePocketBossStore } from '@/stores/pocketBossStore';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import ProgressBar from 'primevue/progressbar';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import type { Symbiant, PocketBoss } from '@/types/api';

interface CollectionItem {
  symbiant: Symbiant;
  collected: boolean;
  notes?: string;
}

interface CollectionGoal {
  id: string;
  name: string;
  description: string;
  targetSymbiants: number[];
  createdAt: Date;
}

const symbiantStore = useSymbiantsStore();
const pocketBossStore = usePocketBossStore();

// Safely handle confirmation service (may not be available in tests)
let confirm: any = null;
try {
  confirm = useConfirm();
} catch {
  // Fallback for test environments or when ConfirmationService is not provided
  confirm = {
    require: () => Promise.resolve(true)
  };
}

// Local state
const collectionData = ref<Record<number, CollectionItem>>({});
const collectionGoals = ref<CollectionGoal[]>([]);
const selectedSlot = ref<string | null>(null);
const searchQuery = ref('');
const showOnlyUncollected = ref(false);
const newGoalName = ref('');
const newGoalDescription = ref('');
const showNewGoalForm = ref(false);

// Computed properties
const availableSlots = computed(() => {
  const slots = new Set(Array.from(symbiantStore.symbiants.values()).map(s => s.slot));
  return Array.from(slots).sort();
});

const filteredSymbiants = computed(() => {
  let result = Array.from(symbiantStore.symbiants.values());

  // Apply slot filter
  if (selectedSlot.value) {
    result = result.filter(s => s.slot === selectedSlot.value);
  }

  // Apply search filter
  if (searchQuery.value.trim()) {
    const search = searchQuery.value.toLowerCase();
    result = result.filter(s =>
      s.name.toLowerCase().includes(search) ||
      s.slot.toLowerCase().includes(search) ||
      s.family?.toLowerCase().includes(search)
    );
  }

  // Apply collection filter
  if (showOnlyUncollected.value) {
    result = result.filter(s => !getCollectionItem(s.id).collected);
  }

  return result.sort((a, b) => {
    // Sort by slot first, then by QL, then by name
    if (a.slot !== b.slot) return a.slot.localeCompare(b.slot);
    if (a.ql !== b.ql) return b.ql - a.ql;
    return a.name.localeCompare(b.name);
  });
});

const collectionStats = computed(() => {
  const total = symbiantStore.symbiants.size;
  const collected = Object.values(collectionData.value).filter(item => item.collected).length;
  const percentage = total > 0 ? Math.round((collected / total) * 100) : 0;

  const bySlot: Record<string, { total: number; collected: number; percentage: number }> = {};
  
  for (const symbiant of symbiantStore.symbiants.values()) {
    if (!bySlot[symbiant.slot]) {
      bySlot[symbiant.slot] = { total: 0, collected: 0, percentage: 0 };
    }
    bySlot[symbiant.slot].total++;
    const collectionItem = getCollectionItem(symbiant.id);
    if (collectionItem?.collected) {
      bySlot[symbiant.slot].collected++;
    }
  }

  // Calculate percentages
  Object.keys(bySlot).forEach(slot => {
    const stats = bySlot[slot];
    stats.percentage = stats.total > 0 ? Math.round((stats.collected / stats.total) * 100) : 0;
  });

  return {
    total,
    collected,
    percentage,
    remaining: total - collected,
    bySlot: Object.entries(bySlot)
      .map(([slot, stats]) => ({ slot, ...stats }))
      .sort((a, b) => a.slot.localeCompare(b.slot))
  };
});

// Methods
function getCollectionItem(symbiantId: number): CollectionItem | undefined {
  if (!collectionData.value[symbiantId]) {
    const symbiant = symbiantStore.symbiants.get(symbiantId) || 
                     Array.from(symbiantStore.symbiants.values()).find(s => s.id === symbiantId);
    if (symbiant) {
      collectionData.value[symbiantId] = {
        symbiant,
        collected: false
      };
    }
  }
  return collectionData.value[symbiantId];
}

function toggleCollection(symbiantId: number) {
  const item = getCollectionItem(symbiantId);
  if (item) {
    item.collected = !item.collected;
    saveCollectionData();
  }
}

function getDropSources(symbiant: Symbiant): PocketBoss[] {
  return pocketBossStore.getPocketBossesBySymbiant(symbiant.id);
}

function getSlotIcon(slot: string): string {
  const iconMap: Record<string, string> = {
    'Head': 'pi-user',
    'Eye': 'pi-eye',
    'Ear': 'pi-volume-up',
    'Chest': 'pi-shield',
    'Arm': 'pi-stop',
    'Wrist': 'pi-circle',
    'Hand': 'pi-hand-paper',
    'Waist': 'pi-minus',
    'Leg': 'pi-sort-down',
    'Feet': 'pi-step-forward'
  };
  return iconMap[slot] || 'pi-circle';
}

function getQualitySeverity(ql: number): 'success' | 'info' | 'warning' | 'danger' {
  if (ql >= 200) return 'danger';
  if (ql >= 150) return 'warning';
  if (ql >= 100) return 'info';
  return 'success';
}

function clearFilters() {
  selectedSlot.value = null;
  searchQuery.value = '';
  showOnlyUncollected.value = false;
}

function createCollectionGoal() {
  if (!newGoalName.value.trim()) return;

  const goal: CollectionGoal = {
    id: Date.now().toString(),
    name: newGoalName.value,
    description: newGoalDescription.value,
    targetSymbiants: filteredSymbiants.value.map(s => s.id),
    createdAt: new Date()
  };

  collectionGoals.value.push(goal);
  saveCollectionGoals();

  newGoalName.value = '';
  newGoalDescription.value = '';
  showNewGoalForm.value = false;
}

function deleteCollectionGoal(goalId: string) {
  confirm.require({
    message: 'Are you sure you want to delete this collection goal?',
    header: 'Delete Goal',
    icon: 'pi pi-trash',
    acceptClass: 'p-button-danger',
    accept: () => {
      collectionGoals.value = collectionGoals.value.filter(g => g.id !== goalId);
      saveCollectionGoals();
    }
  });
}

function getGoalProgress(goal: CollectionGoal) {
  const total = goal.targetSymbiants.length;
  const collected = goal.targetSymbiants.filter(id => 
    getCollectionItem(id).collected
  ).length;
  return {
    total,
    collected,
    percentage: total > 0 ? Math.round((collected / total) * 100) : 0
  };
}

function exportCollectionData() {
  const data = {
    collection: collectionData.value,
    goals: collectionGoals.value,
    exportDate: new Date().toISOString(),
    stats: collectionStats.value
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `symbiant-collection-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importCollectionData(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (data.collection) {
        collectionData.value = data.collection;
        saveCollectionData();
      }
      if (data.goals) {
        collectionGoals.value = data.goals;
        saveCollectionGoals();
      }
    } catch (error) {
      console.error('Failed to import collection data:', error);
    }
  };
  reader.readAsText(file);
  
  // Reset file input
  (event.target as HTMLInputElement).value = '';
}

function resetCollection() {
  confirm.require({
    message: 'Are you sure you want to reset your entire collection? This action cannot be undone.',
    header: 'Reset Collection',
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    accept: () => {
      collectionData.value = {};
      collectionGoals.value = [];
      saveCollectionData();
      saveCollectionGoals();
    }
  });
}

// Storage functions
function saveCollectionData() {
  localStorage.setItem('tinkertools-symbiant-collection', JSON.stringify(collectionData.value));
}

function loadCollectionData() {
  const saved = localStorage.getItem('tinkertools-symbiant-collection');
  if (saved) {
    try {
      collectionData.value = JSON.parse(saved);
    } catch (error) {
      console.error('Failed to load collection data:', error);
    }
  }
}

function saveCollectionGoals() {
  localStorage.setItem('tinkertools-collection-goals', JSON.stringify(collectionGoals.value));
}

function loadCollectionGoals() {
  const saved = localStorage.getItem('tinkertools-collection-goals');
  if (saved) {
    try {
      collectionGoals.value = JSON.parse(saved);
    } catch (error) {
      console.error('Failed to load collection goals:', error);
    }
  }
}

// Initialize
onMounted(() => {
  loadCollectionData();
  loadCollectionGoals();
});
</script>

<template>
  <div class="collection-tracker">
    <!-- Collection Statistics -->
    <Card class="mb-6">
      <template #content>
        <div class="space-y-6">
          <!-- Overall Progress -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <h2 class="text-xl font-semibold">Collection Progress</h2>
              <span class="text-2xl font-bold text-primary-500">
                {{ collectionStats.percentage }}%
              </span>
            </div>
            <ProgressBar :value="collectionStats.percentage" class="mb-2"></ProgressBar>
            <div class="flex items-center justify-between text-sm text-surface-600 dark:text-surface-400">
              <span>{{ collectionStats.collected }} of {{ collectionStats.total }} collected</span>
              <span>{{ collectionStats.remaining }} remaining</span>
            </div>
          </div>

          <!-- Progress by Slot -->
          <div>
            <h3 class="font-semibold mb-3">Progress by Body Slot</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div
                v-for="slotStats in collectionStats.bySlot"
                :key="slotStats.slot"
                class="p-3 border border-surface-200 dark:border-surface-700 rounded-lg"
              >
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <i :class="`pi ${getSlotIcon(slotStats.slot)} text-primary-500`"></i>
                    <span class="font-medium">{{ slotStats.slot }}</span>
                  </div>
                  <span class="text-sm font-semibold">{{ slotStats.percentage }}%</span>
                </div>
                <ProgressBar :value="slotStats.percentage" class="mb-1"></ProgressBar>
                <div class="text-xs text-surface-600 dark:text-surface-400">
                  {{ slotStats.collected }} / {{ slotStats.total }}
                </div>
              </div>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-wrap items-center gap-3 pt-4 border-t border-surface-200 dark:border-surface-700">
            <Button
              @click="exportCollectionData"
              icon="pi pi-download"
              label="Export Collection"
              outlined
              size="small"
            />
            <label class="cursor-pointer">
              <Button
                icon="pi pi-upload"
                label="Import Collection"
                outlined
                size="small"
                as="span"
              />
              <input
                type="file"
                accept=".json"
                @change="importCollectionData"
                class="hidden"
              />
            </label>
            <Button
              @click="resetCollection"
              icon="pi pi-trash"
              label="Reset Collection"
              severity="danger"
              outlined
              size="small"
            />
          </div>
        </div>
      </template>
    </Card>

    <!-- Collection Goals -->
    <Card class="mb-6">
      <template #content>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-xl font-semibold">Collection Goals</h2>
            <Button
              @click="showNewGoalForm = !showNewGoalForm"
              icon="pi pi-plus"
              label="New Goal"
              size="small"
            />
          </div>

          <!-- New Goal Form -->
          <Card v-if="showNewGoalForm" class="border border-surface-200 dark:border-surface-700">
            <template #content>
              <div class="space-y-4">
                <h3 class="font-semibold">Create Collection Goal</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block font-medium mb-1">Goal Name</label>
                    <InputText
                      v-model="newGoalName"
                      placeholder="Enter goal name..."
                      class="w-full"
                    />
                  </div>
                  <div>
                    <label class="block font-medium mb-1">Description (Optional)</label>
                    <InputText
                      v-model="newGoalDescription"
                      placeholder="Enter description..."
                      class="w-full"
                    />
                  </div>
                </div>
                <div class="text-sm text-surface-600 dark:text-surface-400">
                  This goal will include {{ filteredSymbiants.length }} symbiants based on current filters.
                </div>
                <div class="flex items-center gap-2">
                  <Button
                    @click="createCollectionGoal"
                    :disabled="!newGoalName.trim()"
                    icon="pi pi-check"
                    label="Create Goal"
                    size="small"
                  />
                  <Button
                    @click="showNewGoalForm = false"
                    icon="pi pi-times"
                    label="Cancel"
                    outlined
                    size="small"
                  />
                </div>
              </div>
            </template>
          </Card>

          <!-- Existing Goals -->
          <div v-if="collectionGoals.length > 0" class="space-y-3">
            <div
              v-for="goal in collectionGoals"
              :key="goal.id"
              class="p-4 border border-surface-200 dark:border-surface-700 rounded-lg"
            >
              <div class="flex items-start justify-between mb-3">
                <div>
                  <h3 class="font-semibold">{{ goal.name }}</h3>
                  <p v-if="goal.description" class="text-sm text-surface-600 dark:text-surface-400">
                    {{ goal.description }}
                  </p>
                </div>
                <Button
                  @click="deleteCollectionGoal(goal.id)"
                  icon="pi pi-trash"
                  severity="danger"
                  outlined
                  size="small"
                />
              </div>
              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span>Progress: {{ getGoalProgress(goal).collected }} / {{ getGoalProgress(goal).total }}</span>
                  <span class="font-semibold">{{ getGoalProgress(goal).percentage }}%</span>
                </div>
                <ProgressBar :value="getGoalProgress(goal).percentage"></ProgressBar>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-6 text-surface-500 dark:text-surface-400">
            No collection goals created yet
          </div>
        </div>
      </template>
    </Card>

    <!-- Filters -->
    <Card class="mb-6">
      <template #content>
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div>
            <label class="block font-medium mb-1">Search Symbiants</label>
            <InputText
              v-model="searchQuery"
              placeholder="Search by name, slot, or family..."
              class="w-full"
            />
          </div>
          <div>
            <label class="block font-medium mb-1">Body Slot</label>
            <Dropdown
              v-model="selectedSlot"
              :options="availableSlots"
              placeholder="All Slots"
              showClear
              class="w-full"
            />
          </div>
          <div class="flex items-end">
            <div class="flex items-center">
              <Checkbox
                v-model="showOnlyUncollected"
                inputId="uncollected"
                binary
              />
              <label for="uncollected" class="ml-2">Show only uncollected</label>
            </div>
          </div>
          <div class="flex items-end">
            <Button
              @click="clearFilters"
              icon="pi pi-filter-slash"
              label="Clear Filters"
              outlined
              size="small"
            />
          </div>
        </div>
      </template>
    </Card>

    <!-- Collection Table -->
    <Card>
      <template #content>
        <DataTable
          :value="filteredSymbiants"
          paginator
          :rows="25"
          :rowsPerPageOptions="[10, 25, 50, 100]"
          sortField="slot"
          :sortOrder="1"
          showGridlines
          stripedRows
          class="collection-table"
        >
          <template #empty>
            <div class="text-center py-8">
              <i class="pi pi-search text-3xl text-surface-400 mb-3"></i>
              <p class="text-surface-600 dark:text-surface-400">No symbiants found</p>
            </div>
          </template>

          <Column header="Collected" class="min-w-[80px]">
            <template #body="{ data }">
              <Checkbox
                :modelValue="getCollectionItem(data.id).collected"
                @update:modelValue="toggleCollection(data.id)"
                binary
              />
            </template>
          </Column>

          <Column field="name" header="Symbiant" sortable class="min-w-[250px]">
            <template #body="{ data }">
              <div class="flex items-center gap-2">
                <i :class="`pi ${getSlotIcon(data.slot)} text-primary-500`"></i>
                <div>
                  <div class="font-medium">{{ data.name }}</div>
                  <div class="text-sm text-surface-600 dark:text-surface-400">
                    <span v-if="data.family">{{ data.family }}</span>
                  </div>
                </div>
              </div>
            </template>
          </Column>

          <Column field="slot" header="Slot" sortable class="min-w-[100px]">
            <template #body="{ data }">
              {{ data.slot }}
            </template>
          </Column>

          <Column field="ql" header="Quality" sortable class="min-w-[80px]">
            <template #body="{ data }">
              <Tag
                :value="`QL ${data.ql}`"
                :severity="getQualitySeverity(data.ql)"
              />
            </template>
          </Column>

          <Column header="Drop Sources" class="min-w-[200px]">
            <template #body="{ data }">
              <div v-if="getDropSources(data).length > 0" class="space-y-1">
                <div
                  v-for="boss in getDropSources(data).slice(0, 2)"
                  :key="boss.id"
                  class="text-sm"
                >
                  <span class="font-medium">{{ boss.name }}</span>
                  <span class="text-surface-600 dark:text-surface-400 ml-1">
                    (Level {{ boss.level }})
                  </span>
                </div>
                <div
                  v-if="getDropSources(data).length > 2"
                  class="text-xs text-surface-500 dark:text-surface-400"
                >
                  +{{ getDropSources(data).length - 2 }} more...
                </div>
              </div>
              <span v-else class="text-sm text-surface-500 dark:text-surface-400">
                No known sources
              </span>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <!-- Confirm Dialog -->
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.collection-table :deep(.p-datatable-table) {
  font-size: 0.875rem;
}

.collection-table :deep(.p-datatable-thead > tr > th) {
  background: var(--surface-100);
  color: var(--surface-700);
  font-weight: 600;
}

.collection-table :deep(.p-datatable-tbody > tr:nth-child(even)) {
  background: var(--surface-50);
}

:global(.dark) .collection-table :deep(.p-datatable-thead > tr > th) {
  background: var(--surface-800);
  color: var(--surface-300);
}

:global(.dark) .collection-table :deep(.p-datatable-tbody > tr:nth-child(even)) {
  background: var(--surface-900);
}
</style>
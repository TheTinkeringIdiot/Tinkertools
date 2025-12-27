<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSymbiantsStore } from '@/stores/symbiants';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Checkbox from 'primevue/checkbox';
import ProgressBar from 'primevue/progressbar';
import Dialog from 'primevue/dialog';
import ConfirmDialog from 'primevue/confirmdialog';
import InputText from 'primevue/inputtext';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

const symbiantsStore = useSymbiantsStore();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();

// Local state
const shareUrl = ref('');
const showShareDialog = ref(false);

// Computed properties
const farmListSymbiants = computed(() => {
  return symbiantsStore.farmListAoids
    .map((aoid) => symbiantsStore.allSymbiants.find((s) => s.aoid === aoid))
    .filter(Boolean);
});

const sortedBosses = computed(() => {
  const bosses = Array.from(symbiantsStore.aggregatedBosses.values());
  return bosses.sort((a, b) => {
    // Sort by farmed status (not farmed first), then by level
    if (a.farmed !== b.farmed) return a.farmed ? 1 : -1;
    return (a.boss.level || 0) - (b.boss.level || 0);
  });
});

const farmProgress = computed(() => {
  const total = symbiantsStore.aggregatedBosses.size;
  const farmed = Array.from(symbiantsStore.aggregatedBosses.values()).filter(
    (b) => b.farmed
  ).length;
  return {
    total,
    farmed,
    percentage: total > 0 ? Math.round((farmed / total) * 100) : 0,
  };
});

// Methods
function handleToggleBossFarmed(bossId: number) {
  symbiantsStore.toggleBossFarmed(bossId);
}

async function handleRemoveSymbiant(aoid: number) {
  symbiantsStore.removeFromFarmList(aoid);
  // Re-aggregate after removal
  await symbiantsStore.aggregateBossesForFarmList();
}

function handleClearFarmList() {
  confirm.require({
    message: 'Clear all symbiants from farm list and reset progress?',
    header: 'Clear Farm List',
    icon: 'pi pi-exclamation-triangle',
    rejectClass: 'p-button-secondary p-button-outlined',
    rejectLabel: 'Cancel',
    acceptLabel: 'Clear All',
    acceptClass: 'p-button-danger',
    accept: () => {
      symbiantsStore.clearFarmList();
      toast.add({
        severity: 'info',
        summary: 'Cleared',
        detail: 'Farm list has been cleared',
        life: 2000,
      });
    },
  });
}

function handleGenerateShareUrl() {
  shareUrl.value = symbiantsStore.exportFarmListToUrl();
  showShareDialog.value = true;
}

async function handleCopyShareUrl() {
  try {
    await navigator.clipboard.writeText(shareUrl.value);
    toast.add({
      severity: 'success',
      summary: 'Copied',
      detail: 'Farm list URL copied to clipboard',
      life: 2000,
    });
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to copy to clipboard',
      life: 3000,
    });
  }
}

function getLevelSeverity(level: number | null): 'success' | 'info' | 'warn' | 'danger' {
  if (!level) return 'info';
  if (level < 100) return 'success';
  if (level < 150) return 'info';
  if (level < 200) return 'warn';
  return 'danger';
}

// URL sync
function loadFromUrl() {
  const aoidsParam = route.query.aoids as string;
  if (aoidsParam) {
    symbiantsStore.importFarmListFromUrl(aoidsParam);
  }
}

// Lifecycle
onMounted(async () => {
  // Load from localStorage
  symbiantsStore.loadFarmList();
  symbiantsStore.loadFarmProgress();

  // Load from URL if present (URL takes priority)
  loadFromUrl();

  // Ensure symbiants are loaded
  if (symbiantsStore.symbiantsCount === 0) {
    await symbiantsStore.loadAllSymbiants();
  }

  // Aggregate bosses
  if (symbiantsStore.farmListAoids.length > 0) {
    await symbiantsStore.aggregateBossesForFarmList();
  }
});

// Watch for farm list changes to re-aggregate
watch(
  () => symbiantsStore.farmListAoids.length,
  async (newLength, oldLength) => {
    if (newLength !== oldLength) {
      await symbiantsStore.aggregateBossesForFarmList();
    }
  }
);
</script>

<template>
  <div class="farm-list">
    <!-- Empty State -->
    <Card v-if="farmListSymbiants.length === 0" class="text-center">
      <template #content>
        <div class="py-12">
          <i class="pi pi-list text-5xl text-surface-300 dark:text-surface-600 mb-4 block"></i>
          <h3 class="text-xl font-semibold mb-2 text-surface-900 dark:text-surface-50">
            No Symbiants in Farm List
          </h3>
          <p class="text-surface-600 dark:text-surface-400 mb-4">
            Add symbiants from the Symbiants tab to build your farming checklist
          </p>
          <Button
            label="Browse Symbiants"
            icon="pi pi-box"
            @click="$router.replace({ query: { tab: 'symbiants' } })"
          />
        </div>
      </template>
    </Card>

    <!-- Farm List Content -->
    <div v-else class="space-y-6">
      <!-- Progress Overview -->
      <Card>
        <template #content>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-50">
              Farm Progress
            </h2>
            <div class="flex gap-2">
              <Button
                label="Share"
                icon="pi pi-share-alt"
                size="small"
                outlined
                @click="handleGenerateShareUrl"
              />
              <Button
                label="Clear All"
                icon="pi pi-trash"
                size="small"
                severity="danger"
                outlined
                @click="handleClearFarmList"
              />
            </div>
          </div>

          <div class="mb-4">
            <div class="flex justify-between mb-2 text-sm">
              <span class="text-surface-600 dark:text-surface-400">
                {{ farmProgress.farmed }} / {{ farmProgress.total }} bosses farmed
              </span>
              <span class="font-semibold text-surface-900 dark:text-surface-50">
                {{ farmProgress.percentage }}%
              </span>
            </div>
            <ProgressBar :value="farmProgress.percentage" :showValue="false" class="h-2" />
          </div>

          <!-- Selected Symbiants Summary -->
          <div>
            <p class="text-sm text-surface-600 dark:text-surface-400 mb-2">
              Selected symbiants ({{ farmListSymbiants.length }}):
            </p>
            <div class="flex flex-wrap gap-2">
              <Tag
                v-for="symbiant in farmListSymbiants"
                :key="symbiant!.id"
                severity="info"
                class="cursor-pointer hover:opacity-80 transition-opacity"
                @click="handleRemoveSymbiant(symbiant!.aoid!)"
              >
                <span>{{ symbiant!.name }}</span>
                <i class="pi pi-times ml-2 text-xs"></i>
              </Tag>
            </div>
          </div>
        </template>
      </Card>

      <!-- Loading State -->
      <div
        v-if="symbiantsStore.farmListLoading"
        class="flex justify-center items-center py-12"
      >
        <i class="pi pi-spin pi-spinner text-4xl text-primary-500"></i>
      </div>

      <!-- Boss List -->
      <Card v-else-if="sortedBosses.length > 0">
        <template #content>
          <h3 class="font-semibold mb-4 text-surface-900 dark:text-surface-50">
            Pocket Bosses ({{ sortedBosses.length }})
          </h3>

          <div class="space-y-3">
            <div
              v-for="entry in sortedBosses"
              :key="entry.boss.id"
              :class="[
                'p-4 rounded-lg border transition-all',
                entry.farmed
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700',
              ]"
            >
              <div class="flex items-start gap-4">
                <!-- Farmed Checkbox -->
                <div class="pt-1">
                  <Checkbox
                    :modelValue="entry.farmed"
                    @update:modelValue="handleToggleBossFarmed(entry.boss.id)"
                    binary
                  />
                </div>

                <!-- Boss Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      :class="[
                        'font-semibold',
                        entry.farmed
                          ? 'line-through text-surface-500 dark:text-surface-400'
                          : 'text-surface-900 dark:text-surface-50',
                      ]"
                    >
                      {{ entry.boss.name }}
                    </span>
                    <Tag
                      :value="`Level ${entry.boss.level || '?'}`"
                      :severity="getLevelSeverity(entry.boss.level)"
                      size="small"
                    />
                  </div>

                  <div class="text-sm text-surface-600 dark:text-surface-400 mb-2">
                    <i class="pi pi-map-marker mr-1"></i>
                    {{ entry.boss.playfield }}
                    <span v-if="entry.boss.location"> - {{ entry.boss.location }}</span>
                  </div>

                  <!-- Mob Names -->
                  <div
                    v-if="entry.boss.mob_names?.length"
                    class="text-xs text-surface-500 dark:text-surface-500 mb-2"
                  >
                    <i class="pi pi-users mr-1"></i>
                    Mobs: {{ entry.boss.mob_names.join(', ') }}
                  </div>

                  <!-- Symbiants Dropped -->
                  <div class="flex flex-wrap gap-1">
                    <Tag
                      v-for="symbiant in entry.symbiants"
                      :key="symbiant.id"
                      :value="symbiant.name"
                      size="small"
                      severity="secondary"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- No Bosses Found -->
      <Card v-else>
        <template #content>
          <div class="text-center py-8">
            <i class="pi pi-info-circle text-4xl text-surface-400 mb-4 block"></i>
            <p class="text-surface-600 dark:text-surface-400">
              No pocket bosses found for the selected symbiants
            </p>
          </div>
        </template>
      </Card>
    </div>

    <!-- Share URL Dialog -->
    <Dialog
      v-model:visible="showShareDialog"
      header="Share Farm List"
      modal
      :style="{ width: '500px' }"
    >
      <div class="space-y-4">
        <p class="text-surface-600 dark:text-surface-400">
          Copy this URL to share your farm list with others:
        </p>
        <InputText v-model="shareUrl" readonly class="w-full" />
        <div class="flex justify-end gap-2">
          <Button
            label="Close"
            severity="secondary"
            outlined
            @click="showShareDialog = false"
          />
          <Button label="Copy to Clipboard" icon="pi pi-copy" @click="handleCopyShareUrl" />
        </div>
      </div>
    </Dialog>

    <!-- Confirm Dialog -->
    <ConfirmDialog />
  </div>
</template>

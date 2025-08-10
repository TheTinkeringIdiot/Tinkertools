<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { usePocketBossStore } from '@/stores/pocketBossStore';
import { useSymbiantsStore } from '@/stores/symbiants';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import PocketBossDatabase from '@/components/pocket/PocketBossDatabase.vue';
import SymbiantLookup from '@/components/pocket/SymbiantLookup.vue';
import BossSymbiantMatcher from '@/components/pocket/BossSymbiantMatcher.vue';
import CollectionTracker from '@/components/pocket/CollectionTracker.vue';

const pocketBossStore = usePocketBossStore();
const symbiantStore = useSymbiantsStore();

const activeTab = ref(0);
const loading = ref(true);
const error = ref<string | null>(null);

const tabItems = [
  { label: 'Pocket Bosses', icon: 'pi pi-users' },
  { label: 'Symbiant Lookup', icon: 'pi pi-search' },
  { label: 'Boss-Symbiant Match', icon: 'pi pi-link' },
  { label: 'Collection Tracker', icon: 'pi pi-list-check' }
];

const loadingMessage = computed(() => {
  if (!loading.value) return '';
  return 'Loading pocket boss and symbiant data...';
});

onMounted(async () => {
  try {
    loading.value = true;
    await Promise.all([
      pocketBossStore.fetchPocketBosses(),
      symbiantStore.searchSymbiants({ page: 1, limit: 1000 })
    ]);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load data';
    console.error('TinkerPocket data loading error:', err);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="tinker-pocket h-full flex flex-col">
    <!-- Header -->
    <div class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-6">
      <div class="container mx-auto">
        <div class="flex items-center gap-3 mb-2">
          <i class="pi pi-map text-2xl text-primary-500"></i>
          <h1 class="text-3xl font-bold text-surface-900 dark:text-surface-50">TinkerPocket</h1>
          <span class="text-xs bg-surface-100 dark:bg-surface-800 px-2 py-1 rounded text-surface-600 dark:text-surface-400">
            Pocket Boss & Symbiant Tool
          </span>
        </div>
        <p class="text-surface-600 dark:text-surface-400">
          Track pocket bosses, symbiant drops, and manage your collection progress
        </p>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 bg-surface-0 dark:bg-surface-950">
      <div class="container mx-auto px-4 py-6">
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-12">
          <i class="pi pi-spinner pi-spin text-4xl text-primary-500 mb-4"></i>
          <p class="text-lg text-surface-600 dark:text-surface-400">{{ loadingMessage }}</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-12">
          <i class="pi pi-exclamation-triangle text-4xl text-red-500 mb-4"></i>
          <p class="text-lg text-red-600 dark:text-red-400 mb-4">{{ error }}</p>
          <button 
            @click="$router.go(0)"
            class="px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition-colors"
          >
            Retry
          </button>
        </div>

        <!-- Main Content -->
        <div v-else class="tinker-pocket-content">
          <TabView v-model:activeIndex="activeTab" class="pocket-tabs">
            <!-- Pocket Bosses Tab -->
            <TabPanel>
              <template #header>
                <div class="flex items-center gap-2">
                  <i class="pi pi-users"></i>
                  <span>Pocket Bosses</span>
                </div>
              </template>
              <PocketBossDatabase />
            </TabPanel>

            <!-- Symbiant Lookup Tab -->
            <TabPanel>
              <template #header>
                <div class="flex items-center gap-2">
                  <i class="pi pi-search"></i>
                  <span>Symbiant Lookup</span>
                </div>
              </template>
              <SymbiantLookup />
            </TabPanel>

            <!-- Boss-Symbiant Match Tab -->
            <TabPanel>
              <template #header>
                <div class="flex items-center gap-2">
                  <i class="pi pi-link"></i>
                  <span>Boss-Symbiant Match</span>
                </div>
              </template>
              <BossSymbiantMatcher />
            </TabPanel>

            <!-- Collection Tracker Tab -->
            <TabPanel>
              <template #header>
                <div class="flex items-center gap-2">
                  <i class="pi pi-list-check"></i>
                  <span>Collection Tracker</span>
                </div>
              </template>
              <CollectionTracker />
            </TabPanel>
          </TabView>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tinker-pocket {
  min-height: 100vh;
}

/* Use global PrimeVue theme overrides instead of component-specific ones */
</style>
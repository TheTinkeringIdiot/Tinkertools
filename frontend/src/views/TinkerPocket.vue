<script setup lang="ts">
import { ref } from 'vue';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import FindGear from '@/apps/tinkerpocket/views/FindGear.vue';
import SymbiantCompare from '@/components/pocket/SymbiantCompare.vue';

const activeTab = ref(0);
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
        <TabView v-model:activeIndex="activeTab" class="pocket-tabs">
          <!-- Symbiants Tab -->
          <TabPanel>
            <template #header>
              <div class="flex items-center gap-2">
                <i class="pi pi-box"></i>
                <span>Symbiants</span>
              </div>
            </template>
            <FindGear view="symbiants" />
          </TabPanel>

          <!-- Bosses Tab -->
          <TabPanel>
            <template #header>
              <div class="flex items-center gap-2">
                <i class="pi pi-users"></i>
                <span>Bosses</span>
              </div>
            </template>
            <FindGear view="bosses" />
          </TabPanel>

          <!-- Compare Tab -->
          <TabPanel>
            <template #header>
              <div class="flex items-center gap-2">
                <i class="pi pi-clone"></i>
                <span>Compare</span>
              </div>
            </template>
            <SymbiantCompare />
          </TabPanel>
        </TabView>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tinker-pocket {
  min-height: 100vh;
}
</style>

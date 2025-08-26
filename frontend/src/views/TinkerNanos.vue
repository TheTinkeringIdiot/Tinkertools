<!--
TinkerNanos - Profession-Based Nano Program Browser
Browse nano programs organized by profession with strain-based grouping
-->
<template>
  <div class="tinker-nanos h-full flex flex-col">
    <!-- Simplified Header -->
    <div class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4">
      <div class="flex items-center gap-4">
        <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
          <i class="pi pi-flash mr-2"></i>
          TinkerNanos
        </h1>
        <Badge v-if="selectedProfessionName" :value="selectedProfessionName" severity="info" />
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 flex min-h-0">
      <!-- Left Panel - Profession List -->
      <div class="w-80 border-r border-surface-200 dark:border-surface-700">
        <ProfessionList
          :selected-profession="nanosStore.selectedProfession"
          @profession-selected="onProfessionSelected"
        />
      </div>

      <!-- Right Panel - Profession Nanos -->
      <div class="flex-1">
        <ProfessionNanoDisplay
          :selected-profession="nanosStore.selectedProfession"
          :loading="loading"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Badge from 'primevue/badge'
import ProfessionList from '@/components/nanos/ProfessionList.vue'
import ProfessionNanoDisplay from '@/components/nanos/ProfessionNanoDisplay.vue'
import { PROFESSION } from '@/services/game-data'
import { useNanosStore } from '@/stores/nanosStore'

// Store
const nanosStore = useNanosStore()

// Local state
const loading = ref(false)

// Computed
const selectedProfessionName = computed(() => {
  if (!nanosStore.selectedProfession) return null
  return PROFESSION[nanosStore.selectedProfession as keyof typeof PROFESSION] || 'Unknown'
})

// Methods
function onProfessionSelected(professionId: number) {
  console.log('Profession selected:', professionId)
  nanosStore.setSelectedProfession(professionId)
}
</script>

<style scoped>
.tinker-nanos {
  background: var(--surface-ground);
}
</style>
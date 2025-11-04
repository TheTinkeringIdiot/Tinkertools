<!--
TinkerPlants Simple - Minimal version to debug layout issues
-->
<template>
  <div class="tinker-plants h-full flex flex-col bg-surface-0 dark:bg-surface-950">
    <!-- Header -->
    <div
      class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4"
    >
      <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
        <i class="pi pi-cog mr-2"></i>
        TinkerPlants - Simple Layout Test
      </h1>
      <p class="text-sm text-surface-600 dark:text-surface-400 mt-1">
        Character Building & Symbiant Planning
      </p>
    </div>

    <!-- Test Layout -->
    <div class="flex-1 flex min-h-0">
      <!-- Left Sidebar -->
      <div
        class="w-80 bg-surface-100 dark:bg-surface-800 border-r border-surface-200 dark:border-surface-700 p-4"
      >
        <h3 class="font-medium text-surface-900 dark:text-surface-100 mb-4">
          <i class="pi pi-user mr-2"></i>
          Character Panel
        </h3>

        <!-- Profile Selection -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            Character Profile:
          </label>
          <Dropdown
            v-model="selectedProfile"
            :options="profileOptions"
            option-label="label"
            option-value="value"
            placeholder="Select Profile"
            class="w-full"
          />
        </div>

        <!-- Mode Toggle -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
            Mode:
          </label>
          <ToggleButton
            v-model="buildMode"
            on-label="Build Mode"
            off-label="Browse Mode"
            on-icon="pi pi-wrench"
            off-icon="pi pi-search"
            class="w-full"
          />
        </div>

        <!-- Stats Display -->
        <div class="space-y-2">
          <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300">Base Stats:</h4>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-surface-0 dark:bg-surface-900 p-2 rounded">
              <span class="text-surface-500 dark:text-surface-400">STR:</span>
              <span class="font-medium ml-1">{{ stats.strength || 0 }}</span>
            </div>
            <div class="bg-surface-0 dark:bg-surface-900 p-2 rounded">
              <span class="text-surface-500 dark:text-surface-400">AGI:</span>
              <span class="font-medium ml-1">{{ stats.agility || 0 }}</span>
            </div>
            <div class="bg-surface-0 dark:bg-surface-900 p-2 rounded">
              <span class="text-surface-500 dark:text-surface-400">INT:</span>
              <span class="font-medium ml-1">{{ stats.intelligence || 0 }}</span>
            </div>
            <div class="bg-surface-0 dark:bg-surface-900 p-2 rounded">
              <span class="text-surface-500 dark:text-surface-400">STA:</span>
              <span class="font-medium ml-1">{{ stats.stamina || 0 }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col bg-surface-0 dark:bg-surface-950">
        <!-- Content Header -->
        <div class="p-4 border-b border-surface-200 dark:border-surface-700">
          <h2 class="text-lg font-medium text-surface-900 dark:text-surface-100">
            {{ buildMode ? 'Character Builder' : 'Symbiant Browser' }}
          </h2>
        </div>

        <!-- Content Area -->
        <div class="flex-1 p-4 overflow-y-auto">
          <!-- Build Mode -->
          <div v-if="buildMode" class="space-y-4">
            <div class="bg-surface-50 dark:bg-surface-800 p-4 rounded-lg">
              <h3 class="font-medium text-surface-900 dark:text-surface-100 mb-2">
                <i class="pi pi-cog mr-2"></i>
                Character Build
              </h3>
              <p class="text-sm text-surface-600 dark:text-surface-400">
                Build your character by selecting symbiants and optimizing stats.
              </p>

              <!-- Simple Character Slots -->
              <div class="grid grid-cols-4 gap-2 mt-4">
                <div
                  v-for="slot in slots"
                  :key="slot"
                  class="aspect-square bg-surface-100 dark:bg-surface-700 border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-lg flex items-center justify-center"
                >
                  <span class="text-xs text-surface-500 dark:text-surface-400 capitalize">{{
                    slot
                  }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Browse Mode -->
          <div v-else class="space-y-4">
            <div class="bg-surface-50 dark:bg-surface-800 p-4 rounded-lg">
              <h3 class="font-medium text-surface-900 dark:text-surface-100 mb-2">
                <i class="pi pi-search mr-2"></i>
                Symbiant Browser
              </h3>
              <p class="text-sm text-surface-600 dark:text-surface-400 mb-4">
                Browse and search available symbiants.
              </p>

              <!-- Search Input -->
              <InputText
                v-model="searchQuery"
                placeholder="Search symbiants..."
                class="w-full mb-4"
              />

              <!-- Sample Symbiant List -->
              <div class="space-y-2">
                <div
                  v-for="n in 5"
                  :key="n"
                  class="bg-surface-0 dark:bg-surface-900 p-3 rounded border border-surface-200 dark:border-surface-700"
                >
                  <div class="font-medium text-surface-900 dark:text-surface-100">
                    Sample Symbiant {{ n }}
                  </div>
                  <div class="text-sm text-surface-600 dark:text-surface-400">
                    Family: Test | Slot: Head | QL: {{ 100 + n * 50 }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Dropdown from 'primevue/dropdown';
import ToggleButton from 'primevue/togglebutton';
import InputText from 'primevue/inputtext';

// Reactive data
const selectedProfile = ref(null);
const buildMode = ref(true);
const searchQuery = ref('');
const stats = ref({
  strength: 400,
  agility: 350,
  intelligence: 300,
  stamina: 400,
});

// Profile options
const profileOptions = ref([
  { label: 'No Profile Selected', value: null },
  { label: 'Test Character', value: 'test' },
]);

// Character slots for build mode
const slots = ['head', 'chest', 'arms', 'legs', 'feet', 'hands', 'waist', 'wrist'];
</script>

<style scoped>
.tinker-plants {
  min-height: 100vh;
}
</style>

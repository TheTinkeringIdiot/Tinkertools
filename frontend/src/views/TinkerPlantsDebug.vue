<!--
TinkerPlants Debug - Test version to identify CSS issues
-->
<template>
  <div class="tinker-plants" class="h-screen flex flex-col bg-surface-50 dark:bg-surface-900">
    <!-- Header -->
    <div class="bg-surface-0 dark:bg-surface-950 border-b border-surface-200 dark:border-surface-700 p-4">
      <h1 style="margin: 0; font-size: 1.5rem; font-weight: bold; text-surface-900 dark:text-surface-50;">
        <i class="pi pi-cog" style="margin-right: 8px;"></i>
        TinkerPlants Debug
      </h1>
      <p style="margin: 4px 0 0; text-surface-600 dark:text-surface-400; font-size: 0.9rem;">
        Debugging CSS layout issues
      </p>
    </div>

    <!-- Main Layout -->
    <div style="flex: 1; display: flex; min-height: 0;">
      <!-- Left Sidebar -->
      <div style="width: 320px; bg-surface-0 dark:bg-surface-950; border-r border-surface-200 dark:border-surface-700; padding: 16px;">
        <h3 style="margin: 0 0 16px; font-size: 1.1rem; font-weight: 600; text-surface-900 dark:text-surface-50;">
          <i class="pi pi-user" style="margin-right: 8px;"></i>
          Character Panel
        </h3>
        
        <!-- Profile Selection -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; text-surface-700 dark:text-surface-300;">
            Profile:
          </label>
          <Dropdown 
            v-model="selectedProfile"
            :options="profileOptions"
            option-label="label"
            option-value="value"
            placeholder="Select Profile"
            style="width: 100%;"
          />
        </div>

        <!-- Mode Toggle -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; font-weight: 500; text-surface-700 dark:text-surface-300;">
            Mode:
          </label>
          <ToggleButton 
            v-model="buildMode"
            on-label="Build Mode"
            off-label="Browse Mode"
            on-icon="pi pi-wrench"
            off-icon="pi pi-search"
            style="width: 100%;"
          />
        </div>

        <!-- Test Component Load -->
        <div style="margin-bottom: 16px;">
          <h4 style="margin: 0 0 8px; font-weight: 500; text-surface-700 dark:text-surface-300;">
            Component Status:
          </h4>
          <div style="font-size: 0.8rem; text-surface-600 dark:text-surface-400;">
            <div>✓ Header loaded</div>
            <div>✓ Dropdown loaded</div>
            <div>✓ ToggleButton loaded</div>
            <div>{{ testComponentLoad ? '✓' : '✗' }} Child components</div>
          </div>
        </div>

        <!-- Stats Display -->
        <div>
          <h4 style="margin: 0 0 8px; font-weight: 500; text-surface-700 dark:text-surface-300;">Stats:</h4>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div class="h-screen flex flex-col bg-surface-50 dark:bg-surface-900">
              <span style="text-surface-600 dark:text-surface-400;">STR:</span>
              <span style="font-weight: 600; margin-left: 4px;">{{ stats.strength }}</span>
            </div>
            <div class="h-screen flex flex-col bg-surface-50 dark:bg-surface-900">
              <span style="text-surface-600 dark:text-surface-400;">AGI:</span>
              <span style="font-weight: 600; margin-left: 4px;">{{ stats.agility }}</span>
            </div>
            <div class="h-screen flex flex-col bg-surface-50 dark:bg-surface-900">
              <span style="text-surface-600 dark:text-surface-400;">INT:</span>
              <span style="font-weight: 600; margin-left: 4px;">{{ stats.intelligence }}</span>
            </div>
            <div class="h-screen flex flex-col bg-surface-50 dark:bg-surface-900">
              <span style="text-surface-600 dark:text-surface-400;">STA:</span>
              <span style="font-weight: 600; margin-left: 4px;">{{ stats.stamina }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div style="flex: 1; display: flex; flex-direction: column; bg-surface-0 dark:bg-surface-950;">
        <!-- Content Header -->
        <div style="padding: 16px; border-b border-surface-200 dark:border-surface-700;">
          <h2 style="margin: 0; font-size: 1.2rem; font-weight: 600; text-surface-900 dark:text-surface-50;">
            {{ buildMode ? 'Character Builder' : 'Symbiant Browser' }}
          </h2>
        </div>

        <!-- Content Area -->
        <div style="flex: 1; padding: 16px; overflow-y: auto;">
          <!-- Test actual component loading -->
          <div style="margin-bottom: 16px;">
            <h3 style="margin: 0 0 12px; font-weight: 600; text-surface-900 dark:text-surface-50;">Component Test:</h3>
            
            <!-- Try to load CharacterStatsPanel -->
            <div v-if="buildMode">
              <div class="h-screen flex flex-col bg-surface-50 dark:bg-surface-900">
                <h4 style="margin: 0 0 8px;">CharacterStatsPanel Test:</h4>
                <CharacterStatsPanel
                  v-if="loadCharacterStats"
                  :profile="null"
                  :editable="true"
                  @stats-changed="handleStatsChange"
                  style="border border-surface-200 dark:border-surface-700;"
                />
                <div v-else style="text-surface-600 dark:text-surface-400; font-style: italic;">
                  CharacterStatsPanel failed to load
                </div>
              </div>

              <div class="h-screen flex flex-col bg-surface-50 dark:bg-surface-900">
                <h4 style="margin: 0 0 8px;">Build Summary Test:</h4>
                <BuildSummary
                  v-if="loadBuildSummary"
                  :current-build="currentBuild"
                  :stat-bonuses="buildStatBonuses"
                  :total-stats="totalCharacterStats"
                  style="border border-surface-200 dark:border-surface-700;"
                />
                <div v-else style="text-surface-600 dark:text-surface-400; font-style: italic;">
                  BuildSummary failed to load
                </div>
              </div>
            </div>

            <div v-else>
              <div class="h-screen flex flex-col bg-surface-50 dark:bg-surface-900">
                <h4 style="margin: 0 0 8px;">SymbiantSearch Test:</h4>
                <SymbiantSearch
                  v-if="loadSymbiantSearch"
                  v-model="searchQuery"
                  @search="handleSearch"
                  style="border border-surface-200 dark:border-surface-700;"
                />
                <div v-else style="text-surface-600 dark:text-surface-400; font-style: italic;">
                  SymbiantSearch failed to load
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
import { ref, computed, onMounted } from 'vue';
import Dropdown from 'primevue/dropdown';
import ToggleButton from 'primevue/togglebutton';

// Test component loading
let CharacterStatsPanel: any;
let BuildSummary: any;
let SymbiantSearch: any;

const loadCharacterStats = ref(false);
const loadBuildSummary = ref(false);
const loadSymbiantSearch = ref(false);
const testComponentLoad = ref(false);

onMounted(async () => {
  try {
    CharacterStatsPanel = (await import('@/components/plants/CharacterStatsPanel.vue')).default;
    loadCharacterStats.value = true;
  } catch (error) {
    console.error('Failed to load CharacterStatsPanel:', error);
  }

  try {
    BuildSummary = (await import('@/components/plants/BuildSummary.vue')).default;
    loadBuildSummary.value = true;
  } catch (error) {
    console.error('Failed to load BuildSummary:', error);
  }

  try {
    SymbiantSearch = (await import('@/components/plants/SymbiantSearch.vue')).default;
    loadSymbiantSearch.value = true;
  } catch (error) {
    console.error('Failed to load SymbiantSearch:', error);
  }

  testComponentLoad.value = loadCharacterStats.value && loadBuildSummary.value && loadSymbiantSearch.value;
});

// Reactive data
const selectedProfile = ref(null);
const buildMode = ref(true);
const searchQuery = ref('');
const stats = ref({
  strength: 400,
  agility: 350,
  intelligence: 300,
  stamina: 400
});

const profileOptions = ref([
  { label: 'No Profile Selected', value: null },
  { label: 'Test Character', value: 'test' }
]);

// Mock data for component testing
const currentBuild = ref({
  id: '',
  name: '',
  symbiants: {},
  totalStats: {}
});

const buildStatBonuses = computed(() => ({}));
const totalCharacterStats = computed(() => stats.value);

// Event handlers
const handleStatsChange = (newStats: any) => {
  stats.value = { ...stats.value, ...newStats };
};

const handleSearch = (query: string) => {
  searchQuery.value = query;
};
</script>

<style scoped>
.tinker-plants {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
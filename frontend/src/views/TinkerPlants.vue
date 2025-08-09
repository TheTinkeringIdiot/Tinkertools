<!--
TinkerPlants - Implant & Symbiant Planning Tool
Provides character building, stat calculations, and build optimization
-->
<template>
  <div class="tinker-plants h-full flex flex-col">
    <!-- Header with Profile Selection and Options -->
    <div class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="flex items-center gap-4">
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
            <i class="pi pi-cog mr-2"></i>
            TinkerPlants
          </h1>
          <Badge :value="symbiantsCount" severity="info" v-if="symbiantsCount > 0" />
        </div>
        
        <!-- Profile & Display Options -->
        <div class="flex flex-col sm:flex-row gap-3">
          <!-- Profile Selection -->
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
              Profile:
            </label>
            <Dropdown 
              v-model="selectedProfile"
              :options="profileOptions"
              option-label="label"
              option-value="value"
              placeholder="Select Profile"
              class="w-40"
              @change="onProfileChange"
            />
          </div>
          
          <!-- Build Mode Toggle -->
          <div class="flex items-center gap-2">
            <ToggleButton 
              v-model="buildMode"
              on-label="Build Mode"
              off-label="Browse Mode"
              on-icon="pi pi-wrench"
              off-icon="pi pi-search"
              class="w-36"
            />
          </div>
          
          <!-- View Mode Toggle -->
          <div class="flex items-center gap-2">
            <ToggleButton 
              v-model="viewMode"
              on-label="Family View"
              off-label="List View"
              on-icon="pi pi-th-large"
              off-icon="pi pi-list"
              class="w-32"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 flex min-h-0">
      <!-- Left Sidebar - Search & Filters or Character Builder -->
      <div class="w-80 bg-surface-0 dark:bg-surface-950 border-r border-surface-200 dark:border-surface-700 flex flex-col">
        <!-- Character Builder Mode -->
        <div v-if="buildMode" class="flex-1 flex flex-col">
          <!-- Character Stats Input -->
          <CharacterStatsPanel
            :profile="activeProfile"
            :editable="!activeProfile"
            @stats-changed="handleStatsChange"
            class="border-b border-surface-200 dark:border-surface-700"
          />
          
          <!-- Target Stats -->
          <StatTargets
            v-model="statTargets"
            :current-stats="characterStats"
            class="border-b border-surface-200 dark:border-surface-700"
          />
          
          <!-- Build Summary -->
          <BuildSummary
            :current-build="currentBuild"
            :stat-bonuses="buildStatBonuses"
            :total-stats="totalCharacterStats"
            class="flex-1 overflow-y-auto"
          />
          
          <!-- Build Actions -->
          <div class="p-3 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900">
            <div class="flex gap-2">
              <Button
                @click="saveBuild"
                label="Save Build"
                icon="pi pi-save"
                size="small"
                :disabled="!hasValidBuild"
                class="flex-1"
              />
              <Button
                @click="clearBuild"
                label="Clear"
                icon="pi pi-trash"
                size="small"
                severity="secondary"
                text
              />
            </div>
          </div>
        </div>
        
        <!-- Browse Mode -->
        <div v-else class="flex-1 flex flex-col">
          <!-- Search -->
          <SymbiantSearch
            v-model="searchQuery"
            @search="handleSearch"
            class="border-b border-surface-200 dark:border-surface-700"
          />
          
          <!-- Filters -->
          <SymbiantFilters
            v-model="filters"
            :available-families="symbiantFamilies"
            @filter-change="handleFilterChange"
            class="flex-1 overflow-y-auto"
          />
          
          <!-- Filter Summary -->
          <div class="p-3 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900">
            <div class="text-xs text-surface-600 dark:text-surface-400">
              Showing {{ filteredSymbiants.length }} of {{ symbiantsCount }} symbiants
            </div>
            <Button
              v-if="hasActiveFilters"
              @click="clearAllFilters"
              label="Clear Filters"
              size="small"
              severity="secondary"
              text
              class="mt-1 p-0"
            />
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Build Mode Content -->
        <div v-if="buildMode" class="flex-1 overflow-hidden">
          <CharacterBuilder
            :profile="activeProfile"
            :stat-targets="statTargets"
            :available-symbiants="filteredSymbiants"
            :current-build="currentBuild"
            @build-changed="handleBuildChange"
            @symbiant-selected="handleSymbiantSelect"
            class="h-full"
          />
        </div>
        
        <!-- Browse Mode Content -->
        <div v-else class="flex-1 overflow-hidden">
          <!-- Family-based Organization -->
          <SymbiantFamilyView
            v-if="viewMode"
            :symbiants="filteredSymbiants"
            :families="symbiantFamilies"
            :build-mode="false"
            @symbiant-select="handleSymbiantSelect"
            @add-to-build="handleAddToBuild"
            class="h-full"
          />
          
          <!-- List View -->
          <SymbiantList
            v-else
            :symbiants="filteredSymbiants"
            :loading="loading"
            :build-mode="false"
            @symbiant-select="handleSymbiantSelect"
            @add-to-build="handleAddToBuild"
            @page-change="handlePageChange"
            class="h-full"
          />
        </div>

        <!-- Loading State -->
        <div
          v-if="loading"
          class="flex items-center justify-center h-32"
        >
          <ProgressSpinner />
        </div>

        <!-- Empty State -->
        <div
          v-else-if="filteredSymbiants.length === 0 && !loading"
          class="flex flex-col items-center justify-center h-64 text-center"
        >
          <i class="pi pi-search text-4xl text-surface-400 dark:text-surface-600 mb-4"></i>
          <h3 class="text-lg font-medium text-surface-700 dark:text-surface-300 mb-2">
            No symbiants found
          </h3>
          <p class="text-surface-500 dark:text-surface-400">
            Try adjusting your search criteria or filters
          </p>
        </div>
      </div>
    </div>

    <!-- Symbiant Detail Dialog -->
    <SymbiantDetail
      v-model:visible="showSymbiantDetail"
      :symbiant="selectedSymbiant"
      :show-build-options="buildMode"
      :current-build="currentBuild"
      @add-to-build="handleAddToBuild"
      @close="handleSymbiantDetailClose"
    />

    <!-- Build Comparison Dialog -->
    <Dialog
      v-model:visible="showBuildComparison"
      header="Build Comparison"
      modal
      maximizable
      :style="{ width: '90vw', height: '80vh' }"
    >
      <BuildComparison
        :builds="savedBuilds"
        :current-build="currentBuild"
        @load-build="handleLoadBuild"
        @delete-build="handleDeleteBuild"
      />
    </Dialog>

    <!-- Saved Builds Dialog -->
    <Dialog
      v-model:visible="showSavedBuilds"
      header="Saved Builds"
      modal
      :style="{ width: '800px', maxHeight: '80vh' }"
    >
      <SavedBuilds
        :builds="savedBuilds"
        @load-build="handleLoadBuild"
        @delete-build="handleDeleteBuild"
        @duplicate-build="handleDuplicateBuild"
      />
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import ProgressSpinner from 'primevue/progressspinner';
import ToggleButton from 'primevue/togglebutton';

import CharacterStatsPanel from '@/components/plants/CharacterStatsPanel.vue';
import StatTargets from '@/components/plants/StatTargets.vue';
import BuildSummary from '@/components/plants/BuildSummary.vue';
import CharacterBuilder from '@/components/plants/CharacterBuilder.vue';
import SymbiantSearch from '@/components/plants/SymbiantSearch.vue';
import SymbiantFilters from '@/components/plants/SymbiantFilters.vue';
import SymbiantFamilyView from '@/components/plants/SymbiantFamilyView.vue';
import SymbiantList from '@/components/plants/SymbiantList.vue';
import SymbiantDetail from '@/components/plants/SymbiantDetail.vue';
import BuildComparison from '@/components/plants/BuildComparison.vue';
import SavedBuilds from '@/components/plants/SavedBuilds.vue';

import { useSymbiantsStore } from '@/stores/symbiants';
import { useProfilesStore } from '@/stores/profilesStore';
import type { 
  PlantSymbiant, 
  SymbiantFilters as SymbiantFiltersType,
  CharacterBuild,
  StatTarget,
  CharacterStats
} from '@/types/plants';

// Stores
const symbiantsStore = useSymbiantsStore();
const profilesStore = useProfilesStore();

const { 
  allSymbiants,
  symbiantFamilies,
  symbiantsCount,
  loading, 
  error
} = storeToRefs(symbiantsStore);

const { 
  profiles, 
  activeProfile 
} = storeToRefs(profilesStore);

// Reactive state
const selectedProfile = ref<string | null>(null);
const buildMode = ref(true); // Start in build mode
const viewMode = ref(true); // true = family view, false = list view
const searchQuery = ref('');
const filters = ref<SymbiantFiltersType>({
  families: [],
  slots: [],
  qualityLevels: [],
  statBonuses: []
});

// Build state
const statTargets = ref<StatTarget[]>([]);
const characterStats = ref<CharacterStats>({});
const currentBuild = ref<CharacterBuild>({
  id: '',
  name: '',
  symbiants: {},
  totalStats: {},
  notes: ''
});
const savedBuilds = ref<CharacterBuild[]>([]);

// Dialog state
const selectedSymbiant = ref<PlantSymbiant | null>(null);
const showSymbiantDetail = ref(false);
const showBuildComparison = ref(false);
const showSavedBuilds = ref(false);

// Computed
const profileOptions = computed(() => [
  { label: 'No Profile', value: null },
  ...profiles.value.map(profile => ({
    label: profile.name,
    value: profile.id
  }))
]);

const filteredSymbiants = computed(() => {
  let result = [...allSymbiants.value] as PlantSymbiant[];
  
  // Apply search
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(symbiant => 
      symbiant.name.toLowerCase().includes(query) ||
      symbiant.description?.toLowerCase().includes(query) ||
      symbiant.family?.toLowerCase().includes(query)
    );
  }
  
  // Apply filters
  if (filters.value.families.length > 0) {
    result = result.filter(symbiant => 
      symbiant.family && filters.value.families.includes(symbiant.family)
    );
  }
  
  if (filters.value.slots.length > 0) {
    result = result.filter(symbiant => 
      symbiant.slot && filters.value.slots.includes(symbiant.slot)
    );
  }
  
  if (filters.value.qualityLevels.length > 0) {
    result = result.filter(symbiant => 
      symbiant.qualityLevel && filters.value.qualityLevels.includes(symbiant.qualityLevel)
    );
  }
  
  return result;
});

const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' ||
         filters.value.families.length > 0 ||
         filters.value.slots.length > 0 ||
         filters.value.qualityLevels.length > 0 ||
         filters.value.statBonuses.length > 0;
});

const buildStatBonuses = computed(() => {
  // Calculate total stat bonuses from current build
  const bonuses: CharacterStats = {};
  
  Object.values(currentBuild.value.symbiants).forEach(symbiant => {
    if (symbiant && symbiant.statBonuses) {
      symbiant.statBonuses.forEach(bonus => {
        if (!bonuses[bonus.statId]) {
          bonuses[bonus.statId] = 0;
        }
        bonuses[bonus.statId] += bonus.value;
      });
    }
  });
  
  return bonuses;
});

const totalCharacterStats = computed(() => {
  const total: CharacterStats = { ...characterStats.value };
  
  // Add build bonuses
  Object.entries(buildStatBonuses.value).forEach(([statId, bonus]) => {
    if (!total[statId]) {
      total[statId] = 0;
    }
    total[statId] += bonus;
  });
  
  return total;
});

const hasValidBuild = computed(() => {
  return Object.keys(currentBuild.value.symbiants).length > 0;
});

// Methods
const handleSearch = (query: string) => {
  searchQuery.value = query;
};

const handleFilterChange = (newFilters: SymbiantFiltersType) => {
  filters.value = { ...newFilters };
};

const handleSymbiantSelect = (symbiant: PlantSymbiant) => {
  selectedSymbiant.value = symbiant;
  showSymbiantDetail.value = true;
};

const handleSymbiantDetailClose = () => {
  selectedSymbiant.value = null;
  showSymbiantDetail.value = false;
};

const handleAddToBuild = (symbiant: PlantSymbiant, slot?: string) => {
  if (!slot && symbiant.slot) {
    slot = symbiant.slot;
  }
  
  if (slot) {
    currentBuild.value.symbiants[slot] = symbiant;
  }
};

const handleBuildChange = (build: CharacterBuild) => {
  currentBuild.value = { ...build };
};

const handleStatsChange = (stats: CharacterStats) => {
  characterStats.value = { ...stats };
};

const handlePageChange = (page: number) => {
  console.log('Page change:', page);
};

const onProfileChange = () => {
  if (selectedProfile.value) {
    profilesStore.setActiveProfile(selectedProfile.value);
  } else {
    profilesStore.clearActiveProfile();
  }
};

const clearAllFilters = () => {
  searchQuery.value = '';
  filters.value = {
    families: [],
    slots: [],
    qualityLevels: [],
    statBonuses: []
  };
};

const saveBuild = () => {
  if (!hasValidBuild.value) return;
  
  const buildToSave: CharacterBuild = {
    ...currentBuild.value,
    id: `build_${Date.now()}`,
    name: `Build ${savedBuilds.value.length + 1}`,
    totalStats: { ...totalCharacterStats.value }
  };
  
  savedBuilds.value.push(buildToSave);
  
  // Save to localStorage
  localStorage.setItem('tinkerplants_builds', JSON.stringify(savedBuilds.value));
};

const clearBuild = () => {
  currentBuild.value = {
    id: '',
    name: '',
    symbiants: {},
    totalStats: {},
    notes: ''
  };
};

const handleLoadBuild = (build: CharacterBuild) => {
  currentBuild.value = { ...build };
  showSavedBuilds.value = false;
  showBuildComparison.value = false;
};

const handleDeleteBuild = (buildId: string) => {
  const index = savedBuilds.value.findIndex(build => build.id === buildId);
  if (index > -1) {
    savedBuilds.value.splice(index, 1);
    localStorage.setItem('tinkerplants_builds', JSON.stringify(savedBuilds.value));
  }
};

const handleDuplicateBuild = (build: CharacterBuild) => {
  const duplicatedBuild: CharacterBuild = {
    ...build,
    id: `build_${Date.now()}`,
    name: `${build.name} (Copy)`
  };
  
  savedBuilds.value.push(duplicatedBuild);
  localStorage.setItem('tinkerplants_builds', JSON.stringify(savedBuilds.value));
};

// Lifecycle
onMounted(async () => {
  // Load symbiants data
  await symbiantsStore.preloadSymbiants();
  
  // Load profiles
  await profilesStore.loadProfiles();
  
  // Set initial profile selection
  if (activeProfile.value) {
    selectedProfile.value = activeProfile.value.id;
    characterStats.value = { ...activeProfile.value.stats };
  }
  
  // Load saved builds
  const savedBuildsData = localStorage.getItem('tinkerplants_builds');
  if (savedBuildsData) {
    try {
      savedBuilds.value = JSON.parse(savedBuildsData);
    } catch (error) {
      console.warn('Failed to load saved builds:', error);
    }
  }
});

// Watch for profile changes
watch(activeProfile, (newProfile) => {
  if (newProfile) {
    selectedProfile.value = newProfile.id;
    characterStats.value = { ...newProfile.stats };
  } else {
    selectedProfile.value = null;
    characterStats.value = {};
  }
});
</script>

<style scoped>
.tinker-plants {
  background: var(--surface-ground);
}
</style>
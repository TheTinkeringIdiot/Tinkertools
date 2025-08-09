<!--
TinkerNanos - Nano Program Management Tool
Provides nano database browsing, skill compatibility checking, and nano lineup management
-->
<template>
  <div class="tinker-nanos h-full flex flex-col">
    <!-- Header with Profile Selection and Options -->
    <div class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="flex items-center gap-4">
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
            <i class="pi pi-flash mr-2"></i>
            TinkerNanos
          </h1>
          <Badge :value="totalNanos" severity="info" v-if="totalNanos > 0" />
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
          
          <!-- Skill Compatibility Toggle -->
          <div class="flex items-center gap-2">
            <InputSwitch 
              v-model="showSkillCompatibility"
              input-id="compatibility-toggle"
              :disabled="!hasActiveProfile"
            />
            <label 
              for="compatibility-toggle"
              class="text-sm text-surface-700 dark:text-surface-300"
              :class="{ 'opacity-50': !hasActiveProfile }"
            >
              Show Skill Requirements
            </label>
          </div>
          
          <!-- View Mode Toggle -->
          <div class="flex items-center gap-2">
            <ToggleButton 
              v-model="viewMode"
              on-label="School View"
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
      <!-- Left Sidebar - Search & Filters -->
      <div class="w-80 bg-surface-0 dark:bg-surface-950 border-r border-surface-200 dark:border-surface-700 flex flex-col">
        <!-- Search -->
        <NanoSearch
          v-model="searchQuery"
          @search="handleSearch"
          class="border-b border-surface-200 dark:border-surface-700"
        />
        
        <!-- Filters -->
        <NanoFilters
          v-model="filters"
          :show-compatibility="showSkillCompatibility"
          :active-profile="activeProfile"
          @filter-change="handleFilterChange"
          class="flex-1 overflow-y-auto"
        />
        
        <!-- Filter Summary -->
        <div class="p-3 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900">
          <div class="text-xs text-surface-600 dark:text-surface-400">
            Showing {{ filteredNanos.length }} of {{ totalNanos }} nanos
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

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Nano List/Schools Display -->
        <div class="flex-1 overflow-hidden">
          <!-- School-based Organization -->
          <NanoSchoolView
            v-if="viewMode"
            key="school-view"
            :nanos="filteredNanos"
            :show-compatibility="showSkillCompatibility"
            :active-profile="activeProfile"
            @nano-select="handleNanoSelect"
            @strain-conflict="handleStrainConflict"
            class="h-full"
          />
          
          <!-- List View -->
          <NanoList
            v-else
            :nanos="filteredNanos"
            :show-compatibility="showSkillCompatibility"
            :active-profile="activeProfile"
            :loading="loading"
            @nano-select="handleNanoSelect"
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
          v-else-if="filteredNanos.length === 0 && !loading"
          class="flex flex-col items-center justify-center h-64 text-center"
        >
          <i class="pi pi-search text-4xl text-surface-400 dark:text-surface-600 mb-4"></i>
          <h3 class="text-lg font-medium text-surface-700 dark:text-surface-300 mb-2">
            No nanos found
          </h3>
          <p class="text-surface-500 dark:text-surface-400">
            Try adjusting your search criteria or filters
          </p>
        </div>
      </div>
    </div>

    <!-- Nano Detail Dialog -->
    <NanoDetail
      v-model:visible="showNanoDetail"
      :nano="selectedNano"
      :active-profile="activeProfile"
      :show-compatibility="showSkillCompatibility"
      @close="handleNanoDetailClose"
    />

    <!-- Strain Conflict Dialog -->
    <Dialog
      v-model:visible="showStrainConflict"
      header="Nano Strain Conflict"
      modal
      :style="{ width: '500px' }"
    >
      <div v-if="strainConflictData" class="space-y-4">
        <div class="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
          <i class="pi pi-exclamation-triangle text-orange-600 dark:text-orange-400 text-xl mt-1"></i>
          <div>
            <h4 class="font-medium text-orange-800 dark:text-orange-200">
              Strain Conflict Detected
            </h4>
            <p class="text-sm text-orange-700 dark:text-orange-300 mt-1">
              This nano uses strain {{ strainConflictData.strain }} which conflicts with currently active nanos.
            </p>
          </div>
        </div>
        
        <div v-if="strainConflictData.conflictingNanos.length > 0">
          <h5 class="font-medium text-surface-900 dark:text-surface-100 mb-2">
            Conflicting Nanos:
          </h5>
          <div class="space-y-2">
            <div
              v-for="conflictNano in strainConflictData.conflictingNanos"
              :key="conflictNano.id"
              class="flex items-center gap-2 p-2 bg-surface-50 dark:bg-surface-800 rounded"
            >
              <Badge :value="conflictNano.strain" severity="warning" />
              <span class="flex-1">{{ conflictNano.name }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <template #footer>
        <Button
          label="Close"
          @click="showStrainConflict = false"
          autofocus
        />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputSwitch from 'primevue/inputswitch';
import ProgressSpinner from 'primevue/progressspinner';
import ToggleButton from 'primevue/togglebutton';

import NanoSearch from '@/components/nanos/NanoSearch.vue';
import NanoFilters from '@/components/nanos/NanoFilters.vue';
import NanoList from '@/components/nanos/NanoList.vue';
import NanoSchoolView from '@/components/nanos/NanoSchoolView.vue';
import NanoDetail from '@/components/nanos/NanoDetail.vue';

import { useNanosStore } from '@/stores/nanosStore';
import { useProfilesStore } from '@/stores/profilesStore';
import type { NanoProgram, NanoFilters as NanoFiltersType, StrainConflict } from '@/types/nano';

// Stores
const nanosStore = useNanosStore();
const profilesStore = useProfilesStore();

const { 
  nanos, 
  loading, 
  error,
  totalCount 
} = storeToRefs(nanosStore);

const { 
  profiles, 
  activeProfile 
} = storeToRefs(profilesStore);

// Router
const router = useRouter();
const route = useRoute();

// Reactive state
const selectedProfile = ref<string | null>(null);
const showSkillCompatibility = ref(false);
const viewMode = ref(true); // true = school view, false = list view
const searchQuery = ref('');
const filters = ref<NanoFiltersType>({
  schools: [],
  strains: [],
  professions: [],
  qualityLevels: [],
  skillCompatible: false,
  castable: false
});

const selectedNano = ref<NanoProgram | null>(null);
const showNanoDetail = ref(false);
const showStrainConflict = ref(false);
const strainConflictData = ref<StrainConflict | null>(null);

// Computed
const totalNanos = computed(() => totalCount.value);

const profileOptions = computed(() => [
  { label: 'No Profile', value: null },
  ...profiles.value.map(profile => ({
    label: profile.name,
    value: profile.id
  }))
]);

const hasActiveProfile = computed(() => !!activeProfile.value);

const filteredNanos = computed(() => {
  let result = [...nanos.value];
  
  // Apply search
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    result = result.filter(nano => 
      nano.name.toLowerCase().includes(query) ||
      nano.description?.toLowerCase().includes(query) ||
      nano.school.toLowerCase().includes(query)
    );
  }
  
  // Apply filters
  if (filters.value.schools.length > 0) {
    result = result.filter(nano => filters.value.schools.includes(nano.school));
  }
  
  if (filters.value.strains.length > 0) {
    result = result.filter(nano => filters.value.strains.includes(nano.strain));
  }
  
  if (filters.value.professions.length > 0) {
    result = result.filter(nano => 
      !nano.profession || filters.value.professions.includes(nano.profession)
    );
  }
  
  if (filters.value.qualityLevels.length > 0) {
    result = result.filter(nano => filters.value.qualityLevels.includes(nano.qualityLevel));
  }
  
  // Apply compatibility filters if profile is active
  if (activeProfile.value && showSkillCompatibility.value) {
    if (filters.value.skillCompatible) {
      result = result.filter(nano => checkSkillCompatibility(nano));
    }
    
    if (filters.value.castable) {
      result = result.filter(nano => checkCastability(nano));
    }
  }
  
  return result;
});

const hasActiveFilters = computed(() => {
  return searchQuery.value.trim() !== '' ||
         filters.value.schools.length > 0 ||
         filters.value.strains.length > 0 ||
         filters.value.professions.length > 0 ||
         filters.value.qualityLevels.length > 0 ||
         filters.value.skillCompatible ||
         filters.value.castable;
});

// Methods
const checkSkillCompatibility = (nano: NanoProgram): boolean => {
  if (!activeProfile.value) return false;
  
  return nano.castingRequirements?.every(req => {
    if (req.type === 'skill') {
      const profileSkill = activeProfile.value.skills[req.requirement as string];
      return profileSkill >= req.value;
    }
    return true;
  }) ?? true;
};

const checkCastability = (nano: NanoProgram): boolean => {
  if (!activeProfile.value) return false;
  
  // Check all requirements including skills, stats, and level
  return nano.castingRequirements?.every(req => {
    switch (req.type) {
      case 'skill':
        const profileSkill = activeProfile.value.skills[req.requirement as string];
        return profileSkill >= req.value;
      case 'stat':
        const profileStat = activeProfile.value.stats[req.requirement as string];
        return profileStat >= req.value;
      case 'level':
        return activeProfile.value.level >= req.value;
      default:
        return true;
    }
  }) ?? true;
};

const handleSearch = (query: string) => {
  searchQuery.value = query;
};

const handleFilterChange = (newFilters: NanoFiltersType) => {
  filters.value = { ...newFilters };
};

const handleNanoSelect = (nano: NanoProgram) => {
  selectedNano.value = nano;
  showNanoDetail.value = true;
};

const handleNanoDetailClose = () => {
  selectedNano.value = null;
  showNanoDetail.value = false;
};

const handleStrainConflict = (conflictData: StrainConflict) => {
  strainConflictData.value = conflictData;
  showStrainConflict.value = true;
};

const handlePageChange = (page: number) => {
  // Handle pagination if needed
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
    schools: [],
    strains: [],
    professions: [],
    qualityLevels: [],
    skillCompatible: false,
    castable: false
  };
};

// Lifecycle
onMounted(async () => {
  // Load nanos data
  await nanosStore.fetchNanos();
  
  // Load profiles
  await profilesStore.loadProfiles();
  
  // Set initial profile selection
  if (activeProfile.value) {
    selectedProfile.value = activeProfile.value.id;
    showSkillCompatibility.value = true;
  }
});

// Watch for profile changes
watch(activeProfile, (newProfile) => {
  if (newProfile) {
    selectedProfile.value = newProfile.id;
  } else {
    selectedProfile.value = null;
  }
});
</script>

<style scoped>
.tinker-nanos {
  background: var(--surface-ground);
}
</style>
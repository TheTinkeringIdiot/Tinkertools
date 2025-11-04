<!--
NanoList - List view for nano programs with pagination and detailed cards
Displays nano programs in a scrollable list with compatibility indicators
-->
<template>
  <div class="nano-list h-full flex flex-col">
    <!-- List Header -->
    <div
      class="flex items-center justify-between p-4 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900"
    >
      <div class="flex items-center gap-4">
        <h3 class="text-lg font-medium text-surface-900 dark:text-surface-100">Nano Programs</h3>
        <Badge :value="totalNanos" severity="info" />
      </div>

      <div class="flex items-center gap-2">
        <!-- View Density Toggle -->
        <ToggleButton
          v-model="compactView"
          on-label="Compact"
          off-label="Detailed"
          on-icon="pi pi-th-large"
          off-icon="pi pi-list"
          size="small"
        />

        <!-- Items per page -->
        <Dropdown
          v-model="itemsPerPage"
          :options="itemsPerPageOptions"
          class="w-20"
          @change="handleItemsPerPageChange"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <ProgressSpinner />
        <p class="mt-4 text-surface-600 dark:text-surface-400">Loading nanos...</p>
      </div>
    </div>

    <!-- Nano List -->
    <div v-else-if="paginatedNanos.length > 0" class="flex-1 overflow-auto">
      <div class="p-4">
        <div class="grid gap-4" :class="compactView ? 'grid-cols-1' : 'grid-cols-1'">
          <NanoCard
            v-for="nano in paginatedNanos"
            :key="nano.id"
            :nano="nano"
            :compact="compactView"
            :show-compatibility="showCompatibility"
            :active-profile="activeProfile"
            :compatibility-info="getCompatibilityInfo(nano)"
            @select="handleNanoSelect"
            @favorite="handleFavorite"
          />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="flex-1 flex items-center justify-center">
      <div class="text-center max-w-md mx-auto">
        <i class="pi pi-search text-6xl text-surface-300 dark:text-surface-600 mb-4"></i>
        <h3 class="text-xl font-medium text-surface-700 dark:text-surface-300 mb-2">
          No nanos found
        </h3>
        <p class="text-surface-500 dark:text-surface-400 mb-4">
          Try adjusting your search criteria or filters to find more nano programs.
        </p>
      </div>
    </div>

    <!-- Pagination -->
    <div
      v-if="totalPages > 1"
      class="p-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900"
    >
      <Paginator
        v-model:first="first"
        :rows="itemsPerPage"
        :total-records="totalNanos"
        :rows-per-page-options="itemsPerPageOptions"
        template="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
        current-page-report-template="Showing {first} to {last} of {totalRecords} nanos"
        @page="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import Badge from 'primevue/badge';
import Dropdown from 'primevue/dropdown';
import Paginator from 'primevue/paginator';
import ProgressSpinner from 'primevue/progressspinner';
import ToggleButton from 'primevue/togglebutton';

import NanoCard from './NanoCard.vue';
import type { NanoProgram, TinkerProfile, NanoCompatibilityInfo } from '@/types/nano';

// Props
const props = withDefaults(
  defineProps<{
    nanos: NanoProgram[];
    loading?: boolean;
    showCompatibility?: boolean;
    activeProfile?: TinkerProfile | null;
  }>(),
  {
    loading: false,
    showCompatibility: false,
    activeProfile: null,
  }
);

// Emits
const emit = defineEmits<{
  'nano-select': [nano: NanoProgram];
  'page-change': [page: number];
  favorite: [nanoId: number, isFavorite: boolean];
}>();

// Reactive state
const compactView = ref(false);
const itemsPerPage = ref(25);
const currentPage = ref(0);
const first = ref(0);

const itemsPerPageOptions = [10, 25, 50, 100];

// Computed
const totalNanos = computed(() => props.nanos.length);

const totalPages = computed(() => Math.ceil(totalNanos.value / itemsPerPage.value));

const paginatedNanos = computed(() => {
  const start = currentPage.value * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return props.nanos.slice(start, end);
});

// Methods
const getCompatibilityInfo = (nano: NanoProgram): NanoCompatibilityInfo | null => {
  if (!props.showCompatibility || !props.activeProfile) {
    return null;
  }

  const profile = props.activeProfile;
  const requirements = nano.castingRequirements || [];

  let canCast = true;
  let skillDeficits: { skill: string; current: number; required: number; deficit: number }[] = [];
  let statDeficits: { stat: string; current: number; required: number; deficit: number }[] = [];
  let levelDeficit = 0;

  // Check each requirement
  for (const req of requirements) {
    switch (req.type) {
      case 'skill':
        const skill = req.requirement as string;
        const currentSkill = profile.skills[skill] || 0;
        if (currentSkill < req.value) {
          canCast = false;
          skillDeficits.push({
            skill,
            current: currentSkill,
            required: req.value,
            deficit: req.value - currentSkill,
          });
        }
        break;

      case 'stat':
        const stat = req.requirement as string;
        const currentStat = profile.stats[stat] || 0;
        if (currentStat < req.value) {
          canCast = false;
          statDeficits.push({
            stat,
            current: currentStat,
            required: req.value,
            deficit: req.value - currentStat,
          });
        }
        break;

      case 'level':
        if (profile.level < req.value) {
          canCast = false;
          levelDeficit = req.value - profile.level;
        }
        break;
    }
  }

  // Calculate compatibility score (0-100)
  const totalRequirements = requirements.length;
  const metRequirements =
    totalRequirements - skillDeficits.length - statDeficits.length - (levelDeficit > 0 ? 1 : 0);
  const compatibilityScore =
    totalRequirements > 0 ? Math.round((metRequirements / totalRequirements) * 100) : 100;

  // Calculate skill gap (average deficit across all skill requirements)
  const allSkillReqs = requirements.filter((req) => req.type === 'skill');
  let averageSkillGap = 0;

  if (allSkillReqs.length > 0) {
    const totalGap = skillDeficits.reduce((sum, deficit) => sum + deficit.deficit, 0);
    averageSkillGap = Math.round(totalGap / allSkillReqs.length);
  }

  return {
    canCast,
    compatibilityScore,
    averageSkillGap,
    skillDeficits,
    statDeficits,
    levelDeficit,
    memoryUsage: nano.memoryUsage || 0,
    nanoPointCost: nano.nanoPointCost || 0,
  };
};

const handleNanoSelect = (nano: NanoProgram) => {
  emit('nano-select', nano);
};

const handleFavorite = (nanoId: number, isFavorite: boolean) => {
  emit('favorite', nanoId, isFavorite);
};

const handlePageChange = (event: any) => {
  currentPage.value = Math.floor(event.first / itemsPerPage.value);
  first.value = event.first;
  emit('page-change', currentPage.value + 1);

  // Scroll to top of list
  const listElement = document.querySelector('.nano-list .overflow-auto');
  if (listElement) {
    listElement.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

const handleItemsPerPageChange = () => {
  // Reset to first page when changing items per page
  currentPage.value = 0;
  first.value = 0;
};

// Load preferences
const loadPreferences = () => {
  try {
    const preferences = localStorage.getItem('tinkertools_nano_list_preferences');
    if (preferences) {
      const parsed = JSON.parse(preferences);
      compactView.value = parsed.compactView || false;
      itemsPerPage.value = parsed.itemsPerPage || 25;
    }
  } catch (error) {
    console.warn('Failed to load nano list preferences:', error);
  }
};

const savePreferences = () => {
  try {
    const preferences = {
      compactView: compactView.value,
      itemsPerPage: itemsPerPage.value,
    };
    localStorage.setItem('tinkertools_nano_list_preferences', JSON.stringify(preferences));
  } catch (error) {
    console.warn('Failed to save nano list preferences:', error);
  }
};

// Watch for preference changes
watch([compactView, itemsPerPage], () => {
  savePreferences();
});

// Reset pagination when nanos change
watch(
  () => props.nanos,
  () => {
    currentPage.value = 0;
    first.value = 0;
  },
  { flush: 'post' }
);

// Lifecycle
onMounted(() => {
  loadPreferences();
});
</script>

<style scoped>
.nano-list {
  background: var(--surface-ground);
}

/* Custom scrollbar for the list */
.overflow-auto::-webkit-scrollbar {
  width: 8px;
}

.overflow-auto::-webkit-scrollbar-track {
  background: var(--surface-100);
  border-radius: 4px;
}

.overflow-auto::-webkit-scrollbar-thumb {
  background: var(--surface-300);
  border-radius: 4px;
}

.overflow-auto::-webkit-scrollbar-thumb:hover {
  background: var(--surface-400);
}

/* Dark mode scrollbar */
.dark .overflow-auto::-webkit-scrollbar-track {
  background: var(--surface-800);
}

.dark .overflow-auto::-webkit-scrollbar-thumb {
  background: var(--surface-600);
}

.dark .overflow-auto::-webkit-scrollbar-thumb:hover {
  background: var(--surface-500);
}
</style>

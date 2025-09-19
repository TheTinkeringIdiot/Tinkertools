<!--
PerkSelector - Hierarchical perk selector with search and category organization
Shows perks grouped by name with expandable categories, progression levels, and point costs
-->
<template>
  <div class="perk-selector h-full flex flex-col bg-surface-0 dark:bg-surface-950">
      <!-- Perk List Header -->
      <div class="p-4 border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-50">
            All Perks
          </h2>

          <!-- View Mode Toggle -->
          <div class="flex items-center gap-2">
            <Button
              :icon="viewMode === 'list' ? 'pi pi-list' : 'pi pi-th-large'"
              :label="viewMode === 'list' ? 'List View' : 'Grid View'"
              size="small"
              outlined
              @click="toggleViewMode"
            />
          </div>
        </div>
      </div>

      <!-- Categories List -->
      <div class="flex-1 overflow-y-auto p-4">
        <div v-if="loading" class="text-center py-8">
          <ProgressSpinner class="w-8 h-8" />
          <p class="text-surface-500 dark:text-surface-400 mt-2">Loading perks...</p>
        </div>

        <div v-else-if="filteredCategories.length === 0" class="text-center py-8">
          <i class="pi pi-info-circle text-4xl text-surface-300 dark:text-surface-600 mb-4"></i>
          <h3 class="text-lg font-medium text-surface-700 dark:text-surface-300 mb-2">
            No perks found
          </h3>
          <p class="text-surface-500 dark:text-surface-400">
            Try adjusting your search criteria or filters.
          </p>
        </div>

        <div v-else class="space-y-4">
          <PerkCategory
            v-for="category in filteredCategories"
            :key="category.name"
            :category="category"
            :view-mode="viewMode"
            :owned-perks="ownedPerks"
            :character-level="characterLevel"
            :ai-level="aiLevel"
            :profession="profession"
            :breed="breed"
            :available-standard-points="availableStandardPoints"
            :available-ai-points="availableAIPoints"
            @perk-select="onPerkSelect"
            @perk-remove="onPerkRemove"
          />
        </div>
      </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import { perkManager } from '@/lib/tinkerprofiles/perk-manager';
import type { PerkSeries, PerkType, AnyPerkEntry } from '@/lib/tinkerprofiles/perk-types';
import PerkCategory from './PerkCategory.vue';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';

// Types
interface PerkCategoryData {
  name: string;
  type: PerkType;
  perks: PerkSeries[];
  totalCount: number;
  ownedCount: number;
}

// Props
const props = defineProps<{
  profileId: string;
}>();

// Store
const profilesStore = useTinkerProfilesStore();

// State
const loading = ref(true);
const viewMode = ref<'list' | 'grid'>('list');

// Mock data for development (TODO: Replace with API calls)
const allPerkSeries = ref<PerkSeries[]>([]);

// Computed
const activeProfile = computed(() => {
  return profilesStore.profiles.find(p => p.id === props.profileId);
});

const characterLevel = computed(() => activeProfile.value?.Character.Level || 1);
const aiLevel = computed(() => activeProfile.value?.Character.AlienLevel || 0);
const profession = computed(() => activeProfile.value?.Character.Profession || '');
const breed = computed(() => activeProfile.value?.Character.Breed || '');

const ownedPerks = computed(() => {
  const perkSystem = activeProfile.value?.PerksAndResearch;
  if (!perkSystem) return [];

  return [
    ...perkSystem.perks,
    ...perkSystem.research
  ];
});

const availableStandardPoints = computed(() => {
  return activeProfile.value?.PerksAndResearch?.standardPerkPoints.available || 0;
});

const availableAIPoints = computed(() => {
  return activeProfile.value?.PerksAndResearch?.aiPerkPoints.available || 0;
});

const filteredPerkSeries = computed(() => {
  // Simply return all perks without any filtering
  return allPerkSeries.value;
});

const filteredCategories = computed(() => {
  const categories = new Map<string, PerkCategoryData>();

  // Group perks by name (each perk series becomes a category)
  filteredPerkSeries.value.forEach(series => {
    const ownedPerk = ownedPerks.value.find(p => p.name === series.name);

    categories.set(series.name, {
      name: series.name,
      type: series.type,
      perks: [series],
      totalCount: series.levels.length,
      ownedCount: ownedPerk ? 1 : 0
    });
  });

  return Array.from(categories.values()).sort((a, b) => {
    // Sort by type first, then by name
    if (a.type !== b.type) {
      const typeOrder = { SL: 1, AI: 2, LE: 3 };
      return typeOrder[a.type] - typeOrder[b.type];
    }
    return a.name.localeCompare(b.name);
  });
});

const filteredPerkCount = computed(() => filteredPerkSeries.value.length);

// Methods
function toggleViewMode() {
  viewMode.value = viewMode.value === 'list' ? 'grid' : 'list';
}

async function onPerkSelect(perkInfo: any, targetLevel: number) {
  if (!activeProfile.value) return;

  const result = perkManager.addPerk(activeProfile.value, perkInfo, targetLevel);

  if (result.success && result.updatedProfile) {
    await profilesStore.updateProfile(result.updatedProfile);

    // Show success message
    console.log('Perk added successfully:', result.changeEvent);
  } else {
    console.error('Failed to add perk:', result.error);
    // Show error message to user
  }
}

async function onPerkRemove(perkName: string, targetLevel: number = 0) {
  if (!activeProfile.value) return;

  const result = perkManager.removePerk(activeProfile.value, perkName, targetLevel);

  if (result.success && result.updatedProfile) {
    await profilesStore.updateProfile(result.updatedProfile);

    // Show success message
    console.log('Perk removed successfully:', result.changeEvent);
  } else {
    console.error('Failed to remove perk:', result.error);
    // Show error message to user
  }
}

async function loadPerkData() {
  loading.value = true;

  try {
    // TODO: Load perk data from API
    // For now, use mock data
    allPerkSeries.value = [
      // Mock perk series data will go here
      // This should come from the backend API once implemented
    ];
  } catch (error) {
    console.error('Failed to load perk data:', error);
  } finally {
    loading.value = false;
  }
}

// Watchers
watch(() => props.profileId, () => {
  // Reload when profile changes
  loadPerkData();
});

// Lifecycle
onMounted(() => {
  loadPerkData();
});
</script>

<style scoped>
/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  @apply bg-surface-100 dark:bg-surface-800;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  @apply bg-surface-300 dark:bg-surface-600 rounded-full;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  @apply bg-surface-400 dark:bg-surface-500;
}

/* Level input field width */
:deep(.level-input .p-inputnumber-input) {
  width: 4rem !important;
}

</style>
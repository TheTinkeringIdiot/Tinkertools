<!--
TinkerProfiles - Profile management and listing page
Shows all profiles in a card-based layout with management actions

v4.0.0 Compatible: Uses ProfileMetadata which is unchanged in ID-based architecture.
SkillService available for any future skill name displays.
-->
<template>
  <div class="tinker-profiles p-6 max-w-7xl mx-auto">
    <!-- Page Header -->
    <div class="mb-8">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-3xl font-bold text-surface-900 dark:text-surface-50 mb-2">
            TinkerProfiles
          </h1>
          <p class="text-surface-600 dark:text-surface-400">
            Manage and build your characters with comprehensive profile tools
          </p>
        </div>

        <!-- Quick Actions -->
        <div class="flex items-center gap-3">
          <Button icon="pi pi-plus" label="Create Profile" @click="showCreateModal = true" />
          <Button
            icon="pi pi-upload"
            label="Import"
            severity="secondary"
            outlined
            @click="showImportModal = true"
          />
          <Button
            icon="pi pi-download"
            label="Export All"
            severity="secondary"
            outlined
            @click="exportAllProfiles"
            :loading="loading"
            :disabled="filteredProfiles.length === 0"
            v-tooltip.bottom="
              filteredProfiles.length === 0
                ? 'No profiles to export'
                : `Export all ${filteredProfiles.length} profiles`
            "
          />
        </div>
      </div>

      <!-- Search and Filters -->
      <div class="flex items-center gap-4">
        <div class="flex-1 max-w-md">
          <span class="p-input-icon-left w-full">
            <i class="pi pi-search" />
            <InputText v-model="searchQuery" placeholder="Search profiles..." class="w-full" />
          </span>
        </div>

        <!-- Filter Controls -->
        <div class="flex items-center gap-2">
          <Dropdown
            v-model="selectedProfession"
            :options="professionOptions"
            placeholder="All Professions"
            show-clear
            class="w-48"
          />

          <Dropdown
            v-model="selectedBreed"
            :options="breedOptions"
            placeholder="All Breeds"
            show-clear
            class="w-40"
          />
        </div>

        <!-- View Toggle -->
        <div
          class="flex items-center gap-1 border border-surface-200 dark:border-surface-700 rounded-lg p-1"
        >
          <Button
            icon="pi pi-th-large"
            size="small"
            :severity="viewMode === 'grid' ? 'primary' : 'secondary'"
            :outlined="viewMode !== 'grid'"
            @click="viewMode = 'grid'"
            v-tooltip.bottom="'Grid View'"
          />
          <Button
            icon="pi pi-bars"
            size="small"
            :severity="viewMode === 'list' ? 'primary' : 'secondary'"
            :outlined="viewMode !== 'list'"
            @click="viewMode = 'list'"
            v-tooltip.bottom="'List View'"
          />
        </div>
      </div>
    </div>

    <!-- Profile Count and Status -->
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Badge :value="filteredProfiles.length" />
        <span class="text-surface-600 dark:text-surface-400">
          {{ filteredProfiles.length === 1 ? 'profile' : 'profiles' }} found
        </span>
        <span v-if="activeProfileId" class="text-sm text-primary-600 dark:text-primary-400">
          • Active: {{ activeProfile?.Character?.Name }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <Button
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          size="small"
          @click="refreshProfiles"
          :loading="loading"
          v-tooltip.bottom="'Refresh Profiles'"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <ProgressSpinner />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="text-center py-16">
      <i class="pi pi-exclamation-triangle text-4xl text-red-500 mb-4"></i>
      <h3 class="text-lg font-medium text-surface-600 dark:text-surface-400 mb-2">
        Failed to Load Profiles
      </h3>
      <p class="text-surface-500 dark:text-surface-500 mb-4">{{ error }}</p>
      <Button label="Retry" @click="refreshProfiles" />
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredProfiles.length === 0" class="text-center py-16">
      <div v-if="profilesMetadata.length === 0" class="space-y-4">
        <i class="pi pi-users text-6xl text-surface-300 dark:text-surface-600 mb-4"></i>
        <h3 class="text-xl font-medium text-surface-600 dark:text-surface-400 mb-2">
          No Profiles Yet
        </h3>
        <p class="text-surface-500 dark:text-surface-500 mb-6 max-w-md mx-auto">
          Create your first character profile to get started with TinkerProfiles. Build, plan, and
          optimize your Anarchy Online characters.
        </p>
        <div class="flex justify-center gap-3">
          <Button
            icon="pi pi-plus"
            label="Create Your First Profile"
            @click="showCreateModal = true"
          />
          <Button
            icon="pi pi-upload"
            label="Import Existing"
            severity="secondary"
            outlined
            @click="showImportModal = true"
          />
        </div>
      </div>

      <div v-else class="space-y-4">
        <i class="pi pi-filter text-4xl text-surface-400 dark:text-surface-500 mb-4"></i>
        <h3 class="text-lg font-medium text-surface-600 dark:text-surface-400 mb-2">
          No Profiles Match Your Filters
        </h3>
        <p class="text-surface-500 dark:text-surface-500">
          Try adjusting your search or filter criteria
        </p>
        <Button label="Clear Filters" severity="secondary" outlined @click="clearFilters" />
      </div>
    </div>

    <!-- Profiles Grid/List -->
    <div v-else>
      <!-- Grid View -->
      <div
        v-if="viewMode === 'grid'"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      >
        <ProfileCard
          v-for="profile in filteredProfiles"
          :key="profile.id"
          :profile="profile"
          :is-active="profile.id === activeProfileId"
          @view-details="viewProfileDetails"
          @set-active="setActiveProfile"
          @duplicate="duplicateProfile"
          @export="exportProfile"
          @delete="deleteProfile"
        />
      </div>

      <!-- List View -->
      <div v-else class="space-y-3">
        <div
          v-for="profile in filteredProfiles"
          :key="profile.id"
          class="bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="flex-shrink-0">
                <div
                  class="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center"
                >
                  <i class="pi pi-user text-primary-600 dark:text-primary-400 text-lg"></i>
                </div>
              </div>

              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <h3 class="font-semibold text-surface-900 dark:text-surface-50">
                    {{ profile.name }}
                  </h3>
                  <Badge v-if="profile.id === activeProfileId" value="Active" severity="success" />
                </div>
                <div class="flex items-center gap-4 text-sm text-surface-600 dark:text-surface-400">
                  <span>{{ profile.profession }} {{ profile.level }}</span>
                  <span>{{ profile.breed }}</span>
                  <span>{{ profile.faction }}</span>
                  <span>Updated {{ formatDate(profile.updated) }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Button
                icon="pi pi-eye"
                size="small"
                severity="secondary"
                outlined
                @click="viewProfileDetails(profile)"
                v-tooltip.bottom="'View Details'"
              />
              <Button
                v-if="profile.id !== activeProfileId"
                icon="pi pi-check"
                size="small"
                severity="success"
                outlined
                @click="setActiveProfile(profile)"
                v-tooltip.bottom="'Set Active'"
              />
              <Button
                icon="pi pi-clone"
                size="small"
                severity="secondary"
                outlined
                @click="duplicateProfile(profile)"
                v-tooltip.bottom="'Duplicate'"
              />
              <Button
                icon="pi pi-download"
                size="small"
                severity="secondary"
                outlined
                @click="exportProfile(profile)"
                v-tooltip.bottom="'Export'"
              />
              <Button
                icon="pi pi-trash"
                size="small"
                severity="danger"
                outlined
                @click="deleteProfile(profile)"
                v-tooltip.bottom="'Delete'"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Profile Modal -->
  <ProfileCreateModal
    :visible="showCreateModal"
    @update:visible="showCreateModal = $event"
    @created="handleProfileCreated"
  />

  <!-- Import Profile Modal -->
  <ProfileImportModal
    :visible="showImportModal"
    @update:visible="showImportModal = $event"
    @imported="handleProfileImported"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Dropdown from 'primevue/dropdown';
import Badge from 'primevue/badge';
import ProgressSpinner from 'primevue/progressspinner';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import ProfileCard from '@/components/profiles/ProfileCard.vue';
import ProfileCreateModal from '@/components/profiles/ProfileCreateModal.vue';
import ProfileImportModal from '@/components/profiles/ProfileImportModal.vue';
import type { ProfileMetadata } from '@/lib/tinkerprofiles';
import { ANARCHY_PROFESSIONS, ANARCHY_BREEDS } from '@/lib/tinkerprofiles';
import { skillService } from '@/services/skill-service';

const router = useRouter();
const profilesStore = useTinkerProfilesStore();

// State
const loading = ref(false);
const error = ref<string | null>(null);
const searchQuery = ref('');
const selectedProfession = ref<string | null>(null);
const selectedBreed = ref<string | null>(null);
const viewMode = ref<'grid' | 'list'>('grid');
const showCreateModal = ref(false);
const showImportModal = ref(false);

// Computed
const profilesMetadata = computed(() => profilesStore.profileMetadata);
const activeProfileId = computed(() => profilesStore.activeProfileId);
const activeProfile = computed(() => profilesStore.activeProfile);

// Filter and sort options
const professionOptions = ANARCHY_PROFESSIONS.map((p) => p);
const breedOptions = ANARCHY_BREEDS.map((b) => b);

// Filtered and sorted profiles
const filteredProfiles = computed(() => {
  let filtered = [...profilesMetadata.value];

  // Apply search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (profile) =>
        profile.name.toLowerCase().includes(query) ||
        profile.profession.toLowerCase().includes(query) ||
        profile.breed.toLowerCase().includes(query)
    );
  }

  // Apply profession filter
  if (selectedProfession.value) {
    filtered = filtered.filter((profile) => profile.profession === selectedProfession.value);
  }

  // Apply breed filter
  if (selectedBreed.value) {
    filtered = filtered.filter((profile) => profile.breed === selectedBreed.value);
  }

  // Apply default sorting by last updated
  filtered.sort((a, b) => {
    return new Date(b.updated).getTime() - new Date(a.updated).getTime();
  });

  return filtered;
});

// Methods
async function refreshProfiles() {
  loading.value = true;
  error.value = null;
  try {
    await profilesStore.loadProfiles();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load profiles';
  } finally {
    loading.value = false;
  }
}

function clearFilters() {
  searchQuery.value = '';
  selectedProfession.value = null;
  selectedBreed.value = null;
}

function viewProfileDetails(profile: ProfileMetadata) {
  router.push({
    name: 'TinkerProfileDetail',
    params: { profileId: profile.id },
  });
}

async function setActiveProfile(profile: ProfileMetadata) {
  try {
    await profilesStore.setActiveProfile(profile.id);
  } catch (err) {
    console.error('Failed to set active profile:', err);
  }
}

async function duplicateProfile(profile: ProfileMetadata) {
  try {
    const newName = `${profile.name} (Copy)`;
    await profilesStore.duplicateProfile(profile.id, newName);
    await refreshProfiles();
  } catch (err) {
    console.error('Failed to duplicate profile:', err);
  }
}

async function exportProfile(profile: ProfileMetadata) {
  try {
    const exported = await profilesStore.exportProfile(profile.id, 'json');

    // Create download
    const blob = new Blob([exported], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${profile.name}_profile.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to export profile:', err);
  }
}

async function exportAllProfiles() {
  try {
    const exported = await profilesStore.exportAllProfiles();

    // Create download
    const blob = new Blob([exported], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Generate filename with timestamp
    const now = new Date();
    const timestamp = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    a.download = `tinkerprofiles_all_${timestamp}.json`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to export all profiles:', err);
  }
}

async function deleteProfile(profile: ProfileMetadata) {
  if (
    !confirm(`Are you sure you want to delete "${profile.name}"? This action cannot be undone.`)
  ) {
    return;
  }

  try {
    await profilesStore.deleteProfile(profile.id);
    await refreshProfiles();
  } catch (err) {
    console.error('Failed to delete profile:', err);
  }
}

function handleProfileCreated() {
  showCreateModal.value = false;
  refreshProfiles();
}

function handleProfileImported() {
  showImportModal.value = false;
  refreshProfiles();
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString();
  } catch {
    return 'Unknown';
  }
}

// Lifecycle
onMounted(() => {
  refreshProfiles();
});
</script>

<style scoped>
.tinker-profiles {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Ensure cards have consistent height in grid view */
:deep(.profile-card) {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>

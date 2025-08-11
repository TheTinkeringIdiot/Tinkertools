<!--
Profile Manager Modal
Modal dialog for managing all profiles - create, edit, delete, import, export
-->
<template>
  <Dialog
    :visible="visible"
    modal
    header="Manage Profiles"
    :style="{ width: '90vw', maxWidth: '1200px', height: '80vh' }"
    class="profile-manager-modal"
    @update:visible="$emit('update:visible', $event)"
  >
    <div class="flex flex-col h-full">
      <!-- Header Actions -->
      <div class="flex justify-between items-center mb-4 pb-4 border-b border-surface-200 dark:border-surface-700">
        <div class="flex items-center gap-2">
          <Button
            @click="showCreateModal = true"
            label="Create Profile"
            icon="pi pi-plus"
            size="small"
          />
          <Button
            @click="showImportModal = true"
            label="Import"
            icon="pi pi-upload"
            size="small"
            severity="secondary"
            outlined
          />
        </div>
        
        <div class="flex items-center gap-2">
          <span class="text-sm text-surface-600 dark:text-surface-400">
            {{ profileMetadata.length }} profile{{ profileMetadata.length !== 1 ? 's' : '' }}
          </span>
          <Button
            @click="refreshProfiles"
            icon="pi pi-refresh"
            size="small"
            severity="secondary"
            text
            :loading="loading"
            aria-label="Refresh profiles"
          />
        </div>
      </div>
      
      <!-- Profiles List -->
      <div class="flex-1 overflow-auto">
        <div v-if="loading && profileMetadata.length === 0" class="flex items-center justify-center h-32">
          <ProgressSpinner />
        </div>
        
        <div v-else-if="profileMetadata.length === 0" class="flex flex-col items-center justify-center h-32 text-center">
          <i class="pi pi-user-plus text-4xl text-surface-400 dark:text-surface-600 mb-4"></i>
          <h3 class="text-lg font-medium text-surface-700 dark:text-surface-300 mb-2">
            No profiles found
          </h3>
          <p class="text-surface-500 dark:text-surface-400 mb-4">
            Create your first profile to get started
          </p>
          <Button
            @click="showCreateModal = true"
            label="Create Profile"
            icon="pi pi-plus"
          />
        </div>
        
        <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div
            v-for="profile in profileMetadata"
            :key="profile.id"
            class="profile-card bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-4 hover:shadow-md transition-shadow"
            :class="{ 'ring-2 ring-primary-500 ring-opacity-50': profile.id === activeProfileId }"
          >
            <!-- Profile Header -->
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                  <i class="pi pi-user text-primary-600 dark:text-primary-400"></i>
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="font-semibold text-surface-900 dark:text-surface-50 truncate">
                    {{ profile.name }}
                  </h4>
                  <p class="text-sm text-surface-600 dark:text-surface-400">
                    {{ profile.profession }} {{ profile.level }}
                  </p>
                </div>
              </div>
              
              <div class="flex items-center gap-1">
                <Button
                  v-if="profile.id !== activeProfileId"
                  @click="setActiveProfile(profile.id)"
                  icon="pi pi-check"
                  size="small"
                  severity="success"
                  text
                  rounded
                  aria-label="Set as active profile"
                  v-tooltip="'Set as active profile'"
                />
                <span
                  v-else
                  class="px-2 py-1 text-xs font-medium bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded"
                >
                  Active
                </span>
              </div>
            </div>
            
            <!-- Profile Details -->
            <div class="grid grid-cols-2 gap-2 text-xs text-surface-600 dark:text-surface-400 mb-4">
              <div>
                <span class="font-medium">Breed:</span> {{ profile.breed }}
              </div>
              <div>
                <span class="font-medium">Faction:</span> {{ profile.faction }}
              </div>
              <div>
                <span class="font-medium">Created:</span> {{ formatDate(profile.created) }}
              </div>
              <div>
                <span class="font-medium">Updated:</span> {{ formatDate(profile.updated) }}
              </div>
            </div>
            
            <!-- Profile Actions -->
            <div class="flex gap-1">
              <Button
                @click="viewProfile(profile)"
                label="Details"
                icon="pi pi-eye"
                size="small"
                severity="secondary"
                outlined
                class="flex-1"
              />
              <Button
                @click="exportProfile(profile)"
                icon="pi pi-download"
                size="small"
                severity="secondary"
                outlined
                v-tooltip="'Export profile'"
              />
              <Button
                @click="duplicateProfile(profile)"
                icon="pi pi-copy"
                size="small"
                severity="secondary"
                outlined
                v-tooltip="'Duplicate profile'"
              />
              <Button
                @click="confirmDeleteProfile(profile)"
                icon="pi pi-trash"
                size="small"
                severity="danger"
                outlined
                v-tooltip="'Delete profile'"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Create Profile Modal -->
    <ProfileCreateModal
      v-model:visible="showCreateModal"
      @created="onProfileCreated"
    />
    
    <!-- Profile Details Modal -->
    <ProfileDetailsModal
      v-model:visible="showDetailsModal"
      :profile="selectedProfile"
      @updated="onProfileUpdated"
    />
    
    <!-- Import Modal -->
    <ProfileImportModal
      v-model:visible="showImportModal"
      @imported="onProfileImported"
    />
    
    <!-- Delete Confirmation -->
    <ConfirmDialog />
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useConfirm } from 'primevue/useconfirm';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import ProgressSpinner from 'primevue/progressspinner';
import ConfirmDialog from 'primevue/confirmdialog';
import ProfileCreateModal from './ProfileCreateModal.vue';
import ProfileDetailsModal from './ProfileDetailsModal.vue';
import ProfileImportModal from './ProfileImportModal.vue';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import type { ProfileMetadata } from '@/lib/tinkerprofiles';

// Props & Emits
const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  'profile-selected': [profileId: string];
  'refresh': [];
}>();

// Services
const confirm = useConfirm();
const profilesStore = useTinkerProfilesStore();

// Store state
const { 
  profileMetadata, 
  activeProfileId, 
  loading 
} = storeToRefs(profilesStore);

// Local state
const showCreateModal = ref(false);
const showDetailsModal = ref(false);
const showImportModal = ref(false);
const selectedProfile = ref<ProfileMetadata | null>(null);

// Methods
async function refreshProfiles() {
  await profilesStore.refreshMetadata();
  emit('refresh');
}

async function setActiveProfile(profileId: string) {
  try {
    await profilesStore.setActiveProfile(profileId);
    emit('profile-selected', profileId);
  } catch (error) {
    console.error('Failed to set active profile:', error);
  }
}

function viewProfile(profile: ProfileMetadata) {
  selectedProfile.value = profile;
  showDetailsModal.value = true;
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
    
  } catch (error) {
    console.error('Failed to export profile:', error);
  }
}

async function duplicateProfile(profile: ProfileMetadata) {
  try {
    const newName = `${profile.name} (Copy)`;
    await profilesStore.duplicateProfile(profile.id, newName);
    await refreshProfiles();
  } catch (error) {
    console.error('Failed to duplicate profile:', error);
  }
}

function confirmDeleteProfile(profile: ProfileMetadata) {
  confirm.require({
    message: `Are you sure you want to delete "${profile.name}"? This action cannot be undone.`,
    header: 'Delete Profile',
    icon: 'pi pi-exclamation-triangle',
    rejectClass: 'p-button-secondary p-button-outlined',
    rejectLabel: 'Cancel',
    acceptClass: 'p-button-danger',
    acceptLabel: 'Delete',
    accept: () => deleteProfile(profile.id)
  });
}

async function deleteProfile(profileId: string) {
  try {
    await profilesStore.deleteProfile(profileId);
    await refreshProfiles();
  } catch (error) {
    console.error('Failed to delete profile:', error);
  }
}

function onProfileCreated() {
  refreshProfiles();
}

function onProfileUpdated() {
  refreshProfiles();
}

function onProfileImported() {
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
.profile-manager-modal :deep(.p-dialog-content) {
  padding: 1.5rem;
  height: calc(100% - 60px);
  display: flex;
  flex-direction: column;
}

.profile-card {
  transition: all 0.2s ease;
}

.profile-card:hover {
  transform: translateY(-2px);
}
</style>
<!--
Profile Dropdown Component
Global profile selection dropdown for the top navigation bar
-->
<template>
  <div class="profile-dropdown">
    <Dropdown
      v-model="selectedProfileId"
      :options="profileOptions"
      option-label="label"
      option-value="value"
      :placeholder="dropdownPlaceholder"
      class="profile-selector"
      :class="{ 'profile-active': hasActiveProfile }"
      :loading="loading"
      @change="onProfileChange"
      :pt="{
        root: { class: 'w-64' },
        input: { 
          class: hasActiveProfile 
            ? 'font-medium text-primary-700 dark:text-primary-300' 
            : 'text-surface-600 dark:text-surface-400'
        }
      }"
    >
      <template #value="slotProps">
        <div v-if="slotProps.value" class="flex items-center gap-2">
          <div class="flex flex-col">
            <span class="font-medium text-sm">{{ activeProfileName }}</span>
            <span class="text-xs text-surface-500 dark:text-surface-400">
              {{ activeProfileProfession }} {{ activeProfileLevel }}
            </span>
          </div>
        </div>
        <span v-else class="text-surface-500 dark:text-surface-400">
          No Profile Selected
        </span>
      </template>
      
      <template #option="slotProps">
        <div v-if="slotProps.option.value === null" class="flex items-center gap-2 py-1">
          <i class="pi pi-user-minus text-surface-400"></i>
          <span class="text-surface-600 dark:text-surface-300">{{ slotProps.option.label }}</span>
        </div>
        <div v-else class="flex items-center gap-2 py-1">
          <div class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
            <i class="pi pi-user text-primary-600 dark:text-primary-400 text-sm"></i>
          </div>
          <div class="flex flex-col flex-1">
            <span class="font-medium text-sm text-surface-900 dark:text-surface-50">
              {{ getProfileName(slotProps.option) }}
            </span>
            <span class="text-xs text-surface-500 dark:text-surface-400">
              {{ getProfileDetails(slotProps.option) }}
            </span>
          </div>
          <div v-if="slotProps.option.value === selectedProfileId" class="text-primary-500">
            <i class="pi pi-check text-sm"></i>
          </div>
        </div>
      </template>
    </Dropdown>
    
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import Dropdown from 'primevue/dropdown';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';

// Store
const profilesStore = useTinkerProfilesStore();

// Local state
const selectedProfileId = ref<string | null>(null);

// Computed
const { 
  loading, 
  hasActiveProfile, 
  profileOptions: storeProfileOptions,
  activeProfileName,
  activeProfileProfession,
  activeProfileLevel 
} = storeToRefs(profilesStore);

const profileOptions = computed(() => [
  ...storeProfileOptions.value
]);

const dropdownPlaceholder = computed(() => {
  return loading.value ? 'Loading...' : 'Select Profile';
});

// Methods
function getProfileName(option: any): string {
  const match = option.label.match(/^(.+?) \(/);
  return match ? match[1] : option.label;
}

function getProfileDetails(option: any): string {
  const match = option.label.match(/\((.+)\)$/);
  return match ? match[1] : '';
}

async function onProfileChange(event: any) {
  const value = event.value;
  
  try {
    await profilesStore.setActiveProfile(value);
  } catch (error) {
    console.error('Failed to set active profile:', error);
    // Reset to previous selection
    selectedProfileId.value = profilesStore.activeProfileId;
  }
}


// Watchers
watch(() => profilesStore.activeProfileId, (newId) => {
  selectedProfileId.value = newId;
}, { immediate: true });

// Lifecycle
onMounted(async () => {
  await profilesStore.loadProfiles();
  selectedProfileId.value = profilesStore.activeProfileId;
});
</script>

<style scoped>
.profile-dropdown {
  min-width: 16rem;
}

.profile-selector {
  transition: all 0.2s ease;
}

.profile-active {
  border-color: rgb(var(--primary-500));
  box-shadow: 0 0 0 1px rgb(var(--primary-500) / 0.2);
}
</style>
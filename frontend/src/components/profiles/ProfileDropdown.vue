<!--
Profile Dropdown Component
Global profile selection dropdown for the top navigation bar.

Profiles are per game version. The current version's profiles are listed first;
profiles built against another version sit under a dimmed "Other versions" group
and, when chosen, offer to copy themselves into the current version rather than
being activated with stats from the wrong database.
-->
<template>
  <div class="profile-dropdown">
    <!--
      Own dialog in its own group: the header dropdown can be open on any page,
      including ones that mount their own ConfirmDialog, and an ungrouped dialog
      would answer their confirmations too.
    -->
    <ConfirmDialog :group="CONFIRM_GROUP" />

    <Dropdown
      v-model="selectedProfileId"
      :options="groupedOptions"
      option-label="label"
      option-value="value"
      option-group-label="label"
      option-group-children="items"
      :placeholder="dropdownPlaceholder"
      class="profile-selector"
      :class="{ 'profile-active': hasActiveProfile }"
      :loading="loading"
      :pt="{
        root: { class: 'w-64 h-11 items-center' },
        input: {
          class: hasActiveProfile
            ? 'font-medium text-primary-700 dark:text-primary-300'
            : 'text-surface-600 dark:text-surface-400',
        },
      }"
      @change="onProfileChange"
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
        <span v-else class="text-surface-500 dark:text-surface-400"> No Profile Selected </span>
      </template>

      <template #optiongroup="slotProps">
        <div
          class="flex items-center gap-2 py-1 text-xs uppercase tracking-wide"
          :class="
            slotProps.option.otherVersions
              ? 'text-surface-400 dark:text-surface-500'
              : 'text-surface-600 dark:text-surface-300'
          "
        >
          <i v-if="slotProps.option.otherVersions" class="pi pi-clone text-xs"></i>
          <span>{{ slotProps.option.label }}</span>
        </div>
      </template>

      <template #option="slotProps">
        <div v-if="slotProps.option.value === null" class="flex items-center gap-2 py-1">
          <i class="pi pi-user-minus text-surface-400"></i>
          <span class="text-surface-600 dark:text-surface-300">{{ slotProps.option.label }}</span>
        </div>
        <div
          v-else
          class="flex items-center gap-2 py-1"
          :class="{ 'opacity-60': slotProps.option.otherVersion }"
        >
          <div
            class="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center"
          >
            <i class="pi pi-user text-primary-600 dark:text-primary-400 text-sm"></i>
          </div>
          <div class="flex flex-col flex-1">
            <span class="font-medium text-sm text-surface-900 dark:text-surface-50">
              {{ getProfileName(slotProps.option) }}
            </span>
            <span class="text-xs text-surface-500 dark:text-surface-400">
              {{ getProfileDetails(slotProps.option) }}
            </span>
            <span
              v-if="slotProps.option.otherVersion"
              class="text-xs italic text-surface-400 dark:text-surface-500"
            >
              {{ slotProps.option.versionLabel }}
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
import Dropdown, { type DropdownChangeEvent } from 'primevue/dropdown';
import ConfirmDialog from 'primevue/confirmdialog';
import { useConfirm } from 'primevue/useconfirm';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import { gameVersionDisplayName } from '@/lib/tinkerprofiles/game-version';

// Store
const profilesStore = useTinkerProfilesStore();
const confirm = useConfirm();

/** Shape of the options built by the store's groupedProfileOptions. */
interface ProfileOption {
  label: string;
  value: string | null;
  otherVersion: boolean;
  versionLabel: string;
}

/** Confirmation group, so only this component's dialog answers its own prompts. */
const CONFIRM_GROUP = 'profile-version-copy';

// Local state
const selectedProfileId = ref<string | null>(null);

// Computed
const {
  loading,
  hasActiveProfile,
  groupedProfileOptions,
  activeProfileName,
  activeProfileProfession,
  activeProfileLevel,
  gameVersion,
} = storeToRefs(profilesStore);

const groupedOptions = computed(() =>
  groupedProfileOptions.value.map((group) => ({
    ...group,
    otherVersions: group.label === 'Other versions',
  }))
);

const currentVersionLabel = computed(() => gameVersionDisplayName(gameVersion.value));

const dropdownPlaceholder = computed(() => {
  return loading.value ? 'Loading...' : 'Select Profile';
});

// Methods
function getProfileName(option: ProfileOption): string {
  const match = option.label.match(/^(.+?) \(/);
  return match ? match[1] : option.label;
}

function getProfileDetails(option: ProfileOption): string {
  const match = option.label.match(/\((.+)\)$/);
  return match ? match[1] : '';
}

function findOption(value: string | null): ProfileOption | null {
  for (const group of groupedProfileOptions.value) {
    const items: ProfileOption[] = group.items;
    const found = items.find((item) => item.value === value);
    if (found) return found;
  }
  return null;
}

async function onProfileChange(event: DropdownChangeEvent) {
  const value = event.value as string | null;
  const option = findOption(value);

  // A profile from another version cannot be activated as-is: its item
  // snapshots came from a different database. Offer a copy instead.
  if (option?.otherVersion && option.value !== null) {
    selectedProfileId.value = profilesStore.activeProfileId;
    confirmCopy(option, option.value);
    return;
  }

  try {
    await profilesStore.setActiveProfile(value);
  } catch (error) {
    console.error('Failed to set active profile:', error);
    // Reset to previous selection
    selectedProfileId.value = profilesStore.activeProfileId;
  }
}

function confirmCopy(option: ProfileOption, profileId: string) {
  confirm.require({
    group: CONFIRM_GROUP,
    header: 'Copy profile',
    message: `Copy '${getProfileName(option)}' for ${currentVersionLabel.value}?`,
    icon: 'pi pi-clone',
    acceptLabel: 'Copy',
    rejectLabel: 'Cancel',
    accept: () => {
      void copyProfile(profileId);
    },
  });
}

async function copyProfile(profileId: string) {
  try {
    await profilesStore.copyProfileToCurrentVersion(profileId);
  } catch (error) {
    console.error('Failed to copy profile for current version:', error);
  } finally {
    selectedProfileId.value = profilesStore.activeProfileId;
  }
}

// Watchers
watch(
  () => profilesStore.activeProfileId,
  (newId) => {
    selectedProfileId.value = newId;
  },
  { immediate: true }
);

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

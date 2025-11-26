<!--
Profile Create Modal
Modal for creating new character profiles
-->
<template>
  <Dialog
    :visible="visible"
    modal
    header="Create New Profile"
    :style="{ width: '600px' }"
    @update:visible="$emit('update:visible', $event)"
  >
    <form @submit.prevent="createProfile" class="space-y-4">
      <!-- Character Name -->
      <div class="field">
        <label for="profile-name" class="font-semibold text-surface-900 dark:text-surface-50">
          Character Name *
        </label>
        <InputText
          id="profile-name"
          v-model="formData.name"
          :invalid="!!errors.name"
          placeholder="Enter character name"
          class="w-full"
          maxlength="50"
          required
          autofocus
        />
        <small v-if="errors.name" class="text-red-500">{{ errors.name }}</small>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Profession -->
        <div class="field">
          <label for="profession" class="font-semibold text-surface-900 dark:text-surface-50">
            Profession
          </label>
          <Dropdown
            id="profession"
            v-model="formData.profession"
            :options="professionOptions"
            placeholder="Select profession"
            class="w-full"
          />
        </div>

        <!-- Level -->
        <div class="field">
          <label for="level" class="font-semibold text-surface-900 dark:text-surface-50">
            Level
          </label>
          <InputNumber
            id="level"
            v-model="formData.level"
            :min="1"
            :max="220"
            :step="1"
            placeholder="Character level"
            class="w-full"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Breed -->
        <div class="field">
          <label for="breed" class="font-semibold text-surface-900 dark:text-surface-50">
            Breed
          </label>
          <Dropdown
            id="breed"
            v-model="formData.breed"
            :options="breedOptions"
            placeholder="Select breed"
            class="w-full"
          />
        </div>

        <!-- Faction -->
        <div class="field">
          <label for="faction" class="font-semibold text-surface-900 dark:text-surface-50">
            Faction
          </label>
          <Dropdown
            id="faction"
            v-model="formData.faction"
            :options="factionOptions"
            placeholder="Select faction"
            class="w-full"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Expansion -->
        <div class="field">
          <label for="expansion" class="font-semibold text-surface-900 dark:text-surface-50">
            Expansion
          </label>
          <Dropdown
            id="expansion"
            v-model="formData.expansion"
            :options="expansionOptions"
            placeholder="Select expansion"
            class="w-full"
          />
        </div>

        <!-- Account Type -->
        <div class="field">
          <label for="account-type" class="font-semibold text-surface-900 dark:text-surface-50">
            Account Type
          </label>
          <Dropdown
            id="account-type"
            v-model="formData.accountType"
            :options="accountTypeOptions"
            placeholder="Select account type"
            class="w-full"
          />
        </div>
      </div>

      <!-- Create Options -->
      <div class="field">
        <div class="flex items-center">
          <Checkbox id="set-active" v-model="formData.setAsActive" binary />
          <label for="set-active" class="ml-2 text-surface-900 dark:text-surface-50">
            Set as active profile after creation
          </label>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2 pt-4">
        <Button type="button" label="Cancel" severity="secondary" outlined @click="cancel" />
        <Button
          type="submit"
          label="Create Profile"
          icon="pi pi-plus"
          :loading="creating"
          :disabled="!isValid"
        />
      </div>
    </form>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import Button from 'primevue/button';
import Checkbox from 'primevue/checkbox';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import {
  ANARCHY_PROFESSIONS,
  ANARCHY_BREEDS,
  ANARCHY_FACTIONS,
  ANARCHY_EXPANSIONS,
  ACCOUNT_TYPES,
} from '@/lib/tinkerprofiles';
import { normalizeProfessionToId, normalizeBreedToId } from '@/services/game-utils';

// Props & Emits
const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  created: [profileId: string];
}>();

// Services
const profilesStore = useTinkerProfilesStore();

// Form data
const formData = reactive({
  name: '',
  profession: 'Adventurer',
  level: 1,
  breed: 'Solitus',
  faction: 'Neutral',
  expansion: 'Lost Eden',
  accountType: 'Paid',
  setAsActive: true,
});

const errors = ref<Record<string, string>>({});
const creating = ref(false);

// Options
const professionOptions = ANARCHY_PROFESSIONS.map((p) => p);
const breedOptions = ANARCHY_BREEDS.map((b) => b);
const factionOptions = ANARCHY_FACTIONS.map((f) => f);
const expansionOptions = ANARCHY_EXPANSIONS.map((e) => e);
const accountTypeOptions = ACCOUNT_TYPES.map((a) => a);

// Computed
const isValid = computed(() => {
  return formData.name.trim().length > 0 && !errors.value.name;
});

// Methods
function validateForm() {
  errors.value = {};

  if (!formData.name.trim()) {
    errors.value.name = 'Character name is required';
  } else if (formData.name.length > 50) {
    errors.value.name = 'Character name must be 50 characters or less';
  } else if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(formData.name)) {
    errors.value.name =
      'Character name must start with a letter and contain only letters and numbers';
  }

  return Object.keys(errors.value).length === 0;
}

async function createProfile() {
  if (!validateForm()) {
    return;
  }

  creating.value = true;

  try {
    // Create v4.0.0 profile with ID-based skill structure
    // CRITICAL: Convert profession and breed to numeric IDs for validation
    // Note: Partial Character is merged with defaults in ProfileManager.createProfile()
    const profileId = await profilesStore.createProfile(formData.name.trim(), {
      Character: {
        Name: formData.name.trim(),
        Level: formData.level,
        Profession: normalizeProfessionToId(formData.profession),
        Breed: normalizeBreedToId(formData.breed),
        Faction: formData.faction,
        Expansion: formData.expansion,
        AccountType: formData.accountType,
      },
    } as any);

    if (formData.setAsActive) {
      await profilesStore.setActiveProfile(profileId);
    }

    emit('created', profileId);
    emit('update:visible', false);
    resetForm();
  } catch (error) {
    console.error('Failed to create profile:', error);
    errors.value.general = 'Failed to create profile. Please try again.';
  } finally {
    creating.value = false;
  }
}

function cancel() {
  emit('update:visible', false);
  resetForm();
}

function resetForm() {
  formData.name = '';
  formData.profession = 'Adventurer';
  formData.level = 1;
  formData.breed = 'Solitus';
  formData.faction = 'Neutral';
  formData.expansion = 'Lost Eden';
  formData.accountType = 'Paid';
  formData.setAsActive = true;
  errors.value = {};
}
</script>

<style scoped>
.field {
  margin-bottom: 1rem;
}

.field label {
  display: block;
  margin-bottom: 0.5rem;
}
</style>

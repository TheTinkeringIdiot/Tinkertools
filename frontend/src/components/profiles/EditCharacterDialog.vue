<!--
EditCharacterDialog - Modal dialog for editing character metadata
Allows editing of name, level, profession, breed, faction, and account type
-->
<template>
  <Dialog 
    v-model:visible="dialogVisible" 
    modal 
    header="Edit Character Information"
    :style="{ width: '32rem' }"
    :closable="true"
    @hide="onCancel"
  >
    <form @submit.prevent="onSave" class="space-y-4">
      <!-- Character Name -->
      <div class="field">
        <label for="characterName" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Character Name <span class="text-red-500">*</span>
        </label>
        <InputText 
          id="characterName"
          v-model="formData.name"
          :class="{ 'p-invalid': errors.name }"
          placeholder="Enter character name"
          class="w-full"
          maxlength="50"
          required
        />
        <small v-if="errors.name" class="p-error">{{ errors.name }}</small>
      </div>

      <!-- Level -->
      <div class="field">
        <label for="level" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Level <span class="text-red-500">*</span>
        </label>
        <InputNumber 
          id="level"
          v-model="formData.level"
          :class="{ 'p-invalid': errors.level }"
          :min="1"
          :max="220"
          class="w-full"
          placeholder="1-220"
          show-buttons
          required
        />
        <small v-if="errors.level" class="p-error">{{ errors.level }}</small>
        <small v-else class="text-surface-500 dark:text-surface-400">
          Valid range: 1-220
        </small>
      </div>

      <!-- Profession -->
      <div class="field">
        <label for="profession" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Profession <span class="text-red-500">*</span>
        </label>
        <Dropdown 
          id="profession"
          v-model="formData.profession"
          :options="professionOptions"
          option-label="name"
          option-value="id"
          :class="{ 'p-invalid': errors.profession }"
          placeholder="Select profession"
          class="w-full"
          required
        />
        <small v-if="errors.profession" class="p-error">{{ errors.profession }}</small>
        <small v-if="formData.profession !== originalData.profession" class="text-orange-600 dark:text-orange-400">
          ⚠️ Changing profession will recalculate skill IP costs
        </small>
      </div>

      <!-- Breed -->
      <div class="field">
        <label for="breed" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Breed <span class="text-red-500">*</span>
        </label>
        <Dropdown 
          id="breed"
          v-model="formData.breed"
          :options="breedOptions"
          option-label="name"
          option-value="id"
          :class="{ 'p-invalid': errors.breed }"
          placeholder="Select breed"
          class="w-full"
          required
        />
        <small v-if="errors.breed" class="p-error">{{ errors.breed }}</small>
        <small v-if="formData.breed !== originalData.breed" class="text-red-600 dark:text-red-400">
          ⚠️ Changing breed will reset base ability values and recalculate IP costs
        </small>
      </div>

      <!-- Faction -->
      <div class="field">
        <label for="faction" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Faction <span class="text-red-500">*</span>
        </label>
        <Dropdown 
          id="faction"
          v-model="formData.faction"
          :options="factionOptions"
          option-label="name"
          option-value="name"
          :class="{ 'p-invalid': errors.faction }"
          placeholder="Select faction"
          class="w-full"
          required
        />
        <small v-if="errors.faction" class="p-error">{{ errors.faction }}</small>
      </div>

      <!-- Account Type -->
      <div class="field">
        <label for="accountType" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Account Type
        </label>
        <Dropdown 
          id="accountType"
          v-model="formData.accountType"
          :options="accountTypeOptions"
          option-label="name"
          option-value="value"
          placeholder="Select account type"
          class="w-full"
        />
      </div>

      <!-- Warning Message -->
      <div v-if="hasSignificantChanges" class="p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
        <div class="flex items-start gap-3">
          <i class="pi pi-exclamation-triangle text-orange-600 dark:text-orange-400 mt-1"></i>
          <div>
            <h4 class="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
              Important Changes Detected
            </h4>
            <ul class="text-sm text-orange-700 dark:text-orange-300 space-y-1">
              <li v-if="formData.breed !== originalData.breed">
                • Breed change will reset base ability values to {{ getBreedName(formData.breed) }} defaults
              </li>
              <li v-if="formData.profession !== originalData.profession">
                • Profession change will recalculate skill improvement point costs
              </li>
              <li v-if="formData.level !== originalData.level">
                • Level change will update available IP and skill/ability caps
              </li>
            </ul>
            <p class="text-sm text-orange-700 dark:text-orange-300 mt-2 font-medium">
              Your current improvements will be preserved, but costs may change.
            </p>
          </div>
        </div>
      </div>
    </form>

    <!-- Dialog Footer -->
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button 
          label="Cancel" 
          severity="secondary" 
          outlined
          @click="onCancel"
        />
        <Button 
          label="Save Changes" 
          severity="primary"
          :loading="saving"
          @click="onSave"
          :disabled="!isFormValid"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Dropdown from 'primevue/dropdown';
import Button from 'primevue/button';
import { PROFESSION_NAMES, BREED_NAMES } from '@/services/game-data';

// Props
const props = defineProps<{
  visible: boolean;
  profile: any; // TinkerProfile
}>();

// Emits
const emit = defineEmits<{
  'update:visible': [value: boolean];
  'save': [changes: CharacterChanges];
}>();

// Types
interface CharacterChanges {
  name?: string;
  level?: number;
  profession?: string;
  breed?: string;
  faction?: string;
  accountType?: string;
}

interface FormData {
  name: string;
  level: number;
  profession: number;
  breed: number;
  faction: string;
  accountType: string;
}

// State
const dialogVisible = ref(false);
const saving = ref(false);
const formData = ref<FormData>({
  name: '',
  level: 1,
  profession: 0,
  breed: 0,
  faction: 'Neutral',
  accountType: 'Free'
});

const originalData = ref<FormData>({
  name: '',
  level: 1,
  profession: 0,
  breed: 0,
  faction: 'Neutral',
  accountType: 'Free'
});

const errors = ref<Partial<FormData>>({});

// Options
const professionOptions = PROFESSION_NAMES.map((name, index) => ({
  id: index,
  name
}));

const breedOptions = BREED_NAMES.map((name, index) => ({
  id: index,
  name
}));

const factionOptions = [
  { name: 'Omni' },
  { name: 'Clan' },
  { name: 'Neutral' }
];

const accountTypeOptions = [
  { name: 'Free', value: 'Free' },
  { name: 'Paid', value: 'Paid' }
];

// Computed
const hasSignificantChanges = computed(() => {
  return formData.value.breed !== originalData.value.breed ||
         formData.value.profession !== originalData.value.profession ||
         formData.value.level !== originalData.value.level;
});

const isFormValid = computed(() => {
  return formData.value.name.trim().length > 0 &&
         formData.value.level >= 1 &&
         formData.value.level <= 220 &&
         formData.value.profession >= 0 &&
         formData.value.breed >= 0 &&
         formData.value.faction.length > 0 &&
         Object.keys(errors.value).length === 0;
});

// Watchers
watch(() => props.visible, (visible) => {
  dialogVisible.value = visible;
  if (visible) {
    initializeForm();
  }
});

watch(dialogVisible, (visible) => {
  emit('update:visible', visible);
});

// Watch form fields for validation
watch(() => formData.value.name, validateName);
watch(() => formData.value.level, validateLevel);

// Methods
function initializeForm(): void {
  if (!props.profile?.Character) return;

  const character = props.profile.Character;
  const profession = getProfessionId(character.Profession);
  const breed = getBreedId(character.Breed);

  const data: FormData = {
    name: character.Name || '',
    level: character.Level || 1,
    profession: profession !== null ? profession : 0,
    breed: breed !== null ? breed : 0,
    faction: character.Faction || 'Neutral',
    accountType: character.AccountType || 'Free'
  };

  formData.value = { ...data };
  originalData.value = { ...data };
  errors.value = {};
}

function validateName(): void {
  const name = formData.value.name?.trim();
  if (!name || name.length === 0) {
    errors.value.name = 'Character name is required';
  } else if (name.length > 50) {
    errors.value.name = 'Character name must be 50 characters or less';
  } else {
    delete errors.value.name;
  }
}

function validateLevel(): void {
  const level = formData.value.level;
  if (!level || level < 1) {
    errors.value.level = 'Level must be at least 1';
  } else if (level > 220) {
    errors.value.level = 'Level cannot exceed 220';
  } else {
    delete errors.value.level;
  }
}

function getProfessionId(professionName: string): number | null {
  const index = PROFESSION_NAMES.findIndex(name => 
    name.toLowerCase() === professionName.toLowerCase()
  );
  return index >= 0 ? index : null;
}

function getBreedId(breedName: string): number | null {
  const index = BREED_NAMES.findIndex(name => 
    name.toLowerCase() === breedName.toLowerCase()
  );
  return index >= 0 ? index : null;
}

function getBreedName(breedId: number): string {
  return BREED_NAMES[breedId] || 'Unknown';
}

function getProfessionName(professionId: number): string {
  return PROFESSION_NAMES[professionId] || 'Unknown';
}

async function onSave(): Promise<void> {
  if (!isFormValid.value) return;

  try {
    saving.value = true;

    // Build changes object with only modified fields
    const changes: CharacterChanges = {};

    if (formData.value.name !== originalData.value.name) {
      changes.name = formData.value.name.trim();
    }
    
    if (formData.value.level !== originalData.value.level) {
      changes.level = formData.value.level;
    }
    
    if (formData.value.profession !== originalData.value.profession) {
      changes.profession = getProfessionName(formData.value.profession);
    }
    
    if (formData.value.breed !== originalData.value.breed) {
      changes.breed = getBreedName(formData.value.breed);
    }
    
    if (formData.value.faction !== originalData.value.faction) {
      changes.faction = formData.value.faction;
    }
    
    if (formData.value.accountType !== originalData.value.accountType) {
      changes.accountType = formData.value.accountType;
    }

    // Emit the save event with changes
    emit('save', changes);

    // Close dialog
    dialogVisible.value = false;

  } catch (error) {
    console.error('Error saving character changes:', error);
  } finally {
    saving.value = false;
  }
}

function onCancel(): void {
  dialogVisible.value = false;
  // Reset form to original values
  if (originalData.value) {
    formData.value = { ...originalData.value };
  }
  errors.value = {};
}
</script>

<style scoped>
.field {
  @apply mb-4;
}

.field label {
  @apply block text-sm font-medium mb-1;
}

.field small {
  @apply block mt-1 text-xs;
}

/* Form validation styles */
:deep(.p-invalid) {
  @apply border-red-500 dark:border-red-400;
}

:deep(.p-invalid:focus) {
  @apply border-red-500 dark:border-red-400 shadow-red-200 dark:shadow-red-800;
}

.p-error {
  @apply text-red-600 dark:text-red-400;
}
</style>
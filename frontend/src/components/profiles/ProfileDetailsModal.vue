<!--
Profile Details Modal
Modal for viewing and editing detailed profile information
-->
<template>
  <Dialog
    :visible="visible"
    modal
    :header="`Profile Details - ${profileData?.Character?.Name || 'Unknown'}`"
    :style="{ width: '90vw', maxWidth: '1000px', height: '90vh' }"
    maximizable
    @update:visible="$emit('update:visible', $event)"
  >
    <div v-if="loading" class="flex items-center justify-center h-64">
      <ProgressSpinner />
    </div>
    
    <div v-else-if="!profileData" class="flex items-center justify-center h-64">
      <div class="text-center">
        <i class="pi pi-exclamation-triangle text-4xl text-orange-500 mb-4"></i>
        <p class="text-surface-600 dark:text-surface-400">Failed to load profile data</p>
      </div>
    </div>
    
    <div v-else class="h-full flex flex-col">
      <!-- Header Actions -->
      <div class="flex justify-between items-center mb-4 pb-4 border-b border-surface-200 dark:border-surface-700">
        <div class="flex items-center gap-2">
          <Button
            v-if="!editing"
            @click="startEditing"
            label="Edit Profile"
            icon="pi pi-pencil"
            size="small"
          />
          <div v-else class="flex gap-2">
            <Button
              @click="saveChanges"
              label="Save Changes"
              icon="pi pi-check"
              size="small"
              :loading="saving"
            />
            <Button
              @click="cancelEditing"
              label="Cancel"
              icon="pi pi-times"
              size="small"
              severity="secondary"
              outlined
            />
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <Button
            @click="validateProfile"
            label="Validate"
            icon="pi pi-shield"
            size="small"
            severity="info"
            outlined
          />
          <Button
            @click="exportProfile"
            label="Export"
            icon="pi pi-download"
            size="small"
            severity="secondary"
            outlined
          />
        </div>
      </div>
      
      <!-- Profile Content -->
      <div class="flex-1 overflow-auto">
        <TabView class="h-full profile-tabs">
          <!-- Character Info Tab -->
          <TabPanel header="Character">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Basic Info -->
              <div class="space-y-4">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4">
                  Basic Information
                </h3>
                
                <div class="field">
                  <label class="font-medium text-surface-900 dark:text-surface-50">Name</label>
                  <InputText
                    v-if="editing"
                    v-model="editData.Character.Name"
                    class="w-full"
                    maxlength="50"
                  />
                  <p v-else class="text-surface-700 dark:text-surface-300">
                    {{ profileData.Character.Name }}
                  </p>
                </div>
                
                <div class="field">
                  <label class="font-medium text-surface-900 dark:text-surface-50">Level</label>
                  <InputNumber
                    v-if="editing"
                    v-model="editData.Character.Level"
                    :min="1"
                    :max="220"
                    class="w-full"
                  />
                  <p v-else class="text-surface-700 dark:text-surface-300">
                    {{ profileData.Character.Level }}
                  </p>
                </div>
                
                <div class="field">
                  <label class="font-medium text-surface-900 dark:text-surface-50">Profession</label>
                  <Dropdown
                    v-if="editing"
                    v-model="editData.Character.Profession"
                    :options="professionOptions"
                    class="w-full"
                  />
                  <p v-else class="text-surface-700 dark:text-surface-300">
                    {{ getProfessionName(profileData.Character.Profession) }}
                  </p>
                </div>

                <div class="field">
                  <label class="font-medium text-surface-900 dark:text-surface-50">Breed</label>
                  <Dropdown
                    v-if="editing"
                    v-model="editData.Character.Breed"
                    :options="breedOptions"
                    class="w-full"
                  />
                  <p v-else class="text-surface-700 dark:text-surface-300">
                    {{ getBreedName(profileData.Character.Breed) }}
                  </p>
                </div>
              </div>
              
              <!-- Additional Info -->
              <div class="space-y-4">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4">
                  Additional Information
                </h3>
                
                <div class="field">
                  <label class="font-medium text-surface-900 dark:text-surface-50">Faction</label>
                  <Dropdown
                    v-if="editing"
                    v-model="editData.Character.Faction"
                    :options="factionOptions"
                    class="w-full"
                  />
                  <p v-else class="text-surface-700 dark:text-surface-300">
                    {{ profileData.Character.Faction }}
                  </p>
                </div>
                
                <div class="field">
                  <label class="font-medium text-surface-900 dark:text-surface-50">Expansion</label>
                  <Dropdown
                    v-if="editing"
                    v-model="editData.Character.Expansion"
                    :options="expansionOptions"
                    class="w-full"
                  />
                  <p v-else class="text-surface-700 dark:text-surface-300">
                    {{ profileData.Character.Expansion }}
                  </p>
                </div>
                
                <div class="field">
                  <label class="font-medium text-surface-900 dark:text-surface-50">Account Type</label>
                  <Dropdown
                    v-if="editing"
                    v-model="editData.Character.AccountType"
                    :options="accountTypeOptions"
                    class="w-full"
                  />
                  <p v-else class="text-surface-700 dark:text-surface-300">
                    {{ profileData.Character.AccountType }}
                  </p>
                </div>
              </div>
            </div>
          </TabPanel>
          
          <!-- Skills Tab -->
          <TabPanel header="Skills">
            <div class="skills-editor">
              <div v-for="(category, categoryName) in displayableSkills" :key="categoryName" class="mb-6">
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-3">
                  {{ categoryName }}
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  <div v-for="(value, skillName) in category" :key="skillName" class="field">
                    <label class="text-sm font-medium text-surface-600 dark:text-surface-400">
                      {{ skillName }}
                    </label>
                    <InputNumber
                      v-if="editing"
                      v-model="getSkillValue(skillName)"
                      :min="0"
                      :max="9999"
                      class="w-full"
                      size="small"
                      @update:model-value="updateSkillValue(skillName, $event)"
                    />
                    <p v-else class="text-sm text-surface-700 dark:text-surface-300">
                      {{ value }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>
          
          <!-- Equipment Tab -->
          <TabPanel header="Equipment">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <!-- Weapons -->
              <div>
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-3">
                  Weapons
                </h3>
                <div class="space-y-2">
                  <div v-for="(item, slotName) in profileData.Weapons" :key="slotName" class="flex justify-between items-center py-2 border-b border-surface-100 dark:border-surface-800">
                    <span class="font-medium text-surface-700 dark:text-surface-300">{{ slotName }}</span>
                    <span class="text-surface-600 dark:text-surface-400">
                      {{ item ? 'Equipped' : 'Empty' }}
                    </span>
                  </div>
                </div>
              </div>
              
              <!-- Clothing -->
              <div>
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-3">
                  Clothing
                </h3>
                <div class="space-y-2">
                  <div v-for="(item, slotName) in profileData.Clothing" :key="slotName" class="flex justify-between items-center py-2 border-b border-surface-100 dark:border-surface-800">
                    <span class="font-medium text-surface-700 dark:text-surface-300">{{ slotName }}</span>
                    <span class="text-surface-600 dark:text-surface-400">
                      {{ item ? 'Equipped' : 'Empty' }}
                    </span>
                  </div>
                </div>
              </div>
              
              <!-- Implants -->
              <div>
                <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-3">
                  Implants
                </h3>
                <div class="space-y-2">
                  <div v-for="(item, slotName) in profileData.Implants" :key="slotName" class="flex justify-between items-center py-2 border-b border-surface-100 dark:border-surface-800">
                    <span class="font-medium text-surface-700 dark:text-surface-300">{{ slotName }}</span>
                    <span class="text-surface-600 dark:text-surface-400">
                      {{ item ? 'Equipped' : 'Empty' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>
          
          <!-- Metadata Tab -->
          <TabPanel header="Metadata">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-4">
                <div class="field">
                  <label class="font-medium text-surface-900 dark:text-surface-50">Profile ID</label>
                  <p class="text-surface-700 dark:text-surface-300 font-mono text-sm">
                    {{ profileData.id }}
                  </p>
                </div>
                
                <div class="field">
                  <label class="font-medium text-surface-900 dark:text-surface-50">Version</label>
                  <p class="text-surface-700 dark:text-surface-300">
                    {{ profileData.version }}
                  </p>
                </div>
                
                <div class="field">
                  <label class="font-medium text-surface-900 dark:text-surface-50">Created</label>
                  <p class="text-surface-700 dark:text-surface-300">
                    {{ formatDateTime(profileData.created) }}
                  </p>
                </div>
                
                <div class="field">
                  <label class="font-medium text-surface-900 dark:text-surface-50">Last Updated</label>
                  <p class="text-surface-700 dark:text-surface-300">
                    {{ formatDateTime(profileData.updated) }}
                  </p>
                </div>
              </div>
            </div>
          </TabPanel>
        </TabView>
      </div>
    </div>
    
    <!-- Validation Results Dialog -->
    <Dialog
      :visible="showValidationResults"
      modal
      header="Profile Validation Results"
      :style="{ width: '600px' }"
      @update:visible="showValidationResults = $event"
    >
      <div v-if="validationResults" class="space-y-4">
        <div v-if="validationResults.valid" class="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <i class="pi pi-check-circle text-green-600 dark:text-green-400"></i>
          <span class="text-green-700 dark:text-green-300 font-medium">Profile is valid!</span>
        </div>
        
        <div v-if="validationResults.errors.length > 0">
          <h4 class="font-semibold text-red-700 dark:text-red-400 mb-2">Errors:</h4>
          <ul class="list-disc list-inside space-y-1">
            <li v-for="error in validationResults.errors" :key="error" class="text-red-600 dark:text-red-400 text-sm">
              {{ error }}
            </li>
          </ul>
        </div>
        
        <div v-if="validationResults.warnings.length > 0">
          <h4 class="font-semibold text-orange-700 dark:text-orange-400 mb-2">Warnings:</h4>
          <ul class="list-disc list-inside space-y-1">
            <li v-for="warning in validationResults.warnings" :key="warning" class="text-orange-600 dark:text-orange-400 text-sm">
              {{ warning }}
            </li>
          </ul>
        </div>
        
        <div v-if="validationResults.suggestions.length > 0">
          <h4 class="font-semibold text-blue-700 dark:text-blue-400 mb-2">Suggestions:</h4>
          <ul class="list-disc list-inside space-y-1">
            <li v-for="suggestion in validationResults.suggestions" :key="suggestion" class="text-blue-600 dark:text-blue-400 text-sm">
              {{ suggestion }}
            </li>
          </ul>
        </div>
      </div>
    </Dialog>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import ProgressSpinner from 'primevue/progressspinner';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import type { ProfileMetadata, TinkerProfile, ProfileValidationResult } from '@/lib/tinkerprofiles';
import {
  ANARCHY_PROFESSIONS,
  ANARCHY_BREEDS,
  ANARCHY_FACTIONS,
  ANARCHY_EXPANSIONS,
  ACCOUNT_TYPES
} from '@/lib/tinkerprofiles';
import { skillService } from '@/services/skill-service';
import type { SkillId } from '@/types/skills';
import { getProfessionName, getBreedName } from '@/services/game-utils';

// Props & Emits
const props = defineProps<{
  visible: boolean;
  profile: ProfileMetadata | null;
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  'updated': [];
}>();

// Services
const profilesStore = useTinkerProfilesStore();

// State
const loading = ref(false);
const saving = ref(false);
const editing = ref(false);
const profileData = ref<TinkerProfile | null>(null);
const editData = ref<TinkerProfile | null>(null);
const showValidationResults = ref(false);
const validationResults = ref<ProfileValidationResult | null>(null);

// Options
const professionOptions = ANARCHY_PROFESSIONS.map(p => p);
const breedOptions = ANARCHY_BREEDS.map(b => b);
const factionOptions = ANARCHY_FACTIONS.map(f => f);
const expansionOptions = ANARCHY_EXPANSIONS.map(e => e);
const accountTypeOptions = ACCOUNT_TYPES.map(a => a);

// Computed
const displayableSkills = computed(() => {
  if (!profileData.value?.skills) return {};

  // Group skills by category for display
  const skillsByCategory: Record<string, Record<string, number>> = {};

  try {
    for (const [skillIdStr, skillData] of Object.entries(profileData.value.skills)) {
      const skillId = Number(skillIdStr) as SkillId;
      const metadata = skillService.getMetadata(skillId);

      // Skip Misc category as requested
      if (metadata.category === 'Misc') continue;

      if (!skillsByCategory[metadata.category]) {
        skillsByCategory[metadata.category] = {};
      }

      skillsByCategory[metadata.category][metadata.name] = skillData.total || 0;
    }
  } catch (error) {
    console.error('Error building displayable skills:', error);
    return {};
  }

  return skillsByCategory;
});

// Methods
async function loadProfileData() {
  if (!props.profile) return;
  
  loading.value = true;
  try {
    const profile = await profilesStore.loadProfile(props.profile.id);
    profileData.value = profile;
  } catch (error) {
    console.error('Failed to load profile data:', error);
  } finally {
    loading.value = false;
  }
}

function startEditing() {
  if (!profileData.value) return;
  // Use JSON clone for compatibility
  editData.value = JSON.parse(JSON.stringify(profileData.value));
  editing.value = true;
}

function cancelEditing() {
  editData.value = null;
  editing.value = false;
}

async function saveChanges() {
  if (!editData.value || !props.profile) return;
  
  saving.value = true;
  try {
    await profilesStore.updateProfile(props.profile.id, editData.value);
    profileData.value = editData.value;
    editing.value = false;
    editData.value = null;
    emit('updated');
  } catch (error) {
    console.error('Failed to save changes:', error);
  } finally {
    saving.value = false;
  }
}

async function validateProfile() {
  if (!props.profile) return;
  
  try {
    const result = await profilesStore.validateProfile(props.profile.id);
    validationResults.value = result;
    showValidationResults.value = true;
  } catch (error) {
    console.error('Failed to validate profile:', error);
  }
}

async function exportProfile() {
  if (!props.profile) return;
  
  try {
    const exported = await profilesStore.exportProfile(props.profile.id, 'json');
    
    // Create download
    const blob = new Blob([exported], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${props.profile.name}_profile.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Failed to export profile:', error);
  }
}

function formatDateTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString();
  } catch {
    return 'Unknown';
  }
}

// Skill value access helpers
function getSkillValue(skillName: string): number {
  if (!editData.value?.skills) return 0;

  try {
    const skillId = skillService.resolveId(skillName);
    return editData.value.skills[skillId]?.total || 0;
  } catch (error) {
    console.error(`Failed to resolve skill name "${skillName}":`, error);
    return 0;
  }
}

function updateSkillValue(skillName: string, value: number | null): void {
  if (!editData.value?.skills) return;

  try {
    const skillId = skillService.resolveId(skillName);
    if (!editData.value.skills[skillId]) {
      editData.value.skills[skillId] = {
        base: 0,
        total: 0,
        equipmentBonus: 0,
        perkBonus: 0,
        buffBonus: 0
      };
    }
    editData.value.skills[skillId].total = value || 0;
  } catch (error) {
    console.error(`Failed to update skill "${skillName}":`, error);
  }
}

// Watchers
watch(() => props.visible, (visible) => {
  if (visible && props.profile) {
    loadProfileData();
  } else {
    // Reset state when closing
    profileData.value = null;
    editData.value = null;
    editing.value = false;
  }
});

watch(() => props.profile, (profile) => {
  if (profile && props.visible) {
    loadProfileData();
  }
});
</script>

<style scoped>
.field {
  margin-bottom: 1rem;
}

.field label {
  display: block;
  margin-bottom: 0.5rem;
}

.skills-editor {
  max-height: 60vh;
  overflow-y: auto;
}

.profile-tabs :deep(.p-tabview-panels) {
  padding: 1rem 0;
  height: calc(100% - 50px);
  overflow-y: auto;
}
</style>
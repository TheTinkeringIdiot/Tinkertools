<!--
TinkerProfileDetail - Detailed profile view
Complete character management with skills, equipment, and IP tracking
-->
<template>
  <div class="tinker-profile-detail min-h-screen bg-surface-50 dark:bg-surface-950">
    <!-- Breadcrumb Header -->
    <div class="bg-surface-0 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 py-4">
      <div class="max-w-7xl mx-auto px-6">
        <nav class="flex items-center gap-2 text-sm mb-4" aria-label="Breadcrumb">
          <router-link 
            :to="{ name: 'TinkerProfiles' }"
            class="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            TinkerProfiles
          </router-link>
          <i class="pi pi-angle-right text-surface-400"></i>
          <span class="text-surface-700 dark:text-surface-300">
            {{ profileData?.Character?.Name || 'Loading...' }}
          </span>
        </nav>
        
        <!-- Profile Header -->
        <div v-if="profileData" class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
              <i :class="professionIcon" class="text-primary-600 dark:text-primary-400 text-2xl"></i>
            </div>
            
            <div>
              <div class="flex items-center gap-3 mb-1">
                <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
                  {{ profileData.Character.Name }}
                </h1>
                <Badge v-if="isActiveProfile" value="Active" severity="success" />
              </div>
              <div class="flex items-center gap-4 text-surface-600 dark:text-surface-400">
                <span>{{ profileData.Character.Profession }} Level {{ profileData.Character.Level }}</span>
                <span>{{ profileData.Character.Breed }}</span>
                <span>{{ profileData.Character.Faction }}</span>
              </div>
            </div>
          </div>
          
          <!-- Header Actions -->
          <div class="flex items-center gap-2">
            <Button
              icon="pi pi-pencil"
              label="Edit Character"
              severity="primary"
              outlined
              @click="showEditDialog = true"
            />
            <Button
              v-if="!isActiveProfile"
              icon="pi pi-check"
              label="Set Active"
              severity="success"
              outlined
              @click="setActiveProfile"
            />
            <Button
              icon="pi pi-clone"
              label="Duplicate"
              severity="secondary"
              outlined
              @click="duplicateProfile"
            />
            <Button
              icon="pi pi-download"
              label="Export"
              severity="secondary"
              outlined
              @click="exportProfile"
            />
          </div>
        </div>
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
        Failed to Load Profile
      </h3>
      <p class="text-surface-500 dark:text-surface-500 mb-4">{{ error }}</p>
      <Button label="Retry" @click="loadProfile" />
    </div>
    
    <!-- Profile Content -->
    <div v-else-if="profileData" class="max-w-7xl mx-auto px-6 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Left Column: Character Info & Equipment -->
        <div class="lg:col-span-1 space-y-6">
          <!-- Character Info Panel -->
          <CharacterInfoPanel :profile="profileData" />
          
          <!-- IP Tracker -->
          <IPTrackerPanel :profile="profileData" />
          
          <!-- Equipment Grid -->
          <EquipmentGrid :profile="profileData" />
        </div>
        
        <!-- Right Column: Skills Management -->
        <div class="lg:col-span-2">
          <div class="bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg">
            <!-- Skills Header -->
            <div class="p-6 border-b border-surface-200 dark:border-surface-700">
              <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-50">
                  Skills & Abilities
                </h2>
                
                <div class="flex items-center gap-2">
                  <Button
                    v-if="hasChanges"
                    icon="pi pi-undo"
                    label="Reset Changes"
                    severity="secondary"
                    outlined
                    size="small"
                    @click="resetChanges"
                  />
                  <Button
                    v-if="hasChanges"
                    icon="pi pi-check"
                    label="Save Changes"
                    size="small"
                    :loading="saving"
                    @click="saveChanges"
                  />
                  <Button
                    icon="pi pi-refresh"
                    severity="secondary"
                    outlined
                    size="small"
                    @click="recalculateIP"
                    :loading="recalculating"
                    v-tooltip.bottom="'Recalculate IP & Caps'"
                  />
                </div>
              </div>
              
              <!-- IP Summary -->
              <div v-if="profileData.IPTracker" class="mt-4 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
                <div class="flex items-center justify-between text-sm">
                  <div class="flex items-center gap-4">
                    <span class="text-surface-600 dark:text-surface-400">
                      Available IP: <strong class="text-surface-900 dark:text-surface-50">{{ profileData.IPTracker.totalAvailable }}</strong>
                    </span>
                    <span class="text-surface-600 dark:text-surface-400">
                      Used: <strong class="text-surface-900 dark:text-surface-50">{{ profileData.IPTracker.totalUsed }}</strong>
                    </span>
                    <span class="text-surface-600 dark:text-surface-400">
                      Remaining: <strong :class="remainingIPColor">{{ profileData.IPTracker.remaining }}</strong>
                    </span>
                  </div>
                  <div class="text-surface-600 dark:text-surface-400">
                    Efficiency: <strong class="text-surface-900 dark:text-surface-50">{{ profileData.IPTracker.efficiency }}%</strong>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Skills Content -->
            <div class="p-6">
              <SkillsManager 
                :profile="profileData"
                @skill-changed="handleSkillChange"
                @ability-changed="handleAbilityChange"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Edit Character Dialog -->
    <EditCharacterDialog
      v-model:visible="showEditDialog"
      :profile="profileData"
      @save="handleCharacterUpdate"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from 'primevue/button';
import Badge from 'primevue/badge';
import ProgressSpinner from 'primevue/progressspinner';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import CharacterInfoPanel from '@/components/profiles/CharacterInfoPanel.vue';
import IPTrackerPanel from '@/components/profiles/IPTrackerPanel.vue';
import EquipmentGrid from '@/components/profiles/equipment/EquipmentGrid.vue';
import SkillsManager from '@/components/profiles/skills/SkillsManager.vue';
import EditCharacterDialog from '@/components/profiles/EditCharacterDialog.vue';
import type { TinkerProfile } from '@/lib/tinkerprofiles';

// Router
const route = useRoute();
const router = useRouter();
const profilesStore = useTinkerProfilesStore();

// Props
const props = defineProps<{
  profileId: string;
}>();

// State
const loading = ref(false);
const saving = ref(false);
const recalculating = ref(false);
const error = ref<string | null>(null);
const profileData = ref<TinkerProfile | null>(null);
const hasChanges = ref(false);
const showEditDialog = ref(false);
const pendingChanges = ref<{
  skills: Record<string, Record<string, number>>;
  abilities: Record<string, number>;
}>({
  skills: {},
  abilities: {}
});

// Computed
const isActiveProfile = computed(() => 
  profilesStore.activeProfileId === props.profileId
);

const professionIcon = computed(() => {
  if (!profileData.value) return 'pi pi-user';
  
  const iconMap: Record<string, string> = {
    'Adventurer': 'pi pi-compass',
    'Agent': 'pi pi-eye-slash',
    'Bureaucrat': 'pi pi-briefcase',
    'Doctor': 'pi pi-heart',
    'Enforcer': 'pi pi-shield',
    'Engineer': 'pi pi-wrench',
    'Fixer': 'pi pi-bolt',
    'Keeper': 'pi pi-sun',
    'Martial Artist': 'pi pi-hand-fist',
    'Meta-Physicist': 'pi pi-sparkles',
    'Nano-Technician': 'pi pi-cog',
    'Soldier': 'pi pi-rifle',
    'Trader': 'pi pi-dollar',
    'Shade': 'pi pi-moon'
  };
  return iconMap[profileData.value.Character.Profession] || 'pi pi-user';
});

const remainingIPColor = computed(() => {
  if (!profileData.value?.IPTracker) return 'text-surface-900 dark:text-surface-50';
  
  const remaining = profileData.value.IPTracker.remaining;
  if (remaining < 0) return 'text-red-600 dark:text-red-400';
  if (remaining < 100) return 'text-orange-600 dark:text-orange-400';
  return 'text-green-600 dark:text-green-400';
});

// Methods
async function loadProfile() {
  loading.value = true;
  error.value = null;
  try {
    const profile = await profilesStore.loadProfile(props.profileId);
    if (profile) {
      profileData.value = profile;
      resetChanges();
    } else {
      error.value = 'Profile not found';
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load profile';
  } finally {
    loading.value = false;
  }
}

async function setActiveProfile() {
  try {
    await profilesStore.setActiveProfile(props.profileId);
  } catch (err) {
    console.error('Failed to set active profile:', err);
  }
}

async function duplicateProfile() {
  if (!profileData.value) return;
  
  try {
    const newName = `${profileData.value.Character.Name} (Copy)`;
    const newProfileId = await profilesStore.duplicateProfile(props.profileId, newName);
    
    // Navigate to the new profile
    router.push({
      name: 'TinkerProfileDetail',
      params: { profileId: newProfileId }
    });
  } catch (err) {
    console.error('Failed to duplicate profile:', err);
  }
}

async function exportProfile() {
  try {
    await profilesStore.exportProfile(props.profileId, 'json');
  } catch (err) {
    console.error('Failed to export profile:', err);
  }
}

async function recalculateIP() {
  recalculating.value = true;
  try {
    await profilesStore.recalculateProfileIP(props.profileId);
    await loadProfile(); // Reload to get updated data
  } catch (err) {
    console.error('Failed to recalculate IP:', err);
  } finally {
    recalculating.value = false;
  }
}

function handleSkillChange(category: string, skillName: string, newValue: number) {
  if (!pendingChanges.value.skills[category]) {
    pendingChanges.value.skills[category] = {};
  }
  pendingChanges.value.skills[category][skillName] = newValue;
  hasChanges.value = true;
}

function handleAbilityChange(abilityName: string, newValue: number) {
  pendingChanges.value.abilities[abilityName] = newValue;
  hasChanges.value = true;
}

function resetChanges() {
  pendingChanges.value = {
    skills: {},
    abilities: {}
  };
  hasChanges.value = false;
}

async function saveChanges() {
  if (!hasChanges.value || !profileData.value) return;
  
  saving.value = true;
  try {
    // Apply skill changes
    for (const [category, skills] of Object.entries(pendingChanges.value.skills)) {
      for (const [skillName, newValue] of Object.entries(skills)) {
        await profilesStore.modifySkill(props.profileId, category, skillName, newValue);
      }
    }
    
    // Apply ability changes with trickle-down feedback
    let totalTrickleDownChanges = 0;
    for (const [abilityName, newValue] of Object.entries(pendingChanges.value.abilities)) {
      const result = await profilesStore.modifyAbility(props.profileId, abilityName, newValue);
      
      if (result.success && result.trickleDownChanges) {
        // Count skills with meaningful trickle-down changes
        const changedSkills = Object.entries(result.trickleDownChanges).filter(
          ([_, change]) => Math.abs(change.new - change.old) > 0
        );
        totalTrickleDownChanges += changedSkills.length;
      }
    }
    
    // Show feedback about trickle-down updates
    if (totalTrickleDownChanges > 0) {
      showTrickleDownFeedback(totalTrickleDownChanges);
    }
    
    // Reload profile data
    await loadProfile();
    resetChanges();
    
  } catch (err) {
    console.error('Failed to save changes:', err);
    error.value = err instanceof Error ? err.message : 'Failed to save changes';
  } finally {
    saving.value = false;
  }
}

async function handleCharacterUpdate(changes: any) {
  if (!profileData.value) return;

  try {
    const result = await profilesStore.updateCharacterMetadata(props.profileId, changes);
    
    if (result.success) {
      // Reload profile to show updated data
      await loadProfile();
      showEditDialog.value = false;
      
      // Show success message if there are warnings
      if (result.warnings.length > 0) {
        console.info('Character updated with warnings:', result.warnings);
      }
      
      if (result.ipDelta !== undefined && result.ipDelta !== 0) {
        const change = result.ipDelta > 0 ? 'increased' : 'decreased';
        console.info(`IP usage ${change} by ${Math.abs(result.ipDelta)} points`);
      }
    } else {
      console.error('Failed to update character:', result.errors);
      error.value = result.errors.join(', ');
    }
  } catch (err) {
    console.error('Error updating character:', err);
    error.value = err instanceof Error ? err.message : 'Failed to update character';
  }
}

// Feedback functions
function showTrickleDownFeedback(affectedSkillsCount: number) {
  // Simple console feedback for now - could be enhanced with toast notifications
  console.info(`✨ Ability change updated trickle-down bonuses for ${affectedSkillsCount} skills`);
  
  // Could add a toast notification here if PrimeVue Toast is set up:
  // toast.add({
  //   severity: 'success',
  //   summary: 'Trickle-down Updated',
  //   detail: `${affectedSkillsCount} skills received updated bonuses from ability changes`,
  //   life: 3000
  // });
}

// Watchers
watch(() => props.profileId, () => {
  if (props.profileId) {
    loadProfile();
  }
}, { immediate: true });

// Handle browser navigation away with unsaved changes
window.addEventListener('beforeunload', (e) => {
  if (hasChanges.value) {
    e.preventDefault();
    e.returnValue = '';
  }
});
</script>

<style scoped>
.tinker-profile-detail {
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

/* Responsive adjustments */
@media (max-width: 1024px) {
  .max-w-7xl {
    @apply px-4;
  }
}

/* Skills section styling */
:deep(.skills-manager) {
  max-height: calc(100vh - 400px);
  overflow-y: auto;
}
</style>
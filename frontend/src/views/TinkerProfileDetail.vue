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
        <!-- Left Column: Character Info & IP Tracker -->
        <div class="lg:col-span-1 space-y-6">
          <!-- Character Info Panel -->
          <CharacterInfoPanel :profile="profileData" />
          
          <!-- IP Tracker -->
          <IPTrackerPanel :profile="profileData" />
          
        </div>
        
        <!-- Right Column: Tabbed Management -->
        <div class="lg:col-span-2">
          <div class="bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg h-full">
            <TabView
              v-model:activeIndex="activeTabIndex"
              class="h-full profile-tabs"
            >
              <!-- Equipment Tab -->
              <TabPanel>
                <template #header>
                  <div class="flex items-center gap-2">
                    <i class="pi pi-shield text-orange-500"></i>
                    <span>Equipment</span>
                  </div>
                </template>

                <div class="h-full p-6">
                  <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-50 mb-4">Equipment</h2>
                  <div class="grid grid-cols-3 gap-4">
                    <!-- Weapons -->
                    <div class="text-center">
                      <h3 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2 flex items-center justify-center gap-1">
                        <i class="pi pi-shield text-orange-500 text-xs"></i>
                        Weapons
                      </h3>
                      <EquipmentSlotsDisplay
                        :equipment="getEquippedWeapons(profileData.Weapons)"
                        :slot-type="'weapon'"
                        :show-labels="false"
                        @equipment-changed="handleEquipmentChange"
                      />
                    </div>

                    <!-- Armor -->
                    <div class="text-center">
                      <h3 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2 flex items-center justify-center gap-1">
                        <i class="pi pi-user text-blue-500 text-xs"></i>
                        Armor
                      </h3>
                      <EquipmentSlotsDisplay
                        :equipment="getEquippedArmor(profileData.Clothing)"
                        :slot-type="'armor'"
                        :show-labels="false"
                        @equipment-changed="handleEquipmentChange"
                      />
                    </div>

                    <!-- Implants -->
                    <div class="text-center">
                      <h3 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2 flex items-center justify-center gap-1">
                        <i class="pi pi-cpu text-green-500 text-xs"></i>
                        Implants
                      </h3>
                      <EquipmentSlotsDisplay
                        :equipment="getEquippedImplants(profileData.Implants)"
                        :slot-type="'implant'"
                        :show-labels="false"
                        @equipment-changed="handleEquipmentChange"
                      />
                    </div>
                  </div>

                  <!-- Buffs Section -->
                  <div class="mt-6">
                    <BuffTable
                      :buffs="profileData.buffs || []"
                      :currentNCU="profilesStore.currentNCU"
                      :maxNCU="profilesStore.maxNCU"
                      @remove-buff="handleRemoveBuff"
                      @remove-all-buffs="handleRemoveAllBuffs"
                    />
                  </div>
                </div>
              </TabPanel>

              <!-- Skills Tab -->
              <TabPanel>
                <template #header>
                  <div class="flex items-center gap-2">
                    <i class="pi pi-cog text-blue-500"></i>
                    <span>Skills</span>
                  </div>
                </template>

                <div class="h-full flex flex-col">
                  <!-- Skills Header -->
                  <div class="p-6 border-b border-surface-200 dark:border-surface-700">
                    <div class="flex items-center justify-between">
                      <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-50">
                        Skills & Abilities
                      </h2>
                    </div>

                    <!-- IP Summary -->
                    <div v-if="profileData.IPTracker" class="mt-4 p-3 bg-surface-50 dark:bg-surface-800 rounded-lg">
                      <div class="flex items-center gap-4 text-sm">
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
                    </div>
                  </div>

                  <!-- Skills Content -->
                  <div class="flex-1 p-6 overflow-y-auto">
                    <SkillsManager
                      :profile="profileData"
                      @skill-changed="handleSkillChange"
                      @ability-changed="handleAbilityChange"
                    />
                  </div>
                </div>
              </TabPanel>

              <!-- Perks Tab -->
              <TabPanel>
                <template #header>
                  <div class="flex items-center gap-2">
                    <i class="pi pi-star text-primary-500"></i>
                    <span>Perks</span>
                  </div>
                </template>

                <div class="h-full">
                  <!-- Use the new PerkTabs component -->
                  <PerkTabs :profile="profileData" />
                </div>
              </TabPanel>
            </TabView>
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
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import CharacterInfoPanel from '@/components/profiles/CharacterInfoPanel.vue';
import IPTrackerPanel from '@/components/profiles/IPTrackerPanel.vue';
import ItemSlotsDisplay from '@/components/items/ItemSlotsDisplay.vue';
import EquipmentSlotsDisplay from '@/components/items/EquipmentSlotsDisplay.vue';
import SkillsManager from '@/components/profiles/skills/SkillsManager.vue';
import EditCharacterDialog from '@/components/profiles/EditCharacterDialog.vue';
import PerkTabs from '@/components/profiles/perks/PerkTabs.vue';
import BuffTable from '@/components/profiles/buffs/BuffTable.vue';
import type { TinkerProfile } from '@/lib/tinkerprofiles';
import type { Item } from '@/types/api';
import { skillService } from '@/services/skill-service';
import type { SkillId } from '@/types/skills';

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
// Auto-save - no saving state needed
const error = ref<string | null>(null);
const profileData = ref<TinkerProfile | null>(null);
// Auto-save - no hasChanges tracking needed
const showEditDialog = ref(false);
// Auto-save - no pending changes tracking needed
const activeTabIndex = ref(0); // Track the active tab index

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
    // Update profileData to reflect the newly active profile
    const updatedProfile = profilesStore.activeProfile;
    if (updatedProfile && updatedProfile.id === props.profileId) {
      profileData.value = updatedProfile;
    }
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


async function handleSkillChange(category: string, skillId: string | number, newValue: number) {
  try {
    // Convert to number if it's a string ID
    const numericSkillId = typeof skillId === 'string' ? Number(skillId) : skillId;
    await profilesStore.modifySkill(props.profileId, numericSkillId, newValue);

    // Update local profileData from the viewed profile (not activeProfile)
    const updatedProfile = await profilesStore.loadProfile(props.profileId);
    if (updatedProfile) {
      profileData.value = updatedProfile;
    }
  } catch (err) {
    console.error('Failed to modify skill:', err);
    error.value = err instanceof Error ? err.message : 'Failed to modify skill';
  }
}

async function handleAbilityChange(abilityId: string | number, newValue: number) {
  try {
    // Convert to number if it's a string ID
    const numericAbilityId = typeof abilityId === 'string' ? Number(abilityId) : abilityId;
    await profilesStore.modifySkill(props.profileId, numericAbilityId, newValue);

    // Update local profileData from the viewed profile (not activeProfile)
    const updatedProfile = await profilesStore.loadProfile(props.profileId);
    if (updatedProfile) {
      profileData.value = updatedProfile;
    }

    // Show feedback about ability change
    const abilityName = skillService.getName(numericAbilityId);
    console.info(`✨ Ability ${abilityName} updated to ${newValue}`);
  } catch (err) {
    console.error('Failed to modify ability:', err);
    error.value = err instanceof Error ? err.message : 'Failed to modify ability';
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

// Handle equipment changes from unequip actions
async function handleEquipmentChange() {
  // Reload the profile to get updated equipment data
  await loadProfile();
}

// Handle buff removal events
async function handleRemoveBuff(buff: Item) {
  try {
    await profilesStore.removeBuff(buff.id);
  } catch (err) {
    console.error('Failed to remove buff:', err);
    error.value = err instanceof Error ? err.message : 'Failed to remove buff';
  }
}

async function handleRemoveAllBuffs() {
  try {
    await profilesStore.removeAllBuffs();
  } catch (err) {
    console.error('Failed to remove all buffs:', err);
    error.value = err instanceof Error ? err.message : 'Failed to remove all buffs';
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

// Equipment helper functions - now return complete equipment records
function getEquippedWeapons(weapons: Record<string, Item | null>) {
  return weapons || {};
}

function getEquippedArmor(clothing: Record<string, Item | null>) {
  return clothing || {};
}

function getEquippedImplants(implants: Record<string, Item | null>) {
  return implants || {};
}

// Watchers
watch(() => props.profileId, () => {
  if (props.profileId) {
    loadProfile();
  }
}, { immediate: true });

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

/* Profile tabs styling */
.profile-tabs {
  height: 100%;
}

.profile-tabs :deep(.p-tabview-panels) {
  height: calc(100% - 60px); /* Subtract tab header height */
  overflow: hidden;
}

.profile-tabs :deep(.p-tabview-panel) {
  height: 100%;
  padding: 0 !important;
}

/* Tab header styling */
.profile-tabs :deep(.p-tabview-nav-link) {
  padding: 1rem 1.5rem;
}
</style>
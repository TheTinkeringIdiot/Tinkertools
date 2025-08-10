<!--
TinkerNukes - Nanotechnician Offensive Nano Specialization Tool
Allows users to input skills and view usable offensive nanos in a sortable table
-->
<template>
  <div class="tinker-nukes h-full flex flex-col">
    <!-- Header with Profile Selection and Options -->
    <div class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="flex items-center gap-4">
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
            <i class="pi pi-sparkles mr-2" aria-hidden="true"></i>
            TinkerNukes
          </h1>
          <Badge 
            :value="usableNanos.length" 
            severity="success" 
            v-if="usableNanos.length > 0"
            :aria-label="`${usableNanos.length} usable offensive nanos found`"
          />
          <Badge 
            value="NT Only" 
            severity="warning" 
            aria-label="This tool is specialized for Nanotechnician profession only"
          />
        </div>
        
        <!-- Profile & Display Options -->
        <div class="flex flex-col sm:flex-row gap-3">
          <!-- Profile Selection -->
          <div class="flex items-center gap-2">
            <label 
              for="profile-select-nukes"
              class="text-sm font-medium text-surface-700 dark:text-surface-300"
            >
              Profile:
            </label>
            <Dropdown 
              id="profile-select-nukes"
              v-model="selectedProfile"
              :options="profileOptions"
              option-label="label"
              option-value="value"
              placeholder="Select Profile"
              class="w-40"
              aria-describedby="profile-help-nukes"
              @change="onProfileChange"
            />
            <span id="profile-help-nukes" class="sr-only">
              Select a Nanotechnician profile to check nano casting requirements
            </span>
          </div>
          
          <!-- Manual Skills Toggle -->
          <div class="flex items-center gap-2">
            <InputSwitch 
              v-model="useManualSkills"
              input-id="manual-skills-toggle"
              aria-describedby="manual-skills-help"
            />
            <label 
              for="manual-skills-toggle"
              class="text-sm text-surface-700 dark:text-surface-300"
            >
              Manual Skills
            </label>
            <span id="manual-skills-help" class="sr-only">
              Toggle to manually input your character's nano skills instead of using a profile
            </span>
          </div>
        </div>
      </div>

      <!-- Skill Input Section -->
      <div class="mt-4 p-4 bg-surface-100 dark:bg-surface-800 rounded-lg">
        <h3 class="text-lg font-semibold mb-3 text-surface-900 dark:text-surface-50">
          Nanotechnician Skills
        </h3>
        
        <!-- Manual Skills Input -->
        <div v-if="useManualSkills" class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div v-for="skill in nanoSkills" :key="skill.key" class="flex flex-col gap-1">
            <label class="text-xs font-medium text-surface-600 dark:text-surface-400">
              {{ skill.label }}
            </label>
            <InputNumber
              v-model="manualSkills[skill.key]"
              :min="1"
              :max="3000"
              :step="1"
              class="w-full"
              :class="getSkillInputClass(skill.key)"
            />
          </div>
        </div>
        
        <!-- Profile Skills Display -->
        <div v-else-if="activeProfile" class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div v-for="skill in nanoSkills" :key="skill.key" class="flex flex-col gap-1">
            <label class="text-xs font-medium text-surface-600 dark:text-surface-400">
              {{ skill.label }}
            </label>
            <div class="p-2 bg-surface-200 dark:bg-surface-700 rounded text-center font-mono">
              {{ getSkillValue(skill.key) || 1 }}
            </div>
          </div>
        </div>
        
        <!-- No Profile Selected -->
        <div v-else class="text-center py-6">
          <i class="pi pi-user text-3xl text-surface-400 mb-2"></i>
          <p class="text-surface-600 dark:text-surface-400">
            Select a profile or enable manual skills to view usable nanos
          </p>
        </div>
      </div>
    </div>

    <!-- Nano Table -->
    <div class="flex-1 p-4">
      <!-- Table Controls -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <span class="text-sm text-surface-600 dark:text-surface-400">
            {{ usableNanos.length }} usable offensive nanos
          </span>
          
          <!-- School Filter -->
          <Dropdown
            v-model="selectedSchool"
            :options="schoolOptions"
            placeholder="All Schools"
            showClear
            class="w-48"
          />
        </div>

        <!-- Search -->
        <div class="flex items-center gap-2">
          <i class="pi pi-search text-surface-400"></i>
          <InputText
            v-model="searchQuery"
            placeholder="Search nanos..."
            class="w-64"
          />
        </div>
      </div>

      <!-- Nano Table -->
      <DataTable 
        ref="tableRef"
        :value="filteredNanos"
        :loading="loading"
        paginator
        :rows="25"
        :rowsPerPageOptions="[25, 50, 100]"
        sortMode="multiple"
        class="nano-table"
        :globalFilter="searchQuery"
        data-keyboard-nav-container
        role="table"
        :aria-label="`Table showing ${filteredNanos.length} offensive nano programs. Use arrow keys to navigate, Enter to select.`"
      >
        <!-- Name Column -->
        <Column field="name" header="Nano" sortable class="min-w-48">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <i class="pi pi-sparkles text-primary-500"></i>
              <span class="font-medium">{{ data.name }}</span>
            </div>
          </template>
        </Column>

        <!-- School Column -->
        <Column field="school" header="School" sortable class="min-w-36">
          <template #body="{ data }">
            <Tag :value="data.school" severity="info" />
          </template>
        </Column>

        <!-- Level Column -->
        <Column field="level" header="Level" sortable class="w-24">
          <template #body="{ data }">
            <span class="font-mono">{{ data.level }}</span>
          </template>
        </Column>

        <!-- Memory Usage Column -->
        <Column field="memoryUsage" header="Memory" sortable class="w-24">
          <template #body="{ data }">
            <span class="font-mono text-xs">{{ data.memoryUsage || 'N/A' }}</span>
          </template>
        </Column>

        <!-- Nano Points Column -->
        <Column field="nanoPointCost" header="NP Cost" sortable class="w-24">
          <template #body="{ data }">
            <span class="font-mono text-xs">{{ data.nanoPointCost || 'N/A' }}</span>
          </template>
        </Column>

        <!-- Usability Column -->
        <Column header="Usability" class="w-32">
          <template #body="{ data }">
            <div class="flex items-center gap-2">
              <i :class="getUsabilityIcon(data)" class="text-sm"></i>
              <span class="text-xs font-medium" :class="getUsabilityColor(data)">
                {{ getUsabilityText(data) }}
              </span>
            </div>
          </template>
        </Column>

        <!-- Effects Column -->
        <Column header="Effects" class="min-w-64">
          <template #body="{ data }">
            <div class="flex flex-wrap gap-1">
              <Tag 
                v-for="effect in getOffensiveEffects(data)" 
                :key="effect" 
                :value="effect" 
                severity="danger"
                class="text-xs"
              />
            </div>
          </template>
        </Column>

        <!-- Empty State -->
        <template #empty>
          <div class="text-center py-12">
            <i class="pi pi-search text-4xl text-surface-400 mb-4"></i>
            <p class="text-lg text-surface-600 dark:text-surface-400">
              No usable offensive nanos found
            </p>
            <p class="text-sm text-surface-500 dark:text-surface-500">
              Adjust your skills or try different search criteria
            </p>
          </div>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useProfilesStore } from '@/stores/profilesStore';
import { useNanosStore } from '@/stores/nanosStore';
import { useAccessibility } from '@/composables/useAccessibility';
import { useTableKeyboardNavigation } from '@/composables/useKeyboardNavigation';
import Badge from 'primevue/badge';
import Dropdown from 'primevue/dropdown';
import InputSwitch from 'primevue/inputswitch';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Tag from 'primevue/tag';
import type { NanoProgram } from '@/types/nano';

// Stores
const profileStore = useProfilesStore();
const nanosStore = useNanosStore();

// Accessibility
const { announce, setLoading } = useAccessibility();
const tableRef = ref<HTMLElement>();

// Keyboard navigation for data table
const { focusFirst } = useTableKeyboardNavigation(tableRef, {
  onRowActivate: (rowIndex: number) => {
    const nano = filteredNanos.value[rowIndex];
    if (nano) {
      announce(`Selected nano: ${nano.name}`, 'polite');
    }
  }
});

// Reactive state
const selectedProfile = ref<string | null>(null);
const useManualSkills = ref(false);
const selectedSchool = ref<string | null>(null);
const searchQuery = ref('');
const loading = ref(false);

// Manual skills input
const manualSkills = ref<Record<string, number>>({
  matter_metamorphosis: 1,
  biological_metamorphosis: 1,
  psychological_modifications: 1,
  matter_creation: 1,
  time_and_space: 1,
  sensory_improvement: 1,
  nano_pool: 1,
  computer_literacy: 1
});

// Nano skills configuration
const nanoSkills = [
  { key: 'matter_metamorphosis', label: 'Matter Meta' },
  { key: 'biological_metamorphosis', label: 'Bio Meta' },
  { key: 'psychological_modifications', label: 'Psych Modi' },
  { key: 'matter_creation', label: 'Matter Creat' },
  { key: 'time_and_space', label: 'Time & Space' },
  { key: 'sensory_improvement', label: 'Sensory Imp' },
  { key: 'nano_pool', label: 'Nano Pool' },
  { key: 'computer_literacy', label: 'Comp Lit' }
];

// Computed properties
const activeProfile = computed(() => {
  if (!selectedProfile.value) return null;
  return profileStore.profiles.find(p => p?.name === selectedProfile.value);
});

const profileOptions = computed(() => [
  { label: 'None', value: null },
  ...profileStore.profiles
    .filter((profile: any) => profile?.profession === 'Nanotechnician')
    .map((profile: any) => ({
      label: `${profile.name} (${profile.level})`,
      value: profile.name
    }))
]);

const currentSkills = computed(() => {
  if (useManualSkills.value) {
    return manualSkills.value;
  }
  
  if (activeProfile.value) {
    const skills = (activeProfile.value as any).skills;
    return {
      matter_metamorphosis: skills['Matter Metamorphosis'] || 1,
      biological_metamorphosis: skills['Biological Metamorphosis'] || 1,
      psychological_modifications: skills['Psychological Modifications'] || 1,
      matter_creation: skills['Matter Creation'] || 1,
      time_and_space: skills['Time and Space'] || 1,
      sensory_improvement: skills['Sensory Improvement'] || 1,
      nano_pool: skills['Nano Pool'] || 1,
      computer_literacy: skills['Computer Literacy'] || 1
    };
  }
  
  return {};
});

// Get only offensive nanos (damage effects) for Nanotechnician
const offensiveNanos = computed(() => {
  return nanosStore.nanos.filter(nano => {
    // Must be Nanotechnician profession
    if (nano.profession && nano.profession !== 'Nanotechnician') {
      return false;
    }
    
    // Must have offensive effects
    const hasOffensiveEffect = nano.effects?.some(effect => 
      effect.type === 'damage' || 
      effect.type === 'debuff' ||
      (effect.type === 'utility' && effect.statId?.toString().includes('damage'))
    );
    
    return hasOffensiveEffect;
  });
});

const usableNanos = computed(() => {
  const skills = currentSkills.value;
  if (!skills || Object.keys(skills).length === 0) {
    return [];
  }

  return offensiveNanos.value.filter(nano => {
    if (!nano.castingRequirements) return true;
    
    return nano.castingRequirements.every(req => {
      if (req.type === 'skill') {
        const skillKey = req.requirement as string;
        const skillValue = (skills as any)[skillKey] || 1;
        return skillValue >= req.value;
      }
      return true; // Non-skill requirements are considered met for now
    });
  });
});

const schoolOptions = computed(() => {
  const schools = [...new Set(offensiveNanos.value.map(nano => nano.school))];
  return schools.map(school => ({ label: school, value: school }));
});

const filteredNanos = computed(() => {
  let filtered = usableNanos.value;
  
  if (selectedSchool.value) {
    filtered = filtered.filter(nano => nano.school === selectedSchool.value);
  }
  
  return filtered;
});

// Methods
function onProfileChange() {
  if (selectedProfile.value) {
    useManualSkills.value = false;
  }
}

function getSkillValue(skillKey: string): number {
  return (currentSkills.value as any)[skillKey] || 1;
}

function getSkillInputClass(skillKey: string): string {
  const value = manualSkills.value[skillKey];
  if (value >= 1000) return 'skill-high';
  if (value >= 500) return 'skill-medium';
  return 'skill-low';
}

function getUsabilityIcon(nano: NanoProgram): string {
  // For now, all displayed nanos are usable
  return 'pi pi-check-circle text-green-500';
}

function getUsabilityColor(nano: NanoProgram): string {
  return 'text-green-600 dark:text-green-400';
}

function getUsabilityText(nano: NanoProgram): string {
  return 'Usable';
}

function getOffensiveEffects(nano: NanoProgram): string[] {
  if (!nano.effects) return [];
  
  return nano.effects
    .filter(effect => effect.type === 'damage' || effect.type === 'debuff')
    .map(effect => {
      if (effect.type === 'damage') return 'Damage';
      if (effect.type === 'debuff') return 'Debuff';
      return effect.type;
    });
}

// Lifecycle
onMounted(async () => {
  setLoading(true, 'Loading nano programs and profiles');
  try {
    // Load nanos if not already loaded
    if (nanosStore.nanos.length === 0) {
      await nanosStore.fetchNanos();
    }
    await profileStore.loadProfiles();
    announce(`Loaded ${offensiveNanos.value.length} offensive nano programs for Nanotechnicians`);
  } catch (error) {
    console.error('Failed to load data:', error);
    announce('Failed to load data. Please refresh the page and try again.', 'assertive');
  } finally {
    setLoading(false);
  }
});
</script>

<style scoped>
.nano-table :deep(.p-datatable-tbody tr td) {
  padding: 0.75rem 0.5rem;
}

.skill-high :deep(.p-inputnumber-input) {
  border-color: #10b981;
  background-color: rgba(16, 185, 129, 0.1);
}

.skill-medium :deep(.p-inputnumber-input) {
  border-color: #f59e0b;
  background-color: rgba(245, 158, 11, 0.1);
}

.skill-low :deep(.p-inputnumber-input) {
  border-color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
}
</style>
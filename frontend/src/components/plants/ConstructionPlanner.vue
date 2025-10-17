<!--
TinkerPlants Construction Planner Component
Advanced implant construction analysis and step-by-step instructions
-->
<template>
  <div class="construction-planner space-y-6">
    <!-- Skill Input Section -->
    <div class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4 flex items-center gap-2">
        <i class="pi pi-user text-primary-500"></i>
        Character Skills
      </h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Core Skills -->
        <div class="space-y-3">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
            Nanoprogramming *
          </label>
          <InputNumber
            v-model="localSkills.Nanoprogramming"
            :min="0"
            :max="9999"
            :use-grouping="false"
            class="w-full"
            placeholder="Required"
            @input="onSkillChange"
          />
        </div>
        
        <div class="space-y-3">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
            Break & Entry *
          </label>
          <InputNumber
            v-model="localSkills['Break & Entry']"
            :min="0"
            :max="9999"
            :use-grouping="false"
            class="w-full"
            placeholder="Required"
            @input="onSkillChange"
          />
        </div>
        
        <!-- Jobe Skills -->
        <div class="space-y-3">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
            Psychology
          </label>
          <InputNumber
            v-model="localSkills.Psychology"
            :min="0"
            :max="9999"
            :use-grouping="false"
            class="w-full"
            placeholder="For Jobe clusters"
            @input="onSkillChange"
          />
        </div>
        
        <div class="space-y-3">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
            Quantum FT
          </label>
          <InputNumber
            v-model="localSkills['Quantum FT']"
            :min="0"
            :max="9999"
            :use-grouping="false"
            class="w-full"
            placeholder="For Jobe clusters"
            @input="onSkillChange"
          />
        </div>
        
        <div class="space-y-3">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
            Computer Literacy
          </label>
          <InputNumber
            v-model="localSkills['Computer Literacy']"
            :min="0"
            :max="9999"
            :use-grouping="false"
            class="w-full"
            placeholder="For Jobe clusters"
            @input="onSkillChange"
          />
        </div>
        
        <div class="space-y-3">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
            Pharma Tech
          </label>
          <InputNumber
            v-model="localSkills['Pharma Tech']"
            :min="0"
            :max="9999"
            :use-grouping="false"
            class="w-full"
            placeholder="For Jobe clusters"
            @input="onSkillChange"
          />
        </div>
      </div>
      
      <!-- Skill Status -->
      <div class="mt-4 flex items-center gap-2">
        <div v-if="hasValidSkills" class="flex items-center gap-2 text-green-600 dark:text-green-400">
          <i class="pi pi-check-circle"></i>
          <span class="text-sm">Ready for construction analysis</span>
        </div>
        <div v-else class="flex items-center gap-2 text-orange-600 dark:text-orange-400">
          <i class="pi pi-exclamation-triangle"></i>
          <span class="text-sm">Enter Nanoprogramming and Break & Entry skills to continue</span>
        </div>
      </div>
    </div>

    <!-- Implant Selection Section -->
    <div class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-6">
      <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4 flex items-center gap-2">
        <i class="pi pi-cog text-primary-500"></i>
        Implant Selection
      </h3>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="space-y-3">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
            Select Implant Slot
          </label>
          <Dropdown
            v-model="selectedSlotLocal"
            :options="availableSlots"
            option-label="label"
            option-value="value"
            placeholder="Choose implant slot to analyze"
            class="w-full"
            @change="onSlotChange"
          />
        </div>
        
        <div class="space-y-3">
          <label class="text-sm font-medium text-surface-700 dark:text-surface-300">
            Auto-analyze
          </label>
          <div class="flex items-center gap-2">
            <ToggleButton
              v-model="autoAnalyze"
              on-label="Enabled"
              off-label="Disabled"
              on-icon="pi pi-check"
              off-icon="pi pi-times"
              class="w-32"
              @change="setAutoAnalysis($event.value)"
            />
            <span class="text-xs text-surface-600 dark:text-surface-400">
              Auto-analyze when configuration changes
            </span>
          </div>
        </div>
      </div>
      
      <!-- Current Configuration Display -->
      <div v-if="selectedImplantConfig" class="mt-4 p-4 bg-surface-50 dark:bg-surface-900 rounded border">
        <h4 class="font-medium text-surface-900 dark:text-surface-50 mb-2">
          Current Configuration: {{ selectedSlot }}
        </h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span class="text-surface-600 dark:text-surface-400">Shiny:</span>
            <span class="ml-1 font-mono">{{ selectedImplantConfig.shiny || 'Empty' }}</span>
          </div>
          <div>
            <span class="text-surface-600 dark:text-surface-400">Bright:</span>
            <span class="ml-1 font-mono">{{ selectedImplantConfig.bright || 'Empty' }}</span>
          </div>
          <div>
            <span class="text-surface-600 dark:text-surface-400">Faded:</span>
            <span class="ml-1 font-mono">{{ selectedImplantConfig.faded || 'Empty' }}</span>
          </div>
          <div>
            <span class="text-surface-600 dark:text-surface-400">QL:</span>
            <span class="ml-1 font-mono">{{ selectedImplantConfig.ql }}</span>
          </div>
        </div>
        
        <!-- Feasibility Check -->
        <div class="mt-3 flex items-center gap-2">
          <div v-if="constructionFeasibility.feasible" class="flex items-center gap-2 text-green-600 dark:text-green-400">
            <i class="pi pi-check-circle"></i>
            <span class="text-sm">Construction appears feasible</span>
          </div>
          <div v-else class="flex items-center gap-2 text-red-600 dark:text-red-400">
            <i class="pi pi-times-circle"></i>
            <span class="text-sm">{{ constructionFeasibility.reason }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Analysis Controls -->
    <div class="flex justify-between items-center">
      <Button
        @click="analyzeSelectedImplant"
        :disabled="!canAnalyze"
        :loading="isAnalyzing"
        label="Analyze Construction"
        icon="pi pi-play"
        class="flex-1 max-w-xs"
      />
      
      <Button
        @click="clearAnalysis"
        :disabled="!currentPlan"
        label="Clear"
        icon="pi pi-trash"
        severity="secondary"
        outlined
      />
    </div>

    <!-- Construction Analysis Results -->
    <ConstructionSteps
      v-if="currentPlan"
      :plan="currentPlan"
      :selected-slot="selectedSlot"
      :skills="currentSkills"
    />

    <!-- Error Display -->
    <div v-if="lastError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
      <div class="flex items-start gap-3">
        <i class="pi pi-exclamation-triangle text-red-600 dark:text-red-400 mt-0.5"></i>
        <div>
          <h4 class="font-medium text-red-900 dark:text-red-100 mb-1">Construction Error</h4>
          <p class="text-sm text-red-700 dark:text-red-300">{{ lastError }}</p>
        </div>
      </div>
    </div>

    <!-- Skill Recommendations -->
    <div v-if="skillRecommendations.length > 0" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
      <h4 class="font-medium text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
        <i class="pi pi-lightbulb text-blue-600 dark:text-blue-400"></i>
        Skill Recommendations
      </h4>
      <div class="space-y-2">
        <div 
          v-for="rec in skillRecommendations" 
          :key="rec.skill"
          class="flex justify-between items-center text-sm"
        >
          <span class="text-blue-700 dark:text-blue-300">{{ rec.skill }}:</span>
          <div class="flex items-center gap-2">
            <span class="text-blue-600 dark:text-blue-400 font-mono">{{ rec.current }}</span>
            <i class="pi pi-arrow-right text-blue-500 text-xs"></i>
            <span class="text-blue-800 dark:text-blue-200 font-mono font-medium">{{ rec.recommended }}</span>
            <span v-if="rec.current >= rec.recommended" class="text-green-600 dark:text-green-400">
              <i class="pi pi-check text-xs"></i>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue';
import { useConstructionPlanner } from '@/composables/useConstructionPlanner';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import { skillService } from '@/services/skill-service';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import ToggleButton from 'primevue/togglebutton';
import ConstructionSteps from './ConstructionSteps.vue';
import type { SkillSet } from '@/utils/construction-analysis';

// ============================================================================
// Props
// ============================================================================

interface Props {
  implants?: Record<string, any>;
  currentBuild?: Record<string, any>;
}

const props = withDefaults(defineProps<Props>(), {
  implants: () => ({}),
  currentBuild: () => ({})
});

// ============================================================================
// TinkerProfiles Store Integration
// ============================================================================

const tinkerProfilesStore = useTinkerProfilesStore();

// ============================================================================
// Construction Planner Integration
// ============================================================================

const implantData = computed(() => props.implants);

const {
  currentSkills,
  currentPlan,
  selectedSlot,
  selectedImplantConfig,
  isAnalyzing,
  lastError,
  isAutoAnalyzing,
  availableSlots,
  hasValidSkills,
  hasValidImplantConfig,
  canAnalyze,
  constructionFeasibility,
  skillRecommendations,
  setSkills,
  selectSlotForAnalysis,
  analyzeSelectedImplant,
  setAutoAnalysis,
  clearAnalysis
} = useConstructionPlanner(implantData);

// ============================================================================
// Local State
// ============================================================================

const selectedSlotLocal = ref(selectedSlot.value);
const autoAnalyze = ref(false);

// ============================================================================
// Skill Values from Active Profile
// ============================================================================

// Computed property for skill values using ID-based access
const skillValues = computed(() => ({
  nanoProgramming: tinkerProfilesStore.activeProfile?.skills[skillService.resolveId('Nano Programming')]?.total ?? 0,
  breakAndEntry: tinkerProfilesStore.activeProfile?.skills[skillService.resolveId('Break & Entry')]?.total ?? 0,
  psychology: tinkerProfilesStore.activeProfile?.skills[skillService.resolveId('Psychology')]?.total ?? 0,
  quantumFT: tinkerProfilesStore.activeProfile?.skills[skillService.resolveId('Quantum FT')]?.total ?? 0,
  computerLiteracy: tinkerProfilesStore.activeProfile?.skills[skillService.resolveId('Computer Literacy')]?.total ?? 0,
  pharmaTech: tinkerProfilesStore.activeProfile?.skills[skillService.resolveId('Pharma Tech')]?.total ?? 0
}));

// Local skills for form binding - these track the profile values but allow editing
const localSkills = reactive<SkillSet>({
  'Nanoprogramming': 0,
  'Break & Entry': 0,
  'Psychology': 0,
  'Quantum FT': 0,
  'Computer Literacy': 0,
  'Pharma Tech': 0,
  'Weaponsmithing': 0
});

// ============================================================================
// Event Handlers
// ============================================================================

function onSkillChange() {
  // Debounced skill update
  setTimeout(() => {
    setSkills(localSkills);
  }, 300);
}

function onSlotChange() {
  selectSlotForAnalysis(selectedSlotLocal.value);
}

// ============================================================================
// Watchers
// ============================================================================

// Sync selected slot
watch(selectedSlot, (newSlot) => {
  selectedSlotLocal.value = newSlot;
});

// Sync skills from profile to local form
watch(skillValues, (newSkillValues) => {
  // Update localSkills from profile skill values (ID-based access)
  localSkills.Nanoprogramming = newSkillValues.nanoProgramming;
  localSkills['Break & Entry'] = newSkillValues.breakAndEntry;
  localSkills.Psychology = newSkillValues.psychology;
  localSkills['Quantum FT'] = newSkillValues.quantumFT;
  localSkills['Computer Literacy'] = newSkillValues.computerLiteracy;
  localSkills['Pharma Tech'] = newSkillValues.pharmaTech;
}, { immediate: true, deep: true });

// Sync local skills to construction planner service
watch(localSkills, (newSkills) => {
  setSkills(newSkills);
}, { deep: true });
</script>

<style scoped>
/* Component-specific styles */
.construction-planner {
  max-width: 100%;
}

/* Input styling consistency */
:deep(.p-inputnumber) {
  width: 100%;
}

:deep(.p-inputnumber-input) {
  width: 100%;
}

:deep(.p-dropdown) {
  width: 100%;
}

/* Error state styling */
:deep(.p-inputnumber.p-invalid .p-inputnumber-input) {
  border-color: var(--p-red-500);
}

/* Success state styling */
:deep(.p-inputnumber.p-valid .p-inputnumber-input) {
  border-color: var(--p-green-500);
}
</style>
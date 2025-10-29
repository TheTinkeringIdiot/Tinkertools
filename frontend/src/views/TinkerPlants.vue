<!--
TinkerPlants - Implant Planning Tool
Grid-based implant selection following the legacy TinkerPlants format
-->
<template>
  <div class="tinker-plants h-full flex flex-col">
    <!-- Header -->
    <div class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="flex items-center gap-4">
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
            <i class="pi pi-cog mr-2" aria-hidden="true"></i>
            TinkerPlants
          </h1>
          <Badge 
            value="Implant Planner" 
            severity="info"
            aria-label="Implant planning and construction tool"
          />
        </div>
        
        <!-- Controls -->
        <div class="flex flex-col sm:flex-row gap-3">
          <!-- Revert Button -->
          <Button
            @click="handleRevert"
            label="Revert"
            icon="pi pi-refresh"
            size="small"
            severity="secondary"
            outlined
            :disabled="!tinkerPlantsStore.hasChanges"
            aria-label="Revert changes to last saved state"
          />

          <!-- Save Button -->
          <Button
            @click="handleSave"
            label="Save"
            icon="pi pi-save"
            size="small"
            severity="success"
            outlined
            :disabled="!tinkerPlantsStore.hasChanges"
            :badge="tinkerPlantsStore.hasChanges ? '*' : undefined"
            badgeSeverity="danger"
            aria-label="Save implant configuration to profile"
          />
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 overflow-auto">
      <div class="h-full">
        <!-- Tabbed Content -->
        <TabView class="h-full tinker-plants-tabs">
          <!-- Build Tab -->
          <TabPanel header="Build" class="h-full">
            <div class="p-4">
              <div class="max-w-6xl mx-auto space-y-6">
                <!-- Build Controls Toolbar -->
                <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-4">
                  <!-- Quality Level Control -->
                  <div class="flex items-center gap-2">
                    <label for="ql-input" class="text-sm font-medium text-surface-700 dark:text-surface-300 whitespace-nowrap">
                      Set QL To:
                    </label>
                    <InputNumber
                      id="ql-input"
                      v-model="qualityLevel"
                      :min="1"
                      :max="300"
                      :step="1"
                      :use-grouping="false"
                      class="build-ql-input"
                      aria-describedby="ql-help"
                      @input="onGlobalQLChange"
                      @blur="onGlobalQLComplete"
                    />
                    <span id="ql-help" class="sr-only">
                      Quality Level for implants, from 1 to 300
                    </span>
                  </div>

                  <!-- Clear All Button -->
                  <Button
                    @click="clearAllImplants"
                    label="Clear All"
                    icon="pi pi-trash"
                    size="small"
                    severity="secondary"
                    outlined
                    aria-label="Clear all selected implants"
                  />
                </div>

                <!-- Cluster Lookup Component -->
                <ClusterLookup
                  @cluster-selected="handleClusterSelected"
                  @cluster-reset="handleClusterReset"
                  @fill-all-requested="handleFillAll"
                />

                <!-- Implant Grid -->
                <div class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden">
          <!-- Grid Header -->
          <div class="tinker-plants-grid gap-0 bg-surface-100 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
            <div class="p-3 font-semibold text-surface-900 dark:text-surface-50 border-r border-surface-200 dark:border-surface-700">
              Slot
            </div>
            <div class="p-3 font-semibold text-surface-900 dark:text-surface-50 text-center border-r border-surface-200 dark:border-surface-700">
              Shiny
            </div>
            <div class="p-3 font-semibold text-surface-900 dark:text-surface-50 text-center border-r border-surface-200 dark:border-surface-700">
              Bright
            </div>
            <div class="p-3 font-semibold text-surface-900 dark:text-surface-50 text-center border-r border-surface-200 dark:border-surface-700">
              Faded
            </div>
            <div class="p-3 font-semibold text-surface-900 dark:text-surface-50 text-center">
              QL
            </div>
          </div>

          <!-- Grid Rows -->
          <div
            v-for="(slot, index) in implantSlots"
            :key="slot.id"
            class="tinker-plants-grid gap-0 border-b border-surface-200 dark:border-surface-700 last:border-b-0"
            :class="{ 'opacity-75': isSlotLoading(slot.id) }"
          >
            <!-- Slot Name -->
            <div class="p-3 border-r border-surface-200 dark:border-surface-700 flex items-center justify-between gap-2">
              <span class="font-medium text-surface-900 dark:text-surface-50">
                {{ slot.name }}
              </span>
              <div class="flex items-center gap-2">
                <span v-if="getPrimaryAttributeAbbr(slot.id)"
                      class="text-xs text-surface-600 dark:text-surface-400">
                  {{ getPrimaryAttributeAbbr(slot.id) }}
                </span>
                <!-- Per-slot loading indicator -->
                <i
                  v-if="isSlotLoading(slot.id)"
                  class="pi pi-spin pi-spinner text-primary text-sm"
                  :aria-label="`Loading implant for ${slot.name}`"
                ></i>
              </div>
            </div>

            <!-- Shiny Dropdown -->
            <div class="p-2 border-r border-surface-200 dark:border-surface-700" :class="{ 'bg-primary-50 dark:bg-primary-900 border-primary-500 dark:border-primary-400 border-2': isSlotHighlighted(slot.name, 'Shiny') }">
              <Dropdown
                :id="`${slot.id}-shiny`"
                v-model="implantSelections[slot.id].shiny"
                :options="getSkillOptions(slot.name, 'shiny')"
                option-label="label"
                option-value="value"
                placeholder="None"
                show-clear
                class="w-full"
                :disabled="isSlotLoading(slot.id)"
                :aria-label="`Select shiny skill cluster for ${slot.name} slot`"
                @change="onImplantChange(slot.id, 'shiny', $event.value)"
              />
            </div>

            <!-- Bright Dropdown -->
            <div class="p-2 border-r border-surface-200 dark:border-surface-700" :class="{ 'bg-primary-50 dark:bg-primary-900 border-primary-500 dark:border-primary-400 border-2': isSlotHighlighted(slot.name, 'Bright') }">
              <Dropdown
                :id="`${slot.id}-bright`"
                v-model="implantSelections[slot.id].bright"
                :options="getSkillOptions(slot.name, 'bright')"
                option-label="label"
                option-value="value"
                placeholder="None"
                show-clear
                class="w-full"
                :disabled="isSlotLoading(slot.id)"
                :aria-label="`Select bright skill cluster for ${slot.name} slot`"
                @change="onImplantChange(slot.id, 'bright', $event.value)"
              />
            </div>

            <!-- Faded Dropdown -->
            <div class="p-2 border-r border-surface-200 dark:border-surface-700" :class="{ 'bg-primary-50 dark:bg-primary-900 border-primary-500 dark:border-primary-400 border-2': isSlotHighlighted(slot.name, 'Faded') }">
              <Dropdown
                :id="`${slot.id}-faded`"
                v-model="implantSelections[slot.id].faded"
                :options="getSkillOptions(slot.name, 'faded')"
                option-label="label"
                option-value="value"
                placeholder="None"
                show-clear
                class="w-full"
                :disabled="isSlotLoading(slot.id)"
                :aria-label="`Select faded skill cluster for ${slot.name} slot`"
                @change="onImplantChange(slot.id, 'faded', $event.value)"
              />
            </div>

            <!-- QL Input -->
            <div class="p-2 flex items-center">
              <InputNumber
                :id="`${slot.id}-ql`"
                v-model="implantSelections[slot.id].ql"
                :min="1"
                :max="300"
                :step="1"
                class="w-full ql-input"
                :disabled="isSlotLoading(slot.id)"
                :aria-label="`Quality Level for ${slot.name} implant`"
                @blur="onQLComplete(slot.id)"
              />
            </div>
          </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <!-- Requirements Tab -->
          <TabPanel header="Requirements" class="h-full">
            <div class="p-4">
              <div class="max-w-6xl mx-auto space-y-6">
                <!-- Total Requirements Section -->
                <div v-if="showResults" class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-6">
                  <h3 class="text-xl font-bold text-surface-900 dark:text-surface-50 mb-4 flex items-center gap-2">
                    <i class="pi pi-check-circle text-primary-500" aria-hidden="true"></i>
                    Total Requirements
                  </h3>
                  <AttributeRequirementsDisplay
                    :requirements="tinkerPlantsStore.attributeRequirements"
                  />
                </div>

                <!-- Per-Implant Requirements Section -->
                <div v-if="showResults" class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-6">
                  <h3 class="text-xl font-bold text-surface-900 dark:text-surface-50 mb-4 flex items-center gap-2">
                    <i class="pi pi-list text-primary-500" aria-hidden="true"></i>
                    Per-Implant Requirements
                  </h3>
                  <PerImplantRequirements
                    :per-implant-requirements="tinkerPlantsStore.perImplantRequirementsList"
                  />
                </div>

                <!-- Empty state when no results -->
                <div v-else class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-8">
                  <div class="text-center text-surface-500 dark:text-surface-400">
                    <i class="pi pi-info-circle text-4xl mb-4" aria-hidden="true"></i>
                    <p class="text-lg">Configure implants in the Build tab to see requirements.</p>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <!-- Bonuses Tab -->
          <TabPanel header="Bonuses" class="h-full">
            <div class="p-4">
              <div class="max-w-6xl mx-auto space-y-6">
                <!-- Results Section -->
                <div v-if="showResults" class="space-y-6">
                  <!-- Skeleton loaders while calculating -->
                  <template v-if="loading">
                    <div class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-4">
                      <Skeleton class="mb-2" height="2rem" />
                      <Skeleton class="mb-2" height="1.5rem" width="80%" />
                      <Skeleton class="mb-2" height="1.5rem" width="60%" />
                      <Skeleton height="1.5rem" width="70%" />
                    </div>
                  </template>

                  <!-- Actual results when not loading -->
                  <template v-else>
                    <!-- Bonus Display Component -->
                    <BonusDisplay
                      :bonuses="tinkerPlantsStore.calculatedBonuses"
                      :per-implant-bonuses="perImplantBonuses"
                    />
                  </template>
                </div>

                <!-- Empty state when no results -->
                <div v-else class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-8">
                  <div class="text-center text-surface-500 dark:text-surface-400">
                    <i class="pi pi-info-circle text-4xl mb-4" aria-hidden="true"></i>
                    <p class="text-lg">Configure implants in the Build tab to see bonuses.</p>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <!-- Construction Tab -->
          <TabPanel header="Construction" class="h-full">
            <div class="p-4">
              <div class="max-w-6xl mx-auto">
                <ConstructionPlanner />
              </div>
            </div>
          </TabPanel>

          <!-- Shopping List Tab -->
          <TabPanel header="Shopping List" class="h-full">
            <ShoppingList />
          </TabPanel>
        </TabView>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div
      v-if="loading"
      class="absolute inset-0 bg-black/20 flex items-center justify-center z-50"
      role="status"
      aria-label="Loading implant data"
    >
      <div class="bg-surface-0 dark:bg-surface-950 p-4 rounded-lg shadow-lg">
        <LoadingSpinner size="medium" loadingText="Loading implant data..." showText />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from 'vue';
import { useAccessibility } from '@/composables/useAccessibility';
import { useTinkerPlantsStore } from '@/stores/tinkerPlants';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import { equipmentBonusCalculator } from '@/services/equipment-bonus-calculator';
import { IMP_SKILLS, IMPLANT_SLOT } from '@/services/game-data';
import { skillService } from '@/services/skill-service';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Skeleton from 'primevue/skeleton';
import LoadingSpinner from '@/components/shared/LoadingSpinner.vue';
import ConstructionPlanner from '@/components/plants/ConstructionPlanner.vue';
import ClusterLookup from '@/components/plants/ClusterLookup.vue';
import AttributeRequirementsDisplay from '@/components/plants/AttributeRequirementsDisplay.vue';
import BonusDisplay from '@/components/plants/BonusDisplay.vue';
import PerImplantRequirements from '@/components/plants/PerImplantRequirements.vue';
import ShoppingList from '@/components/plants/ShoppingList.vue';

// Stat abbreviation helper
const getStatAbbreviation = (statId: number): string => {
  const abbreviations: Record<number, string> = {
    17: 'Agi',  // Agility
    18: 'Sta',  // Stamina
    19: 'Int',  // Intelligence
    20: 'Sen',  // Sense
    21: 'Psy',  // Psychic
    22: 'Str'   // Strength
  }
  return abbreviations[statId] || ''
}

// Accessibility
const { announce, setLoading } = useAccessibility();

// Stores
const tinkerPlantsStore = useTinkerPlantsStore();
const tinkerProfilesStore = useTinkerProfilesStore();

// State
const qualityLevel = ref(200);
const selectedClusterInfo = ref<{ clusterName: string; matchingSlots: Array<{ slot: string; types: string[] }> } | null>(null);

// Computed loading from store
const loading = computed(() => tinkerPlantsStore.loading);

// Mapping from UI slot names to bitflags and IMP_SKILLS keys
const slotMapping = {
  'Eye': { bitflag: String(IMPLANT_SLOT.Eyes), impSkillsKey: 'Eye' },
  'Head': { bitflag: String(IMPLANT_SLOT.Head), impSkillsKey: 'Head' },
  'Ear': { bitflag: String(IMPLANT_SLOT.Ears), impSkillsKey: 'Ear' },
  'Right Arm': { bitflag: String(IMPLANT_SLOT.RightArm), impSkillsKey: 'Right-Arm' },
  'Chest': { bitflag: String(IMPLANT_SLOT.Chest), impSkillsKey: 'Chest' },
  'Left Arm': { bitflag: String(IMPLANT_SLOT.LeftArm), impSkillsKey: 'Left-Arm' },
  'Right Wrist': { bitflag: String(IMPLANT_SLOT.RightWrist), impSkillsKey: 'Right-Wrist' },
  'Waist': { bitflag: String(IMPLANT_SLOT.Waist), impSkillsKey: 'Waist' },
  'Left Wrist': { bitflag: String(IMPLANT_SLOT.LeftWrist), impSkillsKey: 'Left-Wrist' },
  'Right Hand': { bitflag: String(IMPLANT_SLOT.RightHand), impSkillsKey: 'Right-Hand' },
  'Leg': { bitflag: String(IMPLANT_SLOT.Legs), impSkillsKey: 'Leg' },
  'Left Hand': { bitflag: String(IMPLANT_SLOT.LeftHand), impSkillsKey: 'Left-Hand' },
  'Feet': { bitflag: String(IMPLANT_SLOT.Feet), impSkillsKey: 'Feet' }
} as const;

// Implant slots in the order from legacy TinkerPlants
const implantSlots = ref([
  { id: 'Eye', name: 'Eye' },
  { id: 'Head', name: 'Head' },
  { id: 'Ear', name: 'Ear' },
  { id: 'Right Arm', name: 'Right Arm' },
  { id: 'Chest', name: 'Chest' },
  { id: 'Left Arm', name: 'Left Arm' },
  { id: 'Right Wrist', name: 'Right Wrist' },
  { id: 'Waist', name: 'Waist' },
  { id: 'Left Wrist', name: 'Left Wrist' },
  { id: 'Right Hand', name: 'Right Hand' },
  { id: 'Leg', name: 'Leg' },
  { id: 'Left Hand', name: 'Left Hand' },
  { id: 'Feet', name: 'Feet' }
]);


// Initialize implant selections (using stat IDs for cluster values)
const implantSelections = reactive<Record<string, { shiny: number | null; bright: number | null; faded: number | null; ql: number }>>({});

// Initialize all slots
implantSlots.value.forEach(slot => {
  implantSelections[slot.id] = {
    shiny: null,
    bright: null,
    faded: null,
    ql: qualityLevel.value
  };
});

// Helper function to get slot-specific skill options from IMP_SKILLS
const getSkillOptions = (slotName: string, clusterType: 'shiny' | 'bright' | 'faded') => {
  // Get the mapping info for this slot
  const mapping = slotMapping[slotName as keyof typeof slotMapping];
  if (!mapping) return [];

  // Get the skills from IMP_SKILLS using the mapped key
  const impSkillsKey = mapping.impSkillsKey as keyof typeof IMP_SKILLS;
  const slotData = IMP_SKILLS[impSkillsKey];
  if (!slotData) return [];

  // Get the cluster type data (capitalize first letter for IMP_SKILLS format)
  const clusterKey = (clusterType.charAt(0).toUpperCase() + clusterType.slice(1)) as 'Shiny' | 'Bright' | 'Faded';
  const skillNames = slotData[clusterKey] || [];

  // Convert skill names to stat IDs for dropdown values
  return skillNames.map(skillName => {
    try {
      const statId = skillService.resolveId(skillName);
      return { value: statId, label: skillName };
    } catch (err) {
      console.error(`Failed to resolve skill "${skillName}" to ID:`, err);
      return null;
    }
  }).filter(Boolean) as { value: number; label: string }[];
};

// Computed properties
const hasAnyImplants = computed(() => {
  return Object.values(implantSelections).some(selection =>
    selection.shiny || selection.bright || selection.faded
  );
});

// Show results automatically when there are configured implants
const showResults = computed(() => hasAnyImplants.value);

const calculatedBonuses = computed(() => {
  // Get bonuses from store calculation
  return tinkerPlantsStore.calculatedBonuses || {};
});

/**
 * Compute per-implant bonuses for BonusDisplay component
 * Builds a mapping of slot bitflag -> stat bonuses
 */
const perImplantBonuses = computed(() => {
  const bonusesBySlot: Record<string, Record<number, number>> = {};

  // Get the current configuration
  const config = tinkerPlantsStore.currentConfiguration as Record<string, any>;

  // Iterate through current configuration to extract bonuses per slot
  for (const [slotBitflag, selection] of Object.entries(config)) {
    // Skip slots with no item data
    if (!selection?.item) {
      continue;
    }

    // Skip empty slots (all clusters null)
    const hasNonEmptyClusters =
      selection.shiny !== null ||
      selection.bright !== null ||
      selection.faded !== null;

    if (!hasNonEmptyClusters) {
      continue;
    }

    try {
      // Extract bonuses from the item using equipment bonus calculator
      const itemBonuses = equipmentBonusCalculator.parseItemSpells(selection.item);

      // Aggregate bonuses for this slot
      const slotBonusMap: Record<number, number> = {};
      for (const bonus of itemBonuses) {
        if (slotBonusMap[bonus.statId]) {
          // Stat 355 (WornItem) is a flag field - use bitwise OR
          if (bonus.statId === 355) {
            slotBonusMap[bonus.statId] |= bonus.amount;
          } else {
            slotBonusMap[bonus.statId] += bonus.amount;
          }
        } else {
          slotBonusMap[bonus.statId] = bonus.amount;
        }
      }

      bonusesBySlot[slotBitflag] = slotBonusMap;
    } catch (err) {
      console.error(`Failed to parse bonuses for slot ${slotBitflag}:`, err);
      // Continue processing other slots
    }
  }

  return bonusesBySlot;
});

// Helper to check if a slot is loading
const isSlotLoading = (slotId: string): boolean => {
  const mapping = slotMapping[slotId as keyof typeof slotMapping];
  if (!mapping) return false;

  const slotBitflag = mapping.bitflag;
  return tinkerPlantsStore.slotLoading[slotBitflag] || false;
};

// Helper to check if a slot should be highlighted
const isSlotHighlighted = (slotName: string, columnType: string): boolean => {
  if (!selectedClusterInfo.value) return false;

  // Normalize slot names (ClusterLookup uses hyphens, template uses spaces)
  const normalizeSlot = (s: string) => s.replace(/[-\s]/g, '').toLowerCase();
  const normalizedSlotName = normalizeSlot(slotName);

  return selectedClusterInfo.value.matchingSlots.some(match =>
    normalizeSlot(match.slot) === normalizedSlotName &&
    match.types.includes(columnType)
  );
};

// Event handlers
const onImplantChange = (slotId: string, type: string, value: number | null) => {
  // Validate value is null or number (reject strings like "Empty")
  if (value !== null && typeof value !== 'number') {
    console.error(`Invalid cluster value: ${value} (type: ${typeof value}). Must be null or number.`);
    return;
  }

  // Get the bitflag for this slot
  const mapping = slotMapping[slotId as keyof typeof slotMapping];
  if (!mapping) {
    console.error(`No mapping found for slot: ${slotId}`);
    return;
  }

  const slotBitflag = mapping.bitflag;

  // Update the store with the new cluster selection
  tinkerPlantsStore.updateSlot(slotBitflag, {
    [type]: value,
    ql: implantSelections[slotId].ql,
    slotBitflag
  });

  // Trigger debounced lookup
  tinkerPlantsStore.lookupImplantForSlotDebounced(slotBitflag);

  // Get skill name for announcement
  const skillName = value !== null ? skillService.getName(value) : null;
  announce(`${type} cluster ${skillName || 'cleared'} for ${implantSlots.value.find(s => s.id === slotId)?.name} slot`);
};

const onQLComplete = (slotId: string) => {
  // Triggered when user finishes entering QL (on blur)
  const value = implantSelections[slotId].ql;

  if (value !== null) {
    // Get the bitflag for this slot
    const mapping = slotMapping[slotId as keyof typeof slotMapping];
    if (!mapping) {
      console.error(`No mapping found for slot: ${slotId}`);
      return;
    }

    const slotBitflag = mapping.bitflag;

    // Update the store with the new QL
    tinkerPlantsStore.updateSlot(slotBitflag, {
      ql: value,
      slotBitflag
    });

    // Trigger debounced lookup
    tinkerPlantsStore.lookupImplantForSlotDebounced(slotBitflag);

    announce(`Quality Level set to ${value} for ${implantSlots.value.find(s => s.id === slotId)?.name} slot`);
  }
};

const onGlobalQLChange = (event: any) => {
  const newQL = event.value;
  if (newQL !== null && newQL !== undefined) {
    // Ensure the value is within valid bounds before applying to all fields
    const clampedQL = Math.max(1, Math.min(300, newQL));

    // Update all slot QL values in local state (immediate UI update)
    Object.keys(implantSelections).forEach(slotId => {
      implantSelections[slotId].ql = clampedQL;
    });
  }
};

const onGlobalQLComplete = () => {
  // Triggered when user finishes entering QL (on blur)
  // Update store and trigger lookups for configured slots
  const clampedQL = Math.max(1, Math.min(300, qualityLevel.value));

  Object.keys(implantSelections).forEach(slotId => {
    // Check if this slot has any configured clusters
    const selection = implantSelections[slotId];
    const hasConfiguredClusters = selection.shiny !== null || selection.bright !== null || selection.faded !== null;

    if (hasConfiguredClusters) {
      // Get the bitflag for this slot
      const mapping = slotMapping[slotId as keyof typeof slotMapping];
      if (mapping) {
        const slotBitflag = mapping.bitflag;

        // Update store with new QL
        tinkerPlantsStore.updateSlot(slotBitflag, {
          ql: clampedQL,
          slotBitflag
        });

        // Trigger debounced lookup to fetch implant at new QL
        tinkerPlantsStore.lookupImplantForSlotDebounced(slotBitflag);
      }
    }
  });

  announce(`All Quality Levels set to ${clampedQL}`);
};

const clearAllImplants = () => {
  Object.keys(implantSelections).forEach(slotId => {
    // Get the bitflag for this slot
    const mapping = slotMapping[slotId as keyof typeof slotMapping];
    if (!mapping) return;

    const slotBitflag = mapping.bitflag;

    // Update local state
    implantSelections[slotId] = {
      shiny: null,
      bright: null,
      faded: null,
      ql: qualityLevel.value
    };

    // Update store state to trigger change detection and enable Revert button
    tinkerPlantsStore.updateSlot(slotBitflag, {
      shiny: null,
      bright: null,
      faded: null,
      ql: qualityLevel.value,
      slotBitflag
    });
  });
  announce('All implants cleared');
};

/**
 * Handle Save button click - saves current implant configuration to profile
 */
const handleSave = async () => {
  try {
    await tinkerPlantsStore.saveToProfile();
    announce('Implant configuration saved to profile');
  } catch (error) {
    console.error('Failed to save implant configuration:', error);
    announce('Failed to save implant configuration', 'assertive');
  }
};

/**
 * Sync local implantSelections from store's currentConfiguration
 * Called after operations that modify the store (load, revert, etc.)
 */
const syncImplantSelectionsFromStore = () => {
  const config = tinkerPlantsStore.currentConfiguration as Record<string, any>;
  for (const [slotBitflag, selection] of Object.entries(config)) {
    // Find the slot name for this bitflag
    const slotEntry = Object.entries(slotMapping).find(
      ([_, mapping]) => mapping.bitflag === slotBitflag
    );
    if (slotEntry) {
      const slotName = slotEntry[0];
      implantSelections[slotName] = {
        shiny: selection.shiny,
        bright: selection.bright,
        faded: selection.faded,
        ql: selection.ql
      };
    }
  }
};

/**
 * Handle Revert button click - discards changes and reverts to profile state
 */
const handleRevert = () => {
  tinkerPlantsStore.revertToProfile();
  syncImplantSelectionsFromStore();
  announce('Changes reverted to last saved state');
};

/**
 * Handle cluster selection from ClusterLookup component
 * Highlights matching slots based on cluster availability
 */
const handleClusterSelected = (clusterName: string, matchingSlots: Array<{ slot: string; types: string[] }>) => {
  selectedClusterInfo.value = { clusterName, matchingSlots };
  announce(`Cluster ${clusterName} found in ${matchingSlots.length} slot(s)`);
};

/**
 * Handle cluster reset from ClusterLookup component
 * Clears slot highlighting
 */
const handleClusterReset = () => {
  selectedClusterInfo.value = null;
};

/**
 * Handle fill all request from ClusterLookup component
 * Populates all matching slots with the selected cluster
 */
const handleFillAll = async (clusterName: string) => {
  // Convert cluster name to stat ID
  let clusterStatId: number;
  try {
    clusterStatId = skillService.resolveId(clusterName);
  } catch (err) {
    console.error(`Failed to resolve cluster "${clusterName}" to stat ID:`, err);
    announce(`Failed to resolve cluster ${clusterName}`, 'assertive');
    return;
  }

  // Get matching slots for this cluster from the ClusterLookup utility
  const { getSlotsForCluster } = await import('@/utils/cluster-utilities');
  const matchingSlots = getSlotsForCluster(clusterName);

  let populatedCount = 0;

  // Iterate through matching slots and populate them
  for (const match of matchingSlots) {
    // Convert slot name to bitflag
    const mapping = Object.entries(slotMapping).find(([name]) => name === match.slot);
    if (!mapping) continue;

    const slotBitflag = mapping[1].bitflag;

    // Populate each brightness type with the cluster
    for (const type of match.types) {
      const lowerType = type.toLowerCase() as 'shiny' | 'bright' | 'faded';

      // Update the slot configuration
      implantSelections[match.slot] = implantSelections[match.slot] || {
        shiny: null,
        bright: null,
        faded: null,
        ql: qualityLevel.value
      };

      implantSelections[match.slot][lowerType] = clusterStatId;

      // Update store
      tinkerPlantsStore.updateSlot(slotBitflag, {
        [lowerType]: clusterStatId,
        ql: implantSelections[match.slot].ql,
        slotBitflag
      });

      // Trigger debounced lookup
      tinkerPlantsStore.lookupImplantForSlotDebounced(slotBitflag);

      populatedCount++;
    }
  }

  announce(`Filled ${populatedCount} cluster slot(s) with ${clusterName}`);
};

/**
 * Get the primary attribute abbreviation for a slot
 * Returns the 3-letter abbreviation of the highest-value attribute requirement
 * (excluding Treatment stat 124)
 */
const getPrimaryAttributeAbbr = (slotId: string): string => {
  const bitflag = slotMapping[slotId as keyof typeof slotMapping]?.bitflag
  if (!bitflag) return ''

  const slotReqs = tinkerPlantsStore.perImplantRequirementsList
    .find(item => item.slot === bitflag)?.requirements

  if (!slotReqs || slotReqs.length === 0) return ''

  // Filter to attribute stats only (exclude Treatment 124)
  const attributeStats = [17, 18, 19, 20, 21, 22]
  const attributeReqs = slotReqs.filter(req => attributeStats.includes(req.stat))

  if (attributeReqs.length === 0) return ''

  // Find highest value
  const primaryReq = attributeReqs.reduce((highest, current) =>
    current.required > highest.required ? current : highest
  )

  return getStatAbbreviation(primaryReq.stat)
}

// Watch for store errors and announce them
watch(() => tinkerPlantsStore.error, (error) => {
  if (error) {
    announce(error, 'assertive');
  }
});

// Lifecycle
onMounted(async () => {
  setLoading(true, 'Loading implant planner...');

  try {
    // Load implant configuration from active profile
    await tinkerPlantsStore.loadFromProfile();

    // Sync implantSelections from store's currentConfiguration
    syncImplantSelectionsFromStore();

    announce('Implant planner loaded successfully');
  } catch (error) {
    console.error('Failed to load implant data:', error);
    announce('Failed to load implant data', 'assertive');
  } finally {
    setLoading(false);
  }
});

// Watch for active profile changes and reload implant data
watch(
  () => tinkerProfilesStore.activeProfile,
  async (newProfile, oldProfile) => {
    // Only reload if profile actually changed (not just a reference update)
    if (newProfile?.id !== oldProfile?.id) {
      setLoading(true, 'Loading implant configuration...');

      try {
        await tinkerPlantsStore.loadFromProfile();
        syncImplantSelectionsFromStore();
        announce('Implant configuration loaded for ' + (newProfile?.Character.Name || 'profile'));
      } catch (error) {
        console.error('Failed to reload implant data:', error);
        announce('Failed to reload implant data', 'assertive');
      } finally {
        setLoading(false);
      }
    }
  }
);
</script>

<style scoped>
/* Custom grid layout with reduced QL column and expanded dropdown columns */
.tinker-plants-grid {
  display: grid;
  grid-template-columns: 1fr 2fr 2fr 2fr 100px;
}

/* QL input styling for centered text and proper padding */
.ql-input :deep(.p-inputnumber) {
  width: 100%;
}

.ql-input :deep(.p-inputnumber-input) {
  text-align: center !important;
  padding-left: 0.5rem !important;
  padding-right: 0.5rem !important;
  background-color: var(--p-inputtext-background) !important;
  color: var(--p-inputtext-color) !important;
  border: 1px solid var(--p-inputtext-border-color) !important;
  width: 100% !important;
}

/* Build QL input styling - compact width and consistent appearance */
.build-ql-input {
  width: 80px;
}

.build-ql-input :deep(.p-inputnumber) {
  width: 80px;
}

.build-ql-input :deep(.p-inputnumber-input) {
  text-align: center !important;
  width: 80px !important;
  padding-left: 0.5rem !important;
  padding-right: 0.5rem !important;
  background-color: var(--p-inputtext-background) !important;
  color: var(--p-inputtext-color) !important;
  border: 1px solid var(--p-inputtext-border-color) !important;
}

/* TabView full height styling */
.tinker-plants-tabs {
  height: 100%;
}

.tinker-plants-tabs :deep(.p-tabview-panels) {
  height: calc(100% - 60px); /* Subtract tab header height */
  overflow: auto;
}

.tinker-plants-tabs :deep(.p-tabview-panel) {
  height: 100%;
  padding: 0 !important;
}

/* Screen reader only utility */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
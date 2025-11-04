<!--
SymbiantDetail - Detailed view of a symbiant
Shows complete symbiant information and build options
-->
<template>
  <Dialog
    :visible="visible"
    modal
    :header="symbiant?.name || 'Symbiant Details'"
    :style="{ width: '800px', maxHeight: '90vh' }"
    @update:visible="$emit('update:visible', $event)"
  >
    <div v-if="symbiant" class="space-y-4">
      <!-- Basic Info -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <h4 class="font-medium text-surface-900 dark:text-surface-100 mb-2">Basic Information</h4>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-surface-600 dark:text-surface-400">Name:</span>
              <span class="font-medium">{{ symbiant.name }}</span>
            </div>
            <div v-if="symbiant.family" class="flex justify-between">
              <span class="text-surface-600 dark:text-surface-400">Family:</span>
              <span>{{ symbiant.family }}</span>
            </div>
            <div v-if="symbiant.slot" class="flex justify-between">
              <span class="text-surface-600 dark:text-surface-400">Slot:</span>
              <span>{{ formatSlotName(symbiant.slot) }}</span>
            </div>
            <div v-if="symbiant.qualityLevel" class="flex justify-between">
              <span class="text-surface-600 dark:text-surface-400">Quality Level:</span>
              <Badge :value="`QL ${symbiant.qualityLevel}`" severity="info" />
            </div>
          </div>
        </div>

        <div v-if="symbiant.statBonuses && symbiant.statBonuses.length > 0">
          <h4 class="font-medium text-surface-900 dark:text-surface-100 mb-2">Stat Bonuses</h4>
          <div class="space-y-1">
            <div
              v-for="bonus in symbiant.statBonuses"
              :key="bonus.statId"
              class="flex justify-between text-sm"
            >
              <span class="text-surface-600 dark:text-surface-400"
                >{{ formatStatName(bonus.statId) }}:</span
              >
              <span class="font-medium text-green-600 dark:text-green-400">+{{ bonus.value }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div v-if="symbiant.description">
        <h4 class="font-medium text-surface-900 dark:text-surface-100 mb-2">Description</h4>
        <p class="text-sm text-surface-700 dark:text-surface-300">{{ symbiant.description }}</p>
      </div>

      <!-- Build Integration -->
      <div v-if="showBuildOptions && currentBuild">
        <h4 class="font-medium text-surface-900 dark:text-surface-100 mb-2">Add to Build</h4>
        <div class="space-y-2">
          <!-- Suggested slot (if symbiant has a slot) -->
          <div
            v-if="symbiant.slot"
            class="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800 rounded"
          >
            <div>
              <div class="font-medium">{{ formatSlotName(symbiant.slot) }}</div>
              <div class="text-sm text-surface-500 dark:text-surface-400">
                {{ getSlotStatus(symbiant.slot) }}
              </div>
            </div>
            <Button
              @click="addToSlot(symbiant.slot)"
              :label="isSlotOccupied(symbiant.slot) ? 'Replace' : 'Add'"
              :severity="isSlotOccupied(symbiant.slot) ? 'warning' : 'primary'"
              size="small"
            />
          </div>

          <!-- Alternative slots (if any conflicts) -->
          <div v-if="alternativeSlots.length > 0">
            <div class="text-sm text-surface-600 dark:text-surface-400 mb-2">
              Alternative slots:
            </div>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="slot in alternativeSlots"
                :key="slot"
                @click="addToSlot(slot)"
                :label="formatSlotName(slot)"
                size="small"
                text
                severity="secondary"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Boss Source -->
      <div v-if="symbiant.bossSource">
        <h4 class="font-medium text-surface-900 dark:text-surface-100 mb-2">Source</h4>
        <div class="p-3 bg-surface-50 dark:bg-surface-800 rounded">
          <div class="flex items-center gap-2">
            <i class="pi pi-map-marker text-primary-500"></i>
            <span class="text-sm">{{ symbiant.bossSource }}</span>
          </div>
        </div>
      </div>

      <!-- Stats Impact (if character profile available) -->
      <div v-if="showStatsImpact">
        <h4 class="font-medium text-surface-900 dark:text-surface-100 mb-2">Stats Impact</h4>
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div v-for="impact in statsImpact" :key="impact.statId" class="flex justify-between">
            <span class="text-surface-600 dark:text-surface-400">{{ impact.statName }}:</span>
            <span class="font-medium" :class="impact.value > 0 ? 'text-green-600' : 'text-red-600'">
              {{ impact.current }} → {{ impact.newValue }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- No symbiant selected -->
    <div v-else class="text-center py-8">
      <i class="pi pi-search text-4xl text-surface-400 dark:text-surface-600 mb-4 block"></i>
      <p class="text-surface-500 dark:text-surface-400">No symbiant selected</p>
    </div>

    <template #footer>
      <div class="flex justify-between">
        <div>
          <Button
            v-if="showBuildOptions && symbiant"
            @click="addToBuild"
            label="Add to Build"
            icon="pi pi-plus"
            :disabled="!symbiant.slot"
          />
        </div>
        <div class="flex gap-2">
          <Button label="Close" severity="secondary" @click="$emit('close')" />
        </div>
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';

import type { PlantSymbiant, CharacterBuild } from '@/types/plants';

interface Props {
  visible: boolean;
  symbiant?: PlantSymbiant | null;
  showBuildOptions?: boolean;
  currentBuild?: CharacterBuild;
}

const props = withDefaults(defineProps<Props>(), {
  symbiant: null,
  showBuildOptions: false,
  currentBuild: undefined,
});

interface Emits {
  (e: 'update:visible', visible: boolean): void;
  (e: 'add-to-build', symbiant: PlantSymbiant, slot?: string): void;
  (e: 'close'): void;
}

const emit = defineEmits<Emits>();

// Computed
const alternativeSlots = computed(() => {
  // This would contain logic to suggest alternative slots
  // For now, return empty array
  return [];
});

const showStatsImpact = computed(() => {
  return props.symbiant?.statBonuses && props.symbiant.statBonuses.length > 0;
});

const statsImpact = computed(() => {
  if (!props.symbiant?.statBonuses) return [];

  return props.symbiant.statBonuses.map((bonus) => ({
    statId: bonus.statId,
    statName: formatStatName(bonus.statId),
    value: bonus.value,
    current: 100, // Mock current value
    newValue: 100 + bonus.value, // Mock new value
  }));
});

// Methods
const formatSlotName = (slot: string): string => {
  const slotNames: Record<string, string> = {
    head: 'Head',
    eye: 'Eye',
    ear: 'Ear',
    rarm: 'Right Arm',
    chest: 'Chest',
    larm: 'Left Arm',
    waist: 'Waist',
    rwrist: 'Right Wrist',
    legs: 'Legs',
    lwrist: 'Left Wrist',
    rfinger: 'Right Finger',
    feet: 'Feet',
    lfinger: 'Left Finger',
  };
  return slotNames[slot] || slot;
};

const formatStatName = (statId: string): string => {
  const statNames: Record<string, string> = {
    strength: 'Strength',
    agility: 'Agility',
    stamina: 'Stamina',
    intelligence: 'Intelligence',
    sense: 'Sense',
    psychic: 'Psychic',
    matter_creation: 'Matter Creation',
    matter_metamorphosis: 'Matter Metamorphosis',
    psychological_modifications: 'Psychological Modifications',
    biological_metamorphosis: 'Biological Metamorphosis',
    sensory_improvement: 'Sensory Improvement',
    time_and_space: 'Time and Space',
  };
  return statNames[statId] || statId.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

const isSlotOccupied = (slot: string): boolean => {
  return props.currentBuild?.symbiants[slot] != null;
};

const getSlotStatus = (slot: string): string => {
  if (!props.currentBuild) return 'Available';

  const existing = props.currentBuild.symbiants[slot];
  if (existing) {
    return `Currently: ${existing.name}`;
  }
  return 'Available';
};

const addToSlot = (slot: string) => {
  if (props.symbiant) {
    emit('add-to-build', props.symbiant, slot);
  }
};

const addToBuild = () => {
  if (props.symbiant) {
    emit('add-to-build', props.symbiant);
  }
};
</script>

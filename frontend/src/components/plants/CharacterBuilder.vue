<!--
CharacterBuilder - Main character building interface
Visual character representation with symbiant slots
-->
<template>
  <div class="character-builder h-full p-4">
    <div class="max-w-4xl mx-auto">
      <!-- Character Overview -->
      <div class="mb-6 p-4 bg-surface-50 dark:bg-surface-900 rounded-lg">
        <h2 class="text-xl font-bold text-surface-900 dark:text-surface-100 mb-2">
          {{ profile?.name || 'Character Builder' }}
        </h2>
        <div v-if="profile" class="text-sm text-surface-600 dark:text-surface-400">
          Level {{ profile.level }} {{ profile.profession }}
        </div>
      </div>
      
      <!-- Character Silhouette with Slots -->
      <div class="relative bg-surface-0 dark:bg-surface-950 rounded-lg p-8 border border-surface-200 dark:border-surface-700">
        <!-- Character Silhouette -->
        <div class="flex justify-center">
          <svg width="300" height="400" viewBox="0 0 300 400" class="text-surface-300 dark:text-surface-700">
            <!-- Simple character outline -->
            <path d="M150 50 C170 50 180 70 180 90 C180 110 170 130 150 130 C130 130 120 110 120 90 C120 70 130 50 150 50 Z" fill="currentColor" opacity="0.3" />
            <rect x="130" y="130" width="40" height="80" fill="currentColor" opacity="0.3" />
            <rect x="120" y="140" width="15" height="60" fill="currentColor" opacity="0.3" />
            <rect x="165" y="140" width="15" height="60" fill="currentColor" opacity="0.3" />
            <rect x="135" y="210" width="30" height="100" fill="currentColor" opacity="0.3" />
            <rect x="140" y="310" width="20" height="40" fill="currentColor" opacity="0.3" />
            <rect x="140" y="350" width="20" height="15" fill="currentColor" opacity="0.3" />
          </svg>
        </div>
        
        <!-- Symbiant Slots -->
        <div class="absolute inset-0">
          <!-- Head -->
          <SymbiantSlot
            slot-id="head"
            slot-name="Head"
            :symbiant="currentBuild.symbiants.head"
            :position="{ top: '12%', left: '50%', transform: 'translateX(-50%)' }"
            @symbiant-selected="onSymbiantSlotClick"
            @symbiant-removed="onSymbiantRemoved"
          />
          
          <!-- Eye -->
          <SymbiantSlot
            slot-id="eye"
            slot-name="Eye"
            :symbiant="currentBuild.symbiants.eye"
            :position="{ top: '18%', left: '42%' }"
            @symbiant-selected="onSymbiantSlotClick"
            @symbiant-removed="onSymbiantRemoved"
          />
          
          <!-- Ear -->
          <SymbiantSlot
            slot-id="ear"
            slot-name="Ear"
            :symbiant="currentBuild.symbiants.ear"
            :position="{ top: '18%', left: '58%' }"
            @symbiant-selected="onSymbiantSlotClick"
            @symbiant-removed="onSymbiantRemoved"
          />
          
          <!-- Chest -->
          <SymbiantSlot
            slot-id="chest"
            slot-name="Chest"
            :symbiant="currentBuild.symbiants.chest"
            :position="{ top: '35%', left: '50%', transform: 'translateX(-50%)' }"
            @symbiant-selected="onSymbiantSlotClick"
            @symbiant-removed="onSymbiantRemoved"
          />
          
          <!-- Right Arm -->
          <SymbiantSlot
            slot-id="rarm"
            slot-name="Right Arm"
            :symbiant="currentBuild.symbiants.rarm"
            :position="{ top: '35%', left: '25%' }"
            @symbiant-selected="onSymbiantSlotClick"
            @symbiant-removed="onSymbiantRemoved"
          />
          
          <!-- Left Arm -->
          <SymbiantSlot
            slot-id="larm"
            slot-name="Left Arm"
            :symbiant="currentBuild.symbiants.larm"
            :position="{ top: '35%', left: '75%' }"
            @symbiant-selected="onSymbiantSlotClick"
            @symbiant-removed="onSymbiantRemoved"
          />
          
          <!-- Waist -->
          <SymbiantSlot
            slot-id="waist"
            slot-name="Waist"
            :symbiant="currentBuild.symbiants.waist"
            :position="{ top: '52%', left: '50%', transform: 'translateX(-50%)' }"
            @symbiant-selected="onSymbiantSlotClick"
            @symbiant-removed="onSymbiantRemoved"
          />
          
          <!-- Right Wrist -->
          <SymbiantSlot
            slot-id="rwrist"
            slot-name="Right Wrist"
            :symbiant="currentBuild.symbiants.rwrist"
            :position="{ top: '50%', left: '20%' }"
            @symbiant-selected="onSymbiantSlotClick"
            @symbiant-removed="onSymbiantRemoved"
          />
          
          <!-- Left Wrist -->
          <SymbiantSlot
            slot-id="lwrist"
            slot-name="Left Wrist"
            :symbiant="currentBuild.symbiants.lwrist"
            :position="{ top: '50%', left: '80%' }"
            @symbiant-selected="onSymbiantSlotClick"
            @symbiant-removed="onSymbiantRemoved"
          />
          
          <!-- Legs -->
          <SymbiantSlot
            slot-id="legs"
            slot-name="Legs"
            :symbiant="currentBuild.symbiants.legs"
            :position="{ top: '70%', left: '50%', transform: 'translateX(-50%)' }"
            @symbiant-selected="onSymbiantSlotClick"
            @symbiant-removed="onSymbiantRemoved"
          />
          
          <!-- Right Finger -->
          <SymbiantSlot
            slot-id="rfinger"
            slot-name="Right Finger"
            :symbiant="currentBuild.symbiants.rfinger"
            :position="{ top: '47%', left: '15%' }"
            @symbiant-selected="onSymbiantSlotClick"
            @symbiant-removed="onSymbiantRemoved"
          />
          
          <!-- Left Finger -->
          <SymbiantSlot
            slot-id="lfinger"
            slot-name="Left Finger"
            :symbiant="currentBuild.symbiants.lfinger"
            :position="{ top: '47%', left: '85%' }"
            @symbiant-selected="onSymbiantSlotClick"
            @symbiant-removed="onSymbiantRemoved"
          />
          
          <!-- Feet -->
          <SymbiantSlot
            slot-id="feet"
            slot-name="Feet"
            :symbiant="currentBuild.symbiants.feet"
            :position="{ top: '87%', left: '50%', transform: 'translateX(-50%)' }"
            @symbiant-selected="onSymbiantSlotClick"
            @symbiant-removed="onSymbiantRemoved"
          />
        </div>
      </div>
      
      <!-- Build Actions -->
      <div class="mt-6 flex justify-center gap-4">
        <Button
          @click="optimizeBuild"
          label="Auto-Optimize"
          icon="pi pi-cog"
          severity="primary"
          :disabled="statTargets.length === 0"
        />
        <Button
          @click="clearAllSlots"
          label="Clear All"
          icon="pi pi-trash"
          severity="secondary"
        />
        <Button
          @click="analyzeBuild"
          label="Analyze Build"
          icon="pi pi-chart-bar"
          severity="info"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Button from 'primevue/button';

import SymbiantSlot from './SymbiantSlot.vue';
import type { PlantSymbiant, CharacterProfile, CharacterBuild, StatTarget } from '@/types/plants';

interface Props {
  profile?: CharacterProfile | null;
  statTargets: StatTarget[];
  availableSymbiants: PlantSymbiant[];
  currentBuild: CharacterBuild;
}

const props = defineProps<Props>();

interface Emits {
  (e: 'build-changed', build: CharacterBuild): void;
  (e: 'symbiant-selected', slot: string): void;
}

const emit = defineEmits<Emits>();

// Methods
const onSymbiantSlotClick = (slotId: string) => {
  emit('symbiant-selected', slotId);
};

const onSymbiantRemoved = (slotId: string) => {
  const updatedBuild = { ...props.currentBuild };
  delete updatedBuild.symbiants[slotId];
  emit('build-changed', updatedBuild);
};

const optimizeBuild = () => {
  // This would implement auto-optimization logic
  console.log('Auto-optimize build for targets:', props.statTargets);
};

const clearAllSlots = () => {
  const clearedBuild: CharacterBuild = {
    ...props.currentBuild,
    symbiants: {}
  };
  emit('build-changed', clearedBuild);
};

const analyzeBuild = () => {
  // This would show build analysis
  console.log('Analyze current build:', props.currentBuild);
};
</script>

<style scoped>
.character-builder svg {
  filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.1));
}
</style>
<!--
BuildSummary - Show current build summary and stats
Displays equipped symbiants and total stat bonuses
-->
<template>
  <div class="build-summary p-3">
    <h3 class="font-medium text-surface-900 dark:text-surface-100 mb-3">
      <i class="pi pi-list mr-2"></i>
      Build Summary
    </h3>
    
    <!-- Build Name -->
    <div v-if="currentBuild.name" class="mb-3 p-2 bg-surface-100 dark:bg-surface-800 rounded">
      <div class="font-medium">{{ currentBuild.name }}</div>
      <div v-if="currentBuild.notes" class="text-xs text-surface-500 dark:text-surface-400 mt-1">
        {{ currentBuild.notes }}
      </div>
    </div>
    
    <!-- Equipped Symbiants -->
    <div class="mb-4">
      <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
        Equipped Symbiants
      </h4>
      
      <div v-if="Object.keys(currentBuild.symbiants).length === 0" 
           class="text-center py-3 text-surface-500 dark:text-surface-400">
        <i class="pi pi-inbox text-xl mb-1 block"></i>
        <p class="text-xs">No symbiants equipped</p>
      </div>
      
      <div v-else class="space-y-2">
        <div
          v-for="(symbiant, slot) in currentBuild.symbiants"
          :key="slot"
          class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded text-sm"
        >
          <div>
            <div class="font-medium">{{ formatSlotName(slot) }}</div>
            <div class="text-xs text-surface-600 dark:text-surface-400">{{ symbiant.name }}</div>
          </div>
          <Button
            @click="removeSymbiant(slot)"
            icon="pi pi-times"
            size="small"
            text
            severity="danger"
            aria-label="Remove symbiant"
          />
        </div>
      </div>
    </div>
    
    <!-- Stat Bonuses -->
    <div class="mb-4">
      <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
        Stat Bonuses
      </h4>
      
      <div v-if="Object.keys(statBonuses).length === 0" 
           class="text-center py-2 text-surface-500 dark:text-surface-400 text-xs">
        No bonuses
      </div>
      
      <div v-else class="space-y-1">
        <div
          v-for="[statId, bonus] in Object.entries(statBonuses)"
          :key="statId"
          class="flex justify-between text-sm"
        >
          <span class="text-surface-600 dark:text-surface-400">{{ formatStatName(statId) }}</span>
          <span class="font-medium text-green-600 dark:text-green-400">+{{ bonus }}</span>
        </div>
      </div>
    </div>
    
    <!-- Total Stats -->
    <div v-if="Object.keys(totalStats).length > 0">
      <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
        Total Stats
      </h4>
      
      <div class="space-y-1">
        <div
          v-for="[statId, total] in Object.entries(totalStats)"
          :key="statId"
          class="flex justify-between text-sm"
        >
          <span class="text-surface-600 dark:text-surface-400">{{ formatStatName(statId) }}</span>
          <span class="font-medium text-surface-900 dark:text-surface-100">{{ total }}</span>
        </div>
      </div>
    </div>
    
    <!-- Build Statistics -->
    <div class="mt-4 pt-3 border-t border-surface-200 dark:border-surface-700">
      <div class="text-xs text-surface-500 dark:text-surface-400 space-y-1">
        <div class="flex justify-between">
          <span>Symbiants:</span>
          <span>{{ Object.keys(currentBuild.symbiants).length }}/13</span>
        </div>
        <div class="flex justify-between">
          <span>Bonuses:</span>
          <span>{{ Object.keys(statBonuses).length }} stats</span>
        </div>
        <div v-if="buildEfficiency !== null" class="flex justify-between">
          <span>Efficiency:</span>
          <span>{{ Math.round(buildEfficiency * 100) }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Button from 'primevue/button';

import type { CharacterBuild, CharacterStats } from '@/types/plants';

interface Props {
  currentBuild: CharacterBuild;
  statBonuses?: CharacterStats;
  totalStats?: CharacterStats;
}

const props = withDefaults(defineProps<Props>(), {
  statBonuses: () => ({}),
  totalStats: () => ({})
});

interface Emits {
  (e: 'symbiant-removed', slot: string): void;
}

const emit = defineEmits<Emits>();

// Computed
const buildEfficiency = computed(() => {
  const slotsUsed = Object.keys(props.currentBuild.symbiants).length;
  const totalSlots = 13; // Total symbiant slots
  
  if (slotsUsed === 0) return null;
  
  // Simple efficiency calculation based on slot usage and stat bonuses
  const statCount = Object.keys(props.statBonuses).length;
  return (slotsUsed / totalSlots) * (statCount > 0 ? 1 : 0.5);
});

// Methods
const formatSlotName = (slot: string): string => {
  const slotNames: Record<string, string> = {
    'head': 'Head',
    'eye': 'Eye',
    'ear': 'Ear',
    'rarm': 'Right Arm',
    'chest': 'Chest',
    'larm': 'Left Arm',
    'waist': 'Waist',
    'rwrist': 'Right Wrist',
    'legs': 'Legs',
    'lwrist': 'Left Wrist',
    'rfinger': 'Right Finger',
    'feet': 'Feet',
    'lfinger': 'Left Finger'
  };
  return slotNames[slot] || slot;
};

const formatStatName = (statId: string): string => {
  const statNames: Record<string, string> = {
    'strength': 'Strength',
    'agility': 'Agility',
    'stamina': 'Stamina',
    'intelligence': 'Intelligence',
    'sense': 'Sense',
    'psychic': 'Psychic',
    'matter_creation': 'Matter Creation',
    'matter_metamorphosis': 'Matter Metamorphosis',
    'psychological_modifications': 'Psychological Modifications',
    'biological_metamorphosis': 'Biological Metamorphosis',
    'sensory_improvement': 'Sensory Improvement',
    'time_and_space': 'Time and Space'
  };
  return statNames[statId] || statId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const removeSymbiant = (slot: string) => {
  emit('symbiant-removed', slot);
};
</script>
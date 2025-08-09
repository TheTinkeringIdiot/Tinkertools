<!--
CharacterStatsPanel - Display and edit character base stats
Shows current stats and allows input for character building
-->
<template>
  <div class="character-stats-panel p-3">
    <div class="flex items-center justify-between mb-3">
      <h3 class="font-medium text-surface-900 dark:text-surface-100">
        <i class="pi pi-user mr-2"></i>
        Character Stats
      </h3>
      <Button
        v-if="editable"
        @click="resetStats"
        icon="pi pi-refresh"
        size="small"
        text
        severity="secondary"
        aria-label="Reset stats"
      />
    </div>
    
    <!-- Profile Info -->
    <div v-if="profile" class="mb-3 p-2 bg-surface-50 dark:bg-surface-800 rounded">
      <div class="text-sm font-medium">{{ profile.name }}</div>
      <div class="text-xs text-surface-500 dark:text-surface-400">
        Level {{ profile.level }} {{ profile.profession }}
      </div>
    </div>
    
    <!-- Base Stats -->
    <div class="space-y-2">
      <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
        Base Stats
      </h4>
      
      <div
        v-for="stat in baseStats"
        :key="stat.id"
        class="flex items-center justify-between"
      >
        <label :for="`stat-${stat.id}`" class="text-sm text-surface-600 dark:text-surface-400">
          {{ stat.name }}
        </label>
        <InputNumber
          v-if="editable"
          :id="`stat-${stat.id}`"
          v-model="stats[stat.id]"
          :min="1"
          :max="3000"
          :step="1"
          showButtons
          buttonLayout="horizontal"
          :pt="{ input: 'w-16 text-center' }"
          @input="onStatChange"
        />
        <span v-else class="text-sm font-medium text-surface-900 dark:text-surface-100">
          {{ stats[stat.id] || 0 }}
        </span>
      </div>
    </div>
    
    <!-- Nano Skills -->
    <div class="mt-4 space-y-2">
      <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
        Nano Skills
      </h4>
      
      <div
        v-for="skill in nanoSkills"
        :key="skill.id"
        class="flex items-center justify-between"
      >
        <label :for="`skill-${skill.id}`" class="text-sm text-surface-600 dark:text-surface-400">
          {{ skill.name }}
        </label>
        <InputNumber
          v-if="editable"
          :id="`skill-${skill.id}`"
          v-model="stats[skill.id]"
          :min="0"
          :max="3000"
          :step="1"
          showButtons
          buttonLayout="horizontal"
          :pt="{ input: 'w-16 text-center' }"
          @input="onStatChange"
        />
        <span v-else class="text-sm font-medium text-surface-900 dark:text-surface-100">
          {{ stats[skill.id] || 0 }}
        </span>
      </div>
    </div>
    
    <!-- Treatment -->
    <div class="mt-4">
      <div class="flex items-center justify-between">
        <label for="treatment" class="text-sm text-surface-600 dark:text-surface-400">
          Treatment
        </label>
        <InputNumber
          v-if="editable"
          id="treatment"
          v-model="stats.treatment"
          :min="0"
          :max="3000"
          :step="1"
          showButtons
          buttonLayout="horizontal"
          :pt="{ input: 'w-16 text-center' }"
          @input="onStatChange"
        />
        <span v-else class="text-sm font-medium text-surface-900 dark:text-surface-100">
          {{ stats.treatment || 0 }}
        </span>
      </div>
    </div>
    
    <!-- Quick Preset Buttons -->
    <div v-if="editable" class="mt-4 pt-3 border-t border-surface-200 dark:border-surface-700">
      <div class="text-xs text-surface-500 dark:text-surface-400 mb-2">
        Quick Presets:
      </div>
      <div class="flex flex-wrap gap-1">
        <Button
          @click="applyPreset('newbie')"
          label="Newbie"
          size="small"
          text
          severity="secondary"
        />
        <Button
          @click="applyPreset('mid')"
          label="Mid Level"
          size="small"
          text
          severity="secondary"
        />
        <Button
          @click="applyPreset('high')"
          label="High Level"
          size="small"
          text
          severity="secondary"
        />
        <Button
          @click="applyPreset('twink')"
          label="Twink"
          size="small"
          text
          severity="secondary"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';

import type { CharacterProfile, CharacterStats } from '@/types/plants';

// Props
interface Props {
  profile?: CharacterProfile | null;
  editable?: boolean;
  initialStats?: CharacterStats;
}

const props = withDefaults(defineProps<Props>(), {
  profile: null,
  editable: true,
  initialStats: () => ({})
});

// Emits
interface Emits {
  (e: 'stats-changed', stats: CharacterStats): void;
}

const emit = defineEmits<Emits>();

// Reactive state
const stats = ref<CharacterStats>({});

// Base stats configuration
const baseStats = [
  { id: 'strength', name: 'Strength' },
  { id: 'agility', name: 'Agility' },
  { id: 'stamina', name: 'Stamina' },
  { id: 'intelligence', name: 'Intelligence' },
  { id: 'sense', name: 'Sense' },
  { id: 'psychic', name: 'Psychic' }
];

// Nano skills configuration
const nanoSkills = [
  { id: 'matter_creation', name: 'Matter Creation' },
  { id: 'matter_metamorphosis', name: 'Matter Metamorphosis' },
  { id: 'psychological_modifications', name: 'Psychological Modifications' },
  { id: 'biological_metamorphosis', name: 'Biological Metamorphosis' },
  { id: 'sensory_improvement', name: 'Sensory Improvement' },
  { id: 'time_and_space', name: 'Time and Space' }
];

// Stat presets
const statPresets = {
  newbie: {
    strength: 100, agility: 100, stamina: 100, intelligence: 100, sense: 100, psychic: 100,
    matter_creation: 50, matter_metamorphosis: 50, psychological_modifications: 50,
    biological_metamorphosis: 50, sensory_improvement: 50, time_and_space: 50,
    treatment: 150
  },
  mid: {
    strength: 400, agility: 400, stamina: 400, intelligence: 400, sense: 400, psychic: 400,
    matter_creation: 300, matter_metamorphosis: 300, psychological_modifications: 300,
    biological_metamorphosis: 300, sensory_improvement: 300, time_and_space: 300,
    treatment: 800
  },
  high: {
    strength: 800, agility: 800, stamina: 800, intelligence: 800, sense: 800, psychic: 800,
    matter_creation: 700, matter_metamorphosis: 700, psychological_modifications: 700,
    biological_metamorphosis: 700, sensory_improvement: 700, time_and_space: 700,
    treatment: 1500
  },
  twink: {
    strength: 1200, agility: 1200, stamina: 1000, intelligence: 1200, sense: 1000, psychic: 1000,
    matter_creation: 1000, matter_metamorphosis: 1000, psychological_modifications: 1000,
    biological_metamorphosis: 1000, sensory_improvement: 1000, time_and_space: 1000,
    treatment: 2000
  }
};

// Methods
const onStatChange = () => {
  emit('stats-changed', { ...stats.value });
};

const resetStats = () => {
  stats.value = { ...props.initialStats };
  onStatChange();
};

const applyPreset = (presetName: keyof typeof statPresets) => {
  stats.value = { ...statPresets[presetName] };
  onStatChange();
};

// Initialize stats
onMounted(() => {
  if (props.profile?.stats) {
    stats.value = { ...props.profile.stats };
  } else if (props.initialStats) {
    stats.value = { ...props.initialStats };
  } else {
    // Set default values
    stats.value = { ...statPresets.newbie };
  }
});

// Watch for profile changes
watch(() => props.profile, (newProfile) => {
  if (newProfile?.stats) {
    stats.value = { ...newProfile.stats };
    onStatChange();
  }
}, { deep: true });
</script>
<!--
CharacterStatsSection - Character stats input for TinkerFite

Inputs (7 fields):
- Breed (Dropdown: Solitus=1, Opifex=2, Nanomage=3, Atrox=4)
- Level (InputNumber: 1-220)
- Profession (Dropdown: 0-15)
- Side (Dropdown: Neutral=0, Clan=1, Omni=2)
- Critical Increase (InputNumber: 0+)
- Target AC (InputNumber: 0+)
- Aggdef Slider (Slider: -100 to +100, default 75)
-->
<template>
  <div
    class="bg-surface-0 dark:bg-surface-950 rounded-lg shadow-md dark:shadow-none border border-surface-200 dark:border-surface-700 p-6"
  >
    <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4">
      Character Stats
    </h3>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Breed Dropdown -->
      <div class="flex flex-col">
        <label for="breed" class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          Breed
        </label>
        <Dropdown
          id="breed"
          v-model="localStats.breed"
          :options="breedOptions"
          option-label="name"
          option-value="id"
          placeholder="Select breed"
          class="w-full"
          @change="onFieldChange"
        />
      </div>

      <!-- Level -->
      <div class="flex flex-col">
        <label
          for="level-input"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Level
        </label>
        <InputNumber
          id="level-input"
          v-model="localStats.level"
          :min="1"
          :max="220"
          :step="1"
          class="w-full"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Profession Dropdown -->
      <div class="flex flex-col">
        <label
          for="profession"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Profession
        </label>
        <Dropdown
          id="profession"
          v-model="localStats.profession"
          :options="professionOptions"
          option-label="name"
          option-value="id"
          placeholder="Select profession"
          class="w-full"
          @change="onFieldChange"
        />
      </div>

      <!-- Side Dropdown -->
      <div class="flex flex-col">
        <label for="side" class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          Side
        </label>
        <Dropdown
          id="side"
          v-model="localStats.side"
          :options="sideOptions"
          option-label="name"
          option-value="id"
          placeholder="Select side"
          class="w-full"
          @change="onFieldChange"
        />
      </div>

      <!-- Critical Increase -->
      <div class="flex flex-col">
        <label
          for="crit"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Critical Increase
        </label>
        <InputNumber
          id="crit"
          v-model="localStats.crit"
          :min="0"
          :max="5000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Target AC -->
      <div class="flex flex-col">
        <label
          for="targetAC"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Target AC
        </label>
        <InputNumber
          id="targetAC"
          v-model="localStats.targetAC"
          :min="0"
          :max="5000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Aggdef Slider -->
      <div class="flex flex-col md:col-span-2 lg:col-span-3">
        <label
          for="aggdef"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Agg/Def Slider: {{ localStats.aggdef }}
        </label>
        <Slider
          id="aggdef"
          v-model="localStats.aggdef"
          :min="-100"
          :max="100"
          :step="1"
          class="w-full"
          @update:model-value="onFieldChange"
        />
        <div class="flex justify-between text-xs text-surface-500 mt-1">
          <span>Full Def (-100)</span>
          <span>Neutral (0)</span>
          <span>Full Agg (+100)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import Dropdown from 'primevue/dropdown';
import InputNumber from 'primevue/inputnumber';
import Slider from 'primevue/slider';
import type { CharacterStats } from '@/types/weapon-analysis';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';

// Props
interface Props {
  characterStats: CharacterStats;
  profile?: TinkerProfile | null;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:characterStats': [stats: CharacterStats];
}>();

// Local state for two-way binding
const localStats = ref<CharacterStats>({ ...props.characterStats });

// Programmatic update flag to prevent watcher loops
const isProgrammaticUpdate = ref(false);

// Breed options (IDs 1-4 for player breeds)
const breedOptions = [
  { id: 1, name: 'Solitus' },
  { id: 2, name: 'Opifex' },
  { id: 3, name: 'Nanomage' },
  { id: 4, name: 'Atrox' },
];

// Profession options (0-15, matching game-data.ts PROFESSION)
const professionOptions = [
  { id: 0, name: 'Any' },
  { id: 1, name: 'Soldier' },
  { id: 2, name: 'Martial Artist' },
  { id: 3, name: 'Engineer' },
  { id: 4, name: 'Fixer' },
  { id: 5, name: 'Agent' },
  { id: 6, name: 'Adventurer' },
  { id: 7, name: 'Trader' },
  { id: 8, name: 'Bureaucrat' },
  { id: 9, name: 'Enforcer' },
  { id: 10, name: 'Doctor' },
  { id: 11, name: 'Nano-Technician' },
  { id: 12, name: 'Meta-Physicist' },
  { id: 14, name: 'Keeper' },
  { id: 15, name: 'Shade' },
];

// Side options
const sideOptions = [
  { id: 0, name: 'Neutral' },
  { id: 1, name: 'Clan' },
  { id: 2, name: 'Omni' },
];

// Handle field changes - emit updates to parent
const onFieldChange = () => {
  if (!isProgrammaticUpdate.value) {
    emit('update:characterStats', { ...localStats.value });
  }
};

// Watch for prop changes from parent (external updates)
watch(
  () => props.characterStats,
  (newStats) => {
    isProgrammaticUpdate.value = true;
    localStats.value = { ...newStats };
    setTimeout(() => {
      isProgrammaticUpdate.value = false;
    }, 10);
  },
  { deep: true }
);

// Auto-populate from profile when profile changes
watch(
  () => props.profile?.Character.Breed,
  (newBreed) => {
    if (newBreed !== undefined && !isProgrammaticUpdate.value) {
      isProgrammaticUpdate.value = true;
      localStats.value.breed = newBreed as number;
      setTimeout(() => {
        isProgrammaticUpdate.value = false;
        emit('update:characterStats', { ...localStats.value });
      }, 10);
    }
  },
  { immediate: true }
);

watch(
  () => props.profile?.Character.Level,
  (newLevel) => {
    if (newLevel !== undefined && !isProgrammaticUpdate.value) {
      isProgrammaticUpdate.value = true;
      localStats.value.level = newLevel;
      setTimeout(() => {
        isProgrammaticUpdate.value = false;
        emit('update:characterStats', { ...localStats.value });
      }, 10);
    }
  },
  { immediate: true }
);

watch(
  () => props.profile?.Character.Profession,
  (newProf) => {
    if (newProf !== undefined && !isProgrammaticUpdate.value) {
      isProgrammaticUpdate.value = true;
      localStats.value.profession = newProf;
      setTimeout(() => {
        isProgrammaticUpdate.value = false;
        emit('update:characterStats', { ...localStats.value });
      }, 10);
    }
  },
  { immediate: true }
);

// Watch for side (derived from Faction)
watch(
  () => props.profile?.Character.Faction,
  (newFaction) => {
    if (newFaction !== undefined && !isProgrammaticUpdate.value) {
      isProgrammaticUpdate.value = true;
      const faction = newFaction.toLowerCase();
      localStats.value.side = faction === 'clan' ? 1 : faction === 'omni' ? 2 : 0;
      setTimeout(() => {
        isProgrammaticUpdate.value = false;
        emit('update:characterStats', { ...localStats.value });
      }, 10);
    }
  },
  { immediate: true }
);

// Watch for Critical Increase (skill 379)
watch(
  () => props.profile?.skills[379]?.total,
  (newCrit) => {
    if (newCrit !== undefined && !isProgrammaticUpdate.value) {
      isProgrammaticUpdate.value = true;
      localStats.value.crit = newCrit;
      setTimeout(() => {
        isProgrammaticUpdate.value = false;
        emit('update:characterStats', { ...localStats.value });
      }, 10);
    }
  },
  { immediate: true }
);
</script>

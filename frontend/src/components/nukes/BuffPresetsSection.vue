<!--
BuffPresetsSection - Buff level selection component for TinkerNukes

Provides dropdown selection for 6 key offensive nano buffs:
- Crunchcom (nano cost reduction)
- Humidity (nano regen)
- Notum Siphon (nano regen)
- Channeling of Notum (nano regen)
- Enhance Nano Damage (damage bonus)
- Ancient Matrix (damage bonus)

Stores numeric level IDs (0-10), displays formatted strings with effect values.
Auto-populates from active TinkerProfile buff names when available.
-->
<template>
  <div class="buff-presets-section space-y-4">
    <div class="section-header">
      <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-100">
        Buff Presets
      </h3>
      <p class="text-sm text-surface-600 dark:text-surface-400 mt-1">
        Select active buff levels to adjust nano cost, damage, and regeneration calculations
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Crunchcom (Nano Cost Reduction) -->
      <div class="field">
        <label for="crunchcom" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Crunchcom <span class="text-surface-500 dark:text-surface-400">(Cost Reduction)</span>
        </label>
        <Dropdown
          id="crunchcom"
          v-model="buffLevels.crunchcom"
          :options="crunchcomOptions"
          option-label="label"
          option-value="level"
          placeholder="Select level"
          class="w-full"
          @change="onBuffChange"
        />
      </div>

      <!-- Humidity (Nano Regen) -->
      <div class="field">
        <label for="humidity" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Humidity <span class="text-surface-500 dark:text-surface-400">(Nano Regen)</span>
        </label>
        <Dropdown
          id="humidity"
          v-model="buffLevels.humidity"
          :options="humidityOptions"
          option-label="label"
          option-value="level"
          placeholder="Select level"
          class="w-full"
          @change="onBuffChange"
        />
      </div>

      <!-- Notum Siphon (Nano Regen) -->
      <div class="field">
        <label for="notumSiphon" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Notum Siphon <span class="text-surface-500 dark:text-surface-400">(Nano Regen)</span>
        </label>
        <Dropdown
          id="notumSiphon"
          v-model="buffLevels.notumSiphon"
          :options="notumSiphonOptions"
          option-label="label"
          option-value="level"
          placeholder="Select level"
          class="w-full"
          @change="onBuffChange"
        />
      </div>

      <!-- Channeling of Notum (Nano Regen) -->
      <div class="field">
        <label for="channeling" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Channeling of Notum <span class="text-surface-500 dark:text-surface-400">(Nano Regen)</span>
        </label>
        <Dropdown
          id="channeling"
          v-model="buffLevels.channeling"
          :options="channelingOptions"
          option-label="label"
          option-value="level"
          placeholder="Select level"
          class="w-full"
          @change="onBuffChange"
        />
      </div>

      <!-- Enhance Nano Damage -->
      <div class="field">
        <label for="enhanceNanoDamage" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Enhance Nano Damage <span class="text-surface-500 dark:text-surface-400">(Damage %)</span>
        </label>
        <Dropdown
          id="enhanceNanoDamage"
          v-model="buffLevels.enhanceNanoDamage"
          :options="enhanceNanoDamageOptions"
          option-label="label"
          option-value="level"
          placeholder="Select level"
          class="w-full"
          @change="onBuffChange"
        />
      </div>

      <!-- Ancient Matrix -->
      <div class="field">
        <label for="ancientMatrix" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Ancient Matrix <span class="text-surface-500 dark:text-surface-400">(Damage %)</span>
        </label>
        <Dropdown
          id="ancientMatrix"
          v-model="buffLevels.ancientMatrix"
          :options="ancientMatrixOptions"
          option-label="label"
          option-value="level"
          placeholder="Select level"
          class="w-full"
          @change="onBuffChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import Dropdown from 'primevue/dropdown';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import type { BuffPresets } from '@/types/offensive-nano';
import {
  CRUNCHCOM_COST_REDUCTION,
  HUMIDITY_REGEN,
  NOTUM_SIPHON_REGEN,
  CHANNELING_REGEN,
  ENHANCE_NANO_DAMAGE,
  ANCIENT_MATRIX_DAMAGE,
} from '@/utils/nuke-regen-calculations';

// Props
const props = defineProps<{
  buffPresets: BuffPresets;
  profile?: TinkerProfile | null;
}>();

// Emits
const emit = defineEmits<{
  'update:buffPresets': [buffPresets: BuffPresets];
}>();

interface BuffOption {
  level: number;
  label: string;
}

// State - Initialize from props
const buffLevels = ref<BuffPresets>({
  crunchcom: props.buffPresets.crunchcom,
  humidity: props.buffPresets.humidity,
  notumSiphon: props.buffPresets.notumSiphon,
  channeling: props.buffPresets.channeling,
  enhanceNanoDamage: props.buffPresets.enhanceNanoDamage,
  ancientMatrix: props.buffPresets.ancientMatrix,
});

// Flags for preventing watcher loops
const isProgrammaticUpdate = ref(false);

// Dropdown options generation
const crunchcomOptions = ref<BuffOption[]>(
  Object.entries(CRUNCHCOM_COST_REDUCTION).map(([level, value]) => ({
    level: Number(level),
    label: Number(level) === 0 ? 'None' : `Crunchcom ${level} (${value}% cost reduction)`,
  }))
);

const humidityOptions = ref<BuffOption[]>(
  Object.entries(HUMIDITY_REGEN).map(([level, value]) => ({
    level: Number(level),
    label: Number(level) === 0 ? 'None' : `Humidity ${level} (${value}/s regen)`,
  }))
);

const notumSiphonOptions = ref<BuffOption[]>(
  Object.entries(NOTUM_SIPHON_REGEN).map(([level, value]) => ({
    level: Number(level),
    label: Number(level) === 0 ? 'None' : `Notum Siphon ${level} (${value}/s regen)`,
  }))
);

const channelingOptions = ref<BuffOption[]>(
  Object.entries(CHANNELING_REGEN).map(([level, value]) => ({
    level: Number(level),
    label: Number(level) === 0 ? 'None' : `Channeling ${level} (${value}/s regen)`,
  }))
);

const enhanceNanoDamageOptions = ref<BuffOption[]>(
  Object.entries(ENHANCE_NANO_DAMAGE).map(([level, value]) => ({
    level: Number(level),
    label: Number(level) === 0 ? 'None' : `Enhance Nano Damage ${level} (${value}% damage)`,
  }))
);

const ancientMatrixOptions = ref<BuffOption[]>(
  Object.entries(ANCIENT_MATRIX_DAMAGE).map(([level, value]) => ({
    level: Number(level),
    label: Number(level) === 0 ? 'None' : `Ancient Matrix ${level} (${value}% damage)`,
  }))
);

// Buff name patterns for matching profile buffs
const BUFF_NAME_PATTERNS = {
  crunchcom: /crunchcom/i,
  humidity: /humidity/i,
  notumSiphon: /notum\s*siphon/i,
  channeling: /channeling/i,
  enhanceNanoDamage: /enhance\s*nano\s*damage/i,
  ancientMatrix: /ancient\s*matrix/i,
};

/**
 * Extract buff level from item name
 * Examples: "Crunchcom VII" -> 7, "Humidity V" -> 5
 */
function extractBuffLevel(itemName: string): number {
  const romanNumerals: Record<string, number> = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
    'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
  };

  // Try to match Roman numeral at end of name
  const match = itemName.match(/\b([IVX]+)\b$/);
  if (match && match[1] in romanNumerals) {
    return romanNumerals[match[1]];
  }

  // Try to match numeric level (e.g., "Crunchcom 7")
  const numMatch = itemName.match(/\b(\d+)\b$/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }

  return 0;
}

/**
 * Auto-populate buff levels from active profile's buff items
 */
function populateFromProfile(): void {
  if (!props.profile?.buffs || props.profile.buffs.length === 0) {
    return;
  }

  isProgrammaticUpdate.value = true;

  // Reset to defaults
  const newLevels: BuffPresets = {
    crunchcom: 0,
    humidity: 0,
    notumSiphon: 0,
    channeling: 0,
    enhanceNanoDamage: 0,
    ancientMatrix: 0,
  };

  // Match buffs by name patterns
  for (const buff of props.profile.buffs) {
    if (!buff?.name) continue;

    if (BUFF_NAME_PATTERNS.crunchcom.test(buff.name)) {
      newLevels.crunchcom = extractBuffLevel(buff.name);
    } else if (BUFF_NAME_PATTERNS.humidity.test(buff.name)) {
      newLevels.humidity = extractBuffLevel(buff.name);
    } else if (BUFF_NAME_PATTERNS.notumSiphon.test(buff.name)) {
      newLevels.notumSiphon = extractBuffLevel(buff.name);
    } else if (BUFF_NAME_PATTERNS.channeling.test(buff.name)) {
      newLevels.channeling = extractBuffLevel(buff.name);
    } else if (BUFF_NAME_PATTERNS.enhanceNanoDamage.test(buff.name)) {
      newLevels.enhanceNanoDamage = extractBuffLevel(buff.name);
    } else if (BUFF_NAME_PATTERNS.ancientMatrix.test(buff.name)) {
      newLevels.ancientMatrix = extractBuffLevel(buff.name);
    }
  }

  buffLevels.value = newLevels;

  // Emit updated values
  emit('update:buffPresets', newLevels);

  isProgrammaticUpdate.value = false;
}

/**
 * Handle buff level changes
 */
function onBuffChange(): void {
  // Prevent emission during programmatic updates
  if (isProgrammaticUpdate.value) {
    return;
  }

  emit('update:buffPresets', { ...buffLevels.value });
}

// Watch for buffPresets prop changes
watch(
  () => props.buffPresets,
  (newPresets) => {
    if (!isProgrammaticUpdate.value) {
      isProgrammaticUpdate.value = true;
      buffLevels.value = { ...newPresets };
      isProgrammaticUpdate.value = false;
    }
  },
  { deep: true }
);

// Watch for profile buff changes
watch(
  () => props.profile?.buffs,
  () => {
    populateFromProfile();
  },
  { immediate: true, deep: true }
);
</script>

<style scoped>
.buff-presets-section {
  @apply p-4 bg-surface-50 dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700;
}

.section-header {
  @apply mb-4 pb-3 border-b border-surface-200 dark:border-surface-700;
}

.field {
  @apply flex flex-col;
}

.field label {
  @apply text-sm font-medium text-surface-700 dark:text-surface-300;
}

/* Dropdown styling - rely on PrimeVue defaults with Aura theme */
:deep(.p-dropdown) {
  @apply w-full;
}
</style>

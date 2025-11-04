<!--
NukeInputForm - Master form component for TinkerNukes input fields

Composes three section components (CharacterStats, DamageModifiers, BuffPresets)
into a unified form with profile auto-population and state management.

Implements:
- FR-9: Auto-update stat 536 when Enhance Nano Damage or Ancient Matrix change
- FR-10: Profile state management with modification tracking
- Consolidated NukeInputState (27 fields) with debounced emission
- "Reset to Profile" button to clear manual overrides
-->
<template>
  <div class="nuke-input-form">
    <!-- Header with Reset Button -->
    <div class="form-header mb-4 flex justify-between items-center">
      <h2 class="text-xl font-bold text-surface-900 dark:text-surface-50">
        Offensive Nano Parameters
      </h2>
      <Button
        label="Reset to Profile"
        icon="pi pi-refresh"
        severity="secondary"
        size="small"
        :disabled="!activeProfile"
        @click="resetToProfile"
        v-tooltip.bottom="'Clear manual edits and restore profile values'"
      />
    </div>

    <!-- Form Sections in Accordion -->
    <Accordion :multiple="true" :active-index="[]">
      <!-- Character Stats Section -->
      <AccordionTab header="Character Stats">
        <CharacterStatsSection
          :character-stats="localInputState.characterStats"
          :profile="activeProfile"
          @update:character-stats="onCharacterStatsUpdate"
        />
      </AccordionTab>

      <!-- Damage Modifiers Section -->
      <AccordionTab header="Damage Modifiers">
        <DamageModifiersSection
          :damage-modifiers="localInputState.damageModifiers"
          :enhance-nano-damage="localInputState.buffPresets.enhanceNanoDamage"
          :ancient-matrix="localInputState.buffPresets.ancientMatrix"
          :profile="activeProfile"
          @update:damage-modifiers="onDamageModifiersUpdate"
        />
      </AccordionTab>

      <!-- Buff Presets Section -->
      <AccordionTab header="Buff Presets">
        <BuffPresetsSection
          :buff-presets="localInputState.buffPresets"
          :profile="activeProfile"
          @update:buff-presets="onBuffPresetsUpdate"
        />
      </AccordionTab>
    </Accordion>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import Button from 'primevue/button';
import CharacterStatsSection from './CharacterStatsSection.vue';
import DamageModifiersSection from './DamageModifiersSection.vue';
import BuffPresetsSection from './BuffPresetsSection.vue';
import type {
  NukeInputState,
  CharacterStats,
  DamageModifiers,
  BuffPresets,
} from '@/types/offensive-nano';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import { ENHANCE_NANO_DAMAGE, ANCIENT_MATRIX_DAMAGE } from '@/utils/nuke-regen-calculations';

// Props
interface Props {
  inputState: NukeInputState;
  activeProfile?: Readonly<TinkerProfile> | TinkerProfile | null;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:inputState': [state: NukeInputState];
}>();

// Local state - consolidated input state
const localInputState = ref<NukeInputState>({ ...props.inputState });

// Track which fields have been manually modified by user
// Prevents auto-update of user-edited fields on profile change
const modifiedFields = ref<Set<string>>(new Set());

// Flag to indicate programmatic update (bypass modification tracking)
const isProgrammaticUpdate = ref(false);

// Debounce timer for emitting updates
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Emit updated input state to parent with 50ms debounce
 */
function emitInputState(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    emit('update:inputState', { ...localInputState.value });
    debounceTimer = null;
  }, 50);
}

/**
 * Handle CharacterStats section updates
 */
function onCharacterStatsUpdate(stats: CharacterStats): void {
  if (!isProgrammaticUpdate.value) {
    // Track all character stat fields as modified
    Object.keys(stats).forEach((key) => {
      modifiedFields.value.add(`characterStats.${key}`);
    });
  }

  localInputState.value.characterStats = { ...stats };
  emitInputState();
}

/**
 * Handle DamageModifiers section updates
 */
function onDamageModifiersUpdate(modifiers: DamageModifiers): void {
  if (!isProgrammaticUpdate.value) {
    // Track all damage modifier fields as modified
    Object.keys(modifiers).forEach((key) => {
      modifiedFields.value.add(`damageModifiers.${key}`);
    });
  }

  localInputState.value.damageModifiers = { ...modifiers };
  emitInputState();
}

/**
 * Handle BuffPresets section updates
 * Triggers FR-9: Auto-update stat 536 when buffs change
 */
function onBuffPresetsUpdate(buffs: BuffPresets): void {
  if (!isProgrammaticUpdate.value) {
    // Track all buff preset fields as modified
    Object.keys(buffs).forEach((key) => {
      modifiedFields.value.add(`buffPresets.${key}`);
    });
  }

  localInputState.value.buffPresets = { ...buffs };

  // FR-9: Recalculate stat 536 (Direct Nano Damage Efficiency) when buff dropdowns change
  // This is handled by DamageModifiersSection's computed property, but we trigger emission
  emitInputState();
}

/**
 * Auto-populate all fields from active profile
 * Called on profile switch or mount
 */
function populateFromProfile(): void {
  if (!props.activeProfile) {
    // No profile: reset to defaults
    resetToDefaults();
    return;
  }

  // Check if profile is Nanotechnician (profession ID 11)
  const isNanotech = props.activeProfile.Character?.Profession === 11;

  if (!isNanotech) {
    // Not a Nanotechnician: reset to defaults
    resetToDefaults();
    return;
  }

  // Set programmatic update flag to bypass modification tracking
  isProgrammaticUpdate.value = true;

  // Auto-populate character stats from profile
  const skills = props.activeProfile.skills || {};

  localInputState.value.characterStats = {
    breed: (props.activeProfile.Character?.Breed || 1) as 1 | 2 | 3 | 4,
    level: props.activeProfile.Character?.Level || 1,
    psychic: skills[21]?.total || 6,
    nanoInit: skills[149]?.total || 1,
    maxNano: props.activeProfile.Character?.MaxNano || 1,
    nanoDelta: skills[364]?.total || 1,
    matterCreation: skills[130]?.total || 1,
    matterMeta: skills[127]?.total || 1,
    bioMeta: skills[128]?.total || 1,
    psychModi: skills[129]?.total || 1,
    sensoryImp: skills[122]?.total || 1,
    timeSpace: skills[131]?.total || 1,
    spec: props.activeProfile.Character?.Specialization ?? 0,
  };

  // Auto-populate damage modifiers from profile
  localInputState.value.damageModifiers = {
    projectile: skills[278]?.total || 0,
    melee: skills[279]?.total || 0,
    energy: skills[280]?.total || 0,
    chemical: skills[281]?.total || 0,
    radiation: skills[282]?.total || 0,
    cold: skills[311]?.total || 0,
    nano: skills[315]?.total || 0,
    fire: skills[316]?.total || 0,
    poison: skills[317]?.total || 0,
    directNanoDamageEfficiency: calculateStat536(),
    targetAC: 0, // Default to 0, not from profile
  };

  // Auto-populate buff presets from profile
  // BuffPresetsSection handles this internally via profile watcher
  // We just need to ensure the buff values are propagated
  // The section will extract buff levels from profile.buffs array

  // Emit updated state
  emitInputState();

  // Clear programmatic flag after a brief delay
  setTimeout(() => {
    isProgrammaticUpdate.value = false;
  }, 10);
}

/**
 * Calculate stat 536 (Direct Nano Damage Efficiency)
 * FR-9: baseValue + enhanceNanoDamage + ancientMatrix
 */
function calculateStat536(): number {
  const baseValue = props.activeProfile?.skills?.[536]?.total || 0;
  const enhanceBonus =
    ENHANCE_NANO_DAMAGE[localInputState.value.buffPresets.enhanceNanoDamage] || 0;
  const ancientBonus = ANCIENT_MATRIX_DAMAGE[localInputState.value.buffPresets.ancientMatrix] || 0;

  return Number((baseValue + enhanceBonus + ancientBonus).toFixed(2));
}

/**
 * Reset all fields to default values
 * Called when no profile or profile is not Nanotechnician
 */
function resetToDefaults(): void {
  isProgrammaticUpdate.value = true;

  localInputState.value = {
    characterStats: {
      breed: 1,
      level: 1,
      psychic: 6,
      nanoInit: 1,
      maxNano: 1,
      nanoDelta: 1,
      matterCreation: 1,
      matterMeta: 1,
      bioMeta: 1,
      psychModi: 1,
      sensoryImp: 1,
      timeSpace: 1,
      spec: 0,
    },
    damageModifiers: {
      projectile: 0,
      melee: 0,
      energy: 0,
      chemical: 0,
      radiation: 0,
      cold: 0,
      nano: 0,
      fire: 0,
      poison: 0,
      directNanoDamageEfficiency: 0,
      targetAC: 0,
    },
    buffPresets: {
      crunchcom: 0,
      humidity: 0,
      notumSiphon: 0,
      channeling: 0,
      enhanceNanoDamage: 0,
      ancientMatrix: 0,
    },
  };

  emitInputState();

  setTimeout(() => {
    isProgrammaticUpdate.value = false;
  }, 10);
}

/**
 * Reset to Profile button handler
 * Clears manual overrides and repopulates from active profile
 */
function resetToProfile(): void {
  // Clear all modification tracking
  modifiedFields.value.clear();

  // Repopulate from profile
  populateFromProfile();
}

// Watch for prop inputState changes (external updates from parent)
watch(
  () => props.inputState,
  (newState) => {
    if (!isProgrammaticUpdate.value) {
      isProgrammaticUpdate.value = true;
      localInputState.value = { ...newState };
      setTimeout(() => {
        isProgrammaticUpdate.value = false;
      }, 10);
    }
  },
  { deep: true }
);

// Watch for active profile changes
// FR-10: On profile switch, auto-populate if Nanotechnician, else reset
watch(
  () => props.activeProfile,
  () => {
    // Clear modification tracking on profile switch
    modifiedFields.value.clear();

    // Set programmatic flag during profile switch
    isProgrammaticUpdate.value = true;

    // Auto-populate from new profile
    populateFromProfile();

    // Clear flag after brief delay
    setTimeout(() => {
      isProgrammaticUpdate.value = false;
    }, 10);
  },
  { immediate: true }
);

// Watch buff presets for changes to enhanceNanoDamage or ancientMatrix
// FR-9: Auto-update stat 536 when these buffs change
watch(
  () =>
    [
      localInputState.value.buffPresets.enhanceNanoDamage,
      localInputState.value.buffPresets.ancientMatrix,
    ] as const,
  () => {
    // Recalculate stat 536 and update damage modifiers
    if (!isProgrammaticUpdate.value) {
      const newStat536 = calculateStat536();
      localInputState.value.damageModifiers.directNanoDamageEfficiency = newStat536;
      emitInputState();
    }
  },
  { deep: true }
);
</script>

<style scoped>
.nuke-input-form {
  @apply space-y-4;
}

.form-header {
  @apply px-2;
}

/* Ensure accordion panels are all open by default */
:deep(.p-accordion-tab) {
  @apply mb-2;
}

:deep(.p-accordion-content) {
  @apply pt-4;
}
</style>

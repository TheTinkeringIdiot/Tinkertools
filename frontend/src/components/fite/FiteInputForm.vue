<!--
FiteInputForm - Master form component for TinkerFite input fields

Orchestrates 5 section components into a unified form with profile auto-population
and debounced state management.

Sections:
- CharacterStatsSection
- WeaponSkillsSection
- SpecialAttackSection
- InitiativeSection
- CombatBonusesSection
-->
<template>
  <div class="fite-input-form">
    <!-- Header with Action Buttons -->
    <div class="form-header mb-4 flex justify-between items-center">
      <h2 class="text-xl font-bold text-surface-900 dark:text-surface-50">
        Weapon Analysis Parameters
      </h2>
      <div class="flex gap-2">
        <Button
          label="Update Weapons"
          icon="pi pi-sync"
          severity="primary"
          size="small"
          :disabled="!activeProfile"
          @click="updateWeapons"
          v-tooltip.bottom="'Fetch weapons from server with current parameters'"
          style="border: 2px solid #14b8a6"
        />
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
    </div>

    <!-- Form Sections in Accordion -->
    <Accordion :multiple="true" :active-index="[0]">
      <!-- Character Stats Section -->
      <AccordionTab header="Character Stats">
        <CharacterStatsSection
          :character-stats="localInputState.characterStats"
          :profile="activeProfile"
          @update:character-stats="onCharacterStatsUpdate"
        />
      </AccordionTab>

      <!-- Weapon Skills Section -->
      <AccordionTab header="Weapon Skills">
        <WeaponSkillsSection
          :weapon-skills="localInputState.weaponSkills"
          :wrangle="localInputState.combatBonuses.wrangle"
          :profile="activeProfile"
          @update:weapon-skills="onWeaponSkillsUpdate"
          @update:wrangle="onWrangleUpdate"
        />
      </AccordionTab>

      <!-- Special Attacks Section -->
      <AccordionTab header="Special Attacks">
        <SpecialAttackSection
          :special-attacks="localInputState.specialAttacks"
          :profile="activeProfile"
          @update:special-attacks="onSpecialAttacksUpdate"
        />
      </AccordionTab>

      <!-- Initiative Section -->
      <AccordionTab header="Initiative">
        <InitiativeSection
          :initiative="localInputState.initiative"
          :profile="activeProfile"
          @update:initiative="onInitiativeUpdate"
        />
      </AccordionTab>

      <!-- Combat Bonuses Section -->
      <AccordionTab header="Combat Bonuses">
        <CombatBonusesSection
          :combat-bonuses="localInputState.combatBonuses"
          :profile="activeProfile"
          @update:combat-bonuses="onCombatBonusesUpdate"
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
import WeaponSkillsSection from './WeaponSkillsSection.vue';
import SpecialAttackSection from './SpecialAttackSection.vue';
import InitiativeSection from './InitiativeSection.vue';
import CombatBonusesSection from './CombatBonusesSection.vue';
import type {
  FiteInputState,
  CharacterStats,
  Initiative,
  CombatBonuses,
} from '@/types/weapon-analysis';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import {
  WEAPON_SKILL_IDS,
  SPECIAL_ATTACK_IDS,
  INITIATIVE_IDS,
  DAMAGE_MODIFIER_IDS,
} from '@/types/weapon-analysis';

// Props
interface Props {
  inputState: FiteInputState;
  activeProfile?: Readonly<TinkerProfile> | TinkerProfile | null;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:inputState': [state: FiteInputState];
  'update-weapons': [];
}>();

// Local state - consolidated input state
const localInputState = ref<FiteInputState>({ ...props.inputState });

// Track which fields have been manually modified by user
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
    Object.keys(stats).forEach((key) => {
      modifiedFields.value.add(`characterStats.${key}`);
    });
  }

  localInputState.value.characterStats = { ...stats };
  emitInputState();
}

/**
 * Handle WeaponSkills section updates
 */
function onWeaponSkillsUpdate(skills: Record<number, number>): void {
  if (!isProgrammaticUpdate.value) {
    Object.keys(skills).forEach((key) => {
      modifiedFields.value.add(`weaponSkills.${key}`);
    });
  }

  localInputState.value.weaponSkills = { ...skills };
  emitInputState();
}

/**
 * Handle Wrangle updates
 */
function onWrangleUpdate(wrangle: number): void {
  if (!isProgrammaticUpdate.value) {
    modifiedFields.value.add('combatBonuses.wrangle');
  }

  localInputState.value.combatBonuses.wrangle = wrangle;
  emitInputState();
}

/**
 * Handle SpecialAttacks section updates
 */
function onSpecialAttacksUpdate(attacks: Record<number, number>): void {
  if (!isProgrammaticUpdate.value) {
    Object.keys(attacks).forEach((key) => {
      modifiedFields.value.add(`specialAttacks.${key}`);
    });
  }

  localInputState.value.specialAttacks = { ...attacks };
  emitInputState();
}

/**
 * Handle Initiative section updates
 */
function onInitiativeUpdate(initiative: Initiative): void {
  if (!isProgrammaticUpdate.value) {
    Object.keys(initiative).forEach((key) => {
      modifiedFields.value.add(`initiative.${key}`);
    });
  }

  localInputState.value.initiative = { ...initiative };
  emitInputState();
}

/**
 * Handle CombatBonuses section updates
 */
function onCombatBonusesUpdate(bonuses: CombatBonuses): void {
  if (!isProgrammaticUpdate.value) {
    Object.keys(bonuses).forEach((key) => {
      modifiedFields.value.add(`combatBonuses.${key}`);
    });
  }

  localInputState.value.combatBonuses = { ...bonuses };
  emitInputState();
}

/**
 * Auto-populate all fields from active profile
 * Called on profile switch or mount
 */
function populateFromProfile(): void {
  if (!props.activeProfile) {
    resetToDefaults();
    return;
  }

  isProgrammaticUpdate.value = true;
  const profile = props.activeProfile;

  // Character stats
  localInputState.value.characterStats = {
    breed: profile.Character.Breed || 1,
    level: profile.Character.Level || 1,
    profession: profile.Character.Profession || 0,
    side: (() => {
      const faction = profile.Character.Faction?.toLowerCase() || 'neutral';
      return faction === 'clan' ? 1 : faction === 'omni' ? 2 : 0;
    })(),
    crit: profile.skills[379]?.total || 0,
    targetAC: 0, // User input, not from profile
    aggdef: 75, // Default value
  };

  // Weapon skills (17 skills)
  const weaponSkillIds = [
    WEAPON_SKILL_IDS.MARTIAL_ARTS,
    WEAPON_SKILL_IDS.MULTI_MELEE,
    WEAPON_SKILL_IDS.ONE_H_BLUNT,
    WEAPON_SKILL_IDS.ONE_H_EDGED,
    WEAPON_SKILL_IDS.MELEE_ENERGY,
    WEAPON_SKILL_IDS.TWO_H_EDGED,
    WEAPON_SKILL_IDS.PIERCING,
    WEAPON_SKILL_IDS.TWO_H_BLUNT,
    WEAPON_SKILL_IDS.SHARP_OBJECTS,
    WEAPON_SKILL_IDS.GRENADE,
    WEAPON_SKILL_IDS.HEAVY_WEAPONS,
    WEAPON_SKILL_IDS.BOW,
    WEAPON_SKILL_IDS.PISTOL,
    WEAPON_SKILL_IDS.RIFLE,
    WEAPON_SKILL_IDS.MG_SMG,
    WEAPON_SKILL_IDS.SHOTGUN,
    WEAPON_SKILL_IDS.ASSAULT_RIFLE,
    WEAPON_SKILL_IDS.RANGED_ENERGY,
    WEAPON_SKILL_IDS.MULTI_RANGED,
  ];

  weaponSkillIds.forEach((id) => {
    localInputState.value.weaponSkills[id] = profile.skills[id]?.total || 0;
  });

  // Special attacks (8 skills)
  const specialAttackIds = [
    SPECIAL_ATTACK_IDS.AIMED_SHOT,
    SPECIAL_ATTACK_IDS.BRAWL,
    SPECIAL_ATTACK_IDS.BURST,
    SPECIAL_ATTACK_IDS.DIMACH,
    SPECIAL_ATTACK_IDS.FAST_ATTACK,
    SPECIAL_ATTACK_IDS.FLING_SHOT,
    SPECIAL_ATTACK_IDS.FULL_AUTO,
    SPECIAL_ATTACK_IDS.SNEAK_ATTACK,
  ];

  specialAttackIds.forEach((id) => {
    localInputState.value.specialAttacks[id] = profile.skills[id]?.total || 0;
  });

  // Initiative
  localInputState.value.initiative = {
    meleeInit: profile.skills[INITIATIVE_IDS.MELEE_INIT]?.total || 0,
    physicalInit: profile.skills[INITIATIVE_IDS.PHYSICAL_INIT]?.total || 0,
    rangedInit: profile.skills[INITIATIVE_IDS.RANGED_INIT]?.total || 0,
  };

  // Combat bonuses
  const damageModifiers = [
    profile.skills[DAMAGE_MODIFIER_IDS.PROJECTILE]?.total || 0,
    profile.skills[DAMAGE_MODIFIER_IDS.MELEE]?.total || 0,
    profile.skills[DAMAGE_MODIFIER_IDS.ENERGY]?.total || 0,
    profile.skills[DAMAGE_MODIFIER_IDS.CHEMICAL]?.total || 0,
    profile.skills[DAMAGE_MODIFIER_IDS.RADIATION]?.total || 0,
    profile.skills[DAMAGE_MODIFIER_IDS.COLD]?.total || 0,
    profile.skills[DAMAGE_MODIFIER_IDS.NANO]?.total || 0,
    profile.skills[DAMAGE_MODIFIER_IDS.FIRE]?.total || 0,
    profile.skills[DAMAGE_MODIFIER_IDS.POISON]?.total || 0,
  ];

  localInputState.value.combatBonuses = {
    aao: profile.skills[276]?.total || 0,
    addDamage: Math.max(...damageModifiers, 0),
    wrangle: 0, // User input, not from profile
  };

  emitInputState();

  setTimeout(() => {
    isProgrammaticUpdate.value = false;
  }, 10);
}

/**
 * Reset all fields to default values
 */
function resetToDefaults(): void {
  isProgrammaticUpdate.value = true;

  localInputState.value = {
    characterStats: {
      breed: 1,
      level: 220,
      profession: 0,
      side: 0,
      crit: 0,
      targetAC: 0,
      aggdef: 75,
    },
    weaponSkills: {},
    specialAttacks: {},
    initiative: {
      meleeInit: 0,
      physicalInit: 0,
      rangedInit: 0,
    },
    combatBonuses: {
      aao: 0,
      addDamage: 0,
      wrangle: 0,
    },
  };

  emitInputState();

  setTimeout(() => {
    isProgrammaticUpdate.value = false;
  }, 10);
}

/**
 * Reset to Profile button handler
 */
function resetToProfile(): void {
  modifiedFields.value.clear();
  populateFromProfile();
}

/**
 * Update Weapons button handler
 */
function updateWeapons(): void {
  emit('update-weapons');
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
watch(
  () => props.activeProfile,
  () => {
    modifiedFields.value.clear();
    isProgrammaticUpdate.value = true;
    populateFromProfile();
    setTimeout(() => {
      isProgrammaticUpdate.value = false;
    }, 10);
  },
  { immediate: true }
);
</script>

<style scoped>
.fite-input-form {
  @apply space-y-4;
}

.form-header {
  @apply px-2;
}

:deep(.p-accordion-tab) {
  @apply mb-2;
}

:deep(.p-accordion-content) {
  @apply pt-4;
}
</style>

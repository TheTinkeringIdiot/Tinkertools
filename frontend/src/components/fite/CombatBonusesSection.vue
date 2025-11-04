<!--
CombatBonusesSection - Combat bonuses input for TinkerFite

Inputs (2 fields):
- Add All Offense / AAO (276)
- Add Damage (computed from damage modifiers, read-only/disabled)
-->
<template>
  <div
    class="bg-surface-0 dark:bg-surface-950 rounded-lg shadow-md dark:shadow-none border border-surface-200 dark:border-surface-700 p-6"
  >
    <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4">
      Combat Bonuses
    </h3>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Add All Offense (276) -->
      <div class="flex flex-col">
        <label for="aao" class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          Add All Offense (AAO)
        </label>
        <InputNumber
          id="aao"
          v-model="localBonuses.aao"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Add Damage (computed, read-only) -->
      <div class="flex flex-col">
        <label
          for="addDamage"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Add Damage
          <i
            class="pi pi-info-circle ml-1 text-xs"
            v-tooltip.right="'Computed from highest damage modifier matching weapon type'"
          ></i>
        </label>
        <InputNumber
          id="addDamage"
          v-model="computedAddDamage"
          :disabled="true"
          class="w-full font-mono"
        />
      </div>
    </div>

    <!-- Info message about Add Damage -->
    <div
      class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-900 dark:text-blue-100"
    >
      <i class="pi pi-info-circle mr-2"></i>
      <strong>Note:</strong> Add Damage is automatically calculated from your damage modifiers
      (Projectile, Melee, Energy, Chemical, Radiation, Cold, Fire, Poison, Nano) and will be
      applied based on the weapon's damage type.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import InputNumber from 'primevue/inputnumber';
import type { CombatBonuses } from '@/types/weapon-analysis';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import { DAMAGE_MODIFIER_IDS } from '@/types/weapon-analysis';

// Props
interface Props {
  combatBonuses: CombatBonuses;
  profile?: TinkerProfile | null;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:combatBonuses': [bonuses: CombatBonuses];
}>();

// Local state for two-way binding
const localBonuses = ref<CombatBonuses>({ ...props.combatBonuses });

// Programmatic update flag to prevent watcher loops
const isProgrammaticUpdate = ref(false);

// Computed Add Damage (highest damage modifier from profile)
const computedAddDamage = computed(() => {
  if (!props.profile?.skills) return 0;

  const skills = props.profile.skills;
  const damageModifiers = [
    skills[DAMAGE_MODIFIER_IDS.PROJECTILE]?.total || 0,
    skills[DAMAGE_MODIFIER_IDS.MELEE]?.total || 0,
    skills[DAMAGE_MODIFIER_IDS.ENERGY]?.total || 0,
    skills[DAMAGE_MODIFIER_IDS.CHEMICAL]?.total || 0,
    skills[DAMAGE_MODIFIER_IDS.RADIATION]?.total || 0,
    skills[DAMAGE_MODIFIER_IDS.COLD]?.total || 0,
    skills[DAMAGE_MODIFIER_IDS.NANO]?.total || 0,
    skills[DAMAGE_MODIFIER_IDS.FIRE]?.total || 0,
    skills[DAMAGE_MODIFIER_IDS.POISON]?.total || 0,
  ];

  // Return the highest damage modifier
  return Math.max(...damageModifiers, 0);
});

// Handle field changes - emit updates to parent
const onFieldChange = () => {
  if (!isProgrammaticUpdate.value) {
    // Update addDamage with computed value
    localBonuses.value.addDamage = computedAddDamage.value;
    emit('update:combatBonuses', { ...localBonuses.value });
  }
};

// Watch for prop changes from parent (external updates)
watch(
  () => props.combatBonuses,
  (newBonuses) => {
    isProgrammaticUpdate.value = true;
    localBonuses.value = { ...newBonuses };
    setTimeout(() => {
      isProgrammaticUpdate.value = false;
    }, 10);
  },
  { deep: true }
);

// Auto-populate AAO from profile when profile changes
watch(
  () => props.profile?.skills[276]?.total,
  (newAAO) => {
    if (newAAO !== undefined && !isProgrammaticUpdate.value) {
      isProgrammaticUpdate.value = true;
      localBonuses.value.aao = newAAO;
      // Also update addDamage with computed value
      localBonuses.value.addDamage = computedAddDamage.value;
      setTimeout(() => {
        isProgrammaticUpdate.value = false;
        emit('update:combatBonuses', { ...localBonuses.value });
      }, 10);
    }
  },
  { immediate: true }
);

// Watch computed Add Damage changes
watch(computedAddDamage, (newValue) => {
  if (!isProgrammaticUpdate.value) {
    isProgrammaticUpdate.value = true;
    localBonuses.value.addDamage = newValue;
    setTimeout(() => {
      isProgrammaticUpdate.value = false;
      emit('update:combatBonuses', { ...localBonuses.value });
    }, 10);
  }
});
</script>

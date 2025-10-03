<template>
  <div class="bg-surface-0 dark:bg-surface-950 rounded-lg shadow-md dark:shadow-none border border-surface-200 dark:border-surface-700 p-6">
    <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4">Damage Modifiers</h3>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Direct Nano Damage Efficiency (stat 536) - Display Only -->
      <div class="flex flex-col">
        <label for="dnde" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Direct Nano Damage Efficiency
          <span class="text-xs text-surface-500 dark:text-surface-400 ml-1">(stat 536)</span>
        </label>
        <InputNumber
          id="dnde"
          :model-value="directNanoDamageEfficiency"
          :min="0"
          :max="10000"
          suffix="%"
          disabled
          class="w-full opacity-75"
          v-tooltip="'Auto-calculated from buff dropdowns'"
        />
        <span class="text-xs text-surface-500 dark:text-surface-400 mt-1">
          Auto-calculated from buffs
        </span>
      </div>

      <!-- Projectile Damage Modifier (stat 278) -->
      <div class="flex flex-col">
        <label for="projectile" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Projectile Damage Modifier
          <span class="text-xs text-surface-500 dark:text-surface-400 ml-1">(stat 278)</span>
        </label>
        <InputNumber
          id="projectile"
          v-model="localModifiers.projectile"
          @update:model-value="updateModifier('projectile', $event)"
          :min="0"
          :max="10000"
          class="w-full"
        />
      </div>

      <!-- Melee Damage Modifier (stat 279) -->
      <div class="flex flex-col">
        <label for="melee" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Melee Damage Modifier
          <span class="text-xs text-surface-500 dark:text-surface-400 ml-1">(stat 279)</span>
        </label>
        <InputNumber
          id="melee"
          v-model="localModifiers.melee"
          @update:model-value="updateModifier('melee', $event)"
          :min="0"
          :max="10000"
          class="w-full"
        />
      </div>

      <!-- Energy Damage Modifier (stat 280) -->
      <div class="flex flex-col">
        <label for="energy" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Energy Damage Modifier
          <span class="text-xs text-surface-500 dark:text-surface-400 ml-1">(stat 280)</span>
        </label>
        <InputNumber
          id="energy"
          v-model="localModifiers.energy"
          @update:model-value="updateModifier('energy', $event)"
          :min="0"
          :max="10000"
          class="w-full"
        />
      </div>

      <!-- Chemical Damage Modifier (stat 281) -->
      <div class="flex flex-col">
        <label for="chemical" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Chemical Damage Modifier
          <span class="text-xs text-surface-500 dark:text-surface-400 ml-1">(stat 281)</span>
        </label>
        <InputNumber
          id="chemical"
          v-model="localModifiers.chemical"
          @update:model-value="updateModifier('chemical', $event)"
          :min="0"
          :max="10000"
          class="w-full"
        />
      </div>

      <!-- Radiation Damage Modifier (stat 282) -->
      <div class="flex flex-col">
        <label for="radiation" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Radiation Damage Modifier
          <span class="text-xs text-surface-500 dark:text-surface-400 ml-1">(stat 282)</span>
        </label>
        <InputNumber
          id="radiation"
          v-model="localModifiers.radiation"
          @update:model-value="updateModifier('radiation', $event)"
          :min="0"
          :max="10000"
          class="w-full"
        />
      </div>

      <!-- Cold Damage Modifier (stat 311) -->
      <div class="flex flex-col">
        <label for="cold" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Cold Damage Modifier
          <span class="text-xs text-surface-500 dark:text-surface-400 ml-1">(stat 311)</span>
        </label>
        <InputNumber
          id="cold"
          v-model="localModifiers.cold"
          @update:model-value="updateModifier('cold', $event)"
          :min="0"
          :max="10000"
          class="w-full"
        />
      </div>

      <!-- Nano Damage Modifier (stat 315) -->
      <div class="flex flex-col">
        <label for="nano" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Nano Damage Modifier
          <span class="text-xs text-surface-500 dark:text-surface-400 ml-1">(stat 315)</span>
        </label>
        <InputNumber
          id="nano"
          v-model="localModifiers.nano"
          @update:model-value="updateModifier('nano', $event)"
          :min="0"
          :max="10000"
          class="w-full"
        />
      </div>

      <!-- Fire Damage Modifier (stat 316) -->
      <div class="flex flex-col">
        <label for="fire" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Fire Damage Modifier
          <span class="text-xs text-surface-500 dark:text-surface-400 ml-1">(stat 316)</span>
        </label>
        <InputNumber
          id="fire"
          v-model="localModifiers.fire"
          @update:model-value="updateModifier('fire', $event)"
          :min="0"
          :max="10000"
          class="w-full"
        />
      </div>

      <!-- Poison Damage Modifier (stat 317) -->
      <div class="flex flex-col">
        <label for="poison" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Poison Damage Modifier
          <span class="text-xs text-surface-500 dark:text-surface-400 ml-1">(stat 317)</span>
        </label>
        <InputNumber
          id="poison"
          v-model="localModifiers.poison"
          @update:model-value="updateModifier('poison', $event)"
          :min="0"
          :max="10000"
          class="w-full"
        />
      </div>

      <!-- Target AC -->
      <div class="flex flex-col">
        <label for="targetAC" class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
          Target AC
        </label>
        <InputNumber
          id="targetAC"
          v-model="localModifiers.targetAC"
          @update:model-value="updateModifier('targetAC', $event)"
          :min="0"
          :max="10000"
          class="w-full"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import InputNumber from 'primevue/inputnumber'
import type { DamageModifiers } from '@/types/offensive-nano'
import type { TinkerProfile } from '@/lib/tinkerprofiles/types'
import { ENHANCE_NANO_DAMAGE, ANCIENT_MATRIX_DAMAGE } from '@/utils/nuke-regen-calculations'

interface Props {
  damageModifiers: DamageModifiers
  enhanceNanoDamage: number  // 0-6 from buff dropdown
  ancientMatrix: number       // 0-10 from buff dropdown
  profile?: TinkerProfile | null // TinkerProfile for accessing skill 536 base value and damage modifiers
}

interface Emits {
  (e: 'update:damageModifiers', modifiers: DamageModifiers): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Local state for modifiers
const localModifiers = ref<DamageModifiers>({ ...props.damageModifiers })

// Flags for preventing watcher loops
const isProgrammaticUpdate = ref(false)

// Computed property for stat 536: baseValue + enhanceNanoDamage + ancientMatrix
// Per FR-9: baseValue comes from profile.skills[536].total if profile exists, else 0
const directNanoDamageEfficiency = computed(() => {
  const baseValue = props.profile?.skills?.[536]?.total || 0
  const enhanceBonus = ENHANCE_NANO_DAMAGE[props.enhanceNanoDamage] || 0
  const ancientBonus = ANCIENT_MATRIX_DAMAGE[props.ancientMatrix] || 0

  const total = baseValue + enhanceBonus + ancientBonus

  // Return formatted with 2 decimal places for display
  return Number(total.toFixed(2))
})

/**
 * Auto-populate damage modifiers from active profile
 */
function populateFromProfile(): void {
  if (!props.profile?.skills) {
    return
  }

  isProgrammaticUpdate.value = true

  const skills = props.profile.skills

  // Map stat IDs to damage modifier values
  // Only update if profile has non-zero values
  if (skills[278]?.total !== undefined) {
    localModifiers.value.projectile = skills[278].total
  }
  if (skills[279]?.total !== undefined) {
    localModifiers.value.melee = skills[279].total
  }
  if (skills[280]?.total !== undefined) {
    localModifiers.value.energy = skills[280].total
  }
  if (skills[281]?.total !== undefined) {
    localModifiers.value.chemical = skills[281].total
  }
  if (skills[282]?.total !== undefined) {
    localModifiers.value.radiation = skills[282].total
  }
  if (skills[311]?.total !== undefined) {
    localModifiers.value.cold = skills[311].total
  }
  if (skills[315]?.total !== undefined) {
    localModifiers.value.nano = skills[315].total
  }
  if (skills[316]?.total !== undefined) {
    localModifiers.value.fire = skills[316].total
  }
  if (skills[317]?.total !== undefined) {
    localModifiers.value.poison = skills[317].total
  }

  // Target AC defaults to 0, not from profile
  // directNanoDamageEfficiency is computed from profile.skills[536] + buffs

  // Emit updated values with auto-calculated stat 536
  const updatedModifiers: DamageModifiers = {
    ...localModifiers.value,
    directNanoDamageEfficiency: directNanoDamageEfficiency.value
  }
  emit('update:damageModifiers', updatedModifiers)

  isProgrammaticUpdate.value = false
}

/**
 * Handle modifier changes and emit updates
 */
function updateModifier(field: keyof DamageModifiers, value: number | null): void {
  // Prevent emission during programmatic updates
  if (isProgrammaticUpdate.value) {
    return
  }

  if (value !== null && value >= 0) {
    localModifiers.value[field] = value as never

    // Emit complete modifiers with computed DNDE
    const updatedModifiers: DamageModifiers = {
      ...localModifiers.value,
      directNanoDamageEfficiency: directNanoDamageEfficiency.value
    }

    emit('update:damageModifiers', updatedModifiers)
  }
}

// Watch for profile skill changes to auto-populate
watch(
  () => props.profile?.skills,
  () => {
    populateFromProfile()
  },
  { immediate: true, deep: true }
)

// Watch for buff changes to recalculate stat 536 and re-emit
watch(
  () => [props.enhanceNanoDamage, props.ancientMatrix] as const,
  () => {
    // Stat 536 is auto-computed, just re-emit with new value
    if (!isProgrammaticUpdate.value) {
      const updatedModifiers: DamageModifiers = {
        ...localModifiers.value,
        directNanoDamageEfficiency: directNanoDamageEfficiency.value
      }
      emit('update:damageModifiers', updatedModifiers)
    }
  },
  { deep: true }
)
</script>

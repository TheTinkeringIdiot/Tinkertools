<!--
SpecialAttackSection - Special attack skills input for TinkerFite

Inputs (8 fields):
- Aimed Shot (151)
- Brawl (142)
- Burst (148)
- Dimach (144)
- Fast Attack (147)
- Fling Shot (150)
- Full Auto (167)
- Sneak Attack (146)
-->
<template>
  <div
    class="bg-surface-0 dark:bg-surface-950 rounded-lg shadow-md dark:shadow-none border border-surface-200 dark:border-surface-700 p-6"
  >
    <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4">
      Special Attacks
    </h3>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Aimed Shot (151) -->
      <div class="flex flex-col">
        <label
          for="skill-151"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Aimed Shot
        </label>
        <InputNumber
          id="skill-151"
          v-model="localAttacks[151]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Brawl (142) -->
      <div class="flex flex-col">
        <label
          for="skill-142"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Brawl
        </label>
        <InputNumber
          id="skill-142"
          v-model="localAttacks[142]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Burst (148) -->
      <div class="flex flex-col">
        <label
          for="skill-148"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Burst
        </label>
        <InputNumber
          id="skill-148"
          v-model="localAttacks[148]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Dimach (144) -->
      <div class="flex flex-col">
        <label
          for="skill-144"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Dimach
        </label>
        <InputNumber
          id="skill-144"
          v-model="localAttacks[144]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Fast Attack (147) -->
      <div class="flex flex-col">
        <label
          for="skill-147"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Fast Attack
        </label>
        <InputNumber
          id="skill-147"
          v-model="localAttacks[147]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Fling Shot (150) -->
      <div class="flex flex-col">
        <label
          for="skill-150"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Fling Shot
        </label>
        <InputNumber
          id="skill-150"
          v-model="localAttacks[150]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Full Auto (167) -->
      <div class="flex flex-col">
        <label
          for="skill-167"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Full Auto
        </label>
        <InputNumber
          id="skill-167"
          v-model="localAttacks[167]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Sneak Attack (146) -->
      <div class="flex flex-col">
        <label
          for="skill-146"
          class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1"
        >
          Sneak Attack
        </label>
        <InputNumber
          id="skill-146"
          v-model="localAttacks[146]"
          :min="0"
          :max="3000"
          :step="1"
          class="w-full font-mono"
          @update:model-value="onFieldChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import InputNumber from 'primevue/inputnumber';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import { SPECIAL_ATTACK_IDS } from '@/types/weapon-analysis';

// Props
interface Props {
  specialAttacks: Record<number, number>;
  profile?: TinkerProfile | null;
}

const props = defineProps<Props>();

// Emits
const emit = defineEmits<{
  'update:specialAttacks': [attacks: Record<number, number>];
}>();

// Local state for two-way binding
const localAttacks = ref<Record<number, number>>({ ...props.specialAttacks });

// Programmatic update flag to prevent watcher loops
const isProgrammaticUpdate = ref(false);

// Special attack IDs (8 total)
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

// Handle field changes - emit updates to parent
const onFieldChange = () => {
  if (!isProgrammaticUpdate.value) {
    emit('update:specialAttacks', { ...localAttacks.value });
  }
};

// Watch for prop changes from parent (external updates)
watch(
  () => props.specialAttacks,
  (newAttacks) => {
    isProgrammaticUpdate.value = true;
    localAttacks.value = { ...newAttacks };
    setTimeout(() => {
      isProgrammaticUpdate.value = false;
    }, 10);
  },
  { deep: true }
);

// Auto-populate from profile when profile changes
watch(
  () => props.profile?.skills,
  (newSkills) => {
    if (newSkills && !isProgrammaticUpdate.value) {
      isProgrammaticUpdate.value = true;
      specialAttackIds.forEach((id) => {
        localAttacks.value[id] = newSkills[id]?.total || 0;
      });
      setTimeout(() => {
        isProgrammaticUpdate.value = false;
        emit('update:specialAttacks', { ...localAttacks.value });
      }, 10);
    }
  },
  { immediate: true, deep: true }
);
</script>

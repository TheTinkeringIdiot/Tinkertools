<template>
  <div class="flex items-center justify-between">
    <div class="flex items-center space-x-6">
      <div>
        <span class="text-2xl font-bold text-green-600 dark:text-green-400">{{ usableCount }}</span>
        <div class="text-sm text-surface-600 dark:text-surface-400">Usable</div>
      </div>
      <div>
        <span class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{{
          partialCount
        }}</span>
        <div class="text-sm text-surface-600 dark:text-surface-400">Close (1-2 missing)</div>
      </div>
      <div>
        <span class="text-2xl font-bold text-red-600 dark:text-red-400">{{ unusableCount }}</span>
        <div class="text-sm text-surface-600 dark:text-surface-400">Too many missing</div>
      </div>
    </div>
    <div class="text-right">
      <div class="text-sm text-surface-600 dark:text-surface-400">Usability Rate</div>
      <div class="text-lg font-semibold">{{ usabilityPercentage }}%</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Weapon, CharacterSkills } from '@/types/weapon';
import { checkWeaponUsability } from '@/utils/weaponUsability';

interface Props {
  weapons: Weapon[];
  characterSkills: CharacterSkills;
}

const props = defineProps<Props>();

// Computed
const usabilityStats = computed(() => {
  let usable = 0;
  let partial = 0;
  let unusable = 0;

  props.weapons.forEach((weapon) => {
    const usability = checkWeaponUsability(weapon, props.characterSkills);

    if (usability.canUse) {
      usable++;
    } else if (usability.missingRequirements.length <= 2) {
      partial++;
    } else {
      unusable++;
    }
  });

  return { usable, partial, unusable };
});

const usableCount = computed(() => usabilityStats.value.usable);
const partialCount = computed(() => usabilityStats.value.partial);
const unusableCount = computed(() => usabilityStats.value.unusable);

const usabilityPercentage = computed(() => {
  if (props.weapons.length === 0) return 0;
  return Math.round((usableCount.value / props.weapons.length) * 100);
});
</script>

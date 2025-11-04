<template>
  <div
    class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
    :class="badgeClass"
    :title="tooltipText"
  >
    <i :class="iconClass" class="mr-1"></i>
    {{ badgeText }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Weapon, CharacterSkills } from '@/types/weapon';
import { useFiteStore } from '@/stores/fiteStore';

interface Props {
  weapon: Weapon;
  characterSkills: CharacterSkills;
}

const props = defineProps<Props>();
const fiteStore = useFiteStore();

// Computed
const usability = computed(() => {
  return fiteStore.checkWeaponUsability(props.weapon, props.characterSkills);
});

const badgeClass = computed(() => {
  if (usability.value.canUse) {
    return 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300';
  } else {
    const missingCount = usability.value.missingRequirements.length;
    if (missingCount <= 2) {
      return 'bg-yellow-100 text-yellow-800'; // Close to usable
    } else {
      return 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'; // Far from usable
    }
  }
});

const iconClass = computed(() => {
  if (usability.value.canUse) {
    return 'pi pi-check';
  } else {
    const missingCount = usability.value.missingRequirements.length;
    if (missingCount <= 2) {
      return 'pi pi-exclamation-triangle';
    } else {
      return 'pi pi-times';
    }
  }
});

const badgeText = computed(() => {
  if (usability.value.canUse) {
    return 'Usable';
  } else {
    const missingCount = usability.value.missingRequirements.length;
    return `${missingCount} missing`;
  }
});

const tooltipText = computed(() => {
  if (usability.value.canUse) {
    return 'You can use this weapon with your current skills';
  } else {
    const missing = usability.value.missingRequirements
      .slice(0, 3)
      .map((req) => `${req.statName}: ${req.characterValue || 0}/${req.value}`)
      .join(', ');

    const moreCount = usability.value.missingRequirements.length - 3;
    return `Missing requirements: ${missing}${moreCount > 0 ? ` and ${moreCount} more` : ''}`;
  }
});
</script>

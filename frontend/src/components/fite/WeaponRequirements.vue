<template>
  <div>
    <div class="text-xs font-medium text-surface-700 dark:text-surface-300 mb-2">
      {{ compact ? 'Key Requirements' : 'Skill Requirements' }}
    </div>

    <div
      v-if="skillRequirements.length === 0"
      class="text-xs text-surface-500 dark:text-surface-400"
    >
      No specific skill requirements detected
    </div>

    <div v-else class="space-y-1">
      <div
        v-for="req in displayedRequirements"
        :key="req.stat"
        class="flex items-center justify-between text-xs"
        :class="getRequirementClass(req)"
      >
        <span class="font-medium">{{ req.statName }}</span>
        <div class="flex items-center space-x-1">
          <span>{{ req.value }}</span>
          <i
            v-if="characterSkills && Object.keys(characterSkills).length > 0"
            :class="
              req.met
                ? 'pi pi-check text-green-600 dark:text-green-400'
                : 'pi pi-times text-red-600 dark:text-red-400'
            "
          />
          <span
            v-if="characterSkills && req.characterValue !== undefined"
            class="text-surface-500 dark:text-surface-400"
          >
            ({{ req.characterValue }})
          </span>
        </div>
      </div>

      <div
        v-if="compact && skillRequirements.length > maxCompactItems"
        class="text-xs text-surface-500 dark:text-surface-400"
      >
        +{{ skillRequirements.length - maxCompactItems }} more requirements
      </div>
    </div>

    <!-- Usability Summary (non-compact only) -->
    <div
      v-if="!compact && characterSkills && Object.keys(characterSkills).length > 0"
      class="mt-3 pt-3 border-t"
    >
      <div class="flex items-center justify-between">
        <span class="text-xs font-medium">
          {{ usability.canUse ? 'Can Use' : 'Cannot Use' }}
        </span>
        <div
          class="px-2 py-1 rounded-full text-xs font-medium"
          :class="usability.canUse ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
        >
          {{ usability.canUse ? 'Usable' : `${usability.missingRequirements.length} missing` }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Weapon, CharacterSkills, WeaponRequirement, WeaponUsability } from '@/types/weapon';
import { SKILL_NAMES } from '@/types/weapon';
import { useFiteStore } from '@/stores/fiteStore';

interface Props {
  weapon: Weapon;
  characterSkills?: CharacterSkills;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
});

const fiteStore = useFiteStore();
const maxCompactItems = 3;

// Computed
const skillRequirements = computed<WeaponRequirement[]>(() => {
  if (!props.weapon.stats) return [];

  return props.weapon.stats
    .filter((stat) => SKILL_NAMES[stat.stat]) // Only show known skills
    .map((stat) => {
      const characterValue = props.characterSkills?.[stat.stat] || 0;
      return {
        stat: stat.stat,
        statName: SKILL_NAMES[stat.stat],
        value: stat.value,
        met: characterValue >= stat.value,
        characterValue: props.characterSkills ? characterValue : undefined,
      };
    })
    .sort((a, b) => {
      // Sort by not met first, then by value descending
      if (a.met !== b.met) return a.met ? 1 : -1;
      return b.value - a.value;
    });
});

const displayedRequirements = computed(() => {
  return props.compact
    ? skillRequirements.value.slice(0, maxCompactItems)
    : skillRequirements.value;
});

const usability = computed<WeaponUsability>(() => {
  if (!props.characterSkills) {
    return {
      canUse: false,
      requirements: skillRequirements.value,
      missingRequirements: skillRequirements.value,
    };
  }

  return fiteStore.checkWeaponUsability(props.weapon, props.characterSkills);
});

// Methods
const getRequirementClass = (req: WeaponRequirement): string => {
  if (!props.characterSkills || req.characterValue === undefined) {
    return 'text-surface-700 dark:text-surface-300';
  }

  return req.met
    ? 'text-green-700 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded'
    : 'text-red-700 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded';
};
</script>

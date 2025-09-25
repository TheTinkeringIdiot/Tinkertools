<!--
StatBreakdownTooltip - Displays detailed stat value breakdown in a tooltip
Shows base value, trickle-down, equipment bonuses, IP improvements, and total
-->
<template>
  <div class="stat-breakdown-tooltip">
    <div class="breakdown-header">
      <h4 class="text-sm font-semibold text-surface-900 dark:text-surface-50 mb-2">
        {{ skillName }} Breakdown
      </h4>
    </div>

    <div class="breakdown-content space-y-1">
      <!-- Base Value Row -->
      <div class="breakdown-row flex justify-between items-center">
        <span class="text-xs text-surface-600 dark:text-surface-400">
          {{ isAbility ? 'Breed Base:' : 'Base Value:' }}
        </span>
        <span class="text-xs font-medium text-surface-900 dark:text-surface-50">
          {{ formatValue(baseValue) }}
        </span>
      </div>

      <!-- Trickle-down Row (only for skills) -->
      <div v-if="!isAbility && trickleDownBonus > 0" class="breakdown-row flex justify-between items-center">
        <span class="text-xs text-green-600 dark:text-green-400">
          Trickle-down:
        </span>
        <span class="text-xs font-medium text-green-600 dark:text-green-400">
          +{{ formatValue(trickleDownBonus) }}
        </span>
      </div>

      <!-- Equipment Bonuses Row (if any) -->
      <div v-if="equipmentBonus !== 0" class="breakdown-row flex justify-between items-center">
        <span class="text-xs" :class="equipmentBonus > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'">
          Equipment:
        </span>
        <span class="text-xs font-medium" :class="equipmentBonus > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'">
          {{ equipmentBonus > 0 ? '+' : '' }}{{ formatValue(equipmentBonus) }}
        </span>
      </div>

      <!-- Perk Bonuses Row (if any) -->
      <div v-if="perkBonus !== 0" class="breakdown-row flex justify-between items-center">
        <span class="text-xs" :class="perkBonus > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'">
          Perks:
        </span>
        <span class="text-xs font-medium" :class="perkBonus > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'">
          {{ perkBonus > 0 ? '+' : '' }}{{ formatValue(perkBonus) }}
        </span>
      </div>

      <!-- Buff Bonuses Row (if any) -->
      <div v-if="buffBonus !== 0" class="breakdown-row flex justify-between items-center">
        <span class="text-xs" :class="buffBonus > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'">
          Buffs:
        </span>
        <span class="text-xs font-medium" :class="buffBonus > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'">
          {{ buffBonus > 0 ? '+' : '' }}{{ formatValue(buffBonus) }}
        </span>
      </div>

      <!-- IP Improvements Row (for non-misc skills) -->
      <div v-if="!isAbility && !isMiscSkill && ipContribution > 0" class="breakdown-row flex justify-between items-center">
        <span class="text-xs text-blue-600 dark:text-blue-400">
          IP Improvements:
        </span>
        <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
          +{{ formatValue(ipContribution) }}
        </span>
      </div>

      <!-- Ability Improvements Row (for abilities) -->
      <div v-if="isAbility && abilityImprovements > 0" class="breakdown-row flex justify-between items-center">
        <span class="text-xs text-blue-600 dark:text-blue-400">
          Improvements:
        </span>
        <span class="text-xs font-medium text-blue-600 dark:text-blue-400">
          +{{ formatValue(abilityImprovements) }}
        </span>
      </div>

      <!-- Visual Separator -->
      <div class="breakdown-separator border-t border-surface-300 dark:border-surface-600 my-1"></div>

      <!-- Total Value Row -->
      <div class="breakdown-row flex justify-between items-center font-semibold">
        <span class="text-xs text-surface-900 dark:text-surface-50">
          Total:
        </span>
        <span class="text-xs text-surface-900 dark:text-surface-50">
          {{ formatValue(totalValue) }}
        </span>
      </div>

      <!-- Cap Information (if applicable) -->
      <div v-if="skillCap && totalValue < skillCap" class="breakdown-cap mt-2 pt-1 border-t border-surface-200 dark:border-surface-700">
        <div class="flex justify-between items-center">
          <span class="text-xs text-surface-500 dark:text-surface-400">
            Skill Cap:
          </span>
          <span class="text-xs text-surface-500 dark:text-surface-400">
            {{ formatValue(skillCap) }}
          </span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-xs text-surface-500 dark:text-surface-400">
            Remaining:
          </span>
          <span class="text-xs text-surface-500 dark:text-surface-400">
            {{ formatValue(skillCap - totalValue) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { SkillWithIP } from '@/lib/tinkerprofiles/types';

// Props
const props = defineProps<{
  skillName: string;
  skillData: SkillWithIP & {
    equipmentBonus?: number;
    baseValue?: number;
  };
  isAbility?: boolean;
  category?: string;
  breed?: string;
}>();

// Computed values for breakdown display
const baseValue = computed(() => {
  if (props.isAbility) {
    // For abilities, baseValue from backend includes breed base + IP improvements (no equipment)
    // We want to show just the breed base here, so subtract pointFromIp
    const fullBase = props.skillData.baseValue ?? props.skillData.value;
    const improvements = props.skillData.pointFromIp ?? 0;
    return Math.max(0, fullBase - improvements);
  } else {
    // For skills, base value is typically 5, or use provided baseValue
    return props.skillData.baseValue ?? 5;
  }
});

const trickleDownBonus = computed(() => props.skillData.trickleDown ?? 0);

const equipmentBonus = computed(() => props.skillData.equipmentBonus ?? 0);

const perkBonus = computed(() => props.skillData.perkBonus ?? 0);

const buffBonus = computed(() => props.skillData.buffBonus ?? 0);

const ipContribution = computed(() => props.skillData.pointFromIp ?? 0);

const abilityImprovements = computed(() => {
  if (props.isAbility) {
    // For abilities, use pointFromIp which tracks IP-based improvements
    // This excludes equipment bonuses which are shown separately
    return props.skillData.pointFromIp ?? 0;
  }
  return 0;
});

const totalValue = computed(() => props.skillData.value);

const skillCap = computed(() => props.skillData.cap);

const isMiscSkill = computed(() => props.category === 'Misc');

// Utility functions
const formatValue = (value: number): string => {
  return Math.round(value).toString();
};
</script>

<style scoped>
.stat-breakdown-tooltip {
  @apply bg-surface-0 dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg shadow-lg p-3 min-w-[200px];
}

.breakdown-row {
  @apply min-h-[1.25rem];
}

.breakdown-header h4 {
  @apply border-b border-surface-200 dark:border-surface-700 pb-1;
}

/* Ensure proper spacing and alignment */
.breakdown-content {
  @apply text-left;
}

/* Hover effects for interactive elements */
.breakdown-row:hover {
  @apply bg-surface-50 dark:bg-surface-800 rounded px-1 -mx-1;
}

/* Animation for dynamic updates */
.breakdown-row {
  @apply transition-colors duration-200;
}

/* Equipment bonus highlighting */
.breakdown-row:has(.text-blue-600) {
  @apply bg-blue-50 dark:bg-blue-950/20 rounded px-1 -mx-1;
}

.breakdown-row:has(.text-red-600) {
  @apply bg-red-50 dark:bg-red-950/20 rounded px-1 -mx-1;
}
</style>
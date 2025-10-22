<!--
RequirementsDisplay - Display build requirements ONLY
Shows ONLY build requirements (Nanoprogramming, Break & Entry, Jobe skills)
Equipment requirements (Treatment, attributes) are handled by AttributeRequirementsDisplay

NOTE: Consider renaming to BuildRequirementsDisplay in the future for clarity
-->
<template>
  <div class="requirements-display">
    <h3 class="font-medium text-surface-900 dark:text-surface-100 mb-3">
      <i class="pi pi-exclamation-triangle mr-2"></i>
      Build Requirements
    </h3>

    <!-- No requirements message -->
    <div
      v-if="buildRequirements.length === 0"
      class="text-center py-4 text-surface-500 dark:text-surface-400"
    >
      <i class="pi pi-info-circle text-xl mb-1 block"></i>
      <p class="text-sm">Configure implants to see build requirements</p>
    </div>

    <!-- Build Requirements Panel -->
    <Panel v-else header="Build Requirements" :toggleable="false">
      <div class="space-y-2">
        <div
          v-for="req in buildRequirements"
          :key="req.stat"
          class="flex justify-between items-center text-sm"
        >
          <span class="font-medium text-surface-700 dark:text-surface-300">
            {{ req.statName }}:
          </span>
          <div class="flex flex-col items-end">
            <span class="font-medium">{{ req.required }}</span>
            <span
              v-if="req.met"
              class="text-xs text-green-600 dark:text-green-400"
            >
              ✓ Met
            </span>
            <span
              v-else
              class="text-xs text-red-600 dark:text-red-400"
            >
              Need +{{ req.required - req.current }}
            </span>
          </div>
        </div>
      </div>
    </Panel>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Panel from 'primevue/panel'
import type { ImplantRequirement } from '@/types/api'

interface Props {
  requirements: ImplantRequirement[]
  profileSkills?: Record<number, number>
}

const props = withDefaults(defineProps<Props>(), {
  requirements: () => [],
  profileSkills: () => ({})
})

// Stat IDs for categorization
// Equipment stats to filter OUT (these are handled by AttributeRequirementsDisplay)
const EQUIPMENT_STAT_IDS = new Set([
  124, // Treatment (FIXED: was incorrectly 134 which is MultiRanged)
  16,  // Strength
  17,  // Agility
  18,  // Stamina
  19,  // Intelligence
  20,  // Sense
  21,  // Psychic
  64,  // Title Level
])

const BUILD_STAT_IDS = new Set([
  160, // Nanoprogramming
  157, // Break & Entry (for cleaning)
  // Jobe skills
  109, // Psychology
  150, // Computer Literacy
  125, // Matter Creation
  126, // Biological Metamorphosis
  128, // Psychological Modifications
  127, // Matter Metamorphosis
  129, // Sensory Improvement
  130, // Time and Space
])

// Computed: Equipment Requirements (FILTERED OUT - handled by AttributeRequirementsDisplay)
// This is kept for backward compatibility but will be empty
const equipmentRequirements = computed(() => {
  return props.requirements
    .filter(req => EQUIPMENT_STAT_IDS.has(req.stat))
    .sort((a, b) => {
      // Sort Treatment first, then attributes, then Title Level
      if (a.stat === 124) return -1 // FIXED: was 134 (MultiRanged), now 124 (Treatment)
      if (b.stat === 124) return 1
      if (a.stat === 64) return 1
      if (b.stat === 64) return -1
      return a.statName.localeCompare(b.statName)
    })
})

// Computed: Build Requirements (Nanoprogramming, Jobe skills, Break & Entry)
const buildRequirements = computed(() => {
  return props.requirements
    .filter(req => BUILD_STAT_IDS.has(req.stat))
    .sort((a, b) => {
      // Sort Nanoprogramming first, then alphabetically
      if (a.stat === 160) return -1
      if (b.stat === 160) return 1
      return a.statName.localeCompare(b.statName)
    })
})
</script>

<style scoped>
.requirements-display {
  @apply w-full;
}
</style>

<!--
RequirementsDisplay - Display implant requirements
Shows equipment requirements (from database) and build requirements (calculated)
-->
<template>
  <div class="requirements-display">
    <h3 class="font-medium text-surface-900 dark:text-surface-100 mb-3">
      <i class="pi pi-exclamation-triangle mr-2"></i>
      Requirements
    </h3>

    <!-- No requirements message -->
    <div
      v-if="equipmentRequirements.length === 0 && buildRequirements.length === 0"
      class="text-center py-4 text-surface-500 dark:text-surface-400"
    >
      <i class="pi pi-info-circle text-xl mb-1 block"></i>
      <p class="text-sm">Configure implants to see requirements</p>
    </div>

    <!-- Two-column layout -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Column 1: Equipment Requirements -->
      <Panel header="Equipment Requirements" :toggleable="false">
        <div v-if="equipmentRequirements.length === 0" class="text-sm text-surface-500 dark:text-surface-400">
          No equipment requirements
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="req in equipmentRequirements"
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

      <!-- Column 2: Build Requirements -->
      <Panel header="Build Requirements" :toggleable="false">
        <div v-if="buildRequirements.length === 0" class="text-sm text-surface-500 dark:text-surface-400">
          No build requirements
        </div>
        <div v-else class="space-y-2">
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Panel from 'primevue/panel'
import type { ImplantRequirement } from '@/stores/tinkerPlants'

interface Props {
  requirements: ImplantRequirement[]
  profileSkills?: Record<number, number>
}

const props = withDefaults(defineProps<Props>(), {
  requirements: () => [],
  profileSkills: () => ({})
})

// Stat IDs for categorization
const EQUIPMENT_STAT_IDS = new Set([
  134, // Treatment
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

// Computed: Equipment Requirements (Treatment, Attributes, Title Level)
const equipmentRequirements = computed(() => {
  return props.requirements
    .filter(req => EQUIPMENT_STAT_IDS.has(req.stat))
    .sort((a, b) => {
      // Sort Treatment first, then attributes, then Title Level
      if (a.stat === 134) return -1
      if (b.stat === 134) return 1
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

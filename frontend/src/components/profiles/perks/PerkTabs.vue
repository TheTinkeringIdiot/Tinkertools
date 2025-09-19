<!--
PerkTabs - Tab navigation for different perk types
Organizes SL, AI, and LE perks into separate tabs with PrimeVue TabView
-->
<template>
  <div class="perk-tabs h-full">
    <TabView class="h-full perk-tabs-container">
      <!-- SL Perks Tab -->
      <TabPanel class="h-full">
        <template #header>
          <div class="flex items-center gap-2">
            <i class="pi pi-star text-primary-500" aria-hidden="true"></i>
            <span>SL Perks</span>
            <Badge
              v-if="slPerkCount > 0"
              :value="slPerkCount"
              severity="info"
              :aria-label="`${slPerkCount} SL perks owned`"
            />
          </div>
        </template>

        <div class="h-full p-4">
          <div class="max-w-6xl mx-auto space-y-4">
            <!-- SL Perks Header -->
            <div class="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-4">
              <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-2 flex items-center gap-2">
                <i class="pi pi-star text-primary-500" aria-hidden="true"></i>
                Standard Perks (SL)
              </h3>
              <p class="text-surface-600 dark:text-surface-400 text-sm mb-3">
                Standard perks cost perk points earned through character leveling.
                You gain 1 point every 10 levels up to 200, then 1 per level from 201-220 (max 40 points).
              </p>

              <!-- Quick stats -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div class="bg-surface-0 dark:bg-surface-950 p-3 rounded border">
                  <div class="text-surface-500 dark:text-surface-400 uppercase tracking-wide">Points Used</div>
                  <div class="text-lg font-bold text-primary-600 dark:text-primary-400">
                    {{ slPointsUsed }}/{{ maxSLPoints }}
                  </div>
                </div>
                <div class="bg-surface-0 dark:bg-surface-950 p-3 rounded border">
                  <div class="text-surface-500 dark:text-surface-400 uppercase tracking-wide">Perks Owned</div>
                  <div class="text-lg font-bold text-primary-600 dark:text-primary-400">
                    {{ slPerkCount }}
                  </div>
                </div>
                <div class="bg-surface-0 dark:bg-surface-950 p-3 rounded border">
                  <div class="text-surface-500 dark:text-surface-400 uppercase tracking-wide">Points Available</div>
                  <div class="text-lg font-bold" :class="slPointsRemaining > 0 ? 'text-green-600 dark:text-green-400' : 'text-surface-600 dark:text-surface-400'">
                    {{ slPointsRemaining }}
                  </div>
                </div>
              </div>
            </div>

            <!-- SL Perk Selection Area -->
            <div class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-4 min-h-96">
              <div class="text-center text-surface-500 dark:text-surface-400 mt-20">
                <i class="pi pi-star text-6xl mb-4 opacity-50" aria-hidden="true"></i>
                <p class="text-lg mb-2">SL Perk Selector</p>
                <p class="text-sm">SL perk selection interface will be implemented in Task 4.1</p>
              </div>
            </div>
          </div>
        </div>
      </TabPanel>

      <!-- AI Perks Tab -->
      <TabPanel class="h-full">
        <template #header>
          <div class="flex items-center gap-2">
            <i class="pi pi-bolt text-cyan-500" aria-hidden="true"></i>
            <span>AI Perks</span>
            <Badge
              v-if="aiPerkCount > 0"
              :value="aiPerkCount"
              severity="info"
              :aria-label="`${aiPerkCount} AI perks owned`"
            />
          </div>
        </template>

        <div class="h-full p-4">
          <div class="max-w-6xl mx-auto space-y-4">
            <!-- AI Perks Header -->
            <div class="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-4">
              <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-2 flex items-center gap-2">
                <i class="pi pi-bolt text-cyan-500" aria-hidden="true"></i>
                Alien Invasion Perks (AI)
              </h3>
              <p class="text-surface-600 dark:text-surface-400 text-sm mb-3">
                AI perks cost AI perk points earned through alien levels.
                You gain 1 AI perk point per alien level (max 30 points at AI level 30).
              </p>

              <!-- Quick stats -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div class="bg-surface-0 dark:bg-surface-950 p-3 rounded border">
                  <div class="text-surface-500 dark:text-surface-400 uppercase tracking-wide">Points Used</div>
                  <div class="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                    {{ aiPointsUsed }}/{{ maxAIPoints }}
                  </div>
                </div>
                <div class="bg-surface-0 dark:bg-surface-950 p-3 rounded border">
                  <div class="text-surface-500 dark:text-surface-400 uppercase tracking-wide">Perks Owned</div>
                  <div class="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                    {{ aiPerkCount }}
                  </div>
                </div>
                <div class="bg-surface-0 dark:bg-surface-950 p-3 rounded border">
                  <div class="text-surface-500 dark:text-surface-400 uppercase tracking-wide">Points Available</div>
                  <div class="text-lg font-bold" :class="aiPointsRemaining > 0 ? 'text-green-600 dark:text-green-400' : 'text-surface-600 dark:text-surface-400'">
                    {{ aiPointsRemaining }}
                  </div>
                </div>
              </div>

              <!-- AI Level Warning -->
              <div v-if="!hasAILevel" class="mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded">
                <div class="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                  <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
                  <span class="font-medium">No AI Level</span>
                </div>
                <p class="text-orange-600 dark:text-orange-400 text-sm mt-1">
                  AI perks require alien levels to earn AI perk points. Visit an alien ship to start gaining AI levels.
                </p>
              </div>
            </div>

            <!-- AI Perk Selection Area -->
            <div class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-4 min-h-96">
              <div class="text-center text-surface-500 dark:text-surface-400 mt-20">
                <i class="pi pi-bolt text-6xl mb-4 opacity-50" aria-hidden="true"></i>
                <p class="text-lg mb-2">AI Perk Selector</p>
                <p class="text-sm">AI perk selection interface will be implemented in Task 4.1</p>
              </div>
            </div>
          </div>
        </div>
      </TabPanel>

      <!-- LE Research Tab -->
      <TabPanel class="h-full">
        <template #header>
          <div class="flex items-center gap-2">
            <i class="pi pi-book text-purple-500" aria-hidden="true"></i>
            <span>LE Research</span>
            <Badge
              v-if="researchCount > 0"
              :value="researchCount"
              severity="info"
              :aria-label="`${researchCount} research perks active`"
            />
          </div>
        </template>

        <div class="h-full p-4">
          <div class="max-w-6xl mx-auto space-y-4">
            <!-- LE Research Header -->
            <div class="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-4">
              <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-2 flex items-center gap-2">
                <i class="pi pi-book text-purple-500" aria-hidden="true"></i>
                Lost Eden Research (LE)
              </h3>
              <p class="text-surface-600 dark:text-surface-400 text-sm mb-3">
                Research perks are free to assign and don't cost perk points.
                They have strict requirements but provide powerful bonuses for specialized builds.
              </p>

              <!-- Quick stats -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div class="bg-surface-0 dark:bg-surface-950 p-3 rounded border">
                  <div class="text-surface-500 dark:text-surface-400 uppercase tracking-wide">Research Active</div>
                  <div class="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {{ researchCount }}
                  </div>
                </div>
                <div class="bg-surface-0 dark:bg-surface-950 p-3 rounded border">
                  <div class="text-surface-500 dark:text-surface-400 uppercase tracking-wide">Point Cost</div>
                  <div class="text-lg font-bold text-green-600 dark:text-green-400">
                    Free
                  </div>
                </div>
              </div>
            </div>

            <!-- LE Research Selection Area -->
            <div class="bg-surface-0 dark:bg-surface-950 border border-surface-200 dark:border-surface-700 rounded-lg p-4 min-h-96">
              <div class="text-center text-surface-500 dark:text-surface-400 mt-20">
                <i class="pi pi-book text-6xl mb-4 opacity-50" aria-hidden="true"></i>
                <p class="text-lg mb-2">Research Selector</p>
                <p class="text-sm">LE research selection interface will be implemented in Task 4.1</p>
              </div>
            </div>
          </div>
        </div>
      </TabPanel>
    </TabView>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TabView from 'primevue/tabview'
import TabPanel from 'primevue/tabpanel'
import Badge from 'primevue/badge'
import type { TinkerProfile } from '@/lib/tinkerprofiles/types'
import { calculatePerkPointsDetailed } from '@/services/perk-calculator'
import type { PerkCharacterData } from '@/lib/tinkerprofiles/perk-types'

// Props
const props = defineProps<{
  profile: TinkerProfile
}>()

// Character data for calculations
const characterData = computed((): PerkCharacterData => ({
  level: props.profile.Character?.Level || 1,
  alienLevel: props.profile.Character?.AlienLevel || 0,
  profession: props.profile.Character?.Profession || 'Adventurer',
  breed: props.profile.Character?.Breed || 'Solitus',
  expansion: 'SL' // Default expansion
}))

// Point calculations
const pointCalculation = computed(() => {
  return calculatePerkPointsDetailed(characterData.value)
})

// SL Perks data
const maxSLPoints = computed(() => pointCalculation.value.standardPoints.total)
const slPointsUsed = computed(() => {
  const perkSystem = props.profile.PerksAndResearch as any
  if (!perkSystem || typeof perkSystem !== 'object' || !perkSystem.standardPerkPoints) {
    return 0
  }
  return perkSystem.standardPerkPoints.spent || 0
})
const slPointsRemaining = computed(() => maxSLPoints.value - slPointsUsed.value)
const slPerkCount = computed(() => {
  const perkSystem = props.profile.PerksAndResearch as any
  if (!perkSystem || typeof perkSystem !== 'object' || !Array.isArray(perkSystem.perks)) {
    return 0
  }
  return perkSystem.perks.filter((perk: any) => perk.type === 'SL').length
})

// AI Perks data
const maxAIPoints = computed(() => pointCalculation.value.aiPoints.total)
const aiPointsUsed = computed(() => {
  const perkSystem = props.profile.PerksAndResearch as any
  if (!perkSystem || typeof perkSystem !== 'object' || !perkSystem.aiPerkPoints) {
    return 0
  }
  return perkSystem.aiPerkPoints.spent || 0
})
const aiPointsRemaining = computed(() => maxAIPoints.value - aiPointsUsed.value)
const aiPerkCount = computed(() => {
  const perkSystem = props.profile.PerksAndResearch as any
  if (!perkSystem || typeof perkSystem !== 'object' || !Array.isArray(perkSystem.perks)) {
    return 0
  }
  return perkSystem.perks.filter((perk: any) => perk.type === 'AI').length
})
const hasAILevel = computed(() => characterData.value.alienLevel > 0)

// LE Research data
const researchCount = computed(() => {
  const perkSystem = props.profile.PerksAndResearch as any
  if (!perkSystem || typeof perkSystem !== 'object' || !Array.isArray(perkSystem.research)) {
    return 0
  }
  return perkSystem.research.length
})
</script>

<style scoped>
/* TabView full height styling */
.perk-tabs-container {
  height: 100%;
}

.perk-tabs-container :deep(.p-tabview-panels) {
  height: calc(100% - 60px); /* Subtract tab header height */
  overflow: auto;
}

.perk-tabs-container :deep(.p-tabview-panel) {
  height: 100%;
  padding: 0 !important;
}

/* Tab header styling */
.perk-tabs-container :deep(.p-tabview-nav-link) {
  padding: 1rem 1.5rem;
}

/* Badge positioning in tab headers */
.perk-tabs-container :deep(.p-badge) {
  margin-left: 0.5rem;
}
</style>
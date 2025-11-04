<!--
PerkTabs - Display profile's active perks organized by type
Shows owned perks with their effects and point usage in a tabbed interface
-->
<template>
  <div class="perk-tabs h-full">
    <!-- Compact Points Summary Bar -->
    <PerkPointsSummary
      :sl-points-used="slPointsUsed"
      :max-s-l-points="maxSLPoints"
      :ai-points-used="aiPointsUsed"
      :max-a-i-points="maxAIPoints"
      :research-count="researchCount"
      :character-level="characterData.level"
      :alien-level="characterData.alienLevel || 0"
    />

    <TabView class="h-full perk-tabs-container">
      <!-- SL Perks Tab -->
      <TabPanel>
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
          <PerkTable
            :perks="slPerks"
            perk-type="SL"
            :editable="false"
            @add-perks="handleAddPerks('SL')"
            @upgrade="handleUpgradePerk"
            @remove="handleRemovePerk"
          />
        </div>
      </TabPanel>

      <!-- AI Perks Tab -->
      <TabPanel>
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
          <PerkTable
            :perks="aiPerks"
            perk-type="AI"
            :editable="false"
            @add-perks="handleAddPerks('AI')"
            @upgrade="handleUpgradePerk"
            @remove="handleRemovePerk"
          />
        </div>
      </TabPanel>

      <!-- LE Research Tab -->
      <TabPanel>
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
          <PerkTable
            :perks="lePerks"
            perk-type="LE"
            :editable="false"
            @add-perks="handleAddPerks('LE')"
            @upgrade="handleUpgradePerk"
            @remove="handleRemovePerk"
          />
        </div>
      </TabPanel>
    </TabView>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';
import Badge from 'primevue/badge';
import PerkTable from './PerkTable.vue';
import PerkPointsSummary from './PerkPointsSummary.vue';
import type { TinkerProfile } from '@/lib/tinkerprofiles/types';
import { calculatePerkPointsDetailed } from '@/services/perk-calculator';
import type { PerkCharacterData, PerkEntry, ResearchEntry } from '@/lib/tinkerprofiles/perk-types';

// Props
const props = defineProps<{
  profile: TinkerProfile;
}>();

// Character data for calculations
const characterData = computed(
  (): PerkCharacterData => ({
    level: props.profile.Character?.Level || 1,
    alienLevel: props.profile.Character?.AlienLevel || 0,
    profession: props.profile.Character?.Profession || 'Adventurer',
    breed: props.profile.Character?.Breed || 'Solitus',
    expansion: 'SL', // Default expansion
  })
);

// Point calculations
const pointCalculation = computed(() => {
  return calculatePerkPointsDetailed(characterData.value);
});

// Extract perks from profile
const slPerks = computed((): PerkEntry[] => {
  const perkSystem = props.profile.PerksAndResearch as any;
  if (!perkSystem || typeof perkSystem !== 'object' || !Array.isArray(perkSystem.perks)) {
    return [];
  }
  return perkSystem.perks.filter((perk: any) => perk.type === 'SL') as PerkEntry[];
});

const aiPerks = computed((): PerkEntry[] => {
  const perkSystem = props.profile.PerksAndResearch as any;
  if (!perkSystem || typeof perkSystem !== 'object' || !Array.isArray(perkSystem.perks)) {
    return [];
  }
  return perkSystem.perks.filter((perk: any) => perk.type === 'AI') as PerkEntry[];
});

const lePerks = computed((): ResearchEntry[] => {
  const perkSystem = props.profile.PerksAndResearch as any;
  if (!perkSystem || typeof perkSystem !== 'object' || !Array.isArray(perkSystem.research)) {
    return [];
  }
  return perkSystem.research as ResearchEntry[];
});

// SL Perks data
const maxSLPoints = computed(() => pointCalculation.value.standardPoints.total);
const slPointsUsed = computed(() => {
  const perkSystem = props.profile.PerksAndResearch as any;
  if (!perkSystem || typeof perkSystem !== 'object' || !perkSystem.standardPerkPoints) {
    return 0;
  }
  return perkSystem.standardPerkPoints.spent || 0;
});
const slPointsRemaining = computed(() => maxSLPoints.value - slPointsUsed.value);
const slPerkCount = computed(() => slPerks.value.length);

// AI Perks data
const maxAIPoints = computed(() => pointCalculation.value.aiPoints.total);
const aiPointsUsed = computed(() => {
  const perkSystem = props.profile.PerksAndResearch as any;
  if (!perkSystem || typeof perkSystem !== 'object' || !perkSystem.aiPerkPoints) {
    return 0;
  }
  return perkSystem.aiPerkPoints.spent || 0;
});
const aiPointsRemaining = computed(() => maxAIPoints.value - aiPointsUsed.value);
const aiPerkCount = computed(() => aiPerks.value.length);
const hasAILevel = computed(() => characterData.value.alienLevel > 0);

// LE Research data
const researchCount = computed(() => lePerks.value.length);

// Event handlers for future functionality
function handleAddPerks(type: 'SL' | 'AI' | 'LE') {
  console.log(`Add ${type} perks - functionality coming soon`);
}

function handleUpgradePerk(perk: PerkEntry | ResearchEntry) {
  console.log(`Upgrade perk ${perk.name} - functionality coming soon`);
}

function handleRemovePerk(perk: PerkEntry | ResearchEntry) {
  console.log(`Remove perk ${perk.name} - functionality coming soon`);
}
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

<!--
CharacterInfoPanel - Character basic information display
Shows character stats, health, nano, and other core information
-->
<template>
  <div class="character-info-panel bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg p-6">
    <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4">
      Character Information
    </h3>
    
    <!-- Basic Info Grid -->
    <div class="grid grid-cols-1 gap-4 mb-6">
      <!-- Level & Title Level -->
      <div class="p-4 bg-surface-50 dark:bg-surface-800 rounded-lg">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-medium text-surface-700 dark:text-surface-300">Level</span>
          <Badge :value="profile.Character?.Level || 1" severity="info" />
        </div>
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-surface-700 dark:text-surface-300">Title Level</span>
          <span class="text-sm font-bold text-surface-900 dark:text-surface-50">
            TL{{ titleLevel }}
          </span>
        </div>
        <div class="mt-2 text-xs text-surface-500 dark:text-surface-400">
          {{ titleLevelDescription }}
        </div>
      </div>
      
      <!-- Health & Nano -->
      <div class="grid grid-cols-2 gap-4">
        <div class="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
          <div class="flex items-center gap-2 mb-1">
            <i class="pi pi-heart text-red-600 dark:text-red-400"></i>
            <span class="text-sm font-medium text-red-700 dark:text-red-300">Health</span>
          </div>
          <div class="text-lg font-bold text-red-900 dark:text-red-100">
            {{ formattedHealth }}
          </div>
        </div>
        
        <div class="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <div class="flex items-center gap-2 mb-1">
            <i class="pi pi-bolt text-blue-600 dark:text-blue-400"></i>
            <span class="text-sm font-medium text-blue-700 dark:text-blue-300">Nano</span>
          </div>
          <div class="text-lg font-bold text-blue-900 dark:text-blue-100">
            {{ formattedNano }}
          </div>
        </div>
      </div>
      
      <!-- Character Details -->
      <div class="space-y-3">
        <div class="flex items-center justify-between py-2 border-b border-surface-200 dark:border-surface-700">
          <span class="text-sm font-medium text-surface-700 dark:text-surface-300">Profession</span>
          <span class="text-sm text-surface-900 dark:text-surface-50">{{ getProfessionName(profile.Character?.Profession || 0) }}</span>
        </div>

        <div class="flex items-center justify-between py-2 border-b border-surface-200 dark:border-surface-700">
          <span class="text-sm font-medium text-surface-700 dark:text-surface-300">Breed</span>
          <div class="flex items-center gap-2">
            <i class="pi pi-circle-fill text-xs" :class="breedColor"></i>
            <span class="text-sm text-surface-900 dark:text-surface-50">{{ getBreedName(profile.Character?.Breed || 0) }}</span>
          </div>
        </div>
        
        <div class="flex items-center justify-between py-2 border-b border-surface-200 dark:border-surface-700">
          <span class="text-sm font-medium text-surface-700 dark:text-surface-300">Faction</span>
          <div class="flex items-center gap-2">
            <i class="pi pi-flag text-xs" :class="factionColor"></i>
            <span class="text-sm text-surface-900 dark:text-surface-50">{{ profile.Character?.Faction || 'Unknown' }}</span>
          </div>
        </div>
        
        <div class="flex items-center justify-between py-2 border-b border-surface-200 dark:border-surface-700">
          <span class="text-sm font-medium text-surface-700 dark:text-surface-300">Expansion</span>
          <span class="text-sm text-surface-900 dark:text-surface-50">{{ profile.Character?.Expansion || 'Unknown' }}</span>
        </div>
        
        <div class="flex items-center justify-between py-2">
          <span class="text-sm font-medium text-surface-700 dark:text-surface-300">Account Type</span>
          <Badge
            :value="profile.Character?.AccountType || 'Froob'"
            severity="secondary"
          />
        </div>
      </div>
    </div>
    
    <!-- Attributes Overview -->
    <div v-if="attributes && attributes.length > 0" class="mt-6">
      <h4 class="text-md font-semibold text-surface-900 dark:text-surface-50 mb-3">
        Core Attributes
      </h4>

      <div class="grid grid-cols-2 gap-3">
        <div
          v-for="attribute in attributes"
          :key="attribute.id"
          class="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-800 rounded"
        >
          <span class="text-sm font-medium text-surface-700 dark:text-surface-300">
            {{ attribute.shortName }}
          </span>
          <div class="flex items-center gap-2">
            <div class="text-right">
              <div class="text-sm font-bold text-surface-900 dark:text-surface-50">
                {{ attribute.skill.value || 0 }}
              </div>
              <div class="text-xs text-surface-500 dark:text-surface-400">
                Base: {{ attribute.breedBase }}
              </div>
            </div>
            <span v-if="attribute.skill.trickleDown" class="text-xs text-green-600 dark:text-green-400">
              (+{{ attribute.skill.trickleDown }})
            </span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Profile Metadata -->
    <div class="mt-6 pt-4 border-t border-surface-200 dark:border-surface-700">
      <div class="text-xs text-surface-500 dark:text-surface-400 space-y-1">
        <div class="flex justify-between">
          <span>Profile ID:</span>
          <span class="font-mono">{{ profile.id.substring(0, 8) }}...</span>
        </div>
        <div class="flex justify-between">
          <span>Version:</span>
          <span>{{ profile.version }}</span>
        </div>
        <div class="flex justify-between">
          <span>Created:</span>
          <span>{{ formatDateTime(profile.created) }}</span>
        </div>
        <div class="flex justify-between">
          <span>Updated:</span>
          <span>{{ formatDateTime(profile.updated) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Badge from 'primevue/badge';
import type { TinkerProfile } from '@/lib/tinkerprofiles';
import { calculateTitleLevel, getBreedId, getProfessionName, getBreedName } from '@/services/game-utils';
import { getBreedInitValue } from '@/lib/tinkerprofiles/ip-calculator';
import { skillService } from '@/services/skill-service';

// Props
const props = defineProps<{
  profile: TinkerProfile;
}>();

// Computed
const titleLevel = computed(() => {
  try {
    return calculateTitleLevel(props.profile.Character?.Level || 1);
  } catch {
    return 1;
  }
});

const titleLevelDescription = computed(() => {
  const tl = titleLevel.value;
  const descriptions = {
    1: 'Newbie (1-24)',
    2: 'Rookie (25-49)', 
    3: 'Apprentice (50-99)',
    4: 'Journeyman (100-149)',
    5: 'Expert (150-199)',
    6: 'Master (200-219)',
    7: 'Grandmaster (220)'
  };
  return descriptions[tl as keyof typeof descriptions] || 'Unknown';
});

const formattedHealth = computed(() => {
  const health = props.profile.Character?.MaxHealth;
  if (!health || health === undefined) return '0';
  if (health >= 1000000) {
    return `${(health / 1000000).toFixed(1)}M`;
  } else if (health >= 1000) {
    return `${(health / 1000).toFixed(1)}K`;
  }
  return health.toString();
});

const formattedNano = computed(() => {
  const nano = props.profile.Character?.MaxNano;
  if (!nano || nano === undefined) return '0';
  if (nano >= 1000000) {
    return `${(nano / 1000000).toFixed(1)}M`;
  } else if (nano >= 1000) {
    return `${(nano / 1000).toFixed(1)}K`;
  }
  return nano.toString();
});

const breedColor = computed(() => {
  const breedName = getBreedName(props.profile.Character?.Breed || 0);
  const colorMap: Record<string, string> = {
    'Solitus': 'text-blue-500',
    'Opifex': 'text-green-500',
    'Nanomage': 'text-purple-500',
    'Atrox': 'text-red-500'
  };
  return colorMap[breedName] || 'text-surface-400';
});

const factionColor = computed(() => {
  const colorMap: Record<string, string> = {
    'Omni': 'text-blue-500',
    'Clan': 'text-orange-500',
    'Neutral': 'text-surface-400'
  };
  return colorMap[props.profile.Character?.Faction || ''] || 'text-surface-400';
});

const attributes = computed(() => {
  // Attribute skill IDs: 16-21 (Strength, Agility, Stamina, Intelligence, Sense, Psychic)
  const attributeIds = [16, 17, 18, 19, 20, 21];
  const breedId = props.profile.Character?.Breed || 0;

  // Breed init value indices match attribute order: STR=0, AGI=1, STA=2, INT=3, SEN=4, PSY=5
  const breedInitIndices = [0, 1, 2, 3, 4, 5];

  return attributeIds.map((skillId, index) => {
    try {
      const skillData = props.profile.skills?.[skillId];
      const shortName = skillService.getShortName(skillId);
      const breedBase = getBreedInitValue(breedId, breedInitIndices[index]);

      // Build skill object compatible with display
      const skill = {
        value: skillData?.total || 0,
        trickleDown: skillData?.trickle || 0
      };

      return {
        id: skillId,
        shortName,
        skill,
        breedBase
      };
    } catch (error) {
      console.warn(`Failed to get attribute info for skill ID ${skillId}:`, error);
      return {
        id: skillId,
        shortName: 'UNK',
        skill: { value: 0, trickleDown: 0 },
        breedBase: 0
      };
    }
  });
});

// Methods

function formatDateTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: '2-digit'
    });
  } catch {
    return 'Unknown';
  }
}
</script>

<style scoped>
.character-info-panel {
  @apply shadow-sm;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .grid-cols-2 {
    @apply grid-cols-1;
  }
}

/* Animation for value changes */
.text-sm.font-bold {
  transition: all 0.2s ease-in-out;
}

.text-sm.font-bold:hover {
  @apply scale-105;
}
</style>
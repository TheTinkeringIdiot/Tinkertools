<!--
NanoCard - Individual nano program display card
Shows nano information with compatibility indicators and quick actions
-->
<template>
  <Card
    class="nano-card transition-all duration-200 cursor-pointer hover:shadow-lg"
    :class="[{ 'border-l-4': showCompatibility && compatibilityInfo }, compatibilityBorderClass]"
    @click="handleSelect"
  >
    <template #header v-if="!compact">
      <div class="flex items-center gap-3 p-4 pb-0">
        <div class="flex-shrink-0">
          <Avatar
            :label="nano.school?.charAt(0) || 'N'"
            :class="schoolAvatarClass"
            size="large"
            shape="circle"
          />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 truncate">
                {{ nano.name }}
              </h3>
              <div class="flex items-center gap-2 mt-1">
                <Badge
                  v-if="nano.school"
                  :value="getSchoolShortName(nano.school)"
                  severity="info"
                />
                <Badge :value="`QL ${nano.qualityLevel}`" severity="secondary" />
                <Badge v-if="nano.level" :value="`Lvl ${nano.level}`" severity="secondary" />
              </div>
            </div>
            <div class="flex items-center gap-2 ml-2">
              <!-- Favorite Button -->
              <Button
                :icon="isFavorite ? 'pi pi-heart-fill' : 'pi pi-heart'"
                :class="isFavorite ? 'text-red-500' : 'text-surface-400'"
                size="small"
                severity="secondary"
                text
                rounded
                @click.stop="toggleFavorite"
              />

              <!-- Compatibility Indicator -->
              <div v-if="showCompatibility && compatibilityInfo" class="flex items-center gap-1">
                <i :class="compatibilityIcon" :title="compatibilityTooltip" />
                <span class="text-xs text-surface-600 dark:text-surface-400">
                  {{ compatibilityInfo.compatibilityScore }}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #content>
      <div class="p-4" :class="compact ? 'py-3' : ''">
        <!-- Compact View -->
        <div v-if="compact" class="flex items-center gap-3">
          <div class="flex-shrink-0">
            <Avatar
              :label="nano.school?.charAt(0) || 'N'"
              :class="schoolAvatarClass"
              size="normal"
              shape="circle"
            />
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <h4 class="font-medium text-surface-900 dark:text-surface-50 truncate">
                  {{ nano.name }}
                </h4>
                <div class="flex items-center gap-2 mt-1">
                  <Badge
                    v-if="nano.school"
                    :value="getSchoolShortName(nano.school)"
                    severity="info"
                    size="small"
                  />
                  <Badge :value="`QL ${nano.qualityLevel}`" severity="secondary" size="small" />
                  <Badge v-if="nano.strain" :value="nano.strain" severity="warning" size="small" />
                </div>
              </div>

              <div class="flex items-center gap-2 ml-2">
                <!-- Favorite Button -->
                <Button
                  :icon="isFavorite ? 'pi pi-heart-fill' : 'pi pi-heart'"
                  :class="isFavorite ? 'text-red-500' : 'text-surface-400'"
                  size="small"
                  severity="secondary"
                  text
                  rounded
                  @click.stop="toggleFavorite"
                />

                <!-- Compatibility Indicator -->
                <div v-if="showCompatibility && compatibilityInfo" class="flex items-center gap-1">
                  <i :class="compatibilityIcon" :title="compatibilityTooltip" />
                  <span class="text-xs text-surface-600 dark:text-surface-400">
                    {{ compatibilityInfo.compatibilityScore }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Detailed View -->
        <div v-else class="space-y-3">
          <!-- Description -->
          <p
            v-if="nano.description"
            class="text-sm text-surface-600 dark:text-surface-400 line-clamp-2"
          >
            {{ nano.description }}
          </p>

          <!-- Nano Details -->
          <div class="grid grid-cols-2 gap-4 text-sm">
            <!-- Left Column -->
            <div class="space-y-2">
              <div v-if="nano.strain" class="flex items-center gap-2">
                <span class="text-surface-500 dark:text-surface-400">Strain:</span>
                <Badge :value="nano.strain" severity="warning" />
              </div>

              <div v-if="nano.profession" class="flex items-center gap-2">
                <span class="text-surface-500 dark:text-surface-400">Profession:</span>
                <span class="font-medium">{{ nano.profession }}</span>
              </div>

              <div v-if="nano.nanoPointCost" class="flex items-center gap-2">
                <span class="text-surface-500 dark:text-surface-400">NP Cost:</span>
                <span class="font-medium">{{ nano.nanoPointCost }}</span>
              </div>
            </div>

            <!-- Right Column -->
            <div class="space-y-2">
              <div v-if="nano.memoryUsage" class="flex items-center gap-2">
                <span class="text-surface-500 dark:text-surface-400">Memory:</span>
                <span class="font-medium">{{ nano.memoryUsage }}mb</span>
              </div>

              <div v-if="nano.castingTime" class="flex items-center gap-2">
                <span class="text-surface-500 dark:text-surface-400">Cast Time:</span>
                <span class="font-medium">{{ formatTime(nano.castingTime) }}</span>
              </div>

              <div v-if="nano.rechargeTime" class="flex items-center gap-2">
                <span class="text-surface-500 dark:text-surface-400">Recharge:</span>
                <span class="font-medium">{{ formatTime(nano.rechargeTime) }}</span>
              </div>
            </div>
          </div>

          <!-- Effects Preview -->
          <div v-if="nano.effects && nano.effects.length > 0" class="space-y-2">
            <span class="text-sm font-medium text-surface-700 dark:text-surface-300">Effects:</span>
            <div class="flex flex-wrap gap-1">
              <Chip
                v-for="(effect, index) in nano.effects.slice(0, 3)"
                :key="index"
                :label="formatEffect(effect)"
                class="text-xs"
              />
              <Chip
                v-if="nano.effects.length > 3"
                :label="`+${nano.effects.length - 3} more`"
                class="text-xs"
                severity="secondary"
              />
            </div>
          </div>

          <!-- Casting Requirements -->
          <div
            v-if="nano.castingRequirements && nano.castingRequirements.length > 0"
            class="space-y-2"
          >
            <span class="text-sm font-medium text-surface-700 dark:text-surface-300"
              >Requirements:</span
            >
            <div class="space-y-1">
              <div
                v-for="(req, index) in nano.castingRequirements.slice(
                  0,
                  showCompatibility ? 99 : 3
                )"
                :key="index"
                class="flex items-center justify-between text-xs"
              >
                <span class="text-surface-600 dark:text-surface-400">
                  {{ formatRequirement(req) }}
                </span>
                <span
                  v-if="showCompatibility && compatibilityInfo"
                  :class="getRequirementStatusClass(req)"
                >
                  {{ getRequirementStatus(req) }}
                </span>
              </div>
              <div
                v-if="!showCompatibility && nano.castingRequirements.length > 3"
                class="text-xs text-surface-500 dark:text-surface-400"
              >
                +{{ nano.castingRequirements.length - 3 }} more requirements
              </div>
            </div>
          </div>

          <!-- Compatibility Details -->
          <div
            v-if="showCompatibility && compatibilityInfo && !compatibilityInfo.canCast"
            class="mt-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800"
          >
            <div class="flex items-start gap-2">
              <i
                class="pi pi-exclamation-triangle text-orange-600 dark:text-orange-400 text-sm mt-0.5"
              ></i>
              <div class="flex-1">
                <div class="text-sm font-medium text-orange-800 dark:text-orange-200 mb-1">
                  Cannot Cast
                </div>
                <div class="text-xs text-orange-700 dark:text-orange-300">
                  <div v-if="compatibilityInfo.skillDeficits.length > 0">
                    Skill gaps:
                    {{
                      compatibilityInfo.skillDeficits
                        .map((d) => `${d.skill} (${d.deficit})`)
                        .join(', ')
                    }}
                  </div>
                  <div v-if="compatibilityInfo.levelDeficit > 0">
                    Level gap: {{ compatibilityInfo.levelDeficit }} levels
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import Avatar from 'primevue/avatar';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Chip from 'primevue/chip';

import type {
  NanoProgram,
  NanoCompatibilityInfo,
  CastingRequirement,
  NanoEffect,
  TinkerProfile,
} from '@/types/nano';

// Props
const props = withDefaults(
  defineProps<{
    nano: NanoProgram;
    compact?: boolean;
    showCompatibility?: boolean;
    activeProfile?: TinkerProfile | null;
    compatibilityInfo?: NanoCompatibilityInfo | null;
  }>(),
  {
    compact: false,
    showCompatibility: false,
    activeProfile: null,
    compatibilityInfo: null,
  }
);

// Emits
const emit = defineEmits<{
  select: [nano: NanoProgram];
  favorite: [nanoId: number, isFavorite: boolean];
}>();

// Reactive state
const isFavorite = ref(false);

// Computed
const schoolAvatarClass = computed(() => {
  const schoolColors: Record<string, string> = {
    'Matter Metamorphosis': 'bg-red-500 text-white',
    'Biological Metamorphosis': 'bg-green-500 text-white',
    'Psychological Modifications': 'bg-purple-500 text-white',
    'Matter Creation': 'bg-blue-500 text-white',
    'Time and Space': 'bg-yellow-500 text-white',
    'Sensory Improvement': 'bg-indigo-500 text-white',
  };
  return (props.nano.school && schoolColors[props.nano.school]) || 'bg-surface-500 text-white';
});

const compatibilityBorderClass = computed(() => {
  if (!props.showCompatibility || !props.compatibilityInfo) {
    return '';
  }

  if (props.compatibilityInfo.canCast) {
    return 'border-l-green-500';
  } else if (props.compatibilityInfo.compatibilityScore >= 75) {
    return 'border-l-yellow-500';
  } else {
    return 'border-l-red-500';
  }
});

const compatibilityIcon = computed(() => {
  if (!props.compatibilityInfo) return '';

  if (props.compatibilityInfo.canCast) {
    return 'pi pi-check-circle text-green-500';
  } else if (props.compatibilityInfo.compatibilityScore >= 75) {
    return 'pi pi-exclamation-triangle text-yellow-500';
  } else {
    return 'pi pi-times-circle text-red-500';
  }
});

const compatibilityTooltip = computed(() => {
  if (!props.compatibilityInfo) return '';

  if (props.compatibilityInfo.canCast) {
    return 'Can cast this nano';
  } else {
    const gaps = [];
    if (props.compatibilityInfo.skillDeficits.length > 0) {
      gaps.push(`${props.compatibilityInfo.skillDeficits.length} skill gaps`);
    }
    if (props.compatibilityInfo.levelDeficit > 0) {
      gaps.push(`${props.compatibilityInfo.levelDeficit} level gap`);
    }
    return `Cannot cast: ${gaps.join(', ')}`;
  }
});

// Methods
const getSchoolShortName = (school: string): string => {
  const shortNames: Record<string, string> = {
    'Matter Metamorphosis': 'MM',
    'Biological Metamorphosis': 'BM',
    'Psychological Modifications': 'PM',
    'Matter Creation': 'MC',
    'Time and Space': 'TS',
    'Sensory Improvement': 'SI',
  };
  return shortNames[school] || school;
};

const formatTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.floor((seconds % 3600) / 60);
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
};

const formatEffect = (effect: NanoEffect): string => {
  const typeLabels: Record<string, string> = {
    stat_boost: 'Stat Boost',
    heal: 'Heal',
    damage: 'Damage',
    protection: 'Protection',
    teleport: 'Teleport',
    summon: 'Summon',
    debuff: 'Debuff',
    utility: 'Utility',
  };

  return typeLabels[effect.type] || effect.type;
};

const formatRequirement = (req: CastingRequirement): string => {
  const capitalizeFirst = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  switch (req.type) {
    case 'skill':
      return `${capitalizeFirst(req.requirement as string)}: ${req.value}`;
    case 'stat':
      return `${capitalizeFirst(req.requirement as string)}: ${req.value}`;
    case 'level':
      return `Level: ${req.value}`;
    default:
      return `${capitalizeFirst(req.requirement as string)}: ${req.value}`;
  }
};

const getRequirementStatus = (req: CastingRequirement): string => {
  if (!props.activeProfile || !props.compatibilityInfo) return '';

  const profile = props.activeProfile;
  let currentValue = 0;

  switch (req.type) {
    case 'skill':
      currentValue = profile.skills[req.requirement as string] || 0;
      break;
    case 'stat':
      currentValue = profile.stats[req.requirement as string] || 0;
      break;
    case 'level':
      currentValue = profile.level;
      break;
  }

  return currentValue >= req.value ? '✓' : `${currentValue}/${req.value}`;
};

const getRequirementStatusClass = (req: CastingRequirement): string => {
  if (!props.activeProfile) return '';

  const profile = props.activeProfile;
  let currentValue = 0;

  switch (req.type) {
    case 'skill':
      currentValue = profile.skills[req.requirement as string] || 0;
      break;
    case 'stat':
      currentValue = profile.stats[req.requirement as string] || 0;
      break;
    case 'level':
      currentValue = profile.level;
      break;
  }

  return currentValue >= req.value
    ? 'text-green-600 dark:text-green-400 font-medium'
    : 'text-red-600 dark:text-red-400';
};

const handleSelect = () => {
  emit('select', props.nano);
};

const toggleFavorite = () => {
  isFavorite.value = !isFavorite.value;
  emit('favorite', props.nano.id, isFavorite.value);
};

// Load favorite status
const loadFavoriteStatus = () => {
  try {
    const favorites = localStorage.getItem('tinkertools_nano_favorites');
    if (favorites) {
      const favoritesArray: number[] = JSON.parse(favorites);
      isFavorite.value = favoritesArray.includes(props.nano.id);
    }
  } catch (error) {
    console.warn('Failed to load favorite status:', error);
  }
};

// Initialize
loadFavoriteStatus();
</script>

<style scoped>
.nano-card {
  transition: all 0.2s ease;
  border-left: 4px solid transparent;
}

.nano-card:hover {
  transform: translateY(-1px);
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>

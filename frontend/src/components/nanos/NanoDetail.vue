<!--
NanoDetail - Detailed nano program information dialog
Displays comprehensive nano information including effects, requirements, and compatibility
-->
<template>
  <Dialog
    :visible="visible"
    modal
    :header="nano?.name || 'Nano Details'"
    :style="{ width: '90vw', maxWidth: '1200px' }"
    :breakpoints="{ '960px': '95vw', '641px': '100vw' }"
    @update:visible="handleVisibilityChange"
  >
    <div v-if="nano" class="nano-detail space-y-6">
      <!-- Header Information -->
      <div class="flex items-start gap-4 pb-4 border-b border-surface-200 dark:border-surface-700">
        <Avatar
          :label="getSchoolShortName(nano.school)"
          :class="schoolAvatarClass"
          size="xlarge"
          shape="circle"
        />
        
        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between mb-2">
            <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-100">
              {{ nano.name }}
            </h2>
            <Button
              :icon="isFavorite ? 'pi pi-heart-fill' : 'pi pi-heart'"
              :class="isFavorite ? 'text-red-500' : 'text-surface-400'"
              severity="secondary"
              text
              rounded
              @click="toggleFavorite"
            />
          </div>
          
          <div class="flex flex-wrap gap-2 mb-3">
            <Badge :value="nano.school" severity="info" />
            <Badge :value="`QL ${nano.qualityLevel}`" severity="secondary" />
            <Badge v-if="nano.level" :value="`Level ${nano.level}`" severity="secondary" />
            <Badge v-if="nano.strain" :value="`Strain ${nano.strain}`" severity="warning" />
            <Badge v-if="nano.profession" :value="nano.profession" severity="help" />
          </div>
          
          <p v-if="nano.description" class="text-surface-600 dark:text-surface-400">
            {{ nano.description }}
          </p>
        </div>
      </div>

      <!-- Compatibility Panel (when profile active) -->
      <div 
        v-if="showCompatibility && activeProfile && compatibilityInfo" 
        class="compatibility-panel p-4 rounded-lg border"
        :class="compatibilityPanelClass"
      >
        <div class="flex items-start gap-3">
          <i :class="compatibilityIcon" class="text-xl mt-1"></i>
          <div class="flex-1">
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-semibold">
                {{ compatibilityInfo.canCast ? 'Can Cast' : 'Cannot Cast' }}
              </h3>
              <div class="flex items-center gap-2">
                <span class="text-sm">Compatibility Score:</span>
                <Badge :value="`${compatibilityInfo.compatibilityScore}%`" :severity="compatibilityScoreSeverity" />
              </div>
            </div>
            
            <!-- Compatibility Details -->
            <div v-if="!compatibilityInfo.canCast" class="space-y-2 text-sm">
              <div v-if="compatibilityInfo.skillDeficits.length > 0">
                <strong>Skill Requirements Not Met:</strong>
                <ul class="list-disc list-inside ml-2 mt-1">
                  <li v-for="deficit in compatibilityInfo.skillDeficits" :key="deficit.skill">
                    {{ deficit.skill }}: {{ deficit.current }}/{{ deficit.required }} 
                    <span class="text-red-600 dark:text-red-400">(need {{ deficit.deficit }} more)</span>
                  </li>
                </ul>
              </div>
              
              <div v-if="compatibilityInfo.statDeficits.length > 0">
                <strong>Stat Requirements Not Met:</strong>
                <ul class="list-disc list-inside ml-2 mt-1">
                  <li v-for="deficit in compatibilityInfo.statDeficits" :key="deficit.stat">
                    {{ deficit.stat }}: {{ deficit.current }}/{{ deficit.required }}
                    <span class="text-red-600 dark:text-red-400">(need {{ deficit.deficit }} more)</span>
                  </li>
                </ul>
              </div>
              
              <div v-if="compatibilityInfo.levelDeficit > 0">
                <strong>Level Requirement:</strong>
                Need {{ compatibilityInfo.levelDeficit }} more levels
              </div>
            </div>
            
            <!-- Resource Information -->
            <div class="grid grid-cols-2 gap-4 mt-3 text-sm">
              <div>
                <span class="text-surface-500 dark:text-surface-400">Memory Usage:</span>
                <span class="ml-2 font-medium">{{ compatibilityInfo.memoryUsage }}mb</span>
              </div>
              <div>
                <span class="text-surface-500 dark:text-surface-400">Nano Point Cost:</span>
                <span class="ml-2 font-medium">{{ compatibilityInfo.nanoPointCost }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content Tabs -->
      <TabView>
        <!-- Basic Information Tab -->
        <TabPanel header="Basic Info">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Left Column -->
            <div class="space-y-4">
              <div>
                <h4 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3">
                  Nano Properties
                </h4>
                <div class="space-y-2 text-sm">
                  <div class="grid grid-cols-2 gap-2">
                    <span class="text-surface-600 dark:text-surface-400">School:</span>
                    <span class="font-medium">{{ nano.school }}</span>
                  </div>
                  <div class="grid grid-cols-2 gap-2">
                    <span class="text-surface-600 dark:text-surface-400">Quality Level:</span>
                    <span class="font-medium">{{ nano.qualityLevel }}</span>
                  </div>
                  <div v-if="nano.level" class="grid grid-cols-2 gap-2">
                    <span class="text-surface-600 dark:text-surface-400">Level:</span>
                    <span class="font-medium">{{ nano.level }}</span>
                  </div>
                  <div v-if="nano.strain" class="grid grid-cols-2 gap-2">
                    <span class="text-surface-600 dark:text-surface-400">Strain:</span>
                    <span class="font-medium">{{ nano.strain }}</span>
                  </div>
                  <div v-if="nano.profession" class="grid grid-cols-2 gap-2">
                    <span class="text-surface-600 dark:text-surface-400">Profession:</span>
                    <span class="font-medium">{{ nano.profession }}</span>
                  </div>
                </div>
              </div>

              <!-- Casting Information -->
              <div>
                <h4 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3">
                  Casting
                </h4>
                <div class="space-y-2 text-sm">
                  <div v-if="nano.nanoPointCost" class="grid grid-cols-2 gap-2">
                    <span class="text-surface-600 dark:text-surface-400">Nano Point Cost:</span>
                    <span class="font-medium">{{ nano.nanoPointCost }}</span>
                  </div>
                  <div v-if="nano.castingTime" class="grid grid-cols-2 gap-2">
                    <span class="text-surface-600 dark:text-surface-400">Casting Time:</span>
                    <span class="font-medium">{{ formatTime(nano.castingTime) }}</span>
                  </div>
                  <div v-if="nano.rechargeTime" class="grid grid-cols-2 gap-2">
                    <span class="text-surface-600 dark:text-surface-400">Recharge Time:</span>
                    <span class="font-medium">{{ formatTime(nano.rechargeTime) }}</span>
                  </div>
                  <div v-if="nano.memoryUsage" class="grid grid-cols-2 gap-2">
                    <span class="text-surface-600 dark:text-surface-400">Memory Usage:</span>
                    <span class="font-medium">{{ nano.memoryUsage }}mb</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column -->
            <div class="space-y-4">
              <!-- Duration and Targeting -->
              <div v-if="nano.duration || nano.targeting">
                <h4 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3">
                  Duration & Targeting
                </h4>
                <div class="space-y-2 text-sm">
                  <div v-if="nano.duration" class="grid grid-cols-2 gap-2">
                    <span class="text-surface-600 dark:text-surface-400">Duration:</span>
                    <span class="font-medium">{{ formatDuration(nano.duration) }}</span>
                  </div>
                  <div v-if="nano.targeting" class="grid grid-cols-2 gap-2">
                    <span class="text-surface-600 dark:text-surface-400">Target:</span>
                    <span class="font-medium">{{ formatTargeting(nano.targeting) }}</span>
                  </div>
                </div>
              </div>

              <!-- Acquisition Info -->
              <div v-if="nano.sourceLocation || nano.acquisitionMethod">
                <h4 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3">
                  Acquisition
                </h4>
                <div class="space-y-2 text-sm">
                  <div v-if="nano.sourceLocation" class="grid grid-cols-2 gap-2">
                    <span class="text-surface-600 dark:text-surface-400">Source:</span>
                    <span class="font-medium">{{ nano.sourceLocation }}</span>
                  </div>
                  <div v-if="nano.acquisitionMethod" class="grid grid-cols-2 gap-2">
                    <span class="text-surface-600 dark:text-surface-400">Method:</span>
                    <span class="font-medium">{{ nano.acquisitionMethod }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabPanel>

        <!-- Requirements Tab -->
        <TabPanel header="Requirements">
          <div v-if="nano.castingRequirements && nano.castingRequirements.length > 0">
            <h4 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
              Casting Requirements
            </h4>
            <div class="space-y-3">
              <div
                v-for="(req, index) in nano.castingRequirements"
                :key="index"
                class="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-800 rounded-lg"
              >
                <div class="flex items-center gap-3">
                  <i :class="getRequirementIcon(req.type)" class="text-surface-500 dark:text-surface-400"></i>
                  <div>
                    <div class="font-medium">{{ formatRequirement(req) }}</div>
                    <div v-if="req.critical" class="text-xs text-red-600 dark:text-red-400">
                      Critical Requirement
                    </div>
                  </div>
                </div>
                
                <div v-if="showCompatibility && activeProfile" class="text-right">
                  <div :class="getRequirementStatusClass(req)">
                    {{ getRequirementStatus(req) }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-8 text-surface-500 dark:text-surface-400">
            No casting requirements
          </div>
        </TabPanel>

        <!-- Effects Tab -->
        <TabPanel header="Effects">
          <div v-if="nano.effects && nano.effects.length > 0">
            <h4 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-4">
              Nano Effects
            </h4>
            <div class="space-y-4">
              <div
                v-for="(effect, index) in nano.effects"
                :key="index"
                class="p-4 bg-surface-50 dark:bg-surface-800 rounded-lg"
              >
                <div class="flex items-start gap-3">
                  <div class="flex-shrink-0">
                    <Badge :value="formatEffectType(effect.type)" :severity="getEffectSeverity(effect.type)" />
                  </div>
                  <div class="flex-1">
                    <div class="font-medium mb-1">
                      {{ formatEffectDescription(effect) }}
                    </div>
                    <div class="text-sm text-surface-600 dark:text-surface-400 space-x-4">
                      <span v-if="effect.value">Value: {{ effect.value }}</span>
                      <span v-if="effect.modifier">Modifier: {{ effect.modifier }}</span>
                      <span>{{ effect.stackable ? 'Stackable' : 'Non-stackable' }}</span>
                    </div>
                    <div v-if="effect.conditions && effect.conditions.length > 0" class="mt-2">
                      <div class="text-xs text-surface-500 dark:text-surface-400 mb-1">Conditions:</div>
                      <div class="flex flex-wrap gap-1">
                        <Chip 
                          v-for="(condition, i) in effect.conditions"
                          :key="i"
                          :label="condition.toString()"
                          class="text-xs"
                          severity="secondary"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-8 text-surface-500 dark:text-surface-400">
            No effects information available
          </div>
        </TabPanel>

        <!-- Conflicts & Synergies Tab -->
        <TabPanel header="Interactions">
          <div class="space-y-6">
            <!-- Strain Conflicts -->
            <div v-if="nano.strain">
              <h4 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3">
                Strain Conflicts
              </h4>
              <div class="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                <div class="flex items-start gap-2">
                  <i class="pi pi-exclamation-triangle text-orange-600 dark:text-orange-400 mt-1"></i>
                  <div class="text-sm text-orange-800 dark:text-orange-200">
                    This nano uses strain <strong>{{ nano.strain }}</strong>. Only one nano per strain can be active at a time.
                    Other nanos using this strain will be deactivated when this nano is cast.
                  </div>
                </div>
              </div>
            </div>

            <!-- Effect Conflicts -->
            <div v-if="nano.effects && nano.effects.some(e => e.conflicts && e.conflicts.length > 0)">
              <h4 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3">
                Effect Conflicts
              </h4>
              <div class="space-y-3">
                <div
                  v-for="(effect, index) in nano.effects.filter(e => e.conflicts && e.conflicts.length > 0)"
                  :key="index"
                  class="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800"
                >
                  <div class="text-sm">
                    <div class="font-medium text-red-800 dark:text-red-200 mb-1">
                      {{ formatEffectType(effect.type) }} conflicts with:
                    </div>
                    <ul class="list-disc list-inside text-red-700 dark:text-red-300">
                      <li v-for="conflictId in effect.conflicts" :key="conflictId">
                        Nano ID {{ conflictId }}
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <!-- Stacking Information -->
            <div v-if="nano.effects && nano.effects.length > 0">
              <h4 class="text-lg font-semibold text-surface-900 dark:text-surface-100 mb-3">
                Effect Stacking
              </h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div
                  v-for="(effect, index) in nano.effects"
                  :key="index"
                  class="p-3 rounded-lg border"
                  :class="effect.stackable 
                    ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                    : 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'"
                >
                  <div class="flex items-center gap-2 text-sm">
                    <i 
                      :class="effect.stackable ? 'pi pi-check text-green-600 dark:text-green-400' : 'pi pi-times text-yellow-600 dark:text-yellow-400'"
                    ></i>
                    <span class="font-medium">{{ formatEffectType(effect.type) }}</span>
                    <span :class="effect.stackable ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'">
                      {{ effect.stackable ? 'Stackable' : 'Non-stackable' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabPanel>
      </TabView>
    </div>

    <template #footer>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Button
            :icon="isFavorite ? 'pi pi-heart-fill' : 'pi pi-heart'"
            :label="isFavorite ? 'Remove from Favorites' : 'Add to Favorites'"
            :severity="isFavorite ? 'danger' : 'secondary'"
            outlined
            @click="toggleFavorite"
          />
        </div>
        <Button label="Close" @click="handleClose" autofocus />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Avatar from 'primevue/avatar';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Chip from 'primevue/chip';
import Dialog from 'primevue/dialog';
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';

import type { NanoProgram, TinkerProfile, NanoCompatibilityInfo, CastingRequirement, NanoEffect } from '@/types/nano';

// Props
const props = withDefaults(defineProps<{
  visible: boolean;
  nano?: NanoProgram | null;
  activeProfile?: TinkerProfile | null;
  showCompatibility?: boolean;
}>(), {
  visible: false,
  nano: null,
  activeProfile: null,
  showCompatibility: false
});

// Emits
const emit = defineEmits<{
  'update:visible': [visible: boolean];
  close: [];
}>();

// Reactive state
const isFavorite = ref(false);

// Computed
const schoolAvatarClass = computed(() => {
  if (!props.nano) return 'bg-surface-500 text-white';
  
  const schoolColors: Record<string, string> = {
    'Matter Metamorphosis': 'bg-red-500 text-white',
    'Biological Metamorphosis': 'bg-green-500 text-white',
    'Psychological Modifications': 'bg-purple-500 text-white',
    'Matter Creation': 'bg-blue-500 text-white',
    'Time and Space': 'bg-yellow-500 text-white',
    'Sensory Improvement': 'bg-indigo-500 text-white'
  };
  return schoolColors[props.nano.school] || 'bg-surface-500 text-white';
});

const compatibilityInfo = computed((): NanoCompatibilityInfo | null => {
  if (!props.showCompatibility || !props.activeProfile || !props.nano) {
    return null;
  }

  const profile = props.activeProfile;
  const requirements = props.nano.castingRequirements || [];
  
  let canCast = true;
  let skillDeficits: { skill: string; current: number; required: number; deficit: number }[] = [];
  let statDeficits: { stat: string; current: number; required: number; deficit: number }[] = [];
  let levelDeficit = 0;
  
  for (const req of requirements) {
    switch (req.type) {
      case 'skill':
        const skill = req.requirement as string;
        const currentSkill = profile.skills[skill] || 0;
        if (currentSkill < req.value) {
          canCast = false;
          skillDeficits.push({
            skill,
            current: currentSkill,
            required: req.value,
            deficit: req.value - currentSkill
          });
        }
        break;
        
      case 'stat':
        const stat = req.requirement as string;
        const currentStat = profile.stats[stat] || 0;
        if (currentStat < req.value) {
          canCast = false;
          statDeficits.push({
            stat,
            current: currentStat,
            required: req.value,
            deficit: req.value - currentStat
          });
        }
        break;
        
      case 'level':
        if (profile.level < req.value) {
          canCast = false;
          levelDeficit = req.value - profile.level;
        }
        break;
    }
  }

  const totalRequirements = requirements.length;
  const metRequirements = totalRequirements - skillDeficits.length - statDeficits.length - (levelDeficit > 0 ? 1 : 0);
  const compatibilityScore = totalRequirements > 0 ? Math.round((metRequirements / totalRequirements) * 100) : 100;

  const allSkillReqs = requirements.filter(req => req.type === 'skill');
  let averageSkillGap = 0;
  
  if (allSkillReqs.length > 0) {
    const totalGap = skillDeficits.reduce((sum, deficit) => sum + deficit.deficit, 0);
    averageSkillGap = Math.round(totalGap / allSkillReqs.length);
  }

  return {
    canCast,
    compatibilityScore,
    averageSkillGap,
    skillDeficits,
    statDeficits,
    levelDeficit,
    memoryUsage: props.nano.memoryUsage || 0,
    nanoPointCost: props.nano.nanoPointCost || 0
  };
});

const compatibilityPanelClass = computed(() => {
  if (!compatibilityInfo.value) return '';
  
  if (compatibilityInfo.value.canCast) {
    return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
  } else if (compatibilityInfo.value.compatibilityScore >= 75) {
    return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800';
  } else {
    return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
  }
});

const compatibilityIcon = computed(() => {
  if (!compatibilityInfo.value) return '';
  
  if (compatibilityInfo.value.canCast) {
    return 'pi pi-check-circle text-green-600 dark:text-green-400';
  } else if (compatibilityInfo.value.compatibilityScore >= 75) {
    return 'pi pi-exclamation-triangle text-yellow-600 dark:text-yellow-400';
  } else {
    return 'pi pi-times-circle text-red-600 dark:text-red-400';
  }
});

const compatibilityScoreSeverity = computed(() => {
  if (!compatibilityInfo.value) return 'secondary';
  
  if (compatibilityInfo.value.compatibilityScore >= 90) return 'success';
  if (compatibilityInfo.value.compatibilityScore >= 75) return 'warning';
  return 'danger';
});

// Methods
const getSchoolShortName = (school: string): string => {
  const shortNames: Record<string, string> = {
    'Matter Metamorphosis': 'MM',
    'Biological Metamorphosis': 'BM',
    'Psychological Modifications': 'PM',
    'Matter Creation': 'MC',
    'Time and Space': 'TS',
    'Sensory Improvement': 'SI'
  };
  return shortNames[school] || school.charAt(0);
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

const formatDuration = (duration: any): string => {
  if (typeof duration === 'number') {
    return formatTime(duration);
  }
  return duration?.toString() || 'Unknown';
};

const formatTargeting = (targeting: any): string => {
  return targeting?.toString() || 'Unknown';
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

const getRequirementIcon = (type: string): string => {
  const icons: Record<string, string> = {
    'skill': 'pi pi-graduation-cap',
    'stat': 'pi pi-chart-bar',
    'level': 'pi pi-user',
    'nano': 'pi pi-flash',
    'item': 'pi pi-box'
  };
  return icons[type] || 'pi pi-question-circle';
};

const getRequirementStatus = (req: CastingRequirement): string => {
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

  return currentValue >= req.value ? '✓ Met' : `${currentValue}/${req.value}`;
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
    : 'text-red-600 dark:text-red-400 font-medium';
};

const formatEffectType = (type: string): string => {
  const typeLabels: Record<string, string> = {
    'stat_boost': 'Stat Boost',
    'heal': 'Heal',
    'damage': 'Damage',
    'protection': 'Protection',
    'teleport': 'Teleport',
    'summon': 'Summon',
    'debuff': 'Debuff',
    'utility': 'Utility'
  };
  
  return typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1);
};

const formatEffectDescription = (effect: NanoEffect): string => {
  const type = formatEffectType(effect.type);
  const value = effect.value || '';
  const stat = effect.statId ? ` (${effect.statId})` : '';
  
  return `${type}${value ? ` ${value}` : ''}${stat}`;
};

const getEffectSeverity = (type: string): string => {
  const severityMap: Record<string, string> = {
    'stat_boost': 'success',
    'heal': 'success',
    'damage': 'danger',
    'protection': 'info',
    'teleport': 'help',
    'summon': 'warning',
    'debuff': 'danger',
    'utility': 'secondary'
  };
  
  return severityMap[type] || 'secondary';
};

const toggleFavorite = () => {
  if (!props.nano) return;
  
  isFavorite.value = !isFavorite.value;
  
  try {
    const favorites = JSON.parse(localStorage.getItem('tinkertools_nano_favorites') || '[]');
    const nanoId = props.nano.id;
    
    if (isFavorite.value) {
      if (!favorites.includes(nanoId)) {
        favorites.push(nanoId);
      }
    } else {
      const index = favorites.indexOf(nanoId);
      if (index > -1) {
        favorites.splice(index, 1);
      }
    }
    
    localStorage.setItem('tinkertools_nano_favorites', JSON.stringify(favorites));
  } catch (error) {
    console.warn('Failed to save favorite status:', error);
  }
};

const loadFavoriteStatus = () => {
  if (!props.nano) return;
  
  try {
    const favorites = JSON.parse(localStorage.getItem('tinkertools_nano_favorites') || '[]');
    isFavorite.value = favorites.includes(props.nano.id);
  } catch (error) {
    console.warn('Failed to load favorite status:', error);
  }
};

const handleVisibilityChange = (visible: boolean) => {
  emit('update:visible', visible);
};

const handleClose = () => {
  emit('close');
};

// Watch for nano changes
watch(() => props.nano, () => {
  if (props.nano) {
    loadFavoriteStatus();
  }
}, { immediate: true });
</script>

<style scoped>
.nano-detail {
  max-height: 80vh;
  overflow-y: auto;
}

.compatibility-panel {
  transition: all 0.3s ease;
}
</style>
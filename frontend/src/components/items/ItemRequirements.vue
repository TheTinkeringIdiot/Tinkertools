<!--
ItemRequirements - Enhanced requirements display with grouping
Shows item requirements organized by category with compatibility checking
-->
<template>
  <Card v-if="hasRequirements">
    <template #header>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <i class="pi pi-shield text-orange-500"></i>
          <h3 class="text-lg font-semibold">Requirements</h3>
        </div>
        <div v-if="showCompatibility && overallCompatibility" class="flex items-center gap-2">
          <i :class="overallCompatibility.icon" :style="{ color: overallCompatibility.color }"></i>
          <span class="text-sm" :style="{ color: overallCompatibility.color }">
            {{ overallCompatibility.text }}
          </span>
        </div>
      </div>
    </template>
    
    <template #content>
      <div class="space-y-6">
        <!-- Attributes -->
        <div v-if="attributeRequirements.length > 0">
          <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-2">
            <i class="pi pi-user text-blue-500"></i>
            Attributes
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="req in attributeRequirements"
              :key="req.stat"
              class="flex justify-between items-center p-3 rounded"
              :class="getRequirementClass(req)"
            >
              <div class="flex items-center gap-2">
                <i v-if="showCompatibility" :class="getCompatibilityIcon(req)"></i>
                <span class="text-sm text-surface-600 dark:text-surface-400">
                  {{ getStatName(req.stat) }}
                </span>
              </div>
              <div class="text-right">
                <div class="font-mono font-medium">{{ req.value }}</div>
                <div v-if="showCompatibility && profile" class="text-xs text-surface-500">
                  (You: {{ getCharacterStat(req.stat) }})
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Skills -->
        <div v-if="skillRequirements.length > 0">
          <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-2">
            <i class="pi pi-cog text-green-500"></i>
            Skills
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="req in skillRequirements"
              :key="req.stat"
              class="flex justify-between items-center p-3 rounded"
              :class="getRequirementClass(req)"
            >
              <div class="flex items-center gap-2">
                <i v-if="showCompatibility" :class="getCompatibilityIcon(req)"></i>
                <span class="text-sm text-surface-600 dark:text-surface-400">
                  {{ getStatName(req.stat) }}
                </span>
              </div>
              <div class="text-right">
                <div class="font-mono font-medium">
                  {{ formatSkillRequirement(req.stat, req.value) }}
                </div>
                <div v-if="showCompatibility && profile" class="text-xs text-surface-500">
                  (You: {{ formatSkillRequirement(req.stat, getCharacterStat(req.stat)) }})
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Level and Character -->
        <div v-if="characterRequirements.length > 0">
          <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-2">
            <i class="pi pi-id-card text-purple-500"></i>
            Character
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="req in characterRequirements"
              :key="req.stat"
              class="flex justify-between items-center p-3 rounded"
              :class="getRequirementClass(req)"
            >
              <div class="flex items-center gap-2">
                <i v-if="showCompatibility" :class="getCompatibilityIcon(req)"></i>
                <span class="text-sm text-surface-600 dark:text-surface-400">
                  {{ getStatName(req.stat) }}
                </span>
              </div>
              <div class="text-right">
                <div class="font-mono font-medium">
                  {{ formatCharacterRequirement(req.stat, req.value) }}
                </div>
                <div v-if="showCompatibility && profile" class="text-xs text-surface-500">
                  (You: {{ formatCharacterRequirement(req.stat, getCharacterStat(req.stat)) }})
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Other Requirements -->
        <div v-if="otherRequirements.length > 0">
          <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-2">
            <i class="pi pi-ellipsis-h text-gray-500"></i>
            Other
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="req in otherRequirements"
              :key="req.stat"
              class="flex justify-between items-center p-3 rounded"
              :class="getRequirementClass(req)"
            >
              <div class="flex items-center gap-2">
                <i v-if="showCompatibility" :class="getCompatibilityIcon(req)"></i>
                <span class="text-sm text-surface-600 dark:text-surface-400">
                  {{ getStatName(req.stat) || `Stat ${req.stat}` }}
                </span>
              </div>
              <div class="text-right">
                <div class="font-mono font-medium">{{ req.value }}</div>
                <div v-if="showCompatibility && profile" class="text-xs text-surface-500">
                  (You: {{ getCharacterStat(req.stat) }})
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Summary -->
        <div v-if="showCompatibility && requirementsSummary" class="p-4 rounded-lg border" :class="requirementsSummary.class">
          <div class="flex items-center gap-3">
            <i :class="requirementsSummary.icon" class="text-lg"></i>
            <div>
              <div class="font-medium">{{ requirementsSummary.title }}</div>
              <div class="text-sm opacity-75">{{ requirementsSummary.description }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Item, TinkerProfile, ItemRequirement } from '@/types/api'
import { getStatName, getProfessionName, getBreedName } from '@/services/game-utils'

const props = defineProps<{
  item: Item
  profile?: TinkerProfile | null
  showCompatibility?: boolean
}>()

// Computed Properties
const hasRequirements = computed(() => 
  props.item.requirements && props.item.requirements.length > 0
)

const attributeRequirements = computed(() => {
  if (!props.item.requirements) return []
  // Attributes: 16-21 (Strength, Agility, Stamina, Intelligence, Sense, Psychic)
  return props.item.requirements.filter(req => req.stat >= 16 && req.stat <= 21)
})

const skillRequirements = computed(() => {
  if (!props.item.requirements) return []
  // Skills: 100-200 range approximately
  const skillIds = [
    100, 101, 102, 103, 104, 105, 106, 107, 108, // Combat skills
    148, 150, 134, 133, 119, // Special attack skills
    123, 124, 125, 126, 127, 128, 129, 130, 131, // Support skills
    160, 161, 162, 163 // Trade skills
  ]
  return props.item.requirements.filter(req => skillIds.includes(req.stat))
})

const characterRequirements = computed(() => {
  if (!props.item.requirements) return []
  // Character: Level (54), Profession (60), Breed (4), Gender (59)
  const characterIds = [4, 54, 59, 60]
  return props.item.requirements.filter(req => characterIds.includes(req.stat))
})

const otherRequirements = computed(() => {
  if (!props.item.requirements) return []
  const knownIds = [
    ...attributeRequirements.value.map(r => r.stat),
    ...skillRequirements.value.map(r => r.stat),
    ...characterRequirements.value.map(r => r.stat)
  ]
  return props.item.requirements.filter(req => !knownIds.includes(req.stat))
})

const overallCompatibility = computed(() => {
  if (!props.showCompatibility || !props.profile || !props.item.requirements) return null
  
  const unmetRequirements = props.item.requirements.filter(req => !canMeetRequirement(req))
  
  if (unmetRequirements.length === 0) {
    return {
      icon: 'pi pi-check-circle',
      color: '#22c55e',
      text: 'All requirements met'
    }
  } else {
    return {
      icon: 'pi pi-times-circle',
      color: '#ef4444',
      text: `${unmetRequirements.length} requirement(s) not met`
    }
  }
})

const requirementsSummary = computed(() => {
  if (!props.showCompatibility || !props.profile || !props.item.requirements) return null
  
  const total = props.item.requirements.length
  const met = props.item.requirements.filter(req => canMeetRequirement(req)).length
  const unmet = total - met
  
  if (unmet === 0) {
    return {
      title: 'Ready to Use',
      description: `All ${total} requirements are satisfied`,
      icon: 'pi pi-check-circle text-green-600',
      class: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    }
  } else if (met > unmet) {
    return {
      title: 'Mostly Compatible',
      description: `${met} of ${total} requirements met, ${unmet} remaining`,
      icon: 'pi pi-exclamation-triangle text-yellow-600',
      class: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
    }
  } else {
    return {
      title: 'Incompatible',
      description: `Only ${met} of ${total} requirements met`,
      icon: 'pi pi-times-circle text-red-600',
      class: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
    }
  }
})

// Methods
function canMeetRequirement(requirement: ItemRequirement): boolean {
  if (!props.profile) return false
  const characterStat = props.profile.stats?.[requirement.stat] || 0
  return characterStat >= requirement.value
}

function getCharacterStat(statId: number): number {
  return props.profile?.stats?.[statId] || 0
}

function getRequirementClass(requirement: ItemRequirement): string {
  if (!props.showCompatibility) {
    return 'bg-surface-50 dark:bg-surface-900'
  }
  
  const canMeet = canMeetRequirement(requirement)
  return canMeet 
    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
}

function getCompatibilityIcon(requirement: ItemRequirement): string {
  const canMeet = canMeetRequirement(requirement)
  return canMeet 
    ? 'pi pi-check text-green-600'
    : 'pi pi-times text-red-600'
}

function formatSkillRequirement(statId: number, value: number): string {
  // Most weapon skills are displayed as percentages
  const percentageSkills = [100, 101, 102, 103, 104, 105, 106, 107, 108] // Combat skills
  
  if (percentageSkills.includes(statId)) {
    return `${value}%`
  }
  
  return value.toString()
}

function formatCharacterRequirement(statId: number, value: number): string {
  switch (statId) {
    case 4: // Breed
      return getBreedName(value) || value.toString()
    case 54: // Level
      return `Level ${value}`
    case 60: // Profession
      return getProfessionName(value) || value.toString()
    case 59: // Gender
      return value === 1 ? 'Male' : value === 2 ? 'Female' : value.toString()
    default:
      return value.toString()
  }
}
</script>

<style scoped>
.font-mono {
  font-family: 'Courier New', 'Monaco', 'Lucida Console', monospace;
}

/* Ensure consistent spacing */
.grid > div {
  min-height: 3.5rem;
}

/* Section headers with icons */
h4 i {
  width: 1rem;
  height: 1rem;
}

/* Compatibility indicators */
.pi-check {
  color: #22c55e;
}

.pi-times {
  color: #ef4444;
}

/* Requirements grid responsive behavior */
@media (max-width: 768px) {
  .lg\\:grid-cols-3 {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .md\\:grid-cols-2 {
    grid-template-columns: repeat(1, minmax(0, 1fr));
  }
}
</style>
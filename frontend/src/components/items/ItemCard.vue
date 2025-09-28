<!--
ItemCard - Individual item display card for grid view
Shows item info with compatibility status and quick actions
-->
<template>
  <Card
    class="item-card group cursor-pointer h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
    :class="{
      'ring-2 ring-primary-500': isComparing,
      'border-green-500 dark:border-green-400': showCompatibility && isCompatible,
      'border-red-500 dark:border-red-400': showCompatibility && !isCompatible && item.requirements?.length,
      'opacity-75': showCompatibility && !isCompatible && item.requirements?.length
    }"
    @click="$emit('click', item)"
  >
    <template #header>
      <div class="relative">
        <!-- Item Image/Icon -->
        <div class="h-32 bg-gradient-to-br from-surface-100 to-surface-200 dark:from-surface-800 dark:to-surface-900 flex items-center justify-center">
          <img 
            v-if="itemIconUrl"
            :src="itemIconUrl" 
            :alt="`${item.name} icon`"
            class="w-12 h-12 object-contain"
            @error="onIconError"
          />
          <i v-else class="pi pi-box text-3xl text-surface-400"></i>
        </div>
        
        <!-- Overlay Badges -->
        <div class="absolute top-2 left-2 flex flex-col gap-1">
          <Badge :value="`QL ${item.ql}`" severity="info" />
          <Badge v-if="item.is_nano" value="Nano" severity="success" />
          <Badge v-if="isRare" value="Rare" severity="warning" />
        </div>
        
        <!-- Compatibility Status -->
        <div v-if="showCompatibility" class="absolute top-2 right-2">
          <div
            v-if="isCompatible"
            class="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"
            v-tooltip.left="'You can use this item'"
          >
            <i class="pi pi-check text-white text-xs"></i>
          </div>
          <div
            v-else-if="item.requirements?.length"
            class="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
            v-tooltip.left="'Requirements not met'"
          >
            <i class="pi pi-times text-white text-xs"></i>
          </div>
          <div
            v-else
            class="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center"
            v-tooltip.left="'No requirements'"
          >
            <i class="pi pi-question text-white text-xs"></i>
          </div>
        </div>
        
        <!-- Quick Actions -->
        <div class="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            icon="pi pi-eye"
            size="small"
            rounded
            severity="secondary"
            @click.stop="$emit('quick-view', item)"
            v-tooltip.bottom="'Quick View'"
          />
        </div>
      </div>
    </template>

    <template #title>
      <div class="flex items-start justify-between gap-2 mb-2">
        <h3 class="text-sm font-semibold line-clamp-2 min-h-[2.5rem] text-surface-900 dark:text-surface-50">
          {{ item.name }}
        </h3>
      </div>
    </template>

    <template #content>
      <div class="space-y-3">
        <!-- Description -->
        <p v-if="item.description" class="text-xs text-surface-600 dark:text-surface-400 line-clamp-3">
          {{ item.description }}
        </p>
        
        <!-- Key Stats -->
        <div v-if="keyStats.length" class="space-y-1">
          <div class="text-xs font-medium text-surface-700 dark:text-surface-300">Key Stats:</div>
          <div class="space-y-1">
            <div
              v-for="stat in keyStats"
              :key="stat.name"
              class="flex justify-between text-xs"
            >
              <span class="text-surface-600 dark:text-surface-400">{{ stat.name }}</span>
              <span
                class="font-mono font-medium"
                :class="{
                  'text-green-600 dark:text-green-400': stat.value > 0,
                  'text-red-600 dark:text-red-400': stat.value < 0,
                  'text-surface-700 dark:text-surface-300': stat.value === 0
                }"
              >
                {{ stat.value > 0 ? '+' : '' }}{{ stat.value }}
              </span>
            </div>
          </div>
        </div>
        
        <!-- Requirements Preview -->
        <div v-if="showCompatibility && item.requirements?.length" class="space-y-1">
          <div class="text-xs font-medium text-surface-700 dark:text-surface-300">Requirements:</div>
          <div class="space-y-1">
            <div
              v-for="req in displayedRequirements"
              :key="req.stat"
              class="flex justify-between text-xs"
            >
              <span class="text-surface-600 dark:text-surface-400">{{ getStatName(req.stat) }}</span>
              <span
                class="font-mono"
                :class="{
                  'text-green-600 dark:text-green-400': canMeetRequirement(req),
                  'text-red-600 dark:text-red-400': !canMeetRequirement(req)
                }"
              >
                {{ req.value }}
                <i v-if="canMeetRequirement(req)" class="pi pi-check text-xs ml-1"></i>
                <i v-else class="pi pi-times text-xs ml-1"></i>
              </span>
            </div>
            <div v-if="item.requirements.length > 3" class="text-xs text-surface-500 dark:text-surface-400">
              +{{ item.requirements.length - 3 }} more requirements
            </div>
          </div>
        </div>
        
        <!-- Item Properties -->
        <div v-if="itemProperties.length" class="flex flex-wrap gap-1">
          <Tag
            v-for="prop in itemProperties"
            :key="prop.name"
            :value="prop.name"
            :severity="prop.severity"
            size="small"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center justify-between">
        <!-- Item Type/Category -->
        <div class="text-xs text-surface-500 dark:text-surface-400">
          {{ getItemTypeLabel(item.item_class) }}
        </div>
        
        <!-- Actions -->
        <div class="flex items-center gap-1">
          <!-- Compare Button -->
          <Button
            icon="pi pi-clone"
            size="small"
            text
            :severity="isComparing ? 'primary' : 'secondary'"
            @click.stop="$emit('compare', item)"
            v-tooltip.bottom="'Add to comparison'"
          />

          <!-- Cast Buff Button (for nanos only) -->
          <Button
            v-if="item.is_nano && profilesStore.hasActiveProfile"
            icon="pi pi-sparkles"
            size="small"
            text
            severity="primary"
            @click.stop="$emit('cast-buff', item)"
            v-tooltip.bottom="'Cast nano buff to active profile'"
          />
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Item, TinkerProfile, ItemRequirement } from '@/types/api'
import { getItemIconUrl } from '@/services/game-utils'
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles'
import { mapProfileToStats } from '@/utils/profile-stats-mapper'

const props = defineProps<{
  item: Item
  profile?: TinkerProfile | null
  showCompatibility?: boolean
  isComparing?: boolean
}>()

defineEmits<{
  click: [item: Item]
  compare: [item: Item]
  'cast-buff': [item: Item]
  'quick-view': [item: Item]
}>()

// Store
const profilesStore = useTinkerProfilesStore()

// State
const iconLoadError = ref(false)

// Computed Properties
const itemIconUrl = computed(() => {
  if (iconLoadError.value) return null
  return getItemIconUrl(props.item.stats || [])
})

const keyStats = computed(() => {
  if (!props.item.stats || props.item.stats.length === 0) return []
  
  return props.item.stats
    .filter(stat => stat.value !== 0)
    .slice(0, 4)
    .map(stat => ({
      name: getStatName(stat.stat),
      value: stat.value
    }))
})

const displayedRequirements = computed(() => {
  if (!props.item.requirements) return []
  return props.item.requirements.slice(0, 3)
})

const isCompatible = computed(() => {
  if (!props.showCompatibility || !props.profile || !props.item.requirements) {
    return true // Unknown or no requirements
  }
  
  return props.item.requirements.every(req => canMeetRequirement(req))
})

const isRare = computed(() => {
  // Logic to determine if item is rare (high QL, special effects, etc.)
  return props.item.ql >= 250 || (props.item.stats?.some(s => Math.abs(s.value) > 100))
})

const itemProperties = computed(() => {
  const props_list: Array<{ name: string; severity: string }> = []
  
  if (props.item.is_nano) {
    props_list.push({ name: 'Nano', severity: 'success' })
  }
  
  // Add more properties based on item data
  if (props.item.attack_stats) {
    props_list.push({ name: 'Weapon', severity: 'warning' })
  }
  
  if (props.item.spell_data?.length) {
    props_list.push({ name: 'Special Effects', severity: 'info' })
  }
  
  return props_list.slice(0, 2) // Limit to avoid overcrowding
})

// Methods
const statNameMap: Record<number, string> = {
  16: 'Strength', 17: 'Agility', 18: 'Stamina',
  19: 'Intelligence', 20: 'Sense', 21: 'Psychic',
  102: '1H Blunt', 103: '1H Edged', 105: '2H Edged',
  109: '2H Blunt', 133: 'Ranged Energy', 161: 'Computer Literacy'
}

const itemClassMap: Record<number, string> = {
  1: '1H Blunt', 2: '1H Edged', 3: '2H Blunt', 4: '2H Edged', 5: 'Ranged',
  6: 'Body Armor', 7: 'Head Armor', 8: 'Arm Armor', 9: 'Leg Armor', 10: 'Foot Armor',
  15: 'Implant', 20: 'Utility'
}

function getStatName(statId: number): string {
  return statNameMap[statId] || `Stat ${statId}`
}

function getItemTypeLabel(itemClass: number): string {
  return itemClassMap[itemClass] || `Type ${itemClass}`
}

function canMeetRequirement(requirement: ItemRequirement): boolean {
  if (!props.profile) return false

  // Use the profile stats mapper to get all stats and skills correctly
  const stats = mapProfileToStats(props.profile)
  const characterValue = stats[requirement.stat] || 0
  return characterValue >= requirement.value
}

function onIconError() {
  iconLoadError.value = true
}
</script>

<style scoped>
/* Item card hover effects */
.item-card:hover {
  @apply shadow-xl;
}

/* Line clamp utilities */
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Ensure consistent card height */
.item-card :deep(.p-card-body) {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.item-card :deep(.p-card-content) {
  flex: 1;
}

/* Custom badge styling */
:deep(.p-badge) {
  font-size: 0.625rem;
  min-width: auto;
  padding: 0.125rem 0.375rem;
}

/* Stat value styling */
.font-mono {
  font-family: 'Courier New', 'Monaco', 'Lucida Console', monospace;
  font-size: 0.6875rem;
}

/* Hover animations for actions */
.group:hover .opacity-0 {
  opacity: 1;
}

/* Compatibility status styling */
.border-green-500 {
  border-width: 2px;
  border-color: rgb(34, 197, 94);
}

.border-red-500 {
  border-width: 2px;
  border-color: rgb(239, 68, 68);
}

.dark .border-green-400 {
  border-color: rgb(74, 222, 128);
}

.dark .border-red-400 {
  border-color: rgb(248, 113, 113);
}
</style>
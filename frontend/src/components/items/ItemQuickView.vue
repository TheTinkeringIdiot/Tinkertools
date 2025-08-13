<!--
ItemQuickView - Quick preview component for items
Shows essential item information in a compact format
-->
<template>
  <div class="item-quick-view space-y-4">
    <!-- Item Header -->
    <div class="flex items-start gap-4">
      <div class="w-16 h-16 bg-surface-100 dark:bg-surface-800 rounded-lg flex items-center justify-center flex-shrink-0">
        <img 
          v-if="itemIconUrl"
          :src="itemIconUrl" 
          :alt="`${item.name} icon`"
          class="w-12 h-12 object-contain"
          @error="onIconError"
        />
        <i v-else class="pi pi-box text-2xl text-surface-400"></i>
      </div>
      
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-2">
          <h3 class="text-lg font-semibold">{{ item.name }}</h3>
          <Badge :value="`QL ${item.ql}`" severity="info" />
          <Badge v-if="item.is_nano" value="Nano" severity="success" />
        </div>
        
        <p v-if="item.description" class="text-sm text-surface-600 dark:text-surface-400 line-clamp-2">
          {{ item.description }}
        </p>
      </div>
    </div>

    <!-- Key Stats -->
    <div v-if="keyStats.length > 0">
      <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Key Statistics</h4>
      <div class="grid grid-cols-2 gap-2">
        <div
          v-for="stat in keyStats"
          :key="stat.name"
          class="flex justify-between text-sm p-2 bg-surface-50 dark:bg-surface-900 rounded"
        >
          <span class="text-surface-600 dark:text-surface-400">{{ stat.name }}</span>
          <span class="font-mono font-medium">{{ stat.value > 0 ? '+' : '' }}{{ stat.value }}</span>
        </div>
      </div>
    </div>

    <!-- Requirements -->
    <div v-if="showCompatibility && item.requirements?.length">
      <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">Requirements</h4>
      <div class="grid grid-cols-2 gap-2">
        <div
          v-for="req in item.requirements.slice(0, 4)"
          :key="req.stat"
          class="flex justify-between text-sm p-2 rounded"
          :class="{
            'bg-green-50 dark:bg-green-900/20': canMeetRequirement(req),
            'bg-red-50 dark:bg-red-900/20': !canMeetRequirement(req)
          }"
        >
          <span class="text-surface-600 dark:text-surface-400">{{ getStatName(req.stat) }}</span>
          <span class="font-mono font-medium">{{ req.value }}</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-2 pt-4 border-t border-surface-200 dark:border-surface-700">
      <Button
        :icon="isFavorite ? 'pi pi-heart-fill' : 'pi pi-heart'"
        :label="isFavorite ? 'Favorited' : 'Favorite'"
        :severity="isFavorite ? 'danger' : 'secondary'"
        outlined
        size="small"
        @click="$emit('favorite')"
      />
      <Button
        icon="pi pi-clone"
        label="Compare"
        outlined
        size="small"
        @click="$emit('compare')"
      />
      <Button
        label="View Full Details"
        @click="$emit('view-full')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Item, TinkerProfile, ItemRequirement } from '@/types/api'
import { getItemIconUrl } from '@/services/game-utils'

const props = defineProps<{
  item: Item
  profile?: TinkerProfile | null
  showCompatibility?: boolean
  isFavorite?: boolean
}>()

defineEmits<{
  close: []
  'view-full': []
  favorite: []
  compare: []
}>()

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
    .slice(0, 6)
    .map(stat => ({
      name: getStatName(stat.stat),
      value: stat.value
    }))
})

// Methods
function canMeetRequirement(requirement: ItemRequirement): boolean {
  if (!props.profile) return false
  const characterStat = props.profile.stats?.[requirement.stat] || 0
  return characterStat >= requirement.value
}

function getStatName(statId: number): string {
  const statNames: Record<number, string> = {
    16: 'Strength', 17: 'Agility', 18: 'Stamina',
    19: 'Intelligence', 20: 'Sense', 21: 'Psychic',
    102: '1H Blunt', 103: '1H Edged', 105: '2H Edged',
    109: '2H Blunt', 133: 'Ranged Energy', 161: 'Computer Literacy'
  }
  return statNames[statId] || `Stat ${statId}`
}

function onIconError() {
  iconLoadError.value = true
}
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.font-mono {
  font-family: 'Courier New', 'Monaco', 'Lucida Console', monospace;
}
</style>
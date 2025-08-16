<!--
ItemComparison - Side-by-side item comparison component
Allows comparing up to 3 items with detailed stat differences and recommendations
-->
<template>
  <Sidebar
    v-model:visible="isVisible"
    position="right"
    class="item-comparison-sidebar"
    :style="{ width: '600px' }"
    @hide="$emit('close')"
  >
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-2">
          <i class="pi pi-clone text-lg"></i>
          <h3 class="text-lg font-semibold">Item Comparison</h3>
          <Badge :value="items.length.toString()" severity="info" />
        </div>
        
        <div class="flex items-center gap-2">
          <Button
            icon="pi pi-refresh"
            size="small"
            text
            @click="refreshComparison"
            v-tooltip.bottom="'Refresh Data'"
          />
          <Button
            icon="pi pi-trash"
            size="small"
            text
            severity="danger"
            @click="$emit('clear-all')"
            v-tooltip.bottom="'Clear All'"
          />
        </div>
      </div>
    </template>

    <div v-if="items.length === 0" class="text-center py-16">
      <i class="pi pi-clone text-4xl text-surface-400 mb-4"></i>
      <h4 class="text-lg font-medium text-surface-600 dark:text-surface-400 mb-2">
        No Items Selected
      </h4>
      <p class="text-surface-500 dark:text-surface-500 mb-4">
        Click the compare button on items to add them here
      </p>
      <div class="text-xs text-surface-400">
        You can compare up to 3 items at once
      </div>
    </div>

    <div v-else class="space-y-6">
      <!-- Comparison Controls -->
      <div class="flex items-center justify-between p-3 bg-surface-50 dark:bg-surface-900 rounded-lg">
        <div class="flex items-center gap-2">
          <label class="text-sm font-medium">Comparison Mode:</label>
          <Dropdown
            v-model="comparisonMode"
            :options="comparisonModes"
            option-label="label"
            option-value="value"
            size="small"
          />
        </div>
        
        <div class="flex items-center gap-2">
          <Button
            icon="pi pi-download"
            label="Export"
            size="small"
            outlined
            @click="exportComparison"
          />
        </div>
      </div>

      <!-- Items Header -->
      <div class="grid gap-4" :style="{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }">
        <div
          v-for="(item, index) in items"
          :key="item.id"
          class="relative p-4 border border-surface-200 dark:border-surface-700 rounded-lg bg-surface-0 dark:bg-surface-950"
        >
          <!-- Remove Button -->
          <Button
            icon="pi pi-times"
            size="small"
            rounded
            text
            severity="danger"
            class="absolute top-1 right-1"
            @click="$emit('remove-item', item.id)"
          />
          
          <!-- Item Basic Info -->
          <div class="text-center space-y-2">
            <div class="h-16 bg-surface-100 dark:bg-surface-800 rounded flex items-center justify-center mb-3">
              <i class="pi pi-box text-2xl text-surface-400"></i>
            </div>
            
            <h4 class="font-semibold text-sm line-clamp-2">{{ item.name }}</h4>
            <div class="flex justify-center gap-1">
              <Badge :value="`QL ${item.ql}`" severity="info" size="small" />
              <Badge v-if="item.is_nano" value="Nano" severity="success" size="small" />
            </div>
            
            <!-- Overall Score -->
            <div v-if="showCompatibility && comparisonScores[item.id]" class="mt-2">
              <div class="text-xs text-surface-600 dark:text-surface-400 mb-1">Compatibility Score</div>
              <ProgressBar
                :value="comparisonScores[item.id].overall * 100"
                :show-value="true"
                :class="{
                  'progress-high': comparisonScores[item.id].overall >= 0.8,
                  'progress-medium': comparisonScores[item.id].overall >= 0.5,
                  'progress-low': comparisonScores[item.id].overall < 0.5
                }"
                style="height: 8px"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Comparison Sections -->
      <div class="space-y-4">
        <!-- Basic Properties Comparison -->
        <Card>
          <template #header>
            <h4 class="text-sm font-semibold">Basic Properties</h4>
          </template>
          <template #content>
            <div class="space-y-3">
              <div class="grid gap-4" :style="{ gridTemplateColumns: `120px repeat(${items.length}, 1fr)` }">
                <!-- Row Headers -->
                <div class="text-xs font-medium text-surface-600 dark:text-surface-400">Quality Level</div>
                <div
                  v-for="item in items"
                  :key="`ql-${item.id}`"
                  class="text-sm font-mono"
                  :class="getComparisonClass('ql', item.ql)"
                >
                  {{ item.ql }}
                </div>
                
                <div class="text-xs font-medium text-surface-600 dark:text-surface-400">Item Class</div>
                <div
                  v-for="item in items"
                  :key="`class-${item.id}`"
                  class="text-sm"
                >
                  {{ getItemClassName(item.item_class) }}
                </div>
                
                <div class="text-xs font-medium text-surface-600 dark:text-surface-400">Type</div>
                <div
                  v-for="item in items"
                  :key="`type-${item.id}`"
                  class="text-sm"
                >
                  {{ item.is_nano ? 'Nano Program' : 'Regular Item' }}
                </div>
              </div>
            </div>
          </template>
        </Card>

        <!-- Stats Comparison -->
        <Card v-if="commonStats.length > 0">
          <template #header>
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-semibold">Statistics</h4>
              <Button
                :label="showAllStatsComparison ? 'Key Stats' : 'All Stats'"
                size="small"
                text
                @click="showAllStatsComparison = !showAllStatsComparison"
              />
            </div>
          </template>
          <template #content>
            <div class="space-y-2">
              <div
                v-for="statId in displayedCommonStats"
                :key="statId"
                class="grid gap-4"
                :style="{ gridTemplateColumns: `120px repeat(${items.length}, 1fr)` }"
              >
                <div class="text-xs font-medium text-surface-600 dark:text-surface-400">
                  {{ getStatName(statId) }}
                </div>
                <div
                  v-for="item in items"
                  :key="`stat-${statId}-${item.id}`"
                  class="text-sm font-mono"
                  :class="getStatComparisonClass(statId, getItemStat(item, statId))"
                >
                  {{ formatStatValue(getItemStat(item, statId)) }}
                </div>
              </div>
            </div>
          </template>
        </Card>

        <!-- Requirements Comparison -->
        <Card v-if="hasRequirementsComparison">
          <template #header>
            <h4 class="text-sm font-semibold">Requirements</h4>
          </template>
          <template #content>
            <div class="space-y-2">
              <div
                v-for="statId in commonRequirements"
                :key="statId"
                class="grid gap-4"
                :style="{ gridTemplateColumns: `120px repeat(${items.length}, 1fr)` }"
              >
                <div class="text-xs font-medium text-surface-600 dark:text-surface-400">
                  {{ getStatName(statId) }}
                </div>
                <div
                  v-for="item in items"
                  :key="`req-${statId}-${item.id}`"
                  class="text-sm font-mono flex items-center gap-1"
                  :class="getRequirementComparisonClass(statId, getItemRequirement(item, statId))"
                >
                  {{ getItemRequirement(item, statId) || '-' }}
                  <i
                    v-if="showCompatibility && profile && getItemRequirement(item, statId)"
                    :class="{
                      'pi pi-check text-green-500 text-xs': canMeetRequirement(statId, getItemRequirement(item, statId)!),
                      'pi pi-times text-red-500 text-xs': !canMeetRequirement(statId, getItemRequirement(item, statId)!)
                    }"
                  ></i>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <!-- Combat Stats (if applicable) -->
        <Card v-if="hasCombatStats">
          <template #header>
            <h4 class="text-sm font-semibold">Combat Statistics</h4>
          </template>
          <template #content>
            <div class="space-y-3">
              <!-- Attack Data -->
              <div v-if="hasAttackData">
                <h5 class="text-xs font-medium text-surface-600 dark:text-surface-400 mb-2">Attack</h5>
                <div class="space-y-2">
                  <div
                    v-for="statId in commonAttackStats"
                    :key="statId"
                    class="grid gap-4"
                    :style="{ gridTemplateColumns: `120px repeat(${items.length}, 1fr)` }"
                  >
                    <div class="text-xs text-surface-600 dark:text-surface-400">
                      {{ getStatName(statId) }}
                    </div>
                    <div
                      v-for="item in items"
                      :key="`attack-${statId}-${item.id}`"
                      class="text-sm font-mono"
                      :class="getStatComparisonClass(statId, getItemAttackStat(item, statId))"
                    >
                      {{ getItemAttackStat(item, statId) || '-' }}
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Defense Data -->
              <div v-if="hasDefenseData">
                <h5 class="text-xs font-medium text-surface-600 dark:text-surface-400 mb-2">Defense</h5>
                <div class="space-y-2">
                  <div
                    v-for="statId in commonDefenseStats"
                    :key="statId"
                    class="grid gap-4"
                    :style="{ gridTemplateColumns: `120px repeat(${items.length}, 1fr)` }"
                  >
                    <div class="text-xs text-surface-600 dark:text-surface-400">
                      {{ getStatName(statId) }}
                    </div>
                    <div
                      v-for="item in items"
                      :key="`defense-${statId}-${item.id}`"
                      class="text-sm font-mono"
                      :class="getStatComparisonClass(statId, getItemDefenseStat(item, statId))"
                    >
                      {{ getItemDefenseStat(item, statId) || '-' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <!-- Recommendations -->
        <Card v-if="recommendations.length > 0">
          <template #header>
            <h4 class="text-sm font-semibold">Recommendations</h4>
          </template>
          <template #content>
            <div class="space-y-3">
              <div
                v-for="rec in recommendations"
                :key="rec.category"
                class="p-3 bg-surface-50 dark:bg-surface-900 rounded-lg"
              >
                <div class="flex items-start gap-3">
                  <i :class="rec.icon" class="text-lg mt-0.5" :style="{ color: rec.color }"></i>
                  <div class="flex-1">
                    <h5 class="text-sm font-medium mb-1">{{ rec.title }}</h5>
                    <p class="text-xs text-surface-600 dark:text-surface-400 mb-2">{{ rec.description }}</p>
                    <div v-if="rec.winner" class="flex items-center gap-2">
                      <span class="text-xs font-medium">Best Choice:</span>
                      <Badge :value="getItemName(rec.winner)" severity="primary" size="small" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Item, TinkerProfile } from '@/types/api'

interface ComparisonScore {
  overall: number
  stats: number
  requirements: number
  compatibility: number
}

interface Recommendation {
  category: string
  title: string
  description: string
  winner?: number
  icon: string
  color: string
}

const props = defineProps<{
  items: Item[]
  profile?: TinkerProfile | null
  showCompatibility?: boolean
}>()

const emit = defineEmits<{
  'remove-item': [itemId: number]
  'clear-all': []
  'close': []
}>()

// State
const isVisible = ref(true)
const comparisonMode = ref('detailed')
const showAllStatsComparison = ref(false)
const comparisonScores = ref<Record<number, ComparisonScore>>({})

// Options
const comparisonModes = [
  { label: 'Detailed', value: 'detailed' },
  { label: 'Stats Only', value: 'stats' },
  { label: 'Requirements Only', value: 'requirements' },
  { label: 'Combat Only', value: 'combat' }
]

// Computed
const commonStats = computed(() => {
  if (props.items.length === 0) return []
  
  const allStatIds = new Set<number>()
  props.items.forEach(item => {
    item.stats?.forEach(stat => allStatIds.add(stat.stat))
  })
  
  return Array.from(allStatIds).filter(statId =>
    props.items.every(item => item.stats?.some(stat => stat.stat === statId))
  )
})

const displayedCommonStats = computed(() => {
  if (showAllStatsComparison.value) {
    return commonStats.value
  }
  return commonStats.value.filter(statId => {
    const values = props.items.map(item => Math.abs(getItemStat(item, statId)))
    return Math.max(...values) > 10 // Only show significant stats
  }).slice(0, 8)
})

const commonRequirements = computed(() => {
  if (props.items.length === 0) return []
  
  const allReqStats = new Set<number>()
  props.items.forEach(item => {
    item.requirements?.forEach(req => allReqStats.add(req.stat))
  })
  
  return Array.from(allReqStats)
})

const hasRequirementsComparison = computed(() => 
  commonRequirements.value.length > 0
)

const hasCombatStats = computed(() => 
  props.items.some(item => item.attack_stats || item.defense_stats)
)

const hasAttackData = computed(() => 
  props.items.some(item => item.attack_stats)
)

const hasDefenseData = computed(() => 
  props.items.some(item => item.defense_stats)
)

const commonAttackStats = computed(() => {
  if (!hasAttackData.value) return []
  
  const allAttackStats = new Set<number>()
  props.items.forEach(item => {
    item.attack_stats?.forEach(attack => allAttackStats.add(attack.stat))
  })
  
  return Array.from(allAttackStats)
})

const commonDefenseStats = computed(() => {
  if (!hasDefenseData.value) return []
  
  const allDefenseStats = new Set<number>()
  props.items.forEach(item => {
    item.defense_stats?.forEach(defense => allDefenseStats.add(defense.stat))
  })
  
  return Array.from(allDefenseStats)
})

const recommendations = computed((): Recommendation[] => {
  if (props.items.length < 2) return []
  
  const recs: Recommendation[] = []
  
  // Quality Level recommendation
  const qlWinner = props.items.reduce((best, current) => 
    current.ql > best.ql ? current : best
  )
  recs.push({
    category: 'quality',
    title: 'Highest Quality',
    description: 'Higher quality items typically have better stats and effects.',
    winner: qlWinner.id,
    icon: 'pi pi-star',
    color: '#fbbf24'
  })
  
  // Stats recommendation
  if (commonStats.value.length > 0) {
    const statTotals = props.items.map(item => ({
      id: item.id,
      total: commonStats.value.reduce((sum, statId) => 
        sum + Math.abs(getItemStat(item, statId)), 0
      )
    }))
    
    const statWinner = statTotals.reduce((best, current) => 
      current.total > best.total ? current : best
    )
    
    recs.push({
      category: 'stats',
      title: 'Best Overall Stats',
      description: 'Item with the highest combined stat bonuses.',
      winner: statWinner.id,
      icon: 'pi pi-chart-bar',
      color: '#10b981'
    })
  }
  
  // Compatibility recommendation
  if (props.showCompatibility && props.profile) {
    const compatibilityScores = props.items.map(item => ({
      id: item.id,
      compatible: !item.requirements || item.requirements.every(req => 
        canMeetRequirement(req.stat, req.value)
      )
    }))
    
    const compatibleItems = compatibilityScores.filter(score => score.compatible)
    if (compatibleItems.length > 0 && compatibleItems.length < props.items.length) {
      recs.push({
        category: 'compatibility',
        title: 'Character Compatibility',
        description: 'Items you can currently use with your character.',
        icon: 'pi pi-user',
        color: '#3b82f6'
      })
    }
  }
  
  return recs
})

// Methods
function getItemStat(item: Item, statId: number): number {
  const stat = item.stats?.find(s => s.stat === statId)
  return stat?.value || 0
}

function getItemRequirement(item: Item, statId: number): number | null {
  const req = item.requirements?.find(r => r.stat === statId)
  return req?.value || null
}

function getItemAttackStat(item: Item, statId: number): number | null {
  const attack = item.attack_stats?.find(a => a.stat === statId)
  return attack?.value || null
}

function getItemDefenseStat(item: Item, statId: number): number | null {
  const defense = item.defense_stats?.find(d => d.stat === statId)
  return defense?.value || null
}

function getComparisonClass(field: string, value: number): string {
  const values = props.items.map(item => {
    switch (field) {
      case 'ql': return item.ql
      default: return value
    }
  })
  
  const max = Math.max(...values)
  const min = Math.min(...values)
  
  if (values.length === 1) return ''
  if (value === max) return 'text-green-600 dark:text-green-400 font-semibold'
  if (value === min) return 'text-red-600 dark:text-red-400'
  return ''
}

function getStatComparisonClass(statId: number, value: number): string {
  const values = props.items.map(item => getItemStat(item, statId)).filter(v => v !== 0)
  
  if (values.length <= 1) return 'text-surface-500'
  
  const max = Math.max(...values)
  const min = Math.min(...values)
  
  if (value === max && value > 0) return 'text-green-600 dark:text-green-400 font-semibold'
  if (value === min && min < 0) return 'text-red-600 dark:text-red-400 font-semibold'
  if (value === 0) return 'text-surface-400'
  return ''
}

function getRequirementComparisonClass(statId: number, value: number | null): string {
  if (value === null) return 'text-surface-400'
  
  const values = props.items
    .map(item => getItemRequirement(item, statId))
    .filter(v => v !== null) as number[]
  
  if (values.length <= 1) return ''
  
  const max = Math.max(...values)
  const min = Math.min(...values)
  
  if (value === min) return 'text-green-600 dark:text-green-400 font-semibold'
  if (value === max) return 'text-red-600 dark:text-red-400 font-semibold'
  return ''
}

function canMeetRequirement(statId: number, value: number): boolean {
  if (!props.profile) return false
  const characterStat = props.profile.stats?.[statId] || 0
  return characterStat >= value
}

function formatStatValue(value: number): string {
  if (value === 0) return '-'
  return value > 0 ? `+${value}` : value.toString()
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

function getItemClassName(classId: number): string {
  const classNames: Record<number, string> = {
    1: '1H Blunt', 2: '1H Edged', 3: '2H Blunt', 4: '2H Edged', 5: 'Ranged',
    6: 'Body', 7: 'Head', 8: 'Arms', 9: 'Legs', 10: 'Feet',
    15: 'Implant', 20: 'Utility'
  }
  return classNames[classId] || `Class ${classId}`
}

function getItemName(itemId: number): string {
  const item = props.items.find(i => i.id === itemId)
  return item?.name || 'Unknown'
}

function refreshComparison() {
  // Recalculate comparison scores
  calculateComparisonScores()
}

function calculateComparisonScores() {
  props.items.forEach(item => {
    comparisonScores.value[item.id] = {
      overall: 0.8, // Mock score
      stats: 0.7,
      requirements: 0.9,
      compatibility: props.showCompatibility ? 0.6 : 1.0
    }
  })
}

function exportComparison() {
  // Export comparison data as CSV or JSON
  const data = {
    items: props.items.map(item => ({
      id: item.id,
      name: item.name,
      ql: item.ql,
      stats: item.stats,
      requirements: item.requirements
    })),
    timestamp: new Date().toISOString(),
    profile: props.profile?.name || null
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'item-comparison.json'
  a.click()
  URL.revokeObjectURL(url)
}

// Watch for items changes
watch(() => props.items, () => {
  calculateComparisonScores()
}, { immediate: true, deep: true })
</script>

<style scoped>
.item-comparison-sidebar {
  z-index: 1050;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.progress-high :deep(.p-progressbar-value) {
  background: linear-gradient(to right, #10b981, #34d399);
}

.progress-medium :deep(.p-progressbar-value) {
  background: linear-gradient(to right, #f59e0b, #fbbf24);
}

.progress-low :deep(.p-progressbar-value) {
  background: linear-gradient(to right, #ef4444, #f87171);
}

/* Grid layout utilities */
.grid {
  display: grid;
  gap: 1rem;
  align-items: center;
}

/* Font variants */
.font-mono {
  font-family: 'Courier New', 'Monaco', 'Lucida Console', monospace;
  font-size: 0.875rem;
}
</style>
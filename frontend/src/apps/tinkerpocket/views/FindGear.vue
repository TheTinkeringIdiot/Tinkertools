<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles'
import { useSymbiantsStore } from '@/stores/symbiants'
import { usePocketBossStore } from '@/stores/pocketBossStore'
import { mapProfileToStats } from '@/utils/profile-stats-mapper'
import { parseAction, checkActionRequirements } from '@/services/action-criteria'
import { IMPLANT_SLOT } from '@/services/game-data'
import { getImplantSlotNameFromBitflag, getMinimumLevel } from '@/services/game-utils'
import type { SymbiantItem, Mob } from '@/types/api'

// Props
const props = defineProps<{
  view: 'symbiants' | 'bosses'
}>()

// PrimeVue Components
import Button from 'primevue/button'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import Slider from 'primevue/slider'
import InputSwitch from 'primevue/inputswitch'
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import DataView from 'primevue/dataview'
import Badge from 'primevue/badge'
import { useToast } from 'primevue/usetoast'

// Router
const router = useRouter()
const route = useRoute()

// Stores
const profileStore = useTinkerProfilesStore()
const symbiantsStore = useSymbiantsStore()
const pocketBossStore = usePocketBossStore()

// Toast
const toast = useToast()

// Filter State (Symbiants)
const familyFilter = ref<string | null>(null)
const slotFilter = ref<number | null>(null)
const minQL = ref<number>(1)
const maxQL = ref<number>(300)
const qlRange = ref<[number, number]>([1, 300]) // Local state for slider
const symbiantMinLevel = ref<number>(1)
const symbiantMaxLevel = ref<number>(220)
const symbiantLevelRange = ref<[number, number]>([1, 220]) // Local state for slider
const searchText = ref<string>('')
const profileToggle = ref<boolean>(false)

// Filter State (Bosses)
const bossSearchText = ref<string>('')
const playfieldFilter = ref<string | null>(null)
const minLevel = ref<number>(1)
const maxLevel = ref<number>(220)
const bossViewMode = ref<'grid' | 'list'>('list')

// Loading State
const loading = ref<boolean>(false)

// Debounce timer for search
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Slot mapping constant (slot_id -> name)
// Uses equipment slot bitflags from stat 298
const SLOT_OPTIONS = [
  { label: 'Eyes', value: IMPLANT_SLOT.Eyes },
  { label: 'Head', value: IMPLANT_SLOT.Head },
  { label: 'Ears', value: IMPLANT_SLOT.Ears },
  { label: 'Right Arm', value: IMPLANT_SLOT.RightArm },
  { label: 'Chest', value: IMPLANT_SLOT.Chest },
  { label: 'Left Arm', value: IMPLANT_SLOT.LeftArm },
  { label: 'Right Wrist', value: IMPLANT_SLOT.RightWrist },
  { label: 'Waist', value: IMPLANT_SLOT.Waist },
  { label: 'Left Wrist', value: IMPLANT_SLOT.LeftWrist },
  { label: 'Right Hand', value: IMPLANT_SLOT.RightHand },
  { label: 'Legs', value: IMPLANT_SLOT.Legs },
  { label: 'Left Hand', value: IMPLANT_SLOT.LeftHand },
  { label: 'Feet', value: IMPLANT_SLOT.Feet }
]

// Family options
const FAMILY_OPTIONS = [
  { label: 'Artillery', value: 'Artillery' },
  { label: 'Control', value: 'Control' },
  { label: 'Extermination', value: 'Extermination' },
  { label: 'Infantry', value: 'Infantry' },
  { label: 'Support', value: 'Support' }
]

// Computed Properties
const activeProfile = computed(() => profileStore.activeProfile)

const characterStats = computed(() => {
  if (!activeProfile.value) return null
  // Convert to plain object to satisfy type requirements
  return mapProfileToStats(activeProfile.value as any)
})

const filteredSymbiants = computed(() => {
  let result = symbiantsStore.allSymbiants

  // 1. Family filter (most selective - apply first)
  if (familyFilter.value) {
    result = result.filter(s => s.family === familyFilter.value)
  }

  // 2. Slot filter (very selective)
  if (slotFilter.value) {
    result = result.filter(s => s.slot_id === slotFilter.value)
  }

  // 3. QL range filter
  if (minQL.value > 1 || maxQL.value < 300) {
    result = result.filter(s => s.ql >= minQL.value && s.ql <= maxQL.value)
  }

  // 4. Level range filter
  if (symbiantMinLevel.value > 1 || symbiantMaxLevel.value < 220) {
    result = result.filter(s => {
      try {
        const minLevel = getMinimumLevel(s)
        return minLevel >= symbiantMinLevel.value && minLevel <= symbiantMaxLevel.value
      } catch {
        return true // Include if level extraction fails
      }
    })
  }

  // 5. Text search (debounced)
  if (searchText.value.trim()) {
    const searchLower = searchText.value.toLowerCase()
    result = result.filter(s => s.name.toLowerCase().includes(searchLower))
  }

  // 6. Profile filter (most expensive - apply last)
  if (profileToggle.value && characterStats.value) {
    result = result.filter(s => {
      try {
        const wearAction = s.actions?.find(a => a.action === 6)
        if (!wearAction) return false
        return checkActionRequirements(parseAction(wearAction), characterStats.value!).canPerform
      } catch {
        return false
      }
    })
  }

  return result
})

const displayedSymbiantCount = computed(() => {
  return filteredSymbiants.value.length
})

const filteredBosses = computed(() => pocketBossStore.filteredPocketBosses)
const playfields = computed(() => pocketBossStore.playfields)
const levelRange = computed(() => pocketBossStore.levelRange)

// Comparison state
const comparisonCount = computed(() => symbiantsStore.getComparisonCount())
const hasComparisons = computed(() => comparisonCount.value > 0)

// Methods
let debugCount = 0
function checkSymbiantRequirements(symbiant: SymbiantItem): boolean {
  const shouldLog = debugCount === 0

  if (shouldLog) {
    console.log('🔍 Checking symbiant:', symbiant.name, 'ID:', symbiant.id)
  }

  if (!characterStats.value) {
    if (shouldLog) console.log('❌ No character stats')
    return true
  }

  if (shouldLog) {
    console.log('📊 Character stats:', characterStats.value)
    console.log('📊 Profession stat (60):', characterStats.value[60])
  }

  if (!symbiant.actions || symbiant.actions.length === 0) {
    if (shouldLog) console.log('✅ No actions, returning true')
    return true
  }

  const action = symbiant.actions[0]
  if (shouldLog) {
    console.log('📋 Action criteria count:', action.criteria?.length)
  }

  const parsedAction = parseAction(action)
  if (shouldLog) {
    console.log('🔨 Parsed action:', parsedAction)
  }

  const result = checkActionRequirements(parsedAction, characterStats.value)
  if (shouldLog) {
    console.log('✅ Can perform?', result.canPerform, 'Unmet:', result.unmetRequirements.length)

    if (!result.canPerform && result.unmetRequirements.length > 0) {
      console.log('❌ Unmet requirements:')
      result.unmetRequirements.forEach(req => {
        console.log(`  - Stat ${req.stat}: need ${req.required}, have ${req.current}`)
      })
    }
  }

  debugCount++
  return result.canPerform
}

async function fetchSymbiants() {
  await symbiantsStore.loadAllSymbiants()
  // Computed property (filteredSymbiants) handles filtering
}

function updateFilters() {
  // No page reset needed
  updateURL()
}

function onSearchInput() {
  if (searchDebounceTimer) {
    clearTimeout(searchDebounceTimer)
  }

  searchDebounceTimer = setTimeout(() => {
    updateFilters()
  }, 300)
}


function clearFilters() {
  familyFilter.value = null
  slotFilter.value = null
  minQL.value = 1
  maxQL.value = 300
  qlRange.value = [1, 300]
  symbiantMinLevel.value = 1
  symbiantMaxLevel.value = 220
  symbiantLevelRange.value = [1, 220]
  searchText.value = ''
  profileToggle.value = false
  updateFilters()
}

function applyQlFilter() {
  minQL.value = qlRange.value[0]
  maxQL.value = qlRange.value[1]
  updateFilters()
}

function applyLevelFilter() {
  symbiantMinLevel.value = symbiantLevelRange.value[0]
  symbiantMaxLevel.value = symbiantLevelRange.value[1]
  updateFilters()
}

function updateURL() {
  const query: any = {}

  if (familyFilter.value) query.family = familyFilter.value
  if (slotFilter.value) query.slot = slotFilter.value.toString()
  if (minQL.value > 1) query.minql = minQL.value.toString()
  if (maxQL.value < 300) query.maxql = maxQL.value.toString()
  if (symbiantMinLevel.value > 1) query.minlvl = symbiantMinLevel.value.toString()
  if (symbiantMaxLevel.value < 220) query.maxlvl = symbiantMaxLevel.value.toString()
  if (searchText.value.trim()) query.search = searchText.value.trim()
  if (profileToggle.value) query.profile = 'true'

  router.push({ path: '/pocket', query })
}

function readURLParams() {
  const query = route.query

  if (query.family && typeof query.family === 'string') {
    familyFilter.value = query.family
  }

  if (query.slot && typeof query.slot === 'string') {
    const slotId = parseInt(query.slot)
    if (!isNaN(slotId)) {
      slotFilter.value = slotId
    }
  }

  if (query.minql && typeof query.minql === 'string') {
    const min = parseInt(query.minql)
    if (!isNaN(min)) {
      minQL.value = min
      qlRange.value[0] = min
    }
  }

  if (query.maxql && typeof query.maxql === 'string') {
    const max = parseInt(query.maxql)
    if (!isNaN(max)) {
      maxQL.value = max
      qlRange.value[1] = max
    }
  }

  if (query.search && typeof query.search === 'string') {
    searchText.value = query.search
  }

  if (query.minlvl && typeof query.minlvl === 'string') {
    const minLvl = parseInt(query.minlvl)
    if (!isNaN(minLvl)) {
      symbiantMinLevel.value = minLvl
      symbiantLevelRange.value[0] = minLvl
    }
  }

  if (query.maxlvl && typeof query.maxlvl === 'string') {
    const maxLvl = parseInt(query.maxlvl)
    if (!isNaN(maxLvl)) {
      symbiantMaxLevel.value = maxLvl
      symbiantLevelRange.value[1] = maxLvl
    }
  }

  if (query.profile === 'true') {
    profileToggle.value = true
  }
}

function navigateToItem(aoid: number) {
  router.push(`/items/${aoid}`)
}

function handleAddToComparison(symbiant: SymbiantItem) {
  const added = symbiantsStore.addToComparison(symbiant)
  if (!added) {
    toast.add({
      severity: 'warn',
      summary: 'Comparison Full',
      detail: 'Comparison full (maximum 3 symbiants)',
      life: 3000
    })
  }
}

function handleClearComparison() {
  symbiantsStore.clearComparison()
}

function isSymbiantInComparison(symbiantId: number): boolean {
  return symbiantsStore.isInComparison(symbiantId) !== null
}

// Boss Methods
function updateBossFilters() {
  pocketBossStore.updateFilters({
    search: bossSearchText.value || undefined,
    playfield: playfieldFilter.value || undefined,
    minLevel: minLevel.value,
    maxLevel: maxLevel.value
  })
}

function clearBossFilters() {
  bossSearchText.value = ''
  playfieldFilter.value = null
  minLevel.value = levelRange.value.min
  maxLevel.value = levelRange.value.max
  pocketBossStore.clearFilters()
}

function navigateToBoss(bossId: number) {
  router.push(`/pocket/bosses/${bossId}`)
}

function formatLocation(boss: Mob): string {
  const parts = []
  if (boss.playfield) parts.push(boss.playfield)
  if (boss.location) parts.push(boss.location)
  return parts.join(' - ') || 'Unknown Location'
}

function getSeverity(level: number): 'success' | 'info' | 'warning' | 'danger' {
  if (level < 50) return 'success'
  if (level < 100) return 'info'
  if (level < 150) return 'warning'
  return 'danger'
}

function formatMinimumLevel(symbiant: SymbiantItem): string {
  try {
    const level = getMinimumLevel(symbiant)
    return `Lvl ${level}+`
  } catch (error) {
    console.error('Failed to extract level from symbiant:', symbiant.name, error)
    return 'Lvl ?'
  }
}

async function loadBosses() {
  await pocketBossStore.fetchPocketBosses()
  // Set initial level range from store
  minLevel.value = levelRange.value.min
  maxLevel.value = levelRange.value.max
}

// Lifecycle
onMounted(async () => {
  readURLParams()

  if (props.view === 'symbiants') {
    if (symbiantsStore.isDataStale || symbiantsStore.symbiantsCount === 0) {
      await symbiantsStore.loadAllSymbiants()
    }
  } else if (props.view === 'bosses') {
    await loadBosses()
  }
})

// Watch for route changes
watch(() => route.query, () => {
  if (route.path === '/pocket') {
    readURLParams()
  }
})

// Watch for profile changes to auto-set max level
watch(() => activeProfile.value, (newProfile, oldProfile) => {
  if (props.view !== 'symbiants') return

  // Only update if profile actually changed (not just a reference change)
  const oldLevel = oldProfile?.Character.Level
  const newLevel = newProfile?.Character.Level

  if (newProfile && newLevel && oldLevel !== newLevel) {
    // Auto-set max level to profile level
    symbiantMaxLevel.value = newLevel
    symbiantLevelRange.value[1] = newLevel
    // Trigger update
    applyLevelFilter()
  } else if (!newProfile && oldProfile) {
    // Profile was cleared, reset to max
    symbiantMaxLevel.value = 220
    symbiantLevelRange.value[1] = 220
    applyLevelFilter()
  }
}, { immediate: false })
</script>

<template>
  <div class="find-gear p-4">
    <!-- Symbiants View -->
    <div v-if="props.view === 'symbiants'">
      <!-- Filters Card -->
      <Card class="mb-6">
        <template #content>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Family Dropdown -->
            <div class="flex flex-col gap-2">
              <label class="font-medium text-sm">Family</label>
              <Dropdown
                v-model="familyFilter"
                :options="FAMILY_OPTIONS"
                optionLabel="label"
                optionValue="value"
                placeholder="All Families"
                showClear
                class="w-full border border-surface-300 dark:border-surface-600"
                @change="updateFilters"
              />
            </div>

            <!-- Slot Dropdown -->
            <div class="flex flex-col gap-2">
              <label class="font-medium text-sm">Slot</label>
              <Dropdown
                v-model="slotFilter"
                :options="SLOT_OPTIONS"
                optionLabel="label"
                optionValue="value"
                placeholder="All Slots"
                showClear
                class="w-full border border-surface-300 dark:border-surface-600"
                @change="updateFilters"
              />
            </div>

            <!-- Text Search -->
            <div class="flex flex-col gap-2">
              <label class="font-medium text-sm">Search</label>
              <div class="relative w-full">
                <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500 pointer-events-none"></i>
                <InputText
                  v-model="searchText"
                  placeholder="Search by name..."
                  class="w-full pl-10 border border-surface-300 dark:border-surface-600"
                  @input="onSearchInput"
                />
              </div>
            </div>

            <!-- Active Profile Toggle -->
            <div class="flex flex-col gap-2">
              <label class="font-medium text-sm">Filter by Active Profile</label>
              <div class="flex items-center gap-2">
                <InputSwitch
                  v-model="profileToggle"
                  :disabled="!activeProfile"
                  @change="updateFilters"
                />
                <span class="text-sm text-surface-600 dark:text-surface-400">
                  {{ profileToggle ? 'On' : 'Off' }}
                </span>
              </div>
            </div>
          </div>

          <!-- QL Range Slider -->
          <div class="mt-4">
            <div class="flex items-center gap-3">
              <label class="text-sm font-medium whitespace-nowrap">QL Range:</label>
              <span class="text-sm text-surface-600 dark:text-surface-400 min-w-[2rem] text-center">{{ qlRange[0] }}</span>
              <Slider
                v-model="qlRange"
                :range="true"
                :min="1"
                :max="300"
                @slideend="applyQlFilter"
                class="flex-1"
              />
              <span class="text-sm text-surface-600 dark:text-surface-400 min-w-[2rem] text-center">{{ qlRange[1] }}</span>
            </div>
          </div>

          <!-- Level Range Slider -->
          <div class="mt-4">
            <div class="flex items-center gap-3">
              <label class="text-sm font-medium whitespace-nowrap">Level Range:</label>
              <span class="text-sm text-surface-600 dark:text-surface-400 min-w-[2rem] text-center">{{ symbiantLevelRange[0] }}</span>
              <Slider
                v-model="symbiantLevelRange"
                :range="true"
                :min="1"
                :max="220"
                @slideend="applyLevelFilter"
                class="flex-1"
              />
              <span class="text-sm text-surface-600 dark:text-surface-400 min-w-[2rem] text-center">{{ symbiantLevelRange[1] }}</span>
              <i
                v-if="activeProfile && symbiantMaxLevel === activeProfile.Character.Level"
                class="pi pi-user text-primary-500"
                v-tooltip="'Max level set from active profile'"
              ></i>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700 flex justify-between items-center">
            <div class="flex items-center gap-2">
              <Button
                label="Clear Filters"
                icon="pi pi-filter-slash"
                outlined
                size="small"
                @click="clearFilters"
              />
              <div v-if="hasComparisons" class="flex items-center gap-2">
                <Badge :value="`${comparisonCount}/3 selected`" severity="info" />
                <Button
                  label="Clear Selection"
                  icon="pi pi-times"
                  outlined
                  size="small"
                  severity="secondary"
                  @click="handleClearComparison"
                />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Loading State -->
      <div v-if="symbiantsStore.loading" class="flex flex-col justify-center items-center py-12">
        <i class="pi pi-spin pi-spinner text-4xl text-primary-500 mb-3"></i>
        <p class="text-lg text-surface-600 dark:text-surface-400">
          Loading symbiants...
        </p>
      </div>

      <!-- Error State -->
      <div v-else-if="symbiantsStore.error" class="flex flex-col justify-center items-center py-12">
        <i class="pi pi-exclamation-circle text-4xl text-red-500 mb-3"></i>
        <p class="text-lg text-red-600 dark:text-red-400 mb-4">
          {{ symbiantsStore.error }}
        </p>
        <Button
          label="Retry"
          icon="pi pi-refresh"
          @click="symbiantsStore.loadAllSymbiants(true)"
        />
      </div>

      <!-- Results -->
      <div v-else>
        <!-- Result Count -->
        <div class="mb-4 text-sm text-surface-600 dark:text-surface-400">
          Showing {{ filteredSymbiants.length }} symbiant{{ filteredSymbiants.length !== 1 ? 's' : '' }}
          <span v-if="symbiantsStore.symbiantsCount !== filteredSymbiants.length">
            (filtered from {{ symbiantsStore.symbiantsCount }} total)
          </span>
        </div>

        <!-- Results List -->
        <div v-if="filteredSymbiants.length > 0" class="space-y-2">
          <div
            v-for="symbiant in filteredSymbiants"
            :key="symbiant.id"
            @click="navigateToItem(symbiant.aoid)"
            class="symbiant-card flex items-center gap-4 p-4 bg-surface-0 dark:bg-surface-800
                   border border-surface-200 dark:border-surface-700 rounded-lg
                   cursor-pointer transition-all duration-200"
          >
            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="font-semibold text-surface-900 dark:text-surface-50">
                {{ symbiant.name }}
              </div>
              <div class="text-sm text-surface-600 dark:text-surface-400 flex items-center gap-2 flex-wrap">
                <span>{{ symbiant.family }}</span>
                <span>•</span>
                <span>{{ getImplantSlotNameFromBitflag(symbiant.slot_id) }}</span>
                <span>•</span>
                <span>QL {{ symbiant.ql }}</span>
                <span>•</span>
                <span>{{ formatMinimumLevel(symbiant) }}</span>
              </div>
            </div>

            <!-- Compare Button -->
            <Button
              @click.stop="handleAddToComparison(symbiant)"
              :icon="isSymbiantInComparison(symbiant.id) ? 'pi pi-check' : 'pi pi-clone'"
              :severity="isSymbiantInComparison(symbiant.id) ? 'success' : 'secondary'"
              size="small"
              outlined
              v-tooltip="isSymbiantInComparison(symbiant.id) ? 'In comparison' : 'Add to compare'"
            />
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-12">
          <i class="pi pi-search text-4xl text-surface-400 mb-4"></i>
          <p class="text-lg text-surface-600 dark:text-surface-400">No symbiants found</p>
          <p class="text-sm text-surface-500 dark:text-surface-500">
            Try adjusting your filters
          </p>
        </div>
      </div>
    </div>

    <!-- Bosses View -->
    <div v-else>
      <!-- Filters Card -->
      <Card class="mb-6">
        <template #content>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <!-- Search Input -->
            <div class="flex flex-col gap-2">
              <label class="font-medium text-sm">Search Bosses</label>
              <div class="relative w-full">
                <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500 pointer-events-none"></i>
                <InputText
                  v-model="bossSearchText"
                  placeholder="Search by name or location..."
                  class="w-full pl-10 border border-surface-300 dark:border-surface-600"
                  @input="updateBossFilters"
                />
              </div>
            </div>

            <!-- Playfield Filter -->
            <div class="flex flex-col gap-2">
              <label class="font-medium text-sm">Playfield</label>
              <Dropdown
                v-model="playfieldFilter"
                :options="playfields"
                placeholder="All Playfields"
                showClear
                class="w-full border border-surface-300 dark:border-surface-600"
                @change="updateBossFilters"
              />
            </div>

            <!-- Level Range Slider -->
            <div class="flex flex-col gap-2">
              <label class="font-medium text-sm">Level Range: {{ minLevel }} - {{ maxLevel }}</label>
              <Slider
                v-model="minLevel"
                :min="levelRange.min"
                :max="maxLevel"
                @change="updateBossFilters"
              />
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center justify-between mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
            <div class="flex items-center gap-2">
              <Button
                label="Clear Filters"
                icon="pi pi-filter-slash"
                outlined
                size="small"
                @click="clearBossFilters"
              />
              <span class="text-sm text-surface-600 dark:text-surface-400">
                {{ filteredBosses.length }} boss{{ filteredBosses.length !== 1 ? 'es' : '' }} found
              </span>
            </div>

            <div class="flex items-center gap-2">
              <Button
                @click="bossViewMode = 'grid'"
                :outlined="bossViewMode !== 'grid'"
                icon="pi pi-th-large"
                size="small"
              />
              <Button
                @click="bossViewMode = 'list'"
                :outlined="bossViewMode !== 'list'"
                icon="pi pi-list"
                size="small"
              />
            </div>
          </div>
        </template>
      </Card>

      <!-- Boss List/Grid -->
      <DataView
        :value="(filteredBosses as any)"
        :layout="(bossViewMode as any)"
        :paginator="true"
        :rows="20"
        :rowsPerPageOptions="[10, 20, 50]"
      >
        <template #empty>
          <div class="text-center py-12">
            <i class="pi pi-search text-4xl text-surface-400 mb-4"></i>
            <p class="text-lg text-surface-600 dark:text-surface-400">No pocket bosses found</p>
            <p class="text-sm text-surface-500 dark:text-surface-500">
              Try adjusting your filters
            </p>
          </div>
        </template>

        <template #grid="slotProps">
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <Card
              v-for="boss in slotProps.items"
              :key="boss.id"
              class="boss-card cursor-pointer hover:shadow-lg transition-all duration-200"
              @click="navigateToBoss(boss.id)"
            >
              <template #content>
                <div class="space-y-3">
                  <!-- Header -->
                  <div class="flex items-start justify-between">
                    <div>
                      <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50">
                        {{ boss.name }}
                      </h3>
                      <p class="text-sm text-surface-600 dark:text-surface-400">
                        {{ formatLocation(boss) }}
                      </p>
                    </div>
                    <Tag
                      :value="`Level ${boss.level}`"
                      :severity="getSeverity(boss.level)"
                    />
                  </div>

                  <!-- Symbiant Count -->
                  <div class="text-sm text-surface-600 dark:text-surface-400">
                    <i class="pi pi-box mr-1"></i>
                    {{ boss.symbiant_count || 0 }} symbiant{{ (boss.symbiant_count || 0) !== 1 ? 's' : '' }}
                  </div>

                  <!-- Navigation Arrow -->
                  <div class="flex items-center justify-end text-sm">
                    <i class="pi pi-arrow-right text-primary-500"></i>
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </template>

        <template #list="slotProps">
          <div class="space-y-2">
            <Card
              v-for="boss in slotProps.items"
              :key="boss.id"
              class="boss-list-item cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
              @click="navigateToBoss(boss.id)"
            >
              <template #content>
                <div class="flex items-center justify-between py-2">
                  <div class="flex items-center gap-4 flex-1">
                    <div class="min-w-0 flex-1">
                      <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 truncate">
                        {{ boss.name }}
                      </h3>
                      <p class="text-sm text-surface-600 dark:text-surface-400 truncate">
                        {{ formatLocation(boss) }}
                      </p>
                    </div>

                    <div class="flex items-center gap-4">
                      <div class="text-sm text-surface-600 dark:text-surface-400">
                        <i class="pi pi-box mr-1"></i>
                        {{ boss.symbiant_count || 0 }} symbiant{{ (boss.symbiant_count || 0) !== 1 ? 's' : '' }}
                      </div>
                      <Tag
                        :value="`Level ${boss.level}`"
                        :severity="getSeverity(boss.level)"
                      />
                      <i class="pi pi-arrow-right text-primary-500"></i>
                    </div>
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </template>
      </DataView>
    </div>
  </div>
</template>

<style scoped>
.find-gear {
  background: var(--surface-ground);
}

/* Symbiant card hover effect - matches TinkerNukes pattern */
.symbiant-card:hover {
  background-color: #dbeafe !important; /* blue-100 for light mode */
  border-color: #3b82f6 !important; /* blue-500 */
}

/* Dark mode hover for symbiant cards */
@media (prefers-color-scheme: dark) {
  .symbiant-card:hover {
    background-color: #1e3a8a !important; /* blue-900 for dark mode */
    border-color: #3b82f6 !important; /* blue-500 */
  }
}

.boss-card:hover {
  transform: translateY(-2px);
}

.boss-list-item :deep(.p-card-body) {
  padding: 0.75rem;
}

.boss-card :deep(.p-card-body) {
  padding: 1rem;
}
</style>

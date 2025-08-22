<!--
ProfessionNanoDisplay - Displays nanos for a selected profession
Shows nanos organized by strain in decreasing QL order
-->
<template>
  <div class="profession-nano-display h-full flex flex-col">
    <!-- Header -->
    <div class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 v-if="selectedProfessionName" class="text-xl font-bold text-surface-900 dark:text-surface-50">
            <i class="pi pi-flash mr-2"></i>
            {{ selectedProfessionName }} Nanos
          </h2>
          <h2 v-else class="text-xl font-bold text-surface-900 dark:text-surface-50">
            <i class="pi pi-flash mr-2"></i>
            Select a Profession
          </h2>
          <p class="text-sm text-surface-600 dark:text-surface-400 mt-1">
            {{ selectedProfessionName ? `${totalNanos} nanos organized by strain` : 'Choose a profession from the left panel' }}
          </p>
        </div>
        
        <!-- Sort Controls -->
        <div v-if="selectedProfessionName && nanosByStrain.length > 0" class="flex items-center gap-2">
          <label class="text-sm text-surface-600 dark:text-surface-400">Sort:</label>
          <Dropdown
            v-model="sortOrder"
            :options="sortOptions"
            option-label="label"
            option-value="value"
            class="w-32"
            @change="onSortChange"
          />
        </div>
      </div>
    </div>

    <!-- Content Area -->
    <div class="flex-1 overflow-y-auto">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center h-64">
        <div class="text-center">
          <ProgressSpinner />
          <p class="text-sm text-surface-600 dark:text-surface-400 mt-2">
            Loading {{ selectedProfessionName }} nanos...
          </p>
        </div>
      </div>

      <!-- Empty State - No Profession Selected -->
      <div v-else-if="!selectedProfession" class="flex flex-col items-center justify-center h-64 text-center p-8">
        <i class="pi pi-user text-4xl text-surface-400 dark:text-surface-600 mb-4"></i>
        <h3 class="text-lg font-medium text-surface-700 dark:text-surface-300 mb-2">
          Choose a Profession
        </h3>
        <p class="text-surface-500 dark:text-surface-400">
          Select a profession from the left panel to view its nano programs
        </p>
      </div>

      <!-- Empty State - No Nanos -->
      <div v-else-if="totalNanos === 0" class="flex flex-col items-center justify-center h-64 text-center p-8">
        <i class="pi pi-search text-4xl text-surface-400 dark:text-surface-600 mb-4"></i>
        <h3 class="text-lg font-medium text-surface-700 dark:text-surface-300 mb-2">
          No Nanos Found
        </h3>
        <p class="text-surface-500 dark:text-surface-400">
          No nano programs found for {{ selectedProfessionName }}
        </p>
      </div>

      <!-- Nanos by Strain -->
      <div v-else class="p-4 space-y-6">
        <div
          v-for="strainGroup in nanosByStrain"
          :key="`strain-${strainGroup.strain}`"
          class="strain-group"
        >
          <!-- Strain Header -->
          <div class="flex items-center gap-3 mb-4">
            <div class="flex items-center gap-2">
              <Badge 
                :value="`Strain ${strainGroup.strain}`" 
                severity="info" 
                class="text-xs"
              />
              <RouterLink
                :to="{ 
                  name: 'TinkerItems', 
                  query: { strain: strainGroup.strain, is_nano: 'true' } 
                }"
                class="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
              >
                {{ strainGroup.strainName }}
              </RouterLink>
            </div>
            <span class="text-sm text-surface-500 dark:text-surface-400">
              ({{ strainGroup.nanos.length }} nano{{ strainGroup.nanos.length !== 1 ? 's' : '' }})
            </span>
          </div>

          <!-- Nanos in Strain - List View -->
          <div class="space-y-2">
            <div
              v-for="nano in strainGroup.nanos"
              :key="nano.id"
              class="flex items-center justify-between p-3 bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors cursor-pointer"
              @click="onNanoSelect(nano)"
            >
              <!-- Nano Icon -->
              <div class="flex-shrink-0 mr-3">
                <div class="w-10 h-10 bg-surface-100 dark:bg-surface-800 rounded flex items-center justify-center">
                  <img 
                    v-if="getItemIconUrl(nano.stats || [])"
                    :src="getItemIconUrl(nano.stats || [])" 
                    :alt="`${nano.name} icon`"
                    class="w-8 h-8 object-contain"
                    @error="handleIconError"
                  />
                  <i v-else class="pi pi-flash text-surface-400"></i>
                </div>
              </div>

              <!-- Nano Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-3">
                  <h4 class="font-medium text-surface-900 dark:text-surface-50 truncate">
                    {{ nano.name }}
                  </h4>
                  <div class="flex items-center gap-2">
                    <Badge :value="`QL ${nano.ql || 1}`" severity="secondary" size="small" />
                    <Badge v-if="getStrainName(nano)" :value="getStrainName(nano)" severity="info" size="small" />
                  </div>
                </div>
                <p 
                  v-if="nano.description" 
                  class="text-sm text-surface-600 dark:text-surface-400 mt-1 line-clamp-1"
                >
                  {{ nano.description }}
                </p>
              </div>

              <!-- Action Arrow -->
              <div class="flex-shrink-0 ml-3">
                <i class="pi pi-chevron-right text-surface-400 dark:text-surface-600"></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TODO: Add nano detail dialog for Item objects -->
    <!-- <NanoDetail
      v-if="selectedNano"
      v-model:visible="showNanoDetail"
      :nano="selectedNano"
      @close="onNanoDetailClose"
    /> -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { RouterLink } from 'vue-router'
import Badge from 'primevue/badge'
import Dropdown from 'primevue/dropdown'
import ProgressSpinner from 'primevue/progressspinner'
import SimpleNanoCard from '@/components/nanos/SimpleNanoCard.vue'
// import NanoDetail from '@/components/nanos/NanoDetail.vue'
import { PROFESSION, NANO_STRAIN } from '@/services/game-data'
import { getItemIconUrl } from '@/services/game-utils'
import type { Item } from '@/types/api'

interface StrainGroup {
  strain: number
  strainName: string
  nanos: Item[]
}

// Props
interface Props {
  selectedProfession?: number | null
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  selectedProfession: null,
  loading: false
})

// State
const nanos = ref<Item[]>([])
const selectedNano = ref<Item | null>(null)
const showNanoDetail = ref(false)
const sortOrder = ref<'ql_desc' | 'ql_asc' | 'name_asc'>('ql_desc')
const iconLoadErrors = ref<Set<number>>(new Set())

// Sort options
const sortOptions = [
  { label: 'QL (High → Low)', value: 'ql_desc' },
  { label: 'QL (Low → High)', value: 'ql_asc' },
  { label: 'Name (A → Z)', value: 'name_asc' }
]

// Computed
const selectedProfessionName = computed(() => {
  if (!props.selectedProfession) return null
  return PROFESSION[props.selectedProfession as keyof typeof PROFESSION] || 'Unknown'
})

const totalNanos = computed(() => nanos.value.length)

const nanosByStrain = computed((): StrainGroup[] => {
  if (!nanos.value.length) return []

  // Group nanos by strain
  const strainMap = new Map<number, Item[]>()
  
  nanos.value.forEach(nano => {
    // Find strain stat (stat 75)
    const strainStat = nano.stats.find(stat => stat.stat === 75)
    const strain = strainStat?.value || 0
    
    if (!strainMap.has(strain)) {
      strainMap.set(strain, [])
    }
    strainMap.get(strain)!.push(nano)
  })

  // Convert to array and sort each strain group
  const strainGroups: StrainGroup[] = Array.from(strainMap.entries()).map(([strain, strainNanos]) => {
    // Sort nanos within strain based on selected sort order
    const sortedNanos = [...strainNanos].sort((a, b) => {
      switch (sortOrder.value) {
        case 'ql_desc':
          return (b.ql || 0) - (a.ql || 0)
        case 'ql_asc':
          return (a.ql || 0) - (b.ql || 0)
        case 'name_asc':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    return {
      strain,
      strainName: NANO_STRAIN[strain as keyof typeof NANO_STRAIN] || `Unknown Strain ${strain}`,
      nanos: sortedNanos
    }
  })

  // Sort strain groups by strain number
  return strainGroups.sort((a, b) => a.strain - b.strain)
})

// Methods
async function loadNanos() {
  console.log('loadNanos called with profession:', props.selectedProfession)
  
  if (!props.selectedProfession) {
    nanos.value = []
    return
  }

  try {
    const url = `/api/v1/items?is_nano=true&profession=${props.selectedProfession}&limit=1000&sort=ql&sort_order=desc`
    console.log('Fetching from URL:', url)
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    
    const data = await response.json()
    console.log('Received data:', data)
    nanos.value = data.items || []
    console.log('Set nanos.value to:', nanos.value.length, 'items')
  } catch (error) {
    console.error('Failed to load profession nanos:', error)
    nanos.value = []
  }
}

function onSortChange() {
  // The computed property will automatically re-sort when sortOrder changes
}

function onNanoSelect(nano: Item) {
  // TODO: Navigate to item detail page or open item detail dialog
  console.log('Selected nano:', nano.name)
  // For now, we can navigate to the item detail page
  // router.push({ name: 'ItemDetail', params: { aoid: nano.aoid?.toString() || nano.id.toString() } })
}

function getStrainName(nano: Item): string | null {
  // Find strain stat (stat 75)
  const strainStat = nano.stats.find(stat => stat.stat === 75)
  if (!strainStat) return null
  
  const strainId = strainStat.value
  return NANO_STRAIN[strainId as keyof typeof NANO_STRAIN] || `Strain ${strainId}`
}

function handleIconError(event: Event) {
  // For simplicity, we'll just hide the broken image
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
  // Show the fallback icon by removing the v-if condition result
}

// Watchers
watch(
  () => props.selectedProfession,
  () => {
    loadNanos()
  },
  { immediate: true }
)
</script>

<style scoped>
.profession-nano-display {
  background: var(--surface-ground);
}

.strain-group {
  /* Add any strain-specific styling here */
}

/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  @apply bg-surface-100 dark:bg-surface-800;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  @apply bg-surface-300 dark:bg-surface-600 rounded-full;
}

.overflow-y-auto::-webkit-scrollbar-thumb:hover {
  @apply bg-surface-400 dark:bg-surface-500;
}

/* Line clamp utility */
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
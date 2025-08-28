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
      <div v-else class="p-4 space-y-8">
        <div
          v-for="strainGroup in nanosByStrain"
          :key="`strain-${strainGroup.strain}`"
          class="strain-group"
        >
          <!-- Strain Header -->
          <div class="flex items-center gap-3 mb-6">
            <RouterLink
              :to="{ 
                name: 'TinkerItems', 
                query: { strain: strainGroup.strain, is_nano: 'true' } 
              }"
              class="text-lg font-bold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
            >
              {{ strainGroup.strainName }}
            </RouterLink>
            <span class="text-sm text-surface-500 dark:text-surface-400">
              ({{ strainGroup.totalNanos }} nano{{ strainGroup.totalNanos !== 1 ? 's' : '' }})
            </span>
          </div>

          <!-- Substrains within this Strain -->
          <div class="space-y-4 ml-4">
            <div
              v-for="substrainGroup in strainGroup.substrains"
              :key="`substrain-${strainGroup.strain}-${substrainGroup.substrain}`"
              class="substrain-group"
            >
              <!-- Substrain Header (only show if not "General" or if multiple substrains exist) -->
              <div 
                v-if="substrainGroup.substrainName !== 'General' || strainGroup.substrains.length > 1"
                class="flex items-center gap-2 mb-3 pb-2 border-b border-surface-100 dark:border-surface-800"
              >
                <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300">
                  {{ substrainGroup.substrainName }}
                </h4>
                <span class="text-xs text-surface-400 dark:text-surface-500">
                  ({{ substrainGroup.nanos.length }})
                </span>
              </div>

              <!-- Nanos in Substrain - Table View -->
              <div class="overflow-x-auto rounded-lg border border-surface-200 dark:border-surface-700">
                <table class="w-full min-w-[900px] bg-surface-0 dark:bg-surface-900 table-fixed">
                  <thead class="bg-surface-100 dark:bg-surface-800 sticky top-0">
                    <tr class="text-xs text-surface-600 dark:text-surface-400 uppercase tracking-wider">
                      <th class="px-3 py-3 text-left" style="width: 40px;"></th> <!-- Icon -->
                      <th class="px-3 py-3 text-left" style="width: 280px;">Name</th>
                      <th class="px-3 py-3 text-center" style="width: 80px;">QL</th>
                      <th class="px-3 py-3 text-center" style="width: 80px;">Spec</th>
                      <th class="px-3 py-3 text-center" style="width: 100px;">Expansion</th>
                      <th class="px-3 py-3 text-center font-mono" style="width: 60px;">MM</th>
                      <th class="px-3 py-3 text-center font-mono" style="width: 60px;">BM</th>
                      <th class="px-3 py-3 text-center font-mono" style="width: 60px;">PM</th>
                      <th class="px-3 py-3 text-center font-mono" style="width: 60px;">SI</th>
                      <th class="px-3 py-3 text-center font-mono" style="width: 60px;">MC</th>
                      <th class="px-3 py-3 text-center font-mono" style="width: 60px;">TS</th>
                      <th class="px-3 py-3 text-left" style="width: 200px;">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="nano in substrainGroup.nanos"
                      :key="nano.id"
                      class="border-b border-surface-200 dark:border-surface-700 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors cursor-pointer"
                      @click="onNanoSelect(nano)"
                    >
                      <!-- Icon -->
                      <td class="px-3 py-4">
                        <div class="w-7 h-7 flex items-center justify-center">
                          <img 
                            v-if="getItemIconUrl(nano.stats || [])"
                            :src="getItemIconUrl(nano.stats || [])" 
                            :alt="`${nano.name} icon`"
                            class="w-7 h-7 object-contain"
                            @error="handleIconError"
                          />
                          <i v-else class="pi pi-flash text-surface-400 text-base"></i>
                        </div>
                      </td>
                      
                      <!-- Name -->
                      <td class="px-3 py-4">
                        <div class="font-medium text-surface-900 dark:text-surface-50 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                          {{ nano.name }}
                        </div>
                      </td>
                      
                      <!-- QL -->
                      <td class="px-3 py-4 text-center">
                        <Badge :value="nano.ql || 1" severity="secondary" size="small" />
                      </td>
                      
                      <!-- Spec -->
                      <td class="px-3 py-4 text-center text-sm" :class="getNanoSpecialization(nano) ? 'text-surface-900 dark:text-surface-100' : 'text-surface-400 dark:text-surface-500'">
                        {{ getNanoSpecialization(nano) ? `Spec ${getNanoSpecialization(nano)}` : '-' }}
                      </td>
                      
                      <!-- Expansion -->
                      <td class="px-3 py-4 text-center text-sm" :class="getNanoExpansion(nano) ? 'text-surface-900 dark:text-surface-100' : 'text-surface-400 dark:text-surface-500'">
                        {{ getNanoExpansion(nano) || '-' }}
                      </td>
                      
                      <!-- Nanoskills -->
                      <td class="px-3 py-4 text-center font-mono text-sm" :class="getNanoskillValue(nano, 'mm') ? 'text-surface-900 dark:text-surface-100' : 'text-surface-400 dark:text-surface-500'">
                        {{ getNanoskillValue(nano, 'mm') || '-' }}
                      </td>
                      <td class="px-3 py-4 text-center font-mono text-sm" :class="getNanoskillValue(nano, 'bm') ? 'text-surface-900 dark:text-surface-100' : 'text-surface-400 dark:text-surface-500'">
                        {{ getNanoskillValue(nano, 'bm') || '-' }}
                      </td>
                      <td class="px-3 py-4 text-center font-mono text-sm" :class="getNanoskillValue(nano, 'pm') ? 'text-surface-900 dark:text-surface-100' : 'text-surface-400 dark:text-surface-500'">
                        {{ getNanoskillValue(nano, 'pm') || '-' }}
                      </td>
                      <td class="px-3 py-4 text-center font-mono text-sm" :class="getNanoskillValue(nano, 'si') ? 'text-surface-900 dark:text-surface-100' : 'text-surface-400 dark:text-surface-500'">
                        {{ getNanoskillValue(nano, 'si') || '-' }}
                      </td>
                      <td class="px-3 py-4 text-center font-mono text-sm" :class="getNanoskillValue(nano, 'mc') ? 'text-surface-900 dark:text-surface-100' : 'text-surface-400 dark:text-surface-500'">
                        {{ getNanoskillValue(nano, 'mc') || '-' }}
                      </td>
                      <td class="px-3 py-4 text-center font-mono text-sm" :class="getNanoskillValue(nano, 'ts') ? 'text-surface-900 dark:text-surface-100' : 'text-surface-400 dark:text-surface-500'">
                        {{ getNanoskillValue(nano, 'ts') || '-' }}
                      </td>
                      
                      <!-- Source -->
                      <td class="px-3 py-4 text-sm text-surface-600 dark:text-surface-400">
                        <div class="truncate max-w-[180px]" :title="getFormattedSource(nano) || ''">
                          {{ getFormattedSource(nano) || '-' }}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
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
import { RouterLink, useRouter } from 'vue-router'
import Badge from 'primevue/badge'
import Dropdown from 'primevue/dropdown'
import ProgressSpinner from 'primevue/progressspinner'
import SimpleNanoCard from '@/components/nanos/SimpleNanoCard.vue'
// import NanoDetail from '@/components/nanos/NanoDetail.vue'
import { PROFESSION, NANO_STRAIN, NANO_SUBSTRAINS } from '@/services/game-data'
import { getItemIconUrl, getNanoskillRequirements, getPrimarySource, getNanoSpecialization, getNanoExpansion, type NanoskillRequirements } from '@/services/game-utils'
import type { Item } from '@/types/api'

interface SubstrainGroup {
  substrain: number
  substrainName: string
  nanos: Item[]
}

interface StrainGroup {
  strain: number
  strainName: string
  substrains: SubstrainGroup[]
  totalNanos: number
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

// Router
const router = useRouter()

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

const totalNanos = computed(() => {
  return nanos.value.filter(nano => {
    // Skip test items
    if (nano.name.startsWith('TESTLIVEITEM')) {
      return false
    }
    
    const strainStat = nano.stats.find(stat => stat.stat === 75)
    const strain = strainStat?.value || 0
    return strain !== 0 && strain !== 99999
  }).length
})

const nanosByStrain = computed((): StrainGroup[] => {
  if (!nanos.value.length) return []

  // Group nanos by strain first
  const strainMap = new Map<number, Item[]>()
  
  nanos.value.forEach(nano => {
    // Skip test items
    if (nano.name.startsWith('TESTLIVEITEM')) {
      return
    }
    
    // Find strain stat (stat 75)
    const strainStat = nano.stats.find(stat => stat.stat === 75)
    const strain = strainStat?.value || 0
    
    // Skip nanos with strain 0 or 99999
    if (strain === 0 || strain === 99999) {
      return
    }
    
    if (!strainMap.has(strain)) {
      strainMap.set(strain, [])
    }
    strainMap.get(strain)!.push(nano)
  })

  // Convert to strain groups with nested substrain grouping
  const strainGroups: StrainGroup[] = Array.from(strainMap.entries()).map(([strain, strainNanos]) => {
    // Group nanos within this strain by substrain
    const substrainMap = new Map<number, Item[]>()
    
    strainNanos.forEach(nano => {
      // Find substrain stat (stat 1003)
      const substrainStat = nano.stats.find(stat => stat.stat === 1003)
      const substrain = substrainStat?.value || 0
      
      if (!substrainMap.has(substrain)) {
        substrainMap.set(substrain, [])
      }
      substrainMap.get(substrain)!.push(nano)
    })

    // Convert to substrain groups
    const substrainGroups: SubstrainGroup[] = Array.from(substrainMap.entries()).map(([substrain, substrainNanos]) => {
      // Sort nanos within substrain based on selected sort order
      const sortedNanos = [...substrainNanos].sort((a, b) => {
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
        substrain,
        substrainName: NANO_SUBSTRAINS[substrain as keyof typeof NANO_SUBSTRAINS] || (substrain > 0 ? `Substrain ${substrain}` : 'General'),
        nanos: sortedNanos
      }
    })

    // Sort substrain groups (put general/empty substrain first, then by substrain number)
    const sortedSubstrains = substrainGroups.sort((a, b) => {
      if (a.substrain === 0) return -1
      if (b.substrain === 0) return 1
      return a.substrain - b.substrain
    })

    return {
      strain,
      strainName: NANO_STRAIN[strain as keyof typeof NANO_STRAIN] || `Unknown Strain ${strain}`,
      substrains: sortedSubstrains,
      totalNanos: strainNanos.length
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
    const url = `/api/v1/nanos/profession/${props.selectedProfession}?page_size=1000&sort=ql&sort_order=desc`
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
  // Navigate to item detail page
  router.push({ name: 'ItemDetail', params: { aoid: nano.aoid?.toString() || nano.id.toString() } })
}

function getSubstrainName(nano: Item): string | null {
  // Find substrain stat (stat 1003)
  const substrainStat = nano.stats.find(stat => stat.stat === 1003)
  if (!substrainStat) return null
  
  const substrainId = substrainStat.value
  return NANO_SUBSTRAINS[substrainId as keyof typeof NANO_SUBSTRAINS] || `Substrain ${substrainId}`
}

function handleIconError(event: Event) {
  // For simplicity, we'll just hide the broken image
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
  // Show the fallback icon by removing the v-if condition result
}

function getNanoskillValue(nano: Item, skill: keyof NanoskillRequirements): number | null {
  const requirements = getNanoskillRequirements(nano)
  return requirements[skill] || null
}

function getFormattedSource(nano: Item): string | null {
  return getPrimarySource(nano)
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
  border-left: 3px solid var(--primary-200);
  padding-left: 1rem;
}

.dark .strain-group {
  border-left-color: var(--primary-700);
}

.substrain-group {
  position: relative;
}

.substrain-group::before {
  content: '';
  position: absolute;
  left: -1rem;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--surface-200);
}

.dark .substrain-group::before {
  background: var(--surface-700);
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
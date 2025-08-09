<template>
  <div class="tinker-fite h-full flex flex-col">
    <!-- Header -->
    <div class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="flex items-center gap-4">
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
            <i class="pi pi-shield mr-2"></i>
            TinkerFite
          </h1>
          <Badge :value="totalWeapons" severity="info" v-if="totalWeapons > 0" />
        </div>
        <div class="text-surface-600 dark:text-surface-400">
          Skill-based weapon selection for Anarchy Online
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden p-4">
      <div class="h-full grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        <!-- Character Skills Panel -->
        <div class="lg:col-span-1">
          <SkillInput 
            v-model:skills="characterSkills"
            @update:skills="onSkillsUpdated"
          />
        </div>

        <!-- Main Content Area -->
        <div class="lg:col-span-3">
          <!-- Search and Filters -->
          <div class="bg-surface-0 dark:bg-surface-950 rounded-lg border border-surface-200 dark:border-surface-700 p-6 mb-6">
            <div class="flex flex-col md:flex-row gap-4">
              <div class="flex-1">
                <WeaponSearch 
                  v-model="searchQuery"
                  @search="searchWeapons"
                  :loading="loading"
                />
              </div>
              <div class="md:w-auto">
                <Button 
                  @click="showFilters = !showFilters"
                  :icon="showFilters ? 'pi pi-chevron-up' : 'pi pi-filter'"
                  :label="showFilters ? 'Hide Filters' : 'Show Filters'"
                  severity="secondary"
                />
              </div>
            </div>
            
            <!-- Collapsible Filters -->
            <div v-if="showFilters" class="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
              <WeaponFilters
                v-model:filters="weaponFilters"
                @update:filters="onFiltersUpdated"
                :character-skills="characterSkills"
              />
            </div>
          </div>

          <!-- Usability Summary -->
          <div v-if="characterSkills && Object.keys(characterSkills).length > 0" class="bg-surface-0 dark:bg-surface-950 rounded-lg border border-surface-200 dark:border-surface-700 p-4 mb-6">
            <UsabilitySummary 
              :weapons="filteredWeapons"
              :character-skills="characterSkills"
            />
          </div>

          <!-- Results -->
          <div class="bg-surface-0 dark:bg-surface-950 rounded-lg border border-surface-200 dark:border-surface-700">
            <!-- Loading State -->
            <div v-if="loading" class="p-8 text-center">
              <ProgressSpinner class="w-8 h-8" />
              <p class="text-surface-600 dark:text-surface-400 mt-2">Loading weapons...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="p-8 text-center">
              <div class="text-red-600 dark:text-red-400 mb-2">
                <i class="pi pi-exclamation-triangle text-2xl"></i>
              </div>
              <p class="text-red-800 dark:text-red-300">{{ error }}</p>
              <Button @click="loadWeapons" label="Retry" class="mt-4" />
            </div>

            <!-- Empty State -->
            <div v-else-if="filteredWeapons.length === 0" class="p-8 text-center">
              <div class="text-surface-400 dark:text-surface-500 mb-2">
                <i class="pi pi-search text-2xl"></i>
              </div>
              <p class="text-surface-600 dark:text-surface-400">No weapons found matching your criteria</p>
              <Button @click="clearFilters" label="Clear Filters" severity="secondary" class="mt-4" />
            </div>

            <!-- Weapon List -->
            <div v-else>
              <WeaponList
                :weapons="filteredWeapons"
                :character-skills="characterSkills"
                :sort-by="weaponFilters.sortBy"
                :sort-descending="weaponFilters.sortDescending"
                @sort="onSort"
                @select="selectWeapon"
                @compare="addToComparison"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Weapon Detail Modal -->
    <WeaponDetail
      v-if="selectedWeapon"
      :weapon="selectedWeapon"
      :character-skills="characterSkills"
      :visible="showWeaponDetail"
      @hide="closeWeaponDetail"
    />

    <!-- Weapon Comparison Modal -->
    <WeaponComparison
      :weapons="comparisonWeapons"
      :character-skills="characterSkills"
      :visible="showComparison"
      @hide="closeComparison"
      @remove="removeFromComparison"
    />

    <!-- Floating Comparison Button -->
    <div v-if="comparisonWeapons.length > 0" class="fixed bottom-6 right-6">
      <Button
        @click="showComparison = true"
        :label="`Compare ${comparisonWeapons.length} Weapons`"
        icon="pi pi-balance-scale"
        class="shadow-lg"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'

// Components
import SkillInput from '@/components/fite/SkillInput.vue'
import WeaponSearch from '@/components/fite/WeaponSearch.vue'
import WeaponFilters from '@/components/fite/WeaponFilters.vue'
import WeaponList from '@/components/fite/WeaponList.vue'
import WeaponDetail from '@/components/fite/WeaponDetail.vue'
import WeaponComparison from '@/components/fite/WeaponComparison.vue'
import UsabilitySummary from '@/components/fite/UsabilitySummary.vue'

// Types
import type { Weapon, CharacterSkills, WeaponFilters as WeaponFiltersType } from '@/types/weapon'

// Composables and stores
import { useFiteStore } from '@/stores/fiteStore'

const fiteStore = useFiteStore()
const toast = useToast()

// State
const loading = ref(false)
const error = ref<string | null>(null)
const searchQuery = ref('')
const showFilters = ref(false)
const showWeaponDetail = ref(false)
const showComparison = ref(false)
const selectedWeapon = ref<Weapon | null>(null)
const comparisonWeapons = ref<Weapon[]>([])

// Character skills and filters
const characterSkills = ref<CharacterSkills>({})
const weaponFilters = ref<WeaponFiltersType>({
  weaponTypes: [],
  qualityLevels: [],
  usableOnly: false,
  sortBy: 'name',
  sortDescending: false
})

// Computed
const filteredWeapons = computed(() => {
  return fiteStore.getFilteredWeapons(weaponFilters.value, characterSkills.value)
})

const totalWeapons = computed(() => fiteStore.totalWeapons)

// Methods
const loadWeapons = async () => {
  loading.value = true
  error.value = null
  
  try {
    await fiteStore.fetchWeapons()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load weapons'
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Failed to load weapons',
      life: 5000
    })
  } finally {
    loading.value = false
  }
}

const searchWeapons = async (query: string) => {
  loading.value = true
  error.value = null
  
  try {
    if (query.trim()) {
      await fiteStore.searchWeapons(query)
    } else {
      await fiteStore.fetchWeapons()
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to search weapons'
  } finally {
    loading.value = false
  }
}

const onSkillsUpdated = (skills: CharacterSkills) => {
  characterSkills.value = skills
  fiteStore.setCharacterSkills(skills)
}

const onFiltersUpdated = (filters: WeaponFiltersType) => {
  weaponFilters.value = filters
}

const onSort = (sortBy: string, sortDescending: boolean) => {
  weaponFilters.value.sortBy = sortBy
  weaponFilters.value.sortDescending = sortDescending
}

const selectWeapon = (weapon: Weapon) => {
  selectedWeapon.value = weapon
  showWeaponDetail.value = true
}

const closeWeaponDetail = () => {
  showWeaponDetail.value = false
  selectedWeapon.value = null
}

const addToComparison = (weapon: Weapon) => {
  if (comparisonWeapons.value.length >= 3) {
    toast.add({
      severity: 'warn',
      summary: 'Comparison Limit',
      detail: 'You can compare up to 3 weapons at a time',
      life: 3000
    })
    return
  }
  
  if (!comparisonWeapons.value.find(w => w.id === weapon.id)) {
    comparisonWeapons.value.push(weapon)
    toast.add({
      severity: 'success',
      summary: 'Added to Comparison',
      detail: `${weapon.name} added to comparison`,
      life: 2000
    })
  }
}

const removeFromComparison = (weaponId: number) => {
  comparisonWeapons.value = comparisonWeapons.value.filter(w => w.id !== weaponId)
}

const closeComparison = () => {
  showComparison.value = false
}

const clearFilters = () => {
  weaponFilters.value = {
    weaponTypes: [],
    qualityLevels: [],
    usableOnly: false,
    sortBy: 'name',
    sortDescending: false
  }
  searchQuery.value = ''
}

// Lifecycle
onMounted(async () => {
  // Load character skills from store
  characterSkills.value = fiteStore.characterSkills
  
  // Load initial weapons
  await loadWeapons()
})

// Watch for search query changes
watch(searchQuery, (newQuery) => {
  if (newQuery === '') {
    loadWeapons()
  }
}, { debounce: 500 })
</script>
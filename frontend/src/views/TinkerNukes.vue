<!--
TinkerNukes - Nanotechnician Offensive Nano Specialization Tool

Integrates NukeInputForm and NukeTable components with TinkerProfiles.
Implements FR-10 profile state management with auto-population and filtering.

Task 4.4: Complete view integration
-->
<template>
  <div class="tinker-nukes h-full flex flex-col">
    <!-- Header -->
    <div class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="flex items-center gap-4">
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
            <i class="pi pi-sparkles mr-2" aria-hidden="true"></i>
            TinkerNukes
          </h1>
          <Badge
            :value="filteredNanos.length"
            severity="success"
            v-if="filteredNanos.length > 0"
            :aria-label="`${filteredNanos.length} usable offensive nanos found`"
          />
          <Badge
            value="NT Only"
            severity="warning"
            aria-label="This tool is specialized for Nanotechnician profession only"
          />
        </div>
      </div>

      <!-- Profile Selection Info (if active profile exists) -->
      <div v-if="activeProfile" class="mt-3 flex items-center gap-2 text-sm text-surface-700 dark:text-surface-300">
        <i class="pi pi-user"></i>
        <span>
          Active Profile: <strong>{{ activeProfile.Character.Name }}</strong>
          ({{ getProfessionName(activeProfile.Character.Profession) }} {{ activeProfile.Character.Level }})
        </span>
      </div>
    </div>

    <!-- Input Form Section -->
    <div class="p-4 border-b border-surface-200 dark:border-surface-700">
      <NukeInputForm
        :input-state="inputState"
        :active-profile="activeProfile"
        @update:input-state="onInputStateUpdate"
      />
    </div>

    <!-- Filters Section -->
    <div class="p-4 border-b border-surface-200 dark:border-surface-700">
      <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <!-- Left side: Search and School filter -->
        <div class="flex flex-col sm:flex-row gap-3 flex-1">
          <!-- Search -->
          <div class="flex items-center gap-2">
            <i class="pi pi-search text-surface-400"></i>
            <InputText
              v-model="searchQuery"
              placeholder="Search nanos..."
              class="w-64"
            />
          </div>

          <!-- School Filter -->
          <Dropdown
            v-model="selectedSchoolId"
            :options="schoolFilterOptions"
            option-label="label"
            option-value="value"
            placeholder="All Schools"
            showClear
            class="w-48"
          />

          <!-- QL Range Filters -->
          <div class="flex items-center gap-2">
            <label class="text-sm text-surface-700 dark:text-surface-300">QL:</label>
            <InputNumber
              v-model="minQL"
              :min="1"
              :max="300"
              placeholder="Min"
              class="w-24"
            />
            <span class="text-surface-500">-</span>
            <InputNumber
              v-model="maxQL"
              :min="1"
              :max="300"
              placeholder="Max"
              class="w-24"
            />
          </div>
        </div>

        <!-- Right side: Results count -->
        <div class="text-sm text-surface-600 dark:text-surface-400">
          {{ filteredNanos.length }} nano{{ filteredNanos.length !== 1 ? 's' : '' }} found
        </div>
      </div>
    </div>

    <!-- Nano Table -->
    <div class="flex-1 p-4 overflow-auto">
      <NukeTable
        :nanos="filteredNanos"
        :input-state="inputState"
        :search-query="searchQuery"
        :loading="loading"
        @nano-selected="onNanoSelected"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles'
import { getProfessionName } from '@/services/game-utils'
import Badge from 'primevue/badge'
import Dropdown from 'primevue/dropdown'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'

// Import components from Task 4.1, 4.3
import NukeInputForm from '@/components/nukes/NukeInputForm.vue'
import NukeTable from '@/components/nukes/NukeTable.vue'

// Import types from Task 3.4
import type { OffensiveNano, NukeInputState, CharacterStats, DamageModifiers, BuffPresets } from '@/types/offensive-nano'

// Import service from Task 4.1
import { fetchOffensiveNanos, buildOffensiveNano } from '@/services/offensive-nano-service'

// Import filtering utilities from Task 4.2
import { filterByCharacterProfile, applyNanoFilters } from '@/utils/nuke-filtering'
import type { Character } from '@/utils/stat-calculations'

// ============================================================================
// Store and Router
// ============================================================================

const profileStore = useTinkerProfilesStore()
const router = useRouter()

// ============================================================================
// Reactive State
// ============================================================================

// Loading state
const loading = ref(false)

// Offensive nanos fetched from backend (profession ID 11 = Nanotechnician)
const offensiveNanos = ref<OffensiveNano[]>([])

// Manual input state (27 fields organized into 3 sections)
const inputState = ref<NukeInputState>({
  characterStats: {
    breed: 1,
    psychic: 6,
    nanoInit: 1,
    maxNano: 1,
    nanoDelta: 1,
    matterCreation: 1,
    matterMeta: 1,
    bioMeta: 1,
    psychModi: 1,
    sensoryImp: 1,
    timeSpace: 1,
  },
  damageModifiers: {
    projectile: 0,
    melee: 0,
    energy: 0,
    chemical: 0,
    radiation: 0,
    cold: 0,
    nano: 0,
    fire: 0,
    poison: 0,
    directNanoDamageEfficiency: 0,
    targetAC: 0,
  },
  buffPresets: {
    crunchcom: 0,
    humidity: 0,
    notumSiphon: 0,
    channeling: 0,
    enhanceNanoDamage: 0,
    ancientMatrix: 0,
  },
})

// Search and filter state
const searchQuery = ref('')
const selectedSchoolId = ref<number | null>(null)
const minQL = ref<number | undefined>(undefined)
const maxQL = ref<number | undefined>(undefined)

// ============================================================================
// Computed Properties
// ============================================================================

/**
 * Active profile from TinkerProfiles store
 * Exposed as reactive ref for components
 */
const activeProfile = computed(() => profileStore.activeProfile)

/**
 * School filter options for dropdown
 * Maps skill IDs to display names
 */
const schoolFilterOptions = computed(() => [
  { label: 'Matter Creation', value: 130 },
  { label: 'Matter Metamorphosis', value: 127 },
  { label: 'Biological Metamorphosis', value: 128 },
  { label: 'Psychological Modifications', value: 129 },
  { label: 'Sensory Improvement', value: 126 },
  { label: 'Time and Space', value: 131 },
])

/**
 * Current character as Character type for profile-based filtering
 * Extracted from activeProfile when available, otherwise uses manual inputState
 */
const currentCharacter = computed((): Character | null => {
  if (!activeProfile.value) {
    return null
  }

  // Build Character from TinkerProfile
  return {
    level: activeProfile.value.Character.Level,
    profession: activeProfile.value.Character.Profession,
    breed: activeProfile.value.Character.Breed,
    baseStats: activeProfile.value.Skills || {}
  }
})

/**
 * Filtered nanos based on profile requirements and user filters
 * Implements FR-2: Filter by all requirements (stats, skills, profession, level)
 */
const filteredNanos = computed((): OffensiveNano[] => {
  // Start with all offensive nanos
  let filtered = offensiveNanos.value

  // Step 1: Filter by character profile requirements (if profile exists)
  if (currentCharacter.value) {
    filtered = filterByCharacterProfile(filtered, currentCharacter.value)
  }

  // Step 2: Apply additional filters (school, QL range, search)
  filtered = applyNanoFilters(filtered, {
    schoolId: selectedSchoolId.value,
    minQL: minQL.value,
    maxQL: maxQL.value,
    searchQuery: searchQuery.value,
  })

  return filtered
})

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle input state updates from NukeInputForm
 * Updates local state and triggers table recalculation
 */
function onInputStateUpdate(newState: NukeInputState): void {
  inputState.value = { ...newState }
}

/**
 * Handle nano row click from NukeTable
 * Navigate to /items/:id detail page
 */
function onNanoSelected(nanoId: number): void {
  router.push(`/items/${nanoId}`)
}

/**
 * Clear the table (called on profile switch before re-filtering)
 */
function clearTable(): void {
  // Clear filters to show empty table
  searchQuery.value = ''
  selectedSchoolId.value = null
  minQL.value = undefined
  maxQL.value = undefined
}

// ============================================================================
// Lifecycle Hooks
// ============================================================================

/**
 * On mount: Fetch offensive nanos from backend
 * Call GET /api/nanos/offensive/11 (profession ID 11 = Nanotechnician)
 */
onMounted(async () => {
  loading.value = true

  try {
    // Fetch offensive nanos for Nanotechnician (profession ID 11)
    const items = await fetchOffensiveNanos(11)

    // Transform ItemDetail[] into OffensiveNano[]
    offensiveNanos.value = items
      .map(buildOffensiveNano)
      .filter((nano): nano is OffensiveNano => nano !== null)

    console.log(`[TinkerNukes] Loaded ${offensiveNanos.value.length} offensive nanos`)
  } catch (error) {
    console.error('[TinkerNukes] Failed to fetch offensive nanos:', error)
  } finally {
    loading.value = false
  }
})

// ============================================================================
// Watchers
// ============================================================================

/**
 * Watch active profile changes
 * FR-10: Handle profile switch
 *
 * On profile switch:
 * 1. Clear the nanoprogram table (via clearTable)
 * 2. If new profile is Nanotechnician: auto-populate fields (handled by NukeInputForm)
 * 3. If new profile is not Nanotechnician: reset fields to defaults (handled by NukeInputForm)
 * 4. Re-filter nanos based on new skill values (automatic via filteredNanos computed)
 */
watch(
  () => profileStore.activeProfile,
  (newProfile, oldProfile) => {
    // Only react if profile actually changed
    if (newProfile?.Character.Name === oldProfile?.Character.Name) {
      return
    }

    // Clear table on profile switch
    clearTable()

    // Log profile change
    if (newProfile) {
      const profession = getProfessionName(newProfile.Character.Profession)
      console.log(`[TinkerNukes] Profile switched to: ${newProfile.Character.Name} (${profession})`)

      if (profession !== 'Nanotechnician') {
        console.warn('[TinkerNukes] Active profile is not Nanotechnician, fields will reset to defaults')
      }
    } else {
      console.log('[TinkerNukes] No active profile, fields will reset to defaults')
    }

    // Note: Auto-population and reset logic handled by NukeInputForm component
    // filteredNanos will automatically re-filter based on new inputState values
  },
  { immediate: false }
)
</script>

<style scoped>
.tinker-nukes {
  background-color: var(--surface-0);
}

/* Ensure table container scrolls properly */
.overflow-auto {
  overflow: auto;
  max-height: 100%;
}
</style>

<template>
  <div class="bg-surface-0 dark:bg-surface-950 rounded-lg shadow-md dark:shadow-none border border-surface-200 dark:border-surface-700 p-6">
    <h3 class="text-lg font-semibold text-surface-900 dark:text-surface-50 mb-4">
      Character Stats
    </h3>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Breed Dropdown -->
      <div class="flex flex-col">
        <label for="breed" class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          Breed
        </label>
        <Dropdown
          id="breed"
          v-model="localStats.breed"
          :options="breedOptions"
          option-label="name"
          option-value="id"
          placeholder="Select breed"
          class="w-full"
          @change="onFieldChange"
        />
      </div>

      <!-- Level -->
      <div class="flex flex-col">
        <label for="level-input" class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          Level
        </label>
        <InputNumber
          id="level-input"
          v-model="localStats.level"
          :min="1"
          :max="220"
          :step="1"
          class="w-full"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Psychic (Ability) -->
      <div class="flex flex-col">
        <label for="psychic" class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          Psychic
        </label>
        <InputNumber
          id="psychic"
          v-model="localStats.psychic"
          :min="6"
          :max="3000"
          :step="1"
          class="w-full"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Nano Init (Skill) -->
      <div class="flex flex-col">
        <label for="nanoInit" class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          Nano Init
        </label>
        <InputNumber
          id="nanoInit"
          v-model="localStats.nanoInit"
          :min="1"
          :max="3000"
          :step="1"
          class="w-full"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Max Nano (Skill) -->
      <div class="flex flex-col">
        <label for="maxNano" class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          Max Nano
        </label>
        <InputNumber
          id="maxNano"
          v-model="localStats.maxNano"
          :min="1"
          :max="3000"
          :step="1"
          class="w-full"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Nano Delta (Skill) -->
      <div class="flex flex-col">
        <label for="nanoDelta" class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          Nano Delta
        </label>
        <InputNumber
          id="nanoDelta"
          v-model="localStats.nanoDelta"
          :min="1"
          :max="3000"
          :step="1"
          class="w-full"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Matter Creation (Skill ID 126) -->
      <div class="flex flex-col">
        <label for="matterCreation" class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          Matter Creation
        </label>
        <InputNumber
          id="matterCreation"
          v-model="localStats.matterCreation"
          :min="1"
          :max="3000"
          :step="1"
          class="w-full"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Matter Metamorphosis (Skill ID 127) -->
      <div class="flex flex-col">
        <label for="matterMeta" class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          Matter Metamorphosis
        </label>
        <InputNumber
          id="matterMeta"
          v-model="localStats.matterMeta"
          :min="1"
          :max="3000"
          :step="1"
          class="w-full"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Biological Metamorphosis (Skill ID 128) -->
      <div class="flex flex-col">
        <label for="bioMeta" class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          Biological Metamorphosis
        </label>
        <InputNumber
          id="bioMeta"
          v-model="localStats.bioMeta"
          :min="1"
          :max="3000"
          :step="1"
          class="w-full"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Psychological Modifications (Skill ID 129) -->
      <div class="flex flex-col">
        <label for="psychModi" class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          Psychological Modifications
        </label>
        <InputNumber
          id="psychModi"
          v-model="localStats.psychModi"
          :min="1"
          :max="3000"
          :step="1"
          class="w-full"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Sensory Improvement (Skill ID 130) -->
      <div class="flex flex-col">
        <label for="sensoryImp" class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          Sensory Improvement
        </label>
        <InputNumber
          id="sensoryImp"
          v-model="localStats.sensoryImp"
          :min="1"
          :max="3000"
          :step="1"
          class="w-full"
          @update:model-value="onFieldChange"
        />
      </div>

      <!-- Time and Space (Skill ID 131) -->
      <div class="flex flex-col">
        <label for="timeSpace" class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
          Time and Space
        </label>
        <InputNumber
          id="timeSpace"
          v-model="localStats.timeSpace"
          :min="1"
          :max="3000"
          :step="1"
          class="w-full"
          @update:model-value="onFieldChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import Dropdown from 'primevue/dropdown'
import InputNumber from 'primevue/inputnumber'
import type { CharacterStats } from '@/types/offensive-nano'
import type { TinkerProfile } from '@/lib/tinkerprofiles/types'

// Props
interface Props {
  characterStats: CharacterStats
  profile?: TinkerProfile | null
}

const props = defineProps<Props>()

// Emits
const emit = defineEmits<{
  'update:characterStats': [stats: CharacterStats]
}>()

// Local state for two-way binding
const localStats = ref<CharacterStats>({
  ...props.characterStats,
  level: props.characterStats.level ?? props.profile?.Character?.Level ?? 1
})

// Programmatic update flag to prevent watcher loops
const isProgrammaticUpdate = ref(false)

// Breed options for dropdown (IDs 1-4 for player breeds)
const breedOptions = [
  { id: 1, name: 'Solitus' },
  { id: 2, name: 'Opifex' },
  { id: 3, name: 'Nanomage' },
  { id: 4, name: 'Atrox' }
]

// Skill ID mappings
const SKILL_IDS = {
  SENSORY_IMP: 122,      // SensoryImprovement (FIXED)
  MATTER_META: 127,      // MaterialMetamorphose
  BIO_META: 128,         // BiologicalMetamorphose
  PSYCH_MODI: 129,       // PsychologicalModification
  MATTER_CREATION: 130,  // MaterialCreation
  TIME_SPACE: 131        // SpaceTime
} as const

// Handle field changes - emit updates to parent
const onFieldChange = () => {
  if (!isProgrammaticUpdate.value) {
    emit('update:characterStats', { ...localStats.value })
  }
}

// Watch for prop changes from parent (external updates)
watch(() => props.characterStats, (newStats) => {
  isProgrammaticUpdate.value = true
  localStats.value = { ...newStats }
  setTimeout(() => {
    isProgrammaticUpdate.value = false
  }, 10)
}, { deep: true })

// Auto-populate from profile when profile changes
// Watch individual skill values for reactive updates
watch(() => props.profile?.Character.Breed, (newBreed) => {
  if (newBreed !== undefined && !isProgrammaticUpdate.value) {
    isProgrammaticUpdate.value = true
    localStats.value.breed = newBreed as 1 | 2 | 3 | 4
    setTimeout(() => {
      isProgrammaticUpdate.value = false
      emit('update:characterStats', { ...localStats.value })
    }, 10)
  }
}, { immediate: true })

// Watch Psychic (Ability ID 21)
watch(() => props.profile?.skills[21]?.total, (newValue) => {
  if (newValue !== undefined && !isProgrammaticUpdate.value) {
    isProgrammaticUpdate.value = true
    localStats.value.psychic = newValue
    setTimeout(() => {
      isProgrammaticUpdate.value = false
      emit('update:characterStats', { ...localStats.value })
    }, 10)
  }
}, { immediate: true })

// Watch Nano Init (Skill ID 149)
watch(() => props.profile?.skills[149]?.total, (newValue) => {
  if (newValue !== undefined && !isProgrammaticUpdate.value) {
    isProgrammaticUpdate.value = true
    localStats.value.nanoInit = newValue
    setTimeout(() => {
      isProgrammaticUpdate.value = false
      emit('update:characterStats', { ...localStats.value })
    }, 10)
  }
}, { immediate: true })

// Watch Max Nano (Character.MaxNano)
watch(() => props.profile?.Character?.MaxNano, (newValue) => {
  if (newValue !== undefined && !isProgrammaticUpdate.value) {
    isProgrammaticUpdate.value = true
    localStats.value.maxNano = newValue
    setTimeout(() => {
      isProgrammaticUpdate.value = false
      emit('update:characterStats', { ...localStats.value })
    }, 10)
  }
}, { immediate: true })

// Watch Nano Delta (Skill ID 364)
watch(() => props.profile?.skills[364]?.total, (newValue) => {
  if (newValue !== undefined && !isProgrammaticUpdate.value) {
    isProgrammaticUpdate.value = true
    localStats.value.nanoDelta = newValue
    setTimeout(() => {
      isProgrammaticUpdate.value = false
      emit('update:characterStats', { ...localStats.value })
    }, 10)
  }
}, { immediate: true })

// Watch Matter Creation (Skill ID 126)
watch(() => props.profile?.skills[SKILL_IDS.MATTER_CREATION]?.total, (newValue) => {
  if (newValue !== undefined && !isProgrammaticUpdate.value) {
    isProgrammaticUpdate.value = true
    localStats.value.matterCreation = newValue
    setTimeout(() => {
      isProgrammaticUpdate.value = false
      emit('update:characterStats', { ...localStats.value })
    }, 10)
  }
}, { immediate: true })

// Watch Matter Metamorphosis (Skill ID 127)
watch(() => props.profile?.skills[SKILL_IDS.MATTER_META]?.total, (newValue) => {
  if (newValue !== undefined && !isProgrammaticUpdate.value) {
    isProgrammaticUpdate.value = true
    localStats.value.matterMeta = newValue
    setTimeout(() => {
      isProgrammaticUpdate.value = false
      emit('update:characterStats', { ...localStats.value })
    }, 10)
  }
}, { immediate: true })

// Watch Biological Metamorphosis (Skill ID 128)
watch(() => props.profile?.skills[SKILL_IDS.BIO_META]?.total, (newValue) => {
  if (newValue !== undefined && !isProgrammaticUpdate.value) {
    isProgrammaticUpdate.value = true
    localStats.value.bioMeta = newValue
    setTimeout(() => {
      isProgrammaticUpdate.value = false
      emit('update:characterStats', { ...localStats.value })
    }, 10)
  }
}, { immediate: true })

// Watch Psychological Modifications (Skill ID 129)
watch(() => props.profile?.skills[SKILL_IDS.PSYCH_MODI]?.total, (newValue) => {
  if (newValue !== undefined && !isProgrammaticUpdate.value) {
    isProgrammaticUpdate.value = true
    localStats.value.psychModi = newValue
    setTimeout(() => {
      isProgrammaticUpdate.value = false
      emit('update:characterStats', { ...localStats.value })
    }, 10)
  }
}, { immediate: true })

// Watch Sensory Improvement (Skill ID 130)
watch(() => props.profile?.skills[SKILL_IDS.SENSORY_IMP]?.total, (newValue) => {
  if (newValue !== undefined && !isProgrammaticUpdate.value) {
    isProgrammaticUpdate.value = true
    localStats.value.sensoryImp = newValue
    setTimeout(() => {
      isProgrammaticUpdate.value = false
      emit('update:characterStats', { ...localStats.value })
    }, 10)
  }
}, { immediate: true })

// Watch Time and Space (Skill ID 131)
watch(() => props.profile?.skills[SKILL_IDS.TIME_SPACE]?.total, (newValue) => {
  if (newValue !== undefined && !isProgrammaticUpdate.value) {
    isProgrammaticUpdate.value = true
    localStats.value.timeSpace = newValue
    setTimeout(() => {
      isProgrammaticUpdate.value = false
      emit('update:characterStats', { ...localStats.value })
    }, 10)
  }
}, { immediate: true })

// Watch Level
watch(() => props.profile?.Character?.Level, (newValue) => {
  if (newValue !== undefined && !isProgrammaticUpdate.value) {
    isProgrammaticUpdate.value = true
    localStats.value.level = newValue
    setTimeout(() => {
      isProgrammaticUpdate.value = false
      emit('update:characterStats', { ...localStats.value })
    }, 10)
  }
}, { immediate: true })
</script>

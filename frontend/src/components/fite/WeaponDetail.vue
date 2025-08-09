<template>
  <Dialog 
    :visible="visible"
    @update:visible="$emit('hide')"
    :header="weapon?.name || 'Weapon Details'"
    :style="{ width: '800px' }"
    modal
  >
    <div v-if="weapon" class="space-y-6">
      <!-- Weapon Overview -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">Name</label>
          <p class="mt-1 text-sm text-surface-900 dark:text-surface-50">{{ weapon.name }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">Quality Level</label>
          <p class="mt-1 text-sm text-surface-900 dark:text-surface-50">{{ weapon.ql }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">AOID</label>
          <p class="mt-1 text-sm text-surface-900 dark:text-surface-50">{{ weapon.aoid }}</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">Item Class</label>
          <p class="mt-1 text-sm text-surface-900 dark:text-surface-50">{{ weapon.item_class }}</p>
        </div>
      </div>

      <!-- Description -->
      <div v-if="weapon.description">
        <label class="block text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
        <p class="mt-1 text-sm text-surface-900 dark:text-surface-50">{{ weapon.description }}</p>
      </div>

      <!-- Usability (if skills available) -->
      <div v-if="characterSkills && Object.keys(characterSkills).length > 0" class="border rounded-lg p-4">
        <h4 class="font-medium text-surface-900 dark:text-surface-50 mb-3">Usability Check</h4>
        <WeaponRequirements 
          :weapon="weapon"
          :character-skills="characterSkills"
        />
      </div>

      <!-- Requirements -->
      <div class="border rounded-lg p-4">
        <h4 class="font-medium text-surface-900 dark:text-surface-50 mb-3">All Requirements</h4>
        <WeaponRequirements 
          :weapon="weapon"
          :character-skills="characterSkills"
        />
      </div>

      <!-- Attack Stats -->
      <div v-if="weapon.attack_stats && weapon.attack_stats.length > 0" class="border rounded-lg p-4">
        <h4 class="font-medium text-surface-900 dark:text-surface-50 mb-3">Attack Stats</h4>
        <div class="grid grid-cols-2 gap-2">
          <div 
            v-for="stat in weapon.attack_stats"
            :key="stat.id"
            class="flex justify-between text-sm"
          >
            <span>{{ getStatName(stat.stat) }}</span>
            <span class="font-medium">{{ stat.value }}</span>
          </div>
        </div>
      </div>

      <!-- Defense Stats -->
      <div v-if="weapon.defense_stats && weapon.defense_stats.length > 0" class="border rounded-lg p-4">
        <h4 class="font-medium text-surface-900 dark:text-surface-50 mb-3">Defense Stats</h4>
        <div class="grid grid-cols-2 gap-2">
          <div 
            v-for="stat in weapon.defense_stats"
            :key="stat.id"
            class="flex justify-between text-sm"
          >
            <span>{{ getStatName(stat.stat) }}</span>
            <span class="font-medium">{{ stat.value }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end space-x-2">
        <Button @click="$emit('hide')" label="Close" severity="secondary" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import WeaponRequirements from './WeaponRequirements.vue'
import type { Weapon, CharacterSkills } from '@/types/weapon'
import { SKILL_NAMES } from '@/types/weapon'

interface Props {
  weapon?: Weapon | null
  characterSkills?: CharacterSkills
  visible: boolean
}

interface Emits {
  (e: 'hide'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const getStatName = (statId: number): string => {
  return SKILL_NAMES[statId] || `Stat ${statId}`
}
</script>
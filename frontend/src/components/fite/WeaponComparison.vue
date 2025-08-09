<template>
  <Dialog 
    :visible="visible"
    @update:visible="$emit('hide')"
    header="Weapon Comparison"
    :style="{ width: '1200px' }"
    modal
  >
    <div v-if="weapons.length === 0" class="text-center py-8">
      <div class="text-surface-400 dark:text-surface-500 mb-2">
        <i class="pi pi-balance-scale text-3xl"></i>
      </div>
      <p class="text-surface-600 dark:text-surface-400">No weapons selected for comparison</p>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="min-w-full border-collapse border border-surface-200 dark:border-surface-700">
        <!-- Header -->
        <thead class="bg-surface-50 dark:bg-surface-900">
          <tr>
            <th class="border border-surface-200 dark:border-surface-700 px-4 py-2 text-left text-surface-900 dark:text-surface-50">Property</th>
            <th 
              v-for="weapon in weapons" 
              :key="weapon.id"
              class="border border-surface-200 dark:border-surface-700 px-4 py-2 text-left relative text-surface-900 dark:text-surface-50"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <div class="font-medium truncate">{{ weapon.name }}</div>
                  <div class="text-xs text-surface-500 dark:text-surface-400">QL {{ weapon.ql }}</div>
                </div>
                <Button
                  @click="$emit('remove', weapon.id)"
                  icon="pi pi-times"
                  size="small"
                  severity="danger"
                  text
                  class="ml-2"
                />
              </div>
            </th>
          </tr>
        </thead>

        <tbody>
          <!-- Basic Properties -->
          <tr>
            <td class="border border-surface-200 dark:border-surface-700 px-4 py-2 font-medium bg-surface-50 dark:bg-surface-900 text-surface-900 dark:text-surface-50">Quality Level</td>
            <td 
              v-for="weapon in weapons" 
              :key="weapon.id"
              class="border border-surface-200 dark:border-surface-700 px-4 py-2 text-surface-900 dark:text-surface-50"
            >
              {{ weapon.ql }}
            </td>
          </tr>

          <tr>
            <td class="border border-surface-200 dark:border-surface-700 px-4 py-2 font-medium bg-surface-50 dark:bg-surface-900 text-surface-900 dark:text-surface-50">Item Class</td>
            <td 
              v-for="weapon in weapons" 
              :key="weapon.id"
              class="border border-surface-200 dark:border-surface-700 px-4 py-2 text-surface-900 dark:text-surface-50"
            >
              {{ weapon.item_class }}
            </td>
          </tr>

          <!-- Usability (if character skills available) -->
          <tr v-if="characterSkills && Object.keys(characterSkills).length > 0">
            <td class="border border-surface-200 dark:border-surface-700 px-4 py-2 font-medium bg-surface-50 dark:bg-surface-900">Usability</td>
            <td 
              v-for="weapon in weapons" 
              :key="weapon.id"
              class="border border-surface-200 dark:border-surface-700 px-4 py-2 text-surface-900 dark:text-surface-50"
            >
              <UsabilityBadge 
                :weapon="weapon"
                :character-skills="characterSkills"
              />
            </td>
          </tr>

          <!-- Skill Requirements -->
          <tr>
            <td class="border border-surface-200 dark:border-surface-700 px-4 py-2 font-medium bg-surface-50 dark:bg-surface-900">Requirements</td>
            <td 
              v-for="weapon in weapons" 
              :key="weapon.id"
              class="border border-surface-200 dark:border-surface-700 px-4 py-2 text-surface-900 dark:text-surface-50"
            >
              <div class="max-h-40 overflow-y-auto">
                <WeaponRequirements 
                  :weapon="weapon"
                  :character-skills="characterSkills"
                  :compact="true"
                />
              </div>
            </td>
          </tr>

          <!-- Attack Stats -->
          <tr v-if="hasAttackStats">
            <td class="border border-surface-200 dark:border-surface-700 px-4 py-2 font-medium bg-surface-50 dark:bg-surface-900">Attack Stats</td>
            <td 
              v-for="weapon in weapons" 
              :key="weapon.id"
              class="border border-surface-200 dark:border-surface-700 px-4 py-2 text-surface-900 dark:text-surface-50"
            >
              <div v-if="weapon.attack_stats && weapon.attack_stats.length > 0" class="space-y-1">
                <div 
                  v-for="stat in weapon.attack_stats.slice(0, 5)"
                  :key="stat.id"
                  class="text-xs flex justify-between"
                >
                  <span>{{ getStatName(stat.stat) }}</span>
                  <span class="font-medium">{{ stat.value }}</span>
                </div>
                <div v-if="weapon.attack_stats.length > 5" class="text-xs text-surface-500 dark:text-surface-400">
                  +{{ weapon.attack_stats.length - 5 }} more
                </div>
              </div>
              <div v-else class="text-xs text-surface-500 dark:text-surface-400">None</div>
            </td>
          </tr>

          <!-- Defense Stats -->
          <tr v-if="hasDefenseStats">
            <td class="border border-surface-200 dark:border-surface-700 px-4 py-2 font-medium bg-surface-50 dark:bg-surface-900">Defense Stats</td>
            <td 
              v-for="weapon in weapons" 
              :key="weapon.id"
              class="border border-surface-200 dark:border-surface-700 px-4 py-2 text-surface-900 dark:text-surface-50"
            >
              <div v-if="weapon.defense_stats && weapon.defense_stats.length > 0" class="space-y-1">
                <div 
                  v-for="stat in weapon.defense_stats.slice(0, 5)"
                  :key="stat.id"
                  class="text-xs flex justify-between"
                >
                  <span>{{ getStatName(stat.stat) }}</span>
                  <span class="font-medium">{{ stat.value }}</span>
                </div>
                <div v-if="weapon.defense_stats.length > 5" class="text-xs text-surface-500 dark:text-surface-400">
                  +{{ weapon.defense_stats.length - 5 }} more
                </div>
              </div>
              <div v-else class="text-xs text-surface-500 dark:text-surface-400">None</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <template #footer>
      <div class="flex justify-end space-x-2">
        <Button @click="$emit('hide')" label="Close" severity="secondary" />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import WeaponRequirements from './WeaponRequirements.vue'
import UsabilityBadge from './UsabilityBadge.vue'
import type { Weapon, CharacterSkills } from '@/types/weapon'
import { SKILL_NAMES } from '@/types/weapon'

interface Props {
  weapons: Weapon[]
  characterSkills?: CharacterSkills
  visible: boolean
}

interface Emits {
  (e: 'hide'): void
  (e: 'remove', weaponId: number): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// Computed
const hasAttackStats = computed(() => {
  return props.weapons.some(weapon => weapon.attack_stats && weapon.attack_stats.length > 0)
})

const hasDefenseStats = computed(() => {
  return props.weapons.some(weapon => weapon.defense_stats && weapon.defense_stats.length > 0)
})

const getStatName = (statId: number): string => {
  return SKILL_NAMES[statId] || `Stat ${statId}`
}
</script>
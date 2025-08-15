<!--
WeaponStats - Dedicated weapon statistics display component
Shows detailed weapon information including damage, timing, range, and special skills
-->
<template>
  <Card v-if="isWeaponItem">
    <template #header>
      <div class="flex items-center gap-2">
        <i class="pi pi-bolt text-orange-500"></i>
        <h3 class="text-lg font-semibold">Weapon Statistics</h3>
      </div>
    </template>
    
    <template #content>
      <div class="space-y-6">
        <!-- Damage Information -->
        <div v-if="weaponStats.minDamage || weaponStats.maxDamage">
          <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Damage</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <!-- Min/Max Damage -->
            <div v-if="weaponStats.minDamage && weaponStats.maxDamage" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Damage Range</span>
              <span class="font-mono font-medium text-red-600 dark:text-red-400">
                {{ weaponStats.minDamage }} - {{ weaponStats.maxDamage }}{{ weaponStats.criticalBonus ? ` (${weaponStats.criticalBonus})` : '' }}
              </span>
            </div>
            
            <!-- Damage Type -->
            <div v-if="weaponStats.damageType" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Damage Type</span>
              <span class="font-mono font-medium text-red-600 dark:text-red-400">
                {{ getStatName(weaponStats.damageType) }}
              </span>
            </div>
            
            <!-- Attack Range -->
            <div v-if="weaponStats.attackRange" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Attack Range</span>
              <span class="font-mono font-medium text-red-600 dark:text-red-400">
                {{ weaponStats.attackRange }}m
              </span>
            </div>
            
            <!-- DPS -->
            <div v-if="dps > 0" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">DPS</span>
              <span class="font-mono font-medium text-red-600 dark:text-red-400">
                {{ dps.toFixed(1) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Timing Information -->
        <div v-if="weaponStats.attackSpeed || weaponStats.burstRecharge || (weaponStats.attackDelay && weaponStats.rechargeDelay) || weaponStats.initiativeType">
          <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Timing</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <!-- Attack Speed -->
            <div v-if="weaponStats.attackDelay && weaponStats.rechargeDelay" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Attack Speed</span>
              <span class="font-mono font-medium text-blue-600 dark:text-blue-400">
                {{ formatCentisecondsToSeconds(weaponStats.attackDelay) }}s/{{ formatCentisecondsToSeconds(weaponStats.rechargeDelay) }}s
              </span>
            </div>
            
            <!-- Initiative -->
            <div v-if="weaponStats.initiativeType" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Initiative</span>
              <span class="font-mono font-medium text-green-600 dark:text-green-400">
                {{ getStatName(weaponStats.initiativeType) }}
              </span>
            </div>
            
            <!-- Attack Time -->
            <div v-if="weaponStats.attackSpeed" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Attack Time</span>
              <span class="font-mono font-medium">
                {{ formatAttackTime(weaponStats.attackSpeed) }}
              </span>
            </div>
            
            <!-- Recharge Time -->
            <div v-if="weaponStats.burstRecharge" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Recharge Time</span>
              <span class="font-mono font-medium">
                {{ formatRechargeTime(weaponStats.burstRecharge) }}
              </span>
            </div>
            
            <!-- Attacks per Second -->
            <div v-if="attacksPerSecond > 0" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Attacks/Second</span>
              <span class="font-mono font-medium">
                {{ attacksPerSecond.toFixed(2) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Range and Special Properties -->
        <div v-if="weaponStats.multiRanged || weaponStats.multiMelee || weaponStats.range || (weaponStats.maxEnergy && weaponStats.ammoType) || weaponStats.maxBeneficialSkill">
          <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Properties</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <!-- Multi Ranged/Melee -->
            <div v-if="weaponStats.multiRanged" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Multi Ranged</span>
              <span class="font-mono font-medium">
                {{ weaponStats.multiRanged }}
              </span>
            </div>
            <div v-else-if="weaponStats.multiMelee" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Multi Melee</span>
              <span class="font-mono font-medium">
                {{ weaponStats.multiMelee }}
              </span>
            </div>
            
            <!-- Range -->
            <div v-if="weaponStats.range" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Range</span>
              <span class="font-mono font-medium">
                {{ formatWeaponRange(weaponStats.range) }}
              </span>
            </div>
            
            <!-- Clip -->
            <div v-if="weaponStats.maxEnergy && weaponStats.ammoType" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Clip</span>
              <span class="font-mono font-medium">
                {{ weaponStats.maxEnergy }} {{ getAmmoTypeName(weaponStats.ammoType) }}
              </span>
            </div>
            
            <!-- Max Beneficial Skill -->
            <div v-if="weaponStats.maxBeneficialSkill" class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded">
              <span class="text-sm text-surface-600 dark:text-surface-400">Max Beneficial Skill</span>
              <span class="font-mono font-medium">
                {{ weaponStats.maxBeneficialSkill }}
              </span>
            </div>
          </div>
        </div>

        <!-- Special Attacks -->
        <div v-if="specialAttacks.length > 0">
          <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Special Attacks</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="attack in specialAttacks"
              :key="attack.name"
              class="flex justify-between items-center p-3 bg-surface-50 dark:bg-surface-900 rounded"
            >
              <span class="text-sm text-surface-600 dark:text-surface-400">
                {{ attack.name }}
              </span>
              <span class="font-mono font-medium text-purple-600 dark:text-purple-400">
                {{ attack.skill }} / {{ attack.cap }}s
              </span>
            </div>
          </div>
        </div>

        <!-- Skill Requirements (Weapon-specific) -->
        <div v-if="weaponSkillRequirements.length > 0">
          <h4 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Skill Requirements</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="req in weaponSkillRequirements"
              :key="req.stat"
              class="flex justify-between items-center p-3 rounded"
              :class="{
                'bg-green-50 dark:bg-green-900/20': showCompatibility && canMeetRequirement(req),
                'bg-red-50 dark:bg-red-900/20': showCompatibility && !canMeetRequirement(req),
                'bg-surface-50 dark:bg-surface-900': !showCompatibility
              }"
            >
              <div class="flex items-center gap-2">
                <i
                  v-if="showCompatibility"
                  :class="{
                    'pi pi-check text-green-600': canMeetRequirement(req),
                    'pi pi-times text-red-600': !canMeetRequirement(req)
                  }"
                ></i>
                <span class="text-sm text-surface-600 dark:text-surface-400">
                  {{ getStatName(req.stat) }}
                </span>
              </div>
              <div class="text-right">
                <div class="font-mono font-medium">
                  {{ formatSkillRequirement(req.stat, req.value) }}
                </div>
                <div v-if="showCompatibility && profile" class="text-xs text-surface-500">
                  (You: {{ formatSkillRequirement(req.stat, getCharacterStat(req.stat)) }})
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Item, TinkerProfile, ItemRequirement } from '@/types/api'
import { 
  getWeaponStats, 
  getDamageTypeName, 
  formatAttackTime, 
  formatRechargeTime, 
  calculateWeaponDPS,
  isWeapon,
  getWeaponSpecialSkills,
  formatWeaponRange,
  getStatName,
  getAmmoTypeName,
  getWeaponSpecialAttacks
} from '@/services/game-utils'

const props = defineProps<{
  item: Item
  profile?: TinkerProfile | null
  showCompatibility?: boolean
}>()

// Computed Properties
const isWeaponItem = computed(() => isWeapon(props.item.item_class))

const weaponStats = computed(() => {
  if (!props.item.stats) return {}
  return getWeaponStats(props.item.stats)
})

const averageDamage = computed(() => {
  const { minDamage, maxDamage } = weaponStats.value
  if (!minDamage || !maxDamage) return 0
  return (minDamage + maxDamage) / 2
})

const dps = computed(() => {
  const { minDamage, maxDamage, attackSpeed } = weaponStats.value
  if (!minDamage || !maxDamage || !attackSpeed) return 0
  return calculateWeaponDPS(minDamage, maxDamage, attackSpeed)
})

const attacksPerSecond = computed(() => {
  const { attackSpeed } = weaponStats.value
  if (!attackSpeed) return 0
  return 1000 / attackSpeed
})

const damageTypeName = computed(() => {
  const { damageType } = weaponStats.value
  return damageType ? getDamageTypeName(damageType) : null
})

const specialSkills = computed(() => {
  if (!props.item.stats) return []
  return getWeaponSpecialSkills(props.item.stats)
})

const specialAttacks = computed(() => {
  if (!props.item.stats) return []
  return getWeaponSpecialAttacks(props.item.stats)
})

const weaponSkillRequirements = computed(() => {
  if (!props.item.requirements) return []
  
  // Filter for weapon-related skill requirements
  const weaponSkillIds = [
    100, 101, 102, 103, 104, 105, 106, 107, 108, // Combat skills
    148, 150, 134, 133, 119 // Special attack skills
  ]
  
  return props.item.requirements.filter(req => weaponSkillIds.includes(req.stat))
})

// Methods
function canMeetRequirement(requirement: ItemRequirement): boolean {
  if (!props.profile) return false
  const characterStat = props.profile.stats?.[requirement.stat] || 0
  return characterStat >= requirement.value
}

function getCharacterStat(statId: number): number {
  return props.profile?.stats?.[statId] || 0
}

function formatSkillRequirement(statId: number, value: number): string {
  // Some weapon skills are displayed as percentages
  const percentageSkills = [100, 101, 102, 103, 104, 105, 106, 107, 108] // Combat skills
  
  if (percentageSkills.includes(statId)) {
    return `${value}%`
  }
  
  return value.toString()
}

function formatCentisecondsToSeconds(centiseconds: number): string {
  // Convert centiseconds to seconds with 2 decimal places
  const seconds = centiseconds / 100
  return seconds.toFixed(2)
}
</script>

<style scoped>
.font-mono {
  font-family: 'Courier New', 'Monaco', 'Lucida Console', monospace;
}

/* Ensure consistent spacing */
.grid > div {
  min-height: 3rem;
}

/* Color coding for damage values */
.text-red-600 {
  color: rgb(220, 38, 38);
}

.dark .text-red-400 {
  color: rgb(248, 113, 113);
}
</style>
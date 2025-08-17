<!--
WeaponStats - Compact weapon statistics display component
Shows essential weapon information in a dense, scannable table format
-->
<template>
  <Card v-if="isWeaponItem">
    <template #content>
      <div class="weapon-stats-compact weapon-stats-component">
        <!-- Header with DPS Badge -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <i class="pi pi-bolt text-orange-500"></i>
            <h3 class="text-base font-semibold">Weapon Statistics</h3>
          </div>
          <div v-if="dps > 0" class="dps-badge">
            {{ dps.toFixed(1) }} DPS
          </div>
        </div>
        
        <!-- Compact Stats Table -->
        <div class="stats-table">
          <!-- Headers Row -->
          <div class="stats-row header-row">
            <div class="stat-group header-cell">Damage</div>
            <div class="stat-group header-cell">Speed</div>
            <div class="stat-group header-cell">Properties</div>
            <div class="stat-group header-cell">Special Attacks</div>
          </div>
          
          <!-- Data Row -->
          <div class="stats-row data-row">
            <!-- Damage Column -->
            <div class="stat-group">
              <div class="damage-display">
                <div v-if="weaponStats.minDamage" class="damage-stat">
                  <div class="damage-label">Min</div>
                  <div class="damage-value">{{ weaponStats.minDamage }}</div>
                </div>
                <div v-if="weaponStats.minDamage && weaponStats.maxDamage" class="damage-divider"></div>
                <div v-if="weaponStats.maxDamage" class="damage-stat">
                  <div class="damage-label">Max</div>
                  <div class="damage-value max">{{ weaponStats.maxDamage }}</div>
                </div>
                <div v-if="weaponStats.criticalBonus" class="damage-divider"></div>
                <div v-if="weaponStats.criticalBonus" class="damage-stat">
                  <div class="damage-label">Crit</div>
                  <div class="damage-value crit">{{ weaponStats.criticalBonus }}</div>
                </div>
              </div>
              <div v-if="weaponStats.damageType" class="stat-pair">
                <span class="stat-name">Type</span>
                <span class="stat-val val-damage">🔥 {{ getStatName(weaponStats.damageType) }}</span>
              </div>
            </div>
            
            <!-- Speed Column -->
            <div class="stat-group">
              <div v-if="weaponStats.attackDelay" class="stat-pair">
                <span class="stat-name">Attack</span>
                <span class="stat-val val-speed">{{ formatCentisecondsToSeconds(weaponStats.attackDelay) }}s</span>
              </div>
              <div v-if="weaponStats.rechargeDelay" class="stat-pair">
                <span class="stat-name">Recharge</span>
                <span class="stat-val val-speed">{{ formatCentisecondsToSeconds(weaponStats.rechargeDelay) }}s</span>
              </div>
              <div v-if="weaponStats.initiativeType" class="stat-pair">
                <span class="stat-name">Initiative</span>
                <span class="stat-val val-speed">{{ getStatName(weaponStats.initiativeType).replace('Init', '') }}</span>
              </div>
            </div>
            
            <!-- Properties Column -->
            <div class="stat-group">
              <div v-if="weaponStats.attackRange" class="stat-pair">
                <span class="stat-name">Range</span>
                <span class="stat-val val-range">{{ weaponStats.attackRange }}m</span>
              </div>
              <div v-if="weaponStats.multiRanged || weaponStats.multiMelee" class="stat-pair">
                <span class="stat-name">Multi</span>
                <span class="stat-val val-range">{{ weaponStats.multiRanged || weaponStats.multiMelee }}</span>
              </div>
              <div v-if="weaponStats.maxEnergy && weaponStats.ammoType" class="stat-pair">
                <span class="stat-name">Clip</span>
                <span class="stat-val val-ammo">{{ weaponStats.maxEnergy }} {{ getAmmoTypeName(weaponStats.ammoType) }}</span>
              </div>
            </div>
            
            <!-- Special Attacks Column -->
            <div class="stat-group">
              <div v-if="specialAttacks.length > 0" class="attacks-inline">
                <div v-for="attack in specialAttacks" :key="attack.name" class="attack-badge">
                  <div class="attack-label">{{ getAttackIcon(attack.name) }} {{ attack.name }}</div>
                  <div class="attack-dmg">{{ attack.skill }} / {{ attack.cap }}s</div>
                </div>
              </div>
              <div v-else class="text-xs text-surface-500 dark:text-surface-400 text-center py-4">
                No special attacks
              </div>
            </div>
          </div>
        </div>
        
        <!-- Damage Modifiers Section -->
        <div v-if="hasAttackDefenseStats" class="stats-table mt-3">
          <!-- Headers Row -->
          <div class="stats-row header-row">
            <div class="stat-group header-cell">Attack Skills</div>
            <div class="stat-group header-cell">Defense Skills</div>
          </div>
          
          <!-- Data Row -->
          <div class="stats-row data-row">
            <!-- Attack Skills Column -->
            <div class="stat-group">
              <div v-if="attackStatsFormatted.length > 0" class="modifier-list">
                <div v-for="modifier in attackStatsFormatted" :key="modifier.stat" class="stat-pair">
                  <span class="stat-name">{{ modifier.name }}</span>
                  <span class="stat-val val-attack">{{ modifier.formattedValue }}</span>
                </div>
              </div>
              <div v-else class="text-xs text-surface-500 dark:text-surface-400 text-center py-4">
                No attack skills
              </div>
            </div>
            
            <!-- Defense Skills Column -->
            <div class="stat-group">
              <div v-if="defenseStatsFormatted.length > 0" class="modifier-list">
                <div v-for="modifier in defenseStatsFormatted" :key="modifier.stat" class="stat-pair">
                  <span class="stat-name">{{ modifier.name }}</span>
                  <span class="stat-val val-defense">{{ modifier.formattedValue }}</span>
                </div>
              </div>
              <div v-else class="text-xs text-surface-500 dark:text-surface-400 text-center py-4">
                No defense skills
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
  attackStats?: Array<{stat: number, value: number}>
  defenseStats?: Array<{stat: number, value: number}>
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

const hasAttackDefenseStats = computed(() => {
  return (props.attackStats && props.attackStats.length > 0) || 
         (props.defenseStats && props.defenseStats.length > 0)
})

const attackStatsFormatted = computed(() => {
  if (!props.attackStats) return []
  return props.attackStats.map(stat => ({
    stat: stat.stat,
    name: getStatName(stat.stat),
    formattedValue: formatPercentageValue(stat.value)
  }))
})

const defenseStatsFormatted = computed(() => {
  if (!props.defenseStats) return []
  return props.defenseStats.map(stat => ({
    stat: stat.stat,
    name: getStatName(stat.stat),
    formattedValue: formatPercentageValue(stat.value)
  }))
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

function getAttackIcon(attackName: string): string {
  // Return appropriate icon for attack types
  const iconMap: Record<string, string> = {
    'Fling Shot': '🎯',
    'FlingShot': '🎯',
    'Burst': '💥',
    'Aimed Shot': '🎯',
    'Fast Attack': '⚡',
    'Bow Special Attack': '🏹',
    'Sneak Attack': '🗡️'
  }
  return iconMap[attackName] || '⚔️'
}

function formatPercentageValue(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value}%`
}
</script>

<style>
/* Component scoping */
.weapon-stats-component .dps-badge {
  padding: 4px 12px;
  background: linear-gradient(135deg, #dc2626, #f97316);
  border-radius: 16px;
  font-size: 14px;
  font-weight: bold;
  color: white;
}

/* Compact Table Layout */
.weapon-stats-component .stats-table {
  display: table;
  width: 100%;
  border-collapse: separate;
  border-spacing: 2px;
}

.weapon-stats-component .stats-row {
  display: table-row;
}

.weapon-stats-component .stat-group {
  display: table-cell;
  padding: 8px;
  background: #f8fafc;
  border: 1px solid #d1d5db;
  vertical-align: middle;
}

.dark .weapon-stats-component .stat-group {
  background: #0c0a09 !important;
  border-color: #374151 !important;
  color: #e5e7eb !important;
}

.weapon-stats-component .stat-group.header-cell {
  background: #e5e7eb;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #4b5563;
  padding: 6px 8px;
  text-align: center;
}

.dark .weapon-stats-component .stat-group.header-cell {
  background: #374151 !important;
  color: #9ca3af !important;
}

/* Inline stat pairs */
.weapon-stats-component .stat-pair {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.weapon-stats-component .stat-pair:last-child {
  margin-bottom: 0;
}

.weapon-stats-component .stat-name {
  font-size: 11px;
  color: #6b7280;
}

.dark .weapon-stats-component .stat-name {
  color: #9ca3af !important;
}

.weapon-stats-component .stat-val {
  font-size: 12px;
  font-weight: 600;
}

/* Color coding */
.weapon-stats-component .val-damage { color: #ef4444; }
.weapon-stats-component .val-speed { color: #3b82f6; }
.weapon-stats-component .val-range { color: #10b981; }
.weapon-stats-component .val-ammo { color: #fbbf24; }
.weapon-stats-component .val-special { color: #a78bfa; }
.weapon-stats-component .val-attack { color: #ef4444; font-weight: 600; }
.weapon-stats-component .val-defense { color: #3b82f6; font-weight: 600; }

/* Damage display */
.weapon-stats-component .damage-display {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 6px 0;
  margin-bottom: 8px;
}

.weapon-stats-component .damage-stat {
  text-align: center;
}

.weapon-stats-component .damage-label {
  font-size: 9px;
  color: #6b7280;
  text-transform: uppercase;
}

.dark .weapon-stats-component .damage-label {
  color: #9ca3af !important;
}

.weapon-stats-component .damage-value {
  font-size: 14px;
  font-weight: bold;
  color: #ef4444;
}

.weapon-stats-component .damage-value.max {
  color: #fbbf24;
}

.weapon-stats-component .damage-value.crit {
  color: #10b981;
}

.weapon-stats-component .damage-divider {
  width: 1px;
  height: 20px;
  background: #d1d5db;
}

.dark .weapon-stats-component .damage-divider {
  background: #4b5563 !important;
}

/* Special attacks inline */
.weapon-stats-component .attacks-inline {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.weapon-stats-component .attack-badge {
  padding: 4px 6px;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid #7c3aed;
  border-radius: 4px;
  font-size: 10px;
  text-align: center;
}

.dark .weapon-stats-component .attack-badge {
  background: rgba(139, 92, 246, 0.2) !important;
}

.weapon-stats-component .attack-label {
  color: #a78bfa;
  margin-bottom: 2px;
  font-size: 10px;
}

.weapon-stats-component .attack-dmg {
  color: #fbbf24;
  font-weight: bold;
  font-size: 11px;
}

/* Modifier list styling */
.weapon-stats-component .modifier-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
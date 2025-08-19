<!--
NanoStatistics - Compact nano statistics display component
Shows essential nano information in a dense, scannable table format
-->
<template>
  <Card v-if="isNanoItem">
    <template #content>
      <div class="nano-stats-compact nano-stats-component">
        <!-- Header with School Badge -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <i class="pi pi-sparkles text-purple-500"></i>
            <h3 class="text-base font-semibold">Nano Statistics</h3>
          </div>
          <div v-if="nanoStats.nanoSchool" class="school-badge">
            {{ getNanoSchoolName(nanoStats.nanoSchool) || 'Unknown School' }}
          </div>
        </div>
        
        <!-- Compact Stats Table -->
        <div class="stats-table">
          <!-- Headers Row -->
          <div class="stats-row header-row">
            <div class="stat-group header-cell">Cost & Usage</div>
            <div class="stat-group header-cell">Range & Duration</div>
            <div class="stat-group header-cell">Properties</div>
          </div>
          
          <!-- Data Row -->
          <div class="stats-row data-row">
            <!-- Cost & Usage Column -->
            <div class="stat-group">
              <div v-if="nanoStats.nanoCost" class="stat-pair">
                <span class="stat-name">Cost</span>
                <span class="stat-val val-cost">{{ nanoStats.nanoCost }} NP</span>
              </div>
              <div v-if="nanoStats.nanoDelta" class="stat-pair">
                <span class="stat-name">Delta</span>
                <span class="stat-val val-delta">{{ nanoStats.nanoDelta }}</span>
              </div>
              <div v-if="nanoStats.castTime" class="stat-pair">
                <span class="stat-name">Cast Time</span>
                <span class="stat-val val-cast">{{ formatCastTime(nanoStats.castTime) }}</span>
              </div>
              <div v-if="nanoStats.rechargeTime" class="stat-pair">
                <span class="stat-name">Recharge</span>
                <span class="stat-val val-cast">{{ formatCastTime(nanoStats.rechargeTime) }}</span>
              </div>
            </div>
            
            <!-- Range & Duration Column -->
            <div class="stat-group">
              <div v-if="nanoStats.nanoRange" class="stat-pair">
                <span class="stat-name">Range</span>
                <span class="stat-val val-range">{{ formatRange(nanoStats.nanoRange) }}</span>
              </div>
              <div v-if="nanoStats.duration" class="stat-pair">
                <span class="stat-name">Duration</span>
                <span class="stat-val val-duration">{{ formatDuration(nanoStats.duration) }}</span>
              </div>
              <div v-if="nanoStats.areaOfEffect" class="stat-pair">
                <span class="stat-name">Area</span>
                <span class="stat-val val-range">{{ nanoStats.areaOfEffect }}m</span>
              </div>
            </div>
            
            <!-- Properties Column -->
            <div class="stat-group">
              <div v-if="nanoStats.nanoStrain" class="stat-pair">
                <span class="stat-name">Strain</span>
                <span class="stat-val val-strain">{{ getNanoStrainName(nanoStats.nanoStrain) || nanoStats.nanoStrain }}</span>
              </div>
              <div v-if="nanoStats.stackingOrder" class="stat-pair">
                <span class="stat-name">Stacking</span>
                <span class="stat-val val-stack">{{ nanoStats.stackingOrder }}</span>
              </div>
              <div v-if="nanoStats.targetType" class="stat-pair">
                <span class="stat-name">Target</span>
                <span class="stat-val val-target">{{ formatTargetType(nanoStats.targetType) }}</span>
              </div>
              <div v-if="nanoStats.flags && nanoStats.flags.length > 0" class="stat-pair">
                <span class="stat-name">Flags</span>
                <span class="stat-val val-flags">{{ nanoStats.flags.slice(0, 2).join(', ') }}{{ nanoStats.flags.length > 2 ? '...' : '' }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Skill Modifiers Section -->
        <div v-if="hasSkillModifiers" class="stats-table mt-3">
          <!-- Headers Row -->
          <div class="stats-row header-row">
            <div class="stat-group header-cell">Skill Requirements</div>
            <div class="stat-group header-cell">Skill Bonuses</div>
          </div>
          
          <!-- Data Row -->
          <div class="stats-row data-row">
            <!-- Skill Requirements Column -->
            <div class="stat-group">
              <div v-if="skillRequirementsFormatted.length > 0" class="modifier-list">
                <div v-for="skill in skillRequirementsFormatted" :key="skill.stat" class="stat-pair">
                  <span class="stat-name">{{ skill.name }}</span>
                  <span class="stat-val val-requirement">{{ skill.formattedValue }}</span>
                </div>
              </div>
              <div v-else class="text-xs text-surface-500 dark:text-surface-400 text-center py-4">
                No skill requirements
              </div>
            </div>
            
            <!-- Skill Bonuses Column -->
            <div class="stat-group">
              <div v-if="skillBonusesFormatted.length > 0" class="modifier-list">
                <div v-for="bonus in skillBonusesFormatted" :key="bonus.stat" class="stat-pair">
                  <span class="stat-name">{{ bonus.name }}</span>
                  <span class="stat-val val-bonus">{{ bonus.formattedValue }}</span>
                </div>
              </div>
              <div v-else class="text-xs text-surface-500 dark:text-surface-400 text-center py-4">
                No skill bonuses
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
  getStatName,
  getNanoSchoolName,
  getNanoStrainName
} from '@/services/game-utils'

const props = defineProps<{
  item: Item
  profile?: TinkerProfile | null
  showCompatibility?: boolean
  skillRequirements?: Array<{stat: number, value: number}>
  skillBonuses?: Array<{stat: number, value: number}>
}>()

// Computed Properties
const isNanoItem = computed(() => {
  // Check if item is a nano using the same logic as the template badge
  return props.item.is_nano === true || props.item.type_name === 'Nano'
})

const nanoStats = computed(() => {
  if (!props.item.stats) return {}
  
  const stats = props.item.stats
  return {
    // Core nano properties
    nanoCost: stats.find(s => s.stat === 318)?.value, // NanoCost
    nanoDelta: stats.find(s => s.stat === 364)?.value, // NanoDelta
    nanoRange: stats.find(s => s.stat === 381)?.value, // NanoRange
    duration: stats.find(s => s.stat === 8)?.value, // Duration
    nanoSchool: stats.find(s => s.stat === 56)?.value, // NanoSchool (if available)
    nanoStrain: stats.find(s => s.stat === 534)?.value, // NanoStrain (if available)
    
    // Timing
    castTime: stats.find(s => s.stat === 32)?.value, // CastTime
    rechargeTime: stats.find(s => s.stat === 31)?.value, // RechargeDelay
    
    // Advanced properties
    areaOfEffect: stats.find(s => s.stat === 457)?.value, // AreaOfEffect
    stackingOrder: stats.find(s => s.stat === 30)?.value, // StackingOrder
    targetType: stats.find(s => s.stat === 37)?.value, // TargetType
    
    // Extract flags from item flags if available
    flags: extractNanoFlags(props.item)
  }
})

const hasSkillModifiers = computed(() => {
  return (props.skillRequirements && props.skillRequirements.length > 0) || 
         (props.skillBonuses && props.skillBonuses.length > 0)
})

const skillRequirementsFormatted = computed(() => {
  if (!props.skillRequirements) return []
  return props.skillRequirements.map(skill => ({
    stat: skill.stat,
    name: getStatName(skill.stat),
    formattedValue: `${skill.value}+`
  }))
})

const skillBonusesFormatted = computed(() => {
  if (!props.skillBonuses) return []
  return props.skillBonuses.map(bonus => ({
    stat: bonus.stat,
    name: getStatName(bonus.stat),
    formattedValue: formatBonusValue(bonus.value)
  }))
})

// Methods
function formatCastTime(centiseconds: number | undefined): string {
  if (!centiseconds) return 'Instant'
  if (centiseconds === 100) return '1s'
  
  const seconds = centiseconds / 100
  if (seconds < 1) {
    return `${centiseconds / 10}ms`
  }
  return `${seconds.toFixed(1)}s`
}

function formatRange(range: number | undefined): string {
  if (!range || range === 0) return 'Self'
  if (range === 1) return 'Touch'
  return `${range}m`
}

function formatDuration(duration: number | undefined): string {
  if (!duration || duration === 0) return 'Instant'
  if (duration === -1) return 'Permanent'
  
  // Duration is usually in seconds
  if (duration < 60) return `${duration}s`
  if (duration < 3600) return `${Math.round(duration / 60)}m`
  return `${Math.round(duration / 3600)}h`
}

function formatTargetType(targetType: number | undefined): string {
  if (!targetType) return 'Unknown'
  
  // Common target types in Anarchy Online
  const targetTypes: Record<number, string> = {
    1: 'Self',
    2: 'Target',
    3: 'Area',
    4: 'Team',
    5: 'Hostile',
    6: 'Friendly',
    7: 'All'
  }
  
  return targetTypes[targetType] || `Type ${targetType}`
}

function extractNanoFlags(item: Item): string[] {
  const flags: string[] = []
  
  // Check for common nano flags based on stats or other properties
  if (item.stats) {
    const hasTargetRestriction = item.stats.some(s => s.stat === 37) // TargetType
    const hasAreaEffect = item.stats.some(s => s.stat === 457) // AreaOfEffect
    const isChanneled = item.stats.some(s => s.stat === 32 && s.value > 500) // Long cast time
    
    if (hasAreaEffect) flags.push('AoE')
    if (isChanneled) flags.push('Channeled')
    if (hasTargetRestriction) flags.push('Targeted')
  }
  
  return flags
}

function formatBonusValue(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value}`
}
</script>

<style>
/* Component scoping */
.nano-stats-component .school-badge {
  padding: 4px 12px;
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  border-radius: 16px;
  font-size: 14px;
  font-weight: bold;
  color: white;
}

/* Compact Table Layout */
.nano-stats-component .stats-table {
  display: table;
  width: 100%;
  border-collapse: separate;
  border-spacing: 2px;
}

.nano-stats-component .stats-row {
  display: table-row;
}

.nano-stats-component .stat-group {
  display: table-cell;
  padding: 8px;
  background: #f8fafc;
  border: 1px solid #d1d5db;
  vertical-align: middle;
}

.dark .nano-stats-component .stat-group {
  background: #0c0a09 !important;
  border-color: #374151 !important;
  color: #e5e7eb !important;
}

.nano-stats-component .stat-group.header-cell {
  background: #e5e7eb;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #4b5563;
  padding: 6px 8px;
  text-align: center;
}

.dark .nano-stats-component .stat-group.header-cell {
  background: #374151 !important;
  color: #9ca3af !important;
}

/* Inline stat pairs */
.nano-stats-component .stat-pair {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.nano-stats-component .stat-pair:last-child {
  margin-bottom: 0;
}

.nano-stats-component .stat-name {
  font-size: 11px;
  color: #6b7280;
}

.dark .nano-stats-component .stat-name {
  color: #9ca3af !important;
}

.nano-stats-component .stat-val {
  font-size: 12px;
  font-weight: 600;
}

/* Color coding */
.nano-stats-component .val-cost { color: #8b5cf6; }
.nano-stats-component .val-delta { color: #3b82f6; }
.nano-stats-component .val-cast { color: #f59e0b; }
.nano-stats-component .val-range { color: #10b981; }
.nano-stats-component .val-duration { color: #06b6d4; }
.nano-stats-component .val-strain { color: #ef4444; }
.nano-stats-component .val-stack { color: #84cc16; }
.nano-stats-component .val-target { color: #64748b; }
.nano-stats-component .val-flags { color: #a78bfa; }
.nano-stats-component .val-requirement { color: #ef4444; font-weight: 600; }
.nano-stats-component .val-bonus { color: #10b981; font-weight: 600; }

/* Modifier list styling */
.nano-stats-component .modifier-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* Light mode specific adjustments */
@media (prefers-color-scheme: light) {
  .nano-stats-component .stat-group {
    background: #ffffff;
    border-color: #e5e7eb;
  }
  
  .nano-stats-component .stat-group.header-cell {
    background: #f9fafb;
    border-color: #e5e7eb;
  }
}

/* Mobile responsive */
@media (max-width: 640px) {
  .nano-stats-component .stats-table {
    font-size: 13px;
  }
  
  .nano-stats-component .stat-group {
    padding: 6px;
  }
  
  .nano-stats-component .stat-name {
    font-size: 10px;
  }
  
  .nano-stats-component .stat-val {
    font-size: 11px;
  }
}
</style>
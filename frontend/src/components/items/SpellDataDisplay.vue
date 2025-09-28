<!--
SpellDataDisplay - Spell data effects display component
Shows item spell effects in a compact, scannable table format following WeaponStats theme
-->
<template>
  <Card v-if="hasSpellData">
    <template #content>
      <div class="spell-data-display spell-data-component">
        <!-- Header with Effects Badge -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <i class="pi pi-sparkles text-purple-500"></i>
            <h3 class="text-base font-semibold">Effects</h3>
          </div>
          <div v-if="formattedSpellData.length > 0" class="effects-badge">
            {{ spellDataSummary }}
          </div>
        </div>
        
        
        <!-- Compact Mode (for simple effects) -->
        <div v-if="useCompactMode" class="compact-effects">
          <div v-for="spellData in formattedSpellData" :key="spellData.id" class="effect-group">
            <div class="effect-header">
              <span class="event-icon">{{ getEventIcon(spellData.event || 0) }}</span>
              <span class="event-name">{{ spellData.eventName || 'Effect' }}</span>
            </div>
            <div class="spells-list">
              <div v-for="spell in visibleSpells(spellData.spells)" :key="spell.id" class="spell-compact">
                <span class="spell-text">{{ spell.formattedText }}</span>
                <div v-if="spell.parameters.length > 0" class="spell-params">
                  <span 
                    v-for="param in spell.parameters.slice(0, 2)" 
                    :key="param.key" 
                    :class="param.color"
                    class="param-value"
                  >
                    {{ param.displayValue }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Full Table Mode (for complex effects) -->
        <div v-else class="effects-table">
          <table class="w-full border-collapse">
            <!-- Headers Row -->
            <thead>
              <tr class="header-row">
                <th class="header-cell">Event</th>
                <th class="header-cell">Target</th>
                <th class="header-cell">Effect</th>
                <th class="header-cell">Duration</th>
              </tr>
            </thead>
            
            <!-- Data Rows -->
            <tbody>
              <template v-for="spellData in formattedSpellData" :key="spellData.id">
                <tr 
                  v-for="(spell, index) in visibleSpells(spellData.spells)" 
                  :key="spell.id"
                  class="data-row"
                >
                  <!-- Event Column (only show for first spell in group) -->
                  <td class="table-cell event-cell">
                    <div v-if="index === 0" class="event-display">
                      <span class="event-icon">{{ getEventIcon(spellData.event || 0) }}</span>
                      <span class="event-name">{{ spellData.eventName || 'Effect' }}</span>
                    </div>
                  </td>
                  
                  <!-- Target Column -->
                  <td class="table-cell">
                    <div v-if="spell.targetName && spell.targetName !== 'Self'" class="target-display">
                      <span class="target-name">{{ spell.targetName }}</span>
                    </div>
                    <div v-else class="target-self">
                      Self
                    </div>
                  </td>
                  
                  <!-- Effect Column -->
                  <td class="table-cell">
                    <div class="effect-text">
                      <SpellText :text="spell.formattedText" />
                    </div>
                    <div v-if="spell.criteria.length > 0" class="effect-criteria">
                      <CriteriaDisplay 
                        :criteria="spell.criteria" 
                        :character-stats="characterStats"
                        :expanded="false"
                        size="small"
                      />
                    </div>
                  </td>
                  
                  <!-- Duration Column -->
                  <td class="table-cell">
                    <div v-if="spell.tickCount && spell.tickCount > 1" class="duration-display">
                      <div class="duration-stat">
                        <div class="duration-label">Ticks</div>
                        <div class="duration-value">{{ spell.tickCount }}</div>
                      </div>
                      <div v-if="spell.tickInterval && spell.tickInterval > 0" class="duration-divider"></div>
                      <div v-if="spell.tickInterval && spell.tickInterval > 0" class="duration-stat">
                        <div class="duration-label">Interval</div>
                        <div class="duration-value">{{ formatTickInterval(spell.tickInterval) }}s</div>
                      </div>
                    </div>
                    <div v-else class="text-xs text-surface-500 dark:text-surface-400 text-center py-4">
                      Instant
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Card from 'primevue/card'
import type { SpellData, TinkerProfile } from '@/types/api'
import { 
  formatSpellDataList, 
  shouldUseCompactMode, 
  getSpellDataSummary,
  getEventIcon,
  type FormattedSpellData,
  type FormattedSpell
} from '@/services/spell-data-utils'
import CriteriaDisplay from '@/components/CriteriaDisplay.vue'
import SpellParameters from './SpellParameters.vue'
import SpellText from './SpellText.vue'

// ============================================================================
// Props
// ============================================================================

interface Props {
  spellData: SpellData[]
  profile?: TinkerProfile | null
  showHidden?: boolean
  advancedView?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  spellData: () => [],
  profile: null,
  showHidden: false,
  advancedView: false
})

// ============================================================================
// Computed Properties
// ============================================================================

const hasSpellData = computed(() => {
  return props.spellData && props.spellData.length > 0
})

const filteredSpellData = computed(() => {
  if (!hasSpellData.value) {
    return []
  }
  
  if (!props.advancedView) {
    // Filter out spell_data containing spells with spell_id 53065 (Attractor Effects)
    return props.spellData.filter(spellData => 
      !spellData.spells.some(spell => spell.spell_id === 53065)
    )
  }
  
  return props.spellData
})

const formattedSpellData = computed(() => {
  return formatSpellDataList(filteredSpellData.value)
})

const useCompactMode = computed(() => {
  return shouldUseCompactMode(formattedSpellData.value)
})

const spellDataSummary = computed(() => {
  return getSpellDataSummary(formattedSpellData.value)
})

const characterStats = computed(() => {
  if (!props.profile?.skills) return {}

  // Convert TinkerProfile to character stats format expected by CriteriaDisplay
  const stats: Record<number, number> = {}

  // Profile.skills is already a flat map of skillId -> SkillData
  Object.entries(props.profile.skills).forEach(([skillId, skillData]) => {
    const id = Number(skillId)
    if (!isNaN(id) && skillData?.total !== undefined) {
      stats[id] = skillData.total
    }
  })

  return stats
})

// ============================================================================
// Methods
// ============================================================================

function visibleSpells(spells: FormattedSpell[]): FormattedSpell[] {
  if (props.showHidden) {
    return spells
  }
  return spells.filter(spell => !spell.isHidden)
}

function formatTickInterval(tickInterval: number): string {
  // Convert tick interval to seconds (assuming 100 ticks per second)
  return (tickInterval / 100).toFixed(1)
}

function getStatIdFromSkillName(skillName: string): number | null {
  // Simplified mapping - in a real implementation this would be comprehensive
  const skillMap: Record<string, number> = {
    'Strength': 16,
    'Agility': 17,
    'Stamina': 18,
    'Intelligence': 19,
    'Sense': 20,
    'Psychic': 21,
    // Add more mappings as needed
  }
  return skillMap[skillName] || null
}
</script>

<style>
/* Component scoping */
.spell-data-component .effects-badge {
  padding: 4px 12px;
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  border-radius: 16px;
  font-size: 14px;
  font-weight: bold;
  color: white;
}

/* Compact Mode Styles */
.spell-data-component .compact-effects {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.spell-data-component .effect-group {
  padding: 8px;
  background: #f8fafc;
  border: 1px solid #d1d5db;
  border-radius: 4px;
}

.dark .spell-data-component .effect-group {
  background: #0c0a09 !important;
  border-color: #374151 !important;
  color: #e5e7eb !important;
}

.spell-data-component .effect-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #4b5563;
}

.dark .spell-data-component .effect-header {
  color: #9ca3af !important;
}

.spell-data-component .spells-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.spell-data-component .spell-compact {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
}

.spell-data-component .spell-text {
  flex: 1;
  color: #374151;
}

.dark .spell-data-component .spell-text {
  color: #d1d5db !important;
}

.spell-data-component .spell-params {
  display: flex;
  gap: 8px;
  align-items: center;
}

.spell-data-component .param-value {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  background: rgba(139, 92, 246, 0.1);
  border-radius: 12px;
}

/* Table Mode Styles */
.spell-data-component .effects-table table {
  border-spacing: 2px;
}

.spell-data-component .table-cell {
  padding: 8px;
  background: #f8fafc;
  border: 1px solid #d1d5db;
  vertical-align: middle;
}

.dark .spell-data-component .table-cell {
  background: #0c0a09 !important;
  border-color: #374151 !important;
  color: #e5e7eb !important;
}

.spell-data-component .header-cell {
  background: #e5e7eb;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #4b5563;
  padding: 6px 8px;
  text-align: center;
  border: 1px solid #d1d5db;
}

.dark .spell-data-component .header-cell {
  background: #374151 !important;
  color: #9ca3af !important;
  border-color: #4b5563 !important;
}

.spell-data-component .event-cell {
  width: 15%;
}

.spell-data-component .event-display {
  display: flex;
  align-items: center;
  gap: 6px;
}

.spell-data-component .event-icon {
  font-size: 14px;
}

.spell-data-component .event-name {
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
}

.dark .spell-data-component .event-name {
  color: #9ca3af !important;
}

.spell-data-component .target-display {
  text-align: center;
}

.spell-data-component .target-name {
  font-size: 11px;
  font-weight: 600;
  color: #3b82f6;
}

.spell-data-component .target-self {
  font-size: 11px;
  color: #6b7280;
  text-align: center;
}

.dark .spell-data-component .target-self {
  color: #9ca3af !important;
}

.spell-data-component .effect-text {
  font-size: 12px;
  color: #374151;
  margin-bottom: 4px;
}

.dark .spell-data-component .effect-text {
  color: #d1d5db !important;
}

.spell-data-component .effect-params {
  margin-bottom: 4px;
}

.spell-data-component .effect-criteria {
  margin-top: 4px;
}

/* Duration display */
.spell-data-component .duration-display {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 4px 0;
}

.spell-data-component .duration-stat {
  text-align: center;
}

.spell-data-component .duration-label {
  font-size: 9px;
  color: #6b7280;
  text-transform: uppercase;
}

.dark .spell-data-component .duration-label {
  color: #9ca3af !important;
}

.spell-data-component .duration-value {
  font-size: 12px;
  font-weight: bold;
  color: #7c3aed;
}

.spell-data-component .duration-divider {
  width: 1px;
  height: 16px;
  background: #d1d5db;
}

.dark .spell-data-component .duration-divider {
  background: #4b5563 !important;
}
</style>
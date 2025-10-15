<template>
  <div 
    class="criterion-chip"
    :class="chipClasses"
  >
    <!-- Stat Requirement -->
    <div v-if="criterion.isStatRequirement" class="stat-requirement">
      <span class="stat-name">{{ criterion.statName }}</span>
      <span class="operator">{{ ' ' + criterion.displaySymbol + ' ' }}</span>
      <span class="value">{{ formattedValue }}</span>

      <!-- Character Status -->
      <span v-if="characterStats && showStatus" class="status" :class="statusClasses">
        ({{ currentValue }})
      </span>
    </div>
    
    <!-- State Requirement -->
    <div v-else-if="isStateRequirement" class="state-requirement">
      <i class="pi pi-info-circle mr-1"></i>
      <span>{{ criterion.description }}</span>
    </div>
    
    <!-- Logical Operator -->
    <div v-else-if="criterion.isLogicalOperator" class="logical-operator">
      <i class="pi pi-code mr-1"></i>
      <span>{{ criterion.displayOperator }}</span>
    </div>
    
    <!-- Unknown -->
    <div v-else class="unknown-criterion">
      <span>{{ criterion.description }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DisplayCriterion } from '../services/action-criteria'
import type { CharacterStats } from '../composables/useActionCriteria'
import { getStatName, getProfessionName, getBreedName, getGenderName, getFlagNameFromValue, getNPCFamilyName } from '../services/game-utils'

// ============================================================================
// Props
// ============================================================================

interface Props {
  criterion: DisplayCriterion
  characterStats?: CharacterStats | null
  size?: 'small' | 'normal' | 'large'
  showStatus?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  characterStats: null,
  size: 'normal',
  showStatus: true
})

// ============================================================================
// Computed Properties
// ============================================================================

const isStateRequirement = computed(() => {
  return !props.criterion.isStatRequirement && 
         !props.criterion.isLogicalOperator && 
         !props.criterion.isSeparator
})

const currentValue = computed(() => {
  if (!props.characterStats) return 0
  return props.characterStats[props.criterion.stat] || 0
})

const requirementMet = computed(() => {
  if (!props.characterStats || !props.criterion.isStatRequirement) return null
  
  const current = currentValue.value
  const required = props.criterion.displayValue
  
  switch (props.criterion.displaySymbol) {
    case '=':
      return current === required
    case '≤':
      return current <= required
    case '≥':
      return current >= required
    case '≠':
      return current !== required
    case 'has':
      return (current & required) === required
    case 'lacks':
      return (current & required) === 0
    default:
      return null
  }
})

const formattedValue = computed(() => {
  const value = props.criterion.displayValue
  
  // Handle flag operators - use resolved flag names
  if (props.criterion.displaySymbol === 'has' || props.criterion.displaySymbol === 'lacks') {
    return getFlagNameFromValue(props.criterion.stat, value)
  }
  
  // Special formatting for certain stats
  switch (props.criterion.stat) {
    case 60: // Profession
      const professionName = getProfessionName(value)
      return professionName || value.toString()
      
    case 368: // VisualProfession
      const visualProfessionName = getProfessionName(value)
      return visualProfessionName || value.toString()
      
    case 4: // Breed
      const breedName = getBreedName(value)
      return breedName || value.toString()
      
    case 59: // Gender
      const genderName = getGenderName(value)
      return genderName || value.toString()
      
    case 455: // NPCFamily
      const npcFamilyName = getNPCFamilyName(value)
      return npcFamilyName || value.toString()
      
    case 54: // Level
      return value.toString()
      
    default:
      return value.toString()
  }
})

const chipClasses = computed(() => {
  const classes = ['criterion-chip']
  
  // Size classes
  classes.push(`size-${props.size}`)
  
  // Status classes
  if (props.criterion.isStatRequirement && props.characterStats) {
    if (requirementMet.value === true) {
      classes.push('requirement-met')
    } else if (requirementMet.value === false) {
      classes.push('requirement-unmet')
    } else {
      classes.push('requirement-unknown')
    }
  } else {
    classes.push('requirement-neutral')
  }
  
  // Type classes
  if (props.criterion.isStatRequirement) {
    classes.push('stat-requirement-chip')
  } else if (props.criterion.isLogicalOperator) {
    classes.push('logical-operator-chip')
  } else if (isStateRequirement.value) {
    classes.push('state-requirement-chip')
  }
  
  return classes
})

const statusClasses = computed(() => {
  if (requirementMet.value === true) {
    return 'status-met'
  } else if (requirementMet.value === false) {
    return 'status-unmet'
  }
  return 'status-neutral'
})
</script>

<style>
/* Component-scoped styling matching WeaponStats aesthetic */
.criterion-chip {
  display: inline-flex;
  align-items: center;
  border-radius: 16px;
  border: 1px solid;
  transition: all 0.2s ease;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  white-space: nowrap;
}

/* Size variants with WeaponStats-inspired sizing */
.size-small {
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 500;
}

.size-normal {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
}

.size-large {
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 600;
}

/* Status variants with improved contrast and colors */
.requirement-met {
  background: #064e3b;
  border-color: #059669;
  color: #6ee7b7;
}

.requirement-unmet {
  background: #7f1d1d;
  border-color: #dc2626;
  color: #fca5a5;
}

.requirement-unknown {
  background: #374151;
  border-color: #6b7280;
  color: #d1d5db;
}

.requirement-neutral {
  background: #374151;
  border-color: #6b7280;
  color: #d1d5db;
}

/* Light mode overrides */
@media (prefers-color-scheme: light) {
  .requirement-met {
    background: rgba(34, 197, 94, 0.1);
    border-color: #16a34a;
    color: #059669;
  }

  .requirement-unmet {
    background: rgba(239, 68, 68, 0.1);
    border-color: #dc2626;
    color: #dc2626;
  }

  .requirement-unknown,
  .requirement-neutral {
    background: #f8fafc;
    border-color: #d1d5db;
    color: #4b5563;
  }
}

/* Type-specific styling */
.stat-requirement-chip .stat-name {
  font-weight: 500;
  color: inherit;
}

.stat-requirement-chip .operator {
  font-family: 'Courier New', monospace;
  font-weight: 600;
  font-size: 11px;
}

.stat-requirement-chip .value {
  font-weight: 600;
  color: inherit;
}

.logical-operator-chip {
  background: rgba(59, 130, 246, 0.1);
  border-color: #3b82f6;
  color: #93bbfc;
}

@media (prefers-color-scheme: light) {
  .logical-operator-chip {
    background: rgba(59, 130, 246, 0.1);
    border-color: #3b82f6;
    color: #1d4ed8;
  }
}

.state-requirement-chip {
  background: rgba(139, 92, 246, 0.1);
  border-color: #7c3aed;
  color: #c4b5fd;
}

@media (prefers-color-scheme: light) {
  .state-requirement-chip {
    background: rgba(139, 92, 246, 0.1);
    border-color: #7c3aed;
    color: #6d28d9;
  }
}

/* Status indicators with improved visibility */
.status {
  margin-left: 6px;
  font-size: 10px;
  font-family: 'Courier New', monospace;
  font-weight: 600;
  opacity: 0.9;
}

.status-met {
  color: #6ee7b7;
}

.status-unmet {
  color: #fca5a5;
}

.status-neutral {
  color: #9ca3af;
}

@media (prefers-color-scheme: light) {
  .status-met {
    color: #059669;
  }

  .status-unmet {
    color: #dc2626;
  }

  .status-neutral {
    color: #6b7280;
  }
}

/* Content layout improvements */
.stat-requirement,
.state-requirement,
.logical-operator,
.unknown-criterion {
  display: flex;
  align-items: center;
  gap: 2px;
}

.state-requirement i,
.logical-operator i {
  opacity: 0.8;
  margin-right: 4px;
}

/* Hover effects for better interaction */
.criterion-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.dark .criterion-chip:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* Focus states for accessibility */
.criterion-chip:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.criterion-chip:focus:not(:focus-visible) {
  outline: none;
}
</style>
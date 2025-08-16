<template>
  <div 
    class="criterion-chip"
    :class="chipClasses"
  >
    <!-- Stat Requirement -->
    <div v-if="criterion.isStatRequirement" class="stat-requirement">
      <span class="stat-name">{{ criterion.statName }}</span>
      <span class="operator">{{ criterion.displaySymbol }}</span>
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
import { getStatName, getProfessionName, getBreedName, getGenderName } from '../services/game-utils'

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
  
  // Special formatting for certain stats
  switch (props.criterion.stat) {
    case 60: // Profession
      const professionName = getProfessionName(value)
      return professionName || value.toString()
      
    case 4: // Breed
      const breedName = getBreedName(value)
      return breedName || value.toString()
      
    case 59: // Gender
      const genderName = getGenderName(value)
      return genderName || value.toString()
      
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

<style scoped>
.criterion-chip {
  @apply inline-flex items-center rounded-lg border transition-colors duration-200;
}

/* Size variants */
.size-small {
  @apply px-2 py-1 text-xs;
}

.size-normal {
  @apply px-3 py-1.5 text-sm;
}

.size-large {
  @apply px-4 py-2 text-base;
}

/* Status variants */
.requirement-met {
  @apply bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300;
}

.requirement-unmet {
  @apply bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300;
}

.requirement-unknown {
  @apply bg-surface-100 border-surface-300 text-surface-800 dark:bg-surface-800 dark:border-surface-600 dark:text-surface-200;
}

.requirement-neutral {
  @apply bg-surface-100 border-surface-300 text-surface-800 dark:bg-surface-800 dark:border-surface-600 dark:text-surface-200;
}

/* Type variants */
.stat-requirement-chip .stat-name {
  @apply font-medium;
}

.stat-requirement-chip .operator {
  @apply mx-1 font-mono;
}

.stat-requirement-chip .value {
  @apply font-semibold;
}

.logical-operator-chip {
  @apply bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300;
}

.state-requirement-chip {
  @apply bg-purple-100 border-purple-300 text-purple-800 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300;
}

/* Status indicators */
.status {
  @apply ml-2 text-xs font-mono;
}

.status-met {
  @apply text-green-600 dark:text-green-400;
}

.status-unmet {
  @apply text-red-600 dark:text-red-400;
}

.status-neutral {
  @apply text-surface-500 dark:text-surface-400;
}

/* Content styling */
.stat-requirement,
.state-requirement,
.logical-operator,
.unknown-criterion {
  @apply flex items-center;
}

.state-requirement i,
.logical-operator i {
  @apply text-current opacity-70;
}
</style>
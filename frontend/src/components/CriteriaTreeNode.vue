<template>
  <div class="tree-node" :class="nodeClasses">
    <!-- Tree connector lines -->
    <div v-if="showConnector" class="tree-connector" :class="connectorClasses"></div>
    
    <!-- Node content -->
    <div class="tree-content">
      <!-- Requirement Node -->
      <div v-if="node.type === 'requirement' && node.criterion" class="requirement-node">
        <div class="chip" :class="chipClasses">
          <span class="stat-name">{{ node.criterion.statName }}</span>
          <span class="operator">{{ node.criterion.displaySymbol }}</span>
          <span class="value">{{ formattedValue }}</span>
          <span v-if="showCurrentValue" class="current-value">({{ currentValue }})</span>
          <span class="status-icon">{{ statusIcon }}</span>
        </div>
      </div>
      
      <!-- Operator Node -->
      <div v-else-if="node.type === 'operator'" class="operator-node">
        <div class="operator-badge" :class="operatorClasses">
          <span class="operator-label">{{ operatorLabel }}</span>
          <span v-if="node.totalCount" class="operator-stats">
            {{ node.metCount }}/{{ node.totalCount }}
          </span>
        </div>
      </div>
      
      <!-- Group Node (implicit AND) -->
      <div v-else-if="node.type === 'group'" class="group-node">
        <div class="group-label" v-if="showGroupLabel">
          <span>All Required</span>
          <span v-if="node.totalCount" class="group-stats">
            ({{ node.metCount }}/{{ node.totalCount }} met)
          </span>
        </div>
      </div>
    </div>
    
    <!-- Children -->
    <div v-if="node.children && node.children.length > 0" class="tree-children">
      <CriteriaTreeNode
        v-for="(child, index) in node.children"
        :key="child.criterion?.id || `${child.type}-${index}`"
        :node="child"
        :character-stats="characterStats"
        :level="node.level + 1"
        :show-connector="node.level > 0"
        :show-group-label="false"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CriteriaTreeNode } from '../services/action-criteria'
import type { CharacterStats } from '../composables/useActionCriteria'
import { getStatName, getProfessionName, getBreedName, getGenderName, getFlagNameFromValue } from '../services/game-utils'

// ============================================================================
// Props
// ============================================================================

interface Props {
  node: CriteriaTreeNode
  characterStats?: CharacterStats | null
  level?: number
  showConnector?: boolean
  showGroupLabel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  level: 0,
  showConnector: true,
  showGroupLabel: true
})

// ============================================================================
// Computed Properties
// ============================================================================

const nodeClasses = computed(() => [
  'tree-node',
  `level-${props.node.level}`,
  {
    'is-last': props.node.isLast,
    'has-children': props.node.hasChildren,
    [`status-${props.node.status}`]: props.node.status
  }
])

const connectorClasses = computed(() => [
  'tree-connector',
  {
    'has-siblings': !props.node.isLast,
    'last-child': props.node.isLast
  }
])

const chipClasses = computed(() => {
  const classes = ['chip']
  
  if (props.node.status) {
    classes.push(`chip-${props.node.status}`)
  }
  
  return classes
})

const operatorClasses = computed(() => [
  'operator-badge',
  `operator-${props.node.operator?.toLowerCase()}`,
  {
    [`status-${props.node.status}`]: props.node.status
  }
])

const currentValue = computed(() => {
  if (!props.characterStats || !props.node.criterion) return 0
  return props.characterStats[props.node.criterion.stat] || 0
})

const showCurrentValue = computed(() => {
  return props.characterStats && 
         props.node.status === 'unmet' && 
         props.node.criterion?.isStatRequirement
})

const formattedValue = computed(() => {
  if (!props.node.criterion) return ''
  
  const value = props.node.criterion.displayValue
  const stat = props.node.criterion.stat
  const displaySymbol = props.node.criterion.displaySymbol
  
  // Handle flag operators - use resolved flag names
  if (displaySymbol === 'has' || displaySymbol === 'lacks') {
    return getFlagNameFromValue(stat, value)
  }
  
  // Special formatting for certain stats
  switch (stat) {
    case 60: // Profession
      return getProfessionName(value) || value.toString()
    case 4: // Breed  
      return getBreedName(value) || value.toString()
    case 59: // Gender
      return getGenderName(value) || value.toString()
    default:
      return value.toString()
  }
})

const statusIcon = computed(() => {
  switch (props.node.status) {
    case 'met':
      return '✓'
    case 'unmet':
      return '✗'
    case 'partial':
      return '◐'
    default:
      return '?'
  }
})

const operatorLabel = computed(() => {
  switch (props.node.operator) {
    case 'AND':
      return 'All Required'
    case 'OR':
      return 'Choose One'
    case 'NOT':
      return 'Must Not'
    default:
      return props.node.operator || 'Group'
  }
})
</script>

<style scoped>
.tree-node {
  position: relative;
  margin: 2px 0;
}

/* Tree connectors */
.tree-connector {
  position: absolute;
  left: 0;
  top: 0;
  width: 20px;
  height: 100%;
  pointer-events: none;
}

.tree-connector::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 18px;
  width: 12px;
  height: 1px;
  background: #4b5563;
}

.tree-connector.has-siblings::after {
  content: '';
  position: absolute;
  left: 8px;
  top: 18px;
  bottom: -2px;
  width: 1px;
  background: #4b5563;
}

.tree-connector.last-child::after {
  bottom: 18px;
}

/* Tree content */
.tree-content {
  padding-left: 24px;
  min-height: 36px;
  display: flex;
  align-items: center;
}

.tree-node.level-0 > .tree-content {
  padding-left: 0;
}

/* Requirement chips */
.chip {
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: 16px;
  font-size: 14px;
  border: 1px solid;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.chip-met {
  background: #064e3b;
  border-color: #10b981;
  color: #6ee7b7;
}

.chip-unmet {
  background: #7f1d1d;
  border-color: #ef4444;
  color: #fca5a5;
}

.chip-unknown {
  background: #1e293b;
  border-color: #475569;
  color: #cbd5e1;
}

.chip-partial {
  background: #78350f;
  border-color: #f59e0b;
  color: #fcd34d;
}

.chip .stat-name {
  font-weight: 500;
}

.chip .operator {
  margin: 0 4px;
  font-family: monospace;
  opacity: 0.9;
}

.chip .value {
  font-weight: 600;
}

.chip .current-value {
  margin-left: 4px;
  font-size: 12px;
  opacity: 0.8;
  font-family: monospace;
}

.chip .status-icon {
  margin-left: 6px;
  font-size: 12px;
  font-weight: bold;
}

/* Operator badges */
.operator-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: 1px solid;
}

.operator-and {
  background: #1e3a8a;
  color: #93bbfc;
  border-color: #2563eb;
}

.operator-or {
  background: #78350f;
  color: #fcd34d;
  border-color: #f59e0b;
}

.operator-not {
  background: #7c2d12;
  color: #fca5a5;
  border-color: #ef4444;
}

.operator-label {
  margin-right: 4px;
}

.operator-stats {
  font-size: 10px;
  opacity: 0.8;
}

/* Group labels */
.group-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.group-stats {
  font-size: 11px;
  font-weight: normal;
  opacity: 0.8;
}

/* Tree children */
.tree-children {
  position: relative;
  margin-left: 20px;
}

.tree-children::before {
  content: '';
  position: absolute;
  left: -12px;
  top: -18px;
  bottom: 18px;
  width: 1px;
  background: #4b5563;
}

.tree-node.is-last .tree-children::before {
  display: none;
}

/* Hover effects */
.chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.operator-badge:hover {
  opacity: 0.9;
}

/* Status variants for nodes */
.tree-node.status-met {
  /* Add subtle success indicator if needed */
}

.tree-node.status-unmet {
  /* Add subtle error indicator if needed */
}

.tree-node.status-partial {
  /* Add subtle warning indicator if needed */
}

/* Dark mode optimizations */
@media (prefers-color-scheme: dark) {
  .tree-connector::before,
  .tree-connector::after,
  .tree-children::before {
    background: #374151;
  }
  
  .chip {
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }
}

/* Mobile responsive */
@media (max-width: 640px) {
  .tree-content {
    padding-left: 20px;
  }
  
  .tree-children {
    margin-left: 16px;
  }
  
  .chip {
    padding: 4px 10px;
    font-size: 13px;
  }
  
  .operator-badge {
    padding: 3px 8px;
    font-size: 11px;
  }
}
</style>
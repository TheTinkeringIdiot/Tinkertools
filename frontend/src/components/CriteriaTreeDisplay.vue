<template>
  <div class="criteria-tree-display">
    <!-- No Requirements -->
    <div v-if="!tree" class="no-requirements">
      <span class="text-muted text-sm">No requirements</span>
    </div>
    
    <!-- Tree Display -->
    <div v-else class="tree-container">
      <!-- Summary Header -->
      <div v-if="showSummary && tree.totalCount && tree.totalCount > 1" class="summary-header">
        <div class="summary-title">
          <span class="title-text">Requirements</span>
          <span v-if="tree.totalCount" class="requirement-count">
            ({{ tree.totalCount }})
          </span>
        </div>
        <div class="summary-status">
          <div 
            v-if="tree.metCount !== undefined && tree.totalCount" 
            class="status-badges"
          >
            <span v-if="tree.metCount > 0" class="status-badge met">
              {{ tree.metCount }} met
            </span>
            <span v-if="tree.totalCount - tree.metCount > 0" class="status-badge unmet">
              {{ tree.totalCount - tree.metCount }} unmet
            </span>
          </div>
          <div class="overall-status" :class="overallStatusClass">
            {{ overallStatusText }}
          </div>
        </div>
      </div>
      
      <!-- Tree Content -->
      <div class="tree-content" :class="{ 'with-summary': showSummary && tree.totalCount && tree.totalCount > 1 }">
        <CriteriaTreeNode
          :node="tree"
          :character-stats="characterStats"
          :show-connector="false"
          :show-group-label="!showSummary"
        />
      </div>
      
      <!-- Character Evaluation (if enabled) -->
      <div v-if="showEvaluation && characterStats && hasUnmetRequirements" class="evaluation-section">
        <div class="divider"></div>
        <div class="evaluation-header">
          <span class="evaluation-title">Missing Requirements</span>
        </div>
        <div class="unmet-list">
          <div 
            v-for="requirement in unmetRequirements" 
            :key="requirement.stat"
            class="unmet-item"
          >
            <span class="stat-name">{{ requirement.statName }}</span>
            <span class="requirement-gap">
              {{ requirement.current }}/{{ requirement.required }}
              <span class="shortfall">(need {{ requirement.required - requirement.current }} more)</span>
            </span>
          </div>
        </div>
      </div>
      
      <!-- Expandable Details (for mobile/compact) -->
      <div v-if="collapsible && isCollapsed" class="collapsed-view">
        <button @click="toggleExpanded" class="expand-button">
          <span>{{ collapsedSummary }}</span>
          <i class="pi pi-chevron-down" :class="{ 'expanded': !isCollapsed }"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import CriteriaTreeNode from './CriteriaTreeNode.vue'
import { buildCriteriaTree, getTreeSummary } from '../services/action-criteria'
import type { Criterion } from '../types/api'
import type { CharacterStats } from '../composables/useActionCriteria'
import type { CriteriaTreeNode as TreeNode } from '../services/action-criteria'

// ============================================================================
// Props
// ============================================================================

interface Props {
  criteria: Criterion[]
  characterStats?: CharacterStats | null
  showSummary?: boolean
  showEvaluation?: boolean
  collapsible?: boolean
  defaultCollapsed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showSummary: true,
  showEvaluation: true,
  collapsible: false,
  defaultCollapsed: false
})

// ============================================================================
// Local State
// ============================================================================

const isCollapsed = ref(props.defaultCollapsed)

// ============================================================================
// Computed Properties
// ============================================================================

const tree = computed<TreeNode | null>(() => {
  return buildCriteriaTree(props.criteria, props.characterStats || undefined)
})

const overallStatusClass = computed(() => {
  if (!tree.value) return ''
  
  switch (tree.value.status) {
    case 'met':
      return 'status-met'
    case 'unmet':
      return 'status-unmet'
    case 'partial':
      return 'status-partial'
    default:
      return 'status-unknown'
  }
})

const overallStatusText = computed(() => {
  if (!tree.value || !props.characterStats) return 'Unknown'
  
  switch (tree.value.status) {
    case 'met':
      return 'All requirements met'
    case 'unmet':
      return 'Requirements not met'
    case 'partial':
      return 'Some requirements met'
    default:
      return 'Unable to evaluate'
  }
})

const unmetRequirements = computed(() => {
  if (!tree.value || !props.characterStats) return []
  
  const requirements: Array<{
    stat: number
    statName: string
    required: number
    current: number
  }> = []
  
  function collectUnmetRequirements(node: TreeNode) {
    if (node.type === 'requirement' && node.status === 'unmet' && node.criterion) {
      const current = props.characterStats![node.criterion.stat] || 0
      requirements.push({
        stat: node.criterion.stat,
        statName: node.criterion.statName,
        required: node.criterion.displayValue,
        current
      })
    }
    
    if (node.children) {
      node.children.forEach(collectUnmetRequirements)
    }
  }
  
  collectUnmetRequirements(tree.value)
  return requirements
})

const hasUnmetRequirements = computed(() => {
  return unmetRequirements.value.length > 0
})

const collapsedSummary = computed(() => {
  return getTreeSummary(tree.value)
})

// ============================================================================
// Methods
// ============================================================================

function toggleExpanded() {
  isCollapsed.value = !isCollapsed.value
}
</script>

<style scoped>
.criteria-tree-display {
  width: 100%;
}

.no-requirements {
  padding: 12px;
  text-align: center;
}

.text-muted {
  color: #6b7280;
}

/* Tree container */
.tree-container {
  background: #1f2937;
  border-radius: 8px;
  overflow: hidden;
}

/* Summary header */
.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #111827;
  border-bottom: 1px solid #374151;
}

.summary-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-text {
  font-weight: 600;
  color: #93c5fd;
  font-size: 15px;
}

.requirement-count {
  font-size: 13px;
  color: #6b7280;
}

.summary-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-badges {
  display: flex;
  gap: 8px;
}

.status-badge {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.met {
  background: #064e3b;
  color: #6ee7b7;
}

.status-badge.unmet {
  background: #7f1d1d;
  color: #fca5a5;
}

.overall-status {
  font-size: 13px;
  font-weight: 500;
}

.status-met {
  color: #10b981;
}

.status-unmet {
  color: #ef4444;
}

.status-partial {
  color: #f59e0b;
}

.status-unknown {
  color: #6b7280;
}

/* Tree content */
.tree-content {
  padding: 16px 20px;
}

.tree-content.with-summary {
  /* Additional padding when header is present */
}

/* Evaluation section */
.evaluation-section {
  background: #111827;
  padding: 16px 20px;
}

.divider {
  height: 1px;
  background: #374151;
  margin: 0 -20px 16px;
}

.evaluation-header {
  margin-bottom: 12px;
}

.evaluation-title {
  font-size: 13px;
  font-weight: 600;
  color: #ef4444;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.unmet-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.unmet-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #7f1d1d;
  border-radius: 6px;
  border: 1px solid #ef4444;
}

.stat-name {
  font-weight: 500;
  color: #fca5a5;
}

.requirement-gap {
  font-family: monospace;
  font-size: 13px;
  color: #fca5a5;
}

.shortfall {
  margin-left: 8px;
  font-size: 12px;
  opacity: 0.8;
}

/* Collapsible view */
.collapsed-view {
  padding: 16px 20px;
}

.expand-button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 12px 16px;
  background: #374151;
  border: none;
  border-radius: 6px;
  color: #e5e7eb;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.expand-button:hover {
  background: #4b5563;
}

.expand-button i {
  transition: transform 0.2s;
}

.expand-button i.expanded {
  transform: rotate(180deg);
}

/* Responsive design */
@media (max-width: 640px) {
  .summary-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 12px 16px;
  }
  
  .summary-status {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .status-badges {
    gap: 6px;
  }
  
  .tree-content,
  .evaluation-section,
  .collapsed-view {
    padding: 12px 16px;
  }
  
  .unmet-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  
  .requirement-gap {
    font-size: 12px;
  }
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .tree-container {
    background: #1f2937;
  }
  
  .summary-header,
  .evaluation-section {
    background: #111827;
  }
}

/* Animation for expand/collapse */
.tree-content {
  transition: max-height 0.3s ease;
  overflow: hidden;
}

/* Focus states for accessibility */
.expand-button:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.expand-button:focus:not(:focus-visible) {
  outline: none;
}
</style>
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
          <span v-if="tree.totalCount" class="requirement-count"> ({{ tree.totalCount }}) </span>
        </div>
        <div class="summary-status">
          <div v-if="tree.metCount !== undefined && tree.totalCount" class="status-badges">
            <span v-if="tree.metCount > 0" class="status-badge met"> {{ tree.metCount }} met </span>
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
      <div
        class="tree-content"
        :class="{ 'with-summary': showSummary && tree.totalCount && tree.totalCount > 1 }"
      >
        <CriteriaTreeNode
          :node="tree"
          :character-stats="characterStats"
          :show-connector="false"
          :show-group-label="true"
        />
      </div>

      <!-- Character Evaluation (if enabled) -->
      <div
        v-if="showEvaluation && characterStats && hasUnmetRequirements"
        class="evaluation-section"
      >
        <div class="divider"></div>
        <div class="evaluation-header">
          <span class="evaluation-title">Missing Requirements</span>
        </div>
        <div class="unmet-list">
          <div v-for="requirement in unmetRequirements" :key="requirement.stat" class="unmet-item">
            <span class="stat-name">{{ requirement.statName }}</span>
            <span class="requirement-gap">
              {{ requirement.current }}/{{ requirement.required }}
              <span class="shortfall"
                >(need {{ requirement.required - requirement.current }} more)</span
              >
            </span>
          </div>
        </div>
      </div>

      <!-- Expandable Details (for mobile/compact) -->
      <div v-if="collapsible && isCollapsed" class="collapsed-view">
        <button @click="toggleExpanded" class="expand-button">
          <span>{{ collapsedSummary }}</span>
          <i class="pi pi-chevron-down" :class="{ expanded: !isCollapsed }"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import CriteriaTreeNode from './CriteriaTreeNode.vue';
import { buildCriteriaTree, getTreeSummary } from '../services/action-criteria';
import type { Criterion } from '../types/api';
import type { CharacterStats } from '../composables/useActionCriteria';
import type { CriteriaTreeNode as TreeNode } from '../services/action-criteria';

// ============================================================================
// Props
// ============================================================================

interface Props {
  criteria: Criterion[];
  characterStats?: CharacterStats | null;
  showSummary?: boolean;
  showEvaluation?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showSummary: true,
  showEvaluation: true,
  collapsible: false,
  defaultCollapsed: false,
});

// ============================================================================
// Local State
// ============================================================================

const isCollapsed = ref(props.defaultCollapsed);

// ============================================================================
// Computed Properties
// ============================================================================

const tree = computed<TreeNode | null>(() => {
  return buildCriteriaTree(props.criteria, props.characterStats || undefined);
});

const overallStatusClass = computed(() => {
  if (!tree.value) return '';

  switch (tree.value.status) {
    case 'met':
      return 'status-met';
    case 'unmet':
      return 'status-unmet';
    case 'partial':
      return 'status-partial';
    default:
      return 'status-unknown';
  }
});

const overallStatusText = computed(() => {
  if (!tree.value || !props.characterStats) return 'Unknown';

  switch (tree.value.status) {
    case 'met':
      return 'All requirements met';
    case 'unmet':
      return 'Requirements not met';
    case 'partial':
      return 'Some requirements met';
    default:
      return 'Unable to evaluate';
  }
});

const unmetRequirements = computed(() => {
  if (!tree.value || !props.characterStats) return [];

  const requirements: Array<{
    stat: number;
    statName: string;
    required: number;
    current: number;
  }> = [];

  function collectUnmetRequirements(node: TreeNode) {
    if (node.type === 'requirement' && node.status === 'unmet' && node.criterion) {
      const current = props.characterStats![node.criterion.stat] || 0;
      requirements.push({
        stat: node.criterion.stat,
        statName: node.criterion.statName,
        required: node.criterion.displayValue,
        current,
      });
    }

    if (node.children) {
      node.children.forEach(collectUnmetRequirements);
    }
  }

  collectUnmetRequirements(tree.value);
  return requirements;
});

const hasUnmetRequirements = computed(() => {
  return unmetRequirements.value.length > 0;
});

const collapsedSummary = computed(() => {
  return getTreeSummary(tree.value);
});

// ============================================================================
// Methods
// ============================================================================

function toggleExpanded() {
  isCollapsed.value = !isCollapsed.value;
}
</script>

<style>
/* Component styling matching WeaponStats aesthetic */
.criteria-tree-display {
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.no-requirements {
  padding: 12px;
  text-align: center;
  color: #6b7280;
}

/* Tree container with Card-style appearance */
.tree-container {
  background: #f8fafc;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  overflow: hidden;
}

.dark .tree-container {
  background: #0c0a09 !important;
  border-color: #374151 !important;
}

/* Header with WeaponStats-inspired design */
.summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 6px;
  background: #e5e7eb;
  border-bottom: 1px solid #d1d5db;
}

.dark .summary-header {
  background: #374151 !important;
  border-bottom-color: #4b5563 !important;
}

.summary-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-text {
  font-weight: 600;
  color: #1f2937;
  font-size: 16px;
}

.dark .title-text {
  color: #e5e7eb !important;
}

.requirement-count {
  font-size: 13px;
  color: #6b7280;
}

.dark .requirement-count {
  color: #9ca3af !important;
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

/* Enhanced status badges with pill styling */
.status-badge {
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border: 1px solid;
}

.status-badge.met {
  background: linear-gradient(135deg, #059669, #10b981);
  border-color: #059669;
  color: white;
}

.status-badge.unmet {
  background: linear-gradient(135deg, #dc2626, #ef4444);
  border-color: #dc2626;
  color: white;
}

.overall-status {
  font-size: 13px;
  font-weight: 600;
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

/* Tree content with improved spacing */
.tree-content {
  padding: 6px;
  background: #f8fafc;
}

.dark .tree-content {
  background: #0c0a09 !important;
  color: #e5e7eb !important;
}

.tree-content.with-summary {
  border-top: 1px solid #e5e7eb;
}

.dark .tree-content.with-summary {
  border-top-color: #374151 !important;
}

/* Evaluation section with cleaner design */
.evaluation-section {
  background: #f3f4f6;
  padding: 5px 6px;
  border-top: 1px solid #d1d5db;
}

.dark .evaluation-section {
  background: #111827 !important;
  border-top-color: #374151 !important;
}

.divider {
  height: 1px;
  background: #d1d5db;
  margin: 0 -16px 16px;
}

.dark .divider {
  background: #374151 !important;
}

.evaluation-header {
  margin-bottom: 12px;
}

.evaluation-title {
  font-size: 12px;
  font-weight: 600;
  color: #ef4444;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Improved unmet requirements list */
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
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid #dc2626;
  border-radius: 6px;
}

.dark .unmet-item {
  background: #7f1d1d !important;
}

.stat-name {
  font-weight: 500;
  color: #dc2626;
}

.dark .stat-name {
  color: #fca5a5 !important;
}

.requirement-gap {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  font-weight: 600;
  color: #dc2626;
}

.dark .requirement-gap {
  color: #fca5a5 !important;
}

.shortfall {
  margin-left: 6px;
  font-size: 11px;
  opacity: 0.8;
}

/* Enhanced collapsible view */
.collapsed-view {
  padding: 6px;
}

.expand-button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 12px 16px;
  background: #e5e7eb;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  color: #374151;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dark .expand-button {
  background: #374151 !important;
  border-color: #4b5563 !important;
  color: #e5e7eb !important;
}

.expand-button:hover {
  background: #d1d5db;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.dark .expand-button:hover {
  background: #4b5563 !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3) !important;
}

.expand-button i {
  transition: transform 0.2s ease;
  opacity: 0.7;
}

.expand-button i.expanded {
  transform: rotate(180deg);
}

/* Light mode specific adjustments */
@media (prefers-color-scheme: light) {
  .tree-container {
    background: #ffffff;
    border-color: #e5e7eb;
  }

  .summary-header {
    background: #f9fafb;
    border-bottom-color: #e5e7eb;
  }

  .title-text {
    color: #111827;
  }

  .tree-content {
    background: #ffffff;
  }

  .evaluation-section {
    background: #f9fafb;
    border-top-color: #e5e7eb;
  }
}

/* Responsive design improvements */
@media (max-width: 640px) {
  .summary-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    padding: 4px 5px;
  }

  .summary-status {
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    width: 100%;
  }

  .status-badges {
    gap: 2px;
    flex-wrap: wrap;
  }

  .tree-content,
  .evaluation-section,
  .collapsed-view {
    padding: 4px 5px;
  }

  .unmet-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
  }

  .requirement-gap {
    font-size: 11px;
  }
}

/* Focus states for accessibility */
.expand-button:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.expand-button:focus:not(:focus-visible) {
  outline: none;
}

/* Animation improvements */
.tree-content {
  transition: all 0.3s ease;
}

.status-badge {
  transition: all 0.2s ease;
}

.status-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}
</style>

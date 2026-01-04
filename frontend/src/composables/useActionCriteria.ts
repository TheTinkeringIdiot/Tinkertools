/**
 * Vue Composable for Action and Criteria Display
 *
 * Provides reactive utilities for Vue components to display and evaluate
 * action requirements and criteria in an intuitive format.
 */

import { computed, ref, type Ref } from 'vue';
import {
  parseAction,
  transformCriterionForDisplay,
  parseCriteriaExpression,
  getCriteriaRequirements,
  checkActionRequirements,
  formatCriteriaText,
  buildCriteriaTree,
  shouldUseTreeDisplay,
  getTreeSummary,
  type ParsedAction,
  type DisplayCriterion,
  type CriteriaExpression,
  type CriteriaTreeNode,
} from '../services/action-criteria';
import type { Action, Criterion } from '../types/api';

// ============================================================================
// Action Display Composable
// ============================================================================

/**
 * Composable for displaying actions with transformed criteria
 */
export function useActionDisplay(actions: Ref<Action[]>) {
  const parsedActions = computed(() => {
    return actions.value.map(parseAction);
  });

  const actionsWithRequirements = computed(() => {
    return parsedActions.value.filter((action) => action.hasRequirements);
  });

  const simpleActions = computed(() => {
    return parsedActions.value.filter((action) => !action.hasRequirements);
  });

  /**
   * Get formatted action names
   */
  const getActionNames = computed(() => {
    return parsedActions.value.map((action) => action.actionName);
  });

  /**
   * Get primary action (usually first action or "Wield")
   */
  const primaryAction = computed(() => {
    // Look for Wield action first
    const wieldAction = parsedActions.value.find(
      (action) => action.actionName === 'Wield' || action.actionName === 'Wear'
    );
    if (wieldAction) return wieldAction;

    // Otherwise return first action with requirements
    const actionWithReqs = actionsWithRequirements.value[0];
    if (actionWithReqs) return actionWithReqs;

    // Fallback to first action
    return parsedActions.value[0] || null;
  });

  return {
    parsedActions,
    actionsWithRequirements,
    simpleActions,
    getActionNames,
    primaryAction,
  };
}

// ============================================================================
// Criteria Display Composable
// ============================================================================

/**
 * Composable for displaying criteria with intuitive transformations
 */
export function useCriteriaDisplay(criteria: Ref<Criterion[]>) {
  const displayCriteria = computed(() => {
    return criteria.value.map(transformCriterionForDisplay);
  });

  const statRequirements = computed(() => {
    return displayCriteria.value.filter(
      (criterion) => criterion.isStatRequirement || criterion.isFunctionOperator
    );
  });

  const logicalOperators = computed(() => {
    return displayCriteria.value.filter((criterion) => criterion.isLogicalOperator);
  });

  const expression = computed(() => {
    return parseCriteriaExpression(criteria.value);
  });

  const formattedText = computed(() => {
    return expression.value ? formatCriteriaText(expression.value) : '';
  });

  const requirements = computed(() => {
    return getCriteriaRequirements(criteria.value);
  });

  /**
   * Get simplified requirements text
   */
  const simplifiedText = computed(() => {
    const reqs = statRequirements.value;
    if (reqs.length === 0) return 'No requirements';
    if (reqs.length === 1) return reqs[0].description;

    // For multiple requirements, show count
    return `${reqs.length} requirements`;
  });

  /**
   * Get requirements grouped by stat
   */
  const groupedRequirements = computed(() => {
    const groups = new Map<number, DisplayCriterion[]>();

    for (const criterion of statRequirements.value) {
      const existing = groups.get(criterion.stat) || [];
      existing.push(criterion);
      groups.set(criterion.stat, existing);
    }

    return Array.from(groups.entries()).map(([stat, criteria]) => ({
      stat,
      statName: criteria[0].statName,
      criteria,
    }));
  });

  return {
    displayCriteria,
    statRequirements,
    logicalOperators,
    expression,
    formattedText,
    requirements,
    simplifiedText,
    groupedRequirements,
  };
}

// ============================================================================
// Character Evaluation Composable
// ============================================================================

/**
 * Character stats type for evaluation
 */
export interface CharacterStats {
  [statId: number]: number;
}

/**
 * Composable for evaluating criteria against character stats
 */
export function useCriteriaEvaluation(
  actions: Ref<Action[]>,
  characterStats: Ref<CharacterStats | null>
) {
  const { parsedActions } = useActionDisplay(actions);

  /**
   * Check if character can perform each action
   */
  const actionEvaluations = computed(() => {
    if (!characterStats.value) {
      return parsedActions.value.map((action) => ({
        action,
        canPerform: null,
        unmetRequirements: [],
      }));
    }

    return parsedActions.value.map((action) => {
      const result = checkActionRequirements(action, characterStats.value!);
      return {
        action,
        canPerform: result.canPerform,
        unmetRequirements: result.unmetRequirements,
      };
    });
  });

  /**
   * Get primary action evaluation
   */
  const primaryActionEvaluation = computed(() => {
    const primary =
      parsedActions.value.find(
        (action) => action.actionName === 'Wield' || action.actionName === 'Wear'
      ) || parsedActions.value[0];

    if (!primary || !characterStats.value) return null;

    return checkActionRequirements(primary, characterStats.value);
  });

  /**
   * Check if character can use the item (any action)
   */
  const canUseItem = computed(() => {
    if (!characterStats.value) return null;

    return actionEvaluations.value.some((evaluation) => evaluation.canPerform === true);
  });

  /**
   * Get all unmet requirements across all actions
   */
  const allUnmetRequirements = computed(() => {
    const unmet = new Map<number, any>();

    for (const evaluation of actionEvaluations.value) {
      for (const req of evaluation.unmetRequirements) {
        if (!unmet.has(req.stat)) {
          unmet.set(req.stat, req);
        }
      }
    }

    return Array.from(unmet.values());
  });

  /**
   * Get minimum requirements to use the item
   */
  const minimumRequirements = computed(() => {
    const requirements = new Map<
      number,
      {
        stat: number;
        statName: string;
        minValue: number;
        currentValue: number;
        shortfall: number;
      }
    >();

    if (!characterStats.value) return [];

    for (const action of parsedActions.value) {
      for (const criterion of action.criteria) {
        if (!criterion.isStatRequirement) continue;

        const currentValue = characterStats.value[criterion.stat] || 0;
        let requiredValue = criterion.displayValue;

        // Only consider "greater than or equal" requirements for minimums
        if (criterion.displaySymbol === '≥') {
          const existing = requirements.get(criterion.stat);
          if (!existing || requiredValue > existing.minValue) {
            requirements.set(criterion.stat, {
              stat: criterion.stat,
              statName: criterion.statName,
              minValue: requiredValue,
              currentValue,
              shortfall: Math.max(0, requiredValue - currentValue),
            });
          }
        }
      }
    }

    return Array.from(requirements.values())
      .filter((req) => req.shortfall > 0)
      .sort((a, b) => b.shortfall - a.shortfall);
  });

  return {
    actionEvaluations,
    primaryActionEvaluation,
    canUseItem,
    allUnmetRequirements,
    minimumRequirements,
  };
}

// ============================================================================
// Combined Item Action Composable
// ============================================================================

/**
 * Complete composable for item action/criteria display and evaluation
 */
export function useItemActions(
  actions: Ref<Action[]>,
  characterStats: Ref<CharacterStats | null> = ref(null)
) {
  const actionDisplay = useActionDisplay(actions);
  const evaluation = useCriteriaEvaluation(actions, characterStats);

  /**
   * Get display color for requirement status
   */
  const getRequirementColor = (canPerform: boolean | null) => {
    if (canPerform === null) return 'gray';
    return canPerform ? 'green' : 'red';
  };

  /**
   * Get requirement severity class
   */
  const getRequirementSeverity = (canPerform: boolean | null) => {
    if (canPerform === null) return 'secondary';
    return canPerform ? 'success' : 'danger';
  };

  /**
   * Format requirement shortfall
   */
  const formatShortfall = (required: number, current: number) => {
    const shortfall = required - current;
    if (shortfall <= 0) return '';
    return `(need ${shortfall} more)`;
  };

  return {
    // Action display
    ...actionDisplay,

    // Evaluation
    ...evaluation,

    // Utility functions
    getRequirementColor,
    getRequirementSeverity,
    formatShortfall,
  };
}

// ============================================================================
// Utility Functions for Templates
// ============================================================================

/**
 * Helper to get criteria display for a single action
 */
export function useActionCriteria(action: Ref<Action>) {
  const criteria = computed(() => action.value.criteria);
  return useCriteriaDisplay(criteria);
}

/**
 * Helper to check if an action has any stat requirements
 */
export function hasStatRequirements(action: Action): boolean {
  return action.criteria.some((criterion) => {
    const display = transformCriterionForDisplay(criterion);
    return display.isStatRequirement;
  });
}

/**
 * Helper to get the most restrictive requirement for a stat
 */
export function getMostRestrictiveRequirement(
  criteria: Criterion[],
  statId: number
): DisplayCriterion | null {
  const requirements = criteria
    .map(transformCriterionForDisplay)
    .filter((c) => c.stat === statId && c.isStatRequirement);

  if (requirements.length === 0) return null;

  // For "greater than or equal" requirements, return the highest
  const minRequirements = requirements.filter((r) => r.displaySymbol === '≥');
  if (minRequirements.length > 0) {
    return minRequirements.reduce((highest, current) =>
      current.displayValue > highest.displayValue ? current : highest
    );
  }

  // For other requirements, return the first one
  return requirements[0];
}

/**
 * Helper to format a requirement for display
 */
export function formatRequirement(criterion: DisplayCriterion): string {
  return criterion.description;
}

/**
 * Helper to check if a requirement is met
 */
export function isRequirementMet(
  criterion: DisplayCriterion,
  characterStats: CharacterStats
): boolean | null {
  if (!criterion.isStatRequirement) return null;

  const currentValue = characterStats[criterion.stat] || 0;

  switch (criterion.displaySymbol) {
    case '=':
      return currentValue === criterion.displayValue;
    case '≤':
      return currentValue <= criterion.displayValue;
    case '≥':
      return currentValue >= criterion.displayValue;
    case '≠':
      return currentValue !== criterion.displayValue;
    case 'has':
      return (currentValue & criterion.displayValue) === criterion.displayValue;
    case 'lacks':
      return (currentValue & criterion.displayValue) === 0;
    default:
      return null;
  }
}

// ============================================================================
// Tree Display Composables
// ============================================================================

/**
 * Composable for tree-based criteria display
 */
export function useCriteriaTree(
  criteria: Ref<Criterion[]>,
  characterStats: Ref<CharacterStats | null> = ref(null)
) {
  const tree = computed(() => {
    return buildCriteriaTree(criteria.value, characterStats.value || undefined);
  });

  const shouldUseTree = computed(() => {
    return shouldUseTreeDisplay(criteria.value);
  });

  const treeSummary = computed(() => {
    return getTreeSummary(tree.value);
  });

  const treeStats = computed(() => {
    if (!tree.value) return { met: 0, total: 0, partial: 0 };

    const { metCount = 0, totalCount = 0 } = tree.value;
    return {
      met: metCount,
      total: totalCount,
      partial: totalCount - metCount,
      percentage: totalCount > 0 ? Math.round((metCount / totalCount) * 100) : 0,
    };
  });

  const overallStatus = computed(() => {
    if (!tree.value || !characterStats.value) return 'unknown';
    return tree.value.status || 'unknown';
  });

  return {
    tree,
    shouldUseTree,
    treeSummary,
    treeStats,
    overallStatus,
  };
}

/**
 * Composable for tree navigation and interaction
 */
export function useTreeNavigation() {
  const expandedNodes = ref<Set<string>>(new Set());
  const focusedNodeId = ref<string | null>(null);

  function toggleNode(nodeId: string) {
    if (expandedNodes.value.has(nodeId)) {
      expandedNodes.value.delete(nodeId);
    } else {
      expandedNodes.value.add(nodeId);
    }
  }

  function expandAll() {
    // Implementation would depend on having access to all node IDs
    // This is a placeholder for the interface
  }

  function collapseAll() {
    expandedNodes.value.clear();
  }

  function isExpanded(nodeId: string): boolean {
    return expandedNodes.value.has(nodeId);
  }

  function focusNode(nodeId: string) {
    focusedNodeId.value = nodeId;
  }

  function clearFocus() {
    focusedNodeId.value = null;
  }

  return {
    expandedNodes: computed(() => Array.from(expandedNodes.value)),
    focusedNodeId: computed(() => focusedNodeId.value),
    toggleNode,
    expandAll,
    collapseAll,
    isExpanded,
    focusNode,
    clearFocus,
  };
}

/**
 * Enhanced criteria display with tree capabilities
 */
export function useEnhancedCriteriaDisplay(
  criteria: Ref<Criterion[]>,
  characterStats: Ref<CharacterStats | null> = ref(null)
) {
  // Get basic criteria display
  const basicDisplay = useCriteriaDisplay(criteria);

  // Get tree capabilities
  const treeDisplay = useCriteriaTree(criteria, characterStats);

  // Get navigation
  const navigation = useTreeNavigation();

  // Combined display mode decision
  const displayMode = computed(() => {
    if (treeDisplay.shouldUseTree.value) {
      return 'tree';
    } else if (basicDisplay.statRequirements.value.length <= 2) {
      return 'simple';
    } else {
      return 'compact';
    }
  });

  // Combined requirements info
  const requirementsInfo = computed(() => {
    const basic = basicDisplay.statRequirements.value;
    const tree = treeDisplay.treeStats.value;

    return {
      hasRequirements: basic.length > 0,
      count: basic.length,
      metCount: tree.met,
      totalCount: tree.total,
      percentage: tree.percentage,
      summary: treeDisplay.treeSummary.value,
      allMet: tree.met === tree.total && tree.total > 0,
      noneMet: tree.met === 0 && tree.total > 0,
      partiallyMet: tree.met > 0 && tree.met < tree.total,
    };
  });

  return {
    // Basic display
    ...basicDisplay,

    // Tree display
    ...treeDisplay,

    // Navigation
    ...navigation,

    // Combined properties
    displayMode,
    requirementsInfo,
  };
}

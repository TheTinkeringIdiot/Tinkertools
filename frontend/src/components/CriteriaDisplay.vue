<template>
  <div class="criteria-display">
    <!-- Tree Display Mode (default for complex criteria) -->
    <CriteriaTreeDisplay
      v-if="useTreeDisplay"
      :criteria="criteria"
      :character-stats="characterStats"
      :show-summary="expanded"
      :show-evaluation="expanded"
      :collapsible="!expanded"
      :default-collapsed="!expanded"
    />

    <!-- Simple Chip Display (for basic requirements) -->
    <div v-else-if="!expanded && statRequirements.length <= 2" class="simple-view">
      <div class="flex flex-wrap gap-2">
        <CriterionChip
          v-for="criterion in statRequirements"
          :key="criterion.id"
          :criterion="criterion"
          :character-stats="characterStats"
          size="small"
        />
      </div>
    </div>

    <!-- Compact View with Toggle -->
    <div v-else-if="!expanded" class="compact-view">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">
          {{ statRequirements.length }} requirement{{ statRequirements.length !== 1 ? 's' : '' }}
        </span>
        <Button text size="small" @click="showExpanded = !showExpanded" class="text-xs">
          {{ showExpanded ? 'Hide' : 'Show' }}
        </Button>
      </div>

      <!-- Expandable Chip Details -->
      <Transition name="slide-down">
        <div v-if="showExpanded" class="mt-2 space-y-2">
          <CriterionChip
            v-for="criterion in statRequirements"
            :key="criterion.id"
            :criterion="criterion"
            :character-stats="characterStats"
            size="small"
          />
        </div>
      </Transition>
    </div>

    <!-- Fallback: Legacy Expanded View -->
    <div v-else-if="!useTreeDisplay" class="legacy-expanded-view space-y-3">
      <div class="text-sm font-medium mb-2">Requirements:</div>
      <div class="space-y-2">
        <CriterionChip
          v-for="criterion in statRequirements"
          :key="criterion.id"
          :criterion="criterion"
          :character-stats="characterStats"
          size="normal"
        />
      </div>

      <!-- Character Evaluation Summary -->
      <div v-if="characterStats && statRequirements.length > 0" class="evaluation-summary">
        <Divider />
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">Your Character:</span>
          <Tag
            :severity="allRequirementsMet ? 'success' : 'danger'"
            :value="allRequirementsMet ? 'Meets Requirements' : 'Missing Requirements'"
          />
        </div>

        <!-- Unmet Requirements -->
        <div v-if="!allRequirementsMet && unmetRequirements.length > 0" class="mt-2">
          <div class="text-xs text-muted mb-1">Missing:</div>
          <div class="space-y-1">
            <div
              v-for="req in unmetRequirements"
              :key="`unmet-${req.stat}`"
              class="flex justify-between text-xs text-danger"
            >
              <span>{{ req.statName }}</span>
              <span class="font-mono">
                {{ req.current }}/{{ req.required }} (need {{ req.required - req.current }} more)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- No Requirements -->
    <div v-else-if="!criteria || criteria.length === 0" class="no-requirements">
      <span class="text-muted text-sm">No requirements</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Button from 'primevue/button';
import Tag from 'primevue/tag';
import Divider from 'primevue/divider';
import CriterionChip from './CriterionChip.vue';
import CriteriaTreeDisplay from './CriteriaTreeDisplay.vue';
import { useCriteriaDisplay } from '../composables/useActionCriteria';
import { shouldUseTreeDisplay } from '../services/action-criteria';
import type { Criterion } from '../types/api';
import type { CharacterStats } from '../composables/useActionCriteria';

// ============================================================================
// Props
// ============================================================================

interface Props {
  criteria: Criterion[];
  characterStats?: CharacterStats | null;
  expanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  characterStats: null,
  expanded: false,
});

// ============================================================================
// Local State
// ============================================================================

const showExpanded = ref(false);

// ============================================================================
// Composables
// ============================================================================

const criteriaRef = computed(() => props.criteria);

const {
  displayCriteria,
  statRequirements,
  logicalOperators,
  expression,
  formattedText,
  groupedRequirements,
} = useCriteriaDisplay(criteriaRef);

// ============================================================================
// Computed Properties
// ============================================================================

const useTreeDisplay = computed(() => {
  return shouldUseTreeDisplay(props.criteria);
});

const stateRequirements = computed(() => {
  return displayCriteria.value.filter(
    (c) => !c.isStatRequirement && !c.isLogicalOperator && !c.isSeparator
  );
});

const hasLogicalOperators = computed(() => {
  return logicalOperators.value.length > 0;
});

const allRequirementsMet = computed(() => {
  if (!props.characterStats) return null;

  return statRequirements.value.every((criterion) => {
    const currentValue = props.characterStats![criterion.stat] || 0;

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
        return true;
    }
  });
});

const unmetRequirements = computed(() => {
  if (!props.characterStats) return [];

  return statRequirements.value
    .map((criterion) => {
      const currentValue = props.characterStats![criterion.stat] || 0;
      let requirementMet = false;

      switch (criterion.displaySymbol) {
        case '=':
          requirementMet = currentValue === criterion.displayValue;
          break;
        case '≤':
          requirementMet = currentValue <= criterion.displayValue;
          break;
        case '≥':
          requirementMet = currentValue >= criterion.displayValue;
          break;
        case '≠':
          requirementMet = currentValue !== criterion.displayValue;
          break;
        case 'has':
          requirementMet = (currentValue & criterion.displayValue) === criterion.displayValue;
          break;
        case 'lacks':
          requirementMet = (currentValue & criterion.displayValue) === 0;
          break;
        default:
          requirementMet = true;
      }

      return {
        criterion,
        met: requirementMet,
        stat: criterion.stat,
        statName: criterion.statName,
        required: criterion.displayValue,
        current: currentValue,
      };
    })
    .filter((req) => !req.met);
});
</script>

<style scoped>
.criteria-display {
  @apply w-full;
}

.text-muted {
  @apply text-surface-500 dark:text-surface-400;
}

.text-danger {
  @apply text-red-500 dark:text-red-400;
}

.expression-text {
  @apply break-words;
  word-break: break-word;
}

.requirement-group {
  @apply p-2 border border-surface-200 dark:border-surface-700 rounded;
}

/* Transitions */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
  max-height: 200px;
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>

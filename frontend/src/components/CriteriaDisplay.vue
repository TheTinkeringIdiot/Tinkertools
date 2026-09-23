<template>
  <div class="criteria-display">
    <!-- No Requirements -->
    <div v-if="listedRequirements.length === 0 && !useTreeDisplay" class="no-requirements">
      <span class="text-muted text-sm">No requirements</span>
    </div>

    <!-- Tree Display Mode (default for complex criteria) -->
    <CriteriaTreeDisplay
      v-else-if="useTreeDisplay"
      :criteria="criteria"
      :character-stats="characterStats"
      :show-summary="expanded"
      :show-evaluation="expanded"
      :collapsible="!expanded"
      :default-collapsed="!expanded"
      :show-oe-breakpoints="showOeBreakpoints"
    />

    <!-- Simple Chip Display (for basic requirements) -->
    <div v-else-if="!expanded && listedRequirements.length <= 2" class="simple-view">
      <div class="flex flex-wrap gap-2">
        <CriterionChip
          v-for="criterion in listedRequirements"
          :key="criterion.id"
          :criterion="criterion"
          :character-stats="characterStats"
          size="small"
          :show-oe-breakpoints="showOeBreakpoints"
        />
      </div>
    </div>

    <!-- Compact View with Toggle -->
    <div v-else-if="!expanded" class="compact-view">
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium">
          {{ listedRequirements.length }} requirement{{
            listedRequirements.length !== 1 ? 's' : ''
          }}
        </span>
        <Button text size="small" class="text-xs" @click="showExpanded = !showExpanded">
          {{ showExpanded ? 'Hide' : 'Show' }}
        </Button>
      </div>

      <!-- Expandable Chip Details -->
      <Transition name="slide-down">
        <div v-if="showExpanded" class="mt-2 space-y-2">
          <CriterionChip
            v-for="criterion in listedRequirements"
            :key="criterion.id"
            :criterion="criterion"
            :character-stats="characterStats"
            size="small"
            :show-oe-breakpoints="showOeBreakpoints"
          />
        </div>
      </Transition>
    </div>

    <!-- Fallback: Legacy Expanded View -->
    <div v-else class="legacy-expanded-view space-y-3">
      <div class="text-sm font-medium mb-2">Requirements:</div>
      <div class="space-y-2">
        <CriterionChip
          v-for="criterion in listedRequirements"
          :key="criterion.id"
          :criterion="criterion"
          :character-stats="characterStats"
          size="normal"
          :show-oe-breakpoints="showOeBreakpoints"
        />
      </div>

      <!-- Character Evaluation Summary -->
      <div v-if="evaluation" class="evaluation-summary">
        <Divider />
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">Your Character:</span>
          <Tag
            v-tooltip.top="
              evaluation.status === 'unknown'
                ? 'Depends on conditions your profile does not record'
                : undefined
            "
            :severity="SUMMARY[evaluation.status].severity"
            :value="SUMMARY[evaluation.status].label"
          />
        </div>

        <!-- Unmet Requirements -->
        <div v-if="evaluation.unmetRequirements.length > 0" class="mt-2">
          <div class="text-xs text-muted mb-1">Missing:</div>
          <div class="space-y-1 unmet-list">
            <div
              v-for="(req, index) in evaluation.unmetRequirements"
              :key="`unmet-${index}`"
              class="flex justify-between text-xs text-danger"
            >
              <template v-if="req.description">{{ req.description }}</template>
              <template v-else>
                <span>{{ req.statName }}</span>
                <span class="font-mono">
                  {{ req.current }}/{{ req.required }} (need {{ req.required - req.current }} more)
                </span>
              </template>
            </div>
          </div>
        </div>
      </div>
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
import {
  checkActionRequirements,
  isRequirementCriterion,
  parseAction,
  shouldUseTreeDisplay,
} from '../services/action-criteria';
import type { Criterion } from '../types/api';
import type { CharacterStats } from '../composables/useActionCriteria';

// ============================================================================
// Props
// ============================================================================

interface Props {
  criteria: Criterion[];
  characterStats?: CharacterStats | null;
  expanded?: boolean;
  showOeBreakpoints?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  characterStats: null,
  expanded: false,
  showOeBreakpoints: false,
});

// ============================================================================
// Local State
// ============================================================================

const showExpanded = ref(false);

// ============================================================================
// Composables
// ============================================================================

const criteriaRef = computed(() => props.criteria);

const { displayCriteria } = useCriteriaDisplay(criteriaRef);

// ============================================================================
// Computed Properties
// ============================================================================

const useTreeDisplay = computed(() => {
  return shouldUseTreeDisplay(props.criteria);
});

/** Everything the criteria require: stats, and conditions on nanos, items, state... */
const listedRequirements = computed(() => displayCriteria.value.filter(isRequirementCriterion));

const SUMMARY = {
  met: { label: 'Meets Requirements', severity: 'success' },
  unmet: { label: 'Missing Requirements', severity: 'danger' },
  unknown: { label: 'Depends on Conditions', severity: 'info' },
} as const;

/**
 * The shared evaluator, so OR/NOT groups, requirements on the target and
 * conditions a profile doesn't record are judged the same way everywhere.
 */
const evaluation = computed(() => {
  if (!props.characterStats || listedRequirements.value.length === 0) return null;
  const parsed = parseAction({ id: 0, action: 0, item_id: 0, criteria: props.criteria });
  return checkActionRequirements(parsed, props.characterStats);
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

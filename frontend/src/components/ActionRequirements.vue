<template>
  <div class="action-requirements">
    <!-- No Actions -->
    <div v-if="!actions || actions.length === 0" class="text-muted">No actions available</div>

    <!-- Actions Display -->
    <div v-else class="space-y-4">
      <!-- Primary Action (Expanded) -->
      <div v-if="primaryAction" class="primary-action">
        <div class="flex items-center justify-between mb-2">
          <h4 class="font-semibold text-primary">{{ primaryAction.actionName }}</h4>
          <Tag
            v-if="characterStats"
            :severity="getRequirementSeverity(primaryActionEvaluation?.canPerform || null)"
            :value="primaryActionEvaluation?.canPerform ? 'Can Use' : 'Cannot Use'"
          />
        </div>

        <!-- Requirements -->
        <div v-if="primaryAction.hasRequirements" class="requirements-list">
          <CriteriaDisplay
            :criteria="actions.find((a) => a.id === primaryAction.id)?.criteria || []"
            :character-stats="characterStats"
            :expanded="true"
          />
        </div>
        <div v-else class="text-muted text-sm">No requirements</div>
      </div>

      <!-- Additional Actions (Collapsed) -->
      <div v-if="otherActions.length > 0" class="other-actions">
        <Accordion v-model:activeIndex="expandedActions" multiple>
          <AccordionTab
            v-for="(action, index) in otherActions"
            :key="action.id"
            :header="getActionHeader(action)"
          >
            <div v-if="action.hasRequirements" class="requirements-list">
              <CriteriaDisplay
                :criteria="actions.find((a) => a.id === action.id)?.criteria || []"
                :character-stats="characterStats"
                :expanded="false"
              />
            </div>
            <div v-else class="text-muted text-sm">No requirements</div>
          </AccordionTab>
        </Accordion>
      </div>

      <!-- Summary for Multiple Actions -->
      <div v-if="actions.length > 1" class="mt-4 p-3 bg-surface-50 dark:bg-surface-900 rounded">
        <div class="text-sm">
          <div class="flex items-center justify-between">
            <span class="font-medium">Item Usage</span>
            <Tag
              v-if="characterStats"
              :severity="canUseItem ? 'success' : 'danger'"
              :value="canUseItem ? 'Usable' : 'Not Usable'"
            />
          </div>

          <!-- Minimum Requirements Summary -->
          <div v-if="minimumRequirements.length > 0" class="mt-2">
            <div class="text-xs text-muted mb-1">Minimum requirements to use:</div>
            <div class="space-y-1">
              <div
                v-for="req in minimumRequirements.slice(0, 3)"
                :key="req.stat"
                class="flex justify-between text-xs"
              >
                <span>{{ req.statName }}</span>
                <span class="font-mono">
                  {{ req.currentValue }}/{{ req.minValue }}
                  <span v-if="req.shortfall > 0" class="text-danger"> (-{{ req.shortfall }}) </span>
                </span>
              </div>
              <div v-if="minimumRequirements.length > 3" class="text-xs text-muted">
                ...and {{ minimumRequirements.length - 3 }} more
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import Tag from 'primevue/tag';
import CriteriaDisplay from './CriteriaDisplay.vue';
import { useItemActions } from '../composables/useActionCriteria';
import type { Action } from '../types/api';
import type { CharacterStats } from '../composables/useActionCriteria';

// ============================================================================
// Props & Emits
// ============================================================================

interface Props {
  actions: Action[];
  characterStats?: CharacterStats | null;
  expanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  characterStats: null,
  expanded: false,
});

// ============================================================================
// Composables
// ============================================================================

const actionsRef = computed(() => props.actions);
const characterStatsRef = computed(() => props.characterStats);

const {
  parsedActions,
  primaryAction,
  primaryActionEvaluation,
  canUseItem,
  minimumRequirements,
  getRequirementSeverity,
} = useItemActions(actionsRef, characterStatsRef);

// ============================================================================
// Local State
// ============================================================================

const expandedActions = ref<number[]>([]);

// ============================================================================
// Computed Properties
// ============================================================================

const otherActions = computed(() => {
  if (!primaryAction.value) return parsedActions.value;
  return parsedActions.value.filter((action) => action.id !== primaryAction.value!.id);
});

// ============================================================================
// Methods
// ============================================================================

function getActionHeader(action: any): string {
  let header = action.actionName;

  if (props.characterStats && action.hasRequirements) {
    // Add evaluation result to header
    const evaluation = action.canPerform;
    if (evaluation !== null) {
      header += evaluation ? ' ✓' : ' ✗';
    }
  }

  if (action.hasRequirements) {
    const reqCount = action.criteria.filter((c: any) => c.isStatRequirement).length;
    header += ` (${reqCount} requirement${reqCount !== 1 ? 's' : ''})`;
  }

  return header;
}
</script>

<style>
/* Component styling matching WeaponStats aesthetic */
.action-requirements {
  width: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Primary action with enhanced Card styling */
.primary-action {
  background: #f8fafc;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 6px;
  transition: all 0.2s ease;
}

.dark .primary-action {
  background: #0c0a09 !important;
  border-color: #374151 !important;
}

@media (prefers-color-scheme: light) {
  .primary-action {
    background: #ffffff;
    border-color: #e5e7eb;
  }
}

.primary-action:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.dark .primary-action:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
}

/* Other actions spacing */
.other-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Requirements list with improved spacing */
.requirements-list {
  margin-top: 4px;
}

/* Text colors with better contrast */
.text-muted {
  color: #6b7280;
}

.dark .text-muted {
  color: #9ca3af !important;
}

.text-danger {
  color: #dc2626;
}

.dark .text-danger {
  color: #fca5a5 !important;
}

.text-primary {
  color: #3b82f6;
}

.dark .text-primary {
  color: #93bbfc !important;
}

/* Enhanced accordion styling to match component theme */
:deep(.p-accordion-tab) {
  margin-bottom: 8px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #d1d5db;
}

.dark :deep(.p-accordion-tab) {
  border-color: #374151 !important;
}

:deep(.p-accordion-header) {
  background: #f9fafb;
  border: none;
  border-radius: 0;
  transition: all 0.2s ease;
}

.dark :deep(.p-accordion-header) {
  background: #1f2937 !important;
}

:deep(.p-accordion-header:hover) {
  background: #f3f4f6;
}

.dark :deep(.p-accordion-header:hover) {
  background: #374151 !important;
}

:deep(.p-accordion-header-link) {
  padding: 4px 6px;
  color: #374151;
  font-weight: 500;
  border-radius: 0;
}

.dark :deep(.p-accordion-header-link) {
  color: #e5e7eb !important;
}

:deep(.p-accordion-content) {
  background: #ffffff;
  border: none;
  border-top: 1px solid #e5e7eb;
  padding: 6px;
}

.dark :deep(.p-accordion-content) {
  background: #0c0a09 !important;
  border-top-color: #374151 !important;
}

@media (prefers-color-scheme: light) {
  :deep(.p-accordion-header) {
    background: #f9fafb;
  }

  :deep(.p-accordion-header:hover) {
    background: #f3f4f6;
  }

  :deep(.p-accordion-content) {
    background: #ffffff;
    border-top-color: #e5e7eb;
  }
}

/* Focus states for accessibility */
:deep(.p-accordion-header-link:focus) {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

:deep(.p-accordion-header-link:focus:not(:focus-visible)) {
  outline: none;
}

/* Improved summary section */
.action-requirements > div:last-child {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 6px;
  margin-top: 6px;
}

.dark .action-requirements > div:last-child {
  background: #111827 !important;
  border-color: #374151 !important;
}

/* Enhanced tag styling within the component */
:deep(.p-tag) {
  border-radius: 16px;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 12px;
}

:deep(.p-tag.p-tag-success) {
  background: linear-gradient(135deg, #059669, #10b981);
  border-color: #059669;
  color: white;
}

:deep(.p-tag.p-tag-danger) {
  background: linear-gradient(135deg, #dc2626, #ef4444);
  border-color: #dc2626;
  color: white;
}

/* Responsive improvements */
@media (max-width: 640px) {
  .primary-action {
    padding: 4px;
  }

  .requirements-list {
    margin-top: 3px;
  }

  :deep(.p-accordion-header-link) {
    padding: 3px 4px;
  }

  :deep(.p-accordion-content) {
    padding: 4px;
  }
}
</style>

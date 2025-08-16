<template>
  <div class="action-requirements">
    <!-- No Actions -->
    <div v-if="!actions || actions.length === 0" class="text-muted">
      No actions available
    </div>
    
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
            :criteria="actions.find(a => a.id === primaryAction.id)?.criteria || []"
            :character-stats="characterStats"
            :expanded="true"
          />
        </div>
        <div v-else class="text-muted text-sm">
          No requirements
        </div>
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
                :criteria="actions.find(a => a.id === action.id)?.criteria || []"
                :character-stats="characterStats"
                :expanded="false"
              />
            </div>
            <div v-else class="text-muted text-sm">
              No requirements
            </div>
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
                  <span v-if="req.shortfall > 0" class="text-danger">
                    (-{{ req.shortfall }})
                  </span>
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
import { computed, ref } from 'vue'
import Accordion from 'primevue/accordion'
import AccordionTab from 'primevue/accordiontab'
import Tag from 'primevue/tag'
import CriteriaDisplay from './CriteriaDisplay.vue'
import { useItemActions } from '../composables/useActionCriteria'
import type { Action } from '../types/api'
import type { CharacterStats } from '../composables/useActionCriteria'

// ============================================================================
// Props & Emits
// ============================================================================

interface Props {
  actions: Action[]
  characterStats?: CharacterStats | null
  expanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  characterStats: null,
  expanded: false
})

// ============================================================================
// Composables
// ============================================================================

const actionsRef = computed(() => props.actions)
const characterStatsRef = computed(() => props.characterStats)

const {
  parsedActions,
  primaryAction,
  primaryActionEvaluation,
  canUseItem,
  minimumRequirements,
  getRequirementSeverity
} = useItemActions(actionsRef, characterStatsRef)

// ============================================================================
// Local State
// ============================================================================

const expandedActions = ref<number[]>([])

// ============================================================================
// Computed Properties
// ============================================================================

const otherActions = computed(() => {
  if (!primaryAction.value) return parsedActions.value
  return parsedActions.value.filter(action => action.id !== primaryAction.value!.id)
})

// ============================================================================
// Methods
// ============================================================================

function getActionHeader(action: any): string {
  let header = action.actionName
  
  if (props.characterStats && action.hasRequirements) {
    // Add evaluation result to header
    const evaluation = action.canPerform
    if (evaluation !== null) {
      header += evaluation ? ' ✓' : ' ✗'
    }
  }
  
  if (action.hasRequirements) {
    const reqCount = action.criteria.filter((c: any) => c.isStatRequirement).length
    header += ` (${reqCount} requirement${reqCount !== 1 ? 's' : ''})`
  }
  
  return header
}
</script>

<style scoped>
.action-requirements {
  @apply w-full;
}

.primary-action {
  @apply border border-surface-200 dark:border-surface-700 rounded-lg p-4 bg-surface-0 dark:bg-surface-950;
}

.other-actions {
  @apply space-y-2;
}

.requirements-list {
  @apply space-y-2;
}

.text-muted {
  @apply text-surface-500 dark:text-surface-400;
}

.text-danger {
  @apply text-red-500 dark:text-red-400;
}

.text-primary {
  @apply text-primary-500 dark:text-primary-400;
}

/* Accordion styling adjustments */
:deep(.p-accordion-tab) {
  @apply mb-2;
}

:deep(.p-accordion-header) {
  @apply bg-surface-50 dark:bg-surface-900;
}

:deep(.p-accordion-content) {
  @apply bg-surface-0 dark:bg-surface-950;
}
</style>
<!--
CriteriaDiffList - a requirement list as a sequence diff: every criterion of
either side once, in evaluation order, marked kept, added, removed or changed.
Criteria are worded as on the item page (CriterionReference resolves the names
of nanos and items a criterion points at).
-->
<template>
  <ol class="criteria-diff" data-testid="diff-criteria">
    <li
      v-for="(row, index) in rows"
      :key="index"
      class="criteria-diff-row"
      :class="[`criteria-diff-${row.op}`, { 'criteria-diff-operator': row.isOperator }]"
      data-testid="diff-criterion"
      :data-op="row.op"
    >
      <DiffMark :op="row.op" />
      <span class="min-w-0">
        <template v-if="row.op === 'changed' && row.old && row.new">
          <del class="diff-old"><CriterionReference :criterion="row.old" /></del>
          <span class="diff-arrow" aria-hidden="true"> → </span>
          <span class="sr-only"> became </span>
          <ins class="diff-new"><CriterionReference :criterion="row.new" /></ins>
        </template>
        <del v-else-if="row.op === 'removed' && row.old" class="diff-old">
          <CriterionReference :criterion="row.old" />
        </del>
        <ins v-else-if="row.op === 'added' && row.new" class="diff-new">
          <CriterionReference :criterion="row.new" />
        </ins>
        <CriterionReference v-else-if="row.new" :criterion="row.new" />
      </span>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import DiffMark from './DiffMark.vue';
import CriterionReference from '@/components/CriterionReference.vue';
import { displayCriterion } from '@/services/diff-format';
import type { DisplayCriterion } from '@/services/action-criteria';
import type { CriterionChange } from '@/types/changes';

const props = defineProps<{ criteria: CriterionChange[] }>();

interface Row {
  op: CriterionChange['op'];
  old: DisplayCriterion | null;
  new: DisplayCriterion | null;
  /** AND / OR / NOT and modifiers: structure of the list, not a requirement. */
  isOperator: boolean;
}

const rows = computed<Row[]>(() =>
  props.criteria.map((change) => {
    const before = change.old ? displayCriterion(change.old) : null;
    const after = change.new ? displayCriterion(change.new) : null;
    const shown = after ?? before;
    return {
      op: change.op,
      old: before,
      new: after,
      isOperator: !!shown && (shown.isLogicalOperator || !!shown.isModifier),
    };
  })
);
</script>

<style scoped>
.criteria-diff {
  @apply m-0 list-none p-0 text-sm;
}

.criteria-diff-row {
  @apply flex items-baseline gap-1 py-0.5 text-surface-800 dark:text-surface-200;
}

.criteria-diff-same {
  @apply text-surface-500 dark:text-surface-400;
}

.criteria-diff-operator {
  @apply text-xs uppercase tracking-wide;
}
</style>

<!--
CriteriaDiffList - a requirement list as a sequence diff: every criterion of
either side once, in evaluation order, marked kept, added, removed or changed.
Criteria are worded as on the item page (CriterionReference resolves the names
of nanos and items a criterion points at).

The AND that joins two requirements is not listed: everything listed is
required unless an OR or NOT says otherwise. A long run of unchanged
requirements is folded behind one line, so what changed is what shows.
-->
<template>
  <ol class="criteria-diff" data-testid="diff-criteria">
    <li
      v-for="row in shown"
      :key="row.index"
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
    <li v-if="foldable" class="criteria-diff-fold">
      <button
        type="button"
        class="criteria-diff-fold-toggle"
        data-testid="diff-criteria-unchanged"
        :aria-expanded="unfolded"
        @click="unfolded = !unfolded"
      >
        <i
          class="pi text-xs"
          :class="unfolded ? 'pi-chevron-down' : 'pi-chevron-right'"
          aria-hidden="true"
        ></i>
        {{ unfolded ? 'Hide' : 'Show' }} {{ unchanged.length }} unchanged
      </button>
    </li>
  </ol>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import DiffMark from './DiffMark.vue';
import CriterionReference from '@/components/CriterionReference.vue';
import { displayCriterion } from '@/services/diff-format';
import type { DisplayCriterion } from '@/services/action-criteria';
import type { CriterionChange } from '@/types/changes';

const props = defineProps<{ criteria: CriterionChange[] }>();

/** More unchanged requirements than this are folded away. */
const FOLD_ABOVE = 3;
const AND_OPERATOR = 4;

interface Row {
  /** Position in the sequence, which orders the rows whatever is folded. */
  index: number;
  op: CriterionChange['op'];
  old: DisplayCriterion | null;
  new: DisplayCriterion | null;
  /** AND / OR / NOT and modifiers: structure of the list, not a requirement. */
  isOperator: boolean;
}

function isJoiningAnd(criterion: CriterionChange['old']): boolean {
  return (
    criterion === null ||
    (criterion.operator === AND_OPERATOR && criterion.value1 === 0 && criterion.value2 === 0)
  );
}

const rows = computed<Row[]>(() =>
  props.criteria
    .filter((change) => !(isJoiningAnd(change.old) && isJoiningAnd(change.new)))
    .map((change, index) => {
      const before = change.old ? displayCriterion(change.old) : null;
      const after = change.new ? displayCriterion(change.new) : null;
      const shown = after ?? before;
      return {
        index,
        op: change.op,
        old: before,
        new: after,
        isOperator: !!shown && (shown.isLogicalOperator || !!shown.isModifier),
      };
    })
);

const unfolded = ref(false);
const unchanged = computed(() => rows.value.filter((row) => row.op === 'same'));
/** Folding needs something changed to show in place of the unchanged rows. */
const foldable = computed(
  () => unchanged.value.length > FOLD_ABOVE && unchanged.value.length < rows.value.length
);
const shown = computed(() =>
  foldable.value && !unfolded.value ? rows.value.filter((row) => row.op !== 'same') : rows.value
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

.criteria-diff-fold-toggle {
  @apply flex items-center gap-1 py-0.5 text-xs text-primary-600 hover:underline dark:text-primary-400;
}

.criteria-diff-operator {
  @apply text-xs uppercase tracking-wide;
}
</style>

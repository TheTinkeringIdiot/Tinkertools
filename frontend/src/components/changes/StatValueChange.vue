<!--
StatValueChange - the values of one stat entry of a diff: "60 → 100 (+40)",
or the single value of a stat that was added or removed.
-->
<template>
  <span class="stat-value-change">
    <template v-if="change.change === 'changed'">
      <del class="diff-old">{{ text(change.old) }}</del>
      <span class="diff-arrow" aria-hidden="true"> → </span>
      <span class="sr-only"> became </span>
      <ins class="diff-new">{{ text(change.new) }}</ins>
      <span v-if="delta && showDelta" class="item-diff-delta">({{ delta }})</span>
    </template>
    <ins v-else-if="change.change === 'added'" class="diff-new">{{ text(change.new) }}</ins>
    <del v-else class="diff-old">{{ text(change.old) }}</del>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { statDeltaText, statValueText } from '@/services/diff-format';
import type { StatChange } from '@/types/changes';

const props = withDefaults(
  defineProps<{
    change: StatChange;
    unit?: string;
    /** Off for values that are ids (an icon, a mesh), where a difference means nothing. */
    showDelta?: boolean;
    /** Off for skill percentages, whose stat id names the skill, not the value. */
    nameValues?: boolean;
  }>(),
  { unit: '', showDelta: true, nameValues: true }
);

function text(value: number | null): string {
  return statValueText(value, props.nameValues ? props.change.stat : undefined, props.unit);
}

const delta = computed(() => statDeltaText(props.change, props.unit, props.nameValues));
</script>

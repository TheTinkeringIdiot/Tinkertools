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
import type { StatChange } from '@/types/changes';

const props = withDefaults(
  defineProps<{
    change: StatChange;
    unit?: string;
    /** Off for values that are ids (an icon, a mesh), where a difference means nothing. */
    showDelta?: boolean;
  }>(),
  { unit: '', showDelta: true }
);

function text(value: number | null): string {
  return value === null ? 'none' : `${value}${props.unit}`;
}

const delta = computed(() => {
  const { old: before, new: after } = props.change;
  if (before === null || after === null || before === after) return '';
  const difference = after - before;
  return `${difference > 0 ? '+' : '−'}${Math.abs(difference)}${props.unit}`;
});
</script>

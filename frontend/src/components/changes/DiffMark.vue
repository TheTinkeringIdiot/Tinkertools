<!--
DiffMark - the sign in front of a diff line: + added, − removed, ~ changed.
The sign and a screen-reader word carry the meaning; colour only repeats it.
-->
<template>
  <span class="diff-mark" :class="`diff-mark-${op}`" :data-op="op">
    <span aria-hidden="true">{{ sign }}</span>
    <span class="sr-only">{{ word }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export type DiffOp = 'added' | 'removed' | 'changed' | 'same';

const props = defineProps<{ op: DiffOp }>();

const SIGNS: Record<DiffOp, string> = { added: '+', removed: '−', changed: '~', same: '' };
const WORDS: Record<DiffOp, string> = {
  added: 'Added:',
  removed: 'Removed:',
  changed: 'Changed:',
  same: 'Unchanged:',
};

const sign = computed(() => SIGNS[props.op]);
const word = computed(() => WORDS[props.op]);
</script>

<style scoped>
.diff-mark {
  display: inline-block;
  width: 1rem;
  flex: none;
  text-align: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-weight: 700;
}

.diff-mark-added {
  @apply text-green-700 dark:text-green-400;
}

.diff-mark-removed {
  @apply text-red-700 dark:text-red-400;
}

.diff-mark-changed {
  @apply text-amber-700 dark:text-amber-400;
}
</style>

<!--
ChangeBadges - what kind of change a row is, which parts it touches and what it
matters for. The kind is a word with a sign; parts and relevance are words.
-->
<template>
  <span class="change-badges">
    <span
      class="change-kind"
      :class="`change-kind-${kind}`"
      data-testid="change-kind"
      :data-kind="kind"
    >
      <span v-if="KIND_MARKS[kind]" aria-hidden="true">{{ KIND_MARKS[kind] }}</span>
      {{ KIND_LABELS[kind] }}
    </span>
    <span
      v-for="part in parts"
      :key="`part-${part}`"
      class="change-chip"
      data-testid="change-part"
      :data-part="part"
    >
      {{ PART_LABELS[part] }}
    </span>
    <span
      v-for="name in relevance"
      :key="`relevance-${name}`"
      class="change-chip change-chip-relevance"
      :class="`change-relevance-${name}`"
      data-testid="change-relevance"
      :data-relevance="name"
      :title="`Matters for: ${RELEVANCE_LABELS[name].toLowerCase()}`"
    >
      {{ RELEVANCE_LABELS[name] }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { KIND_LABELS, KIND_MARKS, PART_LABELS, RELEVANCE_LABELS } from '@/services/diff-format';
import type { ChangeKind, PartName, RelevanceName } from '@/types/changes';

withDefaults(
  defineProps<{
    kind: ChangeKind | 'unchanged';
    parts?: PartName[];
    relevance?: RelevanceName[];
  }>(),
  { parts: () => [], relevance: () => [] }
);
</script>

<style scoped>
.change-badges {
  @apply inline-flex flex-wrap items-center gap-1 align-middle;
}

.change-kind {
  @apply inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold;
}

.change-kind-added {
  @apply bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300;
}

.change-kind-removed {
  @apply bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300;
}

.change-kind-changed {
  @apply bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300;
}

.change-kind-unchanged {
  @apply bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-300;
}

.change-chip {
  @apply rounded border border-surface-300 px-1.5 py-0.5 text-xs text-surface-700 dark:border-surface-600 dark:text-surface-300;
}

.change-chip-relevance {
  @apply border-dashed;
}

.change-relevance-gameplay {
  @apply border-primary-400 text-primary-700 dark:border-primary-500 dark:text-primary-300;
}
</style>

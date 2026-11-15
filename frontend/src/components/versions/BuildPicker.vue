<!--
BuildPicker - choose one build out of the registry, grouped by family in
registry order (newest first). A native select: keyboard type-ahead finds
"AO 15.0.1" among well over a hundred builds, on any screen.
-->
<template>
  <label class="build-picker">
    <span class="build-picker-label">{{ label }}</span>
    <select
      class="build-picker-select"
      :value="dataSlug(modelValue) ?? modelValue ?? ''"
      :data-testid="testId"
      @change="onChange"
    >
      <option value="">{{ placeholder }}</option>
      <optgroup v-for="group in groups" :key="group.key" :label="group.title">
        <option v-for="build in group.builds" :key="build.slug" :value="build.slug">
          {{ build.display_name }}{{ build.is_default ? ' (live)' : '' }}
        </option>
      </optgroup>
    </select>
  </label>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { buildGroups } from '@/utils/version-order';
import { dataSlug } from '@/composables/useGameVersion';

const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    label: string;
    placeholder?: string;
    /** Builds left out of the list (the one being compared against itself). */
    exclude?: Array<string | null | undefined>;
    testId?: string;
  }>(),
  { placeholder: 'Pick a version', exclude: () => [], testId: 'build-picker' }
);

const emit = defineEmits<{ (event: 'update:modelValue', slug: string | null): void }>();

const groups = computed(() => {
  const selected = dataSlug(props.modelValue);
  return buildGroups(props.exclude.filter((slug) => dataSlug(slug) !== selected));
});

function onChange(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  emit('update:modelValue', value || null);
}
</script>

<style scoped>
.build-picker {
  @apply inline-flex flex-wrap items-center gap-2 text-sm;
}

.build-picker-label {
  @apply text-surface-600 dark:text-surface-400;
}

.build-picker-select {
  @apply max-w-full rounded border border-surface-300 bg-surface-0 px-2 py-1 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-950 dark:text-surface-50;
}
</style>

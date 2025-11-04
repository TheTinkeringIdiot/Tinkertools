<template>
  <div
    :class="[
      'flex items-center justify-center',
      size === 'small' ? 'p-2' : size === 'large' ? 'p-8' : 'p-4',
    ]"
    role="status"
    :aria-label="ariaLabel"
    aria-live="polite"
  >
    <div
      :class="[
        'animate-spin border-2 border-surface-300 border-t-primary-500 rounded-full',
        size === 'small' ? 'w-4 h-4' : size === 'large' ? 'w-8 h-8' : 'w-6 h-6',
      ]"
      aria-hidden="true"
    ></div>

    <span
      v-if="showText"
      :class="[
        'ml-2 text-surface-600 dark:text-surface-400',
        size === 'small' ? 'text-sm' : 'text-base',
      ]"
    >
      {{ loadingText }}
    </span>

    <!-- Screen reader only text -->
    <span v-if="!showText" class="sr-only">
      {{ loadingText }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  size?: 'small' | 'medium' | 'large';
  loadingText?: string;
  showText?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  loadingText: 'Loading...',
  showText: false,
});

const ariaLabel = computed(() => {
  return `Loading: ${props.loadingText}`;
});
</script>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>

<!--
EffectLine - one effect in words, as the item page writes it (SpellText turns
the nanos and items it names into links), with its target and ticks.
-->
<template>
  <span class="effect-line">
    <SpellText :text="text" />
    <span v-if="details.length" class="effect-line-details"> ({{ details.join(', ') }})</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import SpellText from '@/components/items/SpellText.vue';
import { effectDetails, effectText } from '@/services/diff-format';
import type { DiffEffect } from '@/types/changes';

const props = defineProps<{ effect: DiffEffect }>();

const text = computed(() => effectText(props.effect));
const details = computed(() => effectDetails(props.effect));
</script>

<style scoped>
.effect-line-details {
  @apply text-xs text-surface-500 dark:text-surface-400;
}
</style>

<!--
  CriterionReference - "<prefix>: <name>" for a criterion that names an item or
  nano by AOID (a running nano, a wielded item, an owned nano...). The name is
  resolved from the backend and links to the item; until then, or if it can't be
  found, it reads "Nano 12345" / "Item 12345".
-->
<template>
  <span class="criterion-reference">
    <template v-if="criterion.referenceAoid">
      {{ criterion.referencePrefix ? `${criterion.referencePrefix}: ` : '' }}
      <RouterLink
        :to="{ name: 'ItemDetail', params: { aoid: String(criterion.referenceAoid) } }"
        class="criterion-reference-link"
        >{{ label }}</RouterLink
      >
    </template>
    <template v-else>{{ criterion.description }}</template>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import type { DisplayCriterion } from '@/services/action-criteria';
import { useNanoNameResolver } from '@/composables/useNanoNameResolver';

const props = defineProps<{
  criterion: DisplayCriterion;
}>();

const { resolveNanoName } = useNanoNameResolver();
const resolvedName = ref<string | null>(null);

watch(
  () => props.criterion.referenceAoid,
  async (aoid) => {
    resolvedName.value = null;
    if (!aoid) return;
    const name = await resolveNanoName(aoid);
    // Ignore a late answer for an AOID this component no longer shows
    if (props.criterion.referenceAoid === aoid) resolvedName.value = name;
  },
  { immediate: true }
);

const label = computed(
  () =>
    resolvedName.value ??
    `${props.criterion.referenceKind ?? 'Item'} ${props.criterion.referenceAoid ?? ''}`
);
</script>

<style scoped>
.criterion-reference-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.criterion-reference-link:hover {
  text-decoration-thickness: 2px;
}
</style>

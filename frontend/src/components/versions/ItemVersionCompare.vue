<!--
ItemVersionCompare - one item in two builds: the build on the page and any
other one, of the same family or across the fork. The older build is always
the left side, whichever of the two the page shows.
-->
<template>
  <section class="item-compare" data-testid="item-compare-panel" aria-label="Compare versions">
    <header class="item-compare-header">
      <h3 class="text-base font-semibold">
        <i class="pi pi-arrows-h mr-1 text-blue-500" aria-hidden="true"></i>
        Compare versions
      </h3>
      <BuildPicker
        :model-value="other"
        :label="`${viewedLabel} compared with`"
        :exclude="[version]"
        test-id="item-compare-picker"
        @update:model-value="emit('update:other', $event)"
      />
      <button
        type="button"
        class="item-compare-close"
        data-testid="item-compare-close"
        aria-label="Close comparison"
        title="Close comparison"
        @click="emit('close')"
      >
        <i class="pi pi-times text-xs" aria-hidden="true"></i>
      </button>
    </header>

    <p v-if="!other" class="item-compare-muted" data-testid="item-compare-hint">
      Pick any other build to see what differs between the two.
    </p>

    <div v-else-if="loading" class="item-compare-muted" data-testid="item-compare-loading">
      <i class="pi pi-spin pi-spinner mr-1" aria-hidden="true"></i>
      Comparing...
    </div>

    <div v-else-if="error" class="item-compare-error" data-testid="item-compare-error" role="alert">
      <i class="pi pi-exclamation-triangle mr-1" aria-hidden="true"></i>
      {{ error }}
      <button type="button" class="item-compare-retry" @click="load">Retry</button>
    </div>

    <div v-else-if="result" data-testid="item-compare-result" :data-kind="result.kind">
      <p class="item-compare-sides">
        <span data-testid="item-compare-base">{{ result.base.display_name }}</span>
        <span aria-hidden="true"> → </span>
        <span class="sr-only"> to </span>
        <span data-testid="item-compare-build">{{ result.build.display_name }}</span>
        <ChangeBadges :kind="result.kind" :parts="result.parts" :relevance="result.relevance" />
      </p>

      <p v-if="result.kind === 'added'" class="item-compare-plain" data-testid="item-compare-plain">
        Not in {{ result.base.display_name }}. It exists in {{ result.build.display_name }} as
        "{{ result.new?.name }}" (QL {{ result.new?.ql }}).
      </p>
      <p
        v-else-if="result.kind === 'removed'"
        class="item-compare-plain"
        data-testid="item-compare-plain"
      >
        In {{ result.base.display_name }} as "{{ result.old?.name }}" (QL {{ result.old?.ql }}).
        Not in {{ result.build.display_name }}.
      </p>
      <p
        v-else-if="result.kind === 'unchanged'"
        class="item-compare-plain"
        data-testid="item-compare-plain"
      >
        Identical in both builds.
      </p>
      <template v-else-if="result.diff">
        <p v-if="qlChange" class="item-compare-plain">{{ qlChange }}</p>
        <ItemDiffView
          :diff="result.diff"
          :is-nano="result.new?.is_nano ?? result.old?.is_nano ?? false"
          :item-class="result.new?.item_class ?? result.old?.item_class"
        />
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import BuildPicker from './BuildPicker.vue';
import ChangeBadges from '@/components/changes/ChangeBadges.vue';
import ItemDiffView from '@/components/changes/ItemDiffView.vue';
import { useChangesStore } from '@/stores/changes';
import { errorMessage, isRequestCancelled } from '@/services/error-message';
import { buildLabel, orderBuilds, sameBuild } from '@/utils/version-order';
import type { ItemCompareResponse } from '@/types/changes';

const props = defineProps<{
  aoid: number;
  /** Build the item on the page was loaded from. */
  version: string | null;
  /** The build to compare it with; null until one is picked. */
  other: string | null;
}>();

const emit = defineEmits<{
  (event: 'update:other', slug: string | null): void;
  (event: 'close'): void;
}>();

const changesStore = useChangesStore();
const CHANNEL = 'item-compare';

const result = ref<ItemCompareResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const viewedLabel = computed(() => buildLabel(props.version));

const qlChange = computed(() => {
  const before = result.value?.old;
  const after = result.value?.new;
  if (!before || !after || before.ql === after.ql) return '';
  return `Quality level ${before.ql} → ${after.ql}`;
});

async function load(): Promise<void> {
  result.value = null;
  error.value = null;
  if (!props.other || !props.version || sameBuild(props.other, props.version)) {
    changesStore.cancel(CHANNEL);
    loading.value = false;
    return;
  }
  const { older, newer } = orderBuilds(props.version, props.other);
  const asked = `${props.aoid}|${older}|${newer}`;
  latest = asked;
  loading.value = true;
  try {
    const response = await changesStore.loadItemCompare(
      { aoid: props.aoid, version: newer, base: older },
      CHANNEL
    );
    if (latest === asked) result.value = response;
  } catch (caught) {
    if (isRequestCancelled(caught) || latest !== asked) return;
    error.value = errorMessage(caught) || 'The comparison could not be loaded';
  } finally {
    if (latest === asked) loading.value = false;
  }
}

let latest = '';

watch(() => [props.aoid, props.version, props.other], load, { immediate: true });

onBeforeUnmount(() => changesStore.cancel(CHANNEL));
</script>

<style scoped>
.item-compare {
  @apply rounded-lg border border-surface-200 bg-surface-0 p-4 dark:border-surface-700 dark:bg-surface-900;
}

.item-compare-header {
  @apply mb-3 flex flex-wrap items-center gap-x-4 gap-y-2;
}

.item-compare-close {
  @apply ml-auto rounded p-1 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800;
}

.item-compare-muted {
  @apply text-sm text-surface-500 dark:text-surface-400;
}

.item-compare-error {
  @apply text-sm text-red-700 dark:text-red-400;
}

.item-compare-retry {
  @apply ml-2 underline;
}

.item-compare-sides {
  @apply mb-2 flex flex-wrap items-center gap-2 text-sm font-medium text-surface-900 dark:text-surface-50;
}

.item-compare-plain {
  @apply mb-2 text-sm text-surface-700 dark:text-surface-300;
}
</style>

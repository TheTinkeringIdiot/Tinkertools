<!--
ChangeRow - one item of a change list: what it is, how it changed, and its
field-level diff, opened in place. The diff comes with the row when the page
asked for diffs; otherwise it is fetched when the row is first opened.
-->
<template>
  <li class="change-row" data-testid="change-row" :data-aoid="change.aoid" :data-kind="change.kind">
    <div class="change-row-main">
      <button
        v-if="canOpen"
        type="button"
        class="change-row-toggle"
        data-testid="change-row-toggle"
        :aria-expanded="open"
        :aria-label="`${open ? 'Hide' : 'Show'} what changed in ${displayName}`"
        @click="toggle"
      >
        <i
          class="pi text-xs"
          :class="open ? 'pi-chevron-down' : 'pi-chevron-right'"
          aria-hidden="true"
        ></i>
      </button>
      <span v-else class="change-row-toggle" aria-hidden="true"></span>

      <img
        v-if="iconUrl && !iconFailed"
        :src="iconUrl"
        alt=""
        class="change-row-icon"
        loading="lazy"
        @error="iconFailed = true"
      />
      <span v-else class="change-row-icon change-row-icon-empty" aria-hidden="true">
        <i class="pi pi-box text-xs"></i>
      </span>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
          <RouterLink :to="itemLink" class="change-row-name" data-testid="change-row-link">
            {{ displayName }}
          </RouterLink>
          <span class="change-row-meta">
            {{ itemClassLabel(change.item_class, change.is_nano) }} · QL
            <template v-if="change.old_ql !== null">{{ change.old_ql }} → </template>{{ change.ql }}
          </span>
          <ChangeBadges :kind="change.kind" :parts="change.parts" :relevance="change.relevance" />
        </div>
        <p v-if="change.old_name !== null" class="change-row-meta" data-testid="change-row-old-name">
          Was named "{{ change.old_name || '(no name)' }}"
        </p>
      </div>
    </div>

    <div v-if="open" class="change-row-diff" data-testid="change-row-diff">
      <ItemDiffView
        v-if="diff"
        :diff="diff"
        :is-nano="change.is_nano"
        :item-class="change.item_class"
      />
      <p v-else-if="diffError" class="change-row-error" role="alert">
        {{ diffError }}
        <button type="button" class="underline" @click="loadDiff">Retry</button>
      </p>
      <p v-else class="change-row-meta">
        <i class="pi pi-spin pi-spinner mr-1" aria-hidden="true"></i>
        Loading what changed...
      </p>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import ChangeBadges from './ChangeBadges.vue';
import ItemDiffView from './ItemDiffView.vue';
import { useChangesStore } from '@/stores/changes';
import { getIconUrl } from '@/services/game-utils';
import { itemClassLabel } from '@/services/diff-format';
import { errorMessage } from '@/services/error-message';
import type { BuildRef, ItemChange, ItemDiff } from '@/types/changes';

const props = withDefaults(
  defineProps<{
    change: ItemChange;
    build: BuildRef;
    base: BuildRef | null;
    /** Open the diff from the start (the page shows every diff). */
    startOpen?: boolean;
    /** Link the item page to the same comparison (two arbitrary builds). */
    linkComparison?: boolean;
  }>(),
  { startOpen: false, linkComparison: false }
);

const changesStore = useChangesStore();

const open = ref(false);
const fetched = ref<ItemDiff | null>(null);
const diffError = ref<string | null>(null);
const iconFailed = ref(false);

const displayName = computed(() => props.change.name || `Unnamed item ${props.change.aoid}`);
const iconUrl = computed(() => (props.change.icon ? getIconUrl(props.change.icon) : ''));

/** Only an item both builds have can be diffed. */
const canOpen = computed(() => props.change.kind === 'changed' && !!props.base);
const diff = computed(() => props.change.diff ?? fetched.value);

/**
 * The item page in the build being browsed. A removed item is no longer in
 * it, so the link shows it as the older build has it.
 */
const itemLink = computed<RouteLocationRaw>(() => {
  const query: Record<string, string> = {};
  if (props.change.kind === 'removed' && props.base) {
    query.as = props.base.slug;
  } else if (props.linkComparison && props.change.kind === 'changed' && props.base) {
    query.compare = props.base.slug;
  }
  return { name: 'ItemDetail', params: { aoid: String(props.change.aoid) }, query };
});

async function loadDiff(): Promise<void> {
  if (diff.value || !props.base) return;
  diffError.value = null;
  const asked = props.change.aoid;
  try {
    const response = await changesStore.loadItemCompare({
      aoid: asked,
      version: props.build.slug,
      base: props.base.slug,
    });
    if (props.change.aoid === asked) fetched.value = response.diff;
  } catch (caught) {
    if (props.change.aoid === asked) {
      diffError.value = errorMessage(caught) || 'The diff could not be loaded.';
    }
  }
}

function toggle(): void {
  open.value = !open.value;
  if (open.value) void loadDiff();
}

watch(
  () => [props.change.aoid, props.startOpen, props.change.diff] as const,
  ([aoid], previous) => {
    if (!previous || previous[0] !== aoid) {
      fetched.value = null;
      diffError.value = null;
      iconFailed.value = false;
    }
    open.value = props.startOpen && canOpen.value && !!props.change.diff;
  },
  { immediate: true }
);
</script>

<style scoped>
.change-row {
  @apply border-b border-surface-200 py-2 dark:border-surface-700;
}

.change-row-main {
  @apply flex items-start gap-2;
}

.change-row-toggle {
  @apply mt-1 flex h-6 w-6 flex-none items-center justify-center rounded text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800;
}

.change-row-icon {
  @apply h-8 w-8 flex-none rounded;
}

.change-row-icon-empty {
  @apply flex items-center justify-center bg-surface-100 text-surface-400 dark:bg-surface-800;
}

.change-row-name {
  @apply break-words font-medium text-primary-700 hover:underline dark:text-primary-300;
}

.change-row-meta {
  @apply text-xs text-surface-500 dark:text-surface-400;
}

.change-row-error {
  @apply text-sm text-red-700 dark:text-red-400;
}

.change-row-diff {
  @apply ml-16 mt-2 rounded border border-surface-200 p-3 dark:border-surface-700;
}

@media (max-width: 640px) {
  .change-row-diff {
    @apply ml-0;
  }
}
</style>

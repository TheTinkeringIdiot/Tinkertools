<!--
PatchNotesPanel - the field transitions most changed items of a build share,
in words: "… chance to cast …: Chance 60% → 100% on 760 items". Reads as the
patch notes of the build. A line leads into the list narrowed to its part
(the change list has no filter for a single transition).
-->
<template>
  <section class="patch-notes" data-testid="patch-notes" aria-label="Patch notes">
    <header class="patch-notes-header">
      <button
        type="button"
        class="patch-notes-toggle"
        data-testid="patch-notes-toggle"
        :aria-expanded="open"
        @click="open = !open"
      >
        <i
          class="pi text-xs"
          :class="open ? 'pi-chevron-down' : 'pi-chevron-right'"
          aria-hidden="true"
        ></i>
        <span class="text-base font-semibold">Patch notes</span>
      </button>
      <span class="patch-notes-muted">The same change made to many items at once, most items first</span>
    </header>

    <template v-if="open">
      <p v-if="error" class="patch-notes-muted" data-testid="patch-notes-error">
        The patch notes could not be loaded.
        <button type="button" class="underline" @click="load">Retry</button>
      </p>
      <p v-else-if="loading && !transitions.length" class="patch-notes-muted">
        <i class="pi pi-spin pi-spinner mr-1" aria-hidden="true"></i>
        Loading...
      </p>
      <p v-else-if="!transitions.length" class="patch-notes-muted" data-testid="patch-notes-empty">
        No change is shared by several items in this build.
      </p>
      <template v-else>
        <ul class="patch-notes-list">
          <li
            v-for="(transition, index) in shown"
            :key="index"
            class="patch-notes-line"
            data-testid="patch-note"
            :data-part="transition.part"
          >
            <span class="min-w-0 flex-1">
              <span class="patch-notes-text">{{ transitionText(transition) }}</span>
              <span class="patch-notes-count"> {{ transitionCount(transition) }}</span>
            </span>
            <button
              type="button"
              class="patch-notes-link"
              data-testid="patch-note-filter"
              :title="`List the changes to ${PART_LABELS[transition.part].toLowerCase()}`"
              @click="emit('filter-part', transition.part)"
            >
              Show {{ PART_LABELS[transition.part].toLowerCase() }} changes
            </button>
          </li>
        </ul>
        <button
          v-if="transitions.length > COLLAPSED_LINES"
          type="button"
          class="patch-notes-link mt-2"
          data-testid="patch-notes-more"
          @click="showAll = !showAll"
        >
          {{ showAll ? 'Show fewer' : `Show all ${transitions.length}` }}
        </button>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useChangesStore } from '@/stores/changes';
import { PART_LABELS, transitionCount, transitionText } from '@/services/diff-format';
import { isRequestCancelled } from '@/services/error-message';
import type { PartName, SharedTransition } from '@/types/changes';

const COLLAPSED_LINES = 8;
const CHANNEL = 'patch-notes';
/** Everything but the misc part, whose transitions are client bookkeeping. */
const PARTS: PartName[] = ['text', 'stats', 'effects', 'actions', 'atkdef'];
const LIMIT = 40;

const props = defineProps<{
  /** Build whose changes these are. */
  version: string;
}>();

const emit = defineEmits<{ (event: 'filter-part', part: PartName): void }>();

const changesStore = useChangesStore();

const open = ref(true);
const showAll = ref(false);
const transitions = ref<SharedTransition[]>([]);
const loading = ref(false);
const error = ref(false);

const shown = computed(() =>
  showAll.value ? transitions.value : transitions.value.slice(0, COLLAPSED_LINES)
);

async function load(): Promise<void> {
  const asked = props.version;
  loading.value = true;
  error.value = false;
  try {
    const response = await changesStore.loadTransitions(
      { version: asked, query: { part: PARTS, limit: LIMIT } },
      CHANNEL
    );
    if (props.version === asked) transitions.value = response.transitions;
  } catch (caught) {
    if (isRequestCancelled(caught) || props.version !== asked) return;
    transitions.value = [];
    error.value = true;
  } finally {
    if (props.version === asked) loading.value = false;
  }
}

watch(
  () => props.version,
  () => {
    transitions.value = [];
    showAll.value = false;
    void load();
  },
  { immediate: true }
);

onBeforeUnmount(() => changesStore.cancel(CHANNEL));
</script>

<style scoped>
.patch-notes {
  @apply rounded-lg border border-surface-200 bg-surface-0 p-4 dark:border-surface-700 dark:bg-surface-900;
}

.patch-notes-header {
  @apply flex flex-wrap items-baseline gap-x-3 gap-y-1;
}

.patch-notes-toggle {
  @apply flex items-center gap-2;
}

.patch-notes-muted {
  @apply text-xs text-surface-500 dark:text-surface-400;
}

.patch-notes-list {
  @apply m-0 mt-2 list-none p-0;
}

.patch-notes-line {
  @apply flex flex-wrap items-baseline gap-x-3 border-t border-surface-200 py-1 text-sm dark:border-surface-700;
}

.patch-notes-text {
  @apply break-words text-surface-900 dark:text-surface-50;
}

.patch-notes-count {
  @apply text-xs text-surface-500 dark:text-surface-400;
}

.patch-notes-link {
  @apply whitespace-nowrap text-xs text-primary-600 hover:underline dark:text-primary-400;
}
</style>

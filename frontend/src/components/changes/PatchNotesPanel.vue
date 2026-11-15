<!--
PatchNotesPanel - the field transitions most changed items of a build share,
in words: "… chance to cast …: Chance 60% → 100% on 760 items". Reads as the
patch notes of the build. A line leads into the list of the items it was done
to.
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
      <span class="patch-notes-muted hidden sm:inline"
        >The same change made to many items at once, most items first</span
      >
      <button
        v-if="open && transitions.length > COLLAPSED_LINES"
        type="button"
        class="patch-notes-link ml-auto"
        data-testid="patch-notes-more"
        :aria-expanded="showAll"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Show fewer' : `Show all ${transitions.length}` }}
      </button>
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
              {{ ' ' }}
              <span class="patch-notes-count">{{ transitionCount(transition) }}</span>
            </span>
            <button
              type="button"
              class="patch-notes-link"
              data-testid="patch-note-filter"
              title="List the items this was done to"
              @click="emit('select', transition)"
            >
              Show these items
            </button>
          </li>
        </ul>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { queryKey, useChangesStore } from '@/stores/changes';
import { isStructuralTransition, transitionCount, transitionText } from '@/services/diff-format';
import { isRequestCancelled } from '@/services/error-message';
import {
  RELEVANCE_NAMES,
  type PartName,
  type RelevanceName,
  type SharedTransition,
  type TransitionsQuery,
} from '@/types/changes';

/** Few enough that the first rows of the list stay on the first screen. */
const COLLAPSED_LINES = 3;
const CHANNEL = 'patch-notes';
/** Everything but the misc part, whose transitions are client bookkeeping. */
const PARTS: PartName[] = ['text', 'stats', 'effects', 'actions', 'atkdef'];
const LIMIT = 40;

const props = defineProps<{
  /** Build whose changes these are. */
  version: string;
  /** The page's relevance filter; empty: every change, whatever it matters for. */
  relevance: RelevanceName[];
  /** The page lists the changes build notes explain with the rest. */
  expandNotes: boolean;
}>();

const emit = defineEmits<{ (event: 'select', transition: SharedTransition): void }>();

const changesStore = useChangesStore();

const open = ref(true);
const showAll = ref(false);
const transitions = ref<SharedTransition[]>([]);
const loading = ref(false);
const error = ref(false);

const shown = computed(() =>
  showAll.value ? transitions.value : transitions.value.slice(0, COLLAPSED_LINES)
);

/**
 * The lines follow the list's filters: what the list leaves out (cosmetic and
 * text changes by default, changes a build note explains) is left out here.
 * Both are always sent, so the answer does not rest on the route's defaults.
 */
const query = computed<TransitionsQuery>(() => ({
  part: PARTS,
  relevance: props.relevance.length ? [...props.relevance] : [...RELEVANCE_NAMES],
  notes: props.expandNotes ? 'expand' : 'collapse',
  limit: LIMIT,
}));

const requestKey = computed(() => `${props.version}|${queryKey(query.value)}`);

async function load(): Promise<void> {
  const asked = requestKey.value;
  loading.value = true;
  error.value = false;
  try {
    const response = await changesStore.loadTransitions(
      { version: props.version, query: query.value },
      CHANNEL
    );
    if (requestKey.value === asked) {
      transitions.value = response.transitions.filter((entry) => !isStructuralTransition(entry));
    }
  } catch (caught) {
    if (isRequestCancelled(caught) || requestKey.value !== asked) return;
    transitions.value = [];
    error.value = true;
  } finally {
    if (requestKey.value === asked) loading.value = false;
  }
}

watch(
  () => props.version,
  () => {
    transitions.value = [];
    showAll.value = false;
  }
);

watch(requestKey, () => void load(), { immediate: true });

onBeforeUnmount(() => changesStore.cancel(CHANNEL));
</script>

<style scoped>
.patch-notes {
  @apply rounded-lg border border-surface-200 bg-surface-0 px-4 py-2 dark:border-surface-700 dark:bg-surface-900;
}

.patch-notes-header {
  @apply flex flex-wrap items-baseline gap-x-3 gap-y-1;
}

.patch-notes-toggle {
  @apply flex items-center gap-2;
}

.patch-notes-muted {
  @apply text-xs text-surface-600 dark:text-surface-400;
}

.patch-notes-list {
  @apply m-0 mt-1 list-none p-0;
}

.patch-notes-line {
  @apply flex flex-wrap items-baseline gap-x-3 border-t border-surface-200 py-0.5 text-sm dark:border-surface-700;
}

.patch-notes-text {
  @apply break-words text-surface-900 dark:text-surface-50;
}

.patch-notes-count {
  @apply text-xs text-surface-500 dark:text-surface-400;
}

.patch-notes-link {
  @apply whitespace-nowrap text-xs text-primary-700 hover:underline dark:text-primary-400;
}
</style>

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
      <span
        v-if="open && lines.length > COLLAPSED_LINES"
        class="patch-notes-controls ml-auto"
        data-testid="patch-notes-controls"
      >
        <span class="patch-notes-muted" data-testid="patch-notes-shown" aria-live="polite">{{
          shownText
        }}</span>
        <button
          v-if="canShowMore"
          type="button"
          class="patch-notes-link"
          data-testid="patch-notes-more"
          :disabled="loading"
          @click="showMore"
        >
          Show more
        </button>
        <button
          v-if="expanded"
          type="button"
          class="patch-notes-link"
          data-testid="patch-notes-fewer"
          @click="expanded = false"
        >
          Show fewer
        </button>
      </span>
    </header>

    <template v-if="open">
      <p v-if="error" class="patch-notes-muted" data-testid="patch-notes-error">
        The patch notes could not be loaded.
        <button type="button" class="underline" @click="load(FIRST_LINES)">Retry</button>
      </p>
      <p v-else-if="loading && !lines.length" class="patch-notes-muted">
        <i class="pi pi-spin pi-spinner mr-1" aria-hidden="true"></i>
        Loading...
      </p>
      <p v-else-if="!lines.length" class="patch-notes-muted" data-testid="patch-notes-empty">
        {{
          part.length
            ? 'No change of this kind is shared by several items in this build.'
            : 'No change is shared by several items in this build.'
        }}
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
        <!-- The same step where a long list ends, so reading on does not mean scrolling back. -->
        <p v-if="expanded" class="patch-notes-foot" data-testid="patch-notes-foot">
          <span v-if="moreFailed" role="alert" data-testid="patch-notes-more-error">
            More lines could not be loaded.
          </span>
          <span v-else-if="capped" data-testid="patch-notes-capped">
            No more than {{ MAX_LINES }} lines are listed. Tick fewer boxes under "What changed" or
            "Matters for" to reach the others.
          </span>
          <span v-else>{{ shownText }}</span>
          <button
            v-if="canShowMore"
            type="button"
            class="patch-notes-link"
            data-testid="patch-notes-more-below"
            :disabled="loading"
            @click="showMore"
          >
            <i v-if="loading" class="pi pi-spin pi-spinner mr-1" aria-hidden="true"></i>
            {{ moreFailed ? 'Retry' : 'Show more' }}
          </button>
        </p>
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
/** Without a choice of the page: everything but the misc part, which is client bookkeeping. */
const PARTS: PartName[] = ['text', 'stats', 'effects', 'actions', 'atkdef'];
/** Lines of the first request, then of each further step. */
const FIRST_LINES = 40;
const STEP_LINES = 100;
/** The most the route gives in one answer; it has no way to ask for the lines after them. */
const MAX_LINES = 500;

const props = defineProps<{
  /** Build whose changes these are. */
  version: string;
  /** The page's "What changed" filter; empty: every part worth a line. */
  part: PartName[];
  /** The page's relevance filter; empty: every change, whatever it matters for. */
  relevance: RelevanceName[];
  /** The page lists the changes build notes explain with the rest. */
  expandNotes: boolean;
}>();

const emit = defineEmits<{ (event: 'select', transition: SharedTransition): void }>();

const changesStore = useChangesStore();

const open = ref(true);
/** Past the first few lines: everything loaded is listed. */
const expanded = ref(false);
const lines = ref<SharedTransition[]>([]);
/** The route has lines after the ones loaded. */
const more = ref(false);
/** Lines the last answer was asked for. */
const loadedSize = ref(FIRST_LINES);
const loading = ref(false);
const error = ref(false);
const moreFailed = ref(false);
let lastRequest = 0;

const shown = computed(() =>
  expanded.value ? lines.value : lines.value.slice(0, COLLAPSED_LINES)
);

/** The route gave all it can and may hold more. */
const capped = computed(() => more.value && loadedSize.value >= MAX_LINES);

const canShowMore = computed(() => !expanded.value || (more.value && !capped.value));

const shownText = computed(() => {
  const count = shown.value.length.toLocaleString('en-US');
  if (more.value) return `First ${count} shown`;
  const total = lines.value.length.toLocaleString('en-US');
  return shown.value.length === lines.value.length ? `All ${total} shown` : `${count} of ${total}`;
});

/**
 * The lines follow the list's filters: what the list leaves out (parts not
 * ticked, cosmetic and text changes by default, changes a build note
 * explains) is left out here. All are always sent, so the answer does not
 * rest on the route's defaults.
 */
const query = computed<TransitionsQuery>(() => ({
  part: props.part.length ? [...props.part] : PARTS,
  relevance: props.relevance.length ? [...props.relevance] : [...RELEVANCE_NAMES],
  notes: props.expandNotes ? 'expand' : 'collapse',
}));

const requestKey = computed(() => `${props.version}|${queryKey(query.value)}`);

/**
 * Ask for the `size` most shared lines. One more is asked for than is listed
 * (while the route allows): its presence is the only sign that lines remain.
 */
async function load(size: number): Promise<void> {
  const request = ++lastRequest;
  const further = size > FIRST_LINES && lines.value.length > 0;
  loading.value = true;
  error.value = false;
  moreFailed.value = false;
  try {
    const response = await changesStore.loadTransitions(
      { version: props.version, query: { ...query.value, limit: Math.min(size + 1, MAX_LINES) } },
      CHANNEL
    );
    if (request !== lastRequest) return;
    const answered = response.transitions;
    more.value = size < MAX_LINES ? answered.length > size : answered.length === MAX_LINES;
    lines.value = answered.slice(0, size).filter((entry) => !isStructuralTransition(entry));
    loadedSize.value = size;
  } catch (caught) {
    if (isRequestCancelled(caught) || request !== lastRequest) return;
    if (further) {
      moreFailed.value = true;
    } else {
      lines.value = [];
      more.value = false;
      error.value = true;
    }
  } finally {
    if (request === lastRequest) loading.value = false;
  }
}

/** The lines already loaded first; then a further step from the route. */
function showMore(): void {
  if (!expanded.value) {
    expanded.value = true;
    return;
  }
  void load(Math.min(loadedSize.value + STEP_LINES, MAX_LINES));
}

watch(
  () => props.version,
  () => {
    lines.value = [];
    more.value = false;
    expanded.value = false;
  }
);

watch(requestKey, () => void load(FIRST_LINES), { immediate: true });

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

.patch-notes-controls {
  @apply flex flex-wrap items-baseline gap-x-3;
}

.patch-notes-foot {
  @apply m-0 flex flex-wrap items-baseline gap-x-3 border-t border-surface-200 pt-1 text-xs text-surface-600 dark:border-surface-700 dark:text-surface-400;
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
  @apply whitespace-nowrap text-xs text-primary-700 hover:underline disabled:cursor-wait disabled:opacity-60 dark:text-primary-400;
}
</style>

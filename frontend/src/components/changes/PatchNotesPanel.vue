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
        <button type="button" class="underline" @click="load(true)">Retry</button>
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
          <span v-else data-testid="patch-notes-foot-shown">{{ shownText }}</span>
          <span v-if="hidden > 0" data-testid="patch-notes-hidden">
            {{ hiddenText }}
          </span>
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
/** Lines of the first request. */
const FIRST_LINES = 40;
/**
 * Lines of a further step: as many again as are loaded, so a build with
 * thousands of lines is gone through in a few steps, within what one answer
 * of the route holds.
 */
const MIN_STEP_LINES = 100;
const MAX_STEP_LINES = 500;

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
/** The lines the route gave so far, in its order. */
const fetched = ref<SharedTransition[]>([]);
/** Lines the route has under the filters, the ones not loaded yet included. */
const total = ref(0);
const loading = ref(false);
const error = ref(false);
const moreFailed = ref(false);
let lastRequest = 0;

const lines = computed(() => fetched.value.filter((entry) => !isStructuralTransition(entry)));

const shown = computed(() =>
  expanded.value ? lines.value : lines.value.slice(0, COLLAPSED_LINES)
);

/** Lines the route gave that are not worth listing (isStructuralTransition). */
const hidden = computed(() => fetched.value.length - lines.value.length);

/** Lines the route has after the ones loaded. */
const unloaded = computed(() => Math.max(0, total.value - fetched.value.length));

const canShowMore = computed(() => !expanded.value || unloaded.value > 0);

function count(value: number): string {
  return value.toLocaleString('en-US');
}

/**
 * Both numbers are exact: the lines on screen, and the lines not on screen
 * yet (loaded or not). The route counts the lines this panel leaves out too,
 * so "more" is said of lines to go through, and hiddenText accounts for the
 * ones that were passed over.
 */
const shownText = computed(() => {
  const remaining = lines.value.length - shown.value.length + unloaded.value;
  if (remaining === 0) return `All ${count(lines.value.length)} shown`;
  if (unloaded.value === 0) return `${count(shown.value.length)} of ${count(lines.value.length)}`;
  return `${count(shown.value.length)} shown, ${count(remaining)} more`;
});

const hiddenText = computed(
  () =>
    `${count(hidden.value)} ${hidden.value === 1 ? 'line that only regroups' : 'lines that only regroup'} ` +
    'requirements (AND, OR) left out.'
);

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
 * The first lines of the filters (`restart`), or the step after the ones
 * loaded. The route's order is fixed, so the steps join up.
 */
async function load(restart: boolean): Promise<void> {
  const request = ++lastRequest;
  const offset = restart ? 0 : fetched.value.length;
  const limit = restart
    ? FIRST_LINES
    : Math.min(MAX_STEP_LINES, Math.max(MIN_STEP_LINES, fetched.value.length));
  loading.value = true;
  error.value = false;
  moreFailed.value = false;
  try {
    const response = await changesStore.loadTransitions(
      {
        version: props.version,
        query: { ...query.value, limit, offset },
      },
      CHANNEL
    );
    if (request !== lastRequest) return;
    fetched.value = restart ? response.transitions : [...fetched.value, ...response.transitions];
    // An empty step: the store changed under the reader; there is nothing after this.
    total.value = response.transitions.length ? response.total : fetched.value.length;
  } catch (caught) {
    if (isRequestCancelled(caught) || request !== lastRequest) return;
    if (restart) {
      fetched.value = [];
      total.value = 0;
      error.value = true;
    } else {
      moreFailed.value = true;
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
  void load(false);
}

watch(
  () => props.version,
  () => {
    fetched.value = [];
    total.value = 0;
    expanded.value = false;
  }
);

watch(requestKey, () => void load(true), { immediate: true });

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

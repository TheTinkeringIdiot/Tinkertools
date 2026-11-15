<!--
BuildNoteLine - a build-wide event that explains many changes at once
("Weapons given an explicit attack range"), as one line with its count.
Opening it lists the changes it explains that match the page's filters, a
page at a time.
-->
<template>
  <li class="build-note" data-testid="build-note" :data-note-id="note.note_id">
    <button
      type="button"
      class="build-note-line"
      data-testid="build-note-toggle"
      :aria-expanded="open"
      :disabled="note.matching === 0"
      :title="note.matching === 0 ? NOTHING_MATCHES : undefined"
      @click="toggle"
    >
      <i
        class="pi text-xs"
        :class="open ? 'pi-chevron-down' : 'pi-chevron-right'"
        aria-hidden="true"
      ></i>
      <span class="build-note-title">{{ note.title }}</span>
      <span class="build-note-count" data-testid="build-note-count">{{ countText }}</span>
    </button>
    <p v-if="note.body" class="build-note-body">{{ note.body }}</p>
    <p v-if="note.matching === 0" class="build-note-body" data-testid="build-note-hint">
      {{ NOTHING_MATCHES }}
    </p>

    <div v-if="open" class="build-note-items" data-testid="build-note-items">
      <p v-if="error" class="text-sm text-red-700 dark:text-red-400" role="alert">
        {{ error }}
        <button type="button" class="underline" @click="load">Retry</button>
      </p>
      <p v-else-if="!page" class="build-note-muted">
        <i class="pi pi-spin pi-spinner mr-1" aria-hidden="true"></i>
        Loading...
      </p>
      <template v-else>
        <ul class="m-0 list-none p-0" :class="{ 'opacity-60': loading }">
          <ChangeRow
            v-for="change in page.items"
            :key="change.aoid"
            :change="change"
            :build="page.build"
            :base="page.base"
          />
        </ul>
        <div v-if="page.pages > 1" class="build-note-pager">
          <button
            type="button"
            class="build-note-page"
            data-testid="build-note-prev"
            :disabled="!page.has_prev || loading"
            @click="go(pageNumber - 1)"
          >
            Previous
          </button>
          <span class="build-note-muted">Page {{ page.page }} of {{ page.pages }}</span>
          <button
            type="button"
            class="build-note-page"
            data-testid="build-note-next"
            :disabled="!page.has_next || loading"
            @click="go(pageNumber + 1)"
          >
            Next
          </button>
        </div>
      </template>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import ChangeRow from './ChangeRow.vue';
import { useChangesStore, queryKey } from '@/stores/changes';
import { errorMessage, isRequestCancelled } from '@/services/error-message';
import type { BuildNote, ChangeListQuery, ChangeListResponse } from '@/types/changes';

const NOTE_PAGE_SIZE = 25;
const NOTHING_MATCHES =
  'None of these changes match the filters, so there is nothing to list. Change the filters to open it.';

const props = defineProps<{
  note: BuildNote;
  /** Build whose note this is. */
  version: string;
  /** The page's filters as request parameters (paging and notes handling are ignored). */
  query: ChangeListQuery;
}>();

const changesStore = useChangesStore();
const channel = computed(() => `build-note:${props.note.note_id}`);

const open = ref(false);
const pageNumber = ref(1);
const page = ref<ChangeListResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const countText = computed(() => {
  const { count, matching } = props.note;
  const total = `${count.toLocaleString('en-US')} ${count === 1 ? 'change' : 'changes'}`;
  if (matching === count) return total;
  return `${matching.toLocaleString('en-US')} of ${total} match the filters`;
});

const request = computed<ChangeListQuery>(() => ({
  ...props.query,
  notes: undefined,
  include_diff: undefined,
  note_id: props.note.note_id,
  page: pageNumber.value,
  page_size: NOTE_PAGE_SIZE,
}));

async function load(): Promise<void> {
  const asked = queryKey(request.value);
  loading.value = true;
  error.value = null;
  try {
    const response = await changesStore.loadChangeList(
      { version: props.version, query: request.value },
      channel.value
    );
    if (queryKey(request.value) === asked) page.value = response;
  } catch (caught) {
    if (isRequestCancelled(caught) || queryKey(request.value) !== asked) return;
    error.value = errorMessage(caught) || 'These changes could not be loaded.';
  } finally {
    if (queryKey(request.value) === asked) loading.value = false;
  }
}

function toggle(): void {
  open.value = !open.value;
  if (open.value) {
    void load();
  } else {
    changesStore.cancel(channel.value);
  }
}

function go(target: number): void {
  pageNumber.value = target;
  void load();
}

// New filters: the open list starts over on its first page.
watch(
  () => [props.version, queryKey({ ...props.query, page: undefined, page_size: undefined })],
  () => {
    pageNumber.value = 1;
    page.value = null;
    if (props.note.matching === 0) open.value = false;
    if (open.value) void load();
  }
);

onBeforeUnmount(() => changesStore.cancel(channel.value));
</script>

<style scoped>
.build-note {
  @apply border-b border-surface-200 py-2 dark:border-surface-700;
}

.build-note-line {
  @apply flex w-full flex-wrap items-center gap-2 text-left text-sm;
}

.build-note-line:disabled {
  @apply cursor-default opacity-60;
}

.build-note-title {
  @apply font-medium text-surface-900 dark:text-surface-50;
}

.build-note-count {
  @apply rounded bg-surface-100 px-1.5 py-0.5 text-xs text-surface-700 dark:bg-surface-800 dark:text-surface-300;
}

.build-note-body,
.build-note-muted {
  @apply text-xs text-surface-500 dark:text-surface-400;
}

.build-note-body {
  @apply ml-5;
}

.build-note-items {
  @apply ml-5 mt-2;
}

.build-note-pager {
  @apply mt-2 flex items-center gap-3;
}

.build-note-page {
  @apply rounded border border-surface-300 px-2 py-0.5 text-xs text-surface-700 disabled:opacity-50 dark:border-surface-600 dark:text-surface-300;
}

@media (max-width: 640px) {
  .build-note-items {
    @apply ml-0;
  }
}
</style>

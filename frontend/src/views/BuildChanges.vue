<!--
BuildChanges - "What changed in this version": the change list of the build
being browsed against the build before it (/<version>/changes), or the net
difference from any other build (/<version>/compare/<base>).

The URL holds the whole view (filters, sort, page), so any view is a link.
Rows are paged by the API and never loaded all at once.
-->
<template>
  <div class="build-changes h-full flex flex-col" data-testid="build-changes">
    <!-- Header -->
    <div
      class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 p-4"
    >
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0">
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
            <i class="pi pi-history mr-2" aria-hidden="true"></i>
            <template v-if="compareBase">Compare builds</template>
            <template v-else>What changed in {{ versionLabel }}</template>
          </h1>
          <p
            class="mt-1 text-sm text-surface-600 dark:text-surface-400"
            data-testid="changes-scope"
          >
            {{ scopeText }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <BuildPicker
            :model-value="compareBase"
            :label="compareBase ? `${versionLabel} compared with` : 'Compare with'"
            placeholder="another build..."
            :exclude="[version]"
            test-id="compare-base-picker"
            @update:model-value="onBasePicked"
          />
          <RouterLink
            v-if="compareBase"
            :to="{ name: 'BuildChanges' }"
            class="text-sm text-primary-600 hover:underline dark:text-primary-400"
            data-testid="compare-exit"
          >
            Back to this build's own changes
          </RouterLink>
        </div>
      </div>

      <!-- Summary counts of the whole comparison -->
      <dl v-if="summary" class="build-changes-summary" data-testid="changes-summary">
        <div class="build-changes-stat">
          <dt>Changes</dt>
          <dd data-testid="summary-total">{{ count(summary.total) }}</dd>
        </div>
        <div v-for="kind in CHANGE_KINDS" :key="kind" class="build-changes-stat">
          <dt>
            <span aria-hidden="true">{{ KIND_MARKS[kind] }}</span>
            {{ KIND_LABELS[kind] }}
          </dt>
          <dd :data-testid="`summary-${kind}`">{{ count(summary.by_kind[kind]) }}</dd>
        </div>
        <div v-for="name in RELEVANCE_NAMES" :key="name" class="build-changes-stat">
          <dt>{{ RELEVANCE_LABELS[name] }}</dt>
          <dd :data-testid="`summary-${name}`">{{ count(summary.by_relevance[name]) }}</dd>
        </div>
        <div v-if="summary.noted > 0" class="build-changes-stat">
          <dt>Explained by notes</dt>
          <dd data-testid="summary-noted">{{ count(summary.noted) }}</dd>
        </div>
      </dl>
    </div>

    <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <!-- Filters -->
      <aside
        class="border-b border-surface-200 dark:border-surface-700 lg:w-72 lg:flex-none lg:overflow-y-auto lg:border-b-0 lg:border-r"
      >
        <button
          type="button"
          class="flex w-full items-center justify-between p-3 text-sm font-medium lg:hidden"
          :aria-expanded="filtersOpen"
          @click="filtersOpen = !filtersOpen"
        >
          Filters{{ activeCount ? ` (${activeCount})` : '' }}
          <i class="pi text-xs" :class="filtersOpen ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
        </button>
        <ChangeFilterPanel
          :class="{ 'hidden lg:block': !filtersOpen }"
          :filters="filters"
          :summary="summary"
          @update="updateFilters"
          @reset="resetFilters"
        />
      </aside>

      <!-- Results -->
      <main class="min-w-0 flex-1 overflow-y-auto p-4">
        <div v-if="sameBuilds" class="py-16 text-center" data-testid="changes-same-build">
          <i class="pi pi-arrows-h mb-4 text-4xl text-surface-400" aria-hidden="true"></i>
          <h3 class="text-lg font-medium text-surface-600 dark:text-surface-400">
            Pick a different build to compare {{ versionLabel }} with
          </h3>
        </div>

        <div v-else-if="error && !response" class="py-16 text-center" data-testid="changes-error">
          <i class="pi pi-exclamation-triangle mb-4 text-4xl text-red-500" aria-hidden="true"></i>
          <h3 class="mb-2 text-lg font-medium text-surface-600 dark:text-surface-400">
            Failed to load changes
          </h3>
          <p class="mb-4 text-surface-500">{{ error }}</p>
          <Button label="Retry" data-testid="changes-retry" @click="load" />
        </div>

        <div
          v-else-if="!response"
          class="flex h-64 items-center justify-center"
          data-testid="changes-loading"
        >
          <ProgressSpinner />
        </div>

        <div v-else class="space-y-4">
          <p
            v-if="!response.base"
            class="rounded border border-surface-200 p-3 text-sm text-surface-700 dark:border-surface-700 dark:text-surface-300"
            data-testid="changes-first-build"
          >
            {{ response.build.display_name }} is the oldest build on record: there is nothing to
            compare it with, so everything in it is listed as added.
          </p>

          <PatchNotesPanel
            v-if="!compareBase && response.base && version"
            :version="version"
            @select="onPatchNote"
          />

          <p
            v-if="activeTransition"
            class="flex flex-wrap items-center gap-2 rounded border border-primary-300 bg-primary-50 p-3 text-sm text-surface-900 dark:border-primary-700 dark:bg-primary-950 dark:text-surface-50"
            data-testid="changes-transition"
          >
            <i class="pi pi-filter" aria-hidden="true"></i>
            <span class="min-w-0 flex-1">
              Only the items with this change:
              <strong class="font-semibold">{{ transitionText(activeTransition) }}</strong>
            </span>
            <button
              type="button"
              class="text-primary-600 hover:underline dark:text-primary-400"
              data-testid="changes-transition-clear"
              @click="updateFilters({ transition: null })"
            >
              Show all changes
            </button>
          </p>

          <!-- Build notes -->
          <section v-if="shownNotes.length" data-testid="build-notes" aria-label="Build notes">
            <h2 class="text-base font-semibold text-surface-900 dark:text-surface-50">
              Explained in one line
            </h2>
            <p class="text-xs text-surface-500 dark:text-surface-400">
              Build-wide events that account for many changes at once. Their changes are left out of
              the list below.
            </p>
            <ul class="m-0 mt-1 list-none p-0">
              <BuildNoteLine
                v-for="note in shownNotes"
                :key="note.note_id"
                :note="note"
                :version="response.build.slug"
                :query="request"
              />
            </ul>
          </section>

          <!-- List header -->
          <section aria-label="Changes">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-sm text-surface-600 dark:text-surface-400" data-testid="changes-count">
                {{ listCountText }}
                <button
                  v-if="hidesByDefault"
                  type="button"
                  class="ml-2 text-primary-600 hover:underline dark:text-primary-400"
                  data-testid="changes-show-all"
                  @click="updateFilters({ relevance: [] })"
                >
                  Show cosmetic and text changes too
                </button>
              </p>

              <div class="flex flex-wrap items-center gap-3 text-sm">
                <label
                  v-if="(response.notes.length || filters.expandNotes) && !filters.transition"
                  class="build-changes-option"
                >
                  <input
                    type="checkbox"
                    :checked="filters.expandNotes"
                    data-testid="changes-expand-notes"
                    @change="updateFilters({ expandNotes: !filters.expandNotes })"
                  />
                  Include changes explained by notes
                </label>
                <label class="build-changes-option">
                  <input
                    type="checkbox"
                    :checked="filters.showDiffs"
                    data-testid="changes-show-diffs"
                    @change="updateFilters({ showDiffs: !filters.showDiffs }, { keepPage: true })"
                  />
                  Show every diff
                </label>
                <label class="build-changes-option">
                  Sort by
                  <select
                    class="build-changes-select"
                    :value="filters.sort"
                    data-testid="changes-sort"
                    @change="onSort"
                  >
                    <option value="name">Name</option>
                    <option value="ql">Quality level</option>
                    <option value="aoid">Item id</option>
                  </select>
                </label>
              </div>
            </div>

            <p
              v-if="error"
              class="mt-2 text-sm text-red-700 dark:text-red-400"
              role="alert"
              data-testid="changes-refresh-error"
            >
              {{ error }}
              <button type="button" class="underline" @click="load">Retry</button>
            </p>

            <div
              v-if="response.items.length === 0"
              class="py-12 text-center"
              data-testid="changes-empty"
            >
              <i class="pi pi-search mb-4 text-4xl text-surface-400" aria-hidden="true"></i>
              <h3 class="mb-2 text-lg font-medium text-surface-600 dark:text-surface-400">
                {{ response.summary.total === 0 ? 'Nothing differs' : 'No changes match' }}
              </h3>
              <p class="text-surface-500">
                {{
                  response.summary.total === 0
                    ? 'These two builds define every item the same way.'
                    : 'Try fewer filters.'
                }}
              </p>
            </div>

            <ul
              v-else
              class="m-0 mt-2 list-none p-0 transition-opacity"
              :class="{ 'opacity-60': loading }"
              :aria-busy="loading"
              data-testid="changes-list"
            >
              <ChangeRow
                v-for="change in response.items"
                :key="change.aoid"
                :change="change"
                :build="response.build"
                :base="response.base"
                :start-open="filters.showDiffs"
                :link-comparison="!!compareBase"
              />
            </ul>

            <Paginator
              v-if="response.total > response.page_size || response.page > 1"
              class="mt-3"
              :first="(response.page - 1) * response.page_size"
              :rows="response.page_size"
              :total-records="response.total"
              :rows-per-page-options="[...PAGE_SIZE_OPTIONS]"
              template="FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink RowsPerPageDropdown"
              current-page-report-template="Page {currentPage} of {totalPages}"
              data-testid="changes-paginator"
              @page="onPage"
            />
          </section>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter, type LocationQueryRaw } from 'vue-router';
import Button from 'primevue/button';
import Paginator, { type PageState } from 'primevue/paginator';
import ProgressSpinner from 'primevue/progressspinner';
import BuildPicker from '@/components/versions/BuildPicker.vue';
import BuildNoteLine from '@/components/changes/BuildNoteLine.vue';
import ChangeFilterPanel from '@/components/changes/ChangeFilterPanel.vue';
import ChangeRow from '@/components/changes/ChangeRow.vue';
import PatchNotesPanel from '@/components/changes/PatchNotesPanel.vue';
import { useGameVersion } from '@/composables/useGameVersion';
import { useChangesStore, queryKey } from '@/stores/changes';
import {
  CHANGE_FILTER_KEYS,
  DEFAULT_RELEVANCE,
  PAGE_SIZE_OPTIONS,
  activeFilterCount,
  changeFiltersToQuery,
  changeFiltersToRequest,
  defaultChangeFilters,
  parseChangeFilters,
  transitionFilterValues,
  type ChangeFilters,
} from '@/services/change-filters';
import {
  KIND_LABELS,
  KIND_MARKS,
  RELEVANCE_LABELS,
  transitionFromPath,
  transitionText,
} from '@/services/diff-format';
import { errorMessage, isRequestCancelled } from '@/services/error-message';
import { buildLabel, sameBuild } from '@/utils/version-order';
import {
  CHANGE_KINDS,
  RELEVANCE_NAMES,
  type ChangeListResponse,
  type ChangeSort,
  type SharedTransition,
  type TransitionValue,
} from '@/types/changes';

const CHANNEL = 'change-list';

const route = useRoute();
const router = useRouter();
const changesStore = useChangesStore();
const { dataVersion: version } = useGameVersion();

const response = ref<ChangeListResponse | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const filtersOpen = ref(false);

/** The older side of a build comparison; null on the build's own change list. */
const compareBase = computed(() => {
  if (route.name !== 'BuildCompare') return null;
  const base = route.params.base;
  return typeof base === 'string' && base ? base : null;
});

const sameBuilds = computed(
  () => !!compareBase.value && sameBuild(compareBase.value, version.value)
);

const filters = computed(() => parseChangeFilters(route.query));
/** A comparison of two arbitrary builds has no transitions to filter by. */
const request = computed(() =>
  changeFiltersToRequest(compareBase.value ? { ...filters.value, transition: null } : filters.value)
);
const activeCount = computed(() => activeFilterCount(filters.value));

const summary = computed(() => response.value?.summary ?? null);
const versionLabel = computed(() => buildLabel(version.value, [response.value?.build]));

const scopeText = computed(() => {
  const answered = response.value;
  if (compareBase.value) {
    const base = buildLabel(compareBase.value, [answered?.base]);
    return `Net difference between ${base} and ${versionLabel.value}: every item that is not the same in both.`;
  }
  if (!answered) return 'Compared with the build before it.';
  if (!answered.base) return 'The oldest build on record.';
  if (answered.base.family !== answered.build.family) {
    return `Compared with ${answered.base.display_name}, the build it was forked from.`;
  }
  return `Compared with ${answered.base.display_name}, the build before it.`;
});

/** Notes collapsed into single lines (none when their changes are listed with the rest). */
const shownNotes = computed(() =>
  filters.value.expandNotes || filters.value.transition ? [] : (response.value?.notes ?? [])
);

/** The transition the list is narrowed to, in the shape the patch notes word. */
const activeTransition = computed<SharedTransition | null>(() => {
  const filter = filters.value.transition;
  if (!filter || compareBase.value) return null;
  const values = transitionFilterValues(filter);
  return transitionFromPath(
    filter.path,
    (values.old ?? null) as TransitionValue,
    (values.new ?? null) as TransitionValue
  );
});

const hidesByDefault = computed(
  () =>
    filters.value.relevance.length === DEFAULT_RELEVANCE.length &&
    DEFAULT_RELEVANCE.every((name) => filters.value.relevance.includes(name))
);

function count(value: number): string {
  return value.toLocaleString('en-US');
}

const listCountText = computed(() => {
  const answered = response.value;
  if (!answered) return '';
  const noun = answered.total === 1 ? 'change' : 'changes';
  if (answered.total === 0) return 'No changes listed';
  const from = (answered.page - 1) * answered.page_size + 1;
  const to = from + answered.items.length - 1;
  return `${count(from)}-${count(to)} of ${count(answered.total)} ${noun}`;
});

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/** Everything a request depends on; a change of scope drops the page shown. */
const scopeKey = computed(() => `${version.value ?? ''}|${compareBase.value ?? ''}`);
const requestKey = computed(() => `${scopeKey.value}|${queryKey(request.value)}`);

async function load(): Promise<void> {
  if (!version.value || sameBuilds.value) {
    changesStore.cancel(CHANNEL);
    response.value = null;
    loading.value = false;
    error.value = null;
    return;
  }
  const asked = requestKey.value;
  loading.value = true;
  error.value = null;
  try {
    const answered = await changesStore.loadChangeList(
      { version: version.value, base: compareBase.value, query: request.value },
      CHANNEL
    );
    if (requestKey.value === asked) response.value = answered;
  } catch (caught) {
    if (isRequestCancelled(caught) || requestKey.value !== asked) return;
    error.value = errorMessage(caught) || 'The changes could not be loaded.';
  } finally {
    if (requestKey.value === asked) loading.value = false;
  }
}

watch(scopeKey, () => {
  response.value = null;
});

watch(requestKey, () => void load(), { immediate: true });

onBeforeUnmount(() => changesStore.cancel(CHANNEL));

// ---------------------------------------------------------------------------
// The URL is the state
// ---------------------------------------------------------------------------

/** Query parameters of the URL that are not filters of this page. */
function foreignQuery(): LocationQueryRaw {
  const kept: LocationQueryRaw = {};
  for (const [key, value] of Object.entries(route.query)) {
    if (!CHANGE_FILTER_KEYS.includes(key)) kept[key] = value;
  }
  return kept;
}

async function writeFilters(next: ChangeFilters, mode: 'push' | 'replace'): Promise<void> {
  const target = {
    name: route.name ?? 'BuildChanges',
    params: { ...route.params },
    query: changeFiltersToQuery(next, foreignQuery()),
  };
  await (mode === 'push' ? router.push(target) : router.replace(target));
}

/** A filter change starts over on the first page. */
function updateFilters(patch: Partial<ChangeFilters>, options: { keepPage?: boolean } = {}): void {
  const next = { ...(pendingFilters ?? filters.value), ...patch };
  if (!options.keepPage) next.page = 1;
  pendingFilters = next;
  void writeFilters(next, 'replace').finally(() => {
    if (pendingFilters === next) pendingFilters = null;
  });
}

/**
 * Filters on their way into the URL. Navigation is asynchronous, so a second
 * change made before the first has landed builds on this, not on the route.
 */
let pendingFilters: ChangeFilters | null = null;

function resetFilters(): void {
  const defaults = defaultChangeFilters();
  void writeFilters(
    {
      ...defaults,
      sort: filters.value.sort,
      pageSize: filters.value.pageSize,
      expandNotes: filters.value.expandNotes,
      showDiffs: filters.value.showDiffs,
    },
    'replace'
  );
}

function onSort(event: Event): void {
  updateFilters({ sort: (event.target as HTMLSelectElement).value as ChangeSort });
}

function onPage(event: PageState): void {
  const sizeChanged = event.rows !== filters.value.pageSize;
  void writeFilters(
    { ...filters.value, pageSize: event.rows, page: sizeChanged ? 1 : event.page + 1 },
    'push'
  );
}

/** A patch note leads to the items it was done to, whatever else is filtered. */
function onPatchNote(transition: SharedTransition): void {
  updateFilters({
    ...defaultChangeFilters(),
    relevance: [],
    sort: filters.value.sort,
    pageSize: filters.value.pageSize,
    showDiffs: filters.value.showDiffs,
    transition: {
      path: transition.path,
      old: JSON.stringify(transition.old),
      new: JSON.stringify(transition.new),
    },
  });
}

/** Picking a base compares the two builds; clearing it returns to the build's own changes. */
function onBasePicked(slug: string | null): void {
  const query = changeFiltersToQuery({ ...filters.value, page: 1 }, foreignQuery());
  if (slug) {
    void router.push({ name: 'BuildCompare', params: { ...route.params, base: slug }, query });
  } else {
    void router.push({
      name: 'BuildChanges',
      params: { version: route.params.version },
      query,
    });
  }
}
</script>

<style scoped>
.build-changes-summary {
  @apply m-0 mt-3 flex flex-wrap gap-x-6 gap-y-2;
}

.build-changes-stat dt {
  @apply text-xs text-surface-500 dark:text-surface-400;
}

.build-changes-stat dd {
  @apply m-0 text-lg font-semibold text-surface-900 dark:text-surface-50;
}

.build-changes-option {
  @apply flex items-center gap-2 text-surface-700 dark:text-surface-300;
}

.build-changes-select {
  @apply rounded border border-surface-300 bg-surface-0 px-2 py-1 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-950 dark:text-surface-50;
}
</style>

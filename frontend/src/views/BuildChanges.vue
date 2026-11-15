<!--
BuildChanges - "What changed in this version": the change list of the build
being browsed against the build before it (/<version>/changes), or the net
difference from any other build (/<version>/compare/<base>).

A comparison always reads from the older build to the newer one, whichever of
the two is being browsed: the URL keeps the pair as the user chose it, the
request and everything on the page are ordered by the registry (orderBuilds).

The URL holds the whole view (filters, sort, page), so any view is a link.
Rows are paged by the API and never loaded all at once.
-->
<template>
  <div class="build-changes h-full flex flex-col" data-testid="build-changes">
    <!-- Header -->
    <div
      class="bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700 px-4 py-3"
    >
      <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0">
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">
            <i class="pi pi-history mr-2" aria-hidden="true"></i>
            <template v-if="compareBase">Compare builds</template>
            <template v-else>What changed in {{ versionLabel }}</template>
          </h1>
          <p
            v-if="comparison && !baseUnknown"
            class="mt-1 text-sm text-surface-600 dark:text-surface-400"
            data-testid="changes-scope"
          >
            From
            <strong class="build-changes-side" data-testid="compare-older">{{
              comparison.olderLabel
            }}</strong>
            (older) to
            <strong class="build-changes-side" data-testid="compare-newer">{{
              comparison.newerLabel
            }}</strong>
            (newer): every item that is not the same in both. Added items are only in
            {{ comparison.newerLabel }}, removed items only in {{ comparison.olderLabel }}.
            <span v-if="comparison.forkRule" data-testid="compare-fork-rule">
              {{ comparison.forkRule }}
            </span>
            <span v-if="comparison.viewedIsOlder" data-testid="compare-viewed-older">
              You are browsing {{ comparison.olderLabel }}, the older of the two.
            </span>
          </p>
          <p
            v-else
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
            class="text-sm text-primary-700 hover:underline dark:text-primary-400"
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
        <div class="flex items-center gap-3 px-3 lg:hidden">
          <button
            type="button"
            class="flex flex-1 items-center gap-2 py-3 text-left text-sm font-medium"
            data-testid="changes-filters-toggle"
            :aria-expanded="filtersOpen"
            @click="filtersOpen = !filtersOpen"
          >
            <i class="pi text-xs" :class="filtersOpen ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
            Filters{{ activeCount ? ` (${activeCount})` : '' }}
          </button>
          <button
            v-if="response && !filtersOpen"
            type="button"
            class="build-changes-link whitespace-nowrap text-sm"
            data-testid="changes-jump"
            @click="showResults"
          >
            {{ resultsText }}
            <i class="pi pi-arrow-down text-xs" aria-hidden="true"></i>
          </button>
        </div>
        <ChangeFilterPanel
          :class="{ 'hidden lg:block': !filtersOpen }"
          :filters="filters"
          :summary="summary"
          @update="updateFilters"
          @reset="resetFilters"
        />
        <!--
          On a narrow screen the open panel covers the list: one tap closes it and goes there.
          The background is a utility class: main.css gives the surface colours to those only.
        -->
        <div
          v-if="filtersOpen"
          class="build-changes-apply bg-surface-0 dark:bg-surface-950 lg:hidden"
        >
          <button
            type="button"
            class="build-changes-apply-button"
            data-testid="changes-show-results"
            @click="showResults"
          >
            {{ loading || !response ? 'Show the changes' : `Show ${resultsText}` }}
          </button>
        </div>
      </aside>

      <!-- Results -->
      <main id="changes-results" class="min-w-0 flex-1 overflow-y-auto px-4 py-3">
        <div v-if="sameBuilds" class="py-16 text-center" data-testid="changes-same-build">
          <i class="pi pi-arrows-h mb-4 text-4xl text-surface-400" aria-hidden="true"></i>
          <h3 class="text-lg font-medium text-surface-600 dark:text-surface-400">
            Pick a different build to compare {{ versionLabel }} with
          </h3>
        </div>

        <div v-else-if="baseUnknown" class="py-16 text-center" data-testid="changes-error">
          <i class="pi pi-search mb-4 text-4xl text-surface-400" aria-hidden="true"></i>
          <h3 class="mb-2 text-lg font-medium text-surface-600 dark:text-surface-400">
            No build named "{{ compareBase }}"
          </h3>
          <p class="text-surface-500">
            Pick a build to compare {{ versionLabel }} with from the list above.
          </p>
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

        <div v-else class="space-y-3">
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
            :relevance="filters.relevance"
            :expand-notes="filters.expandNotes"
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
              class="build-changes-link"
              data-testid="changes-transition-clear"
              @click="updateFilters({ transition: null })"
            >
              Show all changes
            </button>
          </p>

          <!-- Build notes -->
          <section v-if="shownNotes.length" data-testid="build-notes" aria-label="Build notes">
            <div class="flex flex-wrap items-baseline gap-x-3">
              <h2 class="text-base font-semibold text-surface-900 dark:text-surface-50">
                Explained in one line
              </h2>
              <p class="text-xs text-surface-600 dark:text-surface-400">
                Build-wide events; their changes are left out of the list below.
              </p>
            </div>
            <ul class="m-0 list-none p-0">
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
          <section id="changes-list-top" aria-label="Changes" class="scroll-mt-2">
            <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <p class="text-sm text-surface-600 dark:text-surface-400" data-testid="changes-count">
                {{ listCountText }}
                <button
                  v-if="hidesByDefault"
                  type="button"
                  class="build-changes-link ml-2"
                  data-testid="changes-show-all"
                  @click="updateFilters({ relevance: [] })"
                >
                  Show cosmetic and text changes too
                </button>
              </p>

              <div class="flex flex-wrap items-center gap-3 text-sm">
                <label
                  v-if="response.notes.length || filters.expandNotes"
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
              class="m-0 mt-1 list-none p-0 transition-opacity"
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
                :viewed="version"
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
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
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
import { getVersion } from '@/composables/useGameVersion';
import { buildLabel, familyTitle, orderBuilds, sameBuild } from '@/utils/version-order';
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
/** HTTP status of a failed request whose answer was "there is no such thing". */
const errorStatus = ref<number | null>(null);
const filtersOpen = ref(false);

/** The build the browsed one is compared with; null on the build's own change list. */
const compareBase = computed(() => {
  if (route.name !== 'BuildCompare') return null;
  const base = route.params.base;
  return typeof base === 'string' && base ? base : null;
});

const sameBuilds = computed(
  () => !!compareBase.value && sameBuild(compareBase.value, version.value)
);

/** The base named in the URL is not a build the backend knows. */
const baseUnknown = computed(
  () => !!compareBase.value && !sameBuilds.value && !response.value && errorStatus.value === 404
);

const filters = computed(() => parseChangeFilters(route.query));
/** A comparison of two arbitrary builds has no transitions to filter by. */
const request = computed(() =>
  changeFiltersToRequest(compareBase.value ? { ...filters.value, transition: null } : filters.value)
);
const activeCount = computed(() => activeFilterCount(filters.value));

const summary = computed(() => response.value?.summary ?? null);
const versionLabel = computed(() => buildLabel(version.value, [response.value?.build]));

/**
 * The two builds of a comparison, older first. The registry decides which is
 * which (a fork's builds count as newer than the family they forked from);
 * the browsed build is the newer side only when the registry says so or
 * cannot tell.
 */
const comparison = computed(() => {
  if (!compareBase.value || !version.value || sameBuilds.value) return null;
  const { older, newer } = orderBuilds(version.value, compareBase.value);
  const known = [response.value?.build, response.value?.base];
  const olderFamily = getVersion(older)?.family;
  const newerFamily = getVersion(newer)?.family;
  return {
    older,
    newer,
    olderLabel: buildLabel(older, known),
    newerLabel: buildLabel(newer, known),
    viewedIsOlder: sameBuild(older, version.value),
    forkRule:
      olderFamily && newerFamily && olderFamily !== newerFamily
        ? `${familyTitle(newerFamily)} is a fork of ${familyTitle(olderFamily)}, so its build always counts as the newer one.`
        : '',
  };
});

const scopeText = computed(() => {
  if (sameBuilds.value) return `${versionLabel.value} cannot be compared with itself.`;
  if (baseUnknown.value) return `"${compareBase.value}" is not a build on record.`;
  const answered = response.value;
  if (!answered) return 'Compared with the build before it.';
  if (!answered.base) return 'The oldest build on record.';
  if (answered.base.family !== answered.build.family) {
    return `Compared with ${answered.base.display_name}, the build it was forked from.`;
  }
  return `Compared with ${answered.base.display_name}, the build before it.`;
});

/** Notes collapsed into single lines (none when their changes are listed with the rest). */
const shownNotes = computed(() => (filters.value.expandNotes ? [] : (response.value?.notes ?? [])));

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
  if (answered.total === 0 || answered.items.length === 0) return 'No changes listed';
  const from = (answered.page - 1) * answered.page_size + 1;
  const to = from + answered.items.length - 1;
  return `${count(from)}-${count(to)} of ${count(answered.total)} ${noun}`;
});

/** "26,516 changes": what the filters leave, for the controls that lead to the list. */
const resultsText = computed(() => {
  const total = response.value?.total ?? 0;
  return `${count(total)} ${total === 1 ? 'change' : 'changes'}`;
});

/** Close the filters (they cover the list on a narrow screen) and go to the list. */
async function showResults(): Promise<void> {
  filtersOpen.value = false;
  await nextTick();
  const list =
    document.getElementById('changes-list-top') ?? document.getElementById('changes-results');
  if (list && typeof list.scrollIntoView === 'function') list.scrollIntoView({ block: 'start' });
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

/** Everything a request depends on; a change of scope drops the page shown. */
const scopeKey = computed(
  () =>
    `${version.value ?? ''}|${compareBase.value ?? ''}|${comparison.value?.older ?? ''}|${comparison.value?.newer ?? ''}`
);
const requestKey = computed(() => `${scopeKey.value}|${queryKey(request.value)}`);

async function load(): Promise<void> {
  if (!version.value || sameBuilds.value) {
    changesStore.cancel(CHANNEL);
    response.value = null;
    loading.value = false;
    error.value = null;
    errorStatus.value = null;
    return;
  }
  const asked = requestKey.value;
  loading.value = true;
  error.value = null;
  errorStatus.value = null;
  try {
    const pair = comparison.value;
    const answered = await changesStore.loadChangeList(
      pair
        ? { version: pair.newer, base: pair.older, query: request.value }
        : { version: version.value, query: request.value },
      CHANNEL
    );
    if (requestKey.value !== asked) return;
    const lastPage = Math.max(1, answered.pages);
    if (answered.page > lastPage) {
      // A page past the end (an old link, a hand-edited URL): show the last one.
      await writeFilters({ ...filters.value, page: lastPage }, 'replace');
      return;
    }
    response.value = answered;
  } catch (caught) {
    if (isRequestCancelled(caught) || requestKey.value !== asked) return;
    const status = (caught as { status?: unknown } | null)?.status;
    errorStatus.value = typeof status === 'number' ? status : null;
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

/**
 * A filter change starts over on the first page. Each change is a step of the
 * browser history, so Back undoes it; only typing in the search box is not
 * (a step per pause in typing would bury the page before it).
 */
function updateFilters(patch: Partial<ChangeFilters>, options: { keepPage?: boolean } = {}): void {
  const next = { ...(pendingFilters ?? filters.value), ...patch };
  if (!options.keepPage) next.page = 1;
  pendingFilters = next;
  const keys = Object.keys(patch);
  const typing = keys.length === 1 && TYPED_FILTERS.includes(keys[0]);
  void writeFilters(next, typing ? 'replace' : 'push').finally(() => {
    if (pendingFilters === next) pendingFilters = null;
  });
}

/** Filters typed a character at a time: a step of history per pause would bury the page before. */
const TYPED_FILTERS = ['search', 'minQl', 'maxQl'];

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
    'push'
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

/**
 * A patch note leads to the items it was done to, whatever else is filtered.
 * What the notes were read under stays (relevance, noted changes), so the
 * list counts what the line counted and the notes do not change under the reader.
 */
function onPatchNote(transition: SharedTransition): void {
  updateFilters({
    ...defaultChangeFilters(),
    relevance: filters.value.relevance,
    expandNotes: filters.value.expandNotes,
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
  @apply m-0 mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-sm;
}

.build-changes-stat {
  @apply flex items-baseline gap-1.5;
}

.build-changes-link {
  @apply text-primary-700 hover:underline dark:text-primary-400;
}

.build-changes-apply {
  @apply sticky bottom-0 border-t border-surface-200 p-3 dark:border-surface-700;
}

.build-changes-apply-button {
  @apply w-full rounded bg-primary-700 px-3 py-2 text-sm font-semibold text-white;
}

.build-changes-side {
  @apply font-semibold text-surface-900 dark:text-surface-50;
}

.build-changes-stat dt {
  @apply text-xs text-surface-600 dark:text-surface-400;
}

.build-changes-stat dd {
  @apply m-0 font-semibold text-surface-900 dark:text-surface-50;
}

.build-changes-option {
  @apply flex items-center gap-2 text-surface-700 dark:text-surface-300;
}

.build-changes-select {
  @apply rounded border border-surface-300 bg-surface-0 px-2 py-1 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-950 dark:text-surface-50;
}
</style>

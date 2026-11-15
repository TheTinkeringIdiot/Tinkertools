<!--
ItemTimeline - every build in which an item was added, changed or removed,
newest first. Each step names the build, the kind of change, the parts it
touched, what it matters for and the build note that explains it, and opens
to the field-level diff. Any step can be peeked at: the parent then shows the
item as that build defines it.
-->
<template>
  <section class="item-timeline" data-testid="item-history-panel" aria-label="Item history">
    <header class="item-timeline-header">
      <h3 class="text-base font-semibold">
        <i class="pi pi-history mr-1 text-blue-500" aria-hidden="true"></i>
        History
      </h3>
      <span class="text-xs text-surface-500 dark:text-surface-400">
        {{ entries.length }} {{ entries.length === 1 ? 'build' : 'builds' }} touched this
        {{ isNano ? 'nano' : 'item' }}, newest first
      </span>
      <button
        v-if="expandable.length > 1"
        type="button"
        class="item-timeline-link ml-auto"
        data-testid="item-history-expand-all"
        @click="toggleAll"
      >
        {{ allOpen ? 'Collapse all' : 'Expand all' }}
      </button>
    </header>

    <ol class="item-timeline-list">
      <li
        v-for="(entry, index) in entries"
        :key="entry.build.slug"
        class="item-timeline-entry"
        :class="{ 'item-timeline-entry-viewed': index === viewedIndex }"
        data-testid="item-history-entry"
        :data-slug="entry.build.slug"
        :data-kind="entry.kind"
      >
        <div class="item-timeline-row">
          <button
            v-if="entry.diff"
            type="button"
            class="item-timeline-toggle"
            data-testid="item-history-toggle"
            :aria-expanded="isOpen(entry)"
            :aria-label="`${isOpen(entry) ? 'Hide' : 'Show'} what changed in ${entry.build.display_name}`"
            @click="toggle(entry)"
          >
            <i
              class="pi text-xs"
              :class="isOpen(entry) ? 'pi-chevron-down' : 'pi-chevron-right'"
              aria-hidden="true"
            ></i>
          </button>
          <span v-else class="item-timeline-toggle" aria-hidden="true"></span>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span class="font-medium text-surface-900 dark:text-surface-50">
                {{ entry.build.display_name }}
              </span>
              <span v-if="entry.build.snapshot_date" class="item-timeline-muted">
                {{ entry.build.snapshot_date }}
              </span>
              <ChangeBadges :kind="entry.kind" :parts="entry.parts" :relevance="entry.relevance" />
              <span
                v-if="index === viewedIndex"
                class="item-timeline-viewed"
                data-testid="item-history-viewed"
              >
                shown now
              </span>
            </div>
            <p class="item-timeline-muted">{{ describe(entry, index) }}</p>
            <p v-if="entry.note" class="item-timeline-note" data-testid="item-history-note">
              <i class="pi pi-info-circle mr-1" aria-hidden="true"></i>
              <span class="font-medium">{{ entry.note.title }}</span>
              <span v-if="entry.note.body">: {{ entry.note.body }}</span>
            </p>
          </div>

          <button
            v-if="peekTarget(entry)"
            type="button"
            class="item-timeline-link"
            data-testid="item-history-peek"
            :data-slug="peekTarget(entry)?.slug"
            @click="emit('peek', peekTarget(entry)!.slug)"
          >
            <i class="pi pi-eye mr-1" aria-hidden="true"></i>
            {{ entry.kind === 'removed' ? 'View before removal' : 'View as of this build' }}
          </button>
        </div>

        <div v-if="entry.diff && isOpen(entry)" class="item-timeline-diff">
          <ItemDiffView :diff="entry.diff" :is-nano="isNano" :item-class="itemClass" />
        </div>
      </li>
    </ol>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ChangeBadges from '@/components/changes/ChangeBadges.vue';
import ItemDiffView from '@/components/changes/ItemDiffView.vue';
import { registryPosition } from '@/utils/version-order';
import type { BuildRef, ItemTimelineResponse, TimelineEntry } from '@/types/changes';

const props = withDefaults(
  defineProps<{
    timeline: ItemTimelineResponse;
    /** Build the item on the page was loaded from (peeked or browsed). */
    requestVersion: string | null;
    isNano?: boolean;
    itemClass?: number;
  }>(),
  { isNano: false, itemClass: undefined }
);

const emit = defineEmits<{ (event: 'peek', slug: string): void }>();

const entries = computed(() => props.timeline.entries);
const expandable = computed(() => entries.value.filter((entry) => entry.diff));

/** Slugs of the open steps. Starts with the newest step that has a diff. */
const open = ref<Set<string>>(new Set());

watch(
  () => props.timeline,
  () => {
    const first = expandable.value[0];
    open.value = new Set(first ? [first.build.slug] : []);
  },
  { immediate: true }
);

const allOpen = computed(
  () => expandable.value.length > 0 && expandable.value.every((e) => open.value.has(e.build.slug))
);

function isOpen(entry: TimelineEntry): boolean {
  return open.value.has(entry.build.slug);
}

function toggle(entry: TimelineEntry): void {
  const next = new Set(open.value);
  if (!next.delete(entry.build.slug)) next.add(entry.build.slug);
  open.value = next;
}

function toggleAll(): void {
  open.value = allOpen.value ? new Set() : new Set(expandable.value.map((e) => e.build.slug));
}

/**
 * The step in effect for the build on the page: the newest one that is not
 * newer than that build.
 */
const viewedIndex = computed(() => {
  if (!props.requestVersion) return -1;
  const viewed = registryPosition(props.requestVersion);
  if (viewed === Number.MAX_SAFE_INTEGER) return -1;
  const index = entries.value.findIndex((entry) => registryPosition(entry.build.slug) >= viewed);
  return index !== -1 && entries.value[index].kind !== 'removed' ? index : -1;
});

/** The build to peek at for a step: the step's own, or the one before a removal. */
function peekTarget(entry: TimelineEntry): BuildRef | null {
  return entry.kind === 'removed' ? entry.base : entry.build;
}

function describe(entry: TimelineEntry, index: number): string {
  const against = entry.base ? ` (compared with ${entry.base.display_name})` : '';
  if (entry.kind === 'removed') return `Removed from the game data${against}`;
  if (entry.kind === 'added') {
    const returned = entries.value.slice(index + 1).some((older) => older.kind === 'removed');
    if (returned) return `Returned to the game data${against}`;
    return entry.base
      ? `First appears in this build${against}`
      : 'Present in the oldest build on record';
  }
  return `Changed${against}`;
}
</script>

<style scoped>
.item-timeline {
  @apply rounded-lg border border-surface-200 bg-surface-0 p-4 dark:border-surface-700 dark:bg-surface-900;
}

.item-timeline-header {
  @apply mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1;
}

.item-timeline-list {
  @apply m-0 max-h-[32rem] list-none overflow-y-auto p-0;
}

.item-timeline-entry {
  @apply border-t border-surface-200 py-2 dark:border-surface-700;
}

.item-timeline-entry-viewed {
  @apply bg-surface-50 dark:bg-surface-800;
}

.item-timeline-row {
  @apply flex flex-wrap items-start gap-2;
}

.item-timeline-toggle {
  @apply mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800;
}

.item-timeline-muted {
  @apply text-xs text-surface-500 dark:text-surface-400;
}

.item-timeline-note {
  @apply mt-1 text-xs text-surface-700 dark:text-surface-300;
}

.item-timeline-viewed {
  @apply rounded bg-primary-100 px-1.5 py-0.5 text-xs font-medium text-primary-800 dark:bg-primary-900 dark:text-primary-200;
}

.item-timeline-link {
  @apply whitespace-nowrap text-xs text-primary-600 hover:underline dark:text-primary-400;
}

.item-timeline-diff {
  @apply ml-8 mt-2 rounded border border-surface-200 p-3 dark:border-surface-700;
}

@media (max-width: 640px) {
  .item-timeline-diff {
    @apply ml-0;
  }
}
</style>

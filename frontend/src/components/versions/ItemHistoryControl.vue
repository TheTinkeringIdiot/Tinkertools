<!--
ItemHistoryControl - "History" dropdown of the patch points at which an item's
definition changed. Picking one is a peek: the parent sets ?as=<slug> and
reloads the item from that snapshot without changing the browsing version.
-->
<template>
  <div v-if="visible" ref="rootEl" class="item-history-control relative">
    <Button
      icon="pi pi-history"
      :label="`History (${entries.length})`"
      severity="secondary"
      outlined
      size="small"
      data-testid="item-history-trigger"
      :aria-expanded="open"
      @click="open = !open"
    />

    <div
      v-if="open"
      data-testid="item-history-panel"
      class="absolute left-0 z-50 mt-1 w-80 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 shadow-lg"
    >
      <ul class="max-h-80 overflow-y-auto py-1">
        <li v-for="entry in entries" :key="entry.slug">
          <button
            type="button"
            class="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-100 dark:hover:bg-surface-800"
            :class="entry.slug === requestVersion ? 'bg-surface-100 dark:bg-surface-800' : ''"
            data-testid="item-history-entry"
            :data-slug="entry.slug"
            @click="choose(entry.slug)"
          >
            <i
              class="pi text-xs mt-1 w-3"
              :class="entry.slug === requestVersion ? 'pi-check text-primary-500' : 'opacity-0'"
              aria-hidden="true"
            ></i>
            <span class="flex flex-col min-w-0">
              <span class="text-sm text-surface-900 dark:text-surface-50">
                {{ entry.label }}
              </span>
              <span v-if="entry.date" class="text-xs text-surface-500 dark:text-surface-400">
                {{ entry.date }}
              </span>
            </span>
          </button>
        </li>
      </ul>

      <p
        v-if="missingLabel"
        class="border-t border-surface-200 dark:border-surface-700 px-3 py-2 text-xs text-surface-500 dark:text-surface-400"
        data-testid="item-history-missing"
      >
        Not present in {{ missingLabel }}.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import Button from 'primevue/button';
import type { ItemRevisionPoint, ItemRevisionsResponse } from '@/types/game-version';
import { useGameVersion } from '@/composables/useGameVersion';

const props = defineProps<{
  revisions: ItemRevisionsResponse | null;
  /** Version the currently displayed item was loaded from (peek slug or current). */
  requestVersion: string | null;
}>();

const emit = defineEmits<{ (event: 'select', slug: string): void }>();

const { versions } = useGameVersion();

const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);

/** What a sub-hash change means to a reader. */
const CHANGE_LABELS: Record<string, string> = {
  stats: 'stats',
  spells: 'effects',
  actions: 'requirements',
  text: 'text',
};

/**
 * "current" says where you are, not what happened there, so a point that is
 * both the request version and a change point reports both.
 */
function describe(point: ItemRevisionPoint): string {
  const parts: string[] = [];
  if (point.version_slug === props.requestVersion) parts.push('current');
  if (point.first_seen) {
    parts.push('first seen');
  } else {
    const changes = point.changed.map((change) => CHANGE_LABELS[change] || change);
    if (changes.length) parts.push(changes.join(', '));
  }
  if (parts.length === 0) parts.push('changed');
  return parts.join(' · ');
}

/** Registry position (sort_order); versions the registry does not know go last. */
function registryIndex(slug: string): number {
  const index = versions.value.findIndex((version) => version.slug === slug);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

const entries = computed(() => {
  const points = props.revisions?.revisions ?? [];
  // The backend walks lineage oldest first. Display order is the registry's,
  // newest first; reversing gives unknown versions a sensible fallback order,
  // and the stable sort then lifts every registered one into registry order.
  return [...points]
    .reverse()
    .sort((a, b) => registryIndex(a.version_slug) - registryIndex(b.version_slug))
    .map((point) => ({
      slug: point.version_slug,
      label: `${point.display_name} · ${describe(point)}`,
      date: point.snapshot_date || point.client_build || '',
    }));
});

const missingLabel = computed(() => {
  const missing = props.revisions?.missing_in ?? [];
  if (missing.length === 0) return '';
  return missing
    .map((slug) => versions.value.find((v) => v.slug === slug)?.display_name || slug)
    .join(', ');
});

/** A single patch point with nothing missing anywhere is not worth a control. */
const visible = computed(() => entries.value.length > 1 || missingLabel.value.length > 0);

function choose(slug: string): void {
  open.value = false;
  emit('select', slug);
}

function onDocumentClick(event: MouseEvent): void {
  if (!open.value) return;
  const target = event.target as Node | null;
  if (rootEl.value && target && !rootEl.value.contains(target)) open.value = false;
}

onMounted(() => document.addEventListener('click', onDocumentClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));
</script>

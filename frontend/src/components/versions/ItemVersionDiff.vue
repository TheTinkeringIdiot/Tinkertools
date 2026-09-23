<!--
ItemVersionDiff - compact comparison of one item as it exists in two snapshots.
Rows are name and description changes, stats added, removed or changed, and
requirement criteria that moved.
-->
<template>
  <Card data-testid="item-version-diff">
    <template #content>
      <div class="flex items-center gap-2 mb-3">
        <i class="pi pi-arrows-h text-blue-500" aria-hidden="true"></i>
        <h3 class="text-base font-semibold">{{ fromLabel }} compared with {{ toLabel }}</h3>
      </div>

      <p
        v-if="rows.length === 0"
        class="text-sm text-surface-500 dark:text-surface-400 italic"
        data-testid="item-version-diff-empty"
      >
        No text, stat or requirement differences between these snapshots.
      </p>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase text-surface-500 dark:text-surface-400">
              <th class="py-1 pr-3 font-medium">Change</th>
              <th class="py-1 pr-3 font-medium">Field</th>
              <th class="py-1 pr-3 font-medium">{{ fromLabel }}</th>
              <th class="py-1 font-medium">{{ toLabel }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.key"
              class="border-t border-surface-200 dark:border-surface-700"
              data-testid="item-version-diff-row"
            >
              <td class="py-1 pr-3">
                <Tag :value="row.kind" :severity="severityFor(row.kind)" class="text-xs" />
              </td>
              <td class="py-1 pr-3 text-surface-800 dark:text-surface-200">{{ row.label }}</td>
              <td class="py-1 pr-3 font-mono" :title="row.fromFull">{{ row.from ?? '—' }}</td>
              <td class="py-1 font-mono" :title="row.toFull">{{ row.to ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import { getStatName } from '@/services/game-utils';
import { TEMPLATE_ACTION } from '@/services/game-data';
import type { Item, StatValue } from '@/types/api';

const props = defineProps<{
  /** The snapshot being peeked at. */
  fromItem: Item | null;
  /** The item as it is in the version the user is browsing. */
  toItem: Item | null;
  fromLabel: string;
  toLabel: string;
}>();

type DiffKind = 'added' | 'removed' | 'changed';

interface DiffRow {
  key: string;
  kind: DiffKind;
  label: string;
  from: number | string | null;
  to: number | string | null;
  /** Untruncated values, shown on hover for long text fields. */
  fromFull?: string;
  toFull?: string;
}

/**
 * Descriptions are paragraphs and often differ deep inside, so the cell shows a
 * window around the first character that differs rather than a useless head
 * that reads the same on both sides. The full value is on the cell's title.
 */
function textExcerpt(value: string, other: string): string {
  const WINDOW = 80;
  if (value.length <= WINDOW) return value;

  let firstDiff = 0;
  while (firstDiff < value.length && value[firstDiff] === other[firstDiff]) firstDiff++;

  const start = Math.max(0, Math.min(firstDiff - 20, value.length - WINDOW));
  const excerpt = value.slice(start, start + WINDOW);
  return `${start > 0 ? '...' : ''}${excerpt}${start + WINDOW < value.length ? '...' : ''}`;
}

/**
 * Stats that say nothing about the item to a player. StaticInstance (23) is a
 * per-database instance id, so it differs between snapshots of identical items.
 */
const IGNORED_STATS = new Set([23]);

function statName(statId: number): string {
  return getStatName(statId) || `Stat ${statId}`;
}

function statMap(stats: StatValue[] | undefined): Map<number, number> {
  const map = new Map<number, number>();
  for (const stat of stats || []) {
    if (IGNORED_STATS.has(stat.stat)) continue;
    if (!map.has(stat.stat)) map.set(stat.stat, stat.value);
  }
  return map;
}

/** Requirement criteria flattened to "action:stat" -> required value. */
function requirementMap(item: Item | null): Map<string, { label: string; value: number }> {
  const map = new Map<string, { label: string; value: number }>();
  for (const action of item?.actions || []) {
    const actionLabel =
      TEMPLATE_ACTION[action.action as keyof typeof TEMPLATE_ACTION] || `Action ${action.action}`;
    for (const criterion of action.criteria || []) {
      // Operator-only entries (AND/OR markers) carry no stat requirement.
      if (!criterion.value1) continue;
      const key = `${action.action ?? 0}:${criterion.value1}:${criterion.operator}`;
      if (!map.has(key)) {
        map.set(key, {
          label: `${actionLabel} requires ${statName(criterion.value1)}`,
          value: criterion.value2,
        });
      }
    }
  }
  return map;
}

const rows = computed<DiffRow[]>(() => {
  if (!props.fromItem || !props.toItem) return [];
  const result: DiffRow[] = [];

  // Name and description carry the "text" change points, including encoding
  // differences that are invisible in a stat table.
  const textFields: Array<{ key: string; label: string; from: string; to: string }> = [
    {
      key: 'name',
      label: 'Name',
      from: props.fromItem.name || '',
      to: props.toItem.name || '',
    },
    {
      key: 'description',
      label: 'Description',
      from: props.fromItem.description || '',
      to: props.toItem.description || '',
    },
  ];

  for (const field of textFields) {
    if (field.from === field.to) continue;
    result.push({
      key: `text-${field.key}`,
      kind: 'changed',
      label: field.label,
      from: textExcerpt(field.from, field.to) || '—',
      to: textExcerpt(field.to, field.from) || '—',
      fromFull: field.from,
      toFull: field.to,
    });
  }

  const fromStats = statMap(props.fromItem.stats);
  const toStats = statMap(props.toItem.stats);

  for (const [statId, fromValue] of fromStats) {
    const toValue = toStats.get(statId);
    if (toValue === undefined) {
      result.push({
        key: `stat-removed-${statId}`,
        kind: 'removed',
        label: statName(statId),
        from: fromValue,
        to: null,
      });
    } else if (toValue !== fromValue) {
      result.push({
        key: `stat-changed-${statId}`,
        kind: 'changed',
        label: statName(statId),
        from: fromValue,
        to: toValue,
      });
    }
  }

  for (const [statId, toValue] of toStats) {
    if (!fromStats.has(statId)) {
      result.push({
        key: `stat-added-${statId}`,
        kind: 'added',
        label: statName(statId),
        from: null,
        to: toValue,
      });
    }
  }

  const fromReqs = requirementMap(props.fromItem);
  const toReqs = requirementMap(props.toItem);

  for (const [key, from] of fromReqs) {
    const to = toReqs.get(key);
    if (!to) {
      result.push({
        key: `req-removed-${key}`,
        kind: 'removed',
        label: from.label,
        from: from.value,
        to: null,
      });
    } else if (to.value !== from.value) {
      result.push({
        key: `req-changed-${key}`,
        kind: 'changed',
        label: from.label,
        from: from.value,
        to: to.value,
      });
    }
  }

  for (const [key, to] of toReqs) {
    if (!fromReqs.has(key)) {
      result.push({
        key: `req-added-${key}`,
        kind: 'added',
        label: to.label,
        from: null,
        to: to.value,
      });
    }
  }

  return result;
});

function severityFor(kind: DiffKind): string {
  if (kind === 'added') return 'success';
  if (kind === 'removed') return 'danger';
  return 'warning';
}
</script>

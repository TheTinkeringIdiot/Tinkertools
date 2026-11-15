<!--
ChangeFilterPanel - filters of a build change list. Stateless: it shows the
filters it is given and emits the fields that should change; the page writes
them to the URL.
-->
<template>
  <form class="change-filters" data-testid="change-filters" @submit.prevent="commitSearch">
    <div class="change-filters-head">
      <h2 class="text-sm font-semibold text-surface-900 dark:text-surface-50">Filters</h2>
      <button
        v-if="activeCount > 0"
        type="button"
        class="change-filters-link"
        data-testid="change-filters-reset"
        @click="emit('reset')"
      >
        Reset ({{ activeCount }})
      </button>
    </div>

    <div class="change-filters-group">
      <label class="change-filters-label" for="change-filter-search">Name</label>
      <input
        id="change-filter-search"
        v-model="searchText"
        type="search"
        class="change-filters-input"
        placeholder="Old or new name contains..."
        data-testid="change-filter-search"
        @input="scheduleSearch"
      />
    </div>

    <fieldset class="change-filters-group">
      <legend class="change-filters-label">Matters for</legend>
      <label v-for="name in RELEVANCE_NAMES" :key="name" class="change-filters-check">
        <input
          type="checkbox"
          :checked="filters.relevance.includes(name)"
          data-testid="change-filter-relevance"
          :data-value="name"
          @change="toggleIn('relevance', name)"
        />
        {{ RELEVANCE_LABELS[name] }}
        <span v-if="summary" class="change-filters-count">
          {{ summary.by_relevance[name].toLocaleString('en-US') }}
        </span>
      </label>
      <p class="change-filters-hint">
        {{ filters.relevance.length === 0 ? 'Nothing ticked: every change is listed.' : '' }}
      </p>
    </fieldset>

    <fieldset class="change-filters-group">
      <legend class="change-filters-label">Kind of change</legend>
      <label v-for="name in CHANGE_KINDS" :key="name" class="change-filters-check">
        <input
          type="checkbox"
          :checked="filters.kind.includes(name)"
          data-testid="change-filter-kind"
          :data-value="name"
          @change="toggleIn('kind', name)"
        />
        {{ KIND_LABELS[name] }}
        <span v-if="summary" class="change-filters-count">
          {{ summary.by_kind[name].toLocaleString('en-US') }}
        </span>
      </label>
    </fieldset>

    <fieldset class="change-filters-group">
      <legend class="change-filters-label">What changed</legend>
      <label v-for="name in PART_NAMES" :key="name" class="change-filters-check">
        <input
          type="checkbox"
          :checked="filters.part.includes(name)"
          data-testid="change-filter-part"
          :data-value="name"
          @change="toggleIn('part', name)"
        />
        {{ PART_LABELS[name] }}
        <span v-if="summary" class="change-filters-count">
          {{ summary.by_part[name].toLocaleString('en-US') }}
        </span>
      </label>
    </fieldset>

    <div class="change-filters-group">
      <label class="change-filters-label" for="change-filter-type">Item or nano</label>
      <select
        id="change-filter-type"
        class="change-filters-input"
        :value="filters.type ?? ''"
        data-testid="change-filter-type"
        @change="emit('update', { type: typeValue($event) })"
      >
        <option value="">Both</option>
        <option value="item">Items</option>
        <option value="nano">Nanos</option>
      </select>
    </div>

    <div class="change-filters-group">
      <label class="change-filters-label" for="change-filter-class">Item class</label>
      <select
        id="change-filter-class"
        class="change-filters-input"
        :value="filters.itemClass ?? ''"
        data-testid="change-filter-class"
        @change="emit('update', { itemClass: numberValue($event), slot: null })"
      >
        <option value="">Any</option>
        <option v-for="option in classOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div v-if="slotOptions.length" class="change-filters-group">
      <label class="change-filters-label" for="change-filter-slot">Equipment slot</label>
      <select
        id="change-filter-slot"
        class="change-filters-input"
        :value="filters.slot ?? ''"
        data-testid="change-filter-slot"
        @change="emit('update', { slot: numberValue($event) })"
      >
        <option value="">Any</option>
        <option v-for="option in slotOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </div>

    <div class="change-filters-group">
      <span class="change-filters-label">Quality level</span>
      <div class="flex items-center gap-2">
        <input
          type="number"
          min="1"
          class="change-filters-input"
          placeholder="Min"
          aria-label="Minimum quality level"
          :value="filters.minQl ?? ''"
          data-testid="change-filter-minql"
          @change="emit('update', { minQl: numberValue($event) })"
        />
        <span class="text-surface-500" aria-hidden="true">-</span>
        <input
          type="number"
          min="1"
          class="change-filters-input"
          placeholder="Max"
          aria-label="Maximum quality level"
          :value="filters.maxQl ?? ''"
          data-testid="change-filter-maxql"
          @change="emit('update', { maxQl: numberValue($event) })"
        />
      </div>
    </div>

    <div class="change-filters-group">
      <label class="change-filters-label" for="change-filter-profession">Profession</label>
      <select
        id="change-filter-profession"
        class="change-filters-input"
        :value="filters.profession ?? ''"
        data-testid="change-filter-profession"
        @change="emit('update', { profession: numberValue($event) })"
      >
        <option value="">Any</option>
        <option v-for="option in professionOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <p class="change-filters-hint">Items and nanos only that profession can use.</p>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import {
  ARMOR_SLOT_POSITION,
  IMPLANT_SLOT_POSITION,
  ITEM_CLASS,
  PROFESSION,
  WEAPON_SLOT_POSITIONS,
} from '@/services/game-data';
import { KIND_LABELS, PART_LABELS, RELEVANCE_LABELS } from '@/services/diff-format';
import { activeFilterCount, type ChangeFilters } from '@/services/change-filters';
import {
  CHANGE_KINDS,
  PART_NAMES,
  RELEVANCE_NAMES,
  type ChangeKind,
  type ChangeSummary,
  type PartName,
  type RelevanceName,
} from '@/types/changes';

const SEARCH_DELAY_MS = 300;

const props = defineProps<{
  filters: ChangeFilters;
  /** Counts of the whole comparison, shown beside each option. */
  summary: ChangeSummary | null;
}>();

const emit = defineEmits<{
  (event: 'update', patch: Partial<ChangeFilters>): void;
  (event: 'reset'): void;
}>();

const activeCount = computed(() => activeFilterCount(props.filters));

interface Option {
  label: string;
  value: number;
}

function options(table: Record<string, string>): Option[] {
  return Object.entries(table)
    .filter(([key]) => key !== '0')
    .map(([key, label]) => ({ label, value: Number(key) }));
}

const EQUIPPABLE_CLASSES = new Set([1, 2, 3]);
const classOptions = options(ITEM_CLASS).filter((option) => EQUIPPABLE_CLASSES.has(option.value));
const professionOptions = options(PROFESSION);

const SLOT_TABLES: Record<number, Record<string, string>> = {
  1: WEAPON_SLOT_POSITIONS,
  2: ARMOR_SLOT_POSITION,
  3: IMPLANT_SLOT_POSITION,
};

const slotOptions = computed<Option[]>(() => {
  const table = props.filters.itemClass !== null ? SLOT_TABLES[props.filters.itemClass] : undefined;
  return table ? options(table) : [];
});

type ListField = 'kind' | 'part' | 'relevance';

function toggleIn(field: 'kind', name: ChangeKind): void;
function toggleIn(field: 'part', name: PartName): void;
function toggleIn(field: 'relevance', name: RelevanceName): void;
function toggleIn(field: ListField, name: string): void {
  const current = props.filters[field] as string[];
  const next = current.includes(name)
    ? current.filter((value) => value !== name)
    : [...current, name];
  emit('update', { [field]: next } as Partial<ChangeFilters>);
}

function numberValue(event: Event): number | null {
  const text = (event.target as HTMLInputElement | HTMLSelectElement).value.trim();
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

function typeValue(event: Event): ChangeFilters['type'] {
  const value = (event.target as HTMLSelectElement).value;
  return value === 'item' || value === 'nano' ? value : null;
}

// The name filter is typed, so it is written to the URL after a pause.
const searchText = ref(props.filters.search);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

function commitSearch(): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = null;
  const text = searchText.value.trim();
  if (text !== props.filters.search) emit('update', { search: text });
}

function scheduleSearch(): void {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(commitSearch, SEARCH_DELAY_MS);
}

watch(
  () => props.filters.search,
  (search) => {
    if (search !== searchText.value.trim()) searchText.value = search;
  }
);

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>

<style scoped>
.change-filters {
  @apply space-y-4 p-4;
}

.change-filters-head {
  @apply flex items-center justify-between;
}

.change-filters-group {
  @apply m-0 min-w-0 border-0 p-0;
}

.change-filters-label {
  @apply mb-1 block text-xs font-medium text-surface-600 dark:text-surface-400;
}

.change-filters-input {
  @apply w-full min-w-0 rounded border border-surface-300 bg-surface-0 px-2 py-1 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-950 dark:text-surface-50;
}

.change-filters-check {
  @apply flex items-center gap-2 py-0.5 text-sm text-surface-800 dark:text-surface-200;
}

.change-filters-count {
  @apply ml-auto text-xs text-surface-500 dark:text-surface-400;
}

.change-filters-hint {
  @apply mt-1 text-xs text-surface-500 dark:text-surface-400;
}

.change-filters-link {
  @apply text-xs text-primary-600 hover:underline dark:text-primary-400;
}
</style>

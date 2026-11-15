/**
 * Filters of a build change list and their place in the URL.
 *
 * The URL is the state: a filtered, sorted, paged view is a link. Defaults
 * are left out of it, so the plain page URL is the default view, which leads
 * with what players care about (changes relevant to gameplay or economy);
 * cosmetic-only and text-only changes are one click away (`relevance=all`).
 */

import type { LocationQuery, LocationQueryRaw } from 'vue-router';
import {
  CHANGE_KINDS,
  PART_NAMES,
  RELEVANCE_NAMES,
  type ChangeKind,
  type ChangeListQuery,
  type ChangeSort,
  type PartName,
  type RelevanceName,
} from '@/types/changes';

export interface ChangeFilters {
  kind: ChangeKind[];
  part: PartName[];
  /** Empty: every change, whatever it matters for. */
  relevance: RelevanceName[];
  /** Items only, nanos only, or both (null). */
  type: 'item' | 'nano' | null;
  itemClass: number | null;
  minQl: number | null;
  maxQl: number | null;
  profession: number | null;
  /** Bit position in the slot mask, as the item search's slot filter. */
  slot: number | null;
  search: string;
  sort: ChangeSort;
  page: number;
  pageSize: number;
  /** List the changes a build note explains with the rest. */
  expandNotes: boolean;
  /** Ask for every row's diff with the page and show them open. */
  showDiffs: boolean;
  /** Only the items that share one field transition (a line of the patch notes). */
  transition: TransitionFilter | null;
}

export interface TransitionFilter {
  /** Path of the transition, as /changes/transitions names it. */
  path: string;
  /** Old and new value as JSON text ("60", "null", "[129,30,2]"); null: any value. */
  old: string | null;
  new: string | null;
}

export const DEFAULT_RELEVANCE: readonly RelevanceName[] = ['gameplay', 'economy'];
export const DEFAULT_PAGE_SIZE = 50;
export const PAGE_SIZE_OPTIONS: readonly number[] = [25, 50, 100, 200];
/** The URL parameters this module owns; any other one is left alone. */
export const CHANGE_FILTER_KEYS: readonly string[] = [
  'kind',
  'part',
  'relevance',
  'type',
  'class',
  'minql',
  'maxql',
  'prof',
  'slot',
  'q',
  'sort',
  'page',
  'size',
  'notes',
  'diffs',
  't',
  'tfrom',
  'tto',
];
const SORTS: readonly ChangeSort[] = ['name', 'aoid', 'ql'];
const ALL = 'all';

export function defaultChangeFilters(): ChangeFilters {
  return {
    kind: [],
    part: [],
    relevance: [...DEFAULT_RELEVANCE],
    type: null,
    itemClass: null,
    minQl: null,
    maxQl: null,
    profession: null,
    slot: null,
    search: '',
    sort: 'name',
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    expandNotes: false,
    showDiffs: false,
    transition: null,
  };
}

function first(value: LocationQuery[string] | undefined): string {
  const single = Array.isArray(value) ? value[0] : value;
  return typeof single === 'string' ? single : '';
}

/** Values of a list parameter: comma-separated or repeated, known names only, in canonical order. */
function list<T extends string>(
  value: LocationQuery[string] | undefined,
  allowed: readonly T[]
): T[] {
  const raw = (Array.isArray(value) ? value : [value])
    .filter((entry): entry is string => typeof entry === 'string')
    .flatMap((entry) => entry.split(','));
  return allowed.filter((name) => raw.includes(name));
}

function integer(value: LocationQuery[string] | undefined, minimum: number): number | null {
  const text = first(value);
  if (!/^\d+$/.test(text)) return null;
  const parsed = Number(text);
  return parsed >= minimum ? parsed : null;
}

/** JSON text as it came, when it is JSON; null otherwise. */
function jsonText(value: LocationQuery[string] | undefined): string | null {
  if (value === undefined) return null;
  const text = first(value);
  try {
    JSON.parse(text);
    return text;
  } catch {
    return null;
  }
}

/** The values of a transition filter, parsed; undefined for "any value". */
export function transitionFilterValues(filter: TransitionFilter): {
  old: unknown;
  new: unknown;
} {
  return {
    old: filter.old === null ? undefined : JSON.parse(filter.old),
    new: filter.new === null ? undefined : JSON.parse(filter.new),
  };
}

export function parseChangeFilters(query: LocationQuery): ChangeFilters {
  const defaults = defaultChangeFilters();
  const relevance = first(query.relevance);
  const type = first(query.type);
  const sort = first(query.sort) as ChangeSort;
  const pageSize = integer(query.size, 1);

  return {
    kind: list(query.kind, CHANGE_KINDS),
    part: list(query.part, PART_NAMES),
    relevance:
      query.relevance === undefined
        ? defaults.relevance
        : relevance === ALL
          ? []
          : list(query.relevance, RELEVANCE_NAMES),
    type: type === 'item' || type === 'nano' ? type : null,
    itemClass: integer(query.class, 0),
    minQl: integer(query.minql, 0),
    maxQl: integer(query.maxql, 0),
    profession: integer(query.prof, 1),
    slot: integer(query.slot, 1),
    search: first(query.q).trim(),
    sort: SORTS.includes(sort) ? sort : defaults.sort,
    page: integer(query.page, 1) ?? 1,
    pageSize: pageSize && PAGE_SIZE_OPTIONS.includes(pageSize) ? pageSize : defaults.pageSize,
    expandNotes: first(query.notes) === 'expand',
    showDiffs: first(query.diffs) === '1',
    transition: first(query.t)
      ? { path: first(query.t), old: jsonText(query.tfrom), new: jsonText(query.tto) }
      : null,
  };
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

/** The URL query of a filter state; `keep` carries parameters that are not filters. */
export function changeFiltersToQuery(
  filters: ChangeFilters,
  keep: LocationQueryRaw = {}
): LocationQueryRaw {
  const query: LocationQueryRaw = { ...keep };
  const set = (key: string, value: string | null): void => {
    if (value === null || value === '') {
      delete query[key];
    } else {
      query[key] = value;
    }
  };

  set('kind', filters.kind.join(','));
  set('part', filters.part.join(','));
  set(
    'relevance',
    sameList(filters.relevance, DEFAULT_RELEVANCE)
      ? null
      : filters.relevance.length === 0
        ? ALL
        : filters.relevance.join(',')
  );
  set('type', filters.type);
  set('class', filters.itemClass === null ? null : String(filters.itemClass));
  set('minql', filters.minQl === null ? null : String(filters.minQl));
  set('maxql', filters.maxQl === null ? null : String(filters.maxQl));
  set('prof', filters.profession === null ? null : String(filters.profession));
  set('slot', filters.slot === null ? null : String(filters.slot));
  set('q', filters.search.trim());
  set('sort', filters.sort === 'name' ? null : filters.sort);
  set('page', filters.page > 1 ? String(filters.page) : null);
  set('size', filters.pageSize === DEFAULT_PAGE_SIZE ? null : String(filters.pageSize));
  set('notes', filters.expandNotes ? 'expand' : null);
  set('diffs', filters.showDiffs ? '1' : null);
  set('t', filters.transition?.path ?? null);
  set('tfrom', filters.transition?.old ?? null);
  set('tto', filters.transition?.new ?? null);
  return query;
}

/** The request parameters of a filter state. */
export function changeFiltersToRequest(filters: ChangeFilters): ChangeListQuery {
  const request: ChangeListQuery = {
    page: filters.page,
    page_size: filters.pageSize,
    sort: filters.sort,
  };
  if (filters.kind.length) request.kind = [...filters.kind];
  if (filters.part.length) request.part = [...filters.part];
  if (filters.relevance.length) request.relevance = [...filters.relevance];
  if (filters.type) request.is_nano = filters.type === 'nano';
  if (filters.itemClass !== null) request.item_class = filters.itemClass;
  if (filters.minQl !== null) request.min_ql = filters.minQl;
  if (filters.maxQl !== null) request.max_ql = filters.maxQl;
  if (filters.profession !== null) request.profession = filters.profession;
  if (filters.slot !== null) request.slot = filters.slot;
  if (filters.search) request.search = filters.search;
  if (filters.expandNotes) request.notes = 'expand';
  if (filters.showDiffs) request.include_diff = true;
  if (filters.transition) {
    request.transition = filters.transition.path;
    if (filters.transition.old !== null) request.transition_old = filters.transition.old;
    if (filters.transition.new !== null) request.transition_new = filters.transition.new;
    // A transition's items include those a build note explains.
    request.notes = 'expand';
  }
  return request;
}

/** How many filters narrow the list beyond the default view. */
export function activeFilterCount(filters: ChangeFilters): number {
  const defaults = defaultChangeFilters();
  return [
    filters.kind.length > 0,
    filters.part.length > 0,
    !sameList(filters.relevance, defaults.relevance),
    filters.type !== null,
    filters.itemClass !== null,
    filters.minQl !== null,
    filters.maxQl !== null,
    filters.profession !== null,
    filters.slot !== null,
    filters.search !== '',
    filters.transition !== null,
  ].filter(Boolean).length;
}

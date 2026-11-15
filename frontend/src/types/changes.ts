/**
 * Cross-version diff types: an item's timeline, the change list of a build,
 * the comparison of two builds and of one item across two builds.
 * Mirrors backend/app/api/schemas/changes.py. Stats, skills, actions, events
 * and effect types are numeric ids.
 */

import type { GameVersionFamily } from './game-version';

export type ChangeKind = 'added' | 'removed' | 'changed';
export type PartName = 'text' | 'stats' | 'effects' | 'actions' | 'atkdef' | 'misc';
export type RelevanceName = 'gameplay' | 'economy' | 'cosmetic' | 'text';
/** Relevance of a single field of a diff (text is a part of its own). */
export type FieldRelevance = 'gameplay' | 'economy' | 'cosmetic';

export const CHANGE_KINDS: readonly ChangeKind[] = ['added', 'removed', 'changed'];
export const PART_NAMES: readonly PartName[] = [
  'text',
  'stats',
  'effects',
  'actions',
  'atkdef',
  'misc',
];
export const RELEVANCE_NAMES: readonly RelevanceName[] = ['gameplay', 'economy', 'cosmetic', 'text'];

export interface BuildRef {
  slug: string;
  display_name: string;
  family: GameVersionFamily;
  client_build: string | null;
  snapshot_date: string | null;
}

// ---------------------------------------------------------------------------
// Field-level diff
// ---------------------------------------------------------------------------

export interface DiffCriterion {
  value1: number;
  value2: number;
  operator: number;
}

export interface FieldChange {
  /**
   * text: 'name', 'description'. misc: 'static_instance', 'animation_mesh',
   * 'shop'. Changed effect: 'target', 'tick_count', 'tick_interval',
   * 'spell_params.<Name>'.
   */
  field: string;
  old: unknown;
  new: unknown;
  relevance?: FieldRelevance | null;
}

export interface StatChange {
  stat: number;
  change: ChangeKind;
  old: number | null;
  new: number | null;
  /** Flag stats only: flag values (1, 2, 4, ...) set now and not before. */
  bits_set: number[] | null;
  bits_cleared: number[] | null;
  relevance?: FieldRelevance | null;
}

export interface CriterionChange {
  op: 'same' | 'added' | 'removed' | 'changed';
  old: DiffCriterion | null;
  new: DiffCriterion | null;
}

export interface ActionChange {
  action: number;
  change: ChangeKind;
  /** The whole criteria sequence, old and new merged in order. */
  criteria: CriterionChange[];
}

/** An effect, shaped as the `spells` of an item's `spell_data`. */
export interface DiffEffect {
  spell_id: number;
  target: number | null;
  tick_count: number | null;
  tick_interval: number | null;
  spell_format: string | null;
  spell_params: Record<string, unknown>;
  criteria: DiffCriterion[];
  relevance?: FieldRelevance | null;
}

export interface EffectChange {
  old: DiffEffect;
  new: DiffEffect;
  fields: FieldChange[];
  /** Sequence diff of the criteria; null when they are equal. */
  criteria: CriterionChange[] | null;
}

export interface EventChange {
  event: number;
  change: ChangeKind | 'renumbered';
  old_event: number | null;
  added: DiffEffect[];
  removed: DiffEffect[];
  changed: EffectChange[];
}

/** Every key is always present; an empty list is a part that did not change. */
export interface ItemDiff {
  text: FieldChange[];
  stats: StatChange[];
  effects: EventChange[];
  actions: ActionChange[];
  attack: StatChange[];
  defense: StatChange[];
  misc: FieldChange[];
}

// ---------------------------------------------------------------------------
// Change rows
// ---------------------------------------------------------------------------

export interface ItemChange {
  aoid: number;
  kind: ChangeKind;
  /** Name in the newer build (the older, if removed). */
  name: string;
  old_name: string | null;
  ql: number;
  old_ql: number | null;
  item_class: number;
  is_nano: boolean;
  icon: number | null;
  parts: PartName[];
  relevance: RelevanceName[];
  note_id: number | null;
  /** Null unless asked for (include_diff) and for added and removed items. */
  diff: ItemDiff | null;
}

export interface BuildNote {
  note_id: number;
  title: string;
  body: string | null;
  /** Changes of the build the note explains. */
  count: number;
  /** Of those, the changes that match the request's filters. */
  matching: number;
}

export interface ChangeSummary {
  total: number;
  by_kind: Record<ChangeKind, number>;
  by_part: Record<PartName, number>;
  by_relevance: Record<RelevanceName, number>;
  noted: number;
}

export interface ChangeListResponse {
  items: ItemChange[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
  build: BuildRef;
  /** Null for a build with nothing before it, whose items are all 'added'. */
  base: BuildRef | null;
  summary: ChangeSummary;
  notes: BuildNote[];
}

export type ChangeSort = 'name' | 'aoid' | 'ql';

/** Query parameters of GET /changes and GET /compare/{base}. */
export interface ChangeListQuery {
  page?: number;
  page_size?: number;
  sort?: ChangeSort;
  kind?: ChangeKind[];
  part?: PartName[];
  relevance?: RelevanceName[];
  is_nano?: boolean;
  item_class?: number;
  min_ql?: number;
  max_ql?: number;
  profession?: number;
  slot?: number;
  search?: string;
  notes?: 'collapse' | 'expand';
  note_id?: number;
  include_diff?: boolean;
}

// ---------------------------------------------------------------------------
// One item
// ---------------------------------------------------------------------------

export interface TimelineNote {
  note_id: number;
  title: string;
  body: string | null;
}

export interface TimelineEntry {
  build: BuildRef;
  base: BuildRef | null;
  kind: ChangeKind;
  /** Name as of this build (before it, if removed). */
  name: string;
  ql: number;
  parts: PartName[];
  relevance: RelevanceName[];
  note: TimelineNote | null;
  diff: ItemDiff | null;
}

export interface ItemTimelineResponse {
  aoid: number;
  family: GameVersionFamily;
  /** Newest first; a fork's history continues into its parent's. */
  entries: TimelineEntry[];
}

export interface ItemSnapshot {
  name: string;
  ql: number;
  item_class: number;
  is_nano: boolean;
  icon: number | null;
}

export interface ItemCompareResponse {
  aoid: number;
  build: BuildRef;
  base: BuildRef;
  kind: ChangeKind | 'unchanged';
  old: ItemSnapshot | null;
  new: ItemSnapshot | null;
  parts: PartName[];
  relevance: RelevanceName[];
  diff: ItemDiff | null;
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

/** A criterion in a transition: [value1, value2, operator]. */
export type TransitionCriterion = [number, number, number];
export type TransitionValue = number | string | boolean | TransitionCriterion | null;

export interface SharedTransition {
  part: PartName;
  path: string;
  old: TransitionValue;
  new: TransitionValue;
  /** Changed items with this transition. */
  items: number;
  occurrences: number;
  stat: number | null;
  bit: number | null;
  spell_id: number | null;
  action: number | null;
  field: string | null;
}

export interface BuildTransitionsResponse {
  build: BuildRef;
  base: BuildRef | null;
  transitions: SharedTransition[];
}

export interface TransitionsQuery {
  part?: PartName[];
  min_items?: number;
  limit?: number;
}

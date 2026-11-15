/**
 * Cross-version diff fixtures.
 *
 * Shaped exactly like the answers of the diff routes (the examples of the
 * stage 4 API contract, taken from the 14.2.2 - 14.6.0 store): timeline,
 * change list, build comparison, item comparison and transitions.
 */

import type { GameVersion } from '@/types/game-version';
import type {
  BuildNote,
  BuildRef,
  BuildTransitionsResponse,
  ChangeListResponse,
  ChangeSummary,
  DiffEffect,
  ItemChange,
  ItemCompareResponse,
  ItemDiff,
  ItemTimelineResponse,
} from '@/types/changes';

// ---------------------------------------------------------------------------
// Builds
// ---------------------------------------------------------------------------

function ref(slug: string, displayName: string, family: string, clientBuild: string): BuildRef {
  return {
    slug,
    display_name: displayName,
    family,
    client_build: clientBuild,
    snapshot_date: null,
  };
}

export const BUILD_1460 = ref('ao-14-6-0', 'AO 14.6.0', 'ao', '14.6.0');
export const BUILD_1451 = ref('ao-14-5-1', 'AO 14.5.1', 'ao', '14.5.1');
export const BUILD_1450 = ref('ao-14-5-0', 'AO 14.5.0', 'ao', '14.5.0');
export const BUILD_1442 = ref('ao-14-4-2', 'AO 14.4.2', 'ao', '14.4.2');
export const BUILD_1422 = ref('ao-14-2-2', 'AO 14.2.2', 'ao', '14.2.2');
export const BUILD_17105 = ref('ao-17-10-5', 'AO 17.10.5', 'ao', '17.10.5');
export const BUILD_PRK = ref('prk-0-7-1', 'Project Rubi-Ka 0.7.1', 'prk', '0.7.1');

function registryEntry(
  build: BuildRef,
  sortOrder: number,
  parent: string | null,
  overrides: Partial<GameVersion> = {}
): GameVersion {
  return {
    slug: build.slug,
    display_name: build.display_name,
    family: build.family,
    parent_slug: parent,
    client_build: build.client_build,
    snapshot_date: null,
    sort_order: sortOrder,
    enabled: true,
    is_default: false,
    features: { items: true, nanos: true },
    notes: null,
    is_current: false,
    alias_of: null,
    ...overrides,
  };
}

/** A registry as the backend lists it: the fork first, then AO newest first. */
export const DIFF_REGISTRY: GameVersion[] = [
  registryEntry(BUILD_PRK, 101, 'ao-17-10-5'),
  registryEntry(BUILD_17105, 1002, 'ao-14-6-0'),
  registryEntry(BUILD_1460, 1140, 'ao-14-5-1', { is_default: true, is_current: true }),
  registryEntry(BUILD_1451, 1141, 'ao-14-5-0'),
  registryEntry(BUILD_1450, 1142, 'ao-14-4-2'),
  registryEntry(BUILD_1442, 1144, 'ao-14-2-2'),
  registryEntry(BUILD_1422, 1146, null),
];

// ---------------------------------------------------------------------------
// Diffs
// ---------------------------------------------------------------------------

export function emptyDiff(): ItemDiff {
  return { text: [], stats: [], effects: [], actions: [], attack: [], defense: [], misc: [] };
}

function procEffect(chance: number): DiffEffect {
  return {
    spell_id: 53089,
    target: 3,
    tick_count: 1,
    tick_interval: 0,
    spell_format: '{Chance} chance to cast {NanoID}; no defense checks.',
    spell_params: {
      Patch: null,
      Chance: chance,
      NanoID: 26337,
      Version: 0,
      Unknown2: 9,
      SpellDescription: `${chance} chance to cast 26337; no defense checks.`,
    },
    criteria: [],
  };
}

function lockSkillEffect(skill: number, description: string): DiffEffect {
  return {
    spell_id: 53033,
    target: 2,
    tick_count: 1,
    tick_interval: 0,
    spell_format: 'Lock skill {Skill} for {Duration}.',
    spell_params: {
      A: 9,
      Patch: null,
      Skill: skill,
      Version: 0,
      Duration: 1740,
      Unknown2: 9,
      SpellDescription: description,
    },
    criteria: [],
  };
}

/** Item 88393 from 14.5.1 to 14.6.0: proc chance 60 -> 100, requirements 39 -> 65. */
export const CRITTER_DIFF: ItemDiff = {
  text: [],
  stats: [{ stat: 287, change: 'added', old: null, new: 20, bits_set: null, bits_cleared: null }],
  effects: [
    {
      event: 0,
      change: 'changed',
      old_event: null,
      added: [],
      removed: [],
      changed: [
        {
          old: procEffect(60),
          new: procEffect(100),
          fields: [{ field: 'spell_params.Chance', old: 60, new: 100 }],
          criteria: null,
        },
      ],
    },
  ],
  actions: [
    {
      action: 3,
      change: 'changed',
      criteria: [
        {
          op: 'changed',
          old: { value1: 129, value2: 39, operator: 2 },
          new: { value1: 129, value2: 65, operator: 2 },
        },
        {
          op: 'changed',
          old: { value1: 122, value2: 39, operator: 2 },
          new: { value1: 122, value2: 65, operator: 2 },
        },
        {
          op: 'same',
          old: { value1: 0, value2: 0, operator: 4 },
          new: { value1: 0, value2: 0, operator: 4 },
        },
      ],
    },
  ],
  attack: [],
  defense: [],
  misc: [{ field: 'static_instance', old: [10090], new: [11099] }],
};

/** Item 88805 in 14.6.0: description reworded, Mass dropped, one lock effect swapped. */
export const GRAFT_DIFF: ItemDiff = {
  text: [
    {
      field: 'description',
      old: 'The Boosted-Graft: Assault Rifle Expertise can execute (Increases Assault Rifle). Using this item locks Sensory Impr for 30 minutes minus 5 seconds per Quality Level.',
      new: 'The Boosted-Graft: Assault Rifle Expertise can execute the nano formula Assault Rifle Expertise (Increases Assault Rifle). Using this item locks Psycho Modi for 30 minutes minus 5 seconds per Quality Level.',
    },
  ],
  stats: [
    { stat: 2, change: 'removed', old: 410, new: null, bits_set: null, bits_cleared: null },
    { stat: 287, change: 'added', old: null, new: 20, bits_set: null, bits_cleared: null },
  ],
  effects: [
    {
      event: 0,
      change: 'changed',
      old_event: null,
      added: [lockSkillEffect(129, 'Lock skill PsychologicalModification for 1740.')],
      removed: [lockSkillEffect(122, 'Lock skill SensoryImprovement for 1740.')],
      changed: [],
    },
  ],
  actions: [],
  attack: [],
  defense: [],
  misc: [],
};

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export const CRITTER_AOID = 88393;
export const CRITTER_NAME = 'Hacked Charged Nano Critter - 1H Blunt Weapon Incompetence';

/** GET /ao-14-6-0/items/88393/timeline */
export const CRITTER_TIMELINE: ItemTimelineResponse = {
  aoid: CRITTER_AOID,
  family: 'ao',
  entries: [
    {
      build: BUILD_1460,
      base: BUILD_1451,
      kind: 'changed',
      name: CRITTER_NAME,
      ql: 13,
      parts: ['stats', 'effects', 'actions', 'misc'],
      relevance: ['gameplay', 'cosmetic'],
      note: null,
      diff: CRITTER_DIFF,
    },
    {
      build: BUILD_1422,
      base: null,
      kind: 'added',
      name: CRITTER_NAME,
      ql: 13,
      parts: [],
      relevance: ['gameplay'],
      note: null,
      diff: null,
    },
  ],
};

/** An item that left the game data in 14.4.2 and came back in 14.5.1. */
export const RETURNED_TIMELINE: ItemTimelineResponse = {
  aoid: CRITTER_AOID,
  family: 'ao',
  entries: [
    {
      build: BUILD_1451,
      base: BUILD_1450,
      kind: 'added',
      name: CRITTER_NAME,
      ql: 13,
      parts: [],
      relevance: ['gameplay'],
      note: null,
      diff: null,
    },
    {
      build: BUILD_1442,
      base: BUILD_1422,
      kind: 'removed',
      name: CRITTER_NAME,
      ql: 13,
      parts: [],
      relevance: ['gameplay'],
      note: null,
      diff: null,
    },
    {
      build: BUILD_1422,
      base: null,
      kind: 'added',
      name: CRITTER_NAME,
      ql: 13,
      parts: [],
      relevance: ['gameplay'],
      note: null,
      diff: null,
    },
  ],
};

export function emptyTimeline(aoid: number): ItemTimelineResponse {
  return { aoid, family: 'ao', entries: [] };
}

// ---------------------------------------------------------------------------
// Item comparison
// ---------------------------------------------------------------------------

const CRITTER_SNAPSHOT = {
  name: CRITTER_NAME,
  ql: 13,
  item_class: 0,
  is_nano: false,
  icon: 11693,
};

/** GET /ao-14-6-0/items/88393/compare/ao-14-2-2 */
export const CRITTER_COMPARE: ItemCompareResponse = {
  aoid: CRITTER_AOID,
  build: BUILD_1460,
  base: BUILD_1422,
  kind: 'changed',
  old: CRITTER_SNAPSHOT,
  new: CRITTER_SNAPSHOT,
  parts: ['stats', 'effects', 'actions', 'misc'],
  relevance: ['gameplay', 'cosmetic'],
  diff: CRITTER_DIFF,
};

export function compareResult(
  kind: ItemCompareResponse['kind'],
  build: BuildRef = BUILD_1460,
  base: BuildRef = BUILD_1422
): ItemCompareResponse {
  return {
    aoid: CRITTER_AOID,
    build,
    base,
    kind,
    old: kind === 'added' ? null : CRITTER_SNAPSHOT,
    new: kind === 'removed' ? null : CRITTER_SNAPSHOT,
    parts: kind === 'changed' ? CRITTER_COMPARE.parts : [],
    relevance: kind === 'changed' ? CRITTER_COMPARE.relevance : kind === 'unchanged' ? [] : ['gameplay'],
    diff: kind === 'changed' ? CRITTER_DIFF : kind === 'unchanged' ? emptyDiff() : null,
  };
}

// ---------------------------------------------------------------------------
// Change lists
// ---------------------------------------------------------------------------

export const SUMMARY_1460: ChangeSummary = {
  total: 8650,
  by_kind: { added: 968, removed: 0, changed: 7682 },
  by_part: { text: 5211, stats: 6220, effects: 3070, actions: 2525, atkdef: 78, misc: 3540 },
  by_relevance: { gameplay: 7237, economy: 1046, cosmetic: 5844, text: 5211 },
  noted: 869,
};

export const NOTE_ATTACK_RANGE: BuildNote = {
  note_id: 4,
  title: 'Weapons given an explicit attack range',
  body: 'Stat 287 (AttackRange) was written out on weapons that had none.',
  count: 869,
  matching: 869,
};

export function changeRow(overrides: Partial<ItemChange> = {}): ItemChange {
  return {
    aoid: 88805,
    kind: 'changed',
    name: 'Boosted-Graft: Assault Rifle Expertise',
    old_name: null,
    ql: 12,
    old_ql: null,
    item_class: 2,
    is_nano: false,
    icon: 11647,
    parts: ['text', 'stats', 'effects'],
    relevance: ['gameplay', 'cosmetic', 'text'],
    note_id: null,
    diff: null,
    ...overrides,
  };
}

export const ROW_GRAFT = changeRow();
export const ROW_CRITTER = changeRow({
  aoid: CRITTER_AOID,
  name: CRITTER_NAME,
  ql: 13,
  item_class: 0,
  icon: 11693,
  parts: ['stats', 'effects', 'actions', 'misc'],
  relevance: ['gameplay', 'cosmetic'],
});
export const ROW_ADDED = changeRow({
  aoid: 200001,
  kind: 'added',
  name: 'Freshly Printed Pistol',
  ql: 50,
  item_class: 1,
  icon: null,
  parts: [],
  relevance: ['gameplay'],
});
export const ROW_REMOVED = changeRow({
  aoid: 200002,
  kind: 'removed',
  name: 'Retired Helmet',
  ql: 75,
  item_class: 2,
  icon: null,
  parts: [],
  relevance: ['gameplay'],
});

/** A page of a change list, with paging fields that agree with each other. */
export function changeList(overrides: Partial<ChangeListResponse> = {}): ChangeListResponse {
  const items = overrides.items ?? [ROW_GRAFT, ROW_CRITTER];
  const total = overrides.total ?? items.length;
  const page = overrides.page ?? 1;
  const pageSize = overrides.page_size ?? 50;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return {
    items,
    total,
    page,
    page_size: pageSize,
    pages,
    has_next: page < pages,
    has_prev: page > 1,
    build: BUILD_1460,
    base: BUILD_1451,
    summary: SUMMARY_1460,
    notes: [NOTE_ATTACK_RANGE],
    ...overrides,
  };
}

/** GET /ao-14-2-2/changes: the oldest build, nothing to compare with. */
export const FIRST_BUILD_LIST: ChangeListResponse = changeList({
  items: [changeRow({ aoid: 41560, kind: 'added', name: '', ql: 1, item_class: 0, icon: null, parts: [], relevance: ['gameplay'] })],
  total: 45918,
  build: BUILD_1422,
  base: null,
  summary: {
    total: 45918,
    by_kind: { added: 45918, removed: 0, changed: 0 },
    by_part: { text: 0, stats: 0, effects: 0, actions: 0, atkdef: 0, misc: 0 },
    by_relevance: { gameplay: 45918, economy: 0, cosmetic: 0, text: 0 },
    noted: 0,
  },
  notes: [],
});

/** GET /ao-14-6-0/compare/ao-14-2-2: tens of thousands of rows, served in pages. */
export const COMPARE_SUMMARY: ChangeSummary = {
  total: 64464,
  by_kind: { added: 37558, removed: 0, changed: 26906 },
  by_part: { text: 17569, stats: 18973, effects: 3663, actions: 2632, atkdef: 119, misc: 10979 },
  by_relevance: { gameplay: 51238, economy: 1197, cosmetic: 18601, text: 17569 },
  noted: 0,
};

export function compareList(overrides: Partial<ChangeListResponse> = {}): ChangeListResponse {
  return changeList({
    total: 51238,
    build: BUILD_1460,
    base: BUILD_1422,
    summary: COMPARE_SUMMARY,
    notes: [],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Transitions
// ---------------------------------------------------------------------------

/** GET /ao-14-6-0/changes/transitions */
export const TRANSITIONS_1460: BuildTransitionsResponse = {
  build: BUILD_1460,
  base: BUILD_1451,
  transitions: [
    { part: 'stats', path: 'stat:287', old: null, new: 20, items: 2464, occurrences: 2464, stat: 287, bit: null, spell_id: null, action: null, field: null },
    { part: 'stats', path: 'stat:2', old: 410, new: null, items: 1076, occurrences: 1076, stat: 2, bit: null, spell_id: null, action: null, field: null },
    { part: 'effects', path: 'effect:53089:spell_params.Chance', old: 60, new: 100, items: 760, occurrences: 760, stat: null, bit: null, spell_id: 53089, action: null, field: 'spell_params.Chance' },
    { part: 'effects', path: 'effect:53033', old: null, new: 129, items: 640, occurrences: 640, stat: null, bit: null, spell_id: 53033, action: null, field: null },
    { part: 'text', path: 'name', old: 'pill', new: 'Pill', items: 434, occurrences: 434, stat: null, bit: null, spell_id: null, action: null, field: null },
    { part: 'stats', path: 'stat:0:bit:134217728', old: 1, new: 0, items: 88, occurrences: 88, stat: 0, bit: 134217728, spell_id: null, action: null, field: null },
    { part: 'actions', path: 'action:3:criterion', old: [129, 30, 2], new: [129, 60, 2], items: 82, occurrences: 82, stat: null, bit: null, spell_id: null, action: 3, field: null },
    { part: 'atkdef', path: 'attack:113', old: null, new: 67, items: 76, occurrences: 76, stat: 113, bit: null, spell_id: null, action: null, field: null },
    { part: 'actions', path: 'action:8:criterion', old: null, new: [0, 0, 4], items: 69, occurrences: 72, stat: null, bit: null, spell_id: null, action: 8, field: null },
  ],
};

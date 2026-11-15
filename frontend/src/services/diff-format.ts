/**
 * Wording of cross-version diffs.
 *
 * Everything a diff shows is named here from the same tables the item page
 * reads (game-data.ts through game-utils, action-criteria and
 * spell-data-utils), so a stat, flag, requirement or effect reads the same in
 * a diff as on the item it belongs to. Pure functions, no state.
 */

import {
  ARMOR_SLOT,
  CANFLAG,
  IMPLANT_SLOT,
  ITEM_NONE_FLAG,
  NANO_NONE_FLAG,
  SPECIALIZATION_FLAG,
  TEMPLATE_ACTION,
  WEAPON_SLOT,
  WORN_ITEM,
} from './game-data';
import { getExpansionName, getItemClassName, getNanoStrainName, getStatName } from './game-utils';
import { transformCriterionForDisplay, type DisplayCriterion } from './action-criteria';
import {
  getEventName,
  getSpellFormat,
  getTargetName,
  interpolateSpellText,
} from './spell-data-utils';
import type {
  ChangeKind,
  DiffCriterion,
  DiffEffect,
  EventChange,
  FieldChange,
  ItemDiff,
  PartName,
  RelevanceName,
  SharedTransition,
  StatChange,
  TransitionValue,
} from '@/types/changes';

// ---------------------------------------------------------------------------
// Labels of the enums
// ---------------------------------------------------------------------------

export const KIND_LABELS: Record<ChangeKind | 'unchanged' | 'renumbered', string> = {
  added: 'Added',
  removed: 'Removed',
  changed: 'Changed',
  unchanged: 'Unchanged',
  renumbered: 'Moved',
};

export const PART_LABELS: Record<PartName, string> = {
  text: 'Text',
  stats: 'Stats',
  effects: 'Effects',
  actions: 'Requirements',
  atkdef: 'Attack/Defense',
  misc: 'Other',
};

export const RELEVANCE_LABELS: Record<RelevanceName, string> = {
  gameplay: 'Gameplay',
  economy: 'Economy',
  cosmetic: 'Cosmetic',
  text: 'Text',
};

/** A sign for each kind, so kinds never rest on colour alone. */
export const KIND_MARKS: Record<ChangeKind | 'unchanged' | 'renumbered' | 'same', string> = {
  added: '+',
  removed: '−',
  changed: '~',
  renumbered: '~',
  unchanged: '=',
  same: '',
};

// ---------------------------------------------------------------------------
// Stats and flags
// ---------------------------------------------------------------------------

/** What kind of item a diff belongs to; decides how stat 0 and the slot mask read. */
export interface DiffItemContext {
  isNano?: boolean;
  itemClass?: number;
}

export function statLabel(statId: number): string {
  return getStatName(statId) || `Stat ${statId}`;
}

export function actionLabel(actionId: number): string {
  return TEMPLATE_ACTION[actionId as keyof typeof TEMPLATE_ACTION] || `Action ${actionId}`;
}

export function itemClassLabel(itemClass: number, isNano: boolean): string {
  if (isNano) return 'Nano';
  if (itemClass === 0) return 'Item';
  return getItemClassName(itemClass) || `Class ${itemClass}`;
}

function nameInTable(table: Record<string, number>, bitValue: number): string | null {
  for (const [name, value] of Object.entries(table)) {
    // Flag values arrive unsigned; `1 << 31` in the tables is negative.
    if (value !== 0 && value >>> 0 === bitValue >>> 0) return name;
  }
  return null;
}

function bitPosition(bitValue: number): number {
  return Math.round(Math.log2(bitValue >>> 0));
}

/**
 * Name of one flag of a flag stat (0, 30, 182, 298, 355, 389), given as its
 * value (1, 2, 4, ...). Stat 0 holds item flags or nano flags; the slot mask
 * (298) reads by the item's class. Without that context a slot bit is named
 * only when every slot table that knows the bit agrees.
 */
export function flagName(statId: number, bitValue: number, context: DiffItemContext = {}): string {
  let name: string | null = null;
  switch (statId) {
    case 0:
      name = nameInTable(context.isNano ? NANO_NONE_FLAG : ITEM_NONE_FLAG, bitValue);
      break;
    case 30:
      name = nameInTable(CANFLAG, bitValue);
      break;
    case 182:
      name = nameInTable(SPECIALIZATION_FLAG, bitValue);
      break;
    case 355:
      name = nameInTable(WORN_ITEM, bitValue);
      break;
    case 389: {
      const expansion = getExpansionName(bitValue);
      name = expansion === 'Unknown' ? null : expansion;
      break;
    }
    case 298: {
      const tables: Record<number, Record<string, number>> = {
        1: WEAPON_SLOT,
        2: ARMOR_SLOT,
        3: IMPLANT_SLOT,
      };
      const table = context.itemClass !== undefined ? tables[context.itemClass] : undefined;
      if (table) {
        name = nameInTable(table, bitValue);
      } else {
        const names = new Set(
          Object.values(tables)
            .map((candidate) => nameInTable(candidate, bitValue))
            .filter((candidate): candidate is string => candidate !== null)
        );
        name = names.size === 1 ? [...names][0] : null;
      }
      break;
    }
  }
  return name ?? `Bit ${bitPosition(bitValue)}`;
}

const FLAG_STAT_LABELS: Record<number, string> = {
  30: 'Can',
  182: 'Specialization',
  298: 'Slots',
  355: 'Worn item',
  389: 'Expansion',
};

/** Label of a flag stat. Stat 0 is called "None" in the stat table; it holds the flags. */
export function flagStatLabel(statId: number, context: DiffItemContext = {}): string {
  if (statId === 0) {
    if (context.isNano === undefined) return 'Flags';
    return context.isNano ? 'Nano flags' : 'Item flags';
  }
  return FLAG_STAT_LABELS[statId] ?? statLabel(statId);
}

/** Whether a stat entry is a flag stat whose bits are listed. */
export function isFlagChange(change: StatChange): boolean {
  return change.bits_set !== null || change.bits_cleared !== null;
}

export function statValueText(value: number | null): string {
  return value === null ? 'none' : String(value);
}

// ---------------------------------------------------------------------------
// Criteria
// ---------------------------------------------------------------------------

export function displayCriterion(criterion: DiffCriterion): DisplayCriterion {
  return transformCriterionForDisplay(criterion);
}

/** A requirement in words, as the item page words it: "Psychology ≥ 31", "AND". */
export function criterionText(criterion: DiffCriterion): string {
  return displayCriterion(criterion).description;
}

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

const UNKNOWN_PLACEHOLDER = '…';

function cleanFormat(text: string): string {
  return text
    .replace(/\{\|\/?(right|left)\|\}/g, ' ')
    .replace(/%%/g, '%')
    .replace(/\s+/g, ' ')
    .trim();
}

function effectFormat(spellId: number, fallback?: string | null): string | null {
  return getSpellFormat(spellId) ?? fallback ?? null;
}

/**
 * An effect as the item page writes it: its format string with the parameters
 * filled in. May hold `[LINK:<aoid>]` placeholders, which SpellText renders.
 */
export function effectText(effect: DiffEffect): string {
  const format = effectFormat(effect.spell_id, effect.spell_format);
  if (format) {
    const text = cleanFormat(
      interpolateSpellText(format, {
        ...effect.spell_params,
        TickCount: effect.tick_count,
        TickInterval: effect.tick_interval,
        Target: effect.target,
        SpellId: effect.spell_id,
      })
    );
    if (text) return text;
  }
  const described = effect.spell_params?.SpellDescription;
  if (typeof described === 'string' && described) return cleanFormat(described);
  return `Effect ${effect.spell_id}`;
}

/** "on Target", "5 ticks every 1.0s": what the item page shows beside the text. */
export function effectDetails(effect: DiffEffect): string[] {
  const details: string[] = [];
  if (effect.target !== null && effect.target !== undefined) {
    details.push(`on ${getTargetName(effect.target)}`);
  }
  if (effect.tick_count && effect.tick_count > 1) {
    const every =
      effect.tick_interval && effect.tick_interval > 0
        ? ` every ${tickSeconds(effect.tick_interval)}`
        : '';
    details.push(`${effect.tick_count} ticks${every}`);
  }
  return details;
}

function tickSeconds(interval: number): string {
  return `${(interval / 100).toFixed(1)}s`;
}

/**
 * An effect type in words without an item: its format with the parameters in
 * `known` filled in and every other one left as an ellipsis.
 * "Lock skill Psychology for …."
 */
export function effectTemplate(spellId: number, known: Record<string, unknown> = {}): string {
  const format = effectFormat(spellId);
  if (!format) return `Effect ${spellId}`;
  const filled = interpolateSpellText(format, known).replace(/\[LINK:(\d+)\]/g, 'nano $1');
  return cleanFormat(filled.replace(/\{\w+\}/g, UNKNOWN_PLACEHOLDER));
}

const PARAM_PREFIX = 'spell_params.';

/** Label of a field of a changed effect: "Chance", "Target", "Tick interval". */
export function effectFieldLabel(field: string): string {
  if (field === 'target') return 'Target';
  if (field === 'tick_count') return 'Ticks';
  if (field === 'tick_interval') return 'Tick interval';
  const name = field.startsWith(PARAM_PREFIX) ? field.slice(PARAM_PREFIX.length) : field;
  return name.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** A value of a field of a changed effect, worded as the effect text words it. */
export function effectFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return 'none';
  if (field === 'target' && typeof value === 'number') return getTargetName(value);
  if (field === 'tick_interval' && typeof value === 'number') return tickSeconds(value);
  const name = (field.startsWith(PARAM_PREFIX) ? field.slice(PARAM_PREFIX.length) : field).toLowerCase();
  if (typeof value === 'number') {
    if (name.includes('chance')) return `${value}%`;
    if (name === 'stat' || name === 'skill') return statLabel(value);
    if (name === 'nanostrain') return getNanoStrainName(value) || `Strain ${value}`;
    return String(value);
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'Text' in value && typeof value.Text === 'string') {
    return value.Text;
  }
  return JSON.stringify(value);
}

/** Parameters that only restate others or carry client bookkeeping. */
const HIDDEN_EFFECT_FIELDS = new Set([
  'spell_params.SpellDescription',
  'spell_params.Patch',
  'spell_params.Version',
  'spell_params.Unknown2',
]);

export function isHiddenEffectField(field: string): boolean {
  return HIDDEN_EFFECT_FIELDS.has(field);
}

export function eventLabel(event: number): string {
  return getEventName(event);
}

// ---------------------------------------------------------------------------
// Text and misc fields
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  static_instance: 'Client instance id',
  animation_mesh: 'Animation mesh',
  shop: 'Shop data',
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export function miscValueText(value: unknown): string {
  if (value === null || value === undefined) return 'none';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'none';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// ---------------------------------------------------------------------------
// What is folded away
// ---------------------------------------------------------------------------

/**
 * Whether one entry of a diff is cosmetic. The backend's verdict wins when it
 * sends one (`relevance`); without it only what the API itself defines as
 * cosmetic is: the misc part except shop data, and a renumbered event.
 */
export function isCosmeticStat(change: StatChange): boolean {
  return change.relevance === 'cosmetic';
}

export function isCosmeticMisc(change: FieldChange): boolean {
  if (change.relevance) return change.relevance === 'cosmetic';
  return change.field !== 'shop';
}

export function isCosmeticEvent(event: EventChange): boolean {
  if (event.change === 'renumbered') return true;
  const effects = [
    ...event.added,
    ...event.removed,
    ...event.changed.map((pair) => pair.new),
  ];
  return effects.length > 0 && effects.every((effect) => effect.relevance === 'cosmetic');
}

export function isEmptyDiff(diff: ItemDiff | null | undefined): boolean {
  if (!diff) return true;
  return (
    diff.text.length +
      diff.stats.length +
      diff.effects.length +
      diff.actions.length +
      diff.attack.length +
      diff.defense.length +
      diff.misc.length ===
    0
  );
}

// ---------------------------------------------------------------------------
// Transitions ("patch notes")
// ---------------------------------------------------------------------------

/** Parameters that say what an effect acts on, in the backend's order. */
const SUBJECT_PARAMS = ['Stat', 'Skill', 'NanoID', 'NanoStrain', 'Item', 'PerkID'] as const;

function isCriterionTriple(value: TransitionValue): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3;
}

function tripleText(value: TransitionValue): string | null {
  if (!isCriterionTriple(value)) return null;
  return criterionText({ value1: value[0], value2: value[1], operator: value[2] });
}

function scalarText(value: TransitionValue): string {
  if (value === null) return 'none';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

/** The effect type of a removed or added effect, with its subject filled in. */
function effectWithSubject(spellId: number, subject: TransitionValue): string {
  if (typeof subject !== 'number') return effectTemplate(spellId);
  const format = getSpellFormat(spellId) ?? '';
  const param = SUBJECT_PARAMS.find((name) => format.includes(`{${name}}`));
  return effectTemplate(spellId, param ? { [param]: subject } : {});
}

function arrow(oldText: string, newText: string): string {
  return `${oldText} → ${newText}`;
}

/**
 * A shared transition in words, without its counts:
 * "… chance to cast …; no defense checks.: Chance 60% → 100%".
 */
export function transitionText(transition: SharedTransition): string {
  const { part, path, old, new: next, stat, bit, spell_id: spellId, action, field } = transition;

  if (part === 'text') {
    const label = fieldLabel(path);
    if (old === null && next === null) return `${label} reworded`;
    return `${label}: ${arrow(`"${scalarText(old)}"`, `"${scalarText(next)}"`)}`;
  }

  if (part === 'misc') return `${fieldLabel(path)} changed`;

  if (part === 'stats' && stat !== null) {
    const label = statLabel(stat);
    if (bit !== null) {
      return `${flagStatLabel(stat)}: ${flagName(stat, bit)} ${next === 1 ? 'set' : 'cleared'}`;
    }
    if (old === null) return `${label} added: ${scalarText(next)}`;
    if (next === null) return `${label} removed (was ${scalarText(old)})`;
    return `${label}: ${arrow(scalarText(old), scalarText(next))}`;
  }

  if (part === 'atkdef' && stat !== null) {
    const side = path.startsWith('defense') ? 'Defense' : 'Attack';
    const label = `${side} skill ${statLabel(stat)}`;
    if (old === null) return `${label} added: ${scalarText(next)}%`;
    if (next === null) return `${label} removed (was ${scalarText(old)}%)`;
    return `${label}: ${arrow(`${scalarText(old)}%`, `${scalarText(next)}%`)}`;
  }

  if (part === 'actions' && action !== null) {
    const label = actionLabel(action);
    if (!path.endsWith(':criterion')) {
      return `${label} requirements ${next === 'added' ? 'added' : 'removed'}`;
    }
    const before = tripleText(old);
    const after = tripleText(next);
    if (before === null) return `${label} requirement added: ${after ?? 'unknown'}`;
    if (after === null) return `${label} requirement removed: ${before}`;
    return `${label} requirement: ${arrow(before, after)}`;
  }

  if (part === 'effects') {
    if (path === 'event') {
      return `Effects moved from ${eventLabel(Number(old))} to ${eventLabel(Number(next))}`;
    }
    if (path.startsWith('event:')) {
      const event = eventLabel(Number(path.slice('event:'.length)));
      return `${event} effects ${next === 'added' ? 'added' : 'removed'}`;
    }
    if (spellId !== null) {
      if (path.endsWith(':criterion')) {
        const before = tripleText(old);
        const after = tripleText(next);
        const label = `${effectTemplate(spellId)} requirement`;
        if (before === null) return `${label} added: ${after ?? 'unknown'}`;
        if (after === null) return `${label} removed: ${before}`;
        return `${label}: ${arrow(before, after)}`;
      }
      if (field !== null) {
        return `${effectTemplate(spellId)}: ${effectFieldLabel(field)} ${arrow(
          effectFieldValue(field, old),
          effectFieldValue(field, next)
        )}`;
      }
      if (old === null) return `Effect added: ${effectWithSubject(spellId, next)}`;
      return `Effect removed: ${effectWithSubject(spellId, old)}`;
    }
  }

  return `${path}: ${arrow(scalarText(old), scalarText(next))}`;
}

/** "on 760 items", with the occurrences when an item has the transition more than once. */
export function transitionCount(transition: SharedTransition): string {
  const items = `on ${transition.items.toLocaleString('en-US')} ${
    transition.items === 1 ? 'item' : 'items'
  }`;
  if (transition.occurrences > transition.items) {
    return `${items} (${transition.occurrences.toLocaleString('en-US')} times)`;
  }
  return items;
}

<!--
ItemDiffView - the one presentation of a field-level item diff, used by the
item timeline, the item comparison and the build change lists.

Parts in a fixed order: text, stats, attack/defense, requirements, effects,
other. Every line carries a sign (+ added, − removed, ~ changed); removed text
is struck through and added text underlined, so nothing rests on colour.
Cosmetic entries are folded behind one toggle.
-->
<template>
  <div class="item-diff" data-testid="item-diff">
    <p v-if="nothingToShow" class="item-diff-empty" data-testid="item-diff-empty">
      No differences.
    </p>

    <!-- Text -->
    <section
      v-if="diff.text.length"
      class="item-diff-section"
      data-testid="diff-section"
      data-part="text"
    >
      <h4 class="item-diff-heading">Text</h4>
      <div
        v-for="change in diff.text"
        :key="change.field"
        class="item-diff-line"
        data-testid="diff-text"
        :data-field="change.field"
      >
        <DiffMark :op="fieldOp(change)" />
        <div class="min-w-0">
          <span class="item-diff-label">{{ fieldLabel(change.field) }}:</span>
          <span class="item-diff-words">
            <template v-for="(segment, index) in wordSegments(change)" :key="index">
              <del v-if="segment.op === 'removed'" class="diff-old">{{ segment.text }}</del>
              <ins v-else-if="segment.op === 'added'" class="diff-new">{{ segment.text }}</ins>
              <span v-else>{{ segment.text }}</span>
            </template>
          </span>
        </div>
      </div>
    </section>

    <!-- Stats -->
    <section
      v-if="shownStats.length"
      class="item-diff-section"
      data-testid="diff-section"
      data-part="stats"
    >
      <h4 class="item-diff-heading">Stats</h4>
      <div
        v-for="(change, index) in shownStats"
        :key="`${change.stat}-${index}`"
        class="item-diff-line"
        data-testid="diff-stat"
        :data-stat="change.stat"
      >
        <DiffMark :op="change.change" />
        <div class="min-w-0">
          <span class="item-diff-label">{{ statRowLabel(change) }}:</span>
          <template v-if="isFlagChange(change)">
            <span
              v-for="bit in change.bits_set ?? []"
              :key="`set-${bit}`"
              class="item-diff-flag"
              data-testid="diff-flag"
              data-op="added"
            >
              <ins class="diff-new"
                ><span aria-hidden="true">+ </span>{{ flag(change.stat, bit) }}</ins
              >
              <span class="sr-only"> set</span>
            </span>
            <span
              v-for="bit in change.bits_cleared ?? []"
              :key="`cleared-${bit}`"
              class="item-diff-flag"
              data-testid="diff-flag"
              data-op="removed"
            >
              <del class="diff-old"
                ><span aria-hidden="true">− </span>{{ flag(change.stat, bit) }}</del
              >
              <span class="sr-only"> cleared</span>
            </span>
            <span
              v-if="!(change.bits_set?.length || change.bits_cleared?.length)"
              class="item-diff-muted"
            >
              {{ change.change === 'removed' ? 'no longer present' : 'no flags set' }}
            </span>
          </template>
          <StatValueChange v-else :change="change" :show-delta="!isCosmeticStat(change)" />
          <span v-if="isCosmeticStat(change)" class="item-diff-tag">cosmetic</span>
        </div>
      </div>
    </section>

    <!-- Attack / defense skills -->
    <section
      v-if="diff.attack.length || diff.defense.length"
      class="item-diff-section"
      data-testid="diff-section"
      data-part="atkdef"
    >
      <h4 class="item-diff-heading">Attack and defense skills</h4>
      <template v-for="side in sides" :key="side.key">
        <div
          v-for="(change, index) in side.changes"
          :key="`${side.key}-${change.stat}-${index}`"
          class="item-diff-line"
          data-testid="diff-atkdef"
          :data-side="side.key"
        >
          <DiffMark :op="change.change" />
          <div class="min-w-0">
            <span class="item-diff-label">{{ side.label }} {{ statLabel(change.stat) }}:</span>
            <StatValueChange :change="change" unit="%" />
          </div>
        </div>
      </template>
    </section>

    <!-- Requirements -->
    <section
      v-if="diff.actions.length"
      class="item-diff-section"
      data-testid="diff-section"
      data-part="actions"
    >
      <h4 class="item-diff-heading">Requirements</h4>
      <div
        v-for="(action, index) in diff.actions"
        :key="`${action.action}-${index}`"
        class="item-diff-group"
        data-testid="diff-action"
        :data-action="action.action"
      >
        <div class="item-diff-line">
          <DiffMark :op="action.change" />
          <span class="item-diff-label">
            To {{ actionLabel(action.action).toLowerCase() }}
            <span class="item-diff-muted">({{ KIND_LABELS[action.change].toLowerCase() }})</span>
          </span>
        </div>
        <CriteriaDiffList :criteria="action.criteria" class="item-diff-nested" />
      </div>
    </section>

    <!-- Effects -->
    <section
      v-if="shownEvents.length"
      class="item-diff-section"
      data-testid="diff-section"
      data-part="effects"
    >
      <h4 class="item-diff-heading">Effects</h4>
      <div
        v-for="(event, index) in shownEvents"
        :key="`${event.event}-${index}`"
        class="item-diff-group"
        data-testid="diff-event"
        :data-event="event.event"
      >
        <div class="item-diff-line">
          <DiffMark :op="event.change === 'renumbered' ? 'changed' : event.change" />
          <span class="item-diff-label">
            <template v-if="event.change === 'renumbered'">
              Effects moved from
              {{ event.old_event === null ? 'another event' : `On ${eventLabel(event.old_event)}` }}
              to On {{ eventLabel(event.event) }}
              <span class="item-diff-tag">cosmetic</span>
            </template>
            <template v-else>
              On {{ eventLabel(event.event) }}
              <span class="item-diff-muted">({{ KIND_LABELS[event.change].toLowerCase() }})</span>
            </template>
          </span>
        </div>

        <div class="item-diff-nested">
          <div
            v-for="(effect, effectIndex) in event.removed"
            :key="`removed-${effectIndex}`"
            class="item-diff-line"
            data-testid="diff-effect"
            data-op="removed"
          >
            <DiffMark op="removed" />
            <del class="diff-old min-w-0"><EffectLine :effect="effect" /></del>
            <span v-if="isCosmeticEffect(effect)" class="item-diff-tag">cosmetic</span>
          </div>

          <div
            v-for="(pair, pairIndex) in event.changed"
            :key="`changed-${pairIndex}`"
            class="item-diff-line"
            data-testid="diff-effect"
            data-op="changed"
          >
            <DiffMark op="changed" />
            <div class="min-w-0">
              <EffectLine :effect="pair.new" />
              <span v-if="isCosmeticEffect(pair)" class="item-diff-tag">cosmetic</span>
              <ul class="item-diff-fields">
                <li
                  v-for="field in visibleFields(pair.fields)"
                  :key="field.field"
                  data-testid="diff-effect-field"
                  :data-field="field.field"
                >
                  <span class="item-diff-label">{{ effectFieldLabel(field.field) }}:</span>
                  <del class="diff-old">{{ effectFieldValue(field.field, field.old) }}</del>
                  <span class="diff-arrow" aria-hidden="true"> → </span>
                  <span class="sr-only"> became </span>
                  <ins class="diff-new">{{ effectFieldValue(field.field, field.new) }}</ins>
                  <span v-if="numericDelta(field.old, field.new)" class="item-diff-delta">
                    ({{ numericDelta(field.old, field.new) }})
                  </span>
                </li>
              </ul>
              <div v-if="pair.criteria" class="item-diff-effect-criteria">
                <span class="item-diff-muted">Conditions</span>
                <CriteriaDiffList :criteria="pair.criteria" />
              </div>
            </div>
          </div>

          <div
            v-for="(effect, effectIndex) in event.added"
            :key="`added-${effectIndex}`"
            class="item-diff-line"
            data-testid="diff-effect"
            data-op="added"
          >
            <DiffMark op="added" />
            <ins class="diff-new min-w-0"><EffectLine :effect="effect" /></ins>
            <span v-if="isCosmeticEffect(effect)" class="item-diff-tag">cosmetic</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Other -->
    <section
      v-if="shownMisc.length"
      class="item-diff-section"
      data-testid="diff-section"
      data-part="misc"
    >
      <h4 class="item-diff-heading">Other</h4>
      <div
        v-for="change in shownMisc"
        :key="change.field"
        class="item-diff-line"
        data-testid="diff-misc"
        :data-field="change.field"
      >
        <DiffMark :op="fieldOp(change)" />
        <div class="min-w-0">
          <span class="item-diff-label">{{ fieldLabel(change.field) }}:</span>
          <del class="diff-old">{{ miscValueText(change.old) }}</del>
          <span class="diff-arrow" aria-hidden="true"> → </span>
          <span class="sr-only"> became </span>
          <ins class="diff-new">{{ miscValueText(change.new) }}</ins>
          <span v-if="isCosmeticMisc(change)" class="item-diff-tag">cosmetic</span>
        </div>
      </div>
    </section>

    <button
      v-if="cosmeticCount > 0"
      type="button"
      class="item-diff-cosmetic-toggle"
      data-testid="diff-cosmetic-toggle"
      :aria-expanded="showCosmetic"
      @click="showCosmetic = !showCosmetic"
    >
      <i
        class="pi text-xs"
        :class="showCosmetic ? 'pi-chevron-down' : 'pi-chevron-right'"
        aria-hidden="true"
      ></i>
      {{ showCosmetic ? 'Hide' : 'Show' }} {{ cosmeticCount }} cosmetic
      {{ cosmeticCount === 1 ? 'change' : 'changes' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import DiffMark, { type DiffOp } from './DiffMark.vue';
import CriteriaDiffList from './CriteriaDiffList.vue';
import EffectLine from './EffectLine.vue';
import StatValueChange from './StatValueChange.vue';
import { diffWords, type WordDiffSegment } from '@/utils/word-diff';
import {
  KIND_LABELS,
  actionLabel,
  effectFieldLabel,
  effectFieldValue,
  eventLabel,
  fieldLabel,
  flagName,
  flagStatLabel,
  cosmeticEffectCount,
  isCosmeticEffect,
  isCosmeticEvent,
  isCosmeticMisc,
  isCosmeticStat,
  isFlagChange,
  isHiddenEffectField,
  miscValueText,
  statLabel,
  withoutCosmeticEffects,
} from '@/services/diff-format';
import type { FieldChange, ItemDiff, StatChange } from '@/types/changes';

const props = withDefaults(
  defineProps<{
    diff: ItemDiff;
    /** Decides how the flags of stat 0 and the slot mask are named. */
    isNano?: boolean;
    itemClass?: number;
    /** Start with the cosmetic entries shown. */
    cosmeticOpen?: boolean;
  }>(),
  { isNano: false, itemClass: undefined, cosmeticOpen: false }
);

const showCosmetic = ref(props.cosmeticOpen);

const cosmeticStats = computed(() => props.diff.stats.filter(isCosmeticStat));
const cosmeticEvents = computed(() => props.diff.effects.filter(isCosmeticEvent));
const cosmeticMisc = computed(() => props.diff.misc.filter(isCosmeticMisc));

const cosmeticCount = computed(
  () =>
    cosmeticStats.value.length +
    cosmeticEvents.value.length +
    cosmeticMisc.value.length +
    props.diff.effects.reduce((sum, event) => sum + cosmeticEffectCount(event), 0)
);

const shownStats = computed(() =>
  showCosmetic.value ? props.diff.stats : props.diff.stats.filter((c) => !isCosmeticStat(c))
);
const shownEvents = computed(() =>
  showCosmetic.value
    ? props.diff.effects
    : props.diff.effects.filter((e) => !isCosmeticEvent(e)).map(withoutCosmeticEffects)
);
const shownMisc = computed(() =>
  showCosmetic.value ? props.diff.misc : props.diff.misc.filter((c) => !isCosmeticMisc(c))
);

const sides = computed(() => [
  { key: 'attack', label: 'Attack skill', changes: props.diff.attack },
  { key: 'defense', label: 'Defense skill', changes: props.diff.defense },
]);

const nothingToShow = computed(
  () =>
    cosmeticCount.value === 0 &&
    props.diff.text.length +
      props.diff.stats.length +
      props.diff.effects.length +
      props.diff.actions.length +
      props.diff.attack.length +
      props.diff.defense.length +
      props.diff.misc.length ===
      0
);

function statRowLabel(change: StatChange): string {
  if (!isFlagChange(change)) return statLabel(change.stat);
  return flagStatLabel(change.stat, { isNano: props.isNano });
}

function flag(statId: number, bit: number): string {
  return flagName(statId, bit, { isNano: props.isNano, itemClass: props.itemClass });
}

function isAbsent(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function fieldOp(change: FieldChange): DiffOp {
  if (isAbsent(change.old)) return 'added';
  if (isAbsent(change.new)) return 'removed';
  return 'changed';
}

function wordSegments(change: FieldChange): WordDiffSegment[] {
  const before = typeof change.old === 'string' ? change.old : '';
  const after = typeof change.new === 'string' ? change.new : '';
  return diffWords(before, after);
}

function visibleFields(fields: FieldChange[]): FieldChange[] {
  return fields.filter((field) => !isHiddenEffectField(field.field));
}

function numericDelta(before: unknown, after: unknown): string {
  if (typeof before !== 'number' || typeof after !== 'number') return '';
  const delta = after - before;
  if (delta === 0) return '';
  const rounded = Number.isInteger(delta) ? String(Math.abs(delta)) : Math.abs(delta).toFixed(2);
  return `${delta > 0 ? '+' : '−'}${rounded}`;
}
</script>

<style>
.item-diff {
  @apply text-sm text-surface-800 dark:text-surface-200;
}

.item-diff-empty {
  @apply italic text-surface-500 dark:text-surface-400;
}

.item-diff-section + .item-diff-section {
  @apply mt-3;
}

.item-diff-heading {
  @apply mb-1 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400;
}

.item-diff-line {
  @apply flex items-baseline gap-1 py-0.5;
}

.item-diff-group + .item-diff-group {
  @apply mt-2;
}

.item-diff-nested {
  @apply ml-5 border-l border-surface-200 pl-2 dark:border-surface-700;
}

.item-diff-label {
  @apply mr-1 font-medium text-surface-900 dark:text-surface-50;
}

.item-diff-muted {
  @apply text-xs font-normal text-surface-500 dark:text-surface-400;
}

.item-diff-tag {
  @apply ml-1 rounded border border-surface-300 px-1 text-xs font-normal text-surface-500 dark:border-surface-600 dark:text-surface-400;
}

.item-diff-delta {
  @apply ml-1 text-xs text-surface-500 dark:text-surface-400;
}

.item-diff-words {
  @apply whitespace-pre-wrap break-words;
}

.item-diff-flag {
  @apply mr-2 inline-block;
}

.item-diff-fields {
  @apply m-0 list-none p-0;
}

.item-diff-effect-criteria {
  @apply mt-1;
}

.item-diff-cosmetic-toggle {
  @apply mt-3 flex items-center gap-1 text-xs text-primary-600 hover:underline dark:text-primary-400;
}

.item-diff .diff-old,
.item-diff .diff-old .spell-text {
  @apply rounded-sm bg-red-50 text-red-800 line-through decoration-red-400 dark:bg-red-950 dark:text-red-300;
}

.item-diff .diff-new,
.item-diff .diff-new .spell-text {
  @apply rounded-sm bg-green-50 text-green-800 underline decoration-green-500 decoration-dotted underline-offset-2 dark:bg-green-950 dark:text-green-300;
}

.item-diff .diff-arrow {
  @apply text-surface-500 dark:text-surface-400;
}
</style>

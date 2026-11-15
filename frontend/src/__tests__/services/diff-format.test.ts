/**
 * Wording of diffs: flag bits by name, effects and requirements as the item
 * page writes them, shared transitions as patch notes.
 */

import { describe, it, expect } from 'vitest';
import {
  criterionText,
  effectDetails,
  effectFieldDelta,
  effectFieldLabel,
  effectFieldValue,
  effectTemplate,
  effectText,
  flagName,
  isCosmeticEvent,
  isCosmeticMisc,
  isCosmeticStat,
  isEmptyDiff,
  isStructuralTransition,
  miscValueText,
  statValueText,
  cosmeticEffectCount,
  transitionCount,
  transitionFromPath,
  transitionText,
  withoutCosmeticEffects,
} from '@/services/diff-format';
import type { DiffEffect, SharedTransition } from '@/types/changes';
import { CRITTER_DIFF, TRANSITIONS_1460, emptyDiff } from '../helpers/change-fixtures';

function transition(overrides: Partial<SharedTransition>): SharedTransition {
  return {
    part: 'stats',
    path: '',
    old: null,
    new: null,
    items: 2,
    occurrences: 2,
    stat: null,
    bit: null,
    spell_id: null,
    action: null,
    field: null,
    ...overrides,
  };
}

describe('flagName', () => {
  it('names item flags and nano flags of stat 0 from their own tables', () => {
    expect(flagName(0, 1 << 27)).toBe('Unique');
    expect(flagName(0, 1 << 27, { isNano: false })).toBe('Unique');
    expect(flagName(0, 1 << 27, { isNano: true })).toBe('ClassDebuffPMSI');
  });

  it('names Can flags', () => {
    expect(flagName(30, 1)).toBe('Carry');
    expect(flagName(30, 4)).toBe('Wear');
    expect(flagName(30, 1 << 13)).toBe('FullAuto');
  });

  it('names expansion flags as the item page does', () => {
    expect(flagName(389, 2)).toBe('Shadowlands');
    expect(flagName(389, 8)).toBe('Alien Invasion');
  });

  it('names worn-item flags', () => {
    expect(flagName(355, 1 << 5)).toBe('SocialArmor');
  });

  it('reads the slot mask by the class of the item', () => {
    expect(flagName(298, 1 << 6, { itemClass: 1 })).toBe('RightHand');
    expect(flagName(298, 1 << 2, { itemClass: 2 })).toBe('Head');
    expect(flagName(298, 1 << 1, { itemClass: 3 })).toBe('Eyes');
  });

  it('does not guess a slot when the class is unknown and the tables disagree', () => {
    expect(flagName(298, 1 << 1)).toBe('Bit 1');
  });

  it('falls back to the bit position for a flag no table knows', () => {
    expect(flagName(999, 8)).toBe('Bit 3');
  });
});

describe('criterionText', () => {
  it('words a requirement as the item page does', () => {
    expect(criterionText({ value1: 129, value2: 39, operator: 2 })).toBe(
      'PsychologicalModification ≥ 40'
    );
    expect(criterionText({ value1: 54, value2: 201, operator: 1 })).toBe('Level ≤ 200');
    expect(criterionText({ value1: 60, value2: 5, operator: 0 })).toBe('Profession = Agent');
  });

  it('names the logical operators of a requirement list', () => {
    expect(criterionText({ value1: 0, value2: 0, operator: 4 })).toBe('AND');
    expect(criterionText({ value1: 0, value2: 0, operator: 3 })).toBe('OR');
  });
});

describe('values that have names', () => {
  it('names a profession, breed or faction a requirement compares with', () => {
    expect(criterionText({ value1: 60, value2: 15, operator: 24 })).toBe('Profession ≠ Shade');
    expect(criterionText({ value1: 4, value2: 3, operator: 24 })).toBe('Breed ≠ Nanomage');
    expect(criterionText({ value1: 33, value2: 1, operator: 0 })).toBe('Faction = Clan');
    expect(criterionText({ value1: 33, value2: 2, operator: 24 })).toBe('Faction ≠ Omni');
  });

  it('leaves a number that orders or has no name', () => {
    expect(criterionText({ value1: 33, value2: 9, operator: 0 })).toBe('Faction = 9');
    expect(criterionText({ value1: 129, value2: 15, operator: 24 })).toBe(
      'PsychologicalModification ≠ 15'
    );
  });

  it('names the value of a stat that stands for a profession, a breed or another stat', () => {
    expect(statValueText(15, 60)).toBe('Shade');
    expect(statValueText(2, 4)).toBe('Opifex');
    expect(statValueText(1, 33)).toBe('Clan');
    expect(statValueText(118, 440)).toBe('MeleeInit');
    expect(statValueText(94, 436)).toBe('RadiationAC');
    // Breed 15 and Team 15 are not names the game data has.
    expect(statValueText(15, 4)).toBe('15');
    expect(statValueText(15, 6)).toBe('15');
    expect(statValueText(410, 2)).toBe('410');
    expect(statValueText(null, 60)).toBe('none');
  });

  it('words a removed stat by the name of its value in a patch note', () => {
    const removed = (stat: number, old: number): SharedTransition => ({
      part: 'stats',
      path: `stat:${stat}`,
      old,
      new: null,
      items: 2,
      occurrences: 2,
      stat,
      bit: null,
      spell_id: null,
      action: null,
      field: null,
    });
    expect(transitionText(removed(60, 15))).toBe('Profession removed (was Shade)');
    expect(transitionText(removed(4, 15))).toBe('Breed removed (was 15)');
  });
});

describe('effect wording', () => {
  const proc = CRITTER_DIFF.effects[0].changed[0].new;

  it('writes an effect from its format and parameters', () => {
    expect(effectText(proc)).toBe('100% chance to cast [LINK:26337]');
  });

  it('names stats and skills in an effect', () => {
    const lock: DiffEffect = {
      spell_id: 53033,
      target: 2,
      tick_count: 1,
      tick_interval: 0,
      spell_format: 'Lock skill {Skill} for {Duration}.',
      spell_params: { Skill: 129, Duration: 1740 },
      criteria: [],
    };
    expect(effectText(lock)).toBe('Lock skill PsychologicalModification for 1740s');
  });

  it('uses the format the API sent for an effect type the tables lack', () => {
    const unknown: DiffEffect = {
      spell_id: 99999999,
      target: null,
      tick_count: null,
      tick_interval: null,
      spell_format: 'Summon {Count} gremlins',
      spell_params: { Count: 3 },
      criteria: [],
    };
    expect(effectText(unknown)).toBe('Summon 3 gremlins');
    expect(effectText({ ...unknown, spell_format: null, spell_params: {} })).toBe(
      'Effect 99999999'
    );
  });

  it('says whom an effect lands on and how it ticks', () => {
    expect(effectDetails(proc)).toEqual(['on Target']);
    expect(effectDetails({ ...proc, target: 2, tick_count: 5, tick_interval: 100 })).toEqual([
      'on User',
      '5 ticks every 1.0s',
    ]);
    expect(effectDetails({ ...proc, target: null })).toEqual([]);
  });

  it('describes an effect type without an item, leaving unknown parameters open', () => {
    expect(effectTemplate(53089)).toBe('…% chance to cast …');
    expect(effectTemplate(53033, { Skill: 122 })).toBe('Lock skill SensoryImprovement for …s');
    expect(effectTemplate(99999999)).toBe('Effect 99999999');
  });

  it('labels and words the fields of a changed effect', () => {
    expect(effectFieldLabel('spell_params.Chance')).toBe('Chance');
    expect(effectFieldLabel('spell_params.MinValue')).toBe('Min Value');
    expect(effectFieldLabel('tick_interval')).toBe('Tick interval');
    expect(effectFieldValue('spell_params.Chance', 60)).toBe('60%');
    expect(effectFieldValue('spell_params.Stat', 2)).toBe('Mass');
    expect(effectFieldValue('target', 3)).toBe('Target');
    expect(effectFieldValue('tick_interval', 250)).toBe('2.5s');
    expect(effectFieldValue('spell_params.Amount', null)).toBe('none');
  });

  it('gives the size of a change for quantities only', () => {
    expect(effectFieldDelta('spell_params.Chance', 60, 100)).toBe('+40');
    expect(effectFieldDelta('spell_params.Amount', 12, 7)).toBe('−5');
    expect(effectFieldDelta('tick_count', 3, 5)).toBe('+2');
    expect(effectFieldDelta('target', 1, 3)).toBe('');
    expect(effectFieldDelta('spell_params.Stat', 16, 17)).toBe('');
    expect(effectFieldDelta('spell_params.ModifierStat', 16, 17)).toBe('');
    expect(effectFieldValue('spell_params.ModifierStat', 2)).toBe('Mass');
    expect(effectFieldDelta('spell_params.NanoID', 26337, 26338)).toBe('');
    expect(effectFieldDelta('spell_params.Amount', 5, 5)).toBe('');
    expect(effectFieldDelta('spell_params.Text', 'a', 'b')).toBe('');
  });
});

describe('cosmetic entries', () => {
  it('treats the client instance id and the mesh as cosmetic, shop data not', () => {
    expect(isCosmeticMisc({ field: 'static_instance', old: [1], new: [2] })).toBe(true);
    expect(isCosmeticMisc({ field: 'animation_mesh', old: 1, new: 2 })).toBe(true);
    expect(isCosmeticMisc({ field: 'shop', old: null, new: {} })).toBe(false);
  });

  it('treats an event that only moved as cosmetic', () => {
    expect(
      isCosmeticEvent({
        event: 0,
        change: 'renumbered',
        old_event: 14,
        added: [],
        removed: [],
        changed: [],
      })
    ).toBe(true);
    expect(isCosmeticEvent(CRITTER_DIFF.effects[0])).toBe(false);
  });

  it('follows the relevance the API gives an entry when it gives one', () => {
    const stat = {
      stat: 79,
      change: 'changed' as const,
      old: 1,
      new: 2,
      bits_set: null,
      bits_cleared: null,
    };
    expect(isCosmeticStat(stat)).toBe(false);
    expect(isCosmeticStat({ ...stat, relevance: 'cosmetic' })).toBe(true);
    expect(isCosmeticMisc({ field: 'shop', old: 1, new: 2, relevance: 'cosmetic' })).toBe(true);
    expect(isCosmeticMisc({ field: 'animation_mesh', old: 1, new: 2, relevance: 'gameplay' })).toBe(
      false
    );
  });

  it('folds single cosmetic effects out of an event that also changed for real', () => {
    const real = CRITTER_DIFF.effects[0];
    const sound = { ...real.changed[0].new, spell_id: 53030, relevance: 'cosmetic' as const };
    const mixed = { ...real, added: [sound] };

    expect(isCosmeticEvent(mixed)).toBe(false);
    expect(cosmeticEffectCount(mixed)).toBe(1);
    expect(withoutCosmeticEffects(mixed).added).toEqual([]);
    expect(withoutCosmeticEffects(mixed).changed).toEqual(real.changed);

    const onlySound = { ...real, changed: [], added: [sound] };
    expect(isCosmeticEvent(onlySound)).toBe(true);
    expect(cosmeticEffectCount(onlySound)).toBe(0);
    expect(isCosmeticEvent({ ...real, relevance: 'cosmetic' })).toBe(true);
  });

  it('words the values of the misc part', () => {
    expect(miscValueText([10090])).toBe('10090');
    expect(miscValueText({ mesh: [12, 0], animation: [13, 0] })).toBe(
      'mesh 12, 0; animation 13, 0'
    );
    expect(miscValueText(null)).toBe('none');
    expect(miscValueText([])).toBe('none');
  });

  it('knows a diff without entries', () => {
    expect(isEmptyDiff(emptyDiff())).toBe(true);
    expect(isEmptyDiff(null)).toBe(true);
    expect(isEmptyDiff(CRITTER_DIFF)).toBe(false);
  });
});

describe('transitionText', () => {
  const byPath = (path: string) => {
    const found = TRANSITIONS_1460.transitions.find((entry) => entry.path === path);
    if (!found) throw new Error(`no fixture transition ${path}`);
    return found;
  };

  it('words a changed effect parameter as a patch note', () => {
    const note = byPath('effect:53089:spell_params.Chance');
    expect(transitionText(note)).toBe('…% chance to cast …: Chance 60% → 100%');
    expect(transitionCount(note)).toBe('on 760 items');
  });

  it('words a stat that was added, removed or changed', () => {
    expect(transitionText(byPath('stat:287'))).toBe('AttackRange added: 20');
    expect(transitionText(byPath('stat:2'))).toBe('Mass removed (was 410)');
    expect(transitionText(transition({ path: 'stat:440', stat: 440, old: 118, new: 120 }))).toBe(
      'InitiativeType: MeleeInit → PhysicalInit'
    );
    expect(transitionText(transition({ path: 'stat:436', stat: 436, old: 91, new: 94 }))).toBe(
      'DamageType2: MeleeAC → RadiationAC'
    );
  });

  it('words a flag that was set or cleared by its name', () => {
    expect(transitionText(byPath('stat:0:bit:134217728'))).toBe('Flags: Unique cleared');
    expect(
      transitionText(transition({ path: 'stat:30:bit:8', stat: 30, bit: 8, old: 0, new: 1 }))
    ).toBe('Can: Use set');
  });

  it('words an effect that was added or removed with what it acts on', () => {
    expect(transitionText(byPath('effect:53033'))).toBe(
      'Effect added: Lock skill PsychologicalModification for …s'
    );
    expect(
      transitionText(
        transition({ part: 'effects', path: 'effect:53033', spell_id: 53033, old: 122, new: null })
      )
    ).toBe('Effect removed: Lock skill SensoryImprovement for …s');
    expect(
      transitionText(
        transition({
          part: 'effects',
          path: 'effect:53089',
          spell_id: 53089,
          old: 'none',
          new: null,
        })
      )
    ).toBe('Effect removed: …% chance to cast …');
  });

  it('words requirement changes', () => {
    expect(transitionText(byPath('action:3:criterion'))).toBe(
      'Use requirement: PsychologicalModification ≥ 31 → PsychologicalModification ≥ 61'
    );
    expect(transitionText(byPath('action:8:criterion'))).toBe('Wield requirement added: AND');
    expect(
      transitionText(
        transition({ part: 'actions', path: 'action:6', action: 6, old: 'removed', new: null })
      )
    ).toBe('Wear requirements removed');
  });

  it('words attack and defense skills', () => {
    expect(transitionText(byPath('attack:113'))).toBe('Attack skill Rifle added: 67%');
  });

  it('words text changes by the words that differ', () => {
    expect(transitionText(byPath('name'))).toBe('Name: "pill" → "Pill"');
    expect(transitionText(transition({ part: 'text', path: 'description' }))).toBe(
      'Description reworded'
    );
  });

  it('words events that moved, appeared or went', () => {
    expect(transitionText(transition({ part: 'effects', path: 'event', old: 14, new: 0 }))).toBe(
      'Effects moved from Wear to Use'
    );
    expect(
      transitionText(transition({ part: 'effects', path: 'event:14', old: null, new: 'added' }))
    ).toBe('Wear effects added');
  });

  it('words the misc part', () => {
    expect(transitionText(transition({ part: 'misc', path: 'static_instance' }))).toBe(
      'Client instance id changed'
    );
  });

  it('rebuilds a transition from its path, as a shared link carries it', () => {
    for (const listed of TRANSITIONS_1460.transitions) {
      const rebuilt = transitionFromPath(listed.path, listed.old, listed.new);
      expect({ ...rebuilt, items: listed.items, occurrences: listed.occurrences }).toEqual(listed);
      expect(transitionText(rebuilt)).toBe(transitionText(listed));
    }
    expect(transitionFromPath('effect:53045:criterion', null, [54, 100, 2])).toMatchObject({
      part: 'effects',
      spell_id: 53045,
      field: null,
    });
    expect(transitionFromPath('defense:152', 10, 20)).toMatchObject({ part: 'atkdef', stat: 152 });
    expect(transitionFromPath('animation_mesh', null, null).part).toBe('misc');
    expect(transitionFromPath('event:14', null, 'added')).toMatchObject({
      part: 'effects',
      spell_id: null,
    });
  });

  it('knows the transitions that only move an AND or OR', () => {
    expect(isStructuralTransition(byPath('action:8:criterion'))).toBe(true);
    expect(isStructuralTransition(byPath('action:3:criterion'))).toBe(false);
    expect(isStructuralTransition(byPath('stat:287'))).toBe(false);
  });

  it('counts items, and occurrences when an item has the change more than once', () => {
    expect(transitionCount(byPath('action:8:criterion'))).toBe('on 69 items (72 times)');
    expect(transitionCount(transition({ items: 1, occurrences: 1 }))).toBe('on 1 item');
    expect(transitionCount(transition({ items: 3537, occurrences: 3537 }))).toBe('on 3,537 items');
  });
});

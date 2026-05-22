/**
 * Tests for Martial Arts Item template selection in TinkerFite.
 *
 * The "Martial Arts Item" is special: profession determines which template
 * family is used and the character's Martial Arts skill (skill 100) determines
 * which tier within that family and the resolved QL.
 *
 * Spec source: client PlayerCharacter.cs:184-259.
 */

import { describe, it, expect } from 'vitest';
import { selectMartialArtsItem } from '@/utils/weapon-filtering';
import type { WeaponCandidate, FiteInputState } from '@/types/weapon-analysis';

const WEAPON_STAT_MIN_DAMAGE = 286;
const WEAPON_STAT_MAX_DAMAGE = 285;
const WEAPON_STAT_ATTACK_DELAY = 294;

/**
 * Build a minimal weapon candidate stub matching the shape used by
 * the interpolation helpers.
 */
function makeTemplate(
  aoid: number,
  ql: number,
  minDamage: number,
  maxDamage: number,
  attackDelay = 100
): WeaponCandidate {
  return {
    id: aoid,
    aoid,
    name: 'Martial Arts Item',
    ql,
    is_nano: false,
    stats: [
      { id: 1, stat: WEAPON_STAT_MIN_DAMAGE, value: minDamage },
      { id: 2, stat: WEAPON_STAT_MAX_DAMAGE, value: maxDamage },
      { id: 3, stat: WEAPON_STAT_ATTACK_DELAY, value: attackDelay },
    ],
    actions: [],
    equipable: false,
  } as WeaponCandidate;
}

function makeState(profession: number, maSkill: number): FiteInputState {
  return {
    characterStats: {
      breed: 1,
      level: 220,
      profession,
      side: 0,
      crit: 0,
      targetAC: 0,
      aggdef: 75,
    },
    weaponSkills: { 100: maSkill },
    specialAttacks: {},
    initiative: { meleeInit: 0, physicalInit: 0, rangedInit: 0 },
    combatBonuses: { aao: 0, addDamage: 0, wrangle: 0 },
  };
}

/**
 * Mock candidate pool covering all 21 templates. Damage values are arbitrary
 * but distinct per template so tier selection is verifiable.
 */
function makeAllTemplates(): WeaponCandidate[] {
  return [
    // Family 1: Martial Artist
    makeTemplate(211352, 1, 3, 5),
    makeTemplate(211353, 100, 25, 60),
    makeTemplate(211354, 500, 90, 380),
    makeTemplate(211357, 1, 91, 381),
    makeTemplate(211358, 500, 203, 830),
    makeTemplate(211363, 1, 204, 831),
    makeTemplate(211364, 500, 425, 1280),
    // Family 2: Shade
    makeTemplate(211349, 1, 3, 5),
    makeTemplate(211350, 100, 25, 60),
    makeTemplate(211351, 500, 55, 258),
    makeTemplate(211359, 1, 56, 259),
    makeTemplate(211360, 500, 130, 682),
    makeTemplate(211365, 1, 131, 683),
    makeTemplate(211366, 500, 280, 890),
    // Family 3: Generic
    makeTemplate(43712, 1, 3, 5),
    makeTemplate(144745, 100, 25, 60),
    makeTemplate(43713, 500, 65, 280),
    makeTemplate(211355, 1, 66, 281),
    makeTemplate(211356, 500, 140, 715),
    makeTemplate(211361, 1, 204, 831),
    makeTemplate(211362, 500, 300, 990),
  ];
}

describe('selectMartialArtsItem - family selection', () => {
  const candidates = makeAllTemplates();

  it('Martial Artist (profession 2) -> family 1', () => {
    // Skill < 200 -> tier 0 templates 211352 (lo) + 211353 (hi)
    const result = selectMartialArtsItem(candidates, makeState(2, 100));
    expect(result).not.toBeNull();
    // Low template's aoid leaks through after a clamped interpolation
    expect(result!.aoid).toBe(211352);
  });

  it('Shade (profession 15) -> family 2', () => {
    const result = selectMartialArtsItem(candidates, makeState(15, 100));
    expect(result).not.toBeNull();
    expect(result!.aoid).toBe(211349);
  });

  it('Other profession (e.g. Soldier, 1) -> family 3', () => {
    const result = selectMartialArtsItem(candidates, makeState(1, 100));
    expect(result).not.toBeNull();
    expect(result!.aoid).toBe(43712);
  });

  it('Profession 0 (Any) -> family 3', () => {
    const result = selectMartialArtsItem(candidates, makeState(0, 100));
    expect(result).not.toBeNull();
    expect(result!.aoid).toBe(43712);
  });
});

describe('selectMartialArtsItem - tier selection and QL formula', () => {
  const candidates = makeAllTemplates();

  it('MA, skill 150 -> tier 0 (< 200), QL = 150/2 = 75', () => {
    const result = selectMartialArtsItem(candidates, makeState(2, 150));
    expect(result!.ql).toBe(75);
  });

  it('MA, skill 800 -> tier 1 (< 1000), QL = 800/2 = 400', () => {
    const result = selectMartialArtsItem(candidates, makeState(2, 800));
    expect(result!.ql).toBe(400);
    // Tier 1 uses templates 211353 (low) + 211354 (high)
    expect(result!.aoid).toBe(211353);
  });

  it('MA, skill 1500 -> tier 2 (< 2000), QL = (1500-1000)/2 = 250', () => {
    const result = selectMartialArtsItem(candidates, makeState(2, 1500));
    expect(result!.ql).toBe(250);
    // Tier 2 uses templates 211357 (low) + 211358 (high)
    expect(result!.aoid).toBe(211357);
  });

  it('MA, skill 3000 -> tier 3 (>= 2000), QL = (3000-2000)/2 = 500 (clamped)', () => {
    const result = selectMartialArtsItem(candidates, makeState(2, 3000));
    // Target QL is 500, hi template QL is 500 -> exact match
    expect(result!.ql).toBe(500);
    // At the high endpoint, the returned object uses the high template's aoid
    expect(result!.aoid).toBe(211364);
  });

  it('Shade, skill 1500 -> family 2 tier 2 templates', () => {
    const result = selectMartialArtsItem(candidates, makeState(15, 1500));
    expect(result!.ql).toBe(250);
    expect(result!.aoid).toBe(211359); // family 2 tier 2 low
  });

  it('Generic (Soldier), skill 1500 -> family 3 tier 2 templates', () => {
    const result = selectMartialArtsItem(candidates, makeState(1, 1500));
    expect(result!.ql).toBe(250);
    expect(result!.aoid).toBe(211355); // family 3 tier 2 low
  });

  it('QL is floored to at least 1 even when MA skill is 0', () => {
    const result = selectMartialArtsItem(candidates, makeState(2, 0));
    expect(result!.ql).toBe(1);
  });
});

describe('selectMartialArtsItem - damage interpolation', () => {
  const candidates = makeAllTemplates();

  it('linearly interpolates min/max damage to the target QL', () => {
    // MA, skill 1500 -> family 1 tier 2: 211357 (QL 1, 91-381) + 211358 (QL 500, 203-830)
    // QL target = 250, offset = 249, qlDelta = 499
    // min: 91 + 249 * (203-91)/499 = 91 + 249 * 0.2244 = 91 + 55.89 = 146.89 -> 147
    // max: 381 + 249 * (830-381)/499 = 381 + 249 * 0.8998 = 381 + 224.04 = 605.04 -> 605
    const result = selectMartialArtsItem(candidates, makeState(2, 1500));
    const min = result!.stats!.find((s) => s.stat === WEAPON_STAT_MIN_DAMAGE)!.value;
    const max = result!.stats!.find((s) => s.stat === WEAPON_STAT_MAX_DAMAGE)!.value;
    expect(min).toBe(147);
    expect(max).toBe(605);
  });
});

describe('selectMartialArtsItem - error cases', () => {
  it('returns null when expected templates are missing', () => {
    // Pass only family 2 templates but ask for family 1 (MA)
    const partial = makeAllTemplates().filter((w) =>
      [211349, 211350, 211351, 211359, 211360, 211365, 211366].includes(w.aoid!)
    );
    const result = selectMartialArtsItem(partial, makeState(2, 1500));
    expect(result).toBeNull();
  });
});

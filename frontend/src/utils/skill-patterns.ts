/**
 * Skill Pattern Registry
 *
 * Maps stat IDs to regex patterns that match various skill name abbreviations
 * found in different parts of the game data and profile formats.
 *
 * This handles inconsistencies in skill naming across:
 * - Full names vs abbreviations
 * - Different punctuation styles (periods, spaces, etc.)
 * - Compound word formatting
 */

export interface SkillPattern {
  statId: number;
  patterns: RegExp[];
  category: string;
  description: string;
}

/**
 * Registry of skill patterns for flexible matching
 * Each skill can have multiple regex patterns to match various abbreviations
 */
export const SKILL_PATTERNS: Record<number, SkillPattern> = {
  // ============================================================================
  // Melee Weapons
  // ============================================================================

  102: {
    statId: 102,
    patterns: [/^1h\s*Blunt$/i],
    category: 'Melee Weapons',
    description: '1h Blunt',
  },

  103: {
    statId: 103,
    patterns: [/^1h\s*Edged?(\sWeapon)?$/i],
    category: 'Melee Weapons',
    description: '1h Edged',
  },

  104: {
    statId: 104,
    patterns: [/^Melee\s*Ener(gy|\.)?$/i],
    category: 'Melee Weapons',
    description: 'Melee Energy',
  },

  105: {
    statId: 105,
    patterns: [/^2h\s*Edged?$/i],
    category: 'Melee Weapons',
    description: '2h Edged',
  },

  106: {
    statId: 106,
    patterns: [/^Piercing$/i],
    category: 'Melee Weapons',
    description: 'Piercing',
  },

  107: {
    statId: 107,
    patterns: [/^2h\s*Blunt$/i],
    category: 'Melee Weapons',
    description: '2h Blunt',
  },

  100: {
    statId: 100,
    patterns: [/^Martial\s*Arts?$/i],
    category: 'Melee Weapons',
    description: 'Martial Arts',
  },

  101: {
    statId: 101,
    patterns: [/^Mult(i)?(\.?\s*Melee)?$/i, /^Multi\s*Melee$/i],
    category: 'Melee Weapons',
    description: 'Multi Melee',
  },

  118: {
    statId: 118,
    patterns: [/^Melee\.?\s*Init(iative)?$/i],
    category: 'Melee Weapons',
    description: 'Melee Initiative',
  },

  120: {
    statId: 120,
    patterns: [/^Phys(ic(al)?)?\.?\s*Init(iative)?$/i],
    category: 'Melee Weapons',
    description: 'Physical Initiative',
  },

  // ============================================================================
  // Ranged Weapons
  // ============================================================================

  108: {
    statId: 108,
    patterns: [/^Sharp\s*Obj(ects?)?$/i],
    category: 'Ranged Weapons',
    description: 'Sharp Objects',
  },

  111: {
    statId: 111,
    patterns: [/^Bow$/i],
    category: 'Ranged Weapons',
    description: 'Bow',
  },

  112: {
    statId: 112,
    patterns: [/^Pistol$/i],
    category: 'Ranged Weapons',
    description: 'Pistol',
  },

  116: {
    statId: 116,
    patterns: [/^Assault\s*Rif(le)?$/i],
    category: 'Ranged Weapons',
    description: 'Assault Rifle',
  },

  114: {
    statId: 114,
    patterns: [/^MG\s*\/?\s*SMG$/i],
    category: 'Ranged Weapons',
    description: 'MG/SMG',
  },

  115: {
    statId: 115,
    patterns: [/^Shotgun$/i],
    category: 'Ranged Weapons',
    description: 'Shotgun',
  },

  113: {
    statId: 113,
    patterns: [/^Rifle$/i],
    category: 'Ranged Weapons',
    description: 'Rifle',
  },

  109: {
    statId: 109,
    patterns: [/^Grenade$/i],
    category: 'Ranged Weapons',
    description: 'Grenade',
  },

  110: {
    statId: 110,
    patterns: [/^Heavy\s*Weapons?$/i],
    category: 'Ranged Weapons',
    description: 'Heavy Weapons',
  },

  133: {
    statId: 133,
    patterns: [/^Ranged\s*Ener(gy)?$/i],
    category: 'Ranged Weapons',
    description: 'Ranged Energy',
  },

  134: {
    statId: 134,
    patterns: [/^Multi\s*Ranged$/i],
    category: 'Ranged Weapons',
    description: 'Multi Ranged',
  },

  119: {
    statId: 119,
    patterns: [/^Ranged\.?\s*Init(iative)?$/i],
    category: 'Ranged Weapons',
    description: 'Ranged Initiative',
  },

  // ============================================================================
  // Melee Specials
  // ============================================================================

  147: {
    statId: 147,
    patterns: [/^Fast\s*Att(ac)?k$/i],
    category: 'Melee Specials',
    description: 'Fast Attack',
  },

  146: {
    statId: 146,
    patterns: [/^Sneak\s*Att?(ac)?k$/i],
    category: 'Melee Specials',
    description: 'Sneak Attack',
  },

  143: {
    statId: 143,
    patterns: [/^Riposte$/i],
    category: 'Melee Specials',
    description: 'Riposte',
  },

  142: {
    statId: 142,
    patterns: [/^Brawl(ing)?$/i],
    category: 'Melee Specials',
    description: 'Brawling',
  },

  144: {
    statId: 144,
    patterns: [/^Dimach$/i],
    category: 'Melee Specials',
    description: 'Dimach',
  },

  // ============================================================================
  // Ranged Specials
  // ============================================================================

  150: {
    statId: 150,
    patterns: [/^Fling\s*Shot$/i],
    category: 'Ranged Specials',
    description: 'Fling Shot',
  },

  151: {
    statId: 151,
    patterns: [/^Aimed\s*Shot$/i],
    category: 'Ranged Specials',
    description: 'Aimed Shot',
  },

  121: {
    statId: 121,
    patterns: [/^Bow\s*Spc\s*Att(ack)?$/i],
    category: 'Ranged Specials',
    description: 'Bow Special Attack',
  },

  148: {
    statId: 148,
    patterns: [/^Burst$/i],
    category: 'Ranged Specials',
    description: 'Burst',
  },

  167: {
    statId: 167,
    patterns: [/^Full\s*Auto$/i],
    category: 'Ranged Specials',
    description: 'Full Auto',
  },

  // ============================================================================
  // Nanos & Casting
  // ============================================================================

  149: {
    statId: 149,
    patterns: [/^Nano(C)?\.?\s*Init(iative)?$/i],
    category: 'Nanos & Casting',
    description: 'Nano Combat Initiative',
  },

  129: {
    statId: 129,
    patterns: [/^Psych(o(logical)?)?\s*Modi(f(ications?)?)?$/i],
    category: 'Nanos & Casting',
    description: 'Psychological Modifications',
  },

  122: {
    statId: 122,
    patterns: [/^Sensory\s*Impr(ovement)?$/i],
    category: 'Nanos & Casting',
    description: 'Sensory Improvement',
  },

  131: {
    statId: 131,
    patterns: [/^Time\s*(&|and)?\s*Space$/i, /^SpaceTime$/i],
    category: 'Nanos & Casting',
    description: 'Time & Space',
  },

  130: {
    statId: 130,
    patterns: [/^Matt?er\s*Crea(tion)?$/i],
    category: 'Nanos & Casting',
    description: 'Matter Creation',
  },

  128: {
    statId: 128,
    patterns: [/^Bio(logical)?(\s)?.*Metamor(ph(osis)?)?$/i],
    category: 'Nanos & Casting',
    description: 'Biological Metamorphosis',
  },

  127: {
    statId: 127,
    patterns: [/^Matt(er)?\.?\s*Metam(orph(osis)?)?$/i],
    category: 'Nanos & Casting',
    description: 'Matter Metamorphosis',
  },

  // ============================================================================
  // Trade & Repair
  // ============================================================================

  125: {
    statId: 125,
    patterns: [/^Mech(anical)?\.?\s*Eng(i(neering)?)?$/i],
    category: 'Trade & Repair',
    description: 'Mechanical Engineering',
  },

  126: {
    statId: 126,
    patterns: [/^Elec(trical)?\.?\s*Eng(i(neering)?)?$/i],
    category: 'Trade & Repair',
    description: 'Electrical Engineering',
  },

  165: {
    statId: 165,
    patterns: [/^Break(ing)?\s*(&|and)?\s*Entry$/i],
    category: 'Trade & Repair',
    description: 'Break & Entry',
  },

  141: {
    statId: 141,
    patterns: [/^Tutor(ing)?$/i],
    category: 'Trade & Repair',
    description: 'Tutoring',
  },

  157: {
    statId: 157,
    patterns: [/^Quantum\s*F(ield)?\s*T(ech(nology)?)?$/i],
    category: 'Trade & Repair',
    description: 'Quantum Field Technology',
  },

  158: {
    statId: 158,
    patterns: [/^Weapon\s*Sm(i)?t(h(ing)?)?$/i],
    category: 'Trade & Repair',
    description: 'Weapon Smithing',
  },

  159: {
    statId: 159,
    patterns: [/^Pharma(ceutical)?\s*Tech(nology)?$/i],
    category: 'Trade & Repair',
    description: 'Pharmaceuticals',
  },

  161: {
    statId: 161,
    patterns: [/^Comp(uter)?\.?\s*Lit(er(acy)?)?$/i],
    category: 'Trade & Repair',
    description: 'Computer Literacy',
  },

  163: {
    statId: 163,
    patterns: [/^Chem(istry)?$/i],
    category: 'Trade & Repair',
    description: 'Chemistry',
  },

  160: {
    statId: 160,
    patterns: [/^Nano\s*Progra(m(ming)?)?$/i],
    category: 'Trade & Repair',
    description: 'Nano Programming',
  },

  // ============================================================================
  // Combat & Healing
  // ============================================================================

  123: {
    statId: 123,
    patterns: [/^First\s*Aid$/i],
    category: 'Combat & Healing',
    description: 'First Aid',
  },

  124: {
    statId: 124,
    patterns: [/^Treatment$/i],
    category: 'Combat & Healing',
    description: 'Treatment',
  },

  135: {
    statId: 135,
    patterns: [/^Trap\s*Disarm$/i],
    category: 'Combat & Healing',
    description: 'Trap Disarm',
  },

  162: {
    statId: 162,
    patterns: [/^Psych(ology)?$/i],
    category: 'Combat & Healing',
    description: 'Psychology',
  },

  // Note: Trap Disarm is 135 but conflicts with Break & Entry
  // These need to be handled by category context

  164: {
    statId: 164,
    patterns: [/^Conceal(ment)?$/i],
    category: 'Combat & Healing',
    description: 'Concealment',
  },

  // Note: Perception is 156 but conflicts with Evade Close Combat
  // These need to be handled by category context

  // ============================================================================
  // Body & Defense
  // ============================================================================

  152: {
    statId: 152,
    patterns: [/^Body\s*Dev(elopment)?\.?$/i],
    category: 'Body & Defense',
    description: 'Body Development',
  },

  154: {
    statId: 154,
    patterns: [/^Dodge[\-\s]*R(a)?ng(ed)?$/i],
    category: 'Body & Defense',
    description: 'Dodge Ranged',
  },

  155: {
    statId: 155,
    patterns: [/^Evade[\-\s]*Cls\s*C(ombat)?$/i],
    category: 'Body & Defense',
    description: 'Evade Close Combat',
  },

  132: {
    statId: 132,
    patterns: [/^Nano\s*Pool$/i],
    category: 'Body & Defense',
    description: 'Nano Pool',
  },

  153: {
    statId: 153,
    patterns: [/^Duck[\-\s]*Exp(losions?)?$/i],
    category: 'Body & Defense',
    description: 'Duck Explosions',
  },

  145: {
    statId: 145,
    patterns: [/^Parry$/i],
    category: 'Body & Defense',
    description: 'Parry',
  },

  168: {
    statId: 168,
    patterns: [/^Nano\s*Resist(ance)?$/i],
    category: 'Body & Defense',
    description: 'Nano Resist',
  },

  // ============================================================================
  // Exploring
  // ============================================================================

  137: {
    statId: 137,
    patterns: [/^Adventur(ing|e)$/i],
    category: 'Exploring',
    description: 'Adventuring',
  },

  139: {
    statId: 139,
    patterns: [/^Vehicle\s*Air$/i],
    category: 'Exploring',
    description: 'Vehicle Air',
  },

  140: {
    statId: 140,
    patterns: [/^Map\s*Nav.*$/i],
    category: 'Exploring',
    description: 'Map Navigation',
  },

  156: {
    statId: 156,
    patterns: [/^Run\s*Speed$/i],
    category: 'Exploring',
    description: 'Run Speed',
  },

  166: {
    statId: 166,
    patterns: [/^Vehicle\s*Gr(ou)?nd$/i],
    category: 'Exploring',
    description: 'Vehicle Ground',
  },

  117: {
    statId: 117,
    patterns: [/^Vehicle\s*(Water|Hydr(o)?)$/i],
    category: 'Exploring',
    description: 'Vehicle Water',
  },

  // ============================================================================
  // AC Skills
  // ============================================================================

  90: {
    statId: 90,
    patterns: [/^Imp\/Proj\s*AC$/i, /^Projectile\s*AC$/i],
    category: 'ACs',
    description: 'Projectile AC',
  },

  91: {
    statId: 91,
    patterns: [/^Melee\/Ma\s*AC$/i, /^Melee\s*AC$/i],
    category: 'ACs',
    description: 'Melee AC',
  },

  92: {
    statId: 92,
    patterns: [/^Energy\s*AC$/i],
    category: 'ACs',
    description: 'Energy AC',
  },

  93: {
    statId: 93,
    patterns: [/^Chemical\s*AC$/i, /^Chem(ical)?\s*AC$/i],
    category: 'ACs',
    description: 'Chemical AC',
  },

  94: {
    statId: 94,
    patterns: [/^Radiation\s*AC$/i, /^Rad(iation)?\s*AC$/i],
    category: 'ACs',
    description: 'Radiation AC',
  },

  95: {
    statId: 95,
    patterns: [/^Cold\s*AC$/i],
    category: 'ACs',
    description: 'Cold AC',
  },

  96: {
    statId: 96,
    patterns: [/^Poison\s*AC$/i],
    category: 'ACs',
    description: 'Poison AC',
  },

  97: {
    statId: 97,
    patterns: [/^Fire\s*AC$/i],
    category: 'ACs',
    description: 'Fire AC',
  },

  98: {
    statId: 98,
    patterns: [/^Disease\s*AC$/i],
    category: 'ACs',
    description: 'Disease AC',
  },

  205: {
    statId: 205,
    patterns: [/^Reflect\s*Projectile\s*AC$/i],
    category: 'ACs',
    description: 'Reflect Projectile AC',
  },

  206: {
    statId: 206,
    patterns: [/^Reflect\s*Melee\s*AC$/i],
    category: 'ACs',
    description: 'Reflect Melee AC',
  },

  207: {
    statId: 207,
    patterns: [/^Reflect\s*Energy\s*AC$/i],
    category: 'ACs',
    description: 'Reflect Energy AC',
  },

  208: {
    statId: 208,
    patterns: [/^Reflect\s*Chemical\s*AC$/i],
    category: 'ACs',
    description: 'Reflect Chemical AC',
  },

  216: {
    statId: 216,
    patterns: [/^Reflect\s*Radiation\s*AC$/i],
    category: 'ACs',
    description: 'Reflect Radiation AC',
  },

  217: {
    statId: 217,
    patterns: [/^Reflect\s*Cold\s*AC$/i],
    category: 'ACs',
    description: 'Reflect Cold AC',
  },

  218: {
    statId: 218,
    patterns: [/^Reflect\s*Nano\s*AC$/i],
    category: 'ACs',
    description: 'Reflect Nano AC',
  },

  219: {
    statId: 219,
    patterns: [/^Reflect\s*Fire\s*AC$/i],
    category: 'ACs',
    description: 'Reflect Fire AC',
  },

  225: {
    statId: 225,
    patterns: [/^Reflect\s*Poison\s*AC$/i],
    category: 'ACs',
    description: 'Reflect Poison AC',
  },

  226: {
    statId: 226,
    patterns: [/^Shield\s*Projectile\s*AC$/i],
    category: 'ACs',
    description: 'Shield Projectile AC',
  },

  227: {
    statId: 227,
    patterns: [/^Shield\s*Melee\s*AC$/i],
    category: 'ACs',
    description: 'Shield Melee AC',
  },

  228: {
    statId: 228,
    patterns: [/^Shield\s*Energy\s*AC$/i],
    category: 'ACs',
    description: 'Shield Energy AC',
  },

  229: {
    statId: 229,
    patterns: [/^Shield\s*Chemical\s*AC$/i],
    category: 'ACs',
    description: 'Shield Chemical AC',
  },

  230: {
    statId: 230,
    patterns: [/^Shield\s*Radiation\s*AC$/i],
    category: 'ACs',
    description: 'Shield Radiation AC',
  },

  231: {
    statId: 231,
    patterns: [/^Shield\s*Cold\s*AC$/i],
    category: 'ACs',
    description: 'Shield Cold AC',
  },

  232: {
    statId: 232,
    patterns: [/^Shield\s*Nano\s*AC$/i],
    category: 'ACs',
    description: 'Shield Nano AC',
  },

  233: {
    statId: 233,
    patterns: [/^Shield\s*Fire\s*AC$/i],
    category: 'ACs',
    description: 'Shield Fire AC',
  },

  234: {
    statId: 234,
    patterns: [/^Shield\s*Poison\s*AC$/i],
    category: 'ACs',
    description: 'Shield Poison AC',
  },

  238: {
    statId: 238,
    patterns: [/^Absorb\s*Projectile\s*AC$/i],
    category: 'ACs',
    description: 'Absorb Projectile AC',
  },

  239: {
    statId: 239,
    patterns: [/^Absorb\s*Melee\s*AC$/i],
    category: 'ACs',
    description: 'Absorb Melee AC',
  },

  240: {
    statId: 240,
    patterns: [/^Absorb\s*Energy\s*AC$/i],
    category: 'ACs',
    description: 'Absorb Energy AC',
  },

  241: {
    statId: 241,
    patterns: [/^Absorb\s*Chemical\s*AC$/i],
    category: 'ACs',
    description: 'Absorb Chemical AC',
  },

  242: {
    statId: 242,
    patterns: [/^Absorb\s*Radiation\s*AC$/i],
    category: 'ACs',
    description: 'Absorb Radiation AC',
  },

  243: {
    statId: 243,
    patterns: [/^Absorb\s*Cold\s*AC$/i],
    category: 'ACs',
    description: 'Absorb Cold AC',
  },

  244: {
    statId: 244,
    patterns: [/^Absorb\s*Fire\s*AC$/i],
    category: 'ACs',
    description: 'Absorb Fire AC',
  },

  245: {
    statId: 245,
    patterns: [/^Absorb\s*Poison\s*AC$/i],
    category: 'ACs',
    description: 'Absorb Poison AC',
  },

  246: {
    statId: 246,
    patterns: [/^Absorb\s*Nano\s*AC$/i],
    category: 'ACs',
    description: 'Absorb Nano AC',
  },

  // ============================================================================
  // Add Damage
  // ============================================================================

  // 278: 'ProjectileDamageModifier',
  // 279: 'MeleeDamageModifier',
  // 280: 'EnergyDamageModifier',
  // 281: 'ChemicalDamageModifier',
  // 282: 'RadiationDamageModifier',
  // 311: 'ColdDamageModifier',
  // 315: 'NanoDamageModifier',
  // 316: 'FireDamageModifier',
  // 317: 'PoisonDamageModifier',

  278: {
    statId: 278,
    patterns: [/^Projectile\s*Damage\s*Modifier$/i, /Add.?\s*Proj.?\s*Dam(age|.)/],
    category: 'Damage',
    description: 'Projectile Damage Modifier',
  },

  279: {
    statId: 279,
    patterns: [/^Melee\s*Damage\s*Modifier$/i, /Add.?\s*Melee\s*Dam(age|.)/],
    category: 'Damage',
    description: 'Melee Damage Modifier',
  },

  280: {
    statId: 280,
    patterns: [/^Energy\s*Damage\s*Modifier$/i, /Add.?\s*Energy\s*Dam(age|.)/],
    category: 'Damage',
    description: 'Energy Damage Modifier',
  },

  281: {
    statId: 281,
    patterns: [/^Chemical\s*Damage\s*Modifier$/i, /Add.?\s*Chem.?\s*Dam(age|.)/],
    category: 'Damage',
    description: 'Chemical Damage Modifier',
  },

  282: {
    statId: 282,
    patterns: [/^Radiation\s*Damage\s*Modifier$/i, /Add.?\s*Rad.?\s*Dam(age|.)/],
    category: 'Damage',
    description: 'Radiation Damage Modifier',
  },

  311: {
    statId: 311,
    patterns: [/^Cold\s*Damage\s*Modifier$/i, /Add.?\s*Cold\s*Dam(age|.)/],
    category: 'Damage',
    description: 'Cold Damage Modifier',
  },

  315: {
    statId: 315,
    patterns: [/^Nano\s*Damage\s*Modifier$/i, /Add.?\s*Nano\s*Dam(age|.)/],
    category: 'Damage',
    description: 'Nano Damage Modifier',
  },

  316: {
    statId: 316,
    patterns: [/^Fire\s*Damage\s*Modifier$/i, /Add.?\s*Fire\s*Dam(age|.)/],
    category: 'Damage',
    description: 'Fire Damage Modifier',
  },

  317: {
    statId: 317,
    patterns: [/^Poison\s*Damage\s*Modifier$/i, /Add.?\s*Poison\s*Dam(age|.)/],
    category: 'Damage',
    description: 'Poison Damage Modifier',
  },

  // ============================================================================
  // Misc Skills
  // ============================================================================

  276: {
    statId: 276,
    patterns: [/^Add\s*All\s*Off(ense|\.)?$/i],
    category: 'Misc',
    description: 'Add All Offense',
  },

  277: {
    statId: 277,
    patterns: [/^Add\s*All\s*Def(ense|\.)$/i],
    category: 'Misc',
    description: 'Add All Defense',
  },

  181: {
    statId: 181,
    patterns: [/^Max\s*NCU$/i],
    category: 'Misc',
    description: 'Max NCU',
  },

  236: {
    statId: 236,
    patterns: [/^InsurancePercentage$/i],
    category: 'ACs',
    description: 'Insurance Percentage',
  },

  318: {
    statId: 318,
    patterns: [/^NanoCost$/i, /Nano\s*Point\s*Cost\s*Modifier/i],
    category: 'Misc',
    description: 'Nano Cost',
  },

  343: {
    statId: 343,
    patterns: [/^Heal\s*Delta$/i],
    category: 'Misc',
    description: 'Heal Delta',
  },

  364: {
    statId: 364,
    patterns: [/^Nano\s*Delta$/i],
    category: 'Misc',
    description: 'Nano Delta',
  },

  341: {
    statId: 341,
    patterns: [/^XP\s*Bonus$/i, /^Add.\s*XP$/i],
    category: 'Misc',
    description: 'XP Bonus',
  },

  382: {
    statId: 382,
    patterns: [/^SkillLock$/i, /Skill\s*Time\s*Lock\s*Modifier/i],
    category: 'Misc',
    description: 'Skill Lock',
  },

  383: {
    statId: 383,
    patterns: [/^NanoInterrupt$/i, /Nano\s*Formula\s*Interrupt\s*Modifier/i],
    category: 'Misc',
    description: 'Nano Interrupt',
  },

  0: {
    statId: 0,
    patterns: [/^Empty$/i],
    category: 'Misc',
    description: 'None',
  },
};

/* Find a skill value from a profile category by matching against known patterns
 * @param skillCategory Object containing skills from a profile category
 * @param statId The stat ID we're looking for
 * @returns The skill value if found, or null
 */
export function findSkillByPattern(
  skillCategory: Record<string, any>,
  statId: number
): number | null {
  const pattern = SKILL_PATTERNS[statId];
  if (!pattern) return null;

  for (const [skillName, skillData] of Object.entries(skillCategory)) {
    // Check if any pattern matches this skill name
    for (const regex of pattern.patterns) {
      if (regex.test(skillName)) {
        // Handle both direct values and objects with value property
        if (typeof skillData === 'object' && skillData !== null && 'value' in skillData) {
          return skillData.value;
        } else if (typeof skillData === 'number') {
          return skillData;
        }
      }
    }
  }

  return null;
}

/**
 * Get all skill patterns for a specific category
 */
export function getSkillsByCategory(category: string): SkillPattern[] {
  return Object.values(SKILL_PATTERNS).filter((pattern) => pattern.category === category);
}

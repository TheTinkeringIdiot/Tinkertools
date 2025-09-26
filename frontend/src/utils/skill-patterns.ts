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
  statId: number
  patterns: RegExp[]
  category: string
  description: string
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
    description: '1h Blunt'
  },

  103: {
    statId: 103,
    patterns: [/^1h\s*Edged?$/i],
    category: 'Melee Weapons',
    description: '1h Edged'
  },

  104: {
    statId: 104,
    patterns: [/^Melee\s*Ener(gy|\.)?$/i],
    category: 'Melee Weapons',
    description: 'Melee Energy'
  },

  105: {
    statId: 105,
    patterns: [/^2h\s*Edged?$/i],
    category: 'Melee Weapons',
    description: '2h Edged'
  },

  106: {
    statId: 106,
    patterns: [/^Piercing$/i],
    category: 'Melee Weapons',
    description: 'Piercing'
  },

  107: {
    statId: 107,
    patterns: [/^2h\s*Blunt$/i],
    category: 'Melee Weapons',
    description: '2h Blunt'
  },

  100: {
    statId: 100,
    patterns: [/^Martial\s*Arts?$/i],
    category: 'Melee Weapons',
    description: 'Martial Arts'
  },

  101: {
    statId: 101,
    patterns: [/^Mult(i)?(\.?\s*Melee)?$/i, /^Multi\s*Melee$/i],
    category: 'Melee Weapons',
    description: 'Multi Melee'
  },

  118: {
    statId: 118,
    patterns: [/^Melee\.?\s*Init(iative)?$/i],
    category: 'Melee Weapons',
    description: 'Melee Initiative'
  },

  121: {
    statId: 121,
    patterns: [/^Phys(ic(al)?)?\.?\s*Init(iative)?$/i],
    category: 'Melee Weapons',
    description: 'Physical Initiative'
  },

  // ============================================================================
  // Ranged Weapons
  // ============================================================================

  108: {
    statId: 108,
    patterns: [/^Sharp\s*Obj(ects?)?$/i],
    category: 'Ranged Weapons',
    description: 'Sharp Objects'
  },

  109: {
    statId: 109,
    patterns: [/^Bow$/i],
    category: 'Ranged Weapons',
    description: 'Bow'
  },

  112: {
    statId: 112,
    patterns: [/^Pistol$/i],
    category: 'Ranged Weapons',
    description: 'Pistol'
  },

  113: {
    statId: 113,
    patterns: [/^Assault\s*Rif(le)?$/i],
    category: 'Ranged Weapons',
    description: 'Assault Rifle'
  },

  115: {
    statId: 115,
    patterns: [/^MG\s*\/?\s*SMG$/i],
    category: 'Ranged Weapons',
    description: 'MG/SMG'
  },

  116: {
    statId: 116,
    patterns: [/^Shotgun$/i],
    category: 'Ranged Weapons',
    description: 'Shotgun'
  },

  117: {
    statId: 117,
    patterns: [/^Rifle$/i],
    category: 'Ranged Weapons',
    description: 'Rifle'
  },

  118: {
    statId: 118,
    patterns: [/^Grenade$/i],
    category: 'Ranged Weapons',
    description: 'Grenade'
  },

  119: {
    statId: 119,
    patterns: [/^Heavy\s*Weapons?$/i],
    category: 'Ranged Weapons',
    description: 'Heavy Weapons'
  },

  133: {
    statId: 133,
    patterns: [/^Ranged\s*Ener(gy)?$/i],
    category: 'Ranged Weapons',
    description: 'Ranged Energy'
  },

  229: {
    statId: 229,
    patterns: [/^Multi\s*Ranged$/i],
    category: 'Ranged Weapons',
    description: 'Multi Ranged'
  },

  111: {
    statId: 111,
    patterns: [/^Ranged\.?\s*Init(iative)?$/i],
    category: 'Ranged Weapons',
    description: 'Ranged Initiative'
  },

  // ============================================================================
  // Melee Specials
  // ============================================================================

  142: {
    statId: 142,
    patterns: [/^Fast\s*Att(ac)?k$/i],
    category: 'Melee Specials',
    description: 'Fast Attack'
  },

  144: {
    statId: 144,
    patterns: [/^Sneak\s*Att?(ac)?k$/i],
    category: 'Melee Specials',
    description: 'Sneak Attack'
  },

  146: {
    statId: 146,
    patterns: [/^Riposte$/i],
    category: 'Melee Specials',
    description: 'Riposte'
  },

  151: {
    statId: 151,
    patterns: [/^Brawl(ing)?$/i],
    category: 'Melee Specials',
    description: 'Brawling'
  },

  154: {
    statId: 154,
    patterns: [/^Dimach$/i],
    category: 'Melee Specials',
    description: 'Dimach'
  },

  // ============================================================================
  // Ranged Specials
  // ============================================================================

  134: {
    statId: 134,
    patterns: [/^Fling\s*Shot$/i],
    category: 'Ranged Specials',
    description: 'Fling Shot'
  },

  148: {
    statId: 148,
    patterns: [/^Aimed\s*Shot$/i],
    category: 'Ranged Specials',
    description: 'Aimed Shot'
  },

  150: {
    statId: 150,
    patterns: [/^Bow\s*Spc\s*Att(ack)?$/i],
    category: 'Ranged Specials',
    description: 'Bow Special Attack'
  },

  140: {
    statId: 140,
    patterns: [/^Burst$/i],
    category: 'Ranged Specials',
    description: 'Burst'
  },

  147: {
    statId: 147,
    patterns: [/^Full\s*Auto$/i],
    category: 'Ranged Specials',
    description: 'Full Auto'
  },

  // ============================================================================
  // Nanos & Casting
  // ============================================================================

  122: {
    statId: 122,
    patterns: [/^NanoC\.?\s*Init(iative)?$/i],
    category: 'Nanos & Casting',
    description: 'Nano Combat Initiative'
  },

  123: {
    statId: 123,
    patterns: [/^Psych(o(logical)?)?\s*Modi(f(ications?)?)?$/i],
    category: 'Nanos & Casting',
    description: 'Psychological Modifications'
  },

  124: {
    statId: 124,
    patterns: [/^Sensory\s*Impr(ovement)?$/i],
    category: 'Nanos & Casting',
    description: 'Sensory Improvement'
  },

  125: {
    statId: 125,
    patterns: [/^Time\s*(&|and)?\s*Space$/i],
    category: 'Nanos & Casting',
    description: 'Time & Space'
  },

  130: {
    statId: 130,
    patterns: [/^Matt?er\s*Crea(tion)?$/i],
    category: 'Nanos & Casting',
    description: 'Matter Creation'
  },

  131: {
    statId: 131,
    patterns: [/^Bio(logical)?\s*Metamor(ph(osis)?)?$/i],
    category: 'Nanos & Casting',
    description: 'Biological Metamorphosis'
  },

  132: {
    statId: 132,
    patterns: [/^Matt(er)?\.?\s*Metam(orph(osis)?)?$/i],
    category: 'Nanos & Casting',
    description: 'Matter Metamorphosis'
  },

  // ============================================================================
  // Trade & Repair
  // ============================================================================

  // Note: Mechanical Engineering is 125 but conflicts with Time & Space
  // These need to be handled by category context

  126: {
    statId: 126,
    patterns: [/^Elec(trical)?\.?\s*Eng(i(neering)?)?$/i],
    category: 'Trade & Repair',
    description: 'Electrical Engineering'
  },

  135: {
    statId: 135,
    patterns: [/^Break\s*(&|and)?\s*Entry$/i],
    category: 'Trade & Repair',
    description: 'Break & Entry'
  },

  141: {
    statId: 141,
    patterns: [/^Tutor(ing)?$/i],
    category: 'Trade & Repair',
    description: 'Tutoring'
  },

  157: {
    statId: 157,
    patterns: [/^Quantum\s*F(ield)?\s*T(ech(nology)?)?$/i],
    category: 'Trade & Repair',
    description: 'Quantum Field Technology'
  },

  158: {
    statId: 158,
    patterns: [/^Weapon\s*Sm(i)?t(h(ing)?)?$/i],
    category: 'Trade & Repair',
    description: 'Weapon Smithing'
  },

  159: {
    statId: 159,
    patterns: [/^Pharma(ceutical)?\s*Tech(nology)?$/i],
    category: 'Trade & Repair',
    description: 'Pharmaceuticals'
  },

  161: {
    statId: 161,
    patterns: [/^Comp(uter)?\.?\s*Lit(er(acy)?)?$/i],
    category: 'Trade & Repair',
    description: 'Computer Literacy'
  },

  163: {
    statId: 163,
    patterns: [/^Chem(istry)?$/i],
    category: 'Trade & Repair',
    description: 'Chemistry'
  },

  160: {
    statId: 160,
    patterns: [/^Nano\s*Progra(m(ming)?)?$/i],
    category: 'Trade & Repair',
    description: 'Nano Programming'
  },

  // ============================================================================
  // Combat & Healing
  // ============================================================================

  // Note: First Aid is 123 but conflicts with Psychological Modifications
  // Note: Treatment is 124 but conflicts with Sensory Improvement
  // These need to be handled by category context

  162: {
    statId: 162,
    patterns: [/^Psych(ology)?$/i],
    category: 'Combat & Healing',
    description: 'Psychology'
  },

  // Note: Trap Disarm is 135 but conflicts with Break & Entry
  // These need to be handled by category context

  164: {
    statId: 164,
    patterns: [/^Conceal(ment)?$/i],
    category: 'Combat & Healing',
    description: 'Concealment'
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
    description: 'Body Development'
  },

  154: {
    statId: 154,
    patterns: [/^Dodge[\-\s]*R(a)?ng(ed)?$/i],
    category: 'Body & Defense',
    description: 'Dodge Ranged'
  },

  155: {
    statId: 155,
    patterns: [/^Evade[\-\s]*Cls\s*C(ombat)?$/i],
    category: 'Body & Defense',
    description: 'Evade Close Combat'
  },

  164: {
    statId: 164,
    patterns: [/^Nano\s*Pool$/i],
    category: 'Body & Defense',
    description: 'Nano Pool'
  },

  153: {
    statId: 153,
    patterns: [/^Duck[\-\s]*Exp(losions?)?$/i],
    category: 'Body & Defense',
    description: 'Duck Explosions'
  },

  145: {
    statId: 145,
    patterns: [/^Parry$/i],
    category: 'Body & Defense',
    description: 'Parry'
  },

  168: {
    statId: 168,
    patterns: [/^Nano\s*Resist(ance)?$/i],
    category: 'Body & Defense',
    description: 'Nano Resist'
  },

  // ============================================================================
  // Exploring
  // ============================================================================

  138: {
    statId: 138,
    patterns: [/^Adventur(ing|e)$/i],
    category: 'Exploring',
    description: 'Adventuring'
  },

  139: {
    statId: 139,
    patterns: [/^Swim(ming)?$/i, /^Vehicle\s*Air$/i],
    category: 'Exploring',
    description: 'Swimming/Vehicle Air'
  },

  156: {
    statId: 156,
    patterns: [/^Run\s*Speed$/i],
    category: 'Exploring',
    description: 'Run Speed'
  },

  166: {
    statId: 166,
    patterns: [/^Vehicle\s*Ground$/i],
    category: 'Exploring',
    description: 'Vehicle Ground'
  },

  117: {
    statId: 117,
    patterns: [/^Vehicle\s*Water$/i],
    category: 'Exploring',
    description: 'Vehicle Water'
  },

  // ============================================================================
  // AC Skills
  // ============================================================================

  90: {
    statId: 90,
    patterns: [/^Imp\/Proj\s*AC$/i, /^Projectile\s*AC$/i],
    category: 'ACs',
    description: 'Projectile AC'
  },

  91: {
    statId: 91,
    patterns: [/^Melee\/Ma\s*AC$/i, /^Melee\s*AC$/i],
    category: 'ACs',
    description: 'Melee AC'
  },

  92: {
    statId: 92,
    patterns: [/^Energy\s*AC$/i],
    category: 'ACs',
    description: 'Energy AC'
  },

  93: {
    statId: 93,
    patterns: [/^Chemical\s*AC$/i, /^Chem(ical)?\s*AC$/i],
    category: 'ACs',
    description: 'Chemical AC'
  },

  94: {
    statId: 94,
    patterns: [/^Radiation\s*AC$/i, /^Rad(iation)?\s*AC$/i],
    category: 'ACs',
    description: 'Radiation AC'
  },

  95: {
    statId: 95,
    patterns: [/^Cold\s*AC$/i],
    category: 'ACs',
    description: 'Cold AC'
  },

  96: {
    statId: 96,
    patterns: [/^Poison\s*AC$/i],
    category: 'ACs',
    description: 'Poison AC'
  },

  97: {
    statId: 97,
    patterns: [/^Fire\s*AC$/i],
    category: 'ACs',
    description: 'Fire AC'
  },

  98: {
    statId: 98,
    patterns: [/^Disease\s*AC$/i],
    category: 'ACs',
    description: 'Disease AC'
  }

  // Note: Deflect doesn't exist as a skill - it might be Parry (145)
}

/**
 * Find a skill value from a profile category by matching against known patterns
 * @param skillCategory Object containing skills from a profile category
 * @param statId The stat ID we're looking for
 * @returns The skill value if found, or null
 */
export function findSkillByPattern(
  skillCategory: Record<string, any>,
  statId: number
): number | null {
  const pattern = SKILL_PATTERNS[statId]
  if (!pattern) return null

  for (const [skillName, skillData] of Object.entries(skillCategory)) {
    // Check if any pattern matches this skill name
    for (const regex of pattern.patterns) {
      if (regex.test(skillName)) {
        // Handle both direct values and objects with value property
        if (typeof skillData === 'object' && skillData !== null && 'value' in skillData) {
          return skillData.value
        } else if (typeof skillData === 'number') {
          return skillData
        }
      }
    }
  }

  return null
}

/**
 * Get all skill patterns for a specific category
 */
export function getSkillsByCategory(category: string): SkillPattern[] {
  return Object.values(SKILL_PATTERNS).filter(pattern => pattern.category === category)
}
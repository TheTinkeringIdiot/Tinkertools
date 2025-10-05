/**
 * Skill Mappings for TinkerProfiles
 * 
 * Maps profile skill names to their corresponding STAT IDs from game-data.ts.
 * These IDs match the authoritative SKILL_COST_FACTORS and related data structures.
 */

// Skill IDs using official Anarchy Online STAT IDs from game-data.ts
export const SKILL_ID_MAP: Record<string, number> = {
  // Attributes
  'Strength': 16,
  'Agility': 17,
  'Stamina': 18,
  'Intelligence': 19,
  'Sense': 20,
  'Psychic': 21,
  
  // Body & Defense category
  'Body Dev.': 152,
  'Nano Pool': 132,
  'Martial Arts': 100,
  'Brawling': 142,
  'Dimach': 144,
  'Riposte': 143,
  'Adventuring': 137,
  'Swimming': 138,
  'Dodge-Rng': 154,
  'Evade-ClsC': 155,
  'Duck-Exp': 153,
  'Nano Resist': 168,
  'Deflect': 145, // Parry in game-data
  
  // Melee Weapons category
  '1h Blunt': 102,
  '1h Edged': 103,
  'Piercing': 106,
  '2h Blunt': 107,
  '2h Edged': 105,
  'Melee Energy': 104,
  'Sneak Attack': 146,
  'Multi Melee': 101,
  
  // Melee Specials
  'Fast Attack': 147,
  
  // Ranged Weapons category
  'Sharp Obj': 108,
  'Grenade': 109,
  'Heavy Weapons': 110,
  'Bow': 111,
  'Pistol': 112,
  'Assault Rif': 116,
  'MG/SMG': 114,
  'Shotgun': 115,
  'Rifle': 113,
  'Ranged Energy': 133,
  
  // Ranged Specials category
  'Fling Shot': 150,
  'Aimed Shot': 151,
  'Burst': 148,
  'Full Auto': 167,
  'Bow Spc Att': 121,
  'Multi Ranged': 134,
  
  // Initiative skills
  'Melee Init': 118,
  'Ranged Init': 119,
  'Physical Init': 120,
  'NanoC Init': 149,
  
  // Movement
  'Run Speed': 156,
  
  // Trade & Repair category
  'Mech Eng': 125,
  'Elec Eng': 126,
  'Quantum FT': 157,
  'Weapon Smith': 158,
  'Pharma Tech': 159,
  'Nano Programming': 160,
  'Computer Literacy': 161,
  'Comp. Liter': 161,
  'Psychology': 162,
  'Chemistry': 163,
  'Tutoring': 141,
  'Matt Metam': 127,
  'Bio Metamor': 128,
  
  // Nanos & Casting category
  'Psycho Modi': 129,
  'Matter Creation': 130,
  'Time & Space': 131,
  'Sensory Improvement': 122,
  
  // Combat & Healing category
  'First Aid': 123,
  'Treatment': 124,

  // AC (Armor Class) stats - not trainable skills but stats that appear in profiles
  'Chemical AC': 93,
  'Cold AC': 95,
  'Energy AC': 92,
  'Fire AC': 97,
  'Nano AC': 98,
  'Projectile AC': 90,
  'Melee AC': 91,
  'Radiation AC': 94,
  'Poison AC': 96,

  // Reflect AC stats
  'ReflectProjectileAC': 205,
  'ReflectMeleeAC': 206,
  'ReflectEnergyAC': 207,
  'ReflectChemicalAC': 208,
  'ReflectRadiationAC': 216,
  'ReflectColdAC': 217,
  'ReflectNanoAC': 218,
  'ReflectFireAC': 219,
  'ReflectPoisonAC': 225,

  // Absorb AC stats
  'AbsorbProjectileAC': 238,
  'AbsorbMeleeAC': 239,
  'AbsorbEnergyAC': 240,
  'AbsorbChemicalAC': 241,
  'AbsorbRadiationAC': 242,
  'AbsorbColdAC': 243,
  'AbsorbFireAC': 244,
  'AbsorbPoisonAC': 245,
  'AbsorbNanoAC': 246,

  // Special stats that appear in cluster data but aren't trainable skills
  'Max Health': 1,      // MaxHealth stat
  'Max Nano': 221,      // MaxNanoEnergy stat
  'WornItem': 355,      // WornItem equipment flags (bitwise OR of equipped item categories)
  
  // Exploring category
  'Concealment': 164,
  'Break & Entry': 165,
  'Trap Disarm.': 135,
  'Perception': 136,
  'Vehicle Air': 139,
  'Vehicle Ground': 166,
  'Vehicle Water': 117,
  'Map Navigation': 140,
  
  // Misc category skills - damage modifiers and combat bonuses
  'Add All Off.': 276,       // AddAllOffense
  'Add All Def.': 277,       // AddAllDefense
  'Add. Proj. Dam.': 278,    // ProjectileDamageModifier
  'Add. Melee Dam.': 279,    // MeleeDamageModifier
  'Add. Energy Dam.': 280,   // EnergyDamageModifier
  'Add. Chem. Dam.': 281,    // ChemicalDamageModifier
  'Add. Rad. Dam.': 282,     // RadiationDamageModifier
  'Add. Cold Dam.': 311,     // ColdDamageModifier
  'Add. Fire Dam.': 316,     // FireDamageModifier
  'Add. Poison Dam.': 317,   // PoisonDamageModifier
  'Add. Nano Dam.': 315,     // NanoDamageModifier

  // Other Misc skills
  '% Add. Xp': 319,          // XPModifier
  '% Add. Nano Cost': 318,   // NanoCost (modifier)
  'Max NCU': 181,            // MaxNCU
  'Decreased Nano-Interrupt Modifier %': 383, // NanoInterruptModifier
  'SkillLockModifier': 382,  // SkillLockModifier
  'HealDelta': 343,          // HealDelta
  'NanoDelta': 364,          // NanoDelta
  'RangeInc. NF': 381,       // NanoRange
  'RangeInc. Weapon': 287,   // AttackRange
  'CriticalIncrease': 379,   // CriticalIncrease
  'BeltSlots': 45,           // BeltSlots
  'Free deck slot': 428,     // BeltSlots (used for deck slots)
  'Healing Efficiency': 535, // HealMultiplier
  'Direct Nano Damage Efficiency': 536, // NanoDamageMultiplier
  'Expansion': 389,          // Expansion (account type bitflag)
  'Scale': 360,              // Scale

  // Shield AC skills
  'ShieldProjectileAC': 226, // ShieldProjectileAC
  'ShieldMeleeAC': 227,      // ShieldMeleeAC
  'ShieldEnergyAC': 228,     // ShieldEnergyAC
  'ShieldChemicalAC': 229,   // ShieldChemicalAC
  'ShieldRadiationAC': 230,  // ShieldRadiationAC
  'ShieldColdAC': 231,       // ShieldColdAC
  'ShieldNanoAC': 232,       // ShieldNanoAC
  'ShieldFireAC': 233,       // ShieldFireAC
  'ShieldPoisonAC': 234,     // ShieldPoisonAC

  // AOSetups skill name variations
  'Break&Entry': 165,        // AOSetups variant of 'Break & Entry'
  'Elec. Engi': 126,         // AOSetups variant of 'Elec Eng'
  'MG / SMG': 114,           // AOSetups variant of 'MG/SMG'
  'Matt. Metam': 127,        // AOSetups variant of 'Matt Metam'
  'Matter Crea': 130,        // AOSetups variant of 'Matter Creation'
  'Mech. Engi': 125,         // AOSetups variant of 'Mech Eng'
  'Melee Ener.': 104,        // AOSetups variant of 'Melee Energy'
  'Melee. Init.': 118,       // AOSetups variant of 'Melee Init'
  'Mult. Melee': 101,        // AOSetups variant of 'Multi Melee'
  'Nano Progra': 160,        // AOSetups variant of 'Nano Programming'
  'NanoC. Init.': 149,       // AOSetups variant of 'NanoC Init'
  'Physic. Init': 120,       // AOSetups variant of 'Physical Init'
  'Ranged Ener': 133,        // AOSetups variant of 'Ranged Energy'
  'Ranged. Init.': 119,      // AOSetups variant of 'Ranged Init'
  'Sensory Impr': 122,       // AOSetups variant of 'Sensory Improvement'
  'Sneak Atck': 146,         // AOSetups variant of 'Sneak Attack'
  'Time&Space': 131,         // AOSetups variant of 'Time & Space'
  'Weapon Smt': 158          // AOSetups variant of 'Weapon Smith'
};

/**
 * Reverse mapping from skill ID to profile skill name
 */
export const ID_TO_SKILL_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(SKILL_ID_MAP).map(([name, id]) => [id, name])
);

/**
 * Get skill ID for a profile skill name
 */
export function getSkillId(skillName: string): number | null {
  return SKILL_ID_MAP[skillName] ?? null;
}

/**
 * Get profile skill name for a skill ID
 */
export function getSkillName(skillId: number): string | null {
  return ID_TO_SKILL_NAME[skillId] ?? null;
}

/**
 * Profile categories and their expected skills
 */
export const SKILL_CATEGORIES: Record<string, string[]> = {
  'Attributes': ['Strength', 'Agility', 'Stamina', 'Intelligence', 'Sense', 'Psychic'],
  'Body & Defense': ['Body Dev.', 'Nano Pool', 'Nano Resist', 'Dodge-Rng', 'Evade-ClsC', 'Duck-Exp', 'Deflect'],
  'Ranged Weapons': ['Pistol', 'Ranged Init', 'Grenade', 'Heavy Weapons', 'Bow', 'Rifle', 'MG/SMG', 'Shotgun', 'Assault Rif', 'Multi Ranged'],
  'Ranged Specials': ['Fling Shot', 'Sharp Obj', 'Bow Spc Att', 'Burst', 'Full Auto', 'Aimed Shot'],
  'Melee Weapons': ['Piercing', 'Melee Init', 'Physical Init', '1h Blunt', '1h Edged', 'Melee Energy', '2h Edged', '2h Blunt', 'Martial Arts', 'Multi Melee'],
  'Melee Specials': ['Riposte', 'Dimach', 'Sneak Attack', 'Fast Attack', 'Brawling'],
  'Nanos & Casting': ['Matter Creation', 'NanoC Init', 'Psycho Modi', 'Sensory Improvement', 'Time & Space', 'Bio Metamor', 'Matt Metam'],
  'Exploring': ['Vehicle Air', 'Vehicle Ground', 'Vehicle Water', 'Adventuring', 'Run Speed'],
  'Trade & Repair': ['Chemistry', 'Computer Literacy', 'Elec Eng', 'Mech Eng', 'Nano Programming', 'Pharma Tech', 'Quantum FT', 'Tutoring', 'Weapon Smith', 'Break & Entry'],
  'Combat & Healing': ['Concealment', 'Perception', 'Psychology', 'Treatment', 'First Aid', 'Trap Disarm.'],
  'ACs': [
    'Projectile AC', 'Melee AC', 'Energy AC', 'Chemical AC', 'Radiation AC', 'Cold AC', 'Nano AC', 'Fire AC', 'Poison AC',
    'ShieldProjectileAC', 'ShieldMeleeAC', 'ShieldEnergyAC', 'ShieldChemicalAC', 'ShieldRadiationAC', 'ShieldColdAC', 'ShieldNanoAC', 'ShieldFireAC', 'ShieldPoisonAC',
    'ReflectProjectileAC', 'ReflectMeleeAC', 'ReflectEnergyAC', 'ReflectChemicalAC', 'ReflectRadiationAC', 'ReflectColdAC', 'ReflectNanoAC', 'ReflectFireAC', 'ReflectPoisonAC',
    'AbsorbProjectileAC', 'AbsorbMeleeAC', 'AbsorbEnergyAC', 'AbsorbChemicalAC', 'AbsorbRadiationAC', 'AbsorbColdAC', 'AbsorbFireAC', 'AbsorbPoisonAC', 'AbsorbNanoAC'
  ],
  'Misc': ['% Add. Xp', '% Add. Nano Cost', 'Max NCU', 'Decreased Nano-Interrupt Modifier %', 'SkillLockModifier', 'HealDelta', 'Add All Def.', 'NanoDelta', 'RangeInc. NF', 'RangeInc. Weapon', 'CriticalIncrease', 'Free deck slot', 'Healing Efficiency', 'Add All Off.', 'Add. Proj. Dam.', 'Add. Melee Dam.', 'Add. Energy Dam.', 'Add. Chem. Dam.', 'Add. Rad. Dam.', 'Add. Cold Dam.', 'Add. Fire Dam.', 'Add. Poison Dam.', 'Direct Nano Damage Efficiency', 'Add. Nano Dam.', 'Expansion', 'Scale']
};
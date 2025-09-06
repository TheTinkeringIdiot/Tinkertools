/**
 * Skill Mappings for TinkerProfiles
 * 
 * Maps profile skill names to their corresponding STAT IDs from game-data.ts.
 * These IDs match the authoritative SKILL_COST_FACTORS and related data structures.
 */

// Skill IDs using official Anarchy Online STAT IDs from game-data.ts
export const SKILL_ID_MAP: Record<string, number> = {
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
  
  // Exploring category
  'Concealment': 164,
  'Break & Entry': 165,
  'Trap Disarm.': 135,
  'Perception': 136,
  'Vehicle Air': 139,
  'Vehicle Ground': 166,
  'Vehicle Water': 117,
  'Map Navigation': 140
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
  'Combat & Healing': ['Concealment', 'Perception', 'Psychology', 'Treatment', 'First Aid', 'Trap Disarm.']
};
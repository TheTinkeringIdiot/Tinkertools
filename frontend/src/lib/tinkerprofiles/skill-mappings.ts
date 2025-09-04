/**
 * Skill Mappings for TinkerProfiles
 * 
 * Maps profile skill names to their corresponding skill IDs in the IP calculator system.
 * Based on SKILL_NAMES array from ip-calculator.ts
 */

// Skill IDs from SKILL_NAMES array (0-96+)
export const SKILL_ID_MAP: Record<string, number> = {
  // Body & Defense category
  'Body Dev.': 0,
  'Body Dev': 0,
  'Nano Pool': 1,
  'Martial Arts': 2,
  'Brawling': 3,
  'Dimach': 4,
  'Riposte': 5,
  'Adventuring': 6,
  'Swimming': 7,
  
  // Melee Weapons category
  '1h Blunt': 8,
  '1h Edged': 9,
  'Piercing': 10,
  '2h Blunt': 11,
  '2h Edged': 12,
  'Melee Ener.': 13,
  'Melee Energy': 13,
  'Deflect': 14,
  'Sneak Atck': 15,
  'Sneak Attack': 15,
  'Mult. Melee': 16,
  'Multi Melee': 16,
  
  // Melee Specials
  'Fast Attack': 17,
  
  // Ranged Weapons category
  'Sharp Obj': 18,
  'Grenade': 19,
  'Heavy Weapons': 20,
  'Bow': 21,
  'Pistol': 22,
  'Assault Rif': 23,
  'MG / SMG': 24,
  'MG/SMG': 24,
  'Shotgun': 25,
  'Rifle': 26,
  'Ranged Energy': 27,
  
  // Ranged Specials category
  'Fling Shot': 28,
  'Aimed Shot': 29,
  'Burst': 30,
  'Full Auto': 31,
  'Bow Spc Att': 32,
  'Multi Ranged': 33,
  
  // Initiative skills
  'Melee. Init.': 34,
  'Melee Init': 34,
  'Ranged. Init.': 35,  
  'Ranged Init': 35,
  'Physic. Init': 36,
  'Physical Init': 36,
  'NanoC. Init.': 37,
  'NanoC Init': 37,
  
  // Defense skills
  'Dodge-Rng': 38,
  'Evade-ClsC': 39,
  'Duck-Exp': 40,
  'Nano Resist': 41,
  
  // Movement
  'Run Speed': 42,
  
  // Trade & Repair category
  'Mech. Engi': 43,
  'Mech Eng': 43,
  'Elec. Engi': 44,
  'Elec Eng': 44,
  'Quantum FT': 45,
  'Weapon Smt': 46,
  'Weapon Smith': 46,
  'Pharma Tech': 47,
  'Nano Progra': 48,
  'Nano Programming': 48,
  'Comp. Liter': 49,
  'Computer Literacy': 49,
  'Psychology': 50,
  'Chemistry': 51,
  'Tutoring': 52,
  'Matt. Metam': 53,
  'Mat Met': 54,
  'Bio Met': 55,
  'Bio Metamor': 55,
  
  // Nanos & Casting category
  'Psycho Modi': 56,
  'Psycho Modifications': 56,
  'Matt. Crea': 57,
  'Matter Crea': 57,
  'Matter Creation': 57,
  'Time&Space': 58,
  'Time & Space': 58,
  'Sensory Impr': 59,
  'Sensory Improvement': 59,
  
  // Combat & Healing category
  'First Aid': 60,
  'Treatment': 61,
  
  // Exploring category
  'Concealment': 62,
  'Break&Entry': 63,
  'Break & Entry': 63,
  'Trap Disarm.': 64,
  'Perception': 65,
  'Vehicle Air': 66,
  'Vehicle Ground': 67,
  'Vehicle Water': 68,
  'Map Navigation': 69
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
  'Ranged Weapons': ['Pistol', 'Ranged. Init.', 'Grenade', 'Heavy Weapons', 'Bow', 'Rifle', 'MG / SMG', 'Shotgun', 'Assault Rif', 'Multi Ranged'],
  'Ranged Specials': ['Fling Shot', 'Sharp Obj', 'Bow Spc Att', 'Burst', 'Full Auto', 'Aimed Shot'],
  'Melee Weapons': ['Piercing', 'Melee. Init.', 'Physic. Init', '1h Blunt', '1h Edged', 'Melee Ener.', '2h Edged', '2h Blunt', 'Martial Arts', 'Mult. Melee'],
  'Melee Specials': ['Riposte', 'Dimach', 'Sneak Atck', 'Fast Attack', 'Brawling'],
  'Nanos & Casting': ['Matter Crea', 'NanoC. Init.', 'Psycho Modi', 'Sensory Impr', 'Time&Space', 'Bio Metamor', 'Matt. Metam'],
  'Exploring': ['Vehicle Air', 'Vehicle Ground', 'Vehicle Water', 'Adventuring', 'Run Speed'],
  'Trade & Repair': ['Chemistry', 'Comp. Liter', 'Elec. Engi', 'Mech. Engi', 'Nano Progra', 'Pharma Tech', 'Quantum FT', 'Tutoring', 'Weapon Smt', 'Break&Entry'],
  'Combat & Healing': ['Concealment', 'Perception', 'Psychology', 'Treatment', 'First Aid', 'Trap Disarm.']
};
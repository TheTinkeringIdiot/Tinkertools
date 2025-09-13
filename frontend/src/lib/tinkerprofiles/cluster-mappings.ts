/**
 * AOSetups Cluster ID to STAT Number Mappings
 * 
 * Converts AOSetups-proprietary ClusterIDs to game-data STAT numbers
 * for use in TinkerProfile implant cluster data.
 */

import { SKILL_ID_MAP } from './skill-mappings';

/**
 * Raw cluster data from AOSetups Cluster.json
 * Format: [AltName, ClusterID, EffectTypeID, LongName, NPReq]
 */
const CLUSTER_DATA = [
  ["", 0, 1, "", 0],
  ["1h Blunt", 2, 1, "1 Handed Blunt Weapons", 720],
  ["1h Edged", 3, 1, "1 Handed Edged Weapon", 760],
  ["2h Blunt", 4, 1, "2 Handed Blunt Weapons", 720],
  ["2h Edged", 5, 1, "2 Handed Edged Weapons", 760],
  ["", 6, 1, "Adventuring", 600],
  ["", 7, 2, "Agility", 900],
  ["", 8, 1, "Aimed Shot", 840],
  ["", 9, 1, "Assault Rifle", 900],
  ["", 10, 16, "Biological Metamorphosis", 960],
  ["", 11, 1, "Body Development", 800],
  ["", 12, 1, "Bow", 800],
  ["", 13, 1, "Bow Special Attack", 800],
  ["Brawl", 14, 1, "Brawling", 660],
  ["", 15, 1, "Breaking and Entry", 800],
  ["", 16, 1, "Burst", 840],
  ["", 17, 3, "Chemical AC", 800],
  ["", 18, 1, "Chemistry", 800],
  ["", 19, 3, "Cold AC", 800],
  ["", 20, 1, "Computer Literacy", 800],
  ["", 21, 1, "Concealment", 720],
  ["", 22, 1, "Dimach", 900],
  ["Dodge Ranged", 24, 1, "Dodge Ranged Attacks", 800],
  ["", 25, 1, "Duck Explosives", 800],
  ["", 26, 1, "Electrical Engineering", 800],
  ["", 27, 3, "Energy AC", 900],
  ["Evade Close", 28, 1, "Evade Close Combat", 800],
  ["", 29, 1, "Fast Attack", 760],
  ["", 30, 3, "Fire AC", 800],
  ["", 31, 1, "First Aid", 720],
  ["", 32, 1, "Fling Shot", 720],
  ["", 33, 1, "Full Auto", 900],
  ["Grenade", 34, 1, "Grenade Throwing", 760],
  ["", 35, 1, "Heavy Weapons", 400],
  ["", 36, 3, "Projectile AC", 900],
  ["", 37, 2, "Intelligence", 900],
  ["", 38, 1, "Map Navigation", 500],
  ["", 39, 1, "Martial Arts", 1000],
  ["", 40, 16, "Matter Creation", 960],
  ["", 41, 16, "Matter Metamorphosis", 960],
  ["", 42, 4, "Max Health", 1000],
  ["", 43, 4, "Max Nano", 1000],
  ["", 44, 1, "Mechanical Engineering", 800],
  ["Melee Energy", 45, 1, "Melee Energy Weapons", 800],
  ["Melee Init", 46, 1, "Melee Weapons Initiative", 800],
  ["", 47, 3, "Melee AC", 900],
  ["SMG", 48, 1, "MG/SMG", 800],
  ["Multi Melee", 49, 1, "Multiple Melee Weapons", 900],
  ["Multi Ranged", 50, 1, "Multiple Ranged Weapons", 800],
  ["Nano Init", 51, 1, "Nano Initiative", 800],
  ["", 52, 1, "Nano Pool", 1200],
  ["", 53, 1, "Nano Programming", 800],
  ["Nano Resist", 54, 1, "Nano Resistance", 800],
  ["", 55, 1, "Parry", 840],
  ["", 56, 1, "Perception", 800],
  ["", 57, 1, "Pharmaceuticals", 800],
  ["Physical Init", 58, 1, "Physical Initiative", 800],
  ["", 59, 1, "Piercing", 640],
  ["", 60, 1, "Pistol", 800],
  ["", 61, 2, "Psychic", 900],
  ["", 62, 16, "Psychological Modifications", 960],
  ["", 63, 1, "Psychology", 800],
  ["", 64, 1, "Quantum Physics", 1000],
  ["", 65, 3, "Radiation AC", 800],
  ["", 66, 1, "Ranged Energy", 800],
  ["Ranged Init", 67, 1, "Ranged Initiative", 800],
  ["", 68, 1, "Rifle", 900],
  ["", 69, 1, "Riposte", 1000],
  ["", 70, 1, "Run Speed", 1000],
  ["", 71, 2, "Sense", 900],
  ["", 72, 16, "Sensory Improvement", 880],
  ["", 73, 1, "Sharp Objects", 500],
  ["", 74, 1, "Shotgun", 680],
  ["", 75, 1, "Sneak Attack", 1000],
  ["", 76, 2, "Stamina", 900],
  ["", 77, 2, "Strength", 900],
  ["", 78, 1, "Swimming", 500],
  ["", 79, 16, "Time and Space", 960],
  ["", 80, 1, "Trap Disarming", 720],
  ["", 81, 1, "Treatment", 860],
  ["", 82, 1, "Tutoring", 520],
  ["", 83, 1, "Vehicle Air", 400],
  ["", 84, 1, "Vehicle Ground", 600],
  ["", 85, 1, "Vehicle Water", 480],
  ["", 86, 1, "Weapon Smithing", 800],
  ["Nano Delta", 87, 15, "Nano Delta*", 1],
  ["Heal Delta", 88, 15, "Heal Delta*", 1],
  ["Defense modifier", 89, 8, "Add All Defense*", 1],
  ["Offense modifier", 90, 9, "Add All Offense*", 1],
  ["NCU Memory", 91, 10, "Add Max NCU*", 1],
  ["Experience Modifier", 92, 5, "Add XP (%)*", 1],
  ["Nano interrupt chance", 93, 12, "Nano Interrupt (%)*", 1],
  ["Chemical damage modifier", 94, 6, "Add Chemical Damage*", 1],
  ["Energy damage modifier", 95, 6, "Add Energy Damage*", 1],
  ["Fire damage modifier", 96, 6, "Add Fire Damage*", 1],
  ["Melee damage modifier", 97, 6, "Add Melee Damage*", 1],
  ["Poison damage modifier", 98, 6, "Add Poison Damage*", 1],
  ["Projectile damage modifier", 99, 6, "Add Projectile Damage*", 1],
  ["Radiation damage modifier", 100, 6, "Add Radiation Damage*", 1],
  ["Shield Chemical Damage", 101, 7, "Chemical Damage Shield*", 1],
  ["Shield Cold Damage", 102, 7, "Cold Damage Shield*", 1],
  ["Shield Energy Damage", 103, 7, "Energy Damage Shield*", 1],
  ["Shield Fire Damage", 104, 7, "Fire Damage Shield*", 1],
  ["Shield Melee Damage", 105, 7, "Melee Damage Shield*", 1],
  ["Shield Poison Damage", 106, 7, "Poison Damage Shield*", 1],
  ["Shield Projectile Damage", 107, 7, "Projectile Damage Shield*", 1],
  ["Shield Radiation Damage", 108, 7, "Radiation Damage Shield*", 1],
  ["Skill Lock Modifier", 109, 11, "Skill Lock (%)*", 1],
  ["Nano cost modifier", 110, 13, "Nano Cost (%)*", 1],
  ["Nano Range", 111, 14, "Add Nano Range (%)*", 1],
  ["", 112, 3, "Poison AC", 800],
  ["", 130, 14, "Add Weapon Range (%)*", 1]
];

/**
 * Mapping from skill names to their TinkerProfile skill names
 * Some cluster names don't exactly match SKILL_ID_MAP keys
 */
const CLUSTER_NAME_TO_SKILL_NAME: Record<string, string> = {
  // Direct mappings for skill clusters
  'Agility': 'Agility',
  'Intelligence': 'Intelligence',
  'Psychic': 'Psychic', 
  'Sense': 'Sense',
  'Stamina': 'Stamina',
  'Strength': 'Strength',
  
  // Weapon skills
  '1 Handed Blunt Weapons': '1h Blunt',
  '1 Handed Edged Weapon': '1h Edged',
  '2 Handed Blunt Weapons': '2h Blunt', 
  '2 Handed Edged Weapons': '2h Edged',
  'Melee Energy Weapons': 'Melee Energy',
  'Piercing': 'Piercing',
  'Martial Arts': 'Martial Arts',
  'Multiple Melee Weapons': 'Multi Melee',
  'Assault Rifle': 'Assault Rif',
  'Bow': 'Bow',
  'Bow Special Attack': 'Bow Spc Att',
  'MG/SMG': 'MG/SMG',
  'Pistol': 'Pistol', 
  'Ranged Energy': 'Ranged Energy',
  'Rifle': 'Rifle',
  'Shotgun': 'Shotgun',
  'Sharp Objects': 'Sharp Obj',
  'Grenade Throwing': 'Grenade',
  'Heavy Weapons': 'Heavy Weapons',
  'Multiple Ranged Weapons': 'Multi Ranged',
  
  // Combat skills
  'Aimed Shot': 'Aimed Shot',
  'Brawling': 'Brawling',
  'Burst': 'Burst',
  'Dimach': 'Dimach',
  'Fast Attack': 'Fast Attack',
  'Fling Shot': 'Fling Shot',
  'Full Auto': 'Full Auto',
  'Riposte': 'Riposte',
  'Sneak Attack': 'Sneak Attack',
  'Parry': 'Deflect', // Note: Parry maps to Deflect in skill-mappings
  
  // Initiative skills
  'Melee Weapons Initiative': 'Melee Init',
  'Nano Initiative': 'NanoC Init',
  'Physical Initiative': 'Physical Init',
  'Ranged Initiative': 'Ranged Init',
  
  // Defense skills
  'Body Development': 'Body Dev.',
  'Dodge Ranged Attacks': 'Dodge-Rng',
  'Duck Explosives': 'Duck-Exp', 
  'Evade Close Combat': 'Evade-ClsC',
  'Nano Resistance': 'Nano Resist',
  'Nano Pool': 'Nano Pool',
  
  // Nano & Casting skills
  'Biological Metamorphosis': 'Bio Metamor',
  'Matter Creation': 'Matter Creation',
  'Matter Metamorphosis': 'Matt Metam',
  'Psychological Modifications': 'Psycho Modi',
  'Sensory Improvement': 'Sensory Improvement',
  'Time and Space': 'Time & Space',
  
  // Trade & Repair skills  
  'Chemistry': 'Chemistry',
  'Computer Literacy': 'Computer Literacy',
  'Electrical Engineering': 'Elec Eng',
  'Mechanical Engineering': 'Mech Eng',
  'Nano Programming': 'Nano Programming',
  'Pharmaceuticals': 'Pharma Tech',
  'Quantum Physics': 'Quantum FT',
  'Tutoring': 'Tutoring',
  'Weapon Smithing': 'Weapon Smith',
  
  // Exploring skills
  'Adventuring': 'Adventuring',
  'Breaking and Entry': 'Break & Entry',
  'Concealment': 'Concealment',
  'Map Navigation': 'Map Navigation',
  'Perception': 'Perception',
  'Run Speed': 'Run Speed',
  'Swimming': 'Swimming',
  'Trap Disarming': 'Trap Disarm.',
  'Vehicle Air': 'Vehicle Air',
  'Vehicle Ground': 'Vehicle Ground', 
  'Vehicle Water': 'Vehicle Water',
  
  // Combat & Healing skills
  'First Aid': 'First Aid',
  'Psychology': 'Psychology',
  'Treatment': 'Treatment',
  
  // ACs (these don't have skill equivalents in TinkerProfiles)
  'Chemical AC': 'Chemical AC',
  'Cold AC': 'Cold AC', 
  'Energy AC': 'Energy AC',
  'Fire AC': 'Fire AC',
  'Melee AC': 'Melee AC',
  'Poison AC': 'Poison AC',
  'Projectile AC': 'Projectile AC',
  'Radiation AC': 'Radiation AC'
};

/**
 * Build the mapping from ClusterID to STAT number and skill name
 */
function buildClusterMapping() {
  const mapping: Record<number, { stat: number; skillName: string; longName: string }> = {};
  
  for (const [altName, clusterId, effectTypeId, longName] of CLUSTER_DATA) {
    const id = clusterId as number;
    const name = longName as string;
    
    // Skip empty entries
    if (id === 0 || !name || name.endsWith('*')) {
      continue;
    }
    
    // Map cluster name to skill name
    const skillName = CLUSTER_NAME_TO_SKILL_NAME[name];
    if (!skillName) {
      console.warn(`No skill mapping found for cluster: ${name}`);
      continue;
    }
    
    // Get STAT ID from skill name
    const statId = SKILL_ID_MAP[skillName];
    if (!statId) {
      console.warn(`No STAT ID found for skill: ${skillName}`);
      continue;
    }
    
    mapping[id] = {
      stat: statId,
      skillName: skillName,
      longName: name
    };
  }
  
  return mapping;
}

/**
 * ClusterID to STAT number mapping
 * Maps AOSetups ClusterID to game-data STAT numbers
 */
export const CLUSTER_ID_TO_STAT = buildClusterMapping();

/**
 * Get STAT number and skill name for a ClusterID
 */
export function getClusterMapping(clusterId: number): { stat: number; skillName: string; longName: string } | null {
  return CLUSTER_ID_TO_STAT[clusterId] || null;
}

/**
 * Check if a ClusterID is valid/supported
 */
export function isValidClusterId(clusterId: number): boolean {
  return clusterId in CLUSTER_ID_TO_STAT;
}

/**
 * AOSetups slot name to IMPLANT_SLOT bitflag mapping
 * Maps slot names directly to the bitflag values used in database stat 298
 */
export const AOSETUPS_SLOT_TO_BITFLAG: Record<string, number> = {
  'eye': 2,      // Eyes - 1 << 1
  'head': 4,     // Head - 1 << 2
  'ear': 8,      // Ears - 1 << 3
  'rarm': 16,    // RightArm - 1 << 4
  'chest': 32,   // Chest - 1 << 5
  'larm': 64,    // LeftArm - 1 << 6
  'rwrist': 128, // RightWrist - 1 << 7
  'waist': 256,  // Waist - 1 << 8
  'lwrist': 512, // LeftWrist - 1 << 9
  'rhand': 1024, // RightHand - 1 << 10
  'leg': 2048,   // Legs - 1 << 11
  'legs': 2048,  // Handle both 'leg' and 'legs' for AOSetups compatibility - 1 << 11
  'lhand': 4096, // LeftHand - 1 << 12
  'feet': 8192   // Feet - 1 << 13
};

/**
 * Convert AOSetups slot name to IMPLANT_SLOT bitflag value
 */
export function getSlotPosition(aoSetupsSlot: string): number | null {
  return AOSETUPS_SLOT_TO_BITFLAG[aoSetupsSlot.toLowerCase()] || null;
}
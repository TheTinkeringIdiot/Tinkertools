/**
 * Skill name to ID mapping utility
 * Maps display skill names to their numeric STAT IDs used in the game data
 */

import { STAT } from '@/services/game-data';

// Create reverse mapping from skill names to IDs
const createSkillNameToIdMap = (): Record<string, number> => {
  const nameToId: Record<string, number> = {};
  
  // Iterate through STAT enum to create mapping
  // Note: STAT enum has numbers as keys and names as values, e.g., 132: 'NanoPool'
  for (const [id, enumName] of Object.entries(STAT)) {
    const statId = parseInt(id);
    if (!isNaN(statId) && typeof enumName === 'string') {
      // Convert enum names to display names used in UI
      const displayNameMappings: Record<string, string> = {
        // Body & Defense skills
        'NanoPool': 'Nano Pool',
        'NanoResist': 'Nano Resist', 
        'BodyDevelopment': 'Body Dev.',
        'DodgeRanged': 'Dodge-Rng',
        'DuckExplosions': 'Duck-Exp', 
        'EvadeClose': 'Evade-ClsC',
        'Parry': 'Deflect', // This might need verification
        
        // Weapon skills  
        'MartialArts': 'Martial Arts',
        'MultiMelee': 'Multi Melee',
        '1hBlunt': '1h Blunt',
        '1hEdged': '1h Edged',
        'MeleeEnergy': 'Melee Ener',
        '2hEdged': '2h Edged',
        'Piercing': 'Piercing',
        '2hBlunt': '2h Blunt',
        'SharpObjects': 'Sharp Obj',
        'Grenade': 'Grenade',
        'HeavyWeapons': 'Heavy Weapons',
        'Bow': 'Bow',
        'Pistol': 'Pistol',
        'Rifle': 'Rifle',
        'MG_SMG': 'MG / SMG',
        'Shotgun': 'Shotgun', 
        'AssaultRifle': 'Assault Rif',
        'RangedEnergy': 'Ranged Ener',
        'MultiRanged': 'Multi Ranged',
        
        // Special attacks
        'MeleeInit': 'Melee. Init',
        'RangedInit': 'Ranged. Init', 
        'PhysicalInit': 'Physical. Init',
        'BowSpecialAttack': 'Bow Spc Att',
        'SensoryImprovement': 'Sensory Impr',
        'FirstAid': '1st Aid',
        'Treatment': 'Treatment',
        'MechanicalEngineering': 'Mech. Engi',
        'ElectricalEngineering': 'Elec. Engi',
        'MaterialMetamorphose': 'Matt.Metam',
        'BiologicalMetamorphose': 'Bio.Metamor',
        'PsychologicalModification': 'Psycho Modi',
        'MaterialCreation': 'Matt.Crea',
        'SpaceTime': 'Time & Space',
        'TrapDisarm': 'Trap Disarm',
        'Perception': 'Perception',
        'Adventuring': 'Adventuring',
        'Swimming': 'Swimming',
        'VehicleAir': 'Vehicle Air',
        'MapNavigation': 'Map Navigation',
        'Tutoring': 'Tutoring',
        'Brawl': 'Brawl',
        'Riposte': 'Riposte',
        'Dimach': 'Dimach',
        'SneakAttack': 'Sneak Att.',
        'FastAttack': 'Fast Attack',
        'Burst': 'Burst',
        'NanoInit': 'Nano Init',
        'FlingShot': 'Fling Shot',
        'AimedShot': 'Aimed Shot',
        'RunSpeed': 'Run Speed',
        'QuantumFT': 'Quantum FT',
        'WeaponSmithing': 'Weapon Smi',
        'Pharmaceuticals': 'Pharma Tech',
        'NanoProgramming': 'Nano Progra',
        'ComputerLiteracy': 'Comp. Liter',
        'Psychology': 'Psychology',
        'Chemistry': 'Chemistry',
        'Concealment': 'Concealment',
        'BreakingEntry': 'Break & Entry',
        'VehicleGround': 'Vehicle Ground',
        'FullAuto': 'Full Auto',
        
        // ACs  
        'ProjectileAC': 'Imp/Proj AC',
        'MeleeAC': 'Melee/Ma AC',
        'EnergyAC': 'Energy AC',
        'ChemicalAC': 'Chemical AC',
        'RadiationAC': 'Radiation AC',
        'ColdAC': 'Cold AC',
        'PoisonAC': 'Poison AC',
        'FireAC': 'Fire AC'
      };
      
      // Use mapped display name if available, otherwise use enum name as-is
      const displayName = displayNameMappings[enumName] || enumName;
      nameToId[displayName] = statId;
    }
  }
  
  return nameToId;
};

// Create the mapping
export const SKILL_NAME_TO_ID = createSkillNameToIdMap();

/**
 * Get skill ID from skill name
 */
export function getSkillIdFromName(skillName: string): number | null {
  return SKILL_NAME_TO_ID[skillName] || null;
}

/**
 * Get all available skill names
 */
export function getAllSkillNames(): string[] {
  return Object.keys(SKILL_NAME_TO_ID);
}
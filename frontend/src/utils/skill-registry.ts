/**
 * Skill Registry - Central mapping of skill names to STAT IDs
 * Maps skill display names used in the UI to their numeric STAT IDs from game-data.ts
 * This eliminates string matching issues and provides a single source of truth.
 */

import { STAT } from '@/services/game-data';

/**
 * Complete mapping of skill names to STAT IDs
 * Key: Skill name as displayed in UI (from constants.ts)
 * Value: STAT ID from game-data.ts
 */
export const SKILL_REGISTRY: Record<string, number> = {
  // Core Abilities (Attributes)
  'Strength': 16,
  'Agility': 17, 
  'Stamina': 18,
  'Intelligence': 19,
  'Sense': 20,
  'Psychic': 21,

  // Body & Defense
  'Nano Pool': 132,
  'Nano Resist': 168,
  'Body Dev.': 152,
  'Dodge-Rng': 154,
  'Duck-Exp': 153,
  'Evade-ClsC': 155,
  'Deflect': 145, // Parry in STAT enum

  // Ranged Weapons
  'Pistol': 112,
  'Ranged Init': 119, // RangedInit in STAT enum
  'Grenade': 109, // Grenade in STAT enum
  'Heavy Weapons': 110, // HeavyWeapons in STAT enum
  'Bow': 111,
  'Rifle': 113,
  'MG/SMG': 114, // MG_SMG in STAT enum
  'Shotgun': 115, // Shotgun in STAT enum
  'Assault Rif': 116, // AssaultRifle in STAT enum
  'Multi Ranged': 134, // MultiRanged in STAT enum

  // Ranged Specials  
  'Fling Shot': 150,
  'Sharp Obj': 108, // SharpObjects in STAT enum
  'Bow Spc Att': 121, // BowSpecialAttack in STAT enum
  'Burst': 148,
  'Full Auto': 167,
  'Aimed Shot': 151, // AimedShot in STAT enum

  // Melee Weapons
  'Piercing': 106,
  'Melee Init': 118, // MeleeInit in STAT enum
  'Physical Init': 120, // PhysicalInit in STAT enum
  '1h Blunt': 102,
  '1h Edged': 103,
  'Melee Energy': 104, // MeleeEnergy in STAT enum
  '2h Edged': 105,
  '2h Blunt': 107,
  'Martial Arts': 100,
  'Multi Melee': 101, // MultiMelee in STAT enum

  // Melee Specials
  'Riposte': 143,
  'Dimach': 144,
  'Sneak Attack': 146, // SneakAttack in STAT enum
  'Fast Attack': 147, // FastAttack in STAT enum
  'Brawling': 142, // Brawl in STAT enum

  // Nanos & Casting
  'Matter Creation': 130, // MaterialCreation in STAT enum
  'NanoC Init': 149, // NanoInit in STAT enum
  'Psycho Modi': 129, // PsychologicalModification in STAT enum
  'Sensory Improvement': 122, // SensoryImprovement in STAT enum
  'Time & Space': 131, // SpaceTime in STAT enum
  'Bio Metamor': 128, // BiologicalMetamorphose in STAT enum
  'Matt Metam': 127, // MaterialMetamorphose in STAT enum

  // Exploring
  'Vehicle Air': 139, // VehicleAir in STAT enum
  'Vehicle Ground': 166, // VehicleGround in STAT enum
  'Vehicle Water': 117, // VehicleWater in STAT enum
  'Adventuring': 137, // Adventuring in STAT enum
  'Run Speed': 156, // RunSpeed in STAT enum

  // Trade & Repair
  'Chemistry': 163,
  'Computer Literacy': 161, // ComputerLiteracy in STAT enum
  'Elec Eng': 126, // ElectricalEngineering in STAT enum
  'Mech Eng': 125, // MechanicalEngineering in STAT enum
  'Nano Programming': 160, // NanoProgramming in STAT enum
  'Pharma Tech': 159, // Pharmaceuticals in STAT enum
  'Quantum FT': 157, // QuantumFT in STAT enum
  'Tutoring': 141,
  'Weapon Smith': 158, // WeaponSmithing in STAT enum
  'Break & Entry': 165, // BreakingEntry in STAT enum

  // Combat & Healing
  'Concealment': 164,
  'Perception': 136, // Perception in STAT enum
  'Psychology': 162,
  'Treatment': 124,
  'First Aid': 123, // FirstAid in STAT enum
  'Trap Disarm.': 135, // TrapDisarm in STAT enum

  // Regular ACs (Armor Class)
  'Imp/Proj AC': 90, // ProjectileAC in STAT enum
  'Melee/ma AC': 91, // MeleeAC in STAT enum
  'Energy AC': 92, // EnergyAC in STAT enum
  'Chemical AC': 93, // ChemicalAC in STAT enum
  'Radiation AC': 94, // RadiationAC in STAT enum
  'Cold AC': 95, // ColdAC in STAT enum
  'Disease AC': 96, // PoisonAC in STAT enum
  'Fire AC': 97, // FireAC in STAT enum

  // Shield ACs
  'Shield Projectile AC': 226, // ShieldProjectileAC in STAT enum
  'Shield Melee AC': 227, // ShieldMeleeAC in STAT enum
  'Shield Energy AC': 228, // ShieldEnergyAC in STAT enum
  'Shield Chemical AC': 229, // ShieldChemicalAC in STAT enum
  'Shield Radiation AC': 230, // ShieldRadiationAC in STAT enum
  'Shield Cold AC': 231, // ShieldColdAC in STAT enum
  'Shield Nano AC': 232, // ShieldNanoAC in STAT enum
  'Shield Fire AC': 233, // ShieldFireAC in STAT enum
  'Shield Poison AC': 234, // ShieldPoisonAC in STAT enum

  // Reflect ACs
  'Reflect Projectile AC': 205, // ReflectProjectileAC in STAT enum
  'Reflect Melee AC': 206, // ReflectMeleeAC in STAT enum
  'Reflect Energy AC': 207, // ReflectEnergyAC in STAT enum
  'Reflect Chemical AC': 208, // ReflectChemicalAC in STAT enum
  'Reflect Radiation AC': 216, // ReflectRadiationAC in STAT enum
  'Reflect Cold AC': 217, // ReflectColdAC in STAT enum
  'Reflect Nano AC': 218, // ReflectNanoAC in STAT enum
  'Reflect Fire AC': 219, // ReflectFireAC in STAT enum
  'Reflect Poison AC': 225, // ReflectPoisonAC in STAT enum

  // Misc Stats
  'Max Health': 1, // MaxHealth in STAT enum
  'Max NCU': 181, // MaxNCU in STAT enum
  'Ranged Energy': 133, // RangedEnergy in STAT enum
  'Add All Offense': 276, // AddAllOffense in STAT enum
  'Add All Defense': 277, // AddAllDefense in STAT enum

  // Damage Modifiers
  'Projectile Damage Modifier': 278, // ProjectileDamageModifier in STAT enum
  'Melee Damage Modifier': 279, // MeleeDamageModifier in STAT enum
  'Energy Damage Modifier': 280, // EnergyDamageModifier in STAT enum
  'Chemical Damage Modifier': 281, // ChemicalDamageModifier in STAT enum
  'Radiation Damage Modifier': 282, // RadiationDamageModifier in STAT enum
  'Cold Damage Modifier': 311, // ColdDamageModifier in STAT enum
  'Fire Damage Modifier': 316, // FireDamageModifier in STAT enum
  'Poison Damage Modifier': 317 // PoisonDamageModifier in STAT enum
};

/**
 * Get STAT ID for a skill name
 */
export function getSkillStatId(skillName: string): number | null {
  return SKILL_REGISTRY[skillName] || null;
}

/**
 * Get skill name from STAT ID (reverse lookup)
 */
export function getSkillNameFromStatId(statId: number): string | null {
  for (const [skillName, id] of Object.entries(SKILL_REGISTRY)) {
    if (id === statId) {
      return skillName;
    }
  }
  return null;
}

/**
 * Validate that all skills in the registry have valid STAT IDs
 */
export function validateSkillRegistry(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const [skillName, statId] of Object.entries(SKILL_REGISTRY)) {
    if (!STAT[statId]) {
      errors.push(`Skill "${skillName}" has invalid STAT ID: ${statId}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get all available skill names
 */
export function getAllSkillNames(): string[] {
  return Object.keys(SKILL_REGISTRY);
}
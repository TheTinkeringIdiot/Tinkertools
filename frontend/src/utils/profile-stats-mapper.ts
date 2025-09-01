/**
 * Profile Stats Mapper
 * 
 * Converts TinkerProfile structure to a flat stat ID → value map
 * for requirements checking against items and actions
 */

import type { TinkerProfile } from '@/types/api'
import { PROFESSION, BREED } from '@/services/game-data'

/**
 * Maps a TinkerProfile to a flat record of stat ID → value
 * Used for checking requirements against profile skills and attributes
 */
export function mapProfileToStats(profile: TinkerProfile): Record<number, number> {
  const stats: Record<number, number> = {}
  
  // ============================================================================
  // Character Properties
  // ============================================================================
  
  // Level (stat ID 54)
  stats[54] = profile.Character.Level || 1
  
  // Breed (stat ID 4) - map breed name to ID
  if (profile.Character.Breed) {
    for (const [id, name] of Object.entries(BREED)) {
      if (name === profile.Character.Breed) {
        stats[4] = parseInt(id)
        break
      }
    }
  }
  
  // Profession (stat ID 60) - map profession name to ID  
  if (profile.Character.Profession) {
    for (const [id, name] of Object.entries(PROFESSION)) {
      if (name === profile.Character.Profession) {
        stats[60] = parseInt(id)
        break
      }
    }
  }
  
  // MaxHealth and MaxNano (now in Character)
  stats[1] = profile.Character.MaxHealth || 1  // MaxHealth
  stats[214] = profile.Character.MaxNano || 1  // MaxNano
  
  // ============================================================================
  // Attributes (stat IDs 16-21)
  // ============================================================================
  
  if (profile.Skills.Attributes) {
    stats[16] = profile.Skills.Attributes.Strength?.value || 10
    stats[17] = profile.Skills.Attributes.Agility?.value || 10
    stats[18] = profile.Skills.Attributes.Stamina?.value || 10
    stats[19] = profile.Skills.Attributes.Intelligence?.value || 10
    stats[20] = profile.Skills.Attributes.Sense?.value || 10
    stats[21] = profile.Skills.Attributes.Psychic?.value || 10
  }
  
  // ============================================================================
  // Combat Skills - Melee Weapons
  // ============================================================================
  
  // Map melee weapon skills from profile skill names to stat IDs
  const meleeSkills = profile.Skills['Melee Weapons'] || {}
  stats[102] = meleeSkills['1h Blunt']?.value || 1  // 1hBlunt
  stats[103] = meleeSkills['1h Edged']?.value || 1  // 1hEdged  
  stats[105] = meleeSkills['2h Edged']?.value || 1  // 2hEdged
  stats[107] = meleeSkills['2h Blunt']?.value || 1  // 2hBlunt
  stats[106] = meleeSkills['Piercing']?.value || 1  // Piercing
  stats[104] = meleeSkills['Melee Ener.']?.value || 1  // MeleeEnergy
  stats[100] = meleeSkills['Martial Arts']?.value || 1  // MartialArts
  stats[101] = meleeSkills['Mult. Melee']?.value || 1  // MultiMelee
  
  // ============================================================================
  // Combat Skills - Ranged Weapons  
  // ============================================================================
  
  const rangedSkills = profile.Skills['Ranged Weapons'] || {}
  stats[108] = rangedSkills['Sharp Obj']?.value || 1  // SharpObjects
  stats[109] = rangedSkills['Bow']?.value || 1  // Bow
  stats[112] = rangedSkills['Pistol']?.value || 1  // Pistol
  stats[113] = rangedSkills['Assault Rif']?.value || 1  // AssaultRif
  stats[115] = rangedSkills['MG / SMG']?.value || 1  // MG_SMG
  stats[116] = rangedSkills['Shotgun']?.value || 1  // Shotgun
  stats[117] = rangedSkills['Rifle']?.value || 1  // Rifle
  stats[133] = rangedSkills['Ranged Ener']?.value || 1  // RangedEnergy
  stats[118] = rangedSkills['Grenade']?.value || 1  // Grenade
  stats[119] = rangedSkills['Heavy Weapons']?.value || 1  // HeavyWeapons
  stats[229] = rangedSkills['Multi Ranged']?.value || 1  // MultiRanged
  
  // ============================================================================
  // Initiative Skills
  // ============================================================================
  
  stats[111] = rangedSkills['Ranged. Init.']?.value || 1  // RangedInit
  stats[120] = meleeSkills['Melee. Init.']?.value || 1  // MeleeInit
  stats[121] = meleeSkills['Physic. Init']?.value || 1  // PhysicalInit
  stats[122] = profile.Skills['Nanos & Casting']?.['NanoC. Init.']?.value || 1  // NanoCInit
  
  // ============================================================================
  // Special Attack Skills
  // ============================================================================
  
  const rangedSpecials = profile.Skills['Ranged Specials'] || {}
  const meleeSpecials = profile.Skills['Melee Specials'] || {}
  
  stats[134] = rangedSpecials['Fling Shot']?.value || 1  // FlingShot
  stats[148] = rangedSpecials['Aimed Shot']?.value || 1  // AimedShot
  stats[150] = rangedSpecials['Bow Spc Att']?.value || 1  // BowSpecialAttack
  stats[140] = rangedSpecials['Burst']?.value || 1  // Burst
  stats[167] = rangedSpecials['Full Auto']?.value || 1  // FullAuto
  
  stats[142] = meleeSpecials['Fast Attack']?.value || 1  // FastAttack
  stats[144] = meleeSpecials['Sneak Atck']?.value || 1  // SneakAttack
  stats[146] = meleeSpecials['Riposte']?.value || 1  // Riposte
  stats[154] = meleeSpecials['Dimach']?.value || 1  // Dimach
  stats[151] = meleeSpecials['Brawling']?.value || 1  // Brawling
  
  // ============================================================================
  // Nano & Casting Skills
  // ============================================================================
  
  const nanoSkills = profile.Skills['Nanos & Casting'] || {}
  stats[130] = nanoSkills['Matter Crea']?.value || 1  // MaterialCreation
  stats[131] = nanoSkills['Bio Metamor']?.value || 1  // BiologicalMetamorphosis  
  stats[132] = nanoSkills['Matt. Metam']?.value || 1  // MatterMetamorphosis
  stats[123] = nanoSkills['Psycho Modi']?.value || 1  // PsychologicalModifications
  stats[124] = nanoSkills['Sensory Impr']?.value || 1  // SensoryImprovement
  stats[125] = nanoSkills['Time&Space']?.value || 1  // TimeAndSpace
  
  // ============================================================================
  // Trade & Repair Skills
  // ============================================================================
  
  const tradeSkills = profile.Skills['Trade & Repair'] || {}
  stats[125] = tradeSkills['Mech. Engi']?.value || 1  // MechanicalEngineering
  stats[126] = tradeSkills['Elec. Engi']?.value || 1  // ElectricalEngineering
  stats[157] = tradeSkills['Quantum FT']?.value || 1  // QuantumFT
  stats[159] = tradeSkills['Weapon Smt']?.value || 1  // WeaponSmithing
  stats[160] = tradeSkills['Pharma Tech']?.value || 1  // PharmaTech
  stats[161] = tradeSkills['Comp. Liter']?.value || 1  // ComputerLiteracy
  stats[162] = tradeSkills['Chemistry']?.value || 1  // Chemistry
  stats[163] = tradeSkills['Nano Progra']?.value || 1  // NanoProgramming
  stats[141] = tradeSkills['Tutoring']?.value || 1  // Tutoring
  stats[135] = tradeSkills['Break&Entry']?.value || 1  // BreakAndEntry
  
  // ============================================================================
  // Combat & Healing Skills
  // ============================================================================
  
  const combatSkills = profile.Skills['Combat & Healing'] || {}
  stats[123] = combatSkills['First Aid']?.value || 1  // FirstAid
  stats[124] = combatSkills['Treatment']?.value || 1  // Treatment
  stats[129] = combatSkills['Psychology']?.value || 1  // Psychology
  stats[153] = combatSkills['Concealment']?.value || 1  // Concealment
  stats[156] = combatSkills['Perception']?.value || 1  // Perception
  stats[135] = combatSkills['Trap Disarm.']?.value || 1  // TrapDisarm
  
  // ============================================================================
  // Body & Defense Skills
  // ============================================================================
  
  const bodySkills = profile.Skills['Body & Defense'] || {}
  stats[152] = bodySkills['Body Dev.']?.value || 1  // BodyDevelopment
  stats[164] = bodySkills['Nano Pool']?.value || 1  // NanoPool
  stats[168] = bodySkills['Nano Resist']?.value || 1  // NanoResist
  stats[155] = bodySkills['Dodge-Rng']?.value || 1  // DodgeRanged
  stats[156] = bodySkills['Evade-ClsC']?.value || 1  // EvadeCloseC
  stats[165] = bodySkills['Duck-Exp']?.value || 1  // DuckExp
  stats[166] = bodySkills['Deflect']?.value || 1  // Deflect
  
  // ============================================================================
  // AC Skills
  // ============================================================================
  
  const acSkills = profile.Skills.ACs || {}
  stats[90] = acSkills['Imp/Proj AC'] || 1  // ProjectileAC
  stats[91] = acSkills['Melee/ma AC'] || 1  // MeleeAC
  stats[92] = acSkills['Energy AC'] || 1  // EnergyAC
  stats[93] = acSkills['Chemical AC'] || 1  // ChemicalAC
  stats[94] = acSkills['Radiation AC'] || 1  // RadiationAC
  stats[95] = acSkills['Cold AC'] || 1  // ColdAC
  stats[96] = acSkills['Poison AC'] || 1  // PoisonAC
  stats[97] = acSkills['Fire AC'] || 1  // FireAC
  stats[98] = acSkills['Disease AC'] || 1  // DiseaseAC
  
  // ============================================================================
  // Exploring Skills
  // ============================================================================
  
  const exploringSkills = profile.Skills.Exploring || {}
  stats[138] = exploringSkills['Adventuring']?.value || 1  // Adventuring
  stats[139] = exploringSkills['Swimming']?.value || 1  // Swimming
  stats[166] = exploringSkills['Run Speed']?.value || 1  // RunSpeed
  stats[139] = exploringSkills['Vehicle Air']?.value || 1  // VehicleAir
  stats[166] = exploringSkills['Vehicle Ground']?.value || 1  // VehicleGround
  stats[167] = exploringSkills['Vehicle Water']?.value || 1  // VehicleWater
  
  // ============================================================================
  // Misc Skills (these are raw numbers, not SkillWithIP)
  // ============================================================================
  
  const miscSkills = profile.Skills.Misc || {}
  // Just copy the values directly since Misc uses raw numbers
  Object.entries(miscSkills).forEach(([skillName, value]) => {
    // Map misc skill names to stat IDs if needed
    // For now, we'll handle the common ones
    if (skillName === 'Max NCU' && typeof value === 'number') {
      stats[181] = value  // MaxNCU
    }
    // Add more misc mappings as needed
  })
  
  return stats
}

/**
 * Helper function to get a specific stat value from a profile
 */
export function getProfileStat(profile: TinkerProfile, statId: number): number {
  const stats = mapProfileToStats(profile)
  return stats[statId] || 0
}

/**
 * Helper function to check if a profile meets a specific requirement
 */
export function profileMeetsRequirement(
  profile: TinkerProfile, 
  statId: number, 
  operator: number, 
  requiredValue: number
): boolean {
  const currentValue = getProfileStat(profile, statId)
  
  // Map operators based on game-data.ts STAT_OPERATOR
  switch (operator) {
    case 0: // Equal
      return currentValue === requiredValue
    case 1: // LessThan
      return currentValue < requiredValue
    case 2: // GreaterThan (most common for requirements)
      return currentValue >= requiredValue
    case 24: // NotEqual
      return currentValue !== requiredValue
    default:
      console.warn(`Unknown requirement operator: ${operator}`)
      return false
  }
}
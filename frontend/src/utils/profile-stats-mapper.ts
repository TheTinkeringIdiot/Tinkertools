/**
 * Profile Stats Mapper
 *
 * Converts TinkerProfile structure to a flat stat ID → value map
 * for requirements checking against items and actions
 */

import type { TinkerProfile } from '@/types/api'
import { PROFESSION, BREED } from '@/services/game-data'
import { findSkillByPattern } from './skill-patterns'

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

  // Map melee weapon skills using pattern matching for flexibility
  const meleeSkills = profile.Skills['Melee Weapons'] || {}
  stats[102] = findSkillByPattern(meleeSkills, 102) || 1  // 1hBlunt
  stats[103] = findSkillByPattern(meleeSkills, 103) || 1  // 1hEdged
  stats[105] = findSkillByPattern(meleeSkills, 105) || 1  // 2hEdged
  stats[107] = findSkillByPattern(meleeSkills, 107) || 1  // 2hBlunt
  stats[106] = findSkillByPattern(meleeSkills, 106) || 1  // Piercing
  stats[104] = findSkillByPattern(meleeSkills, 104) || 1  // MeleeEnergy
  stats[100] = findSkillByPattern(meleeSkills, 100) || 1  // MartialArts
  stats[101] = findSkillByPattern(meleeSkills, 101) || 1  // MultiMelee
  
  // ============================================================================
  // Combat Skills - Ranged Weapons  
  // ============================================================================
  
  const rangedSkills = profile.Skills['Ranged Weapons'] || {}
  stats[108] = findSkillByPattern(rangedSkills, 108) || 1  // SharpObjects
  stats[109] = findSkillByPattern(rangedSkills, 109) || 1  // Bow
  stats[112] = findSkillByPattern(rangedSkills, 112) || 1  // Pistol
  stats[113] = findSkillByPattern(rangedSkills, 113) || 1  // AssaultRif
  stats[115] = findSkillByPattern(rangedSkills, 115) || 1  // MG_SMG
  stats[116] = findSkillByPattern(rangedSkills, 116) || 1  // Shotgun
  stats[117] = findSkillByPattern(rangedSkills, 117) || 1  // Rifle
  stats[133] = findSkillByPattern(rangedSkills, 133) || 1  // RangedEnergy
  stats[118] = findSkillByPattern(rangedSkills, 118) || 1  // Grenade
  stats[119] = findSkillByPattern(rangedSkills, 119) || 1  // HeavyWeapons
  stats[229] = findSkillByPattern(rangedSkills, 229) || 1  // MultiRanged
  
  // ============================================================================
  // Initiative Skills
  // ============================================================================
  
  stats[111] = findSkillByPattern(rangedSkills, 111) || 1  // RangedInit
  stats[120] = findSkillByPattern(meleeSkills, 120) || 1  // MeleeInit
  stats[121] = findSkillByPattern(meleeSkills, 121) || 1  // PhysicalInit
  stats[122] = findSkillByPattern(profile.Skills['Nanos & Casting'] || {}, 122) || 1  // NanoCInit
  
  // ============================================================================
  // Special Attack Skills
  // ============================================================================
  
  const rangedSpecials = profile.Skills['Ranged Specials'] || {}
  const meleeSpecials = profile.Skills['Melee Specials'] || {}

  stats[134] = findSkillByPattern(rangedSpecials, 134) || 1  // FlingShot
  stats[148] = findSkillByPattern(rangedSpecials, 148) || 1  // AimedShot
  stats[150] = findSkillByPattern(rangedSpecials, 150) || 1  // BowSpecialAttack
  stats[140] = findSkillByPattern(rangedSpecials, 140) || 1  // Burst
  stats[167] = findSkillByPattern(rangedSpecials, 167) || 1  // FullAuto

  stats[142] = findSkillByPattern(meleeSpecials, 142) || 1  // FastAttack
  stats[144] = findSkillByPattern(meleeSpecials, 144) || 1  // SneakAttack
  stats[146] = findSkillByPattern(meleeSpecials, 146) || 1  // Riposte
  stats[154] = findSkillByPattern(meleeSpecials, 154) || 1  // Dimach
  stats[151] = findSkillByPattern(meleeSpecials, 151) || 1  // Brawling
  
  // ============================================================================
  // Nano & Casting Skills
  // ============================================================================
  
  const nanoSkills = profile.Skills['Nanos & Casting'] || {}
  stats[130] = findSkillByPattern(nanoSkills, 130) || 1  // MaterialCreation
  stats[131] = findSkillByPattern(nanoSkills, 131) || 1  // BiologicalMetamorphosis
  stats[132] = findSkillByPattern(nanoSkills, 132) || 1  // MatterMetamorphosis
  stats[123] = findSkillByPattern(nanoSkills, 123) || 1  // PsychologicalModifications
  stats[124] = findSkillByPattern(nanoSkills, 124) || 1  // SensoryImprovement
  stats[125] = findSkillByPattern(nanoSkills, 125) || 1  // TimeAndSpace
  
  // ============================================================================
  // Trade & Repair Skills
  // ============================================================================
  
  const tradeSkills = profile.Skills['Trade & Repair'] || {}
  stats[125] = findSkillByPattern(tradeSkills, 125) || 1  // MechanicalEngineering
  stats[126] = findSkillByPattern(tradeSkills, 126) || 1  // ElectricalEngineering
  stats[157] = findSkillByPattern(tradeSkills, 157) || 1  // QuantumFT
  stats[159] = findSkillByPattern(tradeSkills, 159) || 1  // WeaponSmithing
  stats[160] = findSkillByPattern(tradeSkills, 160) || 1  // PharmaTech
  stats[161] = findSkillByPattern(tradeSkills, 161) || 1  // ComputerLiteracy
  stats[162] = findSkillByPattern(tradeSkills, 162) || 1  // Chemistry
  stats[163] = findSkillByPattern(tradeSkills, 163) || 1  // NanoProgramming
  stats[141] = findSkillByPattern(tradeSkills, 141) || 1  // Tutoring
  stats[135] = findSkillByPattern(tradeSkills, 135) || 1  // BreakAndEntry
  
  // ============================================================================
  // Combat & Healing Skills
  // ============================================================================
  
  const combatSkills = profile.Skills['Combat & Healing'] || {}
  stats[123] = findSkillByPattern(combatSkills, 123) || 1  // FirstAid
  stats[124] = findSkillByPattern(combatSkills, 124) || 1  // Treatment
  stats[129] = findSkillByPattern(combatSkills, 129) || 1  // Psychology
  stats[153] = findSkillByPattern(combatSkills, 153) || 1  // Concealment
  stats[156] = findSkillByPattern(combatSkills, 156) || 1  // Perception
  stats[135] = findSkillByPattern(combatSkills, 135) || 1  // TrapDisarm
  
  // ============================================================================
  // Body & Defense Skills
  // ============================================================================
  
  const bodySkills = profile.Skills['Body & Defense'] || {}
  stats[152] = findSkillByPattern(bodySkills, 152) || 1  // BodyDevelopment
  stats[164] = findSkillByPattern(bodySkills, 164) || 1  // NanoPool
  stats[168] = findSkillByPattern(bodySkills, 168) || 1  // NanoResist
  stats[155] = findSkillByPattern(bodySkills, 155) || 1  // DodgeRanged
  stats[156] = findSkillByPattern(bodySkills, 156) || 1  // EvadeCloseC
  stats[165] = findSkillByPattern(bodySkills, 165) || 1  // DuckExp
  stats[166] = findSkillByPattern(bodySkills, 166) || 1  // Deflect
  
  // ============================================================================
  // AC Skills
  // ============================================================================

  const acSkills = profile.Skills.ACs || {}
  stats[90] = findSkillByPattern(acSkills, 90) || 1  // ProjectileAC
  stats[91] = findSkillByPattern(acSkills, 91) || 1  // MeleeAC
  stats[92] = findSkillByPattern(acSkills, 92) || 1  // EnergyAC
  stats[93] = findSkillByPattern(acSkills, 93) || 1  // ChemicalAC
  stats[94] = findSkillByPattern(acSkills, 94) || 1  // RadiationAC
  stats[95] = findSkillByPattern(acSkills, 95) || 1  // ColdAC
  stats[96] = findSkillByPattern(acSkills, 96) || 1  // PoisonAC
  stats[97] = findSkillByPattern(acSkills, 97) || 1  // FireAC
  stats[98] = findSkillByPattern(acSkills, 98) || 1  // DiseaseAC
  
  // ============================================================================
  // Exploring Skills
  // ============================================================================
  
  const exploringSkills = profile.Skills.Exploring || {}
  stats[138] = findSkillByPattern(exploringSkills, 138) || 1  // Adventuring
  stats[139] = findSkillByPattern(exploringSkills, 139) || 1  // Swimming
  stats[166] = findSkillByPattern(exploringSkills, 166) || 1  // RunSpeed
  // Note: Vehicle skills might have overlapping stat IDs - needs verification
  stats[139] = findSkillByPattern(exploringSkills, 139) || 1  // VehicleAir
  stats[166] = findSkillByPattern(exploringSkills, 166) || 1  // VehicleGround
  stats[167] = findSkillByPattern(exploringSkills, 167) || 1  // VehicleWater
  
  // ============================================================================
  // Misc Skills (these are raw numbers, not SkillWithIP)
  // ============================================================================
  
  const miscSkills = profile.Skills.Misc || {}
  // Just copy the values directly since Misc uses raw numbers
  Object.entries(miscSkills).forEach(([skillName, value]) => {
    // Map misc skill names to stat IDs
    if (typeof value === 'number') {
      switch(skillName) {
        case 'Max NCU':
          stats[181] = value;  // MaxNCU
          break;
        case 'Add All Off.':
          stats[276] = value;  // AddAllOffense
          break;
        case 'Add All Def.':
          stats[277] = value;  // AddAllDefense
          break;
        case 'Add. Proj. Dam.':
          stats[278] = value;  // ProjectileDamageModifier
          break;
        case 'Add. Melee Dam.':
          stats[279] = value;  // MeleeDamageModifier
          break;
        case 'Add. Energy Dam.':
          stats[280] = value;  // EnergyDamageModifier
          break;
        case 'Add. Chem. Dam.':
          stats[281] = value;  // ChemicalDamageModifier
          break;
        case 'Add. Rad. Dam.':
          stats[282] = value;  // RadiationDamageModifier
          break;
        case 'Add. Cold Dam.':
          stats[311] = value;  // ColdDamageModifier
          break;
        case 'Add. Fire Dam.':
          stats[316] = value;  // FireDamageModifier
          break;
        case 'Add. Poison Dam.':
          stats[317] = value;  // PoisonDamageModifier
          break;
        case 'Add. Nano Dam.':
          stats[315] = value;  // NanoDamageModifier
          break;
        case '% Add. Xp':
          stats[319] = value;  // XPModifier
          break;
        case '% Add. Nano Cost':
          stats[318] = value;  // NanoCost
          break;
        case 'HealDelta':
          stats[343] = value;  // HealDelta
          break;
        case 'NanoDelta':
          stats[364] = value;  // NanoDelta
          break;
        case 'RangeInc. NF':
          stats[381] = value;  // NanoRange
          break;
        case 'RangeInc. Weapon':
          stats[287] = value;  // AttackRange
          break;
        case 'CriticalIncrease':
          stats[379] = value;  // CriticalIncrease
          break;
        // Add more mappings as needed
      }
    }
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
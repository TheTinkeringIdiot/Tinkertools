/**
 * TinkerTools Implant Planning Utility
 * 
 * Functions for implant construction calculations, QL bumping,
 * skill requirements, and cluster analysis.
 * 
 * Converted from TinkerPlants utils.py
 */

import {
  NP_MODS,
  JOBE_SKILL,
  JOBE_MODS,
  IMP_SKILLS,
  IMP_SLOTS,
  CLUSTER_MIN_QL,
  type NPModKey,
  type JobeSkillKey,
  type ClusterType,
  type ImpSlotName
} from '../services/game-data';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ImplantSlotData {
  shiny: string;
  bright: string;
  faded: string;
  ql: number;
  attrib_name: string;
  attrib_value: number;
  treatment_value: number;
  tl: number;
  np_req: number;
  shiny_benefit: number;
  bright_benefit: number;
  faded_benefit: number;
  jobe_reqs: Record<string, number>;
}

export interface ImplantsData {
  [slotName: string]: ImplantSlotData;
}

export interface AttributePreferences {
  Agility: boolean;
  Intelligence: boolean;
  Psychic: boolean;
  Sense: boolean;
  Stamina: boolean;
  Strength: boolean;
}

export interface CombineSkills {
  [skillName: string]: number;
}

export interface QLBumpResult {
  success: boolean;
  bumps: number;
}

export interface ClusterQualityResult {
  message: string | string[];
  finalQL: number;
  success: boolean;
}

// ============================================================================
// Initialization Functions
// ============================================================================

/**
 * Create initial empty implant data structure
 */
export function initialImplants(): ImplantsData {
  const implants: ImplantsData = {};
  
  for (const slot of IMP_SLOTS) {
    implants[slot] = {
      shiny: 'Empty',
      bright: 'Empty',
      faded: 'Empty',
      ql: 1,
      attrib_name: '',
      attrib_value: 1,
      treatment_value: 1,
      tl: 1,
      np_req: 1,
      shiny_benefit: 0,
      bright_benefit: 0,
      faded_benefit: 0,
      jobe_reqs: {}
    };
  }
  
  return implants;
}

/**
 * Create initial attribute preferences
 */
export function initialPreferences(): AttributePreferences {
  return {
    Agility: false,
    Intelligence: false,
    Psychic: false,
    Sense: false,
    Stamina: false,
    Strength: false
  };
}

// ============================================================================
// Cluster Selection and Analysis
// ============================================================================

/**
 * Pick the optimal faded cluster for a slot based on NP modifiers
 */
export function pickFadedCluster(slot: ImpSlotName): string {
  const skills = [...IMP_SKILLS[slot]['Faded']].filter(skill => skill !== 'Empty');
  
  let chosen = '';
  let chosenVal = 0.0;
  
  for (const skill of skills) {
    try {
      const npMod = NP_MODS[skill as NPModKey];
      if (npMod && npMod > chosenVal) {
        chosen = skill;
        chosenVal = npMod;
      }
    } catch {
      // JOBE clusters can't be cleaned, so don't select them
    }
  }
  
  return chosen;
}

// ============================================================================
// Nano Programming Calculations
// ============================================================================

/**
 * Calculate nano programming requirement for regular cluster
 */
export function rkClusterNP(skill: string, slot: ClusterType, ql: number): number {
  let slotMod = 1.0;
  
  switch (slot) {
    case 'Shiny':
      slotMod = 2.0;
      break;
    case 'Bright':
      slotMod = 1.5;
      break;
    case 'Faded':
      slotMod = 1.0;
      break;
  }
  
  const npMod = NP_MODS[skill as NPModKey];
  if (!npMod) {
    throw new Error(`Unknown skill: ${skill}`);
  }
  
  return Math.round(npMod * ql * slotMod);
}

/**
 * Calculate skill requirement for Jobe cluster
 */
export function jobeClusterSkill(skill: string, slot: ClusterType, ql: number): number {
  let slotMod = 1.0;
  
  if (skill !== 'Nano Delta') {
    switch (slot) {
      case 'Shiny':
        slotMod = 6.25;
        break;
      case 'Bright':
        slotMod = 4.75;
        break;
      case 'Faded':
        slotMod = 3.25;
        break;
    }
  } else {
    switch (slot) {
      case 'Shiny':
        slotMod = 5.25;
        break;
      case 'Bright':
        slotMod = 4.0;
        break;
      case 'Faded':
        slotMod = 2.75;
        break;
    }
  }
  
  return Math.round(ql * slotMod);
}

// ============================================================================
// Quality Level Bump Calculations
// ============================================================================

/**
 * Calculate QL bump for regular cluster based on nano programming skill
 */
export function rkQLBump(npSkill: number, skill: string, slot: ClusterType, ql: number): QLBumpResult {
  const npReq = rkClusterNP(skill, slot, ql);
  
  if (npSkill < npReq) {
    return { success: false, bumps: 0 };
  }
  
  let overFactor: number;
  switch (slot) {
    case 'Shiny':
      overFactor = 300;
      break;
    case 'Bright':
      overFactor = 200;
      break;
    case 'Faded':
      overFactor = 100;
      break;
    default:
      return { success: false, bumps: 0 };
  }
  
  let bumps = Math.floor((npSkill - npReq) / overFactor);
  
  // Apply QL-based bump limits
  if (ql >= 1 && ql < 50) {
    bumps = 0;
  } else if (ql >= 50 && ql < 100) {
    bumps = Math.min(bumps, 1);
  } else if (ql >= 100 && ql < 150) {
    bumps = Math.min(bumps, 2);
  } else if (ql >= 150 && ql < 200) {
    bumps = Math.min(bumps, 3);
  } else if (ql >= 200 && ql < 250) {
    bumps = Math.min(bumps, 4);
  } else if (ql >= 250 && ql <= 300) {
    bumps = Math.min(bumps, 5);
  }
  
  return { success: true, bumps };
}

/**
 * Calculate QL bump for Jobe cluster based on combining skill
 */
export function jobeQLBump(combineSkill: number, skill: string, slot: ClusterType, ql: number): QLBumpResult {
  const skillReq = jobeClusterSkill(skill, slot, ql);
  
  if (combineSkill < skillReq) {
    return { success: false, bumps: 0 };
  }
  
  let overFactor: number;
  switch (slot) {
    case 'Shiny':
      overFactor = 400;
      break;
    case 'Bright':
      overFactor = 300;
      break;
    case 'Faded':
      overFactor = 200;
      break;
    default:
      return { success: false, bumps: 0 };
  }
  
  let bumps = Math.floor((combineSkill - skillReq) / overFactor);
  
  // Apply QL-based bump limits for Jobe
  if (ql >= 1 && ql < 99) {
    bumps = 0;
  } else if (ql === 99) {
    bumps = Math.min(bumps, 1);
  } else if (ql >= 100 && ql < 150) {
    bumps = Math.min(bumps, 2);
  } else if (ql >= 150 && ql < 200) {
    bumps = Math.min(bumps, 3);
  } else if (ql >= 200 && ql < 250) {
    bumps = Math.min(bumps, 4);
  } else if (ql >= 250 && ql <= 300) {
    bumps = Math.min(bumps, 5);
  }
  
  return { success: true, bumps };
}

// ============================================================================
// Cluster Quality and Building Instructions
// ============================================================================

/**
 * Calculate cluster QL and building instructions for regular cluster
 */
export function rkClusterQLBump(
  slot: ClusterType,
  skill: string,
  combineSkills: CombineSkills,
  curQL: number,
  minQL: number
): ClusterQualityResult {
  const startQL = curQL;
  const npSkill = combineSkills['Nanoprogramming'] || 0;
  
  const { success: enoughSkill, bumps } = rkQLBump(npSkill, skill, slot, startQL);
  
  if (!enoughSkill) {
    return {
      message: ['Your nanoprogramming skill is too low to build this implant.'],
      finalQL: startQL,
      success: false
    };
  }
  
  const tempQL = startQL - bumps;
  const { bumps: checkBumps } = rkQLBump(npSkill, skill, slot, tempQL);
  const finalQL = startQL - checkBumps;
  
  if (finalQL < minQL || tempQL < minQL) {
    return {
      message: ['Your nanoprogramming skill is too high to build this implant.'],
      finalQL: startQL,
      success: false
    };
  }
  
  const clusterQL = Math.max(Math.ceil(CLUSTER_MIN_QL[slot] * finalQL), minQL);
  
  return {
    message: `Add a QL ${clusterQL}+ ${slot} ${skill} cluster. The result is QL ${startQL}.`,
    finalQL,
    success: true
  };
}

/**
 * Calculate cluster QL and building instructions for Jobe cluster
 */
export function jobeClusterQLBump(
  slot: ClusterType,
  skill: string,
  combineSkills: CombineSkills,
  curQL: number,
  minQL: number
): ClusterQualityResult {
  const startQL = curQL;
  const reqSkill = JOBE_SKILL[skill as JobeSkillKey];
  
  if (!reqSkill) {
    return {
      message: [`Unknown Jobe skill: ${skill}`],
      finalQL: startQL,
      success: false
    };
  }
  
  const combineSkill = combineSkills[reqSkill] || 0;
  
  const { success: enoughSkill, bumps } = jobeQLBump(combineSkill, skill, slot, startQL);
  
  if (!enoughSkill) {
    return {
      message: [`Your ${reqSkill} is too low to build this implant.`],
      finalQL: startQL,
      success: false
    };
  }
  
  const tempQL = startQL - bumps;
  const { bumps: checkBumps } = jobeQLBump(combineSkill, skill, slot, tempQL);
  const finalQL = startQL - checkBumps;
  
  if (finalQL < minQL || tempQL < minQL) {
    return {
      message: [`Your ${reqSkill} skill is too high to build this implant.`],
      finalQL: startQL,
      success: false
    };
  }
  
  const clusterQL = Math.max(Math.ceil(CLUSTER_MIN_QL[slot] * finalQL), minQL);
  
  return {
    message: `Add a QL ${clusterQL}+ ${slot} ${skill} cluster. The result is QL ${startQL}.`,
    finalQL,
    success: true
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a skill is a Jobe cluster skill
 */
export function isJobeSkill(skill: string): boolean {
  return skill in JOBE_SKILL;
}

/**
 * Get the required combining skill for a Jobe cluster
 */
export function getJobeRequiredSkill(skill: string): string | null {
  return JOBE_SKILL[skill as JobeSkillKey] || null;
}

/**
 * Calculate total implant benefits for a slot
 */
export function calculateSlotBenefits(
  slotData: ImplantSlotData,
  slot: ClusterType
): number {
  switch (slot) {
    case 'Shiny':
      return slotData.shiny_benefit;
    case 'Bright':
      return slotData.bright_benefit;
    case 'Faded':
      return slotData.faded_benefit;
    default:
      return 0;
  }
}

/**
 * Get all available skills for a slot and cluster type
 */
export function getAvailableSkills(slotName: ImpSlotName, clusterType: ClusterType): string[] {
  return IMP_SKILLS[slotName][clusterType] || [];
}

/**
 * Validate implant configuration
 */
export function validateImplantConfig(implants: ImplantsData): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  for (const [slotName, slotData] of Object.entries(implants)) {
    // Check if QL is within valid range
    if (slotData.ql < 1 || slotData.ql > 300) {
      errors.push(`${slotName}: QL must be between 1 and 300`);
    }
    
    // Check if selected skills are valid for the slot
    const slotSkills = IMP_SKILLS[slotName as ImpSlotName];
    if (slotSkills) {
      if (slotData.shiny !== 'Empty' && !slotSkills.Shiny.includes(slotData.shiny)) {
        errors.push(`${slotName}: Invalid shiny skill '${slotData.shiny}'`);
      }
      if (slotData.bright !== 'Empty' && !slotSkills.Bright.includes(slotData.bright)) {
        errors.push(`${slotName}: Invalid bright skill '${slotData.bright}'`);
      }
      if (slotData.faded !== 'Empty' && !slotSkills.Faded.includes(slotData.faded)) {
        errors.push(`${slotName}: Invalid faded skill '${slotData.faded}'`);
      }
    }
    
    // Warning for high QL with no skills selected
    if (slotData.ql > 200 && 
        slotData.shiny === 'Empty' && 
        slotData.bright === 'Empty' && 
        slotData.faded === 'Empty') {
      warnings.push(`${slotName}: High QL (${slotData.ql}) with no skills selected`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// ============================================================================
// Export utilities as a group
// ============================================================================

export const implantPlanning = {
  // Initialization
  initialImplants,
  initialPreferences,
  
  // Cluster selection
  pickFadedCluster,
  
  // Calculations
  rkClusterNP,
  jobeClusterSkill,
  rkQLBump,
  jobeQLBump,
  rkClusterQLBump,
  jobeClusterQLBump,
  
  // Utilities
  isJobeSkill,
  getJobeRequiredSkill,
  calculateSlotBenefits,
  getAvailableSkills,
  validateImplantConfig
};
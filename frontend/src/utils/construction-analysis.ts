/**
 * TinkerTools Construction Analysis Utility
 * 
 * Implements advanced implant construction calculations including QL bumping,
 * construction step generation, and skill requirement analysis.
 * 
 * Migrated from legacy TinkerPlants views.py and utils.py
 */

import {
  NP_MODS,
  JOBE_SKILL,
  JOBE_MODS,
  IMP_SKILLS,
  CLUSTER_MIN_QL,
  type NPModKey,
  type JobeSkillKey,
  type ClusterType,
  type ImpSlotName
} from '../services/game-data';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface SkillSet {
  'Nanoprogramming': number;
  'Break & Entry': number;
  'Psychology'?: number;
  'Quantum FT'?: number;
  'Computer Literacy'?: number;
  'Pharma Tech'?: number;
  'Weaponsmithing'?: number;
  [skillName: string]: number | undefined;
}

export interface ConstructionStep {
  step: string;
  description: string;
  requirements?: {
    skill: string;
    value: number;
  }[];
}

export interface ConstructionPlan {
  basic_steps: ConstructionStep[];
  ft_steps: ConstructionStep[];
  success: boolean;
  error?: string;
}

export interface QLBumpResult {
  message: string;
  newQL: number;
  possible: boolean;
}

// ============================================================================
// Core Construction Analysis Functions
// ============================================================================

/**
 * Pick the optimal faded cluster for a slot based on NP_MODS
 * Migrated from pick_faded_cluster() in legacy utils.py
 */
export function pickFadedCluster(slot: ImpSlotName): string {
  const skills = IMP_SKILLS[slot]['Faded'].filter(skill => skill !== 'Empty');
  
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
      continue;
    }
  }
  
  return chosen;
}

/**
 * Calculate Nanoprogramming requirement for RK cluster
 */
export function rkClusterNP(skill: string, slot: ClusterType, ql: number): number {
  let slotMod = 1.0;
  if (slot === 'Shiny') {
    slotMod = 2.0;
  } else if (slot === 'Bright') {
    slotMod = 1.5;
  } else if (slot === 'Faded') {
    slotMod = 1.0;
  }
  
  const npMod = NP_MODS[skill as NPModKey];
  if (!npMod) return 0;
  
  return Math.round(npMod * ql * slotMod);
}

/**
 * Calculate skill requirement for Jobe cluster
 */
export function jobeClusterSkill(skill: string, slot: ClusterType, ql: number): number {
  let slotMod = 1.0;
  
  if (skill !== 'Nano Delta') {
    if (slot === 'Shiny') {
      slotMod = 6.25;
    } else if (slot === 'Bright') {
      slotMod = 4.75;
    } else if (slot === 'Faded') {
      slotMod = 3.25;
    }
  } else {
    if (slot === 'Shiny') {
      slotMod = 5.25;
    } else if (slot === 'Bright') {
      slotMod = 4.0;
    } else if (slot === 'Faded') {
      slotMod = 2.75;
    }
  }
  
  return Math.round(ql * slotMod);
}

/**
 * Calculate RK cluster QL bumps
 * Migrated from rk_ql_bump() in legacy utils.py
 */
export function rkQLBump(npSkill: number, skill: string, slot: ClusterType, ql: number): { possible: boolean; bumps: number } {
  const npReq = rkClusterNP(skill, slot, ql);
  if (npSkill < npReq) {
    return { possible: false, bumps: 0 };
  }
  
  let overFactor: number;
  if (slot === 'Shiny') {
    overFactor = 300;
  } else if (slot === 'Bright') {
    overFactor = 200;
  } else if (slot === 'Faded') {
    overFactor = 100;
  } else {
    return { possible: false, bumps: 0 };
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
  
  return { possible: true, bumps };
}

/**
 * Calculate Jobe cluster QL bumps
 * Migrated from jobe_ql_bump() in legacy utils.py
 */
export function jobeQLBump(combineSkill: number, skill: string, slot: ClusterType, ql: number): { possible: boolean; bumps: number } {
  const skillReq = jobeClusterSkill(skill, slot, ql);
  if (combineSkill < skillReq) {
    return { possible: false, bumps: 0 };
  }
  
  let overFactor: number;
  if (slot === 'Shiny') {
    overFactor = 400;
  } else if (slot === 'Bright') {
    overFactor = 300;
  } else if (slot === 'Faded') {
    overFactor = 200;
  } else {
    return { possible: false, bumps: 0 };
  }
  
  let bumps = Math.floor((combineSkill - skillReq) / overFactor);
  
  // Apply QL-based bump limits
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
  
  return { possible: true, bumps };
}

/**
 * Analyze RK cluster QL bumping for construction
 * Migrated from rk_cluster_ql_bump() in legacy utils.py
 */
export function rkClusterQLBump(
  slot: ClusterType, 
  skill: string, 
  combineSkills: SkillSet, 
  curQL: number, 
  minQL: number
): QLBumpResult {
  const startQL = curQL;
  const npSkill = combineSkills['Nanoprogramming'] || 0;
  
  const { possible: enufSkill, bumps } = rkQLBump(npSkill, skill, slot, startQL);
  if (!enufSkill) {
    return {
      message: 'Your nanoprogramming skill is too low to build this implant.',
      newQL: startQL,
      possible: false
    };
  }
  
  const tempQL = startQL - bumps;
  const { bumps: checkBumps } = rkQLBump(npSkill, skill, slot, tempQL);
  const finalQL = startQL - checkBumps;
  
  if (finalQL < minQL || tempQL < minQL) {
    return {
      message: 'Your nanoprogramming skill is too high to build this implant.',
      newQL: startQL,
      possible: false
    };
  }
  
  const clusterQL = Math.ceil(CLUSTER_MIN_QL[slot] * finalQL);
  const adjustedClusterQL = clusterQL < minQL ? minQL : clusterQL;
  
  return {
    message: `Add a QL ${adjustedClusterQL}+ ${slot} ${skill} cluster. The result is QL ${startQL}.`,
    newQL: finalQL,
    possible: true
  };
}

/**
 * Analyze Jobe cluster QL bumping for construction
 * Migrated from jobe_cluster_ql_bump() in legacy utils.py
 */
export function jobeClusterQLBump(
  slot: ClusterType, 
  skill: string, 
  combineSkills: SkillSet, 
  curQL: number, 
  minQL: number
): QLBumpResult {
  const startQL = curQL;
  const reqSkill = JOBE_SKILL[skill as JobeSkillKey];
  
  if (!reqSkill) {
    return {
      message: `Unknown Jobe skill: ${skill}`,
      newQL: startQL,
      possible: false
    };
  }
  
  const combineSkill = combineSkills[reqSkill] || 0;
  
  const { possible: enufSkill, bumps } = jobeQLBump(combineSkill, skill, slot, startQL);
  if (!enufSkill) {
    return {
      message: `Your ${reqSkill} is too low to build this implant.`,
      newQL: startQL,
      possible: false
    };
  }
  
  const tempQL = startQL - bumps;
  const { bumps: checkBumps } = jobeQLBump(combineSkill, skill, slot, tempQL);
  const finalQL = startQL - checkBumps;
  
  if (finalQL < minQL || tempQL < minQL) {
    return {
      message: `Your ${reqSkill} skill is too high to build this implant.`,
      newQL: startQL,
      possible: false
    };
  }
  
  const clusterQL = Math.ceil(CLUSTER_MIN_QL[slot] * finalQL);
  
  return {
    message: `Add a QL ${clusterQL}+ ${slot} ${skill} cluster. The result is QL ${startQL}.`,
    newQL: finalQL,
    possible: true
  };
}

/**
 * Generate complete construction plan for an implant
 * Migrated from construct_imp() in legacy views.py
 */
export function generateConstructionPlan(
  slot: ImpSlotName,
  shinySkill: string,
  brightSkill: string,
  fadedSkill: string,
  targetQL: number,
  combineSkills: SkillSet
): ConstructionPlan {
  const basicSteps: ConstructionStep[] = [];
  const ftSteps: ConstructionStep[] = [];
  
  // Determine minimum QL based on target
  let minQL = 1;
  if (targetQL > 200) {
    minQL = 201;
  } else if (targetQL >= 50) {
    minQL = 50;
  }
  
  let curQL = targetQL;
  
  // Process Shiny cluster
  if (shinySkill !== 'Empty') {
    const isRK = NP_MODS[shinySkill as NPModKey] !== undefined;
    const isJobe = JOBE_SKILL[shinySkill as JobeSkillKey] !== undefined;
    
    if (isRK) {
      const result = rkClusterQLBump('Shiny', shinySkill, combineSkills, curQL, minQL);
      if (!result.possible) {
        return {
          basic_steps: [{ step: result.message, description: result.message }],
          ft_steps: [{ step: result.message, description: result.message }],
          success: false,
          error: result.message
        };
      }
      basicSteps.push({ step: result.message, description: result.message });
      ftSteps.push({ step: result.message, description: result.message });
      curQL = result.newQL;
    } else if (isJobe) {
      if (curQL < 99) {
        const errorMsg = 'JOBE clusters cannot be combined under QL99';
        return {
          basic_steps: [{ step: errorMsg, description: errorMsg }],
          ft_steps: [{ step: errorMsg, description: errorMsg }],
          success: false,
          error: errorMsg
        };
      }
      const result = jobeClusterQLBump('Shiny', shinySkill, combineSkills, curQL, minQL);
      if (!result.possible) {
        return {
          basic_steps: [{ step: result.message, description: result.message }],
          ft_steps: [{ step: result.message, description: result.message }],
          success: false,
          error: result.message
        };
      }
      basicSteps.push({ step: result.message, description: result.message });
      ftSteps.push({ step: result.message, description: result.message });
      curQL = result.newQL;
    }
  }
  
  // Process Bright cluster
  if (brightSkill !== 'Empty') {
    const isRK = NP_MODS[brightSkill as NPModKey] !== undefined;
    const isJobe = JOBE_SKILL[brightSkill as JobeSkillKey] !== undefined;
    
    if (isRK) {
      const result = rkClusterQLBump('Bright', brightSkill, combineSkills, curQL, minQL);
      if (!result.possible) {
        return {
          basic_steps: [{ step: result.message, description: result.message }],
          ft_steps: [{ step: result.message, description: result.message }],
          success: false,
          error: result.message
        };
      }
      basicSteps.push({ step: result.message, description: result.message });
      ftSteps.push({ step: result.message, description: result.message });
      curQL = result.newQL;
    } else if (isJobe) {
      if (curQL < 99) {
        const errorMsg = 'JOBE clusters cannot be combined under QL99';
        return {
          basic_steps: [{ step: errorMsg, description: errorMsg }],
          ft_steps: [{ step: errorMsg, description: errorMsg }],
          success: false,
          error: errorMsg
        };
      }
      const result = jobeClusterQLBump('Bright', brightSkill, combineSkills, curQL, minQL);
      if (!result.possible) {
        return {
          basic_steps: [{ step: result.message, description: result.message }],
          ft_steps: [{ step: result.message, description: result.message }],
          success: false,
          error: result.message
        };
      }
      basicSteps.push({ step: result.message, description: result.message });
      ftSteps.push({ step: result.message, description: result.message });
      curQL = result.newQL;
    }
  }
  
  // Process Faded cluster
  if (fadedSkill !== 'Empty') {
    const isRK = NP_MODS[fadedSkill as NPModKey] !== undefined;
    const isJobe = JOBE_SKILL[fadedSkill as JobeSkillKey] !== undefined;
    
    if (isRK) {
      const result = rkClusterQLBump('Faded', fadedSkill, combineSkills, curQL, minQL);
      if (!result.possible) {
        return {
          basic_steps: [{ step: result.message, description: result.message }],
          ft_steps: [{ step: result.message, description: result.message }],
          success: false,
          error: result.message
        };
      }
      basicSteps.push({ step: result.message, description: result.message });
      ftSteps.push({ step: result.message, description: result.message });
      curQL = result.newQL;
    } else if (isJobe) {
      if (curQL < 99) {
        const errorMsg = 'JOBE clusters cannot be combined under QL99';
        return {
          basic_steps: [{ step: errorMsg, description: errorMsg }],
          ft_steps: [{ step: errorMsg, description: errorMsg }],
          success: false,
          error: errorMsg
        };
      }
      const result = jobeClusterQLBump('Faded', fadedSkill, combineSkills, curQL, minQL);
      if (!result.possible) {
        return {
          basic_steps: [{ step: result.message, description: result.message }],
          ft_steps: [{ step: result.message, description: result.message }],
          success: false,
          error: result.message
        };
      }
      basicSteps.push({ step: result.message, description: result.message });
      ftSteps.push({ step: result.message, description: result.message });
      curQL = result.newQL;
    }
  }
  
  // Add base implant step
  const baseStep = `Start with a QL ${curQL} Basic ${slot} Implant`;
  basicSteps.push({ step: baseStep, description: baseStep });
  
  // Field Tinkering logic
  let fadedForFT = fadedSkill;
  if (fadedForFT === 'Empty') {
    fadedForFT = pickFadedCluster(slot);
  }
  
  const beSkill = combineSkills['Break & Entry'] || 0;
  const npSkill = combineSkills['Nanoprogramming'] || 0;
  
  // FT QL bumping loop
  let ftQL = curQL;
  while (ftQL % 10 !== 0) {
    if (!NP_MODS[fadedForFT as NPModKey]) {
      break;
    }
    
    if (ftQL > 200) {
      ftSteps.splice(0, ftSteps.length, { 
        step: 'Refined implants cannot be cleaned for QL bumping', 
        description: 'Refined implants cannot be cleaned for QL bumping' 
      });
      break;
    }
    
    const beReq = Math.round(ftQL * 4.75);
    if (beSkill >= beReq && npSkill >= ftQL) {
      ftSteps.push({ 
        step: 'Clean the implant', 
        description: 'Clean the implant to enable QL bumping',
        requirements: [
          { skill: 'Break & Entry', value: beReq },
          { skill: 'Nanoprogramming', value: ftQL }
        ]
      });
    } else {
      ftSteps.splice(0, ftSteps.length, { 
        step: `You need at least ${beReq} B&E skill to QL bump this implant`, 
        description: `You need at least ${beReq} B&E skill to QL bump this implant` 
      });
      break;
    }
    
    const result = rkClusterQLBump('Faded', fadedForFT, combineSkills, ftQL, minQL);
    if (!result.possible) {
      ftSteps.splice(0, ftSteps.length, { 
        step: result.message, 
        description: result.message 
      });
      break;
    }
    
    ftSteps.push({ step: result.message, description: result.message });
    ftQL = result.newQL;
  }
  
  // Add FT base implant step if applicable
  if (ftSteps.length > 1) {
    ftSteps.push({ 
      step: `Start with a QL ${ftQL} Basic ${slot} Implant`, 
      description: `Start with a QL ${ftQL} Basic ${slot} Implant` 
    });
  }
  
  // Reverse steps to show proper order
  basicSteps.reverse();
  ftSteps.reverse();
  
  return {
    basic_steps: basicSteps,
    ft_steps: ftSteps,
    success: true
  };
}
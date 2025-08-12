/**
 * TinkerTools Nano Compatibility Utility
 * 
 * Functions for nano requirement validation, NCU cost calculations,
 * nano school compatibility checks, and spell effect formatting.
 */

import { 
  NANOSCHOOL, 
  NANO_STRAIN,
  PROFESSION,
  getStatName,
  getProfessionName,
  getNanoSchoolName,
  getNanoStrainName
} from '../services/game-data';
import { validateRequirements, type Character } from './stat-calculations';
import { gameUtils } from '../services/game-utils';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface Nano {
  id: number;
  name: string;
  school: number;
  ncuCost: number;
  nanoPoints: number;
  strain?: number;
  level?: number;
  requirements?: NanoRequirement[];
  effects?: NanoEffect[];
  duration?: number;
  stackingLine?: number;
  attackTime?: number;
  rechargeTime?: number;
}

export interface NanoRequirement {
  stat: number;
  value: number;
  operator: string;
}

export interface NanoEffect {
  type: number;
  target: number;
  stat?: number;
  amount?: number;
  duration?: number;
  hits?: number;
  description?: string;
}

export interface NCUMemory {
  totalNCU: number;
  usedNCU: number;
  availableNCU: number;
  runningNanos: Nano[];
}

export interface NanoCompatibilityResult {
  canCast: boolean;
  reasons: string[];
  requiredStats?: Array<{ stat: number; required: number; current: number }>;
  ncuRequired: number;
  ncuAvailable: number;
}

export interface StackingConflict {
  existingNano: Nano;
  newNano: Nano;
  conflictType: 'strain' | 'stackingLine' | 'effect';
  description: string;
}

// ============================================================================
// NCU and Memory Management
// ============================================================================

/**
 * Calculate current NCU usage from running nanos
 */
export function calculateNCUUsage(runningNanos: Nano[]): number {
  return runningNanos.reduce((total, nano) => total + nano.ncuCost, 0);
}

/**
 * Calculate available NCU memory
 */
export function calculateAvailableNCU(totalNCU: number, runningNanos: Nano[]): number {
  const usedNCU = calculateNCUUsage(runningNanos);
  return Math.max(0, totalNCU - usedNCU);
}

/**
 * Check if there's enough NCU memory for a nano
 */
export function hasEnoughNCU(nano: Nano, totalNCU: number, runningNanos: Nano[]): boolean {
  const availableNCU = calculateAvailableNCU(totalNCU, runningNanos);
  return nano.ncuCost <= availableNCU;
}

/**
 * Find nanos that could be removed to make space for a new nano
 */
export function findRemovableNanos(
  targetNano: Nano,
  totalNCU: number,
  runningNanos: Nano[]
): Nano[] {
  const availableNCU = calculateAvailableNCU(totalNCU, runningNanos);
  const neededNCU = targetNano.ncuCost - availableNCU;
  
  if (neededNCU <= 0) return [];
  
  // Sort running nanos by NCU cost (remove expensive ones first)
  const sortedNanos = [...runningNanos].sort((a, b) => b.ncuCost - a.ncuCost);
  
  const removable: Nano[] = [];
  let freedNCU = 0;
  
  for (const nano of sortedNanos) {
    removable.push(nano);
    freedNCU += nano.ncuCost;
    
    if (freedNCU >= neededNCU) {
      break;
    }
  }
  
  return removable;
}

// ============================================================================
// Nano Requirements Validation
// ============================================================================

/**
 * Check if a character meets all requirements to cast a nano
 */
export function validateNanoRequirements(
  nano: Nano,
  character: Character
): NanoCompatibilityResult {
  const reasons: string[] = [];
  let canCast = true;
  
  // Check stat requirements
  const reqValidation = validateRequirements(character, nano.requirements || []);
  if (!reqValidation.valid) {
    canCast = false;
    reqValidation.failures.forEach(failure => {
      const statName = getStatName(failure.stat) || `Stat ${failure.stat}`;
      reasons.push(`${statName}: ${failure.current}/${failure.required}`);
    });
  }
  
  // Check profession compatibility
  if (nano.school && !canProfessionUseNanoSchool(character.profession, nano.school)) {
    const professionName = getProfessionName(character.profession) || 'Unknown';
    const schoolName = getNanoSchoolName(nano.school) || 'Unknown';
    reasons.push(`${professionName} cannot use ${schoolName} nanos effectively`);
    canCast = false;
  }
  
  // Check level requirements (if nano has level restriction)
  if (nano.level && character.level < nano.level) {
    reasons.push(`Level ${character.level}/${nano.level}`);
    canCast = false;
  }
  
  return {
    canCast,
    reasons,
    requiredStats: reqValidation.failures,
    ncuRequired: nano.ncuCost,
    ncuAvailable: 0 // This should be calculated by caller
  };
}

/**
 * Check profession compatibility with nano school
 */
export function canProfessionUseNanoSchool(professionId: number, schoolId: number): boolean {
  return gameUtils.canProfessionUseNanoSchool(professionId, schoolId);
}

/**
 * Get effectiveness rating for profession/school combination
 */
export function getNanoSchoolEffectiveness(professionId: number, schoolId: number): number {
  const profession = getProfessionName(professionId);
  const school = getNanoSchoolName(schoolId);
  
  if (!profession || !school) return 0;

  // Effectiveness ratings (0-100)
  const effectiveness: Record<string, Record<string, number>> = {
    'Doctor': { 'Medical': 100, 'Protection': 80, 'Combat': 40, 'Psi': 60, 'Space': 30 },
    'NanoTechnician': { 'Combat': 100, 'Psi': 90, 'Medical': 50, 'Protection': 60, 'Space': 70 },
    'MetaPhysicist': { 'Psi': 100, 'Space': 100, 'Combat': 70, 'Medical': 40, 'Protection': 50 },
    'Bureaucrat': { 'Psi': 90, 'Protection': 80, 'Medical': 60, 'Combat': 40, 'Space': 50 },
    'Agent': { 'Psi': 80, 'Combat': 85, 'Medical': 50, 'Protection': 60, 'Space': 40 },
    'Adventurer': { 'Medical': 80, 'Protection': 75, 'Combat': 60, 'Psi': 50, 'Space': 40 },
    'Trader': { 'Medical': 75, 'Protection': 70, 'Psi': 60, 'Combat': 40, 'Space': 30 },
    'Engineer': { 'Protection': 80, 'Combat': 70, 'Medical': 60, 'Psi': 50, 'Space': 40 },
    'Fixer': { 'Medical': 70, 'Combat': 75, 'Protection': 60, 'Psi': 50, 'Space': 30 },
    'Soldier': { 'Combat': 85, 'Protection': 80, 'Medical': 60, 'Psi': 40, 'Space': 30 },
    'Enforcer': { 'Combat': 90, 'Protection': 85, 'Medical': 50, 'Psi': 40, 'Space': 30 },
    'MartialArtist': { 'Medical': 75, 'Combat': 80, 'Protection': 60, 'Psi': 50, 'Space': 30 },
    'Keeper': { 'Medical': 90, 'Protection': 90, 'Psi': 80, 'Combat': 60, 'Space': 50 },
    'Shade': { 'Combat': 90, 'Psi': 85, 'Medical': 50, 'Protection': 60, 'Space': 40 }
  };

  return effectiveness[profession]?.[school] || 0;
}

// ============================================================================
// Stacking and Conflict Detection
// ============================================================================

/**
 * Check for stacking conflicts between nanos
 */
export function checkStackingConflicts(
  newNano: Nano,
  runningNanos: Nano[]
): StackingConflict[] {
  const conflicts: StackingConflict[] = [];
  
  for (const existingNano of runningNanos) {
    // Check strain conflicts
    if (newNano.strain && existingNano.strain === newNano.strain) {
      conflicts.push({
        existingNano,
        newNano,
        conflictType: 'strain',
        description: `Both nanos use strain ${getNanoStrainName(newNano.strain) || newNano.strain}`
      });
    }
    
    // Check stacking line conflicts
    if (newNano.stackingLine && existingNano.stackingLine === newNano.stackingLine) {
      conflicts.push({
        existingNano,
        newNano,
        conflictType: 'stackingLine',
        description: `Both nanos are on the same stacking line ${newNano.stackingLine}`
      });
    }
    
    // Check for overlapping effects (simplified)
    if (newNano.effects && existingNano.effects) {
      const overlapEffects = findOverlappingEffects(newNano.effects, existingNano.effects);
      if (overlapEffects.length > 0) {
        conflicts.push({
          existingNano,
          newNano,
          conflictType: 'effect',
          description: `Conflicting effects: ${overlapEffects.join(', ')}`
        });
      }
    }
  }
  
  return conflicts;
}

/**
 * Find overlapping effects between two nano effect lists
 */
export function findOverlappingEffects(effects1: NanoEffect[], effects2: NanoEffect[]): string[] {
  const overlaps: string[] = [];
  
  for (const effect1 of effects1) {
    for (const effect2 of effects2) {
      // Check if both effects modify the same stat
      if (effect1.stat && effect2.stat && effect1.stat === effect2.stat) {
        const statName = getStatName(effect1.stat) || `Stat ${effect1.stat}`;
        overlaps.push(statName);
      }
    }
  }
  
  return [...new Set(overlaps)]; // Remove duplicates
}

/**
 * Resolve stacking conflicts automatically
 */
export function resolveStackingConflicts(
  conflicts: StackingConflict[],
  strategy: 'replace' | 'cancel' | 'ask' = 'replace'
): Array<{ action: 'remove' | 'block'; nano: Nano; reason: string }> {
  const actions: Array<{ action: 'remove' | 'block'; nano: Nano; reason: string }> = [];
  
  for (const conflict of conflicts) {
    switch (strategy) {
      case 'replace':
        actions.push({
          action: 'remove',
          nano: conflict.existingNano,
          reason: `Replaced by ${conflict.newNano.name}`
        });
        break;
        
      case 'cancel':
        actions.push({
          action: 'block',
          nano: conflict.newNano,
          reason: `Conflicts with ${conflict.existingNano.name}`
        });
        break;
        
      case 'ask':
        // Return the conflict for user decision
        break;
    }
  }
  
  return actions;
}

// ============================================================================
// Nano Cost Calculations
// ============================================================================

/**
 * Calculate nano point cost for casting a nano
 */
export function calculateNanoCost(
  nano: Nano,
  character: Character,
  modifiers: Array<{ type: string; value: number }> = []
): number {
  let cost = nano.nanoPoints || 0;
  
  // Apply cost modifiers
  for (const modifier of modifiers) {
    switch (modifier.type) {
      case 'flat':
        cost += modifier.value;
        break;
      case 'percentage':
        cost = Math.floor(cost * (1 + modifier.value / 100));
        break;
      case 'efficiency':
        cost = Math.floor(cost * (1 - modifier.value / 100));
        break;
    }
  }
  
  // Nano cost cannot be negative
  return Math.max(0, cost);
}

/**
 * Calculate nano init time with modifiers
 */
export function calculateNanoInitTime(
  nano: Nano,
  character: Character,
  modifiers: Array<{ type: string; value: number }> = []
): number {
  let initTime = nano.attackTime || 1000; // Default 1 second
  
  // Apply speed modifiers
  for (const modifier of modifiers) {
    switch (modifier.type) {
      case 'flat':
        initTime += modifier.value;
        break;
      case 'percentage':
        initTime = Math.floor(initTime * (1 + modifier.value / 100));
        break;
      case 'speed':
        initTime = Math.floor(initTime * (1 - modifier.value / 100));
        break;
    }
  }
  
  return Math.max(100, initTime); // Minimum 0.1 second
}

// ============================================================================
// Spell Effect Formatting
// ============================================================================

/**
 * Format nano effects for display
 */
export function formatNanoEffects(effects: NanoEffect[]): string[] {
  return effects.map(effect => formatSingleEffect(effect));
}

/**
 * Format a single nano effect
 */
export function formatSingleEffect(effect: NanoEffect): string {
  const statName = effect.stat ? getStatName(effect.stat) || `Stat ${effect.stat}` : 'Unknown';
  const amount = effect.amount || 0;
  const duration = effect.duration || 0;
  
  // Basic effect formatting
  let description = '';
  
  switch (effect.type) {
    case 1: // Modify stat
      description = `${amount > 0 ? '+' : ''}${amount} ${statName}`;
      if (duration > 0) {
        description += ` for ${duration}s`;
      }
      break;
      
    case 2: // Heal/Damage
      if (amount > 0) {
        description = `Heal ${amount} ${statName}`;
      } else {
        description = `Damage ${Math.abs(amount)} ${statName}`;
      }
      break;
      
    case 3: // Damage over time
      description = `${Math.abs(amount)} ${statName} damage`;
      if (effect.hits) {
        description += ` (${effect.hits} hits)`;
      }
      if (duration > 0) {
        description += ` over ${duration}s`;
      }
      break;
      
    case 4: // Heal over time
      description = `${amount} ${statName} healing`;
      if (effect.hits) {
        description += ` (${effect.hits} hits)`;
      }
      if (duration > 0) {
        description += ` over ${duration}s`;
      }
      break;
      
    default:
      description = effect.description || `Unknown effect type ${effect.type}`;
  }
  
  return description;
}

/**
 * Get nano school color for UI display
 */
export function getNanoSchoolColor(schoolId: number): string {
  const colors = {
    1: '#ff4444', // Combat - Red
    2: '#44ff44', // Medical - Green  
    3: '#4444ff', // Protection - Blue
    4: '#ff44ff', // Psi - Purple
    5: '#ffff44'  // Space - Yellow
  };
  
  return colors[schoolId as keyof typeof colors] || '#888888';
}

/**
 * Get nano difficulty rating based on requirements
 */
export function getNanoDifficulty(nano: Nano): 'Easy' | 'Medium' | 'Hard' | 'Expert' {
  if (!nano.requirements || nano.requirements.length === 0) {
    return 'Easy';
  }
  
  // Calculate difficulty based on highest requirement
  const maxRequirement = Math.max(...nano.requirements.map(req => req.value));
  
  if (maxRequirement < 100) return 'Easy';
  if (maxRequirement < 300) return 'Medium';
  if (maxRequirement < 600) return 'Hard';
  return 'Expert';
}

// ============================================================================
// Export utilities as a group
// ============================================================================

export const nanoCompatibility = {
  // NCU Management
  calculateNCUUsage,
  calculateAvailableNCU,
  hasEnoughNCU,
  findRemovableNanos,
  
  // Requirements
  validateNanoRequirements,
  canProfessionUseNanoSchool,
  getNanoSchoolEffectiveness,
  
  // Stacking
  checkStackingConflicts,
  findOverlappingEffects,
  resolveStackingConflicts,
  
  // Calculations
  calculateNanoCost,
  calculateNanoInitTime,
  
  // Formatting
  formatNanoEffects,
  formatSingleEffect,
  getNanoSchoolColor,
  getNanoDifficulty
};
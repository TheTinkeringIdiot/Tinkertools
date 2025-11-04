/**
 * PerkManager - Perk System Management for TinkerProfiles
 *
 * Manages perk purchase, removal, validation, and effect calculation
 * for all three perk types: SL Perks, AI Perks, and LE Research
 */

import type { TinkerProfile, SkillWithIP, IPTracker } from './types';
import type {
  PerkSystem,
  PerkEntry,
  ResearchEntry,
  PerkValidationResult,
  PerkEffectSummary,
  PerkCharacterData,
  PerkPointCalculation,
  PerkChangeEvent,
  PerkInfo,
  PerkEffect,
  AnyPerkEntry,
} from './perk-types';

import { getBreedId, getProfessionId } from '../../services/game-utils';

// ============================================================================
// Perk Point Calculation Functions
// ============================================================================

/**
 * Calculate available standard perk points based on character level
 */
function calculateStandardPerkPoints(level: number): number {
  if (level < 10) return 0;

  // 1 point every 10 levels up to level 200 (20 points)
  const pointsUpTo200 = Math.min(Math.floor(level / 10), 20);

  // 1 point per level from 201-220 (20 points)
  const pointsAfter200 = level > 200 ? Math.min(level - 200, 20) : 0;

  // Total: maximum 40 points at level 220
  return pointsUpTo200 + pointsAfter200;
}

/**
 * Calculate available AI perk points based on alien level
 */
function calculateAIPerkPoints(alienLevel: number): number {
  // 1 AI perk point per alien level, max 30
  return Math.min(alienLevel, 30);
}

/**
 * Calculate perk cost for a given type and level
 */
function getPerkCost(perkType: 'SL' | 'AI' | 'LE', level: number = 1): number {
  switch (perkType) {
    case 'SL':
      return level; // 1 standard perk point per level
    case 'AI':
      return level; // 1 AI perk point per level
    case 'LE':
      return 0; // Research perks are free (requirement-based only)
    default:
      return level;
  }
}

/**
 * Calculate total cost for upgrading a perk to a specific level
 */
function calculatePerkUpgradeCost(
  currentLevel: number,
  targetLevel: number,
  perkType: 'SL' | 'AI' | 'LE'
): number {
  if (perkType === 'LE') return 0; // Research is free

  // Each level costs 1 point, so total cost is the difference
  return Math.max(0, targetLevel - currentLevel);
}

// ============================================================================
// Perk Validation Functions
// ============================================================================

/**
 * Validate if a character can purchase/upgrade a perk
 */
function validatePerkRequirements(
  profile: TinkerProfile,
  perkInfo: PerkInfo,
  targetLevel: number
): PerkValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Extract character data
  const character = profile.Character;
  const currentPerks = profile.PerksAndResearch?.perks || [];
  const currentResearch = profile.PerksAndResearch?.research || [];

  // Find current level of this perk
  const existingPerk = currentPerks.find((p) => p.name === perkInfo.name);
  const existingResearch = currentResearch.find((r) => r.name === perkInfo.name);
  const currentLevel = existingPerk?.level || existingResearch?.level || 0;

  // Check level requirement
  if (perkInfo.requirements.level && character.Level < perkInfo.requirements.level) {
    errors.push(`Requires level ${perkInfo.requirements.level}`);
  }

  // Check AI level requirement (for AI perks)
  if (
    perkInfo.requirements.alienLevel &&
    (!character.AlienLevel || character.AlienLevel < perkInfo.requirements.alienLevel)
  ) {
    errors.push(`Requires AI level ${perkInfo.requirements.alienLevel}`);
  }

  // Check profession restriction
  if (perkInfo.requirements.professions && perkInfo.requirements.professions.length > 0) {
    if (!perkInfo.requirements.professions.includes(character.Profession)) {
      errors.push(`Not available for ${character.Profession}`);
    }
  }

  // Check breed restriction
  if (perkInfo.requirements.breeds && perkInfo.requirements.breeds.length > 0) {
    if (!perkInfo.requirements.breeds.includes(character.Breed)) {
      errors.push(`Not available for ${character.Breed}`);
    }
  }

  // Check expansion requirement
  if (perkInfo.requirements.expansion && character.Expansion !== perkInfo.requirements.expansion) {
    errors.push(`Requires ${perkInfo.requirements.expansion} expansion`);
  }

  // Check sequential purchase requirement
  if (targetLevel > currentLevel + 1) {
    errors.push(`Must purchase level ${currentLevel + 1} first`);
  }

  // Check perk points available (not for LE research)
  if (perkInfo.type !== 'LE') {
    const perkSystem = profile.PerksAndResearch;
    if (!perkSystem) {
      errors.push('Perk system not initialized');
    } else {
      const pointType = perkInfo.type === 'AI' ? 'aiPerkPoints' : 'standardPerkPoints';
      const availablePoints = perkSystem[pointType].available;
      const cost = calculatePerkUpgradeCost(currentLevel, targetLevel, perkInfo.type);

      if (availablePoints < cost) {
        const pointName = perkInfo.type === 'AI' ? 'AI' : 'standard';
        errors.push(
          `Insufficient ${pointName} perk points (need ${cost}, have ${availablePoints})`
        );
      }
    }
  }

  // Check if already at max level
  if (currentLevel >= 10) {
    errors.push('Perk is already at maximum level');
  }

  // Warnings for efficiency
  if (targetLevel > 5 && currentLevel === 0) {
    warnings.push('Consider purchasing lower levels first for better progression');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// Perk Manager Class
// ============================================================================

export class PerkManager {
  private perkEffectCache: Map<string, PerkEffectSummary> = new Map();
  private pointCalculationCache: Map<string, PerkPointCalculation> = new Map();

  /**
   * Add or upgrade a perk in the profile
   */
  addPerk(
    profile: TinkerProfile,
    perkInfo: PerkInfo,
    targetLevel: number = 1
  ): {
    success: boolean;
    error?: string;
    updatedProfile?: TinkerProfile;
    changeEvent?: PerkChangeEvent;
  } {
    try {
      // Validate the purchase
      const validation = validatePerkRequirements(profile, perkInfo, targetLevel);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.errors.join(', '),
        };
      }

      // Create a deep copy of the profile
      const updatedProfile = JSON.parse(JSON.stringify(profile)) as TinkerProfile;

      // Initialize perk system if needed
      if (!updatedProfile.PerksAndResearch) {
        updatedProfile.PerksAndResearch = this.initializePerkSystem(updatedProfile);
      }

      const perkSystem = updatedProfile.PerksAndResearch;

      // Handle different perk types
      if (perkInfo.type === 'LE') {
        // LE Research perks
        const existingIndex = perkSystem.research.findIndex((r) => r.name === perkInfo.name);
        const oldLevel = existingIndex >= 0 ? perkSystem.research[existingIndex].level : 0;

        const researchEntry: ResearchEntry = {
          aoid: perkInfo.aoid,
          name: perkInfo.name,
          level: targetLevel,
          type: 'LE',
        };

        if (existingIndex >= 0) {
          perkSystem.research[existingIndex] = researchEntry;
        } else {
          perkSystem.research.push(researchEntry);
        }

        const changeEvent: PerkChangeEvent = {
          type: oldLevel === 0 ? 'add' : 'upgrade',
          perk: researchEntry,
          oldLevel,
          newLevel: targetLevel,
          pointsChanged: 0,
        };

        return {
          success: true,
          updatedProfile: this.finalizeProfileUpdate(updatedProfile),
          changeEvent,
        };
      } else {
        // SL/AI Perks that cost points
        const existingIndex = perkSystem.perks.findIndex((p) => p.name === perkInfo.name);
        const oldLevel = existingIndex >= 0 ? perkSystem.perks[existingIndex].level : 0;
        const cost = calculatePerkUpgradeCost(oldLevel, targetLevel, perkInfo.type);

        const perkEntry: PerkEntry = {
          aoid: perkInfo.aoid,
          name: perkInfo.name,
          level: targetLevel,
          type: perkInfo.type,
        };

        if (existingIndex >= 0) {
          perkSystem.perks[existingIndex] = perkEntry;
        } else {
          perkSystem.perks.push(perkEntry);
        }

        // Update point tracking
        const pointType = perkInfo.type === 'AI' ? 'aiPerkPoints' : 'standardPerkPoints';
        perkSystem[pointType].spent += cost;
        perkSystem[pointType].available -= cost;

        const changeEvent: PerkChangeEvent = {
          type: oldLevel === 0 ? 'add' : 'upgrade',
          perk: perkEntry,
          oldLevel,
          newLevel: targetLevel,
          pointsChanged: cost,
        };

        return {
          success: true,
          updatedProfile: this.finalizeProfileUpdate(updatedProfile),
          changeEvent,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add perk',
      };
    }
  }

  /**
   * Remove or downgrade a perk from the profile
   */
  removePerk(
    profile: TinkerProfile,
    perkName: string,
    targetLevel: number = 0
  ): {
    success: boolean;
    error?: string;
    updatedProfile?: TinkerProfile;
    changeEvent?: PerkChangeEvent;
  } {
    try {
      if (!profile.PerksAndResearch) {
        return {
          success: false,
          error: 'No perks to remove',
        };
      }

      const updatedProfile = JSON.parse(JSON.stringify(profile)) as TinkerProfile;
      const perkSystem = updatedProfile.PerksAndResearch;

      // Check in regular perks first
      const perkIndex = perkSystem.perks.findIndex((p) => p.name === perkName);
      if (perkIndex >= 0) {
        const perk = perkSystem.perks[perkIndex];
        const oldLevel = perk.level;
        const pointsRefunded = calculatePerkUpgradeCost(targetLevel, oldLevel, perk.type);

        let changeEvent: PerkChangeEvent;

        if (targetLevel === 0) {
          // Complete removal
          perkSystem.perks.splice(perkIndex, 1);
          changeEvent = {
            type: 'remove',
            perk,
            oldLevel,
            newLevel: 0,
            pointsChanged: -pointsRefunded,
          };
        } else {
          // Downgrade
          perk.level = targetLevel;
          changeEvent = {
            type: 'downgrade',
            perk,
            oldLevel,
            newLevel: targetLevel,
            pointsChanged: -pointsRefunded,
          };
        }

        // Refund points
        const pointType = perk.type === 'AI' ? 'aiPerkPoints' : 'standardPerkPoints';
        perkSystem[pointType].spent -= pointsRefunded;
        perkSystem[pointType].available += pointsRefunded;

        return {
          success: true,
          updatedProfile: this.finalizeProfileUpdate(updatedProfile),
          changeEvent,
        };
      }

      // Check in research perks
      const researchIndex = perkSystem.research.findIndex((r) => r.name === perkName);
      if (researchIndex >= 0) {
        const research = perkSystem.research[researchIndex];
        const oldLevel = research.level;

        let changeEvent: PerkChangeEvent;

        if (targetLevel === 0) {
          // Complete removal
          perkSystem.research.splice(researchIndex, 1);
          changeEvent = {
            type: 'remove',
            perk: research,
            oldLevel,
            newLevel: 0,
            pointsChanged: 0,
          };
        } else {
          // Downgrade
          research.level = targetLevel;
          changeEvent = {
            type: 'downgrade',
            perk: research,
            oldLevel,
            newLevel: targetLevel,
            pointsChanged: 0,
          };
        }

        return {
          success: true,
          updatedProfile: this.finalizeProfileUpdate(updatedProfile),
          changeEvent,
        };
      }

      return {
        success: false,
        error: `Perk "${perkName}" not found`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove perk',
      };
    }
  }

  /**
   * Calculate available perk points for both SL and AI systems
   */
  calculateAvailablePoints(profile: TinkerProfile): PerkPointCalculation {
    const cacheKey = `${profile.Character.Level}-${profile.Character.AlienLevel || 0}`;

    if (this.pointCalculationCache.has(cacheKey)) {
      return this.pointCalculationCache.get(cacheKey)!;
    }

    const standardTotal = calculateStandardPerkPoints(profile.Character.Level);
    const aiTotal = calculateAIPerkPoints(profile.Character.AlienLevel || 0);

    const calculation: PerkPointCalculation = {
      standardPoints: {
        total: standardTotal,
        formula:
          profile.Character.Level <= 200
            ? `Level ${profile.Character.Level}: ${Math.floor(profile.Character.Level / 10)} points`
            : `Level ${profile.Character.Level}: 20 + ${Math.min(profile.Character.Level - 200, 20)} = ${standardTotal} points`,
      },
      aiPoints: {
        total: aiTotal,
        formula: `AI Level ${profile.Character.AlienLevel || 0}: ${aiTotal} points`,
      },
    };

    this.pointCalculationCache.set(cacheKey, calculation);
    return calculation;
  }

  /**
   * Get aggregated effects from all equipped perks
   */
  getPerkEffects(profile: TinkerProfile): PerkEffectSummary {
    if (!profile.PerksAndResearch) {
      return {};
    }

    const cacheKey = this.generateEffectCacheKey(profile.PerksAndResearch);

    if (this.perkEffectCache.has(cacheKey)) {
      return this.perkEffectCache.get(cacheKey)!;
    }

    const effects: PerkEffectSummary = {};

    // Process all equipped perks (both SL/AI and LE research)
    const allPerks = [...profile.PerksAndResearch.perks, ...profile.PerksAndResearch.research];

    // TODO: This will need to be implemented once we have perk data in the database
    // For now, return empty effects
    // In a future implementation, this would:
    // 1. Look up each perk's spell_data in the database
    // 2. Parse the spell effects for stat modifications
    // 3. Aggregate effects by stat ID
    // 4. Return the final effect summary

    this.perkEffectCache.set(cacheKey, effects);
    return effects;
  }

  /**
   * Initialize a new perk system for a profile
   */
  private initializePerkSystem(profile: TinkerProfile): PerkSystem {
    const pointCalculation = this.calculateAvailablePoints(profile);

    return {
      perks: [],
      standardPerkPoints: {
        total: pointCalculation.standardPoints.total,
        spent: 0,
        available: pointCalculation.standardPoints.total,
      },
      aiPerkPoints: {
        total: pointCalculation.aiPoints.total,
        spent: 0,
        available: pointCalculation.aiPoints.total,
      },
      research: [],
      lastCalculated: new Date().toISOString(),
    };
  }

  /**
   * Finalize profile update with timestamp and cache invalidation
   */
  private finalizeProfileUpdate(profile: TinkerProfile): TinkerProfile {
    profile.updated = new Date().toISOString();
    if (profile.PerksAndResearch) {
      profile.PerksAndResearch.lastCalculated = new Date().toISOString();
    }

    // Clear caches since perk configuration changed
    this.perkEffectCache.clear();

    return profile;
  }

  /**
   * Generate cache key for perk effects
   */
  private generateEffectCacheKey(perkSystem: PerkSystem): string {
    const perkIds = perkSystem.perks.map((p) => `${p.name}-${p.level}`).sort();
    const researchIds = perkSystem.research.map((r) => `${r.name}-${r.level}`).sort();
    return [...perkIds, ...researchIds].join('|');
  }

  /**
   * Clear all caches (useful for testing or when game data changes)
   */
  clearCaches(): void {
    this.perkEffectCache.clear();
    this.pointCalculationCache.clear();
  }

  /**
   * Recalculate and update perk point totals based on current character level
   */
  recalculatePerkPoints(profile: TinkerProfile): TinkerProfile {
    if (!profile.PerksAndResearch) {
      return profile;
    }

    const updatedProfile = JSON.parse(JSON.stringify(profile)) as TinkerProfile;
    const pointCalculation = this.calculateAvailablePoints(updatedProfile);
    const perkSystem = updatedProfile.PerksAndResearch;

    // Update standard perk points
    const currentStandardSpent = perkSystem.standardPerkPoints.spent;
    perkSystem.standardPerkPoints.total = pointCalculation.standardPoints.total;
    perkSystem.standardPerkPoints.available = Math.max(
      0,
      pointCalculation.standardPoints.total - currentStandardSpent
    );

    // Update AI perk points
    const currentAISpent = perkSystem.aiPerkPoints.spent;
    perkSystem.aiPerkPoints.total = pointCalculation.aiPoints.total;
    perkSystem.aiPerkPoints.available = Math.max(
      0,
      pointCalculation.aiPoints.total - currentAISpent
    );

    return this.finalizeProfileUpdate(updatedProfile);
  }
}

// ============================================================================
// Export Default Instance
// ============================================================================

export const perkManager = new PerkManager();

// Export functions for standalone use
export {
  calculateStandardPerkPoints,
  calculateAIPerkPoints,
  getPerkCost,
  calculatePerkUpgradeCost,
  validatePerkRequirements,
};

/**
 * TinkerTools Item Validation Utility
 *
 * Functions for equipment requirement checking, item stat bonus calculations,
 * slot compatibility validation, and item classification logic.
 */

import {
  STAT,
  ITEM_CLASS,
  WEAPON_SLOT_POSITIONS,
  ARMOR_SLOT_POSITION,
  IMPLANT_SLOT_POSITION,
  PROFESSION,
  BREED,
} from '../services/game-data';
import {
  getStatName,
  getItemClassName,
  getProfessionName,
  getBreedName,
} from '../services/game-utils';
import { validateRequirements, type Character, type StatModifier } from './stat-calculations';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface Item {
  id: number;
  name: string;
  ql: number;
  itemClass: number;
  itemType: number;
  slot?: number;
  stats: ItemStat[];
  requirements?: ItemRequirement[];
  flags?: number;
  value?: number;
  mass?: number;
  attackTime?: number;
  rechargeTime?: number;
  range?: number;
  damage?: ItemDamage;
  description?: string;
}

export interface ItemStat {
  stat: number;
  value: number;
}

export interface ItemRequirement {
  stat: number;
  value: number;
  operator: string;
}

export interface ItemDamage {
  min: number;
  max: number;
  type?: number;
}

export interface EquipValidationResult {
  canEquip: boolean;
  reasons: string[];
  requiredStats?: Array<{ stat: number; required: number; current: number }>;
  slotConflicts?: string[];
  flagConflicts?: string[];
}

export interface ItemUsabilityResult {
  usable: boolean;
  effectiveness: number; // 0-100%
  issues: string[];
  recommendations: string[];
}

export interface EquipmentSet {
  weapons: Record<string, Item | null>;
  armor: Record<string, Item | null>;
  implants: Record<string, Item | null>;
}

export interface StatSummary {
  totalStats: Record<number, number>;
  bonuses: Record<number, number>;
  penalties: Record<number, number>;
  modifiers: StatModifier[];
}

// ============================================================================
// Equipment Validation
// ============================================================================

/**
 * Check if a character can equip an item
 */
export function validateItemEquipment(
  item: Item,
  character: Character,
  currentEquipment?: EquipmentSet
): EquipValidationResult {
  const reasons: string[] = [];
  let canEquip = true;

  // Check stat requirements
  const reqValidation = validateRequirements(character, item.requirements || []);
  if (!reqValidation.valid) {
    canEquip = false;
    reqValidation.failures.forEach((failure) => {
      const statName = getStatName(failure.stat) || `Stat ${failure.stat}`;
      reasons.push(`${statName}: ${failure.current}/${failure.required}`);
    });
  }

  // Check profession restrictions
  const professionIssues = checkProfessionRestrictions(item, character.profession);
  if (professionIssues.length > 0) {
    canEquip = false;
    reasons.push(...professionIssues);
  }

  // Check breed restrictions
  const breedIssues = checkBreedRestrictions(item, character.breed);
  if (breedIssues.length > 0) {
    canEquip = false;
    reasons.push(...breedIssues);
  }

  // Check slot conflicts
  const slotConflicts = checkSlotConflicts(item, currentEquipment);
  if (slotConflicts.length > 0) {
    reasons.push(...slotConflicts.map((conflict) => `Slot conflict: ${conflict}`));
  }

  // Check flag restrictions
  const flagConflicts = checkFlagRestrictions(item, character);
  if (flagConflicts.length > 0) {
    canEquip = false;
    reasons.push(...flagConflicts);
  }

  return {
    canEquip,
    reasons,
    requiredStats: reqValidation.failures,
    slotConflicts,
    flagConflicts,
  };
}

/**
 * Check profession restrictions for an item
 */
export function checkProfessionRestrictions(item: Item, professionId: number): string[] {
  const issues: string[] = [];

  // Check if item has profession flags or restrictions
  // This would typically involve checking item flags or specific profession requirements

  const professionName = getProfessionName(professionId);
  if (!professionName) {
    issues.push('Unknown profession');
    return issues;
  }

  // Example profession restrictions (would be based on actual item flags)
  const restrictedCombinations: Record<string, string[]> = {
    Doctor: [], // Doctors can use most items
    Soldier: [], // Soldiers have few restrictions
    MartialArtist: ['HeavyWeapons'], // MAs can't use heavy weapons effectively
    Engineer: [],
    NanoTechnician: ['MeleeWeapons'], // NTs prefer ranged/nano combat
    // Add more profession restrictions based on game rules
  };

  const restrictions = restrictedCombinations[professionName] || [];

  // Check item type against restrictions
  const itemClassName = getItemClassName(item.itemClass);
  if (restrictions.includes(itemClassName || '')) {
    issues.push(`${professionName} cannot use ${itemClassName} effectively`);
  }

  return issues;
}

/**
 * Check breed restrictions for an item
 */
export function checkBreedRestrictions(item: Item, breedId: number): string[] {
  const issues: string[] = [];

  // Most items don't have breed restrictions, but some special items might
  const breedName = getBreedName(breedId);
  if (!breedName) {
    issues.push('Unknown breed');
    return issues;
  }

  // Example: Some items might be restricted to specific breeds
  // This would be based on actual item flags or database restrictions

  return issues;
}

/**
 * Check for slot conflicts when equipping an item
 */
export function checkSlotConflicts(item: Item, currentEquipment?: EquipmentSet): string[] {
  const conflicts: string[] = [];

  if (!item.slot || !currentEquipment) {
    return conflicts;
  }

  // Determine slot category and check for conflicts
  const slotCategory = getItemSlotCategory(item);
  const slotName = getSlotName(item.slot, slotCategory);

  if (!slotName) {
    conflicts.push('Invalid slot assignment');
    return conflicts;
  }

  // Check if slot is already occupied
  switch (slotCategory) {
    case 'weapon':
      const currentWeapon = currentEquipment.weapons[slotName];
      if (currentWeapon) {
        conflicts.push(`${slotName} occupied by ${currentWeapon.name}`);
      }
      break;

    case 'armor':
      const currentArmor = currentEquipment.armor[slotName];
      if (currentArmor) {
        conflicts.push(`${slotName} occupied by ${currentArmor.name}`);
      }
      break;

    case 'implant':
      const currentImplant = currentEquipment.implants[slotName];
      if (currentImplant) {
        conflicts.push(`${slotName} occupied by ${currentImplant.name}`);
      }
      break;
  }

  return conflicts;
}

/**
 * Check flag-based restrictions
 */
export function checkFlagRestrictions(item: Item, character: Character): string[] {
  const issues: string[] = [];

  if (!item.flags) {
    return issues;
  }

  // Check common flag restrictions
  // These would be based on the actual flag definitions from the Python file

  // Example flag checks:
  const flags = item.flags;

  // Check unique flag (bit 27)
  if (flags & (1 << 27)) {
    // Check if character already has this unique item
    issues.push('Unique item - already owned');
  }

  // Check faction restrictions (would need faction flags)
  // Check level restrictions
  // Check expansion restrictions

  return issues;
}

// ============================================================================
// Item Usability Analysis
// ============================================================================

/**
 * Analyze how well a character can use an item
 */
export function analyzeItemUsability(item: Item, character: Character): ItemUsabilityResult {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let effectiveness = 100;

  // Check if character meets all requirements
  const validation = validateItemEquipment(item, character);
  if (!validation.canEquip) {
    effectiveness = 0;
    issues.push(...validation.reasons);

    // Add recommendations for missing requirements
    validation.requiredStats?.forEach((req) => {
      const statName = getStatName(req.stat) || `Stat ${req.stat}`;
      const deficit = req.required - req.current;
      recommendations.push(`Increase ${statName} by ${deficit}`);
    });

    return { usable: false, effectiveness, issues, recommendations };
  }

  // Check profession effectiveness
  const professionEffectiveness = calculateProfessionEffectiveness(item, character.profession);
  effectiveness *= professionEffectiveness / 100;

  if (professionEffectiveness < 100) {
    issues.push(
      `${getProfessionName(character.profession)} only ${professionEffectiveness}% effective with this item type`
    );
  }

  // Check if character is over-qualified (using low-QL gear)
  const qualityRating = analyzeItemQuality(item, character.level);
  if (qualityRating < 50) {
    issues.push('Item quality is too low for your level');
    recommendations.push('Consider upgrading to higher QL equipment');
  }

  // Check skill requirements vs current skills
  const skillAnalysis = analyzeSkillRequirements(item, character);
  if (skillAnalysis.efficiency < 100) {
    effectiveness *= skillAnalysis.efficiency / 100;
    issues.push(...skillAnalysis.issues);
    recommendations.push(...skillAnalysis.recommendations);
  }

  return {
    usable: true,
    effectiveness: Math.round(effectiveness),
    issues,
    recommendations,
  };
}

/**
 * Calculate how effectively a profession can use an item
 */
export function calculateProfessionEffectiveness(item: Item, professionId: number): number {
  const profession = getProfessionName(professionId);
  const itemClass = getItemClassName(item.itemClass);

  if (!profession || !itemClass) return 50;

  // Profession effectiveness with different item types
  const effectiveness: Record<string, Record<string, number>> = {
    Soldier: { Weapon: 100, Armor: 100, Implant: 80 },
    MartialArtist: { Weapon: 90, Armor: 85, Implant: 90 },
    Engineer: { Weapon: 70, Armor: 80, Implant: 100 },
    Fixer: { Weapon: 85, Armor: 75, Implant: 95 },
    Agent: { Weapon: 90, Armor: 80, Implant: 85 },
    Adventurer: { Weapon: 80, Armor: 85, Implant: 90 },
    Trader: { Weapon: 60, Armor: 70, Implant: 95 },
    Bureaucrat: { Weapon: 50, Armor: 75, Implant: 100 },
    Enforcer: { Weapon: 100, Armor: 100, Implant: 75 },
    Doctor: { Weapon: 60, Armor: 80, Implant: 100 },
    NanoTechnician: { Weapon: 70, Armor: 70, Implant: 100 },
    MetaPhysicist: { Weapon: 65, Armor: 75, Implant: 100 },
    Keeper: { Weapon: 75, Armor: 90, Implant: 95 },
    Shade: { Weapon: 95, Armor: 80, Implant: 85 },
  };

  return effectiveness[profession]?.[itemClass] || 70;
}

/**
 * Analyze item quality relative to character level
 */
export function analyzeItemQuality(item: Item, characterLevel: number): number {
  const expectedQL = Math.floor(characterLevel * 1.2); // Rough guideline
  const actualQL = item.ql;

  if (actualQL >= expectedQL) return 100;

  const qualityRatio = actualQL / expectedQL;
  return Math.round(qualityRatio * 100);
}

/**
 * Analyze skill requirements efficiency
 */
export function analyzeSkillRequirements(
  item: Item,
  character: Character
): { efficiency: number; issues: string[]; recommendations: string[] } {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let totalEfficiency = 100;

  // This would analyze how well the character's skills match the item's intended use
  // For weapons, check relevant weapon skills
  // For armor, check defensive skills
  // For implants, check implant-related skills

  const stats = character.baseStats || {};

  // Example: For weapons, check if character has good weapon skills
  if (item.itemClass === 1) {
    // Weapon
    const weaponSkills = [100, 101, 102, 103, 104, 105, 106, 107, 108]; // Combat skills
    const totalWeaponSkill = weaponSkills.reduce((sum, skill) => sum + (stats[skill] || 0), 0);
    const averageWeaponSkill = totalWeaponSkill / weaponSkills.length;

    const expectedSkill = item.ql * 0.8; // Rough guideline
    if (averageWeaponSkill < expectedSkill) {
      const efficiency = (averageWeaponSkill / expectedSkill) * 100;
      totalEfficiency *= efficiency / 100;
      issues.push('Weapon skills below recommended level');
      recommendations.push('Improve relevant weapon skills');
    }
  }

  return {
    efficiency: Math.round(totalEfficiency),
    issues,
    recommendations,
  };
}

// ============================================================================
// Stat Calculations
// ============================================================================

/**
 * Calculate total stat bonuses from equipment set
 */
export function calculateEquipmentStats(equipment: EquipmentSet): StatSummary {
  const totalStats: Record<number, number> = {};
  const bonuses: Record<number, number> = {};
  const penalties: Record<number, number> = {};
  const modifiers: StatModifier[] = [];

  // Combine all equipped items
  const allItems: Item[] = [
    ...Object.values(equipment.weapons),
    ...Object.values(equipment.armor),
    ...Object.values(equipment.implants),
  ].filter(Boolean) as Item[];

  // Process each item's stats
  for (const item of allItems) {
    for (const stat of item.stats) {
      const currentTotal = totalStats[stat.stat] || 0;
      totalStats[stat.stat] = currentTotal + stat.value;

      // Track bonuses vs penalties
      if (stat.value > 0) {
        bonuses[stat.stat] = (bonuses[stat.stat] || 0) + stat.value;
      } else {
        penalties[stat.stat] = (penalties[stat.stat] || 0) + Math.abs(stat.value);
      }

      // Create modifier record
      modifiers.push({
        stat: stat.stat,
        value: stat.value,
        type: 'flat',
        source: item.name,
      });
    }
  }

  return { totalStats, bonuses, penalties, modifiers };
}

/**
 * Calculate combat effectiveness from equipment
 */
export function calculateCombatEffectiveness(equipment: EquipmentSet): {
  offense: number;
  defense: number;
  accuracy: number;
  speed: number;
} {
  const stats = calculateEquipmentStats(equipment);

  // Calculate offense (damage, weapon skills)
  const offensiveStats = [
    276,
    278,
    279,
    280,
    281,
    282, // Damage modifiers
    100,
    101,
    102,
    103,
    104,
    105,
    106,
    107,
    108, // Weapon skills
  ];
  const offense = offensiveStats.reduce((sum, stat) => sum + (stats.totalStats[stat] || 0), 0);

  // Calculate defense (ACs, defensive skills)
  const defensiveStats = [
    90,
    91,
    92,
    93,
    94,
    95,
    96,
    97, // ACs
    152,
    153,
    154,
    155, // Defensive skills
  ];
  const defense = defensiveStats.reduce((sum, stat) => sum + (stats.totalStats[stat] || 0), 0);

  // Calculate accuracy (initiative, weapon skills)
  const accuracyStats = [118, 119, 120, 149]; // Initiative stats
  const accuracy = accuracyStats.reduce((sum, stat) => sum + (stats.totalStats[stat] || 0), 0);

  // Calculate speed (attack speed, run speed)
  const speedStats = [156, 374, 375]; // Run speed, recharge modifiers
  const speed = speedStats.reduce((sum, stat) => sum + (stats.totalStats[stat] || 0), 0);

  return { offense, defense, accuracy, speed };
}

/**
 * Find item upgrade suggestions
 */
export function findItemUpgrades(
  currentItem: Item,
  availableItems: Item[],
  character: Character
): Item[] {
  const upgrades: Item[] = [];

  for (const item of availableItems) {
    // Skip if not same item class or slot
    if (item.itemClass !== currentItem.itemClass || item.slot !== currentItem.slot) {
      continue;
    }

    // Skip if character can't use it
    const validation = validateItemEquipment(item, character);
    if (!validation.canEquip) {
      continue;
    }

    // Check if it's actually an upgrade
    if (isItemUpgrade(currentItem, item)) {
      upgrades.push(item);
    }
  }

  // Sort by upgrade value (higher QL first, then better stats)
  return upgrades.sort((a, b) => {
    const qlDiff = b.ql - a.ql;
    if (qlDiff !== 0) return qlDiff;

    // Compare total stat bonuses
    const aTotal = a.stats.reduce((sum, stat) => sum + Math.abs(stat.value), 0);
    const bTotal = b.stats.reduce((sum, stat) => sum + Math.abs(stat.value), 0);
    return bTotal - aTotal;
  });
}

/**
 * Check if an item is an upgrade over another
 */
export function isItemUpgrade(currentItem: Item, newItem: Item): boolean {
  // Higher QL is generally better
  if (newItem.ql > currentItem.ql) return true;
  if (newItem.ql < currentItem.ql) return false;

  // Same QL - compare stats
  const currentTotal = currentItem.stats.reduce((sum, stat) => sum + stat.value, 0);
  const newTotal = newItem.stats.reduce((sum, stat) => sum + stat.value, 0);

  return newTotal > currentTotal;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Determine slot category for an item
 */
export function getItemSlotCategory(item: Item): 'weapon' | 'armor' | 'implant' | 'unknown' {
  switch (item.itemClass) {
    case 1:
      return 'weapon';
    case 2:
      return 'armor';
    case 3:
      return 'implant';
    default:
      return 'unknown';
  }
}

/**
 * Get slot name from slot ID and category
 */
export function getSlotName(slotId: number, category: string): string | null {
  switch (category) {
    case 'weapon':
      return WEAPON_SLOT_POSITIONS[slotId as keyof typeof WEAPON_SLOT_POSITIONS] || null;
    case 'armor':
      return ARMOR_SLOT_POSITION[slotId as keyof typeof ARMOR_SLOT_POSITION] || null;
    case 'implant':
      return IMPLANT_SLOT_POSITION[slotId as keyof typeof IMPLANT_SLOT_POSITION] || null;
    default:
      return null;
  }
}

/**
 * Format item requirements for display
 */
export function formatItemRequirements(requirements: ItemRequirement[]): string[] {
  return requirements.map((req) => {
    const statName = getStatName(req.stat) || `Stat ${req.stat}`;
    return `${statName}: ${req.value}`;
  });
}

/**
 * Calculate item DPS (for weapons)
 */
export function calculateItemDPS(item: Item): number {
  if (!item.damage || !item.attackTime) return 0;

  const avgDamage = (item.damage.min + item.damage.max) / 2;
  const attacksPerSecond = 1000 / item.attackTime;

  return avgDamage * attacksPerSecond;
}

// ============================================================================
// Export utilities as a group
// ============================================================================

export const itemValidation = {
  // Validation
  validateItemEquipment,
  checkProfessionRestrictions,
  checkBreedRestrictions,
  checkSlotConflicts,
  checkFlagRestrictions,

  // Usability
  analyzeItemUsability,
  calculateProfessionEffectiveness,
  analyzeItemQuality,
  analyzeSkillRequirements,

  // Stats
  calculateEquipmentStats,
  calculateCombatEffectiveness,

  // Upgrades
  findItemUpgrades,
  isItemUpgrade,

  // Utilities
  getItemSlotCategory,
  getSlotName,
  formatItemRequirements,
  calculateItemDPS,
};

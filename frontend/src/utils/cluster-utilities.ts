/**
 * TinkerTools Cluster Mapping Utilities
 *
 * Utility functions for cluster operations including availability filtering,
 * validation, NP requirement calculations, Jobe cluster detection, and slot
 * name normalization.
 *
 * Part of TinkerPlants Revamp - Task 1.3
 */

import {
  IMP_SKILLS,
  IMP_SLOTS,
  IMP_SLOT_INDEX,
  NP_MODS,
  JOBE_SKILL,
  JOBE_MODS,
  CLUSTER_MIN_QL,
  type ImpSlotName,
  type ImpSlotKey,
  type ClusterType,
  type NPModKey,
  type JobeSkillKey
} from '../services/game-data';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of cluster configuration validation
 */
export interface ClusterValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Cluster NP requirement result
 */
export interface ClusterNPRequirement {
  npRequired: number;
  isJobe: boolean;
  jobeSkill?: string;
  skill: string;
  clusterType: ClusterType;
  ql: number;
}

/**
 * Available clusters for a slot and type
 */
export interface AvailableClusters {
  slot: ImpSlotName;
  type: ClusterType;
  clusters: string[];
  hasEmpty: boolean;
}

// ============================================================================
// Cluster Availability Functions
// ============================================================================

/**
 * Get available clusters for a specific slot and cluster type
 * Returns filtered IMP_SKILLS arrays with 'Empty' option included
 *
 * @param slotName - The implant slot name (e.g., 'Eye', 'Head', 'Leg')
 * @param clusterType - The cluster type ('Shiny', 'Bright', or 'Faded')
 * @returns Array of available cluster names including 'Empty'
 *
 * @example
 * ```typescript
 * const shinyClusters = getAvailableClusters('Eye', 'Shiny');
 * // Returns: ['Empty', 'Aimed Shot', 'Elec. Engi', 'Map Navig', ...]
 * ```
 */
export function getAvailableClusters(
  slotName: ImpSlotName,
  clusterType: ClusterType
): string[] {
  const slotSkills = IMP_SKILLS[slotName];

  if (!slotSkills) {
    console.warn(`Unknown slot name: ${slotName}`);
    return [];
  }

  const clusters = slotSkills[clusterType];

  if (!clusters) {
    console.warn(`Unknown cluster type: ${clusterType} for slot ${slotName}`);
    return [];
  }

  return [...clusters];
}

/**
 * Get available clusters with metadata
 *
 * @param slotName - The implant slot name
 * @param clusterType - The cluster type
 * @returns Object with slot, type, clusters array, and hasEmpty flag
 */
export function getAvailableClustersWithMetadata(
  slotName: ImpSlotName,
  clusterType: ClusterType
): AvailableClusters {
  const clusters = getAvailableClusters(slotName, clusterType);

  return {
    slot: slotName,
    type: clusterType,
    clusters,
    hasEmpty: clusters.includes('Empty')
  };
}

/**
 * Check if a specific cluster is available for a slot and type
 *
 * @param slotName - The implant slot name
 * @param clusterType - The cluster type
 * @param clusterName - The cluster name to check
 * @returns True if the cluster is available for the slot/type
 */
export function isClusterAvailableForSlot(
  slotName: ImpSlotName,
  clusterType: ClusterType,
  clusterName: string
): boolean {
  const availableSkills = IMP_SKILLS[slotName]?.[clusterType];
  return (availableSkills as readonly string[] | undefined)?.includes(clusterName) ?? false;
}

// ============================================================================
// Cluster Validation Functions
// ============================================================================

/**
 * Validate cluster configuration for a slot
 * Checks that each cluster (shiny, bright, faded) is valid for the specified slot
 *
 * @param slot - The implant slot name
 * @param shiny - The shiny cluster name (or 'Empty')
 * @param bright - The bright cluster name (or 'Empty')
 * @param faded - The faded cluster name (or 'Empty')
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```typescript
 * const result = validateClusterConfig('Eye', 'Rifle', 'Intelligence', 'Pistol');
 * if (!result.valid) {
 *   console.error('Invalid configuration:', result.errors);
 * }
 * ```
 */
export function validateClusterConfig(
  slot: ImpSlotName,
  shiny: string,
  bright: string,
  faded: string
): ClusterValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const slotSkills = IMP_SKILLS[slot];

  if (!slotSkills) {
    errors.push(`Unknown slot: ${slot}`);
    return { valid: false, errors, warnings };
  }

  // Validate shiny cluster
  if (shiny && shiny !== ('Empty' as string) && !(slotSkills.Shiny as readonly string[]).includes(shiny)) {
    errors.push(`Invalid shiny cluster '${shiny}' for slot ${slot}`);
  }

  // Validate bright cluster
  if (bright && bright !== ('Empty' as string) && !(slotSkills.Bright as readonly string[]).includes(bright)) {
    errors.push(`Invalid bright cluster '${bright}' for slot ${slot}`);
  }

  // Validate faded cluster
  if (faded && faded !== ('Empty' as string) && !(slotSkills.Faded as readonly string[]).includes(faded)) {
    errors.push(`Invalid faded cluster '${faded}' for slot ${slot}`);
  }

  // Warning if all clusters are empty
  if ((shiny === ('Empty' as string) || !shiny) &&
      (bright === ('Empty' as string) || !bright) &&
      (faded === ('Empty' as string) || !faded)) {
    warnings.push(`All clusters are empty for slot ${slot}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate that a cluster exists in NP_MODS or JOBE_SKILL
 *
 * @param cluster - The cluster name to validate
 * @returns True if the cluster is recognized
 */
export function isValidClusterName(cluster: string): boolean {
  if (!cluster || cluster === ('Empty' as string)) {
    return true;
  }

  return cluster in NP_MODS || cluster in JOBE_SKILL;
}

// ============================================================================
// NP Requirement Calculations
// ============================================================================

/**
 * Calculate Nano Programming requirement for a cluster
 * Handles both regular clusters (using NP_MODS) and Jobe clusters (using JOBE_SKILL)
 *
 * @param cluster - The cluster name
 * @param clusterType - The cluster type ('Shiny', 'Bright', 'Faded')
 * @param ql - The quality level of the implant
 * @returns NP requirement object with details
 *
 * @example
 * ```typescript
 * // Regular cluster
 * const req1 = getClusterNPRequirement('Strength', 'Shiny', 200);
 * // Returns: { npRequired: 900, isJobe: false, skill: 'Strength', ... }
 *
 * // Jobe cluster
 * const req2 = getClusterNPRequirement('Max NCU', 'Bright', 200);
 * // Returns: { npRequired: 950, isJobe: true, jobeSkill: 'Computer Literacy', ... }
 * ```
 */
export function getClusterNPRequirement(
  cluster: string,
  clusterType: ClusterType,
  ql: number
): ClusterNPRequirement {
  // Handle empty clusters
  if (!cluster || cluster === 'Empty') {
    return {
      npRequired: 0,
      isJobe: false,
      skill: cluster || 'Empty',
      clusterType,
      ql
    };
  }

  // Check if this is a Jobe cluster
  const isJobe = isJobeCluster(cluster);

  if (isJobe) {
    // Calculate Jobe cluster requirement
    const jobeSkill = JOBE_SKILL[cluster as JobeSkillKey];

    if (!jobeSkill) {
      throw new Error(`Unknown Jobe cluster: ${cluster}`);
    }

    // Special case for Nano Delta
    let slotMod: number;
    if (cluster === 'Nano Delta') {
      slotMod = clusterType === 'Shiny' ? 5.25 : clusterType === 'Bright' ? 4.0 : 2.75;
    } else {
      slotMod = JOBE_MODS[clusterType];
    }

    const skillRequired = Math.round(ql * slotMod);

    return {
      npRequired: skillRequired,
      isJobe: true,
      jobeSkill,
      skill: cluster,
      clusterType,
      ql
    };
  } else {
    // Calculate regular cluster NP requirement
    const npMod = NP_MODS[cluster as NPModKey];

    if (!npMod) {
      throw new Error(`Unknown cluster: ${cluster}`);
    }

    const slotMod = clusterType === 'Shiny' ? 2.0 : clusterType === 'Bright' ? 1.5 : 1.0;
    const npRequired = Math.round(npMod * ql * slotMod);

    return {
      npRequired,
      isJobe: false,
      skill: cluster,
      clusterType,
      ql
    };
  }
}

/**
 * Calculate minimum cluster QL needed to build an implant
 *
 * @param clusterType - The cluster type
 * @param targetQL - The target implant QL
 * @returns Minimum cluster QL required
 */
export function getMinimumClusterQL(clusterType: ClusterType, targetQL: number): number {
  const minQLRatio = CLUSTER_MIN_QL[clusterType];
  return Math.ceil(minQLRatio * targetQL);
}

// ============================================================================
// Jobe Cluster Detection
// ============================================================================

/**
 * Check if a cluster is a Jobe cluster
 * Jobe clusters require specific combining skills instead of Nano Programming
 *
 * @param cluster - The cluster name to check
 * @returns True if the cluster is a Jobe cluster
 *
 * @example
 * ```typescript
 * isJobeCluster('Max NCU')      // true
 * isJobeCluster('Strength')     // false
 * isJobeCluster('Add All Def.') // true
 * ```
 */
export function isJobeCluster(cluster: string): boolean {
  if (!cluster || cluster === 'Empty') {
    return false;
  }

  return cluster in JOBE_SKILL;
}

/**
 * Get the required combining skill for a Jobe cluster
 *
 * @param cluster - The Jobe cluster name
 * @returns The required combining skill name, or null if not a Jobe cluster
 *
 * @example
 * ```typescript
 * getJobeRequiredSkill('Max NCU')        // 'Computer Literacy'
 * getJobeRequiredSkill('Add All Def.')   // 'Psychology'
 * getJobeRequiredSkill('Strength')       // null (not a Jobe cluster)
 * ```
 */
export function getJobeRequiredSkill(cluster: string): string | null {
  if (!isJobeCluster(cluster)) {
    return null;
  }

  return JOBE_SKILL[cluster as JobeSkillKey] || null;
}

/**
 * Get all Jobe clusters as an array
 *
 * @returns Array of all Jobe cluster names
 */
export function getAllJobeClusters(): string[] {
  return Object.keys(JOBE_SKILL);
}

// ============================================================================
// Slot Name Normalization
// ============================================================================

/**
 * Normalize slot name to canonical form
 * Handles variations like:
 * - 'Right-Arm' vs 'Right arm'
 * - 'Leg' vs 'Legs'
 * - 'Chest' vs 'Body'
 *
 * @param inputName - The slot name to normalize (may be a variation)
 * @returns Canonical slot name from IMP_SLOTS, or null if invalid
 *
 * @example
 * ```typescript
 * normalizeSlotName('Right-Arm')  // 'Right-Arm'
 * normalizeSlotName('Right arm')  // 'Right-Arm'
 * normalizeSlotName('Legs')       // 'Leg'
 * normalizeSlotName('Body')       // 'Chest'
 * ```
 */
export function normalizeSlotName(inputName: string): ImpSlotName | null {
  if (!inputName) {
    return null;
  }

  // Check if it's already a canonical name
  if (IMP_SLOTS.includes(inputName as ImpSlotName)) {
    return inputName as ImpSlotName;
  }

  // Look up the slot index for this variation
  const index = IMP_SLOT_INDEX[inputName as ImpSlotKey];

  if (!index) {
    return null;
  }

  // Find the canonical name (first entry in IMP_SLOTS with this index)
  // IMP_SLOTS is 0-indexed, but IMP_SLOT_INDEX values are 1-indexed
  return IMP_SLOTS[index - 1] || null;
}

/**
 * Get all valid slot name variations for a canonical slot name
 *
 * @param canonicalName - The canonical slot name
 * @returns Array of all valid variations
 *
 * @example
 * ```typescript
 * getSlotNameVariations('Right-Arm')  // ['Right-Arm', 'Right arm']
 * getSlotNameVariations('Leg')        // ['Leg', 'Legs']
 * getSlotNameVariations('Chest')      // ['Chest', 'Body']
 * ```
 */
export function getSlotNameVariations(canonicalName: ImpSlotName): string[] {
  const variations: string[] = [];

  // Get the index for this canonical name
  const targetIndex = IMP_SLOT_INDEX[canonicalName];

  if (!targetIndex) {
    return [canonicalName];
  }

  // Find all keys with this index
  for (const [key, value] of Object.entries(IMP_SLOT_INDEX)) {
    if (value === targetIndex) {
      variations.push(key);
    }
  }

  return variations;
}

/**
 * Check if a slot name is valid (canonical or variation)
 *
 * @param slotName - The slot name to validate
 * @returns True if the slot name is recognized
 */
export function isValidSlotName(slotName: string): boolean {
  return normalizeSlotName(slotName) !== null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all slots where a cluster is available
 *
 * @param clusterName - The cluster name to search for
 * @returns Array of objects with slot name and available cluster types
 *
 * @example
 * ```typescript
 * const locations = getSlotsForCluster('Rifle');
 * // Returns: [
 * //   { slot: 'Eye', types: ['Shiny'] },
 * //   { slot: 'Right-Wrist', types: ['Bright'] },
 * //   ...
 * // ]
 * ```
 */
export function getSlotsForCluster(clusterName: string): Array<{
  slot: ImpSlotName;
  types: ClusterType[];
}> {
  if (!clusterName || clusterName === 'Empty') {
    return [];
  }

  const results: Array<{ slot: ImpSlotName; types: ClusterType[] }> = [];

  for (const slot of IMP_SLOTS) {
    const types: ClusterType[] = [];

    if ((IMP_SKILLS[slot].Shiny as readonly string[]).includes(clusterName)) {
      types.push('Shiny');
    }
    if ((IMP_SKILLS[slot].Bright as readonly string[]).includes(clusterName)) {
      types.push('Bright');
    }
    if ((IMP_SKILLS[slot].Faded as readonly string[]).includes(clusterName)) {
      types.push('Faded');
    }

    if (types.length > 0) {
      results.push({ slot, types });
    }
  }

  return results;
}

/**
 * Get all unique clusters across all slots and types
 *
 * @param includeEmpty - Whether to include 'Empty' in results (default: false)
 * @returns Array of unique cluster names
 */
export function getAllUniqueClusters(includeEmpty: boolean = false): string[] {
  const clusters = new Set<string>();

  for (const slot of IMP_SLOTS) {
    const slotSkills = IMP_SKILLS[slot];

    for (const cluster of slotSkills.Shiny) {
      clusters.add(cluster);
    }
    for (const cluster of slotSkills.Bright) {
      clusters.add(cluster);
    }
    for (const cluster of slotSkills.Faded) {
      clusters.add(cluster);
    }
  }

  const result = Array.from(clusters);

  if (!includeEmpty) {
    return result.filter(c => c !== 'Empty');
  }

  return result;
}

// ============================================================================
// Export utilities as a group
// ============================================================================

export const clusterUtilities = {
  // Availability
  getAvailableClusters,
  getAvailableClustersWithMetadata,
  isClusterAvailableForSlot,

  // Validation
  validateClusterConfig,
  isValidClusterName,

  // NP Requirements
  getClusterNPRequirement,
  getMinimumClusterQL,

  // Jobe Detection
  isJobeCluster,
  getJobeRequiredSkill,
  getAllJobeClusters,

  // Slot Normalization
  normalizeSlotName,
  getSlotNameVariations,
  isValidSlotName,

  // Utilities
  getSlotsForCluster,
  getAllUniqueClusters
};

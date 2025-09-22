/**
 * Perk System Types for TinkerProfiles
 *
 * Type definitions for the three perk systems in Anarchy Online:
 * - SL Perks: Cost standard perk points (earned through leveling)
 * - AI Perks: Cost AI perk points (earned through alien levels)
 * - LE Research: Free to assign (no point cost, only requirements)
 */

// ============================================================================
// Perk Entry Types
// ============================================================================

/** Individual perk entry for SL/AI perks that cost points */
export interface PerkEntry {
  aoid: number;         // Perk item ID (for the specific level)
  name: string;         // Perk name
  level: number;        // Current owned level (1-10)
  type: 'SL' | 'AI';    // Point type used
  item?: any;           // Complete item details (optional for backwards compatibility)
}

/** Research entry for LE perks that are free but requirement-based */
export interface ResearchEntry {
  aoid: number;         // Research item ID
  name: string;         // Research name
  level: number;        // Current level
  type: 'LE';           // Always LE for research
  item?: any;           // Complete item details (optional for backwards compatibility)
}

// ============================================================================
// Point Tracking Types
// ============================================================================

/** Standard perk points tracking (SL perks) */
export interface StandardPerkPoints {
  total: number;        // Total points based on character level
  spent: number;        // Points used on SL perks
  available: number;    // Remaining SL points
}

/** AI perk points tracking (AI perks) */
export interface AIPerkPoints {
  total: number;        // Total points based on AI level
  spent: number;        // Points used on AI perks
  available: number;    // Remaining AI points
}

// ============================================================================
// Perk System Container
// ============================================================================

/** Complete perk system with separate tracking for all three types */
export interface PerkSystem {
  perks: PerkEntry[];                    // SL and AI perks that cost points
  standardPerkPoints: StandardPerkPoints; // SL perk points tracking
  aiPerkPoints: AIPerkPoints;            // AI perk points tracking
  research: ResearchEntry[];             // LE research perks (free)
  lastCalculated: string;                // Timestamp of last calculation
}

// ============================================================================
// Validation and Calculation Types
// ============================================================================

/** Result of perk validation checks */
export interface PerkValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/** Perk requirements from database */
export interface PerkRequirement {
  level?: number;        // Character level requirement
  alienLevel?: number;   // AI level requirement (for AI perks)
  professions?: string[]; // Allowed professions
  breeds?: string[];     // Allowed breeds
  expansion?: string;    // Required expansion
}

/** Perk effect from spell data */
export interface PerkEffect {
  stat: number;          // Stat ID
  value: number;         // Modification value
  type: 'add' | 'multiply' | 'set'; // Effect type
}

/** Aggregated perk effects by stat */
export interface PerkEffectSummary {
  [statId: number]: number; // Total modification per stat
}

// ============================================================================
// Perk Data Types (from API/Database)
// ============================================================================

/** Perk type enumeration */
export type PerkType = 'SL' | 'AI' | 'LE';

/** Basic perk information from database */
export interface PerkInfo {
  aoid: number;
  name: string;
  level: number;         // Perk level (1-10)
  type: PerkType;
  cost: number;          // Point cost (0 for LE)
  requirements: PerkRequirement;
  effects: PerkEffect[];
}

/** Perk series (all levels of a perk) */
export interface PerkSeries {
  name: string;
  type: PerkType;
  levels: PerkInfo[];    // Array of all levels (1-10)
  requirements: PerkRequirement; // Base requirements
}

// ============================================================================
// Calculation Helper Types
// ============================================================================

/** Character data needed for perk calculations */
export interface PerkCharacterData {
  level: number;
  alienLevel?: number;
  profession: string;
  breed: string;
  expansion: string;
}

/** Point calculation results */
export interface PerkPointCalculation {
  standardPoints: {
    total: number;
    formula: string;     // Description of how calculated
  };
  aiPoints: {
    total: number;
    formula: string;
  };
}

// ============================================================================
// UI State Types
// ============================================================================

/** Perk selector state */
export interface PerkSelectorState {
  selectedType: PerkType;
  searchQuery: string;
  expandedCategories: Set<string>;
  filters: {
    profession?: string;
    breed?: string;
    minLevel?: number;
    maxLevel?: number;
    showOwned?: boolean;
  };
}

/** Perk purchase transaction */
export interface PerkPurchaseTransaction {
  perk: PerkInfo;
  fromLevel: number;
  toLevel: number;
  cost: number;
  pointType: 'SL' | 'AI';
  timestamp: string;
}

// ============================================================================
// Export Types for Convenience
// ============================================================================

/** Union type for all perk entries */
export type AnyPerkEntry = PerkEntry | ResearchEntry;

/** Perk modification event data */
export interface PerkChangeEvent {
  type: 'add' | 'remove' | 'upgrade' | 'downgrade';
  perk: AnyPerkEntry;
  oldLevel?: number;
  newLevel: number;
  pointsChanged: number;
}
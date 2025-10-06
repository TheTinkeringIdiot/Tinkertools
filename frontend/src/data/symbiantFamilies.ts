/**
 * Symbiant Family Mapping Module
 *
 * Provides static mappings between professions and their allowed symbiant families,
 * based on Anarchy Online game mechanics. This module is used by TinkerPocket
 * to filter symbiants by character profession.
 *
 * @see /home/quigley/projects/Tinkertools/.docs/plans/tinkerpocket/SYMBIANT_REFACTOR_PLAN.md Phase 5
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * The five symbiant family types in Anarchy Online
 * Each family provides different combat/support capabilities
 */
export type SymbiantFamily =
  | 'Artillery'
  | 'Control'
  | 'Extermination'
  | 'Infantry'
  | 'Support';

/**
 * All playable professions in Anarchy Online
 * Names use PascalCase to match game-data.ts PROFESSION constant
 */
export type Profession =
  | 'Adventurer'
  | 'Agent'
  | 'Bureaucrat'
  | 'Doctor'
  | 'Enforcer'
  | 'Engineer'
  | 'Fixer'
  | 'Keeper'
  | 'MartialArtist'
  | 'MetaPhysicist'
  | 'NanoTechnician'
  | 'Shade'
  | 'Soldier'
  | 'Trader';

// ============================================================================
// Profession → Family Mapping
// ============================================================================

/**
 * Maps each profession to the symbiant families they can equip
 *
 * Note: Shade cannot use symbiants (empty array)
 *
 * Based on official AO game mechanics:
 * - Artillery: Offensive damage-focused
 * - Control: Crowd control and debuffs
 * - Extermination: Damage over time and sustained DPS
 * - Infantry: Defensive and tanking
 * - Support: Healing and support
 */
export const professionFamilies: Record<Profession, SymbiantFamily[]> = {
  Adventurer: ['Artillery', 'Infantry', 'Support'],
  Agent: ['Artillery'],
  Bureaucrat: ['Control', 'Extermination'],
  Doctor: ['Support'],
  Enforcer: ['Infantry'],
  Engineer: ['Control'],
  Fixer: ['Artillery', 'Support'],
  Keeper: ['Infantry', 'Support'],
  MartialArtist: ['Infantry', 'Support'],
  MetaPhysicist: ['Control', 'Extermination'],
  NanoTechnician: ['Extermination'],
  Shade: [], // Shades cannot use symbiants
  Soldier: ['Artillery'],
  Trader: ['Artillery', 'Control', 'Support'],
};

// ============================================================================
// Constants
// ============================================================================

/**
 * Array of all symbiant families in the game
 * Useful for iteration and validation
 */
export const allFamilies: SymbiantFamily[] = [
  'Artillery',
  'Control',
  'Extermination',
  'Infantry',
  'Support',
];

/**
 * Human-readable descriptions of each symbiant family's role
 * Used for tooltips and UI display
 */
export const familyDescriptions: Record<SymbiantFamily, string> = {
  Artillery: 'Offensive damage-focused symbiants',
  Control: 'Crowd control and debuff symbiants',
  Extermination: 'Damage over time and sustained DPS',
  Infantry: 'Defensive and tanking symbiants',
  Support: 'Healing and support symbiants',
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the symbiant families allowed for a specific profession
 *
 * @param profession - The character's profession
 * @returns Array of allowed symbiant families (empty for Shade)
 *
 * @example
 * ```typescript
 * getFamiliesForProfession('Adventurer')
 * // Returns: ['Artillery', 'Infantry', 'Support']
 *
 * getFamiliesForProfession('Shade')
 * // Returns: []
 * ```
 */
export function getFamiliesForProfession(profession: Profession): SymbiantFamily[] {
  return professionFamilies[profession] || [];
}

/**
 * Check if a profession can equip a specific symbiant family
 *
 * @param profession - The character's profession
 * @param family - The symbiant family to check
 * @returns true if the profession can use this family, false otherwise
 *
 * @example
 * ```typescript
 * canProfessionUseFamily('Soldier', 'Artillery')
 * // Returns: true
 *
 * canProfessionUseFamily('Soldier', 'Support')
 * // Returns: false
 *
 * canProfessionUseFamily('Shade', 'Infantry')
 * // Returns: false (Shades can't use any symbiants)
 * ```
 */
export function canProfessionUseFamily(
  profession: Profession,
  family: SymbiantFamily
): boolean {
  return professionFamilies[profession]?.includes(family) || false;
}

/**
 * Get all professions that can equip a specific symbiant family
 *
 * Useful for displaying "usable by" information on symbiant details
 *
 * @param family - The symbiant family to check
 * @returns Array of professions that can use this family
 *
 * @example
 * ```typescript
 * getProfessionsForFamily('Artillery')
 * // Returns: ['Adventurer', 'Agent', 'Fixer', 'Soldier', 'Trader']
 *
 * getProfessionsForFamily('Support')
 * // Returns: ['Adventurer', 'Doctor', 'Fixer', 'Keeper', 'MartialArtist', 'Trader']
 * ```
 */
export function getProfessionsForFamily(family: SymbiantFamily): Profession[] {
  return Object.entries(professionFamilies)
    .filter(([_, families]) => families.includes(family))
    .map(([profession]) => profession as Profession);
}

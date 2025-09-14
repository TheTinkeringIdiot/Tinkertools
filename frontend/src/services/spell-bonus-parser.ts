/**
 * Spell Data Parser Utilities for Equipment Bonuses
 *
 * Parses spell_data from equipped items to extract stat bonuses.
 * Focuses on spell_id=53045 ("Modify Stat") and related spell types
 * that provide equipment-based character stat modifications.
 */

import { getSkillName } from '../lib/tinkerprofiles/skill-mappings';

// ============================================================================
// Types
// ============================================================================

/**
 * Spell data structure from item API
 */
interface SpellData {
  id: number;
  event: number;
  spells: Spell[];
}

/**
 * Individual spell within spell_data
 */
interface Spell {
  id: number;
  spell_id: number;
  spell_format?: string;
  spell_params: Record<string, any>;
  target?: number;
  tick_count?: number;
  tick_interval?: number;
}

/**
 * Parsed stat bonus from equipment
 */
export interface StatBonus {
  skillName: string;
  skillId: number;
  amount: number;
  spellId: number;
  itemSource?: string; // For debugging/display purposes
}

/**
 * Equipment bonus parsing result
 */
export interface BonusParseResult {
  bonuses: StatBonus[];
  errors: string[];
  totalParsed: number;
  totalSkipped: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Relevant spell events for equipment bonuses
 * - 14: Wear (armor, jewelry)
 * - 2: Wield (weapons)
 */
export const EQUIPMENT_EVENTS = [14, 2] as const;

/**
 * Spell IDs that provide stat bonuses
 * - 53045: "Modify {Stat} by {Amount}" (permanent stat bonus)
 * - 53012: "Modify {Stat} by {Amount}" (alternative format)
 * - 53014: "Modify {Stat} for {Duration}s by {Amount}" (timed bonus, but some equipment uses this)
 * - 53175: Additional stat modifier format (if exists)
 */
export const STAT_BONUS_SPELL_IDS = [53045, 53012, 53014, 53175] as const;

// ============================================================================
// Core Parsing Functions
// ============================================================================

/**
 * Parse spell data array from an equipped item to extract stat bonuses
 *
 * @param spellData Array of spell_data from item
 * @param itemName Optional item name for error reporting
 * @returns Parsed bonus result with bonuses and any errors
 */
export function parseItemSpellBonuses(
  spellData: SpellData[],
  itemName?: string
): BonusParseResult {
  const result: BonusParseResult = {
    bonuses: [],
    errors: [],
    totalParsed: 0,
    totalSkipped: 0
  };

  if (!spellData || !Array.isArray(spellData)) {
    result.errors.push(`Invalid spell data for item: ${itemName || 'unknown'}`);
    return result;
  }

  try {
    // Filter for relevant equipment events
    const relevantSpellData = spellData.filter(sd =>
      EQUIPMENT_EVENTS.includes(sd.event as any)
    );

    for (const spellDataEntry of relevantSpellData) {
      if (!spellDataEntry.spells || !Array.isArray(spellDataEntry.spells)) {
        result.errors.push(`Malformed spells array in spell_data ${spellDataEntry.id}`);
        result.totalSkipped++;
        continue;
      }

      // Filter for stat bonus spells
      const bonusSpells = spellDataEntry.spells.filter(spell =>
        STAT_BONUS_SPELL_IDS.includes(spell.spell_id as any)
      );

      for (const spell of bonusSpells) {
        try {
          const bonus = parseSpellStatBonus(spell, itemName);
          if (bonus) {
            result.bonuses.push(bonus);
            result.totalParsed++;
          } else {
            result.totalSkipped++;
          }
        } catch (error) {
          result.errors.push(
            `Error parsing spell ${spell.spell_id} from ${itemName || 'unknown item'}: ${error}`
          );
          result.totalSkipped++;
        }
      }
    }
  } catch (error) {
    result.errors.push(`Fatal error parsing spell data for ${itemName || 'unknown item'}: ${error}`);
  }

  return result;
}

/**
 * Parse a single spell to extract stat bonus information
 *
 * @param spell The spell object to parse
 * @param itemSource Optional source item name for debugging
 * @returns StatBonus if valid, null if not a stat bonus or malformed
 */
export function parseSpellStatBonus(
  spell: Spell,
  itemSource?: string
): StatBonus | null {
  if (!spell?.spell_params) {
    return null;
  }

  try {
    // Extract Stat and Amount from spell parameters
    const statParam = spell.spell_params.Stat;
    const amountParam = spell.spell_params.Amount;

    // Validate required parameters exist
    if (statParam === undefined || amountParam === undefined) {
      return null;
    }

    // Convert to numbers if they're strings
    const skillId = typeof statParam === 'string' ? parseInt(statParam, 10) : statParam;
    const amount = typeof amountParam === 'string' ? parseFloat(amountParam) : amountParam;

    // Validate numeric conversion
    if (isNaN(skillId) || isNaN(amount)) {
      return null;
    }

    // Convert skill ID to skill name
    const skillName = getSkillName(skillId);
    if (!skillName) {
      // Not all STAT IDs correspond to trainable skills, which is fine
      return null;
    }

    return {
      skillName,
      skillId,
      amount,
      spellId: spell.spell_id,
      itemSource
    };
  } catch (error) {
    // Log error but don't throw - continue processing other spells
    console.warn(`Error parsing spell ${spell.spell_id}:`, error);
    return null;
  }
}

/**
 * Aggregate stat bonuses by skill name, summing amounts for same skills
 *
 * @param bonuses Array of individual stat bonuses
 * @returns Record mapping skill names to total bonus amounts
 */
export function aggregateStatBonuses(bonuses: StatBonus[]): Record<string, number> {
  const aggregated: Record<string, number> = {};

  for (const bonus of bonuses) {
    if (aggregated[bonus.skillName]) {
      aggregated[bonus.skillName] += bonus.amount;
    } else {
      aggregated[bonus.skillName] = bonus.amount;
    }
  }

  return aggregated;
}

/**
 * Filter spell data for equipment-relevant events
 *
 * @param spellData Array of spell_data entries
 * @returns Filtered array containing only wear/wield events
 */
export function filterEquipmentEvents(spellData: SpellData[]): SpellData[] {
  if (!spellData || !Array.isArray(spellData)) {
    return [];
  }

  return spellData.filter(sd =>
    sd?.event !== undefined && EQUIPMENT_EVENTS.includes(sd.event as any)
  );
}

/**
 * Extract stat bonus spell entries from spell collections
 *
 * @param spellData Array of spell_data entries (should be pre-filtered for equipment events)
 * @returns Array of spells that provide stat bonuses
 */
export function extractStatBonusSpells(spellData: SpellData[]): Spell[] {
  const bonusSpells: Spell[] = [];

  for (const spellDataEntry of spellData) {
    if (!spellDataEntry.spells || !Array.isArray(spellDataEntry.spells)) {
      continue;
    }

    const relevantSpells = spellDataEntry.spells.filter(spell =>
      spell?.spell_id !== undefined &&
      STAT_BONUS_SPELL_IDS.includes(spell.spell_id as any)
    );

    bonusSpells.push(...relevantSpells);
  }

  return bonusSpells;
}

/**
 * Convert numeric STAT ID to skill name with error handling
 *
 * @param statId Numeric STAT ID from spell parameters
 * @returns Skill name if found, null if not a trainable skill
 */
export function convertStatIdToSkillName(statId: number | string): string | null {
  try {
    const id = typeof statId === 'string' ? parseInt(statId, 10) : statId;

    if (isNaN(id)) {
      return null;
    }

    return getSkillName(id);
  } catch (error) {
    console.warn(`Error converting STAT ID ${statId} to skill name:`, error);
    return null;
  }
}

/**
 * Validate spell data structure for basic consistency
 *
 * @param spellData Spell data to validate
 * @returns True if structure appears valid, false otherwise
 */
export function validateSpellDataStructure(spellData: any): spellData is SpellData[] {
  if (!Array.isArray(spellData)) {
    return false;
  }

  // Check basic structure of first few entries
  const sampleSize = Math.min(3, spellData.length);
  for (let i = 0; i < sampleSize; i++) {
    const entry = spellData[i];
    if (!entry || typeof entry.event !== 'number' || !Array.isArray(entry.spells)) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Debug helper to log spell parsing results
 *
 * @param result Bonus parse result to log
 * @param itemName Optional item name for context
 */
export function logParsingResult(result: BonusParseResult, itemName?: string): void {
  const context = itemName ? ` for ${itemName}` : '';

  console.group(`Spell Bonus Parsing${context}`);
  console.log(`Bonuses found: ${result.bonuses.length}`);
  console.log(`Total parsed: ${result.totalParsed}`);
  console.log(`Total skipped: ${result.totalSkipped}`);

  if (result.bonuses.length > 0) {
    console.table(result.bonuses);
  }

  if (result.errors.length > 0) {
    console.warn('Parsing errors:', result.errors);
  }

  console.groupEnd();
}

/**
 * Create a summary of all bonuses for display purposes
 *
 * @param bonuses Array of stat bonuses
 * @returns Human-readable summary string
 */
export function createBonusSummary(bonuses: StatBonus[]): string {
  if (bonuses.length === 0) {
    return 'No equipment bonuses found';
  }

  const aggregated = aggregateStatBonuses(bonuses);
  const summaryParts: string[] = [];

  for (const [skillName, amount] of Object.entries(aggregated)) {
    const sign = amount >= 0 ? '+' : '';
    summaryParts.push(`${skillName}: ${sign}${amount}`);
  }

  return summaryParts.join(', ');
}
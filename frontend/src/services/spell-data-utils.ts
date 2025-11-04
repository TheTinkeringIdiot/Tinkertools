/**
 * Spell Data Utility Functions
 *
 * Global utilities for formatting and displaying spell data throughout TinkerTools.
 * Handles event translations, parameter formatting, and spell text interpolation.
 */

import { TEMPLATE_EVENT, TARGET, SPELL_FORMATS } from './game-data';
import { getStatName, getFlagNameFromBit } from './game-utils';
import type { SpellData, Spell, Criterion } from '@/types/api';

// ============================================================================
// Type Definitions
// ============================================================================

export interface FormattedSpell {
  id: number;
  target?: number;
  targetName?: string;
  tickCount?: number;
  tickInterval?: number;
  spellId?: number;
  formattedText: string;
  parameters: FormattedParameter[];
  criteria: Criterion[];
  isHidden: boolean; // for tick_count = 1 or tick_interval = 0
}

export interface FormattedSpellData {
  id: number;
  event?: number;
  eventName?: string;
  spells: FormattedSpell[];
  displayPriority: number; // for sorting
}

export interface FormattedParameter {
  key: string;
  value: any;
  displayValue: string;
  type: 'link' | 'percentage' | 'stat' | 'number' | 'text';
  linkUrl?: string;
  color?: string;
}

// ============================================================================
// Event and Target Translation
// ============================================================================

/**
 * Get human-readable event name from TEMPLATE_EVENT
 */
export function getEventName(eventId: number): string {
  return TEMPLATE_EVENT[eventId as keyof typeof TEMPLATE_EVENT] || `Event ${eventId}`;
}

/**
 * Get human-readable target name from TARGET
 */
export function getTargetName(targetId: number): string {
  return TARGET[targetId as keyof typeof TARGET] || `Target ${targetId}`;
}

/**
 * Get display priority for event types (lower = shown first)
 */
export function getEventDisplayPriority(eventId: number): number {
  const priorityMap: Record<number, number> = {
    14: 1, // Wear
    2: 2, // Wield
    0: 3, // Use
    5: 4, // Hit
    10: 5, // Activate
    8: 6, // Effects
    7: 7, // Create
    // All others get priority 10
  };
  return priorityMap[eventId] || 10;
}

/**
 * Get spell format string from SPELL_FORMATS constant using spell_id
 */
export function getSpellFormat(spellId: number): string | undefined {
  return SPELL_FORMATS[spellId as keyof typeof SPELL_FORMATS];
}

// ============================================================================
// Parameter Formatting
// ============================================================================

/**
 * Format a spell parameter based on its type and key
 */
export function formatSpellParameter(key: string, value: any): FormattedParameter {
  const lowerKey = key.toLowerCase();

  // Handle NanoId and ItemId parameters - create links
  if (lowerKey.includes('nanoid') || lowerKey.includes('itemid')) {
    return {
      key,
      value,
      displayValue: `Item ${value}`, // Will be replaced with actual item name in component
      type: 'link',
      linkUrl: `/items/${value}`,
      color: 'text-blue-600',
    };
  }

  // Handle Chance parameters - convert to percentage
  if (lowerKey.includes('chance') || lowerKey === 'probability') {
    const percentage = typeof value === 'number' ? (value * 100).toFixed(1) : value;
    return {
      key,
      value,
      displayValue: `${percentage}%`,
      type: 'percentage',
      color: 'text-amber-600',
    };
  }

  // Handle stat-related parameters
  if (lowerKey.includes('stat') && typeof value === 'number') {
    const statName = getStatName(value);
    return {
      key,
      value,
      displayValue: statName || `Stat ${value}`,
      type: 'stat',
      color: 'text-emerald-600',
    };
  }

  // Handle numeric values
  if (typeof value === 'number') {
    return {
      key,
      value,
      displayValue: value.toLocaleString(),
      type: 'number',
      color: 'text-slate-600',
    };
  }

  // Default text handling
  return {
    key,
    value,
    displayValue: String(value),
    type: 'text',
    color: 'text-slate-600',
  };
}

/**
 * Format all parameters for a spell
 */
export function formatSpellParameters(spellParams: Record<string, any>): FormattedParameter[] {
  if (!spellParams) return [];

  return Object.entries(spellParams)
    .filter(([key, value]) => value !== null && value !== undefined)
    .map(([key, value]) => formatSpellParameter(key, value))
    .sort((a, b) => {
      // Sort by type priority: links first, then percentages, then stats, then others
      const typePriority = { link: 1, percentage: 2, stat: 3, number: 4, text: 5 };
      const aPriority = typePriority[a.type] || 999;
      const bPriority = typePriority[b.type] || 999;
      return aPriority - bPriority;
    });
}

// ============================================================================
// Spell Text Interpolation
// ============================================================================

/**
 * Interpolate spell format string with parameters
 * Handles {param} style placeholders and special formatting
 */
export function interpolateSpellText(format: string, params: Record<string, any>): string {
  if (!format) return '';

  let result = format;

  // Remove alignment/formatting tags
  result = result.replace(/\{\|right\|\}/g, '');
  result = result.replace(/\{\|left\|\}/g, '');
  result = result.replace(/\{\|\/right\|\}/g, '');
  result = result.replace(/\{\|\/left\|\}/g, '');

  // Handle {param} style placeholders
  result = result.replace(/\{(\w+)\}/g, (match, paramName) => {
    const value = params[paramName];
    if (value !== undefined && value !== null) {
      // Special handling for different parameter types
      if (
        paramName.toLowerCase().includes('nanoid') ||
        paramName.toLowerCase().includes('itemid')
      ) {
        // For NanoID/ItemID, we'll return a placeholder that will be replaced with a link in the component
        return `[LINK:${value}]`;
      } else if (paramName.toLowerCase().includes('chance')) {
        // For Chance, add % symbol after the value
        // The value is stored as the final percentage (0.25 means 0.25%, not 25%)
        return `${value}%`;
      } else if (paramName.toLowerCase().includes('stat') && typeof value === 'number') {
        // For Stat, display as stat name
        const statName = getStatName(value);
        return statName || `Stat ${value}`;
      } else if (paramName.toLowerCase().includes('bitnum') && typeof value === 'number') {
        // For BitNum, resolve to flag name using the Stat parameter
        const statId = params.Stat || params.stat;
        if (statId !== undefined && statId !== null) {
          return getFlagNameFromBit(statId, value);
        }
        return `Bit ${value}`;
      }
      return String(value);
    }
    return match; // Keep placeholder if no value
  });

  // Handle %s, %d, %f style placeholders with parameter array
  if (params.params && Array.isArray(params.params)) {
    let paramIndex = 0;
    result = result.replace(/%[sdf]/g, () => {
      if (paramIndex < params.params.length) {
        return String(params.params[paramIndex++]);
      }
      return '%?';
    });
  }

  return result;
}

/**
 * Generate fallback spell text when format string is not available
 */
export function generateFallbackSpellText(spell: FormattedSpell): string {
  const parts: string[] = [];

  if (spell.targetName && spell.targetName !== 'Self') {
    parts.push(`Target: ${spell.targetName}`);
  }

  if (spell.tickCount && spell.tickCount > 1) {
    parts.push(`${spell.tickCount} ticks`);
  }

  if (spell.tickInterval && spell.tickInterval > 0) {
    const seconds = (spell.tickInterval / 100).toFixed(1);
    parts.push(`every ${seconds}s`);
  }

  return parts.length > 0 ? parts.join(', ') : 'Effect';
}

// ============================================================================
// Main Formatting Functions
// ============================================================================

/**
 * Format a single spell for display
 */
export function formatSpell(spell: Spell): FormattedSpell {
  const targetName = spell.target ? getTargetName(spell.target) : undefined;
  const parameters = formatSpellParameters(spell.spell_params || {});

  // Determine if spell should be hidden (only hide if explicitly marked or has no useful data)
  // Most spells should be visible, even instant ones (tick_count = 1)
  const isHidden = false; // For now, show all spells

  // Generate formatted text using spell_id to look up format from SPELL_FORMATS
  let formattedText = '';
  const formatString = spell.spell_id ? getSpellFormat(spell.spell_id) : undefined;
  if (formatString) {
    // Combine spell parameters with spell fields for interpolation
    const interpolationParams = {
      ...spell.spell_params,
      // Add spell fields that may be referenced in format strings
      TickCount: spell.tick_count,
      TickInterval: spell.tick_interval,
      Target: spell.target,
      SpellId: spell.spell_id,
    };
    formattedText = interpolateSpellText(formatString, interpolationParams);
  }

  // Fallback if interpolation didn't work or no format string found
  if (!formattedText || formattedText === formatString) {
    formattedText = generateFallbackSpellText({
      id: spell.id,
      target: spell.target,
      targetName,
      tickCount: spell.tick_count,
      tickInterval: spell.tick_interval,
      spellId: spell.spell_id,
      formattedText: '',
      parameters,
      criteria: spell.criteria || [],
      isHidden,
    });
  }

  return {
    id: spell.id,
    target: spell.target,
    targetName,
    tickCount: spell.tick_count,
    tickInterval: spell.tick_interval,
    spellId: spell.spell_id,
    formattedText,
    parameters,
    criteria: spell.criteria || [],
    isHidden,
  };
}

/**
 * Format spell data for display
 */
export function formatSpellData(spellData: SpellData): FormattedSpellData {
  const eventName = spellData.event ? getEventName(spellData.event) : undefined;
  const displayPriority = spellData.event ? getEventDisplayPriority(spellData.event) : 10;

  const formattedSpells = spellData.spells.map(formatSpell);

  return {
    id: spellData.id,
    event: spellData.event,
    eventName,
    spells: formattedSpells,
    displayPriority,
  };
}

/**
 * Format multiple spell data entries and sort by priority
 */
export function formatSpellDataList(spellDataList: SpellData[]): FormattedSpellData[] {
  return spellDataList.map(formatSpellData).sort((a, b) => a.displayPriority - b.displayPriority);
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Get event icon for display
 */
export function getEventIcon(eventId: number): string {
  const iconMap: Record<number, string> = {
    0: '🔧', // Use
    2: '⚔️', // Wield
    5: '💥', // Hit
    7: '✨', // Create
    8: '🌟', // Effects
    10: '🔥', // Activate
    14: '👕', // Wear
    // Default
  };
  return iconMap[eventId] || '⚡';
}

/**
 * Get color class for event type
 */
export function getEventColor(eventId: number): string {
  const colorMap: Record<number, string> = {
    0: 'text-blue-600', // Use
    2: 'text-red-600', // Wield
    5: 'text-orange-600', // Hit
    7: 'text-purple-600', // Create
    8: 'text-indigo-600', // Effects
    10: 'text-green-600', // Activate
    14: 'text-teal-600', // Wear
  };
  return colorMap[eventId] || 'text-gray-600';
}

/**
 * Determine if spell data should be displayed in compact mode
 */
export function shouldUseCompactMode(spellDataList: FormattedSpellData[]): boolean {
  // Always use table mode for consistency
  return false;
}

/**
 * Get summary text for multiple spell data entries
 */
export function getSpellDataSummary(spellDataList: FormattedSpellData[]): string {
  const eventCount = spellDataList.length;
  const spellCount = spellDataList.reduce((sum, data) => sum + data.spells.length, 0);

  if (eventCount === 1) {
    return `${spellCount} effect${spellCount !== 1 ? 's' : ''}`;
  }

  return `${eventCount} events, ${spellCount} effects`;
}

// ============================================================================
// Export all functions
// ============================================================================

export const spellDataUtils = {
  // Translation functions
  getEventName,
  getTargetName,
  getEventDisplayPriority,
  getSpellFormat,

  // Parameter formatting
  formatSpellParameter,
  formatSpellParameters,

  // Text interpolation
  interpolateSpellText,
  generateFallbackSpellText,

  // Main formatting
  formatSpell,
  formatSpellData,
  formatSpellDataList,

  // Display helpers
  getEventIcon,
  getEventColor,
  shouldUseCompactMode,
  getSpellDataSummary,
};

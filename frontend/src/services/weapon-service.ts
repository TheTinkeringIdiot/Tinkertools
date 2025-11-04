/**
 * TinkerFite Weapon Service
 *
 * Phase 2: API Service Layer
 * Handles weapon data fetching and stat extraction
 */

import { apiClient } from './api-client';
import type { Item } from '@/types/api';
import type { WeaponAnalyzeRequest } from '@/types/weapon-analysis';
import { WEAPON_STAT_IDS } from '@/types/weapon-analysis';
import {
  generateCacheKey,
  getCachedWeapons,
  cacheWeapons,
} from './weapon-cache';

// ============================================================================
// API Calls
// ============================================================================

/**
 * Fetch weapons from backend based on character stats
 * Backend filters to ~200-1000 weapons using:
 * - Top 3 weapon skills
 * - QL range: level ± 50
 * - Breed, profession, faction requirements
 *
 * @param request Character data and top weapon skills
 * @returns Array of weapons matching filters
 */
export async function analyzeWeapons(request: WeaponAnalyzeRequest): Promise<Item[]> {
  const response = await apiClient.post<Item[]>('/weapons/analyze', request);
  // Backend returns array directly, not wrapped in ApiResponse
  return (response as unknown as Item[]) || [];
}

/**
 * Fetch weapons with caching layer
 * Caches backend results based on level, breed, profession, faction, top 3 weapon skills
 * Cache hit: <100ms, Cache miss: ~700ms (backend query)
 *
 * Performance metrics should always be recalculated by caller when profile changes
 *
 * @param request Character data and top weapon skills
 * @returns Array of weapons matching filters (cached or fresh)
 */
export async function analyzeWeaponsWithCache(request: WeaponAnalyzeRequest): Promise<Item[]> {
  const cacheKey = generateCacheKey(request);

  // Try cache first
  const cached = getCachedWeapons(cacheKey);
  if (cached) {
    return cached;
  }

  // Cache miss - fetch from backend
  console.log('[WeaponService] Cache miss, fetching from backend...');
  const startTime = performance.now();

  const weapons = await analyzeWeapons(request);

  const responseTime = performance.now() - startTime;
  console.log(`[WeaponService] Backend query: ${Math.round(responseTime)}ms, ${weapons.length} weapons`);

  // Cache the result
  cacheWeapons(cacheKey, weapons);

  return weapons;
}

// ============================================================================
// Weapon Stat Extraction
// ============================================================================

/**
 * Extract weapon-specific stats from Item.stats array
 * All stats are stored in the stats array with stat IDs
 *
 * @param item Item object with stats array
 * @returns Object with extracted weapon stats
 */
export function extractWeaponStats(item: Item): {
  minDamage?: number;
  maxDamage?: number;
  criticalBonus?: number;
  attackTime?: number; // centiseconds
  rechargeTime?: number; // centiseconds
  clipSize?: number;
  damageType?: number;
  ammoType?: number;
  burstRecharge?: number;
  fullAutoRecharge?: number;
  initiativeType?: number;
  arCap?: number;
} {
  const stats = item.stats || [];

  return {
    minDamage: stats.find((s) => s.stat === WEAPON_STAT_IDS.MIN_DAMAGE)?.value,
    maxDamage: stats.find((s) => s.stat === WEAPON_STAT_IDS.MAX_DAMAGE)?.value,
    criticalBonus: stats.find((s) => s.stat === WEAPON_STAT_IDS.CRITICAL_BONUS)?.value,
    attackTime: stats.find((s) => s.stat === WEAPON_STAT_IDS.ATTACK_DELAY)?.value,
    rechargeTime: stats.find((s) => s.stat === WEAPON_STAT_IDS.RECHARGE_DELAY)?.value,
    clipSize: stats.find((s) => s.stat === WEAPON_STAT_IDS.CLIP_SIZE)?.value,
    damageType: stats.find((s) => s.stat === WEAPON_STAT_IDS.DAMAGE_TYPE)?.value,
    ammoType: stats.find((s) => s.stat === WEAPON_STAT_IDS.AMMO_TYPE)?.value,
    burstRecharge: stats.find((s) => s.stat === WEAPON_STAT_IDS.BURST_RECHARGE)?.value,
    fullAutoRecharge: stats.find((s) => s.stat === WEAPON_STAT_IDS.FULL_AUTO_RECHARGE)?.value,
    initiativeType: stats.find((s) => s.stat === WEAPON_STAT_IDS.INITIATIVE_TYPE)?.value,
    arCap: stats.find((s) => s.stat === WEAPON_STAT_IDS.AR_CAP)?.value,
  };
}

/**
 * Extract attack stat percentages from item.attack_stats
 * Used for attack rating (AR) bonus calculations
 *
 * @param item Item object with attack_stats array
 * @returns Map of skill ID to percentage contribution
 */
export function extractAttackStats(item: Item): Record<number, number> {
  const attackStats: Record<number, number> = {};

  if (item.attack_stats && Array.isArray(item.attack_stats)) {
    for (const stat of item.attack_stats) {
      attackStats[stat.stat] = stat.value;
    }
  }

  return attackStats;
}

/**
 * Determine if an item is a weapon (has weapon stats)
 *
 * @param item Item object to check
 * @returns True if item has weapon stats (damage, attack time)
 */
export function isWeapon(item: Item): boolean {
  const stats = extractWeaponStats(item);
  return !!(stats.minDamage && stats.maxDamage && stats.attackTime && stats.rechargeTime);
}

/**
 * Get weapon type name from attack stats
 * Determines primary weapon skill from attack_stats percentages
 *
 * @param item Item object with attack_stats
 * @returns Weapon type name or "Unknown"
 */
export function getWeaponTypeName(item: Item): string {
  const attackStats = extractAttackStats(item);

  // Find highest contributing skill
  let maxPercent = 0;
  let primarySkill = 0;

  for (const [skillId, percent] of Object.entries(attackStats)) {
    if (percent > maxPercent) {
      maxPercent = percent;
      primarySkill = Number(skillId);
    }
  }

  // Map skill ID to weapon type name
  const WEAPON_TYPE_NAMES: Record<number, string> = {
    100: 'Martial Arts',
    101: 'Multi Melee',
    102: '1h Blunt',
    103: '1h Edged',
    104: 'Melee Energy',
    105: '2h Edged',
    106: 'Piercing',
    107: '2h Blunt',
    108: 'Sharp Objects',
    109: 'Grenade',
    110: 'Heavy Weapons',
    111: 'Bow',
    112: 'Pistol',
    113: 'Rifle',
    114: 'MG/SMG',
    115: 'Shotgun',
    116: 'Assault Rifle',
    133: 'Ranged Energy',
    134: 'Multi Ranged',
  };

  return WEAPON_TYPE_NAMES[primarySkill] || 'Unknown';
}

/**
 * Get damage type name from damage type stat
 *
 * @param damageType Damage type stat value
 * @returns Damage type name
 */
export function getDamageTypeName(damageType: number): string {
  const DAMAGE_TYPE_NAMES: Record<number, string> = {
    0: 'None',
    1: 'Melee',
    2: 'Energy',
    3: 'Chemical',
    4: 'Radiation',
    5: 'Cold',
    6: 'Poison',
    7: 'Fire',
    8: 'Projectile',
  };

  return DAMAGE_TYPE_NAMES[damageType] || 'Unknown';
}

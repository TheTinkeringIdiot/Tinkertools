/**
 * Profile Test Fixtures
 *
 * Factory functions for creating test profiles with proper v4.0.0 structure.
 * All profiles use numeric IDs for breeds, professions, and skills.
 *
 * @see /frontend/src/lib/tinkerprofiles/types.ts - TinkerProfile interface
 * @see /frontend/src/lib/tinkerprofiles/skill-mappings.ts - Skill ID mappings
 */

import type { TinkerProfile, SkillData } from '@/lib/tinkerprofiles/types';
import { SKILL_ID, createTestSkillData } from './skill-fixtures';

// ============================================================================
// Breed IDs (0-7)
// ============================================================================

export const BREED = {
  UNKNOWN: 0,
  SOLITUS: 1,
  OPIFEX: 2,
  NANOMAGE: 3,
  ATROX: 4,
  // 5-7: Reserved/NPC breeds
} as const;

// ============================================================================
// Profession IDs (1-15)
// ============================================================================

export const PROFESSION = {
  SOLDIER: 1,
  MARTIAL_ARTIST: 2,
  ENGINEER: 3,
  FIXER: 4,
  AGENT: 5,
  ADVENTURER: 6,
  TRADER: 7,
  BUREAUCRAT: 8,
  ENFORCER: 9,
  DOCTOR: 10,
  NANO_TECHNICIAN: 11,
  META_PHYSICIST: 12,
  KEEPER: 13,
  SHADE: 14,
  MONSTER: 15, // NPC profession
} as const;

// ============================================================================
// Profile Creation Factory
// ============================================================================

export interface ProfileCreationOptions {
  id?: string;
  name?: string;
  breed?: number;
  profession?: number;
  level?: number;
  faction?: string;
  expansion?: string;
  accountType?: string;
  alienLevel?: number;
  specialization?: number;
  skills?: Record<number, Partial<SkillData>>;
}

/**
 * Create a complete test profile with sensible defaults
 *
 * @example
 * // Create a level 220 Solitus Adventurer
 * const profile = createTestProfile({
 *   breed: BREED.SOLITUS,
 *   profession: PROFESSION.ADVENTURER,
 *   level: 220
 * });
 *
 * @example
 * // Create with custom skills
 * const profile = createTestProfile({
 *   skills: {
 *     [SKILL_ID.ASSAULT_RIF]: { pointsFromIp: 250, equipmentBonus: 50 }
 *   }
 * });
 */
export function createTestProfile(options: ProfileCreationOptions = {}): TinkerProfile {
  const {
    id = `test-profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name = 'Test Character',
    breed = BREED.SOLITUS,
    profession = PROFESSION.ADVENTURER,
    level = 100,
    faction = 'Neutral',
    expansion = 'All',
    accountType = 'Paid',
    alienLevel = 0,
    specialization = 0,
    skills = {},
  } = options;

  const now = new Date().toISOString();

  // Create base profile structure
  const profile: TinkerProfile = {
    id,
    version: '4.0.0',
    created: now,
    updated: now,

    Character: {
      Name: name,
      Level: level,
      Profession: profession,
      Breed: breed,
      Faction: faction,
      Expansion: expansion,
      AccountType: accountType,
      MaxHealth: 1000,
      MaxNano: 1000,
      AlienLevel: alienLevel,
      Specialization: specialization,
    },

    // Flat skill storage using numeric IDs
    skills: createDefaultSkills(skills, level),

    // Equipment slots
    Weapons: {},
    Clothing: {},
    Implants: {},

    // Perk system
    PerksAndResearch: {
      perks: [],
      standardPerkPoints: {
        total: 0,
        spent: 0,
        available: 0,
      },
      aiPerkPoints: {
        total: 0,
        spent: 0,
        available: 0,
      },
      research: [],
      lastCalculated: new Date().toISOString(),
    },

    // Buffs
    buffs: [],
  };

  return profile;
}

/**
 * Create default skills structure with optional overrides
 */
function createDefaultSkills(
  overrides: Record<number, Partial<SkillData>> = {},
  level: number = 100
): Record<number, SkillData> {
  const skills: Record<number, SkillData> = {};

  // Calculate realistic ability improvements based on level
  // Rough formula: level * 4 = IP improvements for abilities
  // This gives level 100 = 400 improvements (total 406), level 150 = 600 improvements (total 606)
  // For level 100: ~300 IP avg per ability * 6 abilities * 400 = ~7,200 IP of ~80,000 total (reasonable)
  // These values provide adequate skill caps for test scenarios (500-750 skill values)
  // Note: This is generous for testing, representing characters who heavily invest in abilities
  // which is common for nano-using professions to maximize skill caps via trickle-down
  const abilityImprovements = Math.floor(level * 4);
  const abilityTotal = 6 + abilityImprovements; // 6 base + improvements

  // Add all abilities with realistic values based on level
  Object.values(SKILL_ID).forEach((skillId) => {
    if (skillId >= 16 && skillId <= 21) {
      // Abilities (16-21)
      skills[skillId] = createTestSkillData({
        base: 6,
        pointsFromIp: abilityImprovements,
        total: abilityTotal,
        ...overrides[skillId],
      });
    }
  });

  // Always ensure MaxNCU exists with reasonable default
  // MaxNCU (stat 181) is a BONUS_ONLY_STAT_ID in ip-integrator
  // Formula: 1200 base + (level * 6) for game-accurate values
  if (!overrides[181]) {
    const maxNCUValue = Math.max(1200, level * 6);
    skills[181] = createTestSkillData({
      base: 0, // Bonus-only stats have no base
      total: maxNCUValue,
    });
  }

  // Apply any additional skill overrides
  Object.entries(overrides).forEach(([skillIdStr, override]) => {
    const skillId = parseInt(skillIdStr);
    if (!skills[skillId]) {
      skills[skillId] = createTestSkillData(override);
    }
  });

  return skills;
}

// ============================================================================
// Pre-configured Test Profiles
// ============================================================================

/**
 * Level 1 fresh character (minimal skills)
 */
export function createFreshProfile(options: Partial<ProfileCreationOptions> = {}): TinkerProfile {
  return createTestProfile({
    level: 1,
    skills: {
      // Abilities start at 6
      [SKILL_ID.STRENGTH]: { base: 6, total: 6 },
      [SKILL_ID.AGILITY]: { base: 6, total: 6 },
      [SKILL_ID.STAMINA]: { base: 6, total: 6 },
      [SKILL_ID.INTELLIGENCE]: { base: 6, total: 6 },
      [SKILL_ID.SENSE]: { base: 6, total: 6 },
      [SKILL_ID.PSYCHIC]: { base: 6, total: 6 },
    },
    ...options,
  });
}

/**
 * Level 220 endgame character (high skills)
 */
export function createEndgameProfile(options: Partial<ProfileCreationOptions> = {}): TinkerProfile {
  return createTestProfile({
    level: 220,
    alienLevel: 30,
    skills: {
      // High abilities
      [SKILL_ID.STRENGTH]: { base: 6, pointsFromIp: 500, equipmentBonus: 100, total: 606 },
      [SKILL_ID.AGILITY]: { base: 6, pointsFromIp: 500, equipmentBonus: 100, total: 606 },
      [SKILL_ID.STAMINA]: { base: 6, pointsFromIp: 500, equipmentBonus: 100, total: 606 },
      [SKILL_ID.INTELLIGENCE]: { base: 6, pointsFromIp: 500, equipmentBonus: 100, total: 606 },
      [SKILL_ID.SENSE]: { base: 6, pointsFromIp: 500, equipmentBonus: 100, total: 606 },
      [SKILL_ID.PSYCHIC]: { base: 6, pointsFromIp: 500, equipmentBonus: 100, total: 606 },
      // Common combat skills
      [SKILL_ID.ASSAULT_RIF]: {
        base: 5,
        trickle: 150,
        pointsFromIp: 800,
        equipmentBonus: 200,
        total: 1155,
      },
      [SKILL_ID.RANGED_INIT]: {
        base: 5,
        trickle: 150,
        pointsFromIp: 400,
        equipmentBonus: 100,
        total: 655,
      },
    },
    ...options,
  });
}

/**
 * Solitus Soldier - Tank build
 */
export function createSoldierProfile(options: Partial<ProfileCreationOptions> = {}): TinkerProfile {
  return createTestProfile({
    breed: BREED.SOLITUS,
    profession: PROFESSION.SOLDIER,
    level: 150,
    skills: {
      [SKILL_ID.STAMINA]: { base: 6, pointsFromIp: 300, equipmentBonus: 50, total: 356 },
      [SKILL_ID.STRENGTH]: { base: 6, pointsFromIp: 300, equipmentBonus: 50, total: 356 },
      [SKILL_ID.BODY_DEV]: {
        base: 5,
        trickle: 80,
        pointsFromIp: 500,
        equipmentBonus: 100,
        total: 685,
      },
      [SKILL_ID.ASSAULT_RIF]: {
        base: 5,
        trickle: 70,
        pointsFromIp: 600,
        equipmentBonus: 150,
        total: 825,
      },
    },
    ...options,
  });
}

/**
 * Nanomage Nano-Technician - Nano specialist
 */
export function createNanoTechProfile(
  options: Partial<ProfileCreationOptions> = {}
): TinkerProfile {
  return createTestProfile({
    breed: BREED.NANOMAGE,
    profession: PROFESSION.NANO_TECHNICIAN,
    level: 180,
    skills: {
      [SKILL_ID.INTELLIGENCE]: { base: 6, pointsFromIp: 400, equipmentBonus: 80, total: 486 },
      [SKILL_ID.PSYCHIC]: { base: 6, pointsFromIp: 400, equipmentBonus: 80, total: 486 },
      [SKILL_ID.NANO_POOL]: {
        base: 5,
        trickle: 120,
        pointsFromIp: 700,
        equipmentBonus: 200,
        total: 1025,
      },
      [SKILL_ID.MATTER_CREATION]: {
        base: 5,
        trickle: 100,
        pointsFromIp: 600,
        equipmentBonus: 150,
        total: 855,
      },
      [SKILL_ID.TIME_SPACE]: {
        base: 5,
        trickle: 100,
        pointsFromIp: 600,
        equipmentBonus: 150,
        total: 855,
      },
    },
    ...options,
  });
}

/**
 * Atrox Enforcer - Tank build
 */
export function createEnforcerProfile(
  options: Partial<ProfileCreationOptions> = {}
): TinkerProfile {
  return createTestProfile({
    breed: BREED.ATROX,
    profession: PROFESSION.ENFORCER,
    level: 200,
    skills: {
      [SKILL_ID.STAMINA]: { base: 6, pointsFromIp: 500, equipmentBonus: 100, total: 606 },
      [SKILL_ID.STRENGTH]: { base: 6, pointsFromIp: 500, equipmentBonus: 100, total: 606 },
      [SKILL_ID.BODY_DEV]: {
        base: 5,
        trickle: 150,
        pointsFromIp: 800,
        equipmentBonus: 200,
        total: 1155,
      },
      [SKILL_ID['1H_BLUNT']]: {
        base: 5,
        trickle: 120,
        pointsFromIp: 700,
        equipmentBonus: 180,
        total: 1005,
      },
    },
    ...options,
  });
}

/**
 * Opifex Fixer - Fast and agile
 */
export function createFixerProfile(options: Partial<ProfileCreationOptions> = {}): TinkerProfile {
  return createTestProfile({
    breed: BREED.OPIFEX,
    profession: PROFESSION.FIXER,
    level: 170,
    skills: {
      [SKILL_ID.AGILITY]: { base: 6, pointsFromIp: 400, equipmentBonus: 90, total: 496 },
      [SKILL_ID.SENSE]: { base: 6, pointsFromIp: 350, equipmentBonus: 80, total: 436 },
      [SKILL_ID.BREAK_ENTRY]: {
        base: 5,
        trickle: 100,
        pointsFromIp: 650,
        equipmentBonus: 170,
        total: 925,
      },
      [SKILL_ID.COMPUTER_LITERACY]: {
        base: 5,
        trickle: 90,
        pointsFromIp: 600,
        equipmentBonus: 160,
        total: 855,
      },
    },
    ...options,
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a minimal profile for testing without full structure
 * (useful for tests that only care about specific fields)
 */
export function createMinimalProfile(overrides: Partial<TinkerProfile> = {}): TinkerProfile {
  const base = createTestProfile();
  return {
    ...base,
    ...overrides,
  };
}

/**
 * Clone a profile for mutation testing
 */
export function cloneProfile(profile: TinkerProfile): TinkerProfile {
  return JSON.parse(JSON.stringify(profile));
}

/**
 * Set a skill value on a profile (helper for tests)
 */
export function setProfileSkill(
  profile: TinkerProfile,
  skillId: number,
  skillData: Partial<SkillData>
): TinkerProfile {
  const cloned = cloneProfile(profile);
  cloned.skills[skillId] = createTestSkillData({
    ...cloned.skills[skillId],
    ...skillData,
  });
  return cloned;
}

/**
 * Set multiple skills at once
 */
export function setProfileSkills(
  profile: TinkerProfile,
  skills: Record<number, Partial<SkillData>>
): TinkerProfile {
  let result = cloneProfile(profile);
  Object.entries(skills).forEach(([skillIdStr, skillData]) => {
    const skillId = parseInt(skillIdStr);
    result = setProfileSkill(result, skillId, skillData);
  });
  return result;
}

/**
 * Create a profile with only abilities set (useful for IP calculation tests)
 */
export function createProfileWithAbilities(
  abilities: [number, number, number, number, number, number],
  options: Partial<ProfileCreationOptions> = {}
): TinkerProfile {
  const [str, agi, sta, int, sen, psy] = abilities;
  return createTestProfile({
    skills: {
      [SKILL_ID.STRENGTH]: { base: str, total: str },
      [SKILL_ID.AGILITY]: { base: agi, total: agi },
      [SKILL_ID.STAMINA]: { base: sta, total: sta },
      [SKILL_ID.INTELLIGENCE]: { base: int, total: int },
      [SKILL_ID.SENSE]: { base: sen, total: sen },
      [SKILL_ID.PSYCHIC]: { base: psy, total: psy },
    },
    ...options,
  });
}

/**
 * Validate profile has proper v4.0.0 structure (helper for migration tests)
 */
export function isValidV4Profile(profile: any): profile is TinkerProfile {
  return (
    profile &&
    profile.version === '4.0.0' &&
    typeof profile.Character?.Breed === 'number' &&
    typeof profile.Character?.Profession === 'number' &&
    typeof profile.skills === 'object' &&
    // Check at least one skill is numeric ID
    Object.keys(profile.skills).some((key) => !isNaN(Number(key)))
  );
}

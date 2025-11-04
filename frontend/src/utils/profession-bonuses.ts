/**
 * TinkerTools Profession Bonuses Utility
 *
 * Functions for breed-specific modifiers, profession skill bonuses and caps,
 * title and faction calculations, and profession-specific game mechanics.
 */

import { PROFESSION, BREED, FACTION } from '../services/game-data';
import { getProfessionName, getBreedName, getFactionName } from '../services/game-utils';
import { type Character } from './stat-calculations';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface BreedModifiers {
  breed: number;
  attributeModifiers: Record<number, number>;
  skillModifiers: Record<number, number>;
  specialAbilities: string[];
  weaknesses: string[];
}

export interface ProfessionBonus {
  profession: number;
  skillCaps: Record<number, number>;
  nanoSchoolBonuses: Record<number, number>;
  specialAbilities: string[];
  primaryStats: number[];
  secondaryStats: number[];
}

export interface TitleBonus {
  titleLevel: number;
  statBonuses: Record<number, number>;
  requirements: Array<{ stat: number; value: number }>;
  description: string;
}

export interface FactionBenefit {
  faction: number;
  benefits: string[];
  penalties: string[];
  exclusiveItems: boolean;
  specialQuests: boolean;
}

// ============================================================================
// Breed-Specific Modifiers
// ============================================================================

/**
 * Get breed-specific attribute modifiers
 */
export function getBreedAttributeModifiers(breedId: number): Record<number, number> {
  const modifiers: Record<number, number> = {};

  switch (breedId) {
    case 1: // Solitus
      // Balanced breed - no special modifiers, all base stats at 15
      break;

    case 2: // Opifex
      modifiers[16] = -7; // Strength: 8 (15-7)
      modifiers[17] = +8; // Agility: 23 (15+8)
      modifiers[18] = -5; // Stamina: 10 (15-5)
      modifiers[19] = +3; // Intelligence: 18 (15+3)
      modifiers[20] = +3; // Sense: 18 (15+3)
      modifiers[21] = -2; // Psychic: 13 (15-2)
      break;

    case 3: // Nanomage
      modifiers[16] = -9; // Strength: 6 (15-9)
      modifiers[17] = -5; // Agility: 10 (15-5)
      modifiers[18] = -9; // Stamina: 6 (15-9)
      modifiers[19] = +10; // Intelligence: 25 (15+10)
      modifiers[20] = -2; // Sense: 13 (15-2)
      modifiers[21] = +15; // Psychic: 30 (15+15)
      break;

    case 4: // Atrox
      modifiers[16] = +10; // Strength: 25 (15+10)
      modifiers[17] = -5; // Agility: 10 (15-5)
      modifiers[18] = +10; // Stamina: 25 (15+10)
      modifiers[19] = -9; // Intelligence: 6 (15-9)
      modifiers[20] = -2; // Sense: 13 (15-2)
      modifiers[21] = -4; // Psychic: 11 (15-4)
      break;
  }

  return modifiers;
}

/**
 * Get breed-specific skill modifiers (percentage bonuses/penalties)
 */
export function getBreedSkillModifiers(breedId: number): Record<number, number> {
  const modifiers: Record<number, number> = {};

  switch (breedId) {
    case 1: // Solitus
      // Jack of all trades - small bonuses to utility skills
      modifiers[123] = 5; // FirstAid +5%
      modifiers[124] = 5; // Treatment +5%
      modifiers[161] = 5; // ComputerLiteracy +5%
      break;

    case 2: // Opifex
      // Agile and crafty
      modifiers[156] = 10; // RunSpeed +10%
      modifiers[165] = 15; // BreakingEntry +15%
      modifiers[135] = 10; // TrapDisarm +10%
      modifiers[164] = 10; // Concealment +10%
      modifiers[158] = 10; // WeaponSmithing +10%
      break;

    case 3: // Nanomage
      // Nano and mental specialists
      modifiers[160] = 20; // NanoProgramming +20%
      modifiers[161] = 15; // ComputerLiteracy +15%
      modifiers[162] = 15; // Psychology +15%
      modifiers[127] = 10; // MaterialMetamorphose +10%
      modifiers[128] = 10; // BiologicalMetamorphose +10%
      modifiers[129] = 15; // PsychologicalModification +15%
      modifiers[130] = 10; // MaterialCreation +10%
      modifiers[131] = 15; // SpaceTime +15%
      // Penalties to physical skills
      modifiers[100] = -15; // MartialArts -15%
      modifiers[102] = -20; // 1hBlunt -20%
      modifiers[103] = -20; // 1hEdged -20%
      modifiers[105] = -25; // 2hEdged -25%
      modifiers[107] = -25; // 2hBlunt -25%
      break;

    case 4: // Atrox
      // Physical powerhouses
      modifiers[100] = 15; // MartialArts +15%
      modifiers[102] = 20; // 1hBlunt +20%
      modifiers[103] = 15; // 1hEdged +15%
      modifiers[105] = 20; // 2hEdged +20%
      modifiers[107] = 25; // 2hBlunt +25%
      modifiers[142] = 20; // Brawl +20%
      modifiers[152] = 10; // BodyDevelopment +10%
      // Penalties to mental skills
      modifiers[160] = -20; // NanoProgramming -20%
      modifiers[161] = -15; // ComputerLiteracy -15%
      modifiers[162] = -15; // Psychology -15%
      modifiers[129] = -20; // PsychologicalModification -20%
      break;
  }

  return modifiers;
}

/**
 * Get breed special abilities and characteristics
 */
export function getBreedSpecialAbilities(breedId: number): {
  abilities: string[];
  weaknesses: string[];
  description: string;
} {
  switch (breedId) {
    case 1: // Solitus
      return {
        abilities: [
          'Balanced attribute distribution',
          'No major penalties',
          'Good all-around survivability',
          'Moderate skill bonuses',
        ],
        weaknesses: ['No specialized advantages', 'Lower maximum potential in specific areas'],
        description: 'The baseline human breed with balanced stats and versatility.',
      };

    case 2: // Opifex
      return {
        abilities: [
          'Exceptional agility and speed',
          'Superior crafting abilities',
          'Enhanced stealth capabilities',
          'Improved trap handling',
          'Better running speed',
        ],
        weaknesses: ['Low physical strength', 'Reduced health pool', 'Vulnerable in direct combat'],
        description: 'Agile and crafty breed excellent at stealth, speed, and technical skills.',
      };

    case 3: // Nanomage
      return {
        abilities: [
          'Highest nano/psychic potential',
          'Superior nano programming',
          'Enhanced mental skills',
          'Best nano efficiency',
          'Advanced metamorphosis abilities',
        ],
        weaknesses: [
          'Extremely low health',
          'Poor physical combat ability',
          'Very low stamina',
          'Vulnerable to physical attacks',
        ],
        description: 'Frail but incredibly powerful in nano-based abilities and mental skills.',
      };

    case 4: // Atrox
      return {
        abilities: [
          'Highest health pool',
          'Superior physical strength',
          'Excellent melee combat',
          'High damage resistance',
          'Best body development',
        ],
        weaknesses: [
          'Poor nano abilities',
          'Limited mental skills',
          'Slow movement',
          'Poor at technical skills',
        ],
        description: 'Massive and strong breed built for physical combat and survivability.',
      };

    default:
      return {
        abilities: [],
        weaknesses: [],
        description: 'Unknown breed',
      };
  }
}

// ============================================================================
// Profession-Specific Bonuses
// ============================================================================

/**
 * Get profession skill cap multipliers
 */
export function getProfessionSkillCaps(professionId: number): Record<number, number> {
  // These match the multipliers from stat-calculations.ts
  const multipliers: Record<number, number> = {};

  // Initialize all skills with base 1.0 multiplier
  const allSkills = [
    100,
    101,
    102,
    103,
    104,
    105,
    106,
    107,
    108, // Combat
    123,
    124,
    125,
    126,
    127,
    128,
    129,
    130,
    131, // Support
    160,
    161,
    162,
    163,
    164,
    165,
    166,
    167,
    168, // Trade/misc
  ];

  allSkills.forEach((skill) => {
    multipliers[skill] = 1.0;
  });

  // Apply profession-specific bonuses
  switch (professionId) {
    case 1: // Soldier
      multipliers[102] = 2.5; // 1hBlunt
      multipliers[103] = 2.5; // 1hEdged
      multipliers[105] = 2.5; // 2hEdged
      multipliers[107] = 2.5; // 2hBlunt
      multipliers[113] = 2.5; // Rifle
      multipliers[115] = 2.5; // Shotgun
      multipliers[116] = 2.5; // AssaultRifle
      multipliers[123] = 2.0; // FirstAid
      break;

    case 2: // MartialArtist
      multipliers[100] = 2.5; // MartialArts
      multipliers[142] = 2.5; // Brawl
      multipliers[144] = 2.0; // Dimach
      multipliers[143] = 2.0; // Riposte
      multipliers[111] = 2.0; // Bow
      break;

    case 3: // Engineer
      multipliers[125] = 2.5; // MechanicalEngineering
      multipliers[126] = 2.5; // ElectricalEngineering
      multipliers[158] = 2.0; // WeaponSmithing
      multipliers[161] = 2.0; // ComputerLiteracy
      break;

    case 4: // Fixer
      multipliers[165] = 2.5; // BreakingEntry
      multipliers[135] = 2.5; // TrapDisarm
      multipliers[164] = 2.0; // Concealment
      multipliers[156] = 2.0; // RunSpeed
      multipliers[112] = 2.0; // Pistol
      break;

    case 5: // Agent
      multipliers[112] = 2.5; // Pistol
      multipliers[146] = 2.5; // SneakAttack
      multipliers[147] = 2.0; // FastAttack
      multipliers[164] = 2.0; // Concealment
      multipliers[129] = 2.0; // PsychologicalModification
      break;

    case 6: // Adventurer
      multipliers[123] = 2.5; // FirstAid
      multipliers[137] = 2.5; // Adventuring
      multipliers[140] = 2.0; // MapNavigation
      multipliers[138] = 2.0; // Swimming
      break;

    case 7: // Trader
      multipliers[159] = 2.5; // Pharmaceuticals
      multipliers[163] = 2.5; // Chemistry
      multipliers[161] = 2.0; // ComputerLiteracy
      multipliers[162] = 2.0; // Psychology
      break;

    case 8: // Bureaucrat
      multipliers[162] = 2.5; // Psychology
      multipliers[129] = 2.5; // PsychologicalModification
      multipliers[141] = 2.0; // Tutoring
      break;

    case 9: // Enforcer
      multipliers[102] = 2.5; // 1hBlunt
      multipliers[107] = 2.5; // 2hBlunt
      multipliers[104] = 2.0; // MeleeEnergy
      multipliers[106] = 2.0; // Piercing
      break;

    case 10: // Doctor
      multipliers[123] = 2.5; // FirstAid
      multipliers[124] = 2.5; // Treatment
      multipliers[128] = 2.5; // BiologicalMetamorphose
      multipliers[159] = 2.0; // Pharmaceuticals
      break;

    case 11: // NanoTechnician
      multipliers[160] = 2.5; // NanoProgramming
      multipliers[161] = 2.5; // ComputerLiteracy
      multipliers[127] = 2.0; // MaterialMetamorphose
      multipliers[130] = 2.0; // MaterialCreation
      break;

    case 12: // MetaPhysicist
      multipliers[129] = 2.5; // PsychologicalModification
      multipliers[131] = 2.5; // SpaceTime
      multipliers[157] = 2.0; // QuantumFT
      break;

    case 14: // Keeper
      multipliers[123] = 2.0; // FirstAid
      multipliers[124] = 2.0; // Treatment
      multipliers[128] = 2.0; // BiologicalMetamorphose
      multipliers[129] = 2.0; // PsychologicalModification
      break;

    case 15: // Shade
      multipliers[106] = 2.5; // Piercing
      multipliers[103] = 2.5; // 1hEdged
      multipliers[146] = 2.0; // SneakAttack
      multipliers[164] = 2.0; // Concealment
      break;
  }

  return multipliers;
}

/**
 * Get profession nano school effectiveness
 */
export function getProfessionNanoEffectiveness(professionId: number): Record<number, number> {
  const effectiveness: Record<number, number> = {};

  switch (professionId) {
    case 1: // Soldier
      effectiveness[1] = 85; // Combat
      effectiveness[3] = 80; // Protection
      effectiveness[2] = 60; // Medical
      effectiveness[4] = 40; // Psi
      effectiveness[5] = 30; // Space
      break;

    case 2: // MartialArtist
      effectiveness[2] = 75; // Medical
      effectiveness[1] = 80; // Combat
      effectiveness[3] = 60; // Protection
      effectiveness[4] = 50; // Psi
      effectiveness[5] = 30; // Space
      break;

    case 3: // Engineer
      effectiveness[3] = 80; // Protection
      effectiveness[1] = 70; // Combat
      effectiveness[2] = 60; // Medical
      effectiveness[4] = 50; // Psi
      effectiveness[5] = 40; // Space
      break;

    case 4: // Fixer
      effectiveness[2] = 70; // Medical
      effectiveness[1] = 75; // Combat
      effectiveness[3] = 60; // Protection
      effectiveness[4] = 50; // Psi
      effectiveness[5] = 30; // Space
      break;

    case 5: // Agent
      effectiveness[4] = 80; // Psi
      effectiveness[1] = 85; // Combat
      effectiveness[2] = 50; // Medical
      effectiveness[3] = 60; // Protection
      effectiveness[5] = 40; // Space
      break;

    case 6: // Adventurer
      effectiveness[2] = 80; // Medical
      effectiveness[3] = 75; // Protection
      effectiveness[1] = 60; // Combat
      effectiveness[4] = 50; // Psi
      effectiveness[5] = 40; // Space
      break;

    case 7: // Trader
      effectiveness[2] = 75; // Medical
      effectiveness[3] = 70; // Protection
      effectiveness[4] = 60; // Psi
      effectiveness[1] = 40; // Combat
      effectiveness[5] = 30; // Space
      break;

    case 8: // Bureaucrat
      effectiveness[4] = 90; // Psi
      effectiveness[3] = 80; // Protection
      effectiveness[2] = 60; // Medical
      effectiveness[1] = 40; // Combat
      effectiveness[5] = 50; // Space
      break;

    case 9: // Enforcer
      effectiveness[1] = 90; // Combat
      effectiveness[3] = 85; // Protection
      effectiveness[2] = 50; // Medical
      effectiveness[4] = 40; // Psi
      effectiveness[5] = 30; // Space
      break;

    case 10: // Doctor
      effectiveness[2] = 100; // Medical
      effectiveness[3] = 80; // Protection
      effectiveness[1] = 40; // Combat
      effectiveness[4] = 60; // Psi
      effectiveness[5] = 30; // Space
      break;

    case 11: // NanoTechnician
      effectiveness[1] = 100; // Combat
      effectiveness[4] = 90; // Psi
      effectiveness[2] = 50; // Medical
      effectiveness[3] = 60; // Protection
      effectiveness[5] = 70; // Space
      break;

    case 12: // MetaPhysicist
      effectiveness[4] = 100; // Psi
      effectiveness[5] = 100; // Space
      effectiveness[1] = 70; // Combat
      effectiveness[2] = 40; // Medical
      effectiveness[3] = 50; // Protection
      break;

    case 14: // Keeper
      effectiveness[2] = 90; // Medical
      effectiveness[3] = 90; // Protection
      effectiveness[4] = 80; // Psi
      effectiveness[1] = 60; // Combat
      effectiveness[5] = 50; // Space
      break;

    case 15: // Shade
      effectiveness[1] = 90; // Combat
      effectiveness[4] = 85; // Psi
      effectiveness[2] = 50; // Medical
      effectiveness[3] = 60; // Protection
      effectiveness[5] = 40; // Space
      break;

    default:
      // Default moderate effectiveness for unknown professions
      effectiveness[1] = 50; // Combat
      effectiveness[2] = 50; // Medical
      effectiveness[3] = 50; // Protection
      effectiveness[4] = 50; // Psi
      effectiveness[5] = 50; // Space
      break;
  }

  return effectiveness;
}

/**
 * Get profession primary and secondary stats
 */
export function getProfessionStatPriorities(professionId: number): {
  primary: number[];
  secondary: number[];
  description: string;
} {
  switch (professionId) {
    case 1: // Soldier
      return {
        primary: [16, 18, 17], // Strength, Stamina, Agility
        secondary: [20, 19, 21], // Sense, Intelligence, Psychic
        description: 'Physical combat specialist requiring strength and stamina',
      };

    case 2: // MartialArtist
      return {
        primary: [17, 20, 16], // Agility, Sense, Strength
        secondary: [18, 19, 21], // Stamina, Intelligence, Psychic
        description: 'Agile fighter focused on speed and precision',
      };

    case 3: // Engineer
      return {
        primary: [19, 20, 17], // Intelligence, Sense, Agility
        secondary: [16, 18, 21], // Strength, Stamina, Psychic
        description: 'Technical specialist requiring intelligence and dexterity',
      };

    case 4: // Fixer
      return {
        primary: [17, 20, 19], // Agility, Sense, Intelligence
        secondary: [16, 18, 21], // Strength, Stamina, Psychic
        description: 'Fast and clever, excelling in stealth and technical skills',
      };

    case 5: // Agent
      return {
        primary: [17, 21, 20], // Agility, Psychic, Sense
        secondary: [19, 16, 18], // Intelligence, Strength, Stamina
        description: 'Covert operative blending physical and mental abilities',
      };

    case 6: // Adventurer
      return {
        primary: [18, 16, 20], // Stamina, Strength, Sense
        secondary: [17, 19, 21], // Agility, Intelligence, Psychic
        description: 'Versatile explorer with good survival skills',
      };

    case 7: // Trader
      return {
        primary: [19, 21, 20], // Intelligence, Psychic, Sense
        secondary: [17, 18, 16], // Agility, Stamina, Strength
        description: 'Social and technical specialist focused on mental abilities',
      };

    case 8: // Bureaucrat
      return {
        primary: [21, 19, 20], // Psychic, Intelligence, Sense
        secondary: [18, 17, 16], // Stamina, Agility, Strength
        description: 'Mental powerhouse specializing in crowd control',
      };

    case 9: // Enforcer
      return {
        primary: [16, 18, 20], // Strength, Stamina, Sense
        secondary: [17, 19, 21], // Agility, Intelligence, Psychic
        description: 'Tank profession focused on damage absorption',
      };

    case 10: // Doctor
      return {
        primary: [19, 21, 20], // Intelligence, Psychic, Sense
        secondary: [18, 17, 16], // Stamina, Agility, Strength
        description: 'Healer requiring high mental stats for nano efficiency',
      };

    case 11: // NanoTechnician
      return {
        primary: [19, 21, 20], // Intelligence, Psychic, Sense
        secondary: [17, 18, 16], // Agility, Stamina, Strength
        description: 'Nano combat specialist with high mental requirements',
      };

    case 12: // MetaPhysicist
      return {
        primary: [21, 19, 20], // Psychic, Intelligence, Sense
        secondary: [18, 17, 16], // Stamina, Agility, Strength
        description: 'Ultimate nano user requiring maximum psychic power',
      };

    case 14: // Keeper
      return {
        primary: [18, 21, 19], // Stamina, Psychic, Intelligence
        secondary: [16, 20, 17], // Strength, Sense, Agility
        description: 'Balanced support profession with good survivability',
      };

    case 15: // Shade
      return {
        primary: [17, 21, 16], // Agility, Psychic, Strength
        secondary: [20, 19, 18], // Sense, Intelligence, Stamina
        description: 'Stealthy assassin blending physical and psychic abilities',
      };

    default:
      return {
        primary: [16, 17, 18], // Strength, Agility, Stamina
        secondary: [19, 20, 21], // Intelligence, Sense, Psychic
        description: 'Unknown profession',
      };
  }
}

// ============================================================================
// Title and Organization Benefits
// ============================================================================

/**
 * Calculate title bonuses based on title level
 */
export function calculateTitleBonuses(titleLevel: number): TitleBonus[] {
  const bonuses: TitleBonus[] = [];

  // Title levels and their corresponding bonuses
  const titleData = [
    { level: 1, name: 'Neophyte', bonus: 2 },
    { level: 2, name: 'Experienced', bonus: 4 },
    { level: 3, name: 'Specialist', bonus: 6 },
    { level: 4, name: 'Expert', bonus: 8 },
    { level: 5, name: 'Master', bonus: 10 },
    { level: 6, name: 'Champion', bonus: 12 },
    { level: 7, name: 'Legend', bonus: 15 },
  ];

  for (const title of titleData) {
    if (titleLevel >= title.level) {
      bonuses.push({
        titleLevel: title.level,
        statBonuses: {
          // Title bonuses typically apply to all attributes
          16: title.bonus, // Strength
          17: title.bonus, // Agility
          18: title.bonus, // Stamina
          19: title.bonus, // Intelligence
          20: title.bonus, // Sense
          21: title.bonus, // Psychic
        },
        requirements: [
          { stat: 54, value: title.level * 50 }, // Level requirement
        ],
        description: `${title.name}: +${title.bonus} to all attributes`,
      });
    }
  }

  return bonuses;
}

/**
 * Get faction-specific benefits and penalties
 */
export function getFactionBenefits(factionId: number): FactionBenefit {
  switch (factionId) {
    case 0: // Neutral
      return {
        faction: factionId,
        benefits: [
          'Can trade with all factions',
          'Access to neutral-only areas',
          'No factional restrictions on items',
          'Can join either side in conflicts',
        ],
        penalties: [
          'No faction-specific bonuses',
          'Limited access to some faction quests',
          'No faction gear benefits',
        ],
        exclusiveItems: false,
        specialQuests: false,
      };

    case 1: // Clan
      return {
        faction: factionId,
        benefits: [
          'Access to Clan cities and areas',
          'Clan-specific equipment and nanos',
          'Clan research and upgrades',
          'Team-based organizational structure',
          'Better access to advanced technology',
        ],
        penalties: [
          'Cannot use Omni-specific items',
          'Restricted from Omni areas',
          'Target for Omni players in PvP',
        ],
        exclusiveItems: true,
        specialQuests: true,
      };

    case 2: // Omni
      return {
        faction: factionId,
        benefits: [
          'Access to Omni cities and areas',
          'Omni-specific equipment and nanos',
          'Corporate research benefits',
          'Advanced medical facilities',
          'Better access to nano technology',
        ],
        penalties: [
          'Cannot use Clan-specific items',
          'Restricted from Clan areas',
          'Target for Clan players in PvP',
        ],
        exclusiveItems: true,
        specialQuests: true,
      };

    default:
      return {
        faction: factionId,
        benefits: [],
        penalties: [],
        exclusiveItems: false,
        specialQuests: false,
      };
  }
}

// ============================================================================
// Combination Bonuses
// ============================================================================

/**
 * Calculate total character bonuses from breed, profession, and faction
 */
export function calculateCharacterBonuses(character: Character): {
  breedBonuses: Record<number, number>;
  professionBonuses: Record<number, number>;
  totalBonuses: Record<number, number>;
  specialAbilities: string[];
  effectiveSkillCaps: Record<number, number>;
} {
  const breedModifiers = getBreedAttributeModifiers(character.breed);
  const breedSkillModifiers = getBreedSkillModifiers(character.breed);
  const professionCaps = getProfessionSkillCaps(character.profession);

  // Combine breed attribute and skill modifiers
  const breedBonuses = { ...breedModifiers };
  Object.entries(breedSkillModifiers).forEach(([skill, bonus]) => {
    breedBonuses[Number(skill)] = (breedBonuses[Number(skill)] || 0) + bonus;
  });

  // Calculate profession bonuses (skill caps converted to effective bonuses)
  const professionBonuses: Record<number, number> = {};
  Object.entries(professionCaps).forEach(([skill, multiplier]) => {
    if (multiplier > 1.0) {
      // Convert multiplier to percentage bonus
      professionBonuses[Number(skill)] = Math.round((multiplier - 1.0) * 100);
    }
  });

  // Combine all bonuses
  const totalBonuses: Record<number, number> = {};
  const allSkills = new Set([...Object.keys(breedBonuses), ...Object.keys(professionBonuses)]);

  allSkills.forEach((skill) => {
    const skillNum = Number(skill);
    totalBonuses[skillNum] = (breedBonuses[skillNum] || 0) + (professionBonuses[skillNum] || 0);
  });

  // Get special abilities
  const breedAbilities = getBreedSpecialAbilities(character.breed);
  const professionPriorities = getProfessionStatPriorities(character.profession);

  const specialAbilities = [
    ...breedAbilities.abilities,
    `Primary stats: ${professionPriorities.primary.map((s) => s.toString()).join(', ')}`,
    professionPriorities.description,
  ];

  // Calculate effective skill caps at current level
  const effectiveSkillCaps: Record<number, number> = {};
  const baseCap = character.level * 6;
  Object.entries(professionCaps).forEach(([skill, multiplier]) => {
    effectiveSkillCaps[Number(skill)] = Math.floor(baseCap * multiplier);
  });

  return {
    breedBonuses,
    professionBonuses,
    totalBonuses,
    specialAbilities,
    effectiveSkillCaps,
  };
}

/**
 * Get recommended stat distribution for a breed/profession combination
 */
export function getRecommendedStatDistribution(
  breedId: number,
  professionId: number,
  level: number
): {
  recommendations: Record<number, number>;
  reasoning: string[];
  priorities: string[];
} {
  const breedModifiers = getBreedAttributeModifiers(breedId);
  const professionPriorities = getProfessionStatPriorities(professionId);
  const breedInfo = getBreedSpecialAbilities(breedId);

  const recommendations: Record<number, number> = {};
  const reasoning: string[] = [];
  const priorities: string[] = [];

  // Calculate base stats with breed modifiers
  const baseStats = {
    16: 15 + (breedModifiers[16] || 0), // Strength
    17: 15 + (breedModifiers[17] || 0), // Agility
    18: 15 + (breedModifiers[18] || 0), // Stamina
    19: 15 + (breedModifiers[19] || 0), // Intelligence
    20: 15 + (breedModifiers[20] || 0), // Sense
    21: 15 + (breedModifiers[21] || 0), // Psychic
  };

  // Calculate recommended distributions based on profession priorities
  const totalIPForLevel = Math.floor(level * 30); // Rough IP estimate
  let remainingIP = totalIPForLevel;

  // Prioritize primary stats
  professionPriorities.primary.forEach((stat, index) => {
    const currentBase = baseStats[stat];
    const targetBonus = Math.floor(level * (3 - index)); // Higher level = more investment

    if (remainingIP > targetBonus * 10) {
      // Rough IP cost estimate
      recommendations[stat] = currentBase + targetBonus;
      remainingIP -= targetBonus * 10;
      priorities.push(`${stat}: Primary stat for profession`);
    } else {
      recommendations[stat] = currentBase + Math.floor(remainingIP / 10);
      remainingIP = 0;
    }
  });

  // Add secondary stats with remaining IP
  professionPriorities.secondary.forEach((stat) => {
    const currentBase = baseStats[stat];
    const targetBonus = Math.floor(remainingIP / (professionPriorities.secondary.length * 10));

    if (targetBonus > 0) {
      recommendations[stat] = currentBase + targetBonus;
      priorities.push(`${stat}: Secondary stat`);
    } else {
      recommendations[stat] = currentBase;
    }
  });

  // Add reasoning based on breed characteristics
  reasoning.push(`${getBreedName(breedId)} provides: ${breedInfo.description}`);
  reasoning.push(`${getProfessionName(professionId)}: ${professionPriorities.description}`);

  if (breedInfo.abilities.length > 0) {
    reasoning.push(`Breed advantages: ${breedInfo.abilities.slice(0, 2).join(', ')}`);
  }

  if (breedInfo.weaknesses.length > 0) {
    reasoning.push(`Consider weaknesses: ${breedInfo.weaknesses.slice(0, 1).join(', ')}`);
  }

  return {
    recommendations,
    reasoning,
    priorities,
  };
}

// ============================================================================
// Export utilities as a group
// ============================================================================

export const professionBonuses = {
  // Breed functions
  getBreedAttributeModifiers,
  getBreedSkillModifiers,
  getBreedSpecialAbilities,

  // Profession functions
  getProfessionSkillCaps,
  getProfessionNanoEffectiveness,
  getProfessionStatPriorities,

  // Title and faction
  calculateTitleBonuses,
  getFactionBenefits,

  // Combination functions
  calculateCharacterBonuses,
  getRecommendedStatDistribution,
};

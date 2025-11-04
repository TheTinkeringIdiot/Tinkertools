/**
 * Item Test Fixtures
 *
 * Factory functions for creating test items with proper structure.
 * Supports items, weapons, armor, implants, and nano programs.
 *
 * @see /frontend/src/types/api.ts - Item interface
 */

import type { Item, StatValue, SpellData, Spell, Criterion, Action } from '@/types/api';
import { SKILL_ID } from './skill-fixtures';

// ============================================================================
// Item Creation Factory
// ============================================================================

export interface ItemCreationOptions {
  id?: number;
  aoid?: number;
  name?: string;
  ql?: number;
  description?: string;
  item_class?: number;
  is_nano?: boolean;
  stats?: StatValue[];
  spell_data?: SpellData[];
  actions?: Action[];
  attack_stats?: StatValue[];
  defense_stats?: StatValue[];
}

/**
 * Create a basic test item with sensible defaults
 *
 * @example
 * const item = createTestItem({
 *   name: 'Test Weapon',
 *   ql: 200,
 *   stats: [
 *     createStatValue(SKILL_ID.ASSAULT_RIF, 10),
 *     createStatValue(SKILL_ID.RANGED_INIT, 5)
 *   ]
 * });
 */
export function createTestItem(options: ItemCreationOptions = {}): Item {
  const {
    id = Math.floor(Math.random() * 1000000),
    aoid = Math.floor(Math.random() * 1000000),
    name = 'Test Item',
    ql = 100,
    description = 'A test item',
    item_class = 0,
    is_nano = false,
    stats = [],
    spell_data = [],
    actions = [],
    attack_stats = [],
    defense_stats = [],
  } = options;

  return {
    id,
    aoid,
    name,
    ql,
    description,
    item_class,
    is_nano,
    stats,
    spell_data,
    actions,
    attack_stats,
    defense_stats,
  };
}

// ============================================================================
// Stat Creation Helpers
// ============================================================================

/**
 * Create a StatValue object
 *
 * @example
 * const stat = createStatValue(SKILL_ID.ASSAULT_RIF, 10);
 * // Result: { id: 1, stat: 116, value: 10 }
 */
export function createStatValue(stat: number, value: number, id?: number): StatValue {
  return {
    id: id ?? Math.floor(Math.random() * 1000000),
    stat,
    value,
  };
}

/**
 * Create multiple stat values at once
 *
 * @example
 * const stats = createStatValues([
 *   [SKILL_ID.ASSAULT_RIF, 10],
 *   [SKILL_ID.RANGED_INIT, 5]
 * ]);
 */
export function createStatValues(entries: Array<[number, number]>): StatValue[] {
  return entries.map(([stat, value]) => createStatValue(stat, value));
}

// ============================================================================
// Spell Data Helpers
// ============================================================================

/**
 * Create a Criterion object
 */
export function createCriterion(
  value1: number,
  value2: number,
  operator: number = 0,
  id?: number
): Criterion {
  return {
    id: id ?? Math.floor(Math.random() * 1000000),
    value1,
    value2,
    operator,
  };
}

/**
 * Create a Spell object
 *
 * @example
 * const spell = createSpell({
 *   spell_id: 53045,
 *   spell_params: { stat: SKILL_ID.ASSAULT_RIF, amount: 10 }
 * });
 */
export function createSpell(options: Partial<Spell> = {}): Spell {
  const {
    id = Math.floor(Math.random() * 1000000),
    target,
    tick_count,
    tick_interval,
    spell_id,
    spell_params = {},
    criteria = [],
  } = options;

  return {
    id,
    target,
    tick_count,
    tick_interval,
    spell_id,
    spell_params,
    criteria,
  };
}

/**
 * Create a SpellData object with spells
 *
 * @example
 * const spellData = createSpellData({
 *   event: 1, // OnWear
 *   spells: [createSpell({ spell_id: 53045, spell_params: { ... } })]
 * });
 */
export function createSpellData(options: Partial<SpellData> = {}): SpellData {
  const { id = Math.floor(Math.random() * 1000000), event, spells = [] } = options;

  return {
    id,
    event,
    spells,
  };
}

// ============================================================================
// Action Helpers
// ============================================================================

/**
 * Create an Action object
 */
export function createAction(options: Partial<Action> = {}): Action {
  const { id = Math.floor(Math.random() * 1000000), action, item_id = 0, criteria = [] } = options;

  return {
    id,
    action,
    item_id,
    criteria,
  };
}

// ============================================================================
// Pre-configured Item Types
// ============================================================================

/**
 * Create a weapon with attack bonuses
 */
export function createWeaponItem(options: Partial<ItemCreationOptions> = {}): Item {
  return createTestItem({
    item_class: 1, // Weapon (fixed from 2)
    stats: [
      createStatValue(SKILL_ID.ASSAULT_RIF, 20),
      createStatValue(SKILL_ID.RANGED_INIT, 10),
      createStatValue(SKILL_ID.ADD_PROJ_DAM, 50),
    ],
    attack_stats: [createStatValue(SKILL_ID.ADD_PROJ_DAM, 50)],
    ...options,
  });
}

/**
 * Create armor with defense bonuses
 */
export function createArmorItem(options: Partial<ItemCreationOptions> = {}): Item {
  return createTestItem({
    item_class: 2, // Armor/Clothing (fixed from 3)
    stats: [
      createStatValue(SKILL_ID.PROJECTILE_AC, 500),
      createStatValue(SKILL_ID.MELEE_AC, 400),
      createStatValue(SKILL_ID.ENERGY_AC, 450),
    ],
    defense_stats: [
      createStatValue(SKILL_ID.PROJECTILE_AC, 500),
      createStatValue(SKILL_ID.MELEE_AC, 400),
    ],
    ...options,
  });
}

/**
 * Create an implant with stat bonuses
 */
export function createImplantItem(options: Partial<ItemCreationOptions> = {}): Item {
  return createTestItem({
    item_class: 10, // Implant
    stats: [
      createStatValue(SKILL_ID.STAMINA, 15),
      createStatValue(SKILL_ID.BODY_DEV, 50),
      createStatValue(SKILL_ID.MAX_HEALTH, 200),
    ],
    ...options,
  });
}

/**
 * Create a nano program
 */
export function createNanoItem(options: Partial<ItemCreationOptions> = {}): Item {
  const spellData = createSpellData({
    event: 1, // OnWear/OnCast
    spells: [
      createSpell({
        spell_id: 53045, // Modify Skill
        spell_params: { stat: SKILL_ID.ASSAULT_RIF, amount: 50 },
      }),
    ],
  });

  return createTestItem({
    is_nano: true,
    item_class: 11, // Nano
    spell_data: [spellData],
    ...options,
  });
}

/**
 * Create a buff item (perk, nano buff, etc.)
 */
export function createBuffItem(options: Partial<ItemCreationOptions> = {}): Item {
  const spellData = createSpellData({
    event: 1,
    spells: [
      createSpell({
        spell_id: 53045,
        spell_params: { stat: SKILL_ID.ASSAULT_RIF, amount: 100 },
      }),
    ],
  });

  return createTestItem({
    name: 'Test Buff',
    spell_data: [spellData],
    ...options,
  });
}

/**
 * Create a perk item with multiple spell effects
 */
export function createPerkItem(name: string, aoid: number, bonuses: Array<[number, number]>): Item {
  const spells = bonuses.map(([statId, amount]) =>
    createSpell({
      spell_id: 53045, // Modify Skill
      spell_params: { stat: statId, amount },
    })
  );

  const spellData = createSpellData({
    event: 1,
    spells,
  });

  return createTestItem({
    name,
    aoid,
    spell_data: [spellData],
  });
}

/**
 * Create an item with requirements
 */
export function createItemWithRequirements(
  requirements: Array<[number, number]>,
  options: Partial<ItemCreationOptions> = {}
): Item {
  const criteria = requirements.map(
    ([statId, value]) => createCriterion(statId, value, 0) // operator 0 = ">="
  );

  const action = createAction({
    action: 98, // Wear
    criteria,
  });

  return createTestItem({
    actions: [action],
    ...options,
  });
}

// ============================================================================
// Common Item Presets
// ============================================================================

/**
 * A high-QL rifle with requirements
 */
export function createHighQLRifle(): Item {
  return createWeaponItem({
    name: 'Test Rifle QL200',
    ql: 200,
    stats: [
      createStatValue(SKILL_ID.ASSAULT_RIF, 50),
      createStatValue(SKILL_ID.RANGED_INIT, 25),
      createStatValue(SKILL_ID.ADD_PROJ_DAM, 150),
    ],
  });
}

/**
 * A defensive armor set piece
 */
export function createDefensiveArmor(): Item {
  return createArmorItem({
    name: 'Test Armor QL180',
    ql: 180,
    stats: [
      createStatValue(SKILL_ID.PROJECTILE_AC, 800),
      createStatValue(SKILL_ID.MELEE_AC, 700),
      createStatValue(SKILL_ID.ENERGY_AC, 750),
      createStatValue(SKILL_ID.DODGE_RNG, 30),
    ],
  });
}

/**
 * A trader implant with buff skills
 */
export function createTraderImplant(): Item {
  return createImplantItem({
    name: 'Trader Implant QL150',
    ql: 150,
    stats: [
      createStatValue(SKILL_ID.INTELLIGENCE, 20),
      createStatValue(SKILL_ID.COMPUTER_LITERACY, 80),
      createStatValue(SKILL_ID.NANO_PROGRAMMING, 70),
    ],
  });
}

/**
 * A combat nano with damage buff
 */
export function createDamageBuffNano(): Item {
  return createNanoItem({
    name: 'Damage Enhancement Nano',
    ql: 180,
    spell_data: [
      createSpellData({
        event: 1,
        spells: [
          createSpell({
            spell_id: 53045,
            spell_params: { stat: SKILL_ID.ADD_ALL_OFF, amount: 200 },
          }),
        ],
      }),
    ],
  });
}

/**
 * An empty item (no bonuses) for control tests
 */
export function createEmptyItem(options: Partial<ItemCreationOptions> = {}): Item {
  return createTestItem({
    name: 'Empty Item',
    stats: [],
    spell_data: [],
    actions: [],
    ...options,
  });
}

// ============================================================================
// Item Collections
// ============================================================================

/**
 * Create a full equipment set
 */
export function createFullEquipmentSet(): Item[] {
  return [
    createHighQLRifle(),
    createDefensiveArmor(),
    createTraderImplant(),
    createArmorItem({ name: 'Helmet' }),
    createArmorItem({ name: 'Gloves' }),
    createArmorItem({ name: 'Boots' }),
  ];
}

/**
 * Create a set of combat-focused items
 */
export function createCombatItemSet(): Item[] {
  return [
    createWeaponItem({ name: 'Combat Rifle' }),
    createArmorItem({
      name: 'Combat Armor',
      stats: [
        createStatValue(SKILL_ID.PROJECTILE_AC, 600),
        createStatValue(SKILL_ID.RANGED_INIT, 20),
      ],
    }),
    createPerkItem('Combat Perk', 999001, [
      [SKILL_ID.ASSAULT_RIF, 50],
      [SKILL_ID.ADD_PROJ_DAM, 100],
    ]),
  ];
}

/**
 * Create a set of nano-focused items
 */
export function createNanoItemSet(): Item[] {
  return [
    createImplantItem({
      name: 'Nano Implant',
      stats: [createStatValue(SKILL_ID.INTELLIGENCE, 25), createStatValue(SKILL_ID.NANO_POOL, 100)],
    }),
    createNanoItem({
      name: 'Nano Enhancement',
      spell_data: [
        createSpellData({
          spells: [
            createSpell({
              spell_id: 53045,
              spell_params: { stat: SKILL_ID.MATTER_CREATION, amount: 80 },
            }),
          ],
        }),
      ],
    }),
  ];
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clone an item for mutation testing
 */
export function cloneItem(item: Item): Item {
  return JSON.parse(JSON.stringify(item));
}

/**
 * Add a stat to an existing item
 */
export function addStatToItem(item: Item, stat: number, value: number): Item {
  const cloned = cloneItem(item);
  cloned.stats.push(createStatValue(stat, value));
  return cloned;
}

/**
 * Extract all skill bonuses from an item (stats only, not spells)
 */
export function extractItemBonuses(item: Item): Record<number, number> {
  const bonuses: Record<number, number> = {};
  item.stats.forEach((stat) => {
    bonuses[stat.stat] = (bonuses[stat.stat] || 0) + stat.value;
  });
  return bonuses;
}

/**
 * Check if item has any skill bonuses
 */
export function hasSkillBonuses(item: Item): boolean {
  return item.stats.length > 0 || item.spell_data.length > 0;
}

/**
 * Get total bonus for a specific skill from an item
 */
export function getItemSkillBonus(item: Item, skillId: number): number {
  return item.stats.filter((s) => s.stat === skillId).reduce((sum, s) => sum + s.value, 0);
}

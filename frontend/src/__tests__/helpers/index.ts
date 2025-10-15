/**
 * Test Helpers Index
 *
 * Central export point for all test utilities and fixtures.
 * Import from this file to get all test helpers in one place.
 *
 * @example
 * import {
 *   createTestProfile,
 *   PROFESSION,
 *   BREED,
 *   SKILL_ID,
 *   createTestItem,
 *   mountWithContext
 * } from '@/__tests__/helpers';
 */

// Profile fixtures
export {
  createTestProfile,
  createFreshProfile,
  createEndgameProfile,
  createSoldierProfile,
  createNanoTechProfile,
  createEnforcerProfile,
  createFixerProfile,
  createMinimalProfile,
  cloneProfile,
  setProfileSkill,
  setProfileSkills,
  createProfileWithAbilities,
  isValidV4Profile,
  BREED,
  PROFESSION,
  type ProfileCreationOptions,
} from './profile-fixtures';

// Skill fixtures
export {
  SKILL_ID,
  ABILITY_ID,
  BODY_DEFENSE_SKILL_ID,
  MELEE_WEAPON_SKILL_ID,
  RANGED_WEAPON_SKILL_ID,
  RANGED_SPECIAL_SKILL_ID,
  INITIATIVE_SKILL_ID,
  TRADE_REPAIR_SKILL_ID,
  NANO_CASTING_SKILL_ID,
  COMBAT_HEALING_SKILL_ID,
  EXPLORING_SKILL_ID,
  AC_STAT_ID,
  MISC_SKILL_ID,
  createSkillBonuses,
  createTestSkillData,
  SKILL_COMBOS,
  isValidSkillId,
  getTestSkillName,
  type SkillData,
} from './skill-fixtures';

// Item fixtures
export {
  createTestItem,
  createStatValue,
  createStatValues,
  createCriterion,
  createSpell,
  createSpellData,
  createAction,
  createWeaponItem,
  createArmorItem,
  createImplantItem,
  createNanoItem,
  createBuffItem,
  createPerkItem,
  createItemWithRequirements,
  createHighQLRifle,
  createDefensiveArmor,
  createTraderImplant,
  createDamageBuffNano,
  createEmptyItem,
  createFullEquipmentSet,
  createCombatItemSet,
  createNanoItemSet,
  cloneItem,
  addStatToItem,
  extractItemBonuses,
  hasSkillBonuses,
  getItemSkillBonus,
  type ItemCreationOptions,
} from './item-fixtures';

// Vue test utilities
export {
  mountWithContext,
  createTestPinia,
  createTestRouter,
  mockPrimeVueComponents,
  flushPromises,
  wait,
  findByTestId,
  findAllByTestId,
  existsByTestId,
  getTextByTestId,
  resetAllStores,
  mockLocalStorage,
  setupLocalStorageMock,
  expectEmitted,
  expectToHaveClass,
  expectToBeVisible,
  standardCleanup,
  type MountOptions,
} from './vue-test-utils';

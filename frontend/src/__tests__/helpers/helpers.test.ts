/**
 * Test Helpers Validation
 *
 * Smoke tests to ensure all helper functions work correctly.
 * These tests validate the helper utilities themselves.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  // Profile fixtures
  createTestProfile,
  createFreshProfile,
  createEndgameProfile,
  BREED,
  PROFESSION,
  cloneProfile,
  setProfileSkill,
  isValidV4Profile,
  // Skill fixtures
  SKILL_ID,
  createSkillBonuses,
  createTestSkillData,
  SKILL_COMBOS,
  // Item fixtures
  createTestItem,
  createStatValue,
  createPerkItem,
  createWeaponItem,
  extractItemBonuses,
  // Vue utilities
  standardCleanup,
} from './index';

describe('Test Helpers Validation', () => {
  afterEach(() => {
    standardCleanup();
  });

  describe('Profile Fixtures', () => {
    it('should create valid v4.0.0 profile', () => {
      const profile = createTestProfile();

      expect(profile.version).toBe('4.0.0');
      expect(profile.id).toBeDefined();
      expect(profile.Character.Breed).toBe(BREED.SOLITUS);
      expect(profile.Character.Profession).toBe(PROFESSION.ADVENTURER);
      expect(typeof profile.Character.Breed).toBe('number');
      expect(typeof profile.Character.Profession).toBe('number');
    });

    it('should create fresh level 1 profile', () => {
      const profile = createFreshProfile();

      expect(profile.Character.Level).toBe(1);
      expect(profile.skills[SKILL_ID.STRENGTH].base).toBe(6);
      expect(profile.skills[SKILL_ID.STRENGTH].total).toBe(6);
    });

    it('should create endgame level 220 profile', () => {
      const profile = createEndgameProfile();

      expect(profile.Character.Level).toBe(220);
      expect(profile.Character.AlienLevel).toBe(30);
      expect(profile.skills[SKILL_ID.ASSAULT_RIF].total).toBeGreaterThan(1000);
    });

    it('should create profile with custom options', () => {
      const profile = createTestProfile({
        breed: BREED.ATROX,
        profession: PROFESSION.SOLDIER,
        level: 150,
        skills: {
          [SKILL_ID.ASSAULT_RIF]: { pointsFromIp: 500, equipmentBonus: 100 },
        },
      });

      expect(profile.Character.Breed).toBe(BREED.ATROX);
      expect(profile.Character.Profession).toBe(PROFESSION.SOLDIER);
      expect(profile.Character.Level).toBe(150);
      expect(profile.skills[SKILL_ID.ASSAULT_RIF].pointsFromIp).toBe(500);
      expect(profile.skills[SKILL_ID.ASSAULT_RIF].equipmentBonus).toBe(100);
    });

    it('should clone profile correctly', () => {
      const original = createTestProfile();
      const cloned = cloneProfile(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original); // Different object reference

      // Modify clone shouldn't affect original
      cloned.Character.Level = 999;
      expect(original.Character.Level).not.toBe(999);
    });

    it('should set skill on profile', () => {
      const profile = createTestProfile();
      const updated = setProfileSkill(profile, SKILL_ID.ASSAULT_RIF, {
        pointsFromIp: 300,
        equipmentBonus: 50,
      });

      expect(updated.skills[SKILL_ID.ASSAULT_RIF].pointsFromIp).toBe(300);
      expect(updated.skills[SKILL_ID.ASSAULT_RIF].equipmentBonus).toBe(50);
    });

    it('should validate v4 profile structure', () => {
      const validProfile = createTestProfile();
      expect(isValidV4Profile(validProfile)).toBe(true);

      const invalidProfile = { version: '3.0.0' };
      expect(isValidV4Profile(invalidProfile)).toBe(false);
    });
  });

  describe('Skill Fixtures', () => {
    it('should have correct skill ID constants', () => {
      expect(SKILL_ID.STRENGTH).toBe(16);
      expect(SKILL_ID.AGILITY).toBe(17);
      expect(SKILL_ID.ASSAULT_RIF).toBe(116);
      expect(SKILL_ID.DODGE_RNG).toBe(154);
      expect(SKILL_ID.BODY_DEV).toBe(152);
      expect(SKILL_ID.NANO_POOL).toBe(132);
    });

    it('should create skill bonuses object', () => {
      const bonuses = createSkillBonuses([
        [SKILL_ID.ASSAULT_RIF, 10],
        [SKILL_ID.DODGE_RNG, 5],
      ]);

      expect(bonuses).toEqual({
        [SKILL_ID.ASSAULT_RIF]: 10,
        [SKILL_ID.DODGE_RNG]: 5,
      });
    });

    it('should create test skill data with defaults', () => {
      const skill = createTestSkillData();

      expect(skill.base).toBe(5);
      expect(skill.trickle).toBe(0);
      expect(skill.ipSpent).toBe(0);
      expect(skill.pointsFromIp).toBe(0);
      expect(skill.equipmentBonus).toBe(0);
      expect(skill.perkBonus).toBe(0);
      expect(skill.buffBonus).toBe(0);
      expect(skill.total).toBe(5);
    });

    it('should create test skill data with overrides', () => {
      const skill = createTestSkillData({
        base: 5,
        trickle: 100,
        pointsFromIp: 250,
        equipmentBonus: 50,
        perkBonus: 25,
      });

      expect(skill.base).toBe(5);
      expect(skill.trickle).toBe(100);
      expect(skill.pointsFromIp).toBe(250);
      expect(skill.equipmentBonus).toBe(50);
      expect(skill.perkBonus).toBe(25);
      expect(skill.total).toBe(430); // Auto-calculated
    });

    it('should have pre-configured skill combos', () => {
      expect(SKILL_COMBOS.COMBAT).toBeDefined();
      expect(SKILL_COMBOS.DEFENSE).toBeDefined();
      expect(SKILL_COMBOS.NANO).toBeDefined();
      expect(SKILL_COMBOS.TRADE).toBeDefined();
      expect(SKILL_COMBOS.EMPTY).toEqual({});
    });
  });

  describe('Item Fixtures', () => {
    it('should create basic test item', () => {
      const item = createTestItem({
        name: 'Test Weapon',
        ql: 200,
      });

      expect(item.name).toBe('Test Weapon');
      expect(item.ql).toBe(200);
      expect(item.id).toBeDefined();
      expect(item.aoid).toBeDefined();
    });

    it('should create stat value', () => {
      const stat = createStatValue(SKILL_ID.ASSAULT_RIF, 10);

      expect(stat.stat).toBe(SKILL_ID.ASSAULT_RIF);
      expect(stat.value).toBe(10);
      expect(stat.id).toBeDefined();
    });

    it('should create weapon item with bonuses', () => {
      const weapon = createWeaponItem({
        name: 'Combat Rifle',
        ql: 180,
      });

      expect(weapon.name).toBe('Combat Rifle');
      expect(weapon.item_class).toBe(2); // Weapon
      expect(weapon.stats.length).toBeGreaterThan(0);

      // Should have assault rifle bonus
      const hasAssaultRif = weapon.stats.some((s) => s.stat === SKILL_ID.ASSAULT_RIF);
      expect(hasAssaultRif).toBe(true);
    });

    it('should create perk item with multiple bonuses', () => {
      const perk = createPerkItem('Test Perk', 999001, [
        [SKILL_ID.ASSAULT_RIF, 50],
        [SKILL_ID.RANGED_INIT, 25],
      ]);

      expect(perk.name).toBe('Test Perk');
      expect(perk.aoid).toBe(999001);
      expect(perk.spell_data.length).toBe(1);
      expect(perk.spell_data[0].spells.length).toBe(2);
    });

    it('should extract item bonuses', () => {
      const item = createTestItem({
        stats: [
          createStatValue(SKILL_ID.ASSAULT_RIF, 10),
          createStatValue(SKILL_ID.DODGE_RNG, 5),
        ],
      });

      const bonuses = extractItemBonuses(item);

      expect(bonuses).toEqual({
        [SKILL_ID.ASSAULT_RIF]: 10,
        [SKILL_ID.DODGE_RNG]: 5,
      });
    });
  });

  describe('Breed and Profession Constants', () => {
    it('should have correct breed IDs', () => {
      expect(BREED.SOLITUS).toBe(1);
      expect(BREED.OPIFEX).toBe(2);
      expect(BREED.NANOMAGE).toBe(3);
      expect(BREED.ATROX).toBe(4);
    });

    it('should have correct profession IDs', () => {
      expect(PROFESSION.SOLDIER).toBe(1);
      expect(PROFESSION.MARTIAL_ARTIST).toBe(2);
      expect(PROFESSION.ENGINEER).toBe(3);
      expect(PROFESSION.FIXER).toBe(4);
      expect(PROFESSION.AGENT).toBe(5);
      expect(PROFESSION.ADVENTURER).toBe(6);
      expect(PROFESSION.TRADER).toBe(7);
      expect(PROFESSION.BUREAUCRAT).toBe(8);
      expect(PROFESSION.ENFORCER).toBe(9);
      expect(PROFESSION.DOCTOR).toBe(10);
      expect(PROFESSION.NANO_TECHNICIAN).toBe(11);
      expect(PROFESSION.META_PHYSICIST).toBe(12);
      expect(PROFESSION.KEEPER).toBe(13);
      expect(PROFESSION.SHADE).toBe(14);
    });
  });

  describe('Integration Tests', () => {
    it('should create complete test scenario', () => {
      // Create a character
      const profile = createTestProfile({
        breed: BREED.SOLITUS,
        profession: PROFESSION.SOLDIER,
        level: 150,
      });

      // Create equipment
      const weapon = createWeaponItem({ name: 'Combat Rifle', ql: 180 });
      const perk = createPerkItem('Combat Mastery', 999002, [
        [SKILL_ID.ASSAULT_RIF, 50],
      ]);

      // Extract bonuses
      const weaponBonuses = extractItemBonuses(weapon);
      const perkBonuses = createSkillBonuses([[SKILL_ID.ASSAULT_RIF, 50]]);

      // Verify structure
      expect(profile.Character.Profession).toBe(PROFESSION.SOLDIER);
      expect(weapon.stats.length).toBeGreaterThan(0);
      expect(weaponBonuses[SKILL_ID.ASSAULT_RIF]).toBeGreaterThan(0);
      expect(perkBonuses[SKILL_ID.ASSAULT_RIF]).toBe(50);
    });

    it('should demonstrate correct v4.0.0 patterns', () => {
      const profile = createTestProfile();

      // Numeric IDs, not strings
      expect(typeof profile.Character.Breed).toBe('number');
      expect(typeof profile.Character.Profession).toBe('number');

      // Skills are stored by numeric ID
      const skillKeys = Object.keys(profile.skills).map(Number);
      expect(skillKeys.every((k) => !isNaN(k))).toBe(true);

      // Version is 4.0.0
      expect(profile.version).toBe('4.0.0');
    });
  });
});

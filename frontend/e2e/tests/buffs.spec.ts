import { test, expect } from '@playwright/test';
import { ProfilePage } from '../pages/ProfilePage';
import { EquipmentPage } from '../pages/EquipmentPage';
import { testProfiles } from '../fixtures/test-data';
import { clearLocalStorage, waitForPageReady, getLocalStorageItem } from '../utils/helpers';

/**
 * E2E Test: Buff Management
 *
 * Tests the complete buff workflow:
 * - Creating a profile
 * - Adding nano buffs
 * - Verifying skill bonuses applied
 * - Adding multiple stacking buffs
 * - Verifying cumulative bonuses
 * - Removing buffs
 */

test.describe('Buff Management', () => {
  let profilePage: ProfilePage;
  let equipmentPage: EquipmentPage;
  let profileId: string;

  test.beforeEach(async ({ page }) => {
    profilePage = new ProfilePage(page);
    equipmentPage = new EquipmentPage(page);

    // Navigate FIRST before accessing localStorage
    await profilePage.goto();

    // Clear localStorage AFTER navigation
    await clearLocalStorage(page);

    await waitForPageReady(page);

    const { name, level, profession } = testProfiles.doctor;
    await profilePage.createProfile(name, level, profession);

    // Get the profile ID from localStorage
    const profiles = await getLocalStorageItem(page, 'tinkertools_profiles');
    profileId = profiles && profiles.length > 0 ? profiles[0].id : '1';

    // Navigate to profile equipment page
    await equipmentPage.gotoProfile(profileId);
    await waitForPageReady(page);
  });

  test('should add a nano buff', async ({ page }) => {
    // Verify buff panel is visible
    const buffsPanel = equipmentPage.buffsPanel;
    await expect(buffsPanel).toBeVisible();

    // Add a buff
    await equipmentPage.addBuff('Wrangle');

    // Wait for buff to be added
    await page.waitForTimeout(1000);

    // Verify buff appears in buff list
    expect(await equipmentPage.hasBuff('Wrangle')).toBe(true);
  });

  test('should apply skill bonuses when adding buff', async ({ page }) => {
    // Get initial skill value (e.g., Treatment)
    const initialStat = await equipmentPage.getStatValue('treatment');
    const initialValue = parseInt(initialStat.match(/\d+/)?.[0] || '0');

    // Add a buff that increases Treatment
    await equipmentPage.addBuff('Wrangle');
    await page.waitForTimeout(1000);

    // Verify skill increased
    const newStat = await equipmentPage.getStatValue('treatment');
    const newValue = parseInt(newStat.match(/\d+/)?.[0] || '0');

    expect(newValue).toBeGreaterThan(initialValue);
  });

  test('should add multiple stacking buffs', async ({ page }) => {
    // Add first buff
    await equipmentPage.addBuff('Wrangle');
    await page.waitForTimeout(500);

    // Add second buff
    await equipmentPage.addBuff('Composite Attribute');
    await page.waitForTimeout(500);

    // Verify both buffs are present
    expect(await equipmentPage.hasBuff('Wrangle')).toBe(true);
    expect(await equipmentPage.hasBuff('Composite Attribute')).toBe(true);
  });

  test('should apply cumulative bonuses from multiple buffs', async ({ page }) => {
    // Get initial stat value
    const initialStat = await equipmentPage.getStatValue('intelligence');
    const initialValue = parseInt(initialStat.match(/\d+/)?.[0] || '0');

    // Add first buff
    await equipmentPage.addBuff('Composite Attribute');
    await page.waitForTimeout(500);

    // Get stat after first buff
    const afterFirstBuff = await equipmentPage.getStatValue('intelligence');
    const firstBuffValue = parseInt(afterFirstBuff.match(/\d+/)?.[0] || '0');

    expect(firstBuffValue).toBeGreaterThan(initialValue);

    // Add second buff that also boosts Intelligence
    await equipmentPage.addBuff('Superior Essence');
    await page.waitForTimeout(500);

    // Get stat after second buff
    const afterSecondBuff = await equipmentPage.getStatValue('intelligence');
    const secondBuffValue = parseInt(afterSecondBuff.match(/\d+/)?.[0] || '0');

    // Verify cumulative effect
    expect(secondBuffValue).toBeGreaterThan(firstBuffValue);
  });

  test('should remove buff and revert bonuses', async ({ page }) => {
    // Add a buff
    await equipmentPage.addBuff('Wrangle');
    await page.waitForTimeout(1000);

    // Verify buff is active
    expect(await equipmentPage.hasBuff('Wrangle')).toBe(true);

    // Get stat value with buff
    const buffedStat = await equipmentPage.getStatValue('treatment');
    const buffedValue = parseInt(buffedStat.match(/\d+/)?.[0] || '0');

    // Remove the buff
    await equipmentPage.removeBuff('Wrangle');
    await page.waitForTimeout(1000);

    // Verify buff is removed
    expect(await equipmentPage.hasBuff('Wrangle')).toBe(false);

    // Verify stat decreased
    const unbuffedStat = await equipmentPage.getStatValue('treatment');
    const unbuffedValue = parseInt(unbuffedStat.match(/\d+/)?.[0] || '0');

    expect(unbuffedValue).toBeLessThan(buffedValue);
  });

  test('should handle adding and removing multiple buffs', async ({ page }) => {
    // Add multiple buffs
    await equipmentPage.addBuff('Wrangle');
    await page.waitForTimeout(300);
    await equipmentPage.addBuff('Composite Attribute');
    await page.waitForTimeout(300);
    await equipmentPage.addBuff('Superior Essence');
    await page.waitForTimeout(300);

    // Verify all buffs are active
    expect(await equipmentPage.hasBuff('Wrangle')).toBe(true);
    expect(await equipmentPage.hasBuff('Composite Attribute')).toBe(true);
    expect(await equipmentPage.hasBuff('Superior Essence')).toBe(true);

    // Remove middle buff
    await equipmentPage.removeBuff('Composite Attribute');
    await page.waitForTimeout(500);

    // Verify only that buff was removed
    expect(await equipmentPage.hasBuff('Wrangle')).toBe(true);
    expect(await equipmentPage.hasBuff('Composite Attribute')).toBe(false);
    expect(await equipmentPage.hasBuff('Superior Essence')).toBe(true);

    // Remove remaining buffs
    await equipmentPage.removeBuff('Wrangle');
    await page.waitForTimeout(300);
    await equipmentPage.removeBuff('Superior Essence');
    await page.waitForTimeout(300);

    // Verify all buffs removed
    expect(await equipmentPage.hasBuff('Wrangle')).toBe(false);
    expect(await equipmentPage.hasBuff('Composite Attribute')).toBe(false);
    expect(await equipmentPage.hasBuff('Superior Essence')).toBe(false);
  });

  test('should persist buffs after page reload', async ({ page }) => {
    // Add buffs
    await equipmentPage.addBuff('Wrangle');
    await page.waitForTimeout(500);
    await equipmentPage.addBuff('Composite Attribute');
    await page.waitForTimeout(500);

    // Verify buffs are active
    expect(await equipmentPage.hasBuff('Wrangle')).toBe(true);
    expect(await equipmentPage.hasBuff('Composite Attribute')).toBe(true);

    // Reload page
    await page.reload();
    await waitForPageReady(page);

    // Verify buffs persisted
    expect(await equipmentPage.hasBuff('Wrangle')).toBe(true);
    expect(await equipmentPage.hasBuff('Composite Attribute')).toBe(true);
  });

  test('should clean up by deleting profile', async ({ page }) => {
    // Navigate back to profiles page
    await profilePage.goto();
    await waitForPageReady(page);

    // Delete the test profile
    await profilePage.deleteProfile(testProfiles.doctor.name);

    // Verify profile was deleted
    expect(await profilePage.hasProfile(testProfiles.doctor.name)).toBe(false);
  });
});

import { test, expect } from '@playwright/test';
import { ProfilePage } from '../pages/ProfilePage';
import { EquipmentPage } from '../pages/EquipmentPage';
import { testProfiles } from '../fixtures/test-data';
import { clearLocalStorage, waitForPageReady, getLocalStorageItem } from '../utils/helpers';

/**
 * E2E Test: Equipment Management
 *
 * Tests the complete equipment workflow:
 * - Creating a profile
 * - Equipping items to slots
 * - Verifying stat changes
 * - Unequipping items
 * - Verifying stats revert
 */

test.describe('Equipment Management', () => {
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

    const { name, level, profession } = testProfiles.enforcer;
    await profilePage.createProfile(name, level, profession);

    // Get the profile ID from localStorage
    const profiles = await getLocalStorageItem(page, 'tinkertools_profiles');
    profileId = profiles && profiles.length > 0 ? profiles[0].id : '1';
  });

  test('should equip item to a slot', async ({ page }) => {
    // Navigate to profile equipment page
    await equipmentPage.gotoProfile(profileId);
    await waitForPageReady(page);

    // Verify slot is initially empty
    const isEquipped = await equipmentPage.isItemEquipped('head');
    expect(isEquipped).toBe(false);

    // Equip an item to head slot
    await equipmentPage.equipItem('head', 'Visible OT Aban Helmet');

    // Wait for equipment action to complete
    await page.waitForTimeout(1000);

    // Verify item is now equipped
    const isNowEquipped = await equipmentPage.isItemEquipped('head');
    expect(isNowEquipped).toBe(true);
  });

  test('should update stats when equipping item', async ({ page }) => {
    await equipmentPage.gotoProfile(profileId);
    await waitForPageReady(page);

    // Get initial stat value (e.g., Intelligence)
    const initialStat = await equipmentPage.getStatValue('intelligence');
    const initialValue = parseInt(initialStat.match(/\d+/)?.[0] || '0');

    // Equip an item that boosts Intelligence
    await equipmentPage.equipItem('head', 'Aban');

    // Wait for stats to update
    await page.waitForTimeout(1000);

    // Verify stat increased
    const newStat = await equipmentPage.getStatValue('intelligence');
    const newValue = parseInt(newStat.match(/\d+/)?.[0] || '0');

    expect(newValue).toBeGreaterThan(initialValue);
  });

  test('should unequip item and revert stats', async ({ page }) => {
    await equipmentPage.gotoProfile(profileId);
    await waitForPageReady(page);

    // Equip an item first
    await equipmentPage.equipItem('head', 'Aban');
    await page.waitForTimeout(1000);

    // Get stat value with item equipped
    const equippedStat = await equipmentPage.getStatValue('intelligence');
    const equippedValue = parseInt(equippedStat.match(/\d+/)?.[0] || '0');

    // Unequip the item
    await equipmentPage.unequipItem('head');
    await page.waitForTimeout(1000);

    // Get stat value after unequip
    const unequippedStat = await equipmentPage.getStatValue('intelligence');
    const unequippedValue = parseInt(unequippedStat.match(/\d+/)?.[0] || '0');

    // Verify stat decreased back
    expect(unequippedValue).toBeLessThan(equippedValue);
  });

  test('should equip multiple items to different slots', async ({ page }) => {
    await equipmentPage.gotoProfile(profileId);
    await waitForPageReady(page);

    // Equip items to multiple slots
    await equipmentPage.equipItem('head', 'Aban');
    await page.waitForTimeout(500);

    await equipmentPage.equipItem('chest', 'Armor');
    await page.waitForTimeout(500);

    await equipmentPage.equipItem('weapon1', 'Rapier');
    await page.waitForTimeout(500);

    // Verify all items are equipped
    expect(await equipmentPage.isItemEquipped('head')).toBe(true);
    expect(await equipmentPage.isItemEquipped('chest')).toBe(true);
    expect(await equipmentPage.isItemEquipped('weapon1')).toBe(true);
  });

  test('should persist equipped items after page reload', async ({ page }) => {
    await equipmentPage.gotoProfile(profileId);
    await waitForPageReady(page);

    // Equip an item
    await equipmentPage.equipItem('head', 'Aban');
    await page.waitForTimeout(1000);

    // Verify item is equipped
    expect(await equipmentPage.isItemEquipped('head')).toBe(true);

    // Reload the page
    await page.reload();
    await waitForPageReady(page);

    // Verify item is still equipped after reload
    expect(await equipmentPage.isItemEquipped('head')).toBe(true);
  });

  test('should handle equipping and unequipping same slot multiple times', async ({ page }) => {
    await equipmentPage.gotoProfile(profileId);
    await waitForPageReady(page);

    // Equip first item
    await equipmentPage.equipItem('head', 'Aban');
    await page.waitForTimeout(500);
    expect(await equipmentPage.isItemEquipped('head')).toBe(true);

    // Unequip
    await equipmentPage.unequipItem('head');
    await page.waitForTimeout(500);
    expect(await equipmentPage.isItemEquipped('head')).toBe(false);

    // Equip different item to same slot
    await equipmentPage.equipItem('head', 'Helmet');
    await page.waitForTimeout(500);
    expect(await equipmentPage.isItemEquipped('head')).toBe(true);

    // Unequip again
    await equipmentPage.unequipItem('head');
    await page.waitForTimeout(500);
    expect(await equipmentPage.isItemEquipped('head')).toBe(false);
  });

  test('should clean up by deleting profile', async ({ page }) => {
    // Navigate back to profiles page
    await profilePage.goto();
    await waitForPageReady(page);

    // Delete the test profile
    await profilePage.deleteProfile(testProfiles.enforcer.name);

    // Verify profile was deleted
    expect(await profilePage.hasProfile(testProfiles.enforcer.name)).toBe(false);
  });
});

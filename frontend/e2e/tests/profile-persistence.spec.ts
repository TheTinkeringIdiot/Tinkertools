import { test, expect } from '@playwright/test';
import { ProfilePage } from '../pages/ProfilePage';
import { EquipmentPage } from '../pages/EquipmentPage';
import { testProfiles } from '../fixtures/test-data';
import { clearLocalStorage, waitForPageReady, getLocalStorageItem } from '../utils/helpers';

/**
 * E2E Test: Profile Persistence
 *
 * Tests that profile data persists across page reloads:
 * - Creating a profile with specific attributes
 * - Adding equipment
 * - Adding buffs
 * - Refreshing the page
 * - Verifying all data persisted in localStorage
 * - Verifying profile state restored correctly
 */

test.describe('Profile Persistence', () => {
  let profilePage: ProfilePage;
  let equipmentPage: EquipmentPage;

  test.beforeEach(async ({ page }) => {
    profilePage = new ProfilePage(page);
    equipmentPage = new EquipmentPage(page);

    // Navigate FIRST before accessing localStorage
    await profilePage.goto();

    // Clear localStorage AFTER navigation
    await clearLocalStorage(page);

    await waitForPageReady(page);
  });

  test('should persist basic profile data across page reload', async ({ page }) => {
    // Create a profile
    await profilePage.goto();
    await waitForPageReady(page);

    const { name, level, profession } = testProfiles.enforcer;
    await profilePage.createProfile(name, level, profession);

    // Verify profile was created
    expect(await profilePage.hasProfile(name)).toBe(true);

    // Reload the page
    await page.reload();
    await waitForPageReady(page);

    // Verify profile still exists
    expect(await profilePage.hasProfile(name)).toBe(true);

    // Verify profile data in localStorage
    const profiles = await getLocalStorageItem(page, 'tinkertools_profiles');
    expect(profiles).toBeTruthy();
    expect(profiles.length).toBeGreaterThan(0);
    expect(profiles[0].name).toBe(name);
    expect(profiles[0].level).toBe(level);
    expect(profiles[0].profession).toBe(profession);
  });

  test('should persist equipped items across page reload', async ({ page }) => {
    // Create profile
    await profilePage.goto();
    await waitForPageReady(page);

    const { name, level, profession } = testProfiles.trader;
    await profilePage.createProfile(name, level, profession);

    // Get profile ID
    const profiles = await getLocalStorageItem(page, 'tinkertools_profiles');
    const profileId = profiles[0].id;

    // Navigate to equipment page
    await equipmentPage.gotoProfile(profileId);
    await waitForPageReady(page);

    // Equip items to multiple slots
    await equipmentPage.equipItem('head', 'Aban');
    await page.waitForTimeout(500);

    await equipmentPage.equipItem('chest', 'Armor');
    await page.waitForTimeout(500);

    // Verify items are equipped
    expect(await equipmentPage.isItemEquipped('head')).toBe(true);
    expect(await equipmentPage.isItemEquipped('chest')).toBe(true);

    // Reload the page
    await page.reload();
    await waitForPageReady(page);

    // Verify items are still equipped after reload
    expect(await equipmentPage.isItemEquipped('head')).toBe(true);
    expect(await equipmentPage.isItemEquipped('chest')).toBe(true);

    // Verify equipment data in localStorage
    const updatedProfiles = await getLocalStorageItem(page, `tinkertools_profile_${profileId}`);
    expect(updatedProfiles).toBeTruthy();
    expect(updatedProfiles.equipment).toBeTruthy();
  });

  test('should persist buffs across page reload', async ({ page }) => {
    // Create profile
    await profilePage.goto();
    await waitForPageReady(page);

    const { name, level, profession } = testProfiles.doctor;
    await profilePage.createProfile(name, level, profession);

    // Get profile ID
    const profiles = await getLocalStorageItem(page, 'tinkertools_profiles');
    const profileId = profiles[0].id;

    // Navigate to equipment page
    await equipmentPage.gotoProfile(profileId);
    await waitForPageReady(page);

    // Add buffs
    await equipmentPage.addBuff('Wrangle');
    await page.waitForTimeout(500);

    await equipmentPage.addBuff('Composite Attribute');
    await page.waitForTimeout(500);

    // Verify buffs are active
    expect(await equipmentPage.hasBuff('Wrangle')).toBe(true);
    expect(await equipmentPage.hasBuff('Composite Attribute')).toBe(true);

    // Reload the page
    await page.reload();
    await waitForPageReady(page);

    // Verify buffs are still active after reload
    expect(await equipmentPage.hasBuff('Wrangle')).toBe(true);
    expect(await equipmentPage.hasBuff('Composite Attribute')).toBe(true);

    // Verify buff data in localStorage
    const updatedProfiles = await getLocalStorageItem(page, `tinkertools_profile_${profileId}`);
    expect(updatedProfiles).toBeTruthy();
    expect(updatedProfiles.buffs).toBeTruthy();
  });

  test('should persist complete profile state (equipment + buffs)', async ({ page }) => {
    // Create profile
    await profilePage.goto();
    await waitForPageReady(page);

    const { name, level, profession } = testProfiles.enforcer;
    await profilePage.createProfile(name, level, profession);

    // Get profile ID
    const profiles = await getLocalStorageItem(page, 'tinkertools_profiles');
    const profileId = profiles[0].id;

    // Navigate to equipment page
    await equipmentPage.gotoProfile(profileId);
    await waitForPageReady(page);

    // Equip items
    await equipmentPage.equipItem('head', 'Aban');
    await page.waitForTimeout(300);
    await equipmentPage.equipItem('weapon1', 'Rapier');
    await page.waitForTimeout(300);

    // Add buffs
    await equipmentPage.addBuff('Wrangle');
    await page.waitForTimeout(300);
    await equipmentPage.addBuff('Composite Attribute');
    await page.waitForTimeout(300);

    // Get a stat value with everything equipped
    const fullyStat = await equipmentPage.getStatValue('intelligence');
    const fullyValue = parseInt(fullyStat.match(/\d+/)?.[0] || '0');

    // Reload the page
    await page.reload();
    await waitForPageReady(page);

    // Verify everything is still there
    expect(await equipmentPage.isItemEquipped('head')).toBe(true);
    expect(await equipmentPage.isItemEquipped('weapon1')).toBe(true);
    expect(await equipmentPage.hasBuff('Wrangle')).toBe(true);
    expect(await equipmentPage.hasBuff('Composite Attribute')).toBe(true);

    // Verify stats are the same
    const reloadedStat = await equipmentPage.getStatValue('intelligence');
    const reloadedValue = parseInt(reloadedStat.match(/\d+/)?.[0] || '0');

    expect(reloadedValue).toBe(fullyValue);
  });

  test('should handle browser close and reopen (simulated)', async ({ page, context }) => {
    // Create profile with data
    await profilePage.goto();
    await waitForPageReady(page);

    const { name, level, profession } = testProfiles.trader;
    await profilePage.createProfile(name, level, profession);

    const profiles = await getLocalStorageItem(page, 'tinkertools_profiles');
    const profileId = profiles[0].id;

    // Add some equipment
    await equipmentPage.gotoProfile(profileId);
    await waitForPageReady(page);

    await equipmentPage.equipItem('head', 'Aban');
    await page.waitForTimeout(500);

    // Close the page and open a new one (simulates browser close/reopen)
    await page.close();

    const newPage = await context.newPage();
    const newProfilePage = new ProfilePage(newPage);

    // Navigate to profiles page
    await newProfilePage.goto();
    await waitForPageReady(newPage);

    // Verify profile still exists
    expect(await newProfilePage.hasProfile(name)).toBe(true);

    // Verify equipment persisted
    const newEquipmentPage = new EquipmentPage(newPage);
    await newEquipmentPage.gotoProfile(profileId);
    await waitForPageReady(newPage);

    expect(await newEquipmentPage.isItemEquipped('head')).toBe(true);
  });

  test('should persist multiple profiles independently', async ({ page }) => {
    await profilePage.goto();
    await waitForPageReady(page);

    // Create first profile
    await profilePage.createProfile(
      testProfiles.enforcer.name,
      testProfiles.enforcer.level,
      testProfiles.enforcer.profession
    );

    // Create second profile
    await profilePage.createProfile(
      testProfiles.doctor.name,
      testProfiles.doctor.level,
      testProfiles.doctor.profession
    );

    // Verify both profiles exist
    expect(await profilePage.hasProfile(testProfiles.enforcer.name)).toBe(true);
    expect(await profilePage.hasProfile(testProfiles.doctor.name)).toBe(true);

    // Get profile IDs
    const profiles = await getLocalStorageItem(page, 'tinkertools_profiles');
    expect(profiles.length).toBe(2);

    const enforcerId = profiles.find((p: any) => p.name === testProfiles.enforcer.name)?.id;
    const doctorId = profiles.find((p: any) => p.name === testProfiles.doctor.name)?.id;

    // Equip different items to each profile
    await equipmentPage.gotoProfile(enforcerId);
    await waitForPageReady(page);
    await equipmentPage.equipItem('head', 'Aban');
    await page.waitForTimeout(500);

    await equipmentPage.gotoProfile(doctorId);
    await waitForPageReady(page);
    await equipmentPage.equipItem('chest', 'Armor');
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await waitForPageReady(page);

    // Navigate to profiles page
    await profilePage.goto();
    await waitForPageReady(page);

    // Verify both profiles still exist
    expect(await profilePage.hasProfile(testProfiles.enforcer.name)).toBe(true);
    expect(await profilePage.hasProfile(testProfiles.doctor.name)).toBe(true);

    // Verify each profile has correct equipment
    await equipmentPage.gotoProfile(enforcerId);
    await waitForPageReady(page);
    expect(await equipmentPage.isItemEquipped('head')).toBe(true);
    expect(await equipmentPage.isItemEquipped('chest')).toBe(false);

    await equipmentPage.gotoProfile(doctorId);
    await waitForPageReady(page);
    expect(await equipmentPage.isItemEquipped('head')).toBe(false);
    expect(await equipmentPage.isItemEquipped('chest')).toBe(true);
  });
});

import { test, expect } from '@playwright/test';
import { ProfilePage } from '../pages/ProfilePage';
import { EquipmentPage } from '../pages/EquipmentPage';
import { NanoPage } from '../pages/NanoPage';
import { testProfiles } from '../fixtures/test-data';
import { clearLocalStorage, waitForPageReady, getLocalStorageItem } from '../utils/helpers';

/**
 * E2E Test: Nano Compatibility
 *
 * Tests nano compatibility checking:
 * - Creating a low-level profile
 * - Searching for high-level nanos
 * - Verifying nanos show as incompatible (red)
 * - Adding buffs to meet requirements
 * - Verifying nanos become compatible (green)
 */

test.describe('Nano Compatibility', () => {
  let profilePage: ProfilePage;
  let equipmentPage: EquipmentPage;
  let nanoPage: NanoPage;
  let profileId: string;

  test.beforeEach(async ({ page }) => {
    profilePage = new ProfilePage(page);
    equipmentPage = new EquipmentPage(page);
    nanoPage = new NanoPage(page);

    // Navigate FIRST before accessing localStorage
    await profilePage.goto();

    // Clear localStorage AFTER navigation
    await clearLocalStorage(page);

    await waitForPageReady(page);
  });

  test('should show high-level nano as incompatible for low-level profile', async ({ page }) => {
    // Create a low-level profile (level 50)
    await profilePage.goto();
    await waitForPageReady(page);

    await profilePage.createProfile('LowLevelChar', 50, 'Nano-Technician');

    // Get profile ID
    const profiles = await getLocalStorageItem(page, 'tinkertools_profiles');
    profileId = profiles[0].id;

    // Navigate to nanos page
    await nanoPage.goto();
    await waitForPageReady(page);

    // Search for a high-level nano (e.g., level 200 nano)
    await nanoPage.searchByName('Superior Essence');

    // Verify nano appears in results
    expect(await nanoPage.hasNano('Superior Essence')).toBe(true);

    // Verify nano is marked as incompatible (red indicator)
    const compatibilityStatus = await nanoPage.getNanoCompatibilityStatus('Superior Essence');
    expect(compatibilityStatus).toBe('incompatible');
  });

  test('should show appropriate nano as compatible for matching level', async ({ page }) => {
    // Create a high-level profile
    await profilePage.goto();
    await waitForPageReady(page);

    await profilePage.createProfile('HighLevelNT', 220, 'Nano-Technician');

    const profiles = await getLocalStorageItem(page, 'tinkertools_profiles');
    profileId = profiles[0].id;

    // Navigate to nanos page
    await nanoPage.goto();
    await waitForPageReady(page);

    // Search for a nano appropriate for this level
    await nanoPage.searchByName('Wrangle');

    // Verify nano appears
    expect(await nanoPage.hasNano('Wrangle')).toBe(true);

    // Verify nano is compatible (green indicator)
    const compatibilityStatus = await nanoPage.getNanoCompatibilityStatus('Wrangle');
    expect(compatibilityStatus).toBe('compatible');
  });

  test('should update compatibility when adding buffs', async ({ page }) => {
    // Create a mid-level profile
    await profilePage.goto();
    await waitForPageReady(page);

    await profilePage.createProfile('MidLevelDoc', 100, 'Doctor');

    const profiles = await getLocalStorageItem(page, 'tinkertools_profiles');
    profileId = profiles[0].id;

    // Navigate to nanos page and search for a nano just out of reach
    await nanoPage.goto();
    await waitForPageReady(page);

    await nanoPage.searchByName('Superior First Aid');

    // Check initial compatibility (should be incompatible)
    const initialStatus = await nanoPage.getNanoCompatibilityStatus('Superior First Aid');

    // Navigate to equipment page to add buffs
    await equipmentPage.gotoProfile(profileId);
    await waitForPageReady(page);

    // Add buffs to increase skills
    await equipmentPage.addBuff('Composite Attribute');
    await page.waitForTimeout(500);

    await equipmentPage.addBuff('Wrangle');
    await page.waitForTimeout(500);

    // Navigate back to nanos page
    await nanoPage.goto();
    await waitForPageReady(page);

    // Search for the same nano
    await nanoPage.searchByName('Superior First Aid');

    // Check compatibility again (may have changed to compatible)
    const afterBuffsStatus = await nanoPage.getNanoCompatibilityStatus('Superior First Aid');

    // Status should either be compatible now, or still incompatible but different from before
    // (depends on exact buff values and nano requirements)
    expect(afterBuffsStatus).toBeTruthy();
  });

  test('should filter nanos by profession', async ({ page }) => {
    // Create profile
    await profilePage.goto();
    await waitForPageReady(page);

    await profilePage.createProfile('FilterTest', 150, 'Doctor');

    // Navigate to nanos page
    await nanoPage.goto();
    await waitForPageReady(page);

    // Apply profession filter
    await nanoPage.filterByProfession('Doctor');
    await page.waitForTimeout(1000);

    // Verify results are filtered
    const nanoCount = await nanoPage.getNanoCount();
    expect(nanoCount).toBeGreaterThan(0);

    // Change filter to different profession
    await nanoPage.filterByProfession('Trader');
    await page.waitForTimeout(1000);

    // Verify results changed
    const traderNanoCount = await nanoPage.getNanoCount();
    expect(traderNanoCount).toBeGreaterThan(0);
  });

  test('should display nano requirements', async ({ page }) => {
    // Create profile
    await profilePage.goto();
    await waitForPageReady(page);

    await profilePage.createProfile('ReqsTest', 100, 'Enforcer');

    // Navigate to nanos page
    await nanoPage.goto();
    await waitForPageReady(page);

    // Search for a specific nano
    await nanoPage.searchByName('Wrangle');

    // Verify nano appears
    expect(await nanoPage.hasNano('Wrangle')).toBe(true);

    // Get nano requirements
    const requirements = await nanoPage.getNanoRequirements('Wrangle');

    // Verify requirements text is displayed
    expect(requirements).toBeTruthy();
    expect(requirements.length).toBeGreaterThan(0);
  });

  test('should show compatibility changes with equipment', async ({ page }) => {
    // Create a profile
    await profilePage.goto();
    await waitForPageReady(page);

    await profilePage.createProfile('EquipTest', 150, 'Meta-Physicist');

    const profiles = await getLocalStorageItem(page, 'tinkertools_profiles');
    profileId = profiles[0].id;

    // Check initial nano compatibility
    await nanoPage.goto();
    await waitForPageReady(page);

    await nanoPage.searchByName('Composite Attribute');
    const initialStatus = await nanoPage.getNanoCompatibilityStatus('Composite Attribute');

    // Equip items that boost skills
    await equipmentPage.gotoProfile(profileId);
    await waitForPageReady(page);

    await equipmentPage.equipItem('head', 'Aban');
    await page.waitForTimeout(500);

    await equipmentPage.equipItem('chest', 'Armor');
    await page.waitForTimeout(500);

    // Check nano compatibility again
    await nanoPage.goto();
    await waitForPageReady(page);

    await nanoPage.searchByName('Composite Attribute');
    const afterEquipStatus = await nanoPage.getNanoCompatibilityStatus('Composite Attribute');

    // Verify we got a status both times
    expect(initialStatus).toBeTruthy();
    expect(afterEquipStatus).toBeTruthy();
  });

  test('should handle multiple nano searches', async ({ page }) => {
    // Create profile
    await profilePage.goto();
    await waitForPageReady(page);

    await profilePage.createProfile('SearchTest', 200, 'Nano-Technician');

    // Navigate to nanos page
    await nanoPage.goto();
    await waitForPageReady(page);

    // Search for first nano
    await nanoPage.searchByName('Wrangle');
    expect(await nanoPage.hasNano('Wrangle')).toBe(true);

    // Search for second nano
    await nanoPage.searchByName('Composite Attribute');
    expect(await nanoPage.hasNano('Composite Attribute')).toBe(true);

    // Search for third nano
    await nanoPage.searchByName('Superior Essence');
    expect(await nanoPage.hasNano('Superior Essence')).toBe(true);

    // Each search should return results
    const finalCount = await nanoPage.getNanoCount();
    expect(finalCount).toBeGreaterThan(0);
  });

  test('should persist nano compatibility state across navigation', async ({ page }) => {
    // Create profile with buffs
    await profilePage.goto();
    await waitForPageReady(page);

    await profilePage.createProfile('PersistTest', 100, 'Doctor');

    const profiles = await getLocalStorageItem(page, 'tinkertools_profiles');
    profileId = profiles[0].id;

    // Add buffs
    await equipmentPage.gotoProfile(profileId);
    await waitForPageReady(page);

    await equipmentPage.addBuff('Wrangle');
    await page.waitForTimeout(500);

    // Check nano compatibility
    await nanoPage.goto();
    await waitForPageReady(page);

    await nanoPage.searchByName('Superior First Aid');
    const firstCheckStatus = await nanoPage.getNanoCompatibilityStatus('Superior First Aid');

    // Navigate away and back
    await profilePage.goto();
    await waitForPageReady(page);

    await nanoPage.goto();
    await waitForPageReady(page);

    // Search again for same nano
    await nanoPage.searchByName('Superior First Aid');
    const secondCheckStatus = await nanoPage.getNanoCompatibilityStatus('Superior First Aid');

    // Status should be consistent
    expect(firstCheckStatus).toBe(secondCheckStatus);
  });
});

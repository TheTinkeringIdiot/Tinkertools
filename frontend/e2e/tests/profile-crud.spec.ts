import { test, expect } from '@playwright/test';
import { ProfilePage } from '../pages/ProfilePage';
import { testProfiles } from '../fixtures/test-data';
import { clearLocalStorage, waitForPageReady } from '../utils/helpers';

/**
 * E2E Test: Profile CRUD Operations
 *
 * Tests the complete lifecycle of profile management:
 * - Creating a new profile
 * - Verifying it appears in the list
 * - Editing the profile name
 * - Verifying changes are saved
 * - Deleting the profile
 * - Verifying deletion
 */

test.describe('Profile CRUD Operations', () => {
  let profilePage: ProfilePage;

  test.beforeEach(async ({ page }) => {
    profilePage = new ProfilePage(page);

    // Navigate FIRST before accessing localStorage
    await profilePage.goto();

    // Clear localStorage AFTER navigation
    await clearLocalStorage(page);

    await waitForPageReady(page);
  });

  test('should create a new profile', async ({ page }) => {
    const { name, level, profession } = testProfiles.enforcer;

    // Get initial profile count
    const initialCount = await profilePage.getProfileCount();

    // Create profile
    await profilePage.createProfile(name, level, profession);

    // Verify profile was created
    expect(await profilePage.hasProfile(name)).toBe(true);

    // Verify profile count increased
    const newCount = await profilePage.getProfileCount();
    expect(newCount).toBe(initialCount + 1);
  });

  test('should edit an existing profile', async ({ page }) => {
    const { name, level, profession } = testProfiles.doctor;
    const newName = 'EditedDoctor';

    // Create initial profile
    await profilePage.createProfile(name, level, profession);
    expect(await profilePage.hasProfile(name)).toBe(true);

    // Edit the profile
    await profilePage.editProfile(name, newName);

    // Verify old name is gone and new name appears
    expect(await profilePage.hasProfile(name)).toBe(false);
    expect(await profilePage.hasProfile(newName)).toBe(true);
  });

  test('should delete a profile', async ({ page }) => {
    const { name, level, profession } = testProfiles.trader;

    // Create profile
    await profilePage.createProfile(name, level, profession);
    expect(await profilePage.hasProfile(name)).toBe(true);

    // Get initial count
    const initialCount = await profilePage.getProfileCount();

    // Delete the profile
    await profilePage.deleteProfile(name);

    // Verify profile was deleted
    expect(await profilePage.hasProfile(name)).toBe(false);

    // Verify profile count decreased
    const newCount = await profilePage.getProfileCount();
    expect(newCount).toBe(initialCount - 1);
  });

  test('should complete full CRUD lifecycle', async ({ page }) => {
    const { name, level, profession } = testProfiles.enforcer;
    const editedName = 'UpdatedEnforcer';

    // CREATE: Create new profile
    await profilePage.createProfile(name, level, profession);
    expect(await profilePage.hasProfile(name)).toBe(true);

    // READ: Verify it appears in list
    const profiles = await profilePage.getProfileCount();
    expect(profiles).toBeGreaterThan(0);

    // UPDATE: Edit profile name
    await profilePage.editProfile(name, editedName);
    expect(await profilePage.hasProfile(editedName)).toBe(true);
    expect(await profilePage.hasProfile(name)).toBe(false);

    // DELETE: Remove profile
    await profilePage.deleteProfile(editedName);
    expect(await profilePage.hasProfile(editedName)).toBe(false);
  });

  test('should handle multiple profiles', async ({ page }) => {
    // Create multiple profiles
    await profilePage.createProfile(
      testProfiles.enforcer.name,
      testProfiles.enforcer.level,
      testProfiles.enforcer.profession
    );

    await profilePage.createProfile(
      testProfiles.doctor.name,
      testProfiles.doctor.level,
      testProfiles.doctor.profession
    );

    await profilePage.createProfile(
      testProfiles.trader.name,
      testProfiles.trader.level,
      testProfiles.trader.profession
    );

    // Verify all profiles exist
    expect(await profilePage.hasProfile(testProfiles.enforcer.name)).toBe(true);
    expect(await profilePage.hasProfile(testProfiles.doctor.name)).toBe(true);
    expect(await profilePage.hasProfile(testProfiles.trader.name)).toBe(true);

    // Verify count
    const count = await profilePage.getProfileCount();
    expect(count).toBeGreaterThanOrEqual(3);

    // Delete one profile
    await profilePage.deleteProfile(testProfiles.doctor.name);

    // Verify deletion and others remain
    expect(await profilePage.hasProfile(testProfiles.doctor.name)).toBe(false);
    expect(await profilePage.hasProfile(testProfiles.enforcer.name)).toBe(true);
    expect(await profilePage.hasProfile(testProfiles.trader.name)).toBe(true);
  });

  test('should persist profiles across page reloads', async ({ page }) => {
    const { name, level, profession } = testProfiles.enforcer;

    // Create profile
    await profilePage.createProfile(name, level, profession);
    expect(await profilePage.hasProfile(name)).toBe(true);

    // Reload page
    await page.reload();
    await waitForPageReady(page);

    // Verify profile still exists
    expect(await profilePage.hasProfile(name)).toBe(true);
  });
});

import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for TinkerProfiles page
 *
 * Handles profile CRUD operations:
 * - Creating new profiles
 * - Editing existing profiles
 * - Deleting profiles
 * - Selecting profiles
 */
export class ProfilePage {
  readonly page: Page;
  readonly createProfileButton: Locator;
  readonly profileNameInput: Locator;
  readonly profileLevelInput: Locator;
  readonly profileProfessionSelect: Locator;
  readonly saveProfileButton: Locator;
  readonly cancelButton: Locator;
  readonly profileList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createProfileButton = page.getByRole('button', { name: /create.*profile|new.*profile/i });
    this.profileNameInput = page.getByLabel(/name/i);
    this.profileLevelInput = page.getByLabel(/level/i);
    this.profileProfessionSelect = page.getByLabel(/profession/i);
    this.saveProfileButton = page.getByRole('button', { name: /save/i });
    this.cancelButton = page.getByRole('button', { name: /cancel/i });
    this.profileList = page.locator('[data-testid="profile-list"]');
  }

  async goto() {
    await this.page.goto('/profiles');
    await this.page.waitForLoadState('networkidle');
  }

  async createProfile(name: string, level: number, profession: string) {
    await this.createProfileButton.first().click();
    await this.profileNameInput.fill(name);
    await this.profileLevelInput.fill(level.toString());
    await this.profileProfessionSelect.selectOption(profession);
    await this.saveProfileButton.click();
    // Wait for profile to be saved and dialog to close
    await this.page.waitForTimeout(500);
  }

  async selectProfile(name: string) {
    await this.page.getByText(name).click();
  }

  async editProfile(oldName: string, newName: string) {
    // Find the profile card/row and click edit
    const profileCard = this.page.locator(`text=${oldName}`).locator('..');
    await profileCard.getByRole('button', { name: /edit/i }).click();

    await this.profileNameInput.clear();
    await this.profileNameInput.fill(newName);
    await this.saveProfileButton.click();
    await this.page.waitForTimeout(500);
  }

  async deleteProfile(name: string) {
    const profileCard = this.page.locator(`text=${name}`).locator('..');
    await profileCard.getByRole('button', { name: /delete/i }).click();

    // Confirm deletion if there's a confirmation dialog
    const confirmButton = this.page.getByRole('button', { name: /confirm|yes|delete/i });
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click();
    }
    await this.page.waitForTimeout(500);
  }

  async getProfileCount(): Promise<number> {
    const profiles = await this.page.locator('[data-testid="profile-item"]').count();
    return profiles;
  }

  async hasProfile(name: string): Promise<boolean> {
    return await this.page.getByText(name).isVisible({ timeout: 2000 }).catch(() => false);
  }
}

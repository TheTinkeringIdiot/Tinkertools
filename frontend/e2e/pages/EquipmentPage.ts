import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for Equipment Management (Profile Detail page)
 *
 * Handles:
 * - Equipping items to slots
 * - Unequipping items
 * - Viewing stat changes
 * - Managing buffs
 */
export class EquipmentPage {
  readonly page: Page;
  readonly profileName: Locator;
  readonly equipmentSlots: Locator;
  readonly statsPanel: Locator;
  readonly buffsPanel: Locator;
  readonly addBuffButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.profileName = page.locator('[data-testid="profile-name"]');
    this.equipmentSlots = page.locator('[data-testid="equipment-slots"]');
    this.statsPanel = page.locator('[data-testid="stats-panel"]');
    this.buffsPanel = page.locator('[data-testid="buffs-panel"]');
    this.addBuffButton = page.getByRole('button', { name: /add.*buff/i });
  }

  async gotoProfile(profileId: string) {
    await this.page.goto(`/profiles/${profileId}`);
    await this.page.waitForLoadState('networkidle');
  }

  async equipItem(slotName: string, itemName: string) {
    // Click on the equipment slot
    const slot = this.page.locator(`[data-testid="slot-${slotName}"]`);
    await slot.click();

    // Search for item in the equipment picker
    const itemSearch = this.page.getByPlaceholder(/search.*item/i);
    await itemSearch.fill(itemName);
    await this.page.waitForTimeout(300);

    // Click on the item
    await this.page.getByText(itemName).first().click();
    await this.page.waitForTimeout(500);
  }

  async unequipItem(slotName: string) {
    const slot = this.page.locator(`[data-testid="slot-${slotName}"]`);
    const unequipButton = slot.getByRole('button', { name: /unequip|remove/i });
    await unequipButton.click();
    await this.page.waitForTimeout(500);
  }

  async getStatValue(statName: string): Promise<string> {
    const statRow = this.page.locator(`[data-testid="stat-${statName}"]`);
    return await statRow.textContent() || '';
  }

  async addBuff(buffName: string) {
    await this.addBuffButton.click();

    // Search for buff
    const buffSearch = this.page.getByPlaceholder(/search.*buff|nano/i);
    await buffSearch.fill(buffName);
    await this.page.waitForTimeout(300);

    // Click on the buff
    await this.page.getByText(buffName).first().click();
    await this.page.waitForTimeout(500);
  }

  async removeBuff(buffName: string) {
    const buffItem = this.page.locator(`[data-testid="buff-item"]`, { hasText: buffName });
    const removeButton = buffItem.getByRole('button', { name: /remove|delete/i });
    await removeButton.click();
    await this.page.waitForTimeout(500);
  }

  async hasBuff(buffName: string): Promise<boolean> {
    const buffItem = this.page.locator(`[data-testid="buff-item"]`, { hasText: buffName });
    return await buffItem.isVisible({ timeout: 2000 }).catch(() => false);
  }

  async isItemEquipped(slotName: string): Promise<boolean> {
    const slot = this.page.locator(`[data-testid="slot-${slotName}"]`);
    const unequipButton = slot.getByRole('button', { name: /unequip|remove/i });
    return await unequipButton.isVisible({ timeout: 1000 }).catch(() => false);
  }
}

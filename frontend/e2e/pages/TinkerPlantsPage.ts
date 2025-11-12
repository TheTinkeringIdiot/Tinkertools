import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for TinkerPlants (Implant Planning) page
 *
 * Handles:
 * - Creating implant ladders
 * - Selecting implant clusters
 * - Viewing treatment requirements
 * - Optimizing implant configurations
 */
export class TinkerPlantsPage {
  readonly page: Page;
  readonly selectProfileButton: Locator;
  readonly implantSlots: Locator;
  readonly treatmentDisplay: Locator;
  readonly optimizeButton: Locator;
  readonly clusterPicker: Locator;

  constructor(page: Page) {
    this.page = page;
    this.selectProfileButton = page.getByRole('button', { name: /select.*profile/i });
    this.implantSlots = page.locator('[data-testid="implant-slots"]');
    this.treatmentDisplay = page.locator('[data-testid="treatment-display"]');
    this.optimizeButton = page.getByRole('button', { name: /optimize/i });
    this.clusterPicker = page.locator('[data-testid="cluster-picker"]');
  }

  async goto() {
    await this.page.goto('/plants');
    await this.page.waitForLoadState('networkidle');
  }

  async selectProfile(profileName: string) {
    await this.selectProfileButton.click();
    await this.page.getByText(profileName).click();
    await this.page.waitForTimeout(500);
  }

  async selectImplantSlot(slotName: string) {
    const slot = this.page.locator(`[data-testid="implant-slot-${slotName}"]`);
    await slot.click();
    await this.page.waitForTimeout(300);
  }

  async selectCluster(position: 'bright' | 'shiny' | 'faded', clusterName: string) {
    const clusterSlot = this.page.locator(`[data-testid="cluster-${position}"]`);
    await clusterSlot.click();

    // Search for cluster
    const clusterSearch = this.page.getByPlaceholder(/search.*cluster/i);
    await clusterSearch.fill(clusterName);
    await this.page.waitForTimeout(300);

    await this.page.getByText(clusterName).first().click();
    await this.page.waitForTimeout(500);
  }

  async getTreatmentRequirement(): Promise<string> {
    return await this.treatmentDisplay.textContent() || '';
  }

  async optimizeImplants() {
    await this.optimizeButton.click();
    await this.page.waitForTimeout(1000); // Optimization may take time
  }

  async hasImplantInSlot(slotName: string): Promise<boolean> {
    const slot = this.page.locator(`[data-testid="implant-slot-${slotName}"]`);
    const removeButton = slot.getByRole('button', { name: /remove|clear/i });
    return await removeButton.isVisible({ timeout: 1000 }).catch(() => false);
  }

  async clearImplantSlot(slotName: string) {
    const slot = this.page.locator(`[data-testid="implant-slot-${slotName}"]`);
    const removeButton = slot.getByRole('button', { name: /remove|clear/i });
    await removeButton.click();
    await this.page.waitForTimeout(500);
  }

  async clearAllImplants() {
    const clearAllButton = this.page.getByRole('button', { name: /clear.*all/i });
    await clearAllButton.click();
    await this.page.waitForTimeout(500);
  }
}

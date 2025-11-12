import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for TinkerItems (Item Search) page
 *
 * Handles:
 * - Item searching by name
 * - Filtering by quality level, slot, etc.
 * - Viewing item details
 * - Pagination
 */
export class ItemSearchPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly qualityLevelFilter: Locator;
  readonly slotFilter: Locator;
  readonly itemResults: Locator;
  readonly paginationControls: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder(/search.*items?/i);
    this.searchButton = page.getByRole('button', { name: /search/i });
    this.qualityLevelFilter = page.getByLabel(/quality.*level/i);
    this.slotFilter = page.getByLabel(/slot/i);
    this.itemResults = page.locator('[data-testid="item-results"]');
    this.paginationControls = page.locator('[data-testid="pagination"]');
  }

  async goto() {
    await this.page.goto('/items');
    await this.page.waitForLoadState('networkidle');
  }

  async searchByName(itemName: string) {
    await this.searchInput.fill(itemName);
    await this.searchButton.click();
    // Wait for results to load
    await this.page.waitForTimeout(500);
  }

  async filterByQualityLevel(ql: number) {
    await this.qualityLevelFilter.fill(ql.toString());
    await this.page.waitForTimeout(500);
  }

  async filterBySlot(slot: string) {
    await this.slotFilter.selectOption(slot);
    await this.page.waitForTimeout(500);
  }

  async getItemCount(): Promise<number> {
    return await this.page.locator('[data-testid="item-card"]').count();
  }

  async clickItemByName(itemName: string) {
    await this.page.getByText(itemName, { exact: true }).first().click();
    await this.page.waitForLoadState('networkidle');
  }

  async hasItem(itemName: string): Promise<boolean> {
    return await this.page.getByText(itemName).isVisible({ timeout: 2000 }).catch(() => false);
  }

  async goToNextPage() {
    const nextButton = this.page.getByRole('button', { name: /next/i });
    await nextButton.click();
    await this.page.waitForTimeout(500);
  }

  async goToPreviousPage() {
    const prevButton = this.page.getByRole('button', { name: /previous|prev/i });
    await prevButton.click();
    await this.page.waitForTimeout(500);
  }
}

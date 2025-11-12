import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for TinkerNanos (Nano Program Search) page
 *
 * Handles:
 * - Nano searching by name
 * - Filtering by profession, school, etc.
 * - Viewing nano requirements
 * - Checking nano compatibility with current profile
 */
export class NanoPage {
  readonly page: Page;
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly professionFilter: Locator;
  readonly schoolFilter: Locator;
  readonly nanoResults: Locator;

  constructor(page: Page) {
    this.page = page;
    this.searchInput = page.getByPlaceholder(/search.*nano/i);
    this.searchButton = page.getByRole('button', { name: /search/i });
    this.professionFilter = page.getByLabel(/profession/i);
    this.schoolFilter = page.getByLabel(/school/i);
    this.nanoResults = page.locator('[data-testid="nano-results"]');
  }

  async goto() {
    await this.page.goto('/nanos');
    await this.page.waitForLoadState('networkidle');
  }

  async searchByName(nanoName: string) {
    await this.searchInput.fill(nanoName);
    await this.searchButton.click();
    // Wait for results to load
    await this.page.waitForTimeout(500);
  }

  async filterByProfession(profession: string) {
    await this.professionFilter.selectOption(profession);
    await this.page.waitForTimeout(500);
  }

  async filterBySchool(school: string) {
    await this.schoolFilter.selectOption(school);
    await this.page.waitForTimeout(500);
  }

  async getNanoCount(): Promise<number> {
    return await this.page.locator('[data-testid="nano-card"]').count();
  }

  async clickNanoByName(nanoName: string) {
    await this.page.getByText(nanoName, { exact: true }).first().click();
    await this.page.waitForLoadState('networkidle');
  }

  async hasNano(nanoName: string): Promise<boolean> {
    return await this.page.getByText(nanoName).isVisible({ timeout: 2000 }).catch(() => false);
  }

  /**
   * Check if a nano is marked as compatible (green) or incompatible (red)
   */
  async getNanoCompatibilityStatus(nanoName: string): Promise<'compatible' | 'incompatible' | 'unknown'> {
    const nanoCard = this.page.locator('[data-testid="nano-card"]', { hasText: nanoName }).first();

    // Check for compatibility indicator classes/colors
    const isCompatible = await nanoCard.locator('[data-testid="compatibility-indicator"].compatible, .text-green-500, .bg-green-100').isVisible({ timeout: 1000 }).catch(() => false);
    const isIncompatible = await nanoCard.locator('[data-testid="compatibility-indicator"].incompatible, .text-red-500, .bg-red-100').isVisible({ timeout: 1000 }).catch(() => false);

    if (isCompatible) return 'compatible';
    if (isIncompatible) return 'incompatible';
    return 'unknown';
  }

  /**
   * Get nano requirements text
   */
  async getNanoRequirements(nanoName: string): Promise<string> {
    const nanoCard = this.page.locator('[data-testid="nano-card"]', { hasText: nanoName }).first();
    const requirementsSection = nanoCard.locator('[data-testid="nano-requirements"]');
    return await requirementsSection.textContent() || '';
  }
}

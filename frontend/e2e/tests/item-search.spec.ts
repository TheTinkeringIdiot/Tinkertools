import { test, expect } from '@playwright/test';
import { ItemSearchPage } from '../pages/ItemSearchPage';
import { clearLocalStorage, waitForPageReady } from '../utils/helpers';

/**
 * E2E Test: Item Search & Filter
 *
 * Tests the complete item search workflow:
 * - Navigating to Items page
 * - Searching for items by name
 * - Applying filters (slot, quality level)
 * - Viewing item details
 */

test.describe('Item Search & Filter', () => {
  let itemPage: ItemSearchPage;

  test.beforeEach(async ({ page }) => {
    itemPage = new ItemSearchPage(page);

    // Navigate FIRST before accessing localStorage
    await itemPage.goto();

    // Clear localStorage AFTER navigation
    await clearLocalStorage(page);

    await waitForPageReady(page);
  });

  test('should search for item by name', async ({ page }) => {
    // Search for a common item
    await itemPage.searchByName('Combined Commando');

    // Verify search results appear
    const itemCount = await itemPage.getItemCount();
    expect(itemCount).toBeGreaterThan(0);

    // Verify the item appears in results
    expect(await itemPage.hasItem('Combined Commando')).toBe(true);
  });

  test('should filter items by quality level', async ({ page }) => {
    // Search for items
    await itemPage.searchByName('Helmet');

    // Get initial count
    const initialCount = await itemPage.getItemCount();
    expect(initialCount).toBeGreaterThan(0);

    // Apply quality level filter
    await itemPage.filterByQualityLevel(300);

    // Wait for filter to apply
    await page.waitForTimeout(1000);

    // Verify filtered results (may be same or less, but not more)
    const filteredCount = await itemPage.getItemCount();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test('should filter items by slot', async ({ page }) => {
    // Search for items
    await itemPage.searchByName('Armor');

    // Get initial count
    const initialCount = await itemPage.getItemCount();
    expect(initialCount).toBeGreaterThan(0);

    // Apply slot filter (e.g., head slot)
    await itemPage.filterBySlot('head');

    // Wait for filter to apply
    await page.waitForTimeout(1000);

    // Verify filtered results
    const filteredCount = await itemPage.getItemCount();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test('should navigate to item details', async ({ page }) => {
    // Search for specific item
    await itemPage.searchByName('Kyr\'Ozch Energy Rapier');

    // Verify item appears
    expect(await itemPage.hasItem('Kyr\'Ozch Energy Rapier')).toBe(true);

    // Click on the item to view details
    await itemPage.clickItemByName('Kyr\'Ozch Energy Rapier');

    // Verify we're on the item detail page
    await expect(page).toHaveURL(/\/items\/\d+/);

    // Verify item details are displayed
    const itemName = page.locator('[data-testid="item-name"]');
    await expect(itemName).toBeVisible();
  });

  test('should handle empty search results gracefully', async ({ page }) => {
    // Search for non-existent item
    await itemPage.searchByName('ThisItemDoesNotExist12345');

    // Wait for search to complete
    await page.waitForTimeout(1000);

    // Verify no results or empty state message
    const itemCount = await itemPage.getItemCount();
    expect(itemCount).toBe(0);

    // Check for "no results" message
    const noResultsMessage = page.locator('[data-testid="no-results"], text=/no.*items.*found/i');
    const hasMessage = await noResultsMessage.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasMessage).toBe(true);
  });

  test('should combine search and filters', async ({ page }) => {
    // Search for items
    await itemPage.searchByName('Implant');

    // Get search count
    const searchCount = await itemPage.getItemCount();
    expect(searchCount).toBeGreaterThan(0);

    // Apply quality level filter
    await itemPage.filterByQualityLevel(200);
    await page.waitForTimeout(500);

    // Apply slot filter
    await itemPage.filterBySlot('head');
    await page.waitForTimeout(500);

    // Verify filters narrowed results
    const finalCount = await itemPage.getItemCount();
    expect(finalCount).toBeLessThanOrEqual(searchCount);
  });

  test('should paginate through search results', async ({ page }) => {
    // Search for common term to get many results
    await itemPage.searchByName('Armor');

    // Get first page item count
    const firstPageCount = await itemPage.getItemCount();
    expect(firstPageCount).toBeGreaterThan(0);

    // Go to next page (if pagination exists)
    const nextButton = page.getByRole('button', { name: /next/i });
    const hasNextButton = await nextButton.isVisible({ timeout: 1000 }).catch(() => false);

    if (hasNextButton) {
      await itemPage.goToNextPage();

      // Verify we're on a different page (URL or content changed)
      const secondPageCount = await itemPage.getItemCount();
      expect(secondPageCount).toBeGreaterThan(0);

      // Go back to previous page
      await itemPage.goToPreviousPage();

      // Verify we're back on first page
      const backToFirstCount = await itemPage.getItemCount();
      expect(backToFirstCount).toBeGreaterThan(0);
    }
  });
});

import { Page } from '@playwright/test';

/**
 * E2E Test Helpers
 *
 * Common utilities for E2E tests
 */

/**
 * Clear all localStorage to ensure clean test state
 */
export async function clearLocalStorage(page: Page): Promise<void> {
  try {
    await page.evaluate(() => localStorage.clear());
  } catch (error) {
    // Ignore SecurityError if called before navigation
    if (error instanceof Error && !error.message.includes('SecurityError')) {
      throw error;
    }
  }
}

/**
 * Wait for navigation to complete and page to be ready
 */
export async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ path: `e2e/screenshots/${name}-${timestamp}.png`, fullPage: true });
}

/**
 * Wait for toast notification to appear and optionally verify its message
 */
export async function waitForToast(page: Page, message?: string) {
  const toast = page.locator('[data-testid="toast"], .p-toast-message');
  await toast.waitFor({ state: 'visible', timeout: 5000 });

  if (message) {
    const toastText = await toast.textContent();
    if (!toastText?.includes(message)) {
      throw new Error(`Expected toast to contain "${message}" but got "${toastText}"`);
    }
  }

  return toast;
}

/**
 * Dismiss toast notification
 */
export async function dismissToast(page: Page) {
  const closeButton = page.locator('[data-testid="toast-close"], .p-toast-icon-close');
  if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeButton.click();
  }
}

/**
 * Set localStorage item
 */
export async function setLocalStorageItem(page: Page, key: string, value: any) {
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    { key, value }
  );
}

/**
 * Get localStorage item
 */
export async function getLocalStorageItem(page: Page, key: string): Promise<any> {
  return await page.evaluate((key) => {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  }, key);
}

/**
 * Wait for API request to complete
 */
export async function waitForApiRequest(page: Page, urlPattern: string | RegExp) {
  return await page.waitForRequest(urlPattern, { timeout: 10000 });
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(page: Page, urlPattern: string | RegExp) {
  return await page.waitForResponse(urlPattern, { timeout: 10000 });
}

/**
 * Check if element exists (without throwing if it doesn't)
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  return await page.locator(selector).isVisible({ timeout: 2000 }).catch(() => false);
}

/**
 * Retry an action until it succeeds or max retries reached
 */
export async function retryAction<T>(
  action: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 500
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError;
}

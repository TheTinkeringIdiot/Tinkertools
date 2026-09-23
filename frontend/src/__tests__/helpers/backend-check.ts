/**
 * Backend Availability Helper
 *
 * Utility for checking if the backend is available for integration tests.
 * Tests that require a real backend should skip if it's not available:
 *
 *   const BACKEND_AVAILABLE = await isBackendAvailable();
 *   describe.skipIf(!BACKEND_AVAILABLE)('...', () => { ... });
 *
 * The check must be awaited at the top level of the test file: skipIf is
 * evaluated while tests are collected, before any beforeAll hook runs.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

let backendAvailable: boolean | null = null;

/**
 * Check if the backend is available by making a lightweight request
 */
export async function isBackendAvailable(): Promise<boolean> {
  // Cache result to avoid repeated checks
  if (backendAvailable !== null) {
    return backendAvailable;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });
    backendAvailable = response.ok;
  } catch {
    backendAvailable = false;
  }

  return backendAvailable;
}

/**
 * Reset the cached backend availability check
 * Useful for testing or when you want to force a recheck
 */
export function resetBackendCheck() {
  backendAvailable = null;
}

/**
 * Get the backend URL being used for tests
 */
export function getBackendUrl(): string {
  return BACKEND_URL;
}

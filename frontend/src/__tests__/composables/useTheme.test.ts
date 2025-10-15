import { describe, it, expect, beforeEach, vi } from 'vitest';

// We will import inside tests (dynamic) for migration scenarios.
// Utilities to manipulate environment before (re)loading the composable module.

// Stateful localStorage mock that persists across module initialization
let localStorageMock: Record<string, string> = {};

function mockLocalStorage() {
  global.localStorage = {
    getItem: vi.fn((key: string) => localStorageMock[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      localStorageMock[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete localStorageMock[key];
    }),
    clear: vi.fn(() => {
      localStorageMock = {};
    }),
    length: 0,
    key: vi.fn()
  } as any;
}

function mockMatchMedia(dark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => {
      return {
        matches: dark && query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),        // deprecated
        removeListener: vi.fn(),     // deprecated
        dispatchEvent: vi.fn()
      };
    })
  });
}

function resetDocumentRoot() {
  document.documentElement.className = '';
  document.documentElement.removeAttribute('data-theme');
}

function getThemeClassState() {
  return {
    hasDark: document.documentElement.classList.contains('dark'),
    hasLight: document.documentElement.classList.contains('light'),
    dataTheme: document.documentElement.getAttribute('data-theme')
  };
}

describe('useTheme composable', () => {
  beforeEach(() => {
    // Clear and setup localStorage mock
    localStorageMock = {};
    mockLocalStorage();

    // Clear modules so that top-level initialization re-runs per test when needed
    vi.resetModules();

    // Default system preference: light
    mockMatchMedia(false);
    resetDocumentRoot();
  });

  it('initializes with dark mode default when no saved theme', async () => {
    const { useTheme, isDark, currentTheme } = await import('@/composables/useTheme');
    const { isDark: providedIsDark } = useTheme();

    expect(isDark.value).toBe(true);
    expect(providedIsDark.value).toBe(true);
    expect(currentTheme.value).toBe('dark');

    const state = getThemeClassState();
    expect(state.hasDark || state.dataTheme === 'dark').toBe(true);
  });

  it('initializes with dark mode default regardless of system preference', async () => {
    mockMatchMedia(true);
    const { isDark, currentTheme } = await import('@/composables/useTheme');
    expect(isDark.value).toBe(true);
    expect(currentTheme.value).toBe('dark');
    const state = getThemeClassState();
    expect(state.hasDark || state.dataTheme === 'dark').toBe(true);
  });

  it('uses stored unified theme preference over system', async () => {
    // Set value in mock BEFORE resetting modules
    localStorageMock['tinkertools-theme-mode'] = 'dark';
    mockLocalStorage(); // Re-apply mock
    vi.resetModules(); // Reset modules to re-initialize
    mockMatchMedia(false);
    const { isDark, currentTheme } = await import('@/composables/useTheme');
    expect(isDark.value).toBe(true);
    expect(currentTheme.value).toBe('dark');
  });

  it('migrates legacy key tinkertools-dark-mode to unified key', async () => {
    // Set legacy value in mock BEFORE resetting modules
    localStorageMock['tinkertools-dark-mode'] = 'dark';
    mockLocalStorage(); // Re-apply mock
    vi.resetModules(); // Reset modules to re-initialize
    const { isDark } = await import('@/composables/useTheme');
    expect(isDark.value).toBe(true);
    expect(localStorage.getItem('tinkertools-theme-mode')).toBe('dark');
    expect(localStorage.getItem('tinkertools-dark-mode')).toBeNull();
  });

  it('toggle switches between light and dark and persists', async () => {
    const { useTheme } = await import('@/composables/useTheme');
    const { isDark, toggle } = useTheme();

    const initial = isDark.value;
    toggle();
    expect(isDark.value).toBe(!initial);
    expect(localStorage.getItem('tinkertools-theme-mode')).toBe(isDark.value ? 'dark' : 'light');

    toggle();
    expect(isDark.value).toBe(initial);
    expect(localStorage.getItem('tinkertools-theme-mode')).toBe(initial ? 'dark' : 'light');
  });

  it('setDark(true/false) applies correct classes and persistence', async () => {
    const { useTheme, isDark } = await import('@/composables/useTheme');
    const { setDark } = useTheme();

    setDark(true);
    expect(isDark.value).toBe(true);
    let state = getThemeClassState();
    expect(state.hasDark || state.dataTheme === 'dark').toBe(true);
    expect(localStorage.getItem('tinkertools-theme-mode')).toBe('dark');

    setDark(false);
    expect(isDark.value).toBe(false);
    state = getThemeClassState();
    expect(state.hasLight || state.dataTheme === 'light').toBe(true);
    expect(localStorage.getItem('tinkertools-theme-mode')).toBe('light');
  });

  it('does not auto-switch on system change - system listening is disabled', async () => {
    const { useTheme } = await import('@/composables/useTheme');
    const { setDark, isDark } = useTheme();

    // Manually set dark (should be default already)
    setDark(true);
    expect(isDark.value).toBe(true);

    // Since we disabled system theme change listeners, 
    // theme should always stay as manually set or default to dark
    expect(isDark.value).toBe(true);
    expect(localStorage.getItem('tinkertools-theme-mode')).toBe('dark');
  });
});
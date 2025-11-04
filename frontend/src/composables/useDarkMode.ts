/**
 * Deprecated legacy dark mode composable.
 * This file now delegates entirely to the unified theme system in [useTheme.ts](frontend/src/composables/useTheme.ts:1)
 * to avoid duplicate state, conflicting localStorage keys, and race conditions.
 *
 * Migration Notes:
 * - Previous localStorage key 'tinkertools-dark-mode' is no longer used.
 * - Unified storage key: 'tinkertools-theme-mode' (managed in useTheme.ts).
 * - Remove direct imports of useDarkMode where possible and use useTheme instead.
 */

import type { Ref } from 'vue';
import { useTheme, isDark } from './useTheme'; // Single source of truth

export interface DarkModeState {
  isDark: Ref<boolean>;
  toggle: () => void;
  setDark: (value: boolean) => void;
  setLight: (value: boolean) => void;
}

/**
 * Backwards-compatible wrapper preserving the old API surface.
 * Internally proxies to the unified theme composable.
 */
export function useDarkMode(): DarkModeState {
  const { isDark: themeIsDark, toggle, setDark } = useTheme();

  const setLight = (value: boolean) => {
    setDark(!value);
  };

  return {
    isDark: themeIsDark,
    toggle,
    setDark,
    setLight,
  };
}

// Re-export unified reactive ref for legacy imports
export { isDark };

/**
 * Global Theme Management System
 * Provides application-wide dark/light mode control with persistence and system preference detection
 * Elevates theme management to the global application level
 */

import { ref, watch, computed, type Ref } from 'vue';

export type ThemeMode = 'light' | 'dark';

export interface ThemeState {
  isDark: Ref<boolean>;
  currentTheme: Ref<ThemeMode>;
  toggle: () => void;
  setTheme: (theme: ThemeMode) => void;
  setDark: (dark: boolean) => void;
}

// ============================================================================
// Global Theme State (Singleton Pattern)
// ============================================================================

const STORAGE_KEY = 'tinkertools-theme-mode';
const currentTheme = ref<ThemeMode>('light');
const isDark = computed(() => currentTheme.value === 'dark');

// ============================================================================
// Theme Application Functions
// ============================================================================

/**
 * Apply theme to document element
 */
function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return; // SSR safety
  
  const htmlElement = document.documentElement;
  
  // Remove existing theme classes
  htmlElement.classList.remove('dark', 'light');
  
  // Apply new theme
  htmlElement.classList.add(theme);
  htmlElement.setAttribute('data-theme', theme);
  
  // Set CSS custom properties for theme-aware components
  htmlElement.style.setProperty('--theme-mode', theme);
}


/**
 * Get system preferred theme
 */
function getSystemTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

/**
 * Get saved theme preference or dark default
 */
function getInitialTheme(): ThemeMode {
  if (typeof localStorage === 'undefined') return 'dark'; // Default to dark mode
  
  const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
  
  // Migration: legacy dark mode key ('tinkertools-dark-mode') -> unified STORAGE_KEY
  if (!saved) {
    const legacy = localStorage.getItem('tinkertools-dark-mode');
    if (legacy) {
      const migrated = legacy === 'dark' ? 'dark' : 'light';
      try {
        localStorage.setItem(STORAGE_KEY, migrated);
        localStorage.removeItem('tinkertools-dark-mode');
        return migrated;
      } catch {
        // Fallback to migrated value even if persisting failed
        return migrated;
      }
    }
  }
  
  return saved || 'dark'; // Default to dark mode instead of system preference
}

/**
 * Save theme preference to localStorage
 */
function saveTheme(theme: ThemeMode): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, theme);
}

// ============================================================================
// Global Theme Initialization (runs immediately on module load)
// ============================================================================

// Initialize theme state
currentTheme.value = getInitialTheme();
applyTheme(currentTheme.value);

// Watch for theme changes and persist + apply
watch(currentTheme, (newTheme) => {
  applyTheme(newTheme);
  saveTheme(newTheme);
}, { immediate: false }); // Don't trigger on initialization since we already applied

// System theme changes are disabled - we always default to dark mode
// Users can manually toggle between light and dark modes using the UI controls

// ============================================================================
// Theme Composable (provides reactive theme state and controls)
// ============================================================================

export function useTheme(): ThemeState {
  const toggle = () => {
    currentTheme.value = currentTheme.value === 'dark' ? 'light' : 'dark';
  };
  
  const setTheme = (theme: ThemeMode) => {
    currentTheme.value = theme;
  };
  
  const setDark = (dark: boolean) => {
    currentTheme.value = dark ? 'dark' : 'light';
  };
  
  return {
    isDark,
    currentTheme,
    toggle,
    setTheme,
    setDark
  };
}

// ============================================================================
// Legacy Compatibility (for existing useDarkMode imports)
// ============================================================================

export interface DarkModeState {
  isDark: Ref<boolean>;
  toggle: () => void;
  setDark: (value: boolean) => void;
  setLight: (value: boolean) => void;
}

export function useDarkMode(): DarkModeState {
  const { isDark: _isDark, toggle, setDark } = useTheme();
  
  const setLight = (value: boolean) => {
    setDark(!value);
  };
  
  return {
    isDark: _isDark,
    toggle,
    setDark,
    setLight
  };
}

// Export reactive refs for direct access
export { isDark, currentTheme };

// Default export for convenience
export default useTheme;
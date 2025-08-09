/**
 * Theme Utilities
 * Provides helper functions for theme-aware components across the application
 */

import { currentTheme, isDark } from '@/composables/useTheme';
import type { ThemeMode } from '@/composables/useTheme';

/**
 * Get the current theme mode
 */
export const getCurrentTheme = (): ThemeMode => currentTheme.value;

/**
 * Check if the current theme is dark
 */
export const isCurrentThemeDark = (): boolean => isDark.value;

/**
 * Get theme-aware CSS classes
 */
export const getThemeClasses = (lightClass: string, darkClass: string): string => {
  return isDark.value ? darkClass : lightClass;
};

/**
 * Get conditional theme-based value
 */
export const getThemeValue = <T>(lightValue: T, darkValue: T): T => {
  return isDark.value ? darkValue : lightValue;
};

/**
 * Common theme-aware color schemes
 */
export const themeColors = {
  get surface() {
    return getThemeValue('bg-surface-0', 'bg-surface-950');
  },
  get surfaceVariant() {
    return getThemeValue('bg-surface-50', 'bg-surface-900');
  },
  get text() {
    return getThemeValue('text-surface-900', 'text-surface-50');
  },
  get textSecondary() {
    return getThemeValue('text-surface-600', 'text-surface-400');
  },
  get border() {
    return getThemeValue('border-surface-200', 'border-surface-700');
  }
};

/**
 * Get PrimeVue theme-aware severity colors
 */
export const getThemeSeverity = (severity: 'info' | 'success' | 'warn' | 'error' | 'secondary' = 'info') => {
  const severityMap = {
    info: getThemeValue('info', 'info'),
    success: getThemeValue('success', 'success'), 
    warn: getThemeValue('warn', 'warn'),
    error: getThemeValue('danger', 'danger'),
    secondary: getThemeValue('secondary', 'secondary')
  };
  
  return severityMap[severity];
};

/**
 * Theme-aware icon helper
 */
export const getThemeIcon = (lightIcon: string, darkIcon: string): string => {
  return getThemeValue(lightIcon, darkIcon);
};

export default {
  getCurrentTheme,
  isCurrentThemeDark,
  getThemeClasses,
  getThemeValue,
  themeColors,
  getThemeSeverity,
  getThemeIcon
};
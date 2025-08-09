import { ref, watch, onMounted, type Ref } from 'vue';

export interface DarkModeState {
  isDark: Ref<boolean>;
  toggle: () => void;
  setDark: (value: boolean) => void;
  setLight: (value: boolean) => void;
}

const isDark = ref(false);

export function useDarkMode(): DarkModeState {
  const toggle = () => {
    isDark.value = !isDark.value;
  };

  const setDark = (value: boolean) => {
    isDark.value = value;
  };

  const setLight = (value: boolean) => {
    isDark.value = !value;
  };

  // Apply dark mode class to document
  const applyTheme = (dark: boolean) => {
    if (dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  };

  // Watch for changes and apply theme
  watch(isDark, (newValue) => {
    applyTheme(newValue);
    // Save preference to localStorage
    localStorage.setItem('tinkertools-dark-mode', newValue ? 'dark' : 'light');
  }, { immediate: false });

  // Initialize on mount
  onMounted(() => {
    // Check for saved preference
    const saved = localStorage.getItem('tinkertools-dark-mode');
    if (saved) {
      isDark.value = saved === 'dark';
    } else {
      // Check system preference
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    // Apply initial theme
    applyTheme(isDark.value);

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-change if no manual preference is saved
      if (!localStorage.getItem('tinkertools-dark-mode')) {
        isDark.value = e.matches;
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    // Cleanup listener (though this is usually not needed in practice)
    return () => mediaQuery.removeEventListener('change', handleChange);
  });

  return {
    isDark,
    toggle,
    setDark,
    setLight
  };
}

// Export reactive ref for direct access
export { isDark };
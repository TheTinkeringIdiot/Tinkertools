import { ref, nextTick } from 'vue';

export function useAccessibility() {
  const isLoading = ref(false);

  // Announce text to screen readers through the app-wide AccessibilityAnnouncer live regions
  const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    window.dispatchEvent(new CustomEvent(`announce-${priority}`, { detail: { message } }));
  };

  // Focus management utilities
  const focusElement = async (selector: string | HTMLElement) => {
    await nextTick();
    const element =
      typeof selector === 'string' ? document.querySelector<HTMLElement>(selector) : selector;

    if (element && typeof element.focus === 'function') {
      element.focus();
    }
  };

  // Skip to main content
  const skipToMain = () => {
    const mainElement = document.getElementById('main-content');
    if (mainElement) {
      mainElement.focus();
      mainElement.scrollIntoView();
    }
  };

  // Loading state management with announcements
  const setLoading = (loading: boolean, message?: string) => {
    isLoading.value = loading;
    if (loading && message) {
      announce(message, 'polite');
    } else if (!loading) {
      announce('Loading complete', 'polite');
    }
  };

  // Error announcement
  const announceError = (error: string) => {
    announce(`Error: ${error}`, 'assertive');
  };

  // Success announcement
  const announceSuccess = (message: string) => {
    announce(`Success: ${message}`, 'polite');
  };

  // Keyboard navigation helpers
  const handleEscapeKey = (callback: () => void) => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        callback();
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  };

  const handleArrowKeys = (
    upCallback?: () => void,
    downCallback?: () => void,
    leftCallback?: () => void,
    rightCallback?: () => void
  ) => {
    const handler = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          if (upCallback) {
            event.preventDefault();
            upCallback();
          }
          break;
        case 'ArrowDown':
          if (downCallback) {
            event.preventDefault();
            downCallback();
          }
          break;
        case 'ArrowLeft':
          if (leftCallback) {
            event.preventDefault();
            leftCallback();
          }
          break;
        case 'ArrowRight':
          if (rightCallback) {
            event.preventDefault();
            rightCallback();
          }
          break;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  };

  return {
    // State
    isLoading,

    // Methods
    announce,
    focusElement,
    skipToMain,
    setLoading,
    announceError,
    announceSuccess,
    handleEscapeKey,
    handleArrowKeys,
  };
}

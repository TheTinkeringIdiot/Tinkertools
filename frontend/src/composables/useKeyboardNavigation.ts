import { onMounted, onUnmounted, Ref } from 'vue';

interface KeyboardNavigationOptions {
  // Element selectors for focusable items
  itemSelector?: string;
  // Container selector
  containerSelector?: string;
  // Enable looping navigation
  loop?: boolean;
  // Enable escape key handling
  enableEscape?: boolean;
  // Callback for escape key
  onEscape?: () => void;
  // Enable enter/space activation
  enableActivation?: boolean;
  // Callback for activation
  onActivate?: (index: number, element: HTMLElement) => void;
}

export function useKeyboardNavigation(
  options: KeyboardNavigationOptions = {}
) {
  const {
    itemSelector = '[data-keyboard-nav-item]',
    containerSelector = '[data-keyboard-nav-container]',
    loop = true,
    enableEscape = false,
    onEscape,
    enableActivation = false,
    onActivate
  } = options;

  let currentIndex = -1;
  let items: HTMLElement[] = [];

  const updateItems = () => {
    const container = containerSelector 
      ? document.querySelector(containerSelector) 
      : document;
    
    items = Array.from(
      container?.querySelectorAll(itemSelector) || []
    ) as HTMLElement[];
  };

  const setFocus = (index: number) => {
    if (index >= 0 && index < items.length) {
      currentIndex = index;
      items[index]?.focus();
    }
  };

  const moveFocus = (direction: 'next' | 'previous' | 'first' | 'last') => {
    updateItems();
    
    if (items.length === 0) return;

    let newIndex = currentIndex;

    switch (direction) {
      case 'next':
        newIndex = currentIndex + 1;
        if (newIndex >= items.length) {
          newIndex = loop ? 0 : items.length - 1;
        }
        break;
      
      case 'previous':
        newIndex = currentIndex - 1;
        if (newIndex < 0) {
          newIndex = loop ? items.length - 1 : 0;
        }
        break;
      
      case 'first':
        newIndex = 0;
        break;
      
      case 'last':
        newIndex = items.length - 1;
        break;
    }

    setFocus(newIndex);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    // Only handle navigation if focus is within the container
    const activeElement = document.activeElement as HTMLElement;
    const isWithinContainer = containerSelector
      ? activeElement?.closest(containerSelector)
      : items.includes(activeElement);

    if (!isWithinContainer) return;

    // Update current index based on focused element
    currentIndex = items.indexOf(activeElement);

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault();
        moveFocus('next');
        break;
      
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault();
        moveFocus('previous');
        break;
      
      case 'Home':
        event.preventDefault();
        moveFocus('first');
        break;
      
      case 'End':
        event.preventDefault();
        moveFocus('last');
        break;
      
      case 'Escape':
        if (enableEscape && onEscape) {
          event.preventDefault();
          onEscape();
        }
        break;
      
      case 'Enter':
      case ' ':
        if (enableActivation && onActivate && currentIndex >= 0) {
          event.preventDefault();
          onActivate(currentIndex, items[currentIndex]);
        }
        break;
    }
  };

  const focusFirst = () => {
    updateItems();
    setFocus(0);
  };

  const focusLast = () => {
    updateItems();
    setFocus(items.length - 1);
  };

  const focusItem = (index: number) => {
    updateItems();
    setFocus(index);
  };

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
    updateItems();
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  return {
    moveFocus,
    focusFirst,
    focusLast,
    focusItem,
    updateItems
  };
}

// Table-specific keyboard navigation
export function useTableKeyboardNavigation(
  tableRef: Ref<HTMLElement | undefined>,
  options: {
    onRowActivate?: (rowIndex: number, rowElement: HTMLElement) => void;
    onEscape?: () => void;
  } = {}
) {
  const { onRowActivate, onEscape } = options;

  return useKeyboardNavigation({
    itemSelector: 'tr[tabindex]:not([disabled])',
    containerSelector: 'table',
    loop: true,
    enableEscape: true,
    enableActivation: true,
    onEscape,
    onActivate: onRowActivate
  });
}

// Menu keyboard navigation
export function useMenuKeyboardNavigation(
  menuRef: Ref<HTMLElement | undefined>,
  options: {
    onItemActivate?: (itemIndex: number, itemElement: HTMLElement) => void;
    onEscape?: () => void;
  } = {}
) {
  const { onItemActivate, onEscape } = options;

  return useKeyboardNavigation({
    itemSelector: '[role="menuitem"]:not([disabled])',
    loop: true,
    enableEscape: true,
    enableActivation: true,
    onEscape,
    onActivate: onItemActivate
  });
}
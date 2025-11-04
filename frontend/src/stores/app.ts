/**
 * App Store - Global application state and cross-application integration
 *
 * Manages global loading states, errors, navigation, and shared context
 */

import { defineStore } from 'pinia';
import { ref, computed, readonly } from 'vue';
import type { UserFriendlyError, Item, Symbiant, PocketBoss } from '../types/api';
import { cacheManager } from '../services/cache-manager';

export type ApplicationName = 'items' | 'nanos' | 'fite' | 'plants' | 'pocket' | 'nukes';

export interface CrossAppContext {
  sourceApp: ApplicationName;
  targetApp: ApplicationName;
  contextData: any;
  timestamp: number;
}

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
  timestamp: number;
  persistent?: boolean;
}

export interface GlobalLoadingState {
  isLoading: boolean;
  operation: string;
  progress?: number;
  subtitle?: string;
}

export const useAppStore = defineStore('app', () => {
  // ============================================================================
  // State
  // ============================================================================

  const initialized = ref(false);
  const currentApp = ref<ApplicationName>('items');
  const globalLoading = ref<GlobalLoadingState>({
    isLoading: false,
    operation: '',
  });

  const notifications = ref<AppNotification[]>([]);
  const crossAppContext = ref<CrossAppContext | null>(null);
  const keyboardShortcutsEnabled = ref(true);
  const offlineMode = ref(false);
  const connectionStatus = ref<'online' | 'offline' | 'reconnecting'>('online');

  // Shared selection states
  const selectedItems = ref<Item[]>([]);
  const selectedSymbiants = ref<Symbiant[]>([]);
  const selectedPocketBosses = ref<PocketBoss[]>([]);

  // Global error state
  const globalError = ref<UserFriendlyError | null>(null);

  // Performance monitoring
  const performanceMetrics = ref({
    apiResponseTime: 0,
    routeNavigationTime: 0,
    lastMeasurement: Date.now(),
  });

  // ============================================================================
  // Getters
  // ============================================================================

  const hasNotifications = computed(() => notifications.value.length > 0);
  const unreadNotifications = computed(() => notifications.value.filter((n) => !n.persistent));
  const persistentNotifications = computed(() => notifications.value.filter((n) => n.persistent));

  const hasSelectedItems = computed(() => selectedItems.value.length > 0);
  const hasSelectedSymbiants = computed(() => selectedSymbiants.value.length > 0);
  const hasSelectedPocketBosses = computed(() => selectedPocketBosses.value.length > 0);

  const hasAnySelection = computed(
    () => hasSelectedItems.value || hasSelectedSymbiants.value || hasSelectedPocketBosses.value
  );

  const isOffline = computed(() => offlineMode.value || connectionStatus.value === 'offline');
  const isReconnecting = computed(() => connectionStatus.value === 'reconnecting');

  const appTitle = computed(() => {
    const titles: Record<ApplicationName, string> = {
      items: 'TinkerItems - Item Database',
      nanos: 'TinkerNanos - Nano Management',
      fite: 'TinkerFite - Weapon Analysis',
      plants: 'TinkerPlants - Implant Planning',
      pocket: 'TinkerPocket - Boss Collection',
      nukes: 'TinkerNukes - Nanotechnician Specialization',
    };
    return titles[currentApp.value] || 'TinkerTools';
  });

  // ============================================================================
  // App Initialization
  // ============================================================================

  async function initialize(): Promise<void> {
    if (initialized.value) return;

    setGlobalLoading(true, 'Initializing TinkerTools...');

    try {
      // Setup connection monitoring
      setupConnectionMonitoring();

      // Setup keyboard shortcuts
      setupKeyboardShortcuts();

      // Setup performance monitoring
      setupPerformanceMonitoring();

      // Load cached data
      await loadCachedAppState();

      // Setup auto-cleanup
      setupAutoCleanup();

      initialized.value = true;

      addNotification({
        type: 'success',
        title: 'TinkerTools Ready',
        message: 'All systems initialized successfully',
        duration: 3000,
      });
    } catch (err: any) {
      setGlobalError({
        type: 'error',
        title: 'Initialization Failed',
        message: err.message || 'Failed to initialize application',
        action: 'Reload the page to try again',
        recoverable: true,
      });
    } finally {
      setGlobalLoading(false);
    }
  }

  // ============================================================================
  // Navigation and App Management
  // ============================================================================

  function setCurrentApp(app: ApplicationName): void {
    const startTime = performance.now();

    currentApp.value = app;

    // Clear cross-app context after navigation
    if (crossAppContext.value && crossAppContext.value.targetApp === app) {
      setTimeout(() => {
        crossAppContext.value = null;
      }, 100); // Small delay to allow target app to consume context
    }

    // Update page title
    if (typeof document !== 'undefined') {
      document.title = appTitle.value;
    }

    // Record navigation time
    const endTime = performance.now();
    performanceMetrics.value.routeNavigationTime = endTime - startTime;
    performanceMetrics.value.lastMeasurement = Date.now();
  }

  function navigateToApp(targetApp: ApplicationName, context?: any): void {
    crossAppContext.value = {
      sourceApp: currentApp.value,
      targetApp,
      contextData: context,
      timestamp: Date.now(),
    };

    setCurrentApp(targetApp);

    // Emit navigation event for router
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tinkertools:navigate', {
          detail: { app: targetApp, context },
        })
      );
    }
  }

  function getCrossAppContext(): CrossAppContext | null {
    return crossAppContext.value;
  }

  function clearCrossAppContext(): void {
    crossAppContext.value = null;
  }

  // ============================================================================
  // Global Loading Management
  // ============================================================================

  function setGlobalLoading(
    isLoading: boolean,
    operation = '',
    progress?: number,
    subtitle?: string
  ): void {
    globalLoading.value = {
      isLoading,
      operation,
      progress,
      subtitle,
    };

    // Update page loading indicator
    if (typeof document !== 'undefined') {
      if (isLoading) {
        document.body.classList.add('app-loading');
      } else {
        document.body.classList.remove('app-loading');
      }
    }
  }

  function updateLoadingProgress(progress: number, subtitle?: string): void {
    if (globalLoading.value.isLoading) {
      globalLoading.value.progress = progress;
      if (subtitle) {
        globalLoading.value.subtitle = subtitle;
      }
    }
  }

  // ============================================================================
  // Notification Management
  // ============================================================================

  function addNotification(notification: Omit<AppNotification, 'id' | 'timestamp'>): string {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const fullNotification: AppNotification = {
      ...notification,
      id,
      timestamp: Date.now(),
    };

    notifications.value.push(fullNotification);

    // Auto-remove after duration (if specified)
    if (notification.duration && !notification.persistent) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration);
    }

    return id;
  }

  function removeNotification(id: string): void {
    const index = notifications.value.findIndex((n) => n.id === id);
    if (index > -1) {
      notifications.value.splice(index, 1);
    }
  }

  function clearAllNotifications(): void {
    notifications.value = [];
  }

  function clearNonPersistentNotifications(): void {
    notifications.value = notifications.value.filter((n) => n.persistent);
  }

  // ============================================================================
  // Error Management
  // ============================================================================

  function setGlobalError(error: UserFriendlyError | null): void {
    globalError.value = error;

    if (error) {
      addNotification({
        type: error.type,
        title: error.title,
        message: error.message,
        persistent: !error.recoverable,
        duration: error.recoverable ? 5000 : undefined,
      });
    }
  }

  function clearGlobalError(): void {
    globalError.value = null;
  }

  // ============================================================================
  // Selection Management
  // ============================================================================

  function addSelectedItem(item: Item): void {
    if (!selectedItems.value.find((i) => i.id === item.id)) {
      selectedItems.value.push(item);
    }
  }

  function removeSelectedItem(itemId: number): void {
    const index = selectedItems.value.findIndex((i) => i.id === itemId);
    if (index > -1) {
      selectedItems.value.splice(index, 1);
    }
  }

  function clearSelectedItems(): void {
    selectedItems.value = [];
  }

  function toggleItemSelection(item: Item): void {
    if (selectedItems.value.find((i) => i.id === item.id)) {
      removeSelectedItem(item.id);
    } else {
      addSelectedItem(item);
    }
  }

  function addSelectedSymbiant(symbiant: Symbiant): void {
    if (!selectedSymbiants.value.find((s) => s.id === symbiant.id)) {
      selectedSymbiants.value.push(symbiant);
    }
  }

  function removeSelectedSymbiant(symbiantId: number): void {
    const index = selectedSymbiants.value.findIndex((s) => s.id === symbiantId);
    if (index > -1) {
      selectedSymbiants.value.splice(index, 1);
    }
  }

  function clearSelectedSymbiants(): void {
    selectedSymbiants.value = [];
  }

  function clearAllSelections(): void {
    selectedItems.value = [];
    selectedSymbiants.value = [];
    selectedPocketBosses.value = [];
  }

  // ============================================================================
  // Connection and Offline Management
  // ============================================================================

  function setupConnectionMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Monitor online/offline status
    const updateConnectionStatus = () => {
      connectionStatus.value = navigator.onLine ? 'online' : 'offline';
      offlineMode.value = !navigator.onLine;

      if (navigator.onLine) {
        addNotification({
          type: 'success',
          title: 'Back Online',
          message: 'Connection restored',
          duration: 3000,
        });
      } else {
        addNotification({
          type: 'warning',
          title: 'Offline Mode',
          message: 'Working with cached data only',
          persistent: true,
        });
      }
    };

    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);

    // Initial status
    updateConnectionStatus();
  }

  function enableOfflineMode(): void {
    offlineMode.value = true;
    addNotification({
      type: 'info',
      title: 'Offline Mode Enabled',
      message: 'Working with cached data',
      duration: 3000,
    });
  }

  function disableOfflineMode(): void {
    offlineMode.value = false;
    if (connectionStatus.value === 'online') {
      addNotification({
        type: 'success',
        title: 'Online Mode Restored',
        message: 'Live data available',
        duration: 3000,
      });
    }
  }

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  function setupKeyboardShortcuts(): void {
    if (typeof document === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!keyboardShortcutsEnabled.value) return;

      // Check for modifier keys
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      // Global shortcuts
      if (isCtrlOrCmd) {
        switch (event.key.toLowerCase()) {
          case 'k':
            event.preventDefault();
            // Emit global search shortcut
            window.dispatchEvent(new CustomEvent('tinkertools:global-search'));
            break;
          case '/':
            event.preventDefault();
            // Emit focus search shortcut
            window.dispatchEvent(new CustomEvent('tinkertools:focus-search'));
            break;
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
            event.preventDefault();
            const appMap: ApplicationName[] = [
              'items',
              'nanos',
              'fite',
              'plants',
              'pocket',
              'nukes',
            ];
            const appIndex = parseInt(event.key) - 1;
            if (appMap[appIndex]) {
              navigateToApp(appMap[appIndex]);
            }
            break;
        }
      }

      // Escape key - clear selections and close modals
      if (event.key === 'Escape') {
        clearAllSelections();
        window.dispatchEvent(new CustomEvent('tinkertools:escape'));
      }
    };

    document.addEventListener('keydown', handleKeyDown);
  }

  function toggleKeyboardShortcuts(): void {
    keyboardShortcutsEnabled.value = !keyboardShortcutsEnabled.value;
  }

  // ============================================================================
  // Performance Monitoring
  // ============================================================================

  function setupPerformanceMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Monitor API response times
    window.addEventListener('tinkertools:api-request-start', ((event: CustomEvent) => {
      const startTime = performance.now();
      event.detail.startTime = startTime;
    }) as EventListener);

    window.addEventListener('tinkertools:api-request-end', ((event: CustomEvent) => {
      const endTime = performance.now();
      const responseTime = endTime - (event.detail.startTime || endTime);
      performanceMetrics.value.apiResponseTime = responseTime;
      performanceMetrics.value.lastMeasurement = Date.now();

      // Warn if response is slow
      if (responseTime > 5000) {
        addNotification({
          type: 'warning',
          title: 'Slow Response',
          message: `API request took ${Math.round(responseTime)}ms`,
          duration: 3000,
        });
      }
    }) as EventListener);
  }

  function recordPerformanceMetric(metric: string, value: number): void {
    performanceMetrics.value = {
      ...performanceMetrics.value,
      [metric]: value,
      lastMeasurement: Date.now(),
    };
  }

  // ============================================================================
  // Cache and Storage Management
  // ============================================================================

  async function loadCachedAppState(): Promise<void> {
    try {
      // Load app state from cache if available
      const cachedState = await cacheManager.get('app_state');
      if (cachedState) {
        // Restore relevant state
      }
    } catch (err) {
      console.warn('Failed to load cached app state:', err);
    }
  }

  async function saveCachedAppState(): Promise<void> {
    try {
      const appState = {
        currentApp: currentApp.value,
        keyboardShortcutsEnabled: keyboardShortcutsEnabled.value,
        timestamp: Date.now(),
      };
      await cacheManager.set('app_state', appState);
    } catch (err) {
      console.warn('Failed to save app state:', err);
    }
  }

  function setupAutoCleanup(): void {
    if (typeof window === 'undefined') return;

    // Save state on page unload
    window.addEventListener('beforeunload', () => {
      saveCachedAppState();
    });

    // Clean up old notifications every 5 minutes
    setInterval(
      () => {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        notifications.value = notifications.value.filter(
          (n) => n.persistent || n.timestamp > fiveMinutesAgo
        );
      },
      5 * 60 * 1000
    );
  }

  async function clearAllCaches(): Promise<void> {
    setGlobalLoading(true, 'Clearing caches...');

    try {
      await cacheManager.clear();

      addNotification({
        type: 'success',
        title: 'Caches Cleared',
        message: 'All cached data has been removed',
        duration: 3000,
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: 'Clear Failed',
        message: err.message || 'Failed to clear caches',
        duration: 5000,
      });
    } finally {
      setGlobalLoading(false);
    }
  }

  // ============================================================================
  // Return
  // ============================================================================

  return {
    // State
    initialized: readonly(initialized),
    currentApp: readonly(currentApp),
    globalLoading: readonly(globalLoading),
    notifications: readonly(notifications),
    crossAppContext: readonly(crossAppContext),
    keyboardShortcutsEnabled: readonly(keyboardShortcutsEnabled),
    offlineMode: readonly(offlineMode),
    connectionStatus: readonly(connectionStatus),
    selectedItems: readonly(selectedItems),
    selectedSymbiants: readonly(selectedSymbiants),
    selectedPocketBosses: readonly(selectedPocketBosses),
    globalError: readonly(globalError),
    performanceMetrics: readonly(performanceMetrics),

    // Getters
    hasNotifications,
    unreadNotifications,
    persistentNotifications,
    hasSelectedItems,
    hasSelectedSymbiants,
    hasSelectedPocketBosses,
    hasAnySelection,
    isOffline,
    isReconnecting,
    appTitle,

    // Actions
    initialize,
    setCurrentApp,
    navigateToApp,
    getCrossAppContext,
    clearCrossAppContext,
    setGlobalLoading,
    updateLoadingProgress,
    addNotification,
    removeNotification,
    clearAllNotifications,
    clearNonPersistentNotifications,
    setGlobalError,
    clearGlobalError,
    addSelectedItem,
    removeSelectedItem,
    clearSelectedItems,
    toggleItemSelection,
    addSelectedSymbiant,
    removeSelectedSymbiant,
    clearSelectedSymbiants,
    clearAllSelections,
    enableOfflineMode,
    disableOfflineMode,
    toggleKeyboardShortcuts,
    recordPerformanceMetric,
    clearAllCaches,
  };
});

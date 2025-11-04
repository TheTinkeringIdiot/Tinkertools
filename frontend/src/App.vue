<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Menubar from 'primevue/menubar';
import Toast from 'primevue/toast';
import { useTheme } from './composables/useTheme';
import AccessibilityAnnouncer from './components/shared/AccessibilityAnnouncer.vue';
import ProfileDropdown from './components/profiles/ProfileDropdown.vue';
import type { MenuItem } from 'primevue/menuitem';

const router = useRouter();
const { isDark, toggle, currentTheme } = useTheme();

const themeIcon = computed(() => (isDark.value ? 'pi pi-sun' : 'pi pi-moon'));
const themeLabel = computed(() => (isDark.value ? 'Switch to Light Mode' : 'Switch to Dark Mode'));
const currentThemeText = computed(() => (isDark.value ? 'Dark' : 'Light'));

const menuItems = ref<MenuItem[]>([
  {
    label: 'Home',
    icon: 'pi pi-home',
    command: () => router.push('/'),
  },
  {
    label: 'TinkerProfiles',
    icon: 'pi pi-users',
    command: () => router.push('/profiles'),
  },
  {
    label: 'TinkerItems',
    icon: 'pi pi-database',
    command: () => router.push('/items'),
  },
  {
    label: 'TinkerNanos',
    icon: 'pi pi-bolt',
    command: () => router.push('/nanos'),
  },
  {
    label: 'TinkerNukes',
    icon: 'pi pi-sparkles',
    command: () => router.push('/tinkernukes'),
  },
  {
    label: 'TinkerFite',
    icon: 'pi pi-shield',
    command: () => router.push('/fite'),
  },
  {
    label: 'TinkerPlants',
    icon: 'pi pi-cog',
    command: () => router.push('/plants'),
  },
  {
    label: 'TinkerPocket',
    icon: 'pi pi-map',
    command: () => router.push('/pocket'),
  },
]);
</script>

<template>
  <div class="min-h-screen bg-surface-0 text-surface-900 dark:bg-surface-950 dark:text-surface-50">
    <!-- Header -->
    <header
      class="bg-surface-0 dark:bg-surface-950 border-b border-surface-200 dark:border-surface-700 shadow-sm"
      role="banner"
      aria-label="Site header"
    >
      <div class="px-4 py-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <i class="pi pi-cog text-2xl text-primary-500" aria-hidden="true"></i>
            <h1 class="text-xl font-bold">TinkerTools</h1>
            <span
              class="text-xs text-surface-500 bg-surface-100 dark:bg-surface-800 px-2 py-1 rounded"
              role="status"
              aria-label="Beta version"
            >
              BETA
            </span>
          </div>

          <!-- Quick Actions -->
          <div class="flex items-center gap-4">
            <!-- Profile Selector -->
            <div class="profile-selector-container">
              <ProfileDropdown />
            </div>

            <!-- Theme Toggle -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-surface-500 dark:text-surface-400 font-medium">
                {{ currentThemeText }} Mode
              </span>
              <Button
                :icon="themeIcon"
                :aria-label="themeLabel"
                outlined
                size="small"
                @click="toggle"
                :pt="{ root: 'transition-all duration-200 hover:scale-105' }"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation Menu -->
      <nav role="navigation" aria-label="Main navigation">
        <Menubar :model="menuItems" class="border-0 bg-transparent" />
      </nav>
    </header>

    <!-- Main Content -->
    <main id="main-content" class="min-h-0" role="main" aria-label="Main content" tabindex="-1">
      <router-view />
    </main>

    <!-- Accessibility Announcer for screen readers -->
    <AccessibilityAnnouncer />

    <!-- Toast notifications -->
    <Toast />
  </div>
</template>

<style scoped>
/* Screen reader only utility classes */
:global(.sr-only) {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

:global(.focus\:not-sr-only):focus {
  position: static;
  width: auto;
  height: auto;
  padding: 0.5rem 1rem;
  margin: 0;
  overflow: visible;
  clip: auto;
  white-space: normal;
}

/* Skip link styles */
:global(.skip-link) {
  transition: all 0.2s ease-in-out;
}
</style>

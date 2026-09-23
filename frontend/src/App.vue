<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import Button from 'primevue/button';
import Menubar from 'primevue/menubar';
import Toast from 'primevue/toast';
import { useTheme } from './composables/useTheme';
import { useGameVersion } from './composables/useGameVersion';
import AccessibilityAnnouncer from './components/shared/AccessibilityAnnouncer.vue';
import ProfileDropdown from './components/profiles/ProfileDropdown.vue';
import GlobalItemSearch from './components/shared/GlobalItemSearch.vue';
import GameVersionSelector from './components/versions/GameVersionSelector.vue';
import VersionSnapshotBanner from './components/versions/VersionSnapshotBanner.vue';
import type { MenuItem } from 'primevue/menuitem';

const router = useRouter();
const route = useRoute();
const { isDark, toggle } = useTheme();
const { hasFeature } = useGameVersion();

const themeIcon = computed(() => (isDark.value ? 'pi pi-sun' : 'pi pi-moon'));
const themeLabel = computed(() => (isDark.value ? 'Switch to Light Mode' : 'Switch to Dark Mode'));
const currentThemeText = computed(() => (isDark.value ? 'Dark' : 'Light'));

/**
 * Every tool lives under the game version segment, so navigation goes through
 * named routes: the `version` param is inherited from the current route.
 * Active state is decided by route name, never by path prefix.
 */
interface ToolEntry {
  label: string;
  icon: string;
  route: string;
  /** Route names that also count as "inside" this tool. */
  activeNames?: string[];
  /** Registry feature this tool needs; unknown versions show everything. */
  feature?: string;
}

const tools: ToolEntry[] = [
  { label: 'Home', icon: 'pi pi-home', route: 'Home' },
  {
    label: 'TinkerProfiles',
    icon: 'pi pi-users',
    route: 'TinkerProfiles',
    activeNames: ['TinkerProfileDetail'],
  },
  {
    label: 'TinkerItems',
    icon: 'pi pi-database',
    route: 'TinkerItems',
    activeNames: ['ItemDetail'],
    feature: 'items',
  },
  { label: 'TinkerNanos', icon: 'pi pi-bolt', route: 'TinkerNanos', feature: 'nanos' },
  { label: 'TinkerNukes', icon: 'pi pi-sparkles', route: 'TinkerNukes', feature: 'nanos' },
  { label: 'TinkerFite', icon: 'pi pi-shield', route: 'TinkerFite' },
  { label: 'TinkerPlants', icon: 'pi pi-cog', route: 'TinkerPlants', feature: 'items' },
  {
    label: 'TinkerPocket',
    icon: 'pi pi-map',
    route: 'TinkerPocket',
    activeNames: ['BossDetail'],
    feature: 'symbiants',
  },
];

function isActive(tool: ToolEntry): boolean {
  const name = route.name as string | undefined;
  if (!name) return false;
  return name === tool.route || (tool.activeNames?.includes(name) ?? false);
}

const menuItems = computed<MenuItem[]>(() =>
  tools
    .filter((tool) => !tool.feature || hasFeature(tool.feature))
    .map((tool) => ({
      label: tool.label,
      icon: tool.icon,
      command: () => router.push({ name: tool.route }),
      class: isActive(tool) ? 'router-link-active' : '',
    }))
);
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
        <div class="flex flex-wrap items-center justify-between gap-y-3">
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

          <!-- Global item search (shortcut to TinkerItems) -->
          <div class="flex-1 min-w-[20rem] max-w-4xl mx-4 hidden md:block">
            <GlobalItemSearch />
          </div>

          <!-- Quick Actions -->
          <div class="flex items-center gap-3">
            <!-- Game Version Selector -->
            <GameVersionSelector />

            <!-- Profile Selector -->
            <div class="profile-selector-container">
              <ProfileDropdown />
            </div>

            <!-- Theme Toggle -->
            <div class="flex items-center gap-2">
              <span class="text-xs text-surface-500 dark:text-surface-400 font-medium hidden xl:inline">
                {{ currentThemeText }} Mode
              </span>
              <Button
                :icon="themeIcon"
                :aria-label="themeLabel"
                outlined
                class="h-11 w-11"
                @click="toggle"
                :pt="{ root: 'transition-all duration-200 hover:scale-105' }"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="px-4 pb-3 md:hidden">
        <GlobalItemSearch />
      </div>

      <!-- Navigation Menu -->
      <nav role="navigation" aria-label="Main navigation">
        <Menubar :model="menuItems" class="border-0 bg-transparent" />
      </nav>
    </header>

    <!-- Non-default snapshot notice -->
    <VersionSnapshotBanner />

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

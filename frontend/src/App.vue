<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Menubar from 'primevue/menubar';
import { useTheme } from './composables/useTheme';
import type { MenuItem } from 'primevue/menuitem';

const router = useRouter();
const { isDark, toggle, currentTheme } = useTheme();

const themeIcon = computed(() => isDark.value ? 'pi pi-sun' : 'pi pi-moon');
const themeLabel = computed(() => isDark.value ? 'Switch to Light Mode' : 'Switch to Dark Mode');
const currentThemeText = computed(() => isDark.value ? 'Dark' : 'Light');

const menuItems = ref<MenuItem[]>([
  {
    label: 'Home',
    icon: 'pi pi-home',
    command: () => router.push('/')
  },
  {
    label: 'TinkerItems',
    icon: 'pi pi-database',
    command: () => router.push('/items')
  },
  {
    label: 'TinkerNanos',
    icon: 'pi pi-bolt',
    command: () => router.push('/nanos')
  },
  {
    label: 'TinkerFite',
    icon: 'pi pi-shield',
    command: () => router.push('/fite')
  },
  {
    label: 'TinkerPlants',
    icon: 'pi pi-cog',
    command: () => router.push('/plants')
  },
  {
    label: 'TinkerPocket',
    icon: 'pi pi-map',
    command: () => router.push('/pocket')
  },
  {
    label: 'TinkerNukes',
    icon: 'pi pi-sparkles',
    command: () => router.push('/nukes')
  }
]);
</script>

<template>
  <div class="min-h-screen bg-surface-0 text-surface-900 dark:bg-surface-950 dark:text-surface-50">
    <!-- Header -->
    <header class="bg-surface-0 dark:bg-surface-950 border-b border-surface-200 dark:border-surface-700 shadow-sm">
      <div class="px-4 py-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <i class="pi pi-cog text-2xl text-primary-500"></i>
            <h1 class="text-xl font-bold">TinkerTools</h1>
            <span class="text-xs text-surface-500 bg-surface-100 dark:bg-surface-800 px-2 py-1 rounded">BETA</span>
          </div>
          
          <!-- Quick Actions -->
          <div class="flex items-center gap-3">
            <!-- Global Theme Toggle -->
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
            <Button 
              icon="pi pi-database" 
              label="Items" 
              outlined 
              size="small"
              @click="router.push('/items')"
            />
          </div>
        </div>
      </div>
      
      <!-- Navigation Menu -->
      <Menubar :model="menuItems" class="border-0 bg-transparent" />
    </header>

    <!-- Main Content -->
    <main class="min-h-0">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
</style>
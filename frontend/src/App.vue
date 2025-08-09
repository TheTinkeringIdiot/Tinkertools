<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import Menubar from 'primevue/menubar';

const router = useRouter();

const menuItems = ref([
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
    command: () => router.push('/pocket'),
    disabled: true
  },
  {
    label: 'TinkerNukes',
    icon: 'pi pi-sparkles',
    command: () => router.push('/nukes'),
    disabled: true
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
          <div class="flex items-center gap-2">
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
<!--
Home - Landing page for TinkerTools
Welcomes users and provides navigation to all six tools with AO-themed descriptions
-->
<template>
  <div class="home-page">
    <!-- Hero Section -->
    <section class="hero-section p-8 mb-8 text-center">
      <div class="max-w-4xl mx-auto">
        <h1 class="text-5xl font-bold text-surface-900 dark:text-surface-50 mb-4">
          TinkerTools
          <Badge value="BETA" severity="info" class="ml-3" />
        </h1>
        <p class="text-2xl text-primary-500 dark:text-primary-400 mb-4 font-medium">
          Your personal Grid terminal for Rubi-Ka
        </p>
        <p class="text-lg text-surface-600 dark:text-surface-400 max-w-2xl mx-auto">
          A comprehensive suite of optimization tools for Anarchy Online. Plan your builds, analyze
          equipment, track collections, and perfect your character across all dimensions.
        </p>
      </div>
    </section>

    <!-- Tools Grid -->
    <section class="tools-section max-w-7xl mx-auto px-6 mb-12">
      <h2 class="text-2xl font-bold text-surface-900 dark:text-surface-50 mb-6 text-center">
        Six Essential Tools
      </h2>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <router-link
          v-for="tool in tools"
          :key="tool.route"
          :to="tool.route"
          class="tool-card-link"
        >
          <Card class="tool-card h-full">
            <template #header>
              <div class="flex justify-center pt-6">
                <i :class="[tool.icon, 'text-6xl text-primary-500']"></i>
              </div>
            </template>
            <template #title>
              <div class="text-center">{{ tool.name }}</div>
            </template>
            <template #subtitle>
              <div class="text-center text-surface-600 dark:text-surface-400">
                {{ tool.subtitle }}
              </div>
            </template>
            <template #content>
              <p class="text-center text-surface-700 dark:text-surface-300 mb-4">
                {{ tool.description }}
              </p>
            </template>
            <template #footer>
              <div class="flex justify-center">
                <span class="p-button p-component">
                  <span class="p-button-label">Launch Tool</span>
                  <span class="pi pi-arrow-right p-button-icon p-button-icon-right"></span>
                </span>
              </div>
            </template>
          </Card>
        </router-link>
      </div>
    </section>

    <!-- Footer Section -->
    <section
      class="footer-section border-t border-surface-200 dark:border-surface-700 py-8 mt-12"
    >
      <div class="max-w-7xl mx-auto px-6">
        <!-- Community Links -->
        <div class="flex justify-center items-center gap-8 mb-6">
          <a
            href="https://github.com/TheTinkeringIdiot/Tinkertools"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 text-surface-700 dark:text-surface-300 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          >
            <i class="pi pi-github text-2xl"></i>
            <span class="font-medium">GitHub</span>
          </a>
          <a
            href="https://patreon.com/tinkeringidiot"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 text-surface-700 dark:text-surface-300 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          >
            <i class="pi pi-heart text-2xl"></i>
            <span class="font-medium">Patreon</span>
          </a>
          <a
            href="https://discord.gg/a7baGx76un"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 text-surface-700 dark:text-surface-300 hover:text-primary-500 dark:hover:text-primary-400 transition-colors"
          >
            <i class="pi pi-discord text-2xl"></i>
            <span class="font-medium">Discord</span>
          </a>
        </div>

        <!-- App Info -->
        <div class="text-center text-sm text-surface-600 dark:text-surface-400">
          <p class="mb-2">Made by TinkeringIdiot with ❤️ for the Anarchy Online community</p>
          <p class="text-xs">
            Anarchy Online © Funcom • TinkerTools is a fan-made project and is not affiliated or supported by Funcom or Project Rubi-Ka.
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import Card from 'primevue/card';
import Badge from 'primevue/badge';

const tools = [
  {
    name: 'TinkerProfiles',
    subtitle: 'Character Database',
    description:
      'Manage character profiles across all dimensions. Create, import, and track your characters with comprehensive stat tracking.',
    icon: 'pi pi-users',
    route: '/profiles',
  },
  {
    name: 'TinkerItems',
    subtitle: 'Equipment Archives',
    description:
      'Search 120,000+ items from across Rubi-Ka. Advanced filtering, compatibility checking, and item comparison tools.',
    icon: 'pi pi-database',
    route: '/items',
  },
  {
    name: 'TinkerNanos',
    subtitle: 'Nano Program Library',
    description:
      'Browse and analyze nano programs by profession and school. Check strain compatibility and requirements.',
    icon: 'pi pi-bolt',
    route: '/nanos',
  },
  {
    name: 'TinkerFite',
    subtitle: 'Weapon Analytics',
    description:
      'Compare DPS and optimize your combat loadout. Analyze weapon performance with your character\'s stats and skills.',
    icon: 'pi pi-shield',
    route: '/fite',
  },
  {
    name: 'TinkerPlants',
    subtitle: 'Augmentation Planner',
    description:
      'Design implant and symbiant configurations. Plan your augmentations and optimize stat distribution for your build.',
    icon: 'pi pi-cog',
    route: '/plants',
  },
  {
    name: 'TinkerPocket',
    subtitle: 'Pocket Boss Intel',
    description:
      'Track pocket bosses and manage your collections. Browse symbiants and plan your hunting strategy across dimensions.',
    icon: 'pi pi-map',
    route: '/pocket',
  },
];
</script>

<style scoped>
.tool-card-link {
  text-decoration: none;
  color: inherit;
  display: block;
  cursor: pointer;
}

.tool-card {
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
}

.tool-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.hero-section {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(30, 64, 175, 0.05) 100%);
  border-radius: 12px;
}
</style>

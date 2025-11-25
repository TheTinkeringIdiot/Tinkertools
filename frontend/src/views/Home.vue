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
        <!-- TinkerProfiles -->
        <Card class="tool-card">
          <template #header>
            <div class="flex justify-center pt-6">
              <i class="pi pi-users text-6xl text-primary-500"></i>
            </div>
          </template>
          <template #title>
            <div class="text-center">TinkerProfiles</div>
          </template>
          <template #subtitle>
            <div class="text-center text-surface-600 dark:text-surface-400">Agent Database</div>
          </template>
          <template #content>
            <p class="text-center text-surface-700 dark:text-surface-300 mb-4">
              Manage character profiles across all dimensions. Create, import, and track your characters
              with comprehensive stat tracking.
            </p>
          </template>
          <template #footer>
            <div class="flex justify-center">
              <Button
                label="Launch Tool"
                icon="pi pi-arrow-right"
                iconPos="right"
                @click="navigateTo('/profiles')"
              />
            </div>
          </template>
        </Card>

        <!-- TinkerItems -->
        <Card class="tool-card">
          <template #header>
            <div class="flex justify-center pt-6">
              <i class="pi pi-database text-6xl text-primary-500"></i>
            </div>
          </template>
          <template #title>
            <div class="text-center">TinkerItems</div>
          </template>
          <template #subtitle>
            <div class="text-center text-surface-600 dark:text-surface-400">
              Equipment Archives
            </div>
          </template>
          <template #content>
            <p class="text-center text-surface-700 dark:text-surface-300 mb-4">
              Search 120,000+ items from across Rubi-Ka. Advanced filtering, compatibility checking,
              and item comparison tools.
            </p>
          </template>
          <template #footer>
            <div class="flex justify-center">
              <Button
                label="Launch Tool"
                icon="pi pi-arrow-right"
                iconPos="right"
                @click="navigateTo('/items')"
              />
            </div>
          </template>
        </Card>

        <!-- TinkerNanos -->
        <Card class="tool-card">
          <template #header>
            <div class="flex justify-center pt-6">
              <i class="pi pi-bolt text-6xl text-primary-500"></i>
            </div>
          </template>
          <template #title>
            <div class="text-center">TinkerNanos</div>
          </template>
          <template #subtitle>
            <div class="text-center text-surface-600 dark:text-surface-400">
              Nano Program Library
            </div>
          </template>
          <template #content>
            <p class="text-center text-surface-700 dark:text-surface-300 mb-4">
              Browse and analyze nano programs by profession and school. Check strain compatibility
              and requirements.
            </p>
          </template>
          <template #footer>
            <div class="flex justify-center">
              <Button
                label="Launch Tool"
                icon="pi pi-arrow-right"
                iconPos="right"
                @click="navigateTo('/nanos')"
              />
            </div>
          </template>
        </Card>

        <!-- TinkerFite -->
        <Card class="tool-card">
          <template #header>
            <div class="flex justify-center pt-6">
              <i class="pi pi-shield text-6xl text-primary-500"></i>
            </div>
          </template>
          <template #title>
            <div class="text-center">TinkerFite</div>
          </template>
          <template #subtitle>
            <div class="text-center text-surface-600 dark:text-surface-400">Weapon Analytics</div>
          </template>
          <template #content>
            <p class="text-center text-surface-700 dark:text-surface-300 mb-4">
              Compare DPS and optimize your combat loadout. Analyze weapon performance with your
              character's stats and skills.
            </p>
          </template>
          <template #footer>
            <div class="flex justify-center">
              <Button
                label="Launch Tool"
                icon="pi pi-arrow-right"
                iconPos="right"
                @click="navigateTo('/fite')"
              />
            </div>
          </template>
        </Card>

        <!-- TinkerPlants -->
        <Card class="tool-card">
          <template #header>
            <div class="flex justify-center pt-6">
              <i class="pi pi-cog text-6xl text-primary-500"></i>
            </div>
          </template>
          <template #title>
            <div class="text-center">TinkerPlants</div>
          </template>
          <template #subtitle>
            <div class="text-center text-surface-600 dark:text-surface-400">
              Augmentation Planner
            </div>
          </template>
          <template #content>
            <p class="text-center text-surface-700 dark:text-surface-300 mb-4">
              Design implant and symbiant configurations. Plan your augmentations and optimize stat
              distribution for your build.
            </p>
          </template>
          <template #footer>
            <div class="flex justify-center">
              <Button
                label="Launch Tool"
                icon="pi pi-arrow-right"
                iconPos="right"
                @click="navigateTo('/plants')"
              />
            </div>
          </template>
        </Card>

        <!-- TinkerPocket -->
        <Card class="tool-card">
          <template #header>
            <div class="flex justify-center pt-6">
              <i class="pi pi-map text-6xl text-primary-500"></i>
            </div>
          </template>
          <template #title>
            <div class="text-center">TinkerPocket</div>
          </template>
          <template #subtitle>
            <div class="text-center text-surface-600 dark:text-surface-400">Pocket Boss Intel</div>
          </template>
          <template #content>
            <p class="text-center text-surface-700 dark:text-surface-300 mb-4">
              Track pocket bosses and manage your collections. Browse symbiants and plan your
              hunting strategy across dimensions.
            </p>
          </template>
          <template #footer>
            <div class="flex justify-center">
              <Button
                label="Launch Tool"
                icon="pi pi-arrow-right"
                iconPos="right"
                @click="navigateTo('/pocket')"
              />
            </div>
          </template>
        </Card>
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
            Anarchy Online © Funcom • TinkerTools is a fan-made project and is not affiliated with
            Funcom
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import Card from 'primevue/card';
import Button from 'primevue/button';
import Badge from 'primevue/badge';

const router = useRouter();

const navigateTo = (path: string) => {
  router.push(path);
};
</script>

<style scoped>
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

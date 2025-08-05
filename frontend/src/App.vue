<script setup lang="ts">
import Button from 'primevue/button';
</script>

<template>
  <div class="min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
    <header class="p-4 border-b border-slate-200 dark:border-slate-800">
      <h1 class="text-xl font-semibold">Tinkertools</h1>
    </header>
    <main class="p-6 space-y-4">
      <p>PrimeVue sanity check:</p>
      <Button label="Hello PrimeVue" icon="pi pi-check" />
      <router-view />
    </main>
  </div>
</template>

<style scoped>
</style>
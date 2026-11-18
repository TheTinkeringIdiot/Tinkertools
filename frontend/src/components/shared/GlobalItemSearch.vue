<!--
  Global item search: a header shortcut that runs a simple name search in
  TinkerItems without visiting the tool first. Enter navigates to the items
  route (named, so the game version segment is inherited) with ?search=<term>.
-->
<template>
  <form
    class="global-item-search flex items-center w-full"
    role="search"
    aria-label="Search items"
    @submit.prevent="submit"
  >
    <span class="relative flex-1">
      <i
        class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
        aria-hidden="true"
      ></i>
      <InputText
        v-model="term"
        type="text"
        name="search"
        placeholder="Search items…"
        autocomplete="off"
        class="w-full h-11 pl-10 pr-10 text-base"
        aria-label="Search items"
        data-testid="global-item-search-input"
        @keydown.escape="clear"
      />
      <button
        v-if="term"
        type="button"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"
        aria-label="Clear search"
        data-testid="global-item-search-clear"
        @click="clear"
      >
        <i class="pi pi-times text-xs" aria-hidden="true"></i>
      </button>
    </span>
    <Button
      type="submit"
      icon="pi pi-search"
      label="Search"
      class="ml-2 h-11 hidden sm:inline-flex"
      :disabled="!term.trim()"
      data-testid="global-item-search-submit"
    />
  </form>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import InputText from 'primevue/inputtext';
import Button from 'primevue/button';

const route = useRoute();
const router = useRouter();

const term = ref(readTermFromRoute());

function readTermFromRoute(): string {
  if (route.name !== 'TinkerItems') return '';
  const value = route.query.search;
  return typeof value === 'string' ? value : '';
}

// Keep the box in step with the URL while on the items page (back/forward,
// searches started from the sidebar), and empty it elsewhere.
watch(
  () => [route.name, route.query.search],
  () => {
    term.value = readTermFromRoute();
  }
);

function submit(): void {
  const search = term.value.trim();
  if (!search) return;
  void router.push({ name: 'TinkerItems', query: { search } });
}

function clear(): void {
  term.value = '';
}
</script>

<!--
GameVersionSelector - header pill for the game database snapshot in view.

Shows which version the app is browsing and opens a flat list of every
registered version in registry order (the backend's sort_order). Selecting one
swaps the version segment of the current route via switchVersion().
-->
<template>
  <div ref="rootEl" class="game-version-selector relative">
    <button
      type="button"
      data-testid="version-pill"
      class="flex items-center gap-2 rounded border h-11 px-3 py-0 text-left transition-colors"
      :class="
        isDefaultVersion
          ? 'border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-900 hover:bg-surface-100 dark:hover:bg-surface-800'
          : 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-950 hover:bg-amber-100 dark:hover:bg-amber-900'
      "
      :aria-expanded="open"
      aria-haspopup="listbox"
      :aria-label="`Game version: ${pillTitle}`"
      @click="toggle"
    >
      <i
        class="pi pi-database text-sm"
        :class="isDefaultVersion ? 'text-primary-500' : 'text-amber-600 dark:text-amber-400'"
        aria-hidden="true"
      ></i>
      <span class="flex flex-col leading-tight">
        <span class="text-sm font-medium text-surface-900 dark:text-surface-50">
          {{ pillTitle }}
        </span>
        <span
          v-if="pillSubtitle"
          class="text-xs text-surface-500 dark:text-surface-400"
          data-testid="version-pill-subtitle"
        >
          {{ pillSubtitle }}
        </span>
      </span>
      <i class="pi pi-chevron-down text-xs text-surface-400" aria-hidden="true"></i>
    </button>

    <div
      v-if="open"
      data-testid="version-panel"
      role="listbox"
      class="absolute right-0 z-50 mt-1 w-80 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 shadow-lg"
    >
      <p
        v-if="versions.length === 0"
        class="px-3 py-3 text-sm text-surface-500 dark:text-surface-400"
        data-testid="version-panel-empty"
      >
        {{ registryLoaded ? 'No game versions available' : 'Loading versions...' }}
      </p>

      <ul v-else class="max-h-96 overflow-y-auto py-1">
        <li v-for="version in versions" :key="version.slug">
          <div
            class="flex items-center gap-2 px-2 hover:bg-surface-100 dark:hover:bg-surface-800"
            :class="version.slug === currentVersion ? 'bg-surface-100 dark:bg-surface-800' : ''"
          >
            <button
              type="button"
              class="flex flex-1 items-center gap-2 py-2 text-left min-w-0"
              role="option"
              :aria-selected="version.slug === currentVersion"
              data-testid="version-option"
              :data-slug="version.slug"
              @click="select(version)"
            >
              <i
                class="pi text-xs w-3"
                :class="
                  version.slug === currentVersion
                    ? 'pi-check text-primary-500'
                    : 'pi-circle-off opacity-0'
                "
                aria-hidden="true"
              ></i>
              <span class="flex flex-col min-w-0 flex-1">
                <span class="truncate text-sm font-medium text-surface-900 dark:text-surface-50">
                  {{ version.display_name }}
                </span>
                <span class="truncate text-xs text-surface-500 dark:text-surface-400">
                  {{ describeVersion(version) }}
                </span>
              </span>
              <Tag
                :value="version.family"
                severity="secondary"
                class="text-xs"
                data-testid="version-family-tag"
              />
            </button>
            <button
              type="button"
              class="p-1 text-surface-400 hover:text-primary-500"
              data-testid="version-info"
              :data-slug="version.slug"
              :title="`About ${version.display_name}`"
              :aria-label="`About ${version.display_name}`"
              @click.stop="openVersionsPage"
            >
              <i class="pi pi-info-circle text-sm" aria-hidden="true"></i>
            </button>
          </div>
        </li>
      </ul>

      <div class="border-t border-surface-200 dark:border-surface-700 px-3 py-2">
        <button
          type="button"
          class="text-xs text-primary-600 dark:text-primary-400 hover:underline"
          data-testid="version-page-link"
          @click="openVersionsPage"
        >
          What is loaded in each version?
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import Tag from 'primevue/tag';
import { useGameVersion } from '@/composables/useGameVersion';
import type { GameVersion } from '@/types/game-version';

const router = useRouter();
const toast = useToast();
const { versions, current, currentVersion, isDefaultVersion, registryLoaded, switchVersion } =
  useGameVersion();

const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);

const pillTitle = computed(() => current.value?.display_name || currentVersion.value || 'Version');

const pillSubtitle = computed(() => {
  const version = current.value;
  if (!version) return '';
  return [version.client_build, version.snapshot_date].filter(Boolean).join(' · ');
});

function describeVersion(version: GameVersion): string {
  const parts = [version.client_build, version.snapshot_date].filter(Boolean);
  if (version.is_default) parts.push('default');
  return parts.join(' · ') || version.slug;
}

function toggle(): void {
  open.value = !open.value;
}

function close(): void {
  open.value = false;
}

async function select(version: GameVersion): Promise<void> {
  close();
  if (version.slug === currentVersion.value) return;
  await switchVersion(version.slug);
  toast.add({
    severity: 'info',
    summary: 'Game version',
    detail: `Viewing ${version.display_name}`,
    life: 3000,
  });
}

function openVersionsPage(): void {
  close();
  void router.push({ name: 'GameVersions' });
}

function onDocumentClick(event: MouseEvent): void {
  if (!open.value) return;
  const target = event.target as Node | null;
  if (rootEl.value && target && !rootEl.value.contains(target)) close();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close();
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick);
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onKeydown);
});

defineExpose({ open });
</script>

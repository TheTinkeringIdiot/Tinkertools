<!--
GameVersionSelector - header pill for the game database snapshot in view.

Shows which version the app is browsing and opens a searchable list: the
'latest' entries that follow each family's newest build, then every build
grouped by family in registry order (the backend's sort_order). Selecting one
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

      <template v-else>
        <div class="border-b border-surface-200 dark:border-surface-700 p-2">
          <input
            ref="searchEl"
            v-model="search"
            type="search"
            data-testid="version-search"
            class="w-full rounded border border-surface-300 dark:border-surface-600 bg-surface-0 dark:bg-surface-950 px-2 py-1 text-sm text-surface-900 dark:text-surface-50"
            placeholder="Find a version or build, e.g. 16.4"
            aria-label="Find a version"
          />
        </div>
        <p
          v-if="groups.length === 0"
          class="px-3 py-3 text-sm text-surface-500 dark:text-surface-400"
          data-testid="version-search-empty"
        >
          No version matches "{{ search }}"
        </p>
        <div v-else class="max-h-96 overflow-y-auto py-1">
          <section v-for="group in groups" :key="group.key" data-testid="version-group">
            <h3
              class="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400"
              data-testid="version-group-title"
            >
              {{ group.title }}
            </h3>
            <ul>
              <li v-for="version in group.versions" :key="version.slug">
                <div
                  class="flex items-center gap-2 px-2 hover:bg-surface-100 dark:hover:bg-surface-800"
                  :class="
                    version.slug === currentVersion ? 'bg-surface-100 dark:bg-surface-800' : ''
                  "
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
                      <span
                        class="truncate text-sm font-medium text-surface-900 dark:text-surface-50"
                      >
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
          </section>
        </div>
      </template>

      <div
        class="flex flex-col items-start gap-1 border-t border-surface-200 dark:border-surface-700 px-3 py-2"
      >
        <button
          type="button"
          class="text-xs text-primary-700 dark:text-primary-400 hover:underline"
          data-testid="version-changes-link"
          @click="openChangesPage"
        >
          <i class="pi pi-history mr-1" aria-hidden="true"></i>
          What changed in {{ pillTitle }}?
        </button>
        <button
          type="button"
          class="text-xs text-primary-700 dark:text-primary-400 hover:underline"
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
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue';
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
const searchEl = ref<HTMLInputElement | null>(null);
const search = ref('');

const FAMILY_TITLES: Record<string, string> = {
  ao: 'Anarchy Online',
  prk: 'Project Rubi-Ka',
};

interface VersionGroup {
  key: string;
  title: string;
  versions: GameVersion[];
}

function matchesSearch(version: GameVersion, needle: string): boolean {
  return [version.display_name, version.client_build, version.slug, version.family].some(
    (text) => !!text && text.toLowerCase().includes(needle)
  );
}

/**
 * The 'latest' entries first, then each family's builds in registry order,
 * narrowed by the search box.
 */
const groups = computed<VersionGroup[]>(() => {
  const needle = search.value.trim().toLowerCase();
  // The default version's family leads; the sort is stable, so registry order
  // holds within a family.
  const home = versions.value.find((version) => version.is_default)?.family;
  const shown = versions.value
    .filter((version) => !needle || matchesSearch(version, needle))
    .sort((a, b) => Number(b.family === home) - Number(a.family === home));

  const result: VersionGroup[] = [];
  const latest = shown.filter((version) => version.alias_of);
  if (latest.length) result.push({ key: 'latest', title: 'Latest', versions: latest });

  for (const version of shown) {
    if (version.alias_of) continue;
    const key = `family:${version.family}`;
    let group = result.find((candidate) => candidate.key === key);
    if (!group) {
      group = {
        key,
        title: FAMILY_TITLES[version.family] ?? version.family.toUpperCase(),
        versions: [],
      };
      result.push(group);
    }
    group.versions.push(version);
  }
  return result;
});

const pillTitle = computed(() => current.value?.display_name || currentVersion.value || 'Version');

const pillSubtitle = computed(() => {
  const version = current.value;
  if (!version) return '';
  if (version.alias_of) return version.client_build || version.alias_of;
  return [version.client_build, version.snapshot_date].filter(Boolean).join(' · ');
});

function describeVersion(version: GameVersion): string {
  if (version.alias_of) {
    const build = version.client_build || version.alias_of;
    return `Newest build, now ${build}`;
  }
  const parts = [version.client_build, version.snapshot_date].filter(Boolean);
  if (version.is_default) parts.push('default');
  return parts.join(' · ') || version.slug;
}

function toggle(): void {
  open.value = !open.value;
  if (open.value) {
    search.value = '';
    void nextTick(() => searchEl.value?.focus());
  }
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

function openChangesPage(): void {
  close();
  void router.push({ name: 'BuildChanges' });
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

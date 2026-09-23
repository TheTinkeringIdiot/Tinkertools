<!--
Game Versions page: one row per database snapshot with lineage and what was
loaded into it. This is where a user learns that a given snapshot has no drop
sources by design rather than by bug.
-->
<template>
  <div class="p-6 max-w-5xl mx-auto">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">Game Versions</h1>
      <p class="text-sm text-surface-600 dark:text-surface-400 mt-1">
        Each version is a separate snapshot of the game database. Browsing one scopes every tool,
        search and item link to that snapshot.
      </p>
    </div>

    <div v-if="!registryLoaded" class="flex items-center gap-2 text-surface-500">
      <ProgressSpinner style="width: 1.5rem; height: 1.5rem" stroke-width="6" />
      <span>Loading versions...</span>
    </div>

    <div
      v-else-if="registryFailed || versions.length === 0"
      class="text-center py-16"
      data-testid="versions-empty"
    >
      <i class="pi pi-exclamation-triangle text-3xl text-amber-500 mb-3"></i>
      <p class="text-surface-600 dark:text-surface-400">
        The version registry could not be loaded. The app is running against the backend default.
      </p>
    </div>

    <div v-else class="space-y-4">
      <Card
        v-for="version in versions"
        :key="version.slug"
        data-testid="version-row"
        :data-slug="version.slug"
      >
        <template #content>
          <div class="flex flex-col lg:flex-row lg:items-start gap-4">
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2 mb-2">
                <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-50">
                  {{ version.display_name }}
                </h2>
                <Tag :value="version.family" severity="secondary" />
                <Badge
                  v-if="version.slug === currentVersion"
                  value="current"
                  severity="success"
                  data-testid="version-current-badge"
                />
                <Badge
                  v-if="version.is_default"
                  value="default"
                  severity="info"
                  data-testid="version-default-badge"
                />
                <Badge v-if="!version.enabled" value="disabled" severity="danger" />
              </div>

              <dl class="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                <div>
                  <dt class="text-surface-500 dark:text-surface-400 text-xs">Slug</dt>
                  <dd class="font-mono text-surface-800 dark:text-surface-200">
                    {{ version.slug }}
                  </dd>
                </div>
                <div>
                  <dt class="text-surface-500 dark:text-surface-400 text-xs">Client build</dt>
                  <dd class="text-surface-800 dark:text-surface-200">
                    {{ version.client_build || '—' }}
                  </dd>
                </div>
                <div>
                  <dt class="text-surface-500 dark:text-surface-400 text-xs">Snapshot date</dt>
                  <dd class="text-surface-800 dark:text-surface-200">
                    {{ version.snapshot_date || '—' }}
                  </dd>
                </div>
                <div>
                  <dt class="text-surface-500 dark:text-surface-400 text-xs">Derived from</dt>
                  <dd class="text-surface-800 dark:text-surface-200">
                    {{ parentName(version) }}
                  </dd>
                </div>
              </dl>

              <div class="mt-3">
                <span class="text-xs text-surface-500 dark:text-surface-400 mr-2">Loaded:</span>
                <span class="inline-flex flex-wrap gap-1 align-middle">
                  <Tag
                    v-for="feature in featureList(version)"
                    :key="feature.name"
                    :value="feature.label"
                    :severity="feature.loaded ? 'success' : 'secondary'"
                    :class="feature.loaded ? '' : 'opacity-60 line-through'"
                    :data-testid="`feature-${feature.name}`"
                  />
                </span>
              </div>

              <p
                v-if="version.notes"
                class="mt-3 text-sm text-surface-600 dark:text-surface-400 leading-relaxed"
              >
                {{ version.notes }}
              </p>
            </div>

            <div class="lg:w-40 flex lg:flex-col gap-2">
              <Button
                :label="version.slug === currentVersion ? 'Browsing' : 'Browse'"
                icon="pi pi-arrow-right"
                :disabled="version.slug === currentVersion || !version.enabled"
                size="small"
                class="w-full"
                data-testid="version-browse"
                :data-slug="version.slug"
                @click="browse(version)"
              />
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import Card from 'primevue/card';
import Tag from 'primevue/tag';
import Badge from 'primevue/badge';
import Button from 'primevue/button';
import ProgressSpinner from 'primevue/progressspinner';
import { useGameVersion } from '@/composables/useGameVersion';
import type { GameVersion } from '@/types/game-version';

/** Feature flags in the order they are worth reading, with display labels. */
const FEATURES: Array<{ name: string; label: string }> = [
  { name: 'items', label: 'Items' },
  { name: 'nanos', label: 'Nano programs' },
  { name: 'perks', label: 'Perks' },
  { name: 'symbiants', label: 'Symbiants' },
  { name: 'sources', label: 'Drop sources' },
];

const {
  versions,
  currentVersion,
  registryLoaded,
  registryFailed,
  ensureVersionsLoaded,
  switchVersion,
} = useGameVersion();

function parentName(version: GameVersion): string {
  if (!version.parent_slug) return 'Original import';
  const parent = versions.value.find((v) => v.slug === version.parent_slug);
  return parent?.display_name || version.parent_slug;
}

function featureList(version: GameVersion) {
  const flags = version.features || {};
  const known = FEATURES.map((feature) => ({
    ...feature,
    loaded: flags[feature.name] !== false,
  }));
  // Surface any flag the backend added that this page does not know about.
  const extra = Object.keys(flags)
    .filter((name) => !FEATURES.some((feature) => feature.name === name))
    .map((name) => ({ name, label: name, loaded: flags[name] !== false }));
  return [...known, ...extra];
}

async function browse(version: GameVersion): Promise<void> {
  await switchVersion(version.slug);
}

onMounted(() => {
  ensureVersionsLoaded();
});
</script>

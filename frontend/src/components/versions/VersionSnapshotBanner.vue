<!--
VersionSnapshotBanner - slim notice shown under the header while browsing a
snapshot that is not the default version. Names the snapshot and the data the
snapshot does not carry. Dismissal lasts for the browser session.
-->
<template>
  <div
    v-if="visible"
    data-testid="version-snapshot-banner"
    role="status"
    class="flex items-center gap-3 border-b border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 px-4 py-2 text-sm text-amber-900 dark:text-amber-200"
  >
    <i class="pi pi-clock" aria-hidden="true"></i>
    <span class="flex-1">
      Snapshot {{ current?.display_name }}<span v-if="snapshotDate"> ({{ snapshotDate }})</span>.
      <span v-if="missingFeatures.length"> Not available: {{ missingFeatures.join(', ') }}.</span>
    </span>
    <button
      type="button"
      class="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
      data-testid="version-banner-dismiss"
      aria-label="Dismiss snapshot notice"
      title="Dismiss"
      @click="dismiss"
    >
      <i class="pi pi-times text-xs" aria-hidden="true"></i>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useGameVersion } from '@/composables/useGameVersion';

const DISMISS_KEY = 'tinkertools-version-banner-dismissed';

/** Human labels for the registry's feature flags. */
const FEATURE_LABELS: Record<string, string> = {
  items: 'items',
  nanos: 'nano programs',
  perks: 'perks',
  symbiants: 'symbiants',
  sources: 'drop sources',
};

const { current, currentVersion, isDefaultVersion } = useGameVersion();

const dismissedSlug = ref<string | null>(readDismissed());

function readDismissed(): string | null {
  try {
    return sessionStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

const snapshotDate = computed(() => current.value?.snapshot_date || '');

const missingFeatures = computed(() => {
  const features = current.value?.features || {};
  return Object.entries(features)
    .filter(([, enabled]) => enabled === false)
    .map(([name]) => FEATURE_LABELS[name] || name);
});

const visible = computed(
  () =>
    !!currentVersion.value &&
    !isDefaultVersion.value &&
    !!current.value &&
    dismissedSlug.value !== currentVersion.value
);

function dismiss(): void {
  dismissedSlug.value = currentVersion.value;
  try {
    if (currentVersion.value) sessionStorage.setItem(DISMISS_KEY, currentVersion.value);
  } catch {
    // Dismissal persistence is a convenience only.
  }
}

// A new version gets its own notice even if the previous one was dismissed.
watch(currentVersion, () => {
  dismissedSlug.value = readDismissed();
});
</script>

<!--
ItemDetail - Detailed item view with complete information
Shows all item data with profile compatibility and comparison options
-->
<template>
  <div class="item-detail-page p-6 max-w-7xl mx-auto">
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Button
          icon="pi pi-arrow-left"
          label="Back to Items"
          severity="secondary"
          outlined
          @click="goBack"
        />
        <h1 class="text-2xl font-bold">{{ item?.name || 'Loading Item...' }}</h1>
        <Badge v-if="displayedItem && currentQl" :value="`QL ${currentQl}`" severity="info" />
        <Badge v-if="item?.is_nano" value="Nano" severity="success" />

        <!-- Patch points at which this item changed -->
        <ItemHistoryControl
          :revisions="revisions"
          :request-version="requestVersion"
          @select="onHistorySelect"
        />
      </div>

      <!-- Header Actions -->
      <div v-if="item" class="flex items-center gap-2">
        <Button
          v-if="canEquip"
          icon="pi pi-shield"
          label="Equip"
          severity="success"
          @click="showEquipDialog"
        />
        <Button
          v-if="item.is_nano && profilesStore.hasActiveProfile"
          icon="pi pi-sparkles"
          label="Cast Buff"
          severity="primary"
          @click="castBuff"
        />
        <Button
          icon="pi pi-clone"
          label="Compare"
          severity="primary"
          outlined
          @click="addToComparison"
        />
        <Button
          v-tooltip.bottom="'Share Item'"
          icon="pi pi-share-alt"
          severity="secondary"
          outlined
          @click="shareItem"
        />
      </div>
    </div>

    <!-- Peek: this item as it was in another snapshot -->
    <div
      v-if="peekVersion"
      data-testid="item-peek-banner"
      class="mb-4 flex flex-wrap items-center gap-3 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 px-4 py-2 text-sm text-amber-900 dark:text-amber-200"
    >
      <i class="pi pi-clock" aria-hidden="true"></i>
      <span class="flex-1">
        As of {{ peekLabel }}. Stats, requirements and interpolation come from that snapshot.
      </span>
      <div class="flex items-center gap-2">
        <Button
          :label="compareWithCurrent ? 'Hide comparison' : 'Compare with current'"
          icon="pi pi-arrows-h"
          size="small"
          text
          data-testid="item-compare-toggle"
          @click="toggleCompare"
        />
        <Button
          :label="`Back to ${currentVersionLabel}`"
          icon="pi pi-arrow-left"
          size="small"
          outlined
          data-testid="item-peek-exit"
          @click="exitPeek"
        />
      </div>
    </div>

    <!-- Shared Item Content -->
    <div v-if="loading" class="flex items-center justify-center h-96">
      <ProgressSpinner />
    </div>

    <div
      v-else-if="missingInCurrent"
      class="text-center py-16"
      data-testid="item-missing-in-version"
    >
      <i class="pi pi-clock text-4xl text-amber-500 mb-4"></i>
      <h3 class="text-lg font-medium text-surface-600 dark:text-surface-400 mb-2">
        Not present in {{ currentVersionLabel }}
      </h3>
      <p class="text-surface-500 dark:text-surface-500 mb-4">
        First appears in {{ firstSeenLabel }}
      </p>
      <Button
        :label="`View in ${firstSeenLabel}`"
        icon="pi pi-eye"
        data-testid="item-missing-view"
        @click="viewFirstSeen"
      />
    </div>

    <div v-else-if="error" class="text-center py-16">
      <i class="pi pi-exclamation-triangle text-4xl text-red-500 mb-4"></i>
      <h3 class="text-lg font-medium text-surface-600 dark:text-surface-400 mb-2">
        Failed to Load Item
      </h3>
      <p class="text-surface-500 dark:text-surface-500 mb-4">{{ error }}</p>
      <Button label="Retry" @click="loadItem" />
    </div>

    <div v-else-if="item" class="space-y-3">
      <!-- Item Flags, Interpolation Controls, and Advanced View Toggle -->
      <div
        class="flex items-center gap-4 p-4 bg-surface-50 dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700"
      >
        <!-- Item Flags (left side) -->
        <div class="flex items-center gap-2 flex-wrap">
          <Tag
            v-for="flag in displayItemFlags"
            :key="flag.name"
            :value="flag.name"
            :severity="flag.severity"
            :class="[
              'outline-tag',
              flag.severity === 'danger' ? 'outline-tag-danger' : 'outline-tag-secondary',
            ]"
          />
          <span
            v-if="displayItemFlags.length === 0"
            class="text-sm text-surface-500 dark:text-surface-400 italic"
          >
            No special properties
          </span>
        </div>

        <!-- Interpolation Controls (right-aligned). While peeking, they
             interpolate against the peeked snapshot. -->
        <div class="flex-1 flex justify-end">
          <ItemInterpolationBar
            :item="item"
            :game-version="peekVersion"
            :initial-ql="route.query.ql ? parseInt(route.query.ql as string) : undefined"
            @item-update="handleInterpolatedItem"
            @error="handleInterpolationError"
          />
        </div>

        <!-- Advanced View Toggle (right side) -->
        <div class="flex items-center gap-2">
          <label for="advanced-view-toggle" class="text-sm text-surface-700 dark:text-surface-300">
            Advanced view
          </label>
          <InputSwitch id="advanced-view-toggle" v-model="advancedView" />
        </div>
      </div>

      <!-- Snapshot comparison (while peeking) -->
      <ItemVersionDiff
        v-if="showDiff"
        :from-item="item"
        :to-item="currentVersionItem"
        :from-label="peekLabel"
        :to-label="currentVersionLabel"
      />
      <!-- Item Overview -->
      <div class="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <!-- Item Slots Display and Basic Info -->
        <div class="lg:col-span-1">
          <Card>
            <template #content>
              <div class="space-y-4">
                <!-- Item Slots Display or Icon -->
                <ItemSlotsDisplay :item="item" />
              </div>
            </template>
          </Card>
        </div>

        <!-- Item Description -->
        <div class="lg:col-span-2">
          <Card>
            <template #content>
              <div class="description-component">
                <!-- Header -->
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-file-edit text-gray-500"></i>
                    <h3 class="text-base font-semibold">Description</h3>
                  </div>
                </div>

                <div v-if="item.description">
                  <p class="text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                    {{ item.description }}
                  </p>
                </div>
                <div v-else class="text-sm text-surface-500 dark:text-surface-400 italic">
                  No description available
                </div>
              </div>
            </template>
          </Card>
        </div>

        <!-- You can help! -->
        <div class="lg:col-span-1">
          <Card>
            <template #content>
              <div class="help-component">
                <!-- Header -->
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-lightbulb text-yellow-500"></i>
                    <h3 class="text-base font-semibold">You can help!</h3>
                  </div>
                </div>

                <div class="text-sm text-surface-600 dark:text-surface-400">
                  <p class="mb-4 leading-relaxed">
                    TinkerItems and the other TinkerTools are a player-run project. Your kind help
                    keeping them online and ad-free is GREATLY appreciated!
                  </p>
                  <div class="flex items-center gap-2">
                    <a
                      href="https://patreon.com/tinkeringidiot"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="hover:opacity-80 transition-opacity flex-1"
                    >
                      <img
                        src="https://cdn.tinkeringidiot.com/static/image/patreon_name.png"
                        alt="Support on Patreon"
                        class="h-10 w-full object-fill"
                      />
                    </a>
                    <a
                      href="https://discord.gg/a7baGx76un"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="hover:opacity-80 transition-opacity flex-1"
                    >
                      <img
                        src="https://cdn.tinkeringidiot.com/static/image/discord_logo.svg"
                        alt="Join Discord"
                        class="h-10 w-full object-fill"
                      />
                    </a>
                  </div>
                </div>
              </div>
            </template>
          </Card>
        </div>
      </div>

      <!-- Weapon Statistics (for weapons only) -->
      <WeaponStats
        v-if="item && item.item_class && isWeapon(item.item_class)"
        :item="displayedItem ?? item"
        :profile="profile"
        :show-compatibility="showCompatibility"
        :attack-stats="item.attack_stats"
        :defense-stats="item.defense_stats"
      />

      <!-- Nano Statistics (for nanos only) -->
      <NanoStatistics
        v-if="item && item.is_nano"
        :item="displayedItem ?? item"
        :profile="profile"
        :show-compatibility="showCompatibility"
        :attack-stats="item.attack_stats"
        :defense-stats="item.defense_stats"
      />

      <!-- Actions and Usage -->
      <Card v-if="item.actions?.length">
        <template #content>
          <div class="actions-requirements-component">
            <!-- Header with Requirements Badge -->
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <i class="pi pi-key text-blue-500"></i>
                <h3 class="text-base font-semibold">Requirements</h3>
              </div>
            </div>

            <ActionRequirements
              :actions="displayedItem?.actions ?? []"
              :character-stats="characterStats"
              :expanded="true"
              :show-oe-breakpoints="canWear"
            />
          </div>
        </template>
      </Card>

      <!-- Spell Data Effects (for items with spell_data) -->
      <SpellDataDisplay
        v-if="displayedItem && displayedItem.spell_data && displayedItem.spell_data.length > 0"
        :spell-data="displayedItem.spell_data"
        :profile="profile"
        :show-hidden="false"
        :advanced-view="advancedView"
      />

      <!-- Raw Stats (only visible in advanced view) -->
      <RawStats v-if="item && item.stats" v-show="advancedView" :stats="item.stats" />

      <!-- Item Sources -->
      <ItemSources v-if="item && item.sources && item.sources.length > 0" :sources="item.sources" />
    </div>
  </div>

  <!-- Equip Slot Selector Dialog -->
  <EquipSlotSelector
    v-model:visible="equipDialogVisible"
    :item="displayedItem"
    :profile="profile"
    :valid-slots="validSlots"
    @confirm="handleEquipItem"
    @cancel="equipDialogVisible = false"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router';
import { useItemsStore } from '@/stores/items';
import { useTinkerProfilesStore } from '@/stores/tinkerProfiles';
import {
  isWeapon,
  getDisplayItemFlags,
  getDisplayCanFlags,
  getItemCanFlags,
  getItemSlotInfo,
} from '@/services/game-utils';
import { mapProfileToStats } from '@/utils/profile-stats-mapper';
import type { Item, InterpolatedItem } from '@/types/api';

// Import new components
import WeaponStats from '@/components/items/WeaponStats.vue';
import NanoStatistics from '@/components/items/NanoStatistics.vue';
import SpellDataDisplay from '@/components/items/SpellDataDisplay.vue';
import ItemSlotsDisplay from '@/components/items/ItemSlotsDisplay.vue';
import ActionRequirements from '@/components/ActionRequirements.vue';
import RawStats from '@/components/items/RawStats.vue';
import ItemSources from '@/components/items/ItemSources.vue';
import ItemInterpolationBar from '@/components/items/ItemInterpolationBar.vue';
import EquipSlotSelector from '@/components/items/EquipSlotSelector.vue';
import ItemHistoryControl from '@/components/versions/ItemHistoryControl.vue';
import ItemVersionDiff from '@/components/versions/ItemVersionDiff.vue';
import { useToast } from 'primevue/usetoast';
import { apiClient } from '@/services/api-client';
import { useGameVersion } from '@/composables/useGameVersion';
import type { ItemRevisionsResponse } from '@/types/game-version';

const route = useRoute();
const router = useRouter();
const itemsStore = useItemsStore();
const profilesStore = useTinkerProfilesStore();
const toast = useToast();

// Props
const props = defineProps<{
  aoid?: string;
}>();

// State
const item = ref<Item | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const advancedView = ref(false);
const equipDialogVisible = ref(false);
const validSlots = ref<string[]>([]);

// Item change history across game versions
const {
  currentVersion,
  current: currentGameVersion,
  versions: gameVersions,
  versionedPath,
} = useGameVersion();
const revisions = ref<ItemRevisionsResponse | null>(null);
const compareWithCurrent = ref(false);
const currentVersionItem = ref<Item | null>(null);

// Interpolation state
const interpolatedItem = ref<InterpolatedItem | null>(null);
const interpolationError = ref<string | null>(null);

// Current QL for interpolation (from query param or item's base QL)
const currentQl = computed(() => {
  const queryQl = route.query.ql ? parseInt(route.query.ql as string) : null;
  return queryQl || item.value?.ql || null;
});

// ============================================================================
// Version peek (?as=<slug>): show this item as another snapshot defines it
// ============================================================================

const itemAoid = computed(() => props.aoid || (route.params.aoid as string) || '');

/** Snapshot being peeked at, or null when viewing the browsing version. */
const peekVersion = computed(() => {
  const as = route.query.as;
  if (typeof as !== 'string' || !as) return null;
  return as === currentVersion.value ? null : as;
});

/** Version the displayed item was actually loaded from. */
const requestVersion = computed(() => peekVersion.value || currentVersion.value);

function versionLabel(slug: string | null | undefined): string {
  if (!slug) return 'this version';
  return (
    gameVersions.value.find((version) => version.slug === slug)?.display_name ||
    revisions.value?.revisions.find((point) => point.version_slug === slug)?.display_name ||
    slug
  );
}

const peekLabel = computed(() => versionLabel(peekVersion.value));
const currentVersionLabel = computed(
  () => currentGameVersion.value?.display_name || currentVersion.value || 'this version'
);
const firstSeenLabel = computed(() => versionLabel(revisions.value?.first_seen_in));

/** The item is absent from the browsing version but exists in another one. */
const missingInCurrent = computed(() => {
  const history = revisions.value;
  if (!history || peekVersion.value || item.value) return false;
  if (!history.first_seen_in || !currentVersion.value) return false;
  return !history.present_in.includes(currentVersion.value);
});

const showDiff = computed(
  () => compareWithCurrent.value && !!peekVersion.value && !!currentVersionItem.value
);

// Computed
const profile = computed(() => profilesStore.activeProfile);
const showCompatibility = computed(() => !!profile.value);

// Character stats for action requirements
const characterStats = computed(() => {
  if (!profile.value) return null;

  // Use the profile stats mapper utility to convert TinkerProfile to flat stat map
  return mapProfileToStats(profile.value);
});

const displayItemFlags = computed(() => {
  if (!item.value?.stats) return [];

  // Combine CAN flags and item flags
  const canFlags = getDisplayCanFlags(item.value.stats);
  const itemFlags = getDisplayItemFlags(item.value.stats);

  // CAN flags first, then item flags
  return [...canFlags, ...itemFlags];
});

// Use interpolated item if available, otherwise use original item
const displayedItem = computed((): Item | null => {
  if (!item.value) return null;
  return interpolatedItem.value
    ? withInterpolation(item.value, interpolatedItem.value)
    : item.value;
});

/**
 * The item at its interpolated QL. Interpolation returns only the QL-dependent
 * data; the rest (attack/defense stats, sources, ...) comes from the base item,
 * as do the record ids interpolated spells and actions do not carry.
 */
function withInterpolation(base: Item, interpolated: InterpolatedItem): Item {
  return {
    ...base,
    id: interpolated.id,
    aoid: interpolated.aoid ?? base.aoid,
    name: interpolated.name,
    ql: interpolated.ql ?? base.ql,
    description: interpolated.description ?? base.description,
    stats: interpolated.stats,
    spell_data: interpolated.spell_data.map((data, i) => ({
      ...data,
      id: base.spell_data[i]?.id ?? -(i + 1),
      spells: data.spells.map((spell, j) => ({
        ...spell,
        id: base.spell_data[i]?.spells[j]?.id ?? -(j + 1),
      })),
    })),
    actions: interpolated.actions.map((action, i) => ({
      ...action,
      id: base.actions[i]?.id ?? -(i + 1),
      item_id: interpolated.id,
    })),
  };
}

// Check if item can be equipped (is equippable and profile meets requirements)
const canEquip = computed(() => {
  if (!profile.value || !displayedItem.value) return false;

  // Check if item is equippable (weapons, armor, implants)
  const itemClass = displayedItem.value.item_class;
  if (itemClass !== 1 && itemClass !== 2 && itemClass !== 3) return false;

  // Check if requirements are met (you can add more sophisticated checks here)
  // For now, just check if there's an active profile
  return true;
});

// Check if item has "Wear" CAN flag (for showing OE breakpoints)
const canWear = computed(() => {
  if (!displayedItem.value?.stats) return false;
  const canFlags = getItemCanFlags(displayedItem.value.stats);
  return canFlags.includes('Wear');
});

// Methods
async function loadItem() {
  const aoidParam = itemAoid.value;
  if (!aoidParam) return;

  loading.value = true;
  error.value = null;

  // Clear stale interpolation state when loading a new item
  interpolatedItem.value = null;
  interpolationError.value = null;

  const aoid = parseInt(aoidParam);

  try {
    if (peekVersion.value) {
      // Peeked snapshots are never written to the items store: the store holds
      // the browsing version's data only.
      const response = await apiClient.getItem(aoid, { gameVersion: peekVersion.value });
      if (response.success && response.data) {
        item.value = response.data;
      } else {
        item.value = null;
        error.value = 'Item not found in this snapshot';
      }
    } else {
      const loadedItem = await itemsStore.getItem(aoid);
      if (loadedItem) {
        item.value = loadedItem;
      } else {
        item.value = null;
        // Check if there's an error in the store
        if (itemsStore.error) {
          error.value = itemsStore.error.message || 'Failed to load item';
        } else {
          error.value = 'Item not found';
        }
      }
    }
  } catch (err) {
    item.value = null;
    error.value = (err instanceof Error && err.message) || 'Failed to load item';
  } finally {
    loading.value = false;
  }
}

/**
 * Patch points for this item. Non-blocking: a failure simply hides the
 * history control.
 */
async function loadRevisions() {
  const aoidParam = itemAoid.value;
  if (!aoidParam) {
    revisions.value = null;
    return;
  }
  try {
    revisions.value = await apiClient.getItemRevisions(parseInt(aoidParam));
  } catch {
    revisions.value = null;
  }
}

/** The item as the browsing version defines it, for the comparison table. */
async function loadCurrentVersionItem() {
  const aoidParam = itemAoid.value;
  if (!aoidParam || !peekVersion.value) {
    currentVersionItem.value = null;
    return;
  }
  try {
    currentVersionItem.value = await itemsStore.getItem(parseInt(aoidParam));
  } catch {
    currentVersionItem.value = null;
  }
}

/** Selecting a patch point peeks at it; selecting the browsing version exits. */
async function onHistorySelect(slug: string) {
  const query: LocationQueryRaw = { ...route.query };
  if (!slug || slug === currentVersion.value) {
    delete query.as;
  } else {
    query.as = slug;
  }
  await router.replace({ name: 'ItemDetail', params: { ...route.params }, query });
}

async function exitPeek() {
  await onHistorySelect(currentVersion.value || '');
}

async function viewFirstSeen() {
  const slug = revisions.value?.first_seen_in;
  if (slug) await onHistorySelect(slug);
}

async function toggleCompare() {
  compareWithCurrent.value = !compareWithCurrent.value;
  if (compareWithCurrent.value && !currentVersionItem.value) {
    await loadCurrentVersionItem();
  }
}

async function goBack() {
  // Try to go back in browser history
  // If there's no history or we came from outside the app, fall back to items page
  if (window.history.length > 1 && document.referrer.includes(window.location.origin)) {
    router.go(-1);
  } else {
    await router.push({ name: 'TinkerItems' });
  }
}

function addToComparison() {
  // Emit event or call parent method to add to comparison
  console.log('Add to comparison:', item.value?.id);
}

async function shareItem() {
  if (!item.value) return;

  // A shared link must open the same game version, and the same peek.
  const params = new URLSearchParams();
  if (route.query.ql) params.set('ql', String(route.query.ql));
  if (peekVersion.value) params.set('as', peekVersion.value);
  const queryString = params.toString();
  const url = `${window.location.origin}${versionedPath(`/items/${item.value.aoid}`)}${
    queryString ? `?${queryString}` : ''
  }`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: item.value.name,
        text: item.value.description,
        url,
      });
    } catch (err) {
      // Dismissing the share sheet rejects with AbortError; that is not a failure
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        console.error('Failed to share item:', err);
      }
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    toast.add({
      severity: 'success',
      summary: 'Link Copied',
      detail: 'Item URL copied to clipboard',
      life: 3000,
    });
  } catch (err) {
    console.error('Failed to copy item link:', err);
    toast.add({
      severity: 'error',
      summary: 'Copy Failed',
      detail: 'Could not copy the item URL to the clipboard',
      life: 3000,
    });
  }
}

function showEquipDialog() {
  if (!displayedItem.value) return;

  // Determine valid slots for this item based on its type and stats
  const slotInfo = getItemSlotInfo(displayedItem.value);
  validSlots.value = slotInfo.slots;

  equipDialogVisible.value = true;
}

async function handleEquipItem(slot: string) {
  if (!displayedItem.value || !profile.value) return;

  try {
    // Use the store's equipItem method
    await profilesStore.equipItem(displayedItem.value, slot);

    // Close the dialog
    equipDialogVisible.value = false;

    // Show success message
    toast.add({
      severity: 'success',
      summary: 'Item Equipped',
      detail: `${displayedItem.value.name} has been equipped to ${slot}`,
      life: 3000,
    });
  } catch (error) {
    console.error('Failed to equip item:', error);
    toast.add({
      severity: 'error',
      summary: 'Equip Failed',
      detail: 'Failed to equip the item. Please try again.',
      life: 3000,
    });
  }
}

async function castBuff() {
  if (!displayedItem.value) return;

  try {
    // Cast to Item type to handle both interpolated and regular items
    await profilesStore.castBuff(displayedItem.value);
    toast.add({
      severity: 'success',
      summary: 'Buff Cast',
      detail: `${displayedItem.value.name} has been cast on your active profile`,
      life: 3000,
    });
  } catch (error) {
    console.error('Failed to cast buff:', error);
    toast.add({
      severity: 'error',
      summary: 'Cast Failed',
      detail: error instanceof Error ? error.message : 'Failed to cast the buff',
      life: 3000,
    });
  }
}

// Interpolation methods
function handleInterpolatedItem(interpolated: InterpolatedItem | null) {
  interpolatedItem.value = interpolated;
}

function handleInterpolationError(errorMessage: string) {
  interpolationError.value = errorMessage;
}

// Initialize
onMounted(async () => {
  // Load profiles if not already loaded
  if (!profilesStore.hasProfiles) {
    await profilesStore.loadProfiles();
  }
  // Both record their own failures
  await Promise.all([loadItem(), loadRevisions()]);
});

// Watch for route changes
watch(
  () => route.params.aoid,
  async () => {
    if (route.name === 'ItemDetail') {
      compareWithCurrent.value = false;
      currentVersionItem.value = null;
      await Promise.all([loadItem(), loadRevisions()]);
    }
  }
);

// Peeking at another snapshot reloads the item from that version
watch(
  () => route.query.as,
  async () => {
    if (route.name !== 'ItemDetail') return;
    compareWithCurrent.value = false;
    currentVersionItem.value = null;
    await loadItem();
  }
);

// Route QL handling is now done entirely by ItemInterpolationBar

// ============================================================================
// Expose for Tests
// ============================================================================

defineExpose({
  interpolatedItem,
  displayedItem,
  interpolationError,
  revisions,
  peekVersion,
  missingInCurrent,
  compareWithCurrent,
});
</script>

<style scoped>
.font-mono {
  font-family: 'Courier New', 'Monaco', 'Lucida Console', monospace;
}

/* Custom scrollbar */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}

.overflow-y-auto::-webkit-scrollbar-track {
  @apply bg-surface-100 dark:bg-surface-800;
}

.overflow-y-auto::-webkit-scrollbar-thumb {
  @apply bg-surface-300 dark:bg-surface-600 rounded-full;
}
</style>

<!--
ItemSources - Display item acquisition sources component
Shows where items can be obtained (crystals, NPCs, missions, etc.)
-->
<template>
  <Card v-if="hasSources">
    <template #content>
      <div class="item-sources-component">
        <!-- Header -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <i class="pi pi-map-marker text-blue-500"></i>
            <h3 class="text-base font-semibold">Item Sources</h3>
          </div>
          <div class="text-xs text-surface-500 dark:text-surface-400">
            {{ sources.length }} source{{ sources.length !== 1 ? 's' : '' }}
          </div>
        </div>

        <!-- Sources List -->
        <div class="space-y-2">
          <div
            v-for="(source, index) in sources"
            :key="`source-${index}`"
            class="source-item p-3 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 cursor-pointer"
            @click="navigateToSourceItem(source)"
          >
            <div class="flex items-start gap-3">
              <!-- Source Item Icon -->
              <div class="flex-shrink-0">
                <img
                  v-if="getSourceItemIconUrl(source)"
                  :src="getSourceItemIconUrl(source)"
                  :alt="source.source.name"
                  class="w-8 h-8 rounded border border-surface-200 dark:border-surface-600 bg-surface-100 dark:bg-surface-800"
                  @error="onIconError($event)"
                />
                <div
                  v-else
                  class="w-8 h-8 rounded border border-surface-200 dark:border-surface-600 bg-surface-100 dark:bg-surface-800 flex items-center justify-center"
                >
                  <i
                    :class="getSourceIcon(source.source.source_type?.name)"
                    class="text-sm text-surface-500"
                  ></i>
                </div>
              </div>

              <!-- Source Info -->
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-surface-900 dark:text-surface-100 truncate">
                  {{ source.source.name }}
                </div>

                <!-- Additional Info -->
                <div
                  v-if="hasAdditionalInfo(source)"
                  class="flex flex-wrap gap-3 text-xs text-surface-600 dark:text-surface-400"
                >
                  <span v-if="source.drop_rate" class="flex items-center gap-1">
                    <i class="pi pi-percentage"></i>
                    Drop Rate: {{ formatDropRate(source.drop_rate) }}%
                  </span>
                  <span v-if="source.min_ql || source.max_ql" class="flex items-center gap-1">
                    <i class="pi pi-star"></i>
                    QL: {{ formatQLRange(source.min_ql, source.max_ql) }}
                  </span>
                  <span v-if="source.conditions" class="flex items-center gap-1">
                    <i class="pi pi-info-circle"></i>
                    {{ source.conditions }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State (fallback) -->
        <div
          v-if="sources.length === 0"
          class="text-center py-4 text-surface-500 dark:text-surface-400 text-sm italic"
        >
          No source information available
        </div>
      </div>
    </template>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { getItemIconUrl } from '@/services/game-utils';
import type { ItemSource } from '@/types/api';

// Props
const props = defineProps<{
  sources?: ItemSource[];
}>();

// Router
const router = useRouter();

// Computed
const sources = computed(() => props.sources || []);

const hasSources = computed(() => sources.value.length > 0);

// Methods
function getSourceIcon(sourceType?: string): string {
  if (!sourceType) return 'pi pi-question-circle';

  switch (sourceType.toLowerCase()) {
    case 'crystal':
    case 'nano_crystal':
      return 'pi pi-sparkles text-purple-500';
    case 'npc':
    case 'mob':
      return 'pi pi-user text-red-500';
    case 'mission':
    case 'quest':
      return 'pi pi-flag text-green-500';
    case 'shop':
    case 'vendor':
      return 'pi pi-shopping-cart text-blue-500';
    case 'loot':
    case 'drop':
      return 'pi pi-gift text-orange-500';
    case 'boss':
      return 'pi pi-crown text-yellow-500';
    default:
      return 'pi pi-database text-gray-500';
  }
}

function formatSourceType(sourceType?: string): string {
  if (!sourceType) return 'Unknown';

  // Convert snake_case or lowercase to proper case
  return sourceType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatDropRate(dropRate: number): string {
  return dropRate.toFixed(1);
}

function formatQLRange(minQL?: number | null, maxQL?: number | null): string {
  if (minQL && maxQL) {
    return minQL === maxQL ? `${minQL}` : `${minQL}-${maxQL}`;
  } else if (minQL) {
    return `${minQL}+`;
  } else if (maxQL) {
    return `≤${maxQL}`;
  }
  return 'Any';
}

function hasAdditionalInfo(source: ItemSource): boolean {
  return !!(source.drop_rate || source.min_ql || source.max_ql || source.conditions);
}

function getSourceItemIconUrl(source: ItemSource): string | null {
  // Get stats from the source's extra_data if available
  const sourceData = source.source?.extra_data;

  // Look for item stats in various possible locations
  let stats = null;

  if (sourceData?.stats) {
    stats = sourceData.stats;
  } else if (sourceData?.item_stats) {
    stats = sourceData.item_stats;
  } else if (Array.isArray(sourceData)) {
    // Sometimes stats might be directly in the array
    stats = sourceData;
  }

  // If we have stats, try to get the icon URL
  if (stats && Array.isArray(stats)) {
    return getItemIconUrl(stats);
  }

  return null;
}

function onIconError(event: Event) {
  // Hide the image on error and show fallback icon
  const img = event.target as HTMLImageElement;
  img.style.display = 'none';
}

function navigateToSourceItem(source: ItemSource) {
  // Get the source item's AOID from source_id
  const sourceItemId = source.source.source_id;

  if (sourceItemId) {
    // Navigate to the source item's detail page
    router.push(`/items/${sourceItemId}`);
  }
}
</script>

<style scoped>
.source-item {
  transition: all 0.2s ease;
}

.source-item:hover {
  @apply bg-surface-100 dark:bg-surface-700 border-surface-300 dark:border-surface-600;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Ensure icon images are crisp */
.source-item img {
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}

/* Icon colors are defined inline for better customization */
</style>

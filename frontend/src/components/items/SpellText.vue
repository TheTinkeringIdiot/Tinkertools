<!--
SpellText - Renders interpolated spell text with proper links for NanoID/ItemID
Handles [LINK:AOID] placeholders and converts them to router links with item names
-->
<template>
  <span class="spell-text">
    <template v-for="(part, index) in textParts" :key="index">
      <router-link
        v-if="part.type === 'link'"
        :to="`/items/${part.aoid}`"
        class="spell-link"
        :title="`Navigate to ${part.itemName}`"
      >
        <span v-if="part.loading" class="loading-text">Loading...</span>
        <span v-else>{{ part.itemName }}</span>
      </router-link>
      <span v-else>{{ part.text }}</span>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue';
import { useItemsStore } from '@/stores/items';

// ============================================================================
// Props
// ============================================================================

interface Props {
  text: string;
}

const props = defineProps<Props>();

// ============================================================================
// Stores
// ============================================================================

const itemsStore = useItemsStore();

// ============================================================================
// State
// ============================================================================

const linkedItems = ref<Map<number, { name?: string; loading: boolean }>>(new Map());

// ============================================================================
// Methods
// ============================================================================

async function loadItemName(aoid: number) {
  if (linkedItems.value.has(aoid)) return;

  // Set loading state
  linkedItems.value.set(aoid, { loading: true });

  // Try cache first
  const cachedItem = itemsStore.getItemFromCache(aoid);
  if (cachedItem) {
    linkedItems.value.set(aoid, { name: cachedItem.name, loading: false });
    return;
  }

  // Fetch from API
  try {
    const item = await itemsStore.getItem(aoid);
    linkedItems.value.set(aoid, {
      name: item?.name || `Item ${aoid}`,
      loading: false,
    });
  } catch (error) {
    linkedItems.value.set(aoid, {
      name: `Item ${aoid}`,
      loading: false,
    });
  }
}

// ============================================================================
// Computed Properties
// ============================================================================

interface TextPart {
  type: 'text' | 'link';
  text?: string;
  aoid?: number;
  itemName?: string;
  loading?: boolean;
}

const textParts = computed((): TextPart[] => {
  if (!props.text) return [];

  const parts: TextPart[] = [];
  const linkRegex = /\[LINK:(\d+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = linkRegex.exec(props.text)) !== null) {
    const beforeText = props.text.slice(lastIndex, match.index);
    if (beforeText) {
      parts.push({ type: 'text', text: beforeText });
    }

    const aoid = parseInt(match[1]);
    const linkedItem = linkedItems.value.get(aoid);

    parts.push({
      type: 'link',
      aoid,
      itemName: linkedItem?.name || `Item ${aoid}`,
      loading: linkedItem?.loading || false,
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  const remainingText = props.text.slice(lastIndex);
  if (remainingText) {
    parts.push({ type: 'text', text: remainingText });
  }

  return parts;
});

// ============================================================================
// Watchers & Lifecycle
// ============================================================================

// Extract AOIDs from text and load their names
const extractAndLoadItems = () => {
  if (!props.text) return;

  const linkRegex = /\[LINK:(\d+)\]/g;
  let match;

  while ((match = linkRegex.exec(props.text)) !== null) {
    const aoid = parseInt(match[1]);
    loadItemName(aoid);
  }
};

// Load items when component mounts
onMounted(() => {
  extractAndLoadItems();
});

// Load items when text changes
watch(
  () => props.text,
  () => {
    extractAndLoadItems();
  },
  { immediate: true }
);
</script>

<style scoped>
.spell-text {
  font-size: 12px;
  color: #374151;
}

.dark .spell-text {
  color: #d1d5db;
}

.spell-link {
  color: #3b82f6;
  text-decoration: none;
  font-weight: 600;
  border-bottom: 1px solid transparent;
  transition: all 0.2s ease;
}

.spell-link:hover {
  color: #1d4ed8;
  border-bottom-color: #3b82f6;
}

.dark .spell-link {
  color: #60a5fa;
}

.dark .spell-link:hover {
  color: #93c5fd;
  border-bottom-color: #60a5fa;
}

.loading-text {
  opacity: 0.6;
  font-style: italic;
}
</style>

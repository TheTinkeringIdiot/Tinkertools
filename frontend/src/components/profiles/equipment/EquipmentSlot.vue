<!--
EquipmentSlot - Individual equipment slot display
Shows a single equipment slot with item icon or empty state
-->
<template>
  <div 
    class="equipment-slot bg-surface-50 dark:bg-surface-800 border-2 border-dashed border-surface-300 dark:border-surface-600 rounded-lg flex items-center justify-center relative group transition-all duration-200 hover:border-primary-400 dark:hover:border-primary-500"
    :class="{
      'border-solid border-primary-400 dark:border-primary-500 bg-primary-50 dark:bg-primary-950': hasItem,
      'min-h-[64px] w-16': true
    }"
    :title="slotTooltip"
  >
    <!-- Item Icon -->
    <div v-if="hasItem" class="flex flex-col items-center justify-center p-1">
      <img 
        v-if="itemIconUrl"
        :src="itemIconUrl"
        :alt="`${itemName} icon`"
        class="w-10 h-10 object-contain mb-1"
        @error="onIconError"
      />
      <i v-else class="pi pi-box text-lg text-primary-600 dark:text-primary-400 mb-1"></i>
      
      <!-- Item name (truncated) -->
      <div class="text-xs text-center text-surface-700 dark:text-surface-300 leading-tight max-w-full">
        <div class="truncate" :title="itemName">{{ itemName }}</div>
      </div>
    </div>
    
    <!-- Empty Slot -->
    <div v-else class="flex flex-col items-center justify-center text-surface-400 dark:text-surface-500">
      <i class="pi pi-plus text-lg mb-1"></i>
      <div class="text-xs text-center leading-tight">{{ slotName }}</div>
    </div>
    
    <!-- Quality Level Badge -->
    <div v-if="hasItem && itemQL" class="absolute -top-1 -right-1">
      <div class="bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
        {{ itemQL }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// Props
const props = defineProps<{
  slotName: string;
  item?: any;
}>();

// Computed
const hasItem = computed(() => {
  return props.item && (props.item.name || props.item.Name);
});

const itemName = computed(() => {
  if (!props.item) return '';
  return props.item.name || props.item.Name || '';
});

const itemQL = computed(() => {
  if (!props.item) return null;
  return props.item.ql || props.item.QL || null;
});

const itemIconUrl = computed(() => {
  if (!props.item) return null;
  
  // Try various possible icon URL fields
  if (props.item.iconUrl) return props.item.iconUrl;
  if (props.item.icon_url) return props.item.icon_url;
  if (props.item.ItemIcon) return props.item.ItemIcon;
  if (props.item.icon) return props.item.icon;
  
  // Generate icon URL if we have an item ID
  if (props.item.id) {
    return `/api/items/${props.item.id}/icon`;
  }
  
  return null;
});

const slotTooltip = computed(() => {
  if (hasItem.value) {
    let tooltip = `${props.slotName}: ${itemName.value}`;
    if (itemQL.value) {
      tooltip += ` (QL ${itemQL.value})`;
    }
    return tooltip;
  } else {
    return `${props.slotName} (Empty)`;
  }
});

// Methods
function onIconError() {
  // Icon failed to load - could log this or show fallback
  console.warn(`Failed to load icon for item: ${itemName.value}`);
}
</script>

<style scoped>
.equipment-slot {
  aspect-ratio: 1;
  min-width: 64px;
  min-height: 64px;
}

.equipment-slot:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

/* Dark mode shadow adjustment */
.dark .equipment-slot:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .equipment-slot {
    min-width: 56px;
    min-height: 56px;
  }
}
</style>
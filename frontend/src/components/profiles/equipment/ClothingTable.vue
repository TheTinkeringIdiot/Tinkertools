<!--
ClothingTable - Clothing and armor equipment slots display
Visual grid showing clothing slot positions with equipped items as icons
-->
<template>
  <div class="clothing-table">
    <div class="equipment-grid">
      <!-- First row: Head, Shoulder -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <div></div> <!-- Empty space -->
        <EquipmentSlot 
          slot-name="Head"
          :item="clothing['Head']"
        />
        <EquipmentSlot 
          slot-name="Shoulder"
          :item="clothing['Shoulder']"
        />
      </div>
      
      <!-- Second row: Back, Chest, Arms -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <EquipmentSlot 
          slot-name="Back"
          :item="clothing['Back']"
        />
        <EquipmentSlot 
          slot-name="Chest"
          :item="clothing['Chest']"
        />
        <EquipmentSlot 
          slot-name="Arms"
          :item="clothing['Arms']"
        />
      </div>
      
      <!-- Third row: Wrists, Hands -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <div></div> <!-- Empty space -->
        <EquipmentSlot 
          slot-name="Wrists"
          :item="clothing['Wrists']"
        />
        <EquipmentSlot 
          slot-name="Hands"
          :item="clothing['Hands']"
        />
      </div>
      
      <!-- Fourth row: Waist, Legs, Feet -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <EquipmentSlot 
          slot-name="Waist"
          :item="clothing['Waist']"
        />
        <EquipmentSlot 
          slot-name="Legs"
          :item="clothing['Legs']"
        />
        <EquipmentSlot 
          slot-name="Feet"
          :item="clothing['Feet']"
        />
      </div>
      
      <!-- Fifth row: Ring, Deck -->
      <div class="grid grid-cols-3 gap-2">
        <div></div> <!-- Empty space -->
        <EquipmentSlot 
          slot-name="Ring"
          :item="clothing['Ring']"
        />
        <EquipmentSlot 
          slot-name="Deck"
          :item="clothing['Deck']"
        />
      </div>
    </div>
    
    <!-- Equipment List (fallback for non-visual display) -->
    <div v-if="hasEquippedItems" class="mt-4">
      <div class="text-sm text-surface-600 dark:text-surface-400 mb-2">Equipped Clothing:</div>
      <div class="space-y-1">
        <div 
          v-for="(item, slotName) in equippedClothing"
          :key="slotName"
          class="flex justify-between text-sm"
        >
          <span class="text-surface-700 dark:text-surface-300">{{ slotName }}:</span>
          <span class="text-surface-900 dark:text-surface-50 font-medium">{{ getItemName(item) }}</span>
        </div>
      </div>
    </div>
    
    <!-- Empty State -->
    <div v-else class="text-center py-4">
      <i class="pi pi-user text-2xl text-surface-300 dark:text-surface-600 mb-2"></i>
      <p class="text-sm text-surface-500 dark:text-surface-400">No clothing equipped</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import EquipmentSlot from './EquipmentSlot.vue';

// Props
const props = defineProps<{
  clothing: Record<string, any>;
}>();

// Computed
const equippedClothing = computed(() => {
  return Object.fromEntries(
    Object.entries(props.clothing || {}).filter(([_, item]) => item && getItemName(item))
  );
});

const hasEquippedItems = computed(() => {
  return Object.keys(equippedClothing.value).length > 0;
});

// Methods
function getItemName(item: any): string {
  if (!item) return '';
  return item.name || item.Name || '';
}
</script>

<style scoped>
.equipment-grid {
  max-width: 400px;
  margin: 0 auto;
}
</style>
<!--
WeaponsTable - Weapon equipment slots display
Visual grid showing weapon slot positions with equipped items as icons
-->
<template>
  <div class="weapons-table">
    <div class="equipment-grid">
      <!-- First row: Right Hand, Left Hand -->
      <div class="grid grid-cols-2 gap-2 mb-2">
        <EquipmentSlot 
          slot-name="Right Hand"
          :item="weapons['Right Hand']"
        />
        <EquipmentSlot 
          slot-name="Left Hand" 
          :item="weapons['Left Hand']"
        />
      </div>
      
      <!-- Second row: Belt (centered) -->
      <div class="flex justify-center">
        <EquipmentSlot 
          slot-name="Belt"
          :item="weapons['Belt']"
        />
      </div>
    </div>
    
    <!-- Equipment List (fallback for non-visual display) -->
    <div v-if="hasEquippedItems" class="mt-4">
      <div class="text-sm text-surface-600 dark:text-surface-400 mb-2">Equipped Weapons:</div>
      <div class="space-y-1">
        <div 
          v-for="(item, slotName) in equippedWeapons"
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
      <i class="pi pi-shield text-2xl text-surface-300 dark:text-surface-600 mb-2"></i>
      <p class="text-sm text-surface-500 dark:text-surface-400">No weapons equipped</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import EquipmentSlot from './EquipmentSlot.vue';

// Props
const props = defineProps<{
  weapons: Record<string, any>;
}>();

// Computed
const equippedWeapons = computed(() => {
  return Object.fromEntries(
    Object.entries(props.weapons || {}).filter(([_, item]) => item && getItemName(item))
  );
});

const hasEquippedItems = computed(() => {
  return Object.keys(equippedWeapons.value).length > 0;
});

// Methods
function getItemName(item: any): string {
  if (!item) return '';
  return item.name || item.Name || '';
}
</script>

<style scoped>
.equipment-grid {
  max-width: 300px;
  margin: 0 auto;
}

.equipment-slot {
  aspect-ratio: 1;
}
</style>
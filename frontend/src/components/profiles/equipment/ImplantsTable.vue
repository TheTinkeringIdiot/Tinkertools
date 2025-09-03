<!--
ImplantsTable - Implant slots display
Visual grid showing implant slot positions with equipped implants as icons
-->
<template>
  <div class="implants-table">
    <div class="equipment-grid">
      <!-- First row: Ocular, Head, Ear -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <EquipmentSlot 
          slot-name="Ocular"
          :item="implants['Ocular']"
        />
        <EquipmentSlot 
          slot-name="Head"
          :item="implants['Head']"
        />
        <EquipmentSlot 
          slot-name="Ear"
          :item="implants['Ear']"
        />
      </div>
      
      <!-- Second row: Right Arm, Chest, Left Arm -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <EquipmentSlot 
          slot-name="Right Arm"
          :item="implants['Right Arm']"
        />
        <EquipmentSlot 
          slot-name="Chest"
          :item="implants['Chest']"
        />
        <EquipmentSlot 
          slot-name="Left Arm"
          :item="implants['Left Arm']"
        />
      </div>
      
      <!-- Third row: Right Wrist, Waist, Left Wrist -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <EquipmentSlot 
          slot-name="Right Wrist"
          :item="implants['Right Wrist']"
        />
        <EquipmentSlot 
          slot-name="Waist"
          :item="implants['Waist']"
        />
        <EquipmentSlot 
          slot-name="Left Wrist"
          :item="implants['Left Wrist']"
        />
      </div>
      
      <!-- Fourth row: Right Hand, Thigh, Left Hand -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <EquipmentSlot 
          slot-name="Right Hand"
          :item="implants['Right Hand']"
        />
        <EquipmentSlot 
          slot-name="Thigh"
          :item="implants['Thigh']"
        />
        <EquipmentSlot 
          slot-name="Left Hand"
          :item="implants['Left Hand']"
        />
      </div>
      
      <!-- Fifth row: Right Leg, Feet, Left Leg -->
      <div class="grid grid-cols-3 gap-2">
        <EquipmentSlot 
          slot-name="Right Leg"
          :item="implants['Right Leg']"
        />
        <EquipmentSlot 
          slot-name="Feet"
          :item="implants['Feet']"
        />
        <EquipmentSlot 
          slot-name="Left Leg"
          :item="implants['Left Leg']"
        />
      </div>
    </div>
    
    <!-- Equipment List (fallback for non-visual display) -->
    <div v-if="hasEquippedItems" class="mt-4">
      <div class="text-sm text-surface-600 dark:text-surface-400 mb-2">Equipped Implants:</div>
      <div class="space-y-1">
        <div 
          v-for="(item, slotName) in equippedImplants"
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
      <i class="pi pi-cpu text-2xl text-surface-300 dark:text-surface-600 mb-2"></i>
      <p class="text-sm text-surface-500 dark:text-surface-400">No implants equipped</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import EquipmentSlot from './EquipmentSlot.vue';

// Props
const props = defineProps<{
  implants: Record<string, any>;
}>();

// Computed
const equippedImplants = computed(() => {
  return Object.fromEntries(
    Object.entries(props.implants || {}).filter(([_, item]) => item && getItemName(item))
  );
});

const hasEquippedItems = computed(() => {
  return Object.keys(equippedImplants.value).length > 0;
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
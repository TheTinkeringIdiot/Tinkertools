<!--
ClothingTable - Clothing and armor equipment slots display
Visual grid showing clothing slot positions with equipped items as icons
-->
<template>
  <div class="clothing-table">
    <div class="equipment-grid">
      <!-- First row: Head, Shoulder -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <div></div>
        <!-- Empty space -->
        <EquipmentSlot slot-name="Head" :item="getClothingBySlot('Head')" />
        <EquipmentSlot slot-name="Shoulder" :item="getClothingBySlot('Shoulder')" />
      </div>

      <!-- Second row: Back, Chest, Arms -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <EquipmentSlot slot-name="Back" :item="getClothingBySlot('Back')" />
        <EquipmentSlot slot-name="Chest" :item="getClothingBySlot('Chest')" />
        <EquipmentSlot slot-name="Arms" :item="getClothingBySlot('Arms')" />
      </div>

      <!-- Third row: Wrists, Hands -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <div></div>
        <!-- Empty space -->
        <EquipmentSlot slot-name="Wrists" :item="getClothingBySlot('Wrists')" />
        <EquipmentSlot slot-name="Hands" :item="getClothingBySlot('Hands')" />
      </div>

      <!-- Fourth row: Waist, Legs, Feet -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <EquipmentSlot slot-name="Waist" :item="getClothingBySlot('Waist')" />
        <EquipmentSlot slot-name="Legs" :item="getClothingBySlot('Legs')" />
        <EquipmentSlot slot-name="Feet" :item="getClothingBySlot('Feet')" />
      </div>

      <!-- Fifth row: Ring, Deck -->
      <div class="grid grid-cols-3 gap-2">
        <div></div>
        <!-- Empty space -->
        <EquipmentSlot slot-name="Ring" :item="getClothingBySlot('Ring')" />
        <EquipmentSlot slot-name="Deck" :item="getClothingBySlot('Deck')" />
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
          <span class="text-surface-900 dark:text-surface-50 font-medium">{{
            getItemName(item)
          }}</span>
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
import { EquipmentSlotMapper, getClothingSlot } from '../../../services/equipment-slot-mapper';

// Props
const props = defineProps<{
  clothing: Record<string, any>;
}>();

// Create normalized clothing access
const clothingProxy = computed(() => {
  return EquipmentSlotMapper.createEquipmentProxy(props.clothing || {}, 'clothing');
});

// Computed
const equippedClothing = computed(() => {
  const equipped: Record<string, any> = {};
  const validSlots = EquipmentSlotMapper.getValidUISlots('clothing');

  for (const uiSlot of validSlots) {
    const item = clothingProxy.value[uiSlot];
    if (item && getItemName(item)) {
      equipped[uiSlot] = item;
    }
  }

  return equipped;
});

const hasEquippedItems = computed(() => {
  return Object.keys(equippedClothing.value).length > 0;
});

// Methods
function getItemName(item: any): string {
  if (!item) return '';
  return item.name || item.Name || '';
}

function getClothingBySlot(slotName: string): any {
  return getClothingSlot(props.clothing, slotName);
}
</script>

<style scoped>
.equipment-grid {
  max-width: 400px;
  margin: 0 auto;
}
</style>

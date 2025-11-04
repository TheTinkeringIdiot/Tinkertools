<!--
ImplantsTable - Implant slots display
Visual grid showing implant slot positions with equipped implants as icons
-->
<template>
  <div class="implants-table">
    <div class="equipment-grid">
      <!-- First row: Ocular, Head, Ear -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <EquipmentSlot slot-name="Ocular" :item="getImplantBySlot('Ocular')" />
        <EquipmentSlot slot-name="Head" :item="getImplantBySlot('Head')" />
        <EquipmentSlot slot-name="Ear" :item="getImplantBySlot('Ear')" />
      </div>

      <!-- Second row: Right Arm, Chest, Left Arm -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <EquipmentSlot slot-name="Right Arm" :item="getImplantBySlot('Right Arm')" />
        <EquipmentSlot slot-name="Chest" :item="getImplantBySlot('Chest')" />
        <EquipmentSlot slot-name="Left Arm" :item="getImplantBySlot('Left Arm')" />
      </div>

      <!-- Third row: Right Wrist, Waist, Left Wrist -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <EquipmentSlot slot-name="Right Wrist" :item="getImplantBySlot('Right Wrist')" />
        <EquipmentSlot slot-name="Waist" :item="getImplantBySlot('Waist')" />
        <EquipmentSlot slot-name="Left Wrist" :item="getImplantBySlot('Left Wrist')" />
      </div>

      <!-- Fourth row: Right Hand, Thigh, Left Hand -->
      <div class="grid grid-cols-3 gap-2 mb-2">
        <EquipmentSlot slot-name="Right Hand" :item="getImplantBySlot('Right Hand')" />
        <EquipmentSlot slot-name="Thigh" :item="getImplantBySlot('Thigh')" />
        <EquipmentSlot slot-name="Left Hand" :item="getImplantBySlot('Left Hand')" />
      </div>

      <!-- Fifth row: Right Leg, Feet, Left Leg -->
      <div class="grid grid-cols-3 gap-2">
        <EquipmentSlot slot-name="Right Leg" :item="getImplantBySlot('Right Leg')" />
        <EquipmentSlot slot-name="Feet" :item="getImplantBySlot('Feet')" />
        <EquipmentSlot slot-name="Left Leg" :item="getImplantBySlot('Left Leg')" />
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
          <span class="text-surface-900 dark:text-surface-50 font-medium">{{
            getItemName(item)
          }}</span>
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
import { EquipmentSlotMapper, getImplantSlot } from '../../../services/equipment-slot-mapper';

// Props
const props = defineProps<{
  implants: Record<string, any>;
}>();

// Create normalized implant access
const implantProxy = computed(() => {
  return EquipmentSlotMapper.createEquipmentProxy(props.implants || {}, 'implants');
});

// Computed
const equippedImplants = computed(() => {
  const equipped: Record<string, any> = {};
  const validSlots = EquipmentSlotMapper.getValidUISlots('implants');

  for (const uiSlot of validSlots) {
    const item = implantProxy.value[uiSlot];
    if (item && getItemName(item)) {
      equipped[uiSlot] = item;
    }
  }

  return equipped;
});

const hasEquippedItems = computed(() => {
  return Object.keys(equippedImplants.value).length > 0;
});

// Methods
function getItemName(item: any): string {
  if (!item) return '';
  return item.name || item.Name || '';
}

function getImplantBySlot(slotName: string): any {
  return getImplantSlot(props.implants, slotName);
}
</script>

<style scoped>
.equipment-grid {
  max-width: 400px;
  margin: 0 auto;
}
</style>
